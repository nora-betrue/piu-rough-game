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

_Checked 2026-11-06 (UTC 19:42–19:47). Code: `spikes/02-piugame-login/` (`login.ts` shared, `node.ts`,
`worker.ts`). Raw results (redacted hop logs, page summaries): `spikes/02-piugame-login/results/`._

### Answer

**Yes: the login works from Cloudflare.** The same `login.ts` logged in from Node 22 (with the
Sectigo DV R36 PEM via `NODE_EXTRA_CA_CERTS`, fingerprint checked against `DATA-SOURCES.md`) and
from a **deployed** Worker (`rg-spike-02`, colo FRA). No captcha, no blocking, no `526`, no extra
redirects compared with Node: the two hop logs are identical hop for hop.

**Page content (dummy account): not checkable.** _(Answered later with a game card, see "With a game card" below.)_ The dummy account has **no Game ID registered**, so
all five `my_page/*` URLs return the same gnuboard error page (`alert("No registered Game ID
found."); document.location.replace("/")`) inside the normal logged-in layout. So step 4 (layout and
selectors) is **not answered yet**: neither `ul.my_best_scoreList` nor the redesigned card list is
present, because there are no scores at all. The owner needs to link a Game ID (a card that has
played Phoenix 2) to the dummy account, then rerun `pnpm login` (see "Rerun" below).

### What ran

| Run | When (UTC) | Requests | Result |
|---|---|---|---|
| Earlier session, old credentials | 10-26 20:28 | 16 | POST rejected: `alert: This is not a registered email, please sign up and log in.` (`results/node-login-2026-10-26-rejected.json`) |
| Anonymous `GET /` to read the login form (no login) | 11-06 19:42 | 5 | Form `#login_fs` posts `url`, `mb_id` (type=email), `mb_password` to `/bbs/login_check.php`: matches `PiuGameApi.cs` |
| Node login + 5 pages | 11-06 19:42 | 17 | **Logged in** (`results/node-login.json`) |
| Node sid-only reuse, ~1 min | 11-06 19:44 | 1 | Valid (`results/node-reuse-0h.json`) |
| Worker login + 5 pages + sid-only reuse | 11-06 19:45 | 18 | **Logged in**, reuse valid (`results/worker-login.json`) |
| Node wrong password (once) | 11-06 19:45 | 12 | Rejected (`results/node-wrong-password.json`) |
| Node sid-only reuse, 4 min, after the wrong-password attempt | 11-06 19:46 | 1 | Still valid (`results/node-reuse-after-wrong-pw.json`) |

All requests sequential, ≥ 250 ms apart. One successful login per runtime, one wrong-password attempt.

### Hop log (successful login; Node and Worker identical)

Cookie names only, with their lifetime attributes. `sid=` / `referer=` values redacted.

```
#1  GET  piugame.com/                     302 → api.am-pass.net/sso?referer=…
#2  GET  api.am-pass.net/sso?referer=…    302 → piugame.com/ssoc?sid=…&referer=…   set: PHPSESSID, sid (1 y), XSRF-TOKEN, laravel_session
#3  GET  piugame.com/ssoc?sid=…           301 → piugame.com/ssoc/?sid=…
#4  GET  piugame.com/ssoc/?sid=…          302 → piugame.com/                        set: PHPSESSID, sid (1 y)
#5  GET  piugame.com/                     200                                       set: sid, PHPSESSID (7 d), 2a0d…f643 (1 d)
#6  POST piugame.com/bbs/login_check.php  302 → piugame.com/                        set: sid, PHPSESSID, 6e12…f2e3 (deleted), a3e9…595b (deleted)
#7  GET  piugame.com/                     200                                       set: sid, PHPSESSID
#8–12 GET am-pass.net/ → api.am-pass.net/sso → am-pass.net/ssoc → ssoc/ → am-pass.net/  (same SSO dance for the am-pass.net domain)
#13–17 GET the five my_page URLs          200 each                                  set: sid, PHPSESSID (refreshed every request)
```

