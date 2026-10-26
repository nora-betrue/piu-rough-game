# Spike 4: Export rendering in a Worker

## Question

Top-50 exports, profile OG images and the Discord `/top50` image are planned as Satori →
SVG → resvg-wasm → PNG inside a Worker (`ARCHITECTURE.md`, "Exports"). **Does that fit the Worker size
and CPU limits with a Korean-capable font? How fast is a 50-tile render, and does it look right?**

## Background

- Satori needs TTF/OTF/WOFF fonts (**not WOFF2**). The chosen font is **Pretendard** (OFL), and
  Korean glyph coverage makes it large, so test subsetting (e.g. the 2,350 KS X 1001 Hangul + Latin).
- Candidates for the renderer:
  - `satori` + `satori-html` + `@resvg/resvg-wasm`, wired up by hand;
  - prebundled Worker packages (e.g. `workers-og`, `@cf-wasm/og`).
- Official images (grades 300×178, plates 240×72, jackets) will come from R2. For this spike, use
  local placeholder PNGs at those sizes.
- Check the current Worker size limits and the CPU-time defaults/maximums in the Cloudflare docs.

## Steps

1. `spikes/04-export-rendering/`: a Worker (`rg-spike-04`) with `GET /top50.png` that renders
   a 1080-wide image:
   - a header (avatar, name, PUMBILITY total);
   - a 5×10 grid of tiles (jacket, title, level ball, score, grade image, plate image,
     rating), with at least some Korean song titles.
2. Load fonts from R2 or as bundled assets. Compare the full Pretendard against a subset.
3. Measure:
   - compressed bundle size (`pnpm wrangler deploy --dry-run --outdir dist`, then gzip);
   - render time locally;
   - **CPU time when deployed** (`pnpm wrangler tail` or the dashboard), cold and warm.
4. Try 1× and 2× output scale, and check that the raster grade/plate images still look sharp at
   ≤ native size.
5. Test the font fallback: one tile with a title in a script Pretendard doesn't cover (e.g.
   Japanese). Note what happens.
6. Compare at least the hand-wired setup with one prebundled package.
7. Save the sample PNGs in the spike folder. Delete the Worker afterwards.

## Done when

- We have a recommended package setup, font strategy (subset size) and output scale.
- We have the bundle size, plus cold and warm render CPU times compared against the limits.
- Sample images show the layout works.

## Findings

_To be filled in by the spike._
