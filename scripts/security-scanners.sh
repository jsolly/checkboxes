#!/usr/bin/env bash
((BASH_VERSINFO[0] >= 5)) || { echo "✗ $0 requires Bash >= 5, not $BASH_VERSION. Fix: brew install bash; open a fresh shell and rerun repository setup." >&2; exit 1; }
# Pinned scanners for commit quality gates, standalone use and security CI.
# A binary already on PATH or installed by mise is used when its version matches.
# Otherwise the official release is downloaded and checked against the SHA-256
# below. Semgrep and cfn-lint are PyPI packages run through the pinned uv.
# Gitleaks stays on 8.24.2, the same release as gate/gate-lib.sh and CI.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$ROOT"

ZIZMOR_VERSION=1.32.0
OSV_VERSION=2.7.1
GITLEAKS_VERSION=8.24.2
SEMGREP_VERSION=1.184.0
CFN_LINT_VERSION=1.60.0
UV_VERSION=0.12.22

cache="${XDG_CACHE_HOME:-$HOME/.cache}/checkboxes-security-scanners"
mkdir -p "$cache"
chmod 700 "$cache"

sha256_file() {
  local sum
  if command -v sha256sum >/dev/null 2>&1; then
    sum="$(sha256sum "$1")"
  elif command -v shasum >/dev/null 2>&1; then
    sum="$(shasum -a 256 "$1")"
  else
    echo "✗ sha256sum or shasum is required to verify scanner downloads" >&2
    return 1
  fi
  printf '%s\n' "${sum%% *}"
}

version_matches() {
  local text
  text="$("$1" --version 2>&1 || true)"
  [[ "$text" == *"$2"* ]]
}

