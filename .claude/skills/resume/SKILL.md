---
name: resume
description: Resume a paused autonomous cron job. Use when the user wants to reactivate a previously paused job.
allowed-tools: Bash(claude-auto *)
---

Resume a paused autonomous cron job. If the user hasn't specified which job,
show paused jobs first:

```bash
claude-auto list
```

Then resume the specified job:

```bash
claude-auto resume $ARGUMENTS
```

After resuming, confirm the job is active again and show when the next
scheduled run will be.
