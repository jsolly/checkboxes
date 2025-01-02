# Checkbox Examples

A collection of checkbox implementations using different frameworks and approaches.

## Features

- Parent/child checkbox relationships
- Multiple implementation examples:
  - React
  - Vue.js
  - Svelte
  - Alpine.js
  - Pure JavaScript
  - Hyperscript
- Syntax highlighted code examples
- Collapsible code sections

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build
```

## Project Structure

```
src/
├── components/
│   ├── alpine/
│   │   ├── alpine.astro # Implementation
│   │   └── alpineContainer.astro # Display wrapper
│   ├── hyperscript/
│   │   ├── hyperscript.astro
│   │   └── hyperscriptContainer.astro
│   ├── react/
│   │   ├── NestedCheckboxes.tsx
│   │   └── ReactContainer.astro
│   ├── svelte/
│   │   ├── NestedCheckboxes.svelte
│   │   └── SvelteContainer.astro
│   ├── vanilla-js/
│   │   ├── vanilla.astro
│   │   └── vanillaContainer.astro
│   ├── vue/
│   │   ├── NestedCheckboxes.vue
│   │   └── vueContainer.astro
│   └── CodeBlock.astro          # Shared code display component
├── layouts/
│   └── Layout.astro            # Base layout
└── pages/
    └── index.astro            # Main page
```