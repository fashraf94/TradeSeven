# Audit 01 — Situation Assessment Feasibility

**Scope:** Confirm whether each proposed `SituationAssessment` field (Layer 1 of the 3-layer agent decision pipeline) is computable from current code, or whether new infrastructure is required.

**Files reviewed:**
- `api/_utils/agentTriggerGate.js`
- `api/_utils/agentScoring.js`
- `api/_utils/agentEvalPromptAssembly.js`
- `api/_utils/agentRegimeClassifier.js`
- `api/_utils/agentBattleService.js`
- `api/cron/agent-evaluate.js` (the cron handler for agent battle eval)
- `src/utils/baggerBombUtils.js`
- `src/hooks/useBaggerBombBattleV4.js`
- `src/constants/baggerBombScoring.js`
- `src/constants/battleTimingV4.js` (traced via V4 hook import)
- `api/agent/chat.js` (directive write path)

---

## Game clock fields

### 1. `daysElapsed` / `daysRemaining`

- **Computable today?** ✅ Yes.
- **Source:** `battle.timing.tradingDays` (array of `YYYY-MM-DD` ET strings, written at battle creation via `getTradingDayDates` in `src/constants/battleTimingV4.js:101`). The cron reads current progression through two helpers in `api/_utils/agentEvalPromptAssembly.js`:
  - `getCurrentTradingDayServer(timing.tradingDays)` — `agentEvalPromptAssembly.js:704` returns 1-indexed current day using `getETDate()` + `formatDateString()` from `api/_utils/marketSchedule.js`.
  - `computeTimeRemaining(battle)` — `agentEvalPromptAssembly.js:665` returns a human string like `"2d 3h 15m"`.
- **Cron usage:** `agent-evaluate.js:201` (`currentDay = getCurrentTradingDayServer(battle.timing?.tradingDays)`).
- **Gap:** `daysElapsed` = `currentDay - 1`, `daysRemaining` = `tradingDays.length - currentDay`. Trivial wrapper. No new infra.

### 2. `sessionPhase` — is there a `getCurrentSessionPhase()` utility?

- **Computable today?** ⚠️ Two overlapping concepts — neither matches a `sessionPhase` label cleanly.
- **Battle phase (used by agent cron):** `computeBattlePhase(battle)` at `agentEvalPromptAssembly.js:627` (duplicated in `agentTriggerGate.js:236` as `computePhaseFromBattle`). Returns `'EARLY' | 'MID' | 'LATE' | 'FINAL_HOUR'` based on fraction-of-battle progress across `tradingDays`, not intraday session.
- **Intraday session phase (human PvP only):** `src/utils/baggerBombUtils.js:322` defines `getCurrentSession()` returning `'morning' | 'midday' | 'power' | 'night'` via ET hour lookup in `SESSION_CONFIG` (`src/utils/baggerBombUtils.js:17`). Also `getCurrentSessionId()` → `'MORNING_BELL' | 'MIDDAY' | 'POWER_HOUR' | 'NIGHT_GAME'` (`baggerBombUtils.js:338`).
  - This is client-side only and tied to the legacy human-PvP session model. Uses a naive UTC-5 offset (`baggerBombUtils.js:307`) — not DST-safe — so it is **not** suitable for server-side use without porting to the DST-safe `getETDate()` helper.
- **Gap:** If "sessionPhase" means battle progress (`EARLY/MID/LATE/FINAL_HOUR`), done. If it means intraday session bucket (`MORNING_BELL/MIDDAY/POWER_HOUR/NIGHT_GAME`), a server-side port of `getCurrentSession()` using `getETDate()` is required — no such utility exists today in `api/_utils/`.

### 3. `swapWindowOpen` — for agentBattles (not human PvP)

