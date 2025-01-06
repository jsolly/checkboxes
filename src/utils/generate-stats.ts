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

function formatTime(ms: number): string {
	return `${(ms / 1000).toFixed(2)}s`;
}

function getMedian(numbers: number[]): number {
	const sorted = [...numbers].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);

	if (sorted.length % 2 === 0) {
		return (sorted[middle - 1] + sorted[middle]) / 2;
	}

	return sorted[middle];
}

async function measureFrameworkOnce(
	page: Page,
	framework: FrameworkId,
): Promise<{ renderTime: number; bundleSize: number }> {
	// Enable request interception
	const client = await page.createCDPSession();
	await client.send("Network.enable");

	let totalJsSize = 0;
	const jsFiles: JsFile[] = [];

	try {
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

		// Reset performance metrics before navigation
		await page.evaluate(() => {
			window.performance.clearResourceTimings();
		});

		await page.goto(`http://localhost:4321/test/${framework}`, {
			waitUntil: "networkidle0",
		});

		// Wait for framework to be ready
		await page
			.waitForFunction(() => window.frameworkReady === true, {
				timeout: 10000,
			})
			.catch(() => {
				console.warn(
					`⚠️ Framework ${framework} failed to signal ready state within 10s`,
				);
			});

		// Get timing measurements
		const timings = await page.evaluate(() => {
			const navigationEntry = performance.getEntriesByType(
				"navigation",
			)[0] as PerformanceNavigationTiming;

			return navigationEntry
				? {
						ttfb: Math.round(
							navigationEntry.responseStart - navigationEntry.requestStart,
						),
						domContentLoaded: Math.round(
							navigationEntry.domContentLoadedEventEnd -
								navigationEntry.startTime,
						),
						loadComplete: Math.round(
							navigationEntry.loadEventEnd - navigationEntry.startTime,
						),
						interactive: Math.round(
							navigationEntry.domInteractive - navigationEntry.startTime,
						),
						frameworkReady: window.frameworkReady ? performance.now() : null,
					}
				: {
						ttfb: 0,
						domContentLoaded: 0,
						loadComplete: 0,
						interactive: 0,
						frameworkReady: null,
					};
		});

		// Use framework ready time if available, fall back to interactive time
		const renderTime = Math.round(
			timings.frameworkReady ?? timings.interactive,
		);

		return {
			renderTime,
			bundleSize: Number((totalJsSize / 1024).toFixed(2)),
		};
	} finally {
		await client.detach();
	}
}

// Configuration
const MEASUREMENT_RUNS = 5;

async function measureFramework(
	page: Page,
	framework: FrameworkId,
): Promise<FrameworkStats> {
	console.log(
		`\n📦 Measuring ${framework} (${MEASUREMENT_RUNS} iterations)...`,
	);

	const measurements: { renderTime: number; bundleSize: number }[] = [];

	// Run measurements based on configuration
	for (let i = 1; i <= MEASUREMENT_RUNS; i++) {
		console.log(`\n  📊 Iteration ${i}/${MEASUREMENT_RUNS}...`);
		const result = await measureFrameworkOnce(page, framework);
		measurements.push(result);
		console.log(`    ⏱️  Render time: ${formatTime(result.renderTime)}`);
	}

	// Calculate median render time
	const medianRenderTime = getMedian(measurements.map((m) => m.renderTime));

	// Use the bundle size from the first measurement since it shouldn't vary
	const bundleSize = measurements[0].bundleSize;

	console.log(`\n📈 Results for ${framework}:`);
	console.log(
		`  🏃 All render times: ${measurements.map((m) => formatTime(m.renderTime)).join(", ")}`,
	);
	console.log(`  📊 Median render time: ${formatTime(medianRenderTime)}`);
	console.log(`  📦 Bundle size: ${bundleSize}kb`);

	return {
		renderTime: formatTime(medianRenderTime),
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

	// Round Z-scores to 2 decimal places
	const roundedStats = Object.fromEntries(
		Object.entries(statsWithZScores).map(([framework, stats]) => [
			framework,
			{
				...stats,
				renderTimeZScore: Number(stats.renderTimeZScore.toFixed(2)),
				bundleSizeZScore: Number(stats.bundleSizeZScore.toFixed(2)),
			},
		]),
	);

	// Write to JSON file
	const statsPath = path.join(process.cwd(), "src/data/framework-stats.json");
	await fs.writeFile(statsPath, JSON.stringify(roundedStats, null, 2));

	console.log("Stats generated successfully!");
}

// Only run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	generateStats().catch(console.error);
}

export { generateStats };
