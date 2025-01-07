export interface FrameworkStats {
	bundleSize: number;
	complexityScore: number;
	bundleSizeZScore: number;
	complexityZScore: number;
}

export type FrameworkStatsRecord = Record<string, FrameworkStats>;
