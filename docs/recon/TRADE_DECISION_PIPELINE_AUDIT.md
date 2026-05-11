# Trade-Decision Pipeline Audit

**Branch:** `claude/trade-decision-recon`
**Date:** 2026-05-11
**Mode:** Read-only investigation. No production code changed.

This document traces the full mid-battle trade-decision pipeline as it exists
on `main` today, from the cron tick that wakes a battle to the Firestore
write that records a trade. All claims cite `file:line`. Where the codebase
is ambiguous, the entry says so explicitly rather than guessing.

The audit is anchored in `api/cron/agent-evaluate.js` (the dominant cron) and
its supporting modules in `api/_utils/agent*`. PvP battles in the `battles`
collection are out of scope except where they overlap with Vision.

---

## Question 1 — Battle Evaluation Tick Flow

### Cron(s) that touch agentBattles

Three crons read or write the `agentBattles` collection. Schedules from
`vercel.json:142-159`:

| Cron | Path | Schedule (UTC) | Role |
|---|---|---|---|
| Mid-battle eval | `/api/cron/agent-evaluate` | `*/15 13–21 * * 1-5` | The dominant tick: scoring, risk, triggers, Haiku, swap exec, expiry → completion. (`vercel.json:142-145`) |
| Reflection drainer | `/api/cron/process-pending-reflections` | `*/15 13–0 * * *` | Polls `status='completed' AND pendingReflection=true`, calls Sonnet reflection. (`vercel.json:146-149`, `api/cron/process-pending-reflections.js:30-95`) |
| End-of-day batch review | `/api/cron/agent-batch-review` | `25 20,21 * * 1-5` | Runs at 4:25 PM ET; appends a Haiku-generated `dailyReviews[]` entry plus a Gemma auto-debrief. (`vercel.json:154-157`, `api/cron/agent-batch-review.js:62-350`) |

`agent-evaluate` is the only one that produces trade decisions. The other
two operate post-hoc on completed or end-of-day state.

### Numbered call sequence — single tick of an active battle

All line numbers are in `api/cron/agent-evaluate.js` unless prefixed.

1. **Cron entry (`handler`)** — `api/cron/agent-evaluate.js:55-147`. Auths
   the Vercel cron header, fetches `findActiveAgentBattles(db)` from
   `api/_utils/agentBattleService.js:21-28` (`status='active'`), then loops
   through each battle in a 50-second time budget.
2. **Expiry sweep** — Lines `72-90`. Battles past `expiresAt` are routed to
   `completeBattle()` (`api/cron/agent-evaluate.js:1662-1788`) which sets
   `status='completed'`, `pendingReflection=true`, optionally retires Vision,
   and bumps agent stats. Cron then drops out for that battle.
3. **Market-hours guard** — Lines `92-96`. Non-market hours skip evaluation
   for surviving active battles (expiry sweep above still ran).
4. **Per-battle lock** — `processAgentBattle` (`151-178`) opens a Firestore
   transaction that claims `cronState.evaluatingAt` (2-min TTL). If another
   tick already holds it, this battle is skipped.
5. **Migration backfill** — `181-200`. Adds default values for `executionMode`,
   `pendingProposal`, `proposalHistory`, `battleLedger`, `statusFeed`,
   `strategyPreset`, `gameplanMeeting*`, `chatExchanges`, `dailyReviews`,
   `dailyGrades` if missing. Mutates the in-memory `battle` for the rest of
   the tick.
6. **Symbol set assembly** — `211-224`. Combines portfolio, bench, watchlist
   `hotBench`, opponent portfolio, and macro tickers (`SPY`, `QQQ`,
   `BTC-USD.CC`).
7. **Price fetch (parallel)** — `226-239`. `getStockAnalysisData(symbol,
   {forceRefresh: true, fields: ['daily','price']})` for every symbol via
   `api/_utils/marketDataCache.js`.
8. **Asset scoring** — `248-309`. `calculateAssetScoreServer` from
   `api/_utils/agentScoring.js` runs per active position and per CPU
   opponent position.
9. **Score state assembly** — `313-344`. Aggregates active + banked points,
   computes opponent score, builds `scoreUpdate` Firestore patch with
   threshold-history dot-paths.
10. **Parallel intelligence fetch** — `346-363`. `Promise.allSettled([
    fetchIntradayBatch(portfolioSymbols, '5m'),
    indexIntelligence/stockRankings.get(),
    db.getAll(stockTechnicalScores docs),
    db.getAll(marketContext, SPY)
    ])`.
11. **Intraday derivatives** — `366-380`. VWAP and 5-min SMA20 per active
    position via `calculateVWAP` and `calculate5minSMA20`.
12. **Watchlist refresh on day boundary** — `385-441`. On a new trading day,
    the top-15 BaggerBomb-fit candidates from `stockRankings` become the new
    `watchlist.hotBench`; next 18 become `monitoring`.
13. **Rankings + tech-score merging** — `446-512`. Builds per-symbol
    `momentumData.rankings`, `momentumData.rankingsMap`,
    `momentumData.techScoresMap`, `momentumData.regimes`,
    `momentumData.marketPosture`.
14. **Vision read** — `514-547`. Reads `battle.vision` (defensive try/catch),
    builds `visionState` and stores it on `momentumData.visionState`. **No
    Firestore I/O on this path** — Vision is already in scope from the
    `findActiveAgentBattles` snapshot. See Q4 for what this actually
    contains in production.
15. **Risk evaluation (deterministic)** — `549-590`. Per-position
    `evaluateRisk()` from `api/_utils/agentRiskManager.js:30-86` produces
    one of `EMERGENCY_SWAP | SWAP_OUT | TRAIL_STOP | LOCK | HOLD`. Adds
    LOCK symbols to `lockedPositions` set.
16. **Risk-driven swap execution** — `594-673`. Any symbol with action in
    `EMERGENCY_SWAP | SWAP_OUT | TRAIL_STOP` is swapped out via
    `pickEmergencyReplacement` + `executeSwapServer`. **This is a code path
    where trades are written without Haiku ever being called.** Each forced
    swap re-reads the battle doc to keep state coherent (`667-669`).
