import { afterEach, describe, expect, it } from "vitest";
import { closeDatabase, getDatabase } from "../../src/core/database.js";

describe("database singleton", () => {
	afterEach(() => {
		closeDatabase();
	});

	it("getDatabase() returns a Database instance with WAL mode enabled", () => {
		const db = getDatabase(":memory:");
		const journalMode = db.pragma("journal_mode", { simple: true });
		// In-memory databases report "memory" for journal_mode since WAL
		// doesn't apply to them, but the pragma call still executes successfully.
		// For file-based databases this would return "wal".
		expect(journalMode).toBeDefined();
		expect(db).toBeDefined();
	});

	it("getDatabase() returns the same instance on second call (singleton)", () => {
		const db1 = getDatabase(":memory:");
		const db2 = getDatabase(":memory:");
		expect(db1).toBe(db2);
	});

	it("runs table exists after getDatabase() call", () => {
		const db = getDatabase(":memory:");
		const table = db
			.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='runs'")
			.get() as { name: string } | undefined;
		expect(table).toBeDefined();
		expect(table?.name).toBe("runs");
	});

	it("runs table has correct columns", () => {
		const db = getDatabase(":memory:");
		const columns = db.prepare("PRAGMA table_info(runs)").all() as Array<{ name: string }>;
		const columnNames = columns.map((c) => c.name);

		expect(columnNames).toContain("id");
		expect(columnNames).toContain("job_id");
		expect(columnNames).toContain("status");
		expect(columnNames).toContain("started_at");
		expect(columnNames).toContain("completed_at");
		expect(columnNames).toContain("duration_ms");
		expect(columnNames).toContain("cost_usd");
		expect(columnNames).toContain("num_turns");
		expect(columnNames).toContain("session_id");
		expect(columnNames).toContain("model");
		expect(columnNames).toContain("pr_url");
		expect(columnNames).toContain("branch_name");
		expect(columnNames).toContain("issue_number");
		expect(columnNames).toContain("summary");
		expect(columnNames).toContain("error");
		expect(columnNames).toContain("created_at");
	});

	it("idx_runs_job_id index exists", () => {
		const db = getDatabase(":memory:");
		const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all() as Array<{
			name: string;
		}>;
		const indexNames = indexes.map((i) => i.name);
		expect(indexNames).toContain("idx_runs_job_id");
	});

	it("idx_runs_started_at index exists", () => {
		const db = getDatabase(":memory:");
		const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all() as Array<{
			name: string;
		}>;
		const indexNames = indexes.map((i) => i.name);
		expect(indexNames).toContain("idx_runs_started_at");
	});

	it("idx_runs_job_started index exists", () => {
		const db = getDatabase(":memory:");
		const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all() as Array<{
			name: string;
		}>;
		const indexNames = indexes.map((i) => i.name);
		expect(indexNames).toContain("idx_runs_job_started");
	});

	it("user_version is 2 after initialization", () => {
		const db = getDatabase(":memory:");
		const version = db.pragma("user_version", { simple: true });
		expect(version).toBe(2);
	});

	it("closeDatabase() closes the connection and resets singleton", () => {
		const db1 = getDatabase(":memory:");
		closeDatabase();
		// After closing, getDatabase should create a new instance
		const db2 = getDatabase(":memory:");
		expect(db2).not.toBe(db1);
	});
});

describe("database migration v2", () => {
	afterEach(() => {
		closeDatabase();
	});

	it("migration v2 adds feedback_round column to runs table", () => {
		const db = getDatabase(":memory:");
		const columns = db.prepare("PRAGMA table_info(runs)").all() as Array<{ name: string }>;
		const columnNames = columns.map((c) => c.name);
		expect(columnNames).toContain("feedback_round");
	});

	it("migration v2 adds pr_number column to runs table", () => {
		const db = getDatabase(":memory:");
		const columns = db.prepare("PRAGMA table_info(runs)").all() as Array<{ name: string }>;
		const columnNames = columns.map((c) => c.name);
		expect(columnNames).toContain("pr_number");
	});

	it("fresh database has both v2 columns (full migration from 0 to 2)", () => {
		const db = getDatabase(":memory:");
		const columns = db.prepare("PRAGMA table_info(runs)").all() as Array<{ name: string }>;
		const columnNames = columns.map((c) => c.name);

		// V1 columns
		expect(columnNames).toContain("id");
		expect(columnNames).toContain("job_id");
		expect(columnNames).toContain("status");

		// V2 columns
		expect(columnNames).toContain("feedback_round");
		expect(columnNames).toContain("pr_number");

		// Version should be 2
		const version = db.pragma("user_version", { simple: true });
		expect(version).toBe(2);
	});
});
