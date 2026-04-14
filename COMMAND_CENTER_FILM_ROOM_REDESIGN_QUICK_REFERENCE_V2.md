# Command Center & Film Room Redesign — Quick Reference V2
## For Claude Code Implementation Sessions

---

## The Core Principle

**The Command Center is the single surface for ALL in-game agent interaction, across all market phases.**

| Want to... | Go to... |
|-----------|----------|
| Coach agent during live market | Command Center chat (battle mode) |
| Review the day's trades after close | Command Center chat (review mode — auto-transitions) |
| Grade trades | Inline cards in Command Center chat |
| See raw trade data / full activity log | Game Tape tab |
| Configure persistent strategy | The Forge |
| See agent identity + growth | Agent Hub |

**Scope:** BaggerBomb agent battles only. Season Mode / Proving Ground retain their own dashboard, activity feed, and pit stop system.

---

## Directive Philosophy: Three-Tier Knowledge System

**THIS IS A FOUNDATIONAL CHANGE.** The agent.directives[] field is deprecated. Nothing writes to it anymore.

| Tier | What It Is | Lives On | Injected Into Haiku? |
|------|-----------|----------|---------------------|
| **Tactical Directives** | Per-game instructions ("Rotate to stable support") | `agentBattles/{id}.directive` (battle doc) | YES — only for the active battle |
| **Lessons Learned** | Observations ("Trigger clustering = false signals") | `agent.lessons[]` (new field on agent doc) | NO — fed to Sonnet consolidation only |
| **Strategic Rules** | Persistent config ("Max 40% in any sector") | `agents/{id}/rules/` (Forge collection) | YES — via Forge rule injection |

**The consolidated insight is the ONLY accumulated wisdom in Haiku's prompt.**
Individual lessons → Sonnet reads every 5 games → produces updated consolidatedInsight → Haiku reads that.

### Lessons Schema
```
agent.lessons[] = [{
  id: string,
  text: string,
  source: 'review_debrief' | 'batch_review' | 'pit_stop',
  sourceGameId: string,
  sourceTrade: string | null,
  createdAt: timestamp,
  consumed: boolean,           // true after Sonnet consolidation reads it
  consumedInConsolidation: string | null
}]
```
**Cap:** 50 lessons. Oldest consumed pruned first. Unconsumed never pruned.

### Migration Script (One-Time)
- Tactical directives (source: 'voice_layer', action verbs) → `agent.archivedDirectives[]`
- Lessons (source: 'batch_review', observations) → `agent.lessons[]`
- Strategic rules → flagged for Forge review
- After: `agent.directives[]` empty. No new writes ever.

### Prompt Assembly Changes
- `agentEvalPromptAssembly.js`: Read consolidatedInsight + Forge rules. STOP reading directives.
- `agentPromptAssembly.js`: Same change (must stay in sync).
- Net token savings: ~800-1200 tokens of directive bloat → ~200 tokens of consolidated insight.

---

## Tab Structure Change

**BEFORE:** Matchups | Command Center | Film Room
**AFTER:** Matchups | Command Center | Game Tape

---

## Voice Layer Modes (Updated)

| Mode | When | Gemma Behavior |
|------|------|----------------|
| battle | Market open, active battle | Discovery/Refinement/Mastery coaching |
| workshop | Forge, no active battle | Strategy building + thesis refinement |
| pit_stop | Season Mode weekly review | Weekly debrief + parameter tuning |
| **review** (NEW) | Market closed + batch review data available | Post-market debrief: trade walk-through, grading, counterfactuals, lessons |

---

## Two-Phase Post-Market Transition

**Phase 1 (4:00–4:15 PM):** Market closes. Batch review hasn't fired. Gemma stays in battle mode with market-closed context. Can offer lightweight read from raw data. Unanswered proposals surfaced as informational cards.

