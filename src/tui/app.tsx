import { useState, useCallback } from "react";
import { Box, Text } from "ink";
import { JobList } from "./components/job-list.js";
import { JobDetail } from "./components/job-detail.js";
import { RunLog } from "./components/run-log.js";
import { StatusBar } from "./components/status-bar.js";
import { useJobs } from "./hooks/use-jobs.js";
import { useKeyboard } from "./hooks/use-keyboard.js";

/**
 * Root App component for the TUI dashboard.
 * Routes between list, detail, and log views.
 * Handles pause/resume via dynamic import of CLI commands.
 */
export function App() {
	const { jobs, loading, error, refresh } = useJobs();
	const { view, selectedIdx, scrollOffset, actions } = useKeyboard(jobs.length);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);

	// Handle pause/resume action from keyboard
	const jobIdToPauseResume = actions.pauseResume(jobs);
	if (jobIdToPauseResume) {
		handlePauseResume(jobIdToPauseResume);
	}

	async function handlePauseResume(jobId: string): Promise<void> {
		const job = jobs.find((j) => j.id === jobId);
		if (!job) return;

		try {
			if (job.enabled) {
				const { pauseCommand } = await import("../cli/commands/pause.js");
				await pauseCommand({ jobId });
				setStatusMessage(`Paused: ${job.name}`);
			} else {
				const { resumeCommand } = await import("../cli/commands/resume.js");
				await resumeCommand({ jobId });
				setStatusMessage(`Resumed: ${job.name}`);
			}
			refresh();
		} catch (err: unknown) {
			setStatusMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
		}

		// Clear status message after 3 seconds
		setTimeout(() => setStatusMessage(null), 3000);
	}

	const selectedJob = jobs.length > 0 && selectedIdx < jobs.length ? jobs[selectedIdx] : null;

	return (
		<Box flexDirection="column">
			{/* Header */}
			<Box paddingX={1}>
				<Text bold color="cyan">claude-auto dashboard</Text>
				{loading && jobs.length > 0 && <Text dimColor> (refreshing...)</Text>}
			</Box>

			{/* Error display */}
			{error && (
				<Box paddingX={1}>
					<Text color="red">Error: {error}</Text>
				</Box>
			)}

			{/* Status message */}
			{statusMessage && (
				<Box paddingX={1}>
					<Text color="yellow">{statusMessage}</Text>
				</Box>
			)}

			{/* Main content area */}
			{view === "list" && (
				<JobList jobs={jobs} selectedIdx={selectedIdx} loading={loading} />
			)}
			{view === "detail" && selectedJob && (
				<JobDetail job={selectedJob} />
			)}
			{view === "logs" && selectedJob && (
				<RunLog jobId={selectedJob.id} scrollOffset={scrollOffset} />
			)}

			{/* Footer */}
			<StatusBar view={view} />
		</Box>
	);
}
