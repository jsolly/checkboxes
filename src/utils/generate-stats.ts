import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page, Protocol } from "puppeteer";
import puppeteer from "puppeteer";
import { FRAMEWORKS, type FrameworkId } from "../config/frameworks";
import { type FrameworkStats, STATS_CONFIG } from "../config/stats";
import { calculateStatsZScores } from "./calculateZScores";
import { evaluateFrameworkComplexity } from "./evaluateComplexity";

interface CDPEvent {
	type: string;
	response: Protocol.Network.Response & {
		encodedDataLength: number;
	};
}

async function measureBundleSize(page: Page, framework: FrameworkId) {
	const measurements: number[] = [];

	for (let i = 0; i < STATS_CONFIG.BUNDLE_SIZE_ITERATIONS; i++) {
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

		// Wait for network idle after navigation
		await page.goto(`${STATS_CONFIG.PREVIEW_URL}/${framework}`, {
			waitUntil: "networkidle0",
		});

		await client.detach();

		measurements.push(
			Number((totalJsSize / 1024).toFixed(STATS_CONFIG.BUNDLE_SIZE_PRECISION)),
		);
		console.log(`    Run ${i + 1}: ${measurements[i]}kb`);
	}

	// Sort measurements and take the middle value
	measurements.sort((a, b) => a - b);
	const median =
		measurements[Math.floor(STATS_CONFIG.BUNDLE_SIZE_ITERATIONS / 2)];
	console.log(`    Median: ${median}kb`);

	return median;
}

async function readImplementationFile(id: FrameworkId): Promise<string> {
	for (const ext of STATS_CONFIG.SUPPORTED_EXTENSIONS) {
		try {
			const code = await fs.readFile(
				path.join(
					process.cwd(),
					STATS_CONFIG.COMPONENTS_DIR,
					id,
					`${id}Container${ext}`,
				),
				"utf-8",
			);
			return code;
		} catch {} // Empty catch is sufficient since we'll try next extension
	}
	throw new Error(`Could not find implementation for ${id}`);
}

async function generateStats(): Promise<void> {
	console.log("\n📊 Starting stats generation with config:");
	console.log(
		`  • Bundle size iterations: ${STATS_CONFIG.BUNDLE_SIZE_ITERATIONS}`,
	);
	console.log(
		`  • Complexity score iterations: ${STATS_CONFIG.COMPLEXITY_SCORE_ITERATIONS}`,
	);
	console.log(
		`  • Update complexity scores: ${STATS_CONFIG.UPDATE_COMPLEXITY_SCORES}\n`,
	);

	const browser = await puppeteer.launch();
	const page = await browser.newPage();
	const stats = {} as Record<FrameworkId, FrameworkStats>;
	const implementations = {} as Record<FrameworkId, string>;

	try {
		// Measure bundle sizes (unchanged)
		for (const id of Object.keys(FRAMEWORKS) as FrameworkId[]) {
			console.log(`📦 Measuring ${id}...`);
			const size = await measureBundleSize(page, id);
			console.log(`  Bundle size: ${size}kb`);

			// Use new readImplementationFile function
			const code = await readImplementationFile(id);

			stats[id] = {
				bundleSize: size,
				complexityScore: 0,
				bundleSizeZScore: 0,
				complexityZScore: 0,
			};
			implementations[id] = code;
		}

		// Load existing stats if not updating complexity scores
		if (!STATS_CONFIG.UPDATE_COMPLEXITY_SCORES) {
			try {
				const existingStats = JSON.parse(
					await fs.readFile(
						path.join(process.cwd(), STATS_CONFIG.STATS_FILE_PATH),
						"utf-8",
					),
				);
				// Keep existing complexity scores but use new bundle sizes
				for (const id of Object.keys(stats)) {
					stats[id as FrameworkId].complexityScore =
						existingStats[id]?.complexityScore ?? 0;
				}
				console.log("ℹ️ Using existing complexity scores");
			} catch (error) {
				console.warn("⚠️ Could not load existing complexity scores");
			}
		}

		// Only run complexity evaluation if flag is true
		if (STATS_CONFIG.UPDATE_COMPLEXITY_SCORES) {
			const complexityMeasurements: Record<string, number[]> = {};

			// Initialize arrays for each framework
			for (const id of Object.keys(implementations)) {
				complexityMeasurements[id] = [];
			}

			// Run complexity evaluation iterations times
			for (let i = 0; i < STATS_CONFIG.COMPLEXITY_SCORE_ITERATIONS; i++) {
				console.log(`📊 Evaluating complexity - Run ${i + 1}...`);
				const { scores } = await evaluateFrameworkComplexity(implementations);

				for (const [id, score] of Object.entries(scores)) {
					complexityMeasurements[id].push(score);
				}
			}

			// Calculate median scores for each framework
			for (const id of Object.keys(implementations)) {
				const measurements = complexityMeasurements[id].sort((a, b) => a - b);
				const median =
					measurements[
						Math.floor(STATS_CONFIG.COMPLEXITY_SCORE_ITERATIONS / 2)
					];
				stats[id as FrameworkId].complexityScore = median;
				console.log(`    ${id} complexity score: ${median}`);
			}
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

// Simplify CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	generateStats().catch(console.error);
}

export { generateStats };
