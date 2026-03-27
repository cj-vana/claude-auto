import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the exec module
vi.mock("../../src/util/exec.js", () => ({
	execCommand: vi.fn(),
}));

import { extractIssueNumber, postIssueComment } from "../../src/notifications/issue-comment.js";
import { execCommand } from "../../src/util/exec.js";

const mockExecCommand = vi.mocked(execCommand);

describe("extractIssueNumber", () => {
	it("extracts issue number from #42", () => {
		expect(extractIssueNumber("#42")).toBe(42);
	});

	it("extracts issue number from 'fixes #7'", () => {
		expect(extractIssueNumber("fixes #7")).toBe(7);
	});

	it("extracts issue number from 'Closes #123'", () => {
		expect(extractIssueNumber("Closes #123")).toBe(123);
	});

	it("extracts issue number from 'resolves #99'", () => {
		expect(extractIssueNumber("resolves #99")).toBe(99);
	});

	it("returns undefined when no issue reference found", () => {
		expect(extractIssueNumber("no issue here")).toBeUndefined();
	});

	it("extracts issue from PR title '[claude-auto] Fix #42 - broken login'", () => {
		expect(extractIssueNumber("[claude-auto] Fix #42 - broken login")).toBe(42);
	});

	it("extracts first issue from 'Closes #123, fixes #456'", () => {
		expect(extractIssueNumber("Closes #123, fixes #456")).toBe(123);
	});

	it("extracts issue from 'Resolved issue #7'", () => {
		expect(extractIssueNumber("Resolved issue #7")).toBe(7);
	});
});

describe("postIssueComment", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockExecCommand.mockResolvedValue({ stdout: "", stderr: "" });
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	it("calls execCommand with gh issue comment for success status", async () => {
		await postIssueComment({
			repoPath: "/home/user/repos/my-project",
			issueNumber: 42,
			status: "success",
			prUrl: "https://github.com/user/repo/pull/99",
			summary: "Fixed the auth module",
			jobName: "My Test Job",
		});

		expect(mockExecCommand).toHaveBeenCalledTimes(1);
		expect(mockExecCommand).toHaveBeenCalledWith(
			"gh",
			["issue", "comment", "42", "--body", expect.stringContaining("completed work")],
			{ cwd: "/home/user/repos/my-project" },
		);
	});

	it("includes PR URL in success body", async () => {
		await postIssueComment({
			repoPath: "/repo",
			issueNumber: 42,
			status: "success",
			prUrl: "https://github.com/user/repo/pull/99",
			summary: "Fixed stuff",
			jobName: "Job A",
		});

		const body = mockExecCommand.mock.calls[0][1][4];
		expect(body).toContain("https://github.com/user/repo/pull/99");
	});

	it("includes summary in success body", async () => {
		await postIssueComment({
			repoPath: "/repo",
			issueNumber: 42,
			status: "success",
			prUrl: "https://github.com/user/repo/pull/99",
			summary: "Fixed the auth module",
			jobName: "Job A",
		});

		const body = mockExecCommand.mock.calls[0][1][4];
		expect(body).toContain("Fixed the auth module");
	});

	it("calls execCommand with error body for error status", async () => {
		await postIssueComment({
			repoPath: "/repo",
			issueNumber: 42,
			status: "error",
			error: "Build failed with exit code 1",
			jobName: "Job B",
		});

		expect(mockExecCommand).toHaveBeenCalledTimes(1);
		const body = mockExecCommand.mock.calls[0][1][4];
		expect(body).toContain("encountered an error");
		expect(body).toContain("Build failed with exit code 1");
	});

	it("calls execCommand for git-error status", async () => {
		await postIssueComment({
			repoPath: "/repo",
			issueNumber: 10,
			status: "git-error",
			error: "Force push detected",
			jobName: "Job C",
		});

		expect(mockExecCommand).toHaveBeenCalledTimes(1);
		const body = mockExecCommand.mock.calls[0][1][4];
		expect(body).toContain("encountered an error");
		expect(body).toContain("Force push detected");
	});

	it("calls execCommand for no-changes status", async () => {
		await postIssueComment({
			repoPath: "/repo",
			issueNumber: 5,
			status: "no-changes",
			summary: "Analyzed but nothing to change",
			jobName: "Job D",
		});

		expect(mockExecCommand).toHaveBeenCalledTimes(1);
		const body = mockExecCommand.mock.calls[0][1][4];
		expect(body).toContain("made no changes");
		expect(body).toContain("Analyzed but nothing to change");
	});

	it("posts specific comment for budget-exceeded status", async () => {
		await postIssueComment({
			repoPath: "/repo",
			issueNumber: 42,
			status: "budget-exceeded",
			jobName: "Job G",
		});

		expect(mockExecCommand).toHaveBeenCalledTimes(1);
		const body = mockExecCommand.mock.calls[0][1][4];
		expect(body).toContain("budget limit");
		expect(body).toContain("Job G");
	});

	it("posts specific comment for merge-conflict status", async () => {
		await postIssueComment({
			repoPath: "/repo",
			issueNumber: 42,
			status: "merge-conflict",
			jobName: "Job H",
		});

		expect(mockExecCommand).toHaveBeenCalledTimes(1);
		const body = mockExecCommand.mock.calls[0][1][4];
		expect(body).toContain("merge conflict");
		expect(body).toContain("Job H");
	});

	it("posts specific comment for needs-human-review status", async () => {
		await postIssueComment({
			repoPath: "/repo",
			issueNumber: 42,
			status: "needs-human-review",
			jobName: "Job I",
		});

		expect(mockExecCommand).toHaveBeenCalledTimes(1);
		const body = mockExecCommand.mock.calls[0][1][4];
		expect(body).toContain("human review");
		expect(body).toContain("Job I");
	});

	it("does NOT call execCommand for locked status", async () => {
		await postIssueComment({
			repoPath: "/repo",
			issueNumber: 42,
			status: "locked",
			jobName: "Job E",
		});

		expect(mockExecCommand).not.toHaveBeenCalled();
	});

	it("catches execCommand errors without throwing", async () => {
		mockExecCommand.mockRejectedValue(new Error("gh not found"));

		await expect(
			postIssueComment({
				repoPath: "/repo",
				issueNumber: 42,
				status: "success",
				prUrl: "https://github.com/user/repo/pull/99",
				summary: "Fixed stuff",
				jobName: "Job F",
			}),
		).resolves.toBeUndefined();
	});

	it("logs warning when execCommand fails", async () => {
		mockExecCommand.mockRejectedValue(new Error("gh not found"));
		const warnSpy = vi.spyOn(console, "warn");

		await postIssueComment({
			repoPath: "/repo",
			issueNumber: 42,
			status: "success",
			prUrl: "https://github.com/user/repo/pull/99",
			summary: "Fixed stuff",
			jobName: "Job F",
		});

		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("[claude-auto]"));
	});
});
