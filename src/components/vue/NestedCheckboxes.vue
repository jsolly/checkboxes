<script setup>
import { computed, ref } from "vue";

const parentCheckbox = {
	id: "parent-vue",
	label: "Parent",
};

const childCheckboxItems = [
	{ id: "child1-vue", label: "Child 1" },
	{ id: "child2-vue", label: "Child 2" },
	{ id: "child3-vue", label: "Child 3" },
];

const childStates = ref(
	childCheckboxItems.reduce((acc, item) => {
		acc[item.id] = false;
		return acc;
	}, {}),
);

const parentChecked = computed({
	get: () => Object.values(childStates.value).every(Boolean),
	set: (value) => {
		for (const key of Object.keys(childStates.value)) {
			childStates.value[key] = value;
		}
	},
});

const areSomeChildrenChecked = computed(() =>
	Object.values(childStates.value).some(Boolean),
);
</script>

<template>
    <div class="px-3 py-2">
        <div>
            <div class="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <div class="flex items-center space-x-3">
                    <input type="checkbox" :id="parentCheckbox.id"
                        class="h-4 w-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        v-model="parentChecked" :indeterminate="areSomeChildrenChecked && !parentChecked" />
                    <label :for="parentCheckbox.id" class="text-slate-700 cursor-pointer text-sm font-medium">
                        {{ parentCheckbox.label }}
                    </label>
                </div>
            </div>
            <div class="ml-8">
                <div v-for="item in childCheckboxItems" :key="item.id"
                    class="p-1 rounded-lg hover:bg-slate-100 transition-colors">
                    <div class="flex items-center space-x-3">
                        <input type="checkbox" :id="item.id"
                            class="h-4 w-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            v-model="childStates[item.id]" />
                        <label :for="item.id" class="text-slate-700 cursor-pointer text-sm font-medium">
                            {{ item.label }}
                        </label>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
