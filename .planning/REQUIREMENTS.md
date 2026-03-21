# Requirements: Claude Auto v1.1

**Defined:** 2026-03-21
**Core Value:** Claude autonomously and continuously improves codebases without human intervention -- users wake up to PRs.

## v1.1 Requirements

Requirements for v1.1 release. Each maps to roadmap phases.

### Cross-Run Intelligence

- [x] **CTXT-01**: Each run persists structured context (files modified, PR URL, issue number, summary) to a local SQLite database
- [x] **CTXT-02**: Each run loads context from prior runs and injects it into Claude's system prompt as a rolling window
- [x] **CTXT-03**: Claude avoids duplicate work by checking what was done in previous runs before picking new work

### PR Feedback Loop

- [x] **PRFB-01**: Before picking new work, Claude checks for open PRs with unaddressed review comments via gh
- [x] **PRFB-02**: When review comments exist, Claude checks out the existing PR branch and addresses the feedback
- [x] **PRFB-03**: PR feedback iteration has a configurable max rounds (default 3) to prevent infinite loops
- [x] **PRFB-04**: After addressing feedback, Claude pushes to the same branch and comments on the PR with what changed

### Issue Triage

- [x] **TRIG-01**: Claude evaluates issue complexity before picking work (simple label detection, reproduction steps, size estimation)
- [x] **TRIG-02**: Claude skips issues that look like spam, are too vague, or require human decisions
- [x] **TRIG-03**: Claude prioritizes issues with "good first issue" or "bug" labels over unlabeled issues

### Agent Pipeline

- [ ] **PIPE-01**: User can enable a multi-stage pipeline per job: plan -> implement -> review
- [ ] **PIPE-02**: Each pipeline stage spawns a separate Claude instance with a stage-specific system prompt
- [ ] **PIPE-03**: Review stage checks implementation against the plan and can request changes before PR creation
- [ ] **PIPE-04**: Pipeline stages use configurable models (e.g., Haiku for plan, Opus for implement, Sonnet for review)

### Model Selection

- [x] **MODL-01**: User can configure which Claude model to use per job (sonnet, opus, haiku)
- [x] **MODL-02**: Model selection is passed to Claude CLI via --model flag during spawning
- [x] **MODL-03**: Default model is configurable; falls back to Claude Code's default if unset

### Cost Tracking

- [x] **COST-01**: Each run records token usage and cost from Claude's JSON output to the SQLite database
- [x] **COST-02**: User can view cost summaries per job and across all jobs via CLI (claude-auto cost)
- [x] **COST-03**: User can set daily, weekly, or monthly budget caps per job
- [x] **COST-04**: When a budget cap is reached, scheduled runs skip with a "budget exceeded" status and notification

### Merge Conflict Resolution

- [ ] **MRGC-01**: Before starting work, Claude checks if the PR branch has diverged from the target branch
- [ ] **MRGC-02**: When conflicts exist, Claude attempts to rebase or merge the target branch and resolve conflicts
- [ ] **MRGC-03**: If conflict resolution fails, Claude reports the failure in the run log and notification

### Windows Support

- [ ] **WNDW-01**: Jobs can be registered with Windows Task Scheduler via schtasks.exe
- [ ] **WNDW-02**: Jobs can be removed from Windows Task Scheduler cleanly
- [ ] **WNDW-03**: Platform detection correctly identifies Windows and selects the Task Scheduler adapter
- [ ] **WNDW-04**: Cron expressions are translated to Task Scheduler compatible schedules

### TUI Dashboard

- [ ] **TUID-01**: User can launch an interactive terminal dashboard via `claude-auto dashboard`
- [ ] **TUID-02**: Dashboard shows all jobs with live status, last run, next run, and cost summary
- [ ] **TUID-03**: Dashboard supports keyboard navigation to pause, resume, or view logs for a job
- [ ] **TUID-04**: Dashboard auto-refreshes when run logs are updated

## Future Requirements

Deferred beyond v1.1.

### Advanced

- **ADV-01**: Full agent teams (parallel, not sequential) -- defer until sequential pipeline proves value
- **ADV-02**: Cross-repo orchestration -- single job spanning multiple repos
- **ADV-03**: Custom notification templates -- user-defined webhook payloads

## Out of Scope

| Feature | Reason |
|---------|--------|
| Web dashboard / GUI | CLI-first design; TUI covers terminal users |
| Auto-merging PRs | Human review gate is intentional |
| Real-time streaming | Defeats purpose of headless autonomous operation |
| OAuth notification flows | Webhooks are simpler and sufficient |
| Full parallel agent teams | Sequential pipeline first; parallel is experimental and 7x cost |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CTXT-01 | Phase 8 | Complete |
| CTXT-02 | Phase 8 | Complete |
| CTXT-03 | Phase 8 | Complete |
| PRFB-01 | Phase 9 | Complete |
| PRFB-02 | Phase 9 | Complete |
| PRFB-03 | Phase 9 | Complete |
| PRFB-04 | Phase 9 | Complete |
| TRIG-01 | Phase 9 | Complete |
| TRIG-02 | Phase 9 | Complete |
| TRIG-03 | Phase 9 | Complete |
| PIPE-01 | Phase 10 | Pending |
| PIPE-02 | Phase 10 | Pending |
| PIPE-03 | Phase 10 | Pending |
| PIPE-04 | Phase 10 | Pending |
| MODL-01 | Phase 8 | Complete |
| MODL-02 | Phase 8 | Complete |
| MODL-03 | Phase 8 | Complete |
| COST-01 | Phase 8 | Complete |
| COST-02 | Phase 8 | Complete |
| COST-03 | Phase 8 | Complete |
| COST-04 | Phase 8 | Complete |
| MRGC-01 | Phase 10 | Pending |
| MRGC-02 | Phase 10 | Pending |
| MRGC-03 | Phase 10 | Pending |
| WNDW-01 | Phase 11 | Pending |
| WNDW-02 | Phase 11 | Pending |
| WNDW-03 | Phase 11 | Pending |
| WNDW-04 | Phase 11 | Pending |
| TUID-01 | Phase 11 | Pending |
| TUID-02 | Phase 11 | Pending |
| TUID-03 | Phase 11 | Pending |
| TUID-04 | Phase 11 | Pending |

**Coverage:**
- v1.1 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-21 after roadmap creation*
