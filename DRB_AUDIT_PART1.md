# DRB Audit — Part 1: Voice Layer + voiceLayerCache

## Section A — Voice Layer Prompt Injection Point

### A.1 Prompt assembly location
- File: `api/_utils/voiceLayerPrompt.js` (768 lines).
- Exported builder: `buildVoiceLayerPrompt({ agent, battle, elicitationTarget, conversationHistory, anchorContext, marketSnapshot, mode, workshopContext, dailyReviews, dailyGrades })` at `api/_utils/voiceLayerPrompt.js:586`.
- Three mode branches inside one builder:
  - `mode === 'review'` branch: `voiceLayerPrompt.js:605`–`660`.
  - `mode === 'workshop'` branch: `voiceLayerPrompt.js:664`–`704`.
  - Default battle branch: `voiceLayerPrompt.js:707`–`767`.

### A.2 Block 3.5 (DKB Anchor) — how it's populated
- Not hardcoded. Consumed as the `anchorContext` argument passed into the builder.
- In battle mode, `anchorContext` is assembled by the HTTP handler before calling the builder:
  - `api/agent/chat.js:213`–`222` reads Firestore doc `indexIntelligence/marketContext`, then:
    ```js
    anchorContext = `Regime: ${ctx.regime}. ${ctx.regimeDetail || ''}`.trim();
    ```
  - Same call parallel-fetches `voiceLayerCache/{battleId}` at `api/agent/chat.js:218`.
- Fallback templates (used when `anchorContext` is null):
  - Battle: `'No market data available. Focus on game state and partner preferences.'` — `voiceLayerPrompt.js:721`.
  - Review: `'Market closed. Focus on today\'s trades and patterns.'` — `voiceLayerPrompt.js:623`.
- Format expected: plain single-line string. No markdown or structure enforced by the builder (it splices the string into the block list verbatim).
- Token budget: no explicit cap. The string is whatever `indexIntelligence/marketContext` yields from `regime` + `regimeDetail` — typically a short sentence.
- Workshop mode does NOT include the anchor block (`voiceLayerPrompt.js:693`–`701`).

### A.3 Block 3.5 position in the final prompt
- Battle-mode assembly order (`voiceLayerPrompt.js:745`–`765`):
  1. identity (Block 1)
  2. GAME_MECHANICS (Block 1.5)
  3. OUTPUT_FORMAT (Block 7)
  4. partnerModel (Block 2)
  5. convictions (Block 3)
  6. **anchor (Block 3.5)** ← position 6
  7. portfolioBriefs (Block 4A, conditional)
  8. scoutAlerts (Block 4B, conditional)
  9. marketContext (Block 4C, conditional)
  10. DATA_CONFIDENCE_RULE (conditional on any marketSnapshot)
  11. battleState (Block 5)
  12. fewShot + CONFIRMATION_EXAMPLE
  13. elicitation
  14. phaseRules (Block 6, last)
- Review-mode order (`voiceLayerPrompt.js:639`–`657`): identical through Block 3.5; then optional 4A/4B/4C, then reviewContext → fewShot → phaseRules.
- Surrounding blocks for 3.5 in both battle and review: preceded by convictions (Block 3), followed by portfolioBriefs if present, else by battleState/reviewContext.

### A.4 Where voiceLayerCache is read and which blocks it feeds
- Read site: `api/agent/chat.js:218` — `db.collection('voiceLayerCache').doc(battleId).get()`, assigned to `marketSnapshot` (`chat.js:225`), then passed to `buildVoiceLayerPrompt` as `marketSnapshot`.
- Builder functions that consume `marketSnapshot` fields:
  - `buildPortfolioBriefsBlock(marketSnapshot)` → reads `marketSnapshot.portfolioBriefs` and `marketSnapshot.dataFreshness.prices` (`voiceLayerPrompt.js:417`–`431`). Feeds Block 4A.
  - `buildScoutAlertsBlock(marketSnapshot)` → reads `marketSnapshot.scoutAlerts` (`voiceLayerPrompt.js:433`–`441`). Feeds Block 4B.
  - `buildMarketSnapshotContext(marketSnapshot)` → reads `marketSnapshot.marketContext.{regime, regimeDetail, spyChange, volatilityRegime, breadthTier, breadthDetail, topSector, topSectorChange, worstSector, worstSectorChange, yieldRegime}` (`voiceLayerPrompt.js:443`–`464`). Feeds Block 4C.
  - `DATA_CONFIDENCE_RULE` is appended whenever `marketSnapshot` is truthy (`voiceLayerPrompt.js:758`).
