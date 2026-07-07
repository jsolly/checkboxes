// @ts-check

import react from "@astrojs/react";

import sitemap from "@astrojs/sitemap";
import svelte from "@astrojs/svelte";
import vercel from "@astrojs/vercel";
import vue from "@astrojs/vue";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

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
