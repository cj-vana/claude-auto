import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("../../src/runner/cost-tracker.js", () => ({
	getCostSummary: vi.fn(),
}));

vi.mock("../../src/core/database.js", () => ({
	closeDatabase: vi.fn(),
}));

import { costCommand } from "../../src/cli/commands/cost.js";
import { closeDatabase } from "../../src/core/database.js";
import { getCostSummary } from "../../src/runner/cost-tracker.js";

const mockedGetCostSummary = vi.mocked(getCostSummary);
const mockedCloseDatabase = vi.mocked(closeDatabase);

describe("costCommand", () => {
	let logSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.clearAllMocks();
		logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		logSpy.mockRestore();
	});

	it("costCommand with no jobId outputs per-job summary table", async () => {
		mockedGetCostSummary.mockReturnValue([
			{ job_id: "job-a", runs: 5, total_cost: 12.5, avg_cost: 2.5, total_turns: 60 },
			{ job_id: "job-b", runs: 3, total_cost: 4.0, avg_cost: 1.3333, total_turns: 30 },
		]);

		await costCommand({});

		expect(mockedGetCostSummary).toHaveBeenCalled();
		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("Job ID");
		expect(output).toContain("Runs");
		expect(output).toContain("Total Cost");
		expect(output).toContain("Avg Cost");
		expect(output).toContain("Turns");
		expect(output).toContain("job-a");
		expect(output).toContain("job-b");
		expect(mockedCloseDatabase).toHaveBeenCalled();
	});

	it("costCommand with jobId outputs per-day breakdown", async () => {
		mockedGetCostSummary.mockReturnValue([
			{ day: "2026-03-21", runs: 3, total_cost: 7.5, total_turns: 36 },
			{ day: "2026-03-20", runs: 2, total_cost: 3.0, total_turns: 20 },
		]);

		await costCommand({ jobId: "job-a" });

		expect(mockedGetCostSummary).toHaveBeenCalledWith("job-a");
		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("Date");
		expect(output).toContain("Runs");
		expect(output).toContain("Cost");
		expect(output).toContain("Turns");
		expect(output).toContain("2026-03-21");
		expect(output).toContain("2026-03-20");
		expect(mockedCloseDatabase).toHaveBeenCalled();
	});

	it("costCommand with no data outputs 'No cost data found' message", async () => {
		mockedGetCostSummary.mockReturnValue([]);

		await costCommand({});

		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("No cost data found");
		expect(mockedCloseDatabase).toHaveBeenCalled();
	});

	it("costCommand with --json flag outputs JSON array instead of table", async () => {
		const data = [{ job_id: "job-a", runs: 5, total_cost: 12.5, avg_cost: 2.5, total_turns: 60 }];
		mockedGetCostSummary.mockReturnValue(data);

		await costCommand({ json: true });

		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		const parsed = JSON.parse(output);
		expect(parsed).toEqual(data);
		expect(mockedCloseDatabase).toHaveBeenCalled();
	});

	it("costCommand with jobId and no data outputs job-specific message", async () => {
		mockedGetCostSummary.mockReturnValue([]);

		await costCommand({ jobId: "job-x" });

		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("No cost data found for job: job-x");
		expect(mockedCloseDatabase).toHaveBeenCalled();
	});
});
