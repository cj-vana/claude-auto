import {
	getCostSummary,
	type CostSummaryRow,
	type DailyCostRow,
} from "../../runner/cost-tracker.js";
import { closeDatabase } from "../../core/database.js";
import { formatTable } from "../format.js";

/**
 * CLI command handler for `claude-auto cost`.
 *
 * Without a jobId: displays per-job cost summary table.
 * With a jobId: displays per-day cost breakdown for that job.
 * With --json flag: outputs JSON array instead of formatted table.
 *
 * @param args - Parsed CLI arguments (jobId?: string, json?: boolean)
 */
export async function costCommand(
	args: Record<string, string | number | boolean | undefined>,
): Promise<void> {
	const jobId = args.jobId as string | undefined;
	const jsonOutput = args.json === true;

	try {
		if (jobId) {
			const rows = getCostSummary(jobId) as DailyCostRow[];

			if (rows.length === 0) {
				console.log(`No cost data found for job: ${jobId}`);
				return;
			}

			if (jsonOutput) {
				console.log(JSON.stringify(rows, null, 2));
				return;
			}

			const tableRows = rows.map((r) => [
				r.day,
				String(r.runs),
				`$${r.total_cost.toFixed(4)}`,
				String(r.total_turns),
			]);

			console.log(`\nCost breakdown for job: ${jobId}\n`);
			console.log(formatTable(["Date", "Runs", "Cost (USD)", "Turns"], tableRows));

			const totalCost = rows.reduce((sum, r) => sum + r.total_cost, 0);
			console.log(`\nTotal: $${totalCost.toFixed(4)}`);
		} else {
			const rows = getCostSummary() as CostSummaryRow[];

			if (rows.length === 0) {
				console.log("No cost data found.");
				return;
			}

			if (jsonOutput) {
				console.log(JSON.stringify(rows, null, 2));
				return;
			}

			const tableRows = rows.map((r) => [
				r.job_id,
				String(r.runs),
				`$${r.total_cost.toFixed(4)}`,
				`$${r.avg_cost.toFixed(4)}`,
				String(r.total_turns),
			]);

			console.log("\nCost Summary\n");
			console.log(
				formatTable(
					["Job ID", "Runs", "Total Cost (USD)", "Avg Cost", "Turns"],
					tableRows,
				),
			);

			const grandTotal = rows.reduce((sum, r) => sum + r.total_cost, 0);
			console.log(`\nGrand Total: $${grandTotal.toFixed(4)}`);
		}
	} finally {
		closeDatabase();
	}
}
