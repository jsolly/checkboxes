<div class="px-3 py-2">
  <div>
    <div class="p-2 rounded-lg hover:bg-slate-100 transition-colors">
      <div class="flex items-center space-x-3">
        <input
          type="checkbox"
          id="parent-checkbox"
          class="h-4 w-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
          checked={allChecked}
          indeterminate={isIndeterminate}
          onchange={toggleAll}
        />
        <label
          for="parent-checkbox"
          class="text-slate-700 cursor-pointer text-sm font-medium"
        >
          Parent
        </label>
      </div>
    </div>
    <div class="ml-8">
      {#each checkboxes as checkbox, i}
        <div class="p-1 rounded-lg hover:bg-slate-100 transition-colors">
          <div class="flex items-center space-x-3">
            <input
              type="checkbox"
              id="child-{i}"
              class="h-4 w-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              bind:checked={checkbox.value}
            />
            <label
              for="child-{i}"
              class="text-slate-700 cursor-pointer text-sm font-medium"
            >
              {checkbox.label}
            </label>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<script>
let checkboxes = $state([
	{ label: "Child 1", value: false },
	{ label: "Child 2", value: false },
	{ label: "Child 3", value: false },
]);

const allChecked = $derived(checkboxes.every((v) => v.value));
const someChecked = $derived(checkboxes.some((v) => v.value));
const isIndeterminate = $derived(someChecked && !allChecked);

function toggleAll() {
	const newValue = !allChecked;
	for (const v of checkboxes) v.value = newValue;
}
</script>