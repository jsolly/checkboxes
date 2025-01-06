export const FRAMEWORKS = {
	vanillajs: {
		displayName: "Vanilla JS",
		clientOnly: false,
	},
	alpine: {
		displayName: "Alpine.js",
		clientOnly: false,
	},
	vue: {
		displayName: "Vue",
		clientOnly: "vue" as const,
	},
	react: {
		displayName: "React",
		clientOnly: "react" as const,
	},
	svelte: {
		displayName: "Svelte",
		clientOnly: "svelte" as const,
	},
	hyperscript: {
		displayName: "Hyperscript",
		clientOnly: false,
	},
	cssOnly: {
		displayName: "CSS Only",
		clientOnly: false,
	},
	jquery: {
		displayName: "jQuery",
		clientOnly: false,
	},
} as const;

export type FrameworkId = keyof typeof FRAMEWORKS;

export function isValidFramework(
	framework: string | undefined,
): framework is FrameworkId {
	return framework !== undefined && framework in FRAMEWORKS;
}
