# Phase 1 Voice Layer Discovery Findings

**Date:** 2026-05-20
**Branch:** Investigated the working tree at HEAD of `claude/voice-layer-phase-1-discovery-tA9br`. The branch is at the same commit as the most recent `main`-style work — the PR #421 autopilot-default merge is the tip. The prompt asked for `main`; the discovery branch had no diverging changes at the time of investigation, so the findings apply equally to `main`. Flagging for transparency.
**Commit SHA:** `fcbd71c5d0e0db9f78a1938dd6d8c335ac731880`
**Investigator:** Claude Code

## Executive summary

The Voice Layer today is a **single large prompt-assembly module (`api/_utils/voiceLayerPrompt.js`, 2,428 lines, ~156 KB) with a single primary export, `buildVoiceLayerPrompt(...)`,** that branches by a surface-axis `mode` parameter (`battle` | `review` | `workshop` | `signal_expansion` | `watchlist_dialogue`) and within battle/review further routes by phase (`Discovery` | `Refinement` | `Mastery`) computed from `agent.stats.gamesPlayed`. **The Voice Layer is structurally unaware of `executionMode` (authority mode)** — that field is read in the trading cron but never reaches the prompt assembler; the only autopilot/copilot signal that touches the prompt is `detectTradeProvenance`, which inspects past trades for narration framing and is not yet plumbed into any active surface. **The chat is entirely reactive today** — the only proactive Voice Layer message is the end-of-day auto-debrief written by `agent-batch-review.js`; nothing fires at battle creation or activation. **Authority-mode plumbing has just been simplified for the autopilot-only launch** (PR #421, merged at the investigated SHA): `createAgentBattle` now defaults `executionMode: 'autopilot'` and `agent-evaluate.js` carries a Launch Guard forcing autopilot even if a battle's mode is set otherwise. The 10-message chat budget is fully implemented and enforced at the server boundary.

## Category 1: Voice Layer architecture

### Q1: voiceLayerPrompt.js architecture

**File:** `api/_utils/voiceLayerPrompt.js` — 2,428 lines, ~156 KB. Tests live at `api/_utils/voiceLayerPrompt.test.js` (139 KB).

**Primary export:** `buildVoiceLayerPrompt(...)` at line 2090. Accepts an options object with the following keys:

```js
{
  agent, battle, elicitationTarget, conversationHistory,
  anchorContext, marketSnapshot,
  mode = 'battle',                  // 'battle' | 'review' | 'workshop' | 'signal_expansion' | 'watchlist_dialogue'
  workshopContext, dailyReviews, dailyGrades,
  parsedSignal, signalMarketContext, temporalRelation,
  currentPhase, recentExchanges, candidateTickers, phaseRequest,
  anatomy,
}
```

Returns a single plain-text system-prompt string (blocks joined by `\n\n`). `conversationHistory` is declared but unused inside the function — `// eslint-disable-line no-unused-vars -- kept for API symmetry; caller passes it directly to the model` (line 2094). So in practice the function produces text only.

**Other named exports** (all used by tests and/or callers that need block-level building):

- `buildBattleState(battle)` — line 898
- `detectSnapshotRegime(snapshot)` — line 1008
- `buildHeaderLine` / `buildLevelsLine` / `buildSignalsLine` / `buildIntradayLine` — lines 1021, 1081, 1129, 1173 (text rendering helpers for portfolio briefs)
- `buildSnapshotHeader` / `buildSnapshotTrend` / `buildSnapshotSignals` / `buildSnapshotLevels` / `buildSnapshotIntraday` — lines 1235, 1277, 1289, 1319, 1362 (technical-snapshot rendering)
- `buildSwapEntryBlock(entry, kind, options)` — line 1528 (used by trade-recap rendering paths)
- `detectTradeProvenance(trade, proposalHistory)` — line 1578 (returns `'autopilot'` | `'risk_triggered'` | `'approved'` | `'auto_executed_proposal'`)
- `buildPortfolioBriefsBlock` / `buildBenchBriefsBlock` / `buildMarketSnapshotContext` — lines 1606, 1656, 1696
- `buildReviewContext(battle, dailyReviews, dailyGrades)` — line 1897

**Block inventory for the default (battle) branch** (lines 2363–2425). The author has documented an explicit "U-shaped attention order" placing high-attention blocks at TOP and BOTTOM:

| Block | Position | Source |
|---|---|---|
| 1. Identity (`You are ${agent.name}…`) | TOP | inline literal |
| 1.5. `GAME_MECHANICS` (BaggerBomb rules) | TOP | line 14 |
| 7. `OUTPUT_FORMAT` (JSON contract) | TOP | line 21 |
| 2. Partner Model | MIDDLE | `buildPartnerModelBlock` |
| 3. Convictions | MIDDLE | `buildConvictionsBlock` |
| 3.5. Anchor (DRB regime + brief) | MIDDLE | `anchorContext` |
| 4A. Portfolio Briefs (conditional) | MIDDLE | from `marketSnapshot` |
| 4A-bench. Bench Briefs (conditional) | MIDDLE | from `marketSnapshot` |
| 4B. Scout Alerts (conditional) | MIDDLE | from `marketSnapshot` |
| 4C. Market Context (conditional) | MIDDLE | from `marketSnapshot` |
| `DATA_CONFIDENCE_RULE` (conditional) | MIDDLE | line 1733 |
| 5. Battle State | BOTTOM | `buildBattleState` |
| Few-shot example (phase-keyed) + Confirmation example | BOTTOM | line 2395 |
| Elicitation target instruction (internal) | BOTTOM | inline |
| 6. Phase Rules (`PHASE_RULES[phase]`) | BOTTOM — last | line 805 |

**Phase rules** (line 805): `{ Discovery: DISCOVERY_RULES, Refinement: REFINEMENT_RULES, Mastery: MASTERY_RULES }`. Phase is computed from `gamesPlayed` via `getAgentPhase` (line 846). Each phase has a 70+ line rules block (lines 53–150). Mastery rules contain the directive `Lead EVERY conversation with a complete, pre-formed plan` that Addendum B Principle 1 flags as needing mode-gating — this is the Phase 6 rework item, not Phase 1.

**Branches inside `buildVoiceLayerPrompt`:**

- `mode === 'review'` (line 2119) — reuses identity, partner model, convictions, anchor, market briefs; replaces Battle State with `buildReviewContext`; uses `REVIEW_PHASE_RULES` (line 334) + `REVIEW_FEW_SHOT` (line 367).
- `mode === 'workshop'` (line 2180) — completely different identity framing, `WORKSHOP_OUTPUT_FORMAT` (line 177), `WORKSHOP_PHASE_RULES` (line 212), `WORKSHOP_REFERENCE` (line 253), `WORKSHOP_FEW_SHOT` (line 310). No battle state. Used by the Forge.
- `mode === 'signal_expansion'` (line 2240) — `SIGNAL_EXPANSION_OUTPUT_FORMAT` (line 385), phase rules built by `buildSignalExpansionPhaseRules(temporalRelation)` (line 416). Used by Forge Signal Drop.
- `mode === 'watchlist_dialogue'` (line 2288) — four sub-phases (`explore` | `propose` | `refine` | `finalize`) via `WATCHLIST_PHASE_RULES` (line 654). Used by Forge Watchlist Dialogue.
- default — battle branch described above.

**Related Voice Layer files alongside it:**

- `api/cron/voice-layer-cache.js` (719 lines). Pre-computes `portfolioBriefs`, `benchBriefs`, `scoutAlerts`, `marketContext` per battle every 15 min during market hours and writes `voiceLayerCache/{battleId}`. **Does not call `buildVoiceLayerPrompt` or write any chat content** — it produces the data the prompt reads.
- `api/_utils/gemmaClient.js` — wraps `callGemmaVoice(...)` / `parseVoiceLayerResponse(...)`.
- `api/_utils/signalDropPrompt.js` — Forge-side input shaper that feeds `parsedSignal` into `buildVoiceLayerPrompt` with `mode: 'signal_expansion'`.
- `api/_utils/seasonPrompts/pitStopReply.js` — separate season-mode prompt module (out of scope for this discovery).

### Q2: Mode information access patterns

**Authority mode (`executionMode`) does not reach the Voice Layer prompt assembler.** A grep across `voiceLayerPrompt.js` for `executionMode | authority | autopilot | copilot | manual` returns five hits, all inside `detectTradeProvenance` and its callers (lines 1431, 1442, 1562, 1603) — these inspect past `trade` records and `proposalHistory` to label a trade's origin for narration framing (`TRADE — executed (autopilot)` vs `approved by Coach`), and they are surfaced through `buildSwapEntryBlock` for trade-recap rendering, not through battle-mode prompt assembly.

**Where mode is actually read:**

- `api/agent/chat.js:252` calls `buildVoiceLayerPrompt({ ..., mode, ... })` — but here `mode` is the **surface axis** (`'battle'` | `'review'`), computed by `detectMode(battle)` from market state and the presence of today's daily review. `executionMode` is **not passed**.
- `api/cron/agent-batch-review.js:243` calls `buildVoiceLayerPrompt({ ..., mode: 'review', ... })` — `executionMode` not passed.
- Forge endpoints (`workshop-chat.js:381`, `expand-signal.js:293`, `watchlist-dialogue.js:923`) — all pass `mode` as their own surface label; `executionMode` not passed.
- `api/cron/agent-evaluate.js` reads `battle.executionMode` at lines 184 (migration backfill default `'copilot'`), 651, 970, 996, 1113, 1317, 1517 — but exclusively for **execution-routing** purposes (autopilot → immediate `executeSwapServer`; copilot/manual → write `pendingProposal`). **There is no call from `agent-evaluate.js` into the Voice Layer.**
- A "Launch Guard" at `agent-evaluate.js:972-978` forces `mode = 'autopilot'` even if a battle's `executionMode` is set otherwise, and explicitly preserves the copilot/manual branch under `// PRESERVED FOR POST-LAUNCH (2026-05-19)` (line 1029).

**Summary of mode-axis use:**

| Axis | Field | Where it's read | Where it drives prompt branching |
|---|---|---|---|
| Surface | `mode` (arg) | `chat.js:192`, all Voice Layer callers | `voiceLayerPrompt.js` line 2119+ branches |
| Phase (relationship maturity) | `agent.stats.gamesPlayed` | `voiceLayerPrompt.js:846` `getAgentPhase` | `PHASE_RULES[phase]` line 805 |
| Authority | `battle.executionMode` | `agent-evaluate.js` only | **nowhere in Voice Layer prompt assembly** |

So the answer to Q2 is plain: **the Voice Layer is structurally autopilot-only today, by omission rather than by intention**. The plumbing to make it mode-aware does not yet exist — there is no `executionMode` parameter on `buildVoiceLayerPrompt`, no caller passes it, and no branch reads it. Adding mode-awareness is a green-field plumbing job on the prompt side, not a re-wiring of existing logic. (Contrast: on the trading side per the prior authority-mode discovery, the engine was already fully mode-aware; the Voice Layer is the opposite.)

### Q3: Voice Layer surfaces

Verified consumer surfaces that render Voice Layer output:

- **`src/components/Agent/AgentChat.jsx`** (1,112 lines) — primary chat surface. Mounted in `AgentBattleScreen.jsx:923` inside the `command` tab. Reads `chatExchanges` prop and renders both halves of each exchange (user message + agent response). Has special handling for `isAutoDebrief: true` exchanges (renders only the agent half, with amber accent — line 239 `accent = isAutoDebrief ? '#f59e0b' : '#5EEAD4'`, line 248). Also renders `UnansweredProposalCard` for lapsed proposals (line 343, 804) — but lapsed proposals only exist in `manual` mode, which the Launch Guard prevents from being entered, so this component effectively never renders.
- **`src/components/Agent/OpenChatPanel.jsx`** (297 lines) — a **second** chat surface for off-market hours. Reads the same `chatExchanges` and `chatBudgetUsed` fields. Renders nothing if `isMarketHoursClient()` is true (line 51 — sending is blocked during market hours). Uses a level-based budget `getLevelConfig(gamesPlayed).chatBudget` rather than the hardcoded server limit of 10 — there is potential drift between the client-perceived budget and the server-enforced one (flagged below in "Things that surprised me").
- **`src/components/Agent/GameTapeView.jsx`** — the post-market debrief surface (game-tape tab). The exploration agent reported this consumes Voice Layer auto-debrief content; I did not read the full file in this pass — flagged as un-verified detail.

**Surfaces that the rework roadmap names but that do not exist today:**

- **Anticipation surface** — **none found.** No "what I'm watching" UI; no anticipation message type; no anticipation phase rules in `voiceLayerPrompt.js`.
- **Pre-battle gameplan surface** — `src/components/Agent/GameplanMeetingCard.jsx` exists, but it is the **Sprint 4 strategy-preset/gameplan-meeting** flow (uses `gameplanMeeting` / `gameplanMeetingHistory` fields on the battle doc, line 158 in `agentBattleService.js`). Per the prior authority-mode discovery this lives in the archived tab. It is not driven by Voice Layer prompts. The Phase-4-roadmap pre-battle gameplan is not yet built.
- **Film room / debrief surface** — partial. `GameTapeView.jsx` exists and the auto-debrief writes to `chatExchanges` (so the debrief lands in the chat timeline), but the dedicated "Film Room v2" mode described in Phase 4 of the roadmap is not yet built. There is no `mode: 'film_room'` branch in `voiceLayerPrompt.js`. The current `mode: 'review'` is the closest analog.

**Trade narration surface** — **none plumbed.** `detectTradeProvenance` and `buildSwapEntryBlock` exist in `voiceLayerPrompt.js` to render swap entries with autopilot/copilot framing, but I could not find any code path that calls `buildSwapEntryBlock` and writes the result to chat. `agent-evaluate.js`, after executing a swap, writes a `statusFeedEntries.push(...)` entry (e.g. line 446) — a short tagged record for the status feed — and does not call the Voice Layer. So trade narration is implemented at the rendering-helper level but not at the produce-a-chat-message level. This matches Phase 2 of the rework.

## Category 2: Chat system

### Q4: Chat message schema

**Storage:** `agentBattles/{battleId}.chatExchanges` (array of exchange objects, written via `FieldValue.arrayUnion`). Initialized to `[]` at battle creation (`agentBattleService.js:160`). Migration backfilled by `agent-evaluate.js:192` for legacy battles.

**Exchange object shape** (from `chat.js:405-418`):

```js
{
  userMessage: string,                  // sanitized, ≤2000 chars
  agentResponse: string,                // Gemma output
  scratchpad: string | null,            // internal rationale, sanitized
  hasDirective: boolean,
  directive: {                          // null if hasDirective === false
    text: string,
    expiry: 'end_of_battle' | '3_games' | 'permanent',
    directiveThreadId: string (UUID)
  } | null,
  directiveThreadId: string | null,
  suggestedActions: string[] | null,    // 2-3 button labels, or null
  elicitationTarget: string,            // dimension probed
  timestamp: ISO8601,
  mode: 'battle' | 'review',
  isAutoDebrief?: boolean,              // present only on cron-written debriefs
}
```

**Schema observations:**

- An "exchange" is a **pair** — user message + agent response in one record. There is no per-message-typed record. This makes it structurally awkward to write a standalone agent-initiated message: the auto-debrief works around this by stuffing the sentinel `userMessage: '__REVIEW_START__'` and tagging the record with `isAutoDebrief: true` (`agent-batch-review.js:286-297`).
- No `sender` field at the exchange level. Sender disambiguation happens implicitly: the client renders the user half from `userMessage`, the agent half from `agentResponse`, and suppresses the user half when `isAutoDebrief` is set (`AgentChat.jsx:465`).
- "System-generated" vs "user-initiated" agent messages are distinguished **only** by the `isAutoDebrief` boolean. Any other agent-initiated message type (first-message-on-deploy, trade narration, anticipation) would need either a new sentinel + flag or a schema change.
- `mode: 'battle' | 'review'` on each exchange — this is the surface mode (market state), not authority mode. There is currently no field on an exchange that records authority mode.

### Q5: Chat UI rendering

**`AgentChat.jsx` rendering pattern:**

- `chatExchanges` arrives via prop from `useAgentBattle` (which has a Firestore `onSnapshot` listener at `useAgentBattle.js:28-44`), so the prop *is* live-updating.
- BUT — the chat history is loaded one-shot via `initialLoadRef.current` (`AgentChat.jsx:454-496`). The comment at line 449-452 is explicit: *"one-shot load by design — local message state owns per-session UI concerns (typing indicators, optimistic user bubbles). Firestore-initiated exchanges (e.g., the batch cron's auto-debrief) appear on next mount."* So a Firestore-initiated message that arrives while the user is sitting in the command tab will **not** render until the tab is unmounted and re-mounted (or the page is reloaded). This is a real obstacle for first-message-on-deploy — see "Things that surprised me."
- Auto-debrief rendering: `MessageBubble` (line ~212-302) picks up `isAutoDebrief` and switches the accent color to amber (`#f59e0b`) and adds a labeled header. The user `__REVIEW_START__` sentinel is suppressed at load time (line 465).
- Markdown isn't used; messages are styled bubbles with a regex-based ticker detector that turns `[A-Z]{1,5}` tokens into clickable links.

**Notification / command-dot pattern** (`AgentBattleScreen.jsx:678-684`):

```js
const hasPendingProposal = pendingProposal && !pendingProposal.resolvedAt;
const hasNewFeedEntries = statusFeed.length > lastSeenFeedLengthRef.current;
const hasCommandDot = hasPendingProposal || hasNewFeedEntries;
const commandDotColor = hasPendingProposal ? '#f59e0b' : '#5eead4';
```

- Two triggers: a pending proposal (which under the Launch Guard cannot occur), or growth in `statusFeed.length`.
- **Crucially, the dot is *not* directly tied to `chatExchanges.length`.** A new chat-only entry would not light the dot. The auto-debrief lights it because `agent-batch-review.js:214-219` writes a `statusFeed` entry (`action: 'film_room', source: 'batch_review'`) in addition to the chatExchanges write.
- So any new proactive Voice Layer message wanting an indicator would need to write to `statusFeed` (or change the dot logic to listen for chatExchanges growth too).

The user does NOT need to be on the command tab to see the dot — the tab bar is persistent on `AgentBattleScreen`. But they DO need to be on the command tab to see the actual message content, AND (per the AgentChat one-shot load) they need to *navigate to it after the message was written*, not be sitting on it.

There is no toast, banner, push-notification, or other off-tab surfacing of new agent messages in this codebase that I could find.

### Q6: 10-message budget

**Fully implemented.** Not aspirational.

- **Definition** (`chat.js:122-125`):
  ```js
  const MODE_BUDGET = {
    battle: { field: 'chatBudgetUsed', limit: 10 },
    review: { field: 'reviewBudgetUsed', limit: 5 },
  };
  ```
- **Enforcement** (`chat.js:193-210`): checked on every user-initiated `POST /api/agent/chat` call against `battle[budgetField]` (line 194). If `currentBudget >= budgetLimit`, returns `429` with `error: 'budget_exceeded'` in review mode (newer error shape) or `403` with `error: 'chat_budget_exceeded'` in battle mode (preserved for frontend back-compat — line 205-209).
- **Increment** (`chat.js:424`): `[budgetField]: FieldValue.increment(1)` on successful exchange write.
- **Initial value** (`agentBattleService.js:161`): `chatBudgetUsed: 0` at battle creation. There is no separate `reviewBudgetUsed: 0` initializer — it is implicitly `undefined`, and `chat.js:194` uses `|| 0`. Migration backfill in `agent-evaluate.js:193`.
- **What happens when exhausted:** the user gets the error; the chat tab's send button is disabled (`AgentChat.jsx:447` — `isDisabled = isSending || activeBudgetUsed >= activeBudgetLimit || battleStatus === 'completed'`). The auto-debrief writes to chatExchanges via `FieldValue.arrayUnion` but **does not increment `chatBudgetUsed`** — agent-initiated exchanges currently do not count against the budget. This is a real semantic choice the schema embeds: budget = user-initiated turns, not total exchanges.

**Open inconsistency** — `OpenChatPanel.jsx:37` computes its own budget via `getLevelConfig(gamesPlayed).chatBudget` (level-gated), which can differ from the hardcoded server limit of 10. The server enforces 10 regardless; client display in this panel can show a different number. Not blocking for Phase 1 but worth flagging.

## Category 3: Battle lifecycle

### Q7: Battle creation flow

**Entry:** `POST /api/agent/decide` (`api/agent/decide.js`, 730 lines).

**Sequence** (numbered to match in-file step comments):

1. Auth + rate-limit + method check (lines 40-49).
2. Idempotency: read `agents/{agentId}`, check `deployingAt` lock and `lastDeployedAt` 2-min cooldown (lines 56-84).
3. Fetch `indexIntelligence/stockRankings`, apply archetype-specific scoring (lines 86-97).
3c. Phase 5B1 — read equipped watchlist with soft-degrade (lines 99-126).
4. Fetch recent FantasyTimes stories (lines 128-135).
5. Build market data (CSV format) (lines 136-138).
6. **Sonnet call** — strategic analysis with tool-use, produces `strategy.brief` + `strategy.shortlist` (lines 140-203).
7. **Haiku call** — portfolio construction with tool-use + validation + retry + fallback (lines 221-306).
9. Enrich portfolio with V3 asset objects; build watchlist tiers `{active, hotBench, monitoring}` (lines 308-352).
10. Write `agents/{agentId}.lastDecision` and clear deploy lock (lines 354-369).
11. Check for existing active battle; if found and not expired, return early without creating a new battle; if expired, mark `completed` and proceed (lines 371-432).
12-15. Build sectorMap; generate CPU opponent; fetch entry prices for all symbols; build thresholds from baseATR (lines 434-517).
16. **`createAgentBattle(db, agentData, thresholds, startingPrices, {duration, sectorMap, opponent, equippedWatchlist})`** at **line 540** (`api/_utils/agentBattleService.js:42`).
17. Write `activeBattleId` back to agent doc (line 552).
18. Shadow-log + return.

**What `createAgentBattle` actually does** (`agentBattleService.js:42-201`):

- Builds the `battleDoc` object with all initial state.
- Sets `status: 'active'`, `createdAt: now`, `activatedAt: now`, computes `expiresAt` via `computeFullDayExpiry` (default `fullday` mode).
- Initializes (all the fields relevant to Voice Layer / chat):
  - `chatExchanges: []` (line 160)
  - `chatBudgetUsed: 0` (line 161)
  - `battleLedger: []` (line 157)
  - `statusFeed: []` (line 147)
  - `proposalHistory: []` (line 156)
  - `pendingProposal: null` (line 155)
  - `gameplanMeeting: null` (line 158)
  - `executionMode: 'autopilot'` (line 153) — **this was changed from `'copilot'` by PR #421, with an explicit comment: `// LAUNCH DECISION (2026-05-19): Auto-pilot only. Co-pilot and manual modes are deferred post-launch.`**
- Writes the doc via `db.collection('agentBattles').add(battleDoc)` (line 199).
- Returns `{ id, expiresAt }`.

**Voice-Layer-relevant side effects at battle creation: NONE.** No call to `buildVoiceLayerPrompt`, no call to `callGemmaVoice`, no chat message generation, no DRB/anchorContext read, no `voiceLayerCache` write, no `statusFeed` deploy entry. The agent simply exists on the `agentBattles` collection and waits for the next cron tick to do anything.

### Q8: Deployment events

**There is no existing "deployment event" surface that fires specifically when a battle transitions to active.** I confirmed:

- **No Firestore Cloud Functions triggers in the repo.** `firebase.json` defines hosting + rules + indexes only; no `functions:` section. The codebase uses Vercel cron + endpoint-driven writes, not Firestore triggers.
- **No status-change listener exists in the codebase.** Status transitions to `active` happen in exactly one place (`createAgentBattle:72`), and to `completed` in two places (`decide.js:427-431` when an expired battle is rolled forward, `agent-evaluate.js` battle-end paths). No code listens for these transitions.
- **No side effect of `createAgentBattle` writes anything beyond the battle doc itself.** No queues, no events.
- **The next thing that touches the new battle is the next cron tick** — either:
  - `agent-evaluate.js` (`vercel.json:134-135`, `*/15 13,14,15,16,17,18,19,20,21 * * 1-5`) — runs decision logic, can write to `trades`, `statusFeed`, `evaluations`, `cronState`. Does not call Voice Layer.
  - `voice-layer-cache.js` (`vercel.json:142-143`, `*/15 13,14,15,16,17,18,19,20 * * 1-5`) — pre-computes briefs into `voiceLayerCache/{battleId}`. Does not write to chat.

So **for Phase 1's first-message-on-deploy, there is no existing hook**. The choices are: (a) inline the first-message write directly into `createAgentBattle` (or the decide handler right after it returns); (b) introduce a new "post-create" task — synchronous in the same request, or async via a queue/Firestore-trigger-equivalent; (c) detect the new battle inside the existing `agent-evaluate` cron tick on its first run against a battle whose `chatExchanges` is empty. Each has tradeoffs but they are spec-design choices, not discovery findings.

### Q9: Voice Layer at activation

**Nothing.** At the moment a battle becomes `status: 'active'`:

- No Voice Layer code runs.
- No prompt is generated.
- No chat message is written.
- No `statusFeed` entry tagged "deployed" is written by `createAgentBattle`. (The only "deploy"-flavored writes are in `agent-evaluate.js`'s migration-and-evaluation pass and they don't fire until the cron next ticks.)

The chat is silent until either (a) the user sends the first message via `POST /api/agent/chat`, or (b) the end-of-day `agent-batch-review.js` cron runs and writes an auto-debrief. Between battle deploy and either of those, the chat tab shows nothing — exactly the "silent empty timeline" the Phase 1 spec is intended to replace (per the rework roadmap, line 93).

## Category 4: Boundary verification

### Q10: Phase 1 boundaries

**Trading Brain (Haiku) — not entangled with Voice Layer state.**

- `decide.js` calls Haiku for portfolio construction (`'claude-haiku-4-5-20251001'`, line 229). It reads `agent.config`, `agent.activeRules`, market data — **does not read `chatExchanges`, `directive`, `partnerProfile`, or any other Voice Layer state.**
- `agent-evaluate.js` calls Haiku for SWAP/HOLD decisions. It reads battle state (portfolio, scoring, watchlist, thresholds), market data, rules. It writes `directive` *consumers* via `agent.directives` … actually `chat.js:436-440` notes that directive writes are battle-scoped and were removed from the agent doc; the directive lives at `agentBattle.directive` and Haiku reads it (per the directive-thread integration). So there IS one read path: when the user writes a directive via chat, Haiku eats it on the next eval.
- **Implication:** If Phase 1 changes prompt assembly but keeps directive write semantics intact, the Trading Brain is unaffected. The directive contract (`{ text, expiry, directiveThreadId }`) is the boundary — don't break it.

**Cron (`agent-evaluate.js`) — does NOT call into Voice Layer for decision logic.**

- No import of `voiceLayerPrompt`, `gemmaClient`, or `callGemmaVoice` (verified by grep).
- It writes `entryMode: battle.executionMode || 'autopilot'` onto trades/evaluations (lines 651, 996, 1090, 1517) — these are stamps for *future* Voice Layer narration reads via `detectTradeProvenance`, not Voice Layer invocations.
- The Launch Guard at line 972-978 short-circuits any non-autopilot path.
- **Implication:** Phase 1's mode-aware routing — a Voice Layer change — does not need to modify any decision logic in the cron. The cron just keeps writing `entryMode` snapshots; the Voice Layer reads them.

**Forge — does call `voiceLayerPrompt.js` but the dependency is one-way.**

- `api/forge/workshop-chat.js`, `api/forge/expand-signal.js`, `api/forge/watchlist-dialogue.js` all import `buildVoiceLayerPrompt` and call it with their own `mode` values (`workshop` | `signal_expansion` | `watchlist_dialogue`).
- The Forge does not write to `agentBattles` chatExchanges, does not read `executionMode`, does not modify Voice Layer state.
- **Implication:** Changes to `buildVoiceLayerPrompt`'s signature that affect the battle/review branches won't disturb Forge as long as the Forge mode branches stay intact. If Phase 1 adds a new option (e.g. `executionMode`), it just needs a safe default so Forge callers don't have to pass it.

**`voice-layer-cache.js` (data side) — independent of authority mode.**

- The cache cron writes only briefs/alerts/market context. It doesn't read or write `executionMode`, `chatExchanges`, or Voice Layer prompts.
- The cache shape is consumed by the prompt builder helpers (`buildPortfolioBriefsBlock` etc.) and is invariant under mode changes.

**No surprises found that would entangle Phase 1 with non-Voice-Layer systems.** Phase 1 looks Voice-Layer-only at the seams.

## Open questions / ambiguities

- **One-shot chat load vs proactive messages.** The comment at `AgentChat.jsx:449-452` says Firestore-initiated exchanges appear "on next mount." Is this an acceptable UX for first-message-on-deploy? The chat is empty when the user first arrives, so the first message will render on first load — but if the message lands *while* the user is in the command tab (e.g. first-message generation is async, taking 1-15 seconds after deploy returns), it won't appear without remount. Resolving question: does Phase 1 want to (a) write the first message synchronously inside `createAgentBattle` so it's already in `chatExchanges` by the time the user navigates, (b) remove the one-shot guard, or (c) accept the remount semantic? This is a real product/UX decision for the spec, not something I can answer from code.

- **Where does the first-message author live?** The auto-debrief is a cron. A first-message-on-deploy could live: (a) inline at the end of the `POST /api/agent/decide` handler (synchronous, blocks the 200 response — risky given Gemma's 15s timeout); (b) async post-create via a job queue (no queue exists in this codebase); (c) detected on first `agent-evaluate` tick by checking `chatExchanges.length === 0`. The roadmap (line 99) says "First-message-on-deploy trigger logic" without specifying the locus.

- **Should the first message count against the 10-message budget?** Today, the auto-debrief does not increment `chatBudgetUsed` (writes to `chatExchanges` only). If first-message-on-deploy follows the auto-debrief precedent, the user still gets all 10 turns. But there's no explicit decision in the docs.

- **`reviewBudgetUsed` is never initialized.** `createAgentBattle` initializes `chatBudgetUsed: 0` but not `reviewBudgetUsed`. The first review-mode exchange's `FieldValue.increment(1)` will set it to 1 from an `undefined` field — Firestore handles this, but the initialization asymmetry is a minor smell.

- **Forge `expand-signal.js` Voice Layer call is referenced in `signalDropPrompt.js` comments** (line 12, 257) — the dependency map between Forge and `voiceLayerPrompt.js` is more intertwined than at first glance. Not a Phase 1 blocker but worth knowing.

- **`getLevelConfig(gamesPlayed).chatBudget` in `OpenChatPanel`** vs hardcoded 10 in `chat.js` — possible drift between client-shown and server-enforced budgets. Did not chase down `getLevelConfig` in this discovery pass.

## Things that surprised me

- **The single-export, single-function shape of `voiceLayerPrompt.js`.** I had expected a registry-style module with `mode -> builder` dispatch and discrete prompt-construction modules per mode. What's there is one 2.4k-line function with a long if-else chain on `mode`. Each mode reimplements identity framing inline as a template literal (lines 2121, 2182, 2242, 2290, 2364) rather than reusing a helper. Adding a new mode would mean adding another if-branch and copy-pasting the identity literal — manageable, but the convention is "if-branch per mode," not "registry."

- **The Voice Layer is structurally autopilot-only, but for a different reason than I expected.** I had expected to find authority-mode plumbing exist and be wired only to autopilot at the surface. Instead, **the plumbing simply doesn't exist on the Voice Layer side** — no caller passes `executionMode`, no signature accepts it, no branch reads it. The pre-existing `detectTradeProvenance` is the *only* mode-shaped piece of code in the prompt module and it operates on trade history, not on a current `executionMode` arg. So the Voice Layer is structurally agnostic, not structurally autopilot-only — and the Launch Guard sits in the trading cron, not in the Voice Layer.

- **The chat schema is exchange-shaped, not message-shaped.** Each `chatExchanges[]` entry is a {userMessage, agentResponse} pair, not an individual `{sender, content}` message. This made the auto-debrief's `userMessage: '__REVIEW_START__'` workaround necessary. If Phase 1 introduces more agent-initiated messages, the sentinel-and-flag pattern is the path of least resistance, but it does compound: every new agent-initiated message type would add a new sentinel.

- **`AgentChat.jsx` loads chatExchanges one-shot, defeating the live Firestore listener.** I expected the live listener (`useAgentBattle.js:28` `onSnapshot`) to flow into a reactive render. Instead the chat does a one-shot copy on mount and the comment at line 449-452 explicitly accepts that proactive Firestore writes appear "on next mount." This is the single biggest UX surprise. For Phase 1, if the first message is written before the user navigates to the command tab, it'll render. If it's written *while* they're sitting on the tab, it won't until remount. This is a real Phase 1 design constraint that the spec needs to address.

- **The command-dot indicator is tied to `statusFeed`, not `chatExchanges`.** The dot fires when `statusFeed.length` grows. The auto-debrief lights the dot only because `agent-batch-review.js` writes to **both** `statusFeed` (line 214) and `chatExchanges` (line 300). A first-message-on-deploy that only wrote to `chatExchanges` would not light the dot. That coupling needs to be considered for the spec.

- **PR #421 (the autopilot-default cleanup) is fresh.** It landed on 2026-05-19 and changed `executionMode` default from `'copilot'` to `'autopilot'` and added the Launch Guard in `agent-evaluate.js`. The prior authority-mode discovery (May 19, same day) documented `'copilot'` as the default; that finding is **already stale**. This is the only place the codebase has diverged from that discovery.

- **`buildSwapEntryBlock` and `detectTradeProvenance` are sitting unused at the surface level.** They are exported, tested, and reference autopilot/copilot framing — but I could not find a chat writer that uses them to produce a trade-narration message. They are wired into the *recap* path inside `buildBattleState` / `buildReviewContext`, not into a "narrate this swap to the user" path. So trade narration today exists as **rendering helpers for a future writer**, not as an active proactive narration loop. Phase 2 of the roadmap is the writer — Phase 1 doesn't need to touch this.

## What this means (my honest read)

Phase 1 is **between (a) and (b) on the spectrum**, closer to (b).

The **mode-aware routing piece** is mostly plumbing. The infrastructure to dispatch on mode already exists (the if-else chain in `buildVoiceLayerPrompt` already branches on `mode`, which is the surface axis), and adding a second branching axis for authority mode is mechanical: thread `executionMode` from the battle doc through every caller, accept it on `buildVoiceLayerPrompt`, and make `PHASE_RULES` a 2D lookup `(phase × authorityMode)` — or, given the autopilot-only-for-launch decision, just stamp the autopilot register today and structure the code so co-pilot/manual variants can be added without re-touching every caller. The Forge callers need a no-arg default. None of this is hard, and it does not entangle the Trading Brain, the Forge, or the cache. It is the prerequisite, not the work.

The **first-message-on-deploy piece** is genuinely new infrastructure, and this is where the scope expands beyond "plumbing." Three real obstacles that the spec has to address: (1) no deployment-event surface exists, so the trigger has to be invented (inline in `createAgentBattle` / decide handler vs. detected by the next cron tick vs. some other path) — each option has tradeoffs around latency, transactionality, and request-budget; (2) the `chatExchanges` schema is exchange-shaped, requiring the sentinel pattern the auto-debrief established (acceptable, but cumulative as more agent-initiated message types arrive); (3) the `AgentChat.jsx` one-shot load means a message written "live" while the user is on the command tab will not appear without a remount, so either the first message must be written before the user navigates, or the chat-load semantic must change. The actual prompt design for the first message is craft work, and the roadmap honestly flags 1 week minimum for it — that's real, not pessimistic.

So my honest read: Phase 1 is **a moderate addition that requires extending the Voice Layer to handle a new event (deploy) and a new mode-axis (authority)**, on top of existing-and-working architecture. It is not a substantial green-field expansion (the prompt assembler is in place, the chat schema works, the auto-debrief proves a write-to-chatExchanges-from-the-server precedent exists). It is more than plumbing because of the AgentChat one-shot load, the chat-vs-statusFeed dot decoupling, and the lack of any existing deploy hook — those are three small but real design decisions the spec needs to make before code lands. The roadmap's 2-3 week estimate looks plausible if "first message voice" iteration gets its full week and the architectural choices above are made up front rather than mid-implementation.
