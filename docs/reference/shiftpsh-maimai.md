# Reference: shiftpsh/shiftpsh.com-maimai

- Repo: https://github.com/shiftpsh/shiftpsh.com-maimai
- Live: https://shiftpsh.com/ (maimai section)
- Reviewed: 2026-10-26

A **single-player, fully static** maimai DX profile site. It's what feature 2 (pretty Best 50
exports) and feature 4 (fast profiles) should feel like.

## How it works

1. A **GitHub Actions cron** (daily, 07:30 KST) logs into SEGA's maimai DX NET with
   secrets (`SEGA_ID` / `SEGA_PASSWORD`) and scrapes every difficulty's score list, the player
   data and a few extras (axios + `node-html-parser`, with exponential `backoff` and batched
   promises).
2. The scripts write **JSON into `src/db/`** (`records.json` ~620 KB, `songs.json`, `meta.json`,
   `internal.json` with chart constants from a community Google Sheet, …) and auto-commit it.
3. A second job runs `vite build` and deploys the static `dist/` to **S3 + CloudFront**.
4. The React SPA imports those JSON files directly. There's no backend, so the page load is just
   static files from a CDN.

## Stack

React 18 + Vite + TypeScript, Emotion (styled), framer-motion, `@solved-ac/ui-react`,
`@tabler/icons-react`, react-router.

## Ideas to borrow

- **Precomputed, static, CDN-served profile data.** Rating, best 50 and stats are computed at
  build/import time, not per request. For a multi-user app: on each import, write a
  **profile snapshot JSON** per user to object storage/KV and serve it from the edge. The profile
  page then needs one fetch.
- **Filter + sort state in the URL** (`utils/filterAndSort/query.ts`): `?level=13,15&version=…&sort=…&order=desc`.
  Links to filtered views can be shared, and it's simple. Filters include
  "has rating-increase potential" and "in best ratings": PIU equivalents are "could enter top 50"
  and "in PUMBILITY pool".
- **Best-50 grid** (`components/MyBest50.tsx`): a CSS grid of jacket tiles, 5/4/3 columns by
  breakpoint, with summary stats above it.
- Login/scrape code shape (`scripts/axios.ts`): a cookie jar via interceptors, maintenance-page
  detection, an error-code regex, and masking the session id in logs.
- Extra views: "Grinding" (charts closest to the next grade or rating step), trophies, stamp card.

## Limits

Single user, credentials in CI secrets, rebuilt once a day. A multi-user app can't keep each user's
password in CI. That's why we need the bookmarklet or API import, with a per-user snapshot instead
of a site rebuild.
