#!/usr/bin/env python3
"""Exercise this repository's hook trust with real Git and an isolated home."""
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parent.parent
BUNDLE = ('.repo-independent.json', 'gate/gate-lib.sh', 'gate/hooks/pre-commit',
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
        slug = json.loads((self.root / '.repo-independent.json').read_text())['repo']
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
        slug = json.loads((self.root / '.repo-independent.json').read_text())['repo']
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
