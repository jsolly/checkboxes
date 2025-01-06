import { useEffect, useState } from "react";
import { FRAMEWORKS, type FrameworkId } from "../config/frameworks";
import frameworkStats from "../data/framework-stats.json";

type SortOption =
	| "bundleSizeAsc"
	| "bundleSizeDsc"
	| "renderTimeAsc"
	| "renderTimeDsc"
	| "none";

type Metric = "bundleSize" | "renderTime";

export default function FrameworkSort() {
	const [sortBy, setSortBy] = useState<SortOption>("none");
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);

		// Listen for manual sort events
		const handleManualSort = () => {
			setSortBy("none");
		};
		document.addEventListener("manualSort", handleManualSort);

		return () => {
			document.removeEventListener("manualSort", handleManualSort);
		};
	}, []);

	const handleSort = (option: SortOption) => {
		setSortBy(option);

		if (option === "none") {
			const event = new CustomEvent("frameworkSort", {
				detail: { type: "none" },
			});
			document.dispatchEvent(event);
			return;
		}

		const metric: Metric = option.includes("bundleSize")
			? "bundleSize"
			: "renderTime";
		const isAscending = option.includes("Asc");

		const frameworkIds = Object.keys(FRAMEWORKS) as FrameworkId[];
		const sortedFrameworks = [...frameworkIds].sort((a, b) => {
			const valueA = Number.parseFloat(frameworkStats[a][metric]);
			const valueB = Number.parseFloat(frameworkStats[b][metric]);
			return isAscending ? valueA - valueB : valueB - valueA;
		});

		const event = new CustomEvent("frameworkSort", {
			detail: { type: option, order: sortedFrameworks },
		});
		document.dispatchEvent(event);
	};

	if (!mounted) {
		return (
			<div className="max-w-6xl mx-auto mb-4 flex justify-end px-4">
				<div className="flex items-center gap-2">
					<span className="text-slate-700 text-sm" aria-label="Loading state">
						Loading...
					</span>
				</div>
			</div>
		);
	}

	return (
		<div className="max-w-6xl mx-auto mb-4 flex justify-end px-4">
			<div className="flex items-center gap-2">
				<label htmlFor="framework-sort" className="text-slate-700 text-sm">
					Sort by:
				</label>
				<select
					id="framework-sort"
					value={sortBy}
					onChange={(e) => handleSort(e.target.value as SortOption)}
					className="px-3 py-2 border border-slate-200 rounded-lg text-slate-700
            focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
				>
					<option value="none">Manual Order</option>
					<optgroup label="Bundle Size">
						<option value="bundleSizeAsc">Bundle Size (smallest first)</option>
						<option value="bundleSizeDsc">Bundle Size (largest first)</option>
					</optgroup>
					<optgroup label="Render Time">
						<option value="renderTimeAsc">Render Time (fastest first)</option>
						<option value="renderTimeDsc">Render Time (slowest first)</option>
					</optgroup>
				</select>
			</div>
		</div>
	);
}
