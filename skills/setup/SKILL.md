---
name: setup
description: Set up a new autonomous Claude cron job for continuous codebase improvement. Use when the user wants to create a scheduled job where Claude autonomously works on their repo.
allowed-tools: Bash(claude-auto *)
---

You are helping the user set up a new autonomous cron job where Claude will
continuously improve their codebase. Walk them through each step conversationally.
Be friendly, explain what each option does, and provide sensible defaults.

## Step 1: Repository

Ask which repository to target. Accept either:
- A local filesystem path (e.g., `/Users/dev/my-project`)
- A GitHub identifier: `owner/repo` or a full URL

If they give a GitHub identifier, ask where they'd like it cloned locally.
Suggest `~/projects/<repo-name>` as the default location.

Validate the repository by running:

```bash
claude-auto check-repo --path "$PATH"
```

If the path doesn't exist and they provided a GitHub identifier, let them know
that `claude-auto create` will handle cloning automatically via the `--github-repo`
flag. Confirm the clone location before proceeding.

## Step 2: Branch

Ask which branch the autonomous agent should target for pull requests.

- Default: `main`
- Common alternatives: `develop`, `dev`, `master`

Use whatever branch they use for merging PRs in their workflow.

## Step 3: Schedule

Ask how often Claude should work on the repo. Accept natural language or raw cron:

- "every 6 hours"
- "twice a day" (translates to `0 */12 * * *`)
- "weekdays at 9am" (translates to `0 9 * * 1-5`)
- "once a day at midnight" (translates to `0 0 * * *`)
- Raw 5-field cron: `0 */6 * * *`

Convert natural language to a standard 5-field cron expression. Confirm with the
user: "So Claude will run [human-readable description]. Sound good?"

Also ask about timezone. Default to their local timezone. Common choices:
`America/New_York`, `America/Los_Angeles`, `Europe/London`, `UTC`.

## Step 4: Focus Areas

Ask what Claude should focus on during each run. They can pick multiple:

- **open-issues** -- Work through open GitHub issues, prioritizing by labels
- **bug-discovery** -- Proactively scan the codebase for bugs and fix them
- **features** -- Suggest and implement small improvements
- **documentation** -- Update and improve docs, READMEs, and code comments

Default: `open-issues, bug-discovery`

Explain that Claude will prioritize in the order: issues > bugs > features > docs.

## Step 5: System Prompt (The Personality)

This is the most important step. Help the user craft a system prompt that defines
how the autonomous Claude instance behaves. This prompt shapes every decision
Claude makes while working on the codebase.

Ask the user about each of these aspects:

**Coding style**
- Conservative (stick to existing patterns) or experimental (try modern approaches)?
- Verbose (explicit, well-commented) or concise (minimal, self-documenting)?
- Strong opinions on specific patterns? (e.g., prefer composition over inheritance)

**PR style**
- Big sweeping changes or small focused PRs?
- How detailed should PR descriptions be?
- Should Claude add tests with every change?

**Priorities**
- Tests first? Documentation first? Ship fast and iterate?
- Code quality vs speed tradeoff?
- Any specific areas of the codebase that need attention?

**Things to avoid**
- Specific directories or files that should not be touched?
- Patterns or libraries they dislike?
- Approaches that have caused problems before?

**Personality**
- Meticulous code reviewer who catches everything?
- Move-fast builder who ships features?
- Security hawk who locks things down?
- Documentation enthusiast who explains everything?

Based on their answers, **draft a complete system prompt** and show it to them.
For example:

> "You are a meticulous software engineer maintaining this TypeScript project.
> Focus on code quality and test coverage. Never add new dependencies without
> extremely good reason. Prefer small, focused PRs over large sweeping changes.
> Always run tests before committing. When fixing bugs, add a regression test.
> Avoid touching the legacy/ directory unless specifically asked."

Iterate on the prompt until the user is happy with it. This is a conversation --
refine based on their feedback.

Once finalized, write the system prompt to a temporary file:

```bash
cat > /tmp/claude-auto-system-prompt.txt << 'PROMPT_EOF'
[the finalized system prompt text]
PROMPT_EOF
```

This file will be passed to the create command in Step 8.

## Step 6: Notifications (Optional)

Ask if the user wants to be notified when Claude creates PRs, encounters errors,
or finishes a run. This is optional -- skip if they say no.

Supported notification channels:
- **Discord**: Provide a webhook URL (`https://discord.com/api/webhooks/...`)
- **Slack**: Provide a webhook URL (`https://hooks.slack.com/services/...`)
- **Telegram**: Provide a bot token and chat ID

They can configure multiple channels. For each, ask which events to notify on:
success, failure, or both (default: both).

## Step 7: Guardrails (Optional)

Ask if the user wants any restrictions on what Claude can do. This is optional --
default is full trust with sensible limits.

Available guardrails:
- **Max turns** per run (default: 50) -- how many tool-use steps Claude can take
- **Max budget** per run in USD (default: $5.00) -- spending limit per execution
- **No new dependencies** -- prevent Claude from adding packages
- **No architecture changes** -- keep Claude from restructuring the project
- **Bug fix only** -- restrict to fixing bugs, no new features
- **Restrict to paths** -- limit Claude to specific directories (comma-separated)

Default: max 50 turns, $5.00 budget, no other restrictions.

## Step 8: Create the Job

Summarize all the gathered configuration and ask for final confirmation. Then
construct and run the create command:

```bash
claude-auto create \
  --name "$NAME" \
  --repo "$REPO_PATH" \
  --branch "$BRANCH" \
  --schedule "$CRON_EXPRESSION" \
  --timezone "$TIMEZONE" \
  --focus "$FOCUS_CSV" \
  --system-prompt-file /tmp/claude-auto-system-prompt.txt \
  [--github-repo "$GITHUB_REPO"] \
  [--notify-discord "$DISCORD_URL"] \
  [--notify-slack "$SLACK_URL"] \
  [--notify-telegram "$BOT_TOKEN:$CHAT_ID"] \
  [--max-turns N] \
  [--max-budget N] \
  [--no-new-deps] \
  [--no-arch-changes] \
  [--bug-fix-only] \
  [--restrict-paths "$PATHS_CSV"]
```

After the command succeeds, present to the user:
- **Job ID** and name
- **Schedule** in human-readable form
- **Next run time**
- **Config file location** (so they know where to find it for manual edits)

Remind them about management commands:
- `/claude-auto:list` -- see all jobs
- `/claude-auto:pause` -- temporarily stop a job
- `/claude-auto:edit` -- change settings
- `/claude-auto:status` -- check job health
- `/claude-auto:logs` -- view run history

Clean up the temp file:

```bash
rm -f /tmp/claude-auto-system-prompt.txt
```
