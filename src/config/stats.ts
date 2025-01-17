import type { FrameworkId } from "./frameworks";

export interface FrameworkStats {
	bundleSize: number;
	complexityScore: number;
	bundleSizeZScore: number;
	complexityZScore: number;
}

export interface StatsMetadata {
	lastUpdated: string;
	description: string;
	metrics: {
		bundleSize: string;
		complexityScore: string;
		bundleSizeZScore: string;
		complexityZScore: string;
	};
}

export interface StatsFile {
	metadata: StatsMetadata;
	frameworks: Record<FrameworkId, FrameworkStats>;
}

export const STATS_CONFIG = {
	// File extensions to look for when reading implementation files
	SUPPORTED_EXTENSIONS: [".tsx", ".jsx", ".astro", ".vue", ".svelte"],

	// Number of iterations for measurements
	BUNDLE_SIZE_ITERATIONS: 3,
	COMPLEXITY_SCORE_ITERATIONS: 5,

	// Paths
	STATS_FILE_PATH: "src/data/framework-stats.json",
	COMPONENTS_DIR: "src/components",

	// Server config
	PREVIEW_URL: "http://localhost:4321/test",

	// Measurement options
	BUNDLE_SIZE_PRECISION: 2, // Number of decimal places for bundle size

	// Feature flags
	UPDATE_COMPLEXITY_SCORES: true, // Set to true when you want to update complexity scores
} as const;
