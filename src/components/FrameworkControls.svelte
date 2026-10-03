<script lang="ts">
import { onMount } from "svelte";
import type { FrameworkId } from "../config/frameworks";
import NativeSelect from "../lib/components/ui/native-select/native-select.svelte";
import NativeSelectOptGroup from "../lib/components/ui/native-select/native-select-opt-group.svelte";
import NativeSelectOption from "../lib/components/ui/native-select/native-select-option.svelte";
import { SortOption } from "../types/sort";
import { getSavedOrder, sortFrameworks } from "../utils/sortFrameworks";

let sortBy = $state(SortOption.None);
let hydrated = $state(false);
let sortedFrameworks: FrameworkId[] = [];
const id = $props.id();
const groups = [
	{
		label: "Bundle Size",
		options: [
			{ value: SortOption.BundleSizeAsc, text: "Bundle Size (smallest first)" },
			{ value: SortOption.BundleSizeDsc, text: "Bundle Size (largest first)" },
		],
	},
	{
		label: "Source Lines",
		options: [
			{ value: SortOption.SourceLinesAsc, text: "Lines (shortest first)" },
			{ value: SortOption.SourceLinesDsc, text: "Lines (longest first)" },
		],
	},
	{
		label: "Code Complexity",
		options: [
			{
				value: SortOption.CodeComplexityAsc,
				text: "Code Complexity (simplest first)",
			},
			{
				value: SortOption.CodeComplexityDsc,
				text: "Code Complexity (most complex first)",
			},
		],
	},
	{
		label: "Vibe Complexity",
		options: [
			{
				value: SortOption.VibeComplexityAsc,
				text: "Vibe Complexity (simplest first)",
			},
			{
				value: SortOption.VibeComplexityDsc,
				text: "Vibe Complexity (most complex first)",
			},
		],
	},
];

function handleSortChange(event: Event & { currentTarget: HTMLSelectElement }) {
	const option = Object.values(SortOption).find(
		(value) => value === event.currentTarget.value,
	);
	if (option === undefined) throw new Error("Unknown framework sort option");
	sortBy = option;
	sortedFrameworks = sortFrameworks(sortedFrameworks, option);
	document.dispatchEvent(
		new CustomEvent("frameworkMetricSort", {
			detail: { type: option, order: sortedFrameworks },
		}),
	);
}

onMount(() => {
	sortedFrameworks = getSavedOrder();
	hydrated = true;
	const handleManualSort = () => {
		sortBy = SortOption.None;
		sortedFrameworks = getSavedOrder();
	};
	document.addEventListener("frameworkDragSort", handleManualSort);
	return () =>
		document.removeEventListener("frameworkDragSort", handleManualSort);
});
</script>

<div class="max-w-6xl mx-auto mb-4 flex justify-end px-4">
 <div class="flex items-center gap-2 text-slate-700">
  <label for={id} class="text-sm">Sort</label>
  <NativeSelect {id} value={sortBy} disabled={!hydrated} onchange={handleSortChange}>
   <NativeSelectOption value={SortOption.None}>Manual Order</NativeSelectOption>
   {#each groups as group (group.label)}
    <NativeSelectOptGroup label={group.label}>
     {#each group.options as option (option.value)}
      <NativeSelectOption value={option.value}>{option.text}</NativeSelectOption>
     {/each}
    </NativeSelectOptGroup>
   {/each}
  </NativeSelect>
 </div>
</div>
