#!/usr/bin/env bash
# Exit 0 when the comment body is an explicit Preview request (/preview on its
# first non-empty line, nothing else on that line). Exit 1 otherwise.
set -euo pipefail

body="${1-}"
if [[ -z "$body" ]]; then
	body=$(cat)
fi
body=${body//$'\r'/}

first=""
while IFS= read -r line || [[ -n "$line" ]]; do
	trimmed="${line#"${line%%[![:space:]]*}"}"
	trimmed="${trimmed%"${trimmed##*[![:space:]]}"}"
	if [[ -n "$trimmed" ]]; then
		first="$trimmed"
		break
	fi
done <<<"$body"

[[ "$first" == "/preview" ]]
