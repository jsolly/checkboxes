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

Each framework implementation is measured using the following methodology:

### Measurement Process
- **Number of Runs**: 5 iterations per framework
- **Metrics Collected**:
  - Render Time: Time until framework is ready (or DOM interactive as fallback)
  - Bundle Size: Total JavaScript bundle size in KB

### How Metrics are Calculated
- **Render Time**: 
  - Primary: Uses `window.frameworkReady` timing when available
  - Fallback: Uses `domInteractive` timing from Performance API
  - Final value is the median of 5 measurements
- **Bundle Size**: 
  - Measures total size of all JavaScript files
  - Includes framework code and implementation code
  - Reports compressed (gzipped) size

### Performance Badge Colors
Each metric is compared to other frameworks using Z-scores (standard deviations from mean):
- 🟢 **Dark Green** (-1.5 or lower): Much faster/smaller than average
- 🟩 **Light Green** (-1.5 to -0.5): Better than average
- 🟨 **Yellow** (-0.5 to 0.5): Average performance
- 🟧 **Orange** (0.5 to 1.5): Worse than average
- 🟥 **Red** (1.5 or higher): Much slower/larger than average

For example, with current measurements:
- VanillaJS render time (Z=-2.48): 🟢 Much faster than average
- React bundle size (Z=1.67): 🟥 Much larger than average
- Alpine render time (Z=0.35): 🟨 Average performance

### Technical Details
- Measurements use Puppeteer in a controlled environment
- Navigation timing via `performance.getEntriesByType("navigation")`
- Bundle sizes tracked via Chrome DevTools Protocol
- Z-scores automatically calculated during build
- Results stored in `src/data/framework-stats.json`

