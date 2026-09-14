# FT_FIRESTORE_SURFACE_AUDIT_V0.1

**Commit:** `1c4a8d3bd326c61ee63f6c8fe7e57633e7e4da20` · **Observed:** 2026-09-14 · **Read-only.** Nothing was written, updated, deleted, migrated, or normalized.

## 0. Observation status

| Source | Status |
|---|---|
| Live Firestore (production or preview) | **NOT OBSERVED** — no `FIREBASE_PROJECT_ID`/`CLIENT_EMAIL`/`PRIVATE_KEY`, no `GOOGLE_APPLICATION_CREDENTIALS`, no service-account JSON, no ADC in this container; `.firebaserc` absent (DRIFT_LEDGER D-5) |
| Inferred schema from code | writers/readers enumerated across `api/` and `src/` (one read-only lane, load-bearing anchors re-read by the author) |
| Rules / indexes in repo | `firestore.rules` (1,088 lines, last changed 2026-09-02 `613da8d8`), `firestore.indexes.json` (35 composite indexes, last changed 2026-08-26) |
| Deployed rules | recorded once: `docs/composition/RULES_DEPLOY_RECORD.json` — `deployedAt 2026-08-13T06:20:16Z`, sha256 `7bd361d8…`, operator Flash; the repo file changed after that date, so **repo ≠ necessarily deployed** |
| Historical live observations (other sessions) | 22 `agentBattles` created ~2026-03-27 → 05-22 (`CALIBRATION_DATA_DISCOVERY_REPORT.md`, 2026-05-28); on 2026-08-05: `stockRankings.stocks = 236`, active battles 5→9, `shadowDiffs` docs carrying `commitSha` and `sizes.liveSystem` (`docs/audits/20260805_PR2_POST_FLIP_LIVE_VERIFICATION.md`) |

Classification vocabulary: CURRENT_ACTIVE · CURRENT_BUT_OPTIONAL · HISTORICAL · LEGACY · UNCLEAR.

---

## 1. Collections relevant to the agent environment

