export const FRAMEWORKS = {
	vanillajs: {
		displayName: "Vanilla JS",
		clientOnly: false,
		clientFramework: null,
	},
	alpine: {
		displayName: "Alpine.js",
		clientOnly: false,
		clientFramework: null,
	},
	vue: {
		displayName: "Vue",
		clientOnly: true,
		clientFramework: "vue" as const,
	},
	react: {
		displayName: "React",
		clientOnly: true,
		clientFramework: "react" as const,
	},
	svelte: {
		displayName: "Svelte",
		clientOnly: true,
		clientFramework: "svelte" as const,
	},
	hyperscript: {
		displayName: "Hyperscript",
		clientOnly: false,
		clientFramework: null,
	},
	cssOnly: {
		displayName: "CSS Only",
		clientOnly: false,
		clientFramework: null,
	},
	jquery: {
		displayName: "jQuery",
		clientOnly: false,
		clientFramework: null,
	},
} as const;

// Add type for the client framework names
export type ClientFramework = "vue" | "react" | "svelte" | null;

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
