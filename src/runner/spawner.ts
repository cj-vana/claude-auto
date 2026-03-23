import { spawn } from "node:child_process";
import type { JobConfig } from "../core/types.js";
import { SpawnError } from "../util/errors.js";
import type { SpawnOptions, SpawnResult } from "./types.js";

/**
 * Build the list of allowed tools for Claude based on job config guardrails.
 * Always includes core tools (Read, Edit, Write, Glob, Grep), git tools,
 * GitHub CLI tools, and npm test/lint/typecheck tools. Conditionally includes
 * npm install/add when noNewDependencies is false (default).
 */
export function buildAllowedTools(config: JobConfig): string[] {
	const tools: string[] = [
		"Read",
		"Edit",
		"Write",
		"Glob",
		"Grep",
		"Bash(git status *)",
		"Bash(git diff *)",
		"Bash(git log *)",
		"Bash(git add *)",
		"Bash(git commit *)",
		"Bash(gh issue list *)",
		"Bash(gh issue view *)",
		"Bash(npm test *)",
		"Bash(npm run test *)",
		"Bash(npm run lint *)",
		"Bash(npm run typecheck *)",
		"Bash(npx *)",
	];

	if (!config.guardrails.noNewDependencies) {
		tools.push("Bash(npm install *)");
		tools.push("Bash(npm add *)");
	}

	return tools;
}

/**
 * Extract a summary from Claude's result text.
 * Returns the first 500 characters or the full text if shorter.
 */
function extractSummary(result: string): string {
	if (result.length <= 500) {
		return result;
	}
	return result.slice(0, 500);
}

/**
 * Spawn Claude Code CLI in headless mode with JSON output parsing.
 * Invokes `claude -p` with --output-format json, --max-turns, --max-budget-usd,
 * --dangerously-skip-permissions, and optional --append-system-prompt and --allowedTools.
 *
 * @param options - Spawn configuration including cwd, prompt, limits, and tools
 * @returns SpawnResult with parsed JSON output fields
 * @throws SpawnError when process exits non-zero and JSON parsing fails
 */
export function spawnClaude(options: SpawnOptions): Promise<SpawnResult> {
	return new Promise((resolve, reject) => {
		const args: string[] = [
			"-p",
			options.prompt,
			"--output-format",
			"json",
			"--dangerously-skip-permissions",
		];

		// Only pass limits when > 0 (0 means unlimited)
		if (options.maxTurns && options.maxTurns > 0) {
			args.push("--max-turns", String(options.maxTurns));
		}
		if (options.maxBudgetUsd && options.maxBudgetUsd > 0) {
			args.push("--max-budget-usd", String(options.maxBudgetUsd));
		}

		if (options.appendSystemPrompt) {
			args.push("--append-system-prompt", options.appendSystemPrompt);
		}

		if (options.model && options.model !== "default") {
			args.push("--model", options.model);
		}

		if (options.allowedTools.length > 0) {
			args.push("--allowedTools", options.allowedTools.join(","));
		}

		const child = spawn("claude", args, {
			cwd: options.cwd,
			env: { ...process.env, ...options.env },
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";

		child.stdout.on("data", (data: Buffer) => {
			stdout += data.toString();
		});

		child.stderr.on("data", (data: Buffer) => {
			stderr += data.toString();
		});

		child.on("close", (code: number | null) => {
			try {
				// The last non-empty line of stdout with --output-format json is the result JSON
				const jsonLine = stdout.trim().split("\n").pop() ?? "";
				const parsed = JSON.parse(jsonLine);

				resolve({
					success: !parsed.is_error,
					result: parsed.result ?? "",
					summary: extractSummary(parsed.result ?? ""),
					sessionId: parsed.session_id ?? "",
					costUsd: parsed.total_cost_usd ?? 0,
					numTurns: parsed.num_turns ?? 0,
					durationMs: parsed.duration_ms ?? 0,
					isError: parsed.is_error ?? false,
					subtype: parsed.subtype ?? "success",
					errors: parsed.errors,
				});
			} catch {
				reject(
					new SpawnError(
						`Claude process exited with code ${code ?? "unknown"}. stderr: ${stderr}`,
						code ?? 1,
					),
				);
			}
		});

		child.on("error", (err: Error) => {
			reject(new SpawnError(err.message, 1));
		});
	});
}
