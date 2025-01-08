import type { FrameworkId } from "../config/frameworks";
import type { FrameworkStats } from "../config/stats";

function calculateMean(values: number[]): number {
	return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function calculateStdDev(values: number[], mean: number): number {
	const variance =
		values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
	return Math.sqrt(variance);
}

function calculateZScore(allValues: number[], currentValue: number): number {
	const mean = calculateMean(allValues);
	const stdDev = calculateStdDev(allValues, mean);
	return stdDev === 0 ? 0 : (currentValue - mean) / stdDev;
}

export function calculateStatsZScores(
	stats: Record<FrameworkId, FrameworkStats>,
): Record<FrameworkId, FrameworkStats> {
	const frameworks = Object.keys(stats) as FrameworkId[];
	const bundleSizes = frameworks.map((id) => stats[id].bundleSize);
	const complexityScores = frameworks.map((id) => stats[id].complexityScore);

	const result = {} as Record<FrameworkId, FrameworkStats>;
	for (const id of frameworks) {
		result[id] = {
			...stats[id],
			bundleSizeZScore: calculateZScore(bundleSizes, stats[id].bundleSize),
			complexityZScore: calculateZScore(
				complexityScores,
				stats[id].complexityScore,
			),
		};
	}
	return result;
}
