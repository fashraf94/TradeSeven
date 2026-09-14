# FT_DECISION_PROVENANCE_AND_ADAPTER_GAP_MAP_V0.1

**Commit:** `1c4a8d3bd326c61ee63f6c8fe7e57633e7e4da20` · **Observed:** 2026-09-14 · **Scope:** what FantasyTrades currently preserves for each agent-battle decision, mapped against the information a future sealed-decision adapter would need. No implementation. The H1C envelope concepts are used only as a provisional checklist; nothing here builds against it.

**Live Firestore NOT OBSERVED** — every "persisted" statement below means "current code writes it"; presence on historical documents depends on the flag posture and schema generation at the time (see the surface audit §4).

Legend for status columns: **PERSISTED_DIRECTLY** (a field written by current code) · **DERIVABLE_RELIABLY** (reconstructable from persisted fields + versioned code) · **DERIVABLE_WEAKLY** (reconstructable only with assumptions or from a best-effort/optional store) · **NOT_CAPTURED** · **UNKNOWN**. Gap-map statuses: **AVAILABLE_NOW** · **MAPPABLE_WITHOUT_NEW_INSTRUMENTATION** · **REQUIRES_NEW_INSTRUMENTATION** · **AMBIGUOUS**.

---

## 1. Where a decision lives today (the record set)

For one intraday decision (one `processAgentBattle` tick that called the model), current code writes to:

| Store | Path | Written when | Write mode | Gate |
|---|---|---|---|---|
| Evaluation entry | `agentBattles/{id}.evaluations[i]` (cap 150) | every model-called tick | rides the awaited `finalUpdate` (`agent-evaluate.js:2893`) | always; stamps need `TICK_STAMPS_ENABLED` ∧ `promptBuilt` |
| Trade entry | `agentBattles/{id}.trades[i]` (cap 50) | executed swap | inside the swap transaction (`agentSwapExecution.js:357-367`) | always |
| Status feed | `agentBattles/{id}.statusFeed[]` (cap 100) | every tick | rides `finalUpdate` | always |
| Cron state | `agentBattles/{id}.cronState.*` | every tick | rides `finalUpdate` | always |
| Learning receipt | `learningReceipts/{battleId}/receipts/{agentId}_seq{n}` | executed swap of a live agent | awaited `.create()` (`captureReceipt.js:420`) | `LEARNING_L1_CAPTURE_ENABLED` (+`EXPANSION` for non-Haiku classes) |
| Shadow diff | `agentBattles/{id}/shadowDiffs/{cronStartIso_battleId}` | every model-called tick of a manifest battle | awaited `.create()` (`shadowAssemblyCapture.js:250`) | `SHADOW_ASSEMBLY_ENABLED` ∧ manifest |
| Gate aggregates / terminal gates | `agentBattles/{id}.shadowGateAggregates[]`, `.shadowTerminalGates[]` (cap 64) | same | ride `finalUpdate` | same |
| GCS evaluation record | `gs://fantasytrades/shadow/evaluations/{date}/…jsonl` | every model-called tick | fire-and-forget (`shadowLogger.js:44-69`) | `GCS_CREDENTIALS` |
| Regime stamp | `agentBattles/{id}.regimeAtStart` | first tick, write-once | transaction | `REGIME_STAMP_ENABLED` |
| Control epoch | `agentBattles/{id}.controlEpochLog[]` | once per mode-epoch | awaited arrayUnion | always |
| Manifest | `agentBattles/{id}.resolvedAgentManifest` | creation only | in the creation write | `MANIFEST_WRITE_ENABLED` |

Deploy-time decision (`decide.js`): `agents/{id}.lastDecision` (awaited), `agents/{id}.deployProgress.*` (fire-and-forget dot-paths), GCS `shadow/decisions`, and the battle doc's `agentContext` freeze.

All gating flags are `true` at HEAD (`src/config/featureFlags.js:1050,1070,1089,1326,1348,2238`).

---

## 2. Provenance map (Target G)

