export const STATS_CONFIG: {
	VIBE_COMPLEXITY_ITERATIONS: number;
	STATS_FILE_PATH: string;
	BUNDLE_SIZE_PRECISION: number;
	UPDATE_VIBE_COMPLEXITY: boolean;
} = {
	// Number of iterations for AI-judged measurements
	VIBE_COMPLEXITY_ITERATIONS: 5,

	// Paths
	STATS_FILE_PATH: "src/data/framework-stats.json",

	// Measurement options
	BUNDLE_SIZE_PRECISION: 2,

	// Feature flags
	UPDATE_VIBE_COMPLEXITY: true,
};
