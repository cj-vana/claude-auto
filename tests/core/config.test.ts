import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	loadJobConfig,
	readConfigDocument,
	saveJobConfig,
	updateConfigField,
	writeConfigDocument,
} from "../../src/core/config.js";
import { JobConfigSchema } from "../../src/core/types.js";
import { ConfigParseError, ConfigValidationError } from "../../src/util/errors.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const fixturesDir = join(__dirname, "..", "fixtures");

let tmpDir: string;

beforeAll(async () => {
	tmpDir = join(tmpdir(), `claude-auto-config-test-${crypto.randomUUID()}`);
});

afterAll(async () => {
	if (tmpDir) {
		await rm(tmpDir, { recursive: true, force: true });
	}
});

describe("loadJobConfig", () => {
	it("reads valid-config.yaml and returns typed JobConfig with correct fields", async () => {
		const configPath = join(fixturesDir, "valid-config.yaml");
		const config = await loadJobConfig(configPath);

		expect(config.id).toBe("test-job-123");
		expect(config.name).toBe("my-test-repo");
		expect(config.repo.path).toBe("/tmp/test-repo");
		expect(config.repo.branch).toBe("main");
		expect(config.repo.remote).toBe("origin");
		expect(config.schedule.cron).toBe("0 */6 * * *");
		expect(config.schedule.timezone).toBe("America/Chicago");
		expect(config.focus).toEqual(["open-issues", "bug-discovery"]);
		expect(config.enabled).toBe(true);
	});

	it("throws ConfigValidationError on missing-required.yaml with field names", async () => {
		const configPath = join(fixturesDir, "invalid-configs", "missing-required.yaml");
		await expect(loadJobConfig(configPath)).rejects.toThrow(ConfigValidationError);
		try {
			await loadJobConfig(configPath);
		} catch (error) {
			expect(error).toBeInstanceOf(ConfigValidationError);
			const validationError = error as ConfigValidationError;
			expect(validationError.filePath).toBe(configPath);
			// Should mention the missing fields
			expect(validationError.message).toMatch(/id|repo|schedule/);
		}
	});

	it("throws ConfigParseError on bad-yaml-syntax.yaml with YAML syntax error", async () => {
		const configPath = join(fixturesDir, "invalid-configs", "bad-yaml-syntax.yaml");
		await expect(loadJobConfig(configPath)).rejects.toThrow(ConfigParseError);
		try {
			await loadJobConfig(configPath);
		} catch (error) {
			expect(error).toBeInstanceOf(ConfigParseError);
			const parseError = error as ConfigParseError;
			expect(parseError.filePath).toBe(configPath);
			expect(parseError.message).toContain("YAML syntax error");
		}
	});

	it("throws ConfigValidationError on bad-url.yaml with invalid webhookUrl", async () => {
		const configPath = join(fixturesDir, "invalid-configs", "bad-url.yaml");
		await expect(loadJobConfig(configPath)).rejects.toThrow(ConfigValidationError);
	});

	it("applies Zod defaults: config without guardrails gets guardrails.maxTurns = 50", async () => {
		const configPath = join(fixturesDir, "valid-config.yaml");
		const config = await loadJobConfig(configPath);

		// valid-config.yaml has no guardrails section, so defaults should be applied
		expect(config.guardrails.maxTurns).toBe(50);
		expect(config.guardrails.maxBudgetUsd).toBe(5.0);
		expect(config.guardrails.noNewDependencies).toBe(false);
	});
});

