import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { FRAMEWORKS, type FrameworkId } from "../config/frameworks";
import frameworkStats from "../data/framework-stats.json";

type SortOption =
	| "bundleSizeAsc"
	| "bundleSizeDsc"
	| "renderTimeAsc"
	| "renderTimeDsc"
	| "none";

interface FrameworkSortContextType {
	sortBy: SortOption;
	setSortBy: (option: SortOption) => void;
	sortedFrameworks: FrameworkId[];
}

const FrameworkSortContext = createContext<
	FrameworkSortContextType | undefined
>(undefined);

export function FrameworkSortProvider({ children }: { children: ReactNode }) {
	// Add validation of framework stats
	useEffect(() => {
		// Validate framework stats on mount
		const frameworkIds = Object.keys(FRAMEWORKS) as FrameworkId[];
		const missingStats = frameworkIds.filter((id) => !frameworkStats[id]);
		if (missingStats.length > 0) {
			console.error("Missing stats for frameworks:", missingStats);
		}
	}, []);

	const [sortBy, setSortBy] = useState<SortOption>("none");
	const [sortedFrameworks, setSortedFrameworks] = useState<FrameworkId[]>(
		() => {
			// Get default order from FRAMEWORKS object
			const defaultOrder = Object.keys(FRAMEWORKS) as FrameworkId[];

			// Try to get saved order
			if (typeof window !== "undefined") {
				const savedOrder = localStorage.getItem("frameworkOrder");
				if (savedOrder) {
					try {
						const parsed = JSON.parse(savedOrder);
						// Ensure all saved frameworks exist in FRAMEWORKS
						const validOrder = parsed.filter(
							(id: unknown): id is FrameworkId =>
								id !== null && typeof id === "string" && id in FRAMEWORKS,
						);
						// If we have valid frameworks, use them
						if (validOrder.length > 0) {
							// Add any missing frameworks to the end
							const missingFrameworks = defaultOrder.filter(
								(id) => !validOrder.includes(id),
							);
							return [...validOrder, ...missingFrameworks];
						}
					} catch (e) {
						console.error("Error parsing saved framework order:", e);
					}
				}
			}
			return defaultOrder;
		},
	);

	// Listen for manual sort events
	useEffect(() => {
		const handleManualSort = () => {
			setSortBy("none");
		};
		document.addEventListener("manualSort", handleManualSort);
		return () => document.removeEventListener("manualSort", handleManualSort);
	}, []);

	const handleSort = (option: SortOption) => {
		setSortBy(option);

		let newOrder: FrameworkId[];
		if (option === "none") {
			// Restore saved order from localStorage
			const savedOrder = localStorage.getItem("frameworkOrder");
			if (savedOrder) {
				try {
					const parsed = JSON.parse(savedOrder);
					// Filter out null values and validate framework IDs
					newOrder = parsed.filter(
						(id: unknown): id is FrameworkId =>
							id !== null && typeof id === "string" && id in FRAMEWORKS,
					);
				} catch (e) {
					console.error("Error parsing saved framework order:", e);
					newOrder = Object.keys(FRAMEWORKS) as FrameworkId[];
				}
			} else {
				newOrder = Object.keys(FRAMEWORKS) as FrameworkId[];
			}
		} else {
			const metric = option.includes("bundleSize")
				? "bundleSize"
				: "renderTime";
			const isAscending = option.includes("Asc");

			newOrder = [...sortedFrameworks]
				.filter((id): id is FrameworkId => {
					if (id === null) {
						console.warn("Found null framework ID");
						return false;
					}
					if (!frameworkStats[id]) {
						console.warn(`No stats found for framework: ${id}`);
						return false;
					}
					if (!frameworkStats[id][metric]) {
						console.warn(`No ${metric} found for framework: ${id}`);
						return false;
					}
					return true;
				})
				.sort((a, b) => {
					// Strip 'ms' or 'kb' and parse as float
					const valueA = Number.parseFloat(
						frameworkStats[a][metric].replace(/[a-z]+$/, ""),
					);
					const valueB = Number.parseFloat(
						frameworkStats[b][metric].replace(/[a-z]+$/, ""),
					);

					if (Number.isNaN(valueA) || Number.isNaN(valueB)) {
						console.warn(`Invalid values for sorting: ${valueA}, ${valueB}`);
						return 0;
					}

					return isAscending ? valueA - valueB : valueB - valueA;
				});

			if (newOrder.length === 0) {
				console.warn(
					"No valid frameworks found for sorting, using default order",
				);
				newOrder = Object.keys(FRAMEWORKS) as FrameworkId[];
			}
		}

		setSortedFrameworks(newOrder);

		// Dispatch event to update DOM order
		document.dispatchEvent(
			new CustomEvent("frameworkSort", {
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

export function useFrameworkSort() {
	const context = useContext(FrameworkSortContext);
	if (context === undefined) {
		throw new Error(
			"useFrameworkSort must be used within a FrameworkSortProvider",
		);
	}
	return context;
}
