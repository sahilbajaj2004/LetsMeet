# Design

Visual system for LetsMeet. Aesthetic lane: **live-signal dark** — a near-black
"control room" canvas carrying one committed signal-green that behaves like an
on-air tally light. Color strategy: **Committed** (one saturated color does the
emotional work; everything else is neutral). Dark is the default theme; a light
theme is a first-class, persisted toggle.

## Color

All values OKLCH. Tokens are defined per theme in `app/globals.css` and exposed to
Tailwind v4 via `@theme inline` as `--color-*` utilities.

### Dark (default)

| Role | Token | OKLCH | Use |
|---|---|---|---|
| Canvas | `--canvas` | `oklch(0.145 0.006 150)` | page background (whisper of green, near-black) |
| Surface | `--surface` | `oklch(0.185 0.008 150)` | panels, cards, raised sections |
| Surface-2 | `--surface-2` | `oklch(0.225 0.01 150)` | hovers, deeper insets |
| Border | `--border` | `oklch(0.30 0.012 150)` | hairlines, dividers |
| Ink | `--ink` | `oklch(0.97 0.005 150)` | primary text (~17:1 on canvas) |
| Muted | `--muted` | `oklch(0.74 0.012 150)` | secondary text (≥ 4.5:1) |
| Faint | `--faint` | `oklch(0.58 0.012 150)` | tertiary / mono labels (large only) |
| **Live** | `--live` | `oklch(0.87 0.21 128)` | THE accent — CTAs, on-air dot, pulses |
| Live-deep | `--live-deep` | `oklch(0.80 0.19 132)` | hover / pressed |
| On-live | `--on-live` | `oklch(0.16 0.03 150)` | text on a live-green fill |

### Light (toggle)

| Role | OKLCH | Notes |
|---|---|---|
| Canvas | `oklch(0.99 0.003 150)` | near-white, faintest green |
| Surface | `oklch(0.965 0.006 150)` | |
| Surface-2 | `oklch(0.93 0.008 150)` | |
| Border | `oklch(0.88 0.01 150)` | |
| Ink | `oklch(0.20 0.02 150)` | ~13:1 on canvas |
| Muted | `oklch(0.44 0.02 150)` | ≥ 4.5:1 |
| Faint | `oklch(0.55 0.02 150)` | |
| Live | `oklch(0.62 0.16 132)` | darkened so green text/links pass on white |
| Live-deep | `oklch(0.55 0.15 134)` | hover |
| On-live | `oklch(0.99 0.01 150)` | text on green fill |

Contrast verified for body (≥4.5:1) and large/UI (≥3:1) in both themes.

## Typography

One family, weight + size contrast (stronger than a timid pairing) plus a mono for
honest technical data only.

- **Display + body:** **Geist** (`next/font/google`). Headlines at 600–700, tight
  tracking (≥ -0.03em, never below -0.04em). Body 400–500.
- **Data / labels:** **Geist Mono** — reserved for real technical metadata
  (`P2P MESH · 4 PEERS · NO SERVER`, room codes, status). Never decorative.
- Scale: fluid `clamp()`, ratio ≥ 1.25. Hero display max ≤ 6rem.
- Dark mode line-height bumped +0.05 (light type reads lighter).
- `text-wrap: balance` on h1–h3; body capped 65–75ch.

## Layout

- Full-viewport hero (`100dvh`), nav overlaid. One dominant idea per fold.
- Asymmetric compositions; the mesh visual and headline share an off-center balance.
- Fluid spacing via `clamp()`; vary rhythm (generous section breaks, tight groups).
- No identical card grids. Capabilities use a varied, content-led layout.
- Semantic z-index scale (nav < sticky < overlay < toast).

## Imagery / Visual

- **Hero centerpiece:** a custom-rendered **K4 mesh** — 4 peer nodes, 6 edges
  (complete graph = the literal P2P topology), with signal pulses traveling the
  edges. SVG structure + `requestAnimationFrame` for pulses. Decorative
  (`aria-hidden`) with a text equivalent adjacent.
- No stock people photos (anti-Zoom). The diagram-as-truth is the imagery.

## Motion

- **Live, not loud.** Hero mesh pulses continuously but subtly. Section reveals are
  short, eased (`ease-out` exponential), staggered per list, enhancing
  already-visible content (never gating it).
- Every animation has a `prefers-reduced-motion: reduce` path → static legible state.
- No bounce/elastic. Materials: opacity, transform, blur/glow on the live accent only.

## Components

- **Live button** (primary CTA): live-green fill, `--on-live` text, subtle glow ring.
- **Ghost button**: border + ink, surface-2 hover.
- **On-air dot**: small live-green disc with a soft pulsing halo; the logo mark.
- **Theme toggle**: icon button, persists to `localStorage`, no-flash inline script.
- **Mono pill**: faint-bordered label for technical metadata.
