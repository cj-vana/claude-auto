import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

// Mock the exec module
vi.mock("../../src/util/exec.js", () => ({
	execCommand: vi.fn(),
}));

import { execCommand } from "../../src/util/exec.js";
import {
	pullLatest,
	createBranch,
	hasChanges,
	pushBranch,
	createPR,
	checkoutExistingBranch,
} from "../../src/runner/git-ops.js";
import { GitOpsError } from "../../src/util/errors.js";

const mockExecCommand = vi.mocked(execCommand);

describe("git-ops module", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockExecCommand.mockResolvedValue({ stdout: "", stderr: "" });
	});

	describe("pullLatest", () => {
		it("calls git fetch, checkout, and pull --ff-only in order", async () => {
			await pullLatest("/repo/path", "main", "origin");

			expect(mockExecCommand).toHaveBeenCalledTimes(3);

			// First: fetch
			expect(mockExecCommand).toHaveBeenNthCalledWith(1, "git", [
				"-C",
				"/repo/path",
				"fetch",
				"origin",
			]);

			// Second: checkout
			expect(mockExecCommand).toHaveBeenNthCalledWith(2, "git", [
				"-C",
				"/repo/path",
				"checkout",
				"main",
			]);

			// Third: pull --ff-only
			expect(mockExecCommand).toHaveBeenNthCalledWith(3, "git", [
				"-C",
				"/repo/path",
				"pull",
				"--ff-only",
				"origin",
				"main",
			]);
		});

		it("throws GitOpsError on failure", async () => {
			mockExecCommand.mockRejectedValueOnce(new Error("network error"));

			await expect(pullLatest("/repo", "main", "origin")).rejects.toThrow(GitOpsError);
		});
	});

	describe("createBranch", () => {
		it("returns branch name matching pattern claude-auto/{jobId}/{timestamp}", async () => {
			const branchName = await createBranch("/repo/path", "my-job-id");

			expect(branchName).toMatch(/^claude-auto\/my-job-id\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);
		});

		it("calls git checkout -b with the generated branch name", async () => {
			const branchName = await createBranch("/repo/path", "test-job");

			expect(mockExecCommand).toHaveBeenCalledWith("git", [
				"-C",
				"/repo/path",
				"checkout",
				"-b",
				branchName,
			]);
		});

		it("throws GitOpsError on failure", async () => {
			mockExecCommand.mockRejectedValueOnce(new Error("branch exists"));

			await expect(createBranch("/repo", "job")).rejects.toThrow(GitOpsError);
		});
	});

	describe("hasChanges", () => {
		it("returns true when git status --porcelain has output", async () => {
			mockExecCommand.mockResolvedValueOnce({
				stdout: " M src/file.ts\n",
				stderr: "",
			});

			const result = await hasChanges("/repo/path");

			expect(result).toBe(true);
			expect(mockExecCommand).toHaveBeenCalledWith("git", [
				"-C",
				"/repo/path",
				"status",
				"--porcelain",
			]);
		});

		it("returns false when git status --porcelain is empty", async () => {
			mockExecCommand.mockResolvedValueOnce({ stdout: "", stderr: "" });

			const result = await hasChanges("/repo/path");

			expect(result).toBe(false);
		});

		it("returns false when git status --porcelain is only whitespace", async () => {
			mockExecCommand.mockResolvedValueOnce({ stdout: "  \n", stderr: "" });

			const result = await hasChanges("/repo/path");

			expect(result).toBe(false);
		});

		it("throws GitOpsError on failure", async () => {
			mockExecCommand.mockRejectedValueOnce(new Error("not a repo"));

			await expect(hasChanges("/repo")).rejects.toThrow(GitOpsError);
		});
	});

	describe("pushBranch", () => {
		it("calls git push with -u origin but NEVER --force or -f", async () => {
			await pushBranch("/repo/path", "claude-auto/job/2026-01-01T00-00-00");

			expect(mockExecCommand).toHaveBeenCalledWith("git", [
				"-C",
				"/repo/path",
				"push",
				"-u",
				"origin",
				"claude-auto/job/2026-01-01T00-00-00",
			]);

			// Verify no --force or -f in any call
			for (const call of mockExecCommand.mock.calls) {
				const args = call[1] as string[];
				expect(args).not.toContain("--force");
				expect(args).not.toContain("-f");
				expect(args).not.toContain("--force-with-lease");
			}
		});

		it("throws GitOpsError on failure", async () => {
			mockExecCommand.mockRejectedValueOnce(new Error("auth failed"));

			await expect(
				pushBranch("/repo", "branch"),
			).rejects.toThrow(GitOpsError);
		});
	});

	describe("createPR", () => {
		it("calls gh pr create and returns the URL from stdout", async () => {
			mockExecCommand.mockResolvedValueOnce({
				stdout: "https://github.com/owner/repo/pull/42\n",
				stderr: "",
			});

			const url = await createPR(
				"/repo/path",
				"claude-auto/job/2026-01-01T00-00-00",
				"main",
				"feat: auto improvements",
				"PR body here",
			);

			expect(url).toBe("https://github.com/owner/repo/pull/42");
			expect(mockExecCommand).toHaveBeenCalledWith(
				"gh",
				[
					"pr",
					"create",
					"--head",
					"claude-auto/job/2026-01-01T00-00-00",
					"--base",
					"main",
					"--title",
					"feat: auto improvements",
					"--body",
					"PR body here",
				],
				{ cwd: "/repo/path" },
			);
		});

		it("throws GitOpsError on failure", async () => {
			mockExecCommand.mockRejectedValueOnce(new Error("gh not authenticated"));

			await expect(
				createPR("/repo", "branch", "main", "title", "body"),
			).rejects.toThrow(GitOpsError);
		});
	});

	describe("checkoutExistingBranch", () => {
		it("calls fetch, checkout, reset --hard in order", async () => {
			await checkoutExistingBranch("/repo/path", "claude-auto/job/2026-01-01T00-00-00");

			expect(mockExecCommand).toHaveBeenCalledTimes(3);

			// First: fetch
			expect(mockExecCommand).toHaveBeenNthCalledWith(1, "git", [
				"-C",
				"/repo/path",
				"fetch",
				"origin",
				"claude-auto/job/2026-01-01T00-00-00",
			]);

			// Second: checkout
			expect(mockExecCommand).toHaveBeenNthCalledWith(2, "git", [
				"-C",
				"/repo/path",
				"checkout",
				"claude-auto/job/2026-01-01T00-00-00",
			]);

			// Third: reset --hard
			expect(mockExecCommand).toHaveBeenNthCalledWith(3, "git", [
				"-C",
				"/repo/path",
				"reset",
				"--hard",
				"origin/claude-auto/job/2026-01-01T00-00-00",
			]);
		});

		it("throws GitOpsError on failure", async () => {
			mockExecCommand.mockRejectedValueOnce(new Error("fetch failed"));

			await expect(
				checkoutExistingBranch("/repo", "branch"),
			).rejects.toThrow(GitOpsError);
		});
	});

	describe("GIT-03 compliance: no --force in source", () => {
		it("source code never contains --force flag", () => {
			const source = readFileSync("src/runner/git-ops.ts", "utf-8");
			expect(source).not.toMatch(/--force/);
		});

		it("source code never contains -f flag passed to git", () => {
			const source = readFileSync("src/runner/git-ops.ts", "utf-8");
			// Match -f when it appears as a string argument (quoted or in array)
			expect(source).not.toMatch(/['" ]-f['" ,\]]/);
		});
	});
});
