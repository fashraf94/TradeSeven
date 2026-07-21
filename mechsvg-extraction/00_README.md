# MechSVG Asset Extraction

Read-only extraction of `src/components/Forge/MechSVG.jsx` into standalone SVG
assets for Design. **No product file was edited.** Every claim below is marked
**VERIFIED** (code read this session at the cited `path:line`) or **ASSUMED**.

- Branch: `claude/mechsvg-asset-extraction-ecz115`
- HEAD at extraction: `7b42bacd` (= `origin/main` after `git fetch origin`)
- Source of record: `src/components/Forge/MechSVG.jsx` (478 lines)

---

## Executive verdict

The brief describes a **multi-frame, archetype-keyed mech with build-channel
overlay layers, SVG gradients, and a `MECH_BAY_TOKENS` palette.** That mech does
not exist in this codebase. What ships is **one archetype-agnostic wireframe
mech** whose colour is computed from equipped-DNA counts, not archetype.

| # | Brief assumes | Reality in repo | Delivered here |
|---|---|---|---|
| 1 | N archetype base frames in `MechSVG.jsx`, keyed on archetype IDs | **0 archetype frames.** One generic mech, no `archetype` prop, no archetype branch anywhere | The **1** real frame, hero+idle |
| 2 | Export each frame | There is exactly one | `frames/` (1 SVG) |
| 3 | Overlay `<g>`: armor, sensors, agility, targeting, adaptive | **None exist.** Groups are anatomical (platform, arms, legs, torso, head…) | `overlays/` (6 anatomical SVGs) |
| 4a | Six per-archetype **gradients** | Exist as six **two-colour pairs** in `archetypeCharacter.js` (not SVG gradients, not on the mech) | `palettes/palette_A…svg` |
| 4b | `CATEGORY_COLORS` / `MECH_BAY_TOKENS` | `CATEGORY_COLORS` exists (rule categories). **`MECH_BAY_TOKENS`: 0 matches repo-wide** | `palettes/palette_B…svg` |
| 5 | breathing 4s / visor-pulse 3s / equip 1.5s | breathing 4s ✅ exact. **No 3s visor pulse.** equip = 0.8s bounce + 1.5s happy-face hold | `ANIMATION_SPEC.md` |

Also: **`FORGE_MECH_BAY_SPEC.md` referenced in the brief does not exist at this
HEAD** (glob + content grep both empty). ASSUMED it is an out-of-tree or planned
doc. The "legacy names" it is said to contain (*Momentum Chaser*, *Degen*) are
present only as **code-ids** (`momentum_chaser`, `degen`) and combo labels, not
as a mech spec.

Nothing here is fabricated to fit the brief: the folder contains exactly what the
source produces, faithfully transcribed, plus this gap analysis so Design knows
what is real before building against it.

---

## 1 — Base-frame inventory (the questions, answered)

**How many archetype base frames exist in `MechSVG.jsx`?**
**Zero.** `MechSVG` is a single parametric component (`MechSVG.jsx:15-20`). It
takes `state`, `size`, `primaryGlow`, `visorColor`, `mode`, `glowIntensity` — but
**no `archetype` prop**, and there is no `switch`/map on any archetype id in the
whole 478-line file. One body geometry renders for everyone. **VERIFIED.**

**Which archetype IDs do they key on — the current six or the legacy names?**
**Neither — the mech keys on no archetype at all.** Its colour comes from
`primaryGlow`/`visorColor`, computed upstream by `getMechColors(slotUsage)` from
**equipped-DNA counts** (`instincts` / `strategy` / `discipline`), not archetype
(`getMechColors.js:23-47`, consumed at `ForgeScreen.jsx:112` → `:412`). **VERIFIED.**

For the record, the archetype system elsewhere keys on **legacy code-ids**, which
the UI displays as the current six (`archetypeDisplay.js:18-25`) — so the brief's
"current six *or* legacy names" is a false split; they are the **same six**, id vs
label:

| code-id (stable, used in code) | display name (user-facing) |
|---|---|
| `momentum_chaser` | Trend Follower |
| `contrarian` | Contrarian |
| `diversifier` | Diversifier |
| `degen` | Speculator |
| `analyst` | Fundamental Investor |
| `guardian` | Capital Preserver |

Roster order `archetypeCharacter.js:50`; names `archetypeDisplay.js:18-25`. **VERIFIED.**

**What renders for an archetype with no frame?**
There is no per-archetype frame to be missing, so **every archetype renders the
identical mech.** The real "empty" states are colour/opacity, not a fallback frame:
- **No DNA equipped / `slotUsage` null →** `getMechColors` returns `STANDBY`:
  dim grey mech, `primaryGlow #718096`, `visorColor #4A5568`, `glowIntensity 0`
  (`getMechColors.js:14-21, 34`). **VERIFIED.**
