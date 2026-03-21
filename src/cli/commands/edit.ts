import { readJob, updateJob } from "../../core/job-manager.js";
import { describeSchedule, getNextRuns, validateCronExpression } from "../../core/schedule.js";
import type { JobConfig } from "../../core/types.js";
import { createScheduler } from "../../platform/scheduler.js";
import type { ParsedCommand } from "../types.js";

/**
 * Edit a job's configuration fields. Re-validates and re-registers with scheduler
 * if schedule or timezone changes. Supports multiple flags in one invocation.
 */
export async function editCommand(args: ParsedCommand["args"]): Promise<void> {
	const jobId = args.jobId as string | undefined;
	if (!jobId) {
		console.error(
			"Usage: claude-auto edit <job-id> --name <value> [--schedule <cron>] [--timezone <tz>] [--branch <branch>] [--max-turns <n>] [--max-budget <n>] [--focus <csv>]",
		);
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

	const updates: Record<string, unknown> = {};
	let scheduleChanged = false;
	const confirmations: string[] = [];

	// --name
	if (args.name !== undefined) {
		updates.name = args.name;
		confirmations.push(`name -> ${args.name}`);
	}

	// --schedule
	if (args.schedule !== undefined) {
		const cronExpr = String(args.schedule);
		try {
			validateCronExpression(cronExpr);
		} catch (err) {
			console.error(`Invalid schedule: ${err instanceof Error ? err.message : String(err)}`);
			return;
		}
		updates.schedule = { ...config.schedule, cron: cronExpr };
		scheduleChanged = true;
		confirmations.push(`schedule -> ${cronExpr}`);
	}

	// --timezone
	if (args.timezone !== undefined) {
		const currentSchedule = (updates.schedule as typeof config.schedule) ?? { ...config.schedule };
		updates.schedule = { ...currentSchedule, timezone: String(args.timezone) };
		scheduleChanged = true;
		confirmations.push(`timezone -> ${args.timezone}`);
	}

	// --branch
	if (args.branch !== undefined) {
		updates.repo = { ...config.repo, branch: String(args.branch) };
		confirmations.push(`branch -> ${args.branch}`);
	}

	// --max-turns
	if (args.maxTurns !== undefined) {
		const n = Number.parseInt(String(args.maxTurns), 10);
		if (Number.isNaN(n) || n <= 0) {
			console.error("Invalid --max-turns: must be a positive integer");
			return;
		}
		updates.guardrails = { ...config.guardrails, maxTurns: n };
		confirmations.push(`maxTurns -> ${n}`);
	}

	// --max-budget
	if (args.maxBudget !== undefined) {
		const n = Number.parseFloat(String(args.maxBudget));
		if (Number.isNaN(n) || n <= 0) {
			console.error("Invalid --max-budget: must be a positive number");
			return;
		}
		updates.guardrails = {
			...(updates.guardrails ?? config.guardrails),
			maxBudgetUsd: n,
		};
		confirmations.push(`maxBudgetUsd -> ${n}`);
	}

	// --focus
	if (args.focus !== undefined) {
		const validFocusAreas = new Set(["open-issues", "bug-discovery", "features", "documentation"]);
		const focusItems = String(args.focus)
			.split(",")
			.map((s) => s.trim());
		const invalid = focusItems.filter((f) => !validFocusAreas.has(f));
		if (invalid.length > 0) {
			console.error(
				`Invalid focus area(s): ${invalid.join(", ")}. Valid: ${[...validFocusAreas].join(", ")}`,
			);
			return;
		}
		updates.focus = focusItems;
		confirmations.push(`focus -> ${focusItems.join(", ")}`);
	}

	// If no edit flags provided, show current config
	if (confirmations.length === 0) {
		console.log(`Job ${jobId} - ${config.name}`);
		console.log(`  Schedule: ${config.schedule.cron} (${config.schedule.timezone})`);
		console.log(`  Repo: ${config.repo.path} (${config.repo.branch})`);
		console.log(`  Focus: ${config.focus.join(", ")}`);
		console.log(`  Max turns: ${config.guardrails.maxTurns}`);
		console.log(`  Max budget: $${config.guardrails.maxBudgetUsd}`);
		console.log(`  Status: ${config.enabled ? "active" : "paused"}`);
		console.log(
			"\nUsage: claude-auto edit <job-id> --name <value> [--schedule <cron>] [--timezone <tz>] [--branch <branch>] [--max-turns <n>] [--max-budget <n>] [--focus <csv>]",
		);
		return;
	}

	const updatedConfig = await updateJob(jobId, updates as Parameters<typeof updateJob>[1]);

	// Re-register with scheduler if schedule changed and job is enabled
	if (scheduleChanged && config.enabled) {
		const scheduler = await createScheduler();
		try {
			await scheduler.unregister(jobId);
		} catch {
			// Best-effort unregister
		}
		await scheduler.register(updatedConfig);

		const scheduleObj = updatedConfig.schedule;
		const description = describeSchedule(scheduleObj.cron);
		const nextRuns = getNextRuns(scheduleObj.cron, scheduleObj.timezone, 1);
		const nextRunStr = nextRuns.length > 0 ? nextRuns[0].toLocaleString() : "unknown";
		console.log(`Updated job ${jobId}: ${confirmations.join(", ")}`);
		console.log(`Schedule updated to: ${description}. Next run: ${nextRunStr}`);
	} else {
		console.log(`Updated job ${jobId}: ${confirmations.join(", ")}`);
	}
}
