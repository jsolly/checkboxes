import type { CDPSession, Page } from "puppeteer";
import { STATS_CONFIG } from "../config/stats";

export const BUNDLE_MEASUREMENT_VERSION = "bm-1.0.0";

/** Cross-origin hosts that carry implementation runtime JS (jquery → jsdelivr, hyperscript/datastar → unpkg/jsdelivr). */
export const ALLOWED_CDN_HOSTS = new Set(["unpkg.com", "cdn.jsdelivr.net"]);

export interface TrackedRequest {
	url: string;
	resourceType: string | null;
	mimeType: string | null;
	fromCache: boolean;
	status: number | null;
	encodedDataLength: number;
	failed: boolean;
}

export interface JsRequestAudit {
	url: string;
	encodedDataLength: number;
	mimeType: string | null;
	resourceType: string | null;
}

export interface JsTransferMeasurement {
	measuredRoute: string;
	jsTransferTotalBytes: number;
	inlineJsBytes: number;
	jsRequestCount: number;
	jsRequests: JsRequestAudit[];
}

export interface BundleMeasurementAudit extends JsTransferMeasurement {
	baselineJsTransferBytes: number;
	baselineInlineJsBytes: number;
	jsImplementationDeltaBytes: number;
	inlineJsImplementationBytes: number;
	jsImplementationTotalBytes: number;
	jsTransferTotalKiB: number;
	baselineJsTransferKiB: number;
	jsImplementationDeltaKiB: number;
	jsImplementationTotalKiB: number;
	compressionNote: string;
}

const COMPRESSION_NOTE =
	"Measured as browser transfer bytes, with compression negotiated by the server.";

export function isJavaScriptMime(mimeType: string | null): boolean {
	if (!mimeType) return false;
	const lower = mimeType.toLowerCase();
	return lower.includes("javascript") || lower.includes("ecmascript");
}

export function shouldCountJsRequest(
	url: string,
	previewOrigin: string,
): boolean {
	try {
		const parsed = new URL(url);
		const origin = new URL(previewOrigin).origin;

		if (parsed.pathname.endsWith(".css")) {
			return false;
		}

		if (parsed.origin !== origin) {
			return ALLOWED_CDN_HOSTS.has(parsed.hostname);
		}

		if (parsed.pathname.startsWith("/_astro/")) {
			return parsed.pathname.endsWith(".js");
		}

		return false;
	} catch {
		return false;
	}
}

export function isJsRequest(
	request: TrackedRequest,
	previewOrigin: string,
): boolean {
	if (request.failed) return false;
	if (request.fromCache) return false;
	if (request.status !== null && request.status >= 400) return false;
	if (!shouldCountJsRequest(request.url, previewOrigin)) return false;

	const isScriptType = request.resourceType === "Script";
	const isJsMime = isJavaScriptMime(request.mimeType);
	return isScriptType || isJsMime;
}

export function dedupeJsRequestsByUrl(
	requests: Iterable<TrackedRequest>,
	previewOrigin: string,
): JsRequestAudit[] {
	const seenUrls = new Map<string, JsRequestAudit>();

	for (const request of requests) {
		if (!isJsRequest(request, previewOrigin)) continue;

		const entry: JsRequestAudit = {
			url: request.url,
			encodedDataLength: request.encodedDataLength,
			mimeType: request.mimeType,
			resourceType: request.resourceType,
		};

		const existing = seenUrls.get(request.url);
		if (!existing || entry.encodedDataLength > existing.encodedDataLength) {
			seenUrls.set(request.url, entry);
		}
	}

	return [...seenUrls.values()];
}

export function sumJsTransferBytes(requests: JsRequestAudit[]): number {
	return requests.reduce((sum, request) => sum + request.encodedDataLength, 0);
}

export function sumInlineJsBytes(scriptContents: string[]): number {
	return scriptContents.reduce(
		(sum, content) => sum + Buffer.byteLength(content, "utf8"),
		0,
	);
}

export function bytesToKiB(
	bytes: number,
	precision = STATS_CONFIG.BUNDLE_SIZE_PRECISION,
): number {
	return Number((bytes / 1024).toFixed(precision));
}

