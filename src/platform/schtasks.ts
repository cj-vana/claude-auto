import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CronExpressionParser } from "cron-parser";
import type { JobConfig } from "../core/types.js";
import { SchedulerError } from "../util/errors.js";
import { execCommand } from "../util/exec.js";
import type { RegisteredJob, Scheduler } from "./scheduler.js";

const TASK_PREFIX = "claude-auto-";

export interface SchtasksSchedule {
	args: string[];
	description: string;
}

const dayMap = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/**
 * Translate a 5-field cron expression into schtasks /SC schedule parameters.
 *
 * Supports:
 * - Every N minutes (e.g., *\/30 * * * *)
 * - Every N hours at minute M (e.g., 0 *\/6 * * *)
 * - Daily at specific time (e.g., 0 9 * * *)
 * - Specific days of week (e.g., 0 9 * * 1-5)
 * - Monthly on a single day (e.g., 0 9 15 * *)
 *
 * Throws SchedulerError for patterns that cannot be represented as a single
 * Windows Task Scheduler entry.
 */
export function cronToSchtasks(cronExpr: string): SchtasksSchedule {
	const interval = CronExpressionParser.parse(cronExpr);
	const fields = interval.fields;

	const minutes = [...fields.minute.values].map(Number);
	const hours = [...fields.hour.values].map(Number);
	const daysOfMonth = [...fields.dayOfMonth.values].map(Number);
	const months = [...fields.month.values].map(Number);
	const daysOfWeek = [...fields.dayOfWeek.values].map(Number);

	const isAllHours = hours.length === 24;
	const isAllDays = daysOfMonth.length === 31;
	const isAllMonths = months.length === 12;
	// cron-parser returns 0-7 for dayOfWeek (0 and 7 both mean Sunday)
	const isAllDow = daysOfWeek.length === 8;

	// Pattern: every N minutes (e.g., */30 * * * *)
	if (isAllHours && isAllDays && isAllMonths && isAllDow && minutes.length > 1) {
		const step = minutes[1] - minutes[0];
		const isEvenStep = minutes.every((m, i) => i === 0 || m - minutes[i - 1] === step);
		if (isEvenStep) {
			return {
				args: ["/sc", "MINUTE", "/mo", String(step)],
				description: `every ${step} minutes`,
			};
		}
	}

	// Pattern: every N hours at minute M (e.g., 0 */6 * * *)
	if (isAllDays && isAllMonths && isAllDow && minutes.length === 1 && hours.length > 1) {
		const step = hours[1] - hours[0];
		const isEvenStep = hours.every((h, i) => i === 0 || h - hours[i - 1] === step);
		if (isEvenStep) {
			const st = `${String(hours[0]).padStart(2, "0")}:${String(minutes[0]).padStart(2, "0")}`;
			return {
				args: ["/sc", "HOURLY", "/mo", String(step), "/st", st],
				description: `every ${step} hours starting at ${st}`,
			};
		}
	}

	// Pattern: daily at specific time (e.g., 0 9 * * *)
	if (isAllDays && isAllMonths && isAllDow && minutes.length === 1 && hours.length === 1) {
		const st = `${String(hours[0]).padStart(2, "0")}:${String(minutes[0]).padStart(2, "0")}`;
		return {
			args: ["/sc", "DAILY", "/st", st],
			description: `daily at ${st}`,
		};
	}

	// Pattern: specific days of week (e.g., 0 9 * * 1-5)
	if (isAllDays && isAllMonths && !isAllDow && minutes.length === 1 && hours.length === 1) {
		const days = daysOfWeek.filter((d) => d <= 6).map((d) => dayMap[d]);
		const st = `${String(hours[0]).padStart(2, "0")}:${String(minutes[0]).padStart(2, "0")}`;
		return {
			args: ["/sc", "WEEKLY", "/d", days.join(","), "/st", st],
			description: `weekly on ${days.join(",")} at ${st}`,
		};
	}

	// Pattern: specific day of month (e.g., 0 9 15 * *)
	if (
		!isAllDays &&
		isAllMonths &&
		isAllDow &&
		minutes.length === 1 &&
		hours.length === 1 &&
		daysOfMonth.length === 1
	) {
		const st = `${String(hours[0]).padStart(2, "0")}:${String(minutes[0]).padStart(2, "0")}`;
		return {
			args: ["/sc", "MONTHLY", "/d", String(daysOfMonth[0]), "/st", st],
			description: `monthly on day ${daysOfMonth[0]} at ${st}`,
		};
	}

	// Unsupported pattern
	throw new SchedulerError(
		"win32",
		`Cron expression "${cronExpr}" cannot be represented as a single Windows Task Scheduler entry. ` +
			"Simplify the schedule (e.g., daily at a specific time, every N minutes, or specific weekdays).",
	);
}

