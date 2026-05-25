# Dossier System — Discovery Audit Report

**Date:** 2026-05-25
**Auditor:** Claude Code
**Branch audited:** `main` @ `3b6554c39bf428b61918b7a2de0d91e61a07e973`
**Scope:** Read-only investigation, no code modifications. Five parallel subagent searches plus direct file-by-file verification.

---

## Executive Summary

1. **Sprint 1 (Consolidation Writer) is shipped and live in production.** `consolidateAgentEvolution` is wired through `process-pending-reflections.js` → `reflect.js:134` → `applyConsolidation` and atomically writes `disciplines`, `consolidatedInsight`, `evolutionCycle`, `pendingConsolidation: false`, and appends to `evolutionTimeline`. The cron runs every 15 minutes and the consolidation gate fires when `gamesPlayed % 5 === 0`.

2. **Sprint 2's two named target fields (`partnerProfile`, `convictions[]`) remain ZERO-writer orphan reads.** Voice Layer's Block 2 (partner model) and Block 3 (convictions) read these at 16+ sites across `voiceLayerPrompt.js` but no code path anywhere — not chat, not Gemma, not Sonnet, not the consolidation writer — populates them. The 15-dimension partner-profile structure is also referenced by `chat.js:41-56`'s elicitation-target selector, but the answers it elicits are never persisted. **Voice Layer has been shipping for two weeks producing prompts that always say "you have no convictions yet."**

3. **The "handoff artifact" at `agentBattles/{battleId}.handoff` does not exist.** Five of six V1.1 fields (`partnerObservations`, `tensions`, `open_questions`, `carryover_directives` distinct from the existing `directive` flow, `agent_self_reflection` distinct from `dailyReviews[].summary`) have no writer. The legacy auto-debrief (`messageType: 'auto_debrief'` in `chatExchanges[]`) and the per-day `dailyReviews[]` entries on the battle doc remain the only post-battle narrative outputs. Phase 4 (Film Room) shipped as a READ surface over existing fields; it added no new structured extraction. Sprint 2's plan to read a unified handoff artifact has no source.

4. **`battlePatternLogger.js` is an orphan WRITER.** ~187 lines log per-battle pattern data to `agents/{agentId}/battlePatterns/{battleId}` from `agent-evaluate.js:80`, but zero readers exist anywhere in `api/` or `src/`. Accumulated docs since Apr/May 2026 with no consumer. The TODO at line 184 (`// Add retention cleanup cron`) is the only sign anyone noticed.

5. **Layer 1's named fields are mislabeled or partial.** `stockRankings.technicalContext` and `vetoedAtTechnical` do not exist as field names anywhere. The semantically-equivalent data does exist: technical primitives flow through `cronState.intradayMomentum` (battle-level, written from `agent-evaluate.js`) and `proposalHistory[i].snapshot` / `trades[i].snapshot` (per `buildTechnicalSnapshot.js`). The auto-pilot-only product lock makes the entire veto-on-technical-context path dormant — veto UI and capture (`vetoedAtPrice`, `vetoedAtTimestamp`, `scoreAtVeto`) IS built but unreachable because Haiku auto-pilot never raises a proposal that the user can veto.

**Headline for Sprint 2 re-scoping:** Sprint 2 as originally specced (five items: veto capture, battle pattern aggregator, handoff extraction, conviction writer, partner writer) is largely upstream of work that hasn't been done. The conviction/partner writers need a feed; the only signals available today are `chatExchanges[]` (sparse — 5-msg Film Room budget per battle), `memory[]` (one Sonnet reflection per battle), `lessons[]` (Gemma extraction in review mode), and `dailyReviews[]` (Haiku per-day reflection). None of these are partner-shaped or conviction-shaped today — they are agent-self-reflection-shaped or game-design-feedback-shaped. Sprint 2's design has to either (a) build the upstream extraction first, or (b) repurpose Sprint 1's consolidation Sonnet to do conviction/partner curation from the same memory+lessons feed it already reads.

---

## Section A — Dossier Field Write/Read Map

Status legend: ✅ Healthy (writer + readers wired) · 🟡 Wired but unverified runtime · 🟠 Partial · ❌ Not found · 🚨 Orphan

### A.1 `consolidatedInsight` (string) — ✅ HEALTHY, WRITER LIVE

**Writers**
- `api/_utils/agentConsolidationApply.js:267` — `applyConsolidation()` (PRODUCTION). Writes `consolidatedInsight: consolidation.consolidatedInsightText`. Atomic with `disciplines`, `evolutionCycle`, `lessons`, `pendingConsolidation: false`, `evolutionTimeline` arrayUnion.
  - Call chain: `api/cron/process-pending-reflections.js:73` → `api/agent/reflect.js:134` (`consolidateAgentEvolution`) — gated on `gamesPlayed % 5 === 0` (reflect.js:129).
  - Cron schedule: every 15 min (`vercel.json` — `process-pending-reflections` `*/15 13,14,15,16,17,18,19,20,21,22,23,0 * * *`).
- `src/services/agentService.js:233` — `updateConsolidatedInsight()` — 🚨 **STILL ORPHANED.** Zero callers in `api/` or `src/`. Was flagged in the May 1 audit (`AGENT_CONTEXT_ARCHITECTURE_AUDIT_REPORT.md:438-448`); Sprint 1 routed around it via `applyConsolidation` instead of removing it. Worse: this function ALSO clears `memory: []` (line 238), which would directly violate the Sprint 1 funnel-principle constraint that consolidation must not touch `memory[]` (confirmed by `agentConsolidationApply.test.js:232`). Should be deleted.
- `src/services/agentService.js:363` — `seedTestAgent()` writes a hard-coded sample. Dev-only utility, not production.

**Readers**
- `api/_utils/voiceLayerPrompt.js` Block 3 (convictions block) — read at lines 2160, 2224, 2284, 2332, 2401, 2606, 2832, 3058 — across battle / review / workshop / firstmessage / narration / anticipation prompt builders.
- `api/_utils/voiceLayerPrompt.js:881` inside `buildConvictionsBlock()` — emits `YOUR ACCUMULATED WISDOM:\n${consolidatedInsight}`.
- `api/_utils/agentEvalPromptAssembly.js:275-277` — Haiku eval prompt injection.
- `api/_utils/agentPromptAssembly.js:58-60` — Strategy prompt header.
- `api/_utils/agentReflectionUtils.js:268` — Sonnet reflection system prompt context.
- `api/_utils/agentBattleService.js:136` — captured into the battle snapshot at deploy time.
- `api/_utils/agentConsolidationPrompt.js:201,211` — next consolidation reads previous insight as input.
- `src/components/Agent/AgentDashboard.jsx:83-84` — UI preview (truncated to 200 chars).
- `src/components/Agent/AgentEvolutionTab.jsx:284-285` — Timeline subtitle (truncated to 80 chars).

**Verdict:** ✅ Healthy. Writer is live; readers are saturated.

---

### A.2 `disciplines` (object `{ selection: [], execution: [] }`) — ✅ WRITTEN BUT EXTERNAL READERS DEFERRED

**Writers**
- `api/_utils/agentConsolidationApply.js:266` — `applyConsolidation()`. Only writer (per funnel principle, enforced in code comments at lines 3, 6 of the schema file).

