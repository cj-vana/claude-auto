import type { JobConfig } from "../core/types.js";
import type { RunResult } from "../runner/types.js";
import { formatDiscord, formatSlack, formatTelegram } from "./formatters.js";
import { buildPayload, type EventTriggers, shouldNotify } from "./types.js";

/**
 * Send notifications to all configured providers for a completed run.
 *
 * Best-effort: failures are logged as warnings but never thrown.
 * All providers are called in parallel via Promise.allSettled.
 */
export async function sendNotifications(config: JobConfig, result: RunResult): Promise<void> {
	const payload = buildPayload(config, result);
	const { notifications } = config;
	const promises: Array<Promise<void>> = [];

	// Discord
	if (notifications.discord) {
		const triggers: EventTriggers = {
			onSuccess: notifications.discord.onSuccess,
			onFailure: notifications.discord.onFailure,
			onNoChanges: notifications.discord.onNoChanges,
			onLocked: notifications.discord.onLocked,
		};
		if (shouldNotify(result.status, triggers)) {
			const body = formatDiscord(payload);
			promises.push(postWebhook("discord", notifications.discord.webhookUrl, body));
		}
	}

	// Slack
	if (notifications.slack) {
		const triggers: EventTriggers = {
			onSuccess: notifications.slack.onSuccess,
			onFailure: notifications.slack.onFailure,
			onNoChanges: notifications.slack.onNoChanges,
			onLocked: notifications.slack.onLocked,
		};
		if (shouldNotify(result.status, triggers)) {
			const body = formatSlack(payload);
			promises.push(postWebhook("slack", notifications.slack.webhookUrl, body));
		}
	}

	// Telegram
	if (notifications.telegram) {
		const triggers: EventTriggers = {
			onSuccess: notifications.telegram.onSuccess,
			onFailure: notifications.telegram.onFailure,
			onNoChanges: notifications.telegram.onNoChanges,
			onLocked: notifications.telegram.onLocked,
		};
		if (shouldNotify(result.status, triggers)) {
			const body = formatTelegram(payload, notifications.telegram.chatId);
			const url = `https://api.telegram.org/bot${notifications.telegram.botToken}/sendMessage`;
			promises.push(postWebhook("telegram", url, body));
		}
	}

	if (promises.length === 0) return;

	const results = await Promise.allSettled(promises);

	for (const r of results) {
		if (r.status === "rejected") {
			console.warn(`[claude-auto] Notification failed: ${r.reason}`);
		}
	}
}

async function postWebhook(provider: string, url: string, body: object): Promise<void> {
	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		console.warn(
			`[claude-auto] Notification to ${provider} returned ${response.status}: ${response.statusText}`,
		);
	}
}
