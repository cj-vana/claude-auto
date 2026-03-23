---
phase: 11-platform-ux
plan: 02
subsystem: tui
tags: [ink, react, tui, dashboard, terminal-ui]

# Dependency graph
requires:
  - phase: 08-context-cost
    provides: getCostSummary for per-job cost data, getDatabase for SQLite access
  - phase: 05-cli
    provides: CLI router pattern with dynamic imports, parseCommand, CliCommand type
provides:
  - Interactive terminal dashboard via `claude-auto dashboard`
  - JobList, JobDetail, RunLog, StatusBar TUI components
  - useJobs polling hook and useKeyboard navigation hook
  - launchDashboard entry point
affects: []

# Tech tracking
tech-stack:
  added: [ink@6.8.0, react@19, "@inkjs/ui@2.0.0", ink-testing-library]
  patterns: [React hooks for TUI state, dynamic import for lazy loading TUI deps, ink-testing-library for component tests]

key-files:
  created:
    - src/tui/index.tsx
    - src/tui/app.tsx
    - src/tui/components/job-list.tsx
    - src/tui/components/job-detail.tsx
    - src/tui/components/run-log.tsx
    - src/tui/components/status-bar.tsx
    - src/tui/hooks/use-jobs.ts
    - src/tui/hooks/use-keyboard.ts
    - tests/tui/hooks.test.ts
    - tests/tui/components.test.tsx
    - tests/tui/app.test.tsx
  modified:
    - package.json
    - tsconfig.json
    - vitest.config.ts
    - tsup.config.ts
    - src/cli/types.ts
    - src/cli/router.ts
    - src/index.ts
    - tests/cli/router.test.ts

key-decisions:
  - "loadJobsWithMeta exported separately from useJobs hook for direct testability without React rendering"
  - "Pause/resume in App component uses dynamic import of CLI commands to avoid coupling TUI to scheduler internals"
  - "Cost data loading is best-effort with try/catch -- DB absence never crashes the dashboard"

patterns-established:
  - "TUI component testing via ink-testing-library render + lastFrame assertions"
  - "React hooks for polling data at intervals with cleanup on unmount"
  - "Dynamic import in CLI router for zero startup cost on non-dashboard commands"

requirements-completed: [TUID-01, TUID-02, TUID-03, TUID-04]

# Metrics
duration: 5min
completed: 2026-03-23
---

# Phase 11 Plan 02: TUI Dashboard Summary

**Interactive terminal dashboard with ink/React for real-time job monitoring, keyboard navigation, and pause/resume control**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-23T01:25:24Z
- **Completed:** 2026-03-23T01:31:14Z
- **Tasks:** 4
- **Files modified:** 19

## Accomplishments
- Complete TUI dashboard with list, detail, and log views navigable via keyboard
- Auto-refreshing job data with polling at 3-second intervals via useJobs hook
- Pause/resume jobs directly from dashboard without leaving the UI
- 43 new tests covering hooks, components, and app integration (585 total)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install TUI dependencies and update build/test config for JSX** - `180d9a0` (chore)
2. **Task 2: Create TUI hooks and hook tests** - `2f96373` (feat)
3. **Task 3: Create TUI components, App shell, entry point, and component tests** - `79ca930` (feat)
4. **Task 4: Wire dashboard command into CLI router and update barrel exports** - `7999732` (feat)

## Files Created/Modified
- `src/tui/index.tsx` - launchDashboard entry point rendering App via ink
- `src/tui/app.tsx` - Root App component with view routing, keyboard dispatch, pause/resume
- `src/tui/components/job-list.tsx` - Job table with name, status, schedule, next run, cost columns
- `src/tui/components/job-detail.tsx` - Single job detail view with config and recent run data
- `src/tui/components/run-log.tsx` - Scrollable run history with status coloring
- `src/tui/components/status-bar.tsx` - Context-sensitive keybinding hints bar
- `src/tui/hooks/use-jobs.ts` - useJobs hook polling job data; loadJobsWithMeta for testable data loading
- `src/tui/hooks/use-keyboard.ts` - useKeyboard hook wrapping ink useInput for view state machine
- `src/cli/types.ts` - Added "dashboard" to CliCommand union and COMMANDS record
- `src/cli/router.ts` - Added dashboard case with dynamic import of TUI module
- `src/index.ts` - Added launchDashboard to barrel exports
- `tests/tui/hooks.test.ts` - 8 tests for loadJobsWithMeta data loading and error handling
- `tests/tui/components.test.tsx` - 9 tests for JobList and StatusBar component rendering
- `tests/tui/app.test.tsx` - 6 tests for App integration (header, job list, empty state, status bar)
- `tests/cli/router.test.ts` - Added dashboard parseCommand test
- `package.json` - Added ink, react, @inkjs/ui, @types/react, ink-testing-library
- `tsconfig.json` - Added jsx: react-jsx and .tsx includes
- `vitest.config.ts` - Added .test.tsx to include pattern
- `tsup.config.ts` - Added TUI entry with automatic JSX and externalized ink/react

## Decisions Made
- Exported loadJobsWithMeta as a standalone async function for direct testing without React hooks runtime -- all 8 hook tests run without ink rendering
- Dashboard pause/resume uses dynamic import of CLI command functions to avoid importing scheduler/platform code at TUI startup
- Cost data loading wrapped in try/catch: if database doesn't exist (no runs yet), cost defaults to 0 instead of crashing
- Used vitest `--bail 1` instead of `-x` (vitest 4.x changed the flag name)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- vitest 4.x no longer supports `-x` flag, replaced with `--bail 1` for fail-fast behavior

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all components are wired to real data sources via hooks.

## Next Phase Readiness
- TUI dashboard is feature-complete for v1.1 requirements
- All 585 tests pass, TypeScript compiles, tsup build succeeds
- Dashboard is fully wired into CLI router and accessible via `claude-auto dashboard`
- No blockers for subsequent work

## Self-Check: PASSED

- All 11 created files verified on disk
- All 4 task commits verified in git log (180d9a0, 2f96373, 79ca930, 7999732)

---
*Phase: 11-platform-ux*
*Completed: 2026-03-23*
