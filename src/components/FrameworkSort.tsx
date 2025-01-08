import { useEffect, useState } from "react";
import { useFrameworkSort } from "../contexts/FrameworkSortContext";
import { SortOption } from "../types/sort";

export default function FrameworkSort() {
	const [mounted, setMounted] = useState(false);
	const { sortBy, setSortBy } = useFrameworkSort();

	useEffect(() => {
		setMounted(true);

		const handleManualSort = () => {
			setSortBy(SortOption.None);
		};

		document.addEventListener("frameworkDragSort", handleManualSort);

		return () => {
			document.removeEventListener("frameworkDragSort", handleManualSort);
		};
	}, [setSortBy]);

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
					onChange={(e) => setSortBy(e.target.value as SortOption)}
					className="px-3 py-2 border border-slate-200 rounded-lg text-slate-700
            focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
				>
					<option value={SortOption.None} aria-label="No sorting, manual order">
						Manual Order
					</option>
					<optgroup label="Bundle Size">
						<option
							value={SortOption.BundleSizeAsc}
							aria-label="Sort by bundle size, ascending"
						>
							Bundle Size (smallest first)
						</option>
						<option
							value={SortOption.BundleSizeDsc}
							aria-label="Sort by bundle size, descending"
						>
							Bundle Size (largest first)
						</option>
					</optgroup>
					<optgroup label="Complexity">
						<option
							value={SortOption.ComplexityAsc}
							aria-label="Sort by complexity score, ascending"
						>
							Complexity (simplest first)
						</option>
						<option
							value={SortOption.ComplexityDsc}
							aria-label="Sort by complexity score, descending"
						>
							Complexity (most complex first)
						</option>
					</optgroup>
				</select>
			</div>
		</div>
	);
}
