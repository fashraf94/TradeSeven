# Command Center & Film Room Redesign — Quick Reference V3
## For Claude Code Implementation Sessions

---

## The Core Design Principle

**The chat is the star. Everything else supports the conversation.**

The Command Center is a conversation with your trading partner. Trades are acknowledged with slim notifications, not data cards. The side panel is a calm heartbeat showing your agent is alive. All deep data lives in the Game Tape.

| Want to... | Go to... |
|-----------|----------|
| Coach agent during live market | Command Center chat (battle mode) |
| Review the day's trades after close | Command Center chat (review mode — auto-transitions) |
| Grade trades | Inline cards in Command Center chat |
| See raw trade data / full activity log | Game Tape tab |
| Configure persistent strategy | The Forge |
| See agent identity + growth | Agent Hub |

**Scope:** BaggerBomb agent battles only. Season Mode / Proving Ground retain their own systems.

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
  consumed: boolean,
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

## Tab Structure

**BEFORE:** Matchups | Command Center | Film Room
**AFTER:** Matchups | Command Center | Game Tape ✅ SHIPPED (Phase 1)

---

## Command Center Layout

### Chat (left side on desktop / primary on mobile) ✅ SHIPPED
- Agent + user message bubbles (the star of the show)
- **Slim trade notifications** interleaved chronologically: `⇄ FCX → INTC · STAR · +0.93% · 1:15 PM`
  - Single line, ~36-40px height, teal left accent
  - Tappable symbols → AssetResearchModal
  - Tappable row → switches to Game Tape tab
  - NO reasoning, NO regime pills, NO Forge citations (that detail lives in Game Tape)
- Execution cards ("⚡ DIRECTIVE LOCKED IN") unchanged
- Typing indicator, budget dots, suggested actions unchanged

### Agent Pulse (right side on desktop / "Live Activity" tab on mobile) ✅ SHIPPED
- **Status Indicator:** Pulsing teal dot + one-line status text from latest statusFeed entry (80 char truncation with crossfade on update)
- **Breakthrough Alerts:** Only significant events render as compact cards:
  - `risk_alert` — RED accent
  - `threshold_event` — GOLD #fbbf24 accent
  - `gameplan_meeting` — PURPLE accent
  - `lock` — GOLD accent
  - `hypothesis_resolved` — AMBER accent
  - Auto-dismiss after 60s OR tap to dismiss early. Max 3 visible.
- **Agent Reasoning (N):** Collapsible (default collapsed). Gemma scratchpad cards, gray/muted. Hidden entirely when no entries.
- **"View full activity log →":** Link to Game Tape tab
- Routine evals, holds, watchlist refreshes feed status text only — NOT individual cards

### Game Tape (third tab) ✅ SHIPPED
- Day Summary card (from dailyReviews)
- Trade History table (sortable by Time / P&L / Tier)
- Bookmarked Entries
- Full Activity Log (AgentActivityFeed with readOnly={true})

---

## Voice Layer Modes

| Mode | When | Gemma Behavior |
|------|------|----------------|
| battle | Market open, active battle | Discovery/Refinement/Mastery coaching |
| workshop | Forge, no active battle | Strategy building + thesis refinement |
| pit_stop | Season Mode weekly review | Weekly debrief + parameter tuning |
| **review** (NEW) | Market closed + batch review data available | Post-market debrief |

---

## Two-Phase Post-Market Transition

**Phase 1 (4:00–4:15 PM):** Market closes. Batch review hasn't fired. Gemma stays in battle mode with market-closed context. Unanswered proposals surfaced as informational cards.

**Phase 2 (after 4:15 PM):** Batch review cron completes → writes dailyReviews → calls Gemma → writes debrief to chatExchanges[]. Separate 5-message review budget activates.

**Auto-debrief trigger:** Batch review cron extended with +1 Gemma call. No new cron slots.

---

## Component Status

### Shipped (Phases 1-3 + Rework)

| Component | Status | Purpose |
|-----------|--------|---------|
| GameTapeView.jsx | ✅ SHIPPED | Pure data: trade table + log + bookmarks + summary |
| TradeTickerCard.jsx | ✅ SHIPPED (slimmed) | One-line trade notification in chat timeline |
| LiveActivityPanel.jsx | ✅ SHIPPED (reworked) | Agent Pulse: status + breakthrough alerts + reasoning |
| AgentActivityFeed readOnly | ✅ SHIPPED | Prop hides challenges, keeps citations + bookmarks |

### Remaining (Phases 4-9)

| Component | Phase | Purpose |
|-----------|-------|---------|
| InlineTradingGradeCard.jsx | 6 | Swipe/tap grade card in chat (review mode) |
| DirectiveThread.jsx | 7 | Visual connector: execution card → resulting trades |

### Archived

| Component | Replaced By |
|-----------|-------------|
| AgentFilmRoom.jsx | Chat review mode + GameTapeView |
| FilmRoomCard.jsx | Chat review mode debrief |
| TradeGradingCard.jsx | InlineTradingGradeCard (Phase 6) |
| CompactTradeLog (in AgentChat) | Slim TradeTickerCard notifications |
| ScratchpadCard / TradeEventCard (in AgentChat) | LiveActivityPanel |

---

## Backend Changes (All Remaining — Phases 4-9)

### agentEvalToolSchema.js — 2 additions
```
trade_reasoning: { thesis, strategy, indicators[], citedRules[], conviction }
directiveThreadId: string (optional)
```

### agentEvalPromptAssembly.js + agentPromptAssembly.js — CRITICAL
- **STOP** reading `agent.directives[]`
- **START** reading `agent.consolidatedInsight` + Forge rules
- Both files must stay in sync

