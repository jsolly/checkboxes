// @ts-check
import { defineConfig } from "astro/config";

import tailwind from "@astrojs/tailwind";

import sitemap from "@astrojs/sitemap";

import alpinejs from "@astrojs/alpinejs";

import vue from "@astrojs/vue";

import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
	integrations: [tailwind(), sitemap(), alpinejs(), vue(), react()],
});
