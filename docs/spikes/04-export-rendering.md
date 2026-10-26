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

Run 2026-10-26. Code, scripts and samples are in `spikes/04-export-rendering/` (`pnpm fonts`,
`pnpm placeholders`, `pnpm bench`, `pnpm samples`). The Workers `rg-spike-04` and
`rg-spike-04-og` and the R2 bucket `rg-spike-04-fonts` have been deleted.

### Answer

**Yes, it fits, with margin on size and memory, but it's CPU-heavy.** A 1080-wide top-50 takes
**2–4 s of CPU** on Workers in the tuned setup (5–9 s untuned), against a 30 s default limit. Every
render is effectively cold. Render exports in a **Queue consumer** and cache them in R2, as the
architecture already plans, and never render one inside a user-facing request.

### Limits (Cloudflare docs, checked 2026-10-26)

| Limit | Value |
|---|---|
| Worker size | **64 MiB uncompressed, Free and Paid. There is no compressed limit any more**: the `gzip` figure from `wrangler deploy` is informational. |
| CPU time per HTTP request | Paid: **30 s default, configurable up to 5 min** (`limits.cpu_ms`). Free: 10 ms. Queue consumers: up to 15 min. |
| Memory | 128 MB per isolate, including Wasm memory |
| Startup | 1 s to evaluate global scope |
| CPU pricing | 30 M CPU-ms/month included, then $0.02 per million CPU-ms (≈ $0.06 per 1,000 renders at 3 s). 10,000 renders/month are free. |

### What was built

- `GET /top50.png`: a 1080×2644 image with a header (avatar, name, title, PUMBILITY) and 5×10 tiles
  (jacket, level ball, rank, title clamped to 2 lines, grade image, plate image, score, rating).
  Ratings use the Phoenix 2 formula. Titles include 비상 ~Flying~, 고독이라는 이름의 열차, 소리꾼,
  세상에 뿌려진 사랑만큼 and one Japanese test string, 残酷な天使のテーゼ (kana + kanji).
- Placeholder art is our own, generated at the official sizes: grades 300×178, plates 240×72,
  jackets 300×300, avatar 200×200. **Jackets carry turbulence noise** so their PNGs (~195 KB each)
  cost as much to decode as photos. That's a pessimistic case.
- Two Workers on identical layout and R2 data:
  - **hand**: `satori` 0.63.2 (`satori/standalone`) + `satori-html` 0.3.2 + `@resvg/resvg-wasm` 2.6.2;
  - **og**: `@cf-wasm/og` 0.5.0 (bundles satori **0.32.0** and resvg-wasm **2.4.1**, the "legacy" build).
- Fonts and images load from R2 and are cached per isolate. `font=bundled` imports the subset as a
  Data module instead. `opt=1` is the tuned variant (see "Making it faster").
- CPU times come from `wrangler tail` (`cpuTime`), FRA colo. Each config: deploy (fresh isolate),
  then 4–5 requests.

### Fonts

Pretendard 1.3.9 from GitHub releases (OFL). Noto Sans JP 2.004 from `notofonts/noto-cjk` releases
(OFL) for the fallback.

