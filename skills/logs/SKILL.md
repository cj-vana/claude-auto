---
name: logs
description: View run history and logs for an autonomous cron job. Use when the user wants to see what Claude has been doing or debug a job.
allowed-tools: Bash(claude-auto *)
---

View run history for an autonomous cron job. If the user hasn't specified
which job, show available jobs first:

```bash
claude-auto list
```

Show recent runs:

```bash
claude-auto logs <jobId>
```

For more history, use the limit flag:

```bash
claude-auto logs <jobId> --limit 20
```

For an aggregate view across all jobs, suggest:

```bash
claude-auto report
```

Present the log output in a readable format, highlighting successes,
failures, and any PRs that were created.