| Collection / path | Class | Current writer(s) | Current reader(s) | Client rules | Notes |
|---|---|---|---|---|---|
| `agentBattles/{battleId}` | CURRENT_ACTIVE | `createAgentBattle` via `commitBattleDocWithPin` (`compositionGenerationFence.js:151/153`); `agent-evaluate.js` (~20 update sites incl. `:2893` finalUpdate, `:1172` regime tx, `:4469` completion tx); `agentSwapExecution.js:357-367` (tx); `agent-daily-scores.js:193`; `agent-batch-review.js:129,315`; `process-pending-reflections.js:88-90`; `chat.js:1067-1079`; `file-directive.js:282-286`; `ensure-opener.js:309-312`; `voiceLayer*.js`; `controlSuppressionTelemetry.js:234`; `shadowAssemblyCapture.js:445`; `masterySettlement.js:394`; `decide.js:764,1388` (bare GC); client `agentService.js:566-650` (allowlisted keys) | `findActiveAgentBattles` (`agentBattleService.js:43-50`); reflections/review queues; GC-repair query (`agent-evaluate.js:4625`); tournament services; client hooks (`useAgentBattle.js` etc.) | read: owner only; update: `hasOnly([executionMode, pendingProposal, battleLedger, updatedAt, strategyPreset, gameplanMeeting, gameplanMeetingHistory, dailyGrades, feedBookmarks, reviewDecisions])`; create/delete: false (`firestore.rules:429-440`) | spine of the environment; see §2 |
| `agentBattles/{id}/shadowDiffs/{tickId}` | CURRENT_ACTIVE (write-only corpus) | `shadowAssemblyCapture.js:243-261` `.create()` | scripts only (`paired-eval-harness.js`) | none (catch-all deny) | manifest-anchored; gated `SHADOW_ASSEMBLY_ENABLED=true` |
| `battleSettlements/{battleId}` | CURRENT_ACTIVE (write-only) | `shadowAssemblyCapture.js:436-445` | none in runtime | none (catch-all) | flips `agentBattles.receiptCoverage` to `complete` |
| `learningReceipts/{battleId}/receipts/{agentId}_seq{n}` | CURRENT_ACTIVE (write-only corpus) | `captureReceipt.js:407-421` `.create()` | scripts only (`measure-l1-corpus.js`, `preflight-capture-check.js`) | read/write false (`:965-968`) | `LEARNING_L1_CAPTURE_ENABLED=true`; live-agent evidence only |
| `agents/{agentId}` | CURRENT_ACTIVE | client `agentService.js:119-170` (create), `:189-208` (4 allowlisted keys); server: `agentSettingsTx.js:19-22` (all equip/settings, `settingsRev++`), `decide.js:211-225, 666-698, 931, 1350-1358, 1482`, `agent-evaluate.js:4487-4526` (stats + pointer, in tx), `agent-batch-review.js:457`, `chat.js:1093`, `reflect.js:280,310`, `agentConsolidationApply.js:271,302`, `compositionGenerationFence.js:88,104`, clone/CPU minting | everywhere | read: any authenticated user (`:225`); create: heavy allowlist (`:249-300+`); update: `hasOnly([directives, lastViewedEvolutionCycle, starterKitCompleted, updatedAt])`; delete false | `hftConfig` is NOT a field (code table) |
| `agents/{id}/rules`, `/bundles` | CURRENT_ACTIVE | client Forge (`forgeService.js`, `useForge.js`) + server equip endpoints | `decide.js` projection (`projectActiveRules`) | owner-scoped | rules snapshot frozen into `agentContext.activeRules` at deploy |
| `agents/{id}/battlePatterns/{battleId}` | CURRENT_BUT_OPTIONAL | `battlePatternLogger.js:63-70` `.set()` at completion | trait detection (pre-warm) | server-only (`:420`) | aggregates only |
| `agents/{id}/compiledBuilds/{gameMode}` | CURRENT_BUT_OPTIONAL (DARK) | `compileOnSettingsChange.js:438` | deploy gate | none | `COMPILER_ENABLED=false` |
| `indexIntelligence/stockRankings` (doc) | CURRENT_ACTIVE | `compute-index-intelligence.js:1367-1393` (premarket + hourly intraday) | `agent-evaluate.js:948`, `decide.js:318,1314`, tournament boards, research, screener | read auth; write server (`:682`) | universe of record; `mode`, `computedAt`, `expiresAt` (+75 min intraday) |
| `indexIntelligence/{marketContext,SPY,dailyRegimeBrief}` | CURRENT_ACTIVE | same cron (+ `compute-daily-regime-brief`) | eval posture, regime stamp, opener | same | `marketContext.regime/volatilityRegime/updatedAt` |
| `stockTechnicalScores/{symbol}` | CURRENT_ACTIVE | same cron (`:1076`, hourly) | `agent-evaluate.js:947` (`getAll`), receipts refetch | read auth; write server (`:687`) | `factors{}`, `atrPercent`, `updatedAt` |
| `fantasyTimesStories/{id}` | CURRENT_ACTIVE | FantasyTimes crons | `fetchRecentNews` (2 h window), `decide.js` (last 10, deepdives excluded) | read auth; write server (`:642`) | 7 composite indexes |
| `voiceLayerCache/{battleId}` | CURRENT_ACTIVE | `voice-layer-cache` cron (15 min) | opener/narration | server (`:716`) | not an input to the decider |
| `marketDataCache/{SYMBOL_type}` | CURRENT_ACTIVE (infra) | `marketDataCache.js` L2 | same | read auth; write server (`:124`) | agent path uses `forceRefresh:true` |
| `metricSnapshots/{ticker}/daily/{date}`, `quarterlySeries/{ticker}` | CURRENT_BUT_OPTIONAL (headless) | `metricSnapshots.js` inside `compute-rankings` | none | catch-all deny | `METRIC_HISTORY_SNAPSHOT_ENABLED=true` |
| `tournamentGroups/{id}` (+ `boards`, `claims`, `streams`, `ledger/agentHeldSet`, `agentBoards`, `draft/state`) | CURRENT_ACTIVE (tournament engine) | orchestrator, tournament endpoints, `tournamentAgentLedger.js` (whole-doc `tx.set`) | agent eval (`resolveTournamentContext`), League UI | recursive read rules (`:531/541`) | exclusivity ledger `held/reservations/doubleDowns`; reservation TTL 10 min [lane] |
| `mandates/{id}` (+ `decisions`, `dailyRows`, `quarterSummaries`, `corporateActions`, `pendingScoringAppends`), `mandateUniverse*`, `mandateBatches*`, `mandateUpstreamCalls` | CURRENT_ACTIVE (mandate engine) | mandate crons/endpoints | same | rules `:1033-1061` | `MANDATE_SCHEMA_VERSION=1`; per-decision doc shape in `mandateSchema.js:271-312` [lane] |
| `battles/{id}` | CURRENT_ACTIVE for BaggerBomb V4 / HISTORICAL for `_v` 1–3 | client `createBaggerBombBattleV4` (`firebaseService.js:1940`), V4 crons | client hooks; V4 crons | read/create/update: any authenticated user (`:488-493`) | four `_v` generations coexist; unrelated to `agentBattles` |
| `challenges` | LEGACY | `createChallenge` (zero callers) | reads exist | client-writable | — |
| `seasons`, `seasonEntries` (+subs), `seasonLeaderboard` | LEGACY (unscheduled) | on-demand `api/season/*` endpoints only | Season UI | rules `:817-858` | 4 unexercised indexes |
| `gameDesignFeedback` | CURRENT_ACTIVE | `reflect.js:367` | admin | rules `:798` | post-battle, not a decision input |
| `agentChatBudget/{groupId}_{uid}_{dayN}` | CURRENT_ACTIVE | `agentChatBudget.js` | chat | server-only (`:728`) | League arena asks |
| `composition/{activation,writeEpoch}`, `compositionCandidateState/*`, `archetypeVintages` | CURRENT_BUT_OPTIONAL | composition tooling | rules helpers `epochWriteAdmitted()`/`birthProvenanceValid()` | server-only | whether these docs EXIST in production flips agent-create rules semantics — UNKNOWN |
| `masteryProfiles/Config/Quarantine/Audits` | CURRENT_BUT_OPTIONAL (DARK) | `masterySettlement.js` | same | server-only | `MASTERY_XP_ENABLED=false` |
| GCS `gs://fantasytrades/shadow/{stream}/…` (not Firestore) | CURRENT_BUT_OPTIONAL | `shadowLogger.js` fire-and-forget | offline | n/a | needs `GCS_CREDENTIALS`; prior silent loss recorded (BUILD_RULES §5) |

