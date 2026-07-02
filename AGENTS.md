# AGENTS.md

## Ship

Ship profile: `vercel-static`

**Integration: branch → PR → CI-gated auto-merge (canonical).** Open a PR from your branch; `.github/workflows/auto-merge.yml` enables squash auto-merge once **`CI / ci`** is green. Direct push to `main` is break-glass only.

Production URL: <https://www.checkboxes.xyz>

Apex `https://checkboxes.xyz` redirects (308) to `https://www.checkboxes.xyz/` — use the www URL for curl/smoke checks and sitemap canonicals.

**Deploy model:** Vercel Git integration deploys production on merge to `main`. No local `npm run deploy`, `vercel deploy --prod`, or CLI deploy step.

**Local gate before push** (cheap checks; full gate runs in GitHub CI on the PR):

```shell
npm ci   # or npm run worktree:init in a worktree
npm run lint && npm run check:yaml && npx astro check && npm run build
```

Markdown lint uses `node_modules/.bin/markdownlint-cli2` (pinned in `package-lock.json`). If `node_modules` is missing, the gate fails — no npx fallback.

**Post-push verification (step 12):** After push lands, wait for the Vercel Git deploy to reach READY, then:

```shell
curl -sf -o /dev/null -w '%{http_code}\n' https://www.checkboxes.xyz
curl -sf https://www.checkboxes.xyz | grep -q 'checkboxes.xyz'
```

Record **`deploy: verified at <https://www.checkboxes.xyz> (Vercel Git)`** when production returns HTTP 200. Do not treat push alone as shipped.

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
