#!/usr/bin/env bash
# Lock the safety and metadata contract of .github/workflows/vercel-preview.yml.
# CLI --archive=tgz deploys omit .git, so the build must receive the PR head SHA.
# Copy from templates/github/.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKFLOW="$ROOT/.github/workflows/vercel-preview.yml"

fail() {
	echo "✗ $*" >&2
	exit 1
}

[[ -f "$WORKFLOW" ]] || fail "missing $WORKFLOW"

require() {
	local needle="$1"
	local label="$2"
	if ! grep -F -- "$needle" "$WORKFLOW" >/dev/null; then
		fail "Vercel Preview workflow must ${label}: ${needle}"
	fi
}

require '--build-env "VERCEL_GIT_COMMIT_SHA=${HEAD_SHA}"' 'pass the PR SHA as a Vite build env'
require '--meta "githubDeployment=1"' 'mark the CLI deploy as a GitHub deployment'
require '--meta "githubCommitSha=${HEAD_SHA}"' 'attach the PR SHA as GitHub commit metadata'
require 'jq -r '"'"'.head.sha'"'"'' 'resolve the Preview SHA from the PR head, not github.sha'
require 'ref: ${{ steps.pr.outputs.head_sha }}' 'check out the resolved PR head SHA'
require 'printf '"'"'%s'"'"' "$COMMENT_BODY" | bash scripts/vercel-preview-comment.sh' 'pipe comments through the exact /preview matcher'
require 'github.event.comment.author_association == '"'"'OWNER'"'"'' 'restrict comment deploys to owner/member/collaborator'
require 'head_repo" != "$REPO"' 'refuse fork PR heads'
require 'persist-credentials: false' 'do not persist the Actions token on checkout'
require 'cd "$RUNNER_TEMP" && npx --yes vercel@59.20.0 deploy --yes --archive=tgz --cwd "$GITHUB_WORKSPACE"' 'run the pinned GeoRoids CLI from outside the PR tree (npm reads no PR .npmrc or node_modules/vercel while VERCEL_TOKEN is set) with the tgz archive that omits .git'
require 'cancel-in-progress: false' 'not cancel an in-flight /preview when a later comment lands'

echo "✓ vercel-preview workflow contract holds"
