---
phase: 05-job-management-cli
plan: 02
subsystem: cli
tags: [pause, resume, remove, edit, cli-commands, scheduler-sync, job-management]

# Dependency graph
requires:
  - phase: 05-job-management-cli
    plan: 01
    provides: "CLI router, types, format helpers, list/logs/report commands"
  - phase: 01-config-foundation
    provides: "JobConfig schema, job-manager CRUD (readJob, updateJob, deleteJob)"
  - phase: 02-scheduling
    provides: "validateCronExpression, describeSchedule, getNextRuns, createScheduler"
provides:
  - "pauseCommand: sets enabled=false, unregisters from scheduler"
  - "resumeCommand: sets enabled=true, registers with scheduler, shows next run"
  - "removeCommand: unregisters + deletes job directory, optional --keep-logs log archival"
  - "editCommand: updates config fields with cron validation and scheduler re-registration"
  - "Full CLI dispatch: all 7 commands wired into router (list, logs, report, pause, resume, remove, edit)"
  - "Extended CLI argument parser with --name, --schedule, --timezone, --branch, --max-turns, --max-budget, --focus, --keep-logs flags"
  - "Barrel export updated with all mutation command exports"
affects: [06-skill-packaging]

# Tech tracking
tech-stack:
  added: []
  patterns: ["config+scheduler sync pattern for mutation commands", "best-effort scheduler unregister with try/catch", "idempotent pause/resume (no error on double-action)"]

key-files:
  created:
    - src/cli/commands/pause.ts
    - src/cli/commands/resume.ts
    - src/cli/commands/remove.ts
    - src/cli/commands/edit.ts
    - tests/cli/pause.test.ts
    - tests/cli/resume.test.ts
    - tests/cli/remove.test.ts
    - tests/cli/edit.test.ts
  modified:
    - src/cli/router.ts
    - src/index.ts

key-decisions:
  - "Best-effort scheduler unregister: wrap in try/catch since scheduler entry may already be missing"
  - "Idempotent pause/resume: no error on double-pause or double-resume, just informational message"
  - "Edit command re-registers scheduler only when schedule or timezone changes AND job is enabled"
  - "Added explicit JobConfig type annotations to satisfy biome noImplicitAnyLet rule"
  - "Preserved --limit as numeric parse in router while adding string-valued flags for edit command"

patterns-established:
  - "Mutation command pattern: validate existence, check preconditions (idempotent), mutate config, sync scheduler, confirm to user"
  - "Flag parsing: stringFlags/booleanFlags sets with flagKeyMap for kebab-to-camelCase conversion"

requirements-completed: [JOB-02, JOB-03, JOB-04]

# Metrics
duration: 4min
completed: 2026-03-21
---

# Phase 5 Plan 2: Job Mutation Commands Summary

**Pause/resume/remove/edit CLI commands with config-scheduler sync, cron validation, and idempotent state management**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-21T20:30:39Z
- **Completed:** 2026-03-21T20:34:45Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Full mutation CLI: pause (disables + unregisters), resume (enables + registers), remove (cleanup + optional log archival), edit (multi-field update with validation)
- Config and scheduler kept in sync: every mutation that affects scheduling coordinates updateJob + scheduler.register/unregister
- All mutation commands are idempotent: pausing an already-paused job or resuming an active job prints informational message without error
- 25 new tests across 4 test files, all 60 CLI tests and 278 total tests passing
- Router extended with generic flag parser supporting string-valued and boolean flags with kebab-to-camelCase mapping

## Task Commits

Each task was committed atomically:

1. **Task 1: Pause, resume, and remove commands** - `094b6ed` (feat)
2. **Task 2: Edit command, router wiring, and barrel export update** - `fadace0` (feat)

## Files Created/Modified
- `src/cli/commands/pause.ts` - Pause command: sets enabled=false, best-effort scheduler unregister
- `src/cli/commands/resume.ts` - Resume command: sets enabled=true, registers with scheduler, shows next run
- `src/cli/commands/remove.ts` - Remove command: unregisters + deletes job dir, --keep-logs archives run logs
- `src/cli/commands/edit.ts` - Edit command: multi-field update with cron validation and scheduler re-registration
- `src/cli/router.ts` - Extended parseCommand with generic flag parser, added 4 new command dispatch cases
- `src/index.ts` - Added barrel exports for pauseCommand, resumeCommand, removeCommand, editCommand
- `tests/cli/pause.test.ts` - 5 tests: active pause, idempotent, missing args, not found, scheduler failure
- `tests/cli/resume.test.ts` - 5 tests: paused resume, idempotent, missing args, not found, defensive unregister
- `tests/cli/remove.test.ts` - 5 tests: remove existing, --keep-logs, missing args, not found, scheduler failure
- `tests/cli/edit.test.ts` - 10 tests: name/schedule/timezone/maxTurns edit, invalid cron, no flags, multiple flags, not found

## Decisions Made
- Best-effort scheduler unregister: pause and remove wrap scheduler.unregister in try/catch since the scheduler entry may already be removed (e.g., job was never registered, or plist file was manually deleted)
- Idempotent pause/resume: pausing an already-paused job prints "already paused" and returns 0 (not an error). Same for resuming an already-active job. This matches user expectations for CLI tools.
- Edit command only re-registers with scheduler when schedule or timezone fields change AND the job is currently enabled. Editing name/branch/guardrails skips scheduler interaction entirely.
- Preserved --limit as numeric parse (Number.parseInt) in the router to maintain backward compatibility with logs command, while new flags like --max-turns and --max-budget are passed as strings and parsed in the edit command itself.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed --limit flag regression in router parser**
- **Found during:** Task 2 (router update)
- **Issue:** Refactoring the argument parser to support new flags changed --limit from Number.parseInt to string, breaking an existing router test
- **Fix:** Added explicit numeric parsing for --limit flag while keeping other flags as strings
- **Files modified:** src/cli/router.ts
- **Verification:** All 21 router tests pass including the --limit numeric test
- **Committed in:** fadace0 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed biome lint errors: noImplicitAnyLet + formatting**
- **Found during:** Task 2 (lint verification)
- **Issue:** `let config;` without type annotation triggers biome's noImplicitAnyLet rule; import order and formatting issues
- **Fix:** Added explicit `JobConfig` type annotations, ran biome auto-fix for formatting and import ordering
- **Files modified:** src/cli/commands/pause.ts, resume.ts, remove.ts, edit.ts
- **Verification:** `npx biome check src/cli/ bin/claude-auto.ts` reports 0 errors
- **Committed in:** fadace0 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for test and lint compliance. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 5 complete: full CLI with 7 commands (list, logs, report, pause, resume, remove, edit)
- All commands coordinate config persistence with scheduler registration
- Ready for Phase 6: Skill packaging and npm distribution

## Self-Check: PASSED

All 10 created/modified files verified on disk. Both task commits (094b6ed, fadace0) verified in git log.

---
*Phase: 05-job-management-cli*
*Completed: 2026-03-21*
