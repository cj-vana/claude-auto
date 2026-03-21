import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { RunLogEntry } from "../../src/runner/types.js";

// Mock dependencies
vi.mock("../../src/runner/logger.js", () => ({
	listRunLogs: vi.fn(),
}));

import { listRunLogs } from "../../src/runner/logger.js";
import { logsCommand } from "../../src/cli/commands/logs.js";

const mockedListRunLogs = vi.mocked(listRunLogs);

function makeRunLog(overrides: Partial<RunLogEntry> = {}): RunLogEntry {
	return {
		status: "success",
		jobId: "abc123",
		runId: "run-001",
		startedAt: "2026-03-21T12:00:00Z",
		completedAt: "2026-03-21T12:05:00Z",
		durationMs: 300000,
		prUrl: "https://github.com/test/repo/pull/42",
		summary: "Fixed a bug",
		costUsd: 1.5,
		...overrides,
	};
}

describe("logsCommand", () => {
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

	it("prints 'No runs found' when no logs exist", async () => {
		mockedListRunLogs.mockResolvedValue([]);

		await logsCommand({ jobId: "abc123" });

		expect(logSpy).toHaveBeenCalledWith("No runs found for job abc123.");
	});

	it("prints table with run data for existing logs", async () => {
		mockedListRunLogs.mockResolvedValue([
			makeRunLog({ runId: "run-001", status: "success", durationMs: 300000 }),
			makeRunLog({ runId: "run-002", status: "error", error: "Git pull failed" }),
			makeRunLog({ runId: "run-003", status: "no-changes" }),
		]);

		await logsCommand({ jobId: "abc123" });

		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("run-001");
		expect(output).toContain("success");
		expect(output).toContain("run-002");
		expect(output).toContain("error");
		expect(output).toContain("run-003");
		expect(output).toContain("Run ID");
		expect(output).toContain("Status");
	});

	it("respects --limit flag to show fewer entries", async () => {
		const logs = Array.from({ length: 10 }, (_, i) =>
			makeRunLog({ runId: `run-${String(i).padStart(3, "0")}` }),
		);
		mockedListRunLogs.mockResolvedValue(logs);

		await logsCommand({ jobId: "abc123", limit: 2 });

		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("run-000");
		expect(output).toContain("run-001");
		expect(output).not.toContain("run-002");
	});

	it("prints usage when jobId is missing", async () => {
		await logsCommand({});

		expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Usage"));
	});
});
