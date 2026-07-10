# LEVELSTORY SPEC V1.1 — ADDENDUM A (CONTEXT LAYER) — REVISION V1.1

**Status:** Locks alongside parent Spec V1.1 at Session 0 — supersedes Addendum A v1.0
**Parent:** LEVEL_INTERACTION_EVENT_STUDY_SPEC_V1_1.md (all definitions, gates, and conventions inherited)
**Config:** All knobs below are part of `STUDY_CONFIG_VERSION = 1`
**Provenance:** v1.0 identified the context blind spot (group / regime / chapter / catalyst). This revision folds in the second ChatGPT adversarial review (Jul 2026). Findings accepted: peer-confirmation lookahead (split + rates), ~550-session warmup period, sign-normalized extension, P6 tightened to one primary endpoint, earnings-date availability (with expected-earnings proxy upgrade), NON_EARNINGS_GAP rename, sector-neutral regime meter, at-touch ETF bar completeness, dual trend-origin identity, context-snapshot immutability, four-view report structure. Premise correction: the reviewer assumed a 24-month range; the parent locked 36 months — the warmup finding survives regardless.

---

## A1. Framing

LevelStory V1.1 measures the event: the level, the reaction shape, the approach. This addendum measures the world the event happened in, on four layers:

| Layer | Story role | What it answers |
|---|---|---|
| Group confirmation | Supporting cast | Is anyone corroborating this story? |
| Regime & breadth | Genre | Is the market currently paying for momentum at all? |
| Run maturity & extension | Chapter | How far into the story is this, and is "extended" measured or felt? |
| Move origin | Plot engine | What started the story — earnings, some other gap, or nothing? |

**Standing rules:**
1. Every feature carries an availability class. `pre_touch` features use only data through D−1 close, or intraday data from bars **fully completed strictly before `touchAt`**. Anything else is `post_touch` and is barred from predictive analysis.
2. All features are **stored features**, never filters, in V1.1. No event is excluded because of context — this protects the dataset from "we only studied setups we already believed in."
3. **Snapshot immutability (review finding, accepted):** every event receives a nested context object at detection time, stamped `knownAt`, persisted with the event, and never recalculated later from revised or newly available data. The snapshot is the record.
4. No composite "context score" ever — §9 guard inherited. Every context fact displays separately.
5. Null-never-zero; every feature defines its null condition.

**Event context snapshot shape:**

```json
{
  "context": {
    "knownAt": "2025-11-17T15:00:00Z",
    "group":    { "...": "§A2 features" },
    "market":   { "...": "§A3 features" },
    "trend":    { "...": "§A4 features" },
    "catalyst": { "...": "§A5 features" }
  }
}
```

---

## A2. Layer 1 — Group confirmation (supporting cast)

### A2.1 Peer confirmation — lookahead fixed, rates not counts (review findings, accepted)

The v1.0 `peer_confirmation_count` used a ±5-session window: the +5 side is future information inside a `pre_touch` feature — a direct availability violation, caught in review. Replaced by:

| Feature | Window | Availability | Definition |
|---|---|---|---|
| `peer_level_event_rate_prior_5d` | D−5 … D−1 | `pre_touch` | Fraction of eligible peers with a qualifying same-side LevelStory event |
| `peer_fresh_extreme_rate_prior_5d` | D−5 … D−1 | `pre_touch` | Fraction of eligible peers printing a fresh 63-day high (support side) / low (resistance side) |
| `peer_confirmations_same_session_before_touch` | eventDate, pre-touch | `pre_touch` | Count of peers whose own `confirmationAt` occurred **strictly before this event's `touchAt`**. A peer pattern completed later in the session was not available to you. |
| `peer_level_event_rate_next_5d` | D+1 … D+5 | **`post_touch` — descriptive only** | Post-event corroboration, for narrative research; barred from predictive cuts |
| `eligible_peer_count` | — | `pre_touch` | Number of same-sector universe members (denominator for all rates) |

Rates, not counts — five of six peers ≠ five of twenty. Level events and fresh extremes stay **separate rates**, never blended: combining two different forms of confirmation into one number is a mini-composite and violates standing rule 4.

All rate features null when `eligible_peer_count` < 5.

### A2.2 Other Layer 1 features (unchanged from v1.0)

`rs_vs_sector_5d/_20d/_60d`, `sector_rs_vs_spy_20d/_60d`, `rs_rank_in_group` (null under 5 peers). Sector mapping to the 11 SPDR ETFs frozen with the universe.

### A2.3 At-touch direction tags — bar-completeness rule (review finding, accepted)

