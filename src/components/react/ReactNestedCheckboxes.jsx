import { useCallback, useEffect, useRef, useState } from "react";

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

export default function NestedCheckboxes() {
	const [checkboxes, setCheckboxes] = useState([
		{ id: "child1-react", label: "Child 1", checked: false },
		{ id: "child2-react", label: "Child 2", checked: false },
		{ id: "child3-react", label: "Child 3", checked: false },
	]);

	const allChecked = checkboxes.every((item) => item.checked);
	const someChecked = checkboxes.some((item) => item.checked);

	const handleParentChange = useCallback((e) => {
		const newValue = e.target.checked;
		setCheckboxes((boxes) =>
			boxes.map((box) => ({ ...box, checked: newValue })),
		);
	}, []);

	const handleChildChange = useCallback(
		(id) => (e) => {
			setCheckboxes((boxes) =>
				boxes.map((box) =>
					box.id === id ? { ...box, checked: e.target.checked } : box,
				),
			);
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
				{checkboxes.map((item) => (
					<Checkbox
						key={item.id}
						{...item}
						onChange={handleChildChange(item.id)}
						className="p-1"
					/>
				))}
			</div>
		</div>
	);
}
