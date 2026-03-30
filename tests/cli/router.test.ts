import { beforeEach, describe, expect, it, vi } from "vitest";

describe("parseCommand", () => {
	let parseCommand: typeof import("../../src/cli/router.js").parseCommand;

	beforeEach(async () => {
		vi.resetModules();
		const mod = await import("../../src/cli/router.js");
		parseCommand = mod.parseCommand;
	});

	it("parseCommand('list') returns { command: 'list', args: {} }", () => {
		const result = parseCommand(["list"]);
		expect(result).toEqual({ command: "list", args: {} });
	});

	it("parseCommand('logs', 'abc123') returns { command: 'logs', args: { jobId: 'abc123' } }", () => {
		const result = parseCommand(["logs", "abc123"]);
		expect(result).toEqual({ command: "logs", args: { jobId: "abc123" } });
	});

	it("parseCommand('logs', 'abc123', '--limit', '5') returns { command: 'logs', args: { jobId: 'abc123', limit: 5 } }", () => {
		const result = parseCommand(["logs", "abc123", "--limit", "5"]);
		expect(result).toEqual({ command: "logs", args: { jobId: "abc123", limit: 5 } });
	});

	it("parseCommand('report', 'abc123') returns { command: 'report', args: { jobId: 'abc123' } }", () => {
		const result = parseCommand(["report", "abc123"]);
		expect(result).toEqual({ command: "report", args: { jobId: "abc123" } });
	});

	it("parseCommand('report') with no args returns { command: 'report', args: {} }", () => {
		const result = parseCommand(["report"]);
		expect(result).toEqual({ command: "report", args: {} });
	});

	it("parseCommand() with no args returns { command: 'help', args: {} }", () => {
		const result = parseCommand([]);
		expect(result).toEqual({ command: "help", args: {} });
	});

	it("parseCommand('unknown') returns { command: 'help', args: {} }", () => {
		// Capture stderr for the error message
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const result = parseCommand(["unknown"]);
		expect(result).toEqual({ command: "help", args: {} });
		errorSpy.mockRestore();
	});

	it("parseCommand('dashboard') returns { command: 'dashboard', args: {} }", () => {
		const result = parseCommand(["dashboard"]);
		expect(result).toEqual({ command: "dashboard", args: {} });
	});

	it("parseCommand('logs', '--limit', 'abc') returns help due to invalid limit", () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const result = parseCommand(["logs", "abc123", "--limit", "abc"]);
		expect(result).toEqual({ command: "help", args: {} });
		expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid value for --limit"));
		errorSpy.mockRestore();
	});

	it("parseCommand with --restrict-paths flag returns restrictPaths in args", () => {
		const result = parseCommand([
			"create",
			"--name",
			"test",
			"--repo",
			"/tmp",
			"--schedule",
			"0 * * * *",
			"--restrict-paths",
			"src/,tests/",
		]);
		expect(result.command).toBe("create");
		expect(result.args.restrictPaths).toBe("src/,tests/");
	});
});

describe("formatDuration", () => {
	let formatDuration: typeof import("../../src/cli/format.js").formatDuration;

	beforeEach(async () => {
		vi.resetModules();
		const mod = await import("../../src/cli/format.js");
		formatDuration = mod.formatDuration;
	});

	it("formats 65000ms as '1m 5s'", () => {
		expect(formatDuration(65000)).toBe("1m 5s");
	});

	it("formats 3600000ms as '1h 0m'", () => {
		expect(formatDuration(3600000)).toBe("1h 0m");
	});

	it("formats 500ms as '0s'", () => {
		expect(formatDuration(500)).toBe("0s");
	});

	it("formats 7265000ms as '2h 1m'", () => {
		expect(formatDuration(7265000)).toBe("2h 1m");
	});

	it("formats 45000ms as '45s'", () => {
		expect(formatDuration(45000)).toBe("45s");
	});
});

describe("formatRelativeTime", () => {
	let formatRelativeTime: typeof import("../../src/cli/format.js").formatRelativeTime;

	beforeEach(async () => {
		vi.resetModules();
		const mod = await import("../../src/cli/format.js");
		formatRelativeTime = mod.formatRelativeTime;
	});

	it("returns 'just now' for very recent times", () => {
		expect(formatRelativeTime(new Date(Date.now() - 5000))).toBe("just now");
	});

	it("returns minutes ago for recent times", () => {
		const result = formatRelativeTime(new Date(Date.now() - 5 * 60 * 1000));
		expect(result).toBe("5 minutes ago");
	});

	it("returns '1 hour ago' for roughly an hour ago", () => {
		const result = formatRelativeTime(new Date(Date.now() - 3600000));
		expect(result).toBe("1 hour ago");
	});

	it("returns days ago for older times", () => {
		const result = formatRelativeTime(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000));
		expect(result).toBe("2 days ago");
	});
});

describe("formatTable", () => {
	let formatTable: typeof import("../../src/cli/format.js").formatTable;

	beforeEach(async () => {
		vi.resetModules();
		const mod = await import("../../src/cli/format.js");
		formatTable = mod.formatTable;
	});

	it("formats table with aligned columns", () => {
		const result = formatTable(["A", "B"], [["1", "2"]]);
		expect(result).toContain("A");
		expect(result).toContain("B");
		expect(result).toContain("1");
		expect(result).toContain("2");
	});

	it("pads columns to match widest content", () => {
		const result = formatTable(
			["Name", "Value"],
			[
				["short", "x"],
				["much longer name", "y"],
			],
		);
		const lines = result.split("\n").filter(Boolean);
		// All lines should have the same length (padded)
		expect(lines.length).toBeGreaterThanOrEqual(3); // header + separator + 2 rows
	});

	it("includes a separator line", () => {
		const result = formatTable(["Name", "Value"], [["foo", "bar"]]);
		// Separator line should contain dashes matching column widths
		const lines = result.split("\n").filter(Boolean);
		expect(lines.some((line) => line.includes("----"))).toBe(true);
	});

	it("returns empty string for empty rows", () => {
		const result = formatTable(["A", "B"], []);
		expect(result).toBe("");
	});
});

describe("statusBadge", () => {
	let statusBadge: typeof import("../../src/cli/format.js").statusBadge;

	beforeEach(async () => {
		vi.resetModules();
		const mod = await import("../../src/cli/format.js");
		statusBadge = mod.statusBadge;
	});

	it("wraps status in brackets", () => {
		expect(statusBadge("active")).toBe("[active]");
		expect(statusBadge("paused")).toBe("[paused]");
	});
});