- Block 3.5 does NOT read from `voiceLayerCache`. It is fed from a separate Firestore read of `indexIntelligence/marketContext` (`chat.js:220`–`222`).

---

## Section B — voiceLayerCache Architecture

### B.1 Firestore path / doc ID pattern
- Path: `voiceLayerCache/{battleId}` — confirmed per-battle, not a single global doc.
- Write site: `api/cron/voice-layer-cache.js:377` — `db.collection('voiceLayerCache').doc(battle.id)`.
- Read site: `api/agent/chat.js:218`.
- Security rules: `firestore.rules:348`–`351` — authenticated read, all client writes denied (Admin SDK only).

### B.2 Schema
Written in a single `writeBatch.set()` at `api/cron/voice-layer-cache.js:378`–`392`:

| Field | Type | Example / source |
|---|---|---|
| `battleId` | string | Doc id, e.g., battle id. |
| `agentId` | string \| null | `battle.agentId` or null. |
| `portfolioBriefs` | array of objects | See below. |
| `scoutAlerts` | array of objects | See below. |
| `marketContext` | object | See below. |
| `dataFreshness` | object | `{ prices: 'rest_15min', technicals: 'daily', rankings: 'daily', marketContext: 'daily' }`. |
| `forgeSeeds` | null | Reserved, always written as null. |
| `updatedAt` | Firestore server timestamp | `FieldValue.serverTimestamp()`. |

`portfolioBriefs[]` element (`voice-layer-cache.js:156`–`170`):
- `symbol` (string), `tier` ('star'|'core'|'support'), `price` (number), `changePercent` (number, rounded 2dp), `technicalScore` (number), `technicalRank` (number), `rsPercentile` (number, rounded), `trendSummary` (string), `momentumSummary` (string), `supportLevel` (null), `resistanceLevel` (null), `thresholdNote` (string|null — set only when `atrPercentile > 0.7`), `atrPercent` (number rounded 2dp).

`scoutAlerts[]` element (`voice-layer-cache.js:201`–`231`):
- `symbol` (string), `type` ('rs_breakout'|'volume_surge'|'game_fit'), `headline` (string), `detail` (string), `relevance` ('momentum_chaser'|'all'). Capped at 5 post-archetype filter (`voice-layer-cache.js:240`).

`marketContext` object (`voice-layer-cache.js:247`–`279`):
- `regime`, `regimeDetail`, `spyChange`, `vixLevel` (always null — comment at `:269` notes no VIX data in codebase), `volatilityRegime`, `breadthTier`, `breadthDetail`, `topSector`, `topSectorChange`, `worstSector`, `worstSectorChange`, `yieldRegime`. Sourced from `indexIntelligence/marketContext` (`voice-layer-cache.js:342`, `:361`).

### B.3 Cron definition
- File: `api/cron/voice-layer-cache.js` (414 lines).
- Vercel cron schedule: `vercel.json:153`–`156` — `"*/15 13,14,15,16,17,18,19,20 * * 1-5"` targeting `/api/cron/voice-layer-cache`.
- `export const config = { maxDuration: 60 }` (`voice-layer-cache.js:13`).
- Handler steps (`voice-layer-cache.js:285`–`413`):
  1. Auth — accepts `x-vercel-cron: 1` header or `Authorization: Bearer ${CRON_SECRET}`. (`:287`–`291`)
  2. Time guard — `getMarketState()`; short-circuits to `{ skipped: true, reason: 'market_closed' }` unless state is `OPEN` or `PRE_MARKET`. (`:296`–`299`)
  3. Query active battles via `findActiveAgentBattles(db)` → `agentBattles` where `status == 'active'`. Short-circuit if zero. (`:305`–`309`, `agentBattleService.js:21`–`28`)
  4. Collect unique symbols across all active battles' portfolios + watchlists. (`:311`–`334`)
  5. Parallel fetch: EODHD bulk real-time prices (batched 20 at a time via `fetchBulkPrices`, `:26`–`79`), `indexIntelligence/marketContext`, `indexIntelligence/stockRankings`, and `stockTechnicalScores/{symbol}` for every unique symbol via `db.getAll(...)`. (`:337`–`345`)
  6. Build `rankingsMap` from `stockRankings.stocks[]`, `techScoresMap` from per-symbol docs. (`:351`–`361`)
  7. For each active battle: compute `portfolioBriefs`, `scoutAlerts`, `mcBlock`; `writeBatch.set(voiceLayerCache/{battleId}, { ... })`. (`:369`–`394`)
  8. Single `writeBatch.commit()`. (`:396`)
  9. Returns `{ success, battlesProcessed, totalSymbols, pricesFetched, duration }`. (`:401`–`407`)

