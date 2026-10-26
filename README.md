# Rough Game

A fast, good-looking score tracker for **Pump It Up Phoenix 2**. It's named after the lowest
plate in the game, because we've all been there.

🌐 **[roughgame.ing](https://roughgame.ing)** (not live yet)

> **Status: planning.** The research and architecture are done (see [`docs/`](docs/)). There's no
> app code yet.

## What it does

- **Imports your scores from the official site.** Link your piugame.com account and hit
  **Import**: it runs in the background. Opt-in **daily auto-scans** catch the sessions you forget about.
  There's also a **bookmarklet** for anyone who wants a button right on piugame.com, and an
  integration with [PIU Scores](https://piuscores.arroweclip.se/).
- **Stores judgements** (Perfect / Great / Good / Bad / Miss) whenever the source has them.
- **Top 50 exports**: share-ready, customizable images of your PUMBILITY top 50.
- **Profiles** with your rating, favorite titles and pinned scores, served from the edge so
  they load instantly.
- **All your scores, filterable** by level, chart type, version, BPM, artist, step artist, grade, plate and more.
- **Stats**: grade and plate breakdowns per level, rating history, sessions.
- **Discord bot**: `/profile`, `/top50`, `/pb` and `/compare` in any server or DM.
- **English, Español, 한국어** from day one.
- **Ready for the next mix.** Each game version is its own self-contained module, so "Phoenix 3"
  is an addition, not a rewrite.

## Stack

[SvelteKit](https://svelte.dev/) on [Cloudflare Workers](https://workers.cloudflare.com/), with D1
(SQLite, via Drizzle), R2, Queues and Cron Triggers. TypeScript throughout, with
[Paraglide](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) for i18n and
[Satori](https://github.com/vercel/satori) for image exports. Read
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design.

## Docs

| Doc | What's in it |
|---|---|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design: mix definitions, data model, imports and queues, assets, i18n, Discord bot |
| [FEATURES.md](docs/FEATURES.md) | Product goals |
| [DOMAIN.md](docs/DOMAIN.md) | Pump It Up scoring, grades, plates and the PUMBILITY formulas |
| [DATA-SOURCES.md](docs/DATA-SOURCES.md) | The official site, the PIU Scores API, the bookmarklet, the song catalog |
| [reference/](docs/reference/) | What we learned from Tachi, PIU Scores, and shiftpsh's maimai site |

## Development

Requires **Node ≥ 22.18** and **pnpm ≥ 11**. This repo uses **pnpm only**: `npm install` is
rejected on purpose.

```sh
corepack enable   # or install pnpm yourself
pnpm install
```

App setup instructions will land here once the app is scaffolded.

## Acknowledgements

- **[PIU Scores](https://github.com/DrMurloc/PumpItUpScoreTracker)** by DrMurloc: the community's
  reference for PIU scoring rules, and a data source for this project.
- **[Tachi](https://github.com/zkldi/Tachi)** by zkldi: the inspiration for the import pipeline
  and the "every version is its own game" model.
- **[shiftpsh.com/maimai](https://github.com/shiftpsh/shiftpsh.com-maimai)**: the inspiration for
  static, fast profiles and the best-50 view.

## Disclaimer

Rough Game is an unofficial, non-commercial fan project. It is **not affiliated with or endorsed
by Andamiro**. *Pump It Up*, PUMBILITY, song jackets, grade and plate artwork, and all other game
content are the property of Andamiro and their respective owners. That artwork is **not** part of
this repository and is not covered by its license.

## License

[MIT](LICENSE) for the code in this repository.
