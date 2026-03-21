---
phase: 08-foundation
plan: 01
subsystem: config, runner
tags: [zod, model-selection, budget-caps, cli-flags, schema-validation]

# Dependency graph
requires:
  - phase: none
    provides: existing JobConfigSchema, SpawnOptions, RunStatus, RunResult types
provides:
  - JobConfigSchema with model field (5 aliases + claude-* pattern)
  - JobConfigSchema with budget field (dailyUsd/weeklyUsd/monthlyUsd)
  - SpawnOptions.model for CLI flag passthrough
  - RunStatus "budget-exceeded" for downstream budget enforcement
  - RunResult.model for cost tracking correlation
  - Spawner --model flag wiring
affects: [08-02 (cost tracking schema), 08-03 (agent pipeline model config), 09-pr-feedback, 10-agent-teams]

# Tech tracking
tech-stack:
  added: []
  patterns: [zod union type for model aliases + regex pattern, optional schema extension pattern]

key-files:
  created: []
  modified:
    - src/core/types.ts
    - src/runner/types.ts
    - src/runner/spawner.ts
    - tests/core/config.test.ts
    - tests/runner/spawner.test.ts

key-decisions:
  - "Model field uses z.union of z.enum (5 known aliases) + z.string().regex(/^claude-/) for full model IDs -- extensible without code changes"
  - "model: 'default' omits --model flag entirely, letting Claude Code use its own default"
  - "Budget fields are schema-only (no enforcement logic yet) -- enforcement deferred to cost tracking plan"

patterns-established:
  - "Optional schema extension: new optional fields added after existing fields, zero breakage"
  - "CLI flag conditional passthrough: check truthy + not-default before pushing args"

requirements-completed: [MODL-01, MODL-02, MODL-03, COST-03]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 8 Plan 1: Model Selection & Budget Schema Summary

**Per-job model selection via --model CLI flag with 5 aliases + full model IDs, plus budget cap schema (daily/weekly/monthly) for downstream cost enforcement**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T22:22:06Z
- **Completed:** 2026-03-21T22:25:13Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- JobConfigSchema extended with model field supporting 5 aliases (opus, sonnet, haiku, opusplan, default) plus any claude-* full model ID
- JobConfigSchema extended with budget field supporting dailyUsd, weeklyUsd, monthlyUsd (all optional positive numbers)
- SpawnOptions, RunStatus, and RunResult types extended for model tracking and budget-exceeded status
- Spawner passes --model flag to Claude CLI when model is set and not "default"
- 18 new tests (13 schema validation + 5 spawner model selection), all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend types and schema with model + budget fields**
   - `65bfd5e` (test) - TDD RED: failing tests for model and budget validation
   - `cbe2121` (feat) - TDD GREEN: model + budget schema fields implemented
2. **Task 2: Wire --model flag in spawner**
   - `cb0b7a5` (test) - TDD RED: failing tests for --model flag
   - `c45601b` (feat) - TDD GREEN: --model flag wired in spawner

## Files Created/Modified
- `src/core/types.ts` - Added model (union of aliases + regex) and budget (daily/weekly/monthly) optional fields to JobConfigSchema
- `src/runner/types.ts` - Added model to SpawnOptions, "budget-exceeded" to RunStatus, model to RunResult
- `src/runner/spawner.ts` - Added --model flag passthrough when model is set and not "default"
- `tests/core/config.test.ts` - 13 new tests for model and budget field validation
- `tests/runner/spawner.test.ts` - 5 new tests for --model flag inclusion/omission

## Decisions Made
- Model field uses z.union of z.enum (5 known aliases) + z.string().regex(/^claude-/) for full model IDs -- extensible without code changes when new models ship
- model: "default" omits --model flag entirely, letting Claude Code use its own default model
- Budget fields are schema-only in this plan (no enforcement logic) -- enforcement deferred to cost tracking plan (08-02)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Model selection schema and spawner wiring complete, ready for agent pipeline (08-03) to use per-agent model config
- Budget schema ready for cost tracking (08-02) to add enforcement logic
- RunStatus "budget-exceeded" ready for downstream budget enforcement flows

## Self-Check: PASSED

- All 5 modified files exist on disk
- All 4 task commits verified in git log (65bfd5e, cbe2121, cb0b7a5, c45601b)
- 355 tests pass, 0 type errors

---
*Phase: 08-foundation*
*Completed: 2026-03-21*
