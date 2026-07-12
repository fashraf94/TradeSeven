# LEVELSTORY — RULINGS & AMENDMENTS (SESSION 5 — FEATURE LAYER)

**Status:** Spec amendments of record for Session 5 — `04-features.js` + `lib/features*.js`: every feature the study conditions on, all `pre_touch`, none of them outcomes. Recorded per the S5 prompt §2.
**Session:** LevelStory Session 5 on branch `claude/level-study-session5-feature-layer` (cut from the unmerged S4.1 tip `1b8b499e`).
**Config:** `STUDY_CONFIG_VERSION = 3` (unchanged). This session's config edits are pre-registration amendments (§A below) and one pre-registered bucket definition — none alters a computed artifact value of levels/events.
**Precedence:** this document → S4 → S3.5 → S3 → S2 → Addendum → parent spec.

---

## ⚠ THE FREEZE RULE (standing; binds every later session)

**Once Session 6 computes a single outcome, the pre-registration is frozen forever.** No question, cell, bucket, or floor may be amended after outcomes exist. Amending an engineering acceptance gate on build diagnostics is normal; amending a research criterion after seeing outcome data is fraud. **Session 5 is the last session in which any pre-registration change is legitimate.** The two amendments below (and the S5-C1 bucket edges) are made strictly before any outcome data exists.

## §A — Pre-registration amendments (founder-ruled, 2026-07-12, before any outcome exists)

### S5-A1 — P4 re-registered as F1 vs F2 (the F3 cell is dead)

**Evidence:** F3 events number 3–12 per symbol across the whole 36-month window; split by side and restricted to SHARP_REJECT the F3 cell lands in low single digits — structurally below any honest floor, permanently.
**Amendment:** P4 = *"Does family tier (**F1 vs F2**) predict `held_EOD` within SHARP_REJECT, per side?"* F3 events are **not discarded**: they pool into F2+ wherever F2+ gates (P1/P2/P3/P6 unchanged) and appear in the exploratory appendix as a descriptive footnote. Only P4's primary comparison changes. Config: `primaryQuestions.P4` (compare `['F1','F2']`, `f3Disposition`). Reporter: `04-features.js:buildBudgetReread` (P4 cells + `F3_footnote`).

### S5-A2 — Unique-dates floor (new acceptance criterion)

**Evidence:** in-sample events span ~609 unique dates across ~609 sessions — every session fires. The date-clustered bootstrap (parent §11.2) resamples *dates*, so a cell's **effective** n is its unique-date count; n=60 on 12 dates is far weaker than n=60 on 50, and the raw-n floor cannot tell them apart.
**Amendment:** every reported cell carries **`uniqueDates`** alongside `n`; acceptance gains **`uniqueDates ≥ 15`** in addition to `n ≥ 30`; a cell failing either is `UNCONFIRMED`. Config: `honesty.acceptance.minUniqueDates: 15`. Wired into the §7 re-read (`04-features.js`) and retrofitted into the S4 checkpoint reporter (`03-detect-events.js:sideCells` now carries per-side uniqueDates + combined verdict).

---

## §B — The availability contract (implemented; the spine of the session)

