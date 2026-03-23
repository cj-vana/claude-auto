import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
		testTimeout: 15000,
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
		},
	},
});
