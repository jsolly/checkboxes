import fs from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { STATS_CONFIG } from "../config/stats";

export const BUNDLE_MEASUREMENT_VERSION = "bm-2.0.0";

/** Cross-origin hosts that carry implementation runtime JS (jquery → jsdelivr, hyperscript/datastar → unpkg/jsdelivr). */
export const ALLOWED_CDN_HOSTS = new Set(["unpkg.com", "cdn.jsdelivr.net"]);

export interface BuiltJsReference {
	kind: "first-party" | "external" | "inline";
	url?: string;
	content?: string;
}

export interface JsSourceAudit {
	kind: BuiltJsReference["kind"];
	url?: string;
	rawBytes: number;
	normalizedBytes: number;
}

export interface JsPayloadMeasurement {
	measuredRoute: string;
	inlineJsBytes: number;
	jsRequestCount: number;
	jsRawBytes: number;
	jsNormalizedBytes: number;
	jsSources: JsSourceAudit[];
}

export interface BundleMeasurementAudit extends JsPayloadMeasurement {
	baselineInlineJsBytes: number;
	baselineNormalizedBytes: number;
	inlineJsImplementationBytes: number;
	jsImplementationNormalizedBytes: number;
	jsImplementationNormalizedKiB: number;
	compressionNote: string;
}

const COMPRESSION_NOTE =
	"Ranked by normalized gzip-compressed JavaScript payload.";

export function sumInlineJsBytes(scriptContents: string[]): number {
	return scriptContents.reduce(
		(sum, content) => sum + Buffer.byteLength(content, "utf8"),
		0,
	);
}

export function normalizeJsBytes(content: string | Buffer): number {
	if (content.length === 0) return 0;
	return gzipSync(content, { level: 9 }).length;
}

export function bytesToKiB(
	bytes: number,
	precision = STATS_CONFIG.BUNDLE_SIZE_PRECISION,
): number {
	return Number((bytes / 1024).toFixed(precision));
}

function parseAttributes(tag: string): Record<string, string> {
	const attributes: Record<string, string> = {};
	const attributePattern =
		/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

	for (const match of tag.matchAll(attributePattern)) {
		const [, name, doubleQuoted, singleQuoted, bare] = match;
		if (!name || name === "script" || name === "link") continue;
		attributes[name.toLowerCase()] = doubleQuoted ?? singleQuoted ?? bare ?? "";
	}

	return attributes;
}

function isJavaScriptScriptType(type: string | undefined): boolean {
	const normalized = (type ?? "").trim().toLowerCase();
	return (
		!normalized ||
		normalized === "module" ||
		normalized === "text/javascript" ||
		normalized === "application/javascript"
	);
}

function classifyExternalUrl(
	url: string,
	previewOrigin: string,
): BuiltJsReference["kind"] | null {
	const parsed = new URL(url, previewOrigin);
	const origin = new URL(previewOrigin).origin;

	if (parsed.origin === origin && parsed.pathname.startsWith("/_astro/")) {
		return parsed.pathname.endsWith(".js") ? "first-party" : null;
	}

	if (parsed.origin !== origin) {
		if (
			parsed.protocol === "https:" &&
			ALLOWED_CDN_HOSTS.has(parsed.hostname)
		) {
			return "external";
		}
		throw new Error(`Uncounted external JavaScript host: ${parsed.hostname}`);
	}

	return null;
}

