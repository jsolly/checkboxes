import type { FrameworkId } from "../config/frameworks";
import type { BundleMeasurementAudit } from "../utils/bundleMeasurement";
import type {
	CodeComplexityRaw,
	CodeComplexitySubscores,
} from "../utils/code-complexity/types";

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

export interface StatsMetadata {
	lastUpdated: string;
	description: string;
	codeComplexityVersion: string;
	bundleMeasurementVersion: string;
	metrics: {
		bundleSize: string;
		codeComplexity: string;
		vibeComplexity: string;
		bundleSizeZScore: string;
		codeComplexityZScore: string;
		vibeComplexityZScore: string;
	};
}

export interface StatsFile {
	metadata: StatsMetadata;
	frameworks: Record<FrameworkId, FrameworkStats>;
}

export type FrameworkStatsRecord = Record<string, FrameworkStats>;
