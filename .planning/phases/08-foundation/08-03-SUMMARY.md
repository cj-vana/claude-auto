---
phase: 08-foundation
plan: 03
subsystem: runner, cli
tags: [sqlite, cost-tracking, budget-enforcement, cli]

# Dependency graph
requires:
  - phase: 08-01
    provides: Model field in JobConfigSchema, SpawnOptions.model, budget schema, RunStatus budget-exceeded
  - phase: 08-02
    provides: SQLite database singleton, context-store with saveRunContext/loadRunContext
provides:
  - Budget enforcement via checkBudget (daily/weekly/monthly caps)
  - Cost aggregation via getCostSummary (per-job totals, per-day breakdown)
  - Cost CLI command (claude-auto cost)
  - Orchestrator integration (budget check, context load, model passthrough)
affects: [cli, runner, orchestrator, cost-tracking]

# Tech tracking
tech-stack:
  added: []
  patterns: [pre-spawn budget check, context injection into prompt builder, model passthrough to spawner]

key-files:
  created:
    - src/runner/cost-tracker.ts
    - src/cli/commands/cost.ts
    - tests/runner/cost-tracker.test.ts
    - tests/cli/cost.test.ts
  modified:
    - src/runner/orchestrator.ts
    - src/cli/types.ts
    - src/cli/router.ts
    - src/index.ts
    - tests/runner/orchestrator.test.ts

key-decisions:
  - "Budget check runs before git pull to avoid unnecessary work when budget is exceeded"
  - "Context loading is best-effort (try/catch) to never block runs on DB errors"
  - "Non-spending statuses (locked, paused, budget-exceeded) excluded from budget aggregation"

patterns-established:
  - "Pre-spawn guard pattern: check condition before expensive operations, return early with status"
  - "Cost CLI follows existing command pattern: dynamic import, formatTable output, --json flag"

requirements-completed: [COST-02, COST-04]

# Metrics
duration: 4m41s
completed: 2026-03-21
---

# Phase 08 Plan 03: Cost Tracking & Orchestrator Integration Summary

**Budget enforcement with daily/weekly/monthly caps, cost CLI command with per-job/per-day views, and full orchestrator integration (budget check + context load + model passthrough)**

## Performance

- **Duration:** 4m 41s
- **Started:** 2026-03-21T22:28:22Z
- **Completed:** 2026-03-21T22:33:03Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Budget enforcement: checkBudget evaluates cumulative daily/weekly/monthly spend against caps, excluding non-spending statuses
- Cost CLI: `claude-auto cost` shows per-job totals, `claude-auto cost <jobId>` shows per-day breakdown, `--json` for machine-readable output
- Orchestrator integration: pre-spawn budget check (returns budget-exceeded with notification), cross-run context loading injected into prompt, model passthrough to spawner
- 43 new/updated tests across 3 test files, 377 total tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create cost-tracker module with budget enforcement** - `ccb6408` (test) + `a1ffc2e` (feat)
2. **Task 2: Cost CLI command + orchestrator integration + barrel export** - `62e9a91` (test) + `4e1ba57` (feat)

_Note: TDD tasks have two commits each (RED test + GREEN implementation)_

## Files Created/Modified
- `src/runner/cost-tracker.ts` - Budget checking (checkBudget) and cost aggregation (getCostSummary) with SQLite queries
- `src/cli/commands/cost.ts` - CLI handler for `claude-auto cost` with table/JSON output
- `src/runner/orchestrator.ts` - Added budget check (Step 2.5), context loading (Step 4.5), model passthrough to spawnClaude
- `src/cli/types.ts` - Added "cost" to CliCommand union and COMMANDS map
- `src/cli/router.ts` - Added cost command routing case
- `src/index.ts` - Barrel exports for checkBudget, getCostSummary, costCommand, and types
- `tests/runner/cost-tracker.test.ts` - 13 tests for budget checking and cost summary
- `tests/cli/cost.test.ts` - 5 tests for cost CLI command output
- `tests/runner/orchestrator.test.ts` - 4 new tests for budget-exceeded, context loading, model passthrough

## Decisions Made
- Budget check runs before git pull (Step 2.5) to avoid unnecessary work when budget is exceeded
- Context loading is best-effort with try/catch to never block runs on DB errors
- Non-spending statuses (locked, paused, budget-exceeded) excluded from budget aggregation to prevent false positives

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 8 (Foundation) is fully complete: model selection, SQLite persistence, context store, cost tracking, and budget enforcement all integrated
- Ready for subsequent phases building on this infrastructure (agent teams, merge conflict resolution, etc.)

## Self-Check: PASSED

All created files verified present. All 4 task commits verified in git log.

---
*Phase: 08-foundation*
*Completed: 2026-03-21*
