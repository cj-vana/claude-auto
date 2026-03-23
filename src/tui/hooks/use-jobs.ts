import { useEffect, useState } from "react";
import { listJobs } from "../../core/job-manager.js";
import { getNextRuns } from "../../core/schedule.js";
import { type CostSummaryRow, getCostSummary } from "../../runner/cost-tracker.js";
import { listRunLogs } from "../../runner/logger.js";
import type { RunLogEntry } from "../../runner/types.js";

/**
 * Extended job data combining config with runtime metadata.
 */
export interface JobWithMeta {
	id: string;
	name: string;
	repoPath: string;
	branch: string;
	cron: string;
	timezone: string;
	focus: string[];
	enabled: boolean;
	model?: string;
	maxBudgetUsd: number;
	lastRun: RunLogEntry | null;
	nextRun: Date | null;
	totalCost: number;
}

/**
 * Load all jobs with combined metadata (cost, last run, next run).
 * Exported separately for direct testing without React hooks.
 */
export async function loadJobsWithMeta(): Promise<JobWithMeta[]> {
	const jobs = await listJobs();

	// Load cost data (best-effort -- DB may not exist)
	const costMap: Map<string, number> = new Map();
	try {
		const costRows = getCostSummary() as CostSummaryRow[];
		for (const row of costRows) {
			costMap.set(row.job_id, row.total_cost);
		}
	} catch {
		// Cost data unavailable -- default to 0
	}

	const results: JobWithMeta[] = [];

	for (const job of jobs) {
		// Get last run (best-effort)
		let lastRun: RunLogEntry | null = null;
		try {
			const logs = await listRunLogs(job.id);
			if (logs.length > 0) {
				lastRun = logs[0]; // Already sorted newest first
			}
		} catch {
			// No logs available
		}

		// Get next run time (best-effort)
		let nextRun: Date | null = null;
		try {
			if (job.enabled) {
				const runs = getNextRuns(job.schedule.cron, job.schedule.timezone, 1);
				if (runs.length > 0) {
					nextRun = runs[0];
				}
			}
		} catch {
			// Invalid cron or timezone
		}

		results.push({
			id: job.id,
			name: job.name,
			repoPath: job.repo.path,
			branch: job.repo.branch,
			cron: job.schedule.cron,
			timezone: job.schedule.timezone,
			focus: job.focus,
			enabled: job.enabled,
			model: job.model,
			maxBudgetUsd: job.guardrails.maxBudgetUsd,
			lastRun,
			nextRun,
			totalCost: costMap.get(job.id) ?? 0,
		});
	}

	return results;
}

/**
 * React hook that polls job data at a configurable interval.
 *
 * @param pollIntervalMs - Polling interval in milliseconds (default 3000)
 * @returns Jobs with metadata, loading state, and any error message
 */
export function useJobs(pollIntervalMs = 3000): {
	jobs: JobWithMeta[];
	loading: boolean;
	error: string | null;
	refresh: () => void;
} {
	const [jobs, setJobs] = useState<JobWithMeta[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [_refreshTick, setRefreshTick] = useState(0);

	const refresh = () => setRefreshTick((t) => t + 1);

	useEffect(() => {
		let cancelled = false;

		const load = async () => {
			try {
				const data = await loadJobsWithMeta();
				if (!cancelled) {
					setJobs(data);
					setLoading(false);
					setError(null);
				}
			} catch (err: unknown) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : String(err));
					setLoading(false);
				}
			}
		};

		load();
		const timer = setInterval(load, pollIntervalMs);

		return () => {
			cancelled = true;
			clearInterval(timer);
		};
	}, [pollIntervalMs]);

	return { jobs, loading, error, refresh };
}
