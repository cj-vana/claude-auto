import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
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

vi.mock("../../src/core/schedule.js", () => ({
	describeSchedule: vi.fn(),
	getNextRuns: vi.fn(),
}));

import { listJobs } from "../../src/core/job-manager.js";
import { listRunLogs } from "../../src/runner/logger.js";
import { describeSchedule, getNextRuns } from "../../src/core/schedule.js";
import { listCommand } from "../../src/cli/commands/list.js";

const mockedListJobs = vi.mocked(listJobs);
const mockedListRunLogs = vi.mocked(listRunLogs);
const mockedDescribeSchedule = vi.mocked(describeSchedule);
const mockedGetNextRuns = vi.mocked(getNextRuns);

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
		runId: "run-2026-03-21T12-00-00Z",
		startedAt: "2026-03-21T12:00:00Z",
		completedAt: "2026-03-21T12:05:00Z",
		durationMs: 300000,
		prUrl: "https://github.com/test/repo/pull/42",
		summary: "Fixed a bug",
		costUsd: 1.5,
		...overrides,
	};
}

describe("listCommand", () => {
	let logSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.clearAllMocks();
		logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		logSpy.mockRestore();
	});

	it("prints 'No jobs configured' when no jobs exist", async () => {
		mockedListJobs.mockResolvedValue([]);

		await listCommand({});

		expect(logSpy).toHaveBeenCalledWith("No jobs configured.");
	});

	it("prints table with correct columns for a single active job", async () => {
		const job = makeJob();
		mockedListJobs.mockResolvedValue([job]);
		mockedDescribeSchedule.mockReturnValue("Every 6 hours");
		mockedGetNextRuns.mockReturnValue([new Date(Date.now() + 3600000)]);
		mockedListRunLogs.mockResolvedValue([makeRunLog()]);

		await listCommand({});

		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("job-abc");
		expect(output).toContain("Test Job");
		expect(output).toContain("active");
		expect(output).toContain("Every 6 hours");
		// Should contain ID, Name, Status, Repo, Schedule, Last Run, Next Run headers
		expect(output).toContain("ID");
		expect(output).toContain("Name");
		expect(output).toContain("Status");
	});

	it("shows 'paused' status for disabled jobs", async () => {
		const job = makeJob({ enabled: false });
		mockedListJobs.mockResolvedValue([job]);
		mockedDescribeSchedule.mockReturnValue("Every 6 hours");
		mockedListRunLogs.mockResolvedValue([]);

		await listCommand({});

		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("paused");
	});

	it("shows 'never' for last run when no run logs exist", async () => {
		const job = makeJob();
		mockedListJobs.mockResolvedValue([job]);
		mockedDescribeSchedule.mockReturnValue("Every 6 hours");
		mockedGetNextRuns.mockReturnValue([new Date(Date.now() + 3600000)]);
		mockedListRunLogs.mockResolvedValue([]);

		await listCommand({});

		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("never");
	});

	it("shows '--' for next run when job is paused", async () => {
		const job = makeJob({ enabled: false });
		mockedListJobs.mockResolvedValue([job]);
		mockedDescribeSchedule.mockReturnValue("Every 6 hours");
		mockedListRunLogs.mockResolvedValue([]);

		await listCommand({});

		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("--");
	});

	it("outputs valid JSON array when --json flag is passed", async () => {
		const job1 = makeJob({ id: "job-1", name: "Job One" });
		const job2 = makeJob({ id: "job-2", name: "Job Two" });
		mockedListJobs.mockResolvedValue([job1, job2]);
		mockedDescribeSchedule.mockReturnValue("Every 6 hours");
		mockedGetNextRuns.mockReturnValue([new Date(Date.now() + 3600000)]);
		mockedListRunLogs.mockResolvedValue([]);

		await listCommand({ json: true });

		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		const parsed = JSON.parse(output);
		expect(Array.isArray(parsed)).toBe(true);
		expect(parsed).toHaveLength(2);
	});

	it("outputs JSON objects with expected fields", async () => {
		const job = makeJob();
		mockedListJobs.mockResolvedValue([job]);
		mockedDescribeSchedule.mockReturnValue("Every 6 hours");
		mockedGetNextRuns.mockReturnValue([new Date(Date.now() + 3600000)]);
		mockedListRunLogs.mockResolvedValue([makeRunLog()]);

		await listCommand({ json: true });

		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		const parsed = JSON.parse(output);
		expect(parsed[0]).toHaveProperty("id");
		expect(parsed[0]).toHaveProperty("name");
		expect(parsed[0]).toHaveProperty("status");
		expect(parsed[0]).toHaveProperty("repo");
		expect(parsed[0]).toHaveProperty("schedule");
		expect(parsed[0]).toHaveProperty("lastRun");
		expect(parsed[0]).toHaveProperty("nextRun");
	});

	it("outputs '[]' when --json flag is passed with no jobs", async () => {
		mockedListJobs.mockResolvedValue([]);

		await listCommand({ json: true });

		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toBe("[]");
	});

	it("displays multiple jobs with different repos as separate rows", async () => {
		const job1 = makeJob({ id: "job-1", name: "Job One", repo: { path: "/repos/alpha", branch: "main", remote: "origin" } });
		const job2 = makeJob({ id: "job-2", name: "Job Two", repo: { path: "/repos/beta", branch: "main", remote: "origin" } });
		mockedListJobs.mockResolvedValue([job1, job2]);
		mockedDescribeSchedule.mockReturnValue("Every 6 hours");
		mockedGetNextRuns.mockReturnValue([new Date(Date.now() + 3600000)]);
		mockedListRunLogs.mockResolvedValue([]);

		await listCommand({});

		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("job-1");
		expect(output).toContain("job-2");
		expect(output).toContain("repos/alpha");
		expect(output).toContain("repos/beta");
	});
});
