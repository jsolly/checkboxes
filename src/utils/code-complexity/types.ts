import type { FrameworkId } from "../../config/frameworks";

export const CODE_COMPLEXITY_VERSION = "cc-1.0.0";

export interface CodeComplexitySubscores {
	size: number;
	logic: number;
	reactive: number;
	nesting: number;
	vocabulary: number;
}

export interface CodeComplexityRaw {
	astNodes: number;
	logicDecisions: number;
	reactiveSurface: number;
	maxNestingDepth: number;
	distinctOperators: number;
	distinctOperands: number;
	cssSelectorParts: number;
	directives: number;
	eventHandlers: number;
	bindings: number;
	stateAtoms: number;
	vocabulary: number;
}

export interface CodeComplexityResult {
	score: number;
	version: string;
	subscores: CodeComplexitySubscores;
	raw: CodeComplexityRaw;
}

export interface InlineCodeComplexitySource {
	framework: FrameworkId;
	absolutePath: string;
	relativePath: string;
	extension: string;
	code: string;
}
