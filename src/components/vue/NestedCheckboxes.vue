<script setup lang="ts">
import { computed, ref } from "vue";

// Define the interface for a checkbox item
interface CheckboxItem {
	id: string;
	label: string;
}

// Data for parent and child checkboxes
const parentCheckbox: CheckboxItem = {
	id: "parent-vue",
	label: "Parent",
};

const childCheckboxItems: CheckboxItem[] = [
	{ id: "child1-vue", label: "Child 1" },
	{ id: "child2-vue", label: "Child 2" },
	{ id: "child3-vue", label: "Child 3" },
];

// Initialize `childStates` dynamically based on `childCheckboxItems`
const childStates = ref(
	childCheckboxItems.reduce<Record<string, boolean>>((acc, item) => {
		acc[item.id] = false;
		return acc;
	}, {}),
);

// Computed for the parent checkbox's checked state
const parentChecked = computed<boolean>({
	get: () => Object.values(childStates.value).every(Boolean),
	set: (value: boolean) => {
		for (const key of Object.keys(childStates.value)) {
			childStates.value[key] = value;
		}
	},
});

// Computed for individual child states (all unchecked, some checked, or all checked)
const areSomeChildrenChecked = computed(() =>
	Object.values(childStates.value).some(Boolean),
);
</script>

<template>
    <div>
        <div>
            <!-- Parent Checkbox -->
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

            <!-- Child Checkboxes -->
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
