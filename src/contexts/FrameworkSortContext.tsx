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

export function FrameworkSortProvider({ children }: { children: ReactNode }) {
	// Listen for manual sort events
	useEffect(() => {
		const handleManualSort = () => {
			setSortBy(SortOption.None);
		};
		document.addEventListener("manualSort", handleManualSort);
		return () => document.removeEventListener("manualSort", handleManualSort);
	}, []);

	const [sortBy, setSortBy] = useState<SortOption>(SortOption.None);
	const [sortedFrameworks, setSortedFrameworks] = useState<FrameworkId[]>(
		() => {
			// Get default order from FRAMEWORKS object
			const defaultOrder = Object.keys(FRAMEWORKS) as FrameworkId[];

			// Try to get saved order
			const savedOrder = localStorage.getItem("frameworkOrder");
			if (!savedOrder) return defaultOrder;

			try {
				const parsed = JSON.parse(savedOrder);
				const validOrder = parsed.filter(
					(id: unknown): id is FrameworkId =>
						typeof id === "string" && id in FRAMEWORKS,
				);

				if (!validOrder.length) return defaultOrder;

				const missingFrameworks = defaultOrder.filter(
					(id) => !validOrder.includes(id),
				);
				return [...validOrder, ...missingFrameworks];
			} catch {
				return defaultOrder;
			}
		},
	);

	const handleSort = (option: SortOption) => {
		setSortBy(option);

		let newOrder: FrameworkId[];
		if (option === SortOption.None) {
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
			const metric =
				option === SortOption.BundleSizeAsc ||
				option === SortOption.BundleSizeDsc
					? "bundleSize"
					: "complexityScore";

			const isAscending =
				option === SortOption.BundleSizeAsc ||
				option === SortOption.ComplexityAsc;

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
					if (typeof frameworkStats[id][metric] !== "number") {
						console.warn(`No ${metric} found for framework: ${id}`);
						return false;
					}
					return true;
				})
				.sort((a, b) => {
					const valueA = frameworkStats[a][metric];
					const valueB = frameworkStats[b][metric];
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
