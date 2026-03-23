import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const SETTINGS_DIR = join(homedir(), ".claude");
const SETTINGS_FILE = join(SETTINGS_DIR, "settings.json");
const PLUGIN_KEY = "claude-auto";

// The plugin root is the package install location (where .claude-plugin/ lives)
const pluginRoot = join(import.meta.dirname, "..");

try {
	mkdirSync(SETTINGS_DIR, { recursive: true });

	let settings = {};
	if (existsSync(SETTINGS_FILE)) {
		settings = JSON.parse(readFileSync(SETTINGS_FILE, "utf-8"));
	}

	// Register plugin — Claude Code expects enabledPlugins[key] = true
	// for local plugins discovered via --plugin-dir or npm postinstall
	settings.enabledPlugins = settings.enabledPlugins || {};
	settings.enabledPlugins[PLUGIN_KEY] = true;

	writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + "\n");
	console.log("claude-auto: Registered as Claude Code plugin");
	console.log(
		"claude-auto: Slash commands available — /claude-auto:setup, /claude-auto:list, etc.",
	);
} catch (err) {
	// Best-effort: don't fail npm install if registration fails
	console.warn("claude-auto: Could not register plugin:", err.message);
	console.warn(
		"claude-auto: Load manually with: claude --plugin-dir",
		pluginRoot,
	);
}
