export const FRAMEWORKS = {
	vanillajs: {
		displayName: "Vanilla JS",
		implementationFile: "src/components/vanillajs/vanillajs.astro",
	},
	alpine: {
		displayName: "Alpine.js",
		implementationFile: "src/components/alpine/alpine.astro",
	},
	vue: {
		displayName: "Vue",
		implementationFile: "src/components/vue/VueNestedCheckboxes.vue",
	},
	react: {
		displayName: "React",
		implementationFile: "src/components/react/ReactNestedCheckboxes.jsx",
	},
	svelte: {
		displayName: "Svelte",
		implementationFile: "src/components/svelte/SvelteNestedCheckboxes.svelte",
	},
	hyperscript: {
		displayName: "Hyperscript",
		implementationFile: "src/components/hyperscript/hyperscript.astro",
	},
	cssOnly: {
		displayName: "CSS Only",
		implementationFile: "src/components/cssOnly/cssOnly.astro",
	},
	jquery: {
		displayName: "jQuery",
		implementationFile: "src/components/jquery/jquery.astro",
	},
	stimulus: {
		displayName: "Stimulus",
		implementationFile: "src/components/stimulus/stimulus.astro",
	},
	datastar: {
		displayName: "Datastar",
		implementationFile: "src/components/datastar/datastar.astro",
	},
} as const;

export type FrameworkId = keyof typeof FRAMEWORKS;

// Custom Events
export interface FrameworkSelectionEvent extends CustomEvent {
	detail: FrameworkId[];
}

export interface FrameworkSortEvent
	extends CustomEvent<{
		type: string;
		order: FrameworkId[];
	}> {}

export interface SortableEvent {
	item: HTMLElement;
}

export function isValidFramework(
	framework: string | null | undefined,
): framework is FrameworkId {
	return (
		framework !== null && framework !== undefined && framework in FRAMEWORKS
	);
}
