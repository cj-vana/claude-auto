import { SchedulerError } from "../util/errors.js";

export type Platform = "linux" | "darwin" | "win32";

/**
 * Detect the current platform. Returns "linux", "darwin", or "win32".
 * Throws SchedulerError for unsupported platforms.
 */
export function detectPlatform(): Platform {
	const p = process.platform;
	if (p === "linux" || p === "darwin" || p === "win32") return p;
	throw new SchedulerError(p, `Unsupported platform: ${p}. Only linux, darwin, and win32 are supported.`);
}
