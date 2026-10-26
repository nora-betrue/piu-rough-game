# Spike 3: Bookmarklet on piugame.com

## Question

The power-user import is a bookmarklet that runs on a logged-in piugame.com tab (`DATA-SOURCES.md`
§3). **Can it (a) load our script from another origin, (b) read the user's pages, and
(c) get the data back to us?** And what works on mobile?

## Background

- The planned loader: `javascript:import('https://roughgame.ing/bm.js?v=1')`. The domain doesn't serve
  anything yet, so test with any HTTPS-hosted ES module (e.g. a tiny file on a jsDelivr/GitHub
  Pages URL, or the `rg-spike-01` Worker if it's up).
- A Content-Security-Policy (an HTTP header **or** a `<meta http-equiv>`) could block external scripts
  (`script-src`), outgoing requests (`connect-src`), or `window.open` targets.
- Playwright + Chromium are preinstalled (`require('playwright')`; don't run `playwright install`).

## Inputs

The dummy piugame account from spike 2 (`.dev.vars`: `PIU_ID`, `PIU_PASSWORD`).

## Steps

1. **Headers:** log in via Playwright (fill the login form) and record the CSP header and any
   meta CSP on these pages: the home page, `my_page/my_best_score.php`, `my_page/recently_played.php`.
   No CSP at all mostly answers the question.
2. **Simulate the bookmarklet faithfully.** Run code in the page through a script injected the way a
   `javascript:` URL would be. Playwright's `page.evaluate` may sidestep CSP, so also cross-check
   step 6. Test:
   - (a) `await import('<external module URL>')`;
   - (b) `fetch('/my_page/my_best_score.php?&&page=2', {credentials: 'include'})` + `DOMParser`,
     extracting a few song names;
   - (c) a cross-origin `fetch` POST of JSON to an external test endpoint (a spike Worker that echoes
     with CORS, or similar), with and without a preflight-triggering `Content-Type`;
   - (d) `window.open('https://<external>/receive')` + `postMessage`.
3. Record what succeeded, what failed, and the exact console/CSP errors.
4. Measure how long it takes to fetch and parse all best-score pages in-page (≥ 250 ms apart), to estimate
   bookmarklet run time.
5. Write the **recommended delivery**:
   - loader bookmarklet, or fully inline bookmarklet, or userscript;
   - which return channel to use (POST, or `postMessage`).
6. **Manual check (the owner, ~5 min):**
   - Desktop Chrome: add a bookmark whose URL is the test loader, click it on a logged-in
     piugame.com page, and check it worked.
   - Phone (iOS Safari and/or Android Chrome): the "edit bookmark, paste the URL, run it from
     the address bar" flow. Note what was awkward.

## Done when

- We know which of (a)–(d) work under the site's real CSP.
- We have a recommended delivery mechanism (desktop and mobile), plus a rough run time for a full scrape.

## Findings

_To be filled in by the spike._
