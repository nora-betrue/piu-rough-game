# Reference: zkldi/Tachi

- Repo: https://github.com/zkldi/Tachi
- Live: kamaitachi.xyz (arcade games), boku.tachi.ac (home games)
- Reviewed: 2026-10-26, shallow clone of `main`
- **License: the server and client are AGPL-3.0. `common/` and the seeds are MIT/Unlicense.** Don't
  copy server/client code unless we're fine with AGPL. Taking *ideas* is fine.

A multi-game rhythm tracker (IIDX, SDVX, maimai DX, CHUNITHM, DDR, ITG, BMS, …). **It doesn't
support Pump It Up.** It's still the best reference for a *generic* score pipeline.

## Stack

- TypeScript monorepo (Bun workspaces). Express server, **Postgres via Kysely** (migrated from
  MongoDB), Redis, zod.
- React + Vite + react-bootstrap client, react-query. A Discord bot. Protobuf in places.
- `db/seeds/` is a git-tracked JSON catalog of songs/charts/folders, **the source of truth**.
  People fix chart data with PRs.

## Ideas to borrow

### How Tachi handles new game versions

Tachi uses two different mechanisms, depending on whether the sequel keeps the scoring system.

**1. Scoring changes completely: a new *game*.** maimai and maimai DX are separate games
(`maimai`, `maimaidx`), each with its own config, implementation, seeds, PBs and ratings.
Scores never cross between them.

**2. Scoring stays the same: a new *version* inside the game.** maimai DX FESTiVAL → BUDDiES →
PRiSM → CiRCLE are all one game:
- The game config has a `versions` map (`{ prism: "PRiSM", circle: "CiRCLE", … }`).
- Each chart carries a `versions: [...]` array of the versions it appears in.
- An import can name its `version`, and chart matching then uses it
  (`FindChartWithSongDifficultyVersion`). That handles duplicate titles across versions.
- `isPrimary` marks the *current* variant of a re-charted chart. Non-primary charts keep old
  scores but are excluded from ratings and hidden by default.
- The chart's level is the *latest* one in the seeds. Rebalances update the seed, and ratings get
  recomputed. Tachi does **not** keep a level history, so an old version's rating can't be reproduced.

**Adding a game means data, code and seeds:**
- **Config (data, `common/src/config/game-support/<game>.ts`):** `providedMetrics` (what the
  source gives you: score, lamp), `derivedMetrics` (grade), `versions`, `difficulties`,
  `classes` (rating tiers, dans), named `scoreRatingAlgs` / `sessionRatingAlgs` /
  `profileRatingAlgs`, and a zod `chartData` schema for game-specific fields.
- **Implementation (code, `server/src/game-implementations/games/<game>.ts`):** one object
  implementing `GameImplementation<G>` with these hooks:
  - `scoreDeriver`: grade from score.
  - `scoreCalcs`: rating per score.
  - `profileCalcs`: e.g. `ProfileSumBestN("rate", 50)`.
  - `sessionCalcs`.
  - `classDerivers`: rating to tier.
  - `pbMergeFunctions`: e.g. "best lamp", merged into the best-score PB.
  - `pbRankingValues`.
- **Seeds:** the song and chart JSON.

Ratings are **named algorithms**, so a formula change can ship as a new alg next to the old one.
Everything derived gets recomputed from the stored provided metrics.

**What this means for PIU:** the Phoenix → Phoenix 2 change kept the 1M score scale, but
re-levelled charts and changed the grade floors, the PUMBILITY formula and the official site
host. The official site also keeps a separate best list per mix. So a PIU mix behaves like a
Tachi *game* for records and ratings, while sharing song/chart identity like a Tachi *version*.

### Import pipeline: parser → converter → framework
(`typescript/server/src/lib/score-import/`, docs at `docs/src/codebase/import/`)

- **Import type** is a string like `file/batch-manual`, `ir/<client>`, `api/<service>`, which says
  where data came from. We'd have something like `api/piu-scores`, `ir/bookmarklet`, `file/csv`, `api/piugame`.
- A **parser** (a closure that captures its context) turns the source into an *iterable* of raw items.
- A **converter** (pure and static) turns one raw item into a "dry score" + chart match, or a
  typed failure: `SongOrChartNotFound`, `InvalidScore`, …
- The **framework** then runs the steps in order: insert scores → build sessions → recompute PBs
  for the affected charts → recompute user game stats (the rating) → goals/quests → write an
  **import document** (with timings per step).
- **User intent** flag: separates manual imports from automatic ones (keeps auto-syncs off the
  user's import history).

### Score IDs (dedupe)
`scoreID = "T" + sha256(userID, chartID, provided metrics…)`. Re-importing the same page
(which happens *every* time you scrape a best-score list) then never duplicates anything.
**Don't** rely on timestamps: sources change them. A catch ("clobbering"): if a score was first
imported without judgements, importing it later *with* judgements counts as a duplicate. So decide
what goes into the hash on purpose, or merge in the judgements.

### Orphan scores
If a score's chart isn't in the catalog yet, store the raw parser output as an orphan. When the
catalog updates, run the (static) converter over it again. Essential for PIU: new charts show up
on piugame.com before any catalog has them.

### PB = union of bests
The PB document joins the best *score* with the best *lamp* (and other per-game fields). For PIU:
best score + best plate + pass beats broken. This matches the official best-score card.

### Metrics config per game
Each game declares `providedMetrics` (score, lamp, …), `derivedMetrics` (grade, computed from
score), the default metric, and ratings ("classes") as config data, with validators and
formatters. For us that becomes one `mixes` config table: grade floors, plate rules, rating fn.

### Sessions
Plays sorted by time, split on gaps over **2 hours**, given a random name, with per-session stats.
Players think in sessions, so a shareable session page is a good feature.

### BATCH-MANUAL
A simple JSON import format (`meta: {game, playtype, service}`, `scores: [{score, lamp, matchType,
identifier, difficulty, timeAchieved}]`). Lets people with a bit of scripting import from
anywhere. **Our bookmarklet should post exactly a format like this**, and so should any future
community tools.

### Showcase
Users pin stats/charts to their profile (`lib/showcase/`). Maps to our "favorite scores" feature.

### Goals & quests, folders, rivals, API tokens + OAuth2 clients, webhooks
All good later-stage features. The folders concept (a level folder like "S20s", with
clear/grade counts per folder) is a standard stats view across rhythm games.
