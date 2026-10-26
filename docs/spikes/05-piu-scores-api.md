# Spike 5: PIU Scores API access

## Question

The catalog sync, top-100 seeding and the PIU Scores import all rely on the PIU Scores API
(`DATA-SOURCES.md` §2, §4, §5), but nobody has called it yet. **Can we get a tool key? What does
`official/rankings` return (and how many rows)? How complete is the Phoenix 2 catalog for our
filters?**

## Background

- Swagger: `https://piuscores.arroweclip.se/swagger` (spec: `/swagger/v1/swagger.json`). Every
  endpoint needs auth.
- **Personal token** (Account page) → `Authorization: Basic base64("x:<token>")`. **Tool key**
  (`/Developers`) → `Authorization: Bearer piu_scores_live_…`. A tool can only read players beyond
  its maker once the maker has **linked Discord** (the toolmaker rules: free, no ads, community-oriented).
- Rate limit: 600 req/min per credential, and `429` comes with `Retry-After`. v2 paginates with an opaque
  `next` cursor; `mix` is required (`Phoenix2`).

## Inputs (the owner)

1. A PIU Scores account with Discord linked.
2. Register a tool on `/Developers`:
   - name "Rough Game", repo URL `https://github.com/nora-betrue/piu-rough-game`;
   - no webhook yet.

   Put the tool key in `.dev.vars` as `PIU_SCORES_TOOL_KEY`, and optionally a personal token as `PIU_SCORES_TOKEN`.

## Steps

`spikes/05-piu-scores-api/`: a Node script (no Worker needed).

1. `GET api/v2/mixes`: confirm the exact `Phoenix2` name.
2. `GET api/v2/official/rankings?mix=Phoenix2&type=All`:
   - the row count, whether it paginates, and `snapshotAt`;
   - the same for `type=Single` / `Double`.
3. For the top 3 ranked players, `GET api/v2/official/players/{gameTag}?mix=Phoenix2`:
   - the placements count, the history length, and response size.
   - Estimate the total request count and time for all top 100 at a polite rate.
4. Pull the whole catalog with `songs`, `charts`, `versions` and `channels` (mix=Phoenix2), and
   save the raw JSON to `spikes/05-piu-scores-api/data/` (it's public catalog data, fine to commit).
   Report:
   - total songs and charts, and the count per chart type;
   - **coverage** (% non-null) of `artist`, `bpm`, `stepArtist`, `noteCount`, `addedInVersion`,
     `channel`, `imageUrl`, `scoringLevel`;
   - what `imageUrl` points to (host, format, size of one sample).
5. Send a second request with `If-None-Match` to check that catalog ETags work (expect `304`).
6. With the personal token (if given), `GET api/v2/players/me/scores?mix=Phoenix2`. Note the shape and
   whether judgements are present.
7. **Join test:** match `seeds/catalog-supplement.json` (if it's in the repo by then) or a sample of
   it to the chart list on `(normalized title, artist, type, players)`. Report the match rate and the
   main reasons for misses. Don't speculate about where that file comes from.
8. Note any API behaviour that differs from `DATA-SOURCES.md`.

## Done when

- We have a working credential and documented request/response shapes.
- We know the rankings row count, and have a top-100 seed plan with a request budget.
- The catalog coverage table is filled in, saying which feature-5 filters PIU Scores data can fully support.

## Findings

_To be filled in by the spike._
