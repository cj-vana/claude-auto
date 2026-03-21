---
phase: 09-pr-intelligence
plan: 02
subsystem: runner
tags: [issue-triage, scoring, filtering, gh-cli, typescript]

# Dependency graph
requires: []
provides:
  - "triageIssues function for pre-scoring GitHub issues"
  - "ScoredIssue interface for typed issue scoring results"
  - "Label-based prioritization (good first issue, bug, enhancement, documentation)"
  - "Skip logic for spam, vague, assigned, and already-attempted issues"
affects: [09-pr-intelligence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Issue scoring rubric: base score with label boosts and body quality adjustments"
    - "Case-insensitive label matching via toLowerCase()"
    - "Skip-before-score pattern: check exclusion criteria before computing score"
    - "Body truncation to 1000 chars for token savings"

key-files:
  created:
    - src/runner/issue-triage.ts
    - tests/runner/issue-triage.test.ts
  modified: []

key-decisions:
  - "Base score of 50 with additive/subtractive adjustments rather than multiplicative scoring"
  - "Skip reasons as string constants for debuggability and logging"
  - "Body truncation at 1000 chars balances context quality with token cost"

patterns-established:
  - "Triage scoring pattern: skip checks first, then additive scoring, then sort"
  - "GhIssue internal interface for raw CLI output, ScoredIssue exported for consumers"

requirements-completed: [TRIG-01, TRIG-02, TRIG-03]

# Metrics
duration: 1m53s
completed: 2026-03-21
---

# Phase 09 Plan 02: Issue Triage Summary

**Issue triage module with label-based scoring (+30 good first issue, +20 bug), body quality evaluation, and skip filtering for spam/assigned/duplicate issues**

## Performance

- **Duration:** 1m53s
- **Started:** 2026-03-21T23:04:25Z
- **Completed:** 2026-03-21T23:06:18Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Issue scoring rubric: base 50, label boosts (good first issue +30, bug +20, enhancement +10, documentation +5), body quality penalties/bonuses
- Skip filtering: already-attempted, assigned, negative-label (wontfix/duplicate), requires-human (question/discussion)
- Case-insensitive label matching and body truncation to 1000 chars
- 20 comprehensive tests covering scoring, skip logic, priority ordering, and edge cases

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for issue triage** - `1bbfdbc` (test)
2. **Task 1 (GREEN): Implement issue triage module** - `3de5231` (feat)

_TDD task: test-first then implementation_

## Files Created/Modified
- `src/runner/issue-triage.ts` - Issue triage module with triageIssues function and ScoredIssue type
- `tests/runner/issue-triage.test.ts` - 20 tests covering scoring, filtering, priority, and edge cases

## Decisions Made
- Base score of 50 with additive/subtractive adjustments (simpler and more debuggable than multiplicative)
- Skip reasons as string constants ("already-attempted", "assigned", "negative-label", "requires-human") for logging and debugging
- Body truncation at 1000 chars balances sufficient context for Claude with token cost savings
- Skipped issues are excluded entirely from returned array (not returned with score=0) for cleaner consumer API

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - module is fully implemented with all scoring, filtering, and sorting logic.

## Next Phase Readiness
- triageIssues and ScoredIssue are exported and ready to be wired into the orchestrator
- Plan 03 can import and use triageIssues to pre-filter issues before spawning Claude
- Module uses execCommand interface making it easy to integrate with existing runner infrastructure

## Self-Check: PASSED

- [x] src/runner/issue-triage.ts exists
- [x] tests/runner/issue-triage.test.ts exists
- [x] 09-02-SUMMARY.md exists
- [x] Commit 1bbfdbc (test RED) exists
- [x] Commit 3de5231 (feat GREEN) exists

---
*Phase: 09-pr-intelligence*
*Completed: 2026-03-21*
