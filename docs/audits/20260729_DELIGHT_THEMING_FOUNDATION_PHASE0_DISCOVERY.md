# Delight Layer — Task 1 (Theming Foundation) — Phase 0 Read-Only Discovery

**Date:** July 29, 2026
**Arc:** Delight Layer, Task 1 of ~5 (Theming Foundation)
**Spec under discovery:** DELIGHT LAYER ARC — Task 1: Theming Foundation, V1
**Branch:** `claude/delight-theming-foundation-jzr3nj`
**HEAD:** `db6f5ebc40b5fddd047898194be1b74e92686de0` (identical to `origin/main` after fetch)
**Tree:** clean (`git status --porcelain` empty)
**Fence status:** NON-FENCED. No file under BUILD_RULES §1 was read or written. Zero `api/` contact. Client-only.
**Status:** **HARD STOP.** No code written. Ten items need a founder ruling before Phase 1.

---

## 0. Preamble — protocol compliance

| BUILD_RULES rule | Compliance |
|---|---|
| §3 `git fetch origin` is the FIRST step | Done before any comparison. Fetched `57b36dde..db6f5ebc` on `main`, plus 3 new remote branches. `origin/main` == local HEAD == `db6f5ebc`. |
| §2 open by reporting branch / HEAD / clean-tree | Above. Branch matches the designated branch. |
| §3 read-only discovery then hard STOP | Nothing in the working tree was modified. This report is the only artifact. |
| §3 every claim carries `file:line` + VERIFIED/ASSUMED | Applied throughout. See §0.1 for provenance rules. |
| §3 reports are files, outside the repo tree too | A byte-identical copy is written outside the repo tree and offered for download alongside this commit. |
| §8 founder is non-technical: lead with a verdict table | §1 below. |

### 0.1 Method and what VERIFIED means here

Discovery ran as a 14-agent fan-out: 9 parallel read-only census agents (token sources, hex census, CSS state, palette drift, consumer classes, pilot surfaces, test/CI infrastructure, rgba composition, spec-premise collisions), then 5 adversarial verifiers instructed to *refute* the census results and independently re-derive every load-bearing number with different tooling.

Verifier verdicts: **1 CONFIRMED, 4 PARTIAL, 0 REFUTED.** The four PARTIALs carried 47 corrections between them. **Every correction is folded into this report; no uncorrected census claim appears below.** Where a census agent and its verifier disagreed, the verifier's independently re-derived number is the one printed, and the disagreement is disclosed.

Provenance markers used below:
- **VERIFIED** — the line was read this session. Claims marked VERIFIED were read by at least two independent agents (census + adversarial verifier), and the sixteen load-bearing claims in §2 and §3 were additionally re-verified first-hand by the session lead. Verification commands were re-run by the lead for all headline counts.
- **ASSUMED** — inferred, not directly observed. Every ASSUMED item says what would confirm it.

One environment caveat, disclosed because it bounds several findings: **`node_modules` does not exist in this checkout.** The repo's own 337-file test suite could not be run, so its current pass/fail state is unknown to me. All vitest/jsdom results in §6 come from isolated scratchpad installs of the exact lockfile-pinned versions (vitest 4.0.17, jsdom 29.1.1), run twice by two independent agents with matching output. This container runs Node v22.22.2; CI pins Node 20 (`.github/workflows/tests.yml:41`) — jsdom's CSS behaviour is not Node-version dependent, but Phase 1 should re-run the probes once deps are installed.

---

## 1. Executive verdict

**The spec is sound in intent and unbuildable as written.** Four of its stated premises are factually wrong at HEAD, and the two things it proposes to create already exist. None of this is fatal — every item has a concrete, cheap resolution — but Phase 1 cannot start until you rule on them, because the rulings change what gets built.

The deeper finding is a scope inversion. The spec sizes this work against the `colors` object in `App.jsx`. That object is the **smallest** colour system in the repo (24 live receiver files). The actual mass is **362 files of raw inline hex**, and there are **four mutually disjoint token systems** already in place that share no consumer file at all. A fifth abstraction added on top becomes a fifth island unless one system is first declared canonical.

| # | Verdict | Detail |
|---|---|---|
| **V1** | **Spec premise WRONG — pilot surfaces are dead code** | `DashboardLoop.jsx` and `DashboardDesktop.jsx` render for no user. Both feature flags are ON, routing to `CommandDashboard`/`CommandDashboardDesktop` instead. A pilot there produces zero visual-regression signal — the entire point of a pilot. **Blocker.** |
| **V2** | **Spec premise WRONG — `src/theme/tokens.js` already exists** | 80 lines, exports `DARK_TOKENS`/`LIGHT_TOKENS`, feeds `ThemeContext` → 64 files. Spec decision D3 cannot execute literally. Cheap to resolve; needs a one-line spec amendment. |
| **V3** | **Spec premise WRONG — CSS custom properties already exist, twice** | Two `:root` blocks ship today (`index.css`, `holographic.css`). The `index.css` tier is 19/22 dead and squats the best names (`--background`, `--card`, `--border`). There is also a cascade-layer trap that will silently defeat overrides. |
| **V4** | **Spec premise WRONG — `colors` object is at `App.jsx:1083`, not ~9819** | And it holds `cardBg: '#1a1f2e'`, not the `#161b22` the design doc publishes. `docs/DESIGN_TOKENS.md` is 7½ months stale and must not be the migration input. |
| **V5** | **Acceptance matrix A1/A2/A3 NOT implementable as specified** | Proven empirically, twice, on pinned versions. Two independent blockers stack. **A working alternative strategy was built and run: 7/7 passing, zero config change.** |
| **V6** | **"Zero visual change" is currently undefined** | Three different app-background values ship simultaneously (`#0d1117`, `#0D0E12`, `#111318`). Until you rule which one `--ft-bg-app` seeds from, the constraint has no meaning. |
| **V7** | **Scope is inverted by ~an order of magnitude** | `colors` prop = 24 live receivers. Inline hex = 362 files / 5,620 literals. Four token systems, pairwise intersection **zero**. |
| **V8** | **Spec's 29-value palette covers only ~64% of hex occurrences** | It omits the single largest cluster (white, 533) and the whole Tailwind gray ramp (380). |
| **V9** | **D7 (rgba triplets) misses the largest translucent surface** | 842 runtime `alpha()`/`hexToRgba()` compositions all take a **hex string**, not a CSS variable. Triplet vars do nothing for them without a helper-signature change. |
| **V10** | **CLEAR — the `--ft-` prefix is free** | Zero occurrences repo-wide. One near-miss to consider (`--fw-`, 44 occurrences) and a branding question. |
| **V11** | **CLEAR — `flowGradient` and `ambientBreathe` exist as the spec says** | `src/index.css:550` and `:556`, both live. The one spec premise that checked out clean. |
| **V12** | **12 pre-existing defects found, none fixed** | Per §3, filed for separate tasking. Two ship broken code today. |

**Recommendation:** rule on S1–S10 in §4, then re-issue the spec as V2. The arc is worth doing — the codebase genuinely needs this — but Task 1 as specified would migrate 0.14% of the hex surface in files nobody renders, and its acceptance tests would not compile.

---

## 2. Spec-premise corrections

Four of the spec's factual premises are wrong at HEAD. All four were re-verified first-hand by the lead.

