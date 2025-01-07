import { METRICS, type MetricConfig } from "../config/metrics";
import type { FrameworkStats } from "../types/stats";

function calculateMean(values: number[]): number {
	return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function calculateStdDev(values: number[], mean: number): number {
	const variance =
		values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
	return Math.sqrt(variance);
}

function calculateZScore(values: number[], value: number): number {
	const mean = calculateMean(values);
	const stdDev = calculateStdDev(values, mean);
	return stdDev === 0 ? 0 : (value - mean) / stdDev;
}

function calculateMetricZScores(
	stats: Record<string, FrameworkStats>,
	metric: MetricConfig,
) {
	const values = Object.values(stats).map((s) => s[metric.rawField]);

	return Object.entries(stats).map(([framework, stat]) => [
		framework,
		{
			...stat,
			[metric.zScoreField]: calculateZScore(values, stat[metric.rawField]),
		},
	]);
}

export function calculateStatsZScores(
	stats: Record<string, FrameworkStats>,
): Record<string, FrameworkStats> {
	return METRICS.reduce(
		(acc, metric) => Object.fromEntries(calculateMetricZScores(acc, metric)),
		stats,
	);
}
