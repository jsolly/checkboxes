import { useEffect, useMemo, useRef, useState } from "react";

interface CheckboxItem {
	id: string;
	label: string;
}

const parentCheckbox: CheckboxItem = {
	id: "parent-react",
	label: "Parent",
};

const childCheckboxItems: CheckboxItem[] = [
	{ id: "child1-react", label: "Child 1" },
	{ id: "child2-react", label: "Child 2" },
	{ id: "child3-react", label: "Child 3" },
];

// Parent Checkbox Component
function ParentCheckbox({
	id,
	label,
	checked,
	indeterminate,
	onChange,
}: {
	id: string;
	label: string;
	checked: boolean;
	indeterminate: boolean;
	onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
	const checkboxRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (checkboxRef.current) {
			checkboxRef.current.indeterminate = indeterminate;
		}
	}, [indeterminate]);

	return (
		<div className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
			<div className="flex items-center space-x-3">
				<input
					ref={checkboxRef}
					type="checkbox"
					id={id}
					className="h-4 w-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
					checked={checked}
					onChange={onChange}
				/>
				<label
					htmlFor={id}
					className="text-slate-700 cursor-pointer text-sm font-medium"
				>
					{label}
				</label>
			</div>
		</div>
	);
}

// Child Checkbox Component
function ChildCheckbox({
	id,
	label,
	checked,
	onChange,
}: {
	id: string;
	label: string;
	checked: boolean;
	onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
	return (
		<div className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
			<div className="flex items-center space-x-3">
				<input
					type="checkbox"
					id={id}
					className="h-4 w-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
					checked={checked}
					onChange={onChange}
				/>
				<label
					htmlFor={id}
					className="text-slate-700 cursor-pointer text-sm font-medium"
				>
					{label}
				</label>
			</div>
		</div>
	);
}

// Main Component
export default function NestedCheckboxes() {
	const initialChildStates = useMemo(
		() =>
			childCheckboxItems.reduce(
				(acc, item) => {
					acc[item.id] = false;
					return acc;
				},
				{} as Record<string, boolean>,
			),
		[],
	);

	const [childStates, setChildStates] = useState(initialChildStates);
	const [parentChecked, setParentChecked] = useState(false);
	const [isIndeterminate, setIsIndeterminate] = useState(false);

	useEffect(() => {
		const allChecked = Object.values(childStates).every(Boolean);
		const someChecked = Object.values(childStates).some(Boolean);

		setParentChecked(allChecked);
		setIsIndeterminate(someChecked && !allChecked);
	}, [childStates]);

	const handleParentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.checked;
		const updatedStates = Object.keys(childStates).reduce(
			(acc, key) => {
				acc[key] = newValue;
				return acc;
			},
			{} as Record<string, boolean>,
		);

		setParentChecked(newValue);
		setChildStates(updatedStates);
	};

	const handleChildChange =
		(id: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
			setChildStates((prev) => ({
				...prev,
				[id]: e.target.checked,
			}));
		};

	return (
		<div>
			<div>
				{/* Parent Checkbox */}
				<ParentCheckbox
					id={parentCheckbox.id}
					label={parentCheckbox.label}
					checked={parentChecked}
					indeterminate={isIndeterminate}
					onChange={handleParentChange}
				/>

				{/* Child Checkboxes */}
				<div className="ml-8">
					{childCheckboxItems.map((item) => (
						<ChildCheckbox
							key={item.id}
							id={item.id}
							label={item.label}
							checked={childStates[item.id]}
							onChange={handleChildChange(item.id)}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
