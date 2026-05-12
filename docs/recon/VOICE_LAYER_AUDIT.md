# Voice Layer Audit — FantasyTrades

**Date:** 2026-05-12
**Branch:** `claude/voice-layer-recon`
**Scope:** Read-only investigation of every conversational and narrative surface where the agent talks to the user or the user talks back. Companion to the trade-decision, Forge/Laboratory, and agent-creation recons.

---

## Intro

The Voice Layer is FantasyTrades' name for the Gemma-driven conversational stack — the system prompt assembler (`api/_utils/voiceLayerPrompt.js`), the cache cron that warms its context (`api/cron/voice-layer-cache.js`), and the endpoints that drive five distinct chat modes (battle, review, workshop, signal_expansion, watchlist_dialogue). It is the agent's mouth and ears.

It is mid-rework. The spec doc at the repo root (`VOICE_LAYER_PROMPT_CONSTRUCTION_GUIDE.md`, dated 2026-04-08, v1.0) describes a clean U-shaped attention prompt architecture with seven blocks. The codebase implements that core (1946 lines in `voiceLayerPrompt.js`) but has grown well past it: five distinct mode dispatches, four phase rule sets, a watchlist-dialogue state machine with anti-hallucination drift detection, and a per-symbol brief helper library that has seen ~25 commits in the last few weeks alone. Meanwhile, three classes of feature in the broader Voice Layer vision — proactive agent-led surfacing, the post-battle Film Room, and forge-suggestion lessons UI — are either dark (no surface), partially shipped, or replaced by something simpler.

The internal audit `docs/audits/VOICE_LAYER_TOOL_READINESS_AUDIT_PART3.md` summarized the aspirational gap in stark terms: across 15 representative agent-led / research-direction interactions the team wants to support, **zero are fully ready, 8 are partial (data exists, plumbing missing), 7 are red (capability does not exist).** That audit is the best concise statement of where the Voice Layer rework is heading; this recon is the corresponding statement of where the Voice Layer actually is.

---

## 1. Pre-Battle Conversation

**Does a pre-battle conversation surface exist in production today?** Two distinct things called "pre-battle conversation" exist; only one is what the spec calls "pre-battle gameplan."

### 1.1 WorkshopChat (pre-battle thesis development) — SHIPPED

The component the earlier Forge recon flagged — `src/components/Forge/WorkshopChat.jsx` — is a full-screen conversational shell for collaboratively developing a trading thesis with Gemma before deploying it. It is rendered from `ForgeLanding.jsx` and shows up at zIndex 300 with a side-by-side chat / thesis sidebar layout (`WorkshopChat.jsx:3-7`).

Mechanics:
- **Model:** Gemma via OpenRouter (`google/gemma-4-26b-a4b-it`) — `api/_utils/gemmaClient.js:33`.
- **Backend:** `POST /api/forge/workshop-chat` → `buildVoiceLayerPrompt({ mode: 'workshop', ... })` at `voiceLayerPrompt.js:1698-1754`.
- **Output schema:** `activeThesis` with 7 fields (summary, catalyst, instruments, entryLogic, exitLogic, riskPosture, invalidation) + confidence + readyToCompile + recommendedDurationDays. See `WORKSHOP_OUTPUT_FORMAT` at `voiceLayerPrompt.js:176-209`.
- **Budget:** 25 messages per session; rate-limited 10 req/60s per user (`workshop-chat.js:22`).
- **Persistence:** Session doc at `workshopSessions/{sessionId}`, with `latestThesis` persisted per turn.
- **Exit point:** "Compile Strategy" button calls `POST /api/forge/compile-dimensions` → produces `dimensionValues` + `recommendedDurationDays` → routes user into `SeasonEntryModal` Step 1 with sliders pre-tuned (`WorkshopChat.jsx:617-655`).

The Workshop conversation is **about building a strategy**, not about briefing the agent for an imminent battle. It produces the dimension values that configure the agent's algorithmic spine, then ends.

**`seedContext` (Sprint 5 Phase 1):** Workshop accepts a `seedContext` kind on the first turn that pre-frames the conversation:
- `kind: 'theme'` — passed from a Discover panel theme card. Carries themeId, title, thesisSummary, anchorTickers, subAngles.
- `kind: 'sector'` — passed from a Discover sector card. Carries ticker, name, regimeTag, body, anchorTickers.
- `kind: 'watchlist'` — Signal Drop V2 handoff. Carries dropListId, title, tickers with reasoning.

Validation lives at `workshop-chat.js:69-126`. The EmptyState component changes opening copy by kind (`WorkshopChat.jsx:361`). The recent commit `24c07dd feat(discover): wire theme + sector handoff to Workshop` is the live wire for theme/sector bridges.

### 1.2 GameplanMeetingCard (mid-battle pre-game-day briefing) — SHIPPED, ONE-SHOT

`src/components/Agent/GameplanMeetingCard.jsx` (169 lines) is the closest thing in the live UI to a "pre-battle agent briefing." It is **not conversational** — it is a one-shot card rendered inside `AgentActivityFeed.jsx:748` when `meeting?.status === 'pending'`. The card shows:

- **Diagnosis** — narrative read of market/portfolio state
- **Proposed Swaps** — `symbolOut → symbolIn` pairs with rationale
- **Opportunity** — longer narrative description of why now
- **Action buttons:** Approve, Reject, Modify (Modify is disabled, "coming soon" per `GameplanMeetingCard.jsx:120-164`)

On Approve/Reject, it calls `resolveGameplanMeeting(battleId, resolution)` and writes to the battle ledger. The card unmounts on next snapshot when status flips off pending.

**Important:** this is rendered DURING a battle (inside the activity feed), not before. It is more accurately a "morning briefing" surface than a "pre-battle gameplan." There is no surface where the user has an actual back-and-forth chat with their agent before the battle starts.

### 1.3 Is WorkshopChat the same as a "pre-battle gameplan"?

No. WorkshopChat is **pre-battle thesis development for the Forge / Proving Ground**. It produces strategy dimensions, not a battle gameplan. After compilation, the user lands in SeasonEntryModal to actually deploy. The agent in WorkshopChat is the same identity that will eventually trade (`agent.name`, `agent.archetype` are passed in), but the conversation is about designing the rules — not briefing the rules' next outing.

The earlier recon was correct to flag WorkshopChat as a Voice Layer surface; it is the only multi-turn pre-battle chat that exists. A "pre-battle gameplan" in the sense of "let's talk through today's setup before tip-off" does not exist as a conversational surface today.

### 1.4 What context is fed to Workshop mode?

Per `voiceLayerPrompt.js:1697-1754`, the workshop prompt assembles:
- Identity (agent name/archetype/W-L)
- `WORKSHOP_OUTPUT_FORMAT` (JSON schema)
- Partner model (15-dimension `partnerProfile` rendered as known/unknown lists — `buildPartnerModelBlock`, lines 851-871)
- Convictions + consolidatedInsight (`buildConvictionsBlock`, lines 873-895)
- DRB anchor (when present — Workshop omits it on weekends / stale-DRB days)
- Workshop context (the seedContext block, if any)
- `WORKSHOP_REFERENCE` — full rule palette (entry/exit/sizing rules + backtest duration guidance, lines 252-307)
- Workshop few-shot examples (3 examples — expert-builder, timeframe-ask, compile-ready, lines 309-323)
- `WORKSHOP_PHASE_RULES` (lines 211-243)

There is **no market data block** (no portfolioBriefs, no scoutAlerts, no battle state) in workshop mode — there is no active battle to brief on. The model gets the agent's partner read, accumulated wisdom, and today's regime; that is all.

---

## 2. Mid-Battle Conversation

The primary live conversation surface during a battle.

### 2.1 AgentChat — the working surface

`src/components/Agent/AgentChat.jsx` (1113 lines) is the canonical mid-battle conversation component. It is rendered in `AgentBattleScreen.jsx:894` inside a tab labeled "Command Center" (one of three tabs: Matchups | Command Center | Game Tape, defined at `AgentBattleScreen.jsx:53-54`).

Layout:
- **Desktop:** flex row with AgentChat left + LiveActivityPanel right (380px fixed).
- **Mobile:** tabbed (Chat | Live Activity).

User interaction:
- Free-form textarea input, 2000 char cap, auto-resize to 120px.
- Send button.
- Optimistic user bubble → typing indicator → server response replaces typing indicator (`AgentChat.jsx:520-604`).
- Agent message bubbles render inline ticker linkification (regex `/\b([A-Z]{1,5})\b/g` with `EXCLUDED_WORDS`, lines 159-169) so tickers are tappable.
- Up to 3 `suggestedActions` chips render below the LAST agent message when not sending (`AgentChat.jsx:882`).
- Directive extraction: when `hasDirective=true`, an `ExecutionCard` renders with the directive text, a pulsing dot, and "Executing on next evaluation window" footer. **There is no approve / reject button — directives are auto-accepted on the model's extraction.** (`AgentChat.jsx:83-154, 291-299`)

### 2.2 API contract: POST /api/agent/chat

`api/agent/chat.js` (493 lines). Single endpoint, two modes auto-detected server-side.

**Mode detection** (`chat.js:85-120`):
- Polls `getMarketState()` at request time.
- If market is in a `CLOSED_*` state AND battle has today's `dailyReviews[]` entry from within the last 20 hours → mode = `'review'`.
- Otherwise → mode = `'battle'`.

**Budget enforcement** (`chat.js:122-125, 196-210`):
```javascript
const MODE_BUDGET = {
  battle: { field: 'chatBudgetUsed', limit: 10 },
  review: { field: 'reviewBudgetUsed', limit: 5 },
};
```
Each mode has its own counter on the battle doc. Exhaustion returns 429 / 403 with a friendly message.

**Request payload:**
```json
{ "agentId": "...", "battleId": "...", "message": "..." }
```

