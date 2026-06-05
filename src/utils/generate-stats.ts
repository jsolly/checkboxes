import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as dotenv from "dotenv";
import { FRAMEWORKS, type FrameworkId } from "../config/frameworks";
import { STATS_CONFIG } from "../config/stats";
import type { FrameworkStats, StatsFile } from "../types/stats";
import {
	BUNDLE_MEASUREMENT_VERSION,
	type JsPayloadMeasurement,
	buildBundleMeasurementAudit,
	measureBuiltJsPayload,
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

async function measureBaselineBundle(
	distDirectory: string,
): Promise<JsPayloadMeasurement> {
	const measurement = await measureBuiltJsPayload(
		distDirectory,
		"/test/baseline",
	);
	console.log(
		`    Baseline: ${measurement.jsRawBytes} B raw, ${measurement.jsNormalizedBytes} B normalized gzip (${measurement.jsSources.length} sources)`,
	);
	return measurement;
}

async function measureFrameworkBundle(
	distDirectory: string,
	baselineMeasurement: JsPayloadMeasurement,
	framework: FrameworkId,
) {
	const measurement = await measureBuiltJsPayload(
		distDirectory,
		`/test/${framework}`,
	);
	const audit = buildBundleMeasurementAudit(
		measurement,
		baselineMeasurement.inlineJsBytes,
		baselineMeasurement.jsNormalizedBytes,
	);
	console.log(
		`    Bundle: ${audit.jsImplementationNormalizedKiB} KiB normalized implementation (${audit.jsRawBytes} B raw, ${audit.jsSources.length} sources)`,
	);

	return {
		bundleSize: audit.jsImplementationNormalizedKiB,
		bundleMeasurement: audit,
	};
}

async function generateStats(): Promise<void> {
	console.log("\n📊 Starting stats generation with config:");
	const distDirectory = path.join(process.cwd(), "dist");
	await fs.access(distDirectory).catch((cause) => {
		throw new Error(
			`dist/ not found at ${distDirectory} — run pnpm build first`,
			{
				cause,
			},
		);
	});
	console.log(`  • Build output: ${distDirectory}`);
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

	const stats = {} as Record<FrameworkId, FrameworkStats>;

	console.log("📏 Measuring baseline route...");
	const baselineMeasurement = await measureBaselineBundle(distDirectory);
	const baselineInlineBytes = baselineMeasurement.inlineJsBytes;
	console.log(
		`  Baseline JS payload: ${baselineMeasurement.jsNormalizedBytes} normalized bytes (${baselineMeasurement.jsSources.length} sources, ${baselineInlineBytes} B inline)`,
	);

	for (const id of Object.keys(FRAMEWORKS) as FrameworkId[]) {
		console.log(`📦 Measuring ${id}...`);
		const bundle = await measureFrameworkBundle(
			distDirectory,
			baselineMeasurement,
			id,
		);
		console.log(
			`  Bundle size: ${bundle.bundleSize} KiB normalized implementation`,
		);

		const codeComplexityResult = analyzeCodeComplexity(implementations[id]);
		console.log(
			`  Code complexity: ${codeComplexityResult.score}/100 (logic decisions ${codeComplexityResult.raw.logicDecisions})`,
		);

		const source = implementations[id];
		stats[id] = {
			bundleSize: bundle.bundleSize,
			bundleMeasurement: bundle.bundleMeasurement,
			sourceLines: source.code.split("\n").length,
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
				stats[id].vibeComplexity = Math.round(
					getExistingVibeComplexity(existingStats, id),
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
				const message = error instanceof Error ? error.message : String(error);
				if (message.includes("429") || message.includes("RESOURCE_EXHAUSTED")) {
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
				const median = Math.round(calculateMedian(measurements));
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
					"Normalized implementation JavaScript payload (KiB): built chunks, external runtimes, and inline JS above baseline",
				sourceLines:
					"Line count of the implementation source file shown on each card",
				codeComplexity:
					"Deterministic 0-100 composite of size, logic, reactive, nesting, and vocabulary",
				vibeComplexity: "AI-judged implementation complexity on a 0-100 scale",
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
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	generateStats().catch((error) => {
		console.error(error);
		process.exit(1);
	});
}

export { generateStats };
