import { CronExpressionParser } from "cron-parser";
import cronstrue from "cronstrue";
import { CronValidationError } from "../util/errors.js";
import type { ScheduleInfo } from "./types.js";

/**
 * Validate a cron expression. Throws CronValidationError if invalid.
 * Only accepts standard 5-field cron expressions.
 */
export function validateCronExpression(cronExpr: string): void {
	const fields = cronExpr.trim().split(/\s+/);
	if (fields.length !== 5) {
		throw new CronValidationError(
			cronExpr,
			`Expected 5 fields (minute hour day month weekday), got ${fields.length}`,
		);
	}
	try {
		CronExpressionParser.parse(cronExpr);
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		throw new CronValidationError(cronExpr, msg);
	}
}

/**
 * Get a human-readable description of a cron expression.
 * Example: "0 *​/6 * * *" -> "Every 6 hours"
 */
export function describeSchedule(cronExpr: string): string {
	return cronstrue.toString(cronExpr, {
		use24HourTimeFormat: false,
		verbose: true,
	});
}

/**
 * Compute the next N run times for a cron expression in the given IANA timezone.
 */
export function getNextRuns(cronExpr: string, timezone: string, count = 3): Date[] {
	const interval = CronExpressionParser.parse(cronExpr, { tz: timezone });
	return interval.take(count).map((d) => d.toDate());
}

/**
 * Validate a cron expression and return complete schedule info
 * including human-readable description and next run times.
 */
export function validateAndDescribeSchedule(cronExpr: string, timezone: string): ScheduleInfo {
	validateCronExpression(cronExpr);
	const humanReadable = describeSchedule(cronExpr);
	const nextRuns = getNextRuns(cronExpr, timezone);
	return { cron: cronExpr, timezone, humanReadable, nextRuns };
}
