import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let tmpDir: string;

// Must be set before the mock factory runs
beforeAll(async () => {
	tmpDir = join(tmpdir(), `claude-auto-jm-test-${crypto.randomUUID()}`);
	await mkdir(join(tmpDir, "jobs"), { recursive: true });
});

afterAll(async () => {
	if (tmpDir) {
		await rm(tmpDir, { recursive: true, force: true });
	}
});

// Mock paths to use tmpDir -- vi.mock is hoisted, but we set tmpDir in beforeAll
// We use a dynamic getter so it picks up the tmpDir value after beforeAll runs
vi.mock("../../src/util/paths.js", () => {
	return {
		get paths() {
			// tmpDir is set by the time tests actually run
			return {
				get base() {
					return tmpDir;
				},
				get jobs() {
					return join(tmpDir, "jobs");
				},
				jobDir: (id: string) => join(tmpDir, "jobs", id),
				jobConfig: (id: string) => join(tmpDir, "jobs", id, "config.yaml"),
			};
		},
	};
});

import { createJob, deleteJob, listJobs, readJob, updateJob } from "../../src/core/job-manager.js";
import type { JobConfig } from "../../src/core/types.js";

const baseInput: Omit<JobConfig, "id"> = {
	name: "test-job",
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

describe("createJob", () => {
	it("creates a directory, writes config, and returns config with 12-char id", async () => {
		const result = await createJob(baseInput);

		expect(result.id).toBeDefined();
		expect(result.id.length).toBe(12);
		expect(result.name).toBe("test-job");
		expect(result.repo.path).toBe("/tmp/test-repo");

		// Verify file was written
		const configPath = join(tmpDir, "jobs", result.id, "config.yaml");
		const raw = await readFile(configPath, "utf-8");
		expect(raw).toContain("name: test-job");
	});
});

describe("readJob", () => {
	it("reads back a created job with matching values", async () => {
		const created = await createJob(baseInput);
		const readBack = await readJob(created.id);

		expect(readBack.id).toBe(created.id);
		expect(readBack.name).toBe(created.name);
		expect(readBack.repo).toEqual(created.repo);
		expect(readBack.schedule).toEqual(created.schedule);
	});

	it("throws error on non-existent job ID", async () => {
		await expect(readJob("nonexistent-id-xyz")).rejects.toThrow();
	});
});

describe("updateJob", () => {
	it("changes one field, keeps other fields unchanged", async () => {
		const created = await createJob(baseInput);
		const updated = await updateJob(created.id, { name: "updated-name" });

		expect(updated.name).toBe("updated-name");
		expect(updated.id).toBe(created.id);
		expect(updated.repo).toEqual(created.repo);
		expect(updated.schedule).toEqual(created.schedule);
	});

	it("preserves YAML comments during update", async () => {
		// Create a config with comments manually
		const jobId = "comment-preserve-test";
		const jobDir = join(tmpDir, "jobs", jobId);
		await mkdir(jobDir, { recursive: true });
		const configPath = join(jobDir, "config.yaml");
		await writeFile(
			configPath,
			`# Important config comments
id: ${jobId}
name: comment-test
repo:
  path: /tmp/test-repo
  branch: main  # Target branch
  remote: origin
schedule:
  cron: "0 */6 * * *"  # Every 6 hours
  timezone: UTC
focus:
  - open-issues
  - bug-discovery
enabled: true
`,
			"utf-8",
		);

		// Update a field
		await updateJob(jobId, { name: "updated-comment-test" });

		// Read back raw content and check comments survived
		const raw = await readFile(configPath, "utf-8");
		expect(raw).toContain("# Important config comments");
		expect(raw).toContain("# Target branch");
		expect(raw).toContain("# Every 6 hours");
		expect(raw).toContain("name: updated-comment-test");
	});

	it("throws validation error on invalid update", async () => {
		const created = await createJob(baseInput);
		// Setting name to empty string should fail validation (min(1))
		await expect(updateJob(created.id, { name: "" })).rejects.toThrow();
	});
});

describe("deleteJob", () => {
	it("removes the entire job directory", async () => {
		const created = await createJob(baseInput);
		const jobDir = join(tmpDir, "jobs", created.id);

		// Verify it exists
		const raw = await readFile(join(jobDir, "config.yaml"), "utf-8");
		expect(raw).toBeTruthy();

		await deleteJob(created.id);

		// Verify it's gone
		await expect(readFile(join(jobDir, "config.yaml"), "utf-8")).rejects.toThrow();
	});

	it("does not throw on non-existent ID (idempotent)", async () => {
		await expect(deleteJob("does-not-exist-xyz")).resolves.not.toThrow();
	});
});

describe("listJobs", () => {
	it("returns all created jobs", async () => {
		// Clean up any previous jobs
		await rm(join(tmpDir, "jobs"), { recursive: true, force: true });
		await mkdir(join(tmpDir, "jobs"), { recursive: true });

		await createJob({ ...baseInput, name: "list-test-1" });
		await createJob({ ...baseInput, name: "list-test-2" });

		const jobs = await listJobs();

		expect(jobs.length).toBe(2);
		const names = jobs.map((j) => j.name).sort();
		expect(names).toEqual(["list-test-1", "list-test-2"]);
	});

	it("returns empty array when no jobs directory exists", async () => {
		// Remove the jobs directory entirely
		await rm(join(tmpDir, "jobs"), { recursive: true, force: true });

		const jobs = await listJobs();
		expect(jobs).toEqual([]);

		// Recreate for any subsequent tests
		await mkdir(join(tmpDir, "jobs"), { recursive: true });
	});
});
