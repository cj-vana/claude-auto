import { describe, it, expect, vi, beforeEach } from "vitest";
import type { JobConfig } from "../../src/core/types.js";
import type { RunLogEntry } from "../../src/runner/types.js";
import type { CostSummaryRow } from "../../src/runner/cost-tracker.js";

// Mock all dependencies before importing the module under test
vi.mock("../../src/core/job-manager.js", () => ({
	listJobs: vi.fn(),
}));

vi.mock("../../src/runner/cost-tracker.js", () => ({
	getCostSummary: vi.fn(),
}));

vi.mock("../../src/runner/logger.js", () => ({
	listRunLogs: vi.fn(),
}));

vi.mock("../../src/core/schedule.js", () => ({
	getNextRuns: vi.fn(),
}));

// Import after mocks are set up
import { loadJobsWithMeta } from "../../src/tui/hooks/use-jobs.js";
import { listJobs } from "../../src/core/job-manager.js";
import { getCostSummary } from "../../src/runner/cost-tracker.js";
import { listRunLogs } from "../../src/runner/logger.js";
import { getNextRuns } from "../../src/core/schedule.js";

const mockListJobs = vi.mocked(listJobs);
const mockGetCostSummary = vi.mocked(getCostSummary);
const mockListRunLogs = vi.mocked(listRunLogs);
const mockGetNextRuns = vi.mocked(getNextRuns);

function makeJobConfig(overrides: Partial<JobConfig> = {}): JobConfig {
	return {
		id: "test-job-1",
		name: "Test Job",
		repo: { path: "/tmp/repo", branch: "main", remote: "origin" },
		schedule: { cron: "0 9 * * *", timezone: "UTC" },
		focus: ["open-issues"],
		enabled: true,
		guardrails: {
			maxTurns: 50,
			maxBudgetUsd: 5.0,
			noNewDependencies: false,
			noArchitectureChanges: false,
			bugFixOnly: false,
		},
		notifications: {},
		maxFeedbackRounds: 3,
		...overrides,
	};
}

function makeRunLogEntry(overrides: Partial<RunLogEntry> = {}): RunLogEntry {
	return {
		status: "success",
		jobId: "test-job-1",
		runId: "run-1",
		startedAt: "2026-03-22T09:00:00Z",
		completedAt: "2026-03-22T09:05:00Z",
		durationMs: 300000,
		costUsd: 0.25,
		numTurns: 10,
		summary: "Fixed 2 issues",
		...overrides,
	};
}

describe("loadJobsWithMeta", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("combines job config with cost, last run, and next run", async () => {
		const job = makeJobConfig();
		const runLog = makeRunLogEntry();
		const nextRunDate = new Date("2026-03-23T09:00:00Z");
		const costRow: CostSummaryRow = {
			job_id: "test-job-1",
			runs: 5,
			total_cost: 1.25,
			avg_cost: 0.25,
			total_turns: 50,
		};

		mockListJobs.mockResolvedValue([job]);
		mockGetCostSummary.mockReturnValue([costRow]);
		mockListRunLogs.mockResolvedValue([runLog]);
		mockGetNextRuns.mockReturnValue([nextRunDate]);

		const result = await loadJobsWithMeta();

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			id: "test-job-1",
			name: "Test Job",
			repoPath: "/tmp/repo",
			branch: "main",
			cron: "0 9 * * *",
			timezone: "UTC",
			focus: ["open-issues"],
			enabled: true,
			model: undefined,
			maxBudgetUsd: 5.0,
			lastRun: runLog,
			nextRun: nextRunDate,
			totalCost: 1.25,
		});
	});

	it("returns empty array when no jobs exist", async () => {
		mockListJobs.mockResolvedValue([]);
		mockGetCostSummary.mockReturnValue([]);

		const result = await loadJobsWithMeta();

		expect(result).toEqual([]);
	});

	it("handles getCostSummary throwing (DB not available)", async () => {
		const job = makeJobConfig();
		mockListJobs.mockResolvedValue([job]);
		mockGetCostSummary.mockImplementation(() => {
			throw new Error("Database not found");
		});
		mockListRunLogs.mockResolvedValue([]);
		mockGetNextRuns.mockReturnValue([new Date("2026-03-23T09:00:00Z")]);

		const result = await loadJobsWithMeta();

		expect(result).toHaveLength(1);
		expect(result[0].totalCost).toBe(0);
	});

	it("handles listRunLogs throwing gracefully", async () => {
		const job = makeJobConfig();
		mockListJobs.mockResolvedValue([job]);
		mockGetCostSummary.mockReturnValue([]);
		mockListRunLogs.mockRejectedValue(new Error("ENOENT"));
		mockGetNextRuns.mockReturnValue([new Date("2026-03-23T09:00:00Z")]);

		const result = await loadJobsWithMeta();

		expect(result).toHaveLength(1);
		expect(result[0].lastRun).toBeNull();
	});

	it("sets nextRun to null for paused jobs", async () => {
		const job = makeJobConfig({ enabled: false });
		mockListJobs.mockResolvedValue([job]);
		mockGetCostSummary.mockReturnValue([]);
		mockListRunLogs.mockResolvedValue([]);

		const result = await loadJobsWithMeta();

		expect(result[0].nextRun).toBeNull();
		expect(result[0].enabled).toBe(false);
		// getNextRuns should not be called for disabled jobs
		expect(mockGetNextRuns).not.toHaveBeenCalled();
	});

	it("propagates listJobs errors", async () => {
		mockListJobs.mockRejectedValue(new Error("Permission denied"));

		await expect(loadJobsWithMeta()).rejects.toThrow("Permission denied");
	});

	it("handles multiple jobs with mixed data", async () => {
		const job1 = makeJobConfig({ id: "job-1", name: "Job One" });
		const job2 = makeJobConfig({ id: "job-2", name: "Job Two", enabled: false });
		const costRow: CostSummaryRow = {
			job_id: "job-1",
			runs: 3,
			total_cost: 0.75,
			avg_cost: 0.25,
			total_turns: 30,
		};

		mockListJobs.mockResolvedValue([job1, job2]);
		mockGetCostSummary.mockReturnValue([costRow]);
		mockListRunLogs.mockResolvedValue([]);
		mockGetNextRuns.mockReturnValue([new Date("2026-03-23T09:00:00Z")]);

		const result = await loadJobsWithMeta();

		expect(result).toHaveLength(2);
		expect(result[0].totalCost).toBe(0.75);
		expect(result[1].totalCost).toBe(0); // No cost data for job-2
	});

	it("handles getNextRuns throwing for invalid cron", async () => {
		const job = makeJobConfig();
		mockListJobs.mockResolvedValue([job]);
		mockGetCostSummary.mockReturnValue([]);
		mockListRunLogs.mockResolvedValue([]);
		mockGetNextRuns.mockImplementation(() => {
			throw new Error("Invalid cron expression");
		});

		const result = await loadJobsWithMeta();

		expect(result).toHaveLength(1);
		expect(result[0].nextRun).toBeNull();
	});
});
