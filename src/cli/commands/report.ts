import { listJobs, readJob } from "../../core/job-manager.js";
import { listRunLogs } from "../../runner/logger.js";
import type { RunLogEntry } from "../../runner/types.js";
import { formatDuration } from "../format.js";
import type { ParsedCommand } from "../types.js";

interface AggregateReport {
	title: string;
	repoPath?: string;
	totalRuns: number;
	successCount: number;
	noChangesCount: number;
	errorCount: number;
	gitErrorCount: number;
	lockedCount: number;
	totalCost: number;
	avgDurationMs: number;
	prsCreated: number;
	lastPrUrl: string | undefined;
	earliest: string | undefined;
	latest: string | undefined;
}

function aggregateLogs(logs: RunLogEntry[]): Omit<AggregateReport, "title" | "repoPath"> {
	let successCount = 0;
	let noChangesCount = 0;
	let errorCount = 0;
	let gitErrorCount = 0;
	let lockedCount = 0;
	let totalCost = 0;
	let totalDuration = 0;
	let prsCreated = 0;
	let lastPrUrl: string | undefined;
	let earliest: string | undefined;
	let latest: string | undefined;

	for (const log of logs) {
		switch (log.status) {
			case "success":
				successCount++;
				break;
			case "no-changes":
				noChangesCount++;
				break;
			case "error":
				errorCount++;
				break;
			case "git-error":
				gitErrorCount++;
				break;
			case "locked":
				lockedCount++;
				break;
		}

		totalCost += log.costUsd ?? 0;
		totalDuration += log.durationMs;

		if (log.prUrl) {
			prsCreated++;
			if (!lastPrUrl) {
				lastPrUrl = log.prUrl; // logs are sorted newest-first
			}
		}

		if (!earliest || log.startedAt < earliest) {
			earliest = log.startedAt;
		}
		if (!latest || log.startedAt > latest) {
			latest = log.startedAt;
		}
	}

	return {
		totalRuns: logs.length,
		successCount,
		noChangesCount,
		errorCount,
		gitErrorCount,
		lockedCount,
		totalCost,
		avgDurationMs: logs.length > 0 ? Math.round(totalDuration / logs.length) : 0,
		prsCreated,
		lastPrUrl,
		earliest,
		latest,
	};
}

function formatReport(report: AggregateReport): string {
	const lines: string[] = [];
	lines.push(`Run Report: ${report.title}`);

	if (report.repoPath) {
		lines.push(`Repository: ${report.repoPath}`);
	}

	if (report.earliest && report.latest) {
		const fmtDate = (iso: string) =>
			new Date(iso).toLocaleDateString("en-US", {
				year: "numeric",
				month: "short",
				day: "numeric",
			});
		lines.push(`Period: ${fmtDate(report.earliest)} to ${fmtDate(report.latest)}`);
	}

	lines.push("");
	lines.push(`Runs: ${report.totalRuns}`);

	const pct = (n: number) => (report.totalRuns > 0 ? Math.round((n / report.totalRuns) * 100) : 0);
	lines.push(`  Success:    ${report.successCount} (${pct(report.successCount)}%)`);
	lines.push(`  No changes: ${report.noChangesCount} (${pct(report.noChangesCount)}%)`);
	lines.push(
		`  Errors:     ${report.errorCount + report.gitErrorCount} (${pct(report.errorCount + report.gitErrorCount)}%)`,
	);
	lines.push(`  Locked:     ${report.lockedCount} (${pct(report.lockedCount)}%)`);

	lines.push("");
	lines.push(`PRs created: ${report.prsCreated}`);
	lines.push(`Total cost:  $${report.totalCost.toFixed(2)}`);
	lines.push(`Avg duration: ${formatDuration(report.avgDurationMs)}`);
	lines.push(`Last PR: ${report.lastPrUrl || "none"}`);

	return lines.join("\n");
}

/**
 * Show aggregate run summary for a single job or across all jobs.
 * Satisfies REPT-02 (aggregate run summary reports).
 */
export async function reportCommand(args: ParsedCommand["args"]): Promise<void> {
	const jobId = args.jobId as string | undefined;

	if (jobId) {
		// Single job report
		const job = await readJob(jobId);
		const logs = await listRunLogs(jobId);

		if (logs.length === 0) {
			console.log(`No runs found for job ${jobId}.`);
			return;
		}

		const agg = aggregateLogs(logs);
		const report: AggregateReport = {
			...agg,
			title: `${job.name} (${job.id})`,
			repoPath: job.repo.path,
		};

		console.log(formatReport(report));
	} else {
		// All-jobs report
		const jobs = await listJobs();

		if (jobs.length === 0) {
			console.log("No jobs configured.");
			return;
		}

		const allLogs: RunLogEntry[] = [];
		for (const job of jobs) {
			const logs = await listRunLogs(job.id);
			allLogs.push(...logs);
		}

		if (allLogs.length === 0) {
			console.log("No runs found across any jobs.");
			return;
		}

		const agg = aggregateLogs(allLogs);
		const report: AggregateReport = {
			...agg,
			title: `All Jobs (${jobs.length} jobs)`,
		};

		console.log(formatReport(report));
	}
}
