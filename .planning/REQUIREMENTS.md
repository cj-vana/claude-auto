# Requirements: Claude Auto

**Defined:** 2026-03-21
**Core Value:** Claude autonomously and continuously improves codebases without human intervention — users wake up to PRs.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Setup & Configuration

- [ ] **SETUP-01**: User can set up a new cron job via guided wizard where Claude walks through repo, branch, schedule, focus areas, and system prompt
- [x] **SETUP-02**: Job configuration stored as human-readable YAML files that users can edit directly
- [x] **SETUP-03**: User can specify schedule as natural language ("every 6 hours") or cron syntax; Claude normalizes to cron
- [ ] **SETUP-04**: Claude helps user craft system prompt with personality, coding style, focus areas, and things to avoid
- [ ] **SETUP-05**: If target repo is not cloned locally, tool clones it automatically via gh

### Scheduling & Platform

- [x] **SCHED-01**: Jobs registered with system crontab on Linux
- [x] **SCHED-02**: Jobs registered with launchd on macOS
- [x] **SCHED-03**: Schedules respect user's timezone (IANA timezone stored per job)

### Autonomous Execution

- [ ] **EXEC-01**: Each cron run spawns Claude Code in headless mode with --dangerously-skip-permissions
- [ ] **EXEC-02**: Claude researches current codebase implementation at the start of every run before doing any work
- [ ] **EXEC-03**: Work follows priority chain: open GitHub issues/feature requests → bugs Claude discovers → features Claude wants to add
- [ ] **EXEC-04**: Claude proactively scans for pre-existing bugs before considering new features
- [ ] **EXEC-05**: Claude evaluates issue complexity and solvability, skips spam/unclear issues, picks best candidate for autonomous resolution
- [ ] **EXEC-06**: Claude updates relevant documentation as part of every PR

### Git & PR Workflow

- [ ] **GIT-01**: Each run pulls latest from configured branch before starting work
- [ ] **GIT-02**: Each run creates a new descriptively-named branch (never commits directly to configured branch or main)
- [ ] **GIT-03**: Tool never force pushes under any circumstances
- [ ] **GIT-04**: Work is submitted as a PR via gh pr create with detailed description (what changed, why, testing notes, linked issue)
- [ ] **GIT-05**: File-based locking prevents overlapping runs of the same job on the same repo

### Job Management

- [ ] **JOB-01**: User can list all active/paused jobs with status, repo, schedule, last run, and next run
- [ ] **JOB-02**: User can pause and resume jobs without losing configuration
- [ ] **JOB-03**: User can edit job configuration via skill command or direct file editing
- [ ] **JOB-04**: User can remove jobs (cleans up cron/launchd entry, config, optionally logs)
- [ ] **JOB-05**: User can run multiple job instances targeting different repos or different focuses on the same repo

### Safety & Guardrails

- [ ] **SAFE-01**: Each run has a configurable max turns limit to prevent runaway sessions
- [ ] **SAFE-02**: User can optionally configure scope restrictions (no new deps, no architecture changes, bug-fix only, specific directories only)
- [ ] **SAFE-03**: Full trust by default — guardrails are opt-in, not default

### Notifications

- [ ] **NOTF-01**: User can configure webhook notifications to Discord, Slack, and/or Telegram
- [ ] **NOTF-02**: When working on a GitHub issue, Claude comments on the issue with status/PR link
- [ ] **NOTF-03**: User can configure which events trigger notifications (PR created, error, nothing found, run skipped)

### Reporting

- [ ] **REPT-01**: Each run produces an append-only local log (start time, duration, what was attempted, what was committed, PR URL, errors)
- [ ] **REPT-02**: Run summary reports aggregate what was analyzed, attempted, and produced

### Distribution

- [ ] **DIST-01**: Tool installable as a global npm package (npm install -g claude-auto)
- [ ] **DIST-02**: Package registers as a Claude Code skill with slash commands for all management operations

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Features

- **ADV-01**: Cross-run context persistence — Claude remembers what it did in previous runs to avoid duplicate work
- **ADV-02**: Model selection per job — use Sonnet for routine maintenance, Opus for complex issues
- **ADV-03**: Agent teams per job — spawn multiple Claude instances (planner, implementer, reviewer) per run
- **ADV-04**: Merge conflict resolution — auto-resolve when target branch has diverged

### Platform

- **PLAT-01**: Windows support via Task Scheduler
- **PLAT-02**: TUI dashboard for terminal-based job management

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Web dashboard / GUI | Massive scope increase; contradicts CLI-first design |
| Direct main branch commits | One bad commit = broken production; PRs provide review gate |
| Custom daemon / background service | System cron/launchd is battle-tested; custom daemons are fragile |
| Auto-merging PRs | Removes human review gate; too risky for autonomous agent |
| Real-time streaming of agent work | Defeats purpose of "wake up to PRs"; headless by design |
| Multi-repo orchestration in single job | Cross-repo coordination is enormous complexity; one job per repo |
| OAuth notification integrations | Webhooks are copy-paste simple; OAuth adds unnecessary complexity |
| Cost tracking / billing | Claude Code already has /cost and workspace limits |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SETUP-01 | Phase 6 | Pending |
| SETUP-02 | Phase 1 | Complete |
| SETUP-03 | Phase 2 | Complete |
| SETUP-04 | Phase 6 | Pending |
| SETUP-05 | Phase 6 | Pending |
| SCHED-01 | Phase 2 | Complete |
| SCHED-02 | Phase 2 | Complete |
| SCHED-03 | Phase 2 | Complete |
| EXEC-01 | Phase 3 | Pending |
| EXEC-02 | Phase 3 | Pending |
| EXEC-03 | Phase 3 | Pending |
| EXEC-04 | Phase 3 | Pending |
| EXEC-05 | Phase 3 | Pending |
| EXEC-06 | Phase 3 | Pending |
| GIT-01 | Phase 3 | Pending |
| GIT-02 | Phase 3 | Pending |
| GIT-03 | Phase 3 | Pending |
| GIT-04 | Phase 3 | Pending |
| GIT-05 | Phase 3 | Pending |
| JOB-01 | Phase 5 | Pending |
| JOB-02 | Phase 5 | Pending |
| JOB-03 | Phase 5 | Pending |
| JOB-04 | Phase 5 | Pending |
| JOB-05 | Phase 5 | Pending |
| SAFE-01 | Phase 3 | Pending |
| SAFE-02 | Phase 3 | Pending |
| SAFE-03 | Phase 3 | Pending |
| NOTF-01 | Phase 4 | Pending |
| NOTF-02 | Phase 4 | Pending |
| NOTF-03 | Phase 4 | Pending |
| REPT-01 | Phase 3 | Pending |
| REPT-02 | Phase 5 | Pending |
| DIST-01 | Phase 6 | Pending |
| DIST-02 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 34 total
- Mapped to phases: 34
- Unmapped: 0

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-21 after roadmap creation*