**Response payload (success):**
```json
{
  "agentMessage": "string",
  "extractedRule": { "text": "...", "directiveThreadId": "uuid" } | null,
  "suggestedActions": ["..."] | null,
  "exchangeNumber": 5,
  "budgetTotal": 10,
  "scratchpad": "string" | null,
  "hasDirective": true,
  "directive": { "text": "...", "directiveThreadId": "uuid" } | null,
  "lesson": { "id": "...", "text": "..." } | null,
  "forgeSuggestion": { "id": "...", "text": "..." } | null,
  "mode": "battle" | "review"
}
```

### 2.3 Context fed to mid-battle chat

Per `chat.js:182-262`, the prompt build pulls in parallel:
1. Agent doc (`agents/{agentId}`)
2. Battle doc (`agentBattles/{battleId}`) — current portfolio, score, statusFeed, proposalHistory, dailyReviews, chatExchanges
3. Daily Regime Brief (DRB) — built nightly by `compute-daily-regime-brief` cron
4. **voiceLayerCache** — pre-cached portfolioBriefs, benchBriefs, scoutAlerts, marketContext (see §4)
5. Elicitation target — server picks the lowest-confidence dimension in `partnerProfile` not used in the last 3 turns
6. Last 10 conversation exchanges from `battle.chatExchanges[]`

All of this feeds `buildVoiceLayerPrompt({ mode: 'battle', ... })`. The assembly is described in §5.

### 2.4 Can the agent propose directives during conversation? Yes — and they're auto-accepted

Directives emit when the model returns `hasDirective: true` with a `directive` object containing `text` + `expiry` (`end_of_battle` | `3_games` | `permanent`). The server normalizes via `normalizeDirective(parsed)` at `chat.js:329`. The directive is written to `agentBattles.directive` with a generated `directiveThreadId` UUID (`chat.js:426-433`).

The `directiveThreadId` is the linkage used downstream: Haiku's eval tool stamps it on `statusFeed` entries when it acts on the directive, and the frontend renders "↳ from directive" indicators on trade cards.

**There is no user-facing accept/reject step in AgentChat.** The ExecutionCard is presentational. The user's only mechanism to "reject" is to send a follow-up message overriding the direction — at which point the *next* turn writes a new directive that supersedes.

There is one place where directives ARE gated by user approval: `OpenChatPanel.jsx:192-228`. That component DOES show Accept/Dismiss buttons on a `Proposed Rule` block. **However, OpenChatPanel is no longer rendered in the live app** — its only consumer is `AgentStrategyTab.ARCHIVED.jsx:13,209`, which itself is archived. The accept/reject flow lives in dead code. (See §9.4.)

### 2.5 Does the agent narrate trades after making them?

No conversational narration. When Haiku executes a swap during `agent-evaluate` cron, the trade is written to:
- `agentBattles.statusFeed[]` — a typed event with action/symbolOut/symbolIn/rationale
- `agentBattles.trades[]` — the executed trade record
- Notification queue via `baggerBombNotificationService` (typed UX events, not narrative)
- Commentary engine (`commentaryService.js`) — generates flavored narration ONLY for scoring events (BaggerBombs, busts, lead changes), not for the trade itself

The user sees the trade in `LiveActivityPanel`'s breakthrough alerts strip and/or the full `AgentActivityFeed`, but the agent does not message into AgentChat saying "I made the swap." Mid-battle conversation is strictly user-initiated.

The closest thing to narrated commentary is the auto-debrief that lands at end-of-day (see §6.2).

### 2.6 Tappable inline tickers + inline trade notifications

Inline ticker linkification: AgentChat.jsx detects 1-5 letter uppercase tokens in agent messages and renders them as tappable, calling `onSymbolClick` (`AgentChat.jsx:159-169, 191-301`). This corresponds to the spec's "tappable tickers."

"Inline trade notifications" referenced in user spec: the timeline at `AgentChat.jsx:710-720` merges `chatExchanges` with trade events from `statusFeed` so trades render chronologically interleaved with chat messages. This is the "inline trade notifications" surface — trades from the feed appear in the chat timeline view. It is shipped.

### 2.7 What model handles mid-battle conversation?

Gemma — specifically `google/gemma-4-26b-a4b-it` via OpenRouter (`gemmaClient.js:32-33`). 15s abort timeout. JSON-mode response (`response_format: { type: 'json_object' }`).

**Retry behavior** (`gemmaClient.js:153-227`):
- `callGemmaVoiceWithRetry` does one retry on transient errors (HTTP 429/500/502/503/504 or network failures). MAX_ATTEMPTS=2. RETRY_BACKOFF_MS=2000.
- Returns structured `{ success, content, error, fallbackResponse, aborted }` shape — never throws on transient failure.
- There is no fallback to a different model (no Haiku, no Sonnet downgrade). If Gemma fails, the user sees a 502 banner.

**Four-tier JSON parsing** (`gemmaClient.js:273-315`):
1. Direct `JSON.parse(rawText)`
2. Extract triple-backtick JSON fence
3. Extract first `{...}` via regex
4. Plaintext passthrough → returns `{ parseError: true, errorReason: 'plaintext_passthrough' | 'empty_content', rawText }` (line 310-314)

Tier-4 plaintext is treated as a parse failure (`chat.js:283-321`) — the user gets a 502 banner rather than the raw text. Recent commit `ce3e2e7 fix(voice-layer): treat tier-4 plaintext passthrough as parse failure` wired this defense. Failed responses are captured to shadow logs with full context for production debugging.

---

## 3. Agent-Initiated Moments

What the agent surfaces proactively, without the user opening chat.

### 3.1 "AGENT SAYS" sidebar speech bubble — STATIC, NOT DYNAMIC

`src/components/Agent/AgentSidebar.jsx:174-194` renders an italicized speech bubble labeled "AGENT SAYS" above the agent's stats card. The text source is **not** Firestore-dynamic; it is computed client-side in `useAgent.js:73-91` from `agent.maturityStage`:

```javascript
switch (maturityStage) {
  case 'fresh':
    return "First time in the arena. I've studied the playbook — let's see what I'm made of.";
  case 'growing': {
    const lastMemory = agent.memory?.[agent.memory.length - 1];
    return lastMemory
      ? `Last game: ${lastMemory.result === 'win' ? 'won' : 'lost'}. ${lastMemory.lesson}`
      : "I'm learning. Each game teaches me something new.";
  }
  case 'maturing':
    return "I've seen this setup before. Going with my playbook.";
  case 'veteran':
    return 'Ready.';
}
```

This means:
- The bubble updates **between battles** when `agent.memory` or maturity changes
- It does NOT update mid-battle
- It is NOT authored by Gemma or any consolidation process — it is local hand-written copy keyed on a derived stage
- The "growing" variant interpolates the last memory's lesson, which IS dynamic per game — but the wrapper is static

The bubble is intentionally a static stage marker, not a Voice Layer surface. The Voice Layer's actual outputs go to AgentChat / Activity Feed / chatExchanges, not to this bubble.

### 3.2 Trade notifications / toasts

The agent acts during a battle (via `agent-evaluate` cron every 15 min). When it acts, three surfaces light up:

1. **`statusFeed[]` entries** (typed events — `trade_executed`, `threshold_event`, `risk_alert`, `gameplan_meeting`, `lock`, `hypothesis_resolved`). Tier classification at `AgentActivityFeed.jsx:63-100`.
2. **`baggerBombNotificationService` notifications** (`src/services/baggerBombNotificationService.js:14-56`) — typed UX notifications with icons/colors. Cached in localStorage with dedup. Types: `breakout`, `bust`, `crash`, `session_win`, `battle_lead_change`, `swap_executed`, `opponent_breakout`, etc.
3. **Commentary** (`src/services/commentaryService.js`) — flavored narration produced by a separate ClashCast `/api/battle-commentary` endpoint, ONLY for scoring events: BaggerBombs, Doubles, Crashes, Lead Changes, Substitutions. Fallback templates live at `commentaryService.js:29-42`. Approaching/redzone events are **explicitly excluded** from commentary (`commentaryService.js:180-184`).

So when the agent makes a trade, the user gets a typed event (no narration) in the feed; when a scoring event happens, the user gets a flavored line. The agent itself does not "say anything" — narration is post-hoc, generated by a separate system.

### 3.3 Anticipation / "I'm watching X for Y" moments

These do not exist as proactive surfaces. The codebase **detects** threshold proximity (red-zone detection at `src/utils/baggerBombUtils.js:182-232`, lock detection at lines 244-278). It surfaces them visually via `ChamberFuse.jsx` (a bidirectional gauge). It also includes a structured `thresholdProximity` field per portfolio brief in the voice-layer-cache (`voice-layer-cache.js:90-100` notes). But there is no path from "approaching threshold" to "the agent sends a message about it."

The Voice Layer Tool Readiness audit (Part 1 Request 2) confirms this: *"Quantitative threshold proximity → Exists, partially exposed... Proactive surfacing → Doesn't exist."* The architectural gap is acknowledged as Tier 11 priority — *"Largest architectural build. Blocks every agent-led request mode."* See `docs/audits/VOICE_LAYER_TOOL_READINESS_AUDIT_PART3.md:49`.

### 3.4 LiveActivityPanel — quiet sidebar surface

`src/components/Agent/LiveActivityPanel.jsx` (516 lines). Three stacked sections (`LiveActivityPanel.jsx:94-485`):

- **AgentStatusIndicator** — pulsing teal dot + crossfade status text (extracted from latest `statusFeed` entry message, truncated 80 chars). Pulses only when agent active; falls back to "Standing by."
- **BreakthroughAlerts** — compact alert cards for 5 event types (`risk_alert`, `threshold_event`, `gameplan_meeting`, `lock`, `hypothesis_resolved`). Max 3 visible, auto-dismiss 60s.
- **Agent Reasoning** — collapsible, shows `ScratchpadCard`s from chat scratchpads.

This is a passive read of the same `statusFeed` that AgentActivityFeed shows, filtered to high-tier types only. It's the "ambient" Voice Layer surface — the user can see the agent is "thinking" without opening chat.

### 3.5 Scheduled / cron-driven messages

