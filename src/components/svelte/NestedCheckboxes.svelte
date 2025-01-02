<div class="bg-white rounded-lg p-3 border border-slate-200">
  <h2 class="text-lg font-semibold text-slate-800 mb-3">Svelte</h2>
  <div>
    <!-- Parent Checkbox -->
    <div class="p-2 rounded-lg hover:bg-slate-100 transition-colors">
      <div class="flex items-center space-x-3">
        <input
          type="checkbox"
          id={parentCheckbox.id}
          class="h-4 w-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
          bind:checked={allChecked}
          on:change={() => {
            childStates = Object.fromEntries(
              Object.keys(childStates).map(key => [key, allChecked])
            );
          }}
          use:setIndeterminate={isIndeterminate}
        />
        <label
          for={parentCheckbox.id}
          class="text-slate-700 cursor-pointer text-sm font-medium"
        >
          {parentCheckbox.label}
        </label>
      </div>
    </div>

    <!-- Child Checkboxes -->
    <div class="ml-8">
      {#each childCheckboxItems as item (item.id)}
        <div class="p-2 rounded-lg hover:bg-slate-100 transition-colors">
          <div class="flex items-center space-x-3">
            <input
              type="checkbox"
              id={item.id}
              class="h-4 w-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              bind:checked={childStates[item.id]}
            />
            <label
              for={item.id}
              class="text-slate-700 cursor-pointer text-sm font-medium"
            >
              {item.label}
            </label>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div> 

<script lang="ts">
interface CheckboxItem {
	id: string;
	label: string;
}

const parentCheckbox: CheckboxItem = {
	id: "parent-svelte",
	label: "Parent",
};

const childCheckboxItems: CheckboxItem[] = [
	{ id: "child1-svelte", label: "Child 1" },
	{ id: "child2-svelte", label: "Child 2" },
	{ id: "child3-svelte", label: "Child 3" },
];

let childStates: Record<string, boolean> = childCheckboxItems.reduce(
	(acc, item) => {
		acc[item.id] = false;
		return acc;
	},
	{} as Record<string, boolean>,
);

function setIndeterminate(node: HTMLInputElement, indeterminate: boolean) {
	function update(indeterminate: boolean) {
		node.indeterminate = indeterminate;
	}

	update(indeterminate);
	return {
		update,
		destroy() {},
	};
}

$: allChecked = Object.values(childStates).every(Boolean);
$: someChecked = Object.values(childStates).some(Boolean);
$: isIndeterminate = someChecked && !allChecked;
</script>