// biome-ignore-all lint/performance/noAwaitInLoops: Bound filesystem memory and serialize object writes, retries and verification.
// biome-ignore-all lint/complexity/useLiteralKeys: TypeScript index-signature checks require bracket access for validated unknown records.
import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { documentReferences } from "./references.js";

export const CACHE_CONTROL = "public, max-age=31536000, immutable";
const PUBLIC_PATH = /^\/(?:favicon\.(?:ico|svg)|og-image\.jpg)$/u;
type ImageType = "image/x-icon" | "image/svg+xml" | "image/jpeg";
const DOCUMENT = /\.(?:html|json|md|css)$/u;
const DISTRIBUTION = /^d[a-z0-9]+\.cloudfront\.net$/u;
const PUBLIC_IMAGE = /\.(?:ico|svg|jpe?g|png|webp|gif)$/u;
const TYPES: Readonly<Record<string, ImageType>> = {
	ico: "image/x-icon",
	svg: "image/svg+xml",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
};
export const digest = (bytes: Uint8Array): string =>
	createHash("sha256").update(bytes).digest("hex");
export interface Asset {
	path: string;
	sha256: string;
	bytes: number;
	contentType: ImageType;
	key: string;
}
export interface AssetManifest {
	version: 1;
	assets: Asset[];
}
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function parseManifest(value: unknown): AssetManifest {
	if (
		!isRecord(value) ||
		value["version"] !== 1 ||
		!Array.isArray(value["assets"]) ||
		Object.keys(value).sort().join(",") !== "assets,version" ||
		value["assets"].length === 0
	)
		throw new Error("Invalid asset manifest");
	const assets: Asset[] = [];
	const rows: readonly unknown[] = value["assets"];
	for (const row of rows) {
		if (
			!isRecord(row) ||
			Object.keys(row).sort().join(",") !==
				"bytes,contentType,key,path,sha256" ||
			typeof row["path"] !== "string" ||
			!PUBLIC_PATH.test(row["path"]) ||
			typeof row["sha256"] !== "string" ||
			!/^[a-f0-9]{64}$/u.test(row["sha256"]) ||
			typeof row["bytes"] !== "number" ||
			!Number.isSafeInteger(row["bytes"]) ||
			row["bytes"] <= 0 ||
			row["bytes"] > 100_000_000 ||
			row["contentType"] !== contentType(row["path"]) ||
			row["key"] !== objectKey(row["path"], row["sha256"])
		)
			throw new Error("Invalid asset manifest row");
		const previous = assets.at(-1);
		if (previous && previous.path >= row["path"])
			throw new Error("Asset paths must be unique and sorted");
		assets.push({
			path: row["path"],
			sha256: row["sha256"],
			bytes: row["bytes"],
			contentType: contentType(row["path"]),
			key: objectKey(row["path"], row["sha256"]),
		});
	}
	return { version: 1, assets };
}
export function objectKey(path: string, sha256: string): string {
	return `sha256/${sha256}${path}`;
}
function contentType(path: string): ImageType {
	const type = TYPES[path.split(".").at(-1) ?? ""];
	if (!type) throw new Error(`Unsupported image: ${path}`);
	return type;
}

async function files(root: string): Promise<string[]> {
	if ((await lstat(root)).isSymbolicLink())
		throw new Error(`Symlink is not an asset input: ${root}`);
	const entries = await readdir(root, { withFileTypes: true });
	const results: string[] = [];
	for (const entry of entries.sort((a, b) =>
		a.name.localeCompare(b.name, "en"),
	)) {
		const path = join(root, entry.name);
		if (entry.isSymbolicLink())
			throw new Error(`Symlink is not an asset input: ${path}`);
		if (entry.isDirectory()) results.push(...(await files(path)));
		else if (entry.isFile()) results.push(path);
	}
	return results;
}

/** New public media needs deliberate classification rather than an automatic upload. */
export async function assertPublicInventory(
	root: string,
	manifest: AssetManifest,
): Promise<void> {
	const directory = join(root, "public");
	const candidates = (await files(directory)).filter((path) =>
		PUBLIC_IMAGE.test(path),
	);
	const expected = new Set(
		manifest.assets.map((asset) => join(directory, asset.path)),
	);
	for (const path of candidates)
		if (!expected.has(path))
			throw new Error(`Unclassified public media: ${path}`);
	if (candidates.length !== expected.size)
		throw new Error("Manifest public media is missing from source");
}

/** Inspect only the published build's documents/data/styles, never draft source. */
export async function publishedReferences(dist: string): Promise<Set<string>> {
	const paths = new Set<string>();
	for (const path of await files(dist)) {
		if (!DOCUMENT.test(path)) continue;
		const kind = path.split(".").at(-1);
		if (kind !== "html" && kind !== "json" && kind !== "css") continue;
		for (const reference of documentReferences(
			await readFile(path, "utf8"),
			kind,
		))
			paths.add(reference);
	}
	if (!paths.size)
		throw new Error("No published image references; build the site first");
	return paths;
}