export function buildBundleMeasurementAudit(
	measurement: JsTransferMeasurement,
	baselineJsTransferBytes: number,
	baselineInlineJsBytes: number,
): BundleMeasurementAudit {
	const jsImplementationDeltaBytes = Math.max(
		0,
		measurement.jsTransferTotalBytes - baselineJsTransferBytes,
	);
	const inlineJsImplementationBytes = Math.max(
		0,
		measurement.inlineJsBytes - baselineInlineJsBytes,
	);
	const jsImplementationTotalBytes =
		jsImplementationDeltaBytes + inlineJsImplementationBytes;

	return {
		...measurement,
		baselineJsTransferBytes,
		baselineInlineJsBytes,
		jsImplementationDeltaBytes,
		inlineJsImplementationBytes,
		jsImplementationTotalBytes,
		jsTransferTotalKiB: bytesToKiB(measurement.jsTransferTotalBytes),
		baselineJsTransferKiB: bytesToKiB(baselineJsTransferBytes),
		jsImplementationDeltaKiB: bytesToKiB(jsImplementationDeltaBytes),
		jsImplementationTotalKiB: bytesToKiB(jsImplementationTotalBytes),
		compressionNote: COMPRESSION_NOTE,
	};
}

export function createRequestTracker(): Map<string, TrackedRequest> {
	return new Map();
}

export function attachNetworkTracker(
	client: CDPSession,
	requests: Map<string, TrackedRequest>,
): void {
	client.on("Network.requestWillBeSent", (event) => {
		requests.set(event.requestId, {
			url: event.request.url,
			resourceType: event.type ?? null,
			mimeType: null,
			fromCache: false,
			status: null,
			encodedDataLength: 0,
			failed: false,
		});
	});

	client.on("Network.responseReceived", (event) => {
		const request = requests.get(event.requestId);
		if (!request) return;

		request.mimeType = event.response.mimeType ?? null;
		request.fromCache =
			(event.response.fromDiskCache ?? false) ||
			(event.response.fromServiceWorker ?? false);
		request.status = event.response.status ?? null;
		if (event.type) {
			request.resourceType = event.type;
		}
	});

	client.on("Network.loadingFinished", (event) => {
		const request = requests.get(event.requestId);
		if (!request) return;
		request.encodedDataLength = event.encodedDataLength;
	});

	client.on("Network.loadingFailed", (event) => {
		const request = requests.get(event.requestId);
		if (!request) return;
		request.failed = true;
	});
}

export async function prepareMeasurementSession(
	page: Page,
	client: CDPSession,
): Promise<void> {
	await page.setCacheEnabled(false);
	await client.send("Network.clearBrowserCache");
	await client.send("Network.clearBrowserCookies");
	await client.send("Network.setCacheDisabled", { cacheDisabled: true });
	await client.send("Network.enable");
}

export async function measureInlineJsBytes(page: Page): Promise<number> {
	const scriptContents = await page.evaluate(() => {
		const scripts = document.querySelectorAll("script:not([src])");
		const contents: string[] = [];

		for (const script of scripts) {
			const type = (script.getAttribute("type") ?? "").trim().toLowerCase();
			if (
				type &&
				type !== "module" &&
				type !== "text/javascript" &&
				type !== "application/javascript"
			) {
				continue;
			}
			contents.push(script.textContent ?? "");
		}

		return contents;
	});

	return sumInlineJsBytes(scriptContents);
}

export function summarizeJsTransfer(
	routePath: string,
	requests: Map<string, TrackedRequest>,
	inlineJsBytes: number,
	previewOrigin: string,
): JsTransferMeasurement {
	const jsRequests = dedupeJsRequestsByUrl(requests.values(), previewOrigin);

	return {
		measuredRoute: routePath,
		jsTransferTotalBytes: sumJsTransferBytes(jsRequests),
		inlineJsBytes,
		jsRequestCount: jsRequests.length,
		jsRequests,
	};
}

export async function measureJsTransfer(
	page: Page,
	routePath: string,
): Promise<JsTransferMeasurement> {
	const previewOrigin = new URL(STATS_CONFIG.PREVIEW_URL).origin;
	const targetUrl = new URL(`${STATS_CONFIG.PREVIEW_URL}${routePath}`);
	const client = await page.createCDPSession();
	const requests = createRequestTracker();

	try {
		await prepareMeasurementSession(page, client);
		attachNetworkTracker(client, requests);

		await page.goto(targetUrl.href, {
			waitUntil: "networkidle0",
		});

		const inlineJsBytes = await measureInlineJsBytes(page);
		return summarizeJsTransfer(
			targetUrl.pathname,
			requests,
			inlineJsBytes,
			previewOrigin,
		);
	} finally {
		await client.detach();
	}
}
