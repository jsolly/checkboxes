# Methodology Exposure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** docs/specs/2026-06-03-methodology-exposure-design.md

**Goal:** Replace the loud metric pills with a calm "relative bars" card footer using full metric names, and expose the scoring methodology through three layers — glance tooltip, per-metric focus modal, and a dedicated `/methodology` page.

**Architecture:** Presentation-only. A new pure, tested util (`src/utils/metricDisplay.ts`) computes bar fill %, z-score color, and per-metric copy from the unchanged `FrameworkStats`. `PerformanceBadge.astro` is rebuilt into a footer of metric rows that consume the util; `FrameworkContainer.astro` passes the dataset's max bundle size. A single delegated-click `MetricModal.astro` (rendered once per page) shows per-metric detail. A new `src/pages/methodology.astro` renders the existing root `METHODOLOGY.md` as the single canonical source, linked from `Layout.astro`.

**Tech Stack:** Astro 5, TypeScript, Tailwind, `node:test` + `node:assert` (run via `tsx --test`, i.e. `pnpm test`), Biome.

---

## File Structure

- **Create** `src/utils/metricDisplay.ts` — pure helpers: metric descriptors (name/kind/anchor/copy), `barFillPercent`, `zScoreColorClass`, `maxBundleSize`, `formatMetricValue`.
- **Create** `tests/lib/metric-display.test.ts` — unit tests for the util.
- **Modify** `src/components/shared/PerformanceBadge.astro` — rebuild from a top-right pill group into a metrics footer of three bar rows; rename component file is out of scope (keep filename to limit churn).
- **Modify** `src/components/shared/FrameworkContainer.astro` — compute and pass `maxBundleSize`; render the footer below the demo (it already renders `PerformanceBadge`).
- **Create** `src/components/shared/MetricModal.astro` — single per-page modal; delegated click + keyboard handling.
- **Modify** `src/pages/index.astro` — include `<MetricModal />` once.
- **Modify** `src/pages/test/[framework].astro` — include `<MetricModal />` once (so badges work on the per-framework test page too).
- **Create** `src/pages/methodology.astro` — renders root `METHODOLOGY.md`.
- **Modify** `src/layouts/Layout.astro` — always-visible header with a **Methodology** link.

---

## Task 1: Metric display util (pure, tested)

