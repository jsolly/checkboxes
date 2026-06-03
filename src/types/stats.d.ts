import type {
	CodeComplexityRaw,
	CodeComplexitySubscores,
} from "../utils/code-complexity/types";

export type { CodeComplexityRaw, CodeComplexitySubscores };

export interface FrameworkStats {
	bundleSize: number;
	codeComplexity: number;
	vibeComplexity: number;
	bundleSizeZScore: number;
	codeComplexityZScore: number;
	vibeComplexityZScore: number;
	codeComplexitySubscores: CodeComplexitySubscores;
	codeComplexityRaw: CodeComplexityRaw;
}

export type FrameworkStatsRecord = Record<string, FrameworkStats>;
