import { homedir } from "node:os";
import { join } from "node:path";

const BASE_DIR = join(homedir(), ".claude-auto");

export const paths = {
	base: BASE_DIR,
	jobs: join(BASE_DIR, "jobs"),
	jobDir: (jobId: string) => join(BASE_DIR, "jobs", jobId),
	jobConfig: (jobId: string) => join(BASE_DIR, "jobs", jobId, "config.yaml"),
} as const;
