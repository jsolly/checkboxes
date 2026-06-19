# Methodology

## What We Are Comparing

Ten implementations of the same nested-checkbox component: React, Vue, Svelte, Alpine, Vanilla JavaScript, jQuery, Stimulus, Datastar, Hyperscript, and CSS-only.

Each implementation is scored with Code Complexity, Vibe Complexity, and JS Bundle.

The component requirements are identical across frameworks:

1. A parent checkbox toggles all child checkboxes.
2. Three child checkboxes can be toggled independently.
3. The parent checkbox becomes checked, unchecked, or indeterminate based on child state.

Both metrics analyze the actual implementation source shown in each card’s code block—not display wrapper files such as `*Container.astro`.

## Why We Do Not Display Cyclomatic Complexity

McCabe cyclomatic complexity is defined on an executable control-flow graph. It does not apply cleanly to CSS-only, framework template, or declarative attribute implementations. Reporting zero for those implementations would imply simplicity where the metric is actually undefined.

Code Complexity is McCabe-inspired but defined for this cross-framework comparison so every implementation receives an auditable deterministic score. It is not cyclomatic complexity.

## Code Complexity

Code Complexity is a deterministic **0–100** score built from five capped **0–20** axes:

| Axis | What it measures |
| --- | --- |
| `size` | Implementation bulk from structural tokens after stripping presentation attributes |
| `logic` | Branch/template/selector/declarative decisions (Decision Points) |
| `reactive` | Event handlers, bindings, directives, state atoms, and behavioral selectors |
| `nesting` | Max structural depth across JS blocks, template controls, and selector/state constructs |
| `vocabulary` | Distinct operators, identifiers, directive names, and meaningful values |

Each card's metrics footer shows the total score as a labeled bar (for example, `Code Complexity 60`). Hovering or focusing the bar reveals the five subscores — Size, Logic, Reactive, Nesting, and Vocabulary — and clicking it opens a per-metric details panel.

The formula version is stored in stats metadata (`codeComplexityVersion`, currently `cc-1.0.0`).

### Formula

Each axis is log-scaled or depth-scaled, capped at 20, then summed:

```text
size       = min(20, 6 * log2(1 + astNodes / 24))
logic      = min(20, 5 * log2(1 + logicDecisions))
reactive   = min(20, 4 * log2(1 + reactiveSurface))
nesting    = min(20, 2.5 * depth + 0.5 * depth²)
vocabulary = min(20, 5 * log2(1 + vocabulary / 8))
score      = round(size + logic + reactive + nesting + vocabulary)
```

Presentation-only attributes (`class`, `className`, `style`) are stripped before size and vocabulary counting so Tailwind boilerplate does not dominate.

### Logic axis (Decision Points)

The `logic` axis reuses the Decision Points analyzer. Decision Points is a deterministic count of branching, looping, conditional template directives, declarative condition attributes, Hyperscript decision tokens, and behavioral CSS selectors.

The count starts at **0**, not 1, because it counts decision constructs rather than McCabe paths. The raw integer is stored in JSON as `codeComplexityRaw.logicDecisions`.

#### What counts in Decision Points

**JavaScript control flow** (parsed with an AST where the file is JS/TS/JSX):

- `if` / `else if`
- Ternary expressions (`? :`)
- Non-default `switch` cases (cases with a `test` expression)
- Loops: `for`, `for...in`, `for...of`, `while`, `do...while`
- `catch` clauses
- Short-circuit operators: `&&`, `||`, `??`

**Framework template directives:**

- Vue: `v-if`, `v-else-if`, `v-show`, `v-for`
- Svelte: `{#if}`, `{:else if}`, `{#each}`, `{#await}`, `{#key}`
- Astro: `client:visible`, `client:media` (and similar client directives treated as template decisions)

**Declarative attributes:**

- Alpine-style: `x-if`, `x-show`, `x-for`
- Datastar-style: `data-signals`, `data-show`, `data-ref`, `data-bind`, `data-on`
- Hyperscript: conditional and loop tokens inside `_="..."` or `data-script` attribute bodies (`if`, `else`, `unless`, `for`, `repeat`)

**Behavioral CSS selectors** (in implementation stylesheets):

- Pseudo-classes: `:has()`, `:is()`, `:not()`, `:where()`, `:checked` (when used for behavior, not mere styling)
- Attribute selectors targeting behavioral state, e.g. `[data-checked]`, `[data-state]`, `[data-selected]`, `[data-active]`

#### What does not count in Decision Points

- Function declarations, class declarations, imports, comments, whitespace, or formatting
- JSX nesting depth (markup structure alone is not a decision)
- Pure presentation CSS (layout, color, spacing without conditional behavior)
- Higher-order array methods such as `.map()` or `.every()` **unless** their inline callback contains counted control flow (e.g. an `if` inside the callback)

#### Analyzer behavior by file type

- `.js`, `.jsx`, `.ts`, `.tsx`: AST-based JavaScript counting only
- `.vue`: script blocks via AST; template directives and declarative attrs in markup; behavioral selectors in `<style>`
- `.svelte`: same split as Vue for script, template blocks, and styles
- `.astro` / `.html`: frontmatter and `<script>` via AST; template directives and declarative attrs in markup; behavioral selectors in `<style>`
- Unsupported extensions fail stats generation loudly (no silent zero)

### Raw JSON fields

`codeComplexityRaw` stores auditable counters:

- `astNodes`, `logicDecisions`, `reactiveSurface`, `maxNestingDepth`
- `distinctOperators`, `distinctOperands`, `cssSelectorParts`
- `directives`, `eventHandlers`, `bindings`, `stateAtoms`

## Vibe Complexity

