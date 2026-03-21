import { execCommand } from "../util/exec.js";
import { GitOpsError } from "../util/errors.js";

/**
 * Pull latest changes from remote branch.
 * Runs: git fetch, git checkout, git pull --ff-only (in order).
 */
export async function pullLatest(repoPath: string, branch: string, remote: string): Promise<void> {
	try {
		await execCommand("git", ["-C", repoPath, "fetch", remote]);
		await execCommand("git", ["-C", repoPath, "checkout", branch]);
		await execCommand("git", ["-C", repoPath, "pull", "--ff-only", remote, branch]);
	} catch (err) {
		throw new GitOpsError(
			"pullLatest",
			repoPath,
			err instanceof Error ? err.message : String(err),
			err instanceof Error ? err : undefined,
		);
	}
}

/**
 * Create a new branch for this run.
 * Branch name format: claude-auto/{jobId}/{ISO-timestamp}
 */
export async function createBranch(repoPath: string, jobId: string): Promise<string> {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
	const branchName = `claude-auto/${jobId}/${timestamp}`;

	try {
		await execCommand("git", ["-C", repoPath, "checkout", "-b", branchName]);
	} catch (err) {
		throw new GitOpsError(
			"createBranch",
			repoPath,
			err instanceof Error ? err.message : String(err),
			err instanceof Error ? err : undefined,
		);
	}

	return branchName;
}

/**
 * Check if the working tree has uncommitted changes.
 */
export async function hasChanges(repoPath: string): Promise<boolean> {
	try {
		const { stdout } = await execCommand("git", ["-C", repoPath, "status", "--porcelain"]);
		return stdout.trim().length > 0;
	} catch (err) {
		throw new GitOpsError(
			"hasChanges",
			repoPath,
			err instanceof Error ? err.message : String(err),
			err instanceof Error ? err : undefined,
		);
	}
}

/**
 * Push branch to origin with upstream tracking.
 * Safety: only uses -u flag, no destructive push flags.
 */
export async function pushBranch(repoPath: string, branchName: string): Promise<void> {
	try {
		await execCommand("git", ["-C", repoPath, "push", "-u", "origin", branchName]);
	} catch (err) {
		throw new GitOpsError(
			"pushBranch",
			repoPath,
			err instanceof Error ? err.message : String(err),
			err instanceof Error ? err : undefined,
		);
	}
}

/**
 * Create a pull request via GitHub CLI.
 * Returns the PR URL.
 */
export async function createPR(
	repoPath: string,
	branchName: string,
	baseBranch: string,
	title: string,
	body: string,
): Promise<string> {
	try {
		const { stdout } = await execCommand(
			"gh",
			["pr", "create", "--head", branchName, "--base", baseBranch, "--title", title, "--body", body],
			{ cwd: repoPath },
		);
		return stdout.trim();
	} catch (err) {
		throw new GitOpsError(
			"createPR",
			repoPath,
			err instanceof Error ? err.message : String(err),
			err instanceof Error ? err : undefined,
		);
	}
}