| Spec statement | Reality at `db6f5ebc` | Citation | Status |
|---|---|---|---|
| "The `colors` object (believed `src/App.jsx:~9819`)" | `src/App.jsx:1083-1108`. 24 keys, 22 hex literals, **19 distinct** (3 values duplicated). Module-local, **not exported**. | `src/App.jsx:1083`, `:1108` | VERIFIED |
| D3: "**New module** `src/theme/tokens.js`" | Path occupied. 80 lines, `DARK_TOKENS` (30 keys) at `:2`, `LIGHT_TOKENS` (29 keys) at `:48`. | `src/theme/tokens.js:2`, `:48` | VERIFIED |
| §3.3: "Whether any CSS custom properties already exist" | **Two `:root` blocks ship.** `src/index.css:22-53` (22 unprefixed vars, inside `@layer base`) and `src/styles/holographic.css:9-31` (14 `--neon-*`/`--holo-*`/`--timer-*` vars, **unlayered**). Both load globally. | `src/index.css:22`, `src/styles/holographic.css:9`, `src/main.jsx:5-6` | VERIFIED |
| §3.2: "existing `scripts/audit-tokens.sh` … may be used if present" | **Does not exist.** No file named `audit-tokens*` anywhere in the repo. The §5 Phase 3 guard has no donor script. | `find . -name 'audit-tokens*'` → empty | VERIFIED |
| §3.3: "where `flowGradient` and `ambientBreathe` keyframes live" | **Correct as assumed.** Both in `index.css`, both live. | `src/index.css:550`, `:556`; consumed at `DashboardBattleCard.jsx:134`/`:140`, `DashboardLoop.jsx:219`, `DashboardDesktop.jsx:217` | VERIFIED |

Note on `flowGradient`: it is a behavioural duplicate of `gradient-shift` (`src/index.css:272`). Not a blocker; noted for the eventual keyframe consolidation.

---

## 3. Discovery findings — spec §3 items 1–5

### 3.1 Token source inventory (§3 item 1)

There is no single token source. There are **128 module-level const objects containing 2+ hex literals** (34 exported, 94 module-local), of which roughly eleven function as shared palettes. The spec names three; here are the ones that matter, by reach.

| Module | Symbol | Lines | Keys | Importing files | Role |
|---|---|---|---:|---:|---|
| `src/constants/holoTheme.js` | `HOLO_COLORS` | 5-62 | 41 | **104** | De-facto app-wide palette. Highest fan-in. |
| `src/theme/tokens.js` | `DARK_TOKENS` | 2-45 | 30 | 4 direct, **64 via `useTheme()`** | "Approved palette from design session." Feeds `ThemeContext`. |
| `src/theme/tokens.js` | `LIGHT_TOKENS` | 48-80 | 29 | 1 (`ThemeContext.jsx:12`) | Light-mode placeholder. **Unreachable** — see D-10. |
| `src/components/Dashboard/commandUI.jsx` | `CMD` | 16-33 | 15 | **29** | Obsidian "command bridge" palette. Undocumented in the spec. |
| `src/components/earningsGame/designConstants.js` | `designColors` + 4 more | 3-69 | 18+ | **30** | EarningsGame "Terminal Aesthetic". Undocumented in the spec. |
| `src/components/League/leagueTokens.js` | `LTOKENS` (= `CMD`), `LX` | 22, 26-35 | 15 ref + 8 | **26** | **The one module that re-exports rather than copies.** See §3.1.1. |
| `src/components/League/draft/draftTokens.js` | `TOKENS`, `DX` | 10-24, 27-34 | 11 + 6 | 11 | **Verbatim hex-for-hex copy of `CMD`'s 11 shared keys.** |
| `src/constants/reporterTheme.js` | `REPORTER_COLORS` +3 | 6-130 | 46 | 15 | FantasyTimes reporter identity + broadsheet layout. |
| `src/App.jsx` | `colors` | 1083-1108 | 24 | prop-drilled | The spec's target. Smallest reach. |
| `src/App.jsx` | `SECTOR_COLORS`, `CHALLENGE_COLORS` | 255-288, 1270-1277 | 19, 6 | local | Duplicated elsewhere. |
| `src/index.css` / `src/styles/holographic.css` | `:root` blocks | 22-53 / 9-31 | 22 / 14 | CSS-global | See §3.3. |

All VERIFIED.

**Cross-module name collisions are severe.** Thirteen logical token names resolve to *different* hex values depending on which module a file imports: `gold`, `purple`, `green`, `greenBright`, `cyan`, `red`, `textPrimary`, `textSecondary`, `textMuted`, `bgCard`, `bgElevated`, `borderDefault`, `borderSubtle`. `gold` alone has five distinct values across six modules. Concretely — `bgCard` is `#0d1117` in `HOLO_COLORS` (`holoTheme.js:8`) but `#15171E` in `DARK_TOKENS` (`tokens.js:5`); `textPrimary` is `#e6edf3` vs `#e2e8f0`; `textSecondary` is `#8b949e` vs `#d1d5db`. [VERIFIED]

#### 3.1.1 The pattern that already works

`src/components/League/leagueTokens.js:22` is `export const LTOKENS = CMD;` — a re-export, not a copy. Its header (`:5-11`) says explicitly: *"SINGLE SOURCE OF TRUTH … We reuse them rather than defining a parallel copy, so the two can't drift."* It adds exactly three League-only values in `LX` (`:26-35`). [VERIFIED]

This is the house pattern to generalize. `draftTokens.js` is the counter-example: same 11 keys, copied by value, and it has already drifted from `CMD` on `hair` (`rgba(255,255,255,0.07)` vs `0.05`).

### 3.2 Raw hex census (§3 item 2)

Counting rule matters and must be written down before any numeric target is set (see S7). Figures below use the word-boundary-anchored 3-and-6-digit pattern unless stated.

| Measure | Value |
|---|---:|
| Raw hex literal occurrences in `src/` | **7,221** |
| …minus 14 false positives (GitHub PR refs in comments — `#510` ×10, `#600` ×2, `#572`, `#551`) | **7,207** |
| Distinct values (after false-positive removal) | **306** |
| Including 8-digit `#rrggbbaa` forms | 7,271 occurrences / 347 distinct |
| Production-only (excluding 25 test/fixture files, 116 occurrences) | **7,105 / 289 distinct** |
| **Cleanest migration-scope figure** (excl. tests, PR refs, 2 `.svg` assets, 5 token-definition files) | **6,274** |
| Files under `src/` containing ≥1 hex literal | **457 of 999** (45.7%) |
| Files under `src/` with **any** colour usage (hex, rgba, `var(--)`, or token import) | **570 of 999** |

The 7,221 figure was reproduced by three independent command formulations (`rg`, `grep -roiE`, `grep -rhoiE`) and by summing independently regenerated per-file and per-value tables. The 14 PR-number false positives were found only by the adversarial verifier; `#510` sits at **rank 78 of 310** and would read as a real colour in any top-100 palette report. Any audit script must exclude them. [VERIFIED]

**Top 20 by frequency** (all counts independently reproduced):

| Rank | Value | Count | | Rank | Value | Count |
|---:|---|---:|---|---:|---|---:|
| 1 | `#8b949e` | 561 | | 11 | `#e6edf3` | 199 |
| 2 | `#ef4444` | 515 | | 12 | `#161b22` | 185 |
| 3 | `#f59e0b` | 413 | | 13 | `#6b7280` | 157 |
| 4 | `#10b981` | 394 | | 14 | `#fff` | 153 |
| 5 | `#ffffff` | 380 | | 15 | `#8b5cf6` | 152 |
| 6 | `#00d9ff` | 369 | | 16 | `#22c55e` | 147 |
| 7 | `#21262d` | **308** | | 17 | `#000` | 89 |
| 8 | `#5eead4` | 286 | | 18 | `#3b82f6` | 87 |
| 9 | `#6e7681` | 270 | | 19 | `#a78bfa` | 74 |
| 10 | `#0d1117` | 202 | | 22 | `#64748b` | 67 |

**Cumulative coverage:** top-10 = 3,698 (51.2%) · top-20 = 5,015 (69.5%) · top-30 = 5,592 (77.4%) · top-40 = 5,967 (82.6%) · top-50 = 6,238 (86.4%) · top-100 = 6,823 (94.5%). Long tail: 105 singletons, 159 values with ≤2 occurrences. [VERIFIED]

