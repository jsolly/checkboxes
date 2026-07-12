# AGENTS.md

## Ship

Ship profile: `vercel-static`

Integration: `pr-auto-merge`

CI owner: `local`

Production URL: <https://www.checkboxes.xyz>

Profile delta: `https://checkboxes.xyz` redirects (308) to the canonical `www` URL.

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

## AWS

Set `AWS_PROFILE` locally in your shell or gitignored `.env.local` — never commit profile names.

## Logging & shared-infra

Structured logging and alarm conventions: see `~/code/shared-infra/docs/adding-a-project.md`. Canonical Node logger: `~/code/family-memory/src/shared/logging.ts` (sync via `scripts/sync-shared-logger.sh` where applicable).

## Local UI verification

No auth — public UI only. Follow `rules/frontend-verification.md` (fleet smoke: desktop + mobile screenshots, console clean).

- **Dev server:** `npm run dev` (Astro; use the URL printed on start, typically <http://localhost:4321>)
- **Auth:** none — public pages only. No `DEFAULT_USER` / `DEFAULT_PASSWORD`.
