# Archetype Rank Interface V2 — CC Phase 0 Discovery Report

**Spec:** `Archetype Rank Interface V2 — Build Spec` V1.2 (2026-09-01), §10 handoff (V-1 … V-16 + extras).
**Branch:** `claude/archetype-rank-v2-spec-ahtst9` · **HEAD:** `79aa5c9184a0774df0f5d6f981d561dae83ab0af` (= `origin/main`) · **Tree:** clean at session open.
**Fetch:** `git fetch origin` run first (BUILD_RULES §3); the only commit past the spec's grounding HEAD `bd60837` is PR #800, which adds `docs/audits/RANKS_ARCHETYPE_AUDIT_PHASE0_FINDINGS.md` and touches no code — every code anchor in that report is still exact at this HEAD.
**Mode:** READ-ONLY. No code, test, config, or fenced file was edited. This report is the only artifact (written outside the tree first, then committed under `docs/audits/`).
**Markers:** every claim carries `path:line` + **VERIFIED** (read at that line this session) or **ASSUMED** (inference / not measurable here).

---

## 0. Executive verdict

| Item | Verdict | One line |
|---|---|---|
| **Return scale** (extra) | **SPEC ERROR** | `return1W/1M/3M` are **signed percent** (2 dp), not decimals. The Contrarian gates `return1M ≥ −0.25` and composer gate `minReturn1MAny: −0.25` are 100× too tight; must be `−25`. |
| **Fence status of Job 1 Phase B** (extra) | **FENCED, not "adjacent"** | `api/_utils/archetypeScoring.js` is on the BUILD_RULES §1 fence list outright (`docs/BUILD_RULES.md:23`). Editing it is fence contact needing a founder-sanctioned entry. |
| **Flip PR version locks** (extra) | **QUIETLY REQUIRED** | Changing `ARCHETYPE_WEIGHTS`/`ARCHETYPE_CONSTRAINTS` trips two CI hash locks (calibration bundle, registry identity snapshot) and marks every CompiledBuild stale. Not in the spec. |
| V-1 `sma200_position` | RESOLVED | Signed **percent** distance from SMA-200, 2 dp; null under 200 bars. Third Dislocation term = percentile of `−sma200_position`. |
| V-2 `atrPercentile` fallback | RESOLVED (write-time only) | Distinguishable at write (`atrPercentileMap[sym] === undefined`), **not** at read (persisted 0.5 is ambiguous). Fallback is effectively dead on the normal path. |
| V-3 Mandate path | RESOLVED — **no caller** | Mandate never reaches `computeArchetypeRankings` or `stockRankings`; the `'mandate'` mode has no production caller. |
| V-4 `pillars.financialHealth` | RESOLVED — **does not reach** `stockRankings` | Pillars stay on `peerRankings`; V2.1 needs a producer addition. |
| V-5 caller census | RESOLVED — **9 production paths** | 8 direct call sites + 1 indirect module (competitive live draft) that shares the training draft core. One shared core serves two modes — spec gap. |
| V-6 persisted contract | RESOLVED | v1 `arch_scores` include `baggerBombFit` (weights 0.10–0.30). Existing tests pin "all six keys numeric" — moves at flip. |
| V-7 minimums | RESOLVED (numbers pinned) — **rulings needed** | No caller except the client hook has an explicit below-minimum path for a short (non-empty) list. `decide.js` proceeds with an under-filled portfolio below 9. |
| V-8 reader census | RESOLVED — **one reader needs a change** | Server screener / voice prose / client screener are V2-safe. `boardModel.js` (League + pod boards) falls back to `compositeScore` when a key is missing → an R10-excluded name would tier "Top tier". |
| V-9 axis parity | RESOLVED | Both subset callers read objects straight off the persisted doc → they carry `axes` once the producer writes it. Structural gap: the scorer cannot tell a subset from a full-but-axes-less doc. |
| V-10 normalization | RESOLVED (table in §2) | All rank-derived fields break ties by **universe list order**, not by symbol; `fundamentalScore` true-0 becomes null at write. |
| V-11 sector hygiene | RESOLVED | `sectorName` is never null/Unknown for the 239-name universe in practice; producer and consumer share one `STOCK_UNIVERSE`. Interleave rule for null needed. |
| V-12 `baggerBombFit` | RESOLVED with a caveat | 0–100 integer, effectively never null — but it imputes internally (missing pillars re-weighted, missing fund → 50). R10 cannot reach inside it. |
| V-13 runtime / size | **UNMEASURED runtime; size estimated** | No in-repo runtime record; only a log line + `elapsedSeconds`. Size: HEAD ≈ 35% of 1 MiB, V2 ≈ 42%, headroom ≈ 58% (synthetic, ASSUMED). |
| V-14 capture mechanism | **ABSENT** | No snapshot writer, no `process.env` ops-toggle precedent in `api/`, no Firestore TTL in-repo, cron budget **39/40** (BUILD_RULES §6 says 37/40 — stale). |
| V-15 flag consistency | RESOLVED | One flag module (`src/config/featureFlags.js`, zero imports) serves server and client; `flagPinGuard` covers it; dark flag needs `DARK_BY_DESIGN` + `// Pinned by:`. |
| V-16 fence routing | RESOLVED | `decide.js` has exactly one scorer call (`:343`); the tournament fork returns before it. The ARCH column reads `s.archetypeScore` (fenced) — V2's return shape must honour that name. |

**HARD STOP after this report.** 16 founder rulings are listed in §6; Job 1 must not start until they land.

---

## 1. Conflicts between the spec and the code (rule these first)

