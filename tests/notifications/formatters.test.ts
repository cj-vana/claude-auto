import { describe, expect, it } from "vitest";
import { formatDiscord, formatSlack, formatTelegram } from "../../src/notifications/formatters.js";
import type { NotificationPayload } from "../../src/notifications/types.js";

function makePayload(overrides: Partial<NotificationPayload> = {}): NotificationPayload {
	return {
		event: "success",
		jobId: "job-123",
		jobName: "My Test Job",
		runId: "run-2026-03-21T12-00-00Z",
		repoPath: "/home/user/repos/my-project",
		branch: "main",
		startedAt: "2026-03-21T12:00:00Z",
		completedAt: "2026-03-21T12:05:00Z",
		durationMs: 300000,
		prUrl: "https://github.com/user/repo/pull/42",
		summary: "Fixed auth module bug and updated tests",
		costUsd: 1.5,
		numTurns: 12,
		branchName: "claude-auto/job-123/2026-03-21T12-00-00",
		...overrides,
	};
}

describe("formatDiscord", () => {
	it("returns object with embeds array for success event", () => {
		const result = formatDiscord(makePayload()) as {
			username: string;
			embeds: Array<{
				title: string;
				color: number;
				fields: Array<{ name: string; value: string }>;
			}>;
		};

		expect(result.embeds).toBeDefined();
		expect(result.embeds).toHaveLength(1);
		expect(result.username).toBe("Claude Auto");
	});

	it("uses green color (0x00ff00) for success event", () => {
		const result = formatDiscord(makePayload({ event: "success" })) as {
			embeds: Array<{ color: number }>;
		};

		expect(result.embeds[0].color).toBe(0x00ff00);
	});

	it("uses red color (0xff0000) for error event", () => {
		const result = formatDiscord(makePayload({ event: "error", error: "Something broke" })) as {
			embeds: Array<{ color: number }>;
		};

		expect(result.embeds[0].color).toBe(0xff0000);
	});

	it("uses red color (0xff0000) for git-error event", () => {
		const result = formatDiscord(
			makePayload({ event: "git-error", error: "Force push detected" }),
		) as {
			embeds: Array<{ color: number }>;
		};

		expect(result.embeds[0].color).toBe(0xff0000);
	});

	it("uses yellow color (0xffaa00) for no-changes event", () => {
		const result = formatDiscord(makePayload({ event: "no-changes" })) as {
			embeds: Array<{ color: number }>;
		};

		expect(result.embeds[0].color).toBe(0xffaa00);
	});

	it("uses gray color (0x808080) for locked event", () => {
		const result = formatDiscord(makePayload({ event: "locked" })) as {
			embeds: Array<{ color: number }>;
		};

		expect(result.embeds[0].color).toBe(0x808080);
	});

	it("includes PR URL field when prUrl is present", () => {
		const result = formatDiscord(
			makePayload({ prUrl: "https://github.com/user/repo/pull/42" }),
		) as {
			embeds: Array<{ fields: Array<{ name: string; value: string }> }>;
		};

		const prField = result.embeds[0].fields.find(
			(f: { name: string; value: string }) => f.name === "PR" || f.value.includes("pull/42"),
		);
		expect(prField).toBeDefined();
	});

	it("omits PR URL field when prUrl is absent", () => {
		const result = formatDiscord(makePayload({ prUrl: undefined })) as {
			embeds: Array<{ fields: Array<{ name: string; value: string }> }>;
		};

		const prField = result.embeds[0].fields.find(
			(f: { name: string; value: string }) => f.name === "PR",
		);
		expect(prField).toBeUndefined();
	});

	it("includes job name and duration fields", () => {
		const result = formatDiscord(makePayload()) as {
			embeds: Array<{ fields: Array<{ name: string; value: string }> }>;
		};

		const jobField = result.embeds[0].fields.find(
			(f: { name: string; value: string }) => f.name === "Job" || f.value.includes("My Test Job"),
		);
		const durationField = result.embeds[0].fields.find(
			(f: { name: string; value: string }) => f.name === "Duration" || f.value.includes("5m"),
		);
		expect(jobField).toBeDefined();
		expect(durationField).toBeDefined();
	});

	it("sets correct title for each event type", () => {
		const successResult = formatDiscord(makePayload({ event: "success" })) as {
			embeds: Array<{ title: string }>;
		};
		expect(successResult.embeds[0].title).toContain("PR Created");

		const errorResult = formatDiscord(makePayload({ event: "error" })) as {
			embeds: Array<{ title: string }>;
		};
		expect(errorResult.embeds[0].title).toContain("Run Error");

		const noChangesResult = formatDiscord(makePayload({ event: "no-changes" })) as {
			embeds: Array<{ title: string }>;
		};
		expect(noChangesResult.embeds[0].title).toContain("No Changes");

		const lockedResult = formatDiscord(makePayload({ event: "locked" })) as {
			embeds: Array<{ title: string }>;
		};
		expect(lockedResult.embeds[0].title).toContain("Run Skipped");
	});
});

