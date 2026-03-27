import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock execCommand so we never touch real crontab
vi.mock("../../src/util/exec.js", () => ({
	execCommand: vi.fn(),
}));

// Mock mkdir so register() doesn't create real directories
vi.mock("node:fs/promises", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs/promises")>();
	return {
		...actual,
		mkdir: vi.fn(),
	};
});

import { execCommand } from "../../src/util/exec.js";

const mockExec = vi.mocked(execCommand);

describe("CrontabScheduler", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("buildEntryBlock", () => {
		it("produces a block with comment marker, cron line, and log redirect", async () => {
			const { buildEntryBlock } = await import("../../src/platform/crontab.js");
			const block = buildEntryBlock(
				"job1",
				"0 */6 * * *",
				"/usr/bin/node /path/runner.js --job-id job1",
				"America/Chicago",
			);
			expect(block).toContain("# claude-auto:job1");
			expect(block).toContain("CRON_TZ=America/Chicago");
			expect(block).toContain("0 */6 * * *");
			expect(block).toContain("/usr/bin/node /path/runner.js --job-id job1");
		});

		it("does NOT include CRON_TZ when timezone is UTC", async () => {
			const { buildEntryBlock } = await import("../../src/platform/crontab.js");
			const block = buildEntryBlock(
				"job1",
				"0 9 * * *",
				"/usr/bin/node /path/runner.js --job-id job1",
				"UTC",
			);
			expect(block).toContain("# claude-auto:job1");
			expect(block).not.toContain("CRON_TZ");
		});
	});

	describe("register", () => {
		it("reads current crontab then writes new entry appended", async () => {
			const { CrontabScheduler } = await import("../../src/platform/crontab.js");
			const scheduler = new CrontabScheduler();

			// Mock crontab -l returning existing content
			mockExec.mockImplementation(async (cmd, args, _opts) => {
				if (cmd === "crontab" && args[0] === "-l") {
					return { stdout: "# existing\n0 0 * * * /bin/echo hello\n", stderr: "" };
				}
				if (cmd === "crontab" && args[0] === "-") {
					return { stdout: "", stderr: "" };
				}
				return { stdout: "", stderr: "" };
			});

			const job = {
				id: "test-job",
				name: "Test Job",
				repo: { path: "/tmp/repo", branch: "main", remote: "origin" },
				schedule: { cron: "0 */6 * * *", timezone: "America/Chicago" },
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

			// Should have called crontab -l first
			expect(mockExec).toHaveBeenCalledWith("crontab", ["-l"]);
			// Should have called crontab - with stdin containing the new entry
			const writeCall = mockExec.mock.calls.find((c) => c[0] === "crontab" && c[1][0] === "-");
			expect(writeCall).toBeDefined();
			const stdin = writeCall?.[2]?.stdin;
			expect(stdin).toContain("# claude-auto:test-job");
			expect(stdin).toContain("CRON_TZ=America/Chicago");
			expect(stdin).toContain("0 */6 * * *");
			// Should preserve existing content
			expect(stdin).toContain("# existing");
		});

		it("throws SchedulerError when job is already registered", async () => {
			const { CrontabScheduler } = await import("../../src/platform/crontab.js");
			const { SchedulerError } = await import("../../src/util/errors.js");
			const scheduler = new CrontabScheduler();

			mockExec.mockImplementation(async (cmd, args) => {
				if (cmd === "crontab" && args[0] === "-l") {
					return {
						stdout: "# claude-auto:test-job\n0 */6 * * * /bin/node runner.js\n",
						stderr: "",
					};
				}
				return { stdout: "", stderr: "" };
			});

			const job = {
				id: "test-job",
				name: "Test Job",
				repo: { path: "/tmp/repo", branch: "main", remote: "origin" },
				schedule: { cron: "0 */6 * * *", timezone: "UTC" },
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
		it("removes the target entry block while preserving other entries", async () => {
			const { CrontabScheduler } = await import("../../src/platform/crontab.js");
			const scheduler = new CrontabScheduler();

			const existingCrontab = [
				"# some other job",
				"0 0 * * * /bin/echo other",
				"# claude-auto:job-to-remove",
				"CRON_TZ=America/Chicago",
				"0 */6 * * * /bin/node runner.js --job-id job-to-remove >> /path/to/log 2>&1",
				"# claude-auto:keep-this",
				"0 9 * * * /bin/node runner.js --job-id keep-this >> /path/to/log 2>&1",
			].join("\n");

			mockExec.mockImplementation(async (cmd, args, _opts) => {
				if (cmd === "crontab" && args[0] === "-l") {
					return { stdout: existingCrontab, stderr: "" };
				}
				if (cmd === "crontab" && args[0] === "-") {
					return { stdout: "", stderr: "" };
				}
				return { stdout: "", stderr: "" };
			});

			await scheduler.unregister("job-to-remove");

			const writeCall = mockExec.mock.calls.find((c) => c[0] === "crontab" && c[1][0] === "-");
			expect(writeCall).toBeDefined();
			const stdin = writeCall?.[2]?.stdin;
			// Should NOT contain the removed job
			expect(stdin).not.toContain("claude-auto:job-to-remove");
			expect(stdin).not.toContain("CRON_TZ=America/Chicago");
			// Should still contain other jobs
			expect(stdin).toContain("# some other job");
			expect(stdin).toContain("0 0 * * * /bin/echo other");
			expect(stdin).toContain("# claude-auto:keep-this");
		});

		it("does not delete non-claude-auto entries immediately following the removed block", async () => {
			const { CrontabScheduler } = await import("../../src/platform/crontab.js");
			const scheduler = new CrontabScheduler();

			// Regression: the unregister state machine previously left `skipping = true`
			// after consuming the cron entry line, so the next non-comment line was also deleted.
			const existingCrontab = [
				"# claude-auto:job-to-remove",
				"CRON_TZ=America/Chicago",
				"0 */6 * * * /bin/node runner.js --job-id job-to-remove >> /path/to/log 2>&1",
				"0 10 * * * /bin/echo unrelated-job",
				"30 8 * * 1-5 /usr/bin/backup.sh",
			].join("\n");

			mockExec.mockImplementation(async (cmd, args, _opts) => {
				if (cmd === "crontab" && args[0] === "-l") {
					return { stdout: existingCrontab, stderr: "" };
				}
				if (cmd === "crontab" && args[0] === "-") {
					return { stdout: "", stderr: "" };
				}
				return { stdout: "", stderr: "" };
			});

			await scheduler.unregister("job-to-remove");

			const writeCall = mockExec.mock.calls.find((c) => c[0] === "crontab" && c[1][0] === "-");
			expect(writeCall).toBeDefined();
			const stdin = writeCall?.[2]?.stdin;
			// Removed job should be gone
			expect(stdin).not.toContain("claude-auto:job-to-remove");
			expect(stdin).not.toContain("CRON_TZ=America/Chicago");
			expect(stdin).not.toContain("job-to-remove");
			// Adjacent non-claude-auto entries MUST be preserved
			expect(stdin).toContain("0 10 * * * /bin/echo unrelated-job");
			expect(stdin).toContain("30 8 * * 1-5 /usr/bin/backup.sh");
		});

		it("removes entry without CRON_TZ and preserves next entry", async () => {
			const { CrontabScheduler } = await import("../../src/platform/crontab.js");
			const scheduler = new CrontabScheduler();

			const existingCrontab = [
				"# claude-auto:simple-job",
				"0 9 * * * /bin/node runner.js --job-id simple-job >> /path/log 2>&1",
				"0 0 * * * /bin/echo keep-me",
			].join("\n");

			mockExec.mockImplementation(async (cmd, args, _opts) => {
				if (cmd === "crontab" && args[0] === "-l") {
					return { stdout: existingCrontab, stderr: "" };
				}
				if (cmd === "crontab" && args[0] === "-") {
					return { stdout: "", stderr: "" };
				}
				return { stdout: "", stderr: "" };
			});

			await scheduler.unregister("simple-job");

			const writeCall = mockExec.mock.calls.find((c) => c[0] === "crontab" && c[1][0] === "-");
			const stdin = writeCall?.[2]?.stdin;
			expect(stdin).not.toContain("simple-job");
			expect(stdin).toContain("0 0 * * * /bin/echo keep-me");
		});
	});

	describe("isRegistered", () => {
		it("returns true when marker comment exists in crontab", async () => {
			const { CrontabScheduler } = await import("../../src/platform/crontab.js");
			const scheduler = new CrontabScheduler();

			mockExec.mockResolvedValue({
				stdout: "# claude-auto:job1\n0 9 * * * /bin/node runner.js\n",
				stderr: "",
			});

			expect(await scheduler.isRegistered("job1")).toBe(true);
		});

		it("returns false when marker comment does not exist", async () => {
			const { CrontabScheduler } = await import("../../src/platform/crontab.js");
			const scheduler = new CrontabScheduler();

			mockExec.mockResolvedValue({
				stdout: "# some other entry\n0 9 * * * /bin/echo hello\n",
				stderr: "",
			});

			expect(await scheduler.isRegistered("job1")).toBe(false);
		});

		it("returns false when crontab is empty (no crontab for user)", async () => {
			const { CrontabScheduler } = await import("../../src/platform/crontab.js");
			const scheduler = new CrontabScheduler();

			mockExec.mockRejectedValue(
				Object.assign(new Error("no crontab for user"), { stderr: "no crontab for user" }),
			);

			expect(await scheduler.isRegistered("job1")).toBe(false);
		});
	});

	describe("list", () => {
		it("parses all claude-auto entries and returns RegisteredJob[]", async () => {
			const { CrontabScheduler } = await import("../../src/platform/crontab.js");
			const scheduler = new CrontabScheduler();

			const crontabContent = [
				"# some other job",
				"0 0 * * * /bin/echo hello",
				"# claude-auto:job1",
				"CRON_TZ=America/Chicago",
				"0 */6 * * * /usr/bin/node /path/runner.js --job-id job1 >> /path/log 2>&1",
				"# claude-auto:job2",
				"30 9 * * 1-5 /usr/bin/node /path/runner.js --job-id job2 >> /path/log 2>&1",
			].join("\n");

			mockExec.mockResolvedValue({ stdout: crontabContent, stderr: "" });

			const jobs = await scheduler.list();
			expect(jobs).toHaveLength(2);
			expect(jobs[0].jobId).toBe("job1");
			expect(jobs[0].schedule).toBe("0 */6 * * *");
			expect(jobs[1].jobId).toBe("job2");
			expect(jobs[1].schedule).toBe("30 9 * * 1-5");
		});

		it("returns empty array when no claude-auto entries exist", async () => {
			const { CrontabScheduler } = await import("../../src/platform/crontab.js");
			const scheduler = new CrontabScheduler();

			mockExec.mockResolvedValue({
				stdout: "# some other entry\n0 0 * * * /bin/echo hello\n",
				stderr: "",
			});

			const jobs = await scheduler.list();
			expect(jobs).toHaveLength(0);
		});
	});
});
