# Website updates

The public gallery and methodology page check `/release.json` on load, focus,
return to visibility, reconnect, and every five minutes plus jitter while
visible and online. Failures back off to 30 minutes. Hidden/offline tabs stop
their timer; focus events are throttled. A notice offers **Update and reload**
and **Later**. Checks never reload tabs. The benchmark routes intentionally
exclude this shared gallery control.

`scripts/build.mjs` uses the immutable Vercel deployment ID for production, and
one UUID for each local fixture build. It embeds that identity in page metadata
and the notice's initial props. It writes the same identity to
`dist/release.json` and Vercel's static output after both entry graphs succeed.
Vercel serves the endpoint with browser and CDN `no-store` headers. The client
requests it without caching and rejects unsuccessful, redirected, or malformed
responses. Development without a build identity does not check for updates.

The initial identity always comes from the loaded page, never the first network
check. Any different deployed identity, including a rollback, offers an update.
Clicking Update rechecks the identity and current page metadata before reloading
only the requesting tab. A failed or inconsistent check keeps the page and
offers a retry. There is no automatic retry/reload loop or cross-tab activation
message. Later dismisses that deployment in that tab until navigation. A
persistent Show available update button reopens it; a different release can
offer another notice. Other tabs keep their own choices.

Reloading resets in-memory demo checkbox selections. The notice states this
before its action and asks for confirmation if any demo selection is checked or
mixed. Cancel keeps state and focus. A tab-local session marker detects stale
HTML after a requested reload and offers a manual retry without looping.
Framework ordering already persists through the gallery's existing storage
behavior. The site has no sign-in, server mutations, editable drafts, or service
worker. This change adds no offline cache or offline-readiness promise.
Offline/background tabs may discover updates only after reconnect/focus. A
network failure after the final successful check can still prevent navigation;
browser navigation behavior applies. Vercel deploys a complete immutable static
build; existing tabs retain their loaded modules and no new release modules are
injected into an old page. The Astro adapter explicitly enables Vercel Skew
Protection, attaching the original deployment ID to framework asset requests.
The release endpoint remains unpinned so it sees the current production
deployment. Vercel supports asset retention within the configured
skew-protection maximum age, one day by default. This site supports open clients
within that window; older sessions need ordinary navigation. Live deployment
evidence must confirm the project honors pinned old asset URLs. No
project/account settings are changed by this implementation. See [Vercel Skew
Protection](https://vercel.com/docs/skew-protection).

Tabs opened before this feature ships cannot show a notice retroactively. After
their next ordinary navigation, they can detect future deployments.

`tests/e2e/website-updates.test.ts` builds independent releases and serves them
through one local origin. It verifies the first poll returning B for an A
document, independent tab choice, active checkbox state, cancellation,
dismissal/reopening with keyboard focus, explicit keyboard reload,
offline/HTTP/malformed/schema failures, mismatched deployments, stale
post-reload HTML and manual recovery, distinct releases, rollback discovery,
fresh-page behavior, and benchmark isolation. The local host retains A immutable
assets across publication of B; live host retention is a separate production
acceptance check. Expected injected network console errors are limited to
offline and HTTP 503; any other console/page/network error fails. Set
`UPDATE_EVIDENCE_DIR` to an existing absolute directory to capture
desktop/mobile light/dark screenshots. The test runs in the normal `npm test`
gate with the pinned Chromium installation.

## Styles and live retention acceptance

Product builds use Astro's `inlineStylesheets: "always"`. Gallery styles travel
with the document rather than relying on static stylesheet links that omit
Vercel deployment pins. Benchmark builds retain their existing stylesheet
strategy, output directory and isolated entry graph. The browser test verifies
product pages have no external stylesheet links, including a stale document
loaded after the next deployment, and still render the notice border.

The first live retention check after PR 320 failed for the previous production
release. A real same-origin module request with its original deployment pin
returned 404; several same-name chunks returned different deployment-specific
bytes. That older deployment still reports READY. The provider API does not
expose this project's actual protection maximum age or threshold, so no cause
or retention guarantee is established by that check. Vercel settings and real
old-module loading must be verified before marking canonical adoption complete.
The local retained-asset fixture does not substitute for that live proof.
