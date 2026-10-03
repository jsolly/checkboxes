// @ts-check

import { createRequire } from "node:module";
import path from "node:path";

import react from "@astrojs/react";

import sitemap from "@astrojs/sitemap";
import svelte from "@astrojs/svelte";
import vercel from "@astrojs/vercel";
import vue from "@astrojs/vue";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

const buildSource = process.env["CHECKBOXES_BUILD_SOURCE"];
const measurementBuild = process.env["CHECKBOXES_MEASUREMENT_BUILD"] === "true";
const measurementOutput = process.env["CHECKBOXES_MEASUREMENT_OUTPUT"];

// hyperscript.org 0.9.90+ ships package root as IIFE (no ESM default export).
// Alias the import surface to the ESM build per upstream changelog.
const require = createRequire(import.meta.url);
const hyperscriptEsm = path.join(
	path.dirname(require.resolve("hyperscript.org")),
	"_hyperscript.esm.js",
);

// https://astro.build/config
export default defineConfig({
	site: "https://www.checkboxes.xyz",
	...(buildSource ? { srcDir: buildSource } : {}),
	...(measurementOutput ? { outDir: measurementOutput } : {}),
	...(measurementBuild ? { build: { assets: "_measurements" } } : {}),
	integrations: [
		// The /test/* routes are noindex demo/measurement pages — keep them out of the sitemap.
		...(measurementBuild
			? []
			: [sitemap({ filter: (page) => !page.includes("/test/") })]),
		vue(),
		react(),
		svelte(),
	],
	...(measurementBuild ? {} : { adapter: vercel() }),
	vite: {
		plugins: [
			tailwindcss(),
			{
				name: "measurement-boundary",
				apply: "build",
				generateBundle(_options, bundle) {
					if (!measurementBuild) return;
					for (const output of Object.values(bundle)) {
						if (output.type !== "chunk") continue;
						for (const moduleId of Object.keys(output.modules)) {
							if (
								moduleId.includes("/components/FrameworkControls.svelte") ||
								moduleId.includes("/lib/components/ui/")
							) {
								throw new Error(
									`Shared gallery control reached a measurement chunk: ${moduleId}`,
								);
							}
						}
					}
				},
			},
		],
		resolve: {
			alias: {
				"hyperscript.org": hyperscriptEsm,
			},
		},
	},
});
