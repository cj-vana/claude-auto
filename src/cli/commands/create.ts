import { readFile, stat } from "node:fs/promises";
import { createJob } from "../../core/job-manager.js";
import { describeSchedule, getNextRuns, validateCronExpression } from "../../core/schedule.js";
import type { JobConfig } from "../../core/types.js";
import { createScheduler } from "../../platform/scheduler.js";
import { execCommand } from "../../util/exec.js";
import type { ParsedCommand } from "../types.js";

/**
 * Ensure that the repository path exists and is a git repo.
 * If the path does not exist and a GitHub repo is provided, clone it via gh.
 */
async function ensureRepoExists(repoPath: string, githubRepo?: string): Promise<void> {
	try {
		const s = await stat(repoPath);
		if (!s.isDirectory()) {
			throw new Error(`${repoPath} exists but is not a directory`);
		}
		// Verify it's a git repo
		await execCommand("git", ["-C", repoPath, "rev-parse", "--git-dir"]);
	} catch (err: unknown) {
		if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
			if (!githubRepo) {
				throw new Error(
					`Repository path ${repoPath} does not exist. Provide --github-repo <owner/repo> to clone automatically.`,
				);
			}
			console.log(`Cloning ${githubRepo} to ${repoPath}...`);
			await execCommand("gh", ["repo", "clone", githubRepo, repoPath]);
			return;
		}
		throw err;
	}
}

/**
 * Create a new autonomous cron job. Validates all inputs, optionally clones the repo,
 * creates the job config, and registers with the system scheduler.
 */
export async function createCommand(args: ParsedCommand["args"]): Promise<void> {
	const name = args.name as string | undefined;
	const repoPath = args.repo as string | undefined;
	const schedule = args.schedule as string | undefined;

	if (!name || !repoPath || !schedule) {
		console.error(
			"Usage: claude-auto create --name <name> --repo <path> --schedule <cron> [options]",
		);
		throw new Error("Missing required arguments: --name, --repo, and --schedule are required");
	}

	// Extract optional args with defaults
	const branch = (args.branch as string) ?? "main";
	const timezone = (args.timezone as string) ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
	const focusStr = (args.focus as string) ?? "open-issues,bug-discovery";

	// Validate cron expression (throws CronValidationError if invalid)
	validateCronExpression(schedule);

	// Ensure repo exists (optionally clone)
	await ensureRepoExists(repoPath, args.githubRepo as string | undefined);

	// Read system prompt from file if provided
	let systemPrompt: string | undefined;
	if (args.systemPromptFile) {
		systemPrompt = await readFile(args.systemPromptFile as string, "utf-8");
	}

	// Parse and validate focus areas (match edit command validation)
	const validFocusAreas = new Set(["open-issues", "bug-discovery", "features", "documentation"]);
	const focusItems = focusStr.split(",").map((s) => s.trim());
	const invalidFocus = focusItems.filter((f) => !validFocusAreas.has(f));
	if (invalidFocus.length > 0) {
		console.error(
			`Invalid focus area(s): ${invalidFocus.join(", ")}. Valid: ${[...validFocusAreas].join(", ")}`,
		);
		throw new Error(`Invalid focus area(s): ${invalidFocus.join(", ")}`);
	}
	const focus = focusItems as JobConfig["focus"];

	// Parse guardrails with NaN validation (match edit command validation)
	const maxTurns = args.maxTurns ? Number(args.maxTurns) : 50;
	if (Number.isNaN(maxTurns) || maxTurns <= 0) {
		console.error("Invalid --max-turns: must be a positive integer");
		throw new Error("Invalid --max-turns: must be a positive integer");
	}
	const maxBudgetUsd = args.maxBudget ? Number(args.maxBudget) : 5.0;
	if (Number.isNaN(maxBudgetUsd) || maxBudgetUsd <= 0) {
		console.error("Invalid --max-budget: must be a positive number");
		throw new Error("Invalid --max-budget: must be a positive number");
	}
	const noNewDependencies = Boolean(args.noNewDeps);
	const noArchitectureChanges = Boolean(args.noArchChanges);
	const bugFixOnly = Boolean(args.bugFixOnly);
	const restrictToPaths = args.restrictPaths
		? String(args.restrictPaths)
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean)
		: undefined;

	// Parse notifications (provide default trigger values matching Zod schema defaults)
	const defaultTriggers = { onSuccess: true, onFailure: true, onNoChanges: false, onLocked: false };
	const notifications: JobConfig["notifications"] = {};
	if (args.notifyDiscord) {
		notifications.discord = { webhookUrl: args.notifyDiscord as string, ...defaultTriggers };
	}
	if (args.notifySlack) {
		notifications.slack = { webhookUrl: args.notifySlack as string, ...defaultTriggers };
	}
	if (args.notifyTelegram) {
		const telegramStr = args.notifyTelegram as string;
		const colonIndex = telegramStr.lastIndexOf(":");
		if (colonIndex > 0) {
			notifications.telegram = {
				botToken: telegramStr.slice(0, colonIndex),
				chatId: telegramStr.slice(colonIndex + 1),
				...defaultTriggers,
			};
		}
	}

	// Build job input
	const input: Omit<JobConfig, "id"> = {
		name,
		repo: { path: repoPath, branch, remote: "origin" },
		schedule: { cron: schedule, timezone },
		focus,
		systemPrompt,
		guardrails: {
			maxTurns,
			maxBudgetUsd,
			noNewDependencies,
			noArchitectureChanges,
			bugFixOnly,
			restrictToPaths,
		},
		notifications,
		enabled: true,
	};

	// Create job config on disk
	const config = await createJob(input);

	// Register with system scheduler
	const scheduler = await createScheduler();
	await scheduler.register(config);

	// Print confirmation
	const description = describeSchedule(schedule);
	const nextRuns = getNextRuns(schedule, timezone, 3)
		.map((d) => d.toLocaleString())
		.join(", ");

	console.log(`Job created: ${config.id}`);
	console.log(`Schedule: ${description}`);
	console.log(`Next runs: ${nextRuns}`);
	console.log(`Config: ~/.claude-auto/jobs/${config.id}/config.yaml`);
}