Notes:

- **Step 1 already does the SSO bounce.** The first `GET /` is a 4-hop round trip through
  `api.am-pass.net/sso` that hands piugame an *anonymous* `sid` (`Domain=.piugame.com`, `Max-Age` 1 year).
- **The `sid` value does not change on login** (`sidChangedOnPost: false`). The server upgrades the
  existing session in place. So "a cookie named `sid…` exists" says nothing about success: it exists
  before the POST, after a rejected POST and after a successful one.
- Wall time for a full login is ~10 s (the `api.am-pass.net/sso` hop alone takes 0.4–7 s).
  ~12 requests per login, then one per page.
- Step 4 (`GET am-pass.net`) was not needed for the my_page requests as far as we can tell (the
  sid-only client never touched am-pass.net), but we didn't test a login *without* it.
  Follow-up: drop it and check, saving 5 requests per login.

### How success and failure look

| | Successful login | Wrong password | Unregistered email (old creds) |
|---|---|---|---|
| POST status | **302** `Location: https://piugame.com/` | **200** | **200** |
| POST body | (redirect) | `alert("Your password is incorrect.\nYou can get a temporary password through the ID/PW finder.")` | `alert("This is not a registered email,\nplease sign up and log in.")` |
| `sid` cookie | present (same value as before) | present (anonymous) | present (anonymous) |
| A my_page URL afterwards | logged-in layout, `g5_is_member = "1"` | login form, `g5_is_member = ""`, `alert("Please try again after logging in.")` | login form |

**Reliable checks:** POST returned a 302 (not 200 + `alert(`), and pages carry `var g5_is_member = "1"`
and no `form[name=flogin]`.

**`.login_wrap` is NOT a usable login-page marker today.** It's part of the site header and
appears on every page, logged in or not (1× logged in, 2× anonymous). The earlier session's
"every page is the login form" conclusion was partly this false positive (its POST really was
rejected, though). `login.ts` now reports `isMember`, `loginForm` and any `alert()` text instead.

**New failure mode: "No registered Game ID found."** A valid login whose account has no Game ID gets
this alert page on every `my_page/*` URL (status 200, logged-in layout, `g5_is_member = "1"`).
The importer must treat it as its own state ("link a Game ID on piugame.com"), not as a bad password
and not as "zero scores".

### Page-by-page

| Page | Login page? | Content | Best-score layout | `PiuGameApi.cs` selectors |
|---|---|---|---|---|
| `my_best_score.php?&&page=1` | No (logged in) | "No registered Game ID found." | neither (no list) | untestable |
| `recently_played.php` | No | same error | – | untestable |
| `play_data.php` | No | same error | – | untestable |
| `pumbility.php` | No | same error | – | untestable |
| `title.php` | No | same error | – | untestable |

The five responses are byte-identical except `<body class="… dp2_<page>">`. No selector broke
that we could see, but none could be checked (`ul.my_best_scoreList`, `div.tw img`, `div.numw img`,
`div.imG img`, plate image, `td[data-th=PERFECT]`, `ul.data_titleList2 li`, `i.last`,
`pumbility-point-sub` are all absent because there is no data). Only the **login-detection** rule
(`.login_wrap`) is known to be broken.

**Fixtures** (`spikes/02-piugame-login/fixtures/`): `0-home.anonymous.html` (anonymous home with the
login form) and `1…5-*.no-game-id.html` (the five pages in the "no Game ID" state). Scrubbed: the
nickname (2 places per page) is replaced with `SCRUBBED_NICK`. These pages contain no email, account
id, game tag or avatar URL (checked), and no cookie or session value. They're useful for tests of
login/error detection, not for score parsing. Score fixtures still need an account with plays.

### sid lifetime

- Measured: a fresh client holding **only** the piugame `sid` cookie (like PIU Scores'
  `ClientForSid`) is logged in at 1 min (Node and Worker) and 4 min. A wrong-password attempt in a
  *separate* session did not invalidate it.