**The spec's 29-value list covers only ~64.4% of occurrences.** It omits white (`#ffffff` 380 + `#fff` 153 = **533**, which outranks every listed value except `#8b949e`), the entire Tailwind gray ramp (`#6b7280` 157, `#64748b` 67, `#9ca3af` 60, `#718096` 49, `#94a3b8` 47 = **380**), `#000` (89), `#a78bfa` (74), `#dc2626` (56), `#06b6d4` (54), `#f0c75e` (51). Eighteen of the true top 40 are missing from the list. [VERIFIED for every named component; the 64.4% aggregate is ASSUMED — the verifier could not reproduce it because the 29-value list exists only in the spec, not in the repo. Publish the list alongside the number so it is auditable.]

**Two values on the spec list are effectively dead:** `#ffc107` (3 occurrences) and `#1c2128` (3). Both are named `colors`-object entries with almost no downstream consumers. Recommend deleting the entries rather than minting tokens for them. [VERIFIED]

**File concentration:** 5 files hold ≥100 hex literals (1,241 occurrences, 17.2%); 30 files hold ≥50 (2,843, 39.4%); 182 files hold ≥10 (6,107, 84.6%). `src/App.jsx` alone holds 642 (8.9%) — but only 22 of those are inside the `colors` object; the other 620 are raw literals in component code in the same file. [VERIFIED]

### 3.3 index.css state (§3 item 3)

Five CSS files exist under `src/`: `index.css` (721 lines), `styles/holographic.css` (308), `App.css` (42), `components/League/league.css` (67), `components/League/battleArena/battleArena.css` (85). Only `index.css` and `holographic.css` are imported (`src/main.jsx:5-6`). [VERIFIED]

Three findings here materially change the Phase 1 plan.

**(a) The existing `:root` block is effectively dead.** 19 of the 22 custom properties at `src/index.css:24-52` have **zero** `var()` consumers repo-wide. The three live ones (`--background`, `--text-primary`, `--border-subtle`) are consumed only by `index.css` itself at `:58`, `:62`, `:63`. `--radius` is consumed only by `tailwind.config.js:11-13`. Their *values* are instead hardcoded as hex literals in the `@layer utilities` block at `src/index.css:623-659`. [VERIFIED — the verifier initially scored `--border` as consumed, then found `var(--border` only ever matches `var(--border-subtle`; 19 is correct.]

So the block is 22 unprefixed names squatting the most desirable identifiers — `--background`, `--card`, `--border`, `--green`, `--red`, `--purple`, `--radius` — with nothing depending on them. Deleting it is verifiably safe. The live custom-property namespace is `holographic.css`'s `--neon-*`/`--holo-*` (14/14 consumed).

**(b) Cascade-layer trap.** `index.css`'s `:root` sits **inside** `@layer base` (opened `:21`, closed `:54`), while `holographic.css`'s `:root` (`:9-31`) is **unlayered**, and `holographic.css` imports second. Unlayered declarations outrank layered ones regardless of specificity. A new token block authored inside `@layer` will be **unable** to override the 14 live `--neon-*`/`--holo-*` vars. Conversely any unlayered override of the `index.css` vars wins automatically. [VERIFIED]

This same wrapper is what breaks the acceptance tests — see §6.

**(c) Keyframes.** `index.css` declares 76 `@keyframes`. Separately, `src/constants/animations.js` re-declares 74 `@keyframes` as JS strings duplicating them, injected at runtime by components. Repo-wide: 311 `@keyframes` occurrences across 76 files in `src/`. Any "consolidate the tokens" scope that does not name `animations.js` leaves the largest duplicate untouched. [VERIFIED]

`tailwind.config.js:15` has **`colors: {}`** — empty — while 45 shadcn-style colour utilities sit in live JSX (`border-border` ×22, `bg-card` ×19, `bg-background` ×4). Those utilities emit no CSS today. [Empty map VERIFIED; "emit no CSS" is ASSUMED — derived from the empty map, not runtime-verified. A one-line Tailwind build would confirm.] This is a landmine: wiring `--ft-*` into Tailwind's colour scale activates all 45 at once. See S10.

### 3.4 Divergence check (§3 item 4)

The palette is not "a few divergent families" — it is **systematically forked**. A full pairwise CIEDE2000 scan over the 147 hexes used 3+ times found **93 pairs closer than dE2000 3.0**. Both the census agent and the verifier implemented dE2000 independently and reproduced 93 to the exact integer. [VERIFIED]

Founder rulings are needed per family. Representative separations, spot-checked to 2dp by both agents:

| Family | Members (occurrences) | dE2000 | Assessment |
|---|---|---:|---|
| **App background** | `#0d1117` (202), `#0D0E12` (55), `#0a0e14`, `#111318` (3) | 0.78–1.97 | Indistinguishable. Nominal 2-tier hierarchy (`bgDeep` behind `bgCard`, `holoTheme.js:7-8`) is dE **0.78** — it does not render at all. |
| **Card surface** | `#161b22` (185), `#15171E` (74), `#1a1f2e` (27), `#21262d` (308) | 2.18–2.48 | `#15171E` sits 2.48 from the *app* background and 2.18 from the *card* background — it cannot be mechanically assigned to either tier. |
| **Muted text** | `#6e7681` (270), `#6b7280` (157) | 2.32 | Drift. **7 co-occurring files**, incl. same-card adjacency at `Research/LatestEarningsReport.jsx:581` (`#6b7280`) and `:594` (`#6e7681`). Sub-threshold at 10-11px, but not zero. |
| **Primary text** | `#e6edf3` (199), `#e2e8f0` | 1.59 | Drift. 1 co-occurring file. |
| **Purple** | `#8b5cf6` (152), `#a78bfa` (74), `#a855f7` (68), `#6366f1` (25), `#9333ea` (24), `#7c3aed` (21) | up to 8.58 | **Naming is inverted:** `--purple` is `#9333ea` (24 occurrences) while the de-facto purple is `#8b5cf6` (152). They are **genuinely different colours** (dE 8.58). |
| **Green** | `#10b981` (394), `#22c55e` (147), `#00ff88`, `#34d399`, `#059669` | 10.62 (`#10b981`/`#059669`) | Real distinctions. `#059669` is a gradient dark-stop (21 of 38 occurrences on gradient lines) — a legitimate shade token, not a duplicate. |
| **Destructive red** | `#ef4444` (515), `#dc2626` (56) | — | **Drift, not a shade token.** Same shared component `ConfirmationPopup.jsx`, same props, same destructive-confirm role, two values: `App.jsx:11792/11801/11958/11968` pass `#dc2626`; `Forge/Watchlist/DeleteWatchlistModal.jsx:18/26` pass `#ef4444`. Only 11 of 56 `#dc2626` occurrences are on a gradient line; 13 are SVG mascot artwork. |
| **`#21262d` cluster** | `#21262d` (308), `#2a2d35` (30), `#1c2128` (3), `#292a2e` (3) | 1.57–2.91 | **Missed by the first pass; found by the verifier.** 7th most frequent hex in the repo. Carries a **border-vs-surface role collision**: it is `borderSubtle` (`holoTheme.js:12`) and `borderDefault` (`designConstants.js:10`) but `--card-elevated` (`index.css:27`) and `cardElevated`/`elevated` (`App.jsx:1088-1089`). Changing this one value moves both borders and surfaces. |

All VERIFIED.

**Correction carried:** the census claimed the near-black cluster's maximum pairwise separation was dE 3.45. The verifier computed all 66 pairs: **maximum is 6.30** (`#12121a` vs `#000000`), with 17 pairs above dE 3.0; excluding pure black the max is still 4.86. This error biased toward making wholesale background consolidation look safe. `#000000` (15 occurrences) must be **excluded** from any background consolidation, not swept in.

**Three structural traps for any consolidation:**

