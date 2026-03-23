import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { JobConfig } from "../core/types.js";
import { SchedulerError } from "../util/errors.js";
import { execCommand } from "../util/exec.js";
import { paths } from "../util/paths.js";
import type { RegisteredJob, Scheduler } from "./scheduler.js";

const MARKER_PREFIX = "# claude-auto:";

/**
 * Build a crontab entry block for a claude-auto job.
 *
 * Format:
 *   # claude-auto:{jobId}
 *   CRON_TZ={timezone}        (only if timezone !== "UTC")
 *   {cronExpr} {command} >> {logPath} 2>&1
 */
export function buildEntryBlock(
	jobId: string,
	cronExpr: string,
	command: string,
	timezone?: string,
): string {
	const logPath = `${paths.jobLogs(jobId)}/cron.log`;
	const lines: string[] = [`${MARKER_PREFIX}${jobId}`];
	if (timezone && timezone !== "UTC") {
		lines.push(`CRON_TZ=${timezone}`);
	}
	lines.push(`${cronExpr} ${command} >> ${logPath} 2>&1`);
	return lines.join("\n");
}

/**
 * Read the current user's crontab. Returns empty string if none exists.
 */
async function readCrontab(): Promise<string> {
	try {
		const { stdout } = await execCommand("crontab", ["-l"]);
		return stdout;
	} catch (error: unknown) {
		// "no crontab for user" is not an error for our purposes
		const msg = error instanceof Error ? error.message : String(error);
		if (msg.includes("no crontab")) {
			return "";
		}
		throw error;
	}
}

/**
 * Write the full crontab content via stdin to `crontab -`.
 */
async function writeCrontab(content: string): Promise<void> {
	await execCommand("crontab", ["-"], { stdin: content });
}

/**
 * Resolve the runner script path. For now, compute relative to this module.
 */
function getRunnerPath(): string {
	try {
		const currentDir = dirname(fileURLToPath(import.meta.url));
		return join(currentDir, "..", "..", "dist", "claude-auto-run.js");
	} catch {
		// Fallback for test/bundle environments
		return join(process.cwd(), "dist", "claude-auto-run.js");
	}
}

/**
 * CrontabScheduler implements the Scheduler interface for Linux systems.
 * Uses comment-tagged crontab entries for identification and CRUD.
 */
export class CrontabScheduler implements Scheduler {
	async register(job: JobConfig, _env?: Record<string, string>): Promise<void> {
		const registered = await this.isRegistered(job.id);
		if (registered) {
			throw new SchedulerError("crontab", `Job "${job.id}" is already registered`);
		}

		const current = await readCrontab();

		const runnerPath = getRunnerPath();
		const command = `${process.execPath} ${runnerPath} --job-id ${job.id}`;
		const block = buildEntryBlock(job.id, job.schedule.cron, command, job.schedule.timezone);

		const updated = `${current.trimEnd()}\n${block}\n`;
		await writeCrontab(updated);
	}

	async unregister(jobId: string): Promise<void> {
		const current = await readCrontab();
		const lines = current.split("\n");
		const marker = `${MARKER_PREFIX}${jobId}`;

		const filtered: string[] = [];
		let skipping = false;

		for (const line of lines) {
			if (line.trim() === marker) {
				skipping = true;
				continue;
			}
			if (
				skipping &&
				(line.startsWith("CRON_TZ=") || (!line.startsWith("#") && line.trim() !== ""))
			) {
				continue;
			}
			skipping = false;
			filtered.push(line);
		}

		await writeCrontab(filtered.join("\n"));
	}

	async isRegistered(jobId: string): Promise<boolean> {
		const content = await readCrontab();
		return content.includes(`${MARKER_PREFIX}${jobId}`);
	}

	async list(): Promise<RegisteredJob[]> {
		const content = await readCrontab();
		const lines = content.split("\n");
		const jobs: RegisteredJob[] = [];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (line.startsWith(MARKER_PREFIX)) {
				const jobId = line.slice(MARKER_PREFIX.length).trim();

				// Look ahead: skip optional CRON_TZ line, then find the cron entry
				let entryLine = "";
				let nextIdx = i + 1;

				if (nextIdx < lines.length && lines[nextIdx].startsWith("CRON_TZ=")) {
					nextIdx++;
				}

				if (nextIdx < lines.length) {
					entryLine = lines[nextIdx];
				}

				if (entryLine.trim()) {
					// Parse the cron fields (first 5 space-separated fields) and the command (rest)
					const parts = entryLine.trim().split(/\s+/);
					if (parts.length >= 6) {
						const schedule = parts.slice(0, 5).join(" ");
						const command = parts.slice(5).join(" ");
						jobs.push({ jobId, schedule, command });
					}
				}
			}
		}

		return jobs;
	}
}