Rules blocks with no code reference: `gameDesignDigests`, `gameDesignFeedbackArchive`, `learningDossiers`, `learningEvidence`, `learningCalibration`, `tournamentBrackets`, `tournamentLeaderboards`, `tournamentRanks`, `tournamentLobby` [lane]. Code collections with no rules block (client-denied by the catch-all at `:1084`): `battleSettlements`, `shadowDiffs`, `compiledBuilds`, `receipts`, `metricSnapshots`, `quarterlySeries`, `peerRankings`, `sectorRankings`, `tournamentOrchestrator`, and others [lane]. `ingestedClaims` has 5 indexes and no code or rules reference.

---

## 2. `agentBattles` — field inventory

### 2.1 Creation shape (golden: `api/_utils/__p4_snapshots__/createAgentBattle.tieredDoc.snap.json`; code `agentBattleService.js:129-300`)

| Field | Class | Writer | Readers | Notes |
|---|---|---|---|---|
| `agentId`, `ownerId` | CURRENT_ACTIVE | creation | everything | clone id for casual battles |
| `status` | CURRENT_ACTIVE | creation `'active'`; completion `'completed'` | pickup query; queues | only two values written |
| `gameMode` | CURRENT_ACTIVE | creation (`'baggerbomb_agent'` \| `'baggerbomb_tournament'`) | mode config, prompts, scoring | absent ⇒ tiered by construction |
| `groupId`, `isCpu` | CURRENT_ACTIVE (tournament only) | creation | tournament context; CPU passivity | joint-stamp contract |
| `duration` | CURRENT_ACTIVE | creation, literal `'fullday'` | UI | `'1d/3d/5d'` values would be HISTORICAL if present |
| `createdAt`, `activatedAt`, `updatedAt`, `completedAt`, `expiresAt` | CURRENT_ACTIVE | creation / completion / swaps | expiry loop, queries | ISO strings (NB `agents.createdAt` is a Firestore Timestamp) |
| `timing{tradingDays,currentTradingDay,timezone,localOpen,localClose,lastDailyResetAt}` | CURRENT_ACTIVE | creation; daily reset bumps `currentTradingDay` | phase/time helpers, directives | — |
| `portfolio{star,core,support,bench{stocks,crypto},startingPrices}` | CURRENT_ACTIVE | creation; swaps (slot/bench rewrite); daily reset (swapPrice clear) | scoring, prompts | crypto inside `support[2]`; per-asset `swapPrice/swappedInAt/swappedInDay/cooldownUntil/tierMultiplier/sector/baseATR` |
| `opponent{portfolio,bench,username,odUserId}` | CURRENT_ACTIVE (tiered) / null (tournament) | creation; `set-opponent.js` | CPU scoring | frozen |
| `scoring{thresholds,tierMultipliers,pointValues}` | CURRENT_ACTIVE (`thresholds`) / written-never-read (`tierMultipliers`,`pointValues`) | creation | swaps read `thresholds` | documented dead config |
| `agentContext{agentName,archetype,strategyBrief,innerMonologue,activeRules,equippedBundleIds,deployedGuardrails,equippedWatchlist,standingLeans,standingLeansInvalidated,dials,settingsRev,riskTolerance,evaluationInterval,consolidatedInsight,tournament?,initialPortfolio}` | CURRENT_ACTIVE | creation only (frozen) | prompt assembly, guardrails, receipts, manifest view | runtime authority for config |
| `resolvedAgentManifest{manifestId,manifestHash,freezePolicyVersion,createdAt,frozenLayers,equippedConfigHash,valuesAtLock,versionStamps,guardrails,renderedTensionPairs,compositionCompat?,…}` | CURRENT_ACTIVE (since flag flip) / absent on pre-manifest docs | creation only | shadow capture (gate), advisory renderer | indexed on `equippedConfigHash` |
| `trades[]` | CURRENT_ACTIVE | `executeSwapServer` (tx) | prompts, scoring (`lockedPoints`), knob C window, receipts | cap 50; shape §2.3 |
| `evaluations[]` | CURRENT_ACTIVE | finalUpdate | prompts (last 3), reflection, UI | cap 150; shape §2.2 |
| `statusFeed[]` | CURRENT_ACTIVE | every tick + voice/chat | UI, gate aggregates | cap 100 (agent) / 50 (terminal write uses 50) |
| `executionMode` | CURRENT_ACTIVE (value fixed `'autopilot'`) | creation; client allowlisted | launch guard | migration guard backfills `'copilot'` on old docs |
| `strategyPreset` | CURRENT_ACTIVE | creation `'balanced'`; client allowlisted | risk levers, prompt | — |
| `pendingProposal`, `proposalHistory[]`, `battleLedger[]`, `gameplanMeeting`, `gameplanMeetingHistory[]` | CURRENT_BUT_OPTIONAL (dormant copilot/gameplan surfaces) | creation; client allowlisted; dormant cron paths | dormant handlers | rules still admit client writes |
| `chatExchanges[]`, `chatBudgetUsed`, `recentElicitationTargets` | CURRENT_ACTIVE | chat/voice endpoints | chat UI, prompts (directive only via `directive`) | not a decider input except through `directive` |
| `watchlist{active,hotBench,monitoring,lastRefreshed,totalStocks}` | CURRENT_ACTIVE | creation (from `lastDecision.watchlist`); rebuild ticks only (`:1051`) | validation (`hotBench`), prompts | menu at non-rebuild ticks not recoverable |
| `scoreState{currentScore,activeScore,bankedScore,opponentScore,dailyScores,bankedBadgePoints,tradeCount,holdCount,evaluationCount,lastScoredAt,peakScore,peakScoreAt}` | CURRENT_ACTIVE | every tick; swaps (`tradeCount`); daily reset | settlement, UI | final score = `currentScore` at last tick |
| `thresholdHistory{sym:{maxMultiplier,minMultiplier,badges,dailyThresholds}}` | CURRENT_ACTIVE | every tick (dot-path merge); swaps; daily reset | badges, trailing stop | keys accumulate per symbol ever held |
| `cronState{lastEvaluatedAt,lastTriggeredAt,lastEvalStartedAt,evaluatingAt,triggerGatePassCount,totalHaikuCalls,totalTokens,consecutiveHolds,consecutiveEvalFailures,cronErrors[],seenStoryIds[],vwapTicks,intradayMomentum,stagnationTicks,lastTickPrice,lastTickTimestamp,vwapFireGuard,lastEvalTradingDay,lastHotBenchComputedAt,lastGameplanDate}` | CURRENT_ACTIVE | every tick (`finalizeCronState`) | lock, fair rotation, counters | `triggerGatePassCount` is misnamed (counts skips) |

