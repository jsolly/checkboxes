import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
	BundleMeasurementAudit,
	FrameworkStats,
	FrameworkStatsRecord,
} from "../../src/types/stats";
import {
	METRIC_DISPLAY,
	barFillPercent,
	formatMetricValue,
	maxBundleSize,
	zScoreColorClass,
} from "../../src/utils/metricDisplay";

function makeBundleMeasurement(
	overrides: Partial<BundleMeasurementAudit> = {},
): BundleMeasurementAudit {
	return {
		measuredRoute: "/test/react",
		jsTransferTotalBytes: 1566,
		inlineJsBytes: 0,
		jsRequestCount: 1,
		jsRequests: [],
		baselineJsTransferBytes: 0,
		baselineInlineJsBytes: 0,
		jsImplementationDeltaBytes: 1566,
		inlineJsImplementationBytes: 0,
		jsImplementationTotalBytes: 1566,
		jsTransferTotalKiB: 1.53,
		baselineJsTransferKiB: 0,
		jsImplementationDeltaKiB: 1.53,
		jsImplementationTotalKiB: 1.53,
		compressionNote:
			"Measured as browser transfer bytes, with compression negotiated by the server.",
		...overrides,
	};
}

function makeStats(overrides: Partial<FrameworkStats>): FrameworkStats {
	return {
		bundleSize: 1.53,
		bundleMeasurement: makeBundleMeasurement(),
		codeComplexity: 60,
		vibeComplexity: 65,
		bundleSizeZScore: 0,
		codeComplexityZScore: 0,
		vibeComplexityZScore: 0,
		codeComplexitySubscores: {
			size: 20,
			logic: 10,
			reactive: 14.8,
			nesting: 0,
			vocabulary: 15.6,
		},
		codeComplexityRaw: {
			astNodes: 349,
			logicDecisions: 3,
			reactiveSurface: 12,
			maxNestingDepth: 0,
			distinctOperators: 38,
			distinctOperands: 51,
			cssSelectorParts: 0,
			directives: 0,
			eventHandlers: 3,
			bindings: 0,
			stateAtoms: 9,
			vocabulary: 62,
		},
		...overrides,
	};
}

describe("A visitor reads the metric footer on a framework card", () => {
	it("fills the Code Complexity bar to the raw score (60 looks like 60%)", () => {
		const react = makeStats({ codeComplexity: 60 });
		assert.equal(barFillPercent("codeComplexity", react, 1.53), 60);
	});

	it("fills the Vibe Complexity bar to the raw score", () => {
		const react = makeStats({ vibeComplexity: 65 });
		assert.equal(barFillPercent("vibeComplexity", react, 1.53), 65);
	});

	it("fills the JS Bundle bar relative to the largest bundle in the field", () => {
		const react = makeStats({ bundleSize: 1.53 });
		assert.equal(barFillPercent("bundleSize", react, 1.53), 100);
		const vanilla = makeStats({ bundleSize: 0.31 });
		assert.equal(barFillPercent("bundleSize", vanilla, 1.53), 20);
	});

	it("never produces a fill below 0 or above 100", () => {
		assert.equal(
			barFillPercent(
				"codeComplexity",
				makeStats({ codeComplexity: 140 }),
				1.53,
			),
			100,
		);
		assert.equal(
			barFillPercent("codeComplexity", makeStats({ codeComplexity: -5 }), 1.53),
			0,
		);
		assert.equal(
			barFillPercent("bundleSize", makeStats({ bundleSize: 0.31 }), 0),
			0,
		);
	});

	it("maps z-score standing to the existing badge colors", () => {
		assert.equal(zScoreColorClass(2.0), "bg-red-500");
		assert.equal(zScoreColorClass(0.95), "bg-orange-500");
		assert.equal(zScoreColorClass(0.33), "bg-yellow-500");
		assert.equal(zScoreColorClass(-0.72), "bg-green-400");
		assert.equal(zScoreColorClass(-1.8), "bg-green-500");
	});

	it("finds the largest bundle size across the field", () => {
		const field: FrameworkStatsRecord = {
			react: makeStats({ bundleSize: 1.53 }),
			vanilla: makeStats({ bundleSize: 0.31 }),
			hyperscript: makeStats({ bundleSize: 1.01 }),
		};
		assert.equal(maxBundleSize(field), 1.53);
	});

	it("formats values with the right unit per metric", () => {
		const react = makeStats({
			codeComplexity: 60,
			vibeComplexity: 65,
			bundleSize: 1.53,
		});
		assert.equal(formatMetricValue("codeComplexity", react), "60");
		assert.equal(formatMetricValue("vibeComplexity", react), "65");
		assert.equal(formatMetricValue("bundleSize", react), "1.53 KiB");
	});

	it("labels Code Complexity and JS Bundle deterministic, Vibe Complexity AI-judged", () => {
		assert.equal(METRIC_DISPLAY.codeComplexity.name, "Code Complexity");
		assert.equal(METRIC_DISPLAY.codeComplexity.kind, "deterministic");
		assert.equal(METRIC_DISPLAY.vibeComplexity.name, "Vibe Complexity");
		assert.equal(METRIC_DISPLAY.vibeComplexity.kind, "ai");
		assert.equal(METRIC_DISPLAY.bundleSize.name, "JS Bundle");
		assert.equal(METRIC_DISPLAY.bundleSize.kind, "deterministic");
		assert.equal(METRIC_DISPLAY.codeComplexity.anchor, "code-complexity");
		assert.equal(METRIC_DISPLAY.vibeComplexity.anchor, "vibe-complexity");
		assert.equal(METRIC_DISPLAY.bundleSize.anchor, "js-bundle");
	});
});
