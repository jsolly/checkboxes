import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { test as it } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(
	new URL("../../scripts/worktree-init.sh", import.meta.url),
);

it("worktree setup accepts absent local config and refuses a failed allowlisted copy", (t) => {
	const scratch = mkdtempSync(join(tmpdir(), "checkboxes-worktree-"));
	t.after(() => rmSync(scratch, { recursive: true, force: true }));
	const primary = join(scratch, "primary checkout");
	const worktree = join(scratch, "linked checkout");
	const bin = join(scratch, "bin");
	mkdirSync(primary);
	mkdirSync(bin);
	// The real pre-commit hook exports GIT_INDEX_FILE and other Git state.
	// An isolated fixture must never read or write the caller's index.
	const env = {
		...Object.fromEntries(
			Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
		),
		GIT_CONFIG_NOSYSTEM: "1",
		GIT_CONFIG_GLOBAL: "/dev/null",
	};
	const git = (...args: string[]) => {
		const result = spawnSync("git", args, {
			cwd: primary,
			encoding: "utf8",
			env,
		});
		assert.equal(result.status, 0, result.stderr);
	};
	git("init", "--quiet", "--template=");
	writeFileSync(
		join(primary, ".worktreeinclude"),
		".env.local\n.env.*.local\n",
	);
	git("add", ".worktreeinclude");
	git(
		"-c",
		"user.name=Fixture",
		"-c",
		"user.email=fixture@example.test",
		"commit",
		"--quiet",
		"-m",
		"fixture",
	);
	git("worktree", "add", "--quiet", "--detach", worktree);
	const run = (path: string | undefined) =>
		spawnSync("bash", [script], {
			cwd: worktree,
			encoding: "utf8",
			env: { ...env, PATH: path },
		});

	const absent = run(process.env["PATH"]);
	assert.equal(absent.status, 0, absent.stderr);

	writeFileSync(join(primary, ".env.local"), "FIXTURE=literal\n", {
		mode: 0o600,
	});
	writeFileSync(
		join(bin, "cp"),
		"#!/bin/sh\necho 'fixture: copy denied' >&2\nexit 73\n",
		{ mode: 0o755 },
	);
	const denied = run([bin, process.env["PATH"]].join(delimiter));
	assert.notEqual(denied.status, 0);
	assert.match(denied.stderr, /could not copy \.env\.local/);

	const copied = run(process.env["PATH"]);
	assert.equal(copied.status, 0, copied.stderr);
	assert.equal(
		readFileSync(join(worktree, ".env.local"), "utf8"),
		"FIXTURE=literal\n",
	);
	assert.equal(statSync(join(worktree, ".env.local")).mode & 0o777, 0o600);
});
