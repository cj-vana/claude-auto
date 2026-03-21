import Database from "better-sqlite3";
import { paths } from "../util/paths.js";

let db: Database.Database | null = null;

/**
 * Get or create the SQLite database singleton.
 * On first call, opens the database, sets pragmas (WAL mode, synchronous=normal,
 * foreign_keys=ON), and runs schema migrations.
 *
 * @param dbPath - Optional path override for testing (e.g., ":memory:")
 * @returns The singleton Database instance
 */
export function getDatabase(dbPath?: string): Database.Database {
	if (!db) {
		db = new Database(dbPath ?? paths.database);
		db.pragma("journal_mode = WAL");
		db.pragma("synchronous = normal");
		db.pragma("foreign_keys = ON");
		migrateSchema(db);
	}
	return db;
}

/**
 * Run schema migrations based on the user_version pragma.
 * Each migration block increments user_version atomically.
 */
function migrateSchema(database: Database.Database): void {
	const version = database.pragma("user_version", { simple: true }) as number;

	if (version < 1) {
		database.exec(`
			CREATE TABLE IF NOT EXISTS runs (
				id TEXT PRIMARY KEY,
				job_id TEXT NOT NULL,
				status TEXT NOT NULL,
				started_at TEXT NOT NULL,
				completed_at TEXT NOT NULL,
				duration_ms INTEGER NOT NULL DEFAULT 0,
				cost_usd REAL,
				num_turns INTEGER,
				session_id TEXT,
				model TEXT,
				pr_url TEXT,
				branch_name TEXT,
				issue_number INTEGER,
				summary TEXT,
				error TEXT,
				created_at TEXT NOT NULL DEFAULT (datetime('now'))
			);
			CREATE INDEX IF NOT EXISTS idx_runs_job_id ON runs(job_id);
			CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs(started_at);
			CREATE INDEX IF NOT EXISTS idx_runs_job_started ON runs(job_id, started_at);
		`);
		database.pragma("user_version = 1");
	}

	if (version < 2) {
		database.exec(`
			ALTER TABLE runs ADD COLUMN feedback_round INTEGER;
			ALTER TABLE runs ADD COLUMN pr_number INTEGER;
		`);
		database.pragma("user_version = 2");
	}
}

/**
 * Close the database connection and reset the singleton.
 * Safe to call multiple times. After calling, the next getDatabase()
 * call will open a fresh connection.
 */
export function closeDatabase(): void {
	if (db) {
		db.close();
		db = null;
	}
}
