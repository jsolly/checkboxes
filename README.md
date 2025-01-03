# Checkbox Examples

A collection of checkbox implementations using different frameworks and approaches.

## Features

- Multiple implementation examples:
  - React
  - Vue.js
  - Svelte
  - Alpine.js
  - Vanilla JavaScript
  - Hyperscript
- Syntax highlighted collapsible code snippets

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build
```

## Contributing

To add a new implementation, create a new directory in the `src/components` directory with the framework name. Then create a file with the implementation and a container file with the display wrapper.

At this point, you could open a PR, but if you want to add the whole integration, see the [Astro Framework Integration Guide](https://docs.astro.build/en/guides/integrations/). This usually involves modifying the `astro.config.mjs` file to add the framework and its configuration.

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

## Unimplemented Frameworks

- Angular
- SolidJS