import { FRAMEWORKS, type FrameworkId } from "../config/frameworks";
import frameworkStats from "../data/framework-stats.json";
import { SortMetric, SortOption } from "../types/sort";

export const getSavedOrder = () => {
	const savedOrder = localStorage.getItem("frameworkOrder");
	return savedOrder
		? JSON.parse(savedOrder).filter(Boolean)
		: Object.keys(FRAMEWORKS);
};

const getMetricAndDirection = (option: SortOption): [SortMetric, boolean] => {
	const metric = option.includes("bundleSize")
		? SortMetric.BundleSize
		: SortMetric.Complexity;
	const isAscending = option.endsWith("Asc");
	return [metric, isAscending];
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
		const valueA = frameworkStats[a][metric];
		const valueB = frameworkStats[b][metric];
		return isAscending ? valueA - valueB : valueB - valueA;
	});
};
