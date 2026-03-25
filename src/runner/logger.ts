import { readdir, readFile } from "node:fs/promises";
import { writeFileSafe } from "../util/fs.js";
import { paths } from "../util/paths.js";
import { saveRunContext } from "./context-store.js";
import type { RunLogEntry } from "./types.js";

/**
 * Write a run log entry as a JSON file for a specific job run.
 * Creates the runs directory if it doesn't exist (via writeFileSafe).
 *
 * @param jobId - The job identifier
 * @param entry - The run log entry to write
 */
export async function writeRunLog(jobId: string, entry: RunLogEntry): Promise<void> {
	const logPath = paths.jobLog(jobId, entry.runId);
	await writeFileSafe(logPath, JSON.stringify(entry, null, 2));

	// Dual-write: persist to SQLite for cross-run context queries (CTXT-01, COST-01).
	// Best-effort -- never fail the run due to DB issues.
	try {
		saveRunContext(entry);
	} catch {
		// SQLite write is best-effort
	}
}

/**
 * Read and parse a specific run log entry.
 *
 * @param jobId - The job identifier
 * @param runId - The run identifier
 * @returns Parsed RunLogEntry
 * @throws When the log file doesn't exist (ENOENT)
 */
export async function readRunLog(jobId: string, runId: string): Promise<RunLogEntry> {
	const logPath = paths.jobLog(jobId, runId);
	const content = await readFile(logPath, "utf-8");
	try {
		return JSON.parse(content) as RunLogEntry;
	} catch (cause) {
		throw new Error(`Failed to parse run log ${logPath} as JSON: ${content.slice(0, 200)}`, {
			cause,
		});
	}
}

/**
 * List all run logs for a job, sorted by startedAt descending (newest first).
 * Returns an empty array when the runs directory doesn't exist.
 * Skips files that fail to parse (logs warning but doesn't throw).
 *
 * @param jobId - The job identifier
 * @returns Array of RunLogEntry sorted by startedAt descending
 */
export async function listRunLogs(jobId: string): Promise<RunLogEntry[]> {
	const logsDir = paths.jobLogs(jobId);

	let files: string[];
	try {
		files = (await readdir(logsDir)) as string[];
	} catch (err: unknown) {
		if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
			return [];
		}
		throw err;
	}

	const logFiles = files.filter((f) => f.endsWith(".log"));
	const entries: RunLogEntry[] = [];

	for (const file of logFiles) {
		try {
			const filePath = paths.jobLog(jobId, file.replace(/\.log$/, ""));
			const content = await readFile(filePath, "utf-8");
			entries.push(JSON.parse(content) as RunLogEntry);
		} catch {
			// Skip files that fail to parse
		}
	}

	// Sort by startedAt descending (newest first)
	entries.sort((a, b) => {
		const aTime = new Date(a.startedAt).getTime();
		const bTime = new Date(b.startedAt).getTime();
		return bTime - aTime;
	});

	return entries;
}
