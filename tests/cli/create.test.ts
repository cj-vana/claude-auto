import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { JobConfig } from "../../src/core/types.js";

// Mock dependencies
vi.mock("node:fs/promises", () => ({
	stat: vi.fn(),
	readFile: vi.fn(),
}));

vi.mock("../../src/core/job-manager.js", () => ({
	createJob: vi.fn(),
}));

vi.mock("../../src/platform/scheduler.js", () => ({
	createScheduler: vi.fn(),
}));

vi.mock("../../src/core/schedule.js", () => ({
	validateCronExpression: vi.fn(),
	describeSchedule: vi.fn(),
	getNextRuns: vi.fn(),
}));

vi.mock("../../src/util/exec.js", () => ({
	execCommand: vi.fn(),
}));

import { stat, readFile } from "node:fs/promises";
import { createJob } from "../../src/core/job-manager.js";
import { createScheduler } from "../../src/platform/scheduler.js";
import {
	validateCronExpression,
	describeSchedule,
	getNextRuns,
} from "../../src/core/schedule.js";
import { execCommand } from "../../src/util/exec.js";
import { createCommand } from "../../src/cli/commands/create.js";

const mockedStat = vi.mocked(stat);
const mockedReadFile = vi.mocked(readFile);
const mockedCreateJob = vi.mocked(createJob);
const mockedCreateScheduler = vi.mocked(createScheduler);
const mockedValidateCronExpression = vi.mocked(validateCronExpression);
const mockedDescribeSchedule = vi.mocked(describeSchedule);
const mockedGetNextRuns = vi.mocked(getNextRuns);
const mockedExecCommand = vi.mocked(execCommand);

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

function mockRepoExists() {
	mockedStat.mockResolvedValue({ isDirectory: () => true } as import("node:fs").Stats);
	mockedExecCommand.mockResolvedValue({ stdout: ".git\n", stderr: "" });
}

