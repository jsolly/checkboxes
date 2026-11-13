# Repository security checks

Pre-push and CI run the same OSV check:
`scripts/security-scanners.sh osv`. It resolves the pinned osv-scanner 2.7.1
binary and judges `package-lock.json`. Semgrep, gitleaks, zizmor and cfn-lint
stay on their existing hooks and jobs. CI runs these scanners on pull requests.
The required `ci` job waits for their
`security` aggregate and fails before checkout or dependency installation unless
every scanner succeeded. Failed, cancelled and skipped scans cannot satisfy `ci`.
Pushes to main and manual CI runs keep their existing gate without repeating the
pull request scans. This page records the dependency exceptions that check is
allowed to accept.

## How an exception works

The checker passes osv-scanner an empty config and `--all-vulns`. A repository
ignore file, including `osv-scanner.toml`, is not read, so a branch cannot hide
an advisory by suppressing the scanner. Every finding is printed. The command
exits 0 only when each finding matches one reviewed disposition. Any other
finding, a malformed report, or a scanner failure blocks the push and the
CI scanner job. Pre-push skips the check, with a warning, only when it cannot
reach api.osv.dev at all; the CI scanner job never skips it.

A disposition is one advisory on one exact package version. It records the
lockfile path, the registry URL, the integrity and a fingerprint of every
caller that resolves that copy, including peer dependencies. A version bump, a
new install path, a different tarball, an npm alias or a new caller fails
closed until the exception is reviewed again. The date in the table is the last
accepted day in America/New_York. The next day blocks.

These rows are not fixes. Build and development use reduces what a public
visitor can reach, and it does not show that every input to the tool is safe.
Replace an exception with the upstream patch when one exists.

## Patched dependencies

`@astrojs/svelte` is now 9.1.2, fixing reflected slot-name XSS
([GHSA-f4j9-crrj-867q](https://osv.dev/GHSA-f4j9-crrj-867q)). It was published
on 28 October 2026 and meets the seven-day release age. Its dependency update
resolves `@sveltejs/vite-plugin-svelte` 7.3.1, `svelte2tsx` 0.7.63 and a nested
`magic-string` 1.4.5. The adapter's Astro, Svelte and TypeScript peer requirements
are satisfied by this lockfile.

The plugin upgrade changes the exact caller fingerprint for the existing
deepmerge exception. The deepmerge call in `src/utils/options.js` still merges
local build configuration with the same arguments and array replacement rule;
the only change in that file between plugin 7.1.2 and 7.3.1 is warning wording.
The proposed fingerprint binds the existing exception to plugin 7.3.1's exact
version and integrity. The deepmerge version, tarball, path, advisory and
10 December expiry are unchanged. This is still an accepted risk, not a fix for
deepmerge, and remains part of John's held PR review.

Compatible fixed releases are in the lockfile. npm's `min-release-age=7`
rejected anything published after 2026-11-03 14:25 UTC. Direct dependencies
were updated when their own release carried the fix. Transitive copies use a
narrow override, scoped to the parent when only that parent needed it.

| Package | From | To | How |
| --- | --- | --- | --- |
| sharp | 0.35.4 | 0.35.5 | Direct dependency `^0.35.5`. |
| markdownlint-cli2 | 0.23.2 | 0.24.0 | Direct devDependency `^0.24.0`. |
| js-yaml | 5.2.2 | 5.4.3 | Declared by markdownlint-cli2 0.24.0. The separate 4.3.2 copy is outside this advisory. |
| markdown-it | 14.3.0 | 15.0.3 | Declared by markdownlint-cli2 0.24.0. |
| re2js | 2.8.6 | 2.8.8 | markdownlint 0.42.0 pins 2.8.6. Override `>=2.8.7 <2.9`. 2.10.0 is inside the cooldown. |
| brace-expansion | 5.0.9 | 5.0.12 | Override floor `>=5.0.12`, inside minimatch's requested range. |
| devalue | 5.8.1 | 5.9.4 | Override `>=5.9.4 <6`. Astro, React and Svelte already request 5.9. |
| fast-uri | 4.1.4 | 3.1.9 | Override `^3.1.9`. Ajv requests `^3.0.1`; the old floor had floated to a vulnerable 4.x. |
| glob | 13.0.6 | 14.0.3 | Override `>=14.0.2`. `@vercel/nft` still requests `^13`. 14.0.4 is inside the cooldown. |
| minimatch | 10.2.5 | 11.0.4 | Override `>=11.0.1`. glob 14 requires 11. 11.0.5 is inside the cooldown. |
| katex | 0.16.47 | 0.18.10 | Scoped override on micromark-extension-math, which still requests `^0.16.0`. 0.18.11 is deprecated. |
| smol-toml | 1.7.0 and 1.8.0 | 1.9.1 | Override `^1.9.0`. Astro already resolved 1.9.1. |
| source-map-js | 1.2.1 | 1.2.2 | In-range lockfile refresh. Parents request `^1.2.1` or `^1.0.1`. |
| undici | 8.10.2 | 8.12.3 | Override `^8.12.3`. unifont requests `^8.0.0`. 8.12.4 is inside the cooldown. |
| vite | 8.1.3 | 8.3.5 | Override `^8.3.5`. Astro requests `^8.3.1`. 8.3.6 and later are inside the cooldown. |
| zod | 3.25.76 and 4.1.11 | 4.6.7 | `@vercel/config` is overridden to 4.6.7. The exact `zod@4.1.11` request is overridden to 4.6.7. The hoisted copy was already 4.6.7. |

`@vercel/config` 0.14.1 is the only Zod 3 consumer. Its runtime Zod use is the
cron schema in `dist/utils/validation.js`: `z.object`, `z.string().regex` and
`parse`. On 4.6.7 that schema accepts a valid cron field and rejects an invalid
one, the package resolves `zod@4.6.7`, and `node node_modules/@vercel/config/dist/cli.js validate`
completes for this repo's `vercel.ts`. `@typescript-eslint/typescript-estree`
calls `minimatch(file, pattern, { dot: true })`, which still returns a boolean
on 11.0.4. `@vercel/nft` calls `glob()` with `mark`, `ignore`, `dot` and
`nodir`, including an extglob, and glob 14.0.3 returns the matches.

## Reviewed dispositions

| Package | Advisory | Disposition |
| --- | --- | --- |
| deepmerge 4.3.1 | GHSA-gcqx-w48m-w2h4 | Accept prototype-poisoning of the returned object through 10 December 2026. No patched release exists. `@sveltejs/vite-plugin-svelte` 7.3.1 merges its own build defaults with the project Svelte and Vite configuration. Plugin 7.3.1 still depends on `^4.3.1`. |

The advisory is
[GHSA-gcqx-w48m-w2h4](https://osv.dev/GHSA-gcqx-w48m-w2h4)
([deepmerge report](https://github.com/TehShrike/deepmerge/issues/273)).
`mergeObject` decides whether a key is safe by looking at the target, not the
key name. A controlled call with the locked 4.3.1 package reproduced the
reported result: merging a JSON `__proto__` object into a null-prototype target,
or into a target whose placeholder value is `null`, returns an object whose
prototype carries the attacker's property. `Object.prototype` is not modified.
The property is inherited, so it is absent from `Object.keys`. The Svelte plugin
starts from a normal object and merges local build configuration. It does not
merge a visitor request body. That limits exposure and is not a patch.

John owns removal of this acceptance. On 11 December 2026 in America/New_York
the same identity blocks until the row is renewed or a fixed release replaces it.
