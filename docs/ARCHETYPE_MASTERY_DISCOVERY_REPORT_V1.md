# Archetype Mastery / Training Ground — Discovery Audit V1

**Report:** `ARCHETYPE_MASTERY_DISCOVERY_REPORT_V1.md`  
**Audit date:** 2026-07-18 (task dated 2026-07-17)  
**Mode:** READ-ONLY DISCOVERY — no source files edited, no fixes, no fence contact.  
**Executor:** Claude Code (Opus 4.8)  
**Repo:** `fashraf94/TradeSeven`  
**HEAD:** `f9a84e50c1506e93b7eaa516d8f7a1de89aadb3d` (commit dated 2026-07-17; clean tree)  
**Branch:** `claude/archetype-mastery-discovery-audit-v1asgh`  
**Author:** Claude (architecture) — for founder review before spec drafting

> **HARD STOP after this report.** No design, spec, or implementation work has begun. Every architectural assumption below was verified against the live repo at the HEAD above. Where a prior spec (Keystone V1.4, Learning Architecture V1.3, Training Mode Spec V1.1) defined a field/behavior and the code differs, both are quoted as a first-class finding — the live repo is authoritative.

---

## Discovery-protocol compliance (BUILD_RULES §3)

- **`git fetch origin` ran as the first step** of this session (recorded per §3); HEAD `f9a84e50c1506e93b7eaa516d8f7a1de89aadb3d`, working tree clean, on the designated branch.
- **Read-only w.r.t. project state.** No working-tree source file was edited; no branch was created for fix work; the *only* file written is this report (the deliverable). Git history was read (`git log -S` / `git merge-base`) for the A4 backfill-cutover finding — permitted investigation per §3.
- **Every factual claim carries a `path/file.js:line` citation** and was read at that line in this session (VERIFIED). Inherited anchors from the audit prompt were re-verified and corrected where drifted (e.g., B3’s `rankingConfig.js` pointer, E2’s seat-storage premise).
- **Calibration fence (BUILD_RULES §1): files READ but NOT edited** — `api/agent/decide.js`, `api/_utils/agentSwapExecution.js`, `api/_utils/agentRiskManager.js`, `api/_utils/agentArchetypeConfig.js`, `api/_utils/agentBattleService.js`, `api/_utils/agentPromptAssembly.js`. **Not opened this audit:** `api/_utils/agentScoring.js`, `api/_utils/agentEvalPromptAssembly.js`. No fence file was modified; no fence behavior was changed from a non-fenced call site. (Note: `api/cron/agent-evaluate.js` is the *wrapped cron*, **not** a fence file — it is heavily cited here and is freely readable.)
- **Method.** The 21 items were each run through a two-stage harness: an independent discovery pass, then an **adversarial verification pass** that re-opened every load-bearing citation and, for enumeration items (A1/A4/E1/E4/D1), swept for missed call-sites/modes. The author additionally re-read the highest-leverage anchors personally: `buildSwapReceiptSource` (`agentRiskManager.js:525`), the banking gate (`tournamentBanking.js:361/390/397`), the L1 receipt/atom/dossier skeletons (`learningSchemas.js`), and the per-battle archetype stamp (`agentBattleService.js:158`).

---

## Executive verdict table

| # | Item | Verdict | One-line finding |
|---|---|---|---|
| A1 | Archetype + config version on every receipt | **PARTIAL** | Swap receipts carry the archetype **name** only for stagnation forced-rotation swaps (`source==="archetype"`); haiku/risk/guardrail/gameplan swaps carry `archetype:null`. The L1 learning receipt carries no archetype identity at all. Keystone §4.6 `preset` sub-field never shipped. |
| A2 | Agent leg isolated from user leg in stored scores | **CONFIRMED / PARTIAL** | A pure agent-leg score is recoverable **per-battle per-archetype** from `agentBattles.scoreState.currentScore` + `agentContext.archetype`. The `tournamentGroups` snapshot leg is real but owner-aggregated, not archetype-resolved. |
| A3 | Regime stamps at battle level | **REFUTED** | No regime field on any battle doc at creation or settlement. The two market-regime Firestore docs are overwrite-in-place singletons with no dated history to join against. |
| A4 | Source discriminator at all swap call sites | **CONFIRMED** | All 5 `executeSwapServer` sites persist `source` via 4 `buildSwapReceiptSource` spreads. Actual vocabulary diverges from the audit assumption. Source-tagging began commit `2abfa3ef` (2026-07-03) — older corpus is untagged. |
| B1 | agentProgression.js contents and consumers | **PARTIAL** | Games-played (not XP) keyed. Only Forge rule/bundle capacity is server-enforced (10/15/20 rules, flat 5 bundles). Exec-mode gating is dead; the 2/4/6 chat budget is client-display-only (server enforces flat 10). |
| B2 | Maturity stages (Fresh/Growing/Maturing/Veteran) | **PARTIAL** | Cosmetic only — derived 1:1 from the agentProgression level (+ a games=0 split), drives two UI strings, gates no mechanics. Code emits lowercase tokens + a 5th `none`. |
| B3 | Career Rank (Intern → Market Legend) | **CONFIRMED** | Real, account-wide (`tournamentRanks/{odUserId}.rp`), server-only, driven by weekly composite + placement. Fully independent of agent progression. (Audit’s `rankingConfig.js` pointer was wrong.) |
| B4 | Firestore attachment point for per-archetype mastery | **CONFIRMED** | No existing per-archetype persisted structure to mirror. A server-only collection (career-rank pattern) is the integrity-safe home; a user-doc field would be client-forgeable. `mastery` subcollections inherit default-deny. |
| C1 | Claim schema as merged | **NOT_FOUND (code)** | No L1 "claim" schema exists in code — the specced fields appear in neither the code nor the V1.3 architecture doc’s vocabulary. Only the receipt has a writer; the dossier/lesson layer is unbuilt. |
| C2 | Evidence atom schema as merged | **PARTIAL** | The atom skeleton is a minimal 8-field stub with **no writer** anywhere. It lacks every specced field and carries no archetype — joinable only via `battleId`/`agentId`. Opportunity-eligibility predicates exist but are wired into no live path. |
| C3 | Maturity tier state and promotion machinery | **NOT_FOUND** | No per-claim tier state, transitions, promotion thresholds, or claim-freeze/embargo mechanism in code — all doc-only. (No engagement coupling exists — correctly, since no promotion path exists to couple.) |
| C4 | Identity-clean vs drifted signal availability | **PARTIAL** | Some per-battle gate signals ARE persisted+queryable (`chatExchanges[].archetypeGate`, `controlEpochLog`), but archetype **drift detection does not exist** (dead `archetypeDrift` field) and no deterministic per-battle adherence score is computable from persisted data today. |
| D1 | Lean equip path and slot capacity | **CONFIRMED** | Single add-path chokepoint (`equip-lean.js`). Only cap is a flat `STANDING_LEANS_CAP = 2` + conflict-group exclusivity; no per-archetype/level cap. A level cap must enforce at BOTH the equip path and the battle-snapshot revalidation kernel. |
| D2 | Dial band configuration | **PARTIAL** | Band is a data-driven but **global, discrete 3-position enum** (measured/standard/aggressive → 0.7/1.0/1.3); no per-archetype band, no min/max/step. Single tick-time clamp point exists, but `archetype` is not a resolver parameter. |
| D3 | Playbook rule caps | **PARTIAL** | `FORGE_LIMITS.maxRulesPerBundle` (10/15/20) IS enforced. The separate `playbookSlots` (5/10/20) field is spec-only, enforced nowhere (its only consumer is dead code). |
| E1 | Settlement pipeline map and the XP hook point | **CONFIRMED** | No unified settlement — split across per-day banking, per-battle finalize, per-week advancement, (dark) training completion. The per-agentBattle immutable point / XP hook is `completeBattle` writing `status:"completed"` + `completedAt`. |
| E2 | P0 gate logic (pod stuck at Day 0) | **PARTIAL** | Gate is verbatim `status===BATTLE && players.length===GROUP_SIZE (4)`. But the audit’s premise is **REFUTED**: training CPU seats live *inside* `players[]` (`isCpu:true`), so a training pod has exactly 4 players and DOES satisfy the gate. The only blocker is the *status* half (never advancing to BATTLE). |
| E3 | Eval budget starvation | **CONFIRMED** | Starvation is real, but there is **no numeric call-count budget** — it is a shared 290s per-invocation TIME budget + a 34s per-call reservation, with fair-rotation ordering. Deferred/failed battles default to HOLD. |
| E4 | Mode inventory (every battle-creation flow) | **CONFIRMED** | All `agentBattles` created by `createAgentBattle` (2 sites in `decide.js`); tournament/training/CPU funnel through one. Base `battles` (V2/V3/V4) have no agents/receipts. Full mode×collection×scorer×receipts table produced. |
| E5 | Regime availability at battle creation | **CONFIRMED** | A `regimeAtCreation` stamp is feasible with **zero new API calls** — both `indexIntelligence` singleton docs are already read post-create by `generateFirstMessageOnDeploy` (except the CPU tournament path). |
| E6 | Post-battle surface inventory | **CONFIRMED** | Film Room (per-battle, reads `agentBattles/{id}`) is the natural Training-Report host; Evolution/RecordSheet is the cumulative-XP host. Receipts + evidence atoms are client-read-**blocked**; only the dossier is client-readable (owner-only). |

**Verdict tally:** CONFIRMED (whole/dominant) × 9 · PARTIAL × 8 · NOT_FOUND × 2 · REFUTED × 1 · (A1/A2/E2 are compound — see the section). **FLAGs raised:** 34 (1 × P1, 6 × P2, 27 × note). No P0 defects were introduced by this audit; the two standing P0s (pod-stuck, eval starvation) are confirmed-only in E2/E3 and remain out of scope.

---

## Per-item findings

### A1 — Archetype + config version on every receipt

**Verdict:** PARTIAL — Every swap receipt persisted onto `battle.trades[]` carries a config *proxy* (`entryPreset`, `hftKnobsSource:'archetype'`, and a `swapProvenance` version block) plus a `source` discriminator, so *some* config attribution is always present. But the archetype **name** is recorded on only ONE class of swap (stagnation forced-rotation, `source==='archetype'`); it is `null` on every discretionary/guardrail/risk/gameplan swap. The L1 learning receipt does **not** carry the archetype name at all (only `source` + a global integrity-mode flag). The Keystone V1.4 §4.6 `preset` sub-field never shipped inside the receipt-source object. All discovery citations were independently re-read and confirmed.

#### 1. Enumerated swap-receipt emission call sites — exactly 4 (matches the Gate-7 "exactly 4 spreads" lock)
Independently swept via grep `buildSwapReceiptSource\(` across the repo: exactly 4 production spreads exist (`api/cron/agent-evaluate.js:1347, 1906, 2166, 2817`); remaining hits are in `swapProvenance.js` (doc comments) and test files. All four build an `evaluationMetadata` object that `executeSwapServer` spreads verbatim onto the persisted `closedTrade` (`api/_utils/agentSwapExecution.js:261` — `...evaluationMetadata` inside the `closedTrade` literal), so these fields land on `battle.trades[]`.

| Call site (agent-evaluate.js) | swap class | `source` passed | `archetype` on receipt | `hftKnobsSource` | preset field | version block |
|---|---|---|---|---|---|---|
| `:1326` md / `:1347` build | risk-manager swap | `swapSource` = `'archetype'` if `reason==='stagnation'` else `'risk_manager'` | name only when `'archetype'`; else null | `'archetype'` | `entryPreset` `:1344` | `swapProvenance` `:1350` |
| `:1888` md / `:1906` build | autopilot executed Haiku swap | `swapSource` = `'haiku'`/`'guardrail'` | **null** (never `'archetype'`) | `'archetype'` | `entryPreset` `:1900` | `swapProvenance` `:1908` |
| `:2148` md / `:2166` build | co-pilot/manual PROPOSAL (launch-guarded) | literal `'haiku'` | **null** | `'archetype'` | `entryPreset` `:2159` | `swapProvenance` `:2168` |
| `:2811` md / `:2817` build | gameplan-meeting rotation | literal `'gameplan_meeting'` | **null** (value passed but discarded) | `'archetype'` | `entryPreset` `:2813` | `swapProvenance` `:2821` |

There are **no hold receipts** — a HOLD only increments `summary.held` (`api/cron/agent-evaluate.js:2183`), nothing is persisted (verified; the very next branch `:2185` also folds PROPOSAL into `summary.held`). No separate risk-manager emission object exists — the risk/guardrail/gameplan emissions are the 4 rows above.

#### 2. `buildSwapReceiptSource` records archetype ONLY for `source==='archetype'`; omits `preset`
```js
// api/_utils/agentRiskManager.js:525-531 (FENCE — read only)
export function buildSwapReceiptSource({ source, archetype }) {
  return { source,
    archetype: source === 'archetype' ? (archetype || null) : null,
    hftKnobsSource: 'archetype' };
}
```
Returns exactly three keys — no `preset`. This exact-three-keys shape is locked by test (`api/_utils/agentRiskManager.test.js:536`). Given the actual `source` values passed at the 4 sites:
- `swapSource` at `:1326` is `'archetype'` **only when `riskResult.reason === 'stagnation'`** (Knob A forced rotation); other risk reasons → `'risk_manager'` → **archetype null**.
- `:1888` `swapSource` is `'haiku'` or `'guardrail'` → **archetype null**.
- `:2166` literal `'haiku'` → **archetype null**.
- `:2817` passes `battle.agentContext?.archetype`, but `source` is `'gameplan_meeting'`, so the ternary **discards** the value → **archetype null**.

Net: the archetype NAME survives onto a receipt **only for stagnation forced-rotation swaps**. Every other swap class carries `archetype:null`.

#### 3. Config/version identifiers present on every (provenance-bearing) receipt
- `hftKnobsSource:'archetype'` — constant, present on all 4 (`agentRiskManager.js:529`).
- `entryPreset: battle.strategyPreset || 'balanced'` — the live physics preset, present on all 4 (`:1344/:1900/:2159/:2813`). This is where the spec's `preset` info actually lives (as a sibling field, not inside the source object).
- `swapProvenance` sibling (`api/_utils/swapProvenance.js:32-47`) nests `{ tempoDesired, tempoEffective, selectionSource, dialBandVersion, knobConfigVersion, suppressionReason? }`. `dialBandVersion`+`knobConfigVersion` are the genuine version stamps. **Caveat:** `buildSwapProvenance` returns `{}` when `provenance` is null/absent (`swapProvenance.js:33`), so pre-provenance paths carry no version block.

#### 4. Customization-layer receipts (leans / dial) do NOT record archetype-per-battle
- `api/agent/set-tempo-dial.js:87-93` writes `dials.tempo` (dotted merge) + `updatedAt` onto the **agent doc** (mutable current state). `previousTempo` is computed (`:87`) and returned (`:94`) but never persisted. No archetype field, no immutable event; overwrites in place.
- `api/agent/equip-lean.js:161` persists `{ adjustmentId, version, equippedAt: nowIso }` into `agent.standingLeans[]` (per-entry timestamp), plus `updatedAt` (`:169`). No archetype stamped per entry.
Neither writes a battle-keyed historical record, so "what config was live during battle X" is **not** reconstructable from these docs — only from the per-swap `swapProvenance` snapshot.

#### 5. L1 learning receipt (`captureReceipt.js` / `makeReceiptSkeleton`) — carries `source`, NOT archetype
`makeReceiptSkeleton` (`api/_utils/learning/learningSchemas.js:91`) has `source` (closed enum, `:116`) but **no `archetype` name field**. The only archetype-adjacent stamps live under `versions`: `archetypeIntegrityMode` (`:189`) and `archetypeVersion: null` (`:191`, "does not exist in the codebase yet"). `RECEIPT_SOURCES` = `['haiku','archetype','risk_manager','guardrail','gameplan_meeting']` (`learningEnums.js:18-24`) — a source class, not an archetype identity. The writer (`captureReceipt.js`) only threads `archetypeIntegrityMode` (`:321`) and hard-sets `archetypeVersion: null` (`:327`); it has no `archetype` parameter at all.
At the sole live capture site (`agent-evaluate.js:2022`, verified as the only production `captureSwapReceipt(` call in the repo), `source: swapSource` (`:2040`) and `archetypeIntegrityMode: ARCHETYPE_INTEGRITY_MODE` (`:2056`) are passed — and `ARCHETYPE_INTEGRITY_MODE` is a **global** flag `'observe'` (`src/config/featureFlags.js:490`), not per-archetype. `ctx.archetype` is in scope but is **never** passed into the learning receipt. So an L1 receipt cannot be attributed to `degen` vs `guardian`.

**Divergences:**
- **Spec §4.6 vs code — `preset` sub-field dropped.** Spec (`FORGE_ENFORCEMENT_KEYSTONE_SPEC_V1_4.md:522-528`): `receipt.swap = { ...existing, source, archetype /* ctx.archetype when source==='archetype' */, preset /* battle.strategyPreset */, hftKnobsSource }`. Code `buildSwapReceiptSource` (`agentRiskManager.js:525-531`) returns `{source, archetype, hftKnobsSource}` — **no `preset` key**. Info is not lost (it rides as the sibling `entryPreset`), but the receipt-source object diverges from the spec's four-key shape.
- **Spec §4.6 `source` vocabulary vs code enum (NEW — discovery missed).** Spec `:524` lists source example values `'archetype', 'risk_manager', 'guardrail', 'haiku_decision', 'gameplan_*'`. The shipped enum `RECEIPT_SOURCES` (`learningEnums.js:18-24`) and the actual values passed at the call sites use `'haiku'` (not `'haiku_decision'`) and `'gameplan_meeting'` (not `'gameplan_*'`). `'haiku_decision'` is instead the value of the sibling `exitReason`/`haikuSwapReason` field (`agent-evaluate.js:2161`), not `source`.
- **Spec intent vs practical coverage.** The spec's own gloss (`:525` `archetype: string|null, // ctx.archetype when source === 'archetype'`) matches the code, but means the archetype NAME is present on essentially one swap class only; the audit assumption "every receipt carries archetype" is REFUTED for the common (haiku/risk/guardrail/gameplan) cases.
- **L1 learning receipt carries no archetype identity** (only `source` + global `archetypeIntegrityMode`), diverging from the assumption that a settled outcome can be attributed to a specific archetype from the learning corpus.

**FLAGS:**
- FLAG `api/cron/agent-evaluate.js:2022` (P2) — L1 `captureSwapReceipt` is called **only** in the autopilot-executed-swap branch (confirmed the sole production call site). Risk-manager swaps (`:1347`), gameplan swaps (`:2817`), and proposals (`:2166`) produce a `trades[]` evaluationMetadata receipt but **no** L1 learning receipt. Any archetype-scoped mastery/lesson corpus built from `learningReceipts/` would omit forced-rotation and gameplan decisions entirely.
- FLAG `api/agent/set-tempo-dial.js:87` (note) — `previousTempo` is computed and returned but never persisted; dial history is a single mutable `dials.tempo` + `updatedAt`, so past dial config cannot be reconstructed from the agent doc (only from per-swap `swapProvenance` snapshots).
- FLAG `api/_utils/swapProvenance.js:33` (note) — when `provenance` is falsy, the version block is `{}`, i.e. a receipt can legitimately carry no `dialBandVersion`/`knobConfigVersion` at all; version presence is not guaranteed on every receipt.

---

### A2 — Agent leg isolated from user leg in stored scores

**Verdict:** CONFIRMED that a pure agent-leg score, free of the user-pick confound, is persisted and recoverable **per battle per archetype** from the `agentBattles` doc. PARTIAL at the settled `tournamentGroups` snapshot level: the agent leg there is real and separate from the user leg, but it is aggregated **per owner** across all that owner's battles, so it is not archetype-resolved in the group snapshot.

#### Two independent legs are persisted (not composite-only)

The dual-layer settlement writer stamps three distinct numbers per owner into the settled `tournamentGroups` day entry — user leg (`totalPoints`), agent leg (`agentPoints`), derived composite (`compositePoints`) — `api/_utils/tournamentBanking.js:311-319`:
```js
closeScores[player.odUserId] = {
  totalPoints,            // USER leg — sum over player.picks (+ droppedPicks)
  picks: pickEntries,
  agentPoints,            // AGENT leg — from fetchGroupAgentScores byOwner
  compositePoints: round2(computeComposite(agentPoints, totalPoints)),
};
```
The composite is `agentPoints + k*userPoints`, so the agent leg is not fused irreversibly — it is stored as its own field alongside the composite (`src/constants/leagueTournament.js:648-650`):
```js
export function computeComposite(agentPoints, userPoints) {
  return (agentPoints || 0) + TOURNAMENT_TUNING.USER_LAYER_K * (userPoints || 0);
}
```
From a settled group doc you read `closeScores[uid].agentPoints` directly — no need to invert the composite.

#### The agent leg is a pure agent-performance number (no user-pick input)

`agentPoints` is sourced by summing `scoreState.currentScore` over the owner's tournament `agentBattles` (`api/_utils/tournamentBanking.js:64-84`):
```js
.where('groupId', '==', groupId)
.select('gameMode', 'ownerId', 'scoreState.currentScore')
...
byOwner[battle.ownerId] = (byOwner[battle.ownerId] || 0) + (score || 0);
```
`scoreState.currentScore` is built entirely from the agent's OWN portfolio, never the user's picks (`api/cron/agent-evaluate.js:689-702`):
```js
const activeScore = assetScores.reduce((sum, s) => sum + s.totalPoints, 0);  // agent's own live positions
const bankedScore = (battle.trades || []).reduce((sum, t) =>                 // agent's departed positions
  sum + (Number.isFinite(t?.lockedPoints) ? t.lockedPoints : 0), 0);
const currentScore = activeScore + bankedScore + bankedBadgePoints;
'scoreState.currentScore': Math.round(currentScore * 100) / 100,
```
`assetScores` maps over `flatPortfolio`, which is the agent's own portfolio: `flatPortfolio = flattenPortfolioServer(battle.portfolio)` (`api/cron/agent-evaluate.js:531`), mapped at `:587`. No user-pick term appears in `currentScore`. The user's picks live on the separate `player.picks` array scored into `totalPoints` (`api/_utils/tournamentBanking.js:284`). The two legs are computed from disjoint inputs.

