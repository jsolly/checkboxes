import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { gzip } from "node:zlib";
import { chromium } from "playwright";
import { calculateStatsZScores } from "./calculateZScores.js";

/**
 * @typedef {Object} FrameworkStats
 * @property {string} renderTime
 * @property {string} [bundleSize]
 * @property {number} renderTimeZScore
 * @property {number} [bundleSizeZScore]
 */

const FRAMEWORKS = [
	"vanilla-js",
	"alpine",
	"vue",
	"react",
	"svelte",
	"hyperscript",
	"css-only",
	"jquery",
];

const gzipAsync = promisify(gzip);

async function measureBundleSizes() {
	const sizes = {};

	// Get the build output
	const buildOutput = await new Promise((resolve) => {
		let output = "";
		const build = spawn("pnpm", ["build"], {
			shell: true,
			stdio: ["inherit", "pipe", "inherit"],
		});

		build.stdout.on("data", (data) => {
			output += data.toString();
		});

		build.on("close", () => {
			resolve(output);
		});
	});

	// Parse bundle sizes for each framework
	const bundleRegex =
		/(?:runtime-dom|react|svelte|client).*?\.js.*?gzip:\s*(\d+\.\d+)\s*kB/g;
	let match = bundleRegex.exec(buildOutput);
	while (match) {
		const size = match[1];
		if (buildOutput.includes("runtime-dom")) {
			sizes.vue = `${size}kb`;
		} else if (buildOutput.includes("react")) {
			sizes.react = `${size}kb`;
		} else if (buildOutput.includes("svelte")) {
			sizes.svelte = `${size}kb`;
		} else if (buildOutput.includes("alpine")) {
			sizes.alpine = `${size}kb`;
		}
		match = bundleRegex.exec(buildOutput);
	}

	// Special handling for vanilla JS - measure the inline script
	const vanillaPath = join(
		process.cwd(),
		"src/components/vanilla-js/vanilla.astro",
	);
	const vanillaContent = await fs.readFile(vanillaPath, "utf-8");
	const scriptMatch = vanillaContent.match(/<script[^>]*>([\s\S]*?)<\/script>/);
	if (!scriptMatch) {
		console.warn("No script tag found in vanilla.astro");
		sizes["vanilla-js"] = "0kb";
	} else {
		const scriptContent = scriptMatch[1].trim(); // Get the script content only
		const gzipped = await gzipAsync(Buffer.from(scriptContent));
		const gzipSize = (gzipped.length / 1024).toFixed(1);
		sizes["vanilla-js"] = `${gzipSize}kb`;
	}

	// Ensure all frameworks have a size
	for (const framework of FRAMEWORKS) {
		if (!sizes[framework]) {
			sizes[framework] = "0kb";
		}
	}

	// Special handling for jQuery - measure the minified script
	const jqueryPath = join(process.cwd(), "src/scripts/jquery.min.js");
	const jqueryContent = await fs.readFile(jqueryPath, "utf-8");
	const gzippedJquery = await gzipAsync(Buffer.from(jqueryContent));
	const jquerySize = (gzippedJquery.length / 1024).toFixed(1);
	sizes.jquery = `${jquerySize}kb`;

	// Special handling for Hyperscript - measure the minified script
	const hyperscriptPath = join(process.cwd(), "src/scripts/hyperscript.min.js");
	const hyperscriptContent = await fs.readFile(hyperscriptPath, "utf-8");
	const gzippedHyperscript = await gzipAsync(Buffer.from(hyperscriptContent));
	const hyperscriptSize = (gzippedHyperscript.length / 1024).toFixed(1);
	sizes.hyperscript = `${hyperscriptSize}kb`;

	// Add zero size for css-only
	sizes["css-only"] = "0kb";

	return sizes;
}

async function startDevServer() {
	// Wait for server to be ready
	return new Promise((resolve, reject) => {
		const server = spawn("pnpm", ["dev"], {
			shell: true,
			detached: true,
			stdio: ["inherit", "pipe", "inherit"],
		});

		let output = "";
		server.stdout.on("data", (data) => {
			output += data.toString();
			// Check if server is ready
			if (output.includes("Local    http://localhost:4321")) {
				// Give it a moment to fully initialize
				setTimeout(() => resolve(server), 1000);
			}
		});

		server.on("error", reject);

		// Set a timeout in case server doesn't start
		setTimeout(() => {
			reject(new Error("Server failed to start within timeout"));
		}, 30000);
	});
}

async function measureRenderTime(frameworkId, server) {
	const MAX_RETRIES = 3;
	let lastError;

	for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
		try {
			const browser = await chromium.launch();
			const page = await browser.newPage();

			try {
				await page.evaluate(() => {
					performance.clearResourceTimings();
					performance.clearMarks();
					performance.clearMeasures();
				});

				await page.goto(`http://localhost:4321/test/${frameworkId}`, {
					waitUntil: "networkidle",
					timeout: 30000,
				});

				await page.waitForTimeout(1000);

				const renderTime = await page.evaluate(() => {
					const navigationEntry = performance.getEntriesByType("navigation")[0];
					const paintEntry = performance
						.getEntriesByType("paint")
						?.find?.((entry) => entry?.name === "first-contentful-paint");

					if (paintEntry) {
						return paintEntry.startTime;
					}

					return (
						navigationEntry.domContentLoadedEventEnd - navigationEntry.startTime
					);
				});

				// Validate the render time
				if (!renderTime || renderTime < 0 || renderTime > 10000) {
					throw new Error(
						`Invalid render time for ${frameworkId}: ${renderTime}ms`,
					);
				}

				return renderTime;
			} finally {
				await browser.close();
			}
		} catch (error) {
			lastError = error;
			console.warn(
				`Attempt ${attempt} failed for ${frameworkId}: ${error.message}`,
			);
			if (attempt === MAX_RETRIES) throw lastError;
			await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
		}
	}
}

async function cleanup(server) {
	if (!server) return;
	try {
		if (process.platform === "win32") {
			await spawn("taskkill", ["/pid", server.pid, "/f", "/t"]);
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
		// Get all bundle sizes first
		console.log("Building and measuring bundle sizes...");
		const bundleSizes = await measureBundleSizes();
		/** @type {StatsMap} */
		const stats = {};

		// Initialize stats with bundle sizes
		for (const framework of FRAMEWORKS) {
			stats[framework] = {
				renderTime: "0ms",
				bundleSize: bundleSizes[framework],
				renderTimeZScore: 0,
				bundleSizeZScore: 0,
			};
		}

		// Write initial stats file
		await fs.mkdir(join(process.cwd(), "src/data"), { recursive: true });
		await fs.writeFile(
			"src/data/framework-stats.json",
			JSON.stringify(stats, null, 2),
		);

		console.log("Starting development server...");
		server = await startDevServer();
		console.log("Server started successfully");

		for (const framework of FRAMEWORKS) {
			console.log(`Measuring render time for ${framework}...`);

			const renderTime = await measureRenderTime(framework, server);
			stats[framework] = {
				...stats[framework],
				renderTime: `${Math.round(renderTime)}ms`,
			};
		}

		// Add Z-scores to the stats
		const statsWithZScores = calculateStatsZScores(stats);

		// Write the combined stats file
		await fs.writeFile(
			"src/data/framework-stats.json",
			JSON.stringify(statsWithZScores, null, 2),
		);

		console.log("Stats generation complete!");
	} finally {
		await cleanup(server);
	}
}

// Run the script
generateStats().catch((error) => {
	console.error(error);
	process.exit(1);
});