**Readers**
- `api/_utils/agentConsolidationPrompt.js:192-193,212-213` — next consolidation cycle reads the current disciplines arrays as input.
- `src/components/Agent/AgentEvolutionTab.jsx:192-195` — UI shows `disciplinesCount.selection` / `.execution` from evolution event metadata (read from the embedded snapshot in `evolutionTimeline[].metadata`, NOT from `agent.disciplines` directly).

**Verdict:** ✅ Writer wired, but 🟠 **structured reads are deferred to a future sprint.** No Voice Layer block reads `agent.disciplines` directly; all three prompt readers (Voice Layer, Haiku eval, Sonnet reflection) still consume the backward-compat `consolidatedInsight` string. This is consistent with Decision #4 in `DOSSIER_SYSTEM_ROADMAP.md:341` (compatibility string preserved) but means the structured data is effectively write-only outside the consolidation feedback loop and one UI counter.

---

### A.3 `lessons[]` — ✅ HEALTHY (multi-writer, multi-reader)

**Writers**
- `api/agent/chat.js:469` — review-mode chat. `agentUpdate.lessons = FieldValue.arrayUnion(lesson)` when Gemma emits `_lesson` after explicit user confirmation (see voiceLayerPrompt.js:355-368 for the user-gating discipline).
- `api/cron/agent-batch-review.js:336` — Gemma auto-debrief. Same `_lesson` extraction pattern.
- `api/_utils/agentConsolidationApply.js:265-269` — mutator: marks absorbed lessons `{ consumed: true, consumedInConsolidation: <iso> }` without removing.
- `api/scripts/migrate-directives.js:91` — one-time data-migration script, not production.

**Readers**
- `api/_utils/agentConsolidationPrompt.js:140,215` (`lessons_unconsumed`) — feeds consolidation Sonnet.
- `src/components/Agent/AgentEvolutionTab.jsx:297` — `(agent.lessons || []).forEach(l => ...)` for timeline event list.
- `api/_utils/voiceLayerPrompt.js:335,349` — comment-only references; no actual read of `agent.lessons` for prompt injection (the body text "lessons go to agent.lessons[]" is instruction to Gemma, not a read).

**Verdict:** ✅ Healthy.

---

### A.4 `memory[]` — ✅ HEALTHY (single writer, rolling window)

**Writers**
- `api/agent/reflect.js:219` — `writeMemoryReflection()`. Rolling 5-game window (`updatedMemory = [...currentMemory.slice(-4), memoryEntry]`).
- (Client-side legacy: `src/services/agentService.js:227` also writes memory via `updateDoc`, but this is the client SDK path used in older flows — no callers traced.)

**Readers**
- `api/_utils/agentPromptAssembly.js:69-70` — strategy prompt "RECENT GAME MEMORY".
- `api/_utils/agentConsolidationPrompt.js:137,214` — consolidation Sonnet input.
- `src/components/Agent/AgentDashboard.jsx:68-69` — UI timeline.
- `src/components/Agent/AgentEvolutionTab.jsx:322,336,461-462` — evolution UI multiple touchpoints.
- `src/hooks/useAgent.js:79` — last-memory accessor.

**Verdict:** ✅ Healthy.

---

### A.5 `convictions[]` — 🚨 ORPHAN READ (NO WRITER)

**Writers**
- **NONE.** Exhaustive `grep` across `api/` and `src/` returned zero production writes to `agent.convictions`. Only references are:
  - `api/_utils/voiceLayerPrompt.test.js:2532` — test fixture initializes `convictions: []`
  - `api/_utils/agentConsolidationPrompt.test.js:158` — test fixture
- The Sprint 1 consolidation tool schema (`agentConsolidationToolSchema.js`) does NOT produce a `convictions` field in its output (verified: 0 matches in that file).

**Readers**
- `api/_utils/voiceLayerPrompt.js` Block 3 — `buildConvictionsBlock(convictions, consolidatedInsight)` called at lines 2158-2159, 2222-2223, 2282-2283, 2330-2331, 2401, 2604-2605, 2830-2831, 3056-3057. Expected entry shape: `{ text, confidence, condition? }` filtered by `confidence >= 0.3`.
- Fallback at `voiceLayerPrompt.js:895`: `'You have no convictions yet. Everything is hypothesis.'`

**Verdict:** 🚨 **ORPHAN READ. Block 3 of every Voice Layer prompt currently emits "you have no convictions yet" because nothing ever writes this field.** This was flagged in the May 1 audit (`AGENT_CONTEXT_ARCHITECTURE_AUDIT_REPORT.md:712`); Sprint 1 explicitly did not address it (it was deferred to Sprint 2 per `DOSSIER_SYSTEM_ROADMAP.md:154-176`). State is unchanged.

---

### A.6 `partnerProfile` (15-dimension object) — 🚨 ORPHAN READ (NO WRITER)

**Writers**
- **NONE.** Same exhaustive search; zero matches for any writer.

**Readers**
- `api/_utils/voiceLayerPrompt.js` Block 2 — `buildPartnerModelBlock(partnerProfile)` at lines 2155, 2219, 2279, 2327, 2398, 2601, 2827, 3053. Expected dimensions iterated at line 825 (`'sector_convictions', ...`) and lines 860 (`partnerProfile?.[dimension]`).
- `api/agent/chat.js:41-56` — `selectElicitationTarget(partnerProfile, recentTargets)`. Picks the lowest-confidence dimension. Called at chat.js:251.
- `api/agent/chat.js:251` — passes profile to elicitation-target selection.
- `api/_utils/agentConsolidationPrompt.js:200,216,325` — reads via `formatPartnerProfileSummary(agent?.partnerProfile)`; but per the function signature at line 325 (`_partnerProfile` underscore-prefixed = unused), this is a stub that returns formatted nothing.

**Verdict:** 🚨 **ORPHAN READ. The elicitation logic exists (chat.js:41-56 selects which dimension to ask about) but the elicited answers are NEVER WRITTEN BACK.** Block 2 of every Voice Layer prompt operates on null. Same as A.5: flagged in May 1 audit, unaddressed by Sprint 1, deferred to Sprint 2.

---

### A.7 `evolutionCycle` (integer) — ✅ HEALTHY

**Writers**
- `api/_utils/agentConsolidationApply.js:268` — `evolutionCycle: newCycle` where `newCycle = (agent?.evolutionCycle || 0) + 1`. Incremented every successful consolidation.
- `src/services/agentService.js:237` — inside the orphan `updateConsolidatedInsight()`; not called.
- `src/services/agentService.js:379` — `seedTestAgent()` hard-codes `2`; dev seed only.

**Readers**
- `api/_utils/agentPromptAssembly.js:60` — strategy prompt header.
- `api/_utils/agentConsolidationPrompt.js:121,206` — consolidation Sonnet input.
- `src/components/Agent/AgentEvolutionTab.jsx:255,263,284,287` — UI timeline iterator.
- `src/components/Agent/AgentLeaderboardTab.jsx:226` — UI badge.
- `src/components/Agent/AgentSidebar.jsx` and `AgentDashboard.jsx` — UI display.

