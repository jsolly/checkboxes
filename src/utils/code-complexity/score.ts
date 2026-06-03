const SIZE_DIVISOR = 24;
const VOCAB_DIVISOR = 8;

export function scoreSize(astNodes: number): number {
	return Math.min(20, 6 * Math.log2(1 + astNodes / SIZE_DIVISOR));
}

export function scoreLogic(logicDecisions: number): number {
	return Math.min(20, 5 * Math.log2(1 + logicDecisions));
}

export function scoreReactive(reactiveSurface: number): number {
	return Math.min(20, 4 * Math.log2(1 + reactiveSurface));
}

export function scoreNesting(depth: number): number {
	return Math.min(20, 2.5 * depth + 0.5 * depth ** 2);
}

export function scoreVocabulary(vocabulary: number): number {
	return Math.min(20, 5 * Math.log2(1 + vocabulary / VOCAB_DIVISOR));
}

export function roundSubscore(value: number): number {
	return Math.round(value * 10) / 10;
}

export function totalScore(subscores: {
	size: number;
	logic: number;
	reactive: number;
	nesting: number;
	vocabulary: number;
}): number {
	return Math.round(
		subscores.size +
			subscores.logic +
			subscores.reactive +
			subscores.nesting +
			subscores.vocabulary,
	);
}
