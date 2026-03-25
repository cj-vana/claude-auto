import { execCommand } from "../util/exec.js";

/**
 * A scored and filtered GitHub issue ready for presentation to Claude.
 * Body is truncated to 1000 chars to reduce token usage.
 */
export interface ScoredIssue {
	number: number;
	title: string;
	body: string;
	labels: string[];
	score: number;
	skipReason?: string;
}

/**
 * Raw GitHub issue shape from `gh issue list --json` output.
 */
interface GhIssue {
	number: number;
	title: string;
	body: string | null;
	labels: Array<{ name: string }>;
	assignees: Array<{ login: string }>;
	createdAt: string;
	comments: Array<unknown>;
}

/** Labels that cause an issue to be skipped entirely. */
const NEGATIVE_LABELS = ["wontfix", "duplicate"];
const HUMAN_LABELS = ["question", "discussion"];

/** Label-based score boosts (TRIG-03). */
const LABEL_BOOSTS: Record<string, number> = {
	"good first issue": 30,
	bug: 20,
	enhancement: 10,
	documentation: 5,
};

/** Base score for all issues before adjustments. */
const BASE_SCORE = 50;

/** Maximum body length in the output (truncated to save tokens). */
const MAX_BODY_LENGTH = 1000;

/**
 * Triage GitHub issues for a repository by scoring and filtering them
 * before presenting to Claude. This reduces token usage and improves
 * work selection quality.
 *
 * Scoring rubric:
 * - Base score: 50
 * - Label boosts: good first issue (+30), bug (+20), enhancement (+10), documentation (+5)
 * - Body quality: < 20 chars (-30), > 100 chars (+10), > 500 chars (+5 additional)
 *
 * Skip reasons:
 * - already-attempted: issue was worked on in a previous run
 * - assigned: issue has assignees
 * - negative-label: issue has wontfix or duplicate label
 * - requires-human: issue has question or discussion label
 *
 * @param repoPath - Path to the repository (used as cwd for gh CLI)
 * @param previousIssues - Issue numbers already attempted in prior runs
 * @returns Scored issues sorted by score descending, with skipped issues excluded
 */
export async function triageIssues(
	repoPath: string,
	previousIssues: number[],
): Promise<ScoredIssue[]> {
	const { stdout } = await execCommand(
		"gh",
		[
			"issue",
			"list",
			"--state",
			"open",
			"--limit",
			"20",
			"--json",
			"number,title,body,labels,assignees,createdAt,comments",
		],
		{ cwd: repoPath },
	);

	let issues: GhIssue[];
	try {
		issues = JSON.parse(stdout);
	} catch (cause) {
		throw new Error(`Failed to parse gh issue list output as JSON: ${stdout.slice(0, 200)}`, {
			cause,
		});
	}
	const previousSet = new Set(previousIssues);

	const scored: ScoredIssue[] = [];

	for (const issue of issues) {
		const labelNames = issue.labels.map((l) => l.name);
		const labelNamesLower = labelNames.map((n) => n.toLowerCase());
		const body = issue.body ?? "";

		// --- Skip checks ---
		let skipReason: string | undefined;

		if (previousSet.has(issue.number)) {
			skipReason = "already-attempted";
		} else if (issue.assignees.length > 0) {
			skipReason = "assigned";
		} else if (labelNamesLower.some((l) => NEGATIVE_LABELS.includes(l))) {
			skipReason = "negative-label";
		} else if (labelNamesLower.some((l) => HUMAN_LABELS.includes(l))) {
			skipReason = "requires-human";
		}

		if (skipReason) {
			// Skipped issues are excluded from the returned array
			continue;
		}

		// --- Scoring ---
		let score = BASE_SCORE;

		// Label boosts (TRIG-03)
		for (const label of labelNamesLower) {
			if (label in LABEL_BOOSTS) {
				score += LABEL_BOOSTS[label];
			}
		}

		// Body quality scoring (TRIG-01, TRIG-02)
		if (body.length < 20) {
			score -= 30; // Likely spam or vague
		}
		if (body.length > 100) {
			score += 10; // Well-described
		}
		if (body.length > 500) {
			score += 5; // Very detailed
		}

		// Truncate body for token savings
		const truncatedBody = body.length > MAX_BODY_LENGTH ? body.slice(0, MAX_BODY_LENGTH) : body;

		scored.push({
			number: issue.number,
			title: issue.title,
			body: truncatedBody,
			labels: labelNames,
			score,
		});
	}

	// Sort by score descending
	scored.sort((a, b) => b.score - a.score);

	return scored;
}
