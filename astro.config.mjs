// @ts-check
import { defineConfig } from "astro/config";

import sitemap from "@astrojs/sitemap";

import vue from "@astrojs/vue";

import react from "@astrojs/react";

import svelte from "@astrojs/svelte";

import vercel from "@astrojs/vercel";

import tailwindcss from "@tailwindcss/vite";

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
	},
});
