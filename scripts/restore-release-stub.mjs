#!/usr/bin/env node
/** Restore src/release-id.ts stub after build. */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
writeFileSync(
	resolve(repoRoot, "src/release-id.ts"),
	'// Stub — overwritten at build time by scripts/gen-release-id.mjs. Do not commit the generated version.\nexport const RELEASE_ID = "dev";\n',
);
process.stdout.write("release-id stub restored\n");
