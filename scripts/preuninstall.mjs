import { rmSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

try {
	rmSync(join(homedir(), ".claude", "commands", "claude-auto"), { recursive: true, force: true });
	console.log("claude-auto: Slash commands removed");
} catch {
	// Best-effort — don't fail npm uninstall
}
