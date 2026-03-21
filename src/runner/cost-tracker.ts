import { getDatabase } from "../core/database.js";

/**
 * Budget configuration with optional caps per time period.
 * When a cap is set, cumulative cost within that period is checked
 * before spawning a new run.
 */
export interface BudgetConfig {
	dailyUsd?: number;
	weeklyUsd?: number;
	monthlyUsd?: number;
}

/**
 * Per-job cost summary row returned by getCostSummary() when no jobId is specified.
 */
export interface CostSummaryRow {
	job_id: string;
	runs: number;
	total_cost: number;
	avg_cost: number;
	total_turns: number;
}

/**
 * Per-day cost breakdown row returned by getCostSummary(jobId).
 */
export interface DailyCostRow {
	day: string;
	runs: number;
	total_cost: number;
	total_turns: number;
}

/**
 * Period definitions mapping budget config keys to SQLite datetime offsets.
 */
const PERIOD_OFFSETS: Array<{ key: keyof BudgetConfig; offset: string }> = [
	{ key: "dailyUsd", offset: "-1 day" },
	{ key: "weeklyUsd", offset: "-7 days" },
	{ key: "monthlyUsd", offset: "-30 days" },
];

/**
 * Check whether cumulative cost for a job exceeds any configured budget cap.
 *
 * Queries the runs table for cost accrued within each budget period (daily, weekly, monthly),
 * excluding non-spending statuses (locked, paused, budget-exceeded).
 *
 * @param jobId - The job identifier to check
 * @param budget - Budget configuration with optional period caps
 * @param dbPath - Optional database path override for testing
 * @returns true if any budget cap is met or exceeded, false otherwise
 */
export function checkBudget(jobId: string, budget: BudgetConfig, dbPath?: string): boolean {
	const db = getDatabase(dbPath);

	for (const { key, offset } of PERIOD_OFFSETS) {
		const cap = budget[key];
		if (cap === undefined) continue;

		const row = db
			.prepare(
				`SELECT COALESCE(SUM(cost_usd), 0) as total FROM runs
				WHERE job_id = ? AND started_at >= datetime('now', ?)
				AND status NOT IN ('locked', 'paused', 'budget-exceeded')`,
			)
			.get(jobId, offset) as { total: number };

		if (row.total >= cap) {
			return true;
		}
	}

	return false;
}

/**
 * Get cost summary data from the runs table.
 *
 * When jobId is provided, returns per-day cost breakdown for that job (last 30 days).
 * When no jobId is provided, returns per-job aggregate cost totals across all jobs.
 *
 * @param jobId - Optional job identifier for per-day breakdown
 * @param dbPath - Optional database path override for testing
 * @returns Array of CostSummaryRow (no jobId) or DailyCostRow (with jobId)
 */
export function getCostSummary(jobId?: string, dbPath?: string): CostSummaryRow[] | DailyCostRow[] {
	const db = getDatabase(dbPath);

	if (jobId) {
		return db
			.prepare(
				`SELECT date(started_at) as day, COUNT(*) as runs,
					ROUND(COALESCE(SUM(cost_usd), 0), 4) as total_cost,
					COALESCE(SUM(num_turns), 0) as total_turns
				FROM runs WHERE job_id = ? AND cost_usd IS NOT NULL
				GROUP BY date(started_at) ORDER BY day DESC LIMIT 30`,
			)
			.all(jobId) as DailyCostRow[];
	}

	return db
		.prepare(
			`SELECT job_id, COUNT(*) as runs,
				ROUND(COALESCE(SUM(cost_usd), 0), 4) as total_cost,
				ROUND(COALESCE(AVG(cost_usd), 0), 4) as avg_cost,
				COALESCE(SUM(num_turns), 0) as total_turns
			FROM runs WHERE cost_usd IS NOT NULL
			GROUP BY job_id ORDER BY total_cost DESC`,
		)
		.all() as CostSummaryRow[];
}
