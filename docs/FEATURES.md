# Features

The product goals, as stated by the project owner, with notes from research. Numbers are the
owner's.

## 1. Score uploading

Three import paths, one pipeline (see `DATA-SOURCES.md`, `reference/tachi.md`):

| Path | How | Notes |
|---|---|---|
| **Import button** (`api/piugame`) | The user links their piugame account once; clicking "Import" queues a background scrape, and the UI shows progress | **The main path.** The password is stored encrypted, opt-in (see `ARCHITECTURE.md`) |
| **Daily auto-scan** (`api/piugame`, no user intent) | A cron job queues a light scan for every linked account each day | For people who forget to click. Can be turned off per user |
| **Bookmarklet** (`ir/bookmarklet`) | JS runs on a logged-in piugame.com tab, scrapes, and POSTs JSON to us | Power users who want a button on piugame.com, or don't want to share their password |
| **PIU Scores** (`api/piu-scores`) | Shares with our registered tool (webhook) or a pasted personal token | Brings judgements and history |

All three produce the same intermediate "batch" JSON. The pipeline dedupes by score ID, stores
unmatched charts as orphans, recomputes PBs and the rating, and writes an import record.

**Judgements are stored when available, and optional.** Only recent plays (and PIU Scores data)
carry them. See `DOMAIN.md`, "Judgements".

## 2. Top 50 exports

- Render the PUMBILITY top-50 pool as a shareable image (PNG), shiftpsh-style jacket grid.
- Customizable: theme/colours, layout (grid density, 50 vs 30 vs per-type pools), which fields
  show (score, grade, plate, rating per chart, level), the title/avatar header, mix.
- Open questions: render on the client (DOM → canvas, e.g. `html-to-image`/`modern-screenshot`)
  or on the server (Satori/resvg, or headless Chromium) for stable output and OG images? Jacket
  images need CORS-friendly hosting (cache them ourselves).

## 3. Profile page

- Rating (PUMBILITY total / singles / doubles, per mix), title, avatar.
- **Favorite titles**: the user picks from titles they own (scraped from `my_page/title.php`).
- **Favorite scores**: the user pins specific PBs (Tachi's "showcase").

## 4. Blazing fast profile loads

- The profile is read far more often than it changes. Precompute a **profile snapshot** at import
  time and serve it from a CDN/edge cache (see `reference/shiftpsh-maimai.md`).
- Target: profile HTML + data in one round-trip from the edge. Jacket images lazy-loaded, on a CDN.

## 5. All scores view + filters

Filter/sort by: mix, **version**, level range, chart type, **BPM**, **artist**, **step artist**,
channel, grade, plate, pass/broken, in-PUMBILITY-pool, date. Text search on title.
Filter state lives in the URL query.

The catalog metadata (BPM/artist/step artist/version) doesn't exist on piugame.com. It comes from
the PIU Scores catalog API, kept as seed data.

A user has at most a few thousand PBs, so filtering on the client over one cached JSON blob is
viable and instant.

## 6. User stats

Ideas: grade/plate distribution per level ("folder lamps"), clear counts per level, PUMBILITY
history over time, sessions, closest-to-next-grade ("grinding"), how much each chart adds to the
rating, and singles vs doubles breakdown.

## 7. Seed the top 100 PUMBILITY players

So the site has data on day one. Pull the official top-100 ranking and each player's official
board placements (via PIU Scores' official-mirror API, or our own scrape as a fallback). Show them
as clearly labelled partial profiles that a player can claim or hide. See `DATA-SOURCES.md` §5.
Refreshed weekly by a queued job.

## 8. Internationalization

English, Spanish and Korean from day one. The details are in `ARCHITECTURE.md`, "i18n".

## 9. Custom avatars

Users can upload their own avatar, or use their official one (mirrored from piugame.com). See
`ARCHITECTURE.md`, "Uploads".

## 10. Discord bot

Slash commands (`/profile`, `/top50`, `/pb`, `/compare`), installable to a user or a server.
See `ARCHITECTURE.md`, "Discord bot".

## Later / maybe

Sessions pages, goals, rivals, tier lists from PIU Scores, a Discord bot, multi-language.
