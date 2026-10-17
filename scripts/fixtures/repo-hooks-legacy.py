#!/usr/bin/env python3
"""Repository-owned hook trust, installation and dispatch. Python 3.11+, stdlib only."""
from __future__ import annotations

import argparse
import contextlib
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile
from urllib.parse import urlsplit

FILES = {
    '.git-hooks/pre-commit': 0o755,
    'gate/gate-lib.sh': 0o644,
    'gate/hooks/pre-commit': 0o755,
    'scripts/repo-hooks.py': 0o755,
    'scripts/repo-python.sh': 0o755,
    'scripts/setup-agent-environment.sh': 0o755,
}
MANIFEST = '.repo-independent.json'
CONTEXT = {'GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR',
           'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES',
           'GIT_CEILING_DIRECTORIES', 'GIT_NAMESPACE'}


def git(root: Path, *args: str, binary: bool = False) -> str | bytes:
    # Trust reads never use injected Git config, replacement objects or another tree.
    env = {k: v for k, v in os.environ.items() if not k.startswith('GIT_')}
    env['GIT_NO_REPLACE_OBJECTS'] = '1'
    p = subprocess.run(['git', '--no-replace-objects', '-C', str(root), *args],
                       env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode:
        raise ValueError('Git trust read failed: ' + ' '.join(args[:2]))
    return p.stdout if binary else p.stdout.decode().strip()


def origin(root: Path) -> str:
    url = str(git(root, 'config', '--local', '--no-includes', '--get', 'remote.origin.url'))
    if url.startswith('git@github.com:'):
        slug = url.removeprefix('git@github.com:')
    else:
        parsed = urlsplit(url)
        if parsed.scheme != 'https' or parsed.hostname != 'github.com' or parsed.username or parsed.password:
            raise ValueError('Origin must be credential-free GitHub HTTPS or Git SSH')
        slug = parsed.path.lstrip('/')
    slug = slug.removesuffix('.git').rstrip('/')
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', slug):
        raise ValueError('Invalid origin repository identity')
    return slug.lower()


def context(root: Path) -> tuple[Path, Path, str]:
    root = root.resolve(strict=True)
    top = Path(str(git(root, 'rev-parse', '--show-toplevel'))).resolve(strict=True)
    if top != root:
        raise ValueError('Expected the exact repository root')
    common = Path(str(git(root, 'rev-parse', '--path-format=absolute', '--git-common-dir')))
    if common.is_symlink():
        raise ValueError('Symlinked Git common directory refused')
    return root, common.resolve(strict=True), origin(root)


def regular(root: Path, rel: str, mode: int) -> bytes:
    path = root
    for part in Path(rel).parts:
        path /= part
        if path.is_symlink():
            raise ValueError('Symlink in trusted bundle: ' + rel)
    st = path.stat()
    if not stat.S_ISREG(st.st_mode) or bool(st.st_mode & 0o111) != bool(mode & 0o111) or st.st_mode & (stat.S_ISUID | stat.S_ISGID | stat.S_ISVTX | stat.S_IWOTH):
        raise ValueError('Trusted file missing or has wrong mode: ' + rel)
    return path.read_bytes()


def manifest(data: bytes, slug: str) -> dict:
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError('Duplicate manifest key')
            result[key] = value
        return result
    value = json.loads(data, object_pairs_hook=pairs)
    if value != {'version': 1, 'repo': slug, 'files': FILES}:
        raise ValueError('Unknown manifest, repository identity or file allowlist')
    return value


def bundle(root: Path, slug: str, ref: str | None = None) -> tuple[str, dict[str, bytes]]:
    if ref is None:
        raw = regular(root, MANIFEST, 0o644)
        manifest(raw, slug)
        payload = {rel: regular(root, rel, mode) for rel, mode in FILES.items()}
    else:
        raw = git(root, 'show', f'{ref}:{MANIFEST}', binary=True)
        manifest(raw, slug)
        payload = {}
        for rel, mode in FILES.items():
            tree = str(git(root, 'ls-tree', ref, '--', rel))
            if not tree.startswith(f'{0o100000 | mode:o} blob '):
                raise ValueError('Reviewed bundle file missing or has wrong mode: ' + rel)
            payload[rel] = git(root, 'show', f'{ref}:{rel}', binary=True)
    payload[MANIFEST] = raw
    rows = [{'path': rel, 'mode': FILES.get(rel, 0o644),
             'sha256': hashlib.sha256(data).hexdigest()} for rel, data in sorted(payload.items())]
    digest = hashlib.sha256(json.dumps({'repo': slug, 'files': rows},
                                      sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    return digest, payload


def trusted(root: Path, slug: str, digest: str) -> bool:
    try:
        ref = str(git(root, 'show-ref', '--verify', '--hash', 'refs/remotes/origin/main'))
        if bundle(root, slug, ref)[0] == digest:
            return True
    except (ValueError, FileNotFoundError):
        pass
    try:
        approved = str(git(root, 'config', '--local', '--no-includes', '--get-all', 'repo.trustedGateBundle'))
    except ValueError:
        return False
    return digest in approved.splitlines()


@contextlib.contextmanager
def locked(common: Path):
    fd = os.open(common / 'repo-hooks.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield
    finally:
        os.close(fd)


def directory(path: Path):
    if path.is_symlink():
        raise ValueError('Symlinked hook storage refused')
    path.mkdir(mode=0o700, exist_ok=True)
    if not path.is_dir():
        raise ValueError('Hook storage is not a directory')


def snapshot(parent: Path, digest: str, payload: dict[str, bytes], slug: str) -> Path:
    directory(parent)
    dest = parent / digest
    if dest.exists() or dest.is_symlink():
        if dest.is_symlink() or not dest.is_dir():
            raise ValueError('Unsafe existing snapshot')
        if bundle(dest, slug)[0] != digest:
            raise ValueError('Installed snapshot is corrupt')
        return dest
    staging = Path(tempfile.mkdtemp(prefix='.install-', dir=parent))
    try:
        for rel, data in payload.items():
            target = staging / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open('xb') as stream:
                stream.write(data)
                stream.flush()
                os.fsync(stream.fileno())
            target.chmod(FILES.get(rel, 0o644))
        if bundle(staging, slug)[0] != digest:
            raise ValueError('Snapshot verification failed')
        (staging / 'installation.json').write_text(json.dumps({'repo': slug, 'digest': digest}))
        (staging / 'hooks').mkdir(mode=0o700)
        (staging / 'hooks/pre-commit').write_bytes(payload['gate/hooks/pre-commit'])
        (staging / 'hooks/pre-commit').chmod(0o755)
        # Rename publishes all bytes at once. Old configured versions remain usable.
        staging.rename(dest)
    finally:
        if staging.exists():
            shutil.rmtree(staging)
    return dest


def verify_installed(common: Path, slug: str) -> Path:
    configured = str(git(common, 'config', '--local', '--no-includes', '--get', 'core.hooksPath'))
    hookdir = Path(configured)
    base = common / 'repo-hooks' / 'versions'
    if not hookdir.is_absolute() or hookdir.parent.parent != base or hookdir.name != 'hooks':
        raise ValueError('hooksPath does not select this repository common directory')
    version = hookdir.parent
    if any(p.is_symlink() for p in (common / 'repo-hooks', base, version, hookdir)):
        raise ValueError('Symlinked installed hooks refused')
    info = json.loads((version / 'installation.json').read_bytes())
    if info.get('repo') != slug or info.get('digest') != version.name:
        raise ValueError('Installed hook identity mismatch')
    if bundle(version, slug)[0] != version.name:
        raise ValueError('Installed hook snapshot is corrupt')
    if stat.S_IMODE((hookdir / 'pre-commit').stat().st_mode) != 0o755 or (hookdir / 'pre-commit').read_bytes() != (version / 'gate/hooks/pre-commit').read_bytes():
        raise ValueError('Installed dispatcher differs from its verified snapshot')
    for path in hookdir.iterdir():
        if path.name != 'pre-commit' or path.is_symlink() or not path.is_file():
            raise ValueError('Unexpected hook in installed dispatcher directory')
    return version


def install(root: Path, common: Path, slug: str, digest: str, payload: dict[str, bytes]):
    if not trusted(root, slug, digest):
        raise ValueError('Setup bundle is not reviewed origin/main or an approved exact digest; no installation changed')
    storage = common / 'repo-hooks'
    directory(storage)
    versions = storage / 'versions'
    version = snapshot(versions, digest, payload, slug)
    hooks = version / 'hooks'
    directory(hooks)
    target = hooks / 'pre-commit'
    if not target.exists():
        with target.open('xb') as stream:
            stream.write(payload['gate/hooks/pre-commit'])
        target.chmod(0o755)
    if target.is_symlink() or target.read_bytes() != payload['gate/hooks/pre-commit']:
        raise ValueError('Installed dispatcher mismatch')
    git(root, 'config', '--local', 'core.hooksPath', str(hooks))
    for row in str(git(root, 'worktree', 'list', '--porcelain')).splitlines():
        if not row.startswith('worktree '):
            continue
        wt = Path(row.removeprefix('worktree '))
        try:
            scoped = str(git(wt, 'config', '--show-scope', '--get', 'core.hooksPath'))
        except ValueError:
            continue
        if scoped.startswith('worktree\t'):
            git(wt, 'config', '--worktree', 'core.hooksPath', str(hooks))
    verify_installed(common, slug)
    print('Repository-owned hooks installed: ' + str(hooks))


def dispatch(root: Path, common: Path, slug: str, digest: str, payload: dict[str, bytes]):
    installed = verify_installed(common, slug)
    for rel in ['scripts/repo-hooks.py', 'scripts/repo-python.sh', 'gate/hooks/pre-commit']:
        if (installed / rel).read_bytes() != payload[rel]:
            raise ValueError('Trust implementation changed; run reviewed repository setup before dispatch')
    # Do not let a worktree override select another dispatcher.
    effective = str(git(root, 'config', '--type=path', '--get', 'core.hooksPath'))
    if Path(effective) != installed / 'hooks':
        raise ValueError('Worktree hooksPath override is stale; run reviewed repository setup')
    if not trusted(root, slug, digest):
        raise ValueError('Unreviewed hook/setup/library bundle; review and approve exact digest ' + digest)
    snap = snapshot(common / 'repo-hooks' / 'bundles', digest, payload, slug)
    env = {k: v for k, v in os.environ.items() if k not in CONTEXT}
    # Git supplies a temporary committing index for -a and path-limited commits.
    # Trust reads ignore it, but staged scanning must use that exact index.
    committing_index = os.environ.get('GIT_INDEX_FILE')
    if committing_index:
        index = Path(committing_index)
        if not index.is_absolute():
            index = root / index
        if index.is_symlink():
            raise ValueError('Symlinked committing index refused')
        index = index.resolve(strict=True)
        gitdir = Path(str(git(root, 'rev-parse', '--absolute-git-dir'))).resolve(strict=True)
        if index.parent != gitdir or not (index.name in {'index', 'index.lock'} or re.fullmatch(r'next-index-[0-9]+\.lock', index.name)):
            raise ValueError('Committing index is outside this worktree Git directory')
        env['GIT_INDEX_FILE'] = str(index)
    # Snapshot shim sources snapshot library; quality scripts run in the committing root.
    os.chdir(root)
    os.execve(str(snap / '.git-hooks/pre-commit'), [str(snap / '.git-hooks/pre-commit')], env)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['install', 'dispatch', 'verify', 'digest', 'approve'])
    parser.add_argument('--root', type=Path, default=Path.cwd())
    parser.add_argument('--digest')
    args = parser.parse_args()
    if sys.version_info < (3, 11):
        raise ValueError('Python >= 3.11 is required before installing repository hooks')
    root, common, slug = context(args.root)
    with locked(common):
        digest, payload = bundle(root, slug)
        if args.command == 'digest':
            print(digest)
        elif args.command == 'approve':
            verify_installed(common, slug)
            if args.digest != digest or not re.fullmatch('[0-9a-f]{64}', args.digest or ''):
                raise ValueError('Approval requires the exact reviewed current bundle digest')
            git(root, 'config', '--local', '--add', 'repo.trustedGateBundle', digest)
            print('Approved exact repository bundle: ' + digest)
        elif args.command == 'install':
            install(root, common, slug, digest, payload)
        elif args.command == 'verify':
            installed = verify_installed(common, slug)
            if installed.name != digest:
                raise ValueError('Installed bundle is stale; run reviewed repository setup')
            if not trusted(root, slug, digest):
                raise ValueError('Current source bundle is not trusted')
            print('Repository-owned hooks verified')
        else:
            dispatch(root, common, slug, digest, payload)
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (ValueError, OSError, json.JSONDecodeError) as error:
        print('repo-hooks: ' + str(error), file=sys.stderr)
        raise SystemExit(1)