17. **Pending-proposal lifecycle** — `676-689`. `handlePendingProposal`
    (`1269-1415`) handles approved / vetoed / lapsed / expired proposals
    from prior ticks, executing approved swaps via `executeSwapServer`.
    Returns `'skip_haiku'` if a proposal is still pending.
18. **Gameplan meeting lifecycle** — `691-729`. `handleGameplanMeeting`
    (`1424-1512`) handles status transitions; `detectGameplanMeetingTrigger`
    (`1522-1655`) creates a meeting on 3-consecutive-losers or sector-drag
    >60%. When a meeting fires, the cron writes it and **returns without
    calling Haiku**.
19. **News fetch** — `731-733`. `fetchRecentNews(db, allTickers)` from
    `api/_utils/agentTriggerGate.js:196-232` queries `fantasyTimesStories`
    by ticker (per-symbol Firestore queries, last 120 minutes by default).
20. **Catalyst override** — `735-776`. Stories whose tickers aren't in the
    current eval set get added as synthetic bench assets (capped at 5) so
    Haiku can swap into them.
21. **Trigger gate** — `778-803`. `evaluateTriggers` from
    `api/_utils/agentTriggerGate.js:20-184` returns
    `{shouldEvaluate, triggers, newStoryIds}`. Forced triggers
    (`forced_open` first eval, `forced_close` final hour) always pass.
    Conditional triggers: price drop ≤−0.5x ATR, threshold proximity within
    0.2x of bonus/penalty, bench daily move ≥0.5x ATR, VWAP deviation
    ≥1.5%, BB-bandwidth ≤20th percentile, NR7 flag, news catalyst on a
    held/bench symbol. **If `shouldEvaluate` is false, Haiku is skipped**
    and a HOLD is recorded.
22. **Haiku call** — `805-850`. `claude-haiku-4-5-20251001`, `temperature:
    0.4`, `max_tokens: 1024`, `tools: [TRADE_DECISION_TOOL]`,
    `tool_choice: {type:'tool', name:'submit_trade_decision'}`, 10-second
    timeout. Three messages: system prompt + cached identity + fresh live
    context. See Q2 for prompt details.
23. **Guardrail enforcement (deterministic)** — `864-915`. `applyGuardrails`
    from `api/_utils/agentGuardrails.js:58-331` may force a SWAP, block a
    SWAP, or pass through Haiku's decision based on
    `battle.agentContext.deployedGuardrails`. See Q3/Q6.
24. **LOCK & distressed blocks** — `917-931`. Hard refusals: SWAP-out of a
    risk-LOCKed symbol → HOLD; SWAP-in of a `distressed` regime symbol →
    HOLD.
25. **Validation** — `935-941`. `validateTradeDecision` from
    `api/_utils/agentSwapExecution.js:21-75` checks symbol resolution,
    cooldowns, asset-type match, conviction ≥70, hypothesis present.
    Failure → HOLD with `validationErrors`.
26. **Mode branching** — `942-1063`.
    - `executionMode === 'autopilot'` → `executeSwapServer` immediately.
    - `executionMode === 'copilot'` → write `pendingProposal` with 10-min
      TTL; auto-execute on expiry next tick.
    - `executionMode === 'manual'` → write `pendingProposal` with 15-min
      TTL; lapse silently if no Coach action.
27. **`executeSwapServer`** — `api/_utils/agentSwapExecution.js:102-258`.
    Single Firestore transaction:
    - Re-reads battle doc; aborts if asset moved.
    - Picks live-beacon price if fresh (<2 min), else REST price.
    - Computes `lockedPoints` and `lockedGainPct` for the outgoing asset
      via `calculateAssetScoreServer`.
    - Builds `closedTrade` with `evaluationMetadata` spread, plus the
      Phase 4 `snapshot` of technicals at decision time.
    - Replaces the slot, refreshes `thresholdHistory`, runs the revolving-
      door bench (outgoing asset → bench with 24h `cooldownUntil`).
    - Atomic update: `portfolio.<tier>`, `portfolio.bench.stocks`,
      `portfolio.bench.crypto`, `thresholdHistory`, `trades` (capped at
      50), `scoreState.tradeCount++`, `updatedAt`.
28. **Status feed entries** — `api/cron/agent-evaluate.js:1072-1115`. One
    entry per Haiku-derived event (proposal / swap / hold), plus an
    additional `guardrail_*` entry when an override fired (`1117-1132`).
29. **Evaluation record build** — `1134-1168`. Captures `evalId`, decision,
    rationale, hypothesis, conviction, triggers, market posture, validation
    errors, guardrail telemetry. Pushed to `battle.evaluations[]` (capped
    at 150, `1191`).
30. **Shadow log (fire-and-forget)** — `1170-1188`. `logEvaluation` from
    `api/_utils/shadowLogger.js:62` writes a JSONL record to GCS bucket
    `fantasytrades`.
31. **Final atomic update** — `1200-1224`. One `battleRef.update(finalUpdate)`
    writes scores, evaluations, statusFeed, hold/eval counts, cron
    bookkeeping (`lastEvaluatedAt`, `lastTriggeredAt`, token totals,
    consecutiveHolds, vwapTicks, intradayMomentum), clears the
    `evaluatingAt` lock, and may set `pendingProposal`.

### Where market data is fetched

- Per-tick: `getStockAnalysisData` (REST, `agent-evaluate.js:228-239`).
- Intraday: `fetchIntradayBatch(portfolioSymbols, {interval: '5m'})`
  (`agent-evaluate.js:355-363`).
- Pre-computed: `indexIntelligence/stockRankings`,
  `indexIntelligence/marketContext`, `indexIntelligence/SPY`, and
  `stockTechnicalScores/<symbol>` are read in the same `Promise.allSettled`.
- Inside `executeSwapServer`, a `livePriceBeacon` written elsewhere on the
  battle doc is preferred when fresh (<2 min) — see
  `agentSwapExecution.js:122-130`.

