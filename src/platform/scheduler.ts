import type { JobConfig } from "../core/types.js";
import { detectPlatform } from "./detect.js";

export interface RegisteredJob {
	jobId: string;
	schedule: string;
	command: string;
}

export interface Scheduler {
	register(job: JobConfig, env?: Record<string, string>): Promise<void>;
	unregister(jobId: string): Promise<void>;
	isRegistered(jobId: string): Promise<boolean>;
	list(): Promise<RegisteredJob[]>;
}

/**
 * Factory function that returns the correct Scheduler implementation
 * for the current platform: CrontabScheduler on Linux, LaunchdScheduler on macOS.
 */
export async function createScheduler(): Promise<Scheduler> {
	const platform = detectPlatform();
	if (platform === "linux") {
		const { CrontabScheduler } = await import("./crontab.js");
		return new CrontabScheduler();
	}
	const { LaunchdScheduler } = await import("./launchd.js");
	return new LaunchdScheduler();
}
