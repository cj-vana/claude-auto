import { describe, expect, it } from "vitest";
import type { JobConfig } from "../../src/core/types.js";
import type { RunContext } from "../../src/runner/context-store.js";
import { buildSystemPrompt, buildWorkPrompt } from "../../src/runner/prompt-builder.js";

function makeDefaultConfig(overrides: Partial<JobConfig> = {}): JobConfig {
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
		...overrides,
	};
}

describe("buildSystemPrompt", () => {
	it("includes research/understand codebase instruction (EXEC-02)", () => {
		const config = makeDefaultConfig();
		const prompt = buildSystemPrompt(config);

		expect(prompt.toLowerCase()).toContain("research");
		expect(prompt.toLowerCase()).toContain("understand");
		expect(prompt.toLowerCase()).toContain("codebase");
	});

	it("includes user's custom systemPrompt when set", () => {
		const config = makeDefaultConfig({
			systemPrompt: "Always write in functional style. Prefer immutability.",
		});
		const prompt = buildSystemPrompt(config);

		expect(prompt).toContain("Always write in functional style. Prefer immutability.");
	});

	it("does not include undefined when systemPrompt is not set", () => {
		const config = makeDefaultConfig();
		const prompt = buildSystemPrompt(config);

		expect(prompt).not.toContain("undefined");
	});
});

describe("buildWorkPrompt", () => {
	it('contains "## Work Priority" section (EXEC-03)', () => {
		const config = makeDefaultConfig();
		const prompt = buildWorkPrompt(config);

		expect(prompt).toContain("## Work Priority");
	});

	it('contains "gh issue list" instruction (EXEC-03)', () => {
		const config = makeDefaultConfig();
		const prompt = buildWorkPrompt(config);

		expect(prompt).toContain("gh issue list");
	});

	it('contains priority chain: "priority", "issues", "bugs", "improvements" (EXEC-03)', () => {
		const config = makeDefaultConfig();
		const prompt = buildWorkPrompt(config);
		const lower = prompt.toLowerCase();

		expect(lower).toContain("priority");
		expect(lower).toContain("issues");
		expect(lower).toContain("bugs");
		expect(lower).toContain("improvements");
	});

	it('contains bug scanning instruction: "test suite" and "linter" and "type checking" (EXEC-04)', () => {
		const config = makeDefaultConfig();
		const prompt = buildWorkPrompt(config);
		const lower = prompt.toLowerCase();

		expect(lower).toContain("test suite");
		expect(lower).toContain("linter");
		expect(lower).toContain("type checking");
	});

	it('contains issue evaluation: "complexity", "solvability", "spam" (EXEC-05)', () => {
		const config = makeDefaultConfig();
		const prompt = buildWorkPrompt(config);
		const lower = prompt.toLowerCase();

		expect(lower).toContain("complexity");
		expect(lower).toContain("solvability");
		expect(lower).toContain("spam");
	});

	it("contains documentation update instruction (EXEC-06)", () => {
		const config = makeDefaultConfig();
		const prompt = buildWorkPrompt(config);
		const lower = prompt.toLowerCase();

		expect(lower).toContain("documentation");
	});

	it('contains "NEVER force push" (GIT-03 enforcement in prompt)', () => {
		const config = makeDefaultConfig();
		const prompt = buildWorkPrompt(config);

		expect(prompt).toContain("NEVER force push");
	});

	it('contains "## Git Safety" section', () => {
		const config = makeDefaultConfig();
		const prompt = buildWorkPrompt(config);

		expect(prompt).toContain("## Git Safety");
	});

	it("with default guardrails (all false), does NOT contain restriction text (SAFE-03)", () => {
		const config = makeDefaultConfig();
		const prompt = buildWorkPrompt(config);

		expect(prompt).not.toContain("Do NOT add any new dependencies");
		expect(prompt).not.toContain("Only fix bugs");
	});

	it('with noNewDependencies=true, output contains "Do NOT add any new dependencies"', () => {
		const config = makeDefaultConfig({
			guardrails: {
				...makeDefaultConfig().guardrails,
				noNewDependencies: true,
			},
		});
		const prompt = buildWorkPrompt(config);

		expect(prompt).toContain("Do NOT add any new dependencies");
	});

	it('with bugFixOnly=true, output contains "Only fix bugs"', () => {
		const config = makeDefaultConfig({
			guardrails: {
				...makeDefaultConfig().guardrails,
				bugFixOnly: true,
			},
		});
		const prompt = buildWorkPrompt(config);

		expect(prompt).toContain("Only fix bugs");
	});

	it("with noArchitectureChanges=true, output contains architecture restriction", () => {
		const config = makeDefaultConfig({
			guardrails: {
				...makeDefaultConfig().guardrails,
				noArchitectureChanges: true,
			},
		});
		const prompt = buildWorkPrompt(config);

		expect(prompt).toContain("Do NOT make architectural changes");
	});

	it("with restrictToPaths has entries, output contains those paths", () => {
		const config = makeDefaultConfig({
			guardrails: {
				...makeDefaultConfig().guardrails,
				restrictToPaths: ["src/api/", "src/lib/"],
			},
		});
		const prompt = buildWorkPrompt(config);

		expect(prompt).toContain("src/api/");
		expect(prompt).toContain("src/lib/");
	});

	it("includes focus areas section when focus is set", () => {
		const config = makeDefaultConfig({ focus: ["open-issues", "documentation"] });
		const prompt = buildWorkPrompt(config);

		expect(prompt).toContain("## Focus Areas");
		expect(prompt).toContain("open-issues");
		expect(prompt).toContain("documentation");
	});

	it("includes guardrails section header when guardrails are active", () => {
		const config = makeDefaultConfig({
			guardrails: {
				...makeDefaultConfig().guardrails,
				noNewDependencies: true,
			},
		});
		const prompt = buildWorkPrompt(config);

		expect(prompt).toContain("## Guardrails");
	});

	it("does not include guardrails section header when all guardrails are off", () => {
		const config = makeDefaultConfig();
		const prompt = buildWorkPrompt(config);

		expect(prompt).not.toContain("## Guardrails");
	});
});