Three crons feed agent-initiated content:
- `voice-layer-cache` (every 15min during market hours) — warms cache; does NOT message the user.
- `agent-evaluate` (every 15min during market hours) — runs trade evaluation; writes statusFeed entries the user sees.
- `agent-batch-review` (4:25 / 5:25 PM ET weekdays — `vercel.json:146-148`) — generates today's daily review AND injects an auto-debrief message into `chatExchanges[]` (see §6.2).

The auto-debrief is the **only** truly agent-initiated conversational message in the system. It lands once per trading day, after market close, in the chat history of any active battle. The user sees an amber "📋 Post-Market Debrief" line when they next open AgentChat (`AgentChat.jsx:248-264`).

There is no proactive in-market push, no live signal-drop cron pushing messages, no session-opener mechanism.

---

## 4. Voice Layer Cache / Context Infrastructure

`api/cron/voice-layer-cache.js` (719 lines). The pre-computed context layer that feeds every Voice Layer prompt.

### 4.1 What does the cron produce?

Per the writer block at `voice-layer-cache.js:680-697`, the cache doc at `voiceLayerCache/{battleId}` contains:

```javascript
{
  battleId,
  agentId,
  portfolioBriefs: [...],   // per-symbol enriched briefs (active positions)
  benchBriefs: [...],       // per-symbol enriched briefs (bench)
  scoutAlerts: [...],       // watchlist opportunities, filtered by archetype
  marketContext: {...},     // regime, breadth, sectors, leadership, divergence
  dataFreshness: {
    prices: 'rest_15min',
    technicals: 'daily',
    rankings: 'daily',
    marketContext: 'daily',
  },
  forgeSeeds: null,         // placeholder — see §4.5
  updatedAt: <serverTimestamp>,
}
```

**portfolioBriefs** — for each Star/Core/Support holding, a brief carrying:
- Tier, change%, technical score + rank in sector
- ATR%, RS percentile, near support/resistance/52w-high distances
- MACD fresh-cross flags, divergence direction, NR7 contraction, lastCandlePattern
- **thresholdProximity** sub-field (Tier 0 wrapper, `voice-layer-cache.js:90-100`) — exposes `detectRedZone` + `isSwapLocked` output
- **intradayMomentum** — VWAP, 5m-SMA20 (added by commit `b719f03 feat(voice-layer): wire intraday momentum (VWAP, 5m-SMA20) into cache`)

The per-symbol line helpers that render briefs into prompt text live in `voiceLayerPrompt.js:949-1130` — `buildHeaderLine`, `buildLevelsLine`, `buildSignalsLine`, `buildIntradayLine`. They are the locus of intense recent activity (~15 commits in the last sprint touching brief rendering).

**scoutAlerts** — pulled from `battle.watchlist.active` symbols + universe rankings. Three alert types fire (`voice-layer-cache.js:466-502`): `rs_breakout` (RS percentile ≥85 + technicalScore ≥75), `volume_surge` (volumeConfirmation ≥10), `game_fit` (baggerBombFit ≥85 + baggerBombRank ≤15). Capped at 5. Filtered by archetype relevance (`momentum_chaser`, `all`, etc.).

**marketContext** — built by `buildMarketContextBlock` (`voice-layer-cache.js:518-560`) from the `indexIntelligence/marketContext` Firestore doc. Carries: regime, regimeDetail, spy change%, volatilityRegime, breadth tier + detail, topSector + worstSector + their changes, yieldRegime, leadership signal, divergence signal, breadth quality signal, SPY-vs-RSP gap.

Note: `vixLevel` is **always null** — `"No VIX data in codebase — volatilityRegime used as proxy"` (`voice-layer-cache.js:544`). This is despite the spec describing a "Volatility: Low (VIX below 15…)" block.

### 4.2 When does it run?

Schedule (`vercel.json:141-144`): `*/15 13,14,15,16,17,18,19,20 * * 1-5` — every 15 minutes between 13:00–20:59 UTC (≈9:00 AM–5:00 PM ET) on weekdays. Time-guarded server-side: bails when market state is not `OPEN` or `PRE_MARKET` (`voice-layer-cache.js:577-580`).

It does NOT run after-hours, on weekends, or on market holidays. This means review mode (post-market) operates on the **last cache write of the trading day** — typically the 4:00–4:15 PM ET tick — and gets stale over the evening and weekend. The cache is intentionally a live-day artifact.

### 4.3 Who consumes the cache?

`api/agent/chat.js:216-233` reads `voiceLayerCache/{battleId}` and passes the result as `marketSnapshot` into `buildVoiceLayerPrompt()`. The same applies to workshop / signal-expansion / watchlist-dialogue endpoints (Sprint 5+ added direct cache reads).

The cache also implicitly fees the AgentActivityFeed via the `thresholdProximity` exposure (the gauge component consumes the brief data path), but it does not surface to UI directly — the cache is a server-side context object, not a client-readable feed.

### 4.4 What inputs does the cron consume?

`voice-layer-cache.js:592-657` — for every active battle:
1. Collects all unique symbols across portfolios + watchlist + bench
2. EODHD bulk price fetch (REST, 20-symbol batches, 200ms inter-batch rate-limit)
3. Firestore parallel reads: `indexIntelligence/marketContext`, `indexIntelligence/stockRankings`, `stockTechnicalScores/{symbol}` for each symbol
4. Builds rankings + tech-scores maps, then iterates each battle to build per-battle cache

Bench crypto symbols are explicitly skipped from EODHD (no US-equity resolution) and degrade gracefully to bench briefs without technicals (`voice-layer-cache.js:619-625`).

### 4.5 "Forge Agent integration with voiceLayerCache: do not connect until Forge has 7+ days of reliable runs"

The cache schema includes a `forgeSeeds: null` placeholder field at `voice-layer-cache.js:695`. This is the slot reserved for the Forge integration the userMemories reference. As of the recon, `forgeSeeds` is hard-coded null and no writer populates it. The integration is wired-for but not connected, matching the directive to not turn it on until the Forge runs are stable.

There is no evidence in the code of an active throttle / feature flag — it is simpler than that: the cache writes null, the prompt assembler doesn't consume the field, and no Forge cron writes into the slot. When the gate opens, a single PR will populate `forgeSeeds` and the prompt assembler will read it.

### 4.6 Cache vs. spec

The spec doc's `marketSnapshot` shape (`VOICE_LAYER_PROMPT_CONSTRUCTION_GUIDE.md:22-29`) calls for:
- regime, vixState, broadTrend (anchor data)
- portfolioBriefs[]
- scoutAlerts[]
- relevantPatterns[] (DKB Semantic RAG matches)
- tacticalContext{} (DKB State-Triggered content)
- dataFreshness{}

**Comparison with reality:**
- `regime`, `broadTrend`, `volatilityRegime` (proxy for vixState) — ✅ present in `marketContext`
- `portfolioBriefs[]` — ✅ shipped, much richer than spec (intraday momentum, threshold proximity, levels, signals lines)
- `scoutAlerts[]` — ✅ shipped, archetype-filtered
- `relevantPatterns[]` (semantic RAG) — ❌ not implemented. No semantic RAG layer in the prompt or the cache.
- `tacticalContext{}` (state-triggered) — ⚠️ partial. Time-of-day microstructure logic is described in the spec (`buildStateTrigger`) but does not appear in either the cache or `voiceLayerPrompt.js`. Game-theory urgency IS exposed: `computeGameContext(battle)` derives `gameState` + `urgency` and is injected into the battle state block (`voiceLayerPrompt.js:920, 927-928`).
- `dataFreshness{}` — ✅ shipped, simpler than spec (4 keys, all string-tagged).

DKB blocks 3.6 (state-triggered) and 3.7 (semantic RAG) and 3.8 (external article) from the spec are partially present at best:
- **3.6 (state-triggered)** — game-state/urgency exists; time-of-day microstructure rules from the spec do not.
- **3.7 (semantic RAG)** — does not exist.
- **3.8 (external article)** — does not exist. URL detection / `detectExternalIntelligence` is not implemented in the live prompt path. Signal Drop V2 (separate surface) handles user-shared content, not in-battle URL pasting.

---

## 5. Voice Layer Prompt Construction

`api/_utils/voiceLayerPrompt.js` (1946 lines). The function name is `buildVoiceLayerPrompt` (`voiceLayerPrompt.js:1608-1945`). It is one function with five mode dispatches.

### 5.1 Modes

```javascript
buildVoiceLayerPrompt({ mode, ... })
// mode in: 'battle' (default) | 'review' | 'workshop' | 'signal_expansion' | 'watchlist_dialogue'
```

Each mode has its own block assembly. Modes do not share much — only Block 1 (identity), Block 2 (partner model), Block 3 (convictions), Block 3.5 (DRB anchor), and the DATA_CONFIDENCE_RULE block are reused across modes.

### 5.2 Battle mode block layout (the spec's canonical case)

Final assembly at `voiceLayerPrompt.js:1922-1944`:

```
TOP — HIGH ATTENTION
├── Block 1: Identity                  (line 1881-1886)
├── Block 1.5: GAME_MECHANICS          (line 13-18, constant)
├── Block 7: OUTPUT_FORMAT             (line 20-48, constant)
│
MIDDLE — LOW ATTENTION (reference)
├── Block 2: Partner Model             (buildPartnerModelBlock, 851-871)
├── Block 3: Convictions + Wisdom      (buildConvictionsBlock, 873-895)
├── Block 3.5: DRB Anchor              (anchorContext arg)
├── Block 4A: Portfolio Briefs         (buildPortfolioBriefsBlock)
├── Block 4A-bench: Bench Briefs       (buildBenchBriefsBlock)
├── Block 4B: Scout Alerts             (buildScoutAlertsBlock)
├── Block 4C: Market Context           (buildMarketSnapshotContext)
├── DATA_CONFIDENCE_RULE               (conditional — only when marketSnapshot present)
│
BOTTOM — HIGH ATTENTION (active state)
├── Block 5: Battle State              (buildBattleState, 897-930)
├── Few-Shot                           (PHASE_EXAMPLES[phase] + CONFIRMATION_EXAMPLE)
├── Elicitation Target                 ("ELICITATION TARGET (internal — do not mention this to the user)")
└── Block 6: Phase Rules               (PHASE_RULES[phase] — Discovery|Refinement|Mastery)
```

