import { useEffect, useState } from "react";
import { useFrameworkSort } from "../contexts/frameworkSort";
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
					<span role="status" className="text-slate-700 text-sm">
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
					Sort
				</label>
				<select
					id="framework-sort"
					value={sortBy}
					onChange={(e) => setSortBy(e.target.value as SortOption)}
					className="px-3 py-2 border border-slate-200 rounded-lg text-slate-700
            focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
				>
					<option value={SortOption.None}>Manual Order</option>
					<optgroup label="Bundle Size">
						<option value={SortOption.BundleSizeAsc}>
							Bundle Size (smallest first)
						</option>
						<option value={SortOption.BundleSizeDsc}>
							Bundle Size (largest first)
						</option>
					</optgroup>
					<optgroup label="Source Lines">
						<option value={SortOption.SourceLinesAsc}>
							Lines (shortest first)
						</option>
						<option value={SortOption.SourceLinesDsc}>
							Lines (longest first)
						</option>
					</optgroup>
					<optgroup label="Code Complexity">
						<option value={SortOption.CodeComplexityAsc}>
							Code Complexity (simplest first)
						</option>
						<option value={SortOption.CodeComplexityDsc}>
							Code Complexity (most complex first)
						</option>
					</optgroup>
					<optgroup label="Vibe Complexity">
						<option value={SortOption.VibeComplexityAsc}>
							Vibe Complexity (simplest first)
						</option>
						<option value={SortOption.VibeComplexityDsc}>
							Vibe Complexity (most complex first)
						</option>
					</optgroup>
				</select>
			</div>
		</div>
	);
}
