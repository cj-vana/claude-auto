---
phase: 08-foundation
plan: 02
subsystem: core, runner
tags: [sqlite, better-sqlite3, persistence, context-store, dual-write, prompt-builder]

# Dependency graph
requires:
  - phase: 08-01
    provides: RunResult.model field, budget-exceeded RunStatus, SpawnOptions.model
provides:
  - SQLite database singleton (getDatabase, closeDatabase) with WAL mode and runs table
  - context-store (saveRunContext, loadRunContext, formatContextWindow)
  - Dual-write logger (JSON + SQLite) for run persistence
  - buildWorkPrompt context injection via optional RunContext[] parameter
  - Barrel exports for database and context-store modules
affects: [08-03 (cost tracking queries against runs table), 09-pr-feedback, 10-agent-teams, 11-tui-dashboard]

# Tech tracking
tech-stack:
  added:
    - better-sqlite3 ^12.8.0
    - "@types/better-sqlite3" (dev)
  patterns:
    - Database singleton with lazy initialization and optional path override for testing
    - user_version pragma for schema migrations
    - WAL mode + synchronous=normal for concurrent read safety
    - Dual-write (JSON + SQLite) with best-effort DB writes
    - Structured context injection (verifiable facts only, no narrative summaries)

key-files:
  created:
    - src/core/database.ts
    - src/runner/context-store.ts
    - tests/core/database.test.ts
    - tests/runner/context-store.test.ts
  modified:
    - package.json
    - package-lock.json
    - src/util/paths.ts
    - src/runner/logger.ts
    - src/runner/prompt-builder.ts
    - src/index.ts
    - tests/runner/prompt-builder.test.ts

decisions:
  - "Database singleton with optional dbPath parameter for testability (in-memory databases in tests)"
  - "Model column set to null in saveRunContext until RunLogEntry gains model field (forward-compatible)"
  - "formatContextWindow excludes raw summary text to prevent hallucination amplification (structured facts only)"
  - "Dual-write is best-effort: SQLite failure never blocks the JSON file write or the run itself"

metrics:
  duration: 3m 34s
  completed: "2026-03-21T22:25:47Z"
  tasks: 2/2
  tests_added: 22
  files_created: 4
  files_modified: 7
---

# Phase 08 Plan 02: SQLite Persistence & Cross-Run Context Summary

SQLite persistence layer with better-sqlite3, dual-write logger, context-store for cross-run deduplication, and prompt builder context injection via structured verifiable facts (issue numbers, PR URLs, branch names).

## What Was Done

### Task 1: Database Singleton + Context Store (267d7f3)

Installed better-sqlite3 and created the database singleton module (`src/core/database.ts`) with:
- WAL mode, synchronous=normal, foreign_keys=ON pragmas
- `runs` table with 16 columns covering all RunResult fields plus model and created_at
- 3 indexes (job_id, started_at, composite job_id+started_at)
- Schema migration via user_version pragma (version 1)
- Optional dbPath parameter for test isolation (`:memory:` databases)

Created `src/runner/context-store.ts` with:
- `saveRunContext()` -- inserts RunLogEntry into runs table with camelCase-to-snake_case mapping
- `loadRunContext()` -- queries last N runs (default 5) filtered to success/no-changes status
- `formatContextWindow()` -- produces structured "Previous Work (DO NOT duplicate)" prompt section with issue numbers, PR URLs, and branch names only (no narrative summaries)
- `RunContext` interface exported for type-safe consumption

Added `database` path to `src/util/paths.ts`.

Tests: 9 database tests + 8 context-store tests = 17 new tests.

### Task 2: Dual-Write Logger + Context Injection + Barrel Exports (1f7b625)

Modified `src/runner/logger.ts` to dual-write: after the existing JSON file write, `saveRunContext(entry)` is called in a try/catch (best-effort -- never fails the run).

Extended `buildWorkPrompt()` in `src/runner/prompt-builder.ts` with optional `RunContext[]` parameter. When non-empty context is provided, appends a "Previous Work (DO NOT duplicate)" section. When omitted or empty, behavior is identical to v1.0 (backward compatible).

Updated `src/index.ts` barrel exports with `getDatabase`, `closeDatabase`, `loadRunContext`, `saveRunContext`, `formatContextWindow`, and `RunContext` type.

Tests: 5 new context window injection tests in prompt-builder.test.ts.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- All 355 tests pass (29 test files, 22 new tests added)
- TypeScript compilation clean (`tsc --noEmit` -- no errors)
- All acceptance criteria verified via grep checks
- better-sqlite3 confirmed in package.json dependencies

## Known Stubs

None -- all data paths are fully wired. The `model` column in saveRunContext is set to `null` because RunLogEntry does not yet have a `model` field; this is intentional and will be populated once the orchestrator passes model info through (Plan 08-01 added RunResult.model, but RunLogEntry extends RunResult so it will flow through automatically once the orchestrator sets it).

## Self-Check: PASSED

All created files exist. All commit hashes verified in git log.
