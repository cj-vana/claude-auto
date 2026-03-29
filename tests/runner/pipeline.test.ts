import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JobConfig } from "../../src/core/types.js";
import type { SpawnResult } from "../../src/runner/types.js";

// Mock all dependencies
vi.mock("../../src/runner/spawner.js", () => ({
	spawnClaude: vi.fn(),
	buildAllowedTools: vi.fn(),
}));

vi.mock("../../src/runner/pipeline-prompts.js", () => ({
	buildPlanPrompt: vi.fn(),
	buildPlanSystemPrompt: vi.fn(),
	buildImplementPrompt: vi.fn(),
	buildImplementSystemPrompt: vi.fn(),
	buildReviewPrompt: vi.fn(),
	buildReviewSystemPrompt: vi.fn(),
	buildFixPrompt: vi.fn(),
	buildFixSystemPrompt: vi.fn(),
	parseReviewVerdict: vi.fn(),
	buildReadOnlyTools: vi.fn(),
}));

vi.mock("../../src/runner/git-ops.js", () => ({
	getDiffFromBase: vi.fn(),
}));

import { getDiffFromBase } from "../../src/runner/git-ops.js";
import { runPipeline } from "../../src/runner/pipeline.js";
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
import { buildAllowedTools, spawnClaude } from "../../src/runner/spawner.js";

const mockedSpawnClaude = vi.mocked(spawnClaude);
const mockedBuildAllowedTools = vi.mocked(buildAllowedTools);
const mockedGetDiffFromBase = vi.mocked(getDiffFromBase);
const mockedBuildPlanPrompt = vi.mocked(buildPlanPrompt);
const mockedBuildPlanSystemPrompt = vi.mocked(buildPlanSystemPrompt);
const mockedBuildImplementPrompt = vi.mocked(buildImplementPrompt);
const mockedBuildImplementSystemPrompt = vi.mocked(buildImplementSystemPrompt);
const mockedBuildReviewPrompt = vi.mocked(buildReviewPrompt);
const mockedBuildReviewSystemPrompt = vi.mocked(buildReviewSystemPrompt);
const mockedBuildFixPrompt = vi.mocked(buildFixPrompt);
const mockedBuildFixSystemPrompt = vi.mocked(buildFixSystemPrompt);
const mockedParseReviewVerdict = vi.mocked(parseReviewVerdict);
const mockedBuildReadOnlyTools = vi.mocked(buildReadOnlyTools);

function makeDefaultConfig(overrides: Partial<JobConfig> = {}): JobConfig {
	return {
		id: "test-job",
		name: "Test Job",
		repo: { path: "/tmp/test-repo", branch: "main", remote: "origin" },
		schedule: { cron: "0 */6 * * *", timezone: "UTC" },
		focus: ["open-issues", "bug-discovery"],
		guardrails: {
			maxTurns: 50,
			maxBudgetUsd: 10.0,
			noNewDependencies: false,
			noArchitectureChanges: false,
			bugFixOnly: false,
		},
		notifications: {},
		enabled: true,
		pipeline: {
			enabled: true,
			planModel: "haiku",
			implementModel: "opus",
			reviewModel: "sonnet",
			maxReviewRounds: 1,
		},
		...overrides,
	};
}

function makeSpawnResult(overrides: Partial<SpawnResult> = {}): SpawnResult {
	return {
		success: true,
		result: "Task completed",
		summary: "Completed task",
		sessionId: "session-abc",
		costUsd: 1.0,
		numTurns: 10,
		durationMs: 10000,
		isError: false,
		subtype: "success",
		...overrides,
	};
}

