import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobConfig } from "../../src/core/types.js";
import type { SpawnOptions } from "../../src/runner/types.js";

// Mock child_process
vi.mock("node:child_process", () => ({
	spawn: vi.fn(),
}));

import { spawn } from "node:child_process";
import { buildAllowedTools, spawnClaude } from "../../src/runner/spawner.js";

const mockedSpawn = vi.mocked(spawn);

function createMockChildProcess() {
	const stdout = new PassThrough();
	const stderr = new PassThrough();
	const child = new EventEmitter() as EventEmitter & {
		stdout: PassThrough;
		stderr: PassThrough;
		stdin: null;
	};
	child.stdout = stdout;
	child.stderr = stderr;
	child.stdin = null;
	return { child, stdout, stderr };
}

/** Helper to emit JSON response and close the mock child process after a microtask delay */
function emitResponse(
	child: EventEmitter & { stdout: PassThrough; stderr: PassThrough },
	jsonData: Record<string, unknown>,
	exitCode = 0,
) {
	process.nextTick(() => {
		child.stdout.write(`${JSON.stringify(jsonData)}\n`);
		child.stdout.end();
		child.stderr.end();
		child.emit("close", exitCode);
	});
}

function makeDefaultConfig(overrides: Partial<JobConfig["guardrails"]> = {}): JobConfig {
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
			...overrides,
		},
		notifications: {},
		enabled: true,
	};
}

describe("buildAllowedTools", () => {
	it("always includes base tools: Read, Edit, Write, Glob, Grep", () => {
		const config = makeDefaultConfig();
		const tools = buildAllowedTools(config);

		expect(tools).toContain("Read");
		expect(tools).toContain("Edit");
		expect(tools).toContain("Write");
		expect(tools).toContain("Glob");
		expect(tools).toContain("Grep");
	});

	it("always includes git tools: status, diff, log, add, commit", () => {
		const config = makeDefaultConfig();
		const tools = buildAllowedTools(config);

		expect(tools).toContain("Bash(git status *)");
		expect(tools).toContain("Bash(git diff *)");
		expect(tools).toContain("Bash(git log *)");
		expect(tools).toContain("Bash(git add *)");
		expect(tools).toContain("Bash(git commit *)");
	});

	it("always includes gh issue tools", () => {
		const config = makeDefaultConfig();
		const tools = buildAllowedTools(config);

		expect(tools).toContain("Bash(gh issue list *)");
		expect(tools).toContain("Bash(gh issue view *)");
	});

	it("always includes npm test/lint/typecheck tools", () => {
		const config = makeDefaultConfig();
		const tools = buildAllowedTools(config);

		expect(tools).toContain("Bash(npm test *)");
		expect(tools).toContain("Bash(npm run test *)");
		expect(tools).toContain("Bash(npm run lint *)");
		expect(tools).toContain("Bash(npm run typecheck *)");
		expect(tools).toContain("Bash(npx *)");
	});

	it("includes npm install when noNewDependencies is false (default)", () => {
		const config = makeDefaultConfig({ noNewDependencies: false });
		const tools = buildAllowedTools(config);

		expect(tools).toContain("Bash(npm install *)");
		expect(tools).toContain("Bash(npm add *)");
	});

	it("excludes npm install and npm add when noNewDependencies is true", () => {
		const config = makeDefaultConfig({ noNewDependencies: true });
		const tools = buildAllowedTools(config);

		expect(tools).not.toContain("Bash(npm install *)");
		expect(tools).not.toContain("Bash(npm add *)");
	});
});

