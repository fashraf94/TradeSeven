# Phase 5 — Layer 1 Rendering Finale: Discovery Report

**Status:** Read-only investigation. No code changes.
**Branch:** `claude/layer1-rendering-finale-KMVJF`
**Date:** 2026-05-12
**Scope:** Audit what's captured in `voiceLayerCache` + Phase 4 snapshots vs. what's actually rendered into Gemma's system prompt. Surface the design decisions Phase 5 needs to make.

---

## TL;DR

Across Phase 1 → Phase 4 + Workstream B, the system captures **~60 distinct technical fields** per portfolio symbol (and a roughly equivalent snapshot at trade-decision time). The Voice Layer prompt renders **prose summaries of two of them** (`trendSummary`, `momentumSummary`) plus the BaggerBomb-specific scoring telemetry (`thresholdProximity`, `thresholdNote`, `existingBadges`). Everything else — **Phase 3 intraday/VWAP, Phase 4 proposalHistory/trade snapshots, raw Phase 2A/2B fields like RSI value, MACD freshness flags, NR7, divergence direction, distance-to-support/resistance, pivots, sector RS percentile, BB%B** — is captured-but-invisible.

The rendering matrix is **lopsided toward scoring mechanics, light on technical situation awareness.** Gemma can talk about red zones and badges with fluency but cannot see a fresh MACD cross, a bearish RSI divergence, or the fact that NVDA just gapped 1.2% above its session VWAP on volume.

Phase 5's job is to render the captured richness without breaking the "synthesize-don't-quote" prompt rule and without making the prompt structurally illegible.

The VWAP semantics question has a concrete answer: it **is session VWAP** (EODHD `/intraday/` default window, no `from/to` params), which is the universal-trader meaning — so no renaming or recalculation is needed. The risk is **how it's labeled in the prompt**, not what it represents.

Recommended split: **5A** (render the highest-signal fields that already have phase-1 prose summaries), **5B** (render Phase 3 intraday explicitly), **5C** (render Phase 4 snapshots in Review Mode for counterfactuals/trades).

---

## Q1 — Master Field Inventory

### 1.1 / 1.2 — `voiceLayerCache.portfolioBriefs[i]` and `benchBriefs[i]`

Sources: `api/cron/voice-layer-cache.js:177-246` (portfolio), `api/cron/voice-layer-cache.js:265-380` (bench).

Portfolio briefs are built every 15 min during market hours. Bench briefs are intentionally fault-tolerant (price/score can be null — crypto bench has no EODHD feed).

| # | Field | JSON path | Type | Source phase | Portfolio | Bench | Example |
|---|---|---|---|---|---|---|---|
| 1 | `symbol` | `.symbol` | string | core | ✓ always | ✓ always | "NVDA" |
| 2 | `tier` | `.tier` | string | core | ✓ always | — | "star" / "core" / "support" |
| 3 | `assetClass` | `.assetClass` | string | core | — | ✓ always | "stock" / "crypto" |
| 4 | `sector` | `.sector` | string | ranking | — | ✓ always | "Technology" |
| 5 | `price` | `.price` | number | Phase 1 (EODHD REST) | ✓ required | nullable | 425.18 |
| 6 | `changePercent` | `.changePercent` | number | Phase 1 | ✓ always | nullable | +2.43 |
| 7 | `technicalScore` | `.technicalScore` | number | Phase 2A (rankings) | ✓ (fallback 0) | nullable | 87 |
| 8 | `technicalRank` | `.technicalRank` | number | Phase 2A | ✓ (fallback 0) | nullable | 4 |
| 9 | `rsPercentile` | `.rsPercentile` | number | Phase 2A (RS factor) | ✓ (fallback 50) | nullable | 87 |
| 10 | `atrPercent` | `.atrPercent` | number | Phase 2A | ✓ (fallback 0) | nullable | 4.2 |
| 11 | `trendSummary` | `.trendSummary` | string (prose) | Phase 2A (SMA stack) | ✓ always | conditional | "Strong uptrend. Above all major SMAs. RS vs SPY rising." |
| 12 | `momentumSummary` | `.momentumSummary` | string (prose) | Phase 2B (momentum) | ✓ always | conditional | "RSI healthy, not extended. MACD expanding. Volume 1.1x avg." |
| 13 | `thresholdNote` | `.thresholdNote` | string \| null | core/ATR | conditional (atrPercentile > 0.7) | — | "High ATR — volatile, could hit thresholds quickly" |
| 14 | `existingBadges` | `.existingBadges` | string[] | core/scoring | ✓ ([] default) | — | `["bagger"]` |
| 15 | `thresholdProximity` | `.thresholdProximity` | object \| null | core/scoring | conditional | — | see 15a-15g |
| 15a | ↳ `currentMultiplier` | `.thresholdProximity.currentMultiplier` | number | core/scoring | ✓ | — | 0.93 |
| 15b | ↳ `baseATR` | `.thresholdProximity.baseATR` | number | core/scoring | ✓ | — | 2.5 |
| 15c | ↳ `redZone` | `.thresholdProximity.redZone` | obj \| null | core/scoring | conditional | — | { targetThreshold: 'bagger', targetMultiple: 1.0, direction: 'positive', zoneProgressPercent: 72 } |
| 15d | ↳ `redZone.targetThreshold` | … | string | core/scoring | conditional | — | "bagger" / "doubleBagger" / "tripleBagger" / "bust" |
| 15e | ↳ `redZone.zoneProgressPercent` | … | number | core/scoring | conditional | — | 72 |
| 15f | ↳ `redZone.direction` | … | string | core/scoring | conditional | — | "positive" / "negative" |
| 15g | ↳ `swapLock` | `.thresholdProximity.swapLock` | obj | core/scoring | ✓ (often unlocked) | — | { locked: true, direction: 'positive', distancePercent: 0.18, message: 'approaching BaggerBomb' } |
| 16 | `intraday` | `.intraday` | object \| null | **Phase 3** | ✓ (null sentinel if fetch failed) | — (not computed for bench) | see 16a-16d |
| 16a | ↳ `vwap` | `.intraday.vwap` | number \| null | Phase 3 | ✓ | — | 425.18 |
| 16b | ↳ `currentPrice` | `.intraday.currentPrice` | number \| null | Phase 3 | ✓ | — | 428.10 |
| 16c | ↳ `vwapDeviation` | `.intraday.vwapDeviation` | number \| null | Phase 3 | ✓ | — | +0.69 (%) |
| 16d | ↳ `sma20_5m` | `.intraday.sma20_5m` | number \| null | Phase 3 | ✓ | — | 423.91 |
| 17 | `cooldownUntil` | `.cooldownUntil` | string (ISO) \| null | core (revolving door) | — | ✓ always | "2026-05-13T15:00:00.000Z" |
| 18 | `cooldownActive` | `.cooldownActive` | boolean | core | — | ✓ always | false |

**Structural symmetry — portfolio vs bench:**

| Portfolio has, bench doesn't | Bench has, portfolio doesn't |
|---|---|
| `tier`, `intraday`, `thresholdProximity`, `thresholdNote`, `existingBadges` | `assetClass`, `sector`, `cooldownUntil`, `cooldownActive` |

