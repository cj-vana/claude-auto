---
phase: 10-agent-pipeline
plan: 02
subsystem: runner
tags: [pipeline, prompts, orchestration, spawnClaude, review-verdict, multi-stage]

# Dependency graph
requires:
  - phase: 10-agent-pipeline
    provides: PipelineConfigSchema, PipelineResult/PipelineStageResult types, getDiffFromBase, ModelSchema
provides:
  - runPipeline function orchestrating sequential Claude spawns (plan->implement->review->fix)
  - Stage-specific prompt builders (buildPlanPrompt, buildImplementPrompt, buildReviewPrompt, buildFixPrompt)
  - Stage-specific system prompt builders for all 4 stages
  - parseReviewVerdict for extracting pass/fail from review output
  - buildReadOnlyTools for read-only stage tool filtering
affects: [10-03-PLAN orchestrator wiring, pipeline integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [Sequential spawnClaude composition for multi-stage pipeline, Budget fraction allocation across pipeline stages, Verdict parsing with fail-safe default]

key-files:
  created:
    - src/runner/pipeline-prompts.ts
    - src/runner/pipeline.ts
    - tests/runner/pipeline-prompts.test.ts
    - tests/runner/pipeline.test.ts
  modified:
    - src/runner/prompt-builder.ts

key-decisions:
  - "Exported GIT_SAFETY_SECTION from prompt-builder.ts and imported in pipeline-prompts.ts to prevent text drift"
  - "parseReviewVerdict defaults to fail when no verdict marker found (safer to run fix stage unnecessarily)"
  - "FAIL takes priority over PASS when both verdict markers appear in review output"

patterns-established:
  - "Pipeline stage prompts: each stage gets task-specific prompt with role framing (plan=read-only, implement=full, review=verdict, fix=targeted)"
  - "Budget fraction constants: BUDGET_PLAN=0.15, BUDGET_IMPLEMENT=0.55, BUDGET_REVIEW=0.15, BUDGET_FIX=0.15"
  - "Review loop: for maxReviewRounds iterations, review then fix on fail, break on pass"

requirements-completed: [PIPE-02, PIPE-03]

# Metrics
duration: 5min
completed: 2026-03-21
---

# Phase 10 Plan 02: Pipeline Orchestration & Prompt Builders Summary

**runPipeline composing sequential spawnClaude calls with stage-specific prompts, budget splits, and review verdict parsing for plan->implement->review->fix pipeline**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-21T23:48:29Z
- **Completed:** 2026-03-21T23:53:29Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Pipeline prompt builders for all 4 stages (plan, implement, review, fix) with stage-appropriate content
- runPipeline orchestrating sequential plan->implement->review->optional fix stages with per-stage model/budget/tools
- Review verdict parser with case-insensitive matching, fail-safe default, and FAIL priority over PASS
- buildReadOnlyTools providing read-only tool set for plan and review stages
- 65 new tests (38 prompt + 27 pipeline) all passing, 523 total suite green with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Pipeline prompt builders and review verdict parser** - `f668398` (test: RED) + `e74456a` (feat: GREEN)
2. **Task 2: Pipeline orchestration module** - `1a751be` (test: RED) + `03003c8` (feat: GREEN)

_Note: TDD tasks have RED + GREEN commits_

## Files Created/Modified
- `src/runner/pipeline-prompts.ts` - Stage-specific prompt builders for plan, implement, review, fix stages + parseReviewVerdict + buildReadOnlyTools
- `src/runner/pipeline.ts` - runPipeline function orchestrating sequential Claude spawns with budget allocation
- `src/runner/prompt-builder.ts` - Exported GIT_SAFETY_SECTION for reuse in pipeline-prompts.ts
- `tests/runner/pipeline-prompts.test.ts` - 38 tests covering all prompt builders, verdict parser, and read-only tools
- `tests/runner/pipeline.test.ts` - 27 tests covering pipeline orchestration, budget split, model selection, verdict handling

## Decisions Made
- Exported GIT_SAFETY_SECTION from prompt-builder.ts and imported in pipeline-prompts.ts to avoid text drift between modules
- parseReviewVerdict defaults to "fail" when no verdict marker is found (safer to run fix unnecessarily than skip needed fixes)
- When both VERDICT: PASS and VERDICT: FAIL appear, FAIL takes priority (handles ambiguous/contradictory review output safely)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- runPipeline ready for Plan 03 (orchestrator wiring) to call when config.pipeline?.enabled is true
- All prompt builders and pipeline functions exported and tested
- Budget fraction constants and review verdict parsing established as patterns
- Pipeline composes existing spawnClaude without modifying spawner.ts

## Self-Check: PASSED

- All 5 files verified present on disk
- All 4 commit hashes verified in git log
- No stubs detected in created source files

---
*Phase: 10-agent-pipeline*
*Completed: 2026-03-21*
