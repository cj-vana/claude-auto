<!-- GSD:project-start source:PROJECT.md -->
## Project

**Claude Auto**

An npm-installable Claude Code skill that lets developers set up autonomous cron jobs where Claude continuously works on their repositories. Each cron job spawns a headless Claude instance that researches the codebase, picks work to do (open issues, bugs it discovers, or features it wants to add), makes PRs, updates documentation, and notifies the user. Users configure everything through a guided conversation with Claude — repo, schedule, focus areas, system prompt, guardrails — and can run multiple instances targeting different repos or concerns.

**Core Value:** Claude autonomously and continuously improves codebases without human intervention — users wake up to PRs.

### Constraints

- **Runtime**: Must work with Claude Code's headless mode and --dangerously-skip-permissions flag
- **Distribution**: npm package that registers as a Claude Code skill
- **Git safety**: Never force push, never commit to main/configured branch directly, always new branch + PR
- **Platform**: macOS and Linux for v1 (cron/launchd)
- **Auth**: Relies on user's existing git/gh authentication on the machine
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | 5.7+ | Primary language | Type safety is critical for a tool managing system-level cron jobs and spawning autonomous agents. The entire Claude ecosystem (Agent SDK, skills) is TypeScript-first. |
| Node.js | 22 LTS | Runtime | Required by `@anthropic-ai/claude-agent-sdk` (Node 18+ minimum). v22 LTS is current stable with native fetch, stable ESM, and the performance characteristics needed for process spawning. |
| `@anthropic-ai/claude-agent-sdk` | ^0.1.58 | Programmatic Claude spawning | **This is the primary integration point.** Provides `query()` to spawn Claude agents with full tool access, system prompts, permission modes, working directory control, session management, and streaming. Replaces raw `child_process.spawn('claude', ['-p', ...])`. The SDK handles process lifecycle, message streaming, abort control, and structured output. |
| `tsup` | ^8.4 | Build/bundle | Zero-config TypeScript bundler powered by esbuild. Outputs both ESM and CJS, generates `.d.ts` declarations, handles tree-shaking. Standard for npm package authoring in 2025. |
| `tsx` | ^4.19 | Dev runtime | Runs TypeScript directly via esbuild transform -- used for development and testing only. Not bundled into production. |
### Scheduling & System Integration
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `crontab` (npm) | ^1.4.2 | System crontab CRUD | The only npm package that reads/writes actual system crontab entries (not in-process scheduling). Provides `load()`, `create()`, `remove()`, `save()` for manipulating the user's crontab. Low download count (768/week) but stable API that hasn't needed changes -- crontab itself hasn't changed in decades. **Confidence: MEDIUM** -- package last published 5 years ago; may need to fork or write thin wrapper around `child_process.exec('crontab ...')` if issues arise. |
| `plist` (npm) | ^3.1.0 | macOS launchd plist generation | Standard plist parser/builder for Node.js (read XML/binary plist, write XML plist). Used to generate `.plist` files for `~/Library/LaunchAgents/`. Combined with `child_process.exec('launchctl load/unload ...')` for registration. |
| `cron-parser` | ^5.0+ | Cron expression validation & iteration | Validates cron expressions, computes next run times, supports timezone-aware iteration. TypeScript types included. Essential for showing users "next run: ..." confirmations. |
| `cronstrue` | ^2.52 | Cron-to-human-readable | Converts `0 */6 * * *` to "Every 6 hours". Supports 30+ languages. Used in job listing and confirmation UIs. |
### Configuration & Data
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `yaml` (npm) | ^2.8 | Config file read/write | The `yaml` package (not `js-yaml`) is actively maintained, zero-dependency, supports YAML 1.2, preserves comments on round-trip, and has full TypeScript types. YAML is the right config format here: human-readable, supports multiline strings (for system prompts), and familiar to developers. |
| `zod` | ^4.3 | Config validation & types | Validates config files at load time, generates TypeScript types from schemas, provides clear error messages for malformed configs. Zod v4 is 14x faster than v3 with 57% smaller core. The Agent SDK already uses Zod for tool schemas. |
| XDG-compliant paths | (custom) | Config/data/log directories | Store config in `~/.config/claude-auto/`, data in `~/.local/share/claude-auto/`, logs in `~/.local/state/claude-auto/`. On macOS, fall back to `~/Library/Application Support/claude-auto/` if XDG vars aren't set. Use `os.homedir()` + `process.env.XDG_*` -- no library needed. |
### Notifications (Webhooks)
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Native `fetch` | Built-in (Node 22) | HTTP POST to webhooks | **Use no webhook library.** Discord, Slack, and Telegram webhooks are all simple HTTP POST with JSON body. Node 22's built-in `fetch` handles this in ~10 lines per provider. Adding `discord-webhook-node` (5 years stale), `@slack/webhook` (adds SDK dependency overhead for one POST call), or similar libraries adds bloat for zero value. Write a thin `notify()` abstraction with provider-specific formatters. |
### CLI & Skill Packaging
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Claude Code Plugin system | Claude Code 1.0.33+ | Distribution & registration | Package as a **Claude Code plugin** (not just a standalone skill). Plugins support skills + agents + hooks + MCP servers in a single distributable unit. Uses `.claude-plugin/plugin.json` manifest, `skills/` directory with `SKILL.md` files, and can be distributed via plugin marketplaces or `--plugin-dir`. This is the official, supported distribution mechanism. |
| npm `postinstall` / `preuninstall` | Built-in | Auto-registration on install | Follow the pattern from `agent-skill-npm-boilerplate`: postinstall script copies skill files to `~/.claude/skills/` (or plugin dir), preuninstall removes them. This lets users `npm install -g claude-auto` and immediately have the skill available. |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `execa` | ^9.6 | Process spawning (non-Claude) | For spawning `git`, `gh`, `launchctl`, and other CLI tools. Promise-based, excellent error handling, proper signal forwarding. **Do NOT use for spawning Claude** -- use the Agent SDK instead. ESM-only since v6. |
| `chalk` | ^5.4 | Terminal colors | For colored CLI output in the skill's responses and log formatting. ESM-only since v5. |
| `ora` | ^8.2 | Terminal spinners | For long-running operations (setting up cron, testing webhook). ESM-only. |
| `enquirer` | ^2.4 | Interactive prompts | For the guided setup wizard when invoked outside of Claude (direct CLI usage). Note: within a Claude skill, Claude itself handles the conversation -- enquirer is for standalone CLI mode only. |
| `nanoid` | ^5.1 | Unique job IDs | Generates short, URL-safe unique IDs for job identification. Smaller than UUID, more readable in logs and config files. |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| `vitest` | Testing | Fast, TypeScript-native, compatible with ESM modules. Use for unit tests of config parsing, cron manipulation, webhook formatting. |
| `@biomejs/biome` | Lint + format | Single tool replacing ESLint + Prettier. Faster, zero-config for TypeScript projects. |
| `tsup` | Build | (listed above) Outputs ESM + CJS dual packages. |
| `tsx` | Dev execution | (listed above) `tsx watch src/index.ts` for development. |
| `changesets` | Version management | Standard npm package versioning workflow for when this gets published. |
## Architecture Decision: Agent SDK vs CLI Spawning
| Aspect | Agent SDK (`query()`) | Raw CLI (`claude -p`) |
|--------|----------------------|----------------------|
| Process management | Handled (abort, cleanup) | Manual |
| Message streaming | Async generator with typed messages | Parse stdout JSON manually |
| System prompt | `systemPrompt` option | `--system-prompt` or `--append-system-prompt` flag |
| Tool control | `allowedTools`, `disallowedTools` options | `--allowedTools` flag |
| Permission bypass | `permissionMode: 'bypassPermissions'` | `--dangerously-skip-permissions` flag |
| Working directory | `cwd` option | Must `cd` or set `cwd` in spawn |
| Session management | `resume`, `sessionId` options | `--resume` flag |
| Hooks | Programmatic callbacks | Not available |
| Error handling | Typed error messages in stream | Parse exit codes |
| Budget control | `maxBudgetUsd` option | Not available |
| Turn limits | `maxTurns` option | Not available |
## Architecture Decision: Skill vs Plugin Distribution
## Architecture Decision: Config Format
- **Multiline strings**: System prompts are the primary config value users will edit. YAML's `|` block scalar syntax is far more readable than JSON escaped strings or TOML's `"""`.
- **Comments**: Users need to annotate config files. JSON doesn't support comments.
- **Familiar**: Developers working with CI/CD (GitHub Actions, etc.) already know YAML.
- **Round-trip safe**: The `yaml` npm package preserves comments on read-modify-write cycles.
## Installation
# Core production dependencies
# Process management (for non-Claude spawning: git, gh, launchctl)
# CLI UX (only needed if building standalone CLI mode)
# Dev dependencies
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@anthropic-ai/claude-agent-sdk` | Raw `claude -p` via `execa` | Only if you need to support Claude Code versions older than the Agent SDK, or if the SDK has a critical bug. The CLI approach is simpler but loses typed messages, hooks, budget control, and session management. |
| `crontab` (npm) | Custom crontab wrapper via `child_process` | If the `crontab` npm package has compatibility issues (it's old). Writing `crontab -l | grep | crontab -` is ~30 lines and fully controllable. **This is the likely fallback.** |
| `yaml` (npm) | TOML via `smol-toml` | If the project pivots to a more structured config format. TOML is better for flat key-value configs but worse for multiline strings (system prompts). |
| `zod` | `ajv` + JSON Schema | If you need JSON Schema compatibility for external tools. Zod is better for TypeScript-first projects. |
| `plist` (npm) | `simple-plist` | If you need binary plist support. `plist` handles XML plists which is sufficient for launchd agents. `simple-plist` adds binary read/write but hasn't been updated in 3 years. |
| Native `fetch` | `@slack/webhook` + `discord-webhook-node` | Never for this project. The webhook libraries add dependency weight for what amounts to a single `fetch()` POST call per provider. Only consider if webhook APIs become complex (auth tokens, rate limiting, retries). |
| `tsup` | `unbuild` or `pkgroll` | If you need Rollup-based features. `tsup` (esbuild-based) is faster and simpler for this use case. |
| Plugin distribution | Standalone skill (just SKILL.md) | If you only need one slash command. Plugin distribution is better here because we need multiple skills (setup, list, pause, resume, edit, remove, status, logs) plus potentially agents and hooks. |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `node-cron` / `cron` (npm) | These are **in-process** schedulers -- they require a long-running Node.js daemon. If the process dies, all jobs stop. We need **system-level** scheduling that survives reboots and process crashes. | System crontab (Linux) or launchd (macOS) via the `crontab` npm package or custom wrapper. |
| `pm2` / `forever` | Process managers add unnecessary complexity. The cron job should be a fire-and-forget script invocation, not a long-running daemon. System cron/launchd already handles scheduling and restart. | System crontab / launchd. |
| `discord.js` / `slack-bolt` | Full Discord/Slack SDK libraries for what is a single webhook POST. Massive dependency trees, complex auth flows we don't need. | Native `fetch()` with a thin formatting layer. |
| `commander` / `yargs` | Heavy CLI argument parsing frameworks. Our primary interface is Claude Code skills (conversation-driven), not traditional CLI flags. The runner script needs minimal arg parsing (just `--job-id`). | `process.argv` parsing or `parseArgs` (built into Node 18.3+). |
| `dotenv` | Environment variable loading from `.env` files. Config should live in structured YAML files, not scattered environment variables. The API key comes from the user's existing `ANTHROPIC_API_KEY` env var. | YAML config files + existing env vars. |
| `@anthropic-ai/claude-code` (old SDK) | **Renamed to `@anthropic-ai/claude-agent-sdk`**. The old package name may still resolve but is deprecated. | `@anthropic-ai/claude-agent-sdk` |
| `cron-job-manager` | Wrapper around the `cron` npm package (in-process). Same problem as `node-cron`. | System crontab / launchd. |
| `js-yaml` | Older YAML library. The `yaml` package is actively maintained, has better TypeScript support, preserves comments on round-trip, and supports YAML 1.2. | `yaml` (npm package). |
| `enquirer` in skill context | Within a Claude Code skill, Claude handles the conversation. Don't try to spawn interactive terminal prompts inside a skill -- it won't work. | Let Claude drive the conversation via SKILL.md instructions. `enquirer` is only for standalone CLI mode. |
## Stack Patterns by Variant
- Use launchd via `plist` generation + `launchctl load/unload`
- launchd is more reliable than crontab on macOS (survives sleep/wake, provides logging)
- Store plists in `~/Library/LaunchAgents/com.claude-auto.<job-id>.plist`
- Use system crontab via the `crontab` npm package or custom wrapper
- Simpler than launchd -- single crontab entry per job
- Entry format: `0 */6 * * * /usr/local/bin/node /path/to/runner.js --job-id abc123 >> /path/to/logs/abc123.log 2>&1`
- Detect platform via `process.platform`
- Abstract scheduler behind an interface: `Scheduler.install(job)`, `Scheduler.remove(job)`, `Scheduler.list()`
- Implement `CrontabScheduler` (Linux) and `LaunchdScheduler` (macOS)
- macOS prefers launchd but crontab also works -- start with crontab on both platforms for simplicity, add launchd as an enhancement
- Claude itself is the NL parser. The skill prompt instructs Claude to convert "every 6 hours" to `0 */6 * * *`
- Validate the generated cron expression with `cron-parser`
- Show human-readable confirmation with `cronstrue`
- No dedicated NL-to-cron library needed -- this is a perfect use case for having Claude in the loop
## Version Compatibility
| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@anthropic-ai/claude-agent-sdk@^0.1.58` | Node.js 18+ | Requires Claude Code installed on the system. Uses internal Claude Code executable. |
| `execa@^9.6` | Node.js 18.19+ | ESM-only since v6. Must use `import`, not `require()`. |
| `chalk@^5.4` | Node.js 18+ | ESM-only since v5. |
| `yaml@^2.8` | Node.js 14+ | No compatibility concerns. |
| `zod@^4.3` | TypeScript 5.0+ | v4 has breaking changes from v3. The Agent SDK supports both Zod 3 and Zod 4. |
| `cron-parser@^5.0` | Node.js 18+ | Major version bump from v4 with new API (`CronExpressionParser.parse()` instead of `parseExpression()`). |
| `tsup@^8.4` | Node.js 18+ | Uses esbuild internally. |
| `plist@^3.1` | Node.js 12+ | Stable, no compatibility concerns. |
## Sources
- [Claude Code Skills documentation](https://code.claude.com/docs/en/skills) -- Skill structure, SKILL.md format, frontmatter reference, invocation control (HIGH confidence)
- [Claude Code Plugins documentation](https://code.claude.com/docs/en/plugins) -- Plugin structure, `.claude-plugin/plugin.json` manifest, distribution model (HIGH confidence)
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) -- `query()` API, TypeScript usage, capabilities (HIGH confidence)
- [Claude Agent SDK TypeScript reference](https://platform.claude.com/docs/en/agent-sdk/typescript) -- Full `Options` type, `Query` object, message types (HIGH confidence)
- [Claude Code headless mode docs](https://code.claude.com/docs/en/headless) -- CLI flags (`-p`, `--output-format`, `--allowedTools`), streaming, session management (HIGH confidence)
- [agent-skill-npm-boilerplate](https://github.com/neovateai/agent-skill-npm-boilerplate) -- npm postinstall skill registration pattern (MEDIUM confidence -- community project)
- [@anthropic-ai/claude-agent-sdk on npm](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) -- Version 0.1.58 (MEDIUM confidence -- version may have advanced)
- [crontab npm package](https://www.npmjs.com/package/crontab) -- v1.4.2, system crontab CRUD (MEDIUM confidence -- last published 5 years ago)
- [node-crontab GitHub](https://github.com/dachev/node-crontab) -- API details, last commit Dec 2024 (MEDIUM confidence)
- [plist npm package](https://www.npmjs.com/package/plist) -- v3.1.0, plist read/write (HIGH confidence)
- [cron-parser npm](https://www.npmjs.com/package/cron-parser) -- Cron validation and iteration (HIGH confidence)
- [cronstrue npm](https://www.npmjs.com/package/cronstrue) -- Cron-to-human-readable (HIGH confidence)
- [yaml npm package](https://www.npmjs.com/package/yaml) -- v2.8.2 (HIGH confidence)
- [Zod v4 release](https://zod.dev/v4) -- v4.3.6, 14x faster parsing (HIGH confidence)
- [execa npm](https://www.npmjs.com/package/execa) -- v9.6.0, 94M weekly downloads (HIGH confidence)
- [tsup documentation](https://tsup.egoist.dev/) -- TypeScript bundler (HIGH confidence)
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