- Cookie attributes: `sid` `Max-Age=31536000` (1 year), `PHPSESSID` `Max-Age=604800` (7 days),
  both re-issued on every request. The server-side session lifetime is unknown (gnuboard often
  expires idle sessions after a few hours), so **the 1 h and 24 h checks are still open**.
- **To run them** (from `spikes/02-piugame-login/`, same machine; `.sid-state.json` holds the sid
  from the 19:42 UTC login, mode 600, git-ignored). Each check is one request:

  ```sh
  pnpm sid:check 1h     # any time after 20:42 UTC on 2026-11-06
  pnpm sid:check 24h    # after 19:42 UTC on 2026-11-07
  ```

  It prints `sid age N min -> VALID | NOT VALID` and writes `results/node-reuse-<label>.json`.

- **1 h result (2026-11-06 20:57 UTC): VALID at 75 minutes** (`results/node-reuse-1h.json`).
  `g5_is_member = "1"`, no login form, and the dummy account's "No registered Game ID found." page.
  The response re-issued `sid` (1 year), `PHPSESSID` (7 days), and a **third, hex-named cookie with
  `Max-Age=86400` (1 day)** that wasn't noted before. If the server ties the session to that 1-day
  cookie, a sid touched only once a day sits right at the edge, so the 24 h check matters. It runs
  ~23 h after this touch, since this check refreshed the session.
  VALID means `g5_is_member = "1"` and no login form. Note that each check also *refreshes* the
  session, so the 24 h result means "24 h since login with one touch at 1 h". For a clean idle test,
  skip the 1 h check.

### Rerun once the account has a Game ID

```sh
cd spikes/02-piugame-login
RAW_DIR=/some/folder/outside/the/repo pnpm login   # ~17 requests; raw HTML goes to RAW_DIR, unscrubbed
```

Then scrub nickname, game tag and avatar URL before copying anything into `fixtures/`. For the Worker:
`pnpm worker:deploy`, `wrangler secret put PIU_ID / PIU_PASSWORD / RUN_TOKEN` (piped from files),
`curl -H "x-run-token: …" https://rg-spike-02.<subdomain>.workers.dev/run`, then `pnpm worker:delete`.
Don't rerun `wrong-password`: a marker file (`results/.wrong-password-attempted`) blocks it.

### With a game card (owner's account, 2026-11-06)

The dummy account has no Game ID, so the owner provided **their own** AM.PASS login (it has a game
card with Phoenix 2 plays). The owner chose to do this, overriding the "dummy account only" rule in
`spikes/README.md` for this one capture. Extra rules applied: one login attempt, Node only, no
wrong-password test, read-only GETs, ≤ 20 requests, raw HTML kept outside the repo and deleted
afterwards, and the dummy `.sid-state.json` left untouched (the `capture` mode never writes it).

**What ran** (`node.ts capture`, then `node.ts capture-rest`): **19 requests** in total, ≥ 250 ms apart.

- `capture` (19:55 UTC, 13 requests): login with the same hops as above (POST **302**), then best-score page 1.
  It stopped there: page 1 has an inline `alert('It is the same as the existing Game ID.')` (from the
  game-ID-change modal that's on every logged-in page), and my first error-page check took that for a
  gnuboard error. Fixed: only `alert(…)` directly followed by `document.location.replace`/`history.back`
  counts now. `rejected` is now "POST status ≠ 302".
- `capture-rest` (19:56 UTC, 6 requests, **no second login**): reused that run's sid (held in the
  scratch folder only) for best page 2, `?lv=20` page 1, `recently_played`, `play_data`, `pumbility`
  and `title`. All returned logged-in data pages.
- Not fetched: `game_id_information.php`, other pages, logout (it changes state).

