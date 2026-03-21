// Stub -- implementation pending (TDD RED phase)
export const STALE_THRESHOLD = 0;

export async function acquireLock(_jobId: string): Promise<(() => Promise<void>) | null> {
	throw new Error("Not implemented");
}
