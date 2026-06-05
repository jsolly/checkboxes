<script setup>
import { computed, ref } from "vue";

const checkboxes = ref([
	{ id: "child1-vue", label: "Child 1", checked: false },
	{ id: "child2-vue", label: "Child 2", checked: false },
	{ id: "child3-vue", label: "Child 3", checked: false },
]);

const allChecked = computed(() => checkboxes.value.every((c) => c.checked));
const someChecked = computed(() => checkboxes.value.some((c) => c.checked));

function toggleParent(e) {
	const newValue = e.target.checked;
	for (const c of checkboxes.value) c.checked = newValue;
}
</script>

<template>
    <fieldset class="checkbox-demo">
        <legend>
            <label>
                <input type="checkbox" :checked="allChecked"
                    :indeterminate="someChecked && !allChecked" @change="toggleParent" /> Parent
            </label>
        </legend>

        <div class="checkbox-children">
            <label v-for="checkbox in checkboxes" :key="checkbox.id">
                <input type="checkbox" v-model="checkbox.checked" /> {{ checkbox.label }}
            </label>
        </div>
    </fieldset>
</template>