**Fixtures:** `spikes/02-piugame-login/fixtures/with-game-id/` holds 7 pages. They were scrubbed by
`scrub.ts`, which reads the identifying values out of the pages themselves and refuses to write a
file that still has one. It replaced the nickname, all game IDs (`NAME #tag` on the main and
sub-profiles), the `origin_game_id`/`user_no`/`sub_profile` hidden-input values, the avatar URLs
(→ `…/avatar_img2/scrubbed.png?v=0`, same shape, so `ImageRegex` still matches), and the
"Last Access Date / Recently Access Games" values. Kept: songs, chart images, scores, grades,
plates, judgements, dates, titles.

**Best-score list.** Total. **683** charts, **57** pages (12 cards per page). `?lv=20`: Total. 79,
7 pages. The best-list `lv` select offers `10…26, 27over, 10over, coop`. `play_data.php`'s select
also offers `1…9`.

**Layout: the redesign** on all three best-score pages: `ul.recently_playeList > li` cards, no
`ul.my_best_scoreList`. Run `node check-parsers.ts` to reproduce. It ports `PiuGameApi.cs`'s
selectors and regexes to cheerio.

| Page | Selector / regex (`PiuGameApi.cs`) | Result |
|---|---|---|
| best | `ul.my_best_scoreList` (classic) | absent: redesign served, so the sniff picks `ParseRedesignedBestScores` ✔ |
| best | `ul.recently_playeList/li`, `div.song_name/p` | ✔ 12/12 per page |
| best | `.stepBall_img_wrap .tw img` ~ `TypeRegex` | ✔ 12/12 (`s_text`, `d_text`; full `https://piugame.com/l_img/p2/stepball/full/…` URLs) |
| best | `.stepBall_img_wrap .numw img` ~ `LevelRegex` | ✔ (doubles use `s_num_N.png` too, and the regex accepts any letter) |
| best | `div.li_in.ac/i.tx` → score | ✔ 12/12 |
| best | `div.li_in/img` ~ `PlateRegex` | ✔ (10/12, 11/12, 8/12 have a plate; the rest are broken) |
| best | `p.recently_date_tt` ~ `RecordedAtRegex` | ✔ 12/12, e.g. `2026-11-05 10:49:14 (GMT+9)` |
| best | `.total_wrap` → Total, `i.last` parent `onclick` → max page | ✔ 683 / 57 |
| best | stage-break detection | ⚠ **gap**: the best list has two kinds of no-plate card. One has an `x_` grade image (`x_a.png`: broken, a real score). The other has an **empty grade `<img src="">`**, which `DATA-SOURCES.md` calls a stage break. `ParseRedesignedBestScores` treats both as `IsBroken` and doesn't skip the empty-grade ones. Needs confirming (one such card shows a 924,992 score). |
| recent | `ul.recently_playeList/li` | ✔ 50 cards |
| recent | `STAGE BREAK` in `div.li_in/i.tx` | ✔ 5 skipped (they're also the 5 empty-grade cards) |
| recent | `td[data-th=PERFECT…MISS]/div` | ✔ 45/45 |
| recent | broken = no `/plate/` img | ✔ 9 broken, 36 passed; broken grades are `x_*.png` |
| recent | `p.recently_date_tt` | ✔ 45/45 |
| recent | plate | ⚠ **changed**: recent cards now **do** carry a plate image (`div.li_in.st1 > img …/plate/mg.png`) on 36/45. `PiuGameApi.cs` assumes there's none and derives the plate from judgements. That still works, but the image is ground truth. |
| pumbility | `li[div.top-wrap]` cards, `PumbilityValueRegex`, `ShortTypeRegex`, `.mid-wrap` song, grade/plate (`s_` prefix) | ✔ 50/50; the values sum to 17,190.81 |
| pumbility | `div.pumbility_total_wrap` + `DecimalRegex` → total | ✗ **broken**: the wrap now starts with a tier label `DIAMOND Lv.1`, so the first number is **1**. The value is in `div.pumbility_total_wrap div.score` (`17,190<span class="pumbility-point-sub">.81</span>`). |
| play_data | `a.play_log_btn[.//i.t_num]`, `data-type`, `data-division` | ✔ 24 tiles (16 grade, 8 plate), text `154 / 4,704` |
| play_data | `div.clear_w div.t1` | absent (expected on Phoenix 2; the code handles it) |
| play_data | `select[onchange*=lv=] option` | ✔ `,1…26,27over,10over,coop` |
| title | `ul.data_titleList2/li`, `li.have`, `p.col*`, `data-name` | ✔ 298 titles, 77 owned |
| title | `div.name_w/p.t2` (account name), `div.profile_img/div/div` style ~ `ImageRegex` (avatar) | ✔ |
| any | `div.login_wrap` as "requires login" | ✗ present on logged-in pages (see above) |

Sample parsed rows (from `check-parsers.ts`): best `GOODTEK D12 982,264 ss mg 2026-11-05 10:49:14 GMT+9`;
recent `Desaparecer S20 970,159 fg P1210/Gr36/Go8/B4/M12`; pumbility `Cannon X.1 S20 sss mg 351.56`.

### Recommendation

- **Keep the scraper in the `jobs` Worker.** No Container is needed for login (with spike 1, the TLS
  question is closed too). Use `redirect: "manual"` plus our own cookie jar (domain-aware: cookies are
  set on `.piugame.com`, `.am-pass.net` and host-only `api.am-pass.net`).
- **Detect login success by the POST's 302** and confirm with `g5_is_member = "1"` on the first page.
  Never by the presence of `sid`, never by `.login_wrap`.
- **Classify failures** from the `alert()` text: wrong password / unregistered email → `needs_attention`,
  no retry; "No registered Game ID found." → its own user-facing state; anything else → retry with backoff.
- **Cache the sid** (encrypted like the password) between scans if the 1 h / 24 h checks pass. That
  saves ~12 requests and ~10 s per scan. Fall back to a full login when a page shows the login form.
- Parsers: port `PiuGameApi.cs`'s redesign paths (they match today, see "With a game card"), but fix
  the PUMBILITY total, skip empty-grade best cards as stage breaks (after confirming), and read the
  plate image on recent cards. Run `check-parsers.ts` against the fixtures in CI-style tests.

### Doc changes suggested (not made here)

- `DATA-SOURCES.md` lines 27–33 (login flow): step 1 already bounces through
  `api.am-pass.net/sso` and sets an anonymous `sid`; step 3 is wrong — success is a **302** from
  `login_check.php` (failure is 200 + `alert(…)`), the `sid` value doesn't change, and `.login_wrap`
  is in the header of every page (use `g5_is_member = "1"` / `form[name=flogin]`). Add the
  "No registered Game ID found." error page. Mark step 4 as possibly unnecessary (to verify).
- `DATA-SOURCES.md` lines 78–81 ("Open risk for Cloudflare Workers"): resolved, Workers complete the
  chain (spike 1) and the login works from a deployed Worker (this spike).
- `ARCHITECTURE.md` line 32 (`piugame scraper (or Container, see Spikes)`), lines 36–37
  ("Containers only if the TLS spike needs them") and line 297 (Containers cost row): drop the
  Container fallback.
- `ARCHITECTURE.md` lines 138–139: define "failed login" (POST 200 + alert), and add a separate
  `needs_game_id` (or similar) link status for "No registered Game ID found."
- `ARCHITECTURE.md` lines 282–286 (spikes 1–2): mark as answered.
- `DATA-SOURCES.md` line 41 (best-score row): Phoenix 2 serves the redesign (checked 2026-11-06),
  12 cards per page. Below-10 charts have no best-list bucket, but `play_data.php` offers `lv=1…9`.
  Line 42 (recently played): the cards now carry a plate image. Line 43 (pumbility): the total is
  in `.pumbility_total_wrap .score`, after a tier label (`DIAMOND Lv.1`).
- `DATA-SOURCES.md` line 59 (empty grade image = stage break): true on recent cards (they also
  say `STAGE BREAK`). On the redesigned best list it's the only signal, and broken plays use
  `x_<grade>.png`. Spell both out.