| Item | Status | Where / how | Notes |
|---|---|---|---|
| Agent identity | PERSISTED_DIRECTLY | `agentBattles.agentId`, `ownerId`; `evaluations` implicitly by doc | For casual-clone battles `agentId` is the CLONE id; parent attribution is resolved at write time (`casualClone.js`), and receipts carry `attributionAgentId` |
| Archetype identity | PERSISTED_DIRECTLY | `agentContext.archetype` (frozen at creation, `agentBattleService.js:183`); receipts `archetype`; manifest `valuesAtLock.archetype`; identity version stamps `versionStamps.identityVersionAtLock/identityHashAtLock` | Old docs may carry the `'unknown'` sentinel; `agents.archetype` is mutable and must not be used |
| Environment / battle identity | PERSISTED_DIRECTLY | battle doc id, `gameMode`, `groupId` (tournament), `duration:'fullday'`, `timing`, `expiresAt`; envelope `tickId` = `${cronStartIso}_${battleId}` | Engine discriminator is `gameMode` (absent/unknown ⇒ tiered by construction) |
| Decision timestamp | PERSISTED_DIRECTLY | `evaluations[i].timestamp` (post-model instant), `trades[i].swappedOutAt`, `cronState.lastEvalStartedAt`; envelope `evaluatedAt`/`cronStartIso` | Quote fetch instant not persisted; EODHD `price.timestamp` fetched but dropped |
| Parameter/config snapshot | PERSISTED_DIRECTLY (versions, equipped layers) / DERIVABLE_RELIABLY (numeric knob values) | `resolvedAgentManifest` (frozenLayers, `equippedConfigHash`, `valuesAtLock`, `versionStamps`); `agentContext.{activeRules,deployedGuardrails,standingLeans,dials,settingsRev,riskTolerance}`; `strategyPreset`; trades `swapProvenance.{knobConfigVersion,dialBandVersion,tempoEffective}`; envelope `effectiveRuntimeResolution` | hftConfig/preset/guardrail numeric VALUES are not persisted — derivable from `KNOB_CONFIG_VERSION` etc. + the code table at that version, provided the version bump discipline held (CI locks exist) |
| Price evidence visible | DERIVABLE_WEAKLY | held positions: `evaluations[i].evidence[sym].{px,chg,atrX,vwapDev,bbPct,nr7,regime,risk}` + `vintages` (tick stamps); swap legs: `trades[i].snapshot.{symbolIn,symbolOut}.intraday.currentPrice` etc.; `cronState.lastTickPrice[sym]` (stagnation detector) | Bench/hotBench/macro prices as shown are NOT persisted; the full `prices` table is not written; shadow diff stores a hash of the re-derived context block, full text only on divergence |
| Nonprice evidence visible | DERIVABLE_WEAKLY | directive: `evaluations[i].heard{directiveThreadId,suppressed}` + `battle.directive` + `controlEpochLog`; leans/rules/guardrails/watchlist: `agentContext` freeze; news: `cronState.seenStoryIds` (ids only, cap 50) + `triggers[]` text with headline; regime/posture: `marketPosture`, `evidence.regime`, `regimeAtStart`; vision: `battle.vision` | Which 3 stories were rendered, the institutional block, fundamentals values, and bench technical block are not persisted per tick (vintages only) |
| Prior position | PERSISTED_DIRECTLY | `trades[i].{symbolOut,tier,slotIndex,entryPrice,swapDay}`; receipt `guardrailReplay.{outgoingEntryPrice,outgoingBaseATR,outgoingSwappedInAt/Day,thresholdHistory}`; `agentContext.initialPortfolio`; `portfolio` (current state) | Full book at an arbitrary tick is reconstructable by replaying `initialPortfolio` + `trades[]` (cap 50 — `tradesLenAtDecision`/`tradeCountAtDecision` on receipts flag truncation) |
| Proposed action | DERIVABLE_WEAKLY | `evaluations[i].{decision,symbolOut,symbolIn}` only when applied; on downgrade symbols are nulled (`agent-evaluate.js:2660-2662`); `shadowTerminalGates[].proposedAction` (shadow path); `validationErrors[]` text; `guardrailOverrides[].originalDecision` (string only) | On a guardrail-forced SWAP the model's proposal is overwritten in `haikuResult` (`:2142-2151`) — original symbols/rationale unrecoverable except via `originalDecision`/text |
| Applied action | PERSISTED_DIRECTLY | `trades[i]` (symbols, prices, points); `statusFeed[]` action/source; `evaluations[i].decision` | — |
| Target sign | DERIVABLE_RELIABLY | always long (no direction field on agent positions; `direction:null` on trades) | — |
| Target exposure | DERIVABLE_RELIABLY | slot/tier ⇒ multiplier (`trades[i].tier`, per-asset `tierMultiplier` on flat6) | No dollar exposure concept exists |
| Sizing / risk transformation | PERSISTED_DIRECTLY (which gate fired) / DERIVABLE_RELIABLY (thresholds via version) | `evaluations[i].{guardrailOverrides,guardrailSourceNote,validationErrors,downgraded}`; `trades[i].{exitReason,source,swapMotive,hftKnobsSource,swapProvenance}`; statusFeed `citedRules/triggeredBy`; receipts `exitReason/haikuSwapReason/source` (closed enums) | Hurdle-floor margins and cap counts at decision time are not persisted (only the block reason string) |
| Rationale / reasoning | PERSISTED_DIRECTLY (selective) | `evaluations[i].{rationale,hypothesis,conviction,riskAssessment,trade_reasoning}`; `trades[i].{rationale,hypothesis,trade_reasoning,entryConviction}`; GCS record | Verbatim tool JSON not stored; `anticipationCandidates[].rationale` cut; guardrail-forced swaps replace rationale with a synthetic string |
| Evidence attribution | DERIVABLE_WEAKLY | model self-report: `cited_rules` (statusFeed only), `citedForgeRules`/`overriddenForgeRules`, `trade_reasoning.indicators`, `directiveThreadId`, `ignoredDirectiveIds`; engine-side: `triggers[]`, `evidence`, `heard` | Self-report vs engine facts are kept distinct by design (tick stamps doc) — but no field links a cited indicator to the rendered value |
| Failed prerequisites | PERSISTED_DIRECTLY | `evaluations[i].haikuError{failureClass,message}`, `cronState.{cronErrors[],consecutiveEvalFailures}`, `statusFeed eval_degraded`; deploy: `deployProgress.{stage,errorPhase,fallbackKind}` | Deploy retry exchange and validation strings are console-only |
| Platform constraints in force | DERIVABLE_RELIABLY | version stamps + `gameMode` + `strategyPreset` + `agentContext` + flag posture at the commit (`envelope.effectiveRuntimeResolution.commitSha`) | Flag posture at tick is not persisted except via commit SHA (shadow path) and `controlEpochLog.modes` (3 modes) |
| Platform-forced attribution | PERSISTED_DIRECTLY | `trades[i].source ∈ {haiku, archetype, risk_manager, guardrail, gameplan_meeting}`, `exitReason` enum; statusFeed `source`; receipts `source`/`exitReason` | Reliable: closed enums validated at receipt write |
| Model / provider / version | DERIVABLE_WEAKLY | only `envelope.effectiveRuntimeResolution.modelId` on shadowDiffs / gate aggregates / settlement (manifest battles, shadow flag); deploy `lastDecision.models` is a display label (`'sonnet-4'`, `'haiku-4.5'`) | Not on `evaluations[i]` |
| Prompt / version | DERIVABLE_WEAKLY | `PROMPT_SPEC_VERSION` (=1, never bumped through prompt changes) in envelope; `EVAL_IDENTITY_PROMPT_SPEC_VERSION` constant; shadow `hashes.{liveSystem,liveIdentity,liveContext}` of RE-DERIVED prompts; `sizes` | Exact sent strings not stored; the re-derivation runs the same builders on the same in-memory objects and is expected but not proven byte-equal |
| Raw model output | NOT_CAPTURED | — | Only ~12 hand-picked properties survive; `grep rawResponse` has zero hits in `agent-evaluate.js` [lane] |
| Parsed output | PERSISTED_DIRECTLY (subset) | as rationale/decision/symbol/conviction/… fields above | `cited_rules`, `pvp_context`, `status_feed_update` live on statusFeed only |
| Retry history | NOT_CAPTURED (deploy) / N/A (eval: no retries) | eval `maxRetries:0`; failures recorded; deploy single retry unrecorded | — |
| Token usage per decision | DERIVABLE_WEAKLY | `cronState.totalTokens` running sums; per-tick counts only in GCS `tokenUsage` | — |

