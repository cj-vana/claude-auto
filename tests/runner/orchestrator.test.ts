import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobConfig } from "../../src/core/types.js";
import { GitOpsError } from "../../src/util/errors.js";
import type { SpawnResult } from "../../src/runner/types.js";

// Mock all dependencies
vi.mock("nanoid", () => ({
	nanoid: vi.fn(() => "test-run-id12"),
}));

vi.mock("../../src/runner/lock.js", () => ({
	acquireLock: vi.fn(),
}));

vi.mock("../../src/runner/git-ops.js", () => ({
	pullLatest: vi.fn(),
	createBranch: vi.fn(),
	hasChanges: vi.fn(),
	pushBranch: vi.fn(),
	createPR: vi.fn(),
}));

vi.mock("../../src/runner/spawner.js", () => ({
	spawnClaude: vi.fn(),
	buildAllowedTools: vi.fn(),
}));

vi.mock("../../src/runner/prompt-builder.js", () => ({
	buildWorkPrompt: vi.fn(),
	buildSystemPrompt: vi.fn(),
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

// Import mocked modules after mock declarations
import { acquireLock } from "../../src/runner/lock.js";
import { pullLatest, createBranch, hasChanges, pushBranch, createPR } from "../../src/runner/git-ops.js";
import { spawnClaude, buildAllowedTools } from "../../src/runner/spawner.js";
import { buildWorkPrompt, buildSystemPrompt } from "../../src/runner/prompt-builder.js";
import { writeRunLog } from "../../src/runner/logger.js";
import { loadJobConfig } from "../../src/core/config.js";
import { execCommand } from "../../src/util/exec.js";
import { sendNotifications } from "../../src/notifications/dispatcher.js";
import { extractIssueNumber, postIssueComment } from "../../src/notifications/issue-comment.js";
import { checkBudget } from "../../src/runner/cost-tracker.js";
import { loadRunContext } from "../../src/runner/context-store.js";
import { executeRun } from "../../src/runner/orchestrator.js";

const mockedAcquireLock = vi.mocked(acquireLock);
const mockedLoadJobConfig = vi.mocked(loadJobConfig);
const mockedPullLatest = vi.mocked(pullLatest);
const mockedCreateBranch = vi.mocked(createBranch);
const mockedHasChanges = vi.mocked(hasChanges);
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

const mockReleaseLock = vi.fn().mockResolvedValue(undefined);

describe("executeRun", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Default mocks: everything succeeds
		mockedAcquireLock.mockResolvedValue(mockReleaseLock);
		mockedLoadJobConfig.mockResolvedValue(makeDefaultConfig());
		mockedPullLatest.mockResolvedValue(undefined);
		mockedCreateBranch.mockResolvedValue("claude-auto/test-job/2026-03-21T00-00-00");
		mockedHasChanges.mockResolvedValue(true);
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
		expect(mockedWriteRunLog).toHaveBeenCalledWith("test-job", expect.objectContaining({ status: "locked" }));
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
		expect(mockedBuildWorkPrompt).toHaveBeenCalled();
		expect(mockedBuildSystemPrompt).toHaveBeenCalled();
		expect(mockedBuildAllowedTools).toHaveBeenCalled();
		expect(mockedSpawnClaude).toHaveBeenCalled();
		expect(mockedHasChanges).toHaveBeenCalledWith("/tmp/test-repo");
		expect(mockedPushBranch).toHaveBeenCalledWith("/tmp/test-repo", "claude-auto/test-job/2026-03-21T00-00-00");
		expect(mockedCreatePR).toHaveBeenCalled();
		expect(mockedWriteRunLog).toHaveBeenCalledWith("test-job", expect.objectContaining({ status: "success" }));
	});

	it("returns no-changes when Claude makes no changes", async () => {
		mockedHasChanges.mockResolvedValue(false);

		const result = await executeRun("test-job");

		expect(result.status).toBe("no-changes");
		expect(result.prUrl).toBeUndefined();
		expect(mockedPushBranch).not.toHaveBeenCalled();
		expect(mockedCreatePR).not.toHaveBeenCalled();
		expect(mockedWriteRunLog).toHaveBeenCalledWith("test-job", expect.objectContaining({ status: "no-changes" }));
	});

	it("returns git-error on pull failure", async () => {
		mockedPullLatest.mockRejectedValue(new GitOpsError("pullLatest", "/tmp/test-repo", "merge conflict"));

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
		mockedPullLatest.mockRejectedValue(new GitOpsError("pullLatest", "/tmp/test-repo", "network error"));

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
		expect(mockedExecCommand).toHaveBeenCalledWith("git", ["-C", "/tmp/test-repo", "checkout", "main"]);
		expect(mockedExecCommand).toHaveBeenCalledWith("git", ["-C", "/tmp/test-repo", "branch", "-D", "claude-auto/test-job/2026-03-21T00-00-00"]);
	});

	it("passes correct SpawnOptions to spawnClaude", async () => {
		await executeRun("test-job");

		expect(mockedSpawnClaude).toHaveBeenCalledWith({
			cwd: "/tmp/test-repo",
			prompt: "Do some work",
			maxTurns: 50,
			maxBudgetUsd: 5.0,
			allowedTools: ["Read", "Edit", "Write"],
			appendSystemPrompt: "You are an autonomous agent",
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
		mockedPullLatest.mockRejectedValue(new GitOpsError("pullLatest", "/tmp/test-repo", "merge conflict"));

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

	it("calls loadRunContext and passes result to buildWorkPrompt", async () => {
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
		expect(mockedBuildWorkPrompt).toHaveBeenCalledWith(
			expect.objectContaining({ id: "test-job" }),
			mockContext,
		);
	});

	it("passes config.model to spawnClaude options", async () => {
		mockedLoadJobConfig.mockResolvedValue({
			...makeDefaultConfig(),
			model: "opus",
		});

		await executeRun("test-job");

		expect(mockedSpawnClaude).toHaveBeenCalledWith(
			expect.objectContaining({ model: "opus" }),
		);
	});

	it("records model in RunResult", async () => {
		mockedLoadJobConfig.mockResolvedValue({
			...makeDefaultConfig(),
			model: "sonnet",
		});

		const result = await executeRun("test-job");

		expect(result.model).toBe("sonnet");
	});
});
