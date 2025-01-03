import { useEffect, useMemo, useRef, useState } from "react";

// Constants
const CHECKBOX_STYLES = {
	container: "rounded-lg hover:bg-slate-100 transition-colors",
	wrapper: "flex items-center space-x-3",
	input:
		"h-4 w-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500",
	label: "text-slate-700 cursor-pointer text-sm font-medium",
};

const parentCheckbox = {
	id: "parent-react",
	label: "Parent",
};

const childCheckboxItems = [
	{ id: "child1-react", label: "Child 1" },
	{ id: "child2-react", label: "Child 2" },
	{ id: "child3-react", label: "Child 3" },
];

// Components
function ParentCheckbox({ id, label, checked, indeterminate, onChange }) {
	const checkboxRef = useRef(null);

	useEffect(() => {
		if (checkboxRef.current) {
			checkboxRef.current.indeterminate = indeterminate;
		}
	}, [indeterminate]);

	return (
		<div className={`p-2 ${CHECKBOX_STYLES.container}`}>
			<div className={CHECKBOX_STYLES.wrapper}>
				<input
					ref={checkboxRef}
					type="checkbox"
					id={id}
					className={CHECKBOX_STYLES.input}
					checked={checked}
					onChange={onChange}
				/>
				<label htmlFor={id} className={CHECKBOX_STYLES.label}>
					{label}
				</label>
			</div>
		</div>
	);
}

function ChildCheckbox({ id, label, checked, onChange }) {
	return (
		<div className={`p-1 ${CHECKBOX_STYLES.container}`}>
			<div className={CHECKBOX_STYLES.wrapper}>
				<input
					type="checkbox"
					id={id}
					className={CHECKBOX_STYLES.input}
					checked={checked}
					onChange={onChange}
				/>
				<label htmlFor={id} className={CHECKBOX_STYLES.label}>
					{label}
				</label>
			</div>
		</div>
	);
}

// Main Component
export default function NestedCheckboxes() {
	const [childStates, setChildStates] = useState(() =>
		childCheckboxItems.reduce((acc, item) => {
			acc[item.id] = false;
			return acc;
		}, {}),
	);

	const { allChecked, someChecked } = useMemo(() => {
		const values = Object.values(childStates);
		return {
			allChecked: values.every(Boolean),
			someChecked: values.some(Boolean),
		};
	}, [childStates]);

	const handleParentChange = (e) => {
		const newValue = e.target.checked;
		setChildStates(
			childCheckboxItems.reduce((acc, item) => {
				acc[item.id] = newValue;
				return acc;
			}, {}),
		);
	};

	const handleChildChange = (id) => (e) => {
		setChildStates((prev) =>
			Object.assign({}, prev, { [id]: e.target.checked }),
		);
	};

	return (
		<div className="px-3 py-2">
			<div>
				<ParentCheckbox
					id={parentCheckbox.id}
					label={parentCheckbox.label}
					checked={allChecked}
					indeterminate={someChecked && !allChecked}
					onChange={handleParentChange}
				/>

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
