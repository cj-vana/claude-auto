import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

describe("Plugin manifest", () => {
	it("plugin.json exists and is valid JSON", () => {
		const manifestPath = join(ROOT, ".claude-plugin", "plugin.json");
		expect(existsSync(manifestPath)).toBe(true);
		const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
		expect(manifest.name).toBe("claude-auto");
		expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
		expect(manifest.description).toBeTruthy();
	});
});

describe("Skills directory", () => {
	const EXPECTED_SKILLS = ["setup", "list", "pause", "resume", "edit", "remove", "status", "logs"];

	it.each(EXPECTED_SKILLS)("skills/%s/SKILL.md exists with valid frontmatter", (skillName) => {
		const skillPath = join(ROOT, "skills", skillName, "SKILL.md");
		expect(existsSync(skillPath)).toBe(true);
		const content = readFileSync(skillPath, "utf-8");

		// Check frontmatter boundaries
		expect(content.startsWith("---\n")).toBe(true);
		const endIdx = content.indexOf("---\n", 4);
		expect(endIdx).toBeGreaterThan(4);

		const frontmatter = content.slice(4, endIdx);
		// Required frontmatter fields
		expect(frontmatter).toContain("name:");
		expect(frontmatter).toContain("description:");
		expect(frontmatter).toContain("allowed-tools:");
		// All skills must delegate to claude-auto CLI
		expect(frontmatter).toContain("Bash(claude-auto");
	});

	it("all expected skill directories exist", () => {
		const skillsDir = join(ROOT, "skills");
		const dirs = readdirSync(skillsDir, { withFileTypes: true })
			.filter((d) => d.isDirectory())
			.map((d) => d.name)
			.sort();
		expect(dirs).toEqual(EXPECTED_SKILLS.sort());
	});
});

describe("Distribution scripts", () => {
	it("postinstall.mjs exists", () => {
		expect(existsSync(join(ROOT, "scripts", "postinstall.mjs"))).toBe(true);
	});

	it("preuninstall.mjs exists", () => {
		expect(existsSync(join(ROOT, "scripts", "preuninstall.mjs"))).toBe(true);
	});
});

describe("package.json distribution config", () => {
	it("has postinstall and preuninstall scripts", () => {
		const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
		expect(pkg.scripts.postinstall).toContain("postinstall.mjs");
		expect(pkg.scripts.preuninstall).toContain("preuninstall.mjs");
	});

	it("files field includes plugin assets", () => {
		const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
		expect(pkg.files).toContain(".claude-plugin/");
		expect(pkg.files).toContain("skills/");
	});
});