export function parseBuiltJsReferences(
	html: string,
	previewOrigin: string,
): BuiltJsReference[] {
	const references: BuiltJsReference[] = [];
	const seenUrls = new Set<string>();
	const openingTagAttributes = `(?:[^>'"]*|"[^"]*"|'[^']*')*`;
	const linkPattern = new RegExp(
		String.raw`<link\b${openingTagAttributes}>`,
		"gi",
	);
	const runtimePattern = new RegExp(
		String.raw`<script\b(${openingTagAttributes})>([\s\S]*?)<\/script>|<astro-island\b(${openingTagAttributes})>`,
		"gi",
	);

	function addUrlReference(url: string): void {
		const kind = classifyExternalUrl(url, previewOrigin);
		if (!kind) return;
		if (seenUrls.has(url)) return;
		seenUrls.add(url);
		references.push({ kind, url });
	}

	for (const linkMatch of html.matchAll(linkPattern)) {
		const tag = linkMatch[0];
		const attributes = parseAttributes(tag);
		if (attributes.rel !== "modulepreload" || !attributes.href) continue;

		addUrlReference(attributes.href);
	}

	for (const runtimeMatch of html.matchAll(runtimePattern)) {
		const [, rawScriptAttributes, content = "", rawIslandAttributes] =
			runtimeMatch;

		if (rawIslandAttributes !== undefined) {
			const attributes = parseAttributes(rawIslandAttributes);
			if (attributes["component-url"]) {
				addUrlReference(attributes["component-url"]);
			}
			if (attributes["renderer-url"]) {
				addUrlReference(attributes["renderer-url"]);
			}
			continue;
		}

		const attributes = parseAttributes(rawScriptAttributes ?? "");
		if (!isJavaScriptScriptType(attributes.type)) continue;

		if (attributes.src) {
			addUrlReference(attributes.src);
			continue;
		}

		references.push({ kind: "inline", content });
	}

	return references;
}

function isIdentifierCharacter(character: string | undefined): boolean {
	return !!character && /[\w$]/.test(character);
}

function skipString(source: string, start: number): number {
	const quote = source[start];
	let index = start + 1;

	while (index < source.length) {
		const current = source[index];
		if (current === "\\") {
			index += 2;
			continue;
		}
		if (current === quote) return index + 1;
		index++;
	}

	return source.length;
}

function skipTemplate(source: string, start: number): number {
	let index = start + 1;

	while (index < source.length) {
		const current = source[index];
		if (current === "\\") {
			index += 2;
			continue;
		}
		if (current === "`") return index + 1;
		index++;
	}

	return source.length;
}

function skipComment(source: string, start: number): number {
	if (source[start + 1] === "/") {
		const lineEnd = source.indexOf("\n", start + 2);
		return lineEnd === -1 ? source.length : lineEnd + 1;
	}

	if (source[start + 1] === "*") {
		const blockEnd = source.indexOf("*/", start + 2);
		return blockEnd === -1 ? source.length : blockEnd + 2;
	}

	return start;
}

function parseQuotedSpecifier(source: string, start: number): string | null {
	let index = start;
	while (index < source.length && /\s/.test(source[index] ?? "")) index++;
	const quote = source[index];
	if (quote !== '"' && quote !== "'") return null;

	let specifier = "";
	index++;
	while (index < source.length) {
		const current = source[index];
		if (current === "\\") {
			specifier += source[index + 1] ?? "";
			index += 2;
			continue;
		}
		if (current === quote) return specifier;
		specifier += current;
		index++;
	}

	return null;
}

function findTokenOutsideLiterals(
	source: string,
	token: string,
	start: number,
): number {
	let index = start;

	while (index < source.length) {
		const current = source[index];
		if (current === '"' || current === "'") {
			index = skipString(source, index);
			continue;
		}
		if (current === "`") {
			index = skipTemplate(source, index);
			continue;
		}
		if (current === "/") {
			const nextIndex = skipComment(source, index);
			if (nextIndex !== index) {
				index = nextIndex;
				continue;
			}
		}
		if (
			source.startsWith(token, index) &&
			!isIdentifierCharacter(source[index - 1]) &&
			!isIdentifierCharacter(source[index + token.length])
		) {
			return index;
		}
		index++;
	}

	return -1;
}

function findNextQuoteOutsideLiterals(source: string, start: number): number {
	let index = start;

	while (index < source.length) {
		const current = source[index];
		if (current === '"' || current === "'") return index;
		if (current === "`") {
			index = skipTemplate(source, index);
			continue;
		}
		if (current === "/") {
			const nextIndex = skipComment(source, index);
			if (nextIndex !== index) {
				index = nextIndex;
				continue;
			}
		}
		index++;
	}

	return -1;
}

