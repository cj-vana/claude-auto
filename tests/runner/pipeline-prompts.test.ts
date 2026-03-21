import { describe, expect, it } from "vitest";
import type { JobConfig } from "../../src/core/types.js";
import type { RunContext } from "../../src/runner/context-store.js";
import type { ScoredIssue } from "../../src/runner/issue-triage.js";
import {
	buildFixPrompt,
	buildFixSystemPrompt,
	buildImplementPrompt,
	buildImplementSystemPrompt,
	buildPlanPrompt,
	buildPlanSystemPrompt,
	buildReadOnlyTools,
	buildReviewPrompt,
	buildReviewSystemPrompt,
	parseReviewVerdict,
} from "../../src/runner/pipeline-prompts.js";
import type { SpawnResult } from "../../src/runner/types.js";

function makeDefaultConfig(overrides: Partial<JobConfig> = {}): JobConfig {
	return {
		id: "test-job",
		name: "Test Job",
		repo: { path: "/tmp/test-repo", branch: "main", remote: "origin" },
		schedule: { cron: "0 */6 * * *", timezone: "UTC" },
		focus: ["open-issues", "bug-discovery"],
		guardrails: {
			maxTurns: 50,
			maxBudgetUsd: 5.0,
			noNewDependencies: false,
			noArchitectureChanges: false,
			bugFixOnly: false,
		},
		notifications: {},
		enabled: true,
		...overrides,
	};
}

function makeSpawnResult(overrides: Partial<SpawnResult> = {}): SpawnResult {
	return {
		success: true,
		result: "I created a plan to fix the auth bug",
		summary: "Plan for auth bug fix",
		sessionId: "session-abc-123",
		costUsd: 0.5,
		numTurns: 8,
		durationMs: 15000,
		isError: false,
		subtype: "success",
		...overrides,
	};
}

const mockContext: RunContext[] = [
	{
		id: "run-001",
		status: "success",
		pr_url: "https://github.com/test/repo/pull/42",
		branch_name: "auto/fix-auth-bug",
		issue_number: 42,
		summary: null,
		started_at: "2026-03-21T12:00:00Z",
	},
];

const mockTriaged: ScoredIssue[] = [
	{
		number: 10,
		title: "Fix auth module bug",
		body: "The auth module has a null pointer exception when...",
		labels: ["bug"],
		score: 80,
	},
	{
		number: 11,
		title: "Add rate limiting",
		body: "We need rate limiting for API endpoints",
		labels: ["enhancement"],
		score: 60,
	},
];

// --- buildPlanPrompt tests ---

describe("buildPlanPrompt", () => {
	it('includes "Implementation Plan" heading', () => {
		const config = makeDefaultConfig();
		const prompt = buildPlanPrompt(config, [], []);

		expect(prompt).toContain("Implementation Plan");
	});

	it("includes triaged issues when provided", () => {
		const config = makeDefaultConfig();
		const prompt = buildPlanPrompt(config, mockTriaged, []);

		expect(prompt).toContain("#10");
		expect(prompt).toContain("Fix auth module bug");
		expect(prompt).toContain("score: 80");
	});

	it("includes context when provided", () => {
		const config = makeDefaultConfig();
		const prompt = buildPlanPrompt(config, [], mockContext);

		expect(prompt).toContain("Previous Work");
		expect(prompt).toContain("Issue: #42");
	});

	it("does NOT include git safety section (plan is read-only)", () => {
		const config = makeDefaultConfig();
		const prompt = buildPlanPrompt(config, [], []);

		expect(prompt).not.toContain("NEVER force push");
		expect(prompt).not.toContain("Git Safety");
	});

	it("includes do-not-make-changes instruction", () => {
		const config = makeDefaultConfig();
		const prompt = buildPlanPrompt(config, [], []);

		expect(prompt.toLowerCase()).toContain("do not make any changes");
	});

	it("includes focus areas from config", () => {
		const config = makeDefaultConfig({ focus: ["open-issues", "documentation"] });
		const prompt = buildPlanPrompt(config, [], []);

		expect(prompt).toContain("open-issues");
		expect(prompt).toContain("documentation");
	});

	it("limits displayed triaged issues to 5", () => {
		const config = makeDefaultConfig();
		const manyIssues: ScoredIssue[] = Array.from({ length: 8 }, (_, i) => ({
			number: 100 + i,
			title: `Issue ${i}`,
			body: `Body ${i}`,
			labels: ["bug"],
			score: 80 - i,
		}));
		const prompt = buildPlanPrompt(config, manyIssues, []);

		expect(prompt).toContain("#100");
		expect(prompt).toContain("#104");
		expect(prompt).not.toContain("#105");
	});
});

// --- buildPlanSystemPrompt tests ---