1. **Tokens carry multiple unrelated roles.** `holoTheme.js` binds `#f59e0b` to **four** roles (`:22` amber, `:35` aggressive, `:45` sectorIndustrials, `:55` ratingHold), `#ef4444` to three, `#10b981` to three. Merging by value couples the sector palette to the semantic palette. [VERIFIED]
2. **Case-sensitivity will silently half-migrate.** `#5eead4` is 135 uppercase / 151 lowercase; `#EF4444` 48/467; `#0D0E12` 52/2. 340 distinct values case-sensitive vs 296 case-insensitive. Every codemod, audit script and lint rule must be case-insensitive, and canonical casing must be decided up front. [VERIFIED]
3. **Non-hex notations are invisible to a hex-only audit.** `GLOW_EFFECTS` (`holoTheme.js:64-71`) and `BAGGER_GLOW_CONFIG` (`:74-105`) encode `#00ffff`, `#00ff88`, `#f59e0b`, `#ff3366`, `#8b5cf6`, `#ffd700`, `#3b82f6`, `#10b981`, `#eab308`, `#f97316`, `#ef4444` **exclusively as rgba() triplets**. Any coverage metric based on hex counts over-reports success. [VERIFIED]

**Orphans:** sweeping all 296 distinct hexes against all 11 palette modules, **217 have no token home at all**, totalling **1,153 occurrences (16.6%)**. Among the top-60 alone there are 16 orphans / 588 occurrences.

**Evidence of deliberate divergence** (do **not** merge): `src/components/League/leagueTokens.js:31` carries in-repo design commentary — `neg: '#F2766B', // losses — kept, honest, never shamed (League-only warm red)`. That is documentary proof of an intentional emotional-register choice, not drift, despite sitting dE 1.60 from `#f97066`. [VERIFIED]

**Adjacency results** (which merges are visually safe): `#161b22`/`#15171e`, `#2d3748`/`#2d3548`, `#ff3366`/`#ff4466`, `#f97066`/`#F2766B` all have **zero** co-occurring files — clean generational partitions. `#e6edf3`/`#e2e8f0` share exactly 1 file. Only `#6e7681`/`#6b7280` (7 files) carries real adjacency risk. [VERIFIED]

> **Constraint conflict, stated explicitly because neither census agent stated it:** every merge implied above repaints at least one value and therefore **violates the spec's zero-visual-change constraint**. Consolidation must be a separate follow-on task, never part of Task 1. Task 1 can only *name* the existing values; it cannot reconcile them.

### 3.5 Consumer classes (§3 item 5)

Denominator: **570 files** under `src/` with any colour usage (of 999 total).

| Class | Files | % of 570 | Notes |
|---|---:|---:|---|
| **Class 4 — inline hex only** | **362** | **63.5%** | 5,620 hex occurrences. **The real migration mass.** |
| — of which no token access *at all* | 318 | 55.8% | Excludes `useTheme`/`leagueTokens` consumers too. |
| Class 2 — `holoTheme` importers | 104 | 18.2% | Largest token system. 62/104 still contain raw hex. |
| Class 3 — `theme/tokens` (4 direct + 64 `useTheme`) | 68 | 11.9% | 30/64 still contain raw hex. |
| Class 3b — `leagueTokens` (4th system, unmentioned in spec) | 26 | 4.6% | 14/26 still contain raw hex. |
| **Class 1 — `colors` prop receivers** | **33** | 5.8% | **Corrected to 24 live (4.2%)** — 3 receive a colour *array* (name collision, not the palette), 6 more are dead code. Fed by only 24 pass-sites. |
| Class 5 — `var(--)` consumers | 19 | 3.3% | 137 occurrences. Nearly nonexistent. |

All VERIFIED. The "33 → 24" correction came from the adversarial verifier and cuts *against* its own report's thesis — it makes "smallest consumer class" more true, not less. Quote the founder 24.

**The finding that should drive the spec rewrite:**

| Pair | Shared files |
|---|---:|
| holoTheme ∩ useTheme | **0** |
| holoTheme ∩ leagueTokens | **0** |
| useTheme ∩ leagueTokens | **0** |
| holoTheme ∩ theme/tokens | **0** |
| holoTheme ∩ `var(--)` | **0** |

**The four token systems are mutually disjoint. No file in the repo uses two of them.** [VERIFIED — recomputed independently by two agents, all intersections empty.]

There is no existing seam to migrate through. Adding a fifth abstraction creates a fifth island unless one system is first declared canonical.

**A related trap:** `const colors = {` is declared at **12 sites across 11 files** (`HoloTimer.jsx` declares two, at `:192` and `:235`), and `App.jsx`'s is not exported. `colors.background` is `#0d1117` in `App.jsx:1084` but `HOLO_COLORS.bgDeep` (`#0a0e14`) in `BaggerBomb/StockSearch.jsx:7` and `#0a0a0f` in `BaggerBomb/AccordionSection.jsx:6`. **A migration keyed on the identifier `colors.background` will silently repaint every BaggerBomb screen.** Restrict any codemod to raw hex literals, or namespace the 11 local objects first. [VERIFIED]

---

## 4. STOPs — items requiring a founder ruling before Phase 1

### S1 — Pilot surfaces are dead code **[BLOCKER]**

`src/config/featureFlags.js:22` → `export const COMMAND_DASHBOARD_ENABLED = true;`
`src/config/featureFlags.js:33` → `export const COMMAND_DASHBOARD_DESKTOP_ENABLED = true;`
`src/App.jsx:8563` → `const DashboardComponent = COMMAND_DASHBOARD_ENABLED ? CommandDashboard : DashboardLoop;`
`src/App.jsx:8610` → `{COMMAND_DASHBOARD_DESKTOP_ENABLED ? (<CommandDashboardDesktop …`

Neither `DashboardLoop` nor `DashboardDesktop` renders for any user. [VERIFIED first-hand.]

The spec picks them because "Task 2's starfield mounts here." It doesn't — and can't. Compounding facts:

- The three pilot files hold **10 hex literals combined** (Loop 5, Desktop 5, HoloCard 0) out of 7,207 — **0.14%** of the hex surface. [VERIFIED first-hand.]
- `HoloCard.jsx` has **zero** hex and already imports `HOLO_COLORS`/`GLOW_EFFECTS` (`:2`, reads at `:48/:67/:69/:83/:88/:89`). It is a migration *destination*, not a subject.
- The two Dashboard files are near-duplicates — import blocks at lines 6-18 are **byte-identical** (`diff` confirmed), identical hex usage (`#5eead4` ×4 + `#111318` ×1 each). The "three pilots" are really two code paths.
- The full-viewport background is **not** in either file. It is `DesktopBackground.jsx`, mounted as a *sibling* at `App.jsx:8567` and `:8608`, `position:fixed`, `inset 0`, `zIndex 0` (`DesktopBackground.jsx:49-56`). It **early-returns null on mobile** (`:4`) — mobile has no background layer at all today.
- Both dashboard roots paint an **opaque** `#111318` at `zIndex 1` over a `minHeight:100vh` box (`DashboardLoop.jsx:208`, `DashboardDesktop.jsx:206`). Any starfield at `zIndex 0` is completely hidden. Making that root transparent is itself a visible design change requiring sign-off — not a mechanical token swap.

**Ruling needed.** Recommend **(a) re-point Phase 2 at `CommandDashboard.jsx` / `CommandDashboardDesktop.jsx`** — the surfaces actually shipping. Alternatives: (b) keep the current targets as a deliberately zero-risk dry run, accepting that it proves nothing visually; (c) re-pick from the hot list — `draft/CompeteTab.jsx` (86 hex), `Agent/AgentActivityFeed.jsx` (58), `Dashboard/WatchlistNews.jsx` (53) are mid-size and representative.

**Task 2 also needs a background mount-point decision before any code is written.**

### S2 — `src/theme/tokens.js` path is occupied

The file exists and is load-bearing: 4 direct importers (`contexts/ThemeContext.jsx:2`, `FantasyTimes/visuals/SectorHeatmap.jsx:6`, `EpsGauge.jsx:7`, `MarketBar.jsx:9`), all dereferencing at runtime, plus **64 files / 65 call sites** consuming via `useTheme()`. Overwriting it breaks the app. [VERIFIED first-hand: `rg -n "theme/tokens"` → exactly 5 hits, 4 imports + 1 comment; `rg -o "=\s*useTheme\(\)" src | wc -l` → 65; `rg -l` → 64.]