describe("context window injection", () => {
	const mockContext: RunContext[] = [
		{
			id: "run-001",
			status: "success",
			pr_url: "https://github.com/test/repo/pull/42",
			branch_name: "auto/fix-auth-bug",
			issue_number: 42,
			summary: null,
			started_at: "2026-03-21T12:00:00Z",
		},
		{
			id: "run-002",
			status: "no-changes",
			pr_url: null,
			branch_name: "auto/scan-issues",
			issue_number: null,
			summary: null,
			started_at: "2026-03-20T08:00:00Z",
		},
	];

	it('buildWorkPrompt with non-empty RunContext[] includes "Previous Work" section in output', () => {
		const config = makeDefaultConfig();
		const prompt = buildWorkPrompt(config, mockContext);

		expect(prompt).toContain("## Previous Work (DO NOT duplicate)");
	});

	it("buildWorkPrompt with non-empty RunContext[] includes issue numbers from context", () => {
		const config = makeDefaultConfig();
		const prompt = buildWorkPrompt(config, mockContext);

		expect(prompt).toContain("Issue: #42");
	});

	it("buildWorkPrompt with non-empty RunContext[] includes PR URLs from context", () => {
		const config = makeDefaultConfig();
		const prompt = buildWorkPrompt(config, mockContext);

		expect(prompt).toContain("PR: https://github.com/test/repo/pull/42");
	});

	it('buildWorkPrompt with empty RunContext[] does NOT include "Previous Work" section', () => {
		const config = makeDefaultConfig();
		const prompt = buildWorkPrompt(config, []);

		expect(prompt).not.toContain("Previous Work");
	});

	it("buildWorkPrompt without context parameter behaves identically to current (backward compat)", () => {
		const config = makeDefaultConfig();
		const withoutContext = buildWorkPrompt(config);
		const withEmptyContext = buildWorkPrompt(config, []);

		// Both should not contain Previous Work and should be functionally equivalent
		expect(withoutContext).not.toContain("Previous Work");
		expect(withEmptyContext).not.toContain("Previous Work");
		// The core content should be the same
		expect(withoutContext).toContain("## Work Priority");
		expect(withEmptyContext).toContain("## Work Priority");
	});
});
