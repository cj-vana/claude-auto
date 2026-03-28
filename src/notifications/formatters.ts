import type { NotificationEvent, NotificationPayload } from "./types.js";

/**
 * Format duration in milliseconds to a human-readable string.
 * For hours+, shows "Xh Ym". For minutes+, shows "Xm Ys". For <1m, shows "Xs".
 */
function formatDuration(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	}
	if (minutes > 0) {
		return `${minutes}m ${seconds}s`;
	}
	return `${seconds}s`;
}

const EVENT_TITLES: Record<NotificationEvent, string> = {
	success: "PR Created",
	error: "Run Error",
	"git-error": "Run Error",
	"no-changes": "No Changes",
	locked: "Run Skipped",
	"budget-exceeded": "Budget Exceeded",
	"merge-conflict": "Merge Conflict",
	"needs-human-review": "Needs Human Review",
};

const DISCORD_COLORS: Record<NotificationEvent, number> = {
	success: 0x00ff00,
	error: 0xff0000,
	"git-error": 0xff0000,
	"no-changes": 0xffaa00,
	locked: 0x808080,
	"budget-exceeded": 0xff00ff,
	"merge-conflict": 0xff0000,
	"needs-human-review": 0x00ccff,
};

const SLACK_EMOJI: Record<NotificationEvent, string> = {
	success: "\u2705",
	error: "\u274c",
	"git-error": "\u274c",
	"no-changes": "\ud83d\udd0d",
	locked: "\ud83d\udd12",
	"budget-exceeded": "\ud83d\udcb0",
	"merge-conflict": "\u26a0\ufe0f",
	"needs-human-review": "\ud83d\udc41\ufe0f",
};

/**
 * Format a notification payload for Discord webhook API.
 * Returns a JSON-serializable object with Discord embeds.
 */
export function formatDiscord(payload: NotificationPayload): object {
	const title = EVENT_TITLES[payload.event];
	const color = DISCORD_COLORS[payload.event];
	const description =
		payload.event === "error" || payload.event === "git-error"
			? (payload.error ?? "Unknown error")
			: (payload.summary ?? "No summary available");

	const fields: Array<{ name: string; value: string; inline?: boolean }> = [
		{ name: "Job", value: payload.jobName, inline: true },
		{ name: "Repo", value: payload.repoPath, inline: true },
		{ name: "Duration", value: formatDuration(payload.durationMs), inline: true },
	];

	if (payload.prUrl) {
		fields.push({ name: "PR", value: payload.prUrl, inline: false });
	}

	if (payload.costUsd !== undefined) {
		fields.push({ name: "Cost", value: `$${payload.costUsd.toFixed(2)}`, inline: true });
	}

	return {
		username: "Claude Auto",
		embeds: [
			{
				title,
				description,
				color,
				fields,
				timestamp: payload.completedAt,
			},
		],
	};
}

/**
 * Format a notification payload for Slack incoming webhook API.
 * Returns a JSON-serializable object with Slack blocks.
 */
export function formatSlack(payload: NotificationPayload): object {
	const emoji = SLACK_EMOJI[payload.event];
	const title = `${emoji} ${EVENT_TITLES[payload.event]}`;
	const body =
		payload.event === "error" || payload.event === "git-error"
			? `*Error:* ${payload.error ?? "Unknown error"}`
			: `*Summary:* ${payload.summary ?? "No summary available"}`;

	const details = [
		body,
		`*Job:* ${payload.jobName}`,
		`*Repo:* ${payload.repoPath}`,
		`*Duration:* ${formatDuration(payload.durationMs)}`,
	];

	if (payload.costUsd !== undefined) {
		details.push(`*Cost:* $${payload.costUsd.toFixed(2)}`);
	}

	const blocks: Array<object> = [
		{
			type: "header",
			text: {
				type: "plain_text",
				text: title,
			},
		},
		{
			type: "section",
			text: {
				type: "mrkdwn",
				text: details.join("\n"),
			},
		},
	];

	if (payload.prUrl) {
		blocks.push({
			type: "actions",
			elements: [
				{
					type: "button",
					text: {
						type: "plain_text",
						text: "View PR",
					},
					url: payload.prUrl,
				},
			],
		});
	}

	return { blocks };
}

/**
 * Format a notification payload for Telegram Bot API (sendMessage).
 * Returns a JSON-serializable object with chat_id, text, and parse_mode.
 */
export function formatTelegram(payload: NotificationPayload, chatId: string): object {
	const title = `<b>${EVENT_TITLES[payload.event]}</b>`;
	const body =
		payload.event === "error" || payload.event === "git-error"
			? `<b>Error:</b> ${escapeHtml(payload.error ?? "Unknown error")}`
			: `<b>Summary:</b> ${escapeHtml(payload.summary ?? "No summary available")}`;

	const lines = [
		title,
		"",
		body,
		`<b>Job:</b> ${escapeHtml(payload.jobName)}`,
		`<b>Repo:</b> ${escapeHtml(payload.repoPath)}`,
		`<b>Duration:</b> ${formatDuration(payload.durationMs)}`,
	];

	if (payload.costUsd !== undefined) {
		lines.push(`<b>Cost:</b> $${payload.costUsd.toFixed(2)}`);
	}

	if (payload.prUrl) {
		lines.push("");
		lines.push(`<a href="${payload.prUrl}">View PR</a>`);
	}

	lines.push("");
	lines.push("<i>Automated by claude-auto</i>");

	// Telegram enforces a 4096-character limit on sendMessage.
	// Truncate to avoid silent HTTP 400 failures.
	const MAX_TELEGRAM_LENGTH = 4096;
	let text = lines.join("\n");
	if (text.length > MAX_TELEGRAM_LENGTH) {
		text = `${text.slice(0, MAX_TELEGRAM_LENGTH - 3)}...`;
	}

	return {
		chat_id: chatId,
		text,
		parse_mode: "HTML",
	};
}

function escapeHtml(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
