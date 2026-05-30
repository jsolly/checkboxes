# AGENTS.md

@.agents/AGENTS.md

## Cursor Cloud

Cloud agents: see `.agents/docs/cloud-agents.md` (fleet layout, subtree updates).

## Purpose

Checkbox implementation gallery — multiple frameworks and approaches with performance metrics. See `README.md`.

## Commands

```shell
pnpm install
pnpm dev
pnpm build
pnpm preview
pnpm generate-stats
```

## Project Rules

- Use `--headed --persistent` when launching playwright-cli for interactive browser sessions. Without `--headed`, it defaults to headless.

## AWS

Set `AWS_PROFILE` locally in your shell or gitignored `.env.local` — never commit profile names.

## Logging & alert-hub

Structured logging and alarm conventions: see `~/code/alert-hub/docs/adding-a-project.md`. Canonical Node logger: `~/code/family-memory/src/shared/logging.ts` (sync via `scripts/sync-shared-logger.sh` where applicable).