mise_bin() {
  local tool="$1" version="$2" dir="" candidate
  command -v mise >/dev/null 2>&1 || return 1
  dir="$(cd / && mise where "${tool}@${version}" 2>/dev/null)" || return 1
  # Python tools are a directory of that name with bin/<tool> inside it.
  for candidate in "$dir/$tool" "$dir/bin/$tool" "$dir/$tool/bin/$tool"; do
    if [[ -f "$candidate" && -x "$candidate" ]] && version_matches "$candidate" "$version"; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

path_bin() {
  local tool="$1" version="$2" candidate
  candidate="$(command -v "$tool" 2>/dev/null || true)"
  [[ -n "$candidate" && -f "$candidate" && -x "$candidate" ]] || return 1
  version_matches "$candidate" "$version" || return 1
  printf '%s\n' "$candidate"
}

# download_tool <name> <version> <url> <sha256> <archive|file> <binary-name>
download_tool() {
  local name="$1" version="$2" url="$3" expected="$4" kind="$5" binary_name="$6"
  local dest="$cache/${name}-${version}-${expected}" work payload extracted
  if [[ -x "$dest" ]]; then
    printf '%s\n' "$dest"
    return 0
  fi
  work="$(mktemp -d)"
  # shellcheck disable=SC2064
  trap "rm -rf '$work'" RETURN
  payload="$work/payload"
  curl --fail --location --silent --show-error --connect-timeout 10 --max-time 180 --retry 3 \
    "$url" --output "$payload" \
    || { echo "✗ could not download $name $version from $url" >&2; return 1; }
  if [[ "$(sha256_file "$payload")" != "$expected" ]]; then
    echo "✗ $name $version from $url does not match its pinned SHA-256" >&2
    return 1
  fi
  if [[ "$kind" == archive ]]; then
    tar -xzf "$payload" -C "$work"
    extracted=""
    while IFS= read -r candidate; do
      extracted="$candidate"
      break
    done < <(find "$work" -type f -name "$binary_name")
    [[ -n "$extracted" ]] || { echo "✗ $name archive has no $binary_name file" >&2; return 1; }
  else
    extracted="$payload"
  fi
  install -m 755 "$extracted" "$dest.new"
  mv -f "$dest.new" "$dest"
  printf '%s\n' "$dest"
}

select_release() {
  local tool="$1"
  case "$(uname -s)/$(uname -m)" in
    Linux/x86_64)
      case "$tool" in
        zizmor) printf '%s %s %s\n' \
          "https://github.com/zizmorcore/zizmor/releases/download/v${ZIZMOR_VERSION}/zizmor-x86_64-unknown-linux-gnu.tar.gz" \
          bb110cc765eca9cd7efb2e284a956be5974c60027b0970f16397d86208a9957b archive ;;
        osv-scanner) printf '%s %s %s\n' \
          "https://github.com/google/osv-scanner/releases/download/v${OSV_VERSION}/osv-scanner_linux_amd64" \
          fb7dab19a8bd9bbe5c3189f09d4b7ee1820c9553a23bac202648a56efd2f6ee8 file ;;
        gitleaks) printf '%s %s %s\n' \
          "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz" \
          fa0500f6b7e41d28791ebc680f5dd9899cd42b58629218a5f041efa899151a8e archive ;;
        *) return 1 ;;
      esac ;;
    Linux/aarch64 | Linux/arm64)
      case "$tool" in
        zizmor) printf '%s %s %s\n' \
          "https://github.com/zizmorcore/zizmor/releases/download/v${ZIZMOR_VERSION}/zizmor-aarch64-unknown-linux-gnu.tar.gz" \
          cb152b207f815116d7fa1c1ee4614f61578803351395052908095e79adfd9fd0 archive ;;
        osv-scanner) printf '%s %s %s\n' \
          "https://github.com/google/osv-scanner/releases/download/v${OSV_VERSION}/osv-scanner_linux_arm64" \
          983d22fbad9724514e3fcc6acc83b5fa64c5ffa6b0d9f510028f22c1b223ff81 file ;;
        gitleaks) printf '%s %s %s\n' \
          "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_arm64.tar.gz" \
          574a6d52573c61173add7ddb5e3cc68c0e82cb0735818a1eeb9a0a2de1643fbc archive ;;
        *) return 1 ;;
      esac ;;
    Darwin/arm64)
      case "$tool" in
        zizmor) printf '%s %s %s\n' \
          "https://github.com/zizmorcore/zizmor/releases/download/v${ZIZMOR_VERSION}/zizmor-aarch64-apple-darwin.tar.gz" \
          6efed18c4539a663fd3c851a2be9533fd8456c4e646d9416206da059154a0d3c archive ;;
        osv-scanner) printf '%s %s %s\n' \
          "https://github.com/google/osv-scanner/releases/download/v${OSV_VERSION}/osv-scanner_darwin_arm64" \
          b22c02877a811c8f78956e8643efa554932b7378f590d13f8e97d4e9448a29f3 file ;;
        *) return 1 ;;
      esac ;;
    Darwin/x86_64)
      case "$tool" in
        zizmor) printf '%s %s %s\n' \
          "https://github.com/zizmorcore/zizmor/releases/download/v${ZIZMOR_VERSION}/zizmor-x86_64-apple-darwin.tar.gz" \
          6983143c719ada6845a69cc4dd2bacc215f971662fecd8bbd2678388e5ce5969 archive ;;
        osv-scanner) printf '%s %s %s\n' \
          "https://github.com/google/osv-scanner/releases/download/v${OSV_VERSION}/osv-scanner_darwin_amd64" \
          b8420d5485ba792626315f1bf9a5a2046e971d38eea75bf9090c38852dbc3b1b file ;;
        *) return 1 ;;
      esac ;;
    *) return 1 ;;
  esac
}

resolve_binary() {
  local tool="$1" version="$2" binary_name="$3" release url sha kind
  if path_bin "$tool" "$version"; then
    return 0
  fi
  if mise_bin "$tool" "$version"; then
    return 0
  fi
  release="$(select_release "$tool" || true)"
  if [[ -z "$release" ]]; then
    echo "✗ $tool $version is not on PATH and this platform has no pinned release — run reviewed scripts/setup-agent-environment.sh" >&2
    return 1
  fi
  read -r url sha kind <<<"$release"
  download_tool "$tool" "$version" "$url" "$sha" "$kind" "$binary_name"
}

