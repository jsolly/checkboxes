# Configuration

Relocatable tracked settings have one repository-owned home under `config/<domain>/`:

- `app/astro.mjs` owns integrations, build and Vite settings. All Astro package
  commands and both build subprocesses select it explicitly. The repository stays
  the project root; product and measurement source/output roots, public assets,
  package resolution and deployment behavior are preserved.
- `app/svelte.js` owns preprocessing. Astro's Svelte integration selects this
  module through a file URL resolved beside its own configuration.
- `typescript/project.json` owns compiler scope and aliases, extending the local
  `strict-astro.json` and Astro's package preset. Rebased include/exclude paths and
  `${configDir}` aliases preserve the repository source root.
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

Root `tsconfig.json` remains a minimal adapter for Astro 7's root TypeScript loader
and its Vite alias resolver. Astro's `--config` selects the app settings but does
not redirect that loader. Removing this adapter makes the actual app build fail
on `$lib` imports. Selecting the nested project alone also changes `${configDir}`
alias roots. `npm run check:ts` and `npm run build` exercise these active consumers.

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
