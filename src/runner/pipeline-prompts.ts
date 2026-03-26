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

	// Section 1: Task framing with explicit research steps
	sections.push(`## Task: Research and Create an Implementation Plan

You are the PLANNING stage. Your job is to deeply understand the codebase and produce a precise, actionable plan that another Claude instance will execute.

### Research Steps (do ALL of these before planning)

1. **Read project docs**: Check for CLAUDE.md, README.md, CONTRIBUTING.md, or similar files that describe conventions, architecture, and build/test commands.
2. **Understand the build system**: Find the test command, linter, type checker, and build command. Run the test suite to know the current state (what passes, what fails).
3. **Study existing patterns**: Read 2-3 files similar to what you'll modify. Note naming conventions, error handling patterns, import style, and test patterns.
4. **If fixing an issue**: Read the full issue including comments. Check for related issues or PRs. Search the codebase for relevant code.
5. **If discovering bugs**: Run tests, linter, and type checker. Grep for TODO/FIXME/HACK comments. Look for error handling gaps.
6. **Check recent git history**: Run \`git log --oneline -20\` to understand recent changes and avoid conflicting with in-progress work.

### Plan Output Requirements

1. **What and why**: A clear statement of the problem and your proposed solution
2. **Files to modify**: A numbered list of specific files with the exact changes for each
3. **New files** (if any): Full path and purpose
4. **Test strategy**: How to verify the changes work (specific test commands to run)
5. **Risk assessment**: What could go wrong, what existing functionality might break

Do NOT make any changes yourself. Only produce the plan.`);

	// Section 2: Candidate issues (if triaged)
	if (triaged.length > 0) {
		const maxDisplay = 5;
		const displayed = triaged.slice(0, maxDisplay);
		const issueLines = displayed.map(
			(issue, i) => `${i + 1}. **#${issue.number}: ${issue.title}** (score: ${issue.score})`,
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
		"Your plan will be handed to a separate Claude instance that has never seen this codebase, " +
		"so it must be specific enough to execute without ambiguity. " +
		"Include exact file paths, function names, and code patterns. " +
		"A vague plan produces vague code. A precise plan produces correct code.";

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
	_config: JobConfig,
	planText: string,
	diffOutput: string,
): string {
	const sections: string[] = [];

	// Section 1: Task framing with review instructions
	sections.push(`## Task: Review Implementation

Review the implementation against the plan and the diff below.

### Review Checklist

1. **Correctness**: Do the changes match the plan? Is the logic correct?
2. **Tests**: Run the test suite. Do all tests pass? Were new tests added for new behavior?
3. **Regressions**: Could these changes break existing functionality?
4. **Security**: Any injection risks, credential leaks, or unsafe patterns?
5. **Conventions**: Does the code follow the project's existing patterns and style?

**Verdict Criteria:**
- PASS if: Changes correctly implement the plan, tests pass, no breaking changes, no security issues.
- FAIL ONLY if: Tests fail, breaking changes, security vulnerabilities, logic errors, changes that don't match the plan, or missing error handling for edge cases.

Do NOT nitpick style. Focus on correctness, test results, and safety.`);

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
export function buildFixPrompt(_config: JobConfig, reviewText: string): string {
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
	let prompt = "You are the FIX stage. Address the review feedback precisely.";

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
