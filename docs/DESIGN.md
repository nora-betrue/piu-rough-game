# Design system

The visual language for Rough Game. Tokens live in one place: `apps/web/src/routes/layout.css`.
A living reference is at `/design` in the running app (`pnpm --filter web dev`).

## Principles

Reference: an engineering-simulation dashboard (dark charcoal panels, lime-green accent, "heat" data colours).

- **Black and lime.** Near-black backdrop with a dotted grid, charcoal panels with soft gradients and
  large radii (1.5rem), pill-shaped controls. Lime green is the brand and the primary action.
- **Heat gradient for data.** Pink → yellow → green → cyan (`--heat`) is reserved for data (legends,
  charts, ratings), like the velocity bar in the reference. It's not for decoration.
- **Dark by default, light supported** through `prefers-color-scheme`. Every colour is a CSS variable
  with a light override, so components never hard-code colours.
- **Content first.** Charts, grades and plates are the visual interest; chrome stays quiet.
- **No Andamiro art in the repo.** Placeholder jackets are gradients; plates are our own CSS badges
  (the "fallback theme" in `ARCHITECTURE.md`). Official art is mirrored from R2 at runtime.

## Tokens

| Group | Tokens |
|---|---|
| Surfaces | `bg`, `surface`, `raised`, `line` |
| Text | `fg`, `muted` |
| Brand | `green` (accent), `lime` (gradient end) |
| Data / heat | `pink`, `yellow`, `green`, `cyan` |
| Plates | `plate-rg` … `plate-pg`, one per plate, weakest to strongest |

Tailwind utilities come from `@theme inline`: `bg-surface`, `text-muted`, `border-line`,
`text-plate-sg`, `shadow-glow`, `rounded-card`.

## Type

Pretendard (Latin + Korean) first, then system fonts. Self-hosting the subset is still to do
(`ARCHITECTURE.md`, "i18n"), so for now it only applies if the user has it installed.

## Components (`apps/web/src/lib/components/`)

`Button` (primary / secondary / ghost, md / lg, renders `<a>` when given `href`),
`Card`, `PlateBadge`, `Logo`, `LocaleSwitcher`.

## Rules

- Every user-visible string is a Paraglide message (`apps/web/messages/*.json`). The `/design` page is
  the one internal exception.
- Links go through `resolve(localizeHref(...))` so they stay locale-aware.
- Plate names, grades and judgements are not translated.
- Test new UI at 390px wide and in both colour schemes.
