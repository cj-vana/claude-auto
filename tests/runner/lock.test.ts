import { beforeEach, describe, expect, it, vi } from "vitest";
import { acquireLock, STALE_THRESHOLD } from "../../src/runner/lock.js";

// Mock proper-lockfile
vi.mock("proper-lockfile", () => ({
	default: {
		lock: vi.fn(),
	},
}));

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
	mkdir: vi.fn().mockResolvedValue(undefined),
}));

// Get mocked modules
import lockfile from "proper-lockfile";
import { paths } from "../../src/util/paths.js";

describe("lock module", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("STALE_THRESHOLD", () => {
		it("should be 45 minutes in milliseconds", () => {
			expect(STALE_THRESHOLD).toBe(45 * 60 * 1000);
		});
	});

	describe("acquireLock", () => {
		it("returns a release function when lock is available", async () => {
			const mockRelease = vi.fn().mockResolvedValue(undefined);
			vi.mocked(lockfile.lock).mockResolvedValue(mockRelease);

			const release = await acquireLock("test-job-1");

			expect(release).toBeTypeOf("function");
			expect(lockfile.lock).toHaveBeenCalledWith(paths.jobDir("test-job-1"), {
				stale: STALE_THRESHOLD,
				retries: 0,
			});
		});

		it("returns null when lock is already held", async () => {
			vi.mocked(lockfile.lock).mockRejectedValue(new Error("Lock already held"));

			const result = await acquireLock("test-job-2");

			expect(result).toBeNull();
		});

		it("calling the release function releases the lock", async () => {
			const mockRelease = vi.fn().mockResolvedValue(undefined);
			vi.mocked(lockfile.lock).mockResolvedValue(mockRelease);

			const release = await acquireLock("test-job-3");
			expect(release).not.toBeNull();

			await release?.();
			expect(mockRelease).toHaveBeenCalledOnce();
		});

		it("uses paths.jobDir(jobId) as the lock target", async () => {
			const mockRelease = vi.fn().mockResolvedValue(undefined);
			vi.mocked(lockfile.lock).mockResolvedValue(mockRelease);

			await acquireLock("my-job");

			expect(lockfile.lock).toHaveBeenCalledWith(paths.jobDir("my-job"), expect.any(Object));
		});

		it("ensures the job directory exists before locking", async () => {
			const { mkdir } = await import("node:fs/promises");
			const mockRelease = vi.fn().mockResolvedValue(undefined);
			vi.mocked(lockfile.lock).mockResolvedValue(mockRelease);

			await acquireLock("dir-test-job");

			expect(mkdir).toHaveBeenCalledWith(paths.jobDir("dir-test-job"), { recursive: true });
		});
	});
});