function parseJsModuleSpecifiers(source: string): string[] {
	const specifiers = new Set<string>();
	let index = 0;

	while (index < source.length) {
		const current = source[index];
		if (current === '"' || current === "'") {
			index = skipString(source, index);
			continue;
		}
		if (current === "`") {
			index = skipTemplate(source, index);
			continue;
		}
		if (current === "/") {
			const nextIndex = skipComment(source, index);
			if (nextIndex !== index) {
				index = nextIndex;
				continue;
			}
		}

		if (
			source.startsWith("import", index) &&
			!isIdentifierCharacter(source[index - 1]) &&
			!isIdentifierCharacter(source[index + "import".length])
		) {
			let cursor = index + "import".length;
			while (cursor < source.length && /\s/.test(source[cursor] ?? ""))
				cursor++;

			if (source[cursor] === "(") {
				let quoteIndex = cursor + 1;
				while (
					quoteIndex < source.length &&
					/\s/.test(source[quoteIndex] ?? "")
				) {
					quoteIndex++;
				}
				const specifier = parseQuotedSpecifier(source, quoteIndex);
				if (specifier) specifiers.add(specifier);
				index = skipString(source, quoteIndex);
				continue;
			}

			const quoteIndex = findNextQuoteOutsideLiterals(source, cursor);
			if (quoteIndex !== -1) {
				const specifier = parseQuotedSpecifier(source, quoteIndex);
				if (specifier) specifiers.add(specifier);
				index = skipString(source, quoteIndex);
				continue;
			}
		}

		if (
			source.startsWith("export", index) &&
			!isIdentifierCharacter(source[index - 1]) &&
			!isIdentifierCharacter(source[index + "export".length])
		) {
			const fromIndex = findTokenOutsideLiterals(
				source,
				"from",
				index + "export".length,
			);
			if (fromIndex !== -1) {
				let quoteIndex = fromIndex + "from".length;
				while (
					quoteIndex < source.length &&
					/\s/.test(source[quoteIndex] ?? "")
				) {
					quoteIndex++;
				}
				const specifier = parseQuotedSpecifier(source, quoteIndex);
				if (specifier) specifiers.add(specifier);
				index = skipString(source, quoteIndex);
				continue;
			}
		}

		index++;
	}

	return [...specifiers];
}

async function readFirstPartySource(
	distDirectory: string,
	url: string,
	previewOrigin: string,
): Promise<Buffer> {
	const parsed = new URL(url, previewOrigin);
	const relativePath = parsed.pathname.replace(/^\/+/, "");
	const resolvedDist = path.resolve(distDirectory);
	const resolvedPath = path.resolve(resolvedDist, relativePath);
	if (
		resolvedPath !== resolvedDist &&
		!resolvedPath.startsWith(`${resolvedDist}${path.sep}`)
	) {
		throw new Error(`First-party chunk path escapes dist/: ${url}`);
	}
	return fs.readFile(resolvedPath).catch((cause) => {
		throw new Error(`Missing first-party JavaScript chunk ${url}`, { cause });
	});
}

async function readExternalSource(url: string): Promise<Buffer> {
	const response = await fetch(url, {
		signal: AbortSignal.timeout(30_000),
	});
	const finalUrl = new URL(response.url);
	if (!ALLOWED_CDN_HOSTS.has(finalUrl.hostname)) {
		throw new Error(
			`External JavaScript redirected to uncounted host: ${finalUrl.hostname}`,
		);
	}
	if (!response.ok) {
		throw new Error(
			`Could not fetch external JavaScript ${url}: ${response.status}`,
		);
	}
	return Buffer.from(await response.arrayBuffer());
}

