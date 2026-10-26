# Data sources

Three ways to get scores in (feature 1), plus where the song/chart catalog comes from.
Researched 2026-10-26.

---

## 1. Official site scraping (piugame.com)

There is no official API, only server-rendered HTML (PHP). PIU Scores scrapes it with
HtmlAgilityPack in `ScoreTracker.OfficialMirror/Infrastructure/Apis/PiuGameApi.cs`. Read that
file before writing any selector.

### Hosts

| Mix | Base URL |
|---|---|
| Phoenix 2 | `https://piugame.com` |
| Phoenix | `https://phoenix.piugame.com` |
| (SSO for both) | `https://am-pass.net` |

Both Phoenix sites use the same page structure. Phoenix 2 step-ball images have an extra `/p2/`
path segment.

### Login flow

1. `GET {base}/` to collect the anonymous session cookies.
2. `POST {base}/bbs/login_check.php` as form-urlencoded: `url=/`, `mb_id=<email>`, `mb_password=<pw>`.
3. Success means a cookie named `sid…` is now set. If there's no `sid`, the login was rejected.
   A wrong password often still sets an *anonymous* sid. It only fails later, when an
   authenticated page returns the login page (look for `.login_wrap`).
4. `GET https://am-pass.net` to complete the SSO bounce.
5. After that, every request just needs the `sid` cookie, plus an `Origin: {base}` header.

**Phoenix 2 has no anonymous pages.** Leaderboards also need a login there.

### Pages we care about

| Page | What it has |
|---|---|
| `my_page/my_best_score.php?lv=<bucket>&&page=N` | **Personal bests.** Paginated. Song name, type + level (from step-ball image filenames), score, plate (from plate image filename), and on the Phoenix 2 redesign a date. The `lv` buckets are levels 10+; charts below 10 have no bucket and can only be counted from the "Total" header. Two layouts exist: classic `ul.my_best_scoreList` and the Phoenix 2 redesign that reuses the recently-played card. **Detect which one from the markup, not from the mix.** |
| `my_page/recently_played.php` | Last ~50 plays **with full judgements** (P/Gr/Go/B/M in `td[data-th=PERFECT]` etc.), broken/stage-break flags, and dates. The only source of judgement counts. |
| `my_page/pumbility.php` | Official PUMBILITY total plus the per-chart breakdown. Ground truth for checking our formula. |
| `my_page/title.php` | Titles owned (`ul.data_titleList2 li`), the equipped title, and the avatar. |
| `my_page/play_data.php?lv=<bucket>` | Count of records per level bucket. Useful as a "did the import get everything?" check. |
| `my_page/game_id_information.php` | Game ID / player tag. |
| `leaderboard/over_ranking.php`, `over_ranking_view.php?no=<id>` | Per-chart world leaderboards (top 100). |
| `leaderboard/pumbility_ranking.php` | Official PUMBILITY ranking. |

### Parsing gotchas (learned the hard way by PIU Scores)

- Chart type and level are **images**. Take the type from the `div.tw img` src (single/double/coop,
  `u_text` = UCS → skip it). Take each level digit from `div.numw img` / `div.imG img` with a regex
  on the filename, **not a fixed offset**: a host move once broke offset-based parsing.
- A plate is an image too. Regex the shorthand (`pg`, `ug`, `sg`, …) out of the filename.
- PUMBILITY values render as `17,418<span class="pumbility-point-sub">.45</span>`.
- Pagination: the max page is in the `onclick` of the `i.last` icon's parent.
- Song names are HTML-encoded. Decode them before matching to the catalog.
- A best-list card with an **empty grade image** (`<img src="">`) is a stage break.
- Add a timeout to every regex, and retry connection resets with exponential backoff (1s/2s/4s).
  Space out bulk requests (PIU Scores waits 250 ms between requests).

### ⚠ TLS chain is incomplete

Checked 2026-10-26: `piugame.com` serves **only its leaf certificate**
(`*.piugame.com`, issued by *Sectigo Public Server Authentication CA DV R36*) and leaves out the
intermediate. Browsers fill it in themselves, so this never shows up there. Node, curl and most
HTTP clients fail with `unable to get local issuer certificate`.

**Fix (verified 2026-10-26):** add the missing intermediate and verify normally. The leaf's AIA
field points to `http://crt.sectigo.com/SectigoPublicServerAuthenticationCADVR36.crt` (DER). That
cert is valid until 2036-03-21, SHA-256 fingerprint
`8C:54:C3:34:B6:6B:A4:E4:26:77:2A:F4:A3:F9:13:6C:19:A1:AE:C7:29:FD:B2:8C:53:5C:07:A5:A4:EF:22:E0`.
With it added to the system CA bundle, `curl --cacert` gets a verified `302` from piugame.com.
In Node: commit the PEM and pass it via `NODE_EXTRA_CA_CERTS` or the client's `ca` option.
**Never** disable TLS verification: these requests carry user passwords.

