#!/usr/bin/env bash
((BASH_VERSINFO[0] >= 5)) || { echo "✗ $0 requires Bash >= 5, not $BASH_VERSION. Fix: brew install bash; open a fresh shell and rerun repository setup." >&2; exit 1; }
set -euo pipefail
# Python is a public prerequisite. Prefer the configured default, then supported
# versioned executables; macOS may resolve python3 to Apple's older system runtime.
for runtime in python3 python3.14 python3.13 python3.12 python3.11; do
  if command -v "$runtime" >/dev/null 2>&1 &&
    "$runtime" -I -c 'import sys; sys.exit(sys.version_info < (3, 11))' >/dev/null 2>&1; then
    exec "$runtime" -I "$@"
  fi
done
echo 'Python >= 3.11 is required; install a supported public Python runtime before repository setup.' >&2
exit 1
