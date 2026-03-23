import { defineConfig } from "tsup";

export default defineConfig([
	{
		entry: ["src/index.ts"],
		format: ["esm"],
		dts: true,
		clean: true,
		sourcemap: true,
		target: "node22",
	},
	{
		entry: ["bin/claude-auto.ts", "bin/claude-auto-run.ts"],
		format: ["esm"],
		dts: false,
		clean: false,
		sourcemap: true,
		target: "node22",
	},
	{
		entry: ["src/tui/index.tsx"],
		format: ["esm"],
		dts: false,
		clean: false,
		sourcemap: true,
		target: "node22",
		esbuildOptions(options) {
			options.jsx = "automatic";
		},
		external: ["ink", "react", "@inkjs/ui"],
	},
]);
