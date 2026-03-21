import type { JobConfig } from "../core/types.js";
import { formatContextWindow, type RunContext } from "./context-store.js";
import type { ScoredIssue } from "./issue-triage.js";
import { GIT_SAFETY_SECTION } from "./prompt-builder.js";
import type { SpawnResult } from "./types.js";

/**
 * Build a read-only tool set for plan and review stages.
 * Excludes Edit, Write, and git mutation tools (add, commit).
 * Includes read-only tools: file reading, search, git inspection, issue viewing, test running.
 *
 * @param _config - Job configuration (reserved for future guardrail-based filtering)
 * @returns Array of allowed tool strings for read-only stages
 */
export function buildReadOnlyTools(_config: JobConfig): string[] {
	return [
		"Read",
		"Glob",
		"Grep",
		"Bash(git status *)",
		"Bash(git diff *)",
		"Bash(git log *)",
		"Bash(gh issue list *)",
		"Bash(gh issue view *)",
		"Bash(npm test *)",
		"Bash(npm run test *)",
		"Bash(npx *)",
	];
}

/**
 * Build the work prompt for the PLAN stage of the pipeline.
 * Instructs Claude to research the codebase and produce a concrete,
 * actionable implementation plan without making any changes.
 *
 * @param config - Job configuration with focus areas
 * @param triaged - Pre-scored issues from triage (may be empty)
 * @param context - Prior run context for duplicate avoidance
 * @returns Multi-section plan prompt string
 */
export function buildPlanPrompt(
	config: JobConfig,
	triaged: ScoredIssue[],
	context: RunContext[],
): string {
	const sections: string[] = [];

	// Section 1: Task framing
	sections.push(`## Task: Create an Implementation Plan

Research the codebase thoroughly and produce a concrete, actionable plan.

**Output Requirements:**
1. A clear statement of what will be changed and why
2. A numbered list of specific files to modify
3. For each file: the exact changes to make
4. Expected test commands to verify the changes

Do NOT make any changes yourself. Only produce the plan.`);

	// Section 2: Candidate issues (if triaged)
	if (triaged.length > 0) {
		const maxDisplay = 5;
		const displayed = triaged.slice(0, maxDisplay);
		const issueLines = displayed.map(
			(issue, i) =>
				`${i + 1}. **#${issue.number}: ${issue.title}** (score: ${issue.score})`,
		);
		sections.push(`## Candidate Issues\n\n${issueLines.join("\n")}`);
	}

	// Section 3: Focus areas
	if (config.focus.length > 0) {
		sections.push(`## Focus Areas\nConcentrate your work on: ${config.focus.join(", ")}.`);
	}

	// Section 4: Previous work context
	if (context.length > 0) {
		const contextSection = formatContextWindow(context);
		if (contextSection) {
			sections.push(contextSection);
		}
	}

	return sections.join("\n\n");
}

/**
 * Build the system prompt for the PLAN stage.
 *
 * @param config - Job configuration with optional systemPrompt
 * @returns System prompt string for the planning stage
 */
export function buildPlanSystemPrompt(config: JobConfig): string {
	let prompt =
		"You are the PLANNING stage of an autonomous coding pipeline. " +
		"Research the codebase thoroughly. Produce an actionable plan, not a vague description.";

	if (config.systemPrompt) {
		prompt += `\n\n${config.systemPrompt}`;
	}

	return prompt;
}

/**
 * Build the work prompt for the IMPLEMENT stage of the pipeline.
 * Includes the plan output, focus areas, guardrails, git safety rules,
 * and completion instructions.
 *
 * @param config - Job configuration with guardrails and focus areas
 * @param planResult - SpawnResult from the plan stage
 * @param context - Prior run context for duplicate avoidance
 * @returns Multi-section implement prompt string
 */
export function buildImplementPrompt(
	config: JobConfig,
	planResult: SpawnResult,
	context: RunContext[],
): string {
	const sections: string[] = [];

	// Section 1: Task with plan text
	sections.push(`## Task: Implement the Plan Below

Follow the plan precisely. Make only the changes described.

### Plan
${planResult.result}`);

	// Section 2: Focus areas
	if (config.focus.length > 0) {
		sections.push(`## Focus Areas\nConcentrate your work on: ${config.focus.join(", ")}.`);
	}

	// Section 3: Guardrails
	const guardrailLines: string[] = [];
	if (config.guardrails.noNewDependencies) {
		guardrailLines.push("- Do NOT add any new dependencies to package.json or equivalent");
	}
	if (config.guardrails.noArchitectureChanges) {
		guardrailLines.push(
			"- Do NOT make architectural changes (new modules, directory restructuring)",
		);
	}
	if (config.guardrails.bugFixOnly) {
		guardrailLines.push("- Only fix bugs. Do NOT add features or make improvements.");
	}
	if (config.guardrails.restrictToPaths && config.guardrails.restrictToPaths.length > 0) {
		guardrailLines.push(
			`- Only modify files in these paths: ${config.guardrails.restrictToPaths.join(", ")}`,
		);
	}
	if (guardrailLines.length > 0) {
		sections.push(`## Guardrails\n${guardrailLines.join("\n")}`);
	}

	// Section 4: Git safety
	sections.push(GIT_SAFETY_SECTION);

	// Section 5: Completion instructions
	sections.push(`## Completion
When your work is complete:
- Commit all changes with descriptive messages
- Do NOT create a PR yourself -- the orchestrator handles this
- Write a clear summary of what you did, why, and what you changed as your final message`);

	// Section 6: Previous work context
	if (context.length > 0) {
		const contextSection = formatContextWindow(context);
		if (contextSection) {
			sections.push(contextSection);
		}
	}

	return sections.join("\n\n");
}

