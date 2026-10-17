import assert from "node:assert/strict";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import it from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const require = createRequire(new URL("../../package.json", import.meta.url));
// Follow Astro's actual Vite graph, including its own native compiler bindings.
const astroRequire = createRequire(require.resolve("astro/package.json"));
const viteRequire = createRequire(astroRequire.resolve("vite/package.json"));
const { transformWithOxc } = await import(
	pathToFileURL(viteRequire.resolve("vite")).href
);
const { resolveTsconfig } = await import(
	pathToFileURL(viteRequire.resolve("rolldown/experimental")).href
);
const { TsconfigCache } = await import(
	pathToFileURL(viteRequire.resolve("rolldown/utils")).href
);

it("A build applies compiler policy to source copies and excludes dist output", async () => {
	const parent = realpathSync(
		mkdtempSync(join(tmpdir(), "checkboxes-tsconfig-")),
	);
	const root = join(parent, "project");
	const source =
		'import { unused } from "/src/dependency.ts"; export const marker: number = 17;';
	function put(name: string, body: string | Buffer) {
		const path = join(root, name);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, body);
		return path;
	}
	function owner(path: string): string | null {
		const result: unknown = resolveTsconfig(path, new TsconfigCache());
		if (result === null) return null;
		assert(
			result && typeof result === "object" && "tsconfigFilePaths" in result,
		);
		assert(Array.isArray(result.tsconfigFilePaths));
		const first: unknown = result.tsconfigFilePaths[0];
		assert(typeof first === "string");
		return first;
	}
	async function emitted(path: string): Promise<string> {
		const result: unknown = await transformWithOxc(source, path);
		assert(result && typeof result === "object" && "code" in result);
		assert(typeof result.code === "string");
		return result.code;
	}
	try {
		for (const name of ["tsconfig.json", "config/typescript/tsconfig.json"]) {
			put(name, readFileSync(join(ROOT, name)));
		}
		put("package.json", '{"type":"module"}');
		symlinkSync(join(ROOT, "node_modules"), join(root, "node_modules"), "dir");
		put(
			"src/dependency.ts",
			'export const unused = 17; globalThis[Symbol.for("config-proof")] = true;',
		);
		put(
			"src/nested/tsconfig.json",
			JSON.stringify({
				compilerOptions: { verbatimModuleSyntax: false },
				include: ["owned.ts", "excluded.ts"],
				exclude: ["excluded.ts"],
			}),
		);
		const positive = [
			"src/probe.ts",
			"tests/probe.ts",
			"root-probe.ts",
			"config/typescript/probe.ts",
			".astro/checkboxes-build-proof/product/src/probe.ts",
			".astro/checkboxes-build-proof/measurements/src/probe.ts",
			"src/nested/fallback.ts",
			"src/nested/excluded.ts",
		];
		for (const name of positive) {
			const path = put(name, source);
			assert.equal(owner(path), join(root, "tsconfig.json"), name);
			assert((await emitted(path)).includes("dependency.ts"), name);
		}
		const nested = put("src/nested/owned.ts", source);
		assert.equal(owner(nested), join(root, "src/nested/tsconfig.json"));
		assert(!(await emitted(nested)).includes("dependency.ts"));
		const outside = join(parent, "outside.ts");
		writeFileSync(outside, source);
		for (const path of [put("dist/probe.ts", source), outside]) {
			assert.equal(owner(path), null, path);
			assert(!(await emitted(path)).includes("dependency.ts"), path);
		}
	} finally {
		rmSync(parent, { recursive: true, force: true });
	}
});
