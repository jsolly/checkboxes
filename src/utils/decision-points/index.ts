import { countJavaScriptDecisionPoints } from "./javascript";
import {
	countAstroTemplateDirectives,
	countBehavioralSelectors,
	countDeclarativeAttributes,
	countSvelteTemplateDirectives,
	countVueTemplateDirectives,
	extractScriptBlocks,
	extractStyleBlocks,
	removeScriptAndStyleBlocks,
} from "./markup";
import { normalizeDecisionPointScore } from "./normalize";
import type {
	DecisionPointBreakdown,
	DecisionPointResult,
	InlineDecisionPointSource,
} from "./types";

const javaScriptExtensions = new Set([".js", ".jsx", ".ts", ".tsx"]);

export function analyzeDecisionPoints(
	source: InlineDecisionPointSource,
): DecisionPointResult {
	const breakdown = analyzeBreakdown(source);
	const value =
		breakdown.jsControlFlow +
		breakdown.templateDirectives +
		breakdown.selectors +
		breakdown.declarativeAttrs;

	return {
		value,
		normalizedScore: normalizeDecisionPointScore(value),
		breakdown,
	};
}

function analyzeBreakdown(
	source: InlineDecisionPointSource,
): DecisionPointBreakdown {
	if (javaScriptExtensions.has(source.extension)) {
		return {
			jsControlFlow: countJavaScriptDecisionPoints(source.code),
			templateDirectives: 0,
			selectors: 0,
			declarativeAttrs: 0,
		};
	}

	if (source.extension === ".vue") {
		const scripts = extractScriptBlocks(source.code).join("\n");
		const template = removeScriptAndStyleBlocks(source.code);
		return {
			jsControlFlow: countJavaScriptDecisionPoints(scripts),
			templateDirectives: countVueTemplateDirectives(template),
			selectors: countBehavioralSelectors(
				extractStyleBlocks(source.code).join("\n"),
			),
			declarativeAttrs: countDeclarativeAttributes(template),
		};
	}

	if (source.extension === ".svelte") {
		const scripts = extractScriptBlocks(source.code).join("\n");
		const template = removeScriptAndStyleBlocks(source.code);
		return {
			jsControlFlow: countJavaScriptDecisionPoints(scripts),
			templateDirectives: countSvelteTemplateDirectives(template),
			selectors: countBehavioralSelectors(
				extractStyleBlocks(source.code).join("\n"),
			),
			declarativeAttrs: countDeclarativeAttributes(template),
		};
	}

	if (source.extension === ".astro" || source.extension === ".html") {
		const scripts = extractScriptBlocks(source.code).join("\n");
		const template = removeScriptAndStyleBlocks(source.code);
		return {
			jsControlFlow: countJavaScriptDecisionPoints(scripts),
			templateDirectives: countAstroTemplateDirectives(template),
			selectors: countBehavioralSelectors(
				extractStyleBlocks(source.code).join("\n"),
			),
			declarativeAttrs: countDeclarativeAttributes(template),
		};
	}

	throw new Error(
		`Unsupported implementation file extension "${source.extension}" for ${source.relativePath}`,
	);
}