### C-1 — Return fields are percent, not decimal (spec §2, §3.1, §3.3(b), §5 test 11, §6)
`api/_utils/returnCalculations.js:13-15` — "Every return is a REALIZED, PAST result expressed as a signed percent rounded to two decimals (+12.4 = up 12.4%)". Formula `Number(((recent / past - 1) * 100).toFixed(2))` at `:35`; windows 5 / 21 / 63 / 252 trading bars at `:19-24`; null when the past bar is missing or non-finite (`:30-36`). **VERIFIED.** Written to the doc at `api/cron/compute-index-intelligence.js:1154-1158` (comment at `:1151-1153` says "signed percent"). Consumers agree: `api/_utils/screenStocks.js:36`, `api/_utils/voiceLayerPrompt.js:2253`, `src/components/League/draft/boardModel.js:84` (prints `${ret1W}%`). **VERIFIED.**
**Effect:** `{ field: 'return1M', min: -0.25 }` would exclude every name down more than a quarter of one percent on the month — roughly half the universe on any normal day. The narration string ("down more than 25% on the month") is correct in words; the config numbers are not. Correct values: `return1M ≥ −25`, `return1W ≥ 0` (unchanged), `minReturn1MAny: −25`, and the §6 gate "`return1M ≥ −0.25`" → `≥ −25`.
**Note on windows:** "1W" is 5 bars and "1M" is 21 bars of adjusted closes; on intraday runs bar 0 is the spliced live price (`compute-index-intelligence.js:5-9`), so both gates re-evaluate hourly. **VERIFIED.**

### C-2 — `archetypeScoring.js` is a fenced file, so Job 1 Phase B is fence contact
`docs/BUILD_RULES.md:23` lists `api/_utils/archetypeScoring.js` under §1 ("Editing them is forbidden outside the one sanctioned entry"), added Jul 24 2026. **VERIFIED.** The spec calls Phase B "§7-adjacent; build dark, flip via §7" (§5, §7). Under the rules of record, any edit to that file — even a dark, flag-off, byte-identical one — is a fenced edit that needs a founder-sanctioned entry, and BUILD_RULES §1 also says the scoring engine is fenced *as a concept*: a V2 scorer is the scoring engine wherever it lives.
**Recommended routing (the DR-13 flag-split precedent, BUILD_RULES §1):** put the V2 pipeline in a new non-fenced module (e.g. `api/_utils/archetypeScoringV2.js`, plus `axisDerivation.js`), and keep the fenced diff to one import and one dispatch line inside `computeArchetypeRankings`. The flag read then lives in the V2 module, so the fenced file never imports `featureFlags.js`. Founder ruling on the entry either way (§6 R-2).
**Related hygiene:** four comments still call the module "non-fenced" / "zero-import" (`src/hooks/useTrainingDraft.js:21-23`, `api/_utils/trainingLifecycle.js:60`, `src/components/League/draft/boardModel.js:9`, `api/_utils/tournamentAgentBoards.js:20`) — stale since Jul 24. **VERIFIED.**

### C-3 — The flip PR trips two hash locks and invalidates every compiled build
- **Calibration bundle.** `api/_utils/calibrationBundle.js:24-28,49-51` composes `ARCHETYPE_WEIGHTS / TEMPERATURES / CONSTRAINTS` by reference and hashes them (`:63-67`); `api/_utils/archetypePhase2Constants.test.js:56,97-98` locks the hash to `RECORDED_CALIBRATION_HASH` and fails on content change without a `CALIBRATION_BUNDLE_VERSION` bump (`archetypeVersionConstants.js:15-22`). **VERIFIED.** Replacing the constraint strings or retiring/re-pointing the weights table = bump 1→2 + re-record, same commit.
- **Registry identity snapshot.** `api/_utils/archetypeRegistry.js:153-157` exposes `scoring.weights/temperatures/constraints`; `computeIdentityHash` (`:194-203`) hashes every definition including `scoring`; `archetypeRegistry.test.js:102-118` fails when the live hash differs from `docs/registry-snapshots/archetype-registry-identity-v3.json` (the weights are embedded there — `…-v1.json:370-371`). **VERIFIED.** Flip = `ARCHETYPE_IDENTITY_VERSION` 3→4 (`archetypeVersionConstants.js:58`) + regen via `GENERATE_REGISTRY_SNAPSHOT=1` (`archetypeRegistry.test.js:19`) + the candidate snapshot (v5, `archetypeRegistry.js:85`).
- **Compiled builds.** `api/_utils/deployBuildValidation.js:67-82,155-160` compares each stored build's `identityHash` and `calibrationBundleVersion` against live values; any mismatch → "stale CompiledBuild … recompiling at current revision" (`:177-184`). **VERIFIED.** So the flip silently recompiles every agent on its next deploy. Mandate vintages also carry `calibrationBundleVersion` (`api/_utils/mandateVintage.js:103`) — effect on running books not traced (ASSUMED none beyond the stamp).
- **Direct pins that move:** `archetypeRegistry.test.js:82-85` (`toBe(ARCHETYPE_WEIGHTS.momentum_chaser)` identity pin); `src/constants/leagueTournament.test.js:124,644` (`CPU_ARCHETYPE_ORDER` keys = weights keys — survives if V2 keeps six keys). **VERIFIED.**
**During Job 1 (dark):** adding *new* exports changes neither hash (composition is by named export), so no bump is needed until the flip. **VERIFIED by construction of `buildCalibrationBundle`.**

