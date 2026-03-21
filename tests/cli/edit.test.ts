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
	validateCronExpression: vi.fn(),
	describeSchedule: vi.fn(),
	getNextRuns: vi.fn(),
}));

import { editCommand } from "../../src/cli/commands/edit.js";
import { readJob, updateJob } from "../../src/core/job-manager.js";
import { describeSchedule, getNextRuns, validateCronExpression } from "../../src/core/schedule.js";
import { createScheduler } from "../../src/platform/scheduler.js";

const mockedReadJob = vi.mocked(readJob);
const mockedUpdateJob = vi.mocked(updateJob);
const mockedCreateScheduler = vi.mocked(createScheduler);
const mockedValidateCronExpression = vi.mocked(validateCronExpression);
const mockedDescribeSchedule = vi.mocked(describeSchedule);
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

describe("editCommand", () => {
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

	it("edits name: calls updateJob with new name", async () => {
		const job = makeJob();
		mockedReadJob.mockResolvedValue(job);
		mockedUpdateJob.mockResolvedValue({ ...job, name: "New Name" });

		await editCommand({ jobId: "abc123", name: "New Name" });

		expect(mockedUpdateJob).toHaveBeenCalledWith(
			"abc123",
			expect.objectContaining({ name: "New Name" }),
		);
		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("Updated");
		expect(output).toContain("name");
	});

	it("edits schedule: validates cron, updates, re-registers scheduler", async () => {
		const job = makeJob();
		const updatedJob = {
			...job,
			schedule: { cron: "0 */12 * * *", timezone: "UTC" },
		};
		mockedReadJob.mockResolvedValue(job);
		mockedValidateCronExpression.mockImplementation(() => {}); // valid
		mockedUpdateJob.mockResolvedValue(updatedJob);
		mockedDescribeSchedule.mockReturnValue("Every 12 hours");
		mockedGetNextRuns.mockReturnValue([new Date(Date.now() + 3600000)]);
		const scheduler = mockScheduler();

		await editCommand({ jobId: "abc123", schedule: "0 */12 * * *" });

		expect(mockedValidateCronExpression).toHaveBeenCalledWith("0 */12 * * *");
		expect(mockedUpdateJob).toHaveBeenCalledWith(
			"abc123",
			expect.objectContaining({
				schedule: { cron: "0 */12 * * *", timezone: "UTC" },
			}),
		);
		expect(scheduler.unregister).toHaveBeenCalledWith("abc123");
		expect(scheduler.register).toHaveBeenCalledWith(updatedJob);
	});

	it("rejects invalid cron: prints error, does not call updateJob", async () => {
		const job = makeJob();
		mockedReadJob.mockResolvedValue(job);
		mockedValidateCronExpression.mockImplementation(() => {
			throw new Error("Invalid cron");
		});

		await editCommand({ jobId: "abc123", schedule: "invalid" });

		expect(mockedUpdateJob).not.toHaveBeenCalled();
		const output = errorSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("Invalid");
	});

	it("with no flags: prints current config, no updateJob call", async () => {
		const job = makeJob();
		mockedReadJob.mockResolvedValue(job);

		await editCommand({ jobId: "abc123" });

		expect(mockedUpdateJob).not.toHaveBeenCalled();
		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("Test Job");
	});

	it("prints usage error when no jobId provided", async () => {
		await expect(editCommand({})).rejects.toThrow();

		const output = errorSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("Usage");
	});

	it("prints error when job not found", async () => {
		const err = new Error("ENOENT");
		(err as NodeJS.ErrnoException).code = "ENOENT";
		mockedReadJob.mockRejectedValue(err);

		await expect(editCommand({ jobId: "nonexistent" })).rejects.toThrow();

		const output = errorSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("not found");
	});

	it("edits multiple flags at once: single updateJob call with all updates", async () => {
		const job = makeJob();
		mockedReadJob.mockResolvedValue(job);
		mockedUpdateJob.mockResolvedValue({
			...job,
			name: "Updated",
			repo: { ...job.repo, branch: "develop" },
		});

		await editCommand({ jobId: "abc123", name: "Updated", branch: "develop" });

		expect(mockedUpdateJob).toHaveBeenCalledTimes(1);
		expect(mockedUpdateJob).toHaveBeenCalledWith(
			"abc123",
			expect.objectContaining({
				name: "Updated",
				repo: expect.objectContaining({ branch: "develop" }),
			}),
		);
	});

	it("edits timezone: updates schedule.timezone and re-registers scheduler", async () => {
		const job = makeJob();
		const updatedJob = {
			...job,
			schedule: { cron: "0 */6 * * *", timezone: "America/New_York" },
		};
		mockedReadJob.mockResolvedValue(job);
		mockedUpdateJob.mockResolvedValue(updatedJob);
		mockedDescribeSchedule.mockReturnValue("Every 6 hours");
		mockedGetNextRuns.mockReturnValue([new Date(Date.now() + 3600000)]);
		const scheduler = mockScheduler();

		await editCommand({ jobId: "abc123", timezone: "America/New_York" });

		expect(mockedUpdateJob).toHaveBeenCalledWith(
			"abc123",
			expect.objectContaining({
				schedule: { cron: "0 */6 * * *", timezone: "America/New_York" },
			}),
		);
		expect(scheduler.unregister).toHaveBeenCalled();
		expect(scheduler.register).toHaveBeenCalledWith(updatedJob);
	});

	it("edits max-turns: validates positive integer", async () => {
		const job = makeJob();
		mockedReadJob.mockResolvedValue(job);
		mockedUpdateJob.mockResolvedValue({
			...job,
			guardrails: { ...job.guardrails, maxTurns: 100 },
		});

		await editCommand({ jobId: "abc123", maxTurns: "100" });

		expect(mockedUpdateJob).toHaveBeenCalledWith(
			"abc123",
			expect.objectContaining({
				guardrails: expect.objectContaining({ maxTurns: 100 }),
			}),
		);
	});

	it("does not re-register scheduler when editing non-schedule fields", async () => {
		const job = makeJob();
		mockedReadJob.mockResolvedValue(job);
		mockedUpdateJob.mockResolvedValue({ ...job, name: "New Name" });
		mockScheduler();

		await editCommand({ jobId: "abc123", name: "New Name" });

		expect(mockedCreateScheduler).not.toHaveBeenCalled();
	});
});
