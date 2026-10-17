# AGENTS.md

## Ship

Ship profile: `vercel-static`

**Integration: branch → reviewed PR → merge on green `CI / ci`.** Follow [local release instructions](docs/development.md). Agents never push to `main`, change rulesets, or admin-merge.

Production URL: <https://www.checkboxes.xyz>

Profile delta: `https://checkboxes.xyz` redirects (308) to the canonical `www` URL.

Production verification follows Vercel READY and the public checkbox behavior smoke.

Local gate before push: `npm run gate`.

## No automatic Vercel Previews

Branch pushes do **not** create Preview deployments (`vercel.json` `git.deploymentEnabled`). Production Git deploys on `main` stay on.

Opt-in Preview: comment `/preview` as the first non-empty line on a same-repo PR (owner/member/collaborator User), or run **Actions → Vercel Preview** with the PR number. GitHub runs that workflow from `main`. One-shot: new commits do not rebuild until you ask again. Requires GitHub secret `VERCEL_TOKEN`. Agents must not comment `/preview` or run Actions → Vercel Preview unless John asked.

## Purpose

Checkbox implementation gallery — multiple frameworks and approaches with performance metrics. See `README.md`.

## Frontend stack

Astro renders pages; shared product controls use Svelte + shadcn-svelte.
For new or replaced standard controls, reuse the committed components under
`src/lib/components/ui/` and import their defining files directly. Configure new
components with `components.json` and the repository's pinned shadcn-svelte CLI;
commit generated source and any lockfile changes. Preserve accessible labels,
keyboard operation and focus states, then follow Local UI verification below.
The personal `/shadcn-svelte` skill is an optional aid.

User-directed exception: the ten framework checkbox implementations remain
comparison/teaching examples in their original frameworks, including CSS-only.
Keep their source inputs and isolated `/test/*` benchmark payloads free of shared
gallery UI dependencies. React/Vue/etc packages serve those retained demos.

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

## Deployment and access

Vercel owns this app's deployment. The app has no SAM stack or Lambda logging
integration. Build, gate and cloud setup use public tools and need no AWS login.
Keep credentials in local environment variables or gitignored files.

## Local UI verification

No auth — public UI only. For a UI change, inspect the affected route on desktop
and mobile, exercise its checkbox controls and capture screenshots. Check the
browser console for errors. The repo-owned production scenario in
`scripts/production-smoke-scenario.mjs` defines the release browser checks.

- **Dev server:** `npm run dev` (Astro; use the URL printed on start, typically <http://localhost:4321>)
- **Auth:** none — public pages only. No `DEFAULT_USER` / `DEFAULT_PASSWORD`.

## Production smoke

The **Production smoke** workflow is a separate post-deployment gate. It waits
for the intended production release and verifies the public browser flow with
`npm run smoke:production`. The URL is pinned in
`scripts/production-smoke-scenario.mjs`; the workflow uses no deployment secrets.
Vercel Git deployment and the existing PR CI checks remain unchanged.

`/ship` must wait for the exact release's Production smoke run to succeed and
record its URL. Missing, failed, cancelled, skipped or timed-out runs are not
success. If the automatic trigger is missing, dispatch the workflow on `main`
with the full expected release SHA and a unique request ID, then follow that
specific run. Preserve `production-smoke-artifacts/` diagnostics when a check fails.

## Verified-tree CI

PRs run the full CI suite. Post-merge CI reuses a successful PR run only when
its recorded checkout tree exactly matches the landed tree, using
the repo-owned `scripts/ci-verified-tree.sh`. Missing proof runs full CI;
manual runs always validate. Job names and deployment triggers stay intact.
Canonical contract: [local CI helper](scripts/ci-verified-tree.sh).

## Dependabot CI

Dependabot PR events allocate no validation runners until an explicitly
authorized maintenance run applies the `ow-ci` label. Only the `labeled`
event that adds `ow-ci` runs the real `ci` check. A later Dependabot push to the
PR defers again until a drain re-kicks the new head (remove, then re-add
`ow-ci`). Deferred runs
report `ci-deferred` and cannot satisfy the required `ci` check. Skipped or
absent checks never authorize a dependency merge. See the Dependabot CI kick in
the repository CI workflow and local release instructions.

## Git hooks

This repo owns `gate/gate-lib.sh` and `scripts/repo-hooks.py`. Run reviewed
`scripts/setup-agent-environment.sh` on main to install its outside-worktree
pre-commit dispatcher. Never set hooksPath to `.git-hooks`: a branch could then
register executable hooks. See [development and release](docs/development.md).

## Configuration

Move optional top-level tracked configuration into `config/<domain>/` or its
existing owner, with one authoritative owner per setting. Keep nested configuration
with its component; test configuration may live under `tests/`. CLI commands select
owners explicitly; native adapters require a named active consumer. See [configuration guidance](config/README.md)
for the domains, native exceptions and verification. This repository owns them.

## Repository ownership

This repo maintains its executable helpers, agent instructions and workflow
contracts. Changes in another repo do not automatically rewrite this one. A
cross-repository migration needs the user's explicit scope, independent review,
and a separate verified PR in each affected repository.

## Agent environment

Use this repository's AGENTS.md and [development guide](docs/development.md).
Run its reviewed `scripts/setup-agent-environment.sh` for pinned tools and hooks.
No private configuration repo, external instruction import or global skill is
required. Optional personal skills do not change this repository's authority.
