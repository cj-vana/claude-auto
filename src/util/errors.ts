export class ConfigParseError extends Error {
	override name = "ConfigParseError" as const;
	constructor(
		public readonly filePath: string,
		public readonly parseErrors: Array<{ message: string }>,
	) {
		const errorMessages = parseErrors.map((e) => `  - ${e.message}`).join("\n");
		super(`YAML syntax error in ${filePath}:\n${errorMessages}`);
	}
}

export class ConfigValidationError extends Error {
	override name = "ConfigValidationError" as const;
	constructor(
		public readonly filePath: string,
		public readonly validationMessage: string,
	) {
		super(`Invalid config in ${filePath}:\n${validationMessage}`);
	}
}

export class SchedulerError extends Error {
	override name = "SchedulerError" as const;
	constructor(
		public readonly platform: string,
		message: string,
		public readonly cause?: Error,
	) {
		super(`Scheduler error (${platform}): ${message}`);
	}
}

export class CronValidationError extends Error {
	override name = "CronValidationError" as const;
	constructor(
		public readonly expression: string,
		message: string,
	) {
		super(`Invalid cron expression "${expression}": ${message}`);
	}
}

export class GitOpsError extends Error {
	override name = "GitOpsError" as const;
	constructor(
		public readonly operation: string,
		public readonly repoPath: string,
		message: string,
		public override readonly cause?: Error,
	) {
		super(`Git operation '${operation}' failed in ${repoPath}: ${message}`);
	}
}

export class LockError extends Error {
	override name = "LockError" as const;
	constructor(
		public readonly jobId: string,
		message: string,
	) {
		super(`Lock error for job ${jobId}: ${message}`);
	}
}

export class SpawnError extends Error {
	override name = "SpawnError" as const;
	constructor(
		message: string,
		public readonly exitCode?: number,
	) {
		super(`Claude spawn error: ${message}`);
	}
}
