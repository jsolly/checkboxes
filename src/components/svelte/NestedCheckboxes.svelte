<div class="px-3 py-2">
  <div>
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
    <div class="ml-8">
      {#each childCheckboxItems as item (item.id)}
        <div class="p-1 rounded-lg hover:bg-slate-100 transition-colors">
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

<script>
const parentCheckbox = {
	id: "parent-svelte",
	label: "Parent",
};

const childCheckboxItems = [
	{ id: "child1-svelte", label: "Child 1" },
	{ id: "child2-svelte", label: "Child 2" },
	{ id: "child3-svelte", label: "Child 3" },
];

let childStates = childCheckboxItems.reduce((acc, item) => {
	acc[item.id] = false;
	return acc;
}, {});

function setIndeterminate(node, indeterminate) {
	function update(indeterminate) {
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