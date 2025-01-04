import { promises as fs } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const FRAMEWORKS = [
	"vanilla",
	"alpine",
	"vue",
	"react",
	"svelte",
	"hyperscript",
	"css-only",
	"jquery",
];

async function measureBundleSize(page) {
	return await page.evaluate(() => {
		const resources = performance.getEntriesByType("resource");
		const jsResources = resources.filter(
			(r) =>
				r.name.endsWith(".js") ||
				r.name.endsWith(".mjs") ||
				r.initiatorType === "script",
		);

		const totalBytes = jsResources.reduce((acc, resource) => {
			return acc + resource.encodedBodySize;
		}, 0);

		return `${(totalBytes / 1024).toFixed(1)}kb`;
	});
}

async function measureRenderTime(frameworkId) {
	const browser = await chromium.launch();
	const page = await browser.newPage();

	await page.goto(`http://localhost:3000/?framework=${frameworkId}`);

	const renderTime = await page.evaluate(() => {
		const timing = performance.getEntriesByType("navigation")[0];
		return timing.domContentLoadedEventEnd - timing.navigationStart;
	});

	const bundleSize = await measureBundleSize(page);

	await browser.close();

	return {
		renderTime: `${Math.round(renderTime)}ms`,
		bundleSize,
	};
}

async function generateStats() {
	const stats = {};

	for (const framework of FRAMEWORKS) {
		console.log(`Generating stats for ${framework}...`);

		const metrics = await measureRenderTime(framework);
		stats[framework] = metrics;

		// Save individual framework stats
		const statsDir = join(process.cwd(), "src/components", framework);
		await fs.writeFile(
			join(statsDir, "stats.json"),
			JSON.stringify(metrics, null, 2),
		);
	}

	// Save all stats in one file
	await fs.writeFile(
		join(process.cwd(), "src/data/framework-stats.json"),
		JSON.stringify(stats, null, 2),
	);

	console.log("Stats generation complete!");
}

// Run the script
generateStats().catch(console.error);