#### Per-archetype recoverability

Each `agentBattles` doc is single-archetype and carries both its archetype label and its own pure agent score:
- `api/_utils/agentBattleService.js:158` — `agentContext.archetype: agentData.archetype || 'unknown'`
- `api/_utils/agentBattleService.js:234-246` — `scoreState: { currentScore, activeScore, bankedScore, bankedBadgePoints, ... }`

So a pure agent-leg score **per battle per archetype** is directly recoverable from `agentBattles`: read the doc, take `scoreState.currentScore`, tag it with `agentContext.archetype`. This is the authoritative per-archetype source.

The group snapshot's `agentPoints`, by contrast, is `byOwner`-aggregated (`tournamentBanking.js:84` `+= score`), so if an owner ever fields more than one archetype in a group, the group-snapshot agent leg collapses them into one number. (It is also a carry-forward cumulative: on a failed or absent agent-battle read the prior snapshot's `agentPoints` is preserved rather than recomputed — `tournamentBanking.js:296-309`.) Per-archetype attribution must therefore come from `agentBattles`, not from `closeScores.agentPoints`.

#### Departed-position points attributed to the correct leg

- **Agent swaps (departed agent positions) → agent leg.** `api/_utils/agentSwapExecution.js:254` writes `lockedPoints` onto the closed-trade record in `trades[]`; `agent-evaluate.js:690-692` folds `trades[].lockedPoints` into `bankedScore` → `currentScore` → the agent leg. Correct leg.
- **User dropped picks (departed user positions) → user leg.** `tournamentBanking.js:180-183` adds `player.droppedPicks` into `scorablePicks`, and their score accrues into `playerTotal` → `totalPoints` (the user leg) at `tournamentBanking.js:284,295`. Correct leg.

Neither departed-points stream leaks across legs in stored data.

#### Other battle collections

The `battles` collection (BaggerBomb V4 head-to-head) stores `dayScoreData[role].activeScore` per role, where roles are `['creator', 'opponent']` (`api/cron/baggerbomb-v4-daily-scores.js:155,206-210`) — both agent legs, no user leg, so no confound there either; it is a different (PvP) mode, not the dual-layer tournament. No `battles`/`seasonX` writer was found that fuses a user leg into an agent score.

**Divergences:**
- Spec assumption says the agent leg is "separately recoverable from settled battle documents." At the settled **group** document (`tournamentGroups.dailyScores[dayN].closeScores[uid]`) the agent leg is separate from the user leg but is **owner-aggregated, not archetype-resolved** (`tournamentBanking.js:84`), with carry-forward on read failure (`:296-309`). The archetype-resolved pure agent score lives on the per-battle `agentBattles` doc (`scoreState.currentScore` + `agentContext.archetype`), which is the collection an XP/mastery-per-archetype reader must consume.

**FLAGS:** none.

---

### A3 — Regime stamps at battle level

**Verdict:** REFUTED for the core assumption — no market-regime identifier is written onto any battle document (agentBattles / tournamentGroups / season entries) at creation or settlement. PARTIAL on recoverability: regime is only *partially* recoverable, and never as a canonical battle-level market-regime stamp. The two Firestore market-regime records are **singletons overwritten in place** (no per-calendar-day history to join against); the only `battleId`-keyed regime labels are a sibling `battlePatterns/{battleId}.marketRegime` (a live singleton snapshot, agentBattles only) and a **per-stock, per-swap** `regime` field inside learning receipts (a different taxonomy and granularity).

---

**Sub-claim 1 — No regime field is written onto battle docs: CONFIRMED (assumption REFUTED).**
`createAgentBattle()` is the battle-doc writer; its body handles gameMode/groupId joint-stamping but references no regime/marketContext/indexIntelligence:
```
api/_utils/agentBattleService.js:55  export async function createAgentBattle(db, agentData, thresholds, startingPrices, options = {})
:62  const gameMode = options.gameMode || TIERED_GAME_MODE;   // only mode/groupId stamped
```
Battle completion (`completeBattle`, called at `agent-evaluate.js:152`) stamps no regime onto the battle either; the one regime-adjacent call writes to a separate subcollection (sub-claim 3).

**Sub-claim 2 — Persisted market-regime records are SINGLETONS; no deterministic date-join: CONFIRMED.**
`indexIntelligence/marketContext` is a fixed-ID doc rewritten every cron run with `regime`/`regimeDetail`/`volatilityRegime` and only an `updatedAt` server-timestamp — no `forDate`/date key, no history:
```
api/cron/compute-index-intelligence.js:859  const marketContextRef = db.collection('indexIntelligence').doc('marketContext');
:861  regime: regime.regime,   :862 regimeDetail: ...   :873 volatilityRegime,   :882 updatedAt: FieldValue.serverTimestamp(),
```
`indexIntelligence/dailyRegimeBrief` is also fixed-ID; it carries `forDate` but is overwritten daily (skips only if `forDate === today`), so it holds today's regime only:
```
api/cron/compute-daily-regime-brief.js:85  const briefRef = db.collection('indexIntelligence').doc('dailyRegimeBrief');
:91  if (existing.exists && existing.data()?.forDate === today) { ...skip... }
:204/:208  await briefRef.set({ ... forDate: today, ... });
```
Consequence: there is **no per-calendar-day regime document keyed by date**. A battle settled on day N cannot be deterministically joined to "the regime on day N" after the fact — the next run overwrites both singletons. Source-of-truth taxonomy `classifyRegime()` lives at `api/_utils/indexIntelligence.js:27`.

**Sub-claim 3 — The only regime captured near a battle at completion goes to `battlePatterns`, NOT the battle doc, via a live singleton read: CONFIRMED.**
`logBattlePattern()` reads the live `marketContext` singleton and writes `marketRegime` into `agents/{agentId}/battlePatterns/{battleId}` — a sibling record:
```
api/cron/agent-evaluate.js:154  logBattlePattern(battle.agentId, battle.id, battle).catch(...)   // after completeBattle
api/_utils/battlePatternLogger.js:23  const mcDoc = await db.collection('indexIntelligence').doc('marketContext').get();
:25  marketRegime = mcDoc.data().regime || 'unknown';
:60  marketRegime,   :63-65  db.collection('agents').doc(agentId).collection('battlePatterns').doc(battleId).set(pattern);
```
This yields a per-battle regime label keyed by `battleId` (defaulting `'unknown'`), but only for agentBattles reaching `completeBattle`, snapshotting whatever `marketContext.regime` is at completion time. It is not on the battle document and is absent for tournament/season battles that don't flow through this path.

**Sub-claim 4 — A per-stock, per-swap regime IS keyed by battleId in learning receipts, but different taxonomy/granularity: CONFIRMED.**
Phase-4 receipts are keyed `learningReceipts/{battleId}/receipts/{receiptId}` and store a `regime` predicate input for swapped-in/out symbols:
```
api/_utils/learning/captureReceipt.js:380-385  .collection('learningReceipts').doc(receipt.battleId).collection('receipts').doc(receiptId).set(receipt);
:111  regime: regime ?? null,        // per-stock regime (D3 chop input)
:248-249  symbolIn: extractPredicateInputs(raw.snapshotIn, raw.regimeIn, ...), symbolOut: ...(raw.regimeOut...)
```
This uses the **per-stock** taxonomy `directional_expansion | directional_contraction | choppy | distressed` from `classifyStockRegime()` (`api/_utils/agentRegimeClassifier.js:23-25,39-54`), NOT the market taxonomy. It exists only where a swap occurred and describes the *stock*, not the market/battle — so it cannot answer "did this archetype's edge appear only in trending *market* regimes" without extra plumbing.

**Sub-claim 5 — A per-day regime tag IS persisted for season entries, but in GCS (shadow logger), not on battles: CONFIRMED (peripheral).**
`season-daily-evaluate.js` fire-and-forget logs a `marketRegime` object per entry per day to the GCS `pipeline_decisions` stream, path-keyed by date:
```
api/cron/season-daily-evaluate.js:440-445  marketRegime: { vixLevel: null, spyTrend: categorizeSpyTrend(ctx?.benchmark), spyDailyReturn: ..., sectorVolatility: null }
api/_utils/shadowLogger.js:52  const filePath = `shadow/${stream}/${dateKey}/${eventId}.jsonl`;
```
A *third* taxonomy: SPY 5-day-return buckets `bullish | bearish | neutral` (`categorizeSpyTrend`, `season-daily-evaluate.js:37-47`), with VIX/sector hardcoded `null`. Training-pipeline data in object storage, not queryable per-battle Firestore state.

---

**Regime taxonomies actually persisted (source of truth / granularity):**
- Market regime (singleton, overwritten): `bull | correction | bear | recovery` — `indexIntelligence.js:27` (`classifyRegime`), written to `indexIntelligence/marketContext.regime`; plus `volatilityRegime` (`compute-index-intelligence.js:873`) and `yields.regime`.
- Per-stock regime (keyed by battleId inside receipts, per-swap): `directional_expansion | directional_contraction | choppy | distressed` — `agentRegimeClassifier.js:23-25`.
- Season shadow tag (per-entry-per-day, GCS): `bullish | bearish | neutral` — `season-daily-evaluate.js:37-47`.

**Divergences:**
- Assumption: "Battles are stamped with a market-regime identifier (at creation and/or settlement)." Code: no battle document carries any regime field at creation or settlement — `createAgentBattle` (`agentBattleService.js:55`) writes none; `completeBattle` stamps none. Nearest is sibling `battlePatterns/{battleId}.marketRegime` written post-completion, agentBattles only.
- Assumption implies regime is recoverable to regime-condition trial battles. Code: the two Firestore regime docs are overwrite-in-place singletons, so historical per-day recovery by date-join is not deterministic; only same-day reads are reliable.

**FLAGS:**
- FLAG `api/_utils/battlePatternLogger.js:21-29,60` — `battlePatterns.marketRegime` is a live read of the `indexIntelligence/marketContext` singleton at completion time, defaulting `'unknown'` on read failure. Because `marketContext` has no `forDate`, if the completion cron runs after the regime cron advances, the label may reflect a *later* market state than the battle window. No integrity check ties it to the battle's actual dates.
- FLAG `api/cron/compute-index-intelligence.js:859-883` & `api/cron/compute-daily-regime-brief.js:85,91,204` — market regime is stored only in overwrite-in-place singleton docs with no dated history collection; any feature needing "regime as of battle date" (regime-conditioned trial battles, archetype edge-by-regime attribution) has no persisted per-day source to join against.

---

### A4 — Source discriminator at all swap call sites

**Verdict:** CONFIRMED — every one of the 5 `executeSwapServer` call sites in `agent-evaluate.js` persists a `source` discriminator onto the `trades[]` receipt via a `buildSwapReceiptSource(...)` spread. The source vocabulary the audit item *assumed* (`haiku_decision`, `gameplan_*`) DIVERGES from the actual code enum. I independently re-read every cited line; all discovery citations are supported.

