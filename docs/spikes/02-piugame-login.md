# Spike 2: piugame.com login from Cloudflare

## Question

Background imports log in as the user and scrape their pages (`ARCHITECTURE.md`, "Imports and
queues"). **Does the login flow work from Cloudflare's network, with no captcha, blocking or
odd redirects? And what do the authenticated pages actually look like today?**

## Background

The login flow, from PIU Scores' `PiuGameApi.cs` (`DATA-SOURCES.md` §1):

1. `GET https://piugame.com/` to collect the anonymous cookies.
2. `POST https://piugame.com/bbs/login_check.php` as form-urlencoded: `url=/`, `mb_id=<id>`, `mb_password=<pw>`,
   with an `Origin: https://piugame.com` header.
3. Success leaves a cookie whose name starts with `sid`. Without it, the login failed. A wrong password
   can still produce an anonymous sid and only shows up when a page returns the login form
   (`.login_wrap`).
4. `GET https://am-pass.net` (SSO bounce).
5. Authenticated pages need the `sid` cookie (+ `Origin`).

Workers' `fetch()` has **no cookie jar**. Use `redirect: "manual"`, read `headers.getSetCookie()`
on every hop, and send cookies yourself.

## Inputs

A **dummy piugame account** created for this project (the owner provides it). Store it as
`PIU_ID` / `PIU_PASSWORD` in `.dev.vars` and as Worker secrets. Never use a real player's account.
It helps if the account has a few Phoenix 2 plays.

## Steps

1. `spikes/02-piugame-login/`: one TypeScript module `login.ts` (cookie jar + the 5 steps) that
   runs **both** in Node (with `NODE_EXTRA_CA_CERTS` pointing at the intermediate PEM) and in a
   Worker (`rg-spike-02`), so the result doesn't depend on spike 1's outcome.
2. Log every hop: method, URL, status, `location`, cookie **names** set (never values), elapsed ms.
3. After login, fetch (≥ 250 ms apart) and check that none of them is the login page:
   - `my_page/my_best_score.php?&&page=1`
   - `my_page/recently_played.php`
   - `my_page/play_data.php`
   - `my_page/pumbility.php`
   - `my_page/title.php`
4. For each page, note which layout it uses (`ul.my_best_scoreList` = classic; otherwise the
   redesigned card list), and whether the selectors in `PiuGameApi.cs` still match. That's the song
   name, step-ball images, score, plate, and the date if present.
5. Save each page's HTML to `spikes/02-piugame-login/fixtures/` **after scrubbing** the account
   id, game tag, nickname and avatar URL. These become parser test fixtures.
6. Try once with a wrong password and record exactly how it fails.
7. Record how long the `sid` stays valid: re-use it after 1 h and after ~24 h if possible. This tells us whether a
   daily scan can skip logging in.
8. Delete the Worker afterwards.

## Done when

- The login works (or doesn't) from Node **and** from a Worker, with the hop log as evidence.
- Scrubbed fixtures exist for all five pages, along with notes on which selectors changed.
- We know how a failed login looks and how long a sid lasts.

## Findings

_To be filled in by the spike._
