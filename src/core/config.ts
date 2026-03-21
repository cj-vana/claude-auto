import { readFile } from "node:fs/promises";
import { Document, parseDocument } from "yaml";
import { z } from "zod";
import { ConfigParseError, ConfigValidationError } from "../util/errors.js";
import { writeFileSafe } from "../util/fs.js";
import { type JobConfig, JobConfigSchema } from "./types.js";

/**
 * Read a YAML config file and return the parsed Document (preserves comments).
 * Throws ConfigParseError if the YAML syntax is invalid.
 */
export async function readConfigDocument(filePath: string): Promise<Document> {
	const content = await readFile(filePath, "utf-8");
	const doc = parseDocument(content);

	if (doc.errors.length > 0) {
		throw new ConfigParseError(
			filePath,
			doc.errors.map((e) => ({ message: e.message })),
		);
	}

	return doc;
}

/**
 * Validate a parsed YAML Document against the JobConfigSchema.
 * Returns the validated and typed JobConfig.
 * Throws ConfigValidationError if validation fails.
 */
export function validateConfig(filePath: string, doc: Document): JobConfig {
	const raw = doc.toJS();
	const result = JobConfigSchema.safeParse(raw);

	if (!result.success) {
		throw new ConfigValidationError(filePath, z.prettifyError(result.error));
	}

	return result.data;
}

/**
 * Load a job config from a YAML file, validating it against the schema.
 * Combines readConfigDocument + validateConfig.
 */
export async function loadJobConfig(filePath: string): Promise<JobConfig> {
	const doc = await readConfigDocument(filePath);
	return validateConfig(filePath, doc);
}

/**
 * Save a JobConfig to a YAML file using atomic writes.
 * Multiline systemPrompt values use YAML block literal style (|).
 */
export async function saveJobConfig(filePath: string, config: JobConfig): Promise<void> {
	const doc = new Document(config);

	// For multiline systemPrompt, force YAML block literal style (|)
	if (config.systemPrompt?.includes("\n")) {
		const node = doc.getIn(["systemPrompt"]);
		if (node && typeof node === "object" && "type" in node) {
			(node as { type: string }).type = "BLOCK_LITERAL";
		}
	}

	const yamlContent = doc.toString({ indent: 2 });
	await writeFileSafe(filePath, yamlContent);
}

/**
 * Update a field in a YAML Document by path, preserving comments.
 */
export function updateConfigField(doc: Document, path: (string | number)[], value: unknown): void {
	doc.setIn(path, value);
}

/**
 * Write a YAML Document to a file using atomic writes, preserving comments.
 */
export async function writeConfigDocument(filePath: string, doc: Document): Promise<void> {
	const yamlContent = doc.toString({ indent: 2 });
	await writeFileSafe(filePath, yamlContent);
}
