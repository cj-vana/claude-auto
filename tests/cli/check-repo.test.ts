import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("node:fs/promises", () => ({
	stat: vi.fn(),
}));

vi.mock("../../src/util/exec.js", () => ({
	execCommand: vi.fn(),
}));

import { stat } from "node:fs/promises";
import { checkRepoCommand } from "../../src/cli/commands/check-repo.js";
import { execCommand } from "../../src/util/exec.js";

const mockedStat = vi.mocked(stat);
const mockedExecCommand = vi.mocked(execCommand);

describe("checkRepoCommand", () => {
	let logSpy: ReturnType<typeof vi.spyOn>;
	let errorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.clearAllMocks();
		logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		logSpy.mockRestore();
		errorSpy.mockRestore();
	});

	it("outputs JSON with repo info for existing git repo", async () => {
		mockedStat.mockResolvedValue({ isDirectory: () => true } as import("node:fs").Stats);
		mockedExecCommand
			.mockResolvedValueOnce({ stdout: ".git\n", stderr: "" }) // git rev-parse
			.mockResolvedValueOnce({ stdout: "https://github.com/owner/repo.git\n", stderr: "" }); // git remote get-url

		await checkRepoCommand({ path: "/home/user/repos/my-project" });

		const output = logSpy.mock.calls[0][0];
		const json = JSON.parse(output);
		expect(json).toEqual({
			exists: true,
			isGitRepo: true,
			remote: "https://github.com/owner/repo.git",
		});
	});

	it("outputs JSON with exists:false for non-existent path", async () => {
		const enoent = new Error("ENOENT") as NodeJS.ErrnoException;
		enoent.code = "ENOENT";
		mockedStat.mockRejectedValue(enoent);

		await checkRepoCommand({ path: "/nonexistent/path" });

		const output = logSpy.mock.calls[0][0];
		const json = JSON.parse(output);
		expect(json).toEqual({ exists: false });
	});

	it("outputs JSON with error for path that exists but is not a directory", async () => {
		mockedStat.mockResolvedValue({ isDirectory: () => false } as import("node:fs").Stats);

		await checkRepoCommand({ path: "/home/user/somefile.txt" });

		const output = logSpy.mock.calls[0][0];
		const json = JSON.parse(output);
		expect(json).toEqual({ exists: false, error: "Not a directory" });
	});

	it("throws error when --path arg is missing", async () => {
		await expect(checkRepoCommand({})).rejects.toThrow("Missing --path argument");

		const output = errorSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("Usage");
	});
});
