import { useState, useCallback } from "react";
import { useInput, useApp } from "ink";
import type { JobWithMeta } from "./use-jobs.js";

/**
 * Dashboard view states.
 */
export type View = "list" | "detail" | "logs";

/**
 * Keyboard navigation state for the TUI dashboard.
 */
export interface KeyboardState {
	view: View;
	selectedIdx: number;
	scrollOffset: number;
}

/**
 * Actions that require caller-side mutation (not pure state changes).
 */
export interface KeyboardActions {
	/** Returns the selected job ID for pause/resume, or null if no job selected */
	pauseResume: (jobs: JobWithMeta[]) => string | null;
	/** Returns the selected job ID, or null if no jobs */
	getSelectedJobId: (jobs: JobWithMeta[]) => string | null;
}

/**
 * Hook for keyboard navigation in the TUI dashboard.
 *
 * Handles arrow keys, Enter, Escape, p (pause/resume), l (logs), q (quit),
 * and j/k for scrolling in log view.
 *
 * @param jobCount - Total number of jobs (for bounds checking)
 * @returns Current navigation state and action helpers
 */
export function useKeyboard(jobCount: number): KeyboardState & { actions: KeyboardActions } {
	const { exit } = useApp();
	const [view, setView] = useState<View>("list");
	const [selectedIdx, setSelectedIdx] = useState(0);
	const [scrollOffset, setScrollOffset] = useState(0);
	const [pendingPauseResume, setPendingPauseResume] = useState(false);

	useInput((input, key) => {
		if (input === "q") {
			exit();
			return;
		}

		if (key.upArrow) {
			if (view === "logs") {
				setScrollOffset((o) => Math.max(0, o - 1));
			} else {
				setSelectedIdx((i) => Math.max(0, i - 1));
			}
			return;
		}

		if (key.downArrow) {
			if (view === "logs") {
				setScrollOffset((o) => o + 1);
			} else {
				setSelectedIdx((i) => Math.min(Math.max(0, jobCount - 1), i + 1));
			}
			return;
		}

		if (key.return && view === "list") {
			setView("detail");
			return;
		}

		if (key.escape && view !== "list") {
			setView("list");
			setScrollOffset(0);
			return;
		}

		if (input === "p" && view !== "logs") {
			setPendingPauseResume(true);
			return;
		}

		if (input === "l" && view !== "logs") {
			setView("logs");
			setScrollOffset(0);
			return;
		}

		// j/k scrolling in log view
		if (view === "logs") {
			if (input === "j") {
				setScrollOffset((o) => o + 1);
			} else if (input === "k") {
				setScrollOffset((o) => Math.max(0, o - 1));
			}
		}
	});

	const getSelectedJobId = useCallback(
		(jobs: JobWithMeta[]): string | null => {
			if (jobs.length === 0 || selectedIdx >= jobs.length) return null;
			return jobs[selectedIdx].id;
		},
		[selectedIdx],
	);

	const pauseResume = useCallback(
		(jobs: JobWithMeta[]): string | null => {
			if (!pendingPauseResume) return null;
			setPendingPauseResume(false);
			return getSelectedJobId(jobs);
		},
		[pendingPauseResume, getSelectedJobId],
	);

	return {
		view,
		selectedIdx,
		scrollOffset,
		actions: {
			pauseResume,
			getSelectedJobId,
		},
	};
}