### 2.2 `evaluations[i]` entry (`agent-evaluate.js:2654-2694`, stamps `tickStamps.js`)

`evalId, timestamp, day, battlePhase, decision, symbolOut, symbolIn, tier, rationale, hypothesis, conviction, riskAssessment, ignoredDirectiveIds[], directiveThreadId, trade_reasoning{thesis,strategy,indicators[],citedRules[],conviction}, citedForgeRules[], overriddenForgeRules[], triggers[], scores{active,banked,total}, validationErrors[], downgraded, marketPosture, guardrailOverrides[], guardrailSourceNote, haikuError{failureClass,message,timestamp,evalId}|null` + (since 2026-09-10) `heard{directiveThreadId,suppressed}?`, `evidence{sym:{px,chg,atrX,vwapDev,bbPct,nr7,regime,risk}}`, `vintages{quote,vwap,techAt,fundAsOf,rankingsAt}`, `candidates[]?`.

Generations: entries before `TICK_STAMPS_ENABLED` (flipped 2026-09-10) lack the four stamp keys; entries before the guardrail/haikuError instrumentation (June–July 2026) lack `guardrailOverrides`/`haikuError`; `trade_reasoning`/`citedForgeRules` arrived in "Phase 8". Presence on live docs NOT OBSERVED.

