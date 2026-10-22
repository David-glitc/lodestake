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

All six are dark (web3 register, per the owner's direction). Each keeps its own hue family, type and shape so they stay distinct.

| Product | Scene | Palette | Type | Shape and signature |
|---|---|---|---|---|
| **Hedgerow** | A DAO treasury after dark; holders read baskets like a factsheet | Forest night `#09110D`, emerald `#7FD69A`, champagne `#E8C66B` | Fraunces / Public Sans / IBM Plex Mono | 2–8px radii, ruled factsheet steps, italic champagne numerals, dot texture |
| **Switchyard** | A trader swaps at night between other tabs | Steel `#0C0E10`, signal amber `#F2A93B`, cyan lamp `#5FD3E6` | Barlow Condensed (caps) / Barlow / JetBrains Mono | Square, hazard strip, amber ticker band, rail-grid texture, departure-board steps |
| **Lodestake** | A player grabs a round on a lunch break | Amethyst rock `#120E19`, gold ore `#F4BE48`, mint `#7DE0C3` | Bungee / Rubik / Space Mono | 8–18px radii, 2px borders, beveled glowing tiles, two-scale dot texture |
| **Showproof** | A night-out photo wall; proof snapped in a group chat | Ink `#110D14`, coral `#FF6A4D`, cobalt `#93A9FF` | Bricolage Grotesque / Figtree / DM Mono | Pill buttons with coral sticker shadow, paper polaroid steps, art-left hero |
| **Stepsale** | A launch at midnight; a founder sets careful terms | Navy `#070B1C`, electric blue `#5B7CFF`, mint `#3DDC97` | Sora / Manrope / IBM Plex Mono | 8–18px radii, rising timeline steps, fine grid texture |
| **Tradelock** | An after-hours deal desk; collectors want to see the lock | Carbon `#0C0C0A`, bone `#F4F2E8`, acid lime `#C5F23A` | Unbounded / Work Sans / JetBrains Mono | Zero radius, 2px bone borders, lime offset shadows, lime heading markers and ticker |

## Hero tokens

`--hero-bg` (glow mesh), `--hero-pattern`, `--hero-pattern-size`, `--hero-pattern-opacity` (texture, masked to the hero centre), `--chip-bg`, `--live`, `--live-ring` (status chip), `--art-glow` (blur behind the hero art), `--ticker-bg` (scrolling band). The same mesh sits softly behind the app page header.

**Recorded override:** the UI guidelines list glow meshes as a generic default. They are used here deliberately at the owner's request for a web3 aesthetic, kept to the hero and app header, with all text on solid dark surfaces so contrast is verifiable.

## Rules

- Text pairs pass WCAG AA (4.5:1); borders, focus and state indicators pass 3:1. Check new colors with the contrast checker before shipping.
- Tradelock edges that must read are bone (`--ink`); lime marks state and emphasis.
- Theme layout overrides that change the hero grid must be wrapped in `@media(min-width:861px)` so the shared phone layout still applies.
- No emoji as icons and no gradient text. Glow is limited to the hero, app header, hero art and primary game buttons; body sections stay solid.
- Light themes use `web/botchain-dark.svg`; dark themes use `web/botchain.svg` (all six are currently dark).
- `prefers-reduced-motion` disables transitions, the ticker, the floating hero art, the status pulse and the Showproof card tilt.
