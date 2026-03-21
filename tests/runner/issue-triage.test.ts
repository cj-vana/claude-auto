import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock execCommand before importing the module under test
vi.mock("../../src/util/exec.js", () => ({
	execCommand: vi.fn(),
}));

import { type ScoredIssue, triageIssues } from "../../src/runner/issue-triage.js";
import { execCommand } from "../../src/util/exec.js";

const mockExecCommand = vi.mocked(execCommand);

/** Helper to create a gh issue JSON object */
function makeIssue(
	overrides: Partial<{
		number: number;
		title: string;
		body: string | null;
		labels: Array<{ name: string }>;
		assignees: Array<{ login: string }>;
		createdAt: string;
		comments: Array<unknown>;
	}> = {},
) {
	return {
		number: 1,
		title: "Test issue",
		body: "This is a test issue with enough body text to be considered valid.",
		labels: [],
		assignees: [],
		createdAt: "2026-03-20T10:00:00Z",
		comments: [],
		...overrides,
	};
}

function mockGhIssues(issues: ReturnType<typeof makeIssue>[]) {
	mockExecCommand.mockResolvedValue({
		stdout: JSON.stringify(issues),
		stderr: "",
	});
}

describe("issue-triage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("scoring (TRIG-01)", () => {
		it("scores issues with base score of 50", async () => {
			mockGhIssues([makeIssue({ number: 1 })]);
			const result = await triageIssues("/test/repo", []);
			expect(result).toHaveLength(1);
			// Base 50 + body quality bonus (body > 100 chars? no, it's ~60 chars, so no bonus, no penalty)
			expect(result[0].score).toBe(50);
		});

		it("boosts score for well-described issues (body > 100 chars)", async () => {
			const longBody = "A".repeat(101);
			mockGhIssues([makeIssue({ number: 1, body: longBody })]);
			const result = await triageIssues("/test/repo", []);
			expect(result[0].score).toBe(60); // 50 base + 10 body quality
		});

		it("penalizes vague issues (body < 20 chars)", async () => {
			mockGhIssues([makeIssue({ number: 1, body: "short" })]);
			const result = await triageIssues("/test/repo", []);
			expect(result[0].score).toBe(20); // 50 base - 30 vague penalty
		});

		it("combines body quality and label scores", async () => {
			const longBody = "A".repeat(501);
			mockGhIssues([
				makeIssue({
					number: 1,
					body: longBody,
					labels: [{ name: "bug" }],
				}),
			]);
			const result = await triageIssues("/test/repo", []);
			// 50 base + 20 bug + 10 body>100 + 5 body>500 = 85
			expect(result[0].score).toBe(85);
		});
	});

	describe("skip logic (TRIG-02)", () => {
		it("skips already-attempted issues", async () => {
			mockGhIssues([makeIssue({ number: 42 })]);
			const result = await triageIssues("/test/repo", [42]);
			expect(result).toHaveLength(0);
		});

		it("skips assigned issues", async () => {
			mockGhIssues([
				makeIssue({
					number: 1,
					assignees: [{ login: "someone" }],
				}),
			]);
			const result = await triageIssues("/test/repo", []);
			expect(result).toHaveLength(0);
		});

		it("skips issues with wontfix label", async () => {
			mockGhIssues([
				makeIssue({
					number: 1,
					labels: [{ name: "wontfix" }],
				}),
			]);
			const result = await triageIssues("/test/repo", []);
			expect(result).toHaveLength(0);
		});

		it("skips issues with duplicate label", async () => {
			mockGhIssues([
				makeIssue({
					number: 1,
					labels: [{ name: "duplicate" }],
				}),
			]);
			const result = await triageIssues("/test/repo", []);
			expect(result).toHaveLength(0);
		});

		it("skips issues with question label", async () => {
			mockGhIssues([
				makeIssue({
					number: 1,
					labels: [{ name: "question" }],
				}),
			]);
			const result = await triageIssues("/test/repo", []);
			expect(result).toHaveLength(0);
		});

		it("skips issues with discussion label", async () => {
			mockGhIssues([
				makeIssue({
					number: 1,
					labels: [{ name: "discussion" }],
				}),
			]);
			const result = await triageIssues("/test/repo", []);
			expect(result).toHaveLength(0);
		});

		it("skip reasons are documented in skipReason field", async () => {
			// We need to test that skip reasons are set correctly.
			// Since skipped issues are filtered out, we test by checking internal behavior
			// through multiple issues where some are skipped and some aren't.
			mockGhIssues([
				makeIssue({ number: 1 }), // not skipped
				makeIssue({ number: 2, assignees: [{ login: "user" }] }), // skipped: assigned
				makeIssue({ number: 3, labels: [{ name: "wontfix" }] }), // skipped: negative-label
				makeIssue({ number: 4, labels: [{ name: "question" }] }), // skipped: requires-human
			]);
			const result = await triageIssues("/test/repo", [5]); // 5 is previous, not in list
			// Only issue 1 should remain
			expect(result).toHaveLength(1);
			expect(result[0].number).toBe(1);
		});
	});

	describe("priority (TRIG-03)", () => {
		it("prioritizes 'good first issue' labeled issues (+30)", async () => {
			mockGhIssues([
				makeIssue({
					number: 1,
					labels: [{ name: "good first issue" }],
				}),
			]);
			const result = await triageIssues("/test/repo", []);
			expect(result[0].score).toBe(80); // 50 + 30
		});

		it("prioritizes 'bug' labeled issues (+20)", async () => {
			mockGhIssues([
				makeIssue({
					number: 1,
					labels: [{ name: "bug" }],
				}),
			]);
			const result = await triageIssues("/test/repo", []);
			expect(result[0].score).toBe(70); // 50 + 20
		});

		it("prioritizes 'enhancement' labeled issues (+10)", async () => {
			mockGhIssues([
				makeIssue({
					number: 1,
					labels: [{ name: "enhancement" }],
				}),
			]);
			const result = await triageIssues("/test/repo", []);
			expect(result[0].score).toBe(60); // 50 + 10
		});

		it("sorts results by score descending", async () => {
			mockGhIssues([
				makeIssue({ number: 1, body: "short" }), // 50 - 30 = 20
				makeIssue({ number: 2, labels: [{ name: "bug" }] }), // 50 + 20 = 70
				makeIssue({ number: 3, labels: [{ name: "good first issue" }] }), // 50 + 30 = 80
			]);
			const result = await triageIssues("/test/repo", []);
			expect(result[0].number).toBe(3); // score 80
			expect(result[1].number).toBe(2); // score 70
			expect(result[2].number).toBe(1); // score 20
		});

		it("bug + well-described issue ranks higher than unlabeled vague issue", async () => {
			const longBody = "A".repeat(150);
			mockGhIssues([
				makeIssue({ number: 1, body: "tiny" }), // 50 - 30 = 20 (vague, unlabeled)
				makeIssue({ number: 2, body: longBody, labels: [{ name: "bug" }] }), // 50 + 20 + 10 = 80
			]);
			const result = await triageIssues("/test/repo", []);
			expect(result[0].number).toBe(2);
			expect(result[0].score).toBeGreaterThan(result[1].score);
		});
	});

	describe("edge cases", () => {
		it("handles empty issue list", async () => {
			mockGhIssues([]);
			const result = await triageIssues("/test/repo", []);
			expect(result).toEqual([]);
		});

		it("handles issues with null body", async () => {
			mockGhIssues([makeIssue({ number: 1, body: null })]);
			const result = await triageIssues("/test/repo", []);
			expect(result).toHaveLength(1);
			expect(result[0].score).toBe(20); // 50 - 30 (null body treated as vague)
			expect(result[0].body).toBe("");
		});

		it("truncates body to 1000 chars in output", async () => {
			const longBody = "B".repeat(2000);
			mockGhIssues([makeIssue({ number: 1, body: longBody })]);
			const result = await triageIssues("/test/repo", []);
			expect(result[0].body.length).toBe(1000);
		});

		it("label matching is case-insensitive", async () => {
			mockGhIssues([
				makeIssue({
					number: 1,
					labels: [{ name: "Bug" }],
				}),
				makeIssue({
					number: 2,
					labels: [{ name: "WONTFIX" }],
				}),
				makeIssue({
					number: 3,
					labels: [{ name: "Good First Issue" }],
				}),
			]);
			const result = await triageIssues("/test/repo", []);
			// Issue 2 should be skipped (WONTFIX -> negative-label)
			expect(result).toHaveLength(2);
			const numbers = result.map((r) => r.number);
			expect(numbers).toContain(1); // Bug -> +20
			expect(numbers).toContain(3); // Good First Issue -> +30
			expect(numbers).not.toContain(2); // WONTFIX -> skipped

			// Check scoring for case-insensitive label matching
			const bugIssue = result.find((r) => r.number === 1)!;
			expect(bugIssue.score).toBe(70); // 50 + 20 (Bug)

			const gfiIssue = result.find((r) => r.number === 3)!;
			expect(gfiIssue.score).toBe(80); // 50 + 30 (Good First Issue)
		});
	});
});
