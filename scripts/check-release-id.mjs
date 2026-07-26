#!/usr/bin/env node
/**
 * Contract: Edge Middleware (or Astro middleware) wires x-release-id;
 * production-like module stamp ≠ "dev".
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const edgeMw = resolve(repoRoot, "middleware.ts");
const astroMw = resolve(repoRoot, "src/middleware.ts");
if (existsSync(edgeMw)) {
	const src = readFileSync(edgeMw, "utf8");
	if (!src.includes("x-release-id") || !src.includes("VERCEL_GIT_COMMIT_SHA")) {
		console.error(
			"FAIL: root middleware.ts must set x-release-id from VERCEL_GIT_COMMIT_SHA",
		);
		process.exit(1);
	}
} else if (existsSync(astroMw)) {
	const src = readFileSync(astroMw, "utf8");
	if (!src.includes("x-release-id")) {
		console.error("FAIL: src/middleware.ts must set x-release-id");
		process.exit(1);
	}
} else {
	console.error(
		"FAIL: missing middleware.ts (Edge) or src/middleware.ts (Astro)",
	);
	process.exit(1);
}

const vercelPath = resolve(repoRoot, "vercel.json");
if (existsSync(vercelPath)) {
	const vercel = readFileSync(vercelPath, "utf8");
	if (/x-release-id/i.test(vercel)) {
		console.error(
			"FAIL: do not put x-release-id in vercel.json (committed value sticks; use Edge Middleware)",
		);
		process.exit(1);
	}
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
const stamped = readFileSync(resolve(repoRoot, "src/release-id.ts"), "utf8");
if (!stamped.includes(`RELEASE_ID = "${sha.slice(0, 12)}"`)) {
	console.error("FAIL: module stamp missing expected SHA");
	process.exit(1);
}

execFileSync(
	process.execPath,
	[resolve(repoRoot, "scripts/restore-release-stub.mjs")],
	{
		cwd: repoRoot,
		stdio: "inherit",
	},
);
const restored = readFileSync(resolve(repoRoot, "src/release-id.ts"), "utf8");
if (!restored.includes('RELEASE_ID = "dev"')) {
	console.error("FAIL: release-id.ts stub not restored");
	process.exit(1);
}

console.log("check:release-id ok");
