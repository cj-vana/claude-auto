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

import { pauseCommand } from "../../src/cli/commands/pause.js";
import { readJob, updateJob } from "../../src/core/job-manager.js";
import { createScheduler } from "../../src/platform/scheduler.js";

const mockedReadJob = vi.mocked(readJob);
const mockedUpdateJob = vi.mocked(updateJob);
const mockedCreateScheduler = vi.mocked(createScheduler);

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
		enabled: true,
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

describe("pauseCommand", () => {
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

	it("pauses an active job: sets enabled=false and unregisters from scheduler", async () => {
		const job = makeJob({ enabled: true });
		mockedReadJob.mockResolvedValue(job);
		mockedUpdateJob.mockResolvedValue({ ...job, enabled: false });
		const scheduler = mockScheduler();

		await pauseCommand({ jobId: "abc123" });

		expect(mockedUpdateJob).toHaveBeenCalledWith("abc123", { enabled: false });
		expect(scheduler.unregister).toHaveBeenCalledWith("abc123");
		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("paused");
		expect(output).toContain("abc123");
	});

	it("is idempotent: already-paused job prints message without error", async () => {
		const job = makeJob({ enabled: false });
		mockedReadJob.mockResolvedValue(job);

		await pauseCommand({ jobId: "abc123" });

		expect(mockedUpdateJob).not.toHaveBeenCalled();
		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("already paused");
	});

	it("prints usage error when no jobId provided", async () => {
		await expect(pauseCommand({})).rejects.toThrow();

		const output = errorSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("Usage");
	});

	it("prints error when job not found", async () => {
		const err = new Error("ENOENT");
		(err as NodeJS.ErrnoException).code = "ENOENT";
		mockedReadJob.mockRejectedValue(err);

		await expect(pauseCommand({ jobId: "nonexistent" })).rejects.toThrow();

		const output = errorSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("not found");
	});

	it("handles scheduler unregister failure gracefully (best-effort)", async () => {
		const job = makeJob({ enabled: true });
		mockedReadJob.mockResolvedValue(job);
		mockedUpdateJob.mockResolvedValue({ ...job, enabled: false });
		const scheduler = mockScheduler();
		scheduler.unregister.mockRejectedValue(new Error("scheduler error"));

		// Should not throw despite scheduler failure
		await pauseCommand({ jobId: "abc123" });

		expect(mockedUpdateJob).toHaveBeenCalledWith("abc123", { enabled: false });
		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("paused");
	});
});
