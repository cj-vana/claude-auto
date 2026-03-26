import { getDatabase } from "../core/database.js";
import { execCommand } from "../util/exec.js";
import type { PRFeedbackContext, ReviewThread } from "./types.js";

/**
 * Internal interface for PR data from `gh pr list --json`.
 * Not exported -- external consumers use PRFeedbackContext.
 */
interface PRWithFeedback {
	number: number;
	title: string;
	headRefName: string;
	reviewDecision: string;
	url: string;
}

/**
 * List open PRs authored by the current user that match this job's branch prefix.
 * Uses `gh pr list` with JSON output for structured data.
 *
 * @param repoPath - Path to the git repository
 * @param jobId - Job identifier used to filter branches by prefix
 * @returns Array of PRs matching the claude-auto/{jobId}/ branch prefix
 */
export async function listOpenPRsWithFeedback(
	repoPath: string,
	jobId: string,
): Promise<PRWithFeedback[]> {
	const { stdout } = await execCommand(
		"gh",
		[
			"pr",
			"list",
			"--author",
			"@me",
			"--state",
			"open",
			"--json",
			"number,headRefName,reviewDecision,title,url",
		],
		{ cwd: repoPath },
	);

	let prs: PRWithFeedback[];
	try {
		prs = JSON.parse(stdout);
	} catch (cause) {
		throw new Error(`Failed to parse gh pr list output as JSON: ${stdout.slice(0, 200)}`, {
			cause,
		});
	}
	return prs.filter((pr) => pr.headRefName.startsWith(`claude-auto/${jobId}/`));
}

/**
 * Get the owner and name of the repository from `gh repo view`.
 *
 * @param repoPath - Path to the git repository
 * @returns Object with owner (login) and name of the repository
 */
export async function getRepoOwnerName(repoPath: string): Promise<{ owner: string; name: string }> {
	const { stdout } = await execCommand("gh", ["repo", "view", "--json", "owner,name"], {
		cwd: repoPath,
	});

	let data: { owner: { login: string }; name: string };
	try {
		data = JSON.parse(stdout);
	} catch (cause) {
		throw new Error(`Failed to parse gh repo view output as JSON: ${stdout.slice(0, 200)}`, {
			cause,
		});
	}
	return { owner: data.owner.login, name: data.name };
}

/**
 * Fetch unresolved review threads for a PR using the GitHub GraphQL API.
 * This is necessary because the REST API does not expose the `isResolved` field.
 *
 * Filters out:
 * - Resolved threads (isResolved: true)
 * - Threads where ALL comments are from bot authors (login ending with "[bot]")
 *
 * @param repoPath - Path to the git repository
 * @param prNumber - PR number to query
 * @returns Array of unresolved ReviewThread objects with human comments
 */
export async function getUnresolvedThreads(
	repoPath: string,
	prNumber: number,
): Promise<ReviewThread[]> {
	const { owner, name } = await getRepoOwnerName(repoPath);

	const query = `query { repository(owner: "${owner}", name: "${name}") { pullRequest(number: ${prNumber}) { reviewThreads(first: 100) { nodes { id isResolved comments(first: 10) { nodes { body author { login } } } } } } } }`;

	const { stdout } = await execCommand("gh", ["api", "graphql", "-f", `query=${query}`], {
		cwd: repoPath,
	});

	let data: Record<string, unknown>;
	try {
		data = JSON.parse(stdout);
	} catch (cause) {
		throw new Error(`Failed to parse GraphQL response as JSON: ${stdout.slice(0, 200)}`, { cause });
	}

	// Check for GraphQL-level errors before navigating the response
	// biome-ignore lint/suspicious/noExplicitAny: GraphQL response shape is dynamic and varies on errors
	const gqlErrors = (data as any)?.errors;
	if (Array.isArray(gqlErrors) && gqlErrors.length > 0) {
		const messages = gqlErrors.map((e: { message?: string }) => e.message ?? "unknown").join("; ");
		throw new Error(`GraphQL errors for PR #${prNumber}: ${messages}`);
	}

	// Navigate the GraphQL response with safe access — the shape may differ on errors
	// biome-ignore lint/suspicious/noExplicitAny: GraphQL response shape is dynamic and varies on errors
	const nodes = (data as any)?.data?.repository?.pullRequest?.reviewThreads?.nodes;
	if (!Array.isArray(nodes)) {
		throw new Error(
			`Unexpected GraphQL response structure for PR #${prNumber}: ${stdout.slice(0, 200)}`,
		);
	}

	return nodes
		.filter((thread: { isResolved: boolean }) => !thread.isResolved)
		.filter((thread: { comments: { nodes: Array<{ author: { login: string } }> } }) => {
			// Filter out threads where ALL comments are from bots
			const hasHumanComment = thread.comments.nodes.some((c) => !c.author.login.endsWith("[bot]"));
			return hasHumanComment;
		})
		.map(
			(thread: {
				id: string;
				isResolved: boolean;
				comments: { nodes: Array<{ body: string; author: { login: string } }> };
			}) => ({
				id: thread.id,
				isResolved: thread.isResolved,
				comments: thread.comments.nodes.map((c) => ({
					body: c.body,
					author: { login: c.author.login },
				})),
			}),
		);
}

