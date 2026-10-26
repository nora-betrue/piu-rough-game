# yet-another-piu-tracker

A web app for tracking Pump It Up (Phoenix / Phoenix 2) scores: import from the official site,
show a fast public profile, make pretty top-50 exports, and filter and analyse all of a user's scores.

**Status:** pre-code. Research is done and the architecture is agreed (`docs/ARCHITECTURE.md`).
Start with the spikes listed there.

## Decisions (2026-10-26)

- **Name: Rough Game** (after the lowest plate). Domain: `roughgame.ing`.
- **Phoenix 2 only** at launch, but **built for the next mix**. Each mix is a separate "game"
  (Tachi's model): mix is a key everywhere, and the rules live in one mix-definition module per mix.
- **Imports run as background queue jobs**: an "Import" button, daily auto-scans for linked
  accounts, and the bookmarklet for power users. Stored piugame logins are opt-in and encrypted.
- **Store judgements when available.** They are optional: historic PBs won't have them.
- **Seed the top 100 PUMBILITY players** from PIU Scores' official-mirror API (a queued weekly job).
- **Register as a PIU Scores community tool.** This accepts the toolmaker rules: free, no ads,
  no paid tiers.
- **Stack:** SvelteKit + Cloudflare Workers, **D1** (Drizzle), R2, Queues. Discord + Google OAuth.
  Budget under $50/month. Expect a few hundred users and per-user aggregates only.
- **i18n from day one** (en/es/ko, Paraglide). Every UI string is a message.
- **Custom avatar uploads** (R2 + Cloudflare CSAM scanning), and an HTTP-interactions **Discord bot**.
- **Official grade/plate/stepball art**, mirrored to R2 at runtime and **never committed** to the repo.
- `seeds/catalog-supplement.json` is supplementary catalog data produced outside this repo. Treat it
  as an input file. Describe it neutrally and never speculate about its origin in docs, code or commits.

## Read first

- `docs/FEATURES.md`: the six product goals.
- `docs/DOMAIN.md`: scoring rules and rating formulas. **Every number there is per mix.**
- `docs/DATA-SOURCES.md`: how scores get in, and the gotchas.
- `docs/reference/*`: what we're borrowing from Tachi, PIU Scores and shiftpsh's maimai site.

## Domain rules that must never be violated

- **Key everything by mix.** Phoenix and Phoenix 2 share charts but differ in levels, grade
  cutoffs and PUMBILITY formula. Never compute a Phoenix 2 number with Phoenix constants.
- **Store plays; derive PBs.** PB = best score ∪ best plate, and a pass beats a broken attempt
  (it matches the official best card). Never let a re-import lower a PB.
- **Stage breaks are never scores.** Broken (failed but finished) scores are real but carry no plate.
- **Dedupe with a deterministic score ID** (hash of user, chart, and score fields), not timestamps.
- **Unmatched charts become orphans**, re-matched when the catalog updates. Never drop them.
- Skip UCS charts from the official site.
- Keep scoring and rating constants in one table-driven module with unit tests (from known
  official values). They have been corrected repeatedly upstream.

## Security rules

- piugame passwords are stored only when the user opts in, and only as encrypted
  ciphertext (`docs/ARCHITECTURE.md`, "Credentials"). Never log them or `sid` cookies, and never put them in
  queue messages, errors or R2.
- piugame.com serves an incomplete TLS chain. Fix it by bundling the Sectigo DV R36
  intermediate (`NODE_EXTRA_CA_CERTS`). **Never** disable certificate verification.
- Never commit Andamiro art (grades, plates, jackets, avatars). Commit only the asset manifest.
- Uploaded files: check magic bytes and size, and store under content hashes.
- PIU Scores API tokens are user credentials: encrypt them at rest, and scope and revoke them.

## Upstream etiquette

- PIU Scores API: respect 600 req/min and `Retry-After`. Tool-key use means following
  DrMurloc's toolmaker rules (free and ad-free, community-oriented, maker reachable on Discord).
- Official site: space out requests, back off on errors, and cache catalog data. Don't crawl
  leaderboards without a reason.
- Tachi server/client code is AGPL-3.0. Borrow ideas, not code, unless we accept the AGPL.
  PIU Scores is MIT.

## Conventions

- **pnpm only**: `pnpm install`, `pnpm <script>`, and `pnpm dlx` for one-off tools (never `npm`/`npx`).
  CLIs used regularly (wrangler, drizzle-kit) are devDependencies, run as `pnpm wrangler …`.
- Write docs in `docs/`. Update `docs/README.md` when adding one.
- Date research claims (`checked YYYY-MM-DD`): the official site and formulas change.
