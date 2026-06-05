import { analyzeDecisionPoints } from "../decision-points";
import {
	extractScriptBlocks,
	extractStyleBlocks,
	removeScriptAndStyleBlocks,
} from "../decision-points/markup";
import type { InlineDecisionPointSource } from "../decision-points/types";
import { stripPresentation } from "./clean";

const JS_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);

function countMatches(value: string, pattern: RegExp): number {
	return Array.from(value.matchAll(pattern)).length;
}

function tokenize(value: string): string[] {
	return (
		value.match(
			/[A-Za-z_$][\w$-]*|#[\w-]+|\.[\w-]+|:[\w-]+|[{}()[\].,:;?+\-*/=!<>~|&]+|"[^"]*"|'[^']*'/g,
		) ?? []
	);
}

function countStructuralTokens(code: string): number {
	return tokenize(stripPresentation(code)).length;
}

function countDistinctVocabulary(code: string): number {
	const tokens = tokenize(stripPresentation(code)).filter(
		(token) =>
			!/^[{}()[\].,:;]+$/.test(token) &&
			!/^['"]/.test(token) &&
			!/^(Child|Parent|\d+)$/.test(token),
	);
	return new Set(tokens).size;
}

function maxBraceDepth(code: string): number {
	let depth = 0;
	let max = 0;
	for (const ch of code) {
		if (ch === "{") {
			depth += 1;
			max = Math.max(max, depth);
		}
		if (ch === "}") {
			depth = Math.max(0, depth - 1);
		}
	}
	return max;
}

function maxTemplateControlDepth(markup: string): number {
	let depth = 0;
	let max = 0;
	const tagPattern = /<\/?[\w-]+[^>]*>/g;
	const controlPattern =
		/\bv-(?:if|for|else-if|show)\b|\{#(?:if|each|await)\b|\bx-(?:if|for|show)\b/;

	for (const match of markup.matchAll(tagPattern)) {
		const tag = match[0];
		if (tag.startsWith("</")) {
			depth = Math.max(0, depth - 1);
			continue;
		}

		if (!tag.endsWith("/>")) {
			depth += 1;
		}

		if (controlPattern.test(tag)) {
			max = Math.max(max, depth);
		}
	}

	return max;
}

function countSelectorStateDepth(styles: string): number {
	const hasCount = countMatches(styles, /:has\s*\(/g);
	const combinatorCount = countMatches(styles, /[+~]/g);
	return Math.min(6, hasCount + Math.ceil(combinatorCount / 2));
}

function countReactiveSurface(code: string): {
	reactiveSurface: number;
	directives: number;
	eventHandlers: number;
	bindings: number;
	stateAtoms: number;
} {
	const stateAtoms =
		countMatches(
			code,
			/\b(?:useState|useReducer|useRef|useEffect|us eMemo|useCallback|\$state|\$derived|\$effect|reactive|(?<!-)computed|watch)\b/g,
		) +
		countMatches(code, /\bdata-signals\b|\bdata-computed\b|\bdata-effect\b/g) +
		countMatches(code, /\bx-data\b/g);

	const eventHandlers =
		countMatches(code, /\bon[A-Z][A-Za-z]*\s*=/g) +
		countMatches(
			code,
			/\b(?:@\w+|v-on(?::\w+)?|x-on(?::\w+)?|data-on-[\w:-]+)\s*=/g,
		) +
		countMatches(code, /\b_=\s*(["'])/g);

	const bindings =
		countMatches(
			code,
			/\b(?:v-model|x-model|bind:|v-bind(?::\w+)?|data-bind(?::\w+)?)\b/g,
		) +
		countMatches(code, /\b(?:ref=|x-ref|data-ref)\b/g) +
		countMatches(code, /\b(?:checked=|:checked)\b/g);

	const directives =
		countMatches(code, /\bv-if(?!-)\b|\bv-else-if\b|\bv-show\b|\bv-for\b/g) +
		countMatches(code, /\bx-show\b|\bx-if\b|\bx-for\b/g) +
		countMatches(code, /\b(?:data-show|data-if|data-for)\b/g) +
		countMatches(
			code,
			/\b(?:client:visible|client:media|client:only|client:load)\b/g,
		) +
		countMatches(code, /\{#(?:if|each|await|key)\b|\{:else if\b/g);

	const reactiveSurface = stateAtoms + eventHandlers + bindings + directives;

	return {
		reactiveSurface,
		directives,
		eventHandlers,
		bindings,
		stateAtoms,
	};
}

function countCssSelectorParts(styles: string): number {
	return countMatches(
		styles,
		/:[\w-]+(?:\([^)]*\))?|[+~>]|::[\w-]+|\[[^\]]+\]|\.[\w-]+|#[\w-]+|\b[\w-]+\b/g,
	);
}

function countDistinctOperatorsAndOperands(code: string): {
	distinctOperators: number;
	distinctOperands: number;
} {
	const cleaned = stripPresentation(code);
	const operators = new Set<string>();
	const operands = new Set<string>();

	for (const token of tokenize(cleaned)) {
		if (/^[{}()[\].,:;?+\-*/=!<>~|&]+$/.test(token)) {
			operators.add(token);
		} else if (!/^['"]/.test(token)) {
			operands.add(token);
		}
	}

	return {
		distinctOperators: operators.size,
		distinctOperands: operands.size,
	};
}

export function collectRawMetrics(source: InlineDecisionPointSource) {
	const cleaned = stripPresentation(source.code);
	const scripts = extractScriptBlocks(source.code).join("\n");
	const markup = stripPresentation(removeScriptAndStyleBlocks(source.code));
	const styles = extractStyleBlocks(source.code).join("\n");

	const decisionResult = analyzeDecisionPoints(source);
	const reactive = countReactiveSurface(source.code);
	const { distinctOperators, distinctOperands } =
		countDistinctOperatorsAndOperands(source.code);

	const controlDepth = Math.max(
		maxBraceDepth(JS_EXTENSIONS.has(source.extension) ? source.code : scripts),
		maxTemplateControlDepth(markup),
		countSelectorStateDepth(styles),
	);

	return {
		astNodes: countStructuralTokens(cleaned),
		logicDecisions: decisionResult.value,
		reactiveSurface: reactive.reactiveSurface,
		maxNestingDepth: controlDepth,
		distinctOperators,
		distinctOperands,
		cssSelectorParts: countCssSelectorParts(styles),
		directives: reactive.directives,
		eventHandlers: reactive.eventHandlers,
		bindings: reactive.bindings,
		stateAtoms: reactive.stateAtoms,
		vocabulary: countDistinctVocabulary(source.code),
	};
}
