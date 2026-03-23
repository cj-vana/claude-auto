import { Box, Text } from "ink";
import { Spinner } from "@inkjs/ui";
import type { JobWithMeta } from "../hooks/use-jobs.js";
import cronstrue from "cronstrue";

interface JobListProps {
	jobs: JobWithMeta[];
	selectedIdx: number;
	loading: boolean;
}

function formatRelativeTime(date: Date): string {
	const now = Date.now();
	const diffMs = date.getTime() - now;
	if (diffMs < 0) return "overdue";

	const diffMin = Math.floor(diffMs / 60000);
	if (diffMin < 60) return `in ${diffMin}m`;

	const diffHr = Math.floor(diffMin / 60);
	if (diffHr < 24) return `in ${diffHr}h`;

	const diffDay = Math.floor(diffHr / 24);
	return `in ${diffDay}d`;
}

function formatCost(cost: number): string {
	return `$${cost.toFixed(2)}`;
}

function truncate(str: string, max: number): string {
	if (str.length <= max) return str;
	return str.slice(0, max - 1) + "\u2026";
}

function describeScheduleSafe(cron: string): string {
	try {
		return cronstrue.toString(cron, { use24HourTimeFormat: false });
	} catch {
		return cron;
	}
}

/**
 * Job list table with columns: Name, Status, Schedule, Next Run, Cost.
 * Highlights the selected row with inverse/bold styling.
 */
export function JobList({ jobs, selectedIdx, loading }: JobListProps) {
	if (loading && jobs.length === 0) {
		return (
			<Box padding={1}>
				<Spinner label="Loading jobs..." />
			</Box>
		);
	}

	if (jobs.length === 0) {
		return (
			<Box padding={1}>
				<Text dimColor>No jobs configured. Run &apos;claude-auto create&apos; to get started.</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" paddingTop={1}>
			{/* Header */}
			<Box>
				<Box width={22}><Text bold underline>Name</Text></Box>
				<Box width={10}><Text bold underline>Status</Text></Box>
				<Box width={27}><Text bold underline>Schedule</Text></Box>
				<Box width={14}><Text bold underline>Next Run</Text></Box>
				<Box width={10}><Text bold underline>Cost</Text></Box>
			</Box>

			{/* Rows */}
			{jobs.map((job, idx) => {
				const isSelected = idx === selectedIdx;
				const statusText = job.enabled ? "active" : "paused";
				const statusColor = job.enabled ? "green" : "yellow";
				const schedule = truncate(describeScheduleSafe(job.cron), 25);
				const nextRun = job.nextRun ? formatRelativeTime(job.nextRun) : "paused";
				const cost = formatCost(job.totalCost);

				return (
					<Box key={job.id}>
						<Box width={22}>
							<Text inverse={isSelected} bold={isSelected}>
								{truncate(job.name, 20)}
							</Text>
						</Box>
						<Box width={10}>
							<Text inverse={isSelected} color={statusColor}>
								{statusText}
							</Text>
						</Box>
						<Box width={27}>
							<Text inverse={isSelected} dimColor={!isSelected}>
								{schedule}
							</Text>
						</Box>
						<Box width={14}>
							<Text inverse={isSelected} dimColor={!isSelected}>
								{nextRun}
							</Text>
						</Box>
						<Box width={10}>
							<Text inverse={isSelected} dimColor={!isSelected}>
								{cost}
							</Text>
						</Box>
					</Box>
				);
			})}
		</Box>
	);
}
