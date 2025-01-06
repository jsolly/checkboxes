import { useEffect, useState } from "react";
import { useFrameworkSort } from "../contexts/FrameworkSortContext";

type SortOption =
	| "bundleSizeAsc"
	| "bundleSizeDsc"
	| "renderTimeAsc"
	| "renderTimeDsc"
	| "none";

export default function FrameworkSort() {
	const [mounted, setMounted] = useState(false);
	const { sortBy, setSortBy } = useFrameworkSort();

	useEffect(() => {
		setMounted(true);
	}, []);

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
