import { execFileSync } from "node:child_process";

try {
	execFileSync("claude", ["plugin", "uninstall", "claude-auto@claude-auto-local"], {
		stdio: "pipe",
		timeout: 15000,
	});
	console.log("claude-auto: Plugin uninstalled");
} catch {
	// Best-effort — don't fail npm uninstall
}

try {
	execFileSync("claude", ["plugin", "marketplace", "remove", "claude-auto-local"], {
		stdio: "pipe",
		timeout: 15000,
	});
} catch {
	// Marketplace removal is optional
}
