#!/usr/bin/env bash
((BASH_VERSINFO[0] >= 5)) || { echo "✗ $0 requires Bash >= 5, not $BASH_VERSION. Fix: brew install bash; open a fresh shell and rerun repository setup." >&2; exit 1; }
# Cursor beforeShellExecution gate for git commit and git push. Prints one JSON
# permission decision on stdout. Findings omit secret values. A broken scanner
# denies the command; .cursor/hooks.json sets failClosed so a crash does too.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$ROOT"
# shellcheck source=gate/gate-lib.sh
source "$ROOT/gate/gate-lib.sh"

input="$(cat)"
report="$(mktemp)"
trap 'rm -f "$report"' EXIT

python3 -I -c 'import sys; sys.exit(sys.version_info < (3, 11))' >/dev/null

kinds="$(
  INPUT="$input" python3 -I - <<'PY'
import json, os, shlex, sys

def kinds(command):
    try:
        tokens = shlex.split(command, posix=True)
    except ValueError:
        return {"commit", "push"}
    found = set()
    index = 0
    while index < len(tokens):
        base = tokens[index].rsplit("/", 1)[-1]
        if base not in {"git", "git.exe"}:
            index += 1
            continue
        cursor = index + 1
        while cursor < len(tokens) and tokens[cursor].startswith("-"):
            flag = tokens[cursor]
            cursor += 1
            if flag in {"-C", "--git-dir", "--work-tree", "-c"} and cursor < len(tokens):
                cursor += 1
        if cursor < len(tokens) and tokens[cursor] in {"commit", "push"}:
            found.add(tokens[cursor])
        index = max(cursor, index + 1)
    return found

try:
    payload = json.loads(os.environ["INPUT"])
except json.JSONDecodeError:
    print("deny")
    sys.exit(0)
command = payload.get("command")
if not isinstance(command, str) or command.strip() == "":
    print("deny")
    sys.exit(0)
found = kinds(command)
if not found:
    print("allow")
else:
    print(" ".join(sorted(found)))
PY
)"

allow() {
  printf '%s\n' '{"permission":"allow"}'
  exit 0
}

deny() {
  local action="$1"
  shift
  ACTION="$action" python3 -I - "$@" <<'PY'
import json, os, sys
findings = [line for line in sys.argv[1:] if line]
action = os.environ["ACTION"]
message = f"Gitleaks blocked this git {action}. Secret values were not included."
if findings:
    shown = findings[:20]
    extra = len(findings) - len(shown)
    message += " " + "; ".join(shown)
    if extra > 0:
        message += f"; and {extra} more"
print(json.dumps({
    "permission": "deny",
    "user_message": message,
    "agent_message": message,
}))
PY
  exit 0
}

summarize_report() {
  REPORT="$report" python3 -I - <<'PY'
import json, os, sys
path = os.environ["REPORT"]
try:
    data = json.load(open(path))
except (OSError, json.JSONDecodeError):
    sys.exit(0)
if not isinstance(data, list):
    sys.exit(0)
for item in data:
    if not isinstance(item, dict):
        continue
    rule = str(item.get("RuleID") or "finding")
    file = str(item.get("File") or "unknown")
    line = item.get("StartLine")
    suffix = f":{line}" if isinstance(line, int) else ""
    print(f"{rule} {file}{suffix}")
PY
}

scan_commit() {
  local gl tree blob numstat added deleted path unread=""
  gl="$(gate_gitleaks_bin)" || deny "commit" "pinned gitleaks is not available"
  blob="$(printf '* diff\n' | git hash-object -w --stdin)" || deny "commit" "scanner failed closed"
  tree="$(printf '100644 blob %s\t.gitattributes\n' "$blob" | git mktree)" || deny "commit" "scanner failed closed"
  numstat="$(GIT_ATTR_SOURCE="$tree" git diff --cached --numstat --diff-filter=d)" || deny "commit" "scanner failed closed"
  while IFS=$'\t' read -r added deleted path; do
    [[ "$added$deleted" != -- ]] || unread+="$path"$'\n'
  done <<<"$numstat"
  if [[ -n "$unread" ]]; then
    deny "commit" "unreadable staged path"
  fi
  if ! GIT_ATTR_SOURCE="$tree" "$gl" git --no-banner --no-color --redact \
    --pre-commit --staged --report-format json --report-path "$report" >/dev/null; then
    mapfile -t findings < <(summarize_report)
    if [[ ${#findings[@]} -eq 0 ]]; then
      deny "commit" "scanner failed closed"
    fi
    deny "commit" "${findings[@]}"
  fi
}

scan_push() {
  local gl range="HEAD"
  gl="$(gate_gitleaks_bin)" || deny "push" "pinned gitleaks is not available"
  if git rev-parse --verify --quiet refs/remotes/origin/main >/dev/null; then
    range="refs/remotes/origin/main..HEAD"
  fi
  if ! "$gl" git --no-banner --no-color --redact --report-format json --report-path "$report" \
    --log-opts="--text --no-color --no-textconv ${range}" >/dev/null; then
    mapfile -t findings < <(summarize_report)
    if [[ ${#findings[@]} -eq 0 ]]; then
      deny "push" "scanner failed closed"
    fi
    deny "push" "${findings[@]}"
  fi
}

case "$kinds" in
  allow) allow ;;
  deny) deny "command" "hook input was not a readable command" ;;
esac
if [[ "$kinds" == *commit* ]]; then
  scan_commit
fi
if [[ "$kinds" == *push* ]]; then
  scan_push
fi
allow
