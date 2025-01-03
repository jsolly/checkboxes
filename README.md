# Checkboxes.xyz

A collection of checkbox implementations using different frameworks and approaches.
![CleanShot 2025-01-03 at 18 22 30](https://github.com/user-attachments/assets/f8f45f40-1ab6-4533-9347-80e4fb6ed11d)


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
│   ├── react/
│   │   ├── NestedCheckboxes.tsx
│   │   └── ReactContainer.astro
│   ├── alpine/
│   │   ├── alpine.astro
│   │   └── AlpineContainer.astro
│   ├── [other-frameworks]/     # Similar structure for other frameworks
│   │   └── ...
│   └── CodeBlock.astro         # Shared code display component
├── layouts/
│   └── Layout.astro            # Base layout
└── pages/
    └── index.astro            # Main page
```

## Unimplemented Frameworks

- Angular
- SolidJS
