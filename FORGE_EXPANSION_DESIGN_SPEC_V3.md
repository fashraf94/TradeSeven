# FantasyTrades — Forge Architecture Expansion + Variable Backtest Duration

**Design Specification v3.0 — LOCKED FOR IMPLEMENTATION**
**Owner:** Flash
**Author:** Claude (Opus 4.7) drafting from Flash's product direction
**Status:** Locked. All open questions resolved. Converting to Claude Code prompts begins next.
**Date drafted:** April 23, 2026

**v2 → v3 changes:**
- All 14 open questions from v2 resolved and folded into the relevant sections
- Section 5 rewritten to reflect conversation-driven duration flow with secondary UI picker
- Section 11 removed (open questions resolved) — replaced with resolved-decisions reference log
- SX-05 default trigger locked as `rsi_overbought` per trader rationale (widely understood, standard indicator, intuitive for novices)
- Defaults confirmed stable across all durations; Gemma adapts values via conversation
- DRB integration for sector performance data bookmarked as future enhancement, NOT this sprint
- Solo vs Tournament mode enforcement confirmed handled by existing navigation entry points

**v1 → v2 changes (preserved for history):**
- Added SE-09 Sector Momentum Filter as a fifth newly-emitted rule
- Expanded Sector Strategy dimension to house SE-09
- Tightened radar chart breadth+intensity description

---

## 0. How to read this spec

This document describes a single sprint that does two things at once: **expands the Forge rule architecture** so user-selected parameters actually flow through to the backtesting evaluator, and **makes solo-backtest duration user-configurable** from 1 to 4 trading weeks. These two changes are bundled because both touch the Haiku compile prompt and the entry document schema, and splitting them would force us to rewrite the same prompt twice.

The spec is structured for review, not for implementation. Each section ends with a callout flagging open product decisions that need Flash's call before implementation prompts can be written. Treat the spec as a draft — mark up disagreements, override my defaults, push back on anything that doesn't match how a real trader thinks. I have engineered the architecture; you own the product calls.

When this spec is locked, it converts into a phased Claude Code prompt sequence (estimated 4-5 sessions on a single long-running branch). Implementation phasing lives at the end of this document.

**Out of scope and explicitly deferred:**

