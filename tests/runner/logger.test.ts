import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RunLogEntry } from "../../src/runner/types.js";

// Mock dependencies
vi.mock("../../src/util/fs.js", () => ({
	writeFileSafe: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/util/paths.js", () => ({
	paths: {
		jobLog: (jobId: string, runId: string) => `/mock/.claude-auto/jobs/${jobId}/runs/${runId}.log`,
		jobLogs: (jobId: string) => `/mock/.claude-auto/jobs/${jobId}/runs`,
	},
}));

vi.mock("node:fs/promises", () => ({
	readdir: vi.fn(),
	readFile: vi.fn(),
}));

import { readdir, readFile } from "node:fs/promises";
import { listRunLogs, readRunLog, writeRunLog } from "../../src/runner/logger.js";
import { writeFileSafe } from "../../src/util/fs.js";

const mockedWriteFileSafe = vi.mocked(writeFileSafe);
const mockedReaddir = vi.mocked(readdir);
const mockedReadFile = vi.mocked(readFile);

function makeSampleEntry(overrides: Partial<RunLogEntry> = {}): RunLogEntry {
	return {
		status: "success",
		jobId: "test-job",
		runId: "run-2026-03-21T12-00-00Z",
		startedAt: "2026-03-21T12:00:00Z",
		completedAt: "2026-03-21T12:05:00Z",
		durationMs: 300000,
		prUrl: "https://github.com/test/repo/pull/42",
		summary: "Fixed a bug in the auth module",
		costUsd: 1.5,
		numTurns: 12,
		sessionId: "session-abc-123",
		branchName: "claude-auto/test-job/2026-03-21T12-00-00",
		...overrides,
	};
}

describe("writeRunLog", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("writes JSON file to paths.jobLog(jobId, entry.runId)", async () => {
		const entry = makeSampleEntry();

		await writeRunLog("test-job", entry);

		expect(mockedWriteFileSafe).toHaveBeenCalledTimes(1);
		expect(mockedWriteFileSafe).toHaveBeenCalledWith(
			"/mock/.claude-auto/jobs/test-job/runs/run-2026-03-21T12-00-00Z.log",
			expect.any(String),
		);
	});

	it("writes valid JSON containing all RunLogEntry fields", async () => {
		const entry = makeSampleEntry();

		await writeRunLog("test-job", entry);

		const writtenContent = mockedWriteFileSafe.mock.calls[0][1];
		const parsed = JSON.parse(writtenContent);

		expect(parsed.runId).toBe("run-2026-03-21T12-00-00Z");
		expect(parsed.jobId).toBe("test-job");
		expect(parsed.startedAt).toBe("2026-03-21T12:00:00Z");
		expect(parsed.completedAt).toBe("2026-03-21T12:05:00Z");
		expect(parsed.durationMs).toBe(300000);
		expect(parsed.status).toBe("success");
	});

	it("writes optional fields when present: prUrl, summary, costUsd, numTurns, sessionId, branchName", async () => {
		const entry = makeSampleEntry();

		await writeRunLog("test-job", entry);

		const writtenContent = mockedWriteFileSafe.mock.calls[0][1];
		const parsed = JSON.parse(writtenContent);

		expect(parsed.prUrl).toBe("https://github.com/test/repo/pull/42");
		expect(parsed.summary).toBe("Fixed a bug in the auth module");
		expect(parsed.costUsd).toBe(1.5);
		expect(parsed.numTurns).toBe(12);
		expect(parsed.sessionId).toBe("session-abc-123");
		expect(parsed.branchName).toBe("claude-auto/test-job/2026-03-21T12-00-00");
	});

	it("writes error field when present", async () => {
		const entry = makeSampleEntry({
			status: "error",
			error: "Git pull failed: diverged branches",
			prUrl: undefined,
		});

		await writeRunLog("test-job", entry);

		const writtenContent = mockedWriteFileSafe.mock.calls[0][1];
		const parsed = JSON.parse(writtenContent);

		expect(parsed.status).toBe("error");
		expect(parsed.error).toBe("Git pull failed: diverged branches");
	});

	it("writes pretty-printed JSON (indented)", async () => {
		const entry = makeSampleEntry();

		await writeRunLog("test-job", entry);

		const writtenContent = mockedWriteFileSafe.mock.calls[0][1];
		// Pretty-printed JSON has newlines and indentation
		expect(writtenContent).toContain("\n");
		expect(writtenContent).toContain("  ");
	});
});

