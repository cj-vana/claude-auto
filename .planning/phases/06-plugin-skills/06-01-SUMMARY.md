---
phase: 06-plugin-skills
plan: 01
subsystem: cli
tags: [cli, create-command, check-repo, arg-parsing, scheduler-registration, gh-clone]

# Dependency graph
requires:
  - phase: 05-cli-management
    provides: CLI router, parseCommand, types, barrel exports pattern
  - phase: 01-config-foundation
    provides: job-manager createJob, JobConfig schema
  - phase: 02-scheduling
    provides: validateCronExpression, describeSchedule, getNextRuns, createScheduler
  - phase: 03-runner-engine
    provides: execCommand utility
provides:
  - createCommand CLI handler for job creation with full arg parsing, validation, repo clone, scheduler registration
  - checkRepoCommand CLI handler for git repository validation with JSON output
  - Router integration with 7 new string flags, 3 new boolean flags, and 2 new command cases
  - Barrel exports for both new commands
affects: [06-plugin-skills, setup-wizard]

# Tech tracking
tech-stack:
  added: []
  patterns: [notification-trigger-defaults, repo-auto-clone-via-gh, system-prompt-file-reading]

key-files:
  created:
    - src/cli/commands/create.ts
    - src/cli/commands/check-repo.ts
    - tests/cli/create.test.ts
    - tests/cli/check-repo.test.ts
  modified:
    - src/cli/types.ts
    - src/cli/router.ts
    - src/index.ts

key-decisions:
  - "Notification objects include default trigger values (onSuccess:true, onFailure:true, onNoChanges:false, onLocked:false) to satisfy Zod output type requirements"
  - "Telegram --notify-telegram format is botToken:chatId split on first colon"
  - "Default focus is open-issues,bug-discovery; default timezone is system timezone via Intl.DateTimeFormat"

patterns-established:
  - "CLI command pattern: validate required args, print usage on missing, throw Error for programmatic callers"
  - "Repo validation pattern: stat + git rev-parse, with optional gh clone on ENOENT"

requirements-completed: [SETUP-01, SETUP-04, SETUP-05]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 06 Plan 01: CLI Create & Check-Repo Commands Summary

**Create and check-repo CLI commands with full arg parsing, repo auto-clone via gh, scheduler registration, and JSON repo validation output**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T21:04:18Z
- **Completed:** 2026-03-21T21:07:30Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- create command validates inputs, reads system-prompt-file, clones repos via gh, creates jobs, and registers with scheduler
- check-repo command validates paths as git repos and outputs JSON for wizard consumption
- Router integration with 10 new flags (7 string, 3 boolean) and 2 new command dispatch cases
- 13 new tests (9 create, 4 check-repo) all passing; 305 total tests green

## Task Commits

Each task was committed atomically:

1. **Task 1: Create and check-repo CLI commands with tests** - `f79370a` (feat)
2. **Task 2: Router integration, types update, and barrel export** - `ab79bae` (feat)

_Note: Task 1 was TDD (RED/GREEN combined in single commit after verification)_

## Files Created/Modified
- `src/cli/commands/create.ts` - Create command: validates args, clones repos via gh, creates jobs, registers scheduler
- `src/cli/commands/check-repo.ts` - Check-repo command: validates path is git repo, outputs JSON
- `tests/cli/create.test.ts` - 9 tests covering happy path, system-prompt-file, auto-clone, validation, guardrails, notifications, defaults
- `tests/cli/check-repo.test.ts` - 4 tests covering git repo, non-existent path, not-a-directory, missing arg
- `src/cli/types.ts` - Added create and check-repo to CliCommand union and COMMANDS record
- `src/cli/router.ts` - Added new string/boolean flags, flagKeyMap entries, and switch cases
- `src/index.ts` - Added barrel exports for createCommand and checkRepoCommand

## Decisions Made
- Notification objects include default trigger values to satisfy Zod output type requirements (output type has booleans required due to .default())
- Telegram --notify-telegram format is "botToken:chatId" split on first colon for simple CLI parsing
- Default focus is "open-issues,bug-discovery" and default timezone is system timezone via Intl.DateTimeFormat

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed notification type compliance with Zod output types**
- **Found during:** Task 2 (Router integration)
- **Issue:** TypeScript errored because JobConfig notification objects require onSuccess/onFailure/onNoChanges/onLocked booleans (Zod .default() makes them required in output type)
- **Fix:** Added default trigger values spread into each notification provider object
- **Files modified:** src/cli/commands/create.ts, tests/cli/create.test.ts
- **Verification:** tsc --noEmit passes clean, test expectations updated
- **Committed in:** ab79bae (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Type compliance fix was necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- create and check-repo commands ready for setup wizard skill to invoke
- Router cleanly dispatches both commands with full flag parsing
- All 305 tests pass, biome clean, TypeScript clean

## Self-Check: PASSED

- All 4 created files exist on disk
- Commit f79370a (Task 1) verified in git log
- Commit ab79bae (Task 2) verified in git log
- 305 tests pass, tsc clean, biome clean

---
*Phase: 06-plugin-skills*
*Completed: 2026-03-21*
