# Methodology

## 1. What We Are Comparing

Ten implementations of the same nested-checkbox component: React, Vue, Svelte, Alpine, Vanilla JavaScript, jQuery, Stimulus, Datastar, Hyperscript, and CSS-only.

Each implementation is scored with Decision Points and Vibe Complexity.

The component requirements are identical across frameworks:

1. A parent checkbox toggles all child checkboxes.
2. Three child checkboxes can be toggled independently.
3. The parent checkbox becomes checked, unchecked, or indeterminate based on child state.

Both metrics analyze the actual implementation source shown in each card’s code block—not display wrapper files such as `*Container.astro`.

## 2. Why We Do Not Display Cyclomatic Complexity

McCabe cyclomatic complexity is defined on an executable control-flow graph. It does not apply cleanly to CSS-only, framework template, or declarative attribute implementations. Reporting zero for those implementations would imply simplicity where the metric is actually undefined.

Decision Points is McCabe-inspired but defined for this cross-framework comparison so every implementation receives an auditable deterministic number. It is not cyclomatic complexity.

## 3. Decision Points

Decision Points is a deterministic count of branching, looping, conditional template directives, declarative condition attributes, Hyperscript decision tokens, and behavioral CSS selectors.

The count starts at **0**, not 1, because it counts decision constructs rather than McCabe paths. The raw integer is the durable, auditable value; the 0–100 display score is derived from it (see [Normalization](#5-normalization)).

Results include a breakdown so you can see where decisions came from:

| Breakdown field | What it measures |
| --- | --- |
| `jsControlFlow` | Branches, loops, and short-circuit logic in JavaScript/TypeScript (including Astro frontmatter and `<script>` blocks) |
| `templateDirectives` | Framework template conditionals and loops (Vue, Svelte, Astro client directives) |
| `declarativeAttrs` | Declarative conditional/loop attributes and Hyperscript decision tokens |
| `selectors` | Behavioral CSS selectors in `<style>` blocks |

### What counts

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

### What does not count

- Function declarations, class declarations, imports, comments, whitespace, or formatting
- JSX nesting depth (markup structure alone is not a decision)
- Pure presentation CSS (layout, color, spacing without conditional behavior)
- Higher-order array methods such as `.map()` or `.every()` **unless** their inline callback contains counted control flow (e.g. an `if` inside the callback)

### Analyzer behavior by file type

- `.js`, `.jsx`, `.ts`, `.tsx`: AST-based JavaScript counting only
- `.vue`: script blocks via AST; template directives and declarative attrs in markup; behavioral selectors in `<style>`
- `.svelte`: same split as Vue for script, template blocks, and styles
- `.astro` / `.html`: frontmatter and `<script>` via AST; template directives and declarative attrs in markup; behavioral selectors in `<style>`
- Unsupported extensions fail stats generation loudly (no silent zero)

## 4. Vibe Complexity

Vibe Complexity is an AI-judged 0–100 score produced from the same implementation source used by Decision Points. It is **not** averaged with Decision Points and must be read as model-judged, not deterministic.

The evaluator (Gemini) scores each implementation on:

1. **State management clarity** — how state is stored, derived, and updated
2. **Event handling clarity** — parent/child checkbox interactions and indirection
3. **Boilerplate and framework overhead** — ceremony beyond the problem
4. **Idiomatic style and surprise factor** — how “natural” the code feels to read and maintain

Lower scores indicate implementations that feel simpler to understand and maintain. Scores may change when the model or prompt changes.

When `GEMINI_API_KEY` is set, the generator can refresh Vibe Complexity (median over multiple runs). When the key is missing or rate-limited, existing Vibe values in `src/data/framework-stats.json` are preserved.

## 5. Normalization

Decision Point score uses:

```text
min(100, round((decisionPoints / 30) * 100))
```

The cap **30** is fixed in metadata (`decisionPointScoreCap`). The raw `decisionPoints` count is the auditable value; the normalized score is only for at-a-glance comparison on cards (`Decisions: 11 (37/100)`).

Z-scores for bundle size, Decision Points, and Vibe Complexity are computed across all frameworks in the dataset so badge colors reflect relative standing, with higher z-scores treated as worse for all three metrics.

## 6. Reproducing The Numbers

Run `pnpm build`, `pnpm preview`, and `pnpm generate-stats`. Set `GEMINI_API_KEY` to update Vibe Complexity; leave it unset to preserve existing Vibe values.

```shell
pnpm build
pnpm preview          # separate terminal
pnpm generate-stats   # new terminal; preview must be running for bundle sizes
```

Optional `.env` for Vibe refresh:

```shell
GEMINI_API_KEY=your_key_here
```

Bundle sizes and Decision Points are always measured. Vibe Complexity requires a Gemini API key; without one, existing Vibe Complexity scores are preserved.

Deterministic analysis fails the command when the configured implementation file is missing, the extension is unsupported, or parsing fails. Vibe Complexity tolerates a missing key by preserving prior values; non-rate-limit Gemini errors still fail generation.
