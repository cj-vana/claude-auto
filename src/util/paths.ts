import { homedir } from "node:os";
import { join } from "node:path";

const BASE_DIR = join(homedir(), ".claude-auto");

export const paths = {
	base: BASE_DIR,
	jobs: join(BASE_DIR, "jobs"),
	jobDir: (jobId: string) => join(BASE_DIR, "jobs", jobId),
	jobConfig: (jobId: string) => join(BASE_DIR, "jobs", jobId, "config.yaml"),
	logs: join(BASE_DIR, "logs"),
	jobLogs: (jobId: string) => join(BASE_DIR, "jobs", jobId, "runs"),
	jobLog: (jobId: string, runId: string) =>
		join(BASE_DIR, "jobs", jobId, "runs", `${runId}.log`),
	jobLock: (jobId: string) => join(BASE_DIR, "jobs", jobId, ".lock"),
	plistDir: join(homedir(), "Library", "LaunchAgents"),
	plistPath: (jobId: string) =>
		join(
			homedir(),
			"Library",
			"LaunchAgents",
			`com.claude-auto.${jobId}.plist`,
		),
	crontabLock: join(BASE_DIR, ".crontab.lock"),
} as const;
