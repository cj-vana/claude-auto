/**
 * Convert milliseconds to human-readable duration.
 * Omits zero-value leading parts. For hours+, shows "Xh Ym" (omits seconds).
 * For minutes+, shows "Xm Ys". For <1m, shows "Xs".
 */
export function formatDuration(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	}
	if (minutes > 0) {
		return `${minutes}m ${seconds}s`;
	}
	return `${seconds}s`;
}

/**
 * Format a date as a relative time string: "just now", "5 minutes ago", "2 hours ago", etc.
 * Pure math, no library dependencies.
 */
export function formatRelativeTime(date: Date): string {
	const now = Date.now();
	const diffMs = now - date.getTime();
	const diffSeconds = Math.floor(diffMs / 1000);
	const diffMinutes = Math.floor(diffSeconds / 60);
	const diffHours = Math.floor(diffMinutes / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffSeconds < 60) {
		return "just now";
	}
	if (diffMinutes < 60) {
		return diffMinutes === 1 ? "1 minute ago" : `${diffMinutes} minutes ago`;
	}
	if (diffHours < 24) {
		return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
	}
	return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
}

/**
 * Format data as an aligned text table.
 * Returns an empty string when there are no rows.
 */
export function formatTable(headers: string[], rows: string[][]): string {
	if (rows.length === 0) {
		return "";
	}

	// Compute column widths
	const colWidths = headers.map((h, i) => {
		const maxDataWidth = rows.reduce((max, row) => Math.max(max, (row[i] || "").length), 0);
		return Math.max(h.length, maxDataWidth);
	});

	const pad = (str: string, width: number) => str.padEnd(width);
	const sep = "  ";

	const headerLine = headers.map((h, i) => pad(h, colWidths[i])).join(sep);
	const separatorLine = colWidths.map((w) => "-".repeat(w)).join(sep);
	const dataLines = rows.map((row) => row.map((cell, i) => pad(cell || "", colWidths[i])).join(sep));

	return [headerLine, separatorLine, ...dataLines].join("\n");
}

/**
 * Returns a text badge for a status string: "active" -> "[active]".
 */
export function statusBadge(status: string): string {
	return `[${status}]`;
}
