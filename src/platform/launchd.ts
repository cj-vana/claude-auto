import type { JobConfig } from "../core/types.js";
import type { RegisteredJob, Scheduler } from "./scheduler.js";

// Stub - will be fully implemented in Task 2
export interface CalendarInterval {
	Month?: number;
	Day?: number;
	Weekday?: number;
	Hour?: number;
	Minute?: number;
}

export function cronToCalendarIntervals(_cronExpr: string): {
	calendarIntervals?: CalendarInterval[];
	startInterval?: number;
} {
	throw new Error("Not implemented - Task 2");
}

export class LaunchdScheduler implements Scheduler {
	async register(_job: JobConfig, _env?: Record<string, string>): Promise<void> {
		throw new Error("Not implemented - Task 2");
	}

	async unregister(_jobId: string): Promise<void> {
		throw new Error("Not implemented - Task 2");
	}

	async isRegistered(_jobId: string): Promise<boolean> {
		throw new Error("Not implemented - Task 2");
	}

	async list(): Promise<RegisteredJob[]> {
		throw new Error("Not implemented - Task 2");
	}
}
