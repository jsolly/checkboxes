# Changelog

## 2026-11-17

- Exercise stats generation against temporary source/build trees. Reject invalid saved/generated scores and late API failures without replacing prior data; verify successful medians and boundary scores.

- Reject missing or invalid saved/generated complexity scores instead of writing zero-valued measurements. Remove the retired complexityScore alias and partial rate-limit success path. Bound bootstrap downloads and test timeout refusal.
