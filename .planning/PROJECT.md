# Claude Auto

## What This Is

An npm-installable Claude Code plugin that lets developers set up autonomous cron jobs where Claude continuously works on their repositories. Each cron job spawns a headless Claude instance that researches the codebase, picks work to do (open issues, bugs it discovers, or features it wants to add), makes PRs, updates documentation, and notifies the user. Users configure everything through a guided conversation with Claude — repo, schedule, focus areas, system prompt, guardrails — and can run multiple instances targeting different repos or concerns.

## Core Value

Claude autonomously and continuously improves codebases without human intervention — users wake up to PRs.

## Requirements

### Validated

- ✓ Human-readable YAML config files with comment preservation — v1.0
- ✓ Schedule accepts natural language or cron syntax, Claude normalizes — v1.0
- ✓ System cron/launchd scheduling (macOS + Linux) with timezone support — v1.0
- ✓ Headless Claude spawning with safety guarantees (--dangerously-skip-permissions) — v1.0
- ✓ Work priority chain (issues → bugs → features) — v1.0
- ✓ Git safety (new branch, never main, never force push, PR via gh) — v1.0
- ✓ Codebase research, bug discovery, issue triage, doc updates — v1.0
- ✓ Configurable guardrails (max turns, restrict paths, no new deps, bug-fix only) — v1.0
- ✓ Local run logs (JSON append-only per run) — v1.0
- ✓ Notifications: Discord, Slack, Telegram webhooks + GitHub issue comments — v1.0
- ✓ Configurable event triggers per provider (onSuccess/onFailure/onNoChanges/onLocked) — v1.0
- ✓ CLI management: list, pause, resume, edit, remove jobs — v1.0
- ✓ Run summary reports — v1.0
- ✓ npm package with Claude Code plugin auto-registration — v1.0
- ✓ Guided wizard setup (/claude-auto:setup) with conversational system prompt crafting — v1.0
- ✓ Auto-clone repos via gh — v1.0

### Active

- [ ] Cross-run context persistence — Claude remembers previous runs to avoid duplicate work
- [ ] Model selection per job — Sonnet for routine, Opus for complex
- [ ] Agent teams per job — planner + implementer + reviewer per run
- [ ] Merge conflict resolution — auto-resolve when target branch diverged
- [ ] Windows support via Task Scheduler
- [ ] TUI dashboard for terminal-based job management
- [ ] Smarter issue triage — complexity scoring, dependency detection, spam filtering
- [ ] PR feedback loop — Claude reads review comments and iterates on its own PRs
- [ ] Cost tracking — token usage per run/job, budget dashboards in CLI

### Out of Scope

- GUI/web dashboard — CLI-first, skill-first
- Self-hosting infrastructure — runs on user's machine via system cron/launchd
- Payment/billing — free tool
- Auto-merging PRs — human review gate is intentional
- Real-time streaming — defeats purpose of "wake up to PRs"

## Current Milestone: v1.1

**Goal:** Make Claude a smarter, more capable autonomous contributor — cross-run memory, agent teams, PR iteration, cost awareness, and broader platform support.

**Target features:**
- Cross-run context persistence
- Model selection per job
- Agent teams (planner/implementer/reviewer)
- Merge conflict resolution
- Windows Task Scheduler support
- TUI dashboard
- Smarter issue triage
- PR feedback loop
- Cost tracking

## Context

Shipped v1.0 with 3,193 LOC TypeScript + 5,214 LOC tests (315 tests).
Tech stack: TypeScript ESM, Node 22, Zod v4, yaml (Document API), vitest, tsup, biome.
Platform: crontab (Linux) + launchd (macOS) with native fetch for webhooks.
Distribution: npm package with Claude Code plugin system (postinstall auto-registration).
CLI: `claude-auto` binary with 10 subcommands (list, logs, report, pause, resume, remove, edit, create, check-repo + help).
Plugin: 8 SKILL.md files including conversational setup wizard.

## Constraints

- **Runtime**: Claude Code headless mode with --dangerously-skip-permissions
- **Distribution**: npm package with Claude Code plugin registration
- **Git safety**: Never force push, never commit to main, always new branch + PR
- **Platform**: macOS, Linux, and Windows (v1.1 adds Task Scheduler)
- **Auth**: Relies on user's existing git/gh authentication

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| npm package distribution | Standard JS ecosystem distribution, easy install | ✓ Good |
| CLI spawning over Agent SDK | Agent SDK has orphaned process bug (#142); CLI is simpler for v1 | ✓ Good |
| System cron/launchd for scheduling | No custom daemon needed, reliable, well-understood | ✓ Good |
| YAML config with Document API | Comment preservation for human editing; multiline system prompts | ✓ Good |
| Webhook-based notifications | Simple, no OAuth flows, native fetch — zero deps | ✓ Good |
| Skills call CLI for all mutations | Testable, deterministic; skills handle UX only | ✓ Good |
| proper-lockfile for concurrency | Cross-platform, stale detection, atomic mkdir-based | ✓ Good |
| No CLI framework (parseArgs only) | Minimal deps, sufficient for 10 subcommands | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-21 after v1.1 milestone start*
