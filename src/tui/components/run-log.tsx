import { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { Spinner } from "@inkjs/ui";
import { listRunLogs } from "../../runner/logger.js";
import type { RunLogEntry } from "../../runner/types.js";

interface RunLogProps {
	jobId: string;
	scrollOffset?: number;
}

function formatDuration(ms: number): string {
	const sec = Math.floor(ms / 1000);
	if (sec < 60) return `${sec}s`;
	const min = Math.floor(sec / 60);
	if (min < 60) return `${min}m ${sec % 60}s`;
	const hr = Math.floor(min / 60);
	return `${hr}h ${min % 60}m`;
}

function statusColor(status: string): string {
	switch (status) {
		case "success":
			return "green";
		case "no-changes":
			return "yellow";
		case "error":
		case "git-error":
			return "red";
		case "locked":
		case "paused":
			return "gray";
		case "budget-exceeded":
			return "magenta";
		case "merge-conflict":
			return "red";
		case "needs-human-review":
			return "cyan";
		default:
			return "white";
	}
}

const VISIBLE_ENTRIES = 10;

/**
 * Scrollable run log history for a single job.
 * Displays date, status, duration, cost, and summary for each run.
 */
export function RunLog({ jobId, scrollOffset = 0 }: RunLogProps) {
	const [logs, setLogs] = useState<RunLogEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		const load = async () => {
			try {
				const entries = await listRunLogs(jobId);
				if (!cancelled) {
					setLogs(entries);
					setLoading(false);
				}
			} catch (err: unknown) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : String(err));
					setLoading(false);
				}
			}
		};

		load();
		return () => {
			cancelled = true;
		};
	}, [jobId]);

	if (loading) {
		return (
			<Box padding={1}>
				<Spinner label="Loading run logs..." />
			</Box>
		);
	}

	if (error) {
		return (
			<Box padding={1}>
				<Text color="red">Error loading logs: {error}</Text>
			</Box>
		);
	}

	if (logs.length === 0) {
		return (
			<Box padding={1}>
				<Text dimColor>No run history for this job.</Text>
			</Box>
		);
	}

	const clampedOffset = Math.min(scrollOffset, Math.max(0, logs.length - VISIBLE_ENTRIES));
	const visibleLogs = logs.slice(clampedOffset, clampedOffset + VISIBLE_ENTRIES);

	return (
		<Box flexDirection="column" paddingTop={1} paddingLeft={1}>
			<Text bold>Run History ({logs.length} runs, showing {clampedOffset + 1}-{clampedOffset + visibleLogs.length})</Text>
			<Text> </Text>

			{visibleLogs.map((log) => (
				<Box key={log.runId} flexDirection="column" marginBottom={1}>
					<Box>
						<Text dimColor>{new Date(log.startedAt).toLocaleString()}</Text>
						<Text> </Text>
						<Text color={statusColor(log.status)} bold>{log.status}</Text>
						<Text> </Text>
						<Text dimColor>{formatDuration(log.durationMs)}</Text>
						{log.costUsd !== undefined && (
							<>
								<Text> </Text>
								<Text dimColor>${log.costUsd.toFixed(4)}</Text>
							</>
						)}
					</Box>
					{log.summary && (
						<Box paddingLeft={2}>
							<Text dimColor>{log.summary}</Text>
						</Box>
					)}
					{log.error && (
						<Box paddingLeft={2}>
							<Text color="red">{log.error}</Text>
						</Box>
					)}
					{log.prUrl && (
						<Box paddingLeft={2}>
							<Text dimColor>PR: {log.prUrl}</Text>
						</Box>
					)}
				</Box>
			))}

			{logs.length > VISIBLE_ENTRIES && (
				<Text dimColor>Use j/k or up/down to scroll</Text>
			)}
		</Box>
	);
}
