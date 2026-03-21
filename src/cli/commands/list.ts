import { listJobs } from "../../core/job-manager.js";
import { describeSchedule, getNextRuns } from "../../core/schedule.js";
import { listRunLogs } from "../../runner/logger.js";
import { formatRelativeTime, formatTable } from "../format.js";
import type { ParsedCommand } from "../types.js";

/**
 * Truncate a path to its last N segments for compact display.
 */
function truncatePath(fullPath: string, segments = 2): string {
	const parts = fullPath.split("/").filter(Boolean);
	if (parts.length <= segments) {
		return fullPath;
	}
	return parts.slice(-segments).join("/");
}

/**
 * List all configured jobs with enriched status info:
 * ID, Name, Status, Repo, Schedule, Last Run, Next Run.
 *
 * Satisfies JOB-01 (list with status/schedule/last run/next run)
 * and JOB-05 (multiple jobs visible as separate entries).
 */
export async function listCommand(_args: ParsedCommand["args"]): Promise<void> {
	const jobs = await listJobs();

	if (jobs.length === 0) {
		console.log("No jobs configured.");
		return;
	}

	const rows: string[][] = [];

	for (const job of jobs) {
		const status = job.enabled ? "active" : "paused";
		const schedule = describeSchedule(job.schedule.cron);

		// Last run
		const logs = await listRunLogs(job.id);
		const lastRun = logs.length > 0 ? formatRelativeTime(new Date(logs[0].startedAt)) : "never";

		// Next run
		let nextRun: string;
		if (!job.enabled) {
			nextRun = "--";
		} else {
			const nextRuns = getNextRuns(job.schedule.cron, job.schedule.timezone, 1);
			nextRun = nextRuns.length > 0 ? formatRelativeTime(nextRuns[0]) : "--";
		}

		rows.push([job.id, job.name, status, truncatePath(job.repo.path), schedule, lastRun, nextRun]);
	}

	const headers = ["ID", "Name", "Status", "Repo", "Schedule", "Last Run", "Next Run"];
	console.log(formatTable(headers, rows));
}