describe("formatSlack", () => {
	it("returns object with blocks array", () => {
		const result = formatSlack(makePayload()) as { blocks: unknown[] };

		expect(result.blocks).toBeDefined();
		expect(Array.isArray(result.blocks)).toBe(true);
		expect(result.blocks.length).toBeGreaterThanOrEqual(2);
	});

	it("includes header block with event-based title", () => {
		const result = formatSlack(makePayload({ event: "success" })) as {
			blocks: Array<{ type: string; text?: { type: string; text: string } }>;
		};

		const header = result.blocks.find((b) => b.type === "header");
		expect(header).toBeDefined();
		expect(header?.text?.text).toContain("PR Created");
	});

	it("includes section block with summary for success", () => {
		const result = formatSlack(makePayload()) as {
			blocks: Array<{ type: string; text?: { type: string; text: string } }>;
		};

		const section = result.blocks.find((b) => b.type === "section");
		expect(section).toBeDefined();
		expect(section?.text?.text).toContain("Fixed auth module bug");
	});

	it("includes actions block with PR link when prUrl present", () => {
		const result = formatSlack(makePayload({ prUrl: "https://github.com/user/repo/pull/42" })) as {
			blocks: Array<{ type: string; elements?: Array<{ url?: string }> }>;
		};

		const actions = result.blocks.find((b) => b.type === "actions");
		expect(actions).toBeDefined();
		expect(actions?.elements?.[0]?.url).toBe("https://github.com/user/repo/pull/42");
	});

	it("omits actions block when no prUrl", () => {
		const result = formatSlack(makePayload({ prUrl: undefined })) as {
			blocks: Array<{ type: string }>;
		};

		const actions = result.blocks.find((b) => b.type === "actions");
		expect(actions).toBeUndefined();
	});

	it("formats error message for error events", () => {
		const result = formatSlack(makePayload({ event: "error", error: "Build failed" })) as {
			blocks: Array<{ type: string; text?: { type: string; text: string } }>;
		};

		const section = result.blocks.find((b) => b.type === "section");
		expect(section?.text?.text).toContain("Build failed");
	});
});

describe("formatTelegram", () => {
	it("returns correct chat_id and parse_mode HTML", () => {
		const result = formatTelegram(makePayload(), "chat-999") as {
			chat_id: string;
			text: string;
			parse_mode: string;
		};

		expect(result.chat_id).toBe("chat-999");
		expect(result.parse_mode).toBe("HTML");
	});

	it("includes HTML link when prUrl present", () => {
		const result = formatTelegram(
			makePayload({ prUrl: "https://github.com/user/repo/pull/42" }),
			"chat-999",
		) as { text: string };

		expect(result.text).toContain('<a href="https://github.com/user/repo/pull/42">');
	});

	it("formats error message for error events", () => {
		const result = formatTelegram(
			makePayload({ event: "error", error: "Compilation failed" }),
			"chat-999",
		) as { text: string };

		expect(result.text).toContain("Compilation failed");
	});

	it("includes job name in message text", () => {
		const result = formatTelegram(makePayload(), "chat-999") as { text: string };

		expect(result.text).toContain("My Test Job");
	});

	it("handles all event types without throwing", () => {
		const events = ["success", "error", "git-error", "no-changes", "locked"] as const;

		for (const event of events) {
			expect(() => formatTelegram(makePayload({ event }), "chat-999")).not.toThrow();
		}
	});

	it("truncates message text exceeding 4096 characters", () => {
		const longSummary = "A".repeat(5000);
		const result = formatTelegram(makePayload({ summary: longSummary }), "chat-999") as {
			text: string;
		};

		expect(result.text.length).toBeLessThanOrEqual(4096);
		expect(result.text.endsWith("...")).toBe(true);
	});

	it("does not truncate message text under 4096 characters", () => {
		const result = formatTelegram(makePayload(), "chat-999") as { text: string };

		expect(result.text.length).toBeLessThan(4096);
		expect(result.text.endsWith("...")).toBe(false);
	});
});
