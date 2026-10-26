# Pump It Up domain reference

Terms and rules this project needs. Most of it comes from the PIU Scores tracker
(DrMurloc/PumpItUpScoreTracker, MIT), whose maintainers checked the formulas
against the official site. Read their `docs/DOMAIN.md` for the full version. This file is
the part we depend on.

## Game basics

- **Pump It Up (PIU)**: Andamiro's five-panel dance arcade series.
- **Mix**: one release of the game. The ones that matter:
  - **Phoenix** (2024). Site: `https://phoenix.piugame.com` (moved there when Phoenix 2 went live).
  - **Phoenix 2**. Site: `https://piugame.com`, live since 2026-07-01. Phoenix and Phoenix 2 run
    **in parallel**. They share charts, but levels, grade cutoffs and rating formulas differ per mix.
    **Every score and every derived number must be keyed by mix.**
  - **XX** and earlier are legacy. They use combo-based scoring with no 1M scale. Out of scope for v1.
  - **RISE** is a PC/Steam game with no official score site. Out of scope.
- **Version**: a patch within a mix (e.g. `1.01.0`). A chart has a debut version per mix. The
  "filter by version" feature uses this.
- **Channel**: the song-select folder (Original, K-Pop, World Music, J-Music, Xross). Stored per
  song *per mix*: Phoenix 2 merged J-Music into World Music.
- **Song**: title, artist, BPM (can be a range), duration, song type (Arcade / ShortCut / FullSong / Remix).
- **Chart**: a song + chart type + level + step artist. Types: **Single (S)**, **Double (D)**,
  **Co-op (CO-OP ×2–×5)**, **Half-Double (HD)**, plus legacy Single/Double Performance. Displayed as `S20`, `D24`.
  - UCS (user-created steps) also show up on the official site. They are not official charts: skip them on import.
  - One known oddity: *1948 D29* renders as a `??` level ball on the Phoenix 2 site. Treat it as 29.

## Scoring (Phoenix-family)

**Score formula** (0–1,000,000, accuracy-based):

```
score = floor( (0.995 × (P + 0.6·Gr + 0.2·Go + 0.1·B) + 0.005 × maxCombo) / totalNotes × 1,000,000 )
```

