#!/usr/bin/env node
/**
 * Contract: vercel.json wires x-release-id; production-like stamp ≠ "dev".
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vercelPath = resolve(repoRoot, "vercel.json");

function headerValue(config) {
	for (const block of config.headers ?? []) {
		for (const h of block.headers ?? []) {
			if (String(h.key).toLowerCase() === "x-release-id") return h.value;
		}
	}
	return undefined;
}

const committed = JSON.parse(readFileSync(vercelPath, "utf8"));
const committedVal = headerValue(committed);
if (committedVal === undefined) {
	console.error("FAIL: vercel.json missing x-release-id header");
	process.exit(1);
}
if (committedVal !== "dev") {
	console.error(
		`FAIL: committed vercel.json x-release-id must be "dev" (got ${committedVal})`,
	);
	process.exit(1);
}

const sha = "abcdef1234567890deadbeef";
execFileSync(
	process.execPath,
	[resolve(repoRoot, "scripts/gen-release-id.mjs")],
	{
		cwd: repoRoot,
		env: { ...process.env, VERCEL_GIT_COMMIT_SHA: sha },
		stdio: "inherit",
	},
);

const stamped = JSON.parse(readFileSync(vercelPath, "utf8"));
const stampedVal = headerValue(stamped);
const expected = sha.slice(0, 12);
if (stampedVal !== expected) {
	console.error(
		`FAIL: stamped x-release-id expected ${expected}, got ${stampedVal}`,
	);
	process.exit(1);
}
if (stampedVal === "dev") {
	console.error("FAIL: production-like stamp must not be dev");
	process.exit(1);
}

execFileSync(
	process.execPath,
	[resolve(repoRoot, "scripts/restore-release-stub.mjs")],
	{
		cwd: repoRoot,
		env: { ...process.env, VERCEL: "" },
		stdio: "inherit",
	},
);

const restored = JSON.parse(readFileSync(vercelPath, "utf8"));
if (headerValue(restored) !== "dev") {
	console.error("FAIL: restore did not reset x-release-id to dev");
	process.exit(1);
}

// Ensure module stub is back
const mod = readFileSync(resolve(repoRoot, "src/release-id.ts"), "utf8");
if (!mod.includes('RELEASE_ID = "dev"')) {
	console.error("FAIL: release-id.ts stub not restored");
	process.exit(1);
}

console.log("check:release-id ok");
