import { SchedulerError } from "../util/errors.js";

export type Platform = "linux" | "darwin";

/**
 * Detect the current platform. Returns "linux" or "darwin".
 * Throws SchedulerError for unsupported platforms (e.g., Windows).
 */
export function detectPlatform(): Platform {
	const p = process.platform;
	if (p === "linux" || p === "darwin") return p;
	throw new SchedulerError(p, `Unsupported platform: ${p}. Only linux and darwin are supported.`);
}
