import { cp, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { readJob, deleteJob } from "../../core/job-manager.js";
import { createScheduler } from "../../platform/scheduler.js";
import { paths } from "../../util/paths.js";
import type { ParsedCommand } from "../types.js";

/**
 * Remove a job: unregisters from scheduler and deletes job directory.
 * With --keep-logs: archives run logs before deleting.
 */
export async function removeCommand(args: ParsedCommand["args"]): Promise<void> {
	const jobId = args.jobId as string | undefined;
	if (!jobId) {
		console.error("Usage: claude-auto remove <job-id> [--keep-logs]");
		throw new Error("Missing required argument: job-id");
	}

	try {
		await readJob(jobId);
	} catch (err: unknown) {
		if (
			err instanceof Error &&
			"code" in err &&
			(err as NodeJS.ErrnoException).code === "ENOENT"
		) {
			console.error(`Job ${jobId} not found.`);
			throw err;
		}
		throw err;
	}

	// Best-effort unregister from scheduler
	try {
		const scheduler = await createScheduler();
		await scheduler.unregister(jobId);
	} catch {
		// Scheduler entry may already be missing -- best-effort
	}

	let archivePath: string | undefined;
	if (args.keepLogs) {
		// Archive run logs before deleting
		const logsDir = paths.jobLogs(jobId);
		archivePath = join(paths.base, "archived-logs", jobId);
		try {
			await mkdir(archivePath, { recursive: true });
			await cp(logsDir, archivePath, { recursive: true });
		} catch {
			// If logs dir doesn't exist, nothing to archive
			archivePath = undefined;
		}
	}

	await deleteJob(jobId);

	if (archivePath) {
		console.log(`Job ${jobId} removed. Run logs archived to ${archivePath}.`);
	} else {
		console.log(`Job ${jobId} removed.`);
	}
}
