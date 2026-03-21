---
phase: 09-pr-intelligence
plan: 01
subsystem: runner, core
tags: [pr-feedback, graphql, review-threads, feedback-rounds, sqlite-migration, git-ops]

# Dependency graph
requires:
  - phase: 08-02
    provides: SQLite database singleton (getDatabase, closeDatabase), runs table, context-store
provides:
  - PR feedback detection module (listOpenPRsWithFeedback, getUnresolvedThreads, checkPendingPRFeedback)
  - Feedback round counting from SQLite (getFeedbackRound)
  - PR comment posting (postPRComment)
  - Repository owner/name extraction (getRepoOwnerName)
  - checkoutExistingBranch in git-ops (fetch + checkout + reset --hard)
  - PRFeedbackContext and ReviewThread type interfaces
  - "needs-human-review" RunStatus for max-rounds-exceeded PRs
  - maxFeedbackRounds config field with default 3
  - Database schema v2 with feedback_round and pr_number columns
affects: [09-02 (orchestrator integration), 09-03 (issue triage), 10-agent-teams]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - GraphQL via gh api graphql for review thread resolution status (REST lacks isResolved)
    - Bot comment filtering by author login suffix "[bot]"
    - Best-effort PR commenting (try/catch, warn on failure, same pattern as postIssueComment)
    - Database migration v2 via ALTER TABLE ADD COLUMN with user_version pragma

key-files:
  created:
    - src/runner/pr-feedback.ts
    - tests/runner/pr-feedback.test.ts
  modified:
    - src/runner/types.ts
    - src/core/types.ts
    - src/core/database.ts
    - src/runner/git-ops.ts
    - tests/core/config.test.ts
    - tests/core/database.test.ts
    - tests/runner/git-ops.test.ts

key-decisions:
  - "GraphQL query for review threads uses getRepoOwnerName to resolve owner/name dynamically rather than parsing git remote URL"
  - "Bot comments filtered by [bot] suffix in author login to exclude CI/linter noise from feedback threads"
  - "checkPendingPRFeedback returns null (not a special status) when max rounds exceeded -- caller decides behavior"
  - "maxFeedbackRounds uses .default(3).optional() so field always has value 3 when not specified in config"

patterns-established:
  - "PR feedback detection pattern: REST for PR list -> GraphQL for thread resolution -> SQLite for round counting"
  - "checkoutExistingBranch pattern: fetch origin -> checkout -> reset --hard origin/ (safe for agent-created branches)"

requirements-completed: [PRFB-01, PRFB-02, PRFB-03]

# Metrics
duration: 4m 32s
completed: "2026-03-21T23:09:04Z"
---

# Phase 09 Plan 01: PR Feedback Foundation Summary

**PR feedback detection module with GraphQL thread extraction, feedback round counting in SQLite, checkoutExistingBranch for PR iteration, and database schema v2 migration**

## Performance

- **Duration:** 4m 32s
- **Started:** 2026-03-21T23:04:32Z
- **Completed:** 2026-03-21T23:09:04Z
- **Tasks:** 2/2
- **Files modified:** 9

## Accomplishments
- PR feedback detection module fully functional with 6 exported functions covering the complete feedback detection lifecycle
- GraphQL-based unresolved review thread extraction with bot comment filtering
- Database migration v2 adding feedback_round and pr_number columns to runs table
- checkoutExistingBranch safely switches to existing PR branches for feedback iteration
- Feedback round counting prevents infinite iteration via maxFeedbackRounds config (default 3)
- 16 new tests added for pr-feedback module, 6 new tests for config/database/git-ops

## Task Commits

Each task was committed atomically:

1. **Task 1: Types, Schema, and Database Migration** - `550cdc7` (feat)
2. **Task 2: PR Feedback Module and checkoutExistingBranch** - `776fe3d` (feat)

## Files Created/Modified
- `src/runner/pr-feedback.ts` - PR feedback detection, thread extraction, round counting, PR commenting
- `src/runner/types.ts` - Added PRFeedbackContext, ReviewThread interfaces; "needs-human-review" RunStatus; feedbackRound/prNumber fields
- `src/core/types.ts` - Added maxFeedbackRounds to JobConfigSchema with default 3
- `src/core/database.ts` - Migration v2: feedback_round and pr_number columns on runs table
- `src/runner/git-ops.ts` - Added checkoutExistingBranch (fetch + checkout + reset --hard)
- `tests/runner/pr-feedback.test.ts` - 14 tests covering all pr-feedback functions
- `tests/core/config.test.ts` - 6 tests for maxFeedbackRounds validation
- `tests/core/database.test.ts` - 3 tests for migration v2 columns
- `tests/runner/git-ops.test.ts` - 2 tests for checkoutExistingBranch

## Decisions Made
- GraphQL query resolves owner/name via `gh repo view --json owner,name` rather than parsing git remote URL (simpler, works with any remote format)
- Bot comments filtered by `[bot]` suffix in author login to exclude CI/linter noise from feedback threads
- `checkPendingPRFeedback` returns null when max rounds exceeded (caller decides whether to set needs-human-review status)
- `maxFeedbackRounds` uses `.default(3).optional()` in Zod so the field always resolves to 3 when not specified

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed maxFeedbackRounds test expectation**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** Plan described test as "defaults to 3 when not provided" but test expected undefined. Zod `.default(3).optional()` applies the default, so the value is 3, not undefined.
- **Fix:** Updated test expectation from `toBeUndefined()` to `toBe(3)`. Also updated round-trip test to include `maxFeedbackRounds: 3` in expected config.
- **Files modified:** tests/core/config.test.ts
- **Verification:** All config tests pass
- **Committed in:** 550cdc7 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test expectation correction. No scope creep.

## Issues Encountered
None

## Known Stubs
None -- all data paths are fully wired. The pr-feedback module is a standalone detection layer; orchestrator integration happens in plan 09-02.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PR feedback detection foundation complete, ready for orchestrator integration (plan 09-02)
- checkoutExistingBranch ready for use in the feedback iteration flow
- Database schema v2 supports feedback round tracking
- All 422 tests pass (full suite, no regressions)

## Self-Check: PASSED

All created files exist. All commit hashes verified in git log.

---
*Phase: 09-pr-intelligence*
*Completed: 2026-03-21*
