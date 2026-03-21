import lockfile from "proper-lockfile";
import { mkdir } from "node:fs/promises";
import { paths } from "../util/paths.js";

/** Stale lock threshold: 45 minutes in milliseconds */
export const STALE_THRESHOLD = 45 * 60 * 1000;

/**
 * Acquire a file-based lock for a job.
 * Returns a release function on success, or null if the lock is already held.
 * Uses proper-lockfile for cross-process safety with stale detection.
 */
export async function acquireLock(jobId: string): Promise<(() => Promise<void>) | null> {
	await mkdir(paths.jobDir(jobId), { recursive: true });

	try {
		const release = await lockfile.lock(paths.jobDir(jobId), {
			stale: STALE_THRESHOLD,
			retries: 0,
		});
		return release;
	} catch {
		return null;
	}
}
