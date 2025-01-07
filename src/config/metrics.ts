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

/**
 * Picks properties from type T that are assignable to type P
 * @template T - The source type to pick from
 * @template P - The type to filter by
 * @example
 * type Person = { name: string; age: number; active: boolean }
 * type NumberProps = PickByType<Person, number> // { age: number }
 */
type PickByType<T, P> = {
	[K in keyof T as T[K] extends P ? K : never]: T[K];
};