/**
 * Post a comment on a PR using `gh pr comment`.
 * Best-effort: failures are logged as warnings but never thrown.
 *
 * @param repoPath - Path to the git repository
 * @param prNumber - PR number to comment on
 * @param body - Comment body text
 */
export async function postPRComment(
	repoPath: string,
	prNumber: number,
	body: string,
): Promise<void> {
	try {
		await execCommand("gh", ["pr", "comment", String(prNumber), "--body", body], { cwd: repoPath });
	} catch (err) {
		console.warn(
			`[claude-auto] Failed to post PR comment on #${prNumber}: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
}

/**
 * Get the current feedback round count for a PR from the SQLite database.
 * Counts the number of prior runs with a matching pr_number and non-null feedback_round.
 *
 * @param jobId - Job identifier
 * @param prNumber - PR number
 * @returns Number of prior feedback rounds (0 if none)
 */
export function getFeedbackRound(jobId: string, prNumber: number): number {
	const db = getDatabase();
	const row = db
		.prepare(
			"SELECT COUNT(*) as count FROM runs WHERE job_id = ? AND pr_number = ? AND feedback_round IS NOT NULL",
		)
		.get(jobId, prNumber) as { count: number };
	return row.count;
}

/**
 * Check for open PRs with actionable feedback that should be iterated on.
 *
 * Orchestration flow:
 * 1. List open PRs for this job
 * 2. Filter to PRs with CHANGES_REQUESTED review decision
 * 3. For each candidate, fetch unresolved review threads
 * 4. Check feedback round count against max rounds
 * 5. Return PRFeedbackContext if actionable, null otherwise
 *
 * @param repoPath - Path to the git repository
 * @param jobId - Job identifier
 * @param maxRounds - Maximum number of feedback rounds allowed
 * @returns PRFeedbackContext if there's actionable feedback, null otherwise
 */
export async function checkPendingPRFeedback(
	repoPath: string,
	jobId: string,
	maxRounds: number,
): Promise<PRFeedbackContext | null> {
	const prs = await listOpenPRsWithFeedback(repoPath, jobId);

	// Filter to PRs with changes requested
	const candidates = prs.filter((pr) => pr.reviewDecision === "CHANGES_REQUESTED");

	for (const pr of candidates) {
		const threads = await getUnresolvedThreads(repoPath, pr.number);

		if (threads.length === 0) {
			continue;
		}

		const currentRound = getFeedbackRound(jobId, pr.number);

		if (currentRound >= maxRounds) {
			continue;
		}

		return {
			number: pr.number,
			title: pr.title,
			headRefName: pr.headRefName,
			url: pr.url,
			reviewDecision: pr.reviewDecision,
			unresolvedThreads: threads,
			currentRound,
		};
	}

	return null;
}