Combo only counts for 0.5%, and no official page reports max combo. You can solve for max combo
from the score plus the judgement counts (see PIU Scores' `PhoenixComboSolver`).

**Judgements**: Perfect, Great, Good, Bad, Miss.

**We store judgements, but they are optional.** The official best-score list has no judgements.
Only `recently_played.php` (the last ~50 plays) has them. So most historic PBs will never have
any. The rules (the same as PIU Scores' API):

- The five counts and `maxCombo` are **all present or all null**. `maxCombo` is solved from the
  score + counts, never scraped.
- When counts are present, **check them**: recompute the score from them and reject a mismatch.
  Their sum should equal the chart's note count (log a mismatch; don't drop the play).
- Judgements are **not part of the score ID hash**. If a play first arrives without counts (best
  list) and later with them (recent plays), merge the counts into the existing play rather than
  creating a new one. This avoids Tachi's "clobbering" problem.
- A judged pass whose chart has an unknown note count can fill in `note_count` (never from a PG,
  whose counts can't vouch for anything).

### Letter grades: cutoffs differ per mix

| Grade | Phoenix floor | Phoenix 2 floor |
|---|---|---|
| SSS+ | 995,000 | 995,000 |
| SSS | 990,000 | 990,000 |
| SS+ | 985,000 | 985,000 |
| SS | 980,000 | 980,000 |
| S+ | 975,000 | 975,000 |
| S | 970,000 | 970,000 |
| AAA+ | 960,000 | 960,000 |
| AAA | 950,000 | 950,000 |
| AA+ | 925,000 | 940,000 |
| AA | 900,000 | 920,000 |
| A+ | 825,000 | 900,000 |
| A | 750,000 | 800,000 |
| B | 650,000 | 700,000 |
| C | 550,000 | 600,000 |
| D | 450,000 | 500,000 |
| F | 0 | 0 |

Phoenix 2's C/D floors are working values, not confirmed: no score that low has been seen on any board.

### Plates (pass only, strictest first)

| Plate | Short | Rule |
|---|---|---|
| Perfect Game | PG | 0 non-Perfects |
| Ultimate Game | UG | 0 Goods + Bads + Misses |
| Extreme Game | EG | 0 Bads + Misses |
| Superb Game | SG | 0 Misses |
| Marvelous Game | MG | ≤ 5 Misses |
| Talented Game | TG | ≤ 10 Misses |
| Fair Game | FG | ≤ 20 Misses |
| Rough Game | RG | anything else |

### Pass / fail states

- **Pass**: graded, can have a plate.
- **Broken**: a failed but *finished* attempt. The lifebar emptied at some point, but every note
  was judged, so the score is real. It has no plate, and its grade art has an `x_` prefix.
- **Stage break**: interrupted before the last note. It has no grade, and the score shown is a
  running partial. **Never store it as a score.**

### Personal best (PB) merging

- A pass always beats a broken attempt. Between passes, the higher score wins.
- **On Phoenix / Phoenix 2 the game's best-score card keeps score and plate separately**, so they
  can come from different plays: an SS+ SG followed by an SSS MG shows as **SSS SG**. Tachi
  generalises this as "PB = best score ∪ best lamp" (see `reference/tachi.md`). Do the same: store
  every play, and derive the PB by taking the best of each field.
- Score dates on the Phoenix 2 best list can carry the date of the chart's *first* play. Don't use
  them as a sync cursor.

## Rating: PUMBILITY

The official player rating. **Top 50 charts**, summed. **The formula differs per mix.**

### Phoenix

- Per chart: `BaseRating(level) × gradeModifier`. Plates don't affect it.
- `BaseRating(L) = L < 10 ? 0 : 100 + 5·(L−10)·(L−9)`
- Grade modifiers: F 0.4, D 0.5, C 0.6, B 0.7, A 0.8, A+ 0.9, AA 1.0, AA+ 1.05, AAA 1.10,
  AAA+ 1.15, S 1.20, S+ 1.26, SS 1.32, SS+ 1.38, SSS 1.44, SSS+ 1.50.
- One combined top-50 across Singles and Doubles. Co-op had a flat base of 2000.

### Phoenix 2

These values come from the official breakdown page (`my_page/pumbility.php`), matched to the cent.

- Per chart: `Base(pricedLevel) × (gradeMultiplier + plateBonus)`. The bonus is **added**, not multiplied.
- `Base(L) = 130 + 5·L + 5·max(0, L−24)`
- **Singles are priced one level up** (an S17 uses `Base(18)`). Doubles use their printed level.
- Charts below level 10, co-op, half-double, UCS and broken plays contribute **0** to PUMBILITY.
- **Total** = one merged top-50 across S+D. **Singles** and **Doubles** ratings are separate
  per-type top-50 pools. Total ≠ Singles + Doubles.
- Grade multipliers:

| Grade | Doubles (shared) | Singles |
|---|---|---|
| SSS+ | 1.50 | 1.50 |
| SSS | 1.49 | 1.49 |
| SS+ | 1.48 | 1.48 |
| SS | 1.47 | 1.47 |
| S+ | 1.46 | 1.46 |
| S | 1.45 | 1.45 |
| AAA+ | 1.43 | 1.43 |
| AAA | 1.41 | 1.41 |
| AA+ | 1.39 | 1.39 |
| AA | 1.37 | 1.36 |
| A+ | 1.35 | 1.33 |
| A | 1.30 | 1.28 |
| B | 1.25 | 1.20 |
| C | 1.20 | 1.10 |
| D | 1.10 | 1.00 |
| F (pass) | 1.00 | 0.90 |

- Plate bonuses: RG 0, FG 0.002, TG 0.004, MG 0.006, SG 0.008, EG 0.012 (Singles **0.014**),
  UG 0.016 (Singles **0.017**), PG 0.020.
- `Base(28)` and `Base(29)` are extrapolated: no 28 or 29 has ever been in anyone's top 50.
- **Co-op Rating** is a separate number: the sum over **every** co-op chart (not a top 50) of
  `80 × (grade + plate)`.

> These constants were reverse-engineered and have been corrected several times. Keep them in
> one data table with tests, and treat the official `pumbility.php` page as the source of truth.
> If the user scrapes that page, compare our computed numbers against it.

## Other community concepts (optional later)

- **Titles**: unlocked on the official site (e.g. PUMBILITY gem tiers, `[S]`/`[D]`/`[CO-OP]`
  tiers). They can be scraped from `my_page/title.php`. Needed for the profile's "favorite titles".
- **Tier lists / scoring difficulty**: community-derived difficulty that differs from the
  printed level. PIU Scores publishes these through its API.
- **Sessions**: group plays by time gaps. Tachi uses a 2-hour gap. PIU Scores groups imports
  with an 8-hour gap.
