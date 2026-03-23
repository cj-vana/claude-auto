# claude-auto

Autonomous Claude Code cron jobs for continuous codebase improvement. Set up a schedule, point it at a repo, and wake up to PRs.

Claude researches your codebase, picks the highest-value work (open issues, bugs it discovers, or features it wants to add), creates a branch, does the work, updates docs, opens a PR, and notifies you. It learns from previous runs, iterates on reviewer feedback, and can run a multi-stage plan/implement/review pipeline for higher-quality output.

## Install

```bash
npm install -g claude-auto
```

This registers `claude-auto` as a Claude Code plugin. The `/claude-auto:setup` slash command becomes available in Claude Code sessions.

### Requirements

- Node.js >= 22
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed
- [GitHub CLI](https://cli.github.com/) (`gh`) authenticated
- macOS, Linux, or Windows

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

1. **Budget check** — skip if daily/weekly/monthly cap exceeded
2. **Load context** — prior runs from SQLite (avoids duplicate work)
3. **Check PR feedback** — if reviewers left comments on a previous PR, address those first
4. **Acquire lock** — prevents overlapping runs
5. **Pull latest** from configured branch
6. **Pick work** following priority chain:
   - Open PRs with review comments (highest priority)
   - Open GitHub issues / feature requests (triaged by complexity)
   - Bugs Claude discovers in the code
   - Features Claude thinks would be useful
7. **Execute** — single Claude spawn or multi-stage pipeline (plan → implement → review)
8. **Rebase check** — auto-resolve if target branch diverged
9. **Open PR** with detailed description
10. **Update documentation** affected by changes
11. **Notify** via Discord, Slack, Telegram, or GitHub comments
12. **Record** cost and context to SQLite for future runs

## Model Selection

Configure which Claude model to use per job:

```yaml
model: opus           # or: sonnet, haiku, default
```

Or with the pipeline, configure per stage:

```yaml
pipeline:
  enabled: true
  planModel: haiku        # Fast, cheap planning
  implementModel: opus    # Best quality for code
  reviewModel: sonnet     # Balanced review
  maxReviewRounds: 2
```

Supported values: `sonnet`, `opus`, `haiku`, `default`, or full model IDs like `claude-opus-4-6`.

## Agent Pipeline

Enable multi-stage plan → implement → review for higher-quality PRs:

```yaml
pipeline:
  enabled: true
  planModel: haiku
  implementModel: opus
  reviewModel: sonnet
  fixModel: opus
  maxReviewRounds: 2
  budgetSplit:
    plan: 0.15
    implement: 0.55
    review: 0.15
    fix: 0.15
```

Each stage spawns a separate Claude instance with a stage-specific system prompt:
- **Plan** — reads codebase, understands the issue, creates implementation plan
- **Implement** — executes the plan, writes code and tests
- **Review** — checks implementation against the plan, can request changes
- **Fix** — addresses review feedback (loops until review passes or max rounds)

When the review stage finds issues, it rejects the PR and the fix stage runs. This loop continues until the review passes or `maxReviewRounds` is exceeded.

Pipeline is disabled by default. Existing single-spawn configs work identically.

## PR Feedback Loop

Claude iterates on its own PRs based on reviewer feedback:

1. Before picking new work, Claude checks for open PRs with unaddressed review comments
2. When feedback exists, Claude checks out the existing PR branch and addresses it
3. After fixing, pushes to the same branch and comments on the PR with what changed
4. After `maxFeedbackRounds` (default 3), posts a "needs human review" comment and moves on

Review comments are sanitized (XML framing, 2000-char truncation, bot comments filtered) to prevent prompt injection.

## Issue Triage

Claude evaluates issues before picking work:

- **Complexity scoring** — body length, reproduction steps, labels, assignees
- **Label priority** — "good first issue" (+30), "bug" (+20), "enhancement" (+10)
- **Skip logic** — filters out spam (too short), vague issues, already-assigned, already-attempted
- Top candidates are presented to Claude ranked by score

## Cost Tracking

Track spending and enforce budgets:

```bash
# View costs per job
claude-auto cost
claude-auto cost my-api --json

# Set budget caps in config
```

```yaml
budget:
  dailyUsd: 10.00
  weeklyUsd: 50.00
  monthlyUsd: 150.00
```

When a budget cap is reached, scheduled runs skip with a `budget-exceeded` status and send a notification. Per-run limits still apply via `guardrails.maxBudgetUsd`.

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

# Cost tracking
claude-auto cost
claude-auto cost my-api

# Pause / resume
claude-auto pause my-api
claude-auto resume my-api

# Edit configuration
claude-auto edit my-api --schedule "0 9 * * 1-5"
claude-auto edit my-api --max-turns 100
claude-auto edit my-api --model opus

# Remove a job
claude-auto remove my-api
claude-auto remove my-api --keep-logs

# Interactive dashboard
claude-auto dashboard
```

Or use Claude Code skills:

```
/claude-auto:list
/claude-auto:pause my-api
/claude-auto:edit my-api
/claude-auto:status my-api
/claude-auto:logs my-api
```

## TUI Dashboard

Launch an interactive terminal dashboard:

```bash
claude-auto dashboard
```

Features:
- Live job status with auto-refresh (3-second polling)
- Per-job cost summaries
- Last run / next run times
- Keyboard navigation: arrow keys, Enter for detail, Escape to go back
- Quick actions: `p` pause/resume, `l` view logs, `q` quit

Built with [ink](https://github.com/vadimdemedes/ink) + React. Dependencies are lazily loaded — no startup cost for non-dashboard commands.

## Configuration

Jobs are stored as human-readable YAML at `~/.claude-auto/jobs/<job-id>/config.yaml`. Edit them directly or use the CLI.

```yaml
# Job: my-api
name: my-api
repo: /Users/dev/my-api
branch: main
schedule: "0 */6 * * *"
timezone: America/Chicago
enabled: true

# Model selection
model: opus

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

# Budget caps (cumulative)
budget:
  dailyUsd: 10.00
  weeklyUsd: 50.00
  monthlyUsd: 150.00

# PR feedback
maxFeedbackRounds: 3

# Multi-stage pipeline (optional)
pipeline:
  enabled: false
  planModel: haiku
  implementModel: opus
  reviewModel: sonnet
  fixModel: opus
  maxReviewRounds: 2

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

| Flag | Config key | Effect |
|------|-----------|--------|
| `--max-turns N` | `guardrails.maxTurns` | Terminate after N Claude turns |
| `--max-budget N` | `guardrails.maxBudgetUsd` | Cap spend per run at $N |
| `--no-new-deps` | `guardrails.noNewDeps` | Prevent adding new dependencies |
| `--no-arch-changes` | `guardrails.noArchChanges` | Prevent architectural changes |
| `--bug-fix-only` | `guardrails.bugFixOnly` | Only fix bugs, no new features |
| `--restrict-paths` | `guardrails.restrictToPaths` | Only touch files in these directories |

## Notifications

Configure per job. Each provider supports event triggers:

| Event | Default | When |
|-------|---------|------|
| `onSuccess` | true | PR created successfully |
| `onFailure` | true | Run errored, merge conflict, or budget exceeded |
| `onNoChanges` | false | Claude found nothing to do |
| `onLocked` | false | Another run was already active |

GitHub issue comments are automatic — when Claude works on an issue, it comments with status and PR link.

## Git Safety

These invariants are structurally enforced (not just policy):

- **Never commits to main** or the configured branch
- **Never force pushes** — no `--force` flag exists in the codebase
- **Always creates a new branch** per run (`claude-auto/<job-id>/<timestamp>`)
- **Always opens a PR** — human review before merge
- **File-based locking** prevents concurrent runs on the same job
- **Auto-rebase** before push when target branch has diverged
- **Clean abort** on merge conflicts — never produces broken code

## Cross-Run Context

Claude remembers what it did in previous runs:

- Stores structured facts (PR URLs, issue numbers, files modified, summaries) in SQLite
- Loads a rolling window of recent runs into the system prompt
- Avoids re-opening issues it already submitted PRs for
- Tracks PR feedback rounds to know when to stop iterating

Data is stored at `~/.claude-auto/claude-auto.db` (SQLite with WAL mode).

## Platform Support

| Platform | Scheduler | Status |
|----------|-----------|--------|
| macOS | launchd (plist) | Full support |
| Linux | crontab | Full support |
| Windows | Task Scheduler (schtasks.exe) | Full support |

Common cron expressions are automatically translated to each platform's native format. Unsupported complex patterns throw a clear error with a suggestion to simplify.

## Architecture

```
claude-auto (npm package)
├── bin/
│   ├── claude-auto.ts              # CLI entry point
│   └── claude-auto-run.ts          # Cron entry point
├── src/
│   ├── core/                       # Config, job manager, schedule, types, database
│   ├── platform/                   # Crontab, launchd, schtasks adapters
│   ├── runner/                     # Orchestrator, pipeline, spawner, git ops,
│   │                               # PR feedback, issue triage, cost tracker,
│   │                               # context store, prompt builder, logger
│   ├── notifications/              # Discord/Slack/Telegram formatters + dispatcher
│   ├── cli/                        # Command router + 11 subcommands
│   └── tui/                        # ink/React dashboard (lazily loaded)
├── skills/                         # 8 Claude Code SKILL.md files
├── .claude-plugin/                 # Plugin manifest
└── scripts/                        # postinstall/preuninstall
```

## Multiple Jobs

Run different jobs for different concerns:

```bash
# Security-focused, weekly, using Opus
claude-auto create --name security-audit --repo ~/my-app \
  --schedule "0 3 * * 0" --model opus \
  --system-prompt-file security-prompt.txt

# Bug fixes, daily, budget-capped
claude-auto create --name bug-fixer --repo ~/my-app \
  --schedule "0 2 * * *" --bug-fix-only \
  --max-budget 3.00

# Pipeline mode for complex work
claude-auto create --name feature-builder --repo ~/my-app \
  --schedule "0 10 * * 1-5" --model opus
# Then enable pipeline in config:
# claude-auto edit feature-builder (set pipeline.enabled: true)
```

## Development

```bash
git clone https://github.com/cj-vana/claude-auto.git
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
