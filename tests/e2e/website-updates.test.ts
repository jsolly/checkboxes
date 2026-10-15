import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { test as it } from "node:test";
import { chromium } from "playwright";

it("Open gallery tabs choose when to reload after a deployment", async () => {
	const fixture = await mkdtemp(path.join(tmpdir(), "checkboxes-updates-"));
	const build = async (name: string) => {
		const result = spawnSync(process.execPath, ["scripts/build.mjs"], {
			encoding: "utf8",
		});
		assert.equal(result.status, 0, result.stdout + result.stderr);
		const destination = path.join(fixture, name);
		await cp("dist", destination, { recursive: true });
		return destination;
	};
	let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
	let server: ReturnType<typeof createServer> | undefined;
	try {
		const a = await build("a");
		const b = await build("b");
		const c = await build("c");
		const releaseA = JSON.parse(
			await readFile(path.join(a, "release.json"), "utf8"),
		).release;
		const releaseB = JSON.parse(
			await readFile(path.join(b, "release.json"), "utf8"),
		).release;
		assert.notEqual(releaseA, releaseB);
		let deployed = a;
		let releaseMode = "healthy";
		let releaseDiscovery: () => void = () => {};
		const discovery = new Promise<void>((resolve) => {
			releaseDiscovery = resolve;
		});
		const deployment = { mismatchedPage: false, staleNavigation: false };
		function shouldServeOldPage(
			state: typeof deployment,
			navigation: boolean,
		): boolean {
			return state.mismatchedPage || (state.staleNavigation && navigation);
		}
		server = createServer(async (request, response) => {
			const url = new URL(request.url ?? "/", "http://localhost");
			response.setHeader("Cache-Control", "no-store");
			if (url.pathname === "/release.json") await discovery;
			if (url.pathname === "/release.json" && releaseMode !== "healthy") {
				if (releaseMode === "unavailable") {
					response.writeHead(503).end();
					return;
				}
				response.setHeader("Content-Type", "application/json");
				response.end(releaseMode === "malformed" ? "{" : '{"release":42}');
				return;
			}
			const relative = url.pathname.endsWith("/")
				? `${url.pathname}index.html`
				: url.pathname;
			const root =
				shouldServeOldPage(
					deployment,
					request.headers["sec-fetch-dest"] === "document",
				) && relative.endsWith(".html")
					? a
					: deployed;
			const file = path.resolve(root, `.${relative}`);
			if (!file.startsWith(`${root}/`)) {
				response.writeHead(403).end();
				return;
			}
			try {
				// Model the host's retained immutable assets; never fall back for HTML or metadata.
				const candidates =
					relative.startsWith("/_astro/") ||
					relative.startsWith("/_measurements/")
						? [
								file,
								...[a, b, c].map((directory) =>
									path.resolve(directory, `.${relative}`),
								),
							]
						: [file];
				let data: Buffer | undefined;
				for (const candidate of candidates) {
					try {
						data = await readFile(candidate);
						break;
					} catch (error) {
						if (
							!(error instanceof Error) ||
							!("code" in error) ||
							error.code !== "ENOENT"
						)
							throw error;
					}
				}
				if (!data) {
					response.writeHead(404).end();
					return;
				}
				const mime: Record<string, string> = {
					".html": "text/html",
					".js": "text/javascript",
					".css": "text/css",
					".json": "application/json",
					".svg": "image/svg+xml",
				};
				response.setHeader(
					"Content-Type",
					mime[path.extname(file)] ?? "application/octet-stream",
				);
				response.end(data);
			} catch {
				response.writeHead(404).end();
			}
		});
		await new Promise<void>((resolve) =>
			server?.listen(0, "127.0.0.1", resolve),
		);
		const address = server.address();
		assert(address && typeof address !== "string");
		const origin = `http://127.0.0.1:${address.port}`;
		browser = await chromium.launch();
		const context = await browser.newContext();
		const first = await context.newPage();
		const second = await context.newPage();
		const errors: string[] = [];
		const consoleMessages: string[] = [];
		const missing: string[] = [];
		await first.clock.install();
		for (const page of [first, second]) {
			page.on("pageerror", (error) => errors.push(error.message));
			page.on("console", (message) => {
				if (message.type() === "error" || message.type() === "warning")
					consoleMessages.push(message.text());
			});
			page.on("response", (response) => {
				if (response.status() >= 400)
					missing.push(`${response.status()} ${response.url()}`);
			});
			await page.goto(origin);
			await page
				.locator("astro-island[ssr]")
				.first()
				.waitFor({ state: "detached" });
			assert.equal(
				await page.getByRole("button", { name: "Update and reload" }).count(),
				0,
			);
			await page
				.locator('[data-framework="vanillajs"] input[type="checkbox"]')
				.first()
				.check();
		}
		deployed = b;
		// The first release check returns B even though both documents embedded A.
		releaseDiscovery();
		const focus = async (page: typeof first) => {
			await page.clock.fastForward(1001);
			await page.evaluate(() => window.dispatchEvent(new Event("focus")));
		};
		for (const page of [first, second]) {
			await focus(page);
			await page.getByRole("button", { name: "Update and reload" }).waitFor();
			assert.equal(
				await page
					.locator('meta[name="website-release"]')
					.getAttribute("content"),
				releaseA,
			);
			assert(
				await page
					.locator('[data-framework="vanillajs"] input[type="checkbox"]')
					.first()
					.isChecked(),
			);
		}
		// Dismissal is per tab, retains selections, and does not suppress a later deployment.
		await second.getByRole("button", { name: "Later", exact: true }).focus();
		await second.keyboard.press("Enter");
		await second.waitForFunction(
			() => document.activeElement?.textContent === "Show available update",
		);
		await focus(second);
		assert.equal(
			await second.getByRole("button", { name: "Update and reload" }).count(),
			0,
		);
		assert(
			await second
				.locator('[data-framework="vanillajs"] input[type="checkbox"]')
				.first()
				.isChecked(),
		);
		await second
			.getByRole("button", { name: "Show available update" })
			.press("Enter");
		await second.waitForFunction(
			() => document.activeElement?.textContent === "Update and reload",
		);
		await second.getByRole("button", { name: "Update and reload" }).waitFor();
		await second.getByRole("button", { name: "Later", exact: true }).focus();
		await second.keyboard.press("Enter");
		await second.waitForFunction(
			() => document.activeElement?.textContent === "Show available update",
		);
		// Capture the real notice in both palettes and sizes before accepting the update.
		// biome-ignore lint/complexity/useLiteralKeys: Environment keys use an index signature.
		const evidence = process.env["UPDATE_EVIDENCE_DIR"];
		if (evidence) {
			for (const [name, width, height] of [
				["desktop", 1280, 900],
				["mobile", 390, 844],
			] as const) {
				await first.setViewportSize({ width, height });
				for (const colorScheme of ["light", "dark"] as const) {
					await first.emulateMedia({ colorScheme });
					await first.screenshot({
						path: path.join(evidence, `${name}-${colorScheme}.png`),
						fullPage: false,
					});
				}
			}
		}
		first.once("dialog", (dialog) => void dialog.dismiss());
		await first.getByRole("button", { name: "Update and reload" }).click();
		assert(
			await first
				.locator('[data-framework="vanillajs"] input[type="checkbox"]')
				.first()
				.isChecked(),
		);
		assert.equal(
			await first
				.locator('meta[name="website-release"]')
				.getAttribute("content"),
			releaseA,
		);
		first.on("dialog", (dialog) => void dialog.accept());
		await context.setOffline(true);
		await first.getByRole("button", { name: "Update and reload" }).click();
		await first.getByRole("alert").waitFor();
		await first.waitForFunction(
			() =>
				!document.querySelector<HTMLButtonElement>('[data-slot="button"]')
					?.disabled,
		);
		assert.equal(
			await first
				.locator('meta[name="website-release"]')
				.getAttribute("content"),
			releaseA,
		);
		await context.setOffline(false);
		for (const mode of ["unavailable", "malformed", "invalid-schema"]) {
			releaseMode = mode;
			await first.getByRole("button", { name: "Update and reload" }).click();
			await first.getByRole("alert").waitFor();
			await first.waitForFunction(
				() =>
					!document.querySelector<HTMLButtonElement>('[data-slot="button"]')
						?.disabled,
			);
			assert.equal(
				await first
					.locator('meta[name="website-release"]')
					.getAttribute("content"),
				releaseA,
			);
		}
		releaseMode = "healthy";
		deployment.mismatchedPage = true;
		await first.getByRole("button", { name: "Update and reload" }).click();
		await first.getByRole("alert").waitFor();
		await first.waitForFunction(
			() =>
				!document.querySelector<HTMLButtonElement>('[data-slot="button"]')
					?.disabled,
		);
		assert.equal(
			await first
				.locator('meta[name="website-release"]')
				.getAttribute("content"),
			releaseA,
		);
		deployment.mismatchedPage = false;
		deployment.staleNavigation = true;
		let navigations = 0;
		first.on("framenavigated", (frame) => {
			if (frame === first.mainFrame()) navigations++;
		});
		await Promise.all([
			first.waitForEvent("load"),
			first.getByRole("button", { name: "Update and reload" }).click(),
		]);
		await first.clock.resume();
		await first
			.waitForFunction(
				() => document.querySelectorAll("astro-island[ssr]").length === 0,
			)
			.catch(async (error: unknown) => {
				console.error("hydration diagnostics", {
					errors,
					consoleMessages,
					missing,
					islands: await first
						.locator("astro-island")
						.evaluateAll((elements) =>
							elements.map((e) => e.outerHTML.slice(0, 700)),
						),
				});
				throw error;
			});
		await first
			.getByRole("alert")
			.filter({ hasText: "still has the previous version" })
			.waitFor()
			.catch(async (error: unknown) => {
				console.error("stale navigation diagnostics", {
					navigations,
					errors,
					release: await first
						.locator('meta[name="website-release"]')
						.getAttribute("content"),
					notice: await first.locator("aside").allTextContents(),
					marker: await first.evaluate(() =>
						sessionStorage.getItem("checkboxes:update-attempt"),
					),
				});
				throw error;
			});
		assert.equal(navigations, 1);
		assert.equal(
			await first
				.locator('meta[name="website-release"]')
				.getAttribute("content"),
			releaseA,
		);
		await first.clock.fastForward(400000);
		await first.getByRole("button", { name: "Update and reload" }).waitFor();
		assert.equal(
			navigations,
			1,
			"stale HTML never triggers an automatic second reload",
		);
		deployment.staleNavigation = false;
		await first.getByRole("button", { name: "Update and reload" }).focus();
		await Promise.all([
			first.waitForEvent("load"),
			first.keyboard.press("Enter"),
		]);
		assert.equal(
			await first
				.locator('meta[name="website-release"]')
				.getAttribute("content"),
			releaseB,
		);
		await first
			.locator("astro-island[ssr]")
			.first()
			.waitFor({ state: "detached" });
		assert.equal(
			await first.getByRole("button", { name: "Update and reload" }).count(),
			0,
		);
		assert.equal(
			await second
				.locator('meta[name="website-release"]')
				.getAttribute("content"),
			releaseA,
		);
		assert(
			await second
				.locator('[data-framework="vanillajs"] input[type="checkbox"]')
				.first()
				.isChecked(),
		);
		deployed = c;
		await focus(second);
		await second.getByRole("button", { name: "Update and reload" }).waitFor();
		deployed = a;
		await focus(first);
		await first.getByRole("button", { name: "Update and reload" }).waitFor();
		assert.equal(
			await first
				.locator('meta[name="website-release"]')
				.getAttribute("content"),
			releaseB,
		);
		deployed = b;
		await second.goto(`${origin}/methodology/`);
		assert.equal(
			await second
				.locator('meta[name="website-release"]')
				.getAttribute("content"),
			releaseB,
		);
		await second.goto(`${origin}/test/vanillajs/`);
		assert.equal(
			await second.locator('meta[name="website-release"]').count(),
			0,
		);
		assert.equal(
			await second
				.locator('astro-island[component-url*="UpdateNotice"]')
				.count(),
			0,
		);
		assert.deepEqual(errors, []);
		assert.deepEqual(
			missing.filter(
				(message) =>
					!message.startsWith("503 ") || !message.endsWith("/release.json"),
			),
			[],
		);
		assert.deepEqual(
			consoleMessages.filter(
				(message) =>
					!message.includes("net::ERR_INTERNET_DISCONNECTED") &&
					!message.includes("status of 503"),
			),
			[],
		);
	} finally {
		await browser?.close();
		await new Promise<void>((resolve) =>
			server ? server.close(() => resolve()) : resolve(),
		);
		await rm(fixture, { recursive: true, force: true });
	}
});