**Verdict:** ✅ Healthy.

---

### A.8 `pendingConsolidation` (boolean) — ✅ WIRED, BUT NO LONGER LOAD-BEARING

**Writers**
- `api/agent/reflect.js:130` — `await agentRef.update({ pendingConsolidation: true })` when `gamesPlayed % 5 === 0`. Set BEFORE consolidation runs.
- `api/_utils/agentConsolidationApply.js:270` — sets `pendingConsolidation: false` atomically on success.

**Readers**
- **No code reader located.** The field is set, immediately consumed within the same cron iteration by the awaited `consolidateAgentEvolution` call right after (reflect.js:134), and cleared. It is never queried by any cron or endpoint.
- Note: the analogous flag `pendingReflection` IS queried (`process-pending-reflections.js:47`) — but that is a different field, and is the actual gate for the cron loop.

**Verdict:** 🟠 The flag exists as a write-then-clear marker but is no longer load-bearing — consolidation is awaited inline in `reflect.js:134`, so the flag is informational only. If consolidation fails it stays `true` until the next 5-game gate, providing audit-trail visibility but not retry behavior.

---

### A.9 `forgeSuggestions[]` — 🚨 ORPHAN WRITE (NO READER)

**Writers**
- `api/agent/chat.js:470` — `agentUpdate.forgeSuggestions = FieldValue.arrayUnion(forgeSuggestion)` when Gemma emits `_forgeSuggestion` after explicit user gating.
- `api/cron/agent-batch-review.js:339` — same pattern from Gemma auto-debrief.

**Readers**
- **No production reader found.** Exhaustive grep returned only the writer sites plus two comment-only mentions in `voiceLayerPrompt.js:335,349` (instruction text to Gemma, not a read).
- UI does not surface `agent.forgeSuggestions` — explicitly noted as a deferred item in `PHASE_4_FOLLOWUP_BACKLOG.md:7-13` ("Forge suggestions display in Film Room… does not surface `agent.forgeSuggestions` filed during chat or batch review").

**Verdict:** 🚨 **ORPHAN WRITE.** The data accumulates indefinitely with no consumer. Two production writers feeding a field that no code reads. Phase 4 follow-up explicitly acknowledges this.

---

### A.10 Summary table

| Field | Writers | Readers | Status |
|---|---|---|---|
| `consolidatedInsight` | 1 prod (consolidation) | 6 prod + 2 UI | ✅ |
| `disciplines` | 1 prod (consolidation) | 1 prod (next consolidation) + 1 UI counter | ✅ writer wired, 🟠 external reads deferred |
| `lessons[]` | 3 prod (chat, batch-review, consolidation mutator) | consolidation + 1 UI | ✅ |
| `memory[]` | 1 prod (reflect) | 5 prod + 3 UI | ✅ |
| `convictions[]` | **0** | 1 prod (Voice Layer Block 3) | 🚨 ORPHAN READ |
| `partnerProfile` | **0** | 2 prod (Voice Layer Block 2 + chat elicitation) | 🚨 ORPHAN READ |
| `evolutionCycle` | 1 prod (consolidation) | 2 prod + 4 UI | ✅ |
| `pendingConsolidation` | 2 prod (reflect set, consolidation clear) | **0** | 🟠 informational only |
| `forgeSuggestions[]` | 2 prod (chat, batch-review) | **0** | 🚨 ORPHAN WRITE |

**Orphan summary:** Three field-level orphans (`convictions`, `partnerProfile` = orphan READS; `forgeSuggestions` = orphan WRITES). One function-level orphan (`updateConsolidatedInsight` at `src/services/agentService.js:233`, doubly obsolete because Sprint 1 wrote a replacement at `agentConsolidationApply.js:288`).

---

## Section B — Sprint 2 Prerequisite State

### B.1 Handoff Artifact — ❌ NOT BUILT AS A UNIFIED ARTIFACT

**Status:** No `agentBattles/{battleId}.handoff` field exists anywhere. Field-by-field check of the six V1.1 schema fields:

| V1.1 field | Exists? | Where (if anywhere) |
|---|---|---|
| `partnerObservations` | ❌ | Zero matches across `api/` and `src/` |
| `tensions` | ❌ | Zero matches |
| `open_questions` | ❌ | Zero matches |
| `carryover_directives` | ❌ as a handoff field | Battle-scoped `directive` exists at `agentBattleService.js:158`, but is set at battle creation and not carried across battles |
| `agent_self_reflection` | ❌ as a handoff field | Approximated by `dailyReviews[i].summary` (Haiku per-day) at `agent-batch-review.js:208` |
| (sixth field) | unverified | Spec name not located in code |

**What DOES exist post-battle in lieu of a handoff:**
- `agentBattle.dailyReviews[]` written by `agent-batch-review.js:214,251`. Per-day Haiku review with fields: `daySummary`, `strategyAnalysis`, `selfGrade`, `selfGradeRationale`, `proposedRules[]`, `lessonLearned`, `counterfactuals[]`.
- `agentBattle.chatExchanges[]` with `messageType: 'auto_debrief'` written by `agent-batch-review.js:299` — the conversational debrief from Gemma's review-mode call.
- `agents/{id}.lessons[]` arrayUnion from the Gemma auto-debrief (`agent-batch-review.js:336`).
- `agents/{id}.forgeSuggestions[]` arrayUnion from the same path (`agent-batch-review.js:339`).
- `agents/{id}.memory[]` rolling-5 from Sonnet reflection (`reflect.js:219`).
- `gameDesignFeedback/{id}` collection write from Sonnet (`reflect.js:275`).

**Phase 4 (Film Room) did not change this.** Film Room shipped as a READ surface over `dailyReviews[]`, `chatExchanges[]`, and `trades[]`. The new chat.js review-mode path (`chat.js:354-471`) reuses the existing `_lesson` / `_forgeSuggestion` extraction — no new structured fields, no handoff artifact write. Confirmed by component code: `FilmRoomScreen.jsx`, `FilmRoomChat.jsx`, `AutoDebriefHero.jsx`, `AnticipationLogSection.jsx`, `DaySummaryCard.jsx` all read existing fields.

**Verdict:** ❌ **Handoff artifact at `agentBattles/{battleId}.handoff` is NOT built. The data is scattered across five locations and three different writers (Sonnet reflection, Haiku batch-review, Gemma auto-debrief). Sprint 2's plan to read a unified handoff at this path has no source.**

---

### B.2 Battle Pattern Aggregator — 🚨 LOGGER EXISTS, AGGREGATOR DOES NOT (ORPHAN WRITER)

**`battlePatternLogger.js` (187 lines):**
- Single export `logBattlePattern(db, agentId, battleId, pattern)` writes to subcollection `agents/{agentId}/battlePatterns/{battleId}` (`battlePatternLogger.js:64`).
- Logged fields: `activeRuleIds`, `bundleId`, `executionMode`, `strategyPreset`, `engagementCount`, `engagementBin`, `presetSwitchPattern`, `result`, `totalScore`, `thresholdHits`, `penalties`, `marketRegime`.
- Called once: `api/cron/agent-evaluate.js:80`.

