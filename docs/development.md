# Development and release

This repository owns its gate, setup, CI and deployment scripts. A separate
configuration repository, private package or global skill installation is not
required. Templates used during migration are examples, not an enforced upstream.

Prerequisites: Git, Bash >= 5 and Python >= 3.11. Install mise on non-Linux hosts;
fresh Linux setup provisions a pinned, checksum-verified public mise binary in
`/usr/local/bin`, using noninteractive sudo only when needed. The repository's `.mise.toml`
and `.nvmrc` own its tool pins; `mise.lock` records each tool's download URL and checksum per
platform so installs need no GitHub API lookup. `.mise.toml` sets `locked = true`, so a tool missing from `mise.lock` fails `mise install` with "is not in the lockfile" instead of falling back to that lookup, which proxied cloud sessions refuse. Locked installs work only on the platforms in `lockfile_platforms` in `.mise.toml`; to add a host platform, add it there and rerun `mise lock`. mise also applies `locked` to your global tools when `mise install` runs here, so any global tool not recorded in your own `~/.config/mise/mise.lock` fails it, installed or not; add `locked_scopes = ["project"]` under `[settings]` in your own `~/.config/mise/config.toml` to keep it to project tools. To bump a pin, edit `.mise.toml`, run `mise lock`
and commit both files (`mise lock --bump` for the major-only node pin). After `mise lock` and before committing, delete osv-scanner's `provenance.slsa` subtables from
`mise.lock`: mise 2026.9.16 and later refuse to install it while its Aqua registry entry names no
signer, and `scripts/test-osv-dispositions.py` fails the gate if they remain. Recheck the registry on
each osv-scanner bump. Checksums and URLs still pin the download. Semgrep and cfn-lint are
not mise tools: `scripts/security-scanners.sh` pins them and runs them through the pinned uv.

On a reviewed fresh `origin/main` checkout run:

```bash
bash scripts/setup-agent-environment.sh
```

Setup installs repo-owned hooks outside the working tree, provisions the pinned
tools and lockfile dependencies, and installs pinned Chromium when this repo uses
Playwright. Where `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` is set, as in Claude's cloud
sessions, setup skips Chromium; the gate then skips the steps that launch it,
with a warning, and CI runs them. Anywhere else, CI included, a Chromium that
cannot launch fails the gate. Run the repo's documented quality gate with its pinned tools:

```bash
mise exec -- npm run gate
```

Use the repository's README and AGENTS.md for its build, test and deployment
commands. A missing prerequisite is a failed setup; report it rather than claiming
that the gate ran. No setup command deploys the application or infrastructure.

## Hook trust

The dispatcher lives in this clone's Git common directory, shared only by its
linked worktrees. It registers pre-commit and pre-push. Pre-push runs pinned
gitleaks over each outgoing ref range. New branches require a fetched
`origin/main`; deletions and empty ranges need no history scan. A missing
scanner, unreadable range or finding blocks the push. Semgrep and osv-scanner
run in required PR CI and can be run manually through
`scripts/security-scanners.sh`. Pre-push needs neither scanner nor a network
probe. Reviewed OSV exceptions are recorded in
[security scanning](security-scanning.md). The complete hook/library/setup
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
The owning agent follows the PR through CI, merge and the repository's release
checks using its existing authenticated GitHub session. Keep held PRs in draft
and preserve their existing auto-merge state. A ready, same-repository self PR
into `main` can use native squash auto-merge when the base branch's active rules
require the relevant checks with no bypass available to the merging identity.
Verify those rules before arming; if that evidence is unavailable, wait for green
CI and use a squash merge pinned to the verified head SHA instead.

Before a direct merge, read the actual GitHub Actions workflow runs and jobs for
the current PR and head. Require the latest relevant CI attempt's `ci` and
`security` jobs to succeed; matching check names or a success from another SHA
are insufficient. Missing, failed, cancelled, skipped or incomplete jobs hold
the merge. Re-read the PR's draft state, head and target branch before merging;
if the head or target changed, repeat the checks. A head-pinned merge must reject
a newer head. The owning agent follows any armed native auto-merge to completion
and verifies the resulting release. If execution is interrupted, report the PR's
draft/auto-merge state and remaining checks so another agent can resume.

No Actions workflow arms, re-arms or merges PRs. Keep repository Allow auto-merge
enabled, but store no PAT or GitHub App private key for merging in Actions.
Dependabot and third-party PRs require their separately authorized maintenance
flow; the self-PR integration path does not grant that authority.
Never push to the default branch, weaken rulesets, bypass checks or use an
admin merge. Optional
personal review skills may help, but they are not prerequisites for this flow.

Preserve existing code-only Deploy and main-only Production rules.
Never push a `preview/` branch merely to validate this migration. Verify the
intended deployment and exact-release smoke when the repository requires them.

## Vercel Previews

Previews build only for `preview/**` branches; see the Vercel Previews rule in
[AGENTS.md](../AGENTS.md). A Preview does not replace full CI or production smoke.

## Infrastructure and access

This application deploys through Vercel. The repository-owned [static media
stack preparation](aws-static-assets.md) is not applied; infrastructure apply,
upload authority and production cutover remain human-owned. Normal build/gate
checks use local media and make no AWS calls.
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