export async function createManifest(
	root: string,
	references: ReadonlySet<string>,
): Promise<AssetManifest> {
	if ((await lstat(join(root, "public"))).isSymbolicLink())
		throw new Error("Symlink is not an asset input: public");
	const assets: Asset[] = [];
	for (const path of [...references].sort()) {
		if (!PUBLIC_PATH.test(path) || path.includes("..") || path.includes("//"))
			throw new Error(`Unsafe public path: ${path}`);
		const local = join(root, "public", path);
		// Check every component so a parent symlink cannot expose another directory.
		let current = join(root, "public");
		for (const part of path.slice(1).split("/")) {
			current = join(current, part);
			if ((await lstat(current)).isSymbolicLink())
				throw new Error(`Symlink is not an asset input: ${current}`);
		}
		const bytes = await readFile(local);
		const sha256 = digest(bytes);
		assets.push({
			path,
			sha256,
			bytes: bytes.length,
			contentType: contentType(path),
			key: objectKey(path, sha256),
		});
	}
	return parseManifest({ version: 1, assets });
}

export function assertCoverage(
	manifest: AssetManifest,
	references: ReadonlySet<string>,
): void {
	const expected = new Set(manifest.assets.map((asset) => asset.path));
	for (const path of references)
		if (!expected.has(path))
			throw new Error(`Published image missing from manifest: ${path}`);
	for (const path of expected)
		if (!references.has(path))
			throw new Error(`Manifest image is no longer published: ${path}`);
}

export interface ObjectResponse {
	bytes: Uint8Array;
	contentType: string | null;
	cacheControl: string | null;
}
export interface AssetTransport {
	get(asset: Asset): Promise<ObjectResponse | undefined>;
	put(asset: Asset, bytes: Uint8Array): Promise<void>;
}

function assertObject(asset: Asset, response: ObjectResponse): void {
	if (
		response.bytes.length !== asset.bytes ||
		digest(response.bytes) !== asset.sha256
	)
		throw new Error(`Object bytes mismatch: ${asset.path}`);
	if (
		response.contentType !== asset.contentType ||
		response.cacheControl !== CACHE_CONTROL
	)
		throw new Error(`Object headers mismatch: ${asset.path}`);
}

/** Retry transient transport failures only; integrity errors never become permission to overwrite. */
async function retry<T>(operation: () => Promise<T>): Promise<T> {
	let last: unknown;
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			return await operation();
		} catch (error) {
			if (!(error instanceof TransientError)) throw error;
			last = error;
			if (attempt < 2) await setTimeout(1_100 * (attempt + 1));
		}
	}
	throw last;
}
export class TransientError extends Error {}

export async function verifyAssets(
	manifest: AssetManifest,
	transport: AssetTransport,
): Promise<void> {
	for (const asset of manifest.assets) {
		const response = await retry(() => transport.get(asset));
		if (!response) throw new Error(`Missing object: ${asset.path}`);
		assertObject(asset, response);
	}
}

export async function uploadAssets(
	manifest: AssetManifest,
	read: (asset: Asset) => Promise<Uint8Array>,
	transport: AssetTransport,
): Promise<void> {
	// Validate all source bytes before the first write.
	for (const asset of manifest.assets) {
		const bytes = await read(asset);
		if (bytes.length !== asset.bytes || digest(bytes) !== asset.sha256)
			throw new Error(`Local bytes mismatch: ${asset.path}`);
	}
	for (const asset of manifest.assets) {
		const existing = await retry(() => transport.get(asset));
		if (existing) {
			assertObject(asset, existing);
			continue;
		}
		const bytes = await read(asset);
		if (bytes.length !== asset.bytes || digest(bytes) !== asset.sha256)
			throw new Error(`Local bytes mismatch: ${asset.path}`);
		await retry(() => transport.put(asset, bytes));
		const uploaded = await retry(async () => {
			const response = await transport.get(asset);
			// S3-origin CloudFront errors cache for at least one second, even with TTL 0.
			if (!response)
				throw new TransientError(`Upload not readable: ${asset.path}`);
			return response;
		});
		assertObject(asset, uploaded);
	}
}

function parseUrl(value: string): URL {
	try {
		return new URL(value);
	} catch {
		// biome-ignore lint/style/useErrorCause: Native URL errors can contain presigned credentials.
		throw new Error("Invalid asset URL (value redacted)");
	}
}

export function deliveryOrigin(value: string): string {
	const url = parseUrl(value);
	if (
		url.protocol !== "https:" ||
		url.username ||
		url.password ||
		url.port ||
		url.pathname !== "/" ||
		url.search ||
		url.hash ||
		!DISTRIBUTION.test(url.hostname)
	)
		throw new Error("Expected the stack's HTTPS CloudFront origin");
	return url.origin;
}
export function assetUrl(origin: string, asset: Asset): string {
	return `${deliveryOrigin(origin)}/${asset.key}`;
}

export function assertUploadTarget(
	manifest: AssetManifest,
	bucket: string | undefined,
	key: string,
	value: string,
): void {
	const url = parseUrl(value);
	if (
		!bucket ||
		!manifest.assets.some((entry) => entry.key === key) ||
		url.protocol !== "https:" ||
		url.username ||
		url.password ||
		url.port ||
		url.hash ||
		url.hostname !== `${bucket}.s3.us-east-1.amazonaws.com` ||
		decodeURIComponent(url.pathname) !== `/${key}` ||
		url.searchParams.get("X-Amz-Algorithm") !== "AWS4-HMAC-SHA256" ||
		!url.searchParams.has("X-Amz-Signature")
	) {
		throw new Error(
			"Authorization must contain only exact manifest keys on the intended regional S3 endpoint",
		);
	}
}