| Option | Files touched | Import changes | Risk |
|---|---:|---:|---|
| **(b) New sibling module** e.g. `src/theme/cssTokens.js` | 0 existing | 0 | **Lowest. Recommended.** Needs a one-line spec amendment to D3. |
| (a) Append `cssVar`/`readToken` to the existing file | 1 | 0 | Low, strictly additive. Mixes two unrelated concerns in one module. |
| (c) Rename existing → `palette.js` | 6 | 5 | **Recommended against** — puts `ThemeContext` (single point of failure for 64 components) in the edit path for zero benefit. |

The census framed this as a hard STOP; the adversarial verifier argued it is a spec-wording defect with a 1-file fix, not a genuine decision. **I agree with the verifier** — this is the cheapest item on the list. It is listed as a STOP only because it requires a written spec amendment, not because it is risky.

### S3 — Acceptance tests A1/A2/A3 are not implementable as specified

See §6 for full detail and the working alternative. A ruling is needed on which fixture strategy Phase 1 adopts, and on one **architecture** question: whether `--ft-*` semantic tokens may be aliases (`--ft-accent: var(--ft-cyan)`) or must be flat literals.

### S4 — "Zero visual change" is currently undefined **[the constraint has no meaning until this is ruled]**

Three app-background values ship simultaneously:

| Value | Occurrences / files | Where it renders |
|---|---:|---|
| `#0d1117` | 202 / 58 | `index.css:24` (`--background`), `index.css:62` (`body`), `App.jsx:1084` (`colors.background` → `containerStyle:1472`, 14 usages), `HomeScreen.jsx:161`, `holoTheme.js:8` (`HOLO_COLORS.bgCard`) |
| `#0D0E12` | 55 / 33 | `theme/tokens.js:4` (`DARK_TOKENS.bgApp`), `commandUI.jsx:17` (`CMD.bg`), painted by `CommandDashboard.jsx:227` / `CommandDashboardDesktop.jsx:128` |
| `#111318` | 3 | `App.jsx:8431` (Forge wrapper), `DashboardLoop.jsx:208`, `DashboardDesktop.jsx:206`. Matches **nothing** in any token module. |

They render **nested**, not in competition. [VERIFIED]

**Correction carried — this matters for how you think about it.** The census claimed "the DEFAULT landing screen paints `#0D0E12`." That is wrong. `src/App.jsx:2198` initializes `useState('home')` and `:8455` returns `<HomeScreen>` — the **login** screen, which paints `#0d1117` (`HomeScreen.jsx:161`). The dashboard is reached only via the authenticated redirect at `App.jsx:3344-3346`. So: **cold boot / signed-out → `#0d1117`. Signed-in returning user → `#0D0E12` over a `#0d1117` base.** On desktop the `#0D0E12` layer does not even fully cover — `App.jsx:8613` insets it by the 64-220px sidebar, leaving a strip of `#0d1117` visible. [VERIFIED]

**Ruling needed:** which value does `--ft-bg-app` seed from? "Zero visual change" means opposite things depending on the answer.

### S5 — Which palette is canonical?

Four mutually disjoint systems (§3.5). There is no defensible "primary":

- **By reach:** `HOLO_COLORS` wins (104 files).
- **By recency and design intent:** `DARK_TOKENS`/`CMD` win — their headers (`tokens.js:1`, `commandUI.jsx:9-10`) describe them as the approved design-session palette.

They disagree on core semantics (`bgCard`, `textPrimary`, `textSecondary`). Picking either silently reskins roughly half the app. **Phase 1 cannot start without this call**, because it determines what the base tier's values *are*.

### S6 — Which `:root` survives, and which cascade layer?

Two sub-rulings:
1. The `index.css:22-53` block is 19/22 dead but squats `--background`, `--card`, `--border`, `--green`, `--red`, `--purple`, `--radius`. **Delete it** (verified zero consumers, safe) or namespace around it?
2. `@layer` vs unlayered (§3.3b). Pick one convention and apply it to both files, or normalise `holographic.css` into a layer first. **If Phase 1 declares `--ft-*` inside `@layer`, every downstream acceptance test is born broken** (§6).

Recommend: declare the new block in a **bare `:root{}`** in a fresh `src/theme/tokens.css`, leaving the legacy `@layer base` block alone.

### S7 — Lock the token name list and the counting rule

The spec says the founder locks the token list at this STOP. Two inputs are needed:

1. **Coverage target.** The 29-value list covers ~64%. Top-50 = 86.4%, top-100 = 94.5%. Either expand the Phase 1 set, or accept that ~36% of hex stays unmigrated and drop "raw hex eliminated" as a success metric.
2. **The counting rule, in writing** — regex (anchored? 8-digit forms?), file scope (tests in or out?), false-positive filter (PR numbers), and canonical casing. Any "reduce hex by N%" commitment is meaningless until this is fixed. Note **"zero raw hex in `src/`" is unachievable without an allowlist**: the token-definition files themselves hold 754 hex literals, and `Forge/mech-artwork-v2.svg` holds 62 as static art.

A proposed token list is in §7 for you to amend and lock.

### S8 — Prefix ratification

`--ft-` is **100% free** (0 occurrences repo-wide) [VERIFIED first-hand] and `ft` = FantasyTrades matches the shipped brand (`package.json:2` `"fantasytrades"`, `index.html:7` `<title>FantasyTrades</title>`). Two sub-rulings:

1. The repo is `TradeSeven`, the Firebase project is `tradeseven`, and several docs are filed under `MARKETCLASH_*`. Confirm no rename is planned, else `--ft-` is legacy on day one.
2. `--ft-` is one letter from the existing `--fw-` prefix (44 occurrences, `Forge/workshop/ForgeWorkshop.jsx:182`). `--t7-`, `--brand-`, or `--ftx-` avoid the near-miss.

### S9 — D7 (rgba triplets) needs three naming rulings and a scope ruling

Census: **2,893** numeric rgba/rgb literals in `src/`, 498 distinct, **93 distinct RGB triplets**, 347 files. 11 triplets cover 79.5% of all translucent usage. Every one of the top 11 is used at 14–25 distinct alpha values across 27–189 files — strong D7 candidates on the evidence. [VERIFIED]

**The scope problem:** there are **842 runtime rgba compositions** (734 `alpha(hex, a)` calls across 66 files + 108 `hexToRgba(hex, alpha)` calls), and **every one takes a hex string, not a CSS variable** (`commandUI.jsx:44`, `Agent/GameplanMeetingCard.jsx:7-10`). A `--ft-*-rgb` custom property does nothing for these unless the helper signature changes too. Rule: (a) ship triplet vars for CSS/literal sites only and accept the split; (b) also add a JS `readTokenRgb()` and rewrite the helpers; or (c) defer D7 until helper consolidation lands.

**Three naming rulings, each of which is expensive to redo:**

| Triplet | Occurrences / alphas / files | Problem |
|---|---|---|
| `255,255,255` | **838** / 25 alphas / 189 files (29% of all rgba) | Used almost entirely as a **scrim/hairline**, not as "white". Naming it `--ft-white-rgb` bakes in the dark-mode assumption the foundation is meant to remove. `--ft-scrim-rgb` / `--ft-hairline-rgb` is the semantic name. **838 sites — doing this twice is not viable.** |
| `0,0,0` | 202 / 23 alphas / 105 files | Has **no named token anywhere** in any palette module. It cannot get a `--ft-<name>-rgb` companion until it gets a `<name>`. |
| purple | `#8b5cf6` 77 translucent occurrences (no CSS var) vs `--purple` = `#9333ea` (33) | **Naming `--ft-purple-rgb` will silently pick the wrong one.** They are dE 8.58 apart — genuinely different colours. |

