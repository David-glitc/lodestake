# Design systems

Six products share one HTML structure and one app runtime, but each has its own brand. The structure lives in `web/base.css`; every color, font, radius, border and shadow comes from the product's theme in `web/themes/<slug>/`:

- `theme.css`: font import, tokens, and the product's signature rules
- `logo.svg`: the mark (header and favicon)
- `hero.svg`: the landing illustration

`scripts/build.mjs` compiles each site's `style.css` as theme fonts, then `base.css`, then the theme's rules. Never put a raw color in `base.css`; add or reuse a token.

## Tokens every theme defines

| Token | Role |
|---|---|
| `--scheme` | `light` or `dark` (also picks the BOT Chain logo variant) |
| `--bg`, `--surface`, `--surface-2`, `--input-bg`, `--tile` | Page, cards, inset surfaces, form fields, game tiles |
| `--ink`, `--ink-2` | Primary and secondary text |
| `--line`, `--line-strong` | Dividers; form and control borders (≥ 3:1 on bg) |
| `--accent`, `--accent-hover`, `--accent-ink` | Brand color, its hover, and text on it |
| `--accent-text`, `--link` | Accent and link colors that pass 4.5:1 as text on bg |
| `--focus` | Focus ring (≥ 3:1 on bg and surface) |
| `--danger`, `--danger-bg`, `--danger-text` | Error border, error background, error text |
| `--scrim` | Dialog backdrop |
| `--radius-sm/md/lg/btn/pill`, `--border-w` | Shape |
| `--shadow-1`, `--shadow-2`, `--shadow-btn` | Elevation |
| `--font-display/body/label/mono` | Type families |
| `--display-weight`, `--display-tracking`, `--display-case`, `--label-tracking` | Display and label treatment |

## The six identities

| Product | Scene | Register | Palette | Type | Shape and signature |
|---|---|---|---|---|---|
| **Hedgerow** | A holder reads a basket like a fund factsheet before committing | Light, editorial | Paper `#F3EEE3`, forest `#2E5B39`, ochre focus | Fraunces / Public Sans / IBM Plex Mono | 2–6px radii, double rule under header, ruled factsheet steps, serif numerals |
| **Switchyard** | A trader swaps at night between other tabs | Dark, signage | Steel `#111315`, signal amber `#F2A93B`, cyan focus | Barlow Condensed (caps) / Barlow / JetBrains Mono | Square, hazard strip, departure-board steps, mono figures |
| **Lodestake** | A player grabs a round on a lunch break | Dark, game | Amethyst rock `#16121D`, gold ore `#F4BE48`, mint focus | Bungee / Rubik / Space Mono | 8–18px radii, 2px borders, beveled tiles and buttons |
| **Showproof** | Someone in a group chat snaps proof in daylight | Light, playful | Warm white `#FBF8F3`, coral `#C0371E`, cobalt links | Bricolage Grotesque / Figtree / DM Mono | Pill buttons with sticker shadow, taped polaroid steps, art-left hero |
| **Stepsale** | A founder sets up a careful community sale | Light, fintech | Cool white `#F5F6FA`, deep blue `#2438C8`, green focus | Sora / Manrope / IBM Plex Mono | 8–16px radii, soft elevation, rising timeline steps |
| **Tradelock** | Two collectors negotiate OTC and want to see the lock | Light, neo-brutalist | Cream `#F1EEE2`, ink `#111111`, acid lime `#C5F23A` | Unbounded / Work Sans / JetBrains Mono | Zero radius, 2px ink borders, offset shadows, lime heading markers |

## Rules

- Text pairs pass WCAG AA (4.5:1); borders, focus and state indicators pass 3:1. Check new colors with the contrast checker before shipping.
- Tradelock's lime is 1.1:1 on its page, so every edge that must read is ink, never lime.
- Theme layout overrides that change the hero grid must be wrapped in `@media(min-width:861px)` so the shared phone layout still applies.
- No emoji as icons, no gradient text, no glow effects. Personality comes from type, shape and layout.
- Light themes use `web/botchain-dark.svg`; dark themes use `web/botchain.svg`.
- `prefers-reduced-motion` disables transitions and the Showproof card tilt.
