export const FRAMEWORKS = {
	vanillajs: {
		displayName: "Vanilla JS",
	},
	alpine: {
		displayName: "Alpine.js",
	},
	vue: {
		displayName: "Vue",
	},
	react: {
		displayName: "React",
	},
	svelte: {
		displayName: "Svelte",
	},
	hyperscript: {
		displayName: "Hyperscript",
	},
	cssOnly: {
		displayName: "CSS Only",
	},
	jquery: {
		displayName: "jQuery",
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
