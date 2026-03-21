---
name: remove
description: Permanently remove an autonomous cron job and its schedule. Use when the user wants to delete a job they no longer need.
allowed-tools: Bash(claude-auto *)
---

Remove an autonomous cron job. This is destructive and cannot be undone.

If the user hasn't specified which job, show available jobs first:

```bash
claude-auto list
```

Before removing, confirm with the user that they want to permanently delete
the job. Ask if they want to keep the run logs:

- **Keep logs**: `claude-auto remove <jobId> --keep-logs`
- **Remove everything**: `claude-auto remove <jobId>`

After removal, confirm the job has been deleted and its scheduled runs
have been unregistered.
