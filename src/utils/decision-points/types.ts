import type { FrameworkId } from "../../config/frameworks";
import type { ImplementationSource } from "../implementationSources";

export const DECISION_POINT_SCORE_CAP = 30;

export interface DecisionPointBreakdown {
	jsControlFlow: number;
	templateDirectives: number;
	selectors: number;
	declarativeAttrs: number;
}

export interface DecisionPointResult {
	value: number;
	normalizedScore: number;
	breakdown: DecisionPointBreakdown;
}

export type DecisionPointSource = ImplementationSource;

export interface InlineDecisionPointSource {
	framework: FrameworkId;
	absolutePath: string;
	relativePath: string;
	extension: string;
	code: string;
}
