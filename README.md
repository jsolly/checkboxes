# Checkboxes.xyz

A collection of checkbox implementations using different frameworks and approaches.


## Features

- Multiple implementation examples:
  - React
  - Vue.js
  - Svelte
  - Alpine.js
  - Vanilla JavaScript
  - Hyperscript
  - CSS Only
  - jQuery
- Syntax highlighted collapsible code snippets
- Performance metrics for each implementation
## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build

# Generate performance metrics
pnpm preview
pnpm generate-stats
```

## Contributing

To add a new implementation, create a new directory in the `src/components` directory with the framework name. Then create a file with the implementation and a container file with the display wrapper.

At this point, you could open a PR, but if you want to add the whole integration, see the [Astro Framework Integration Guide](https://docs.astro.build/en/guides/integrations/). This usually involves modifying the `astro.config.mjs` file to add the framework and its configuration.

## Project Structure

```
src/
├── components/
│   ├── react/
│   │   ├── ReactNestedCheckboxes.tsx
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

## Future Enhancements

- Add more frameworks (Angular, Solid.js)
- Add performance comparisons [x]
- Create interactive playground [ ]
- Add more complex checkbox scenarios [ ]

## Notes on Performance Metrics

Each framework implementation is evaluated on two key metrics:

### Bundle Size
- Measured in kilobytes (KB)
- Calculated by monitoring network requests during page load
- Only includes JavaScript resources (`type: "Script"`)
- Represents the compressed (encoded) size of all JS assets
- Lower scores are better

### Complexity Score
- Scored from 0-100 (whole numbers)
- Evaluated using AI analysis of the implementation code
- Weighted based on three criteria:
  1. **State Management (40%)**: How state is stored and updated
  2. **Event Handling (35%)**: Parent-child checkbox interactions
  3. **Code Overhead (25%)**: Boilerplate and framework abstractions
- Lower scores indicate simpler implementations

Both metrics are normalized using z-scores to provide relative performance indicators, displayed as colored badges:
- 🟢 Excellent (z-score < -1.5)
- 🟢 Good (z-score < -0.5)
- 🟡 Average (-0.5 ≤ z-score < 0.5)
- 🟠 Below Average (0.5 ≤ z-score < 1.5)
- 🔴 Poor (z-score ≥ 1.5)

