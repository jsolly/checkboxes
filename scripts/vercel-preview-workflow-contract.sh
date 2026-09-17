#!/usr/bin/env bash
# Lock SHA injection on .github/workflows/vercel-preview.yml. CLI --archive=tgz
# deploys omit .git, so gen-release-id and middleware must receive the PR head SHA.
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

require '--build-env "VERCEL_GIT_COMMIT_SHA=${HEAD_SHA}"' 'pass the PR SHA as a build env'
require '--build-env "GITHUB_SHA=${HEAD_SHA}"' 'pass the PR SHA as a CLI build fallback'
require '--env "VERCEL_GIT_COMMIT_SHA=${HEAD_SHA}"' 'pass the PR SHA as middleware runtime env'
require '--env "GITHUB_SHA=${HEAD_SHA}"' 'pass the PR SHA as middleware runtime fallback'
require '--meta "githubDeployment=1"' 'mark the CLI deploy as a GitHub deployment'
require '--meta "githubCommitSha=${HEAD_SHA}"' 'attach the PR SHA as GitHub commit metadata'

echo "✓ vercel-preview workflow injects the PR commit SHA"
