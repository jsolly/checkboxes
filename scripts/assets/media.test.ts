// biome-ignore-all lint/suspicious/useAwait: Fake asynchronous transports implement the production interface.
import assert from "node:assert/strict";
import {
	mkdir,
	mkdtemp,
	readFile,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "vitest";
import {
	type AssetManifest,
	type AssetTransport,
	assertCoverage,
	assertUploadTarget,
	assetUrl,
	CACHE_CONTROL,
	createManifest,
	digest,
	type ObjectResponse,
	objectKey,
	parseManifest,
	publishedReferences,
	TransientError,
	uploadAssets,
	verifyAssets,
} from "./media.js";
import { documentReferences } from "./references.js";

const bytes = new TextEncoder().encode("public-image-fixture");
const path = "/og-image.jpg";
const sha256 = digest(bytes);
const asset = {
	path,
	sha256,
	bytes: bytes.length,
	key: objectKey(path, sha256),
	contentType: "image/jpeg",
} as const;
const manifest: AssetManifest = { version: 1, assets: [asset] };
const object = (): ObjectResponse => ({
	bytes,
	contentType: asset.contentType,
	cacheControl: CACHE_CONTROL,
});
function fake(
	initial?: ObjectResponse,
): AssetTransport & { writes: number; value: ObjectResponse | undefined } {
	const state = {
		writes: 0,
		value: initial,
		get: async () => state.value,
		put: async () => {
			state.writes++;
			state.value = object();
		},
	};
	return state;
}
it("manifest contracts reject unknown paths, duplicate rows, altered keys and content types", () => {
	assert.deepEqual(parseManifest(manifest), manifest);
	assert.equal(
		assetUrl("https://d123.cloudfront.net", asset),
		`https://d123.cloudfront.net/${asset.key}`,
	);
	for (const change of [
		{ key: "wrong" },
		{ path: "/private.jpg" },
		{ contentType: "text/html" },
		{ bytes: 0 },
	])
		assert.throws(() =>
			parseManifest({ version: 1, assets: [{ ...asset, ...change }] }),
		);
	assert.throws(() => parseManifest({ version: 1, assets: [asset, asset] }));
	assert.throws(() => assetUrl("https://example.com", asset));
});
it("publication reference checks include actual media tags and exclude foreign links and code samples", () => {
	const text =
		'<link rel="icon" href="/favicon.svg"><link href="/favicon.ico"><meta property="og:image" content="https://www.checkboxes.xyz/og-image.jpg"><img src="https://elsewhere.example/og-image.jpg"><pre>&lt;img src="/og-image.jpg"&gt;</pre>';
	assert.deepEqual([...documentReferences(text, "html")].sort(), [
		"/favicon.ico",
		"/favicon.svg",
		"/og-image.jpg",
	]);
	assert.throws(
		() => assertCoverage(manifest, new Set([path, "/favicon.ico"])),
		/missing/u,
	);
	assert.throws(
		() => assertCoverage(manifest, new Set()),
		/no longer published/u,
	);
});
it("inventory pins source bytes and refuses missing or symlinked media", async () => {
	const root = await mkdtemp(join(tmpdir(), "checkboxes-assets-"));
	try {
		await mkdir(join(root, "public"));
		await mkdir(join(root, "dist"));
		await writeFile(join(root, "public/og-image.jpg"), bytes);
		await writeFile(join(root, "dist/index.html"), `<meta content="${path}">`);
		const refs = await publishedReferences(join(root, "dist"));
		assert.deepEqual(await createManifest(root, refs), manifest);
		await rm(join(root, "public/og-image.jpg"));
		await assert.rejects(createManifest(root, refs));
		await writeFile(join(root, "original.jpg"), bytes);
		await symlink(
			join(root, "original.jpg"),
			join(root, "public/og-image.jpg"),
		);
		await assert.rejects(createManifest(root, refs), /Symlink/u);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
it("uploads verify all bytes first, resume idempotently and refuse corrupt existing objects", async () => {
	const transport = fake();
	await assert.rejects(
		uploadAssets(manifest, async () => new Uint8Array([1]), transport),
		/Local bytes mismatch/u,
	);
	assert.equal(transport.writes, 0);
	await uploadAssets(manifest, async () => bytes, transport);
	await uploadAssets(manifest, async () => bytes, transport);
	assert.equal(transport.writes, 1);
	transport.value = { ...object(), bytes: new Uint8Array(bytes.length) };
	await assert.rejects(
		uploadAssets(manifest, async () => bytes, transport),
		/bytes mismatch/u,
	);
	assert.equal(transport.writes, 1);
});
it("missing objects, wrong headers and hash mismatches fail complete verification", async () => {
	await assert.rejects(verifyAssets(manifest, fake()), /Missing object/u);
	await Promise.all(
		[
			{ bytes: new Uint8Array(bytes.length) },
			{ contentType: "text/html" },
			{ cacheControl: "public, max-age=3600" },
		].map((change) =>
			assert.rejects(
				verifyAssets(manifest, fake({ ...object(), ...change })),
				/mismatch/u,
			),
		),
	);
});
it("negative caching and transient failures retry within bounds without rewriting", async () => {
	let reads = 0;
	let writes = 0;
	await uploadAssets(manifest, async () => bytes, {
		get: async () => (++reads < 3 ? undefined : object()),
		put: async () => {
			writes++;
		},
	});
	assert.equal(reads, 3);
	assert.equal(writes, 1);
	let tries = 0;
	await assert.rejects(
		verifyAssets(manifest, {
			get: async () => {
				tries++;
				throw new TransientError("offline");
			},
			put: async () => {
				/*unused*/
			},
		}),
		/offline/u,
	);
	assert.equal(tries, 3);
	tries = 0;
	await assert.rejects(
		verifyAssets(manifest, {
			get: async () => {
				tries++;
				throw new Error("denied");
			},
			put: async () => {
				/*unused*/
			},
		}),
		/denied/u,
	);
	assert.equal(tries, 1);
});
it("presigned destinations must match the reviewed bucket and exact manifest key", () => {
	const signed = `https://reviewed-bucket.s3.us-east-1.amazonaws.com/${asset.key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=fake`;
	assertUploadTarget(manifest, "reviewed-bucket", asset.key, signed);
	assert.throws(() =>
		assertUploadTarget(manifest, "other-bucket", asset.key, signed),
	);
	assert.throws(() =>
		assertUploadTarget(manifest, "reviewed-bucket", "other-key", signed),
	);
	assert.throws(
		() =>
			assertUploadTarget(
				manifest,
				"reviewed-bucket",
				asset.key,
				"malformed signed credential",
			),
		(error: unknown) =>
			error instanceof Error &&
			error.message === "Invalid asset URL (value redacted)" &&
			!("input" in error),
	);
});
it("the committed manifest preserves all current public source bytes without touching imported SVG authoring sources", async () => {
	const committed = parseManifest(
		JSON.parse(
			await readFile(
				new URL(
					"../../config/aws/static-assets/manifest.json",
					import.meta.url,
				),
				"utf8",
			),
		),
	);
	assert.deepEqual(
		committed.assets.map((item) => item.path),
		["/favicon.ico", "/favicon.svg", "/og-image.jpg"],
	);
	assert.deepEqual(
		await createManifest(
			process.cwd(),
			new Set(committed.assets.map((item) => item.path)),
		),
		committed,
	);
});

it("the real CLI runs through its own tsx loader and fails closed for altered source or unclassified public media", async () => {
	const { execFileSync } = await import("node:child_process");
	const { fileURLToPath } = await import("node:url");
	const root = await mkdtemp(join(tmpdir(), "checkboxes-assets-cli-"));
	try {
		await mkdir(join(root, "public"));
		await mkdir(join(root, "dist"));
		await mkdir(join(root, "config/aws/static-assets"), { recursive: true });
		await writeFile(join(root, "public/og-image.jpg"), bytes);
		await writeFile(join(root, "dist/index.html"), `<meta content="${path}">`);
		const loader = fileURLToPath(
			new URL("../../node_modules/tsx/dist/loader.mjs", import.meta.url),
		);
		const cli = fileURLToPath(new URL("./cli.ts", import.meta.url));
		await writeFile(
			join(root, "config/aws/static-assets/manifest.json"),
			JSON.stringify(manifest),
		);
		const invalidAuthorization = join(root, "invalid-authorization.json");
		await writeFile(
			invalidAuthorization,
			'{"signed": private-marker-for-redaction}',
		);
		assert.throws(
			() =>
				execFileSync(
					process.execPath,
					[
						"--import",
						loader,
						cli,
						"upload",
						"https://d123.cloudfront.net",
						"reviewed-bucket",
						invalidAuthorization,
					],
					{ cwd: root, encoding: "utf8", stdio: "pipe" },
				),
			(error: unknown) =>
				error instanceof Error &&
				error.message.includes("contents redacted") &&
				!error.message.includes("private-marker-for-redaction"),
		);
		const run = (command: string) =>
			execFileSync(process.execPath, ["--import", loader, cli, command], {
				cwd: root,
				encoding: "utf8",
				stdio: "pipe",
			});
		assert.match(run("inventory"), /Inventoried 1/u);
		assert.match(run("check"), /Verified 1/u);
		await writeFile(join(root, "public/unpublished.png"), "unreviewed");
		assert.throws(() => run("check"));
		await rm(join(root, "public/unpublished.png"));
		await writeFile(join(root, "public/og-image.jpg"), "altered");
		assert.throws(() => run("check"));
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

it("a symlinked public root cannot expose an external image through the allowlist", async () => {
	const root = await mkdtemp(join(tmpdir(), "checkboxes-public-root-"));
	try {
		await mkdir(join(root, "external"));
		await writeFile(join(root, "external/og-image.jpg"), bytes);
		await symlink(join(root, "external"), join(root, "public"));
		await assert.rejects(createManifest(root, new Set([path])), /Symlink/u);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

it("verification receipts attest exactly the loaded manifest and refuse concurrent manifest edits", async () => {
	const { execFileSync } = await import("node:child_process");
	const { fileURLToPath } = await import("node:url");
	const root = await mkdtemp(join(tmpdir(), "checkboxes-proof-"));
	const external = await mkdtemp(join(tmpdir(), "checkboxes-proof-receipts-"));
	try {
		await mkdir(join(root, "config/aws/static-assets"), { recursive: true });
		const source = join(root, "config/aws/static-assets/manifest.json");
		const manifestText = JSON.stringify(manifest);
		await writeFile(source, manifestText);
		const mock = join(root, "fetch.ts");
		const loader = fileURLToPath(
			new URL("../../node_modules/tsx/dist/loader.mjs", import.meta.url),
		);
		const cli = fileURLToPath(new URL("./cli.ts", import.meta.url));
		const fakeFetch = `globalThis.fetch = async () => new Response(new Uint8Array(${JSON.stringify([...bytes])}),{headers:{'content-type':'image/jpeg','cache-control':${JSON.stringify(CACHE_CONTROL)}}});`;
		await writeFile(mock, fakeFetch);
		const receipt = join(external, "proof.json");
		const run = (target: string) =>
			execFileSync(
				process.execPath,
				[
					"--import",
					loader,
					"--import",
					mock,
					cli,
					"verify",
					"https://d123.cloudfront.net",
					target,
				],
				{ cwd: root, encoding: "utf8", stdio: "pipe" },
			);
		assert.match(run(receipt), /Verified every byte/u);
		const proof: unknown = JSON.parse(await readFile(receipt, "utf8"));
		assert.ok(proof && typeof proof === "object" && "manifestSha256" in proof);
		assert.equal(
			proof.manifestSha256,
			digest(new TextEncoder().encode(manifestText)),
		);
		await writeFile(
			mock,
			`import { appendFile } from 'node:fs/promises'; ${fakeFetch.replace("async () => new Response", 'async () => { await appendFile("config/aws/static-assets/manifest.json", "\\n"); return new Response').replace(/;$/u, "; };")}`,
		);
		const refused = join(external, "refused.json");
		assert.throws(() => run(refused), /Manifest changed during verification/u);
		await assert.rejects(readFile(refused));
	} finally {
		await rm(root, { recursive: true, force: true });
		await rm(external, { recursive: true, force: true });
	}
});
