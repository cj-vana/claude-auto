export interface SpawnOptions {
	cwd: string;
	prompt: string;
	maxTurns: number;
	maxBudgetUsd: number;
	allowedTools: string[];
	appendSystemPrompt?: string;
	model?: string;
	env?: Record<string, string>;
}

export interface SpawnResult {
	success: boolean;
	result: string;
	summary: string;
	sessionId: string;
	costUsd: number;
	numTurns: number;
	durationMs: number;
	isError: boolean;
	subtype: string;
	errors?: string[];
}

export type RunStatus = "success" | "no-changes" | "error" | "locked" | "git-error" | "paused" | "budget-exceeded" | "needs-human-review";

export interface RunResult {
	status: RunStatus;
	jobId: string;
	runId: string;
	startedAt: string;
	completedAt: string;
	durationMs: number;
	prUrl?: string;
	summary?: string;
	costUsd?: number;
	numTurns?: number;
	sessionId?: string;
	error?: string;
	branchName?: string;
	issueNumber?: number;
	model?: string;
	feedbackRound?: number;
	prNumber?: number;
}

export interface RunLogEntry extends RunResult {}

export interface ReviewThread {
	id: string;
	isResolved: boolean;
	comments: Array<{ body: string; author: { login: string } }>;
}

export interface PRFeedbackContext {
	number: number;
	title: string;
	headRefName: string;
	url: string;
	reviewDecision: string;
	unresolvedThreads: ReviewThread[];
	currentRound: number;
}