describe("spawnClaude", () => {
	const defaultOptions: SpawnOptions = {
		cwd: "/tmp/test-repo",
		prompt: "Do some work",
		maxTurns: 50,
		maxBudgetUsd: 5.0,
		allowedTools: ["Read", "Edit"],
	};

	beforeEach(() => {
		mockedSpawn.mockReset();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("builds args array with required flags: -p, --output-format json, --max-turns, --max-budget-usd, --dangerously-skip-permissions", async () => {
		const { child } = createMockChildProcess();
		mockedSpawn.mockReturnValue(child as never);

		const promise = spawnClaude(defaultOptions);

		const args = mockedSpawn.mock.calls[0][1] as string[];
		expect(args).toContain("-p");
		expect(args).toContain("--output-format");
		expect(args[args.indexOf("--output-format") + 1]).toBe("json");
		expect(args).toContain("--max-turns");
		expect(args[args.indexOf("--max-turns") + 1]).toBe("50");
		expect(args).toContain("--max-budget-usd");
		expect(args[args.indexOf("--max-budget-usd") + 1]).toBe("5");
		expect(args).toContain("--dangerously-skip-permissions");

		emitResponse(child, {
			result: "ok",
			session_id: "s1",
			total_cost_usd: 0.5,
			num_turns: 3,
			duration_ms: 1000,
		});

		await promise;
	});

	it("passes --max-turns value from options.maxTurns", async () => {
		const { child } = createMockChildProcess();
		mockedSpawn.mockReturnValue(child as never);

		const promise = spawnClaude({ ...defaultOptions, maxTurns: 100 });

		const args = mockedSpawn.mock.calls[0][1] as string[];
		expect(args[args.indexOf("--max-turns") + 1]).toBe("100");

		emitResponse(child, { result: "ok" });
		await promise;
	});

	it("passes --max-budget-usd value from options.maxBudgetUsd", async () => {
		const { child } = createMockChildProcess();
		mockedSpawn.mockReturnValue(child as never);

		const promise = spawnClaude({ ...defaultOptions, maxBudgetUsd: 10 });

		const args = mockedSpawn.mock.calls[0][1] as string[];
		expect(args[args.indexOf("--max-budget-usd") + 1]).toBe("10");

		emitResponse(child, { result: "ok" });
		await promise;
	});

	it("includes --append-system-prompt when options.appendSystemPrompt is set", async () => {
		const { child } = createMockChildProcess();
		mockedSpawn.mockReturnValue(child as never);

		const promise = spawnClaude({ ...defaultOptions, appendSystemPrompt: "Be helpful" });

		const args = mockedSpawn.mock.calls[0][1] as string[];
		expect(args).toContain("--append-system-prompt");
		expect(args[args.indexOf("--append-system-prompt") + 1]).toBe("Be helpful");

		emitResponse(child, { result: "ok" });
		await promise;
	});

	it("includes --allowedTools when options.allowedTools is non-empty", async () => {
		const { child } = createMockChildProcess();
		mockedSpawn.mockReturnValue(child as never);

		const promise = spawnClaude({ ...defaultOptions, allowedTools: ["Read", "Edit", "Write"] });

		const args = mockedSpawn.mock.calls[0][1] as string[];
		expect(args).toContain("--allowedTools");
		expect(args[args.indexOf("--allowedTools") + 1]).toBe("Read,Edit,Write");

		emitResponse(child, { result: "ok" });
		await promise;
	});

	it("spawns process with cwd from options.cwd", async () => {
		const { child } = createMockChildProcess();
		mockedSpawn.mockReturnValue(child as never);

		const promise = spawnClaude({ ...defaultOptions, cwd: "/my/project" });

		const spawnOpts = mockedSpawn.mock.calls[0][2] as { cwd: string };
		expect(spawnOpts.cwd).toBe("/my/project");

		emitResponse(child, { result: "ok" });
		await promise;
	});

	it("parses JSON output and returns SpawnResult with all fields", async () => {
		const { child } = createMockChildProcess();
		mockedSpawn.mockReturnValue(child as never);

		const promise = spawnClaude(defaultOptions);

		emitResponse(child, {
			result: "I fixed the bug in utils.ts by adding null checks.",
			session_id: "session-abc-123",
			total_cost_usd: 1.5,
			num_turns: 12,
			duration_ms: 45000,
			is_error: false,
			subtype: "success",
		});

		const result = await promise;
		expect(result.success).toBe(true);
		expect(result.result).toBe("I fixed the bug in utils.ts by adding null checks.");
		expect(result.sessionId).toBe("session-abc-123");
		expect(result.costUsd).toBe(1.5);
		expect(result.numTurns).toBe(12);
		expect(result.durationMs).toBe(45000);
		expect(result.isError).toBe(false);
		expect(result.subtype).toBe("success");
	});

	it("returns isError=true and errors array when JSON has is_error=true", async () => {
		const { child } = createMockChildProcess();
		mockedSpawn.mockReturnValue(child as never);

		const promise = spawnClaude(defaultOptions);

		emitResponse(
			child,
			{
				result: "",
				is_error: true,
				subtype: "error",
				errors: ["Rate limit exceeded", "Max turns reached"],
			},
			1,
		);

		const result = await promise;
		expect(result.success).toBe(false);
		expect(result.isError).toBe(true);
		expect(result.errors).toEqual(["Rate limit exceeded", "Max turns reached"]);
	});

	it("rejects with SpawnError mentioning 'no output' when stdout is empty", async () => {
		const { child } = createMockChildProcess();
		mockedSpawn.mockReturnValue(child as never);

		const promise = spawnClaude(defaultOptions);

		process.nextTick(() => {
			// Claude exits without writing any stdout
			child.stdout.end();
			child.stderr.write("some stderr\n");
			child.stderr.end();
			child.emit("close", 0);
		});

		await expect(promise).rejects.toThrow(/no output/i);
	});

	it("rejects with SpawnError mentioning 'no output' when stdout is whitespace-only", async () => {
		const { child } = createMockChildProcess();
		mockedSpawn.mockReturnValue(child as never);

		const promise = spawnClaude(defaultOptions);

		process.nextTick(() => {
			child.stdout.write("   \n  \n");
			child.stdout.end();
			child.stderr.end();
			child.emit("close", 0);
		});

		await expect(promise).rejects.toThrow(/no output/i);
	});

	it("rejects with SpawnError when process exits non-zero and JSON parse fails", async () => {
		const { child } = createMockChildProcess();
		mockedSpawn.mockReturnValue(child as never);

		const promise = spawnClaude(defaultOptions);

		process.nextTick(() => {
			child.stdout.write("not valid json\n");
			child.stdout.end();
			child.stderr.write("some error output\n");
			child.stderr.end();
			child.emit("close", 1);
		});

		await expect(promise).rejects.toThrow(/Claude spawn error/);
	});

	it("rejects with SpawnError on process error event", async () => {
		const { child } = createMockChildProcess();
		mockedSpawn.mockReturnValue(child as never);

		const promise = spawnClaude(defaultOptions);

		process.nextTick(() => {
			child.emit("error", new Error("spawn ENOENT"));
		});

		await expect(promise).rejects.toThrow(/spawn ENOENT/);
	});
});

describe("model selection (--model flag)", () => {
	const baseOptions: SpawnOptions = {
		cwd: "/tmp/test-repo",
		prompt: "Do some work",
		maxTurns: 50,
		maxBudgetUsd: 5.0,
		allowedTools: ["Read", "Edit"],
	};

	beforeEach(() => {
		mockedSpawn.mockReset();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("includes --model opus when model is set to opus", async () => {
		const { child } = createMockChildProcess();
		mockedSpawn.mockReturnValue(child as never);

		const promise = spawnClaude({ ...baseOptions, model: "opus" });

		const args = mockedSpawn.mock.calls[0][1] as string[];
		expect(args).toContain("--model");
		expect(args[args.indexOf("--model") + 1]).toBe("opus");

		emitResponse(child, { result: "ok" });
		await promise;
	});

	it("includes --model sonnet when model is set to sonnet", async () => {
		const { child } = createMockChildProcess();
		mockedSpawn.mockReturnValue(child as never);

		const promise = spawnClaude({ ...baseOptions, model: "sonnet" });

		const args = mockedSpawn.mock.calls[0][1] as string[];
		expect(args).toContain("--model");
		expect(args[args.indexOf("--model") + 1]).toBe("sonnet");

		emitResponse(child, { result: "ok" });
		await promise;
	});

	it("includes --model claude-opus-4-6 when model is a full model ID", async () => {
		const { child } = createMockChildProcess();
		mockedSpawn.mockReturnValue(child as never);

		const promise = spawnClaude({ ...baseOptions, model: "claude-opus-4-6" });

		const args = mockedSpawn.mock.calls[0][1] as string[];
		expect(args).toContain("--model");
		expect(args[args.indexOf("--model") + 1]).toBe("claude-opus-4-6");

		emitResponse(child, { result: "ok" });
		await promise;
	});

	it("does NOT include --model when model is 'default'", async () => {
		const { child } = createMockChildProcess();
		mockedSpawn.mockReturnValue(child as never);

		const promise = spawnClaude({ ...baseOptions, model: "default" });

		const args = mockedSpawn.mock.calls[0][1] as string[];
		expect(args).not.toContain("--model");

		emitResponse(child, { result: "ok" });
		await promise;
	});

	it("does NOT include --model when model is undefined", async () => {
		const { child } = createMockChildProcess();
		mockedSpawn.mockReturnValue(child as never);

		const promise = spawnClaude({ ...baseOptions });

		const args = mockedSpawn.mock.calls[0][1] as string[];
		expect(args).not.toContain("--model");

		emitResponse(child, { result: "ok" });
		await promise;
	});
});
