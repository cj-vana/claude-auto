import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "ink-testing-library";
import { JobList } from "../../src/tui/components/job-list.js";
import { StatusBar } from "../../src/tui/components/status-bar.js";
import type { JobWithMeta } from "../../src/tui/hooks/use-jobs.js";

// Mock @inkjs/ui Spinner to avoid complex rendering in tests
vi.mock("@inkjs/ui", () => ({
	Spinner: ({ label }: { label: string }) => React.createElement("ink-text", null, label),
}));

// Mock cronstrue
vi.mock("cronstrue", () => ({
	default: {
		toString: (_cron: string) => "Every day at 9:00 AM",
	},
}));

afterEach(() => {
	cleanup();
});

function makeJobWithMeta(overrides: Partial<JobWithMeta> = {}): JobWithMeta {
	return {
		id: "test-job-1",
		name: "My Test Job",
		repoPath: "/tmp/repo",
		branch: "main",
		cron: "0 9 * * *",
		timezone: "UTC",
		focus: ["open-issues"],
		enabled: true,
		maxBudgetUsd: 5.0,
		lastRun: null,
		nextRun: new Date(Date.now() + 3600000), // 1 hour from now
		totalCost: 2.5,
		...overrides,
	};
}

describe("JobList", () => {
	it("renders job data with name, status, and cost", () => {
		const jobs = [makeJobWithMeta()];
		const { lastFrame } = render(
			<JobList jobs={jobs} selectedIdx={0} loading={false} />,
		);

		const output = lastFrame()!;
		expect(output).toContain("My Test Job");
		expect(output).toContain("active");
		expect(output).toContain("$2.50");
	});

	it("shows loading spinner when loading with empty jobs", () => {
		const { lastFrame } = render(
			<JobList jobs={[]} selectedIdx={0} loading={true} />,
		);

		const output = lastFrame()!;
		expect(output).toContain("Loading jobs...");
	});

	it("shows empty state message when no jobs and not loading", () => {
		const { lastFrame } = render(
			<JobList jobs={[]} selectedIdx={0} loading={false} />,
		);

		const output = lastFrame()!;
		expect(output).toContain("No jobs configured");
		expect(output).toContain("claude-auto create");
	});

	it("renders paused job with yellow status", () => {
		const jobs = [makeJobWithMeta({ enabled: false, nextRun: null })];
		const { lastFrame } = render(
			<JobList jobs={jobs} selectedIdx={0} loading={false} />,
		);

		const output = lastFrame()!;
		expect(output).toContain("paused");
	});

	it("renders multiple jobs", () => {
		const jobs = [
			makeJobWithMeta({ id: "job-1", name: "First Job" }),
			makeJobWithMeta({ id: "job-2", name: "Second Job", totalCost: 0.75 }),
		];
		const { lastFrame } = render(
			<JobList jobs={jobs} selectedIdx={1} loading={false} />,
		);

		const output = lastFrame()!;
		expect(output).toContain("First Job");
		expect(output).toContain("Second Job");
		expect(output).toContain("$0.75");
	});

	it("renders header row", () => {
		const jobs = [makeJobWithMeta()];
		const { lastFrame } = render(
			<JobList jobs={jobs} selectedIdx={0} loading={false} />,
		);

		const output = lastFrame()!;
		expect(output).toContain("Name");
		expect(output).toContain("Status");
		expect(output).toContain("Schedule");
		expect(output).toContain("Next Run");
		expect(output).toContain("Cost");
	});
});

describe("StatusBar", () => {
	it("renders list view hints", () => {
		const { lastFrame } = render(<StatusBar view="list" />);
		const output = lastFrame()!;
		expect(output).toContain("up/down navigate");
		expect(output).toContain("Enter detail");
		expect(output).toContain("p pause/resume");
		expect(output).toContain("q quit");
	});

	it("renders detail view hints", () => {
		const { lastFrame } = render(<StatusBar view="detail" />);
		const output = lastFrame()!;
		expect(output).toContain("Esc back");
		expect(output).toContain("p pause/resume");
		expect(output).toContain("q quit");
	});

	it("renders logs view hints", () => {
		const { lastFrame } = render(<StatusBar view="logs" />);
		const output = lastFrame()!;
		expect(output).toContain("Esc back");
		expect(output).toContain("j/k scroll");
		expect(output).toContain("q quit");
	});
});
