#!/usr/bin/env node
import { parseArgs } from "node:util";
import { executeRun } from "../src/runner/orchestrator.js";

const { values } = parseArgs({
	options: {
		"job-id": { type: "string" },
	},
	strict: true,
});

if (!values["job-id"]) {
	console.error("Usage: claude-auto-run --job-id <id>");
	process.exit(1);
}

try {
	const result = await executeRun(values["job-id"]);

	// Log result summary to stdout for cron log capture
	console.log(
		JSON.stringify({
			status: result.status,
			jobId: result.jobId,
			runId: result.runId,
			durationMs: result.durationMs,
			prUrl: result.prUrl,
			error: result.error,
		}),
	);

	process.exit(result.status === "error" || result.status === "git-error" ? 1 : 0);
} catch (error) {
	console.error("Fatal error:", error instanceof Error ? error.message : String(error));
	process.exit(2);
}
