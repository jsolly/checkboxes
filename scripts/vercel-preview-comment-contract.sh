#!/usr/bin/env bash
# Lock the /preview comment matcher used by .github/workflows/vercel-preview.yml.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MATCHER="$ROOT/scripts/vercel-preview-comment.sh"

fail() {
	echo "✗ $*" >&2
	exit 1
}

assert_match() {
	local label="$1"
	local body="$2"
	if ! printf '%s' "$body" | "$MATCHER"; then
		fail "expected a Preview request: $label"
	fi
}

assert_skip() {
	local label="$1"
	local body="$2"
	if printf '%s' "$body" | "$MATCHER"; then
		fail "did not expect a Preview request: $label"
	fi
}

assert_match 'bare command' '/preview'
assert_match 'leading blank line' $'\n\n/preview\n'
assert_match 'trailing notes' $'/preview\n\nplease build this PR\n'
assert_match 'windows newlines' $'/preview\r\nnext line\r\n'

assert_skip 'empty' ''
assert_skip 'prose mention' 'see /preview in AGENTS.md'
assert_skip 'command with args' '/preview now'
assert_skip 'prefix collision' '/preview-deploy'
assert_skip 'not first line' $'please\n/preview\n'

echo "✓ vercel-preview-comment matcher"
