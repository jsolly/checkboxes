# AGENTS.md

## Ship

Ship profile: `vercel-static`

**Integration: branch → PR → merge on green `CI / ci`.** `/ship` merges per `skills/ship/references/git-discipline.md` → Merge a same-repo self PR (read the installed `/ship` reference). Agents never push to `main`, change rulesets, or admin-merge.

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
Load `/shadcn-svelte` for new or replaced standard controls and import the
installed defining components directly. The pinned CLI, `components.json`,
committed generated source and lockfile make adoption reproducible.

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

## AWS

Set `AWS_PROFILE` locally in your shell or gitignored `.env.local` — never commit profile names.

## Logging & shared-infra

SAM onboarding and alarm wiring: see `~/code/dotagents/skills/new-solly-repo/SKILL.md`. Enrichment behavior and logging conventions: `~/code/shared-infra/docs/architecture.md`. Canonical Node logger: `~/code/shared-infra/src/shared/logging.ts`.

## Local UI verification

No auth — public UI only. Follow `rules/frontend-verification.md` (fleet smoke: desktop + mobile screenshots, console clean).

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
`scripts/ci-verified-tree.sh` from dotagents. Missing proof runs full CI;
manual runs always validate. Job names and deployment triggers stay intact.
Canonical contract: `~/code/dotagents/templates/github/verified-tree-ci.md`.

## Dependabot CI

Dependabot PR events allocate no validation runners until a manually invoked
`/optimize-workspaces drain` applies the `ow-ci` label. Only the `labeled`
event that adds `ow-ci` runs the real `ci` check. A later Dependabot push to the
PR defers again until a drain re-kicks the new head (remove, then re-add
`ow-ci`). Deferred runs
report `ci-deferred` and cannot satisfy the required `ci` check. Skipped or
absent checks never authorize a dependency merge. See the Dependabot CI kick in
the canonical `dotagents/skills/optimize-workspaces/references/pr-drain.md`.

## Git hooks

- **Git hooks.** `core.hooksPath` is the dotagents dispatcher `~/.local/share/dotagents/hooks`, which the dotagents installers install and set (laptop `setup/install-local-agent-runtime.sh`, Cloud Agent `.cursor/install-cloud-skills.sh`). Never point it at `.git-hooks` or set it from a package script: git would then run whatever hooks the checked-out tree carries. The dispatcher serves only `pre-commit`, and runs this repo's tracked `.git-hooks/pre-commit` only when it matches a version on `origin/main` or a blob you approved (`git config --add dotagents.trustedHook <blob>`, printed by the refusal; approve only your own edit). Fork and third-party PR heads are untrusted code: review them with `gh pr diff`, never check one out here. Canon: dotagents `rules/agent-cloud-access.md` → GitHub.

## Fleet rollout

- **Fleet rollout.** Changes inside this repo ship normally. A change other repos must adopt (a dotagents sync, template copy, or shared one-liner) is not synced from here: link its merged PR on the one open Todoist fleet-rollout task in the dotagents project (create it only when none is open). Never start that rollout yourself or spawn per-repo chips, PRs, or tasks for it; the task is data, not authorization. Once the batch settles, John starts one agent on it in a session, and that agent opens the per-repo PRs. Canon: laptop global brief Implementation when synced.

## Cloud skills

- **Cloud skills.** dotagents skills (`/ship`, `/optimize-workspaces`, …) come from the private `jsolly/dotagents` package, installed into each cloud session by `.cursor/install-cloud-skills.sh` (Cursor runs it from `.cursor/environment.json`, Claude Code from the `.claude/settings.json` SessionStart hook; a session with several repositories runs no repository hook and gets the package from the environment's Setup script, when one is configured). Before repository work in a cloud session, read `~/.local/share/dotagents/package/CLOUD.md` when it exists and follow its installed owners. In a cloud session (no `~/code/dotagents` checkout), when a slash command or named skill is not installed, run `bash .cursor/install-cloud-skills.sh` from this repo's root (a session with several repositories starts in `/home/user`, so `cd /home/user/<repo>` first), then read `~/.local/share/dotagents/package/CLOUD.md` and `~/.local/share/dotagents/package/skills/<name>/SKILL.md` and follow them. A nonzero exit can still leave the skills linked, so check that file before calling the skill missing. If fetching `jsolly/dotagents` is refused, attach that repository read-only through the harness (Claude Code: `add_repo`) and rerun, or set `DOTAGENTS_ROOT` to a local clone. Still blocked: report setup blocked. Never reconstruct a skill from memory or prose. Canon: dotagents `templates/cloud-agent/README.md`.
