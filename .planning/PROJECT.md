# Claude Auto

## What This Is

An npm-installable Claude Code skill that lets developers set up autonomous cron jobs where Claude continuously works on their repositories. Each cron job spawns a headless Claude instance that researches the codebase, picks work to do (open issues, bugs it discovers, or features it wants to add), makes PRs, updates documentation, and notifies the user. Users configure everything through a guided conversation with Claude — repo, schedule, focus areas, system prompt, guardrails — and can run multiple instances targeting different repos or concerns.

## Core Value

Claude autonomously and continuously improves codebases without human intervention — users wake up to PRs.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Skill registers as a Claude Code skill installable via npm
- [ ] Guided wizard setup: Claude walks user through repo, branch, schedule, focus areas, system prompt
- [ ] Claude helps craft the system prompt (personality, coding style, focus areas, things to avoid)
- [ ] Schedule accepts natural language ("every 6 hours") or cron syntax, Claude normalizes
- [ ] Each cron run spawns Claude in headless mode with --dangerously-skip-permissions
- [ ] Work priority chain: open GitHub issues → bugs Claude discovers → features Claude wants to add
- [ ] Always pulls configured branch, creates new branch, never force pushes, never commits to main
- [ ] Codebase research phase at the start of every run (understand current implementation)
- [ ] Bug discovery: scans for pre-existing bugs before adding new features
- [ ] Creates PRs to configured branch with detailed descriptions
- [ ] Updates relevant documentation after changes
- [ ] Notifications: Discord, Slack, Telegram, GitHub issue comments (configurable per job)
- [ ] Multiple cron job instances per user, each targeting different repos/focuses
- [ ] Management via skill commands: list, pause, resume, edit, remove jobs
- [ ] Human-readable config files that users can also edit directly
- [ ] Repos: assumes local clone, clones if not present
- [ ] Full trust by default, optional configurable guardrails (no new deps, no arch changes, bug-fix only, etc.)
- [ ] Local run log for each cron execution

### Out of Scope

- GUI/web dashboard — CLI-first, skill-first
- Self-hosting infrastructure — runs on user's machine via system cron/launchd
- Payment/billing — free tool
- Windows support for v1 — macOS/Linux first

## Context

- Claude Code is Anthropic's CLI tool that supports skills (custom slash commands), headless mode, and --dangerously-skip-permissions for autonomous operation
- The skill itself is meta: Claude helps users configure Claude to run autonomously
- GitHub CLI (gh) is the expected interface for issue listing, PR creation, repo cloning
- System cron (crontab) or launchd on macOS are the cron mechanisms
- Notification integrations use webhooks (Discord, Slack, Telegram) — no complex auth flows
- Users are developers comfortable with CLI tools and giving Claude repo access

## Constraints

- **Runtime**: Must work with Claude Code's headless mode and --dangerously-skip-permissions flag
- **Distribution**: npm package that registers as a Claude Code skill
- **Git safety**: Never force push, never commit to main/configured branch directly, always new branch + PR
- **Platform**: macOS and Linux for v1 (cron/launchd)
- **Auth**: Relies on user's existing git/gh authentication on the machine

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| npm package distribution | Standard JS ecosystem distribution, easy install | — Pending |
| Headless Claude with --dangerously-skip-permissions | Full autonomy requires skipping permission prompts | — Pending |
| System cron/launchd for scheduling | No custom daemon needed, reliable, well-understood | — Pending |
| Webhook-based notifications | Simple, no OAuth flows, works with Discord/Slack/Telegram | — Pending |
| Config files + skill commands for management | Both power users (edit files) and casual users (ask Claude) served | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-21 after initialization*
