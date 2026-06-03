/** Remove presentation-only attributes so size/vocabulary reflect implementation structure. */
export function stripPresentation(code: string): string {
	return code
		.replace(/\bclass(?:Name)?\s*=\s*(["'`])([\s\S]*?)\1/g, "")
		.replace(/\bstyle\s*=\s*(["'`])([\s\S]*?)\1/g, "")
		.replace(/\/\*[^@][\s\S]*?\*\//g, "");
}