**Consumers:** **NONE.** Exhaustive `grep -rn "battlePatterns" /home/user/TradeSeven/api /home/user/TradeSeven/src` returned exactly one hit — the writer call site. Zero readers, zero aggregators, no Phase 2 trait detection running against the data.

**Cleanup:** `battlePatternLogger.js:184` has a `// TODO: Add retention cleanup cron` that was never executed. Per the Vercel cron count (39/40 active), there is no cron slot for it anyway without first reclaiming one.

**Verdict:** 🚨 **ORPHAN WRITER.** Working code logging to a subcollection that nothing reads. Sprint 2's "battle pattern aggregator" plan needs to either (a) build a consumer for these logs, or (b) acknowledge that the existing logs are unindexed/unconsumed and design the aggregator against a different source (e.g. `memory[]` + `dailyReviews[]` + `lessons[]`).

---

### B.3 Veto Event Capture — 🟠 BUILT BUT DORMANT

The product launched auto-pilot-only. Veto cannot fire because Haiku auto-pilot executes swaps directly without raising user-facing proposals.

**Veto infrastructure that exists:**
- `api/cron/agent-evaluate.js:1547-1566` writes veto fields on `proposalHistory` entries: `vetoedAtPrice` (line 1557), `vetoedAtTimestamp` (line 1561), `scoreAtVeto` (line 1563), and `vetoed` flag (implicit).
- `api/cron/agent-batch-review.js:75-115` filters vetoed proposals and computes counterfactuals over them.
- `api/_utils/voiceLayerPrompt.js:1992-2000` surfaces veto counterfactuals in Film Room review prompts.
- UI components: `src/components/Agent/ProposalBanner.jsx:263-282` (`handleVeto()`), `src/components/Agent/ProposalCard.jsx:91-104`.

**What does NOT exist:**
- `vetoedAtTechnical` — 0 matches. The "veto at technical context" capture promised by the Layer 1 spec was never built.
- `agentBattles/{battleId}.vetoEvents[]` — does not exist as a separate field; veto data lives inline on `proposalHistory[]`.

**Verdict:** 🟠 **Veto plumbing is built, but the trigger condition (user-facing proposal awaiting confirmation) does not occur in auto-pilot mode.** The veto data path is unreachable in production. Sprint 2's "veto event capture" item is dependent on the co-pilot/manual modes shipping. Per `voiceLayerTradeNarration.js:114-118` comments, those modes are explicitly deferred.

---

## Section C — Layer 1 Verification

Layer 1 was supposed to ship: (a) technical-context fields on stock rankings, (b) intraday momentum cache on voice-layer cache, (c) snapshots at entry and at veto.

### C.1 `stockRankings.technicalContext` — ❌ FIELD DOES NOT EXIST

- `grep -rn "technicalContext" /home/user/TradeSeven` → 0 matches.
- What IS written to `stockRankings` (per `compute-index-intelligence.js:767-802`): `trend`, `pivots`, `levels`, `momentum`, `recentAction`, `technicalScore`, `technicalRank`, `sectorTechnicalRank`, `momentumScore`, `momentumRank`, `momentumFactors`. The data the spec called "`technicalContext`" exists in pieces but never under that name.

**Verdict:** ❌ Field unbuilt under the spec name. Underlying primitives exist.

### C.2 `voiceLayerCache.intradayMomentum` — ✅ BUILT (under different path)

- Lives at `cronState.intradayMomentum` on the battle doc, not on the voiceLayerCache doc directly.
- Writers: `agent-evaluate.js` at lines 761, 776, 801, 873, 1330 — all flush `momentumData.vwap` into `cronState.intradayMomentum`.
- Readers: `voice-layer-cache.js:667` reads from `battle.cronState.intradayMomentum`, then `voice-layer-cache.js:279` maps it into each portfolio brief's `.intraday` field.
- Shape per symbol: `{ vwap, currentPrice, vwapDeviation, sma20_5m, sessionDate }`.

**Verdict:** ✅ Built but path is non-obvious. Naming would benefit from doc clarification.

### C.3 `vetoedAtTechnical` — ❌ FIELD DOES NOT EXIST

- 0 matches anywhere. Neither writer nor reader.
- The closest field is `vetoedAtPrice` (`agent-evaluate.js:1557`), which captures price-only context.
- No orphan reads to flag — nothing reads this field name.

**Verdict:** ❌ Unbuilt. Given auto-pilot-only lock, this is moot for product behavior, but it's worth recording that the Layer 1 spec field name was never implemented.

### C.4 `entryTechnicalSnapshot` — 🟠 FUNCTIONALITY EXISTS UNDER DIFFERENT NAME

- The function `buildTechnicalSnapshot()` exists at `api/_utils/buildTechnicalSnapshot.js:36-113`. Returns `{ symbol, sectorName, trend, momentum, volatility, volume, smaStack, rs, levels, pivots, recentAction, intraday, composite: { technicalScore, technicalRank, sectorTechnicalRank, sectorTechnicalTotal } }`.
- Called from `agent-evaluate.js:32` (imported).
- Snapshots are persisted as `.snapshot` on:
  - `agentBattle.proposalHistory[i].snapshot` (proposal-entry context)
  - `agentBattle.trades[i].snapshot` (executed-trade context, in `agentSwapExecution.js`)
- Readers: `voiceLayerPrompt.js:1215` reads from `proposalHistory`/`trades` for Film Room context.

**Verdict:** 🟠 Functionality is built; the field name in the spec (`entryTechnicalSnapshot`) is not the field name in the code (`.snapshot` on entries). No orphan reads.

### C.5 Technical primitives — ✅ FULLY BUILT

- Computed in `api/_utils/technicalCalculations.js`: `calculateRSI`, `calculateMACD`, `calculateSMA`, `calculateRSISeries`, `calculateBollingerBands`, `calculateATR`, `calculateVolumeProfile`, `calculateVWAP`.
- Stored on `stockTechnicalScores` (daily, via `compute-index-intelligence.js`) and `cronState.intradayMomentum` (intraday).
- Read by `voice-layer-cache.js:115-181` (portfolio briefs), `buildTechnicalSnapshot.js` (snapshot composer), `voiceLayerPrompt.js` (Film Room narration).

**Verdict:** ✅ Healthy.

### C.6 Layer 1 verdict

Functional substance of Layer 1 is mostly built (primitives + intraday cache + entry snapshots). The named fields in the spec (`technicalContext`, `vetoedAtTechnical`, `entryTechnicalSnapshot`) are partially aliases for existing data and partially unbuilt:

| Spec field name | Built? | Real name in code |
|---|---|---|
| `stockRankings.technicalContext` | ❌ | (data exists in scattered fields on stockRankings) |
| `voiceLayerCache.intradayMomentum` | ✅ | `cronState.intradayMomentum` on battle doc |
| `vetoedAtTechnical` | ❌ | (does not exist) |
| `entryTechnicalSnapshot` | 🟠 | `.snapshot` on `proposalHistory[]` and `trades[]` |
| Technical primitives | ✅ | `technicalCalculations.js` |

---

## Section D — Voice Layer Surface Output State

### D.1 Phase 1 — first-message-on-deploy