describe("runPipeline", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Default mock returns
		mockedBuildPlanPrompt.mockReturnValue("plan prompt");
		mockedBuildPlanSystemPrompt.mockReturnValue("plan system prompt");
		mockedBuildImplementPrompt.mockReturnValue("implement prompt");
		mockedBuildImplementSystemPrompt.mockReturnValue("implement system prompt");
		mockedBuildReviewPrompt.mockReturnValue("review prompt");
		mockedBuildReviewSystemPrompt.mockReturnValue("review system prompt");
		mockedBuildFixPrompt.mockReturnValue("fix prompt");
		mockedBuildFixSystemPrompt.mockReturnValue("fix system prompt");
		mockedBuildReadOnlyTools.mockReturnValue(["Read", "Glob", "Grep"]);
		mockedBuildAllowedTools.mockReturnValue(["Read", "Edit", "Write"]);
		mockedGetDiffFromBase.mockResolvedValue("diff --git a/file.ts");

		// Default: all stages succeed, review passes
		mockedSpawnClaude.mockResolvedValue(makeSpawnResult());
		mockedParseReviewVerdict.mockReturnValue("pass");
	});

	it("calls spawnClaude 3 times for pass verdict (plan, implement, review)", async () => {
		const config = makeDefaultConfig();
		mockedParseReviewVerdict.mockReturnValue("pass");

		await runPipeline(config, "/tmp/test-repo", "work-branch", [], []);

		expect(mockedSpawnClaude).toHaveBeenCalledTimes(3);
	});

	it("calls spawnClaude 4 times for fail verdict (plan, implement, review, fix)", async () => {
		const config = makeDefaultConfig();
		mockedParseReviewVerdict.mockReturnValue("fail");

		await runPipeline(config, "/tmp/test-repo", "work-branch", [], []);

		expect(mockedSpawnClaude).toHaveBeenCalledTimes(4);
	});

	it("plan stage uses planModel and read-only tools", async () => {
		const config = makeDefaultConfig();

		await runPipeline(config, "/tmp/test-repo", "work-branch", [], []);

		// First spawnClaude call is plan stage
		const planCall = mockedSpawnClaude.mock.calls[0][0];
		expect(planCall.model).toBe("haiku");
		expect(planCall.allowedTools).toEqual(["Read", "Glob", "Grep"]);
	});

	it("implement stage uses implementModel and full tools", async () => {
		const config = makeDefaultConfig();

		await runPipeline(config, "/tmp/test-repo", "work-branch", [], []);

		// Second spawnClaude call is implement stage
		const implCall = mockedSpawnClaude.mock.calls[1][0];
		expect(implCall.model).toBe("opus");
		expect(implCall.allowedTools).toEqual(["Read", "Edit", "Write"]);
	});

	it("review stage uses reviewModel and read-only tools", async () => {
		const config = makeDefaultConfig();

		await runPipeline(config, "/tmp/test-repo", "work-branch", [], []);

		// Third spawnClaude call is review stage
		const reviewCall = mockedSpawnClaude.mock.calls[2][0];
		expect(reviewCall.model).toBe("sonnet");
		expect(reviewCall.allowedTools).toEqual(["Read", "Glob", "Grep"]);
	});

	it("fix stage uses implementModel", async () => {
		const config = makeDefaultConfig();
		mockedParseReviewVerdict.mockReturnValue("fail");

		await runPipeline(config, "/tmp/test-repo", "work-branch", [], []);

		// Fourth spawnClaude call is fix stage
		const fixCall = mockedSpawnClaude.mock.calls[3][0];
		expect(fixCall.model).toBe("opus");
	});

	it("budget is split correctly (15%/55%/15%/15% of maxBudgetUsd) for single round", async () => {
		const config = makeDefaultConfig({
			guardrails: {
				...makeDefaultConfig().guardrails,
				maxBudgetUsd: 10.0,
			},
		});
		mockedParseReviewVerdict.mockReturnValue("fail");

		await runPipeline(config, "/tmp/test-repo", "work-branch", [], []);

		// Plan: 15% of 10 = 1.5
		expect(mockedSpawnClaude.mock.calls[0][0].maxBudgetUsd).toBeCloseTo(1.5);
		// Implement: 55% of 10 = 5.5
		expect(mockedSpawnClaude.mock.calls[1][0].maxBudgetUsd).toBeCloseTo(5.5);
		// Review: 30% / 1 round / 2 = 15% of 10 = 1.5
		expect(mockedSpawnClaude.mock.calls[2][0].maxBudgetUsd).toBeCloseTo(1.5);
		// Fix: 30% / 1 round / 2 = 15% of 10 = 1.5
		expect(mockedSpawnClaude.mock.calls[3][0].maxBudgetUsd).toBeCloseTo(1.5);
	});

	it("budget for review+fix is divided across multiple rounds so total never exceeds 100%", async () => {
		const config = makeDefaultConfig({
			guardrails: {
				...makeDefaultConfig().guardrails,
				maxBudgetUsd: 10.0,
			},
			pipeline: {
				enabled: true,
				planModel: "haiku",
				implementModel: "opus",
				reviewModel: "sonnet",
				maxReviewRounds: 3,
			},
		});

		// All reviews fail
		mockedParseReviewVerdict.mockReturnValue("fail");

		await runPipeline(config, "/tmp/test-repo", "work-branch", [], []);

		// Plan: 15% = 1.5
		expect(mockedSpawnClaude.mock.calls[0][0].maxBudgetUsd).toBeCloseTo(1.5);
		// Implement: 55% = 5.5
		expect(mockedSpawnClaude.mock.calls[1][0].maxBudgetUsd).toBeCloseTo(5.5);
		// Each review: 30% / 3 / 2 = 5% = 0.5
		// Each fix: 30% / 3 / 2 = 5% = 0.5
		for (let i = 2; i < mockedSpawnClaude.mock.calls.length; i++) {
			expect(mockedSpawnClaude.mock.calls[i][0].maxBudgetUsd).toBeCloseTo(0.5);
		}

		// Total budget: 1.5 + 5.5 + 3*(0.5+0.5) = 10.0 (exactly 100%)
		const totalAllocated = mockedSpawnClaude.mock.calls.reduce(
			(sum, call) => sum + call[0].maxBudgetUsd,
			0,
		);
		expect(totalAllocated).toBeCloseTo(10.0);
	});

	it("plan result text is passed to implement prompt", async () => {
		const config = makeDefaultConfig();
		const planResult = makeSpawnResult({
			result: "Plan: Fix auth.ts validation",
		});
		mockedSpawnClaude.mockResolvedValueOnce(planResult).mockResolvedValue(makeSpawnResult());

		await runPipeline(config, "/tmp/test-repo", "work-branch", [], []);

		expect(mockedBuildImplementPrompt).toHaveBeenCalledWith(config, planResult, expect.any(Array));
	});

	it("diff output is passed to review prompt", async () => {
		const config = makeDefaultConfig();
		mockedGetDiffFromBase.mockResolvedValue("diff --git a/auth.ts b/auth.ts");

		await runPipeline(config, "/tmp/test-repo", "work-branch", [], []);

		expect(mockedBuildReviewPrompt).toHaveBeenCalledWith(
			config,
			expect.any(String), // plan result text
			"diff --git a/auth.ts b/auth.ts",
		);
	});

	it("review feedback is passed to fix prompt", async () => {
		const config = makeDefaultConfig();
		const reviewResult = makeSpawnResult({
			result: "VERDICT: FAIL\n\nThe validation is incomplete.",
		});
		mockedSpawnClaude
			.mockResolvedValueOnce(makeSpawnResult()) // plan
			.mockResolvedValueOnce(makeSpawnResult()) // implement
			.mockResolvedValueOnce(reviewResult) // review
			.mockResolvedValueOnce(makeSpawnResult()); // fix
		mockedParseReviewVerdict.mockReturnValue("fail");

		await runPipeline(config, "/tmp/test-repo", "work-branch", [], []);

		expect(mockedBuildFixPrompt).toHaveBeenCalledWith(
			config,
			"VERDICT: FAIL\n\nThe validation is incomplete.",
		);
	});

	it("PipelineResult aggregates costs from all stages", async () => {
		const config = makeDefaultConfig();
		mockedSpawnClaude
			.mockResolvedValueOnce(makeSpawnResult({ costUsd: 0.5 })) // plan
			.mockResolvedValueOnce(makeSpawnResult({ costUsd: 3.0 })) // implement
			.mockResolvedValueOnce(makeSpawnResult({ costUsd: 0.8 })); // review
		mockedParseReviewVerdict.mockReturnValue("pass");

		const result = await runPipeline(config, "/tmp/test-repo", "work-branch", [], []);

		expect(result.totalCostUsd).toBeCloseTo(4.3);
	});

	it("PipelineResult aggregates costs including fix stage", async () => {
		const config = makeDefaultConfig();
		mockedSpawnClaude
			.mockResolvedValueOnce(makeSpawnResult({ costUsd: 0.5 })) // plan
			.mockResolvedValueOnce(makeSpawnResult({ costUsd: 3.0 })) // implement
			.mockResolvedValueOnce(makeSpawnResult({ costUsd: 0.8 })) // review
			.mockResolvedValueOnce(makeSpawnResult({ costUsd: 1.2 })); // fix
		mockedParseReviewVerdict.mockReturnValue("fail");

		const result = await runPipeline(config, "/tmp/test-repo", "work-branch", [], []);

		expect(result.totalCostUsd).toBeCloseTo(5.5);
	});

	it("PipelineResult.reviewVerdict reflects review outcome (pass)", async () => {
		const config = makeDefaultConfig();
		mockedParseReviewVerdict.mockReturnValue("pass");

		const result = await runPipeline(config, "/tmp/test-repo", "work-branch", [], []);

		expect(result.reviewVerdict).toBe("pass");
	});

	it("PipelineResult.reviewVerdict reflects review outcome (fail)", async () => {
		const config = makeDefaultConfig();
		mockedParseReviewVerdict.mockReturnValue("fail");

		const result = await runPipeline(config, "/tmp/test-repo", "work-branch", [], []);

		expect(result.reviewVerdict).toBe("fail");
	});

	it("PipelineResult.summary uses implement stage summary (not review verdict text)", async () => {
		const config = makeDefaultConfig();
		mockedSpawnClaude
			.mockResolvedValueOnce(makeSpawnResult({ summary: "Plan summary" }))
			.mockResolvedValueOnce(makeSpawnResult({ summary: "Implement summary" }))
			.mockResolvedValueOnce(makeSpawnResult({ summary: "VERDICT: PASS. Looks good." }));
		mockedParseReviewVerdict.mockReturnValue("pass");

		const result = await runPipeline(config, "/tmp/test-repo", "work-branch", [], []);

		expect(result.summary).toBe("Implement summary");
	});

	it("PipelineResult.summary falls back safely when implement stage summary is undefined", async () => {
		const config = makeDefaultConfig();
		mockedSpawnClaude
			.mockResolvedValueOnce(makeSpawnResult({ summary: "Plan summary" }))
			.mockResolvedValueOnce(makeSpawnResult({ summary: undefined as unknown as string }))
			.mockResolvedValueOnce(makeSpawnResult({ summary: "VERDICT: PASS" }));
		mockedParseReviewVerdict.mockReturnValue("pass");

		const result = await runPipeline(config, "/tmp/test-repo", "work-branch", [], []);

		// Should fall back to lastStage summary when implement summary is undefined
		expect(result.summary).toBe("VERDICT: PASS");
	});

	it("PipelineResult.summary uses implement summary even when fix stage runs", async () => {
		const config = makeDefaultConfig();
		mockedSpawnClaude
			.mockResolvedValueOnce(makeSpawnResult({ summary: "Plan summary" }))
			.mockResolvedValueOnce(makeSpawnResult({ summary: "Implement summary" }))
			.mockResolvedValueOnce(makeSpawnResult({ summary: "VERDICT: FAIL. Missing tests." }))
			.mockResolvedValueOnce(makeSpawnResult({ summary: "Fixed the missing tests" }));
		mockedParseReviewVerdict.mockReturnValue("fail");

		const result = await runPipeline(config, "/tmp/test-repo", "work-branch", [], []);

		expect(result.summary).toBe("Implement summary");
	});

	it("PipelineResult.stages contains all stage results", async () => {
		const config = makeDefaultConfig();
		mockedParseReviewVerdict.mockReturnValue("pass");

		const result = await runPipeline(config, "/tmp/test-repo", "work-branch", [], []);

		expect(result.stages).toHaveLength(3);
		expect(result.stages[0].stage).toBe("plan");
		expect(result.stages[1].stage).toBe("implement");
		expect(result.stages[2].stage).toBe("review");
	});

	it("PipelineResult.stages includes fix stage on fail", async () => {
		const config = makeDefaultConfig();
		mockedParseReviewVerdict.mockReturnValue("fail");

		const result = await runPipeline(config, "/tmp/test-repo", "work-branch", [], []);

		expect(result.stages).toHaveLength(4);
		expect(result.stages[3].stage).toBe("fix");
	});

	it("PipelineResult aggregates durations from all stages", async () => {
		const config = makeDefaultConfig();
		mockedSpawnClaude
			.mockResolvedValueOnce(makeSpawnResult({ durationMs: 5000 }))
			.mockResolvedValueOnce(makeSpawnResult({ durationMs: 20000 }))
			.mockResolvedValueOnce(makeSpawnResult({ durationMs: 8000 }));
		mockedParseReviewVerdict.mockReturnValue("pass");

		const result = await runPipeline(config, "/tmp/test-repo", "work-branch", [], []);

		expect(result.totalDurationMs).toBe(33000);
	});

	it("maxReviewRounds > 1 loops review+fix up to N times", async () => {
		const config = makeDefaultConfig({
			pipeline: {
				enabled: true,
				planModel: "haiku",
				implementModel: "opus",
				reviewModel: "sonnet",
				maxReviewRounds: 3,
			},
		});

		// First two reviews fail, third passes
		mockedSpawnClaude
			.mockResolvedValueOnce(makeSpawnResult()) // plan
			.mockResolvedValueOnce(makeSpawnResult()) // implement
			.mockResolvedValueOnce(makeSpawnResult()) // review 1 (fail)
			.mockResolvedValueOnce(makeSpawnResult()) // fix 1
			.mockResolvedValueOnce(makeSpawnResult()) // review 2 (fail)
			.mockResolvedValueOnce(makeSpawnResult()) // fix 2
			.mockResolvedValueOnce(makeSpawnResult()); // review 3 (pass)

		mockedParseReviewVerdict
			.mockReturnValueOnce("fail") // review 1
			.mockReturnValueOnce("fail") // review 2
			.mockReturnValueOnce("pass"); // review 3

		const result = await runPipeline(config, "/tmp/test-repo", "work-branch", [], []);

		// plan + implement + 3 reviews + 2 fixes = 7 spawns
		expect(mockedSpawnClaude).toHaveBeenCalledTimes(7);
		expect(result.reviewVerdict).toBe("pass");
	});

	it("maxReviewRounds defaults to 1 when maxReviewRounds is 1", async () => {
		const config = makeDefaultConfig(); // default maxReviewRounds=1
		mockedParseReviewVerdict.mockReturnValue("fail");

		const result = await runPipeline(config, "/tmp/test-repo", "work-branch", [], []);

		// plan + implement + review + fix = 4 spawns (single round, no re-review)
		expect(mockedSpawnClaude).toHaveBeenCalledTimes(4);
		expect(result.reviewVerdict).toBe("fail");
	});

	it("plan stage uses maxTurns of 20", async () => {
		const config = makeDefaultConfig();

		await runPipeline(config, "/tmp/test-repo", "work-branch", [], []);

		expect(mockedSpawnClaude.mock.calls[0][0].maxTurns).toBe(20);
	});

	it("implement stage uses config maxTurns", async () => {
		const config = makeDefaultConfig({
			guardrails: {
				...makeDefaultConfig().guardrails,
				maxTurns: 75,
			},
		});

		await runPipeline(config, "/tmp/test-repo", "work-branch", [], []);

		expect(mockedSpawnClaude.mock.calls[1][0].maxTurns).toBe(75);
	});

	it("review stage uses maxTurns of 15", async () => {
		const config = makeDefaultConfig();

		await runPipeline(config, "/tmp/test-repo", "work-branch", [], []);

		expect(mockedSpawnClaude.mock.calls[2][0].maxTurns).toBe(15);
	});

	it("all stages use the correct cwd", async () => {
		const config = makeDefaultConfig();
		mockedParseReviewVerdict.mockReturnValue("fail");

		await runPipeline(config, "/tmp/test-repo", "work-branch", [], []);

		for (const call of mockedSpawnClaude.mock.calls) {
			expect(call[0].cwd).toBe("/tmp/test-repo");
		}
	});

	it("getDiffFromBase is called with correct repo and base branch", async () => {
		const config = makeDefaultConfig();

		await runPipeline(config, "/tmp/test-repo", "work-branch", [], []);

		expect(mockedGetDiffFromBase).toHaveBeenCalledWith("/tmp/test-repo", "main");
	});

	it("system prompts are passed via appendSystemPrompt", async () => {
		const config = makeDefaultConfig();
		mockedParseReviewVerdict.mockReturnValue("fail");

		await runPipeline(config, "/tmp/test-repo", "work-branch", [], []);

		expect(mockedSpawnClaude.mock.calls[0][0].appendSystemPrompt).toBe("plan system prompt");
		expect(mockedSpawnClaude.mock.calls[1][0].appendSystemPrompt).toBe("implement system prompt");
		expect(mockedSpawnClaude.mock.calls[2][0].appendSystemPrompt).toBe("review system prompt");
		expect(mockedSpawnClaude.mock.calls[3][0].appendSystemPrompt).toBe("fix system prompt");
	});
});
