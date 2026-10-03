<script lang="ts">
import type { HTMLOptgroupAttributes } from "svelte/elements";
import type { WithElementRef } from "../../../ui-types.js";
import { cn } from "../../../utils.js";

let {
	ref = $bindable(null),
	class: className,
	children,
	...restProps
}: WithElementRef<HTMLOptgroupAttributes> = $props();
</script>

<optgroup
	bind:this={ref}
	data-slot="native-select-optgroup"
	class={cn("bg-[Canvas] text-[CanvasText]", className)}
	{...restProps}
>
	{@render children?.()}
</optgroup>
