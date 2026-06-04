import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	type TrackedRequest,
	buildBundleMeasurementAudit,
	bytesToKiB,
	dedupeJsRequestsByUrl,
	isJavaScriptMime,
	isJsRequest,
	shouldCountJsRequest,
	sumInlineJsBytes,
	sumJsTransferBytes,
} from "../../src/utils/bundleMeasurement";

function makeRequest(
	overrides: Partial<TrackedRequest> & Pick<TrackedRequest, "url">,
): TrackedRequest {
	return {
		resourceType: "Script",
		mimeType: "application/javascript",
		fromCache: false,
		status: 200,
		encodedDataLength: 0,
		failed: false,
		...overrides,
	};
}

describe("Bundle measurement aggregates completed JS transfer bytes", () => {
	it("uses loadingFinished totals and ignores cache hits and non-JS requests", () => {
		const requests = [
			makeRequest({
				url: "http://localhost:4321/_astro/react.js",
				encodedDataLength: 2048,
			}),
			makeRequest({
				url: "http://localhost:4321/_astro/styles.css",
				resourceType: "Stylesheet",
				mimeType: "text/css",
				encodedDataLength: 512,
			}),
			makeRequest({
				url: "http://localhost:4321/@vite/client",
				encodedDataLength: 280845,
			}),
			makeRequest({
				url: "http://localhost:4321/_astro/cached.js",
				fromCache: true,
				encodedDataLength: 0,
			}),
			makeRequest({
				url: "http://localhost:4321/_astro/failed.js",
				failed: true,
				encodedDataLength: 1024,
			}),
		];

		const jsRequests = dedupeJsRequestsByUrl(requests, "http://localhost:4321");
		assert.equal(jsRequests.length, 1);
		assert.equal(sumJsTransferBytes(jsRequests), 2048);
	});

	it("deduplicates modulepreload and import requests by URL", () => {
		const requests = [
			makeRequest({
				url: "http://localhost:4321/_astro/vendor.js",
				encodedDataLength: 100,
			}),
			makeRequest({
				url: "http://localhost:4321/_astro/vendor.js",
				encodedDataLength: 1500,
			}),
		];

		const jsRequests = dedupeJsRequestsByUrl(requests, "http://localhost:4321");
		assert.equal(jsRequests.length, 1);
		assert.equal(jsRequests[0]?.encodedDataLength, 1500);
	});

	it("accepts JavaScript MIME types when resource type is missing", () => {
		const request = makeRequest({
			url: "http://localhost:4321/_astro/legacy.js",
			resourceType: "Other",
			mimeType: "text/javascript",
			encodedDataLength: 900,
		});

		assert.equal(isJsRequest(request, "http://localhost:4321"), true);
		assert.equal(isJavaScriptMime("application/ecmascript"), true);
	});

	it("counts only built _astro scripts and implementation CDNs", () => {
		assert.equal(
			shouldCountJsRequest(
				"http://localhost:4321/_astro/client.js",
				"http://localhost:4321",
			),
			true,
		);
		assert.equal(
			shouldCountJsRequest(
				"http://localhost:4321/@vite/client",
				"http://localhost:4321",
			),
			false,
		);
		assert.equal(
			shouldCountJsRequest(
				"https://unpkg.com/hyperscript.org@0.9.13",
				"http://localhost:4321",
			),
			true,
		);
		assert.equal(
			shouldCountJsRequest(
				"https://cdn.jsdelivr.net/npm/jquery@3/dist/jquery.min.js",
				"http://localhost:4321",
			),
			true,
		);
		assert.equal(
			shouldCountJsRequest("https://esm.sh/react@19", "http://localhost:4321"),
			false,
		);
		assert.equal(
			shouldCountJsRequest(
				"http://localhost:4321/_astro/client.ts",
				"http://localhost:4321",
			),
			false,
		);
		assert.equal(
			shouldCountJsRequest("not-a-url", "http://localhost:4321"),
			false,
		);
	});

	it("ignores failed HTTP responses and cache hits", () => {
		const notFound = makeRequest({
			url: "http://localhost:4321/_astro/missing.js",
			status: 404,
			failed: false,
			encodedDataLength: 512,
		});
		assert.equal(isJsRequest(notFound, "http://localhost:4321"), false);
	});

	it("counts inline script bytes separately from network transfer", () => {
		const scripts = [
			"console.log('vanilla');",
			"window.frameworkReady = true;",
		];
		const inlineBytes = sumInlineJsBytes(scripts);
		assert.equal(
			inlineBytes,
			Buffer.byteLength(scripts[0], "utf8") +
				Buffer.byteLength(scripts[1], "utf8"),
		);
	});

	it("subtracts baseline transfer to produce incremental implementation JS", () => {
		const audit = buildBundleMeasurementAudit(
			{
				measuredRoute: "/test/react",
				jsTransferTotalBytes: 5000,
				inlineJsBytes: 120,
				jsRequestCount: 2,
				jsRequests: [],
			},
			3000,
			40,
		);

		assert.equal(audit.jsImplementationDeltaBytes, 2000);
		assert.equal(audit.baselineInlineJsBytes, 40);
		assert.equal(audit.inlineJsImplementationBytes, 80);
		assert.equal(audit.jsImplementationTotalBytes, 2080);
		assert.equal(audit.jsTransferTotalKiB, bytesToKiB(5000));
		assert.equal(audit.baselineJsTransferKiB, bytesToKiB(3000));
		assert.equal(audit.jsImplementationDeltaKiB, bytesToKiB(2000));
		assert.equal(audit.jsImplementationTotalKiB, bytesToKiB(2080));
		assert.match(audit.compressionNote, /transfer bytes/i);
	});

	it("keeps inline-only implementations from reporting as zero JavaScript", () => {
		const audit = buildBundleMeasurementAudit(
			{
				measuredRoute: "/test/vanillajs",
				jsTransferTotalBytes: 16371,
				inlineJsBytes: 744,
				jsRequestCount: 1,
				jsRequests: [],
			},
			16371,
			84,
		);

		assert.equal(audit.jsImplementationDeltaBytes, 0);
		assert.equal(audit.inlineJsImplementationBytes, 660);
		assert.equal(audit.jsImplementationTotalBytes, 660);
		assert.equal(audit.jsImplementationTotalKiB, bytesToKiB(660));
	});

	it("clamps inline implementation bytes when inline is below baseline", () => {
		const audit = buildBundleMeasurementAudit(
			{
				measuredRoute: "/test/cssOnly",
				jsTransferTotalBytes: 1000,
				inlineJsBytes: 20,
				jsRequestCount: 0,
				jsRequests: [],
			},
			1000,
			84,
		);

		assert.equal(audit.inlineJsImplementationBytes, 0);
		assert.equal(audit.jsImplementationTotalBytes, 0);
	});
});
