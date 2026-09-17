import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
	buildBundleMeasurementAudit,
	bytesToKiB,
	measureBuiltJsPayload,
	normalizeJsBytes,
	parseBuiltJsReferences,
	sumInlineJsBytes,
} from "../../src/utils/bundleMeasurement";

describe("A stats generation run measures normalized JS payloads from built artifacts", () => {
	it("counts inline script bytes separately from network transfer", () => {
		const scripts = [
			"console.log('vanilla');",
			"window.frameworkReady = true;",
		] as const;
		const inlineBytes = sumInlineJsBytes([...scripts]);
		assert.equal(
			inlineBytes,
			Buffer.byteLength(scripts[0], "utf8") +
				Buffer.byteLength(scripts[1], "utf8"),
		);
	});

	it("normalizes decoded JavaScript with one fixed gzip compressor", () => {
		const source = "const checked = new Set(['parent', 'child']);";

		assert.equal(normalizeJsBytes(source), 65);
		assert.equal(normalizeJsBytes(""), 0);
	});

	it("discovers first-party chunks, same-origin vendor scripts, and inline scripts from built HTML", () => {
		const references = parseBuiltJsReferences(
			`
				<!doctype html>
				<link rel="modulepreload" href="/_astro/vendor.abc123.js">
				<script type="module" src="/_astro/vendor.abc123.js"></script>
				<link rel="stylesheet" href="/_astro/styles.css">
				<script type="module" src="/_astro/page.def456.js"></script>
				<script type="module" src="/vendor/datastar.js"></script>
				<astro-island component-url="/_astro/Component.ghi789.js" renderer-url="/_astro/client.jkl012.js"></astro-island>
				<script data-cmp="3 > 2" type="application/json">{"not":"js"}</script>
				<script>window.inline = true;</script>
				<script type="application/json">{"not":"js"}</script>
			`,
			"http://localhost:4321",
		);

		assert.deepEqual(
			references.map((reference) => reference.kind),
			[
				"first-party",
				"first-party",
				"first-party",
				"first-party",
				"first-party",
				"inline",
			],
		);
		assert.equal(references[0]?.url, "/_astro/vendor.abc123.js");
		assert.equal(references[1]?.url, "/_astro/page.def456.js");
		assert.equal(references[2]?.url, "/vendor/datastar.js");
		assert.equal(references[3]?.url, "/_astro/Component.ghi789.js");
		assert.equal(references[4]?.url, "/_astro/client.jkl012.js");
		assert.equal(references[5]?.content, "window.inline = true;");
	});

	it("fails loudly when built HTML includes a remote script host", () => {
		const remoteScripts = [
			"https://esm.sh/react@19",
			"https://cdn.jsdelivr.net/npm/example@1/index.js",
			"https://unpkg.com/hyperscript.org@0.9.13",
			"https://cdn.jsdelivr.net/gh/starfederation/datastar@v1.0.1/bundles/datastar.js",
			"//cdn.jsdelivr.net/npm/example@1/index.js",
			"//unpkg.com/hyperscript.org@0.9.13",
		] as const;

		for (const url of remoteScripts) {
			assert.throws(
				() =>
					parseBuiltJsReferences(
						`<script src="${url}"></script>`,
						"http://localhost:4321",
					),
				/Remote JavaScript host is not allowed/,
			);
		}

		assert.throws(
			() =>
				parseBuiltJsReferences(
					`<astro-island component-url="https://esm.sh/react@19"></astro-island>`,
					"http://localhost:4321",
				),
			/Remote JavaScript host is not allowed: esm\.sh/,
		);
	});

	it("follows first-party module imports from built chunks", async () => {
		const dist = await fs.mkdtemp(path.join(os.tmpdir(), "checkboxes-dist-"));
		try {
			await fs.mkdir(path.join(dist, "test", "sample"), { recursive: true });
			await fs.mkdir(path.join(dist, "_astro"), { recursive: true });
			await fs.writeFile(
				path.join(dist, "test", "sample", "index.html"),
				`<script type="module" src="/_astro/entry.js"></script>`,
			);
			await fs.writeFile(
				path.join(dist, "_astro", "entry.js"),
				[
					`import "./child.js";`,
					`import{createApp}from"./runtime.js";`,
					`await import("./lazy.js");`,
					`export{value}from"./barrel.js";`,
					`// import nope from "https://esm.sh/react@19";`,
					`const text = "import nope from 'https://esm.sh/vue@3'";`,
				].join("\n"),
			);
			await fs.writeFile(
				path.join(dist, "_astro", "child.js"),
				`console.log("child");`,
			);
			await fs.writeFile(
				path.join(dist, "_astro", "runtime.js"),
				`console.log("runtime");`,
			);
			await fs.writeFile(
				path.join(dist, "_astro", "lazy.js"),
				`console.log("lazy");`,
			);
			await fs.writeFile(
				path.join(dist, "_astro", "barrel.js"),
				`console.log("barrel");`,
			);

			const measurement = await measureBuiltJsPayload(dist, "/test/sample");

			assert.deepEqual(
				measurement.jsSources.map((source) => source.url),
				[
					"/_astro/entry.js",
					"/_astro/child.js",
					"/_astro/runtime.js",
					"/_astro/lazy.js",
					"/_astro/barrel.js",
				],
			);
		} finally {
			await fs.rm(dist, { recursive: true, force: true });
		}
	});

	it("counts same-origin vendor scripts outside /_astro/ as first-party", async () => {
		const dist = await fs.mkdtemp(path.join(os.tmpdir(), "checkboxes-dist-"));
		try {
			await fs.mkdir(path.join(dist, "test", "sample"), { recursive: true });
			await fs.mkdir(path.join(dist, "vendor"), { recursive: true });
			await fs.writeFile(
				path.join(dist, "test", "sample", "index.html"),
				`<script type="module" src="/vendor/datastar.js"></script>`,
			);
			await fs.writeFile(
				path.join(dist, "vendor", "datastar.js"),
				`console.log("vendored datastar");`,
			);

			const measurement = await measureBuiltJsPayload(dist, "/test/sample");

			assert.deepEqual(
				measurement.jsSources.map((source) => ({
					kind: source.kind,
					url: source.url,
				})),
				[{ kind: "first-party", url: "/vendor/datastar.js" }],
			);
			assert.equal(
				measurement.jsRawBytes,
				Buffer.byteLength(`console.log("vendored datastar");`, "utf8"),
			);
		} finally {
			await fs.rm(dist, { recursive: true, force: true });
		}
	});

	it("fails loudly when first-party chunks import a remote host", async () => {
		const dist = await fs.mkdtemp(path.join(os.tmpdir(), "checkboxes-dist-"));
		try {
			await fs.mkdir(path.join(dist, "test", "sample"), { recursive: true });
			await fs.mkdir(path.join(dist, "_astro"), { recursive: true });
			await fs.writeFile(
				path.join(dist, "test", "sample", "index.html"),
				`<script type="module" src="/_astro/entry.js"></script>`,
			);
			await fs.writeFile(
				path.join(dist, "_astro", "entry.js"),
				`import"https://esm.sh/react@19";`,
			);

			await assert.rejects(
				() => measureBuiltJsPayload(dist, "/test/sample"),
				/Remote JavaScript host is not allowed: esm\.sh/,
			);
		} finally {
			await fs.rm(dist, { recursive: true, force: true });
		}
	});

	it("subtracts baseline normalized payload to produce incremental implementation JS", () => {
		const audit = buildBundleMeasurementAudit(
			{
				measuredRoute: "/test/react",
				inlineJsBytes: 120,
				jsRequestCount: 2,
				jsRawBytes: 7000,
				jsNormalizedBytes: 2400,
				jsSources: [],
			},
			40,
			900,
		);

		assert.equal(audit.baselineInlineJsBytes, 40);
		assert.equal(audit.inlineJsImplementationBytes, 80);
		assert.equal(audit.baselineNormalizedBytes, 900);
		assert.equal(audit.jsImplementationNormalizedBytes, 1500);
		assert.equal(audit.jsImplementationNormalizedKiB, bytesToKiB(1500));
		assert.match(audit.compressionNote, /normalized gzip/i);
	});

	it("keeps inline-only implementations from reporting as zero JavaScript", () => {
		const audit = buildBundleMeasurementAudit(
			{
				measuredRoute: "/test/vanillajs",
				inlineJsBytes: 744,
				jsRequestCount: 1,
				jsRawBytes: 744,
				jsNormalizedBytes: 360,
				jsSources: [],
			},
			84,
			100,
		);

		assert.equal(audit.inlineJsImplementationBytes, 660);
		assert.equal(audit.jsImplementationNormalizedBytes, 260);
		assert.equal(audit.jsImplementationNormalizedKiB, bytesToKiB(260));
	});

	it("clamps inline implementation bytes when inline is below baseline", () => {
		const audit = buildBundleMeasurementAudit(
			{
				measuredRoute: "/test/cssOnly",
				inlineJsBytes: 20,
				jsRequestCount: 0,
				jsRawBytes: 20,
				jsNormalizedBytes: 50,
				jsSources: [],
			},
			84,
			90,
		);

		assert.equal(audit.inlineJsImplementationBytes, 0);
		assert.equal(audit.jsImplementationNormalizedBytes, 0);
	});
});