- Writer: `api/agent/decide.js:563` (`generateFirstMessageOnDeploy`).
- Writes to: `chatExchanges[]` arrayUnion + `statusFeed[]` arrayUnion.
- `messageType`: `'first_message'` (decide.js:884).
- Exchange shape: `{ userMessage: null, agentResponse, scratchpad, hasDirective: false, directive: null, suggestedActions: null, elicitationTarget: 'first_message', timestamp, mode: 'battle', messageType: 'first_message' }`.
- `authorityMode`: does NOT exist on the agent doc. `executionMode` parameter exists in `buildFirstMessagePrompt()` (voiceLayerPrompt.js:2584) but is unused (`// eslint-disable-line no-unused-vars`). `battle.executionMode || 'autopilot'` is read at decide.js:824, but only `'autopilot'` is supported at launch. Co-pilot / manual scaffolding exists in comments only (`voiceLayerTradeNarration.js:114-118`).

### D.2 Phase 2 — trade narration

- Writer: `api/_utils/voiceLayerTradeNarration.js:230-233` (`generateTradeNarration`).
- Called from: `api/cron/agent-evaluate.js:1332-1370` — two trigger paths gathered into one Promise.allSettled batch:
  - Risk-triggered swap path (agent-evaluate.js:621-685)
  - Haiku auto-pilot swap path (agent-evaluate.js:980-1027)
- Writes to: `chatExchanges[]` + `statusFeed[]`.
- `messageType`: `'trade_narration'` (voiceLayerTradeNarration.js:203).
- Exchange includes: `tradeContext: { symbolOut, symbolIn, tier, swapTimestamp, evaluationId, provenance }`.
- **Provenance tag IS captured**: `tradeContext.provenance` (line 210), computed via `detectTradeProvenance(closedTrade, battle.proposalHistory)` at line 117. Values: `'autopilot'` (Haiku decision) or `'risk_triggered'` (protective rule). Narration prompt uses this to frame confidence (voiceLayerPrompt.js:2705-2713).

### D.3 Phase 3 — anticipation messages

- Writer: `api/_utils/voiceLayerAnticipation.js:217-220` (`generateAnticipation`).
- Called from: `api/cron/agent-evaluate.js:1392-1402` in the finally block after narrations settle.
- Writes to: `chatExchanges[]` ONLY (no statusFeed — explicit design decision per spec §2 Decision 6).
- `messageType`: `'anticipation'` (voiceLayerAnticipation.js:200).
- Exchange includes: `anticipationSource: 'haiku'`, `anticipationContext: { symbol, direction, threshold, evaluationId }`.
- **Trigger discipline**: state-transition — fires only when Haiku populates the `anticipationCandidates[]` field in its structured tool output (agent-evaluate.js:942). One message per candidate (line 943 loop). Silence is the default.
- **Cron-budget guard**: agent-evaluate.js:1390-1406 skips the batch if remaining cron budget < 12s. Skipped instances logged with `errorStep: 'cron_budget_skip'` via shadowLogger.
- **`anticipationCandidates` field on the agent doc**: does NOT exist as a persisted field. The candidates flow only through Haiku's structured output → narration writer → `anticipationContext` on the chat exchange. Schema defined at `agentEvalToolSchema.js:146`.

### D.4 Phase 4 — Film Room

- **READ surfaces** (Phase 4 shipped these):
  - `src/screens/FilmRoomScreen.jsx` — orchestrator; reads `battle.chatExchanges`, `battle.dailyReviews`, etc.
  - `src/components/FilmRoom/FilmRoomChat.jsx` — review-mode chat front-end; filters exchanges (`mode === 'review' && messageType !== 'auto_debrief'`, line 169).
  - `src/components/FilmRoom/AutoDebriefHero.jsx` — filters `messageType === 'auto_debrief'`.
  - `src/components/FilmRoom/AnticipationLogSection.jsx` — filters `messageType === 'anticipation'`.
  - `src/components/FilmRoom/DaySummaryCard.jsx` — reads `dailyReviews[i]`.
- **WRITE path** (review-mode chat): `api/agent/chat.js:354-471`. Persists user/agent exchange to `chatExchanges[]`, plus arrayUnion to `agents/{id}.lessons[]` (chat.js:469) and `agents/{id}.forgeSuggestions[]` (chat.js:470) when Gemma extracts `_lesson` / `_forgeSuggestion` under user-gating discipline.
- **Budget cap**: 5 messages per battle (`reviewBudgetUsed`, per-battle counter). Per `PHASE_4_FOLLOWUP_BACKLOG.md:25-29`, per-day budget reset is filed as a follow-up.
- **Auto-debrief still primary**: `messageType: 'auto_debrief'` written by `agent-batch-review.js:299` is still the only batch-generated post-battle narrative. Film Room added a Q&A layer over it, not a replacement.
- **No handoff artifact written by Film Room.** No structured extraction beyond the lesson/forge-suggestion pipeline that was already there.

### D.5 messageType inventory

Every `messageType` value written today:

| `messageType` | Writer file:line | Consumer file:line | Notes |
|---|---|---|---|
| `'first_message'` | `api/agent/decide.js:884` | `src/utils/renderMessageWithEntities.jsx:111`; `FilmRoomChat.jsx:169` | Phase 1 |
| `'trade_narration'` | `api/_utils/voiceLayerTradeNarration.js:203` | `renderMessageWithEntities.jsx:111`; `FilmRoomChat.jsx:169` | Phase 2 |
| `'anticipation'` | `api/_utils/voiceLayerAnticipation.js:200` | `renderMessageWithEntities.jsx:111`; `FilmRoomChat.jsx:169`; `AnticipationLogSection.jsx:14` | Phase 3 |
| `'auto_debrief'` | `api/cron/agent-batch-review.js:299` | `AutoDebriefHero.jsx:16`; `FilmRoomChat.jsx:151`; `renderMessageWithEntities.jsx:112` | Legacy + Phase 4 read |
| *(unset)* | `api/agent/chat.js:428-441` — user-initiated chat does not write `messageType` | UI coerces to `'user_initiated'` at `FilmRoomChat.jsx:169` | Pre-Phase-1 messages have no messageType field |

`RENDER_CONFIG` at `renderMessageWithEntities.jsx:102-108` has explicit configs for all five types with fallback.

### D.6 Shadow logging state

**`shadowLogger.js` (142 lines).** Total logger functions exported: 15. Streams in use:

