/**
 * Counts the number of characters in code, excluding comments and whitespace
 * @param {string} code - The source code to analyze
 * @param {string} lang - The programming language of the code
 * @returns {number} The number of characters excluding comments and whitespace
 */
export function getCharacterCount(code: string, lang: string) {
	let cleanCode = code;

	// Remove single-line comments based on language
	if (["vue", "typescript", "javascript", "jsx"].includes(lang)) {
		cleanCode = cleanCode.replace(/\/\/.*/g, "");
	}

	// Remove HTML-style comments
	if (["html", "vue"].includes(lang)) {
		cleanCode = cleanCode.replace(/<!--[\s\S]*?-->/g, "");
	}

	// Remove JS/TS style multi-line comments
	cleanCode = cleanCode.replace(/\/\*[\s\S]*?\*\//g, "");

	// For Svelte, remove special comment syntax
	if (["typescript", "svelte"].includes(lang)) {
		cleanCode = cleanCode.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
	}

	// Remove whitespace
	cleanCode = cleanCode.replace(/\s+/g, "");

	return cleanCode.length;
}
