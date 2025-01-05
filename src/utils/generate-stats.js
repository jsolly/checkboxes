import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { promisify } from "node:util";
import { gzip } from "node:zlib";
import { chromium } from "playwright";
import { calculateStatsZScores } from "./calculateZScores.js";
import { CONFIG, FRAMEWORKS } from "./config.js";

const gzipAsync = promisify(gzip);

async function getBuildOutput() {
	return new Promise((resolve) => {
		let output = "";
		const build = spawn("pnpm", ["build"], {
			shell: true,
			stdio: ["inherit", "pipe", "inherit"],
		});

		build.stdout.on("data", (data) => {
			output += data.toString();
		});

		build.on("close", () => resolve(output));
	});
}

async function getGzippedSize(content) {
	const gzipped = await gzipAsync(Buffer.from(content));
	return `${(gzipped.length / 1024).toFixed(1)}kb`;
}

async function parseFrameworkSizes(buildOutput) {
	const sizes = {};
	const bundleRegex = /dist\/_astro\/.*?\.js\s+.*?│\s*gzip:\s*(\d+\.\d+)\s*kB/g;

	// Keep track of framework bundle sizes
	const frameworkBundles = {
		react: [],
		vue: [],
		svelte: [],
	};

	let match = bundleRegex.exec(buildOutput);
	// Debug: Log all bundle lines
	console.log(
		"All bundle lines:",
		buildOutput
			.split("\n")
			.filter((line) => line.includes("dist/_astro/"))
			.map((line) => line.trim()),
	);

	while (match) {
		const size = Number.parseFloat(match[1]);
		const line = buildOutput.split("\n").find((l) => l.includes(match[0]));
		if (line) {
			// React bundles
			if (
				line.includes("ReactNestedCheckboxes") ||
				line.includes("jsx-runtime") ||
				(line.includes("client") && line.includes("177.92 kB"))
			) {
				frameworkBundles.react.push(size);
			}
			// Vue bundles
			else if (
				line.includes("VueNestedCheckboxes") ||
				line.includes("runtime-dom.esm-bundler")
			) {
				frameworkBundles.vue.push(size);
			}
			// Svelte bundles
			else if (
				line.includes("SvelteNestedCheckboxes") ||
				(line.includes("client") && line.includes("svelte"))
			) {
				frameworkBundles.svelte.push(size);
			}
		}
		match = bundleRegex.exec(buildOutput);
	}

	// Debug log to see which bundles were found
	console.log("Framework bundles found:", {
		react: frameworkBundles.react,
		vue: frameworkBundles.vue,
		svelte: frameworkBundles.svelte,
	});

	// Sum up the bundle sizes for each framework
	for (const [framework, bundles] of Object.entries(frameworkBundles)) {
		if (bundles.length > 0) {
			const total = bundles.reduce((sum, size) => sum + size, 0);
			sizes[framework] = `${total.toFixed(1)}kb`;
		}
	}

	return sizes;
}

async function measureBundleSizes() {
	const buildOutput = await getBuildOutput();
	const sizes = await parseFrameworkSizes(buildOutput);

	// Handle Alpine.js from node_modules
	const alpineContent = await fs.readFile(
		"node_modules/alpinejs/dist/cdn.min.js",
		"utf-8",
	);
	sizes.alpine = await getGzippedSize(alpineContent);

	// Set CSS-only bundle size to 0kb since it has no JavaScript
	sizes["css-only"] = "0kb";

	// Handle vanilla JS
	const vanillaContent = await fs.readFile(
		CONFIG.paths.vanillaComponent,
		"utf-8",
	);
	const scriptMatch = vanillaContent.match(/<script[^>]*>([\s\S]*?)<\/script>/);
	sizes["vanilla-js"] = scriptMatch
		? await getGzippedSize(scriptMatch[1].trim())
		: "0kb";

	// Handle special cases
	const jqueryContent = await fs.readFile(CONFIG.paths.scripts.jquery, "utf-8");
	sizes.jquery = await getGzippedSize(jqueryContent);

	const hyperscriptContent = await fs.readFile(
		CONFIG.paths.scripts.hyperscript,
		"utf-8",
	);
	sizes.hyperscript = await getGzippedSize(hyperscriptContent);

	// Log bundle sizes for debugging
	console.log("Bundle sizes:", sizes);

	return sizes;
}

