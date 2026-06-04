import type { FrameworkId } from "../config/frameworks";
import type { FrameworkStats } from "../types/stats";

function calculateMean(values: number[]): number {
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateStdDev(values: number[], mean: number): number {
	const variance =
		values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
	return Math.sqrt(variance);
}

function calculateZScore(allValues: number[], currentValue: number): number {
	const mean = calculateMean(allValues);
	const stdDev = calculateStdDev(allValues, mean);
	return stdDev === 0 ? 0 : (currentValue - mean) / stdDev;
}

export function calculateStatsZScores<T extends string = FrameworkId>(
	stats: Record<T, FrameworkStats>,
): Record<T, FrameworkStats> {
	const frameworks = Object.keys(stats) as T[];
	const bundleSizes = frameworks.map((id) => stats[id].bundleSize);
	const codeComplexities = frameworks.map((id) => stats[id].codeComplexity);
	const vibeComplexities = frameworks.map((id) => stats[id].vibeComplexity);

	const result = {} as Record<T, FrameworkStats>;
	for (const id of frameworks) {
		result[id] = {
			...stats[id],
			bundleSizeZScore: calculateZScore(bundleSizes, stats[id].bundleSize),
			codeComplexityZScore: calculateZScore(
				codeComplexities,
				stats[id].codeComplexity,
			),
			vibeComplexityZScore: calculateZScore(
				vibeComplexities,
				stats[id].vibeComplexity,
			),
		};
	}

	return result;
}
