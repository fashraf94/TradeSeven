# Agent Context Architecture Audit

**Date:** 2026-05-01
**Branch:** `claude/agent-context-architecture-7XLjW`
**Scope:** Read-only discovery across Vision, Voice Layer, Forge, Lessons, three-model stack, and cross-battle persistence to identify the architectural niche a per-agent Context Dossier would occupy.

---

# Section 1: Vision Object — Implementation State

## 1.1 Type definitions, factory, validators, runtime

The Vision schema is fully defined and matches Spec A V1.x as documented in the source files themselves:

- `src/types/vision/visionTypes.js` — JSDoc typedefs for `Vision`, `VisionThesis`, `VisionConstraint`, `VisionEvidenceEntry`, `VisionConditionSnapshot`, `VisionTransitionEntry`, `VisionConflict`. Header comment cites `SPEC_A_VISION_REFERENCE_V1_0 §2.1-§2.3` and bakes in three Phase 1 decisions (FLAG A: JSDoc translation; FLAG B: duck-typed timestamps; FLAG C: `conditionSnapshot` may be null only while `state === 'unformed'`).
- `src/constants/visionEnums.js` — 21 frozen enum arrays (`VISION_LIFECYCLE_STATES`, `VISION_TRANSITION_CAUSES`, `VISION_TRANSITION_ACTORS`, `VISION_CONSTRAINT_TYPES`, `VISION_LIFECYCLE_BINDINGS`, `VISION_CATEGORY_B_RULE_KINDS`, etc.) plus `confidenceToFloat()` mapping `low|medium|high → 0.3|0.6|0.9`.
- `src/types/vision/visionFactory.js` — single export `createInitialVision(conditionSnapshot, nowTimestamp)` returning a fresh Vision with `state='unformed'`, `confidence='low'`, `source='agent-generated-fallback'`, `authoredBy='gemma'`, empty `constraints/evidenceTrail/conflicts/transitionHistory`, `version=1`.
- `src/types/vision/visionTransitions.js` — exports `VALID_TRANSITIONS` (15 edges, including `null → unformed` via `battle_creation`/`layer1`) and `isValidTransition(from, to, cause, actor)`.
- `src/types/vision/visionValidators.js` — four validators: `validateVisionShape`, `validateTransition`, `validateConstraintMutation`, `validateVisionInvariants`. All return `{ valid, errors[] }` and never throw.
- `api/_utils/visionRuntime.js` — single export `filterActiveConstraints(constraints, visionState, nowMs)`. Implements the union-of-death-conditions rule. Pure function, no Firestore I/O. **No writer functions exist in this module.**
- Tests: `src/types/vision/visionValidators.test.js` and `api/_utils/visionRuntime.test.js` are present.

Match against the spec's locked schema (Spec A V1.2 §2): the JSDoc and TS reference in `visionTypes.js` lines 22-131 reproduces the schema verbatim. **The schema is in the codebase.** Whether it matches V1.2 vs the V1.0 the file header cites cannot be verified — the V1.2 doc is not in the repo.

## 1.2 Importers and call sites

Files that import from `src/types/vision/` or `src/constants/visionEnums.js`:

| File | Imports | Role |
|---|---|---|
| `src/firebase/firebaseService.js:48` | `createInitialVision` | Calls `createInitialVision(null, Timestamp.now())` at battle creation (line 240) |
| `api/cron/agent-evaluate.js:36, :38` | `filterActiveConstraints`, `validateTransition` | Reads vision during eval (line 525), validates `battle_end → retired` transition (line 1623) |
| `src/types/vision/visionFactory.js` | (typedef self-references) | — |
| `src/types/vision/visionValidators.js` | enums + `isValidTransition` | — |
| `src/types/vision/visionTransitions.js` | (typedef self-references) | — |
| Test files | as needed | — |

**Total non-test importers: 2** (`firebaseService.js`, `agent-evaluate.js`).

## 1.3 Battle/Vision property access

- `battle.vision` literal: 1 hit (a comment at `agent-evaluate.js:507`). The actual access is via `battle?.vision ?? null` at line 515.
- `vision:` as a write key: 2 hits — `firebaseService.js:240` (initial create) and `agent-evaluate.js:1664` (the retired-vision update).
- Component-level (UI) reads of `battle.vision`: **none**. `AgentChat.jsx` does not select Vision.

## 1.4 Where Vision flows into prompts

- **Haiku trade-decision prompt** (`api/_utils/agentEvalPromptAssembly.js`): YES. `buildVisionStateBlock(visionState)` is called and emitted before the regime context. Renders state, thesis, structured summary, and active constraints (including `category_b_forge` rendered as `[category_b_forge] {ruleKind}: {ruleId}` per the `agentEvalPromptAssembly.test.js:113-121` test).
- **Voice Layer prompt** (`api/_utils/voiceLayerPrompt.js`): NO. The string `vision` does not appear as a Vision-object reference in this file (only `battle.directive` legacy fields). `buildBattleState()` reads only score/portfolio/trades.
- **Sonnet reflection** (`api/agent/reflect.js`, `api/_utils/agentReflectionUtils.js`): NO. No Vision read or write.
- **Strategy prompt** (`api/_utils/agentPromptAssembly.js`): NO Vision references.
- **AgentChat.jsx**: does not subscribe to or display Vision.

## 1.5 Cron jobs that touch Vision

Only `api/cron/agent-evaluate.js`. No other cron in `api/cron/` reads or writes Vision.

## 1.6 The "directive" count

User claim: "spec claims 40 references in 12 files." **Verified exactly.** `grep -rn "\.directive" --include="*.js" --include="*.jsx"` returns 40 occurrences across 12 files. Categorization:

