export interface DecisionPointBreakdown {
	jsControlFlow: number;
	templateDirectives: number;
	selectors: number;
	declarativeAttrs: number;
}

export interface FrameworkStats {
	bundleSize: number;
	decisionPoints: number;
	decisionPointScore: number;
	vibeComplexity: number;
	bundleSizeZScore: number;
	decisionPointZScore: number;
	vibeComplexityZScore: number;
	decisionPointBreakdown: DecisionPointBreakdown;
}

export type FrameworkStatsRecord = Record<string, FrameworkStats>;
