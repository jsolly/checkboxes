# Accessibility checks

Run `npm run build`, then `npm run check:a11y`. Install the pinned browser once
with `npx playwright install chromium`.

The axe-core audit scans every built HTML page at desktop and mobile widths.
It waits for Astro islands to hydrate and runs every default axe rule, including
best practices. Violations fail the command. The ignored
`accessibility-results.json` contains node selectors, explanations, and findings
that need manual review. To inspect selected routes, run
`npm run check:a11y -- / /path/`.

This is a local audit tool. It blocks external HTTP requests to avoid live API
calls and analytics. Embedded third-party content, authenticated states, open
menus/dialogs, dark mode, keyboard behavior, and canvas rendering need separate
review. Passing axe does not certify accessibility. Rebuild after source changes.

CI runs this audit after the complete repository gate and preserves the JSON report.