Bench briefs intentionally degrade gracefully — every per-symbol field except `symbol`/`assetClass`/`sector` can be null. Portfolio briefs are stricter (a position with no price is skipped).

> **Workstream B observation.** Bench briefs already carry `trendSummary` and `momentumSummary` when factor data is present (conditional emission, `voice-layer-cache.js:293-346`). That's the Haiku-side parity work. Symmetric rendering in the Voice Layer would surface them to Gemma identically.

### 1.3 — `scoutAlerts` and `marketContext`

Source: `voice-layer-cache.js:386-446` (scoutAlerts), `voice-layer-cache.js:452-494` (marketContext).

**`scoutAlerts[i]`** — capped at 5 per refresh:

| Field | Type | Notes |
|---|---|---|
| `symbol` | string | Must be on watchlist AND not currently in portfolio |
| `type` | "rs_breakout" \| "volume_surge" \| "game_fit" | Alert classification |
| `headline` | string | Concise title |
| `detail` | string | One-line supporting context |
| `relevance` | "momentum_chaser" \| "all" | Archetype filter |

**`marketContext`** — flattened market-level intelligence:

| Field | Type | Source |
|---|---|---|
| `regime` | "bull" \| "bear" \| "sideways" \| "unknown" | indexIntelligence |
| `regimeDetail` | string (prose) | indexIntelligence |
| `spyChange` | number \| null | EODHD SPY |
| `volatilityRegime` | "elevated" \| "normal" \| "depressed" \| "unknown" | VIX proxy / realized vol |
| `vixLevel` | always `null` | (placeholder — VIX not currently sourced) |
| `breadthTier` | "strong" \| "narrow" \| "declining" \| "unknown" | adv/dec |
| `breadthDetail` | string (prose) | adv/dec |
| `breadthQualitySignal` | "quality_breadth" \| "weak_breadth" \| null | composite |
| `breadthSpyVsRspGap` | number \| null | RSP - SPY % |
| `leadershipSignal` | "tech_leads" \| "breadth_driven" \| "mega_cap_driven" \| "mixed" | composite |
| `divergenceSignal` | "rotation" \| "narrow_participation" \| "small_cap_momentum" \| "none" | composite |
| `topSector`, `topSectorChange` | string, number \| null | sector ETF performance |
| `worstSector`, `worstSectorChange` | string, number \| null | sector ETF performance |
| `yieldRegime` | "high" \| "low" \| "rising" \| "neutral" \| "unknown" | 10Y treasury |

### 1.4 — `proposalHistory[i].snapshot` and `trades[i].snapshot` (Phase 4)

Source: `api/_utils/buildTechnicalSnapshot.js:23-104`. Written from `api/cron/agent-evaluate.js:1003-1014` (proposalHistory) and `api/_utils/agentSwapExecution.js:162-180` (trades). Each is a *pair* of snapshots — one per leg of the swap.

```ts
snapshot = {
  symbolOut: TechnicalSnapshot,
  symbolIn:  TechnicalSnapshot,
}
```

Where `TechnicalSnapshot` =

```ts
{
  symbol: string,
  sectorName: string | null,
  capturedAt: string (ISO),

  trend:        { shortTerm, intermediate, longTerm } // each "up"|"down"|"sideways"|null   ← Phase 2A
  momentum:     { rsi, macdAboveSignal, macdFreshBullishCross, macdFreshBearishCross,
                  macdHistogram, divergence, upDayVolRatio }                                ← Phase 1 + 2B
  volatility:   { bbPercentB, bbUpper, bbLower, bBandwidthPercentile, atrPercent }          ← Phase 1
  volume:       { avgVolume, ratio, tier, nr7Flag, dailyRange }                             ← Phase 1 + 2A
  smaStack:     { aboveSMA20, aboveSMA50, aboveSMA200, sma200_position, distTo52wkHigh }    ← Phase 2A
  rs:           { rsPercentile, sectorRSPercentile }                                        ← Phase 2A
  levels:       { nearestSupport, nearestResistance,
                  distanceToSupportPct, distanceToResistancePct }                           ← Phase 2A
  pivots:       object | null                                                               ← Phase 2A
  recentAction: { lastCandlePattern }                                                       ← Phase 2B
  intraday:     { vwap, currentPrice, vwapDeviation, sma20_5m }                             ← Phase 3
  composite:    { technicalScore, technicalRank, sectorTechnicalRank, sectorTechnicalTotal } ← Phase 2A
}
```

Per `buildTechnicalSnapshot.js`, **every sub-object is always present**, with null leaves when data is missing. So shape is stable, content varies.

### 1.5 — Master inventory grouped by source phase

| Group | Fields |
|---|---|
| **Core / scoring** (always rendered today as part of BaggerBomb mechanics) | `tier`, `thresholdProximity.*` (incl. `redZone`, `swapLock`), `thresholdNote`, `existingBadges`, bench `cooldownActive`/`cooldownUntil` |
| **Phase 1 — primitives** | `price`, `changePercent`, BB upper/lower/percentB, BB bandwidth percentile, ATR%, avgVolume, volume ratio, volume tier, dailyRange, MACD histogram |
| **Phase 2A — trend / RS / levels / pivots** | `technicalScore`, `technicalRank`, `rsPercentile`, sectorRSPercentile, SMA stack flags (above20/50/200), sma200_position, distTo52wkHigh, nearestSupport, nearestResistance, distanceToSupportPct, distanceToResistancePct, pivots, sectorTechnicalRank, sectorTechnicalTotal, NR7 flag |
| **Phase 2B — momentum / candles / divergence** | RSI, MACD above-signal, MACD fresh bullish cross, MACD fresh bearish cross, divergence (bullish/bearish/none), upDayVolRatio, lastCandlePattern |
| **Phase 3 — intraday** | `intraday.vwap`, `intraday.currentPrice`, `intraday.vwapDeviation`, `intraday.sma20_5m` |
| **Phase 4 — snapshots** | All of the above, frozen at trade-decision time and trade-execution time, on `proposalHistory[i].snapshot.{symbolOut,symbolIn}` and `trades[i].snapshot.{symbolOut,symbolIn}` |
| **Market-level** | `marketContext.*` (regime, vol, breadth, leadership, divergence, top/worst sectors, yields) |
| **Watchlist** | `scoutAlerts[i].{type, headline, detail, relevance}` |

Total distinct per-symbol leaves: **~45 in voiceLayerCache briefs**, **~50 in the Phase 4 snapshot pair** (×2 for both legs). Market-level: **15 leaves**. Watchlist: **5 leaves × up to 5 alerts**.

---

## Q2 — Current Rendering Surfaces

All renderers live in `api/_utils/voiceLayerPrompt.js`. Below is every `build*` function that contributes to the assembled system prompt.

