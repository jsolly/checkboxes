import type svelte from "@astrojs/svelte";
import { vitePreprocess } from "@astrojs/svelte";

export default {
	preprocess: vitePreprocess(),
} satisfies NonNullable<Parameters<typeof svelte>[0]>;
