#!/usr/bin/env bash
# Federate this Cloud Agent VM into IAM role agent-readonly via vendor OIDC.
# Laptop agents use Identity Center AgentReadOnly instead — this script no-ops
# when no cloud OIDC identity is present.
#
# Install/start writes ~/.aws/config with credential_process (no static keys).
# `aws` then mints a JWT and assumes the role at use time; the CLI caches until
# Expiration. Do not persist Build-time STS keys — they expire in 1h and install
# does not re-run on later agent starts.
#
# It also writes profile agent-host-operator for host work on
# fleet:agent-operable=true instances, used only explicitly:
# `AWS_PROFILE=agent-host-operator aws ssm ...`. The default stays agent-readonly.
# On Cursor Cloud both roles trust the same JWT, so the split is a convention, not
# a boundary (rules/agent-cloud-access.md → Agent-operable hosts).
set -euo pipefail

ACCOUNT_ID=730335616323
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
CURSOR_SOCK="${CURSOR_AGENT_SOCKET:-/run/cursor/api.sock}"
HELPER="${HOME}/.local/bin/aws-oidc-login.sh"
# Every role this script writes a profile for. Each must also have a case arm below,
# which owns its ARN and session name.
ROLES=(agent-readonly agent-host-operator)

# One argv shape: no arguments (install), or --credential-process <role> (AWS CLI callback).
CREDENTIAL_PROCESS=0
ROLE=agent-readonly
if [[ "${1:-}" == "--credential-process" ]]; then
  CREDENTIAL_PROCESS=1
  ROLE="${2:-}"
fi

# A literal allowlist. AWS_ROLE_ARN may repoint the read role (a Cursor
# Environment Variable), never the host role.
case "$ROLE" in
  agent-readonly)
    ROLE_ARN="${AWS_ROLE_ARN:-arn:aws:iam::${ACCOUNT_ID}:role/agent-readonly}"
    SESSION_NAME="${AWS_ROLE_SESSION_NAME:-cloud-agent}"
    ;;
  agent-host-operator)
    ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/agent-host-operator"
    SESSION_NAME="cloud-agent-host"
    ;;
  *)
    echo "aws-oidc-login: unknown role '${ROLE}' (want one of: ${ROLES[*]})" >&2
    exit 2
    ;;
esac

log() {
  if [[ "$CREDENTIAL_PROCESS" -eq 1 ]]; then
    echo "aws-oidc-login: $*" >&2
  else
    echo "aws-oidc-login: $*"
  fi
}

# True when this process is root or has passwordless sudo.
can_run_as_root() {
  [[ "$(id -u)" -eq 0 ]] || { command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; }
}
# Run a command as root: directly when root, else through passwordless sudo.
run_as_root() {
  if [[ "$(id -u)" -eq 0 ]]; then "$@"; else sudo -n "$@"; fi
}

# Bounded downloads: a stalled connection must not hang the bootstrap.
fetch() {
  curl -fsSL --connect-timeout 10 --max-time 120 "$1" -o "$2"
}

verify_sha256() {
  local file="$1" want="$2" got
  got="$(sha256sum "$file" 2>/dev/null || shasum -a 256 "$file" 2>/dev/null || true)"
  [[ "${got%% *}" == "$want" ]]
}

install_aws_cli() {
  if command -v aws >/dev/null 2>&1; then
    return 0
  fi
  log "installing AWS CLI v2"
  local arch bundle dest
  arch="$(uname -m)"
  case "$arch" in
    aarch64 | arm64) bundle="awscli-exe-linux-aarch64.zip" ;;
    x86_64) bundle="awscli-exe-linux-x86_64.zip" ;;
    *)
      log "unsupported arch ${arch}; install aws CLI manually" >&2
      return 1
      ;;
  esac
  dest="$(mktemp -d)"
  fetch "https://awscli.amazonaws.com/${bundle}" "${dest}/awscliv2.zip"
  unzip -q "${dest}/awscliv2.zip" -d "$dest"
  if can_run_as_root; then
    run_as_root "${dest}/aws/install"
  else
    mkdir -p "${HOME}/.local/bin"
    "${dest}/aws/install" -i "${HOME}/.local/aws-cli" -b "${HOME}/.local/bin"
    if [[ -d /etc/profile.d && -w /etc/profile.d ]]; then
      printf 'export PATH="%s/.local/bin:$PATH"\n' "$HOME" >/etc/profile.d/aws-local-bin.sh
    fi
    # Non-login bash -c still misses ~/.local/bin; prefer a root install above.
    export PATH="${HOME}/.local/bin:${PATH}"
    if [[ -w /usr/local/bin ]]; then
      ln -sfn "${HOME}/.local/bin/aws" /usr/local/bin/aws
    fi
  fi
  rm -rf "$dest"
  command -v aws >/dev/null 2>&1 || {
    log "aws CLI not on PATH after install" >&2
    return 1
  }
}

