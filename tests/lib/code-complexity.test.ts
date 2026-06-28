import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FRAMEWORKS, type FrameworkId } from "../../src/config/frameworks";
import { analyzeCodeComplexity } from "../../src/utils/code-complexity";
import { readImplementationSources } from "../../src/utils/implementationSources";

describe("Code Complexity composite analyzer", () => {
	it("returns five subscores and a 0-100 total score", () => {
		const result = analyzeCodeComplexity({
			framework: "react",
			absolutePath: "/repo/src/components/react/ReactNestedCheckboxes.jsx",
			relativePath: "src/components/react/ReactNestedCheckboxes.jsx",
			extension: ".jsx",
			code: `
				import { useCallback, useState } from "react";
				export default function Example() {
					const [checked, setChecked] = useState(false);
					const toggle = useCallback((event) => {
						if (event.target.checked) setChecked(true);
						else setChecked(false);
					}, []);
					return <input type="checkbox" checked={checked} onChange={toggle} />;
				}
			`,
		});

		assert.ok(result.score >= 0 && result.score <= 100);
		assert.equal(result.version, "cc-1.0.0");
		assert.ok(result.subscores.size >= 0 && result.subscores.size <= 20);
		assert.ok(result.subscores.logic >= 0 && result.subscores.logic <= 20);
		assert.ok(
			result.subscores.reactive >= 0 && result.subscores.reactive <= 20,
		);
		assert.ok(result.subscores.nesting >= 0 && result.subscores.nesting <= 20);
		assert.ok(
			result.subscores.vocabulary >= 0 && result.subscores.vocabulary <= 20,
		);
		assert.equal(
			result.score,
			Math.round(
				result.subscores.size +
					result.subscores.logic +
					result.subscores.reactive +
					result.subscores.nesting +
					result.subscores.vocabulary,
			),
		);
		assert.equal(result.raw.logicDecisions, 1);
		assert.equal(result.raw.reactiveSurface, 5);
	});

	it("credits reactive directives and state beyond raw decision counts", () => {
		const alpine = analyzeCodeComplexity({
			framework: "alpine",
			absolutePath: "/repo/src/components/alpine/alpine.astro",
			relativePath: "src/components/alpine/alpine.astro",
			extension: ".astro",
			code: `
				<div x-data="{ child1: false, child2: false }" x-effect="sync()">
					<input type="checkbox" x-model="child1" @change="toggleAll($event)" />
				</div>
			`,
		});

		const vanilla = analyzeCodeComplexity({
			framework: "vanillajs",
			absolutePath: "/repo/src/components/vanillajs/vanillajs.astro",
			relativePath: "src/components/vanillajs/vanillajs.astro",
			extension: ".astro",
			code: `
				<script>
					const boxes = document.querySelectorAll("input");
					boxes.forEach((box) => box.addEventListener("change", sync));
				</script>
			`,
		});

		assert.ok(
			alpine.score > vanilla.score,
			`expected alpine (${alpine.score}) > vanilla (${vanilla.score})`,
		);
		assert.ok(alpine.raw.reactiveSurface > vanilla.raw.reactiveSurface);
	});

	it("spreads scores across the current gallery implementations", async () => {
		const implementations = await readImplementationSources();
		const scores = Object.fromEntries(
			(Object.keys(FRAMEWORKS) as FrameworkId[]).map((id) => [
				id,
				analyzeCodeComplexity(implementations[id]).score,
			]),
		);

		const values = Object.values(scores);
		const min = Math.min(...values);
		const max = Math.max(...values);

		assert.ok(
			max - min >= 20,
			`expected spread >= 20, got ${JSON.stringify(scores)}`,
		);
		assert.ok(
			values.filter((score) => score <= 10).length <= 2,
			`expected most frameworks above 10, got ${JSON.stringify(scores)}`,
		);
		const cssOnly = scores.cssOnly;
		const reactScore = scores.react;
		assert.ok(cssOnly !== undefined && reactScore !== undefined);
		assert.ok(
			cssOnly >= 80,
			`cssOnly expected high, got ${cssOnly}`,
		);
		assert.ok(
			reactScore >= 50,
			`react expected mid/high, got ${reactScore}`,
		);
		assert.ok(
			cssOnly > reactScore,
			`expected cssOnly (${cssOnly}) > react (${reactScore})`,
		);
	});

	it("ignores presentation attributes when scoring size and vocabulary", () => {
		const base = analyzeCodeComplexity({
			framework: "react",
			absolutePath: "/repo/src/components/react/ReactNestedCheckboxes.jsx",
			relativePath: "src/components/react/ReactNestedCheckboxes.jsx",
			extension: ".jsx",
			code: `
				export default function Example({ checked, onChange }) {
					return <input type="checkbox" checked={checked} onChange={onChange} />;
				}
			`,
		});

		const styled = analyzeCodeComplexity({
			framework: "react",
			absolutePath: "/repo/src/components/react/ReactNestedCheckboxes.jsx",
			relativePath: "src/components/react/ReactNestedCheckboxes.jsx",
			extension: ".jsx",
			code: `
				export default function Example({ checked, onChange }) {
					return <input type="checkbox" className="h-4 w-4 text-blue-600" style="color: red" checked={checked} onChange={onChange} />;
				}
			`,
		});

		assert.equal(base.subscores.size, styled.subscores.size);
		assert.equal(base.raw.astNodes, styled.raw.astNodes);
		assert.equal(base.raw.vocabulary, styled.raw.vocabulary);
	});
});
