#!/usr/bin/env node
/**
 * Restore committed stubs after build so generated release ids are never committed.
 * On Vercel, leave vercel.json stamped (headers are read from the build tree);
 * always restore src/release-id.ts so a failed local build cannot leave a dirty module.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

writeFileSync(
	resolve(repoRoot, "src/release-id.ts"),
	'// Stub — overwritten at build time by scripts/gen-release-id.mjs. Do not commit the generated version.\nexport const RELEASE_ID = "dev";\n',
);

// Vercel serves headers from the post-build vercel.json — do not wipe the stamp there.
if (process.env.VERCEL === "1") {
	process.stdout.write(
		"release-id module stub restored (vercel.json left stamped)\n",
	);
	process.exit(0);
}

const vercelPath = resolve(repoRoot, "vercel.json");
const config = JSON.parse(readFileSync(vercelPath, "utf8"));
for (const block of config.headers ?? []) {
	for (const h of block.headers ?? []) {
		if (String(h.key).toLowerCase() === "x-release-id") {
			h.value = "dev";
		}
	}
}
writeFileSync(vercelPath, `${JSON.stringify(config, null, "\t")}\n`);
process.stdout.write("release-id stubs restored\n");
