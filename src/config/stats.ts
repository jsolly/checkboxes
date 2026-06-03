import type { FrameworkId } from "./frameworks";

export interface DecisionPointBreakdown {
	jsControlFlow: number;
	templateDirectives: number;
	selectors: number;
	declarativeAttrs: number;
}

export interface FrameworkStats {
	bundleSize: number;
	decisionPoints: number;
	decisionPointScore: number;
	vibeComplexity: number;
	bundleSizeZScore: number;
	decisionPointZScore: number;
	vibeComplexityZScore: number;
	decisionPointBreakdown: DecisionPointBreakdown;
}

export interface StatsMetadata {
	lastUpdated: string;
	description: string;
	decisionPointScoreCap: number;
	metrics: {
		bundleSize: string;
		decisionPoints: string;
		decisionPointScore: string;
		vibeComplexity: string;
		bundleSizeZScore: string;
		decisionPointZScore: string;
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
