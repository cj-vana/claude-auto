import type { RunStatus } from "../runner/types.js";
import { execCommand } from "../util/exec.js";

/**
 * Extract a GitHub issue number from text.
 * Looks for patterns like: #42, fixes #7, closes #123, resolves #99
 * Returns the first matched issue number, or undefined if none found.
 */
export function extractIssueNumber(text: string): number | undefined {
	const match = text.match(/(?:fixes|closes|resolves|fix|close|resolve)?\s*#(\d+)/i);
	if (match?.[1]) {
		return Number.parseInt(match[1], 10);
	}
	return undefined;
}

export interface PostIssueCommentOptions {
	repoPath: string;
	issueNumber: number;
	status: RunStatus;
	prUrl?: string;
	summary?: string;
	error?: string;
	jobName: string;
}

/**
 * Post a comment on a GitHub issue about the run result.
 *
 * Best-effort: failures are logged as warnings but never thrown.
 * Skips posting for "locked" status (no value in commenting on skipped runs).
 */
export async function postIssueComment(options: PostIssueCommentOptions): Promise<void> {
	const { repoPath, issueNumber, status, prUrl, summary, error, jobName } = options;

	// Skip commenting for locked/skipped runs
	if (status === "locked") {
		return;
	}

	const body = buildCommentBody(status, { prUrl, summary, error, jobName });

	try {
		await execCommand("gh", ["issue", "comment", String(issueNumber), "--body", body], {
			cwd: repoPath,
		});
	} catch (err) {
		console.warn(
			`[claude-auto] Failed to post issue comment on #${issueNumber}: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
}

function buildCommentBody(
	status: RunStatus,
	context: { prUrl?: string; summary?: string; error?: string; jobName: string },
): string {
	const footer = "\n\n---\n*Automated by [claude-auto](https://github.com/your-org/claude-auto)*";

	switch (status) {
		case "success": {
			const parts = ["Claude Auto completed work on this issue."];
			if (context.prUrl) {
				parts.push(`\n\n**PR:** ${context.prUrl}`);
			}
			if (context.summary) {
				parts.push(`\n**Summary:** ${context.summary}`);
			}
			return parts.join("") + footer;
		}
		case "error":
		case "git-error": {
			const parts = ["Claude Auto encountered an error while working on this issue."];
			if (context.error) {
				parts.push(`\n\n**Error:** ${context.error}`);
			}
			parts.push(`\n**Job:** ${context.jobName}`);
			return parts.join("") + footer;
		}
		case "no-changes": {
			const parts = ["Claude Auto analyzed this issue but made no changes."];
			if (context.summary) {
				parts.push(`\n\n**Summary:** ${context.summary}`);
			}
			parts.push(`\n**Job:** ${context.jobName}`);
			return parts.join("") + footer;
		}
		default:
			return `Claude Auto run completed with status: ${status}${footer}`;
	}
}
