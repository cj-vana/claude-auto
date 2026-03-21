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
	GitOpsError,
	LockError,
	SchedulerError,
	SpawnError,
} from "./util/errors.js";
export { execCommand } from "./util/exec.js";
export { writeFileSafe } from "./util/fs.js";
export { paths } from "./util/paths.js";
// Phase 3: Runner
export { executeRun } from "./runner/orchestrator.js";
export { spawnClaude, buildAllowedTools } from "./runner/spawner.js";
export { buildWorkPrompt, buildSystemPrompt } from "./runner/prompt-builder.js";
export {
	pullLatest,
	createBranch,
	hasChanges,
	pushBranch,
	createPR,
} from "./runner/git-ops.js";
export { acquireLock, STALE_THRESHOLD } from "./runner/lock.js";
export { writeRunLog, readRunLog, listRunLogs } from "./runner/logger.js";
export type {
	SpawnOptions,
	SpawnResult,
	RunResult,
	RunStatus,
	RunLogEntry,
} from "./runner/types.js";
// Phase 4: Notifications
export { sendNotifications } from "./notifications/dispatcher.js";
export { formatDiscord, formatSlack, formatTelegram } from "./notifications/formatters.js";
export { extractIssueNumber, postIssueComment } from "./notifications/issue-comment.js";
export type { NotificationEvent, NotificationPayload, EventTriggers } from "./notifications/types.js";
export { shouldNotify, buildPayload } from "./notifications/types.js";
