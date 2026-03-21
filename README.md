# claude-auto

Autonomous Claude Code cron jobs for continuous codebase improvement. Set up a schedule, point it at a repo, and wake up to PRs.

Claude researches your codebase, picks work to do (open issues, bugs it discovers, or features it wants to add), creates a branch, does the work, updates docs, opens a PR, and notifies you. Fully configurable per job — schedule, focus areas, system prompt personality, guardrails, notification channels.

## Install

```bash
npm install -g claude-auto
```

This registers `claude-auto` as a Claude Code plugin. The `/claude-auto:setup` slash command becomes available in Claude Code sessions.

### Requirements

- Node.js >= 22
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed
- [GitHub CLI](https://cli.github.com/) (`gh`) authenticated
- macOS or Linux (uses system cron/launchd)

## Quick Start

### Option A: Conversational Setup (Recommended)

In a Claude Code session:

```
/claude-auto:setup
```

Claude walks you through everything — repo, branch, schedule, focus areas, system prompt, notifications, guardrails — and creates the job.

### Option B: CLI

```bash
claude-auto create \
  --name my-api \
  --repo /path/to/my-api \
  --branch main \
  --schedule "0 */6 * * *" \
  --system-prompt-file prompt.txt
```

## How It Works

Each cron tick:

1. **Acquires lock** — prevents overlapping runs
2. **Pulls latest** from configured branch
3. **Creates new branch** — never commits to main
4. **Researches codebase** — understands current implementation
5. **Picks work** following priority chain:
   - Open GitHub issues / feature requests
   - Bugs Claude discovers in the code
   - Features Claude thinks would be useful
6. **Does the work** — Claude Code in headless mode
7. **Opens PR** with detailed description
8. **Updates documentation** affected by changes
9. **Notifies you** via Discord, Slack, Telegram, or GitHub comments
10. **Logs the run** for audit trail

## Job Management

```bash
# List all jobs
claude-auto list
claude-auto list --json

# View run history
claude-auto logs my-api
claude-auto logs my-api --limit 5

# Aggregate report
claude-auto report
claude-auto report my-api

# Pause / resume
claude-auto pause my-api
claude-auto resume my-api

# Edit configuration
claude-auto edit my-api --schedule "0 9 * * 1-5"
claude-auto edit my-api --max-turns 100

# Remove a job
claude-auto remove my-api
claude-auto remove my-api --keep-logs
```

Or use Claude Code skills:

```
/claude-auto:list
/claude-auto:pause my-api
/claude-auto:edit my-api
```

## Configuration

Jobs are stored as human-readable YAML at `~/.claude-auto/jobs/<job-id>/config.yaml`. You can edit them directly.

```yaml
# Job: my-api
name: my-api
repo: /Users/dev/my-api
branch: main
schedule: "0 */6 * * *"
timezone: America/Chicago
enabled: true

# What Claude focuses on
focus:
  - Fix open issues
  - Improve test coverage
  - Update outdated dependencies

# Custom personality
systemPrompt: |
  You are a careful, senior engineer. Prefer small, focused changes.
  Always add or update tests. Write detailed PR descriptions.
  Never introduce new dependencies without strong justification.

# Safety limits
guardrails:
  maxTurns: 50
  maxBudgetUsd: 5.00
  noNewDeps: false
  noArchChanges: false
  bugFixOnly: false
  restrictToPaths: []

# Notifications
discord:
  webhookUrl: https://discord.com/api/webhooks/...
  onSuccess: true
  onFailure: true
  onNoChanges: false
  onLocked: false

slack:
  webhookUrl: https://hooks.slack.com/services/...
  onSuccess: true
  onFailure: true

telegram:
  botToken: "123456:ABC..."
  chatId: "-100..."
  onSuccess: true
  onFailure: true
```

## Schedule Format

Natural language (Claude converts during setup):

```
every 6 hours
twice a day
weekdays at 9am
every monday at 2pm
```

Or standard cron:

```
0 */6 * * *       # every 6 hours
0 9,17 * * *      # 9am and 5pm
0 9 * * 1-5       # weekdays at 9am
0 14 * * 1        # mondays at 2pm
```

## Guardrails

Full trust by default. Optionally restrict what Claude can do:

```bash
claude-auto create \
  --name conservative-bot \
  --repo /path/to/repo \
  --schedule "0 9 * * *" \
  --max-turns 30 \
  --max-budget 2.00 \
  --no-new-deps \
  --bug-fix-only \
  --restrict-paths src/,tests/
```

| Flag | Effect |
|------|--------|
| `--max-turns N` | Terminate after N Claude turns |
| `--max-budget N` | Cap spend per run at $N |
| `--no-new-deps` | Prevent adding new dependencies |
| `--no-arch-changes` | Prevent architectural changes |
| `--bug-fix-only` | Only fix bugs, no new features |
| `--restrict-paths` | Only touch files in these directories |

## Notifications

Configure per job. Each provider supports event triggers:

| Event | Default | When |
|-------|---------|------|
| `onSuccess` | true | PR created successfully |
| `onFailure` | true | Run errored |
| `onNoChanges` | false | Claude found nothing to do |
| `onLocked` | false | Another run was already active |

Webhook URLs:
- **Discord**: Server Settings → Integrations → Webhooks
- **Slack**: api.slack.com → Your Apps → Incoming Webhooks
- **Telegram**: Message @BotFather → /newbot → use token + chat ID

GitHub issue comments are automatic — when Claude works on an issue, it comments with status and PR link.

## Git Safety

These invariants are structurally enforced (not just policy):

- **Never commits to main** or the configured branch
- **Never force pushes** — no `--force` flag exists in the codebase
- **Always creates a new branch** per run (`claude-auto/<job-id>/<timestamp>`)
- **Always opens a PR** — human review before merge
- **File-based locking** prevents concurrent runs on the same job

## Architecture

```
claude-auto (npm package)
├── bin/claude-auto.ts          # CLI entry point
├── bin/claude-auto-run.ts      # Cron entry point (what scheduler invokes)
├── src/
│   ├── core/                   # Config, job manager, schedule, types
│   ├── platform/               # Crontab (Linux) + launchd (macOS) adapters
│   ├── runner/                 # Orchestrator, Claude spawner, git ops, logger
│   ├── notifications/          # Discord/Slack/Telegram formatters + dispatcher
│   └── cli/                    # Command router + 10 subcommands
├── skills/                     # 8 Claude Code SKILL.md files
├── .claude-plugin/             # Plugin manifest
└── scripts/                    # postinstall/preuninstall for plugin registration
```

## Multiple Jobs

Run different jobs for different concerns:

```bash
# Security-focused, weekly
claude-auto create --name security-audit --repo ~/my-app \
  --schedule "0 3 * * 0" --system-prompt-file security-prompt.txt

# Bug fixes, daily
claude-auto create --name bug-fixer --repo ~/my-app \
  --schedule "0 2 * * *" --bug-fix-only

# Docs improvements, twice a week
claude-auto create --name doc-bot --repo ~/my-app \
  --schedule "0 10 * * 2,4" --system-prompt-file docs-prompt.txt
```

Each job has its own schedule, system prompt, guardrails, and notification config.

## Development

```bash
git clone https://github.com/cjvana/claude-auto.git
cd claude-auto
npm install
npm run build
npm test
```

```bash
npm run typecheck    # TypeScript type checking
npm run lint         # Biome linting
npm run test:watch   # Watch mode
```

## License

MIT
