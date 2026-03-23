import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const CLAUDE_DIR = join(homedir(), ".claude");
const PLUGINS_DIR = join(CLAUDE_DIR, "plugins");
const INSTALLED_FILE = join(PLUGINS_DIR, "installed_plugins.json");
const SETTINGS_FILE = join(CLAUDE_DIR, "settings.json");
const PLUGIN_ID = "claude-auto";

// The plugin root is the package install location (where .claude-plugin/ lives)
const pluginRoot = join(import.meta.dirname, "..");
const now = new Date().toISOString();

try {
	mkdirSync(PLUGINS_DIR, { recursive: true });

	// 1. Register in installed_plugins.json
	let installed = { version: 2, plugins: {} };
	if (existsSync(INSTALLED_FILE)) {
		try {
			installed = JSON.parse(readFileSync(INSTALLED_FILE, "utf-8"));
		} catch {
			// Corrupted file — start fresh
		}
	}

	installed.plugins = installed.plugins || {};
	installed.plugins[PLUGIN_ID] = [
		{
			scope: "user",
			installPath: pluginRoot,
			version: "0.1.0",
			installedAt: now,
			lastUpdated: now,
			isLocal: true,
		},
	];

	writeFileSync(INSTALLED_FILE, JSON.stringify(installed, null, 2) + "\n");

	// 2. Enable in settings.json
	mkdirSync(CLAUDE_DIR, { recursive: true });
	let settings = {};
	if (existsSync(SETTINGS_FILE)) {
		try {
			settings = JSON.parse(readFileSync(SETTINGS_FILE, "utf-8"));
		} catch {
			// Corrupted file — start fresh
		}
	}

	settings.enabledPlugins = settings.enabledPlugins || {};
	settings.enabledPlugins[PLUGIN_ID] = true;

	writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + "\n");

	console.log("claude-auto: Registered as Claude Code plugin");
	console.log(
		"claude-auto: Slash commands available — /claude-auto:setup, /claude-auto:list, etc.",
	);
} catch (err) {
	console.warn("claude-auto: Could not auto-register plugin:", err.message);
	console.warn("claude-auto: Register manually — see README for instructions.");
}