Also: four competing cyans used translucently (406 combined), four greens (273), four reds (255). And **50 of 93 triplets (368 occurrences) are orphans**, several of which are near-miss typos of real tokens — `#a855fa` vs `#a855f7`, `#00d4ff`/`#00e5ff` vs `#00d9ff`, `#ff4757` vs `#ff4466`. **Triage these as drift/bugs before D7, do not encode them as new triplet vars.**

### S10 — Do not touch `tailwind.config.js` colors

`tailwind.config.js:15` is `colors: {}` while 45 colour utilities sit in live JSX across 8 BaggerBomb components and 9 `src/components/ui/*` files. If Phase 1 wires `--ft-*` into Tailwind's colour scale, all 45 activate at once and the BaggerBomb battle surfaces visibly change. [Empty map VERIFIED; inert-today ASSUMED — confirm with one Tailwind build.]

**Guardrail to adopt: Phase 1 must not modify `tailwind.config.js`'s `colors` key.** Related: Tailwind layer ordering puts `@layer base` below components/utilities, so any Tailwind utility outranks the `body { background: var(--background) }` rule.

---

## 5. Pilot surface detail and migration hazards

Recorded so the eventual pilot — wherever it lands — inherits the hazard map. All VERIFIED.

| File | Lines | Hex | rgba | `var(--)` | Colour source |
|---|---:|---:|---:|---:|---|
| `DashboardLoop.jsx` | 683 | 5 | 26 | 0 | `useTheme()` tokens + inline |
| `DashboardDesktop.jsx` | 542 | 5 | 25 | 0 | `useTheme()` tokens + inline |
| `HoloCard.jsx` | 166 | 0 | 3 | 0 | `HOLO_COLORS` / `GLOW_EFFECTS` |

Confirmed **absent** from all three (hazard classes ruled out): no canvas/`getContext`, no `dangerouslySetInnerHTML`, no inline `<style>`, no inline `<svg>`. No styled-components/emotion/styled-jsx/goober in `package.json`.

Confirmed **present**:

**H1 — `hexToRgba` fails silently on `var()`.** `HoloCard.jsx:54` gates on `hex.startsWith('#')` and returns `rgba(128,128,128,alpha)` grey otherwise — no throw, no warning, no test failure. **This pattern is duplicated 26 times across `src/`.** Before *any* hex→`var()` change lands in `holoTheme.js` or `tokens.js`, we need either a shared triplet-aware helper all 26 sites adopt, or a guard that throws loudly so failures surface in CI. Shipping without one risks 26 components quietly turning grey in production. The five `alpha()` and 26 `hexToRgba()` implementations have **seven different fallback behaviours** on bad input (transparent black, teal, gray-150, gray-100, gray-128, return-input-unchanged, and NaN — `Agent/GameplanMeetingCard.jsx:6` has no guard at all and emits `rgba(NaN, NaN, NaN, a)`).

**H2 — Framer Motion cannot interpolate `var()`.** Two instances, not one:
- `DashboardDesktop.jsx:459` — `whileHover` box-shadow. Interpolates from computed `none` (no base shadow at `:461`), so a broken value is a no-op.
- **`Dashboard/DashboardBattleCard.jsx:381`** — byte-identical construct, and **this one is worse**: `:393` sets `boxShadow: cardShadow` as a real base (built at `:369-371`), so an unparseable `var()` target would visibly destroy an existing shadow. `DashboardBattleCard` is rendered by **both** pilots (`DashboardLoop.jsx:478-485`, `DashboardDesktop.jsx:406-413`).

**H3 — Colour objects are prop-drilled into children that string-manipulate them.** Both pilots pass `tokens={tokens}` into `DashboardBattleCard` (`DashboardLoop.jsx:482`, `DashboardDesktop.jsx:410`), which splices token values into template literals at `:371`, `:375`, `:381` and re-drills the same object to `DraftLeaderboard` (`:273`, `:361`) and `TugOfWarBar` (`:275`, `:363`). **The pilot's visual blast radius is not three files.**

**H4 — `HoloCard` has an open colour-injection channel** the "gets colours exclusively from holoTheme" framing misses: the `...style` spread at `HoloCard.jsx:142`. `SeasonHub.jsx:107-110` passes `borderTop: 3px solid ${TROPHY_GOLD}` into it. `TROPHY_GOLD = '#F0C75E'` (`SeasonHub.jsx:35`) is **redeclared identically in 18 files** and equals `DARK_TOKENS.medalGold` (`tokens.js:42`) — whose own comment at `:41` says it "mirrors the existing TROPHY_GOLD constant." A token exists and 18 sites ignore it.

**H5 — Light-mode hues on dark surfaces.** Two instances, same defect class:
- `DashboardLoop.jsx:346` / `DashboardDesktop.jsx:332` use `rgba(217,119,6,x)` = `#d97706` = `LIGHT_TOKENS.amber` (`tokens.js:63`), not the dark-mode `#f59e0b` (`:22`).
- `DashboardBattleCard.jsx:388/:391` use `rgba(13,148,136,0.08)` and `3px solid #0d9488` = `LIGHT_TOKENS.teal` (`tokens.js:58`), not `DARK_TOKENS.teal` `#5eead4` (`:17`).

Bug or intentional darker wash? **Rule on the class, not one literal at a time** — naming either cements current behaviour.

**H6 — An rgba value with no token counterpart.** `DashboardLoop.jsx:216` and `DashboardDesktop.jsx:214` both use `rgba(168,85,247,0.06)` in the ambient-glow gradient. `#a855f7` is **not** `DARK_TOKENS.purple` (`#9333ea`) and **not** `purpleText` (`#a78bfa`). It exists in `tokens.js` only baked inside composite strings (`borderPurple` `:12`, `glowPurpleCard` `:26`), never as a scalar token. Mapping it to `--purple` would be a **visible hue shift**, not a zero-visual-change swap.

**H7 — Dead paths inside `HoloCard`.** `glow` is never passed by any of the 12 call sites, making `:88-93` and the `GLOW_EFFECTS` import unreachable. `variant="highlighted"` (`:77-79`) is never used. All three `accentColor="purple"` sites are **inert even if revived** — with `variant` defaulting to `'default'`, `selected=false`, no `onClick`, `getBoxShadow` returns `'none'` and `handleMouseEnter` can never fire. Phase 2 should treat these as no-op props to delete, not paths to migrate.

Exactly **12 `<HoloCard` call sites in 9 files**; exactly **6 pass `accentColor`**: cyan ×1, red ×1, green ×1, purple ×3. No `amber`.

---

## 6. Acceptance matrix feasibility (spec §6)

| Row | Verdict |
|---|---|
| **A1** defines-all-tokens | **NOT implementable as specified.** Buildable via the proven alternative below. |
| **A2** parity-with-legacy | **NOT implementable as specified.** Buildable, with an architecture constraint. |
| **A3** rebind | **Mechanism CONFIRMED working.** Test buildable. |
| **A4** guard script | Buildable, but the spec's `.sh` approach contradicts the house pattern — see below. |
| **A5** cssVar format | Trivially buildable. No blocker. |
| **A6** visual parity | Manual gate as specified. Blocked on S1 (dead pilot surfaces produce no signal). |

This was the highest-risk engineering claim in the discovery, so it was tested empirically by two independent agents against fresh installs of the exact lockfile-pinned versions. **The verifier returned CONFIRMED** — the only CONFIRMED verdict of the five — and closed the census's own biggest gap.

