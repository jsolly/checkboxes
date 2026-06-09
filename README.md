# Checkboxes.xyz

A collection of checkbox implementations using different frameworks and approaches.


## Features

- Multiple implementation examples:
  - Datastar
  - React
  - Vue.js
  - Svelte
  - Alpine.js
  - Vanilla JavaScript
  - Hyperscript
  - CSS Only
  - jQuery
  - Stimulus
- Syntax highlighted collapsible code snippets
- Performance metrics for each implementation

## Development

```shell
npm install
npm run dev
```

## Generate performance metrics

```shell
# Run these commands in sequence:
npm run build           # Build the project
npm run generate-stats  # Generate performance metrics from dist/
```

Bundle sizes and Code Complexity are always measured. Vibe Complexity requires a Gemini API key. Without one, existing Vibe Complexity scores are preserved. To refresh Vibe Complexity, create a `.env` file with your key:

```shell
# Get your key from https://aistudio.google.com/apikey
GEMINI_API_KEY=your_key_here
```

## Contributing

### Adding a New Framework Implementation

1. **Create Framework Files**
   - Create a new directory in `src/components` with your framework name
   - Add two required files:
     - `src/your-framework/your-framework<.tsx/jsx/etc>` - The checkbox implementation
     - `src/your-framework/your-framework-container.astro` - The display wrapper

2. **Add Framework Logo**
   - Add your framework's logo as an SVG file to `src/assets/logos/`
   - Name it consistently (e.g., `your-framework.svg`)
   - Example logo import in your container:
     ```astro
     ---
     import yourFrameworkLogo from "../../assets/logos/your-framework.svg";
     // ... other imports
     ---
     ```

3. **Update Framework Configuration**
   - Add the framework to `src/config/frameworks.ts`:
     ```typescript
     export const FRAMEWORKS = {
       yourFramework: {
         displayName: "Your Framework",  // Name shown in the UI
       },
       // ... existing frameworks
     };
     ```

4. **Add Framework Integration**
   - Install framework dependencies:
     ```bash
     npm install @astrojs/your-framework your-framework
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

5. **Update Test Page**
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

6. **Add Framework Stats**
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
     npm run generate-stats
     ```

At this point, you could open a PR. For full framework integration, see the [Astro Framework Integration Guide](https://docs.astro.build/en/guides/integrations-guide/). This usually involves modifying the `astro.config.mjs` file to add the framework and its configuration.

If you want to generate performance metrics for your new implementation, see the [Generate performance metrics](#generate-performance-metrics) section.

### Troubleshooting Setup

- If `generate-stats` fails, ensure:
  - Your GEMINI_API_KEY is valid and properly set in `.env` (only if refreshing Vibe Complexity)
  - You've run `npm run build` before running `npm run generate-stats`
  - Any external JavaScript runtime host used by the implementation must be explicitly allowlisted
  - You have Node.js 24+ installed
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

Each framework implementation is evaluated on three metrics:

### Bundle Size
- Measured in kibibytes (KiB)
- Calculated from built isolated `/test/{framework}` artifacts after `npm run build`
- Includes first-party chunks, allowed external runtime scripts, and inline JavaScript
- Represents normalized gzip-compressed implementation JavaScript above `/test/baseline`
- Lower scores are better

### Code Complexity
- Deterministic 0-100 composite of size, logic, reactive, nesting, and vocabulary
- Calculated from the actual implementation source shown on each card
- The `logic` axis reuses Decision Points (branch/template/selector counts)
- Higher scores indicate more implementation surface area

### Vibe Complexity
- AI-judged implementation complexity on a 0-100 scale
- Uses the same implementation source as Code Complexity
- Requires a Gemini API key to refresh
- Existing Vibe Complexity scores are preserved when no key is available

See [METHODOLOGY.md](METHODOLOGY.md) for counting rules, normalization, and reproduction steps.

The metrics are normalized using z-scores to provide relative performance indicators, displayed as colored badges:
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

- Node.js 24+
- npm
- A Gemini API key (optional; only needed to refresh Vibe Complexity)