function resolveModuleSpecifier(
	specifier: string,
	importerUrl: string,
	previewOrigin: string,
): BuiltJsReference | null {
	if (
		specifier.startsWith("http://") ||
		specifier.startsWith("https://") ||
		specifier.startsWith("/")
	) {
		const kind = classifyExternalUrl(specifier, previewOrigin);
		return kind ? { kind, url: specifier } : null;
	}

	if (specifier.startsWith(".")) {
		const resolved = new URL(specifier, new URL(importerUrl, previewOrigin));
		const kind = classifyExternalUrl(resolved.href, previewOrigin);
		return kind ? { kind, url: resolved.pathname } : null;
	}

	return null;
}

export async function measureBuiltJsPayload(
	distDirectory: string,
	routePath: string,
	previewOrigin = "http://localhost:4321",
): Promise<JsPayloadMeasurement> {
	const routeDirectory = routePath.replace(/^\/+|\/+$/g, "");
	const htmlPath = path.join(distDirectory, routeDirectory, "index.html");
	const html = await fs.readFile(htmlPath, "utf-8");
	const references = parseBuiltJsReferences(html, previewOrigin);
	const jsSources: JsSourceAudit[] = [];
	const pendingReferences = [...references];
	const seenUrls = new Set(
		references
			.filter((reference) => reference.kind !== "inline" && reference.url)
			.map((reference) => reference.url as string),
	);

	for (let index = 0; index < pendingReferences.length; index++) {
		const reference = pendingReferences[index];
		if (!reference) {
			continue;
		}
		const content =
			reference.kind === "inline"
				? Buffer.from(reference.content ?? "", "utf8")
				: reference.kind === "first-party" && reference.url
					? await readFirstPartySource(
							distDirectory,
							reference.url,
							previewOrigin,
						)
					: reference.url
						? await readExternalSource(reference.url)
						: Buffer.alloc(0);

		const rawBytes = content.byteLength;
		jsSources.push({
			kind: reference.kind,
			url: reference.url,
			rawBytes,
			normalizedBytes: normalizeJsBytes(content),
		});

		if (reference.kind !== "first-party" || !reference.url) continue;

		for (const specifier of parseJsModuleSpecifiers(content.toString("utf8"))) {
			const importedReference = resolveModuleSpecifier(
				specifier,
				reference.url,
				previewOrigin,
			);
			if (!importedReference?.url || seenUrls.has(importedReference.url)) {
				continue;
			}
			seenUrls.add(importedReference.url);
			pendingReferences.push(importedReference);
		}
	}

	const inlineJsBytes = jsSources
		.filter((source) => source.kind === "inline")
		.reduce((sum, source) => sum + source.rawBytes, 0);
	const jsRawBytes = jsSources.reduce(
		(sum, source) => sum + source.rawBytes,
		0,
	);
	const jsNormalizedBytes = jsSources.reduce(
		(sum, source) => sum + source.normalizedBytes,
		0,
	);

	return {
		measuredRoute: `/${routeDirectory}`,
		inlineJsBytes,
		jsRequestCount: jsSources.filter((source) => source.kind !== "inline")
			.length,
		jsRawBytes,
		jsNormalizedBytes,
		jsSources,
	};
}

export function buildBundleMeasurementAudit(
	measurement: JsPayloadMeasurement,
	baselineInlineJsBytes: number,
	baselineNormalizedBytes: number,
): BundleMeasurementAudit {
	const inlineJsImplementationBytes = Math.max(
		0,
		measurement.inlineJsBytes - baselineInlineJsBytes,
	);
	const jsImplementationNormalizedBytes = Math.max(
		0,
		measurement.jsNormalizedBytes - baselineNormalizedBytes,
	);

	return {
		...measurement,
		baselineInlineJsBytes,
		baselineNormalizedBytes,
		inlineJsImplementationBytes,
		jsImplementationNormalizedBytes,
		jsImplementationNormalizedKiB: bytesToKiB(jsImplementationNormalizedBytes),
		compressionNote: COMPRESSION_NOTE,
	};
}
