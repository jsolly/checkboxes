import { FrameworkSortProvider } from "../contexts/FrameworkSortContext";
import FrameworkSelector from "./FrameworkSelector";
import FrameworkSort from "./FrameworkSort";

export default function FrameworkControls() {
	return (
		<FrameworkSortProvider>
			<FrameworkSelector />
			<FrameworkSort />
		</FrameworkSortProvider>
	);
}
