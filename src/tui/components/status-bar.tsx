import { Box, Text } from "ink";
import type { View } from "../hooks/use-keyboard.js";

interface StatusBarProps {
	view: View;
}

const HINTS: Record<View, string> = {
	list: "up/down navigate | Enter detail | p pause/resume | l logs | q quit",
	detail: "Esc back | p pause/resume | l logs | q quit",
	logs: "Esc back | j/k scroll | q quit",
};

/**
 * Bottom status bar with keybinding hints based on current view.
 */
export function StatusBar({ view }: StatusBarProps) {
	return (
		<Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingX={1} marginTop={1}>
			<Text dimColor>{HINTS[view]}</Text>
		</Box>
	);
}