### C-4 — One shared draft core serves two game modes
`trainingLifecycle.js:254-278` (`chooseHumanPick` → `topArchetypeFit` → `computeArchetypeRankings(available, archetype)` at `:275`) is reused by value by the competitive live draft (`api/_utils/liveDraftLifecycle.js:51-56,311-314,401-404`; header `:1-17` "ONE snake engine for both modes"). **VERIFIED.** Spec §4 requires one explicit mode per production caller: the shared function needs a `gameMode` parameter threaded from each entry point (`training` for pods, `tournament` for the live draft). The spec's V-5 census did not name the live-draft path.

### C-5 — R10 exclusion reaches further than the spec's examples
Every V2 vector weights `persistence` (`momentumScore`) > 0; `momentumScore` is null when all six momentum metrics are null (`api/_utils/momentumScoring.js:499-504`). Trend Follower and Diversifier weight `quality` (0.05 / 0.30) → any name without a `peerRankings` doc (dropped under 3 pillars, `api/cron/compute-rankings.js:886-892`) or with a true-zero composite (`|| null` at `compute-index-intelligence.js:1117`) is excluded from those archetypes. Speculator weights `dislocation` 0.10 → any name with fewer than 200 bars (`sma200_position` null, `technicalCalculations.js:19-20`; universe retention is only ≥ 50 bars, `compute-index-intelligence.js:722`; fetch ≈ 252 bars, `:117-119`) or thin return history is excluded from Speculator. **VERIFIED.** Accepting this is a ruling; the alternative is zeroing the small weights (R-6).

### C-6 — The ARCH column reads `s.archetypeScore`, inside the fence
`api/_utils/agentPromptAssembly.js:249` renders `s.archetypeScore.toFixed(1)`; `decide.js:390,495` feeds it the scorer's output. **VERIFIED.** The spec defines `finalScore` (mode blend) and `archetypeScore` (base) but never says which property the V2 objects carry. If the blended value is not written to `archetypeScore`, the ARCH column shows the base score in BaggerBomb mode — a fenced CSV edit to fix. Recommendation: `archetypeScore` = mode-blended final (what every caller sorts and shows), `archetypeBaseScore` = base (what the cron persists as `arch_scores_v2`). Ruling R-7.

### C-7 — Nothing in the repo supports the snapshot toggle, its expiry, or a new cron
- No `rankingSnapshots` / `RANKING_SNAPSHOTS_ENABLED` anywhere (grep, **VERIFIED**).
- No `process.env.X === '1'`-style ops toggle exists in `api/` or `src/` (grep, **VERIFIED**); the producer reads env only for secrets (`compute-index-intelligence.js:57,100-102,547`). A Vercel env-var change takes effect on the next deployment (**ASSUMED**, platform behaviour), so "an ops toggle, not a feature flag" still costs a deploy.
- No Firestore TTL policy in-repo (`firestore.indexes.json` has no `ttl` override; prior audit `docs/audits/ARCHETYPE_MASTERY_PHASE0_DISCOVERY_20260720.md:93`). **VERIFIED.** `expiresAt` on a new collection expires nothing unless a console TTL policy or a cleanup job exists.
- Cron budget: `vercel.json` carries **39** schedule entries (**VERIFIED** count); BUILD_RULES §6 still says 37/40 (stale). One slot remains — a snapshot-cleanup cron is unaffordable. Expire-on-write inside the premarket run (branching in an existing handler, §6) or a console TTL are the options. Ruling R-11. Documenting the toggle in BUILD_RULES is a founder-cited change.

### C-8 — The scorer cannot structurally detect "a subset without axes"
Spec §5 Phase B: "if the input is a caller-supplied subset without axes → throw `axes_subset_unavailable`". A plain array carries no universe size. Between the producer deploy and its first run, every caller (full-universe callers included) receives a doc with no `axes`; the fallback would correctly derive over the full input, but the two subset callers (`trainingLifecycle.js:270-275`, `useTrainingDraft.js:173-179`) would be indistinguishable from that case. Options: pass `opts.universeSize` (read from the doc-level `axes_universe_size` / `stocks.length`) so the scorer can compare, or accept the transitional window. Ruling R-8.

### C-9 — Parity (test 12) needs a rounding contract and persisted-shape inputs
`atrPercentile` is used **unrounded** for game-mode fits (`compute-index-intelligence.js:1094,1102`) and written **rounded to 2 dp** (`:1130`). If `deriveAxes` runs on the in-memory unrounded value in the producer and on the persisted rounded value in the fallback, `volatility` differs (e.g. 37/238 → 15.546 vs 0.16 → 16). Rule: `deriveAxes` consumes only persisted-shape fields (round first, derive second) and rounds each axis to a stated precision. Ruling R-10.

---

## 2. V-1 … V-16 findings

### V-1 — `sma200_position` semantics → percent distance, signed, 2 dp
`compute-index-intelligence.js:832-834`: `(sma200 !== null && currentPrice != null) ? Number((((currentPrice - sma200) / sma200) * 100).toFixed(2)) : null`; mirrored to the doc at `:1140`. `calculateSMA` returns null under 200 closes (`api/_utils/technicalCalculations.js:19-20`). Consumers render it as a percent (`api/_utils/agentEvalPromptAssembly.js:1494-1496`, `voiceLayerPrompt.js:2249`). **VERIFIED.**
**Third Dislocation term:** `pct(−sma200_position)` — more negative = further below = more dislocated; null → the whole `dislocation` axis is null (R10). Names with < 200 bars carry null (universe requires only ≥ 50 bars, `:722`). Peripheral: `api/_utils/voiceLayerPrompt.test.js:108` fixes `sma200_position: 'above'` (a label) — a stale fixture, not production. **VERIFIED.**

