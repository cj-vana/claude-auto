# Roadmap: Claude Auto

## Milestones

- [x] **v1.0 MVP** - Phases 1-7 (shipped 2026-03-21)
- [ ] **v1.1 Intelligence & Platform** - Phases 8-11 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>v1.0 MVP (Phases 1-7) - SHIPPED 2026-03-21</summary>

- [x] **Phase 1: Foundation & Config** - Project scaffold, shared types, config schema, YAML job storage
- [x] **Phase 2: Platform Scheduling** - System crontab/launchd registration with schedule parsing and environment capture
- [x] **Phase 3: Run Orchestrator & Git Safety** - Core execution engine: Claude spawning, git workflow, safety infrastructure, run logging
- [x] **Phase 4: Notifications** - Webhook notifications to Discord/Slack/Telegram with configurable triggers
- [x] **Phase 5: Job Management CLI** - User-facing CLI for listing, pausing, resuming, editing, and removing jobs
- [x] **Phase 6: Plugin & Skills** - Claude Code plugin with conversational setup wizard, system prompt crafting, and npm distribution
- [x] **Phase 7: Polish & Tech Debt** - Wire --restrict-paths CLI flag, implement --json list output, add enabled check in orchestrator

</details>

### v1.1 Intelligence & Platform

**Milestone Goal:** Make Claude a smarter, more capable autonomous contributor -- cross-run memory, agent teams, PR iteration, cost awareness, and broader platform support.

- [ ] **Phase 8: Foundation** - SQLite persistence layer, model selection per job, and cost tracking with budget enforcement
- [ ] **Phase 9: PR Intelligence** - PR feedback loop for iterating on review comments and smarter issue triage
- [ ] **Phase 10: Agent Pipeline** - Multi-stage plan/implement/review pipeline and merge conflict resolution
- [ ] **Phase 11: Platform & UX** - Windows Task Scheduler support and interactive TUI dashboard

## Phase Details

<details>
<summary>v1.0 MVP Phase Details (Phases 1-7) - SHIPPED 2026-03-21</summary>

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
- [x] 05-02-PLAN.md -- Pause, resume, remove, edit commands, barrel export update

### Phase 6: Plugin & Skills
**Goal**: Users install claude-auto via npm and set up autonomous jobs through a guided conversation with Claude -- the core differentiator
**Depends on**: Phase 5
**Requirements**: DIST-01, DIST-02, SETUP-01, SETUP-04, SETUP-05
**Success Criteria** (what must be TRUE):
  1. Running npm install -g claude-auto registers the package as a Claude Code plugin with slash commands available in Claude Code sessions
  2. The setup wizard guides users through repo selection, branch, schedule, focus areas, and system prompt in a natural conversation -- producing a valid job config and registered schedule
  3. Claude helps the user craft a system prompt with personality, coding style, focus areas, and exclusions -- not just accepting raw text
  4. If the target repo is not cloned locally, the tool clones it automatically via gh before proceeding
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md -- CLI create and check-repo commands with router integration and tests
- [x] 06-02-PLAN.md -- Plugin manifest, 8 skill files, postinstall/preuninstall scripts, package.json distribution config

### Phase 7: Polish & Tech Debt
**Goal**: Close all remaining tech debt from milestone audit -- wire missing CLI flags, implement JSON output, add defense-in-depth enabled check
**Depends on**: Phase 6
**Requirements**: SAFE-03, JOB-01
**Success Criteria** (what must be TRUE):
  1. Running `claude-auto create --restrict-paths src/,tests/` correctly sets restrictToPaths in job config
  2. Running `claude-auto list --json` produces valid JSON output parseable by skills
  3. Running `claude-auto-run --job-id <paused-id>` exits early with "job is paused" message
**Plans**: 1 plan

Plans:
- [x] 07-01-PLAN.md -- Wire --restrict-paths CLI flag, implement --json list output, add config.enabled orchestrator check

</details>

### Phase 8: Foundation
**Goal**: Every job has persistent cross-run memory, configurable model selection, and cost visibility with budget enforcement -- the infrastructure that all intelligence features depend on
**Depends on**: Phase 7 (v1.0 complete)
**Requirements**: MODL-01, MODL-02, MODL-03, CTXT-01, CTXT-02, CTXT-03, COST-01, COST-02, COST-03, COST-04
**Success Criteria** (what must be TRUE):
  1. User can set `model: opus` in a job config and Claude spawns with that model; changing to `sonnet` uses Sonnet on the next run
  2. After multiple runs on the same job, Claude avoids re-opening issues it already submitted PRs for in previous runs
  3. Running `claude-auto cost` shows per-job token usage and dollar cost broken down by run, with totals
  4. A job with a daily budget cap of $5 skips its scheduled run and sends a "budget exceeded" notification when the cap is reached
  5. Cross-run context persists in a local SQLite database that survives across sessions
