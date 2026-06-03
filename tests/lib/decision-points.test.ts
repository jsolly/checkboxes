import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeDecisionPoints } from "../../src/utils/decision-points";

describe("A stats generation run analyzes implementation decisions deterministically", () => {
	it("counts JavaScript branches and normalizes the raw count", () => {
		const result = analyzeDecisionPoints({
			framework: "react",
			absolutePath: "/repo/src/components/react/ReactNestedCheckboxes.jsx",
			relativePath: "src/components/react/ReactNestedCheckboxes.jsx",
			extension: ".jsx",
			code: `
				export function Example({ items }) {
					if (items.length === 0) return null;
					const visible = items.some((item) => item.checked) && items.length > 1;
					return visible ? <div /> : null;
				}
			`,
		});

		assert.equal(result.value, 3);
		assert.equal(result.normalizedScore, 10);
		assert.deepEqual(result.breakdown, {
			jsControlFlow: 3,
			templateDirectives: 0,
			selectors: 0,
			declarativeAttrs: 0,
		});
	});
});