| File | Size |
|---|---|
| Pretendard Medium / Bold, full OTF | 1,584,068 / 1,576,660 B |
| **Subset** (3,033 code points: KS X 1001's 2,350 Hangul, compatibility jamo, Latin-1 + Ext-A, punctuation/symbols, **kana**), OTF | **408,600 / 405,132 B** |
| Same subset, WOFF | 272,512 / 273,292 B |
| Subset without kana (used for the Workers runs) | 384,432 / 381,152 B |
| Noto Sans JP Bold, full | 4,656,448 B |
| Noto Sans JP Bold, **catalog subset** (only the code points of titles that Pretendard lacks: 残酷天使) | **3,212 B** |

- Full Pretendard covers **all 11,172 Hangul syllables and all kana, but 0 of 20,992 CJK
  ideographs**. Any title with kanji/hanzi needs a fallback font.
- **Font size doesn't affect render time.** Full, subset and WOFF all render within 1% of each other
  locally. The subset matters for bundle size, R2 transfer and isolate memory, not CPU.
- **Fallback behaviour** (`samples/font-fallback.png`): satori calls `loadAdditionalAsset(lang,
  segment)` for missing glyphs. If that returns nothing, they render as Pretendard's `.notdef` box
  (visible tofu: no error, no blank). Returning the 3 KB catalog subset fixes them, and kanji from
  Noto mix cleanly with kana from Pretendard.
- The first subset left out kana, so the fallback had to supply kana as well as kanji. Including
  kana costs only about 24 KB per weight.
- **satori caches fallback fonts per font buffer.** Once a warm isolate has loaded a fallback,
  it's reused for free. This also means a test that reuses the same font ArrayBuffers can't tell
  "no fallback" from "fallback".
- **`@cf-wasm/og` fetches missing glyphs from Google Fonts by default** (and emoji from a CDN) at
  render time, unless you override `loadAdditionalAsset`.

### Bundle size and startup (`pnpm wrangler deploy --dry-run --outdir dist`)

| Worker | Total upload (the limit) | gzip | Startup |
|---|---|---|---|
| hand (incl. 0.8 MB of bundled subset fonts and the 382 KB harfbuzz wasm) | 5,681 KiB | 2,276 KiB | 49–95 ms |
| og | 2,368 KiB | 779 KiB | 46–88 ms |

Hand-wired parts: resvg wasm 2.48 MB, satori yoga wasm 0.52 MB, harfbuzz wasm 0.38 MB, JS 1.67 MB
(satori's standalone build alone is 937 KB). Both are about 10% of the 64 MiB limit, and startup is
under 10% of the 1 s limit.

### CPU time on Workers (ms, `wrangler tail`; all `n=0` (fresh isolate) unless marked)

| Variant | 1× (1080 px) | 2× (2160 px) |
|---|---|---|
| hand, subset from R2 | 4,720–8,941 (9 runs); warm `n≥1`: 3,383–6,063 | 10,609–19,769 |
| hand, full font from R2 | 5,837–8,755 | — |
| hand, subset WOFF | 5,542–9,116 | — |
| hand, subset bundled | 4,035–8,657 | — |
| **hand, opt (R2 fonts)** | **1,952–3,668** | **4,882–9,015** |
| **hand, opt, bundled fonts** | **1,803–3,424** | — |
| og, subset | 7,890–13,988 | **`exceededMemory` 4/4** (after 2.2–3.5 s) |

- **Almost every request ran in a fresh isolate**, even back-to-back requests from one client.
  Plan for cold numbers. Cold adds roughly 1 s over warm (wasm instantiation plus base64 of the
  images).
- Workers CPU is about **2× slower than this dev machine's Node** and varies about 2× between
  identical requests.
- **hand 2× (untuned) peaks near 20 s**, within the 30 s default but uncomfortably close.

### Local render time (Node 22, same code, median of 5, ms)

| Variant | Total | satori (+ satori-html) | resvg render | PNG encode | PNG size |
|---|---|---|---|---|---|
| subset 1× | 2,394 | 462 | 1,800 | 132 | 2.4 MB |
| subset 2× | 6,393 | 437 | 5,450 | 497 | 8.3 MB |
| **opt 1×** | **916** | 185 | 601 | 130 | 2.4 MB |
| **opt 2×** | **2,960** | 334 | 2,120 | 505 | 8.3 MB |
| og 1× (`@cf-wasm/og` node build) | 4,381 | | | | 2.4 MB |

**resvg rasterisation is the cost**, not satori and not fonts. With all images replaced by 1×1 px,
resvg still took 1.37 s at 1×. satori wraps **every `<img>` in its own clipPath + mask**, and
`overflow:hidden` chains a mask onto every descendant: this layout emits 675 `<mask>` elements, and
resvg composites each one as a layer.

### Making it faster ("opt", 2.5× faster locally, about 2× on Workers)

1. **Pre-size every image to the exact pixels it's drawn at, per scale** (`img/1x/…`, `img/2x/…`),
   and render with resvg `imageRendering: optimizeSpeed`. Nearest-neighbour sampling is lossless at
   1:1. Compare `samples/top50-2x-crop.png`: grades and plates stay sharp. Speed hints alone, with
   unsized images, would alias downscaled art.
2. **No `overflow:hidden` on tiles.** The jacket gets its own rounded top corners instead.
   Dropping tile borders as well saves about 35% more, but costs design.
3. The SVG shrinks from 14.4 MB to 3.7 MB (smaller data URIs), which also cuts satori-html parse time.

### Output scale and image sharpness

- **1× (1080 px wide) is the default.** It's sharp, 2–4 s of CPU, and 2.4 MB with our noisy jackets
  (0.5 MB with flat ones). Real jackets will land somewhere in between.
- **2× is optional, on demand, never the default.** It needs about 2.5× the CPU, produces 8.3 MB
  PNGs (close to Discord's ~10 MB free upload cap), and **jackets get upscaled**: the tile draws
  them 394 px wide at 2× from 300 px originals. Grades (64 → 128 px) and plates (96 → 192 px) stay
  ≤ native, consistent with `ARCHITECTURE.md` ("≤ 1× their pixel size").

### Package comparison: hand-wired wins

`@cf-wasm/og` 0.5.0 is easier to wire up, but:

- it bundles **satori 0.32.0 and resvg-wasm 2.4.1** (both old), and is **about 1.5–2× slower** than the
  untuned hand-wired setup (8–14 s CPU on Workers, 4.4 s against 2.4 s locally) and 3–4× slower than opt;
- **2× renders hit `exceededMemory` every time.** It has no scale option either: `fitTo` is forced to
  `width`, so 2× needed a CSS `transform: scale(2)` wrapper;
- satori 0.32 turns satori-html's string `width="112"` attributes into **0×0 images**. All images
  silently vanished until sizes moved into `style`;
- missing glyphs go to Google Fonts by default.

### Gotchas found (each cost real time)

- **satori 0.63 doesn't run in workerd as published.** Text shaping uses an inlined harfbuzzjs whose
  Emscripten loader reads `self.location.href` (undefined in workerd → `TypeError`, error 1101). It
  then compiles wasm from bytes, which Workers forbid. `src/hb-shim.ts` (10 lines) fixes both: it
  sets a `location`, and routes `WebAssembly.instantiate(bytes)` to the precompiled `hb.wasm` that
  `scripts/extract-hb.mjs` pulls out of satori's dist. It works, but it's fragile: **pin satori
  exactly** and keep a render smoke test. Untested alternative: a satori version from before
  harfbuzzjs was added (not bisected).
- **`satori-html`'s `html` is a tagged-template function.** `html(markupString)` iterates per
  character, which is O(n²): 0.9 s for the 74 KB layout, and it never finishes with data URIs.
  Use `html([markup])`.
- **satori defaults to `box-sizing: content-box`.** Padding and borders widened the header past the
  canvas. The layout sets `box-sizing:border-box` on every element.
- `wrangler tail --format json` gives `cpuTime` and `wallTime` per request, which is enough for this
  kind of measurement.

### Recommendation

- **Packages:** `satori` (exact pin, `satori/standalone` with `layout.wasm` imported as a module) +
  `satori-html` (`html([markup])`) + `@resvg/resvg-wasm` 2.6.2 + the harfbuzz shim. Not `@cf-wasm/og`.
- **Fonts:** Pretendard Medium + Bold, subset to KS X 1001 Hangul + jamo + Latin + kana (~405 KB OTF
  each), **bundled in the Worker**. That saves the R2 reads, with no measurable CPU difference and
  startup still under 100 ms. Fallbacks load from R2 via `loadAdditionalAsset`, only when needed:
  - a **catalog-driven CJK subset** (Noto Sans JP), regenerated by the catalog job from every
    catalog code point that Pretendard lacks. It's a few KB to tens of KB, content-hashed;
  - full Pretendard for Hangul outside KS X 1001 (rare: user-entered text).
- **Images:** the `assets-sync` job also writes **pre-sized derivatives per scale** next to the
  originals. Render with `imageRendering: optimizeSpeed` and a mask-light layout.
- **Scale:** 1× by default (exports, Discord `/top50`), 2× only as an explicit download option.
- **Where:** a Queue consumer (15 min CPU) writing `R2 exports/…`, never the request path.
  The Discord deferred reply should poll or reuse that job, not render in `waitUntil`.

### Should change in `ARCHITECTURE.md` (not edited in this PR)

- **Lines 210–213 ("Exports"):** say that renders run in a **Queue consumer** (2–4 s CPU each).
  Pin satori exactly and note the workerd harfbuzz shim. Fonts: "Pretendard subset (KS X 1001
  Hangul + Latin + kana, ~400 KB/weight) **bundled in the Worker**, with a catalog-driven CJK
  fallback subset in R2". The current "(covers Latin + Korean)" hides that it has **no kanji**.
- **Lines 197–201 ("assets-sync"):** add "and writes pre-sized derivatives for each export scale
  (`official/{mix}/{scale}x/…`)". Add that jackets are upscaled at 2× with a ~200 px tile.
- **Lines 251–253 (Discord images):** replace "render in `ctx.waitUntil`" with "enqueue the export
  job (or reuse a cached export), then edit the original response". A 2–9 s CPU render doesn't belong
  in `waitUntil`.
- **Line 288 (spike list):** mark answered.

### Follow-ups

- **Profile OG images (1200×630) weren't measured.** They should be roughly 4× cheaper (a quarter
  of the pixels, few images), but they need their own numbers before going on the request path.
- **Avatars are stored as WebP** (`ARCHITECTURE.md`, "Uploads"). Check that satori + resvg-wasm
  accept WebP; if not, store a PNG derivative for exports.
- **Memory across renders:** wasm memory never shrinks. Local Node RSS reached ~1 GB over 35
  renders. No Workers isolate here served two 2× renders in a row; test that before offering 2×.
- **Output size:** 2.4 MB at 1× is heavy for Discord and OG. Try PNG quantisation (e.g. a wasm
  `oxipng`/`imagequant` step) or JPEG/WebP encoding after resvg.
- **OFL Reserved Font Name:** a subset is a "Modified Version" and may not be *distributed* under
  the name "Pretendard". Server-side rendering doesn't distribute it. The web app should use
  Pretendard's official subset webfonts rather than serving ours.
