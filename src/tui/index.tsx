import React from "react";
import { render } from "ink";
import { App } from "./app.js";

/**
 * Launch the interactive TUI dashboard.
 * Renders the App component via ink and blocks until the user quits.
 */
export async function launchDashboard(): Promise<void> {
	const { waitUntilExit } = render(<App />);
	await waitUntilExit();
}
