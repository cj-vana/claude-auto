import { type CliCommand, COMMANDS, type ParsedCommand } from "./types.js";

const VALID_COMMANDS = new Set<string>(Object.keys(COMMANDS));

/**
 * Parse CLI argv (process.argv.slice(2)) into a structured command.
 * Extracts the subcommand from argv[0], then parses remaining args.
 */
export function parseCommand(argv: string[]): ParsedCommand {
	if (argv.length === 0) {
		return { command: "help", args: {} };
	}

	const [subcommand, ...rest] = argv;

	if (!VALID_COMMANDS.has(subcommand)) {
		console.error(`Unknown command: ${subcommand}`);
		return { command: "help", args: {} };
	}

	const command = subcommand as CliCommand;
	const args: Record<string, string | number | boolean | undefined> = {};

	// Flags that take a string value
	const stringFlags = new Set([
		"--limit",
		"--name",
		"--schedule",
		"--timezone",
		"--branch",
		"--max-turns",
		"--max-budget",
		"--focus",
		"--repo",
		"--github-repo",
		"--system-prompt-file",
		"--notify-discord",
		"--notify-slack",
		"--notify-telegram",
		"--path",
		"--restrict-paths",
	]);

	// Flags that are boolean (no value)
	const booleanFlags = new Set([
		"--json",
		"--keep-logs",
		"--no-new-deps",
		"--no-arch-changes",
		"--bug-fix-only",
	]);

	// Mapping from kebab-case flag names to camelCase arg keys
	const flagKeyMap: Record<string, string> = {
		"--limit": "limit",
		"--name": "name",
		"--schedule": "schedule",
		"--timezone": "timezone",
		"--branch": "branch",
		"--max-turns": "maxTurns",
		"--max-budget": "maxBudget",
		"--focus": "focus",
		"--json": "json",
		"--keep-logs": "keepLogs",
		"--repo": "repo",
		"--github-repo": "githubRepo",
		"--system-prompt-file": "systemPromptFile",
		"--notify-discord": "notifyDiscord",
		"--notify-slack": "notifySlack",
		"--notify-telegram": "notifyTelegram",
		"--path": "path",
		"--restrict-paths": "restrictPaths",
		"--no-new-deps": "noNewDeps",
		"--no-arch-changes": "noArchChanges",
		"--bug-fix-only": "bugFixOnly",
	};

	// Parse positional arg (jobId) and flags from rest
	const positionals: string[] = [];
	for (let i = 0; i < rest.length; i++) {
		const arg = rest[i];
		if (stringFlags.has(arg) && i + 1 < rest.length) {
			const key = flagKeyMap[arg] ?? arg.replace(/^--/, "");
			const value = rest[++i];
			if (arg === "--limit") {
				const parsed = Number.parseInt(value, 10);
				if (Number.isNaN(parsed)) {
					console.error(`Invalid value for --limit: "${value}" (expected a number)`);
					return { command: "help", args: {} };
				}
				args[key] = parsed;
			} else {
				args[key] = value;
			}
		} else if (booleanFlags.has(arg)) {
			const key = flagKeyMap[arg] ?? arg.replace(/^--/, "");
			args[key] = true;
		} else if (!arg.startsWith("--")) {
			positionals.push(arg);
		}
	}

	// First positional is jobId for commands that take it
	if (positionals.length > 0) {
		args.jobId = positionals[0];
	}

	return { command, args };
}

/**
 * Print help text listing all available commands.
 */
function printHelp(): void {
	console.log("Usage: claude-auto <command> [options]\n");
	console.log("Commands:");
	for (const [name, description] of Object.entries(COMMANDS)) {
		console.log(`  ${name.padEnd(10)} ${description}`);
	}
}

/**
 * Main CLI entry point. Parses argv and dispatches to the appropriate command handler.
 */
export async function runCli(argv: string[]): Promise<void> {
	const parsed = parseCommand(argv);

	if (parsed.command === "help") {
		printHelp();
		return;
	}

	switch (parsed.command) {
		case "create": {
			const { createCommand } = await import("./commands/create.js");
			await createCommand(parsed.args);
			break;
		}
		case "check-repo": {
			const { checkRepoCommand } = await import("./commands/check-repo.js");
			await checkRepoCommand(parsed.args);
			break;
		}
		case "list": {
			const { listCommand } = await import("./commands/list.js");
			await listCommand(parsed.args);
			break;
		}
		case "logs": {
			const { logsCommand } = await import("./commands/logs.js");
			await logsCommand(parsed.args);
			break;
		}
		case "report": {
			const { reportCommand } = await import("./commands/report.js");
			await reportCommand(parsed.args);
			break;
		}
		case "pause": {
			const { pauseCommand } = await import("./commands/pause.js");
			await pauseCommand(parsed.args);
			break;
		}
		case "resume": {
			const { resumeCommand } = await import("./commands/resume.js");
			await resumeCommand(parsed.args);
			break;
		}
		case "remove": {
			const { removeCommand } = await import("./commands/remove.js");
			await removeCommand(parsed.args);
			break;
		}
		case "edit": {
			const { editCommand } = await import("./commands/edit.js");
			await editCommand(parsed.args);
			break;
		}
		case "cost": {
			const { costCommand } = await import("./commands/cost.js");
			await costCommand(parsed.args);
			break;
		}
		case "run": {
			const { runCommand } = await import("./commands/run.js");
			await runCommand(parsed.args);
			break;
		}
		case "dashboard": {
			const { launchDashboard } = await import("../tui/index.js");
			await launchDashboard();
			break;
		}
		default:
			console.error(`Command '${parsed.command}' is not yet implemented.`);
			break;
	}
}