This matches the spec's U-shaped attention ordering. The differences:
- The spec's "Block 3.6 (DKB State-Triggered)" is **not present** as an explicit block. Game-state/urgency is folded into Block 5 (battle state).
- The spec's "Block 3.7 (DKB Semantic RAG)" is **not present**.
- The spec's "Block 3.8 (External Article)" is **not present** in battle mode. Article detection is not implemented.
- The shipped code adds `DATA_CONFIDENCE_RULE` as an explicit block (added/refined in commits `243a11c`, `9e5f479`, `b36f15b`), which the spec didn't have.

### 5.3 Phase rules (Discovery / Refinement / Mastery)

`getAgentPhase(gamesPlayed)` at `voiceLayerPrompt.js:845-849`:
- `gamesPlayed ≤ 10` → `'discovery'`
- `gamesPlayed ≤ 30` → `'refinement'`
- otherwise → `'mastery'`

Phase rules live in three constants — `DISCOVERY_RULES`, `REFINEMENT_RULES`, `MASTERY_RULES` (lines 52-149). Each has BEHAVIORAL RULES + NEGATIVE CONSTRAINTS + TONE + CONVICTION HANDLING + DATA CONFIDENCE.

Phase examples (few-shots) at lines 153-162 — one per phase. All three are loaded via `PHASE_EXAMPLES[phase]`.

