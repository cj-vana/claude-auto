import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDatabase, getDatabase } from "../../src/core/database.js";
import { checkBudget, getCostSummary } from "../../src/runner/cost-tracker.js";
import type { BudgetConfig, CostSummaryRow, DailyCostRow } from "../../src/runner/cost-tracker.js";

/**
 * Insert a test run row directly into the in-memory database.
 */
function insertRun(opts: {
	jobId: string;
	costUsd: number | null;
	startedAt?: string;
	status?: string;
	numTurns?: number;
}): void {
	const db = getDatabase();
	const id = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	db.prepare(
		`INSERT INTO runs (id, job_id, status, started_at, completed_at, duration_ms, cost_usd, num_turns)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		id,
		opts.jobId,
		opts.status ?? "success",
		opts.startedAt ?? new Date().toISOString(),
		new Date().toISOString(),
		60000,
		opts.costUsd,
		opts.numTurns ?? 10,
	);
}

describe("cost-tracker", () => {
	beforeEach(() => {
		getDatabase(":memory:");
	});

	afterEach(() => {
		closeDatabase();
	});

	describe("checkBudget", () => {
		it("checkBudget returns false when no runs exist (no cost accrued)", () => {
			const budget: BudgetConfig = { dailyUsd: 5 };
			expect(checkBudget("test-job", budget)).toBe(false);
		});

		it("checkBudget returns false when daily cost is under dailyUsd cap", () => {
			insertRun({ jobId: "test-job", costUsd: 2.0 });
			const budget: BudgetConfig = { dailyUsd: 5 };
			expect(checkBudget("test-job", budget)).toBe(false);
		});

		it("checkBudget returns true when daily cost meets or exceeds dailyUsd cap", () => {
			insertRun({ jobId: "test-job", costUsd: 3.0 });
			insertRun({ jobId: "test-job", costUsd: 2.5 });
			const budget: BudgetConfig = { dailyUsd: 5 };
			expect(checkBudget("test-job", budget)).toBe(true);
		});

		it("checkBudget returns false when weekly cost is under weeklyUsd cap", () => {
			insertRun({ jobId: "test-job", costUsd: 10.0 });
			const budget: BudgetConfig = { weeklyUsd: 20 };
			expect(checkBudget("test-job", budget)).toBe(false);
		});

		it("checkBudget returns true when weekly cost exceeds weeklyUsd cap", () => {
			insertRun({ jobId: "test-job", costUsd: 12.0 });
			insertRun({ jobId: "test-job", costUsd: 10.0 });
			const budget: BudgetConfig = { weeklyUsd: 20 };
			expect(checkBudget("test-job", budget)).toBe(true);
		});

		it("checkBudget returns false when monthly cost is under monthlyUsd cap", () => {
			insertRun({ jobId: "test-job", costUsd: 30.0 });
			const budget: BudgetConfig = { monthlyUsd: 50 };
			expect(checkBudget("test-job", budget)).toBe(false);
		});

		it("checkBudget returns true when monthly cost exceeds monthlyUsd cap", () => {
			insertRun({ jobId: "test-job", costUsd: 30.0 });
			insertRun({ jobId: "test-job", costUsd: 25.0 });
			const budget: BudgetConfig = { monthlyUsd: 50 };
			expect(checkBudget("test-job", budget)).toBe(true);
		});

		it("checkBudget checks all periods -- if daily is fine but monthly exceeded, returns true", () => {
			// Insert many small runs that are under daily but collectively exceed monthly
			for (let i = 0; i < 20; i++) {
				insertRun({ jobId: "test-job", costUsd: 3.0 });
			}
			const budget: BudgetConfig = { dailyUsd: 100, monthlyUsd: 50 };
			expect(checkBudget("test-job", budget)).toBe(true);
		});

		it("checkBudget ignores runs with status locked, paused, budget-exceeded (non-spending statuses)", () => {
			insertRun({ jobId: "test-job", costUsd: 3.0, status: "locked" });
			insertRun({ jobId: "test-job", costUsd: 3.0, status: "paused" });
			insertRun({ jobId: "test-job", costUsd: 3.0, status: "budget-exceeded" });
			const budget: BudgetConfig = { dailyUsd: 5 };
			expect(checkBudget("test-job", budget)).toBe(false);
		});

		it("checkBudget returns false when budget config is empty (no caps set)", () => {
			insertRun({ jobId: "test-job", costUsd: 100 });
			const budget: BudgetConfig = {};
			expect(checkBudget("test-job", budget)).toBe(false);
		});
	});

	describe("getCostSummary", () => {
		it("getCostSummary returns per-job totals across all jobs", () => {
			insertRun({ jobId: "job-a", costUsd: 2.0 });
			insertRun({ jobId: "job-a", costUsd: 3.0 });
			insertRun({ jobId: "job-b", costUsd: 1.5 });

			const rows = getCostSummary() as CostSummaryRow[];
			expect(rows.length).toBe(2);

			const jobA = rows.find((r) => r.job_id === "job-a");
			expect(jobA).toBeDefined();
			expect(jobA!.runs).toBe(2);
			expect(jobA!.total_cost).toBeCloseTo(5.0, 2);

			const jobB = rows.find((r) => r.job_id === "job-b");
			expect(jobB).toBeDefined();
			expect(jobB!.runs).toBe(1);
			expect(jobB!.total_cost).toBeCloseTo(1.5, 2);
		});

		it("getCostSummary returns per-day breakdown when jobId is specified", () => {
			const today = new Date().toISOString().split("T")[0];
			insertRun({ jobId: "job-a", costUsd: 2.0 });
			insertRun({ jobId: "job-a", costUsd: 3.0 });

			const rows = getCostSummary("job-a") as DailyCostRow[];
			expect(rows.length).toBeGreaterThanOrEqual(1);

			const todayRow = rows.find((r) => r.day === today);
			expect(todayRow).toBeDefined();
			expect(todayRow!.runs).toBe(2);
			expect(todayRow!.total_cost).toBeCloseTo(5.0, 2);
		});

		it("getCostSummary returns empty results when no runs exist", () => {
			const rows = getCostSummary();
			expect(rows).toEqual([]);
		});
	});
});