### 2.3 `trades[i]` entry (`agentSwapExecution.js:255-273` + `evaluationMetadata` spreads)

`symbolOut, symbolIn, name, tier, slotIndex, entryPrice, exitPrice, lockedPoints, lockedGainPct, swappedOutAt, swapDay, isCrypto, direction, id, action, trigger, rationale, hypothesis, evaluationId, tradingDay, entryRegime, entryMarketPosture, entryConviction, entryPreset, entryMode, exitReason, swapMotive?, source, archetype, hftKnobsSource, swapProvenance{tempoDesired,tempoEffective,selectionSource,dialBandVersion,knobConfigVersion,suppressionReason?}, trade_reasoning, snapshot{symbolOut,symbolIn}` (each a `buildTechnicalSnapshot` object with `trend, momentum, volatility, volume, smaStack, rs, levels, pivots, recentAction, intraday, composite, capturedAt`).

Generations: pre-Phase-4 trades lack `snapshot`; pre-Keystone trades lack `exitReason`/`source`/`hftKnobsSource` (Knob C treats missing `exitReason` as non-emergency, `agentRiskManager.js:502, :531-532`); pre-PR-b trades lack `swapProvenance`; pre-Tier-1 lack `swapMotive`.

### 2.4 Post-creation fields (current writers)

