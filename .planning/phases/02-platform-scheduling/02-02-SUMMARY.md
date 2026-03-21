---
phase: 02-platform-scheduling
plan: 02
subsystem: scheduling
tags: [crontab, launchd, plist, platform-detection, scheduler-interface, calendar-interval]

# Dependency graph
requires:
  - phase: 02-platform-scheduling
    plan: 01
    provides: "schedule.ts (cron validation), exec.ts (child_process wrapper), errors.ts (SchedulerError, CronValidationError), paths.ts (plistPath, jobLogs, crontabLock)"
  - phase: 01-config-foundation
    provides: "types.ts (JobConfig), paths.ts (base paths)"
provides:
  - "CrontabScheduler: Linux crontab registration with comment markers and CRON_TZ injection"
  - "LaunchdScheduler: macOS launchd plist generation with modern bootstrap/bootout"
  - "cronToCalendarIntervals: cron-to-launchd StartCalendarInterval/StartInterval conversion"
  - "detectPlatform: returns linux/darwin, throws for unsupported"
  - "createScheduler factory: returns platform-appropriate Scheduler implementation"
  - "Updated barrel export (src/index.ts) with all Phase 2 public API"
affects: [03-runner-execution, 04-skill-cli]

# Tech tracking
tech-stack:
  added: []
  patterns: [comment-tagged-crontab-entries, plist-per-job-launchd, cron-to-calendar-interval-conversion, platform-adapter-factory]

key-files:
  created:
    - src/platform/detect.ts
    - src/platform/scheduler.ts
    - src/platform/crontab.ts
    - src/platform/launchd.ts
    - tests/platform/scheduler.test.ts
    - tests/platform/crontab.test.ts
    - tests/platform/launchd.test.ts
  modified:
    - src/index.ts

key-decisions:
  - "Used cron-parser v5 fields.minute.values (not spread on field directly) for CalendarInterval conversion"
  - "Used plist.build() with type cast for TypeScript compatibility with PlistValue type"
  - "Map Number() on cron-parser field values to ensure numeric types for launchd CalendarInterval"
  - "Every-N-minutes patterns (*/5, */1) use StartInterval instead of StartCalendarInterval to avoid interval explosion"
  - "Reject cron expressions producing >50 CalendarInterval entries with descriptive error"
  - "CrontabScheduler uses CRON_TZ variable injection for non-UTC timezones"

patterns-established:
  - "Platform adapter pattern: Scheduler interface + CrontabScheduler/LaunchdScheduler + createScheduler factory"
  - "Comment-tagged crontab: # claude-auto:{jobId} marker for programmatic CRUD"
  - "Plist-per-job: ~/Library/LaunchAgents/com.claude-auto.{jobId}.plist"
  - "Modern launchctl: bootstrap gui/{uid} for register, bootout gui/{uid}/{label} for unregister"
  - "Barrel export grouping: Phase 1 (config) and Phase 2 (scheduling) sections in src/index.ts"

requirements-completed: [SCHED-01, SCHED-02, SCHED-03]

# Metrics
duration: 7min
completed: 2026-03-21
---

# Phase 2 Plan 2: Platform Scheduler Adapters Summary

**CrontabScheduler and LaunchdScheduler with platform detection factory, plist generation, cron-to-CalendarInterval conversion, and complete Phase 2 barrel export**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-21T18:01:55Z
- **Completed:** 2026-03-21T18:09:07Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- CrontabScheduler with comment-tagged entries, CRON_TZ timezone injection, and register/unregister/isRegistered/list operations
- LaunchdScheduler generating valid plist XML with ProgramArguments, EnvironmentVariables, and StartCalendarInterval/StartInterval
- cronToCalendarIntervals converting cron expressions to launchd-compatible scheduling config with StartInterval optimization for high-frequency patterns
- Platform detection and factory returning correct implementation (CrontabScheduler on Linux, LaunchdScheduler on macOS)
- Updated barrel export including all Phase 2 public API (schedule functions, platform types, error classes, exec utility)
- 30 new tests passing alongside all 47 Phase 1 tests (77 total)

## Task Commits

Each task was committed atomically:

1. **Task 1: Platform detection, Scheduler interface, and CrontabScheduler** - `74f19f0` (feat)
2. **Task 2: LaunchdScheduler with plist generation, cron-to-CalendarInterval, and barrel export** - `9da2666` (feat)