### V-2 — `atrPercentile` fallback distinguishability
- Computed: `idx / (N−1)` over names with non-null `atrPercent`, ascending (`:1027-1036`); N = 1 → 0.5 (a *computed* 0.5).
- Fallback: `atrPercentileMap[tech.symbol] ?? 0.5` (`:1094`) fires only when `tech.atrPercent == null` (`:877` ← `calculateATR`, null under 15 bars, `technicalCalculations.js:286,303`). Every retained name has ≥ 50 bars → the fallback is dead on the normal path. **VERIFIED.**
- At write time the producer can distinguish (`atrPercentileMap[tech.symbol] === undefined`). At read time it cannot (persisted `0.5` after `:1130` rounding is ambiguous). **VERIFIED.**
**Recommendation:** mirror the raw `atrPercent` onto `techRaw` and let `deriveAxes` set `volatility = null` when the raw is null; then producer and fallback paths agree without a marker field. (Adds one number per stock; see V-13.)

### V-3 — Mandate's draft path → not on this pipeline
`api/_utils/mandateCandidateUniverse.js:1-40` is a curated ~150-name list; `api/_utils/mandateUniverseSnapshot.js:32-34` builds Mandate's own snapshot from `tournamentPrices` + `marketDataCache`. Grep over every `mandate*.js`: zero references to `archetypeScoring`, `stockRankings`, `arch_scores`, `computeArchetypeRankings`. `decide.js:343` is the BaggerBomb agent deploy (system prompt at `agentPromptAssembly.js:42`; tiered mode `decide.js:903`, `src/constants/agentGameModes.js:36`), not a Mandate path. **VERIFIED.** The `'mandate'` mode in spec §4 has no production caller at HEAD. Ruling R-5 (drop from the enum, or keep reserved).

### V-4 — `pillars.financialHealth` → stays on `peerRankings`
Computed in `compute-rankings.js:860-869` from `rankingConfig.js:684,696` (weight 0.15, 4 dimensions). The index-intelligence producer reads `fund.pillars[*].percentile` only into `pillarScores` for game-mode fits (`compute-index-intelligence.js:1075-1079`); the persisted `stockEntry` (`:1109-1159`) carries no pillars; `buildFundamentalsMirror` (`:485-537`) mirrors seven raw metrics, none a pillar. **VERIFIED.** `src/data/ruleSupportStatus.js:126-128` records that no health band exists. V2.1 candidate only after a producer addition (an additive `pillars` or `fundRaw` mirror).

### V-5 — Complete caller census at HEAD (grep over `api/` + `src/`, `.js/.jsx/.mjs/.ts/.tsx`, excluding `docs/`)

| # | Call site | Entry point(s) | Input | Proposed mode | Fenced | Scorer-throw path today |
|---|---|---|---|---|---|---|
| 1 | `api/agent/decide.js:343` | POST `/api/agent/decide` (BaggerBomb deploy; tournament fork at `:309-313` returns earlier) | full `stocks` (`:339`) | `baggerBomb` | **§1 fenced** | handler catch `:976` → clears `deployingAt` `:980`, stamps `deployProgress.stage:'error'` / `errorPhase:'pre_decision'` `:1005`, **HTTP 500** `:1012` |
| 2 | `api/cron/compute-index-intelligence.js:1180` | cron (`vercel.json:149-155`) | full `rankingStocks` | `standard` (persisted base) | no | handler catch `:1258-1267` → 500, **no doc overwrite** (batch never commits) |
| 3 | `api/agent/scouting-board.js:113` | GET `/api/agent/scouting-board` (flag `SCOUTING_BOARD_ENABLED=true`, `featureFlags.js:900`) | full | `scouting` | no | catch `:160` → **500 `internal_error`** `:162`; unknown archetype 400s *before* the call (`:75-80`) |
| 4 | `api/_utils/tournamentAgentBoards.js:467` | `produceGroupBoards` ← `tournamentOrchestrator.js:75`, `api/tournament/produce-agent-boards.js:22` | full | `tournament` | no | per-member catch `:535-537` → logged, `summary.errors++`, member left without a board (a missing board stops the draft — `:400` comment, ASSUMED consequence) |
| 5 | `api/_utils/tournamentAgentDraft.js:258` | `resolveAgentDraftForGroup` ← `tournamentOrchestrator.js:76`, `api/tournament/resolve-agent-draft.js:23` | full (`universe_unavailable` sentinel on empty, `:250-252`) | `tournament` | no | propagates out of the resolver (ASSUMED: orchestrator/handler error) |
| 6 | `api/_utils/tournamentBoardAutoCommit.js:161` | `autoCommitMissingBoards` ← `tournamentOrchestrator.js:81` | full | `tournament` | no | inside per-user `try` at `:152` (catch not read; ASSUMED logged + user skipped) |
| 7 | `api/_utils/trainingLifecycle.js:275` (`topArchetypeFit` ← `chooseHumanPick`) | `api/tournament/training-pick.js:26`, `lobby-quickplay-training.js:28`, orchestrator sweeps `tournamentOrchestrator.js:83` | **subset** (pool ∩ not-taken, `:270-273`) | `training` | no | throws inside the pick transaction; `training-pick.js:109-115` maps only sentinel errors → non-sentinel = generic 500 (ASSUMED) |
| 7b | same function via `api/_utils/liveDraftLifecycle.js:311-314,401-404` | `api/cron/live-draft-fire.js:30`, `api/tournament/live-draft-pick.js:13` | **subset** | `tournament` | no | as 7 (C-4: mode must be threaded) |
| 8 | `src/hooks/useTrainingDraft.js:179` | client hook (training pod board) | **subset** (`:173-176`) | `training` | no | `try/catch` → empty overlay (`:179-180`) — the only explicit degrade |

