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

```shell
pnpm install
pnpm dev
```

## Generate performance metrics

```shell
touch .env # Create an empty .env file
# Get your GEMINI_API_KEY from https://makersuite.google.com/app/apikey
# Add it to .env: GEMINI_API_KEY=your_key_here
# The API key is used for generating complexity scores

# Run these commands in sequence:
pnpm build           # Build the project
pnpm preview         # Start the preview server (in a separate terminal)
pnpm generate-stats  # Generate performance metrics (in a new terminal)
```

## Contributing

### Adding a New Framework Implementation

1. **Create Framework Files**
   - Create a new directory in `src/components` with your framework name
   - Add two required files:
     - `src/your-framework/your-framework<.tsx/jsx/etc>` - The checkbox implementation
     - `src/your-framework/your-framework-container.astro` - The display wrapper

2. **Update Framework Configuration**
   - Add the framework to `src/config/frameworks.ts`:
     ```typescript
     export const FRAMEWORKS = {
       yourFramework: {
         displayName: "Your Framework",  // Name shown in the UI
       },
       // ... existing frameworks
     };
     ```

3. **Add Framework Integration**
   - Install framework dependencies:
     ```bash
     pnpm add @astrojs/your-framework your-framework
     ```
   - Update `astro.config.mjs` to add the framework integration:
     ```javascript
     import yourFramework from '@astrojs/your-framework';

     export default defineConfig({
       integrations: [
         // ... existing integrations
         yourFramework(),
       ],
     });
     ```

4. **Update Test Page**
   - Modify `src/pages/test/[framework].astro` to include your framework:
     ```astro
     ---
     import YourFramework from "../../components/your-framework/your-framework";
     // ... existing imports
     ---
     
     <div class="framework-container">
       {/* Add your framework */}
       {frameworkId === "yourFramework" && <YourFramework client:only="your-framework" />}
       {/* ... existing frameworks */}
     </div>
     ```

5. **Add Framework Stats**
   - Update `src/config/stats.ts` if your framework needs special handling:
     ```typescript
     SUPPORTED_EXTENSIONS: [
       ".tsx", 
       ".jsx", 
       ".astro", 
       ".vue", 
       ".svelte",
       ".your-extension"  // Add if needed
     ],
     ```
   - Generate framework stats:
     ```shell
     pnpm generate-stats
     ```

At this point, you could open a PR. For full framework integration, see the [Astro Framework Integration Guide](https://docs.astro.build/en/guides/integrations-guide/). This usually involves modifying the `astro.config.mjs` file to add the framework and its configuration.

If you want to generate performance metrics for your new implementation, see the [Generate performance metrics](#generate-performance-metrics) section.

### Troubleshooting Setup

- If `generate-stats` fails, ensure:
  - Your GEMINI_API_KEY is valid and properly set in .env
  - You've run `pnpm build` before running `pnpm preview`
  - The preview server is running when you run `generate-stats`
  - You have Node.js 16+ installed
- For framework integration issues, check:
  - Required dependencies are installed
  - Framework is properly configured in astro.config.mjs
  - TypeScript types are updated if needed
  - For stats generation issues, verify your implementation file matches the expected extension in `SUPPORTED_EXTENSIONS` within `src/config/stats.ts`

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

- [ ] Add more frameworks (Angular, Solid.js)
- [x] Add performance comparisons
- [ ] Create interactive playground
- [ ] Add more complex checkbox scenarios

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

## Demo
Check out the live demo at [checkboxes.xyz](https://checkboxes.xyz)

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Prerequisites

- Node.js 16+
- pnpm
- A Google Cloud account (for Gemini API access to generate complexity scores)

