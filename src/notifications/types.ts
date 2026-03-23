import type { JobConfig } from "../core/types.js";
import type { RunResult, RunStatus } from "../runner/types.js";

export type NotificationEvent = "success" | "no-changes" | "error" | "locked" | "git-error" | "budget-exceeded" | "merge-conflict" | "needs-human-review";

export interface NotificationPayload {
	event: NotificationEvent;
	jobId: string;
	jobName: string;
	runId: string;
	repoPath: string;
	branch: string;
	startedAt: string;
	completedAt: string;
	durationMs: number;
	prUrl?: string;
	summary?: string;
	costUsd?: number;
	numTurns?: number;
	error?: string;
	branchName?: string;
}

export interface EventTriggers {
	onSuccess?: boolean;
	onFailure?: boolean;
	onNoChanges?: boolean;
	onLocked?: boolean;
}

/**
 * Determines whether a notification should be sent for a given run status
 * and provider trigger configuration.
 *
 * Defaults:
 * - onSuccess: true (backward compat -- always notify on PR created)
 * - onFailure: true (always notify on errors)
 * - onNoChanges: false (avoid noise)
 * - onLocked: false (avoid noise)
 */
export function shouldNotify(status: RunStatus, triggers: EventTriggers): boolean {
	switch (status) {
		case "success":
			return triggers.onSuccess !== false;
		case "error":
		case "git-error":
		case "merge-conflict":
		case "needs-human-review":
			return triggers.onFailure !== false;
		case "budget-exceeded":
			return triggers.onFailure !== false;
		case "no-changes":
			return triggers.onNoChanges === true;
		case "locked":
		case "paused":
			return triggers.onLocked === true;
		default:
			return false;
	}
}

/**
 * Build a NotificationPayload from job config and run result.
 * Maps RunResult + JobConfig into the shape formatters consume.
 */
export function buildPayload(config: JobConfig, result: RunResult): NotificationPayload {
	return {
		event: result.status as NotificationEvent,
		jobId: config.id,
		jobName: config.name,
		runId: result.runId,
		repoPath: config.repo.path,
		branch: config.repo.branch,
		startedAt: result.startedAt,
		completedAt: result.completedAt,
		durationMs: result.durationMs,
		prUrl: result.prUrl,
		summary: result.summary,
		costUsd: result.costUsd,
		numTurns: result.numTurns,
		error: result.error,
		branchName: result.branchName,
	};
}
