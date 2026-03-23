import { executeRun } from "../../runner/orchestrator.js";
import type { ParsedCommand } from "../types.js";

/**
 * Trigger an immediate run of a job.
 * Equivalent to what the cron entry point does, but invoked manually.
 */
export async function runCommand(args: ParsedCommand["args"]): Promise<void> {
	const jobId = args.positional as string | undefined;
	if (!jobId) {
		console.error("Usage: claude-auto run <job-id>");
		process.exitCode = 1;
		return;
	}

	console.log(`Triggering run for job: ${jobId}`);
	const result = await executeRun(jobId);

	console.log(`Run complete: ${result.status}`);
	if (result.prUrl) {
		console.log(`PR: ${result.prUrl}`);
	}
	if (result.error) {
		console.error(`Error: ${result.error}`);
	}
}
