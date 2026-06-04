import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as dotenv from "dotenv";
import type { Page } from "puppeteer";
import puppeteer from "puppeteer";
import { FRAMEWORKS, type FrameworkId } from "../config/frameworks";
import {
	type FrameworkStats,
	STATS_CONFIG,
	type StatsFile,
} from "../config/stats";
import {
	BUNDLE_MEASUREMENT_VERSION,
	type BundleMeasurementAudit,
	type JsTransferMeasurement,
	buildBundleMeasurementAudit,
	measureJsTransfer,
} from "./bundleMeasurement";
import { calculateStatsZScores } from "./calculateZScores";
import { analyzeCodeComplexity } from "./code-complexity";
import { CODE_COMPLEXITY_VERSION } from "./code-complexity/types";
import { evaluateVibeComplexity } from "./evaluateVibeComplexity";
import { readImplementationSources } from "./implementationSources";

dotenv.config({ path: ".env.local" });
dotenv.config();

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

function selectMedianBy<T>(items: T[], value: (item: T) => number): T {
	if (items.length === 0) {
		throw new Error("Cannot select a median from an empty list");
	}

	return [...items].sort((a, b) => value(a) - value(b))[
		Math.floor(items.length / 2)
	];
}

async function measureBaselineBundle(
	page: Page,
): Promise<JsTransferMeasurement> {
	const measurements: JsTransferMeasurement[] = [];

	for (let i = 0; i < STATS_CONFIG.BUNDLE_SIZE_ITERATIONS; i++) {
		const measurement = await measureJsTransfer(page, "/baseline");
		measurements.push(measurement);
		console.log(
			`    Run ${i + 1}: ${measurement.jsTransferTotalBytes} B network, ${measurement.inlineJsBytes} B inline`,
		);
	}

	return selectMedianBy(
		measurements,
		(measurement) =>
			measurement.jsTransferTotalBytes + measurement.inlineJsBytes,
	);
}

async function measureFrameworkBundle(
	page: Page,
	baselineBytes: number,
	baselineInlineBytes: number,
	framework: FrameworkId,
) {
	const audits: BundleMeasurementAudit[] = [];

	for (let i = 0; i < STATS_CONFIG.BUNDLE_SIZE_ITERATIONS; i++) {
		const measurement = await measureJsTransfer(page, `/${framework}`);
		const audit = buildBundleMeasurementAudit(
			measurement,
			baselineBytes,
			baselineInlineBytes,
		);
		audits.push(audit);
		console.log(
			`    Run ${i + 1}: ${audit.jsImplementationTotalKiB} KiB implementation (${audit.jsImplementationDeltaKiB} KiB network, ${audit.inlineJsImplementationBytes} B inline)`,
		);
	}

	const medianAudit = selectMedianBy(
		audits,
		(audit) => audit.jsImplementationTotalBytes,
	);
	console.log(
		`    Median implementation bundle: ${medianAudit.jsImplementationTotalKiB} KiB`,
	);

	return {
		bundleSize: medianAudit.jsImplementationTotalKiB,
		bundleMeasurement: medianAudit,
	};
}

async function generateStats(): Promise<void> {
	console.log("\n📊 Starting stats generation with config:");
	console.log(`  • Preview URL: ${STATS_CONFIG.PREVIEW_URL}`);
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
		console.log("📏 Measuring baseline route...");
		const baselineMeasurement = await measureBaselineBundle(page);
		const baselineBytes = baselineMeasurement.jsTransferTotalBytes;
		const baselineInlineBytes = baselineMeasurement.inlineJsBytes;
		console.log(
			`  Baseline JS transfer: ${baselineBytes} bytes (${baselineMeasurement.jsRequestCount} requests, ${baselineInlineBytes} B inline)`,
		);

		for (const id of Object.keys(FRAMEWORKS) as FrameworkId[]) {
			console.log(`📦 Measuring ${id}...`);
			const bundle = await measureFrameworkBundle(
				page,
				baselineBytes,
				baselineInlineBytes,
				id,
			);
			console.log(`  Bundle size: ${bundle.bundleSize} KiB implementation`);

			const codeComplexityResult = analyzeCodeComplexity(implementations[id]);
			console.log(
				`  Code complexity: ${codeComplexityResult.score}/100 (logic decisions ${codeComplexityResult.raw.logicDecisions})`,
			);

			stats[id] = {
				bundleSize: bundle.bundleSize,
				bundleMeasurement: bundle.bundleMeasurement,
				codeComplexity: codeComplexityResult.score,
				vibeComplexity: 0,
				bundleSizeZScore: 0,
				codeComplexityZScore: 0,
				vibeComplexityZScore: 0,
				codeComplexitySubscores: codeComplexityResult.subscores,
				codeComplexityRaw: codeComplexityResult.raw,
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
				codeComplexityVersion: CODE_COMPLEXITY_VERSION,
				bundleMeasurementVersion: BUNDLE_MEASUREMENT_VERSION,
				metrics: {
					bundleSize:
						"Implementation JavaScript payload (KiB): external transfer above baseline plus inline JS above baseline",
					codeComplexity:
						"Deterministic 0-100 composite of size, logic, reactive, nesting, and vocabulary",
					vibeComplexity:
						"AI-judged implementation complexity on a 0-100 scale",
					bundleSizeZScore: "Standardized score relative to mean",
					codeComplexityZScore: "Standardized score relative to mean",
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
