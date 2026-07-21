# Palettes (copy-paste hex)

Two palettes, kept separate. Rendered swatches: `palette_A_…svg`, `palette_B_…svg`.

## A — Six per-archetype colour pairs
`src/data/archetypeCharacter.js:57-137` — `ARCHETYPE_CHARACTER[*].colors`, a mirror
of `avatarColors` (fenced `agentArchetypeConfig.js`). Roster accents, **not** the
mech. These are two-colour pairs, not authored SVG gradients.

| code-id | display name | color[0] | color[1] |
|---|---|---|---|
| `momentum_chaser` | Trend Follower | `#5eead4` | `#a855f7` |
| `contrarian` | Contrarian | `#a855f7` | `#ef4444` |
| `diversifier` | Diversifier | `#10b981` | `#3b82f6` |
| `degen` | Speculator | `#ef4444` | `#f59e0b` |
| `analyst` | Fundamental Investor | `#3b82f6` | `#5eead4` |
| `guardian` | Capital Preserver | `#3b82f6` | `#10b981` |

## B1 — CATEGORY_COLORS
`RuleDetailSheet.jsx:8-16` and `ForgeRuleCard.jsx:7-15` (duplicated). Rule
categories — unrelated to archetypes or the mech.

| category | hex |
|---|---|
| `technical` | `#5eead4` |
| `fundamental` | `#f59e0b` |
| `risk` | `#ef4444` |
| `allocation` | `#8b5cf6` |
| `mid_battle` | `#6366F1` |
| `game_state` | `#94A3B8` |
| `threshold` | `#e879f9` |
| `tier_strategy` | `#fbbf24` |

## B2 — MECH_BAY_TOKENS
**Not found — 0 matches repo-wide.** Does not exist at this HEAD.

## B3 — The mech's real colour engine (what actually tokenises the mech)
`src/utils/getMechColors.js:8-21`. The single mech's `primaryGlow` / `visorColor`
are derived from equipped-DNA counts, then fall back to `STANDBY` when nothing is
equipped.

| token | role | hex |
|---|---|---|
| `DNA_COLORS.instincts` | teal | `#5EEAD4` |
| `DNA_COLORS.strategy` | amber | `#F59E0B` |
| `DNA_COLORS.discipline` | red | `#EF4444` |
| `STANDBY.primaryGlow` | dim wireframe | `#718096` |
| `STANDBY.visorColor` | visor off | `#4A5568` |

Fixed mech chrome (not a palette const, but the frame's actual colours):
stroke `#E6EDF3`, body fill `#0D0E12`, dormant stroke `#2A2D35`, highlight `#FFFFFF`.