### Where agent state and dossier fields are loaded into the decision context

- Battle doc carries `agentContext` (frozen at battle creation in
  `api/_utils/agentBattleService.js:114-135`). This includes
  `agentName`, `archetype`, `strategyBrief`, `innerMonologue`, `activeRules`,
  `equippedBundleIds`, `deployedGuardrails`, `riskTolerance`,
  `consolidatedInsight`, and `initialPortfolio`.
- The Haiku prompt (`buildAgentIdentityBlock`,
  `api/_utils/agentEvalPromptAssembly.js:216-296`) reads from this snapshot:
  identity, risk tolerance, strategy brief, initial portfolio rationale,
  `consolidatedInsight`, and the Forge `activeRules` rendered as
  `CONSTRAINTS` / `STRATEGY PREFERENCES`.
- `disciplines`, `partnerProfile`, and pending `lessons` live on the
  `agents/{id}` document and are NOT loaded into the Haiku trade-decision
  prompt. They are consumed by:
  - The chat / voice layer (`api/_utils/voiceLayerPrompt.js:818-823`,
    `api/agent/chat.js:240`) — partner profile.
  - Sonnet consolidation (`api/_utils/agentConsolidationPrompt.js:131-143`,
    `192-194`) — disciplines + partner-profile summary + lessons.
  - The lesson queue itself is consumed by the consolidation cron, not the
    eval cron.
- `dossierInputs` does not exist as a field anywhere in `api/` or `src/`.
  Searched: `grep -rn "dossierInputs" api/ src/` → 0 matches. The dossier
  funnel today is one-directional: reflection writes `agent.lessons[]`,
  consolidation reads them, consolidation writes `agent.disciplines` +
  `agent.consolidatedInsight`, and only `consolidatedInsight` re-enters the
  Haiku trade prompt (via the cached `agentContext.consolidatedInsight`).

### Where Vision is read (in this flow)

- `agent-evaluate.js:514-547` constructs `visionState` from `battle.vision`
  if present. The block is rendered by `buildVisionStateBlock` in
  `api/_utils/agentEvalPromptAssembly.js:526-586` and embedded immediately
  after the macro-benchmarks header in the live context. See Q4 for whether
  this fires in practice.

### Where Haiku is called

`agent-evaluate.js:805-850`. Single call per tick; see Q2.

### Where the swap actually executes

`api/_utils/agentSwapExecution.js:102-258` (`executeSwapServer`). It is the
sole code path that mutates `portfolio.<tier>` slots and appends to
`trades[]`. Three call sites:

- Risk-driven swap: `agent-evaluate.js:644-648`
- Autopilot Haiku swap: `agent-evaluate.js:981-985`
- Approved/expired-copilot proposal swap: `agent-evaluate.js:1290-1296` and
  `1372-1378`
- Gameplan-approved swap: `agent-evaluate.js:1447-1454`

### Where receipts / trade records are written

- `agentBattles.trades[]` is appended by `executeSwapServer` (single transaction,
  `agentSwapExecution.js:241-242`). Capped at 50.
- `agentBattles.evaluations[]` is the per-tick decision log, written in the
  final `battleRef.update` at `agent-evaluate.js:1200-1224`. Capped at 150.
- `agentBattles.statusFeed[]` is appended throughout the tick (capped at
  100 for agent battles, 50 for PvP).
- `agentBattles.proposalHistory[]` is appended by `handlePendingProposal`
  on resolve / lapse (`agent-evaluate.js:1314-1411`).
- `agentBattles.dailyReviews[]` and `chatExchanges[]` are written by the
  end-of-day cron (`agent-batch-review.js:212-220`, `:299-301`).
- Shadow logs (`evaluations`, `vision_transitions`) go to GCS bucket
  `fantasytrades` via `shadowLogger.js:34-57`. Fire-and-forget; never
  blocks.

### Where lessons / memory entries get appended

Not in the eval cron — only in the reflection path:

- `api/cron/process-pending-reflections.js:73` calls `generateReflection`
  (one battle at a time, awaited).
- `api/agent/reflect.js:101-105` calls `writeMemoryReflection`
  (`reflect.js:196-221`) which appends to `agents/{id}.memory[]`
  (rolling 5-game window).
- `api/cron/agent-batch-review.js:332-336` appends to `agents/{id}.lessons[]`
  and `agents/{id}.forgeSuggestions[]` via `FieldValue.arrayUnion` if the
  Gemma auto-debrief produced any.
- `api/agent/chat.js` (review-mode replies) also writes lessons from the
  voice layer — see grep result for `agent.lessons` in chat.js handler.

---

## Question 2 — The Trading Brain (Haiku)

### Where the Haiku prompt is assembled

`api/_utils/agentEvalPromptAssembly.js`. Three exported builders:

- `buildEvalSystemPrompt(agentName, archetype)` — system prompt
  (`agentEvalPromptAssembly.js:22-207`). Static other than name/archetype.
- `buildAgentIdentityBlock(battle)` — first user message, intentionally
  cacheable (`agentEvalPromptAssembly.js:216-296`).
- `buildLiveContextBlock(battle, prices, macroPrices, assetScores,
  triggers, news, recentEvals, momentumData, presetConfig)` — second user
  message, fresh every tick (`agentEvalPromptAssembly.js:608-745`).

