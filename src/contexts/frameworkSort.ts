import { createContext, useContext } from "react";
import type { FrameworkSortContextType } from "../types/framework-context";

export const FrameworkSortContext = createContext<
	FrameworkSortContextType | undefined
>(undefined);

export const useFrameworkSort = () => {
	const context = useContext(FrameworkSortContext);
	if (!context)
		throw new Error(
			"useFrameworkSort must be used within a FrameworkSortProvider",
		);
	return context;
};
