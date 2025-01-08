import type { FrameworkId } from "../config/frameworks";
import type { SortOption } from "./sort";

export interface FrameworkSortContextType {
	sortBy: SortOption;
	setSortBy: (option: SortOption) => void;
	sortedFrameworks: FrameworkId[];
}