- Season Mode tournament rules (`ss-01`, `ss-02`, `ss-03`, `ss-04`, `ss-05`, `ss-06`) — these stay parked until Season Mode work resumes
- Experience-level routing in the Voice Layer (Gemma's beginner-vs-expert detection) — bookmarked for a future Voice Layer sprint
- New top-level dimension categories — the existing 7 are sufficient
- TradingView webhook integration — long-term roadmap item
- Custom rule authoring (users defining their own rules) — separate future product surface

---

## 1. Sprint goals

### 1.1 The product problem

Today, when a Workshop conversation produces a sophisticated thesis like *"buy on 20-day breakout with volume confirm, exit on 20-day MA break or 5% stop"*, the compile step silently degrades it. Haiku maps the thesis to 7 dimension values, then `dimensionsToRuleSnapshots` flattens those values into a fixed subset of the 26 season rules with hardcoded parameters. The user lands in Strategy Dimensions Step 2 looking at sliders that don't reflect what they discussed, and the resulting backtest runs against a watered-down version of their strategy. This breaks trust between the conversation and the test.

The Forge rule engine itself is fine. All 26 evaluators in `seasonRuleRegistry.js` honor parameters correctly. The bottleneck is `dimensionsToRuleSnapshots` (44 lines in `dimensionMapper.js`), which is the lossy translation layer between Strategy Dimensions and Forge rules.

### 1.2 The duration problem

Today every backtest is a fixed 4-week (20 trading day) run. This is correct for Season Mode tournaments, where fixed duration is necessary for fair competition. It is wrong for solo backtests, where duration is itself a strategic variable. A momentum-on-earnings strategy needs 1 week. A trend-following swing strategy needs 4 weeks. Forcing both into the same 4-week box wastes time and produces misleading results — the momentum strategy looks weaker because it's measured over a horizon it wasn't designed for.

### 1.3 Sprint outcomes

When this sprint ships, the following will be true:

1. A Workshop user who discusses a "20-day MA trend exit" gets a strategy whose backtest actually uses a 20-day MA trend exit. No silent parameter substitutions.
2. A user can choose any of `rsi_overbought`, `macd_bearish`, `either_rsi_or_macd`, or `below_sma` (with selectable SMA period) as their technical exit trigger. Today only `rsi_overbought` is reachable via Strategy Dimensions.
3. Five currently-dropped or nonexistent rules become available: SMA-based trend alignment entries (`se-03`), institutional sentiment filters (`se-08`), pre-earnings exits (`sx-06`), correlation-based portfolio exits (`sx-07`), and sector momentum filters with timeframe selection (`se-09`, newly introduced).
4. Six rules that today emit hardcoded parameters become user-configurable: volume multiplier (`se-02`), momentum lookback period (`se-06`), time-exit minimum gain threshold (`sx-03`), and the `sx-05` parameter set, plus the add-to-winners and underperformer-reduction rule parameters (`sr-04`, `sr-05`).
5. Solo backtests can be configured for 1, 2, 3, or 4 trading weeks at launch time. Season Mode tournaments remain locked at 4 weeks.
6. Gemma can discuss timeline as part of strategy design and recommend rules appropriate to the chosen duration.
7. The Strategy Dimensions UI exposes the new parameter controls with a clean visual hierarchy that serves both novice and expert users without requiring experience-level UI gating.

### 1.4 Non-goals

This sprint does not:

- Add new top-level dimension categories
- Build experience-level routing in Gemma's prompt
- Touch any Season Mode tournament rules
- Build the TradingView webhook integration
- Add new types of fundamental data (P/E filters, beta filters, market cap filters) — these remain hooks for future product work
- Add a `macd_bullish` entry rule, even though the precomputed MACD data would support it (defer to next sprint to keep scope tight)

---

## 2. The expanded rule palette

This section enumerates every rule touched in this sprint with its full parameter spec.

### 2.1 Rules being newly emitted (4 rules)

#### SE-03 — Trend Alignment Filter (entry)

**What it does:** Requires the stock to be trading above a selected moving average before entry is allowed.

**Why we need it:** Foundational trend-following primitive. Without it, users who pick "follow the trend" in conversation get nothing back in the strategy.

**Parameters:**

| Parameter | Type | Valid values | Default | Notes |
|-----------|------|--------------|---------|-------|
| `period` | enum | 20, 50, 100, 200 | 50 | All four SMAs are precomputed in `ctx.technicals[ticker]` |

**Belongs to:** Entry Aggression dimension

**Evaluator location:** `seasonRuleRegistry.js:103-117`

**Data dependency:** All four SMA periods confirmed precomputed (verified via discovery Q1).

#### SE-08 — Institutional Sentiment Check (entry)

**What it does:** Filters entries based on whether institutional ownership is increasing, stable, or any.

**Why we need it:** Adds a fundamental quality gate that experienced traders use to avoid fighting smart money.

**Parameters:**

| Parameter | Type | Valid values | Default | Notes |
|-----------|------|--------------|---------|-------|
| `direction` | enum | `'any'`, `'increased'`, `'stable_or_increased'` | `'any'` | Maps from `mapConvictionToTrend` in `seasonEvalContext.js:419` |
| `quarters` | integer | 1, 2, 4 | 2 | Lookback in quarters; rendered as label only, doesn't affect gating |

**Belongs to:** Entry Aggression dimension (under a "fundamental gates" subsection alongside the existing Fundamental Floor)

**Evaluator location:** `seasonRuleRegistry.js:184-199`

**Data dependency:** Sourced from Firestore `institutionalHoldings/{ticker}.summary.conviction`. **Data population caveat:** the field exists in the producer, but whether the Firestore collection is actually populated for the full 232-stock ticker universe needs verification before this rule ships. Flag in section 11 (open questions).

#### SX-06 — Earnings Exit (exit)

**What it does:** Closes existing positions ahead of earnings announcements, optionally only if profitable.

**Why we need it:** Distinct from `se-04` (which blocks new entries). Lets traders bank gains before the binary risk of an earnings move. The "only if profitable" variant is a real institutional discipline.

**Parameters:**

| Parameter | Type | Valid range | Default | Notes |
|-----------|------|-------------|---------|-------|
| `days` | integer | 1, 2, 3, 5 | 2 | Trading days before earnings |
| `onlyIfProfitable` | boolean | true / false | true | When true, requires `returnSinceEntry > 0` |

**Belongs to:** Exit Discipline dimension (under "event exits" subsection)

**Evaluator location:** `seasonRuleRegistry.js:304-324`

**Data dependency:** Uses `ctx.earnings[ticker].tradingDaysUntil`, confirmed populated from EODHD fundamentals endpoint (verified via discovery Q4).

#### SX-07 — Correlation-Based Exit (exit)

**What it does:** Trims one position from any pair of holdings whose price correlation exceeds a threshold over a lookback window. Portfolio-level rule.

**Why we need it:** Diversification discipline for experienced traders building multi-position portfolios. Without it, a "5 different stocks" strategy can accidentally be 5 highly-correlated bets.

**Parameters:**

| Parameter | Type | Valid range | Default | Notes |
|-----------|------|-------------|---------|-------|
| `days` | integer | 20, 30, 60, 90 | 30 | Lookback for correlation calculation |
| `threshold` | float | 0.7, 0.8, 0.9 | 0.8 | Correlation coefficient ceiling |

**Belongs to:** Position Sizing dimension (it's about portfolio composition, not individual exits)

**Evaluator location:** `seasonRuleRegistry.js:330-363`

**Data dependency:** Uses `ctx.priceHistory[ticker]` arrays. Existing rule `sr-05` already relies on `priceHistory`, so the data is wired up.

**Special handling:** The evaluator comment at `seasonRuleRegistry.js:327-329` notes that the pipeline calls this with `ticker=null` because it's portfolio-wide. Worth verifying with Claude Code during implementation that adding it to a bundle correctly triggers the special-case dispatch. Flag in section 11.

#### SE-09 — Sector Momentum Filter (entry, new rule)

**What it does:** Narrows the tradable universe before entry evaluation runs. Either limits entries to the top N momentum-leading sectors over a user-selected timeframe (dynamic mode), or limits entries to a user-selected list of specific sectors (static mode).

**Why we need it:** Sector-first momentum analysis is a legitimate professional technique — "right now trade only the sectors that are actually moving." Today users can't express this and have to manually pre-screen their universe. This rule bridges the platform's gap vs TradingView for traders who think in sector rotations rather than individual stocks.

**Parameters:**

| Parameter | Type | Valid values | Default | Notes |
|-----------|------|--------------|---------|-------|
| `mode` | enum | `'top_n'`, `'specific_sectors'` | `'top_n'` | Which selection logic runs |
| `timeframe` | enum | `'1D'`, `'1W'`, `'1M'`, `'3M'` | `'1W'` | Only relevant when mode is `'top_n'` |
| `topN` | integer | 1, 2, 3, 5 | 3 | Only relevant when mode is `'top_n'` |
| `selectedSectors` | string[] | Subset of the 11-sector universe | [] | Only relevant when mode is `'specific_sectors'` |

**Belongs to:** Sector Strategy dimension

**Evaluator location:** New rule, to be added to `seasonRuleRegistry.js`. Pattern follows existing entry rules — reads per-ticker context, returns pass/fail.

**Data dependencies:** Two separate Firestore collections, both already populated by existing crons:

1. **Per-sector performance data** (1D/1W/1M/3M returns per sector ETF) — used in `top_n` mode to rank sectors by timeframe-specific momentum
2. **Sector assignment per ticker** (already in `ctx.fundamentals[ticker].sector`) — used to check whether a candidate ticker belongs to the allowed sector list

Exact Firestore paths to be confirmed in Phase 0 discovery (see section 10). The momentum rankings UI in the search section confirms the data exists.

**Evaluator logic sketch:**

```js
function evaluateSE09(ticker, params, ctx) {
  const tickerSector = ctx.fundamentals[ticker]?.sector;
  if (!tickerSector) return { pass: false, reason: 'No sector data' };

  if (params.mode === 'specific_sectors') {
    const allowed = params.selectedSectors || [];
    return allowed.includes(tickerSector)
      ? { pass: true }
      : { pass: false, reason: `Sector ${tickerSector} not in selected list` };
  }

  // mode === 'top_n'
  const sectorPerf = ctx.sectorPerformance?.[params.timeframe];
  if (!sectorPerf) return { pass: false, reason: `No ${params.timeframe} sector data` };

  const topSectors = Object.entries(sectorPerf)
    .sort(([,a], [,b]) => b - a)
    .slice(0, params.topN)
    .map(([sector]) => sector);

  return topSectors.includes(tickerSector)
    ? { pass: true }
    : { pass: false, reason: `Sector ${tickerSector} not in top ${params.topN} on ${params.timeframe}` };
}
```

Real implementation will match the existing evaluator conventions — this sketch only illustrates the shape.

**Design notes:**

- The `top_n` mode and `specific_sectors` mode are mutually exclusive — a single rule instance uses one or the other based on the `mode` parameter. The UI renders only the relevant sub-controls for the selected mode.
- Duration interaction: when a solo backtest is 1-week, `timeframe: '1M'` or `'3M'` is probably less useful because the backtest is shorter than the signal window. The Haiku compile prompt should bias toward timeframes roughly matching the backtest duration (1-week test → 1W timeframe, 4-week test → 1M timeframe). Not a hard constraint — users can still override.
- This is the kind of rule experienced traders will tune aggressively. Defaults (`top_n`, `1W`, top 3) work for a typical momentum-study use case but the power is in the full parameter surface.

### 2.2 Rules with hardcoded params being made flexible (6 rules)

#### SE-02 — Volume Confirmation

**Today:** Hardcoded `multiplier = 1.2`.

**Tomorrow:** User-selectable volume multiplier.

**Parameters:**

| Parameter | Type | Valid range | Default | Notes |
|-----------|------|-------------|---------|-------|
| `multiplier` | enum | 1.2, 1.5, 2.0, 3.0 | 1.5 | RVOL multiplier — "X times average daily volume" |

**Belongs to:** Entry Aggression dimension (already there as a toggle, becomes a selector when toggled on)

**UI affordance:** When the volume confirm toggle is on, expose the multiplier picker. When off, no multiplier shown.

**Default change rationale:** Bumping default from 1.2 to 1.5 because 1.2× is a weak confirmation in practice. 1.5× is closer to what a real trader would consider meaningful volume. Flash should override if his read differs.

#### SE-06 — Momentum Entry Threshold

**Today:** Hardcoded `period = 10`.

**Tomorrow:** User-selectable lookback period.

**Parameters:**

| Parameter | Type | Valid range | Default | Notes |
|-----------|------|-------------|---------|-------|
| `period` | enum | 5, 10, 20 | 10 | Lookback days for momentum measurement |
| `pct` | float | 0.5–10 | passed through from existing slider | Already user-controlled today |

**Belongs to:** Entry Aggression dimension (under the existing momentum threshold slider — adds a period picker alongside)

#### SX-03 — Time-Based Exit

**Today:** `days` is user-controlled, but `pct` (minimum gain threshold) is hardcoded to 1.

**Tomorrow:** Both parameters user-controlled.

**Parameters:**

| Parameter | Type | Valid range | Default | Notes |
|-----------|------|-------------|---------|-------|
| `days` | integer | 2–15 | passed through from existing slider | Already user-controlled today |
| `minGainPct` | float | 0, 1, 3, 5 | 1 | Close flat positions that haven't gained at least this much |

**Schema rename:** `pct` → `minGainPct` in the Strategy Dimensions schema. The evaluator's local `params.pct` stays — only the schema-side semantic name changes.

**Belongs to:** Exit Discipline dimension

**UI affordance:** Below the existing days slider, a small selector for "minimum gain to consider success" with a tooltip explaining the rule.

#### SX-05 — Technical Exit Signal (the big one)

**Today:** Hardcoded `trigger = 'rsi_overbought'`, `rsiThreshold = 75`, `smaPeriod = 20`. Three of four evaluator branches are unreachable.

**Tomorrow:** User-selectable trigger type with conditional sub-parameters.

**Parameters:**

| Parameter | Type | Valid values | Default | Notes |
|-----------|------|--------------|---------|-------|
| `trigger` | enum | `'rsi_overbought'`, `'macd_bearish'`, `'either_rsi_or_macd'`, `'below_sma'` | `'rsi_overbought'` | Picks which technical breakdown signals an exit |
| `rsiThreshold` | integer | 65, 70, 75, 80, 85 | 75 | Only relevant when trigger is `'rsi_overbought'` or `'either_rsi_or_macd'` |
| `smaPeriod` | enum | 20, 50, 100, 200 | 50 | Only relevant when trigger is `'below_sma'` |

**Belongs to:** Exit Discipline dimension

**UI affordance:** This is the most complex new control in the sprint. Conditional reveal pattern:

1. Top-level: trigger type picker (4 options as chips or a dropdown)
2. When `trigger === 'rsi_overbought'` or `'either_rsi_or_macd'`: show RSI threshold slider/picker
3. When `trigger === 'below_sma'`: show SMA period picker
4. When `trigger === 'macd_bearish'`: no sub-parameters needed (uses precomputed MACD line/signal/previous fields directly)

**This is the rule with the highest user-visible improvement.** The audit identified it as the worst current bug and the largest gap between Workshop conversations and compiled strategies. Worth visual investment.

#### SR-04 — Add to Winners

**Today:** Hardcoded `threshold = 10`, `addPct = 2`.

**Tomorrow:** Both user-controlled.

**Parameters:**

| Parameter | Type | Valid range | Default | Notes |
|-----------|------|-------------|---------|-------|
| `threshold` | integer | 5, 10, 15, 20 | 10 | Return % that triggers adding to a winning position |
| `addPct` | integer | 1, 2, 3, 5 | 2 | Weight increment per add |

**Schema rename:** `threshold` → `winnerReturnTrigger`, `addPct` → `winnerAddWeight` in the schema. Evaluator params unchanged.

**Belongs to:** Position Sizing dimension

#### SR-05 — Underperformer Reduction

**Today:** Hardcoded `threshold = 5`, `days = 5`, `reducePct = 3`.

**Tomorrow:** All three user-controlled.

**Parameters:**

| Parameter | Type | Valid range | Default | Notes |
|-----------|------|-------------|---------|-------|
| `threshold` | integer | 3, 5, 8, 10 | 5 | Relative-return % below SPY that triggers reduction |
| `days` | integer | 3, 5, 10, 15 | 5 | Lookback window |
| `reducePct` | integer | 1, 2, 3, 5 | 3 | Weight decrement per reduction |

**Schema rename:** `threshold` → `loserUnderperformanceTrigger`, `reducePct` → `loserReduceWeight` in the schema.

**Belongs to:** Position Sizing dimension

### 2.3 Sprint rule scope summary

**Touched in this sprint:** 11 rules (5 newly emitted + 6 made flexible)

**Newly emitted:** se-03, se-08, se-09 (new rule), sx-06, sx-07

**Already working correctly, not touched:** 10 rules (`se-01`, `se-04`, `se-05`, `se-07`, `sx-01`, `sx-02`, `sx-04`, `sr-01`, `sr-02`, `sr-03`)

**Tournament-scoped, deferred to Season Mode resume:** 6 rules (`ss-01` through `ss-06`)

**Defaults resolved:** Flash confirmed defaults hold for v3. SX-05 default trigger stays `rsi_overbought` — RSI is the most widely understood overbought/oversold indicator among both novice and professional users, making it the right default. Users who want MACD or SMA-break exits select them explicitly.

---

## 3. The schema rename map

The audit surfaced a real ambiguity: seven different rules use `params.pct` with rule-specific semantics (stop-loss %, gain %, allocation %, alpha gap %). At the evaluator level this is fine because each evaluator reads its own local `params.pct`. At the Strategy Dimensions schema level it's confusing and prevents Haiku from producing semantically meaningful output.

The fix: **rename in the schema, not in the evaluators.** The schema uses semantic names, the existing `dimensionsToRuleSnapshots` translates them back to evaluator-local names when materializing the bundle.

### 3.1 Rename table

| Schema field (new) | Evaluator param (unchanged) | Rule(s) | Semantic meaning |
|--------------------|------------------------------|---------|-------------------|
| `stopLossPct` | `params.pct` | sx-01 | Loss % that triggers exit |
| `trailingStopPct` | `params.pct` | sx-02 | Loss % from peak that triggers exit |
| `profitTargetPct` | `params.pct` | sx-04 | Gain % that triggers exit |
| `timeExitDays` | `params.days` | sx-03 | Days held before time-exit considered |
| `timeExitMinGainPct` | `params.pct` | sx-03 | Minimum gain to count as "successful" hold |
| `momentumLookbackDays` | `params.period` | se-06 | Lookback for momentum measurement |
| `momentumThresholdPct` | `params.pct` | se-06 | Required momentum % over lookback |
| `cashDeploymentTriggerPct` | `params.pct` | sr-02 | Cash % above which to deploy |
| `maxPositionWeightPct` | `params.maxPct` | sr-01 | Per-position weight cap |
| `maxSectorWeightPct` | `params.maxPct` | se-07 | Per-sector weight cap |
| `sectorDriftTolerancePct` | `params.tolerance` | sr-03 | Drift % before rebalance |
| `winnerReturnTrigger` | `params.threshold` | sr-04 | Return % to add to winner |
| `winnerAddWeight` | `params.addPct` | sr-04 | Weight increment per add |
| `loserUnderperformanceTrigger` | `params.threshold` | sr-05 | Underperformance % to reduce loser |
| `loserLookbackDays` | `params.days` | sr-05 | Lookback for underperformance check |
| `loserReduceWeight` | `params.reducePct` | sr-05 | Weight decrement per reduction |
| `correlationThreshold` | `params.threshold` | sx-07 | Pair-correlation ceiling |
| `correlationLookbackDays` | `params.days` | sx-07 | Lookback for correlation calc |
| `earningsAvoidanceDays` | `params.days` | se-04 | Days before earnings to block entries |
| `earningsExitDays` | `params.days` | sx-06 | Days before earnings to exit positions |
| `earningsExitOnlyIfProfitable` | `params.onlyIfProfitable` | sx-06 | Profitable-only gate |
| `rsiCeiling` | `params.upper` | se-01 | Max RSI for entry |
| `volumeMultiplier` | `params.multiplier` | se-02 | RVOL × average required for entry |
| `fundamentalFloor` | `params.minScore` | se-05 | Min composite fundamental score |
| `trendAlignmentSmaPeriod` | `params.period` | se-03 | SMA period for trend filter |
| `institutionalDirection` | `params.direction` | se-08 | Institutional ownership direction filter |
| `institutionalQuarters` | `params.quarters` | se-08 | Lookback in quarters (label only) |
| `technicalExitTrigger` | `params.trigger` | sx-05 | Which technical breakdown to watch |
| `technicalExitRsiThreshold` | `params.rsiThreshold` | sx-05 | RSI threshold (when trigger uses RSI) |
| `technicalExitSmaPeriod` | `params.smaPeriod` | sx-05 | SMA period (when trigger is below_sma) |
| `sectorFilterMode` | `params.mode` | se-09 | `'top_n'` or `'specific_sectors'` |
| `sectorFilterTimeframe` | `params.timeframe` | se-09 | Momentum timeframe for top-N mode |
| `sectorFilterTopN` | `params.topN` | se-09 | How many top sectors to include |
| `sectorFilterSelected` | `params.selectedSectors` | se-09 | Sector list for specific-sectors mode |

### 3.2 Translation mechanics

`dimensionsToRuleSnapshots` becomes a more sophisticated function. Instead of emitting hardcoded params, it reads the schema fields and emits the evaluator params with the correct values. Pseudocode:

```js
function emitRule_sx05(dimensionValues) {
  const { exitDiscipline } = dimensionValues;
  if (!exitDiscipline.technicalExitEnabled) return null;

  const evaluatorParams = {
    trigger: exitDiscipline.technicalExitTrigger,
  };

  // Conditional sub-params based on trigger type
  if (
    exitDiscipline.technicalExitTrigger === 'rsi_overbought' ||
    exitDiscipline.technicalExitTrigger === 'either_rsi_or_macd'
  ) {
    evaluatorParams.rsiThreshold = exitDiscipline.technicalExitRsiThreshold;
  }
  if (exitDiscipline.technicalExitTrigger === 'below_sma') {
    evaluatorParams.smaPeriod = exitDiscipline.technicalExitSmaPeriod;
  }

  return makeSnapshot('sx-05', evaluatorParams);
}
```

This pattern repeats for each touched rule. The function grows from ~80 lines to roughly ~200 lines but each rule's emit logic is self-contained and testable.

> **Resolved:** Flash confirmed the schema rename touches 30+ field names and a Phase 0 audit runs before any code changes. See Section 10 Phase 0 for the discovery scope.

---

## 4. Strategy Dimensions schema (expanded)

This section describes the full schema each of the 7 dimensions carries after the sprint. Keep in mind the existing 7 dimensions are unchanged in count — they just hold more.

### 4.1 Risk Posture

**Unchanged.** Carries `stopLossPct` and `trailingStopPct`. Already user-controlled, no expansion needed.

### 4.2 Entry Aggression

**Expanded significantly.** Becomes the home for all entry-side rules.

```js
entryAggression: {
  // Existing
  rsiCeiling: 75,                        // se-01
  volumeConfirmEnabled: true,            // se-02 toggle
  fundamentalFloor: 30,                  // se-05

  // NEW
  volumeMultiplier: 1.5,                 // se-02 param (when volumeConfirmEnabled)
  trendAlignmentEnabled: false,          // se-03 toggle
  trendAlignmentSmaPeriod: 50,           // se-03 param (when trendAlignmentEnabled)
  momentumThresholdPct: 3,               // se-06 (existing slider)
  momentumLookbackDays: 10,              // se-06 NEW param
  institutionalEnabled: false,           // se-08 toggle
  institutionalDirection: 'increased',   // se-08 param (when institutionalEnabled)
  institutionalQuarters: 2,              // se-08 param (when institutionalEnabled)
}
```

**UI grouping:** Inside the Entry Aggression dimension card, group controls into three subsections:

1. **Technical filters** (rsiCeiling, trendAlignmentEnabled+period, momentumThresholdPct+lookbackDays)
2. **Confirmation filters** (volumeConfirmEnabled+multiplier)
3. **Fundamental filters** (fundamentalFloor, institutionalEnabled+direction)

### 4.3 Exit Discipline

**Expanded significantly.** Becomes the home for all exit-side rules.

```js
exitDiscipline: {
  // Existing
  profitTargetPct: 15,                   // sx-04
  timeExitDays: 5,                       // sx-03 days
  technicalExitEnabled: false,           // sx-05 toggle

  // NEW
  timeExitMinGainPct: 1,                 // sx-03 NEW param
  technicalExitTrigger: 'rsi_overbought',// sx-05 trigger
  technicalExitRsiThreshold: 75,         // sx-05 param (conditional)
  technicalExitSmaPeriod: 50,            // sx-05 param (conditional)
  earningsExitEnabled: false,            // sx-06 toggle
  earningsExitDays: 2,                   // sx-06 param (when enabled)
  earningsExitOnlyIfProfitable: true,    // sx-06 param (when enabled)
}
```

**UI grouping:** Three subsections inside the Exit Discipline card:

1. **Profit / loss exits** (profitTargetPct, technical exit subsection with trigger picker + conditional reveals)
2. **Time exits** (timeExitDays, timeExitMinGainPct)
3. **Event exits** (earningsExitEnabled+days+profitable toggle)

### 4.4 Sector Strategy

**Expanded.** Previously carried only allocation caps and drift tolerance. Now also houses the Sector Momentum Filter (SE-09), which is a universe-narrowing primitive rather than an allocation cap.

```js
sectorStrategy: {
  // Existing
  maxSectorWeightPct: 30,                // se-07
  sectorDriftTolerancePct: 10,           // sr-03
  rebalanceOnDrift: false,               // sr-03 toggle

  // NEW — Sector Momentum Filter (se-09)
  sectorFilterEnabled: false,            // top-level toggle
  sectorFilterMode: 'top_n',             // 'top_n' | 'specific_sectors'
  sectorFilterTimeframe: '1W',           // '1D' | '1W' | '1M' | '3M' (when mode === 'top_n')
  sectorFilterTopN: 3,                   // 1 | 2 | 3 | 5 (when mode === 'top_n')
  sectorFilterSelected: [],              // string[] (when mode === 'specific_sectors')
}
```

**UI grouping:** Two subsections inside the Sector Strategy card:

1. **Universe filter** (sectorFilterEnabled toggle → when on, reveals mode toggle, then conditional sub-controls: `timeframe` + `topN` for top-N mode, or `selectedSectors` multi-select for specific-sectors mode)
2. **Allocation discipline** (maxSectorWeightPct, sectorDriftTolerancePct, rebalanceOnDrift toggle)

The allocation discipline subsection preserves today's UI verbatim. The universe filter subsection is new.

**Conceptual order matters here.** Universe filter runs *first* (narrows which tickers are even considered), then entry rules evaluate against the narrowed universe, then allocation caps constrain how much of each sector ends up in the portfolio. The UI should render universe filter above allocation discipline to mirror this mental model.

**Specific-sectors mode UI:** A multi-select chip group listing all 11 sectors. User taps to toggle each sector in/out. Visual treatment: selected sectors highlighted with the sector's existing color code from `SECTOR_COLORS` (already defined elsewhere in the codebase for the sector performance screen).

**Top-N mode UI:** Two small picker controls side by side: timeframe chip group `[1D] [1W] [1M] [3M]` and topN chip group `[1] [2] [3] [5]`.

> **Resolved:** Sector multi-select in specific-sectors mode enforces a minimum of 1 (can't select zero) and a maximum of 5 (selecting 6+ sectors means the filter doesn't add meaningful narrowing).

### 4.5 Momentum Sensitivity

**Currently thin — minor expansion.** This dimension currently holds the momentum threshold slider that's actually a se-06 entry parameter. With se-06 fully parameterized in Entry Aggression now, Momentum Sensitivity loses its primary control.

**Recommendation:** Either fold Momentum Sensitivity into Entry Aggression (which is where its rules conceptually live), or repurpose it as the home for momentum-shift rules in a future sprint. For this sprint, leave it as a vestigial dimension with a note that it's pending consolidation. Don't break it, don't expand it.

> **Resolved:** Momentum Sensitivity stays in the radar chart for visual continuity. Consolidation into Entry Aggression deferred to a future sprint.

### 4.6 Macro Awareness

**Renamed and tightened.** With `ss-04` (FOMC/CPI) deferred to Season Mode, Macro Awareness has only `earningsAvoidanceDays` (`se-04`) as its real content. Rename to **Event Risk** to better describe the solo-backtest focus.

```js
eventRisk: {
  earningsAvoidanceDays: 3,              // se-04 (existing)
  // earningsExitDays moved to exitDiscipline above
}
```

> **Resolved:** Macro Awareness → Event Risk rename confirmed.

### 4.7 Position Sizing

**Expanded.** Gains the correlation rule and the renamed winner/loser rules.

```js
positionSizing: {
  // Existing
  maxPositionWeightPct: 25,              // sr-01
  cashDeploymentTriggerPct: 20,          // sr-02

  // Existing but with renamed schema fields
  addToWinnersEnabled: false,            // sr-04 toggle
  winnerReturnTrigger: 10,               // sr-04 (NEW: was hardcoded)
  winnerAddWeight: 2,                    // sr-04 (NEW: was hardcoded)
  cutUnderperformersEnabled: false,      // sr-05 toggle
  loserUnderperformanceTrigger: 5,       // sr-05 (NEW: was hardcoded)
  loserLookbackDays: 5,                  // sr-05 (NEW: was hardcoded)
  loserReduceWeight: 3,                  // sr-05 (NEW: was hardcoded)

  // NEW
  correlationExitEnabled: false,         // sx-07 toggle
  correlationThreshold: 0.8,             // sx-07 param
  correlationLookbackDays: 30,           // sx-07 param
}
```

**UI grouping:** Three subsections:

1. **Position sizing** (maxPositionWeightPct, cashDeploymentTriggerPct)
2. **Active management** (addToWinnersEnabled subsection, cutUnderperformersEnabled subsection)
3. **Diversification** (correlationExitEnabled subsection)

---

## 5. Variable backtest duration

### 5.1 Product behavior

When a user launches a solo backtest, they pick a duration: 1, 2, 3, or 4 trading weeks. Default: 4 weeks (matches today's behavior).

Season Mode tournament entries are unchanged — always 4 weeks, never user-configurable.

### 5.2 Schema changes

**Season entry doc** (`seasonEntries/{entryId}`) gains:

```js
{
  durationDays: 20,           // 5 | 10 | 15 | 20
  durationWeeks: 4,           // 1 | 2 | 3 | 4 — denormalized for UI convenience
  mode: 'solo',               // 'solo' | 'tournament' — drives duration enforcement
  // ... existing fields
}
```

**Tournament entries always have:** `durationDays: 20, durationWeeks: 4, mode: 'tournament'`. Mode is enforced server-side at create-entry time.

**Solo entries:** `durationDays` is read from the user's selection; `mode: 'solo'`.

### 5.3 Cron changes (`api/cron/season-daily-evaluate.js`)

The cron currently assumes `currentDay` runs from 1 to 20. After this change, it must:

1. Read `entry.durationDays` instead of assuming 20
2. Use `entry.durationDays` for all "is this the final day?" / "is this the final week?" checks
3. Trigger `computeFinalMetrics` on day `durationDays` instead of day 20
4. Skip pit stop generation when `durationWeeks < 2` (no pit stops for 1-week tests — there's no weekend boundary to land on)
5. Generate `durationWeeks - 1` pit stops total (1-week: 0; 2-week: 1; 3-week: 2; 4-week: 3)

### 5.4 Pit stop scheduling implications

The current pit stop architecture assumes 3 pit stops over a 4-week test (one per weekend boundary between weeks 1-2, 2-3, 3-4).

**New scheduling:**

| Duration | Pit stops generated | Schedule |
|----------|---------------------|----------|
| 1 week | 0 | None — test ends before weekend |
| 2 weeks | 1 | After day 5 |
| 3 weeks | 2 | After day 5, after day 10 |
| 4 weeks | 3 | After day 5, after day 10, after day 15 |

Pit stop content is unchanged — same Sonnet debrief structure, same Voice Layer reply pattern. Only the count and timing differ.

### 5.5 Haiku compile prompt changes

The compile prompt today receives the user's thesis text and produces dimension values. With variable duration, it needs to:

1. **Receive the user's chosen duration** as part of the input. If the duration came from Workshop chat (Gemma asked and the user answered), it's already in the thesis context. If the user is doing manual configure, the duration picker default (4 weeks) is sent.

2. **Adjust rule recommendations to fit the duration.** For 1-week tests:
   - Time exit defaults shorter (max 3 days for a 5-day test)
   - Earnings exits become more relevant (any earnings within 5 days are nearly guaranteed events)
   - Trend alignment with longer SMAs (100, 200) becomes nonsensical and should be clamped to shorter periods (20, 50)
   - Profit targets default lower (15% in 5 days is aggressive)
   For 4-week tests:
   - Default behavior, what we have today

3. **Output a `recommendedDurationDays` field** when the thesis strongly implies a duration. If a user says "I want to catch the earnings reaction on TSLA next week," Haiku should suggest 1 week even if the duration UI hasn't been touched. The UI surfaces this as "Suggested: 1 week" with a one-click apply.

### 5.6 Workshop / Gemma awareness — the conversation-driven flow

This sprint establishes a new Workshop conversation pattern: **Gemma asks about duration once the strategy catalyst is clear**, typically after the user has articulated their thesis ("Help me build a momentum strategy around AI stocks") but before concrete rules are proposed.

**Conversation pattern:**

After the user has surfaced their core catalyst or thesis and Gemma has mirrored it back, Gemma asks:

> "Great, momentum around AI stocks makes sense given where we are in the cycle. How long would you like to run this backtest for? We can go 1 week, 2 weeks, 3 weeks, or 4 weeks — shorter tests work well for catalyst-driven plays, longer tests suit trend-following setups."

If the user asks for a recommendation, Gemma explains the tradeoff:

> "For a momentum-catalyst play like this, I'd suggest 2 weeks. It's long enough to see if the move has legs beyond the initial reaction, but short enough that mean reversion doesn't dominate the alpha signal. What do you think?"

User confirms, Gemma continues with rule recommendations calibrated to the chosen duration.

**Why this flow matters:**

1. **Educational for novices** — the conversation teaches users why timeframes matter for different strategy types, without lecturing
2. **Useful for experienced traders** — gives them a quick "here's my read" recommendation they can override
3. **Calibrates Gemma's rule recommendations** — a 1-week strategy uses different rule choices than a 4-week one. Asking up-front means the subsequent rule discussion is duration-aware from the start.

**Prompt changes required:**

Gemma's Workshop system prompt gains:
- Awareness that duration (1-4 weeks for solo backtests) is a variable she asks about
- Duration-to-rule guidance (short-duration strategies favor catalyst rules, earnings exits, tight time exits; long-duration strategies favor trend alignment, SMA-based exits, patient profit targets)
- A conversation template for the duration question and its recommendation logic
- Guidance that the final duration gets written to the conversation state so the Haiku compile step receives it

**Not required in this sprint:**

- The full Voice Layer rewrite to dynamically switch duration mid-conversation. Users who want to discuss "what if we ran this for 2 weeks vs 4 weeks" will get a qualitative answer but won't see real-time parameter re-shaping. Dynamic re-compile on duration change is a future enhancement.

### 5.7 Duration picker UI

The duration picker exists as a **secondary visible control** that reflects the conversation state and is user-editable.

**Location:** Top of Step 2 (Strategy Dimensions), above the Trading Style chips. Small, unobtrusive — visually reads as "your test duration" rather than "choose your test duration."

**Visual treatment:**
- Compact 4-option chip row: `[1 week] [2 weeks] [3 weeks] [4 weeks]`
- Selected chip highlighted with Trophy Gold (`#F0C75E`)
- When the duration was set via Gemma conversation, a small subtle badge says "from Workshop" (similar to the existing compile transparency panel treatment)
- When the user manually adjusts, the badge disappears — indicates user override

**Interaction:**
- Default duration (if no Workshop conversation): 4 weeks, matches today's behavior
- Duration set via Workshop conversation: picker shows the chosen value
- User can always override by clicking a different chip

**Does not do (in this sprint):**
- Does not re-trigger Haiku compile on change — that's a future enhancement. Changing duration in this sprint changes the backtest runtime but doesn't re-shape rule recommendations after initial compile.
- Does not block launch — any of the 4 durations are valid for solo backtests.

**On the manual-configure path** (no Workshop conversation):
- Picker defaults to 4 weeks
- No "from Workshop" badge
- User picks duration as part of the launch flow
- Haiku compile (if the user edits dimensions and re-compiles via some mechanism) uses the picker's current value

**Tournament path:**
- Season Mode tournament entries hide the picker entirely or render it disabled with a tooltip: "Tournaments are always 4 weeks"
- The existing Season Hub / Forge Landing navigation already distinguishes solo vs tournament entry points, so the mode is implicit from the user's entry flow. Phase 0 verifies this assumption holds.

---

## 6. Haiku compile prompt redesign

This is the core integration point for both rule architecture and variable duration. The current prompt at `api/forge/compile-dimensions.js:206-243` instructs Haiku to output 7 flat dimension values. The new prompt is structurally larger but cleaner.

### 6.1 Input changes

The compile endpoint already receives the thesis. New inputs:

- `userSelectedDurationDays` — from the duration picker, defaulting to 20
- `availableRulePalette` — a structured enumeration of every rule the system can express, with parameter constraints. Pre-rendered into the prompt so Haiku knows what's available.

### 6.2 Output schema changes

Today: flat key-value object with ~20 dimension values.

Tomorrow: structured object grouped by dimension, with conditional sub-objects per rule.

```json
{
  "dimensionValues": {
    "riskPosture": { "stopLossPct": 5, "trailingStopPct": null },
    "entryAggression": {
      "rsiCeiling": 75,
      "volumeConfirmEnabled": true,
      "volumeMultiplier": 1.5,
      "trendAlignmentEnabled": true,
      "trendAlignmentSmaPeriod": 50,
      "momentumThresholdPct": 3,
      "momentumLookbackDays": 10,
      "fundamentalFloor": 40,
      "institutionalEnabled": false,
      "institutionalDirection": "any",
      "institutionalQuarters": 2
    },
    "exitDiscipline": {
      "profitTargetPct": 15,
      "timeExitDays": 5,
      "timeExitMinGainPct": 1,
      "technicalExitEnabled": true,
      "technicalExitTrigger": "below_sma",
      "technicalExitRsiThreshold": 75,
      "technicalExitSmaPeriod": 20,
      "earningsExitEnabled": false,
      "earningsExitDays": 2,
      "earningsExitOnlyIfProfitable": true
    },
    "sectorStrategy": {
      "maxSectorWeightPct": 30,
      "sectorDriftTolerancePct": 10,
      "rebalanceOnDrift": false,
      "sectorFilterEnabled": true,
      "sectorFilterMode": "top_n",
      "sectorFilterTimeframe": "1W",
      "sectorFilterTopN": 3,
      "sectorFilterSelected": []
    },
    "eventRisk": { ... },
    "positionSizing": { ... }
  },
  "recommendedDurationDays": 20,
  "confidence": 0.82,
  "warnings": [],
  "mappingNotes": [
    "Mapped 'follow the trend' to SMA 50 trend alignment",
    "Mapped 'tight stops' to 5% stopLossPct",
    "Mapped 'MA-break exit' to technicalExit with below_sma trigger, 20-day SMA"
  ],
  "appliedClamps": []
}
```

### 6.3 Prompt structure

Approximate new structure (full prompt is roughly 3-4× longer than today):

```
SYSTEM: You are a strategy compiler...

[CONTEXT]
- Available rule palette: <enumerated list with constraints>
- User's selected duration: 20 trading days (4 weeks)
- Duration-rule fit guidance: <how duration affects rule choices>

[THESIS]
<user's thesis text>

[OUTPUT SCHEMA]
<JSON schema for dimensionValues>

[INSTRUCTIONS]
1. Map every concrete claim in the thesis to a rule and parameter.
2. For any claim you cannot map, add a string to `warnings`.
3. For any rule you enabled with a non-default parameter, add a brief note to `mappingNotes`.
4. For any parameter the user requested but exceeds valid range, clamp to the nearest valid value and note in `appliedClamps`.
5. If the thesis implies a duration shorter or longer than the user's selection, populate `recommendedDurationDays`.
6. If the user mentions sector momentum, sector rotation, or "top sectors" — enable `sectorFilterEnabled` in sectorStrategy and configure mode/timeframe/topN to match. For a 1-week backtest bias toward timeframe='1W'; for a 4-week bias toward '1M'. If the user names specific sectors, use `specific_sectors` mode with those sector names.
7. Output valid JSON matching the schema. No commentary outside the JSON.
```

### 6.4 Cost implications

Per-compile cost goes up because the prompt is longer. Estimate:

- Today: ~2,000 input tokens × $1/M = $0.002 + ~500 output tokens × $5/M = $0.0025 → **~$0.0045 per compile**
- Tomorrow: ~5,000 input tokens × $1/M = $0.005 + ~1,000 output tokens × $5/M = $0.005 → **~$0.01 per compile**

Roughly 2× cost per compile. Still cheap. At 1,000 compiles/day, this is ~$10/day vs ~$5/day today. Negligible at scale.

> **Resolved:** Rule palette enumerated inline per compile request for now. Cache when scale demands it — not a scale concern at current usage.

---

## 7. UI implications for `StrategyDimensions.jsx`

### 7.1 New control types needed

The expanded schema introduces controls that don't exist in `StrategyDimensions.jsx` today. Three new control component types:

**1. Period picker** — for SMA period selection (20/50/100/200), MACD lookbacks, and similar enumerated period selectors. Visually a chip group: `[20] [50] [100] [200]`. Selected chip highlighted, others muted.

**2. Trigger / signal picker** — for selecting between categorical signals like `rsi_overbought` vs `macd_bearish`. Visually a vertical option list with descriptive labels and short explanations:

```
○ RSI Overbought
  Exit when RSI exceeds threshold
○ MACD Bearish Crossover
  Exit when MACD crosses below signal line
○ Either RSI or MACD
  Exit on whichever fires first
○ Below Moving Average
  Exit when price drops below selected MA
```

**3. Conditional sub-parameter group** — when a parent control has a value that requires sub-parameters, the sub-parameters reveal below. E.g., picking "Below Moving Average" reveals an SMA period picker. Picking "RSI Overbought" reveals an RSI threshold slider.

### 7.2 Existing controls reused

These existing components from `StrategyDimensions.jsx` are sufficient for most schema additions:

- `ParamSlider` — for thresholds, ceilings, percentages
- `ParamToggle` — for enabling/disabling sub-rules
- `ParamPicker` — adapt for period and trigger pickers (or build new specialized components if `ParamPicker` is too generic)

### 7.3 Visual hierarchy

The expanded dimensions are denser. Each dimension card grows from ~3-4 controls to ~8-10. To avoid overwhelming users:

**Subsection grouping with quiet headers.** Inside each dimension card, controls cluster into 2-3 named subsections. Subsection headers are small, muted text — they organize visually without demanding attention.

**Conditional reveal.** Sub-parameters (like the SMA period picker for `below_sma` exit) are hidden until their parent control is set to a value that needs them. This keeps the default state simple and reveals complexity only when user choices warrant it.

**No experience-level gating in the UI.** Confirmed in scope discussion: experience-level routing happens in the Workshop conversation, not the UI. A novice and an expert see the same Strategy Dimensions UI; the difference is that the novice's compiled strategy populates fewer fields because Gemma recommended fewer rules.

### 7.4 Radar chart implications

The radar chart currently shows 7 dimensions with a single "intensity" value per dimension via `dimensionToRadarScore`. With richer schemas, the per-dimension intensity calculation becomes more nuanced — a dimension with 8 enabled rules at moderate intensity is differently expressive than a dimension with 2 enabled rules at maximum intensity.

**Updated calculation approach for `dimensionToRadarScore`:**

For each dimension, compute two components:

1. **Breadth** = (number of enabled rules in the dimension) / (total rules available in the dimension). Range 0-1.
2. **Intensity** = average of per-rule normalized parameter intensity. Per-rule intensity is specific: for stopLossPct, "tighter stop = higher intensity" (inverse of percentage, clamped 3-20 → 1.0-0.0). For fundamentalFloor, "higher floor = higher intensity" (linear 0-80 → 0.0-1.0). Each rule's intensity function is defined in a small lookup table inside `dimensionMapper.js`.

**Combined score:** `radarScore = 0.4 * breadth + 0.6 * intensity`. Bias toward intensity because an aggressive 2-rule strategy (tight stop + high RSI ceiling) should read as more "extreme" on the radar than a lukewarm 8-rule strategy. Weighting is tunable during implementation if the visual doesn't match intent.

**Visual outcome:**
- Novice strategies with few rules at moderate parameters → small, rounded radar shape
- Expert strategies with many rules at aggressive parameters → larger, spikier radar shape
- The radar becomes a visual signature of strategy complexity + aggressiveness

The existing 0-1 normalization at the radar rendering layer is unchanged — we're only changing how the per-dimension score is computed, not how the chart draws.

> **Resolved:** Radar chart does not color-code by duration in this sprint. Future enhancement if user testing shows confusion.

### 7.5 Trading Style chip presets

The existing 4 trading style chips (Momentum Rider, Swing Trader, Day Trader, Defensive Fortress) preset the dimension values. With the expanded schema, the presets need expanded values too.

Presets become richer — each preset now sets ~30 schema fields instead of ~20. The preset definitions live in `dimensionMapper.js` `COLLECTION_DEFS`. Each preset gets a thoughtful update to populate the new schema fields with values consistent with its style.

> **Resolved:** Trading style presets stay duration-agnostic. Duration is a separate control.

---

## 8. Custom Rule Builder integration

A short note: the Custom Rule Builder spec from earlier work (`FORGE_CUSTOM_RULE_BUILDER_SPEC_V1_1.docx` in project files) lets users author their own compound rules. With the expanded schema, custom rules become significantly more useful because they can compose against the richer parameter set.

**This sprint does not build the Custom Rule Builder.** But the schema changes here should be designed with it in mind — specifically, the schema rename map (section 3) standardizes naming conventions that future custom rules can compose against. No additional work in this sprint, just a note that this design supports future extensibility.

---

## 9. Migration of existing data

### 9.1 Existing bundles in Firestore

Some users (Flash and any beta testers) have launched strategies with the current dimension schema. Their bundle docs at `agents/{agentId}/bundles/{bundleId}` contain `dimensionValues` with the current shape.

**Migration approach:** Backward-compatible reads. The dimension reader (`StrategyDimensions.jsx` and `dimensionsToRuleSnapshots`) checks for the new field names first, falls back to the old field names if absent. Old bundles continue to work; new bundles get the new shape.

No migration cron needed. Old bundles are read-only artifacts of past strategies — they don't need to be rewritten in place.

### 9.2 Existing season entries

Active season entries (mid-experiment) reference bundle IDs. As long as the bundle docs remain readable (per 9.1), active experiments continue to evaluate correctly through to completion.

### 9.3 Cron compatibility

The existing `season-daily-evaluate` cron reads `entry.durationDays` (new field). For old entries that don't have this field, the cron defaults to `20`. Single line of defensive code.

---

## 10. Phasing for implementation

This sprint is large. Rather than one massive prompt, it breaks into phased Claude Code sessions on a single long-running branch. Estimated 4-5 sessions.

### Phase 0 — Schema migration audit (Discovery, read-only)

Before any code changes, audit every consumer of `dimensionValues` to surface anything that breaks under the rename in section 3. Output: a list of files and lines to update, plus any unexpected consumers.

**Additional Phase 0 discovery items for SE-09:**

- Confirm the Firestore path for per-stock momentum rankings (referenced in the search/rankings UI)
- Confirm the Firestore path for per-sector performance data by timeframe (referenced in the sector performance screen)
- Document the exact schema of both collections — field names we'll read from in the evaluator
- Verify refresh cadence (when are these collections updated? are they fresh enough for each evaluation tick?)
- Confirm the 11-sector universe list and the canonical sector name strings (must match `ctx.fundamentals[ticker].sector` values exactly or SE-09 will silently fail matching)

**Additional Phase 0 discovery items carried over from v1:**

- `sx-07` correlation exit dispatch: verify the special-case `ticker=null` handling in `season-daily-evaluate.js`
- `se-08` institutional data population: verify the `institutionalHoldings` Firestore collection is actually populated for the 232-stock universe

### Phase 1 — `dimensionsToRuleSnapshots` rewrite + new helpers

Rewrite the translation function to honor the new schema. Add per-rule emit functions following the pattern in section 3.2. Add the 4 newly-emitted rules. Update the schema rename throughout `dimensionMapper.js`.

### Phase 2 — Haiku compile prompt rewrite

Rewrite `api/forge/compile-dimensions.js` system prompt per section 6. Update output schema. Add the rule palette enumeration. Add duration awareness.

### Phase 3 — Variable duration plumbing

Add `durationDays` / `durationWeeks` / `mode` to entry doc schema. Update `season-daily-evaluate.js` to honor it. Update pit stop scheduling logic. Update `create-entry.js` to enforce mode-based duration.

### Phase 4 — UI updates to `StrategyDimensions.jsx`

Build the new control types (period picker, trigger picker, conditional sub-parameter group). Reorganize each dimension card into subsections. Add the duration picker (location per open question 5.A). Update presets in `COLLECTION_DEFS`.

### Phase 5 — Workshop / Voice Layer prompt updates

Small change: update Gemma's prompt to be aware of duration as a variable and the expanded rule palette.

### Phase 6 — Verification and testing

Test scenarios across multiple thesis types and durations. Verify the Workshop → compile → backtest pipeline produces strategies that actually use the rules discussed. Spot-check Firestore writes to confirm the new schema persists correctly.

**All phases on a single branch.** Confirmed earlier rule: one task = one branch.

---

## 11. Resolved decisions reference log

All open questions from v1 and v2 are resolved. Summary here for implementation teams:

**Rule defaults (v1 2.A):** Defaults hold as written in Section 2. SX-05 default trigger stays `rsi_overbought` — it's the most widely understood overbought/oversold indicator among both novice and professional users, making it the right default. Users who want MACD or SMA-break exits select them explicitly.

**Migration risk on schema rename (v1 3.A):** Phase 0 audit runs before any code changes. Every consumer of `dimensionValues` gets enumerated and evaluated for rename impact. See Section 10 Phase 0.

**Momentum Sensitivity dimension (v1 4.A):** Stays in the radar chart for visual continuity. Future sprint consolidates with Entry Aggression.

**Macro Awareness → Event Risk rename (v1 4.B):** Confirmed. Rename happens as part of schema migration in Phase 0/1.

**Sector multi-select min/max (v2 4.C, v2 11.F):** Minimum 1 sector, maximum 5 sectors enforced in UI.

**Duration picker UX (v1 5.A, 5.B):** Conversation-driven flow. Gemma asks about duration mid-conversation after the catalyst is clear. Secondary UI picker (top of Step 2) reflects conversation state and is user-editable. Full flow in Section 5.6 and 5.7.

**Rule palette enumeration (v1 6.A):** Inline per compile request.

**Radar chart duration styling (v1 7.A):** Not in this sprint.

**Trading style presets (v1 7.B):** Duration-agnostic.

**`sx-07` correlation exit dispatch (v2 11.A):** Phase 0 verifies the special-case `ticker=null` dispatch handling.

**`se-08` institutional data population (v2 11.B):** Phase 0 verifies the `institutionalHoldings` Firestore collection's population coverage for the 232-stock universe.

**Default duration on first compile (v2 11.C):** Manual-configure path defaults to 4 weeks. Workshop path always has a duration from the conversation (Gemma asks).

**Testing matrix (v2 11.D):** Handful of tests for the first merge. Systematic Gemma flexibility testing deferred to a future dedicated QA pass.

**SE-09 1D timeframe utility (v2 11.E):** Include 1D. Some traders do short-horizon rotation trades and should have it available.

**SE-09 data freshness (v2 11.G):** Silently pass (no filter applied) if ranking cron data is stale/missing. Log warning. Better to run backtest without filter than to have zero tickers pass.

**Future enhancement (bookmarked):** DRB integration for sector performance data — Gemma consumes sector rotation context unprompted in Workshop conversations. Not this sprint. SE-09 reads directly from the sector performance Firestore collection.

---

## 12. Success criteria

When this sprint ships and merges to main, the following must be true:

- A Workshop conversation about "20-day MA trend exit" produces a compiled strategy whose `sx-05` rule is emitted with `trigger: 'below_sma', smaPeriod: 20`. Verifiable via Firestore inspection.
- A user can launch a 1-week solo backtest from the SeasonEntryModal duration picker and the cron correctly stops evaluation at day 5.
- A user can pick MACD bearish as their technical exit trigger in Strategy Dimensions and the resulting backtest exits positions on actual MACD crossovers, not RSI breakdowns.
- A user can say "only trade the top 3 momentum sectors this week" to Gemma and the resulting backtest evaluates only tickers whose sector is in the current top 3 on the 1W timeframe.
- All 5 newly-emitted rules can be configured via Strategy Dimensions and produce non-zero evaluator activity in their respective scenarios.
- Old bundles created before this sprint continue to evaluate correctly without manual migration.
- Manual configure path (no Workshop) renders a sensible default Strategy Dimensions UI with all the new controls available.
- Compile transparency panel (shipped in prior sprint) correctly displays warnings/clamps/notes from the new compile output.

---

## 13. Implementation kickoff

This spec is **locked**. All 17 open questions from v1 and v2 have been resolved (see Section 11 reference log). The next step is converting Phase 0 (discovery audit) into a Claude Code prompt.

**Branch strategy:** One task = one branch. All phases of this sprint land on the same branch with multiple commits. Branch name to be set when Phase 0 kicks off.

**Phase sequence (from Section 10):**

1. **Phase 0** — Schema migration audit + SE-09 data dependency verification (read-only, ~1 session)
2. **Phase 1** — `dimensionsToRuleSnapshots` rewrite + new rule emission (~1-2 sessions)
3. **Phase 2** — Haiku compile prompt rewrite (~1 session)
4. **Phase 3** — Variable duration plumbing (~1 session)
5. **Phase 4** — UI updates to `StrategyDimensions.jsx` + duration picker (~1-2 sessions)
6. **Phase 5** — Workshop / Voice Layer prompt updates (~0.5 session)
7. **Phase 6** — Verification and testing (~0.5 session)

**Estimated total:** 5-7 Claude Code sessions. All on a single long-running branch with a single PR at the end.

**Next action:** Claude drafts the Phase 0 Claude Code prompt and hands it to Flash to execute.

---

*End of design specification v3.0 — LOCKED*
