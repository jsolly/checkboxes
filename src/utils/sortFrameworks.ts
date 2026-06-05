import { FRAMEWORKS, type FrameworkId } from "../config/frameworks";
import stats from "../data/framework-stats.json";
import { SortMetric, SortOption } from "../types/sort";

export const getSavedOrder = () => {
	const savedOrder = localStorage.getItem("frameworkOrder");
	return savedOrder
		? JSON.parse(savedOrder).filter(Boolean)
		: Object.keys(FRAMEWORKS);
};

const getMetricAndDirection = (option: SortOption): [SortMetric, boolean] => {
	if (option.includes("bundleSize")) {
		return [SortMetric.BundleSize, option.endsWith("Asc")];
	}
	if (option.includes("sourceLines")) {
		return [SortMetric.SourceLines, option.endsWith("Asc")];
	}
	if (option.includes("codeComplexity")) {
		return [SortMetric.CodeComplexity, option.endsWith("Asc")];
	}
	return [SortMetric.VibeComplexity, option.endsWith("Asc")];
};

export const sortFrameworks = (
	frameworks: FrameworkId[],
	option: SortOption,
) => {
	if (option === SortOption.None) {
		return getSavedOrder();
	}

	const [metric, isAscending] = getMetricAndDirection(option);
	return [...frameworks].sort((a, b) => {
		const valueA = stats.frameworks[a][metric];
		const valueB = stats.frameworks[b][metric];
		return isAscending ? valueA - valueB : valueB - valueA;
	});
};
