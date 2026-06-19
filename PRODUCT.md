# Product

## Register

brand

> The marketing surface (landing page) is `brand` — design IS the product there.
> The in-app surfaces (room, dashboard, waiting room) are `product` and should be
> treated with the product register when worked on. Default above is set for the
> landing page, which is the current focus.

## Users

Two audiences meet on the same link:

- **Hosts** — someone who needs a quick, private 1-to-4 person video room and
  sends a link. Often technical or privacy-conscious; values that the call is
  peer-to-peer and that no media server sits in the middle.
- **Joiners (members + guests)** — anyone who opens a room link. May be logged in
  (Google) or a guest typing a display name. They land in a waiting room until the
  host lets them in.

Context of use: short, ad-hoc calls. Desktop and mobile browsers. The decision the
landing page must win: "this is a small, private, no-friction room — start one now."

## Product Purpose

LetsMeet is a Google-Meet-style video room capped at 4 participants, built on a
peer-to-peer WebRTC mesh — video/audio travels browser-to-browser, never through a
media server. Hosts create expiring rooms; everyone passes through a waiting room;
hosts can accept/decline, mute, kick, and end the call. Screen share is one-at-a-time.

Success for the landing page = a visitor immediately understands it is *small,
private, and peer-to-peer*, and starts (or links) a call without reading a manual.

## Brand Personality

Precise · live · unguarded.

The voice is an engineer who respects you: plainspoken, concrete, no enterprise
fluff. It states how the thing actually works (P2P mesh, 4 peers, no server) because
the architecture *is* the value proposition. Calm confidence over hype. The emotional
goal is **trust through transparency** — you can see the connection, so you believe it.

## Anti-references

- **Zoom / Google Meet corporate SaaS** — friendly-blue, rounded, grid-of-smiling-stock-faces, enterprise procurement tone.
- **AI-purple dark-tech** — violet gradients, glowing mesh orbs, glassmorphism on everything. The default "dark AI tool" look. Banned.
- **Generic 3-feature-card SaaS** — hero + three identical icon cards + pricing tiers. No identical card grids.
- **Loud / overstimulating** — busy motion, neon overload, gimmickry. Distinctiveness comes from precision, not noise.

## Design Principles

1. **Show the architecture.** The hero visualizes the real 4-peer mesh topology. The product's honesty (P2P, no server) is the design's centerpiece, not a footnote.
2. **Live, not loud.** One signal-green accent behaves like an on-air tally light. Motion is purposeful (a connection pulsing), never decorative churn.
3. **Plain technical truth as copy.** Say "no media server," "4 peers," "browser to browser." Concrete claims beat adjectives.
4. **Restraint is the flex.** Near-black canvas, one committed color, generous space. Ambition lives in the concept and the craft, not in clutter.
5. **Earn trust on the first fold.** A visitor should grasp small + private + peer-to-peer before scrolling.

## Accessibility & Inclusion

- WCAG 2.1 AA: body text ≥ 4.5:1, large text ≥ 3:1, in both themes. The signal-green
  is bright enough for large text/UI on dark; for light theme it darkens for text use.
- Dark default with a persisted, no-flash theme toggle (light + dark both first-class).
- `prefers-reduced-motion`: the mesh and all reveals drop to a static, fully-legible
  state — content is never gated behind animation.
- Keyboard-operable controls with visible focus rings; the mesh visual is decorative
  and `aria-hidden`, with a text equivalent of its meaning nearby.
