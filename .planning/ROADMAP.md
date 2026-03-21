# Roadmap: Claude Auto

## Overview

Claude Auto delivers autonomous codebase improvement through scheduled headless Claude Code sessions. The build progresses from config infrastructure through the core execution engine, then layers on notifications, management CLI, and finally the conversational skill interface that ties everything together as an installable npm package. Each phase delivers a coherent, testable capability that the next phase depends on.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Config** - Project scaffold, shared types, config schema, YAML job storage
- [ ] **Phase 2: Platform Scheduling** - System crontab/launchd registration with schedule parsing and environment capture
- [ ] **Phase 3: Run Orchestrator & Git Safety** - Core execution engine: Claude spawning, git workflow, safety infrastructure, run logging
- [ ] **Phase 4: Notifications** - Webhook notifications to Discord/Slack/Telegram with configurable triggers
- [ ] **Phase 5: Job Management CLI** - User-facing CLI for listing, pausing, resuming, editing, and removing jobs
- [ ] **Phase 6: Plugin & Skills** - Claude Code plugin with conversational setup wizard, system prompt crafting, and npm distribution

## Phase Details

### Phase 1: Foundation & Config
**Goal**: Developers have a working TypeScript project with a validated config system that all other components build on
**Depends on**: Nothing (first phase)
**Requirements**: SETUP-02
**Success Criteria** (what must be TRUE):
  1. A job config can be created, read, updated, and deleted as a YAML file under ~/.claude-auto/jobs/<job-id>/
  2. Invalid config files produce clear validation errors (via Zod schema) rather than silent failures
  3. Config files are human-readable and hand-editable with correct round-trip preservation
  4. TypeScript project builds, lints, and passes tests with ESM module resolution
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md -- Project scaffold, shared types, utilities, and barrel export
- [x] 01-02-PLAN.md -- Config system, job manager CRUD, comprehensive test suite

### Phase 2: Platform Scheduling
**Goal**: Jobs can be registered with and removed from the operating system's native scheduler on both macOS and Linux
**Depends on**: Phase 1
**Requirements**: SCHED-01, SCHED-02, SCHED-03, SETUP-03
**Success Criteria** (what must be TRUE):
  1. A job registered on Linux appears in crontab -l with the correct schedule and environment variables
  2. A job registered on macOS creates a launchd plist that launchctl can load and that fires on schedule
  3. Natural language schedule input ("every 6 hours", "twice a day") is normalized to valid cron expressions with human-readable confirmation
  4. Schedules respect the user's configured IANA timezone (a job set for 9am fires at 9am local time)
  5. Removing a job cleanly deregisters it from crontab/launchd with no orphaned entries
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md -- Schedule module: cron validation, timezone-aware next runs, human-readable descriptions, dependency install
- [x] 02-02-PLAN.md -- Platform schedulers: Scheduler interface, CrontabScheduler (Linux), LaunchdScheduler (macOS), barrel export

### Phase 3: Run Orchestrator & Git Safety
**Goal**: A scheduled cron tick executes a complete autonomous work cycle -- research, pick work, implement, commit, PR -- with all safety guarantees enforced
**Depends on**: Phase 2
**Requirements**: EXEC-01, EXEC-02, EXEC-03, EXEC-04, EXEC-05, EXEC-06, GIT-01, GIT-02, GIT-03, GIT-04, GIT-05, SAFE-01, SAFE-02, SAFE-03, REPT-01
**Success Criteria** (what must be TRUE):
  1. A cron-triggered run spawns Claude Code in headless mode, researches the codebase, picks work from the priority chain (issues > bugs > improvements), and produces a PR with a detailed description
  2. Every run creates a new descriptively-named branch; the configured branch and main are never committed to directly; force push never occurs
  3. Concurrent runs of the same job are prevented by file-based locking (second invocation exits cleanly)
  4. A runaway Claude session is terminated after the configured max turns limit is reached
  5. Each completed run produces an append-only local log with start time, duration, what was attempted, PR URL, and any errors
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md -- Runner foundation: types, file-based locking, git operations (pull/branch/push/PR)
- [x] 03-02-PLAN.md -- Claude spawner, prompt builder (priority chain/guardrails), run logger
- [x] 03-03-PLAN.md -- Orchestrator (wires all runner modules), cron entry point, barrel export update

### Phase 4: Notifications
**Goal**: Users are informed about autonomous run outcomes through their preferred messaging platform
**Depends on**: Phase 3
**Requirements**: NOTF-01, NOTF-02, NOTF-03
**Success Criteria** (what must be TRUE):
  1. A PR creation event sends a formatted webhook notification to a configured Discord, Slack, or Telegram channel with the PR link and summary
  2. When Claude works on a GitHub issue, a comment is posted to that issue with status and PR link
  3. Users can configure which events trigger notifications (PR created, error, nothing found, run skipped) and only those events fire
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md -- Notification types, provider formatters (Discord/Slack/Telegram), webhook dispatcher, GitHub issue commenting
- [x] 04-02-PLAN.md -- Schema extension for event triggers, orchestrator integration, barrel export update

### Phase 5: Job Management CLI
**Goal**: Users can manage all their autonomous jobs from the command line without editing files or touching cron directly
**Depends on**: Phase 3
**Requirements**: JOB-01, JOB-02, JOB-03, JOB-04, JOB-05, REPT-02
**Success Criteria** (what must be TRUE):
  1. Running claude-auto list shows all jobs with status (active/paused), repo, schedule, last run time, and next run time
  2. A paused job stops executing on schedule but retains its full configuration; resuming it re-registers with the scheduler and it fires on the next scheduled tick
  3. A removed job cleans up its cron/launchd entry, and optionally its config and logs
  4. Multiple jobs can target different repos or different focuses on the same repo, each running on independent schedules
  5. Run summary reports show what was analyzed, attempted, and produced across recent runs
**Plans**: 2 plans

Plans:
- [x] 05-01-PLAN.md -- CLI framework (router, types, formatting), list/logs/report commands
- [ ] 05-02-PLAN.md -- Pause, resume, remove, edit commands, barrel export update

### Phase 6: Plugin & Skills
**Goal**: Users install claude-auto via npm and set up autonomous jobs through a guided conversation with Claude -- the core differentiator
**Depends on**: Phase 5
**Requirements**: DIST-01, DIST-02, SETUP-01, SETUP-04, SETUP-05
**Success Criteria** (what must be TRUE):
  1. Running npm install -g claude-auto registers the package as a Claude Code plugin with slash commands available in Claude Code sessions
  2. The setup wizard guides users through repo selection, branch, schedule, focus areas, and system prompt in a natural conversation -- producing a valid job config and registered schedule
  3. Claude helps the user craft a system prompt with personality, coding style, focus areas, and exclusions -- not just accepting raw text
  4. If the target repo is not cloned locally, the tool clones it automatically via gh before proceeding
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Config | 2/2 | Complete | 2026-03-21 |
| 2. Platform Scheduling | 0/2 | Planning complete | - |
| 3. Run Orchestrator & Git Safety | 0/3 | Planning complete | - |
| 4. Notifications | 1/2 | In Progress|  |
| 5. Job Management CLI | 1/2 | In Progress|  |
| 6. Plugin & Skills | 0/0 | Not started | - |
