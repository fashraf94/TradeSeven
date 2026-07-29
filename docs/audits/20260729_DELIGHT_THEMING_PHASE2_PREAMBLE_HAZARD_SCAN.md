# Delight Layer — Task 1, Phase 2 Preamble: Pilot Hazard Re-Scan

**Date:** July 29, 2026
**Spec:** DELIGHT LAYER ARC — Task 1: Theming Foundation, V2 (LOCKED), §5 Phase 2 preamble
**Rulings applied:** R-S1 (pilot selection), R-S5, R-S9, R-A2w
**Branch:** `claude/delight-theming-foundation-jzr3nj` @ `6c37ae93`
**Scope:** read-only. Three files, hazard classes H1–H7.
**Verdict:** **NO HARD STOP.** The spec's trigger — *"a hazard requiring a visible change or a helper rewrite to proceed"* — is not met. Migration proceeds on 7 literals. Two dispositions flagged for ratification, both resolved toward the zero-risk null action.

---

## 0. Why this scan exists

The discovery hazard map (H1–H7) was built on `DashboardLoop.jsx` / `DashboardDesktop.jsx` / `HoloCard.jsx`, which R-S1 established are dead code. This re-scan rebuilds it against the surfaces that actually ship. Anchors verified this session at `6c37ae93`; upstream `origin/main` has moved to `de98dcdf`, but its only change was `src/config/featureFlags.js` and the `COMMAND_DASHBOARD_*` flags were not among it — R-S1's premise holds.

---

## 1. Headline

| File | Lines | Hex | rgba | Migratable | Note |
|---|---:|---:|---:|---:|---|
| `Dashboard/CommandDashboard.jsx` | 542 | 4 | 2 | **3** | Framer Motion present, no color-bearing props |
| `Dashboard/CommandDashboardDesktop.jsx` | 299 | **0** | **0** | **0** | No color literals at all; no Framer Motion |
| `DesktopBackground.jsx` | 209 | 17 | 8 | **4** | 3 further sites deferred on the SVG hazard |
| **Total** | 1,050 | 21 | 10 | **7** | |

**The structural fact behind those numbers:** both shipping dashboards are already tokenized — through `CMD` (`src/components/Dashboard/commandUI.jsx:16-33`), not through raw hex. `CommandDashboardDesktop.jsx` draws every colour from `CMD.*` or the runtime `accent`, so it contains **zero** hex or rgba literals. Migrating `CMD.*` identifiers is explicitly out of scope: spec §2 forbids identifier-keyed migration, and R-S5 re-points the legacy JS systems opportunistically *after* Task 1.

This is reported as scope arithmetic, not as an objection to R-S1. The Phase 2 migration rule — *"replace hex literals where the literal exactly matches a locked token value; literals matching no token stay untouched"* — is fully satisfiable as written, and the 7 sites do exercise both target patterns: `cssVar()` in an inline style, and `rgba(var(--ft-*-rgb), α)` at a literal site (the D7/R-S9 pattern).

---

## 2. Hazard classes

### H1 — helper calls on hex: **PRESENT, and worse than D-6 recorded**

`CommandDashboard.jsx` calls `alpha()` at 13 sites (`:95, :258, :293 ×3, :294 ×2, :339 ×2, :346, :413, :464 ×2`). Per R-S9 these stay hex; no action. But two things must be recorded:

**(a) The failure modes, read from source this session:**

| Helper | Definition | Behaviour on a `var()` string | Visible result |
|---|---|---|---|
| `alpha(hex, a)` | `commandUI.jsx:38-45` | `parseInt('var(--ft-cyan)', 16)` → `NaN` → returns `rgba(94,234,212,a)` | **Silently turns teal** |
| `readableOn(hex)` | `commandUI.jsx:48-56` | `!hex.startsWith('#')` → returns `CMD.bg` (`#0D0E12`) | **Button label silently turns near-black** |

Both fail with no throw, no warning and no test failure — the H1 signature.

**(b) `readableOn` widens defect D-6's scope.** D-6 was filed as "31 implementations" — 5 `alpha()` + 26 `hexToRgba()`. `readableOn` is a **third** helper family that parses hex the same way, and it is load-bearing for button legibility at `CommandDashboard.jsx:365, :368, :392, :395`. The helper-consolidation follow-on must cover it. *No fix here — D-6 stays filed (§2 non-goals).*

**(c) Note for the future, not for now:** `accent` derives from `agent?.primaryColor` (`CommandDashboard.jsx:126`, `CommandDashboardDesktop.jsx:80`) — a Firestore value — and is fed straight into `alpha()` and `readableOn()`. Any future accent-customization UI that writes a non-hex value there inherits both failure modes above. Relevant to the eventual accent-picker task; nothing to do in Task 1.

