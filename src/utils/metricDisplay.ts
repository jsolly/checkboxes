import type { FrameworkStats, FrameworkStatsRecord } from "../types/stats";

export type MetricKey = "codeComplexity" | "vibeComplexity" | "bundleSize";

export interface MetricDisplay {
	key: MetricKey;
	name: string;
	kind: "deterministic" | "ai";
	zScoreField: keyof Pick<
		FrameworkStats,
		"codeComplexityZScore" | "vibeComplexityZScore" | "bundleSizeZScore"
	>;
	anchor: string;
	tooltip: string;
	tag: string;
	blurb: string;
}

export const METRIC_DISPLAY: Record<MetricKey, MetricDisplay> = {
	codeComplexity: {
		key: "codeComplexity",
		name: "Code Complexity",
		kind: "deterministic",
		zScoreField: "codeComplexityZScore",
		anchor: "code-complexity",
		tooltip: "Deterministic 0–100, no AI.",
		tag: "Deterministic · no AI",
		blurb:
			"A reproducible 0–100 score from five capped axes — Size, Logic, Reactive, Nesting, Vocabulary — parsed straight from the source shown on this card. Same input, same number.",
	},
	vibeComplexity: {
		key: "vibeComplexity",
		name: "Vibe Complexity",
		kind: "ai",
		zScoreField: "vibeComplexityZScore",
		anchor: "vibe-complexity",
		tooltip:
			"AI-judged 0–100 — state clarity, event handling, boilerplate, idiomatic feel.",
		tag: "AI-judged · may change",
		blurb:
			"Gemini reads the same source and judges how it feels to maintain: state clarity, event handling, boilerplate, and idiomatic style. Model-judged, so it can shift when the model or prompt changes.",
	},
	bundleSize: {
		key: "bundleSize",
		name: "JS Bundle",
		kind: "deterministic",
		zScoreField: "bundleSizeZScore",
		anchor: "js-bundle",
		tooltip: "Compressed JS shipped, captured during page load.",
		tag: "Measured",
		blurb:
			"Total compressed JavaScript shipped for this implementation, captured from network requests during page load. Lower is better.",
	},
};

export const METRIC_ORDER: MetricKey[] = [
	"codeComplexity",
	"vibeComplexity",
	"bundleSize",
];

function clampPercent(value: number): number {
	return Math.max(0, Math.min(100, Math.round(value)));
}

export function barFillPercent(
	key: MetricKey,
	stats: FrameworkStats,
	maxBundle: number,
): number {
	if (key === "bundleSize") {
		if (maxBundle <= 0) return 0;
		return clampPercent((stats.bundleSize / maxBundle) * 100);
	}
	return clampPercent(stats[key]);
}

export function zScoreColorClass(zScore: number): string {
	if (zScore >= 1.5) return "bg-red-500";
	if (zScore >= 0.5) return "bg-orange-500";
	if (zScore >= -0.5) return "bg-yellow-500";
	if (zScore >= -1.5) return "bg-green-400";
	return "bg-green-500";
}

export function maxBundleSize(frameworks: FrameworkStatsRecord): number {
	return Math.max(...Object.values(frameworks).map((f) => f.bundleSize));
}

export function formatMetricValue(
	key: MetricKey,
	stats: FrameworkStats,
): string {
	if (key === "bundleSize") return `${stats.bundleSize.toFixed(2)}kb`;
	return `${stats[key]}`;
}
