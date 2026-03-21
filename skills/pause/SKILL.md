---
name: pause
description: Pause an active autonomous cron job without losing its configuration. Use when the user wants to temporarily stop a job from running.
allowed-tools: Bash(claude-auto *)
---

Pause an autonomous cron job. If the user hasn't specified which job, show
available jobs first:

```bash
claude-auto list
```

Then pause the specified job:

```bash
claude-auto pause $ARGUMENTS
```

After pausing, confirm the job is paused and remind the user they can
resume it later with `/claude-auto:resume`.
