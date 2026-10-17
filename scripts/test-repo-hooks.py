#!/usr/bin/env python3
"""Exercise this repository's hook trust with real Git and an isolated home."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parent.parent
BUNDLE = ('config/agents/repository.json', 'gate/gate-lib.sh', 'gate/hooks/pre-commit',
          'scripts/repo-hooks.py', 'scripts/repo-python.sh', 'scripts/setup-agent-environment.sh')


class HookTrust(unittest.TestCase):
    def setUp(self):
        scratch = tempfile.TemporaryDirectory()
        self.addCleanup(scratch.cleanup)
        self.scratch = Path(scratch.name).resolve()
        self.root = self.scratch / 'repo'
        self.home = self.scratch / 'home'
        self.root.mkdir()
        self.home.mkdir()
        config = self.home / 'fixture.gitconfig'
        config.write_text('[maintenance]\n    auto = false\n')
        self.env = {k: v for k, v in os.environ.items() if not k.startswith(('GIT_', 'PYTHON'))}
        self.env.update(HOME=str(self.home), GIT_CONFIG_GLOBAL=str(config), GIT_CONFIG_NOSYSTEM='1',
                        GIT_AUTHOR_NAME='fixture', GIT_AUTHOR_EMAIL='fixture@example.invalid',
                        GIT_COMMITTER_NAME='fixture', GIT_COMMITTER_EMAIL='fixture@example.invalid')
        self.git('init', '-q', '-b', 'main')
        for name in BUNDLE:
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(SOURCE / name, target)
        slug = json.loads((self.root / 'config/agents/repository.json').read_text())['repo']
        self.git('remote', 'add', 'origin', 'https://github.com/' + slug + '.git')
        (self.root / '.git-hooks').mkdir()
        floor = (SOURCE / '.git-hooks/pre-commit').read_text().splitlines()[1]
        hook = self.root / '.git-hooks/pre-commit'
        hook.write_text('#!/usr/bin/env bash\n' + floor + '''
set -euo pipefail
owner="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
source "$owner/gate/gate-lib.sh"
gate_enter_committing_tree "${BASH_SOURCE[0]}"
printf 'fixture-root=%s\\n' "$ROOT"
gate_gitleaks_bin() { printf '%s\\n' "$ROOT/tools/fixture-gitleaks"; }
gate_secrets_scan_staged
''')
        hook.chmod(0o755)
        tools = self.root / 'tools'
        tools.mkdir()
        scanner = tools / 'fixture-gitleaks'
        scanner.write_text('''#!/usr/bin/env bash
if git diff --cached --text | grep -q REPO_FIXTURE_SECRET; then
  echo fixture-secret-found >&2
  exit 1
fi
''')
        scanner.chmod(0o755)
        (self.root / 'content.txt').write_text('safe baseline\n')
        self.git('add', '-A')
        self.git('commit', '-qm', 'fixture baseline')
        self.git('update-ref', 'refs/remotes/origin/main', 'HEAD')
        self.tool('install', check=True)
        self.hooks = Path(self.git('config', '--get', 'core.hooksPath').stdout.strip())
        self.installed = self.hooks.parent / 'scripts/repo-hooks.py'

    def git(self, *args, root=None, check=True):
        return subprocess.run(['git', '-C', str(root or self.root), *args], env=self.env,
                              text=True, capture_output=True, check=check)

    def tool(self, command, *args, installed=False, check=False):
        path = self.installed if installed else self.root / 'scripts/repo-hooks.py'
        return subprocess.run([sys.executable, '-I', str(path), command, '--root', str(self.root), *args],
                              cwd=self.root, env=self.env, text=True, capture_output=True, check=check)

    def dispatch(self, root=None):
        return subprocess.run([str(self.hooks / 'pre-commit')], cwd=root or self.root,
                              env=self.env, text=True, capture_output=True)

    def test_fresh_home_and_linked_worktree_run_the_committing_tree(self):
        self.assertFalse((self.home / 'code/dotagents').exists())
        result = self.dispatch()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('fixture-root=' + str(self.root), result.stdout)
        linked = self.scratch / 'linked'
        self.git('worktree', 'add', '-qb', 'linked', str(linked))
        result = self.dispatch(linked)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('fixture-root=' + str(linked), result.stdout)

    def test_unreviewed_library_is_not_executed_or_installed(self):
        lib = self.root / 'gate/gate-lib.sh'
        marker = self.scratch / 'untrusted-executed'
        lib.write_text('touch "' + str(marker) + '"\n' + lib.read_text())
        before = self.git('config', '--get', 'core.hooksPath').stdout
        self.assertNotEqual(self.dispatch().returncode, 0)
        self.assertNotEqual(self.tool('install', installed=True).returncode, 0)
        self.assertFalse(marker.exists())
        self.assertEqual(before, self.git('config', '--get', 'core.hooksPath').stdout)

    def test_exact_bundle_approval_can_be_revoked(self):
        hook = self.root / '.git-hooks/pre-commit'
        hook.write_text(hook.read_text() + '\necho reviewed-change\n')
        digest = self.tool('digest', installed=True, check=True).stdout.strip()
        self.tool('approve', '--digest', digest, installed=True, check=True)
        self.assertEqual(self.dispatch().returncode, 0)
        self.git('config', '--local', '--unset-all', 'repo.trustedGateBundle')
        self.assertNotEqual(self.dispatch().returncode, 0)

    def test_origin_and_symlink_changes_refuse_valid_bundle(self):
        self.assertEqual(self.dispatch().returncode, 0)
        self.git('remote', 'set-url', 'origin', 'https://github.com/foreign/fixture.git')
        self.assertNotEqual(self.dispatch().returncode, 0)
        slug = json.loads((self.root / 'config/agents/repository.json').read_text())['repo']
        self.git('remote', 'set-url', 'origin', 'https://github.com/' + slug + '.git')
        self.assertEqual(self.dispatch().returncode, 0)
        hook = self.root / '.git-hooks/pre-commit'
        outside = self.scratch / 'outside-hook'
        outside.write_bytes(hook.read_bytes())
        outside.chmod(0o755)
        hook.unlink()
        hook.symlink_to(outside)
        self.assertNotEqual(self.dispatch().returncode, 0)

    def test_actual_commits_scan_both_temporary_index_forms(self):
        for options in [('-a',), ('--', 'content.txt')]:
            with self.subTest(options=options):
                (self.root / 'content.txt').write_text('REPO_FIXTURE_SECRET\n')
                result = self.git('commit', '-m', 'must refuse', *options, check=False)
                self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertIn('fixture-secret-found', result.stderr)
                (self.root / 'content.txt').write_text('safe updated ' + str(options) + '\n')
                result = self.git('commit', '-m', 'safe commit', *options, check=False)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


    def legacy_upgrade_fixture(self):
        """Install the frozen real pre-migration helper, then prepare a new candidate."""
        candidate = (self.root / 'scripts/repo-hooks.py').read_bytes()
        marker = self.root / 'config/agents/repository.json'
        legacy = self.root / '.repo-independent.json'
        marker.rename(legacy)
        (self.root / 'scripts/repo-hooks.py').write_bytes((SOURCE / 'scripts/fixtures/repo-hooks-legacy.py').read_bytes())
        self.git('add', '-A')
        self.git('-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'reviewed old format')
        self.git('update-ref', 'refs/remotes/origin/main', 'HEAD')
        self.tool('install', check=True)
        self.hooks = Path(self.git('config', '--get', 'core.hooksPath').stdout.strip())
        self.installed = self.hooks.parent / 'scripts/repo-hooks.py'
        legacy.rename(marker)
        (self.root / 'scripts/repo-hooks.py').write_bytes(candidate)
        return self.tool('digest', check=True).stdout.strip()

    def test_actual_legacy_installation_upgrades_by_exact_reviewed_approval(self):
        digest = self.legacy_upgrade_fixture()
        self.assertNotEqual(self.tool('approve', '--digest', digest).returncode, 0)
        self.assertNotEqual(self.tool('install').returncode, 0)
        self.assertNotEqual(self.tool('approve-upgrade', '--digest', '0' * 64).returncode, 0)
        self.tool('approve-upgrade', '--digest', digest, check=True)
        self.tool('approve-upgrade', '--digest', digest, check=True)
        values = self.git('config', '--get-all', 'repo.trustedGateBundle').stdout.splitlines()
        self.assertEqual(values.count(digest), 1)
        self.tool('install', check=True)
        self.tool('verify', check=True)
        self.tool('approve-upgrade', '--digest', digest, check=True)
        self.hooks = Path(self.git('config', '--get', 'core.hooksPath').stdout.strip())
        self.assertEqual(self.dispatch().returncode, 0)

    def test_upgrade_reauthorizes_old_snapshot_and_preserves_failed_approval(self):
        digest = self.legacy_upgrade_fixture()
        self.git('update-ref', '-d', 'refs/remotes/origin/main')
        result = self.tool('approve-upgrade', '--digest', digest)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Legacy installed bundle is not', result.stderr)
        self.assertNotEqual(self.git('config', '--get-all', 'repo.trustedGateBundle', check=False).returncode, 0)
        old_digest = self.hooks.parent.name
        self.git('config', '--local', '--add', 'repo.trustedGateBundle', old_digest)
        self.tool('approve-upgrade', '--digest', digest, check=True)
        self.tool('install', check=True)

    def test_upgrade_refuses_snapshot_metadata_dispatcher_and_bundle_tamper(self):
        digest = self.legacy_upgrade_fixture()
        version = self.hooks.parent
        for rel in ('installation.json', 'hooks/pre-commit', 'gate/gate-lib.sh'):
            with self.subTest(path=rel):
                path = version / rel
                original = path.read_bytes()
                path.write_bytes(original + b'\n# tamper\n')
                self.assertNotEqual(self.tool('approve-upgrade', '--digest', digest).returncode, 0)
                path.write_bytes(original)
        self.git('remote', 'set-url', 'origin', 'https://github.com/other/fixture.git')
        self.assertNotEqual(self.tool('approve-upgrade', '--digest', digest).returncode, 0)

    def test_legacy_upgrade_refuses_unsafe_modes_without_changing_trust(self):
        digest = self.legacy_upgrade_fixture()
        version = self.hooks.parent
        self.git('config', '--local', '--add', 'repo.trustedGateBundle', version.name)
        config = self.root / '.git/config'
        before_config = config.read_bytes()
        before_approvals = self.git('config', '--get-all', 'repo.trustedGateBundle').stdout
        before_hooks = self.git('config', '--get', 'core.hooksPath').stdout
        cases = (('.repo-independent.json', 0o755),
                 ('installation.json', 0o666),
                 ('hooks/pre-commit', 0o744))
        for rel, unsafe_mode in cases:
            with self.subTest(path=rel, mode=oct(unsafe_mode)):
                path = version / rel
                original_mode = stat.S_IMODE(path.stat().st_mode)
                original_bytes = path.read_bytes()
                try:
                    path.chmod(unsafe_mode)
                    result = self.tool('approve-upgrade', '--digest', digest)
                    self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
                    self.assertEqual(config.read_bytes(), before_config)
                    self.assertEqual(self.git('config', '--get-all', 'repo.trustedGateBundle').stdout,
                                     before_approvals)
                    self.assertEqual(self.git('config', '--get', 'core.hooksPath').stdout, before_hooks)
                    self.assertEqual(path.read_bytes(), original_bytes)
                finally:
                    path.chmod(original_mode)
        # Each independent mode mutation is restored; the valid snapshot still upgrades.
        self.tool('approve-upgrade', '--digest', digest, check=True)
        self.tool('install', check=True)
        self.tool('verify', check=True)

    def test_existing_destination_with_extra_hook_is_refused_before_reconfiguration(self):
        digest = self.legacy_upgrade_fixture()
        self.tool('approve-upgrade', '--digest', digest, check=True)
        before = self.git('config', '--get', 'core.hooksPath').stdout
        spec = importlib.util.spec_from_file_location('candidate_hooks', self.root / 'scripts/repo-hooks.py')
        candidate = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(candidate)
        _, common, slug = candidate.context(self.root)
        actual_digest, payload = candidate.bundle(self.root, slug)
        self.assertEqual(actual_digest, digest)
        destination = candidate.snapshot(common / 'repo-hooks/versions', digest, payload, slug)
        extra = destination / 'hooks/post-checkout'
        extra.write_text('#!/bin/sh\ntouch "' + str(self.root / 'unreviewed-hook-ran') + '"\n')
        extra.chmod(0o755)
        result = self.tool('install')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Unexpected hook', result.stderr)
        self.assertEqual(self.git('config', '--get', 'core.hooksPath').stdout, before)
        self.git('checkout', '-q', '--detach', 'HEAD')
        self.assertFalse((self.root / 'unreviewed-hook-ran').exists())

    def test_current_layout_refuses_old_missing_and_symlinked_manifest_owners(self):
        marker = self.root / 'config/agents/repository.json'
        original = marker.read_bytes()
        marker.unlink()
        result = self.tool('digest')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Missing config/agents/repository.json', result.stderr)
        marker.write_bytes(original)
        retired = self.root / '.repo-independent.json'
        retired.symlink_to('missing')
        self.assertNotEqual(self.tool('digest').returncode, 0)
        retired.unlink()
        marker.unlink(); marker.symlink_to(self.root / 'outside-manifest')
        self.assertNotEqual(self.tool('digest').returncode, 0)

    def test_protected_new_source_installs_over_old_snapshot_without_approval(self):
        self.legacy_upgrade_fixture()
        self.git('add', '-A')
        self.git('-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'reviewed new format')
        self.git('update-ref', 'refs/remotes/origin/main', 'HEAD')
        self.tool('install', check=True)
        self.tool('verify', check=True)
        self.assertNotEqual(self.git('config', '--get-all', 'repo.trustedGateBundle', check=False).returncode, 0)

    def test_install_metadata_is_private_under_each_supported_umask(self):
        hook = self.root / '.git-hooks/pre-commit'
        for mask in (0o000, 0o022, 0o077):
            with self.subTest(umask=oct(mask)):
                hook.write_text(hook.read_text() + '\n# fresh snapshot for umask ' + oct(mask) + '\n')
                digest = self.tool('digest', check=True).stdout.strip()
                self.git('config', '--local', '--add', 'repo.trustedGateBundle', digest)
                for _ in range(2):
                    result = subprocess.run([sys.executable, '-I', str(self.root / 'scripts/repo-hooks.py'),
                                             'install', '--root', str(self.root)], cwd=self.root,
                                            env=self.env, capture_output=True, text=True, umask=mask)
                    self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                    self.tool('verify', check=True)
                configured = subprocess.check_output(['git', '-C', str(self.root), 'config', '--local',
                                                      '--get', 'core.hooksPath'], env=self.env, text=True).strip()
                metadata = Path(configured).parent / 'installation.json'
                self.assertEqual(stat.S_IMODE(metadata.stat().st_mode), 0o600)

    def test_install_rejects_invalid_fresh_snapshot_before_registration(self):
        spec = importlib.util.spec_from_file_location('fixture_current_hooks', self.root / 'scripts/repo-hooks.py')
        current = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(current)
        root, common, slug = current.context(self.root)
        original_snapshot = current.snapshot
        hook = self.root / '.git-hooks/pre-commit'
        for failure in ('unsafe-mode', 'malformed-json'):
            with self.subTest(failure=failure):
                hook.write_text(hook.read_text() + '\n# new snapshot failure ' + failure + '\n')
                digest, payload = current.bundle(root, slug)
                self.git('config', '--local', '--add', 'repo.trustedGateBundle', digest)
                config = common / 'config'
                before = config.read_bytes()

                def corrupt_publication(parent, selected_digest, selected_payload, selected_slug):
                    version = original_snapshot(parent, selected_digest, selected_payload, selected_slug)
                    metadata = version / 'installation.json'
                    if failure == 'unsafe-mode':
                        metadata.chmod(0o666)
                    else:
                        metadata.write_text('{invalid-json')
                    return version

                with patch.object(current, 'snapshot', side_effect=corrupt_publication):
                    with self.assertRaises(ValueError):
                        current.install(root, common, slug, digest, payload)
                self.assertEqual(config.read_bytes(), before)




class PublicMiseBootstrap(unittest.TestCase):
    def setUp(self):
        scratch = tempfile.TemporaryDirectory()
        self.addCleanup(scratch.cleanup)
        self.root = Path(scratch.name).resolve()
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        (self.root / 'scripts').mkdir()
        shutil.copy2(SOURCE / 'scripts/repo-python.sh', self.root / 'scripts/repo-python.sh')
        for name in ('bash', 'chmod', 'cp', 'dirname', 'install', 'mktemp', 'rm'):
            (self.bin / name).symlink_to(shutil.which(name))
        (self.bin / 'python3').symlink_to(sys.executable)
        self.executions = self.root / 'executed'
        self.downloads = self.root / 'downloads'
        self.payload = self.root / 'downloaded-payload'
        self.payload.write_text('#!/usr/bin/env bash\nprintf "verified-run\\n" >> "$BOOTSTRAP_EXECUTIONS"\nprintf "mise fixture\\n"\n')
        self.script(self.bin / 'uname', '#!/usr/bin/env bash\nif [[ "$1" == -s ]]; then echo "${FIXTURE_SYSTEM:-Linux}"; else echo "${FIXTURE_ARCH:-x86_64}"; fi\n')
        self.script(self.bin / 'curl', '''#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$BOOTSTRAP_DOWNLOADS"
[[ "${FIXTURE_DOWNLOAD_FAIL:-0}" != 1 ]] || exit 7
while [[ "$1" != -o ]]; do shift; done
cp "$BOOTSTRAP_PAYLOAD" "$2"
''')
        self.env = {k: v for k, v in os.environ.items() if not k.startswith(('GIT_', 'PYTHON'))}
        self.env.update(HOME=str(self.root), PATH=str(self.bin),
                        BOOTSTRAP_EXECUTIONS=str(self.executions), BOOTSTRAP_DOWNLOADS=str(self.downloads),
                        BOOTSTRAP_PAYLOAD=str(self.payload))

    @staticmethod
    def script(path, text):
        path.write_text(text)
        path.chmod(0o755)

    def provision(self, *, checksum=None, extra=None):
        import hashlib
        text = (SOURCE / 'scripts/setup-agent-environment.sh').read_text()
        start = text.index('install_public_mise() (')
        body = text[start:text.index('\n)\n', start) + 3]
        self.assertEqual(body.count("destination='/usr/local/bin/mise'"), 1)
        body = body.replace("destination='/usr/local/bin/mise'", "destination='" + str(self.bin / 'mise') + "'")
        digest = checksum or hashlib.sha256(self.payload.read_bytes()).hexdigest()
        for pinned in ('e79ae57945034903aee8aa2ea66b4c7ca9cd4f4edd5a8a78a589cbae6d0f428a',
                       'f344c6961190ed2f68e595ed7cb4f03c36c17812bd608886bec799a3082180ff'):
            self.assertEqual(body.count(pinned), 1)
            body = body.replace(pinned, digest)
        command = 'set -euo pipefail\nroot="$1"\n' + body + '\ninstall_public_mise\n'
        return subprocess.run([str(self.bin / 'bash'), '-c', command, 'fixture', str(self.root)],
                              cwd=self.root, env={**self.env, **(extra or {})},
                              text=True, capture_output=True)

    def test_verified_download_installs_once_without_global_config(self):
        result = self.provision()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.bin / 'mise').read_bytes(), self.payload.read_bytes())
        self.assertEqual(stat.S_IMODE((self.bin / 'mise').stat().st_mode), 0o755)
        self.assertTrue(self.executions.exists())
        result = self.provision()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(self.downloads.read_text().splitlines()), 1)
        self.assertFalse((self.root / '.config/mise/config.toml').exists())

    def test_bad_checksum_never_executes_or_installs_download(self):
        result = self.provision(checksum='0' * 64)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('checksum', result.stderr)
        self.assertFalse(self.executions.exists())
        self.assertFalse((self.bin / 'mise').exists())

    def test_failed_download_does_not_install(self):
        result = self.provision(extra={'FIXTURE_DOWNLOAD_FAIL': '1'})
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.executions.exists())
        self.assertFalse((self.bin / 'mise').exists())

    def test_unrunnable_verified_binary_is_not_installed(self):
        self.payload.write_text('#!/usr/bin/env bash\nexit 19\n')
        result = self.provision()
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.bin / 'mise').exists())

    def test_arm64_uses_its_pinned_release_asset(self):
        result = self.provision(extra={'FIXTURE_ARCH': 'aarch64'})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('mise-v2026.9.12-linux-arm64', self.downloads.read_text())

    def test_unsupported_host_refuses_without_downloading(self):
        result = self.provision(extra={'FIXTURE_SYSTEM': 'Darwin'})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Install mise', result.stderr)
        self.assertFalse(self.downloads.exists())
        self.assertFalse((self.bin / 'mise').exists())

    def test_existing_nonexecutable_destination_is_preserved(self):
        destination = self.bin / 'mise'
        destination.write_text('existing useful content\n')
        destination.chmod(0o600)
        result = self.provision()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(destination.read_text(), 'existing useful content\n')
        self.assertFalse(self.downloads.exists())


if __name__ == '__main__':
    unittest.main()
