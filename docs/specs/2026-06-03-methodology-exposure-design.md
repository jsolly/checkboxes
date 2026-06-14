# Methodology Exposure Design

## Goal

Make the comparison gallery explain *what it is measuring* and *how*, directly on the
site. Two changes work together:

1. Replace the cramped, shouting metric pills with a calm "relative bars" footer on each
   framework card, using the full metric names **Code Complexity**, **Vibe Complexity**,
   and **JS Bundle**.
2. Expose the scoring methodology to visitors through three layers of depth — a glance
   tooltip, a per-metric focus modal, and a dedicated on-site `/methodology` page — so the
   reasoning is no longer hidden in a GitHub-only `METHODOLOGY.md`.

## Problem

Today each card carries three saturated, fully-filled pill badges in its top-right corner
(`Code: 74/100`, `Vibe: 65/100`, `JS Bundle: 1.53kb`). With the full metric names the pills
become large blocks that crowd the framework title and dominate the card — visually loud and
hard to scan.

Separately, the only real explanation of the metrics lives in `METHODOLOGY.md` and the
`README`, both visible only to people browsing the repository on GitHub. A visitor on
`checkboxes.xyz` sees scores with no way to learn what "Code Complexity" or "Vibe Complexity"
mean, how they are computed, or why one is deterministic and the other is AI-judged. The tiny
hover tooltips that exist give a partial breakdown but no path to the full reasoning.

## Definitions

- **Code Complexity** — the existing deterministic 0–100 composite (five capped axes: size,
  logic, reactive, nesting, vocabulary). Reproducible, no model involved.
- **Vibe Complexity** — the existing AI-judged 0–100 score from Gemini. Model-judged; may
  change when the model or prompt changes.
- **JS Bundle** — compressed JavaScript shipped for the implementation, measured during page
  load. Reported in KB; no natural 0–100 scale.

## Requirements

1. Every metric label shown to users uses the full name: **Code Complexity**, **Vibe
   Complexity**, **JS Bundle**. No "Code" / "Vibe" shorthand remains in the UI.
2. Each framework card displays its three metrics in a footer region below the checkbox
   demo, not overlapping the framework title.
3. Each metric renders as a row: metric name · horizontal bar · value.
4. Bar **length** is honest per metric:
   - Code Complexity and Vibe Complexity fill to `score / 100` (the bar matches the number).
   - JS Bundle fills relative to the largest bundle size in the dataset (no 0–100 scale
     exists, so relative-to-max is the only honest choice).
5. Bar **color** uses the existing z-score bands (🟢 excellent → 🔴 poor), so color conveys
   standing relative to the field while length stays literal.
6. Three layers of explanation are available for every metric:
   - **Glance — tooltip** on hover/focus: subscores (where applicable) plus a one-line
     description and a "details" affordance.
   - **Focus — modal** on activation of a metric: a plain-language explanation of that single
     metric, tagged **Deterministic** (Code Complexity, JS Bundle) or **AI-judged** (Vibe
     Complexity), with a link onward to the methodology page.
   - **Reference — `/methodology` page**: the full write-up, reachable from an always-visible
     header **Methodology** link, with a shareable URL.
7. The `/methodology` page is the single canonical long-form source. Tooltip and modal copy
   are short summaries only — intentional brevity, not duplicated long-form docs.
8. Metric controls that open the modal are real focusable buttons supporting keyboard
   activation; the modal closes on Escape and on backdrop click, and returns focus to the
   trigger.
9. The honest framing is visible to users: Code Complexity and JS Bundle are presented as
   deterministic/measured; Vibe Complexity is presented as AI-judged and subject to change.

## Architecture

The change is presentation-only. The stats generation pipeline (deterministic Code
Complexity analysis, Gemini-based Vibe Complexity, bundle measurement, z-score
normalization, and `framework-stats.json` shape) is unchanged. All work happens in the
display layer.

### Card metrics footer

Replace the absolutely-positioned `.badge-container` pill group in
`PerformanceBadge.astro` (or its successor component) with a footer-style metrics block
rendered inside each framework container, after the checkbox demo. The component receives the
same `FrameworkStats` it does today and computes:

- bar fill percentage per metric (per requirement 4),
- bar color class from the existing z-score thresholds (reuse the current `getColorClass`
  logic),
- the displayed value string (`60`, `65`, `1.53kb`).

The largest bundle size needed for the JS Bundle bar denominator is derived from the full
stats dataset; the component must have access to the dataset max (passed in or imported), not
just the single framework's value.

### Explanation layers

- **Tooltip**: keep an on-card tooltip per metric, carrying the short summary plus subscores
  for Code Complexity. Trigger on hover and keyboard focus.
- **Modal**: a single modal component driven by which metric was activated. Content is keyed
  by metric (Code Complexity / Vibe Complexity / JS Bundle): title, deterministic-vs-AI tag,
  short explanation, relevant axes or factors, and a link to `/methodology`. One modal
  instance per page, reused across cards.
- **Methodology page**: a new Astro route at `/methodology` that renders the canonical
  long-form methodology content. To keep a single source of truth, the page renders the
  existing `METHODOLOGY.md` rather than restating its content in a separate template.
- **Header link**: an always-visible **Methodology** link in the site header/layout pointing
  to `/methodology`.

## UI Copy

- Tooltip (Code Complexity): subscores line + "Deterministic 0–100, no AI. Details →".
- Tooltip (Vibe Complexity): "AI-judged 0–100 — state clarity, event handling, boilerplate,
  idiomatic feel. Details →".
- Tooltip (JS Bundle): "Compressed JS shipped, captured during page load. Details →".
- Modal tags: **Deterministic · no AI** (Code Complexity, JS Bundle); **AI-judged · may
  change** (Vibe Complexity).
- Header link label: **Methodology**.

## Alternatives Considered

- **Richer tooltips only** (no page/modal): rejected — still hides the full reasoning from
  anyone not hovering, and tooltips cannot hold the full methodology.
- **Modal only / page only**: rejected in favor of layered depth; glance/focus/reference each
  serve a distinct need without duplicating long-form content.
- **Outlined chips or a plain footer stat strip** instead of bars: viable and calmer than
  today, but bars additionally encode relative standing through length+color, which matches
  the data the z-scores already compute.
- **Fully relative ("rank among the field") bar length for all metrics**: rejected for the
  0–100 metrics because it makes "60" not look like 60% full, which reads as the bar lying.
  Relative fill is retained only for JS Bundle, which has no 0–100 scale.

## Acceptance Criteria

- Cards show a calm metrics footer with full metric names; no saturated pill group overlaps
  the title.
- Code Complexity and Vibe Complexity bars fill to `score/100`; JS Bundle fills
  relative-to-max; all three are colored by z-score band.
- Hovering or focusing a metric shows the glance tooltip; activating a metric opens the
  per-metric focus modal; the modal links to `/methodology`.
- `/methodology` exists, is linked from the header, renders the canonical methodology
  content, and has a shareable URL.
- Metric triggers are keyboard-accessible and the modal is dismissable via Escape and
  backdrop, restoring focus to the trigger.
- No change to stats generation, `framework-stats.json` shape, or the sort dropdown.
- `pnpm build` succeeds.

## Open Questions

- Exact mechanism for rendering `METHODOLOGY.md` on the Astro page (markdown import vs. a
  content collection) is left to the implementation plan.
- Whether the methodology page should deep-link to per-metric sections (so the modal's "Read
  the full methodology →" lands on the right anchor) — desirable, to be confirmed in the plan.
