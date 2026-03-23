import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExecResult } from "../../src/util/exec.js";

// Mock execCommand so we never touch real schtasks
vi.mock("../../src/util/exec.js", () => ({
	execCommand: vi.fn(),
}));

import { execCommand } from "../../src/util/exec.js";

const mockExec = vi.mocked(execCommand);

describe("cronToSchtasks", () => {
	it("translates daily at 9am: '0 9 * * *'", async () => {
		const { cronToSchtasks } = await import("../../src/platform/schtasks.js");
		const result = cronToSchtasks("0 9 * * *");
		expect(result.args).toEqual(["/sc", "DAILY", "/st", "09:00"]);
	});

	it("translates every 30 minutes: '*/30 * * * *'", async () => {
		const { cronToSchtasks } = await import("../../src/platform/schtasks.js");
		const result = cronToSchtasks("*/30 * * * *");
		expect(result.args).toEqual(["/sc", "MINUTE", "/mo", "30"]);
	});

	it("translates every 6 hours: '0 */6 * * *'", async () => {
		const { cronToSchtasks } = await import("../../src/platform/schtasks.js");
		const result = cronToSchtasks("0 */6 * * *");
		expect(result.args).toEqual(["/sc", "HOURLY", "/mo", "6", "/st", "00:00"]);
	});

	it("translates weekdays at 9am: '0 9 * * 1-5'", async () => {
		const { cronToSchtasks } = await import("../../src/platform/schtasks.js");
		const result = cronToSchtasks("0 9 * * 1-5");
		expect(result.args).toEqual(["/sc", "WEEKLY", "/d", "MON,TUE,WED,THU,FRI", "/st", "09:00"]);
	});

	it("translates monthly on 15th at 9am: '0 9 15 * *'", async () => {
		const { cronToSchtasks } = await import("../../src/platform/schtasks.js");
		const result = cronToSchtasks("0 9 15 * *");
		expect(result.args).toEqual(["/sc", "MONTHLY", "/d", "15", "/st", "09:00"]);
	});

	it("throws SchedulerError for complex pattern: '0 9 1,15 * *'", async () => {
		const { cronToSchtasks } = await import("../../src/platform/schtasks.js");
		const { SchedulerError } = await import("../../src/util/errors.js");
		expect(() => cronToSchtasks("0 9 1,15 * *")).toThrow(SchedulerError);
		expect(() => cronToSchtasks("0 9 1,15 * *")).toThrow(/cannot be represented/);
	});

	it("translates weekly Sunday midnight: '0 0 * * 0'", async () => {
		const { cronToSchtasks } = await import("../../src/platform/schtasks.js");
		const result = cronToSchtasks("0 0 * * 0");
		expect(result.args).toEqual(["/sc", "WEEKLY", "/d", "SUN", "/st", "00:00"]);
	});
});

