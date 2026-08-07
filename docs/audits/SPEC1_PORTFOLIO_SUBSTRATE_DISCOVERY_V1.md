# Spec 1 — Portfolio Substrate: Phase 0 Discovery Report V1

**Date:** August 6, 2026
**Task type:** Phase 0 read-only discovery. No code, no edits, no branches beyond the discovery branch.
**Authoritative constraint reference:** `docs/QUARTERLY_PORTFOLIO_RESTRUCTURE_CHARTER_V1_1.md` (read first; binding for all design decisions — decisions D-1…D-41, instrumentation I-1…I-7, open questions O-1…O-8).
**Scope:** Charter §10, Spec 1 row only. Specs 2–4 explicitly out of scope.
**Deliverable:** this file, committed as its own commit, then hard STOP for founder review.

---

## Provenance & Method (BUILD_RULES §3)

| Item | Value |
|---|---|
| Branch | `claude/portfolio-substrate-discovery-jzcakl` |
| HEAD SHA at audit | `0b400974e7f4124d109c739ab32b577a830dd9a5` |
| Working tree | clean (`git status --porcelain` empty) at audit start |
| `git fetch origin` | run as first step (BUILD_RULES §3 stale-ref rule); remote-tracking refs current; new branches/tags fetched, no bearing on this audit |
| Git history reads | permitted for investigation per §3; used `git show`/`git log` on cited commits |
| Method | 14-agent adversarial discovery workshop (7 area readers A–G + 7 independent verifiers instructed to **refute** each area's load-bearing claims), plus lead-verified spot-checks of every headline anchor. Verifier tally: **37 CONFIRMED / 15 PARTIAL / 5 REFUTED** — all corrections folded below. |
| Marker convention | **VERIFIED** = code read at that line this session (by lead or confirmed by an adversarial verifier). **ASSUMED** = reasoned from partial evidence, flagged. **NOT_FOUND** = absence confirmed after ≥2 search strategies. |
| Doctrine | Live repo is authoritative over docs/comments/memory. Cron registration verified against `vercel.json` only. "A header comment is not evidence a handler runs." |

**Read-only compliance:** no application code was written, modified, or refactored; no feature branch created; no PR opened. The sole artifact is this report. A byte-exact copy is also written outside the repo tree per BUILD_RULES §3 and offered for download.

---

## 0. Executive Verdict Table (for the founder)

The portfolio substrate is **more reusable than a from-scratch build, but the reusable pieces are scattered across three places the charter didn't name** — the mid-battle eval cron, the Wire's model wrapper, and (the surprise) the *scrapped season mode*, which already contains a live persistent per-user portfolio schema and a complete risk-adjusted scoring engine.

| Question | One-line verdict | Where |
|---|---|---|
| Is the trading loop an extension of the existing eval path? | **Yes** — extend `agent-evaluate.js` (which is **not** fenced), calling fenced modules read-only. | §A |
| Does a persistent per-user portfolio already exist? | **Yes, half-alive and dangerous** — `seasonEntries.portfolio` (cash + positions book) is written by a **live** endpoint whose populating cron is **dead**. | §C, §G |
| Does honest risk-adjusted P&L exist (D-15)? | **The engine exists** (Sharpe/drawdown/composite/dollar-P&L) — in scrapped season code. **Frictions do not exist anywhere.** | §E |
| Is there a model-agnostic single-constructor seam (D-23)? | **Precedent exists** (`wireModelCall`) but is Wire-scoped; the agent path builds clients inline. Portfolio needs its own. | §A, §F |
| Batch API + prompt caching (D-20)? | **Batch API: live on one seam** (reusable). **Prompt caching: nonexistent** (build-new). | §F |
| Is the archetype substrate shareable (D-8) and customization-free (D-4)? | **Yes** — a composed registry exists (dark), and customization is already a separate merge layer. | §D |
| Cron headroom + per-user anniversary scheduling (D-37)? | **2 slots left**; a fan-out dispatcher is already live (reuse it); **per-user anniversary triggering does not exist** (build-new). | §B |
| Regime tagging on performance records (I-7)? | **Not present** on daily-score records; regime lives centrally + on battle-pattern docs. New write-side work. | §C |
| Per-user cost telemetry (I-6)? | **Nonexistent** — no dollar/run-rate math anywhere; token counts captured per-battle only. | §F |
| Fence exposure for Spec 1 | **Call-only reuse is clean and needs no sign-off.** Only *shape/behavior changes* to fenced modules require the §7 / §1.4-P4 founder gate. | §4 |

---

## 1. Summary — the ten findings that most change how Spec 1 is written

1. **The path to extend is `api/cron/agent-evaluate.js`, not the fenced `decide.js`.** `agent-evaluate.js` is the per-tick decision loop (model call at `agent-evaluate.js:1956`) and is **not** on the calibration fence (BUILD_RULES §1 list omits it; §7 line 83 explicitly calls it non-fenced). `decide.js` is the battle **create/deploy** path (`createAgentBattle`, strategy+portfolio construction). Spec 1 can build a non-fenced portfolio handler that *calls* fenced modules read-only. `[VERIFIED]`

2. **The biggest surprise and the biggest landmine are the same thing: season mode is only half-dead.** `seasonEntries` docs embed exactly the persistent per-user portfolio shape Spec 1 wants — `{cash, positions{ticker:{shares,entryPrice,currentPrice}}, totalValue, highWaterMark, drawdownFromPeak, sectorWeights}` (`api/season/create-entry.js:270`) — and the **write path + React UI are LIVE** (`SeasonEntryModal.jsx:758` POSTs to `/api/season/create-entry`, mounted in `App.jsx`), but the **populating cron is de-registered**. Live users can mint frozen orphaned portfolio docs today. Spec 1 must make a reuse-vs-collision decision here, not build in a vacuum. `[VERIFIED]`

3. **The honest risk-adjusted scoring engine already exists — inside that scrapped season code.** `seasonLeaderboard.js` computes Sharpe (`:248`), max-drawdown (`:262`), consistency, recovery factor, and a weighted composite (`seasonConfig.js:35`: sharpe .30 / drawdown .25 / consistency .25 / winRate .20); `seasonSettlement.js:265` marks a positions+cash book to market with high-water-mark and drawdown-from-peak. This is the prime D-15/D-16 reuse target. **But its P&L is gross — no friction/slippage/commission math exists anywhere in the repo** (`[VERIFIED]` grep-empty). The friction half of D-15 is greenfield.

4. **No single-constructor model seam exists on the agent path (D-23 unrealized).** Both agent handlers build Anthropic inline (`agent-evaluate.js:141` maxRetries:0; `decide.js:88` maxRetries:2). `wireModelCall.js` is the single-constructor precedent but scopes itself to the FantasyTimes Wire and *explicitly excludes* `decide.js` and every other importer (`wireModelCall.js:5-11`). Spec 1's model-agnostic seam is a new build modeled on that precedent. `[VERIFIED]`

5. **Batch API is proven-and-reusable; prompt caching does not exist (D-20 is one-of-two).** The Anthropic Batch API runs live on exactly one seam (Doug earnings previews via `wireModelCall.wireBatchSubmit`), a clean submit→poll template. Prompt caching (`cache_control`/`ephemeral`) is implemented on **zero** paths — the only "ephemeral" hits are the English word in comments. `[VERIFIED]`

6. **The shared archetype substrate (D-8) is already composed but dark; the customization-free split (D-4) is already architecturally available.** `archetypeRegistry.getArchetypeDefinition()` (`archetypeRegistry.js:87`) composes physics + scoring + identity + zones + display into one read surface with an identity hash — and has **zero production readers** for that function (Spec 1 would be the first). Customization (Forge rules, leans, watchlist, directives) is a *separate data layer merged only at prompt-assembly time*, never baked into the class definition — so a D-4 portfolio simply omits the merge. `[VERIFIED]`

7. **Prerequisite A's fan-out pattern is already built and live; per-user anniversary scheduling (D-37) is not.** A single-cron ET-aware duty-table dispatcher (`tournamentOrchestrator.js`, 1065 lines, one slot at `vercel.json:162`) already fans out over eligible groups with per-date idempotency and deploy pacing — reuse it. But **nothing** in the repo does per-user time-based triggering; `dutyMarkerKey` is keyed on the *shared* ET date, the opposite of D-37's "no calendar alignment." The closest analog is the per-entity `expiresAt` scan (`agent-evaluate.js:211`). `[VERIFIED]`

8. **Cron headroom is exactly 2 slots.** `vercel.json` holds **37** cron entries (jq-confirmed), matching BUILD_RULES §6's "37/40." Spec 1's portfolio-eval, rollover, and proactive-trigger work must fit in 2 new slots or branch inside existing handlers (the house pattern the orchestrator demonstrates). `[VERIFIED]`

9. **The D-9 vintage stamp has live scaffolding, and I-7 regime tagging does not.** A per-battle version stamp `resolvedAgentManifest.versionStamps` (identity/knob/calibration versions at lock) is **live** (`MANIFEST_WRITE_ENABLED=true`), but it is per-battle, numeric (not a "Contrarian v1.4" display vintage), and lives in the fenced `createAgentBattle` doc. Regime is written centrally (`indexIntelligence`) and onto `battlePatterns` docs, but is **not** attached to any daily-performance record — so I-7's per-portfolio daily regime tag is new write-side work. `[VERIFIED]`

10. **"Portfolio" is heavily overloaded (≥5 live meanings) and per-user cost telemetry is nonexistent.** A new `portfolio`/`portfolios` collection collides with the fenced agent tier-portfolio shape, the season cash-book, the BaggerBomb builder, and earnings/options arenas — Spec 1 needs a qualified name. Separately, there is **no** cost/dollar telemetry or per-user run-rate anywhere (I-6 greenfield); token *counts* are captured per-battle only. `[VERIFIED]`

---

## 2. Findings by Area

### A. Existing agent evaluation pipeline

**A1 — Full per-tick battle decision path (each hop VERIFIED).** The loop Spec 1 extends is the **mid-battle eval cron**, not `decide.js`:

1. Cron entry — `/api/cron/agent-evaluate`, `*/15 13–21 * * 1-5` (`vercel.json:134`). `[VERIFIED]`
2. Handler — default export, cron-auth via `x-vercel-cron`/`CRON_SECRET`, `maxDuration:300` (`agent-evaluate.js:160`). `[VERIFIED]`
3. Discovery — `findActiveAgentBattles` (`agentBattleService.js`, **FENCED**, imported at `agent-evaluate.js:20`); expiry loop; per-battle loop → `processAgentBattle` (`:540`). `[VERIFIED]`
4. Setup — price fetch `getStockAnalysisData` (`:697`); scoring `calculateAssetScoreServer` (`agentScoring.js`, **FENCED**); CPU opponent (`:801`). `[VERIFIED]`
5. Trigger gate — `evaluateTriggers` (`agentTriggerGate.js:20`); HOLD short-circuits and writes scores without a model call. `[VERIFIED]`
6. Model client — `new Anthropic({ apiKey: process.env.CLAUDE_API_KEY, maxRetries: 0 })` inline (`agent-evaluate.js:141`). `[VERIFIED]`
7. Model call — single site `anthropic.messages.create` (`:1956`); `model: EVAL_MODEL_ID` = `claude-haiku-4-5-20251001` (`agentEvalTransport.js:23`); temp 0.4; system `buildEvalSystemPrompt` + messages `buildAgentIdentityBlock`/`buildLiveContextBlock` (`agentEvalPromptAssembly.js`, **FENCED**); forced `TRADE_DECISION_TOOL`. `[VERIFIED]`
8. Parse + guardrails — extract tool_use; `applyGuardrails` (`agentGuardrails.js`, **FENCED**, `:2065`); LOCKED/hurdle/cap downgrades. `[VERIFIED]`
9. Validation — `validateTradeDecision(decision, battle)` (`agentSwapExecution.js:28`, **FENCED**) at `:2130`. `[VERIFIED]`
10. Execution — `executeSwapServer(db, battleId, battle, resolvedTier, resolvedSlotIndex, benchAsset, currentDay, prices, evaluationMetadata, snapshot)` (`agentSwapExecution.js:117`, **FENCED**); five call sites (`agent-evaluate.js:1596,2257,2941,3152,3338`). `[VERIFIED]`
11. Persistence — Firestore `agentBattles/{id}` writes (score dot-paths; swap doc inside `executeSwapServer`; tournament ledger group doc). `[VERIFIED]`

**A2 — Fenced files this path touches.** The fence is **11 files** (BUILD_RULES §1:12-24, reconciled Jul 24 2026). The eval cron imports/calls **7** of them: `agentBattleService`, `agentScoring`, `agentEvalPromptAssembly`, `agentSwapExecution`, `agentGuardrails`, `agentRiskManager`, `agentArchetypeConfig` (`agent-evaluate.js:20-59`). The other 4 (`decide.js`, `agentPromptAssembly`, `archetypeScoring`, `tournamentUserScoring`) are **not** imported by the cron. **Critically, the cron handler `agent-evaluate.js` is itself NOT on the fence** (BUILD_RULES §1 omits it; §7:83 designates it non-fenced — the exclusivity ledger sits "in agent-evaluate.js — never inside fenced code"). `[VERIFIED]` (F-C5 REFUTED an earlier claim that the extension targets were "all inside the fence" — only `decide.js` is.)

**A3 — Battle-coupled vs portfolio-reusable (the single most important question).**

- **BATTLE-COUPLED:** the `agentBattles` query + `battle.expiresAt` expiry (`agent-evaluate.js:211`); the CPU opponent scoring (`:801`); the live-context prompt block rendering `Day X of Y | timeRemaining | Phase` (`agentEvalPromptAssembly.js:885-892`); the trigger gate's `forced_open` first-tick semantics reading `battle.evaluations` (`agentTriggerGate.js:28`); the fixed **HOLD/SWAP one-in-one-out** decision schema (`agentEvalToolSchema.js:14`); `executeSwapServer`'s tier/slot persistence into the battle doc (`agentSwapExecution.js:117`); the tournament reserve/confirm ledger. `[VERIFIED]`
- **PORTFOLIO-REUSABLE:** archetype identity render (`buildAgentIdentityBlock`/`buildEvalSystemPrompt`); market-data assembly (`getStockAnalysisData`/`fetchIntradayBatch`/`calculateVWAP`/`buildTechnicalSnapshot`, all non-fenced); asset scoring (`calculateAssetScoreServer`, FENCED); risk/guardrails (`applyGuardrails`/`evaluateRisk`/`clearsHurdleFloor`/`getArchetypeConfig`, FENCED); the forced-tool Haiku transport. `[VERIFIED]`

The coupling concentrates at five points: the loop scaffold, the live-context block, the decision schema, `executeSwapServer`, and the CPU opponent. Three of the reusable pieces are *inside* fenced files — reuse-by-call is clean, but any change to their **shape** (new decision verbs, a non-battle live-context, portfolio-doc persistence) is fence contact.

**A4 — Model client construction.** No shared constructor on the agent path. Both handlers build inline and diverge deliberately: `agent-evaluate.js:141` (maxRetries:0) and `decide.js:88` (maxRetries:2, three create sites `:387,:500,:537`). `wireModelCall.js:5-11` restricts itself to the Wire and states fenced `decide.js` and every other importer are out of scope. **D-23's single-constructor is unrealized on the decision path.** `[VERIFIED]`

---

### B. Cron and scheduling infrastructure

**B1 — Inventory.** `vercel.json` holds **exactly 37 cron entries** (`jq '.crons|length'` = 37; `vercel.json:20-168`), matching BUILD_RULES §6:73 ("37/40 … may add at most 2"). The "40" is an *assumed* Pro ceiling, unverified against Vercel. `[VERIFIED]` Of 21 non-test handlers in `api/cron/`, **19 are registered**; the 2 unregistered are `season-daily-evaluate.js` and `season-pit-stop-manage.js` (matches BUILD_RULES §6:77 — verifier corrected an earlier "§6:76" citation, which is the cron-auth line). `[VERIFIED]` Note: 37 slots ≠ 37 distinct endpoints — several are query-param/dual-schedule variants of one handler (`generate-pulse` ×3, `generate-econ` ×2, `compute-index-intelligence` ×2, `ingest-earnings` ×2). This is the sanctioned "branch inside an existing handler to add cadence without spending a slot" pattern.

**B2 — Prerequisite A dispatcher consolidation: the fan-out pattern is built and live.** `api/cron/tournament-orchestrator.js` is a transport-only shim (one slot, `vercel.json:162`, `*/10 11–14,21–23 * * 1-5`) driving `api/_utils/tournamentOrchestrator.js` (1065 lines) — an ET-aware duty-table dispatcher: `getDutyForInstant()` (`:121`) routes each tick to `MONDAY_PIPELINE`/`WEEKDAY_FANOUT`/`FRIDAY_ADVANCEMENT`/`SKIP`; `fanOutDeploys` iterates eligible groups; two-grain per-ET-date idempotency via `dutyMarkerKey`/`markDutyComplete` (`:137,:187`); budget `DUTY_DEADLINE_MS=270_000` + `DEPLOY_PACING_MS=20_000`. Training-pod sweeps piggyback on the same tick, each annotated "Zero new cron." `TOURNAMENT_DEPLOY_ENABLED = true` (`:99`, gate flipped) — though no tournament-stamped battle exists yet, so the deploy fan-out has no population today (see §C's dormant-ledger note). `[VERIFIED]` **Caveat:** this is a *tournament-domain* fan-out, not a general platform dispatcher; Spec 1 should extend/adopt the pattern, but a generic "dispatcher fans out to arbitrary handlers" consolidation is **not** present.

**B3 — Per-user recurring / anniversary scheduling: NOT FOUND.** Searches for `anniversary|nextRestructureAt|quarterEnd|dueDate|rebalanceDate|rollingQuarter` across `api/` + `src/` returned only unrelated stock-research string content (`stockIntelligenceData.js`). No portfolio/user doc carries a rollover-due timestamp. D-37 (rolling per-user quarters, `CHARTER:53`) is entirely unimplemented. `[NOT_FOUND]` All scheduling today is platform-wide + per-*entity*: the orchestrator keys idempotency on the *shared* ET date (`:137`) — the opposite of D-37. The closest reusable analog is the per-entity due-date poll: `agent-evaluate.js:211` scans all active battles for `expiresAt < now`, each battle carrying its own `computeExpiry` (`agentBattleService.js:108`). The DST guard technique (`process-draft-claims.js getClaimProcessingWindow`/`isAlreadyProcessedForDay`, `Intl` `America/New_York`) is reusable, but the grain must be re-keyed per-user-per-quarter. `[VERIFIED]`

---

### C. Firestore schema and persistence

**C1/C2 — Holdings substrate and the closest analogue.** There is **no persistent agent/user-*trading* portfolio-of-record collection.** The only trading-holdings substrate is the ephemeral per-battle `agentBattles` doc: `portfolio: { star[], core[], support[], bench, startingPrices{symbol→price} }` (`agentBattleService.js:137`), created from `agentData.lastDecision.portfolio` (decide must run first, `:94`), expiry-bound (`:101`), with **no cost-basis and no realized-P&L**. `[VERIFIED]` *(Correction, C-1 PARTIAL: two unrelated persistent collections do exist — `earningsPortfolios` (`firestore.rules:385`, earnings-prediction game) and `institutionalHoldings` (`firestore.rules:673`, 13F macro data) — neither is trading holdings-of-record.)*

The closest *persistent multi-day agent+user portfolio analogue* is the **League Tournament dual-market schema** (`src/constants/leagueTournament.js`, canonical zero-import module):
- **User layer** — `tournamentGroups/{groupId}` (`createTournamentGroupDoc:1359`): `players[]{odUserId, picks[], isCpu?}`; each pick `{symbol, legs[], flipCountToday}`; each leg `{direction(long/short), baselinePrice(nullable), baselineSource, openedAt, thresholdHistory[]}` (`createLeg:1086`). `[VERIFIED]`
- **Agent layer** — ordinary `agentBattles` docs discriminated by `gameMode='baggerbomb_tournament'` + `groupId`. `[VERIFIED]`
- **Exclusivity ledger** — sibling doc `tournamentGroups/{id}/ledger/agentHeldSet` (`{held, reservations, doubleDowns}`), two-phase reserve/confirm/release, nightly derived rebuild (`tournamentAgentLedger.js:76,591`). **Dormant in production** — no battle carries the tournament stamp yet (`:288`). `[VERIFIED]`
- **Banking** — `dailyScores.day{N}.closeScores[odUserId] = {totalPoints, picks, agentPoints, compositePoints}` (`tournamentBanking.js:311`); `totalPoints` is cumulative; the weekly score is the final-day snapshot, never a sum. `[VERIFIED]`

**Critical:** this substrate is week-scoped (5 trading days) and derived-rebuildable from battle docs — **not** a durable quarter-length position ledger. A rolling per-user quarter (D-37) has no existing home here. The nearest *durable cash+positions book* is the **season** schema — see §G.

**C3 — Archetype storage/versioning.** The agent doc stores `archetype` as a bare string with **no version field** (`agentService.js:98`; `change-archetype.js:243` writes only `archetype`+`equippedTraits`). `[VERIFIED]` Version numbers are module constants (`KNOB_CONFIG_VERSION=2` `agentArchetypeConfig.js:30`; `ARCHETYPE_IDENTITY_VERSION`, `CALIBRATION_BUNDLE_VERSION` `archetypeVersionConstants.js`). The **only persisted vintage** is `resolvedAgentManifest.versionStamps` (`resolvedAgentManifest.js:146`: `identityVersionAtLock`, `identityHashAtLock`, `knobConfigVersionAtLock`, `calibrationBundleVersionAtLock`, …), frozen **per-battle** at creation and spread into the battle doc — and it is **LIVE** (`MANIFEST_WRITE_ENABLED=true`, `featureFlags.js:1076`), contradicting a non-fenced "merge-dark DEFAULT" comment. `[VERIFIED]` A related versioned build subcollection `agents/{id}/compiledBuilds/{gameMode}` is scaffolded but **dark** (`COMPILER_ENABLED=false`, `featureFlags.js:1055`). To add a per-portfolio "Contrarian v1.4" vintage (D-9): the manifest is the natural primitive, but it is per-battle, numeric-not-display, and touching its shape means touching fenced `createAgentBattle`. A new durable per-portfolio field is required.

**C4 — Regime tagging (I-7).** Regime is **not** attached to any performance record. `[VERIFIED]` The canonical source the code reads is `indexIntelligence/marketContext` (`regimeStamp.js:50`; verifier corrected an earlier "dailyRegimeBrief-only" claim — DRB is explicitly *not* read in the tick). Regime **is** already persisted onto `battlePatterns` docs (`marketRegime`, `battlePatternLogger.js:25`), and a write-once `regimeAtStart` battle-doc stamp exists in code but is **dark** (`REGIME_STAMP_ENABLED=false`, `featureFlags.js:906`). The daily-score/banking writers stamp no regime (`agent-daily-scores.js:182` writes `{badgePoints, recorded, recordedAt, recordedBy}`; banking closeScores has none). So I-7's per-portfolio daily regime tag is **new write-side work** reading the central `marketContext`. `[VERIFIED]`

**C5 — Security rules (`firestore.rules`).**
- `agentBattles/{battleId}` (`:364`): read if `resource.data.ownerId==auth.uid`; update only execution-control keys via `hasOnly([...])`; **create/delete denied** (Admin SDK only). `[VERIFIED]`
- `agents/{agentId}` (`:160`): read if authed; create behind a strict field allowlist; update `hasOnly(['directives','lastViewedEvolutionCycle','starterKitCompleted','updatedAt'])`; delete denied. `[VERIFIED]`
- `tournamentGroups/{groupId}` + recursive `/{document=**}` (`:466`): read if authed, **write:false**. Same for brackets/leaderboards/ranks/lobby. `[VERIFIED]`
- Season collections have **active** rules: `seasons` (`:727`), `seasonEntries` (`:733`, owner-read + narrow client pit-stop write), `dailyLogs` (`:746`), `pitStops` (`:753`), `seasonLeaderboard` (`:768`). `[VERIFIED]`
- `battleSettlements` (top-level, written live by shadow capture) — no explicit rules block was located; likely falls to default-deny (client reads denied; server writes bypass rules). `[ASSUMED — rules tail past ~:930 not fully read]`

---

### D. Archetype substrate

**D1 — Where class definitions live.** No single canonical object; the class definition is split across four homes, two fenced:
- `agentArchetypeConfig.js:36` `ARCHETYPE_CONFIGS` (**FENCED**) — mechanical physics: `hftConfig`, `convictionMods`, `regimePreferences`, `sectorConcentrationCap`, `label`. Six code-ids: `momentum_chaser, analyst, diversifier, contrarian, degen, guardian`. `[VERIFIED]`
- `archetypeScoring.js:14` (**FENCED**) — `ARCHETYPE_WEIGHTS`/`TEMPERATURES`/`CONSTRAINTS` + `computeArchetypeRankings` (`:107`). `[VERIFIED]`
- `evalIdentityBlocks.js:77` (NOT fenced) — `EVAL_IDENTITY_BLOCKS`, the eval-time behavioral identity, **byte-locked by CI** to the six `CONSTITUTION_*_V1.md` docs (so the JS constant is the machine-read truth and the `.md` is the mirror). `[VERIFIED]`
- `src/data/archetypeAdjustments.js:48` (NOT fenced) — the four-zone identity (`immutableCore/tunableExecution/protectedBias/outOfScopeUserLever`) + per-archetype lean allowlist. `[VERIFIED]`

**The composed shared substrate already exists but is dark:** `archetypeRegistry.getArchetypeDefinition(codeId)` (`archetypeRegistry.js:87`) composes all of the above + `identityHash` + completeness validator. Its `getArchetypeDefinition` function has **zero production readers** (test-only; Spec 1 would be the first) — the natural D-8 home, unwired. `[VERIFIED]` *(Nuance, D-CRUX-1 PARTIAL: the registry module is not wholly dark — its `computeIdentityHash` export is invoked live at battle creation via `resolvedAgentManifest.js:153`, and `getTraitById` (`:78`) is live in composition-legality checks (`compositionEnforcement.js:161`, `change-archetype.js:157`). Only the composed `getArchetypeDefinition()` surface is unread.)*

**D2 — Game-shaped vs class-intrinsic consumption.** Physics is **mode-agnostic by construction**: `resolveHftConfig(archetypeConfig, gameMode)` (`agentArchetypeConfig.js:233`) returns the same archetype-locked `hftConfig` for every mode — the `hftConfigByMode[gameMode]` override hook exists but **no archetype uses it today** (zero deltas). What is *game-shaped* is the surrounding prompt (BaggerBomb tier rules, the `flat6` tournament variant `agentEvalPromptAssembly.js:295`, Survival-Mode override, coach directives), not the archetype personality. `[VERIFIED]`

**D3 — Class-intrinsic vs customization split (D-8/D-4).** Customization is a **separate data layer merged only at render time**, never baked into the definition:

| Customization | Data home | Merges into prompt at |
|---|---|---|
| Forge rules | `agent.activeRules` | `agentPromptAssembly.js:96`; `agentEvalPromptAssembly.js:552` |
| Standing leans | `agent.standingLeans` | `agentPromptAssembly.js:164`; `agentEvalPromptAssembly.js:985` |
| Watchlist | `agent.equippedWatchlistId` | `agentPromptAssembly.js:128` |
| Coach directive | `battle.directive` | `agentEvalPromptAssembly.js:985` (only under integrity 'enforce') |

The definition objects are keyed purely by code-id and carry no user field, so **a D-4 clean split is already available today**: a portfolio surface consumes the class layer and simply does not append the Forge/lean/watchlist/directive blocks. The customization compiler `compileBuild.js` is pure and ships **dark**. `[VERIFIED]`

**D4 — Identity-pushback (Prerequisite B / D-13).** Three mechanisms exist and are **LIVE**, all at battle-eval time:
1. In-prompt refusal clauses in `EVAL_IDENTITY_BLOCKS` (e.g. momentum_chaser "refuse in character, propose an in-style alternative"); `EVAL_IDENTITY_BLOCK_ENABLED=true` (`featureFlags.js:1238`). `[VERIFIED]`
2. Deterministic non-reversal gate — every lean carries `coreAlignment: 'reinforces'|'neutral'`, **never 'reverses'** (`archetypeAdjustments.js:30`); the allowlist forbids core reversal. `[VERIFIED]`
3. Directive integrity mode — `ARCHETYPE_INTEGRITY_MODE='enforce'` (`featureFlags.js:589`) gates whether a coach directive renders. `[VERIFIED]`

`masteryEnforcement.js` is **capacity gating** (slots/unlocks), **not** identity adherence — do not conflate. **There is no portfolio-surface pushback today**; all of the above is battle/eval-scoped. D-13 targets the SignalDrop/conversation vector, a Voice-Layer concern (D-40) Spec 1 inherits but does not implement. No runtime `ARCHETYPE_IDENTITY_CONTRACT` object exists — it is a doc only. `[NOT_FOUND]`

---

### E. Scoring

**E1 — Existing battle scoring.** The canonical BaggerBomb ATR-normalized badge scorer is `calculateAssetScoreV3` (`src/utils/baggerBombUtils.js:535`) + constants `src/constants/baggerBombScoring.js` (bagger tiers +15/+30/+50, busts −10/−20/−35, conviction Star 2.0/Core 1.5/Support 1.0). `[VERIFIED]` **Scoring math is duplicated, not single-sourced** (E-CRUX-5 PARTIAL correction): the *user* layer (`tournamentUserScoring.js:27`) and the v4 cron (`baggerbomb-v4-daily-scores.js`) call the canonical function directly, while the **fenced agent layer** calls a maintained **port** `calculateAssetScoreServer` (`agentScoring.js:224`) that shares the constants and is held to a byte-identical-*output* invariant by a P4 equivalence battery (not literally byte-identical source — the canonical logs a `SKIPPING` line the port omits). Per BUILD_RULES §4, Spec 1 scoring must **extend, never copy** this site. `[VERIFIED]` Candidate-ranking scorers (`computeArchetypeRankings` `archetypeScoring.js:107`; `computeMomentumRankings` `momentumScoring.js:451`) are 0–100 dimension blends, **not** P&L.

**E2 — Risk-adjusted / friction P&L.** A **full risk-adjusted engine exists — only in scrapped season mode**: `seasonLeaderboard.js` `computeSharpe` (`:248`), `runningMaxDrawdown` (`:262`), `computeConsistency`, `computeRecoveryFactor`, `computeTradeStats` (winRate + dollar-weighted `profitFactor`), `computeCompositeScore` (`:104`) with weights sharpe .30 / drawdown .25 / consistency .25 / winRate .20 (`seasonConfig.js:35`); portfolio dollar-P&L with HWM and drawdown-from-peak in `seasonSettlement.js recalculatePortfolio` (`:265`). `[VERIFIED]` **Frictions do not exist anywhere** — grep of `slippage|commission|transactionCost|bidAsk|feePerTrade` across `api/`+`src/` is empty; season `dollarPnL` is gross (`seasonLeaderboard.js:376`). `[VERIFIED, NOT_FOUND for frictions]` So D-15's risk-adjusted half is reusable (from scrapped code, repointed off season-doc shapes); its friction half is entirely greenfield.

**E3 — Shadow-logger capture surface (D-16).** Three distinct surfaces:
1. `shadowLogger.js` — schemaless JSONL to **GCS** (`appendToStream:44` spreads `...record`; ~20 named streams incl. `decisions`, `evaluations`, `signal_drops`). It **could carry a second scoring label unmodified**. It is the fire-and-forget path the §5 cautionary tale warns about — **but** `appendToStream` returns a boolean and *can* be awaited/checked (§5-compliant if used that way; the WS1 rule_compat stream already does), so dual-labeling here is possible with an awaited-and-checked call, not intrinsically forbidden (E-CRUX-4 PARTIAL correction). `[VERIFIED]`
2. `captureReceipt.js` — the §5-compliant awaited catalog capture, but **outcome-blind by contract**: it bans "return/effect/scoring" fields (`:5-12`). A risk-adjusted-P&L label is an outcome field. Note `validateReceipt` (`learningValidators.js:49`) validates only closed enums + identity and does **not** reject an extra field, so the ban is enforced by assembly *convention*, not schema rejection (E-CRUX-3 PARTIAL). `[VERIFIED]`
3. `shadowAssemblyCapture.js` — durable awaited **Firestore** capture: `writeShadowDiff` → `agentBattles/{id}/shadowDiffs/{tickId}` (`:239`), `writeBattleSettlementRecord` → `battleSettlements/{id}` (`:366`). This records prompt-diffs/gate-aggregates/settlement coverage — **not scores** (it is prompt-assembly parity, not P&L). `[VERIFIED]`

**Net for D-16:** a dual score label needs either an awaited-and-checked `shadowLogger` stream, a relaxed receipt contract, or a new awaited stream — a design choice, not a free add.

---

### F. Cost and model call accounting

**F1 — Per-call telemetry.** **No cost/dollar telemetry and no per-user run-rate exist anywhere** — grep of `costUsd|runRate|pricePerToken|USD_PER|estimatedCost|tokenCost` is empty (I-6 greenfield). `[NOT_FOUND]` Token *counts* are captured at roughly **8 of ~21** Anthropic call sites (F-C1 PARTIAL corrected an earlier "3 of 9") and aggregated **per-battle** (`cronState.totalTokens.input/output` on the battle doc, `agent-evaluate.js:2681`) or attached per-decision — **never per-user**. `[VERIFIED]` The decision-path capture (`decide.js:723` `tokenUsage`) sinks to the fire-and-forget GCS `decisions` stream (`shadowLogger.js:72`), self-documented as lossy. A dead placeholder `cronState.totalTokensUsed` exists on the (scrapped) season entry doc (`create-entry.js:308`, never incremented).

**F2 — Batch API & caching.** **Batch API: live on exactly one seam** — Doug earnings previews via `wireBatchSubmit` → `messages.batches.create` (`wireModelCall.js:130`; submit `submit-earnings-batch.js:253`, poll `poll-batch.js`); the submit→Firestore-batch-doc→poll pattern is a clean reusable D-20 template. `[VERIFIED]` **Prompt caching: implemented nowhere** — `wireModelCall` passes content by reference with no `cache_control` (`generationParams:55-64`); the only `cache_control`/`ephemeral` hits are the English word in comments. D-20 caching is build-new on every path. `[VERIFIED]`

**F3 — Model call-site inventory by layer.**

| Layer | Call site | Model | Configured via |
|---|---|---|---|
| Trading Brain — strategy | `decide.js:388` | `claude-sonnet-4-6` | **HARDCODED**; temp from `ARCHETYPE_TEMPERATURES` (**FENCED**) |
| Trading Brain — portfolio | `decide.js:501,538` | `claude-haiku-4-5-20251001` | **HARDCODED** |
| Eval Brain | `agent-evaluate.js:1957` | `claude-haiku-4-5-20251001` | **CONFIG constant** `EVAL_MODEL_ID` (`agentEvalTransport.js:23`) — satisfies D-24 |
| Reflection / DRB | `reflect.js:216` | `claude-sonnet-4-6` | **HARDCODED**; `response.usage` discarded |
| Voice — chat | `chat.js:397` → `gemmaClient` | `google/gemma-4-26b-a4b-it` | **HARDCODED** `GEMMA_MODEL`, **OpenRouter** (not Anthropic) |
| Voice — debate | `debate.js:160` | `claude-haiku-4-5-20251001` | **HARDCODED** |
| Wire / newsroom | `wireGenerationConfig.js:46` SEAM table | Haiku + Sonnet per-seam | **CONFIG MODULE**, routed through the single `wireModelCall` constructor — satisfies D-23 (Wire-scoped) |
| agent-batch-review | `agent-batch-review.js:185` | `claude-haiku-4-5-20251001` | **HARDCODED** |
| season generate-debrief | `generate-debrief.js:34` raw `fetch` | Sonnet | **raw fetch**, uses `ANTHROPIC_API_KEY` (a *different* env var) |

`[VERIFIED]` Client construction is fragmented: `decide.js`, `agent-evaluate.js`, `reflect.js`, `debate.js` each build their own `new Anthropic(...)`. The **Voice path uses Gemma via OpenRouter, not Anthropic at all** (F-C3 PARTIAL correction — relevant to D-40's V4-Flash/Gemma decision). D-23's single wrapper governs only the Wire's seams today.

---

### G. Conflicts and landmines

**G1 — The season landmine (the core conflict).** Season mode is **only half-dead**, and the live half is exactly a persistent per-user portfolio:
- `seasonEntries` docs embed `portfolio: {cash, cashPct, totalValue, initialValue, totalReturn, highWaterMark, drawdownFromPeak, positions:{}, positionCount, sectorWeights, initialSectorWeights}`, tagged `// Portfolio — empty, populated by Day 1 cron` (`create-entry.js:269-282`). `[VERIFIED]`
- The write path + UI are **LIVE**: `api/season/create-entry.js` is a default-export handler (`:319`) POSTed to by `SeasonEntryModal.jsx:758`, which is mounted in `src/App.jsx`. Companion live endpoints: `pit-stop-reply.js`, `log-lockin.js`, `generate-debrief.js`. `ForgeLanding.jsx:1731` runs a live `where('userId','==',user.uid)` query on `seasonEntries`. `[VERIFIED]`
- The **populating cron is de-registered** (`season-daily-evaluate.js` absent from `vercel.json`). So live users can mint per-user portfolio docs (`cash=STARTING_CAPITAL`, `positions:{}`) that **never advance** — orphaned frozen docs. `[VERIFIED]`
- Precedent worth noting: a per-user concurrency cap `MAX_CONCURRENT_ACTIVE_ENTRIES=5` keyed on `userId+status=ACTIVE`, returning 409 at cap (`create-entry.js:60,543`). `[VERIFIED]`
- The valuation/mutation engine (`seasonSettlement.js recalculatePortfolio:265`, sell/trim/add/buy on a positions+cash book; `seasonEvalContext.js buildPortfolio:299` marks to market) is complete but dormant. `[VERIFIED]`

**Net conflict:** Spec 1's portfolio substrate risks (a) colliding with live `seasonEntries` writes, (b) re-implementing machinery that already exists in the season modules, and (c) inheriting orphaned docs. This subsystem is both the **top reuse target** (schema + engine) and the **top collision risk**. See §5 for the founder decision this forces.

> **Flagged for separate tasking (out of Spec 1 scope, per BUILD_RULES §3):** live users may be creating frozen orphaned `seasonEntries` portfolio docs today (dead advancement cron behind a live create path). Whether the `SeasonEntryModal` open-triggers are reachable in current navigation was **not** fully traced `[ASSUMED dead-but-mounted]`; confirming reachability + any existing orphaned docs is a data-hygiene item for the founder, not this audit.

**G2 — Index requirements / drift.** `firestore.indexes.json` (28 composite indexes). Four are on **`seasonEntries`** keyed on the exact per-user pattern a portfolio collection needs: `userId+seasonId`, `userId+createdAt DESC`, `userId+status`, `seasonId+status` — a ready template, and proof that a new portfolio collection querying `userId+status`/`userId+createdAt` **will require its own composite indexes** (deployed via `npm run deploy:indexes`). `agentBattles` carries the closest owner+archetype index: `ownerId+agentContext.archetype+createdAt` (`firestore.indexes.json:266`) — relevant to I-7 cohorting queries. `[VERIFIED]`

**G3 — "portfolio" naming collision (≥5 distinct live meanings).**
1. BaggerBomb **builder** portfolio (`usePortfolio.js:15`, tiered `{star,core,support}` in V3) — fenced concept.
2. **Agent battle** portfolio — tier slots `{star,core,support}` + `bench`; `flattenPortfolioServer` (`agentScoring.js:36`, **FENCED**); mutated by `agentSwapExecution.js`.
3. **Season** persistent portfolio — `{cash, positions{ticker:{shares,...}}}` (`create-entry.js:270`; UI `SeasonPortfolioStrip.jsx`). **Nearest to Spec 1's target.**
4. **Earnings-game** portfolio (`earningsGame/portfolio/PortfolioWarRoom.jsx`).
5. **Options-arena** portfolio (`optionsArena/TournamentPortfolioView.jsx`).
Plus a Vision scope enum value `'portfolio'` (`visionTypes.js:266`). `[VERIFIED]` A new persistent per-user collection named `portfolio`/`portfolios` collides semantically with all three load-bearing meanings and with the fenced agent shape — **Spec 1 needs a qualified name** (e.g. `managedBooks`, `mandates`, per O-1).

---

## 3. Reuse Map (the primary spec-writing artifact)

| # | Capability Spec 1 needs | Existing asset (file:line) | Disposition | Note |
|---|---|---|---|---|
| R1 | Per-tick eval loop scaffold | `agent-evaluate.js` handler + `processAgentBattle` (`:160,:540`) | **needs-extension** | Non-fenced handler; coupled to `agentBattles` query/expiry/CPU-opponent. Portfolio needs its own collection/query or a branch. |
| R2 | Model-agnostic single-constructor seam (D-23) | `wireModelCall.js` (Wire-scoped); inline clients `agent-evaluate.js:141`, `decide.js:88` | **build-new** (on the `wireModelCall` pattern) | Wire wrapper excludes the agent path by its own contract; build a sibling constructor with provider+model as config. |
| R3 | Batch API submit/poll (D-20) | `wireModelCall.wireBatchSubmit` + `submit-earnings-batch.js`/`poll-batch.js` | **needs-extension** | Working template; widen scope or parallel constructor for portfolio evals. |
| R4 | Prompt caching (D-20) | none | **build-new** | Zero implementation; add a `cache_control` content path. |
| R5 | Archetype identity in prompt (D-8) | `buildAgentIdentityBlock`/`buildEvalSystemPrompt` (`agentEvalPromptAssembly.js:515,63`, FENCED) | **reuse-as-is** (call-only) | Content is portfolio-agnostic; editing to drop battle fields is fence contact. |
| R6 | Shared archetype class-definition surface (D-8) | `archetypeRegistry.getArchetypeDefinition()` (`archetypeRegistry.js:87`) | **needs-extension** | Composed but zero readers; Spec 1 becomes first consumer; may need a portfolio projection excluding game-only fields. |
| R7 | Class-intrinsic physics/knobs | `agentArchetypeConfig.js ARCHETYPE_CONFIGS` + `resolveHftConfig` (FENCED) | **reuse-as-is** (call-only) | Mode-agnostic already; `hftConfigByMode` is a config-only extension point (but a fenced edit). |
| R8 | Archetype-differentiated ranking | `archetypeScoring.computeArchetypeRankings` (FENCED) | **reuse-as-is** (call-only) | |
| R9 | D-4 customization-free class layer | definition objects + separate merge blocks (`agentPromptAssembly.js:96`) | **reuse-as-is** | Assemble class layer, omit Forge/lean/watchlist/directive; architecture already supports it. |
| R10 | Live market-data assembly | `getStockAnalysisData`/`fetchIntradayBatch`/`calculateVWAP`/`buildTechnicalSnapshot` (non-fenced) | **reuse-as-is** | |
| R11 | Decision schema / trade verbs | `TRADE_DECISION_TOOL` (`agentEvalToolSchema.js:4`, **NOT fenced**) | **needs-extension** | HOLD/SWAP one-in-one-out; a quarterly restructure/rebalance needs new verbs. Safe to extend (non-fenced). |
| R12 | Decision validation + execution | `validateTradeDecision`+`executeSwapServer` (`agentSwapExecution.js`, FENCED) | **needs-extension** | Persists to battle doc via tier/slot; portfolio persistence differs → new path outside fence, call-in only. |
| R13 | Persistent per-user holdings/positions of record | `seasonEntries.portfolio` shape (`create-entry.js:270`) | **needs-extension** | Reuse the shape; do **not** reuse the season doc as-is (collision + orphaned docs). |
| R14 | Portfolio mark-to-market + settlement (HWM/drawdown/sector weights) | `seasonSettlement.recalculatePortfolio:265` + `settleDay:28` (non-fenced) | **reuse-as-is** (repoint) | Complete engine; dormant; repoint off season doc shapes. |
| R15 | Risk-adjusted composite (Sharpe/drawdown/consistency/winRate) (D-15) | `seasonLeaderboard.js:248` + `seasonConfig COMPOSITE_WEIGHTS` | **needs-extension** | Math complete; wired to scrapped season snapshot shapes; add frictions, repoint. |
| R16 | Friction model (slippage/commission/spread) (D-15) | none | **build-new** | Entirely greenfield. |
| R17 | Game-score battle scoring | `calculateAssetScoreV3` (`baggerBombUtils.js:535`) + `baggerBombScoring.js` | **reuse-as-is** (extend, never copy — §4) | Fenced port (`agentScoring.js`) must stay output-identical. |
| R18 | Dual-label shadow scoring capture (D-16) | `shadowLogger.appendToStream:44` (awaited-capable) / `shadowAssemblyCapture.writeShadowDiff` | **needs-extension** | Awaited-and-checked stream, relaxed receipt, or a new awaited stream. Not a free add. |
| R19 | Per-portfolio archetype vintage stamp (D-9) | `resolvedAgentManifest.versionStamps` (`:146`, LIVE, per-battle) + `archetypeVersionConstants.js` | **needs-extension** | Version numbers exist; no per-portfolio display vintage; extending the frozen shape touches fenced `createAgentBattle`; a new durable field is required. |
| R20 | Regime tag on daily performance (I-7) | central `indexIntelligence/marketContext` (`regimeStamp.js:50`); `battlePatterns.marketRegime` | **needs-extension** | Never joined onto per-day performance rows; write-side join is new. |
| R21 | Per-user run-rate token/cost (I-6) | per-battle `cronState.totalTokens` (`agent-evaluate.js:2681`); no cost math | **build-new** | Re-key per-user + add a price table + dollar derivation. |
| R22 | Single-cron ET-aware fan-out dispatcher | `tournamentOrchestrator.js` + `tournament-orchestrator.js` (`vercel.json:162`) | **needs-extension** | Add a portfolio-anniversary duty; change idempotency grain from shared-ET-date to per-user. |
| R23 | Per-user anniversary / rollover triggering (D-37) | none (closest: `agent-evaluate.js:211` `expiresAt` scan) | **build-new** | New per-portfolio `nextRestructureAt` field + a poll modeled on the expiry scan. |
| R24 | ET/DST guard + per-day idempotency | `process-draft-claims.getClaimProcessingWindow`/`isAlreadyProcessedForDay`; `tournamentTime.js` | **reuse-as-is** (technique) | House DST pattern of record; re-key grain per-user-per-quarter. |
| R25 | Owner-scoped security rules + composite indexes | `firestore.rules seasonEntries:733`; `firestore.indexes.json` seasonEntries indexes | **needs-extension** | Adapt owner-read template; copy the index template; new collection needs its own indexes. |
| R26 | Per-user active-portfolio cap | `MAX_CONCURRENT_ACTIVE_ENTRIES=5` (`create-entry.js:60`) | **reuse-as-is** (pattern) | Precedent for limiting active books per user (D-38 don't-foreclose framing). |
| R27 | Deterministic archetype assignment | `archetypeDerivation.deriveArchetypeFromAnswers` (`:34`) | **reuse-as-is** | (Consumed by Spec 2, but the substrate inherits the same code-id.) |
| R28 | Dormancy downshift flag | none located (new feature flag) | **build-new** | D-21 dormancy downshift is a new flag + reflection/narration gating. |

---

## 4. Fence Impact Assessment (§7 / §1.4-P4 sign-off)

**Key structural finding:** the handler Spec 1 extends (`agent-evaluate.js`) and the schema it extends (`agentEvalToolSchema.js`) are **not fenced**. **Calling** fenced modules read-only is BUILD_RULES §1-permitted and requires **no sign-off**. The §7 gate is triggered only by changing a fenced module's **behavior or shape**, including from a non-fenced call site (the scoring engine and `createAgentBattle` doc shape are fenced *as concepts*).

| Fenced file | Spec 1 interaction | Sign-off required |
|---|---|---|
| `agent-evaluate.js` | **NOT fenced** — extend freely / add a portfolio branch or sibling handler. | None |
| `agentEvalToolSchema.js` | **NOT fenced** — extend decision verbs for portfolio rebalance. | None |
| `agentBattleService.js` | Call `findActiveAgentBattles` read-only (fine). If the portfolio doc **derives from the `createAgentBattle` shape**, that is concept-fence contact. | **§7 / §1.4-P4** if portfolio doc derives from the fenced doc shape |
| `agentEvalPromptAssembly.js` | Reuse `buildEvalSystemPrompt`/`buildAgentIdentityBlock` by call (fine). A **non-battle live-context** (no timer/opponent) means either a **dark non-fenced render module + one-import/one-call flag-split splice** (BUILD_RULES §1 flag-split, registered in `PROMPT_CONTRIBUTING_MODULES` same commit) or a fenced edit. | **§7** for a fenced edit; flag-split avoids it (still requires the registry entry) |
| `agentSwapExecution.js` | Call `executeSwapServer`/`validateTradeDecision` read-only. Portfolio persistence differs → **new execution semantics live outside the fence and call in.** | None for call-only; **§7 / §1.4-P4** for any behavior change |
| `agentScoring.js` | Call `calculateAssetScoreServer`/`flattenPortfolioServer` read-only. D-15 **friction math must layer alongside, never copy** (BUILD_RULES §4 copy-ban). | None for call-only; **§7 + no-copy** for new scoring math |
| `tournamentUserScoring.js` | Concept-fenced scorer; read/call only. | **§7** for any edit |
| `archetypeScoring.js` | Read `ARCHETYPE_WEIGHTS/TEMPERATURES` / call `computeArchetypeRankings`. A new dimension weight is concept-fence contact. **A new direct importer of the archetype tables also trips the §2.3 import-boundary ratchet** → record in `archetypeImportBoundaryBaseline.json` same commit. | None for call-only; **§2.3 baseline** if a new importer; **§7** for a weight change |
| `agentArchetypeConfig.js` | Read `getArchetypeConfig`/`resolveHftConfig`. Adding a portfolio entry to `hftConfigByMode` is a fenced edit; per-portfolio vintage stamping reads `KNOB_CONFIG_VERSION`. Same §2.3 ratchet applies to a new importer. | None for call-only; **§2.3 baseline** / **§7** for edits |
| `agentGuardrails.js` | Call `applyGuardrails`/`checkSectorCap` read-only (relevant to O-5 sector caps). | None for call-only; **§7** for behavior change |
| `decide.js` | Not on the eval path; do **not** extend it for portfolio evals. | **§7** if edited |

**Charter §10 confirms Spec 1 gets "full §7 treatment: Phase 0 read-only discovery (this doc) → hard STOP → founder review → dual adversarial review at design lock."** This audit satisfies the Phase 0 leg.

---

## 5. Open Questions for the Founder

**Charter §12 Spec-1 decisions (O-3, O-4, O-5) — discovery input:**

- **O-3 (starting capital / display currency).** Precedent exists: season entries mint at `startingCapital`/`STARTING_CAPITAL` with `cashPct:100` (`create-entry.js:270`). No display-currency convention was found. *Founder to set the amount; Spec 1 to define the field.*
- **O-4 (equities-only vs equities+crypto).** The battle portfolio already represents crypto as a slot inside `support[2]` with `isCrypto:true` (`agentBattleService.js:141`); the season positions map is ticker-keyed (equities-shaped). Charter leans equities-only V1 for scoring cleanliness. *Founder to confirm universe; affects the position schema and the friction/scoring model.*
- **O-5 (position count & concentration caps).** The platform sector-concentration cap **exists and is fenced**: `agentGuardrails.checkSectorCap` + `DIVERSIFIER_SECTOR_CAP_PCT` (`:93`) under `SECTOR_CAP_MODE='enforce'`, plus per-archetype `sectorConcentrationCap` in `ARCHETYPE_CONFIGS`. *Founder to decide adopt / adapt / exempt; adapting the cap's behavior is §7 fence contact — call-only reuse is not.*

**Discovery-surfaced questions the code cannot answer:**

- **O-9 (season subsystem disposition) — highest priority.** The scrapped-but-live season subsystem is simultaneously Spec 1's closest reuse target (schema `seasonEntries.portfolio`, engine `seasonSettlement`/`seasonLeaderboard`) and its top collision risk (live create path + dead cron → orphaned frozen docs). Does Spec 1 (a) **fork the season schema/engine** into a new `managedBook` collection and leave season alone, (b) **retire** the live season create path, or (c) **repurpose** season as the substrate? This decision gates §C, §E, and §G work.
- **O-10 (handler vs slot).** Does the portfolio eval loop **branch inside the non-fenced `agent-evaluate.js`** (BUILD_RULES §6 prefers branching; 2 slots remain) or land as a new handler/duty on the `tournamentOrchestrator` fan-out? Affects cron budget and cadence-tiering (D-19).
- **O-11 (D-16 dual-label mechanism).** Extend the outcome-blind `captureReceipt` contract (relax the ban), add a dedicated new awaited stream, or use an awaited-and-checked `shadowLogger` stream? Each has different §5 and corpus-integrity implications.
- **O-12 (D-8 substrate adoption).** Should Spec 1 make `archetypeRegistry.getArchetypeDefinition()` the production read surface (first consumer, first §2.3 importer) or keep reaching into the three fenced tables? The former is the cleaner D-8 realization but promotes a currently-dark surface.
- **O-13 (D-9 vintage granularity).** Extend the live per-battle `resolvedAgentManifest.versionStamps` toward a per-portfolio vintage (fenced-shape contact) or mint a new durable per-portfolio `archetypeVintage` field? And does the vintage need a display string ("Contrarian v1.4") beyond the existing version numbers?
- **O-14 (naming, ties to O-1).** The collection/type name must avoid the five existing "portfolio" meanings. If O-1 lands on "The Mandate," a `mandates`/`managedBooks` collection name is the clean choice.

---

## 6. Contradictions Found (doc/comment/naming vs code — code is truth)

| # | Doc / comment / name says | Code shows | Cite |
|---|---|---|---|
| X1 | `wireModelCall.js` is "the single-constructor model-call wrapper" (implying the D-23 global seam). | It scopes itself to the FantasyTimes Wire and **excludes** `decide.js` and every other importer; the agent path builds Anthropic inline twice. | `wireModelCall.js:5-11` vs `agent-evaluate.js:141`, `decide.js:88` |
| X2 | `api/agent/decide.js` name implies trade decisions are made there. | `decide.js` is the battle **create/deploy** path; per-tick decisions are made in `agent-evaluate.js`. Could mislead Spec 1 into extending the wrong (fenced) file. | `decide.js:16,56` vs `agent-evaluate.js:1956` |
| X3 | `TRADE_DECISION_TOOL` describes a "portfolio evaluation decision." | Schema enum is only `['HOLD','SWAP']`, one-in-one-out — not a portfolio rebalance. | `agentEvalToolSchema.js:12-25` |
| X4 | `featureFlags.js` / fenced `createAgentBattle` comments call `resolvedAgentManifest` "dark / byte-identical." | `MANIFEST_WRITE_ENABLED=true`; the manifest (incl. `versionStamps`) **is** written to every new battle doc. | `featureFlags.js:1076` vs `agentBattleService.js:219` |
| X5 | `SHADOW_ASSEMBLY` comments imply "byte-identical, preview-smoke-only." | `SHADOW_ASSEMBLY_ENABLED=true`; ticks write `agentBattles/{id}/shadowDiffs` and top-level `battleSettlements/{id}`. | `featureFlags.js:1097` vs `shadowAssemblyCapture.js:243,411` |
| X6 | `tournamentOrchestrator.js` header: "`TOURNAMENT_DEPLOY_ENABLED` stays false and every would-be call logs a loud 'P4 pending' line instead." | `export const TOURNAMENT_DEPLOY_ENABLED = true` — the gate is flipped; the deploy path is enabled (residual "P4 pending" log strings remain at `:391,:675`). | `tournamentOrchestrator.js:52-53` vs `:99` |
| X7 | BUILD_RULES §6 / C-19: "Season mode is scrapped; its crons are de-registered" (implies dormant). | Season **entry-creation + pit-stop endpoints + `SeasonEntryModal` UI + rules for 5 collections + 4 indexes are all LIVE.** Season is **de-cron'd, not removed.** | `BUILD_RULES.md:77` vs `create-entry.js:319` + `App.jsx` mount + `firestore.rules:727-768` |
| X8 | `create-entry.js:269`: "Portfolio — empty, populated by Day 1 cron." | The Day-1 cron (`season-daily-evaluate.js`) is **unregistered**; the portfolio is written with `positions:{}` and never advances. | `create-entry.js:269` vs `vercel.json` (no season cron) |
| X9 | `archetypeRegistry.js:6-8` and Charter D-8 imply a single shared class definition is consumed. | No single class-definition object is read in production; physics/scoring/identity are three homes; the unifying `getArchetypeDefinition()` has **zero readers**. | `archetypeRegistry.js:6` vs consumers |
| X10 | `shadowLogger.js` header: "Fire-and-forget shadow logging … use `.catch(() => {})`." | BUILD_RULES §5 forbids fire-and-forget for catalog events; the surface actually returns a boolean and **can** be awaited/§5-compliant — the name understates the hazard and overstates the constraint. | `shadowLogger.js:2,6-14` vs `BUILD_RULES.md:67-69` |
| X11 | `directiveIdentity.js:9`: "the single effective-archetype resolver voice, the directive gate, and the cap all read." | Header also says "inert in Phase C — nobody imports it yet"; eval assembly resolves archetype inline. Aspirational, not wired. | `directiveIdentity.js:9` vs `agentEvalPromptAssembly.js:990` |
| X12 | `wireGenerationConfig` reporter profiles declare Haiku for Neta/Doug previews. | Those seams run **Sonnet**; the profiles' model field is display-only; `poll-batch.js:152` hardcodes `generatedBy:'claude-sonnet-4-6'` (drift-prone). | `wireGenerationConfig.js:13-17` vs `poll-batch.js:152` |

---

## Appendix — What is out of scope (per brief §4)

Not audited, planned, or commented on: onboarding flows (Spec 2), Command Center / Voice Layer / SignalDrop / debate / proactive messaging (Spec 3), arena/loadout relocation (Spec 4), the rules revamp in flight, external bridge/MCP work. The one urgent cross-scope item surfaced — live-but-orphaned `seasonEntries` portfolio docs — is flagged in §G for separate tasking, not fixed here.

---

**STOP.** This report is committed as its own commit and pushed to `claude/portfolio-substrate-discovery-jzcakl`. No implementation planning proceeds until founder review. A byte-exact copy exists outside the repo tree per BUILD_RULES §3.
