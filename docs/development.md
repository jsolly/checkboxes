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
tools and lockfile dependencies, and installs pinned Chromium when this repo uses
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

## Infrastructure and access

Use existing scoped identities. Agents do not recover credentials, broaden grants
or run destructive infrastructure/database operations. Keep read-only checks on
the read-only role, including the repo-owned credential-isolation wrapper.
`check:infra-pending` reports merged infrastructure inputs not yet deployed; AWS
CloudFormation drift detection separately reports manual live-resource changes.
Infrastructure apply and protection changes remain a concrete handoff to the
human owner, with exact repository commands. A successful code deploy does not
prove infrastructure adoption. Never bypass a dirty-infrastructure deploy refusal.

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