describe("saveJobConfig", () => {
	it("writes a YAML file that can be read back with loadJobConfig producing identical data", async () => {
		const configPath = join(tmpDir, "roundtrip", "config.yaml");
		const config = {
			id: "save-test-1",
			name: "save-test-job",
			repo: { path: "/tmp/save-repo", branch: "main", remote: "origin" },
			schedule: { cron: "0 */12 * * *", timezone: "UTC" },
			focus: ["open-issues" as const, "bug-discovery" as const],
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

		await saveJobConfig(configPath, config);
		const readBack = await loadJobConfig(configPath);

		expect(readBack).toEqual(config);
	});

	it("uses YAML block literal style for multiline systemPrompt", async () => {
		const configPath = join(tmpDir, "multiline", "config.yaml");
		const config = {
			id: "multiline-test",
			name: "multiline-job",
			repo: { path: "/tmp/multiline-repo", branch: "main", remote: "origin" },
			schedule: { cron: "0 */6 * * *", timezone: "UTC" },
			focus: ["open-issues" as const],
			systemPrompt:
				"You are a helpful assistant.\nFocus on bug fixes.\nDo not add new dependencies.",
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

		await saveJobConfig(configPath, config);
		const raw = await readFile(configPath, "utf-8");

		// YAML block literal style uses | character
		expect(raw).toContain("|");
	});
});

describe("readConfigDocument + updateConfigField + writeConfigDocument", () => {
	it("preserves comments through round-trip read-modify-write", async () => {
		const sourcePath = join(fixturesDir, "valid-config-with-comments.yaml");
		const destPath = join(tmpDir, "roundtrip-comments", "config.yaml");

		// Copy the fixture to a temp location
		const { mkdir } = await import("node:fs/promises");
		await mkdir(join(tmpDir, "roundtrip-comments"), { recursive: true });
		const sourceContent = await readFile(sourcePath, "utf-8");
		await writeFile(destPath, sourceContent, "utf-8");

		// Read, modify, write
		const doc = await readConfigDocument(destPath);
		updateConfigField(doc, ["name"], "updated-name");
		await writeConfigDocument(destPath, doc);

		// Read back the raw file content
		const result = await readFile(destPath, "utf-8");

		// Comments should still be present
		expect(result).toContain("# Job configuration for test repo");
		expect(result).toContain("# Target branch for PRs");
		expect(result).toContain("# Every 6 hours");
		expect(result).toContain("# Focus areas for autonomous work");

		// Updated field should be present
		expect(result).toContain("name: updated-name");

		// Other fields should be preserved
		expect(result).toContain("id: commented-job");
	});

	it("round-trip: read valid-config-with-comments.yaml, update, write, read back -- comments present", async () => {
		const sourcePath = join(fixturesDir, "valid-config-with-comments.yaml");
		const destPath = join(tmpDir, "roundtrip-verify", "config.yaml");

		const { mkdir } = await import("node:fs/promises");
		await mkdir(join(tmpDir, "roundtrip-verify"), { recursive: true });
		const sourceContent = await readFile(sourcePath, "utf-8");
		await writeFile(destPath, sourceContent, "utf-8");

		const doc = await readConfigDocument(destPath);
		updateConfigField(doc, ["schedule", "timezone"], "America/New_York");
		await writeConfigDocument(destPath, doc);

		// Validate the data is correct
		const config = await loadJobConfig(destPath);
		expect(config.schedule.timezone).toBe("America/New_York");
		expect(config.id).toBe("commented-job");

		// Validate comments survived
		const rawContent = await readFile(destPath, "utf-8");
		expect(rawContent).toContain("# Job configuration for test repo");
		expect(rawContent).toContain("# Target branch for PRs");
	});
});

const validConfigBase = {
	id: "test-job-123",
	name: "my-test-repo",
	repo: { path: "/tmp/test-repo", branch: "main", remote: "origin" },
	schedule: { cron: "0 */6 * * *", timezone: "America/Chicago" },
	focus: ["open-issues", "bug-discovery"],
	enabled: true,
};

describe("model field validation", () => {
	it("accepts model: 'opus'", () => {
		const result = JobConfigSchema.parse({ ...validConfigBase, model: "opus" });
		expect(result.model).toBe("opus");
	});

	it("accepts model: 'sonnet'", () => {
		const result = JobConfigSchema.parse({ ...validConfigBase, model: "sonnet" });
		expect(result.model).toBe("sonnet");
	});

	it("accepts model: 'haiku'", () => {
		const result = JobConfigSchema.parse({ ...validConfigBase, model: "haiku" });
		expect(result.model).toBe("haiku");
	});

	it("accepts model: 'opusplan'", () => {
		const result = JobConfigSchema.parse({ ...validConfigBase, model: "opusplan" });
		expect(result.model).toBe("opusplan");
	});

	it("accepts model: 'default'", () => {
		const result = JobConfigSchema.parse({ ...validConfigBase, model: "default" });
		expect(result.model).toBe("default");
	});

	it("accepts full model ID like 'claude-opus-4-6'", () => {
		const result = JobConfigSchema.parse({ ...validConfigBase, model: "claude-opus-4-6" });
		expect(result.model).toBe("claude-opus-4-6");
	});

	it("accepts undefined model (optional field)", () => {
		const result = JobConfigSchema.parse({ ...validConfigBase });
		expect(result.model).toBeUndefined();
	});

	it("rejects invalid model like 'gpt-4'", () => {
		expect(() => JobConfigSchema.parse({ ...validConfigBase, model: "gpt-4" })).toThrow();
	});
});

describe("budget field validation", () => {
	it("accepts budget with dailyUsd", () => {
		const result = JobConfigSchema.parse({ ...validConfigBase, budget: { dailyUsd: 10 } });
		expect(result.budget?.dailyUsd).toBe(10);
	});

	it("accepts budget with weeklyUsd and monthlyUsd", () => {
		const result = JobConfigSchema.parse({
			...validConfigBase,
			budget: { weeklyUsd: 50, monthlyUsd: 200 },
		});
		expect(result.budget?.weeklyUsd).toBe(50);
		expect(result.budget?.monthlyUsd).toBe(200);
	});

	it("accepts empty budget object (all fields optional)", () => {
		const result = JobConfigSchema.parse({ ...validConfigBase, budget: {} });
		expect(result.budget).toBeDefined();
	});

	it("accepts undefined budget (optional field)", () => {
		const result = JobConfigSchema.parse({ ...validConfigBase });
		expect(result.budget).toBeUndefined();
	});

	it("rejects negative dailyUsd", () => {
		expect(() =>
			JobConfigSchema.parse({ ...validConfigBase, budget: { dailyUsd: -5 } }),
		).toThrow();
	});
});
