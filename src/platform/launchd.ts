import { access, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CronExpressionParser } from "cron-parser";
import plist from "plist";
import type { JobConfig } from "../core/types.js";
import { SchedulerError } from "../util/errors.js";
import { execCommand } from "../util/exec.js";
import { paths } from "../util/paths.js";
import type { RegisteredJob, Scheduler } from "./scheduler.js";

export interface CalendarInterval {
	Month?: number;
	Day?: number;
	Weekday?: number;
	Hour?: number;
	Minute?: number;
}

const LABEL_PREFIX = "com.claude-auto.";

function getLabel(jobId: string): string {
	return `${LABEL_PREFIX}${jobId}`;
}

function getUid(): number {
	return process.getuid?.() ?? 501;
}

/**
 * Resolve the runner script path relative to this module.
 */
function getRunnerPath(): string {
	try {
		const currentDir = dirname(fileURLToPath(import.meta.url));
		return join(currentDir, "..", "..", "dist", "runner.js");
	} catch {
		return join(process.cwd(), "dist", "runner.js");
	}
}

/**
 * Convert a 5-field cron expression to launchd scheduling config.
 *
 * For high-frequency "every N minutes" patterns, returns { startInterval: seconds }.
 * For specific times, returns { calendarIntervals: CalendarInterval[] }.
 *
 * Throws if the expression would produce more than 50 calendar intervals.
 */
export function cronToCalendarIntervals(cronExpr: string): {
	calendarIntervals?: CalendarInterval[];
	startInterval?: number;
} {
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
	// cron-parser returns 0-7 for dayOfWeek (8 values since 0 and 7 both mean Sunday)
	const isAllDow = daysOfWeek.length === 8;

	// Detect "every N minutes" pattern: hours/days/months/dow all wildcard, minutes have even spacing
	if (isAllHours && isAllDays && isAllMonths && isAllDow && minutes.length > 1) {
		const step = minutes[1] - minutes[0];
		const isEvenStep = minutes.every((m, i) => i === 0 || m - minutes[i - 1] === step);
		if (isEvenStep) {
			return { startInterval: step * 60 };
		}
	}

	// Build calendar interval combinations
	const intervals: CalendarInterval[] = [];
	const effectiveHours = isAllHours ? [undefined] : hours;
	// Filter out duplicate Sunday (7) -- launchd uses 0 for Sunday
	const effectiveDow = isAllDow ? [undefined] : daysOfWeek.filter((d) => d <= 6);
	const effectiveDom = isAllDays ? [undefined] : daysOfMonth;

	for (const minute of minutes) {
		for (const hour of effectiveHours) {
			for (const dow of effectiveDow) {
				for (const dom of effectiveDom) {
					const entry: CalendarInterval = { Minute: minute };
					if (hour !== undefined) entry.Hour = hour;
					if (dow !== undefined) entry.Weekday = dow;
					if (dom !== undefined) entry.Day = dom;
					intervals.push(entry);
				}
			}
		}
	}

	if (intervals.length > 50) {
		throw new Error(
			`Cron expression "${cronExpr}" would produce ${intervals.length} calendar intervals. ` +
				"launchd StartCalendarInterval is not efficient for complex schedules. " +
				"Simplify the schedule or use a simpler pattern.",
		);
	}

	return { calendarIntervals: intervals };
}

/**
 * LaunchdScheduler implements the Scheduler interface for macOS.
 * Uses plist files in ~/Library/LaunchAgents/ and modern launchctl bootstrap/bootout.
 */
export class LaunchdScheduler implements Scheduler {
	async register(job: JobConfig, env?: Record<string, string>): Promise<void> {
		const registered = await this.isRegistered(job.id);
		if (registered) {
			throw new SchedulerError("launchd", `Job "${job.id}" is already registered`);
		}

		const scheduling = cronToCalendarIntervals(job.schedule.cron);
		const runnerPath = getRunnerPath();
		const logPath = `${paths.jobLogs(job.id)}/launchd.log`;
		const plistPath = paths.plistPath(job.id);

		const obj: Record<string, unknown> = {
			Label: getLabel(job.id),
			ProgramArguments: [process.execPath, runnerPath, "--job-id", job.id],
			StandardOutPath: logPath,
			StandardErrorPath: logPath,
			EnvironmentVariables: {
				PATH: env?.PATH ?? process.env.PATH ?? "",
				HOME: env?.HOME ?? homedir(),
				...(env
					? Object.fromEntries(Object.entries(env).filter(([k]) => k !== "PATH" && k !== "HOME"))
					: {}),
			},
			RunAtLoad: false,
			KeepAlive: false,
		};

		if (scheduling.startInterval !== undefined) {
			obj.StartInterval = scheduling.startInterval;
		} else if (scheduling.calendarIntervals) {
			obj.StartCalendarInterval =
				scheduling.calendarIntervals.length === 1
					? scheduling.calendarIntervals[0]
					: scheduling.calendarIntervals;
		}

		const xml = plist.build(obj as unknown as plist.PlistValue);
		await writeFile(plistPath, xml, "utf-8");

		const uid = getUid();
		await execCommand("launchctl", ["bootstrap", `gui/${uid}`, plistPath]);
	}

	async unregister(jobId: string): Promise<void> {
		const uid = getUid();
		const label = getLabel(jobId);
		const plistPath = paths.plistPath(jobId);

		try {
			await execCommand("launchctl", ["bootout", `gui/${uid}/${label}`]);
		} catch {
			// Service may already be unloaded -- continue to delete plist
		}

		try {
			await unlink(plistPath);
		} catch {
			// Plist may already be deleted
		}
	}

	async isRegistered(jobId: string): Promise<boolean> {
		try {
			await access(paths.plistPath(jobId));
			return true;
		} catch {
			return false;
		}
	}

	async list(): Promise<RegisteredJob[]> {
		const jobs: RegisteredJob[] = [];
		try {
			const files = await readdir(paths.plistDir);
			const plistFiles = files.filter((f) => f.startsWith(LABEL_PREFIX) && f.endsWith(".plist"));

			for (const file of plistFiles) {
				try {
					const filePath = join(paths.plistDir, file);
					const content = await readFile(filePath, "utf-8");
					const parsed = plist.parse(content) as Record<string, unknown>;
					const label = parsed.Label as string;
					const jobId = label.replace(LABEL_PREFIX, "");
					const progArgs = (parsed.ProgramArguments as string[]) ?? [];

					let schedule = "";
					if (parsed.StartInterval) {
						schedule = `every ${parsed.StartInterval}s`;
					} else if (parsed.StartCalendarInterval) {
						schedule = "calendar";
					}

					jobs.push({
						jobId,
						schedule,
						command: progArgs.join(" "),
					});
				} catch {
					// Skip malformed plists
				}
			}
		} catch {
			// Directory may not exist
		}
		return jobs;
	}
}
