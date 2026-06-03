import { collectRawMetrics } from "./counters";
import {
	roundSubscore,
	scoreLogic,
	scoreNesting,
	scoreReactive,
	scoreSize,
	scoreVocabulary,
	totalScore,
} from "./score";
import {
	CODE_COMPLEXITY_VERSION,
	type CodeComplexityResult,
	type InlineCodeComplexitySource,
} from "./types";

export function analyzeCodeComplexity(
	source: InlineCodeComplexitySource,
): CodeComplexityResult {
	const rawMetrics = collectRawMetrics(source);

	const subscores = {
		size: roundSubscore(scoreSize(rawMetrics.astNodes)),
		logic: roundSubscore(scoreLogic(rawMetrics.logicDecisions)),
		reactive: roundSubscore(scoreReactive(rawMetrics.reactiveSurface)),
		nesting: roundSubscore(scoreNesting(rawMetrics.maxNestingDepth)),
		vocabulary: roundSubscore(scoreVocabulary(rawMetrics.vocabulary)),
	};

	return {
		score: totalScore(subscores),
		version: CODE_COMPLEXITY_VERSION,
		subscores,
		raw: {
			astNodes: rawMetrics.astNodes,
			logicDecisions: rawMetrics.logicDecisions,
			reactiveSurface: rawMetrics.reactiveSurface,
			maxNestingDepth: rawMetrics.maxNestingDepth,
			distinctOperators: rawMetrics.distinctOperators,
			distinctOperands: rawMetrics.distinctOperands,
			cssSelectorParts: rawMetrics.cssSelectorParts,
			directives: rawMetrics.directives,
			eventHandlers: rawMetrics.eventHandlers,
			bindings: rawMetrics.bindings,
			stateAtoms: rawMetrics.stateAtoms,
			vocabulary: rawMetrics.vocabulary,
		},
	};
}
