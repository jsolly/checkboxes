import type { FrameworkStats } from "../types/stats";

type NumberMetric = {
	rawField: keyof PickByType<FrameworkStats, number>;
	zScoreField: keyof PickByType<FrameworkStats, number>;
	type: "number";
};

export type MetricConfig = NumberMetric;

export const METRICS: MetricConfig[] = [
	{
		rawField: "bundleSize",
		zScoreField: "bundleSizeZScore",
		type: "number",
	},
	{
		rawField: "codeComplexity",
		zScoreField: "codeComplexityZScore",
		type: "number",
	},
	{
		rawField: "vibeComplexity",
		zScoreField: "vibeComplexityZScore",
		type: "number",
	},
];

type PickByType<T, P> = {
	[K in keyof T as T[K] extends P ? K : never]: T[K];
};
