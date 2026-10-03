import { spawnSync } from "node:child_process";
import {
	cp,
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	symlink,
} from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
await mkdir(path.join(root, ".astro"), { recursive: true });
const temporary = await mkdtemp(path.join(root, ".astro", "checkboxes-build-"));
const productSource = path.join(temporary, "product/src");
const measurementSource = path.join(temporary, "measurements/src");
const output = path.join(temporary, "dist");

function build(env) {
	const result = spawnSync(
		path.join(root, "node_modules/.bin/astro"),
		["build"],
		{ cwd: root, env, stdio: "inherit" },
	);
	if (result.error) throw result.error;
	if (result.status !== 0)
		throw new Error(`Astro build failed (${result.status ?? result.signal})`);
}

async function copyAssets(directory, destination) {
	await mkdir(destination, { recursive: true });
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const from = path.join(directory, entry.name);
		const to = path.join(destination, entry.name);
		if (entry.isDirectory()) {
			await copyAssets(from, to);
		} else {
			let existing;
			try {
				existing = await readFile(to);
			} catch (error) {
				if (error.code !== "ENOENT") throw error;
			}
			const contents = await readFile(from);
			if (existing && !contents.equals(existing))
				throw new Error(`Conflicting build asset: ${entry.name}`);
			await cp(from, to);
		}
	}
}

async function createSource(source, measurement) {
	await mkdir(path.join(source, "pages"), { recursive: true });
	await symlink(
		path.join(root, "node_modules"),
		path.join(source, "..", "node_modules"),
	);
	await cp(
		path.join(root, "METHODOLOGY.md"),
		path.join(source, "..", "METHODOLOGY.md"),
	);
	const entries = await readdir(path.join(root, "src"));
	await Promise.all(
		entries
			.filter((entry) => entry !== "pages")
			.map((entry) =>
				cp(path.join(root, "src", entry), path.join(source, entry), {
					recursive: true,
				}),
			),
	);
	const pages = await readdir(path.join(root, "src/pages"));
	await Promise.all(
		pages
			.filter((entry) => (measurement ? entry === "test" : entry !== "test"))
			.map((entry) =>
				cp(
					path.join(root, "src/pages", entry),
					path.join(source, "pages", entry),
					{ recursive: true },
				),
			),
	);
}

try {
	await createSource(productSource, false);
	build({ ...process.env, CHECKBOXES_BUILD_SOURCE: productSource });
	await createSource(measurementSource, true);
	// The second entry graph contains measurement routes only, using the same sources.
	build({
		...process.env,
		CHECKBOXES_BUILD_SOURCE: measurementSource,
		CHECKBOXES_MEASUREMENT_OUTPUT: output,
		CHECKBOXES_MEASUREMENT_BUILD: "true",
	});
	// Compose into both the local preview output and Vercel's production static output.
	for (const destination of [
		path.join(root, "dist"),
		path.join(root, ".vercel/output/static"),
	]) {
		await copyAssets(
			path.join(output, "_measurements"),
			path.join(destination, "_measurements"),
		);
		await cp(path.join(output, "test"), path.join(destination, "test"), {
			recursive: true,
		});
	}
} finally {
	await rm(temporary, { recursive: true, force: true });
}
