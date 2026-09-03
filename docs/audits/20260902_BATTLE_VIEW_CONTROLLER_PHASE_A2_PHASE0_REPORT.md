# Phase 0 — The Battle View controller, Phase A2 (the tape and the piece, V1)

**Date:** September 2, 2026
**Status:** READ-ONLY verification. Hard STOP at the end. No code written, no test run, no build.
**Seed:** "Phase A2 seed — the tape and the piece (V1)" (Flash, with Fable)
**Prepared by:** Claude Code, under `docs/BUILD_RULES.md`
**Predecessors:** `20260902_BATTLE_VIEW_CONTROLLER_PHASE_A_PHASE0_REPORT.md` (hazards 17–23), `PHASE0_CONTROLLER_COCKPIT_ASSIGNMENTS_DISCOVERY_V2.md` (hazards 1–16), the Phase A handover (`…_PHASE_A_HANDOVER.md`, CONSTRAINED 1–37) and both Phase A review records. All are build constraints here.

Every `file:line` below was read in this session at the HEAD named in §0 and is **VERIFIED** unless marked **ASSUMED** (inherited from a predecessor and not re-read). Fenced files (`agentRiskManager.js`, `agentGuardrails.js`, `agentEvalPromptAssembly.js`, `agentBattleService.js`, `agentSwapExecution.js`, `decide.js`) were **read to cite only**; nothing imports them from the client.

---

## 0. Preamble — git verification (BUILD_RULES §3)

