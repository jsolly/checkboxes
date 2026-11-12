#!/usr/bin/env python3
"""The OSV disposition checker accepts only the reviewed deepmerge identity."""
from __future__ import annotations

import importlib.util
import json
import sys
from datetime import date
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parent.parent
SOURCE = Path(__file__).resolve().parent / 'osv-dispositions.py'


def load():
    # Loading the checker from its path would otherwise write scripts/__pycache__.
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location('osv_dispositions', SOURCE)
    if spec is None or spec.loader is None:
        raise RuntimeError('Cannot load osv-dispositions.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class Dispositions(unittest.TestCase):
    def setUp(self):
        self.mod = load()
        self.lock = ROOT / 'package-lock.json'
        self.packages = json.loads(self.lock.read_text())['packages']
        self.today = date(2026, 11, 10)
        self.expiry = date(2026, 12, 10)

    def allowed(self, packages, advisory='GHSA-gcqx-w48m-w2h4', today=None):
        return self.mod.disposition(
            packages, 'deepmerge', '4.3.1', advisory, today or self.today,
        )

    def test_current_lockfile_matches_the_reviewed_identity(self):
        self.assertTrue(self.allowed(self.packages))
        self.assertTrue(self.allowed(self.packages, today=self.expiry))
        self.assertFalse(self.allowed(self.packages, today=date(2026, 12, 11)))

    def test_each_exception_names_one_advisory_and_a_review_date(self):
        self.assertFalse(self.allowed(self.packages, advisory='GHSA-not-reviewed'))
        for policy in self.mod.DEPENDENCY_DISPOSITIONS.values():
            self.assertTrue(policy['reason'])
            self.assertTrue(policy['paths'])
            for expires in policy['advisories'].values():
                date.fromisoformat(expires)

    def test_a_different_tarball_path_or_caller_is_rejected(self):
        changed = json.loads(json.dumps(self.packages))
        changed['node_modules/deepmerge']['integrity'] += 'x'
        self.assertFalse(self.allowed(changed))

        extra = json.loads(json.dumps(self.packages))
        extra['node_modules/other/node_modules/deepmerge'] = dict(extra['node_modules/deepmerge'])
        self.assertFalse(self.allowed(extra))

        alias = json.loads(json.dumps(self.packages))
        alias['']['dependencies']['deepmerge-alias'] = 'npm:deepmerge@4.3.1'
        self.assertFalse(self.allowed(alias))

        caller = json.loads(json.dumps(self.packages))
        caller['node_modules/@sveltejs/vite-plugin-svelte']['version'] = '9.9.9'
        self.assertFalse(self.allowed(caller))

    def test_report_blocks_an_unreviewed_package(self):
        report = {
            'results': [{
                'source': {'path': str(self.lock), 'type': 'lockfile'},
                'packages': [{
                    'package': {'name': 'left-pad', 'version': '1.0.0', 'ecosystem': 'npm'},
                    'groups': [{'ids': ['GHSA-xxxx']}],
                    'vulnerabilities': [{'id': 'GHSA-xxxx'}],
                }],
            }],
        }
        findings, blocked = self.mod.judge(report, self.packages, self.lock, self.today)
        self.assertEqual((findings, blocked), (1, 1))

    def test_hidden_group_without_advisory_details_fails(self):
        report = {
            'results': [{
                'source': {'path': str(self.lock), 'type': 'lockfile'},
                'packages': [{
                    'package': {'name': 'deepmerge', 'version': '4.3.1', 'ecosystem': 'npm'},
                    'groups': [{'ids': ['GHSA-gcqx-w48m-w2h4']}],
                }],
            }],
        }
        with self.assertRaises(self.mod.OSVError):
            self.mod.judge(report, self.packages, self.lock, self.today)

    def test_scanner_command_ignores_repository_config(self):
        command = self.mod.scanner_command('osv-scanner', ROOT, Path('/tmp/empty.toml'))
        self.assertEqual(command[command.index('--config') + 1], '/tmp/empty.toml')
        self.assertIn('--all-vulns', command)
        script = (ROOT / 'scripts/security-scanners.sh').read_text()
        self.assertIn('scripts/osv-dispositions.py', script)
        self.assertNotIn('osv-scanner.toml', script)


if __name__ == '__main__':
    unittest.main()
