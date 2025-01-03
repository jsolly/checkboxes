import { useEffect, useState } from "react";

interface Framework {
	id: string;
	name: string;
}

const frameworks: Framework[] = [
	{ id: "vanilla", name: "Vanilla JS" },
	{ id: "alpine", name: "Alpine.js" },
	{ id: "vue", name: "Vue" },
	{ id: "react", name: "React" },
	{ id: "svelte", name: "Svelte" },
	{ id: "hyperscript", name: "Hyperscript" },
];

export default function FrameworkSelector() {
	const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>([]);
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		// Initialize with all frameworks selected
		setSelectedFrameworks(frameworks.map((f) => f.id));
		setMounted(true);
	}, []);

	const handleFrameworkToggle = (frameworkId: string) => {
		setSelectedFrameworks((prev) => {
			const newSelection = prev.includes(frameworkId)
				? prev.filter((id) => id !== frameworkId)
				: [...prev, frameworkId];

			// Dispatch custom event for framework selection
			const event = new CustomEvent("frameworkSelection", {
				detail: newSelection,
			});
			document.dispatchEvent(event);

			return newSelection;
		});
	};

	if (!mounted) {
		return (
			<div className="max-w-6xl mx-auto mb-8">
				<div className="bg-white p-4 rounded-lg shadow-sm">
					<h2 className="text-lg font-semibold mb-3 text-slate-700">
						Loading framework selector...
					</h2>
				</div>
			</div>
		);
	}

	return (
		<div className="max-w-6xl mx-auto mb-8">
			<div className="bg-white p-4 rounded-lg shadow-sm">
				<h2 className="text-lg font-semibold mb-3 text-slate-700">
					Select frameworks to compare:
				</h2>
				<div className="flex flex-wrap gap-3">
					{frameworks.map((framework) => (
						<label
							key={framework.id}
							className="flex items-center space-x-2 px-4 py-2 rounded-lg 
							border border-slate-200 cursor-pointer 
							hover:bg-slate-50 transition-colors"
						>
							<input
								type="checkbox"
								checked={selectedFrameworks.includes(framework.id)}
								onChange={() => handleFrameworkToggle(framework.id)}
								className="w-4 h-4 rounded text-blue-600 
								focus:ring-blue-500 focus:ring-2 
								border-slate-300"
							/>
							<span className="text-slate-700 select-none">
								{framework.name}
							</span>
						</label>
					))}
				</div>
			</div>
			<div className="mt-3 text-sm text-slate-500 px-4 hidden lg:block">
				Tip: Drag and drop framework containers to reorder them
			</div>
		</div>
	);
}
