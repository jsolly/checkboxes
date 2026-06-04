import type { BundleMeasurementAudit } from "../utils/bundleMeasurement";
import type {
	CodeComplexityRaw,
	CodeComplexitySubscores,
} from "../utils/code-complexity/types";
import type { FrameworkId } from "./frameworks";

export type { CodeComplexityRaw, CodeComplexitySubscores };
export type { BundleMeasurementAudit };

export interface FrameworkStats {
	bundleSize: number;
	bundleMeasurement: BundleMeasurementAudit;
	codeComplexity: number;
	vibeComplexity: number;
	bundleSizeZScore: number;
	codeComplexityZScore: number;
	vibeComplexityZScore: number;
	codeComplexitySubscores: CodeComplexitySubscores;
	codeComplexityRaw: CodeComplexityRaw;
}

export interface StatsMetadata {
	lastUpdated: string;
	description: string;
	codeComplexityVersion: string;
	bundleMeasurementVersion: string;
	metrics: {
		bundleSize: string;
		codeComplexity: string;
		vibeComplexity: string;
		bundleSizeZScore: string;
		codeComplexityZScore: string;
		vibeComplexityZScore: string;
	};
}

export interface StatsFile {
	metadata: StatsMetadata;
	frameworks: Record<FrameworkId, FrameworkStats>;
}

export const STATS_CONFIG = {
	// Number of iterations for measurements
	BUNDLE_SIZE_ITERATIONS: 3,
	VIBE_COMPLEXITY_ITERATIONS: 5,

	// Paths
	STATS_FILE_PATH: "src/data/framework-stats.json",

	// Server config — override with STATS_PREVIEW_URL when preview binds another port
	PREVIEW_URL: process.env.STATS_PREVIEW_URL ?? "http://localhost:4321/test",

	// Measurement options
	BUNDLE_SIZE_PRECISION: 2,

	// Feature flags
	UPDATE_VIBE_COMPLEXITY: true,
} as const;
