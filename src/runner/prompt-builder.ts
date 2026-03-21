import type { JobConfig } from "../core/types.js";
import { formatContextWindow, type RunContext } from "./context-store.js";

/**
 * Build the system prompt for Claude, including research instructions
 * and an optional user-provided system prompt.
 *
 * @param config - Job configuration with optional systemPrompt
 * @returns Combined system prompt string
 */
export function buildSystemPrompt(config: JobConfig): string {
	let prompt =
		"You are an autonomous coding agent working on this repository. " +
		"Before starting any work, thoroughly research and understand the current codebase " +
		"implementation, project structure, and recent changes.";

	if (config.systemPrompt) {
		prompt += `\n\n${config.systemPrompt}`;
	}

	return prompt;
}

/**
 * Build the work prompt for Claude, containing priority chain, focus areas,
 * conditional guardrails, git safety rules, documentation requirements,
 * completion instructions, and optionally a "Previous Work" context section.
 *
 * @param config - Job configuration with guardrails and focus areas
 * @param context - Optional array of prior run context for duplicate avoidance
 * @returns Multi-section work prompt string
 */
export function buildWorkPrompt(config: JobConfig, context?: RunContext[]): string {
	const sections: string[] = [];

	// Section 1 - Work Priority (EXEC-03, EXEC-04, EXEC-05)
	sections.push(`## Work Priority

Follow this priority chain strictly:

1. **Open GitHub Issues/Feature Requests**: Check for open issues with \`gh issue list --state open --json number,title,labels,body\`.
   Evaluate each issue for complexity and solvability. Skip spam, unclear, or overly complex issues.
   Pick the best candidate you can resolve autonomously in a single session.

2. **Bug Discovery**: If no suitable issues exist, proactively scan for pre-existing bugs:
   - Run the test suite and fix any failing tests
   - Run the linter and fix violations
   - Run type checking and fix errors
   - Look for common code smells, error handling gaps, and edge cases

3. **Feature Improvements**: Only if no issues or bugs found, propose and implement
   improvements (better documentation, test coverage, code quality, performance).

Always start by researching the codebase before making any changes.`);

	// Section 2 - Focus areas (if config.focus.length > 0)
	if (config.focus.length > 0) {
		sections.push(`## Focus Areas
Concentrate your work on: ${config.focus.join(", ")}.`);
	}

	// Section 3 - Guardrails (conditional)
	const guardrailLines: string[] = [];

	if (config.guardrails.noNewDependencies) {
		guardrailLines.push("- Do NOT add any new dependencies to package.json or equivalent");
	}
	if (config.guardrails.noArchitectureChanges) {
		guardrailLines.push("- Do NOT make architectural changes (new modules, directory restructuring)");
	}
	if (config.guardrails.bugFixOnly) {
		guardrailLines.push("- Only fix bugs. Do NOT add features or make improvements.");
	}
	if (config.guardrails.restrictToPaths && config.guardrails.restrictToPaths.length > 0) {
		guardrailLines.push(`- Only modify files in these paths: ${config.guardrails.restrictToPaths.join(", ")}`);
	}

	if (guardrailLines.length > 0) {
		sections.push(`## Guardrails
${guardrailLines.join("\n")}`);
	}

	// Section 4 - Git Safety (always included)
	sections.push(`## Git Safety Rules (NEVER VIOLATE)
- NEVER force push (no --force, -f, or --force-with-lease flags)
- NEVER commit directly to the base branch -- you are on a work branch
- NEVER run git push (the orchestrator handles pushing)
- Commit your changes with clear, descriptive commit messages
- If you modify code, update relevant documentation in the same commit`);

	// Section 5 - Documentation (EXEC-06)
	sections.push(`## Documentation
When making changes, always update relevant documentation:
- Update JSDoc/TSDoc comments on modified functions
- Update README or docs if behavior changes
- Add inline comments for non-obvious logic`);

	// Section 6 - Completion
	sections.push(`## Completion
When your work is complete:
- Commit all changes with descriptive messages
- Do NOT create a PR yourself -- the orchestrator handles this
- Write a clear summary of what you did, why, and what you changed as your final message`);

	// Section 7 - Previous Work context (CTXT-02, CTXT-03)
	if (context && context.length > 0) {
		const contextSection = formatContextWindow(context);
		if (contextSection) {
			sections.push(contextSection);
		}
	}

	return sections.join("\n\n");
}
