---
name: edit
description: Edit the configuration of an existing autonomous cron job. Use when the user wants to change a job's schedule, focus areas, branch, guardrails, or other settings.
allowed-tools: Bash(claude-auto *)
---

Edit an existing autonomous cron job. If the user hasn't specified which job,
show available jobs first:

```bash
claude-auto list
```

Ask what they want to change. Supported fields:

- **Name**: `claude-auto edit <jobId> --name "New Name"`
- **Schedule**: `claude-auto edit <jobId> --schedule "0 */8 * * *"`
- **Timezone**: `claude-auto edit <jobId> --timezone "America/New_York"`
- **Branch**: `claude-auto edit <jobId> --branch "develop"`
- **Max turns**: `claude-auto edit <jobId> --max-turns 100`
- **Max budget**: `claude-auto edit <jobId> --max-budget 10.00`
- **Focus areas**: `claude-auto edit <jobId> --focus "open-issues,features"`

Multiple flags can be combined in a single command. After editing, confirm
the changes and show the updated configuration.
