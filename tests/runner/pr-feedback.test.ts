import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the exec module
vi.mock("../../src/util/exec.js", () => ({
	execCommand: vi.fn(),
}));

// Mock the database module
vi.mock("../../src/core/database.js", () => ({
	getDatabase: vi.fn(),
}));

import { getDatabase } from "../../src/core/database.js";
import {
	checkPendingPRFeedback,
	getFeedbackRound,
	getRepoOwnerName,
	getUnresolvedThreads,
	listOpenPRsWithFeedback,
	postPRComment,
} from "../../src/runner/pr-feedback.js";
import { execCommand } from "../../src/util/exec.js";

const mockExecCommand = vi.mocked(execCommand);
const mockGetDatabase = vi.mocked(getDatabase);

describe("pr-feedback module", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("listOpenPRsWithFeedback", () => {
		it("filters PRs by branch prefix and parses JSON", async () => {
			mockExecCommand.mockResolvedValueOnce({
				stdout: JSON.stringify([
					{
						number: 10,
						title: "Auto fix",
						headRefName: "claude-auto/my-job/2026-01-01T00-00-00",
						reviewDecision: "CHANGES_REQUESTED",
						url: "https://github.com/o/r/pull/10",
					},
					{
						number: 11,
						title: "Other PR",
						headRefName: "feature/unrelated",
						reviewDecision: "APPROVED",
						url: "https://github.com/o/r/pull/11",
					},
					{
						number: 12,
						title: "Another job",
						headRefName: "claude-auto/other-job/2026-01-02T00-00-00",
						reviewDecision: "CHANGES_REQUESTED",
						url: "https://github.com/o/r/pull/12",
					},
				]),
				stderr: "",
			});

			const result = await listOpenPRsWithFeedback("/repo", "my-job");

			expect(result).toHaveLength(1);
			expect(result[0].number).toBe(10);
			expect(result[0].headRefName).toBe("claude-auto/my-job/2026-01-01T00-00-00");

			expect(mockExecCommand).toHaveBeenCalledWith(
				"gh",
				[
					"pr",
					"list",
					"--author",
					"@me",
					"--state",
					"open",
					"--json",
					"number,headRefName,reviewDecision,title,url",
				],
				{ cwd: "/repo" },
			);
		});

		it("returns empty array when no matching PRs", async () => {
			mockExecCommand.mockResolvedValueOnce({
				stdout: JSON.stringify([
					{
						number: 5,
						title: "Unrelated",
						headRefName: "feature/other",
						reviewDecision: "APPROVED",
						url: "https://github.com/o/r/pull/5",
					},
				]),
				stderr: "",
			});

			const result = await listOpenPRsWithFeedback("/repo", "my-job");
			expect(result).toHaveLength(0);
		});
	});

	describe("listOpenPRsWithFeedback — malformed JSON", () => {
		it("throws descriptive error when gh returns non-JSON", async () => {
			mockExecCommand.mockResolvedValueOnce({
				stdout: "Error: rate limit exceeded",
				stderr: "",
			});

			await expect(listOpenPRsWithFeedback("/repo", "my-job")).rejects.toThrow(
				/Failed to parse gh pr list output as JSON/,
			);
		});
	});

	describe("getRepoOwnerName", () => {
		it("parses owner.login and name correctly", async () => {
			mockExecCommand.mockResolvedValueOnce({
				stdout: JSON.stringify({ owner: { login: "myorg" }, name: "myrepo" }),
				stderr: "",
			});

			const result = await getRepoOwnerName("/repo");

			expect(result).toEqual({ owner: "myorg", name: "myrepo" });
			expect(mockExecCommand).toHaveBeenCalledWith("gh", ["repo", "view", "--json", "owner,name"], {
				cwd: "/repo",
			});
		});
	});

	describe("getRepoOwnerName — malformed JSON", () => {
		it("throws descriptive error when gh returns non-JSON", async () => {
			mockExecCommand.mockResolvedValueOnce({
				stdout: "<html>502 Bad Gateway</html>",
				stderr: "",
			});

			await expect(getRepoOwnerName("/repo")).rejects.toThrow(
				/Failed to parse gh repo view output as JSON/,
			);
		});
	});

	describe("getUnresolvedThreads", () => {
		it("filters resolved threads and filters bot comments", async () => {
			// First call: getRepoOwnerName
			mockExecCommand.mockResolvedValueOnce({
				stdout: JSON.stringify({ owner: { login: "myorg" }, name: "myrepo" }),
				stderr: "",
			});

			// Second call: GraphQL query
			mockExecCommand.mockResolvedValueOnce({
				stdout: JSON.stringify({
					data: {
						repository: {
							pullRequest: {
								reviewThreads: {
									nodes: [
										{
											id: "thread-1",
											isResolved: false,
											comments: {
												nodes: [{ body: "Fix this bug", author: { login: "reviewer1" } }],
											},
										},
										{
											id: "thread-2",
											isResolved: true,
											comments: {
												nodes: [{ body: "Already fixed", author: { login: "reviewer1" } }],
											},
										},
										{
											id: "thread-3",
											isResolved: false,
											comments: {
												nodes: [
													{ body: "CI check failed", author: { login: "github-actions[bot]" } },
												],
											},
										},
									],
								},
							},
						},
					},
				}),
				stderr: "",
			});

			const result = await getUnresolvedThreads("/repo", 42);

			// Should only return thread-1 (unresolved, non-bot)
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe("thread-1");
			expect(result[0].isResolved).toBe(false);
			expect(result[0].comments[0].body).toBe("Fix this bug");
		});

		it("returns empty when all threads resolved", async () => {
			// getRepoOwnerName
			mockExecCommand.mockResolvedValueOnce({
				stdout: JSON.stringify({ owner: { login: "o" }, name: "r" }),
				stderr: "",
			});

			// GraphQL
			mockExecCommand.mockResolvedValueOnce({
				stdout: JSON.stringify({
					data: {
						repository: {
							pullRequest: {
								reviewThreads: {
									nodes: [
										{
											id: "thread-1",
											isResolved: true,
											comments: { nodes: [{ body: "Done", author: { login: "reviewer1" } }] },
										},
									],
								},
							},
						},
					},
				}),
				stderr: "",
			});

			const result = await getUnresolvedThreads("/repo", 10);
			expect(result).toHaveLength(0);
		});
	});

	describe("getUnresolvedThreads — malformed responses", () => {
		it("throws descriptive error when GraphQL returns non-JSON", async () => {
			mockExecCommand.mockResolvedValueOnce({
				stdout: JSON.stringify({ owner: { login: "o" }, name: "r" }),
				stderr: "",
			});
			mockExecCommand.mockResolvedValueOnce({
				stdout: "Internal Server Error",
				stderr: "",
			});

			await expect(getUnresolvedThreads("/repo", 42)).rejects.toThrow(
				/Failed to parse GraphQL response as JSON/,
			);
		});

		it("throws descriptive error when GraphQL response has unexpected structure", async () => {
			mockExecCommand.mockResolvedValueOnce({
				stdout: JSON.stringify({ owner: { login: "o" }, name: "r" }),
				stderr: "",
			});
			// Response with no errors array but also no valid data structure
			mockExecCommand.mockResolvedValueOnce({
				stdout: JSON.stringify({ data: { repository: null } }),
				stderr: "",
			});

			await expect(getUnresolvedThreads("/repo", 42)).rejects.toThrow(
				/Unexpected GraphQL response structure for PR #42/,
			);
		});
	});

	describe("postPRComment", () => {
		it("calls gh pr comment with correct args", async () => {
			mockExecCommand.mockResolvedValueOnce({ stdout: "", stderr: "" });

			await postPRComment("/repo", 42, "Addressed all feedback");

			expect(mockExecCommand).toHaveBeenCalledWith(
				"gh",
				["pr", "comment", "42", "--body", "Addressed all feedback"],
				{ cwd: "/repo" },
			);
		});

		it("does not throw on failure (logs warning)", async () => {
			mockExecCommand.mockRejectedValueOnce(new Error("network error"));

			// Should not throw
			await expect(postPRComment("/repo", 42, "body")).resolves.toBeUndefined();
		});
	});

	describe("getFeedbackRound", () => {
		it("returns 0 for new PRs with no prior runs", () => {
			const mockPrepare = vi.fn().mockReturnValue({
				get: vi.fn().mockReturnValue({ count: 0 }),
			});
			mockGetDatabase.mockReturnValue({ prepare: mockPrepare } as any);

			const result = getFeedbackRound("my-job", 42);
			expect(result).toBe(0);
		});

		it("returns N for existing PRs with N prior feedback runs", () => {
			const mockPrepare = vi.fn().mockReturnValue({
				get: vi.fn().mockReturnValue({ count: 3 }),
			});
			mockGetDatabase.mockReturnValue({ prepare: mockPrepare } as any);

			const result = getFeedbackRound("my-job", 42);
			expect(result).toBe(3);
		});
	});

	describe("checkPendingPRFeedback", () => {
		it("returns PRFeedbackContext when unresolved threads exist", async () => {
			// listOpenPRsWithFeedback
			mockExecCommand.mockResolvedValueOnce({
				stdout: JSON.stringify([
					{
						number: 10,
						title: "Auto fix",
						headRefName: "claude-auto/job1/2026-01-01T00-00-00",
						reviewDecision: "CHANGES_REQUESTED",
						url: "https://github.com/o/r/pull/10",
					},
				]),
				stderr: "",
			});

			// getRepoOwnerName (called by getUnresolvedThreads)
			mockExecCommand.mockResolvedValueOnce({
				stdout: JSON.stringify({ owner: { login: "o" }, name: "r" }),
				stderr: "",
			});

			// GraphQL
			mockExecCommand.mockResolvedValueOnce({
				stdout: JSON.stringify({
					data: {
						repository: {
							pullRequest: {
								reviewThreads: {
									nodes: [
										{
											id: "t1",
											isResolved: false,
											comments: {
												nodes: [{ body: "Please fix", author: { login: "human" } }],
											},
										},
									],
								},
							},
						},
					},
				}),
				stderr: "",
			});

			// getFeedbackRound
			const mockPrepare = vi.fn().mockReturnValue({
				get: vi.fn().mockReturnValue({ count: 1 }),
			});
			mockGetDatabase.mockReturnValue({ prepare: mockPrepare } as any);

			const result = await checkPendingPRFeedback("/repo", "job1", 3);

			expect(result).not.toBeNull();
			expect(result?.number).toBe(10);
			expect(result?.title).toBe("Auto fix");
			expect(result?.unresolvedThreads).toHaveLength(1);
			expect(result?.currentRound).toBe(1);
			expect(result?.reviewDecision).toBe("CHANGES_REQUESTED");
		});

		it("returns null when reviewDecision is not CHANGES_REQUESTED", async () => {
			mockExecCommand.mockResolvedValueOnce({
				stdout: JSON.stringify([
					{
						number: 10,
						title: "Good PR",
						headRefName: "claude-auto/job1/2026-01-01T00-00-00",
						reviewDecision: "APPROVED",
						url: "https://github.com/o/r/pull/10",
					},
				]),
				stderr: "",
			});

			const result = await checkPendingPRFeedback("/repo", "job1", 3);
			expect(result).toBeNull();
		});

		it("returns null when max rounds exceeded", async () => {
			// listOpenPRsWithFeedback
			mockExecCommand.mockResolvedValueOnce({
				stdout: JSON.stringify([
					{
						number: 10,
						title: "PR at max",
						headRefName: "claude-auto/job1/2026-01-01T00-00-00",
						reviewDecision: "CHANGES_REQUESTED",
						url: "https://github.com/o/r/pull/10",
					},
				]),
				stderr: "",
			});

			// getRepoOwnerName
			mockExecCommand.mockResolvedValueOnce({
				stdout: JSON.stringify({ owner: { login: "o" }, name: "r" }),
				stderr: "",
			});

			// GraphQL - has unresolved threads
			mockExecCommand.mockResolvedValueOnce({
				stdout: JSON.stringify({
					data: {
						repository: {
							pullRequest: {
								reviewThreads: {
									nodes: [
										{
											id: "t1",
											isResolved: false,
											comments: {
												nodes: [{ body: "Fix this", author: { login: "human" } }],
											},
										},
									],
								},
							},
						},
					},
				}),
				stderr: "",
			});

			// getFeedbackRound returns 3 (max is 3)
			const mockPrepare = vi.fn().mockReturnValue({
				get: vi.fn().mockReturnValue({ count: 3 }),
			});
			mockGetDatabase.mockReturnValue({ prepare: mockPrepare } as any);

			const result = await checkPendingPRFeedback("/repo", "job1", 3);
			expect(result).toBeNull();
		});

		it("returns null when no unresolved threads", async () => {
			// listOpenPRsWithFeedback
			mockExecCommand.mockResolvedValueOnce({
				stdout: JSON.stringify([
					{
						number: 10,
						title: "All resolved",
						headRefName: "claude-auto/job1/2026-01-01T00-00-00",
						reviewDecision: "CHANGES_REQUESTED",
						url: "https://github.com/o/r/pull/10",
					},
				]),
				stderr: "",
			});

			// getRepoOwnerName
			mockExecCommand.mockResolvedValueOnce({
				stdout: JSON.stringify({ owner: { login: "o" }, name: "r" }),
				stderr: "",
			});

			// GraphQL - all resolved
			mockExecCommand.mockResolvedValueOnce({
				stdout: JSON.stringify({
					data: {
						repository: {
							pullRequest: {
								reviewThreads: {
									nodes: [
										{
											id: "t1",
											isResolved: true,
											comments: {
												nodes: [{ body: "Fixed", author: { login: "human" } }],
											},
										},
									],
								},
							},
						},
					},
				}),
				stderr: "",
			});

			const result = await checkPendingPRFeedback("/repo", "job1", 3);
			expect(result).toBeNull();
		});

		it("returns null when no open PRs match job", async () => {
			mockExecCommand.mockResolvedValueOnce({
				stdout: JSON.stringify([]),
				stderr: "",
			});

			const result = await checkPendingPRFeedback("/repo", "job1", 3);
			expect(result).toBeNull();
		});

		it("skips max-rounds PR and returns next actionable candidate", async () => {
			// listOpenPRsWithFeedback — two PRs with CHANGES_REQUESTED
			mockExecCommand.mockResolvedValueOnce({
				stdout: JSON.stringify([
					{
						number: 10,
						title: "PR at max rounds",
						headRefName: "claude-auto/job1/2026-01-01T00-00-00",
						reviewDecision: "CHANGES_REQUESTED",
						url: "https://github.com/o/r/pull/10",
					},
					{
						number: 20,
						title: "PR still actionable",
						headRefName: "claude-auto/job1/2026-01-02T00-00-00",
						reviewDecision: "CHANGES_REQUESTED",
						url: "https://github.com/o/r/pull/20",
					},
				]),
				stderr: "",
			});

			// getUnresolvedThreads for PR #10: getRepoOwnerName
			mockExecCommand.mockResolvedValueOnce({
				stdout: JSON.stringify({ owner: { login: "o" }, name: "r" }),
				stderr: "",
			});
			// GraphQL for PR #10 — has unresolved threads
			mockExecCommand.mockResolvedValueOnce({
				stdout: JSON.stringify({
					data: {
						repository: {
							pullRequest: {
								reviewThreads: {
									nodes: [
										{
											id: "t1",
											isResolved: false,
											comments: {
												nodes: [{ body: "Fix this", author: { login: "human" } }],
											},
										},
									],
								},
							},
						},
					},
				}),
				stderr: "",
			});

			// getUnresolvedThreads for PR #20: getRepoOwnerName
			mockExecCommand.mockResolvedValueOnce({
				stdout: JSON.stringify({ owner: { login: "o" }, name: "r" }),
				stderr: "",
			});
			// GraphQL for PR #20 — has unresolved threads
			mockExecCommand.mockResolvedValueOnce({
				stdout: JSON.stringify({
					data: {
						repository: {
							pullRequest: {
								reviewThreads: {
									nodes: [
										{
											id: "t2",
											isResolved: false,
											comments: {
												nodes: [{ body: "Also fix this", author: { login: "human" } }],
											},
										},
									],
								},
							},
						},
					},
				}),
				stderr: "",
			});

			// getFeedbackRound: PR #10 returns 3 (at max), PR #20 returns 1
			const mockGet = vi
				.fn()
				.mockReturnValueOnce({ count: 3 }) // PR #10 at max
				.mockReturnValueOnce({ count: 1 }); // PR #20 still actionable
			const mockPrepare = vi.fn().mockReturnValue({ get: mockGet });
			mockGetDatabase.mockReturnValue({ prepare: mockPrepare } as any);

			const result = await checkPendingPRFeedback("/repo", "job1", 3);

			// Should skip PR #10 (at max rounds) and return PR #20
			expect(result).not.toBeNull();
			expect(result?.number).toBe(20);
			expect(result?.title).toBe("PR still actionable");
			expect(result?.currentRound).toBe(1);
		});
	});

	describe("getUnresolvedThreads — GraphQL errors", () => {
		it("throws descriptive error when GraphQL response contains errors array", async () => {
			mockExecCommand.mockResolvedValueOnce({
				stdout: JSON.stringify({ owner: { login: "o" }, name: "r" }),
				stderr: "",
			});
			mockExecCommand.mockResolvedValueOnce({
				stdout: JSON.stringify({
					errors: [
						{ message: "Could not resolve to a Repository" },
						{ message: "Authentication required" },
					],
				}),
				stderr: "",
			});

			await expect(getUnresolvedThreads("/repo", 42)).rejects.toThrow(
				/GraphQL errors for PR #42: Could not resolve to a Repository; Authentication required/,
			);
		});
	});
});
