import { listRunLogs } from "../../runner/logger.js";
import { formatDuration, formatRelativeTime, formatTable } from "../format.js";
import type { ParsedCommand } from "../types.js";

/**
 * Show recent run history for a specific job.
 * Displays a table of: Run ID, Status, Started, Duration, PR URL, Error.
 */
export async function logsCommand(args: ParsedCommand["args"]): Promise<void> {
	const jobId = args.jobId as string | undefined;

	if (!jobId) {
		console.error("Usage: claude-auto logs <job-id> [--limit N]");
		process.exitCode = 1;
		return;
	}

	const limit = typeof args.limit === "number" ? args.limit : 10;
	const logs = await listRunLogs(jobId);
	const sliced = logs.slice(0, limit);

	if (sliced.length === 0) {
		console.log(`No runs found for job ${jobId}.`);
		return;
	}

	const rows: string[][] = sliced.map((entry) => {
		const started = formatRelativeTime(new Date(entry.startedAt));
		const duration = formatDuration(entry.durationMs);
		const prUrl = entry.prUrl || "--";
		const error = entry.error
			? entry.error.length > 50
				? `${entry.error.slice(0, 47)}...`
				: entry.error
			: "--";
		return [entry.runId, entry.status, started, duration, prUrl, error];
	});

	const headers = ["Run ID", "Status", "Started", "Duration", "PR URL", "Error"];
	console.log(formatTable(headers, rows));
}
