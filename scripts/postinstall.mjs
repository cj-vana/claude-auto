import { cpSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const pluginRoot = join(import.meta.dirname, "..");
const skillsSource = join(pluginRoot, "skills");
const commandsDir = join(homedir(), ".claude", "commands", "claude-auto");

try {
	// Install slash commands to ~/.claude/commands/claude-auto/
	// This gives /claude-auto:setup, /claude-auto:list, etc.
	if (existsSync(skillsSource)) {
		mkdirSync(commandsDir, { recursive: true });
		const skills = readdirSync(skillsSource, { withFileTypes: true });
		for (const entry of skills) {
			if (entry.isDirectory()) {
				const src = join(skillsSource, entry.name, "SKILL.md");
				const dest = join(commandsDir, `${entry.name}.md`);
				if (existsSync(src)) {
					cpSync(src, dest);
				}
			}
		}
		console.log("claude-auto: Slash commands installed");
		console.log("claude-auto: Available: /claude-auto:setup, /claude-auto:list, /claude-auto:logs, etc.");
	}
} catch (err) {
	console.warn("claude-auto: Could not install slash commands:", err.message);
	console.warn("claude-auto: Copy skills manually:");
	console.warn(`  cp ${skillsSource}/*/SKILL.md ~/.claude/commands/claude-auto/`);
}
