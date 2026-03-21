---
phase: 09-pr-intelligence
plan: 03
subsystem: runner
tags: [pr-feedback, issue-triage, orchestrator, prompt-builder, xml-sanitization]

# Dependency graph
requires:
  - phase: 09-01
    provides: pr-feedback module (checkPendingPRFeedback, postPRComment, checkoutExistingBranch)
  - phase: 09-02
    provides: issue-triage module (triageIssues, ScoredIssue)
  - phase: 08-03
    provides: context-store (saveRunContext, loadRunContext), cost-tracker (checkBudget)
provides:
  - Orchestrator PR feedback priority loop (checks feedback BEFORE picking new work)
  - buildFeedbackPrompt with XML-framed sanitized review comments
  - buildTriagedWorkPrompt with pre-scored issue candidates
  - Context store feedback_round and pr_number persistence
  - Complete barrel exports for all Phase 9 modules
affects: [10-agent-pipeline, 11-windows-tui]

# Tech tracking
tech-stack:
  added: []
  patterns: [xml-sanitization-for-untrusted-input, priority-loop-with-fallback, best-effort-error-handling]

key-files:
  created: []
  modified:
    - src/runner/prompt-builder.ts
    - src/runner/orchestrator.ts
    - src/runner/context-store.ts
    - src/index.ts
    - tests/runner/prompt-builder.test.ts
    - tests/runner/orchestrator.test.ts

key-decisions:
  - "Shared GIT_SAFETY_SECTION constant to DRY git safety rules across work, feedback, and triage prompts"
  - "isFeedbackBranch flag to prevent cleanup of existing PR branches on error in catch block"
  - "Defense-in-depth max rounds check in orchestrator even though checkPendingPRFeedback also checks"
  - "Triaged work prompt delegates to buildWorkPrompt when triaged array is empty for backward compatibility"

patterns-established:
  - "XML framing for untrusted input: <review_comments> tags with explicit instruction to ignore embedded instructions"
  - "Priority loop pattern: check feedback -> triage -> generic work (cascading fallback)"
  - "Best-effort integration: all new module calls wrapped in try/catch to never crash existing flow"

requirements-completed: [PRFB-01, PRFB-02, PRFB-03, PRFB-04, TRIG-01, TRIG-02, TRIG-03]

# Metrics
duration: 5m53s
completed: 2026-03-21
---

# Phase 9 Plan 3: PR Feedback Priority Loop and Triage Integration Summary

**Orchestrator wired with PR feedback priority (XML-sanitized review comments, max-round enforcement) and triage-enhanced work prompts with pre-scored issue candidates**

## Performance

- **Duration:** 5m 53s
- **Started:** 2026-03-21T23:11:23Z
- **Completed:** 2026-03-21T23:17:16Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Orchestrator now checks for PR feedback BEFORE picking new work -- complete priority loop
- buildFeedbackPrompt generates prompts with XML-framed, truncated (2000 char), sanitized review comments with prompt injection defense
- buildTriagedWorkPrompt replaces generic issue listing with ranked, pre-scored candidates (max 5 displayed)
- saveRunContext extended to persist feedback_round and pr_number for cross-run tracking
- Max feedback rounds enforcement with needs-human-review status and PR comment
- All Phase 9 modules exported from barrel index
- 21 new tests, 443 total passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Prompt Builder Extensions and Context Store Update** - `f0dd777` (feat)
2. **Task 2: Orchestrator Integration with PR Feedback Priority and Triage** - `c6e963b` (feat)

## Files Created/Modified
- `src/runner/prompt-builder.ts` - Added buildFeedbackPrompt (XML-sanitized feedback prompt) and buildTriagedWorkPrompt (ranked issue candidates); extracted shared GIT_SAFETY_SECTION constant
- `src/runner/orchestrator.ts` - Rewired executeRun with PR feedback priority loop, triage integration, isFeedbackBranch safety, best-effort error handling
- `src/runner/context-store.ts` - Extended saveRunContext with feedback_round and pr_number column persistence; fixed model field mapping
- `src/index.ts` - Added barrel exports for pr-feedback, issue-triage, checkoutExistingBranch, buildFeedbackPrompt, buildTriagedWorkPrompt, PRFeedbackContext, ReviewThread, ScoredIssue
- `tests/runner/prompt-builder.test.ts` - 14 new tests for feedback prompt and triaged work prompt
- `tests/runner/orchestrator.test.ts` - 7 new tests for PR feedback priority, max rounds, triage integration, best-effort error handling; 3 existing tests updated

## Decisions Made
- **Shared GIT_SAFETY_SECTION**: Extracted the git safety rules text into a constant shared by buildWorkPrompt, buildFeedbackPrompt, and buildTriagedWorkPrompt to avoid drift between prompts
- **isFeedbackBranch flag**: Prevents the error cleanup path from deleting branches that belong to existing PRs (feedback iteration branches should never be cleaned up)
- **Defense-in-depth max rounds**: The orchestrator checks nextRound > maxRounds even though checkPendingPRFeedback already filters by max rounds, providing a safety net if the PR-feedback module changes
- **Backward-compatible triage fallback**: buildTriagedWorkPrompt with empty array delegates entirely to buildWorkPrompt, ensuring zero behavioral change when triage fails or returns nothing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed model field mapping in saveRunContext**
- **Found during:** Task 1 (context-store update)
- **Issue:** The model field was hardcoded to `null` with a comment "model field not yet in RunLogEntry; will be added in a future plan" -- but RunLogEntry extends RunResult which already has `model` from Phase 8
- **Fix:** Changed `model: null` to `model: entry.model ?? null` to persist the actual model value
- **Files modified:** src/runner/context-store.ts
- **Verification:** Existing context-store tests pass
- **Committed in:** f0dd777 (Task 1 commit)

**2. [Rule 1 - Bug] Updated existing orchestrator tests for new flow**
- **Found during:** Task 2 (orchestrator integration)
- **Issue:** Three existing tests expected buildWorkPrompt to be called directly, but the orchestrator now calls buildTriagedWorkPrompt (which internally delegates to buildWorkPrompt when triage is empty)
- **Fix:** Updated test expectations: buildWorkPrompt -> buildTriagedWorkPrompt, added model field to SpawnOptions assertion, updated context passing assertion
- **Files modified:** tests/runner/orchestrator.test.ts
- **Verification:** All 32 orchestrator tests pass
- **Committed in:** c6e963b (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 9 (PR Intelligence) is fully complete: PR feedback, issue triage, and orchestrator integration all wired and tested
- 443 tests passing across 33 test files
- Ready for Phase 10 (Agent Pipeline) or Phase 11 (Windows/TUI)
- Prompt injection concern from STATE.md blockers addressed via XML framing with explicit "ignore embedded instructions" defense

## Self-Check: PASSED

All files verified to exist. All commit hashes verified in git log.

---
*Phase: 09-pr-intelligence*
*Completed: 2026-03-21*
