import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as dotenv from "dotenv";
import type { Page, Protocol } from "puppeteer";
import puppeteer from "puppeteer";
import { FRAMEWORKS, type FrameworkId } from "../config/frameworks";
import {
	type FrameworkStats,
	STATS_CONFIG,
	type StatsFile,
} from "../config/stats";
import { calculateStatsZScores } from "./calculateZScores";
import { evaluateFrameworkComplexity } from "./evaluateComplexity";

dotenv.config({ path: ".env.local" });
dotenv.config();

interface CDPEvent {
	type: string;
	response: Protocol.Network.Response & {
		encodedDataLength: number;
	};
}

function calculateMedian(measurements: number[]): number {
	const sorted = [...measurements].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 !== 0
		? sorted[mid] // Odd number of measurements: take middle value
		: (sorted[mid - 1] + sorted[mid]) / 2; // Even number: average middle two
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

	const median = calculateMedian(measurements);
	console.log(`    Median bundle size: ${median}kb`);

	return median;
}

async function readImplementationFile(id: FrameworkId): Promise<string> {
	const dirPath = path.join(process.cwd(), STATS_CONFIG.COMPONENTS_DIR, id);
	const files = await fs.readdir(dirPath);
	const containerFile = files.find(
		(f) =>
			f.toLowerCase().includes("container") &&
			STATS_CONFIG.SUPPORTED_EXTENSIONS.some((ext) => f.endsWith(ext)),
	);
	if (!containerFile) {
		throw new Error(`Could not find implementation for ${id}`);
	}
	return fs.readFile(path.join(dirPath, containerFile), "utf-8");
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

		const hasApiKey = !!process.env.GEMINI_API_KEY;
		const shouldUpdateComplexity =
			STATS_CONFIG.UPDATE_COMPLEXITY_SCORES && hasApiKey;

		if (STATS_CONFIG.UPDATE_COMPLEXITY_SCORES && !hasApiKey) {
			console.warn(
				"⚠️ GEMINI_API_KEY not set — skipping complexity evaluation, using existing scores",
			);
		}

		if (!shouldUpdateComplexity) {
			try {
				const existingStats = JSON.parse(
					await fs.readFile(
						path.join(process.cwd(), STATS_CONFIG.STATS_FILE_PATH),
						"utf-8",
					),
				) as StatsFile;

				for (const id of Object.keys(stats) as FrameworkId[]) {
					stats[id].complexityScore =
						existingStats.frameworks[id]?.complexityScore ?? 0;
				}
				console.log("ℹ️ Using existing complexity scores");
			} catch (error) {
				console.warn("⚠️ Could not load existing complexity scores");
			}
		}

		if (shouldUpdateComplexity) {
			const complexityMeasurements: Record<string, number[]> = {};

			for (const id of Object.keys(implementations) as FrameworkId[]) {
				complexityMeasurements[id] = [];
			}

			for (let i = 0; i < STATS_CONFIG.COMPLEXITY_SCORE_ITERATIONS; i++) {
				console.log(`📊 Evaluating complexity - Run ${i + 1}...`);
				try {
					const { scores } = await evaluateFrameworkComplexity(implementations);

					for (const [id, score] of Object.entries(scores)) {
						complexityMeasurements[id].push(score);
					}
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					if (
						message.includes("429") ||
						message.includes("RESOURCE_EXHAUSTED")
					) {
						console.warn(
							"⚠️ Gemini API rate limit hit — using scores collected so far",
						);
						break;
					}
					throw error;
				}
			}

			for (const id of Object.keys(implementations) as FrameworkId[]) {
				const measurements = complexityMeasurements[id];
				if (measurements.length > 0) {
					const median = calculateMedian(measurements);
					stats[id].complexityScore = median;
					console.log(`    ${id} median complexity score: ${median}`);
				}
			}
		}

		const statsWithMetadata = {
			metadata: {
				lastUpdated: new Date().toISOString(),
				description: "Framework comparison metrics",
				metrics: {
					bundleSize: "Size in KB",
					complexityScore: "Scale of 0-100",
					bundleSizeZScore: "Standardized score relative to mean",
					complexityZScore: "Standardized score relative to mean",
				},
			},
			frameworks: calculateStatsZScores(stats),
		};

		await fs.writeFile(
			path.join(process.cwd(), STATS_CONFIG.STATS_FILE_PATH),
			JSON.stringify(statsWithMetadata, null, 2),
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
