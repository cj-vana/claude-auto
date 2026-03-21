import { readJob, updateJob } from "../../core/job-manager.js";
import { createScheduler } from "../../platform/scheduler.js";
import type { ParsedCommand } from "../types.js";

/**
 * Pause a running job: sets enabled=false and unregisters from scheduler.
 * Idempotent: pausing an already-paused job prints a message and exits cleanly.
 */
export async function pauseCommand(args: ParsedCommand["args"]): Promise<void> {
	const jobId = args.jobId as string | undefined;
	if (!jobId) {
		console.error("Usage: claude-auto pause <job-id>");
		throw new Error("Missing required argument: job-id");
	}

	let config;
	try {
		config = await readJob(jobId);
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

	if (!config.enabled) {
		console.log(`Job ${jobId} is already paused.`);
		return;
	}

	await updateJob(jobId, { enabled: false });

	// Best-effort unregister from scheduler
	try {
		const scheduler = await createScheduler();
		await scheduler.unregister(jobId);
	} catch {
		// Scheduler entry may already be missing -- best-effort
	}

	console.log(
		`Job ${jobId} paused. Configuration preserved -- resume with: claude-auto resume ${jobId}`,
	);
}