A `CONFIRMATION_EXAMPLE` (line 164-166) is appended to every phase's few-shot. This was added in the recent rework — the spec doesn't have it. It teaches the model the "CONFIRMATION → EXECUTION" pattern that is now the **highest priority rule** in every phase (added to each phase rule block as bullet #1, lines 56, 93, 125).

### 5.4 Other mode dispatches

**Workshop mode** (`voiceLayerPrompt.js:1697-1754`): identity + WORKSHOP_OUTPUT_FORMAT + partner model + convictions + DRB anchor (conditional) + workshop context block + WORKSHOP_REFERENCE (rule palette + duration guidance) + WORKSHOP_FEW_SHOT + WORKSHOP_PHASE_RULES.

**Review mode** (`voiceLayerPrompt.js:1636-1694`): identity + GAME_MECHANICS + OUTPUT_FORMAT + partner model + convictions + DRB anchor + (conditional market snapshot blocks) + DATA_CONFIDENCE_RULE + Review Context block (yesterday's grades, counterfactuals, directive outcomes) + REVIEW_FEW_SHOT + REVIEW_PHASE_RULES. The Review Context block (`buildReviewContext`, lines around 1450-1540) is unique: it injects vetoed/lapsed proposal counterfactuals, user trade grades, and live-directive outcomes (whether the agent's directives paid off).

**Signal Expansion mode** (`voiceLayerPrompt.js:1758-1802`): one-shot expansion of a parse-signal result into thesisSummary + relatedTickers + invalidationConditions + suggestedWatchlistName. No conversation history, no live battle. Called from `api/forge/expand-signal.js`.

**Watchlist Dialogue mode** (`voiceLayerPrompt.js:1806-1878`): phased dialogue (explore → propose → refine → finalize) with server-tracked phase, candidate ticker state, watchlist anatomy (thesis + activation + invalidation conditions), and anti-hallucination drift detection (Phase 3.8). Called from `api/forge/watchlist-dialogue.js`. This is the most architecturally elaborate mode by far.

### 5.5 Output schema

The battle-mode `OUTPUT_FORMAT` (lines 20-48) requires JSON with:
- `_scratchpad` — internal reasoning, logged but not shown
- `response` — conversational message
- `hasDirective` — bool
- `directive` — `{ text, expiry }` or null (`end_of_battle` | `3_games` | `permanent`)
- `suggestedActions` — array of up to 3 strings, or null
- `_lesson` — REVIEW MODE ONLY, `{ text, sourceTrade }`
- `_forgeSuggestion` — REVIEW MODE ONLY, `{ text, sourceTrade }`

Critical rule (line 45): *"_lesson and _forgeSuggestion are REVIEW MODE ONLY. In battle mode and workshop mode they MUST be null."* The chat handler strips these defensively in battle mode (`chat.js:328-329`).

### 5.6 Elicitation target

`chat.js:238-242` selects the lowest-confidence dimension in `agent.partnerProfile` not in `battle.recentElicitationTargets` (last 3). 15 dimensions are tracked (`voiceLayerPrompt.js:817-834`): `risk_appetite`, `concentration_tolerance`, `sector_convictions`, `loss_reaction`, `win_reaction`, `tier_philosophy`, `momentum_vs_value`, `news_sensitivity`, `time_of_day_preference`, `macro_awareness`, `communication_frequency`, `autonomy_preference`, `feedback_style`, `competitive_focus`, `learning_orientation`.

The dimension is injected as an instruction at the bottom of the prompt:
```
ELICITATION TARGET (internal — do not mention this to the user):
{instruction text}
```

Instructions per dimension are not defined in `voiceLayerPrompt.js` (the spec defined them in `selectElicitationTarget` at `VOICE_LAYER_PROMPT_CONSTRUCTION_GUIDE.md:611-651`). The live code passes the instruction in via the `elicitationTarget` argument; the selection helper lives at the chat.js call site.

### 5.7 Scratchpad concept

The Forge recon noted an `activeThesis` "scratchpad" pattern. The Voice Layer's equivalent is the `_scratchpad` field at the top of every JSON response. It is the model's internal reasoning, logged to shadow logs (`chat.js:375-395`) and not shown to the user. AgentChat surfaces it in the LiveActivityPanel's collapsible Agent Reasoning section (`LiveActivityPanel.jsx:431-485`) — so it IS user-visible if the user expands the panel, but not as the main response surface.

The `activeThesis` working-memory pattern that Workshop mode uses is similar in spirit but explicitly structured (7 fields, persisted per turn on the session doc). Battle mode has no equivalent persisted working memory beyond the chat history itself.

### 5.8 Token budget instrumentation

There is no live token budget enforcement in `voiceLayerPrompt.js` or `chat.js`. The spec's table (lines 692-715) names a max of ~9,905 tokens with article + history; the live code does not measure or cap. Conversation history is hard-trimmed to last 10 exchanges at `chat.js:244-249`, which is the only explicit budget control.

---

## 6. Post-Battle / Film Room

### 6.1 Film Room — replaced

The user spec mentions a Film Room concept. In the codebase today:

- `src/components/Agent/AgentFilmRoom.ARCHIVED.jsx` — archived. Previously a tab combining day summary + bookmarked entries + raw activity log.
- `src/components/Agent/FilmRoomCard.ARCHIVED.jsx` — archived. Previously a collapsible widget showing daily review + proposed rules with Accept/Reject buttons that wrote to `agent.directives[]`.
- `src/components/Agent/AgentStrategyTab.ARCHIVED.jsx` — archived. Previously the parent tab that rendered Film Room + Open Chat + Gameplan + status feed.

These were replaced as of the V3 redesign documented at `COMMAND_CENTER_FILM_ROOM_REDESIGN_QUICK_REFERENCE_V3.md`. The replacement is:

- **Game Tape tab** (third tab in AgentBattleScreen) — pure data view. `src/components/Agent/GameTapeView.jsx` (832 lines). Shows: Day Summary Card (from `dailyReviews[]`), Trade History (sortable by Time / P&L / Tier), Bookmarked Entries, Full Activity Log (collapsible).
- **Command Center tab** — chat + activity feed integrated. The auto-debrief + grade cards live here, not on a separate Film Room tab.

V3 audit (`COMMAND_CENTER_FILM_ROOM_REDESIGN_QUICK_REFERENCE_V3.md:199`): *"Audit completed at Phase 3/rework boundary. Clear for Phase 4."* Phases 1-3 of the redesign are shipped; Phase 4+ (directive philosophy migration, review mode backend, inline grading, directive threading, trade reasoning structure) is the active work. V3 is **live spec, not aspirational**.

### 6.2 Post-battle agent conversation — review mode + auto-debrief

When the market closes and `agent-batch-review` cron runs, the post-battle surface comes online:

**`agent-batch-review` cron** (`api/cron/agent-batch-review.js`, schedule `25 20,21 * * 1-5` per vercel.json — 4:25 PM and 5:25 PM ET weekdays). For each active battle:

1. Filter today's trades + evals + vetoes + debates
2. Call Haiku (`claude-haiku-4-5-20251001`) with tool use to generate structured review → `daySummary`, `strategyAnalysis`, `selfGrade`, `proposedRules`, `lessonLearned`
3. Write to `agentBattles/{id}.dailyReviews[]`
4. Call Gemma (voice layer review mode) to generate an auto-debrief reply
5. Append the auto-debrief to `agentBattles.chatExchanges[]` with `isAutoDebrief: true` and `userMessage: '__REVIEW_START__'` sentinel (`agent-batch-review.js:262-296`)
6. Parse out `_lesson` / `_forgeSuggestion` and write to `agents/{id}.lessons[]` / `agents/{id}.forgeSuggestions[]`

When the user next opens AgentChat post-close, the auto-debrief renders with an amber "📋 Post-Market Debrief" header (`AgentChat.jsx:248-264`). The `'__REVIEW_START__'` sentinel is hidden — only the agent reply renders (`AgentChat.jsx:463-465`). From the user's perspective, the agent has spoken first about the day.

**Review mode chat** is then available for 5 messages (`reviewBudgetUsed` counter, separate from `chatBudgetUsed`). The user can ask follow-ups. The agent can extract `_lesson` and `_forgeSuggestion` items (review-mode-only fields) that are written to the agent doc.

### 6.3 Inline grading cards

Just after the last auto-debrief message, the chat timeline renders `InlineTradingGradeCard` per-trade (`AgentChat.jsx:812-843`). Each card has A/B/C/D/F grade buttons. On tap, calls `submitDailyGrades(battleId, todayStr, merged)`. The grades flow back into the next-day review context block (per §5.4 review mode).

### 6.4 forgeSuggestions[] — written but dark

The `agent-batch-review` cron and the chat handler both write `forgeSuggestion` items to `agent.forgeSuggestions[]` when Gemma emits one during review (`agent-batch-review.js:320-337`, `chat.js:441-449`). Schema:

```javascript
{
  id: uuid,
  text: string (≤500 chars),
  sourceGameId: battleId,
  sourceTrade: ticker or trade id or null,
  createdAt: ISO timestamp,
  status: 'pending'
}
```

**There is no UI consuming `forgeSuggestions[]` today.** The data is captured but dark. V3 spec implies a future surface (Forge or Evolution tab); Phase 4+ work would wire it. As of this recon, the user can write a Forge suggestion via review-mode chat and then the suggestion exists only in Firestore.

### 6.5 Counterfactuals

The review context block (`voiceLayerPrompt.js:1500-1511`) renders `proposalHistory` entries with `resolution === 'vetoed' || resolution === 'lapsed'` and their `counterfactualPoints`. These are computed elsewhere (see commit `89fc92b fix(voice-layer): use correct resolution field in counterfactuals filter`). The agent can reason about *"would have scored +14 pts"* type framing in the debrief.

Counterfactuals are also surfaced in the chat timeline as the "Unanswered Proposals" block (`AgentChat.jsx:801-809`) that renders just before the auto-debrief. Filter: `filterUnansweredProposals` (lines 16-19) — entries where `resolution === 'lapsed'`. No approve/veto retroactive buttons; informational only.

### 6.6 Agent batch review writes to forgeSuggestions but...

The user spec asks: "agent-batch-review writes forgeSuggestions[] but with no UI. Does this connect to a film room concept?" Reading the V3 spec and the live code: forgeSuggestions are *part of* the same Voice Layer review surface (review-mode AgentChat + auto-debrief). The Film Room replacement (Game Tape + Command Center) is shipped. But the visualization of accumulated `agent.forgeSuggestions[]` across multiple games does not exist. The dark write is the only persistence.

---

## 7. Coach / Directive Flow

### 7.1 Directives are half-deprecated, mid-migration

`api/scripts/migrate-directives.js` (170 lines) is the live migration script that confirms the deprecation. Its top comment block (lines 6-9): old `agent.directives[]` are being archived. Sources are routed:

- `source: 'voice_layer'` → moved to `agent.archivedDirectives[]`
- `source: 'batch_review'` → reshaped to lessons via `toLesson(d)` (`migrate-directives.js:26-36`) and pushed to `agent.lessons[]`
- Other sources → archived

The Voice Layer prompt's review-mode rule block makes this explicit at `voiceLayerPrompt.js:345`: *"NEVER write to agent.directives[]. That channel is deprecated. Lessons go to agent.lessons[]. Rules go to agent.forgeSuggestions[]."*

The directive system is bifurcating:
- **Live-play directives** (battle-mode `directive` written to `agentBattles.directive` with `directiveThreadId`) — STILL ACTIVE. This is the chat → Haiku coaching channel.
- **Persistent agent directives** (`agent.directives[]`) — DEPRECATED. Being moved to lessons + activeRules.
- **Activerules** (`agent.activeRules[]`) — set by Forge, permanent. Read by Haiku for trade decisions. Not directly editable via Voice Layer.

### 7.2 Consolidation — every 5 games

Triggered by gameplay: when a game ends and `gamesPlayed % 5 === 0`, the agent doc flips `pendingConsolidation: true`. The cron `process-pending-reflections` (`vercel.json:138-140`, every 15 min on a wide schedule including weekends) picks up the flag and runs consolidation.

Consolidation calls Sonnet (per the Forge/agent-creation recons) with `agentConsolidationPrompt.js` + `agentConsolidationToolSchema.js`. Outputs:
- `agent.consolidatedInsight` — single paragraph distillation (read by Haiku in future eval prompts and by the Voice Layer prompt as Block 3 wisdom)
- `agent.disciplines.selection[]` and `agent.disciplines.execution[]` — structured rules (the FUNNEL principle: consolidation is the ONLY writer)
- `agent.evolutionTimeline[]` — evolution events
- `agent.lessons[]` — marked `consumed: true` if absorbed

The user does not interact with consolidation directly. It is internal-only.

**Sprint 1 status:** The consolidation prompt template is explicitly "Sprint 1 locked" (per the file header comment in `agentConsolidationPrompt.js:4`: *"DO NOT edit the template content during Sprint 1"*). Partner profile writers — the components that populate `agent.partnerProfile` from consolidation outputs — are deferred to Sprint 2. The `formatPartnerProfileSummary` helper currently returns a sentinel: *"(not yet established — partner profile writers ship in Sprint 2)"* (`agentConsolidationPrompt.js:179`). This means `partnerProfile` only updates today via the in-chat elicitation loop, not via consolidation.

### 7.3 Channels for user → agent coaching

Today, the user influences the agent through:
1. **Mid-battle AgentChat** → directive written to `agentBattles.directive` with thread ID → Haiku reads at next eval window. Single-game scope.
2. **Review-mode AgentChat** → `_lesson` written to `agent.lessons[]` (persistent, multi-game) → consolidation absorbs.
3. **Review-mode AgentChat** → `_forgeSuggestion` written to `agent.forgeSuggestions[]` (dark write — no UI to redeem these into rules yet).
4. **Workshop mode** → `dimensionValues` → strategy compilation → next deployment. Pre-battle scope.
5. **Pit Stop conversation** (season mode) → `suggestedAction` ruleId/param changes → user accepts → modifies `agent.activeRules[]`. Weekly scope.
6. **Forge UI direct** (not Voice Layer) → user edits `agent.activeRules[]` directly.

Channel 1 is the only fast channel (mid-game). Channel 2 is the new persistent channel (replacing channel 1's old persistent role). Channel 3 is dark. Channels 4-6 are pre-/post-battle.

### 7.4 Approve / veto / debate mechanics

For agent **proposals** (the agent-evaluate cron writes `proposalHistory[]` entries when it considers a swap but defers to user input):
- `agentBattles.proposalHistory[]` carries resolution: `pending | approved | vetoed | auto_executed | lapsed`
- `ProposalBanner.jsx` is imported in AgentBattleScreen (line 22) — the active proposal banner surface
- `DebateModal.jsx` is imported as well (line 23) — surface for negotiating with the agent on a specific proposal

I did not deep-read DebateModal in this pass; it exists, it is imported, it is presumably the "debate" pattern the spec references. The full lifecycle (Haiku proposes → user approves/vetoes/debates → next eval window) lives in this surface. Worth a follow-on read in a debate-specific recon.

For agent **trades** that have already executed (the agent acts autonomously between eval windows): there is no veto path. Trades land. The user sees them in the feed.

### 7.5 Does coaching feed dossier learning?

Yes, but indirectly. The coaching channels produce:
- `agentBattles.directive` → live one-shot, expires with battle, may or may not affect `partnerProfile`
- `agent.lessons[]` → absorbed by consolidation every 5 games into `disciplines` + `consolidatedInsight`
- `agent.activeRules[]` → editable by Pit Stop and Forge directly; persistent
- `agent.partnerProfile` (15 dimensions) → updated implicitly by the elicitation target loop in battle-mode chat (server picks lowest-confidence dimension, agent probes it, the user's response shapes the dimension)

The `partnerProfile` is the dossier-like artifact. It is updated *during* coaching conversations, not by an explicit "write to dossier" call. The Voice Layer's elicitation target system is the only mechanism that writes to it.

---

## 8. Screens the User Actually Touches

A user-experience trace.

### 8.1 What a brand-new user sees after their first BaggerBomb battle deploys

1. **AgentBattleScreen** (`src/screens/AgentBattleScreen.jsx`). Three-tab layout: Matchups | Command Center | Game Tape.
2. **Matchups tab** — by default. Tier rows (Star / Core / Support / Bench) showing each holding with score and live price. Not conversational.
3. **Command Center tab** — the conversational surface. Left: AgentChat. Right (desktop) or tab (mobile): LiveActivityPanel.
   - In an empty state (battle just deployed, no exchanges, no statusFeed entries yet), AgentChat shows an empty timeline.
   - LiveActivityPanel shows the pulsing dot ("Standing by") and an empty alerts strip.
   - Nothing prompts the user to start chatting.
4. **Game Tape tab** — empty until end-of-day. Shows "No review yet" or similar empty state.

The agent does not greet the user. There is no first-message-on-deploy hook. The user has to tap into Command Center and start a conversation themselves to hear from Gemma. **The first message a new user might ever receive from their agent is the post-market auto-debrief**, which lands after their first trading day.

The static "AGENT SAYS" speech bubble in AgentSidebar shows *"First time in the arena. I've studied the playbook — let's see what I'm made of."* on a fresh agent. That's the closest thing to a welcome.

### 8.2 What screens does tapping different parts of the battle UI lead to?

- Tap a ticker in a tier row → `AssetResearchModal` (asset deep-dive)
- Tap a ticker in an agent message → `onSymbolClick` callback (same modal path)
- Tap a `suggestedActions` chip → sends that chip text as the next user message (rapid replies)
- Tap a directive's ExecutionCard → nothing (read-only)
- Tap a bookmark icon on an Activity Feed entry → toggles `feedBookmarks` set
- Tap a breakthrough alert in LiveActivityPanel → dismisses
- Tap "View Full Log" in LiveActivityPanel → switches to Game Tape tab
- Tap a grade button on an InlineTradingGradeCard (review mode) → `submitDailyGrades`

There are no hidden gestures and no second-level navigation from chat. The conversation surface is flat.

### 8.3 Entry points to conversation: obvious vs hidden

**Obvious:**
- Command Center tab in AgentBattleScreen (tap → Chat textarea visible)
- Pit Stop screen (Season mode) on Saturday — sticky "Weekly Review" header

**Less obvious:**
- WorkshopChat — only reachable via Forge tab → ForgeLanding → "Build Strategy" / theme cards
- Signal Drop V2 (WatchlistChat) — only reachable via Discover panel → "New Signal" or theme card → entry modal → confirm parse → dialogue
- The post-market auto-debrief — passive; user has to open Command Center to discover the message landed

**Hidden / dead:**
- OpenChatPanel — exists as a component file (`src/components/Agent/OpenChatPanel.jsx`, 297 lines) with Accept/Dismiss rule buttons, but its only consumer is `AgentStrategyTab.ARCHIVED.jsx`. Not reachable from current navigation.

### 8.4 For a 5-10 battle user

By battle 5, consolidation has run once. `agent.consolidatedInsight` is populated. The Voice Layer prompt includes it as Block 3's "YOUR ACCUMULATED WISDOM." The agent's responses get richer for having something to reference.

By battle 10, the user has crossed from `DISCOVERY_RULES` to `REFINEMENT_RULES` (phase boundary at `gamesPlayed > 10`). The agent's tone shifts: fewer 2-3 option presentations, more recommend-with-one-alternative, more "Remember that setup two games ago?" callbacks.

`partnerProfile` has accumulated some confidence in 5-7 of 15 dimensions (heuristic — depends on user engagement). The elicitation target system picks the lowest-confidence remaining dimension to probe each turn.

After every 5 games, consolidation refreshes the `consolidatedInsight` paragraph. Lessons absorbed by consolidation get marked `consumed: true`. New lessons can accumulate.

After 30 games, the user crosses to `MASTERY_RULES`. The agent stops presenting options and "leads with the plan" — a register that the Voice Layer Tool Readiness audit (§5) flags as in tension with the product stance.

### 8.5 What conversational depth is available?

Across the user journey:

| Lifecycle stage | Conversational surface | Depth |
|-----------------|------------------------|-------|
| Pre-deployment | WorkshopChat | Multi-turn (25 msgs); compile output deploys agent |
| Day 1, in-battle | AgentChat battle mode | 10 msgs/day; directives extracted; auto-accepted |
| Day 1, post-market | AgentChat review mode + auto-debrief | 5 msgs/day; lessons + Forge suggestions extracted |
| Week 1+, in-battle | Same | Same — partnerProfile slowly populates |
| Saturday (season) | Pit Stop | 30 msgs/15 exchanges; rule param changes proposed/accepted |
| Anytime | WatchlistChat (Signal Drop V2) | 20 msgs across 4 phases; produces watchlist |

The user can reach Gemma through up to four parallel conversation contexts in a given week. Each context has its own state, budget, and exit point. They share the same model, the same partnerProfile, the same consolidatedInsight — but the conversation histories are not unified.

---

## 9. Anything Else

### 9.1 Voice Layer Tool Readiness Audit (May 3, 2026)

`docs/audits/VOICE_LAYER_TOOL_READINESS_AUDIT_PART1.md` (Part 2 + Part 3 too). Internal read-only investigation mapping 15 agent-led / research-direction interactions to current Voice Layer capability. Bottom-line per Part 3:

- 0/15 fully ready (GREEN)
- 8/15 partial (YELLOW — data exists somewhere, plumbing missing)
- 7/15 absent (RED — capability does not exist)

Top priorities the audit calls out:
1. Veto event capture (Sprint 2 hard prereq, blocks pattern aggregator)
2. Cross-battle pattern aggregator (reads `agent.battlePatterns`, synthesizes N-game trends)
3. Portfolio risk synthesis tool
4. Universe screener API
5. Single-ticker deep-dive tool (Voice-Layer-safe wrapper around the agent-eval prompt assembly)
...
11. Proactive surfacing infrastructure (largest architectural build; blocks every agent-led mode)

The audit is dated 2026-05-03, branch `claude/audit-voice-layer-HMUZg`, gitignored. The exists-in-repo copy is the read-only artifact. The "rework" the user spec references is the work that follows from this audit.

### 9.2 What's specified but not shipped

From the spec doc:
- **Block 3.7 DKB Semantic RAG** — `relevantPatterns[]` injected into the prompt with base rates, mechanisms, invalidation conditions. No semantic-RAG path in the codebase.
- **Block 3.8 External Article injection** — `buildExternalArticleBlock`, `detectExternalIntelligence`, server-side fetch + truncation. Not implemented in battle mode. Signal Drop V2 (a separate surface) handles user-shared content.
- **VIX-based volatilityRegime** — spec calls for "VIX below 15, compression regime." Cache writes `vixLevel: null` and notes *"No VIX data in codebase — volatilityRegime used as proxy."*
- **Block 3.6 time-of-day microstructure** — "first 30 minutes are volatile," "power hour," "lunch hour" rules. Game-state urgency exists; time-of-day microstructure does not.

From the V3 spec (Command Center / Film Room redesign):
- Phase 4+ work: directive philosophy migration (in flight), inline grading cards (shipped), directive threading (shipped), trade reasoning structure, review mode backend hardening.

### 9.3 What's shipped but not surfaced prominently

- **`agent.forgeSuggestions[]`** — written by review-mode chat and auto-debrief cron; no UI to redeem.
- **`agent.activeRules[]`** — editable through Forge, read by Haiku. Visible only inside Forge views; not surfaced in AgentBattleScreen Command Center.
- **Scratchpads** — the model's `_scratchpad` reasoning is logged and surfaced in LiveActivityPanel's collapsible "Agent Reasoning" section. Most users won't expand it. The deepest "agent inner monologue" is one tap away from invisible.
- **Directive thread linking** — `directiveThreadId` flows from chat → directive → statusFeed → trade card UI. Most users won't notice the "↳ from directive" indicator.
- **Bench briefs in prompt** — recently added (`8c5c8b4 feat(voice-layer): add header and conditional lines to bench briefs`). The agent now has bench data in mid-battle. Whether the user notices the agent referencing bench positions in chat depends on the conversation.

### 9.4 OpenChatPanel — orphaned code

`src/components/Agent/OpenChatPanel.jsx` is a 297-line collapsible card with a complete chat + Accept/Dismiss rule extraction flow. Its **only** import is `AgentStrategyTab.ARCHIVED.jsx` (lines 13, 209). The parent is archived. OpenChatPanel is functionally orphaned. The accept/reject rule flow that exists here — which would be the "user has a veto" mechanic for directives — does not appear in the live AgentChat. AgentChat auto-accepts.

This is a meaningful gap. If the product team wants user veto of directives, the pattern is already implemented (in dead code) — the path is to lift OpenChatPanel's rule extraction UX into AgentChat, not to build new.

### 9.5 Tone / personality logic — partially consolidated, partially per-surface

The agent has a consistent identity (name, archetype) across surfaces. The "PARTNERS at a trading desk" framing is repeated in every mode's identity block (`voiceLayerPrompt.js:1639, 1700, 1760, 1808, 1881`).

But the **register** varies per surface:
- Battle mode: "trading buddy who just joined the desk" (Discovery), "trading partner who's found their groove" (Refinement), "partner you've traded with for years" (Mastery). Casual, opinionated, directive-comfortable.
- Workshop mode: "quant friend helping a buddy articulate a trade idea." More collaborative, less directive.
- Signal Expansion: not conversational — terse JSON output.
- Watchlist Dialogue: "researcher at the same desk, building a list together." Collaborative, phased.
- Review mode: "replaying tape with a friend." Reflective, lesson-oriented.
- Pit Stop (season): different stack entirely. Identity block at `pitStopReply.js:158-168` matches the rest but the prompt and behavioral rules are written separately.

This is intentional — the spec recognizes the need for register variation. But each surface re-derives its register from scratch. There is no shared "tone library" or "register" parameter. A change to "how the agent talks" requires editing 5+ blocks across the prompt file.

### 9.6 Half-built features adjacent to Voice Layer

- **Modify button on GameplanMeetingCard** — `GameplanMeetingCard.jsx:120-164`. Disabled, "coming soon." A planned third action for the gameplan card.
- **`forgeSeeds` field in voiceLayerCache** — placeholder, hard-coded null. Forge integration gated until Forge has 7+ reliable days of runs.
- **Trade reasoning structure** — `trade_reasoning` is a Phase 8 V3 field on trade rows in GameTapeView. Populated by Haiku when present, surfaced as a section. Many trades won't have it; conditional rendering.
- **Inline AgentActivityFeed in GameTape** — `GameTapeView.jsx:775-826` has a collapsible Full Activity Log toggle. Shipped but secondary surface.
- **DebateModal** — imported in AgentBattleScreen but I did not deep-read it. Whether it's fully wired vs. half-built warrants follow-on investigation.

### 9.7 Recent voice-layer work (last ~30 commits)

Commits with `voice-layer` or related scopes:

```
b36f15b feat(voice-layer): add intraday clause to DATA_CONFIDENCE_RULE
d7fe773 feat(voice-layer): wire buildIntradayLine into portfolio briefs
4ee3c9b feat(voice-layer): add buildIntradayLine helper for portfolio briefs
0f2034e docs(voice-layer): document brief vs snapshot schema difference for Phase 5C
de58343 test(voice-layer): integration tests for Phase 5A helpers with propagated fields
e3aef09 feat(voice-layer): propagate signals and levels fields into portfolio and bench briefs
80692e2 fix(voice-layer): use null instead of 0 as missing-data sentinel for scores and ATR
9d6f162 feat(voice-layer): normalize lastCandlePattern via PATTERN_DISPLAY_NAMES map
9e5f479 feat(voice-layer): refine DATA_CONFIDENCE_RULE to clarify prompt-vs-response framing
243a11c feat(voice-layer): expand DATA_CONFIDENCE_RULE for percentile bands
8c5c8b4 feat(voice-layer): add header and conditional lines to bench briefs
cf956a2 feat(voice-layer): add header and conditional lines to portfolio briefs
7de89b5 fix(voice-layer): standardize errorReason prefix in battle-mode 502 response
aee3045 fix(voice-layer): close first-turn failure shadow-logging gaps
ce3e2e7 fix(voice-layer): treat tier-4 plaintext passthrough as parse failure
a7b0dd9 fix(voice-layer): add confusion handler to battle-mode OUTPUT_FORMAT
cc8a691 feat(voice-layer): capture technical context snapshots at trade decision time
b719f03 feat(voice-layer): wire intraday momentum (VWAP, 5m-SMA20) into cache
89fc92b fix(voice-layer): use correct resolution field in counterfactuals filter
308a6fb fix(voice-layer): derive market state + time remaining in buildBattleState
48abdd7 feat(voice-layer): expose quantitative threshold proximity to agent
c9eb2de feat(voice-layer): lift gameState/urgency into prompt + fix battle-state score shape
ebdf179 feat(voice-layer): expose sector RS classifier signals to cache + prompt
```

Two parallel work streams visible:
1. **Per-symbol brief enrichment** (Phase 5A–5C) — building out the rendering layer that translates structured cache data into prompt-readable lines. Header line, levels line, signals line, intraday line. Several rounds of normalization, null-handling, schema documentation. This is the bulk of recent activity.
2. **Failure-mode hardening** — tier-4 plaintext passthrough, first-turn failure shadow logging, errorReason prefixes, confusion handler. Production-debugging-driven work, suggesting Gemma's failure modes are being instrumented.

Plus Signal Drop V2 phase work (3.6–3.8) in parallel, plus the Discover→Workshop bridge.

---

## Voice Layer State Matrix

| Surface | Status | Description | Key files |
|---------|--------|-------------|-----------|
| **AgentChat (battle mode)** | Shipped & operational | Primary mid-battle conversation. Gemma. 10-msg budget. Directives auto-accepted. Tappable tickers. Suggested action chips. | `src/components/Agent/AgentChat.jsx`, `api/agent/chat.js`, `api/_utils/voiceLayerPrompt.js` |
| **AgentChat (review mode)** | Shipped & operational | Post-market debrief. Gemma. 5-msg budget. Auto-debrief lands first. Inline grade cards. Lessons + Forge suggestion extraction. | Same as above + `api/cron/agent-batch-review.js` |
| **GameplanMeetingCard** | Shipped, one-shot, Modify disabled | Mid-battle "morning briefing" card. Approve/Reject buttons; Modify "coming soon." Renders inside AgentActivityFeed. | `src/components/Agent/GameplanMeetingCard.jsx`, `src/components/Agent/AgentActivityFeed.jsx:748` |
| **WorkshopChat** | Shipped & operational | Pre-battle thesis development. Multi-turn (25 msgs). Compiles to dimensionValues → SeasonEntryModal. seedContext from Discover. | `src/components/Forge/WorkshopChat.jsx`, `api/forge/workshop-chat.js`, `voiceLayerPrompt.js:1697-1754` |
| **WatchlistChat (Signal Drop V2)** | Shipped & operational (phases 3A-3C); Phase 4 (save) pending | Phased dialogue (explore→propose→refine→finalize) over user-shared content. 20-msg budget. Anti-hallucination drift detection (Phase 3.8). | `api/forge/watchlist-dialogue.js`, `voiceLayerPrompt.js:1806-1878`, WatchlistChat UI |
| **Signal Expansion** | Shipped & operational | One-shot expansion of parsed signal → thesisSummary + relatedTickers + invalidationConditions. Gemma. JSON-only output. | `api/forge/expand-signal.js`, `voiceLayerPrompt.js:1758-1802` |
| **Pit Stop conversation** | Shipped & operational (Season mode) | Weekend ritual screen. Multi-turn (30 msgs / 15 exchanges). Gemma. Independent stack from BaggerBomb Voice Layer. Rule-param change suggestions. | `src/screens/PitStopScreen.jsx`, `src/components/Season/PitStopConversation.jsx`, `api/season/pit-stop-reply.js`, `api/_utils/seasonPrompts/pitStopReply.js` |
| **voiceLayerCache cron** | Shipped & operational | Every 15min during market hours. Writes portfolioBriefs + benchBriefs + scoutAlerts + marketContext per battle. | `api/cron/voice-layer-cache.js`, `vercel.json:141-144` |
| **agent-batch-review cron** | Shipped & operational | 4:25 + 5:25 PM ET weekdays. Generates daily review (Haiku) + auto-debrief (Gemma) per active battle. Writes dailyReviews, chatExchanges (`isAutoDebrief: true`), lessons, forgeSuggestions. | `api/cron/agent-batch-review.js`, `vercel.json:145-148` |
| **process-pending-reflections cron** | Shipped & operational | Picks up `pendingConsolidation: true` flag every 15 min. Runs Sonnet-based consolidation. Refreshes consolidatedInsight + disciplines. | `api/cron/process-pending-reflections.js`, `agentConsolidationPrompt.js` |
| **LiveActivityPanel** | Shipped & operational | Ambient sidebar surface. Status indicator + breakthrough alerts (5 types, max 3, 60s auto-dismiss) + collapsible Agent Reasoning. | `src/components/Agent/LiveActivityPanel.jsx` |
| **AgentActivityFeed** | Shipped & operational | Full activity timeline. HIGH/LOW tier classification. Bookmark per entry. Hosts GameplanMeetingCard at top. | `src/components/Agent/AgentActivityFeed.jsx` |
| **GameTapeView** | Shipped & operational (replaces Film Room) | Post-market data-only review tab. DaySummaryCard, sortable Trade History, Bookmarked Entries, collapsible Full Activity Log. | `src/components/Agent/GameTapeView.jsx` |
| **AgentEvolutionTab** | Shipped & operational | Agent-lifetime view. Timeline + stats grid + recent scores. Sourced from agent.evolutionTimeline, lessons, memory, deployedStrategy, consolidatedInsight. | `src/components/Agent/AgentEvolutionTab.jsx` |
| **AgentSidebar "AGENT SAYS"** | Shipped, static | Italicized speech bubble in agent sidebar/hero card. Static maturity-stage-keyed copy from useAgent.js. Does NOT update mid-battle. | `src/components/Agent/AgentSidebar.jsx:174-194`, `src/hooks/useAgent.js:73-91` |
| **Trade notifications** | Shipped & operational | Typed events (swap_executed, breakout, bust, crash, lead_change) via baggerBombNotificationService. Cached localStorage with dedup. | `src/services/baggerBombNotificationService.js` |
| **Battle commentary** | Shipped & operational | Flavored narration for scoring events only (BaggerBomb, Double, Crash, Lead Change). NOT generated by Voice Layer — separate `/api/battle-commentary` endpoint. | `src/services/commentaryService.js`, `/api/battle-commentary` (not voice layer) |
| **forgeSuggestions[] UI** | Mid-build / dark write | Items WRITTEN by review-mode chat + auto-debrief cron, but no UI consumes them today. Phase 4+ V3 work. | (No file — gap) |
| **Directive auto-accept** | Mid-build (V3 Phase 4) | Battle-mode directives auto-accepted in AgentChat; no veto UI. OpenChatPanel (orphaned) has the accept/reject pattern available to lift. | `AgentChat.jsx:83-154` (auto-accept); `OpenChatPanel.jsx` (orphaned pattern) |
| **Persistent directives migration** | Mid-build | `migrate-directives.js` moves `voice_layer` source → `archivedDirectives[]`, `batch_review` source → `lessons[]`. Review-mode prompt forbids writing directives. | `api/scripts/migrate-directives.js`, `voiceLayerPrompt.js:345` |
| **DebateModal** | Shipped (unverified scope) | Imported in AgentBattleScreen as a proposal-debate surface. Not deep-read in this pass. | `src/components/Agent/DebateModal.jsx` |
| **OpenChatPanel** | Orphaned (de facto archived) | 297-line component with full Accept/Dismiss rule flow. Only import is from `AgentStrategyTab.ARCHIVED.jsx`. Not reachable from current navigation. | `src/components/Agent/OpenChatPanel.jsx` |
| **AgentFilmRoom / FilmRoomCard / AgentStrategyTab** | Archived | Pre-V3 surfaces. Replaced by GameTapeView + Command Center chat. Files remain in repo as `.ARCHIVED.jsx`. | `src/components/Agent/AgentFilmRoom.ARCHIVED.jsx`, `FilmRoomCard.ARCHIVED.jsx`, `AgentStrategyTab.ARCHIVED.jsx` |
| **Proactive surfacing (agent-led messages)** | Specified, not built | Pre-market opener, mid-battle threshold alert, bench outperformance flag, post-battle pattern observation. Audit Part 3 lists as Tier 11 priority — *"Largest architectural build."* | (Architectural gap — no file) |
| **DKB Semantic RAG (Block 3.7)** | Specified, not built | `relevantPatterns[]` injection per spec. No semantic-RAG path in codebase. | Spec only |
| **DKB State-Triggered time-of-day (Block 3.6)** | Specified, partial | Game-state/urgency exists (computeGameContext). Time-of-day microstructure (open / lunch / power hour) does not. | `voiceLayerPrompt.js:920` (urgency); spec only for time-of-day |
| **External article injection (Block 3.8)** | Specified, not built | URL detection + server-side fetch + truncated article block + Semantic RAG trimming. Not implemented in battle mode. (Signal Drop V2 handles user-shared content via separate surface.) | Spec only |
| **`forgeSeeds` voiceLayerCache slot** | Reserved, not connected | Hard-coded `null` in cache writer. Gated until Forge has 7+ days of reliable runs. | `voice-layer-cache.js:695` |
| **VIX-based volatilityRegime** | Specified, proxy in place | Cache writes `vixLevel: null`; `volatilityRegime` from breadth/RSP used as proxy. | `voice-layer-cache.js:544` |
| **Modify on GameplanMeetingCard** | Specified, disabled | Third action button. "Coming soon." | `GameplanMeetingCard.jsx:120-164` |
| **First-message-on-deploy / session opener** | Specified, not built | Voice Layer is reactive only. No `chatExchanges[]` write on battle deploy. Auto-debrief is the only system-initiated message and lands post-market. | (Architectural gap) |
| **Universe screener API** | Aspirational | Required for screening requests (Requests 5, 6, 9 in tool readiness audit). Underlying data exists (`stockRankings`); endpoint does not. | Audit Part 3 priority 4 |
| **Cross-battle pattern aggregator** | Aspirational | Required for "We've held through 3 consecutive…" type observations. Logging exists (`battlePatterns`); aggregation does not. | Audit Part 3 priority 2 |
| **Veto event capture** | Aspirational | Required to feed Sprint 2 writers. UI hook + API + storage. Does not exist. | Audit Part 3 priority 1 |

---

## User Experience Walkthrough — A New User's First Conversational Experience

A User 1+2 (the spec personas) has just created their agent and deployed their first BaggerBomb battle. What do they actually experience conversationally with their agent?

**Pre-deployment (Forge / Workshop path):**
If they came through the Workshop path, they have 1+ conversational session with Gemma to develop a strategy thesis. This is the warmest first encounter — Workshop mode's `EXPERT BUILDER MODE` (`voiceLayerPrompt.js:223`) explicitly softens for users who lack technical knowledge ("when the user signals they lack technical knowledge … STOP asking them to choose between technical concepts. Instead, PROPOSE a specific approach yourself"). The `PLAIN LANGUAGE MANDATE` forces jargon translation. This is the only Voice Layer surface that adjusts register for new-user warmth.

If they came through a simpler deployment path (set up an agent without Workshop), they have had no prior conversation with their agent.

**Battle deploys, AgentBattleScreen opens:**
- Matchups tab is the default. The user sees their tier rows and live prices.
- The user navigates to Command Center to see if their agent has anything to say.
- AgentChat shows an empty timeline. Nothing has been said.
- LiveActivityPanel shows the pulsing "Standing by" indicator. No alerts yet.
- The user reads the static "AGENT SAYS" speech bubble in the sidebar: *"First time in the arena. I've studied the playbook — let's see what I'm made of."*

**The user has to start the conversation.** There is no first-message-on-deploy hook. The agent will not greet them. Gemma's prompt rules in DISCOVERY mode contain "NEVER greet the user. Your first message is market-aware and strategic" — but DISCOVERY rules only fire when the user has already sent a message. Until then, the agent is silent.

**If the user types "Hi":**
- The agent will respond. Discovery rules prevent it from greeting; it will open with a market-aware take. Per the Voice Layer Tool Readiness audit §5.4, this is the most awkward register transition — a brand-new user gets the "trading buddy who just joined the desk" register, which assumes a peer-trader frame the new user may not yet inhabit.
- The CONFIRMATION → EXECUTION rule means if the user types "do whatever you think," the agent will write a directive and execute. The first impression for a hands-off user is fast.

**During the trading day:**
- The agent acts via `agent-evaluate` cron. The user sees swap events appear in the activity feed and breakthrough alerts strip. No narration.
- If the user opens chat, they can ask "why did you swap NVDA?" and the agent will answer using the latest cache + battle state + recent trade context.
- The agent does NOT push messages. Threshold proximity, bench outperformance, news catalysts — all of these are detected internally but not surfaced as messages.
- If a scoring event fires (BaggerBomb, etc.), commentary narration shows up in the feed — but that's the ClashCast engine, not the Voice Layer.

**End of trading day, ~4:25 PM ET:**
- `agent-batch-review` cron fires. It writes today's daily review and an auto-debrief.
- The user does not get a push notification telling them this happened. They have to open AgentBattleScreen.
- When they do, AgentChat now has a new message with an amber "📋 Post-Market Debrief" header. **This is, in practice, the first time the agent has spoken first to the user.**
- The debrief opens with the day's headline (per `REVIEW_PHASE_RULES`). It offers a self-grade. It may propose a lesson.
- The user can respond. 5 messages budget for the review conversation.
- Game Tape tab now has content: Day Summary Card, Trade History, etc.

**Honest gaps in the User 1+2 experience:**

1. **The agent is silent until poked.** A new user with no prior context may not realize they can chat. The deployment screen does not prompt them to open Command Center.
2. **Workshop mode has the best new-user register, but Battle mode does not.** A user who deploys without Workshop gets the peer-trader register on game 1. The Voice Layer Tool Readiness audit calls this out as a known gap (§5.4: *"the very first session — when warmth matters most for retention — is the session where the partner profile is empty"*).
3. **No anticipation moments.** The user sees outcomes (trades, alerts, scoring events) without setup ("I'm watching X for Y"). The agent's foresight is invisible.
4. **Auto-debrief is the first system-initiated message.** Until the post-market cron runs, the user has no way to discover that the agent has things to say. The user must initiate.
5. **The sidebar "AGENT SAYS" bubble is static personality copy, not a status indicator.** A new user might expect that bubble to update. It doesn't. By battle 2, the bubble shows "Last game: lost. [lesson]." — better, but still not a live channel.
6. **There is no veto path for the directives that Gemma extracts mid-battle.** Auto-accept is the rule. The user can disagree by sending a follow-up message, which overrides on the next turn. But there is no "↳ I disagree" button. The pattern exists in OpenChatPanel (orphaned).
7. **Forge suggestions written in review mode are dark.** A user who says "send that to the Forge as a rule" gets the agent's acknowledgment, the data is written — and then nothing visibly happens. There is no UI for browsing `agent.forgeSuggestions[]`.
8. **Pit Stop is reachable only through Season mode.** A BaggerBomb-only user never sees this conversation surface.

**What works for the User 1+2 lens:**

1. **WorkshopChat** is genuinely warm and adaptive. Users who lack technical knowledge get expert-builder mode, plain-language jargon translation, and proposed approaches instead of forced-choice questions. This is the strongest new-user surface in the system.
2. **The auto-debrief** is the system's best "agent introduces itself" moment, even if it lands late on day 1.
3. **Tappable tickers in agent messages** make the conversation feel interactive from the first exchange.
4. **Suggested action chips** lower the typing burden — a hands-off user can have a full conversation by tapping chips.
5. **The `partnerProfile` elicitation loop** builds a model of the user over time. By battle 10, the agent is adapting register, calling back previous decisions, presenting genuinely tailored options.
6. **Workshop → SeasonEntryModal compile flow** carries thesis-development warmth into the actual deployment. The user does not feel they have to translate their thesis into sliders themselves.

**The shape of the gap:**

The Voice Layer is a competent and well-built reactive conversation system that the user has to seek out. The work the team has done in the last sprint is largely about making the agent's reactive responses smarter (intraday momentum, threshold proximity exposure, sector RS classifier, percentile bands, anti-hallucination drift detection). The next horizon — the Voice Layer Tool Readiness audit's 11-item priority list — is about turning the system from reactive to proactive, and turning a few dark writes (forgeSuggestions, partnerProfile) into surfaces. The rework the user spec references is precisely this transition. As of 2026-05-12, it is in progress: V3 Phases 1-3 shipped, Phase 4 staging, the Sprint 2 architectural prerequisites (veto capture, pattern aggregator) not yet built.

---

## Appendix — Files Investigated

**Prompt assembly:**
- `api/_utils/voiceLayerPrompt.js` (1946 lines)
- `api/_utils/gemmaClient.js`
- `api/_utils/dailyRegimeBriefPrompt.js`
- `api/_utils/agentConsolidationPrompt.js`
- `api/_utils/seasonPrompts/pitStopReply.js`

**Cron / cache:**
- `api/cron/voice-layer-cache.js` (719 lines)
- `api/cron/agent-batch-review.js`
- `api/cron/process-pending-reflections.js`
- `api/cron/compute-daily-regime-brief.js`
- `vercel.json` (cron schedules)

**API handlers:**
- `api/agent/chat.js` (493 lines)
- `api/forge/workshop-chat.js` (642 lines)
- `api/forge/watchlist-dialogue.js` (1359 lines)
- `api/forge/expand-signal.js`, `parse-signal.js`
- `api/season/pit-stop-reply.js`
- `api/scripts/migrate-directives.js`

**UI components:**
- `src/components/Agent/AgentChat.jsx` (1113 lines)
- `src/components/Agent/OpenChatPanel.jsx` (orphaned)
- `src/components/Agent/GameplanMeetingCard.jsx`
- `src/components/Agent/AgentActivityFeed.jsx`
- `src/components/Agent/LiveActivityPanel.jsx`
- `src/components/Agent/GameTapeView.jsx`
- `src/components/Agent/AgentEvolutionTab.jsx`
- `src/components/Agent/AgentSidebar.jsx`
- `src/components/Agent/AgentFilmRoom.ARCHIVED.jsx`, `FilmRoomCard.ARCHIVED.jsx`, `AgentStrategyTab.ARCHIVED.jsx`
- `src/components/Forge/WorkshopChat.jsx`, `ForgeLanding.jsx`
- `src/components/Season/PitStopConversation.jsx`, `PitStopShortlist.jsx`, `PitStopChanges.jsx`, `PitStopLockInBar.jsx`
- `src/screens/AgentBattleScreen.jsx`, `PitStopScreen.jsx`
- `src/hooks/useAgent.js`, `useAgentBattle.js`

**Spec / audit docs:**
- `VOICE_LAYER_PROMPT_CONSTRUCTION_GUIDE.md` (v1.0, 2026-04-08)
- `docs/audits/VOICE_LAYER_TOOL_READINESS_AUDIT_PART1.md`, `_PART2.md`, `_PART3.md` (2026-05-03)
- `COMMAND_CENTER_FILM_ROOM_REDESIGN_QUICK_REFERENCE_V3.md`
- `DAILY_REGIME_BRIEF_TECHNICAL_REFERENCE.md`

**Recent commits referenced:** see §9.7 for the voice-layer-tagged commits from the last sprint.
