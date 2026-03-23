# Claude Auto

## What This Is

An npm-installable Claude Code plugin that lets developers set up autonomous cron jobs where Claude continuously works on their repositories. Each cron job spawns a headless Claude instance that researches the codebase, picks the highest-value work (open issues, bugs it discovers, or features it wants to add), makes PRs, updates documentation, and notifies the user. Claude learns from previous runs, iterates on reviewer feedback, and can run a multi-stage plan/implement/review pipeline. Users configure everything through a guided conversation with Claude — repo, schedule, focus areas, system prompt, guardrails — and can run multiple instances targeting different repos or concerns. Supports macOS, Linux, and Windows.

## Core Value

Claude autonomously and continuously improves codebases without human intervention — users wake up to PRs.

## Requirements

### Validated

- ✓ Human-readable YAML config files with comment preservation — v1.0
- ✓ Schedule accepts natural language or cron syntax — v1.0
- ✓ System cron/launchd scheduling with timezone support — v1.0
- ✓ Headless Claude spawning with safety guarantees — v1.0
- ✓ Work priority chain (issues → bugs → features) — v1.0
- ✓ Git safety (new branch, never main, never force push) — v1.0
- ✓ Codebase research, bug discovery, issue triage, doc updates — v1.0
- ✓ Configurable guardrails (max turns, restrict paths, no new deps) — v1.0
- ✓ Local run logs + notifications (Discord/Slack/Telegram/GitHub) — v1.0
- ✓ CLI management + npm plugin with setup wizard — v1.0
- ✓ Cross-run context persistence (SQLite, rolling window, dedup) — v1.1
- ✓ Model selection per job (sonnet/opus/haiku) — v1.1
- ✓ Cost tracking with daily/weekly/monthly budget enforcement — v1.1
- ✓ PR feedback loop (review detection, iterative fixes, max rounds) — v1.1
- ✓ Smarter issue triage (complexity scoring, spam filtering, label priority) — v1.1
- ✓ Agent pipeline (plan→implement→review with per-stage models) — v1.1
- ✓ Merge conflict resolution (auto-rebase with clean abort) — v1.1
- ✓ Windows Task Scheduler support — v1.1
- ✓ TUI dashboard (ink/React, live status, keyboard navigation) — v1.1

### Active

(None — v1.1 complete. Add requirements for next milestone.)

### Out of Scope

- GUI/web dashboard — CLI-first, TUI covers terminal users
- Self-hosting infrastructure — runs on user's machine
- Auto-merging PRs — human review gate is intentional
- Real-time streaming — defeats purpose of headless autonomous operation
- Full parallel agent teams — sequential pipeline first; parallel is experimental and 7x cost

## Context

Shipped v1.1 with 6,261 LOC TypeScript + 9,621 LOC tests (585 tests).
Tech stack: TypeScript ESM, Node 22, Zod v4, yaml (Document API), better-sqlite3, ink + React, vitest, tsup, biome.
Platform: crontab (Linux) + launchd (macOS) + schtasks (Windows).
Distribution: npm package with Claude Code plugin system (postinstall auto-registration).
CLI: `claude-auto` binary with 11 subcommands + interactive TUI dashboard.
Plugin: 8 SKILL.md files including conversational setup wizard.
Database: SQLite with WAL mode for cross-run context, cost tracking, PR feedback state.

## Constraints

- **Runtime**: Claude Code headless mode with --dangerously-skip-permissions
- **Distribution**: npm package with Claude Code plugin registration
- **Git safety**: Never force push, never commit to main, always new branch + PR
- **Platform**: macOS, Linux, and Windows
- **Auth**: Relies on user's existing git/gh authentication

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| npm package distribution | Standard JS ecosystem, easy install | ✓ Good |
| CLI spawning over Agent SDK | Agent SDK orphaned process bug; CLI simpler | ✓ Good |
| System cron/launchd/schtasks | No custom daemon, reliable, well-understood | ✓ Good |
| YAML config with Document API | Comment preservation, multiline system prompts | ✓ Good |
| Webhook notifications (native fetch) | Simple, no OAuth, zero deps | ✓ Good |
| Skills call CLI for all mutations | Testable, deterministic; skills handle UX only | ✓ Good |
| Sequential spawns for pipeline | Not Agent Teams API (7x cost, experimental) | ✓ Good |
| better-sqlite3 for persistence | node:sqlite still experimental; sync API fits | ✓ Good |
| Structured facts in context DB | No raw narrative — prevents hallucination amplification | ✓ Good |
| ink + React for TUI (lazy loaded) | Zero startup cost for non-dashboard commands | ✓ Good |
| parseArgs only (no CLI framework) | Minimal deps, sufficient for 11 subcommands | ✓ Good |

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
*Last updated: 2026-03-22 after v1.1 milestone*
