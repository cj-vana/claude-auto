---
phase: 03-run-orchestrator-git-safety
plan: 02
subsystem: runner
tags: [claude-cli, child_process, spawn, prompt-builder, guardrails, json-logging, headless-mode]

# Dependency graph
requires:
  - phase: 01-core-config-storage
    provides: JobConfig type, paths utility, writeFileSafe, error classes
  - phase: 03-run-orchestrator-git-safety (plan 01)
    provides: SpawnOptions, SpawnResult, RunLogEntry types, SpawnError class
provides:
  - spawnClaude function for Claude CLI invocation with JSON output parsing
  - buildAllowedTools function for guardrails-aware tool list construction
  - buildSystemPrompt and buildWorkPrompt for autonomous work instructions
  - writeRunLog, readRunLog, listRunLogs for run audit trail
affects: [03-run-orchestrator-git-safety plan 03 (orchestrator), notifications, skill commands]

# Tech tracking
tech-stack:
  added: []
  patterns: [child_process.spawn with JSON stdout parsing, conditional prompt sections based on config, PassThrough stream mocking for child process tests]

key-files:
  created:
    - src/runner/spawner.ts
    - src/runner/prompt-builder.ts
    - src/runner/logger.ts
    - tests/runner/spawner.test.ts
    - tests/runner/prompt-builder.test.ts
    - tests/runner/logger.test.ts
  modified: []

key-decisions:
  - "Used PassThrough streams for mock child process in spawner tests (reliable data event emission vs Readable push)"
  - "Prompt builder uses section-based string concatenation with conditional guardrails (no template engine needed)"
  - "Logger stores pretty-printed JSON (2-space indent) for human readability of run logs"

patterns-established:
  - "Child process mock pattern: PassThrough streams + process.nextTick for async event emission"
  - "Conditional prompt sections: guardrails array builds only when config flags are true"
  - "File-based logging: JSON per run with sort-by-recency listing"

requirements-completed: [EXEC-01, EXEC-02, EXEC-03, EXEC-04, EXEC-05, EXEC-06, SAFE-01, SAFE-02, SAFE-03, REPT-01]

# Metrics
duration: 5min
completed: 2026-03-21
---

# Phase 03 Plan 02: Claude Spawner, Prompt Builder & Run Logger Summary

**Claude CLI spawner with --dangerously-skip-permissions and JSON output parsing, prompt builder encoding priority chain (issues>bugs>improvements) with opt-in guardrails, and JSON run logger for audit trail**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-21T19:35:19Z
- **Completed:** 2026-03-21T19:40:26Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Spawner invokes Claude CLI with all required flags (--max-turns, --max-budget-usd, --dangerously-skip-permissions, --output-format json, --allowedTools) and parses JSON stdout
- Prompt builder encodes all 6 EXEC requirements: codebase research (EXEC-02), priority chain (EXEC-03), bug scanning (EXEC-04), issue evaluation (EXEC-05), documentation (EXEC-06), plus git safety and completion instructions
- Default config produces permissive prompt with no guardrail restrictions (SAFE-03); guardrails activate only when explicitly set
- buildAllowedTools correctly adapts tool list based on guardrails.noNewDependencies
- Logger writes/reads/lists JSON run log files sorted by recency (REPT-01)
- 46 tests covering all modules: spawner args, JSON parsing, error handling, prompt sections, guardrail conditions, log CRUD

## Task Commits

Each task was committed atomically:

1. **Task 1: Create spawner module and prompt builder with tests** - `2755503` (feat)
2. **Task 2: Create run logger module with tests** - `c96352a` (feat)

_Note: TDD tasks each had RED (tests fail) -> GREEN (implementation passes) flow_

## Files Created/Modified
- `src/runner/spawner.ts` - Claude CLI invocation with spawn, JSON output parsing, buildAllowedTools
- `src/runner/prompt-builder.ts` - buildSystemPrompt (research + custom), buildWorkPrompt (priority chain, focus, guardrails, git safety, docs, completion)
- `src/runner/logger.ts` - writeRunLog, readRunLog, listRunLogs for JSON run log management
- `tests/runner/spawner.test.ts` - 16 tests for spawner args, JSON parsing, error handling, tool list
- `tests/runner/prompt-builder.test.ts` - 19 tests for prompt sections, guardrail conditions, EXEC requirements
- `tests/runner/logger.test.ts` - 11 tests for write, read, list, ENOENT handling, parse error resilience

## Decisions Made
- Used PassThrough streams for mock child process in spawner tests -- Readable.push() had timing issues with data event emission; PassThrough streams with process.nextTick provide reliable async event delivery
- Prompt builder uses section-based string concatenation with conditional guardrails array -- simple, no template engine dependency needed
- Logger stores pretty-printed JSON (2-space indent) for human readability of run log files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed spawner test mock stream approach**
- **Found during:** Task 1 (spawner tests)
- **Issue:** Readable streams with push() didn't reliably emit data events to listeners set up by spawnClaude
- **Fix:** Switched to PassThrough streams with process.nextTick for async event emission
- **Files modified:** tests/runner/spawner.test.ts
- **Verification:** All 16 spawner tests pass
- **Committed in:** 2755503 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test approach fix only, no scope change. Implementation matches plan exactly.

## Issues Encountered
None beyond the test mock approach adjustment documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Spawner, prompt builder, and logger are ready for orchestrator integration (Plan 03)
- Orchestrator will compose these modules: lock -> config -> git -> prompt -> spawn -> PR -> log
- All types from Plan 01 (SpawnOptions, SpawnResult, RunLogEntry, SpawnError) are consumed correctly

## Self-Check: PASSED

- All 7 created files verified present on disk
- Both task commits (2755503, c96352a) verified in git log
- 46/46 tests passing
- TypeScript type-check clean (npx tsc --noEmit)
- Full test suite 144/144 passing

---
*Phase: 03-run-orchestrator-git-safety*
*Completed: 2026-03-21*
