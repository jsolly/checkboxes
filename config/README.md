# Configuration

Relocatable tracked settings have one repository-owned home under `config/<domain>/`:

- `app/astro.mjs` owns Astro integrations, build and Vite settings. The native
  `astro.config.mjs` delegates to it; Astro keeps its repository project root,
  public assets and environment-selected product/measurement source/output roots.
  Package resolution from the moved module still reaches root `node_modules`.
- `app/svelte.js` owns preprocessing; native `svelte.config.js` delegates to it.
- `typescript/project.json` owns compiler scope and aliases, extending the local
  `strict-astro.json` and Astro's package preset. Relative include/exclude paths are rebased; aliases use TypeScript’s
  `${configDir}` to preserve the native root across TypeScript and Astro’s resolver.
  Native `tsconfig.json` extends it.
- `quality/biome.settings.jsonc` owns Biome rules, globs and overrides. Native
  `biome.jsonc` only extends it, so inherited globs retain the root adapter's context.
  The settings filename avoids creating an unintended nested Biome project.
- `quality/knip.json` and `quality/lint-staged.json` own their tools' settings.
  Native `knip.config.js` and `lint-staged.config.js` delegate to these owners.
  Knip explicitly analyzes both the native Astro entry and its relocated settings
  module, preserving integration dependency and entry-point discovery.
- `quality/yamllint.yaml` and `quality/.markdownlint-cli2.jsonc` are selected
  explicitly by the repository's YAML command and root-anchored Markdown helper.

Required native exceptions stay at discovery paths: package manifests/lockfiles,
`.npmrc`, `.nvmrc`, `.mise.toml`, Git files, `.github/`, native agent registrations,
`.repo-independent.json`, the delegation files above, `vercel.json` and
`components.json` (shadcn-svelte's generation manifest, aliases and CSS path).
Executable helpers, application source configuration, framework comparison demos,
fixtures, generated statistics and ignored local secrets/state keep their owners.

Create only used domains. Preserve roots, scopes, plugin imports, generated assets,
measurement isolation and deployment behavior when moving settings. Verify resolved
configuration and selected inputs against the baseline, then run `npm run gate`.
Vercel remains production-main-only; verify the intended production READY deployment
and exact-release public checkbox smoke after merge. No external configuration
checkout, home links, generation prerequisite or automatic synchronization is required.
