import { useCallback, useEffect, useRef, useState } from "react";

function Checkbox({ id, label, checked, indeterminate, onChange }) {
	const ref = useRef();

	useEffect(() => {
		if (ref.current) {
			ref.current.indeterminate = indeterminate;
		}
	}, [indeterminate]);

	return (
		<div>
			<input
				ref={ref}
				type="checkbox"
				id={id}
				checked={checked}
				onChange={onChange}
			/>
			<label htmlFor={id}>{label}</label>
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
		<div className="checkbox-demo">
			<Checkbox
				id="parent-react"
				label="Parent"
				checked={allChecked}
				indeterminate={someChecked && !allChecked}
				onChange={handleParentChange}
			/>

			<div className="checkbox-children">
				{checkboxes.map((item) => (
					<Checkbox
						key={item.id}
						{...item}
						onChange={handleChildChange(item.id)}
					/>
				))}
			</div>
		</div>
	);
}