**Files:**
- Create: `src/utils/metricDisplay.ts`
- Test: `tests/lib/metric-display.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/metric-display.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FrameworkStats, FrameworkStatsRecord } from "../../src/types/stats";
import {
	METRIC_DISPLAY,
	barFillPercent,
	formatMetricValue,
	maxBundleSize,
	zScoreColorClass,
} from "../../src/utils/metricDisplay";

function makeStats(overrides: Partial<FrameworkStats>): FrameworkStats {
	return {
		bundleSize: 1.53,
		codeComplexity: 60,
		vibeComplexity: 65,
		bundleSizeZScore: 0,
		codeComplexityZScore: 0,
		vibeComplexityZScore: 0,
		codeComplexitySubscores: {
			size: 20,
			logic: 10,
			reactive: 14.8,
			nesting: 0,
			vocabulary: 15.6,
		},
		codeComplexityRaw: {
			astNodes: 349,
			logicDecisions: 3,
			reactiveSurface: 12,
			maxNestingDepth: 0,
			distinctOperators: 38,
			distinctOperands: 51,
			cssSelectorParts: 0,
			directives: 0,
			eventHandlers: 3,
			bindings: 0,
			stateAtoms: 9,
			vocabulary: 62,
		},
		...overrides,
	};
}

describe("A visitor reads the metric footer on a framework card", () => {
	it("fills the Code Complexity bar to the raw score (60 looks like 60%)", () => {
		const react = makeStats({ codeComplexity: 60 });
		assert.equal(barFillPercent("codeComplexity", react, 1.53), 60);
	});

	it("fills the Vibe Complexity bar to the raw score", () => {
		const react = makeStats({ vibeComplexity: 65 });
		assert.equal(barFillPercent("vibeComplexity", react, 1.53), 65);
	});

	it("fills the JS Bundle bar relative to the largest bundle in the field", () => {
		const react = makeStats({ bundleSize: 1.53 });
		// React's 1.53kb is the largest bundle -> full bar.
		assert.equal(barFillPercent("bundleSize", react, 1.53), 100);
		const vanilla = makeStats({ bundleSize: 0.31 });
		// 0.31 / 1.53 = 20.26% -> rounds to 20.
		assert.equal(barFillPercent("bundleSize", vanilla, 1.53), 20);
	});

	it("never produces a fill below 0 or above 100", () => {
		assert.equal(barFillPercent("codeComplexity", makeStats({ codeComplexity: 140 }), 1.53), 100);
		assert.equal(barFillPercent("codeComplexity", makeStats({ codeComplexity: -5 }), 1.53), 0);
		assert.equal(barFillPercent("bundleSize", makeStats({ bundleSize: 0.31 }), 0), 0);
	});

	it("maps z-score standing to the existing badge colors", () => {
		assert.equal(zScoreColorClass(2.0), "bg-red-500");
		assert.equal(zScoreColorClass(0.95), "bg-orange-500");
		assert.equal(zScoreColorClass(0.33), "bg-yellow-500");
		assert.equal(zScoreColorClass(-0.72), "bg-green-400");
		assert.equal(zScoreColorClass(-1.8), "bg-green-500");
	});

	it("finds the largest bundle size across the field", () => {
		const field: FrameworkStatsRecord = {
			react: makeStats({ bundleSize: 1.53 }),
			vanilla: makeStats({ bundleSize: 0.31 }),
			hyperscript: makeStats({ bundleSize: 1.01 }),
		};
		assert.equal(maxBundleSize(field), 1.53);
	});

	it("formats values with the right unit per metric", () => {
		const react = makeStats({ codeComplexity: 60, vibeComplexity: 65, bundleSize: 1.53 });
		assert.equal(formatMetricValue("codeComplexity", react), "60");
		assert.equal(formatMetricValue("vibeComplexity", react), "65");
		assert.equal(formatMetricValue("bundleSize", react), "1.53kb");
	});

	it("labels Code Complexity and JS Bundle deterministic, Vibe Complexity AI-judged", () => {
		assert.equal(METRIC_DISPLAY.codeComplexity.name, "Code Complexity");
		assert.equal(METRIC_DISPLAY.codeComplexity.kind, "deterministic");
		assert.equal(METRIC_DISPLAY.vibeComplexity.name, "Vibe Complexity");
		assert.equal(METRIC_DISPLAY.vibeComplexity.kind, "ai");
		assert.equal(METRIC_DISPLAY.bundleSize.name, "JS Bundle");
		assert.equal(METRIC_DISPLAY.bundleSize.kind, "deterministic");
		// Each metric deep-links into the methodology page.
		assert.equal(METRIC_DISPLAY.codeComplexity.anchor, "code-complexity");
		assert.equal(METRIC_DISPLAY.vibeComplexity.anchor, "vibe-complexity");
		assert.equal(METRIC_DISPLAY.bundleSize.anchor, "js-bundle");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '../../src/utils/metricDisplay'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/utils/metricDisplay.ts
import type { FrameworkStats, FrameworkStatsRecord } from "../types/stats";

export type MetricKey = "codeComplexity" | "vibeComplexity" | "bundleSize";

export interface MetricDisplay {
	key: MetricKey;
	name: string;
	kind: "deterministic" | "ai";
	/** z-score field used for the color band. */
	zScoreField: keyof Pick<
		FrameworkStats,
		"codeComplexityZScore" | "vibeComplexityZScore" | "bundleSizeZScore"
	>;
	/** anchor id on /methodology this metric deep-links to. */
	anchor: string;
	/** one-line tooltip lead. */
	tooltip: string;
	/** modal tag, e.g. "Deterministic · no AI". */
	tag: string;
	/** modal body sentence. */
	blurb: string;
}

export const METRIC_DISPLAY: Record<MetricKey, MetricDisplay> = {
	codeComplexity: {
		key: "codeComplexity",
		name: "Code Complexity",
		kind: "deterministic",
		zScoreField: "codeComplexityZScore",
		anchor: "code-complexity",
		tooltip: "Deterministic 0–100, no AI.",
		tag: "Deterministic · no AI",
		blurb:
			"A reproducible 0–100 score from five capped axes — Size, Logic, Reactive, Nesting, Vocabulary — parsed straight from the source shown on this card. Same input, same number.",
	},
	vibeComplexity: {
		key: "vibeComplexity",
		name: "Vibe Complexity",
		kind: "ai",
		zScoreField: "vibeComplexityZScore",
		anchor: "vibe-complexity",
		tooltip:
			"AI-judged 0–100 — state clarity, event handling, boilerplate, idiomatic feel.",
		tag: "AI-judged · may change",
		blurb:
			"Gemini reads the same source and judges how it feels to maintain: state clarity, event handling, boilerplate, and idiomatic style. Model-judged, so it can shift when the model or prompt changes.",
	},
	bundleSize: {
		key: "bundleSize",
		name: "JS Bundle",
		kind: "deterministic",
		zScoreField: "bundleSizeZScore",
		anchor: "js-bundle",
		tooltip: "Compressed JS shipped, captured during page load.",
		tag: "Measured",
		blurb:
			"Total compressed JavaScript shipped for this implementation, captured from network requests during page load. Lower is better.",
	},
};

/** Order metrics render in the card footer. */
export const METRIC_ORDER: MetricKey[] = [
	"codeComplexity",
	"vibeComplexity",
	"bundleSize",
];

function clampPercent(value: number): number {
	return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Bar fill is honest per metric: the 0–100 scores fill to their own value;
 * JS Bundle (KB, no 0–100 scale) fills relative to the largest bundle.
 */
export function barFillPercent(
	key: MetricKey,
	stats: FrameworkStats,
	maxBundle: number,
): number {
	if (key === "bundleSize") {
		if (maxBundle <= 0) return 0;
		return clampPercent((stats.bundleSize / maxBundle) * 100);
	}
	return clampPercent(stats[key]);
}

/** Existing badge color bands; higher z-score = worse. */
export function zScoreColorClass(zScore: number): string {
	if (zScore >= 1.5) return "bg-red-500";
	if (zScore >= 0.5) return "bg-orange-500";
	if (zScore >= -0.5) return "bg-yellow-500";
	if (zScore >= -1.5) return "bg-green-400";
	return "bg-green-500";
}

export function maxBundleSize(frameworks: FrameworkStatsRecord): number {
	return Math.max(...Object.values(frameworks).map((f) => f.bundleSize));
}

export function formatMetricValue(key: MetricKey, stats: FrameworkStats): string {
	if (key === "bundleSize") return `${stats.bundleSize.toFixed(2)}kb`;
	return `${stats[key]}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test`
Expected: PASS — all `metric-display` cases green, existing suites unaffected.

- [ ] **Step 5: Commit**

```bash
git add src/utils/metricDisplay.ts tests/lib/metric-display.test.ts
git commit -m "feat: add metric display util for card footer bars"
```

---

## Task 2: Rebuild PerformanceBadge into a metrics footer

**Files:**
- Modify: `src/components/shared/PerformanceBadge.astro` (full rewrite of body + styles)
- Modify: `src/components/shared/FrameworkContainer.astro:14-22`

- [ ] **Step 1: Pass the dataset max bundle into the footer**

In `src/components/shared/FrameworkContainer.astro`, compute the field-wide max bundle from the already-imported stats and pass it to `PerformanceBadge`. Replace lines 14-22:

```astro
const frameworkStats: FrameworkStats = stats.frameworks[framework];
const maxBundle = maxBundleSize(stats.frameworks as FrameworkStatsRecord);
---