| # | Function | Lines | Mode(s) | What it consumes | Output shape |
|---|---|---|---|---|---|
| 1 | `buildBattleState` | 896-929 | battle | `battle.{portfolio, scoreState, gameMode, trades[].{action,symbolOut,symbolIn,tier,rationale,trigger}}` + computed marketState, timeRemaining, gameContext | Header + bulleted recent trades (last 5). **No snapshot, no technical context per trade.** |
| 2 | `buildPortfolioBriefsBlock` | 933-972 | battle, review | `marketSnapshot.portfolioBriefs[]` — uses `symbol, tier, changePercent, trendSummary, momentumSummary, thresholdNote, thresholdProximity, existingBadges` | "YOUR PORTFOLIO …" + per-symbol stanza w/ trend/momentum/threshold/swap-lock/badges. **`intraday`, `technicalScore`, `technicalRank`, `rsPercentile`, `atrPercent`, `price` not used.** |
| 3 | `buildBenchBriefsBlock` | 974-995 | battle, review | `marketSnapshot.benchBriefs[]` — uses `symbol, assetClass, sector, changePercent, cooldownActive, cooldownUntil, trendSummary, momentumSummary` | "YOUR BENCH …" + per-symbol one-line header + optional trend/momentum prose. **`technicalScore`, `technicalRank`, `rsPercentile`, `atrPercent`, `price` not used.** |
| 4 | `buildScoutAlertsBlock` | 997-1005 | battle, review | `marketSnapshot.scoutAlerts[]` — uses `headline, detail` | "OPPORTUNITIES ON YOUR WATCHLIST: …" — concatenated headline + detail. **`type` and `relevance` not surfaced.** |
| 5 | `buildMarketSnapshotContext` | 1007-1042 | battle, review | `marketSnapshot.marketContext` — uses every field except `vixLevel` (which is always null anyway) | "MARKET RIGHT NOW: …" — multi-line summary. **Most market-context fields rendered.** |
| 6 | `buildPartnerModelBlock` | 850-870 | all | `agent.partnerProfile` | known/unknown dimensions w/ confidence — agent context, not market data |
| 7 | `buildConvictionsBlock` | 872-894 | all | `agent.convictions`, `agent.consolidatedInsight` | accumulated wisdom + active convictions list |
| 8 | `buildReviewContext` | 1208-1287 | review | `battle.{trades, proposalHistory, liveDirectives}`, `dailyReviews`, `dailyGrades` | "REVIEW CONTEXT: …" — headline, summary, key moments, trades w/ rationale + outcome pts, counterfactuals (vetoed proposals w/ counterfactualPoints), user grades, directive outcomes. **Does NOT read `proposalHistory[i].snapshot` or `trades[i].snapshot`. Counterfactuals have zero technical context.** |
| 9 | `buildWorkshopAnchorBlock` | 1054-1063 | workshop | `anchorContext` string (DRB pre-formatted) | Pass-through with header |
| 10 | `buildWorkshopContextBlock` | 1067-1099 | workshop | `workshopContext.{previousThesis, sessionTurnCount, messagesRemaining, messageBudget, seedContext}` | Turn/budget line + preloaded context + previous thesis (JSON-stringified) |
| 11 | `renderPreloadedContextBlock` | 1108-onward | workshop | `seedContext.{kind: 'theme'|'sector'|'watchlist', ...}` | Preloaded context lines |
| 12 | `buildParsedSignalBlock` | 1306-1338 | signal_expansion, watchlist_dialogue | `parsedSignal.*` (topic, contentType, signalDirection, etc.) | Delimited parsed-signal payload |
| 13 | `buildSignalMarketContextBlock` | 1344-1351 | signal_expansion | pre-formatted string | Pass-through |
| 14 | `buildCandidateTickersBlock` | 719-755 | watchlist_dialogue | `candidateTickers[]` grouped by slot | Watchlist candidate state |
| 15 | `buildAnatomyBlock` | 761-785 | watchlist_dialogue | `anatomy.{thesis, activationConditions, invalidationConditions}` | Watchlist anatomy state |
| 16 | `buildRecentExchangesBlock` | 787-799 | watchlist_dialogue | `recentExchanges[]` | Last few user/agent turns |
| 17 | `buildVoiceLayerPrompt` | 1355-1693 | (entry point) | All of the above + agent identity + phase rules | Final assembled prompt |

**Assembly order, battle mode (`buildVoiceLayerPrompt:1668-1690`):**

```
identity (Block 1, TOP)
GAME_MECHANICS (Block 1.5, TOP)
OUTPUT_FORMAT (Block 7, TOP)
partnerModel (Block 2, MIDDLE)
convictions (Block 3, MIDDLE)
anchor / DRB (Block 3.5, MIDDLE)
portfolioBriefs        ← if cache exists
benchBriefs            ← if cache exists
scoutAlerts            ← if cache exists
marketContext          ← if cache exists
DATA_CONFIDENCE_RULE   ← if marketSnapshot
battleState (Block 5, BOTTOM)
fewShot (BOTTOM)
elicitation (BOTTOM)
phaseRules (Block 6, BOTTOM — LAST, highest attention)
```

**Assembly order, review mode (`buildVoiceLayerPrompt:1419-1440`):**

Identical top/middle structure; replaces `battleState` with `buildReviewContext` and `fewShot/elicitation` with `REVIEW_FEW_SHOT` + `REVIEW_PHASE_RULES`. Phase 4 snapshots flow through `battle.proposalHistory` and `battle.trades` but are never consulted by `buildReviewContext`.

### 2.3 — Rendering matrix: fields × surfaces

Legend: ✓ rendered, ⊘ partial (e.g., embedded in prose summary but not as a structured line), ✗ captured but not rendered.

