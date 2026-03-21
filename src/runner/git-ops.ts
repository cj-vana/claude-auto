import { GitOpsError } from "../util/errors.js";
import { execCommand } from "../util/exec.js";
import type { RebaseResult } from "./types.js";

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
 * Checkout an existing branch (e.g., a PR branch) and reset to match remote.
 * Used for PR feedback iteration -- safely switches to the existing PR branch.
 *
 * Steps:
 * 1. Fetch the latest state of the branch from origin
 * 2. Checkout the branch (may already exist locally or be created from remote tracking)
 * 3. Hard reset to match origin exactly (safe because claude-auto never has local-only state)
 */
export async function checkoutExistingBranch(repoPath: string, branchName: string): Promise<void> {
	try {
		await execCommand("git", ["-C", repoPath, "fetch", "origin", branchName]);
		await execCommand("git", ["-C", repoPath, "checkout", branchName]);
		await execCommand("git", ["-C", repoPath, "reset", "--hard", `origin/${branchName}`]);
	} catch (err) {
		throw new GitOpsError(
			"checkoutExistingBranch",
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
			[
				"pr",
				"create",
				"--head",
				branchName,
				"--base",
				baseBranch,
				"--title",
				title,
				"--body",
				body,
			],
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

/**
 * Check if the target branch has diverged from the current branch.
 * Fetches the remote base branch first, then uses git merge-base --is-ancestor
 * to determine if the remote base is still an ancestor of HEAD.
 *
 * @returns true if diverged (remote base has commits not in current branch), false otherwise
 */
export async function checkDivergence(
	repoPath: string,
	baseBranch: string,
	remote: string,
): Promise<boolean> {
	try {
		await execCommand("git", ["-C", repoPath, "fetch", remote, baseBranch]);
	} catch (err) {
		throw new GitOpsError(
			"checkDivergence",
			repoPath,
			err instanceof Error ? err.message : String(err),
			err instanceof Error ? err : undefined,
		);
	}

	try {
		await execCommand("git", [
			"-C",
			repoPath,
			"merge-base",
			"--is-ancestor",
			`${remote}/${baseBranch}`,
			"HEAD",
		]);
		return false; // Not diverged -- remote base is ancestor of HEAD
	} catch {
		return true; // Diverged -- remote base has commits not in current branch
	}
}

/**
 * Attempt to rebase the current branch onto the remote base branch.
 * First checks for divergence; if not diverged, returns early.
 * If diverged, attempts rebase. On conflict, aborts cleanly and returns conflict list.
 */
export async function attemptRebase(
	repoPath: string,
	baseBranch: string,
	remote: string,
): Promise<RebaseResult> {
	const diverged = await checkDivergence(repoPath, baseBranch, remote);

	if (!diverged) {
		return { diverged: false, rebased: false, conflicts: [] };
	}

	try {
		await execCommand("git", ["-C", repoPath, "rebase", `${remote}/${baseBranch}`]);
		return { diverged: true, rebased: true, conflicts: [] };
	} catch {
		// Rebase failed with conflicts -- get conflict file list
		let conflicts: string[] = [];
		try {
			const { stdout } = await execCommand("git", [
				"-C",
				repoPath,
				"diff",
				"--name-only",
				"--diff-filter=U",
			]);
			conflicts = stdout
				.trim()
				.split("\n")
				.filter((f) => f.length > 0);
		} catch {
			// diff failed -- proceed with empty conflict list
		}

		// ALWAYS run `git rebase --abort` to restore clean state
		try {
			await execCommand("git", ["-C", repoPath, "rebase", "--abort"]);
		} catch {
			// Abort failed -- nothing more we can do
		}

		return { diverged: true, rebased: false, conflicts };
	}
}

/**
 * Get the diff between the base branch and HEAD.
 * Best-effort: returns empty string on error.
 */
export async function getDiffFromBase(repoPath: string, baseBranch: string): Promise<string> {
	try {
		const { stdout } = await execCommand("git", [
			"-C",
			repoPath,
			"diff",
			`${baseBranch}...HEAD`,
		]);
		return stdout.trim();
	} catch {
		return "";
	}
}