| Stream | Logger fn | Callers found |
|---|---|---|
| `conversations` | `logConversation` | `chat.js`, `forge/workshop-chat.js` |
| `decisions` | `logDecision` | `decide.js` |
| `reflections` | `logReflection` | `reflect.js` |
| `evaluations` | `logEvaluation` | `cron/agent-evaluate.js` |
| `compilations` | `logCompilation` | `forge/compile-dimensions.js` |
| `partner_signals` | `logPartnerSignal` | **NONE** 🚨 |
| `strategy_configs` | `logStrategyConfig` | `season/create-entry.js` |
| `pipeline_decisions` | `logPipelineDecision` | **NONE** 🚨 |
| `review_interactions` | `logReviewInteraction` | `season/generate-debrief.js`, `season/pit-stop-reply.js`, `season/log-lockin.js` |
| `daily_regime_brief` | `logDailyRegimeBrief` | `cron/compute-daily-regime-brief.js` |
| `vision_transitions` | `logVisionTransition` | **NONE** 🚨 |
| `vision_constraint_changes` | `logVisionConstraintChange` | **NONE** 🚨 |
| `signal_drops` | `logSignalDrops` | `injectionGuard.js`, `sanitizeParsedOutput.js`, `agentGuardrails.js`, `forge/parse-signal.js`, `forge/expand-signal.js`, `equip-watchlist.js` |
| `first_message` | `logFirstMessage` | `decide.js` |
| `trade_narration` | `logTradeNarration` | `voiceLayerTradeNarration.js` |
| `anticipation` | `logAnticipation` | `voiceLayerAnticipation.js`, `cron/agent-evaluate.js` (for cron_budget_skip) |
| `agent_consolidation` | `logConsolidation` | `agentConsolidationApply.js` |

**🚨 Orphan logger functions** (exported but zero callers): `logPartnerSignal`, `logPipelineDecision`, `logVisionTransition`, `logVisionConstraintChange`.

**Error handling**: `appendToStream()` (shadowLogger.js:34-57) wraps the GCS write in try/catch and logs to `console.error` only. Never throws. Module docstring at line 4: "NEVER throws. NEVER blocks. All errors are swallowed after console.error." All callers additionally use `.catch(() => {})` for fire-and-forget enforcement.

**DRB shadow-logger silence**: `compute-daily-regime-brief.js:222-235` calls `logDailyRegimeBrief(...).catch(() => {})`. If GCS credentials are absent or invalid, the call silently fails. The cron returns HTTP 200 either way. There is no in-code health check that surfaces whether the writes actually landed. Per Section G.1, this is the reported "Apr 30 silently failing" bug; the swallow-pattern is intentional but the lack of observability is the root issue.

---

## Section E — Available Inputs for Sprint 2 Writers

This synthesis answers: in today's auto-pilot-only world, what signal sources could feed a conviction writer and a partner writer?

### E.1 Catalog of candidate signal sources

| Source | Path | Producer | Per-battle volume | Sprint 2 utility |
|---|---|---|---|---|
| **Sonnet self-reflection** | `agent.memory[]` (rolling 5) | `reflect.js:219` per battle | 1 entry/battle | High — already first-person, lesson-shaped. Sprint 1 already consumes for `disciplines`. Could also feed partner/conviction inference. |
| **Haiku per-day review** | `agentBattle.dailyReviews[]` | `agent-batch-review.js:214,251` | 1 entry/trading day | Medium — structured (`selfGrade`, `selfGradeRationale`, `lessonLearned`, `counterfactuals[]`). Currently consumed only by Film Room UI. |
| **Gemma auto-debrief narrative** | `chatExchanges[]` with `messageType: 'auto_debrief'` | `agent-batch-review.js:299` | 1 entry/battle | Medium — conversational, rich in voice but unstructured. Persisted in chatExchanges. |
| **Gemma auto-debrief extraction** | `agent.lessons[]` arrayUnion | `agent-batch-review.js:336` | 0–N entries/battle | High — already curated lesson-shaped. Consumed by consolidation Sonnet. |
| **Gemma auto-debrief Forge** | `agent.forgeSuggestions[]` | `agent-batch-review.js:339` | 0–N entries/battle | **🚨 orphan write** — nothing reads. Could be a partner-shaped signal if interpreted as user-relevant rule preferences. |
| **Film Room Q&A** | `chatExchanges[]` no messageType | `chat.js:428-441` | 0–5 entries/battle (budgeted) | **HIGH for partner writer** — only signal that captures user's direct voice post-battle. Currently extracted only as `_lesson` / `_forgeSuggestion`. Could plausibly extract `_partnerProfileUpdate` / `_convictionUpdate` via same pattern. |
| **In-battle chat** | `chatExchanges[]` no messageType | `chat.js` | Variable | **HIGH for partner writer** — only signal capturing user's mid-battle reactions/instructions. Same extraction pattern would apply. |
| **Anticipation user response** | `chatExchanges[]` follow-up after `messageType: 'anticipation'` | `chat.js` (user-initiated reply) | Variable; not separately tagged | Medium — would require ordering analysis to identify "responses to anticipation" specifically. |
| **First-message user response** | `chatExchanges[]` after `messageType: 'first_message'` | `chat.js` | 0–1 entries | High — captures user's stated intent at battle deployment. Currently routed through `selectElicitationTarget` (chat.js:251) but **the elicited answer is not stored to `partnerProfile`**. |
| **gameDesignFeedback** | `gameDesignFeedback/{id}` collection | `reflect.js:275` | 1 entry/battle | Low for Sprint 2 — game-design-shaped, not partner/conviction-shaped. |
| **Battle pattern logs** | `agents/{id}/battlePatterns/{battleId}` | `agent-evaluate.js:80` | 1 entry/battle | **🚨 orphan write** — could feed cross-battle pattern extraction once a reader exists. |
| **Watchlist equip events** | `agentBattle.equippedWatchlist*` | `equip-watchlist.js` | 0–1 entries/battle | Medium for partner writer — user's stated stock-universe preference is a partner-profile dimension (sector_convictions, learning_orientation). Persisted but not interpreted. |
| **Signal Drop events** | `signalDrops/{id}` (and shadow stream `signal_drops`) | `forge/parse-signal.js`, `equip-watchlist.js` | Variable | Low — already user-initiated rule construction, more conviction-shaped than partner-shaped. |
| **Forge interactions** | `agents/{id}.activeBundle` updates; `forgeBundles` | `forge/*` | Variable | Medium for conviction writer — bundle composition signals what rules the user trusts. |
| **Veto events** | `agentBattles/{battleId}.proposalHistory[].vetoedAt*` | `agent-evaluate.js:1547-1566` | **0/battle in auto-pilot** | None today — infrastructure exists but cannot fire in current product mode. |

### E.2 What's missing that Sprint 2 would need

**For the conviction writer:**
- No persistent conviction-state across battles. `memory[]` is rolling-5 only.
- Sprint 1's `disciplines.selection` arrays are functionally conviction-like but written as agent-self-disciplines, not as conviction-about-the-market statements. The schema at `agentConsolidationToolSchema.js:59` treats disciplines as behavioral principles, not market beliefs.
- No outcome-correlation pipeline — trades happen and produce `trades[].snapshot` but no system aggregates "X conviction → Y outcome" across battles.
- The Voice Layer Block 3 expects `convictions[]` of shape `{ text, confidence, condition? }` with `confidence >= 0.3` threshold — none of the existing signal sources naturally produce this shape.

**For the partner writer:**
- No persistent `partnerProfile` state. The 15-dimension schema is referenced (`chat.js:41-56` knows the dimension names) but never written.
- Elicitation logic exists (`selectElicitationTarget` picks lowest-confidence dimension) but the elicited answers are never stored. **Two weeks of Phase 1 first-messages have produced user responses that were never persisted in a partner-profile-shaped way.**
- Watchlist equip preferences and Forge bundle choices are user-revealed preferences that could feed dimensions like `sector_convictions` and `tier_philosophy`, but no aggregator exists.
- Chat transcripts (in-battle + Film Room Q&A) contain partner-shaped signal in natural language, but no extraction prompt exists.

