# Release 3 — Lean displayNames · review artifact (for Flash)

**Status:** FIRST PASS — for Flash to edit before ship.
**Date:** 2026-07-15
**Source of names:** a 3-lens naming panel (essence / trader-vernacular / plain-clear) + a
synthesis pass. Shipped in `src/data/characterLeanPresentation.js` → `LEAN_DISPLAY_NAMES`.

## What this is (and is not)

`displayName` is **UI chrome only** — the short human title shown as the lean-card heading
**above** the unchanged, verbatim `AGENT DIRECTIVE`. It never replaces the directive and
never feeds the prompt/gate (those read `id` / `canonical` / `policy` only). Editing any name
here is safe — change the value in `LEAN_DISPLAY_NAMES` and update this table.

## Constraints the set already honors

- **Shared directives share a name** (edit them together):
  - `Reduce position size on new entries` → **Smaller Entries** — TF-05, CN-07, SP-06, DV-06, FI-07
  - `Tighten the downside stop` → **Tighter Stop** — CN-03, SP-01
  - `Raise the quality bar` → **Higher Quality** — CP-01, FI-01
  - `Concentrate into … quality names` → **Quality Conviction** — CP-06, FI-05
- **Conflict-group opposites read as opposites** (the two ends a user can't hold at once):
  - Sell Into Strength (CN-05) ↔ Ride The Reversal (CN-08) — `CN-G1` profit-taking eagerness
  - High Conviction (SP-04) ↔ Wider Net (SP-05) — `SP-G1` concentration breadth
  - Breathing Room (CP-04) ↔ Tighter Leash (CP-05) — `CP-G1` stop width
  - Trim The Creep (DV-03) ↔ Slight Tilt (DV-05) — `DV-G1` rebalance eagerness
  - Patient Hold (FI-03) ↔ Cut Dead Money (FI-04) — `FI-G1` rotation patience
  - Quality Conviction (FI-05) ↔ Wider Quality (FI-06) — `FI-G2` concentration breadth

## ⚑ Flags to resolve (panel was uncertain)

- **TF-08 "Pause After Fails"** — "Fails" as a noun reads a little awkward. Alt: *Pause On Failure* / *Cool Off*.
- **CP-08 "Stronger Catalyst" vs FI-08 "Timely Catalyst"** — both are "stronger catalyst" directives;
  CP-08 is *fundamental*, FI-08 is *near-term*. Names kept distinct on that basis — confirm the split reads.
- **FI-06 "Wider Quality"** — slightly abstract; it's the FI-05 opposite (spread vs concentrate). Alt: *Broader Quality*.
- **CP-05 "Tighter Leash"** — deliberately NOT the shared "Tighter Stop", so it pairs cleanly against
  CP-04 "Breathing Room" within Capital Preserver. Confirm you want it distinct from CN-03/SP-01.

---

## Trend Follower (`momentum_chaser`)

| ID | displayName | Verbatim directive (source of truth) | Policy | Note |
|----|-------------|--------------------------------------|--------|------|
| TF-01 | **Fresh Breakouts** | Prefer fresh breakouts over extended / late-stage entries | risk↓ | founder example |
| TF-02 | **Confirm First** | Require stronger confirmation before entering | risk↓ | |
| TF-03 | **Strongest Sectors** | Narrow to the single strongest sector(s) | conc→tighter | |
| TF-04 | **Let Winners Run** | Give winners more room before rotating out | horizon→longer | |
| TF-05 | **Smaller Entries** | Reduce position size on new entries | risk↓ | shared (×5) |
| TF-06 | **Liquid Names** | Avoid low-liquidity / thin momentum names | risk↓ | inverts directive but honest |
| TF-07 | **Chart First** | Lean harder on the stock's own technicals before acting | risk↓ | |
| TF-08 | **Pause After Fails** ⚑ | Pause adds after a failed breakout | risk↓ | "Fails" awkward |

## Contrarian (`contrarian`)

| ID | displayName | Verbatim directive | Policy | Note |
|----|-------------|--------------------|--------|------|
| CN-01 | **Deeper Washout** | Require a deeper washout before entering (greater oversold depth) | risk↓ | |
| CN-02 | **Confirmed Turn** | Require a clearer technical turn/stabilization before entering | risk↓ | |
| CN-03 | **Tighter Stop** | Tighten the downside stop | risk↓, horizon→shorter | shared (CN-03/SP-01) |
| CN-04 | **Most Hated** | Lean harder into the most out-of-favor / lagging names | — | vernacular |
| CN-05 | **Sell Into Strength** | Take profit more eagerly into resistance | risk↓, horizon→shorter | ↔ CN-08 |
| CN-06 | **Fundamental Backing** | Demand a stronger fundamental reason underneath the name | risk↓ | |
| CN-07 | **Smaller Entries** | Reduce position size on new entries | risk↓ | shared (×5) |
| CN-08 | **Ride The Reversal** | Hold longer for the reversal before trimming (more patient profit-taking) | horizon→longer | ↔ CN-05 |

## Speculator (`degen`)

| ID | displayName | Verbatim directive | Policy | Note |
|----|-------------|--------------------|--------|------|
| SP-01 | **Tighter Stop** | Tighten the downside stop | risk↓, horizon→shorter | shared (CN-03/SP-01) |
| SP-02 | **Tamer Volatility** | Hunt slightly-less-extreme volatility (still high-ATR, not top decile) | risk↓ | |
| SP-03 | **Fewer Swings** | Trade less frequently — fewer, more-committed swings | horizon→longer | |
| SP-04 | **High Conviction** | Concentrate into fewer high-conviction movers | risk↑, conc→tighter | ↔ SP-05 |
| SP-05 | **Wider Net** | Spread across more names (diversify the chaos) | conc→wider | ↔ SP-04 |
| SP-06 | **Smaller Entries** | Reduce position size on new entries | risk↓ | shared (×5) |
| SP-07 | **Stronger Trigger** | Require a stronger momentum/technical trigger before piling in | risk↓ | |

## Capital Preserver (`guardian`)

| ID | displayName | Verbatim directive | Policy | Note |
|----|-------------|--------------------|--------|------|
| CP-01 | **Higher Quality** | Raise the quality bar (demand cleaner fundamentals) | risk↓ | shared (CP-01/FI-01) |
| CP-02 | **Calmer Names** | Tighten the volatility ceiling (even lower-beta names) | risk↓ | |
| CP-03 | **Weather The Noise** | Hold longer through noise before considering an exit | horizon→longer | |
| CP-04 | **Breathing Room** | Widen the stop slightly (more patience on good positions) | horizon→longer | ↔ CP-05 |
| CP-05 | **Tighter Leash** ⚑ | Tighten the stop slightly (exit a touch sooner on damage) | risk↓, horizon→shorter | ↔ CP-04; distinct from "Tighter Stop" |
| CP-06 | **Quality Conviction** | Concentrate into fewer highest-conviction quality names | conc→tighter | shared (CP-06/FI-05) |
| CP-07 | **Steady Spread** | Spread wider for stability (more diversification) | conc→wider | |
| CP-08 | **Stronger Catalyst** ⚑ | Require a stronger fundamental catalyst before adding | risk↓ | vs FI-08 (fundamental vs near-term) |

## Diversifier (`diversifier`)

| ID | displayName | Verbatim directive | Policy | Note |
|----|-------------|--------------------|--------|------|
| DV-01 | **Tighter Focus** | Tighten the concentration cap (thinner per sector) | conc→tighter (→ more spread) | founder example |
| DV-02 | **More Sectors** | Widen the spread (target more sectors) | conc→wider | |
| DV-03 | **Trim The Creep** | Rebalance a creeping sector sooner | conc→tighter, horizon→shorter | ↔ DV-05 |
| DV-04 | **Equal Weight** | Even out the slot distribution (more equal weighting) | conc→wider | |
| DV-05 | **Slight Tilt** | Allow a slight tilt within the cap (let a winner run toward the limit) | horizon→longer | ↔ DV-03 |
| DV-06 | **Smaller Entries** | Reduce position size on new entries | risk↓ | shared (×5) |
| DV-07 | **Fill The Gaps** | Prioritize filling an under-represented sector on the next add | conc→wider | |

## Fundamental Investor (`analyst`)

| ID | displayName | Verbatim directive | Policy | Note |
|----|-------------|--------------------|--------|------|
| FI-01 | **Higher Quality** | Raise the quality bar (demand stronger fundamentals) | risk↓ | shared (CP-01/FI-01) |
| FI-02 | **Cleaner Setup** | Require a cleaner technical setup before committing | risk↓ | |
| FI-03 | **Patient Hold** | Hold a stalled quality name longer before rotating (more patient) | horizon→longer | ↔ FI-04 |
| FI-04 | **Cut Dead Money** | Rotate dead-money quality names sooner (more clock-aware) | horizon→shorter | ↔ FI-03 |
| FI-05 | **Quality Conviction** | Concentrate into highest-conviction quality names | conc→tighter | shared (CP-06/FI-05); ↔ FI-06 |
| FI-06 | **Wider Quality** ⚑ | Spread across more quality names | conc→wider | ↔ FI-05; slightly abstract |
| FI-07 | **Smaller Entries** | Reduce position size on new entries | risk↓ | shared (×5) |
| FI-08 | **Timely Catalyst** ⚑ | Demand a stronger near-term catalyst before adding | risk↓ | vs CP-08 (near-term vs fundamental) |