| Field | Portfolio block | Bench block | Battle state | Review context | Snapshot rendering anywhere? |
|---|---|---|---|---|---|
| `symbol` | ✓ | ✓ | ✓ (trade swap) | ✓ (trade/proposal swap) | n/a |
| `tier` | ✓ | (`assetClass` instead) | ⊘ (in portfolio header) | ✓ | n/a |
| `price` | ✗ | ✗ | ✗ | ✗ | ✗ |
| `changePercent` | ✓ | ✓ | ✗ | ✗ | ✗ |
| `trendSummary` (Phase 2A prose) | ✓ | ✓ (conditional) | ✗ | ✗ | ✗ |
| `momentumSummary` (Phase 2B prose) | ✓ | ✓ (conditional) | ✗ | ✗ | ✗ |
| `technicalScore` | ✗ | ✗ | ✗ | ✗ | ✗ |
| `technicalRank` | ✗ | ✗ | ✗ | ✗ | ✗ |
| `rsPercentile` | ✗ | ✗ | ✗ | ✗ | ✗ |
| `atrPercent` | ✗ | ✗ | ✗ | ✗ | ✗ |
| `thresholdNote` | ✓ | — | ✗ | ✗ | n/a |
| `thresholdProximity.currentMultiplier` | ✓ | — | ✗ | ✗ | n/a |
| `thresholdProximity.baseATR` | ✓ | — | ✗ | ✗ | n/a |
| `thresholdProximity.redZone.*` | ✓ | — | ✗ | ✗ | n/a |
| `thresholdProximity.swapLock.locked` | ✓ | — | ✗ | ✗ | n/a |
| `existingBadges` | ✓ | — | ✗ | ✗ | n/a |
| **`intraday.vwap`** | **✗** | — | **✗** | **✗** | **✗** |
| **`intraday.currentPrice`** | **✗** | — | **✗** | **✗** | **✗** |
| **`intraday.vwapDeviation`** | **✗** | — | **✗** | **✗** | **✗** |
| **`intraday.sma20_5m`** | **✗** | — | **✗** | **✗** | **✗** |
| `cooldownActive`/`cooldownUntil` | — | ✓ | ✗ | ✗ | n/a |
| `sector` (bench) | — | ✓ | ✗ | ✗ | n/a |
| `marketContext.regime` (+detail) | — | — | — | — | (rendered by `buildMarketSnapshotContext` ✓) |
| `marketContext.spyChange` | — | — | — | — | ✓ |
| `marketContext.volatilityRegime` | — | — | — | — | ✓ |
| `marketContext.breadthTier`/Detail | — | — | — | — | ✓ |
| `marketContext.breadthQualitySignal` + RSP gap | — | — | — | — | ✓ |
| `marketContext.leadershipSignal` | — | — | — | — | ✓ |
| `marketContext.divergenceSignal` | — | — | — | — | ✓ (when non-"none") |
| `marketContext.topSector`/Change | — | — | — | — | ✓ |
| `marketContext.worstSector`/Change | — | — | — | — | ✓ |
| `marketContext.yieldRegime` | — | — | — | — | ✓ |
| `scoutAlerts[].headline` + `.detail` | — | — | — | — | ✓ (by `buildScoutAlertsBlock`) |
| `scoutAlerts[].type` / `.relevance` | — | — | — | — | ✗ |
| `trades[].symbolOut`/`In`/`tier`/`rationale`/`trigger` | — | — | ✓ | ✓ | n/a |
| `trades[].outcomePoints` | — | — | ✗ | ✓ | n/a |
| **`trades[i].snapshot.*` (Phase 4)** | — | — | — | **✗** | **✗** |
| `proposalHistory[i].resolution` (vetoed/lapsed) | — | — | — | ✓ | n/a |
| `proposalHistory[i].counterfactualPoints` | — | — | — | ✓ | n/a |
| **`proposalHistory[i].snapshot.*` (Phase 4)** | — | — | — | **✗** | **✗** |
| `liveDirectives[].outcome` / `.resultPoints` | — | — | — | ✓ | n/a |

### Specific yes/no/partial verdicts on each phase

| Phase | Verdict | Notes |
|---|---|---|
| **Phase 1** raw (SMA values, BB upper/lower/%B, MACD histogram, BB bandwidth percentile, volume primitives) | **Partial via prose** | Embedded inside `trendSummary` / `momentumSummary` strings. No structured line render. Raw values invisible. |
| **Phase 2A** (pivots, MTF trend, S/R levels, RS percentile, sectorRSPercentile, sectorTechnicalRank, NR7) | **Partial via prose** | `trendSummary` mentions SMA stack and RS direction. Levels, pivots, sectorRS, NR7 invisible. |
| **Phase 2B** (RSI value, MACD freshness flags, divergence direction, candle pattern, suspicious-candle filter) | **Partial via prose** | `momentumSummary` mentions RSI condition ("healthy / extended"), MACD direction (expanding / fading), volume ratio. Divergence direction, fresh-cross flags, candle pattern, suspicious-flag invisible. |
| **Phase 3** intraday (`vwap`, `currentPrice`, `vwapDeviation`, `sma20_5m`) | **NO** | `b.intraday` is destructured into the brief object by the cron but never referenced by `buildPortfolioBriefsBlock`. Confirmed by grep: `buildPortfolioBriefsBlock` only reads `b.symbol, b.tier, b.changePercent, b.trendSummary, b.momentumSummary, b.thresholdNote, b.thresholdProximity, b.existingBadges`. |
| **Phase 4** snapshots (`proposalHistory[i].snapshot`, `trades[i].snapshot`) | **NO** | `grep "snapshot" voiceLayerPrompt.js` → 0 matches outside `marketSnapshot` (a different concept). `buildReviewContext` renders trade swap + rationale + outcome but never opens the snapshot payload. |

### Specific finding — Workshop mode does **not** render `portfolioBriefs`/`benchBriefs`/`scoutAlerts`/`marketContext`

Per `buildVoiceLayerPrompt:1486-1500`, workshop mode assembles `identity + outputFormat + partnerModel + convictions + workshopAnchor + workshopBlock + workshopReference + fewShot + phaseRules`. There is no `if (portfolioBriefs) blocks.push(...)` call in the workshop branch. By design — Workshop has no live battle.

This is a key asymmetry for Q7.

---

## Q3 — Existing Prompt Rules and Phase 5 Tensions

### 3.1 — Current rule text (exact)

**`DATA_CONFIDENCE_RULE`** (`voiceLayerPrompt.js:1044-1045`):
> DATA CONFIDENCE:
> Portfolio data refreshes every 15 minutes. Frame prices as trends, not exact current values. Say "CF is up solidly today" not "CF is at $78.42." If data feels stale, acknowledge it: "as of last check." Never invent numbers — if a field is missing, skip it entirely.

**`OUTPUT_FORMAT` (battle mode)** — the relevant rule from `voiceLayerPrompt.js:19-47`:
> RULES:
> - `_scratchpad` MUST come first. Think before you speak.
> - …
> - **NEVER quote raw data numbers in your response. Synthesize into narrative: say "NVDA is pushing toward its scoring threshold" not "NVDA is at 0.98 ATR." Say "momentum has been strong this week" not "Technical Score is 87."**
> - KEEP IT TIGHT. Your response should be 2-4 sentences maximum. …

**`WORKSHOP_OUTPUT_FORMAT`** (`voiceLayerPrompt.js:175-208`) — workshop has its own no-raw-stats rule:
> - …
> - Do NOT invent historical statistics, win rates, or pattern frequencies. (in `WORKSHOP_PHASE_RULES:218`)
> - PLAIN LANGUAGE MANDATE: NEVER use unexplained jargon. If you reference a technical concept (RSI, SMA, breakout, ATR, moving average crossover), immediately follow with a one-sentence plain-English translation in the same breath. (`WORKSHOP_PHASE_RULES:223`)

**Per-phase data-confidence sub-rules** (`DISCOVERY_RULES`, `REFINEMENT_RULES`, etc., each ~50-line block):
> DATA CONFIDENCE: Use confident language only for real-time WebSocket data. For delayed data, say "as of last check" or "earlier today." For daily data, frame as trend: "has been showing strength this week." If data is missing, skip it entirely. Never guess.

### 3.2 — Tensions with rendering Phase 1-4 fields

