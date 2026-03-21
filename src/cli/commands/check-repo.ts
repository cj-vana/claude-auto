import { stat } from "node:fs/promises";
import { execCommand } from "../../util/exec.js";
import type { ParsedCommand } from "../types.js";

/**
 * Check if a path is a valid git repository.
 * Outputs JSON for the setup wizard to consume.
 */
export async function checkRepoCommand(args: ParsedCommand["args"]): Promise<void> {
	const repoPath = args.path as string | undefined;
	if (!repoPath) {
		console.error("Usage: claude-auto check-repo --path <path>");
		throw new Error("Missing --path argument");
	}

	try {
		const s = await stat(repoPath);
		if (!s.isDirectory()) {
			console.log(JSON.stringify({ exists: false, error: "Not a directory" }));
			return;
		}

		// Check if it's a git repo
		await execCommand("git", ["-C", repoPath, "rev-parse", "--git-dir"]);

		// Get remote URL
		const { stdout } = await execCommand("git", ["-C", repoPath, "remote", "get-url", "origin"]);
		console.log(
			JSON.stringify({ exists: true, isGitRepo: true, remote: stdout.trim() }),
		);
	} catch (err: unknown) {
		if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
			console.log(JSON.stringify({ exists: false }));
			return;
		}
		// If stat succeeded but git commands failed, still report as not a git repo
		console.log(JSON.stringify({ exists: false }));
	}
}
