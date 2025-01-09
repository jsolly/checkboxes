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
    <div class="px-3 py-2">
        <div>
            <div class="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <div class="flex items-center space-x-3">
                    <input type="checkbox" :id="parent.id"
                        class="h-4 w-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        :checked="allChecked" :indeterminate="someChecked && !allChecked" @change="toggleParent" />
                    <label :for="parent.id" class="text-slate-700 cursor-pointer text-sm font-medium">
                        {{ parent.label }}
                    </label>
                </div>
            </div>

            <div class="ml-8">
                <div v-for="checkbox in checkboxes" :key="checkbox.id"
                    class="p-1 rounded-lg hover:bg-slate-100 transition-colors">
                    <div class="flex items-center space-x-3">
                        <input type="checkbox" :id="checkbox.id"
                            class="h-4 w-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            v-model="checkbox.checked" />
                        <label :for="checkbox.id" class="text-slate-700 cursor-pointer text-sm font-medium">
                            {{ checkbox.label }}
                        </label>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
