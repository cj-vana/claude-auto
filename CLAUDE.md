<!-- GSD:project-start source:PROJECT.md -->
## Project

**Claude Auto**

An npm-installable Claude Code plugin that lets developers set up autonomous cron jobs where Claude continuously works on their repositories. Each cron job spawns a headless Claude instance that researches the codebase, picks work to do (open issues, bugs it discovers, or features it wants to add), makes PRs, updates documentation, and notifies the user. Users configure everything through a guided conversation with Claude — repo, schedule, focus areas, system prompt, guardrails — and can run multiple instances targeting different repos or concerns.

**Core Value:** Claude autonomously and continuously improves codebases without human intervention — users wake up to PRs.

### Constraints

- **Runtime**: Claude Code headless mode with --dangerously-skip-permissions
- **Distribution**: npm package with Claude Code plugin registration
- **Git safety**: Never force push, never commit to main, always new branch + PR
- **Platform**: macOS, Linux, and Windows (v1.1 adds Task Scheduler)
- **Auth**: Relies on user's existing git/gh authentication
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Existing Stack (DO NOT change)
| Technology | Version | Purpose |
|------------|---------|---------|
| TypeScript ESM | 5.9.x | Language |
| Node.js | >=22 | Runtime |
| Zod v4 | ^4.3.6 | Schema validation |
| yaml (Document API) | ^2.8.3 | Config with comment preservation |
| vitest | ^4.1.0 | Testing |
| tsup | ^8.5.1 | Bundling |
| biome | ^2.4.8 | Linting/formatting |
| cron-parser | ^5.5.0 | Cron expression parsing |
| cronstrue | ^3.14.0 | Human-readable cron descriptions |
| proper-lockfile | ^4.1.2 | Cross-platform file locking |
| plist | ^3.1.0 | macOS launchd plist generation |
| nanoid | ^5.1.7 | ID generation |
| write-file-atomic | ^7.0.1 | Safe file writes |
## Recommended Stack Additions
### Cross-Run Context Persistence: better-sqlite3
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| better-sqlite3 | ^12.8.0 | Cross-run context storage, cost tracking aggregation | Synchronous API fits Node worker patterns, prebuilt binaries for Node 22 on macOS/Linux/Windows, zero-config embedded DB, WAL mode for concurrent reads |
- **Not node:sqlite** -- Node.js built-in sqlite module is still experimental (stability 1.2 "release candidate" as of March 2026, requires `--experimental-sqlite` flag). Cannot ship a CLI tool that requires experimental flags. The stabilization target was Node v25 (October 2025) but it is still not fully stable. Use better-sqlite3 until node:sqlite reaches stability level 2.
- **Not JSON files** -- The current v1.0 approach of individual JSON log files per run works for append-only logging but fails for cross-run queries ("what issues did I already work on?", "total cost this month?", "what branches are still open?"). SQLite provides indexed queries, aggregation, and atomic transactions.
- **Not an external DB** -- This tool runs on user machines with cron. No external database process. SQLite is embedded and zero-config.
- **Prebuilds available** for Node 20.x, 22.x, 23.x, 24.x. Node 22 is explicitly supported.
### Model Selection: No new dependency
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Claude Code CLI `--model` flag | built-in | Per-job model selection | Already supported by Claude Code CLI; just pass `--model <alias>` to spawn |
### Agent Teams: No new dependency
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Claude Code sub-agents | built-in | Planner/implementer/reviewer per run | Use sub-agent markdown files (.claude/agents/) with per-agent model, tool, and permission configuration |
- Ship sub-agent markdown files in the plugin's `.claude-plugin/agents/` directory
- Define three sub-agents: `planner` (read-only, opus model), `implementer` (full tools, sonnet model), `reviewer` (read-only, sonnet model)
- The main spawned Claude session orchestrates: planner sub-agent researches and plans, implementer executes, reviewer validates
- Sub-agents run within a single session context -- lower token cost than full agent teams
- Agent teams (experimental, `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) are the heavier alternative for true parallel work but are overkill for the sequential plan/implement/review workflow
### Windows Task Scheduler: No new dependency
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `schtasks.exe` via child_process | built-in | Windows scheduled task management | Direct schtasks CLI invocation matches the pattern already used for crontab (Linux) and launchctl (macOS) |
- Add `"win32"` to the `Platform` type in `src/platform/detect.ts`
- Create `src/platform/schtasks.ts` implementing the `Scheduler` interface
- Use `schtasks /create /tn "claude-auto-{jobId}" /tr "node {path-to-claude-auto-run} {jobId}" /sc {schedule} /st {time}` for registration
- Parse `schtasks /query /tn "claude-auto-{jobId}" /fo CSV` for status checks
- Key flags: `/ru` (run as user), `/rl HIGHEST` (elevated if needed), `/f` (force overwrite)
### TUI Dashboard: ink + react
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| ink | ^6.8.0 | React renderer for terminal | De facto standard for interactive terminal UIs in Node.js; used by Gatsby, Prisma, Yarn, Shopify; ESM-only; flexbox layout via Yoga |
| react | ^19.0.0 | Component model for TUI | Required peer dependency for ink 6.x; provides hooks, state management, component composition |
| @inkjs/ui | ^2.0.0 | Pre-built TUI components | Spinner, ProgressBar, StatusMessage, TextInput, Select components; theme system |
- **Not blessed/neo-blessed** -- blessed is unmaintained (last commit years ago). neo-blessed is a fork but also low activity. Widget-based API is more complex than React component model.
- **Not terminal-kit** -- Last published a year ago (v3.1.2). Lower-level API requires more boilerplate. No component reuse model.
- **Not raw ANSI + cli-table3** -- Sufficient for static output (which v1.0 `list` command uses), but inadequate for an interactive dashboard with live updates, keyboard navigation, and state management.
- **ink is the ecosystem standard** -- Used by Gatsby, Parcel, Yarn, Terraform, Prisma, Shopify. Actively maintained (v6.8.0, February 2026). ESM-only which matches the project.
### Merge Conflict Resolution: No new dependency
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `git merge` / `git rebase` via child_process | built-in | Auto-resolve diverged target branches | Git CLI already used extensively; merge conflicts are best handled by re-running Claude on the conflicted state |
### PR Feedback Loop: No new dependency
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `gh api` / `gh pr view` via child_process | built-in | Read PR review comments, iterate on feedback | Already using `gh` CLI for PR creation; extend to read review comments |
- `gh pr view {number} --json reviews,reviewRequests,comments` -- Get review metadata
- `gh api repos/{owner}/{repo}/pulls/{number}/comments` -- Get inline review comments
- `gh api repos/{owner}/{repo}/pulls/{number}/reviews` -- Get review summaries
### Cost Tracking: No new dependency (uses better-sqlite3)
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| SQLite aggregation queries | via better-sqlite3 | Per-run, per-job, per-period cost aggregation | Already adding better-sqlite3 for context persistence; cost data comes from SpawnResult.costUsd |
- Total cost per job (all time, this month, this week)
- Cost per run with model information
- Budget alerting (compare cumulative cost against `guardrails.maxBudgetUsd`)
- Cost trends over time
### Smarter Issue Triage: No new dependency
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Claude Code prompt engineering | built-in | Complexity scoring, dependency detection, spam filtering | Issue triage logic runs inside the spawned Claude session; no external ML library needed |
## Installation
# New production dependencies (v1.1)
# New dev dependencies (v1.1)
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| better-sqlite3 | node:sqlite (built-in) | When node:sqlite reaches stability 2 (stable) in a future Node.js version; then migrate to eliminate the native addon dependency |
| better-sqlite3 | JSON files (current) | Never for cross-run queries; keep JSON export as a compatibility/debug option |
| ink + react | blessed / neo-blessed | Never; both are unmaintained |
| ink + react | terminal-kit | If React dependency is absolutely unacceptable; terminal-kit is lower-level and less maintained |
| ink + react | Raw ANSI + cli-table3 | If TUI scope is reduced to non-interactive static tables only (no live updates, no keyboard nav) |
| Direct schtasks | windows-scheduler npm | Never; the package is 8 years abandoned |
| Sub-agents (sequential) | Agent teams (parallel) | When users need true parallel execution (multiple independent Claude instances communicating); agent teams are experimental and use ~7x more tokens |
| gh CLI | @octokit/rest | If complex GitHub API operations are needed beyond what gh CLI supports; currently gh CLI is sufficient and already a project dependency pattern |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| node:sqlite | Still experimental, requires --experimental-sqlite flag, not production-ready for an npm-distributed CLI tool | better-sqlite3 |
| windows-scheduler (npm) | Last published 8 years ago, unmaintained | Direct schtasks.exe via child_process |
| node-schtasks (npm) | Never published to npm, early development stage | Direct schtasks.exe via child_process |
| blessed | Unmaintained, last meaningful update years ago | ink |
| neo-blessed | Fork with low activity, still widget-based API | ink |
| @octokit/rest | Adds large dependency for something gh CLI already handles | gh CLI via child_process |
| Agent SDK (Anthropic) | Known orphaned process bug (#142 referenced in PROJECT.md key decisions); CLI spawning is simpler and validated in v1.0 | Claude Code CLI via child_process |
| Any in-process scheduler (node-schedule, node-cron) | Project uses system-level scheduling (cron/launchd/schtasks) for reliability; in-process schedulers die when the process exits | schtasks.exe (matching existing cron/launchd pattern) |
## Stack Patterns by Feature
- Use better-sqlite3 with WAL mode for concurrent read access
- Schema versioning via user_version pragma (no migration library needed)
- Wrap in a `Database` singleton class in `src/core/database.ts`
- Because the runner process is single-threaded and short-lived, synchronous API is ideal
- Dynamic import ink/react only in the dashboard command (keep CLI startup fast)
- Use `ink`'s `render()` with `<App />` component
- `@inkjs/ui` provides Spinner, StatusMessage, Select components
- Read data from SQLite (better-sqlite3) -- dashboard is a read-only consumer
- tsup config: add `jsx: 'react-jsx'` for .tsx file support
- Guard all platform-specific imports behind `detectPlatform()` checks
- schtasks.exe uses different schedule syntax than cron -- build a translator
- Test with `schtasks /query /fo CSV` parsing (CSV output is more reliable than table format)
- Windows paths use backslashes -- ensure path handling uses `path.join()` (already the case)
- Check open PRs at run start, before picking new work
- Use `gh pr view --json` for structured data
- Store PR state in SQLite for cross-run tracking
- New commits push to existing branch (no new PR creation)
## Version Compatibility
| Package | Compatible With | Notes |
|---------|-----------------|-------|
| ink@^6.8.0 | react@^19.0.0 | ink 6.x requires React 19; ink 5.x works with React 18 but lacks concurrent rendering |
| ink@^6.8.0 | Node >=20 | ink 6.x requires Node 20+; project requires Node 22+ so this is fine |
| @inkjs/ui@^2.0.0 | ink@^6.0.0 | Companion component library; uses ink 6.x internally |
| better-sqlite3@^12.8.0 | Node 20.x, 22.x, 23.x, 24.x | Prebuilt binaries available for all; native addon requires node-gyp fallback if prebuild missing |
| better-sqlite3@^12.8.0 | macOS, Linux, Windows | Cross-platform prebuilds; Windows support is first-class |
## Sources
- [Claude Code model configuration docs](https://code.claude.com/docs/en/model-config) -- Model aliases, --model flag, --effort flag, environment variables (HIGH confidence, official docs)
- [Claude Code cost management docs](https://code.claude.com/docs/en/costs) -- Token usage tracking, cost fields, agent team token costs (HIGH confidence, official docs)
- [Claude Code agent teams docs](https://code.claude.com/docs/en/agent-teams) -- Team architecture, experimental flag, token cost ~7x, limitations (HIGH confidence, official docs)
- [Claude Code sub-agents docs](https://code.claude.com/docs/en/sub-agents) -- Sub-agent markdown files, model/tools/permissions config, built-in agents (HIGH confidence, official docs)
- [node:sqlite stabilization issue #57445](https://github.com/nodejs/node/issues/57445) -- Still experimental/release-candidate, not stable (HIGH confidence, GitHub issue)
- [better-sqlite3 npm](https://www.npmjs.com/package/better-sqlite3) -- v12.8.0, Node 22 support, prebuilt binaries (HIGH confidence, npm registry)
- [better-sqlite3 vs node:sqlite discussion #1245](https://github.com/WiseLibs/better-sqlite3/discussions/1245) -- Comparison and migration path (MEDIUM confidence, community discussion)
- [ink GitHub](https://github.com/vadimdemedes/ink) -- v6.8.0, ESM-only, React 19, Node >=20 (HIGH confidence, official repo)
- [ink releases](https://github.com/vadimdemedes/ink/releases) -- v6.8.0 February 2026, renderToString, concurrent rendering (HIGH confidence, official releases)
- [@inkjs/ui npm](https://www.npmjs.com/package/@inkjs/ui) -- v2.0.0, Spinner/ProgressBar/StatusMessage/Select components (HIGH confidence, npm registry)
- [gh CLI PR review discussion](https://github.com/cli/cli/discussions/3993) -- gh pr view --json reviews, gh api for inline comments (MEDIUM confidence, community discussion)
- [Windows schtasks documentation](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/schtasks) -- /create, /delete, /query syntax (HIGH confidence, Microsoft docs)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
