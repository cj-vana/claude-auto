import { getDatabase } from "../core/database.js";
import type { RunLogEntry } from "./types.js";

/**
 * Structured context from a prior run, containing only verifiable facts
 * (issue numbers, PR URLs, branch names) -- never raw narrative summaries.
 */
export interface RunContext {
	id: string;
	status: string;
	pr_url: string | null;
	branch_name: string | null;
	issue_number: number | null;
	summary: string | null;
	started_at: string;
}

/**
 * Persist a run log entry to the SQLite database.
 * Maps RunLogEntry camelCase fields to snake_case columns.
 *
 * @param entry - The run log entry to save
 */
export function saveRunContext(entry: RunLogEntry): void {
	const db = getDatabase();
	db.prepare(
		`INSERT INTO runs (
			id, job_id, status, started_at, completed_at, duration_ms,
			cost_usd, num_turns, session_id, model, pr_url, branch_name,
			issue_number, summary, error, feedback_round, pr_number
		) VALUES (
			@id, @job_id, @status, @started_at, @completed_at, @duration_ms,
			@cost_usd, @num_turns, @session_id, @model, @pr_url, @branch_name,
			@issue_number, @summary, @error, @feedback_round, @pr_number
		)`,
	).run({
		id: entry.runId,
		job_id: entry.jobId,
		status: entry.status,
		started_at: entry.startedAt,
		completed_at: entry.completedAt,
		duration_ms: entry.durationMs,
		cost_usd: entry.costUsd ?? null,
		num_turns: entry.numTurns ?? null,
		session_id: entry.sessionId ?? null,
		model: entry.model ?? null,
		pr_url: entry.prUrl ?? null,
		branch_name: entry.branchName ?? null,
		issue_number: entry.issueNumber ?? null,
		summary: entry.summary ?? null,
		error: entry.error ?? null,
		feedback_round: entry.feedbackRound ?? null,
		pr_number: entry.prNumber ?? null,
	});
}

/**
 * Load recent run context for a job from SQLite.
 * Only returns runs with status "success" or "no-changes" (not errors, locked, etc.)
 * to avoid injecting failure context into Claude's prompt.
 *
 * @param jobId - The job identifier
 * @param limit - Maximum number of recent runs to return (default: 5)
 * @returns Array of RunContext sorted by started_at descending
 */
export function loadRunContext(jobId: string, limit = 5): RunContext[] {
	const db = getDatabase();
	return db
		.prepare(
			`SELECT id, status, pr_url, branch_name, issue_number, summary, started_at
			FROM runs
			WHERE job_id = ? AND status IN ('success', 'no-changes')
			ORDER BY started_at DESC
			LIMIT ?`,
		)
		.all(jobId, limit) as RunContext[];
}

/**
 * Format run context as a structured "Previous Work" prompt section.
 * Only includes verifiable facts (issue numbers, PR URLs, branch names)
 * to avoid hallucination amplification from raw narrative summaries.
 *
 * @param context - Array of RunContext from loadRunContext
 * @returns Formatted string for prompt injection, or empty string if no context
 */
export function formatContextWindow(context: RunContext[]): string {
	if (context.length === 0) return "";

	const lines = context.map((c) => {
		const parts = [`- Run ${c.id} (${c.started_at}): ${c.status}`];
		if (c.issue_number) parts.push(`  Issue: #${c.issue_number}`);
		if (c.pr_url) parts.push(`  PR: ${c.pr_url}`);
		if (c.branch_name) parts.push(`  Branch: ${c.branch_name}`);
		return parts.join("\n");
	});

	return `## Previous Work (DO NOT duplicate)\n\n${lines.join("\n\n")}`;
}
