# shellcheck shell=bash
    # Repository-owned quality gate helpers. Maintain this file in this repository.
    # Source it by a repository-relative path; no external configuration repo is used.
    # Trusted commit dispatch executes a verified hook/library snapshot. Other scripts
    # and dependency lifecycles remain trusted repository code, not sandboxed code.
    # Requires Bash >= 5. Call gate_enter_committing_tree before gate_begin_commit.

    # === Bash floor ==================================================================
# The fleet requires Bash >= 5. macOS /bin/bash is 3.2, and a shell that skipped ~/.zprofile resolves
# bare `bash` to it; this source then prints the fix and fails, so the caller stops. 3.2 parses a
# sourced file one command at a time, so this block stays first and 3.2-parseable, and everything
# below may use Bash 5. `bash -n` is not proof: tests/test-gate-lib.sh sources it under /bin/bash.
GATE_BASH_MIN=5
if [ "${BASH_VERSINFO[0]:-0}" -lt "$GATE_BASH_MIN" ]; then
  echo "✗ $0 is running Bash $BASH_VERSION; the fleet requires Bash >= $GATE_BASH_MIN and will not continue on it." >&2
  echo "  Fix: brew install bash; \install Bash >= 5 and rerun this repository setup; open a new shell." >&2
  return 1 2>/dev/null || exit 1
fi

# === Repository-owned hook dispatch =============================================
    # The installer registers an outside-worktree snapshot in this clone's common dir.
    # The dispatcher trusts a complete reviewed hook/library/setup bundle, not a single
    # file or a library supplied through an environment override.
    _repo_gate_owner="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
    _repo_gate_context="$_repo_gate_owner"
    [[ -e "$_repo_gate_context/.git" ]] || _repo_gate_context="$PWD"
    GATE_HOOKS_DIR="$(env -u GIT_DIR -u GIT_WORK_TREE -u GIT_COMMON_DIR -u GIT_INDEX_FILE git -C "$_repo_gate_context" rev-parse --path-format=absolute --git-common-dir)/repo-hooks"

    gate_is_hooks_dispatcher() {
      local selected="$1"
      [[ "$selected" == "$GATE_HOOKS_DIR"/versions/*/hooks && -f "$selected/pre-commit" ]]
    }
    gate_dispatch_hook() {
      local common selected
      common="$(env -u GIT_DIR -u GIT_WORK_TREE -u GIT_COMMON_DIR -u GIT_INDEX_FILE git rev-parse --path-format=absolute --git-common-dir)" || exit 1
      selected="$(git config --local --type=path --get core.hooksPath)" || exit 1
      [[ "$selected" == "$common/repo-hooks"/versions/*/hooks ]] || { echo 'Repository-owned hooks are not installed; run reviewed repository setup.' >&2; exit 1; }
      exec "$selected/pre-commit"
    }

    # === Committing tree =============================================================
