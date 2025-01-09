import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function Checkbox({
	id,
	label,
	checked,
	indeterminate,
	onChange,
	className = "",
}) {
	const ref = useRef();

	useEffect(() => {
		if (ref.current) {
			ref.current.indeterminate = indeterminate;
		}
	}, [indeterminate]);

	return (
		<div
			className={`rounded-lg hover:bg-slate-100 transition-colors ${className}`}
		>
			<div className="flex items-center space-x-3">
				<input
					ref={ref}
					type="checkbox"
					id={id}
					checked={checked}
					onChange={onChange}
					className="h-4 w-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
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

const CHILD_ITEMS = [
	{ id: "child1-react", label: "Child 1" },
	{ id: "child2-react", label: "Child 2" },
	{ id: "child3-react", label: "Child 3" },
];

export default function NestedCheckboxes() {
	const [checkedItems, setCheckedItems] = useState(() =>
		Object.fromEntries(CHILD_ITEMS.map((item) => [item.id, false])),
	);

	const allChecked = useMemo(
		() => Object.values(checkedItems).every(Boolean),
		[checkedItems],
	);

	const someChecked = useMemo(
		() => Object.values(checkedItems).some(Boolean),
		[checkedItems],
	);

	const handleParentChange = useCallback((e) => {
		const newValue = e.target.checked;
		setCheckedItems(
			Object.fromEntries(CHILD_ITEMS.map((item) => [item.id, newValue])),
		);
	}, []);

	const handleChildChange = useCallback(
		(id) => (e) => {
			setCheckedItems((prev) => ({
				...prev,
				[id]: e.target.checked,
			}));
		},
		[],
	);

	return (
		<div className="px-3 py-2">
			<Checkbox
				id="parent-react"
				label="Parent"
				checked={allChecked}
				indeterminate={someChecked && !allChecked}
				onChange={handleParentChange}
				className="p-2"
			/>

			<div className="ml-8">
				{CHILD_ITEMS.map(({ id, label }) => (
					<Checkbox
						key={id}
						id={id}
						label={label}
						checked={checkedItems[id]}
						onChange={handleChildChange(id)}
						className="p-1"
					/>
				))}
			</div>
		</div>
	);
}