### E.3 Synthesis

Three feasible architectures for Sprint 2, listed in increasing scope:

**Option 1 — Reuse consolidation Sonnet.** Sprint 1's `consolidateAgentEvolution` already reads `memory[]`, `lessons[]`, and existing disciplines. Extending its tool schema to ALSO emit `convictions[]` and `partnerProfile.{dimension}` updates is the smallest delta. Risk: violates the original Dossier funnel framing (single writer of dossier — but the writer IS already the consolidation Sonnet), and overloads one prompt with three judgment tasks.

**Option 2 — Gemma `_partnerProfileUpdate` / `_convictionUpdate` extraction in chat.** Per the `DOSSIER_SYSTEM_ROADMAP.md:162` plan: extend chat.js to apply these to queue fields, then consolidation Sonnet curates. Requires that Film Room Q&A or in-battle chat be the source. Risk: 5-message Film Room budget per battle is sparse signal.

**Option 3 — Dedicated post-battle extractor cron.** A new cron reads `dailyReviews[]`, `chatExchanges[]`, `memory[]`, `lessons[]` per completed battle and runs Sonnet to extract partner-shaped and conviction-shaped statements into pending queues. Risk: cron slot pressure (39/40), and overlap with existing reflection chain.

**The minimum scope to make Voice Layer Block 2 and Block 3 stop saying "no convictions yet" / empty partner data:**
1. Pick a signal source (lessons + memory are the easiest because consolidation already reads them).
2. Pick a writer (consolidation Sonnet is the easiest because it already exists).
3. Extend tool schema + prompt to emit shaped outputs.
4. Extend `applyConsolidation` to write the new fields.

All Sprint 2 items as originally specced (veto capture, battle pattern aggregator, handoff extraction) are upstream items that DON'T need to ship for Voice Layer Blocks 2 and 3 to start operating on non-empty data. They were specced as prerequisites, but in the auto-pilot-only world, the consolidation Sonnet has enough input already.

---

## Section F — Vision System State

**Verdict: UNCHANGED from the May 1 audit. Vision remains a museum piece.**

### F.1 Lifecycle states

Six states defined in `src/constants/visionEnums.js:22` (`VISION_LIFECYCLE_STATES`): `unformed`, `proposed`, `active`, `under_debate`, `stale`, `retired`.

| State | Reachable today? | Path |
|---|---|---|
| `unformed` | ✅ | `src/firebase/firebaseService.js:240` → `src/types/vision/visionFactory.js:42` at battle creation |
| `proposed` | ❌ | No transition writer |
| `active` | ❌ | No transition writer |
| `under_debate` | ❌ | No transition writer |
| `stale` | ❌ | No transition writer |
| `retired` | ✅ | `api/cron/agent-evaluate.js:1925-1942` at battle end |

15 valid transitions are defined in `src/types/vision/visionTransitions.js:25-145`; only 2 fire (`null → unformed` and `unformed → retired`). Same as May 1 audit.

### F.2 Constraints array

Three constraint types declared in `VISION_CONSTRAINT_TYPES`: `user_carveout`, `category_b_forge`, `system_injected`. **Zero writers shipped for any of the three.**

- `user_carveout` would require Gemma to emit `_carveout` in Voice Layer output. The voiceLayerPrompt.js output schema (lines 14-41) has only `directive`, `_lesson`, `_forgeSuggestion`, `suggestedActions` — no carveout.
- `category_b_forge` would require deploy path to snapshot Forge rules into Vision. Not present.
- `system_injected` would require Risk Manager to persist outcomes to `vision.constraints[]`. `grep -n "vision" api/_utils/agentRiskManager.js` returns 0 hits.

Production state: `constraints` array is born `[]` and dies `[]` 100% of the time.

### F.3 Readers (operating on empty data)

- `api/cron/agent-evaluate.js:586-600` reads full `battle.vision`; if absent, sets `visionState = { present: false }`.
- `api/_utils/agentEvalPromptAssembly.js:575` reads `visionState.activeConstraints`, calls `renderActiveConstraints()` which renders `'  (none)'` (line 536) when empty.
- `api/_utils/visionRuntime.js:20-54` filter function returns `[]` if input is `[]`.
- **Voice Layer does not read Vision.** `grep -n "vision" api/_utils/voiceLayerPrompt.js` → 0 hits. Only legacy `directive` fields are consumed.

### F.4 Spec status

- **Spec A** (type system + Haiku reading): shipped. Type system + factories + validators + `buildVisionStateBlock()` in Haiku eval prompt.
- **Spec B** (trigger gate extension to write Vision transitions): NOT shipped. Trigger gate itself exists at `agentTriggerGate.js` but no Vision writer.
- **Spec C** (Voice Layer rewrite for Vision lifecycle): NOT shipped. Voice Layer still doesn't read Vision.
- **Spec D** (Haiku tool schema for Vision): shipped (`agentEvalToolSchema.js` includes Vision-aware fields).
- **Spec E** (Risk Manager → `system_injected` constraints): NOT shipped.

### F.5 Implication for Sprint 2 and Sprint 5

Sprint 2 is **NOT blocked** by Vision (Vision is inert and isolated from Dossier writers).

Sprint 5 (Vision↔Dossier boundary) **remains blocked** by Spec B/C/E. Per `DOSSIER_SYSTEM_ROADMAP.md:256`: "Don't design until Sprint 4 ships AND the Voice Layer rewrite for Vision lifecycle… is closer to complete." Since May 1 it has not moved.

**Sprint 2 design implication:** Any partner/conviction writer designed now should avoid writing to fields that Sprint 5 will want to use as the Vision↔Dossier interface (`dossierInputs.pendingBattleInsights[]` is the planned funnel slot per roadmap §3 Sprint 5). Keep the writers in their own pending queues.

---

## Section G — Adjacent Infrastructure Status

### G.1 DRB shadow logger GCS bug

**Status:** ⚠️ Behavior unchanged — confirmed silent-failure pattern present. Whether GCS writes actually fail in production cannot be verified from code alone (this audit is read-only and cannot inspect the live GCS bucket).

- `api/_utils/shadowLogger.js:34-57` (`appendToStream`): try/catch (lines 38-56) catches all errors. Body logs to `console.error` (lines 54-55) then returns. Never throws.
- Module-level docstring at `shadowLogger.js:4`: "NEVER throws. NEVER blocks. All errors are swallowed after console.error."
- `api/cron/compute-daily-regime-brief.js:222-235`: calls `logDailyRegimeBrief(...).catch(() => {})` — explicitly silences any rejection.
- No recent commit modifies error handling in either file.

**If the writes are failing since Apr 30 as session-summary claims, the bug is observability-shaped, not logic-shaped.** The code does what it was designed to do. The failure surface is the absence of training data accumulating in GCS, which can only be detected by inspecting the bucket or by adding a health metric in the cron.

### G.2 Cron slot pressure

Per `vercel.json`:
- Total cron entries: **39** (`grep -c '"path"' vercel.json`).
- Vercel ceiling: 40.
- Headroom: **1 slot.**