# `aws ssm start-session` needs AWS's Session Manager plugin. Best effort: a
# missing plugin never fails the credential bootstrap (it runs after it), and
# `aws ssm send-command` works without it. Pinned and sha256-checked, since it
# installs as root; bump the version and both hashes together.
SSM_PLUGIN_VERSION=1.2.835.0
install_session_manager_plugin() {
  if command -v session-manager-plugin >/dev/null 2>&1; then
    return 0
  fi
  local arch sha dest deb
  case "$(uname -m)" in
    aarch64 | arm64) arch="ubuntu_arm64" sha=0add94c4c8b6ca63f26e44fd655d662b0f6455a268b5b9ebebee0f462214e928 ;;
    x86_64) arch="ubuntu_64bit" sha=7c6dcad12518571cc7959a713e6a8ae1bdf6ed66fd9bee37dc189e39ca58ae03 ;;
    *)
      log "Session Manager plugin: unsupported arch; start-session unavailable"
      return 0
      ;;
  esac
  if ! command -v dpkg >/dev/null 2>&1; then
    log "Session Manager plugin: no dpkg; start-session unavailable"
    return 0
  fi
  dest="$(mktemp -d)"
  deb="${dest}/session-manager-plugin.deb"
  if ! fetch "https://s3.amazonaws.com/session-manager-downloads/plugin/${SSM_PLUGIN_VERSION}/${arch}/session-manager-plugin.deb" "$deb"; then
    log "Session Manager plugin: download failed; start-session unavailable"
  elif ! verify_sha256 "$deb" "$sha"; then
    log "Session Manager plugin: sha256 mismatch for ${SSM_PLUGIN_VERSION}; not installed"
  elif ! can_run_as_root; then
    log "Session Manager plugin: no root or passwordless sudo; start-session unavailable"
  else
    run_as_root dpkg -i "$deb" >/dev/null || log "Session Manager plugin: dpkg -i failed"
  fi
  rm -rf "$dest"
  return 0
}

extract_oidc_token() {
  python3 -c '
import json, sys
raw = sys.stdin.read().strip()
if raw.startswith("eyJ"):
    print(raw)
    raise SystemExit(0)
data = json.loads(raw)
for key in ("token", "oidc_token", "id_token", "access_token"):
    value = data.get(key)
    if isinstance(value, str) and value:
        print(value)
        raise SystemExit(0)
raise SystemExit("no token in OIDC response")
'
}

jwt_sub() {
  python3 -c '
import base64, json, sys
parts = sys.argv[1].split(".")
if len(parts) < 2:
    raise SystemExit(0)
pad = "=" * ((4 - len(parts[1]) % 4) % 4)
payload = json.loads(base64.urlsafe_b64decode(parts[1] + pad))
print(payload.get("sub", ""))
' "$1"
}

prefer_oidc_chain() {
  # Env static keys and Cursor's proprietary AssumeRole beat credential_process.
  unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
  unset CURSOR_AWS_ASSUME_IAM_ROLE_ARN
  export AWS_CONFIG_FILE="${HOME}/.aws/config"
  export AWS_PROFILE=agent-readonly
  export AWS_REGION="$REGION"
  export AWS_DEFAULT_REGION="$REGION"
}

append_aws_exports() {
  local rc="$1"
  touch "$rc"
  if ! grep -q 'AWS_PROFILE=agent-readonly' "$rc" 2>/dev/null; then
    cat >> "$rc" <<EOF

# Cloud Agent AWS read role (vendor OIDC → agent-readonly)
export AWS_PROFILE=agent-readonly
export AWS_REGION=${REGION}
export AWS_DEFAULT_REGION=${REGION}
export PATH="\$HOME/.local/bin:/usr/local/bin:\$PATH"
EOF
  fi
  if ! grep -q 'unset AWS_ACCESS_KEY_ID' "$rc" 2>/dev/null; then
    cat >> "$rc" <<'EOF'
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
unset CURSOR_AWS_ASSUME_IAM_ROLE_ARN
export AWS_CONFIG_FILE="$HOME/.aws/config"
EOF
  fi
}

install_helper() {
  mkdir -p "$(dirname "$HELPER")"
  local src
  src="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
  if [[ "$src" != "$HELPER" ]]; then
    cp "$src" "$HELPER"
  fi
  chmod 0755 "$HELPER"
}

# credential_process so later agent starts (and calls after 1h) mint fresh STS
# creds. [default] aliases agent-readonly for non-login bash -c that never
# sources bashrc.
profile_stanza() {
  printf 'credential_process = %s --credential-process %s\nregion = %s\noutput = json\n' "$HELPER" "$1" "$REGION"
}

