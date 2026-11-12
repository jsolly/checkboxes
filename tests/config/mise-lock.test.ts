import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import it from "node:test";
import { fileURLToPath } from "node:url";

const lock = readFileSync(
	fileURLToPath(new URL("../../mise.lock", import.meta.url)),
	"utf8",
);

it("mise.lock has no provenance.slsa table", () => {
	const tables = lock
		.split("\n")
		.filter((line) => /^\[.*\.provenance\.slsa\]\s*$/.test(line));
	assert.deepEqual(
		tables,
		[],
		"Delete every provenance.slsa subtable from mise.lock after `mise lock`: newer mise (2026.9.16, 2026.10.14) refuses to install from one whose registry entry names no signer. Checksums and URLs still pin the download.",
	);
});