### H2 — Framer Motion colour interpolation: **PRESENT but CLEAR**

`CommandDashboard.jsx` imports `motion` (`:18`) and uses it at `:90-97` (`motion.div`), `:357`/`:384` (`motion.button` with `whileTap`), plus `containerVariants` (`:73`) and `sectionVariants` (`:74-77`).

Every animated property is `scale`, `opacity` or `y`. **No colour value flows into any `animate`, `whileHover`, `whileTap`, `variants` or `transition`.** The colour-bearing values at `:95` (`background`, `boxShadow`) sit in the sibling `style` prop, which is not interpolated — so they would be safe even if migrated. `CommandDashboardDesktop.jsx` and `DesktopBackground.jsx` import no motion at all.

The discovery-era H2 instances (`DashboardDesktop.jsx:459`, `DashboardBattleCard.jsx:381`) are **not** in this pilot's tree. `DashboardBattleCard` is rendered only by the dead `DashboardLoop`/`DashboardDesktop`.

### H3 — prop-drilled colour objects: **PRESENT, large, but out of scope**

`accent` is threaded to 12+ children from mobile (`AgentOrb :307`, `EquipStation :452`, `DeployStation :473`, `ManageStation :478`, `ReviewStation :486`, `EvolutionPreviewCard :492`, `AgentRecordSheet :506`, `ScoutingBoardSheet :518`, `DeployCeremony :530`, `HoldToDeployButton :373/:421`, `LoopRail :279`, `SectionLabel :288`) and to 10+ from desktop.

`accent` is a **runtime Firestore value, not a token**, and nothing in Phase 2 changes it — so the blast radius is not activated. Recorded because it *is* the blast radius for any future change to `accent`'s `CMD.teal` fallback: a var() string there would reach every one of those children, several of which call `alpha()`/`readableOn()`.

### H4 — `...style` injection channels: **CLEAR**

No pilot file receives and spreads an external colour-bearing `style`. `HoldToDeployButton` receives a `style` prop *from* the dashboard (`:381`) — outbound, layout-only (`flex`, `padding`, `borderRadius`, `fontSize`, `gap`), no colour.

### H5 — light-mode hues on dark surfaces: **CLEAR**

No `LIGHT_TOKENS` value appears in any pilot file. The discovery-era instances (`rgba(217,119,6,…)`, `#0d9488`) were in the dead files and their child, not here.

### H6 — tokenless rgba: **PRESENT, correctly handled by rule**

Of 10 rgba literals, 4 map to locked triplets and 6 do not:

| Literal | Site | Token | Action |
|---|---|---|---|
| `rgba(255,255,255,0.06)` / `…0.02)` | `CommandDashboard.jsx:319` | `--ft-scrim-rgb` | **migrate** |
| `rgba(0, 217, 255, 0.07)` | `DesktopBackground.jsx:67` | `--ft-cyan-rgb` | **migrate** |
| `rgba(139, 92, 246, 0.07)` | `DesktopBackground.jsx:68` | `--ft-purple-rgb` | **migrate** |
| `rgba(0, 255, 136, …)` ×4 | `:27, :28, :69` | none (`#00ff88`) | leave |
| `rgba(255, 71, 87, …)` ×3 | `:31, :32, :70` | none — `#ff4757` is an R-S9 orphan, "never tokens" | leave |

### H7 — dead paths: **CLEAR of new findings**

`DesktopBackground.jsx:4` still early-returns `null` on mobile, so mobile has no background layer — already recorded as a Task 2 born-correct fact (§9). Flag-gated branches (`SCOUTING_BOARD_ENABLED`, `isDeployCeremonyOn()`) are live, not dead. No unreachable colour paths found.

### H8 (new class) — SVG presentation attributes: **PRESENT — the one real hazard this scan adds**

`DesktopBackground.jsx` sets colour via **SVG presentation attributes**, not CSS:

| Site | Attribute | Matches |
|---|---|---|
| `:90`, `:130` | `stroke="#00d9ff"` | `--ft-cyan` |
| `:138` | `stroke="#8b5cf6"` | `--ft-purple` |

`var()` substitution in SVG *presentation attributes* is not reliably supported — presentation attributes are parsed with a grammar that does not admit `var()`, and the documented workaround is to move the declaration into a `style` attribute. If a browser fails to resolve it, `stroke` falls back to its initial value and the price-line paths **disappear**. [ASSUMED — reasoned from the attribute-vs-property distinction; not empirically verified, as no browser is available in this environment. A single Vercel-preview look at the desktop background would settle it.]

