interface FrameworkStats {
	renderTime: string;
	bundleSize: string;
}

interface FrameworkStatsWithZScores extends FrameworkStats {
	renderTimeZScore: number;
	bundleSizeZScore: number;
}

type StatsRecord = Record<string, FrameworkStats>;
type StatsWithZScoresRecord = Record<string, FrameworkStatsWithZScores>;

function parseMetricValue(value: string): number {
	return Number.parseFloat(value.replace(/(ms|kb)$/, ""));
}

function calculateMean(values: number[]): number {
	return values.reduce((a, b) => a + b, 0) / values.length;
}

function calculateStdDev(values: number[], mean: number): number {
	const variance =
		values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
	return Math.sqrt(variance);
}

function calculateZScore(value: number, mean: number, stdDev: number): number {
	return (value - mean) / stdDev;
}

export function calculateZScores(
	frameworkStats: StatsRecord,
	metric: keyof FrameworkStats,
): Record<string, number> {
	const values = Object.values(frameworkStats).map((stats) =>
		parseMetricValue(stats[metric]),
	);
	const mean = calculateMean(values);
	const stdDev = calculateStdDev(values, mean);

	return Object.entries(frameworkStats).reduce(
		(zScores, [framework, stats]) => {
			zScores[framework] = calculateZScore(
				parseMetricValue(stats[metric]),
				mean,
				stdDev,
			);
			return zScores;
		},
		{} as Record<string, number>,
	);
}

export function calculateStatsZScores(
	stats: StatsRecord,
): StatsWithZScoresRecord {
	// Calculate z-scores for render times
	const renderTimes = Object.values(stats).map((s) =>
		parseMetricValue(s.renderTime),
	);
	const renderTimeMean = calculateMean(renderTimes);
	const renderTimeStdDev = calculateStdDev(renderTimes, renderTimeMean);

	// Calculate z-scores for bundle sizes
	const bundleSizes = Object.values(stats).map((s) =>
		parseMetricValue(s.bundleSize),
	);
	const bundleSizeMean = calculateMean(bundleSizes);
	const bundleSizeStdDev = calculateStdDev(bundleSizes, bundleSizeMean);

	const statsWithZScores: StatsWithZScoresRecord = {};
	for (const [framework, frameworkStats] of Object.entries(stats)) {
		statsWithZScores[framework] = {
			...frameworkStats,
			renderTimeZScore: calculateZScore(
				parseMetricValue(frameworkStats.renderTime),
				renderTimeMean,
				renderTimeStdDev,
			),
			bundleSizeZScore: calculateZScore(
				parseMetricValue(frameworkStats.bundleSize),
				bundleSizeMean,
				bundleSizeStdDev,
			),
		};
	}

	return statsWithZScores;
}