#### Sub-claim 1 — Enumerate every swap executor. CONFIRMED.
`executeSwapServer` (defined `api/_utils/agentSwapExecution.js:117`, FENCE) is the SOLE swap executor, imported once at `agent-evaluate.js:30`. A repo-wide grep confirms no other executor and no `executeSwapServer` call sites outside `agent-evaluate.js` (remaining `.js` hits are comments/tests; the codebase's own test asserts this at `agent-evaluate.test.js:571` — "no consumers outside the fenced module and this wrapped cron"). The 5 live call sites:

- **Site 1 — risk swap** `agent-evaluate.js:1388`. Metadata built `:1327`; source `:1347`.
- **Site 2 — haiku autopilot swap** `agent-evaluate.js:1943`. Metadata built `:1889`; source `:1906`.
- **Site 3 — approved proposal** `agent-evaluate.js:2594`. Passes `proposal.evaluationMetadata || {}` (`:2598`); source baked into the proposal at `:2166`.
- **Site 4 — expired copilot auto-exec** `agent-evaluate.js:2702`. Passes `proposal.evaluationMetadata || {}` (`:2706`); same proposal-baked source at `:2166`.
- **Site 5 — gameplan meeting swap** `agent-evaluate.js:2807`. Inline metadata `:2811`; source `:2817`.

So 4 `buildSwapReceiptSource(...)` spreads (`:1347, :1906, :2166, :2817`) cover all 5 executors — sites 3 & 4 share the single spread baked into the proposal at `:2166`. I confirmed via grep that these are the ONLY 4 spreads in the file (matches the codebase's own guard test at `agent-evaluate.test.js:408`).

Actual source vocabulary EMITTED (all hardcoded literals):
```
:1326  swapSource = riskResult.reason === 'stagnation' ? 'archetype' : 'risk_manager'
:1888  swapSource = haikuSwapReason === 'haiku_decision' ? 'haiku' : 'guardrail'
:2166  source: 'haiku'                 (proposal builder → sites 3 & 4)
:2817  source: 'gameplan_meeting'
```
These match the closed enum `RECEIPT_SOURCES = ['haiku','archetype','risk_manager','guardrail','gameplan_meeting']` (`learning/learningEnums.js:18-24`, re-read).

#### Sub-claim 2 — Discriminator is on the PERSISTED receipt. CONFIRMED.
`buildSwapReceiptSource` (`agentRiskManager.js:525-531`, FENCE, re-read) returns exactly `{source, archetype, hftKnobsSource}`; it is spread into each site's `evaluationMetadata`. In `executeSwapServer` (`agentSwapExecution.js`, FENCE), that object is spread onto the closed-trade record (the sole `closedTrade` constructor in the codebase, `:246`) and written in a Firestore transaction:
```
:261   ...evaluationMetadata,     // into closedTrade
:345   const trades = [...(liveData.trades||[]), closedTrade].slice(-50)
:353   trades,                    // in the updates object
:358   transaction.update(battleRef, updates)
```
So `source`/`archetype`/`hftKnobsSource` land on `battle.trades[]` in Firestore, not merely logs/memory. No key filtering between the spread and the write. No alternate persistence path: the only other `trades` write is the empty-array init at battle creation (`agentBattleService.js:207`).

#### Sub-claim 3 — Historical consistency (backfill usability). CONFIRMED, cutover 2026-07-03.
`git log -S buildSwapReceiptSource` shows the function was introduced in commit `2abfa3ef` (2026-07-03 18:21, "Merge PR #557 rule-library-archetype-scope"), which `git merge-base --is-ancestor` confirms IS an ancestor of HEAD. Therefore trades recorded **before 2026-07-03** carry NO `source`/`archetype`/`hftKnobsSource` keys. HEAD `f9a84e50` is dated **2026-07-17** (commit date; system "today" is 2026-07-18) — so ~2 weeks of corpus is source-tagged; older swaps are not classifiable and cannot be XP-backfilled by source without inference.

**Divergences:**
- The audit item's assumed source vocabulary `(archetype | risk_manager | guardrail | haiku_decision | gameplan_* | ...)` is WRONG on two members: (a) `'haiku_decision'` is NOT a source — it is an *exitReason* value (`RECEIPT_EXIT_REASONS`, `learningEnums.js:31`); the source literal is `'haiku'`. (b) `'gameplan_*'` is not a wildcard — the exact literal is `'gameplan_meeting'` (`agent-evaluate.js:2817`). Correct closed set is `['haiku','archetype','risk_manager','guardrail','gameplan_meeting']` (`learningEnums.js:18-24`).
- `receipt.archetype` is NON-NULL only when `source === 'archetype'` (`agentRiskManager.js:528`). For haiku/risk_manager/guardrail/gameplan_meeting swaps the receipt's `archetype` is `null`, so a per-archetype MASTERY reframe cannot read archetype off the receipt for those sources — it must recover it from `battle.agentContext.archetype`. Note the two archetype-source expressions differ: sites 1–3 pass `ctx.archetype`; site 5 passes `battle.agentContext?.archetype` (`:2817`) because `ctx` is out of scope in `handleGameplanMeeting`. `hftKnobsSource` is the constant `'archetype'` (`agentRiskManager.js:529`), unrelated to the agent's archetype.

**FLAGS:**
- `api/cron/agent-evaluate.js:2598` and `:2706` — sites 3 & 4 fall back to `proposal.evaluationMetadata || {}`. A proposal lacking `evaluationMetadata` (legacy/pre-`:2148` proposal doc) would execute and persist a swap with NO `source` key. Mitigated today because the proposal builder at `:2148-2173` always includes it and copilot/manual execution is launch-guarded (dormant), but it is a silent source-loss path if those modes activate against old proposal docs. (P2)
- Emit path is UNVALIDATED against the enum: `buildSwapReceiptSource` passes `source` through verbatim (`agentRiskManager.js:526-527`); `RECEIPT_SOURCES` gating exists ONLY in the L1 receipt validator (`learningValidators.js:57`, re-read: `inSet(receipt.source, RECEIPT_SOURCES, ...)`), NOT on the `trades[]` emit. Safe today only because all 4 call-site values are hardcoded literals; a future dynamic source string could persist unvalidated. (note)
- `receipt.archetype` is null unless `source==='archetype'`; per-archetype MASTERY must recover archetype from `battle.agentContext` for haiku/risk_manager/guardrail/gameplan swaps. (note)

---

### B1 — agentProgression.js contents and consumers

**Verdict:** PARTIAL — the module exists and is `gamesPlayed`-keyed (NOT XP-based; no XP field anywhere in it). Of the three level-gated behaviors the reframe assumes, only the Forge rule/bundle capacity is real server-enforced code, and it uses different numbers than the "5/10/20" assumption. Exec-mode gating is REFUTED (dead `features` flags + archived toggle); the per-battle 2/4/6 chat budget is client-display-only (server enforces flat 10).

#### 1. Inventory of `src/constants/agentProgression.js` (130 lines)

Three levels keyed on hard games thresholds; no XP.

`AGENT_LEVELS` (src/constants/agentProgression.js:4-50):
```js
rookie:  { minGames:0,  maxGames:4,        chatBudget:2, playbookSlots:5,
           features:{ autopilot:false, debate:false, gameplanMeeting:false, presets:true } }
starter: { minGames:5,  maxGames:14,       chatBudget:4, playbookSlots:10,
           features:{ autopilot:true,  debate:true,  gameplanMeeting:true,  presets:true } }
partner: { minGames:15, maxGames:Infinity, chatBudget:6, playbookSlots:20,
           features:{ autopilot:true,  debate:true,  gameplanMeeting:true,  presets:true } }
```

`FORGE_LIMITS` (src/constants/agentProgression.js:53-57) — `maxBundles` is a flat **5** at every level; `maxRulesPerBundle` is **10/15/20**, NOT the `playbookSlots` 5/10/20:
```js
rookie:  { maxBundles:5, maxRulesPerBundle:10 }
starter: { maxBundles:5, maxRulesPerBundle:15 }
partner: { maxBundles:5, maxRulesPerBundle:20 }
```

Exported functions:
- `getAgentLevel(gamesPlayed)` (:59-63): `>=15→'partner'; >=5→'starter'; else 'rookie'` — thresholds hard-coded here, duplicating `AGENT_LEVELS.minGames`.
- `getLevelConfig(gamesPlayed)` (:65-67): returns the `AGENT_LEVELS` entry.
- `getNextLevelInfo(gamesPlayed)` (:69-82): games-remaining + a hard-coded English `unlocks` array — two branches: rookie→starter = `['Autopilot mode','Debate mechanic','Gameplan meetings','10 Playbook slots','4 chat exchanges']`, starter→partner = `['20 Playbook slots','6 chat exchanges']`.
- `getLevelProgressPct(gamesPlayed=0)` (:88-94): rank-bar %, 100 at partner.
- `getQueuedRulesForPromotion(rules, newLevel)` (:110-129): uses `playbookSlots` as `maxSlots` to promote queued→active rules; preceded by a TODO (:96-100) "Wire this into the level-up notification flow." **Dead — no caller** (§2c).

#### 2. Read sites + what actually gates today

**(a) Exec modes Manual/Co-Pilot/Autopilot — REFUTED as a real gate.** The `features.autopilot/debate/gameplanMeeting` flags are **never read anywhere**: a grep for dotted `features.autopilot|features.debate|features.gameplanMeeting|levelConfig.features` returns zero hits (not even the definition, which is object-literal `autopilot: false`). The only exec-mode UI, src/components/Agent/ExecutionModeToggle.jsx, is archived — header (:1-12) states "auto-pilot only for launch… archived, do NOT delete" — and it hard-codes all three MODES (:19-23: autopilot/copilot/manual) with no level check. Agent level does not gate execution mode in live code.

**(b) Chat budget per battle 2/4/6 — client-display only; server enforces flat 10.** src/components/Agent/OpenChatPanel.jsx:37 computes `budget = getLevelConfig(gamesPlayed).chatBudget` and gates the send button client-side (:38 `budgetExhausted`, :51 early-return in `handleSend`). The server does NOT honor 2/4/6:
```js
// api/agent/chat.js:135-137
const MODE_BUDGET = {
  battle: { field: 'chatBudgetUsed', limit: 10 },
  review: { field: 'reviewBudgetUsed', limit: 5 },
};
```
Separately, the League-arena per-day ask budget is also a flat 10 (api/_utils/agentChatBudget.js:36 `AGENT_CHAT_DAILY_LIMIT = 10`, default limit in `readAgentChatBudget`/`chargeAgentChatBudget` :85,:103). So 2/4/6 is a cosmetic client cap only.

**(c) Playbook rule caps 5/10/20 — REFUTED as the enforced cap.** The real server-enforced cap is `FORGE_LIMITS.maxRulesPerBundle` = **10/15/20**:
```js
// src/services/forgeService.js:393-396
const level = getAgentLevel(agentData?.stats?.gamesPlayed || 0);
const limits = FORGE_LIMITS[level];
if (bundle.ruleIds.length >= limits.maxRulesPerBundle) {
  throw new Error(`Rule limit reached (${limits.maxRulesPerBundle} rules for ${level} level)...`);
```
Equipped-bundle count is checked transactionally against `maxBundles`=5 (api/agent/equip-bundle.js:107-115). The **5/10/20** `playbookSlots` number is consumed only by the dead `getQueuedRulesForPromotion`. So the "5/10/20 playbook slot" gate is not enforced anywhere live.

Net: the ONLY live server-side gate driven by this module is Forge bundle/rule capacity (`FORGE_LIMITS` via `getAgentLevel`), with maxBundles=5 (flat) / maxRulesPerBundle=10/15/20 — not the reframe's cited numbers.

#### 3. What writes/advances the level

No level string is ever stored; `gamesPlayed` is the only persisted quantity, and level is derived on every read via `getAgentLevel`. The single writer is api/cron/agent-evaluate.js:3185-3213 — on battle completion, when `disposition.updateAgentStats` is true, it computes `newGamesPlayed = (stats.gamesPlayed||0)+1` (:3187) and writes the whole `stats` object (wins/losses/draws/gamesPlayed/totalScore/avgScore/streaks) back to `agents/{agentId}` (:3203-3213). Trigger = battle evaluation/completion. Consolidation at api/agent/reflect.js:127-130 only *reads* `gamesPlayed % 5` to flag `pendingConsolidation`; it does not increment. Level-up is detected purely client-side by observing the derived level change (src/hooks/useAgent.js:43-62).

**Divergences:**
1. Reframe assumes level gates exec modes (Manual/Co-Pilot/Autopilot). Code: `features` flags are never read (grep: zero dotted accesses); toggle archived, auto-pilot-only for launch (ExecutionModeToggle.jsx:1-12). No gate.
2. Spec "chat budget 2/4/6 per battle." Code: `AGENT_LEVELS.chatBudget` 2/4/6 (agentProgression.js:10,25,40) is client-display only (OpenChatPanel.jsx:37-38); server limit is flat 10 (chat.js:136).
3. Spec "playbook rule caps 5/10/20." Code: enforced cap is `maxRulesPerBundle` 10/15/20 (agentProgression.js:54-56); the 5/10/20 `playbookSlots` feed only the dead `getQueuedRulesForPromotion`. `maxBundles` is flat 5 across all levels, so equip capacity is not level-scaled beyond rules-per-bundle.

**FLAGS:**
- FLAG src/constants/agentProgression.js:110 (TODO :96-100) — `getQueuedRulesForPromotion` is exported and documented as the level-up rule-promotion path but has zero external callers (grep hits only its own definition + comment); queued rules are never auto-promoted on level-up in live code.
- FLAG src/components/Agent/OpenChatPanel.jsx:37 vs api/agent/chat.js:136 — client shows a level-gated 2/4/6 chat budget while the server enforces flat 10; the client cap can block a user below what the server would allow (client/server drift).
- FLAG src/constants/agentProgression.js:60-62 vs :7,22,37 — `getAgentLevel` re-hard-codes the 5/15 thresholds separately from `AGENT_LEVELS.minGames`; two sources of truth that can silently drift.

---

### B2 — Maturity stages (Fresh / Growing / Maturing / Veteran)

**Verdict:** PARTIAL

Maturity stages exist but are a purely cosmetic construct. They are **derived 1:1 from the agentProgression level** (not a separate threshold system) and drive only two UI strings (`speech`, `deployText`). They gate no mechanics. The title-case four-word set the audit named does not exist verbatim: the code emits lowercase tokens and adds a 5th `'none'` state.

**Sub-claim 1 — WHERE COMPUTED (single site, UI hook): SUPPORTED.** `src/hooks/useAgent.js:64-71`. A `useMemo` derived entirely from `agent` presence, `gamesPlayed`, and `currentLevel` (which itself comes from `getAgentLevel`). Comment explicitly labels it "Backward-compatible".
```js
// Backward-compatible maturityStage (derived from level)
const maturityStage = useMemo(() => {
  if (!agent) return 'none';
  if (gamesPlayed === 0) return 'fresh';
  if (currentLevel === 'rookie') return 'growing';
  if (currentLevel === 'starter') return 'maturing';
  return 'veteran';
}, [agent, gamesPlayed, currentLevel]);
```
Repo-wide grep for `maturityStage`/`getMaturity` (excluding .md) returns exactly two files: this one and the ARCHIVED file below. No `getMaturity*` function exists: NOT_FOUND.

**Sub-claim 2 — WHAT IT GATES (nothing mechanical; two UI strings only): SUPPORTED.**
- `speech`: `src/hooks/useAgent.js:73-91` — a `switch(maturityStage)` returning flavor text (e.g. `'veteran'` → "Ready.").
- `deployText`: `src/hooks/useAgent.js:93-101` — a `switch(maturityStage)` returning "Deploy to BaggerBomb" / "Deploy — I know the playbook" / "Deploy".
Both plus the raw `maturityStage` are exported at `useAgent.js:203` (`maturityStage`), `:209` (`speech`), `:210` (`deployText`). Conclusion: maturity stages are UI-copy-only and gate no mechanics.

**Sub-claim 3 — THRESHOLDS (relabel of agentProgression, not a separate system): SUPPORTED.** Mechanic gating (chatBudget, playbookSlots, feature flags autopilot/debate/gameplanMeeting, FORGE_LIMITS) is keyed off the **level** at `src/constants/agentProgression.js:4-57` and computed by `getAgentLevel(gamesPlayed)` at `:59-63` (`>=15 → partner`, `>=5 → starter`, else `rookie`). Maturity uses the same bands, splitting `rookie` in two via a `gamesPlayed===0` special case:

| gamesPlayed | agentProgression level | maturityStage |
|---|---|---|
| (no agent) | — | `none` |
| 0 | rookie (minGames 0, maxGames 4) | `fresh` |
| 1–4 | rookie | `growing` |
| 5–14 | starter (minGames 5, maxGames 14) | `maturing` |
| ≥15 | partner (minGames 15) | `veteran` |

So maturity stages are **the same thresholds relabeled** (`agentProgression.js:60-62` vs `useAgent.js:67-70`), with one extra split at games=0. Not an independent threshold system.

**Divergences:**
- **Literal naming (audit-name vs code):** audit named "Fresh / Growing / Maturing / Veteran" (title case). Code emits lowercase `'fresh' | 'growing' | 'maturing' | 'veteran'` plus a 5th value `'none'` (`useAgent.js:66-70`). Title-case "Maturing"/"Fresh" as a maturity token appears nowhere.
- **"Veteran" collision — two unrelated systems:** agent maturity `'veteran'` (games-based, cosmetic) is distinct from the **user XP rank** "Veteran" at `src/services/battleTimer.js:268` (`determineRank`: `xp >= 500 → 'Veteran'`; ≥2000 Expert, ≥5000 Master, else Beginner). Different subsystem (user XP, not agent games) — must not be conflated.

**FLAGS:**
- (note) The raw `maturityStage` value (as opposed to derived `speech`/`deployText`) is read only in an ARCHIVED component — `buildScoutingReport` at `src/components/Agent/AgentDashboard.ARCHIVED.jsx:85-88` (branches on `'fresh'`/`'growing'`). In live code the raw stage is exported but effectively dead; only its two derived strings are consumed. Informational, no bug.
- (note) Name collision documented above: `battleTimer.js:268` user XP rank "Veteran" vs agent maturity `'veteran'`.

---

### B3 — Career Rank (Intern → Market Legend)

**Verdict:** CONFIRMED

Career Rank is a real, live, account-wide (per-`odUserId`) ladder driven by weekly tournament COMPOSITE performance + placement — fully independent of agent progression (AGENT_LEVELS / getAgentLevel / gamesPlayed). It is NOT the `rankingConfig.js`/`rankingHelpers.js` files named in the audit pointer — those are the unrelated stock peer-ranking/scanner system; the true reader/writer are `tournamentRank.js` + the pure schema functions in `leagueTournament.js`. All 16 load-bearing citations were personally re-opened and confirmed.

**Sub-claim 1 — The ladder (Intern..Market Legend, tier/name/floor).** CONFIRMED — the exact 7-tier RP-floor table, each entry `Object.freeze`d.
`src/constants/leagueTournament.js:724-732`
```js
export const RANK_TIERS = Object.freeze([
  Object.freeze({ tier: 1, name: 'Intern', floor: 0 }),
  Object.freeze({ tier: 2, name: 'Analyst', floor: 250 }),
  Object.freeze({ tier: 3, name: 'Associate', floor: 750 }),
  Object.freeze({ tier: 4, name: 'Strategist', floor: 1750 }),
  Object.freeze({ tier: 5, name: 'Desk Head', floor: 3500 }),
  Object.freeze({ tier: 6, name: 'Fund Manager', floor: 6500 }),
  Object.freeze({ tier: 7, name: 'Market Legend', floor: 11000 })]);
```
Tuning `RANK_TUNING` = `{ RP_PER_POINT: 1.0, PLACEMENT_BONUS: [100,66,33,0], HISTORY_CAP: 20 }` at `:736-741`. `tierForRp(rp)` = highest floor reached, `:760-767`.

**Sub-claim 2 — Where the state LIVES.** CONFIRMED. Collection `tournamentRanks` (`TOURNAMENT_RANKS_COLLECTION`, `src/constants/leagueTournament.js:614`), one doc per user, doc id = `odUserId` (dev-prefixed in dev) via `rankDocId()` at `:682-684`. Doc fields written by the writer at `api/_utils/tournamentRank.js:96-105`: `odUserId, displayName, isCpu, ...next` (which spreads `rp, tier, tierName, floorRp, peakRp`), `appliedGroups.{groupId}, history[], createdAt, updatedAt`. Load-bearing state field is `rp`, with permanent ratchet field `floorRp`. Firestore: authenticated read, `write: if false` (Admin-SDK-only), `firestore.rules:351-354`.

**Sub-claim 3 — What WRITES it.** CONFIRMED. Sole writer `api/_utils/tournamentRank.js` — `applyGroupWeekToRanks()` (`:53-121`) + sweep sibling `applyLockedGameToRanks()` (`:129-152`). Idempotent per (player, group-week) via `appliedGroups.{groupId}` guard (`:76`). Only caller is the Friday advancement side-effect `runWeekSideEffects()` in `api/_utils/tournamentAdvancement.js:411-441` — `applyLockedGameToRanks` at `:421`, `applyGroupWeekToRanks` at `:424`. RP math is the pure signed functions in `leagueTournament.js`: `computeRankBreakdown()` `:791-796` (`raw = weeklyComposite × RP_PER_POINT + PLACEMENT_BONUS[placement-1]; delta = raw>0 ? raw×guard : raw`), CPU-farm `cpuFarmGuard()` `:776-779`, ratchet `applyRankWeek()` `:813-824` (never below achieved floor, never below 0), CPU display-only `applyRankWeekFrozen()` `:835-845` (`floorRp` pinned 0 — bots never lock a tier, founder §7.1). Writer selects frozen-vs-ratchet by `isCpu` at `tournamentRank.js:84`.

**Sub-claim 4 — What READS it.** CONFIRMED. `subscribeRank(docId, cb)` reads `tournamentRanks` at `src/services/tournamentGroupService.js:362-368`. Consumed in `src/screens/LeagueParticipantView.jsx:97-100` (`subscribeRank(rankDocId(uid), setRankDoc)`). UI `src/components/Tournament/RankCard.jsx` subscribes at `:21`, renders `{rank.tierName} · {rank.rp} RP` at `:39`, floor/next/peak at `:50-54`, and history rows (`event.rpAfter`) at `:65-77`, via pure view-model `rankProgress(rank)` (`leagueTournament.js:855-873`, called at `RankCard.jsx:25`).

**Sub-claim 5 — Coupling to agent progression / derivation input.** CONFIRMED independent. Derivation input is `weeklyComposite` (locked weekly composite = `agentScore + k × userScore`, `computeComposite()` `leagueTournament.js:648-650`) plus `placement` (1..4) and `cpuOpponents` count — writer passes `compositeByPlayer` + `ranking` (`tournamentRank.js:70,:80`). It is NOT derived from games-played and does NOT touch `getAgentLevel`/`AGENT_LEVELS`/`FORGE_LIMITS`. Keyed on the human account (`odUserId`), account-wide — not per-archetype, not per-agent. CPU seats accrue a shown-but-frozen RP row but never ratchet a floor (`applyRankWeekFrozen`), so a bot can never permanently hold a tier.

**Divergences:** None material. The audit pointer named `rankingConfig.js`/`rankingHelpers.js`/season code as the Career Rank reader/writer; that is INACCURATE — those are the unrelated stock peer-ranking + scanner-badge system. No `careerRank`/`seasonPoints` field name exists; the actual load-bearing field is `rp` on `tournamentRanks/{odUserId}`.

**FLAGS:** None.

---

### B4 — Firestore attachment point for per-archetype mastery

**Verdict:** CONFIRMED (all three sub-questions answered against live code; one discovery citation anchor corrected)

---

#### 1. Current SHAPE of the USER doc

User docs are created client-side in `src/firebase/authService.js` — email signup (`signUp`) and Google first-login (`signInWithGoogle`) write identical shapes to `users/{uid}`.

- Top-level fields: `_v`, `auth{uid,email,createdAt,lastLoginAt}`, `profile{username,displayName,avatarUrl,bio}`, `stats{...}`, `settings`, `achievements[]`, `metadata`, `archived`, `updatedAt` (`src/firebase/authService.js:52-103`; `setDoc(doc(db,'users',user.uid),…)` at `:106`). Google variant writes the same shape (`:293-320`, `setDoc` at `:322`; stats block at `:307-311`).
- There is already a SINGLE GLOBAL user progression track under `stats` — NOT per-archetype:

```js
// src/firebase/authService.js:69-79
stats: { xp: 0, level: 1, rank: 'Beginner',
  wins: 0, losses: 0, totalBattles: 0,
  winStreak: 0, longestWinStreak: 0, totalXPEarned: 0 },
```

Only known subcollection on the user doc is `users/{uid}/signalDrops/{dropId}` (server-only; `firestore.rules:62-65`). No `mastery`, no archetype-keyed map anywhere on the user doc.

#### 2. Current SHAPE of the AGENT doc

Canonical agent doc created client-side by `createAgent()` in `src/services/agentService.js:93-137` (`addDoc(collection(db,AGENTS_COLLECTION), agentDoc)` at `:136`).

```js
// src/services/agentService.js:95-134 (abridged)
ownerId, name, archetype: agentData.archetype, archetypeDrift: null,
config{risk,concentration,momentum}, personality, avatarColors, primaryColor,
memory:[], consolidatedInsight:'', directives:[], activeRules:[],
equippedBundleIds:[], equippedWatchlistId/Name/At, starterKitCompleted:false,
stats:{wins,losses,gamesPlayed,totalScore,avgScore,currentStreak,bestStreak},
evolutionCycle:0, createdAt, updatedAt, lastDeployedAt:null
```

- `archetype` is a SINGLE SCALAR string (`agentService.js:98`), not a map. It is swapped in place by `change-archetype.js` via `txUpdateAgentSettings(tx, agentRef, { archetype, updatedAt: nowIso })` (`api/agent/change-archetype.js:110`), gated by a battle-lock (`:100`, throws `battle_active` if `agent.activeBattleId`). An agent embodies ONE archetype at a time — no per-archetype state is carried on the agent.
- Agent subcollections are `rules`, `bundles`, `battlePatterns` (`firestore.rules:158,187` and following), keyed by their own doc ids, NOT by archetype.

#### 3. Existing per-archetype-keyed persisted structure? — NONE

`byArchetype`/`perArchetype`/`[archetype]`/`mastery` grep hits appear ONLY in calibration/eval tooling and tests (in-memory analysis maps), never written to a `users/` or `agents/` Firestore doc. Customization bundles are per-agent (`agents/{id}/bundles/{bundleId}`), not archetype-keyed. **There is no existing `something.{archetypeId}` persisted map to mirror.** A `mastery.{archetypeId}` structure would be a new shape.

#### 4. Firestore rules posture for candidate attachment points

**users/{userId} doc (map field, e.g. `mastery.{archetype}`):**
```
// firestore.rules:82-89
allow read:   if request.auth != null;                              // any authed user
allow create: if request.auth != null && request.auth.uid == userId; // OWNER
allow update: if request.auth != null && request.auth.uid == userId; // OWNER-WRITABLE
allow delete: if false;
```
A mastery XP map placed directly on the user doc would be **client-writable by its owner** — the client could forge its own XP/level. The rules explicitly call out this anti-pattern for career rank:
```
// firestore.rules:343-344
// Career rank deliberately does NOT
// live on users/{uid} — that doc is owner-writable.
```
Career rank instead lives in a server-only collection (`tournamentRanks/{rankId}`: `allow write: if false`, `firestore.rules:351-354`; leaderboards `:346-349`). This is the precedent a competitive-integrity mastery track should mirror.

**agents/{agentId} doc (map field):**
```
// firestore.rules:149-152
allow update: if request.auth != null
   && resource.data.ownerId == request.auth.uid
   && request.resource.data.diff(resource.data).affectedKeys()
      .hasOnly(['directives','lastViewedEvolutionCycle','starterKitCompleted','updatedAt']);
```
A new top-level `mastery` field on the agent doc is NOT in this allowlist, so a client `update` touching it is **rejected** — only the Admin SDK could write it. Integrity-safe by construction, but it ties mastery to the agent (single-archetype, and destroyed if the agent is deleted — owner delete allowed at `:153-154`) rather than to the durable per-user identity.

**NEW subcollection under users/{uid}/… or agents/{id}/…:**
Neither `users/{userId}` nor `agents/{agentId}` sits under a permissive multi-segment wildcard. The only `{document=**}` matches are `tournamentGroups/{groupId}/{document=**}` (`firestore.rules:324-327`, read-allowed / write-false) and the terminal default-deny `match /{document=**}` (`firestore.rules:716-718`, read+write false). A brand-new subcollection such as `users/{uid}/mastery/{archetypeId}` or `agents/{id}/mastery/{archetypeId}` would **inherit DEFAULT-DENY** (no client read/write) until an explicit block is added; Admin SDK writes bypass rules regardless. This mirrors the L1 learning collections (`learningReceipts`/`learningEvidence`, `firestore.rules:695-705`, all `if false`).

**Summary of attachment-point postures:**
| Candidate | Client write? | Integrity |
|---|---|---|
| `users/{uid}.mastery.{arch}` (field) | YES — owner-writable (`:86-87`) | UNSAFE / forgeable |
| `agents/{id}.mastery.{arch}` (field) | NO — blocked by affectedKeys allowlist (`:151-152`) | server-only, but tied to a single agent |
| `users/{uid}/mastery/{arch}` (subcoll) | NO — default-deny (`:716-718`) | server-only by default |
| `agents/{id}/mastery/{arch}` (subcoll) | NO — default-deny (`:716-718`) | server-only by default |
| Dedicated top-level coll (rank-style) | NO if `write:false` (mirror `:351-354`) | server-only; matches career-rank precedent |

**Divergences:** None between a spec and code (no mastery spec exists in code). The one design-relevant tension: the existing `users/{uid}.stats.{xp,level,rank}` global progression (`authService.js:69-79`) IS owner-writable under `firestore.rules:82-89`, i.e. already client-forgeable — a mastery track added as a sibling user field would inherit that same weakness, contradicting the server-only posture the rules explicitly chose for career rank/leaderboards.

**FLAGS:**
- FLAG (do-not-fix, pre-existing) `firestore.rules:287-291`: `match /drafts/{draftId}` grants `allow update: if request.auth != null` (`:290`) with NO ownership predicate — ANY authenticated user can update ANY draft doc. Free-agency / waiver flows execute by client-side `updateDoc(doc(db,'drafts',draftId), …)` (e.g. `src/services/draftService.js:295`), so this open-write rule is the "known free-agency wildcard-rule vulnerability." It does NOT sit above `users/` or `agents/`, so it does not contaminate the mastery candidate paths. The scoped `drafts/{draftId}/claims/{claimId}` subcollection (`:294-302`) IS ownership-checked; the parent-doc update is not.
- FLAG (design risk, not a code bug) `src/firebase/authService.js:69-79` + `firestore.rules:82-89`: existing `users/{uid}.stats.xp/level/rank` is owner-writable and therefore client-forgeable; any per-archetype mastery attached as a user-doc field inherits this. Recorded per rule 1 (report, do not change).

---

### C1 — Claim schema as merged

**Verdict:** NOT_FOUND (code) for a "claim" object with the specced fields. There is **no `claim` schema in the L1 learning code at all** — not in `learningSchemas.js` and not anywhere under `api/_utils/learning/`. The as-merged persisted shapes are receipt / evidence-atom / dossier / calibration skeletons; only the **receipt** has a live writer. The eight specced fields (`subject, condition, behavior, comparator, outcome, horizon, scope, proposedIntervention`) appear as a coherent claim shape in **neither the code nor the V1.3 architecture doc** (the doc uses `hypothesis`/`compilation`/`fingerprint` vocabulary). All citations below were personally re-opened and confirmed.

#### 1. The as-merged persisted shapes (learningSchemas.js)
The module header states which collections have writers:
```
// learningReceipts/{battleId}/receipts/{receiptId}  raw ... (WRITTEN in Phase 4, raw only)   [:22]
// learningEvidence/{agentId}/atoms/{atomId}         schema only — NO writer this phase        [:23]
// learningDossiers/{agentId}                        schema only — NO writer this phase        [:24]
```
- `makeReceiptSkeleton()` — `learningSchemas.js:91`. Top-level keys (`:92-202`): `schemaVersion, barBasisTableVersion, capturedAt, evidenceClass, agentId, battleId, battleDay, timestamp, receiptSeq, symbolIn, symbolOut, source, exitReason, haikuSwapReason, resolvedTier, resolvedSlotIndex, entryMark, entryATR, entryAtrSource, guardrailReplay{}, predicateInputs{}, predicateClassification{}, predicateProvenance{}, swapContext{}, versions{}, dataQuality{nullFlags:[]}`. **None of `subject/condition/behavior/comparator/outcome/horizon/scope/proposedIntervention`.** Module contract forbids outcome-derived fields ("the receipt carries NO outcome-derived / estimator fields", `:6-13`).
- `makeEvidenceAtomSkeleton()` — `learningSchemas.js:208-222`: `schemaVersion, atomId, agentId, battleId, receiptSeq, detector, classLabel, createdAt`. No claim fields.
- `makeDossierSkeleton()` — `learningSchemas.js:227-236`: `schemaVersion, agentId, userId, lessons:[], updatedAt`. `lessons: []` with "populated in Phase B from promoted evidence; empty shape now" (`:232`). No claim fields.

#### 2. Field-by-field grep (whole repo)
- `proposedIntervention` — **0 hits repo-wide** (re-verified).
- `regimeClasses` — **0 hits repo-wide** (re-verified).
- `behavior` — in `api/_utils/learning/` only inside comments ("byte-identical behavior", captureReceipt.js `:99, :155, :246`), never a field.
- `comparator` — not in any learning schema; live hits are unrelated sort comparators elsewhere.
- `outcome` — the receipt carries only `exitReason` (closed enum, `learningSchemas.js:117`), no `outcome` field.
- `subject / horizon / scope` — none is a field on any persisted learning object.

#### 3. The `scope` token in learning code is not a claim field
The only `scope` in `api/_utils/learning/` is the **D3 counting-scope** enum — an injected counting mode, unrelated to a claim's scope:
```
// ── D3 counting scope (ANNEX A4 — injected; default is same-agent, same-battle) ─
export const D3_COUNTING_SCOPES = Object.freeze({
  SAME_AGENT_SAME_BATTLE: 'same_agent_same_battle', // DEFAULT
  SAME_AGENT_GLOBAL: 'same_agent_global', ...
});                                                   // detectorClassifiers.js:45-49
```

#### 4. Storage paths + every writer
- **Receipts** → `learningReceipts/{battleId}/receipts/{receiptId}`. Sole writer: `captureReceipt.js:380-385` (`.collection('learningReceipts').doc(battleId).collection('receipts').doc(receiptId).set(receipt)`). Sole production import: `api/cron/agent-evaluate.js:75` (`import { captureSwapReceipt, ... }`), gated dark behind `LEARNING_L1_CAPTURE_ENABLED` (`agent-evaluate.js:72-75`).
- **Dossiers / Evidence atoms / Calibration** → **NO writer.** Firestore locks all four collections to Admin SDK: `learningDossiers` client-read-owner-only / `write: if false` (`firestore.rules:687-691`); `learningEvidence` read+write `false` (`:695-698`); `learningReceipts` read+write `false` (`:702-705`); `learningCalibration` read+write `false` (`:708-711`).

#### 5. Would adding an archetype dimension to `scope` be additive?
**Additive — nothing consumes a claim/dossier `.scope` today.** There is no persisted `scope` field to extend; an archetype dimension would be a greenfield addition to the not-yet-written dossier/lesson shape. The doc already anticipates archetype scoping: the dossier carries `archetypeAtCreation` and the fingerprint includes `archetype` (`doc:94-95`).

**Divergences:**
- Spec (audit item) vs doc vs code: the audit's claim-field list matches **no artifact in the repo**. The code has no claim schema; the V1.3 doc speaks in `hypothesis`/`compilation`/`fingerprint` — e.g. `fingerprint, // target+params+scope+condition+archetype (§9.5)` (`doc:95`). Even the doc's `scope` is polymorphic and never a `regimeClasses|global` enum: on the trial primitive it is an **object of count bounds**, `scope: { minTriggeredOpportunities: 8, minEligibleOpportunities: 12, minBattles: 6, maxBattles: 20, maxCalendarDays: 30 }` (`doc:178-179`). The "claim" as a persisted typed record does not exist as-merged.
- Doc says the receipt is "WRITTEN in Phase 4" (`learningSchemas.js:22`) — confirmed via the captureReceipt writer. But the dossier, where any claim/lesson would live, is `lessons: []` with no writer (`learningSchemas.js:232`), so the entire claim/lesson layer is unbuilt.

**FLAGS:**
- None (read-only; no bug). Advisory for the reframe: the archetype-scope addendum cannot "target the as-merged claim schema" because no claim schema is merged — the only merged, writer-backed shape is `makeReceiptSkeleton` (receipts), which carries `agentId` (archetype-resolvable) but no `scope`. Any archetype-scope work lands in the still-unwritten dossier/lesson (Phase B).

---

### C2 — Evidence atom schema as merged

**Verdict:** PARTIAL

The evidence-atom skeleton is REAL and present, but it is a minimal 8-field stub that does NOT contain the fields the audit item enumerates; there is NO writer anywhere in the repo (so the "persisted atom shape" is aspirational); and neither the atom nor its source receipt carries `archetype` directly — it is only joinable via `battleId`/`agentId`. The only detector opportunity-eligibility predicates that exist are pure classifiers in `detectorClassifiers.js`; the D3 opportunity predicate is defined but wired into NO live capture path (test/fixtures only). All discovery citations were independently re-read and are supported.

---

**Sub-claim 1 — The exact atom skeleton factory. REFUTED as described (the rich shape does not exist).**

`makeEvidenceAtomSkeleton` at `api/_utils/learning/learningSchemas.js:208-222`, explicitly "SCHEMA ONLY (no writer this phase)" (`learningSchemas.js:205`). Verified full shape (8 keys):

```js
// learningSchemas.js:208
export function makeEvidenceAtomSkeleton(overrides = {}) {
  return {
    schemaVersion, atomId, agentId, battleId, receiptSeq,
    detector,    // 'D1' | 'D2' | 'D3'
    classLabel,  // the CLASS from a Phase-B classifier run (not written in L1)
    createdAt,
    // NOTE: no estimate/statistic/number fields — Phase-B estimator outputs
  };
}
```

NONE of the audit item's proposed fields exist: `opportunityDef`, `independenceKey`, `partition (discovery|confirmation)`, `exposureSource`, `triggered`, `direction`, `effectSize`, `dataQuality`, `regime`, `symbol` are all absent. The header at `learningSchemas.js:206-207` states an atom "requires a CLASSIFICATION (which requires the estimator — OUT of L1 scope)"; the guard test `learningSchemas.test.js:72-79` asserts the atom is shape-only and that `estimate|statistic|mpe|regret|score` do NOT appear in its JSON. `receiptSeq` "links back to the source receipt's ordering" (`learningSchemas.js:214`) — a thin link-back stub, not the rich opportunity record described.

**Sub-claim 2 — Does a WRITER exist? NOT_FOUND (confirmed no writer).**

A repo-wide grep for `makeEvidenceAtomSkeleton` / `learningEvidence` returns ONLY: the factory (`learningSchemas.js:208`), its collection-map comment (`learningSchemas.js:23`, "schema only — NO writer this phase"), the schemas unit test (`learningSchemas.test.js:7,73`), the firestore-rules match block (`firestore.rules:695`), and the rules-denial test (`test/rules/learningDenials.rules.mjs:40,114,116`). No `.set`/`.doc(...).create`/`collection('learningEvidence')` production writer exists. The Phase-4 writer `captureReceipt.js` writes ONLY `learningReceipts/{battleId}/receipts/{receiptId}` (raw decision records; `buildRawReceipt` → `makeReceiptSkeleton`, `captureReceipt.js:242-333`), never atoms. Persisted atom shape is aspirational — a stable target for a Phase-B writer that does not exist yet.

**Sub-claim 3 — Does the atom (or source receipt) carry archetype, or is it joinable? PARTIAL — joinable only.**

The atom carries `agentId`, `battleId`, `receiptSeq` (`learningSchemas.js:212-214`) but NO archetype field. The SOURCE receipt (`makeReceiptSkeleton`, `learningSchemas.js:91-203`; live writer `buildRawReceipt`, `captureReceipt.js:242-333`) likewise carries NO archetype name. Its only archetype-adjacent fields live in the `versions` block:
- `archetypeIntegrityMode` — the one live version stamp, written at `captureReceipt.js:321` as `raw.archetypeIntegrityMode ?? null` (schema `learningSchemas.js:189`).
- `archetypeVersion: null` — hardcoded null, "do not exist in the codebase yet" (`captureReceipt.js:319-320,327`; schema `learningSchemas.js:191`).

So the per-agent archetype identity is NOT persisted on either doc; it is recoverable only by JOINING on `agentId`/`battleId` out to the agent/battle docs. This is the seam where archetype gating would attach — currently a join, not a field read.

**Sub-claim 4 — Where is the eligibility predicate evaluated? file:line, and NOT wired for atoms.**

Opportunity-eligibility predicates live in `detectorClassifiers.js`. The D3 opportunity predicate `classifyD3Predicate` (`detectorClassifiers.js:293`, "PURE classification" per header `:272-273`) returns `opportunity: chop && churnState` (`detectorClassifiers.js:345`). These are pure classifiers. In LIVE code, only `classifyD1`, `classifyD1DrAbstain`, and `drNullReason` are called — by the receipt writer's `buildPredicateClassification`, to fill the outcome-blind `predicateClassification` block:

```js
// captureReceipt.js:219-221
d1ClassAsSpecced: classifyD1(inputs).class,
d1ClassDrAbstain: classifyD1DrAbstain(inputs).class,
drNullReason: drNullReason({ ... }),
```

`classifyD2` and `classifyD3Predicate` have NO production caller (grep: only `detectorClassifiers.test.js`, `captureReceipt.test.js`, and `fixtures/*.test.js`). There is thus NO live code that "decides an atom counts as an eligible opportunity" — atom emission and any archetype-scoping eligibility gate are entirely Phase-B and unimplemented. The nearest live gate is the capture-admission guard in `captureSwapReceipt`, which gates whether a RECEIPT is written via `classifyEvidence(...) !== 'live_agent'` (`captureReceipt.js:364-367`) — receipt-level evidence provenance, not atom opportunity-eligibility.

**Divergences:**
- Audit-item atom field list vs code: the item lists `opportunityDef, independenceKey, partition, exposureSource, triggered, direction, effectSize, dataQuality, regime, symbol, battleId`. Code (`learningSchemas.js:208-222`) has only `schemaVersion, atomId, agentId, battleId, receiptSeq, detector, classLabel, createdAt`. Only `battleId` overlaps. The described shape is a plan/spec projection of a future Phase-B atom, not the merged L1 shape.
- The module header (`learningSchemas.js:23`) and contract (`:205-207`) both state atoms are schema-only with no writer this phase — consistent with the code and with `docs/AGENT_LEARNING_SYSTEM_ARCHITECTURE_V1_3.md` as referenced (spec doc not independently re-opened for this item).

**FLAGS:** none (the thin shape and absent writer are intentional per the documented L1 scope; no bug).

---

### C3 — Maturity tier state and promotion machinery

**Verdict:** NOT_FOUND. No per-claim maturity-tier state is persisted, no code performs tier transitions, no promotion-threshold config is merged in code, and no claim-freeze/embargo guard exists. All of this lives only in `docs/AGENT_LEARNING_SYSTEM_ARCHITECTURE_V1_3.md`. The one `frozen` field in code is a manifest boolean, not a claim-mutation guard. There is no engagement-coupled input anywhere (correctly — none exists to couple; the doc's own tier table explicitly says "never engagement").

#### Sub-claim A — WHERE tier state is persisted / what performs transitions: NOT_FOUND in code
The tier vocabulary the item asks about ("Hunch / Testable / Trial-proven") does not appear anywhere in code or in the spec of record. The spec's actual tier names are **Watching / Ready to Test / Confirmed in Evaluation**, and they exist ONLY in the doc:
```
docs/AGENT_LEARNING_SYSTEM_ARCHITECTURE_V1_3.md:151  ### 4.5 Maturity tiers
:154  | **Watching** | ≥2 independent supporting clusters across ≥2 battles ...
:155  | **Ready to Test** | ≥8 independent opportunities in ≥5 clusters ... Triggers freeze ...
:156  | **Confirmed in Evaluation** | ≥20 independent confirmatory opportunities in ≥12 clusters ...
```
(Re-read: on this HEAD the tier rows sit at lines 154/155/156; the section header is line 151, the bar-header row is 152.) No `maturityTier`, `tierState`, `trialProven`, `Hunch`, or `Testable` field exists in any code file. Repo-wide grep for `maturityTier|tierState|trialProven|active_trial|persistent_learned|minTriggeredOpportunities|opportunityKey|clusterKey|treatmentAssignment` across `*.js` returns only `research/level-study/lib/stats.js` (a generic bootstrap-clustering stats library where `clusterKeyFn` is a configurable test knob, `stats.js:95,110,113`) and its test — NOT the learning promotion layer. The only "hunch" literal is an unrelated veto-reason UI string:
```
src/components/Agent/ProposalCard.jsx:37   'I have a hunch',
```

The evidence-atom and dossier collections that WOULD hold a promoted claim are declared schema-only with NO writer:
```
api/_utils/learning/learningSchemas.js:23  //   learningEvidence/{agentId}/atoms/{atomId}   schema only — NO writer this phase
api/_utils/learning/learningSchemas.js:24  //   learningDossiers/{agentId}                  schema only — NO writer this phase
```
```
api/_utils/learning/learningSchemas.js:206-207
// An atom requires a CLASSIFICATION (which requires the estimator — OUT of L1
// scope). Shape defined so it is stable; the writer lands in Phase B.
```
The atom skeleton carries only `classLabel` ("the CLASS from a Phase-B classifier run (not written in L1)", `learningSchemas.js:216`) with an explicit "no estimate/statistic/number fields" note (`:218-219`) — no tier, no statistic. The dossier's `lessons: []` is "populated in Phase B from promoted evidence; empty shape now" (`learningSchemas.js:232`). A repo-wide grep for `learningEvidence`/`learningDossiers` under `api/` returns hits ONLY inside `learningSchemas.js` comments (`:23,:24,:205,:224`) — nothing constructs or advances a claim.

The only learning writer that exists is `captureReceipt.js`, which writes RAW receipts only (`learningReceipts/{battleId}/receipts/{receiptId}`), outcome-blind, with NO tier/promotion field:
```
api/_utils/learning/captureReceipt.js:5-8
// The receipt carries raw predicate inputs plus OUTCOME-BLIND derived annotations
// ... NO outcome-derived / estimator field — no MPE, regret, contrast,
// return, effect, or scoring ...
```

#### Sub-claim B — Promotion thresholds ("dark-calibration defaults") + no engagement coupling: PARTIAL
The promotion thresholds exist ONLY in the doc table, whose header column literally reads:
```
docs/AGENT_LEARNING_SYSTEM_ARCHITECTURE_V1_3.md:152
| Tier | Bar (dark-calibration defaults; tuned on empirical false-positive rates, never engagement) |
```
They are NOT merged into any code config. `constructThresholds.js` is NOT the promotion config — it holds the D1/D2 detector *marker* thresholds from market semantics, a different layer:
```
api/_utils/learning/constructThresholds.js:4  // P-CONSTRUCT-THRESHOLDS — the D1/D2 detector marker thresholds.
:8  // These come from MARKET SEMANTICS, not from data, and are NOT affected by any open contract.
:26  export const D1_THRESHOLDS = Object.freeze({ bbPercentB: { extendedGte: 0.95, severeGte: 1.0, roomLte: 0.85 }, ... })
:47  export const D2_THRESHOLDS = Object.freeze({ volumeRatioGte: 1.5, upDayVolRatioGte: 1.2, ... })
```
No file holds cluster/opportunity/battle promotion counts (grep negative above).

NO ENGAGEMENT COUPLING (CONFIRMED negative): grep for `engagement|clickthrough` across `api/_utils/learning/` returns ZERO files. Because no promotion path exists in code, there is trivially no engagement input feeding it, and the sole design-level statement forbids engagement (`:152`).

#### Sub-claim C — Claim-freeze mechanism (P2): NOT_FOUND in code
The doc specifies freeze at Ready-to-Test, then embargo, then confirmation:
```
docs/AGENT_LEARNING_SYSTEM_ARCHITECTURE_V1_3.md:158-159  ### 4.6 The frozen evaluationSpec (complete contract)
// Set at Ready-to-Test (observed) or at echo-back confirmation ... no downstream
// component may reinterpret it.
:160-161  ### 4.7 Freeze → embargo → confirmation ...
// Confirmation begins only after an embargo equal to the detector's maximum outcome horizon ...
```
No code implements this. `embargo` appears in ZERO files under `api/` (grep). The only `frozen`/`freeze` tokens in learning code are:
- `Object.freeze(...)` — plain JS immutability on constant tables (`constructThresholds.js:26,47`), not a claim guard.
- `learningSchemas.js:243  frozen: null, // boolean` — a field on the calibration-MANIFEST skeleton (`makeCalibrationManifestSkeleton`, `:239`), a null-leaf shape governing whether a manifest version is frozen — NOT a per-claim mutation lock.

Because no claim/lesson object is ever written (Sub-claim A), there is no mutable claim state for a freeze guard to protect; the P2 freeze/embargo mechanism is unbuilt.

**Divergences:**
- Item's tier vocabulary "Hunch / Testable / Trial-proven" ≠ spec-of-record vocabulary "Watching / Ready to Test / Confirmed in Evaluation" (`docs/AGENT_LEARNING_SYSTEM_ARCHITECTURE_V1_3.md:154-156`). Neither vocabulary appears in code.
- Doc §4.5 defines quantitative promotion bars; code merges none of them. The nearest code constant (`constructThresholds.js`) is a different layer (detector markers) that a reader could mistake for the promotion config — flagging the distinction explicitly.

**FLAGS:** None. This is a deliberately unbuilt phase — `learningSchemas.js:23-24` mark atoms/dossiers "schema only — NO writer this phase" and `:207` states the writer "lands in Phase B."

---

### C4 — Identity-clean vs drifted signal availability

**Verdict:** PARTIAL — Some per-battle directive/identity-gate signals ARE persisted and queryable in Firestore, but (a) the one persisted per-turn identity signal is an LLM-classification-derived ruling on the USER's ask, not a deterministic trade-adherence measure; (b) archetype DRIFT DETECTION does not exist at all (dead `archetypeDrift` field); and (c) the "5-game consolidation" is per-AGENT, not per-battle, and emits no adherence/clean signal. A deterministic per-battle "identity-clean" score cannot be computed from persisted data alone today.

---

**Sub-claim 1 — Directive-gate firings ARE persisted per battle (queryable). CONFIRMED.**
`gateDirective` (`api/_utils/directiveGate.js:158`) returns an `outcome` object built by the `result()` helper — `{classification, selectedAdjustmentId, status, repairUsed}` (`directiveGate.js:140-145`). The chat endpoint stamps that outcome onto each in-battle chat exchange as `archetypeGate`, and the exchange is written via an AWAITED durable Firestore update (not fire-and-forget):
```js
// api/agent/chat.js:612
...(gateOutcome ? { archetypeGate: gateOutcome } : {}),
// api/agent/chat.js:617-618
await battleRef.update({ chatExchanges: FieldValue.arrayUnion(exchange), ... });
```
This path is live by default: `ARCHETYPE_INTEGRITY_MODE = 'observe'` (`src/config/featureFlags.js:490`), and the gate runs in observe/enforce battle mode (`chat.js:465-485`). So the per-turn classification (`in_archetype | flex | core_conflict | user_lever | research_only`, plus `status` from `committed|no_change|...`) is queryable at `agentBattles/{battleId}.chatExchanges[].archetypeGate`. NOTE: `classification` originates from Gemma's untrusted `_archetypeProposal` (`directiveGate.js:59-65`) — the gate is a deterministic *ruling on* the model's proposal (a classification of the USER's ask), NOT a deterministic measurement of the agent's trade behavior.

**Sub-claim 2 — Status-line backstop is NOT separately persisted, but is re-derivable. PARTIAL.**
`renderDirectiveStatus(hasDirective)` (`directiveGate.js:49-53`) produces `directiveStatus`/`directiveStatusLine` (the "No change made to your strategy this turn." backstop, `directiveGate.js:47`). It rides the CLIENT response only (`chat.js:536-538`), not the durable exchange. But it is a pure function of `hasDirective`, and `hasDirective` IS persisted on the exchange (`chat.js:575` `hasDirective: effectiveHasDirective`), so the line is re-derivable. It is a per-turn "did this turn write a directive" honesty flag, not a drift/adherence score. In observe mode `effectiveHasDirective` is forced `false` (`chat.js:484`), so no directive is ever recorded as fired.

**Sub-claim 3 — Enforcement/control-suppression telemetry IS durably persisted per battle-epoch. CONFIRMED.**
`buildControlEpochLogEntry` produces `{epochKey, modes, suppressedDirectiveIds[], suppressedLeanIds[], at}` (`api/_utils/controlSuppressionTelemetry.js:156-169`), written via an AWAITED `battleRef.update({ controlEpochLog: arrayUnion(entry) })` inside `recordControlEpochIfNeeded` (`controlSuppressionTelemetry.js:234`), called from the eval cron at `api/cron/agent-evaluate.js:1090`. Queryable on the battle doc. But it captures CONTROL SUPPRESSION events (a directive/lean killed by a mode round-trip), keyed by battle+epoch — not a per-battle identity-adherence measure.

**Sub-claim 4 — Archetype DRIFT DETECTION does not exist. CONFIRMED (as a refutation of the assumption).**
No drift-detection code exists. A repo-wide `archetypeDrift` grep returns only: null-initializers (`src/services/agentService.js:99`, `:484`; `api/_utils/tournamentCpu.js:71`), the training-clone copy list (`api/_utils/trainingClone.js:44`), a test fixture (`firestore.rules.emulator.test.js:129`), and two ARCHIVED components — NO code path writes a non-null value. The dead field is documented in code:
```js
// src/utils/evolutionTimeline.js:10-11
// Drift/debrief entries stay
// out — nothing writes archetypeDrift or result-less memory reflections today.
```

**Sub-claim 5 — The "5-game consolidation" is per-AGENT and produces no per-battle adherence signal. CONFIRMED.**
Consolidation fires when `gamesPlayed > 0 && gamesPlayed % 5 === 0` (`api/agent/reflect.js:129`) → `consolidateAgentEvolution` (`agentConsolidationApply.js:288`). Its durable write targets the AGENT doc (`agentConsolidationApply.js:265-273`): `disciplines`, `consolidatedInsight`, `evolutionCycle`, `lessons`, `evolutionTimeline` — keyed by `agentId`, not by battle. It emits no "drift", "adherence", or "identity-clean" field, and nothing ties it to a specific battle's atoms.

**Sub-claim 6 — battlePatternLogger persists per-battle records but no identity fields. CONFIRMED.**
`logBattlePattern` writes `agents/{agentId}/battlePatterns/{battleId}` (`api/_utils/battlePatternLogger.js:63-65`) with `activeRuleIds`, `bundleId`, `executionMode`, `strategyPreset`, `result`, `thresholdHits`, `penalties`, `marketRegime` (`battlePatternLogger.js:38-61`). No directive/gate/identity-adherence dimension is captured.

**Divergences:**
- Repo-map assumption "drift detection (5-game consolidation)" conflates two unrelated things. The 5-game trigger is CONSOLIDATION (reflections→disciplines, per-agent); it is NOT drift detection. No drift detector exists (`src/utils/evolutionTimeline.js:11`).
- Audit assumption positing "enforcement receipts" as a signal source: no collection/field of that name exists; the closest durable enforcement artifact is `controlEpochLog` (control suppression), recording suppressed directive/lean IDs per epoch, not archetype violations.

**What CAN be computed deterministically from persisted data today (partial):**
- Per in-battle chat turn: `status` and `classification` on `chatExchanges[].archetypeGate` (deterministic given the model proposal; persisted). Deliberate-null classifications (`core_conflict`/`user_lever`/`research_only`, `directiveGate.js:56`) could be counted as "user pushed against archetype" turns.
- Per battle-epoch: `controlEpochLog[].suppressedDirectiveIds/suppressedLeanIds`.
- Per turn: `chatExchanges[].hasDirective` (→ status-line derivable).

**What is MISSING for a per-battle identity-clean/adherence score:**
- No archetype-drift signal of any kind (dead `archetypeDrift` field, no writer).
- No per-battle mapping of actual TRADE decisions to archetype adherence/violation (consolidation is per-agent; battlePatterns carries no identity dimension).
- The one per-battle identity signal that IS persisted (`archetypeGate`) embeds a Gemma classification of the user's ASK — not a deterministic behavior-adherence measure, is absent in `review`/debrief mode (`chat.js:465-467`), and in the default observe mode enforcement never fires (directive forced null, `chat.js:483-484`). Excluding "drifted" battles' atoms therefore has no persisted deterministic drift flag to key on today.

**FLAGS:**
- FLAG `src/services/agentService.js:99` (also `:484`, `api/_utils/tournamentCpu.js:71`): `archetypeDrift` is a schema field initialized to `null` and never written with a non-null value by any code path (grep-confirmed; comment confirms at `src/utils/evolutionTimeline.js:11`). Dead field; any spec relying on it as an existing signal is unfounded.
- FLAG `api/agent/chat.js:465-467`: the directive gate does not run in `review` (post-battle debrief) mode, so debrief turns carry no `archetypeGate` outcome — a per-battle identity signal is absent for the debrief surface.
- FLAG `api/agent/chat.js:483-484`: in default observe mode the gate forces `normalizedDirective=null` and `effectiveHasDirective=false`, so no directive/enforcement/violation event is ever persisted — only the gate's classification of the user ask.

---

### D1 — Lean equip path and slot capacity

**Verdict:** CONFIRMED. The standing-lean equip path has a single server write chokepoint. The only existing cap is a hardcoded count cap of 2 (`STANDING_LEANS_CAP`) plus conflict-group exclusivity. There is NO per-archetype limit and NO level-derived cap today. A level-derived slot cap would have to be enforced at TWO sites to preserve the codebase's dual-authority invariant: the equip write path (`equip-lean.js:157`) and the battle-snapshot revalidation kernel (`leanRevalidation.js:161`).

*(Every citation below was independently re-opened and confirmed.)*

---

#### 1. Full equip path (entry → validation → persisted shape)

**Entry point (Character tab):** `src/components/Forge/workshop/character/CharacterArea.jsx:160-162` wires the UI to the service:
```js
const equip = (id) => run(id, () => equipLean(agent.id, id, getCanonicalTextVersion(archId, id)));
const remove = (id) => run(id, () => unequipLean(agent.id, id));
const reconfirm = (id) => run(id, () => equipLean(agent.id, id, getCanonicalTextVersion(archId, id)));
```

**Direct client writes are blocked two ways:** `standingLeans` is in `SETTINGS_GUARDED_FIELDS` (`src/services/agentService.js:157`), so `updateAgent` throws for a blind-merge attempt (`agentService.js:161-169`); and `firestore.rules:149-152` restricts client `update` to `hasOnly(['directives','lastViewedEvolutionCycle','starterKitCompleted','updatedAt'])` — `standingLeans` is NOT in that allowlist. The only write route is the server endpoint.

**Validation (all inside `api/agent/equip-lean.js`, one Firestore transaction):**
- Dark gate 404 while `STANDING_LEANS_ENABLED` off (`:69`).
- Request-shape gates: `agentId` (`:83`), `adjustmentId` via `ADJUSTMENT_ID_REGEX` (`:89`), integer `version` (`:97`).
- In-tx (`:110-172`): ownership `:114`, battle-lock `agent.activeBattleId` `:115`, per-pin validity via shared kernel `validateLeanPin(agent.archetype, adjustmentId, version)` `:121` (kernel `leanRevalidation.js:71-82`), idempotent same-version no-op `:138`, conflict-group rejection via `findEquipConflicts` `:149-154`, count cap `:157`.

**Persisted shape:** `equip-lean.js:161`
```js
const entry = { adjustmentId, version, equippedAt: nowIso };
```
written to `agent.standingLeans` via `txUpdateAgentSettings(tx, agentRef, { standingLeans, updatedAt })` `:167-170`. Unequip filters the same array (`unequip-lean.js:78`) and writes `:86-89`.

---

#### 2. Existing caps on equipped leans

**(a) Count cap — YES, fixed at 2.** `export const STANDING_LEANS_CAP = 2;` (`leanRevalidation.js:28`), a plain literal — NOT a function of level or archetype. Enforced at the write path:
```js
// equip-lean.js:157
if (!existing && current.length >= STANDING_LEANS_CAP) {
  throw new Error(SENTINEL_PREFIX + 'lean_limit');  // 409
}
```
and re-asserted at snapshot revalidation:
```js
// leanRevalidation.js:161
if (accepted.length >= STANDING_LEANS_CAP) { /* OVER_CAP, omit later-equipped */ }
```
UI reads the same constant for slot rendering (`CharacterArea.jsx`, `CharacterKit.jsx`, `ForgeOverview.jsx` — grep-confirmed importers of `STANDING_LEANS_CAP`).

**(b) Per-conflict-group exclusivity — YES.** Equip refuses a lean opposing an already-equipped lean via `findEquipConflicts(agent.archetype, adjustmentId, otherIds)` (`equip-lean.js:149-154` → 409 `conflicting_lean`). Revalidation re-asserts it at snapshot time in deterministic equip order, dropping the later-equipped loser (`leanRevalidation.js:147-160`, `CONFLICTING_LEAN`).

**(c) Per-archetype limit — NONE.** The only archetype-scoped gates are menu membership (`validateLeanPin` → `isValidAdjustmentId`, `leanRevalidation.js:75`) and archetype-scoped conflict groups. There is NO per-archetype COUNT cap; the count cap is global (2).

---

#### 3. Where a level-derived slot cap would enforce — single chokepoint?

**The cap is currently a constant, not level-derived.** Contrast the bundle path, which already threads level: `equip-bundle.js:107-109` computes `getAgentLevel(agent.stats?.gamesPlayed || 0)` then `FORGE_LIMITS[level].maxBundles` (`:107-115`, 409 `bundle_limit`). `equip-lean.js` imports no progression symbols — it uses the flat `STANDING_LEANS_CAP` only. A level-derived lean cap does not exist and would be new code.

**Enumeration of standingLeans write paths (grep-swept across `api/**/*.js`):**
| Endpoint | Mutates agent.standingLeans? | Evidence |
|---|---|---|
| `api/agent/equip-lean.js` | **WRITES** (add/refresh) | `:167-170` |
| `api/agent/unequip-lean.js` | writes (removal only) | `:86-89` |
| `api/agent/change-archetype.js` | NO — reads only | reads at `:119`; telemetry rider `revalidateStandingLeans` at `:169-181`; the tx writes only `{ archetype, updatedAt }` (`:110`) |
| `api/cron/agent-evaluate.js` | NO | `:1096` reads flag `standingLeansEnabled` only |
| `api/_utils/agentBattleService.js` (FENCE) | NO — snapshot read | `:177-178` delegates the four additive snapshot keys via `buildCustomizationSnapshot` |
| `api/_utils/controlSuppressionTelemetry.js` | NO | reads `battle.agentContext.standingLeans` (`:205,215`) |
| `equip-bundle.js` / `reforge-bundle.js` / `equip-watchlist.js` | NO | no `standingLeans` grep hit |

Only `equip-lean.js` ADDS leans; `unequip-lean.js` removes. No other path mutates the array.

**Conclusion:** There is a SINGLE add-path chokepoint (`equip-lean.js:157`), but the codebase deliberately maintains a DUAL-authority invariant: `leanRevalidation.js:25-28` states the cap "lives here … so the write path and the snapshot path can never disagree on the limit," and `revalidateStandingLeans` re-enforces it at `:161` (invoked from the createAgentBattle snapshot via `buildCustomizationSnapshot` and the change-archetype telemetry rider). `revalidateStandingLeans` currently takes only `{ standingLeans, archetypeCodeId }` (`:106`) with no level parameter, and `STANDING_LEANS_CAP` is a parameterless module constant. A correct level-derived cap must thread the level/level-cap into BOTH `equip-lean.js:157` and `leanRevalidation.js:161`; threading it only into equip would let an over-cap set (e.g. from a later cap tightening) still enter the battle snapshot un-omitted.

**Divergences:**
- Comments in `leanRevalidation.js:39-42` and `:46-51`/`:211-216` justify the `DUPLICATE_PIN` reason and bounded-record/dials defenses by asserting `agent.standingLeans` (and `agent.dials`) are "owner-writable via the client SDK." The live `firestore.rules:149-152` client `update` allowlist `hasOnly(['directives','lastViewedEvolutionCycle','starterKitCompleted','updatedAt'])` omits `standingLeans` and `dials`, so the client SDK cannot write them. The defense-in-depth code is harmless, but its stated threat model diverges from the deployed rules (see FLAG).

**FLAGS:**
- `api/_utils/leanRevalidation.js:40-41` (also `:46-47`, `:212-213`) — comments claim `agent.standingLeans` / `agent.dials` are "owner-writable via the client SDK," contradicting `firestore.rules:149-152`, whose client-update allowlist omits both. Not a runtime bug (extra hardening), but the stated rationale is stale relative to the live rules; anyone reasoning about the lean/dial threat model from these comments would be misled.

---

### D2 — Tempo Dial Band Configuration

**Verdict:** PARTIAL. The dial band is a frozen, data-driven CONFIG table, but it is a GLOBAL 3-position discrete enum with GLOBAL multipliers — there is no per-archetype band and no numeric min/max/step. A SINGLE tick-time config-resolution choke point exists (`clampHftConfig` at `agent-evaluate.js:1067`), but `archetype` is NOT a parameter of the resolver today, so a per-archetype widening would require threading `archetype` in. All discovery citations were independently re-read and confirmed.

#### Sub-claim 1 — Band is data-driven CONFIG, not hardcoded-in-logic. CONFIRMED.
The band lives in a frozen constant, not inline in the clamp. `api/_utils/tempoDialBands.js:31-40`:
```js
export const TEMPO_DIAL_BANDS = Object.freeze({
  forKnobConfigVersion: 2,
  multipliers: Object.freeze({ measured: 0.7, standard: 1.0, aggressive: 1.3 }),
});
export const VALID_TEMPO_VALUES = Object.freeze(['measured', 'standard', 'aggressive']);
```
The clamp reads the table and never hardcodes multipliers: `tempoDialClamp.js:122` `bandTable.multipliers[effectiveTempo] ?? 1.0`, where `bandTable` is an injectable parameter defaulting to `TEMPO_DIAL_BANDS` (`tempoDialClamp.js:83`).

#### Sub-claim 2 — There is NO numeric min/max/step "band". CONFIRMED (clarification).
The "band" is a 3-value discrete enum (`measured|standard|aggressive`), not a continuous range. Exactly three positions, each mapping to one multiplier (`tempoDialBands.js:34-36`). The API rejects anything outside the enum: `set-tempo-dial.js:62` `if (!VALID_TEMPO_VALUES.includes(tempo)) { ... 'invalid_tempo' }`. So "widen the band" cannot mean "raise a max number" — only changing/adding multiplier entries or the enum set.

#### Sub-claim 3 — Band is GLOBAL, not per-archetype. CONFIRMED.
The multipliers (0.7/1.0/1.3) are one flat table with no archetype dimension (`tempoDialBands.js:33-37`). Per-archetype differentiation comes only from the BASE config the multiplier is applied to: `resolveHftConfig(archetypeConfig, gameMode)` returns the archetype-locked `hftConfig` (`agentArchetypeConfig.js:233-235` [FENCE]):
```js
export const resolveHftConfig = (archetypeConfig, gameMode) => {
  return archetypeConfig?.hftConfigByMode?.[gameMode] ?? archetypeConfig?.hftConfig ?? null;
};
```
The SAME global multiplier is then applied on top. `resolveTempoDial` / `clampHftConfig` never receive an archetype argument (`tempoDialClamp.js:79-84, 178`), so `degen`@aggressive and `guardian`@aggressive both get ×1.3 on their own (different) base knobs — the band itself does not vary by archetype.

#### Sub-claim 4 — Version-bound / fail-closed. CONFIRMED.
Band pinned to the knob generation via `forKnobConfigVersion: 2` (`tempoDialBands.js:32`) vs deployed `KNOB_CONFIG_VERSION = 2` (`agentArchetypeConfig.js:30` [FENCE], re-read: `export const KNOB_CONFIG_VERSION = 2;`). Mismatch → suppress to standard with `band_version_mismatch` (`tempoDialClamp.js:114-116`). Dial off on a non-standard desire → `dial_disabled` (`:109-110`). Unknown value → `unknown_tempo_value` (`:105-106`).

#### Sub-claim 5 — SINGLE tick-time config-resolution point. CONFIRMED (with two non-config sibling sites).
The one place the dial value is resolved into the effective `hftConfig` during evaluation is immediately after `resolveHftConfig`, at `api/cron/agent-evaluate.js:1067-1075`:
```js
const dialClamp = clampHftConfig({
  hftConfig: resolveHftConfig(baseArchetypeConfig, battle.gameMode),
  desiredTempo: desiredTempoOf(battle),
  dialEnabled: TEMPO_DIAL_ENABLED,
});
const archetypeConfig = { ...baseArchetypeConfig, hftConfig: dialClamp.hftConfig };
```
`archetypeConfig.hftConfig` (the clamped output) is what flows downstream into `evaluateRisk` / Knob A/B. A per-archetype WIDENING clamp would attach here: `ctx.archetype` is in scope (`:1055` `getArchetypeConfig(ctx.archetype)`), and the `bandTable` param already exists on the resolver (`tempoDialClamp.js:178`), but an `archetype` param does not — so this is a signature extension, not a rewrite. `applyTempoToHftConfig` clamps every touched leaf with `Math.max(1, …)` (`tempoDialClamp.js:139,145`) and only 5 named leaves change, so a wider multiplier stays structurally safe.

Second site (NON-config, provenance only): `agent-evaluate.js:2821` in `handleGameplanMeeting` calls `resolveTempoDial(...)` purely to build the swap-provenance sibling — it does NOT re-clamp the running hftConfig (no `applyTempoToHftConfig`); comment notes it is "identical to the tick's for the same battle+flags." It passes only `desiredTempo` + `dialEnabled`, no archetype (though `battle.agentContext?.archetype` is in scope, used at `:2817`).

Third site (DISPLAY only, non-eval): `api/_utils/behaviorFingerprint.js:104-106` (`resolveConfigForFingerprint`) uses `resolveHftConfig` + `resolveTempoDial` + `applyTempoToHftConfig` to compute a displayed disposition. Note: this fn DOES take an `archetype` param, but it still does NOT thread archetype into `resolveTempoDial` (`:105` passes only `desiredTempo: tempoPosition, dialEnabled`) — consistent with the band being archetype-blind everywhere.

**Divergences:**
- Repo-map / audit premise implies a per-archetype "band (min/max/step)"; the LIVE table is GLOBAL and DISCRETE (3-position enum, one shared multiplier set), not per-archetype and not a numeric range. Per-archetype effect is emergent from the base `hftConfig`, not from the band.

**FLAGS:**
- None (read-only; no bug found). Note for spec authors: to widen the band per archetype you must (a) add an archetype dimension to `TEMPO_DIAL_BANDS`/`bandTable`, and (b) thread `archetype` into `resolveTempoDial`/`clampHftConfig` at all THREE call sites (`agent-evaluate.js:1067`, `agent-evaluate.js:2821`, `behaviorFingerprint.js:105`); today none of the three passes archetype into the resolver.

---

### D3 — Playbook rule caps

**Verdict:** PARTIAL — `FORGE_LIMITS` (bundle/rule caps) ARE enforced; the separate `playbookSlots` (5/10/20) field is spec-only and enforced NOWHERE live.

There are TWO distinct cap concepts. The audit item's "5/10..20" numbers belong to `playbookSlots`, not `FORGE_LIMITS`; they must be kept separate.

---

**1. `FORGE_LIMITS` — ENFORCED (values differ from the item's "5/10..20").**

Definition (`src/constants/agentProgression.js:53-57`, personally re-read):
```js
export const FORGE_LIMITS = {
  rookie:  { maxBundles: 5, maxRulesPerBundle: 10 },
  starter: { maxBundles: 5, maxRulesPerBundle: 15 },
  partner: { maxBundles: 5, maxRulesPerBundle: 20 },
};
```
`maxBundles` is a FLAT 5 at every level — it does NOT scale. Only `maxRulesPerBundle` scales: 10/15/20 (not 5/10/20).

Enforcement sites (both re-read):
- Rules-per-bundle at rule-ADD (client `services` path), `src/services/forgeService.js:393-397`:
```js
const level = getAgentLevel(agentData?.stats?.gamesPlayed || 0);
const limits = FORGE_LIMITS[level];
if (bundle.ruleIds.length >= limits.maxRulesPerBundle) {
  throw new Error(`Rule limit reached (${limits.maxRulesPerBundle} rules for ${level} level)...`);
}
```
- Equipped-bundle count at equip (server API, transactional), `api/agent/equip-bundle.js:107-115`:
```js
const level = getAgentLevel(agent.stats?.gamesPlayed || 0);
const limits = FORGE_LIMITS[level];
if (currentEquipped.length >= limits.maxBundles) {
  const err = new Error(SENTINEL_PREFIX + 'bundle_limit');
  err.details = { level, maxBundles: limits.maxBundles }; ...
```
- UI mirrors (Forge components reference `limits.maxBundles`/`maxRulesPerBundle` for display/gating; not independently re-opened here, non-load-bearing).

**2. `playbookSlots` (5/10/20 in `AGENT_LEVELS`) — a DIFFERENT field, NOT enforced anywhere live.**

Defined `src/constants/agentProgression.js:11,26,41` (rookie 5 / starter 10 / partner 20). Full consumer census (grep re-run):
- `getQueuedRulesForPromotion()` reads `levelConfig.playbookSlots` as `maxSlots` (`agentProgression.js:114`) — but that function is UNWIRED. Grep for `getQueuedRulesForPromotion` returns ONLY its definition (`:110`) and its mention inside the TODO comment (`:98`) — no caller. The preceding block is a TODO: "Wire this into the level-up notification flow" (`agentProgression.js:96-100`).
- `src/components/Agent/PlaybookPanel.ARCHIVED.jsx:65` — an ARCHIVED (dead) component.
- Note: `getNextLevelInfo` (`agentProgression.js:79-80`) uses the strings "10 Playbook slots"/"20 Playbook slots" as unlock copy, but does not read the `playbookSlots` field or gate anything on it.
- No other reference in `src` or `api`.

**3. Prompt assembly does NOT cap by any playbook slot / rule count (FENCE-read).**

`api/_utils/agentPromptAssembly.js:84-97` consumes ALL of `agent.activeRules`, splitting into CONSTRAINTS/STRATEGY PREFERENCES with no `slice`, no `playbookSlots`, no `FORGE_LIMITS` reference. Capping happens only upstream (rule-add / equip time via `FORGE_LIMITS`), never at assembly.

**Bottom line for the reframe:** "Playbook capacity" as scaling rule storage already exists and is enforced via `FORGE_LIMITS` (per-bundle rule cap 10/15/20; flat 5 bundles). The `playbookSlots` field (5/10/20) is a spec-only artifact with no live enforcement path — the queued→active promotion mechanism it was meant to drive was never wired. A per-archetype MASTERY-gated playbook cap would be a NEW build if keyed on `playbookSlots`, but could reuse the existing enforced `FORGE_LIMITS` plumbing if keyed there.

**Divergences:**
- Item said "FORGE_LIMITS ... (5/10..20)". CODE: `maxRulesPerBundle` = 10/15/20 and `maxBundles` = flat 5/5/5 (`agentProgression.js:54-56`). The 5/10/20 progression is `playbookSlots`, a different (unenforced) field.
- `playbookSlots` (5/10/20) reads like the primary "playbook cap" but is enforced by nothing; the actual enforced cap is `FORGE_LIMITS.maxRulesPerBundle` (10/15/20).

**FLAGS:**
- FLAG `src/constants/agentProgression.js:96-129`: `getQueuedRulesForPromotion` (the only field-level consumer of `playbookSlots`) is dead — TODO at :96-100 says it is not wired into any level-up flow; grep confirms no caller.
- FLAG `src/services/forgeService.js:395`: `maxRulesPerBundle` is enforced only in the client-side `services` path (direct Firestore `updateDoc`). `api/agent/reforge-bundle.js` imports no `FORGE_LIMITS` / `maxRulesPerBundle` (grep: no matches) and applies no per-bundle rule cap; `api/agent/equip-bundle.js` enforces only `maxBundles` (`:109`), not `maxRulesPerBundle`. So a bundle exceeding the per-level rule cap is not caught at the server equip/reforge boundary.

---

### E1 — Settlement pipeline map and the XP hook point

**Verdict:** CONFIRMED. There is no single unified "settlement" pipeline. "Settlement" is split across independent per-day banking layers, a per-battle finalizer, a per-week group finalizer, and (dark) a per-pod training finalizer. For the agentBattle grain — the unit a per-archetype MASTERY XP hook would key from — the single point after which one battle's receipts + score are FINAL and IMMUTABLE is `completeBattle()` in `api/cron/agent-evaluate.js` writing `status:'completed'` + `completedAt` at `agent-evaluate.js:3145-3146`. That is the candidate XP hook. All 15 discovery key-citations were re-read and are supported; enumeration added two completion sites the discovery missed (a legacy `drafts`-collection `completeBattle`, and training rolling-completion).

---

#### 1. The ordered pipeline map (verified)

**LAYER A — agentBattles badge-point daily banking (BaggerBomb layer).** Cron `api/cron/agent-daily-scores.js`, per active agentBattle via `resetBattleDaily`:
- idempotency skip on `scoreState.dailyScores.{dayKey}.recorded` (`agent-daily-scores.js:55-57`);
- writes (`agent-daily-scores.js:173-191`):
```
'scoreState.bankedBadgePoints.total': FieldValue.increment(todayBadgePoints), // :176
'scoreState.dailyScores.${dayKey}': { badgePoints, recorded:true, recordedBy:'cron', ... }, // :182
'timing.currentTradingDay': nextDay, // :188
```
Sibling `api/cron/baggerbomb-v4-daily-scores.js` is the V4 (non-agent) analog, an explicit BACKUP to a client-side primary banker — not on the agentBattles path.

**LAYER B — tournamentGroups user-layer daily banking.** `api/_utils/tournamentBanking.js` header declares it the ONLY writer of `tournamentGroups.dailyScores` (`tournamentBanking.js:3-7`). `bankGroup` (`tournamentBanking.js:352-380`) runs in a transaction, re-checks `group.status===GROUP_STATUS.BATTLE` (`:361`), and writes the cumulative snapshot `dailyScores.day{N}` + `claimSystem.currentWaiverPriority` (`:366-371`); idempotent per ET date via `recordedDate` (`tournamentBanking.js:21-25`). Per-group agent points are read by `fetchGroupAgentScores`, a masked query over `agentBattles.where(groupId==).select('gameMode','ownerId','scoreState.currentScore')` keyed by `ownerId` (`tournamentBanking.js:60-87`). Production banking rides the nightly snake-draft handler: `snake-draft-daily-scores.js:482` calls `bankAllTournamentGroups(db)`, then `reconcileAllTournamentLedgers` (`snake-draft-daily-scores.js:527`), then `aggregateTournamentLeaderboards` (`snake-draft-daily-scores.js:544`) — each firewalled with its own catch.

**PER-BATTLE FINAL (agentBattles) — `completeBattle` (the immutable point).** `api/cron/agent-evaluate.js`, BEFORE the market-hours guard (`:169`), completes any expired battle:
```
// agent-evaluate.js:149-152 — "runs regardless of market hours" (:145)
if (battle.expiresAt && new Date(battle.expiresAt) < new Date()) {
  await completeBattle(db, battle, summary);
```
`completeBattle` (`agent-evaluate.js:3084`) writes the terminal record `status:'completed'`, `completedAt:now` (`:3145-3146`), a `battle_complete` statusFeed entry stamped with `currentScore` (`:3154-3160`), and clears `agents/{id}.activeBattleId` (`:3184` tournament/CPU branch, `:3214` tiered branch).

**PER-WEEK TOURNAMENT FINAL — advancement.** Orchestrator duty `FRIDAY_ADVANCEMENT` (`tournamentOrchestrator.js:125`) → `runFridayAdvancement` (`tournamentAdvancement.js:236`). Per eligible group: `lockTopTwo` locks the weekly COMPOSITE of record via `getWeeklyComposite` (`tournamentAdvancement.js:103-113`); the bracket game entry is written with `advancers`/`finalScores`/`finalUserScores`/`completedAt` (`tournamentAdvancement.js:595-601`); after side-effects the group transitions to `COMPLETE` (`tournamentAdvancement.js:625` bracket layer, `:309` base layer). The group status machine allows only `BATTLE→COMPLETE` and `COMPLETE→[]` (`tournamentGroupService.js:45-46`), i.e. group completion is terminal/forward-only.

---

#### 2. The single FINAL/IMMUTABLE point (the XP hook candidate)

For a single agentBattle: `completeBattle` writing `status:'completed'` at `agent-evaluate.js:3145-3146`. Evidence it is genuinely final:
- `scoreState.currentScore` (score of record) is written only by the evaluator's live scoring pass (`agent-evaluate.js:699-705`, where `currentScore = activeScore + bankedScore + bankedBadgePoints` at `:697`), which runs only for active battles.
- Both the evaluator's completion sweep and the daily-banking cron fetch ONLY `status=='active'` battles (`findActiveAgentBattles`, `agentBattleService.js:31-37`), so once `status:'completed'` lands the battle is never re-scored or re-banked; its `bankedBadgePoints`/`dailyScores` stop mutating.
- Learning receipts are keyed by battle: `captureReceipt.js` writes `learningReceipts/{battleId}/receipts/{receiptId}` (`captureReceipt.js:380-385`) during active evaluation only; completion freezes the receipt set for that battleId.
- `completedAt` (`agent-evaluate.js:3146`) is the natural idempotency stamp, analogous to `dailyScores.{dayKey}.recorded` and the group-layer `recordedDate`.

Note: `completeBattle` writes NO dedicated `finalScore` field — the immutable score of record is `scoreState.currentScore` as last written at `agent-evaluate.js:702` (which already folds `bankedBadgePoints.total`). There is no post-completion recompute path.

For a tournament WEEK, the corresponding immutable point is the bracket lock / group `battle→complete` (`tournamentAdvancement.js:595-625`), but it keys off the group, and its score of record is the weekly composite, not a per-battle value.

---

#### 3. Per-day (banking) vs per-battle (final)

- **PER-DAY (repeatable, idempotent, cumulative):** `agent-daily-scores.js` (`resetBattleDaily`, bumps `timing.currentTradingDay` at `:188`) and `tournamentBanking.js` (`day{N}` closeScores, idempotent per `recordedDate`). Both explicitly non-terminal.
- **PER-BATTLE FINAL (one-shot, terminal):** `completeBattle` at `expiresAt`, gated by `agent-evaluate.js:150`. The disposition explicitly distinguishes a tournament day-bank from a tiered result:
```
// agent-evaluate.js:3058-3066 (tournament: opponent null, no W/L)
completionContext: 'tournament_group_scored',
statusMessage: `Battle complete. Day banked ... for the tournament composite.`,
updateAgentStats: false,
```
vs the tiered/CPU branch (`agent-evaluate.js:3068-3078`) which computes win/loss and sets `updateAgentStats: true` (agent career stats + `activeBattleId:null` written at `:3203-3215`).

A MASTERY XP hook should key from the PER-BATTLE FINAL point (`status:'completed'`/`completedAt`, `agent-evaluate.js:3145-3146`), NOT the per-day banking crons, which re-run each trading night on still-active multi-day battles.

**Divergences:**
- **No unified "settlement" service or cron.** "Settlement" is split across (a) `agent-daily-scores.js` badge banking, (b) `tournamentBanking.js` user-layer banking (riding `snake-draft-daily-scores.js:482`), (c) `agent-evaluate.js` `completeBattle` per-agentBattle finalization (`:3145`), (d) `tournamentAdvancement.js` per-week group/bracket finalization (`:309`/`:625`, riding the orchestrator), plus the two enumeration additions below. Any XP design must target the per-battle hook, not a unified stage.
- Inside `tournamentBanking.js` the word "Settlement" means leg-baseline settlement within a daily pass (`tournamentBanking.js:15-19`), NOT terminal battle settlement — do not conflate.

**Enumeration additions (missed by discovery):**
- **Second `completeBattle` — legacy snake-draft user battles.** `api/cron/snake-draft-daily-scores.js` has its OWN `completeBattle` (`:384`), auto-invoked when `currentDay===5` (`:376-377`), writing `status:'completed'`, `finalTotals`, `finalStandings`, `winner`, `completedAt` to the **`drafts`** collection (`snake-draft-daily-scores.js:426-437`). This is a distinct per-battle immutable point for the LEGACY snake-draft user layer — a different collection from `agentBattles`, and NOT the agent XP hook. Confirms the "multiple grains" structural finding.
- **Training rolling-completion (dark).** `completeBankedTrainingPods` (`trainingLifecycle.js:636-645`) filters BATTLE-status `isTraining` pods and, once `isWeekBanked`, transitions each `GROUP_STATUS.COMPLETE` (`:645`) — riding `snake-draft-daily-scores.js:511`, any weekday, not just Friday (Friday advancement is the idempotent backstop). A per-pod (group-grain) terminal point behind the training flag, parallel to the Friday group completion.

**FLAGS:**
- (note, `agent-evaluate.js:150`) Timing dependency, not a defect: `completeBattle` runs from the evaluator's expiry sweep ("runs regardless of market hours", `:145`), which precedes the nightly `agent-daily-scores` banking window. A battle expiring intraday is marked `completed` and drops out of the `status=='active'` query before that night's badge-banking cron. The final day's badge points are already folded into `currentScore` by the evaluator's own live pass via `bankedBadgePoints.total` (`agent-evaluate.js:696-697`), so an XP hook reading `currentScore` at `completedAt` captures the intended total — but an XP hook that instead waited for the daily banking cron would miss such a battle. Spec author should confirm the hook reads at `completedAt`, not post-daily-cron.

---

### E2 — P0 gate logic (pod stuck at Day 0) — exact conditions

**Verdict:** PARTIAL. The exact banking gate conditions are CONFIRMED verbatim (status===BATTLE AND players.length===GROUP_SIZE, GROUP_SIZE=4). BUT the audit item's stated premise — that training pods store CPU seats in a separate field (`cpuSeats`/`seats`) so `players.length===4` "never satisfies" — is REFUTED by the live code: CPU pad seats are written straight into `players[]` (each flagged `isCpu:true`), so a training pod carries exactly 4 `players[]` entries and DOES satisfy the gate. There is also no "user-baseline settlement" pod-eligibility gate in `tournamentUserScoring.js` / `baselineValidation.js` (NOT_FOUND there); the authoritative gate lives in `tournamentBanking.js`.

**Sub-claim 1 — the EXACT banking gate (status check).** `bankGroup()` skips any group not in BATTLE:
```js
// api/_utils/tournamentBanking.js:361
if (group.status !== GROUP_STATUS.BATTLE) return { skipped: true, reason: 'not_battle' };
```

**Sub-claim 2 — the EXACT eligibility gate (seat-count check).** The cron driver `bankAllTournamentGroups()` queries `status == BATTLE` then filters on exactly GROUP_SIZE seats:
```js
// api/_utils/tournamentBanking.js:390,397
.where('status', '==', GROUP_STATUS.BATTLE)
...
if (data.players?.length === GROUP_SIZE) {   // GROUP_SIZE === 4
```
`GROUP_SIZE = 4` at `src/constants/leagueTournament.js:71`. The shared house mirror applies the same pair (status equality + full seat count):
```js
// api/_utils/tournamentGroupService.js:152,157
.where('status', '==', status)
...
if (data.players?.length !== GROUP_SIZE) return;
```

**Sub-claim 3 — where CPU seats are stored (the crux).** `quickPlay()` → group formation pads humans to four with CPUs and writes ALL four into `players[]`, each carrying `isCpu`:
```js
// api/_utils/tournamentLobbyService.js:308
players: seats.map(s => ({ odUserId: s.odUserId, picks: [], isCpu: s.isCpu })),
```
`createTournamentGroupDoc` REQUIRES exactly 4 (unique-id) players, so a formed pod cannot have fewer:
```js
// src/constants/leagueTournament.js:1211-1212
if (!Array.isArray(players) || players.length !== GROUP_SIZE) {
  throw new Error(`createTournamentGroupDoc: players must be an array of exactly ${GROUP_SIZE}`);
```
Downstream training logic distinguishes CPU seats by the `isCpu` flag *inside* `players[]`, not a separate field:
```js
// api/_utils/trainingLifecycle.js:289-290
const player = (group.players || []).find(p => p.odUserId === members[seatIdx]);
if (!player || player.isCpu !== true) break;
// :595 — the lone human seat = the one non-CPU entry in players[]
const humanId = (pod.players || []).find(p => p.isCpu !== true)?.odUserId || state.humanId;
```
No `cpuSeats` field exists; the only `seats:` field is on the separate BRACKET doc, not the tournament-group participant list.

**Sub-claim 4 — training pods are NOT gate-excluded, and DO reach BATTLE.** `computeBankingUpdate` copies/settles every entry in `players[]` with no `isCpu` skip (`api/_utils/tournamentBanking.js:166-173`). Banking/eligibility deliberately keep training pods: `fetchEligibleGroupsByStatus`'s `excludeTraining` defaults to `false` (`api/_utils/tournamentGroupService.js:150,159`), and its doc-comment states banking/completion "run their OWN queries and keep training (a training pod still banks + completes)" (`:145-148`). The training draft handoff lands the pod directly in BATTLE (or AWAITING_OPEN for a future anchor):
```js
// api/_utils/trainingLifecycle.js:320,324
const target = anchorDateReached(startAnchor, nowEtDate) ? GROUP_STATUS.BATTLE : GROUP_STATUS.AWAITING_OPEN;
groupUpdate: { players, ..., status: target, ... }
```

**Net:** Once a training pod is in BATTLE it has exactly 4 `players[]` entries (1 human + 3 `isCpu`) and therefore SATISFIES `players.length===GROUP_SIZE`. The seat-count gate is not the thing that could strand a pod. The only condition that would keep a formed pod from banking is the *status* half of the gate — a pod still in FORMING/DRAFTING/AWAITING_OPEN (never advanced to BATTLE) is skipped by `tournamentBanking.js:361` and excluded by the `status == BATTLE` query at `:390`. That is a status-transition question, not a `players[]` seat-storage question.

**Divergences:**
- Audit-item premise vs code: the item posits training pods "store participants (separate field? not in players[]?)" and asks "precisely WHY the gate never satisfies." Code shows the opposite — CPU seats live in `players[]` with `isCpu:true` (`tournamentLobbyService.js:308`; distinguished at `trainingLifecycle.js:289-290,595`), and `createTournamentGroupDoc` forces exactly 4 (`leagueTournament.js:1211`). The `players.length===4` gate therefore DOES satisfy for a training pod. Any downstream spec assuming this gate is the blocker is false against HEAD f9a84e50.
- Item locates a "user-baseline settlement" gate in `tournamentUserScoring.js` / `baselineValidation.js`. NOT_FOUND there: `tournamentUserScoring.js` (168 lines) is pure scoring helpers with no `GROUP_STATUS`/`BATTLE`/`players.length`/`GROUP_SIZE` reference (verified by grep — zero hits); `baselineValidation.js` validates PRICE baselines, not pod eligibility (zero status/seat/isCpu hits). The authoritative gate lives entirely in `tournamentBanking.js`.

**FLAGS:** none (no bug found; this is a premise/code divergence recorded above, not a defect).

---

### E3 — Eval budget starvation — exact mechanism

**Verdict:** CONFIRMED — with a framing correction. There is NO numeric `MAX_HAIKU` / `HAIKU_BUDGET` call-count constant anywhere in `agent-evaluate.js` (grep for `MAX_HAIKU|HAIKU_BUDGET` across `api/` returns nothing). The budget is a shared per-invocation **time** budget, enforced at two sites, and the "selection logic" is a fair-rotation **ordering** of all active battles processed sequentially in one serverless invocation — not a pick of a single battle. Every battle whose Haiku call cannot start (budget) or whose whole processing is deferred **defaults to HOLD**.

**Cron cadence (what a "tick" is).** One invocation runs every 15 min during market hours and processes ALL active battles sequentially inside one function. (Cron config is in the **repo-root** `vercel.json`, not `api/vercel.json`.)
```
vercel.json:134-135
  "path": "/api/cron/agent-evaluate",
  "schedule": "*/15 13,14,15,16,17,18,19,20,21 * * 1-5"
```
```
api/cron/agent-evaluate.js:94
export const config = { maxDuration: 300 };
```

**Sub-claim 1 — WHERE the budget is enforced + the budget VALUE.** Two enforcement points, both time-based:

(a) Handler-level per-battle loop guard. Once cumulative elapsed exceeds the soft budget, the loop breaks and the rest are deferred to the next tick (counted as `summary.skipped`):
```
api/cron/agent-evaluate.js:98
const TIME_BUDGET_MS = 290_000; // 290s — leave 10s buffer under the 300s maxDuration for cleanup/response
```
```
api/cron/agent-evaluate.js:215-221
const elapsed = Date.now() - startTime;
if (elapsed > TIME_BUDGET_MS) {
  const remaining = activeBattles.length - summary.evaluated - summary.errors;
  console.log(`... Time budget exceeded (${elapsed}ms). ${remaining} agent(s) deferred to next tick.`);
  summary.skipped += remaining;
  break;
}
```

(b) Per-battle pre-call guard `shouldStartHaikuCall`. Even inside a battle that cleared (a), the Haiku call is skipped unless ≥34s remain:
```
api/cron/agent-evaluate.js:1627-1634
const budget = shouldStartHaikuCall({ elapsedMs: Date.now() - cronStartTime, timeBudgetMs: TIME_BUDGET_MS });
if (!budget.proceed) {
  haikuFailure = { failureClass: 'budget_skipped',
    message: `cron budget too low to start Haiku call (...s remaining, ...s required)`, ... };
```
Guard constants + math (required = 22_000 + 12_000 = 34_000 ms):
```
api/_utils/agentEvalTransport.js:14-15
export const HAIKU_CALL_CEILING_MS = 22_000;
export const HAIKU_POST_CALL_ALLOWANCE_MS = 12_000;
```
```
api/_utils/agentEvalTransport.js:67-69
const remainingMs = timeBudgetMs - elapsedMs;
const requiredMs = callCeilingMs + postCallAllowanceMs;
return { proceed: remainingMs >= requiredMs, remainingMs, requiredMs };
```
Effective "budget value": 290s soft handler budget, single Haiku call capped at 22s per battle (SDK 20s timeout + 2s AbortController backstop, `agent-evaluate.js:1642-1643,1663`), a 34s pre-call reservation, under a 300s function ceiling. Battles that get a Haiku call per tick = whatever fits sequentially in 290s — not a fixed constant.

**Sub-claim 2 — selection logic (which battle gets evaluated).** Not a single-pick. All active battles are SORTED ascending by the last tick each actually STARTED a Haiku call (`cronState.lastEvalStartedAt`, written only on a real attempt, so `budget_skipped` ticks never refresh it); never-evaluated battles (empty string) sort to the front. Whoever remains when the time budget runs out is deferred:
```
api/cron/agent-evaluate.js:209-211
activeBattles.sort((a, b) =>
  (a.cronState?.lastEvalStartedAt || '').localeCompare(b.cronState?.lastEvalStartedAt || '')
);
```
The comment (lines 199-208) is explicit that this only makes starvation FAIR, not gone: "a stable processing order starves the SAME tail battles every tick ... This makes starvation FAIR ... it does NOT make it go away — the real fix is per-battle fan-out."

**Sub-claim 3 — "all others default to HOLD" in code.** When the Haiku call is skipped (budget) or fails, `haikuResult` stays `null` and the decision defaults to HOLD:
```
api/cron/agent-evaluate.js:1718
let decision = haikuResult?.decision || 'HOLD';
```
The budget-skip path makes no call and leaves `haikuResult` null (only sets `haikuFailure`, lines 1628-1634), so it flows into that default. The eval record's rationale spells it out:
```
api/cron/agent-evaluate.js:2261-2264
rationale: haikuResult?.rationale || (haikuResult ? null
  : haikuFailure?.failureClass === 'budget_skipped'
    ? 'Evaluation skipped — cron budget too low to start Haiku call. Defaulting to HOLD.'
    : 'Haiku call failed — defaulting to HOLD'),
```
A status-feed beat marks the degraded tick so a fallback HOLD is distinguishable from a deliberate one:
```
api/cron/agent-evaluate.js:2298-2301
message: `Evaluation engine degraded this tick (${haikuFailure.failureClass}) — defaulted to HOLD.`,
action: 'eval_degraded',
```

**Sub-claim 4 — LOCKED CPU-eval budget architecture vs. a future multi-battle training load (read-only observation, not a critique).** The agentBattles model evaluates every active battle SEQUENTIALLY inside one serverless invocation sharing the single 290s budget (loop at line 214; the file's sole `messages.create` call site at line 1645, confirmed by the comment at line 112-113 "this file has exactly one messages.create call site"). The only relief valve today is that CPU tournament battles are marked PASSIVE and short-circuit before any Haiku call, fetch, or risk work:
```
api/cron/agent-evaluate.js:731-748
if (battle.isCpu === true) {
  finalizeCronState(scoreUpdate, { ... });
  await battleRef.update(scoreUpdate);
  summary.evaluated++; summary.held++;
  console.log(`... CPU passive battle — scores marked, triggered evaluation skipped (P4 contract #5)`);
  return;
}
```
Observation for a MASTERY/training reframe: any NON-CPU (live-evaluated) battle added by a multi-battle training load competes for the same single-function 290s budget with a 22s-per-call, ~34s-reserved sequential slice. There is no per-battle fan-out and no numeric call quota — the evaluated-per-tick ceiling is purely temporal, and the code itself names "per-battle fan-out" as the unimplemented real fix (lines 206-208). A training regime spinning up many live pods would push more battles past the 290s wall each 15-min tick; by the fair-rotation design (lines 199-211) the overflow rotates who gets a real evaluation vs. a fallback HOLD.

**Divergences:**
- Audit-item phrasing "per-tick Haiku call budget" / "the budget constant" implies a numeric call-count cap. CODE: no such constant; the mechanism is a 290s TIME budget (`agent-evaluate.js:98`) plus a 34s per-call time reservation (`agentEvalTransport.js:67-69`). PARTIAL on that specific sub-claim; the underlying starvation mechanism is CONFIRMED.
- Audit-item phrasing "selection logic determining which battle gets evaluated" implies one battle is chosen. CODE: all active battles are processed in a fair-rotation ORDER (`agent-evaluate.js:209-211`); "selection" is really "who fits before the clock runs out."

**FLAGS:** None. All observed behavior is intentional and documented in-code (comments at lines 89-94, 199-208, 725-730). Starvation is acknowledged by the authors as a known scale limitation, not a bug.

---

### E4 — Mode inventory (every battle-creation flow)

**Verdict:** CONFIRMED — full enumeration produced and independently re-verified. Two battle-document collections exist: `agentBattles` (agents; the only receipt-bearing collection) and `battles` (base-layer BaggerBomb; no agents, no receipts). Every `agentBattles` doc is created by exactly one function, `createAgentBattle`, called from exactly two non-test sites in `decide.js` (688, 1146); tournament, training, and CPU seats all funnel through site 1146.

#### 1. `createAgentBattle` is the single agent-battle writer (proven, not assumed)
`agentBattles` docs are `add()`-ed only here:
```js
// api/_utils/agentBattleService.js:262
const docRef = await db.collection('agentBattles').add(battleDoc);
```
A repo-wide grep confirms `.collection('agentBattles').add(` exists nowhere else; every other `agentBattles` reference is `.doc()` (update/read) or `.where()` (query). `createAgentBattle` has exactly two non-test callers, both in `decide.js`:
- `api/agent/decide.js:688` — legacy PvP path (handler default, tiered), embeds a CPU opponent object built at :681.
- `api/agent/decide.js:1146` — inside `runPrescribedTournamentDeploy` (flat6: ranked tournament, training, and CPU seats).

Routing gate:
```js
// api/agent/decide.js:229
if (req.body.gameMode === FLAT6_GAME_MODE) {
  return await runPrescribedTournamentDeploy({ db, req, res, agentRef, agent, agentId: agentDoc.id });
}
```
`FLAT6_GAME_MODE === TOURNAMENT_GAME_MODE === 'baggerbomb_tournament'` (`src/constants/agentGameModes.js:37`); tiered default is `'baggerbomb_agent'` (`agentGameModes.js:36`).

#### 2. The agent-battle deploy ENTRY POINTS (all reach the two sites above)
- **Legacy PvP (tiered):** client → `POST /api/agent/decide` with no `gameMode` → site 688. `opponent` embedded (`decide.js:681`, passed at :693).
- **League Tournament (flat6, ranked):** orchestrator `buildDeployRequest` posts `/api/agent/decide` with `gameMode: TOURNAMENT_GAME_MODE`, `prescribedPortfolio`, `groupId`, optional `isCpu` (`api/_utils/tournamentOrchestrator.js:222-241`, esp. :234-235) → site 1146.
- **Training pod (flat6):** training activation runs `produceGroupBoards → resolveAgentDraftForGroup → fanOutDeploys → POST /api/agent/decide → createAgentBattle` — "the same flat6 machinery ranked uses" (`tournamentOrchestrator.js:664-671`) → site 1146.
- **CPU seat (flat6):** same site 1146 with `isCpu: isCpu === true` (`decide.js:1155`).

The tournament battle doc stamps `groupId` (+`isCpu` when true) but **no `isTraining` boolean**:
```js
// api/_utils/agentBattleService.js:112
...(isTournament ? { groupId: options.groupId, ...(options.isCpu === true ? { isCpu: true } : {}) } : {}),
```
However training and CPU battles ARE distinguishable at the doc level by `agentId`: training clones deploy under `training-agent-{groupId}-{odUserId}` (`src/constants/leagueTournament.js:343-348`; clone doc id set at `api/_utils/trainingClone.js:148,168`) and CPU seats under `cpu-agent-` (`leagueTournament.js:326-331`) plus `isCpu:true`. This is exactly the discriminator the receipt layer uses (see §3).

#### 3. Receipts (Block-A shape) — emitted for `agentBattles`, none for `battles`
`agent-evaluate.js` processes **every** active agent battle with no mode filter:
```js
// api/cron/agent-evaluate.js:146  →  findActiveAgentBattles (agentBattleService.js:31-38)
const allBattles = await findActiveAgentBattles(db);   // where('status','==','active') only
```
`buildSwapReceiptSource` + `buildSwapProvenance` are spread into `evaluationMetadata` at **four** swap sites (grep-confirmed):
- `:1347` — risk-triggered swap (`source: swapSource`, `exitReason: riskResult.reason`).
- `:1906` — autopilot Haiku/guardrail **executed** swap (`source: swapSource` = `'haiku'`|`'guardrail'`).
- `:2166` — copilot **proposal** doc (dormant under autopilot launch guard; `source:'haiku'` hardcoded).
- `:2817` — gameplan-meeting swap (dormant, launch-guarded; `source:'gameplan_meeting'`).

The durable Phase-4 writer `captureSwapReceipt` is called **exactly once** (grep: only occurrence in the file), at `:2022`, inside the autopilot-executed-swap path whose metadata is built at :1906. It writes:
```js
// api/_utils/learning/captureReceipt.js:380-385
await db.collection('learningReceipts').doc(receipt.battleId)
  .collection('receipts').doc(receiptId).set(receipt);
```
keyed by `battleId`, so legacy/tournament/training/CPU battles that take the autopilot-executed swap path all produce receipts. `evidenceClass` is derived from the same identity signals (`captureReceipt.js:56-61`): `isCpu===true → 'cpu'`; else `agentId` prefix `training-agent- → 'training'`, `cpu-agent- → 'cpu'`, else `'live_agent'`. `isCpu: battle.isCpu` is passed at `agent-evaluate.js:2029`.

#### 4. Base-layer `battles` collection (no agents, no receipts)
Client-created, user-vs-user, separate collection (all four writers `addDoc(collection(db,'battles'))`):
- **V4 multi-day:** `createBaggerBombBattleV4` → `firebaseService.js:1940`. Banked by cron `api/cron/baggerbomb-v4-daily-scores.js:277` (`db.collection('battles').doc(battleId)`), plus client scoring.
- **V3 single-day:** `createBaggerBombBattleV3` → `firebaseService.js:1262`. **No dedicated V3 cron** in `api/cron/`; scored client-side.
- **Legacy V2:** `createBaggerBombBattle` → `firebaseService.js:1028`; **generic:** `createBattle` → `firebaseService.js:243`.

None involve agents, archetypes, or receipts.

#### 5. `tournamentGroups` (+ `drafts`) — user snake-draft layer, NOT a battle doc
The League user layer lives in `tournamentGroups`; it SPAWNS the flat6 `agentBattles`, it is not itself a battle document. Agent-layer group composite is `fetchGroupAgentScores`, summing `agentBattles.scoreState.currentScore` by `groupId`:
```js
// api/_utils/tournamentBanking.js:64-66
const snap = await db.collection('agentBattles').where('groupId','==',groupId)
  .select('gameMode','ownerId','scoreState.currentScore').get();
// :75 re-checks battle.gameMode === TOURNAMENT_GAME_MODE
```
`bankAllTournamentGroups` selects BATTLE groups with `players.length === GROUP_SIZE` and **no training filter** (`tournamentBanking.js:388-400`; `GROUP_SIZE = 4`, `leagueTournament.js:71`).

#### Inventory table (mode × collection × scorer × agents? × receipts? × XP verdict)

| Mode | Entry point | Collection | Scoring hook | Agents? | Block-A receipts? | XP-source verdict |
|---|---|---|---|---|---|---|
| Legacy PvP (tiered) | `decide.js:688` | `agentBattles` (`baggerbomb_agent`) | `agent-daily-scores.js` + `agent-evaluate.js` | YES | YES | **Viable AS-IS** |
| League Tournament (flat6) | `decide.js:1146` via orchestrator `buildDeployRequest` | `agentBattles` (`baggerbomb_tournament`, `groupId`) | `agent-daily-scores.js` + `tournamentBanking.fetchGroupAgentScores` | YES | YES | **Viable AS-IS** |
| Training pod (flat6) | `decide.js:1146` via training activation → `fanOutDeploys` | `agentBattles` (`baggerbomb_tournament`, `groupId`; agentId `training-agent-…`; **no `isTraining` bool**) | `agent-daily-scores.js` + `bankAllTournamentGroups` (no training filter) | YES | YES (`evidenceClass:'training'`) | **Viable with settlement isolation fix** (doc IS identifiable via agentId prefix / groupId→group.isTraining; group banking not training-isolated) |
| CPU seat | `decide.js:1146` w/ `isCpu:true` | `agentBattles` (`isCpu:true`, agentId `cpu-agent-…`) | same as tournament/training | YES (system) | YES, `evidenceClass:'cpu'` | **Not viable** for a user's XP (system agent, no owner progression) |
| Base V4 multi-day | `firebaseService.js:1940` (client) | `battles` | `baggerbomb-v4-daily-scores.js` + client | NO | NO | **Not viable** |
| Base V3 single-day | `firebaseService.js:1262` (client) | `battles` | client-side (no V3 cron) | NO | NO | **Not viable** |
| Base V2 / generic | `firebaseService.js:1028` / `:243` | `battles` | legacy | NO | NO | **Not viable** (legacy) |
| User snake-draft group | `tournamentGroups`/`drafts` (spawns tournament/training modes) | `tournamentGroups` (not a battle doc) | `snake-draft-daily-scores.js` + `tournamentUserScoring` | Indirect | via spawned agentBattles | N/A (spawner, not a battle doc) |

**Divergences:**
- Repo map assumed a clean "V3 tournamentUserScoring / V4 baggerbomb-v4-daily-scores" split. In live code `tournamentUserScoring.js` is the **League Tournament user-layer** scorer (over `tournamentGroups`), NOT the base-layer V3 scorer; base-layer V3 (`battles`) has **no dedicated cron** and is scored client-side.
- Discovery said training/ranked are "distinguishable only by joining battle.groupId → group.isTraining." Code shows a second, doc-local discriminator: the battle's `agentId` prefix (`training-agent-` for training, `cpu-agent-`/`isCpu` for CPU), which is precisely what `classifyEvidence` (`captureReceipt.js:56-61`) keys on to tag receipts.

**FLAGS:**
- **[note] Durable `learningReceipts` are swap-source-incomplete.** `captureSwapReceipt` is invoked at exactly one site (`api/cron/agent-evaluate.js:2022`), the autopilot-executed-swap path (metadata built at :1906). Risk-triggered swaps (:1347), copilot proposals (:2166), and gameplan-meeting swaps (:2817) spread `buildSwapReceiptSource`/`buildSwapProvenance` onto `trades[]`/proposal metadata but never call `captureSwapReceipt`, so **no `learningReceipts` doc is written for those swap sources** — XP built on the learning-receipt corpus would miss risk-driven, copilot, and gameplan exits.
- **[note] Training/CPU battle docs carry no explicit boolean flag beyond `isCpu`.** `createAgentBattle` stamps only `groupId` (+`isCpu`) for tournament docs (`agentBattleService.js:112`) — there is no `isTraining` field. Training battles are nonetheless identifiable at the doc level via `agentId.startsWith('training-agent-')` (`leagueTournament.js:343-348`) or a `groupId → tournamentGroups.isTraining` join; the earlier "cannot tell them apart" framing is too strong.
- **[note] `bankAllTournamentGroups` does not filter training** (`tournamentBanking.js:388-400`): it selects BATTLE groups with `players.length === GROUP_SIZE` (=4, `leagueTournament.js:71`); a training pod is 1 human + 3 CPU = 4, so training pods' agent-layer scores ARE group-banked. If training XP must be stakes-isolated, that isolation is not enforced at this layer.

---

### E5 — Regime availability at battle creation (trial feasibility)

**Verdict:** CONFIRMED — Regime/market-state data is reachable SYNCHRONOUSLY at battle-creation time with ZERO new external API calls. Both source docs are single, fixed-id Firestore docs (`indexIntelligence/marketContext` and `indexIntelligence/dailyRegimeBrief`), and the deploy path ALREADY reads both of them one step after `createAgentBattle` returns (with one gating caveat on the CPU tournament path — see sub-claim 3). Stamping a `regimeAtCreation` would be a pure Firestore read of two known doc ids.

#### Sub-claim 1 — The two regime source docs and their key patterns — CONFIRMED

**`indexIntelligence/dailyRegimeBrief`** — a SINGLE named doc (NOT per-day, NOT per-symbol), keyed internally by a `forDate` YYYY-MM-DD field, overwritten in place each run. Verified:
```js
// api/cron/compute-daily-regime-brief.js:85
const briefRef = db.collection('indexIntelligence').doc('dailyRegimeBrief');
// :91  idempotency guard
if (existing.exists && existing.data()?.forDate === today) { ...skip... }
// :204-213  write payload
await briefRef.set({ dailyBrief: brief, keyEvents, themes, forDate: today,
  generatedAt: FieldValue.serverTimestamp(), model: SONNET_MODEL, tokenUsage, sourceFailures });
```
Freshness anchors: explicit `forDate` (same-day check at :91) + `generatedAt` serverTimestamp (:209). Schedule `30 12 * * 1-5` — `vercel.json:154-155`.

**`indexIntelligence/marketContext`** — also a SINGLE named doc (NOT per-day, NOT per-symbol). Carries `regime`, `regimeDetail`, `breadthTier`, `volatilityRegime`, `leadership`, `divergence`, etc. Verified:
```js
// api/cron/compute-index-intelligence.js:859-883
const marketContextRef = db.collection('indexIntelligence').doc('marketContext');
batch.set(marketContextRef, { regime: regime.regime, regimeDetail: regime.regimeDetail,
  ...breadthTier, volatilityRegime, leadership, divergence,
  mode: intraday ? 'intraday' : 'premarket', updatedAt: FieldValue.serverTimestamp() });
```
Freshness anchor: `updatedAt` serverTimestamp + `mode` only — the field list at :860-883 has NO `forDate`/date field. Refreshed premarket (`30 10,11 * * 1-5`) and intraday hourly (`0 14..20 * * 1-5`) — `vercel.json:126-132`.

#### Sub-claim 2 — `createAgentBattle` reads NO regime data — CONFIRMED

The fenced creation fn receives `(db, agentData, thresholds, startingPrices, options)` and never reads `indexIntelligence/*`; the battle doc it writes has no regime field:
```js
// api/_utils/agentBattleService.js:55
export async function createAgentBattle(db, agentData, thresholds, startingPrices, options = {}) {
// ...builds battleDoc (no regime read/field)...
const docRef = await db.collection('agentBattles').add(battleDoc);   // :262
return { id: docRef.id, expiresAt };                                 // :263
```
Any stamp must therefore be caller-side (read-before-pass-in or post-create update), not from inside the fenced function.

#### Sub-claim 3 — The caller ALREADY reads both regime docs synchronously — CONFIRMED (with one gating caveat)

`createAgentBattle` is called from two sites in `decide.js`: solo/BaggerBomb deploy at `decide.js:688` and prescribed-tournament deploy at `decide.js:1146`. Both are followed by `generateFirstMessageOnDeploy(...)` — but the tournament call is gated:
```js
// decide.js:707  (solo path — unconditional)
await generateFirstMessageOnDeploy({ db, agentData, battleId: battleResult.id });
// decide.js:1169-1170  (tournament path — GATED on isCpu !== true)
if (isCpu !== true) {
  await generateFirstMessageOnDeploy({ db, agentData, battleId: battleResult.id });
}
```
`generateFirstMessageOnDeploy` reads both regime docs by fixed id in one `Promise.all`:
```js
// api/agent/decide.js:1218-1239
const [battleDocSnap, marketCtxDoc, drbDoc, cacheDoc] = await Promise.all([
  battleRef.get(),
  db.collection('indexIntelligence').doc('marketContext').get(),
  db.collection('indexIntelligence').doc('dailyRegimeBrief').get(),
  db.collection('voiceLayerCache').doc(battleId).get(),
]);
const regimeLine = `Regime: ${ctx.regime}. ${ctx.regimeDetail || ''}`.trim();      // :1234
const briefLine = drb && drb.forDate === today && typeof drb.dailyBrief === 'string'  // :1236
  ? drb.dailyBrief : null;
```
So the exact reads a `regimeAtCreation` stamp would need already happen post-create for solo/BaggerBomb deploys and human-owned tournament deploys; `decide.js:1236` even shows the correct same-day freshness gate for the DRB (`drb.forDate === today`). CPU-owned tournament battles (`isCpu === true`) skip this call and do NOT read the regime docs today — but reachability is unaffected: the docs are fixed-id and can be read by any caller in the same request.

#### Feasibility read
YES — zero new external/API calls. A `regimeAtCreation` stamp could be populated from `indexIntelligence/marketContext` (`regime`, `regimeDetail`, `breadthTier`, `volatilityRegime`) and/or `indexIntelligence/dailyRegimeBrief` (`dailyBrief`, gated on `forDate === today`), both single fixed-id docs. Freshness: DRB carries an explicit same-day `forDate` guarantee; marketContext carries only `updatedAt` (no date field). This item asserts reachability only — `createAgentBattle`'s doc shape is fenced, so any stamp would be caller-side (read-before-pass-in or post-create update).

**Divergences:** None against a spec (the repo has no `regimeAtCreation` field today — grep returns zero hits across the codebase). One accuracy tightening vs. the discovery writeup: the tournament-path read of the regime docs is CONDITIONAL on `isCpu !== true` (`decide.js:1169`), not unconditional as originally stated.

**FLAGS:**
- NOTE (not a bug): `indexIntelligence/marketContext` has no `forDate`/date field (field list `compute-index-intelligence.js:860-883`), only `updatedAt` + `mode`. Unlike the DRB (`forDate`), its regime value has no self-contained same-day freshness stamp; any trial treating marketContext regime as "today's" must derive freshness from `updatedAt`.
- NOTE (not a bug): CPU-owned tournament battles (`isCpu === true`, `decide.js:1155/1169`) skip `generateFirstMessageOnDeploy`, so the "already reads both regime docs" convenience does not hold for that path — a stamp there would need its own read.

---

### E6 — Post-battle surface inventory

**Verdict:** CONFIRMED

Three distinct post-battle surfaces exist. The **Film Room** is the per-battle debrief host (reads the `agentBattles/{id}` doc only); the **Evolution / AgentRecordSheet** surface is a per-agent lifetime timeline (reads the `agent` doc, never a battle doc); a small **ReviewStation** card on the dashboard is just a launcher into the Film Room. Of the learning-system collections, only the **dossier** is client-readable (owner only); **receipts and evidence atoms are server-write-only AND client-read-blocked**. All citations below were re-opened and confirmed.

#### 1. Film Room — the per-battle debrief surface

Routed from `App.jsx` as `screen === 'filmRoom'`, rendered from `FilmRoomScreen` with the selected battle. The comment self-describes it as "Phase 4 Voice Layer Rework: post-battle review surface."
```
// src/App.jsx:9210-9221
// FILM ROOM SCREEN - Phase 4 Voice Layer Rework: post-battle review surface
if (screen === 'filmRoom' && currentBattle) {
  ... <FilmRoomScreen battle={currentBattle} onBack={() => setScreen('dashboard')} />
```
Its sole data source is the raw `agentBattles/{id}` doc via a live snapshot:
```
// src/hooks/useAgentBattle.js:26-32
const battleRef = doc(db, 'agentBattles', agentBattleId);
onSnapshot(battleRef, (snapshot) => setBattle({ id: snapshot.id, ...snapshot.data() }))
```
`chatExchanges` is a plain field on that same doc (not a subcollection): `const chatExchanges = battle?.chatExchanges || [];` (`useAgentBattle.js:54`). `FilmRoomScreen` reads only battle-doc fields: `timing.tradingDays`, `dailyReviews[]`, `portfolio`, `trades[]`, `chatExchanges` (`FilmRoomScreen.jsx:44-69`).

Sub-cards, stacked in `FilmRoomScreen.jsx:127-165`, and the fields each reads:
- **ScoreSummaryCard** — `battle` + `dayNum` (`FilmRoomScreen.jsx:127`).
- **AutoDebriefHero** — `battle` + `chatExchanges` filtered for the day (`FilmRoomScreen.jsx:129-137`).
- **DaySummaryCard** — one `dailyReviews[]` entry: `selfGrade`/`date` (`DaySummaryCard.jsx:50-51`), `daySummary` (`:106,115`), `selfGradeRationale` (`:119,129`), `lessonLearned` (`:133,162`), `proposedRules[]` (`:167,180`).
- **TradeHistorySection / AnticipationLogSection / FilmRoomChat** — `trades[]` and `chatExchanges` (`FilmRoomScreen.jsx:141-165`).

Everything the Film Room shows lives in the single `agentBattles` battle doc.

#### 2. Evolution — per-agent lifetime timeline (NOT battle-scoped)

Entry point `EvolutionPreviewCard` on the Command Dashboard, opening the full `AgentRecordSheet`. Both build their timeline from `buildEvolutionTimeline(agent)` — the shared assembler reads the **agent doc**, not a battle doc:
```
// src/utils/evolutionTimeline.js:79-167 (reads the agent doc)
agent.createdAt (79), agent.evolutionCycle / agent.evolutionTimeline[] (92-94),
agent.lessons[] (130), agent.memory[] result/score/gameMode (141-153),
agent.deployedStrategy (159)
```
`AgentRecordSheet.jsx:9-10` confirms: "Data flows entirely from the shell's existing useAgent subscription via props — no queries or subscriptions in here." It imports and renders rank progress via `getLevelProgressPct` from `constants/agentProgression` (`AgentRecordSheet.jsx:27`). This surface is **lifetime/per-agent**, aggregating across battles — the natural home for a *cumulative* XP/level readout, not per-battle atoms.

#### 3. ReviewStation — dashboard launcher (not a render surface)

`ReviewStation.jsx:4-5` self-describes as "Taps through to the Film Room (the raw agentBattles doc…)". It reads only `latest.scoreState?.currentScore` (`:18`) and calls `onReview?.(latest)` on click (`:23`, `aria-label="Open last battle in Film Room"` at `:25`). It is a launcher card; the `onReview` prop is wired by its parent to the filmRoom navigation. (Note: the filmRoom navigation pattern `setScreen('filmRoom')` also appears at `App.jsx:9193` as `onOpenFilmRoom` on `BattleViewScreen` — a sibling entry point, not ReviewStation's wiring.)

#### Natural host for a Training Report (XP earned, atoms gathered, claim movements)

The **Film Room** is the natural host for a *per-battle* Training Report: it is the only surface keyed to a single `agentBattles/{id}` doc, it is already the post-battle debrief home, and it already stacks per-day summary cards a new "Training Report" card would slot beside (`FilmRoomScreen.jsx:127-165`). The **Evolution / AgentRecordSheet** surface is the complementary host for *cumulative* XP/level progression (it already renders level progress and a lifetime timeline), but it is per-agent and never reads a battle doc, so it cannot host per-battle atom/claim deltas. A per-battle "atoms gathered / claim movements" panel therefore belongs in the Film Room.

#### Client-readability of C1–C3 learning collections under current `firestore.rules`

The learning block (`firestore.rules:663-711`) is explicitly "DARK-INERT," server-write-only; nothing reads/writes until Phase B behind `LEARNING_L1_CAPTURE_ENABLED` (false at merge) (`firestore.rules:664-682`).

- **C3 Dossiers — `learningDossiers/{agentId}`: CLIENT-READABLE for owner only; no client writes.**
```
// firestore.rules:687-691
match /learningDossiers/{agentId} {
  allow read: if request.auth != null && request.auth.uid == resource.data.userId;
  allow write: if false;  // Admin SDK only
}
```
- **C2 Evidence atoms — `learningEvidence/{agentId}/atoms/{atomId}`: NOT client-readable, no client writes.**
```
// firestore.rules:695-698
allow read:  if false;   // Admin SDK only
allow write: if false;   // Admin SDK only
```
- **C1 Receipts — `learningReceipts/{battleId}/receipts/{receiptId}`: NOT client-readable, no client writes.**
```
// firestore.rules:702-705
allow read:  if false;   // Admin SDK only
allow write: if false;   // Admin SDK only
```

So a Training Report sourced from **receipts (C1) or evidence atoms (C2)** cannot read them client-side today — they are server-write-only AND client-read-blocked; any per-battle atom/receipt readout would require a server-computed projection (into the battle doc or the dossier). Only the **dossier (C3)** is client-readable, owner-only, and only once a writer/rule deploy exists (dossier is schema-only / no writer this phase per the repo's learning notes; the rule allows read but no client path populates it yet).

**Divergences:** None between observed code and the audit's file-map pointers.

**FLAGS:**
- **[note] Learning rules are code-only, not confirmed-deployed.** `firestore.rules:679-682` states rules "don't auto-deploy from code; nothing writes or reads these collections until Phase B." The quoted allow/deny reflect the checked-in file, not necessarily the live Firestore project — the dossier read should not be assumed live until a manual Console deploy is confirmed. (`firestore.rules:655-656,679-682`)
- **[note] No per-battle XP/atom/claim field exists on the battle doc today.** The Film Room reads only `timing.tradingDays / dailyReviews / chatExchanges / trades / portfolio` (`FilmRoomScreen.jsx:44-69`) and the Evolution timeline only agent-doc fields (`evolutionTimeline.js:79-167`); no `xp`, `atoms`, or `claims` field is read by any post-battle surface. A Training Report needs a new server-written field on `agentBattles` (or a dossier projection) — no client-readable source presently carries that data.

---

---

## Consolidated FLAG list (34)

All flags are **report-only** (BUILD_RULES §3 — found-a-bug-outside-your-task → report, do not fix). Grouped by severity, then item order. None were acted on.

| # | Item | Severity | Citation | Finding |
|---|---|---|---|---|
| 1 | A3 | P1 | `api/cron/compute-index-intelligence.js:859` | Market regime is persisted only in overwrite-in-place singleton docs (indexIntelligence/marketContext, indexIntelligence/dailyRegimeBrief) with no dated history; 'regime as of battle date' cannot be recovered deterministically after the next cron run. |
| 2 | A1 | P2 | `api/cron/agent-evaluate.js:2022` | L1 captureSwapReceipt is called only in the autopilot-executed-swap branch (verified sole production call site); risk-manager, gameplan, and proposal swaps get a trades[] receipt but NO learning receipt, so the learning corpus omits those decision classes. |
| 3 | A3 | P2 | `api/_utils/battlePatternLogger.js:21` | battlePatterns.marketRegime is a live read of the indexIntelligence/marketContext singleton at completion time (defaults 'unknown'); marketContext has no forDate, so the label can reflect a later market state than the battle window and is not tied to the battle's actual dates. |
| 4 | A4 | P2 | `api/cron/agent-evaluate.js:2598` | Sites 3 & 4 (approved/expired-copilot proposal execution) fall back to `proposal.evaluationMetadata \|\| {}` — a proposal without evaluationMetadata would persist a swap with NO source key. Dormant (launch-guarded + builder at :2148-2173 always sets it) but a silent source-loss path. |
| 5 | B1 | P2 | `src/constants/agentProgression.js:110` | getQueuedRulesForPromotion is exported and documented (TODO at :96-100) as the level-up rule-promotion path but has zero external callers (grep hits only its own definition + comment); queued rules are never auto-promoted on level-up. |
| 6 | B1 | P2 | `src/components/Agent/OpenChatPanel.jsx:37` | Client shows level-gated chat budget 2/4/6 (getLevelConfig.chatBudget) while server enforces flat limit 10 (MODE_BUDGET.battle); client cap can block sends the server would allow (client/server drift). |
| 7 | D3 | P2 | `src/services/forgeService.js:395` | maxRulesPerBundle enforced only client-side in forgeService.addRuleToBundle (direct Firestore write). reforge-bundle.js imports no FORGE_LIMITS/maxRulesPerBundle (grep: no matches); equip-bundle.js enforces only maxBundles (:109). No server-side per-bundle rule-count re-check. |
| 8 | A1 | NOTE | `api/agent/set-tempo-dial.js:87` | set-tempo-dial computes previousTempo but never persists it; dial state is a single mutable dials.tempo + updatedAt, so past dial config is not reconstructable from the agent doc. |
| 9 | A1 | NOTE | `api/_utils/swapProvenance.js:33` | buildSwapProvenance returns {} when provenance is falsy, so version stamps (dialBandVersion/knobConfigVersion) are not guaranteed present on every receipt. |
| 10 | A3 | NOTE | `api/_utils/agentRegimeClassifier.js:25` | Three distinct regime taxonomies coexist with no single canonical battle-level label: market bull/correction/bear/recovery (indexIntelligence.js:27), per-stock directional_expansion/contraction/choppy/distressed (agentRegimeClassifier.js:25), and season SPY bullish/bearish/neutral (season-daily-evaluate.js:37-47). |
| 11 | A4 | NOTE | `api/_utils/learning/learningValidators.js:57` | Swap-emit source is not validated against RECEIPT_SOURCES; the fail-closed inSet(receipt.source, RECEIPT_SOURCES) gate lives only in the L1 receipt validator, not on the trades[] emit path. Safe only because the 4 call-site source values are hardcoded literals. |
| 12 | A4 | NOTE | `api/_utils/agentRiskManager.js:528` | receipt.archetype is null unless source==='archetype'; per-archetype MASTERY must recover archetype from battle.agentContext for haiku/risk_manager/guardrail/gameplan swaps. |
| 13 | B1 | NOTE | `src/constants/agentProgression.js:60` | getAgentLevel re-hard-codes the 5/15 games thresholds separately from AGENT_LEVELS.minGames — two sources of truth that can drift. |
| 14 | B2 | NOTE | `src/components/Agent/AgentDashboard.ARCHIVED.jsx:85` | maturityStage raw value is consumed only in ARCHIVED code (AgentDashboard.ARCHIVED.jsx buildScoutingReport, branches on 'fresh'/'growing'); live code uses only the derived speech/deployText strings, so the exported stage token is effectively dead. |
| 15 | B2 | NOTE | `src/services/battleTimer.js:268` | Name collision: agent maturity 'veteran' (games-based, cosmetic, useAgent.js:70) is unrelated to user XP rank 'Veteran' (xp>=500) in determineRank — different subsystems. |
| 16 | B4 | NOTE | `firestore.rules:290` | drafts/{draftId} allows update by any authenticated user with no ownership predicate (allow update: if request.auth != null); free-agency/waiver claims write to the draft doc via client-side updateDoc (draftService.js:295), so this is the known free-agency open-write posture. Does NOT sit above users/ or agents/. Pre-existing; do not fix. |
| 17 | B4 | NOTE | `firestore.rules:86` | users/{uid} doc is owner-writable (create/update if auth.uid==userId, :84-87), and already carries a client-forgeable global stats.xp/level/rank (authService.js:69-79). A mastery.{archetypeId} map attached as a user-doc field would be client-writable/forgeable — contradicting the server-only posture the rules deliberately chose for career rank (firestore.rules:343-354). |
| 18 | B4 | NOTE | `src/services/agentService.js:98` | No existing per-archetype-keyed persisted structure anywhere: byArchetype/perArchetype/[archetype] maps appear only in calibration/eval scripts, never written to users/ or agents/ docs. agent.archetype is a single scalar (agentService.js:98) swapped in place by change-archetype.js:110. There is no existing mastery.{archetypeId} shape to mirror. |
| 19 | C4 | NOTE | `src/services/agentService.js:99` | archetypeDrift is a dead schema field: initialized to null on agent creation (agentService.js:99 and :484) and CPU creation (tournamentCpu.js:71), carried in the training-clone copy list (trainingClone.js:44), but never written with a non-null value by any code path (repo-wide grep confirmed; only null-inits, a test fixture, and two ARCHIVED components reference it). Code comment confirms at evolutionTimeline.js:11. |
| 20 | C4 | NOTE | `api/agent/chat.js:465` | Directive gate does not run in review/debrief mode (chat.js:465-467 routes off/review to the legacy path), so debrief chat turns carry no archetypeGate identity signal. |
| 21 | C4 | NOTE | `api/agent/chat.js:484` | In default observe mode (ARCHETYPE_INTEGRITY_MODE='observe', featureFlags.js:490) the gate forces normalizedDirective=null and effectiveHasDirective=false, so no directive/enforcement/violation event is ever persisted — only the gate's classification of the user ask (archetypeGate.outcome). |
| 22 | D1 | NOTE | `api/_utils/leanRevalidation.js:41` | leanRevalidation.js comments (:40-41, :46-47, :212-213) claim agent.standingLeans and agent.dials are 'owner-writable via the client SDK', justifying DUPLICATE_PIN and bounded-record/dials defenses. Live firestore.rules:149-152 restricts client update to hasOnly(['directives','lastViewedEvolutionCycle','starterKitCompleted','updatedAt']), which omits both standingLeans and dials. Defense-in-depth is harmless but the stated threat model diverges from deployed rules. |
| 23 | D3 | NOTE | `src/constants/agentProgression.js:96` | getQueuedRulesForPromotion (only field-level consumer of playbookSlots) is dead code — TODO comment at :96-100 says it was never wired into any level-up flow; grep finds no caller (only definition + TODO mention). |
| 24 | E1 | NOTE | `api/cron/agent-evaluate.js:150` | Timing dependency (not a defect): agentBattle completeBattle runs from the evaluator's expiry sweep regardless of market hours (agent-evaluate.js:145), which precedes the nightly agent-daily-scores banking window. An intraday-expiring battle is marked completed and leaves the status=='active' query before that night's daily cron; the final day's badge points are already folded into currentScore by the evaluator's own live pass (bankedBadgePoints.total, agent-evaluate.js:696-697), so an XP hook keyed on currentScore at completedAt is correct, but one that waited for the daily banking cron would miss such a battle. |
| 25 | E1 | NOTE | `api/cron/agent-evaluate.js:702` | completeBattle writes no dedicated finalScore field; the immutable score of record is scoreState.currentScore (last written by the evaluator's live pass at agent-evaluate.js:702, which folds activeScore+bankedScore+bankedBadgePoints.total). No post-completion recompute path exists. |
| 26 | E1 | NOTE | `api/cron/agent-evaluate.js:3145` | There is no unified settlement stage: 'settlement' spans agent-daily-scores badge banking, tournamentBanking user-layer banking (riding snake-draft-daily-scores.js:482), agentBattle completeBattle (agent-evaluate.js:3145), a legacy drafts-collection completeBattle (snake-draft-daily-scores.js:426-437), tournamentAdvancement per-week group completion (tournamentAdvancement.js:309/625), and training rolling-completion (trainingLifecycle.js:645). An XP hook must target the per-agentBattle point. |
| 27 | E4 | NOTE | `api/cron/agent-evaluate.js:2022` | Durable learningReceipts written at exactly one site (agent-evaluate.js:2022, the autopilot-executed Haiku/guardrail swap path built at :1906); risk-triggered (:1347), copilot proposal (:2166), and gameplan-meeting (:2817) swaps spread buildSwapReceiptSource/evaluationMetadata but never call captureSwapReceipt, so no receipt doc is written for those swap sources. Verified by grep: captureSwapReceipt appears only at :2022 in the file. |
| 28 | E4 | NOTE | `api/_utils/agentBattleService.js:112` | Tournament/training battle docs carry no explicit isTraining boolean — createAgentBattle stamps only groupId (+isCpu). But training battles ARE doc-identifiable via agentId prefix 'training-agent-' (clone id, leagueTournament.js:343-348, set at trainingClone.js:148/168) and CPU via 'cpu-agent-'/isCpu — the same signals classifyEvidence uses (captureReceipt.js:56-61). The 'battle doc alone cannot tell them apart' claim is too strong. |
| 29 | E4 | NOTE | `api/_utils/tournamentBanking.js:388` | bankAllTournamentGroups selects BATTLE groups with players.length===GROUP_SIZE(4) and no isTraining filter; a training pod (1 human + 3 CPU = 4) satisfies it, so training pods' agent-layer scores are group-banked — training is not settlement-isolated at this layer. |
| 30 | E4 | NOTE | `src/firebase/firebaseService.js:1262` | Base-layer V3 (battles collection, createBaggerBombBattleV3) has no dedicated cron scorer in api/cron/; only V4 has baggerbomb-v4-daily-scores.js. V3 is scored client-side. |
| 31 | E5 | NOTE | `api/cron/compute-index-intelligence.js:860` | indexIntelligence/marketContext doc has no forDate/date field (only updatedAt + mode), so — unlike dailyRegimeBrief which carries an explicit forDate — its regime value has no self-contained same-day freshness stamp; freshness must be judged from updatedAt. |
| 32 | E5 | NOTE | `api/agent/decide.js:1169` | CPU-owned tournament battles (isCpu === true) skip generateFirstMessageOnDeploy, so the deploy request does NOT read the regime docs for that path; the 'already reads both docs' feasibility convenience holds only for solo/BaggerBomb deploys and human-owned tournament deploys. Reachability itself is unaffected (fixed-id docs). |
| 33 | E6 | NOTE | `firestore.rules:679` | Learning-collection rules are code-only per firestore.rules:679-682 ('rules don't auto-deploy from code; nothing writes or reads these collections until Phase B'); the quoted allow/deny reflect the checked-in file, not a confirmed live deploy. |
| 34 | E6 | NOTE | `src/screens/FilmRoomScreen.jsx:44` | No per-battle XP/atom/claim field is read by any post-battle surface today; Film Room reads only timing.tradingDays/dailyReviews/chatExchanges/trades/portfolio, so a Training Report needs a new server-written battle-doc field or dossier projection. |

---

## Biggest risk to the design (author’s own read of the code)

The single biggest risk is that the **decision-level attribution the design assumes is only half-present, and the half that is missing is the archetype half** — precisely the "cheap now, impossible retroactively" data the Strategy-Layer bookmark warned about. The **agent-leg score is clean and durably archetype-stamped per battle**: `agentBattles.scoreState.currentScore` is computed only from the agent’s own portfolio (no user-pick confound, A2), and `agentContext.archetype` is *frozen at battle creation* (`agentBattleService.js:158`), so a deterministic XP number keyed to a specific archetype under a specific battle is genuinely recoverable today from `agentBattles` — this is the design’s solid foundation, and it is the collection an XP reader must consume (not the owner-aggregated group snapshot). **But everything downstream of the *score* is thin.** (1) At the *decision* grain, the swap receipt records the archetype **name** only for stagnation forced-rotation swaps (`source==="archetype"`); every haiku, risk-manager, guardrail, and gameplan swap carries `archetype:null` (A1/A4), and the L1 `learningReceipts` corpus — the intended substrate for "archetype-faithful play" rewards and archetype-scoped lessons — carries **no archetype identity at all** (only a `source` class and a *global* `archetypeIntegrityMode` flag), and is written at exactly one call site, so risk/gameplan/proposal decisions never enter it. Recovering archetype for those decisions means joining `battleId`→`agentContext.archetype`, which works per-battle but not per-*decision* once you need the config-that-was-live nuance. (2) The **lessons half is essentially greenfield**: there is no claim schema in code (C1), the evidence atom is an 8-field stub with no writer (C2), the dossier has `lessons:[]` and no writer, and the entire Hunch/Testable/Trial-proven maturity, promotion-threshold, and claim-freeze machinery exists only in the V1.3 doc (C3). "Lessons remain evidence-gated under the frozen L1 maturity model" describes a model that is **not built** — it is Phase-B code. (3) The **identity-adherence XP component has no deterministic persisted signal**: archetype drift detection does not exist (dead `archetypeDrift` field), the one per-battle identity signal (`archetypeGate`) is an LLM classification of the *user’s ask* that never fires in the default observe mode, and consolidation is per-agent, not per-battle (C4). (4) **Regime conditioning of trials is not retroactively answerable** — no battle carries a regime stamp and the two market-regime docs are overwrite-in-place singletons with no dated history (A3), though a *forward* `regimeAtCreation` stamp is cheap (E5). **Net:** the XP track is feasible now off `agentBattles` (bounded by the 2026-07-03 source-tagging cutover for any backfill, A4), but the *archetype-scoped lessons* track and the *identity-adherence* reward component both rest on unbuilt L1 Phase-B substrate and on a per-decision archetype attribution that is currently null for the majority of swap sources. The prerequisite work is therefore not "wire XP into settlement" (settlement has a clean immutable hook at `completeBattle`, E1) — it is **closing the archetype-attribution gap at the receipt/atom layer and building the dossier/lesson writer** before any archetype-scoped learning can be spec’d against real data. Do that while the corpus is small; it is the item that becomes impossible to reconstruct later.

---

*End of report. HARD STOP — awaiting founder review before spec drafting.*
