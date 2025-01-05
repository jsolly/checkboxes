/**
 * Calculates z-scores for a set of metrics across frameworks
 * @param {Object} frameworkStats - Object containing framework stats
 * @param {string} metric - The metric to calculate z-scores for (e.g., 'renderTime', 'bundleSize')
 * @returns {Object} Z-scores for each framework
 */
export function calculateZScores(frameworkStats, metric) {
	const parseMetricValue = (value) =>
		Number.parseFloat(value.replace(/(ms|kb)$/, ""));

	// Convert values to numbers, removing 'ms' or 'kb' suffixes
	const values = Object.values(frameworkStats).map((stats) =>
		parseMetricValue(stats[metric]),
	);

	// Calculate mean
	const mean = values.reduce((a, b) => a + b, 0) / values.length;

	// Calculate standard deviation
	const variance =
		values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
	const stdDev = Math.sqrt(variance);

	// Calculate z-scores for each framework
	const zScores = {};
	for (const [framework, stats] of Object.entries(frameworkStats)) {
		const value = parseMetricValue(stats[metric]);
		zScores[framework] = (value - mean) / stdDev;
	}

	return zScores;
}

function calculateZScore(value, mean, stdDev) {
	return (value - mean) / stdDev;
}

export function calculateStatsZScores(stats) {
	// Calculate mean and standard deviation for render times
	const renderTimes = Object.values(stats).map((s) =>
		Number.parseFloat(s.renderTime.replace("ms", "")),
	);
	const renderTimeMean =
		renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
	const renderTimeStdDev = Math.sqrt(
		renderTimes.reduce((sq, n) => sq + (n - renderTimeMean) ** 2, 0) /
			renderTimes.length,
	);

	// Calculate mean and standard deviation for bundle sizes (if they exist)
	const bundleSizes = Object.values(stats)
		.map((s) => s.bundleSize)
		.filter(Boolean)
		.map((size) => Number.parseFloat(size.replace("kb", "")));

	const bundleSizeMean = bundleSizes.length
		? bundleSizes.reduce((a, b) => a + b, 0) / bundleSizes.length
		: 0;
	const bundleSizeStdDev = bundleSizes.length
		? Math.sqrt(
				bundleSizes.reduce((sq, n) => sq + (n - bundleSizeMean) ** 2, 0) /
					bundleSizes.length,
			)
		: 0;

	// Add Z-scores to each framework's stats
	const statsWithZScores = {};
	for (const [framework, frameworkStats] of Object.entries(stats)) {
		statsWithZScores[framework] = {
			...frameworkStats,
			renderTimeZScore: calculateZScore(
				Number.parseFloat(frameworkStats.renderTime.replace("ms", "")),
				renderTimeMean,
				renderTimeStdDev,
			),
			bundleSizeZScore: frameworkStats.bundleSize
				? calculateZScore(
						Number.parseFloat(frameworkStats.bundleSize.replace("kb", "")),
						bundleSizeMean,
						bundleSizeStdDev,
					)
				: undefined,
		};
	}

	return statsWithZScores;
}
