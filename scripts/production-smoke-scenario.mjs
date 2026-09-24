import assert from "node:assert/strict";

export const productionUrl = "https://www.checkboxes.xyz";

export async function smoke({ page }) {
	await page
		.getByRole("heading", { name: "Nested Checkboxes", exact: true })
		.waitFor();
	for (const framework of ["vanillajs", "react"]) {
		await page.goto(`${productionUrl}/test/${framework}`);
		const demo = page.locator(`[data-framework="${framework}"]`);
		const parent = demo.getByRole("checkbox", { name: "Parent", exact: true });
		const children = demo.getByRole("checkbox", { name: /^Child [123]$/ });
		await parent.waitFor();
		assert.equal(
			await children.count(),
			3,
			`${framework}: three children render`,
		);
		await parent.check();
		for (const child of await children.all()) {
			assert.equal(
				await child.isChecked(),
				true,
				`${framework}: parent selects every child`,
			);
		}
		await children.first().uncheck();
		assert.equal(
			await parent.isChecked(),
			false,
			`${framework}: partial selection clears parent`,
		);
		assert.equal(
			await parent.evaluate((input) => input.indeterminate),
			true,
			`${framework}: parent shows mixed selection`,
		);
		await parent.check();
		await parent.uncheck();
		for (const child of await children.all()) {
			assert.equal(
				await child.isChecked(),
				false,
				`${framework}: parent clears every child`,
			);
		}
	}
}
