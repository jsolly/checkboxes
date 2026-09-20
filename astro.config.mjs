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
	integrations: [
		// The /test/* routes are noindex demo/measurement pages — keep them out of the sitemap.
		sitemap({ filter: (page) => !page.includes("/test/") }),
		vue(),
		react(),
		svelte(),
	],
	adapter: vercel(),
	vite: {
		plugins: [tailwindcss()],
		resolve: {
			alias: {
				"hyperscript.org": hyperscriptEsm,
			},
		},
	},
});