describe("SchtasksScheduler", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("register", () => {
		it("calls execCommand with schtasks /create and correct args", async () => {
			const { SchtasksScheduler } = await import("../../src/platform/schtasks.js");
			const scheduler = new SchtasksScheduler();

			// First call: isRegistered check (query fails = not registered)
			// Second call: create
			mockExec.mockImplementation(async (cmd, args) => {
				if (cmd === "schtasks" && args[0] === "/query") {
					throw new Error("ERROR: The system cannot find the file specified.");
				}
				return { stdout: "", stderr: "" };
			});

			const job = {
				id: "test-job",
				name: "Test Job",
				repo: { path: "/tmp/repo", branch: "main", remote: "origin" },
				schedule: { cron: "0 9 * * *", timezone: "America/Chicago" },
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

			// Find the /create call
			const createCall = mockExec.mock.calls.find(
				(c) => c[0] === "schtasks" && c[1][0] === "/create",
			);
			expect(createCall).toBeDefined();
			const args = createCall![1];
			expect(args).toContain("/create");
			expect(args).toContain("/tn");
			expect(args).toContain("claude-auto-test-job");
			expect(args).toContain("/tr");
			expect(args).toContain("/sc");
			expect(args).toContain("DAILY");
			expect(args).toContain("/f");
		});

		it("includes schedule params from cronToSchtasks", async () => {
			const { SchtasksScheduler } = await import("../../src/platform/schtasks.js");
			const scheduler = new SchtasksScheduler();

			mockExec.mockImplementation(async (cmd, args) => {
				if (cmd === "schtasks" && args[0] === "/query") {
					throw new Error("ERROR: The system cannot find the file specified.");
				}
				return { stdout: "", stderr: "" };
			});

			const job = {
				id: "minutely-job",
				name: "Minutely Job",
				repo: { path: "/tmp/repo", branch: "main", remote: "origin" },
				schedule: { cron: "*/30 * * * *", timezone: "UTC" },
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

			const createCall = mockExec.mock.calls.find(
				(c) => c[0] === "schtasks" && c[1][0] === "/create",
			);
			expect(createCall).toBeDefined();
			const args = createCall![1];
			expect(args).toContain("/sc");
			expect(args).toContain("MINUTE");
			expect(args).toContain("/mo");
			expect(args).toContain("30");
		});

		it("throws SchedulerError if job already registered", async () => {
			const { SchtasksScheduler } = await import("../../src/platform/schtasks.js");
			const { SchedulerError } = await import("../../src/util/errors.js");
			const scheduler = new SchtasksScheduler();

			// isRegistered returns true (query succeeds)
			mockExec.mockResolvedValue({
				stdout: '"claude-auto-test-job","3/22/2026 9:00:00 AM","Ready"',
				stderr: "",
			});

			const job = {
				id: "test-job",
				name: "Test Job",
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

			await expect(scheduler.register(job)).rejects.toThrow(SchedulerError);
			await expect(scheduler.register(job)).rejects.toThrow(/already registered/);
		});
	});

	describe("unregister", () => {
		it("calls execCommand with schtasks /delete and correct args", async () => {
			const { SchtasksScheduler } = await import("../../src/platform/schtasks.js");
			const scheduler = new SchtasksScheduler();

			mockExec.mockResolvedValue({ stdout: "", stderr: "" });

			await scheduler.unregister("test-job");

			expect(mockExec).toHaveBeenCalledWith("schtasks", [
				"/delete",
				"/tn",
				"claude-auto-test-job",
				"/f",
			]);
		});

		it("does not throw if task does not exist", async () => {
			const { SchtasksScheduler } = await import("../../src/platform/schtasks.js");
			const scheduler = new SchtasksScheduler();

			mockExec.mockRejectedValue(
				new Error("ERROR: The system cannot find the file specified."),
			);

			await expect(scheduler.unregister("nonexistent-job")).resolves.toBeUndefined();
		});
	});

	describe("isRegistered", () => {
		it("returns true when query succeeds", async () => {
			const { SchtasksScheduler } = await import("../../src/platform/schtasks.js");
			const scheduler = new SchtasksScheduler();

			mockExec.mockResolvedValue({
				stdout: '"claude-auto-test-job","3/22/2026 9:00:00 AM","Ready"',
				stderr: "",
			});

			expect(await scheduler.isRegistered("test-job")).toBe(true);
		});

		it("returns false when query throws (task not found)", async () => {
			const { SchtasksScheduler } = await import("../../src/platform/schtasks.js");
			const scheduler = new SchtasksScheduler();

			mockExec.mockRejectedValue(
				new Error("ERROR: The system cannot find the file specified."),
			);

			expect(await scheduler.isRegistered("nonexistent-job")).toBe(false);
		});
	});

	describe("list", () => {
		it("parses CSV output into RegisteredJob[]", async () => {
			const { SchtasksScheduler } = await import("../../src/platform/schtasks.js");
			const scheduler = new SchtasksScheduler();

			const csvOutput = [
				'"\\claude-auto-job1","3/22/2026 9:00:00 AM","Ready"',
				'"\\claude-auto-job2","3/22/2026 12:00:00 PM","Running"',
				'"\\some-other-task","N/A","Disabled"',
			].join("\n");

			mockExec.mockResolvedValue({ stdout: csvOutput, stderr: "" });

			const jobs = await scheduler.list();
			expect(jobs).toHaveLength(2);
			expect(jobs[0].jobId).toBe("job1");
			expect(jobs[1].jobId).toBe("job2");
		});

		it("returns empty array when no matching tasks", async () => {
			const { SchtasksScheduler } = await import("../../src/platform/schtasks.js");
			const scheduler = new SchtasksScheduler();

			const csvOutput = '"\\some-other-task","N/A","Disabled"\n';

			mockExec.mockResolvedValue({ stdout: csvOutput, stderr: "" });

			const jobs = await scheduler.list();
			expect(jobs).toHaveLength(0);
		});

		it("returns empty array when query throws", async () => {
			const { SchtasksScheduler } = await import("../../src/platform/schtasks.js");
			const scheduler = new SchtasksScheduler();

			mockExec.mockRejectedValue(new Error("No tasks found"));

			const jobs = await scheduler.list();
			expect(jobs).toHaveLength(0);
		});
	});
});