**⚠ Open risk for Cloudflare Workers:** a Worker's `fetch()` can't be given extra CA certificates.
Whether Workers complete the chain themselves (as browsers do) is **untested**. This is the first
spike (see `ARCHITECTURE.md`, "Spikes"). If Workers reject the chain, the scraper runs as a small
Node container (Cloudflare Containers) with `NODE_EXTRA_CA_CERTS`, called from the queue consumer.

### Trust & security notes

- Server-side scraping means **handling users' piugame passwords**. A live `sid` can change the
  user's account settings or delete the account.
- Background imports and daily scans (`ARCHITECTURE.md`) need the password **stored**. That is
  opt-in only, encrypted at rest, decrypted only inside the scraper, and deleted on unlink. Never
  log passwords or sids, and never put them in queue messages.
- The bookmarklet (§3) is the option for users who don't want to hand over credentials at all.

---

## 2. PIU Scores API (piuscores.arroweclip.se)

PIU Scores is an MIT-licensed community tracker run by DrMurloc. It has a public, documented API.
Swagger: `https://piuscores.arroweclip.se/swagger` (spec at `/swagger/v1/swagger.json`).
**Every endpoint needs auth** (anonymous requests get 401).

### Auth: two options

| | Personal token | Tool key |
|---|---|---|
| Header | `Authorization: Basic base64("x:<token>")` | `Authorization: Bearer piu_scores_live_…` |
| Issued | User's PIU Scores Account page | `/Developers` after registering a tool |
| Reads | That one user | Every player who **shared with your tool** |
| Suits | "Paste your token" import, MVP | A real integration, with webhooks |

### Toolmaker rules (needed for a tool key)

To use a tool key, the tool must follow DrMurloc's toolmaker rules:

1. **No money in it.** Free, no ads. A tip jar for hosting is OK; paid feature tiers are not.
2. Built for the community, not for one player's competitive edge.
3. Stay reachable. The maker must have a **Discord account linked** to their PIU Scores account
   (this is the enforced gate, since 2026-09-27).
4. Good standing ("Don't be an asshole").

Until the tool meets the gate, it can read only its maker's data.

### Endpoints we'd use (v2: cursor-paginated, `mix` required)

| Route | Use |
|---|---|
| `GET api/v2/mixes` | Mix list + `scoringModel` (`phoenix` / `legacy`) |
| `GET api/v2/songs?mix=` | Song catalog: `name, type, channel, artist, durationSeconds, imageUrl, bpm` |
| `GET api/v2/charts?mix=` | Chart catalog: `id, songName, type, level, noteCount, stepArtist, channel, addedInVersion, debutVersion, imageUrl, scoringLevel, …`. ETags are supported (send `If-None-Match`). |
| `GET api/v2/versions?mix=` | Patch list, for the version filter |
| `GET api/v2/players/{id}/scores?mix=` | `chartId, recordedAt, score, letterGrade, plate, isBroken, pumbility, judgments{…, maxCombo}` |
| `GET api/v2/players/{id}/stats` | PUMBILITY (total/singles/doubles/co-op), competitive level, clear count, estimated official rank |
| `GET api/v2/players/{id}/sessions`, `/journal` | Play history |
| `GET api/v2/tier-lists/{score-difficulty\|pass-difficulty\|pg-difficulty}` | Community difficulty |
| `GET api/v2/charts/{id}/skills` | PIU Center step-pattern badges (brackets, twists, …) |

`me` works as `{id}` with a personal token. With a tool key, use the IDs from `api/v2/players`.

**Rate limit:** 600 requests/min per credential. A `429` comes with `Retry-After`.
A full catalog pull is about 500 requests.

### Webhooks (tool key only)

A registered tool can receive a **Score push** webhook (identity + up to 100 changes, signed with
HMAC, delivered at least once) whenever a sharing player imports. The URL must pass a
verification handshake first. **Dedupe on (chart, recordedAt)**, because deliveries can repeat.
This is the right way to sync: don't poll with `recordedAfter`, because `recordedAt` is the
*play* date, not the import date.

### Ecosystem note

PIU Scores already has a bespoke integration with another tool called **"PIU Tracker"** (by Tusa),
which gets the live piugame `sid` during imports. Our project name is close to it. Worth
differentiating clearly.

---

## 3. Bookmarklet / userscript import (power-user path)

