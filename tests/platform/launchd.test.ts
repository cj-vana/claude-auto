import plist from "plist";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock execCommand
vi.mock("../../src/util/exec.js", () => ({
	execCommand: vi.fn(),
}));

// Mock node:fs/promises
vi.mock("node:fs/promises", () => ({
	mkdir: vi.fn(),
	writeFile: vi.fn(),
	unlink: vi.fn(),
	access: vi.fn(),
	readdir: vi.fn(),
	readFile: vi.fn(),
}));

import { access, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { execCommand } from "../../src/util/exec.js";

const mockExec = vi.mocked(execCommand);
const mockWriteFile = vi.mocked(writeFile);
const mockUnlink = vi.mocked(unlink);
const mockAccess = vi.mocked(access);
const _mockReaddir = vi.mocked(readdir);
const _mockReadFile = vi.mocked(readFile);

describe("cronToCalendarIntervals", () => {
	it("converts '0 9 * * *' to calendarIntervals with Hour:9 Minute:0", async () => {
		const { cronToCalendarIntervals } = await import("../../src/platform/launchd.js");
		const result = cronToCalendarIntervals("0 9 * * *");
		expect(result.calendarIntervals).toBeDefined();
		expect(result.calendarIntervals).toEqual([{ Hour: 9, Minute: 0 }]);
	});

	it("converts '0 */6 * * *' to calendarIntervals with hours 0,6,12,18", async () => {
		const { cronToCalendarIntervals } = await import("../../src/platform/launchd.js");
		const result = cronToCalendarIntervals("0 */6 * * *");
		expect(result.calendarIntervals).toBeDefined();
		expect(result.calendarIntervals).toHaveLength(4);
		const hours = result.calendarIntervals?.map((ci) => ci.Hour);
		expect(hours).toEqual([0, 6, 12, 18]);
		// All should have Minute: 0
		for (const ci of result.calendarIntervals ?? []) {
			expect(ci.Minute).toBe(0);
		}
	});

	it("converts '30 9 * * 1-5' to calendarIntervals with 5 weekday entries", async () => {
		const { cronToCalendarIntervals } = await import("../../src/platform/launchd.js");
		const result = cronToCalendarIntervals("30 9 * * 1-5");
		expect(result.calendarIntervals).toBeDefined();
		expect(result.calendarIntervals).toHaveLength(5);
		for (const ci of result.calendarIntervals ?? []) {
			expect(ci.Minute).toBe(30);
			expect(ci.Hour).toBe(9);
			expect(ci.Weekday).toBeGreaterThanOrEqual(1);
			expect(ci.Weekday).toBeLessThanOrEqual(5);
		}
	});

	it("converts '*/5 * * * *' to startInterval of 300", async () => {
		const { cronToCalendarIntervals } = await import("../../src/platform/launchd.js");
		const result = cronToCalendarIntervals("*/5 * * * *");
		expect(result.startInterval).toBe(300);
		expect(result.calendarIntervals).toBeUndefined();
	});

	it("converts '*/1 * * * *' to startInterval of 60", async () => {
		const { cronToCalendarIntervals } = await import("../../src/platform/launchd.js");
		const result = cronToCalendarIntervals("*/1 * * * *");
		expect(result.startInterval).toBe(60);
		expect(result.calendarIntervals).toBeUndefined();
	});

	it("throws Error when expression produces more than 50 intervals", async () => {
		const { cronToCalendarIntervals } = await import("../../src/platform/launchd.js");
		// "0,15,30,45 9-17 * * 1-5" = 4 minutes * 9 hours * 5 weekdays = 180 intervals
		expect(() => cronToCalendarIntervals("0,15,30,45 9-17 * * 1-5")).toThrow(
			/180 calendar intervals/,
		);
	});
});

describe("LaunchdScheduler", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("register", () => {
		it("writes a plist file to the correct path", async () => {
			const { LaunchdScheduler } = await import("../../src/platform/launchd.js");
			const { paths } = await import("../../src/util/paths.js");
			const scheduler = new LaunchdScheduler();

			// Simulate plist doesn't exist yet
			mockAccess.mockRejectedValue(new Error("ENOENT"));
			mockExec.mockResolvedValue({ stdout: "", stderr: "" });
			mockWriteFile.mockResolvedValue();

			const job = {
				id: "test-launchd-job",
				name: "Test Launchd Job",
				repo: { path: "/tmp/repo", branch: "main", remote: "origin" },
				schedule: { cron: "0 9 * * *", timezone: "UTC" },
				focus: ["open-issues" as const],
				guardrails: {
					maxTurns: 50,
					maxBudgetUsd: 5.0,
					noNewDependencies: false,
					noArchitectureChanges: false,
					bugFixOnly: false,
				},
				notifications: {},
				enabled: true,
			};

			await scheduler.register(job);

			// Should write plist to correct path
			expect(mockWriteFile).toHaveBeenCalledTimes(1);
			const writePath = mockWriteFile.mock.calls[0][0];
			expect(writePath).toBe(paths.plistPath("test-launchd-job"));
		});

		it("plist XML contains correct Label", async () => {
			const { LaunchdScheduler } = await import("../../src/platform/launchd.js");
			const scheduler = new LaunchdScheduler();

			mockAccess.mockRejectedValue(new Error("ENOENT"));
			mockExec.mockResolvedValue({ stdout: "", stderr: "" });
			mockWriteFile.mockResolvedValue();

			const job = {
				id: "label-test",
				name: "Label Test",
				repo: { path: "/tmp/repo", branch: "main", remote: "origin" },
				schedule: { cron: "0 9 * * *", timezone: "UTC" },
				focus: ["open-issues" as const],
				guardrails: {
					maxTurns: 50,
					maxBudgetUsd: 5.0,
					noNewDependencies: false,
					noArchitectureChanges: false,
					bugFixOnly: false,
				},
				notifications: {},
				enabled: true,
			};

			await scheduler.register(job);

			const xmlContent = mockWriteFile.mock.calls[0][1] as string;
			const parsed = plist.parse(xmlContent) as Record<string, unknown>;
			expect(parsed.Label).toBe("com.claude-auto.label-test");
		});

		it("plist XML contains ProgramArguments with node path and --job-id flag", async () => {
			const { LaunchdScheduler } = await import("../../src/platform/launchd.js");
			const scheduler = new LaunchdScheduler();

			mockAccess.mockRejectedValue(new Error("ENOENT"));
			mockExec.mockResolvedValue({ stdout: "", stderr: "" });
			mockWriteFile.mockResolvedValue();

			const job = {
				id: "args-test",
				name: "Args Test",
				repo: { path: "/tmp/repo", branch: "main", remote: "origin" },
				schedule: { cron: "0 9 * * *", timezone: "UTC" },
				focus: ["open-issues" as const],
				guardrails: {
					maxTurns: 50,
					maxBudgetUsd: 5.0,
					noNewDependencies: false,
					noArchitectureChanges: false,
					bugFixOnly: false,
				},
				notifications: {},
				enabled: true,
			};

			await scheduler.register(job);

			const xmlContent = mockWriteFile.mock.calls[0][1] as string;
			const parsed = plist.parse(xmlContent) as Record<string, unknown>;
			const progArgs = parsed.ProgramArguments as string[];
			expect(progArgs).toContain("--job-id");
			expect(progArgs).toContain("args-test");
			// First arg should be a node path
			expect(progArgs[0]).toContain("node");
		});

		it("plist XML contains EnvironmentVariables with PATH and HOME", async () => {
			const { LaunchdScheduler } = await import("../../src/platform/launchd.js");
			const scheduler = new LaunchdScheduler();

			mockAccess.mockRejectedValue(new Error("ENOENT"));
			mockExec.mockResolvedValue({ stdout: "", stderr: "" });
			mockWriteFile.mockResolvedValue();

			const job = {
				id: "env-test",
				name: "Env Test",
				repo: { path: "/tmp/repo", branch: "main", remote: "origin" },
				schedule: { cron: "0 9 * * *", timezone: "UTC" },
				focus: ["open-issues" as const],
				guardrails: {
					maxTurns: 50,
					maxBudgetUsd: 5.0,
					noNewDependencies: false,
					noArchitectureChanges: false,
					bugFixOnly: false,
				},
				notifications: {},
				enabled: true,
			};

			await scheduler.register(job);

			const xmlContent = mockWriteFile.mock.calls[0][1] as string;
			const parsed = plist.parse(xmlContent) as Record<string, unknown>;
			const envVars = parsed.EnvironmentVariables as Record<string, string>;
			expect(envVars).toHaveProperty("PATH");
			expect(envVars).toHaveProperty("HOME");
		});

		it("calls launchctl bootstrap with correct gui/{uid} and plist path", async () => {
			const { LaunchdScheduler } = await import("../../src/platform/launchd.js");
			const { paths } = await import("../../src/util/paths.js");
			const scheduler = new LaunchdScheduler();

			mockAccess.mockRejectedValue(new Error("ENOENT"));
			mockExec.mockResolvedValue({ stdout: "", stderr: "" });
			mockWriteFile.mockResolvedValue();

			const job = {
				id: "bootstrap-test",
				name: "Bootstrap Test",
				repo: { path: "/tmp/repo", branch: "main", remote: "origin" },
				schedule: { cron: "0 9 * * *", timezone: "UTC" },
				focus: ["open-issues" as const],
				guardrails: {
					maxTurns: 50,
					maxBudgetUsd: 5.0,
					noNewDependencies: false,
					noArchitectureChanges: false,
					bugFixOnly: false,
				},
				notifications: {},
				enabled: true,
			};

			await scheduler.register(job);

			const bootstrapCall = mockExec.mock.calls.find(
				(c) => c[0] === "launchctl" && c[1][0] === "bootstrap",
			);
			expect(bootstrapCall).toBeDefined();
			// gui/{uid}
			expect(bootstrapCall?.[1][1]).toMatch(/^gui\/\d+$/);
			// plist path
			expect(bootstrapCall?.[1][2]).toBe(paths.plistPath("bootstrap-test"));
		});
	});

	describe("unregister", () => {
		it("calls launchctl bootout with correct gui/{uid}/{label}", async () => {
			const { LaunchdScheduler } = await import("../../src/platform/launchd.js");
			const scheduler = new LaunchdScheduler();

			mockExec.mockResolvedValue({ stdout: "", stderr: "" });
			mockUnlink.mockResolvedValue();

			await scheduler.unregister("unreg-test");

			const bootoutCall = mockExec.mock.calls.find(
				(c) => c[0] === "launchctl" && c[1][0] === "bootout",
			);
			expect(bootoutCall).toBeDefined();
			expect(bootoutCall?.[1][1]).toMatch(/^gui\/\d+\/com\.claude-auto\.unreg-test$/);
		});

		it("deletes the plist file after bootout", async () => {
			const { LaunchdScheduler } = await import("../../src/platform/launchd.js");
			const { paths } = await import("../../src/util/paths.js");
			const scheduler = new LaunchdScheduler();

			mockExec.mockResolvedValue({ stdout: "", stderr: "" });
			mockUnlink.mockResolvedValue();

			await scheduler.unregister("delete-test");

			expect(mockUnlink).toHaveBeenCalledWith(paths.plistPath("delete-test"));
		});
	});

	describe("isRegistered", () => {
		it("returns true when plist file exists", async () => {
			const { LaunchdScheduler } = await import("../../src/platform/launchd.js");
			const scheduler = new LaunchdScheduler();

			mockAccess.mockResolvedValue(undefined);

			expect(await scheduler.isRegistered("existing-job")).toBe(true);
		});

		it("returns false when plist file does not exist", async () => {
			const { LaunchdScheduler } = await import("../../src/platform/launchd.js");
			const scheduler = new LaunchdScheduler();

			mockAccess.mockRejectedValue(new Error("ENOENT"));

			expect(await scheduler.isRegistered("nonexistent-job")).toBe(false);
		});
	});
});