describe("readRunLog", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("reads and parses the JSON log file, returns RunLogEntry", async () => {
		const entry = makeSampleEntry();
		mockedReadFile.mockResolvedValue(JSON.stringify(entry));

		const result = await readRunLog("test-job", "run-2026-03-21T12-00-00Z");

		expect(mockedReadFile).toHaveBeenCalledWith(
			"/mock/.claude-auto/jobs/test-job/runs/run-2026-03-21T12-00-00Z.log",
			"utf-8",
		);
		expect(result.runId).toBe("run-2026-03-21T12-00-00Z");
		expect(result.status).toBe("success");
		expect(result.costUsd).toBe(1.5);
	});

	it("throws when log file doesn't exist (ENOENT)", async () => {
		const error = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException;
		error.code = "ENOENT";
		mockedReadFile.mockRejectedValue(error);

		await expect(readRunLog("test-job", "nonexistent")).rejects.toThrow(/ENOENT/);
	});
});

describe("listRunLogs", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns array of RunLogEntry sorted by startedAt descending", async () => {
		const entry1 = makeSampleEntry({
			runId: "run-1",
			startedAt: "2026-03-20T12:00:00Z",
		});
		const entry2 = makeSampleEntry({
			runId: "run-2",
			startedAt: "2026-03-21T12:00:00Z",
		});
		const entry3 = makeSampleEntry({
			runId: "run-3",
			startedAt: "2026-03-19T12:00:00Z",
		});

		mockedReaddir.mockResolvedValue(["run-1.log", "run-2.log", "run-3.log"] as unknown as never);
		mockedReadFile.mockImplementation((filePath: unknown) => {
			const path = filePath as string;
			if (path.includes("run-1")) return Promise.resolve(JSON.stringify(entry1));
			if (path.includes("run-2")) return Promise.resolve(JSON.stringify(entry2));
			if (path.includes("run-3")) return Promise.resolve(JSON.stringify(entry3));
			return Promise.reject(new Error("Not found"));
		});

		const logs = await listRunLogs("test-job");

		expect(logs).toHaveLength(3);
		// Sorted descending by startedAt: run-2 (Mar 21), run-1 (Mar 20), run-3 (Mar 19)
		expect(logs[0].runId).toBe("run-2");
		expect(logs[1].runId).toBe("run-1");
		expect(logs[2].runId).toBe("run-3");
	});

	it("returns empty array when no runs directory exists", async () => {
		const error = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException;
		error.code = "ENOENT";
		mockedReaddir.mockRejectedValue(error);

		const logs = await listRunLogs("nonexistent-job");

		expect(logs).toEqual([]);
	});

	it("filters only .log files from directory", async () => {
		const entry = makeSampleEntry({ runId: "run-1" });
		mockedReaddir.mockResolvedValue(["run-1.log", ".DS_Store", "readme.txt"] as unknown as never);
		mockedReadFile.mockResolvedValue(JSON.stringify(entry));

		const logs = await listRunLogs("test-job");

		// Only .log file should be read
		expect(logs).toHaveLength(1);
		expect(logs[0].runId).toBe("run-1");
	});

	it("skips files that fail to parse without throwing", async () => {
		const entry = makeSampleEntry({ runId: "run-good" });
		mockedReaddir.mockResolvedValue(["run-good.log", "run-bad.log"] as unknown as never);
		mockedReadFile.mockImplementation((filePath: unknown) => {
			const path = filePath as string;
			if (path.includes("run-good")) return Promise.resolve(JSON.stringify(entry));
			if (path.includes("run-bad")) return Promise.resolve("not valid json");
			return Promise.reject(new Error("Not found"));
		});

		const logs = await listRunLogs("test-job");

		expect(logs).toHaveLength(1);
		expect(logs[0].runId).toBe("run-good");
	});
});
