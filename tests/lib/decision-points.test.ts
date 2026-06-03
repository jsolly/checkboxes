import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeDecisionPoints } from "../../src/utils/decision-points";

describe("A stats generation run analyzes implementation decisions deterministically", () => {
	it("counts JavaScript branches and normalizes the raw count", () => {
		const result = analyzeDecisionPoints({
			framework: "react",
			absolutePath: "/repo/src/components/react/ReactNestedCheckboxes.jsx",
			relativePath: "src/components/react/ReactNestedCheckboxes.jsx",
			extension: ".jsx",
			code: `
				export function Example({ items }) {
					if (items.length === 0) return null;
					const visible = items.some((item) => item.checked) && items.length > 1;
					return visible ? <div /> : null;
				}
			`,
		});

		assert.equal(result.value, 3);
		assert.equal(result.normalizedScore, 10);
		assert.deepEqual(result.breakdown, {
			jsControlFlow: 3,
			templateDirectives: 0,
			selectors: 0,
			declarativeAttrs: 0,
		});
	});

	it("counts Astro scripts, declarative attributes, hyperscript tokens, and behavioral selectors", () => {
		const result = analyzeDecisionPoints({
			framework: "hyperscript",
			absolutePath: "/repo/src/components/hyperscript/hyperscript.astro",
			relativePath: "src/components/hyperscript/hyperscript.astro",
			extension: ".astro",
			code: `
				<div x-show="open" data-show="$checked" _="on click if checked then toggle .done else remove .done">
					<input type="checkbox" />
				</div>
				<style>
					.group:has(input:checked) .child { color: blue; }
					.button { padding: 1rem; }
				</style>
				<script>
					if (ready) start();
				</script>
			`,
		});

		assert.equal(result.breakdown.jsControlFlow, 1);
		assert.equal(result.breakdown.declarativeAttrs, 4);
		assert.equal(result.breakdown.selectors, 2);
		assert.equal(result.breakdown.templateDirectives, 0);
		assert.equal(result.value, 7);
	});

	it("counts Vue and Svelte template directives without treating markup as JavaScript", () => {
		const vue = analyzeDecisionPoints({
			framework: "vue",
			absolutePath: "/repo/src/components/vue/VueNestedCheckboxes.vue",
			relativePath: "src/components/vue/VueNestedCheckboxes.vue",
			extension: ".vue",
			code: `
				<script setup>
				const visible = checked && ready;
				</script>
				<template>
					<div v-if="visible">
						<Row v-for="item in items" v-show="item.enabled" />
					</div>
				</template>
			`,
		});

		const svelte = analyzeDecisionPoints({
			framework: "svelte",
			absolutePath: "/repo/src/components/svelte/SvelteNestedCheckboxes.svelte",
			relativePath: "src/components/svelte/SvelteNestedCheckboxes.svelte",
			extension: ".svelte",
			code: `
				<script>
					const visible = checked || ready;
				</script>
				{#if visible}
					{#each items as item}
						<Row {item} />
					{/each}
				{/if}
			`,
		});

		assert.equal(vue.value, 4);
		assert.equal(svelte.value, 3);
	});
});
