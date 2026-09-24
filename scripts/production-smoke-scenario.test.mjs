import assert from "node:assert/strict";
import it from "node:test";
import { chromium } from "playwright";
import { productionUrl, smoke } from "./production-smoke-scenario.mjs";

it("checkbox markup without propagation fails", async () => {
	const browser = await chromium.launch();
	try {
		const context = await browser.newContext();
		const page = await context.newPage();
		page.setDefaultTimeout(300);
		await context.route("**/*", (route) =>
			route.fulfill({
				status: 200,
				contentType: "text/html",
				body: '<h1>Nested Checkboxes</h1><div data-framework="vanillajs"><label><input type="checkbox">Parent</label><label><input type="checkbox">Child 1</label><label><input type="checkbox">Child 2</label><label><input type="checkbox">Child 3</label></div>',
			}),
		);
		await page.goto(productionUrl);
		await assert.rejects(
			smoke({ page, context }),
			/parent selects every child/,
		);
	} finally {
		await browser.close();
	}
});
