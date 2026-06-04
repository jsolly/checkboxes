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
- Datastar-style: `data-if`, `data-show`, `data-for`, `data-bind`, `data-on-*`
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

JS Bundle is the **implementation JavaScript payload** above a shared baseline test route (`/test/baseline`). It is measured on isolated `/test/{framework}` pages — not the gallery index, which loads every framework at once.

The formula version is stored in stats metadata (`bundleMeasurementVersion`, currently `bm-1.0.0`).

### What gets measured

| Value | Meaning |
| --- | --- |
| **Displayed `bundleSize`** | Median implementation JS in KiB: external JS transfer above baseline plus inline JS bytes above baseline |
| **`jsTransferTotalKiB`** | All counted JS requests on the framework test route |
| **`baselineJsTransferKiB`** | Same count on `/test/baseline` (layout shell, no checkbox implementation) |
| **`inlineJsBytes`** | Uncompressed UTF-8 size of inline `<script>` blocks on the framework test route |
| **`inlineJsImplementationBytes`** | Inline script bytes above the baseline route |
| **`jsImplementationTotalKiB`** | The displayed value stored explicitly in the audit trail |
| **`jsRequests`** | Per-URL audit of completed transfer bytes |

### Measurement target

Each framework has a dedicated test page at `/test/{framework}` that renders only that implementation — no card chrome, no code blocks, no sort controls. React, Vue, and Svelte use `client:only` on the test routes, matching how they hydrate on the gallery cards. Alpine is loaded only by the Alpine implementation, not globally, so its runtime is not hidden in the baseline.

The baseline page (`/test/baseline`) uses the same Astro layout and measurement shell but renders no checkbox implementation. Its external JS transfer and inline script bytes are subtracted from every framework total so shared page overhead does not dominate the comparison.

### How transfer bytes are captured

Measurement uses Puppeteer with Chrome DevTools Protocol:

1. Disable cache (`page.setCacheEnabled(false)` and `Network.setCacheDisabled`).
2. Track each request by `requestId` from `Network.requestWillBeSent` through `Network.responseReceived` (MIME type, cache status) to **`Network.loadingFinished`** (authoritative completed transfer size via `encodedDataLength`).
3. Do **not** use `Network.responseReceived.response.encodedDataLength` — that value reflects bytes received so far when headers arrive, not the completed body.
4. Filter to JavaScript requests only, deduplicate by URL (so Vite `modulepreload` and module execution share one count).
5. Navigate with `waitUntil: "networkidle0"`, then measure inline scripts from the rendered DOM.
6. Measure the baseline and each framework three times.
7. Store the median run's audit trail and display its `jsImplementationTotalKiB`.

### Which requests count

Only these URLs are included in the network total:

- First-party built chunks: `/_astro/*.js`
- Implementation CDN scripts: `unpkg.com` (Hyperscript), `cdn.jsdelivr.net` (Datastar)

Excluded: dev-server artifacts (`@vite/client`, `@fs/`, `node_modules/`, source files), CSS mislabeled as Script, failed requests, and cache hits.

**Important:** stats must be generated against **`pnpm preview`** (built static output). If a dev server is already bound to port `4321`, preview may start on another port — set `STATS_PREVIEW_URL` (for example `http://localhost:4322/test`) so measurements hit the preview server, not Vite dev mode.

### Environment caveats

- Browser transfer bytes depend on the server's compression behavior. `astro preview` served gzip-compressed JS in local verification; production CDNs may use gzip, brotli, or different headers.
- Inline scripts are measured as uncompressed UTF-8 bytes because they are delivered inside the HTML document rather than as separate JS requests. This makes inline-only implementations such as Vanilla JS visible in the displayed total.
- CSS-only should show 0 KiB implementation JS when no implementation script is shipped.

Each framework entry in `src/data/framework-stats.json` stores a full `bundleMeasurement` audit trail. The card bar is filled relative to the largest incremental bundle in the comparison. Lower is better.

## Normalization

Code Complexity is already normalized to 0–100 by the five-axis formula. No separate display score is needed.

Z-scores for bundle size, Code Complexity, and Vibe Complexity are computed across all frameworks in the dataset so badge colors reflect relative standing, with higher z-scores treated as worse for all three metrics.

## Reproducing The Numbers

Run `pnpm build`, `pnpm preview`, and `pnpm generate-stats`. Set `GEMINI_API_KEY` to update Vibe Complexity; leave it unset to preserve existing Vibe values.

```shell
pnpm build
pnpm preview          # separate terminal — must serve built dist/, not dev mode
pnpm generate-stats   # new terminal; preview must be running for bundle sizes
```

If preview binds a port other than `4321`:

```shell
STATS_PREVIEW_URL=http://localhost:4322/test pnpm generate-stats
```

Optional `.env` for Vibe refresh:

```shell
GEMINI_API_KEY=your_key_here
```

Bundle sizes and Code Complexity are always measured. Vibe Complexity requires a Gemini API key; without one, existing Vibe Complexity scores are preserved.

Deterministic analysis fails the command when the configured implementation file is missing, the extension is unsupported, or parsing fails. Vibe Complexity tolerates a missing key by preserving prior values; non-rate-limit Gemini errors still fail generation.