Notable observation: Sprint 2's plan to add a "battle pattern aggregator" cron would consume the last slot. Sprint 2 should either reclaim a slot (the `battlePatternLogger`'s missing cleanup cron, the orphan loggers' streams that aren't called) or run aggregation inline with an existing cron (e.g. piggyback on `process-pending-reflections` or `agent-batch-review`).

### G.3 Firestore composite indexes

Per `firestore.indexes.json` and `FIRESTORE_INDEX_DRIFT_CLEANUP.md`:
- Indexes in source file: 23 composite indexes across 9 collections (agentBattles, bugReports, drafts, earningsEntries, fantasyTimesBatches, fantasyTimesStories, gameDesignFeedback, ingestedClaims, seasonEntries).
- 13+ production-only indexes NOT in source file. Every `firebase deploy --only firestore:indexes` would prompt to delete them.
- 1 malformed `ingestedClaims` entry causes HTTP 400 from Firestore API on deploy.
- Cleanup workstream: **pending.** Documented in `FIRESTORE_INDEX_DRIFT_CLEANUP.md`. Estimated 30–60 min, 5 phases. Not yet executed.

**Sprint 2 risk:** any new query the partner/conviction writer needs (e.g. cross-battle aggregation across `agentBattles` filtered by `agentId` + `completedAt`) may need a composite index. Until the drift is reconciled, new indexes must be dual-written (file + Firebase Console) per `PHASE_4_FOLLOWUP_BACKLOG.md:127-132`.

---

## Appendix — Notable file paths and line references

### Sprint 1 consolidation chain (PRODUCTION)

| Step | File:line |
|---|---|
| Battle completes; sets `pendingReflection: true` | `api/cron/agent-evaluate.js:1974` |
| Cron picks up battle | `api/cron/process-pending-reflections.js:44-50` (every 15 min) |
| Calls `generateReflection` | `api/cron/process-pending-reflections.js:73` |
| Writes `memory[]` rolling-5 | `api/agent/reflect.js:219` |
| Writes `gameDesignFeedback/{id}` | `api/agent/reflect.js:275` |
| Gates consolidation on `gamesPlayed % 5` | `api/agent/reflect.js:129` |
| Sets `pendingConsolidation: true` | `api/agent/reflect.js:130` |
| Calls `consolidateAgentEvolution` | `api/agent/reflect.js:134` |
| Re-reads agent doc | `agentConsolidationApply.js:291` |
| Builds Sonnet prompt | `agentConsolidationApply.js:297` (from `buildConsolidationPrompt`) |
| Calls Sonnet (claude-sonnet-4-20250514) | `agentConsolidationApply.js:302-313` |
| Validates output | `agentConsolidationApply.js:341` (`validateConsolidationOutput`) |
| Atomic update of all dossier fields | `agentConsolidationApply.js:265-273` |
| Shadow-logs run | `agentConsolidationApply.js:371-379` (`logConsolidation`) |

### Sprint 2 fields with NO production writer

- `agent.convictions[]` — read by `voiceLayerPrompt.js` lines 2158-9, 2222-3, 2282-3, 2330-1, 2604-5, 2830-1, 3056-7. **0 writers.**
- `agent.partnerProfile.{15 dimensions}` — read by `voiceLayerPrompt.js` lines 2155, 2219, 2279, 2327, 2398, 2601, 2827, 3053 and `chat.js:41-56,251`. **0 writers.**

### Orphan code

| Symbol | Location | Status |
|---|---|---|
| `updateConsolidatedInsight()` | `src/services/agentService.js:233` | Orphan function. Sprint 1 wrote a replacement at `agentConsolidationApply.js:265-273`. Should be deleted; also dangerously clears `memory: []` which violates funnel principle. |
| `battlePatternLogger.logBattlePattern()` | `api/_utils/battlePatternLogger.js:64` | Orphan writer. Subcollection `agents/{id}/battlePatterns/{battleId}` accumulates with no consumer. |
| `logPartnerSignal`, `logPipelineDecision`, `logVisionTransition`, `logVisionConstraintChange` | `api/_utils/shadowLogger.js:64, 71, 109, 110` | Orphan logger exports. No callers. |
| `agent.forgeSuggestions[]` writes | `api/agent/chat.js:470`, `api/cron/agent-batch-review.js:339` | Orphan writes. No reader. Flagged in `PHASE_4_FOLLOWUP_BACKLOG.md:7-13`. |

### Voice Layer mode-aware entry points

| Mode/context | Prompt builder fn | File:line |
|---|---|---|
| Battle mode | `buildBattleSystemPrompt` (or similar) | `voiceLayerPrompt.js` ~2140 |
| Review mode | `buildReviewSystemPrompt` | `voiceLayerPrompt.js` ~2200 |
| Workshop mode | `buildWorkshopSystemPrompt` | `voiceLayerPrompt.js` ~2260 |
| First-message mode | `buildFirstMessagePrompt` | `voiceLayerPrompt.js:2584` |
| Trade-narration mode | `buildTradeNarrationPrompt` | `voiceLayerPrompt.js:2820` |
| Anticipation mode | `buildAnticipationPrompt` | `voiceLayerPrompt.js:3033` |

(Line numbers approximate — each builder is the call site for `buildPartnerModelBlock` and `buildConvictionsBlock` listed in Section A.)

### Phase 4 (Film Room) component map

| Component | Reads | File |
|---|---|---|
| `FilmRoomScreen` | `agentBattle` (full) | `src/screens/FilmRoomScreen.jsx` |
| `AutoDebriefHero` | `chatExchanges[]` filtered `messageType === 'auto_debrief'` | `src/components/FilmRoom/AutoDebriefHero.jsx:16` |
| `AnticipationLogSection` | `chatExchanges[]` filtered `messageType === 'anticipation'` | `src/components/FilmRoom/AnticipationLogSection.jsx:14` |
| `FilmRoomChat` | `chatExchanges[]` filtered review-mode user/agent (5-msg budget) | `src/components/FilmRoom/FilmRoomChat.jsx:151,169` |
| `DaySummaryCard` | `dailyReviews[]` | `src/components/FilmRoom/DaySummaryCard.jsx` |
| `TradeHistorySection` | `trades[]` | `src/components/FilmRoom/TradeHistorySection.jsx` |
| `ScoreSummaryCard` | `scoreState`, `tradeMetrics` | `src/components/FilmRoom/ScoreSummaryCard.jsx` |

### Vision system

| Concern | File:line |
|---|---|
| State enum | `src/constants/visionEnums.js:22` |
| Transitions table | `src/types/vision/visionTransitions.js:25-145` |
| Factory (creates `unformed`) | `src/types/vision/visionFactory.js:42` |
| Battle-creation call | `src/firebase/firebaseService.js:240` |
| Retire-at-battle-end call | `api/cron/agent-evaluate.js:1925-1942` |
| Haiku Vision read | `api/cron/agent-evaluate.js:586-600` + `agentEvalPromptAssembly.js:575` |
| Constraint render | `api/_utils/agentEvalPromptAssembly.js:536-552` (returns `'(none)'` when empty) |
| Runtime filter | `api/_utils/visionRuntime.js:20-54` |