Most users import with the **"Import" button** on our site, which runs a background job (§1 + `ARCHITECTURE.md`).
The bookmarklet is for people who want a button *on piugame.com* itself, or who don't want to
give us their password.

The user logs into piugame.com in their own browser, then clicks a bookmarklet. Its JavaScript runs
**on the piugame.com origin**, so it can:

1. `fetch('/my_page/my_best_score.php?lv=…&page=N', {credentials: 'include'})` for every bucket and page
   (same-origin, so cookies are sent automatically).
2. Parse each page with `DOMParser`, using the same selectors as §1.
3. Optionally fetch `recently_played.php` (judgements), `pumbility.php` and `title.php`.
4. `POST` the normalized JSON to our API with a short-lived upload token the user copied from our site.
   Alternatively, `window.open` our site and `postMessage` the payload, which avoids CORS
   preflights on our side.

What it's good at:

- **We never see the user's password or sid.**
- No server-side scraping load, IP bans or TLS-chain problem (the browser handles it).
- Keep the bookmarklet itself to a tiny loader (`javascript:import('https://our.site/bm.js?v=…')`)
  so parser fixes ship without users re-installing it.

Still to check in a real logged-in browser: whether piugame.com sends a CSP that blocks loading
external scripts. If it does, inline the whole script into the bookmarklet, or ship it as a
userscript (Tampermonkey/Violentmonkey). Tachi's community uses userscripts for maimai/CHUNITHM
net the same way.

Mobile: bookmarklets are awkward on iOS Safari and Android Chrome. Document the "edit bookmark,
paste the URL" trick, or offer the userscript route.

---

## 4. Song / chart catalog

piugame.com gives song name + chart type + level only, with **no BPM, artist, step artist or
version**. Feature 5's filters need those, so the catalog has to come from elsewhere:

- **PIU Scores API** (`songs`, `charts`, `versions`, `channels`) is the **primary source**. It has
  everything feature 5 needs: artist, BPM, step artist, debut version, channel, note count,
  jacket image URL.
- **Supplementary catalog data** (`seeds/catalog-supplement.json`) fills gaps: step artist, BPM
  range, a note-count *estimate*. It is keyed by title/artist/type, not by our IDs, and joined at sync time.
  Its `level` is only a matching hint, and PIU Scores wins whenever both have a value.
- Keep the catalog as **seed files in the repo** (Tachi's pattern: `db/seeds/` is the source of
  truth, and PRs fix data) and refresh them from the API with a script.
- Matching scraped scores to charts: key on `(normalized song name, chart type, level, mix)`.
  Expect renames and duplicate titles. Store unmatched scores as **orphans** and re-match them
  when the catalog updates (Tachi's pattern).

---

## 5. Seeding: the top 100 PUMBILITY players

Goal: have real-looking profiles on the site before many users sign up.

**What exists officially:** `leaderboard/pumbility_ranking.php` lists the ranked players (game
tag, title, avatar, PUMBILITY). There's no public page with another player's full score list. The
only per-player score data is their entries on per-chart top-100 boards
(`over_ranking_view.php`), which show **place + score only: no plate, no judgements**. On Phoenix 2,
**all of these pages need a login** (a dedicated dummy account, never a real player's).

### Option A (recommended): PIU Scores' official mirror

PIU Scores already sweeps these boards weekly and serves them on the tool-key API:

| Route | Gives |
|---|---|
| `GET api/v2/official/rankings?mix=Phoenix2` | Rank, previous rank, player `{playerId, gameTag, avatarUrl}`, rating, `boardsInTop`, playstyle archetype |
| `GET api/v2/official/players/{gameTag}?mix=Phoenix2` | PUMBILITY, rank, #1s, top-10s, **`placements[]`** (chartId, place, score, computedRating), **`history[]`** (PUMBILITY + rank over time) |
| `GET api/v2/official/charts/{chartId}/board` | A chart's top-100 board |

That's ~101 requests for the top 100 instead of ~10k board scrapes, and no service account or
scraping load. Leave `supplemented` off (pure official data).

### Option B: scrape it ourselves

Log in with a service account. Scrape `pumbility_ranking.php` for the top 100, then every chart's
`over_ranking_view.php`, and invert the results into per-player placements. That's thousands of requests per
sweep, so space them out (PIU Scores waits 250 ms). Only worth it if Option A disappears.

### How seeded profiles behave

- They are **"official board" profiles**, not full ones: only the charts where the player is in
  the top 100, with score but no plate or judgements. Label them that way in the UI.
- Key them by `gameTag`. When a real user imports and their game tag matches, they **claim** the
  profile: it merges into their account and becomes a full profile.
- Players didn't sign up for this. Show only what the official leaderboards already show
  publicly, and offer an **opt-out / hide** request.
