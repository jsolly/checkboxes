#!/usr/bin/env bash
# Lint markdown with the markdownlint-cli2 version pinned in package.json / package-lock.json.
# Pass --fix to auto-fix violations: bash scripts/lint-md.sh --fix
#
# Requires a local install (`npm ci` or `npm run worktree:init`) — runs offline with
# node_modules/.bin/markdownlint-cli2. No npx fallback: missing deps must fail the gate.
((BASH_VERSINFO[0] >= 5)) || { echo "✗ $0 requires Bash >= 5, not $BASH_VERSION. Fix: brew install bash; rerun bash ~/code/dotagents/setup/install-local-agent-runtime.sh; open a new shell." >&2; exit 1; }
set -euo pipefail
cd "$(dirname "$0")/.."
bin="node_modules/.bin/markdownlint-cli2"
if [[ ! -x "$bin" ]]; then
  echo "lint-md: $bin not found — run 'npm ci' (or 'npm run worktree:init' in a worktree)." >&2
  exit 1
fi
exec "$bin" "$@" "**/*.md"