- **No agent →** `ForgeScreen` passes `state="dormant"` (`ForgeScreen.jsx:413`),
  which sets `opacity 0.3` and greys strokes to `#2A2D35` (`MechSVG.jsx:9, 30`).
  **VERIFIED.**

---

## 2 — Frames  → `frames/`

| file | source | state | size |
|---|---|---|---|
| `mech_base_frame__hero_idle.svg` | `MechSVG.jsx` hero branch (`:225-476`) | idle | hero (viewBox `0 0 200 280`, drawn 280×392) |

Idle-state values inlined (from `STATES.idle`, `MechSVG.jsx:10`): `opacity 1`,
glow on. Hero default colours (no prop override): stroke `#E6EDF3`, accent/visor
`#5EEAD4`, body fill `#0D0E12`. Both glow filters (`teal-glow` σ2.5,
`core-glow` σ3) inlined. Blink / happy / thinking expression variants are
`opacity 0` at idle, so they are omitted from the static export and documented in
`ANIMATION_SPEC.md` instead.

---

## 3 — Group overlays  → `overlays/`

⚠️ The brief's channels **armor / sensors / agility / targeting / adaptive do not
exist** in `MechSVG.jsx` or in the static `mech-artwork-v2.svg`. The only
"adaptive" hit in the repo is a trait tag (`traitLibrary.js:249`). There is **no
build-vs-archetype channel split in the SVG** — that split lives in *data*
(equipped DNA → colour via `getMechColors`), and archetype does not drive the
mech render at all.

What is actually separable is the **anatomical** group tree (ids verbatim from
`MechSVG.jsx`, mirrored in `mech-artwork-v2.svg`). Each is exported **in place**
(same `0 0 200 280` viewBox) so stacking them in source order reconstructs the
frame:

| file | group id | `MechSVG.jsx` | contains |
|---|---|---|---|
| `overlay_platform.svg` | `platform` | `:266` | dashed ground ellipse |
| `overlay_plant-in-boot.svg` | `plant-in-boot` | `:278` | the little sprout |
| `overlay_arms.svg` | `arms` | `:286` | both arms |
| `overlay_legs.svg` | `legs` | `:306` | both legs |
| `overlay_torso.svg` | `torso` | `:320` | chest, belt, neck, `chest-framing` (`:329`, the corner "targeting" brackets), `power-core` radar (`:336`) |
| `overlay_head.svg` | `head` | `:365` | helmet, goggles, `antenna` (`:367`), `eyes` (`:386`), `mouth` (`:457`) |

The closest thing to a "targeting" motif is `chest-framing` + the radar
`power-core` inside `torso` — but they are static accent geometry, not a toggled
overlay channel.

---

## 4 — Palettes  → `palettes/`  (kept clearly separate)

**A · Six per-archetype colour pairs** — `palette_A_archetype_gradients.svg`
Source `archetypeCharacter.js:57-137` (`ARCHETYPE_CHARACTER[*].colors`), a mirror
of `avatarColors` in the fenced `agentArchetypeConfig.js`. Used as accents on the
Forge Character roster (`CharacterArea.jsx`, e.g. `arch.colors[0]`) — **not** to
colour the mech. Rendered as a real gradient + both solid chips per archetype.

**B · `CATEGORY_COLORS` + the mech's real colour engine** —
`palette_B_category_and_mech_colors.svg`
`CATEGORY_COLORS` (8 rule categories) is duplicated at `RuleDetailSheet.jsx:8-16`
and `ForgeRuleCard.jsx:7-15`. **`MECH_BAY_TOKENS` has 0 matches repo-wide** — it
does not exist; the panel notes this and instead shows what actually tokenises the
mech: `DNA_COLORS` + `STANDBY` from `getMechColors.js:8-21`.

Copy-paste hex tables for both palettes: `palettes/palettes.md`.

---

## 5 — Animations → `ANIMATION_SPEC.md`

Text spec (no Framer Motion needed): breathing (4s, exact), plus the real timings
for the visor/equip behaviours — which differ from the brief — and the blink,
brightness-surge, and reactive-bounce behaviours. See the file.

---

## How to view / regenerate

- **View:** open any `.svg` directly in a browser — each is self-contained
  (filters + colours inlined, no React, no external refs). A dark backdrop rect
  (`#0B0D11`) is included **only** so the light strokes read on their own; it is
  not part of the component.
- **Verified:** all 9 SVGs pass `xmllint --noout`, contain no dangling
  `url(#id)` and no external fetch (only the required `xmlns`), and were rendered
  in headless Chromium during extraction.
- **Regenerate:** `python3 _generate.py` (provenance tool; transcribes the idle
  values above — it does not import or touch any product file).
