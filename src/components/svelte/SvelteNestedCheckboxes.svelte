<fieldset class="checkbox-demo">
  <legend>
    <label>
      <input
        type="checkbox"
        checked={allChecked}
        indeterminate={isIndeterminate}
        onchange={toggleAll}
      /> Parent
    </label>
  </legend>
  <div class="checkbox-children">
    {#each checkboxes as checkbox}
      <label>
        <input type="checkbox" bind:checked={checkbox.value} /> {checkbox.label}
      </label>
    {/each}
  </div>
</fieldset>

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
