import type {
	CodeComplexityRaw,
	CodeComplexitySubscores,
} from "../utils/code-complexity/types";
import type { FrameworkId } from "./frameworks";

export type { CodeComplexityRaw, CodeComplexitySubscores };

export interface FrameworkStats {
	bundleSize: number;
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

	// Server config
	PREVIEW_URL: "http://localhost:4321/test",

	// Measurement options
	BUNDLE_SIZE_PRECISION: 2,

	// Feature flags
	UPDATE_VIBE_COMPLEXITY: true,
} as const;
