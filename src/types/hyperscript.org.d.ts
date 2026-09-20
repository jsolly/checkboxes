/** Ambient types for hyperscript.org (package ships no .d.ts as of 0.9.93). */
declare module "hyperscript.org" {
	const hyperscript: {
		process: (element: Element) => void;
		processNode: (element: Element) => void;
		cleanup: (element: Element) => void;
	};
	export default hyperscript;
}
