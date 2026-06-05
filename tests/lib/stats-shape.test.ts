import assert from "node:assert/strict";
import { describe, it } from "node:test";
import stats from "../../src/data/framework-stats.json";
import type { FrameworkStats } from "../../src/types/stats";
import { calculateStatsZScores } from "../../src/utils/calculateZScores";

function makeBundleMeasurement() {
	return {
		measuredRoute: "/test/react",
		inlineJsBytes: 0,
		jsRequestCount: 1,
		baselineInlineJsBytes: 0,
		inlineJsImplementationBytes: 0,
		jsRawBytes: 4096,
		jsNormalizedBytes: 1536,
		baselineNormalizedBytes: 512,
		jsImplementationNormalizedBytes: 1024,
		jsImplementationNormalizedKiB: 1,
		jsSources: [],
		compressionNote: "Ranked by normalized gzip-compressed JavaScript payload.",
	};
}

describe("A stats generation run emits explicit complexity metrics", () => {
	it("calculates z-scores for bundle size, Code Complexity, and Vibe Complexity", () => {
		const sample: Record<"react" | "vue", FrameworkStats> = {
			react: {
				bundleSize: 2,
				bundleMeasurement: makeBundleMeasurement(),
				sourceLines: 75,
				codeComplexity: 74,
				vibeComplexity: 60,
				bundleSizeZScore: 0,
				codeComplexityZScore: 0,
				vibeComplexityZScore: 0,
				codeComplexitySubscores: {
					size: 12,
					logic: 10,
					reactive: 14,
					nesting: 18,
					vocabulary: 20,
				},
				codeComplexityRaw: {
					astNodes: 120,
					logicDecisions: 3,
					reactiveSurface: 12,
					maxNestingDepth: 4,
					distinctOperators: 10,
					distinctOperands: 40,
					cssSelectorParts: 0,
					directives: 0,
					eventHandlers: 4,
					bindings: 2,
					stateAtoms: 6,
					vocabulary: 42,
				},
			},
			vue: {
				bundleSize: 1,
				bundleMeasurement: makeBundleMeasurement(),
				sourceLines: 40,
				codeComplexity: 60,
				vibeComplexity: 30,
				bundleSizeZScore: 0,
				codeComplexityZScore: 0,
				vibeComplexityZScore: 0,
				codeComplexitySubscores: {
					size: 10,
					logic: 8,
					reactive: 12,
					nesting: 15,
					vocabulary: 15,
				},
				codeComplexityRaw: {
					astNodes: 90,
					logicDecisions: 2,
					reactiveSurface: 8,
					maxNestingDepth: 3,
					distinctOperators: 8,
					distinctOperands: 30,
					cssSelectorParts: 0,
					directives: 1,
					eventHandlers: 2,
					bindings: 1,
					stateAtoms: 4,
					vocabulary: 30,
				},
			},
		};

		const scored = calculateStatsZScores(sample);

		assert.equal(scored.react.bundleSizeZScore, 1);
		assert.equal(scored.vue.bundleSizeZScore, -1);
		assert.equal(scored.react.codeComplexityZScore, 1);
		assert.equal(scored.vue.codeComplexityZScore, -1);
		assert.equal(scored.react.vibeComplexityZScore, 1);
		assert.equal(scored.vue.vibeComplexityZScore, -1);
	});

	it("stores Code Complexity fields and no public Decision Point score fields", () => {
		for (const [id, frameworkStats] of Object.entries(stats.frameworks)) {
			assert.ok(
				"bundleMeasurement" in frameworkStats,
				`${id} missing bundleMeasurement`,
			);
			assert.equal(
				frameworkStats.bundleSize,
				frameworkStats.bundleMeasurement.jsImplementationNormalizedKiB,
				`${id} bundleSize/audit mismatch`,
			);
			assert.ok("sourceLines" in frameworkStats, `${id} missing sourceLines`);
			assert.ok(
				typeof frameworkStats.sourceLines === "number" &&
					frameworkStats.sourceLines > 0,
				`${id} sourceLines should be a positive number`,
			);
			assert.ok(
				"codeComplexity" in frameworkStats,
				`${id} missing codeComplexity`,
			);
			assert.ok(
				"codeComplexitySubscores" in frameworkStats,
				`${id} missing codeComplexitySubscores`,
			);
			assert.ok(
				"codeComplexityRaw" in frameworkStats,
				`${id} missing codeComplexityRaw`,
			);
			assert.ok(
				"vibeComplexity" in frameworkStats,
				`${id} missing vibeComplexity`,
			);
			assert.equal(
				"decisionPointScore" in frameworkStats,
				false,
				`${id} still exposes decisionPointScore`,
			);
			assert.equal(
				"decisionPoints" in frameworkStats,
				false,
				`${id} still exposes decisionPoints`,
			);
		}

		assert.equal(
			"decisionPointScoreCap" in stats.metadata,
			false,
			"metadata still exposes decisionPointScoreCap",
		);
		assert.ok(
			"codeComplexityVersion" in stats.metadata,
			"metadata missing codeComplexityVersion",
		);
		assert.ok(
			"bundleMeasurementVersion" in stats.metadata,
			"metadata missing bundleMeasurementVersion",
		);
	});
});
