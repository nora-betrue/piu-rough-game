# Architecture

**Rough Game** (`roughgame.ing`). Status: agreed direction (2026-10-26). Nothing is built yet.

## Principles

1. **Imports are rare, reads are constant.** Do all the work when an import happens. Profile and
   score pages read precomputed snapshots from the edge.
2. **Store what the source said, and derive everything else.** Score, plate, broken flag,
   optional judgements and the raw payload are stored. Grades, PUMBILITY, PBs, stats and
   snapshots can all be recomputed, whether because a constant was corrected or a new mix arrived.
3. **A mix is a separate game** (Tachi's model, `reference/tachi.md`). Records, PBs and ratings never cross
   mixes. Song and chart *identity* is shared. Launch with Phoenix 2 only.
4. **One shared TypeScript core.** The same scoring, rating and parsing code runs in the
   scraper, the bookmarklet, the export renderer and the browser.
5. **Small scale on purpose.** We expect a few hundred users and per-user aggregates only: no
   cross-player regression or analytics.

## System overview

```
 browser ── SvelteKit app (web Worker) ──────────────┐ reads snapshots   ┌──────────────────┐
   │  "Import" button → enqueue                       ├──────────────────►│ R2               │
   │  Discord interactions → /api/discord             │                   │ snapshots/ raw/  │
 piugame tab ── bookmarklet → POST /api/imports ──────┤                   │ exports/ avatars/│
 PIU Scores ── score-push webhook ────────────────────┤                   │ official/ (art)  │
                                                      ▼                   └────────▲─────────┘
                                              Queue: imports                       │
                                              Queue: seed                          │ writes
                                                      ▼                            │
                                    jobs Worker (queue consumers + cron) ──────────┤
                                      ├─ piugame scraper (or Container, see Spikes)│
                                      └─ import pipeline ──► D1 (system of record) ┘
```

All of it runs on Cloudflare: Workers, D1, R2, Queues, Cron Triggers (and Containers only if the
TLS spike needs them).

## Repo layout (planned)

```
apps/web/             SvelteKit (adapter-cloudflare): pages, API, Discord interactions endpoint
apps/jobs/            Worker: queue consumers, cron, PIU Scores webhook receiver
packages/core/        mix definitions, scoring, rating, PB merge, batch schema (zod), page parsers
packages/bookmarklet/ tiny loader + the scraper bundle (uses core parsers with DOMParser)
seeds/                catalog JSON (songs, charts, chart_mix, versions, catalog-supplement, overrides)
scripts/              catalog sync from PIU Scores, D1 migrations, Discord command registration
```

Language: TypeScript everywhere. ORM: Drizzle (SQLite dialect). Tests: Vitest.

## The mix definition (durability for the next version)

Each mix is one module in `packages/core/mixes/<mix>/`. Adding a mix (e.g. "Phoenix 3") means writing
a new module and adding catalog rows. No `if (mix === …)` checks anywhere else.

```ts
interface MixDefinition {
  id: "phoenix2" /* | "phoenix3" … */;
  displayName: string;
  officialSite: { baseUrl: string; ssoUrl?: string; assetPrefix: string }; // e.g. "/l_img/p2/"
  isCurrent: boolean;                 // default mix for bare URLs

  // provided data → derived data
  gradeFor(score: number): Grade;     // per-mix ladder
  plateFor(j: Judgements): Plate;
  scoreFrom(j: Judgements, maxCombo: number, notes: number): number;

  // ratings are *named*, so a formula correction ships as a new alg next to the old one
  chartRating: Record<string, (pb: PB, chart: ChartMix) => number>;
  profileRatings: Record<string, (pbs: RatedPB[]) => number>; // total/singles/doubles top-50, co-op sum
  titleLadder?: TitleRung[];

  assets: OfficialAssetManifest;      // grade/plate/stepball/badge paths on the official site

  parsers: {                          // detect the layout; throw if unrecognised
    bestScores(doc: Document): ParsedBest[];
    recentPlays(doc: Document): ParsedPlay[];
    pumbilityBreakdown?(doc: Document): ParsedPumbility;
    titles?(doc: Document): ParsedTitles;
    playDataCensus?(doc: Document): LevelCounts;
  };
}
```

Unit tests for each mix pin the formulas to values read off the official breakdown page. Parser
tests run against saved HTML snapshots: real pages, with personal data scrubbed.

## Data model (D1 / SQLite)

Every score-derived table has a `mix` column.

| Table | Key columns | Notes |
|---|---|---|
| `songs` | id, title, artist, bpm_min, bpm_max, song_type, duration_s | Global |
| `charts` | id, song_id, type, players?, step_artist | Global identity |
| `chart_mix` | chart_id, **mix**, level, note_count?, channel, added_version, is_current | Per-mix facts. Rebalances add rows instead of overwriting |
| `users` / `oauth_accounts` | user ↔ (provider, provider_user_id) | Discord + Google |
| `players` | id, **mix**, game_tag, user_id?, kind (`user`/`official`), hidden | A profile per mix. Seeded top-100 rows have no user until claimed |
| `piugame_links` | user_id, login_id, **credential_ciphertext**, key_id, auto_scan, status, last_scan_at, last_full_scan_at | Opt-in stored login (see "Credentials") |
| `plays` | **score_id** (hash PK), player_id, chart_id, mix, score, plate?, is_broken, perfect?…miss?, max_combo?, played_at?, import_id, source | Append-only. Judgements are optional (all six fields or none) |
| `pbs` | (player_id, chart_id), score, plate?, is_broken, grade, rating, best_score_play, best_plate_play | Derived: best score ∪ best plate, and a pass beats broken |
| `player_stats` | player_id, pumbility, singles, doubles, coop, computed_at, alg_version | Derived |
| `imports` | id, player_id, type, intent (user/auto), status, progress, counts, timings, error, raw_key | Drives the progress UI. The raw payload lives in R2 |
| `orphans` | id, player_id, mix, raw, reason | Re-matched when the catalog changes |
| `official_placements` | mix, game_tag, chart_id, place, score, as_of | Seeded top-100 board data |
| `showcase` | player_id, kind (`title`/`pb`), ref, sort | Favorite titles and scores |
| `player_titles` | player_id, title_id, equipped | From `title.php` |
| `avatars` | user_id, r2_key, kind (`upload`/`official`), status (`active`/`removed`), reported_count | |
| `export_presets` | user_id, name, json | Top-50 export customization |
| `discord_links` | user_id, discord_user_id | Same as the Discord OAuth identity |

## Imports and queues

### Queues

| Queue | Messages | Consumer settings |
|---|---|---|
| `imports` | `{importId, playerId, source, mode: "full" \| "incremental"}` | Low concurrency (2–3) to be polite to piugame.com; retries with backoff; dead-letter queue |
| `seed` | `{kind: "rankings"}` then one `{kind: "player", gameTag}` per player | Concurrency 1 (respects PIU Scores' 600 req/min) |

Messages **never contain credentials**. The consumer loads them from `piugame_links` and decrypts
them in memory. Limits that matter (checked 2026-10-26): 128 KB per message, `delaySeconds` up to
24 h, 15 min wall time per consumer invocation, 14 days retention. Paid plan: 1M operations/month
included, then $0.40/M. That's far beyond what a few hundred users need.

### Sources

- **Import button:** `POST /api/imports` inserts an `imports` row (`status=queued`) and enqueues
  `full`. One active import per player: a second click returns the running one. The page shows
  progress by polling the `imports` row (`logging in → page 3/40 → saving → done`).
- **Daily auto-scan:** a cron job enqueues `incremental` for every link with `auto_scan=1`, spread
  over a few hours with `delaySeconds`. An incremental scan reads:
  1. `recently_played.php`: the last ~50 plays, with judgements;
  2. the best-score list newest-first, stopping at the first page with no changes;
  3. `play_data.php`: per-level record counts. If they differ from ours, upgrade to `full`.

  It also does a weekly `full` scan per user as a safety net. A failed login marks the link
  `needs_attention`, stops auto-scans and tells the user. No retry loops against a bad password.
- **Bookmarklet:** posts batch JSON → stored in R2 → `imports` row → enqueued for the pipeline step only.
- **PIU Scores webhook:** verified (HMAC) → enqueued the same way. Dedupe on (chart, recordedAt).

### Pipeline (inside the consumer)

1. Scrape or load the batch, and write the raw payload to `R2 raw/{import_id}.json`.
2. Match each item to a chart, or store it as an orphan.
3. Compute `score_id = sha256(player, chart, mix, score, plate, is_broken)`. Judgements are not
   included.
4. Insert new plays, or merge judgements into an existing play.
5. Recompute PBs for the affected charts, then `player_stats`.
6. Write snapshots and purge the edge cache.
7. Finish the `imports` row with counts and per-step timings (Tachi's import document).

Writes use `db.batch()` with multi-row inserts. D1 allows 100 bound parameters per statement.

## Credentials

Background imports need the piugame password, so storing it is **opt-in** and explained at link time.

- **Asymmetric envelope:** the `web` Worker holds only an RSA-OAEP **public** key. It encrypts the
  login when the user links, and can never decrypt it. Only the `jobs` Worker holds the private key
  (as a Worker secret). The ciphertext is AES-256-GCM, with the key wrapped by RSA-OAEP and
  `user_id` as associated data. `key_id` allows key rotation.
- The plaintext exists only in the consumer's memory during a scrape. It is never logged, and
  never put in a queue message, error or R2 object.
- **Unlink** deletes the row immediately. Deleting an account deletes everything.
- Users who refuse can still use the bookmarklet.

## Read path

- `R2 snapshots/{mix}/{handle}/profile.json`: rating, title, avatar, top 50, showcase, headline stats.
- `R2 snapshots/{mix}/{handle}/scores.json`: every PB, compact.
- `R2 catalog/{mix}.{hash}.json`: immutable and content-hashed, cached forever.
- The profile page is server-rendered at the edge from `profile.json` (one R2 read, then the Cache API).
  The scores page loads `scores.json` + the catalog once, and filters and sorts in the browser with state
  in the URL.
- **D1 isn't on the hot read path.**

## Official assets (grades, plates, step balls, badges)

The project wants the **official art**. Checked 2026-10-26:

| Asset | Path (Phoenix 2) | Size |
|---|---|---|
| Grades | `/l_img/p2/grade/{sss_p,sss,ss_p,…,a_p,a,b,c,d,f}.png`; broken = `x_` prefix | 300×178 |
| Plates | `/l_img/p2/plate/{pg,ug,eg,sg,mg,tg,fg,rg}.png`; small `s_` variants | 240×72 (small 102×45) |
| Step balls | `/l_img/p2/stepball/full/{s,d,c}_bg.png`, `…_num_{0-9}.png`, `…_text.png` | 174×174 bg, 50×62 digits |
| PUMBILITY badges | `/l_img/pumbility/pumbility_NN.png` | 400×400 |

Phoenix (1) uses the same names without `/p2/`. The art differs, so the paths belong in each mix's
`assets` manifest.

Policy:

- **The repo contains no Andamiro art** (it's MIT-licensed). It contains only the *manifest*
  (official paths → our keys).
- An `assets-sync` job mirrors the manifest into `R2 official/{mix}/…` and serves it from our
  domain. The UI, exports and the Discord bot all use those copies. A fork or self-host gets the art by
  running the job.
- These are raster PNGs at most 300px wide: sharp at their native size or smaller. Big exports
  should place them at ≤ 1× their pixel size (a 150px-wide grade at 2×), not upscale them.
- **Fallback theme:** our own CSS/SVG badges in the same layout. They're used if an asset is missing,
  and as an optional "minimal" export theme.
- Jackets and official avatars: mirrored to R2 on first use, same policy.
- Practical risk: community trackers (PIU Scores included) have used this art for years. If Andamiro
  ever asks us to stop, we switch the default theme to the fallback and delete the R2 copies.

## Exports (top 50)

Satori (`satori-html`, no React) + resvg-wasm → PNG, rendered in a Worker. The output is cached in
`R2 exports/{hash(snapshot_version, preset)}.png`. The same renderer makes profile OpenGraph images
and the Discord `/top50` image. The customizer previews live in the browser with the same layout.
Fonts: **Pretendard** (OFL, covers Latin + Korean), subset and stored in R2.

## i18n

- **Paraglide JS** (inlang), the official SvelteKit integration (`pnpm dlx sv add paraglide`). Messages are
  compiled into tree-shakeable functions, so each page ships only the strings it uses.
- Locales at launch: `en` (base), `es`, `ko`. **Every UI string goes through a message from
  day one**, even before translations exist. Missing translations fall back to English.
- URLs: English at `/`, others at `/es/…` and `/ko/…`, so a shared profile link keeps its language.
  The first visit uses `Accept-Language`, and the user's choice is saved.
- **Not translated:** song titles and artists (shown as the official site shows them), and
  judgement names, grades and plates (players know them in English; PIU Scores does the same).
- Dates and numbers use `Intl`. The Discord bot uses the interaction's `locale`, and exports use the
  owner's locale.
- Translators: message files are JSON (`messages/{locale}.json`), with a free OSS Weblate/Crowdin
  project later.
- Fonts: Pretendard on the web too, loaded with `unicode-range` subsets so English pages don't
  download Hangul.

## Uploads (custom avatars)

1. The browser crops and resizes to 256×256 and encodes WebP.
2. `POST /api/avatar` (authenticated, rate-limited). The Worker checks the magic bytes (not
   the extension), size ≤ 200 KB and dimensions, then writes to `R2 avatars/{user_id}/{sha256}.webp`.
3. The image is served from an R2 custom domain (`img.roughgame.ing`) with immutable caching. A new
   upload gets a new key, so no cache purge is needed.
4. **Safety:** enable Cloudflare's **CSAM Scanning Tool** on the zone that serves uploads. Add a
   "report avatar" button, an admin removal flow (`avatars.status=removed`, falling back to the official
   avatar), and per-user upload limits.
5. Later: animated avatars, banner images (same pipeline, different limits).

## Discord bot

An **HTTP-interactions** bot, not a gateway bot: Discord POSTs each slash command to
`/api/discord/interactions` in the SvelteKit app. That means no always-on server, and it fits Workers.

- **Verification:** every request is checked against the application's Ed25519 public key (Web
  Crypto). Invalid requests get a 401. Discord also checks this when you set the endpoint URL.
- **Commands:** `/profile [user]`, `/top50 [user]`, `/pb <song> [chart]`, `/compare <user>`.
  They're registered by `scripts/register-discord-commands.ts` through the REST API.
- **3-second rule:** reply instantly when possible. For images, reply "deferred" (`type 5`), then
  render in `ctx.waitUntil` (or reuse a cached export) and edit the original response with the image.
- **Identity:** users log in with Discord OAuth, so a command with no target shows the caller's
  own profile.
- **Install contexts:** user install (works in any server or DM) **and** guild install.
- **Later:** posting PB announcements to channels needs only the REST API with the bot token
  (webhooks or channel messages), still no gateway.
- Libraries: `discord-api-types` (types), `discord-interactions` (signature helpers).

## Auth

Discord + Google OAuth, with sessions in an HTTP-only cookie (session rows in D1). Bookmarklet
uploads use a per-user upload token, scoped to the import endpoint and revocable.

## Scheduled jobs

| Job | When | What |
|---|---|---|
| Daily auto-scan | Daily, spread over a few hours | Enqueue `incremental` for every auto-scan link |
| Weekly full scan | Weekly, staggered | Enqueue `full` per link |
| Top-100 seed | Weekly | Enqueue `seed` → `official/rankings` + `official/players/{tag}` → `players(kind=official)` + `official_placements` → snapshots |
| Catalog sync | Daily | Pull PIU Scores `songs`/`charts`/`versions` (ETags) + `seeds/catalog-supplement.json` → upsert → re-match orphans |
| Assets sync | Weekly, and on catalog changes | Mirror new jackets and manifest assets to R2 |
| Recompute | On deploy, when a formula version changes | Re-derive PBs, stats and snapshots from `plays` |

## Spikes (do these first)

The full briefs are in [`spikes/`](spikes/README.md). Each one is self-contained and can run in parallel.

1. **Workers → piugame.com TLS.** Does `fetch("https://piugame.com/")` from a deployed Worker
   succeed, given the missing intermediate? If not, the scraper runs in a Cloudflare Container
   with `NODE_EXTRA_CA_CERTS`.
2. **Login from Cloudflare egress.** Does the `login_check.php` → `am-pass.net` flow work from
   Cloudflare, without captcha or blocking? It also produces scrubbed page fixtures for parser tests.
3. **Bookmarklet CSP** on piugame.com. If external scripts are blocked, fall back to an inline bundle or a userscript.
4. **Export rendering.** Satori + resvg-wasm + Korean font inside the Worker size and CPU limits.
5. **PIU Scores API access.** Tool key, the `official/rankings` row count, and catalog field coverage.

## Cost estimate (monthly)

| Item | Cost |
|---|---|
| Workers Paid (Workers, D1, Queues, Cron included) | $5 |
| R2 (snapshots, assets, avatars, exports: a few GB, no egress fees) | ~$0–2 |
| Containers (only if spike 1 fails; a few scrape-minutes a day) | ~$0–5 |
| Domain `roughgame.ing` | already bought |
| **Total** | **~$5–12**, well under the $50 budget |

## D1

At a few hundred users the whole database stays **under 1 GB**. D1's 10 GB cap and
single-threaded execution aren't a concern, and the hot read path doesn't touch D1 at all.
Reconsider only if the database passes ~5 GB or we start on-demand cross-user analytics (both out
of scope). Drizzle with portable SQL keeps a later move to Postgres a migration, not a rewrite.