_Note: Both tasks used TDD flow (RED: failing tests, GREEN: implementation, REFACTOR: biome formatting)_

## Files Created/Modified
- `src/platform/detect.ts` - Platform detection utility returning "linux" or "darwin"
- `src/platform/scheduler.ts` - Scheduler interface, RegisteredJob type, and createScheduler factory
- `src/platform/crontab.ts` - CrontabScheduler implementation with comment markers and CRON_TZ injection
- `src/platform/launchd.ts` - LaunchdScheduler with plist generation, cronToCalendarIntervals conversion
- `src/index.ts` - Updated barrel export with all Phase 2 modules
- `tests/platform/scheduler.test.ts` - Tests for detectPlatform and createScheduler factory
- `tests/platform/crontab.test.ts` - Tests for CrontabScheduler with mocked execCommand
- `tests/platform/launchd.test.ts` - Tests for LaunchdScheduler with mocked fs and execCommand, and cronToCalendarIntervals

## Decisions Made
- Used cron-parser v5 `fields.minute.values` property (not spread on field object) -- v5 returns CronMinute/CronHour objects, not iterable arrays
- Applied `.map(Number)` on all cron-parser field values to ensure numeric types for TypeScript compatibility with CalendarInterval
- Used type cast `as unknown as plist.PlistValue` for plist.build() since Record<string, unknown> doesn't satisfy the strict PlistValue type
- Every-N-minutes cron patterns (*/5, */1, etc.) use StartInterval (seconds) instead of StartCalendarInterval to avoid interval explosion
- Rejecting cron expressions producing >50 CalendarInterval entries to prevent excessively large plist files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed cron-parser v5 field access API**
- **Found during:** Task 2 (LaunchdScheduler implementation)
- **Issue:** Plan specified `[...fields.minute]` spread syntax but cron-parser v5 returns CronMinute objects, not iterable arrays. The `.values` property provides the actual number array.
- **Fix:** Changed to `[...fields.minute.values].map(Number)` for all field accesses
- **Files modified:** src/platform/launchd.ts
- **Verification:** All cronToCalendarIntervals tests pass
- **Committed in:** 9da2666 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed TypeScript type errors with cron-parser and plist**
- **Found during:** Task 2 (TypeScript type check)
- **Issue:** cron-parser DayOfWeekRange/DayOfMonthRange types include string unions; plist.build() expects PlistValue not Record<string, unknown>
- **Fix:** Added `.map(Number)` for numeric coercion and `as unknown as plist.PlistValue` cast
- **Files modified:** src/platform/launchd.ts
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** 9da2666 (Task 2 commit)

**3. [Rule 1 - Bug] Fixed test for >50 interval rejection**
- **Found during:** Task 2 (RED phase)
- **Issue:** Original test expression "0,15,30,45 * * * 1-5" only produces 20 intervals (wildcard hours collapse to [undefined]), not 480. Also error message regex /50/ didn't match actual output.
- **Fix:** Changed to "0,15,30,45 9-17 * * 1-5" (180 intervals) and matched actual error text /180 calendar intervals/
- **Files modified:** tests/platform/launchd.test.ts
- **Verification:** Test correctly throws and matches
- **Committed in:** 9da2666 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All fixes necessary for correctness. No scope creep. The cron-parser v5 field API detail was a plan inaccuracy corrected during TDD.

## Issues Encountered
- vitest module caching caused `vi.stubGlobal("process")` to leak between describe blocks -- fixed by using `vi.unstubAllGlobals()` and `vi.resetModules()` in afterEach hooks

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Platform scheduler layer complete: jobs can be programmatically registered/unregistered with OS scheduler
- CrontabScheduler ready for Linux (crontab -l / crontab -)
- LaunchdScheduler ready for macOS (plist generation + launchctl bootstrap/bootout)
- createScheduler factory auto-selects correct implementation based on platform
- All Phase 2 modules exported via barrel for Phase 3 (runner execution) to consume
- 77 total tests passing, TypeScript clean, biome clean, tsup build succeeds

## Self-Check: PASSED

- All 8 created/modified files verified on disk
- All 2 task commits verified in git log (74f19f0, 9da2666)
- No stubs or placeholder content found
