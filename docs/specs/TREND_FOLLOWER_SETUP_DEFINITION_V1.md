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

## Clarification C1 — 28 Oct 2026 (founder ruling FD-P3-1)

Appended by the Measured Trend Evidence slice 1 build (P3, the pure evaluator) under the founder's rulings of 28 Oct 2026. Nothing above this heading changes; the text is byte-identical to the blessed V1.

- **Missing facts are pattern-scoped (FD-P3-1, option (a)).** §1's "any fact missing, non-finite, or staler than the last completed session makes the verdict `unknown`" is read per §5: a missing fact makes `unknown` the conditions that consume it, not the whole verdict.
- `valid` requires a fully supported pattern (every check of that pattern true), the Uptrend regime, and a completed extension check.
- `invalid(regime)` requires only the regime facts (`C`, `SMA_fast`, `SMA_slow`, and `SMA_slow` five bars ago).
- `invalid(no_setup)` requires every pattern fully evaluable and failed.
- Otherwise the verdict is `unknown`, listing the missing facts. A missing breakout volume (`V` or `V_avg`) does not invalidate a supported pullback-and-resume.
- **Raw basis (FD-P3-2).** Every fact is computed on the raw (unadjusted) close, high, low and volume; the adjusted close serves only a split heuristic with stated limits, never a fact.
- Thresholds and patterns are unchanged, and `setupVersion = tf-setup-v1` is unchanged. This clarification is recorded under the semantics id `tf-setup-v1/sem-1` (`api/_utils/setupEvaluator/thresholds.js`, `SEMANTICS_NOTES`). Future rule changes (any number or pattern) remain subject to §7 and mint a new `setupVersion`.
## Clarification C2 — 28 Oct 2026 (founder rulings on the slice 1 questions; the record contract)

Appended by the Measured Trend Evidence slice 1 closeout under the founder's rulings of 28 Oct 2026 on the build's questions Q-TE-1 to Q-TE-13. Nothing above this heading changes, C1 included. Thresholds, patterns, `setupVersion = tf-setup-v1` and the semantics id `tf-setup-v1/sem-1` are unchanged, and no verdict changes.

**How the evaluator reads §1–§5:**

- **Unknown stays conservative (Q-TE-1).** A pattern with one check false and another check unknown is `untestable`, not `failed`, so the verdict is `unknown(missing_fact)` rather than `invalid(no_setup)`. Each check keeps its own result: `true`, `false` or `unknown`.
- **Holding history (Q-TE-2).** The holding checks need the same 55 completed bars as the adapter's window. Below that every holding check is `unknown`, and the record's `history` says so.
- **Corporate actions (Q-TE-3).** A window that straddles a basis discontinuity is refused as `basis_discontinuity`. Normalizing corporate actions is later adapter work.
- **Holding reasons (Q-TE-7).** `regime_flip` stays an explanatory reason, although a downtrend always also shows `close_below_slow`.
- **Non-session rows (Q-TE-9).** A window row dated on a weekend or a holiday is refused as `unordered_bars`, with `detail.why = 'non_session_date'`.
- **The anchor (Q-TE-11).** A null, non-finite or non-positive anchor swing low is unavailable, so `structure_break` is `unknown`.
- **Adjustment metadata (Q-TE-12)** is present only when every window row carries a finite adjusted close greater than zero.
- **The split heuristic (Q-TE-13)** trips when `1 − min / max` of two consecutive days' adjusted-to-raw ratios exceeds 0.10.

**The record contract (Q-TE-4, Q-TE-5, Q-TE-10).** The implemented field names are authoritative. Where §1–§5 call `regime` a fact in `factsUsed` and name the pattern `setupPattern`, the records carry the shape below.

- **Every record:** `ruleSet { setupVersion, thresholdsHash, semanticsId }`, `asOf`, `requestedAsOf`, `basis`, `source`, `sourceMeta`, `evidenceClass { bars, verdict: 'derived' }`, `evidence { bars, windows, pullbackLows, swingHigh, swingLow, volume, adjustment }`, `factsUsed` (the nine facts, each `{ value, asOf, source, basis }`), `missing` and `checks`.
- **Entry records:** `patterns`, `verdict`, `reason`, `pattern` (the definition's `setupPattern`), `patternsSatisfied` and `regime`. `regime` is a derived top-level field, not a fact in `factsUsed`. Pattern assessments belong on entry records only (Q-TE-5).
- **Holding records:** `regime`, `history { count, required, sufficient }`, `chartLeg`, `reasons` and `anchorSwingLow { value, provenance }`. They carry no `patterns`.
- **Refusal records** also carry `refusal { reason, detail, expected }`.
- **The bars class** is one of `later_reconstruction`, `contemporaneous` or `synthetic`. `synthetic` labels synthetic test evidence only (Q-TE-4). Provider evidence is never labelled `synthetic`, and historical replay bars are `later_reconstruction`.
- **The two dates.** On a record from ok evidence, `asOf` is the completed session the verdict is dated to and `requestedAsOf` is the caller's date. On a refusal record both are the caller's date, and `refusal.expected` is the calendar's expected session, or null when the refusal came before the calendar named one.
- **Provenance.** `sourceMeta` is the source's own `{ fetchedAt, from, to }`, copied with only the keys supplied, on refused evidence as on ok evidence. It is null when none was supplied, and it is never filled from the bars.
## Clarification C3 — 28 Oct 2026 (the numerical policy; the fix round after the independent review)

Appended by the Measured Trend Evidence slice 1 fix round after Astra's independent review of PR #1001 (finding F1). Nothing above this heading changes, C1 and C2 included. Thresholds, patterns, operators, `setupVersion = tf-setup-v1` and the semantics id `tf-setup-v1/sem-1` are unchanged. This completes the initial `sem-1` implementation before its baseline is accepted.

- **Boundaries are met in decimal.** The derived thresholds are computed exactly on the decimal values of their operands, never in floating point and never with a tolerance:
  - the extension guard `SMA_fast + 2.0 × ATR`, from the two 4-decimal facts as they are;
  - the breakout volume floor `1.5 × V_avg`, with `V_avg` the exact mean of the twenty volumes;
  - the split heuristic's two adjusted-to-raw ratios, compared by exact cross-multiplication.
- **Equality follows the approved operator.** A close exactly at the guard passes the inclusive extension check. A volume exactly at the floor passes the inclusive volume check. A split step of exactly 10% does not exceed 0.10, so it never trips.
- **The record explains itself.** A check records each threshold as the double nearest its exact value, and every recorded result is the plain comparison of the recorded `lhs` and `rhs`. A tripped split step records both days' raw and adjusted closes in the refusal's detail.
- **Nothing else is rounded.** No raw price, volume or `V_avg` is rounded to a fixed number of decimals. SMA and ATR keep their 4-decimal values.
