import { readdir, readFile, rm } from "node:fs/promises";
import { nanoid } from "nanoid";
import { parseDocument } from "yaml";
import { z } from "zod";
import { writeFileSafe } from "../util/fs.js";
import { paths } from "../util/paths.js";
import { loadJobConfig, saveJobConfig } from "./config.js";
import { type JobConfig, JobConfigSchema } from "./types.js";

/**
 * Create a new job with a generated nanoid(12) identifier.
 * Writes the config to disk and returns the complete JobConfig.
 */
export async function createJob(input: Omit<JobConfig, "id">): Promise<JobConfig> {
	const id = nanoid(12);
	const config: JobConfig = { ...input, id };
	await saveJobConfig(paths.jobConfig(id), config);
	return config;
}

/**
 * Read and validate a job config by its ID.
 * Throws if the job doesn't exist (ENOENT) or config is invalid.
 */
export async function readJob(jobId: string): Promise<JobConfig> {
	return loadJobConfig(paths.jobConfig(jobId));
}

/**
 * Update specified fields of a job config while preserving YAML comments.
 * Validates the result before writing. Rejects invalid updates.
 */
export async function updateJob(
	jobId: string,
	updates: Partial<Omit<JobConfig, "id">>,
): Promise<JobConfig> {
	const configPath = paths.jobConfig(jobId);
	const content = await readFile(configPath, "utf-8");
	const doc = parseDocument(content);

	// Apply each update key to the Document, preserving comments
	for (const [key, value] of Object.entries(updates)) {
		if (key === "id") continue; // Never update the id
		doc.set(key, doc.createNode(value));
	}

	// Validate the modified document
	const raw = doc.toJS();
	const result = JobConfigSchema.safeParse(raw);

	if (!result.success) {
		throw new Error(`Invalid config after update: ${z.prettifyError(result.error)}`);
	}

	await writeFileSafe(configPath, doc.toString({ indent: 2 }));
	return result.data;
}

/**
 * Delete a job and its entire directory.
 * Idempotent: does not throw if the job doesn't exist.
 */
export async function deleteJob(jobId: string): Promise<void> {
	await rm(paths.jobDir(jobId), { recursive: true, force: true });
}

/**
 * List all valid job configs.
 * Skips invalid directories/configs. Returns empty array if no jobs directory exists.
 */
export async function listJobs(): Promise<JobConfig[]> {
	let entries: import("node:fs").Dirent<string>[];
	try {
		entries = await readdir(paths.jobs, { withFileTypes: true, encoding: "utf-8" });
	} catch (error: unknown) {
		if (
			error instanceof Error &&
			"code" in error &&
			(error as NodeJS.ErrnoException).code === "ENOENT"
		) {
			return [];
		}
		throw error;
	}

	const results: JobConfig[] = [];
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		try {
			const config = await readJob(entry.name);
			results.push(config);
		} catch {
			// Skip invalid directories/configs
		}
	}

	return results;
}