/**
 * Resolve the runner script path.
 * When bundled by tsup, this file lives in dist/ alongside claude-auto-run.js.
 * When running from source (src/platform/), navigate up to project root.
 */
function getRunnerPath(): string {
	try {
		const currentDir = dirname(fileURLToPath(import.meta.url));
		// Bundled: runner is a sibling in the same dist/ directory
		const siblingPath = join(currentDir, "claude-auto-run.js");
		if (existsSync(siblingPath)) {
			return siblingPath;
		}
		// Source: navigate from src/platform/ up to project root
		return join(currentDir, "..", "..", "dist", "claude-auto-run.js");
	} catch {
		return join(process.cwd(), "dist", "claude-auto-run.js");
	}
}

/**
 * SchtasksScheduler implements the Scheduler interface for Windows systems.
 * Uses `schtasks.exe` to create, query, and delete tasks in Windows Task Scheduler.
 *
 * Task name format: `claude-auto-{jobId}`
 */
export class SchtasksScheduler implements Scheduler {
	async register(job: JobConfig, _env?: Record<string, string>): Promise<void> {
		const registered = await this.isRegistered(job.id);
		if (registered) {
			throw new SchedulerError("win32", `Job "${job.id}" is already registered`);
		}

		const schedule = cronToSchtasks(job.schedule.cron);
		const runnerPath = getRunnerPath();
		const command = `"${process.execPath}" "${runnerPath}" --job-id ${job.id}`;
		const taskName = `${TASK_PREFIX}${job.id}`;

		const args = ["/create", "/tn", taskName, "/tr", command, ...schedule.args, "/f"];

		await execCommand("schtasks", args);
	}

	async unregister(jobId: string): Promise<void> {
		const taskName = `${TASK_PREFIX}${jobId}`;
		try {
			await execCommand("schtasks", ["/delete", "/tn", taskName, "/f"]);
		} catch {
			// Task may not exist -- continue gracefully (same pattern as launchd bootout)
		}
	}

	async isRegistered(jobId: string): Promise<boolean> {
		const taskName = `${TASK_PREFIX}${jobId}`;
		try {
			await execCommand("schtasks", ["/query", "/tn", taskName, "/fo", "CSV", "/nh"]);
			return true;
		} catch {
			return false;
		}
	}

	async list(): Promise<RegisteredJob[]> {
		const jobs: RegisteredJob[] = [];
		try {
			const { stdout } = await execCommand("schtasks", ["/query", "/fo", "CSV", "/nh"]);
			const lines = stdout.split("\n").filter((line) => line.includes(TASK_PREFIX));

			for (const line of lines) {
				try {
					// CSV format: "TaskName","Next Run Time","Status"
					// Task names may include path prefix like \claude-auto-jobId
					const match = line.match(/claude-auto-([^"]+)/);
					if (match) {
						const jobId = match[1];
						// Extract schedule and status from CSV fields
						const fields = line.split('","');
						const schedule = fields.length > 1 ? fields[1] : "";
						const command = fields.length > 2 ? fields[2]?.replace(/"/g, "") : "";

						jobs.push({
							jobId,
							schedule,
							command,
						});
					}
				} catch {
					// Skip malformed lines
				}
			}
		} catch {
			// No tasks found or schtasks not available
		}
		return jobs;
	}
}
