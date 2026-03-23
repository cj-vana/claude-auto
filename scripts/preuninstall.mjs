import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const CLAUDE_DIR = join(homedir(), ".claude");
const PLUGINS_DIR = join(CLAUDE_DIR, "plugins");
const INSTALLED_FILE = join(PLUGINS_DIR, "installed_plugins.json");
const SETTINGS_FILE = join(CLAUDE_DIR, "settings.json");
const PLUGIN_ID = "claude-auto";

try {
	// 1. Remove from installed_plugins.json
	if (existsSync(INSTALLED_FILE)) {
		const installed = JSON.parse(readFileSync(INSTALLED_FILE, "utf-8"));
		if (installed.plugins && installed.plugins[PLUGIN_ID]) {
			delete installed.plugins[PLUGIN_ID];
			writeFileSync(INSTALLED_FILE, JSON.stringify(installed, null, 2) + "\n");
		}
	}

	// 2. Remove from settings.json enabledPlugins
	if (existsSync(SETTINGS_FILE)) {
		const settings = JSON.parse(readFileSync(SETTINGS_FILE, "utf-8"));
		if (settings.enabledPlugins && settings.enabledPlugins[PLUGIN_ID]) {
			delete settings.enabledPlugins[PLUGIN_ID];
			writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + "\n");
		}
	}

	console.log("claude-auto: Plugin unregistered");
} catch {
	// Best-effort: don't fail npm uninstall if cleanup fails
}
