import { describe, expect, it } from "vitest";
import type { JobConfig } from "../../src/core/types.js";
import type { RunResult } from "../../src/runner/types.js";
import { buildPayload } from "../../src/notifications/types.js";

function makeJobConfig(): JobConfig {
	return {
		id: "test-job",
		name: "Test Job",
		repo: { path: "/tmp/test-repo", branch: "main", remote: "origin" },
		schedule: { cron: "0 */6 * * *", timezone: "UTC" },
		focus: ["open-issues"],
		guardrails: {
			maxTurns: 50,
			maxBudgetUsd: 10.0,
			noNewDependencies: false,
			noArchitectureChanges: false,
			bugFixOnly: false,
		},
		notifications: {},
		enabled: true,
	};
}

function makeRunResult(overrides: Partial<RunResult> = {}): RunResult {
	return {
		status: "success",
		jobId: "test-job",
		runId: "run-123",
		startedAt: "2026-03-29T00:00:00Z",
		completedAt: "2026-03-29T00:10:00Z",
		durationMs: 600000,
		...overrides,
	};
}

describe("buildPayload", () => {
	it("maps 'paused' RunStatus to 'error' NotificationEvent", () => {
		const payload = buildPayload(makeJobConfig(), makeRunResult({ status: "paused" }));
		expect(payload.event).toBe("error");
	});

	it("passes through 'success' RunStatus as-is", () => {
		const payload = buildPayload(makeJobConfig(), makeRunResult({ status: "success" }));
		expect(payload.event).toBe("success");
	});

	it("passes through 'no-changes' RunStatus as-is", () => {
		const payload = buildPayload(makeJobConfig(), makeRunResult({ status: "no-changes" }));
		expect(payload.event).toBe("no-changes");
	});

	it("passes through 'locked' RunStatus as-is", () => {
		const payload = buildPayload(makeJobConfig(), makeRunResult({ status: "locked" }));
		expect(payload.event).toBe("locked");
	});
});