async function startDevServer() {
	return new Promise((resolve, reject) => {
		const server = spawn("pnpm", ["dev"], {
			shell: true,
			detached: true,
			stdio: ["inherit", "pipe", "inherit"],
		});

		let output = "";
		server.stdout.on("data", (data) => {
			output += data.toString();
			if (output.includes(`Local    http://localhost:${CONFIG.server.port}`)) {
				setTimeout(() => resolve(server), CONFIG.server.initializationDelay);
			}
		});

		server.on("error", reject);
		setTimeout(() => {
			reject(new Error("Server failed to start within timeout"));
		}, CONFIG.server.startupTimeout);
	});
}

async function measureRenderTime(frameworkId) {
	for (let attempt = 1; attempt <= CONFIG.measurement.maxRetries; attempt++) {
		const browser = await chromium.launch();
		try {
			const page = await browser.newPage();
			await page.evaluate(() => {
				performance.clearResourceTimings();
				performance.clearMarks();
				performance.clearMeasures();
			});

			await page.goto(
				`http://localhost:${CONFIG.server.port}/test/${frameworkId}`,
				{
					waitUntil: "networkidle",
					timeout: 30000,
				},
			);

			await page.waitForTimeout(CONFIG.measurement.waitTimeout);

			const renderTime = await page.evaluate(() => {
				const navigationEntry = performance.getEntriesByType("navigation")[0];
				const paintEntry = performance
					.getEntriesByType("paint")
					?.find((entry) => entry?.name === "first-contentful-paint");

				return (
					paintEntry?.startTime ??
					navigationEntry.domContentLoadedEventEnd - navigationEntry.startTime
				);
			});

			if (
				!renderTime ||
				renderTime < 0 ||
				renderTime > CONFIG.measurement.maxRenderTime
			) {
				throw new Error(`Invalid render time: ${renderTime}ms`);
			}

			return renderTime;
		} catch (error) {
			console.warn(
				`Attempt ${attempt} failed for ${frameworkId}: ${error.message}`,
			);
			if (attempt === CONFIG.measurement.maxRetries) throw error;
			await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
		} finally {
			await browser.close();
		}
	}
}

async function cleanup(server) {
	if (!server) return;
	try {
		if (process.platform === "win32") {
			spawn("taskkill", ["/pid", server.pid, "/f", "/t"]);
		} else {
			process.kill(-server.pid, "SIGKILL");
		}
		console.log("Development server stopped.");
	} catch (error) {
		console.warn("Failed to stop development server:", error);
	}
}

async function generateStats() {
	let server;
	try {
		console.log("Building and measuring bundle sizes...");
		const bundleSizes = await measureBundleSizes();

		const stats = Object.fromEntries(
			FRAMEWORKS.map((framework) => [
				framework,
				{
					renderTime: "0ms",
					bundleSize: bundleSizes[framework],
					renderTimeZScore: 0,
					bundleSizeZScore: 0,
				},
			]),
		);

		await fs.mkdir(CONFIG.paths.dataDir, { recursive: true });
		await fs.writeFile(
			CONFIG.paths.statsOutput,
			JSON.stringify(stats, null, 2),
		);

		console.log("Starting development server...");
		server = await startDevServer();
		console.log("Server started successfully");

		for (const framework of FRAMEWORKS) {
			console.log(`Measuring render time for ${framework}...`);
			const renderTime = await measureRenderTime(framework);
			stats[framework].renderTime = `${Math.round(renderTime)}ms`;
		}

		const statsWithZScores = calculateStatsZScores(stats);
		await fs.writeFile(
			CONFIG.paths.statsOutput,
			JSON.stringify(statsWithZScores, null, 2),
		);

		console.log("Stats generation complete!");
	} finally {
		await cleanup(server);
	}
}

generateStats().catch((error) => {
	console.error("Stats generation failed:", error);
	process.exit(1);
});
