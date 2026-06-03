const vueDirectivePattern = /\b(?:v-if|v-else-if|v-show|v-for)\b/g;
const svelteDirectivePattern = /\{#(?:if|each|await|key)\b|\{:else if\b/g;
const astroDirectivePattern = /\b(?:client:visible|client:media)\b/g;
const declarativeAttributePattern =
	/\b(?:x-if|x-show|x-for|data-if|data-show|data-for|data-bind|data-on-[\w:-]+)\s*=/g;
const hyperscriptAttributePattern = /\b(?:_|data-script)\s*=\s*(["'])(.*?)\1/gs;
const hyperscriptDecisionTokenPattern = /\b(?:if|else|unless|for|repeat)\b/g;
const behavioralSelectorPattern =
	/:(?:has|is|not|where|checked)\s*(?:\(|\b)|\[[^\]]*data-(?:state|checked|selected|active)[^\]]*\]/g;

export function extractScriptBlocks(code: string): string[] {
	const scripts: string[] = [];
	const frontmatter = code.match(/^---\s*([\s\S]*?)\s*---/);
	if (frontmatter?.[1]) {
		scripts.push(frontmatter[1]);
	}

	for (const match of code.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
		scripts.push(match[1]);
	}

	return scripts;
}

export function removeScriptAndStyleBlocks(code: string): string {
	return code
		.replace(/^---\s*[\s\S]*?\s*---/, "")
		.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
		.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
}

export function extractStyleBlocks(code: string): string[] {
	return Array.from(code.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)).map(
		(match) => match[1],
	);
}

export function countVueTemplateDirectives(code: string): number {
	return countMatches(code, vueDirectivePattern);
}

export function countSvelteTemplateDirectives(code: string): number {
	return countMatches(code, svelteDirectivePattern);
}

export function countAstroTemplateDirectives(code: string): number {
	return countMatches(code, astroDirectivePattern);
}

export function countDeclarativeAttributes(code: string): number {
	return (
		countMatches(code, declarativeAttributePattern) +
		countHyperscriptDecisionTokens(code)
	);
}

export function countBehavioralSelectors(code: string): number {
	return countMatches(code, behavioralSelectorPattern);
}

function countHyperscriptDecisionTokens(code: string): number {
	let total = 0;
	for (const match of code.matchAll(hyperscriptAttributePattern)) {
		total += countMatches(match[2], hyperscriptDecisionTokenPattern);
	}
	return total;
}

function countMatches(value: string, pattern: RegExp): number {
	return Array.from(value.matchAll(pattern)).length;
}