write_profile() {
  mkdir -p "${HOME}/.aws"
  umask 077
  rm -f "${HOME}/.aws/credentials"
  {
    printf '[default]\n'
    profile_stanza agent-readonly
    local role
    for role in "${ROLES[@]}"; do
      printf '\n[profile %s]\n' "$role"
      profile_stanza "$role"
    done
  } > "${HOME}/.aws/config"
  append_aws_exports "${HOME}/.bashrc"
  append_aws_exports "${HOME}/.profile"
  prefer_oidc_chain
}

assume_web_identity_json() {
  local token="$1"
  # Do not load this profile's credential_process (infinite recursion).
  env -u AWS_PROFILE -u AWS_ACCESS_KEY_ID -u AWS_SECRET_ACCESS_KEY -u AWS_SESSION_TOKEN \
    AWS_EC2_METADATA_DISABLED=true \
    AWS_CONFIG_FILE=/dev/null \
    AWS_SHARED_CREDENTIALS_FILE=/dev/null \
    aws sts assume-role-with-web-identity \
    --role-arn "$ROLE_ARN" \
    --role-session-name "$SESSION_NAME" \
    --web-identity-token "$token" \
    --duration-seconds 3600 \
    --region "$REGION" \
    --output json
}

mint_cursor_jwt() {
  local raw
  if raw="$(
    curl --fail --silent --show-error --connect-timeout 10 --max-time 30 \
      --unix-socket "$CURSOR_SOCK" \
      -H "Content-Type: application/json" \
      -d '{"aud":"sts.amazonaws.com"}' \
      http://localhost/v1/tokens/oidc
  )"; then
    printf '%s' "$raw" | extract_oidc_token
  else
    local status=$?
    log "ERROR: cannot mint Cursor OIDC token (curl exit $status; 30-second deadline). Check the Cursor socket and token service." >&2
    return "$status"
  fi
}

wait_for_cursor_sock() {
  on_cursor_host=0
  if [[ -n "${CURSOR_AGENT_SOCKET:-}" || -d /run/cursor ]]; then
    on_cursor_host=1
    i=0
    while [[ ! -S "$CURSOR_SOCK" && "$i" -lt 6 ]]; do
      log "waiting for OIDC socket ${CURSOR_SOCK}"
      sleep 2
      i=$((i + 1))
    done
  fi
}

emit_credential_process() {
  local token creds
  token="$(mint_cursor_jwt)"
  creds="$(assume_web_identity_json "$token")"
  python3 -c '
import json, sys
c = json.loads(sys.argv[1])["Credentials"]
print(json.dumps({
    "Version": 1,
    "AccessKeyId": c["AccessKeyId"],
    "SecretAccessKey": c["SecretAccessKey"],
    "SessionToken": c["SessionToken"],
    "Expiration": c["Expiration"],
}))
' "$creds"
}

wait_for_cursor_sock

if [[ "$CREDENTIAL_PROCESS" -eq 1 ]]; then
  if [[ ! -S "$CURSOR_SOCK" ]]; then
    log "OIDC socket missing (${CURSOR_SOCK})" >&2
    exit 1
  fi
  emit_credential_process
  exit 0
fi

if [[ -S "$CURSOR_SOCK" ]]; then
  install_aws_cli
  log "Cursor Cloud OIDC socket at ${CURSOR_SOCK}"
  token="$(mint_cursor_jwt)"
  sub="$(jwt_sub "$token")"
  log "minted JWT sub=${sub:-unknown}"
  # Helper and config change together, after the mint succeeds: a failed run keeps the old pair.
  install_helper
  write_profile
  identity="$(aws sts get-caller-identity --profile agent-readonly --region "$REGION" --output json)"
  printf '%s\n' "$identity"
  arn="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["Arn"])' "$identity")"
  case "$arn" in
    *:assumed-role/agent-readonly/*) ;;
    *)
      log "expected assumed-role/agent-readonly, got ${arn}" >&2
      exit 1
      ;;
  esac
  log "assumed ${ROLE_ARN} as profile agent-readonly"
  # Not assumed here: the role may not be deployed yet, and host work is explicit.
  log "wrote profile agent-host-operator (host work only: AWS_PROFILE=agent-host-operator)"
  # Last, so a plugin problem can never delay or fail the credentials above.
  install_session_manager_plugin || log "Session Manager plugin: install step failed; start-session unavailable"
  exit 0
fi

if [[ "${on_cursor_host:-0}" -eq 1 ]]; then
  log "Cursor Cloud OIDC socket missing after wait (${CURSOR_SOCK}); fail" >&2
  exit 1
fi

# Other vendors (Claude, Codex) have no published VM OIDC issuer yet; they land here too.
log "no cloud-agent OIDC identity; skip"
exit 0