<div 
	class="framework-container backdrop-blur-sm bg-white/90 rounded-xl shadow-lg border border-slate-200" 
	data-framework={framework}
	style="transition: transform 0.2s cubic-bezier(0.2, 0, 0.2, 1), opacity 0.2s ease-out"
>
	<PerformanceBadge stats={frameworkStats} maxBundle={maxBundle} />
```

Add the import to the frontmatter (top of the file, with the other imports):

```astro
import { maxBundleSize } from "../../utils/metricDisplay";
import type { FrameworkStats, FrameworkStatsRecord } from "../../types/stats";
```

(`FrameworkStats` may already be imported — keep a single import line; add `FrameworkStatsRecord` to it.)

- [ ] **Step 2: Rewrite PerformanceBadge as a bars footer**

Replace the **entire** contents of `src/components/shared/PerformanceBadge.astro` with:

```astro
---
import type { FrameworkStats } from "../../types/stats";
import {
	METRIC_ORDER,
	METRIC_DISPLAY,
	barFillPercent,
	formatMetricValue,
	zScoreColorClass,
} from "../../utils/metricDisplay";

interface Props {
	stats: FrameworkStats;
	maxBundle: number;
}

const { stats, maxBundle } = Astro.props;

const rows = METRIC_ORDER.map((key) => {
	const meta = METRIC_DISPLAY[key];
	return {
		key,
		name: meta.name,
		anchor: meta.anchor,
		tooltip: meta.tooltip,
		value: formatMetricValue(key, stats),
		fill: barFillPercent(key, stats, maxBundle),
		colorClass: zScoreColorClass(stats[meta.zScoreField]),
	};
});
---

