# LEVEL INTERACTION EVENT STUDY — SPEC V1.1

**Codename:** LevelStory
**Status:** Design locked pending founder review (supersedes V1)
**Owner:** Flash (personal trading research — OFF the TradeSeven product critical path)
**Config version:** `STUDY_CONFIG_VERSION = 1` — unchanged; nothing was built against V1, so V1.1 defines the first built configuration. All threshold knobs are provisional; any post-build change increments the version, never reuses.

**Revision provenance:** V1.1 folds in the ChatGPT adversarial review (Jul 2026). Findings accepted: signal-time leak (three-timestamp model, dual studies), level lineage, availability-assertion fields, clustered statistics, episode-based re-arm, intrabar ambiguity handling, corporate-action alignment, S/R separation, confluence source families, momentum feature capture, options-timing outcome grid, incremental-lift robustness layer, revised build order (~10–12 sessions). Additions original to V1.1: sample-size budget (§13), holdout single-open rule (§11.4), hourly-bar self-construction (§4.4).

---

## 1. Purpose

Measure, with honest base rates, how stocks behave intraday when they interact with pre-registered daily support/resistance levels — conditioned on (a) the quality of the level, (b) the hourly confirmation pattern at the touch, and (c) the intraday micro-fingerprint of the approach.

**V1.1 reframing (the review's core correction):** every result must begin when the information became *observable and executable*, not when the pattern started forming. The study therefore splits into two parallel studies over the same events:

- **Touch-time study (anticipation).** Uses only information known at or before the first touch: level quality, lineage history, pre-touch fingerprint, higher-timeframe context. Answers: *could you have anticipated the reaction?*
- **Confirmation-time study (confirmation).** Uses the completed hourly confirmation class. All outcomes begin at the first tradable bar after confirmation completes. Answers: *after waiting for proof, how much move remained?*

The bridge between them — `moveBeforeConfirmation` vs `moveRemainingAfterConfirmation` — is the study's single most decision-relevant output for a short-dated options trader. It answers anticipate-vs-chase directly.

The output is NOT trade signals. It is a table of displayed facts shaped like:

> "SHARP_REJECT confirmed at daily support (structural+participation family confluence): from the post-confirmation entry bar, median remaining MFE +0.6 ATR vs median MAE −0.3 ATR, held EOD 64% of n=37 (90% clustered CI 51–75), holdout direction confirmed. Median 55% of the touch→EOD favorable move had already elapsed before entry."

Most buckets will show nothing. That is the point.

---

## 2. Scope and non-goals

**In scope (V1.1):**
- US equities, fixed frozen universe, regular session only (9:30–16:00 ET)
- Support AND resistance events, **analyzed separately as the primary view** (§10.2); pooling only if both sides independently demonstrate similar behavior
- Dual studies (touch-time / confirmation-time) over a shared event set
- Fixed outcome grid to +next EOD, with fine-grained timing columns (§9)
- Clustered statistical aggregation with holdout confirmation

**Out of scope (V1.1, explicitly deferred):**
- Sequence/story chains — **V2**. V1.1 prepares lineage (`levelFamilyId`, `sequenceIndex`, role history) so V2 bolts on with zero migration.
- Options overlay (DTE, delta bucket, IV percentile, spread, earnings proximity, realistic-entry option returns) — **V3, only after the underlying study survives validation.** The underlying study identifies direction and timing; the options layer determines tradability.
- Live signaling. EODHD intraday REST lags ~1 trading day — irrelevant historically, disqualifying live. Live requires the WebSocket feed and is a separate build.
- Any integration with TradeSeven. Zero fence contact, zero cron budget, zero Firestore. Local scripts, JSON artifacts. Do not import from the product codebase — copy the few helpers needed so the study can never create a dependency on fenced files.

---

## 3. The research contract (Session 0 deliverable — locked before any code)

Ten definitions that must be frozen in `config.js` before Session 1. All are v1 knobs.

1. **`touchAt`** — timestamp of the first 5-min bar whose range enters the level zone during a fresh-approach episode (§7).
2. **`confirmationAt`** — timestamp of the close of the confirmation window: the touch-containing hourly bar plus the next hourly bar (§8). The hourly class does not exist before this moment.
3. **`entryAt`** — open of the first tradable 5-min bar strictly after `confirmationAt`. If `confirmationAt` ≥ 15:55 ET, `entryAt` = next session's opening 5-min bar; the event is flagged `overnightEntry: true` and its confirmation-time outcomes carry the gap.
4. **Price basis** — one adjustment basis across all grains (§4.3). Events within ±2 sessions of a split/dividend ex-date are flagged `corporateActionAdjacent` and excluded from primary aggregation (counted in the report footer).
5. **Session rules** — regular session only. Pre/post-market bars dropped at ingest.
6. **Hourly bar alignment** — hourly bars are self-constructed from 5-min bars, 9:30-anchored (9:30–10:30 … 15:30–16:00). Never trust vendor hourly alignment (§4.4).
7. **Ambiguous-candle treatment** — adverse-first rule for same-bar target/stop collisions, with ambiguity counting (§9.3).
8. **Level lineage rules** — family matching, merge, split, retirement (§6).
9. **Episode re-arm rules** — fresh-approach requirement; time alone never re-arms (§7).
10. **Availability discipline** — every level source carries `formationDate`, `firstKnownDate`, `firstTradableDate`; events may only reference levels where `firstTradableDate ≤ eventDate` (§5.4).

---

## 4. Data requirements

### 4.1 Grains and sources

| Grain | Source | Use | Known quirks |
|---|---|---|---|
| Daily EOD | EODHD `/eod` | Level construction, ATR(14), RVOL baseline, higher-TF context | Fetch raw + adjustment factors (§4.3) |
| 5-min | EODHD `/intraday` interval=5m | Everything intraday: fingerprint, outcomes, AND self-built hourly bars | ~1 trading day lag (fine for research). Synthetic close-print bars (volume=null, zero-range OHLC) — strip defensively. Cumulative-volume anomalies — verify per fixture before parsing. |
| Weekly/Monthly | derived from daily | Higher-timeframe momentum context (§8.4) | — |

### 4.2 Universe and range

- **Universe:** fixed frozen list, **150–200 liquid names** (raised from V1's 75–125 per the sample-size budget, §13): Flash's trading universe plus liquid index-adjacent names, stratified to include mega-cap tech, low-volatility names, high-beta names, and gap-prone names (this stratification also feeds the manual-review sample, §12).
- **Range:** **36 months** (raised from 24), last ~7 months (~20%) reserved as holdout.
- **Session-1 verification (BZ.COMM lesson):** confirm actual EODHD 5-min history depth per symbol via live fixtures before locking the range. If 5-min depth is shallower than 36 months for part of the universe, the range shrinks to the verified floor and §13's budget is re-checked — never assume vendor depth.

> **Survivorship note:** using today's liquid names to study the past 3 years has mild survivorship bias. Acceptable — we study level mechanics, not stock selection — but it lives in the pitfalls ledger and every report footer.

### 4.3 Corporate-action alignment (review finding, accepted)

Split-adjusted daily levels paired with unadjusted intraday prices create invalid events around corporate actions. Rule: fetch raw prices plus adjustment factors; apply **one identical adjustment basis to every grain** at ingest. A per-symbol invariant test asserts daily close ≈ last 5-min close of the same session (tolerance 0.1%) across the full range; violations quarantine the symbol until explained.

### 4.4 Hourly bars are self-constructed (V1.1 addition)

Vendor hourly bars may be top-of-hour aligned (10:00–11:00), which would smear the touch bar across two of our confirmation bars. We aggregate our own 9:30-anchored hourly bars from the stripped 5-min series. One code path, one alignment, testable.

### 4.5 API budget

~200 symbols × 2 fetch endpoints × range chunks ≈ 1,500–2,500 calls for a full refresh. Trivial under the 100K/day cap. Cache raw responses to disk; never re-fetch what's cached.

---

## 5. Stage 1 — Level detection (point-in-time, availability-asserted)

### 5.1 Level sources (grouped into source families — review finding, accepted)

Raw methods are grouped into **source families**; confluence counts families, not methods, because an AVWAP anchored on a swing low shares information with the structural level built from that same swing, and daily/weekly pivots are cousins of the same OHLC arithmetic.

| Family | Methods (V1.1) |
|---|---|
| `structural` | Swing-based S/R clusters (fractal pivots, k=3 bars each side, trailing 120 sessions, 0.5% clustering, volume-weighted centroid) |
| `participation` | Anchored VWAP from most recent significant swing high / swing low |
| `calendar` | Classical daily pivots (PP/S1/S2/R1/R2 from D−1), weekly pivots from prior completed week |
| `psychological` | Round numbers ($5/$10 increments scaled by price band) — flag-gated `INCLUDE_ROUND_LEVELS`, default OFF |
| `moving` | Reserved for V2 (rising/falling MA levels); not in V1.1 |

The **exact method combination is stored on every snapshot** (`methods: ["swing", "avwap_low"]`) — "structural+participation" may behave differently from "calendar+calendar-weekly" even at the same family count. Family count drives the tier; combination is available for exploratory cuts.

**Confluence tiers (family-count based):** `F1` = 1 family, `F2` = 2 families, `F3` = 3+ families. Families align when their levels sit within 0.5% of each other. No double-counting identical math.

### 5.2 Point-in-time discipline

For any event on trading day D, the level registry state is the one built from data through D−1 close. Rebuild is per-day over a truncated series — the tempting optimization ("build levels once over the full history, filter by formation date") is exactly where lookahead enters, and is banned.

### 5.3 Availability fields (review finding, accepted)

Point-in-time truncation handles pivot availability implicitly (a swing at D−2 is not a fractal in a D−1-truncated series — its right-side bars don't exist yet). V1.1 makes the guarantee *explicit and testable* rather than implicit:

Every level source carries:

```json
{
  "formationDate": "2025-10-03",     // the bar that formed the structure (the swing bar itself)
  "firstKnownDate": "2025-10-08",    // first session on which the structure was detectable (swing + k right-side closes)
  "firstTradableDate": "2025-10-09"  // first session an event may reference it (firstKnownDate + 1; known at prior close)
}
```

- A fractal pivot's `firstKnownDate` = formation bar + k sessions (all right-side confirmation bars closed).
- An AVWAP anchor's `firstKnownDate` = first session on which the anchoring swing was BOTH confirmed as a fractal AND its move observably ≥ 5% — the 5% significance test is evaluated only on data available through that date, never on the move's eventual full extent.
- Calendar pivots: `firstKnownDate` = the session they apply to (derived entirely from prior completed bars).

**The lookahead test asserts availability, not merely data cutoff:** for every event, `firstTradableDate ≤ eventDate` for every referenced level, AND a re-derivation check confirms each referenced level is reproducible from the truncated series alone. This test is written in Session 2, before event detection exists.

### 5.4 Level lineage — `levelFamilyId` + `levelSnapshotId` (review finding, accepted)

Daily rebuilds shift centroids and confluence membership, so a same-conceptual zone gets a new snapshot every day. Two identifiers:

- **`levelSnapshotId`** — the dated state: price, zone width, side, methods, family tier, as-of date. What an event's features reference.
- **`levelFamilyId`** — the persistent market structure. What re-arm state, touch history, `sequenceIndex`, role history, and V2 sequences reference.

**Deterministic lineage rules (all knobs v1 provisional):**

- **Matching:** each session, snapshots are processed in ascending price order; a snapshot joins the existing family whose anchor is within `max(0.5%, 0.25 ATR)` of the snapshot centroid — nearest anchor wins, elder family breaks ties. Matching ignores side (role can flip).
- **Family anchor:** slow EMA (α=0.15) of matched snapshot centroids — tracks drift without chasing it.
- **Merge:** two families whose anchors sit within 0.4% for 5 consecutive sessions merge; the elder `familyId` survives, the absorbed one records `mergedInto`, the survivor records `mergedFrom`. In-flight episode state transfers to the survivor.
- **Split:** a family whose constituent method levels separate by >1.5% for 5 consecutive sessions splits; the elder keeps the id; the new branch gets a fresh id with `splitFrom`.
- **Retirement:** a family with zero method support for 20 consecutive sessions retires — it can no longer re-arm or host events. A later reformation at the same price is a new family (the old structure's memory has decayed).
- **Role history:** every family carries an append-only role log (`support` / `resistance` / `resistance_turned_support` / `support_turned_resistance`). Role reversal is stored in V1.1 even though sequence *analysis* waits for V2.

Lineage is the hardest engineering in the study (entity resolution over time) and the main driver of the revised schedule.

---

## 6. Stage 2 — Event detection: fresh-approach episodes (re-arm reworked)

### 6.1 Episode model (review finding, accepted — time-only re-arm is dead)

Continuous residence near a level is **one interaction episode**, however many days it lasts. An episode:

- **Opens** when price enters the zone `family anchor ± 0.25 × ATR(14, daily, D−1)` from the outside (support approached from above, resistance from below).
- **Closes** only when price separates from the zone boundary by ≥ 1.0 ATR **and** remains outside for ≥ 1 full session.
- A **new episode** additionally requires a fresh approach from the correct side. A stock camped at support for five sessions is one episode, one event — day four never becomes "independent."

`touchAt` = first 5-min bar of zone entry within the episode. One event per family per episode. Gap-through-the-zone without trading in it = `GAP_BREAK` disposition, recorded, excluded from touch-interaction base rates (different phenomenon).

### 6.2 Cross-level deduplication (review finding, accepted)

If a touch intersects multiple zones (anchors within 0.5 ATR of each other that lineage hasn't merged), the event is assigned deterministically: highest family tier → nearest anchor → elder family. Losing zones are recorded as `shadowedFamilyIds` and their episode state still advances (they were touched — they just don't produce a duplicate event).

### 6.3 Event record (before enrichment)

```json
{
  "eventId": "AAPL_fam0031_ep07",
  "levelFamilyId": "AAPL_fam0031",
  "levelSnapshotId": "AAPL_2025-11-14_snap_187.40",
  "symbol": "AAPL",
  "sector": "XLK",
  "eventDate": "2025-11-17",
  "side": "support",
  "roleState": "resistance_turned_support",
  "sequenceIndex": 7,
  "touchAt": "2025-11-17T15:05:00Z",
  "confirmationAt": "2025-11-17T16:30:00Z",
  "entryAt": "2025-11-17T16:35:00Z",
  "overnightEntry": false,
  "corporateActionAdjacent": false,
  "atrDaily": 3.12,
  "shadowedFamilyIds": [],
  "disposition": "touch"
}
```

Null-never-zero policy on every field in every stage: a feature that can't be computed is `null`, never 0.

---

## 7. Stage 3 — Hourly confirmation taxonomy (unchanged classes, now confirmation-time honest)

Fixed vocabulary, five classes plus null, evaluated over the self-constructed 9:30-anchored confirmation window (touch hourly bar + next hourly bar). The class **does not exist before `confirmationAt`** and is never referenced by the touch-time study.

Sign-normalized definitions in daily-ATR units (`P` = penetration depth beyond level in window; `C` = window-close position, positive toward hold side; `W` = max rejection wick with close on hold side):

| Class | Rule (v1 knobs) | Reading |
|---|---|---|
| `SHARP_REJECT` | P ≤ 0.35 AND C ≥ +0.25 AND W ≥ 0.30 | Level defended violently |
| `DRIFT_HOLD` | P ≤ 0.35 AND 0 ≤ C < +0.25 | Held without conviction |
| `BREAK_HOLD` | P > 0.35 AND C ≤ −0.15 | Decisive close beyond |
| `BREAK_RECLAIM` | P > 0.35 AND C ≥ +0.10 | Pierced deep, reclaimed — the trap |
| `CHOP` | everything else | No signal |

Volume overlay: hourly RVOL at the touch bar, hour-of-day-matched against a 20-day baseline.

---

## 8. Stage 4 — Features (pre-touch fingerprint + stored context)

### 8.1 Timing rule for features

Every feature is stamped with its availability class: `pre_touch` (usable in both studies) or `post_touch` (confirmation-time study only). The hourly class is the only V1.1 `post_touch` conditioning variable; everything in this section is `pre_touch`.

### 8.2 Intraday fingerprint (5-min bars, session open → touch)

Carried over from V1: `approach_velocity` (ATR/hr over 90 min into touch), `rvol_approach` (time-of-day-matched cumulative), `vwap_side`, `vwap_dist` (ATR), `consol_tightness` (60-min range in ATR), `tod_bucket` (open / midday / power), `gap_context` (toward/away/none at 0.3 ATR).

### 8.3 Intraday momentum quality (review finding, accepted — stored features)

`path_efficiency` (net ÷ total movement session-open→touch), `accel_final_30m` (ATR/hr last 30 min ÷ approach_velocity), `pullback_depth_max` (deepest counter-move on approach, ATR), `hl_progression` (higher-low / lower-high count on approach), `dist_from_opening_range` (ATR beyond/inside OR30), `dist_from_session_extreme` (ATR), `prior_probe_count` (zone probes earlier in episode before touchAt), `vol_slope_into_touch` (expanding / flat / contracting).

### 8.4 Higher-timeframe and relative-momentum context (review finding, accepted — stored features)

Higher-TF: weekly and monthly trend state (20/50-period stack per grain), distance from 20-week and 50-week SMAs (ATR-weekly units), distance from 52-week high/low (%), weekly and monthly HH/LL structure state, daily ATR percentile (vol regime), 20-day range compression percentile (pre-event coil).

Relative momentum: 5/20/60-day return vs SPY, same vs sector ETF, beta-adjusted excess return (60-day beta), sector ETF direction at touch (day's sign), SPY direction at touch.

**Scope guard (V1.1 stance):** all §8.3–8.4 variables are **stored features only** — capture is cheap now, re-running 36 months of history later is not. None are primary buckets in V1.1. They serve the exploratory appendix, the incremental-lift layer (§11.3), and future primary cuts in a versioned V1.2 re-registration.

---

## 9. Stage 5 — Outcomes (dual-origin, timing-grained)

### 9.1 Two origins, one grid

The full outcome grid is computed twice per event: once from `touchAt` (touch-time study) and once from `entryAt` (confirmation-time study). Sign-normalized, positive toward hold side, measured on 5-min closes (excursions on 5-min highs/lows).

**Grid per origin:**
- MFE / MAE at +15m, +30m, +60m, +120m, EOD, next open, next EOD (in ATR)
- `held_{horizon}`: no 5-min close beyond the level by > 0.25 ATR within horizon
- `time_to_{0.25, 0.50, 0.75, 1.00}_ATR` favorable (minutes; null if not reached by next EOD)
- Target-before-stop grid: targets {0.50, 0.75, 1.00, 1.50} × stops {0.25, 0.50, 0.75} ATR (§9.3)
- `drawdown_before_target`: MAE experienced before the 0.75 ATR target was reached (null if never reached)
- `close_position_in_range`: session close's position within the post-origin high-low range (0–1)
- `overnight_gap`: next-open minus session-close excursion in ATR (carried-position risk)
- `resolution` at next EOD: `held / broke / reclaimed_after_break`

### 9.2 The bridge columns (the review's centerpiece — accepted)

- `moveBeforeConfirmation`: signed excursion toward hold side from `touchAt` to `entryAt`, in ATR.
- `moveRemainingAfterConfirmation`: MFE from `entryAt` through EOD, in ATR.
- `fractionElapsedAtEntry`: `moveBeforeConfirmation ÷ (moveBeforeConfirmation + moveRemainingAfterConfirmation)` — **null when the denominator < 0.25 ATR** (no meaningful move to apportion; null-never-zero).

These three columns quantify anticipate-vs-chase per hourly class. If SHARP_REJECT shows median `fractionElapsedAtEntry` of 0.7, confirmation-waiting is chasing; if 0.3, confirmation is cheap insurance.

### 9.3 Intrabar ambiguity (review finding, accepted — adverse-first + counted)

A 5-min bar can contain both a target and a stop price; OHLC does not reveal order. Rules:
- Same-bar target/stop collisions resolve **adverse-first** (conservative: the stop is deemed hit first).
- Every collision increments the event's `ambiguousBars` counter and flags the affected grid cell `ambiguous: true`.
- The report footer publishes the ambiguity rate per target/stop pair. **Escalation trigger:** if any primary-relevant pair shows > 10% ambiguous events, that pair's results are labeled `RESOLUTION_LIMITED` and V1.2 escalates to 1-min bars for outcome sequencing before those cells can be believed. We do not pay the 1-min data cost upfront; we let the measured ambiguity rate decide.
- Intrabar order is never inferred from a 5-min candle. `clean_bounce` (MFE ≥ 0.75 before MAE ≥ 0.50) is computed under the same rules.

---

## 10. Stage 6 — Aggregation

### 10.1 Pre-registered primary questions (V1.1 — re-cut for dual studies and S/R separation)

Five questions, each run separately for support and resistance. Everything else is exploratory and labeled as such.

| # | Study | Question |
|---|---|---|
| P1 | Confirmation-time | Does `hourly_class` predict `held_EOD` from `entryAt`? (F2+ levels) |
| P2 | Bridge | Per hourly class: distribution of `fractionElapsedAtEntry`, and is remaining MFE-vs-MAE from `entryAt` still favorable? (the anticipate-vs-chase verdict) |
| P3 | Touch-time | Does `rvol_approach` bucket predict `clean_bounce` from `touchAt`? (within F2+ — pre-touch information only, legitimately knowable at touch) |
| P4 | Confirmation-time | Does family tier (F1/F2/F3) predict `held_EOD` within `SHARP_REJECT`? |
| P5 | Confirmation-time | `BREAK_RECLAIM` vs `DRIFT_HOLD`: forward MFE from `entryAt` (the trap-pattern question) |

### 10.2 Support and resistance stay separate (review finding, accepted)

Sign normalization remains a code convenience only. All primary tables render per side. A pooled view appears only if both sides independently show same-direction effects with overlapping clustered CIs — and the pooled table still footnotes both sides' separate numbers.

### 10.3 Honesty gates (inherited, plus V1.1 strengthening)

- Non-overlapping episodes only (§6 guarantees).
- No percentage under n=5, no median under n=3; below-floor buckets print `n<5 — insufficient` and nothing else.
- Condition-vs-condition comparisons only — a bucket compares against a sibling, never the pooled headline (truncation-bias guard).
- No composite score anywhere. The report is a checklist of displayed facts (§9-violation reasoning, inherited from the Lab).
- Display-agreement: every verdict derives from the 2dp-rounded values printed in the report.
- Report footer always carries: universe + survivorship note, verified data range, config version, event counts before/after episode filtering, unique-event-date count, top-5-symbol contribution %, ambiguity rates, corporate-action exclusion count.

---

## 11. Statistics (review findings, accepted — clustering + strengthened holdout)

### 11.1 The clustering problem

Five tech names rejecting support during one Nasdaq reversal ≈ one economic observation. Naive n inflates confidence.

### 11.2 Required machinery

- **Date-clustered bootstrap:** resample event *dates* with replacement (all events sharing a date move together), 2,000 iterations → 90% CIs on every displayed rate and on every sibling-bucket difference.
- **Stability review (a result FAILS if any single removal flips the sibling-difference sign):** leave-one-symbol-out across the top contributors, leave-one-sector-out, leave-one-5-session-market-episode-out.
- **Concentration diagnostics** (always displayed): unique event dates per bucket; % of bucket contributed by top 5 symbols.

### 11.3 Incremental lift (review finding, accepted — with a §9 guard)

To test "beyond the level alone": a **pre-registered logistic model** per primary question — outcome `held_EOD` (or `clean_bounce`), inputs: family tier, hourly class, side, `tod_bucket`, vol-regime percentile, SPY-direction-at-touch, symbol random effect. The reported quantity is **incremental lift**: change in model quality and the class coefficient's clustered CI when `hourly_class` is added to the context-only model.

**Guard:** this is an analysis-layer robustness check. The report remains a checklist of displayed base-rate facts; coefficients appear in the exploratory appendix as directional statements ("hourly class retained significance after controls: yes/no"). No regression output ever becomes a displayed composite score.

### 11.4 Holdout rules (strengthened; single-open)

The ±15-point band is dead (at n=8, one event moves the rate 12.5 points). A bucket graduates to `CONFIRMED` only if ALL hold:
1. In-sample sibling difference's 90% date-clustered CI excludes zero.
2. In-sample stability review passes (§11.2).
3. Holdout effect direction agrees.
4. Holdout point estimate falls within the in-sample 90% CI.

**Single-open rule (V1.1 addition):** the holdout opens exactly once, after all in-sample work — including knob sensitivity — is frozen. If a bucket fails holdout, it is `DEAD` for this study; it does not get re-tuned and re-tested against the same holdout months. The next confirmation attempt requires genuinely new months of data.

Verdicts per pre-registered question: `CONFIRMED / UNCONFIRMED / DEAD`.

---

## 12. Manual validation (review finding, accepted)

Before any statistics are believed, Session 7 exports **chart packets** — daily context, hourly confirmation window, full 5-min session with level zone, touchAt/confirmationAt/entryAt markers — for **100 randomly selected events stratified across the four universe strata** (mega-cap tech, low-vol, high-beta, gap-prone). Flash reviews each as `valid / garbage / ambiguous`.

Gate: garbage rate > 10% blocks aggregation until detection is fixed and the review is re-run on a fresh sample. Automated event detection on OHLC always produces some garbage; eyeballing is how you find it.

---

## 13. Sample-size budget (V1.1 addition)

The review's additions multiply cells: 2 sides × 5 classes = 10 primary cells before any conditioning; P3/P4 add tier and RVOL splits. Budget math, stated so it's checkable:

- Assumption: ~1–2 qualified independent episodes per symbol per month after episode filtering.
- 175 symbols × 29 in-sample months × 1.5 ≈ **~7,600 in-sample events**, split across sides and classes → rarest primary cells (e.g., resistance BREAK_RECLAIM at F2+) projected at n≈40–80.
- **Session-3 checkpoint:** after event detection runs, projected per-cell counts are computed and compared to budget. Any primary cell projecting under n=30 in-sample triggers a scope decision — widen universe, extend verified history, or coarsen that cut — *before* Stage 4 builds. Primary cuts stay coarse by design; fine cuts live in the exploratory appendix where the honesty floors govern.

---

## 14. Pitfalls ledger (standing)

| # | Pitfall | Mitigation |
|---|---|---|
| 1 | Lookahead in level construction | Truncated per-day rebuild + availability fields + availability-assertion tests (§5) |
| 2 | **Confirmation leak (hindsight inside MFE)** | Three timestamps, dual studies, outcomes from `entryAt` (§3, §9) |
| 3 | Level identity drift breaking lineage | `levelFamilyId`/`levelSnapshotId` + deterministic merge/split/retire (§5.4) |
| 4 | Overlapping samples inflating n | Episode model, fresh-approach re-arm, cross-level dedup (§6) |
| 5 | **Cross-symbol market-episode clustering** | Date-clustered bootstrap, stability review, concentration diagnostics (§11) |
| 6 | Multiple comparisons | 5 pre-registered questions, single-open holdout, exploratory fencing (§10, §11.4) |
| 7 | Intrabar sequence ambiguity | Adverse-first + ambiguity counting + measured escalation to 1-min (§9.3) |
| 8 | Corporate-action basis mismatch | Single adjustment basis + invariant test + adjacency exclusion (§4.3) |
| 9 | Vendor hourly misalignment | Self-constructed 9:30-anchored hourly bars (§4.4) |
| 10 | Synthetic close-print bars / volume anomalies | Defensive strip + fixture-first parsing |
| 11 | Correlated confluence (methods ≠ evidence) | Source families; family-count tiers; combination stored (§5.1) |
| 12 | S/R false symmetry | Separate primary views; pooling only after independent agreement (§10.2) |
| 13 | Survivorship in universe | Frozen stratified list + footer disclosure |
| 14 | Regime dependence | Vol-regime + trend-state features; holdout spans a different window; regime controls in lift model |
| 15 | Knob overfitting | Version-stamped knobs; sensitivity in-sample only; holdout opens once |
| 16 | Time-of-day volume distortion | Hour-matched RVOL baselines |
| 17 | Price-scale incomparability | ATR/RVOL normalization everywhere |

---

## 15. Acceptance criteria

A bucket informs trading only when ALL hold:
1. In-sample n ≥ 30 independent episodes (raised from 20 — clustering eats effective n)
2. Sibling difference ≥ 15 points AND its 90% clustered CI excludes zero
3. Stability review passes (§11.2)
4. Holdout confirms per §11.4
5. For confirmation-time buckets: favorable asymmetry from `entryAt` (median remaining MFE ≥ 2× median MAE at the relevant horizon) — the move that remains after you could actually act

Anything short of all five is `UNCONFIRMED` and does not inform trading.

---

## 16. Build order (revised — ~10–12 sessions honest estimate)

| Session | Deliverable |
|---|---|
| 0 | **Research contract locked** (§3): all ten definitions frozen in `config.js`, `STUDY_CONFIG_VERSION = 1` stamped |
| 1–2 | `01-fetch-history.js`: fetch, normalize, single adjustment basis, synthetic-bar strip, self-built hourly bars, per-grain fixtures for 3 symbols, 5-min depth verification, cross-grain invariant test |
| 3 | `02-build-levels.js`: point-in-time registry with availability fields + `levelFamilyId` lineage. Lookahead test asserts availability + re-derivation. **(Hardest session — budget overflow here, not later)** |
| 4 | `03-detect-events.js`: episode model, fresh-approach re-arm, cross-level dedup. Independence tests (5 same-day probes → 1 event; 5-session camp → 1 event). **Session-3 checkpoint: cell-count budget vs §13** |
| 5 | `04-features.js`: pre-touch fingerprint + momentum/higher-TF/RS stored features, availability-class stamped |
| 6 | `05-confirm-and-label.js`: hourly classes; dual-origin outcome grid; bridge columns; ambiguity counting |
| 7 | `06-chart-packets.js` + **manual review of 100 stratified events**; fix-and-rerun loop until garbage < 10% |
| 8 | `07-aggregate.js`: clustered bootstrap, stability review, concentration diagnostics, primary tables per side |
| 9 | Knob sensitivity pass (in-sample only) + walk-forward check within in-sample months |
| 10 | **Holdout opens once.** Verdicts issued: `CONFIRMED / UNCONFIRMED / DEAD` per question per side |
| 11–12 | Buffer — lineage and manual-review loops historically overflow; the buffer is the honesty |

No product dependencies; safe to interleave with Release 1 / archetype work.

---

## 17. V2 / V3 hooks (unchanged in intent, better prepared)

- **V2 (story layer):** sequence chains over `levelFamilyId` histories — now actually possible because lineage is stable and role history is stored. `sequenceIndex` and role logs are already on every event.
- **V3 (options overlay):** DTE, delta bucket, IV percentile, spread, earnings proximity, option return after realistic entry delay — only after underlying `CONFIRMED` verdicts exist. The timing-grained grid (§9.1) was designed so V3 can map time-to-target distributions onto expiry structures without recomputing history.

---

*A note on what this is: a descriptive research instrument. Base rates describe how a fixed historical sample behaved under stated conditions — they are not predictions, and nothing here constitutes trading advice. The honesty gates exist precisely because the most dangerous output of a study like this is a confident number built on a contaminated sample — and V1.1's central lesson is that the second most dangerous output is a true number measured from a moment at which you could not yet have acted.*

---

*LevelStory Spec V1.1 — July 10, 2026 — supersedes V1*