`sector_direction_at_touch` and `spy_direction_at_touch` are computed from the **last fully completed 5-min ETF bar strictly before `touchAt`** (session direction: that bar's close vs ETF session open). A bar whose window contains `touchAt` closes after the touch and is never used — a 10:00–10:05 ETF candle was not complete at a 10:03 touch.

---

## A3. Layer 2 — Regime & breadth (genre)

### A3.1 The momentum-regime meter — now sector-neutral (review finding, accepted)

The raw top-vs-bottom RS decile spread can be captured by sector rotation (tech dominating the leader decile, defensives the laggard decile) and mislabel one sector's leadership as broad momentum. Two versions, both point-in-time:

- **`raw_momo_spread_20d`** — v1.0 construction, kept as context: rank universe at T−21 by trailing 60-day return vs SPY; equal-weight top/bottom decile; spread of their T−21→T−1 returns.
- **`sector_neutral_momo_spread_20d`** — **drives the regime state:** at T−21, percentile-rank each stock *within its sector*; pool the within-sector percentiles across the universe; form leader/laggard deciles from the pooled percentiles; measure the same 20-session spread. Leaders and laggards are now drawn from across sectors by construction.

> **Disclosed caveat:** at ~150–200 names across 11 sectors (~16 per sector), within-sector ranks are noisy. Workable as a conditioning variable; disclosed in the footer; not a precision instrument.

**Regime state (knobs v1, computed on the sector-neutral spread):**

| State | Rule |
|---|---|
| `MOMO_ON` | spread ≥ +2.0% AND 5-session slope ≥ 0 |
| `MOMO_OFF` | spread ≤ −2.0% |
| `NEUTRAL` | everything else |

Null for the first 81 post-warmup sessions only if warmup data is unavailable (with §A6's warmup, regime state exists from study day one).

### A3.2 Breadth meters (unchanged from v1.0)

`breadth_pct_above_20dma/_50dma`, `nh_nl_net_63d` (universe-internal; survivorship caveat disclosed), `beta_appetite_20d` (SPHB−SPLV 20-day return spread), `vol_regime_pctile` (SPY 20-day realized vol vs trailing 2 years — warmup-dependent, see §A6).

---

## A4. Layer 3 — Run maturity & extension (chapter)

### A4.1 Trend anatomy — dual origin identity (review finding, accepted)

v1.0's single trend origin (lowest low in 252 sessions preceding a ≥4 ATR advance) can select an ancient low unrelated to the active leg — a stock that bottomed, ran, corrected deeply, and broke out again would date its "trend" from the old bottom. Two concepts, both stored:

- **`primary_trend_origin`** — v1.0 definition, kept for macro-narrative context (`gain_since_primary_origin_atr`, `days_since_primary_origin`).
- **`current_leg_origin`** — **drives extension percentile and base counting.** The most recent *confirmed and available* daily swing low (fractal k=3, availability rules inherited from parent §5.3) from which price has advanced ≥ 3.0 daily-ATR without a daily close below it. Mirror for resistance-side downlegs.

**Deterministic leg lifecycle rules (all knobs v1):**
- **Invalidation:** a daily close below `current_leg_origin` kills the leg; leg features null until a new origin qualifies.
- **Origin replacement (deep pullback reset):** a correction retracing > 50% of the leg's gain, followed by a new confirmed swing low and a fresh ≥ 3.0 ATR advance from it, replaces the origin with the new swing low.
- **Sideways reset:** a consolidation of ≥ 30 sessions within a 2.5 ATR close-to-close band ends the leg; the next directional exit defines a new origin at the consolidation's extreme.
- **Multiple qualifying origins:** most recent wins.

> **Fuzziness flag (expanded):** leg-origin detection joins base counting as the study's least deterministic machinery — the same class of problem as level lineage (entity resolution over time). Both get a dedicated grading slice in the Session-7 manual review (chart packets display detected origins and bases; Flash grades detection separately from event validity). Either component grading < 80% agreement demotes that component to exploratory-only for this version, with knobs revisited in V1.2. **P6's fallback if leg detection demotes:** extension percentile recomputed against `primary_trend_origin`-agnostic form (it only needs the 50DMA and ATR, so it survives; only `base_count` and leg-relative features demote).

`base_count` definition unchanged from v1.0 (≥10-session consolidations within 2.5 ATR after ≥3 ATR legs), now counted from `current_leg_origin`.

### A4.2 Extension — sign-normalized (review finding, accepted)

v1.0's `(close − 50DMA)/ATR` measures only *upward* extension: a stock deeply extended below its 50DMA sits at the bottom of that distribution, and resistance-side events' most-extended setups would be invisible to the EXT bucket — exactly the S/R false-symmetry the parent's §10.2 exists to catch.

- **`extension_in_trend_direction_atr`** — support-side events: `(close − 50DMA) / ATR`; resistance-side events: `(50DMA − close) / ATR`. Positive always means "extended in the direction the event would continue."
- **`extension_pctile`** — percentile of today's sign-normalized value against the same stock's trailing 504-session **sign-normalized series for that side**. Null if < 252 sessions of history (with §A6's warmup, effectively never null in the study window).
- **Buckets:** `NOT_EXT` < 50th, `MID` 50–85th, `EXT` > 85th.

### A4.3 P6 — tightened to one primary endpoint (review finding, accepted)

v1.0's P6 was dozens of comparisons wearing one question's badge (2 sides × 3 regimes × 2 extension × 2 base-count × 3 outcomes). Re-registered:

> **P6 (confirmation-time), per side:** Among `SHARP_REJECT`-confirmed events at F2+ levels, does `EXT` vs `NOT_EXT` predict **`clean_bounce` from `entryAt`**?

- **Primary endpoint:** `clean_bounce` from `entryAt`. Nothing else carries the verdict.
- **Primary comparison:** `EXT` vs `NOT_EXT`, within each side (`MID` displayed, not tested).
- **Pre-registered interaction test:** does the EXT-vs-NOT_EXT difference differ across `momo_regime` states? (One interaction test, not three sub-verdicts.)
- **Secondary diagnostics (displayed, never verdict-bearing):** MFE at EOD, `held_EOD`, `fractionElapsedAtEntry`.
- **Exploratory only:** `base_count` splits; all `MID`-bucket comparisons.
- **Minimum meaningful difference (verdict requires all three):** ≥ 10-point `clean_bounce` difference; 90% date-clustered CI of the difference excludes zero; holdout direction agrees (parent §11.4 gates apply on top).
- **Sample-budget fallback (pre-registered, locked now):** if the Session-3/4 checkpoint projects either side's EXT or NOT_EXT cell under n=30, the interaction test drops first (regime becomes a within-table annotation); the per-side primary comparison is protected last.

**The decision map (unchanged in spirit from v1.0):** EXT underperforms only outside `MOMO_ON` → the veto is a regime rule; underperforms everywhere → keep it unconditionally; underperforms nowhere → it is pure missed-winner cost.

---

## A5. Layer 4 — Move origin (plot engine)

### A5.1 Origin classification (rename accepted)

| Value | Rule |
|---|---|
| `EARNINGS_GAP` | Gap ≥ 1.0 ATR within ±1 session of a *known* earnings date, at `current_leg_origin` or within its first 5 sessions |
| `NON_EARNINGS_GAP` | Same-size gap, no earnings within ±1 session. (Renamed from `NEWS_GAP` — the tool ingests no news; a non-earnings gap might be guidance, analyst action, sector moves, macro, or plain overnight repricing. The label states only what we measured.) |
| `NO_GAP` | Neither |

Null when `current_leg_origin` is null.

### A5.2 Earnings proximity — availability repaired (review finding, accepted; proxy upgrade)

Historical calendars record when earnings *ultimately occurred*, not when the date was *publicly known* — using the eventual date as a `pre_touch` feature leaks scheduling knowledge. Point-in-time scheduling history is not verifiable from our sources. Resolution:

- **`sessions_since_last_earnings`** — kept as `pre_touch` (the prior report was known; trailing-only).
- **`sessions_to_next_earnings_actual`** — kept but reclassified **`post_touch`, descriptive only** (useful for post-hoc research like "how many EXT failures sat 3 days before a report"; barred from predictive cuts).
- **`sessions_to_expected_earnings`** — **new, `pre_touch`, the predictive proxy:** last known report date + the company's median trailing inter-report gap (minimum 2 prior reports in-range, else null). Built entirely from trailing data — no leak possible — and approximates what a trader actually operates on. Roughly right is fine for a conditioning variable; the field stores its own `expected_vs_actual_error` (computed post-hoc, descriptive) so the proxy's accuracy is itself measured and disclosed.
- Every earnings record stores `earningsDate` + `earningsDateSource`.

Session-1 live verification of the EODHD earnings-calendar endpoint stands (coverage depth, accuracy vs 3 known reports); on failure, `move_origin` degrades to `GAP`/`NO_GAP` and all earnings features null out.

---

## A6. Warmup period (review finding, accepted — new section)

The context layer needs history *before* the study window: 504-session extension distributions, 2-year vol percentiles, 252-session origin searches, MA/ATR warmups, 81-session regime-meter spin-up. Without it, the first ~2 years of events carry null or shallow context and the study silently becomes "the recent half, conditioned."

- **Warmup range:** ≥ 550 trading sessions before study start, **daily grain only** (all universe symbols + SPY + sector ETFs + SPHB/SPLV). Intraday warmup is not needed by any feature — the 5-min depth constraint from parent §4.2 is unchanged.
- **Hard rule:** warmup bars build features only. No event detection, no outcomes, no aggregation touches them. The evaluation window (36 months, last ~7 months holdout) is unchanged.
- **Ingest guard:** the fetch stage tags every bar `warmup: true/false`; the event detector asserts it never fires on a warmup bar (unit test).
- **Cost:** ~215 symbols × 1 daily-range chunk ≈ +250 calls. Trivial. Build effort: real but bounded — this is why v1.0's "+0.5 session" estimate was light.

---

## A7. Report structure — four views per cohort (review structure, adopted)

Every reported cohort renders four views, in order:

1. **Pattern view** — level family tier, hourly class, approach fingerprint buckets, entry timing (`fractionElapsedAtEntry` distribution).
2. **Context view** — group leadership, regime state mix, breadth at event, extension bucket, leg maturity, move origin.
3. **Comparative view** — cohort outcome, sibling outcome, difference with 90% clustered CI, incremental lift (parent §11.3), n.
4. **Validation view** — in-sample vs holdout, symbol concentration, sector concentration, unique-event-date count.

Facts in four frames; still no score anywhere. This becomes the layout contract for `07-aggregate.js`'s `.md` report.

---

## A8. Data & schedule impact (revised)

- **Symbols:** +13 (11 sector ETFs, SPHB, SPLV) — daily for all; 5-min additionally for sector ETFs + SPY (direction tags).
- **New fetch ranges:** warmup (daily-only, ≥550 sessions) per §A6.
- **New endpoint:** EODHD earnings calendar, Session-1 verified.
- **Pipeline placement:** context features in `04-features.js`; `data/market/context_daily.json` (regime, breadth, per-day) built in the fetch stage; peer features need a two-pass structure in event detection (pass 1 detects all events, pass 2 computes peer rates from the completed event set with the availability windows of §A2.1).
- **Schedule impact (honest, revised):** **+1 to +1.5 sessions** vs the parent's 0–12 plan (warmup ingest, two-pass peer computation, leg-lifecycle rules, expanded manual-review slice). Absorbed by the Session 11–12 buffer, which was written for exactly this.

---

## A9. What this addendum deliberately does not do (unchanged)

No filtering on context. No industry-group leadership intelligence finer than sector (V2 — and the bridge to the Correlation Lab conversation, bookmarked). No analyst-estimate ingestion (`move_origin` + expected-earnings proxy are the V1 stand-ins; estimates are a V2+ decision taken only if these show signal). No market-timing claims — regime states are conditioning facts about the tape events lived in.

---

## A10. Updated pitfalls entries

| # | Pitfall | Mitigation |
|---|---|---|
| 18 | Context features drifting into filters | Standing rule 2; event set immutable within a version |
| 19 | Regime-meter lookahead | Deciles formed T−21 on trailing data, measured on completed sessions (§A3.1) |
| 20 | Base-count / leg-origin knob sensitivity | Dedicated manual grading slices; per-component demotion paths (§A4.1) |
| 21 | Earnings-calendar quality | Session-1 live verification; graceful degradation (§A5.2) |
| 22 | P6 cell starvation | Pre-registered fallback ladder, interaction drops first (§A4.3) |
| 23 | Universe-internal breadth ≠ market breadth | Footer disclosure; conditioning-only |
| 24 | **Peer-window lookahead (+5d future in a pre_touch feature)** | Split windows; same-session requires peer `confirmationAt` < our `touchAt`; next-5d descriptive-only (§A2.1) |
| 25 | **Missing feature warmup (shallow context in early events)** | ≥550-session daily warmup; warmup bars barred from outcomes; ingest guard test (§A6) |
| 26 | **Extension asymmetry (upward-only formula blinds resistance side)** | Sign-normalized `extension_in_trend_direction_atr`; per-side percentile series (§A4.2) |
| 27 | Earnings-date hindsight (occurred ≠ known) | Actual next-date reclassified descriptive; trailing-cadence expected-earnings proxy for prediction (§A5.2) |
| 28 | Sector rotation contaminating the regime meter | Sector-neutral spread drives regime; raw kept as context; small-group noise disclosed (§A3.1) |
| 29 | Incomplete ETF bars at touch | Last fully-completed bar strictly before `touchAt` (§A2.3) |
| 30 | Stale trend origin (ancient low anchoring the active leg) | Dual origins; deterministic leg lifecycle; leg drives extension and bases (§A4.1) |
| 31 | Context snapshot revisionism | `knownAt`-stamped snapshot persisted at detection, never recomputed (§A1) |

---

*The quiet thesis stands: "overextended" and "already had its run" are not wrong instincts — they are unconditioned ones. The context layer exists to find where they protect you and where they only cost you winners. Either answer is a win; the expensive state is not knowing. And this revision's own lesson mirrors the parent's: the availability rule has to be enforced feature-by-feature, because the leak found its way into the very addendum that wrote the rule.*

---

*LevelStory Spec V1.1 — Addendum A revision v1.1 — July 10, 2026 — supersedes Addendum A v1.0 — locks with parent at Session 0*
