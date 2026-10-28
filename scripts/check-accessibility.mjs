import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import axe from "axe-core";
import { chromium } from "playwright";

// Scan every built HTML document. Optional arguments restrict the route inventory.
const INDEX_HTML = /index\.html$/u;
const root = resolve("dist");
async function inventory(dir) {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = await Promise.all(
		entries
			.filter((e) => e.name !== "_vercel")
			.map((e) => {
				const path = join(dir, e.name);
				return e.isDirectory()
					? inventory(path)
					: path.endsWith(".html")
						? [path]
						: [];
			}),
	);
	return files.flat();
}
const routes = process.argv.slice(2);
const pages = routes.length
	? routes
	: (await inventory(root)).map(
			(p) => `/${p.slice(root.length + 1).replace(INDEX_HTML, "")}`,
		);
if (!pages.length)
	throw new Error("No HTML pages found. Run npm run build first.");
const mime = {
	".html": "text/html",
	".js": "text/javascript",
	".css": "text/css",
	".json": "application/json",
	".svg": "image/svg+xml",
	".png": "image/png",
	".woff2": "font/woff2",
};
const server = createServer(async (req, res) => {
	try {
		let path = resolve(
			root,
			`.${decodeURIComponent(new URL(req.url, "http://localhost").pathname)}`,
		);
		if (path !== root && !path.startsWith(root + sep))
			throw new Error("Invalid path");
		if ((await stat(path)).isDirectory()) path = join(path, "index.html");
		res.setHeader(
			"Content-Type",
			mime[extname(path)] || "application/octet-stream",
		);
		res.end(await readFile(path));
	} catch {
		res.writeHead(404).end();
	}
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const results = [];
try {
	browser = await chromium.launch({ headless: true });
	await Promise.all(
		[1280, 390].map(async (width) => {
			const context = await browser.newContext({
				viewport: { width, height: 900 },
				bypassCSP: true,
			});
			// No external APIs, analytics, embeds or production writes during local audits.
			await context.route("**/*", (route) =>
				new URL(route.request().url()).origin === origin
					? route.continue()
					: route.abort(),
			);
			const queue = [...pages];
			await Promise.all(
				Array.from({ length: 4 }, async () => {
					const page = await context.newPage();
					async function nextPage() {
						if (!queue.length) return;
						const path = queue.shift();
						const response = await page.goto(origin + path, {
							waitUntil: "load",
						});
						if (!response?.ok())
							throw new Error(`Failed to load ${path}: ${response?.status()}`);
						await page.waitForFunction(
							() => !document.querySelector("astro-island[ssr]"),
						);
						await page.evaluate(() => document.fonts.ready);
						await page.evaluate(async () => {
							const finite = document
								.getAnimations()
								.filter(
									(animation) =>
										animation.effect?.getComputedTiming().iterations !==
										Infinity,
								);
							await Promise.all(
								finite.map((animation) =>
									animation.finished.catch(() => undefined),
								),
							);
						});
						await page.evaluate(axe.source);
						const { violations, incomplete } = await page.evaluate(() =>
							window.axe.run(),
						);
						results.push({ path, width, violations, incomplete });
						process.stdout.write(
							`${width} ${path}: ${violations.length} violations, ${incomplete.length} need review\n`,
						);
						return nextPage();
					}
					await nextPage();
					await page.close();
				}),
			);
			await context.close();
		}),
	);
} finally {
	await browser?.close();
	await new Promise((r) => server.close(r));
	await writeFile(
		"accessibility-results.json",
		JSON.stringify(results, null, 2),
	);
}
if (results.some((r) => r.violations.length)) process.exitCode = 1;