### B.4 Update cadence and staleness handling
- Cadence: every 15 minutes during the scheduled hours (Mon–Fri, UTC hours 13–20).
- No explicit TTL or staleness check in either writer or reader. `updatedAt` is written but never inspected by `api/agent/chat.js`.
- Freshness signal consumed by the prompt is `dataFreshness.prices` — the builder prepends "(Prices as of last cache refresh, not real-time.)" whenever `dataFreshness.prices !== 'websocket'` (`voiceLayerPrompt.js:420`–`421`). The cron always writes `'rest_15min'`, so the freshness footnote is effectively always shown.
- If the cron skips a run (e.g., market closed), the cache doc is simply not updated — prior values remain until overwritten.

### B.5 After-hours behavior
- Runs market hours only — double gate:
  1. Vercel cron schedule restricted to `13,14,15,16,17,18,19,20 UTC` Mon–Fri (`vercel.json:155`).
  2. Handler-level guard aborts with `skipped: market_closed` if `getMarketState()` is not `OPEN` or `PRE_MARKET` (`voice-layer-cache.js:296`–`299`). Holidays, weekends, and after-hours therefore skip the write even if invoked.
- No write occurs post-close, on weekends, or on holidays. Chat requests after hours read whatever the last in-hours write left behind.

---

## Unknowns
- Token budget for Block 3.5 is not enforced anywhere — the cap depends solely on the size of `indexIntelligence/marketContext.regime` + `regimeDetail`. Not confirmed what the max realistic length is in production data.
- `battle.marketOpen` used in `buildBattleState` at `voiceLayerPrompt.js:410` is not populated by the voiceLayerCache cron and its write site was not inspected in this audit.
- `forgeSeeds` is always written as `null` by the cache cron; consumers of this field (if any) were not traced.

## Flags
- Block 3.5 duplicates data already present in Block 4C. Both read from `indexIntelligence/marketContext`: Block 3.5 via a direct Firestore read in `chat.js:217`, Block 4C via `voiceLayerCache.marketContext` written by the cron (`voice-layer-cache.js:247`–`279`, `361`). Block 3.5 takes only `regime` + `regimeDetail`; Block 4C expands the same source with SPY, breadth, sectors, yields.
- `anchorContext` fallback strings differ across modes (`:623` review vs `:721` battle) — not necessarily a bug, but worth noting the inconsistency.
- `DATA_CONFIDENCE_RULE` is appended whenever `marketSnapshot` is truthy, but `buildPortfolioBriefsBlock` has its own inlined freshness note driven by `dataFreshness.prices` (`voiceLayerPrompt.js:420`). Two freshness framings in the same prompt.
- `vixLevel` in `marketContext` block is hardcoded to null with comment "No VIX data in codebase" (`voice-layer-cache.js:269`). Field is written but never read (builder doesn't reference `vixLevel`).
- Cron UTC hours `13–20` inclusive — under EST (UTC-5) that's 08:00–15:59 ET, which misses the final half-hour of the regular session (until 16:00 ET). Under EDT (UTC-4) it's 09:00–16:59 ET, which covers the full session. Cadence coverage differs by DST window.
- Pre-market guard allows `PRE_MARKET` state, but cron hours begin at UTC 13 (08:00 EST / 09:00 EDT). During EST months the 08:00–09:20 ET pre-market window is reachable; during EDT months pre-market runs before the cron's first slot.
- `voiceLayerCache` docs are never deleted on battle completion — no TTL logic in the cron or chat handler. Stale docs for ended battles could accumulate.
- Confirmed pre-loaded context: `voiceLayerCache` is per-battle ✓. Block 3.5 is not hardcoded ✓. No `api/market-pulse.js` exists ✓. Env var for Anthropic not relevant to this audit scope (the voice layer calls `callGemmaVoice` via OpenRouter, `chat.js:262`).