---

## 3. Adapter gap map (Target H, provisional checklist only)

| Envelope concept | Status | Source location(s) | Why |
|---|---|---|---|
| Sealed decision identity | AVAILABLE_NOW | `evalId` (per battle, monotonic `eval_NNN`), battle doc id, `tickId` in envelope; trade `id`/`evaluationId`; receipt id `{agentId}_seq{n}` | Unique within a battle; globally unique only with the battle id |
| Environment identity | AVAILABLE_NOW | `gameMode`, `groupId`, `duration`, `timing`, `expiresAt`, `resolvedAgentManifest.versionStamps.gameModeAtLock/gameModePolicyHashAtLock` | Engine-scoped; mandate books are a different identity space (`mandates/{id}`) |
| Parameter snapshot | MAPPABLE_WITHOUT_NEW_INSTRUMENTATION | `resolvedAgentManifest` + `agentContext` + `strategyPreset` + version constants at the commit SHA | Numeric knob values must be looked up from the code table by version — acceptable only while version-bump CI locks hold; treat as MAPPABLE, not AVAILABLE |
| Evidence visible to agent | REQUIRES_NEW_INSTRUMENTATION | partial: `evaluations[i].evidence` (held), `vintages`, `trades[i].snapshot` (two legs), `heard` | Bench/hotBench/macro/news/fundamentals as rendered are not persisted; prompt text only hashed (shadow) |
| Evidence actually relied upon | AMBIGUOUS | model self-report (`trade_reasoning.indicators`, cited rules, `directiveThreadId`) | Self-report is not attribution; no engine-side linkage exists and none can be derived |
| Prior position | AVAILABLE_NOW | `initialPortfolio` + `trades[]` replay; receipt `guardrailReplay` | Cap 50 on `trades[]` (truncation flagged on receipts) |
| Proposed action | REQUIRES_NEW_INSTRUMENTATION | shadow `proposedAction` (downgrades), `originalDecision` string, `validationErrors` text | Guardrail-forced path overwrites the proposal in place |
| Target direction / exposure | AVAILABLE_NOW | long-only by construction; tier/slot → multiplier | Trivial mapping; document the constraint |
| Risk / sizing transformation | MAPPABLE_WITHOUT_NEW_INSTRUMENTATION | `guardrailOverrides`, `exitReason`, `source`, `swapProvenance`, `validationErrors` + code at commit | Numeric margins/counts at decision time not persisted |
| Rationale classification | AVAILABLE_NOW (declared) | `swap_type` → `swapMotive` (Tier-1 observability), `riskAssessment`, `trade_reasoning.strategy` | Model-declared; null on deterministic fires by design |
| Evidence attribution | AMBIGUOUS | `cited_rules`/`citedForgeRules`/`overriddenForgeRules`, `trade_reasoning.indicators`, `ignoredDirectiveIds` | Free-text indicators cannot be tied to rendered values |
| Environment constraints | MAPPABLE_WITHOUT_NEW_INSTRUMENTATION | code constants at the commit SHA (see discovery §8/§11) + `controlEpochLog.modes` | Flag posture at the tick beyond the three logged modes is only derivable from the commit SHA (shadow path) |
| Platform-forced attribution | AVAILABLE_NOW | `trades[i].source/exitReason`, `statusFeed.source/triggeredBy`, receipt enums | Closed vocabularies, validated |

### Sufficiency verdict

- **CURRENTLY AVAILABLE:** identity (agent, archetype-at-creation, battle, engine), timestamps, applied action and its ledger effect, platform-forced attribution, declared rationale/classification, failure classes, held-position evidence numbers + vintages (tick stamps), config layers + version stamps (manifest), prompt hashes + model id + commit SHA (shadow path, manifest battles only).
- **DERIVABLE:** numeric constraint values (via versions + code), prior book at any tick (replay), target sign/exposure (by construction), flag posture (via commit SHA).
- **MISSING:** exact prompt bytes and raw model output; the candidate menu and full price table as rendered; the proposal on guardrail-forced swaps; model/prompt identity on the decision entry itself; deploy-time retry/validation capture; per-tick token counts in Firestore; quote timestamps.
- **AMBIGUOUS:** "evidence relied upon" (only self-report exists), and whether the shadow re-derived prompt equals the sent prompt byte-for-byte.

**Conclusion:** an FT adapter is **FEASIBLE_WITH_INSTRUMENTATION**. The environment side can be mapped today; the sealed decision side needs the six additive capture categories listed in the discovery report §0.4. No recommendation on how to build them is made here.