- **Computable today?** ✅ Yes, but the concept does not apply to agent battles as a distinct window.
- **Finding:** Agent battles allow continuous swaps during market hours. The cron's only gate is `isMarketOpen()` at `agent-evaluate.js:91`, after which `processAgentBattle()` can execute swaps at any tick. There is no `swapWindow` field on agentBattles, and no window-open/close logic in the agent path.
- **Human-PvP swap-window logic exists elsewhere** (`src/services/claimFreeAgencyService.js:55` uses `windowOpenMinutes = 16 * 60` for the 4pm–open free-agency window), but the agent cron does not consult it.
- **Gap:** For agent battles, `swapWindowOpen = isMarketOpen()`. No new infra needed unless the new pipeline wants to impose an agent-specific window.

### 4. `swapsRemaining` — tracked per battle?

- **Computable today?** ❌ Not for agent battles.
- **Human PvP:** `battle.swaps.remaining.day{N}` tracked, surfaced via `getDailySwapsRemaining(swaps, currentDay)` at `src/constants/battleTimingV4.js:171`. Initialized in `initializeSwaps()` (`battleTimingV4.js:226`) with `SWAPS_PER_DAY: 3` for PvP, `TOTAL_SWAPS: 1` for training.
- **Agent battles:** `agentBattleService.js` does **not** write a `swaps` object on battle creation. The cron only tracks cumulative `scoreState.tradeCount` (incremented in `api/_utils/agentSwapExecution.js:248`). There is no per-day swap quota and no remaining-swaps counter on agentBattles.
- **Gap:** Agent battles have no swap-budget concept. If the new pipeline needs one, the schema, the initialization path (`createAgentBattle`), and a decrement call in `executeSwapServer` must all be added. This is a **new-infra** item.

---

## Portfolio state fields (per active/bench position)

### 5. `pnlPoints` — can the cron compute this in isolation per position?

- **Computable today?** ✅ Yes.
- **Source:** `calculateAssetScoreServer(asset, priceChange, history, extremes, thresholdPriceChange)` in `api/_utils/agentScoring.js:114` returns `{ basePoints, bonusPoints, totalPoints, badges, multiplier, ... }` for a single position. The cron calls it per-asset in a map at `agent-evaluate.js:248`.
- **Gap:** None — `totalPoints` is exactly `pnlPoints` for a live/active position. Note: "locked" (closed-trade) points live separately in `battle.trades[].lockedPoints` and are summed into `bankedScore` at `agent-evaluate.js:313`.

### 6. `atrDistance` (signed, from entry) — which utility?

- **Computable today?** ✅ Yes.
- **Source:** `calculateAssetScoreServer` returns `multiplier = effectiveThresholdChange / baseATR` (`agentScoring.js:152`). This is the signed ATR distance. Short positions are negated up-front (`agentScoring.js:119`). Threshold baseline is `asset.swapPrice` if swapped in mid-battle, else `previousClose` — selected by the cron at `agent-evaluate.js:265`.
- **Gap:** None. `multiplier` on each score object = signed ATR distance.

### 7. `nearestThreshold` — "next unfired threshold direction + ATR distance"

