---
phase: 03-run-orchestrator-git-safety
plan: 01
subsystem: runner
tags: [proper-lockfile, git, gh, file-locking, branch-management, exec]

# Dependency graph
requires:
  - phase: 01-config-and-storage
    provides: paths utility (jobDir, jobLock), errors pattern, exec utility
provides:
  - RunResult, RunLogEntry, SpawnOptions, SpawnResult types for runner pipeline
  - File-based locking with 45min stale threshold via proper-lockfile
  - Git operations pipeline (pullLatest, createBranch, hasChanges, pushBranch, createPR)
  - GitOpsError, LockError, SpawnError error classes
  - execCommand cwd option for gh CLI support
affects: [03-run-orchestrator-git-safety]

# Tech tracking
tech-stack:
  added: [proper-lockfile@4.1.2, "@types/proper-lockfile@4.1.4"]
  patterns: [file-based locking with stale detection, git-ops via execCommand, no-force-push enforcement]

key-files:
  created:
    - src/runner/types.ts
    - src/runner/lock.ts
    - src/runner/git-ops.ts
    - tests/runner/lock.test.ts
    - tests/runner/git-ops.test.ts
  modified:
    - src/util/errors.ts
    - src/util/exec.ts
    - package.json

key-decisions:
  - "Used proper-lockfile default import with retries:0 for immediate fail-fast on lock contention"
  - "GIT-03 compliance verified via source-code grep test (no --force string anywhere in git-ops.ts)"
  - "Extended execCommand with cwd option rather than creating separate exec helper for gh commands"
  - "Lock targets jobDir (directory) not jobLock file, matching proper-lockfile's mkdir-based locking"

patterns-established:
  - "GitOpsError wrapping: all git/gh operations catch errors and rethrow as GitOpsError with operation name, repoPath, and cause"
  - "Source-code grep tests for safety invariants (no --force in git-ops source)"
  - "Lock returns null on contention (never throws) for simple conditional flow"

requirements-completed: [GIT-01, GIT-02, GIT-03, GIT-04, GIT-05]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 3 Plan 1: Runner Foundation Summary

**File-based locking via proper-lockfile with 45min stale threshold, git branch lifecycle (pull/branch/push/PR) via execCommand, and runner type definitions**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T19:34:54Z
- **Completed:** 2026-03-21T19:38:16Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 9

## Accomplishments
- Installed proper-lockfile for cross-process file-based locking with stale detection
- Created runner types (SpawnOptions, SpawnResult, RunResult, RunLogEntry, RunStatus) for the full run pipeline
- Built git-ops module with 5 functions covering complete branch lifecycle, zero --force flags
- Added GitOpsError, LockError, SpawnError error classes following existing error pattern
- Extended execCommand with cwd option for gh pr create support
- 21 tests all passing including GIT-03 source-code compliance grep

## Task Commits

Each task was committed atomically (TDD flow):

1. **Task 1 RED: Failing tests for lock and git-ops** - `383ff06` (test)
2. **Task 1 GREEN: Implement lock, git-ops, exec cwd, types, errors** - `2a58082` (feat)

_TDD task: RED wrote failing tests, GREEN implemented to pass all 21 tests._

## Files Created/Modified
- `src/runner/types.ts` - SpawnOptions, SpawnResult, RunResult, RunLogEntry, RunStatus types
- `src/runner/lock.ts` - acquireLock with proper-lockfile, STALE_THRESHOLD (45min)
- `src/runner/git-ops.ts` - pullLatest, createBranch, hasChanges, pushBranch, createPR
- `src/util/errors.ts` - Added GitOpsError, LockError, SpawnError classes
- `src/util/exec.ts` - Added cwd option to execCommand
- `tests/runner/lock.test.ts` - 6 tests: acquire, release, contention, stale threshold, directory creation
- `tests/runner/git-ops.test.ts` - 15 tests: all 5 functions + error wrapping + GIT-03 compliance
- `package.json` - Added proper-lockfile dependency
- `package-lock.json` - Updated lockfile

## Decisions Made
- Used proper-lockfile default import with `retries: 0` for immediate fail-fast on lock contention (no retry loops)
- Lock targets `paths.jobDir(jobId)` directory (not the `.lock` file) because proper-lockfile uses mkdir-based locking on directories
- Extended existing `execCommand` with `cwd` option rather than creating a separate utility, keeping the API surface minimal
- GIT-03 compliance enforced structurally: the source code of git-ops.ts never contains the string `--force`, verified by a test that greps the actual source file

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed --force mention from source comment to pass GIT-03 compliance test**
- **Found during:** Task 1 GREEN phase
- **Issue:** The JSDoc comment on pushBranch said "Never includes --force, -f, or --force-with-lease" which matched the source-code grep test for `--force`
- **Fix:** Rewrote comment to "Safety: only uses -u flag, no destructive push flags" which documents the intent without containing the forbidden string
- **Files modified:** src/runner/git-ops.ts
- **Verification:** GIT-03 compliance tests pass (source grep for --force returns 0 matches)
- **Committed in:** 2a58082 (GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor comment wording change. No scope creep.

## Issues Encountered
None -- plan executed cleanly. The parallel agent's test failures for spawner.test.ts and prompt-builder.test.ts are out of scope (Plan 03-02).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Runner types, lock, and git-ops are ready for Plan 02 (spawner + prompt-builder) and Plan 03 (orchestrator) to import
- All exports are properly typed and tested
- The execCommand cwd enhancement enables gh CLI operations in target repo directories

---
*Phase: 03-run-orchestrator-git-safety*
*Completed: 2026-03-21*