<div class="metric-footer">
	{
		rows.map((row) => (
			<button
				type="button"
				class="metric-row group"
				data-metric={row.key}
				aria-label={`${row.name}: ${row.value}. Open details.`}
			>
				<span class="metric-name">{row.name}</span>
				<span class="metric-track">
					<span
						class={`metric-fill ${row.colorClass}`}
						style={`width: ${row.fill}%`}
					/>
				</span>
				<span class="metric-value">{row.value}</span>
				<span class="metric-tooltip" role="tooltip">{row.tooltip}</span>
			</button>
		))
	}
</div>

<style>
	.metric-footer {
		display: grid;
		gap: 0.4rem;
		padding: 0.85rem 1rem 1rem;
		border-top: 1px solid rgb(241 245 249);
	}

	.metric-row {
		position: relative;
		display: grid;
		grid-template-columns: 128px 1fr 56px;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		background: none;
		border: none;
		padding: 0.15rem 0;
		cursor: pointer;
		text-align: left;
		font: inherit;
	}

	.metric-row:focus-visible {
		outline: 2px solid #4f46e5;
		outline-offset: 2px;
		border-radius: 6px;
	}

	.metric-name {
		font-size: 0.78rem;
		font-weight: 600;
		color: rgb(71 85 105);
	}

	.metric-track {
		height: 8px;
		border-radius: 5px;
		background: rgb(238 242 247);
		overflow: hidden;
	}

	.metric-fill {
		display: block;
		height: 100%;
		border-radius: 5px;
		transition: width 0.3s ease;
	}

	.metric-value {
		text-align: right;
		font-size: 0.82rem;
		font-weight: 800;
		color: rgb(15 23 42);
	}

	.metric-tooltip {
		visibility: hidden;
		opacity: 0;
		position: absolute;
		bottom: calc(100% + 6px);
		left: 0;
		z-index: 30;
		max-width: 240px;
		background-color: #1f2937;
		color: white;
		padding: 0.5rem 0.6rem;
		border-radius: 0.375rem;
		font-size: 0.72rem;
		line-height: 1.4;
		white-space: normal;
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.2);
		transition: opacity 0.15s ease-in-out;
		pointer-events: none;
	}

	.metric-row:hover .metric-tooltip,
	.metric-row:focus-visible .metric-tooltip {
		visibility: visible;
		opacity: 1;
	}

	@media (max-width: 480px) {
		.metric-row {
			grid-template-columns: 108px 1fr 52px;
		}
	}
</style>
```

- [ ] **Step 3: Verify the build compiles**

Run: `pnpm build`
Expected: build completes with 0 errors (a pre-existing datastar `is:inline` hint is acceptable). The footer renders below each card's code block with three bar rows.

- [ ] **Step 4: Verify tests still pass**

Run: `pnpm test`
Expected: PASS — no regressions.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/PerformanceBadge.astro src/components/shared/FrameworkContainer.astro
git commit -m "feat: replace metric pills with relative-bar footer using full names"
```

---

## Task 3: Per-metric focus modal

**Files:**
- Create: `src/components/shared/MetricModal.astro`
- Modify: `src/pages/index.astro:35-59` (include modal once in the page body)
- Modify: `src/pages/test/[framework].astro` (include modal once)

