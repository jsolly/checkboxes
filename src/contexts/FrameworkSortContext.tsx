import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { FRAMEWORKS, type FrameworkId } from "../config/frameworks";
import frameworkStats from "../data/framework-stats.json";
import { SortOption } from "../types/sort";

interface FrameworkSortContextType {
	sortBy: SortOption;
	setSortBy: (option: SortOption) => void;
	sortedFrameworks: FrameworkId[];
}

const FrameworkSortContext = createContext<
	FrameworkSortContextType | undefined
>(undefined);

export function useFrameworkSort() {
	const context = useContext(FrameworkSortContext);
	if (!context)
		throw new Error(
			"useFrameworkSort must be used within a FrameworkSortProvider",
		);
	return context;
}

export function FrameworkSortProvider({ children }: { children: ReactNode }) {
	useEffect(() => {
		const handleManualSort = () => setSortBy(SortOption.None);
		document.addEventListener("frameworkDragSort", handleManualSort);
		return () =>
			document.removeEventListener("frameworkDragSort", handleManualSort);
	}, []);

	const [sortBy, setSortBy] = useState<SortOption>(SortOption.None);
	const [sortedFrameworks, setSortedFrameworks] = useState<FrameworkId[]>(
		() => {
			const defaultOrder = Object.keys(FRAMEWORKS) as FrameworkId[];
			const savedOrder = localStorage.getItem("frameworkOrder");

			if (!savedOrder) return defaultOrder;

			// Clean up the saved order by removing null values
			const parsed = JSON.parse(savedOrder);
			const validFrameworks = parsed.filter(
				(id: unknown): id is FrameworkId =>
					id !== null && typeof id === "string",
			);

			// If we have no valid frameworks, return default order
			return validFrameworks.length ? validFrameworks : defaultOrder;
		},
	);

	const handleSort = (option: SortOption) => {
		setSortBy(option);

		let newOrder: FrameworkId[];
		if (option === SortOption.None) {
			const savedOrder = localStorage.getItem("frameworkOrder");
			newOrder = savedOrder
				? JSON.parse(savedOrder).filter((id: unknown) => id !== null)
				: Object.keys(FRAMEWORKS);
		} else {
			const metric =
				option === SortOption.BundleSizeAsc ||
				option === SortOption.BundleSizeDsc
					? "bundleSize"
					: "complexityScore";

			const isAscending =
				option === SortOption.BundleSizeAsc ||
				option === SortOption.ComplexityAsc;

			for (const id of sortedFrameworks) {
				if (!(id in frameworkStats)) {
					console.log("Framework missing from stats:", id);
				}
			}

			newOrder = [...sortedFrameworks]
				.filter((id) => id in frameworkStats)
				.sort((a, b) => {
					const valueA = frameworkStats[a][metric];
					const valueB = frameworkStats[b][metric];
					return isAscending ? valueA - valueB : valueB - valueA;
				});

			const missingFrameworks = sortedFrameworks.filter(
				(id) => !(id in frameworkStats),
			);
			newOrder = [...newOrder, ...missingFrameworks];
		}

		setSortedFrameworks(newOrder);

		document.dispatchEvent(
			new CustomEvent("frameworkMetricSort", {
				detail: {
					type: option,
					order: newOrder,
				},
			}),
		);
	};

	return (
		<FrameworkSortContext.Provider
			value={{ sortBy, setSortBy: handleSort, sortedFrameworks }}
		>
			{children}
		</FrameworkSortContext.Provider>
	);
}
