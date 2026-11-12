import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import it from "node:test";
import { fileURLToPath } from "node:url";

const lock = readFileSync(
	fileURLToPath(new URL("../../mise.lock", import.meta.url)),
	"utf8",
);

it("mise.lock has no osv-scanner provenance.slsa table", () => {
	const tables = lock
		.split("\n")
		.filter((line) =>
			/^\[tools\.osv-scanner\..*\.provenance\.slsa\]\s*$/.test(line),
		);
	assert.deepEqual(
		tables,
		[],
		"Delete osv-scanner's provenance.slsa subtables from mise.lock after `mise lock`: current mise (2026.9.16, 2026.10.14) refuses to install from them because the Aqua registry entry names no signer. On each osv-scanner version bump, recheck whether the registry now names a signer. Checksums and URLs still pin the download.",
	);
});