| Item | Value |
|---|---|
| Branch | `claude/phase-a2-tape-piece-javcyf` (assigned by the session harness — the seed says "harness-assigned name; record it in the report") |
| HEAD SHA | `bf4bc84f1ee0ecd8f498aa35c0487c5b747b730d` = the merge of PR #810 (Phase A, `claude/battle-view-phase-a-layout-425nnm`) |
| Working tree | **Clean** (`git status --porcelain` empty) |
| `git fetch origin` | Run first, at session start. It brought five refs unrelated to this work (`ops/preflight-shell-portability`, `ops/step-minus-1-cron-quiesce`, `ui-redesign`, `ui-redesign-backup`, the tag `backup-with-research`); `origin/main` did not move. |
| `origin/main` | `bf4bc84f` — **identical to HEAD** (`git merge-base HEAD origin/main` = HEAD). The branch carries no commits of its own; this report is its first. |
| Base condition | "cut from `main` after Phase A merges" — **satisfied**: Phase A is merged (#810), the ledger reads to D-68, the Phase A handover and both review records are on `main`. |

**Why this report is a commit.** The Phase A precedent (rulings §1.3): the Phase 0 report is the branch's docs-only first commit; the build starts in a fresh session. No code, no flag, no test.

---

## 1. Executive verdict

| # | Phase 0 item | Verdict | Build implication |
|---|---|---|---|
| 1 | Tier prices from the row's proximity object | **CONSTRAINED** — the percent thresholds and the baseline are persisted and already in `enrichAsset`; the dollar level is persisted **nowhere** for an agent battle (`dailyLevels` is a V4 user-battle field) | `Bagger $ · Bust $` = `thresholdBaseline × (1 ± baseATR/100)`: one lifted field + one multiplication, the row's own arithmetic inverted. Founder rules render vs omit (§4 #1) |
| 2 | Guardrail stop persisted as a price | **NOT FOUND** (a price) · **CONSTRAINED** (a percent) — `agentRiskManager` computes in-eval and discards; `agentGuardrails` reads a percent from `agentContext.deployedGuardrails` and persists percents on the eval record | Omit `Stop $S`. The minimum write is fenced territory (§2.2) |
| 3 | The "−0.5× ATR alert" rule | **NOT FOUND** (a rule with a readable parameter) — it is the trigger gate's hard-coded price-drop wake-up; `baseATR` per position **FOUND**, persisted | Omit `Alert line $Z`; a copy request replaces it (§4 #3) |
| 4 | The plan at deploy | **FOUND** — `agentContext.strategyBrief` + `agentContext.innerMonologue` (tier rationales), Sonnet/Haiku at deploy, frozen at creation; per-position fields **NOT FOUND**; two system-string variants share the keys | Facts for D-76 (§2.4, §4 #4). Not decided here |
| 5 | Per-position `potential_exit` tags | **FOUND** (origin: the eval tool schema) · **CONSTRAINED** (persistence: only on a voice-layer exchange, only when it fired) | Not a Why? source. The minimum write is api-side, not A2 (§2.5) |
| 6 | Trade cards from the own-side swap entry | **FOUND** · **CONSTRAINED** — tier, motive and banked points are on **other** records; five swap-class feed actions exist; the chat interleaves two of them today | Card = feed entry + `trades[]` + `evaluations[]` joined on `evalId`; the motive is `rationale`, and on guardrail/risk swaps it is the system's text (§2.6, §4 #5) |
| 7 | Check cards from `evaluations[]` | **FOUND** — every field on one entry; 150 cap vs ≤ 27 slots a day | Straightforward (§2.7) |
| 8 | The bench list | **FOUND** — `portfolio.bench`, `watchlist.hotBench`, `agentContext.equippedWatchlist.tickers`, all on the subscribed doc | The chat's roster Set is the **book only** today; widen under the flag only (§2.8) |
| 9 | Scope detection utility | **FOUND** · **CONSTRAINED** — the rule is inline in a React renderer that bails without a click handler | Extract the pure rule; flag-off byte-identity provable by the chat golden (§2.9) |
| 10 | Desktop collapse in `useChatSheet` | **CONSTRAINED** — the hook can host it (state is a plain detent + a focus ref); three seams named | Recommend the hook, one visibility rule (§2.10, §4 #7) |
| 11 | Fence and ratchet | **CONFIRMED** — `src/` + the strings module + one shared Desk string + tests; nothing under `api/` | No STOP condition. The theme guards list files explicitly (§2.11) |

The three A2.0 gates (D-69 / D-70 / D-71) are verified in §3. Nine founder decisions are needed before A2.1 (§4). None is a fence STOP.

---

## 2. Findings

### 2.1 Tier prices — CONSTRAINED: the percent is persisted, the dollar is a product

**The object the row consumes.** `TacticalRow.jsx:23-31` `proximityInputs(asset)` → `{ priceChange: thresholdPriceChange ?? priceChange, baseATR, history, dailyLevels: asset.dailyLevels, currentPrice }`, computed once per side (`:68-72` standalone, `:573-578` the row) and handed to `computeProximity` (`computeProximity.js:233-250`).

**Two branches, two units.**
- The **dollar branch** `computeDollarInfo` (`:187-196`) fires only when `dailyLevels` is present: keys `baggerBomb · doubleBagger · tenBagger · bust · crash · meltdown` via `LABEL_TO_LEVEL_KEY` (`:172-179`), in **dollars** (`round2`), written by `api/cron/compute-daily-baggerbomb-levels.js:199-210` as `baseline × (1 ± m × threshold/100)` with `threshold` = the symbol's **ATR as a percent of price**.
- The **ATR branch** `formatProximityText` (`:203-216`) renders `distance` = `baseATR × m − thresholdPriceChange`, in **percent of the threshold baseline**; the multipliers are `THRESHOLDS` (`:21-30`: +1.0 / +1.5 / +2.0 / −1.0 / −1.5 / −2.0).

> **NOT FOUND — `dailyLevels` on an agent battle.** The levels cron queries `db.collection('battles').where('_v', '==', 4)` (`compute-daily-baggerbomb-levels.js:288-291`) and writes `state.dailyLevels` on **those** docs (`:347-351`); no writer under `api/` puts `dailyLevels` on `agentBattles` (repo grep: that cron is the only writer), and `enrichAsset` (`AgentBattleScreen.jsx:691-815`) does not attach it. On this screen `dollarInfo` is always null and every row renders the ATR branch. (The golden fixture's NVDA `dailyLevels` — `agentBattleScreenGoldenFixture.js:136` — exercises the label's dollar branch; it is not a doc shape.)

**What IS persisted, and already in `enrichAsset`:**
- `baseATR` = `agentBattle.scoring.thresholds[symbol].threshold` (`AgentBattleScreen.jsx:591`, `:707-708`; default `DEFAULT_THRESHOLD`) — written at creation (`agentBattleService.js:170`) from `buildThresholds` (`decide.js:1089-1096`: `threshold = baseATR`, `rallyThreshold = ×1.5`, `moonshotThreshold = ×2.0`), and stamped on every swapped-in position as `asset.baseATR` (`agentSwapExecution.js:281-287`). Unit: **percent of price**.
- `thresholdBaseline` = `swapPrice || startingPrices[symbol] || previousClose || openPrice` (`:754-757`; under fullday `isActivationDay` is true, so the entry), from which the row's `%` is `thresholdPriceChange` (`:758-760`) and its multiplier (`:766`).
- So `Bagger $ = thresholdBaseline × (1 + baseATR/100)` and `Bust $ = thresholdBaseline × (1 − baseATR/100)` — the levels cron's formula (`:199-210`) applied to the row's own baseline, and the exact inverse of the number the row shows.

> **CONSTRAINED — one field is not carried.** `thresholdBaseline` is computed inside `enrichAsset` and **not returned** (`:803-814` returns `priceChange, thresholdPriceChange, baseATR, points, badges, history, currentPrice, openPrice`), so it is not in the proximity object either. Rendering a dollar tier needs (a) that one field on the enriched asset (`src/`, one line) and (b) one multiplication the row does not make. Nothing is estimated — but the price itself is not a persisted record for an agent battle, which the seed's DO-NOT reads literally. **Decision §4 #1.**

**Not a source:** `voiceLayerCache.portfolioBriefs[].thresholdProximity` (`api/cron/voice-layer-cache.js:262-271`: `currentMultiplier, baseATR, redZone{targetThreshold, targetMultiple, direction, zoneProgressPercent}, swapLock`) carries no dollar either, and the Battle View reads no cache (rulings §3.8). The client scorer works in multiples of `baseATR` (`src/constants/baggerBombScoring.js:12, :22`) — no price in the scoring path.

**Meaning:** the game persists *where* the tiers are in percent terms and *what the baseline is*; the dollar is arithmetic on those two, never a record.

### 2.2 The guardrail stop — NOT FOUND as a price; a percent rule on the doc; the risk manager's stop is transient

**`agentRiskManager.js` (fenced — read only).** `evaluateRisk` (`:89-92`) → the priority chain: `bustBuffer = presetOverrides.bustBuffer ?? -0.85` (`:120`), `trailATR ?? 1.5` (`:122`); returns `{ action, reason, detail }` — `EMERGENCY_SWAP` (`:130`), `LOCK` (`:156`), `TRAIL_STOP` (`:167`) — with the ATR multiple only inside the `detail` string. Pure; nothing persisted by the module. The cron calls it per position (`agent-evaluate.js:1363-1371`, `presetConfig.risk` from `getPresetConfig(battle.strategyPreset || 'balanced')` `:675`), keeps `riskStatus[symbol]` (`:1372`) on `momentumData.riskStatus` (`:1382`) — a prompt input; the three sites are its only mentions. **Computed in-eval and discarded.**

**`agentGuardrails.js` (fenced — read only).** `applyGuardrails` (`:210`) reads `battle.agentContext.deployedGuardrails[]` — frozen at creation (`agentBattleService.js:190-192`) from `agentData.deployedStrategy.guardrails` (writer `src/services/deployStrategyService.js:166`, items from `dimensionsToGuardrails` `src/utils/dimensionMapper.js:1319-1359` → `{ type: 'stopLoss' | 'trailingStop' | 'maxSectorWeight' | 'maxPosition' | 'profitTarget', value, unit: '%', enforcement }`). The stop is a **percent of P&L**: `pnl <= -Math.abs(stopLoss.value)` (`:253-264`) with `pnl = (current − entry) / entry × 100` and `entry = swapPrice || portfolio.startingPrices[symbol]` (`getEntryPrice` `:686-693`, `computePnLPct` `:700-705`, both module-private); the trailing stop is a drawdown from an implied peak `entry × (1 + maxMultiplier × baseATR / 100)` (`:712-726`); the profit target honours a per-position `profitTargetOverridePct` (`targetFor` `:591-594`) that has **no writer** in the repo (the D-39 lever arc).

**What the tick persists:** `evaluation.guardrailOverrides[]` and `guardrailSourceNote` (`agent-evaluate.js:2104-2106` → `:2661-2662`) — entries `{ type, symbol, metric: 'pnlPct', threshold (a percent), actual, action, originalDecision, replacementSymbol?, note? }` (`agentGuardrails.js:275-281`, `:538-548`). Percents, on the tick the guardrail fired or noted; never a price, never per held position on a quiet tick.

> **`Stop $S` is computable, not persisted.** `entry × (1 − value/100)` from two persisted values (`deployedGuardrails[type=stopLoss].value` and the row's `openPrice`, the same `swapPrice || startingPrices` basis at `AgentBattleScreen.jsx:705`) — but the entry basis is the fenced module's private arithmetic, so a client copy is the BUILD_RULES §4 copy-of-fenced-math class. **Minimum write (one sentence, fenced territory):** export the entry basis from `agentGuardrails.js` and have the cron stamp `{ symbol, stopPrice }` per held position on the evaluation entry — a §7-gated ruling; it stops here.

**Meaning:** the user's stop lives on the battle as a percent rule; the dollar line is a derivation; the risk manager's own stop (−0.85× ATR) exists only inside one tick.

### 2.3 The ATR alert rule — NOT FOUND as a rule; it is the trigger gate's wake-up line

- **"−0.5× ATR" is the price-drop trigger:** `api/_utils/agentTriggerGate.js:41-49` — `if (score.multiplier <= -0.5)` → `{ type: 'price_drop', detail: '{sym} down X% from entry (−0.5x ATR — approaching Bust at -1.0x)' }`. A hard-coded constant. Not on `agentContext`, not a Forge rule (repo grep for `alert` in `forgeKnowledgeBase.js` / `forgeCollections.js`: 0 hits; `activeRules` items carry `params` / `paramValues`, `projectActiveRules.js:41-58`, none is this), not in the deploy record.
- **The model sees it as prose:** `agentEvalPromptAssembly.js:1190-1193` renders `TRIGGER (why you were woken up): - price_drop: {detail}`. "My −0.5× ATR alert discipline" is the model's phrase for that line. (The prompt's own 0.5x is the *bench entry* line — `:431`, `:635`.)
- **Persisted:** `evaluation.triggers = ['price_drop', …]` — types only (`agent-evaluate.js:2651`); the detail is not persisted.
- **`baseATR` per position: FOUND, persisted** — `scoring.thresholds[symbol].threshold` (`agentBattleService.js:170`; `decide.js:1089-1096`) and `asset.baseATR` on swapped-in positions (`agentSwapExecution.js:285`); the client reads it at `AgentBattleScreen.jsx:591, :708`.

> **`Alert line $Z` = `thresholdBaseline × (1 − 0.5 × baseATR/100)` is computable only by re-typing `−0.5` in `src/`** — a parallel source of `agentTriggerGate.js:43` (§9), and that module cannot be imported by the client (`:5` imports the fenced `agentScoring.js`). More to the point: it is a trigger to **evaluate**, not a rule to **act** — the gate wakes the model; the model may hold. An "alert line" on the piece would claim a discipline the system does not have. **Minimum write (one sentence, api, not A2):** persist the fired triggers' `detail` (or the threshold multiple) on the evaluation entry. **Recommendation:** omit the line; the persisted `triggers[]` types support a truthful scoreboard phrase instead (`Woken by a price drop` — a copy request, §4 #3).

### 2.4 The plan at deploy — FOUND; the facts, for D-76

| Fact | Where |
|---|---|
| Persisted on the battle | `agentContext.strategyBrief` (`agentBattleService.js:184`, from `agentData.lastDecision.strategyBrief`) and `agentContext.innerMonologue` (`:185`) = `{ strategy, starRationale, coreRationale, supportRationale, benchRationale }` (`agentToolSchema.js:91-121`). Frozen at creation, alongside `createdAt` / `activatedAt` (`:139-140`). |
| Author | A model call at deploy: **Sonnet** via `submit_strategy` (`decide.js:416` `tools: [STRATEGY_TOOL]`; `agentToolSchema.js:4-35`, `brief` `:11-15` — "market assessment, sector outlook, risk factors, how directives inform approach (~200 words)"); the tier rationales by **Haiku** via `submit_portfolio` (`:38+`, `innerMonologue` `:91-121`, "1-2 sentences" each). Persisted on the agent as `lastDecision` with `createdAt` and `models: { strategy: 'sonnet-4', portfolio: 'haiku-4.5' }` (`decide.js:665-674`). A `briefExcerpt` is also cut for the deploy ceremony (`:479`). |
| Per-position fields (role, thesis, exit triggers) | **NOT FOUND.** The rationales are per **tier**, not per position; no `thesis` / `exitTrigger` on any position (repo grep — the only `thesis` is the equipped watchlist's user-authored one, `agentPromptAssembly.js:64-65, :141`). |
| Timestamps | The battle's `activatedAt` (`agentBattleService.js:140`) is the deploy instant on the doc the client reads; `lastDecision.createdAt` (`decide.js:672`) is on the agent doc. |
| In front of the decider? | **Yes, every tick:** the brief and the tier rationales are the cacheable identity block of the eval prompt (`agentEvalPromptAssembly.js:759-771`). |
| Owner-only WHY | `PUBLIC_AGENT_CONTEXT` withholds `strategyBrief` / `innerMonologue` from non-owners (`tournamentBattleView.js:45`). The Battle View is the owner's doc. |

> **Two system-string variants share the keys (C1).** The prescribed tournament deploy writes `strategyBrief: 'Prescribed tournament deployment'` and `innerMonologue: { strategy: 'Prescribed tournament deployment — the drafted six.' }` (`decide.js:1335-1336`, `models: { strategy: null, portfolio: 'prescribed' }` `:1346`); the algorithmic fallback portfolio writes template rationales (`:1181-1187`, "Algorithmic selection based on BaggerBomb fitness scores…"). The battle doc carries no `models` field: the prescribed case is detectable by `gameMode`, the fallback case only by string match. **Not decided here** — D-76 is the founder's and Sol's. No `gameplan` plan exists: `gameplanMeeting` / `gameplanMeetingHistory` (`agentBattleService.js:260-261`) are the mid-battle meeting mechanism.

### 2.5 Per-position tags — FOUND at the origin; persisted only through the narrator, and only sometimes

- **Origin:** the eval tool schema's `anticipationCandidates[].direction ∈ { potential_entry, potential_exit }` (`agentEvalToolSchema.js:157-190`, enum `:171`) — the decider's output; prompt guidance at `agentEvalPromptAssembly.js:493-499`, `:696-702` (note the guidance's own words: "you are watching for the next session" — the forbidden verb is the tag's meaning).
- **Path:** the cron queues each candidate with its `evalId` (`agent-evaluate.js:2052-2057`) and dispatches the voice layer only when ≥ 12 s of cron budget remain (`:2853-2870` — the lowest-priority surface); Gemma writes a `chatExchanges[]` entry `messageType: 'anticipation'` with `anticipationContext: { symbol, direction, threshold, evaluationId }` (`voiceLayerAnticipation.js:190-207`, write `:219`) and `scratchpad` = Gemma's own `_scratchpad` (`:180-182`); the prompt hands it `Direction: ${candidate.direction}` (`voiceLayerPrompt.js:3571`, `:3515`). So `MSFT (potential_exit)` in "Agent Reasoning" (`LiveActivityPanel.jsx:411-417` reads `message.scratchpad`, passed from `AgentChat.jsx:532`) is the **narrator's** scratchpad echoing the decider's tag.
- **Client-readable:** on `chatExchanges[].anticipationContext` — a narration record, present only when the voice layer fired for that candidate; **not** on the evaluation entry (`:2628-2667` carries no candidates); the shadow log is GCS.

> **Minimum write (one sentence, api, not A2):** stamp the tick's `anticipationCandidates` (`symbol, direction, signalSummary, threshold`) on the evaluation entry in the non-fenced cron. Even then the tag names an intention ("watching for exit"), which the copy guard forbids on a scoreboard surface — a C1 / copy question before a data one.

### 2.6 Trade cards — FOUND; the card is three records joined, and there are five swap actions

**The own-side haiku swap entry** — `agent-evaluate.js:2588-2606`: `timestamp: now` (ISO), `message: haikuResult?.status_feed_update || null` (`:2590`), `pvpContext`, `action: 'swap' | 'hold'` (`:2592`), `regime`, `score`, `citedRules`, `citedForgeRules`, `triggeredBy`, `source: 'haiku'`, `evalId`, `symbolOut` / `symbolIn` (`:2600-2601`, null on a hold), `directiveThreadId` (`:2603`, the model's own echo — `agentEvalToolSchema.js:67-70`), `trade_reasoning`. **No `tier`, no `rationale`, no banked points on the entry.**

| The seed's field | Where it actually is |
|---|---|
| tier | `evaluations[evalId].tier` (`:2636`) or `trades[].tier` (`agentSwapExecution.js:259`) |
| the motive | `evaluations[evalId].rationale` (`:2637-2640` — required on every decision, "first person, in character, 3-5 sentences", `agentEvalToolSchema.js:10, :38-42`) and `trades[].rationale` (`evaluationMetadata.rationale = haikuResult.rationale`, `:2242`, spread onto the closed trade at `agentSwapExecution.js:270`). The entry's `message` is the **optional** `status_feed_update` (schema `:72-76`: "a 1-2 sentence status update for the battle dashboard… Omit if nothing noteworthy") — null on a SWAP is legal (`:2590`). |
| `bankedPoints` | `trades[].lockedPoints` (`agentSwapExecution.js:263`; `lockedGainPct` `:264`) |
| the join | `entry.evalId === trade.evaluationId` (`:2244`; the chat does it at `AgentChat.jsx:833`) — on the haiku path only |

**The other swap-class writers (own side):** the risk loop — `action: riskResult.action.toLowerCase()` → `emergency_swap | swap_out | trail_stop`, `message: 'Risk: {detail}'`, `source: 'risk_manager' | 'archetype'`, `evalId: null` (`:1636-1648`; its trade record's rationale is `Risk manager: {detail}`, `:1545`); the guardrail beat — `guardrail_forced_swap | guardrail_block` with `evalId` (`:2610-2623`); the R11 pass — `guardrail_forced_swap`, `evalId: null`, its trade rationale the system's `statusMessage` (`:3593-3607`, `:3522`); `proposal_system` `swap` (`:3030-3035`, `:3236-3241`, no `evalId`); `gameplan_meeting` `swap` (`:3812-3817`). `trades[]` (cap 50, `agentSwapExecution.js:354`) is the **one** list of executed swaps; the feed (cap 100 for agent battles, `:672`) is the one carrying the directive echo.

**The opponent projection** (`api/_utils/tournamentBattleView.js`): `PUBLIC_STATUSFEED` (`:58`) keeps `timestamp, message, action, regime, score, symbolOut, symbolIn` and **strips** `pvpContext, citedRules, citedForgeRules, triggeredBy, source, evalId, directiveThreadId, trade_reasoning`; `PUBLIC_TRADE` (`:61`) strips `rationale, hypothesis, trade_reasoning, snapshot, exitReason, source, evaluationId` and keeps `lockedPoints`. Note that the narration `message` is **public by the transparency contract** (`:17-24`); the rationale is not. For the Battle View this is moot: the subscribed doc is the owner's own (`useAgentBattle.js:25-31`; the owner read rule `firestore.rules:429-431` — ASSUMED from Phase A §2.1), and the CPU opponent has **no feed** on it (`opponent` is a portfolio + bench object, `agentBattleService.js:167`, built at `decide.js:890-892`). "Own side only" is structural on this screen; the projection guards a spectator surface.

**How the chat interleaves today** (`src/components/Agent/AgentChat.jsx`): `tradeEvents` (`:824-875`) filters `statusFeed` to `['swap', 'emergency_swap', 'trade_executed']` (`:826`) — so `swap_out`, `trail_stop` and `guardrail_forced_swap` never become trade lines, and `trade_executed` has no writer (repo grep) — joins `trades[]` by `evaluationId` then by symbol pair (`:829-852`), takes `message: entry.message || entry.rationale || ''` (`:861`) and `tier` / `lockedPoints` from the trade (`:868-871`). `combinedTimeline` (`:879-889`) is **one array**: `messages` (server exchanges + in-flight, `:649-652`; each exchange's `timestamp` normalised at `:502-504`) plus `tradeEvents`, **one sort** on `timestamp` ascending (`:884-888`). A trade item renders as `TradeTickerCard` (`:1037-1042`; `TradeTickerCard.jsx:41-171`: out → in · TIER · pnl% or `open` · time) beneath `↳ from directive` (`:1020-1036`). A check card joins the same stream as a third `_type` in that array — or, the seed's shape, the stream is built once in the screen and passed down; either way one array, one sort. Every timestamp involved is an ISO string today (exchange `chat.js:595`, feed `:2059`, evaluation `:2630`, trade `swappedOutAt` `agentSwapExecution.js:265`); the adapter's `toMillis` (re-exported by `deriveTurnLine.js`) is the one normaliser.

**Meaning:** the card's skeleton (time, pair, directive echo) is on the feed; its tier and banked points are on the trade; its motive is on the evaluation or the trade — and on a guardrail, risk or R11 swap that motive is the **system's** text, not the agent's.

### 2.7 Check cards — FOUND

The record, `agent-evaluate.js:2628-2667`: `evalId` (`:2629`), `timestamp: now` (`:2630`), `day`, `battlePhase`, `decision` (`:2633`), `symbolOut` / `symbolIn` (`:2634-2635` — null unless SWAP / PROPOSAL, so null on every downgraded tick), `tier` (`:2636`), `rationale` (`:2637-2640` — the placeholder strings on an outage tick), `hypothesis`, `conviction`, `riskAssessment`, `ignoredDirectiveIds`, `directiveThreadId` (`:2646`), `trade_reasoning`, `citedForgeRules`, `overriddenForgeRules`, `triggers` (`:2651`), `scores { active, banked, total }` (`:2652-2656`), `validationErrors` (`:2657`), `downgraded` (`:2658`), `marketPosture`, `guardrailOverrides` (`:2661`), `guardrailSourceNote` (`:2662`), `haikuError` (`:2667`) = `{ failureClass, message, timestamp, evalId } | null`. Appended with `.slice(-150)` (`:2710`) and written in the tick's `finalUpdate` (`:2721`) together with `statusFeed` (`:2722`). The client receives the whole doc (`useAgentBattle.js:31`).

**Cap vs cadence.** The grid is `*/15 13-21 UTC Mon–Fri` (`vercel.json:157-158`), hard-gated to regular hours (`isMarketOpen()`, `agent-evaluate.js:284-286`): at most 27 quarter-hour slots between 9:30 and 16:00 ET, and the five early-return ticks write no entry. A fullday battle sits far under 150; the cap bites only on a multi-day battle (D-14, ~5 days). The **feed** cap (100) is the tighter one for the tape — trade cards live there, checks do not.

### 2.8 The bench list — FOUND, three persisted lists on the subscribed doc

`portfolio.bench.{ stocks[], crypto }` (`agentBattleService.js:160-163`, from the deploy decision) · `watchlist.{ active, hotBench, monitoring, lastRefreshed, totalStocks }` (`:266-272`; refreshed mid-battle — `hotBench` = the rankings rebuild ∪ the equipped tickers, `agent-evaluate.js:1009-1026`, written at `:1034-1043`) · `agentContext.equippedWatchlist.{ watchlistId, name, tickers, snapshotAt }` (`:198-200`, frozen at creation). The union is a client memo under the flag.

> **The chat's roster Set is the book only.** `knownTickers` (`AgentBattleScreen.jsx:841-849`) is built from `enrichedPlayerPortfolio` — the live doc's `portfolio` under the flag (`:581-583`), the prop flag-off — and passed to both chat mounts. Bench names are **not** underlined today. Widening it flag-off would change shipped output: the golden fixture's opener names roster tickers (`agentBattleScreenGoldenFixture.js:33`) and the chat golden pins the underline spans. The union belongs under the flag (hazard 27).

### 2.9 Scope detection — FOUND; not reusable as-is, reusable after a small extraction

`src/utils/renderMessageWithEntities.jsx:17` `renderMessageWithEntities(text, onSymbolClick, knownTickers)`: regex `/\b([A-Z]{1,5})\b/g` (`:27`); a match is a ticker iff `knownTickers.has(word)` (`:32`), else a glossary term iff `TERM_TOKENS_SET.has(word)` (`:33`; `src/data/termUniverse.js:140` — 'ATR', 'RSI', 'VWAP' among the tokens), else plain text. Called from `MessageBubble` (`AgentChat.jsx:289`).

> **CONSTRAINED — it returns React nodes and bails without a handler.** `if (!text || !onSymbolClick) return text` (`:23`); the rule (word boundary, 1–5 capitals, roster membership, ticker-before-term) is inline in the renderer. **Build shape:** extract a pure `findKnownTickers(text, knownTickers) → Set` in the same module, make the renderer consume it, and prove flag-off byte-identity by a test over the same fixtures plus the chat golden (`__golden__/agentChat.tabbed.html`, which carries the opener's underlined roster tickers). The one rule then decides "this message names NVDA" for messages, trade-card text and check-card excerpts alike.

Rule caveats to **keep** (they are the shipped underline's, §9): case-sensitive (`nvda` does not match), `$NVDA` matches, a roster symbol that is also an English word ('A', 'AI', 'ALL') matches the word.

### 2.10 Desktop collapse — CONSTRAINED: the hook can host it; three seams

**The machine** (`src/screens/battleView/useChatSheet.js`): one `useState` over three ordered detents `PEEK | HALF | FULL` (`:23-29`); `setDetent(next, invoker)` (`:117-123`), `open(invoker)` → HALF unless already open (`:125-131`), `collapse()` → PEEK (`:133`), `returnFocusRef`; disabled → reads PEEK (`:140`) and **resets** to PEEK (`:135-137`). Helpers: `isSheetOpen` (`:54`), the keyboard cycle `nextDetent` through HALF (`:57`), `raise` / `lower` (`:59-61`), `detentHeightPx` (`:64`, mobile geometry), `useViewportHeight` (`:85`).

**The wiring** (`AgentBattleScreen.jsx`): `useChatSheet(controllerOn && !isDesktop)` (`:520`); `chatVisible = controllerOn && !gameTapeOpen && (isDesktop || isSheetOpen(sheet.detent))` (`:903`) drives the seen mark (`:903-913`); the desktop column mounts `{chat}` (`:1502-1514`); `listCollapsed={!isDesktop && !isSheetOpen(sheet.detent)}` (`:1196`) hides the message list at peek (`AgentChat.jsx:963`); `ChatSheet` mounts mobile-only (`:1627-1641`) as a `position: fixed` region (`ChatSheet.jsx:140`) with the turn text in its handle (`:57`, `:235`).

**Can the hook host it? Yes, with three seams.** Enable it on both shells (`useChatSheet(controllerOn)`) and read desktop as two states — PEEK = the collapsed strip, anything open = the column — driven by `open()` / `collapse()`, never the three-step cycle; `chatVisible` then becomes **one rule** (`isSheetOpen(detent)` on both shells) and the unread dot follows the mobile rule on the strip for free (the seed's ask). The seams: (1) the `enabled` reset (`:135-137`) is what returns the sheet to peek across a breakpoint crossing (guarded by `layout.jsdom` "a breakpoint crossing … brings the sheet back at peek", A4 review M20) — with the hook enabled on both shells the detent survives a crossing (desktop-open → mobile-half), so that row moves and the crossing behaviour is a choice to record; (2) `ChatSheet` is not the desktop strip — the strip is a new small component in the board column (`data-board`, `:1482`), `detentHeightPx` unused on desktop, the sheet stays mobile; (3) `open()` lands on HALF, so desktop "expanded" is HALF by name (a label, not a behaviour). The alternative — a sibling `useState` in the screen — is smaller but leaves two states expressing "the chat is open" and `chatVisible` reading both. **Recommend the hook** (§4 #7). Session persistence is React state either way — no storage, as the seed asks.

**The peek line:** `ChatSheet` already takes `turnText` and renders it in the cycle button (`:235`); the newest tape line is a second prop in the same handle row; the desktop strip renders the same two lines.

### 2.11 Fence and ratchet — CONFIRMED: `src/` + the strings module + one shared Desk string + tests

**Files A2 touches:** `src/screens/battleView/*` (new: the sentence extractor, the tape builder, the mention counter, the cards, the strip, the collapse; `battleViewCopy.js`; `selectWhyState.js` for D-69 / D-70; `WhyPanel.jsx` for V2), `src/components/Agent/AgentChat.jsx` (the tape under the flag; the card replaces `TradeTickerCard` under the flag), `src/screens/AgentBattleScreen.jsx` (the stream built once; the roster union under the flag; the collapse), `src/utils/renderMessageWithEntities.jsx` (the extracted rule), `src/components/Dashboard/desk/deskCopy.js` + `AgentDesk.render.test.jsx` (the D-71 shared string; the Desk golden row `:73`), tests. **Nothing under `api/`.** No fenced import (the fenced files above were read to cite). No archetype table. No Firestore read beyond the subscribed doc — `agentContext.deployedGuardrails`, `agentContext.strategyBrief`, `watchlist`, `portfolio.bench`, `evaluations[]`, `statusFeed[]`, `chatExchanges[]`, `trades[]` are all on it (`useAgentBattle.js:31`). No write, no model call. **No STOP condition.** The api-side minimum writes named in §2.2, §2.3 and §2.5 are recorded for separate rulings, not A2 work.

**Guards that bind:**
- `deskHonesty.test.js` scans every non-test file in `src/screens/battleView/` (`:49-61`) — a new file there is guarded on creation; `AgentChat.jsx`, `AgentBattleScreen.jsx` and `renderMessageWithEntities.jsx` are **not** under the copy guard, so every card and strip string must come from `battleViewCopy.js`. The seed's §3 strings pass the `FORBIDDEN` list (`:63-74`) by inspection.
- The theme guards **list files explicitly** (`tokens.guard.test.js:52+`, `motion.guard.test.js:57+` — 13 battleView files each, not a directory scan): a new battleView file must be added to both lists and their baselines in the same commit, or its literals are unguarded. (The A4 handover's "whole directory" describes the current file set.)
- The flag-off goldens (`__golden__/agentBattleScreen.tabbed.html`, `agentChat.tabbed.html`) pin flag-off bytes: the tape, the union and the detector extraction must leave the flag-off render byte-identical; the chat golden covers underlined roster tickers in the opener.
- Review threshold: A2 will exceed 10 files → BUILD_RULES §2 adversarial review with a written record, `vite build`, reviewer isolation.

---

## 3. The three A2.0 gates — verified at HEAD

**D-69 (non-timeout outages).** `selectWhyState.js:89-93` already branches on `haikuError.failureClass === 'timeout'`; the persisted classes are `timeout` (`agentEvalTransport.js:48-60`), an HTTP status or an error's class name, else `unknown` (`:62-64`), `budget_skipped` (`agent-evaluate.js:1971`) and `truncated_response` (`:2022`); the rationale on those ticks is the cron's placeholder (`:2637-2640`). The new string lands beside `noDecisionOutage` (`battleViewCopy.js:70`); the branch is one line.

**D-70 (a guardrail-forced swap that did not go through).** The forced path: `applyGuardrails` returns `decision: 'SWAP'`, `sourceNote: guardrail_{stopLoss | trailingStop | profitTarget}` and a `statusMessage` (`agentGuardrails.js:552-559`), with an override `{ action: 'forced_exit', symbol, replacementSymbol, threshold, actual, … }` (`:538-549`); the cron materialises it and **overwrites `rationale`** with `Guardrail override ({sourceNote}): {statusMessage}` (`agent-evaluate.js:2114-2125`, `:2121`). The downgrades that can follow: a distressed replacement (`:2150-2154` — reachable; the guardrail itself notes it, `agentGuardrails.js:547-549`), validation (`:2160-2164`), the execution throw (`:2462-2466`, the `Swap execution failed` prefix). Not reachable: the LOCK deferral (a locked breach returns passthrough with no forced swap, `:453-466`), no-bench (`:511-524`), the hurdle floor and the cap (bypassed for guardrail reasons, `:2185-2226`).

> **The persisted gate for the fifth state is three conjuncts:** `downgraded === true` ∧ `guardrailSourceNote` starts with `guardrail_` ∧ `guardrailOverrides.some(o => o.action === 'forced_exit')`. The third matters: `reinforced_haiku` (`agentGuardrails.js:468-497`) also stamps the sourceNote while the rationale stays the **agent's own** argument, so a reinforced swap that then fails must keep the existing fourth state. The pair for the label comes from the override (`symbol → replacementSymbol`) — the entry's `symbolOut / symbolIn` are null on a HOLD (`:2634-2635`). The footer names the system's reason, never "The agent's own words".

**D-71 (the turn line past the close).** `deriveDueAt` returns null once the candidate lands at or after the session close (`baggerbombAdapter.js:300-316`, the clamp `:312`), so `nextDecisionAt` is null, the late branch cannot fire (`deriveTurnLine.js:114`, `:133-137`) and **both surfaces** render `postureLive(last, null)` → `Checked {t}` (`deskCopy.js:105-109`; `deriveTurnLine.js:138-140`; `AgentDesk.jsx:86`). The discriminator already exists: LIVE ∧ `lastCheckedAt` ∧ `deriveDueAt(lastCheckedAt, marketState) === null` ⇔ past the close (a starved cron *before* the close has a non-null `dueAt`, and reads late after the grace). One source: expose that fact once (the adapter is the shared derivation both surfaces consume) rather than testing the null in two places. The Desk golden row `AgentDesk.render.test.jsx:73` pins the live string; a new row pins the new one, in the same commit.

---

## 4. Founder decisions needed before A2.1 (none is a fence STOP)

| # | Decision | Facts | Recommendation |
|---|---|---|---|
| 1 | **Tier prices.** Render `Bagger $ · Bust $` from `thresholdBaseline × (1 ± baseATR/100)` (one lifted field, the row's own arithmetic inverted, footer `from the scoring path`), or omit under the letter of "persisted". | §2.1 — the percents and the baseline are persisted; the dollar is a product; nothing estimated. | **Render** — it is the exact inverse of the number beside it and the formula the levels cron already applies to V4 battles. If the letter wins, omit; never a third source. |
| 2 | **Stop line.** | §2.2 — no persisted price; the percent's entry basis is fenced-private. | **Omit.** If wanted later: a §7 ruling to export the basis and stamp the price from the cron. |
| 3 | **Alert line.** | §2.3 — a wake-up trigger constant, not a rule; only `triggers[]` types persist. | **Omit.** Copy request instead: `Woken by a price drop` on the check card / Why? from the persisted trigger type (a scoreboard fact). |
| 4 | **D-76 — the plan at deploy.** | §2.4 — model-authored at deploy, frozen, in the decider's prompt every tick; per tier, not per position; two system-string variants share the keys. | Not mine to decide. If it may render: label with `activatedAt`, gate out tournament battles by `gameMode` and the fallback template (string match — brittle; or omit when `innerMonologue.strategy` begins `Algorithmic selection`), and never present a tier rationale as a position's. |
| 5 | **Trade-card source and motive.** Cards from `trades[]` (every executed swap, cap 50; carries tier, `lockedPoints`, `rationale`, `swappedOutAt`, `evaluationId`) joined to the feed for the directive echo — or from the feed's `swap`-class entries as the seed reads (then five actions to rule on). | §2.6 | **`trades[]` as the spine**, the feed joined by `evaluationId` for `↳ from directive`; the motive is `rationale`, labelled as the **system's** on guardrail / risk / R11 swaps (`Guardrail override (…)`, `Risk manager: …`, the R11 message) and as the agent's only on the haiku path. `message` (the status line) is optional and, on a forced swap, the model's pre-override line — never the motive. |
| 6 | **D-48 "scores" in `N checks · no change`.** | `scores.total` moves with price on nearly every tick; tiers and locks are not on the entry (`thresholdHistory` is doc-level). | "No change" = HOLD, not downgraded, not an outage, `scores.banked` unchanged, positions unchanged, and the receipts (`deriveReceipts`) unchanged. Founder to rule whether the live `total` counts. |
| 7 | **Desktop collapse home.** | §2.10 | **The hook**, enabled on both shells; record the crossing behaviour; the strip is a new component in the board column. |
| 8 | **The detector.** | §2.9, §2.8 | Extract the pure rule from `renderMessageWithEntities.jsx` (flag-off identical, golden-proven); the roster union `book ∪ bench ∪ hotBench ∪ equipped` under the flag only. |
| 9 | **Non-card feed and exchange entries in the tape.** | `hold` feed lines with a status line (`:2592`), `trade_narration` exchanges (`voiceLayerTradeNarration.js:203-210`) **and** their feed entries (`:214-222`), `anticipation` exchanges, `first_message` / `eval_degraded` / `guardrail_block` / `watchlist_refresh` feed entries. | The check card owns the tick (join `evalId`; the status line rides the card or nothing); narrations and anticipations stay messages; every other feed action renders nothing. Confirm. |

---

## 5. Hazards — 1–23 stand; eleven found here, restated for the build

24. **DO NOT** read `statusFeed.message` as the engine's motive on a `swap` entry: it is the optional `status_feed_update` (`:2590`), and on a guardrail-forced swap it is the model's **pre-override** line (the `haikuResult` spread at `:2116-2124` keeps it) with `source: 'haiku'` (`:2598`) while the pair is the guardrail's. The motive is `rationale` (§2.6).
25. **DO NOT** build a trade card from a `guardrail_forced_swap` entry alone: it is pushed whenever `guardrailStatusMessage` is set (`:2610-2623`) — before the distressed / validation / execution outcomes — so `Forcing exit → X` lands on the feed for a swap that may not have happened; the eval record's `downgraded` (`:2658`) is the truth.
26. **DO NOT** assume one swap action: `swap` (haiku, `proposal_system`, `gameplan_meeting`), `emergency_swap | swap_out | trail_stop` (the risk loop, `:1640`), `guardrail_forced_swap` (main site and R11). The shipped chat shows two of them (`AgentChat.jsx:826`); `trades[]` is the one list of executed swaps.
27. **DO NOT** widen `knownTickers` flag-off (`AgentBattleScreen.jsx:841-849`); the chat golden pins the shipped underline set.
28. **DO NOT** take `scores.total` on consecutive entries as "no change" (§4 #6).
29. **DO NOT** render `pvpContext`, `hypothesis` (a forecast — honesty rule 2), `conviction`, `trade_reasoning.indicators`, `citedRules`, `regime` on a card; `exitReason` / `source` / `triggeredBy` stay out (D-64, hazard 12).
30. **DO NOT** compute an alert line from a re-typed `−0.5` (`agentTriggerGate.js:43` is the only home); a trigger is not a rule the agent acts on.
31. **DO NOT** render `strategyBrief` / `innerMonologue` on a prescribed tournament battle or a fallback deploy without a gate (`decide.js:1335-1336`, `:1181-1187`) — system strings under the agent's name (C1).
32. **DO NOT** let a `trade_narration` exchange and its trade card read as two trades — they carry two timestamps for one event (`voiceLayerTradeNarration.js:203-210`, `tradeContext.evaluationId` is the join); the card is the record, the narration is the character's remark; its feed twin (`:214-222`, `Agent explained the latest trade.`) renders nothing.
33. **DO NOT** let a `hold` feed entry become a second card for a tick the check card already owns (join `evalId`).
34. **DO NOT** add a battleView file without adding it to both theme-guard lists (§2.11).
35. **DO NOT** join risk-loop or R11 entries to a check by `evalId` — theirs is null (`:1646`, `:3605`); they join `trades[]` by the symbol pair (the shipped fallback, `AgentChat.jsx:848-852`) and carry no check.

---

## 6. Memory discrepancy log — attached claims the repo qualifies

| # | Claim (seed) | Repo at `bf4bc84f` |
|---|---|---|
| 1 | Item 1: the row's object is "(`dailyLevels`, `thresholdHistory`, `currentPrice`)" | `dailyLevels` is never on an agent battle (§2.1); the row's ATR branch runs from `thresholdPriceChange`, `baseATR`, `history` (the merged `thresholdHistory` peaks), `currentPrice`. |
| 2 | Item 2: "a per-position stop or exit level (a price)" | Percents only: `deployedGuardrails[].value` (`unit: '%'`) and the eval record's `threshold`; the risk manager's stop is an ATR multiple inside one tick. |
| 3 | Item 3: "an active rule with a readable parameter … `projectActiveRules` output, the deploy record" | A code constant in the trigger gate; no rule, no parameter, no deploy field; the model's own wording. |
| 4 | Item 4: "`gameplan`, a brief field … per-position fields (role, thesis, exit triggers)" | `agentContext.strategyBrief` + tier-level `innerMonologue`; `gameplan*` is the meeting mechanism; no per-position plan fields. |
| 5 | Item 5: "the voice layer's scratchpad shows `MSFT (potential_exit)`" | Gemma's `_scratchpad` on an anticipation exchange, echoing the decider's `direction`; the decider's tag is persisted only inside that exchange's `anticipationContext`, and only when the voice layer fired. |
| 6 | Item 6: the swap entry carries "tier, the motive / rationale field, `bankedPoints`" | None of the three is on the entry (§2.6). |
| 7 | Item 6: "which fields the opponent projection strips (so the tape never renders an opponent's motive)" | The projection keeps the narration `message` and strips the rationale; the Battle View's doc has no opponent feed at all — own side is structural. |
| 8 | Founder smoke: "the tape carries no checks or trades" | The chat interleaves `swap` and `emergency_swap` feed entries as slim lines (`TradeTickerCard`); `swap_out`, `trail_stop` and `guardrail_forced_swap` are missing; checks are absent — true. |
| 9 | Item 7: "26 ticks a day" | ≤ 27 quarter-hour slots on the grid inside regular hours; the exact count depends on the RTH gate's close-slot handling (not re-read). Under 150 either way. |
| 10 | A2.0 D-71: "the turn line when the next slot is past the close" | Both the turn line and the Desk render `Checked {t}` there today (`deskCopy.js:109`); the discriminator exists in `deriveDueAt`'s null (§3). |
| 11 | Item 9: "the chat already underlines tickers in messages — cite the detection utility" | The utility is a renderer with the rule inline; it returns raw text without a click handler (§2.9). |
| 12 | Item 10: `useChatSheet` "host a desktop collapsed state" | Hostable; the `enabled` reset and the crossing guard are the cost (§2.10). |
| 13 | Handover item 32 / A4 review: "the whole `src/screens/battleView/` directory under both guards" | The theme guards list the 13 files explicitly; only the copy guard scans the directory (§2.11). |
| 14 | Item 8: "`agentContext.bench`" | No such field; the bench is `portfolio.bench` (`agentBattleService.js:160-163`). |

---

## 7. Bugs found outside this task — for separate tasking (BUILD_RULES §3; not fixed)

1. **A guardrail-forced swap's feed line is attributed to the model.** The `swap` entry (`agent-evaluate.js:2588-2606`) stamps `source: 'haiku'` and the model's pre-override `status_feed_update` as `message` on a swap whose pair the guardrail chose (`:2114-2125`), while the trade record says `source: 'guardrail'` (`:2237`). Two records, one event, disagreeing — the D-56 class.
2. **`guardrail_forced_swap` is announced before it happens.** The entry (`:2610-2623`) is pushed on `guardrailStatusMessage` alone; a distressed / invalid / failed replacement leaves `Forcing exit → X` on the feed (and in the Game Tape) with no swap.
3. **The shipped chat's trade filter misses three swap actions** (`AgentChat.jsx:826`): VWAP-failure exits, stepped-trail exits, forced rotations (`swap_out`, `trail_stop`) and every guardrail exit never appear as trade lines; `trade_executed` in the same list has no writer.
4. **A stale cap comment:** `agent-evaluate.js:2715` says "Cap statusFeed at 50 entries"; the cap is 100 for agent battles (`:672`). Comment only.

---

## 8. STOP

The report is written and committed as this branch's docs-only first commit, with a byte-identical copy outside the tree (the session scratchpad) offered for download. **No code was modified; no flag, pin or `DARK_BY_DESIGN` entry was added; no test suite or build was run.** The build (A2.0 → A2.2, then the founder smoke) starts in a fresh session on this branch after the founder has read §4.

*Prepared September 2, 2026 against `bf4bc84f` (= `origin/main`, Phase A merged). Every line number was read in this session; the anchors marked ASSUMED are inherited.*