describe("createCommand", () => {
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

	it("creates job and registers with scheduler on valid args", async () => {
		const job = makeJob();
		mockRepoExists();
		mockedValidateCronExpression.mockImplementation(() => {});
		mockedCreateJob.mockResolvedValue(job);
		mockedDescribeSchedule.mockReturnValue("Every 6 hours");
		mockedGetNextRuns.mockReturnValue([
			new Date("2026-01-01T06:00:00Z"),
			new Date("2026-01-01T12:00:00Z"),
			new Date("2026-01-01T18:00:00Z"),
		]);
		const scheduler = mockScheduler();

		await createCommand({
			name: "Test Job",
			repo: "/home/user/repos/my-project",
			schedule: "0 */6 * * *",
			branch: "main",
			timezone: "UTC",
			focus: "open-issues,bug-discovery",
		});

		expect(mockedValidateCronExpression).toHaveBeenCalledWith("0 */6 * * *");
		expect(mockedCreateJob).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Test Job",
				repo: expect.objectContaining({ path: "/home/user/repos/my-project", branch: "main" }),
				schedule: expect.objectContaining({ cron: "0 */6 * * *", timezone: "UTC" }),
				focus: ["open-issues", "bug-discovery"],
			}),
		);
		expect(scheduler.register).toHaveBeenCalledWith(job);
		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("abc123");
		expect(output).toContain("Every 6 hours");
	});

	it("reads system prompt from file when --system-prompt-file provided", async () => {
		const job = makeJob({ systemPrompt: "You are a meticulous engineer..." });
		mockRepoExists();
		mockedValidateCronExpression.mockImplementation(() => {});
		mockedReadFile.mockResolvedValue("You are a meticulous engineer..." as unknown as Buffer);
		mockedCreateJob.mockResolvedValue(job);
		mockedDescribeSchedule.mockReturnValue("Every 6 hours");
		mockedGetNextRuns.mockReturnValue([new Date("2026-01-01T06:00:00Z")]);
		mockScheduler();

		await createCommand({
			name: "Test Job",
			repo: "/home/user/repos/my-project",
			schedule: "0 */6 * * *",
			systemPromptFile: "/tmp/prompt.md",
		});

		expect(mockedReadFile).toHaveBeenCalledWith("/tmp/prompt.md", "utf-8");
		expect(mockedCreateJob).toHaveBeenCalledWith(
			expect.objectContaining({
				systemPrompt: "You are a meticulous engineer...",
			}),
		);
	});

	it("clones repo via gh when path does not exist and --github-repo is provided", async () => {
		const job = makeJob();
		const enoent = new Error("ENOENT") as NodeJS.ErrnoException;
		enoent.code = "ENOENT";

		// First stat call: path does not exist (throws ENOENT)
		// After clone: stat succeeds, git rev-parse succeeds
		mockedStat
			.mockRejectedValueOnce(enoent)
			.mockResolvedValueOnce({ isDirectory: () => true } as import("node:fs").Stats);
		mockedExecCommand
			.mockResolvedValueOnce({ stdout: "", stderr: "" }) // gh clone
			.mockResolvedValueOnce({ stdout: ".git\n", stderr: "" }); // git rev-parse after clone
		mockedValidateCronExpression.mockImplementation(() => {});
		mockedCreateJob.mockResolvedValue(job);
		mockedDescribeSchedule.mockReturnValue("Every 6 hours");
		mockedGetNextRuns.mockReturnValue([new Date("2026-01-01T06:00:00Z")]);
		mockScheduler();

		await createCommand({
			name: "Test Job",
			repo: "/tmp/new-repo",
			schedule: "0 */6 * * *",
			githubRepo: "owner/repo",
		});

		expect(mockedExecCommand).toHaveBeenCalledWith("gh", ["repo", "clone", "owner/repo", "/tmp/new-repo"]);
		expect(mockedCreateJob).toHaveBeenCalled();
	});

	it("throws error when required args are missing", async () => {
		await expect(createCommand({ repo: "/path", schedule: "0 * * * *" })).rejects.toThrow(
			"Missing required arguments",
		);

		const output = errorSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("Usage");
	});

	it("throws CronValidationError on invalid cron expression", async () => {
		mockRepoExists();
		mockedValidateCronExpression.mockImplementation(() => {
			throw new Error("Invalid cron expression");
		});

		await expect(
			createCommand({
				name: "Test Job",
				repo: "/home/user/repos/my-project",
				schedule: "invalid",
			}),
		).rejects.toThrow();
	});

	it("sets guardrails booleans from flags", async () => {
		const job = makeJob({
			guardrails: {
				maxTurns: 50,
				maxBudgetUsd: 5.0,
				noNewDependencies: true,
				noArchitectureChanges: true,
				bugFixOnly: true,
			},
		});
		mockRepoExists();
		mockedValidateCronExpression.mockImplementation(() => {});
		mockedCreateJob.mockResolvedValue(job);
		mockedDescribeSchedule.mockReturnValue("Every 6 hours");
		mockedGetNextRuns.mockReturnValue([new Date("2026-01-01T06:00:00Z")]);
		mockScheduler();

		await createCommand({
			name: "Test Job",
			repo: "/home/user/repos/my-project",
			schedule: "0 */6 * * *",
			noNewDeps: true,
			noArchChanges: true,
			bugFixOnly: true,
		});

		expect(mockedCreateJob).toHaveBeenCalledWith(
			expect.objectContaining({
				guardrails: expect.objectContaining({
					noNewDependencies: true,
					noArchitectureChanges: true,
					bugFixOnly: true,
				}),
			}),
		);
	});

	it("parses max-turns and max-budget as numbers into guardrails", async () => {
		const job = makeJob({
			guardrails: {
				maxTurns: 100,
				maxBudgetUsd: 10.0,
				noNewDependencies: false,
				noArchitectureChanges: false,
				bugFixOnly: false,
			},
		});
		mockRepoExists();
		mockedValidateCronExpression.mockImplementation(() => {});
		mockedCreateJob.mockResolvedValue(job);
		mockedDescribeSchedule.mockReturnValue("Every 6 hours");
		mockedGetNextRuns.mockReturnValue([new Date("2026-01-01T06:00:00Z")]);
		mockScheduler();

		await createCommand({
			name: "Test Job",
			repo: "/home/user/repos/my-project",
			schedule: "0 */6 * * *",
			maxTurns: "100",
			maxBudget: "10.0",
		});

		expect(mockedCreateJob).toHaveBeenCalledWith(
			expect.objectContaining({
				guardrails: expect.objectContaining({
					maxTurns: 100,
					maxBudgetUsd: 10.0,
				}),
			}),
		);
	});

	it("sets notification config from --notify-discord, --notify-slack, --notify-telegram", async () => {
		const job = makeJob();
		mockRepoExists();
		mockedValidateCronExpression.mockImplementation(() => {});
		mockedCreateJob.mockResolvedValue(job);
		mockedDescribeSchedule.mockReturnValue("Every 6 hours");
		mockedGetNextRuns.mockReturnValue([new Date("2026-01-01T06:00:00Z")]);
		mockScheduler();

		await createCommand({
			name: "Test Job",
			repo: "/home/user/repos/my-project",
			schedule: "0 */6 * * *",
			notifyDiscord: "https://discord.com/webhook/123",
			notifySlack: "https://hooks.slack.com/services/T00/B00/xxx",
			notifyTelegram: "bottoken123:chatid456",
		});

		expect(mockedCreateJob).toHaveBeenCalledWith(
			expect.objectContaining({
				notifications: expect.objectContaining({
					discord: { webhookUrl: "https://discord.com/webhook/123" },
					slack: { webhookUrl: "https://hooks.slack.com/services/T00/B00/xxx" },
					telegram: { botToken: "bottoken123", chatId: "chatid456" },
				}),
			}),
		);
	});

	it("uses default focus and system timezone when not specified", async () => {
		const job = makeJob();
		mockRepoExists();
		mockedValidateCronExpression.mockImplementation(() => {});
		mockedCreateJob.mockResolvedValue(job);
		mockedDescribeSchedule.mockReturnValue("Every 6 hours");
		mockedGetNextRuns.mockReturnValue([new Date("2026-01-01T06:00:00Z")]);
		mockScheduler();

		await createCommand({
			name: "Test Job",
			repo: "/home/user/repos/my-project",
			schedule: "0 */6 * * *",
		});

		expect(mockedCreateJob).toHaveBeenCalledWith(
			expect.objectContaining({
				focus: ["open-issues", "bug-discovery"],
				schedule: expect.objectContaining({
					// timezone should be system timezone (not undefined)
					timezone: expect.any(String),
				}),
			}),
		);
		// Should not be undefined
		const createJobCall = mockedCreateJob.mock.calls[0][0];
		expect(createJobCall.schedule.timezone).toBeTruthy();
	});
});