- [ ] **Step 1: Create the modal component**

```astro
---
// src/components/shared/MetricModal.astro
import { METRIC_DISPLAY, METRIC_ORDER } from "../../utils/metricDisplay";

const entries = METRIC_ORDER.map((key) => METRIC_DISPLAY[key]);
const contentJson = JSON.stringify(
	Object.fromEntries(
		entries.map((m) => [
			m.key,
			{ name: m.name, kind: m.kind, tag: m.tag, blurb: m.blurb, anchor: m.anchor },
		]),
	),
);
---

<div id="metric-modal" class="metric-scrim" hidden>
	<div
		class="metric-dialog"
		role="dialog"
		aria-modal="true"
		aria-labelledby="metric-modal-title"
	>
		<span id="metric-modal-tag" class="metric-modal-tag"></span>
		<h2 id="metric-modal-title" class="metric-modal-title"></h2>
		<p id="metric-modal-blurb" class="metric-modal-blurb"></p>
		<div class="metric-modal-foot">
			<a id="metric-modal-link" href="/methodology" class="metric-modal-link">
				Read the full methodology →
			</a>
			<button type="button" id="metric-modal-close" class="metric-modal-close">
				Close
			</button>
		</div>
	</div>
</div>

<script is:inline define:vars={{ content: contentJson }}>
	const data = JSON.parse(content);
	const scrim = document.getElementById("metric-modal");
	const tagEl = document.getElementById("metric-modal-tag");
	const titleEl = document.getElementById("metric-modal-title");
	const blurbEl = document.getElementById("metric-modal-blurb");
	const linkEl = document.getElementById("metric-modal-link");
	const closeBtn = document.getElementById("metric-modal-close");
	let lastTrigger = null;

	function openModal(metricKey, trigger) {
		const meta = data[metricKey];
		if (!meta) return;
		lastTrigger = trigger;
		tagEl.textContent = meta.tag;
		tagEl.className = `metric-modal-tag ${meta.kind === "ai" ? "is-ai" : "is-det"}`;
		titleEl.textContent = meta.name;
		blurbEl.textContent = meta.blurb;
		linkEl.setAttribute("href", `/methodology#${meta.anchor}`);
		scrim.hidden = false;
		closeBtn.focus();
	}

	function closeModal() {
		scrim.hidden = true;
		if (lastTrigger) lastTrigger.focus();
		lastTrigger = null;
	}

	// Delegated: any .metric-row across any card opens the right modal.
	document.addEventListener("click", (e) => {
		const row = e.target.closest(".metric-row");
		if (row) {
			openModal(row.getAttribute("data-metric"), row);
			return;
		}
		if (e.target === scrim) closeModal();
	});

	closeBtn.addEventListener("click", closeModal);
	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && !scrim.hidden) closeModal();
	});
</script>