### chat.js — 4 changes
- Review mode detection
- Directive threadId generation
- Lesson write to agents/{agentId} (NEW Admin SDK target)
- Forge suggestion write to agents/{agentId}

### agent-batch-review.js — 2 additions
- Call Gemma with review context after Haiku batch analysis
- Write debrief message to chatExchanges[] + summary field

### voiceLayerPrompt.js — 1 new mode
- Review mode phase rules (~350 tokens) + context block + few-shot

---

## Implementation Phases (Updated)

| # | Phase | Status | Key Files |
|---|-------|--------|-----------|
| 1 | Game Tape Tab | ✅ SHIPPED | GameTapeView.jsx, AgentBattleScreen.jsx, AgentActivityFeed.jsx |
| 2 | Trade Ticker Cards | ✅ SHIPPED + REWORKED | TradeTickerCard.jsx (slimmed), AgentChat.jsx |
| 3 | Live Activity Panel | ✅ SHIPPED + REWORKED | LiveActivityPanel.jsx (Agent Pulse), AgentChat.jsx |
| 4 | **Directive Philosophy Migration** | NEXT | Migration script, agentEvalPromptAssembly.js, agentPromptAssembly.js, AgentEvolutionTab.jsx |
| 5 | Review Mode Backend | Pending | voiceLayerPrompt.js, chat.js |
| 6 | Review Mode Frontend | Pending | AgentChat.jsx, agent-batch-review.js, InlineTradingGradeCard |
| 7 | Directive Threading | Pending | chat.js, agentEvalToolSchema.js, DirectiveThread.jsx |
| 8 | Trade Reasoning Structure | Pending | agentEvalToolSchema.js, agentEvalPromptAssembly.js |
| 9 | Polish + Ghost Prices | Pending | TradeTickerCard.jsx, desktop layout, mobile QA |

**Audit completed at Phase 3/rework boundary. ✅ Clear for Phase 4.**

---

## Multi-Day Battles

- **During battle:** User sees only today's debrief in chat. Previous days archived.
- **At battle end:** Sonnet reads ALL daily review summaries → Battle Report.
- **Game Tape:** Shows all days' trade data (sortable/filterable by day).
- **Daily summary storage:** ~100–200 word summary in dailyReviews[dayN].

---

## Firestore Impact

- **No new collections**
- **No new crons** (batch review cron extended)
- **New fields:** `agent.lessons[]`, `agent.forgeSuggestions[]`, `agent.archivedDirectives[]`, `agentBattles.reviewBudgetUsed`
- **Deprecated:** `agent.directives[]` — migration script redistributes
- **New tool schema fields:** `trade_reasoning`, `directiveThreadId`
- **All new writes via Admin SDK** — no Firestore rule changes

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
- Season Mode components

---

## Resolved Design Decisions (12)

1. **Live Activity in post-market:** KEEP VISIBLE
2. **Trade grading:** OPTIONAL — Gemma offers grade, continues either way
3. **Auto-debrief timing:** TWO-PHASE — lightweight at close, full after 4:15 PM
4. **Trade notifications in chat:** SLIM ONE-LINE — detail lives in Game Tape
5. **Review budget:** SEPARATE 5-MESSAGE, independent of 10-message battle budget
6. **Budget display:** Text format: "7/10 battle · 5/5 review"
7. **Unanswered proposals:** SHOW AS CARDS at close transition
8. **Directive persistence:** TACTICAL = battle doc. LESSONS = agent.lessons[]. RULES = Forge.
9. **Game Tape interactivity:** readOnly prop — citations yes, bookmarks yes, challenges hidden
10. **Multi-day debriefs:** Today only in chat. Game Tape shows all days. Battle Report at end.
11. **Agent Pulse panel:** Status indicator + breakthrough alerts only. Routine evals feed status text.
12. **Breakthrough alert colors:** 4-color semantic palette (teal/red/gold/amber/purple). Gold #fbbf24 for scoring events.

---

## Audit Trail (12 spec findings + 4 Phase 1-3 audit findings)

### Spec Audit (V2)
| # | Severity | Issue | Resolution |
|---|----------|-------|------------|
| 1 | CRITICAL | Timing paradox | Two-phase transition |
| 2 | CRITICAL | No server-initiated message | Batch review cron extended |
| 3 | HIGH | forgeSuggestions write target | Admin SDK to agents/{agentId} |
| 4 | HIGH | Firestore rules claim | All writes Admin SDK |
| 5 | HIGH | Season Mode scope | BaggerBomb only |
| 6 | MEDIUM | Multi-day debriefs | Today in chat, all in Game Tape |
| 7 | MEDIUM | Backward compat | Graceful fallback |
| 8 | MEDIUM | readOnly underspec | readOnly prop |
| 9 | MEDIUM | Directive bloat | Three-tier knowledge system |
| 10 | LOW | Training data tags | mode: 'review' |
| 11 | LOW | ProposalBanner state | Unanswered cards |
| 12 | LOW | Budget UX | Text format |

### Phase 1-3 Implementation Audit
| # | Severity | Issue | Resolution |
|---|----------|-------|------------|
| 13 | MEDIUM | Spec needs update for rework | This V3 document |
| 14 | MEDIUM | TradeTickerCard naming | Deferred — functional, rename later |
| 15 | MEDIUM | Evolution tab source prep | Phase 4 handles |
| 16 | LOW | "View full log" link wiring | Verify in Phase 4 testing |

---

*Last updated: April 14, 2026 — V3 (Post-Phase 1-3 Audit, Rework Reflected)*
