<script setup>
import { computed, ref } from "vue";

const checkboxes = ref([
	{ id: "child1-vue", label: "Child 1", checked: false },
	{ id: "child2-vue", label: "Child 2", checked: false },
	{ id: "child3-vue", label: "Child 3", checked: false },
]);

const parent = {
	id: "parent-vue",
	label: "Parent",
};

const allChecked = computed(() => checkboxes.value.every((c) => c.checked));
const someChecked = computed(() => checkboxes.value.some((c) => c.checked));

function toggleParent(e) {
	const newValue = e.target.checked;
	for (const c of checkboxes.value) c.checked = newValue;
}
</script>

<template>
    <div class="checkbox-demo">
        <div>
            <input type="checkbox" :id="parent.id" :checked="allChecked"
                :indeterminate="someChecked && !allChecked" @change="toggleParent" />
            <label :for="parent.id">{{ parent.label }}</label>
        </div>

        <div class="checkbox-children">
            <div v-for="checkbox in checkboxes" :key="checkbox.id">
                <input type="checkbox" :id="checkbox.id" v-model="checkbox.checked" />
                <label :for="checkbox.id">{{ checkbox.label }}</label>
            </div>
        </div>
    </div>
</template>
