#!/usr/bin/env bash
# Copy the gitignored files listed in .worktreeinclude from the primary checkout into
# the current worktree. Run by the repo-owned `npm run worktree:init` entrypoint,
# which the committed Cursor and Codex worktree configurations both invoke.
#
# Copy, never symlink — a symlinked .env.local resolves outside the worktree root and
# trips Vite's server.fs.allow. cp -p preserves the 0600 mode on .env.local.
#
# No manifest or zero glob matches are valid. If Git or an allowlisted copy
# fails, stop before dependency setup instead of leaving a partial worktree.
((BASH_VERSINFO[0] >= 5)) || { echo "✗ $0 requires Bash >= 5, not $BASH_VERSION. Fix: brew install bash; open a fresh shell and rerun repository setup." >&2; exit 1; }
set -euo pipefail

dest="$(git rev-parse --show-toplevel)"
manifest="$dest/.worktreeinclude"
[ -f "$manifest" ] || exit 0

# The first `worktree` entry in --porcelain output is the primary checkout. Strip the
# fixed `worktree ` prefix rather than field-splitting — the path is verbatim and may
# contain spaces, which `awk '{print $2}'` would truncate.
primary="$(git worktree list --porcelain | sed -n '1s/^worktree //p')"
if [ -z "$primary" ]; then
  echo "worktree-init: Git did not list a primary checkout" >&2
  exit 1
fi
[ "$primary" = "$dest" ] && exit 0  # running in the primary itself; nothing to copy

while IFS= read -r line || [ -n "$line" ]; do
  line="${line%%#*}"                                  # strip trailing comment
  line="${line#"${line%%[![:space:]]*}"}"             # trim leading whitespace
  line="${line%"${line##*[![:space:]]}"}"             # trim trailing whitespace
  [ -n "$line" ] || continue
  # Reject absolute paths and `..` traversal.
  # .worktreeinclude is repo-controlled, but `../../.ssh/id_rsa` would read outside the
  # primary AND, since the prefix-strip leaves `..` in $rel, write outside the worktree.
  case "/$line/" in
    //*|*/../*) echo "worktree-init: skipping unsafe .worktreeinclude entry '$line'" >&2; continue ;;
  esac
  for src in "$primary"/$line; do                     # glob-expand against the primary
    [ -e "$src" ] || continue                         # tolerate zero matches
    rel="${src#"$primary"/}"
    if ! mkdir -p "$dest/$(dirname "$rel")" || ! cp -p "$src" "$dest/$rel"; then
      echo "worktree-init: could not copy $rel" >&2
      exit 1
    fi
    echo "worktree-init: copied $rel" >&2
  done
done < "$manifest"
