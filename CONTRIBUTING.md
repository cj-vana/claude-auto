# Contributing to claude-auto

Thanks for your interest in contributing! This project is built with Claude Code and the GSD workflow, but contributions of all kinds are welcome.

## Getting Started

```bash
git clone https://github.com/cjvana/claude-auto.git
cd claude-auto
npm install
npm test
```

### Prerequisites

- Node.js >= 22
- npm >= 10

### Commands

```bash
npm run build        # Build with tsup
npm test             # Run tests (vitest)
npm run test:watch   # Watch mode
npm run typecheck    # TypeScript type check
npm run lint         # Biome lint
npm run lint:fix     # Auto-fix lint issues
```

## Project Structure

```
src/
├── core/           # Config schema, job manager, schedule validation
├── platform/       # Crontab (Linux) + launchd (macOS) adapters
├── runner/         # Orchestrator, Claude spawner, git ops, locking, logging
├── notifications/  # Webhook formatters + dispatcher
├── cli/            # Command router + subcommands
└── index.ts        # Barrel export

bin/                # CLI and cron entry points
skills/             # Claude Code SKILL.md files
tests/              # Mirrors src/ structure
```

## How to Contribute

### Bug Reports

Open an issue using the **Bug Report** template. Include:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your OS and Node version

### Feature Requests

Open an issue using the **Feature Request** template. Describe:
- What you want to do
- Why it would be useful
- How it might work

### Pull Requests

1. Fork the repo
2. Create a branch (`git checkout -b fix/my-fix`)
3. Make your changes
4. Run tests (`npm test`)
5. Run type check (`npm run typecheck`)
6. Run lint (`npm run lint`)
7. Commit with a descriptive message
8. Push and open a PR

### Commit Messages

We use conventional commits:

```
feat: add new notification provider
fix: correct runner path resolution
test: add edge case for schedule parsing
docs: update README with new CLI flag
chore: bump dependencies
```

### Code Style

- TypeScript strict mode
- ESM only (`import`/`export`, no `require`)
- Biome for formatting and linting (run `npm run lint:fix`)
- Tests alongside source in `tests/` mirror structure
- No classes — prefer functions and plain objects

### Testing

- Write tests for new functionality
- Tests use vitest
- Mock external calls (child_process, filesystem, fetch)
- Run the full suite before submitting: `npm test`

## Architecture Decisions

Key decisions that guide contributions:

- **Skills call CLI for mutations** — SKILL.md files invoke `claude-auto <command>` via Bash. Skills handle conversation, CLI handles correctness.
- **CLI spawning over Agent SDK** — We use `claude -p` (CLI) not the Agent SDK for spawning Claude. Simpler, no orphaned process issues.
- **YAML with Document API** — Config uses `yaml` package's `parseDocument()` for comment preservation. Never use `parse()`/`stringify()`.
- **Best-effort notifications** — Notification failures are caught and ignored. A webhook being down should never crash a run.
- **No force push** — The `--force` flag does not exist anywhere in git operations. This is structural, not policy.

## Questions?

Open a discussion or issue. We're happy to help.
