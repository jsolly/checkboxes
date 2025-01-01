import { useEffect, useRef, useState } from "react";

interface CheckboxItem {
	id: string;
	label: string;
}

const parentCheckbox: CheckboxItem = {
	id: "parent-react",
	label: "Parent Checkbox",
};

const childCheckboxItems: CheckboxItem[] = [
	{ id: "child1-react", label: "Child 1" },
	{ id: "child2-react", label: "Child 2" },
	{ id: "child3-react", label: "Child 3" },
];

export default function NestedCheckboxes() {
	const [childStates, setChildStates] = useState<Record<string, boolean>>(
		() => {
			const initial: Record<string, boolean> = {};
			for (const item of childCheckboxItems) {
				initial[item.id] = false;
			}
			return initial;
		},
	);

	const [parentChecked, setParentChecked] = useState(false);
	const [isIndeterminate, setIsIndeterminate] = useState(false);
	const parentRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const allChecked = Object.values(childStates).every(Boolean);
		const someChecked = Object.values(childStates).some(Boolean);

		setParentChecked(allChecked);
		setIsIndeterminate(someChecked && !allChecked);
	}, [childStates]);

	useEffect(() => {
		if (parentRef.current) {
			parentRef.current.indeterminate = isIndeterminate;
		}
	}, [isIndeterminate]);

	const handleParentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.checked;
		setParentChecked(newValue);
		const newStates: Record<string, boolean> = {};
		for (const key of Object.keys(childStates)) {
			newStates[key] = newValue;
		}
		setChildStates(newStates);
	};

	const handleChildChange =
		(id: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
			setChildStates((prev) => ({
				...prev,
				[id]: e.target.checked,
			}));
		};

	return (
		<div className="bg-white rounded-lg p-3 border border-slate-200">
			<h2 className="text-lg font-semibold text-slate-800 mb-3">React</h2>
			<div className="space-y-1">
				{/* Parent Checkbox */}
				<div className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
					<div className="flex items-center space-x-3">
						<input
							ref={parentRef}
							type="checkbox"
							id={parentCheckbox.id}
							className="h-4 w-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
							checked={parentChecked}
							onChange={handleParentChange}
						/>
						<label
							htmlFor={parentCheckbox.id}
							className="text-slate-700 cursor-pointer text-sm font-medium"
						>
							{parentCheckbox.label}
						</label>
					</div>
				</div>

				{/* Child Checkboxes */}
				<div className="ml-8 space-y-1">
					{childCheckboxItems.map((item) => (
						<div
							key={item.id}
							className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
						>
							<div className="flex items-center space-x-3">
								<input
									type="checkbox"
									id={item.id}
									className="h-4 w-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
									checked={childStates[item.id]}
									onChange={handleChildChange(item.id)}
								/>
								<label
									htmlFor={item.id}
									className="text-slate-700 cursor-pointer text-sm font-medium"
								>
									{item.label}
								</label>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
