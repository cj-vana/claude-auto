---
name: list
description: List all configured autonomous cron jobs with their status, schedule, and last run info. Use when the user asks about their jobs, what's running, or wants an overview.
allowed-tools: Bash(claude-auto *)
---

List all configured autonomous cron jobs by running:

```bash
claude-auto list
```

Present the output in a readable format showing each job's name, schedule,
status (enabled/paused), and last run result.

If no jobs exist, suggest the user run `/claude-auto:setup` to create their
first autonomous job.

For more detailed information about a specific job, use:

```bash
claude-auto list --json
```

This returns structured JSON output that you can filter and format to answer
specific questions about individual jobs.
