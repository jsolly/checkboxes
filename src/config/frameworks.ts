export const FRAMEWORKS = {
	vanillajs: {
		displayName: "Vanilla JS",
		clientFramework: null,
	},
	alpine: {
		displayName: "Alpine.js",
		clientFramework: null,
	},
	vue: {
		displayName: "Vue",
		clientFramework: "vue" as const,
	},
	react: {
		displayName: "React",
		clientFramework: "react" as const,
	},
	svelte: {
		displayName: "Svelte",
		clientFramework: "svelte" as const,
	},
	hyperscript: {
		displayName: "Hyperscript",
		clientFramework: null,
	},
	cssOnly: {
		displayName: "CSS Only",
		clientFramework: null,
	},
	jquery: {
		displayName: "jQuery",
		clientFramework: null,
	},
	stimulus: {
		displayName: "Stimulus",
		clientFramework: null,
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
