<div class="checkbox-demo">
  <div>
    <input
      type="checkbox"
      id="parent-checkbox"
      checked={allChecked}
      indeterminate={isIndeterminate}
      onchange={toggleAll}
    />
    <label for="parent-checkbox">Parent</label>
  </div>
  <div class="checkbox-children">
    {#each checkboxes as checkbox, i}
      <div>
        <input
          type="checkbox"
          id="child-{i}"
          bind:checked={checkbox.value}
        />
        <label for="child-{i}">{checkbox.label}</label>
      </div>
    {/each}
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