# AGENTS.md

## Ship

Ship profile: `vercel-static`

Production URL: <https://checkboxes.xyz>

Vercel Git integration deploys production on push to `main`. After push, verify <https://checkboxes.xyz> returns HTTP 200 — do not run a manual `vercel deploy` unless Git integration is broken.

Local gate before push: `npm run lint && npm run check:yaml && npx astro check && npm run build`.

## Purpose

Checkbox implementation gallery — multiple frameworks and approaches with performance metrics. See `README.md`.

## Commands

```shell
npm install
npm run dev
npm run build
npm run preview
npm run generate-stats
```

## Project Rules

- Use `--headed --persistent` when launching playwright-cli for interactive browser sessions. Without `--headed`, it defaults to headless.

## Deploy

Production deploy is owned by **Vercel's GitHub integration** — a push to `main` triggers a Vercel build/deploy after the pre-push gate passes. There is no local `npm run deploy` or CLI deploy step; `/ship` records `deploy: none (Vercel Git)`.

## CI (local pre-push gate)

- `.git-hooks/pre-push` (wired via `core.hooksPath=.git-hooks`, fires on push to `main`) runs lint → yaml → astro check → build. It does **not** deploy. After the push lands, babysit the Vercel GitHub deployment in the dashboard.

## AWS

Set `AWS_PROFILE` locally in your shell or gitignored `.env.local` — never commit profile names.

## Logging & shared-infra

Structured logging and alarm conventions: see `~/code/shared-infra/docs/adding-a-project.md`. Canonical Node logger: `~/code/family-memory/src/shared/logging.ts` (sync via `scripts/sync-shared-logger.sh` where applicable).