`regimeAtStart` (write-once tx, `REGIME_STAMP_ENABLED`), `controlEpochLog[]` (uncapped), `directive` (single slot; `chat.js`/`file-directive.js`), `dailyReviews[]` (uncapped; `agent-batch-review`), `reviewPending`, `pendingReflection`, `reflectedAt`, `completionReason` (`'expired'` GC / `'expired_repaired'` repair only — absent on normal completions), `completionContext`, `receiptCoverage`, `shadowGateAggregates[]`/`shadowTerminalGates[]` (cap 64), `masterySlot`/`masteryEligibility`/`masteryAwardPending`/`masteryAward` (DARK), `vision` (retirement write only), `feedBookmarks`, `reviewDecisions.{ruleId}`, `dailyGrades`.

### 2.5 Fields read by current code with no writer

`livePriceBeacon` (read `agentSwapExecution.js:181`; client writer removed 2026-07-16), `leanOverrides[]` (read by control renderer; writer "Phase-2 PR-a" not shipped), `agents.partnerProfile` (read by voice prompts). Presence on live docs UNKNOWN; all default safely.

---

## 3. `agents` — decision-relevant fields

| Field | Class | Writer |
|---|---|---|
| `archetype`, `config{risk,concentration,momentum}`, `personality`, `name` | CURRENT_ACTIVE | client create; `change-archetype.js` |
| `activeRules[]`, `equippedBundleIds[]`, `equippedTraits[]`, `activeRulesProjection` | CURRENT_ACTIVE | equip/reforge endpoints via `agentSettingsTx`; `decide.js` projection commit |
| `standingLeans[]`, `dials.tempo`, `settingsRev` | CURRENT_ACTIVE | `equip-lean`/`unequip-lean`, `set-tempo-dial`, `agentSettingsTx` |
| `deployedStrategy.guardrails[]`, `strategyLastDeployedAt` | CURRENT_ACTIVE | `update-agent-settings.js` |
| `equippedWatchlistId/Name/equippedAt` | CURRENT_ACTIVE | equip/unequip-watchlist |
| `lastDecision{portfolio,bench,innerMonologue,strategyBrief,shortlist,watchlist,createdAt,models}` | CURRENT_ACTIVE | `decide.js:667-676` (self-select) / `:1348` (prescribed) |
| `deployProgress{deployId,stage,fallbackKind,errorPhase,briefExcerpt,shortlistCount,scanCount,updatedAt}` | CURRENT_ACTIVE (telemetry; nothing reads `stage` back server-side) | `decide.js` fire-and-forget dot-paths |
| `activeBattleId`, `deployingAt`, `lastDeployedAt` | CURRENT_ACTIVE | `decide.js`; cleared in completion tx |
| `stats{wins,losses,draws?,gamesPlayed,totalScore,avgScore,currentStreak,bestStreak}` | CURRENT_ACTIVE | completion tx (server writes `draws`; client seed does not) |
| `memory[]` (rolling 5), `consolidatedInsight`, `evolutionCycle`, `pendingConsolidation`, `lastConsolidatedGamesPlayed` | CURRENT_ACTIVE | reflection/consolidation |
| `lessons[]`, `forgeSuggestions[]` | CURRENT_ACTIVE | batch review, chat |
| `directives[]` | LEGACY (client-writable; read side neutralized while `ARCHETYPE_INTEGRITY_MODE !== 'off'`) | client `agentService.js:229-262` |
| `isCasualClone`, `rankedAgentId`, `isTrainingClone` | CURRENT_ACTIVE | clone minting (server) |
| `lastConflictReport` | CURRENT_BUT_OPTIONAL | `decide.js` (when reconciler inject on) |
| birth provenance (`writeEpochId`, `writeFenceGeneration`, `identityVersionAtBirth`, `activationGenerationAtBirth`) | CURRENT_BUT_OPTIONAL (post-genesis only) | client create under rules helpers |