# Git runs a hook at the top level of the tree it is committing, but an absolute core.hooksPath
# other than the dispatcher runs ANOTHER checkout's copy: Claude desktop writes the primary's value,
# made absolute, into each linked worktree's config.worktree on every rebind
# (anthropics/claude-code#88747), so a primary on a relative .git-hooks yields <primary>/.git-hooks.
# ROOT = cwd's git top level when the shim sits in a checkout (a hook, `npm run gate`, a hand run
# from any checkout of the repo); otherwise the shim's tree (a non-git copy, even one nested
# inside another repo). When that tree's own hook is a different file, gate_dispatch_hook runs it
# only if trusted; it sources its own gate-lib, and `-ef` is true there, so it cannot loop.
gate_enter_committing_tree() { # <shim path>
      local shim_root cwd_root
      shim_root="$(cd "$(dirname "$1")/.." && pwd -P)"
      ROOT="$shim_root"
      if cwd_root="$(env -u GIT_DIR -u GIT_WORK_TREE -u GIT_COMMON_DIR -u GIT_INDEX_FILE git rev-parse --show-toplevel 2>/dev/null)"; then
        ROOT="$cwd_root"
      fi
      if [[ "$shim_root" != "$ROOT" && "$shim_root" != "$GATE_HOOKS_DIR"/bundles/* ]]; then
        gate_dispatch_hook
      fi
      cd "$ROOT"
      GATE_COMMITTING_TREE="$ROOT"
    }

    # === Pre-commit gate ============================================================
# The gate fires at COMMIT time, not push time: every worktree commit runs the
# full quality gate, and GitHub Actions CI is the server-side
# backstop for anything a `git commit -n` bypass or a skipped merge/rebase lets past.
# Secrets, markdown-lint-on-change, docs-only fast path, banner + failure trap are
# keyed off `git diff --cached` (the staged index). DEFINITIONS ONLY — no side
# effects on source.

gate__on_commit_err() {
  echo "✗ pre-commit gate failed — commit aborted (use 'git commit -n' only to bypass a WIP commit; CI still gates the push)" >&2
}

# The gitleaks release this gate and .github/workflows/ci.yml both pin.
# Releases differ in their default rules, so a scan on another release can pass here and fail in CI,
# or the reverse. Update the release, binary hashes, linux_arm64 archive hash and workflows
# together. The archive hash is CI's download check; the separate binary hashes verify mise installs.
GATE_GITLEAKS_VERSION=8.24.2
GATE_GITLEAKS_BIN_SHA256_DARWIN_ARM64=c75ea6f594e0a857efa1220fa08088b55e1465a32ab00cfc7aa2ec64cec031fe
GATE_GITLEAKS_BIN_SHA256_LINUX_X64=64805175c8f88959587ba6afc58210401088206a27ba582cfbb98791137d6208
GATE_GITLEAKS_BIN_SHA256_LINUX_ARM64=455494f14c34ee5394fa0eef6af986d0eebbabc16aca5be0bdc9bdd62518eb03

# Verify bytes from mise before returning a path that a scanner or installer will execute.
# These are hashes of the binaries extracted from the checksum-verified official release archives.
gate__verify_gitleaks_bin() { # <binary>
  local platform expected actual
  platform="$(uname -s)/$(uname -m)"
  case "$platform" in
    Darwin/arm64) expected="$GATE_GITLEAKS_BIN_SHA256_DARWIN_ARM64" ;;
    Linux/x86_64) expected="$GATE_GITLEAKS_BIN_SHA256_LINUX_X64" ;;
    Linux/aarch64|Linux/arm64) expected="$GATE_GITLEAKS_BIN_SHA256_LINUX_ARM64" ;;
    *) echo "✗ gitleaks mise binary verification is unsupported on $platform" >&2; return 1 ;;
  esac
  if [[ ! "$expected" =~ ^[0-9a-f]{64}$ ]]; then
    echo "✗ gitleaks mise binary checksum is missing or invalid for $platform" >&2
    return 1
  fi
  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "$1")" || actual=""
  elif command -v shasum >/dev/null 2>&1; then
    actual="$(shasum -a 256 "$1")" || actual=""
  else
    echo "✗ gitleaks mise binary verification requires sha256sum or shasum" >&2
    return 1
  fi
  actual="${actual%% *}"
  if [[ "$actual" != "$expected" ]]; then
    echo "✗ gitleaks mise binary checksum mismatch for $1 ($platform); reinstall gitleaks@$GATE_GITLEAKS_VERSION with mise" >&2
    return 1
  fi
}

# Print a gitleaks binary at GATE_GITLEAKS_VERSION: the one on PATH when it is that release (CI
# installs it there), else mise's repo-pinned installed release.
# Anything else is refused. This lookup never installs tools or changes configuration.
gate_gitleaks_bin() {
  local bin="" ver="" dir
  if bin="$(command -v gitleaks 2>/dev/null)"; then
    ver="$("$bin" version 2>/dev/null)" || ver=""
    ver="${ver#v}"
    [ "$ver" != "$GATE_GITLEAKS_VERSION" ] || { printf '%s' "$bin"; return 0; }
  fi
  # From /, so an untrusted .mise.toml in the committing repo cannot make mise refuse the lookup.
  if command -v mise >/dev/null 2>&1 && dir="$(cd / && mise where "gitleaks@$GATE_GITLEAKS_VERSION" 2>/dev/null)"; then
    for bin in "$dir/gitleaks" "$dir/bin/gitleaks"; do
      [ ! -x "$bin" ] || { gate__verify_gitleaks_bin "$bin" || return 1; printf '%s' "$bin"; return 0; }
    done
  fi
  if [ -n "$ver" ]; then
    echo "✗ gitleaks $ver is on PATH, but the gate pins $GATE_GITLEAKS_VERSION to match CI — run: $(gate__cli_hint gitleaks)" >&2
  else
    echo "✗ required CLI not on PATH: gitleaks $GATE_GITLEAKS_VERSION — run: $(gate__cli_hint gitleaks)" >&2
  fi
  return 1
}

# Staged secrets scan: gitleaks over the index (what the commit will capture), not a
# ref range. `--pre-commit --staged` is gitleaks' documented pre-commit mode ("scan
# staged commits"). Fail-loud if the pinned gitleaks is absent.
# That mode runs `git diff --staged` itself and takes no git options, so a path .gitattributes marks
# -diff, or one holding a NUL byte, reached it as "Binary files differ" and went unread. CI's range
# scan passes --text; here git reads attributes from a tree whose only .gitattributes is `* diff`,
# which shows every path as text (and drops committed diff drivers). $GIT_DIR/info/attributes still
# outranks that tree, and a git older than GIT_ATTR_SOURCE ignores it, so a staged path git would
# still show as binary refuses the commit rather than pass unread. Without --no-color, --verbose
# also prints the text on either side of a redacted match.
gate_secrets_scan_staged() {
  local gl blob tree numstat added deleted path unread=""
  echo "• gitleaks (staged)"
  gl="$(gate_gitleaks_bin)" || exit 1
  blob="$(printf '* diff\n' | git hash-object -w --stdin)" || exit 1
  tree="$(printf '100644 blob %s\t.gitattributes\n' "$blob" | git mktree)" || exit 1
  numstat="$(GIT_ATTR_SOURCE="$tree" git diff --cached --numstat --diff-filter=d)" || exit 1
  while IFS=$'\t' read -r added deleted path; do
    [ "$added$deleted" != -- ] || unread+="  $path"$'\n'
  done <<<"$numstat"
  if [ -n "$unread" ]; then
    printf '✗ gitleaks cannot read these staged paths, which git still shows as binary:\n%s  Fix: drop their -diff from %s, or upgrade git to 2.41 or newer (it is %s), which honors GIT_ATTR_SOURCE.\n' \
      "$unread" "$(git rev-parse --git-path info/attributes)" "$(git --version)" >&2
    exit 1
  fi
  GIT_ATTR_SOURCE="$tree" "$gl" git --no-banner --no-color --redact --verbose --pre-commit --staged
}

# Markdown lint when any path on stdin (added/changed, one per line) is authored
# Markdown. lint-md.sh lints the whole working tree once. A symlink contains a path,
# not authored Markdown: its target is checked when that regular file changes, so
# inspect the index mode (index == HEAD for the clean-tree branch check).
gate__markdown_lint_paths() {
  local f
  while IFS= read -r f; do
    case "$f" in *.md | *.mdx | *.markdown)
      [[ "$(git ls-files --stage -- "$f")" == 120000\ * ]] && continue
      echo "• markdown lint"
      bash "$ROOT/scripts/lint-md.sh"
      return ;;
    esac
  done
  return 0
}

# Markdown lint when the STAGED set touches markdown. Note lint-md.sh lints
# working-tree files, not the index — the partial-staging warning in
# gate_begin_commit covers the (rare, solo-dev) case where they diverge.
gate_markdown_lint_staged() {
  gate__markdown_lint_paths < <(git diff --cached --name-only --diff-filter=ACMRT)
}

# Docs-only allow-list over newline-separated paths on stdin. Conservative: root
# *.md, Markdown and images under docs/, .github/*.md, LICENSE. Code under docs/,
# site content under src/ (in-app wiki pages, tuning constants), and nested Markdown
# elsewhere stay on the full gate. Callers list paths with --no-renames so a rename
# contributes its old path too (src/x.ts -> docs/x.md is a code deletion, not a docs change).
gate__docs_only_paths() { # → 0 when every path is docs
  local f
  while IFS= read -r f; do
    case "$f" in
      docs/*.md | docs/*.mdx | docs/*.markdown | docs/*.png | docs/*.jpg | docs/*.jpeg | docs/*.gif | docs/*.svg | docs/*.webp) ;;
      .github/*.md) ;;
      *.md | *.mdx | *.markdown) [ "${f%/*}" = "$f" ] || return 1 ;;
      LICENSE | LICENSE.*) ;;
      *) return 1 ;;
    esac
  done
  return 0
}

# Docs-only fast path over the STAGED set.
# An empty staged diff is handled earlier in gate_begin_commit (a message-only
# amend / empty commit), so here a non-empty list is assumed; `git diff --cached`
# works on an unborn branch too (diffs vs the empty tree), so the initial commit
# runs the full gate with no special-casing.
# Force the full gate with:  FLEET_DOC_FAST=0 git commit
gate__docs_only_staged() { # → 0 when the fast path applies
  local files
  [ "${FLEET_DOC_FAST:-1}" = "1" ] || return 1
  files="$(git diff --cached --name-only --no-renames)" || return 1
  [ -n "$files" ] || return 1
  gate__docs_only_paths <<<"$files"
}

# gate_begin_commit: the pre-commit preamble in one call. Skips the full
# battery on the two states where re-running it is wrong or wasteful, then runs the
# staged secrets/markdown/docs-only steps and arms the failure trap; the shim runs its
# repo-specific steps after. Calls `exit 0` itself on every skip path.
gate_begin_commit() { # <repo-name>
  GATE_REPO="$1"
  local gitdir
  if [ -z "${GATE_COMMITTING_TREE:-}" ] || [ "$GATE_COMMITTING_TREE" != "${ROOT:-}" ]; then
    echo "✗ $GATE_REPO: .git-hooks/pre-commit must call gate_enter_committing_tree \"\${BASH_SOURCE[0]}\" right after sourcing gate-lib and must not reassign ROOT — otherwise a linked worktree commit can gate another checkout's tree (anthropics/claude-code#88747)" >&2
    exit 1
  fi
  # FLEET_DOC_FAST=0 (set by this repository's `npm run gate`) is an explicit full working-tree
  # check, including after commit when the index is empty. Ordinary Git hooks keep skips.
  local FLEET_DOC_FAST="${FLEET_DOC_FAST:-1}"
  gitdir="$(git rev-parse --git-dir 2>/dev/null || echo .git)"
  # Any other core.hooksPath is how this hook ran without the dispatcher (Hook dispatch): a
  # package.json prepare that resets the primary to .git-hooks on every npm ci, which Claude desktop
  # then writes into each worktree as <primary>/.git-hooks. Say so on every commit; do not block.
  local hooks_path
  hooks_path="$(git config --type=path --get core.hooksPath 2>/dev/null || true)"
  if [[ -n "$hooks_path" && "$hooks_path" != /dev/null ]] && ! gate_is_hooks_dispatcher "$hooks_path"; then
    echo "⚠ core.hooksPath is '$hooks_path', not the dispatcher $GATE_HOOKS_DIR: a checked-out fork head can run its own hooks here. Fix: run reviewed scripts/setup-agent-environment.sh, and remove any package.json prepare that sets core.hooksPath." >&2
  fi
  # (1) Merge / rebase / cherry-pick in progress: the commits being replayed were
  # already gated on their original authoring; re-running the full battery N times per
  # `--continue` is prohibitive and buys nothing. Conflict resolution CAN introduce a
  # secret, so still run the cheap staged scan, then pass.
  if [[ "$FLEET_DOC_FAST" != 0 ]] && { [ -e "$gitdir/MERGE_HEAD" ] || [ -e "$gitdir/CHERRY_PICK_HEAD" ] \
     || [ -d "$gitdir/rebase-merge" ] || [ -d "$gitdir/rebase-apply" ]; }; then
    trap 'gate__on_commit_err' ERR
    gate_secrets_scan_staged
    echo "▶ merge/rebase in progress — skipping the full gate (replayed commits were already gated; CI validates the result)"
    exit 0
  fi
  # (2) Nothing staged vs HEAD: a message-only `--amend` or an empty commit — no new
  # tree to validate. (A CONTENT amend has a non-empty staged diff and runs the full
  # gate below, correctly — it produces a new tree.)
  if [[ "$FLEET_DOC_FAST" != 0 ]] && git diff --cached --quiet 2>/dev/null; then
    echo "▶ no staged changes vs HEAD — skipping the gate (message-only amend / empty commit)"
    exit 0
  fi
  # Arm the failure trap BEFORE the first real check so a gitleaks / markdown-lint
  # failure also prints the standard "commit aborted" line.
  trap 'gate__on_commit_err' ERR
  gate_secrets_scan_staged
  gate_markdown_lint_staged
  if gate__docs_only_staged; then
    echo "▶ pre-commit ($GATE_REPO): docs-only change — skipping the full gate."
    exit 0
  fi
  # The gate steps validate the WORKING TREE; the commit captures the STAGED content.
  # For a whole-tree commit these are identical; when only part of the tree is staged
  # they can diverge — warn (don't block: hard-blocking reinvents the clean-tree guard
  # at the worst hook, and a stash dance is fragile). CI validates the exact commit.
  if ! git diff --quiet 2>/dev/null; then
    echo "⚠ unstaged changes present — the gate validates the WORKING TREE; the commit captures STAGED content. CI validates the exact commit."
  fi
  echo "▶ pre-commit gate ($GATE_REPO)"
}

# --- run_step: silent on green, full output on red ---------------------------
# Run a quality step quietly: print only the "• label" header on success, and
# dump the captured stdout+stderr (plus the failing label/exit code) only on
# failure. This is where the token/noise savings come from — a green commit prints
# step headers, not the build's per-chunk/per-route/per-image enumeration.
# Use for FAST, NOISY-on-success steps (build, lint, typecheck, validate, fast
# unit tests). Do NOT wrap long-running or streaming steps (deploys, E2E suites,
# anything you want live progress on) — call those directly so they aren't
# buffered into a silent multi-minute wait. Under `set -e` the `if` guard lets us
# capture the exit code instead of aborting mid-step, and a bare `run_step …`
# call still aborts the gate (firing the ERR trap) on failure.
run_step() { # run_step "label" cmd [args...]
  local label="$1"; shift
  printf '• %s\n' "$label"
  # Capture the command's real exit code via `|| _rc=$?` — an `if _out=$(...)` form
  # would reset $? to 0 after the `if`, silently reporting every failure as success
  # (a gate that passes broken code). The `||` also keeps `set -e` from aborting here
  # so we reach the dump; the explicit `return "$_rc"` then re-fails the gate.
  local _out _rc=0
  _out="$("$@" 2>&1)" || _rc=$?
  [ "$_rc" -eq 0 ] && return 0
  printf '%s\n' "$_out" >&2
  printf '✗ step failed: %s (exit %d)\n' "$label" "$_rc" >&2
  return "$_rc"
}

# === Bash floor on entrypoints ===================================================
# Sourced helpers and CI-only scripts are exempt by explicit repository path.
# Setup and dispatch launchers must carry the normal first-command floor.
GATE_BASH_FLOOR_EXEMPTIONS=(gate/gate-lib.sh scripts/check-actions.sh scripts/ci-verified-tree.sh scripts/vercel-preview-comment.sh scripts/vercel-preview-comment-contract.sh scripts/vercel-preview-workflow-contract.sh)
GATE_BASH_FLOOR_LINE='((BASH_VERSINFO[0] >= '"$GATE_BASH_MIN"')) || { echo "✗ $0 requires Bash >= '"$GATE_BASH_MIN"', not $BASH_VERSION. Fix: brew install bash; open a fresh shell and rerun repository setup." >&2; exit 1; }'

# Print why <file> (tracked at repo-relative <rel>) breaks the floor, or nothing. A file with a
# non-Bash shebang (sh, zsh, python, …) is not a Bash entrypoint; a *.sh with no shebang is a
# sourced helper the caller must exempt by name.
gate__bash_floor_violation() { # <rel> <file>
  local rel="$1" f="$2" shebang first
  [[ -f "$f" ]] || { echo "is tracked but not a regular file"; return; }
  shebang="$(head -1 -- "$f")"
  if [[ "$shebang" == "#!/bin/bash" ]]; then
    echo "its #!/bin/bash shebang pins macOS Bash 3.2 — use #!/usr/bin/env bash"; return
  elif [[ "$shebang" != '#!'* ]]; then
    echo "has no shebang (exempt a sourced helper by name)"; return
  elif [[ "$shebang" != "#!/usr/bin/env bash" ]]; then
    if [[ "$shebang" =~ [^[:alnum:]_]bash([^[:alnum:]_]|$) ]]; then
      echo "its shebang \`$shebang\` is not exactly #!/usr/bin/env bash"
    fi
    return  # any other interpreter is not a Bash entrypoint
  fi
  first="$(tail -n +2 -- "$f" | grep -vE '^[[:space:]]*(#|$)' | head -1)"
  if [[ "$rel" == .git-hooks/pre-commit && "$first" != "$GATE_BASH_FLOOR_LINE" ]]; then
    # A shim may skip the floor line when sourcing gate-lib is its first command (after set): the
    # source refuses 3.2 before anything else parses.
    first="$(tail -n +2 -- "$f" | grep -vE '^[[:space:]]*(#|$)|^set -' | head -1)"
    [[ "$first" =~ ^source[[:space:]]+[^#]*gate/gate-lib\.sh ]] || echo "opens with neither the Bash floor line nor a gate/gate-lib.sh source (after set), so 3.2 may misparse before a refusal"
    return
  fi
  [[ "$first" == "$GATE_BASH_FLOOR_LINE" ]] || echo "first command is not the Bash floor line: $GATE_BASH_FLOOR_LINE"
}

# Check every tracked Bash entrypoint in the current repo: each tracked *.sh plus each tracked file
# whose first line is a bash shebang. Content is read from the working tree, as every other gate step
# reads it; a tracked path missing there, and a symlink, are skipped (a symlink's tracked target is
# checked as itself). Template copies and paths matching an <exempt glob> (a Bash pattern over the
# repo-relative path, e.g. 'scripts/lib/*') are skipped. Prints each violation and returns 1 if any.
# Every gated repo tracks its .git-hooks/pre-commit, so a scan that does not find it is broken, not
# clean: that fails closed.
gate_check_bash_floor() { # [<exempt glob>…]
  local top rel glob why bad=0 rc
  local shebang_re='^#!.*[^[:alnum:]_]bash([^[:alnum:]_]|$)'  # no \b: Apple git's regex engine lacks it
  local -a hits sh_files
  local -A cands=()
  top="$(git rev-parse --show-toplevel)" || return 1
  # NUL-separated, so no path is C-quoted or split. git grep exits 1 when nothing matches.
  mapfile -d '' -t hits < <(git -C "$top" -c submodule.recurse=false grep -lzE "$shebang_re" -- ':(top)*')
  rc=0; wait "$!" || rc=$?  # never a bare failing command: callers run under set -e
  ((rc <= 1)) || { echo "✗ bash floor: git grep failed (exit $rc) — cannot list Bash entrypoints" >&2; return 1; }
  mapfile -d '' -t sh_files < <(git -C "$top" ls-files -z -- '*.sh')
  wait "$!" || { echo "✗ bash floor: git ls-files failed — cannot list Bash entrypoints" >&2; return 1; }
  for rel in "${hits[@]}"; do
    if head -1 -- "$top/$rel" | grep -qE "$shebang_re"; then cands[$rel]=1; fi
  done
  if [[ -z "${cands[.git-hooks/pre-commit]:-}" ]]; then
    echo "✗ bash floor: discovery found no .git-hooks/pre-commit in $top (untracked, or the shebang scan broke) — every gated repo tracks its gate shim" >&2
    return 1
  fi
  for rel in "${sh_files[@]}"; do cands[$rel]=1; done
  while IFS= read -r -d '' rel; do
    [[ ! -L "$top/$rel" && -e "$top/$rel" ]] || continue
    for glob in "${GATE_BASH_FLOOR_EXEMPTIONS[@]}" "$@"; do
      # shellcheck disable=SC2053  # glob is a pattern on purpose
      [[ "$rel" == $glob ]] && continue 2
    done
    why="$(gate__bash_floor_violation "$rel" "$top/$rel")"
    [[ -z "$why" ]] || { echo "✗ $rel: $why" >&2; bad=1; }
  done < <(printf '%s\0' "${!cands[@]}" | sort -z)
  ((bad == 0)) || { echo "  Fix: open each with #!/usr/bin/env bash, then the floor line as its first command." >&2; return 1; }
}

# === Pinned Node runtime ========================================================
# Every CLI/runtime a gate or deploy invokes must resolve to a REPO-SCOPED version, never the
# machine-global one on $PATH. The fix differs by tool class. Project-local tools run from
# node_modules/.bin, and each repo's committed .npmrc sets `yes=false`, so any `npx <tool>` that
# is not installed locally fails closed ("npx canceled due to missing packages") instead of
# fetching <tool>@latest; `npx --yes` is the explicit opt-in. System CLIs get a presence guard
# (NOT a hard-coded absolute path: Homebrew differs Intel vs Apple-Silicon) plus the repo's
# .mise.toml pins, and the Node runtime is version-asserted against .nvmrc.

# Assert the running Node major matches the repo's pinned .nvmrc (the sole Node pin). Without this
# assert, a stale shell Node silently builds/tests/deploys off-version (e.g. a cloud VM that ships
# an older Node on PATH). Reads .nvmrc from $ROOT (else cwd).
gate_require_node() {
  local nvmrc="${ROOT:-.}/.nvmrc" want have
  command -v node >/dev/null 2>&1 || {
    echo "✗ node not on PATH — the gate runs node/npm; install Node and 'nvm use' before committing" >&2; return 1; }
  [ -f "$nvmrc" ] || { echo "✗ no .nvmrc at $nvmrc — cannot assert the pinned Node major" >&2; return 1; }
  want="$(tr -cd '0-9.' < "$nvmrc")"; want="${want%%.*}"
  have="$(node -v | tr -cd '0-9.')"; have="${have%%.*}"
  if [ -z "$want" ]; then
    # A non-numeric .nvmrc (e.g. `lts/iron`, `node`) carries no major to assert — degrade to the
    # node-present check above rather than print a bogus "matches v" line against an empty version.
    echo "• node v$have (.nvmrc pins no numeric major to assert)"
    return 0
  fi
  if [ "$have" != "$want" ]; then
    echo "✗ Node major mismatch: running v$have but .nvmrc pins v$want — run 'nvm use' (or 'nvm install $want') so the gate runs on the pinned runtime" >&2
    return 1
  fi
  echo "• node v$have (matches .nvmrc v$want)"
}

# Repair guidance for the pinned scanner; setup owns dependency installation.
gate__cli_hint() {
  echo "run reviewed scripts/setup-agent-environment.sh to install repo-pinned $1"
}