- **Computable today?** ✅ Yes (client util exists; also partially replicated server-side).
- **Client source:** `detectRedZone(currentMultiplier, existingBadges)` at `src/utils/baggerBombUtils.js:182` iterates `POSITIVE_THRESHOLDS` / `NEGATIVE_THRESHOLDS` and returns the next uncrossed threshold with direction + progress. `isSwapLocked()` (`baggerBombUtils.js:244`) does a similar search for the "orange zone" lock check.
- **Server source (partial):** `agentTriggerGate.js:52–88` loops the same threshold sets to emit `threshold_proximity` triggers, but it does not expose the nearest-threshold object — it just fires a trigger when inside 0.2x.
- **Gap:** No server-side `getNearestThreshold()` utility exists; `detectRedZone()` would need to be ported from `src/` to `api/_utils/` (server-side code can't import from `src/`, per the note at `agentScoring.js:2`). Straightforward port, not new infra.

### 8. `thresholdsFired[]` — server-queryable or client-only?

- **Computable today?** ✅ Yes, server-side.
- **Source:** `battle.thresholdHistory[symbol] = { maxMultiplier, minMultiplier }` is persisted by the cron on every tick (`agent-evaluate.js:341`: `scoreUpdate[\`thresholdHistory.${score.symbol}\`] = score.history`). `getBadgesFromHistoryServer(history)` at `agentScoring.js:79` derives the fired badges (`['bagger','doubleBagger','tenBagger','bust','crash','meltdown']`) from those extremes. The cron returns `badges` on each score (`agentScoring.js:184`).
- **Gap:** None. The fired set is fully server-derivable from `thresholdHistory`.

### 9. `tier` — on the position object?

- **Computable today?** ✅ Yes.
- **Source:** `flattenPortfolioServer(portfolio)` at `agentScoring.js:38` attaches `tier: 'star' | 'core' | 'support'` to each asset based on which array it lives in (`portfolio.star / core / support`). Also present on persisted trade records and on `executeSwapServer` outputs.
- **Gap:** None.

### 10. `sectorDrift` (stock move − sector ETF move)

- **Computable today?** ❌ Not directly. Significant gap.
- **Stock move:** available — `prices[symbol].changePercent` (`agent-evaluate.js:242`).
- **Sector mapping:** available — `TICKER_TO_SECTOR` lookup in `api/_utils/rankingConfig.js:88` maps ticker → sector ID (matches an 11-sector SPDR ETF set in `rankingConfig.js:16` / `SECTOR_ETFS` at `rankingConfig.js:96`). Additionally, each asset has `sector` stamped at battle creation via `deepCopyArrayWithSector` (`agentBattleService.js:285`).
- **Sector ETF prices:** **not fetched** by `agent-evaluate.js`. The cron fetches prices only for portfolio + bench + hotBench + CPU symbols + three macros (`SPY`, `QQQ`, `BTC-USD.CC`) — see `agent-evaluate.js:217`. Sector ETFs (XLK/XLV/XLF/XLE/etc.) are not in the fetch set. `sectorRankings/latest` (`api/stocks/sector-rankings.js:59`) is computed by a separate daily cron and exposes composite scores, not live %-change.
- **Gap:** To compute `sectorDrift` live, the cron must (a) resolve ticker → sector ETF via `rankingConfig.TICKER_TO_SECTOR` + `STOCK_UNIVERSE[sector].etf`, then (b) add the 11 SPDR ETFs to the price-fetch batch at `agent-evaluate.js:222` so `prices[etfSymbol].changePercent` is available, then (c) compute `stockChange - etfChange`. Shape of the gap: **one extra fetch batch of ~11 symbols per cron tick, plus a small resolver**. No schema changes.

---

## Signal inventory fields

### 11. `activeDirectives[]` with not-expired filter

- **Schema:** `battle.directive = { text, expiry, directiveThreadId, createdAt }` — a single active-directive slot on the battle doc. Written by `api/agent/chat.js:379` when a chat exchange locks in a directive (`expiry` defaults to `'end_of_battle'` — see `chat.js:76`).
- **Filter logic:** Agent-level `agent.directives[]` is **deprecated** (per `COMMAND_CENTER_FILM_ROOM_REDESIGN_QUICK_REFERENCE_V3.md:27`). `src/hooks/useAgent.js:107` still filters the legacy array by `expiresAt > now`, but `api/agent/chat.js` no longer writes there (see comment at `chat.js:388`). Battle-scoped directives use the string token `'end_of_battle'` or similar, not a timestamp — so a "not-expired" filter for the current design is effectively "is the battle still active?" Only one directive can be live at a time.
- **Cron usage:** `agentEvalPromptAssembly.js:568` reads `battle.directive.{directiveThreadId, text}` and injects a single ACTIVE DIRECTIVE block; it does **not** apply any expiry filter because the schema doesn't carry a concrete timestamp.
- **Gap:** The proposed `activeDirectives[]` implies a plural, timestamped list. Current state is a single slot with string-token expiry. If the pipeline needs an array with timestamp expiry, schema changes in `agent/chat.js` + migration are required. Otherwise, `activeDirectives = battle.directive ? [battle.directive] : []` is a one-liner.

### 12. `activeForgeRules[]` — deployed bundle location + category pre-filter

- **Location:** **Battle doc**, not agent doc. `agentBattleService.js:119` snapshots `battle.agentContext.activeRules = agentData.activeRules || []` at battle creation — frozen for the battle's duration. Similarly `deployedGuardrails` at `agentBattleService.js:123`.
- **Source of truth:** `agentData.activeRules` on `agents/{agentId}` — produced when users equip rule bundles (`agent.equippedBundleIds` → materialized rules).
- **Category pre-filter:** Applied in the prompt builder, not in storage. `agentEvalPromptAssembly.js:253–291` splits rules into CONSTRAINTS (`category ∈ {'risk','allocation'}`) vs. STRATEGY PREFERENCES (everything else), and injects an institutional-lag C_INST warning when `category === 'institutional'` is present (`agentEvalPromptAssembly.js:273`).
- **Gap:** None for read path — `battle.agentContext.activeRules` is directly consumable. Each rule carries `category`, `text`/`textTemplate`, `params`, `paramValues`.

### 13. `triggerThatFired` — does `evaluateTriggers` return which fired?

- **Computable today?** ✅ Yes.
- **Source:** `evaluateTriggers(battle, assetScores, prices, news, momentumData, seenStoryIds)` at `agentTriggerGate.js:20` returns `{ shouldEvaluate, triggers: Array<{ type, detail }>, newStoryIds }`. Each trigger carries `type` (e.g. `'forced_open' | 'forced_close' | 'price_drop' | 'threshold_proximity' | 'bench_outperformance' | 'vwap_deviation' | 'bandwidth_squeeze' | 'nr7_contraction' | 'news_catalyst'`) plus a human-readable `detail` string.
- **Multiple triggers:** Forced triggers short-circuit and return a single entry (`agentTriggerGate.js:29, 36`). Conditional triggers accumulate — if three conditions hit, `triggers` will contain three entries. There is no "primary" designation.
- **Gap:** If the pipeline needs a single `triggerThatFired`, pick `triggers[0]` (the trigger gate pushes forced triggers first, then price_drop, threshold_proximity, bench_outperformance, momentum, news in order). Trivial; no new infra.

---

## Summary

| Field | Status | Gap size |
|---|---|---|
| 1. daysElapsed / daysRemaining | ✅ Computable | None |
| 2. sessionPhase | ⚠️ Ambiguous | Port `getCurrentSession()` server-side if intraday-session meaning is intended |
| 3. swapWindowOpen (agent) | ✅ = `isMarketOpen()` | None |
| 4. swapsRemaining (agent) | ❌ Not tracked | **New infra** — schema + init + decrement |
| 5. pnlPoints | ✅ Computable | None |
| 6. atrDistance | ✅ `score.multiplier` | None |
| 7. nearestThreshold | ⚠️ Client util only | Port `detectRedZone()` to `api/_utils/` |
| 8. thresholdsFired[] | ✅ From `thresholdHistory` | None |
| 9. tier | ✅ On asset | None |
| 10. sectorDrift | ❌ ETF prices not fetched | **Medium** — add ~11 ETF symbols to fetch batch + resolver |
| 11. activeDirectives[] | ⚠️ Single slot, string-token expiry | Schema mismatch if pipeline needs plural + timestamp |
| 12. activeForgeRules[] | ✅ On `agentContext.activeRules` | None |
| 13. triggerThatFired | ✅ `triggers[].type` | Trivial — take `triggers[0]` |

**Fields that need new infrastructure:** `swapsRemaining` (full swap-budget concept for agent battles), `sectorDrift` (sector-ETF price fetch).

**Fields that need a small port but no new schema:** `nearestThreshold` (port `detectRedZone` server-side), `sessionPhase` (DST-safe server-side port if intraday meaning is needed).

**Fields fully computable as-is:** 1, 3, 5, 6, 8, 9, 12, 13.
