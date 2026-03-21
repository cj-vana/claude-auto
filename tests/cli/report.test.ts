import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobConfig } from "../../src/core/types.js";
import type { RunLogEntry } from "../../src/runner/types.js";

// Mock dependencies
vi.mock("../../src/core/job-manager.js", () => ({
	listJobs: vi.fn(),
	readJob: vi.fn(),
}));

vi.mock("../../src/runner/logger.js", () => ({
	listRunLogs: vi.fn(),
}));

import { reportCommand } from "../../src/cli/commands/report.js";
import { listJobs, readJob } from "../../src/core/job-manager.js";
import { listRunLogs } from "../../src/runner/logger.js";

const mockedListJobs = vi.mocked(listJobs);
const mockedReadJob = vi.mocked(readJob);
const mockedListRunLogs = vi.mocked(listRunLogs);

function makeJob(overrides: Partial<JobConfig> = {}): JobConfig {
	return {
		id: "job-abc",
		name: "Test Job",
		repo: { path: "/home/user/repos/my-project", branch: "main", remote: "origin" },
		schedule: { cron: "0 */6 * * *", timezone: "UTC" },
		focus: ["open-issues", "bug-discovery"],
		guardrails: {
			maxTurns: 50,
			maxBudgetUsd: 5.0,
			noNewDependencies: false,
			noArchitectureChanges: false,
			bugFixOnly: false,
		},
		notifications: {},
		enabled: true,
		...overrides,
	};
}

function makeRunLog(overrides: Partial<RunLogEntry> = {}): RunLogEntry {
	return {
		status: "success",
		jobId: "job-abc",
		runId: "run-001",
		startedAt: "2026-03-21T12:00:00Z",
		completedAt: "2026-03-21T12:05:00Z",
		durationMs: 300000,
		prUrl: "https://github.com/test/repo/pull/42",
		summary: "Fixed a bug",
		costUsd: 1.5,
		...overrides,
	};
}

describe("reportCommand", () => {
	let logSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.clearAllMocks();
		logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		logSpy.mockRestore();
	});

	it("reports for a single job with aggregate metrics", async () => {
		const job = makeJob();
		mockedReadJob.mockResolvedValue(job);
		mockedListRunLogs.mockResolvedValue([
			makeRunLog({
				status: "success",
				costUsd: 1.5,
				durationMs: 300000,
				prUrl: "https://github.com/test/repo/pull/42",
			}),
			makeRunLog({
				status: "success",
				costUsd: 2.0,
				durationMs: 600000,
				prUrl: "https://github.com/test/repo/pull/43",
				runId: "run-002",
			}),
			makeRunLog({
				status: "error",
				costUsd: 0.5,
				durationMs: 60000,
				error: "Failed",
				runId: "run-003",
				prUrl: undefined,
			}),
			makeRunLog({
				status: "no-changes",
				costUsd: 0.3,
				durationMs: 120000,
				runId: "run-004",
				prUrl: undefined,
			}),
		]);

		await reportCommand({ jobId: "job-abc" });

		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("Test Job");
		expect(output).toContain("job-abc");
		expect(output).toContain("4"); // total runs
		// Success count = 2
		expect(output).toMatch(/Success.*2/);
		// Error count = 1
		expect(output).toMatch(/Error.*1/);
		// No changes count = 1
		expect(output).toMatch(/No changes.*1/);
		// PRs created: 2
		expect(output).toContain("2"); // PRs
		// Total cost: $4.30
		expect(output).toContain("4.30");
	});

	it("aggregates across all jobs when no jobId provided", async () => {
		const job1 = makeJob({ id: "job-1", name: "Job One" });
		const job2 = makeJob({ id: "job-2", name: "Job Two" });
		mockedListJobs.mockResolvedValue([job1, job2]);
		mockedListRunLogs.mockImplementation(async (jobId: string) => {
			if (jobId === "job-1") {
				return [makeRunLog({ jobId: "job-1", status: "success", costUsd: 1.0 })];
			}
			return [makeRunLog({ jobId: "job-2", status: "error", costUsd: 0.5, prUrl: undefined })];
		});

		await reportCommand({});

		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		// Should show aggregated totals
		expect(output).toContain("All Jobs");
		expect(output).toContain("2"); // total runs
		expect(output).toContain("1.50"); // total cost (1.0 + 0.5)
	});

	it("shows 'none' for last PR when no PRs exist", async () => {
		const job = makeJob();
		mockedReadJob.mockResolvedValue(job);
		mockedListRunLogs.mockResolvedValue([makeRunLog({ status: "no-changes", prUrl: undefined })]);

		await reportCommand({ jobId: "job-abc" });

		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("none");
	});

	it("prints message when no runs found for a job", async () => {
		const job = makeJob();
		mockedReadJob.mockResolvedValue(job);
		mockedListRunLogs.mockResolvedValue([]);

		await reportCommand({ jobId: "job-abc" });

		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("No runs found");
	});
});
