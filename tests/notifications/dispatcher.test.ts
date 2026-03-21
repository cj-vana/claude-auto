import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { JobConfig } from "../../src/core/types.js";
import type { RunResult } from "../../src/runner/types.js";
import { shouldNotify } from "../../src/notifications/types.js";
import { sendNotifications } from "../../src/notifications/dispatcher.js";

// Save and restore original fetch
const originalFetch = globalThis.fetch;

function makeConfig(overrides: Partial<JobConfig> = {}): JobConfig {
	return {
		id: "job-123",
		name: "My Test Job",
		repo: { path: "/home/user/repos/my-project", branch: "main", remote: "origin" },
		schedule: { cron: "0 */6 * * *", timezone: "UTC" },
		focus: ["open-issues", "bug-discovery"],
		guardrails: {
			maxTurns: 50,
			maxBudgetUsd: 5.0,
			noNewDependencies: false,
			noArchitectureChanges: false,
			bugFixOnly: false,
		},
		notifications: {},
		enabled: true,
		...overrides,
	};
}

function makeRunResult(overrides: Partial<RunResult> = {}): RunResult {
	return {
		status: "success",
		jobId: "job-123",
		runId: "run-2026-03-21T12-00-00Z",
		startedAt: "2026-03-21T12:00:00Z",
		completedAt: "2026-03-21T12:05:00Z",
		durationMs: 300000,
		prUrl: "https://github.com/user/repo/pull/42",
		summary: "Fixed auth module bug",
		costUsd: 1.5,
		numTurns: 12,
		branchName: "claude-auto/job-123/2026-03-21T12-00-00",
		...overrides,
	};
}

describe("shouldNotify", () => {
	it("returns true for success when onSuccess is true", () => {
		expect(shouldNotify("success", { onSuccess: true, onFailure: true })).toBe(true);
	});

	it("returns false for success when onSuccess is false", () => {
		expect(shouldNotify("success", { onSuccess: false, onFailure: true })).toBe(false);
	});

	it("returns true for success when onSuccess is undefined (default true)", () => {
		expect(shouldNotify("success", {})).toBe(true);
	});

	it("returns true for error when onFailure is true", () => {
		expect(shouldNotify("error", { onSuccess: true, onFailure: true })).toBe(true);
	});

	it("returns true for git-error when onFailure is true", () => {
		expect(shouldNotify("git-error", { onSuccess: false, onFailure: true })).toBe(true);
	});

	it("returns false for error when onFailure is false", () => {
		expect(shouldNotify("error", { onFailure: false })).toBe(false);
	});

	it("returns true for no-changes when onNoChanges is true", () => {
		expect(shouldNotify("no-changes", { onNoChanges: true })).toBe(true);
	});

	it("returns false for no-changes when onNoChanges is undefined (default false)", () => {
		expect(shouldNotify("no-changes", {})).toBe(false);
	});

	it("returns true for locked when onLocked is true", () => {
		expect(shouldNotify("locked", { onLocked: true })).toBe(true);
	});

	it("returns false for locked when onLocked is undefined (default false)", () => {
		expect(shouldNotify("locked", {})).toBe(false);
	});
});

describe("sendNotifications", () => {
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
		globalThis.fetch = mockFetch;
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it("calls fetch for Discord when configured with matching event", async () => {
		const config = makeConfig({
			notifications: {
				discord: {
					webhookUrl: "https://discord.com/api/webhooks/123/abc",
					onSuccess: true,
					onFailure: true,
				},
			},
		});

		await sendNotifications(config, makeRunResult());

		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(mockFetch).toHaveBeenCalledWith(
			"https://discord.com/api/webhooks/123/abc",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({ "Content-Type": "application/json" }),
			}),
		);
	});

	it("skips Discord when onSuccess is false and status is success", async () => {
		const config = makeConfig({
			notifications: {
				discord: {
					webhookUrl: "https://discord.com/api/webhooks/123/abc",
					onSuccess: false,
					onFailure: true,
				},
			},
		});

		await sendNotifications(config, makeRunResult({ status: "success" }));

		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("calls fetch for Slack when configured", async () => {
		const config = makeConfig({
			notifications: {
				slack: {
					webhookUrl: "https://hooks.slack.com/services/T00/B00/xxx",
					onFailure: true,
				},
			},
		});

		await sendNotifications(config, makeRunResult());

		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(mockFetch).toHaveBeenCalledWith(
			"https://hooks.slack.com/services/T00/B00/xxx",
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("calls fetch for Telegram with correct Bot API URL", async () => {
		const config = makeConfig({
			notifications: {
				telegram: {
					botToken: "bot-token-123",
					chatId: "chat-999",
					onFailure: true,
				},
			},
		});

		await sendNotifications(config, makeRunResult());

		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(mockFetch).toHaveBeenCalledWith(
			"https://api.telegram.org/botbot-token-123/sendMessage",
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("calls all configured providers (fan-out, not short-circuit)", async () => {
		const config = makeConfig({
			notifications: {
				discord: {
					webhookUrl: "https://discord.com/api/webhooks/123/abc",
					onSuccess: true,
					onFailure: true,
				},
				slack: {
					webhookUrl: "https://hooks.slack.com/services/T00/B00/xxx",
					onFailure: true,
				},
				telegram: {
					botToken: "bot-token-123",
					chatId: "chat-999",
					onFailure: true,
				},
			},
		});

		await sendNotifications(config, makeRunResult());

		expect(mockFetch).toHaveBeenCalledTimes(3);
	});

	it("does not throw when fetch rejects (best-effort)", async () => {
		mockFetch.mockRejectedValue(new Error("Network error"));

		const config = makeConfig({
			notifications: {
				discord: {
					webhookUrl: "https://discord.com/api/webhooks/123/abc",
					onSuccess: true,
					onFailure: true,
				},
			},
		});

		// Should not throw
		await expect(sendNotifications(config, makeRunResult())).resolves.toBeUndefined();
	});

	it("does nothing when no providers configured", async () => {
		const config = makeConfig({ notifications: {} });

		await sendNotifications(config, makeRunResult());

		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("does not call fetch when event filter excludes the status", async () => {
		const config = makeConfig({
			notifications: {
				discord: {
					webhookUrl: "https://discord.com/api/webhooks/123/abc",
					onSuccess: true,
					onFailure: false,
				},
			},
		});

		await sendNotifications(config, makeRunResult({ status: "error" }));

		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("logs warning when fetch fails but continues to other providers", async () => {
		mockFetch
			.mockRejectedValueOnce(new Error("Discord down"))
			.mockResolvedValueOnce({ ok: true, status: 200 });

		const config = makeConfig({
			notifications: {
				discord: {
					webhookUrl: "https://discord.com/api/webhooks/123/abc",
					onSuccess: true,
					onFailure: true,
				},
				slack: {
					webhookUrl: "https://hooks.slack.com/services/T00/B00/xxx",
					onFailure: true,
				},
			},
		});

		await sendNotifications(config, makeRunResult());

		// Both providers should have been called despite Discord failure
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});
});
