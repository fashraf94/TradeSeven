# FT_ENVIRONMENT_DISCOVERY_V0.1 — FantasyTrades as an operating environment (current build)

**Repository:** `fashraf94/TradeSeven` · **Commit:** `1c4a8d3bd326c61ee63f6c8fe7e57633e7e4da20` (HEAD == `origin/main`, merge of PR #845, 2026-09-12 20:24 CDT) · **Branch:** `claude/nice-thompson-2q1o4a` · **Clean tree:** yes · **`git fetch origin`:** run first (BUILD_RULES §3) · **Observed at:** 2026-09-14T03:57–04:30Z.

**Scope:** read-only, code-grounded discovery of what FantasyTrades permits, requires, computes, and persists for AI-agent decisions — for a future Archetype Harness adapter. No application code, Firestore, or configuration was changed. No archetype doctrine is imported or adjudicated. Nothing here is a product requirement.

**Live Firestore was NOT OBSERVED.** The container carries no `FIREBASE_*` env, no service-account file, no ADC, no `EODHD_API_KEY`. Every datastore statement is inferred from writer/reader code, `firestore.rules`, `firestore.indexes.json`, golden test snapshots, and dated prior audits (which are cited as historical observations, not current semantics).

**Citation convention:** `path:line` anchors were read at HEAD this session (VERIFIED) unless marked ASSUMED or `[lane]` (read by one of five read-only discovery lanes; the author re-read every load-bearing lane anchor cited in the founder summary and the fact register). Lines drift — re-verify before relying. Companion artifacts: `FT_ENVIRONMENT_FACT_REGISTER_V0.1.json` (109 facts with provenance/freshness), `FT_DECISION_PROVENANCE_AND_ADAPTER_GAP_MAP_V0.1.md`, `FT_FIRESTORE_SURFACE_AUDIT_V0.1.md`.

---

## 0. Founder summary

### Verdict table

| Question | Answer |
|---|---|
| Is current FantasyTrades data sufficient to reconstruct a **trustworthy sealed decision** after the fact? | **NO — not trustworthy; partially reconstructable.** The stated decision, its gates, the held-position evidence numbers, config versions, and a hash of a re-derived prompt are persisted (all capture flags are ON at HEAD). The exact prompt bytes, the raw model output, the candidate menu and prices the model chose from, the model id on the decision record itself, and — on guardrail-forced swaps — the model's original rationale are not. |
| FT adapter feasibility | **FEASIBLE_WITH_INSTRUMENTATION.** The environment contract (universe, cadence, clock, permissions, sizing, settlement, costs) is fully determinable from code today and mostly stable; the decision record needs six additive capture categories (§0.4) before a sealed envelope can be built without re-derivation. |
| Which engine is "the environment"? | **Three coexist.** Tiered agent battle (`baggerbomb_agent`), flat6 tournament agent battle (`baggerbomb_tournament`), and the mandate managed book. They differ in universe, sizing, cost model, clock, and persistence. An adapter must be engine-scoped; this document treats the agent battle (tiered + flat6, one shared intraday cron) as primary and the mandate book as a distinct environment. |

### 0.1 Ten most consequential CONFIRMED environment facts

1. **Battle = one trading day, no liquidation.** `AGENT_BATTLE_DURATION_MODE = 'fullday'` (`api/_utils/agentBattleService.js:35`); `expiresAt` = next market close (16:00 ET; 13:00 early close; 20:00 ET if the book holds crypto) (`:377-392`). At expiry positions are not closed; the final score is whatever the last market-open tick wrote (`api/cron/agent-evaluate.js:4266-4560`). The UI says "24 hours" (§12).
2. **Decision cadence is event-conditional, not fixed.** The cron scores every 15 minutes (`vercel.json` `*/15 13-21 * * 1-5`, gated by `isMarketOpen()`), but the model is called only when the trigger gate fires: first eval and final hour are forced; otherwise price drop (≤ −0.5 ATR), threshold proximity (0.2 ATR), bench outperformance, VWAP deviation ≥ 1.5%, BB squeeze ≤ 20th pct, NR7, or fresh news (`api/_utils/agentTriggerGate.js:20-184`).
3. **The only expressible action is one-for-one slot replacement.** Tool `submit_trade_decision` enum `HOLD | SWAP` with `symbolOut`/`symbolIn` (`api/_utils/agentEvalToolSchema.js:12-26`); no increase/reduce/reverse; no cash; no leverage; no dollar sizing. Exposure is a slot label × tier multiplier (2.0/1.5/1.0 tiered, 1.0 flat6) (`src/constants/baggerBombScoring.js:56-60`, `src/constants/agentGameModes.js:39-74`).
4. **Long-only on the agent path.** No deploy or swap path can write `direction:'short'` on an agent position; the scorer's short branch (`api/_utils/agentScoring.js:228`) is unreachable there. Shorts exist only in the League **user** layer via flip (`api/tournament/flip.js:157` [lane]).
5. **Execution is frictionless and immediate at a delayed quote.** `executeSwapServer` is one Firestore transaction; fill price = the EODHD `/real-time/` `close` fetched at tick start (`api/_utils/agentSwapExecution.js:180-188`, `api/_utils/marketDataCache.js:742-758`); no fees, slippage, spread, partial fills, or capacity limits. The "live beacon" preference is dead code (writer removed 2026-07-16; `src/screens/AgentBattleScreen.jsx:781-799`).
6. **Deterministic overrides sit between the model and the ledger.** In order: guardrail forced exits/blocks (stopLoss, trailingStop, profitTarget — the last LIVE via `PROFIT_TARGET_EXECUTOR_ENABLED=true`), LOCK near bonus thresholds, distressed-regime block, validation (conviction ≥ 70, cooldown, type match, hypothesis ≥ 10 chars), archetype hurdle floor, swap-window cap, tournament reserve (`agent-evaluate.js:2121-2345`). Risk-manager exits (bust −0.85 ATR, VWAP failure, trailing, stagnation) run **before** the model and need no model call (`:1372-1785`).
7. **Model seat at HEAD:** `claude-haiku-4-5-20251001`, max_tokens 2048, temperature 0.4, forced tool, 20 s SDK timeout, 22 s hard abort, `maxRetries: 0` (`api/_utils/agentEvalTransport.js:23,34`; `agent-evaluate.js:2021-2033`). Deploy uses `claude-sonnet-4-6` (strategy) + Haiku (portfolio) with one retry then an algorithmic fallback (`api/agent/decide.js:409,522,559,1147`).
8. **The universe is a Firestore doc, not a static list.** Deploy validation admits only symbols present in `indexIntelligence/stockRankings` (239-ticker code universe; 236 observed live on 2026-08-05), rewritten hourly during RTH; mid-battle candidates = bench (3+1) + `watchlist.hotBench` (top-15 by `baggerBombFit`, ∪ equipped, cap 20) + ≤5 news catalysts (`decide.js:1104-1145`; `agent-evaluate.js:1003-1070, 1880-1920`).
9. **Every capture flag is ON in production code at HEAD:** `TICK_STAMPS_ENABLED`, `REGIME_STAMP_ENABLED`, `LEARNING_L1_CAPTURE_ENABLED` (+EXPANSION), `SHADOW_ASSEMBLY_ENABLED`, `MANIFEST_WRITE_ENABLED` (`src/config/featureFlags.js:2238,1089,1050,1070,1348,1326`). Per decided tick the battle doc gets an `evaluations[]` entry with rationale, gates, held-position evidence and vintages; per executed swap a `trades[]` entry with full technical snapshots and provenance siblings, plus a create-only `learningReceipts` doc and a `shadowDiffs` doc with prompt hashes and the model id.
10. **Missing-quote policy is skip-the-tick.** If any held symbol lacks a finite, positive, non-fallback quote the whole battle tick is skipped and prior `scoreState` preserved (`api/_utils/agentQuoteHealth.js:23-53`; `agent-evaluate.js:732-741`).

### 0.2 Ten most consequential UNKNOWNS

1. **Live Firestore contents** — counts, field presence, and schema-generation mix of `agentBattles`/`agents` (last recorded live number: 22 battles as of 2026-05-22; 9 active on 2026-08-05).
2. **Actual quote delay** of the EODHD real-time endpoint on the subscribed plan — asserted "15-min delayed" only in comments (`agentSwapExecution.js:180`).
3. **Whether production runs the repo's `firestore.rules`** — last recorded deploy 2026-08-13 (`docs/composition/RULES_DEPLOY_RECORD.json`), repo rules changed 2026-09-02; no `.firebaserc` (DRIFT_LEDGER D-5/D-6).
4. **Whether `composition/writeEpoch` and `composition/activation` exist in production** — the epoch fence and birth-provenance rules flip on `exists()`; `commitBattleDocWithPin` uses `.add()` vs `tx.create()` accordingly.
5. **Whether the GCS shadow stream is actually persisting** (`GCS_CREDENTIALS` presence; fire-and-forget; BUILD_RULES §5 records a prior silent multi-week loss).
6. **Whether the crypto-during-RTH-only evaluation gate is intentional** — crypto positions expire at 20:00 ET but are only evaluated 09:30–16:00 ET (`agent-evaluate.js:293`).
7. **Whether any live doc carries `livePriceBeacon`, `leanOverrides`, or `partnerProfile`** — all read by current code, none written by it.
8. **Real model/prompt drift history** — `PROMPT_SPEC_VERSION` stayed 1 through the Ask 1/Ask 2/tick-stamp prompt changes; shadow-diff hashes exist but no prompt-text registry.
9. **The `ARCHETYPE_IDENTITY_VERSION=2` vs `docs/registry-snapshots/archetype-registry-identity-v3.json` relationship** (unresolved in this discovery).
10. **Whether `MANDATE_FOUNDER_UIDS` is populated in production** (whether any mandate books exist), and whether unscheduled engines (options/earnings tournaments, season endpoints) are triggered externally.

### 0.3 Ten highest-risk stale / evolving areas

1. **Feature-flag docstrings vs literals** — 17 agent-path flags document a dark default they no longer have; `flagPinGuard` cannot see string-enum modes (`ARCHETYPE_INTEGRITY_MODE`, `SECTOR_CAP_MODE`, …) [lane].
2. **Prompt content** — `agentEvalPromptAssembly.js` (1863 lines) changed 2026-09-02; three prose variants are flag-selected (`PROFIT_TARGET_EXECUTOR_ENABLED`, `EQUIPPED_RULE_PRECEDENCE_ENABLED`, `EVAL_IDENTITY_BLOCK_ENABLED`) without a version bump.
3. **`evaluations[]` entry shape** — grew keys on 2026-09-10 (tick stamps) and is capped at 150 with a whole-document subscription; more stamps will hit the 1 MiB ceiling.
4. **Repository churn** — 281 commits since 2026-08-14; `agent-evaluate.js` (4,655 lines) changed 9× since mid-July.
5. **Universe producer** — `compute-index-intelligence.js` (1,485 lines) is hourly, doc-size-warned at 60% of 1 MiB, and gained V2 axes / fundamentals mirror recently; `ARCHETYPE_VECTORS_V2_ENABLED=false` would change deploy ranking when flipped.
6. **Market calendar** — nine holiday-list copies; two omit Juneteenth 2026; one checks UTC not ET; client copies are 2026-only [lane].
7. **Three coexisting terminal-state writers** (cron completion, two bare GC writes, repair sweep) — `completionReason` semantics differ by path.
8. **Dormant modes kept live** — copilot/manual proposal paths and gameplan meetings (3 of 6 swap sites) unreachable under the 2026-05-19 launch guard but compiled and rules-writable (`firestore.rules:437`).
9. **Mandate engine** — its own crons, friction model, and schema (v1), rollover DARK; docstrings still say "DARK by construction".
10. **`stockRankings` freshness assumptions** — 75-minute `expiresAt` intraday; `hurdleAtr` "fresh" ATR and hotBench membership move hourly; no per-tick pin of which rankings vintage a decision saw except `vintages.rankingsAt` (tick stamps) and `rankingsComputedAtMs` (receipts).

### 0.4 Minimum missing instrumentation categories (if a sealed decision must be reconstructable)

1. **Exact prompt + raw response capture** (or at minimum a content hash of the *sent* strings and the verbatim tool-call JSON) on the decision record — today only a re-derived hash exists, on the shadow path.
2. **Decision-time observation snapshot**: the full price table and the candidate menu (bench + hotBench + catalyst adds + macro) as rendered, not a count.
3. **Proposed-vs-applied preserved verbatim**: never overwrite `haikuResult` on a guardrail-forced swap; stamp the model's proposal beside the applied action on the `evaluations[]` entry itself.
4. **Model/provider/prompt identity on the entry** (model id, `PROMPT_SPEC_VERSION`, identity-block version, flag posture at tick) — currently only inside the shadow envelope, and only for manifest battles.
5. **Deploy-time decision capture** (`decide.js`): strategy tool fields dropped today (`topConviction`, `risks`), validation error strings, the retry exchange, actual model ids (the persisted `models` field is a display label).
6. **Effective environment-constraint values per battle** (resolved hftConfig knobs, preset levers, guardrail thresholds, caps) — versions are stamped in the manifest, values are not.

### 0.5 Adapter feasibility

**FEASIBLE_WITH_INSTRUMENTATION.** See `FT_DECISION_PROVENANCE_AND_ADAPTER_GAP_MAP_V0.1.md` for the per-concept map (AVAILABLE_NOW / MAPPABLE / REQUIRES_NEW_INSTRUMENTATION / AMBIGUOUS).

---

## 1. Engines at HEAD (which "environment" is being described)

| Engine | Entry / cron (`vercel.json`) | Decider | Universe | Sizing | Costs | Persistence | Status |
|---|---|---|---|---|---|---|---|
| Tiered agent battle (`baggerbomb_agent`) | `POST /api/agent/decide` (client) → `createAgentBattle`; intraday `/api/cron/agent-evaluate` `*/15 13-21 * * 1-5` | Sonnet 4.6 + Haiku 4.5 (deploy); Haiku 4.5 (intraday) | `indexIntelligence/stockRankings` + 7 crypto | 7 slots (2/2/3, crypto mandatory), tier multipliers | none | `agentBattles` | ACTIVE |
| Flat6 tournament agent battle (`baggerbomb_tournament`) | orchestrator `*/10 11-14,21-23 * * 1-5` → internal `POST /api/agent/decide` with `prescribedPortfolio` | Sonnet board ranking + deterministic snake draft (Mon); Haiku intraday (same cron) | same doc, ledger-filtered for exclusivity | 6 slots, flat 1.0, no crypto, empty bench at start | none | `agentBattles` (+ `tournamentGroups/*`) | ACTIVE (`TOURNAMENT_DEPLOY_ENABLED=true`, `tournamentOrchestrator.js:100`) |
| Mandate managed book | `/api/cron/mandate-evaluate` `*/15 14-22 * * 1-5`; rollover `*/15 12,13` (DARK) | Haiku 4.5, temp 0.7, forced tool, verbs BUY/SELL/TRIM/ADD/HOLD | curated ~150 large/mid caps (`mandateCandidateUniverse.js`) [lane] | dollar-sized, $10M virtual, gates (cash 2%, 5–15 positions, 35% max weight) | cap-tier slippage+spread bps, $0 commission (`mandateConfig.js:180-186`) | `mandates/{id}/{decisions,dailyRows,…}` | ACTIVE (eval/close); rollover DARK |
| League user layer | claims/flips/banking crons | humans (CPU seats deterministic) | group pool | 3 picks, long, short via flip | none | `tournamentGroups` | ACTIVE |
| Season, options tournaments, earnings tournaments, old `battles`/`challenges` | no cron entries (season removed 2026-06-04) | — | — | — | — | various | LEGACY / unscheduled |

The rest of this document describes the **agent battle** environment (tiered + flat6) unless a section says otherwise.

---

## 2. Target A — Battle lifecycle

**Creation.** Exactly one writer of a battle doc: `createAgentBattle` (`api/_utils/agentBattleService.js:67-304`, fenced) committed by `commitBattleDocWithPin` (`api/_utils/compositionGenerationFence.js:151` `.add()` dark / `:153` `tx.create()` lit). Two production callers in `api/agent/decide.js`: the self-select deploy (`:912`) and the prescribed tournament deploy (`:1458`, `runPrescribedTournamentDeploy :1302`). Client deploys send only `{ agentId }` (`src/services/agentDeploy.js:111`).

**Preconditions.** `indexIntelligence/stockRankings` must exist (503 otherwise); every held symbol on both sides needs a Guard-1-validated, non-fallback activation price or the deploy is refused with `pricing_unavailable` and no battle (`decide.js:842-856`); deploy lock `deployingAt` < 120 s and per-agent cooldown 120 s; one active battle per `agentId` (an expired one is GC-completed by a bare 3-field write, `:764-768`, `:1388-1392`).

**Start.** Immediate: `status:'active'`, `activatedAt = createdAt = now` (ISO strings). No market-hours gate on creation; creation outside RTH targets the next trading day's close.

**Duration / clock.** `'fullday'` only; `expiresAt` = `getNextMarketClose({cryptoExtended})` converted ET→UTC with a DST-safe offset (`agentBattleService.js:377-392`; `marketSchedule.js:258-291`). Legacy `1d/3d/5d` helpers (`:311-357`) are unreachable. `timing = {tradingDays:[ETdate], currentTradingDay:1, timezone:'America/New_York', localOpen:'09:30', localClose:'16:00'|'13:00'|'20:00'}`.

**Recurring evaluation (per cron tick, per active battle).** Sequence in `processAgentBattle` (`agent-evaluate.js:547-3000`): acquire `cronState.evaluatingAt` lock (120 s TTL, `:557-595`) → migration-guard backfill (`:616-635`) → tournament context/candidate filter → fetch prices for held+bench+hotBench+CPU+macro (`:703-717`) → M1 quote guard (`:732-741`) → score held and CPU assets (`calculateAssetScoreServer`) → CPU passive early return (`:917`) → parallel fetch of 5m intraday, `stockRankings`, `stockTechnicalScores`, `marketContext`/`SPY` (`:944-955`) → hotBench rebuild on new day or fresher rankings (`:1003-1070`) → regime stamp (write-once, `:1167`) → posture/regime classification → knob resolution (`:1290`) → control-epoch telemetry (`:1313`) → risk loop with deterministic exits (`:1372-1785`) → proposal / gameplan lifecycle (dormant) + R11 deterministic pass → news fetch + catalyst adds (`:1876-1920`) → trigger gate (`:1926`) → [if triggered] prompt build + Haiku call (`:2014-2060`) → guardrails/validation/hurdle/cap (`:2121-2250`) → execute swap (`:2335`) → L1 receipt → evaluation record + tick stamps (`:2654-2760`) → shadow capture (`:2871`) → single `finalUpdate` (`:2893`) → voice narration/anticipation dispatch (finally block).

**Agent action opportunities.** At most one model SWAP per triggered tick, plus any number of deterministic risk/guardrail exits in the same tick (each one slot). Proposal (copilot/manual) and gameplan-meeting paths are compiled but unreachable (launch guard `:2195-2201`, `:3033`).

**Ending.** `expiresAt < now` detected by the expiry loop on every tick regardless of market hours (`:220-260`) or by `decide.js` GC. `completeBattle` (`:4266-4560`) is a guarded transaction writing `status:'completed'`, `completedAt`, `pendingReflection`, `reviewPending`, a `battle_complete` feed entry, `completionContext` (tournament), optional `receiptCoverage:'pending'`, `vision` retirement, and (tiered) agent W/L/draw/streak stats; then mastery award (dark), settlement record (shadow), pattern logging.

**Forced settlement / valuation.** None in the liquidation sense: positions stay open; `scoreState.currentScore` as last written is final (`activeScore + bankedScore + bankedBadgePoints`). No price is fetched at completion.

**Tie handling.** `currentScore === opponentScore` → `'draw'` (streak reset) for tiered; tournament battles carry no W/L (`resolveCompletionDisposition :4197-4230`).

**Pause/cancel/error states.** None on `agentBattles` (`active` → `completed` only). Errors are recorded in `cronState.cronErrors[]` (cap 20) and `evaluation.haikuError`; the lock is released on error. Group-level `expired`/`voided` exist on `tournamentGroups` (`src/constants/leagueTournament.js:84-116`).

**Platform-forced actions.** Risk exits (`bust_avoidance` at preset `bustBuffer` −0.85 ATR for balanced; `vwap_failure` after N ticks below VWAP beyond the dead band; `stepped_trail` above +1.5 ATR under 5m SMA20; `stagnation` forced rotation per archetype knob), guardrail exits/blocks, LOCK deference, hurdle-floor and swap-window downgrades, distressed-regime block, reserve failures, daily banking reset (`agent-daily-scores.js`, 01:45 UTC).

**Acting near settlement.** `FINAL_HOUR` (≤ 60 min to close on the last day) forces a model evaluation; no cutoff before expiry; the last actionable tick is the last market-open tick before `expiresAt`.

**Persisted timestamps.** See fact FT-A-017 in the register.

## 3. Target B — Instrument and position model

- **Asset classes:** US equities from `rankingConfig.STOCK_UNIVERSE` (239 tickers, 11 sector groups) as materialized in `indexIntelligence/stockRankings`; 7 crypto symbols (`api/_utils/agentCryptoAssets.js`) in tiered mode only. No ETFs on the agent path (SPY/QQQ/BTC are macro benchmarks only). Flat6 rejects crypto (`decide.js:1245-1266`).
- **Universe filtering at deploy:** archetype-weighted ranking (`api/_utils/archetypeScoring.js:108-143`) → Sonnet shortlist 20–40 (padded ≥15/35) → Haiku picks 2/2/2+crypto + bench 3+crypto from the shortlist; equipped watchlist tickers survive even off-universe (`foldEquippedTickers`).
- **Mid-battle universe:** bench + hotBench + catalysts (§2); validation requires `symbolIn` in bench or `watchlist.hotBench` (`agentSwapExecution.js:43-48`).
- **Long/short:** long only (facts FT-B-005, FT-J-002). Inverse instruments: none.
- **Cash / sizing / leverage:** none; fixed slots; score = `%change × 10 × tierMultiplier` + flat badge points; fractional exposure does not exist; positions can only be replaced.
- **Limits:** 7/6 slots; crypto only in `support[2]`; type-matched swaps; no duplicates; no self-swap; 24 h bench cooldown; conviction ≥ 70; sector constraints only via user `maxSectorWeight` guardrail (slot-count share) and the Diversifier flat6 cap under `SECTOR_CAP_MODE='observe'` (measured, not enforced).
- **Archetype physics:** `ARCHETYPE_CONFIGS[*].hftConfig` (forced rotation, hurdle floor 0.2–0.5 ATR margin + bench-positive, swap-window cap 2–12/60–120 min), `KNOB_CONFIG_VERSION=2`; tempo dial 0.7/1.0/1.3 fail-closed to standard on version mismatch.
- **CPU opponent (tiered):** random-per-sector portfolio scored passively at frozen `startingPrices` (`api/_utils/cpuOpponentGenerator.js`). A prelaunch audit found CPU inaction a dominant strategy in League cohorts (`docs/audits/20260807_PRELAUNCH_FINDING_CPU_INACTION.md`) [lane].

## 4. Target C — Market data and agent observation

**Backend possesses:** EODHD `/real-time/` quote (close, previousClose, change_p, high, low, volume, timestamp), 90-calendar-day adjusted daily bars with raw close, 5-minute intraday candles (default window, sanitized), hourly `stockRankings`/`stockTechnicalScores` (RSI, MACD, BB, ATR, RS percentiles, levels, pivots, NR7, volume profile, fundamentals mirror), `marketContext` regime, FantasyTimes stories, 13F holders, fundamentals.

**Agent receives (per triggered tick):** the rendered blocks listed in fact FT-D-003 — derived numbers only, no series. Held rows carry $Entry/$Current/Gain%/ATR-mult/badges/ATR% (+LockNow/NextBonus/Levels); bench rows carry $Current/Daily%/ATR%/status plus a per-name technical block; intraday snapshot (VWAP dev, BB pct, NR7, range); regime words; risk status; macro %; ≤3 stories; last 3 evaluations (truncated). Time remaining and phase are rendered from `timing`.

**Cadence / delay / sessions:** 15-minute refresh during RTH only; quote delay asserted by comments only; no pre/after-hours quotes; no server websocket (`api/ws-config.js:40`); holidays 2026–2027 only; early closes 13:00; crypto priced 24/7 but evaluated only during equity RTH.

**Missing / stale:** skip-the-tick on any unusable held quote; stale intraday session disarms VWAP floor and trailing stop; `fallback:true` prices rejected for settlement; deploy refused on incomplete baselines.

**Adjustment:** daily `close` is split/dividend-adjusted (`adjusted_close`), `rawClose` kept for baseline checks; intraday is unadjusted (per `docs/discovery/SESSION1_DATA_DISCOVERY_REPORT.md`).

## 5. Target D — Decision pipeline (one lifecycle)

Trigger → inputs → prompt → model → parse → gates → apply → persist, with the meaning-transforming boundaries enumerated in fact FT-D-008. Two points deserve emphasis for a harness:

1. **The model's declared reason is a first-class persisted field** (`rationale`, `hypothesis`, `trade_reasoning`, `swap_type`→`swapMotive`, cited rules) — but it is copied selectively, and on a guardrail-forced SWAP the model's text is replaced by a synthetic string (`agent-evaluate.js:2142-2151`).
2. **"Applied action" ≠ "proposed action" on 7 downgrade sites** (`:2155, :2170, :2178, :2189, :2243, :2249, :2491`); the entry records `downgraded:true` and error strings, and nulls the symbols; the proposal survives only on the shadow path (`shadowTerminalGates[].proposedAction`).

## 6. Target E — Execution model

No orders; one transactional slot rewrite per swap at the tick-start quote; zero costs; immediate full fill; deterministic given the prices object; failures downgrade to HOLD without retry. **There is no realistic execution model on the agent path** — stated in-code as deliberate (`AgentBattleScreen.jsx:781-799`). The mandate engine is the only place with a cost model (idealized cap-tier bps, `$0` commission, labeled "never realistic at $10M scale").

## 7. Target F — Persistence

See `FT_FIRESTORE_SURFACE_AUDIT_V0.1.md`. Headline: `agentBattles` (spine, single creator, ~25 writer sites), `agents` (client-created, server-mutated, 4-key client update allowlist, world-readable to authenticated users), `learningReceipts` (per swap, create-only, server-only), `agentBattles/{id}/shadowDiffs` + `battleSettlements` (manifest-anchored), `indexIntelligence/*` + `stockTechnicalScores` (hourly, server-written), GCS `shadow/*` streams (fire-and-forget). Live contents NOT OBSERVED.

## 8. Constraints inventory (environment contract terms → where enforced)

| Contract term | Current value | Enforced at |
|---|---|---|
| Instrument universe | `stockRankings.stocks[]` (239 code / 236 observed 2026-08-05) + 7 crypto (tiered) | `decide.js:1104-1145`; `agentSwapExecution.js:43-48` |
| Observation cadence | 15 min during RTH (Mon–Fri, holidays excluded) | `vercel.json`; `marketSchedule.js:158-175` |
| History availability to agent | none raw; derived hourly technicals + tick VWAP/SMA20 | `agentEvalPromptAssembly.js` |
| Signal/lookback | 90-day daily (server), 378-day daily (rankings), 5m intraday session | `marketDataCache.js:257,354,799`; `compute-index-intelligence.js:132-134` [lane] |
| Operating window | deploy → next market close | `agentBattleService.js:35,377-392` |
| Remaining operating time | rendered as `Xh Ym` + phase EARLY/MID/LATE/FINAL_HOUR | `agentEvalPromptAssembly.js:1293-1368` |
| Forced settlement | none (score frozen at last tick) | `completeBattle` |
| Negative expression | not permitted (agent path) | schema/validators |
| Exposure bounds | slot-based; tier multipliers; no cash | `agentGameModes.js`; scorer |
| Execution model | immediate at delayed quote | `agentSwapExecution.js:117-371` |
| Cost model | zero | — |
| Liquidity/capacity | none | — |
| Platform stops/halts | risk manager + guardrails + LOCK + M1 quote skip | `agentRiskManager.js`; `agentGuardrails.js`; `agentQuoteHealth.js` |
| Nonprice operational rules | directive (enforce mode), leans, Forge rules, guardrails, equipped watchlist, vision, preset | `controlPromptRenderer.js`; `agentContext` |
| Market hours/session | ET RTH, early-close aware; crypto not extended for evaluation | `marketSchedule.js` |
| Platform-forced actions | see §2 | `agent-evaluate.js` |
| Environment-specific | tournament exclusivity ledger, casual-clone attribution, CPU passivity | `tournamentAgentLedger.js`; `casualClone.js`; `agent-evaluate.js:917` |

## 9. Contradictions (do not reconcile silently)

| # | Sources in tension | Verdict |
|---|---|---|
| C-1 | UI "24 hours" (`GameModeCarousels.jsx:65`, `battleTimer.js:13-19`) vs server fullday close | CONTRADICTED — server wins; UI copy is not derived from `expiresAt` |
| C-2 | `agentSwapExecution.js:180` "prefer live beacon" vs `AgentBattleScreen.jsx:781-799` "beacon intentionally never written" | dead branch; REST quote always used |
| C-3 | `tournamentAgentLedger.js:5` "five call sites" vs six `executeSwapServer` sites | comment stale |
| C-4 | 17 flag docstrings ("dark/false default") vs live literals | docstrings stale; guard blind to string enums [lane] |
| C-5 | `agent-evaluate.js:11`, `agentBattleService.js:24-26`, `:3483`, `mandate-evaluate.js:4-8` "DARK" headers vs flags true / crons registered | headers stale |
| C-6 | `agentScoring.js:14-19` "byte-identical" vs `baggerBombUtils.js:557` console.log | claim overstated; math equivalent [lane] |
| C-7 | `lastDecision.models = {strategy:'sonnet-4', portfolio:'haiku-4.5'}` (`decide.js:675`) vs actual ids `claude-sonnet-4-6` / `claude-haiku-4-5-20251001` | display label persisted as if provenance |
| C-8 | `scripts/preflight-capture-check.js:19-22` "capture on only in preview" vs `LEARNING_L1_CAPTURE_ENABLED=true` literal | script header stale |
| C-9 | `firebaseArchitecture.md` (Nov 2025) vs live schema | documentation stale (no agent stack; no `_v` on agentBattles) |
| C-10 | migration guard `executionMode→'copilot'` (`agent-evaluate.js:619`) vs creation default `'autopilot'` (`agentBattleService.js:255`) | defaults disagree by generation |
| C-11 | `docs/registry-snapshots/archetype-registry-identity-v3.json` vs `ARCHETYPE_IDENTITY_VERSION=2` | unresolved |
| C-12 | holiday lists (9 copies; Juneteenth missing in 2; UTC vs ET) | divergent copies [lane] |
| C-13 | `stockRankings` 239 (code) vs 236 (observed 2026-08-05) | doc holds scored symbols only |
| C-14 | `ENFORCEMENT_WIRING_FINDINGS.md:65` season cron schedule vs `vercel.json` (no season entries) | doc stale [lane] |

## 10. Unknowns (full list)

Beyond §0.2: whether `agent-daily-scores` ever meaningfully runs for fullday battles that expired before 20:45 ET (it queries `status=='active'`); real cap-overflow behavior of uncapped arrays (`dailyReviews`, `controlEpochLog`, `thresholdHistory` keys); the quota headroom of the EODHD plan under 15-minute uncached fan-out; whether the R11 pass has fired in production since the profit-target flip; how often `budget_skipped` ticks occur (fair-rotation starvation is documented as mitigated, not fixed, `agent-evaluate.js:319-334`).

## 11. Change-detection design (Target I) — what to check automatically on each release/deploy

Not product redesign; a list of environment facts whose silent change would invalidate a contract, with the source to hash/assert:

1. `vercel.json` cron entries for `agent-evaluate`, `agent-daily-scores`, `compute-index-intelligence`, `tournament-orchestrator`, `mandate-*` (schedule strings).
2. `AGENT_BATTLE_DURATION_MODE`, `CRYPTO_EXTENDED_CLOSE_HOUR`, `computeFullDayExpiry` behavior (a `buildArenaModel.test.js` tripwire already pins the literal).
3. `MODE_CONFIGS` (composition, `flatMultiplier`, bench sizes) and `CONVICTION_MULTIPLIERS` / `THRESHOLD_POINTS` / `THRESHOLD_MULTIPLIERS`.
4. `EVAL_MODEL_ID`, `EVAL_MAX_OUTPUT_TOKENS`, the literal `temperature: 0.4`, `HAIKU_CALL_CEILING_MS`, `maxRetries`, and the deploy model ids in `decide.js`.
5. A content hash of `TRADE_DECISION_TOOL`, `STRATEGY_TOOL`, `PORTFOLIO_TOOL`.
6. Content hashes of `buildEvalSystemPrompt` (both variants × six archetypes × flag postures) — the `__p4_snapshots__`/`__dr13_snapshots__` goldens exist; bump `PROMPT_SPEC_VERSION` on any change.
7. The agent-path flag posture as a tuple, including string enums: `ARCHETYPE_INTEGRITY_MODE`, `SECTOR_CAP_MODE`, `RULE_COMPAT_MODE`, `VOICE_GROUNDING_MODE`, `PROFIT_TARGET_EXECUTOR_ENABLED`, `EQUIPPED_RULE_PRECEDENCE_ENABLED`, `EVAL_IDENTITY_BLOCK_ENABLED`, `FUNDAMENTAL_MIRROR_ENABLED`, `TICK_STAMPS_ENABLED`, `REGIME_STAMP_ENABLED`, `LEARNING_L1_CAPTURE_*`, `SHADOW_ASSEMBLY_ENABLED`, `MANIFEST_WRITE_ENABLED`, `TEMPO_DIAL_ENABLED`, `STANDING_LEANS_ENABLED`, `CASUAL_CLONE_CONCURRENCY_ENABLED`, `ARCHETYPE_VECTORS_V2_ENABLED`, `COMPILER_ENABLED`, `MASTERY_XP_ENABLED` (`masteryConfig.js`).
8. `ARCHETYPE_CONFIGS` + `KNOB_CONFIG_VERSION`, `PRESET_CONFIGS`, `TEMPO_DIAL_BANDS`, `EMERGENCY_BYPASS_REASONS`/`USER_DIRECTIVE_BYPASS_REASONS`, `BONUS_THRESHOLDS`/`LOCK_PROXIMITY`, the conviction floor (70), cooldown (24 h), caps (50/150/100), `DIVERSIFIER_SECTOR_CAP_PCT`.
9. `validateTradeDecision` and `applyGuardrails` rule sets (source hash), `EVALUATING_LOCK_TIMEOUT_MS`, `TIME_BUDGET_MS`.
10. `ALL_TICKERS` count/hash, `CRYPTO_ASSETS`, `MAINTAINED_HOLIDAY_YEARS` and the holiday arrays (all copies), `DAILY_WINDOW_CALENDAR_DAYS`, `/real-time/` and `/intraday/` URL shapes, `fetchRealTimePrice` field mapping.
11. `firestore.rules` `agentBattles`/`agents` allowlists and the deployed-rules record; `firestore.indexes.json` agentBattles entries.
12. Persisted-shape goldens: `createAgentBattle` doc, `evaluations[]` entry keys, `trades[]` entry keys, receipt `schemaVersion`, envelope `ENVELOPE_SCHEMA_VERSION`, `regimeStamp` shape version.
13. `archetypeVersionConstants.js` (all), `evalIdentityBlocks.js` versions, and `docs/registry-snapshots/*` identity hashes.

Most of these already have a test or golden; the gap is a single **environment-contract manifest** that hashes the set and is diffed per deploy (with the deploy SHA already available as `VERCEL_GIT_COMMIT_SHA` in the shadow envelope).

## 12. Dead / divergent paths (Target J) — reported, not collapsed

See register facts FT-J-001…010 and the lane findings summarized in §9. Additional items: `flattenPortfolioServer` stamps an unread `allocation` weight (20/15/10; flat6 sums to 90) [lane]; `MODE_CONFIGS.portfolioSize/composition/benchStocks` are never read by validators (numbers duplicated literally in `decide.js`) [lane]; `scoring.tierMultipliers/pointValues` on battle docs are written-never-read (documented as deliberate); `agents.directives[]` is client-writable legacy whose read side is neutralized only by `ARCHETYPE_INTEGRITY_MODE !== 'off'` [lane]; the `duration` request field is dead input; `TEST_MODE` is a hard-coded literal in the production bundle [lane]; five tournament/learning collections have rules blocks but no code references, and `ingestedClaims` has five indexes with no code [lane].

---

*Discovery stops here. No recommendations beyond change-detection design; no implementation; no product UX.*