run_uv_tool() {
  local distribution="$1"
  shift
  if command -v uv >/dev/null 2>&1; then
    uvx --from "$distribution" "$@"
    return
  fi
  if command -v mise >/dev/null 2>&1; then
    mise exec "uv@${UV_VERSION}" -- uvx --from "$distribution" "$@"
    return
  fi
  echo "✗ uv ${UV_VERSION} is required to run $distribution — run reviewed scripts/setup-agent-environment.sh" >&2
  return 1
}

run_python_tool() {
  local tool="$1" version="$2" distribution="$3"
  shift 3
  local bin=""
  bin="$(mise_bin "$tool" "$version" || true)"
  if [[ -z "$bin" ]]; then
    bin="$(path_bin "$tool" "$version" || true)"
  fi
  if [[ -n "$bin" ]]; then
    "$bin" "$@"
    return
  fi
  run_uv_tool "$distribution" "$tool" "$@"
}

cmd_zizmor() {
  local bin
  bin="$(resolve_binary zizmor "$ZIZMOR_VERSION" zizmor)"
  "$bin" --offline --no-progress --color never --persona regular .github
}

cmd_cfn_lint() {
  local template="config/aws/static-assets/template.json"
  [[ -f "$template" ]] || { echo "✗ missing CloudFormation template $template" >&2; return 1; }
  run_python_tool cfn-lint "$CFN_LINT_VERSION" "cfn-lint==${CFN_LINT_VERSION}" \
    --format parseable "$template"
}

cmd_semgrep() {
  run_python_tool semgrep "$SEMGREP_VERSION" "semgrep==${SEMGREP_VERSION}" \
    scan --config p/default --error --metrics=off --disable-version-check
}

cmd_osv() {
  local bin
  [[ -f package-lock.json ]] || { echo "✗ missing package-lock.json" >&2; return 1; }
  bin="$(resolve_binary osv-scanner "$OSV_VERSION" osv-scanner)"
  # Dispositions live in the Python checker. It passes an empty config so a
  # branch-supplied osv-scanner ignore file cannot hide findings.
  bash scripts/repo-python.sh scripts/osv-dispositions.py --scanner "$bin"
}

cmd_gitleaks_range() {
  local bin base_ref base range merges
  base_ref="${GITHUB_BASE_REF:-main}"
  if [[ ! "$base_ref" =~ ^[A-Za-z0-9._/-]+$ || "$base_ref" == *".."* ]]; then
    echo "✗ refusing unreadable base ref for the gitleaks range" >&2
    return 1
  fi
  base="refs/remotes/origin/${base_ref}"
  git rev-parse --verify --quiet "$base" >/dev/null \
    || { echo "✗ gitleaks base $base is not in this checkout" >&2; return 1; }
  range="${base}..HEAD"
  merges="$(git rev-list --min-parents=3 "$range")"
  if [[ -n "$merges" ]]; then
    echo "✗ $range holds a merge with three or more parents, which the scan cannot read" >&2
    return 1
  fi
  bin="$(resolve_binary gitleaks "$GITLEAKS_VERSION" gitleaks)"
  echo "Scanning $range"
  "$bin" git --no-banner --no-color --redact --verbose \
    --log-opts="--text --diff-merges=remerge --no-color --no-textconv ${range}"
}

case "${1:-}" in
  zizmor) cmd_zizmor ;;
  cfn-lint) cmd_cfn_lint ;;
  semgrep) cmd_semgrep ;;
  osv) cmd_osv ;;
  gitleaks-range) cmd_gitleaks_range ;;
  *)
    echo "usage: scripts/security-scanners.sh {zizmor|cfn-lint|semgrep|osv|gitleaks-range}" >&2
    exit 2 ;;
esac