1. **Every feature carries a class** in `lib/features.js:FEATURE_MANIFEST` (63 features: 60 `pre_touch`, 3 `post_touch`). `assertAvailabilityClosure` is a machine-checkable assertion run at every assembly — an unregistered key, a post key emitted as pre, or a missing key throws (`tests/26` §6.5).
2. **The touch-bar rule** (restated from S4's rulings, enforced §6.1): `touchAt` is the touch bar's open label; the bar itself is post-touch information. **No feature reads any 5-min bar at or after the touch bar** — the boundary is one line (`features-intraday.js:preTouchBars`). The leak test poisons the touch bar + every later bar (×1000 prices, ×1e6 volume) and asserts byte-identical `pre_touch` output.
3. **Daily features use D−1** — every daily/weekly/monthly computation takes the event-date index `i` and reads indices ≤ `L = i−1` only (`features-daily.js`); §6.2 poisons the event-date daily bar and asserts identity; §6.2b does the same for the whole-universe market context.
4. **Cross-symbol features respect the boundary**: ETF direction tags use the last ETF bar whose window ends at or before `touchAt` (`etfDirectionAtTouch`; a bar containing the touch is never used — §6.3 constructs a mid-ETF-bar touch).
5. **`post_touch` = exactly** `peer_level_event_rate_next_5d`, `sessions_to_next_earnings_actual`, `expected_vs_actual_earnings_error` — descriptive-only, barred from every predictive cut, stored under `features.post_touch`.

## §C — Session-5 choice register (⚠, greppable as `S5-C*`)

| # | Choice | Value | Where |
|---|---|---|---|
| S5-C1 | P3 RVOL bucket edges (pre-registered, pre-outcome) | LOW <0.8, MID 0.8–1.5, HIGH ≥1.5 (1.0 = time-matched normal) | `config.features.fingerprint.rvolApproachBuckets` |
| S5-C2 | daily_atr_pctile window | trailing 504, min 252 non-null (reuses the extension floors) | `features-daily.js:trailingPctile` |
| S5-C3 | range_compression | 20-day range ÷ ATR, pctile vs trailing 504 (LOW = coiled) | `features-daily.js:higherTfAt` |
| S5-C4 | uniform touch-bar rule | NO field of the touch bar is read — touch on the session's first bar nulls every intraday feature (no opening-print allowance) | `features-intraday.js`; `tests/27` |
| S5-C5 | approach_velocity span | requires a bar ≤ 90 min before the last pre-touch close, velocity over the actual span; else null (nulls most open-bucket touches — honest, reported) | `features-intraday.js` |
| S5-C6 | weekly/monthly aggregation | partial current period included as latest bar for SMA/trend/ATR; HH/LL structure uses the last 3 COMPLETED periods | `features-daily.js:aggregate/hhllState` |
| S5-C7 | beta / excess | β = 60d OLS vs SPY (exact-date pairs, ≥⅔ coverage); `beta_adj_excess_20d = r20 − β·spy20` | `features-daily.js:betaAt` |
| S5-C8 | ETF direction | last fully-completed ETF bar close vs the ETF's prior-session close → UP/DOWN/FLAT; a bar ending exactly at touchAt is complete | `features-intraday.js:etfDirectionAtTouch` |
| S5-C9 | prior_probe_count | mechanical read = **structural 0** under the S4 episode model (touchAt is the episode's first zone entry); retained as a schema hook, reported as constant | `features-intraday.js`; S5 report |
| S5-C10 | rs_vs_sector dedup | the 5/20/60-day sector-relative returns appear once (relative layer); the group layer carries `sector_rs_vs_spy_20d/60d` + `rs_rank_in_group` (config named the same returns in §8.4 and §A2.2) | `lib/features.js` manifest |
| S5-C11 | same-day earnings | a report dated the event date is NOT assumed known pre-touch (BMO/AMC indistinguishable → conservative ≤ D−1) | `features-daily.js:earningsAt`; `tests/29` |
| S5-C12 | expected earnings | last known report + median inter-report session gap, signed (negative = overdue); report date → first session ≥ date | `features-daily.js` |
| S5-C13 | leg mechanics | advances measured on closes with ATR at the advance bar; leg extreme on aHigh/aLow; sideways reset also kills pre-band candidates | `features-daily.js:legOriginAt` |
| S5-C14 | base definition | ≥10 consecutive sessions inside a 2.5·ATR(run-start) band, occurring after the leg advanced ≥3 ATR; **left-anchored** non-overlapping greedy (a drifting channel can split or miss a maximal window — accepted; base machinery is S7-graded, demote-don't-tune) | `features-daily.js:baseCountAt` |
| S5-C15 | momo meter details | rank at T−21 (parsed from config `rankAt`) as of the formation's prior close; basket perf = rel-SPY return over exactly `spreadWindowSessions` (20) ending D−1 (review fix — was a hardcoded 21); ties (singleton sectors demean to 0) break by raw momentum then symbol, never sector spelling; slope compare carries a 1e-9 float epsilon | `features-market.js` |
| S5-C18 | benchmark staleness | relative-return benchmarks require EXACT same-session date matches at both window endpoints (shared NYSE calendar); a stale/truncated benchmark window → null, never a real-looking number (review fix) | `features-daily.js:benchRetBetween` |
| S5-C19 | move_origin availability | the gap-vs-earnings classification sees only reports on sessions ≤ D−1 (review fix: an event-day report next to a fresh gap must not flip it to EARNINGS_GAP pre-touch; regression-tested) | `features-daily.js:dailyFeaturesAt`; `tests/28` |
| S5-C20 | checkpoint vocabulary | budget checkpoints label a floor-failing cell `UNDERPOWERED` (pre-outcome power language); the S6+ acceptance gate renders the same failure `UNCONFIRMED` (honesty.verdicts) — one condition, two stages, recorded to prevent display disagreement | `config.js` acceptance comment |
| S5-C16 | intraday distance conventions | `dist_from_opening_range` signed to the nearest OR30 boundary (+outside/−inside); `dist_from_session_extreme` measured from the approach-origin extreme (support: pre-touch high) | `features-intraday.js` |
| S5-C17 | knownAt | end timestamp of the last pre-touch 5m bar (else the prior session's final regular bar); data-derived, never wallclock | `lib/features.js` |

## §D — Known limitations (stated, not fixed — the expansion evidence)

1. **Peer features are ~100% null at 11 symbols.** The largest sector (XLK) has 5 members → 4 peers < `minEligiblePeers` (5), so every peer-rate feature and `rs_rank_in_group` is null for every symbol. The null condition is doing its job; per-feature null rates are printed by `npm run features` and stored in `_stats.json`. This is concrete input #1 to the founder's universe-expansion decision.
2. **`momo_regime` is not trustworthy at 11 symbols** — deciles are ~1 name. Built correctly, computed, tagged; flagged in the runner output. Input #2.
3. **Sector-relative features are null for 6 of 11 symbols** — only XLK/XLE daily+5m context is in the frozen probe (universe-freeze note: full SPDR set arrives with expansion). `sector_direction_at_touch` exists only for the XLK names.
4. **`peer_confirmations_same_session_before_touch` is a null STUB** — `confirmationAt` does not exist until Session 6; populated there (recorded explicitly, availability class already `pre_touch` per its `< touchAt` rule).
5. **`prior_probe_count` is structurally 0** (S5-C9) under the S4 episode model.

*Recorded 2026-07-12 — LevelStory Session 5.*
