import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { FrameworkId } from "../config/frameworks";
import { SortOption } from "../types/sort";
import { getSavedOrder, sortFrameworks } from "../utils/sortFrameworks";
import { FrameworkSortContext } from "./frameworkSort";
// Test
const FrameworkSortProvider = ({ children }: { children: ReactNode }) => {
	const [sortBy, setSortBy] = useState<SortOption>(SortOption.None);
	const [sortedFrameworks, setSortedFrameworks] =
		useState<FrameworkId[]>(getSavedOrder);

	useEffect(() => {
		const handleManualSort = () => setSortBy(SortOption.None);
		document.addEventListener("frameworkDragSort", handleManualSort);
		return () =>
			document.removeEventListener("frameworkDragSort", handleManualSort);
	}, []);

	const handleSort = (option: SortOption) => {
		setSortBy(option);
		const newOrder = sortFrameworks(sortedFrameworks, option);
		setSortedFrameworks(newOrder);

		document.dispatchEvent(
			new CustomEvent("frameworkMetricSort", {
				detail: { type: option, order: newOrder },
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
};

export { FrameworkSortProvider };