**Phase 2 (after 4:15 PM):** Batch review cron completes → writes dailyReviews[today] → calls Gemma with review mode context → writes debrief message to chatExchanges[]. User sees debrief waiting in chat. All subsequent messages use review mode + separate 5-message review budget.

**Auto-debrief trigger:** The batch review cron (agent-batch-review.js) is EXTENDED to call Gemma and write the response. No new cron slots. +1 Gemma call per battle per day (~$0.002).

---

## New Components

| Component | Purpose |
|-----------|---------|
| TradeTickerCard.jsx | Individual trade card: reasoning + live P&L + ghost price + Forge citations |
| LiveActivityPanel.jsx | Restructured thinking: Haiku evals (teal, primary) + Gemma scratchpad (gray, collapsible) |
| InlineTradingGradeCard.jsx | Swipe/tap grade card in chat timeline (review mode) |
| GameTapeView.jsx | Pure data: trade table + full log + bookmarks + day summary |
| DirectiveThread.jsx | Visual connector: execution card → resulting trades |

## Archived Components

| Component | Replaced By |
|-----------|-------------|
| AgentFilmRoom.jsx | Chat review mode + GameTapeView |
| FilmRoomCard.jsx | Chat review mode debrief |
| TradeGradingCard.jsx | InlineTradingGradeCard |
| CompactTradeLog (in AgentChat) | TradeTickerCard (individual) |

---

## Backend Changes

### agentEvalToolSchema.js — 2 additions
```
trade_reasoning: { thesis, strategy, indicators[], citedRules[], conviction }
directiveThreadId: string (optional)
```
Backward compat: frontend falls back to status_feed_update string when null.

### agentEvalPromptAssembly.js + agentPromptAssembly.js — CRITICAL CHANGE
- **STOP** reading `agent.directives[]`
- **START** reading `agent.consolidatedInsight` (single paragraph) + Forge rules
- Both files must stay in sync

### chat.js — 4 changes
- Review mode detection: `if (marketClosed && dailyReviews[today]) mode = 'review'`
- Directive threadId generation: `threadId = uuid()` on lock-in
- Lesson write: `agent.lessons[]` on agents/{agentId} (NEW Admin SDK write target)
- Forge suggestion write: `agent.forgeSuggestions[]` on agents/{agentId} (same new target)

### agent-batch-review.js — 2 additions
- Call Gemma with review mode context after Haiku batch analysis
- Write debrief message to chatExchanges[] + add summary field to dailyReviews

### voiceLayerPrompt.js — 1 new mode
- Review mode phase rules (~350 tokens)
- Review context block replaces battle state block
- One synthetic few-shot example

---

## Implementation Phases

| # | Phase | Risk | Key Files |
|---|-------|------|-----------|
| 1 | Game Tape Tab | Low | GameTapeView.jsx, AgentBattleScreen.jsx, AgentActivityFeed.jsx (readOnly prop) |
| 2 | Trade Ticker Cards | Medium | TradeTickerCard.jsx, AgentChat.jsx |
| 3 | Live Activity Panel | Medium | LiveActivityPanel.jsx, AgentChat.jsx |
| 4 | **Directive Philosophy Migration** | Medium | Migration script, agentEvalPromptAssembly.js, agentPromptAssembly.js, AgentEvolutionTab.jsx |
| 5 | Review Mode Backend | Medium | voiceLayerPrompt.js, chat.js (lesson + suggestion writes) |
| 6 | Review Mode Frontend | Higher | AgentChat.jsx, agent-batch-review.js (Gemma call), InlineTradingGradeCard |
| 7 | Directive Threading | Medium | chat.js, agentEvalToolSchema.js, DirectiveThread.jsx |
| 8 | Trade Reasoning Structure | Low | agentEvalToolSchema.js, agentEvalPromptAssembly.js |
| 9 | Polish + Ghost Prices | Low | TradeTickerCard.jsx, desktop layout, mobile QA |

**Audit at Phase 4/5 boundary (pre-backend changes).**

---

## Multi-Day Battles