/**
 * Build the system prompt for the IMPLEMENT stage.
 *
 * @param config - Job configuration with optional systemPrompt
 * @returns System prompt string for the implementation stage
 */
export function buildImplementSystemPrompt(config: JobConfig): string {
	let prompt =
		"You are the IMPLEMENTATION stage of an autonomous coding pipeline. " +
		"Follow the plan precisely. Make only the changes described in the plan.";

	if (config.systemPrompt) {
		prompt += `\n\n${config.systemPrompt}`;
	}

	return prompt;
}

/**
 * Build the work prompt for the REVIEW stage of the pipeline.
 * Includes the original plan, the implementation diff, and verdict instructions.
 *
 * @param config - Job configuration
 * @param planText - The plan stage output text
 * @param diffOutput - Git diff of implementation changes
 * @returns Multi-section review prompt string
 */
export function buildReviewPrompt(
	config: JobConfig,
	planText: string,
	diffOutput: string,
): string {
	const sections: string[] = [];

	// Section 1: Task framing with review instructions
	sections.push(`## Task: Review Implementation

Review the implementation against the plan and the diff below.

**Verdict Criteria:**
- PASS if: Changes correctly implement the plan, no breaking changes,
  no security issues, code follows project conventions.
- FAIL ONLY if: Breaking changes, security vulnerabilities, logic errors,
  changes that don't match the plan, or missing error handling.

Do NOT nitpick style. Focus on correctness and safety.`);

	// Section 2: Original plan
	sections.push(`## Original Plan\n${planText}`);

	// Section 3: Implementation diff
	sections.push(`## Implementation Diff\n\`\`\`diff\n${diffOutput}\n\`\`\``);

	// Section 4: Response format
	sections.push(`## Your Response
End your review with exactly one of these lines:
VERDICT: PASS
VERDICT: FAIL

If FAIL, explain what needs to be fixed.`);

	return sections.join("\n\n");
}

/**
 * Build the system prompt for the REVIEW stage.
 *
 * @param config - Job configuration with optional systemPrompt
 * @returns System prompt string for the review stage
 */
export function buildReviewSystemPrompt(config: JobConfig): string {
	let prompt =
		"You are the REVIEW stage of an autonomous coding pipeline. " +
		"Focus on correctness and safety. Do NOT nitpick style.";

	if (config.systemPrompt) {
		prompt += `\n\n${config.systemPrompt}`;
	}

	return prompt;
}

/**
 * Build the work prompt for the FIX stage of the pipeline.
 * Includes the review feedback and git safety rules.
 *
 * @param config - Job configuration
 * @param reviewText - The review stage output text with issues to fix
 * @returns Multi-section fix prompt string
 */
export function buildFixPrompt(config: JobConfig, reviewText: string): string {
	const sections: string[] = [];

	// Section 1: Task framing
	sections.push(`## Task: Fix Issues Found in Review

Address the issues identified in the review below.`);

	// Section 2: Review feedback
	sections.push(`## Review Feedback\n${reviewText}`);

	// Section 3: Git safety
	sections.push(GIT_SAFETY_SECTION);

	// Section 4: Completion instructions
	sections.push(`## Completion
When done fixing the issues:
- Commit all changes with descriptive messages
- Write a clear summary of what you fixed as your final message`);

	return sections.join("\n\n");
}

/**
 * Build the system prompt for the FIX stage.
 *
 * @param config - Job configuration with optional systemPrompt
 * @returns System prompt string for the fix stage
 */
export function buildFixSystemPrompt(config: JobConfig): string {
	let prompt =
		"You are the FIX stage. Address the review feedback precisely.";

	if (config.systemPrompt) {
		prompt += `\n\n${config.systemPrompt}`;
	}

	return prompt;
}

/**
 * Parse the review stage output to determine the verdict.
 * Searches for "VERDICT: PASS" or "VERDICT: FAIL" markers.
 * If both exist, FAIL takes priority (safer).
 * Defaults to "fail" when no verdict marker is found (safer to run fix stage unnecessarily).
 *
 * @param reviewResult - SpawnResult from the review stage
 * @returns "pass" or "fail"
 */
export function parseReviewVerdict(reviewResult: SpawnResult): "pass" | "fail" {
	const text = reviewResult.result.toLowerCase();

	// FAIL takes priority if both markers exist
	if (text.includes("verdict: fail")) {
		return "fail";
	}
	if (text.includes("verdict: pass")) {
		return "pass";
	}

	// Default to fail -- safer to run fix stage unnecessarily
	return "fail";
}
