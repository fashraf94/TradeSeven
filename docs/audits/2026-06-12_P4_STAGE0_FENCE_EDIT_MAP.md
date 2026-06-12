# P4 — THE FENCE ENTRY: Stage 0 Verification Report + Fence-Edit Map

**Phase:** P4 — §7 engine parameterization (Spec §1.4; the build's only sanctioned fence entry)
**Branch:** `claude/gifted-turing-ysj2e3` · **HEAD:** `5b03257532b945afd5e802220b6ece970418674f` (merge of PR #489, = `origin/main` after fetch) · **Tree:** clean (`git status --porcelain` empty)
**Date:** June 12, 2026
**Writes performed:** none to the repo. One `git fetch origin main` (read-only investigation, recorded per BUILD_RULES §3 — it confirmed local `origin/main` was stale; remote main = this branch's HEAD exactly).
**Test baseline at HEAD:** full suite green — **109 files / 2,451 tests passed** (`npx vitest run`, this session, after `npm install` in the fresh container). The sanitizer tripwire's byte-equality and normalized-equality assertions are green at HEAD.

**Status: HARD STOP. Zero fenced bytes changed. Nothing below executes until the founder approves the Fence-Edit Map (§5), the calibration table (§8), and the smoke choreography (§14).**

---

## 1. Executive verdict table

| # | Question | Verdict |
|---|---|---|
| 1 | Are all 7 contract intake points real and where P3b left them? | **YES** — all 10 verification targets VERIFIED at HEAD, §4. Minor line drift only (`buildDeployRequest` now :211-228, was :214-233). |
| 2 | Can tiered mode stay byte-identical through every planned edit? | **YES, by construction** — every fenced edit is either a branch the tiered path never enters, an additive field tiered data never carries, or a pure re-export of identical values. §5 maps each edit to its preservation argument; the Commit-1 battery photographs today's behavior first. |
| 3 | Is the mode config a doc-config resurrection or a code config? | **Proposal: gameMode-keyed static config; the dead doc config stays dead** (it becomes an honest per-mode snapshot, still written-never-read). §6 argues why resurrection would *weaken* the invariant. Founder decides. |
| 4 | Do the hftConfig numbers change for flat6? | **Proposal: zero deltas at launch** — every knob is per-position physics that 7→6 positions doesn't move; the mode-awareness *mechanism* lands so future calibration is config, not code. §8 is the signature table. |
| 5 | Does PORTFOLIO_TOOL need a flat6 variant? | **NO-EDIT disposition** — tournament deploys are prescribed (no Haiku portfolio call), so the tool remains tiered-only; battery snapshots it unchanged. §5 item F. |
| 6 | Does the deploy-prompt file need flat6 text? | **NO-CALLER disposition** — prescribed deploys skip Sonnet/Haiku; flat6 deploy-prompt text has no caller until training mode. The **eval** prompt (mid-battle Haiku) *does* need the flat6 variant — §11. |
| 7 | Any blocker found? | **One pre-existing gap to price in:** the legacy client deploy sends **no auth header** (`agentDeploy.js:16-20`), so auth enforcement requires a companion client edit; and the production eval cron will score preview-smoke flat6 battles with *tiered* multipliers until the PR merges — the smoke is therefore scripted two-stage (§14). Neither blocks the phase. |
| 8 | Canonical contract register availability | **GAP, reported not reconstructed:** the P3a/P3b phase reports are not in the repo (`docs/` holds only the three June-10 audits). The register below (§3) is assembled from this task's text + the in-code contract markers, each anchored. Recommend committing both reports to `docs/audits/` in this PR. |

---

## 2. Preamble notes

- Reading completed per `docs/README.md` order: BUILD_RULES → Spec V1 (§0.6/§1.4/§4) → V2.1 §7 → both June-10 audits (anchors re-verified at HEAD; drift noted inline below) → V4 triage → Amendment-A context via spec citations.
- Every `file:line` in this report is **VERIFIED at HEAD `5b03257`** by my own read this session, except items marked **VERIFIED (subagent)** (client UI inventory, §4.9) and **ASSUMED** (explicitly marked).
- The June-10 audit anchors held remarkably well; the only drifts found: `buildDeployRequest` :214-233 → **:211-228**, and the eval cron's resolver comment block :397 → call at **:406-407**.

## 3. The 7-item contract register (frozen; provenance-marked)

P3a report §6 (as amended June 12) + P3b report §6 are the canonical register but are **not in the repo**. In-code markers pin items #1, #5, #6 explicitly; the rest are assembled from this task's slice list. No items added, none dropped.

| # | Item | In-code anchor |
|---|---|---|
| 1 | **Prescribed-portfolio entry path** — deploy accepts the P3b payload (`agentId, ownerOdUserId, groupId, gameMode, prescribedPortfolio, isCpu?`), skips Sonnet/Haiku, validates against flat6, creates the battle | `tournamentOrchestrator.js:204-228` ("contract items #1/#5") |
| 2 | **flat6 mode config** — shape 6 stocks / no crypto / flat 1×, threaded through validation/enrichment/creation/flatten/scoring/prompts/tool-schema/tier-iteration/hftConfig/client | Spec §1.4; V2.1 §7 |
| 3 | **Deploy auth** — Bearer `CRON_SECRET` honored + rate-limit exempt + ownership assertion `agent.ownerId === ownerOdUserId`; Firebase-token ownership for client calls | Spec §0.3; `tournamentOrchestrator.js:46-56` header |
| 4 | **Joint `gameMode`+`groupId` stamp** at creation — the resolver's contract: both fields together, never one | `tournamentAgentLedger.js:17-24` ("founder ruling B3"); `agent-evaluate.test.js:433` |
| 5 | **CPU/passive marker** (`isCpu`) stamped at deploy; its eval-side consumer (companion, non-fenced) | `tournamentCpu.js:26-27` ("P4 contract #5, not P3b's") |
| 6 | **Sanitizer collapse** — `sanitizeRuleText` exported canonically from `agentPromptAssembly.js`; the `agentEvalPromptAssembly.js` private twin REPLACED by that import (June-12 amendment); the P3 port becomes a re-export; tripwire retires, behavioral battery preserved | `tournamentPromptSanitizer.js:18-25` |
| 7 | **Scoring-constants collapse** (ratified Spec §0.6) — `agentScoring.js` re-exports the canonical `src` constants; cross-copy equality in the battery; battle-doc snapshot stays a snapshot | Spec §0.6; BUILD_RULES §4 |

Riders riding the phase (not contract items): **rider #6 deploy-time capture** (§12; board-time half live at `tournamentAgentBoards.js:4-8`), plus the three named companions (§13).

---

## 4. Intake-point verification (all VERIFIED at HEAD unless marked)

1. **Orchestrator deploy payload.** `buildDeployRequest` — `tournamentOrchestrator.js:211-228` (drift from P3b's :214-233). Body: `agentId, ownerOdUserId, groupId, gameMode: TOURNAMENT_GAME_MODE, prescribedPortfolio: symbols, isCpu?` (:219-226); headers `Authorization: Bearer ${CRON_SECRET}` (:215-218); URL `${base}/api/agent/decide` (:214). `TOURNAMENT_GAME_MODE = 'baggerbomb_tournament'` (`src/constants/leagueTournament.js:56`). The receiving endpoint today reads **only** `agentId` from the body (`decide.js:54`) — the entire intake is P4's to build.
2. **Resolver joint-stamp contract + static guard.** `resolveTournamentContext` — `tournamentAgentLedger.js:211-253`: strict in-memory `gameMode` (:212) and `groupId` (:213) checks ahead of any `await`; malformed stamps fail safe-and-loud (:214-217, :226-237). Static guard: `agent-evaluate.test.js:433-444` (discriminator-before-await source assertion). Cron call site: `agent-evaluate.js:406-407` with per-invocation group cache (:150).
3. **`TOURNAMENT_DEPLOY_ENABLED` + injection-covered live branch.** Module const `false` at `tournamentOrchestrator.js:87-89` ("P4 flips this to true in the same PR that lands the prescribed-portfolio entry path inside the fence — never earlier"); consumed via injectable `deployEnabled` default (:270), gated branch :295-299. Live branch test-covered with `deployEnabled: true` — `tournamentOrchestrator.test.js:378-443, :580+` (credentials, cooldown, pacing, budget-deferral, empty-portfolio loudness).
4. **Sanitizer tripwire result.** Port `tournamentPromptSanitizer.js:27-47`; canonical private original `agentPromptAssembly.js:245-265`; eval twin `agentEvalPromptAssembly.js:340-369` (comment-bearing, logic-identical). Tripwire `tournamentPromptSanitizer.test.js:50-63`: port↔deploy-original **byte-identical**, all three **normalized-identical** — **green at HEAD this session** (full-suite run). This is the behavior-preservation proof that makes the twin swap a provably-safe move.
5. **Dead battle-doc scoring config.** Written `agentBattleService.js:105-112`; repo-wide grep for `tierMultipliers|pointValues` finds **no reader** — only the write site (re-confirmed at HEAD). Still dead.
6. **`PORTFOLIO_TOOL`.** `agentToolSchema.js:38-125`; counts 2/2/2/3 + two crypto fields (:54-90).
7. **Tier-iteration sites.** `agentSwapExecution.js:328-341` (`['star','core','support']` at :331); `agentRiskManager.js:430-443` (:433); `agentBattleService.js:90-101` (creation copy); `agentScoring.js:43-58` (flatten, hardcoded tier+allocation); `decide.js:353-357, 481-487, 566-571`.
8. **hftConfig blocks.** `agentArchetypeConfig.js:26-204` — per archetype: momentum_chaser :35-47, analyst :66-78, diversifier :95-107, contrarian :122-134, degen :151-163, guardian :180-195 (forcedRotation disabled :184). Consumers: `agentRiskManager.js:150-162` (Knob A), :311-317 (Knob B), `agent-evaluate.js:890-895` (resolution + the live Gate-1 probe log), :914-926, :962-965, :1525 (Knob C).
9. **Client tier-bound UI inventory** — VERIFIED (subagent), spot-consistent with the June-10 audit: `AgentPortfolioStrip.jsx:1-2` (7-pill header comment), :7-11 (2x/1.5x/1x visual config), :92-96 (**data-driven counts** — fewer entries render fewer pills, no crash). `AgentBattleScreen.jsx:48-52` (hardcoded TIERS, `support.hasCrypto: true` :51), :54-58 (colors), :422-423 + :611 (thresholds/startingPrices/thresholdHistory reads), :617-623 (client re-score via `calculateAssetScoreV3`), :946 (crypto-slot = support last slot), :1081-1089 (inline badge points); **no reads of `battle.gameMode`/`groupId` anywhere**; a 2/2/2-no-crypto doc renders without crashing (blank third support row) but **lies** via 2x/1.5x tier visuals. `SwapModal.jsx:13-17, 190-191` — human game only, **not on the agent battle path**. Client scorer `baggerBombUtils.js:535-627`, tier resolution :581, client flatten :421-448.
10. **Constants copies.** Canonical `src/constants/baggerBombScoring.js:33-60` (zero-import, Node-clean by inspection); server mirror `agentScoring.js:13-35` — value-identical. The V4 cron is already converged to the canonical scorer (`baggerbomb-v4-daily-scores.js:24, :184` — the fix-pattern precedent for `api/`→`src/` imports). The consistency test still covers only `detectRedZone`/`isSwapLocked` (`agentScoring.consistency.test.js:15-24`) — and already imports the client module in the Node test env, pre-proving the import path the collapse needs.

Supporting verifications: claims-cron auth pattern `process-draft-claims.js:523-527`; `requireAuth` Firebase verification `authMiddleware.js:15-62`; `skipRateLimit` option `security.js:198-220`; legacy client deploy sends no auth header `src/services/agentDeploy.js:16-20`; cron inventory **38/40** (`vercel.json`, orchestrator entry :170-172) — **P4 adds zero**; no `isDev` flag exists on groups today (repo grep); group eligibility chokepoint `tournamentGroupService.js:94-104`; advancement composes round-2 groups `tournamentAdvancement.js:512-517` and restores CPU flags :475-482; board-time rider-#6 half `tournamentAgentBoards.js:96-111, 248-258, 266-291`.

---

## 5. THE FENCE-EDIT MAP

Every fenced edit of the phase. **Edits outside this map are violations even if correct.** Each row: exact change → contract item → tiered-preservation argument → re-validation.

### A. `api/agent/decide.js`

| Function / lines | Exact change | Item | Tiered preservation | Re-validation |
|---|---|---|---|---|
| handler entry :45-57 | Read full body `{agentId, ownerOdUserId, gameMode, groupId, prescribedPortfolio, isCpu}`. Detect internal caller (`Authorization === Bearer CRON_SECRET`) **before** `applySecurityMiddleware`; pass `skipRateLimit: isInternal`. Internal: require `ownerOdUserId`; after the agent read (:65-70) assert `agent.ownerId === ownerOdUserId` → 403 on mismatch. Client: `requireAuth` (Firebase token), assert `decoded.uid === agent.ownerId`; tournament fields (`gameMode/groupId/prescribedPortfolio/isCpu`) **forbidden from client callers** → 403. | 3 | Additive checks; a valid legacy request with a valid token flows the identical path. **Risk flagged:** enforcement breaks any client whose `ownerId` ≠ Firebase uid — companion client edit attaches the token (§13c); the smoke proves the legacy path deploys (§14). | New auth-matrix tests (no-auth 401, wrong-owner 403, CRON_SECRET + ownership ok, client + tournament fields 403, rate-limit exemption); battery green |
| new branch after :130 (tournament path) | `if (gameMode === TOURNAMENT_GAME_MODE)`: require `groupId` + `prescribedPortfolio` (joint-stamp contract — never one without the other); **skip** Sonnet (:181-217), Haiku (:262-347), watchlist fold (:139-161, :221-234); validate via new `validatePrescribedPortfolio` (exactly 6 unique symbols, all in universe, **none crypto**); enrich via hoisted `toAsset`; split 2/2/2 star/core/support in prescription order (labels only — all 1×); `opponent: null` (D4); thresholds from the same :584-592 math (tier-independent, unchanged); empty hotBench/monitoring (D5); call `createAgentBattle` with `{gameMode, groupId, isCpu, userPicksStance, doubleDownSymbols}`; skip first-message for CPUs (D11) | 1, 2, 4, 5 | Pure new branch — non-tournament requests cannot enter it (`gameMode` absent → identical flow byte-for-byte) | New prescribed-validation matrix (counts/unknown/dupes/crypto-rejection); stamp assertions; battery green |
| `validatePortfolio` :692-733 | **UNTOUCHED** (add `export` keyword only, for the battery) | 2 | Body byte-identical; export is additive | Commit-1 source snapshot → post-export behavioral photograph (same error strings) |
| `enrichPortfolio` :781-816 | Hoist inner `toAsset` (:787-803) to module scope; `enrichPortfolio` calls it — behavior-preserving refactor; prescribed path reuses it | 2 | Photograph test: identical output on fixed fixtures before/after | enrich battery |
| `buildFallbackPortfolio` :735-779 | **UNTOUCHED.** A bad prescription is a loud 4xx, never an improvised portfolio (orchestrator retries on its cooldown) | 1 | No change | Source snapshot |
| first message :634-638, :833-1015 | Gate call on `!isCpu` | 5 | Tiered deploys pass `isCpu` undefined → call unchanged | Unit test |

### B. `api/_utils/agentBattleService.js`

| Function / lines | Exact change | Item | Tiered preservation | Re-validation |
|---|---|---|---|---|
| `createAgentBattle` :42-202 | `options` gains `{gameMode = 'baggerbomb_agent', groupId = null, isCpu = false, tournamentContext = null}`. Doc: `gameMode: options.gameMode` (replacing the literal at :73 — default reproduces today's string exactly); stamp `groupId` + `isCpu: true` **only** when tournament (joint with gameMode — contract #4/#5); flat6 docs' per-asset copies carry `tierMultiplier: 1` (D2) and the scoring snapshot :105-112 records the mode's true values (still written-never-read); `agentContext` gains the rider-#6 deploy-time block when provided (§12) | 1, 2, 4, 5 | Default args reproduce today's doc byte-for-byte (Commit-1 doc-shape photograph via fake-db `add` capture proves it) | Doc-shape photograph (tiered) + flat6 doc-shape tests; resolver tests already lock the stamp semantics |

### C. `api/_utils/agentScoring.js`

| Function / lines | Exact change | Item | Tiered preservation | Re-validation |
|---|---|---|---|---|
| Constants :13-35 | Replace the three literal blocks with **re-exports of the canonical `src/constants/baggerBombScoring.js`** values (`export { CONVICTION_MULTIPLIERS, THRESHOLD_POINTS, THRESHOLD_MULTIPLIERS } from …`), per the V4-fix pattern; dependency-surface guard comment + never-mocked test import (BUILD_RULES §4) | 7 | Values verified identical today (§4.10) — re-export is value-identity; battery asserts cross-copy equality before *and* after | Constants-equality battery; consistency suite; Node-clean import guard |
| `calculateAssetScoreServer` :228-304 | Multiplier resolution (:253, :268) becomes `asset.tierMultiplier ?? (CONVICTION_MULTIPLIERS[asset.tier] \|\| CONVICTION_MULTIPLIERS.support)` (D2) | 2 | Tiered assets never carry `tierMultiplier` → expression value identical (battery photographs the full grid pre-change in Commit 1, asserts equality after) | calculateAssetScoreServer battery (§10), canonical-vs-server equality |
| `flattenPortfolioServer` :43-58 | **UNTOUCHED** (spread already carries `tierMultiplier` through: `{ ...asset, tier, … }` :48) | 2 | No change | Flatten parity battery |

### D. The two fenced prompt files

| File / lines | Exact change | Item | Tiered preservation | Re-validation |
|---|---|---|---|---|
| `agentPromptAssembly.js` :245 | `function` → `export function sanitizeRuleText` — **the only edit to this file** (flat6 deploy-prompt text: NO-CALLER disposition, §1 row 6) | 6 | Additive keyword; GAME RULES :19-25 / TIER RULES :167-173 byte-untouched (snapshot-locked in Commit 1) | Prompt-text snapshots; sanitizer behavioral battery now imports the canonical export |
| `agentEvalPromptAssembly.js` :340-369 | Delete the private twin; `import { sanitizeRuleText } from './agentPromptAssembly.js'` (no cycle: assembly never imports eval). `buildEvalSystemPrompt` :25+ gains a mode parameter — tiered callers get **today's text verbatim** (default), flat6 callers get the variant (§11); `buildPortfolioCSV` :902-919 mode-selects the flat CSV header/row shape | 2, 6 | Default-parameter text path snapshot-locked; twin replacement proven by the (green) normalized-equality tripwire before removal | Eval prompt snapshots (tiered verbatim + flat6 variant); tripwire retires **with a note**, behavioral battery preserved |

### E. `api/_utils/agentArchetypeConfig.js`

| Lines | Exact change | Item | Tiered preservation | Re-validation |
|---|---|---|---|---|
| :206-208 + new helper | `resolveHftConfig(archetypeConfig, gameMode)` — returns `archetypeConfig.hftConfigByMode?.[mode] ?? archetypeConfig.hftConfig`. With the zero-delta table (§8) **no archetype block changes at all**; the resolver is the calibration hook. Non-fenced cron threads `battle.gameMode` | 2 | hftConfig blocks :26-204 byte-untouched; resolver returns the same object for every mode today | Gate-1 differentiation fixtures (§9); existing keystone tests |

### F. No-edit dispositions (recorded so the map is exhaustive)

- `agentToolSchema.js` `PORTFOLIO_TOOL` :38-125 — **no edit** (prescribed deploys never call Haiku-portfolio); schema snapshot in battery. *(Not fenced, but on the contract register.)*
- `agentSwapExecution.js` — **one edit only**: `incomingAsset` (:249-257) gains `...(liveData.gameMode === TOURNAMENT_GAME_MODE ? { tierMultiplier: 1 } : {})` so swap-ins stay flat in flat6 (item 2; tiered docs never match the condition). `validateTradeDecision`, tier iteration :331, Guard-3 logic, bench mechanics: untouched.
- `agentRiskManager.js` — **no edit** (mode-awareness lives in the archetype-config resolver; `findPortfolioSlot` works on the 2/2/2 container as-is).
- `api/agent/decide.js` thresholds :584-592 — **unchanged math** (tier-independent, verified).
- `src/utils/baggerBombUtils.js` `calculateAssetScoreV3` :581 — *not fenced but bound by the byte-identical-port contract*: receives the **same** `asset.tierMultiplier ??` edit in the same slice, with canonical-vs-server equality asserted across the battery grid.

---

## 6. Mode-config representation proposal (D1 — founder decision)

**Proposed: a gameMode-keyed static config; the dead doc config stays dead.**

New zero-import module `src/constants/agentGameModes.js` (Node-clean by construction, importable both sides under BUILD_RULES §4):

```
MODE_CONFIGS = {
  baggerbomb_agent:      { tiers: star2/core2/support(2+1crypto), bench: 3+1crypto,
                           cryptoMandatory: true,  flatMultiplier: null, promptVariant: 'tiered' },
  baggerbomb_tournament: { tiers: star2/core2/support2 (labels only), bench: empty,
                           cryptoMandatory: false, flatMultiplier: 1.0,  promptVariant: 'flat6' },
}
resolveModeConfig(gameMode) → MODE_CONFIGS[gameMode] ?? MODE_CONFIGS.baggerbomb_agent
```

Fenced consumers **branch** on the resolved mode rather than generically interpolating config into today's code paths — wherever a function's output is text-bearing (validation error strings, prompt text), the tiered body is preserved **verbatim** and flat6 gets its own branch. The invariant is the shaping constraint: tiered mode doesn't "compile to" today's values — it **is** today's code.

**Against resurrecting the per-battle doc config** (`scoring.tierMultipliers`, :105-112): (a) it would make scoring **data-dependent on every legacy battle doc** — a corrupted/hand-edited doc would change behavior where today it's ignored, which *weakens* the invariant rather than proving it; (b) per-doc config can drift and can't be statically validated; the dead-config trap the June-10 audit flagged would be re-armed, live this time; (c) the ratified collapse direction (§0.6, "the battle-doc snapshot stays a snapshot") points the other way. The doc snapshot becomes honest per-mode provenance (flat6 docs record 1/1/1), still read by nothing.

**Container decision (D3):** flat6 keeps the `star/core/support` arrays as 2/2/2 **slot labels** (all 1×) rather than a flat array. Every tier iterator (`agentSwapExecution.js:331`, `agentRiskManager.js:433`, `flattenPortfolioServer`, eval loops, client pills) works unchanged; the alternative would touch every one of them. Flatness is a **multiplier** property (per-asset `tierMultiplier: 1`, D2), not a container property.

**Multiplier mechanism (D2):** per-asset `tierMultiplier` stamped at creation (and at swap-in), honored by a single additive expression in both scorers. Every scorer call site — eval cron, swap execution, `agent-daily-scores` nightly banking, client re-score — inherits flat behavior from the doc data with no signature changes anywhere. Tiered docs never carry the field → behavior identical by absence.

## 7. Scoring-constants collapse plan (contract #7)

1. Commit-1 battery asserts canonical (`src/constants/baggerBombScoring.js:33-60`) ≡ server mirror (`agentScoring.js:13-35`) value-by-value — green against untouched code (verified identical, §4.10).
2. Slice: `agentScoring.js` constants become re-exports of the canonical module (V4-fix pattern, `baggerbomb-v4-daily-scores.js:24` precedent). Fenced consumers keep their import path (`agentScoring.js`) — zero call-site churn.
3. Dependency-surface guard: the battery's import of `agentScoring.js` is the runtime guard (comment + never mocked, BUILD_RULES §4). The canonical module is zero-import, so the graph is Node-clean by construction; `agentScoring.consistency.test.js` already imports `src/utils/baggerBombUtils.js` in Node, pre-proving the wider path.
4. The battle-doc snapshot (:105-112) stays a snapshot (§6). The V4 cron is already converged. Remaining copy census after this slice: **canonical + dead snapshot. Zero live copies.**

## 8. hftConfig flat6 calibration table — **the founder's numbers to sign**

Mechanism lands (§5E); proposed launch values below. **Proposal: zero deltas.** Per-knob justification, one line each:

| Archetype | Knob | Tiered (today, verified) | flat6 (proposed) | Why no delta |
|---|---|---|---|---|
| momentum_chaser | forcedRotation | on; pct .0015 / 3 ticks / winner .0015 | same | Per-symbol stagnation physics; position count (7→6) doesn't move per-symbol thresholds |
| momentum_chaser | hurdleFloor | haiku .3 / stagnation .55 / default .3; benchPositive | same | ATR-margin quality bar is per-swap, mode-independent |
| momentum_chaser | swapWindow | cap 8 / 60min | same | Cap is a churn ceiling; one fewer position argues, weakly, for *lower* churn — not worth a speculative delta before live observation |
| analyst / diversifier / contrarian | all three | rotation on; pct .003 / 6 ticks; floors .4/.5; cap 4 / 60min | same | Identical reasoning; mid-band archetypes |
| degen | all three | rotation pct .001 / 3 ticks / winner .002; floors .2/.6; cap 12 / 60min | same | The archetype spread (degen 12 vs guardian 2) is the differentiation that matters; preserved exactly |
| guardian | all three | rotation **off**; floors .5; cap 2 / 120min | same | Disabled rotation carries over; most conservative profile unchanged |

One genuinely flat6-specific fact to note, not a knob: with no crypto and exclusivity filtering, the candidate pool is thinner — the **emptied-pool emergency skip** (designed behavior, P2) will fire more often; the Gate-1 observation checklist (§9) watches its frequency before any calibration move.

## 9. flat6 Gate-1 plan

**Fixtures/probes (in the flips slice):** unit fixtures asserting `resolveHftConfig` preserves archetype differentiation under `baggerbomb_tournament` (degen rotation-on/cap-12 vs guardian rotation-off/cap-2, etc. — the spirit of the original Gate-1); the existing live `[Gate1]` probe (`agent-evaluate.js:891-895`) is mode-agnostic and fires for tournament battles automatically — extended with the gameMode tag.

**First-live-battle observation checklist (smoke + first bracket):** (1) four battles' archetypes resolve distinctly in `[Gate1]` lines (the dev group's 3 CPUs field 3 distinct round-robin archetypes by construction — `cpuArchetypeForN`); (2) flat 1× confirmed: every eval's per-asset `tierMultiplier` = 1 in scoring breakdowns; (3) badge bonuses pay canonical 15/30/50 / −10/−20/−35 (flat bonuses were never tier-scaled — verified); (4) human-owned battle's swap behavior differentiates from CPU passivity; (5) emptied-pool skip frequency logged; (6) no `[TournamentLedger]` malformed-stamp warnings; (7) eval tick duration with 4 extra battles stays inside the 50s budget (deferral count). Items 4-7 complete on the first real bracket (the checklist's remainder, per the task).

## 10. The battery plan (Commit 1 — zero fence edits, green before anything lands)

Expands the June-10 P6.2 enumeration. One new file (e.g. `api/_utils/p4Equivalence.test.js`) + extensions:

1. **`calculateAssetScoreServer` battery:** full grid — direction {long, short} × tier {star, core, support, absent} × history {none, badge-laden max/min, partial} × {thresholdPriceChange supplied, null-fallback} × extremes {present, absent} — value snapshots **and** canonical-vs-server equality (closing the audit's coverage gap: today only redzone/swaplock are equality-tested).
2. **`flattenPortfolioServer` parity** vs client `flattenPortfolio` (tier/allocation/slotIndex attach, null-slot handling).
3. **Cross-copy constants equality:** canonical vs server mirror, value-by-value; battle-doc snapshot values asserted against canonical at the doc-shape photograph.
4. **Existing `detectRedZone`/`isSwapLocked` cases** — retained untouched.
5. **Prompt-text snapshots:** `buildStrategySystemPrompt` / `buildPortfolioSystemPrompt` / `buildEvalSystemPrompt` outputs on fixed inputs, GAME RULES / TIER RULES / SCORING RULES text captured **verbatim** (inline expected strings, not file snapshots — diff-readable).
6. **`createAgentBattle` doc-shape photograph:** fake-db `add` capture on a fixed agent fixture — every field including `gameMode: 'baggerbomb_agent'` literal and the :105-112 snapshot values.
7. **decide.js private functions** (`validatePortfolio`, `enrichPortfolio`, `buildFallbackPortfolio`): not exported today, so Commit 1 photographs them by **source-tripwire** (the sanitizer-test extraction pattern); the slice that adds `export` converts each to a behavioral photograph (error strings, output shapes) in the same commit. Recorded as the one place the before/after proof is source+diff rather than behavior+behavior.
8. **`PORTFOLIO_TOOL` schema snapshot** (deep-equal).
9. **Sanitizer behavioral battery** (existing) — unchanged in Commit 1.

Battery green at HEAD, then **green at every subsequent commit, no exceptions** — each slice runs the full suite; the final PR states the run results per commit.

## 11. Prompt-text plan (both fenced prompt files)

- **Tiered text: preserved verbatim, proven by §10.5 snapshots.** No tiered-mode prompt byte changes anywhere in the phase.
- **`agentPromptAssembly.js` (deploy prompts): no flat6 variant** — prescribed deploys make no model calls; "deploys never self-select in tournament mode" (BUILD_RULES §7). The flat6 deploy text question re-opens only with training mode (post-launch). Its sole P4 edit is the sanitizer export.
- **`agentEvalPromptAssembly.js` (eval prompts): real flat6 variant, mode-selected** via a defaulted parameter (tiered callers untouched): SCORING RULES block (:28-43) → flat version ("All positions score at 1.0× — no tiers"; threshold bonuses unchanged — they were never tier-scaled); TIER IMPACT AWARENESS (:74-77) → replaced by flat-portfolio framing (swap-cost symmetry); `buildPortfolioCSV` (:902-919) → drops/dashes the Tier column for flat6 so the model is never told a 2× slot exists; few-shot examples audited for tier mentions. The non-fenced cron passes the mode from `battle.gameMode`.
- Eval-side **tier framing is the one place flat6 text is load-bearing now** (flat6 battles hit the eval Haiku mid-battle); the flat6 variant lands in the mode-config slice with snapshot tests of its own.

## 12. Rider #6 deploy-time capture design (D10)

Board-time half (live): the Sonnet board call returns `userPicksReaction`; validated stance lines persist **awaited** on `agentBoards/{agentId}` as `userPicksStance` + `userPicksAtBoardTime` (`tournamentAgentBoards.js:96-111, 248-258, 266-291`).

**Deploy-time half (sibling shape):** the orchestrator (non-fenced) reads the agent's board doc during seat assembly (one read per agent, memoized per group) and adds to the deploy payload: `userPicksStance` (the board's lines, same shape) + `doubleDownSymbols` (prescribed six ∩ own player's current pick symbols — computed from the group doc it already holds). The fence entry persists both **on the battle doc at creation** under `agentContext.tournament = { userPicksStance, doubleDownSymbols, userPicksAtDeploy }` — **awaited by construction** (it rides `createAgentBattle`'s single `add`, the same atomic write as the battle itself; Amendment-A pattern A), **writer-readable** (P5 playback, P6 feeds, Voice Layer read it straight off the battle doc — no cross-doc time join, mirroring `userPicksAtBoardTime`'s rationale). Alternative (rejected): a Firestore board-read inside fenced `decide.js` — adds fenced I/O where a payload field does the job declaratively.

## 13. Companion non-fenced edits (same PR)

**(a) Dev-group exclusion** — what makes the gate flip mergeable. The dev seeders (`api/admin/seed-tournament-group.js`, `seed-tournament-bracket.js`) stamp `isDev: true` on groups **and brackets**; Friday advancement propagates `isDev` onto composed round-2+ groups (`tournamentAdvancement.js:512-517` region) so a dev bracket can never launder into production groups. `fetchEligibleGroupsByStatus` (`tournamentGroupService.js:94-104`) gains `{ includeDev = false }`; production dispatcher duties (cron tick) default-exclude; `run-duty.js` (admin-gated dev buttons) passes `includeDev: true`. Advancement's bracket query equally excludes dev brackets. **Scope note (D9):** exclusion covers orchestrator dispatcher duties only, per the task — nightly banking/claims/eval remain inclusive (no model spend, idempotent, and the smoke's composite day needs them); the cleanup plan (§14) retires the data. Without (a), merging the flip puts the production orchestrator to work on the founder's smoke groups Monday 7:30 ET, spending real model calls.

**(b) CPU/passive eval skip** (contract #5's consumer). In `processAgentBattle`: after scoring computation and before the risk layer (`agent-evaluate.js:870`), `if (battle.isCpu === true)` → persist `scoreUpdate` (the existing no-trigger early-exit pattern, cf. :1170/:1182), one quiet log, return. **Full passivity (D8):** no risk swaps, no trigger gate, no Haiku, no narrations/anticipations — scoring + threshold history + banking continue so the composite stays honest. Static-guard test in the agent-evaluate suite + a CPU-skip assertion (zero Haiku calls on an `isCpu` battle).

**(c) Minimum-correctness client pass.** Data-driven counts already hold (§4.9). Edits: `AgentBattleScreen.jsx` — tier visual bindings get a flat fallback keyed on `battle.gameMode === 'baggerbomb_tournament'` (TIERS allocation labels render '1x'/neutral; `hasCrypto` row suppressed for flat6; null-opponent guards per D4); inline badge values :1081-1089 re-pointed at the canonical constants (drift-class cleanup, value-identical today); `AgentPortfolioStrip.jsx` tier labels get the same mode-keyed flat fallback. `calculateAssetScoreV3:581` override edit per §5F. `SwapModal` untouched (not on the agent path). The full tournament battle view remains P7.

**(d)** (riding (a-c)) `src/services/agentDeploy.js` attaches the Firebase ID token (auth companion); orchestrator seat assembly adds the rider-#6 payload fields (§12) and threads nothing else — payload shape otherwise frozen.

## 14. Smoke choreography (founder-scripted) + cleanup

**Preconditions:** preview deployment of the P4 branch; preview env has `CRON_SECRET`, the admin secret, and `TOURNAMENT_DEPLOY_BASE_URL` pointed at the preview deployment itself (so fan-out targets the new code, not production). Founder signed the calibration table and this map.

**Stage A — preview, pre-merge (the machine's first breath):**
1. Seed a **dev** group via the bracket seeder (founder + 3 CPU seats — real system agents, deterministic boards; no synthetic refusal). Expect: group + bracket docs with `isDev: true`; 3 CPU agent docs exist (`cpu-agent-1..3`, distinct archetypes); CPU user boards committed.
2. Founder commits their own board from the dev screen. Expect: 4 boards, zero synthetic.
3. Run the **Monday duty** (run-duty, simulated clock if not a real Monday). Expect, in order: user draft resolves (forming→battle), 4 agent boards (1 Sonnet call + 3 deterministic), agent draft resolves, **24 held** in the ledger, then **real deploys execute** — 4 POSTs with `Bearer CRON_SECRET`, ≥20s pacing; 4 `agentBattles` docs **stamped** (`gameMode: 'baggerbomb_tournament'` + `groupId` jointly; `isCpu: true` on three), **prescribed** (each portfolio = exactly the drafted six, 2/2/2, no crypto, `tierMultiplier: 1` per asset, `opponent: null`), **ledger-confirmed** (all 24 `held`, zero stale reservations), rider-#6 block present on each battle doc. Duty marker set in the `sim:` namespace only.
4. Re-click the duty. Expect: idempotent no-op (`already_complete`); a second run with the real clock: `skippedExisting: 4`.
5. **Legacy-path proof:** founder deploys their casual agent from the Command Dashboard (token-attached client). Expect: tiered battle created exactly as before — **no** `groupId`, `gameMode: 'baggerbomb_agent'`, tiered multipliers.
6. **Production eval cron observation (pre-merge caveat, scripted honestly):** the production cron (shared Firestore) picks the stamped battles up on its next 15-minute tick — the tournament-conditional P2 paths (filtering, reservations, feed events) activate on real battles for the first time. **Expected pre-merge artifacts, accepted and bounded:** production code scores flat6 docs with tiered multipliers (dev-only data, retired by cleanup) and CPU battles are *not yet* passive (the skip merges with this PR) — watch one tick, confirm resolver lines + zero malformed-stamp warnings, then proceed.
7. **Auth matrix live:** curl the preview deploy endpoint — no auth → 401; client token for someone else's agent → 403; CRON_SECRET with wrong `ownerOdUserId` → 403; client call carrying `prescribedPortfolio` → 403.

**Stage B — post-merge composite day (production code, dev data):**
8. A flip (founder's pick, dev screen) → leg banked + feed event; a claim placed overnight-window + processed → roster/pool mutation; **nightly banking** (manual trigger) → day banked for the group; **ledger reconciliation** now reports **verified holders** instead of `unverifiable_holder` (battles exist to derive from); **CPU battles confirmed passive** — zero triggered evaluations/Haiku calls across an afternoon of ticks while scores still tick.
9. **Production orchestrator inertness:** Monday 7:30 ET tick (or next real morning): production cron logs show the dev group **excluded** — zero deploys attempted on it.

**Cleanup plan:** dev battles expire naturally at close (eval cron completes them) or are force-completed from the dev screen; group → concluded/retired status; bracket marked retired; ledger doc retires with the group (subcollection); `sim:` duty markers self-prune (14-day retention, namespaced — can never satisfy a real duty); CPU agent docs remain (reusable, by design); the founder's casual test battle completes normally. Production data tidy: nothing un-flagged left active.

This run is the Gate-1 live observation's first half (§9 items 1-3, 6-7); the checklist's remainder rides the first real bracket.

## 15. Build order (restating the non-negotiables against this map)

1. **Commit 1 — the battery** (§10), green against untouched fence code.
2. **Slices, one coherent commit each, battery green at every commit:** (i) constants collapse (§7) + scorer override (§5C) + client scorer twin edit; (ii) mode config + prescribed entry path + joint stamp + isCpu + rider #6 (§5A/B, §6, §12); (iii) auth (§5A row 1 + client token companion); (iv) sanitizer collapse (§5D); (v) eval prompt flat6 variant + hftConfig resolver (§5D/E).
3. **Final commit — the flips:** `TOURNAMENT_DEPLOY_ENABLED → true` (same PR, never earlier) + dev-group exclusion + CPU eval skip + client pass + the new flat6 test matrix (six stocks / no crypto / flat 1× / prescribed validation / auth matrix / stamp assertions / CPU-skip assertion).
4. `/code-review` at maximum effort, then the PR as **the fence-entry record**: per-file rationale mapped to contract items, battery results per commit, the calibration table as founder-signed, and the explicit note that **this is the first PR whose merge changes production behavior for real groups** — the gate opens; dev-group exclusion is what makes that safe. Zero new cron entries (38/40 untouched). One branch. Phase report as a file artifact.

## 16. Founder decision points (consolidated)

| # | Decision | Recommendation |
|---|---|---|
| D1 | Mode-config home | gameMode-keyed static config; doc config stays dead (§6) |
| D2 | Flat-multiplier mechanism | per-asset `tierMultiplier` override (§6) |
| D3 | flat6 container | keep 2/2/2 slot labels, all 1× (§6) |
| D4 | Embedded CPU opponent on tournament battles | **none** (`opponent: null`) + client null-guards; alternative: keep generating one (legacy screen prettier, but a fake opponent + ~11 price fetches per deploy) |
| D5 | flat6 bench/hotBench | empty at creation; the existing non-fenced eval hotBench refresh (ledger-filtered by P2) populates within a tick; alternative: board-remainder via payload |
| D6 | hftConfig flat6 values | **zero deltas** (§8) — yours to amend |
| D7 | Auth posture | hard enforcement in this PR; smoke proves the legacy path (token companion) |
| D8 | CPU passivity scope | full (no risk swaps either); scoring/banking continue |
| D9 | Dev-exclusion scope | dispatcher duties only; banking/claims stay inclusive |
| D10 | Rider #6 transport | stance + double-down overlap via orchestrator payload, persisted in `createAgentBattle`'s atomic write |
| D11 | First message on tournament deploys | humans yes, CPUs no |
| D12 | P3a/P3b reports | commit both to `docs/audits/` in this PR (closes the §1 row 8 gap) |

---

## 17. HARD STOP

Stage 0 complete. No fenced bytes changed; no repo writes of any kind; the only environment changes are `npm install` (container-local) and the recorded `git fetch`. The founder approves the Fence-Edit Map, the calibration table, and the smoke choreography — or redirects — before Commit 1 lands.
