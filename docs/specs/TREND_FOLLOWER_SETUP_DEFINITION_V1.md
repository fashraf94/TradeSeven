# Trend Follower Setup Definition — V1 (Companion 1 to the Pilot Spec)

**Date:** 23 September 2026 · **Author:** Fable (structure, per R5's Regime Taxonomy method) · **Numbers:** **Blessed by founder, 24 Sep 2026** — every slot at the value shown; this is the version that gates the P3/P4 build prompts. · **Destination:** `docs/specs/`.
**Scope:** BaggerBomb pilot, completed **daily** bars only (R9). This document also owns the pilot's **horizon translation table** (spec §2.5). The evaluator built from this definition is P3: a pure, deterministic, versioned module; its splice is P4's.

## 1. Evidence set (per symbol, completed daily bars only)

Required facts, each carried with `{source, asOf}` per spec §8.1; any fact missing, non-finite, or staler than the last completed session makes the verdict `unknown`:

| Fact | Definition | Slot |
|---|---|---|
| `C` | last completed daily close | — |
| `SMA_fast` | simple moving average of closes, length **20** | S1 |
| `SMA_slow` | simple moving average of closes, length **50** | S2 |
| `swingHigh`, `swingLow` | highest high / lowest low over the lookback of **20** completed bars (excluding today's bar) | S3 |
| `ATR` | average true range, length **14** | S4 |
| `V`, `V_avg` | last completed bar's volume; average volume, length **20** | S5 |

P3's Phase 0 maps each fact to the data actually available at HEAD; a fact the platform cannot supply from completed daily bars is not approximated — it is `unknown`.

## 2. Regime classification (the taxonomy)

Exactly one regime per symbol per evaluation, deterministic:

- **Uptrend:** `C > SMA_fast > SMA_slow` **and** `SMA_slow` today > `SMA_slow` **5** bars ago (S6).
- **Downtrend:** the mirror (`C < SMA_fast < SMA_slow`, `SMA_slow` falling over the same window).
- **No-trend:** everything else.

The Trend Follower's entry setups exist **only in Uptrend**. Regime is a fact in `factsUsed`, always recorded, including on `invalid` and `unknown` verdicts.

## 3. Entry setup — verdict `valid` requires regime Uptrend plus ONE pattern

**Pattern A — Breakout:** `C ≥ swingHigh` **and** volume confirmation `V ≥ 1.5 × V_avg` (S7).
**Pattern B — Pullback-and-resume:** the low of one of the last **3** completed bars touched or crossed `SMA_fast` (S8), **and** `C > SMA_fast`, **and** no volume requirement **none** (S9).
**Extension guard (both patterns):** `C ≤ SMA_fast + 2.0 × ATR` (S10) — a valid trend that has run too far is `invalid(extended)`, not a chase.

The verdict records which pattern satisfied (`setupPattern: breakout | pullback_resume`). Failing all patterns in Uptrend → `invalid(no_setup)`; outside Uptrend → `invalid(regime)`. Invalid reasons are typed, never prose.

## 4. Invalidation (for an activated hypothesis carrying this setup)

Any one, evaluated on completed daily bars, each a typed reason for spec §2.5's `activated → invalidated` row:

- `close_below_slow`: `C < SMA_slow`
- `structure_break`: `C < swingLow` recorded at activation (the anchor swing low is frozen into the version's evidence at deploy, not re-derived later)
- `regime_flip`: regime = Downtrend

Invalidation informs the hypothesis lifecycle and the brain's `wait(invalidated_setup)` intent; it **never fires a trade by itself** and never suppresses or replaces the deterministic protective layer, which keeps its own R3 outcomes.

## 5. Unknown — the abstention rule

`unknown` whenever any required fact for the tested pattern is unavailable; the verdict lists the missing facts. `unknown` forbids entry, is a truthful reportable state (language table B), and **never suppresses a protective action**. No fallback estimation, no partial evaluation reported as whole.

## 6. Horizon translation table (owned here; spec §2.5)

Hypothesis enum → review window, wall-clock market time (R6 method; never check counts). The clock anchors at the version's `firstDeployedAt`; the anchor session is the session containing it, or the **next** regular session if deployed outside regular hours; **one calendar for every symbol in v1, crypto included** (matching the call-record ruling). Expiry instant = the close of the Nth trading session after the anchor session, per the trading calendar (early closes honored):

| `horizonEnum` | Window N (trading sessions) | Slot |
|---|---|---|
| `intraday` | **2** — the shortest daily-basis window; the stated enum is preserved, and intraday evidence is never licensed (R9) | H1 |
| `swing` | **10** | H2 |
| `positional` | **30** | H3 |
| `longterm` | **60** | H4 |
| `unspecified` | no clock; `review_due` at battle end (spec §2.5) | — |

## 7. Determinism and versioning

The evaluator is a pure function of the §1 fact set and this definition's frozen threshold object. `setupVersion = tf-setup-v1` binds the structure **and** the blessed numbers (the threshold object is hashed into it); changing any number or rule mints a new `setupVersion`. `factsUsed` records every input with source and asOf. The version joins the evidence record per spec §8.2.

## 8. Blessing sheet — blessed 24 Sep 2026 (walked through slot by slot with Fable; every proposal accepted)

| Slot | Meaning | Blessed value |
|---|---|---|
| S1 | fast SMA length | 20 |
| S2 | slow SMA length | 50 |
| S3 | swing lookback (bars) | 20 |
| S4 | ATR length | 14 |
| S5 | volume average length | 20 |
| S6 | slow-SMA rising window (bars) | 5 |
| S7 | breakout volume multiple | 1.5× |
| S8 | pullback touch window (bars) | 3 |
| S9 | pullback volume rule | none |
| S10 | extension guard (ATR multiples above fast SMA) | 2.0× |
| H1–H4 | horizon windows (sessions) | 2 / 10 / 30 / 60 |

*V1 — structure authored per R5; numbers blessed by the founder 24 Sep 2026. `setupVersion = tf-setup-v1` binds exactly these values; any change mints a new version.*
