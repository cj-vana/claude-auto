// Phase 1: Config foundation
export {
	loadJobConfig,
	readConfigDocument,
	saveJobConfig,
	updateConfigField,
	validateConfig,
	writeConfigDocument,
} from "./core/config.js";
export { createJob, deleteJob, listJobs, readJob, updateJob } from "./core/job-manager.js";
// Phase 2: Scheduling
export {
	describeSchedule,
	getNextRuns,
	validateAndDescribeSchedule,
	validateCronExpression,
} from "./core/schedule.js";
export type { ScheduleInfo } from "./core/types.js";
export { type JobConfig, JobConfigSchema } from "./core/types.js";
export { CrontabScheduler } from "./platform/crontab.js";
export { detectPlatform, type Platform } from "./platform/detect.js";
export type { CalendarInterval } from "./platform/launchd.js";
export { cronToCalendarIntervals, LaunchdScheduler } from "./platform/launchd.js";
export {
	createScheduler,
	type RegisteredJob,
	type Scheduler,
} from "./platform/scheduler.js";
export {
	ConfigParseError,
	ConfigValidationError,
	CronValidationError,
	SchedulerError,
} from "./util/errors.js";
export { execCommand } from "./util/exec.js";
export { writeFileSafe } from "./util/fs.js";
export { paths } from "./util/paths.js";
