import { readFile, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JobConfigSchema } from "../../src/core/types.js";
import { ConfigParseError, ConfigValidationError } from "../../src/util/errors.js";
import { writeFileSafe } from "../../src/util/fs.js";
// These imports will fail until source modules exist
import { paths } from "../../src/util/paths.js";

describe("paths", () => {
	const expectedBase = join(homedir(), ".claude-auto");

	it("paths.base returns a string ending with .claude-auto", () => {
		expect(paths.base).toBe(expectedBase);
		expect(paths.base.endsWith(".claude-auto")).toBe(true);
	});

	it("paths.jobs returns a string ending with .claude-auto/jobs", () => {
		expect(paths.jobs).toBe(join(expectedBase, "jobs"));
		expect(paths.jobs.endsWith(".claude-auto/jobs")).toBe(true);
	});

	it('paths.jobDir("test-job") returns a string ending with .claude-auto/jobs/test-job', () => {
		const result = paths.jobDir("test-job");
		expect(result).toBe(join(expectedBase, "jobs", "test-job"));
		expect(result.endsWith(".claude-auto/jobs/test-job")).toBe(true);
	});

	it('paths.jobConfig("test-job") returns a string ending with .claude-auto/jobs/test-job/config.yaml', () => {
		const result = paths.jobConfig("test-job");
		expect(result).toBe(join(expectedBase, "jobs", "test-job", "config.yaml"));
		expect(result.endsWith(".claude-auto/jobs/test-job/config.yaml")).toBe(true);
	});
});

describe("ConfigParseError", () => {
	it("is instanceof Error with name ConfigParseError and a filePath property", () => {
		const error = new ConfigParseError("/tmp/bad.yaml", [{ message: "unexpected token" }]);
		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe("ConfigParseError");
		expect(error.filePath).toBe("/tmp/bad.yaml");
		expect(error.message).toContain("/tmp/bad.yaml");
		expect(error.message).toContain("unexpected token");
	});
});

describe("ConfigValidationError", () => {
	it("is instanceof Error with name ConfigValidationError and a message property", () => {
		const error = new ConfigValidationError("/tmp/invalid.yaml", "missing field: id");
		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe("ConfigValidationError");
		expect(error.filePath).toBe("/tmp/invalid.yaml");
		expect(error.message).toContain("missing field: id");
	});
});

describe("JobConfigSchema", () => {
	const validConfig = {
		id: "test-123",
		name: "my-test-job",
		repo: {
			path: "/home/user/my-repo",
		},
		schedule: {
			cron: "0 */6 * * *",
		},
	};

	it("safeParse on a valid config returns { success: true }", () => {
		const result = JobConfigSchema.safeParse(validConfig);
		expect(result.success).toBe(true);
	});

	it("safeParse on {} returns { success: false } (missing required fields)", () => {
		const result = JobConfigSchema.safeParse({});
		expect(result.success).toBe(false);
	});

	it("applies defaults: guardrails.maxTurns defaults to 50, enabled defaults to true", () => {
		const result = JobConfigSchema.safeParse(validConfig);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.guardrails.maxTurns).toBe(50);
			expect(result.data.enabled).toBe(true);
		}
	});

	it("applies default focus areas", () => {
		const result = JobConfigSchema.safeParse(validConfig);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.focus).toEqual(["open-issues", "bug-discovery"]);
		}
	});

	it("applies default repo branch and remote", () => {
		const result = JobConfigSchema.safeParse(validConfig);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.repo.branch).toBe("main");
			expect(result.data.repo.remote).toBe("origin");
		}
	});

	it("applies default schedule timezone", () => {
		const result = JobConfigSchema.safeParse(validConfig);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.schedule.timezone).toBe("UTC");
		}
	});

	it("applies default guardrails values", () => {
		const result = JobConfigSchema.safeParse(validConfig);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.guardrails.maxBudgetUsd).toBe(5.0);
			expect(result.data.guardrails.noNewDependencies).toBe(false);
			expect(result.data.guardrails.noArchitectureChanges).toBe(false);
			expect(result.data.guardrails.bugFixOnly).toBe(false);
		}
	});
});

describe("writeFileSafe", () => {
	const testDir = join(tmpdir(), `claude-auto-test-${Date.now()}`);

	it("writes content to a file path (creates parent dirs) and can be read back", async () => {
		const filePath = join(testDir, "nested", "dir", "test.txt");
		const content = "hello world";

		await writeFileSafe(filePath, content);
		const readBack = await readFile(filePath, "utf-8");
		expect(readBack).toBe(content);

		// Cleanup
		await rm(testDir, { recursive: true, force: true });
	});
});
