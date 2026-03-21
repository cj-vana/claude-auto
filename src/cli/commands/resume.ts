import { readJob, updateJob } from "../../core/job-manager.js";
import { getNextRuns } from "../../core/schedule.js";
import type { JobConfig } from "../../core/types.js";
import { createScheduler } from "../../platform/scheduler.js";
import type { ParsedCommand } from "../types.js";

/**
 * Resume a paused job: sets enabled=true and re-registers with scheduler.
 * Idempotent: resuming an already-active job prints a message and exits cleanly.
 */
export async function resumeCommand(args: ParsedCommand["args"]): Promise<void> {
	const jobId = args.jobId as string | undefined;
	if (!jobId) {
		console.error("Usage: claude-auto resume <job-id>");
		throw new Error("Missing required argument: job-id");
	}

	let config: JobConfig;
	try {
		config = await readJob(jobId);
	} catch (err: unknown) {
		if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
			console.error(`Job ${jobId} not found.`);
			throw err;
		}
		throw err;
	}

	if (config.enabled) {
		console.log(`Job ${jobId} is already active.`);
		return;
	}

	const updatedConfig = await updateJob(jobId, { enabled: true });

	const scheduler = await createScheduler();

	// Defensive: unregister first if already registered (shouldn't happen, but safe)
	if (await scheduler.isRegistered(jobId)) {
		await scheduler.unregister(jobId);
	}

	await scheduler.register(updatedConfig);

	const nextRuns = getNextRuns(config.schedule.cron, config.schedule.timezone, 1);
	const nextRunStr = nextRuns.length > 0 ? nextRuns[0].toLocaleString() : "unknown";

	console.log(`Job ${jobId} resumed. Next run: ${nextRunStr}`);
}
