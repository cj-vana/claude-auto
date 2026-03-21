#!/usr/bin/env node
import { runCli } from "../src/cli/router.js";

try {
	await runCli(process.argv.slice(2));
	process.exit(0);
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
}
