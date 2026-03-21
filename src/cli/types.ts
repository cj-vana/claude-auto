export type CliCommand =
	| "list"
	| "logs"
	| "report"
	| "pause"
	| "resume"
	| "remove"
	| "edit"
	| "help";

export interface ParsedCommand {
	command: CliCommand;
	args: Record<string, string | number | boolean | undefined>;
}

export type CommandHandler = (args: ParsedCommand["args"]) => Promise<void>;

export const COMMANDS: Record<string, string> = {
	list: "List all configured jobs with status and schedule",
	logs: "Show recent run history for a job",
	report: "Show aggregate run summary report",
	pause: "Pause a running job",
	resume: "Resume a paused job",
	edit: "Edit a job configuration",
	remove: "Remove a job and unregister its schedule",
	help: "Show this help message",
};
