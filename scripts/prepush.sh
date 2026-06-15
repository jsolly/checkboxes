#!/usr/bin/env bash
# Pre-push gate + deploy for checkboxes.
#
# Invoked by .git-hooks/pre-push (core.hooksPath=.git-hooks, wired by `npm run
# prepare`). The quality gate runs locally on push to main, then a production
# deploy goes to Vercel via the pinned CLI. We deploy from the hook because the
# Vercel↔GitHub git integration is disconnected — the push is now the deploy
# trigger, so a failed deploy fails the push (tight feedback, nothing half-shipped).
# Docs-only pushes take a fast path that skips both the gate and the deploy.
#
# Only acts on a non-deleting push to main/master; feature-branch pushes stay
# fast.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# pre-push stdin: <local ref> <local sha> <remote ref> <remote sha>
ZERO="0000000000000000000000000000000000000000"
push_to_main=""
LOCAL_SHA="" REMOTE_SHA=""
while read -r _local_ref local_sha remote_ref remote_sha; do
  case "$remote_ref" in
    refs/heads/main | refs/heads/master)
      [ "$local_sha" = "$ZERO" ] && continue
      push_to_main="$remote_ref"
      LOCAL_SHA="$local_sha"
      REMOTE_SHA="$remote_sha"
      ;;
  esac
done
[ -z "$push_to_main" ] && exit 0

# --- Markdown lint -----------------------------------------------------------
# Run whenever the pushed range touches markdown, BEFORE the docs-only fast path
# below, so docs-only (and mixed) pushes always lint their markdown and then the
# fast path still skips the expensive gate + deploy. Cheap. Fail-safe: lint when
# the range cannot be computed.
prepush_md_changed() { # <remote_sha> <local_sha>
  local remote_sha="$1" local_sha="$2" f
  [ -n "$remote_sha" ] && [ "$remote_sha" != "$ZERO" ] || return 0
  git cat-file -e "$remote_sha" 2>/dev/null || return 0
  git merge-base --is-ancestor "$remote_sha" "$local_sha" 2>/dev/null || return 0
  while IFS= read -r f; do
    case "$f" in *.md | *.mdx | *.markdown) return 0 ;; esac
  done < <(git diff --name-only "$remote_sha" "$local_sha")
  return 1
}
if prepush_md_changed "$REMOTE_SHA" "$LOCAL_SHA"; then
  echo "• markdown lint"
  bash "$ROOT/scripts/lint-md.sh"
fi

# --- Doc-only fast path -------------------------------------------------------
# Skip the full gate when the pushed range touches only documentation, so prose
# edits don't pay for the lint/type/test battery. Conservative allow-list:
# root-level *.md, the docs/ tree, .github/*.md, and LICENSE — markdown that is
# site CONTENT (under src/, content/, …) still runs the full gate. Falls back to
# the full gate whenever the range can't be computed (new branch, non-fast-
# forward, missing remote sha), so it can only skip too little, never too much.
# Force the full gate with:  FLEET_DOC_FAST=0 git push
prepush_doc_only() { # <remote_sha> <local_sha>  → 0 when the fast path applies
  local remote_sha="$1" local_sha="$2" files f
  [ "${FLEET_DOC_FAST:-1}" = "1" ] || return 1
  [ -n "$remote_sha" ] && [ "$remote_sha" != "$ZERO" ] || return 1
  git cat-file -e "$remote_sha" 2>/dev/null || return 1
  git merge-base --is-ancestor "$remote_sha" "$local_sha" 2>/dev/null || return 1
  files="$(git diff --name-only "$remote_sha" "$local_sha")" || return 1
  [ -n "$files" ] || return 1
  while IFS= read -r f; do
    case "$f" in
      docs/*) ;;
      .github/*.md) ;;
      *.md | *.mdx | *.markdown) [ "${f%/*}" = "$f" ] || return 1 ;;
      LICENSE | LICENSE.*) ;;
      *) return 1 ;;
    esac
  done <<<"$files"
  return 0
}
if prepush_doc_only "$REMOTE_SHA" "$LOCAL_SHA"; then
  echo "▶ pre-push (checkboxes) → $push_to_main: docs-only change — skipping the full gate."
  exit 0
fi

echo "▶ pre-push gate (checkboxes) → $push_to_main"
trap 'echo "✗ pre-push gate failed — nothing deployed; push aborted" >&2' ERR

# The gate + deploy validate the WORKING TREE — refuse if it differs from the
# pushed commit, or prod would ship code that never lands on main.
if [ -n "$(git status --porcelain)" ]; then
  echo "✗ working tree dirty — commit or stash so the gate tests exactly what ships" >&2
  exit 1
fi
if [ "$LOCAL_SHA" != "$(git rev-parse HEAD)" ]; then
  echo "✗ pushed SHA is not HEAD — push from the checkout being validated" >&2
  exit 1
fi
# Non-fast-forward guard: git rejects the push only AFTER this hook, so a stale
# clone would deploy prod and then have its push bounced.
if [ -n "$REMOTE_SHA" ] && [ "$REMOTE_SHA" != "$ZERO" ] && git cat-file -e "$REMOTE_SHA" 2>/dev/null; then
  if ! git merge-base --is-ancestor "$REMOTE_SHA" "$LOCAL_SHA"; then
    echo "✗ remote main advanced (non-fast-forward) — pull/rebase before pushing" >&2
    exit 1
  fi
fi

# --- Quality gate ---
echo "• lint"
npm run lint
echo "• yaml lint"
npm run check:yaml
echo "• astro check"
npx astro check
echo "• build"
npm run build

# --- Deploy: production deploy to Vercel (remote build) ---
# The project link travels as non-secret env vars (same IDs Vercel writes into
# .vercel/project.json) so nothing vendor-owned needs committing — keeps it out
# of the lint/format gate and works in any fresh worktree.
echo "• production deploy (Vercel)"
trap 'echo "✗ Vercel deploy failed — production NOT updated; push aborted. Fix and re-run the push (or: npm run deploy)." >&2' ERR
VERCEL_ORG_ID=team_T8yHg0aDz7nCbyBgJh5a2saR \
VERCEL_PROJECT_ID=prj_Qy2iDBHuQ0n16tuT1vBmeIrgKkxr \
  "$ROOT/node_modules/.bin/vercel" deploy --prod --yes
echo "✓ pre-push gate + deploy complete"