describe("buildPlanSystemPrompt", () => {
	it('includes "PLANNING stage" framing', () => {
		const config = makeDefaultConfig();
		const prompt = buildPlanSystemPrompt(config);

		expect(prompt).toContain("PLANNING stage");
	});

	it("includes config.systemPrompt when set", () => {
		const config = makeDefaultConfig({
			systemPrompt: "Always use functional style.",
		});
		const prompt = buildPlanSystemPrompt(config);

		expect(prompt).toContain("Always use functional style.");
	});

	it("does not include undefined when systemPrompt is not set", () => {
		const config = makeDefaultConfig();
		const prompt = buildPlanSystemPrompt(config);

		expect(prompt).not.toContain("undefined");
	});
});

// --- buildImplementPrompt tests ---

describe("buildImplementPrompt", () => {
	it("includes the plan result text", () => {
		const config = makeDefaultConfig();
		const planResult = makeSpawnResult({
			result: "Step 1: Modify auth.ts to add validation\nStep 2: Update tests",
		});
		const prompt = buildImplementPrompt(config, planResult, []);

		expect(prompt).toContain("Step 1: Modify auth.ts to add validation");
		expect(prompt).toContain("Step 2: Update tests");
	});

	it("includes git safety section", () => {
		const config = makeDefaultConfig();
		const planResult = makeSpawnResult();
		const prompt = buildImplementPrompt(config, planResult, []);

		expect(prompt).toContain("NEVER force push");
		expect(prompt).toContain("Git Safety");
	});

	it("includes previous work context when provided", () => {
		const config = makeDefaultConfig();
		const planResult = makeSpawnResult();
		const prompt = buildImplementPrompt(config, planResult, mockContext);

		expect(prompt).toContain("Previous Work");
	});

	it("includes focus areas", () => {
		const config = makeDefaultConfig({ focus: ["open-issues", "documentation"] });
		const planResult = makeSpawnResult();
		const prompt = buildImplementPrompt(config, planResult, []);

		expect(prompt).toContain("open-issues");
		expect(prompt).toContain("documentation");
	});
});

// --- buildImplementSystemPrompt tests ---

describe("buildImplementSystemPrompt", () => {
	it('includes "IMPLEMENTATION stage" framing', () => {
		const config = makeDefaultConfig();
		const prompt = buildImplementSystemPrompt(config);

		expect(prompt).toContain("IMPLEMENTATION stage");
	});

	it("includes config.systemPrompt when set", () => {
		const config = makeDefaultConfig({
			systemPrompt: "Use TypeScript strict mode.",
		});
		const prompt = buildImplementSystemPrompt(config);

		expect(prompt).toContain("Use TypeScript strict mode.");
	});
});

// --- buildReviewPrompt tests ---

describe("buildReviewPrompt", () => {
	it("includes plan text", () => {
		const config = makeDefaultConfig();
		const prompt = buildReviewPrompt(config, "The plan is to fix auth.ts", "diff --git a/src/auth.ts");

		expect(prompt).toContain("The plan is to fix auth.ts");
	});

	it("includes diff output", () => {
		const config = makeDefaultConfig();
		const prompt = buildReviewPrompt(config, "Some plan", "+added line\n-removed line");

		expect(prompt).toContain("+added line");
		expect(prompt).toContain("-removed line");
	});

	it('includes "VERDICT: PASS" and "VERDICT: FAIL" instruction', () => {
		const config = makeDefaultConfig();
		const prompt = buildReviewPrompt(config, "plan", "diff");

		expect(prompt).toContain("VERDICT: PASS");
		expect(prompt).toContain("VERDICT: FAIL");
	});

	it("does NOT include file modification instructions", () => {
		const config = makeDefaultConfig();
		const prompt = buildReviewPrompt(config, "plan", "diff");

		// Review is read-only, should not instruct to edit files
		expect(prompt).not.toContain("Commit your changes");
		expect(prompt).not.toContain("commit all changes");
	});
});

// --- buildReviewSystemPrompt tests ---

describe("buildReviewSystemPrompt", () => {
	it('includes "REVIEW stage" framing', () => {
		const config = makeDefaultConfig();
		const prompt = buildReviewSystemPrompt(config);

		expect(prompt).toContain("REVIEW stage");
	});

	it("does NOT include file modification instructions", () => {
		const config = makeDefaultConfig();
		const prompt = buildReviewSystemPrompt(config);

		expect(prompt).not.toContain("make changes");
		expect(prompt).not.toContain("Edit files");
	});

	it("includes config.systemPrompt when set", () => {
		const config = makeDefaultConfig({
			systemPrompt: "Focus on security.",
		});
		const prompt = buildReviewSystemPrompt(config);

		expect(prompt).toContain("Focus on security.");
	});
});

// --- buildFixPrompt tests ---