<style>
	.metric-scrim {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, 0.45);
		display: grid;
		place-items: center;
		padding: 1.25rem;
		z-index: 100;
	}
	.metric-scrim[hidden] {
		display: none;
	}
	.metric-dialog {
		background: white;
		border-radius: 1rem;
		max-width: 460px;
		width: 100%;
		padding: 1.5rem;
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3);
	}
	.metric-modal-tag {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-weight: 700;
	}
	.metric-modal-tag.is-det { color: #16a34a; }
	.metric-modal-tag.is-ai { color: #d97706; }
	.metric-modal-title {
		margin: 0.25rem 0 0.5rem;
		font-size: 1.35rem;
		font-weight: 800;
		color: #0f172a;
	}
	.metric-modal-blurb {
		color: #475569;
		font-size: 0.92rem;
		line-height: 1.6;
		margin: 0;
	}
	.metric-modal-foot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 1.25rem;
	}
	.metric-modal-link {
		color: #4f46e5;
		font-weight: 600;
		text-decoration: none;
		font-size: 0.9rem;
	}
	.metric-modal-link:hover { text-decoration: underline; }
	.metric-modal-close {
		background: #111827;
		color: white;
		border: none;
		border-radius: 0.5rem;
		padding: 0.5rem 0.9rem;
		font-size: 0.82rem;
		cursor: pointer;
	}
</style>
```

- [ ] **Step 2: Mount the modal once on the index page**

In `src/pages/index.astro`, import the modal in the frontmatter (with the other imports):

```astro
import MetricModal from "../components/shared/MetricModal.astro";
```

Then place it just before the closing `</Layout>` (after the `#framework-grid` div, around line 57):

```astro
		</div>
	</div>
	<MetricModal />
</Layout>
```

- [ ] **Step 3: Mount the modal once on the per-framework test page**

In `src/pages/test/[framework].astro`, import `MetricModal` in the frontmatter and render `<MetricModal />` once inside the page body (after the framework container markup, before the layout/page closes). Mirror the index placement.

```astro
import MetricModal from "../../components/shared/MetricModal.astro";
```

```astro
<MetricModal />
```

- [ ] **Step 4: Verify the build compiles**

Run: `pnpm build`
Expected: 0 errors. Clicking a metric row opens the modal with that metric's tag/title/blurb; the link points to `/methodology#<anchor>`; Escape and backdrop close it.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/MetricModal.astro src/pages/index.astro "src/pages/test/[framework].astro"
git commit -m "feat: add per-metric focus modal opened from card metric rows"
```

---

## Task 4: Methodology page + header link

**Files:**
- Create: `src/pages/methodology.astro`
- Modify: `src/layouts/Layout.astro:17-18` (add header nav)
- Modify: `METHODOLOGY.md` (add stable anchor headings the modal links to)

- [ ] **Step 1: Add explicit anchor headings to METHODOLOGY.md**

The modal deep-links to `#code-complexity`, `#vibe-complexity`, and `#js-bundle`. Astro's markdown renders heading ids by slugifying heading text. The existing headings are `## 3. Code Complexity` (slug `3-code-complexity`) and `## 4. Vibe Complexity` (slug `4-vibe-complexity`), and there is no JS Bundle heading. Rename these headings so the slugs match the anchors. In `METHODOLOGY.md`:

- Change `## 3. Code Complexity` to `## Code Complexity`
- Change `## 4. Vibe Complexity` to `## Vibe Complexity`
- Add a new `## JS Bundle` section near the metric definitions:

```markdown
## JS Bundle

JS Bundle is the total compressed JavaScript shipped for an implementation, captured from network requests during page load. It is reported in kilobytes and has no 0–100 scale, so its card bar is filled relative to the largest bundle in the comparison. Lower is better.
```

Renumber neighboring section headings only if needed for readability; section numbers are cosmetic and not referenced elsewhere.

- [ ] **Step 2: Create the methodology page rendering the root markdown**

```astro
---
// src/pages/methodology.astro
import Layout from "../layouts/Layout.astro";
import { Content } from "../../METHODOLOGY.md";
---

<Layout title="Methodology · checkboxes.xyz">
	<main class="methodology-prose">
		<a href="/" class="back-link">← Back to the gallery</a>
		<Content />
	</main>
</Layout>

<style is:global>
	.methodology-prose {
		max-width: 760px;
		margin: 0 auto;
		padding: 2.5rem 1.25rem 4rem;
		color: #1f2937;
		line-height: 1.65;
	}
	.methodology-prose .back-link {
		display: inline-block;
		margin-bottom: 1.5rem;
		color: #4f46e5;
		font-weight: 600;
		text-decoration: none;
	}
	.methodology-prose h1 { font-size: 2rem; font-weight: 800; margin: 0 0 1rem; }
	.methodology-prose h2 {
		font-size: 1.3rem;
		font-weight: 800;
		margin: 2rem 0 0.5rem;
		scroll-margin-top: 1.5rem;
	}
	.methodology-prose h3 { font-size: 1.05rem; font-weight: 700; margin: 1.25rem 0 0.4rem; }
	.methodology-prose p { margin: 0.5rem 0; color: #475569; }
	.methodology-prose ul { margin: 0.5rem 0; padding-left: 1.4rem; color: #475569; }
	.methodology-prose code {
		background: #f1f5f9;
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
		font-size: 0.85em;
	}
	.methodology-prose pre {
		background: #0f172a;
		color: #e2e8f0;
		padding: 1rem;
		border-radius: 0.5rem;
		overflow-x: auto;
	}
	.methodology-prose pre code { background: none; padding: 0; }
	.methodology-prose table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
	.methodology-prose th,
	.methodology-prose td { border: 1px solid #e2e8f0; padding: 0.4rem 0.6rem; text-align: left; font-size: 0.9rem; }
</style>
```

If Astro refuses to import markdown from outside `src/` in this project, fall back to a content collection or a copy under `src/content/`; record the chosen mechanism in the spec's Open Questions. Verify via Step 4 build output.

- [ ] **Step 3: Add the always-visible Methodology header link**

In `src/layouts/Layout.astro`, replace the `<body>` opening (line 17) so a header sits above the slot:

```astro
	<body>
		<header class="site-header">
			<a href="/" class="site-header__brand">checkboxes.xyz</a>
			<nav class="site-header__nav">
				<a href="/methodology">Methodology</a>
				<a href="https://github.com/jsolly/checkboxes" target="_blank" rel="noopener noreferrer">GitHub</a>
			</nav>
		</header>
		<slot />
```

Add to the bottom `<style>` (create a `<style>` block before `</html>` if none exists):

```astro
<style is:global>
	.site-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.85rem 1.5rem;
		border-bottom: 1px solid #eef2f7;
		background: rgba(255, 255, 255, 0.75);
		backdrop-filter: blur(6px);
		position: sticky;
		top: 0;
		z-index: 50;
	}
	.site-header__brand { font-weight: 700; color: #374151; text-decoration: none; }
	.site-header__nav a {
		color: #4f46e5;
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 600;
		margin-left: 1.1rem;
	}
	.site-header__nav a:hover { text-decoration: underline; }
</style>
```

- [ ] **Step 4: Verify the build compiles and the route exists**

Run: `pnpm build`
Expected: 0 errors and the build output's "generating static routes" list includes `/methodology/index.html`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/methodology.astro src/layouts/Layout.astro METHODOLOGY.md
git commit -m "feat: add on-site methodology page and header link"
```

---

## Task 5: Final consistency sweep + verification

**Files:**
- Verify only; modify if the sweep finds leftovers.

- [ ] **Step 1: Confirm no short metric labels remain in the UI**

Run: `rg -n "Code:|Vibe:|\bCode\b.*/100|\bVibe\b.*/100" src/`
Expected: no matches that render a user-facing short label. (The sort dropdown already uses full names; `metricDisplay.ts` defines full names.) If any `Code:`/`Vibe:` user-facing string remains, replace it with the `METRIC_DISPLAY[...].name`.

- [ ] **Step 2: Confirm the old pill badge markup is gone**

Run: `rg -n "performance-badge|badge-container" src/`
Expected: no matches — the old pill classes were removed with the PerformanceBadge rewrite. Delete any leftover references.

- [ ] **Step 3: Run the full test suite**

Run: `pnpm test`
Expected: PASS — `metric-display` plus all pre-existing suites.

- [ ] **Step 4: Run lint and build**

Run: `pnpm check && pnpm build`
Expected: Biome reports no errors; build completes with `/methodology/index.html` generated and 0 errors.

- [ ] **Step 5: Commit any sweep fixes**

```bash
git add -A
git commit -m "chore: methodology exposure consistency sweep"
```

(If Steps 1–4 found nothing to change, skip this commit — do not create an empty commit.)

---

## Self-Review (completed during planning)

- **Spec coverage:** full names (Task 1 descriptors + Task 5 sweep), footer bars (Task 2), hybrid fill (Task 1 `barFillPercent` + tests), z-score colors (Task 1 `zScoreColorClass`), tooltip/modal/page layers (Tasks 2–4), header link (Task 4), accessibility buttons + Esc/backdrop/focus-return (Tasks 2–3), single-source methodology (Task 4), no pipeline/sort changes (out of scope, sweep confirms). All requirements map to a task.
- **Placeholder scan:** no TBD/TODO; every code step shows full code; commands have expected output.
- **Type consistency:** `MetricKey`, `METRIC_DISPLAY`, `METRIC_ORDER`, `barFillPercent`, `zScoreColorClass`, `maxBundleSize`, `formatMetricValue` names match across Tasks 1–3; `PerformanceBadge` prop `maxBundle` matches the value passed by `FrameworkContainer`.
