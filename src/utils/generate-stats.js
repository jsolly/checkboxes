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

async function measureBundleSize(page) {
	return await page.evaluate(() => {
		const resources = performance.getEntriesByType("resource");
		const jsResources = resources.filter(
			(r) =>
				r.name.endsWith(".js") ||
				r.name.endsWith(".mjs") ||
				r.initiatorType === "script",
		);

		const totalBytes = jsResources.reduce((acc, resource) => {
			return acc + resource.encodedBodySize;
		}, 0);

		return `${(totalBytes / 1024).toFixed(1)}kb`;
	});
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

async function measureRenderTime(frameworkId) {
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

		// Add a small delay to ensure everything is loaded
		await page.waitForTimeout(1000);

		const renderTime = await page.evaluate(() => {
			const navigationEntry = performance.getEntriesByType("navigation")[0];
			const paintEntry = performance
				.getEntriesByType("paint")
				.find((entry) => entry.name === "first-contentful-paint");

			if (paintEntry) {
				return paintEntry.startTime;
			}

			return (
				navigationEntry.domContentLoadedEventEnd - navigationEntry.startTime
			);
		});

		const bundleSize = await measureBundleSize(page);

		return {
			renderTime: `${Math.round(renderTime)}ms`,
			bundleSize,
		};
	} finally {
		await browser.close();
	}
}

async function generateStats() {
	console.log("Starting development server...");
	const server = await startDevServer();

	try {
		const stats = {};

		for (const framework of FRAMEWORKS) {
			console.log(`Generating stats for ${framework}...`);

			const metrics = await measureRenderTime(framework);
			stats[framework] = metrics;

			// Save individual framework stats using the correct directory name
			const statsDir = join(
				process.cwd(),
				"src/components",
				FRAMEWORK_DIRS[framework],
			);

			// Create directory if it doesn't exist
			try {
				await fs.mkdir(statsDir, { recursive: true });
			} catch (err) {
				if (err.code !== "EEXIST") throw err;
			}

			await fs.writeFile(
				join(statsDir, "stats.json"),
				JSON.stringify(metrics, null, 2),
			);
		}

		// Create data directory if it doesn't exist
		const dataDir = join(process.cwd(), "src/data");
		try {
			await fs.mkdir(dataDir, { recursive: true });
		} catch (err) {
			if (err.code !== "EEXIST") throw err;
		}

		// Save all stats in one file
		await fs.writeFile(
			join(dataDir, "framework-stats.json"),
			JSON.stringify(stats, null, 2),
		);

		console.log("Stats generation complete!");
	} finally {
		// Ensure we kill the entire process group
		if (process.platform === "win32") {
			// Windows needs different handling
			spawn("taskkill", ["/pid", server.pid, "/f", "/t"]);
		} else {
			// Unix-like systems
			process.kill(-server.pid, "SIGKILL");
		}
		console.log("Development server stopped.");
	}
}

// Run the script
generateStats().catch((error) => {
	console.error(error);
	process.exit(1);
});