The cron stitches the call together at `api/cron/agent-evaluate.js:815-837`.
The conversation shape is system + user1(identity) + assistant("I
understand…") + user2(live context). The assistant turn is a hard-coded
priming line that exists to terminate the cacheable identity prefix.

### Major prompt sections and their source fields

**System prompt** (`buildEvalSystemPrompt`, `agentEvalPromptAssembly.js:22-207`):
hand-written rules covering scoring math, decision framework
("default to HOLD"), forward-EV thinking, regime-aware strategy (S1 squeeze,
S2 52w high, S3 RS pullback, S4 mean reversion, S5 news catalyst), tier
impact, threshold proximity, sector awareness, conviction floor 70,
intraday momentum signals (VWAP, BB bandwidth, NR7), risk LOCK/WARNING
hints, status-feed and trade-reasoning instructions, FORGE rules
explanation, anti-thrash rules (cooldown, one swap max, no round-trips),
Survival Mode override clause, inner-monologue format with three example
monologues. About 1,200 tokens of static text.

**Identity block** (`buildAgentIdentityBlock`,
`agentEvalPromptAssembly.js:216-296`):
- ABOUT YOU: `ctx.agentName`, `archetype`, `riskTolerance`,
  `evaluationInterval` (`220-226`).
- STRATEGIC BRIEF: `ctx.strategyBrief` (`229-232`).
- INITIAL PORTFOLIO RATIONALE: `ctx.innerMonologue.{star,core,support,bench}Rationale`
  (`234-242`).
- STRATEGIC WISDOM: `ctx.consolidatedInsight` (`245-247`).
- FORGE RULES: rendered from `ctx.activeRules`, split into `CONSTRAINTS`
  (categories: risk, allocation) and `STRATEGY PREFERENCES`. Rule text is
  sanitized via `sanitizeRuleText` (`307-336`) and templates are
  interpolated via `interpolateRuleText` (`346-356`). Adds a
  `C_INST` warning paragraph if any institutional rules are present
  (`273-283`).

**Live context block** (`buildLiveContextBlock`,
`agentEvalPromptAssembly.js:608-745`), in order:
- Header: trading day, phase (EARLY/MID/LATE/FINAL_HOUR via `computeBattlePhase`),
  time remaining, current/active/banked scores, trade and eval counts, macro
  benchmarks (SPY/QQQ/BTC).
- Vision state preamble (`buildVisionStateBlock`, `526-586`) — see Q4.
- Regime context (`buildRegimeContext`, `1148-1165`): market posture +
  per-symbol stock regimes.
- Strategy preset block: `presetConfig.label` + `presetConfig.promptGuidance`
  from `agentPresetConfig.js`.
- ACTIVE POSITIONS CSV (`buildPortfolioCSV`, `865-882`): tier, symbol,
  sector, entry day, entry $, current $, gain%, ATR multiple, badges, ATR%.
- BENCH CSV (`buildBenchCSV`, `884-912`): symbol, sector, current $, daily
  %, ATR%, status (`available` or `locked until <ts>`).
- BENCH TECHNICAL CONTEXT (`buildBenchTechnicalBlock`, `930-981`): per-bench
  multi-line technicals (trend, momentum, volatility, volume, RS, levels,
  recent action, composite). Reads `momentumData.rankingsMap` and
  `momentumData.techScoresMap`.
- CLOSED TRADES (`buildClosedTradesCSV`, `1122-1141`): all swap trades
  with ghost prices.
- TRIGGER block: human-readable list of which triggers fired this tick.
- INTRADAY MOMENTUM SNAPSHOT (`buildMomentumSnapshot`, `1212-1248`): per
  active symbol VWAP, BB bandwidth percentile + SQUEEZE/EXPANDED label,
  NR7 flag, daily range.
- RISK STATUS (`buildRiskStatusBlock`, `1170-1190`): per-symbol risk action
  (LOCK / EMERGENCY_SWAP / etc).
- ACTIVE DIRECTIVE (`agentEvalPromptAssembly.js:693-701`): if
  `battle.directive.directiveThreadId && battle.directive.text`, includes
  the Coach's current directive and asks Haiku to echo `directiveThreadId`
  if it acts on it.
- INSTITUTIONAL INTELLIGENCE (`fetchInstitutionalContext`,
  `agentEvalPromptAssembly.js:377-420`): only fetched if `activeRules`
  contain any `category === 'institutional'` rule. Reads
  `institutionalHoldings/{symbol}` and `institutionalAggregates/latest`.
- NEWS CONTEXT: ranked + reporter-aware via
  `rankAndSelectStories` + `buildNewsIntelligenceBlock` from
  `api/_utils/agentNewsContext.js` if Forge rules are equipped, else
  `buildBareNewsBlock` (`716-735`).
- YOUR LAST 3 DECISIONS: `formatRecentEvals(battle.evaluations, 3)`
  (`848-861`).

### Output format

Tool use, forced. Schema in `api/_utils/agentEvalToolSchema.js:4-148`.
Tool name: `submit_trade_decision`. Required fields:
`decision` (`HOLD|SWAP`), `rationale`, `conviction` (0–100), `hypothesis`,
`riskAssessment` (`low|medium|high`). Optional: `symbolOut`, `symbolIn`,
`ignoredDirectiveIds`, `directiveThreadId`, `status_feed_update`,
`trade_reasoning` (structured object with `thesis`, `strategy`,
`indicators[]`, `citedRules[]`, `conviction`), `pvp_context`,
`cited_rules[]`, `cited_forge_rules[]` (with `influence`),
`overridden_forge_rules[]` (with structured `reason` enum).

Haiku is only allowed to emit `HOLD` or `SWAP`. There is no `BUY-only` or
`SELL-only` action — every trade is a one-for-one slot replacement.

### Downstream consumer

`api/cron/agent-evaluate.js:842-846` extracts `response.content.find(c =>
c.type === 'tool_use')?.input` and assigns it to `haikuResult`. Everything
downstream — guardrails, validation, mode branching, status feed,
evaluation record — reads from this single object. There is no other
consumer.

### Decisions vs proposals

Haiku produces a decision (HOLD or SWAP). The cron then either:
- Executes immediately (`executionMode === 'autopilot'`).
- Materializes a `pendingProposal` (`copilot` / `manual`) that the user
  approves/vetoes via the UI (Coach), or that auto-executes (copilot) or
  lapses (manual) on expiry.

So Haiku's output is _the decision_. The autopilot/copilot/manual layer is a
human-in-the-loop gate, not a proposal-translation layer.

### Calls per tick

Exactly one Haiku call per tick per battle on the eval path
(`agent-evaluate.js:816-837`). The trigger gate (`evaluateTriggers`,
`agentTriggerGate.js`) gates whether that single call happens at all.
Other Haiku call sites in the system that touch agent battles, but on
different code paths, are:

- `api/cron/agent-batch-review.js:174-188` — once per battle per trading
  day at 4:25 PM ET, generates `dailyReviews[]` entry.
- `api/agent/chat.js` — Coach chat (Gemma in voice layer, not Haiku, but
  worth noting for completeness).

---

## Question 3 — Signal Generation and Modulation

### Is there a per-ticker signal generator?

**No, not in the shape the question implies.** The codebase does not produce
a per-ticker `{symbol → buy/sell/hold/skip}` signal map before Haiku is
called. The closest analogues are:

- **Stock regime classification** — `classifyStockRegime` in
  `api/_utils/agentRegimeClassifier.js:25-55`. Per-symbol output is one of
  `directional_expansion | directional_contraction | choppy | distressed`.
  Computed at `agent-evaluate.js:495-499` and embedded in the prompt as
  `STOCK REGIMES: <sym>=<regime>, ...`. This is a **classifier**, not a
  buy/sell signal.
- **Trigger gate** — `evaluateTriggers` (`agentTriggerGate.js:20-184`) emits
  events like `price_drop`, `threshold_proximity`, `bench_outperformance`,
  `vwap_deviation`, `bandwidth_squeeze`, `nr7_contraction`, `news_catalyst`.
  These do not score tickers — they decide whether Haiku should be woken
  at all. The triggers are passed verbatim into the prompt as bullet
  points.
- **Composite technical score** — `stockTechnicalScores/<symbol>` (read at
  `agent-evaluate.js:355-363`) carries a per-stock numeric `technicalScore`
  populated by the daily `compute-rankings` cron (`api/cron/compute-rankings.js`).
  The eval cron exposes this only inside `BENCH TECHNICAL CONTEXT` for
  Haiku to read; the cron itself does not rank or filter on it.

So per-ticker buy/sell/hold/skip is something Haiku produces **internally**
based on the prompt context. There is no upstream stage that produces it
deterministically.

### Is there a "modulator" applying behavioral adjustments?

**Partially, by adjacency rather than design.** The behavioral-adjustment
function exists in two places, neither of which scores or modifies a
per-ticker signal:

- **Risk Manager** (see below) issues per-symbol overrides that read like
  behavioral rules: bust-avoidance buffer, VWAP-failure exits, threshold
  LOCKs, trail stops.
- **Strategy preset** (`api/_utils/agentPresetConfig.js:6-57`) — three
  presets (`aggressive`, `balanced`, `defensive`) tweak the risk thresholds
  used by the Risk Manager (`bustBuffer`, `vwapFailureTicks`, `trailStopATR`),
  the conviction floor (`minConviction` 65/75/85), the favored strategy
  list, and the prompt's tone via `promptGuidance` (`agentPresetConfig.js:21,
  38, 55`). The minConviction value is informational in the prompt — the
  hard 70 floor is enforced in `validateTradeDecision`
  (`agentSwapExecution.js:62-64`).

There is **no** explicit "tilt detection" or "loss-aversion" code. Search
yielded 0 matches for `tilt`, `loss aversion`, `position protection rules`
across `api/` and `src/`. The Sonnet reflection prompt may produce lessons
that look behavioral, but those write to `agent.lessons[]` and
`agent.disciplines` — they re-enter the trade decision only via the
consolidated `consolidatedInsight` text in the next battle's identity
block (`agentEvalPromptAssembly.js:245-247`).

### Risk Manager LOCK / SWAP_OUT — what it actually does

File: `api/_utils/agentRiskManager.js`. Pure logic, no I/O.

`evaluateRisk(position, currentPrice, entryPrice, baseATR, intradaySnapshot,
cronMemory, presetOverrides)` returns one of five actions, in priority order
(`api/_utils/agentRiskManager.js:30-86`):

1. **`EMERGENCY_SWAP`** when `atrMultiplier <= bustBuffer` (default −0.85x,
   tunable via preset). Reason `bust_avoidance`. The cron
   (`agent-evaluate.js:594-673`) immediately executes the swap by picking
   the highest-daily-mover bench replacement
   (`pickEmergencyReplacement`, `agentRiskManager.js:111-133`). Haiku is
   never consulted.
2. **`SWAP_OUT`** when `cronMemory.ticksBelowVwap >= vwapFailureTicks`
   (default 2). Reason `vwap_failure`. Executed the same way as
   `EMERGENCY_SWAP`.
3. **`LOCK`** when the position sits within 0.2x ATR of `+1.0/+1.5/+2.0`
   bonus thresholds. Reason `threshold_proximity`. The cron does NOT swap;
   it adds the symbol to a `lockedPositions` set
   (`agent-evaluate.js:587-589`). After Haiku returns, any SWAP whose
   `symbolOut` is in this set is forcibly downgraded to HOLD with a
   `validationError` (`agent-evaluate.js:917-923`).
4. **`TRAIL_STOP`** when `atrMultiplier >= trailStopATR` (default 1.5x) AND
   current price drops below the 5-min SMA20. Reason `stepped_trail`.
   Executed like `EMERGENCY_SWAP`.
5. **`HOLD`** otherwise.

Inputs consumed: position metadata (`symbol`, `tier`, `baseATR`),
`currentPrice`, `entryPrice`, an intraday snapshot containing `vwap`,
`vwapDeviation`, `sma20_5m`, the cron memory's `ticksBelowVwap` counter,
and optional preset overrides.

### Anything that scores or ranks candidate stocks for buying?

The daily `compute-rankings` cron writes `indexIntelligence/stockRankings`
with a `stocks[]` array sorted by `baggerBombFit`. The eval cron uses this
in two places: (a) the daily watchlist refresh
(`agent-evaluate.js:385-441`) picks top 15 by `baggerBombFit` for the
`hotBench`, and (b) `BENCH TECHNICAL CONTEXT` rendering. There is no
per-tick ranking of buy candidates beyond this; the actual choice of what
to swap into is Haiku's call within the bench universe.

For risk-driven swaps (Risk Manager / Guardrails), the replacement is
chosen by `pickEmergencyReplacement` (`agentRiskManager.js:111-133`),
which ranks bench candidates by `prices[symbol].changePercent` (highest
daily move first), filtering out cooldowns and crypto/stock mismatches.
That's a one-line ranking, not a real signal generator.

### Deterministic constraint enforcement

Two layers of deterministic enforcement exist:

- **Risk Manager** (see above) enforces per-position survival rules. Always
  runs; not user-configurable beyond preset.
- **Guardrails** (`api/_utils/agentGuardrails.js:58-331`) enforces user-
  configured guardrails snapshotted into `battle.agentContext.deployedGuardrails`
  at battle creation. Five types:
  - `stopLoss` (hard) — forces SWAP on any held position whose P&L breaches
    `−value%` (`api/_utils/agentGuardrails.js:94-130`).
  - `trailingStop` (hard) — forces SWAP on a position whose drawdown from
    its implied peak (derived via `thresholdHistory.maxMultiplier`) breaches
    `−value%` (`api/_utils/agentGuardrails.js:132-153, 376-390`).
  - `maxSectorWeight` (hard) — blocks SWAP if it would push a sector above
    `value%` slot share (`api/_utils/agentGuardrails.js:158-178, 423-455`).
  - `maxPosition` (hard) — logged as `skipped_incompatible`; BaggerBomb's
    fixed slots make a position-% cap a no-op
    (`api/_utils/agentGuardrails.js:180-192`).
  - `profitTarget` (soft) — surfaces a `note` override; never blocks
    (`api/_utils/agentGuardrails.js:194-217`).
  - LOCK semantics override Guardrails — a LOCKed position's stop-loss is
    deferred (`api/_utils/agentGuardrails.js:220-234`).

### Are constraints in the same call as signal generation?

There is no separate signal-generation stage. The constraints (Risk
Manager, Guardrails, LOCK/distressed, validation, conviction floor) all
run **after** Haiku produces its decision, except for the Risk Manager's
`EMERGENCY_SWAP / SWAP_OUT / TRAIL_STOP` actions which run **before**
Haiku and may execute a swap without consulting Haiku at all
(`agent-evaluate.js:594-673`). LOCK runs before Haiku and influences both
the prompt (`RISK STATUS:` block) and a post-Haiku block check.

Net: pre-Haiku enforcement (Risk Manager forced exits) is the exception;
the dominant pattern is "Haiku decides → deterministic enforcers
disposes."

---

## Question 4 — Vision System Reality Check

The May-2026 audit finding holds.

- **Reads (agent battle path):** `api/cron/agent-evaluate.js:514-547`
  reads `battle.vision`. It is rendered into the prompt by
  `buildVisionStateBlock` (`api/_utils/agentEvalPromptAssembly.js:526-586`).
- **Writes:** Two and only two production writers.
  1. `src/firebase/firebaseService.js:240` — sets `vision:
     createInitialVision(null, Timestamp.now())` at battle creation. **This
     write targets the `battles` collection (PvP), not `agentBattles`.** See
     `firebaseService.js:243` (`addDoc(collection(db, 'battles'), battle)`).
  2. `api/cron/agent-evaluate.js:1670-1747` — writes a `retired` Vision
     transition when an agent battle is completed. Guarded by `if
     (prevVision && prevVision.state !== 'retired')` (`1680`), which is
     false for any battle whose Vision was never initialized.
- **agentBattles creation does not initialize Vision.** Confirmed by
  reading `createAgentBattle` (`api/_utils/agentBattleService.js:42-189`):
  the `battleDoc` literal contains no `vision` field.
- **Lifecycle states reachable in production for agent battles:** zero. Per
  `visionTransitions.js:26-145`, the writers wired up to the validator are
  `gemma`, `cron`, `sonnet`, `layer1`, and `battle_creation`. No `gemma`
  call site exists in the agent-battle flow that calls
  `validateTransition`. The only call site in production is the cron's
  retire-on-completion path. Since `prevVision` is always null for agent
  battles, the retire path never fires either.
- **What the Haiku prompt sees today:** `visionState = { present: false }`
  → `buildVisionStateBlock` returns `''` and the cron skips emitting the
  block (`agentEvalPromptAssembly.js:629-632`). The prompt has no Vision
  preamble for agent battles.
- **PvP `battles` collection:** Vision is initialized at creation but the
  cron only reads `agentBattles`, so Vision in PvP is also write-once /
  never-read by any decision-making code.

In one sentence: Vision is dead code on the agent-battle critical path.
The constants, validators, and `buildVisionStateBlock` all ship; the
runtime data does not.

---

## Question 5 — The Complete Write Path

Per cron tick, ordered by occurrence. All paths are in
`api/cron/agent-evaluate.js` unless prefixed.

### Conditional pre-Haiku writes

1. **Migration backfill** (`196-200`). One `battleRef.update(migrationFields)`
   if any of the Sprint-2/3/4 fields are missing. Replays into the
   in-memory `battle` object so subsequent code sees them.
2. **Lock claim** (`168-170`). Inside a transaction; sets
   `cronState.evaluatingAt = ISO8601`.
3. **Risk-driven swap** (`644-648`). If a position triggers
   `EMERGENCY_SWAP / SWAP_OUT / TRAIL_STOP`: `executeSwapServer` runs a
   transactional update touching `portfolio.<tier>`, `portfolio.bench.*`,
   `thresholdHistory`, `trades`, `scoreState.tradeCount`, `updatedAt`
   (`api/_utils/agentSwapExecution.js:245-255`). Re-reads battle
   immediately after (`668-669`).
4. **Approved-proposal swap** (`1290-1296`). `executeSwapServer` for
   user-approved proposals, same shape as #3.
5. **Expired-copilot proposal swap** (`1372-1378`). Same.
6. **Proposal lifecycle close** (`1314-1315`, `1339-1340`, `1410-1411`).
   `battleRef.update({ pendingProposal: null, proposalHistory:
   [...prev, resolved].slice(-50) })`.
7. **Gameplan-approved swap** (`1447-1454`). `executeSwapServer` per
   suggested swap; then clear `gameplanMeeting`, append to
   `gameplanMeetingHistory` (`1470-1471`).
8. **Gameplan trigger fire** (`716-728`). Sets
   `scoreUpdate.gameplanMeeting = trigger`,
   `scoreUpdate['cronState.lastGameplanDate']`. Cron then writes the
   accumulated `scoreUpdate` and returns without Haiku.

### "No-trigger" tick exit

9. **Trigger gate exit** (`789-803`). Single update: scores +
   `cronState.lastEvaluatedAt`, `triggerGatePassCount++`,
   `evaluatingAt: null`, `vwapTicks`, `intradayMomentum`, optional
   `statusFeed`, `seenStoryIds`.

### Haiku-driven tick

10. **Final atomic update** (`1200-1224`). One `battleRef.update(finalUpdate)`
    that merges:
    - All `scoreState.*` from `scoreUpdate`.
    - `evaluations` (capped at 150).
    - `statusFeed` (capped at 100/50).
    - `scoreState.evaluationCount`, `scoreState.holdCount`.
    - `cronState.lastEvaluatedAt`, `lastTriggeredAt`,
      `totalHaikuCalls++`, `totalTokens.input/output += usage`,
      `consecutiveHolds`, `vwapTicks`, `intradayMomentum`,
      `evaluatingAt: null`.
    - `pendingProposal` if mode branching created one.

### Battle completion (in expiry sweep)

11. **`completeBattle`** (`1720-1743`). Single update: `status:'completed'`,
    `completedAt`, `pendingReflection: true`, `reflectedAt: null`,
    `cronState.evaluatingAt: null`, `statusFeed` (with completion entry),
    optionally `vision: retiredVisionForWrite`.
12. **Agent stats** (`1751-1783`). Reads then writes
    `agents/{agentId}.stats` (wins/losses/draws/gamesPlayed/totalScore/avgScore/streaks)
    and `agents/{agentId}.activeBattleId = null`.
13. **`logBattlePattern`** (`agent-evaluate.js:77-79`,
    `api/_utils/battlePatternLogger.js`). Fire-and-forget; non-blocking.

### Side-effect writes (asynchronous, fire-and-forget)

14. **Shadow log evaluations** (`1170-1188`,
    `api/_utils/shadowLogger.js:62`). Writes JSONL to GCS
    `gs://fantasytrades/shadow/evaluations/<date>/<eventId>.jsonl`.
15. **Shadow log Vision transitions** (`1747`,
    `shadowLogger.js:109`). On retire only.
16. **Shadow logs for chat/reflection/consolidation** — written from
    `api/agent/*.js` and `api/_utils/agentConsolidationApply.js`, not from
    the eval cron.

### Cron-error log write

17. **Cron error fallback** (`120-135`). On a thrown exception during
    per-battle processing, the cron writes the error to
    `cronState.cronErrors[]` (last 20), clears the lock, and continues.

### Dossier inputs

There is no `agent.dossierInputs.*` field in the codebase. `grep -rn
"dossierInputs" api/ src/` returns 0 matches. The closest equivalents are:

- `agents/{id}.lessons[]` — written by chat.js (review mode) and by
  `agent-batch-review.js:332-336` via `FieldValue.arrayUnion`. Read by
  consolidation.
- `agents/{id}.memory[]` — written by `reflect.js:219` (rolling 5-game
  window). Not read in trade decisions.
- `agents/{id}.disciplines.{selection,execution}` — written **only** by
  `applyConsolidation` (`api/_utils/agentConsolidationApply.js:265-273`).
  Not read by the eval cron.
- `agents/{id}.consolidatedInsight` — written by
  `applyConsolidation:267`. Re-enters the next battle's Haiku prompt via
  `agentContext.consolidatedInsight` snapshot at battle creation
  (`agentBattleService.js:128`).
- `agents/{id}.evolutionTimeline` — appended on each consolidation
  (`applyConsolidation:271`).

### Cache writes

- `voiceLayerCache` is written by `/api/cron/voice-layer-cache` (separate
  cron, `vercel.json:150-153`); not touched by the eval cron.
- `agentBattles.cronState.intradayMomentum`, `vwapTicks`,
  `seenStoryIds`, `triggerGatePassCount`, `consecutiveHolds`,
  `totalHaikuCalls`, `totalTokens` — all are inline cache/state fields
  written in the same `finalUpdate` as the evaluation record, not in
  separate writes.

---

## Question 6 — How Deterministic Is the Execution?

**Most enforcement after Haiku is deterministic.** The pipeline is much
closer to "LLM proposes, deterministic enforcer disposes" than to a
direct passthrough — and there is one path (Risk Manager forced exits)
where Haiku is bypassed entirely.

### Layers between Haiku and the trade write

In execution order after Haiku returns at `agent-evaluate.js:842-846`:

1. **Guardrail enforcement** (`864-915`). `applyGuardrails` may:
   - Force SWAP on a stop-loss / trailing-stop breach, picking a
     replacement deterministically via `pickEmergencyReplacement`
     (`agentGuardrails.js:259-314`). This **rewrites Haiku's
     `symbolOut/symbolIn`** wholesale (`agent-evaluate.js:892-901`).
   - Block SWAP on a sector-cap breach → forces HOLD (`903-908`,
     `agentGuardrails.js:317-327`).
   - Pass through with notes (`profitTarget` soft, `maxPosition`
     incompatible).
2. **LOCK block** (`917-923`). If `lockedPositions.has(haikuResult.symbolOut)`,
   downgrade SWAP → HOLD with `validationError`.
3. **Distressed-in block** (`925-931`). If
   `stockRegimes[haikuResult.symbolIn] === 'distressed'`, downgrade SWAP
   → HOLD.
4. **`validateTradeDecision`** (`api/_utils/agentSwapExecution.js:21-75`).
   Hard checks:
   - `symbolOut` resolves to a portfolio slot (else error).
   - `symbolIn` resolves to bench OR `watchlist.hotBench` (else error).
   - Bench `cooldownUntil` not in the future (else error).
   - Stock-vs-crypto match (else error).
   - **`conviction >= 70`** (else error).
   - **Hypothesis present and ≥10 chars** (else error).
   Any failure → SWAP downgraded to HOLD (`agent-evaluate.js:937-941`).
5. **Mode branching** (`942-1063`). `executionMode` decides whether the
   validated SWAP runs immediately (`autopilot`) or becomes a
   `pendingProposal` (`copilot` / `manual`). The user's Coach approval is
   the deterministic gate for non-autopilot modes.
6. **`executeSwapServer` transaction** (`agentSwapExecution.js:102-258`).
   Inside the transaction:
   - Re-reads battle doc; aborts if the slot moved.
   - Computes `lockedPoints` deterministically from the price delta and
     the asset's threshold history. Haiku has no input here — the
     points the trade banks are derived from market data.
   - Refuses to swap if `swapPrice <= 0` (`184-186`).

### Cases where Haiku says "buy X" and the system says no

Yes, several:

- LOCK block (`agent-evaluate.js:917-923`) — Haiku says SWAP-out an
  almost-bonused symbol; system refuses.
- Distressed block (`925-931`) — Haiku says SWAP-in a `distressed`
  regime symbol; system refuses.
- Conviction-floor enforcement (`agentSwapExecution.js:62-64`) — Haiku
  reports conviction <70; downgraded.
- Cooldown (`agentSwapExecution.js:44-49`) — symbol is on bench but
  within 24h cooldown; downgraded.
- Asset-type mismatch (`agentSwapExecution.js:53-58`) — Haiku tries to
  swap a stock for crypto; downgraded.
- Sector-cap guardrail (`agentGuardrails.js:317-327`) — would push a
  sector over the user-configured cap; downgraded.

The downgrade telemetry is captured on the evaluation record as
`validationErrors`, `downgraded: true`, and `guardrailOverrides`
(`agent-evaluate.js:1162-1167`).

### Cases where the system overrides Haiku and does something else

- **Risk Manager forced exit** runs **before** Haiku (`549-590`,
  `594-673`). When `EMERGENCY_SWAP / SWAP_OUT / TRAIL_STOP` fires, the
  cron picks the bench replacement (`pickEmergencyReplacement`) and
  executes the swap unconditionally. Haiku is not consulted, and the
  trade record's `source` is `risk_manager` with the risk reason
  (`agent-evaluate.js:611-663`).
- **Guardrail forced exit** runs **after** Haiku but rewrites the
  decision (`agent-evaluate.js:892-901`). If Haiku said HOLD but a
  stop-loss is breached, the cron forces SWAP.

### Relationship between Haiku output and the final `trades[]` write

In approximate order of frequency:

- HOLD (most common): no trade write. Haiku's HOLD with rationale and
  hypothesis is written to `evaluations[]` and `statusFeed[]` only.
- Validated SWAP in autopilot mode: written to `trades[]` directly via
  `executeSwapServer`.
- Validated SWAP in copilot/manual mode: written to `pendingProposal`,
  later flowing to `trades[]` via the proposal-resolution path next
  tick(s).
- Risk-driven swap: written to `trades[]` with `evaluationMetadata`
  marking `source='risk_manager'`. Haiku's tool output is never produced
  for this trade.
- Guardrail forced swap: written to `trades[]` with
  `evaluationMetadata.exitReason = 'haiku_decision'` (note: the metadata
  is built from the rewritten `haikuResult`, so the trade record reads
  as if Haiku had decided it; the `evaluation.guardrailOverrides` field
  is the only place that reveals the override).

---

## Summary of System Shape

- **One LLM brain per tick, gated by deterministic triggers and bracketed by
  deterministic enforcers.** The cron decides whether to wake Haiku via
  hand-coded triggers, asks Haiku one question (HOLD or SWAP), then
  applies a stack of rule-based filters (guardrails, LOCK, distressed,
  validation, conviction floor) before letting the trade land. Haiku is
  central but never the sole authority.

- **Risk Manager is a parallel deterministic actor that can write trades
  on its own.** `EMERGENCY_SWAP / SWAP_OUT / TRAIL_STOP` execute swaps
  before Haiku runs, picking replacements by the simple `daily-changePercent`
  ranking. Haiku is consulted only when survival rules are silent.

- **The trade-decision prompt does not see disciplines, partner profile,
  pending lessons, or dossier inputs.** It sees identity, archetype,
  strategy brief, frozen `consolidatedInsight`, frozen `activeRules`,
  and the live battle context. The agent's evolving "mind" only re-enters
  the trade prompt indirectly via `consolidatedInsight`, which is itself
  written only on consolidation cycles (every 5 games) and frozen at the
  next battle's creation.

- **Vision is shipped scaffolding without a runtime.** The schema,
  validators, transitions, and prompt block all exist. For the
  `agentBattles` collection, no writer initializes Vision and no writer
  drives any non-`retired` transition. The only Vision write that fires
  on this collection (the `cron`-actored retire) is short-circuited
  because `prevVision` is always null. The audit's "5 of 6 lifecycle
  states unreachable" framing is generous; in practice it's 6 of 6
  unreachable for agent battles.

- **State is fanned-out across many list-shaped fields capped in size.**
  `evaluations` (150), `trades` (50), `proposalHistory` (50),
  `statusFeed` (100/50), `gameplanMeetingHistory` (uncapped),
  `chatExchanges` (uncapped), `dailyReviews` (uncapped). Most live on the
  battle doc; agent-level history (`memory[]`, `lessons[]`,
  `disciplines.*`, `evolutionTimeline`) lives on `agents/{id}` and is
  written by separate crons. The dominant write per tick is a single
  large `battleRef.update(finalUpdate)`, plus one transactional swap
  write when something traded.
