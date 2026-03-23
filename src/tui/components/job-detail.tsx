import { Box, Text } from "ink";
import type { JobWithMeta } from "../hooks/use-jobs.js";
import cronstrue from "cronstrue";

interface JobDetailProps {
	job: JobWithMeta;
}

function describeScheduleSafe(cron: string): string {
	try {
		return cronstrue.toString(cron, { use24HourTimeFormat: false });
	} catch {
		return cron;
	}
}

function formatDuration(ms: number): string {
	const sec = Math.floor(ms / 1000);
	if (sec < 60) return `${sec}s`;
	const min = Math.floor(sec / 60);
	if (min < 60) return `${min}m ${sec % 60}s`;
	const hr = Math.floor(min / 60);
	return `${hr}h ${min % 60}m`;
}

/**
 * Single job detail view showing config, recent run info, and cost.
 */
export function JobDetail({ job }: JobDetailProps) {
	return (
		<Box flexDirection="column" paddingTop={1} paddingLeft={1}>
			<Text bold color="cyan">{job.name}</Text>
			<Text> </Text>

			<Box>
				<Box width={16}><Text bold>Repository:</Text></Box>
				<Text dimColor>{job.repoPath}</Text>
			</Box>
			<Box>
				<Box width={16}><Text bold>Branch:</Text></Box>
				<Text dimColor>{job.branch}</Text>
			</Box>
			<Box>
				<Box width={16}><Text bold>Schedule:</Text></Box>
				<Text dimColor>{job.cron} ({describeScheduleSafe(job.cron)})</Text>
			</Box>
			<Box>
				<Box width={16}><Text bold>Timezone:</Text></Box>
				<Text dimColor>{job.timezone}</Text>
			</Box>
			<Box>
				<Box width={16}><Text bold>Focus:</Text></Box>
				<Text dimColor>{job.focus.join(", ")}</Text>
			</Box>
			{job.model && (
				<Box>
					<Box width={16}><Text bold>Model:</Text></Box>
					<Text dimColor>{job.model}</Text>
				</Box>
			)}
			<Box>
				<Box width={16}><Text bold>Status:</Text></Box>
				<Text color={job.enabled ? "green" : "yellow"}>
					{job.enabled ? "active" : "paused"}
				</Text>
			</Box>
			<Box>
				<Box width={16}><Text bold>Budget:</Text></Box>
				<Text dimColor>${job.maxBudgetUsd.toFixed(2)}/run</Text>
			</Box>
			<Box>
				<Box width={16}><Text bold>Total Cost:</Text></Box>
				<Text dimColor>${job.totalCost.toFixed(2)}</Text>
			</Box>

			<Text> </Text>
			<Text bold>Last Run:</Text>
			{job.lastRun ? (
				<Box flexDirection="column" paddingLeft={2}>
					<Box>
						<Box width={14}><Text bold>Date:</Text></Box>
						<Text dimColor>{new Date(job.lastRun.startedAt).toLocaleString()}</Text>
					</Box>
					<Box>
						<Box width={14}><Text bold>Status:</Text></Box>
						<Text color={job.lastRun.status === "success" ? "green" : "red"}>
							{job.lastRun.status}
						</Text>
					</Box>
					<Box>
						<Box width={14}><Text bold>Duration:</Text></Box>
						<Text dimColor>{formatDuration(job.lastRun.durationMs)}</Text>
					</Box>
					{job.lastRun.costUsd !== undefined && (
						<Box>
							<Box width={14}><Text bold>Cost:</Text></Box>
							<Text dimColor>${job.lastRun.costUsd.toFixed(4)}</Text>
						</Box>
					)}
					{job.lastRun.summary && (
						<Box>
							<Box width={14}><Text bold>Summary:</Text></Box>
							<Text dimColor>{job.lastRun.summary}</Text>
						</Box>
					)}
					{job.lastRun.prUrl && (
						<Box>
							<Box width={14}><Text bold>PR:</Text></Box>
							<Text dimColor>{job.lastRun.prUrl}</Text>
						</Box>
					)}
				</Box>
			) : (
				<Box paddingLeft={2}>
					<Text dimColor>No runs yet</Text>
				</Box>
			)}

			{job.nextRun && (
				<>
					<Text> </Text>
					<Box>
						<Box width={16}><Text bold>Next Run:</Text></Box>
						<Text dimColor>{job.nextRun.toLocaleString()}</Text>
					</Box>
				</>
			)}
		</Box>
	);
}
