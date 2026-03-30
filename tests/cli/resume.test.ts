import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobConfig } from "../../src/core/types.js";

// Mock dependencies
vi.mock("../../src/core/job-manager.js", () => ({
	readJob: vi.fn(),
	updateJob: vi.fn(),
}));

vi.mock("../../src/platform/scheduler.js", () => ({
	createScheduler: vi.fn(),
}));

vi.mock("../../src/core/schedule.js", () => ({
	getNextRuns: vi.fn(),
}));

import { resumeCommand } from "../../src/cli/commands/resume.js";
import { readJob, updateJob } from "../../src/core/job-manager.js";
import { getNextRuns } from "../../src/core/schedule.js";
import { createScheduler } from "../../src/platform/scheduler.js";

const mockedReadJob = vi.mocked(readJob);
const mockedUpdateJob = vi.mocked(updateJob);
const mockedCreateScheduler = vi.mocked(createScheduler);
const mockedGetNextRuns = vi.mocked(getNextRuns);

function makeJob(overrides: Partial<JobConfig> = {}): JobConfig {
	return {
		id: "abc123",
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
		enabled: false,
		...overrides,
	};
}

function mockScheduler() {
	const scheduler = {
		register: vi.fn().mockResolvedValue(undefined),
		unregister: vi.fn().mockResolvedValue(undefined),
		isRegistered: vi.fn().mockResolvedValue(false),
		list: vi.fn().mockResolvedValue([]),
	};
	mockedCreateScheduler.mockResolvedValue(scheduler);
	return scheduler;
}

describe("resumeCommand", () => {
	let logSpy: ReturnType<typeof vi.spyOn>;
	let errorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.clearAllMocks();
		logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		logSpy.mockRestore();
		errorSpy.mockRestore();
	});

	it("resumes a paused job: sets enabled=true and registers with scheduler", async () => {
		const job = makeJob({ enabled: false });
		const updatedJob = { ...job, enabled: true };
		mockedReadJob.mockResolvedValue(job);
		mockedUpdateJob.mockResolvedValue(updatedJob);
		const scheduler = mockScheduler();
		const nextRun = new Date(Date.now() + 3600000);
		mockedGetNextRuns.mockReturnValue([nextRun]);

		await resumeCommand({ jobId: "abc123" });

		expect(mockedUpdateJob).toHaveBeenCalledWith("abc123", { enabled: true });
		expect(scheduler.register).toHaveBeenCalledWith(updatedJob);
		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("resumed");
		expect(output).toContain("abc123");
	});

	it("is idempotent: already-active job prints message without error", async () => {
		const job = makeJob({ enabled: true });
		mockedReadJob.mockResolvedValue(job);

		await resumeCommand({ jobId: "abc123" });

		expect(mockedUpdateJob).not.toHaveBeenCalled();
		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("already active");
	});

	it("prints usage error when no jobId provided", async () => {
		await expect(resumeCommand({})).rejects.toThrow();

		const output = errorSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("Usage");
	});

	it("prints error when job not found", async () => {
		const err = new Error("ENOENT");
		(err as NodeJS.ErrnoException).code = "ENOENT";
		mockedReadJob.mockRejectedValue(err);

		await expect(resumeCommand({ jobId: "nonexistent" })).rejects.toThrow();

		const output = errorSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("not found");
	});

	it("uses updatedConfig (not stale config) for schedule display", async () => {
		const job = makeJob({
			enabled: false,
			schedule: { cron: "0 */6 * * *", timezone: "UTC" },
		});
		const updatedJob = {
			...job,
			enabled: true,
			schedule: { cron: "0 */12 * * *", timezone: "America/New_York" },
		};
		mockedReadJob.mockResolvedValue(job);
		mockedUpdateJob.mockResolvedValue(updatedJob);
		mockScheduler();
		const nextRun = new Date(Date.now() + 3600000);
		mockedGetNextRuns.mockReturnValue([nextRun]);

		await resumeCommand({ jobId: "abc123" });

		// getNextRuns must be called with updatedConfig's schedule, not the old one
		expect(mockedGetNextRuns).toHaveBeenCalledWith("0 */12 * * *", "America/New_York", 1);
	});

	it("unregisters first if already registered (defensive)", async () => {
		const job = makeJob({ enabled: false });
		const updatedJob = { ...job, enabled: true };
		mockedReadJob.mockResolvedValue(job);
		mockedUpdateJob.mockResolvedValue(updatedJob);
		const scheduler = mockScheduler();
		scheduler.isRegistered.mockResolvedValue(true);
		mockedGetNextRuns.mockReturnValue([new Date(Date.now() + 3600000)]);

		await resumeCommand({ jobId: "abc123" });

		expect(scheduler.unregister).toHaveBeenCalledWith("abc123");
		expect(scheduler.register).toHaveBeenCalledWith(updatedJob);
	});
});
