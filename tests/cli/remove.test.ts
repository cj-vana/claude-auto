import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobConfig } from "../../src/core/types.js";

// Mock dependencies
vi.mock("../../src/core/job-manager.js", () => ({
	readJob: vi.fn(),
	deleteJob: vi.fn(),
}));

vi.mock("../../src/platform/scheduler.js", () => ({
	createScheduler: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
	mkdir: vi.fn().mockResolvedValue(undefined),
	cp: vi.fn().mockResolvedValue(undefined),
}));

import { removeCommand } from "../../src/cli/commands/remove.js";
import { deleteJob, readJob } from "../../src/core/job-manager.js";
import { createScheduler } from "../../src/platform/scheduler.js";

const mockedReadJob = vi.mocked(readJob);
const mockedDeleteJob = vi.mocked(deleteJob);
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

describe("removeCommand", () => {
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

	it("removes an existing job: unregisters from scheduler and deletes", async () => {
		const job = makeJob();
		mockedReadJob.mockResolvedValue(job);
		mockedDeleteJob.mockResolvedValue(undefined);
		const scheduler = mockScheduler();

		await removeCommand({ jobId: "abc123" });

		expect(scheduler.unregister).toHaveBeenCalledWith("abc123");
		expect(mockedDeleteJob).toHaveBeenCalledWith("abc123");
		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("removed");
		expect(output).toContain("abc123");
	});

	it("removes with --keep-logs: archives logs before deleting", async () => {
		const job = makeJob();
		mockedReadJob.mockResolvedValue(job);
		mockedDeleteJob.mockResolvedValue(undefined);
		const scheduler = mockScheduler();

		await removeCommand({ jobId: "abc123", keepLogs: true });

		expect(scheduler.unregister).toHaveBeenCalledWith("abc123");
		expect(mockedDeleteJob).toHaveBeenCalledWith("abc123");
		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("removed");
		expect(output).toContain("archived");
	});

	it("prints usage error when no jobId provided", async () => {
		await expect(removeCommand({})).rejects.toThrow();

		const output = errorSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("Usage");
	});

	it("prints error when job not found", async () => {
		const err = new Error("ENOENT");
		(err as NodeJS.ErrnoException).code = "ENOENT";
		mockedReadJob.mockRejectedValue(err);

		await expect(removeCommand({ jobId: "nonexistent" })).rejects.toThrow();

		const output = errorSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("not found");
	});

	it("handles scheduler unregister failure gracefully (best-effort)", async () => {
		const job = makeJob();
		mockedReadJob.mockResolvedValue(job);
		mockedDeleteJob.mockResolvedValue(undefined);
		const scheduler = mockScheduler();
		scheduler.unregister.mockRejectedValue(new Error("scheduler error"));

		// Should not throw despite scheduler failure
		await removeCommand({ jobId: "abc123" });

		expect(mockedDeleteJob).toHaveBeenCalledWith("abc123");
		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("removed");
	});
});