**Plans**: 3 plans

Plans:
- [x] 08-01-PLAN.md -- Model selection schema + spawner --model flag + budget schema
- [x] 08-02-PLAN.md -- SQLite persistence layer + cross-run context store + prompt context injection
- [x] 08-03-PLAN.md -- Cost tracking CLI command + budget enforcement + orchestrator integration

### Phase 9: PR Intelligence
**Goal**: Claude autonomously iterates on its own PRs based on reviewer feedback and picks work it can actually complete by scoring issue complexity
**Depends on**: Phase 8
**Requirements**: PRFB-01, PRFB-02, PRFB-03, PRFB-04, TRIG-01, TRIG-02, TRIG-03
**Success Criteria** (what must be TRUE):
  1. When a reviewer leaves comments on a Claude-created PR, the next run checks out that PR branch and addresses the feedback instead of picking new work
  2. After addressing review comments, Claude pushes to the same branch and posts a PR comment summarizing what changed
  3. PR feedback iteration stops after the configured max rounds (default 3) and the PR is flagged for human review
  4. Claude skips issues that are too vague, look like spam, or require human decisions -- and logs why it skipped them
  5. Issues labeled "good first issue" or "bug" are picked before unlabeled issues
**Plans**: 3 plans

Plans:
- [x] 09-01-PLAN.md -- PR feedback types, schema, DB migration, pr-feedback module, checkoutExistingBranch
- [x] 09-02-PLAN.md -- Issue triage module with scoring, filtering, and label priority
- [x] 09-03-PLAN.md -- Orchestrator integration wiring PR feedback priority and triage into run cycle

### Phase 10: Agent Pipeline
**Goal**: Users can enable a multi-stage plan/implement/review pipeline that produces higher-quality PRs through built-in self-review, and Claude handles diverged branches automatically
**Depends on**: Phase 9
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04, MRGC-01, MRGC-02, MRGC-03
**Success Criteria** (what must be TRUE):
  1. User enables `pipeline: true` in job config and each run executes three stages (plan, implement, review) with separate Claude instances
  2. Each pipeline stage uses its configured model (e.g., Haiku for planning, Opus for implementation, Sonnet for review)
  3. The review stage catches issues in the implementation and requests changes before a PR is created -- not every run produces a PR
  4. When a PR branch has diverged from the target branch, Claude attempts to rebase and resolve conflicts before starting new work
  5. If merge conflict resolution fails, the run logs the failure clearly and notifies the user instead of silently producing broken code
**Plans**: TBD

Plans:
- [ ] 10-01: TBD
- [ ] 10-02: TBD

### Phase 11: Platform & UX
**Goal**: Claude Auto runs on Windows via Task Scheduler and users can monitor all jobs through an interactive terminal dashboard
**Depends on**: Phase 8 (reads cost/context data; independent of Phases 9-10)
**Requirements**: WNDW-01, WNDW-02, WNDW-03, WNDW-04, TUID-01, TUID-02, TUID-03, TUID-04
**Success Criteria** (what must be TRUE):
  1. Running `claude-auto create` on Windows registers the job with Task Scheduler and it fires on schedule
  2. Removing a job on Windows cleanly deletes the Task Scheduler entry with no orphaned tasks
  3. Cron expressions like "0 */6 * * *" are correctly translated to Task Scheduler trigger schedules
  4. Running `claude-auto dashboard` launches an interactive terminal UI showing all jobs with status, last run, next run, and cost summary
  5. User can pause, resume, and view logs for any job directly from the dashboard using keyboard navigation
**Plans**: TBD

Plans:
- [ ] 11-01: TBD
- [ ] 11-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 8 -> 9 -> 10 -> 11 (Phase 11 can begin after Phase 8 if needed)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation & Config | v1.0 | 2/2 | Complete | 2026-03-21 |
| 2. Platform Scheduling | v1.0 | 2/2 | Complete | 2026-03-21 |
| 3. Run Orchestrator & Git Safety | v1.0 | 3/3 | Complete | 2026-03-21 |
| 4. Notifications | v1.0 | 2/2 | Complete | 2026-03-21 |
| 5. Job Management CLI | v1.0 | 2/2 | Complete | 2026-03-21 |
| 6. Plugin & Skills | v1.0 | 2/2 | Complete | 2026-03-21 |
| 7. Polish & Tech Debt | v1.0 | 1/1 | Complete | 2026-03-21 |
| 8. Foundation | v1.1 | 0/3 | Planned | - |
| 9. PR Intelligence | v1.1 | 0/3 | Planned | - |
| 10. Agent Pipeline | v1.1 | 0/? | Not started | - |
| 11. Platform & UX | v1.1 | 0/? | Not started | - |