---

## 4. Schema drift evidence (multiple generations)

1. **Per-tick migration guard** (`agent-evaluate.js:616-635`) backfills 12 fields on pre-Sprint-2/3/4 docs; its `executionMode` default is `'copilot'` while creation writes `'autopilot'` → healed old docs differ from new docs.
2. **`completionReason`** exists only on GC/repair completions; the repair sweep discriminates on `pendingReflection === undefined ∧ completionReason === 'expired'` (`:4279-4280`) — an explicit acknowledgment that older/bare completions lack fields the cron path writes.
3. **`vision`** absent on pre-Spec-A docs (defensive read `:1216-1222`); never initialized on `agentBattles`, only retired.
4. **`'unknown'` archetype sentinel** on old docs (`captureReceipt.js:399-401`; still written by `agentBattleService.js:183` when absent).
5. **`resolvedAgentManifest`** present only since `MANIFEST_WRITE_ENABLED` flipped; shadow capture skips pre-manifest battles.
6. **Tick-stamp keys** on `evaluations[]` only since 2026-09-10; **`swapProvenance`/`swapMotive`/`snapshot`/`exitReason`** on `trades[]` arrived in successive arcs.
7. **`stats.draws`** written by the server only; client seed and `updateAgentStats` omit it; rules pin the create key set to 7.
8. **`battles._v` 1–4** coexist with version-filtered queries (old user battle system).
9. **Birth provenance** on `agents` is legal both absent (pre-genesis) and present (post-genesis) — two generations by design (`firestore.rules:38-62`).
10. **Completed battles skipped by the autopilot migration** (`migrate-existing-battles-to-autopilot.js:14-15`) — historical docs likely still carry `executionMode:'copilot'`.
11. **Version constants** stamped on newer records: receipts `schemaVersion:3`, envelope `ENVELOPE_SCHEMA_VERSION:1`, regime stamp shape version, `MANDATE_SCHEMA_VERSION:1`; none on `agentBattles`/`agents` themselves (no `_v`).

---

## 5. Rules and indexes summary (repo text; deployed text not verified)

- `agentBattles`: owner-only read; 10-key client update allowlist; no client create/delete (`firestore.rules:429-440`).
- `agents`: any-authenticated read (**no ownership check**); heavy create allowlist with epoch/birth-provenance helpers; 4-key client update allowlist; no delete (`:224-330`).
- `battles`: any-authenticated create/update (`:488-493`).
- Capture collections (`learningReceipts/**`, `shadowDiffs`, `battleSettlements`, `metricSnapshots`): server-only by explicit rule or by the terminal catch-all (`:1084`).
- `agentBattles` composite indexes (6): `(ownerId, agentId, createdAt↓)`, `(status, pendingReflection, completedAt)`, `(ownerId, status, completedAt↓)`, `(ownerId, agentContext.archetype, createdAt)`, `(status, completionReason, completedAt)`, `(agentId, resolvedAgentManifest.equippedConfigHash)` — these name the live query shapes (reflection queue, GC repair, history views, config-cohort lookup).
- Deployed-vs-repo rules parity: UNVERIFIED (see §0).

---

## 6. Uncertain fields (UNCLEAR)

`livePriceBeacon`, `leanOverrides`, `partnerProfile` (no writers); `completionContext` values beyond `'tournament_group_scored'`; `masterySlot/*` presence (dark flag but sweep runs); whether `composition/writeEpoch` exists (changes create-rule semantics); whether any live `agentBattles` doc carries `duration ≠ 'fullday'`, `_v`, or a `result` object (none written by current code); real sizes of uncapped arrays (`dailyReviews`, `controlEpochLog`, `thresholdHistory`).

---

*Read-only. Live datastore contents NOT OBSERVED. Field lists reflect code at the commit above; older documents may differ in shape as described in §4.*
