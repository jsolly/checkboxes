# Development and release

This repository owns its gate, setup, CI and deployment scripts. A separate
configuration repository, private package or global skill installation is not
required. Templates used during migration are examples, not an enforced upstream.

Prerequisites: Git, Bash >= 5 and Python >= 3.11. Install mise on non-Linux hosts;
fresh Linux setup provisions a pinned, checksum-verified public mise binary in
`/usr/local/bin`, using noninteractive sudo only when needed. The repository's `.mise.toml`
and `.nvmrc` own its tool pins. On a reviewed fresh `origin/main` checkout run:

```bash
bash scripts/setup-agent-environment.sh
```

Setup installs repo-owned hooks outside the working tree, provisions the pinned
tools (including jq for Preview workflow tests) and lockfile dependencies, and installs pinned Chromium when this repo uses
Playwright. Run the repo's documented quality gate with its pinned tools:

```bash
mise exec -- npm run gate
```

Use the repository's README and AGENTS.md for its build, test and deployment
commands. A missing prerequisite is a failed setup; report it rather than claiming
that the gate ran. No setup command deploys the application or infrastructure.

## Hook trust

The dispatcher lives in this clone's Git common directory, shared only by its
linked worktrees. It registers pre-commit only. The complete hook/library/setup
bundle must match current reviewed `origin/main`, or a deliberately approved exact
bundle digest. Missing files, symlinks, unreviewed modes and a foreign origin fail
closed. The dispatcher executes a verified snapshot, then runs quality scripts in
the committing checkout. Re-run reviewed setup after changing tool setup on main.

This is hook-registration integrity, not a sandbox. Never check out or execute
third-party/fork PR code in a trusted clone; review its diff through GitHub. Do not
run its npm lifecycle or setup scripts. Use a separate disposable environment when
execution of untrusted code has been explicitly authorized.

After independent semantic/security review of your own gate change, get its exact
digest with `bash scripts/repo-python.sh scripts/repo-hooks.py digest`. Use the installed snapshot's
`approve --root <absolute-repo-root> --digest <reviewed-digest>` command, with actual
values, to approve only those bytes; never approve a fork's bundle. Approvals are
repo-local. Revoke explicit approvals with `git config --local --unset-all
repo.trustedGateBundle`; current reviewed main remains trusted. Changing origin
invalidates the bundle identity. No environment variable selects another library.

The authoritative identity manifest is `config/agents/repository.json`. Current
checkouts refuse a retired root `.repo-independent.json`, including dangling links.
An installed snapshot from before this relocation needs the explicit upgrade flow.
After reviewing the complete candidate hook bundle, run from its repository root:

```bash
digest="$(bash scripts/repo-python.sh scripts/repo-hooks.py digest)" &&
  bash scripts/repo-python.sh scripts/repo-hooks.py approve-upgrade --digest "$digest" &&
  bash scripts/repo-python.sh scripts/repo-hooks.py install &&
  bash scripts/repo-python.sh scripts/repo-hooks.py verify
```

The upgrade reauthorizes the exact old installed snapshot against protected
`origin/main` or an existing repo-local approval, verifies its origin, files, modes,
digest and dispatcher, then approves only the reviewed new digest. It does not
trust an old manifest in the candidate checkout. Once reviewed main has the new
layout, ordinary setup installs it directly, including over a valid old snapshot.
Older checkouts must merge the reviewed migration before rerunning setup.

## Review and integration

Work from fresh main on an isolated branch. Review the actual final diff for bugs,
secrets, security, tests and repository guidelines; use an independent reviewer
for substantial or sensitive changes. Run the required complete local gate before
pushing. Create a same-repository PR; use a draft while approval/work remains.
Merge only when the required CI validates the exact current head. Never push to
the default branch, weaken rulesets, bypass checks or use an admin merge. Optional
personal review skills may help, but they are not prerequisites for this flow.

Preserve existing code-only Deploy, production-main-only Vercel and opt-in Preview
rules. Never trigger a preview merely to validate this migration. Verify the
intended deployment and exact-release smoke when the repository requires them.

## Opt-in Preview workflow

Production Git deploys remain limited to `main`. An explicit `/preview` comment
or manual Vercel Preview dispatch makes a one-shot deployment. A same-repo PR's
`preview` label opts into redeploys on pushes, using one stable project/PR URL
and one edited comment. Removing the label stops those redeploys. Preview runs
do not replace full CI, including for draft PRs, or production smoke.

Automatic label events use `pull_request_target` for main-targeted PRs, so the workflow definition and tooling come from the default branch. Manual dispatch is restricted to that branch. The PR head is resolved after acquiring the deployment slot, so out-of-order pending jobs still deploy the latest eligible head. Node setup
runs before the isolated PR checkout without deployment tokens or a restored
package cache. Only the deployment step receives `VERCEL_TOKEN`; the pinned CLI
runs outside PR sources with its own npm cache and without the GitHub token.
Executable Vercel source configs are refused. Current head, open state and label
are checked before deployment and again before changing the stable alias.

`npm run check:actions` includes hermetic Vitest execution of the real workflow scripts
with stand-in API responses and deployment commands, real jq comment selection and real Git config inventories. It checks stale/closed/removed-label races,
single-comment updates, isolated credentials and failure behavior. It never
creates a deployment. Test live Preview behavior only when John explicitly asks.

## Infrastructure and access

This application deploys through Vercel and has no AWS stack or AWS CLI checks.
Repository setup uses public tools only; it does not log in to AWS, mint agent
credentials or write AWS profiles. The unused vendor OIDC bootstrap is removed
from source. Do not restore a credential-export helper for this application.

Separately authorized agent AWS work uses the provider desktop app's native
`aws_mcp` connection as `agent@jsolly.com` / `AgentMcp`, with AWS Core retained
for knowledge tools. Native OAuth credentials never enter repository scripts.
Named human administrators, Vercel credentials and application environment files
remain separate. Source cleanup does not retire installed helper copies, cached
sessions, saved cloud environments or live IAM trust; those require the existing
capability/provider-isolation acceptance and retirement work.

Repository instructions and access rules are maintained here. Personal home
configuration and optional global skills remain separate and are not installed,
removed or overwritten by repo setup.

## Worktree setup

The committed Cursor and Codex configurations invoke `npm run worktree:init`.
It copies only `.worktreeinclude` entries from the primary checkout, preserving
file modes, then runs the reviewed repository setup for public tools, dependencies
and trusted hooks. Personal worktree hooks are optional.

This app pins uv in `.mise.toml` for its pinned yamllint invocation. CI uses the
same uv release. Vercel deployments and exact-release production smoke remain
owned by this repo's existing workflows.

## Website updates

The public gallery offers deployment updates without interrupting open tabs.
See [website updates](website-updates.md) for identity, selection confirmation,
asset retention, migration limits and the required browser evidence.