| Field type | Rule pressure | Tension |
|---|---|---|
| **Raw numeric values** (RSI 67, VWAP $425.18, ATR 4.2%, technical score 87, %B 0.78) | `OUTPUT_FORMAT.RULES`: "NEVER quote raw data numbers in your response. Synthesize into narrative." `DATA_CONFIDENCE_RULE`: "Frame prices as trends, not exact current values." | Phase 5 wants Gemma to *see* RSI 67 in the prompt and reason about it, but the rule forbids quoting it back. **The rule applies to Gemma's response, not to what we put in the prompt** — so the tension is *interpretive*: Gemma may over-correct and not use the numeric in its reasoning at all, or may leak it into responses. Possible carve-out: keep the no-quote rule for prices, allow synthesizing numeric-derived qualitative reads ("RSI is in overbought territory"). |
| **Boolean/flag fields** (`macdFreshBullishCross`, `nr7Flag`, `aboveSMA200`, `divergence: 'bullish'`) | None directly. | These are categorical, not numeric. Render as plain English ("Fresh MACD bullish cross — first signal in 5 days"). Low tension. |
| **Ranked/percentile fields** (sector rank #4/28, RS percentile 87, ATR percentile 90) | `OUTPUT_FORMAT.RULES`: prefers narrative over "Technical Score is 87." | Possible workaround: render percentile bands ("RS in top decile vs SPY") rather than raw integers. Or accept that the prompt can show the integer if Gemma synthesizes ("NVDA's relative strength is in the top decile"). |
| **VWAP value (price-like)** | `DATA_CONFIDENCE_RULE`: "Say 'CF is up solidly today' not 'CF is at $78.42.'" | Rendering VWAP as a $ value is the same pattern the rule forbids. Better: render `vwapDeviation` ("price 0.7% above session VWAP, holding above") and let `vwap`/`currentPrice` stay implicit. |
| **Confidence-bearing fields** (technical rank #4/28, divergence: 'bullish', macdFreshBullishCross: true) | No existing rule explicitly addresses these. | If we render them, Gemma may treat them as authoritative — that's the *point*, but it also means we need to label freshness ("as of 15-min cache"). Existing `DATA_CONFIDENCE_RULE` already handles the freshness framing. |
| **Suspicious-candle filter** (Phase 2B) | If we render `lastCandlePattern: 'engulfing'` without surfacing whether the candle was filtered as suspicious, Gemma may over-trust it. | Need to either render `lastCandlePattern` as null when suspicious, or expose the suspicious flag. |

### 3.3 — Rules that may need refinement or carve-outs

| Rule | Refinement candidate | Why |
|---|---|---|
| `OUTPUT_FORMAT` "NEVER quote raw data numbers" | Add a carve-out: "Concrete percentile or rank can be paraphrased as 'top decile' / 'best in sector' but raw indicator values (RSI, ATR%, BB%B) should never appear verbatim in the response." | Today the rule is absolute; users may want Gemma to say "RS is top decile" naturally, which is technically a narrative form of the integer. |
| `DATA_CONFIDENCE_RULE` | Add an `intraday` clause: "Intraday fields (5-min VWAP, intraday momentum) refresh every 15 minutes during market hours. Frame as 'today's session' context, not point-in-time fact." | Once VWAP is rendered, Gemma needs to know what time horizon it spans. |
| `WORKSHOP_PHASE_RULES.PLAIN LANGUAGE MANDATE` | If Phase 5 renders technical fields in workshop too, this rule becomes load-bearing: every term Gemma cites must be inline-translated. | The rule already exists; just confirming Phase 5 doesn't accidentally undermine it. |
| New rule: **Suspicious-candle disclosure** | "When the candle pattern is from a filtered/suspicious bar (price gap or low-volume print), do not lean on it as a signal." | Only needed if we render `lastCandlePattern` without pre-filtering server-side. |
| New rule: **VWAP semantics** | (See Q4.) | If we name the field "VWAP" without qualification, Gemma will assume session VWAP — which is correct here, but worth pinning down. |

---

## Q4 — The VWAP Semantics Question

### 4.1 — What VWAP is actually computed

`calculateVWAP` (`api/_utils/technicalCalculations.js:378-410`): pure function — cumulative `(typicalPrice × volume) / volume` over the candles passed in. No session-boundary logic of its own.

`fetchIntradayCandles` (`api/_utils/marketDataCache.js:632-690`): when called WITHOUT `hoursBack`, the EODHD URL omits `from=` and `to=`. Per the test at `marketDataCache.test.js:88-90` and the function comment, this returns EODHD's **default intraday window — the current trading session**.

`agent-evaluate.js:356` calls `fetchIntradayBatch(portfolioSymbols, { interval: '5m' })` — no `hoursBack`. So the candles are session-only, and `calculateVWAP` reduces them to a session VWAP.

**Verdict: this is session VWAP** — today's volume-weighted average price from market open to the latest 5-minute bar. That is the universal trader meaning of "VWAP."

The user's pre-check ("is this 4-month long-window VWAP?") is *unfounded* — there is no evidence in the code of a long-window calculation. The risk the user was worried about doesn't exist in the current pipeline.

### 4.2 — Propagation

1. `agent-evaluate.js:355-377` — VWAP computed per portfolio symbol → `momentumData.vwap[symbol]` → persisted to `cronState.intradayMomentum`.
2. `voice-layer-cache.js:236-246` — `buildPortfolioBriefs(..., intradayMomentumMap)` writes `brief.intraday = intradayMomentumMap[symbol] || null`.
3. `buildTechnicalSnapshot.js:99-104` — reads from `momentumData.vwap[symbol]` and embeds in the Phase 4 snapshot at `snapshot.intraday`.

So both `voiceLayerCache.portfolioBriefs[i].intraday.vwap` and `proposalHistory[i].snapshot.{symbolOut,symbolIn}.intraday.vwap` carry the *same* session VWAP value. There is no semantic mismatch *between data sources*. The only question is *how it's labeled in the prompt*.

### 4.3 — Current rendering of the value

**Nowhere.** `grep "intraday" voiceLayerPrompt.js` returns zero matches. The Phase 3 field exists in the brief object but is not consumed by any renderer. So today Gemma sees nothing — no value, no label.

This means **there is no current mislabeling risk** — there's a future labeling decision to make when Phase 5 starts rendering it.

Haiku's technical-analysis prompts (`technicalAnalysisPrompts.js`): a search shows zero references to `vwap`. Haiku's prompt is built independently and likewise doesn't currently see VWAP. So no model is being miscalibrated by the current pipeline — they're both blind to the field.

### 4.4 — Recommendation: render as session VWAP with explicit context

Of the four options the user listed:

- **Option A (rename to `longWindowVwap` / `vwap_anchor`):** Not needed — the value IS session VWAP, so renaming would mislead in the opposite direction.
- **Option B (change calculation to session-only):** Already session-only. No change needed.
- **Option C (render with explicit context):** This is the right answer. Render as `Session VWAP` (or `today's VWAP`) and prefer rendering `vwapDeviation` (deviation %) over the raw price to honor `DATA_CONFIDENCE_RULE`'s "no exact prices" guidance.
- **Option D (combination):** Take C plus a one-line context block in the brief block header explaining "5-min intraday context refreshes with every cron tick; VWAP is today's session anchor."

**Concrete rendering template (recommendation):**

```
Intraday (today's session, last cache tick): price 0.7% above session VWAP, holding above 5-min SMA20.
```

Versus the "wrong" framing the user was anticipating:

```
VWAP: $425.18    ← raw price, ambiguous horizon, conflicts with DATA_CONFIDENCE_RULE
```

**Open question for design walk:** Do we render the VWAP value at all, or only `vwapDeviation`? Rendering the deviation is enough for "above/below" reasoning; rendering the raw VWAP value is mostly anchoring noise unless Gemma is going to compare two prices, which the no-raw-numbers rule discourages.

---

## Q5 — Signal Value Analysis

Categories: **HIGH** = directly affects how Gemma reasons about a position. **MEDIUM** = useful context but rarely decision-critical. **LOW** = noise for Voice Layer reasoning. **SITUATIONAL** = high-value only when a specific condition holds.

### Phase 1 — Primitives + raw indicator values

| Field | Signal value | Reasoning |
|---|---|---|
| `price`, `changePercent` | MEDIUM | Already conceptually rendered (changePercent is in briefs). Raw price is a `DATA_CONFIDENCE_RULE` violation if quoted back, but useful as context. |
| `bbPercentB` | HIGH (situational) | "Above 1.0" or "below 0.0" is a clear extreme signal. In the middle range, low value. Render as banded extremity. |
| `bbUpper` / `bbLower` raw | LOW | Anchoring values; no decision value vs `bbPercentB`. |
| `bBandwidthPercentile` | MEDIUM | Squeeze regime context. Already implied in `trendSummary` sometimes. |
| `atrPercent` | MEDIUM | Volatility regime. Already in `thresholdNote` as a qualitative phrase. |
| `macdHistogram` raw | LOW | Magnitude rarely interpretable. Direction (above-signal, fresh cross) is what matters. |
| `avgVolume`, `volumeRatio`, `volumeTier`, `dailyRange` | MEDIUM | Volume confirmation context. `momentumSummary` mentions "Volume 1.1x avg" — partial. |

### Phase 2A — Trend, levels, RS

| Field | Signal value | Reasoning |
|---|---|---|
| `technicalScore` (0-100) | MEDIUM | Composite — useful as a header rating. Easy to render. |
| `technicalRank` (#N) | MEDIUM | "Top of sector" or "near bottom" is useful framing. |
| `rsPercentile` vs SPY | HIGH | Relative strength is central to the BaggerBomb thesis. Currently invisible. |
| `sectorRSPercentile` | MEDIUM | Useful for sector rotation framing. |
| `aboveSMA20/50/200`, `sma200_position` | HIGH | Trend stack is foundational. `trendSummary` carries this in prose. |
| `distTo52wkHigh` | HIGH | Breakout proximity / momentum exhaustion. Currently invisible. |
| `nearestSupport` / `Resistance` + `distanceToSupportPct` / `Resistance` | HIGH | Risk framing. "3% away from support" is decision-critical. Currently invisible. |
| `pivots` | SITUATIONAL | Day-trader context. Mostly redundant with explicit S/R. |
| `nr7Flag` | SITUATIONAL | Breakout-pending signal. High value when true, ignorable when false. |
| `sectorTechnicalRank` / `sectorTechnicalTotal` | LOW | Sector-of-sector rank; usually noise. |

### Phase 2B — Momentum / candles / divergence

| Field | Signal value | Reasoning |
|---|---|---|
| `rsi` | HIGH | Standard momentum indicator. `momentumSummary` paraphrases ("healthy, not extended") — losing precision on overbought/oversold extremes. |
| `macdAboveSignal` | MEDIUM | Direction flag. Implied in `momentumSummary` ("MACD expanding"). |
| `macdFreshBullishCross` / `macdFreshBearishCross` | HIGH (situational) | Fresh cross is an action signal. When true, decision-critical. Currently invisible. |
| `divergence` (bullish/bearish/none) | HIGH (situational) | Turning-point indicator. Currently invisible. |
| `upDayVolRatio` | MEDIUM | Volume conviction. |
| `lastCandlePattern` | SITUATIONAL | Engulfing / hammer / etc. — useful at key levels. Be careful with suspicious-candle filter. |

### Phase 3 — Intraday

| Field | Signal value | Reasoning |
|---|---|---|
| `intraday.vwap` raw | LOW | Anchoring price. `vwapDeviation` already carries the signal. |
| `intraday.currentPrice` | LOW | Already implied by `price` in the brief. |
| `intraday.vwapDeviation` | HIGH | "Above/below VWAP" is a primary intraday momentum frame for active traders. Currently invisible. |
| `intraday.sma20_5m` | MEDIUM | Short-term intraday trend reference. Useful as a "intraday price holding above/below 5m SMA20" framing. |

### Phase 4 — Snapshots (per leg, on counterfactuals and trades)

The snapshot is a frozen copy of all of the above at decision time. Signal value depends on **what the snapshot is used for**:

| Context | Signal value | Reasoning |
|---|---|---|
| Counterfactual on a *vetoed* proposal in Review Mode | HIGH | "We vetoed AAPL→MSFT, MSFT was at 87 RS percentile with bullish MACD fresh cross — and it scored +12 pts. Worth flagging." This is the central learning loop. |
| Trade *execution* snapshot in Review Mode | MEDIUM | Useful for trade-grading discussions, but the trade *outcome* is already rendered. Snapshot adds the "why was this a good/bad read at the time" angle. |
| Trade snapshot referenced during a live battle | LOW | The live `marketSnapshot` already covers the relevant position. |

### Ranked priority for Phase 5 rendering (HIGH-value first)

1. **Phase 3 `vwapDeviation`** (currently invisible, high signal, cheap to render) → immediate.
2. **Phase 4 snapshots on vetoed proposals in Review Mode** (counterfactuals are currently context-free).
3. **Phase 2B fresh-cross flags + divergence direction** when true (situational; only render when active).
4. **Phase 2A `rsPercentile`, `distTo52wkHigh`, `distanceToSupportPct`, `distanceToResistancePct`** as a per-symbol "situation line" — these are the highest-value invisible fields.
5. **Phase 1 banded extremes** (`bbPercentB` at extremes, `atrPercent` percentile) only when extreme.
6. **`technicalScore`/`Rank`/`atrPercent`** as a brief header line (low marginal cost; medium signal).
7. **Workstream B parity:** identical render for bench briefs when the underlying data is present (the cron already conditionally emits prose for bench).

### Likely redundant or derivable

- `intraday.vwap` raw — replaced by `vwapDeviation`.
- `intraday.currentPrice` — equals `price` modulo cron timing; skip.
- `bbUpper`/`bbLower` raw — `bbPercentB` is the read.
- `macdHistogram` raw value — direction + freshness flags are the read.
- `sectorTechnicalRank`/`Total` (the sector's own rank) — too meta for Voice Layer.
- `composite.sectorTechnicalRank` on the snapshot — same reasoning.

---

## Q6 — Token Budget Analysis

Method: empirical char-counts from the actual constants and a representative rendered brief, divided by 4 (rough OpenAI/Anthropic English ratio). All figures approximate.

### 6.1 — Current prompt sizes (battle mode, discovery phase)

| Block | Approx tokens |
|---|---:|
| `OUTPUT_FORMAT` | 715 |
| `DISCOVERY_RULES` (phase rules) | 1,350 |
| `WORKSHOP_PHASE_RULES` (workshop alternative) | 1,139 |
| `REVIEW_PHASE_RULES` | 873 |
| `GAME_MECHANICS` | 130 |
| `DATA_CONFIDENCE_RULE` | 71 |
| identity block | ~220 |
| partnerModel (typical) | ~200 |
| convictions (typical) | ~300 |
| anchor / DRB | ~600 |
| marketContext | ~200 |
| battleState | ~150 |
| fewShot | ~350 |
| elicitation | ~50 |
| **Static baseline (battle, discovery, no briefs)** | **~4,300** |

Per-brief rendered today (`buildPortfolioBriefsBlock` with all flags fired — red zone, swap lock, badges): **~88 tokens** for a fat brief.

**Mid-battle prompt total (typical state):**

| Component | Tokens |
|---|---:|
| Static baseline | ~4,300 |
| 6 portfolio briefs × ~80 | ~480 |
| 8 bench briefs × ~50 | ~400 |
| 5 scout alerts × ~30 | ~150 |
| **Total** | **~5,330** |

That's well under 10K. 128K context budget is essentially unconstrained — soft constraint about signal density, not hard cap.

**Review-mode prompt (similar baseline + counterfactuals):** Baseline + ~150 trades + ~100 counterfactuals + ~150 directive outcomes → roughly **~4,800-5,500 tokens** today.

### 6.2 — Cost of rendering each Phase 5 addition

For a fat-brief redesign that adds explicit Phase 3 + Phase 2A/2B structured lines per symbol, an empirical measurement (above) gives **+85 tokens per portfolio brief**. Scaled to a typical state:

| Addition | Per symbol | Portfolio (6 sym) | Bench (8 sym) | Watchlist alerts (5) | Total marginal |
|---|---:|---:|---:|---:|---:|
| Phase 1 banded extremes (BB%B extreme, ATR%ile band) | +10 | +60 | +80 (if Workstream B parity) | n/a | +140 |
| Phase 2A header line (techScore #N/total, RS %ile, ATR%) | +20 | +120 | +160 | n/a | +280 |
| Phase 2A levels line (dist to S/R, dist to 52wk high) | +25 | +150 | +200 | n/a | +350 |
| Phase 2B momentum specifics (RSI value, MACD fresh-cross flag, divergence) | +25 | +150 | +200 | n/a | +350 |
| Phase 3 intraday line (vwapDeviation + 5m trend) | +15 | +90 | n/a (no intraday for bench today) | n/a | +90 |
| **All of the above** | **+95** | **+570** | **+640** | n/a | **~1,210** |
| Phase 4 snapshot pair per counterfactual (compressed) | n/a | n/a | n/a | n/a | +150-200 per counterfactual |
| Phase 4 snapshot pair per executed trade (compressed) | n/a | n/a | n/a | n/a | +150-200 per trade |

### Phase 4 snapshot cost (most expensive addition)

The raw snapshot pair (`symbolOut + symbolIn`, each ~50 leaves) is **~400-600 tokens if rendered as a JSON dump**. Realistic compressed render — picking the ~6-8 HIGH/SITUATIONAL fields per leg — comes in at **~150-200 tokens per pair**.

- 6 vetoed proposals × 175 tokens = **~1,050** added to Review mode.
- 8 executed trades × 175 tokens = **~1,400** added to Review mode.
- Combined Review prompt: **~5,500 → ~7,500 tokens**. Still well under budget.

### 6.3 — Cheapest-per-signal-value vs most expensive

| Addition | Cost | Signal | Cost/signal |
|---|---:|---|---|
| **Phase 3 vwapDeviation** | +90 | HIGH (currently invisible) | **Cheapest** |
| Phase 2A levels line (S/R distance) | +350 | HIGH | Cheap |
| Phase 2B freshness flags | +350 (conditional → less) | HIGH situational | Cheap when rendered only on active signals |
| Phase 2A header (score/rank/RS) | +280 | MEDIUM | Medium |
| Phase 4 snapshot per counterfactual | +175 each | HIGH | Cheap |
| Phase 4 snapshot per executed trade | +175 each | MEDIUM | Medium |
| Phase 1 banded extremes | +140 | MEDIUM (only useful at extremes) | Lower priority |

### 6.4 — Note on the budget constraint

The user's framing is correct: token budget is **soft**. Gemma is cheap; 128K is generous; the constraint is **signal density and prompt legibility**, not cost.

Practical implication: don't render fields just because they fit. Render fields because they meaningfully change Gemma's response. The marginal cost of an unused field is *cognitive load on Gemma*, not dollars. Prefer **conditional rendering** (e.g., only emit "MACD fresh bullish cross — first in 5 days" when `macdFreshBullishCross === true`) over always-on lines.

---

## Q7 — Workshop / Battle / Review Asymmetry

### 7.1 — What each mode renders today

| Mode | Renders portfolio briefs? | Renders bench briefs? | Renders scout alerts? | Renders marketContext? | Renders DRB anchor? | Renders battle state? |
|---|---|---|---|---|---|---|
| **Battle** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Review** | ✓ (uses same renderers) | ✓ | ✓ | ✓ | ✓ (closing context) | replaced by `buildReviewContext` |
| **Workshop** | ✗ | ✗ | ✗ | ✗ | ✓ (`buildWorkshopAnchorBlock`) | ✗ (replaced by `buildWorkshopContextBlock`) |
| **Signal Expansion** | ✗ | ✗ | ✗ | ✗ | ✓ (anchorContext) | n/a |
| **Watchlist Dialogue** | ✗ | ✗ | ✗ | ✗ | ✓ | n/a |

Workshop is the major outlier: by design, it operates without a live battle and therefore without a portfolio, bench, or threshold mechanics. Today it sees the DRB anchor and the activeThesis state — nothing else from `voiceLayerCache`.

### 7.2 — Should Phase 5 changes apply to both modes?

| Question | Answer |
|---|---|
| Does Workshop need Phase 3 intraday context? | **No.** Workshop is strategy design, not live action. VWAP intraday context is irrelevant when there's no active position. |
| Does Workshop need Phase 4 snapshots? | **No.** Snapshots are tied to actual trade decisions. |
| Does Workshop need Phase 2A/2B technical fields? | **Maybe — only if** the user references a specific ticker. The `WORKSHOP_REFERENCE` already provides rule-palette context (RSI, SMA, breakout, ATR) for thesis construction, not real-time technicals. |
| Does Review need everything? | **Yes** — Review is where Phase 4 snapshots become decisive. Counterfactuals without snapshot context lose the central learning value. |
| Does Battle need everything? | **Yes** — the live decision surface. |

**Recommendation:** Phase 5 applies to **battle + review only**. Workshop stays as-is.

### 7.3 — Pattern to keep workshop unaffected

The current architecture already enforces this cleanly:

- `buildVoiceLayerPrompt` branches on `mode` *before* assembling blocks (`voiceLayerPrompt.js:1384-1626`).
- The workshop branch (`1444-1502`) does **not** call `buildPortfolioBriefsBlock`, `buildBenchBriefsBlock`, or `buildMarketSnapshotContext`. It assembles workshop-specific blocks instead.

So Phase 5 changes that extend `buildPortfolioBriefsBlock` (e.g., adding intraday or Phase 2A header lines) automatically miss workshop. **No isolation work needed.**

The one risk vector: if Phase 5 adds new `build*` helpers that get called *outside* the mode branches in `buildVoiceLayerPrompt`, they'd leak into workshop. The pattern to follow: keep all Phase 5 renderers *inside* `buildPortfolioBriefsBlock`/`buildBenchBriefsBlock`/`buildReviewContext` (existing renderers, only consumed by battle+review branches), or add new renderers and explicitly gate them inside `if (mode === 'battle' || mode === 'review')`.

---

## Synthesis

**Phase 5 should render** the following, **in the existing battle + review surfaces** (no new surfaces, no Workshop changes):

### 5A — Surface the captured prose & header context (lowest risk, highest leverage)

In `buildPortfolioBriefsBlock` and `buildBenchBriefsBlock`:

1. Add a one-line **header summary**: `technicalScore (rank #N/total, sector)`, `rsPercentile (vs SPY)`, `atrPercent`. Existing fields, currently invisible, MEDIUM signal value.
2. Add a one-line **levels summary** (when present): "Support $X (-N.N%), Resistance $Y (+N.N%), 52wk high -N.N% away." Existing fields from Phase 2A, HIGH signal value.
3. Add **Phase 3 intraday line** (Phase 5B if isolated, but can ship in 5A): "Session VWAP: price N.N% above (5m SMA20 trending up/down/flat)." Use **deviation only** to honor `DATA_CONFIDENCE_RULE`. Renders only when `intraday` is non-null.
4. Add **Phase 2B situational signals** as conditional lines: only emit when `divergence === 'bullish'/'bearish'`, when `macdFreshBullishCross/macdFreshBearishCross === true`, when `nr7Flag === true`. These rarely fire — when they do, they're decision-critical.

Estimated marginal cost: **~1,200 tokens at typical state** (still well under any budget concern).

### 5B — VWAP labeling (design decision lock)

Rendering recipe:

- Field is **session VWAP** (confirmed). Label it as such in the prompt header.
- Add one sentence to `DATA_CONFIDENCE_RULE`: "Intraday fields (session VWAP, 5-min SMA) refresh with the 15-min cache; frame as today's session context."
- Render **`vwapDeviation`** as the primary signal; render `sma20_5m` as a directional read (above/below current price); **do not** render raw `vwap` price unless we explicitly want anchoring (we probably don't, per `DATA_CONFIDENCE_RULE`).

### 5C — Phase 4 snapshot rendering in Review Mode

In `buildReviewContext`:

1. For each **counterfactual** (vetoed proposal), pull `snapshot.symbolIn` and render a compressed 4-6 line technical context: "What MSFT looked like when we vetoed: RS 87%ile, MACD fresh bullish cross, above all SMAs, 2.3% below 52wk high. Counterfactual: +12 pts." This is the highest-value addition.
2. For each **executed trade**, optionally render `snapshot.symbolIn` similarly: "What MSFT looked like when we bought: …" Useful for trade-grading review.
3. Keep snapshots compressed (HIGH-signal fields only, ~150-200 tokens per pair); skip LOW-signal raw values.

Estimated marginal cost: **+1,000 to +2,500 tokens** in Review mode depending on counterfactual / trade count.

### Sub-phase split (recommended)

| Phase | Scope | Risk | Payoff |
|---|---|---|---|
| **5A** | Extend `buildPortfolioBriefsBlock`/`buildBenchBriefsBlock` with header + levels + Phase 2B situational lines. Uses existing fields, no new data plumbing. | Low — renderer change only. | Most of the per-symbol signal density gain. |
| **5B** | Add Phase 3 intraday line to `buildPortfolioBriefsBlock`. Add the intraday clause to `DATA_CONFIDENCE_RULE`. Lock VWAP labeling. | Low — one new line per brief. | Closes the "Phase 3 captured but invisible" gap. |
| **5C** | Extend `buildReviewContext` to read and render `proposalHistory[i].snapshot` and `trades[i].snapshot`. | Medium — new field-reading paths, more layout changes, potential for snapshot-bloat. | Closes the Phase 4 capture loop; meaningfully changes Review-mode quality. |

Suggested ordering: **5A → 5B → 5C**. Each is independent enough to ship alone if a later phase blocks.

### Estimated all-in token cost

| Mode | Today | After Phase 5A+5B+5C |
|---|---:|---:|
| Battle (mid-battle, 6+8+5 mix) | ~5,300 | ~6,500 |
| Review (with 8 trades + 6 vetoes) | ~5,200 | ~7,500-8,000 |
| Workshop | ~3,500 (unchanged) | ~3,500 |

All comfortably within Gemma's 128K budget. The real cost is **prompt legibility for Gemma**, not dollars or context window. That's why conditional rendering of situational fields is the right pattern.

---

## Open Design Questions for Walk-Through

These need decisions before Phase 5 implementation prompts can be written:

1. **VWAP rendering granularity.** Render `vwapDeviation` only (cleaner, honors `DATA_CONFIDENCE_RULE`), or also render `vwap` + `currentPrice` raw values (more anchoring for Gemma to reason over)? Recommendation: deviation only. Confirmation needed.

2. **Per-brief format: line-by-line or compact?** A six-line "fat" brief is more legible to humans but heavier for Gemma's attention. A compact two-line "header / levels-and-intraday" format is denser. Recommend a structured but compact format with optional conditional lines.

3. **Conditional vs always-on for situational flags.** `macdFreshBullishCross`, `divergence`, `nr7Flag`: render only when active (cleaner) or always with explicit `false`/`none` (more uniform)? Recommendation: only when active — `OUTPUT_FORMAT` already says "If a field is missing, skip it entirely."

4. **`technicalScore`/`Rank` vs prose paraphrase.** Render integer ranks/percentiles directly ("RS 87th percentile, sector rank #4/28") or paraphrase to bands ("RS in top decile, top quintile in sector")? Recommendation: render the numerics; let `OUTPUT_FORMAT` rule shape the response.

5. **Bench parity scope.** Workstream B is bringing bench briefs to parity for Haiku. Should the Voice Layer renders for `benchBriefs` get the same Phase 5A header + levels treatment? Recommendation: yes, but only when the underlying fields are populated (bench briefs already handle null gracefully).

6. **Phase 4 snapshot density in Review.** A pair of snapshots can balloon to 400-600 tokens raw. The recommended compressed render is 150-200 tokens. Is the team OK with cutting LOW-signal fields entirely (BB raw values, pivots, lastCandlePattern when suspicious)? Recommendation: yes, with a fixed render template; raw snapshot remains in Firestore for forensic use.

7. **Phase 4 snapshot rendering on *executed* trades.** Counterfactuals are clearly high-value (no current context). Executed-trade snapshots are nice-to-have but the *outcome* is already rendered. Render both, or counterfactuals only in 5C? Recommendation: counterfactuals only in 5C; consider executed-trade snapshots as a follow-up.

8. **`DATA_CONFIDENCE_RULE` update.** Specific text additions needed: an intraday-freshness clause, and possibly a percentile-bands carve-out of the "no raw numbers" rule. Need to wordsmith.

9. **Suspicious-candle handling.** If we render `lastCandlePattern`, do we pre-filter suspicious candles at the cron level (so the field is `null` when suspicious), or surface a flag and let the prompt explain? Recommendation: pre-filter at cron level — keep the prompt clean.

10. **Workshop carve-out confirmation.** Confirm that no Phase 5 changes should touch workshop / signal_expansion / watchlist_dialogue modes. (My read: yes — they have their own information shape.)

---

*End of Phase 5 discovery report. Ready for design walk-through.*
