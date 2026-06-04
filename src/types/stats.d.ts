import type { BundleMeasurementAudit } from "../utils/bundleMeasurement";
import type {
	CodeComplexityRaw,
	CodeComplexitySubscores,
} from "../utils/code-complexity/types";

export type { CodeComplexityRaw, CodeComplexitySubscores };
export type { BundleMeasurementAudit };

export interface FrameworkStats {
	bundleSize: number;
	bundleMeasurement: BundleMeasurementAudit;
	codeComplexity: number;
	vibeComplexity: number;
	bundleSizeZScore: number;
	codeComplexityZScore: number;
	vibeComplexityZScore: number;
	codeComplexitySubscores: CodeComplexitySubscores;
	codeComplexityRaw: CodeComplexityRaw;
}

export type FrameworkStatsRecord = Record<string, FrameworkStats>;
