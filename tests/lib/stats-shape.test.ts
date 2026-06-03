import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FrameworkStats } from "../../src/config/stats";
import { calculateStatsZScores } from "../../src/utils/calculateZScores";

describe("A stats generation run emits explicit complexity metrics", () => {
	it("calculates z-scores for bundle size, Decision Points, and Vibe Complexity", () => {
		const stats: Record<"react" | "vue", FrameworkStats> = {
			react: {
				bundleSize: 2,
				decisionPoints: 12,
				decisionPointScore: 40,
				vibeComplexity: 60,
				bundleSizeZScore: 0,
				decisionPointZScore: 0,
				vibeComplexityZScore: 0,
				decisionPointBreakdown: {
					jsControlFlow: 12,
					templateDirectives: 0,
					selectors: 0,
					declarativeAttrs: 0,
				},
			},
			vue: {
				bundleSize: 1,
				decisionPoints: 6,
				decisionPointScore: 20,
				vibeComplexity: 30,
				bundleSizeZScore: 0,
				decisionPointZScore: 0,
				vibeComplexityZScore: 0,
				decisionPointBreakdown: {
					jsControlFlow: 4,
					templateDirectives: 2,
					selectors: 0,
					declarativeAttrs: 0,
				},
			},
		};

		const scored = calculateStatsZScores(stats);

		assert.equal(scored.react.bundleSizeZScore, 1);
		assert.equal(scored.vue.bundleSizeZScore, -1);
		assert.equal(scored.react.decisionPointZScore, 1);
		assert.equal(scored.vue.decisionPointZScore, -1);
		assert.equal(scored.react.vibeComplexityZScore, 1);
		assert.equal(scored.vue.vibeComplexityZScore, -1);
	});
});
