import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { test as it } from "vitest";

it("pre-push scans outgoing commits for secrets without dependency scanners or probes", () => {
	const detectedBash = spawnSync(
		"bash",
		["-c", "(( BASH_VERSINFO[0] >= 5 )) && printf '%s\\n' \"$BASH\""],
		{ encoding: "utf8" },
	);
	assert.equal(
		detectedBash.status,
		0,
		"The invoking environment must provide Bash >= 5",
	);
	const supportedBash = detectedBash.stdout.trim();
	assert.ok(isAbsolute(supportedBash));
	const scratch = mkdtempSync(join(tmpdir(), "checkboxes-pre-push-"));
	try {
		const root = join(scratch, "checkout");
		const bin = join(scratch, "bin");
		const runs = join(scratch, "runs");
		const shellRuns = join(scratch, "shell-runs");
		const shell = join(bin, "bash");
		for (const directory of [
			bin,
			join(root, "gate"),
			join(root, ".git-hooks"),
		]) {
			mkdirSync(directory, { recursive: true });
		}
		// Model a supported Bash outside the isolated system PATH, as on macOS.
		writeFileSync(
			shell,
			'#!/bin/sh\nprintf \'selected-bash\\n\' >> "$SHELL_RUNS"\nexec "$SUPPORTED_BASH" "$@"\n',
			{ mode: 0o755 },
		);
		for (const relative of ["gate/gate-lib.sh", ".git-hooks/pre-commit"]) {
			copyFileSync(
				new URL(`../${relative}`, import.meta.url),
				join(root, relative),
			);
		}
		const pin = readFileSync(join(root, "gate/gate-lib.sh"), "utf8").match(
			/^GATE_GITLEAKS_VERSION="?([^"\n]+)"?$/mu,
		)?.[1];
		assert.ok(pin);
		writeFileSync(
			join(bin, "gitleaks"),
			`#!/bin/sh
if [ "$1" = version ] || [ "$1" = --version ]; then echo '${pin}'; exit 0; fi
printf '%s\\n' "$*" >> "$RUNS"
exit "\${SECRET_EXIT:-0}"
`,
			{ mode: 0o755 },
		);
		for (const tool of ["curl", "semgrep", "osv-scanner", "mise"]) {
			writeFileSync(
				join(bin, tool),
				"#!/bin/sh\necho unexpected-tool >&2\nexit 99\n",
				{
					mode: 0o755,
				},
			);
		}
		const env = {
			PATH: `${bin}:/usr/bin:/bin`,
			HOME: join(scratch, "home"),
			RUNS: runs,
			SHELL_RUNS: shellRuns,
			SUPPORTED_BASH: supportedBash,
			GIT_CONFIG_GLOBAL: "/dev/null",
			GIT_CONFIG_NOSYSTEM: "1",
			GIT_AUTHOR_NAME: "Fixture",
			GIT_AUTHOR_EMAIL: "fixture@example.invalid",
			GIT_COMMITTER_NAME: "Fixture",
			GIT_COMMITTER_EMAIL: "fixture@example.invalid",
		};
		const git = (...args: string[]): string => {
			const result = spawnSync("git", args, {
				cwd: root,
				env,
				encoding: "utf8",
			});
			assert.equal(result.status, 0, result.stderr);
			return result.stdout.trim();
		};
		git("init", "-q");
		git("add", ".");
		git("commit", "-qm", "base");
		const base = git("rev-parse", "HEAD");
		git("update-ref", "refs/remotes/origin/main", base);
		writeFileSync(join(root, "change.txt"), "change\n");
		git("add", "change.txt");
		git("commit", "-qm", "change");
		const tip = git("rev-parse", "HEAD");
		const zero = "0".repeat(40);
		const push = (input: string, extra: Record<string, string> = {}) =>
			spawnSync(shell, [".git-hooks/pre-commit", "pre-push"], {
				cwd: root,
				env: { ...env, ...extra },
				input,
				encoding: "utf8",
			});
		const ref = (local: string, remote: string): string =>
			`refs/heads/fix ${local} refs/heads/fix ${remote}\n`;
		for (const remote of [base, zero]) {
			rmSync(runs, { force: true });
			rmSync(shellRuns, { force: true });
			const result = push(ref(tip, remote));
			assert.equal(result.status, 0, result.stderr);
			assert.match(result.stdout, /gitleaks/u);
			assert.match(readFileSync(shellRuns, "utf8"), /selected-bash/u);
			const expectedRange = `${remote === zero ? "refs/remotes/origin/main" : remote}..${tip}`;
			assert.ok(readFileSync(runs, "utf8").includes(expectedRange));
		}
		for (const status of ["1", "2"]) {
			assert.notEqual(push(ref(tip, base), { SECRET_EXIT: status }).status, 0);
		}
		rmSync(runs);
		for (const input of ["", ref(zero, base), ref(tip, tip)]) {
			const result = push(input);
			assert.equal(result.status, 0, result.stderr);
		}
		assert.throws(() => readFileSync(runs));
		assert.notEqual(push(ref("not-a-sha", base)).status, 0);
		assert.notEqual(push(ref(tip, "not-a-sha")).status, 0);
		const missing = "a".repeat(40);
		for (const packet of [ref(missing, base), ref(tip, missing)]) {
			const result = push(packet);
			assert.equal(result.status, 128, result.stderr);
			assert.ok(result.stderr.includes(missing));
			assert.throws(() => readFileSync(runs));
		}
		const tree = git("rev-parse", "HEAD^{tree}");
		const other = git("commit-tree", tree, "-p", base, "-m", "other parent");
		const octopus = git(
			"commit-tree",
			tree,
			"-p",
			base,
			"-p",
			tip,
			"-p",
			other,
			"-m",
			"three parents",
		);
		const mergeResult = push(ref(octopus, base));
		assert.equal(mergeResult.status, 1, mergeResult.stderr);
		assert.match(mergeResult.stderr, /three or more parents/u);
		assert.throws(() => readFileSync(runs));
		const malformed = "a".repeat(45);
		git("update-ref", `refs/heads/${malformed}`, tip);
		const malformedResult = push(ref(malformed, base));
		assert.equal(malformedResult.status, 1, malformedResult.stderr);
		assert.match(malformedResult.stderr, /not a commit id/u);
		assert.throws(() => readFileSync(runs));
		// Exercise root history with log.showRoot=false using the actual pinned scanner.
		const scanner = spawnSync("bash", ["-c", "command -v gitleaks"], {
			encoding: "utf8",
		});
		assert.equal(scanner.status, 0, scanner.stderr);
		assert.ok(isAbsolute(scanner.stdout.trim()));
		copyFileSync(scanner.stdout.trim(), join(bin, "gitleaks"));
		const token = [
			"ghp",
			createHash("sha256")
				.update("root history fixture")
				.digest("hex")
				.slice(0, 36),
		].join("_");
		writeFileSync(join(root, "root-secret.txt"), token);
		git("add", "root-secret.txt");
		git("commit", "-qm", "leaking tree");
		const leakingTree = git("rev-parse", "HEAD^{tree}");
		const orphan = git("commit-tree", leakingTree, "-m", "root secret");
		const removed = git(
			"commit-tree",
			git("rev-parse", `${tip}^{tree}`),
			"-p",
			orphan,
			"-m",
			"removed",
		);
		git("config", "log.showRoot", "false");
		const blockedRoot = push(ref(removed, zero));
		assert.notEqual(blockedRoot.status, 0, blockedRoot.stderr);
		assert.match(blockedRoot.stdout + blockedRoot.stderr, /leaks found/u);
		assert.ok(!(blockedRoot.stdout + blockedRoot.stderr).includes(token));
		git("update-ref", "-d", "refs/remotes/origin/main");
		assert.notEqual(push(ref(tip, zero)).status, 0);
	} finally {
		rmSync(scratch, { recursive: true, force: true });
	}
});
