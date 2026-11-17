#!/usr/bin/env python3
"""Judge osv-scanner findings against reviewed dependency dispositions.

The scanner runs with an empty config and every advisory enabled. A repository
ignore file cannot hide a finding. Each exception names one advisory, one
package version, its lockfile paths, registry URL, integrity and the callers
that resolve that copy. A newer tarball, path or caller fails closed.
"""
from __future__ import annotations

import argparse
from datetime import date, datetime
import hashlib
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from zoneinfo import ZoneInfo


OSV_VERSION = '2.7.1'
ROOT = Path(__file__).resolve().parent.parent

# Recorded 2026-11-10. deepmerge 4.3.1 has no patched release. The date is the
# last accepted day in America/New_York; the next day blocks the push.
DEPENDENCY_DISPOSITIONS = {
    ('deepmerge', '4.3.1'): {
        'paths': [
            'node_modules/deepmerge',
        ],
        'integrity': 'sha512-3sUqbMEc77XqpdNO7FRyRog+eW3ph+GYCbj+rK+uYyRMuwsVy0rMiVtPn+QJlKFvWP/1PYpapqYn0Me2knFn+A==',
        'resolved': 'https://registry.npmjs.org/deepmerge/-/deepmerge-4.3.1.tgz',
        'consumers': 'f92403060bcbc4ada674a24784624493d4e96d4cbfd14ae917dc69338265e287',
        'advisories': {
            'GHSA-gcqx-w48m-w2h4': '2026-12-10',
        },
        'reason': 'No patched release. @sveltejs/vite-plugin-svelte merges build configuration and still depends on ^4.3.1.',
    },
}


class OSVError(ValueError):
    """The scan could not be judged."""


def dependency_consumers(packages: dict, name: str, version: str) -> str:
    """Fingerprint callers that resolve this exact package, including peers."""
    consumers = []
    for path, metadata in packages.items():
        for kind in ('dependencies', 'optionalDependencies', 'peerDependencies'):
            requested = metadata.get(kind, {}).get(name)
            if requested is None:
                continue
            current = Path(path)
            while True:
                resolved = packages.get(str(current / 'node_modules' / name))
                if resolved is not None:
                    if resolved.get('version') == version:
                        consumers.append([
                            path, metadata.get('version'), metadata.get('integrity'), kind, requested,
                        ])
                    break
                if current == Path('.'):
                    break
                current = current.parent
    return hashlib.sha256(json.dumps(sorted(consumers), separators=(',', ':')).encode()).hexdigest()


def disposition(packages: dict, name: str, version: str, advisory: str, today: date) -> bool:
    policy = DEPENDENCY_DISPOSITIONS.get((name, version))
    if policy is None or advisory not in policy['advisories']:
        return False
    expires = policy['advisories'][advisory]
    if not expires or today > date.fromisoformat(expires):
        return False
    # OSV deduplicates npm aliases into the same package/version finding.
    # A new alias must not inherit an existing location/caller approval.
    for metadata in packages.values():
        for kind in ('dependencies', 'optionalDependencies', 'peerDependencies'):
            for requested in metadata.get(kind, {}).values():
                if isinstance(requested, str) and (
                    requested == f'npm:{name}' or requested.startswith(f'npm:{name}@')
                ):
                    return False
    paths = {
        path for path, metadata in packages.items()
        if metadata.get('version') == version
        and (
            path.endswith('/node_modules/' + name)
            or path == 'node_modules/' + name
            or metadata.get('name') == name
            or metadata.get('resolved') == policy['resolved']
        )
    }
    if paths != set(policy['paths']):
        return False
    for path in paths:
        metadata = packages[path]
        if metadata.get('integrity') != policy['integrity'] or metadata.get('resolved') != policy['resolved']:
            return False
    return dependency_consumers(packages, name, version) == policy['consumers']


def judge(report: dict, packages: dict, lock: Path, today: date) -> tuple[int, int]:
    """Keep raw findings visible. Allow only reviewed exact identities."""
    findings = blocked = 0
    if not isinstance(report, dict) or not isinstance(report.get('results'), list):
        raise OSVError('Malformed OSV report')
    for result in report['results']:
        source = result.get('source') or {}
        if source.get('type') != 'lockfile' or Path(source.get('path', '')).resolve() != lock.resolve():
            raise OSVError('Unexpected OSV source')
        for entry in result.get('packages') or []:
            package = entry.get('package') or {}
            if entry.get('groups') and not entry.get('vulnerabilities'):
                raise OSVError('OSV findings missing advisory details')
            for vulnerability in entry.get('vulnerabilities') or []:
                advisory = vulnerability.get('id')
                if not isinstance(advisory, str) or not advisory:
                    raise OSVError('Invalid OSV advisory')
                name = package.get('name')
                version = package.get('version')
                allowed = (
                    package.get('ecosystem') == 'npm'
                    and isinstance(name, str)
                    and isinstance(version, str)
                    and disposition(packages, name, version, advisory, today)
                )
                label = 'reviewed disposition' if allowed else 'BLOCKED'
                detail = ''
                policy = DEPENDENCY_DISPOSITIONS.get((name, version))
                if allowed and policy is not None:
                    detail = f" through {policy['advisories'][advisory]} — {policy['reason']}"
                print(
                    f'osv: {label}: {name}@{version} {advisory}{detail}',
                    file=sys.stderr,
                )
                findings += 1
                blocked += not allowed
    return findings, blocked


def scanner_command(scanner: str, root: Path, config: Path) -> list[str]:
    return [
        scanner, 'scan', 'source', '--lockfile', str(root / 'package-lock.json'),
        '--config', str(config), '--all-vulns', '--format', 'json',
    ]


def scan(scanner: str, root: Path, *, today: date | None = None) -> tuple[int, int]:
    today = today or datetime.now(ZoneInfo('America/New_York')).date()
    version = subprocess.check_output([scanner, '--version'], text=True)
    if not re.search(rf'\b{re.escape(OSV_VERSION)}\b', version):
        raise OSVError(f'osv-scanner {OSV_VERSION} is required')
    lock = root / 'package-lock.json'
    packages = json.loads(lock.read_text())['packages']
    with tempfile.TemporaryDirectory(prefix='checkboxes-osv-policy-') as directory:
        config = Path(directory) / 'empty.toml'
        config.write_text('')
        command = scanner_command(scanner, root, config)
        print('osv: ' + ' '.join(command), file=sys.stderr)
        result = subprocess.run(command, cwd=root, stdout=subprocess.PIPE, text=True)
        if result.returncode not in (0, 1):
            if result.stderr:
                print(result.stderr, file=sys.stderr, end='')
            raise OSVError(f'osv-scanner exited {result.returncode}')
        try:
            report = json.loads(result.stdout)
        except json.JSONDecodeError as error:
            raise OSVError('Malformed OSV report') from error
        findings, blocked = judge(report, packages, lock, today)
        if result.returncode == 1 and not findings:
            raise OSVError('OSV failed without advisory findings')
        return findings, blocked


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--scanner', required=True)
    parser.add_argument('--root', type=Path, default=ROOT)
    args = parser.parse_args()
    try:
        findings, blocked = scan(args.scanner, args.root.resolve())
    except OSVError as error:
        print(f'osv: {error}', file=sys.stderr)
        return 1
    if blocked:
        print(f'osv: {blocked} unaccepted finding(s)', file=sys.stderr)
        return 1
    if findings:
        print(f'osv: {findings} reviewed disposition(s)', file=sys.stderr)
    else:
        print('osv: no findings', file=sys.stderr)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
