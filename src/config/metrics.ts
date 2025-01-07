import type { FrameworkStats } from "../types/stats";

type NumberMetric = {
	rawField: keyof PickByType<FrameworkStats, number>;
	zScoreField: keyof FrameworkStats;
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
		rawField: "complexityScore",
		zScoreField: "complexityZScore",
		type: "number",
	},
];

// Helper type to get properties of T that are of type P
type PickByType<T, P> = {
	[K in keyof T as T[K] extends P ? K : never]: T[K];
};
