import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const FRAMEWORKS = [
	"vanilla",
	"alpine",
	"vue",
	"react",
	"svelte",
	"hyperscript",
	"css-only",
	"jquery",
];

const FRAMEWORK_DIRS = {
	vanilla: "vanilla-js",
	alpine: "alpine",
	vue: "vue",
	react: "react",
	svelte: "svelte",
	hyperscript: "hyperscript",
	"css-only": "css-only",
	jquery: "jquery",
};

async function measureBundleSizes() {
	// Capture the build output
	let buildOutput = "";
	await new Promise((resolve, reject) => {
		const build = spawn("pnpm", ["build"], {
			shell: true,
			stdio: ["inherit", "pipe", "inherit"],
		});

		// Handle process errors
		build.on("error", (error) => {
			reject(new Error(`Build process failed: ${error.message}`));
		});

		build.stdout.on("data", (data) => {
			buildOutput += data.toString();
		});

		build.on("close", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`Build failed with code ${code}`));
		});
	});

	// Parse the build output to find framework bundles
	const bundleMap = {
		vue: [
			/runtime-dom.*\.js.*?gzip:\s*(\d+\.\d+)\s*kB/,
			/vue\..*\.js.*?gzip:\s*(\d+\.\d+)\s*kB/,
			/NestedCheckboxes\.DR.*\.js.*?gzip:\s*(\d+\.\d+)\s*kB/,
		],
		react: [
			/jsx-runtime.*\.js.*?gzip:\s*(\d+\.\d+)\s*kB/,
			/NestedCheckboxes\.CN.*\.js.*?gzip:\s*(\d+\.\d+)\s*kB/,
			/client\.BON.*\.js.*?gzip:\s*(\d+\.\d+)\s*kB/,
		],
		svelte: [
			/client\.svelte.*\.js.*?gzip:\s*(\d+\.\d+)\s*kB/,
			/NestedCheckboxes\.DRh.*\.js.*?gzip:\s*(\d+\.\d+)\s*kB/,
		],
		alpine: [
			/client\.BA2.*\.js.*?gzip:\s*(\d+\.\d+)\s*kB/,
			/alpine\..*\.js.*?gzip:\s*(\d+\.\d+)\s*kB/,
		],
		hyperscript: [/hyperscriptContainer.*\.js.*?gzip:\s*(\d+\.\d+)\s*kB/],
	};

	// Calculate sizes for all frameworks at once
	const sizes = {};
	for (const [framework, patterns] of Object.entries(bundleMap)) {
		let totalSize = 0;
		for (const pattern of patterns) {
			const match = buildOutput.match(pattern);
			if (match?.[1]) {
				totalSize += Number.parseFloat(match[1]);
			}
		}
		sizes[framework] = totalSize > 0 ? `${totalSize.toFixed(1)}kb` : "0kb";
	}

	// Add zero sizes for frameworks without JS bundles
	sizes.jquery = "0kb";
	sizes.vanilla = "0kb";
	sizes["css-only"] = "0kb";

	return sizes;
}

function startDevServer() {
	return new Promise((resolve, reject) => {
		const server = spawn("pnpm", ["dev"], {
			stdio: "inherit",
			shell: true,
			detached: true,
		});

		// Wait for server to be ready
		const checkServer = async () => {
			try {
				const response = await fetch("http://localhost:4321");
				if (response.ok) {
					resolve(server);
				} else {
					setTimeout(checkServer, 1000);
				}
			} catch (e) {
				setTimeout(checkServer, 1000);
			}
		};

		// Initial check after 2 seconds to give server time to start
		setTimeout(checkServer, 2000);

		server.on("error", (err) => {
			reject(err);
		});
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

				await page.goto(`http://localhost:4321/?framework=${frameworkId}`, {
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
	console.log("Starting development server...");
	const server = await startDevServer();

	try {
		// Get all bundle sizes first
		console.log("Building and measuring bundle sizes...");
		const bundleSizes = await measureBundleSizes();
		const stats = {};

		for (const framework of FRAMEWORKS) {
			console.log(`Measuring render time for ${framework}...`);

			const renderTime = await measureRenderTime(framework, server);
			stats[framework] = {
				renderTime: `${Math.round(renderTime)}ms`,
				bundleSize: bundleSizes[framework],
			};

			// Save individual framework stats
			const statsDir = join(
				process.cwd(),
				"src/components",
				FRAMEWORK_DIRS[framework],
			);

			try {
				await fs.mkdir(statsDir, { recursive: true });
			} catch (err) {
				if (err.code !== "EEXIST") throw err;
			}

			await fs.writeFile(
				join(statsDir, "stats.json"),
				JSON.stringify(stats[framework], null, 2),
			);
		}

		// Create data directory and save all stats
		const dataDir = join(process.cwd(), "src/data");
		try {
			await fs.mkdir(dataDir, { recursive: true });
		} catch (err) {
			if (err.code !== "EEXIST") throw err;
		}

		await fs.writeFile(
			join(dataDir, "framework-stats.json"),
			JSON.stringify(stats, null, 2),
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
