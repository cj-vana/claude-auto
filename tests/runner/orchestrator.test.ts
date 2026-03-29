import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobConfig } from "../../src/core/types.js";
import type { PipelineResult, SpawnResult } from "../../src/runner/types.js";
import { GitOpsError } from "../../src/util/errors.js";

// Mock all dependencies
vi.mock("nanoid", () => ({
	nanoid: vi.fn(() => "test-run-id12"),
}));

vi.mock("../../src/runner/lock.js", () => ({
	acquireLock: vi.fn(),
	acquireRepoLock: vi.fn(),
}));

vi.mock("../../src/runner/git-ops.js", () => ({
	pullLatest: vi.fn(),
	createBranch: vi.fn(),
	hasChanges: vi.fn(),
	hasCommitsAhead: vi.fn(),
	pushBranch: vi.fn(),
	createPR: vi.fn(),
	checkoutExistingBranch: vi.fn(),
	attemptRebase: vi.fn(),
	getDiffFromBase: vi.fn(),
	getFirstCommitSubject: vi.fn(),
}));

vi.mock("../../src/runner/pipeline.js", () => ({
	runPipeline: vi.fn(),
}));

vi.mock("../../src/runner/spawner.js", () => ({
	spawnClaude: vi.fn(),
	buildAllowedTools: vi.fn(),
}));

vi.mock("../../src/runner/prompt-builder.js", () => ({
	buildWorkPrompt: vi.fn(),
	buildSystemPrompt: vi.fn(),
	buildFeedbackPrompt: vi.fn(),
	buildTriagedWorkPrompt: vi.fn(),
}));

vi.mock("../../src/runner/logger.js", () => ({
	writeRunLog: vi.fn(),
}));

vi.mock("../../src/core/config.js", () => ({
	loadJobConfig: vi.fn(),
}));

vi.mock("../../src/util/exec.js", () => ({
	execCommand: vi.fn(),
}));

vi.mock("../../src/notifications/dispatcher.js", () => ({
	sendNotifications: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/notifications/issue-comment.js", () => ({
	extractIssueNumber: vi.fn().mockReturnValue(undefined),
	postIssueComment: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/runner/cost-tracker.js", () => ({
	checkBudget: vi.fn(),
}));

vi.mock("../../src/runner/context-store.js", () => ({
	loadRunContext: vi.fn(),
}));

vi.mock("../../src/runner/pr-feedback.js", () => ({
	checkPendingPRFeedback: vi.fn(),
	postPRComment: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/runner/issue-triage.js", () => ({
	triageIssues: vi.fn().mockResolvedValue([]),
}));

import { loadJobConfig } from "../../src/core/config.js";
import { sendNotifications } from "../../src/notifications/dispatcher.js";
import { extractIssueNumber, postIssueComment } from "../../src/notifications/issue-comment.js";
import { loadRunContext } from "../../src/runner/context-store.js";
import { checkBudget } from "../../src/runner/cost-tracker.js";
import {
	attemptRebase,
	checkoutExistingBranch,
	createBranch,
	createPR,
	getFirstCommitSubject,
	hasChanges,
	hasCommitsAhead,
	pullLatest,
	pushBranch,
} from "../../src/runner/git-ops.js";
import { triageIssues } from "../../src/runner/issue-triage.js";
// Import mocked modules after mock declarations
import { acquireLock, acquireRepoLock } from "../../src/runner/lock.js";
import { writeRunLog } from "../../src/runner/logger.js";
import { executeRun } from "../../src/runner/orchestrator.js";
import { runPipeline } from "../../src/runner/pipeline.js";
import { checkPendingPRFeedback, postPRComment } from "../../src/runner/pr-feedback.js";
import {
	buildFeedbackPrompt,
	buildSystemPrompt,
	buildTriagedWorkPrompt,
	buildWorkPrompt,
} from "../../src/runner/prompt-builder.js";
import { buildAllowedTools, spawnClaude } from "../../src/runner/spawner.js";
import { execCommand } from "../../src/util/exec.js";

