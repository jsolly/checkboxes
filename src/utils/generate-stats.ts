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
import { analyzeDecisionPoints } from "./decision-points";
import { DECISION_POINT_SCORE_CAP } from "./decision-points/types";
import { evaluateVibeComplexity } from "./evaluateVibeComplexity";
import { readImplementationSources } from "./implementationSources";

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
		? sorted[mid]
		: (sorted[mid - 1] + sorted[mid]) / 2;
}

function getExistingVibeComplexity(
	existingStats: Partial<StatsFile> | undefined,
	id: FrameworkId,
): number {
	const frameworkStats = existingStats?.frameworks?.[id] as
		| (Partial<FrameworkStats> & { complexityScore?: number })
		| undefined;

	return frameworkStats?.vibeComplexity ?? frameworkStats?.complexityScore ?? 0;
}

async function measureBundleSize(page: Page, framework: FrameworkId) {
	const measurements: number[] = [];

	for (let i = 0; i < STATS_CONFIG.BUNDLE_SIZE_ITERATIONS; i++) {
		const client = await page.createCDPSession();

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

async function generateStats(): Promise<void> {
	console.log("\n📊 Starting stats generation with config:");
	console.log(
		`  • Bundle size iterations: ${STATS_CONFIG.BUNDLE_SIZE_ITERATIONS}`,
	);
	console.log(
		`  • Vibe complexity iterations: ${STATS_CONFIG.VIBE_COMPLEXITY_ITERATIONS}`,
	);
	console.log(
		`  • Update vibe complexity: ${STATS_CONFIG.UPDATE_VIBE_COMPLEXITY}\n`,
	);

	const implementations = await readImplementationSources();
	const implementationCode = Object.fromEntries(
		Object.entries(implementations).map(([id, source]) => [id, source.code]),
	) as Record<FrameworkId, string>;

	const browser = await puppeteer.launch();
	const page = await browser.newPage();
	const stats = {} as Record<FrameworkId, FrameworkStats>;

	try {
		for (const id of Object.keys(FRAMEWORKS) as FrameworkId[]) {
			console.log(`📦 Measuring ${id}...`);
			const size = await measureBundleSize(page, id);
			console.log(`  Bundle size: ${size}kb`);

			const decisionPointResult = analyzeDecisionPoints(implementations[id]);
			console.log(
				`  Decision points: ${decisionPointResult.value} (score ${decisionPointResult.normalizedScore}/100)`,
			);

			stats[id] = {
				bundleSize: size,
				decisionPoints: decisionPointResult.value,
				decisionPointScore: decisionPointResult.normalizedScore,
				vibeComplexity: 0,
				bundleSizeZScore: 0,
				decisionPointZScore: 0,
				vibeComplexityZScore: 0,
				decisionPointBreakdown: decisionPointResult.breakdown,
			};
		}

		const hasApiKey = !!process.env.GEMINI_API_KEY;
		const shouldUpdateVibeComplexity =
			STATS_CONFIG.UPDATE_VIBE_COMPLEXITY && hasApiKey;

		if (STATS_CONFIG.UPDATE_VIBE_COMPLEXITY && !hasApiKey) {
			console.warn(
				"⚠️ GEMINI_API_KEY not set — skipping vibe complexity evaluation, using existing scores",
			);
		}

		if (!shouldUpdateVibeComplexity) {
			try {
				const existingStats = JSON.parse(
					await fs.readFile(
						path.join(process.cwd(), STATS_CONFIG.STATS_FILE_PATH),
						"utf-8",
					),
				) as StatsFile;

				for (const id of Object.keys(stats) as FrameworkId[]) {
					stats[id].vibeComplexity = getExistingVibeComplexity(
						existingStats,
						id,
					);
				}
				console.log("ℹ️ Using existing vibe complexity scores");
			} catch {
				console.warn("⚠️ Could not load existing vibe complexity scores");
			}
		}

		if (shouldUpdateVibeComplexity) {
			const vibeMeasurements: Record<string, number[]> = {};

			for (const id of Object.keys(implementationCode) as FrameworkId[]) {
				vibeMeasurements[id] = [];
			}

			for (let i = 0; i < STATS_CONFIG.VIBE_COMPLEXITY_ITERATIONS; i++) {
				console.log(`📊 Evaluating vibe complexity - Run ${i + 1}...`);
				try {
					const { scores } = await evaluateVibeComplexity(implementationCode);

					for (const [id, score] of Object.entries(scores)) {
						vibeMeasurements[id].push(score);
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

			for (const id of Object.keys(implementationCode) as FrameworkId[]) {
				const measurements = vibeMeasurements[id];
				if (measurements.length > 0) {
					const median = calculateMedian(measurements);
					stats[id].vibeComplexity = median;
					console.log(`    ${id} median vibe complexity: ${median}`);
				}
			}
		}

		const statsWithMetadata = {
			metadata: {
				lastUpdated: new Date().toISOString(),
				description: "Framework comparison metrics",
				decisionPointScoreCap: DECISION_POINT_SCORE_CAP,
				metrics: {
					bundleSize: "Size in KB",
					decisionPoints:
						"Deterministic count of branch, loop, template, selector, and declarative decisions",
					decisionPointScore: "Decision Points normalized to 0-100",
					vibeComplexity:
						"AI-judged implementation complexity on a 0-100 scale",
					bundleSizeZScore: "Standardized score relative to mean",
					decisionPointZScore: "Standardized score relative to mean",
					vibeComplexityZScore: "Standardized score relative to mean",
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	generateStats().catch(console.error);
}

export { generateStats };
