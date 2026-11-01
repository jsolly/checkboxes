import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import {
	type Asset,
	type AssetTransport,
	assertCoverage,
	assertPublicInventory,
	assertUploadTarget,
	assetUrl,
	CACHE_CONTROL,
	createManifest,
	deliveryOrigin,
	digest,
	type ObjectResponse,
	parseManifest,
	publishedReferences,
	TransientError,
	uploadAssets,
	verifyAssets,
} from "./media.js";

const [command, originInput, bucketName, authorizationFile] =
	process.argv.slice(2);
const root = process.cwd();
const manifestPath = resolve(root, "config/aws/static-assets/manifest.json");
if (command === "inventory") {
	const manifest = await createManifest(
		root,
		await publishedReferences(resolve(root, "dist")),
	);
	await assertPublicInventory(root, manifest);
	await writeFile(manifestPath, `${JSON.stringify(manifest, null, "\t")}\n`);
	console.log(
		`Inventoried ${manifest.assets.length} published images, ${manifest.assets.reduce((n, asset) => n + asset.bytes, 0)} bytes`,
	);
} else {
	const manifestBytes = await readFile(manifestPath);
	const manifestHash = digest(manifestBytes);
	const manifest = parseManifest(JSON.parse(manifestBytes.toString("utf8")));
	if (command === "check") {
		await assertPublicInventory(root, manifest);
		const references = await publishedReferences(resolve(root, "dist"));
		assertCoverage(manifest, references);
		const current = await createManifest(root, references);
		if (JSON.stringify(current) !== JSON.stringify(manifest))
			throw new Error("Manifest differs from published source bytes");
		console.log(
			`Verified ${manifest.assets.length} source images and published-reference coverage`,
		);
	} else if (command === "plan") {
		if (!originInput || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/u.test(originInput))
			throw new Error("Supply the reviewed stack BucketName");
		console.log(
			manifest.assets
				.map((asset) =>
					[
						"aws s3api put-object --region us-east-1",
						`--bucket ${originInput} --key ${asset.key} --body public${asset.path}`,
						`--content-type ${asset.contentType} --cache-control '${CACHE_CONTROL}' --if-none-match '*'`,
					].join(" "),
				)
				.join("\n"),
		);
	} else if (command === "verify" || command === "upload") {
		if (!originInput) throw new Error("Supply the stack output DeliveryOrigin");
		const origin = deliveryOrigin(originInput);
		// The human authorizes each exact immutable key using short-lived S3 PUT URLs.
		// This file is a credential: keep it outside Git. No role discovery or login.
		const urls: Record<string, string> = {};
		if (command === "upload" && authorizationFile) {
			const authorizationText = await readFile(authorizationFile, "utf8");
			let value: unknown;
			try {
				value = JSON.parse(authorizationText);
			} catch {
				// biome-ignore lint/style/useErrorCause: JSON syntax diagnostics may include credential-bearing input.
				throw new Error("Invalid upload authorization map (contents redacted)");
			}
			if (!value || typeof value !== "object" || Array.isArray(value))
				throw new Error("Expected an external key to signed URL map");
			for (const [key, url] of Object.entries(value)) {
				if (typeof url !== "string")
					throw new Error("Expected signed URL strings");
				urls[key] = url;
			}
		}
		if (command === "upload" && !authorizationFile)
			throw new Error("Upload requires an external presigned PUT URL map");
		for (const [key, value] of Object.entries(urls)) {
			assertUploadTarget(manifest, bucketName, key, value);
		}
		async function request(
			url: string,
			options?: RequestInit,
		): Promise<Response> {
			let response: Response;
			try {
				response = await fetch(url, {
					...options,
					redirect: "error",
					signal: AbortSignal.timeout(30_000),
				});
			} catch {
				// biome-ignore lint/style/useErrorCause: Fetch errors can contain presigned credential URLs; never expose them.
				throw new TransientError("Asset request failed (URL redacted)");
			}
			if (response.status === 429 || response.status >= 500)
				throw new TransientError(`Transient HTTP ${response.status}`);
			return response;
		}
		const transport: AssetTransport = {
			async get(asset: Asset): Promise<ObjectResponse | undefined> {
				const response = await request(assetUrl(origin, asset));
				// Private S3 origins return 403 for missing objects without ListBucket.
				// Only an authenticated human's upload authorization permits treating that as absent.
				if (
					response.status === 404 ||
					(command === "upload" && response.status === 403 && urls[asset.key])
				)
					return undefined;
				if (!response.ok)
					throw new Error(
						`Asset GET failed: ${asset.path}, HTTP ${response.status}`,
					);
				return {
					bytes: new Uint8Array(await response.arrayBuffer()),
					contentType: response.headers.get("content-type"),
					cacheControl: response.headers.get("cache-control"),
				};
			},
			async put(asset: Asset, bytes: Uint8Array): Promise<void> {
				const url = urls[asset.key];
				if (!url) throw new Error(`No upload authorization for ${asset.path}`);
				const response = await request(url, {
					method: "PUT",
					headers: {
						"content-type": asset.contentType,
						"cache-control": CACHE_CONTROL,
						"if-none-match": "*",
					},
					body: Buffer.from(bytes),
				});
				// A concurrent successful upload is accepted only after the subsequent byte verification.
				if (!response.ok && response.status !== 412)
					throw new Error(
						`Asset PUT failed: ${asset.path}, HTTP ${response.status}`,
					);
			},
		};
		if (command === "upload")
			await uploadAssets(
				manifest,
				(asset) => readFile(resolve(root, `public${asset.path}`)),
				transport,
			);
		await verifyAssets(manifest, transport);
		if (command === "verify" && bucketName) {
			if (digest(await readFile(manifestPath)) !== manifestHash)
				throw new Error(
					"Manifest changed during verification; no receipt written",
				);
			if (!isAbsolute(bucketName) || resolve(bucketName).startsWith(`${root}/`))
				throw new Error(
					"Keep verification receipts at an absolute path outside the repository",
				);
			await writeFile(
				bucketName,
				`${JSON.stringify(
					{
						version: 1,
						verifiedAt: new Date().toISOString(),
						origin,
						manifestSha256: manifestHash,
						objects: manifest.assets.length,
					},
					null,
					"\t",
				)}\n`,
				{ flag: "wx" },
			);
		}
		console.log(
			`Verified every byte and delivery header for ${manifest.assets.length} images at ${origin}`,
		);
	} else
		throw new Error(
			"Use npm run assets -- inventory, check, verify ORIGIN, or upload ORIGIN BUCKET AUTH_FILE",
		);
}