Non-callers confirmed: the Mandate path (V-3); `api/cron/agent-evaluate.js` (no scorer reference); `voiceLayerPrompt.js` (reads `arch_scores` prose only). Tests importing the scorer: `compute-index-intelligence.test.js:11,51,92,143-146`, `scouting-board.test.js:13,203`. **VERIFIED.**

### V-6 — Persisted-score contract
`arch_scores[archetype] = computeArchetypeRankings(rankingStocks, archetype)[i].archetypeScore` (`:1178-1188`), i.e. v1 blends `baggerBombFit` at 0.30 / 0.15 / 0.20 / 0.25 / 0.15 / 0.10 (`archetypeScoring.js:18,26,34,42,50,58`). **VERIFIED.** Existing pins: `compute-index-intelligence.test.js:86-97` (attached == independent call — a self-consistency test, not a golden) and `:100-113` (every stock, all six keys, numeric 0–100). The V2 contract test must (a) hold `baggerBombFit` varying while `arch_scores_v2` stays fixed, and (b) replace `:100-113` at flip because R10 produces missing/null keys. Every reader tolerates 0–100 numbers (`screenerAdapter.js:42`, `boardModel.js:33-42`).

### V-7 — Minimum universe per caller, below-minimum behaviour, and the error path

| Caller | Needs | Today's behaviour when the list is short | Ruling needed |
|---|---|---|---|
| `decide.js` | Sonnet asked for 25–35 (`agentPromptAssembly.js:42`); fallback shortlist = top **35** (`:427-433`); padding when < **15** up to 35 (`:452-460`); Haiku needs **9** stocks (2+2+2+3, `validatePortfolio :1106-1109`) | < 35 → shorter shortlist, silent; < 9 → validation fails twice → `buildFallbackPortfolio` has **no length guard** (`:1145-1189`) → `enrichPortfolio` (`:1214-1233`) builds an under-filled portfolio → deploy proceeds (ASSUMED downstream). `scanCount` reports the full universe (`:481`) even though the CSV is filtered (cosmetic). `validSymbols` is the full universe (`:436`) → Sonnet/Haiku can pick a filtered-out name (Job 3's gates). | pin 35 / 15 / 9 + an explicit path |
| `scouting-board.js` | **10** (`BOARD_SIZE`, `:25`) | shorter board, silent | pin 10 |
| `tournamentAgentBoards.js` | CSV = whole ranked list (`:373`); board ≥ **15** after padding (`BOARD_DEPTH_MIN`, `leagueTournament.js:1122`; check `:383-385`) | < 15 in the ranking → throws → deterministic fallback board from the same short list (`:387-390`) | pin 15 |
| `tournamentAgentDraft.js` | fallback catalog must cover **24** agent picks per group (`AGENT_MARKET_SIZE`, `leagueTournament.js:75`) plus up to 12 user-held names (`:73`) → ≥ **36** available | empty → `universe_unavailable`; short → draft may exhaust (`resolveAgentSnakeDraft`, not read) | pin 36 |
| `tournamentBoardAutoCommit.js` | pad to **15** from ranking ∩ pool (`:158-168`) | short → `floored` warning (`:171-173`) | pin 15 |
| `trainingLifecycle.js` / live draft | **1** of available ∩ pool | 0 → `null` → pool-head fallback with `fallback: true` (`:261-264`, `:268-278`) — explicit and recorded | pin 1 (already explicit) |
| `useTrainingDraft.js` | **5** (`OVERLAY_SIZE`, `:34`) | shorter or empty highlight (`:180-181`) | pin 5 (already explicit) |
| League / pod boards (`boardModel.js`) | per-row read | missing key → composite fallback (`:59-65`) | see V-8 |

**VERIFIED** unless marked. Spec §3.4's `insufficient_axis_coverage` event + per-caller pinned minimum does not exist anywhere yet; the numbers above are the proposal (R-13).

### V-8 — Reader census of `arch_scores` (production code)

| Reader | Cite | V2 (missing/null keys, no mode term) | Change needed |
|---|---|---|---|
| Server screener | `api/_utils/screenStocks.js:40-56,102-110,348-360` | `resolveField` → `undefined` sorts last; `projectResult` → `null` (test `screenStocks.test.js:470-478`) | none |
| Voice-layer screen prose | `api/_utils/voiceLayerPrompt.js:2261,2292` | still "per-archetype fit" | optional wording |
| Client screener adapter | `src/components/Search/screenerAdapter.js:9,42,289-290` (tests `:44-50`) | null-safe | none |
| **League draft board** | `src/components/League/draft/boardModel.js:59-65` (`rawFit`: missing key → `compositeScore`), tiers `:33-42` | an R10-excluded name is scored by composite and can tier "Top tier" | **yes** — an explicit "excluded" state + reason line at/before flip |
| Pod free-agent board | `src/components/Tournament/awaitingOpen/podBoard.js:22-49` → `buildFitBoard` | inherits the above | with boardModel |
| Training pool rows | `src/hooks/useTrainingDraft.js:150` → same board | inherits | with boardModel |
| Diversifier overlay comment | `boardModel.js:56-58,130-131` ("static per name") | still true (V2 changes ordering, not the per-name score) | none |
| Comments / coaching prose | `DraftBoardRoom.jsx:5`, `featureFlags.js:453`, `src/data/archetypeAdjustments.js:130` | fine | none |
| Producer test | `compute-index-intelligence.test.js:100-113` | pins "all six keys numeric" | **yes** at flip |

No reader checks a version field today, so "every reader accepts version 2" reduces to the boardModel change and the test update. **VERIFIED.**

### V-9 — Axis-derivation parity for subset callers
`trainingLifecycle.js:208-216` (`readStockUniverse` → `snap.data().stocks`), `:270-273` filters those objects; `useTrainingDraft.js:81-82` reads the same doc, `:173-176` filters; `liveDraftLifecycle.js:274` uses `readStockUniverse`. All three pass persisted stock objects → they carry `axes` as soon as the producer writes it, with no caller change. **VERIFIED.** The only gap is C-8 (transitional doc without `axes`).

### V-10 — Normalization contracts

| Field | Scale / direction | Formula & cite | Null | Ties |
|---|---|---|---|---|
| `fundamentalScore` (→ `quality`) | 0–100 integer, higher better, **within-sector** | `peerRankings.compositeScore`: weighted avg of pillar percentiles, missing pillars re-weighted, ≥ 3 of 7 pillars (`compute-rankings.js:872-892`, round at `:889`); copied at `compute-index-intelligence.js:1060,1117` | no doc under 3 pillars; **`\|\| null` turns a true 0 into null** (`:1117`) | shared values possible |
| `technicalRank` (→ `strength`) | 1..N, 1 = best, universe-wide | sort `technicalScore` desc, `idx+1` (`:896-899`); `technicalScore` capped 100 (`indexIntelligence.js:379`) | never null for a retained name | **stable sort → ties resolved by `ALL_TICKERS` order** (`stockScores` built in that order, `:720-730`), not by symbol |
| `momentumScore` (→ `persistence`) | 0–100 integer, higher = stronger | `percentileRank(bmz)` = `round(idx/(n−1)×100)`, n = 1 → 50 (`momentumScoring.js:315-330,527-528`) | null when all six metrics null (`:499-504`) | distinct values by index order |
| `atrPercentile` (→ `volatility`) | 0–1, 2 dp at write, higher = more volatile | `idx/(N−1)` ascending ATR% (`:1027-1036`), rounded `:1130` | dead fallback (V-2) | distinct by order |
| `return1W/1M/3M` (gates) | **signed percent**, 2 dp | 5 / 21 / 63 bars (`returnCalculations.js:19-36`) | < k+1 bars | — |
| `sma200_position` (→ dislocation term) | signed percent, 2 dp | V-1 | < 200 bars | — |

**VERIFIED.** Rank-derived axes inherit an order-dependent tie rule; R-9 asks whether that is acceptable or whether `strength` should be a tie-aware percentile of `technicalScore`.

### V-11 — Sector hygiene
Write path: `sectorName = fund?.sectorName || (sectorId ? STOCK_UNIVERSE[sectorId]?.name : null)` (`:1063`); `peerRankings.sectorName = STOCK_UNIVERSE[sectorId]?.name || 'Unknown'` (`compute-rankings.js:1357` — the string `'Unknown'` is truthy and would win, but every universe ticker has a sector). Both derive from the single `STOCK_UNIVERSE` (`rankingConfig.js:15-82`, 11 GICS names); the client duplicate `src/constants/sectors.js:7-87` carries the same 11 names today. **VERIFIED.** So for the 239-name universe `sectorName` is never null or `Unknown` in practice; a rename propagates through both crons the same morning (compute-rankings 11:00 UTC vs index-intelligence 10:30 / 11:30 UTC, `vercel.json:69-70,149-155`) — the 10:30 run can carry the previous name for about an hour (ASSUMED from schedules). The v1 scorer maps null → `'Unknown'` (`archetypeScoring.js:113,126`).
**Interleave proposal (R-12):** null/`Unknown` is not a sector — it never satisfies "unrepresented sector", is never counted toward the 5, and is placed only in the fill phase; ties: `quality` desc, then symbol asc (spec).

### V-12 — `baggerBombFit`
0–100 integer, clamped (`gameModeScoring.js:124`); null only if *both* component scores are null (`:104`) — the technical component is never null because the seven factor inputs default to 50 (`compute-index-intelligence.js:1084-1090`) → **effectively never null**. Written `?? null` (`:1129`); v1 scorer imputes 50 (`archetypeScoring.js:122`). **Caveat for R10:** the term imputes *internally* — missing pillars are re-weighted (`:58-73`, ≥ 3 required), a missing fund component becomes 50 (`:105-106`), momentum heat contributes 0 when absent (`:109-116`). **VERIFIED.** R10 governs the archetype layer; state explicitly that the game-mode term is producer-imputed by construction.

### V-13 — Runtime and document-size baseline
- **Runtime: UNMEASURED.** The handler logs `Done in Xs` and returns `elapsedSeconds` (`:553,1241-1242,1255`); `maxDuration: 300` (`:54`). No document in `docs/` records a producer runtime (grep). Producing p50/p95/max needs Vercel log access this session does not have. The spec's 24 s target has no in-repo provenance (ASSUMED founder-set). **Recommendation:** have the observation snapshot record `elapsedSeconds` and the per-stage timings so the window itself yields the baseline.
- **Size guard exists:** `STOCK_RANKINGS_DOC_WARN_BYTES = floor(1 MiB × 0.6) = 629,145` (`:441`), checked on `JSON.stringify(rankingsPayload).length` (`:1224-1231`). **VERIFIED.**
- **Size estimate (ASSUMED — synthetic 239-name payload built from the `:1109-1159` shape with mirror ON, `momentumFactors`, `pivots`, `levels`, `arch_scores`, `sectors`, `industries`; script in the session scratchpad):**

| Shape | JSON bytes | % of 1 MiB | Firestore-accounting est. | per stock |
|---|---|---|---|---|
| HEAD | ≈ 362,600 | 34.6% | ≈ 354,100 | ≈ 1.5 KB |
| + `axes` (8) + `techRaw` (3) + `arch_scores_v2` (6) + 3 doc fields | ≈ 442,100 | 42.2% | ≈ 431,300 | ≈ 1.8 KB |

V2 delta ≈ 79 KB (≈ 332 B/stock); headroom after V2 ≈ **58%** of 1 MiB, above the spec's 20% gate and below the 60% warn line. Real values differ (mirror coverage, industry-gate membership, null density). Firestore write latency: unmeasured.

### V-14 — Observation capture mechanism
Absent (C-7). Nothing writes snapshots; no env toggle precedent; no TTL; one cron slot left. The `x-vercel-cron` / `CRON_SECRET` auth pattern (`:545-547`) and the `expiresAt` cleanup idiom (`api/fantasytimes/cleanup.js:38,56`) are the only related precedents. **VERIFIED.**

### V-15 — Flag consistency
One flag module, `src/config/featureFlags.js` (zero imports → Node-clean), imported by the producer (`compute-index-intelligence.js:50`) and by the client hook (`useTrainingDraft.js:32`). `src/config/flagPinGuard.test.js:45-49` lists it as a flag source; deliberately-dark flags need a `DARK_BY_DESIGN` entry (`:58-116`) and a `// Pinned by:` pointer at the definition (`featureFlags.js:1548-1549` precedent) plus a pin test. **VERIFIED.** Server-on + stale client: the stale bundle carries its own copy of v1 math with the flag false → v1 overlay on v2 doc fields, as the spec expects. If the fenced file itself imports the flag (rather than the V2 module, C-2), BUILD_RULES §4 needs a dependency-surface comment in an un-mocked importing test.

### V-16 — Fence routing for R9
`decide.js` contains exactly one `computeArchetypeRankings` call (`:343`); the tournament fork (`:309-313`) returns before it via `runPrescribedTournamentDeploy`. **VERIFIED.** The flip-PR fenced diff is one line at `:343` (explicit `{ gameMode: 'baggerBomb' }`), provided the V2 return shape keeps the blended value under `archetypeScore` (C-6).

---

## 3. Extras requested in §10

**Importers of `ARCHETYPE_WEIGHTS` (VERIFIED):** `api/_utils/archetypeRegistry.js:54,154` (→ identity hash + snapshots, C-3); `api/_utils/calibrationBundle.js:25,49` (→ calibration hash lock, C-3); `api/_utils/archetypeRegistry.test.js:82-85` (identity pin); `src/constants/leagueTournament.test.js:124,644` (keys pin); comments only: `src/constants/leagueTournament.js:436`, `api/_utils/archetypeVersionConstants.js:17`. Runtime consumer of the table: `archetypeScoring.js:108` (with the silent `analyst` fallback for unknown archetypes — R-14).

**Import-boundary ratchet (BUILD_RULES §1 / Spec §2.3):** `api/_utils/archetypeRegistry.test.js:176-255` fails on any new production module whose source matches `from '…archetypeScoring(.js)?'` outside the baseline (`api/_utils/archetypeImportBoundaryBaseline.json`). Every current caller is listed. A new `axisDerivation.js` that imports nothing from the tables is clean; a new module importing `ARCHETYPE_*` from `archetypeScoring.js` must be added to the baseline in the same commit. The regex requires `.js` or a quote right after the basename, so `archetypeScoringV2.js` would not match — deliberate or not, note it. **VERIFIED.**

**Prompt-honesty registry:** `archetypeScoring.js` is classified in `CLASSIFIED_NON_REGISTRY_IMPORTS` (`api/_utils/__fixtures__/promptHonestyRegistry.js:72`), i.e. its constraint prose is *not* swept. The V2 strings contain none of the `FORBIDDEN_SIGNALS` (`:23-31`) — checked by eye. Moving the module into `PROMPT_CONTRIBUTING_MODULES` at flip is the honest classification (F-C).

**`return1W` / `return1M`:** NOT decimal — signed percent over 5 / 21 trading bars (C-1).

---

## 4. Things in the spec that quietly require a fenced edit and are not marked §7

| # | What | Why it is fence contact | Cite |
|---|---|---|---|
| F-A | Job 1 Phase B (V2 scorer, flag dispatch, config tables in `archetypeScoring.js`) | the file is on the §1 list; "§7-adjacent" is not a category the rules recognise | `BUILD_RULES.md:23`; C-2 |
| F-B | Flip PR: `CALIBRATION_BUNDLE_VERSION` bump + hash re-record; `ARCHETYPE_IDENTITY_VERSION` bump + snapshot regen; CompiledBuild recompile | not fenced files, but a cross-agent behaviour change the spec's §8 omits | C-3 |
| F-C | `ARCHETYPE_CONSTRAINTS_V2` prose | consumed by the fenced assemblers; module currently outside the honesty sweep | `promptHonestyRegistry.js:48-55,72` |
| F-D | ARCH column property name | `agentPromptAssembly.js:249` reads `archetypeScore`; a different name needs a fenced CSV edit | C-6 |
| F-E | `decide.js:481 scanCount` and `:436 validSymbols` semantics under a filtered list | fenced; cosmetic / Job 3 | V-7 |
| F-F | Shared draft core mode threading | non-fenced, but a production caller the census missed | C-4 |
| F-G | `agentEvalPromptAssembly.js`, `agentPromptAssembly.js` | correctly out of scope for Job 1; confirmed no Job 1 item needs them | — |
| F-H | New importers of the scoring tables | §2.3 ratchet baseline edit in the same commit | §3 |

---

## 5. Out-of-task findings (reported, not fixed — BUILD_RULES §3)

1. **BUILD_RULES §6 cron count is stale:** 39/40 schedule entries at HEAD (`vercel.json`), not 37/40. One slot remains. **VERIFIED.**
2. **Stale comments:** four sites call `archetypeScoring.js` "non-fenced" / "zero-import" (`useTrainingDraft.js:21-23`, `trainingLifecycle.js:60`, `boardModel.js:9`, `tournamentAgentBoards.js:20`); `screenStocks.js:40` cites `compute-index-intelligence.js:47` for the archetype keys (now `:52`). **VERIFIED.**
3. **`voiceLayerPrompt.test.js:108`** fixes `sma200_position: 'above'` — a label where production carries a number. Harmless, misleading. **VERIFIED.**
4. **`decide.js:1203`** `baseATR = (stock.atrPercentile || 0.5) * 8` — the least-volatile name (percentile 0) is treated as 0.5 (`||`, not `??`). Fenced; pre-existing. **VERIFIED.**
5. **`decide.js:1202`** `stock.name || symbol` — `stockRankings` entries carry no `name` field (`:1109-1159`), so the fallback always fires. Cosmetic; fenced. **VERIFIED.**
6. **`atrPercentile` unrounded vs rounded split** (`:1094,1102` vs `:1130`): `baggerBombFit` uses the unrounded value, the doc carries 2 dp. Pre-existing; relevant to C-9. **VERIFIED.**
7. **`fundamentalScore` true-zero → null** (`:1117`, `|| null`): a genuine 0 composite is indistinguishable from "no data". Pre-existing; the comment at `:1053-1057` says changing it moves fenced scores. **VERIFIED.**

---

## 6. Founder rulings requested before Job 1 (numbered for citation)

| # | Ruling | Recommendation |
|---|---|---|
| R-1 | Return-scale correction (C-1) | Config in percent: `return1M ≥ −25`, `return1W ≥ 0`, `minReturn1MAny: −25`; §6 gate text updated. |
| R-2 | Fence entry for Job 1 Phase B (C-2) | Sanction a DR-13 split: V2 pipeline in a new non-fenced module; fenced diff = one import + one dispatch line; flag read outside the fence. Decide whether the new module joins the §1 list at flip. |
| R-3 | Flip-PR version-lock scope (C-3) | `CALIBRATION_BUNDLE_VERSION` 1→2 + re-record; `ARCHETYPE_IDENTITY_VERSION` 3→4 + v4/v5 snapshot regen; accept recompile-on-next-deploy for every agent; add both to spec §8. |
| R-4 | Shared draft core mode (C-4) | Add `gameMode` to `chooseHumanPick`/`topArchetypeFit`; training pods pass `training`, live draft passes `tournament`; client hook passes `training`. Add path 7b to the V-5 census and test 10. |
| R-5 | `'mandate'` mode (V-3) | Remove from the enum (fail closed on it) or keep reserved with a contract test asserting no caller. |
| R-6 | R10 blast radius (C-5) | Accept exclusions as specified, or zero Trend Follower's `quality` 0.05 and Speculator's `dislocation` 0.10 so a missing fundamentals doc or < 200 bars does not exclude those two. |
| R-7 | V2 return shape (C-6) | `archetypeScore` = mode-blended final; `archetypeBaseScore` = base; cron persists the base as `arch_scores_v2`. |
| R-8 | Subset detection (C-8) | Callers pass `opts.universeSize` (from the doc); the scorer throws `axes_subset_unavailable` only when input length < universe size and any `axes` is missing. |
| R-9 | Tie semantics for rank-derived axes (V-10) | Accept list-order ties (deterministic, producer-owned), or derive `strength` from a tie-aware percentile of `technicalScore`. |
| R-10 | Axis rounding contract (C-9) | `deriveAxes` reads persisted-shape fields only; each axis rounded to 1 dp; parity test 12 asserts equality after rounding. |
| R-11 | Snapshot mechanism (C-7 / V-14) | Firestore ops doc (flips without deploy) or env var (deploy per flip); expiry via expire-on-write in the premarket run (no cron) or a console TTL; BUILD_RULES §6 count corrected to 39/40 in a founder-cited PR. |
| R-12 | Sector hygiene rule (V-11) | Null/`Unknown` is not a sector for breadth; fill phase only. |
| R-13 | Per-caller minimums and below-minimum paths (V-7) | Pin: decide 35 / 15 / 9 (with an explicit refuse-or-degrade below 9), scouting 10, agent boards 15, draft catalog 36, auto-commit 15, training/live 1, client 5; `insufficient_axis_coverage` emitted with per-axis null counts. |
| R-14 | Unknown archetype in V2 | Throw (fail closed), replacing v1's silent `analyst` fallback (`archetypeScoring.js:108`); `scouting-board.js:75-80` already refuses upstream. |
| R-15 | Reader change at flip (V-8) | `boardModel.js` renders an explicit "excluded" state with a reason line instead of the composite fallback; pod and training boards inherit it. |
| R-16 | Phase A before Phase B (C-8) | Allowed: the producer may write `axes` ahead of the scorer; the fallback derives over the full doc until then. |

---

**HARD STOP — Phase 0 complete.** No branch beyond this report, no code, no fenced file touched. Next: founder rulings R-1 … R-16, then a separate session for Job 1 (mandatory session split per BUILD_RULES).
