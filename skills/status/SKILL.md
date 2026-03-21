---
name: status
description: Show detailed status and last run information for an autonomous cron job. Use when the user wants to check if a job is healthy and working.
allowed-tools: Bash(claude-auto *)
---

Show the status of an autonomous cron job. If the user hasn't specified
which job, show all jobs:

```bash
claude-auto list --json
```

For detailed status including last run information:

```bash
claude-auto logs <jobId> --limit 1
```

Present a summary including:
- Current status (enabled, paused, or errored)
- Schedule and next run time
- Last run result (success, failure, no changes)
- Number of PRs created in recent runs

If there are issues, suggest relevant management commands like
`/claude-auto:edit` or `/claude-auto:pause`.