- **During battle:** User sees only today's debrief in chat. Previous days archived.
- **At battle end:** Sonnet reads ALL daily review summaries → comprehensive Battle Report.
- **Game Tape:** Shows all days' trade data (sortable/filterable by day).
- **Daily summary storage:** ~100–200 word summary field in dailyReviews[dayN]. Battle Report reads summaries, not raw trades.

---

## Firestore Impact

- **No new collections**
- **No new crons** (batch review cron extended, not duplicated)
- **New fields:** `agent.lessons[]`, `agent.forgeSuggestions[]`, `agent.archivedDirectives[]`, `agentBattles.reviewBudgetUsed`
- **Deprecated field:** `agent.directives[]` — no new writes, migration script redistributes existing data
- **New tool schema fields:** `trade_reasoning`, `directiveThreadId`
- **All new writes via Admin SDK** — no Firestore rule changes needed

---

## Protected Files

- `api/cron/agent-evaluate.js` — eval cron logic
- `api/_utils/agentRegimeClassifier.js` — regime classification
- `api/_utils/agentRiskManager.js` — risk management
- `api/_utils/agentPresetConfig.js` — preset configs
- `api/agent/debate.js` — debate endpoint
- `src/components/Forge/*` (except ForgeLanding additive read)
- `src/components/Agent/AgentDashboard.jsx` — Hub
- `src/components/Agent/ProposalBanner.jsx` — Co-Pilot proposals
- `src/hooks/useAgentBattle.js` — battle doc subscription
- Season Mode components (SeasonDashboard, PitStopScreen, SeasonActivityFeed)

---

## Resolved Design Decisions (10)

1. **Live Activity in post-market:** KEEP VISIBLE
2. **Trade grading:** OPTIONAL — Gemma offers grade, continues either way
3. **Auto-debrief timing:** TWO-PHASE — lightweight at close, full after 4:15 PM batch review
4. **Trade card density:** ALWAYS INDIVIDUAL
5. **Review budget:** SEPARATE 5-MESSAGE, independent of 10-message battle budget
6. **Budget display:** Text format: "7/10 battle · 5/5 review"
7. **Unanswered proposals:** SHOW AS CARDS at close transition
8. **Directive persistence:** TACTICAL = battle doc. LESSONS = agent.lessons[]. RULES = Forge.
9. **Game Tape interactivity:** readOnly prop — citations yes, bookmarks yes, challenges hidden
10. **Multi-day debriefs:** Today only in chat. Game Tape shows all days. Battle Report at end.

---

## Audit Trail (12 findings, all resolved)

| # | Severity | Issue | Resolution |
|---|----------|-------|------------|
| 1 | CRITICAL | Timing paradox: debrief at 4:00 but batch review at 4:15 | Two-phase transition |
| 2 | CRITICAL | No server-initiated message mechanism | Batch review cron calls Gemma + writes chatExchange |
| 3 | HIGH | forgeSuggestions write target mismatch | New Admin SDK write to agents/{agentId} |
| 4 | HIGH | Firestore rules claim incorrect | All writes Admin SDK, reads via existing hooks |
| 5 | HIGH | Spec silent on Season Mode scope | BaggerBomb only, explicit |
| 6 | MEDIUM | Multi-day debrief history | Today in chat, all days in Game Tape, Battle Report at end |
| 7 | MEDIUM | Backward compatibility | Graceful fallback for all new fields |
| 8 | MEDIUM | AgentActivityFeed read-only | readOnly prop |
| 9 | MEDIUM | Lesson write path used deprecated directives | Full directive philosophy (Section 3 of spec) |
| 10 | LOW | Training data tagging | mode: 'review' on chatExchange entries |
| 11 | LOW | ProposalBanner in post-market | Unanswered proposals as informational cards |
| 12 | LOW | Budget pip dot UX | Text format display |

---

*Last updated: April 13, 2026 — V2 (Post-Audit, Directive Philosophy, All 12 Holes Closed)*
