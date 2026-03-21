import { COMMANDS, type CliCommand, type ParsedCommand } from "./types.js";

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

	// Parse positional arg (jobId) and flags from rest
	const positionals: string[] = [];
	for (let i = 0; i < rest.length; i++) {
		const arg = rest[i];
		if (arg === "--limit" && i + 1 < rest.length) {
			args.limit = Number.parseInt(rest[++i], 10);
		} else if (arg === "--json") {
			args.json = true;
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
		default:
			console.error(`Command '${parsed.command}' is not yet implemented.`);
			break;
	}
}