Vibe Complexity is an AI-judged 0–100 score produced from the same implementation source used by Code Complexity. It is **not** averaged with Code Complexity and must be read as model-judged, not deterministic.

The evaluator (Gemini) scores each implementation on:

1. **State management clarity** — how state is stored, derived, and updated
2. **Event handling clarity** — parent/child checkbox interactions and indirection
3. **Boilerplate and framework overhead** — ceremony beyond the problem
4. **Idiomatic style and surprise factor** — how “natural” the code feels to read and maintain

Lower scores indicate implementations that feel simpler to understand and maintain. Scores may change when the model or prompt changes.

When `GEMINI_API_KEY` is set, the generator can refresh Vibe Complexity (median over multiple runs). When the key is missing or rate-limited, existing Vibe values in `src/data/framework-stats.json` are preserved.

## JS Bundle

JS Bundle is the **normalized implementation JavaScript payload** above a shared baseline test route (`/test/baseline`). It is measured from the built isolated `/test/{framework}` artifacts — not the gallery index, which loads every framework at once, and not browser transfer behavior.

The formula version is stored in stats metadata (`bundleMeasurementVersion`, currently `bm-2.0.0`).

### What gets measured

| Value | Meaning |
| --- | --- |
| **Displayed `bundleSize`** | Normalized gzip-compressed implementation JS in KiB: built route JS above `/test/baseline` |
| **`jsNormalizedBytes`** | Fixed-gzip total for all counted JavaScript required by the test route |
| **`baselineNormalizedBytes`** | Same normalized count on `/test/baseline` (layout shell, no checkbox implementation) |
| **`jsImplementationNormalizedKiB`** | The displayed value stored explicitly in the audit trail |
| **`jsRawBytes`** | Decoded JavaScript bytes before normalization |
| **`inlineJsBytes`** | Raw UTF-8 size of inline `<script>` blocks on the framework test route |
| **`inlineJsImplementationBytes`** | Inline script bytes above the baseline route, kept as audit detail |
| **`jsSources`** | Per-source audit of first-party chunks, external runtime scripts, and inline scripts |

### Measurement target

Each framework has a dedicated test page at `/test/{framework}` that renders only that implementation — no card chrome, no code blocks, no sort controls. React, Vue, and Svelte use `client:only` on the test routes, matching how they hydrate on the gallery cards. Alpine is loaded only by the Alpine implementation, not globally, so its runtime is not hidden in the baseline.

The baseline page (`/test/baseline`) uses the same Astro layout and measurement shell but renders no checkbox implementation. Its normalized JavaScript payload is subtracted from every framework total so shared page overhead does not dominate the comparison.

### How payload bytes are captured

Measurement reads the built Astro output:

1. Parse `dist/test/baseline/index.html` and each `dist/test/{framework}/index.html`.
2. Collect required JavaScript references: first-party `/_astro/*.js` chunks, Astro island `component-url` / `renderer-url` chunks, allowed external runtime scripts, and inline JavaScript `<script>` blocks.
3. Read first-party chunks directly from `dist/_astro`.
4. Fetch allowed external runtime scripts as decoded bytes.
5. Follow first-party module imports so tiny wrapper chunks that import a runtime still count the imported JavaScript.
6. Compress every counted JavaScript source with the same local gzip settings.
7. Subtract the baseline normalized bytes from each framework route.
8. Store the audit trail and display `jsImplementationNormalizedKiB`.

### Which sources count

Only these sources are included in the normalized total:

- First-party built chunks: `/_astro/*.js`
- Astro island component and renderer chunks referenced by `component-url` / `renderer-url`
- First-party module imports discovered from counted chunks
- Implementation CDN scripts: only `unpkg.com` (Hyperscript) and `cdn.jsdelivr.net` (Datastar) are allowlisted. Unknown external JavaScript hosts fail stats generation loudly.
- Inline JavaScript scripts from the built test route

Excluded: CSS, JSON data scripts, dev-server artifacts (`@vite/client`, `@fs/`, `node_modules/`, source files), and non-JavaScript resources. Unknown external JavaScript hosts fail stats generation loudly so a new CDN cannot silently report as zero.

**Important:** run `npm run build` before `npm run generate-stats`. Bundle measurement reads the built `dist/` artifacts directly.

### Environment caveats

- The displayed metric is not a browser transfer measurement. It normalizes decoded JavaScript with a fixed local gzip compressor (level 9) so preview-server and CDN compression differences do not introduce variance.
- External runtime scripts are fetched during stats generation. If the CDN content changes without a version change, regenerated stats can change.
- CSS-only should show 0 KiB implementation JS when no implementation script is shipped.

Each framework entry in `src/data/framework-stats.json` stores a full `bundleMeasurement` audit trail. The card bar is filled relative to the largest incremental bundle in the comparison. Lower is better.

## Normalization

Code Complexity is already normalized to 0–100 by the five-axis formula. No separate display score is needed.

Z-scores for bundle size, Code Complexity, and Vibe Complexity are computed across all frameworks in the dataset so badge colors reflect relative standing, with higher z-scores treated as worse for all three metrics.

## Reproducing The Numbers

Run `npm run build`, then `npm run generate-stats`. Set `GEMINI_API_KEY` to update Vibe Complexity; leave it unset to preserve existing Vibe values.

```shell
npm run build
npm run generate-stats
```

Optional `.env` for Vibe refresh:

```shell
GEMINI_API_KEY=your_key_here
```

Bundle sizes and Code Complexity are always measured. Vibe Complexity requires a Gemini API key; without one, existing Vibe Complexity scores are preserved.

Deterministic analysis fails the command when the configured implementation file is missing, the extension is unsupported, or parsing fails. Vibe Complexity tolerates a missing key by preserving prior values; non-rate-limit Gemini errors still fail generation.