const mockedAcquireLock = vi.mocked(acquireLock);
const mockedAcquireRepoLock = vi.mocked(acquireRepoLock);
const mockedLoadJobConfig = vi.mocked(loadJobConfig);
const mockedPullLatest = vi.mocked(pullLatest);
const mockedCreateBranch = vi.mocked(createBranch);
const mockedHasChanges = vi.mocked(hasChanges);
const mockedHasCommitsAhead = vi.mocked(hasCommitsAhead);
const mockedGetFirstCommitSubject = vi.mocked(getFirstCommitSubject);
const mockedPushBranch = vi.mocked(pushBranch);
const mockedCreatePR = vi.mocked(createPR);
const mockedSpawnClaude = vi.mocked(spawnClaude);
const mockedBuildAllowedTools = vi.mocked(buildAllowedTools);
const mockedBuildWorkPrompt = vi.mocked(buildWorkPrompt);
const mockedBuildSystemPrompt = vi.mocked(buildSystemPrompt);
const mockedWriteRunLog = vi.mocked(writeRunLog);
const mockedExecCommand = vi.mocked(execCommand);
const mockedSendNotifications = vi.mocked(sendNotifications);
const mockedExtractIssueNumber = vi.mocked(extractIssueNumber);
const mockedPostIssueComment = vi.mocked(postIssueComment);
const mockedCheckBudget = vi.mocked(checkBudget);
const mockedLoadRunContext = vi.mocked(loadRunContext);
const mockedCheckPendingPRFeedback = vi.mocked(checkPendingPRFeedback);
const mockedPostPRComment = vi.mocked(postPRComment);
const mockedTriageIssues = vi.mocked(triageIssues);
const mockedCheckoutExistingBranch = vi.mocked(checkoutExistingBranch);
const mockedBuildFeedbackPrompt = vi.mocked(buildFeedbackPrompt);
const mockedBuildTriagedWorkPrompt = vi.mocked(buildTriagedWorkPrompt);
const mockedAttemptRebase = vi.mocked(attemptRebase);
const mockedRunPipeline = vi.mocked(runPipeline);

function makeDefaultConfig(): JobConfig {
	return {
		id: "test-job",
		name: "Test Job",
		repo: { path: "/tmp/test-repo", branch: "main", remote: "origin" },
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
		pipeline: {
			enabled: false,
			planModel: "opus",
			implementModel: "opus",
			reviewModel: "opus",
			maxReviewRounds: 1,
		},
	};
}

function makeDefaultSpawnResult(overrides: Partial<SpawnResult> = {}): SpawnResult {
	return {
		success: true,
		result: "I fixed the bug in utils.ts",
		summary: "Fixed null check bug in utils.ts",
		sessionId: "session-abc-123",
		costUsd: 1.5,
		numTurns: 12,
		durationMs: 45000,
		isError: false,
		subtype: "success",
		...overrides,
	};
}

function makeDefaultPipelineResult(overrides: Partial<PipelineResult> = {}): PipelineResult {
	return {
		stages: [
			{
				stage: "plan",
				spawnResult: makeDefaultSpawnResult({
					summary: "Plan: fix auth bug",
					costUsd: 0.5,
					durationMs: 10000,
					numTurns: 5,
				}),
			},
			{
				stage: "implement",
				spawnResult: makeDefaultSpawnResult({
					summary: "Implemented auth fix",
					costUsd: 2.0,
					durationMs: 30000,
					numTurns: 20,
				}),
			},
			{
				stage: "review",
				spawnResult: makeDefaultSpawnResult({
					summary: "VERDICT: PASS",
					costUsd: 0.3,
					durationMs: 8000,
					numTurns: 3,
				}),
			},
		],
		reviewVerdict: "pass",
		totalCostUsd: 2.8,
		totalDurationMs: 48000,
		summary: "Fixed authentication bug in login handler",
		...overrides,
	};
}

const mockReleaseLock = vi.fn().mockResolvedValue(undefined);

