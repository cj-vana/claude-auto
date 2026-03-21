---
phase: 07-polish-tech-debt
plan: 01
subsystem: cli, runner
tags: [cli-flags, json-output, orchestrator, guardrails, tech-debt]

requires:
  - phase: 05-cli-management
    provides: CLI router, list command, create command
  - phase: 03-runner-engine
    provides: orchestrator executeRun, RunStatus types, runner types
provides:
  - "--restrict-paths CLI flag wired through router to create command guardrails"
  - "--json output mode on list command"
  - "config.enabled defense-in-depth check in orchestrator with paused status"
affects: []

tech-stack:
  added: []
  patterns:
    - "Comma-separated CLI flag parsing for array values (restrictToPaths)"
    - "JSON output mode pattern for CLI commands (args.json branch)"
    - "Defense-in-depth config.enabled early exit in orchestrator"

key-files:
  created: []
  modified:
    - src/cli/router.ts
    - src/cli/commands/create.ts
    - src/cli/commands/list.ts
    - src/runner/orchestrator.ts
    - src/runner/types.ts
    - tests/cli/router.test.ts
    - tests/cli/create.test.ts
    - tests/cli/list.test.ts
    - tests/runner/orchestrator.test.ts

key-decisions:
  - "restrictToPaths parsed from comma-separated string with trim/filter for robustness"
  - "JSON output uses full repo path (not truncated) for machine readability"
  - "Paused status exits 0 in runner (silent skip, not error)"

patterns-established:
  - "JSON output mode: check args.json, output JSON.stringify with 2-space indent, return early"
  - "Defense-in-depth: check config.enabled after loading, before any side effects"

requirements-completed: [SAFE-03, JOB-01]

duration: 3min
completed: 2026-03-21
---

# Phase 7 Plan 1: Tech Debt Closure Summary

**Wired --restrict-paths CLI flag through router/create, added --json output on list command, and added config.enabled defense-in-depth check in orchestrator with paused status**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T21:28:59Z
- **Completed:** 2026-03-21T21:32:08Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- `--restrict-paths src/,tests/` flag now round-trips through CLI router into create command guardrails as restrictToPaths array
- `claude-auto list --json` outputs valid JSON array with id, name, status, repo, schedule, lastRun, nextRun fields
- Orchestrator checks config.enabled after loading config; disabled jobs return "paused" status without spawning Claude, write a log entry, and release the lock cleanly

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1: Wire --restrict-paths through CLI router and create command**
   - `35e6f17` (test: failing tests for --restrict-paths)
   - `294ced2` (feat: wire --restrict-paths through router and create)
2. **Task 2: Implement --json output mode on list command**
   - `729cdaa` (test: failing tests for --json output mode)
   - `09d79d9` (feat: implement --json output on list command)
3. **Task 3: Add config.enabled check in orchestrator**
   - `66a2d8c` (test: failing tests for config.enabled check)
   - `27da50a` (feat: add config.enabled defense-in-depth check)

## Files Created/Modified
- `src/cli/router.ts` - Added --restrict-paths to stringFlags and flagKeyMap
- `src/cli/commands/create.ts` - Parse restrictPaths into restrictToPaths array, wire into guardrails
- `src/cli/commands/list.ts` - JSON output mode with args.json check, empty list outputs "[]"
- `src/runner/types.ts` - Added "paused" to RunStatus union type
- `src/runner/orchestrator.ts` - config.enabled check returning early with paused status
- `tests/cli/router.test.ts` - Test for --restrict-paths flag parsing
- `tests/cli/create.test.ts` - Tests for restrictToPaths wiring and undefined case
- `tests/cli/list.test.ts` - Tests for JSON output with jobs, JSON fields, and empty list
- `tests/runner/orchestrator.test.ts` - Tests for paused status, no side effects, log writing, lock release

## Decisions Made
- restrictToPaths parsed from comma-separated string with `.split(",").map(s => s.trim()).filter(Boolean)` for robustness against whitespace/trailing commas
- JSON list output uses full repo path (not truncated like table output) since machine consumers need exact paths
- "paused" status exits 0 in bin/claude-auto-run.ts (neither "error" nor "git-error"), which is correct behavior for a silently skipped job

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 3 tech debt items from v1.0 milestone audit are now resolved
- Full test suite passes (315 tests across 27 files)
- Ready for v1.0 milestone completion

## Self-Check: PASSED

All 9 modified files verified present. All 6 commit hashes verified in git log.

---
*Phase: 07-polish-tech-debt*
*Completed: 2026-03-21*
