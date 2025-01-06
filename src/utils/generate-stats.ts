import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer, { type Page, type Protocol } from "puppeteer";
import { FRAMEWORKS, type FrameworkId } from "../config/frameworks";
import { calculateStatsZScores } from "./calculateZScores";

const frameworkIds = Object.keys(FRAMEWORKS) as FrameworkId[];

interface JsFile {
	url: string;
	size: string;
}

interface FrameworkStats {
	renderTime: string;
	bundleSize: string;
}

interface CDPResponseEvent {
	type: string;
	response: Protocol.Network.Response & {
		encodedDataLength: number;
	};
}

async function measureFramework(
	page: Page,
	framework: FrameworkId,
): Promise<FrameworkStats> {
	// Enable request interception
	const client = await page.createCDPSession();
	await client.send("Network.enable");

	let totalJsSize = 0;
	const jsFiles: JsFile[] = [];

	client.on("Network.responseReceived", (event: CDPResponseEvent) => {
		if (event.type === "Script") {
			const size = event.response.encodedDataLength;
			totalJsSize += size;
			jsFiles.push({
				url: event.response.url,
				size: `${(size / 1024).toFixed(2)}kb`,
			});
		}
	});

	// Navigate to the framework's test page and measure render time
	console.log(`\n📦 Loading ${framework}...`);

	// Reset performance metrics before navigation
	await page.evaluate(() => {
		window.performance.clearResourceTimings();
	});

	await page.goto(`http://localhost:4321/test/${framework}`, {
		waitUntil: "networkidle0",
	});

	// Get more accurate render timing
	const timings = await page.evaluate(() => {
		const navigationEntry = performance.getEntriesByType(
			"navigation",
		)[0] as PerformanceNavigationTiming;

		if (navigationEntry) {
			return {
				// Time to first byte (server response time)
				ttfb: Math.round(
					navigationEntry.responseStart - navigationEntry.requestStart,
				),

				// DOM Content Loaded (initial HTML parsed)
				domContentLoaded: Math.round(
					navigationEntry.domContentLoadedEventEnd - navigationEntry.startTime,
				),

				// Full page load (including all resources)
				loadComplete: Math.round(
					navigationEntry.loadEventEnd - navigationEntry.startTime,
				),

				// DOM Interactive (HTML parsed, can start interacting)
				interactive: Math.round(
					navigationEntry.domInteractive - navigationEntry.startTime,
				),
			};
		}
		return {
			ttfb: 0,
			domContentLoaded: 0,
			loadComplete: 0,
			interactive: 0,
		};
	});

	console.log("\nTiming metrics:");
	console.log(`  Time to First Byte: ${timings.ttfb}ms`);
	console.log(`  DOM Content Loaded: ${timings.domContentLoaded}ms`);
	console.log(`  DOM Interactive: ${timings.interactive}ms`);
	console.log(`  Load Complete: ${timings.loadComplete}ms`);

	// Use domContentLoaded as the primary render time metric
	const renderTime = timings.domContentLoaded;

	console.log(`Render time: ${renderTime}ms`);

	// Log all JavaScript files
	console.log("\nJavaScript files loaded:");
	for (const { url, size } of jsFiles) {
		console.log(`  ${size.padEnd(8)} ${url}`);
	}
	console.log(`\nTotal JS size: ${(totalJsSize / 1024).toFixed(2)}kb`);

	const bundleSize = (totalJsSize / 1024).toFixed(2);

	return {
		renderTime: `${renderTime}ms`,
		bundleSize: `${bundleSize}kb`,
	};
}

async function generateStats(): Promise<void> {
	const browser = await puppeteer.launch();
	const page = await browser.newPage();

	const stats: Record<FrameworkId, FrameworkStats> = {} as Record<
		FrameworkId,
		FrameworkStats
	>;

	for (const framework of frameworkIds) {
		console.log(`Measuring ${framework}...`);
		stats[framework] = await measureFramework(page, framework);
	}

	await browser.close();

	// Calculate Z-scores
	const statsWithZScores = calculateStatsZScores(stats);

	// Write to JSON file
	const statsPath = path.join(process.cwd(), "src/data/framework-stats.json");
	await fs.writeFile(statsPath, JSON.stringify(statsWithZScores, null, 2));

	console.log("Stats generated successfully!");
}

// Only run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	generateStats().catch(console.error);
}

export { generateStats };