| File | Count | Category |
|---|---|---|
| `src/components/Agent/AgentChat.jsx` | 9 | Read/write of message-level `directive` and `directiveThreadId` (UI for Gemma's directive output → ExecutionCard) |
| `api/agent/chat.js` | 7 | Read of `parsed.directive` from Gemma's JSON output, write to Firestore; lines 286/396 are deprecation comments |
| `api/_utils/agentEvalPromptAssembly.js` | 5 | Read of `battle.directive` + `directiveThreadId` injected into Haiku's prompt (lines 682-688) |
| `api/_utils/voiceLayerPrompt.js` | 4 | Read of `battle.liveDirectives`/`directiveOutcomes` for review-mode context; line 338 is a deprecation banner ("NEVER write to agent.directives[]") |
| `api/cron/agent-evaluate.js` | 3 | Write of `directiveThreadId` onto trade-decision log entries (lines 1030/1050/1090) |
| `src/services/agentService.js` | 3 | Read of legacy `agent.directives[]` array |
| `api/cron/agent-batch-review.js` | 1 | Read of `battle.agentContext?.directives` |
| `src/services/deployStrategyService.js` | 2 | Read/typedef on `deployedStrategy.directives` (Forge deploy path) |
| `src/hooks/useAgent.js` | 2 | Read of `agent.directives` |
| `api/agent/debate.js` | 2 | Read of `agent.directives` |
| `src/components/Agent/PlaybookPanel.ARCHIVED.jsx` | 1 | Read of `agent?.directives` (archived) |
| `api/scripts/migrate-directives.js` | 1 | Migration script reading `agent.directives` to split into `lessons[]` / archived |
| **Total** | **40** | — |

**Critical distinction:** these references are NOT inside the Vision object. They are two separate legacy systems:

1. **`battle.directive` field** — the live-game directive that Gemma extracts from user chat and Haiku reads via `agentEvalPromptAssembly.js:682-688`. This is a battle-scoped scratch field, not part of Vision's `constraints[]`.
2. **`agent.directives[]` array** — the deprecated cross-battle directive store. `voiceLayerPrompt.js:338` says explicitly "NEVER write to `agent.directives[]`. That channel is deprecated. Lessons go to `agent.lessons[]`. Rules go to `agent.forgeSuggestions[]`." The `migrate-directives.js` script splits `agent.directives` into `lessons[]` (where `source === 'batch_review'`) and an archive bucket.

The Vision schema does not contain a `directive` field. The 40 hits live entirely outside Vision; they are the predecessor system.

## Bottom Line

Vision exists end-to-end as a type system and as a read-side runtime helper, with two production code paths that touch it: a creator (`firebaseService.js` at battle start) and a destroyer (`agent-evaluate.js` at battle end). One reader injects it into Haiku's prompt. Everywhere else — Gemma, Sonnet, the UI, every other cron — Vision is invisible. The "40 directive references in 12 files" are a separate legacy system that was supposed to be replaced by Vision's `constraints[]` array but instead has been routed to the dossier-shaped `agent.lessons[]` / `agent.forgeSuggestions[]` family. Vision today is a lifeless ceremonial object: it gets born and it gets buried, but nobody talks to it in between.

---

# Section 2: Vision Object — Lifecycle State Machine

## 2.1 The state graph (from code)

`src/types/vision/visionTransitions.js` defines `VALID_TRANSITIONS` with 15 edges:

| From | To | Allowed causes | Allowed actors |
|---|---|---|---|
| `null` | `unformed` | `battle_start` | `battle_creation`, `layer1` |
| `unformed` | `proposed` | `user_input`, `directional_trigger` | `gemma` |
| `unformed` | `active` | `autopilot_fallback` | `gemma`, `cron` |
| `proposed` | `active` | `user_input` | `gemma` |
| `proposed` | `unformed` | `user_input` | `gemma` |
| `active` | `under_debate` | `directional_trigger` | `gemma` |
| `active` | `stale` | `staleness_detected`, `scheduled_check_in` | `gemma`, `cron` |
| `under_debate` | `active` | `user_input` | `gemma` |
| `under_debate` | `unformed` | `user_input` | `gemma` |
| `stale` | `active` | `user_input` | `gemma` |
| `stale` | `unformed` | `user_input` | `gemma` |
| `unformed` → `retired` | `battle_end` | `sonnet`, `cron` |
| `proposed` → `retired` | `battle_end` | `sonnet`, `cron` |
| `active` → `retired` | `battle_end` | `sonnet`, `cron` |
| `under_debate` → `retired` | `battle_end` | `sonnet`, `cron` |
| `stale` → `retired` | `battle_end` | `sonnet`, `cron` |

The graph is fully specified and validators enforce it.

## 2.2 Which transitions actually execute in production

| Edge | Writer location | Status |
|---|---|---|
| `null → unformed` (`battle_creation`) | `src/firebase/firebaseService.js:240` via `createInitialVision(null, Timestamp.now())` | **shipped** |
| `unformed → proposed` (`gemma`, `user_input`/`directional_trigger`) | — | **not implemented** |
| `unformed → active` (`gemma`/`cron`, `autopilot_fallback`) | — | **not implemented** |
| `proposed → active` (`gemma`, `user_input`) | — | **not implemented** |
| `proposed → unformed` (`gemma`, `user_input`) | — | **not implemented** |
| `active → under_debate` (`gemma`, `directional_trigger`) | — | **not implemented** |
| `active → stale` (`gemma`/`cron`) | — | **not implemented** |
| `under_debate → active` / `→ unformed` | — | **not implemented** |
| `stale → active` / `→ unformed` | — | **not implemented** |
| `* → retired` (`battle_end`, `cron` or `sonnet`) | `api/cron/agent-evaluate.js:1607-1666` (always uses `actor='cron'`) | **shipped (cron path only)** |

**5 of the 6 lifecycle states are unreachable in production.** Vision is born `unformed` and dies `unformed → retired`. There is no code path in `api/agent/chat.js`, `api/cron/`, `src/services/`, or anywhere else that walks the Gemma-authored part of the graph. Layer 1 is referenced as an allowed actor for the initial edge but no module called "layer1" or "Layer1" exists in `api/` or `src/`.

The Sonnet retirement path (`actor='sonnet'`) is allowed by the validator but has no caller — the cron always retires with `actor='cron'`.

## 2.3 transitionHistory writers

The only writer of a `transitionHistory` entry is `api/cron/agent-evaluate.js:1610-1620`, building one entry of shape `{ fromState, toState: 'retired', timestamp, actor: 'cron', cause: 'battle_end' }` on battle expiry. Every retired Vision will have exactly one entry in its `transitionHistory[]`. Visions that are never retired (battle never expires, or the eval cron never runs) have an empty history.

`logVisionTransition` (`api/_utils/shadowLogger.js:109`) writes to a `vision_transitions` shadow stream, called fire-and-forget from `agent-evaluate.js:1670` after the Firestore update. End-to-end transition logging is functioning **only for the retire edge.**

## 2.4 conditionSnapshot writers and the V1.1 invariant

The invariant: `conditionSnapshot` is null iff `state === 'unformed'`, non-null otherwise. `validateVisionShape` enforces it (`src/types/vision/visionValidators.js:357-365`), and `validateTransition` enforces that any transition out of `'unformed'` carries a non-null `conditionSnapshot` on `next` (lines 488-495).

Writers: `createInitialVision` is called with `null` (`firebaseService.js:240`). The retire-edge writer (`agent-evaluate.js:1617-1622`) preserves whatever `conditionSnapshot` is already on the prev Vision — including `null` — by spreading `...prevVision`. Because no transition ever leaves `unformed`, every shipped Vision goes from `null` (at create) straight to `null` (at retire). The invariant holds trivially because the spec-bridge transitions never fire.

## Bottom Line

The state machine is specified, validated, and tested, but it is a museum piece: only the create edge and the retire edge have callers. Visions enter as `unformed` and exit as `retired-from-unformed`, every time. The `proposed/active/under_debate/stale` states are reachable only through hypothetical Gemma writes that don't exist — there is no `proposeVision`, `activateVision`, `markUnderDebate`, or staleness cron anywhere in the codebase. Until a Gemma-side transition writer ships (Spec C / Voice Layer rewrite), the Vision lifecycle is a two-state system pretending to be six-state.

---

# Section 3: Constraints Array — What Lives Inside Vision

The Vision schema reserves three constraint types in `VISION_CONSTRAINT_TYPES`: `user_carveout`, `category_b_forge`, `system_injected`. Validators support all three. Haiku's prompt renders all three (`agentEvalPromptAssembly.js` lines 491-515 with a passing test at `agentEvalPromptAssembly.test.js:113-121`). But **no production writer exists for any of the three.**

## 3.1 user_carveout

- **Spec writer:** Gemma extracts user instructions like "never sell NVDA" and posts them as `user_carveout` constraints with `lifecycleBinding` set to `vision`/`battle`/`event`/`explicit`.
- **Code reality:** `api/_utils/voiceLayerPrompt.js` does not emit `_carveout` or `_constraint` JSON fields in its OUTPUT_FORMAT block. Gemma's tool schema only provides `directive`, `_lesson`, `_forgeSuggestion`, and `suggestedActions` (lines 14-41 + 322-364). User carveouts as Vision constraints are **not implemented.** The closest analog is `parsed.directive`, which writes to a battle-scoped legacy field, not into `vision.constraints[]`.
- **Triggers / lifecycleBinding tagging:** none, because no writer exists.

## 3.2 category_b_forge (Forge rules injected into Vision)

- **Spec writer:** When a strategy deploys with Category B Forge rules, those rules become `category_b_forge` constraints on the Vision, snapshotting `ruleId`, `ruleSnapshot`, and `ruleKind` (one of `stop_loss`, `position_cap`, `sector_concentration`, `event_exclusion`, `other`).
- **Category A vs B in code:** Forge rules in `src/data/forgeKnowledgeBase.js` (143 rules) carry `id`, `category` (technical/fundamental/risk/allocation/etc.), `modes`, `difficulty`, `forgeTemplates`, `tags`. **No `categoryA`/`categoryB` field exists on rules.** The A/B distinction lives only inside `VISION_CONSTRAINT_TYPES` as a constraint shape, not as a Forge rule property.
- **Code reality:** No writer creates `category_b_forge` constraints from Forge rules. The deploy path (`src/services/deployStrategyService.js`, `api/season/create-entry.js`) writes Forge rules into `agent.activeRules[]` and into season-entry `algorithm.rules[]`, but never into `vision.constraints[]`. The validator/test confirms the type is accepted; production does not write it.
- **Battle-end behavior:** undefined in code. There is no cleanup writer because there is no creation writer.

## 3.3 system_injected (Risk Manager cooldowns and similar)

- **Spec writer:** Risk Manager (`api/_utils/agentRiskManager.js`) writes `system_injected` constraints with `payload: { eventCause, scope: 'position'|'portfolio'|'time_window', target, reason }` for things like LOCK on threshold proximity, EMERGENCY_SWAP cooldowns, etc.
- **Code reality:** `agentRiskManager.js` returns risk actions (`EMERGENCY_SWAP`, `SWAP_OUT`, `LOCK`, `TRAIL_STOP`, `HOLD`) as ephemeral function-return values. These are consumed in `api/cron/agent-evaluate.js` and applied via `agentGuardrails.js` for the current evaluation tick. **They are never persisted to `vision.constraints[]`.** A LOCK fired at tick N is forgotten at tick N+1 unless the same conditions still hold.
- **Specifically:** `grep -n "vision\|Vision" api/_utils/agentRiskManager.js api/_utils/agentTriggerGate.js` returns zero hits. Neither module imports from `src/types/vision/` or writes to `battle.vision`.

## 3.4 Constraint mutation invariants

`validateConstraintMutation` (`visionValidators.js:515-571`) enforces: (a) no mutations when `state === 'retired'`; (b) `system_injected` mutations allowed in any non-retired state; (c) non-system mutations restricted to `proposed`/`active`/`under_debate`. These invariants are testable but unenforced at runtime because no writer is calling the validator before mutating constraints.

## 3.5 What Haiku actually sees in the constraints block

Because all three constraint types have empty writers, the active-constraints array passed into `buildVisionStateBlock` is always `[]` in production. The `renderActiveConstraints` and `summarizeConstraint` helpers in `agentEvalPromptAssembly.js` are reached during unit tests but produce empty output during real evaluations.

## Bottom Line

The constraints array is a fully-specified, fully-validated, fully-rendered, fully-empty container. The schema accommodates user carveouts, Forge-rule snapshots, and Risk Manager system injections — and none of those three sources has shipped its writer. Risk Manager outcomes that should be persisted as `system_injected` constraints currently survive only one evaluation tick. Forge rules that should snapshot into Vision live entirely in `agent.activeRules[]`. User carveouts that should flow from Gemma do not appear in Gemma's output schema at all. Three orphaned writer slots, three different teams' work, and zero data in production.

---

# Section 4: Voice Layer — Prompt Construction & Cache

## 4.1 voiceLayerCache (the 15-minute cron)

`api/cron/voice-layer-cache.js`. Schedule: every 15 minutes during 1pm-8pm ET on weekdays. Writes one document per active battle to `voiceLayerCache/{battleId}` with this shape:

```
{
  battleId, agentId,
  portfolioBriefs: [{ symbol, tier, price, changePercent, technicalScore, technicalRank,
                      rsPercentile, trendSummary, momentumSummary, supportLevel,
                      resistanceLevel, thresholdNote, atrPercent }, ...],
  scoutAlerts:    [{ symbol, type, headline, detail, relevance }, ...],
  marketContext:  { regime, regimeDetail, spyChange, vixLevel, volatilityRegime,
                    breadthTier, breadthDetail, topSector, topSectorChange,
                    worstSector, worstSectorChange, yieldRegime },
  dataFreshness:  { prices: 'rest_15min', technicals: 'daily', rankings: 'daily',
                    marketContext: 'daily' },
  forgeSeeds:     null,
  updatedAt:      Timestamp
}
```

Data sources merged: EODHD live prices, `stockTechnicalScores`, `indexIntelligence.stockRankings`, and `indexIntelligence.marketContext`.

**Spec fields written:** `portfolioBriefs`, `scoutAlerts`, `marketContext`, partial `dataFreshness`. **Spec fields NOT written:** `relevantPatterns` (DKB Semantic RAG matches), `tacticalContext` (DKB State-Triggered content), and freshness tags for those two. The cache is the consumer-facing surface for Voice Layer market data, but the DKB-derived half is missing.

## 4.2 buildVoiceLayerPrompt — block-by-block status

`api/_utils/voiceLayerPrompt.js` (1,071 lines). The function supports four modes: battle, review, workshop, signal_expansion. Block-level status against the construction guide:

| Block | Status | Evidence |
|---|---|---|
| 1 — Identity | shipped | lines 1010-1015 (battle); 905-909 (workshop); 965-969 (signal) |
| 1.5 — Game Mechanics | shipped | `GAME_MECHANICS` constant lines 7-12 |
| 7 — Output Format + Scratchpad | shipped | `OUTPUT_FORMAT` constant lines 14-41 |
| 2 — Partner Model | shipped | `buildPartnerModelBlock()` lines 508-528 |
| 3 — Convictions + Consolidated Insight | shipped | `buildConvictionsBlock()` lines 530-552 |
| 3.5 — DKB Anchor | partial | regimeLine only; no proprietary translation |
| 3.6 — DKB State-Triggered | not present | `buildStateTrigger()` from spec is not in code |
| 3.7 — DKB Semantic RAG | not present | `buildSemanticBlock()` from spec is not in code |
| 3.8 — External Article | not present | `detectExternalIntelligence`/`extractArticleContent`/`buildExternalArticleBlock` do not appear in any file |
| 4A — Portfolio Briefs | shipped | `buildPortfolioBriefsBlock()` lines 582-596 |
| 4B — Scout Alerts | shipped | `buildScoutAlertsBlock()` lines 598-606 |
| 4C — Market Context | shipped (extension beyond spec) | `buildMarketSnapshotContext()` lines 608-629 |
| 5 — Battle State | shipped | `buildBattleState()` lines 554-578 (reads score/portfolio/trades only — **does not read `battle.vision`**) |
| Few-Shot Examples | shipped | `DISCOVERY_EXAMPLE`/`REFINEMENT_EXAMPLE`/`MASTERY_EXAMPLE` lines 146-156 |
| Conversation History | shipped | mapped from `battle.chatExchanges` in `chat.js:244-249` |
| Elicitation Target | shipped | `selectElicitationTarget` + injection at `chat.js:238-242` and `voiceLayerPrompt.js:1042` |
| 6 — Phase Rules | shipped | `DISCOVERY_RULES`/`REFINEMENT_RULES`/`MASTERY_RULES` lines 45-142 |

Roughly **65% of the spec'd blocks are shipped.** The DKB cluster (3.5 partial, 3.6/3.7/3.8 missing) is the biggest gap.

## 4.3 Vision in the Voice Layer prompt

`buildVoiceLayerPrompt` does not read `battle.vision` and does not pass any Vision data to Gemma. `grep -n "vision" api/_utils/voiceLayerPrompt.js` returns matches only on `battle.directiveOutcomes`, `liveDirectives`, `directiveThreadId` — i.e., the legacy directive system, not Vision. Gemma operates blind to the Vision lifecycle while Haiku reads it.

## 4.4 buildVoiceLayerPrompt callers

| Caller | Mode |
|---|---|
| `api/agent/chat.js:252` | battle / review (selected by `detectMode()`) |
| `api/cron/agent-batch-review.js:243` | review (post-market batch) |
| `api/forge/workshop-chat.js:263` | workshop |
| `api/forge/expand-signal.js:291` | signal_expansion |

Four callers; all four wired.

## 4.5 AgentChat.jsx — what the UI reads

`src/components/Agent/AgentChat.jsx` reads from the API endpoints (which read from Firestore on its behalf). Direct Firestore selections from the component itself:

- `agentBattles/{battleId}` — yes (battle doc, including `chatExchanges` and `dailyReviews`)
- `agents/{agentId}` — yes (for `partnerProfile`, `convictions`, `consolidatedInsight` — passed to server)
- `voiceLayerCache/{battleId}` — read on the server side in `chat.js:220` and forwarded
- `indexIntelligence/marketContext` — server side
- `battle.vision` — **no**, never selected, never displayed
- `domainKnowledge` collection — does not exist
- DKB-derived UI sections — none

The UI tracks chat-level `directive` and `directiveThreadId` to render `ExecutionCard`s and trade-linked highlights.

## 4.6 External Intelligence Pipeline (Phase 3.5)

The construction guide includes a thorough 70-line spec for URL detection, server-side article fetch, content extraction, and Block 3.8 injection (lines 420-490 of the guide). Search results: `grep -r "detectExternalIntelligence\|extractArticleContent\|buildExternalArticleBlock" /home/user/TradeSeven --include="*.js" --include="*.jsx"` returns **zero hits.** No URL detection in `chat.js`, no `fetch()` of user-provided URLs anywhere, no Block 3.8 conditional in `buildVoiceLayerPrompt`. The pipeline is spec-only.

## 4.7 The Domain Knowledge Base (DKB)

Eight thematic JSON files in `/dkb/thematic/` (`ai-infrastructure-buildout.json`, `aging-demographics.json`, `consumer-bifurcation.json`, `cybersecurity-buildout.json`, `dollar-strength-regimes.json`, `energy-transition.json`, `housing-cycle.json`, `reshoring.json`). Each has structure `{ id, type, status, fullEntry: { theme, coreThesis, chain, tickerEcosystem, subAngles, injection }, gemmaDirective: { battle, workshop } }`.

Runtime consumption: **none**. No code path reads `/dkb/thematic/*.json` at runtime. No Firestore `domainKnowledge` collection exists. The `Discover` tab UI may reference these themes (`api/discover/`), but the static JSONs do not flow into Voice Layer prompts, into `voiceLayerCache.relevantPatterns`, into Haiku's prompt as "active-pattern-context", or anywhere else. Haiku's eval prompt has no DKB injection.

The intended Phase 2 wiring (DKB → semantic match → `relevantPatterns` cached → Block 3.7 in prompt) is fully designed and entirely absent from code.

## Bottom Line

The Voice Layer prompt construction is roughly two-thirds shipped: identity, partner model, convictions, market briefs, phase rules, output format, and few-shots are all in place; the DKB cluster (3.5 partial, 3.6/3.7/3.8/external articles) is missing entirely. The 15-minute cache is writing the market half of the spec but not the DKB half. Gemma never sees Vision. The UI surfaces conversation/directive flows but not Vision state. The 8 thematic DKB files exist on disk and are read by no one — they are inert. If a Context Dossier were introduced today, the Voice Layer would have an obvious slot to inject it (somewhere between Block 3 and Block 4A in the U-shape) — but the slots that should already be filled with DKB content are still empty, which means the Dossier would land into a zone that has been silently failing the spec for several phases.

---

# Section 5: Forge — Rule System & Bundle System

## 5.1 The rule registry

`src/data/forgeKnowledgeBase.js` (3,798 lines) plus the auto-extracted reference at `DKB_FORGE_RULES.md`. **143 rules total**, broken down by category:

| Category | Count | Modes |
|---|---|---|
| Technical | 25 | both |
| Mid-Battle Trading | 16 | clash |
| Fundamental | 14 | both |
| Risk | 12 | both |
| Allocation | 11 | both |
| Game State | 11 | clash |
| Tier Strategy | 10 | clash |
| Institutional | 10 | both |
| Threshold Strategy | 8 | clash |
| Entry Criteria (SE) | 8 | season |
| Exit & Stops (SX) | 7 | season |
| Season State (SS) | 6 | season |
| Rebalancing (SR) | 5 | season |

Mode breakdown: ~62 `both`, ~45 `clash`-only, ~26 `season`-only.

Each rule carries `id`, `category`, `modes`, `difficulty`, `forgeTemplates`, `tags`. **None carry a `categoryA` or `categoryB` tag.** The A/B distinction lives only inside `VISION_CONSTRAINT_TYPES` as a constraint-shape choice (`user_carveout` / `category_b_forge` / `system_injected`), not as a property of a Forge rule. Whether the spec intends for "Category B Forge rule" to mean "a Forge rule that gets injected as a Vision `category_b_forge` constraint" is consistent with `VISION_CATEGORY_B_RULE_KINDS = ['stop_loss','position_cap','sector_concentration','event_exclusion','other']` — but the mapping from a registry rule to one of those `ruleKind`s is not encoded anywhere in the registry itself.

## 5.2 Bundles, loadouts, and the path to Haiku

The bundle system writes user-curated rule sets onto the agent doc and snapshots them into season entries:

- UI: `src/components/Forge/BundleStrip.jsx`, `src/components/Forge/MyBundlesTab.jsx`
- Persistence: `agent.bundles[id].ruleSnapshots[]` and `agent.activeRules[]` (the deployed bundle)
- Season-entry compilation: `api/season/create-entry.js` reads `bundle.ruleSnapshots` and produces `algorithm.rules[]` for the season-entry doc
- Battle prompt injection (Haiku side): `api/_utils/agentPromptAssembly.js:67-92` pulls `agent.activeRules`, splits them into `CONSTRAINTS` (categories `risk`/`allocation`) and `STRATEGY PREFERENCES` (everything else), sanitizes via `sanitizeRuleText()`, and renders as `C1...Cn` and `S1...Sn` blocks
- Battle context snapshot: `agent.activeRules` is also snapshotted into `battle.agentContext` at battle creation (`agentBattleService.js`)

**The compilation step is "embed as text in the prompt".** There is no runtime rule engine for `clash`-mode rules; Haiku decides via natural-language interpretation of the constraint/preference list. Season-mode rules (`SE/SX/SR/SS`) are evaluated programmatically via `api/_utils/seasonRuleRegistry.js`'s pure evaluators — that's the only place rules are executed by code rather than by an LLM.

## 5.3 Custom Rule Builder

UI exists at `src/components/Forge/MyRulesTab.jsx` (marked deprecated/rollback in the file). Form fields:

- text (rule statement)
- category (dropdown over the existing category enum)
- visibility (`public` / `private`)
- source set to `forge_custom`

**No A/B selection in the UI.** No `categoryA`/`categoryB` field is written when a user creates a rule. A user-authored rule lands as a regular Forge rule with a free-text body and an existing-category tag.

## 5.4 Strategy Laboratory backtest output

`api/season/create-entry.js` builds a `seasonEntries/{entryId}` document with shape:

```
{
  seasonId, agentId, userId, bundleId,
  durationDays,                 // 5 / 10 / 15 / 20
  status,                        // active / complete / abandoned
  entrySource,                   // workshop / manual / refinement_pair / direct_join
  algorithm: {
    rules: [{ id, sourceRef, params, priority: 'hard'|'soft' }, ...]
  },
  creationSource: { method, timestamp },
  createdAt, updatedAt
}
```

A "solo season" wrapper is created on demand at `seasonId: 'solo-{sha256_hash}'` if no season is active. Daily backtest output lands in `seasonLogs/{seasonId}/{tradingDay}.json` (per the cron pattern; daily evaluator at `api/cron/season-daily-evaluate.js`). A "Forge Score" metric is referenced in `FORGE_STRATEGY_LABORATORY_QUICK_REFERENCE_V1_1.md` (alpha + consistency + risk efficiency + rule efficiency + BB fitness) but the actual computation is not visible in `seasonRuleRegistry.js` or in any cron — it is spec-only at this point.

## 5.5 Vision ↔ Forge integration

Status: **scaffolded, not wired.**

- Type system: `VISION_CONSTRAINT_TYPES` admits `category_b_forge`. Validators accept it. `agentEvalPromptAssembly.js:495-496` renders it as `[category_b_forge] {ruleKind}: {ruleId}`. Tested at `agentEvalPromptAssembly.test.js:113-121`.
- Writer: **none**. No code path reads from a deployed Forge bundle and writes a `category_b_forge` constraint into `vision.constraints[]`. The deploy path puts rules in `agent.activeRules[]` and never touches `vision`.
- Selection logic (which rule kinds become `category_b_forge` vs stay in `activeRules` only): **none**. The `VISION_CATEGORY_B_RULE_KINDS` enum is populated, but no mapping from `forgeKnowledgeBase` rule entries to those kinds exists.

## 5.6 Forge spec inventory

| File | One-liner |
|---|---|
| `FORGE_EXPANSION_DESIGN_SPEC_V3.md` (59 KB) | Locked spec for rule-palette expansion + variable backtest duration; Tier 1 user-facing rules / Tier 2 agent baseline; conflict-pair catalog |
| `FORGE_STRATEGY_LABORATORY_QUICK_REFERENCE_V1_1.md` (11 KB) | Reframing of Forge as a strategy lab: develop → test → analyze → refine → deploy; Forge Score metric definition |
| `FORGE_DISCOVER_TAB_SPEC.md` (33 KB) | Discover-tab inspiration surface: curated rails for novices, signal drop for power users, handoff to Workshop or watchlist |
| `FORGE_SIGNAL_DROP_SPEC.md` (58 KB) | Signal Drop (user feeds tweets/screenshots → Gemma expands → fork to strategy or watchlist) |
| `DKB_FORGE_RULES.md` | Auto-extracted reference of all 143 rules, conflict pairs, trading-style collections (last extracted 2026-04-14) |

## Bottom Line

The Forge has the most concrete data of any subsystem in this audit: 143 rules with a real registry, real templates, real tag taxonomy, a working deploy path that snapshots rules into agent docs and season entries, and two working consumers (Haiku via prompt injection in `clash`/BaggerBomb mode, deterministic evaluators in `season` mode). The Vision/Forge bridge is scaffolded — types, validators, prompt rendering, and a passing test all exist for `category_b_forge` constraints — but there is no writer that turns a deployed Forge rule into a Vision constraint. Forge rules currently live in `agent.activeRules[]` and travel into Haiku's prompt directly, bypassing Vision entirely. The Category A/B distinction exists at the Vision-shape level, not at the rule level.

---

# Section 6: Lessons Learned

## 6.1 Three writers, two storage shapes

The lessons system has three distinct producers writing to two distinct fields:

**Writer 1 — Sonnet post-battle reflection** (`api/agent/reflect.js`, model `claude-sonnet-4-20250514`)
- Trigger: called non-blocking from `api/cron/agent-evaluate.js:81` after battle completion
- Output: `submit_reflection` tool with `selfReflection` containing `lesson` (≤50 words), `adjustment` (≤50 words), `hypothesisGrades[]`, `confidenceCalibration` plus a `gameDesignFeedback` block (outcome-blind, separate)
- Storage: `agent.memory[]` as a rolling 5-game window via `writeMemoryReflection` at `reflect.js:170-198`. Memory entry shape: `{ gameId, gameMode, result, score, opponentScore, lesson, adjustment, hypothesisGrades, confidenceCalibration, date }`
- Game-design feedback: separate Firestore collection `gameDesignFeedback` (`reflect.js:107-112`)

**Writer 2 — Haiku end-of-day batch review** (`api/cron/agent-batch-review.js`, model `claude-haiku-4-5-20251001`)
- Trigger: daily after market close
- Output: a JSON parse including `_lesson` from the Voice Layer review-mode prompt
- Storage: `agent.lessons[]` via `FieldValue.arrayUnion(lesson)` at `agent-batch-review.js:334`. Lesson shape: `{ text, source: 'review_debrief', sourceGameId, sourceTrade, createdAt, consumed: false, consumedInConsolidation: null }`
- Per-battle review summary: `battle.dailyReviews[]` (`agent-batch-review.js:212-213`)

**Writer 3 — Gemma during chat in review mode** (`api/agent/chat.js`)
- Trigger: user chat after market close (`detectMode()` returns `'review'`, lines 112-120)
- Output: `_lesson` extracted from Gemma's JSON response
- Storage: same `agent.lessons[]` array via `FieldValue.arrayUnion` at `chat.js:405`

`api/scripts/migrate-directives.js` is the historical migration that mapped old `agent.directives[]` entries with `source === 'batch_review'` into the new `agent.lessons[]` shape.

## 6.2 Where lessons are read

- **Strategy prompt (Sonnet, drafting)**: `api/_utils/agentPromptAssembly.js:61-64` reads `agent.memory` and emits a `RECENT GAME MEMORY` block formatted via `formatMemory()`. This injects last-N games' `lesson` and `adjustment` into the strategy prompt.
- **Eval prompt (Haiku, live)**: indirect — via `battle.agentContext.consolidatedInsight` snapshotted at battle creation. The eval prompt does not read live `agent.lessons[]` or `agent.memory[]` during play.
- **Voice Layer (Gemma)**: `voiceLayerPrompt.js:533-534` reads `agent.consolidatedInsight` and emits an `ACCUMULATED WISDOM` block. The convictions block (`buildConvictionsBlock`, lines 530-552) reads `agent.convictions` filtered to confidence ≥ 0.3.
- **AgentEvolutionTab.jsx**: `src/components/Agent/AgentEvolutionTab.jsx:178-179` displays `agent.lessons[]` in the UI.

So lessons reach prompts via two distinct surfaces: `agent.memory[]` for Sonnet-strategy and `agent.consolidatedInsight` (string) for everyone else. Raw `agent.lessons[]` array entries are not directly injected into any prompt — they would need to be consolidated first.

## 6.3 Lesson → Vision constraint? Lesson → Forge rule?

**Lesson → Vision constraint:** **never**. No code path turns a lesson into a `vision.constraints[]` entry. The validator would accept the conversion (a `user_carveout` with `payload.statement = lesson.text` would validate), but no writer exists.

**Lesson → Forge rule:** explicit user-confirmed routing only. The Voice Layer prompt at `voiceLayerPrompt.js:351-362` and the `_forgeSuggestion` field in OUTPUT_FORMAT (lines 29-32) describe the path: when the user says "send that to the Forge" or "make that a rule" or "codify that", Gemma sets `_forgeSuggestion`, and `agent/chat.js:406` and `agent-batch-review.js:335` write it into `agent.forgeSuggestions[]`. Auto-routing without explicit confirmation is forbidden. The downstream consumer of `forgeSuggestions[]` is the Forge compiler / Workshop UI; the suggestion sits in `pending` status until acted on.

## 6.4 The orphaned consolidation pipeline

`reflect.js:116-122` sets `pendingConsolidation: true` on the agent doc every 5 games:

```
if (gamesPlayed > 0 && gamesPlayed % 5 === 0) {
  await agentRef.update({ pendingConsolidation: true });
}
```

The intended consumer is a "consolidation Sonnet" that reads `agent.memory[]` and `agent.lessons[]` and produces a refreshed `consolidatedInsight` string plus increments `evolutionCycle`. The writer for this consolidation exists in `src/services/agentService.js:227-235`:

```js
export const updateConsolidatedInsight = async (agentId, insight, newCycle) => {
  await updateDoc(docRef, {
    consolidatedInsight: insight,
    evolutionCycle: newCycle,
    memory: [],
    updatedAt: serverTimestamp(),
  });
};
```

`grep -rn "updateConsolidatedInsight" /home/user/TradeSeven` returns only the definition. **It has zero callers.** The flag is set every 5 games and is read by no one. `consolidatedInsight` and `evolutionCycle` are read in three prompts but written nowhere in production code.

## Bottom Line

Lessons production is the most operational part of the cross-battle stack: three writers from three different models all converge into two well-defined fields (`agent.memory[]` for rolling Sonnet reflections, `agent.lessons[]` for daily Haiku/Gemma review notes), and the routing rules between lessons and Forge suggestions are explicit and user-gated. The system breaks down at the next stage — consolidation. The 5-game `pendingConsolidation` flag fires every cycle and nobody catches it; the orphaned `updateConsolidatedInsight` writer in `agentService.js` is callable from the client but uncalled in any path I could find. As a result, `consolidatedInsight` and `evolutionCycle` are degenerate inputs to three prompts that depend on them. There is no lesson → Vision-constraint promotion path, and the lesson → Forge-rule path requires explicit user confirmation in chat.

---

# Section 7: Three-Model Stack — Role Boundaries In Practice

## 7.1 Anthropic API call inventory

Hardcoded model identifiers across the codebase (`grep -rn "model.*claude\|model:.*claude"`):

| File:line | Model | Task | Role |
|---|---|---|---|
| `api/cron/agent-evaluate.js:790` | `claude-haiku-4-5-20251001` | Mid-battle live trade evaluation | trading ✓ |
| `api/agent/decide.js:162, 193` | `claude-haiku-4-5-20251001` | Portfolio assembly (drafting) | trading ✓ |
| `api/agent/decide.js:109` | `claude-sonnet-4-20250514` | Initial strategy architecture | reflection/design ✓ |
| `api/agent/reflect.js:140` | `claude-sonnet-4-20250514` | Post-battle reflection + game design feedback | reflection ✓ |
| `api/agent/create-profile.js:151` | `claude-haiku-4-5-20251001` | Onboarding profile classification | one-shot setup |
| `api/agent/debate.js:159` | `claude-haiku-4-5-20251001` | Agent debate exchange | trading-adjacent |
| `api/cron/agent-batch-review.js:175` | `claude-haiku-4-5-20251001` | End-of-day batch review (daily lessons + film-room) | reflection-adjacent (post-market) |
| `api/cron/compute-daily-regime-brief.js:66` | `claude-sonnet-4-20250514` | Daily regime brief generation | infrastructure |
| `api/_utils/ingestionPipeline.js:10` | `claude-haiku-4-5-20251001` | Sonar/earnings claim extraction | infrastructure |
| `api/_utils/seasonPrompts/blackSwanEscalation.js:185` | `claude-haiku-4-5-20251001` | Season black-swan event handling | season eval |
| `api/_utils/seasonPrompts/pitStopDebrief.js:288` | `claude-sonnet-4-20250514` | Season pit-stop debrief | reflection (season) |
| `api/_utils/seasonPrompts/entryTiebreak.js:87` | `claude-haiku-4-5-20251001` | Season entry tiebreak | season infra |
| `api/_utils/bugReportClassifier.js:9` | `claude-haiku-4-5-20251001` | Bug report classification | infra |
| `api/stocks/analysis.js`, `api/ai-advisor.js`, `api/battle-commentary.js`, `api/fantasytimes/*`, `api/forge/compile-dimensions.js`, `api/forge/parse-signal.js`, `api/earnings/*` | mix of Haiku and Sonnet | content/intelligence pipelines | various non-agent infra |

**Total ~34 hardcoded model strings.** No Haiku call is doing voice work. No Sonnet call is doing real-time live-trade work — Sonnet appears in the live decide path only at `decide.js:109` for one-time strategy drafting before battle starts (not during play). No call shows Haiku in a Voice-Layer caller (`agent/chat.js`, `cron/agent-batch-review.js`, `forge/workshop-chat.js`, `forge/expand-signal.js`) — those four exclusively use the Gemma client.

## 7.2 OpenRouter / Gemma inventory

`api/_utils/gemmaClient.js`:

```
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GEMMA_MODEL = 'google/gemma-4-26b-a4b-it';
```

The model is hardcoded — only `google/gemma-4-26b-a4b-it` is callable. Two exports: `callGemmaVoice()` (throws on failure) and `callGemmaVoiceWithRetry()` (structured `{success, content, error}` with single retry on 429/5xx). `parseVoiceLayerResponse()` is a 4-tier JSON extractor with safe plaintext fallback.

OpenRouter callers: `api/agent/chat.js`, `api/cron/agent-batch-review.js`, `api/forge/expand-signal.js`, `api/forge/workshop-chat.js`, plus the season pit-stop reply variant. **All voice tasks; no trading, no reflection.** Confirmed clean separation.

## 7.3 Haiku trade-decision path (live)

Prompt assembly: `api/_utils/agentEvalPromptAssembly.js`. Three blocks:

- **System prompt** (`buildEvalSystemPrompt`, lines 21-206) — scoring framework, default-HOLD bias, regime-aware strategy, Forge rule framework (CONSTRAINTS vs STRATEGY PREFERENCES split), anti-thrash rules, Survival Mode override permissions.
- **Agent Identity Block** (`buildAgentIdentityBlock`, lines 215-295) — agent name/archetype/risk tolerance, portfolio rationale, Forge rule injection (`C1...Cn` hard, `S1...Sn` soft), institutional-data lag warning when relevant.
- **Live Context Block** (`buildLiveContextBlock`, lines 605-734) — battle state, **Vision State Block (lines 626-629)** before the regime context, regime context, portfolio CSV, bench CSV, closed trades CSV, trigger explanation, intraday momentum (VWAP/Bollinger/NR7), risk status (HOLD/LOCKED/SWAP_OUT), active directive thread (legacy `battle.directive`), institutional intelligence (gated), news context, recent eval history.

Tool schema: `api/_utils/agentEvalToolSchema.js` defines `submit_trade_decision` with required fields `decision` (HOLD|SWAP), `rationale`, `hypothesis`, `conviction` (0-100, ≥70 for SWAP), `riskAssessment`, plus optional `ignoredDirectiveIds`, `directiveThreadId`, `status_feed_update`, `trade_reasoning`, `pvp_context`, `cited_rules`, `cited_forge_rules`, `overridden_forge_rules`.

**Vision data Haiku receives:** state, thesis statement + structured summary (direction/scope/drivers), confidence, source, full constraints array, active-constraints (filtered by `filterActiveConstraints`), evidenceTrail, lastUserTouchAt, conditionSnapshot, transitionHistory.

**Forge rules:** read from `agent.activeRules` and rendered as `C1...Cn`/`S1...Sn` text inside the identity block.

## 7.4 Sonnet reflection path

`api/agent/reflect.js` invokes Sonnet with `submit_reflection` tool. System prompt is at `agentReflectionUtils.js:237-248`; user message at `agentReflectionUtils.js:254-364`. The tool produces `selfReflection.{lesson,adjustment,hypothesisGrades[],confidenceCalibration}` and `gameDesignFeedback.{6 categories with rating+observation+suggestion, mechanicHighlight, mechanicFriction, wouldPlayAgain}`. Self-reflection writes to `agent.memory[]`; game-design feedback writes to a separate `gameDesignFeedback` Firestore collection. The reflection path **does not read or write `vision`** — `grep -n "vision" api/agent/reflect.js api/_utils/agentReflectionUtils.js` returns nothing.

## 7.5 Trigger Gate (Spec B)

`api/_utils/agentTriggerGate.js`. Pure function. Inputs: `(battle, assetScores, prices, news, momentumData, seenStoryIds)`. Outputs: `{ shouldEvaluate, triggers[], newStoryIds[] }`. Trigger types: `forced_open` (first eval), `forced_close` (final hour), `price_drop`, `threshold_proximity`, `bench_outperformance`, `vwap_deviation`, `bandwidth_squeeze`, `nr7_contraction`, `news_catalyst`. **Does not read or write Vision.** `grep -n "vision" api/_utils/agentTriggerGate.js` returns zero hits. The gate decides whether to wake Haiku, not whether to transition Vision state. Spec B's "extension to wire trigger-gate firings into Vision transitions" is unimplemented.

Caller: only `api/cron/agent-evaluate.js`.

## 7.6 Risk Manager (Spec E)

`api/_utils/agentRiskManager.js`. Pure-ish — returns risk actions, does not write Firestore. Actions in priority order: `EMERGENCY_SWAP` (≤-0.85x ATR bust avoidance), `SWAP_OUT` (≥2 consecutive ticks below VWAP), `LOCK` (within 0.2x of bonus threshold), `TRAIL_STOP` (above +1.5x ATR + below 5min SMA20), `HOLD`. Returns `{ action, reason, detail }` per position. Consumed in `agent-evaluate.js` and applied via `agentGuardrails.js`. **Does not write `system_injected` constraints to Vision.** `grep -n "vision" api/_utils/agentRiskManager.js` returns zero hits. Spec E's Category B extension (LOCK persistence into Vision constraints) is unimplemented; LOCKs are ephemeral per-tick decisions.

## 7.7 Battle service

`api/_utils/agentBattleService.js`. Exports `findActiveAgentBattles(db)` and `createAgentBattle(db, agentData, thresholds, startingPrices, options)`. Battle creation initializes portfolio, scoreState, trades/evaluations/statusFeed arrays, `agentContext` snapshot of identity/activeRules/consolidatedInsight, scoring thresholds (tier multipliers 2.0/1.5/1.0), cronState, executionMode, strategyPreset, and placeholders for `gameplanMeeting` and `chatExchanges`. **It does not initialize Vision.** Vision creation happens at `src/firebase/firebaseService.js:240` via `createInitialVision(null, Timestamp.now())` on the client side at battle creation. The two writers that produce a battle doc are split between client (Vision init) and server (`agentBattleService.createAgentBattle` for cron-triggered scenarios). Whether both paths produce a Vision needs cross-check; `grep -n "vision\|Vision" api/_utils/agentBattleService.js` shows the server path does NOT call `createInitialVision`.

## Bottom Line

Role boundaries are clean: Haiku does live trades, Sonnet does post-battle reflection plus pre-battle drafting, Gemma does all voice work via OpenRouter. Zero violations detected across ~34 model-id sites. The plumbing pieces that should bridge the models — Trigger Gate, Risk Manager, Battle service — are operational at their current scope but uniformly absent from the Vision write path. Trigger gate fires Haiku without recording Vision transitions. Risk Manager fires LOCKs without persisting them as `system_injected` constraints. The server-side battle creator skips Vision initialization entirely (the client-side path handles it). The architecture is correctly partitioned by model role; what's missing is the connective tissue that would let those modules cooperate on a shared Vision lifecycle.

---

# Section 8: The Dossier Question — Where Could It Live?

## 8.1 Dossier-shaped Firestore collections

Search across `db.collection('...')` references and Firestore service calls:

- `agents/{id}` — exists, fully fledged
- `agentBattles/{id}` — exists, battle-scoped (Vision lives here)
- `seasonEntries/{id}` — exists, season-scoped
- `seasonLogs/{seasonId}/{day}` — exists, daily backtest logs
- `gameDesignFeedback` — exists, post-battle outcome-blind feedback (Sonnet writes)
- `voiceLayerCache/{battleId}` — exists, 15-min market data cache
- `domainKnowledge` — **does not exist**
- `agentMemory` — **does not exist** (memory lives as a field on `agents/{id}`)
- `agentContext` — **does not exist** (this name is reused as a field `battle.agentContext` for battle-creation snapshot)
- `userInsights` — **does not exist**
- `evolutionTimeline` — **does not exist**
- `convictions` — **does not exist** (convictions live as a field on `agents/{id}`)

**No standalone Firestore collection is dossier-shaped.** All cross-battle persistence is field-level on `agents/{id}`.

## 8.2 What persists across battles for an agent today

Field-by-field on `agents/{id}` — what lives here, who writes, who reads:

| Field | Writer (production) | Reader | Status |
|---|---|---|---|
| `archetype` | `api/agent/create-profile.js` (onboarding) + UI | many | shipped |
| `name` | onboarding | many | shipped |
| `phase` | (likely onboarding/migration) | `voiceLayerPrompt.js` | read-only in audit |
| `stats` (gamesPlayed/wins/losses/draws/totalScore/streaks) | `api/cron/agent-evaluate.js:1694-1705` | UI, voiceLayerPrompt | shipped |
| `memory[]` (rolling 5-game) | `api/agent/reflect.js:170-198` | `api/_utils/agentPromptAssembly.js:62` | shipped |
| `lessons[]` | `api/agent/chat.js:405`, `api/cron/agent-batch-review.js:334` | `AgentEvolutionTab.jsx:179` (UI only) | shipped (write/UI only; not in any prompt) |
| `forgeSuggestions[]` | `api/agent/chat.js:406`, `api/cron/agent-batch-review.js:335` | Forge UI / compiler | shipped |
| `activeRules[]` | Forge deploy path | `agentPromptAssembly.js:67`, `agentEvalPromptAssembly.js` | shipped |
| `bundles[id].ruleSnapshots[]` | Forge bundle save | `seasonCreate-entry`, deploy | shipped |
| `consolidatedInsight` | `agentService.js:227` (orphan — uncalled) | `agentPromptAssembly.js:51`, `agentEvalPromptAssembly.js:244-246`, `voiceLayerPrompt.js:534` | **read-wired, write-orphan** |
| `evolutionCycle` | `agentService.js:227` (same orphan) | `agentPromptAssembly.js:53` | **read-wired, write-orphan** |
| `partnerProfile` (15 dimensions) | **none found** | `voiceLayerPrompt.js:508-528` | **read-only; no writer** |
| `convictions[]` | **none found** | `voiceLayerPrompt.js:530-552` | **read-only; no writer** |
| `pendingConsolidation` (boolean flag) | `api/agent/reflect.js:120` (every 5 games) | **none** | **write-only; no reader** |
| `directives[]` (legacy) | (deprecated) | `agentService.js`, `useAgent.js`, `debate.js`, `migrate-directives.js` | deprecated; superseded by `lessons[]` + `forgeSuggestions[]` |
| `activeBattleId` | `agent-evaluate.js:1705` | UI | shipped |

**Two-thirds of the dossier-shaped fields have one half wired and the other half missing.** Read-side prompts depend on `consolidatedInsight`, `evolutionCycle`, `partnerProfile`, `convictions` — fields that are not written. The 5-game consolidation flag is set, never consumed. The `lessons[]` array is written by Haiku and Gemma, never injected into any prompt.

## 8.3 Where the agent's perspective is encoded

"Why does this agent trade this way" is answered across at least eight code locations:

1. **Archetype config** — `api/_utils/agentArchetypeConfig.js`, 6 archetypes (`momentum_chaser`, `analyst`, `diversifier`, `contrarian`, `degen`, `guardian`) with `convictionMods` (volume/macd/rs weight overrides), `riskOverrides` (bustBuffer, vwapFailureTicks, trailStopLevel), sector concentration cap, trade frequency.
2. **Archetype scoring** — `api/_utils/archetypeScoring.js`, scoring weights consumed in `agentScoring.js`.
3. **Forge bundle / `activeRules[]`** — the deployed strategy as text rendered into Haiku's prompt.
4. **Strategy preset** — `agentBattleService.js`, an `aggressive`/`balanced`/`defensive` execution-mode tag.
5. **Convictions** — `agent.convictions[]` filtered ≥ 0.3 confidence in voice prompts (read-only — no writer).
6. **Partner profile** — `agent.partnerProfile` 15 dimensions in voice prompts (read-only — no writer).
7. **Consolidated insight** — `agent.consolidatedInsight` string in three prompts (read-only — orphan writer).
8. **Memory** — `agent.memory[]` last 5 games' lessons + adjustments injected into Sonnet strategy prompt.

The "perspective" is genuinely distributed: archetype + scoring weights are static config; activeRules/strategy preset are user-curated; memory is Sonnet-authored; convictions/partnerProfile/consolidatedInsight are spec'd as live-evolving but currently are not evolving (no writers).

## 8.4 Cross-battle agent memory shape today

The shipping cross-battle memory is `agent.memory[]` — a rolling window of the last 5 game outcomes with lessons and hypothesis grades. Beyond that:

- `lessons[]` exists as accumulating raw notes but is not consolidated.
- `forgeSuggestions[]` exists as a queue of pending rule-promotions.
- An "evolution timeline" UI exists (`AgentEvolutionTab.jsx`) but is sourced from `agent.lessons[]`, not from a separate timeline collection. There is no per-cycle history of consolidations because consolidations are not happening.
- `gameDesignFeedback` is a separate collection of game-mechanic feedback — not part of the agent's strategic memory; it's a meta-signal for game designers.

So: the cross-battle memory shape today is a 5-game rolling window plus an unbounded raw-lessons array plus a queue of user-confirmed Forge-rule candidates. There is no curated, consolidated, structured cross-battle insight surface.

## 8.5 Existing fields that look "dossier-shaped"

Reorganized for the dossier question:

- **Strongest dossier-shaped reads (already in prompts):** `consolidatedInsight` (string), `partnerProfile` (15 dimensions), `convictions[]` (confidence-weighted beliefs), `evolutionCycle` (counter)
- **Strongest dossier-shaped writes (already producing data):** `memory[]` (Sonnet 5-game window), `lessons[]` (Haiku/Gemma raw), `forgeSuggestions[]` (user-confirmed)
- **Half-orphaned slot:** the consolidation gap between writes and reads — i.e., the missing transformation that takes raw `memory[]`/`lessons[]` and produces refreshed `consolidatedInsight`/`convictions`/`partnerProfile`

The "dossier-shaped niche" has read-side dependencies that are already injected into three prompts and write-side raw materials that are already accumulating from three writers — but the connecting layer (consolidate → curate → re-publish) is the missing piece. A Context Dossier as a new construct would either occupy that connecting layer directly or sit alongside it as a parallel curated surface.

## Bottom Line

The agent doc is already serving as a quasi-dossier. Memory, lessons, forge suggestions, convictions, partner profile, consolidated insight, evolution cycle, and the 5-game consolidation flag all live there. Three of those (`convictions`, `partnerProfile`, `consolidatedInsight`+`evolutionCycle`) are read by prompts but have no production writer; one (`pendingConsolidation`) is written but never read; the rest are wired end-to-end. There is no separate `agentMemory`, `agentContext`, or `evolutionTimeline` collection. The personality of an agent is split across archetype config, scoring weights, the deployed Forge bundle, sector caps, and the dossier-shaped fields above. A Dossier construct would not need a new home — it would need the missing consolidator that bridges the rolling raw inputs and the curated read-side fields the prompts already depend on.

---

# Section 9: Specification Lag Map

| # | Spec / Phase | Status | Evidence |
|---|---|---|---|
| 1 | Vision object schema (Spec A) | **shipped** | Full JSDoc/enums/factory/validators/runtime in `src/types/vision/` and `src/constants/visionEnums.js`. All four validators implemented and tested. |
| 2 | Vision lifecycle state machine | **shipped with known issues** | `VALID_TRANSITIONS` and validators are in place. Only the `null → unformed` (battle creation) and `* → retired` (battle end via cron) edges have production writers. Five intermediate transitions (`unformed → proposed`, `proposed → active`, etc.) are unreachable in production code. |
| 3 | Trigger gate extension (Spec B) | **partial implementation** | Trigger gate itself is shipped (`agentTriggerGate.js`, 9 trigger types). The Vision-side extension (firing transitions on `directional_trigger` etc.) is unimplemented — no Vision write happens from the trigger path. |
| 4 | Voice Layer prompt rewrite (Spec C) | **partial implementation** | ~65% of blocks shipped (1, 1.5, 2, 3, 4A, 4B, 4C, 5, 6, 7, few-shots, elicitation). Block 3.5 is partial; 3.6/3.7/3.8 are not present. Vision is not read into the prompt. |
| 5 | Haiku tool schema update (Spec D) | **shipped** | `agentEvalToolSchema.js` includes `submit_trade_decision` with all required + Vision-aware optional fields (`ignoredDirectiveIds`, `directiveThreadId`, `cited_forge_rules`, `overridden_forge_rules`). Renders Vision state in prompt with passing tests. |
| 6 | Risk Manager extension for Category B (Spec E) | **partial implementation** | Risk Manager itself is shipped (`agentRiskManager.js`, 5 risk actions). The Category B extension that would persist LOCK/EMERGENCY_SWAP outcomes as `system_injected` Vision constraints is unimplemented; risk actions remain ephemeral per-tick decisions. |
| 7 | Forge setup-signature pipeline (Spec F) | **spec only** | I could not locate Spec F documentation in the repo. The Forge Discover/Signal Drop specs exist (`FORGE_DISCOVER_TAB_SPEC.md`, `FORGE_SIGNAL_DROP_SPEC.md`), and `api/forge/parse-signal.js` + `api/forge/expand-signal.js` are present, but a "setup-signature" pipeline by that name is not identifiable in code. Status reflects unverifiable scope. |
| 8 | User evolution timeline (Spec G) | **partial implementation** | UI surface exists (`src/components/Agent/AgentEvolutionTab.jsx`, `ConsolidatedInsightPreview.jsx`). It reads `agent.lessons[]`. There is no `evolutionTimeline` collection; `evolutionCycle` is read in prompts but has an orphan writer (`agentService.js:227` is uncalled). Consolidation flag (`pendingConsolidation`) fires every 5 games and has no consumer. |
| 9 | DKB Phase 2 (technical intelligence + DKB) | **partial implementation** | Technical intelligence pipeline is shipped (technical scores cron, indexIntelligence, voiceLayerCache for portfolioBriefs/scoutAlerts/marketContext). DKB itself: 8 thematic JSONs exist statically in `/dkb/thematic/`; no Firestore `domainKnowledge` collection; no DKB-derived blocks injected into any prompt; `relevantPatterns`/`tacticalContext` not written into voiceLayerCache. |
| 10 | DKB Phase 3 (Partner Model + Convictions) | **partial implementation** | Reader side: shipped — `partnerProfile` and `convictions[]` are read into Voice Layer prompts (Block 2 + Block 3). Writer side: not found — no production code updates either field. The schema and prompt scaffolding are ready; the elicitation-loop writer that would populate these fields based on user responses is unimplemented. |
| 11 | External Intelligence Pipeline (Phase 3.5) | **spec only** | Construction guide includes a thorough 70-line spec for URL detection, server-side article fetch, content extraction, and Block 3.8 injection. Code search returns zero hits for `detectExternalIntelligence`, `extractArticleContent`, `buildExternalArticleBlock`. No URL detection in chat handlers, no `fetch()` of user URLs, no Block 3.8 conditional in `buildVoiceLayerPrompt`. |

## Bottom Line

Of the eleven items, two are fully shipped (Vision schema, Haiku tool schema), one is shipped with known limits (Vision lifecycle — only two edges fire), six are partial (lifecycle extensions, Voice Layer rewrite, Risk Manager Category B, evolution timeline, DKB Phase 2, DKB Phase 3 partner-model writers), and two are spec-only (External Intelligence Pipeline, the unverifiable Spec F setup-signature pipeline). The pattern across the partials is consistent: type system + validator + reader-side wiring is in place, and the writer that would actually populate the data is the missing piece. The architecture is well-prepared for data that nobody is producing yet.

---

# Section 10: Open Questions Surfaced

These questions surfaced during the audit. They are split into "questions the code raises" (issues only visible from reading the code) and "questions the user's spec list raised that I could not resolve from the repo alone."

## 10.1 Questions raised by the code

**Q-CODE-1.** Two battle-creation paths exist: client-side `src/firebase/firebaseService.js:240` calls `createInitialVision`; server-side `api/_utils/agentBattleService.js` does not. Are both paths actually exercised, or is one dead? If both are live, do server-created battles ship without a Vision (which would fail the Phase-2a `battle?.vision ?? null` defensive read silently)?

**Q-CODE-2.** Who is supposed to call `updateConsolidatedInsight` (`agentService.js:227`)? The `pendingConsolidation` flag set at `reflect.js:120` fires every 5 games and has no consumer. Is the consolidation Sonnet supposed to be a cron, a client-triggered action, or part of the next reflection call?

**Q-CODE-3.** `partnerProfile` (15 dimensions) and `convictions[]` are read by `voiceLayerPrompt.js` but no production writer was found. Is there an unmerged elicitation-update writer, a planned cron, or is the intent that Gemma's chat output schema be extended with `_partnerProfileUpdate` / `_convictionUpdate` fields and `chat.js` write them?

**Q-CODE-4.** The Voice Layer prompt does not read `battle.vision`, even though Vision is supposed to be the strategic anchor that Gemma defends and updates. Is this a Phase-2b deferral, or a deliberate split where Gemma authors Vision (via state transitions) but never reads it back?

**Q-CODE-5.** The `category_b_forge` constraint type is fully validated, rendered, and tested — but no rule in `forgeKnowledgeBase.js` is tagged as Category B, and no writer creates these constraints. Which Forge rules should become `category_b_forge` constraints, and at what point in the deploy lifecycle should the writer fire?

**Q-CODE-6.** Risk Manager LOCK actions are ephemeral per-tick. Should LOCKs be persisted as `system_injected` Vision constraints with `lifecycleBinding: 'event'` so they survive evaluation cycles and Haiku can reason about them across ticks?

**Q-CODE-7.** Sonnet is allowed as an actor on `* → retired` transitions but the cron always uses `actor='cron'`. What is the planned Sonnet retirement path (the comment in `visionTransitions.js` mentions "user-triggered early-end flows where Sonnet authors the retirement decision") and is it scheduled?

**Q-CODE-8.** The DKB exists as 8 static JSON files in `/dkb/thematic/` and is never queried at runtime. Is the plan to mirror these into a Firestore `domainKnowledge` collection, or to load them at server startup, or to compute a daily semantic-match cache? The voice-layer-cache cron is the natural place for the third option but currently does not write `relevantPatterns`/`tacticalContext`.

**Q-CODE-9.** `agent.lessons[]` is written by Haiku and Gemma but is not read by any prompt — only by the UI (`AgentEvolutionTab.jsx`). Is this intentional (lessons are user-facing artifacts only, not LLM context) or is the consolidation step supposed to read from `lessons[]` and produce `consolidatedInsight`?

**Q-CODE-10.** The "Layer 1" actor admitted in `VALID_TRANSITIONS` (`null → unformed` and `null → unformed` via `layer1`) has no module by that name. What is Layer 1, where is it supposed to run, and what does it do?

## 10.2 Spec questions referenced by the user

The user's prompt mentioned "Q6, Q7, Q8, Q9, Q10 from REGIME_REVAMP_AUDIT_V1." That document is **not present in the repo** (only `audit-01b-regime-classifier.md`, `audit-02*.md` etc. under `/discovery/` exist; no `REGIME_REVAMP_AUDIT_V1.docx` or `.md`). I cannot enumerate Q6-Q10 from a document I do not have access to. If the user can paste Q6-Q10's text, I can map each to current code state.

Likewise: `SPEC_A_VISION_REFERENCE_V1_2.md`, `REGIME_REVAMP_DIFF_SUMMARY.md`, `VOICE_LAYER_ROADMAP_V6_FINAL.docx`, `FANTASYTRADES_USER_ROLE_DESIGN_V1_3.docx` are all absent from the repo. The audit synthesized findings from `VOICE_LAYER_PROMPT_CONSTRUCTION_GUIDE.md` (the one spec doc that is present) plus inline code comments that cite spec-doc sections. Any "open questions raised in the spec docs" beyond what's in those code comments cannot be resolved from this audit.

## Bottom Line

The code itself surfaces ten concrete open questions, the most consequential of which (Q-CODE-2 through Q-CODE-6) all converge on the same theme: writers exist for raw inputs, readers exist on the prompt side, and the curation/persistence/promotion middle layer is missing across multiple subsystems. Spec-level open questions referenced by the user (Q6-Q10 from REGIME_REVAMP_AUDIT_V1) cannot be resolved because the spec doc is not in the repo. Five referenced spec docs from the user's reading list are absent; only `VOICE_LAYER_PROMPT_CONSTRUCTION_GUIDE.md` is present. To unblock further auditing, the user would need to share those documents or confirm that their content has been absorbed into code-level comments (which is plausible given how heavily the type/validator files cite §-numbered spec sections).

---

# Cross-Cutting Synthesis

**The question:** Given current state, where could a per-agent Context Dossier sit in this architecture without colliding with Vision, the Voice Layer, or the Forge — and what would need to be true (specced, built, decided) before it could be designed responsibly?

## The architectural niche

A per-agent Context Dossier most naturally lives on `agents/{id}` as the curated cross-battle layer that already half-exists there. The architecture has three concentric scopes:

1. **Battle scope** (`agentBattles/{id}`) — Vision lives here. Per-battle thesis, per-battle constraints, per-battle evidence trail. Vision dies (`retired`) when the battle ends. This is correct: a Vision is a battle-specific strategic frame.
2. **Strategy/loadout scope** (Forge bundles + `agent.activeRules[]`) — what the agent will execute. Compiled rules. Mostly text rendered into Haiku's prompt. Lifecycle is per-deploy, not per-battle and not per-game.
3. **Cross-battle agent scope** (`agents/{id}` fields: `memory`, `lessons`, `convictions`, `partnerProfile`, `consolidatedInsight`, `evolutionCycle`, `forgeSuggestions`) — what the agent has learned, who the partner is, what the agent believes, what the agent has accumulated. **This is the dossier scope.**

A Context Dossier as a new construct would not introduce a fourth scope; it would consolidate the third. It would not collide with Vision because Vision is battle-scoped and the Dossier is agent-scoped. It would not collide with the Voice Layer because the Voice Layer is a prompt-construction surface that consumes dossier-shaped data, it does not own that data. It would not collide with the Forge because the Forge owns rule registry, bundles, and deploy mechanics — none of which are dossier-shaped (Forge data is loadout, not learning).

The cleanest definition for the Dossier slot: "the curated layer that bridges raw cross-battle accumulation (`memory[]`, `lessons[]`) on one side and the live-prompt reads (`consolidatedInsight`, `partnerProfile`, `convictions[]`) on the other."

## What currently fills (or fails to fill) that niche

The niche is half-filled with a consolidation-shaped hole in the middle:

- **Filled, working:** `memory[]` (Sonnet rolling 5-game), `lessons[]` (Haiku/Gemma raw), `forgeSuggestions[]` (user-confirmed routing), `activeRules[]` (deployed bundle), `stats`, archetype config.
- **Spec'd-as-input, no writer:** `consolidatedInsight`, `evolutionCycle`, `partnerProfile`, `convictions[]`, `pendingConsolidation` (set but unconsumed).
- **Read into prompts, depends on missing writers:** the Voice Layer Block 2 (Partner Model) and Block 3 (Convictions + Consolidated Insight) — both functioning structurally but operating on stale or empty data because their inputs aren't being refreshed.

So today's "dossier" is a 5-game rolling window (`memory[]`) plus an unbounded raw-lessons array (`lessons[]`) plus a queue of user-confirmed Forge candidates (`forgeSuggestions[]`) — and the consolidation step that should turn the first two into curated insights, conviction updates, and partner-model refinements is not running. The architecture is shaped for a Dossier; the data flowing through that shape is partial.

## What needs to be true before a Dossier can be designed responsibly

Four prerequisites surface from this audit:

**1. The consolidation writer must exist.** The orphaned `updateConsolidatedInsight` in `agentService.js:227` and the `pendingConsolidation` flag in `reflect.js:120` are evidence of an intended-but-unbuilt consolidation cron or post-reflection step. Whoever designs the Dossier needs a committed answer to: where does the consolidation happen, what model runs it (Sonnet, given that Sonnet already does post-battle reflection), and on what cadence (every 5 games per the existing flag, or different)? Without this, the Dossier's read-side fields keep being stale.

**2. The partner-model and conviction writers must exist.** Today, Voice Layer Block 2 (Partner Model) and Block 3 (Convictions) read `agent.partnerProfile` and `agent.convictions` but no production writer touches either field. The dossier design has to commit to a writer pattern: either Gemma extends its output schema with `_partnerProfileUpdate` / `_convictionUpdate` fields and `chat.js` applies them, or a separate elicitation/consolidation step writes them. Either choice has consequences for the prompt construction guide and for the agent doc's mutation surface.

**3. The lesson → constraint and lesson → rule promotion paths must be specified.** Today, lessons → Forge rule is explicit and user-gated (`_forgeSuggestion` only when user says "send that to the Forge"). Lesson → Vision constraint is unspecified. The Dossier sits exactly at the junction where these promotion decisions are made. If the Dossier curates which lessons graduate to (a) lasting Forge rules, (b) per-battle Vision constraints, or (c) just durable agent-level wisdom, the rules for that promotion need to be decided before a write surface is designed. Otherwise the Dossier becomes another orphaned schema.

**4. The relationship between Dossier and Vision must be one-directional.** Vision is battle-scoped; Dossier is agent-scoped. Crossing this boundary in the wrong direction creates leaks: a Dossier that writes into `vision.constraints[]` mid-battle would conflate the lifetimes; a Vision that mutates Dossier fields mid-battle would un-isolate battle outcomes from durable agent state. The clean direction is: at battle creation, the Dossier's curated reads (consolidated insight, dominant convictions, partner profile) seed the new Vision's `evidenceTrail`/`thesis` defaults. At battle end, Sonnet's reflection updates the Dossier (via the consolidation writer above) but does not re-open the retired Vision. This unidirectionality needs to be a design contract before the Dossier is built.

## A concrete shape for the niche

If the four prerequisites are satisfied, the Dossier's most defensible shape is:

- **Scope:** field-cluster on `agents/{id}` (matching where dossier-shaped data already lives), not a new collection
- **Owners:** Sonnet (consolidation, conviction updates, partner-model refinement after reflection); Gemma (proposes updates as JSON fields in chat output); user (confirms via explicit chat actions for promotions to Forge)
- **Read consumers:** Voice Layer Blocks 2/3 (already wired); strategy prompt's `RECENT GAME MEMORY` block (already wired via `memory[]`); battle-creation's Vision seeding (new wire — feed dossier into the initial `evidenceTrail` and seed `thesis`)
- **Refresh cadence:** every 5 games for full consolidation (matching the existing flag); incrementally during chat for partner-profile dimension confidence updates and conviction confidence drift; at battle end for memory append
- **Boundary:** Dossier reads from Vision history (the now-retired `evidenceTrail`/`transitionHistory` of completed battles) but never writes to a non-retired Vision

This shape preserves the three existing scopes, fills the consolidation hole instead of creating a parallel one, and makes the read-side fields the Voice Layer already depends on actually populate.

## Bottom line

The architectural niche for a Context Dossier exists and is partially occupied. It sits at agent-scope, between battle-scoped Vision and config-scoped archetype/Forge bundles. Half its slots are functioning (`memory`, `lessons`, `forgeSuggestions`); half are scaffolded but unfilled (`consolidatedInsight`, `partnerProfile`, `convictions`, `evolutionCycle`). Before a Dossier can be designed responsibly, four things need to be decided and built: a consolidation writer that consumes the `pendingConsolidation` flag; explicit writers for partner-profile and conviction updates; a specified promotion path for lessons → constraints → rules; and a unidirectional contract that the Dossier reads from retired Visions and seeds new ones, but never mutates an active Vision. None of these are speculative future work — they are gaps already visible in the current code's read/write asymmetries. The Dossier doesn't need a new home; it needs the missing half of the home it already has.

---

# Appendix: Spec Document Summaries

The user's audit prompt listed six spec docs to summarize. **Five of those six are not present in the repository.** Only `VOICE_LAYER_PROMPT_CONSTRUCTION_GUIDE.md` is on disk. The other five filenames return zero matches under any reasonable casing or path. To honor the audit's "summarize each in 3-5 bullets" requirement without fabricating content, I've split this appendix into "summarized from source" and "missing from repo."

## A.1 SPEC_A_VISION_REFERENCE_V1_2.md — MISSING from repo

I could not locate this file. The closest evidence is the in-code citations in `src/types/vision/visionTypes.js` (header cites "SPEC_A_VISION_REFERENCE_V1_0 §2.1-§2.3"), `visionEnums.js` (cites "§2.2"), `visionFactory.js` (cites "§2.4"), `visionTransitions.js` (cites "§2.5"), and `visionValidators.js` (cites "§2.6 invariants"). These citations indicate the spec exists somewhere but is not in the repo. From the code citations, the V1.0 spec must contain at minimum:
- §2.1-§2.3: TypeScript-style schema for Vision and its sub-shapes
- §2.4: Initial-value contract for newly-created Visions
- §2.5: State-machine edge table
- §2.6: Invariants (conditionSnapshot null/non-null, transitionHistory length growth, lastTransitionAt = transitionHistory[last].timestamp, createdAt ≤ lastTransitionAt)
- Three locked decisions ("FLAG A": JSDoc translation; "FLAG B": duck-typed timestamps; "FLAG C": state-gated conditionSnapshot)

V1.2-specific content (e.g., changes from V1.0 → V1.2) cannot be summarized without the document.

## A.2 REGIME_REVAMP_AUDIT_V1.docx — MISSING from repo

Not present. `find` over the repo returns no `REGIME_REVAMP_*` files, and no `.docx` matches that name. I cannot summarize what survives, what dissolves, or the Q6-Q10 questions referenced in the audit prompt.

## A.3 REGIME_REVAMP_DIFF_SUMMARY.md — MISSING from repo

Not present.

## A.4 VOICE_LAYER_ROADMAP_V6_FINAL.docx — MISSING from repo

Not present.

## A.5 VOICE_LAYER_PROMPT_CONSTRUCTION_GUIDE.md — present, summarized

This is the one spec document that is in the repo. Read in full (lines 1-715). Summary:

- **Purpose:** complete specification for `buildVoiceLayerPrompt()`, the function that assembles Gemma's system prompt at call time. Defines block list, assembly order (U-shaped attention layout), token budgets, phase rules, and few-shot examples.
- **Block taxonomy:** static blocks (1 Identity, 1.5 Game Mechanics, 7 Output Format) at the top; reference material in the middle (2 Partner Model, 3 Convictions, 3.5 DKB Anchor, 3.6 DKB State-Triggered, 3.7 DKB Semantic RAG, 3.8 External Article when present, 4A Portfolio Briefs, 4B Scout Alerts); active state at the bottom (5 Battle State, few-shot example, conversation history, server-injected elicitation target, 6 Phase Rules last).
- **Phase model:** three phases (Discovery games 1-10, Refinement 11-30, Mastery 31+), each with a ~400-token Block 6 personality block. Only one phase block is loaded per call.
- **External-article pipeline (Block 3.8):** detection regex on user message; URL fetch + readable-text extraction OR pasted-text path; injects ~1,500-token article block, trims Semantic RAG to ~100 tokens, trims conversation history to compensate.
- **Token budget:** ~1,695 min / ~3,705 max system prompt without article; ~4,905 max system with article. Full prompt with max history: ~9,905 tokens with article. Well under Gemma's 262K context.

This guide is the source of the spec-vs-code comparison in Section 4 of this audit.

## A.6 FANTASYTRADES_USER_ROLE_DESIGN_V1_3.docx — MISSING from repo

Not present.

## Bottom Line

Of the six spec documents listed in the user's pre-audit reading list, only the Voice Layer Prompt Construction Guide is in the repository. The other five are missing. The Vision-related specs are partially reconstructible from in-code §-numbered citations (which is how I could verify that Spec A V1.0 contained §2.1-§2.6 content); the Regime Revamp, Voice Layer Roadmap V6, and User Role Design specs are not citable from any source visible to this audit. To complete the originally-requested appendix the user would need to share those five documents (or paste their text). The audit's findings in Sections 1-10 are based entirely on what is actually in the codebase plus the one spec doc that is present.
