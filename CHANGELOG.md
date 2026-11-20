# Changelog

## 2026-11-20

- The commit gate skips its Chromium steps with a warning only where `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` is set outside CI and Chromium cannot launch, as in Claude Duet cloud sessions. Anywhere else, CI included, a Chromium that cannot launch fails the gate with its launch error. Hook trust tests cover the run, skip and fail cases. The website update browser test moves to `tests/e2e/website-updates.e2e.ts`, run by `npm run test:browser`, so `npm test` launches no browser.

## 2026-11-17

- Exercise stats generation against temporary source/build trees. Reject invalid saved/generated scores and late API failures without replacing prior data; verify successful medians and boundary scores.

- Reject missing or invalid saved/generated complexity scores instead of writing zero-valued measurements. Remove the retired complexityScore alias and partial rate-limit success path. Bound bootstrap downloads and test timeout refusal.