describe("executeRun", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Default mocks: everything succeeds
		mockedAcquireLock.mockResolvedValue(mockReleaseLock);
		mockedAcquireRepoLock.mockResolvedValue(vi.fn().mockResolvedValue(undefined));
		mockedLoadJobConfig.mockResolvedValue(makeDefaultConfig());
		mockedPullLatest.mockResolvedValue(undefined);
		mockedCreateBranch.mockResolvedValue("claude-auto/test-job/2026-03-21T00-00-00");
		mockedHasChanges.mockResolvedValue(true);
		mockedHasCommitsAhead.mockResolvedValue(false);
		mockedGetFirstCommitSubject.mockResolvedValue("");
		mockedPushBranch.mockResolvedValue(undefined);
		mockedCreatePR.mockResolvedValue("https://github.com/test/repo/pull/42");
		mockedSpawnClaude.mockResolvedValue(makeDefaultSpawnResult());
		mockedBuildAllowedTools.mockReturnValue(["Read", "Edit", "Write"]);
		mockedBuildWorkPrompt.mockReturnValue("Do some work");
		mockedBuildSystemPrompt.mockReturnValue("You are an autonomous agent");
		mockedWriteRunLog.mockResolvedValue(undefined);
		mockedExecCommand.mockResolvedValue({ stdout: "", stderr: "" });
		mockedCheckBudget.mockReturnValue(false);
		mockedLoadRunContext.mockReturnValue([]);
		mockedCheckPendingPRFeedback.mockResolvedValue(null);
		mockedPostPRComment.mockResolvedValue(undefined);
		mockedTriageIssues.mockResolvedValue([]);
		mockedCheckoutExistingBranch.mockResolvedValue(undefined);
		mockedBuildFeedbackPrompt.mockReturnValue("Address PR feedback");
		mockedBuildTriagedWorkPrompt.mockReturnValue("Do triaged work");
		mockedAttemptRebase.mockResolvedValue({ diverged: false, rebased: false, conflicts: [] });
		mockedRunPipeline.mockResolvedValue(makeDefaultPipelineResult());
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns locked status when lock unavailable", async () => {
		mockedAcquireLock.mockResolvedValue(null);

		const result = await executeRun("test-job");

		expect(result.status).toBe("locked");
		expect(result.jobId).toBe("test-job");
		expect(result.runId).toBeDefined();
		expect(result.startedAt).toBeDefined();
		expect(result.completedAt).toBeDefined();
		expect(result.durationMs).toBeGreaterThanOrEqual(0);
		expect(mockedWriteRunLog).toHaveBeenCalledWith(
			"test-job",
			expect.objectContaining({ status: "locked" }),
		);
		// Should not call any other functions
		expect(mockedLoadJobConfig).not.toHaveBeenCalled();
		expect(mockedPullLatest).not.toHaveBeenCalled();
	});

	it("executes full success path with PR", async () => {
		const result = await executeRun("test-job");

		expect(result.status).toBe("success");
		expect(result.prUrl).toBe("https://github.com/test/repo/pull/42");
		expect(result.summary).toBe("Fixed null check bug in utils.ts");
		expect(result.costUsd).toBe(1.5);
		expect(result.numTurns).toBe(12);
		expect(result.sessionId).toBe("session-abc-123");
		expect(result.branchName).toBe("claude-auto/test-job/2026-03-21T00-00-00");

		// Verify call order
		expect(mockedAcquireLock).toHaveBeenCalledWith("test-job");
		expect(mockedLoadJobConfig).toHaveBeenCalled();
		expect(mockedPullLatest).toHaveBeenCalledWith("/tmp/test-repo", "main", "origin");
		expect(mockedCreateBranch).toHaveBeenCalledWith("/tmp/test-repo", "test-job");
		expect(mockedBuildTriagedWorkPrompt).toHaveBeenCalled();
		expect(mockedBuildSystemPrompt).toHaveBeenCalled();
		expect(mockedBuildAllowedTools).toHaveBeenCalled();
		expect(mockedSpawnClaude).toHaveBeenCalled();
		expect(mockedHasChanges).toHaveBeenCalledWith("/tmp/test-repo");
		expect(mockedPushBranch).toHaveBeenCalledWith(
			"/tmp/test-repo",
			"claude-auto/test-job/2026-03-21T00-00-00",
			"origin",
		);
		expect(mockedCreatePR).toHaveBeenCalled();
		expect(mockedWriteRunLog).toHaveBeenCalledWith(
			"test-job",
			expect.objectContaining({ status: "success" }),
		);
	});

	it("returns no-changes when Claude makes no changes", async () => {
		mockedHasChanges.mockResolvedValue(false);

		const result = await executeRun("test-job");

		expect(result.status).toBe("no-changes");
		expect(result.prUrl).toBeUndefined();
		expect(mockedPushBranch).not.toHaveBeenCalled();
		expect(mockedCreatePR).not.toHaveBeenCalled();
		expect(mockedWriteRunLog).toHaveBeenCalledWith(
			"test-job",
			expect.objectContaining({ status: "no-changes" }),
		);
	});

	it("returns git-error on pull failure", async () => {
		mockedPullLatest.mockRejectedValue(
			new GitOpsError("pullLatest", "/tmp/test-repo", "merge conflict"),
		);

		const result = await executeRun("test-job");

		expect(result.status).toBe("git-error");
		expect(result.error).toContain("pullLatest");
	});

	it("returns error on spawn failure", async () => {
		mockedSpawnClaude.mockRejectedValue(new Error("Claude process crashed"));

		const result = await executeRun("test-job");

		expect(result.status).toBe("error");
		expect(result.error).toBe("Claude process crashed");
	});

	it("always releases lock even on error", async () => {
		mockedPullLatest.mockRejectedValue(
			new GitOpsError("pullLatest", "/tmp/test-repo", "network error"),
		);

		await executeRun("test-job");

		expect(mockReleaseLock).toHaveBeenCalled();
	});

	it("always writes run log even on error", async () => {
		mockedSpawnClaude.mockRejectedValue(new Error("spawn failed"));

		await executeRun("test-job");

		expect(mockedWriteRunLog).toHaveBeenCalledWith(
			"test-job",
			expect.objectContaining({ status: "error" }),
		);
	});

	it("cleans up branch on error after branch creation", async () => {
		mockedSpawnClaude.mockRejectedValue(new Error("spawn failed"));

		await executeRun("test-job");

		// Should attempt to checkout base branch and delete work branch
		expect(mockedExecCommand).toHaveBeenCalledWith("git", [
			"-C",
			"/tmp/test-repo",
			"checkout",
			"main",
		]);
		expect(mockedExecCommand).toHaveBeenCalledWith("git", [
			"-C",
			"/tmp/test-repo",
			"branch",
			"-D",
			"claude-auto/test-job/2026-03-21T00-00-00",
		]);
	});

	it("passes correct SpawnOptions to spawnClaude", async () => {
		await executeRun("test-job");

		expect(mockedSpawnClaude).toHaveBeenCalledWith({
			cwd: "/tmp/test-repo",
			prompt: "Do triaged work",
			maxTurns: 50,
			maxBudgetUsd: 5.0,
			allowedTools: ["Read", "Edit", "Write"],
			appendSystemPrompt: "You are an autonomous agent",
			model: undefined,
		});
	});

	// --- Notification integration tests ---

	it("calls sendNotifications after successful run", async () => {
		const result = await executeRun("test-job");

		expect(result.status).toBe("success");
		expect(mockedSendNotifications).toHaveBeenCalledWith(
			expect.objectContaining({ id: "test-job" }),
			expect.objectContaining({ status: "success" }),
		);
	});

	it("calls sendNotifications after error run", async () => {
		mockedSpawnClaude.mockRejectedValue(new Error("Claude process crashed"));

		const result = await executeRun("test-job");

		expect(result.status).toBe("error");
		expect(mockedSendNotifications).toHaveBeenCalledWith(
			expect.objectContaining({ id: "test-job" }),
			expect.objectContaining({ status: "error" }),
		);
	});

	it("calls sendNotifications after no-changes run", async () => {
		mockedHasChanges.mockResolvedValue(false);

		const result = await executeRun("test-job");

		expect(result.status).toBe("no-changes");
		expect(mockedSendNotifications).toHaveBeenCalledWith(
			expect.objectContaining({ id: "test-job" }),
			expect.objectContaining({ status: "no-changes" }),
		);
	});

	it("does not call sendNotifications when run is locked", async () => {
		mockedAcquireLock.mockResolvedValue(null);

		const result = await executeRun("test-job");

		expect(result.status).toBe("locked");
		expect(mockedSendNotifications).not.toHaveBeenCalled();
	});

	it("calls postIssueComment when issue number extracted from summary", async () => {
		mockedExtractIssueNumber.mockReturnValue(42);

		await executeRun("test-job");

		expect(mockedPostIssueComment).toHaveBeenCalledWith(
			expect.objectContaining({
				repoPath: "/tmp/test-repo",
				issueNumber: 42,
				status: "success",
				prUrl: "https://github.com/test/repo/pull/42",
				jobName: "Test Job",
			}),
		);
	});

	it("does not throw when sendNotifications rejects", async () => {
		mockedSendNotifications.mockRejectedValue(new Error("webhook down"));

		const result = await executeRun("test-job");

		// Should still return a valid result
		expect(result.status).toBe("success");
		expect(result.prUrl).toBe("https://github.com/test/repo/pull/42");
	});

	it("sets issueNumber on result when extracted", async () => {
		mockedExtractIssueNumber.mockReturnValue(7);

		const result = await executeRun("test-job");

		expect(result.issueNumber).toBe(7);
	});

	it("returns paused status when config.enabled is false", async () => {
		mockedLoadJobConfig.mockResolvedValue(makeDefaultConfig());
		vi.mocked(mockedLoadJobConfig).mockResolvedValue({
			...makeDefaultConfig(),
			enabled: false,
		});

		const result = await executeRun("test-job");

		expect(result.status).toBe("paused");
		expect(result.jobId).toBe("test-job");
		expect(result.runId).toBeDefined();
		expect(result.startedAt).toBeDefined();
		expect(result.completedAt).toBeDefined();
		expect(result.durationMs).toBeGreaterThanOrEqual(0);
	});

	it("does not call pullLatest or spawnClaude when paused", async () => {
		mockedLoadJobConfig.mockResolvedValue({
			...makeDefaultConfig(),
			enabled: false,
		});

		await executeRun("test-job");

		expect(mockedPullLatest).not.toHaveBeenCalled();
		expect(mockedCreateBranch).not.toHaveBeenCalled();
		expect(mockedSpawnClaude).not.toHaveBeenCalled();
	});

	it("writes run log with paused status", async () => {
		mockedLoadJobConfig.mockResolvedValue({
			...makeDefaultConfig(),
			enabled: false,
		});

		await executeRun("test-job");

		expect(mockedWriteRunLog).toHaveBeenCalledWith(
			"test-job",
			expect.objectContaining({ status: "paused" }),
		);
	});

	it("releases lock when paused", async () => {
		mockedLoadJobConfig.mockResolvedValue({
			...makeDefaultConfig(),
			enabled: false,
		});

		await executeRun("test-job");

		expect(mockReleaseLock).toHaveBeenCalled();
	});

	it("calls sendNotifications after git-error run", async () => {
		mockedPullLatest.mockRejectedValue(
			new GitOpsError("pullLatest", "/tmp/test-repo", "merge conflict"),
		);

		const result = await executeRun("test-job");

		expect(result.status).toBe("git-error");
		expect(mockedSendNotifications).toHaveBeenCalledWith(
			expect.objectContaining({ id: "test-job" }),
			expect.objectContaining({ status: "git-error" }),
		);
	});

	// --- Budget, context, and model integration tests ---

	it("returns budget-exceeded when checkBudget returns true", async () => {
		mockedLoadJobConfig.mockResolvedValue({
			...makeDefaultConfig(),
			budget: { dailyUsd: 5 },
		});
		mockedCheckBudget.mockReturnValue(true);

		const result = await executeRun("test-job");

		expect(result.status).toBe("budget-exceeded");
		expect(mockedCheckBudget).toHaveBeenCalledWith("test-job", { dailyUsd: 5 });
		expect(mockedSpawnClaude).not.toHaveBeenCalled();
		expect(mockedWriteRunLog).toHaveBeenCalledWith(
			"test-job",
			expect.objectContaining({ status: "budget-exceeded" }),
		);
		expect(mockedSendNotifications).toHaveBeenCalledWith(
			expect.objectContaining({ id: "test-job" }),
			expect.objectContaining({ status: "budget-exceeded" }),
		);
	});

	it("calls loadRunContext and passes result to buildTriagedWorkPrompt", async () => {
		const mockContext = [
			{
				id: "run-1",
				status: "success",
				pr_url: "https://github.com/test/pull/1",
				branch_name: "auto/fix-1",
				issue_number: 10,
				summary: "Fixed issue 10",
				started_at: "2026-03-20T12:00:00Z",
			},
		];
		mockedLoadRunContext.mockReturnValue(mockContext);

		await executeRun("test-job");

		expect(mockedLoadRunContext).toHaveBeenCalledWith("test-job");
		expect(mockedBuildTriagedWorkPrompt).toHaveBeenCalledWith(
			expect.objectContaining({ id: "test-job" }),
			[],
			mockContext,
		);
	});

	it("passes config.model to spawnClaude options", async () => {
		mockedLoadJobConfig.mockResolvedValue({
			...makeDefaultConfig(),
			model: "opus",
		});

		await executeRun("test-job");

		expect(mockedSpawnClaude).toHaveBeenCalledWith(expect.objectContaining({ model: "opus" }));
	});

	it("records model in RunResult", async () => {
		mockedLoadJobConfig.mockResolvedValue({
			...makeDefaultConfig(),
			model: "sonnet",
		});

		const result = await executeRun("test-job");

		expect(result.model).toBe("sonnet");
	});

	// --- PR Feedback Priority tests ---

	it("checks for PR feedback before creating new branch", async () => {
		const feedbackCtx = {
			number: 42,
			title: "Fix auth bug",
			headRefName: "claude-auto/test-job/2026-03-20T00-00-00",
			url: "https://github.com/test/repo/pull/42",
			reviewDecision: "CHANGES_REQUESTED",
			unresolvedThreads: [
				{
					id: "thread-1",
					isResolved: false,
					comments: [{ body: "Fix this", author: { login: "reviewer" } }],
				},
			],
			currentRound: 0,
		};
		mockedCheckPendingPRFeedback.mockResolvedValue(feedbackCtx);

		const result = await executeRun("test-job");

		// Should checkout existing branch, not create new
		expect(mockedCheckoutExistingBranch).toHaveBeenCalledWith(
			"/tmp/test-repo",
			"claude-auto/test-job/2026-03-20T00-00-00",
			"origin",
		);
		expect(mockedCreateBranch).not.toHaveBeenCalled();

		// Should use feedback prompt
		expect(mockedBuildFeedbackPrompt).toHaveBeenCalled();
		expect(mockedBuildTriagedWorkPrompt).not.toHaveBeenCalled();

		// Should post PR comment after push
		expect(mockedPostPRComment).toHaveBeenCalledWith(
			"/tmp/test-repo",
			42,
			expect.stringContaining("Feedback Addressed"),
		);

		// Result should have feedback info
		expect(result.feedbackRound).toBe(1);
		expect(result.prNumber).toBe(42);
		expect(result.status).toBe("success");
	});

	it("returns needs-human-review when max rounds exceeded", async () => {
		const feedbackCtx = {
			number: 42,
			title: "Fix auth bug",
			headRefName: "claude-auto/test-job/2026-03-20T00-00-00",
			url: "https://github.com/test/repo/pull/42",
			reviewDecision: "CHANGES_REQUESTED",
			unresolvedThreads: [
				{
					id: "thread-1",
					isResolved: false,
					comments: [{ body: "Fix this", author: { login: "reviewer" } }],
				},
			],
			currentRound: 3, // nextRound will be 4, which exceeds default max of 3
		};
		mockedCheckPendingPRFeedback.mockResolvedValue(feedbackCtx);

		const result = await executeRun("test-job");

		expect(result.status).toBe("needs-human-review");
		expect(result.prNumber).toBe(42);
		expect(result.feedbackRound).toBe(4);

		// Should post "max iterations" message
		expect(mockedPostPRComment).toHaveBeenCalledWith(
			"/tmp/test-repo",
			42,
			expect.stringContaining("maximum feedback iteration limit"),
		);

		// Should NOT spawn Claude
		expect(mockedSpawnClaude).not.toHaveBeenCalled();
		expect(mockedCheckoutExistingBranch).not.toHaveBeenCalled();
	});

	it("falls through to triaged work when no PR feedback", async () => {
		mockedCheckPendingPRFeedback.mockResolvedValue(null);
		const scoredIssues = [
			{ number: 10, title: "Bug fix", body: "Fix it", labels: ["bug"], score: 80 },
		];
		mockedTriageIssues.mockResolvedValue(scoredIssues);

		await executeRun("test-job");

		// Should use triaged work prompt
		expect(mockedBuildTriagedWorkPrompt).toHaveBeenCalledWith(
			expect.objectContaining({ id: "test-job" }),
			scoredIssues,
			expect.any(Array),
		);
		expect(mockedBuildFeedbackPrompt).not.toHaveBeenCalled();

		// Should create a new branch (normal flow)
		expect(mockedCreateBranch).toHaveBeenCalled();
	});

	it("falls through to generic work prompt when triage returns empty", async () => {
		mockedCheckPendingPRFeedback.mockResolvedValue(null);
		mockedTriageIssues.mockResolvedValue([]);

		await executeRun("test-job");

		expect(mockedBuildTriagedWorkPrompt).toHaveBeenCalledWith(
			expect.objectContaining({ id: "test-job" }),
			[],
			expect.any(Array),
		);
	});

	it("PR feedback check is best-effort (errors fall through)", async () => {
		mockedCheckPendingPRFeedback.mockRejectedValue(new Error("gh not found"));

		const result = await executeRun("test-job");

		// Should proceed with normal work flow
		expect(result.status).toBe("success");
		expect(mockedCreateBranch).toHaveBeenCalled();
	});

	it("triage is best-effort (errors fall through)", async () => {
		mockedCheckPendingPRFeedback.mockResolvedValue(null);
		mockedTriageIssues.mockRejectedValue(new Error("gh not found"));

		const result = await executeRun("test-job");

		// Should proceed with empty triage
		expect(result.status).toBe("success");
		expect(mockedBuildTriagedWorkPrompt).toHaveBeenCalledWith(
			expect.objectContaining({ id: "test-job" }),
			[],
			expect.any(Array),
		);
	});

	it("does not cleanup feedback branch on error", async () => {
		const feedbackCtx = {
			number: 42,
			title: "Fix auth bug",
			headRefName: "claude-auto/test-job/2026-03-20T00-00-00",
			url: "https://github.com/test/repo/pull/42",
			reviewDecision: "CHANGES_REQUESTED",
			unresolvedThreads: [
				{
					id: "thread-1",
					isResolved: false,
					comments: [{ body: "Fix this", author: { login: "reviewer" } }],
				},
			],
			currentRound: 0,
		};
		mockedCheckPendingPRFeedback.mockResolvedValue(feedbackCtx);
		mockedSpawnClaude.mockRejectedValue(new Error("spawn failed"));

		await executeRun("test-job");

		// Should NOT delete the feedback branch (it belongs to existing PR)
		expect(mockedExecCommand).not.toHaveBeenCalledWith(
			"git",
			expect.arrayContaining(["branch", "-D"]),
		);
	});

	// --- Pipeline mode tests ---

	describe("pipeline mode", () => {
		function makePipelineConfig(overrides: Record<string, unknown> = {}): JobConfig {
			return {
				...makeDefaultConfig(),
				pipeline: {
					enabled: true,
					planModel: "opus",
					implementModel: "sonnet",
					reviewModel: "sonnet",
					maxReviewRounds: 1,
				},
				...overrides,
			} as JobConfig;
		}

		it("calls runPipeline when config.pipeline.enabled is true", async () => {
			mockedLoadJobConfig.mockResolvedValue(makePipelineConfig());

			const result = await executeRun("test-job");

			expect(mockedRunPipeline).toHaveBeenCalled();
			expect(mockedSpawnClaude).not.toHaveBeenCalled();
			expect(result.status).toBe("success");
		});

		it("uses pipeline by default when config.pipeline is undefined", async () => {
			// Config without pipeline field should default to pipeline enabled
			const config = makeDefaultConfig();
			delete (config as Record<string, unknown>).pipeline;
			mockedLoadJobConfig.mockResolvedValue(config);

			await executeRun("test-job");

			expect(mockedRunPipeline).toHaveBeenCalled();
			expect(mockedSpawnClaude).not.toHaveBeenCalled();
		});

		it("uses single spawnClaude when config.pipeline.enabled is false", async () => {
			mockedLoadJobConfig.mockResolvedValue(
				makePipelineConfig({
					pipeline: {
						enabled: false,
						planModel: "opus",
						implementModel: "sonnet",
						reviewModel: "sonnet",
					},
				}),
			);

			await executeRun("test-job");

			expect(mockedRunPipeline).not.toHaveBeenCalled();
			expect(mockedSpawnClaude).toHaveBeenCalled();
		});

		it("passes config, repoPath, branchName, runContext, triaged to runPipeline", async () => {
			const config = makePipelineConfig();
			mockedLoadJobConfig.mockResolvedValue(config);
			const mockContext = [
				{
					id: "run-1",
					status: "success",
					pr_url: null,
					branch_name: "auto/fix",
					issue_number: null,
					summary: "Did work",
					started_at: "2026-03-20T12:00:00Z",
				},
			];
			mockedLoadRunContext.mockReturnValue(mockContext);
			const scoredIssues = [{ number: 5, title: "Bug", body: "Fix", labels: ["bug"], score: 70 }];
			mockedTriageIssues.mockResolvedValue(scoredIssues);

			await executeRun("test-job");

			expect(mockedRunPipeline).toHaveBeenCalledWith(
				config,
				"/tmp/test-repo",
				"claude-auto/test-job/2026-03-21T00-00-00",
				mockContext,
				scoredIssues,
			);
		});

		it("creates PR with pipeline summary when changes exist", async () => {
			mockedLoadJobConfig.mockResolvedValue(makePipelineConfig());
			mockedHasChanges.mockResolvedValue(true);

			const result = await executeRun("test-job");

			expect(mockedPushBranch).toHaveBeenCalled();
			expect(mockedCreatePR).toHaveBeenCalledWith(
				"/tmp/test-repo",
				"claude-auto/test-job/2026-03-21T00-00-00",
				"main",
				expect.stringContaining("[claude-auto]"),
				expect.stringContaining("Pipeline Stages"),
			);
			expect(result.status).toBe("success");
			expect(result.prUrl).toBe("https://github.com/test/repo/pull/42");
		});

		it("uses PipelineResult.totalCostUsd and totalDurationMs in RunResult", async () => {
			mockedLoadJobConfig.mockResolvedValue(makePipelineConfig());

			const result = await executeRun("test-job");

			expect(result.costUsd).toBe(2.8);
		});

		it("includes pipelineStages in RunResult with per-stage cost/duration", async () => {
			mockedLoadJobConfig.mockResolvedValue(makePipelineConfig());

			const result = await executeRun("test-job");

			expect(result.pipelineStages).toBeDefined();
			expect(result.pipelineStages).toHaveLength(3);
			expect(result.pipelineStages?.[0]).toEqual(
				expect.objectContaining({
					stage: "plan",
					costUsd: 0.5,
					durationMs: 10000,
					numTurns: 5,
				}),
			);
		});

		it("returns no-changes when pipeline produces no changes", async () => {
			mockedLoadJobConfig.mockResolvedValue(makePipelineConfig());
			mockedHasChanges.mockResolvedValue(false);

			const result = await executeRun("test-job");

			expect(result.status).toBe("no-changes");
			expect(mockedPushBranch).not.toHaveBeenCalled();
			expect(mockedCreatePR).not.toHaveBeenCalled();
		});

		it("does not apply pipeline to PR feedback path", async () => {
			mockedLoadJobConfig.mockResolvedValue(makePipelineConfig());
			const feedbackCtx = {
				number: 42,
				title: "Fix auth bug",
				headRefName: "claude-auto/test-job/2026-03-20T00-00-00",
				url: "https://github.com/test/repo/pull/42",
				reviewDecision: "CHANGES_REQUESTED",
				unresolvedThreads: [
					{
						id: "thread-1",
						isResolved: false,
						comments: [{ body: "Fix this", author: { login: "reviewer" } }],
					},
				],
				currentRound: 0,
			};
			mockedCheckPendingPRFeedback.mockResolvedValue(feedbackCtx);

			await executeRun("test-job");

			// Feedback path uses single spawnClaude, not pipeline
			expect(mockedRunPipeline).not.toHaveBeenCalled();
			expect(mockedSpawnClaude).toHaveBeenCalled();
		});
	});

	// --- Merge conflict resolution tests ---

	describe("merge conflict resolution", () => {
		it("calls attemptRebase before push on normal path", async () => {
			await executeRun("test-job");

			expect(mockedAttemptRebase).toHaveBeenCalledWith("/tmp/test-repo", "main", "origin");
		});

		it("calls attemptRebase before push on pipeline path", async () => {
			mockedLoadJobConfig.mockResolvedValue({
				...makeDefaultConfig(),
				pipeline: {
					enabled: true,
					planModel: "opus",
					implementModel: "sonnet",
					reviewModel: "sonnet",
					maxReviewRounds: 1,
				},
			} as JobConfig);

			await executeRun("test-job");

			expect(mockedAttemptRebase).toHaveBeenCalledWith("/tmp/test-repo", "main", "origin");
		});

		it("calls attemptRebase with repo remote (not branch name) on feedback path", async () => {
			const feedbackCtx = {
				number: 42,
				title: "Fix auth bug",
				headRefName: "claude-auto/test-job/2026-03-20T00-00-00",
				url: "https://github.com/test/repo/pull/42",
				reviewDecision: "CHANGES_REQUESTED",
				unresolvedThreads: [
					{
						id: "thread-1",
						isResolved: false,
						comments: [{ body: "Fix this", author: { login: "reviewer" } }],
					},
				],
				currentRound: 0,
			};
			mockedCheckPendingPRFeedback.mockResolvedValue(feedbackCtx);

			await executeRun("test-job");

			// Must pass config.repo.remote ("origin"), NOT feedback.headRefName
			expect(mockedAttemptRebase).toHaveBeenCalledWith("/tmp/test-repo", "main", "origin");
		});

		it("proceeds with push when attemptRebase returns diverged:true, rebased:true", async () => {
			mockedAttemptRebase.mockResolvedValue({ diverged: true, rebased: true, conflicts: [] });

			const result = await executeRun("test-job");

			expect(result.status).toBe("success");
			expect(mockedPushBranch).toHaveBeenCalled();
			expect(mockedCreatePR).toHaveBeenCalled();
		});

		it("returns merge-conflict when attemptRebase returns diverged:true, rebased:false", async () => {
			mockedAttemptRebase.mockResolvedValue({
				diverged: true,
				rebased: false,
				conflicts: ["src/index.ts", "src/utils.ts"],
			});

			const result = await executeRun("test-job");

			expect(result.status).toBe("merge-conflict");
			expect(result.error).toContain("Merge conflict");
			expect(result.error).toContain("src/index.ts");
			expect(result.error).toContain("src/utils.ts");
			expect(mockedPushBranch).not.toHaveBeenCalled();
			expect(mockedCreatePR).not.toHaveBeenCalled();
		});

		it("merge-conflict triggers notification", async () => {
			mockedAttemptRebase.mockResolvedValue({
				diverged: true,
				rebased: false,
				conflicts: ["src/index.ts"],
			});

			await executeRun("test-job");

			expect(mockedSendNotifications).toHaveBeenCalledWith(
				expect.objectContaining({ id: "test-job" }),
				expect.objectContaining({ status: "merge-conflict" }),
			);
		});

		it("proceeds with push when attemptRebase returns diverged:false", async () => {
			mockedAttemptRebase.mockResolvedValue({ diverged: false, rebased: false, conflicts: [] });

			const result = await executeRun("test-job");

			expect(result.status).toBe("success");
			expect(mockedPushBranch).toHaveBeenCalled();
		});

		it("proceeds with push when attemptRebase throws (best-effort)", async () => {
			mockedAttemptRebase.mockRejectedValue(new Error("git fetch failed"));

			const result = await executeRun("test-job");

			expect(result.status).toBe("success");
			expect(mockedPushBranch).toHaveBeenCalled();
		});

		it("does not call attemptRebase when no changes to push", async () => {
			mockedHasChanges.mockResolvedValue(false);

			await executeRun("test-job");

			expect(mockedAttemptRebase).not.toHaveBeenCalled();
		});

		it("returns merge-conflict on pipeline path with conflict details", async () => {
			mockedLoadJobConfig.mockResolvedValue({
				...makeDefaultConfig(),
				pipeline: {
					enabled: true,
					planModel: "opus",
					implementModel: "sonnet",
					reviewModel: "sonnet",
					maxReviewRounds: 1,
				},
			} as JobConfig);
			mockedAttemptRebase.mockResolvedValue({
				diverged: true,
				rebased: false,
				conflicts: ["README.md"],
			});

			const result = await executeRun("test-job");

			expect(result.status).toBe("merge-conflict");
			expect(result.error).toContain("README.md");
			expect(result.pipelineStages).toBeDefined();
			expect(mockedPushBranch).not.toHaveBeenCalled();
		});
	});

	// --- All existing tests continue to pass verification ---

	it("uses pipeline by default when no pipeline config provided", async () => {
		// Config without pipeline field defaults to pipeline enabled
		const config = makeDefaultConfig();
		delete (config as Record<string, unknown>).pipeline;
		mockedLoadJobConfig.mockResolvedValue(config);
		const result = await executeRun("test-job");
		expect(result.status).toBe("success");
		expect(mockedRunPipeline).toHaveBeenCalled();
		expect(mockedSpawnClaude).not.toHaveBeenCalled();
	});
});