**Disposition: leave all three untouched**, by analogy to the H2 rule already in the spec (a class of site where `var()` cannot be relied on keeps its literal). Leaving is the null action and carries zero risk. The other 14 hex literals in this file's SVGs (`#00ff88`, `#ff4757`, `#059669`, `#dc2626`, `#f87171`, `#1a1a2e`) match no token and are unaffected either way.

*If the founder prefers these three migrated, the safe form is `style={{ stroke: cssVar('cyan') }}` rather than the attribute — but that is a structural edit to shipping markup and is not proposed here.*

---

## 3. Migration plan (7 sites)

| # | File:line | From | To | Pattern |
|---|---|---|---|---|
| 1 | `CommandDashboard.jsx:249` | `background: '#EF4444'` | `cssVar('red')` | inline style |
| 2 | `CommandDashboard.jsx:319` | `rgba(255,255,255,0.06)` | `rgba(var(--ft-scrim-rgb), 0.06)` | literal rgba |
| 3 | `CommandDashboard.jsx:319` | `rgba(255,255,255,0.02)` | `rgba(var(--ft-scrim-rgb), 0.02)` | literal rgba |
| 4 | `DesktopBackground.jsx:12` | `'#00d9ff'` | `cssVar('cyan')` | inline style (via `p.color` → `:194`) |
| 5 | `DesktopBackground.jsx:12` | `'#8b5cf6'` | `cssVar('purple')` | inline style (via `p.color` → `:194`) |
| 6 | `DesktopBackground.jsx:67` | `rgba(0, 217, 255, 0.07)` | `rgba(var(--ft-cyan-rgb), 0.07)` | literal rgba |
| 7 | `DesktopBackground.jsx:68` | `rgba(139, 92, 246, 0.07)` | `rgba(var(--ft-purple-rgb), 0.07)` | literal rgba |

Each is value-identical: `#EF4444` → `--ft-red` `#ef4444` (case-insensitive match, R-S7 canonical lowercase); `--ft-scrim-rgb` = `255, 255, 255`; `--ft-cyan-rgb` = `0, 217, 255`; `--ft-purple-rgb` = `139, 92, 246`.

Verified safe: site 1's `<span>` sits inside a plain `<button>` (`:242`), not a motion element. Sites 2–3 are inside a plain skeleton `<div>` in the `drb.loading` branch. Sites 4–5 flow only to `background` at `:194`; `p.color` has no other consumer. Sites 6–7 are inside a `background` template literal whose `animation` (`:72`) drives `opacity` only.

`#21262d` (the §3 role-collision value) **does not occur** in any pilot file, so the bg-elevated/border-strong role split is not exercised by this pilot.

### Deliberately left untouched

| Site | Reason |
|---|---|
| `CommandDashboard.jsx:249` `color: '#fff'` | 3-digit shorthand; `--ft-white` is `#ffffff`. Spec §5 says *"exactly matches a locked token value"* — `#fff` does not. **Flagged for a micro-ruling** (§4). |
| `CommandDashboard.jsx:346, :413` `alpha('#FFFFFF', …)` | Helper call sites stay hex (R-S9). |
| `DesktopBackground.jsx:90, :130, :138` | SVG presentation attributes (H8). |
| 14 further hex + 6 rgba | Match no locked token. |
| every `CMD.*` reference | Identifier-keyed migration forbidden (§2); R-S5 defers to post-Task-1. |

---

## 4. Two dispositions flagged for ratification

Neither blocks progress; both were resolved toward the null action, so neither can cause a visual change. Recorded so they are ratified rather than assumed.

1. **H8 / SVG presentation attributes** — 3 sites left as hex. Recommend confirming at the parity gate that the desktop background's price lines still render.
2. **`#fff` vs `#ffffff`** — 1 site left as hex on the spec's "exactly matches" wording. If the intent was semantic colour-equality rather than string-equality, this site (and any other 3-digit shorthand) becomes migratable; that would be a one-word spec clarification, not a re-scope.

---

## 5. Parity gate reminder (spec §5)

Screenshots must cover: signed-out home **and** signed-in dashboard, at 375px **and** 1280px, and must include the sidebar-inset strip where `#0d1117` shows behind `#0d0e12` (the discovery S4 correction, `App.jsx:8613`). Note that `DesktopBackground` renders on desktop only (`:4`), so sites 4–7 are desktop-visible only — the 375px shots will not exercise them.

---

*End of Phase 2 preamble scan. No hard-stop condition. Proceeding to the migration commit.*
