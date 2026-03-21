import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDatabase, getDatabase } from "../../src/core/database.js";
import {
	formatContextWindow,
	loadRunContext,
	saveRunContext,
	type RunContext,
} from "../../src/runner/context-store.js";
import type { RunLogEntry } from "../../src/runner/types.js";

function makeEntry(overrides: Partial<RunLogEntry> = {}): RunLogEntry {
	return {
		status: "success",
		jobId: "test-job",
		runId: `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		startedAt: "2026-03-21T12:00:00Z",
		completedAt: "2026-03-21T12:05:00Z",
		durationMs: 300000,
		prUrl: "https://github.com/test/repo/pull/42",
		summary: "Fixed a bug in the auth module",
		costUsd: 1.5,
		numTurns: 12,
		sessionId: "session-abc123",
		branchName: "auto/fix-auth-bug",
		issueNumber: 42,
		...overrides,
	};
}

describe("context-store", () => {
	beforeEach(() => {
		// Initialize in-memory database for test isolation
		getDatabase(":memory:");
	});

	afterEach(() => {
		closeDatabase();
	});

	describe("saveRunContext", () => {
		it("inserts a run row into the database", () => {
			const entry = makeEntry({ runId: "run-save-test" });
			saveRunContext(entry);

			const db = getDatabase();
			const row = db.prepare("SELECT * FROM runs WHERE id = ?").get("run-save-test") as Record<
				string,
				unknown
			>;

			expect(row).toBeDefined();
			expect(row.job_id).toBe("test-job");
			expect(row.status).toBe("success");
			expect(row.started_at).toBe("2026-03-21T12:00:00Z");
			expect(row.completed_at).toBe("2026-03-21T12:05:00Z");
			expect(row.duration_ms).toBe(300000);
			expect(row.cost_usd).toBe(1.5);
			expect(row.num_turns).toBe(12);
			expect(row.session_id).toBe("session-abc123");
			expect(row.pr_url).toBe("https://github.com/test/repo/pull/42");
			expect(row.branch_name).toBe("auto/fix-auth-bug");
			expect(row.issue_number).toBe(42);
			expect(row.summary).toBe("Fixed a bug in the auth module");
		});
	});

	describe("loadRunContext", () => {
		it("returns empty array for job with no runs", () => {
			const result = loadRunContext("nonexistent-job");
			expect(result).toEqual([]);
		});

		it("returns last 5 runs (default limit) sorted by started_at desc", () => {
			// Insert 7 runs with sequential timestamps
			for (let i = 0; i < 7; i++) {
				const hour = String(i + 10).padStart(2, "0");
				saveRunContext(
					makeEntry({
						runId: `run-${i}`,
						startedAt: `2026-03-21T${hour}:00:00Z`,
					}),
				);
			}

			const result = loadRunContext("test-job");
			expect(result).toHaveLength(5);
			// Should be sorted descending (newest first)
			expect(result[0].started_at).toBe("2026-03-21T16:00:00Z");
			expect(result[4].started_at).toBe("2026-03-21T12:00:00Z");
		});

		it("respects custom limit parameter", () => {
			for (let i = 0; i < 5; i++) {
				const hour = String(i + 10).padStart(2, "0");
				saveRunContext(
					makeEntry({
						runId: `run-limit-${i}`,
						startedAt: `2026-03-21T${hour}:00:00Z`,
					}),
				);
			}

			const result = loadRunContext("test-job", 2);
			expect(result).toHaveLength(2);
		});

		it('only returns runs with status "success" or "no-changes"', () => {
			saveRunContext(makeEntry({ runId: "run-success", status: "success" }));
			saveRunContext(makeEntry({ runId: "run-no-changes", status: "no-changes" }));
			saveRunContext(makeEntry({ runId: "run-error", status: "error" }));
			saveRunContext(makeEntry({ runId: "run-locked", status: "locked" }));
			saveRunContext(makeEntry({ runId: "run-git-error", status: "git-error" }));
			saveRunContext(makeEntry({ runId: "run-paused", status: "paused" }));

			const result = loadRunContext("test-job", 10);
			expect(result).toHaveLength(2);
			const statuses = result.map((r) => r.status);
			expect(statuses).toContain("success");
			expect(statuses).toContain("no-changes");
			expect(statuses).not.toContain("error");
			expect(statuses).not.toContain("locked");
			expect(statuses).not.toContain("git-error");
			expect(statuses).not.toContain("paused");
		});
	});

	describe("formatContextWindow", () => {
		it("returns empty string for empty context", () => {
			expect(formatContextWindow([])).toBe("");
		});

		it('includes "Previous Work" header and issue numbers, PR URLs', () => {
			const context: RunContext[] = [
				{
					id: "run-1",
					status: "success",
					pr_url: "https://github.com/test/repo/pull/42",
					branch_name: "auto/fix-bug",
					issue_number: 42,
					summary: null,
					started_at: "2026-03-21T12:00:00Z",
				},
			];

			const result = formatContextWindow(context);
			expect(result).toContain("## Previous Work (DO NOT duplicate)");
			expect(result).toContain("Issue: #42");
			expect(result).toContain("PR: https://github.com/test/repo/pull/42");
		});

		it("includes branch names from prior runs", () => {
			const context: RunContext[] = [
				{
					id: "run-1",
					status: "success",
					pr_url: null,
					branch_name: "auto/improve-docs",
					issue_number: null,
					summary: null,
					started_at: "2026-03-21T12:00:00Z",
				},
			];

			const result = formatContextWindow(context);
			expect(result).toContain("Branch: auto/improve-docs");
		});
	});
});
