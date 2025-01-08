import { FrameworkSortProvider } from "../contexts/FrameworkSortContext";
import FrameworkSort from "./FrameworkSort";

export default function FrameworkControls() {
	return (
		<FrameworkSortProvider>
			<FrameworkSort />
		</FrameworkSortProvider>
	);
}
