import { mkdir, writeFile } from "node:fs/promises";
import lockfile from "proper-lockfile";
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

/**
 * Acquire a repo-level lock to prevent concurrent runs on the same repository.
 * Different jobs targeting the same repo path will block each other.
 * Returns a release function on success, or null if locked.
 */
export async function acquireRepoLock(repoPath: string): Promise<(() => Promise<void>) | null> {
	const lockPath = paths.repoLock(repoPath);

	// Ensure the lock file exists (proper-lockfile needs a real file for non-dir locks)
	try {
		await writeFile(lockPath, "", { flag: "wx" });
	} catch {
		// File already exists — that's fine
	}

	try {
		const release = await lockfile.lock(lockPath, {
			stale: STALE_THRESHOLD,
			retries: 0,
		});
		return release;
	} catch {
		return null;
	}
}