describe("buildFixPrompt", () => {
	it("includes review feedback text", () => {
		const config = makeDefaultConfig();
		const prompt = buildFixPrompt(config, "The auth validation is missing input sanitization");

		expect(prompt).toContain("The auth validation is missing input sanitization");
	});

	it("includes git safety section", () => {
		const config = makeDefaultConfig();
		const prompt = buildFixPrompt(config, "Some review feedback");

		expect(prompt).toContain("NEVER force push");
		expect(prompt).toContain("Git Safety");
	});

	it('includes "Fix Issues" task framing', () => {
		const config = makeDefaultConfig();
		const prompt = buildFixPrompt(config, "feedback");

		expect(prompt).toContain("Fix Issues");
	});
});

// --- buildFixSystemPrompt tests ---

describe("buildFixSystemPrompt", () => {
	it("includes FIX stage framing", () => {
		const config = makeDefaultConfig();
		const prompt = buildFixSystemPrompt(config);

		expect(prompt).toContain("FIX stage");
	});

	it("includes config.systemPrompt when set", () => {
		const config = makeDefaultConfig({
			systemPrompt: "Use pure functions.",
		});
		const prompt = buildFixSystemPrompt(config);

		expect(prompt).toContain("Use pure functions.");
	});
});

// --- parseReviewVerdict tests ---

describe("parseReviewVerdict", () => {
	it('returns "pass" for text containing "VERDICT: PASS"', () => {
		const result = makeSpawnResult({
			result: "The implementation looks good.\n\nVERDICT: PASS",
		});

		expect(parseReviewVerdict(result)).toBe("pass");
	});

	it('returns "fail" for text containing "VERDICT: FAIL"', () => {
		const result = makeSpawnResult({
			result: "There are issues with the auth module.\n\nVERDICT: FAIL",
		});

		expect(parseReviewVerdict(result)).toBe("fail");
	});

	it('returns "fail" for text with no verdict marker (default to fail is safer)', () => {
		const result = makeSpawnResult({
			result: "The code looks okay but I am not sure.",
		});

		expect(parseReviewVerdict(result)).toBe("fail");
	});

	it("is case-insensitive on the verdict line", () => {
		const result = makeSpawnResult({
			result: "verdict: pass",
		});

		expect(parseReviewVerdict(result)).toBe("pass");
	});

	it("handles VERDICT: PASS with surrounding text on same line", () => {
		const result = makeSpawnResult({
			result: "Everything checks out. VERDICT: PASS. Good job!",
		});

		expect(parseReviewVerdict(result)).toBe("pass");
	});

	it("returns fail when both PASS and FAIL markers exist (FAIL takes priority)", () => {
		const result = makeSpawnResult({
			result: "I initially thought VERDICT: PASS but actually VERDICT: FAIL",
		});

		expect(parseReviewVerdict(result)).toBe("fail");
	});
});

// --- buildReadOnlyTools tests ---

describe("buildReadOnlyTools", () => {
	it("returns tools without Edit/Write/Bash(git add)/Bash(git commit)", () => {
		const config = makeDefaultConfig();
		const tools = buildReadOnlyTools(config);

		expect(tools).not.toContain("Edit");
		expect(tools).not.toContain("Write");
		expect(tools).not.toEqual(expect.arrayContaining([expect.stringMatching(/Bash\(git add/)]));
		expect(tools).not.toEqual(
			expect.arrayContaining([expect.stringMatching(/Bash\(git commit/)]),
		);
	});

	it("includes read-only tools: Read, Glob, Grep", () => {
		const config = makeDefaultConfig();
		const tools = buildReadOnlyTools(config);

		expect(tools).toContain("Read");
		expect(tools).toContain("Glob");
		expect(tools).toContain("Grep");
	});

	it("includes git status, diff, and log tools", () => {
		const config = makeDefaultConfig();
		const tools = buildReadOnlyTools(config);

		expect(tools).toEqual(expect.arrayContaining([expect.stringMatching(/Bash\(git status/)]));
		expect(tools).toEqual(expect.arrayContaining([expect.stringMatching(/Bash\(git diff/)]));
		expect(tools).toEqual(expect.arrayContaining([expect.stringMatching(/Bash\(git log/)]));
	});

	it("includes gh issue tools and test tools", () => {
		const config = makeDefaultConfig();
		const tools = buildReadOnlyTools(config);

		expect(tools).toEqual(
			expect.arrayContaining([expect.stringMatching(/Bash\(gh issue list/)]),
		);
		expect(tools).toEqual(
			expect.arrayContaining([expect.stringMatching(/Bash\(gh issue view/)]),
		);
		expect(tools).toEqual(expect.arrayContaining([expect.stringMatching(/Bash\(npm test/)]));
	});
});
