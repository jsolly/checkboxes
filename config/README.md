# Configuration

Relocatable tracked settings have one repository-owned home under `config/<domain>/`:

- `app/astro.mjs` owns integrations, build and Vite settings. All Astro package
  commands and both build subprocesses select it explicitly. The repository stays
  the project root; product and measurement source/output roots, public assets,
  package resolution and deployment behavior are preserved.
  Its `addWatchFile` registration reloads Astro's configuration when this
  physical file changes. Verify an actual setting change and its restoration;
  starting the server alone does not exercise configuration reloads.
- `app/svelte.js` owns preprocessing. Astro's Svelte integration selects this
  module through a file URL resolved beside its own configuration.
- `typescript/project.json` owns compiler policy and source scope, extending the
  local `strict-astro.json` and Astro's package preset. Rebased include/exclude
  paths preserve the repository source root. The native root TypeScript file
  owns the `$lib` alias map for the consumers described below.
- `quality/biome.settings.jsonc` owns Biome rules, globs and overrides. Package
  commands, the committing-tree gate and lint-staged select it explicitly. Its
  VCS ignore discovery and file patterns keep their repository scope.
- `quality/knip.json` and `quality/lint-staged.json` are selected explicitly.
  Knip's Astro, Svelte, Biome and lint-staged metadata names their actual owners,
  preserving plugin, dependency and entry-point discovery.
- `quality/yamllint.yaml` and `quality/.markdownlint-cli2.jsonc` are selected by
  the repository's YAML command and root-anchored Markdown helper.
- `agents/repository.json` owns hook identity and its fixed trusted-bundle roster.
  Current checkouts refuse a retired root `.repo-independent.json`, including a
  dangling link. [Hook trust](../docs/development.md#hook-trust) describes the
  explicit reviewed upgrade from an authenticated historical installed snapshot.

## Required native files

Root `tsconfig.json` inherits compiler policy and source scope from
`typescript/project.json` and solely owns the `$lib` alias map. Astro 7.3.2 loads
this native file and resolves inherited aliases from its directory. The pinned
shadcn-svelte 1.3.0 component generator instead resolves ordinary inherited paths
from their declaring file and rejects `${configDir}` substitutions without
`baseUrl`. TypeScript 6 rejects that deprecated option. Keeping relative aliases
in the native root file gives these active consumers the same source paths
without duplicate settings or a custom loader.

Astro's `--config` selects the app settings but does not redirect its TypeScript
loader. Removing root `tsconfig.json` makes the app build fail on `$lib` imports.
Verify native TypeScript checking, `npm run check:ts`, both phases of
`npm run build`, and the pinned component generator when changing these aliases.

Package manifests/lockfiles, `.npmrc`, `.nvmrc`, `.mise.toml`, Git files, `.github/`,
native agent registrations and `vercel.json` keep their required locations.
Root `.worktreeinclude` is the native ignored-file selection manifest for
[Claude Code worktrees](https://code.claude.com/docs/en/worktrees#copy-gitignored-files-into-worktrees);
the repository's `worktree:init` provisioning also reads it.
`components.json` remains shadcn-svelte's native generation manifest with its
aliases and CSS path. No optional Astro, Svelte, Biome, Knip or lint-staged root
adapter remains. The inert `.fleet-precommit-smoke` marker is removed.

Executable helpers, application source configuration, framework comparison demos,
fixtures, generated statistics and ignored local secrets/state keep their owners.
Create only used domains. Preserve roots, scopes, plugin imports, generated assets,
measurement isolation and deployment behavior when moving settings. Verify resolved
configuration and selected inputs against the baseline, then run `npm run gate`.
Vercel remains production-main-only; verify the intended production READY deployment
and exact-release public checkbox smoke after merge. No external configuration
checkout, home links, generation prerequisite or automatic synchronization is required.
