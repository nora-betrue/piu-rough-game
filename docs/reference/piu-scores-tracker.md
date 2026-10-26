# Reference: DrMurloc/PumpItUpScoreTracker ("PIU Scores")

- Repo: https://github.com/DrMurloc/PumpItUpScoreTracker (MIT)
- Live: https://piuscores.arroweclip.se/
- Reviewed: 2026-10-26, shallow clone of `main`

The most complete PIU tracker that exists, and the authority on PIU scoring rules. It's both a
**data source** for us (its API, see `../DATA-SOURCES.md`) and a reference implementation.

## Stack

- .NET 10, ASP.NET Core, **Blazor Server** (UI over a SignalR socket) + MudBlazor components.
- EF Core + SQL Server, one DbContext. Azure Blob for photos.
- MediatR for in-process commands/queries. MassTransit (in-memory) for events. Hangfire for cron jobs.
- HtmlAgilityPack scraping of piugame.com (`OfficialMirror` vertical).
- Discord bot, OAuth (Discord/Google/Facebook), Swagger, 8 UI locales.

## Architecture

The code is split into "vertical slices", one per bounded context: ScoreLedger, PlayerProgress, ChartIntelligence,
Catalog, OfficialMirror, Communities, CommunityTools, Seasons, … Each is its own assembly with a
small public `Contracts/` surface. Architecture tests enforce the boundaries.
Onion + hexagonal + DDD.

**What to take:**
- **An anti-corruption layer for the official site.** All scraping goes in one module that outputs
  clean domain records, so markup changes stay contained there.
- **One mix profile record** that answers "what does this mix support?" (scoring model, grade
  ladder, plates vs. none, official site URL) instead of scattering `if (mix == …)` checks.
- **Value types that validate on construction** (`PhoenixScore`, `DifficultyLevel`).
- **An append-only score journal + a separate best-attempt table.** Every play is kept, and PBs are
  derived from them.
- **Snapshot tests on saved HTML** of official pages (they use WireMock with snapshotted pages)
  so selector regressions get caught offline.

**What not to copy:**
- Blazor Server: every interaction is a server round-trip over a websocket. That's the opposite
  of "blazing fast profile loads" for anonymous visitors.
- The size of it: 20+ verticals for a one-person project. We're far smaller, so start with one
  app and clear module folders.

## Domain knowledge worth reading in their repo

- `docs/DOMAIN.md`: the glossary (summarized in our `../DOMAIN.md`).
- `ScoreTracker.SharedKernel/Models/ScoringConfiguration.cs`: the PUMBILITY constants, with
  comments explaining how each was measured.
- `ScoreTracker.SharedKernel/Enums/PhoenixLetterGrade.cs`, `PhoenixPlate.cs`: grade ladders and plate rules.
- `ScoreTracker.Domain/Records/ScoreScreen.cs`: the score formula.
- `ScoreTracker.OfficialMirror/Infrastructure/Apis/PiuGameApi.cs`: every piugame selector and
  login step.
- `docs/design/score-truth-model.md`, `stage-breaks-and-max-combo.md`: PB and edge-case rules.
- `docs/design/pumbility-*.md`: rating research, titles, levels.
- `docs/design/api-v2-community-tools.md`, `toolmaker-requirements.md`: how third-party tools
  integrate (sharing, webhooks, rules).
- `docs/UX-GUIDELINES.md`: per-mix themes and the colour ramps for grades and plates. Useful
  for consistent grade/plate colours in our exports.

## Features they have that we might want later

Sessions, tier lists, weekly charts, title progress, "what score do I need for X PUMBILITY"
calculators, rivals, communities/leaderboards, a Discord bot, CSV upload, seasons.
