import type { JobConfig } from "../core/types.js";
import type { RunContext } from "./context-store.js";
import { getDiffFromBase } from "./git-ops.js";
import type { ScoredIssue } from "./issue-triage.js";
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
} from "./pipeline-prompts.js";
import { buildAllowedTools, spawnClaude } from "./spawner.js";
import type { PipelineResult, PipelineStageResult } from "./types.js";

/** Budget fraction allocated to the plan stage (15%). */
const BUDGET_PLAN = 0.15;

/** Budget fraction allocated to the implement stage (55%). */
const BUDGET_IMPLEMENT = 0.55;

/** Budget fraction allocated to each review round (15%). */
const BUDGET_REVIEW = 0.15;

/** Budget fraction allocated to each fix round (15%). */
const BUDGET_FIX = 0.15;

/**
 * Run the multi-stage pipeline: plan -> implement -> review -> optional fix.
 *
 * Each stage spawns a separate Claude instance via spawnClaude with its
 * configured model, budget slice, and prompt. The review stage verdict
 * determines whether a fix stage runs.
 *
 * When maxReviewRounds > 1, the review+fix cycle repeats up to N times.
 * On the last round, if review fails, the fix stage still runs once but
 * no re-review occurs.
 *
 * @param config - Job configuration with pipeline settings
 * @param repoPath - Path to the repository
 * @param branchName - Current work branch name
 * @param runContext - Prior run context for duplicate avoidance
 * @param triaged - Pre-scored issues from triage
 * @returns PipelineResult with all stage results aggregated
 */
export async function runPipeline(
	config: JobConfig,
	repoPath: string,
	branchName: string,
	runContext: RunContext[],
	triaged: ScoredIssue[],
): Promise<PipelineResult> {
	const pipeline = config.pipeline!;
	const totalBudget = config.guardrails.maxBudgetUsd;
	const stages: PipelineStageResult[] = [];

	// --- Stage 1: Plan ---
	const planPrompt = buildPlanPrompt(config, triaged, runContext);
	const planSystemPrompt = buildPlanSystemPrompt(config);
	const planTools = buildReadOnlyTools(config);

	const planResult = await spawnClaude({
		cwd: repoPath,
		prompt: planPrompt,
		maxTurns: 20,
		maxBudgetUsd: totalBudget * BUDGET_PLAN,
		allowedTools: planTools,
		appendSystemPrompt: planSystemPrompt,
		model: pipeline.planModel,
	});

	stages.push({ stage: "plan", spawnResult: planResult });

	// --- Stage 2: Implement ---
	const implementPrompt = buildImplementPrompt(config, planResult, runContext);
	const implementSystemPrompt = buildImplementSystemPrompt(config);
	const implementTools = buildAllowedTools(config);

	const implementResult = await spawnClaude({
		cwd: repoPath,
		prompt: implementPrompt,
		maxTurns: config.guardrails.maxTurns,
		maxBudgetUsd: totalBudget * BUDGET_IMPLEMENT,
		allowedTools: implementTools,
		appendSystemPrompt: implementSystemPrompt,
		model: pipeline.implementModel,
	});

	stages.push({ stage: "implement", spawnResult: implementResult });

	// --- Stage 3+4: Review loop ---
	let reviewVerdict: "pass" | "fail" | "skipped" = "skipped";
	const maxRounds = pipeline.maxReviewRounds ?? 1;

	for (let round = 0; round < maxRounds; round++) {
		// Get diff for review
		const diffOutput = await getDiffFromBase(repoPath, config.repo.branch);

		// Review
		const reviewPrompt = buildReviewPrompt(config, planResult.result, diffOutput);
		const reviewSystemPrompt = buildReviewSystemPrompt(config);
		const reviewTools = buildReadOnlyTools(config);

		const reviewResult = await spawnClaude({
			cwd: repoPath,
			prompt: reviewPrompt,
			maxTurns: 15,
			maxBudgetUsd: totalBudget * BUDGET_REVIEW,
			allowedTools: reviewTools,
			appendSystemPrompt: reviewSystemPrompt,
			model: pipeline.reviewModel,
		});

		stages.push({ stage: "review", spawnResult: reviewResult });
		reviewVerdict = parseReviewVerdict(reviewResult);

		if (reviewVerdict === "pass") break;

		// Fix stage runs on fail
		const fixPrompt = buildFixPrompt(config, reviewResult.result);
		const fixSystemPrompt = buildFixSystemPrompt(config);
		const fixTools = buildAllowedTools(config);

		const fixResult = await spawnClaude({
			cwd: repoPath,
			prompt: fixPrompt,
			maxTurns: 20,
			maxBudgetUsd: totalBudget * BUDGET_FIX,
			allowedTools: fixTools,
			appendSystemPrompt: fixSystemPrompt,
			model: pipeline.implementModel,
		});

		stages.push({ stage: "fix", spawnResult: fixResult });
	}

	// --- Aggregate results ---
	const totalCostUsd = stages.reduce((sum, s) => sum + s.spawnResult.costUsd, 0);
	const totalDurationMs = stages.reduce((sum, s) => sum + s.spawnResult.durationMs, 0);
	const lastStage = stages[stages.length - 1];

	return {
		stages,
		reviewVerdict,
		totalCostUsd,
		totalDurationMs,
		summary: lastStage.spawnResult.summary,
	};
}