**Blocker 1 — vitest never loads CSS.** `vitest.config.js:35-42` sets exactly one `test.*` key (`exclude`, `:39`). No `css`, no `environment`, no `setupFiles`. Measured `configDefaults` for vitest 4.0.17: `css = {"include":[]}`. So a `.css` import returns an empty-string module, injects 0 style tags, and leaves `document.styleSheets.length === 0`. (The `css: { devSourcemap: true }` at `vite.config.js:16-18` is Vite's option — a different key, and an easy misread.)

**Blocker 2 — `@layer base` defeats jsdom even with CSS forced on.** With `css: true` forced against the real `index.css`: 1 style tag, 1 stylesheet, and `--background`/`--card`/`--cyan`/`--radius`/`--glow-cyan` **all resolve to `""`**. jsdom 29.1.1 parses `@layer` into a `CSSLayerBlockRule` it never cascades. The de-layered control — injecting only lines 22-53 without the wrapper — resolves all 22 properties correctly. **The defect is the wrapper, not jsdom's custom-property support.**

The verifier closed the open question of whether the real build pipeline flattens the layer: running the repo's actual `postcss.config.js` (`@tailwindcss/postcss` + autoprefixer) over `index.css` emits `@layer base { :root { --background: #0d1117; …` **verbatim**. The wrapper survives compilation.

> **Important framing the census omitted and a founder could misread:** native `@layer` cascades correctly in real browsers. This is a **test-environment-only** defect, **not** shipping breakage.

**Blocker 3 — an architecture constraint, not just a test problem.** jsdom performs no `var()` substitution: `--ft-accent: var(--ft-cyan)` reads back as the literal string `"var(--ft-cyan)"`. **If the `--ft-*` layer is designed as semantic aliases pointing at primitives — which is the normal, good design, and exactly what spec D2 describes — then `readToken('accent')` returns garbage under test and A1/A2/A3 cannot assert real values at all.** Either every `--ft-*` token is a flat literal, or the acceptance tests assert on CSS *text* rather than computed values. **This is a design decision and belongs in the spec, not in the test file.**

**Also relevant:** jsdom ignores `@media (prefers-color-scheme: dark)` entirely, and `window.matchMedia` is undefined and throws when called. `:root[data-theme="light"]` overrides **do** work and re-resolve live on `setAttribute`. If future theme switching is media-query-based, its acceptance test is unwritable in this stack. (`src/index.css:568-578` already ships a `@media (prefers-reduced-motion: reduce)` block that is equally inert under test.)

**What works — proven, not theorised.** Decision D4's rebinding mechanism is confirmed end-to-end:

```
C1 before setProperty:     "#0a0e1a"
C2 after  setProperty:     "#ffffff"     <- D4 mechanism WORKS
C3 after  removeProperty:  "#0a0e1a"
G1/G2/G3 data-theme:       "#0a0e1a" -> "#ffffff" -> "#0a0e1a"
```

The verifier **built and ran** the full alternative: a 7-assertion suite (A1 raw values, A2 parity across all 8 declared tokens, A2b fallback, A3 `data-theme` rebind, A3b `setProperty` rebind, plus 2 architecture guards) using `node:fs` to read the token CSS and inject it as a `<style>` in `beforeAll`. **Result: 7 passed (7), with vitest's `css` option unset entirely.**

**Recommended strategy — requires zero vitest config change.** Drop the scoped `css: { include: [...] }` from the plan; it isn't needed. One practical gotcha, reproduced by the verifier on its own test: an `@layer` guard that greps raw CSS text will false-positive on the word inside a comment — strip comments first (`text.replace(/\/\*[\s\S]*?\*\//g, '')`).

A bonus finding: the **existing** 22 tokens can be covered today without moving them out of `@layer`, by regex-extracting the `:root{…}` block from the `index.css` *text* and injecting that. Measured: exactly 1 block found, injecting it resolves 22 tokens. This makes an A2 parity test against the **legacy** values achievable in Phase 1 rather than blocked on a CSS refactor.

**A4 — the guard should be a vitest test, not a shell script.** The repo's one existing `.sh` (`scripts/status-consumer-census.sh`, 43 lines) is a report generator whose greps end `|| true` — it *cannot fail*, and no workflow or npm script invokes it. The real house pattern is a **vitest test that fs-walks the tree and diffs a frozen JSON baseline**: `api/_utils/archetypeRegistry.test.js:113-181` + `archetypeImportBoundaryBaseline.json`, with remedy strings as `expect()`'s second argument (`:174`, `:178`) and an env-gated regen mode (`:52-55`).

A vitest guard is picked up by the default include glob and runs inside the existing step at `.github/workflows/tests.yml:55` with **zero workflow change**. A bash guard needs a new step appended after `:62`. **Recommend `src/theme/tokens.guard.test.js` + `tokenBaseline.json`.**

An ESLint guard is not viable as a drop-in: `eslint.config.js` (29 lines) has one custom rule, no colour rule, no stylelint or design-token plugin — and **`npm run lint` is never executed by CI**. The only npm commands in either workflow are `npm ci` (`tests.yml:45`) and `npm run test:run` (`:55`).

**CI shape** (VERIFIED by reading both workflows): `tests.yml` triggers on `pull_request` to `main` + `workflow_dispatch` (no push trigger), job `unit`, Node 20, 337 test files collected (381 matching the default glob minus 44 under `research/level-study/tests/`). `main.yml` contains no tests — 4 steps, 3 of which are `continue-on-error` curl pings.

**Spec §3.2's audit command is defective and must not be scripted as written.** It omits `--no-filename`, so `rg -o` emits `path:match` and the pipeline ranks file+value **pairs** rather than values — run as written its top row is `65 src/app.jsx:#8b949e` and its distinct count returns 2,982 instead of 310. The `tr 'A-Z' 'a-z'` also mangles paths. Corrected form adds `--no-filename`. (The spec got one thing right by accident: `rg -oc` does yield match counts, not line counts — verified 642 vs 542 on `App.jsx`.)

---

## 7. Proposed token list for locking

Offered as a starting point to amend, not a recommendation to adopt as-is. **It is contingent on S5 (canonical palette) and S4 (background value)** — both marked `⚠ RULING` below. Values shown are the current literals; nothing here changes a pixel.

**Base tier — backgrounds** (⚠ all contingent on S4/S5)

| Token | Candidate value | Source |
|---|---|---|
| `--ft-bg-app` | `#0d1117` **or** `#0D0E12` ⚠ | `index.css:24` / `tokens.js:4` |
| `--ft-bg-card` | `#161b22` **or** `#15171E` ⚠ | `holoTheme.js:9` / `tokens.js:5` |
| `--ft-bg-elevated` | `#21262d` | `App.jsx:1088` — ⚠ also serves as a *border* in two modules (§3.4) |
| `--ft-bg-agent` | `#1C1A27` | `tokens.js:6` |

**Base tier — text**

| Token | Candidate value | Note |
|---|---|---|
| `--ft-text-primary` | `#e6edf3` (199) **or** `#e2e8f0` ⚠ | Two interleaved ramps that do not align — §3.4 |
| `--ft-text-secondary` | `#8b949e` (561 — most-used hex in the repo) | |
| `--ft-text-muted` | `#6e7681` (270) | `#6b7280` (157) is drift, 7 co-occurring files |

**Base tier — accents**

| Token | Value | Occurrences |
|---|---|---:|
| `--ft-cyan` | `#00d9ff` | 369 |
| `--ft-teal` | `#5eead4` | 286 |
| `--ft-emerald` | `#10b981` | 394 |
| `--ft-amber` | `#f59e0b` | 413 |
| `--ft-red` | `#ef4444` | 515 |
| `--ft-purple` | `#8b5cf6` ⚠ **not** `#9333ea` | 152 vs 24 — the existing `--purple` names the wrong one (§3.4) |
| `--ft-blue` | `#3b82f6` | 87 |
| `--ft-gold` | `#F0C75E` ⚠ | 51; competes with `#ffd700`, `#fbbf24`, `#ffc107` (3, dead) |

**Additions the spec's list omits but the census demands** (§3.2): `--ft-scrim-rgb` (`255,255,255` — 838 occurrences; see S9 on naming), a name for `0,0,0` (202, currently unnamed anywhere), and the Tailwind gray ramp (380 combined) — or an explicit decision to leave them unmigrated.

**Semantic tier** (per D2 — all map to base)

`--ft-accent` → cyan · `--ft-warp-tint` → accent · `--ft-success` → emerald · `--ft-danger` → red · `--ft-warning` → amber · `--ft-game-baggerbomb` → amber · `--ft-game-draft` → emerald

⚠ **Architecture constraint from §6:** if these are authored as `var()` aliases, A1/A2/A3 cannot assert real values under test. Either author them as flat literals, or accept text-based assertions. **Rule on this before Phase 1.**

**D7 triplet companions** — evidence-ranked: `255,255,255` (838 occ / 25 alphas / 189 files), `0,0,0` (202/23/105), `0,217,255` (cyan), `239,68,68` (red), `245,158,11` (amber), `16,185,129` (emerald), `94,234,212` (teal). All seven exceed the "used translucently at many alphas" bar D7 sets. See S9 for the naming rulings that must precede them.

---

## 8. Defects found outside task scope

Per BUILD_RULES §3 — **reported for separate tasking, not fixed.** None was touched.

| # | Defect | Citation | Severity |
|---|---|---|---|
| D-1 | `--accent-glow` consumed with no fallback but **declared nowhere in the repo** — `@keyframes card-select-pulse` emits an invalid box-shadow and is inert. Masked only because `draft/HoloAssetCard.jsx:818` re-declares the same keyframe name at runtime with an interpolated value. | `src/index.css:419-420`, `src/constants/animations.js:469-470` | Ships broken today (cosmetic) |
| D-2 | `src/constants/index.js` re-exports **four symbols that do not exist**: `holoTheme` (`:12`), `getSectorColor`/`getSectorIcon` from `./sectors` (`:13`), `animations`/`springConfigs` from `./animations` (`:11`). The build passes only because nothing imports this barrel. | `src/constants/index.js:11-13` | Latent build break |
| D-3 | `LIGHT_TOKENS` is missing `warmCopper`, which `DARK_TOKENS` defines. `discover/WatchListEventCard.jsx:51` returns `tokens.warmCopper` with no fallback → `undefined` in light mode. (`Forge/workshop/forgeKit.jsx:63` has a hardcoded fallback, so it is partially protected.) | `src/theme/tokens.js:23` vs `:48-80` | Latent (light mode unreachable — see D-10) |
| D-4 | Light mode has **never worked**. `toggleMode` (`ThemeContext.jsx:13`) is defined and called from nowhere; `mode` is hardcoded `'dark'` (`:7`) with no persistence; all 64 consumers destructure only `{ tokens }`. 3 of the 4 direct importers bypass the provider entirely. Light mode is greenfield, not a migration. | `src/contexts/ThemeContext.jsx:7`, `:13` | Feature does not exist |
| D-5 | `src/App.css` (42 lines) is **imported by nothing**, yet 10 files carry `// Style override to neutralize App.css` comments defending against a stylesheet that has not loaded in some time. | `src/main.jsx:5-6`; `src/App.jsx:1464` + 9 screens | Dead code + misleading comments |
| D-6 | 26 `hexToRgba` implementations + 5 `alpha()` implementations with **seven different fallback behaviours**. `Agent/GameplanMeetingCard.jsx:6` has no guard and emits `rgba(NaN, NaN, NaN, a)`. | 26 sites, incl. `GameplanMeetingCard.jsx:6` | Real, latent |
| D-7 | Reporter "Alex" has **two brand colours**: `#E05DBF` drives the UI, `#FF6B6B` drives LLM prompt copy. The other five personas agree across both files. One-line fix, needs a ruling on which is correct. | `src/constants/reporterTheme.js:8` vs `src/prompts/fantasyTimesPrompts.js:23` | Display-integrity (§9-adjacent) |
| D-8 | Tailwind **v3 directives on a v4 toolchain**: `package.json:50,61` pin `tailwindcss ^4.1.16` + `@tailwindcss/postcss`, but `index.css:1-3` uses v3 `@tailwind` directives with no `@config` reference. Separately `tailwind.config.js:59` calls CommonJS `require("tailwindcss-animate")` inside an ESM module. | `src/index.css:1-3`, `package.json:50,61`, `tailwind.config.js:59` | Needs a build to diagnose |
| D-9 | Six `colors`-prop receivers are **never rendered**: `PvpCommandCenter`, `BattleActionCards`, `TrainingModePanel`, `SlotMachineOverlay`, `GameModeCards`, `WeeklyChallengesPanel`. Deleting them removes ~20% of Class 1 for free. | 6 files, all zero render sites | Dead code |
| D-10 | `DraftAdvisor.jsx:393` destructures a `colors` prop its only live render site (`DraftRoomScreen.jsx:1181`) never passes — silently falls back to hardcoded `'#00d9ff'` at `:653/:737/:788`. | `src/components/DraftAdvisor.jsx:393` | Silent fallback |
| D-11 | **Archetype identity colours conflict.** `data/archetypeCharacter.js:57-137` assigns each archetype a two-stop gradient; `League/draft/boardModel.js:15-22` assigns entirely different single tints for the same 6 keys. `archetypeCharacter.test.js:26-33` pins the first set. | Both files | Product question |
| D-12 | **Six independent sector palettes**; 10 of 12 sectors resolve to a different colour depending on which is imported (Healthcare `#10b981` vs `#14b8a6`; Financials `#f59e0b` vs `#22c55e`; Utilities `#f97316` vs `#64748b`). | `constants/sectors.js:4-93`, `constants/holoTheme.js:131-164`, `App.jsx:255-288`, `draft/HoloAssetCard.jsx:21-59`, `BaggerBomb/NotesTab.jsx:19-31`, `SnakeDraft/DraftCompleteScreen.jsx:53-80` | Product question, visible |

`docs/DESIGN_TOKENS.md` is also stale and should be marked DEPRECATED or regenerated — 7 months 17 days old (`:3`), both cited line ranges wrong by 274 and 373 lines, publishes `cardBg: '#161b22'` where `App.jsx:1085` has `#1a1f2e` (this is a **key rename**, not a recolor — `#161b22` became `cardInner` at `:1086`), and covers only 3 of the live token sources. Point accuracy 58/66 = 87.9%; coverage ~23%. **Do not let anyone migrate against it.**

---

## 9. Recommendation

Task 1's *intent* is right and the codebase needs it more than the spec assumes — 7,207 hex literals across 457 files, four disjoint token systems, and a `:root` tier that 19/22 of nothing consumes.

But Task 1 **as specified** would migrate 0.14% of the hex surface in two files nobody renders, write its tokens into a path that already holds a load-bearing module, author them into a cascade layer that defeats overrides, and ship an acceptance matrix whose first three rows cannot compile.

Suggested re-scope for spec V2, in dependency order:

1. **Rule S4 and S5 first** — the background value and the canonical palette. Everything else is downstream; no token values can be written until these are fixed.
2. **Phase 1 = define only**, in a fresh `src/theme/tokens.css` with a bare `:root{}` (dodges Blocker 2 and S6), plus a new sibling JS module (dodges S2). Nothing consumes it. Genuinely inert.
3. **Adopt the proven test strategy** from §6 — fs-read + `<style>` inject, zero config change, 7/7 demonstrated. Decide the alias-vs-literal architecture question at spec time.
4. **Re-point the pilot** at `CommandDashboard`/`CommandDashboardDesktop` (S1), with the H1–H7 hazard map as the checklist.
5. **Ship the guard as a vitest baseline test**, matching `archetypeRegistry.test.js` — zero CI change.
6. **Defer all consolidation** to a separate arc. Every merge in §3.4 violates zero-visual-change by construction.

**No code has been written. Awaiting founder rulings on S1–S10 and the §7 token list.**

---

*End of Phase 0 discovery. 14 agents (9 census + 5 adversarial verifiers), 0 errors, 47 verifier corrections folded in. Anchors verified at HEAD `db6f5ebc`; per BUILD_RULES §3, re-verify before relying on them in a later session.*
