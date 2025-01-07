import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page, Protocol } from "puppeteer";
import puppeteer from "puppeteer";
import { FRAMEWORKS, type FrameworkId } from "../config/frameworks";
import type { FrameworkStats } from "../types/stats";
import { calculateStatsZScores } from "./calculateZScores";
import { evaluateFrameworkComplexity } from "./evaluateComplexity";

interface CDPEvent {
	type: string;
	response: Protocol.Network.Response & {
		encodedDataLength: number;
	};
}

async function measureBundleSize(page: Page, framework: FrameworkId) {
	const iterations = 5;
	const measurements: number[] = [];

	for (let i = 0; i < iterations; i++) {
		const client = await page.createCDPSession();

		// Clear browser cache
		await page.setCacheEnabled(false);
		await client.send("Network.clearBrowserCache");
		await client.send("Network.clearBrowserCookies");

		await client.send("Network.enable");

		let totalJsSize = 0;
		client.on("Network.responseReceived", (event: CDPEvent) => {
			if (event.type === "Script") {
				totalJsSize += event.response.encodedDataLength;
			}
		});

		await page.goto(`http://localhost:4321/test/${framework}`);
		await client.detach();

		measurements.push(Number((totalJsSize / 1024).toFixed(2)));
		console.log(`    Run ${i + 1}: ${measurements[i]}kb`);
	}

	// Sort measurements and take the middle value
	measurements.sort((a, b) => a - b);
	const median = measurements[Math.floor(iterations / 2)];
	console.log(`    Median: ${median}kb`);

	return median;
}

async function generateStats(): Promise<void> {
	const browser = await puppeteer.launch();
	const page = await browser.newPage();
	const stats = {} as Record<FrameworkId, FrameworkStats>;
	const implementations = {} as Record<FrameworkId, string>;
	const iterations = 5;

	try {
		// Gather implementations and measure bundle sizes
		for (const id of Object.keys(FRAMEWORKS) as FrameworkId[]) {
			console.log(`📦 Measuring ${id}...`);

			// Measure bundle size
			const size = await measureBundleSize(page, id);
			console.log(`  Bundle size: ${size}kb`);

			// Read implementation
			const code = await fs
				.readFile(
					path.join(process.cwd(), "src/components", id, `${id}Container.tsx`),
				)
				.catch(() =>
					fs.readFile(
						path.join(
							process.cwd(),
							"src/components",
							id,
							`${id}Container.astro`,
						),
					),
				);

			if (!code) {
				throw new Error(`Could not find implementation for ${id}`);
			}

			stats[id] = {
				bundleSize: size,
				complexityScore: 0,
				bundleSizeZScore: 0,
				complexityZScore: 0,
			};
			implementations[id] = code.toString();
		}

		// Evaluate complexity multiple times and take median
		const complexityMeasurements: Record<string, number[]> = {};

		// Initialize arrays for each framework
		for (const id of Object.keys(implementations)) {
			complexityMeasurements[id] = [];
		}

		// Run complexity evaluation iterations times
		for (let i = 0; i < iterations; i++) {
			console.log(`📊 Evaluating complexity - Run ${i + 1}...`);
			const { scores } = await evaluateFrameworkComplexity(implementations);

			for (const [id, score] of Object.entries(scores)) {
				complexityMeasurements[id].push(score);
			}
		}

		// Calculate median scores for each framework
		for (const id of Object.keys(implementations)) {
			const measurements = complexityMeasurements[id].sort((a, b) => a - b);
			const median = measurements[Math.floor(iterations / 2)]; // Use same median calculation as measureBundleSize
			stats[id as FrameworkId].complexityScore = median;
			console.log(`    ${id} complexity score: ${median}`);
		}

		await fs.writeFile(
			path.join(process.cwd(), "src/data/framework-stats.json"),
			JSON.stringify(calculateStatsZScores(stats), null, 2),
		);

		console.log("✨ Stats generated successfully!");
	} finally {
		await browser.close();
	}
}

// Only run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	generateStats().catch(console.error);
}

export { generateStats };
