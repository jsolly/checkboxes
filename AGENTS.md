# AGENTS.md

## Ship

Ship profile: `vercel-static`

Integration: `pr-auto-merge`

The auto-merge bot waits for this repo's `ci` check because Free private repos cannot set required checks.

CI owner: `local`

Production URL: <https://www.checkboxes.xyz>

Profile delta: `https://checkboxes.xyz` redirects (308) to the canonical `www` URL.

**Prod verify:** `/ship` requires `x-release-id` to match `origin/main` (12-char). HTTP 200 alone is insufficient.

```bash
curl -sSIL https://www.checkboxes.xyz/ | rg -i '^x-release-id:'
```

## No automatic Vercel Previews

Branch pushes do **not** create Preview deployments (`vercel.json` `git.deploymentEnabled`). Production Git deploys on `main` stay on.

Opt-in Preview: comment `/preview` as the first non-empty line on a same-repo PR (owner/member/collaborator User), or run **Actions → Vercel Preview** with the PR number. GitHub runs that workflow from `main`. One-shot: new commits do not rebuild until you ask again. Requires GitHub secret `VERCEL_TOKEN`. Agents must not comment `/preview` or run Actions → Vercel Preview unless John asked.

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

## No CDN for app assets

Prefer local npm packages (or same-origin vendored files under `src/vendor/` / `public/`) for implementation JavaScript. Do not load product demo runtimes from jsDelivr, unpkg, or other CDNs. Bundle measurement fails if built test routes still reference remote JS hosts.

## AWS

Set `AWS_PROFILE` locally in your shell or gitignored `.env.local` — never commit profile names.

## Logging & shared-infra

Structured logging and alarm conventions: see `~/code/shared-infra/docs/adding-a-project.md`. Canonical Node logger: `~/code/family-memory/src/shared/logging.ts` (sync via `scripts/sync-shared-logger.sh` where applicable).

## Local UI verification

No auth — public UI only. Follow `rules/frontend-verification.md` (fleet smoke: desktop + mobile screenshots, console clean).

- **Dev server:** `npm run dev` (Astro; use the URL printed on start, typically <http://localhost:4321>)
- **Auth:** none — public pages only. No `DEFAULT_USER` / `DEFAULT_PASSWORD`.

## Verified-tree CI

PRs run the full CI suite. Post-merge CI reuses a successful PR run only when
its recorded checkout tree exactly matches the landed tree, using
`scripts/ci-verified-tree.sh` from dotagents. Missing proof runs full CI;
manual runs always validate. Job names and deployment triggers stay intact.
Canonical contract: `~/code/dotagents/templates/github/verified-tree-ci.md`.

## Dependabot CI

Ordinary Dependabot PR events allocate no validation runners. A manually invoked
`/optimize-workspace` requests full PR checks with `deps:ci:<full-head-SHA>`.
Deferred checks cannot satisfy the real `ci` requirement. New commits need a new
request; skipped or absent checks never authorize a dependency merge. See the
canonical `dotagents/skills/optimize-workspace/references/dependencies.md`.
