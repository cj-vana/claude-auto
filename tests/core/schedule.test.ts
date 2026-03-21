import { describe, expect, it } from "vitest";
import {
	describeSchedule,
	getNextRuns,
	validateAndDescribeSchedule,
	validateCronExpression,
} from "../../src/core/schedule.js";
import { CronValidationError } from "../../src/util/errors.js";

describe("validateCronExpression", () => {
	it("accepts a valid 5-field cron expression without throwing", () => {
		expect(() => validateCronExpression("0 */6 * * *")).not.toThrow();
	});

	it('throws CronValidationError for "invalid" expression', () => {
		expect(() => validateCronExpression("invalid")).toThrow(CronValidationError);
		try {
			validateCronExpression("invalid");
		} catch (error) {
			expect(error).toBeInstanceOf(CronValidationError);
			expect((error as CronValidationError).expression).toBe("invalid");
		}
	});

	it("throws CronValidationError for 6-field (seconds) cron expression", () => {
		expect(() => validateCronExpression("* * * * * *")).toThrow(CronValidationError);
		try {
			validateCronExpression("* * * * * *");
		} catch (error) {
			expect(error).toBeInstanceOf(CronValidationError);
			const cronError = error as CronValidationError;
			expect(cronError.expression).toBe("* * * * * *");
			expect(cronError.message).toMatch(/6/);
		}
	});
});

describe("describeSchedule", () => {
	it('returns a human-readable string containing "6" and "hour" for "0 */6 * * *"', () => {
		const description = describeSchedule("0 */6 * * *");
		expect(description.toLowerCase()).toContain("6");
		expect(description.toLowerCase()).toContain("hour");
	});

	it('returns a string containing "9" and "30" for "30 9 * * 1-5"', () => {
		const description = describeSchedule("30 9 * * 1-5");
		expect(description).toContain("9");
		expect(description).toContain("30");
	});
});

describe("getNextRuns", () => {
	it("returns the requested number of Date objects", () => {
		const runs = getNextRuns("0 9 * * *", "America/Chicago", 3);
		expect(runs).toHaveLength(3);
		for (const run of runs) {
			expect(run).toBeInstanceOf(Date);
		}
	});

	it("computes next runs in the configured timezone (9 AM Chicago = UTC-5 or UTC-6)", () => {
		const runs = getNextRuns("0 9 * * *", "America/Chicago", 3);
		for (const run of runs) {
			const utcHour = run.getUTCHours();
			// 9 AM Chicago is 14 UTC (CST, UTC-6) or 15 UTC (CDT, UTC-5)
			expect([14, 15]).toContain(utcHour);
		}
	});

	it("returns dates in ascending order", () => {
		const runs = getNextRuns("0 9 * * *", "America/Chicago", 3);
		for (let i = 1; i < runs.length; i++) {
			expect(runs[i].getTime()).toBeGreaterThan(runs[i - 1].getTime());
		}
	});
});

describe("validateAndDescribeSchedule", () => {
	it("returns a ScheduleInfo with all fields populated for a valid expression", () => {
		const info = validateAndDescribeSchedule("0 */6 * * *", "UTC");
		expect(info).toBeDefined();
		expect(info.cron).toBeDefined();
		expect(info.timezone).toBeDefined();
		expect(info.humanReadable).toBeDefined();
		expect(info.nextRuns).toBeDefined();
	});

	it('returns cron field matching the input expression "0 */6 * * *"', () => {
		const info = validateAndDescribeSchedule("0 */6 * * *", "UTC");
		expect(info.cron).toBe("0 */6 * * *");
	});

	it('returns timezone field matching "UTC"', () => {
		const info = validateAndDescribeSchedule("0 */6 * * *", "UTC");
		expect(info.timezone).toBe("UTC");
	});

	it("returns a non-empty humanReadable string", () => {
		const info = validateAndDescribeSchedule("0 */6 * * *", "UTC");
		expect(info.humanReadable).toBeTruthy();
		expect(info.humanReadable.length).toBeGreaterThan(0);
	});

	it("returns nextRuns array with length 3", () => {
		const info = validateAndDescribeSchedule("0 */6 * * *", "UTC");
		expect(info.nextRuns).toHaveLength(3);
	});

	it("throws CronValidationError for an invalid expression", () => {
		expect(() => validateAndDescribeSchedule("not-valid", "UTC")).toThrow(CronValidationError);
	});
});
