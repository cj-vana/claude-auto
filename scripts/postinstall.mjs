import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, symlinkSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const pluginRoot = join(import.meta.dirname, "..");
const marketplaceDir = join(homedir(), ".claude-auto-marketplace");
const marketplacePluginDir = join(marketplaceDir, "plugins");
const marketplaceManifest = join(marketplaceDir, ".claude-plugin", "marketplace.json");
const symlinkPath = join(marketplacePluginDir, "claude-auto");

try {
	// 1. Create local marketplace structure
	mkdirSync(join(marketplaceDir, ".claude-plugin"), { recursive: true });
	mkdirSync(marketplacePluginDir, { recursive: true });

	writeFileSync(
		marketplaceManifest,
		JSON.stringify(
			{
				name: "claude-auto-local",
				description: "Local marketplace for claude-auto plugin",
				owner: { name: "claude-auto", email: "noreply@claude-auto.dev" },
				plugins: [
					{
						name: "claude-auto",
						description:
							"Autonomous Claude Code cron jobs for continuous codebase improvement",
						source: "./plugins/claude-auto",
						category: "productivity",
					},
				],
			},
			null,
			2,
		) + "\n",
	);

	// 2. Symlink plugin into marketplace (remove stale link first)
	try {
		if (existsSync(symlinkPath)) {
			const current = readlinkSync(symlinkPath);
			if (current !== pluginRoot) {
				// Stale symlink — remove and recreate
				const { unlinkSync } = await import("node:fs");
				unlinkSync(symlinkPath);
				symlinkSync(pluginRoot, symlinkPath);
			}
		} else {
			symlinkSync(pluginRoot, symlinkPath);
		}
	} catch {
		// Symlink failed — try direct path in marketplace.json instead
		writeFileSync(
			marketplaceManifest,
			JSON.stringify(
				{
					name: "claude-auto-local",
					description: "Local marketplace for claude-auto plugin",
					owner: { name: "claude-auto", email: "noreply@claude-auto.dev" },
					plugins: [
						{
							name: "claude-auto",
							description:
								"Autonomous Claude Code cron jobs for continuous codebase improvement",
							source: pluginRoot,
							category: "productivity",
						},
					],
				},
				null,
				2,
			) + "\n",
		);
	}

	// 3. Register marketplace + install plugin via Claude CLI
	try {
		execFileSync("claude", ["plugin", "marketplace", "add", marketplaceDir], {
			stdio: "pipe",
			timeout: 15000,
		});
	} catch {
		// Marketplace may already be registered — that's fine
	}

	try {
		execFileSync("claude", ["plugin", "install", "claude-auto@claude-auto-local"], {
			stdio: "inherit",
			timeout: 15000,
		});
		console.log("claude-auto: Plugin installed successfully");
		console.log(
			"claude-auto: Slash commands available — /claude-auto:setup, /claude-auto:list, etc.",
		);
	} catch {
		console.warn("claude-auto: Could not auto-install plugin via Claude CLI.");
		console.warn("claude-auto: Register manually:");
		console.warn(`  claude plugin marketplace add ${marketplaceDir}`);
		console.warn("  claude plugin install claude-auto@claude-auto-local");
	}
} catch (err) {
	console.warn("claude-auto: Plugin registration failed:", err.message);
	console.warn("claude-auto: Use --plugin-dir for per-session loading:");
	console.warn(`  claude --plugin-dir ${pluginRoot}`);
}
