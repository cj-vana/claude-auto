import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const SETTINGS_FILE = join(homedir(), ".claude", "settings.json");
const PLUGIN_KEY = "claude-auto";

try {
	if (!existsSync(SETTINGS_FILE)) {
		// Nothing to clean up
		process.exit(0);
	}

	const settings = JSON.parse(readFileSync(SETTINGS_FILE, "utf-8"));

	if (settings.enabledPlugins && settings.enabledPlugins[PLUGIN_KEY]) {
		delete settings.enabledPlugins[PLUGIN_KEY];
		writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + "\n");
		console.log("claude-auto: Removed plugin registration");
	}
} catch {
	// Best-effort: don't fail npm uninstall if cleanup fails
}
