import React from "react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup } from "ink-testing-library";

// Mock all external dependencies to avoid filesystem/DB access
vi.mock("../../src/core/job-manager.js", () => ({
	listJobs: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../src/runner/cost-tracker.js", () => ({
	getCostSummary: vi.fn().mockReturnValue([]),
}));

vi.mock("../../src/runner/logger.js", () => ({
	listRunLogs: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../src/core/schedule.js", () => ({
	getNextRuns: vi.fn().mockReturnValue([new Date("2026-03-23T09:00:00Z")]),
}));

vi.mock("cronstrue", () => ({
	default: {
		toString: () => "Every day at 9:00 AM",
	},
}));

vi.mock("@inkjs/ui", () => ({
	Spinner: ({ label }: { label: string }) => React.createElement("ink-text", null, label),
}));

vi.mock("../../src/cli/commands/pause.js", () => ({
	pauseCommand: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/cli/commands/resume.js", () => ({
	resumeCommand: vi.fn().mockResolvedValue(undefined),
}));

import { App } from "../../src/tui/app.js";
import { listJobs } from "../../src/core/job-manager.js";
import type { JobConfig } from "../../src/core/types.js";

const mockListJobs = vi.mocked(listJobs);

function makeJobConfig(overrides: Partial<JobConfig> = {}): JobConfig {
	return {
		id: "test-job-1",
		name: "Test Job",
		repo: { path: "/tmp/repo", branch: "main", remote: "origin" },
		schedule: { cron: "0 9 * * *", timezone: "UTC" },
		focus: ["open-issues"],
		enabled: true,
		guardrails: {
			maxTurns: 50,
			maxBudgetUsd: 5.0,
			noNewDependencies: false,
			noArchitectureChanges: false,
			bugFixOnly: false,
		},
		notifications: {},
		maxFeedbackRounds: 3,
		...overrides,
	};
}

afterEach(() => {
	cleanup();
});

beforeEach(() => {
	vi.clearAllMocks();
});

describe("App", () => {
	it("renders the dashboard header", async () => {
		mockListJobs.mockResolvedValue([]);

		const { lastFrame } = render(<App />);

		// Wait for initial render
		await vi.waitFor(() => {
			const output = lastFrame()!;
			expect(output).toContain("claude-auto dashboard");
		});
	});

	it("renders job list when jobs are loaded", async () => {
		const jobs = [makeJobConfig()];
		mockListJobs.mockResolvedValue(jobs);

		const { lastFrame } = render(<App />);

		await vi.waitFor(() => {
			const output = lastFrame()!;
			expect(output).toContain("Test Job");
		});
	});

	it("shows empty state when no jobs exist", async () => {
		mockListJobs.mockResolvedValue([]);

		const { lastFrame } = render(<App />);

		await vi.waitFor(() => {
			const output = lastFrame()!;
			expect(output).toContain("No jobs configured");
		});
	});

	it("renders status bar with list view hints", async () => {
		mockListJobs.mockResolvedValue([]);

		const { lastFrame } = render(<App />);

		await vi.waitFor(() => {
			const output = lastFrame()!;
			expect(output).toContain("up/down navigate");
			expect(output).toContain("q quit");
		});
	});

	it("renders multiple jobs in list view", async () => {
		const jobs = [
			makeJobConfig({ id: "job-1", name: "First Job" }),
			makeJobConfig({ id: "job-2", name: "Second Job" }),
		];
		mockListJobs.mockResolvedValue(jobs);

		const { lastFrame } = render(<App />);

		await vi.waitFor(() => {
			const output = lastFrame()!;
			expect(output).toContain("First Job");
			expect(output).toContain("Second Job");
		});
	});

	it("shows cost data for jobs", async () => {
		const jobs = [makeJobConfig()];
		mockListJobs.mockResolvedValue(jobs);

		const { lastFrame } = render(<App />);

		await vi.waitFor(() => {
			const output = lastFrame()!;
			// Cost defaults to $0.00 since getCostSummary returns empty
			expect(output).toContain("$0.00");
		});
	});
});
