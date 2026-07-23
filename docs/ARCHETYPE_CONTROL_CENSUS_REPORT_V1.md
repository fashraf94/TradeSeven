# Archetype & Control Census — Phase 0 Discovery Report V1

**Program:** Archetype Architecture (Phases 0–6) · **Mode:** READ-ONLY DISCOVERY — HARD STOP AT END
**Repo:** `fashraf94/TradeSeven` · **HEAD:** `a26cc192` (Merge PR #644) · **Date:** 2026-07-23

---

## Preamble

**Baseline & git state.** `git fetch origin` was run at session start (BUILD_RULES §3). HEAD `a26cc192` **==** `origin/main` (0 ahead / 0 behind), working tree clean. Nothing in the repo was modified, created, branched, or committed — this is a read-only census, and per the census mandate and BUILD_RULES §3 (line 40) this report is delivered as a file **outside the repo tree**, not committed into it.

**Method.** Discovery ran as a 12-cell read-only sweep (baseline verification, the six maps, and the runtime touchpoint inventory), each cell an independent agent reading code at HEAD and citing `file:line`. Every load-bearing baseline/freeze/collision claim below (settlement transaction, eval budget, `SECTOR_CAP_MODE`, `EXPIRED`/`progressVersion`, `ruleSnapshots` freeze, the firestore.rules agents-doc substrate) was **independently re-verified against the code** during synthesis; those carry a VERIFIED marker grounded in a direct read this session.

**Citation convention (BUILD_RULES §3).** Every material claim carries a `path/file.js:line` citation and a **VERIFIED** marker (code read this session) or **UNVERIFIED** (could not be grounded — e.g. a live-ops datapoint or a deploy-state fact). Where live code contradicts a plan/spec/comment, the **code is reported** and a contradiction is logged with both citations. Design-doc anchors drift; all anchors here are re-verified at HEAD.

**Scope.** IN: the archetype/control substrate (identity, physics, constraints, rules, traits, leans, tempo, collections, guardrails, freeze, receipts, cron touchpoints). OUT (read only where archetype identity/config enters, not scoped into): snake-draft autopick / lobby internals, LevelStory (`research/level-study/`), FantasyTimes, Academy/Remotion, the Forge VPS agent codebase.

**Fence note (BUILD_RULES §1).** The calibration-fenced files are read freely; every finding that would eventually require an edit to one is flagged as a **§7-gated fence contact** (57 such contacts catalogued across the maps). Two fence-list discrepancies surfaced and are logged: the census prompt fence-flags `tournamentUserScoring.js` (absent from the BUILD_RULES §1 enumerated list), and `archetypeScoring.js` (the archetype-ranking engine, where archetype #7's weights/constraints live) is not in the §1 file list though the "scoring engine" concept is fenced — both need a founder ruling.

---

## Executive verdict

Compact status of the biggest findings. Status vocabulary: **BUILT** (code guarantees it) · **PROMPT-ONLY** (injected text, model usually complies) · **UNENFORCED** (declared, reaches runtime nowhere) · **DARK** (merged, gated off) · **CONTRADICTION** (code contradicts a plan/comment/value) · **FOUNDER-VERIFY** (needs live-console / sign-off confirmation).

| # | Finding | Where | Status |
|---|---|---|---|
| 1 | **`SECTOR_CAP_MODE = 'true'`** matches neither `'enforce'` nor `'observe'` — the Diversifier sector cap is **fully inert** despite a value that reads "on" (7 agents independently flagged this) | 1.5 · Maps 1/2/3b/4/5 | **CONTRADICTION** |
| 2 | Settlement `completeBattle` is ONE guarded `runTransaction` folding battle-status + mastery stamp + agent-stats + `activeBattleId` clear (pointer-guarded) — PR #640 claim confirmed | 1.1 | BUILT |
| 3 | `GROUP_STATUS.EXPIRED` + `progressVersion` fully merged at HEAD; the automatic expiry sweep is gated off (`POD_EXPIRY_SWEEP_ENABLED=false`) — live only via the manual admin endpoint | 1.3 | DARK |
| 4 | Eval budget = 290s wall-clock, sequential one-Haiku-per-battle, `maxDuration:300`; the binding constraint at HEAD is the **active-battle count**, not the budget (Jul-22 "19.9s/8" ≈ 2.5s/battle) | 1.4 | BUILT |
| 5 | Equipped Forge "CONSTRAINTS (must obey)" are **prompt text only** — no deterministic gate reads `activeRules`; only the separate `deployedGuardrails` object is code-enforced | Maps 2/3b | PROMPT-ONLY |
| 6 | Archetype physics partly dead: `convictionMods`, `sectorConcentrationCap`, `regimePreferences.canEnterDistressed`, `tradeFrequency` have **zero runtime consumers** (config header over-claims "real mechanical effects") | Maps 1/2 | UNENFORCED |
| 7 | Archetype knob values (`hftConfig`), preset risk levers, and tempo bands resolve **LIVE at tick** keyed by a frozen scalar — a redeploy re-tunes in-flight battles mid-run (the primary freeze-boundary gap) | Map 5 | (freeze gap) |
| 8 | Rules are **double-frozen** (equip-time `ruleSnapshots` → deploy `projectActiveRules` + conflict-reconciler → lock-time `createAgentBattle`); leans revalidated with resolved text and frozen | Map 5 | BUILT |
| 9 | `swapDecisionReceipt (BEM)` is **named-but-unbuilt** (zero code hits); the built artifact is the outcome-blind `learningReceipts` predicate receipt; 7 of 8 receipt version stamps are hardcoded `null` | Maps 6/5 | UNBUILT |
| 10 | L1 capture is live at **only the Haiku-autopilot swap site** (`EXPANSION=false`) — risk-manager, guardrail, gameplan, and expiry swaps produce **no receipt** | Map 6 | DARK |
| 11 | **No durable proof** of which equipped rule / lean / trait / constraint affected a decision — only Haiku's self-reported `cited_rules` (display, not a deterministic ledger) | Map 6 | PARTIAL |
| 12 | `FORGE_HARDSOFT_AUTHORING_ENABLED = true` with a stale "GATED OFF until…sign-off" comment; the fenced enforcement path is verified landed (hardness projected + honored in both prompt builders) | 1.5 · Maps 2/3 | CONTRADICTION |
| 13 | `firestore.rules` (45,996 B) + the archetype composite index require a **separate manual `firebase deploy`**; whether the live console matches HEAD is not repo-determinable | 1.2 · 1.5 | FOUNDER-VERIFY |
| 14 | agents-doc CREATE allowlist blocks client-born sensitive fields; `stats` born at server-default zeros; delete denied; bundle status a closed client transition vocabulary; equipped-bundle content client-immutable | 1.2 | BUILT |
| 15 | Two trait channels coexist unreconciled: `personality.traits` (rendered into the fenced strategy prompt + boards) vs `equippedTraits`→`activeRules` projection | Map 4 | (collision) |
| 16 | Two aggressiveness controls with no declared precedence: the **frozen** tempo dial vs the **live-mutable** `strategyPreset` | Map 4 | (collision) |
| 17 | `deployedStrategy.directives` are generated, stored, and shown in SeasonReview but **never reach the battle prompt** (only guardrails are snapshotted) | Map 4 | UNENFORCED |
| 18 | 143 `agentUseDescription` strings promise deterministic filtering ("automatically exclude", "filter out") the soft prompt-injection substrate does not deliver | Map 3a | (display gap) |
| 19 | The typed per-archetype sector `prefer`/`lean_away` matrix and the "±15% clamp" are **designed-not-built** (`PASS_THROUGH_SECTORS` frozen empty, DEFERRED) | Map 1 | UNENFORCED |
| 20 | To create archetype #7 today: a bounded set of DATA entries (identity/display, adjustments allowlist, seeding weights) + CODE changes in `archetypeScoring.js` (weights/constraints) and the onboarding derivation router — several fence-adjacent | Map 1 | (see Map 1) |


---

# Part 1 — Baseline verification

## Part 1.1 — Settlement & lock path (post-#640)

All anchors re-verified at HEAD `a26cc192`. `api/cron/agent-evaluate.js` is 3960 lines (VERIFIED, `wc -l`).

### A. Settlement — `completeBattle()` (the guarded terminal transaction)

`completeBattle(db, battle, summary, masteryFlagView, masteryGroupCache, masterySiblingsCache)` is defined at `api/cron/agent-evaluate.js:3646` (VERIFIED). Its terminal write is a single `db.runTransaction` opened at `api/cron/agent-evaluate.js:3653` (VERIFIED). This is **non-fenced** — `agent-evaluate.js` is not in the BUILD_RULES §1 list.

**Transaction boundary (prose diagram).** Inside the one transaction, exactly two reads precede all writes (Firestore read-before-write, called out in the code comment at `api/cron/agent-evaluate.js:3670` VERIFIED):

1. **READ battle** — `t.get(battleRef)` at `:3654`; `fresh = {id, ...snap.data()}` at `:3656` (VERIFIED).
   - Guard A (missing): `if (!snap.exists) return {committed:false, reason:'missing'}` at `:3655` — aborts before any write (VERIFIED).
   - Discriminator: `isBareGcCompletion = status==='completed' ∧ pendingReflection===undefined ∧ completionReason==='expired'` at `:3657-3660` (VERIFIED).
   - Guard B (idempotency / already-terminal): `if (fresh.status !== 'active' && !isBareGcCompletion) return {committed:false, reason:'already_terminal'}` at `:3661-3663` (VERIFIED). This is the state guard that makes the writer no-op against an already fully-completed doc, defeating stolen-lock / decide.js-GC double-completion.
2. **READ agent** — `completionAgentId = fresh.agentId ?? battle.agentId` at `:3675`; `agentRef` resolved (null if id missing) at `:3676-3678`; `agentSnap = agentRef ? await t.get(agentRef) : {exists:false}` at `:3679` (VERIFIED). A missing/corrupt agentId degrades to a `{exists:false}` stub → both stats branches no-op, completion still commits (legacy semantics, comment `:3671-3673` VERIFIED).

Then, still inside the transaction, up to two writes:

3. **WRITE battle** — `t.update(battleRef, updatePayload)` at `:3794` (VERIFIED). `updatePayload` (built `:3737-3792`) carries: `status:'completed'`, `completedAt:now`, `pendingReflection: disposition.pendingReflection`, `reflectedAt:null`, `'cronState.evaluatingAt':null` (the eval lock release), a capped `statusFeed` append, and conditionally `completionContext` (`:3757-3759`), retired `vision` (`:3760-3762`), and mastery `stampFields` merged via `maybeBuildEligibilityStampFields` (`:3784-3791`). **Repair branch** (`isBareGcCompletion`): `delete updatePayload.status` / `delete updatePayload.completedAt` (`:3770-3771`) — keeps the GC's earlier completion instant — and re-tags `completionReason='expired_repaired'` (`:3779`) so the doc drops OUT of the repair query server-side; the repair branch never writes a mastery stamp (`:3766-3779`, VERIFIED).
4. **WRITE agent (pointer + stats, FOLDED — PR #640 / ruling B3)** — the pointer guard `pointerCurrent = agentSnap.exists && agentSnap.data()?.activeBattleId === battle.id` at `:3809` (VERIFIED) gates two mutually exclusive branches:
   - No-stats branch (tournament / CPU, `!disposition.updateAgentStats`): `if (pointerCurrent) t.update(agentRef, {activeBattleId:null})` at `:3810-3813` (VERIFIED).
   - Stats branch (tiered W/L): `t.update(agentRef, {stats:{wins,losses,draws,gamesPlayed,totalScore,avgScore,currentStreak,bestStreak}, ...(pointerCurrent ? {activeBattleId:null} : {})})` at `:3832-3844` (VERIFIED). Streak/avg math at `:3816-3830`.

Return `{committed:true, repaired, disposition, currentScore, visionTransitionLogPayload, masteryStamped, freshForAward}` at `:3847` (VERIFIED).

**Post-commit side-effects (OUTSIDE the transaction), in order:** sibling-cache eviction for terminal tournament groups `:3856-3862`; early no-op log + return on `!committed` `:3864-3870`; fire-and-forget `logVisionTransition(...)` `:3874-3876`; **separate** `runAwardTransaction(...)` mastery award (its own transaction, failures logged not thrown) `:3888-3899`; `summary.evaluated++` `:3902` (all VERIFIED).

**PR #640 claim — CONFIRMED.** The claim that `completeBattle` is a guarded transaction folding the agent-stats mutation + `activeBattleId` clearing into the same atomic unit as the status flip is directly borne out: the B3 comment at `:3665-3669` states the legacy sequential `agentRef.get/update` was non-atomic ("a crash between the battle commit and the stats write could strand stats/activeBattleId forever"), and both agent writes (`:3812`, `:3832-3844`) plus the battle status write (`:3794`) execute inside the single `runTransaction` opened at `:3653` (VERIFIED). The in-transaction re-read state guard (`:3661`) is the idempotency mechanism; the `isBareGcCompletion` repair branch (`:3657-3660`, `:3766-3779`) is the repair path. Test photograph: `api/cron/agent-evaluate.masteryCompletion.test.js` and `api/_utils/p4Flips.test.js:220` asserts the literal `t.update(agentRef, { activeBattleId: null });` (VERIFIED via grep).

The GC-repair reachability sweep `repairBareGcCompletions` at `:3927` runs the same `completeBattle` over a bounded `(status='completed', completionReason='expired', completedAt≥sinceIso)` query (`:3929-3935`), invoked from the cron body at `:259-` (§2c) (VERIFIED). The expiry loop that drives normal settlement is at `:194-229`, calling `completeBattle` at `:204` for each battle whose `expiresAt` is past (VERIFIED).

### B. Battle CREATION and the per-tick CLAIM/LOCK site

**Creation.** `createAgentBattle(db, agentData, thresholds, startingPrices, options)` is defined at `api/_utils/agentBattleService.js:55`; the doc is written via `db.collection('agentBattles').add(battleDoc)` at `api/_utils/agentBattleService.js:262`, returning `{id, expiresAt}` at `:263` (VERIFIED). `battleDoc` is assembled `:104-260` with `status:'active'` (`:107`), the frozen `agentContext` config-snapshot block (`:156-184`), and `cronState{..., evaluatingAt:null}` (`:250-259`). **This whole function and its doc shape are FENCED** (BUILD_RULES §1: `agentBattleService.js incl. createAgentBattle doc shape`; the createAgentBattle doc shape is also a fenced *concept*).

Callers live in the FENCED `decide.js`: tiered deploy calls `createAgentBattle(...)` then sets the pointer at `api/agent/decide.js:700`; tournament (flat6) deploy calls it at `:1146-1162` then sets the pointer at `:1164` (VERIFIED).

**Per-tick claim/lock.** The idempotency lock is a **separate** transaction inside `processAgentBattle`, opened at `api/cron/agent-evaluate.js:531` (VERIFIED). It reads the battle doc (`:532`), checks `cronState.evaluatingAt` staleness against `EVALUATING_LOCK_TIMEOUT_MS` (`:534-541`), opportunistically refreshes `battle.controlEpochLog` and `battle.regimeAtStart` from the transaction's own read (`:549-558`), then claims the lock with `transaction.update(battleRef, {'cronState.evaluatingAt': new Date().toISOString()})` at `:561-563` (VERIFIED). This lock is RELEASED inside `completeBattle`'s payload (`'cronState.evaluatingAt': null` at `:3746`) on settlement, or by the finally path on a live tick. Non-fenced (`agent-evaluate.js` cron body).

### C. Hook attach-points (future work — recommendations, not fixes)

**"Freeze manifest at battle lock" hook → FENCED.** The natural and only correct attach site is the `agentContext` freeze block inside `createAgentBattle`, `api/_utils/agentBattleService.js:156-184` (VERIFIED), within the `battleDoc` literal (`:104-260`). This is already the single place where per-deploy config is frozen write-once at lock: `activeRules` (`:161`), `equippedBundleIds` (`:162`), `deployedGuardrails` snapshot (`:163-167`), `equippedWatchlist` snapshot with `snapshotAt` (`:168-175`), and `buildCustomizationSnapshot(agentData, now)` (standingLeans / dials / settingsRev) (`:183`). A freeze-manifest is a summary/hash of exactly this set, so it belongs adjacent to `:183` in the same doc write (`.add` at `:262`). **Fence contact (§7-gated):** this is `agentBattleService.createAgentBattle` and the fenced `createAgentBattle` doc shape — any manifest field added here mutates the fenced doc shape and must be founder-signed.

**"Final receipt write" hook → NON-FENCED.** The natural attach is `completeBattle`. Two options, both in the non-fenced `agent-evaluate.js` cron body:
- *Atomic-with-settlement* (preferred if the receipt must be write-once with the terminal flip): inside the transaction immediately after `t.update(battleRef, updatePayload)` at `api/cron/agent-evaluate.js:3794`, or by folding receipt fields into `updatePayload`.
- *Post-commit side-effect* (preferred if the receipt is a separate doc/subcollection and best-effort): the established pattern block at `:3871-3899`, alongside the fire-and-forget `logVisionTransition` (`:3874`) and the separate-transaction `runAwardTransaction` (`:3888-3899`). A settlement receipt written create-only to `learningReceipts/{battleId}/receipts/{receiptId}` would mirror the existing per-swap `captureSwapReceipt` writer (`api/_utils/learning/captureReceipt.js:405-410`, create-only `ref.create(receipt)` `:411`, VERIFIED) — note the existing receipt corpus is per-swap during ticks (`captureSwapReceipt` called at `agent-evaluate.js:1655,2290,2930,3125,3332`), NOT at settlement, so a *final* receipt is genuinely a new hook. **No fence contact** for the completeBattle attach itself; but if the final receipt's shape is derived from the scoring engine or the createAgentBattle doc shape, those source *concepts* are fenced (read-only is fine; the receipt write is not).

### D. `activeBattleId` setters and clearers (repo-wide)

Census G2 claim — **CONFIRMED**: all four production SETTERS live in the FENCED `api/agent/decide.js`. Clearers are the pointer-guarded pair inside `completeBattle` (non-fenced).

| Kind | Site | Value written | Context | Fence |
|---|---|---|---|---|
| SETTER 1 | `api/agent/decide.js:553` | `existingBattleId` | re-sync to an existing non-expired tiered battle | FENCED |
| SETTER 2 | `api/agent/decide.js:700` | `battleResult.id` | after new tiered `createAgentBattle` deploy | FENCED |
| SETTER 3 | `api/agent/decide.js:1104` | `existingBattleId` | re-sync to existing non-expired tournament battle | FENCED |
| SETTER 4 | `api/agent/decide.js:1164` | `battleResult.id` | after new flat6/tournament `createAgentBattle` deploy | FENCED |
| CLEARER 1 | `api/cron/agent-evaluate.js:3812` | `null` | completeBattle no-stats branch, `pointerCurrent`-guarded | non-fenced |
| CLEARER 2 | `api/cron/agent-evaluate.js:3843` | `null` | completeBattle stats branch, `pointerCurrent`-guarded | non-fenced |
| INIT (not a live clearer) | `api/_utils/trainingClone.js:113` | `null` | initial value on training-clone creation | non-fenced |

All rows VERIFIED via `git grep activeBattleId`. Note: `decide.js:588` and `decide.js:1115` are the fenced expiry-GC bare writes (`status:'completed', completedAt, completionReason:'expired'` — `:588-592`, `:1115-1119`) referenced by completeBattle's repair-branch comment (`:3618`); they mutate battle status, NOT `activeBattleId`, and are exactly the "bare GC completions" the repair branch finishes in place (VERIFIED). Pointer clearing was deliberately made conditional (`pointerCurrent`) precisely because these fenced GC writers re-point the agent at a fresh deploy the moment they GC — unconditional nulling would drop the lock out from under a LIVE battle (comment `:3803-3808`, VERIFIED).


---

## Part 1.2 — firestore.rules write-permission substrate

Repo TradeSeven @ HEAD `a26cc192`; source `firestore.rules` (890 lines), `firestore.indexes.json` (407 lines), `firestore.rules.emulator.test.js` (511 lines). All line cites below are `firestore.rules:line` unless another file is named. Every row was read this run (VERIFIED) or is marked UNVERIFIED where it depends on a runtime/deploy fact I cannot observe from the tree.

This is the *substrate the compiler must respect*: it fixes, per collection/site, exactly what a client-SDK write (a candidate compile step running under a user's auth) can and cannot put on disk. Anything the rules deny is reachable only through the Admin SDK (Vercel serverless / cron), which bypasses these rules entirely.

### A. The write-permission matrix (agent / bundle / battle / learning surfaces)

| Path | Op | Client-writable? | Server-only? | Allowlisted / pinned fields | Transition vocab / constraints | Cite |
|---|---|---|---|---|---|---|
| `agents/{agentId}` | create | Yes (owner) | partial | `ownerId==auth.uid` required; **absent-list** (must NOT appear): `standingLeans, dials, settingsRev, equippedTraits, deployedStrategy, activeBattleId, lessons, forgeSuggestions, isTrainingClone`; `stats` if present forced to exact zero shape `{wins,losses,gamesPlayed,totalScore,avgScore,currentStreak,bestStreak}` all `==0` (`hasOnly` pins key set); `activeRules`/`equippedBundleIds`/`memory` if present must be empty lists; `consolidatedInsight`=='' ; `evolutionCycle`==0 | Sensitive/progression/cognition fields born at server defaults or not at all. `equippedWatchlistId` if non-null must be a `watchlists/*` doc whose `userId==auth.uid` (cross-doc `get()`); `equippedWatchlistName` string ≤120; `equippedAt` string-or-null | L169-218 VERIFIED |
| `agents/{agentId}` | update | Yes (owner) | — | `diff().affectedKeys().hasOnly(['directives','lastViewedEvolutionCycle','starterKitCompleted','updatedAt'])` | Only these 4 keys ever mutable client-side. `stats`, `activeRules`, `standingLeans`, `dials`, `settingsRev`, `archetype`, `config`, `equippedBundleIds`, `equippedWatchlist*`, `ownerId`, `memory`, `evolutionCycle` all **denied on update** → server-only going forward | L219-222 VERIFIED |
| `agents/{agentId}` | delete | **No** | n/a | — | `allow delete: if false` (hard-denied; owner deletion would orphan subtrees/`activeBattleId`; real deletion must be a server endpoint) | L234 VERIFIED |
| `agents/{id}/rules/{ruleId}` | create,update | Yes (owner via cross-doc `get(agents/{agentId}).ownerId==auth.uid`) | — | Field-level validation only (NO `hasOnly` — extra keys allowed): `textTemplate` null-or-string ≤500; `paramValues` null-or-map ≤5 keys; `status in ['draft','testing','active','proven','queued']`; `priority` number; `traitId` string; `provenance in ['user_equipped','archetype_default']` | Soft-delete only | L238-262 VERIFIED |
| `agents/{id}/rules/{ruleId}` | delete | **No** | n/a | — | `allow delete: if false` | L263 VERIFIED |
| `agents/{id}/bundles/{bundleId}` | create | Yes (owner cross-doc get) | — | `keys().hasOnly([name, version, previousVersionId, status, ruleIds, ruleSnapshots, conflictCheckResult, createdAt, forgedAt, equippedAt, archivedAt, updatedAt, performanceData, entrySource, hiddenFromBundleList, dimensionHash, dimensionValues, dimensionSchemaVersion, compileConfidence, compileTransparency])` — **20 keys; `ruleHardness` NOT in the set** (server-mintable only) | Birth status `in ['draft','forged']` only — never born `equipped`/`archived` | L274-277 VERIFIED |
| `agents/{id}/bundles/{bundleId}` | update | Yes (owner cross-doc get) | — | Same 20-key `hasOnly` on `diff().affectedKeys()`; `ruleHardness` excluded | **Closed status vocabulary:** allowed transitions are `draft→forged`, `draft→archived`, `forged→archived`, plus statusless/null backfill → `{draft,forged,archived}`. **Never INTO `equipped`, never OUT of `equipped`, never `archived→*`, never `→draft`** (reforge is the server path back to draft). **Equipped-content freeze:** if `resource.status=='equipped'`, may not touch `['ruleIds','ruleSnapshots','ruleHardness','name']` | L278-321 VERIFIED |
| `agents/{id}/bundles/{bundleId}` | delete | **No** | n/a | — | `allow delete: if false` (archive-only) | L322 VERIFIED |
| `agents/{id}/battlePatterns/{patternId}` | write | **No** | Yes | — | `allow write: if false`; owner-read only | L326-330 VERIFIED |
| `agentBattles/{battleId}` | update | Yes (owner) | partial | `diff().affectedKeys().hasOnly(['executionMode','pendingProposal','battleLedger','updatedAt','strategyPreset','gameplanMeeting','gameplanMeetingHistory','dailyGrades','feedBookmarks','reviewDecisions'])` | Execution-control fields only; everything else (scores, agentContext, status, settlement) server-only | L340-343 VERIFIED |
| `agentBattles/{battleId}` | create, delete | **No** | Yes | — | `allow create, delete: if false` (cron mints/settles via Admin SDK) | L345 VERIFIED |
| `learningDossiers/{agentId}` | read only | read: owner (`auth.uid==resource.userId`) | write: Yes | — | `allow write: if false` — the ONE client-readable learning surface | L810-813 VERIFIED |
| `learningEvidence/{agentId}/atoms/{atomId}` | — | **No read, no write** | Yes | — | both `if false` | L818-821 VERIFIED |
| `learningReceipts/{battleId}/receipts/{receiptId}` | — | **No read, no write** | Yes | — | both `if false` | L825-828 VERIFIED |
| `learningCalibration/{manifestVersion}` | — | **No read, no write** | Yes | — | both `if false` | L831-834 VERIFIED |
| `masteryProfiles/{userId}` | read only | read: owner | write: Yes | — | `allow write: if false` (award transaction is Admin SDK) | L848-852 VERIFIED |
| `masteryConfig / masteryQuarantine / masteryAudits` | — | **No read, no write** | Yes | — | all `if false` | L856-877 VERIFIED |
| `watchlists/{watchlistId}` | read only | read: owner (`resource.userId==auth.uid`) | write: Yes | — | `allow create,update,delete: if false` — note this is the doc the agent-create `equippedWatchlistId` guard cross-reads (L211) | L761-765 VERIFIED |
| `{document=**}` | read, write | **No** | — | — | default-deny catch-all (denies e.g. the not-yet-shipped `masteryCorrections`) | L886-888 VERIFIED |

There is **no `activeRules` subcollection and no `standingLeans`/`dials`/`equippedTraits`/`tempoDial` write site anywhere in the rules** — those live as fields on the `agents/{id}` doc and are all excluded from the L219-222 update allowlist, so **every lean/tempo/trait/activeRules mutation is Admin-SDK-only** (the equip-lean / set-tempo-dial / equip-bundle transactional endpoints). VERIFIED by absence: no `match` block names them and the update allowlist omits them (L221-222).

### B. Confirming the PR-described rewrite items

| PR rewrite item | Status | Evidence |
|---|---|---|
| agents-doc CREATE allowlist | **VERIFIED** | L169-218 — `ownerId` bound to caller, `hasAny` absent-list denies 9 sensitive fields, per-field pins on stats/activeRules/equippedBundleIds/memory/consolidatedInsight/evolutionCycle/equippedWatchlist trio |
| sensitive fields at server defaults | **VERIFIED** | stats forced to zero shape L174-184; activeRules/equippedBundleIds/memory forced empty L185-193; consolidatedInsight '' L194-195; evolutionCycle 0 L196-197 |
| stats server-only | **VERIFIED** | create forces zero shape L174-184; update allowlist L221-222 omits `stats` → any client stats mutation denied. Increments come from agent-evaluate (Admin SDK) per comment L152-154 (UNVERIFIED that agent-evaluate does the increment — not read this run; the comment asserts it) |
| delete denied | **VERIFIED** | L234 `allow delete: if false` |
| bundle status closed client transition vocabulary | **VERIFIED** | L281-321 — closed set draft→forged, draft→archived, forged→archived, statusless/null backfill; never into/out of `equipped` |
| equipped-bundle content client-immutable | **VERIFIED** | L320-321 — on `status=='equipped'`, `hasAny(['ruleIds','ruleSnapshots','ruleHardness','name'])` denied |
| capacity at equip time | **NOT enforced by firestore.rules (server-side)** | The rules comment (L308-319) states the *rationale* — content-freeze exists so a bundle can't be inflated after passing the equip-time capacity check — but the **capacity check itself is not in the rules**; it lives in the equip-bundle endpoint (Admin SDK). Rules only freeze content post-equip. UNVERIFIED where capacity is enforced (endpoint not read this run). Flag: a compile step cannot rely on firestore.rules to bound bundle size at equip. |

**Lockstep invariant confirmed.** The create-allowlist stats key set + zero values (L176-184) exactly mirror the live `createAgent` seed at `src/services/agentService.js:120-128` (`{wins,losses,gamesPlayed,totalScore,avgScore,currentStreak,bestStreak}` all 0) — VERIFIED. `createAgent` also seeds `memory:[]` (agentService.js:105), `consolidatedInsight:''` (106), `activeRules:[]` (108), `equippedBundleIds:[]` (109), `evolutionCycle:0` (131), `starterKitCompleted:false` (120), and does NOT set any absent-list field — so the live client create path passes the L169-218 allowlist. VERIFIED. Any change to that seed's stats shape breaks agent creation in prod unless the rule + test change in lockstep (the L164-168 warning).

### C. Composite indexes relevant to archetype / leans / receipts, and manual-deploy flags

`firestore.indexes.json` declares **no index for `agents`, `bundles`, `rules`, `standingLeans`, or any `learning*` / `mastery*` collection.** The learning receipts/evidence/dossier/calibration collections have **zero composite indexes** (queried by full doc path only, or Admin-SDK single-field). Relevant declared indexes:

| Collection | Fields | Relevance | Cite |
|---|---|---|---|
| `agentBattles` | ownerId ASC, agentId ASC, createdAt DESC | per-agent battle history | indexes.json:199-215 VERIFIED |
| `agentBattles` | status ASC, pendingReflection ASC, completedAt ASC | reflection sweep | indexes.json:217-233 VERIFIED |
| `agentBattles` | ownerId ASC, status ASC, completedAt DESC | owner battle list | indexes.json:235-251 VERIFIED |
| `agentBattles` | ownerId ASC, **agentContext.archetype ASC**, createdAt **ASC** | **archetype-scoped battle query** — the one archetype-relevant index | indexes.json:252-269 VERIFIED |
| `agentBattles` | status ASC, completionReason ASC, completedAt ASC | GC/repair sweep | indexes.json:270-287 VERIFIED |
| `tournamentGroups` | baseLayerWeek ASC, updatedAt DESC | league orchestrator | indexes.json:390-403 VERIFIED |

Note the archetype index (L252-269) orders `createdAt` **ASCENDING**, unlike its siblings' DESCENDING `createdAt` — a query wanting newest-first archetype battles would need a different index or in-memory sort. Flag for founder verification.

**Manual-deploy caveat (founder-verification, pervasive).** Neither rules nor indexes auto-deploy from the repo. The rules file itself repeatedly states "Manual deploy via Firebase Console required after merge — Firestore rules don't auto-deploy from code" for: tournamentGroups (L436,446), tournamentBrackets (L456), tournamentLeaderboards/Ranks (L468), tournamentLobby (L484), watchlistSessions (L750), watchlists (L760), analysisSessions (L778), the ENTIRE learning block (L802-805, behind `LEARNING_L1_CAPTURE_ENABLED`), and the ENTIRE mastery block (L841 — "`npm run deploy:rules` / Firebase Console"). **Whether the HEAD ruleset (agents CREATE allowlist, bundle vocabulary, learning/mastery denials) is actually live on the production Firebase project cannot be determined from the tree — it is a deploy-state fact.** Same for `firestore.indexes.json` (`firebase deploy --only firestore:indexes`). This is the single largest founder-verification item: a compile step's assumptions about the substrate hold only if the repo rules are deployed.

### D. What is test-locked (`firestore.rules.emulator.test.js`)

The emulator test reads the REAL `firestore.rules`, patches proposed clauses in memory, and loads them into the Firestore emulator; it auto-skips without `FIRESTORE_EMULATOR_HOST` (test:148-156). Two suites:

- **agents four-field UPDATE allowlist** (test:158-247): detects that the allowlist has LANDED in `firestore.rules` (string match on `.hasOnly(['directives','lastViewedEvolutionCycle','starterKitCompleted','updatedAt'])`, test:85) and verifies the LIVE clause as-is. Locks: owner may write each of the 4 fields; each guarded field (settingsRev, standingLeans, dials, archetype, config, activeRules, memory, stats, ownerId-reassignment) denied; mixed writes denied by `hasOnly`; non-owner and anonymous denied (test:190-247). **This suite does NOT exercise the agents CREATE allowlist (L169-218) nor the delete deny — those are NOT test-locked by the emulator test.** VERIFIED.
- **bundles field-allowlist + equipped-value deny** (test:352-510): locks 20-field allowlist, `ruleHardness` exclusion (whole-map and dotted-path), status value-gate, equipped persist-on-launch pass, non-owner/anon/delete denials.

**FINDING — the bundles suite is STALE at HEAD and would throw when actually run.** Its landed-detection (test:299) checks `current.includes("request.resource.data.status != 'equipped'")`. That exact string does **not** exist in `firestore.rules` — only `resource.data.status != 'equipped'` at L320 (`resource.data`, not `request.resource.data`; grep VERIFIED zero hits for the `request.` form). So `buildProposedBundlesRules()` skips the landed branch and falls to `CURRENT_BUNDLES_BLOCK_RE`, which expects the pre-proposal shared `allow create, update: if request.auth != null && get(...).ownerId == request.auth.uid;` clause on the `/bundles/` block. HEAD has instead the split create (L274-277) + update (L278-321) with the full closed vocabulary — the bare shared clause survives only on the *rules* subcollection (L241), not bundles. So `CURRENT_BUNDLES_BLOCK_RE` matches **0** bundles blocks → the function throws "expected exactly ONE bundles block to patch, found 0" in `beforeAll`, erroring the whole bundles suite. The suite's assertions therefore verify a bundles rule shape (simple `status != 'equipped'` value-gate) that HEAD has already SUPERSEDED with the richer closed-vocabulary clause — its ALLOW cases (e.g. draft→forged, draft→archived) happen to still pass the live rules, but forged→draft or archived→forged would be ALLOWED by the test's proposed clause yet DENIED by live L297-307. Test is out of sync with the live bundles rule. UNVERIFIED at runtime (I did not run the emulator) but VERIFIED by string/regex analysis of both files.

### E. What a compile step could and could not write, per candidate site (substrate summary)

- **`activeRules` on `agents/{id}`** — a client compile step **cannot** project rules here: forced empty at create (L185-187), omitted from update allowlist (L221-222). Only the Admin-SDK equip/deploy path writes `activeRules`. VERIFIED.
- **`standingLeans`, `dials`, `settingsRev`, `equippedTraits`, `deployedStrategy`** on the agent doc — **cannot** be written client-side at all (absent-list at create L171-173; not in update allowlist). Server-only. VERIFIED.
- **`agents/{id}/bundles`** — a client compile step **can** author `draft`/`forged` bundles carrying `ruleIds` + `ruleSnapshots` + dimension/compile fields, but **cannot** set `ruleHardness` (not in the 20-key allowlist L276/L280), **cannot** birth or transition into `equipped`, and **cannot** mutate `ruleIds/ruleSnapshots/ruleHardness/name` on an already-equipped bundle (L320-321). VERIFIED.
- **`agents/{id}/rules`** — a client compile step **can** create/update rule docs with arbitrary extra keys (no `hasOnly`), subject to field bounds: `textTemplate`≤500, `paramValues`≤5 keys, constrained `status`/`provenance` enums (L241-262). This is the **most permissive** client-writable agent-owned surface. VERIFIED.
- **`equippedWatchlistId` at agent create** — a compile step birthing an agent pre-pointed at a watchlist must have first created that `watchlists/*` doc with `userId==caller` (cross-doc `get()` at L211, and watchlists themselves are server-write-only L761-765, so the watchlist must be minted server-side first). VERIFIED.
- **Any `learning*` / `mastery*` write** — impossible client-side; Admin-SDK only (L813-877). VERIFIED.
- **`agentBattles` create / settlement fields** — impossible client-side; only the 10 execution-control fields are client-mutable (L340-346). VERIFIED.


---

## Part 1.3 — GROUP_STATUS.EXPIRED & progressVersion at HEAD

**Verdict: fully merged, structurally complete, and INERT on the automatic path.** Both `GROUP_STATUS.EXPIRED` and `progressVersion` are landed at HEAD (a26cc19) — this is not a mid-merge state. The terminal state, its legal-transition edges, and its writer are all present and mutually consistent; the only thing missing is a *live automatic caller*, because the orchestrator sweep is dark behind `POD_EXPIRY_SWEEP_ENABLED = false`.

### EXPIRED — defined, wired, gated

- **Enum defined.** `GROUP_STATUS.EXPIRED = 'expired'` at `src/constants/leagueTournament.js:106` (inside the frozen `GROUP_STATUS` object opened at L84), documented as the second terminal disposition for a pre-BATTLE training pod, carrying marker fields `{ expiredAt, expiredReason, expiredBy }`. VERIFIED.
- **LEGAL_TRANSITIONS edges to it.** `api/_utils/tournamentGroupService.js:51-58` — EXPIRED is reachable from exactly the three pre-BATTLE states: `FORMING` (L52), `DRAFTING` (L53), `AWAITING_OPEN` (L54). `BATTLE` (L55) has NO edge to EXPIRED (only `→ COMPLETE`); `COMPLETE` (L56) and `EXPIRED` (L57) are terminal (empty edge arrays). VERIFIED. The advance-then-expire race is closed by construction: `assertTransition` throws `illegal transition` for a pod that reached BATTLE, and `expireGroup` treats that throw as an idempotent skip (`tournamentGroupService.js:174-183`, `reason: not_expirable_from_${status}`). VERIFIED.
- **Writer.** `expireGroup(db, groupId, {...})` at `tournamentGroupService.js:149-193` is the sole transactional EXPIRED writer: read-check-write in `db.runTransaction`, with `expectedStatus` / `expectedUpdatedAt` / `expectedProgressVersion` preconditions, writing `{status: EXPIRED, expiredAt, expiredReason, expiredBy, updatedAt}` atomically (L184-190). NEVER hard-deletes (audit trail survives). VERIFIED.
- **Callers wired.** The unified core is `expireStaleTrainingPods` at `api/_utils/trainingLifecycle.js:796-855`, which iterates the three pre-BATTLE statuses (L808), applies the training-only predicate (`isTraining === true && isLiveDraft !== true`, L816), and calls `expireGroup` per stale pod (L834-839). It has **two** callers:
  1. **Rolling orchestrator backstop** — `api/_utils/tournamentOrchestrator.js:954-963`, invoked each weekday-morning tick AFTER `flipAwaitingOpenPods`, but wrapped in `if (POD_EXPIRY_SWEEP_ENABLED)` (L954). VERIFIED.
  2. **Founder-gated one-time cleanup** — `POST /api/admin/expire-stuck-training-pods` (`api/admin/expire-stuck-training-pods.js:34-107`), a dry-run-by-default endpoint with a signed preview-token apply gate (L69-99). This caller is NOT flag-gated — it is a manual, admin-secret-protected endpoint. VERIFIED.
- **Gate state.** `POD_EXPIRY_SWEEP_ENABLED = false` at `src/config/featureFlags.js:920` (doc-comment L906 describes the per-tick sweep). VERIFIED. **Consequence:** the automatic orchestrator backstop block never executes (`tournamentOrchestrator.js:954` short-circuits), so at HEAD there is **no live automatic EXPIRED writer** — EXPIRED can only be produced by a founder manually POSTing the admin cleanup endpoint. The terminal state is real and its consumers are inert-for-EXPIRED by construction (`leagueTournament.js:100-105`: every `status===BATTLE`/positive-gate consumer stays inert, and `selectMyGroup`/`selectMyTrainingPod` exclude it), so a merged EXPIRED pod is invisible to active-pod selectors.

**Merged-but-inert verdict (EXPIRED):** enum + transitions + writer + shared staleness core = MERGED and LIVE-CAPABLE via the manual admin endpoint; the *rolling automatic* sweep is MERGED-DARK (`POD_EXPIRY_SWEEP_ENABLED=false`).

### progressVersion — defined, written on the draft path, read only by the expiry precondition

- **Not seeded by the factory.** `createTournamentGroupDoc` (`src/constants/leagueTournament.js:1261+`) does not emit a `progressVersion` field (no hit in its field list). A fresh pod therefore has no `progressVersion`; every reader coalesces via `|| 0`. VERIFIED (grep: only factory validation lines, no field write).
- **Written on the training draft path** (`api/_utils/trainingLifecycle.js`), always as `(x.progressVersion || 0) + 1`:
  - FORMING→DRAFTING seed: `L427` (`groupUpdate = { status: DRAFTING, updatedAt, progressVersion: (g.progressVersion||0)+1 }`). VERIFIED.
  - Per live pick (mid-draft, the "B2" fix — a pick writes only the state sibling, so the parent version is bumped explicitly): `L513`. VERIFIED.
  - Draft-complete handoff (inline 12th pick): `L502`. VERIFIED.
  - Standalone completion handoff (resume/crash path): `L553`. VERIFIED.
- **Read only in the expiry precondition.** `tournamentGroupService.js:171` — `expireGroup` skips (`reason: progress_changed`) when `expectedProgressVersion != null && (data.progressVersion||0) !== expectedProgressVersion`. The value is passed from `expireStaleTrainingPods` as `expectedProgressVersion: pod.progressVersion ?? 0` (`trainingLifecycle.js:838`). VERIFIED. No other runtime consumer reads it (repo-wide grep: all remaining hits are tests). VERIFIED.

**Merged-but-inert verdict (progressVersion):** MERGED and LIVE on the training draft path — it is written on every draft mutation regardless of any flag. Its *only reader*, however, is `expireGroup`'s precondition, which is itself only reached automatically behind `POD_EXPIRY_SWEEP_ENABLED` (dark) or via the manual admin endpoint. So the counter is continuously maintained but effectively dormant until an expiry sweep runs.

---

## Part 1.4 — Eval-budget constraint

**This budget architecture (the `agentBattles` CPU-evaluation budget) is FENCED-as-concept** per the census mandate — flagged. Findings below are read-only observations; any change would be a §7-gated fence contact.

### Where the budget is SET

- **Handler max duration:** `export const config = { maxDuration: 300 }` at `api/cron/agent-evaluate.js:109`, raised 60→300 ("agent-eval budget-starvation fix, July 2026", comment L104-108). VERIFIED. `vercel.json` does NOT override this (only the cron `path`/`schedule` entry at `vercel.json:134-135` references the route; no `functions.maxDuration` block) — the in-file `config` governs. VERIFIED.
- **Soft time budget:** `const TIME_BUDGET_MS = 290_000` at `agent-evaluate.js:113` (290s, "leave 10s buffer under the 300s maxDuration"). VERIFIED.
- **Per-call ceiling / post-call allowance:** `HAIKU_CALL_CEILING_MS = 22_000` and `HAIKU_POST_CALL_ALLOWANCE_MS = 12_000` at `api/_utils/agentEvalTransport.js:14-15` — 22s = the SDK's 20s per-request timeout + 2s AbortController backstop; 12s = parallel narration dispatch + awaited `finalUpdate`. VERIFIED. Required-remaining to START a call = 22 + 12 = **34s**.
- **Cron cadence:** `*/15 13,14,15,16,17,18,19,20,21 * * 1-5` (`vercel.json:135`) — every 15 min during 13:00-21:00 UTC, Mon-Fri. Each 900s window can host one ≤300s invocation. VERIFIED.

### Where the budget is ENFORCED — two layers, sequential

1. **Handler-level deferral (whole battles).** `agent-evaluate.js:311-318` — battles are processed in a **sequential** `for` loop; before each, `if (Date.now() - startTime > TIME_BUDGET_MS)` breaks the loop and counts all remaining as `summary.skipped`. VERIFIED.
2. **Per-battle pre-call guard (the Haiku call only).** `agent-evaluate.js:1895` — `shouldStartHaikuCall({ elapsedMs: Date.now() - cronStartTime, timeBudgetMs: TIME_BUDGET_MS })` (`agentEvalTransport.js:61-69`: `proceed = remainingMs >= 34s`). On `!proceed` the battle records `failureClass:'budget_skipped'` (L1896-1902) and **keeps the normal write path** — only the Haiku call is skipped (risk swaps/score writes already happened mid-function). VERIFIED. The call itself is one `anthropic.messages.create` (`model: 'claude-haiku-4-5-20251001'`, `max_tokens: 1024`) with `{ timeout: 20_000, signal: abortCtrl.signal }` (L1913-1931) and a 22s hard-abort timer (L1911); client `maxRetries: 0` (L128). VERIFIED.

**Fair-rotation ordering** (`agent-evaluate.js:306-308`): battles are sorted ascending by `cronState.lastEvalStartedAt` (written only on a real attempt, so `budget_skipped` ticks don't refresh it; never-evaluated sort to front via `''`). This makes starvation FAIR, not absent — the code comment (L303-305) explicitly says the real fix is per-battle fan-out. VERIFIED.

### Effective battles-per-tick throughput at HEAD

`summary.evaluated` is bumped **once per battle** across every processing path (`agent-evaluate.js:866, 1746, 1758, 1787, 1866, 2672, 3902`), so "evaluated: N" = N battles fully processed this tick. VERIFIED.

- **Jul-22 datapoint (~19.9s, evaluated 8):** 19.9s / 8 ≈ **~2.5s per battle** — i.e. healthy Haiku latency sits far below the 20s timeout ceiling. At 8 active battles the budget was never the binding constraint; the *active-battle count* was. The code that produced it is the sequential loop at L311-346 (evaluated++ at the battle's terminal path), with the run duration logged at L348-351. VERIFIED (code); the specific 19.9s/8 run is a live-ops datapoint — UNVERIFIED against logs from this session.
- **Throughput ceiling, healthy case (~2.5s/battle):** the last battle allowed to *start* a Haiku call must be at `elapsed ≤ 290 − 34 = 256s`; theoretical ~256s/2.5s ≈ **~100+ battles** before the guard trips. So at current scale (single-digit active battles) the tick clears all of them with wide headroom.
- **Throughput floor, degraded case (calls hit the 22s ceiling):** ~256s / 22s ≈ **~11-12 battles** can start a call before `shouldStartHaikuCall` returns `budget_skipped`; the remainder get budget_skipped (write path only) or, past 290s, deferred. This is the starvation floor fair-rotation cycles across.
- **Recent change that moved it:** the `maxDuration 60→300` bump (L104-109) is the single lever — roughly 5x. At the old 60s (≈26s of call-startable budget after the 34s guard), only ~1 Haiku call cleared the guard per tick; at 300s the tick funds many. VERIFIED (comment + the 290s constant).

### Cost of a second (shadow) prompt path against this budget

The budget is **sequential per battle** (one loop, one awaited call per battle), so a second prompt path's cost depends entirely on whether it makes an LLM call:

- **If the shadow path issues its own LLM call per battle:** its latency adds to each battle's slice serially. Against the pre-call guard, a sequential second call raises required-remaining from 34s toward ~56s (2×22 + 12) and roughly **halves** the battles-per-tick that can start calls before exhaustion; at healthy ~2.5s latency it roughly **doubles** per-battle cost (2.5→5s), turning the 8-battle run from ~20s to ~40s — still inside 290s at today's scale, but halving the starvation headroom. UNVERIFIED (no such second call exists at HEAD; this is a projection).
- **If the shadow path is assembly-only / log-only (no `messages.create`):** cost is near-free relative to this budget. Precedent: `api/_utils/shadowLogger.js:1-16` writes JSONL to GCS fire-and-forget, "NEVER throws, NEVER blocks," and contains no `messages.create` (grep: only comment references to Haiku). VERIFIED. A prompt-assembly shadow that only *builds* a prompt and logs it would add CPU + one non-blocking GCS write, not a serialized LLM round-trip.

**Bottleneck summary:** at HEAD the binding constraint is the *active-battle count*, not the 290s budget — but the architecture is single-invocation, sequential, one-Haiku-per-battle, with no fan-out (L303-305). Any shadow path that adds a *serialized LLM call* competes directly for the 256s-of-startable budget and halves the degraded-case floor.

---

## Part 1.5 — Deploy-state divergences

Merged-but-inert and value-vs-comment divergences relevant to archetype/rules/leans behavior. All flag values per `src/config/featureFlags.js` at HEAD.

### (a) Firestore rules + composite indexes — manual-deploy founder-verification

Both `firestore.rules` (45,996 bytes) and `firestore.indexes.json` (8,469 bytes) exist as committed repo artifacts at HEAD. VERIFIED (files present). `docs/BUILD_RULES.md:29` states the binding rule: *"Pushed ≠ deployed: Vercel preview is the smoke-test surface; production exists only after the founder confirms merge + deploy."* VERIFIED. Firestore rules/indexes are NOT deployed by the Vercel app build — they require a separate `firebase deploy`. **Whether the rules/indexes live in the Firebase console match the committed HEAD versions is not determinable from the repo and I was instructed not to query the live console — FOUNDER-VERIFICATION ITEM.** Note `tournamentGroupService.js:6-8` asserts the deployed rules make `tournamentGroups` client-read-only (`write false`); that assertion depends on the deployed rules matching HEAD — also founder-verifiable only.

### (b) Flag VALUE contradicts its own doc-comment

- **`FORGE_HARDSOFT_AUTHORING_ENABLED = true`** (`featureFlags.js:51`) vs its doc-comment (L43-49): *"GATED OFF until the FENCED prompt-assembly half lands ... AND a founder sign-off."* The **value says ON; the comment describes it as if it should be OFF.** CONTRADICTION logged. Investigation of the fenced half: the prompt-assembly enforcement **has in fact landed** — `projectActiveRules` bakes the authored per-rule override into `item.hardness` (`api/_utils/projectActiveRules.js:56, 78-86`), and BOTH prompt builders split CONSTRAINTS vs STRATEGY via `isHardRule` from the single server source `ruleHardness.js` (strategy: `api/_utils/agentPromptAssembly.js:6, 89-90`; eval: `api/_utils/agentEvalPromptAssembly.js:30, 531-532`; resolver: `ruleHardness.js:32-41`). VERIFIED. So the comment is **stale**, not the value — the flag was flipped after the fenced half shipped, and the enforcement path is real (a HARD rule genuinely renders as a CONSTRAINT, not silently ignored). The *founder-sign-off* half of the comment's condition is not code-observable — FOUNDER-VERIFICATION whether sign-off preceded the flip. (agentPromptAssembly.js / agentEvalPromptAssembly.js are FENCED files — read only; no edit implied here.)

- **`SECTOR_CAP_MODE = 'true'`** (`featureFlags.js:555`) vs its doc-comment (L524-546) which defines a strict tri-state `'off' | 'observe' | 'enforce'`. The **value `'true'` is NOT a legal tri-state token.** CONTRADICTION logged. Investigation of how it's read: the sole consumer is `api/_utils/agentGuardrails.js`, which gates on exact-string equality — enforce path `if (SECTOR_CAP_MODE !== 'enforce') return base;` (L97) and observe path `if (SECTOR_CAP_MODE !== 'observe') return null;` (L124). VERIFIED. **`'true'` matches neither**, so both guards early-return: the Diversifier sector-slot cap injects **nothing** and measures **nothing** — it behaves exactly like `'off'`. **Answer to the census question: `'true'` does NOT engage enforce — the sector cap is INERT/dark at HEAD.** The comment (L544-546) claims enforce blocks the 3rd-in-sector swap; the live value silently defeats that. This is a genuine, behavior-affecting divergence (a value that reads as "on" but disables the feature). Note the injection call site `agent-evaluate.js:2001` likewise fires "ONLY under SECTOR_CAP_MODE='enforce'." VERIFIED. (agentGuardrails.js and featureFlags.js are NOT fenced; a fix would edit featureFlags.js.)

### (c) Dark flags gating archetype/rules/leans behavior (value confirmed = merged-inert)

| Flag | Value | Line | What is dark |
|---|---|---|---|
| `LEARNING_L1_CAPTURE_EXPANSION_ENABLED` | `false` | `featureFlags.js:802` | L1 corpus capture is NOT widened to the 4 extra swap sites (risk-manager, gameplan rotation, co-pilot approve + expired-auto-exec); AND-gated with `LEARNING_L1_CAPTURE_ENABLED` at every new site (comment L791-795). Original autopilot capture unaffected. Merge-dark → smoke → flip PR (L797-800), flipped together with REGIME_STAMP. VERIFIED. |
| `REGIME_STAMP_ENABLED` | `false` | `featureFlags.js:820` | No write-once `regimeAtStart` stamp on `agentBattles` docs; regime-conditional learning stays blocked. Forward-only from flip date; when false, no battle doc is touched (L815-818). VERIFIED. |
| `POD_EXPIRY_SWEEP_ENABLED` | `false` | `featureFlags.js:920` | The rolling automatic training-pod EXPIRED sweep never runs (`tournamentOrchestrator.js:954`). See Part 1.3. VERIFIED. |
| `TRAIT_SLOT_ENABLED` | `false` | `featureFlags.js:116` | The Traits loadout slot surface is retired; benches render 2 slots (Archetype · Watchlist). **Surface-only** — `equippedTraits` seeding, trait persistence, and the `projectActiveRules` projection are explicitly UNTOUCHED, so agents keep seeded traits invisibly and battle behavior is unchanged (L110-114). This flag gates UI only, not archetype behavior. VERIFIED. |

**Reconciliation note (context flags from the census header):** the same `RULE_COMPAT_MODE = 'enforce'` (`featureFlags.js:582`) and `ARCHETYPE_INTEGRITY_MODE` (referenced by the SECTOR_CAP comment L521-523) are LIVE tri-states with legal tokens — contrast the malformed `SECTOR_CAP_MODE`. The `SECTOR_CAP_MODE` divergence is the one place in this cluster where a flag that *looks* engaged is actually inert.


---

# Part 2 — The six maps

## Map 1 — Archetype ownership (A: identity, physics, constraints/weights)

Every archetype-defining value in scope resolves to one of two homes: a **DATA** literal (a plain object keyed by the six stable code-ids — pipeline-friendly) or **CODE** (enforcement/scoring logic — pipeline-hostile). The six stable code-ids (`momentum_chaser`, `contrarian`, `diversifier`, `degen`, `analyst`, `guardian`) are the join key everywhere; `analyst` is the universal fallback. This section maps the homes, the DATA↔CODE boundary, and — importantly — where declared archetype fields are **echo-only / unenforced**.

### 1. Identity & display layer — all DATA, mostly unfenced

| Value | Home | DATA/CODE | Fence | Verify |
|---|---|---|---|---|
| `ARCHETYPE_DISPLAY_NAMES` (canonical user-facing names) | src/data/archetypeDisplay.js:18 | DATA | unfenced | VERIFIED |
| `ARCHETYPE_IDENTITY` (disposition/reveal/voice copy) | src/data/archetypeIdentity.js:18 | DATA | unfenced | VERIFIED |
| `ARCHETYPE_CHARACTER` (colors, combo, tempPos, 4-axis factor copy) | src/data/archetypeCharacter.js:57 | DATA | unfenced | VERIFIED |
| `ARCHETYPE_CONFIGS[].label` (API-side display mirror) | api/_utils/agentArchetypeConfig.js:36–245 | DATA | **FENCED** | VERIFIED |
| `avatarColors` (per-archetype color pair) | api/_utils/agentArchetypeConfig.js:69,98,125,154,185,217 | DATA | **FENCED** | VERIFIED |

Display names are the canonical strings and are deliberately split from behavior copy so the two edit independently (archetypeDisplay.js:7–13 VERIFIED; archetypeIdentity.js:14–16 VERIFIED). The API mirrors the frontend names via `.label` because the API cannot import from `src/` (archetypeDisplay.js:5–9 VERIFIED). `avatarColors` in the fenced config is **duplicated** as display values in the unfenced `ARCHETYPE_CHARACTER.colors` (archetypeCharacter.js:14–17,53 VERIFIED) — a hand-maintained mirror the test cross-checks, not a live import. Renaming a display name requires editing BOTH archetypeDisplay.js AND the fenced `.label` (archetypeDisplay.js:6–9 VERIFIED) → a §7-gated fence contact.

Reveal/onboarding copy is entirely DATA: `getArchetypeIdentity` (archetypeIdentity.js:66 VERIFIED) and `getArchetypeCharacter` (archetypeCharacter.js:155 VERIFIED) just compose these literals plus `ARCHETYPE_DEFAULT_TRAITS` from traitLibrary. Archetype is DERIVED, not chosen — the deterministic mapping from the three temperament answers lives in api/_utils/archetypeDerivation.js:1–20 (question-only; stock picks intentionally excluded) VERIFIED.

### 2. Physics / Enforcement Keystone knobs — DATA table (fenced) + CODE enforcement (fenced)

The archetype→physics wire is a **DATA table** (`hftConfig`, per archetype) read by **CODE** enforcement primitives. Both homes are fenced.

**DATA — the knob table** lives in `ARCHETYPE_CONFIGS[archetype].hftConfig`, agentArchetypeConfig.js:45–218 (**FENCED**), tagged `KNOB_CONFIG_VERSION = 2` (agentArchetypeConfig.js:30 VERIFIED). Three knobs per archetype:

| Archetype | forcedRotation (Knob A) | hurdleFloor default / haiku / stag (Knob B, ATR mult) | swapWindow (Knob C) |
|---|---|---|---|
| momentum_chaser | enabled, ticks 5, pct .0015, winner .0015 | .35 / .35 / .5 | cap 6 / 60min |
| analyst | enabled, ticks 6, winner 0 | .4 / .4 / .5 | cap 4 / 60min |
| diversifier | enabled, ticks 6, winner 0 | .4 / .4 / .5 | cap 4 / 60min |
| contrarian | enabled, ticks 6, winner 0 | .4 / .4 / .5 | cap 4 / 60min |
| degen | enabled, ticks 3, pct .001, winner .002 | .2 / .2 / .3 | cap 12 / 60min |
| guardian | **DISABLED** | .5 / .5 / .5 | cap 2 / **120min** |

(agentArchetypeConfig.js:49–59,80–90,109–119,136–146,165–177,199–209 VERIFIED). All floors carry `requireBenchPositive: true`; all `swapWindow.countEmergencies: false`. Guardian's forced rotation is `enabled: false` with inert fields kept for schema uniformity (agentArchetypeConfig.js:196–199 VERIFIED). Release-1/B4 tuning touched only degen + momentum_chaser (comments at :46–48,170–172 VERIFIED). Resolution is mode-aware but flat: `resolveHftConfig(cfg, gameMode)` returns `hftConfigByMode[mode] ?? hftConfig ?? null` and NO archetype declares `hftConfigByMode`, so every mode collapses to the archetype-locked `hftConfig` (agentArchetypeConfig.js:233–235 VERIFIED). This is the fenced "agentBattles CPU-evaluation budget / knob" concept and is a §7 fence contact for any edit.

**CODE — the enforcement**, all in api/_utils/agentRiskManager.js (**FENCED**), all pure functions:

- **Forced rotation (Knob A)** — detection in `evaluateRiskAction`, agentRiskManager.js:154–166 VERIFIED. Fires `SWAP_OUT`/`reason:'stagnation'`/`source:'archetype'` iff `fr.enabled && cronMemory.withinAge && stagnationTicks >= fr.ticksThreshold && dailyPct < fr.winnerThreshold`. Lowest-priority swap (bust/vwap/LOCK/TRAIL precede it). **DETECTION ONLY** — the cron picks the replacement and vetoes by selecting nothing (comment :146–153 VERIFIED). Counter state machine is `updateStagnationCounter` (:205–231 VERIFIED); `withinAge` is transient and gates the fire on the current tick.
- **Hurdle floor (Knob B)** — `clearsHurdleFloor`, agentRiskManager.js:308–344 VERIFIED. Order is load-bearing: (1) emergency bypass, (2) disabled→clears, (3) `byReason[reason] || default` Shape-B lookup, (4) bench-positive rule, (5) ATR-margin `>= requiredMargin`. LANDMINE-1 unit conversion `atrValue = userATR/100` at :331 VERIFIED. Margin via `computeBenchVsActiveMargin` (:264–279 VERIFIED).
- **Circuit breaker (Knob C)** — `getRecentSwapCount`, agentRiskManager.js:475–499 VERIFIED. Counts in-window `swappedOutAt` swaps, excluding `EMERGENCY_BYPASS_REASONS` unless `countEmergencies`; cron compares to `capPerWindow`. Reads top-level `t.exitReason` (Trap 1, :456–459 VERIFIED); missing reason → counted (conservative).
- **EMERGENCY_BYPASS_REASONS** — the single source of truth, agentRiskManager.js:28–34 VERIFIED: `{bust_avoidance, vwap_failure, stepped_trail, guardrail_stopLoss, guardrail_trailingStop}`. Gated (NOT bypassed): stagnation, haiku_decision, gameplan_proposal, gameplan_meeting (:25 VERIFIED). The sector-cap guardrail returns HOLD and is intentionally absent (:22–23 VERIFIED). This constant is DATA-shaped but **CODE** (a `Set` literal inside the fenced module). Referenced-but-not-redefined at api/_utils/tempoDialClamp.js:40 (comment, "never read here") and learning/learningEnums.js:44 (comment: `D3_DISCRETIONARY_EXIT_REASONS` is deliberately a DIFFERENT set — `['haiku_decision']`, :48 VERIFIED). So EMERGENCY_BYPASS_REASONS has exactly ONE definition (agentRiskManager.js); the other two files only mention it.

**Consumers** — api/cron/agent-evaluate.js (not itself in the §1 file-fence list, but drives the fenced eval-budget concept): imports all four primitives + `resolveHftConfig`/`KNOB_CONFIG_VERSION` (:48,52 VERIFIED); resolves knobs at :1226; Gate-1 log at :1238; forced-rotation stagnation at :1287–1288; Knob-C cap check for forced rotation at :1335–1342; Knob-B hurdle at :2112 and Knob-C cap for haiku swaps at :2128–2131 VERIFIED. **Boundary verdict:** the physics VALUES are fully DATA (pipeline-friendly, one table), but they live inside a fenced file and are enforced by fenced CODE — so recalibration is a config-only edit *in principle*, gated by §7 *in practice*.

### 3. ARCHETYPE_CONSTRAINTS & ARCHETYPE_WEIGHTS — DATA in archetypeScoring.js

Both live in **api/_utils/archetypeScoring.js** (NOT in the BUILD_RULES §1 file list, but it IS the "scoring engine" fenced *concept* — flagged below):

- **`ARCHETYPE_WEIGHTS`** — archetypeScoring.js:14–63 VERIFIED. Per-archetype dimension weights (fundamentalScore, technicalScore, baggerBombFit, atrPercentile, inverseComposite, sectorDiversity), each set summing to 1.0. **DATA.** Consumed by `computeArchetypeRankings` (**CODE**, archetypeScoring.js:107–141 VERIFIED), which produces `archetypeScore` and sorts descending; called from api/agent/decide.js:243 (**FENCED**) VERIFIED, feeding the "ARCH" column that Sonnet is told to use as its primary sort signal (agentPromptAssembly.js:22–23 VERIFIED).
- **`ARCHETYPE_TEMPERATURES`** — archetypeScoring.js:68–75 VERIFIED. Per-archetype `{sonnet, haiku}` LLM temperatures. **DATA.** Consumed at decide.js:244 VERIFIED.
- **`ARCHETYPE_CONSTRAINTS`** — archetypeScoring.js:80–93 VERIFIED. Per-archetype natural-language sector/quality MUST-strings (e.g. momentum "≥5 stocks from top-3 sectors"; degen "≥3 with ATR pct >0.80, ignore fundamentals"; guardian "≥5 fundamentalScore>60, ≥6 sectors, avoid ATR pct >0.75"). **DATA (prompt strings).** Consumed by `buildStrategySystemPrompt`, agentPromptAssembly.js:22 (**FENCED**) VERIFIED, injected into Sonnet's system prompt at portfolio-build time. **Enforcement mode = prompt-constrained**, not deterministic — the string tells the LLM "MUST" but nothing deterministically rejects a violating shortlist here.

**CONTRADICTION (census anchor):** the assignment anchor lists "src/constants/leagueTournament.js (ARCHETYPE_WEIGHTS)". At HEAD, `ARCHETYPE_WEIGHTS` is NOT defined there — leagueTournament.js:365 only carries a *comment* referencing it and defines the unrelated `CPU_ARCHETYPE_ORDER` array at :367–374 VERIFIED. The only live `ARCHETYPE_WEIGHTS` definition is archetypeScoring.js:14 (git grep confirms two hits: definition + self-consumer, plus the leagueTournament comment) VERIFIED.

### 4. Eval-prompt & decide identity blocks — thin, string-only per archetype

Archetype does **NOT** carry rich per-archetype identity text into the evaluation prompt. In api/_utils/agentEvalPromptAssembly.js (**FENCED**), archetype appears only as a humanized code-id string interpolation — tiered `buildEvalSystemPrompt` (:47 VERIFIED), flat6 `buildFlat6EvalSystemPrompt` (:270 VERIFIED), and `buildAgentIdentityBlock` (:494–497 VERIFIED, `"Archetype: ${humanized}"`). No `ARCHETYPE_CONSTRAINTS`, `ARCHETYPE_IDENTITY`, or evidence-weighting block is injected per archetype in the eval path (grep confirms zero ARCHETYPE_CONSTRAINTS import in that file) VERIFIED. The rich reveal/voice copy (archetypeIdentity.js) and the four-zone `archetypeAdjustments.js` content are frontend/directive-gate concerns, not eval-prompt inputs here.

On the decide (portfolio-build) side, archetype drives three things, all in api/agent/decide.js (**FENCED**): `computeArchetypeRankings` sort via WEIGHTS (:243), `ARCHETYPE_TEMPERATURES` (:244), and `ARCHETYPE_CONSTRAINTS` via `buildStrategySystemPrompt` (:294) VERIFIED. The agent system prompt itself only humanizes the code-id (agentPromptAssembly.js:58–61 VERIFIED). So archetype-varying prompt identity is: **CODE-thin at eval time, weights+constraints at build time.**

### 5. Declared-but-unenforced archetype fields (echo-only)

Several fields in the fenced `ARCHETYPE_CONFIGS` table look like physics but are not enforced anywhere at runtime:

- **`convictionMods`** (agentArchetypeConfig.js:61,92,121,148,179,211) — repo-wide git grep finds it ONLY in its own definition file; **ZERO consumers** VERIFIED. The file header claims archetypes have "real mechanical effects on … conviction scoring" (agentArchetypeConfig.js:2–4 VERIFIED) — **CONTRADICTED** by zero readers of `convictionMods`. Dead/echo-only.
- **`sectorConcentrationCap`** (agentArchetypeConfig.js:66,95,122,151,182,214) — consumed ONLY by api/_utils/behaviorFingerprint.js:152 (the display "concentration" fingerprint, :46 VERIFIED), NOT by the sector-cap guardrail. The actual sector cap in api/_utils/agentGuardrails.js is a **hardcoded** `DIVERSIFIER_SECTOR_CAP_PCT = 35` (:60 VERIFIED), scoped to flat6 Diversifier only, gated on `SECTOR_CAP_MODE` — it does not read the archetype's declared cap.
- **`regimePreferences.favoredStrategies`** IS genuinely consumed (api/_utils/agentRegimeClassifier.js:135–148 VERIFIED). `defaultPreset`/`defaultConfig`/`tradeFrequency` feed display/seeding paths (behaviorFingerprint.js, tournamentCpu.js, create-profile.js) VERIFIED — not runtime physics. (`avoidedStrategies`/`canEnterDistressed` consumers not fully traced this run — UNVERIFIED.)

### 6. SECTOR_CAP_MODE = 'true' does NOT engage enforce (nor observe)

The census flagged `SECTOR_CAP_MODE = 'true'` (string) at featureFlags.js:555 VERIFIED, whose doc-comment describes a tri-state `'off'|'observe'|'enforce'` walked `off→observe→enforce` (featureFlags.js:548–554 VERIFIED). The guardrail reads it with strict equality: enforce path `if (SECTOR_CAP_MODE !== 'enforce') return base` (agentGuardrails.js:97 VERIFIED) and observe path `if (SECTOR_CAP_MODE !== 'observe') return null` (:124 VERIFIED). The literal `'true'` equals NEITHER `'enforce'` NOR `'observe'` → the sector cap is **effectively OFF/inert** despite the value looking truthy. This is a genuine misconfiguration: a truthy-looking string that engages no code path. **CONTRADICTION** logged. (Note: the guardrail fires on its OWN flag, decoupled from `ARCHETYPE_INTEGRITY_MODE` per comment :97 VERIFIED.)

### DATA-vs-CODE boundary summary

| Archetype value | DATA/CODE | Home | Fenced | Enforcement |
|---|---|---|---|---|
| Display names / labels | DATA | archetypeDisplay.js:18; agentArchetypeConfig.js `.label` | mixed (label fenced) | display only |
| Identity copy (reveal/voice) | DATA | archetypeIdentity.js:18; archetypeCharacter.js:57 | no | display only |
| avatarColors | DATA | agentArchetypeConfig.js:69… (+ mirror archetypeCharacter.js) | yes | display only |
| hftConfig knob table | DATA | agentArchetypeConfig.js:45–218 | yes | deterministic (via CODE) |
| Knob enforcement (rotation/floor/breaker) | CODE | agentRiskManager.js:154,308,475,205 | yes | deterministic |
| EMERGENCY_BYPASS_REASONS | CODE (Set literal) | agentRiskManager.js:28 | yes | deterministic |
| ARCHETYPE_WEIGHTS | DATA | archetypeScoring.js:14 | concept-fenced | deterministic scoring sort |
| ARCHETYPE_TEMPERATURES | DATA | archetypeScoring.js:68 | concept-fenced | LLM param |
| ARCHETYPE_CONSTRAINTS | DATA (prompt) | archetypeScoring.js:80 | consumer fenced | prompt-constrained (soft) |
| computeArchetypeRankings | CODE | archetypeScoring.js:107 | concept-fenced | deterministic |
| convictionMods | DATA | agentArchetypeConfig.js:61… | yes | **unenforced (dead)** |
| sectorConcentrationCap | DATA | agentArchetypeConfig.js:66… | yes | **fingerprint only; real cap hardcoded** |

**Migration read:** the archetype knob VALUES are already DATA (single table, pipeline-friendly), but two boundaries make them pipeline-hostile in practice — (a) the table sits inside a fenced file with fenced enforcement (§7 gate), and (b) two of its fields (`convictionMods`, `sectorConcentrationCap`) are declared physics that no runtime path enforces, so migrating them faithfully means migrating dead config, and the "real" sector cap is a hardcoded constant + a mis-valued flag, not archetype DATA at all.



## Map 1 — Archetype ownership (B: sector, leans, traits, voice) + archetype-#7 boundary table

Scope note: the live system has exactly **six** archetype code-ids — `momentum_chaser` (Trend Follower), `contrarian`, `degen` (Speculator), `guardian` (Capital Preserver), `diversifier`, `analyst` (Fundamental Investor). Every "archetype #7" claim below is about what adding a seventh would require. Code-ids are the stable Firestore/scoring keys; display names are a separate layer (`archetypeDisplay.js:18-25` VERIFIED).

### 1. Sector preference and the "±15% clamp"

**The typed per-archetype sector *prefer / lean_away* matrix is DESIGNED-NOT-BUILT.** The seam exists but is deliberately empty: `PASS_THROUGH_SECTORS = Object.freeze([])` with a comment that the "per-archetype typed emphasis matrix (#1/#8)" is DEFERRED post-launch and must be populated from the canonical GICS enum "WHEN that path is built" (`src/data/archetypeAdjustments.js:195-202` VERIFIED). The directive gate is "allowlist-ids-only and never consults a sector enum" (`archetypeAdjustments.js:196-197` VERIFIED). I found **no `prefer` / `lean_away` keyed sector data anywhere** in `*.js` (repo-wide grep for `lean_away|sectorPreference|sectorBias|preferSector|sectorTilt|sectorLean` returns only an unrelated `fantasyTimesClient.js` user-context field — VERIFIED).

**No literal ±15% sector clamp exists in code** (UNVERIFIED that it was ever built — repo-wide grep for `±15|15%|sectorClamp|clampSector` finds no sector-pref clamp; the `0.15`/`1.15`/`0.85` hits are correlation floors, ranking weights, and conviction thresholds, none sector-pref). The closest *real* sector mechanisms that DO exist:

| Mechanism | Where | Enforcement | Archetype-keyed? |
|---|---|---|---|
| `sectorDiversity` weight dimension (0–100, computed from live sector counts) | `archetypeScoring.js:12,110-127` VERIFIED; weights `:14-63` | Deterministic **ranking only** (reorders the shortlist; no clamp) | Yes — 6 keys |
| `ARCHETYPE_CONSTRAINTS` shortlist rules ("MUST include ≥5 from top-3 sectors", "span ≥7 sectors", etc.) | `archetypeScoring.js:80-93` VERIFIED | **Prompt-constrained (soft)** — injected into Sonnet system prompt via `agentPromptAssembly.js:5,22-23` VERIFIED | Yes — 6 keys |
| `sectorConcentrationCap` (2–4 per archetype) | `agentArchetypeConfig.js:66,95,122,151,182,214` VERIFIED | Config value on the **fenced** archetype table | Yes — 6 keys |
| Diversifier sector-slot cap `DIVERSIFIER_SECTOR_CAP_PCT = 35` (`min(userCap, 35)`, "max ~2 of 6 flat6 picks") | `agentGuardrails.js:60,73-79,95-109` VERIFIED | Deterministic **hard block** at swap time — **but currently INERT** (see contradiction below) | diversifier only |

The output score itself is clamped to **0–100** (`archetypeScoring.js:135` VERIFIED) — that is the only clamp in the archetype-scoring path, not a ±15% sector clamp. **Founder verification needed:** whether "±15% clamp" in the census brief refers to the 35% Diversifier cap (misremembered), to a never-built typed-emphasis clamp, or to something in a design doc; I could not ground it at HEAD.

**CONTRADICTION — the Diversifier sector cap is silently disabled.** `SECTOR_CAP_MODE = 'true'` (a STRING, `featureFlags.js:555` VERIFIED), while its own doc-comment defines a tri-state `'off' | 'observe' | 'enforce'`, default `'off'` (`featureFlags.js:544-548` VERIFIED). The consumers gate on exact-string equality: `injectDiversifierSectorCap` returns the array unchanged unless `SECTOR_CAP_MODE === 'enforce'` (`agentGuardrails.js:97` VERIFIED) and `resolveSectorSlotObserveCap` returns null unless `=== 'observe'` (`agentGuardrails.js:124` VERIFIED). `'true'` matches neither, so **both the enforce injection and the observe measurement are off** — the cap behaves byte-identically to `'off'`. The string `'true'` does NOT engage enforce. (`agentGuardrails.js` is NOT in the BUILD_RULES §1 fence list — VERIFIED absent.)

### 2. Lean allowlists per archetype (the TF-01..TF-08 pattern)

**Canonical lean strings live in `src/data/archetypeAdjustments.js` (NOT fenced) — the single source of truth for both the voice layer and the deterministic directive gate** (`archetypeAdjustments.js:3-8` VERIFIED). Structure per archetype: a four-zone identity block (`zones`) + an `adjustments[]` allowlist, each entry `{ id, canonical, canonicalTextVersion, policy }` (`:48-190` VERIFIED). Lean id prefixes map to code-ids:

| Prefix | Archetype (code-id) | Count | Lines |
|---|---|---|---|
| TF | momentum_chaser | 8 | `:61-70` |
| CN | contrarian | 8 | `:85-94` |
| SP | degen | 7 | `:109-117` |
| CP | guardian | 8 | `:132-141` |
| DV | diversifier | 7 | `:156-164` |
| FI | analyst | 8 | `:179-188` |

Total **46 leans** (VERIFIED by count; corroborated `characterLeanPresentation.js:107` "each of the 46 leans"). Each `policy` carries `{ riskDirection, concentrationDirection, timeHorizonDirection, coreAlignment, forbiddenOpposite }`; the non-reversal INVARIANT is proven against `coreAlignment ∈ {reinforces, neutral}` — never `reverses` (`:31-41` VERIFIED). Conflict groups (choose-at-most-one) live in the same file: `ADJUSTMENT_CONFLICT_GROUPS` — momentum_chaser empty, one group each for CN/SP/CP/DV, two for analyst (`:283-351` VERIFIED). Accessors are data-driven with **no analyst fallback on the write path**: `getAllowlist`/`isValidAdjustmentId`/`getCanonicalText` return `[]`/`false`/`null` for an unknown code-id (`:214-227` VERIFIED); `ARCHETYPE_KEYS = Object.keys(ARCHETYPE_ADJUSTMENTS)` auto-derives (`:205` VERIFIED).

Other canonical-lean touch-points (all consume, none re-declare the strings):
- `characterLeanPresentation.js:123-148` — `LEAN_DISPLAY_NAMES` UI titles for all 46 ids (UI chrome only; "nothing here feeds the prompt/gate", `:104-109` VERIFIED); `TEMPO_MEANING` per-archetype dial copy, 6 keys (`:94-101` VERIFIED).
- `leanOverrides.js:27,38-44` — directive↔lean override records; imports `getOpposedLeanIds` from `archetypeAdjustments.js` (data-driven, VERIFIED).
- `release2ControlsMatrix.test.js`, `leanOverrides.test.js`, `directiveGate.test.js`, `agentPromptAssembly.controls.enforce.test.js` — reference TF-/CN- ids as test fixtures (VERIFIED via grep, files_with_matches).
- **UNVERIFIED:** the census brief named `corpus.js` and `release2ControlsMatrix.test.js` as places the strings "live" — they are `api/scripts/archetype-integrity-eval/corpus.js` (eval corpus) and a test; both are *consumers/fixtures*, not the canonical source, which is `archetypeAdjustments.js`.

### 3. Traits, strength → paramValues profiles, trait-owned rule bundles

**Trait data lives in `src/data/traitLibrary.js` (NOT fenced): 16 fixed traits, each bundling 2–4 Forge rules with three strength profiles (subtle/moderate/dominant), keyed `ruleId → paramOverrides`** (`traitLibrary.js:1-11, 494-503` VERIFIED). Example: `trait-trend-rider` bundles `['tech-moving-average-trend','t-09','tv-01']` with per-strength param maps (`:19-44` VERIFIED). This is the SAME `ruleId → paramOverrides` shape as Trading Style Collections in `forgeCollections.js` (`:6-8` comment VERIFIED). Rule ids/param keys are validated against `forgeKnowledgeBase.js` (`:10` VERIFIED — a runtime coupling, not enforced in this file).

Per-archetype ownership: `ARCHETYPE_DEFAULT_TRAITS` maps each of the 6 code-ids to its three born-with traits (`:518-527` VERIFIED); e.g. `guardian → ['trait-steady-anchor','trait-penalty-dodger','trait-iron-discipline']` (`trait-steady-anchor` was minted in WS1 because `trait-diversifier`'s `a-05` barbell is a guardian core_conflict, `:429-462, 523-524` VERIFIED). Consumers are data-driven: `archetypeSeeding.js:42,67,85,159` reads `ARCHETYPE_DEFAULT_TRAITS[archetype]` (VERIFIED); `change-archetype.js` atomically loads the born-with set on archetype change (`:3-11` VERIFIED). Trait→rule projection into the decision path flows through `projectActiveRules.js` / `bundleRuleProjection.js` (grep hits VERIFIED). Strength profiles do NOT interpolate — they are three discrete authored snapshots (VERIFIED by structure). `TRAIT_SLOT_ENABLED = false` per census-supplied flag state; trait slotting is dark.

### 4. Voice Layer identity blocks referencing archetype

**The voice layer renders archetype identity purely from the `archetypeAdjustments.js` four zones — no archetype strings are hardcoded in `voiceLayerPrompt.js`.** It imports `getArchetypeZones, getAllowlist` (`voiceLayerPrompt.js:18` VERIFIED) and emits an IMMUTABLE CORE / TUNABLE EXECUTION / PROTECTED BIAS / OUT-OF-SCOPE block interpolating `zones.*` (`:2520-2526` VERIFIED). Critically, `getAllowlist` is checked BEFORE `getArchetypeZones` so an unknown archetype yields no menu and no block even though `getArchetypeZones` would analyst-fall-back (`:2512-2514` VERIFIED). Consequence for #7: **adding the `archetypeAdjustments.js` entry lights up the voice layer with zero `voiceLayerPrompt.js` edits.** Other archetype-keyed voice/opener maps: `openerTemplateFloor.js:18-26` `ARCHETYPE_POSTURE` (6 keys + `DEFAULT_POSTURE` fallback, reads `getArchetypeLabel` from the fenced config as a permitted READ-ONLY import, `:10-13` VERIFIED); `scouting-board.js:33-35` `chipForArchetype` (only degen + momentum_chaser get a chip; others return null — #7 degrades gracefully, VERIFIED).

### 5. Every other archetype-keyed switch/lookup (repo-wide)

| Site | Structure | Keys | Data-driven / hardcoded | Fence |
|---|---|---|---|---|
| `agentArchetypeConfig.js:36-219` | `ARCHETYPE_CONFIGS` (label, hftConfig, sectorConcentrationCap, convictionMods, regimePreferences, defaultConfig, avatarColors) | 6 | hardcoded map | **§1 FENCED** |
| `agentArchetypeConfig.js:247` | `VALID_ARCHETYPES = Object.keys(ARCHETYPE_CONFIGS)` | derived | auto-propagates | (fenced host) |
| `archetypeScoring.js:14-63,68-75,80-93` | `ARCHETYPE_WEIGHTS` / `ARCHETYPE_TEMPERATURES` / `ARCHETYPE_CONSTRAINTS` | 6 each | hardcoded maps | **concept-fence "scoring engine" — flag** |
| `archetypeAdjustments.js:48-190,283-351` | `ARCHETYPE_ADJUSTMENTS` + `ADJUSTMENT_CONFLICT_GROUPS` | 6 | hardcoded maps | not fenced |
| `archetypeRuleCompatibility.js:55-66,86+` | rule↔archetype compat map over 143 Forge rules (`native/neutral/core_conflict`) | 6 (`:61-66` array) | hardcoded map + per-rule classification; gated by `RULE_COMPAT_MODE='enforce'` | not fenced |
| `traitLibrary.js:518-527` | `ARCHETYPE_DEFAULT_TRAITS` | 6 | hardcoded map | not fenced |
| `archetypeDisplay.js:18-25` | `ARCHETYPE_DISPLAY_NAMES` (frontend canonical) | 6 | hardcoded; humanize fallback | not fenced |
| `archetypeIdentity.js:18` | `ARCHETYPE_IDENTITY` (teaching copy); analyst fallback `:66` | 6 | hardcoded map | not fenced |
| `archetypeCharacter.js:50,57` | `ROSTER_ORDER` (frozen array) + `ARCHETYPE_CHARACTER` (colors/combo/factors/tempPos); `FALLBACK_ID='analyst'` `:140` | 6 | hardcoded array + map | not fenced |
| `characterLeanPresentation.js:94-101,123-148` | `TEMPO_MEANING` + `LEAN_DISPLAY_NAMES` | 6 / 46 | hardcoded maps | not fenced |
| `openerTemplateFloor.js:18-26` | `ARCHETYPE_POSTURE` (+DEFAULT) | 6 | hardcoded; has fallback | not fenced |
| `compute-index-intelligence.js:48,1058-1066` | `const ARCHETYPES = [...]` drives `arch_scores` attachment | 6 | **hardcoded array — NOT imported from weights** | not fenced |
| `leagueTournament.js:367-374` | `CPU_ARCHETYPE_ORDER` (frozen) + `cpuArchetypeForN` | 6 | **hardcoded array; test-locked to `Object.keys(ARCHETYPE_WEIGHTS)`** (`leagueTournament.test.js:636`) | not fenced |
| `archetypeDerivation.js:33-49` | `deriveArchetypeFromAnswers` quiz→archetype router | 6 reachable | **hardcoded if/else logic** | not fenced |
| `screenStocks.js:40-42` | `arch_scores` archetype-keys allowlist for dot-path screening | 6 | **hardcoded array** (comments "compute-index-intelligence.js:47") | not fenced |
| `scouting-board.js:78` | `VALID_ARCHETYPES.includes(archetype)` validation (400 on unknown) | derived | auto-propagates | not fenced |
| `screenerAdapter.js:289-290` | `arch_scores.*` → display label via `getArchetypeDisplayName` | derived | auto-propagates | not fenced |
| `presenceBinding.js`, `behaviorFingerprint.js`, `tempoDialClamp.js` | consume via `getArchetypeConfig`/`resolveHftConfig` (data-driven) | — | auto-propagates | not fenced (behaviorFingerprint) |

`tournamentUserScoring.js` (census fence-flagged) contains **zero** archetype references (grep VERIFIED) — it is out of scope for Map 1; see contradictions for the fence-list discrepancy.

### HEADLINE — "to create archetype #7 today" boundary table

**DATA entries to add (N = 10 files):**

| # | File | Add | Fence |
|---|---|---|---|
| D1 | `src/data/archetypeAdjustments.js` | `ARCHETYPE_ADJUSTMENTS[#7]` (4 zones + M leans) + `ADJUSTMENT_CONFLICT_GROUPS[#7]` | not fenced |
| D2 | `api/_utils/archetypeScoring.js` | `ARCHETYPE_WEIGHTS[#7]` (sum 1.0) + `ARCHETYPE_TEMPERATURES[#7]` + `ARCHETYPE_CONSTRAINTS[#7]` | **concept-fence flag** |
| D3 | `api/_utils/agentArchetypeConfig.js` | `ARCHETYPE_CONFIGS[#7]` (label, hftConfig, sectorConcentrationCap, convictionMods, …) | **§1 FENCE — §7-gated** |
| D4 | `src/data/traitLibrary.js` | `ARCHETYPE_DEFAULT_TRAITS[#7]` (3 born-with traits; possibly new trait objects) | not fenced |
| D5 | `src/data/archetypeDisplay.js` | `ARCHETYPE_DISPLAY_NAMES[#7]` | not fenced |
| D6 | `src/data/archetypeIdentity.js` | `ARCHETYPE_IDENTITY[#7]` | not fenced |
| D7 | `src/data/archetypeCharacter.js` | `ARCHETYPE_CHARACTER[#7]` (+ `ROSTER_ORDER` array — see C-side) | not fenced |
| D8 | `src/data/characterLeanPresentation.js` | `TEMPO_MEANING[#7]` + `LEAN_DISPLAY_NAMES` for #7's new lean ids | not fenced |
| D9 | `api/_utils/openerTemplateFloor.js` | `ARCHETYPE_POSTURE[#7]` (optional — `DEFAULT_POSTURE` covers it) | not fenced |
| D10 | `src/data/archetypeRuleCompatibility.js` | new archetype key + classify all 143 Forge rules (`native/neutral/core_conflict`) for #7 | not fenced |

**CODE changes to make (M = 4 required + 1 conditional):**

| # | File:line | Change | Why required | Fence |
|---|---|---|---|---|
| C1 | `compute-index-intelligence.js:48` | append #7 to hardcoded `const ARCHETYPES` | else #7 gets no `arch_scores` (screener/board fit blind) | not fenced |
| C2 | `leagueTournament.js:367` | append #7 to `CPU_ARCHETYPE_ORDER` | test-locked to `Object.keys(ARCHETYPE_WEIGHTS)`; omission red-fails `leagueTournament.test.js:636`; also changes CPU rotation | not fenced |
| C3 | `screenStocks.js:42` | append #7 to `arch_scores` key allowlist | else `arch_scores.#7` dot-path screens rejected | not fenced |
| C4 | `archetypeCharacter.js:50` | append #7 to `ROSTER_ORDER` frozen array | else #7 absent from roster UI (array literal, not derived) | not fenced |
| C5 (conditional) | `archetypeDerivation.js:33-49` | add a routing branch | ONLY if #7 must be reachable from the onboarding quiz (else it's assignable but never auto-derived) | not fenced |

**No change needed (auto-propagating from the data adds):** `VALID_ARCHETYPES` (`agentArchetypeConfig.js:247`), `ARCHETYPE_KEYS` (`archetypeAdjustments.js:205`), the voice-layer four-zone render (`voiceLayerPrompt.js:2520-2526`), `archetypeSeeding.js`, `getArchetypeLabel`/`getArchetypeConfig`, `change-archetype.js`/`scouting-board.js` validation, `screenerAdapter.js` display. **Net: ~10 data files, 4 required code edits (5 with quiz reachability), 1 of which (D3) is a §1 fence contact and 1 (D2) a concept-fence contact.** The founder-facing headline: the identity/voice/lean/trait surface is admirably data-driven, but **four un-derived hardcoded 6-element lists (C1–C4) are the real "new archetype" tax**, and two of the richest-payload adds (scoring weights D2, the fenced physics config D3) sit behind fences.


---

## Map 2 — Enforcement map

**Verdict:** Every *hard, mechanical* guarantee lives in exactly two deterministic surfaces — the risk/knob chain in `agentRiskManager.js` and the post-Haiku guardrail layer in `agentGuardrails.js`, both driven from the eval cron `api/cron/agent-evaluate.js`. Everything an archetype "is" (voice, sector taste, conviction style, forge constraints, evidence hierarchy, leans) reaches runtime as **prompt text only** — injected by `agentEvalPromptAssembly.js` / `agentPromptAssembly.js` / `controlPromptRenderer.js` and obeyed at the model's discretion. Three declared behaviors reach runtime **nowhere**: the archetype `regimePreferences`/`canEnterDistressed` block, the `convictionMods` block, and — critically — the **Diversifier core sector-slot cap**, which is dark because its flag holds the string `'true'`, a value the code treats as neither `enforce` nor `observe`.

### 2.1 Deterministic (code guarantees it)

| Behavior | Enforcement site (VERIFIED @ HEAD) | Notes |
|---|---|---|
| **Tempo dial → knob clamp** | `tempoDialClamp.js:140` `applyTempoToHftConfig`; wired `agent-evaluate.js:1225` `clampHftConfig`, gated `TEMPO_DIAL_ENABLED` (featureFlags.js:469 = true) | Deterministically scales `swapWindow.capPerWindow`, `forcedRotation.ticksThreshold`, `hurdleFloor.atrMultiplier` by {0.7,1.0,1.3}. Identity-return when `standard` (`tempoDialClamp.js:141`). |
| **Forced rotation (Knob A)** | detection `agentRiskManager.js:154-166` (`forcedRotation` in `evaluateRisk`); counter `updateStagnationCounter` @205; execution `agent-evaluate.js:1287-1393` | Fires `SWAP_OUT reason:'stagnation'` only if `withinAge` + counter ≥ `ticksThreshold` + `dailyPct < winnerThreshold`. Guardian has it disabled (`agentArchetypeConfig.js:199`). |
| **Swap hurdle floor (Knob B)** | `agentRiskManager.js:308` `clearsHurdleFloor`; consumed `agent-evaluate.js:1384` (rotation) & `:2112` (Haiku swap) | Non-emergency swap must clear archetype ATR-margin floor + bench-positive. Emergency reasons bypass at step 1 (`:310`). |
| **Circuit breaker (Knob C)** | `agentRiskManager.js:475` `getRecentSwapCount`; enforced `agent-evaluate.js:1338` (forced-rotation) & `:2139` (Haiku) | Blocks swap when in-window count ≥ `swapWindow.capPerWindow`. Emergencies excluded from the count and bypass the cap (`:2130`). |
| **User stop-loss floor (hard)** | `agentGuardrails.js:209-244`, `applyGuardrails`; wired `agent-evaluate.js:2019` | Forces SWAP on any held position ≤ −value%; picks bench replacement, stamps `sourceNote:'guardrail_stopLoss'` → bypasses hurdle floor (`:407`,`:468`). |
| **User trailing stop (hard)** | `agentGuardrails.js:247-267` + `computeTrailingDrawdownPct:531` | Runs only if stop-loss didn't already pick a breach (single-swap invariant). |
| **User maxSectorWeight cap (hard)** | `agentGuardrails.js:273-292`, `checkSectorCap:592`; returns HOLD (`:472`) | Blocks a proposed SWAP that would push a sector over cap. Denominator = mode slot count in tournament, held-count otherwise (`:595`). Fires under **every** flag state for user-authored caps. |
| **Distressed swap-in exclusion** | `agent-evaluate.js:2074` (universal, deterministic) | Blocks SWAP-in of any `distressed`-regime symbol for **all** agents. |
| **LOCK (threshold proximity)** | `agentRiskManager.js:122-135` (LOCK action); enforced `agent-evaluate.js:2066` | Haiku cannot swap out a LOCKED symbol; guardrail forced-exit also defers on LOCK (`agentGuardrails.js:369`). |
| **Conviction floor (70)** | `agentSwapExecution.js:77` `validateTradeDecision` | SWAP with `conviction < 70` → invalid → downgraded HOLD at `agent-evaluate.js:2084`. |
| **Cooldown / self-swap / duplicate-slot** | `agentSwapExecution.js:59-64,52-56` (validate) + transaction invariants `:172-178` | 24h revolving-door cooldown + no-self-swap + no-duplicate-slot enforced at the transaction so all call sites inherit them. |
| **Tier multipliers / position weight** | `agentScoring.js:267-270` `calculateAssetScoreServer` | Star 2.0 / Core 1.5 / Support 1.0 via `CONVICTION_MULTIPLIERS`; flat6 stamps per-asset `tierMultiplier` (`:249,267`) so every tournament slot scores 1×. Deterministic in scoring, not in a "rule." |
| **Directive gate (Zone-1 refusal, chat)** | `directiveGate.js:70-95` `gateDirective`; allowlist `src/data/archetypeAdjustments.js` | Only a verbatim canonical allowlist string for the agent's own archetype can become `battle.directive`; a core-reversing ask writes `null`. Gated by `ARCHETYPE_INTEGRITY_MODE='enforce'` (featureFlags.js:516). |
| **Rule-compat hard block (Zone-1 refusal, equip)** | client write guard `src/services/ruleCompatGuard.js:60` + `forgeService.js`; `RULE_COMPAT_MODE='enforce'` (featureFlags.js:582) | Hard-blocks making a `core_conflict` rule must-obey (create-as-hard / promote / category-flip / reforge). Classification `src/data/archetypeRuleCompatibility.js`. Server endpoints (`equip-bundle.js:226`, `set-rule-hardness.js`, `reforge-bundle.js`) honor the same flag (mostly observe-logging server-side). |
| **Hard/soft rule classification** | `ruleHardness.js:23-40`; baked at deploy `projectActiveRules.js:56` | Deterministically *labels* a rule constraint-vs-strategy (`HARD_CATEGORIES={'risk','allocation'}`). NB: it determines the label, not obedience — see 2.2. |

### 2.2 Prompt-constrained (injected text; model usually complies, nothing forces it)

- **Forge rule CONSTRAINTS ("must obey")** — injected `agentEvalPromptAssembly.js:531-567` (eval) and `agentPromptAssembly.js:89-111` (deploy) as `== CONSTRAINTS (must obey) ==`. **No deterministic gate enforces a forge constraint on a trade.** The "must obey" is prompt language; the only code-enforced quantitative limits are the *separate* `deployedGuardrails` object (stopLoss/trailing/maxSectorWeight in §2.1), not `activeRules` text. Declared owner says "hard rule — you must obey"; actual enforcement is prompt-only → **disagreement**.
- **Forge rule STRATEGY PREFERENCES** — same injection sites, labeled "should follow." Genuinely soft; matches its claim.
- **Evidence hierarchy (institutional data lag / "intraday technicals ALWAYS override stale institutional")** — injected as `C_INST` block `agentEvalPromptAssembly.js:551-558` / `agentPromptAssembly.js:101-108` and the institutional intelligence block `:678-682`. Presented in constraint voice ("NEVER hold…") but is advisory text with no enforcement site → treat as prompt-constrained; the "NEVER/ALWAYS" framing disagrees with the absence of any gate.
- **Draft-time archetype sector/fundamental rules (`ARCHETYPE_CONSTRAINTS`)** — injected into the Sonnet strategy system prompt `agentPromptAssembly.js:22-24` and `tournamentAgentBoards.js:121-122`. e.g. diversifier "MUST span ≥7 sectors, no sector >4 stocks"; guardian "avoid ATR pctl >0.75." These shape the **shortlist only**, at draft, and are never re-checked; "MUST" is model-facing. Prompt-constrained. (The per-archetype `ARCHETYPE_WEIGHTS`, `archetypeScoring.js:14`, *do* deterministically re-sort the universe the model sees — a real but indirect lever.)
- **Coach directive body** — content is prompt text rendered by `controlPromptRenderer.js:213` `renderDirectiveBlock`, pushed at `agentEvalPromptAssembly.js:964`; renders only under `ARCHETYPE_INTEGRITY_MODE='enforce'` + `isDirectiveActive` (deterministic render-gate at `:952-966`). What the directive can *say* is deterministically fenced (2.1 directive gate); whether the model *follows* it is prompt-constrained (and Survival Mode explicitly licenses ignoring it).
- **Standing leans** — rendered by `controlPromptRenderer.js:231` `renderLeansBlock` at `agentEvalPromptAssembly.js:965` and deploy `agentPromptAssembly.js:152-162`. The lean text is explicitly self-limiting: "tune execution at the margin and never override your archetype's rules, platform safety, or an active directive" (`controlPromptRenderer.js:237`) → advisory. **Which** leans render is deterministically gated (`STANDING_LEANS_ENABLED`=true featureFlags.js:449 + membership/version/conflict/cap kernel `leanRevalidation.js`, cap `MASTERY_LEAN_CAP_MAX=4` @34), but the trade effect is prompt-only.
- **Survival Mode override** — instructed at `agentEvalPromptAssembly.js:206-208,427-429`: model *may* override user directives on a −1.0x ATR breach. Prompt-constrained permission; the deterministic backstop that actually protects P&L is the risk manager / guardrail bust-avoidance (2.1), not this text.
- **"DEFAULT TO HOLD" / clock-management / one-swap-max / no-round-trip** — `agentEvalPromptAssembly.js:68,197-204`. Trade-frequency dampening is prompt language; the mechanical frequency governors are Knob A/C (2.1) plus the deterministic 24h cooldown. "ONE SWAP MAXIMUM" is also structurally true (the cron executes a single swap per eval).

### 2.3 Soft (advisory only, by design)

- **profitTarget guardrail** — `agentGuardrails.js:342-360`: surfaced as `action:'note'`, no override. Matches its declared "soft" contract.

### 2.4 Unenforced (declared somewhere, reaches runtime nowhere)

- **Diversifier core sector-slot cap (35% ≈ "max 2 of 6 per sector")** — the code that would fire it, `injectDiversifierSectorCap` (`agentGuardrails.js:95-109`) and the observe half `resolveSectorSlotObserveCap` (`:123-126`), key off `SECTOR_CAP_MODE`. The flag value is the **string `'true'`** (featureFlags.js:555), so `SECTOR_CAP_MODE !== 'enforce'` → returns base unchanged (`:97`) **and** `SECTOR_CAP_MODE !== 'observe'` → returns null (`:124`). Result: the "ONE mechanical archetype-integrity piece" is **inert** — neither enforcing nor observing. Its doc-comment (featureFlags.js:551-554) describes a tri-state `off|observe|enforce`; `'true'` is off-menu. **Contradiction / disagreement.** *(User-authored `maxSectorWeight` caps are unaffected — they run through the same `checkSectorCap` under all flag states, 2.1.)*
- **Archetype `regimePreferences` (`favoredStrategies` / `avoidedStrategies` / `canEnterDistressed`)** — defined per archetype `agentArchetypeConfig.js:40-44,103-107,130-134,190-194` but **no runtime reader** (`git grep` for `canEnterDistressed`, `regimePreferences`, `.favoredStrategies` returns only the config file; the `favoredStrategies` consumer in `agentRegimeClassifier.js:135-148` reads the **strategy-preset** config, not this block). Contrarian's `canEnterDistressed:true` is doubly dead: unread *and* overridden by the universal distressed block at `agent-evaluate.js:2074`. **Contradiction.**
- **Archetype `convictionMods` (`convictionThreshold`, `volumeWeight`, `macdWeight`, `rsWeight`)** — `agentArchetypeConfig.js:61,92,148,179,211` — **no runtime reader** (grep clean outside config/tests). Declared to modulate conviction scoring; reaches nothing.
- **Archetype `sectorConcentrationCap`** — `agentArchetypeConfig.js:66,95,122,151,182,214` — read **only** by `behaviorFingerprint.js:152` (a display/analytics axis), never by any trade-time sector check. Unenforced as a trading constraint.
- **`tradeFrequency` string label** — `agentArchetypeConfig.js:67,96,123,183,215` — no runtime reader; actual cadence is Knob A/C + prompt. Descriptive only.
- **maxPosition guardrail** — `agentGuardrails.js:328-339`: logged `skipped_incompatible` ("BaggerBomb uses fixed tier slots"). Architecturally n/a → effectively unenforced.

### 2.5 Contradictions summary (must/enforced vs. actual)

1. `SECTOR_CAP_MODE='true'` (featureFlags.js:555) vs. its own tri-state doc-comment and the "mechanically true, not just narrated" claim in `agentGuardrails.js:31-36` — the cap is dark. The census prompt's hypothesis that `'true'` engages enforce is **false**: `'true'` engages nothing.
2. Contrarian `canEnterDistressed:true` (`agentArchetypeConfig.js:133`) vs. universal deterministic distressed swap-in block (`agent-evaluate.js:2074`) — and the flag is unread regardless.
3. Forge rule CONSTRAINTS labeled "must obey" (`agentEvalPromptAssembly.js:195,539`) vs. no deterministic obedience gate — only the unrelated `deployedGuardrails` object is code-enforced.
4. `FORGE_HARDSOFT_AUTHORING_ENABLED` doc-comment says "GATED OFF until the FENCED prompt-assembly half lands AND founder sign-off" but VALUE is `true` (featureFlags.js:51) — reconcile (comment-vs-value; not a Map-2 trade behavior but a live authoring gate).

### 2.6 Fence contacts

Reading only; **no edits made or proposed**. Behaviors that would require touching fenced files/concepts if ever changed: the Diversifier sector-cap logic and `SECTOR_CAP_MODE` reading live in **`agentGuardrails.js`** (fenced §1); the knob table (`agentArchetypeConfig.js`), risk chain (`agentRiskManager.js`), swap execution (`agentSwapExecution.js`), scoring (`agentScoring.js`), and both prompt assemblies are all fenced. **`tournamentUserScoring.js` discrepancy:** the census prompt fence-flags it, but it is **not** in the BUILD_RULES §1 list (verified against docs/BUILD_RULES.md:12-22) — flagged.


---

## Map 3 — Rule capability (A: corpus census + hardness vocabulary)

### A.0 Where the corpus actually lives

The runtime rule corpus is a single static, Firestore-free template library, `src/data/forgeKnowledgeBase.js` (3798 lines), exporting `FORGE_CATEGORIES` (`forgeKnowledgeBase.js:5` VERIFIED), `SEASON_CONFLICT_PAIRS` (`:21` VERIFIED) and `FORGE_RULE_TEMPLATES` (`:30` VERIFIED). There is **no** conversation-pipeline rule source — `git grep` for `conversationPipeline|conversation_pipeline|pipelineRules` returns zero hits (VERIFIED). The only other "rule-shaped" data sources are:

- **Curated collections** — `src/data/forgeCollections.js` (1119 lines, `TRADING_STYLE_COLLECTIONS` `:11` VERIFIED): these do NOT define new rules; they reference existing `forgeKnowledgeBase` `ruleId`s with `paramOverrides`, a `rationale`, and a `priority`/`priorityLabel` (`forgeCollections.js:31-32` VERIFIED). Collections are the *only* place a `priority` field appears — the base corpus has none (see A.2).
- **COLLECTION_DELTAS** — `src/utils/dimensionMapper.js:345` (VERIFIED), consumed at `:428` (VERIFIED). This maps a collectionId to trait-dimension deltas, not to rules per se.
- **Archetype-compatibility map** — `src/data/archetypeRuleCompatibility.js` (587 lines): a SEPARATE, runtime-neutral classification layer keyed by template id (see A.3).

Rules reach the live agent only by projection: `projectActiveRules()` rebuilds `agent.activeRules` from equipped bundle/trait docs at deploy time (`projectActiveRules.js:66` VERIFIED), and `agentPromptAssembly.resolveRuleText()` re-interpolates `textTemplate`+`params`+`paramValues` into prompt text (`agentPromptAssembly.js:314-316` VERIFIED). **The LLM prompt is the detector** — there is no deterministic per-rule condition engine (see A.2 "detector source").

### A.1 Rules per category

143 top-level templates (`grep -cP "^\s{4}id:"` = 143 VERIFIED; `^\s{4}category:` counts sum to 143 VERIFIED). Category set from `FORGE_CATEGORIES` `forgeKnowledgeBase.js:5-19` (VERIFIED).

| Category | id | mode | Rules | Banner line |
|---|---|---|---|---|
| Technical | `technical` | both | 25 | `:32`, `:1628` (expansion) |
| Mid-Battle Trading | `mid_battle` | clash | 16 | `:561` |
| Fundamental | `fundamental` | both | 14 | `:217`, `:1834` |
| Risk | `risk` | both | 12 | `:353`, `:2017` |
| Game State | `game_state` | clash | 11 | `:922` |
| Allocation | `allocation` | both | 11 | `:467`, `:2197` |
| Tier Strategy | `tier_strategy` | clash | 10 | `:1393` |
| Institutional | `institutional` | both | 10 | `:2776` |
| Threshold Strategy | `threshold` | clash | 8 | `:1209` |
| Entry Criteria | `entry_criteria` | season | 8 | `:3079` |
| Exit & Stops | `exit_stops` | season | 7 | `:3293` |
| Season State | `season_state` | season | 6 | `:3622` |
| Rebalancing | `rebalancing` | season | 5 | `:3484` |

All counts VERIFIED via `grep -oP "^\s{4}category: '"` uniq tally. Note two categories are physically split across a base block and an "(expansion)" block (`technical`, `fundamental`, `risk`, `allocation`), which is the seam behind the id-namespace duplication in A.4.

`modes` distribution across the 143: `both` 63, `clash` 54, `season` 26 (VERIFIED). `difficulty`: `beginner` 57, `intermediate` 62, `advanced` 24 (VERIFIED).

### A.2 Per-rule metadata: presence / absence

Every one of the 143 templates carries EXACTLY the same top-level field set — confirmed by `grep -cP "^\s{4}<field>:"` returning 143 for each: `modes`, `difficulty`, `forgeTemplates`, `relatedIndicator`, `kbEntryId`, `tags`, `agentUseDescription`, plus `headline`/`description`/`learnMore` (`learnMore` = 143 VERIFIED). The following fields return **0** hits across the corpus: `conflictGroup`, `priority`, `injectionClass`, `hardness`, `detector`, `requiredSignals`, `freshness`, `fallback`, `gameMode`, `novice`, `receipt`, `archetype` (all VERIFIED, count 0). The corpus is therefore metadata-thin: no per-rule hardness, no detector, no conflict-group, no priority, no freshness/fallback, no archetype field embedded in the template.

| Census dimension | Where it lives (if at all) | Presence | Enforced at runtime? |
|---|---|---|---|
| **Detector source** | None in-corpus. `relatedIndicator` is a display string (70/143 are `null`; only ~73 name an indicator) and is consumed ONLY by UI (`RuleDossier.jsx`, `DiscoverTab.jsx`) — its one api hit `technicalAnalysisPrompts.js:111` is an unrelated LLM output-schema field `"relatedIndicators"` (VERIFIED). Detection is the LLM reading injected prompt text. | Absent | **prompt-inferred (Haiku/decide LLM)** — never a deterministic field detector |
| **Required signals + freshness** | None. No `requiredSignals`/`freshness` field (count 0 VERIFIED). Data staleness is handled downstream in receipts, not per rule. | Absent | Unenforced at rule level |
| **Missing-data fallback** | None per-rule. | Absent | Unenforced |
| **Conflict group** | Not per-rule. Only `SEASON_CONFLICT_PAIRS` (6 curated pairs, season only, `forgeKnowledgeBase.js:21-28` VERIFIED) as warning copy. `conflictGroup` field = 0 (VERIFIED). | Sparse (season-only pairs) | Advisory warning copy, not enforcement |
| **Priority** | Not in base corpus. Only on collection-attached rules (`forgeCollections.js:31` `priority`/`priorityLabel`, VERIFIED). | Sparse (collections only) | Display ordering |
| **injectionClass / hardness** | NOT a rule field. `injectionClass` exists only as a comment: "The live agent has no injectionClass" (`src/utils/traitEnforcement.js:5` VERIFIED). Hardness is resolved by CATEGORY, not stored on the rule (see A.3). | Absent on rule; derived | See A.3 |
| **Archetype-compatibility** | Separate map `archetypeRuleCompatibility.js` keyed by template id (A.3). Explicitly runtime-neutral (INVARIANT R, `:9-13` VERIFIED). | Present but decoupled | Equip-warnings/badges ONLY, never prompts |
| **Game-mode eligibility** | `modes` field, 143/143 (`both`/`clash`/`season`, VERIFIED). Season entry gating via `create-entry.js`. | Consistently present | Deterministic (mode filter) |
| **Parameter schema/bounds** | `forgeTemplates[].params` — 143/143 have `forgeTemplates`; param types used: `number` (163), `select` (56), `toggle` (6) with `min`/`max`/`step`/`default`/`options` (VERIFIED). This is the ONE piece of corpus metadata deterministically consumed server-side: `seasonValidation.buildRuleSchemaRegistry(FORGE_RULE_TEMPLATES)` validates param edits against these bounds (`seasonValidation.js:145-152`, `season/create-entry.js:34,124` VERIFIED). | Consistently present | **Deterministic** (season param-edit validation only) |
| **Novice explanation** | `learnMore` (143/143 VERIFIED) + `agentUseDescription` (143/143). Consumed only by UI (`RuleDetailSheet.jsx`, `RuleDossier.jsx`) — zero api consumers (VERIFIED). | Consistently present | Display only |
| **Receipt / test coverage** | No per-rule receipt hooks. `captureReceipt.js` has a provenance block where EVERY version slot is hardcoded `null`: `detectorVersion`, `evaluationSpecVersion`, `calibrationManifestVersion`, `leanRenderConfigVersion`, `ruleLibraryVersion`, `archetypeVersion`, `regimeClassifierVersion` (`captureReceipt.js:338-344` VERIFIED). So the receipt cannot even stamp which corpus version produced a decision. Test coverage of the corpus is structural only (`archetypeRuleCompatibility.test.js`, `ruleCompatInvariantR.test.js` — VERIFIED file list); no test asserts a rule's *trading behavior*. | Sparse/absent | Unenforced |

**Consistently present:** the 7-field template skeleton + `learnMore` (100% coverage). **Sparse/absent:** everything that would let an engine enforce a rule deterministically — detector, signals, freshness, fallback, conflict group, priority, per-rule hardness, per-rule archetype.

### A.3 Full enforcement / hardness vocabulary (every distinct value present)

There are **two disjoint vocabularies**, plus a dead one:

**(1) Hard/soft (the runtime split).** Exactly two values, `'hard'` and `'soft'` — `ruleHardness.js:26-36` (VERIFIED). Derivation: `HARD_CATEGORIES = new Set(['risk','allocation'])` → those two categories are `'hard'`, everything else `'soft'` (`ruleHardness.js:23,27` VERIFIED). This is a category→hardness derivation, not per-rule data. An authored per-rule override may carry `'hard'`/`'soft'` on the active-rule item, resolved once at projection (`projectActiveRules.js:56`, override map `:78-88` VERIFIED — only the strings `'hard'`/`'soft'` are honored, anything else is ignored and falls back to category). Consumption is binary: hard rules render under `CONSTRAINTS:`, soft under `STRATEGY PREFERENCES:` in the assembled prompt (`agentPromptAssembly.js:89-96` VERIFIED — `constraints = activeRules.filter(isHardRule)`).

| Distinct value | Source | Citation |
|---|---|---|
| `hard` | override or category (risk/allocation) | `ruleHardness.js:26`, `projectActiveRules.js:56` VERIFIED |
| `soft` | override or category (all other cats) | `ruleHardness.js:27` VERIFIED |
| `null` (pre-resolution) | item before projection bakes it | `projectActiveRules.js:84` VERIFIED (treated as → category) |

**(2) Archetype-compatibility state (equip-time only, NOT enforcement).** Three shipped values plus one authoring-only value (`archetypeRuleCompatibility.js:55-56` VERIFIED):

| Distinct value | Meaning | Citation |
|---|---|---|
| `native` | in-style for archetype (51 cells) | `archetypeRuleCompatibility.js:55` VERIFIED |
| `neutral` | allowed (57 cells; also the default for the ~45 unclassified rules) | `:55` VERIFIED |
| `core_conflict` | off-style, requires a `zone1Ref` (25 cells) | `:55` VERIFIED |
| `needs_review` | authoring-only, forbidden while `DRAFT_MODE=false` | `:52,56` VERIFIED |

Cell counts VERIFIED via `grep -oP "state: '..."` (native 51, neutral 57, core_conflict 25). This map is explicitly INVARIANT-R runtime-neutral: it "must NEVER be imported by the fenced files, `projectActiveRules.js`, or either prompt assembly … equip-path warnings/blocks and render-time badges ONLY" (`archetypeRuleCompatibility.js:9-13` VERIFIED).

**(3) Dead vocabulary.** `injectionClass` — the eval-prompt split concept — has NO live values: "The live agent has no injectionClass" (`traitEnforcement.js:5` VERIFIED). Any Phase-1 reconciliation should treat it as designed-not-built for the live path.

**Phase-1 reconciliation note:** a single enforcement-mode enum would have to merge (a) the binary `hard`/`soft` prompt-section split, (b) the `native`/`neutral`/`core_conflict` equip-gate (which is *orthogonal* — a rule can be `soft` AND `core_conflict`), and (c) the mode gate (`both`/`clash`/`season`). These are three independent axes today, not one scale.

### A.4 Duplicate-semantics clusters, dead detectors, over-promising

**Duplicate / parameter-only-variant clusters not normalized into families.** The id namespaces (`grep -oP "^\s{4}id:"` VERIFIED) betray un-consolidated near-duplicates left by the base/expansion split:
- **Cross-category hardness duplicate:** `tech-avoid-declining` (`:194`, category `technical` → *soft*) and `risk-avoid-declining-trend` (`:444`, category `risk` → *hard*) encode the same "avoid downtrending stocks" intent but land on opposite hardness because hardness is category-derived (both are in the `weakness_avoidance` family, `archetypeRuleCompatibility.js:207-208` VERIFIED). A user equipping both gets one as a constraint and one as a preference for identical behavior.
- **RSI mean-reversion cluster:** `tech-rsi-oversold` (`:35`) plus `tv-06` "Bollinger Lower Band Entry" (`:2497`) and `tv-07` "Intraday Range Position" (`:2527`) are all grouped as `mean_reversion` (`archetypeRuleCompatibility.js:170-172` VERIFIED) — three separate templates, same buy-the-dip semantics with different parameterizations/indicators.
- **Anti-chase cluster:** `tech-rsi-overbought` (`:58`) and `t-10` "Avoid overextended stocks" (`:1658`, a VWAP-deviation variant) are both `chase_avoidance` (`:212` VERIFIED).
- The compat map itself documents the root cause: "the tag vocabulary cannot express direction" so volatility-SEEKING (`high_volatility`) and volatility-AVOIDING (`volatility_avoidance`) rules are indistinguishable by tag and had to be hand-split into separate curated id-lists (`archetypeRuleCompatibility.js:178-189` VERIFIED). These families are the closest thing to normalization and they cover only **98 of 143** rule ids (VERIFIED via distinct-id grep); the other ~45 fall through to `neutral` and are unclustered.

**Rules with NO live detector.** ALL 143 — there is no deterministic per-rule detector anywhere (A.2). Every rule is enforced solely by injecting its interpolated text into the strategy prompt (`agentPromptAssembly.js:93-96` VERIFIED) and trusting the LLM to honor it. The only deterministic touches are the season param-bounds validator (`seasonValidation.js`) and the sector-cap guardrail (`agentGuardrails.js`, per orchestrator anchor) — neither is a per-rule condition detector.

**Over-promising (display promises more than runtime delivers).** `agentUseDescription` strings use deterministic-sounding verbs — "check RSI levels before buying", "filter out stocks trading below their moving average", "automatically exclude stocks trading below the 200-day MA", "skip stocks with RSI above 70" (`forgeKnowledgeBase.js:55,78,124` and expansion, VERIFIED sample). Runtime delivers none of that filtering deterministically: a `soft`/technical rule becomes one line under `STRATEGY PREFERENCES:` that the LLM "should follow" (`agentPromptAssembly.js:96` VERIFIED), not a hard exclusion. Params reinforce the illusion — e.g. `tech-rsi-overbought.strictMode` toggle labelled "Hard exclusion mode … completely excludes overbought stocks instead of just deprioritizing" (`:70` VERIFIED) — but the toggle only alters the interpolated prompt sentence; there is no code path that excludes a stock, only prompt text a technical (soft) rule cannot promote to a constraint. This is the corpus's central over-promise: deterministic-verb copy over a prompt-preference substrate.

### A.5 Fence & flag notes bearing on the corpus

- `FORGE_HARDSOFT_AUTHORING_ENABLED = true` (`featureFlags.js:51` VERIFIED) — its own doc-comment says "flip to ship only after the fenced commit is reviewed for prompt parity and signed off" (`:48-49` VERIFIED). Value contradicts the gated-until-signoff comment (logged as contradiction). This flag governs whether per-rule `bundle.ruleHardness` overrides are authorable — i.e. whether the A.3 override path is user-reachable.
- `RULE_COMPAT_MODE = 'enforce'` (`featureFlags.js:582` VERIFIED) and `ARCHETYPE_INTEGRITY_MODE = 'enforce'` (`:516` VERIFIED): these turn the A.3(2) compat states into equip-time blocks — but per INVARIANT R they still never touch the prompt/projection path.



## Map 3 — Rule capability (B: equipped-rule runtime trace)

This traces one equipped Forge rule from the equip write through to the two Claude calls, the deterministic enforcement layer, and the receipt/eval record, at HEAD `a26cc192`. Every hop is cited `file:line` and marked VERIFIED (read this run).

**Headline finding (architecturally load-bearing):** an equipped Forge rule is **prompt-only** end-to-end. It becomes `agent.activeRules` (a projection) and is injected as text into the Sonnet strategy prompt and the Haiku intraday-eval prompt — but it **never reaches a deterministic enforcement site**. The only mechanical enforcement in the swap path (`applyGuardrails`) reads a *different* structure, `agent.deployedStrategy.guardrails`, which is **not** derived from equipped bundles, leans, or `activeRules`. So "equipped rule" and "mechanically enforced constraint" are two disjoint pipelines that happen to share the word "rule."

---

### (a) Equip write — what is stored, and snapshot-vs-projection

**Bundles** (`api/agent/equip-bundle.js`, FENCED-adjacent server migration of the client writer):
- The equip runs one Firestore transaction (`db.runTransaction`, L101). It reads the agent + target bundle (L111), validates ownership/battle-lock/forged-status/limits (L112-151), then **gathers frozen rule snapshots** from every currently-equipped bundle plus the new one via `gatherBundleSnapshots` (L155) and appends `bundle.ruleSnapshots` tagged with `bundleName` (L156). VERIFIED.
- It projects those snapshots into the agent-doc shape with `snapshotsToActiveRules` (L158) and writes, in the same tx: on the **bundle doc** `status:'equipped'` + `equippedAt` + optional `conflictCheckResult` (L176-184); on the **agent doc** `equippedBundleIds:[...current, bundleId]` and `activeRules` (L187-191, via `txUpdateAgentSettings` which also bumps `settingsRev`). VERIFIED.
- **Snapshotting vs live projection:** the *rule snapshots themselves* (`bundle.ruleSnapshots`) are frozen at **forge/reforge** time, not equip time — reforge resets them and draft bundles carry `ruleSnapshots: []` (`api/agent/reforge-bundle.js:50`, `:202`). VERIFIED. Equip merely *projects* those pre-frozen snapshots into `agent.activeRules`. This equip-time `activeRules` is **superseded at deploy** (see b), so it functions as a convenience cache, not the authority.
- Storage shape of each `activeRules` item (`api/_utils/bundleRuleProjection.js:14-27`): `{ ruleId, text, textTemplate, params, paramValues, category, bundleName, sourceRef, provenance }`. VERIFIED. Note this equip-path projection **does not carry `hardness`** — that field is only added by the deploy-time projector (see c).

**Standing leans** (`api/agent/equip-lean.js`, DARK-INERT unless `STANDING_LEANS_ENABLED`; flag = `true` at featureFlags.js:449):
- Stores **ids-at-rest** only: `agent.standingLeans = [{ adjustmentId, version, equippedAt }]` (L208-217), validated through the shared `validateLeanPin` kernel (L141) for menu membership + version currency, plus conflict-group rejection (L181) and a level-derived cap (L198). VERIFIED. No lean *text* is stored — the canonical sentence is resolved at render time from the pinned `version`.

---

### (b) Projection / read — the real site (design-doc `decide.js:~107` is STALE)

The stale anchor is confirmed dead: `decide.js:107` at HEAD is a deploy-auth comment (`api/agent/decide.js:105-108`). VERIFIED. The **actual projection site** is:

- Import `projectActiveRules` from `api/_utils/projectActiveRules.js` (`decide.js:17`), called at **`decide.js:182`** inside the deploy handler. VERIFIED.
- At deploy, decide.js reads the agent's `rules` and `bundles` subcollections fresh (`decide.js:176-181`) and re-projects `activeRules` from **live rule docs** — this is the "edit→activate fix": the stored equip-time `activeRules` is discarded and rebuilt so trait-strength/param edits propagate (`projectActiveRules.js:1-14`). VERIFIED.

`projectActiveRules(equippedTraits, ruleDocs, bundles)` (`projectActiveRules.js:66-114`) covers **both** required paths:
- **Trait path** (L94-106): rule docs whose `traitId ∈ equippedTraits`, deduped by `(traitId, sourceRef)` keeping newest `createdAt`. VERIFIED.
- **Non-trait path** (L108-111): docs with no `traitId` whose `id` is a member of a non-archived bundle's `ruleIds` (manual Advanced-Firmware + StarterKit rules). VERIFIED.
- Each item is mapped by `toActiveRuleItem` (L41-58), which — critically — bakes in **`hardness`**: `ruleIdToHardness[r.id] ?? classifyByCategory(r.category)` (L56). This is Phase 3's "single hard/soft resolution point." An authored per-rule override (`bundle.ruleHardness[rid]` ∈ {'hard','soft'}, L85-88) wins, else category default. VERIFIED.

**Conflict reconciler seam (answering the census question directly):** immediately after projection, decide.js calls `resolveForDeploy(projected, ruleDocs, agent.equippedTraits, { inject: CONFLICT_RECONCILER_INJECT_ENABLED })` (`decide.js:192-195`). VERIFIED. `CONFLICT_RECONCILER_INJECT_ENABLED = true` (featureFlags.js:427, per census). The result is assigned `agent.activeRules = activeRulesForDeploy` (`decide.js:201`) **before** the battle snapshot freezes it.

- **YES — with INJECT on, projected `activeRules` IS replaced by `resolvedRules` before freeze.** `resolveForDeploy` (`ruleConflictReconciler.js:482-502`): INJECT off → returns `projected` untouched (L483-485); INJECT on → returns `reconcilerError ? projected : result.resolvedRules` (L491). VERIFIED. `reconcile` computes `resolvedRules = input minus every loser ruleId, order preserved` (`ruleConflictReconciler.js:439-446`). VERIFIED. So the losing side of a detected contradiction is **dropped from `activeRules`** and never reaches either prompt or the frozen snapshot — this is the one place the equipped-rule set is mechanically mutated, and it is fail-open (a reconciler error falls back to raw `projected`, `decide.js:196-200`; L491). VERIFIED.
- The reconciler `report` is stashed to `agent.lastConflictReport` (`decide.js:209-211`) and persisted on the terminal deploy write (`decide.js:529`), only when INJECT is on. VERIFIED.

The frozen snapshot: `createAgentBattle` copies `agentContext.activeRules = agentData.activeRules || []` (`api/_utils/agentBattleService.js:161`, FENCED). VERIFIED. `agent-evaluate.js` does **no** re-projection — it reads `battle.agentContext?.activeRules` (`agent-evaluate.js:969`). VERIFIED. So the resolved set is frozen once at deploy for the battle's life.

---

### (c) Prompt injection format — exact shape, and where hardness changes wording

Both prompt builders split `activeRules` by hardness via the single server predicate `isHardRule` (`api/_utils/ruleHardness.js:39-41`, resolving `item.hardness` override-first, else `classifyByCategory`; `HARD_CATEGORIES = {'risk','allocation'}`, L23). VERIFIED. **Hardness is the wording switch:** hard rules render under a "CONSTRAINTS / must obey" heading, soft under "STRATEGY PREFERENCES / should follow."

**Sonnet strategy prompt** (`api/_utils/agentPromptAssembly.js:54-170`, FENCED — `buildStrategyUserPrompt`):
- `constraints = activeRules.filter(isHardRule)`, `strategies = !isHardRule` (L89-90). VERIFIED.
- Emitted as `CONSTRAINTS:\nC1. <text>...` and `STRATEGY PREFERENCES:\nS1. <text>...` under the header `FORGE RULES (your equipped strategy):` (L92-97, L111). VERIFIED.
- Text resolved by `resolveRuleText(r)` (L314-319): if `textTemplate + params`, interpolate then `sanitizeRuleText`; else `sanitizeRuleText(r.text)`. VERIFIED. `sanitizeRuleText` (L280-300) caps 200 chars, strips injection patterns/control bytes — the canonical P4 sanitizer.

**Haiku intraday-eval prompt** (`api/_utils/agentEvalPromptAssembly.js:526-568`, FENCED):
- Same `isHardRule` split (L531-532). Rendered as `== CONSTRAINTS (must obey) ==` / `== STRATEGY PREFERENCES (should follow) ==`, each line `C{i}. <text> [Category]` (L536-545), under `YOUR FORGE RULES:` (L567), followed by an obey/override instruction block (L560-566: "Constraints always override strategy preferences"). VERIFIED. The system-prompt gloss at L190-193/L411-413 reinforces "CONSTRAINTS ... are HARD rules — you must obey them unless Survival Mode activates." VERIFIED.
- `injectionClass` per se does not appear; the census's "hardness/injectionClass" wording maps to **`hardness` → CONSTRAINT/STRATEGY heading** as above. No other per-rule class alters wording.

**Standing leans + directive** render through the shared `controlPromptRenderer.js` (non-fenced), consumed by both assemblies:
- `renderLeansBlock` (L231-239): `STANDING LEANS (user-equipped persistent adjustments):` + `- "<text>"` lines + a precedence caveat ("never override your archetype's rules, platform safety limits, or an active directive"). VERIFIED.
- `renderDirectiveBlock` (L213-219): `ACTIVE DIRECTIVE (from your Coach): "<text>" threadId: <id>` + a directiveThreadId echo instruction. VERIFIED.
- Resolution gate `resolveControls` (L104-202): a **directive renders ONLY under `ARCHETYPE_INTEGRITY_MODE === 'enforce'`** (L134) with no resurrection across mode flips (L140, epoch-killed); **leans render only under `STANDING_LEANS_ENABLED`** (L172), minus override- and same-id-duplicate suppression (L179-193). VERIFIED. Strategy assembly pushes only the leans block (deploy has no battle/directive; `agentPromptAssembly.js:152-163`); eval assembly pushes both (`agentEvalPromptAssembly.js:953-965`). VERIFIED.

---

### (d) Deterministic enforcement — equipped rules are NOT here

The only mechanical rewrite of a trade decision is `applyGuardrails` (`api/_utils/agentGuardrails.js:168-486`), called from the eval cron (`agent-evaluate.js:2019-2027`). VERIFIED. Its input `guardrails` = `battle.agentContext?.deployedGuardrails` (`agent-evaluate.js:2004-2007, 2021`), which `createAgentBattle` freezes from **`agentData.deployedStrategy?.guardrails`** (`agentBattleService.js:165-167`). VERIFIED.

- **`deployedStrategy.guardrails` is a separate structure from equipped Forge rules / `activeRules` / bundle `ruleSnapshots` / `standingLeans`.** Nothing in the equip path (a) or the projection (b) writes `deployedStrategy.guardrails`. An equipped Forge "risk" rule (e.g. a stop-loss authored in the Forge) becomes a hard-category CONSTRAINT **string in the prompt** — it does **not** populate `byType.stopLoss` in `applyGuardrails`. VERIFIED by absence: `projectActiveRules` output shape (`projectActiveRules.js:41-58`) has no `type`/`value`/`enforcement` fields the guardrail engine reads (`agentGuardrails.js:204-211`).
- Guardrail types that ARE mechanically enforced (on `deployedGuardrails` only): `stopLoss`/`trailingStop` → forced SWAP (L208-269, L367-470), `maxSectorWeight` → blocked SWAP (L272-292, L472-482), `maxPosition` → logged incompatible (L328-339), `profitTarget` → soft note (L342-364). VERIFIED.

**The one identity-driven deterministic hook — and it is INERT at HEAD.** `injectDiversifierSectorCap` (`agentGuardrails.js:95-109`) would inject a synthetic 35% sector-slot cap for a tournament Diversifier, fired by `SECTOR_CAP_MODE`. But the guard is `if (SECTOR_CAP_MODE !== 'enforce') return base` (L97), and the observe half is `if (SECTOR_CAP_MODE !== 'observe') return null` (L124). **`SECTOR_CAP_MODE = 'true'`** (`featureFlags.js:555`, VERIFIED) matches *neither* branch → the cap is dead in both enforce and observe. This is archetype-bounded (Diversifier, tournament-only) and, regardless, not an equipped-rule path. See contradictions.

---

### (e) Receipt / eval-record field — is rule application recorded?

Two distinct records; **neither records deterministic equipped-rule application, because there is none**:

1. **L1 learning receipt** (`api/_utils/learning/captureReceipt.js`, gated by `LEARNING_L1_CAPTURE_ENABLED = true`, featureFlags.js:783): `buildRawReceipt` (L246-349) carries predicate inputs, D1 classifications, `archetype`, `guardrailReplay`, and a `versions.archetypeIntegrityMode` stamp (L337) — **there is no field naming which Forge rule fired or was cited.** VERIFIED. The other seven version slots (incl. `ruleLibraryVersion`) are hard-coded `null` ("do not exist in the codebase yet," L334-345). VERIFIED. So the equipped-rule application is **not** in the L1 corpus.
2. **Eval record** (`api/cron/agent-evaluate.js:2546-2559`): records `citedForgeRules: haikuResult?.cited_forge_rules` and `overriddenForgeRules: haikuResult?.overridden_forge_rules` (L2546-2547) — these are **Haiku-self-reported** via the tool schema (a model attestation, not a deterministic trace), plus `guardrailOverrides` (L2558) for the *guardrail* layer (which, per d, is not the equipped-rule layer). VERIFIED. The rule's influence is therefore recorded only as the model's own claim to have cited/overridden it, never as a mechanically-verified application.

---

### Fence contacts on this trace
Every prompt/projection/freeze hop touches BUILD_RULES §1-fenced files: `api/agent/decide.js` (projection call + reconciler seam, L182/L192), `api/_utils/agentPromptAssembly.js` (strategy injection), `api/_utils/agentEvalPromptAssembly.js` (eval injection), `api/_utils/agentBattleService.js` (`createAgentBattle` snapshot freeze, L161/L165). `captureReceipt.js` only *reads* fenced `VALID_ARCHETYPES` from `agentArchetypeConfig.js` (read-permitted). Any edit to change how an equipped rule projects, injects, freezes, or is enforced is a §7-gated fence contact. `agentGuardrails.js`, `projectActiveRules.js`, `ruleHardness.js`, `bundleRuleProjection.js`, `controlPromptRenderer.js`, and `ruleConflictReconciler.js` are NOT in the §1 list — the non-fenced seams deliberately hold the logic so the fenced call-sites stay thin.


---

## Map 4 — Customization collision map

**Discovery preamble.** Read-only census at HEAD `a26cc192`. `git fetch origin` was run this session; no project-state mutations. Every claim below carries a `file:line` citation and a VERIFIED (read this run) / UNVERIFIED marker. Fenced files were read, never edited; fence contacts flagged in the dedicated list.

### 1. The shape of the problem

TradeSeven has **at least nine** systems that can move an agent's trading behavior, and several of them write to or read from the *same* behavioral axis with **no shared arbiter**. The cleanly-arbitrated collisions all live inside one module — `controlPromptRenderer.resolveControls()` (directive vs. leans vs. archetype identity) — and the tempo-dial clamp (`tempoDialClamp.js`) which layers explicitly over the archetype knobs. Everything *outside* those two modules collides by **load order, snapshot timing, or Haiku's own reconciliation**, i.e. accidentally.

The single most important structural fact: **one Strategy-Dimension knob fans out into three parallel, independently-consumed artifacts**, and they are enforced at three different strengths:

| Dimension knob | Artifact 1 (soft, prompt) | Artifact 2 (soft, prompt) | Artifact 3 (hard, deterministic) |
|---|---|---|---|
| `stopLossPct`, `trailingStopPct`, `maxSectorWeightPct`, `maxPositionWeightPct`, `profitTargetPct`, … | Bundle rule → `activeRules` → prompt (`dimensionsToRuleSnapshots`, dimensionMapper.js:866 VERIFIED) | `deployedStrategy.directives` natural-language (`dimensionsToDirectives`, dimensionMapper.js:1193 VERIFIED) | `deployedStrategy.guardrails` → `applyGuardrails` (`dimensionsToGuardrails`, dimensionMapper.js:1315 VERIFIED) |

Artifact 3 always wins where it fires, because `applyGuardrails` runs **after** Haiku returns and overrides the decision (agentGuardrails.js:168, 367-469 VERIFIED). That precedence is *explicit and documented* (Phase-4B post-Haiku enforcement, agentGuardrails.js:1-18 VERIFIED). The disagreements are in the *gaps*: two of the three artifacts are prompt-level and can contradict the hard one, and one of the three (`directives`) is **not wired into the battle path at all** (see §5).

### 2. Collision table

| Axis | Systems touching it | Winner today | Precedence | Citation |
|---|---|---|---|---|
| Stop-loss / trailing-stop | dimension rule text; dimension directive; `deployedStrategy.guardrails` (hard) | **Guardrail** (forces exit post-Haiku) | **EXPLICIT** — guardrail runs after Haiku, overrides | agentGuardrails.js:208-267,367-469 VERIFIED |
| Max sector weight | user dimension `maxSectorWeight` guardrail; Diversifier core sector-slot cap | **User guardrail only** (core cap is dark) | **EXPLICIT but INERT** — `min(user,35%)` coded, gated off by flag | agentGuardrails.js:95-109 VERIFIED; featureFlags.js:555 VERIFIED |
| Max position size | dimension rule/directive text ("no holding above X%"); `maxPosition` guardrail | **Nobody** — guardrail is a no-op, prompt text is soft | **ACCIDENTAL / broken** — prompt promises a cap that is never enforced | agentGuardrails.js:327-339 VERIFIED; dimensionMapper.js:1294-1298 VERIFIED |
| Profit target | dimension directive "lock in gains"; `profitTarget` guardrail (soft note) | **Haiku's discretion** (soft note only) | EXPLICIT (declared soft) but user-invisible | agentGuardrails.js:341-364 VERIFIED |
| Swap cadence knobs (`capPerWindow`, `forcedRotation`, `hurdleFloor`) | archetype `hftConfig` (fenced); tempo dial | **Archetype base × tempo multiplier** | **EXPLICIT** — tempo modulates 5 leaves, identity-when-standard, version-bound fail-closed | tempoDialClamp.js:140-176 VERIFIED; agent-evaluate.js:1225-1233 VERIFIED |
| Risk base levers (`bustBuffer`, `vwapFailureTicks`, `trailStopATR`) + conviction | archetype config; `strategyPreset`; tempo dial | **`strategyPreset`** (feeds `evaluateRisk` base levers + `minConviction`) | **EXPLICIT isolation** from hftConfig (Gate-6 §6.2), but **ACCIDENTAL stacking** with tempo on felt "aggressiveness" | agentPresetConfig.js:6-63 VERIFIED; agent-evaluate.js:649,1211-1212,1277,1312 VERIFIED |
| Directive vs standing leans vs archetype identity | Coach directive; `standingLeans`; archetype identity | **Resolved ladder**: safety > archetype > directive > leans | **EXPLICIT** — single `resolveControls()` | controlPromptRenderer.js:35-48,104-202 VERIFIED |
| Trait expression | `agent.personality.traits` (prompt names); `equippedTraits` → `projectActiveRules` → `activeRules` (mechanical) | **Both, unreconciled** | **ACCIDENTAL** — two parallel trait channels, both hit the prompt, no cross-precedence | agentPromptAssembly.js:63-64 VERIFIED; projectActiveRules.js:66-114 VERIFIED |
| Directive channel (cognition prompts) | dimension `deployedStrategy.directives` (dead in battle); legacy `agent.directives[]` / `agentContext.directives` (write-dead, still read) | **Legacy array in debate/batch-review; dimension directives nowhere** | **ACCIDENTAL** — comment claims wiring that does not exist | legacyDirectiveSanitize.js:5-7 VERIFIED; debate.js:118-120 VERIFIED; agent-batch-review.js:151 VERIFIED |
| Candidate universe | equipped watchlist (frozen snapshot); scouting board; tournament candidate filter | orthogonal to behavioral knobs — no knob collision | n/a (universe control, not behavior control) | agentBattleService.js:168-175 VERIFIED; decide.js:248-268 VERIFIED |

### 3. The two cleanly-arbitrated collisions (explicit precedence)

**Directive / leans / archetype (`resolveControls`).** This is the one place precedence is designed, tested, and single-sourced. A directive renders only under `ARCHETYPE_INTEGRITY_MODE === 'enforce'` and never resurrects after a mode flip (`epoch_killed`); leans render only under `STANDING_LEANS_ENABLED`, minus leans overridden by the active directive (`overridden_by_directive`) or minted from the same adjustment id (`duplicate_of_directive`) (controlPromptRenderer.js:121-195 VERIFIED). Both fenced assemblies consume the *same* resolution object, so a control cannot render on one surface and suppress on a sibling (controlPromptRenderer.js:8-18 VERIFIED; agentEvalPromptAssembly.js:21,953-966 VERIFIED). The rendered ladder framing is explicit: leans are "rung-4 … subordinate to platform safety (rung 1), archetype identity, and an active directive" (controlPromptRenderer.js:221-238 VERIFIED). Flags at HEAD: `STANDING_LEANS_ENABLED=true` (featureFlags.js:449 per prompt), `ARCHETYPE_INTEGRITY_MODE='enforce'` (featureFlags.js:516 VERIFIED) — so both directive and leans are live at the read side.

**Archetype knobs × tempo dial.** `clampHftConfig` wraps the mode-resolved archetype `hftConfig` (agent-evaluate.js:1225-1233 VERIFIED). Tempo modulates exactly five leaves (swap cap, forced-rotation ticks, three hurdle-floor ATR multipliers) by ×{0.7,1.0,1.3}; safety/structural fields are preserved verbatim; when effective tempo is `standard` the **input object reference** is returned unchanged (tempoDialClamp.js:37-46,140-176 VERIFIED). The read-side rollback guard is real and fail-closed: a non-standard desire suppresses to `standard` unless `TEMPO_DIAL_ENABLED` **and** `bandTable.forKnobConfigVersion === deployedKnobConfigVersion`, with every suppression stamped in provenance (tempoDialClamp.js:106-133 VERIFIED). The clamp **never consults mastery levels** — equipped state grandfathers; the level gate lives only at the *setting* endpoint (`set-tempo-dial.js` requires per-archetype mastery ≥2 under enforcement, tempoDialClamp.js:8-15 VERIFIED; set-tempo-dial.js:28-33 VERIFIED). `TEMPO_DIAL_ENABLED=true` at HEAD (featureFlags.js:469 per prompt).

### 4. The accidental collisions (the real gap)

**(a) Tempo dial + strategy preset both sell "aggressiveness" and silently stack.** `strategyPreset` ∈ {aggressive, balanced, defensive} feeds `evaluateRisk` base levers (`bustBuffer`, `vwapFailureTicks`, `vwapDeadBandPct`, `trailStopATR`), `scoring.minConviction`, regime `favoredStrategies`/`holdOnlyRegimes`, and `promptGuidance` text (agentPresetConfig.js:6-63 VERIFIED; consumed at agent-evaluate.js:649,1277,1312,1453,1925 VERIFIED). The Gate-6 §6.2 invariant guarantees preset "cannot touch the [hftConfig] knobs" (agent-evaluate.js:1207-1212 VERIFIED) — so there is no *knob-level* collision. But tempo (hftConfig cadence) and preset (risk levers + conviction + prompt tone) both move the felt axis "how aggressively does the agent swap," with **no reconciliation layer**: an `aggressive` preset and a `patient` tempo, or vice-versa, simply compose. Worse, their **mutability epochs differ**: tempo is frozen into the battle snapshot at creation (agentBattleService.js:176-183 VERIFIED), while `updateStrategyPreset` writes `strategyPreset` **directly onto the live battle doc** and it is re-read fresh every tick (agentService.js:577-583 VERIFIED; agent-evaluate.js:649 VERIFIED). So a user can flip preset mid-battle (immediate) but cannot flip tempo mid-battle (snapshot-frozen) — two overlapping controls with opposite mutability contracts and no owner declaring which is authoritative.

**(b) Position cap: the prompt promises a cap that is never enforced.** `dimensionsToGuardrails` emits `maxPosition` as `enforcement:'hard'` (dimensionMapper.js:1336-1339 VERIFIED) and `dimensionsToDirectives` emits `dir-max-position` = "no single holding above X%" (dimensionMapper.js:1294-1298 VERIFIED). But `applyGuardrails` treats `maxPosition` as `skipped_incompatible` — "BaggerBomb portfolio uses fixed tier slots; position-% cap is architecturally n/a" (agentGuardrails.js:327-339 VERIFIED). Net: the user sees a hard cap, the prompt tells Haiku to obey it, and nothing enforces it. This is a genuine display-vs-enforcement disagreement (BUILD_RULES §9 spirit).

**(c) Two trait systems.** `agent.personality.traits` is joined into the identity block as free-text names in **both** the fenced strategy assembly (agentPromptAssembly.js:63-64 VERIFIED) and the tournament board builder (tournamentAgentBoards.js:152-153 VERIFIED). Independently, `equippedTraits` drives the *mechanical* rule projection into `activeRules` (projectActiveRules.js:66-114 VERIFIED). Nothing binds the two: the prompt can name traits that project no rules, and project rules for traits the personality string never mentions. `personality` is also carried forward by the training clone loadout (trainingClone.js:55 VERIFIED), so the drift replicates into pods.

### 5. Closing the standing questions

**COLLECTION_DELTAS — where do they write, what overlaps, second personality system?** They write **nowhere at rest**. `applyCollectionPreset(id)` merges a delta over `DIMENSION_DEFAULTS` and returns an **in-memory** `dimensionValues` object (dimensionMapper.js:426-435 VERIFIED); it is a *seed* for the Strategy-Dimensions UI, consumed by `CollectionPicker`/`SeasonEntryModal` and then funneled through the exact same `dimensionsToRuleSnapshots`/`materializeDimensionBundle` pipeline as manual tuning. It therefore overlaps the *entire* dimension axis set and resolves by **last-write** (the final `dimensionValues` the user deploys) — not a persisted parallel personality. **However**, there is a genuine *naming collision* with a second, distinct collection catalog: `forgeCollections.TRADING_STYLE_COLLECTIONS` uses the SAME ids (`swing-trader`, `day-trader`, …) but is "anchored on BaggerBomb rule IDs (`tech-*`, `t-*`, `mb-*`)" for the Discover/bundle surface, explicitly "tuned independently" from the season-mode `COLLECTION_DELTAS` (dimensionMapper.js:290-296 VERIFIED; forgeCollections.js:1-40 VERIFIED). Two catalogs, one id namespace, different rule projections — same collection name can mean two different rule sets depending on which surface forged it.

**equippedTraits projection (Option A) vs. trait removal — internally consistent?** Consistent on the *projection* side. `projectActiveRules` re-derives `activeRules` from live `equippedTraits` on every deploy, treating unequipped traits' rule docs as **inert-by-filtering**, not deleted (projectActiveRules.js:1-25,92-106 VERIFIED); the clone path likewise leaves replaced trait-rule docs "inert via the equippedTraits gate" (trainingClone.js:185-196 VERIFIED). `TRAIT_SLOT_ENABLED=false` (featureFlags.js:116 VERIFIED) only gates the *equip-slot UI* (equipSlots.js:10-24 VERIFIED); no live decision-path code assumes physical trait-rule removal. The one inconsistency is **not** removal-vs-projection but the second trait channel in §4(c): the `agent.personality.traits` prompt string is orthogonal to the projection and unreconciled.

**Tempo dial + standing-leans flag state / read sites / rollback guard.** Confirmed above (§3): `STANDING_LEANS_ENABLED=true`, `TEMPO_DIAL_ENABLED=true`; read sites are `controlPromptRenderer.resolveControls` (leans/directive) and `clampHftConfig` at agent-evaluate.js:1225 (tempo); the tempo rollback guard is `resolveTempoDial`'s version-bound fail-closed suppression (tempoDialClamp.js:113-133 VERIFIED).

**Surviving LEGACY fields (Stream-D orphan removal — did it happen?).** Partially, and by *neutralization-in-place*, not deletion:
- `agent.config.risk` → **live**: read at create-profile.js:187 (VERIFIED), snapshotted as `riskTolerance` (agentBattleService.js:184 VERIFIED), rendered as "Risk Tolerance: N/100" in the eval prompt (agentEvalPromptAssembly.js:498 VERIFIED). Not removed.
- `deployedStrategy` / `deployedStrategy.guardrails.stopLoss` → **very much alive** (the whole guardrail enforcement path; agentBattleService.js:165-167, agentGuardrails.js VERIFIED). Not an orphan.
- `strategyPreset` (+ the `'balanced'` battle default) → **live** control (agentBattleService.js:216 VERIFIED; agentService.js:577 VERIFIED).
- `agent.directives[]` / `agentContext.directives` → **write-dead but still READ** in two cognition prompts (debate.js:118-120, agent-batch-review.js:151 VERIFIED) via `legacyDirectiveSanitize.renderLegacyDirectives`; the write side-doors are neutralized (chat.js:455,642; voiceLayerPrompt.js:406 VERIFIED) but the read orphan persists.
- `agent.personality.traits` → **live prompt input** (agentPromptAssembly.js:63-64; tournamentAgentBoards.js:152-153 VERIFIED).
No evidence at HEAD of a wholesale orphan-*deletion* pass for these channels; they were fenced off on the write side and left readable. I did not find a code marker literally named "Stream D orphan removal," so whether a removal *task* was defined and dropped is UNVERIFIED — what is verifiable is that the fields still exist and several are still consumed.

**`deployedStrategy.directives` — a wired control, or dead?** Dead in the decision path. Only `deployedGuardrails` is copied into the battle snapshot (agentBattleService.js:163-167 VERIFIED); `directives` is not snapshotted and is consumed only by `SeasonReview.jsx:258` for UI display (VERIFIED). This directly contradicts the generator's own comment that these directives are text "the Haiku prompt can reason about during intraday battles" (dimensionMapper.js:1184-1192 VERIFIED) — see contradictions.

### 6. Note on `SECTOR_CAP_MODE` value

`SECTOR_CAP_MODE = 'true'` (featureFlags.js:555 VERIFIED). The only reader is `agentGuardrails.js`, which compares strictly `=== 'enforce'` (line 97 VERIFIED) and `=== 'observe'` (line 124 VERIFIED). The string `'true'` matches neither, so the Diversifier sector-slot cap is **fully dark** — no injection, no observe logging — exactly as if it were `'off'`. The doc-comment describes a tri-state `'off'|'observe'|'enforce'` (featureFlags.js:519-553 VERIFIED); the live value `'true'` is outside that vocabulary and reads as OFF despite *looking* enabled. The `min(user, core 35%)` precedence in `injectDiversifierSectorCap` is therefore coded-but-inert at HEAD; user-authored `maxSectorWeight` guardrails still fire independently of this flag (agentGuardrails.js:86-88 VERIFIED).


---

## Map 5 — Freeze & version map

**Scope & method.** Session preamble: `git fetch origin` run this session; HEAD `a26cc192` == `origin/main`, clean tree (VERIFIED, `git log -1`). This map inventories, for every agent-behavior input, whether it is **frozen into the `agentBattles` doc at creation/lock** (`createAgentBattle`, FENCED doc shape) or **resolved LIVE at each cron tick** (`api/cron/agent-evaluate.js`). The recurring pattern below is that **keys/identities are frozen, but the value TABLES they index into resolve live from deployed modules** — that seam is exactly where a future `ResolvedAgentManifest` freeze boundary must be drawn.

### 5.1 — Executive verdict

- The battle doc freezes a large, honest snapshot: portfolio, prices, thresholds, equipped **rules** (post-projection), **leans** (revalidated with resolved current text), watchlist tickers, deployed guardrails, dials, and archetype **identity** (agentBattleService.js:104-260, VERIFIED).
- But three behavior-defining value sets resolve **LIVE at tick from deployed code, keyed by a frozen scalar**: (a) **archetype knob values** `hftConfig` keyed by frozen `agentContext.archetype`; (b) **preset risk levers** keyed by frozen `strategyPreset`; (c) **tempo-dial bands** keyed by frozen `dials.tempo`. A redeploy that re-tunes any of these tables changes in-flight battles mid-run. This is the primary freeze-boundary gap.
- Prompt templates, the Haiku **model id**, and the live-context renderer are all live-from-module (never snapshotted). The watchlist **universe** (hotBench/monitoring) is rebuilt live each refresh; only equipped tickers are frozen.
- Version identifiers exist but are **sparse and mostly not wired into the freeze path**: `KNOB_CONFIG_VERSION=2` and `forKnobConfigVersion=2` guard tempo bands and are stamped into per-swap provenance/telemetry; the learning receipt carries a `versions{}` block of which **7 of 8 stamps are hardcoded `null` — versioned reads claimed but not implemented** (learningSchemas.js:205-214, VERIFIED).

### 5.2 — Freeze table: value × snapshotted-at-lock × resolved-live-at-tick × source

| Value | Snapshotted at lock? | Resolved live at tick? | Source / citation |
|---|---|---|---|
| Portfolio (star/core/support/bench) | **YES** (deep-copied, sector-stamped, `tierMultiplier`-stamped) | positions mutate via trades only | agentBattleService.js:129-138 VERIFIED |
| `startingPrices` | **YES** | entry basis = `asset.swapPrice \|\| startingPrices[sym]` | agentBattleService.js:139 VERIFIED; agent-evaluate.js:1271 VERIFIED |
| `initialPortfolio` (Amendment 5) | **YES** frozen | no | agentBattleService.js:200-204 VERIFIED |
| Scoring `thresholds` | **YES** | read from `battle.scoring.thresholds` | agentBattleService.js:144-145 VERIFIED |
| Scoring `pointValues` | **YES** (hardcoded literals bagger 15…meltdown -35) | no | agentBattleService.js:150-153 VERIFIED |
| Scoring `tierMultipliers` | **YES but WRITTEN-NEVER-READ** (per-mode record) | no reader | agentBattleService.js:146-149 VERIFIED |
| `gameMode` / `groupId` / `isCpu` | **YES** (joint-stamp contract) | keys mode-aware knob resolution | agentBattleService.js:62-112 VERIFIED |
| Archetype **IDENTITY** (`agentContext.archetype`) | **YES** | read as key each tick | agentBattleService.js:158 VERIFIED; agent-evaluate.js:1213 VERIFIED |
| Archetype **KNOB VALUES** `hftConfig` (forcedRotation / hurdleFloor / swapWindow), `regimePreferences`, `convictionMods`, `sectorConcentrationCap`, `label` | **NO** | **YES — LIVE from deployed module** `getArchetypeConfig(ctx.archetype)` → `resolveHftConfig(...)` | agent-evaluate.js:1213,1226 VERIFIED; agentArchetypeConfig.js:36-235 VERIFIED (**FENCED**) |
| `strategyPreset` (key) | **YES** (`'balanced'`) | read as key | agentBattleService.js:216 VERIFIED; agent-evaluate.js:649 VERIFIED |
| Preset **risk levers** (bustBuffer, vwapFailureTicks, trailStopATR, vwapDeadBandPct…) | **NO** | **YES — LIVE from module** `getPresetConfig(battle.strategyPreset)` | agent-evaluate.js:649,1277,1312 VERIFIED; agentPresetConfig.js:69 VERIFIED |
| Tempo dial desired value (`dials.tempo`) | **YES** (bounded string snapshot) | key into live bands | leanRevalidation.js:314-316 VERIFIED; agent-evaluate.js:1227 VERIFIED |
| Tempo **band table** (`TEMPO_DIAL_BANDS`) | **NO** | **YES — LIVE**, version-gated (`forKnobConfigVersion` must match `KNOB_CONFIG_VERSION` else `band_version_mismatch`, fail-closed) | tempoDialBands.js:16-32 VERIFIED; agent-evaluate.js:1225-1229 VERIFIED |
| Equipped **rules** (`activeRules`) | **YES** — frozen from `agentData.activeRules`, itself re-projected at deploy | read from `agentContext.activeRules` | agentBattleService.js:162 VERIFIED; agentEvalPromptAssembly.js:526,969 VERIFIED |
| `equippedBundleIds` | **YES** | no live re-read at tick | agentBattleService.js:162 VERIFIED |
| Standing **leans** | **YES** — revalidated (menu+version+conflict+cap) with **RESOLVED CURRENT text**; `standingLeansInvalidated` recorded | read from `agentContext.standingLeans` | agentBattleService.js:183 VERIFIED; leanRevalidation.js:266-318 VERIFIED; agentEvalPromptAssembly.js:959 VERIFIED |
| `settingsRev` | **YES** (monotonic per-agent) | no | agentBattleService.js:183→leanRevalidation.js:317 VERIFIED |
| **Traits** (`equippedTraits`) | **NO — not stored on battle doc**; consumed only at deploy to *project* rules | no (traits→rules happens pre-lock) | decide.js:182 VERIFIED (`projectActiveRules`); `TRAIT_SLOT_ENABLED=false` featureFlags.js:116 (per prompt) |
| `riskTolerance` (= `config.risk`) | **YES** | read from agentContext | agentBattleService.js:184 VERIFIED |
| Sector preferences — **deployedGuardrails** | **YES** frozen (Phase 4B anti-whiplash) | read from `agentContext.deployedGuardrails` each tick | agentBattleService.js:165-167 VERIFIED; agent-evaluate.js:2004-2014 VERIFIED |
| Sector-SLOT cap (diversifier injection) | **NO** | **YES — LIVE flag** `SECTOR_CAP_MODE` (currently inert; see contradiction) | agent-evaluate.js:2004 VERIFIED; agentGuardrails.js:97,124 VERIFIED |
| **Watchlist** — equipped tickers | **YES** frozen + `snapshotAt` | tickers unioned back each refresh | agentBattleService.js:173-174 VERIFIED; agent-evaluate.js:957-970 VERIFIED |
| **Watchlist** — hotBench / monitoring universe | seed only | **YES — REBUILT live from `stockRankings`** each daily refresh | agent-evaluate.js:940-976 VERIFIED |
| Prompt **templates** (system + live-context) | **NO** | **YES — LIVE from deployed module** | agentEvalPromptAssembly.js:43,269,489,854 VERIFIED (**FENCED**) |
| **Model choice** | **NO** | **YES — hardcoded live constant** `'claude-haiku-4-5-20251001'` (tick); Sonnet `'claude-sonnet-4-6'` at deploy | agent-evaluate.js:1914 VERIFIED; decide.js:307,386,418 VERIFIED |
| `evaluationInterval` (=15) | **YES** | no | agentBattleService.js:185 VERIFIED |
| `consolidatedInsight` | **YES** | no | agentBattleService.js:186 VERIFIED |
| Tournament `userPicksStance` / `doubleDownSymbols` / `userPicksAtDeploy` | **YES** (deploy-time half) | read for scoring | agentBattleService.js:192-198 VERIFIED |
| Prices / momentum / VWAP / regime / news | NO | **YES — live market data** | agent-evaluate.js:1268-1314 VERIFIED |

### 5.3 — Tick-time-resolution sites (the future freeze boundary)

Every site below reads live/mutable state at tick and is a candidate for a `ResolvedAgentManifest` field:

1. **agent-evaluate.js:1213** — `getArchetypeConfig(ctx.archetype)`: archetype→physics knobs resolved live from the FENCED module; only the identity string is frozen. (agentArchetypeConfig.js:221-223) VERIFIED.
2. **agent-evaluate.js:1226** — `resolveHftConfig(baseArchetypeConfig, battle.gameMode)`: mode-aware view, zero-delta today but a live hook (`hftConfigByMode`). (agentArchetypeConfig.js:233-235) VERIFIED.
3. **agent-evaluate.js:1225-1229** — `clampHftConfig({..., dialEnabled: TEMPO_DIAL_ENABLED})`: live flag + live band table gate the effective knobs. VERIFIED.
4. **agent-evaluate.js:649** — `getPresetConfig(battle.strategyPreset)`: base risk levers resolved live from preset table (frozen key). VERIFIED.
5. **agent-evaluate.js:1253-1262** — control-epoch telemetry reads live `ARCHETYPE_INTEGRITY_MODE`, `STANDING_LEANS_ENABLED`, `TEMPO_DIAL_ENABLED`, `KNOB_CONFIG_VERSION`, `TEMPO_DIAL_BANDS.forKnobConfigVersion`, `VERCEL_GIT_COMMIT_SHA`. VERIFIED.
6. **agent-evaluate.js:2004** — `injectDiversifierSectorCap(...)` gated on live `SECTOR_CAP_MODE`. VERIFIED.
7. **agent-evaluate.js:940-976** — watchlist hotBench/monitoring rebuilt live from `stockRankingsArray`. VERIFIED.
8. **agent-evaluate.js:1914** — Haiku model id hardcoded (live constant, not manifest-resolved). VERIFIED.
9. **agentEvalPromptAssembly.js:43/269/489/854** — prompt templates executed live from the FENCED module (rule/lean *content* is frozen, but rendering logic is live). VERIFIED.

Note the contrast: rule/lean **content** is already manifest-like (frozen in `agentContext`), but the **knob/preset/band/prompt/model** layers are not — a partial freeze today.

### 5.4 — Version identifiers that exist (with citation)

| Version id | Value | Meaning / where stamped | Citation |
|---|---|---|---|
| `KNOB_CONFIG_VERSION` | `2` | Monotonic hftConfig-table generation; stamped into control-epoch telemetry + per-swap provenance (`knobConfigVersion`) | agentArchetypeConfig.js:30; agent-evaluate.js:1261; swapProvenance.js:39 — VERIFIED |
| `TEMPO_DIAL_BANDS.forKnobConfigVersion` | `2` | Fail-closed band-vs-knob binding; stamped as `dialBandVersion` | tempoDialBands.js:32; agent-evaluate.js:1262; swapProvenance.js:38 — VERIFIED |
| `LEARNING_SCHEMA_VERSION` | `3` | Receipt `schemaVersion`; E1 (≤2) / E2 (≥3, archetype present) corpus epoch boundary | learningSchemas.js:38,99 — VERIFIED |
| `BAR_BASIS_TABLE_VERSION` | `1` | Receipt `barBasisTableVersion` (predicate bar-basis table) | barBasis.js:44; learningSchemas.js:100 — VERIFIED |
| `FORMULA_VERSION` (mastery) | `1` | Per-award `formulaVersion`, never retroactive | masteryFormula.js:27,163 — VERIFIED |
| `RECONCILER_VERSION` | `1` | Stamped in `conflictCheckResult.reconcilerVersion` at equip | ruleConflictReconciler.js:26; equip-bundle.js:170 — VERIFIED |
| `canonicalTextVersion` (per adjustment) | `1` (TF-*/CN-* etc.) | Lean pin-version; `validateLeanPin` rejects on mismatch (`deprecated_version`) | archetypeAdjustments.js:62-87; leanRevalidation.js:153 — VERIFIED |
| `settingsRev` | monotonic per-agent | `FieldValue.increment(1)` on every settings write; snapshotted into battle | agentSettingsTx.js:21; agentBattleService.js:183 — VERIFIED |
| `progressVersion` | monotonic per group/pod | Optimistic-concurrency guard on tournament/training draft mutations | tournamentGroupService.js:171; trainingLifecycle.js:427,502,513 — VERIFIED |
| bundle `ruleSnapshots` | (per-bundle frozen array, no explicit int version) | Equip/reforge-time rule freeze; projected to `activeRules` | bundleRuleProjection.js:38-49; equip-bundle.js:156,231 — VERIFIED |

Answer to the census question "does equip-time snapshotting now exist": **YES.** Bundles store `ruleSnapshots` (frozen at authoring/reforge); `gatherBundleSnapshots` + `snapshotsToActiveRules` project them into `agent.activeRules` at equip (equip-bundle.js:155-158, VERIFIED). At **deploy** `projectActiveRules` re-projects from current equipped state (decide.js:182), and at **lock** `createAgentBattle` freezes `agentData.activeRules` → `agentContext.activeRules` (agentBattleService.js:162; decide.js:185-188 comment confirms "before the battle snapshot freezes activeRules"). So rules are **double-frozen** (equip-time snapshot, then lock-time snapshot) — the tick never re-reads the mutable agent/bundle docs for rules.

### 5.5 — Versioned reads CLAIMED but NOT implemented

The learning receipt `versions{}` block declares **8 stamps, 7 hardcoded `null`** with an in-code VERIFIED note that they "do not exist in the codebase yet" (learningSchemas.js:202-214, VERIFIED):

- `detectorVersion` = null
- `evaluationSpecVersion` = null
- `calibrationManifestVersion` = null
- `leanRenderConfigVersion` = null
- `ruleLibraryVersion` = null
- `archetypeVersion` = null — comment: "stays null until the concept exists" (learningSchemas.js:113)
- `regimeClassifierVersion` = null
- `archetypeIntegrityMode` — the ONLY live-sourced one (`= ARCHETYPE_INTEGRITY_MODE`), passed through at capture (captureReceipt.js:337, `raw.archetypeIntegrityMode ?? null`) VERIFIED.

Also relevant to the census's own note: a grep for `swapDecisionReceipt`/`BEM` returns zero code hits — the built receipt is `learningReceipts/{battleId}/receipts/{receiptId}` via `makeReceiptSkeleton` (learningSchemas.js:93-224 VERIFIED). The "swapDecisionReceipt (BEM)" name is designed-not-built / renamed. UNVERIFIED whether any doc still references the old name.

### 5.6 — Fence contacts (Map 5 draws the future freeze boundary through fenced surfaces)

- **`createAgentBattle` doc shape** (agentBattleService.js, BUILD_RULES §1) — the entire freeze inventory (5.2) lives here; any `ResolvedAgentManifest` field additions land in this fenced shape. **FENCE CONTACT — §7-gated.**
- **`agentArchetypeConfig.js`** (hftConfig / `KNOB_CONFIG_VERSION`) — snapshotting knob values at lock (to close the 5.3-#1/#2 gap) requires reading/relocating this fenced table. **FENCE CONTACT.**
- **`agentEvalPromptAssembly.js` / `agentPromptAssembly.js`** — prompt templates resolve live; pinning a prompt version into the manifest touches fenced files. **FENCE CONTACT.**
- **`tournamentUserScoring.js`** — flagged by the census prompt as fenced but **absent from BUILD_RULES §1's enumerated list** (verified against BUILD_RULES.md:14-21, VERIFIED). Discrepancy flagged; not touched.

The scoring-engine and CPU-eval-budget concepts are fenced-as-concepts (BUILD_RULES §1:22-23); this map only *reads* them.


---

## Map 6 — Observability map

**Question:** at HEAD `a26cc192`, what can be *proven* about an agent decision from the records the engine actually writes? Short answer: **very little about the control stack.** The one durable, server-authoritative decision record — the L1 `learningReceipts` receipt — is a *predicate* record (raw D1/D2/D3 market inputs), not a control-layer ledger. It has no field for rules, traits, leans, or constraints; it fires only on the Haiku-autopilot swap path in production; and it is written only for `live_agent` evidence. Everything users actually *see* (statusFeed `citedRules`, Gemma chat narration) is a parallel projection off the battle doc, not a read of the receipt.

### 1. `swapDecisionReceipt (BEM)` — designed, not built (built under another name, different shape)

A `git grep` for `swapDecisionReceipt` returns **ZERO** code hits (VERIFIED — searched `api/`, `src/`, `tracer/`). `BEM` appears only in design docs and `package-lock.json` noise; `ENFORCEMENT_WIRING_FINDINGS.md:195` independently records that "BEM Phase 6 appears nowhere in `.js`" (VERIFIED). So the `swapDecisionReceipt (BEM)` named in the census prompt is **either designed-not-built or renamed**.

The thing that *is* built is the **Agent Learning System L1 receipt** at `learningReceipts/{battleId}/receipts/{receiptId}`, assembled by `api/_utils/learning/captureReceipt.js` (VERIFIED, 436 lines) and shaped by `api/_utils/learning/learningSchemas.js:97` `makeReceiptSkeleton` (VERIFIED). This is **not** a BEM hurdle/outperform decision receipt — it is an **outcome-blind predicate receipt**: `captureReceipt.js:5-12` states it "carries raw predicate inputs plus OUTCOME-BLIND derived annotations… NO outcome-derived / estimator field — no MPE, regret, contrast, return, effect, or scoring" (VERIFIED).

**Receipt schema at HEAD** (`learningSchemas.js:97-224`, VERIFIED):

| Field group | What it proves | Cite |
|---|---|---|
| `predicateInputs.{symbolIn,symbolOut}` | Raw physics at decision instant (bbPercentB, distanceToResistancePct, distTo52wkHigh, volumeRatio, upDayVolRatio, macdAboveSignal, regime, levels, dataMode) | `learningSchemas.js:45-64`; extracted `captureReceipt.js:107-121` |
| `predicateClassification` | Deterministic D1 dual-rule labels, dR null-reason, staleness/provenance — outcome-blind | `learningSchemas.js:69-91`; `captureReceipt.js:213-237` |
| `entryMark`, `entryATR`, `entryAtrSource` | Executed fill + which ATR branch the guardrails run on (`scored_threshold`/`bench_proxy`/`default_fallback`/`unknown`) | `learningSchemas.js:141-148`; `classifyEntryAtrSource` `captureReceipt.js:176-183` |
| `guardrailReplay` | Outgoing position's guardrail INPUT state (entry price, baseATR, thresholdHistory) — but highWaterMark / trailActivation / trailStepLevel are **NOT stored** (null-flagged) | `learningSchemas.js:155-164`; `captureReceipt.js:308-318` |
| `source`, `exitReason`, `haikuSwapReason` | Closed-enum decision provenance | `captureReceipt.js:297-299`; enums `learningEnums.js:18-39` |
| `archetype`, `versions.archetypeIntegrityMode` | Frozen archetype identity + the ONE live version stamp | `captureReceipt.js:287, 337` |
| `versions.{detectorVersion, ruleLibraryVersion, leanRenderConfigVersion, …}` | **All null** — "the other seven do not exist in the codebase yet (VERIFIED)… captured null, never invented" | `captureReceipt.js:338-344`; `learningSchemas.js:204-214` |

**Write path** (VERIFIED): `captureSwapReceipt` (`captureReceipt.js:374`) is create-only (`ref.create(receipt)` `captureReceipt.js:420`, deliberately never `.set()` to avoid silent corpus overwrite `captureReceipt.js:413-419`), fail-closed on validation (`captureReceipt.js:390-395`), and **awaited** — Signal-Capture-Rider §5 compliant: the write is awaited and its failure logged, never fire-and-forget (`captureReceipt.js:14-17, 432-434`, VERIFIED). **Storage/access**: `firestore.rules:825-828` — `learningReceipts/{battleId}/receipts/{receiptId}` is `allow read: if false; allow write: if false` — Admin-SDK only, **no client read** (VERIFIED). No runtime code reads it back; the only readers are offline scripts (`scripts/measure-l1-corpus.js:216`, `scripts/preflight-capture-check.js:202`, VERIFIED).

### 2. L1 capture — what it records about a decision, and where it is DARK

Five `captureSwapReceipt` call sites exist in `api/cron/agent-evaluate.js` (VERIFIED: lines 1655, 2290, 2930, 3125, 3332). **Only ONE is live in production**:

| Site | Path | Guard | Live at HEAD? |
|---|---|---|---|
| `agent-evaluate.js:2290` | Haiku autopilot swap | `LEARNING_L1_CAPTURE_ENABLED && classifyEvidence()==='live_agent'` (`:2249`) | **YES** (flag=true, `featureFlags.js:783`) |
| `agent-evaluate.js:1655` | Risk-manager swap | `… && LEARNING_L1_CAPTURE_EXPANSION_ENABLED` (`:1615`) | **NO** (EXPANSION=false, `featureFlags.js:802`) |
| `agent-evaluate.js:2930` | Approved/gameplan | `… && …_EXPANSION_ENABLED` (`:2911`) | **NO** |
| `agent-evaluate.js:3125`, `:3332` | Expired / gameplan-rotation | `… && …_EXPANSION_ENABLED` (`:3110`) | **NO** |

This is the "E1 = single-site capture" epoch the schema note describes (`learningSchemas.js:31-37`, VERIFIED). **Consequence:** at HEAD, receipts exist **only for discretionary Haiku swaps of live agents.** Risk-manager exits, guardrail stop-loss/trailing-stop exits, gameplan rotations, and expiry swaps produce **no receipt** — precisely the guardrail/risk decisions one would most want to prove. Additionally, `captureSwapReceipt` early-returns `non_evidence` for any CPU/training agent (`captureReceipt.js:383-386`), and the pre-flight gate (`preflightReceiptCheck.js:101-110`) counts only `evidenceClass==='live_agent'` toward the sample (VERIFIED).

**What a live receipt can and cannot prove about the control stack:** it proves the *physics* the decision saw and the *ATR the guardrails ran on*; it stamps *that* an archetype-integrity mode was in force (`archetypeIntegrityMode`) but not which constraint fired; and it records the exit *reason* enum. It carries **no rules-considered list, no lean state, no trait projection, no sector-cap decision, no constraint-evaluation trace.** `LEARNING_L1_CAPTURE_EXPANSION_ENABLED=false` (`featureFlags.js:802`) keeps even the multi-path coverage dark.

### 3. Shadow-logger streams — non-durable, mostly fire-and-forget

`api/_utils/shadowLogger.js:1-14` self-identifies as "Fire-and-forget shadow logging to GCS… NEVER throws. NEVER blocks" and explicitly names itself the **BUILD_RULES §5 cautionary tale** — "the shadow logger's silent multi-week data loss" (VERIFIED `shadowLogger.js:13-14`). Each `log*` wrapper appends one JSONL object to `shadow/{stream}/{date}/{eventId}.jsonl` and returns a boolean (`shadowLogger.js:44-69`, VERIFIED). Decision-relevant streams:

- `logDecision` → `decisions` stream, called from `decide.js:556` and `:714`, both **fire-and-forget** (`.catch(() => {})`, VERIFIED). Payload carries `strategyBrief`, `portfolio`, `bench`, `innerMonologue`, `archetype`, `tokenUsage` — deploy-time strategy, **not** per-swap control-layer state (`decide.js:556-572, 714-731`, VERIFIED).
- `logEvaluation`/`logTradeNarration`/`logAnticipation`/`logSignalDrops`/`logVisionTransition`/`logVisionConstraintChange` — all fire-and-forget GCS appends (`shadowLogger.js:74, 121-154`, VERIFIED). `signal_drops` (from `injectionGuard.js:18`, `sanitizeParsedOutput.js:24`) is the closest thing to a "blocked-signal" record but is **non-durable** and never read back by the engine.
- **The one stream that checks the boolean** is the rule_compat catalog stream gating WS1 enforce (`shadowLogger.js:10-13`; `log-rule-compat-event.js:104` surfaces a lost write as a 500 rather than a silent 200, VERIFIED). Every other decision stream can silently lose data. **None of these is the engine's authoritative record** — they are training-data side-channels.

### 4. Voice Layer / Film Room — a PARALLEL explanation source, not a receipt read (BUILD_RULES §9)

`api/_utils/voiceLayerTradeNarration.js` generates Gemma's post-swap narration from a **fresh read of `closedTrade` + battle + agent + market + DRB + cache** (`voiceLayerTradeNarration.js:34-40, 60-64`, VERIFIED) and writes it to the battle's `chatExchanges`/`statusFeed` (`:5-6`). It **does not read `learningReceipts`** — a `git grep learningReceipt` over `src/**` and `voiceLayer*` returns only the featureFlags doc-comment, no read (VERIFIED). Film Room components (`src/components/FilmRoom/{TradeHistorySection,AnticipationLogSection,FilmRoomChat,AutoDebriefHero}.jsx`) read `statusFeed`/`chatExchanges`/`trades`/`citedRules` off the battle doc (VERIFIED via grep), not the receipt.

**Display-agreement posture (§9):** `statusFeed.citedRules` *is* engine-written at swap time — the risk/guardrail paths write deterministic reason arrays (`agent-evaluate.js:1347` `['swap_window_cap']`, `:1430`/`:1587` `[riskResult.reason]`, `:1465` `['vwap_cascade_guard']`, VERIFIED), so for guardrail exits the display projects the engine's own decision field (good agreement). But the *Haiku* citedRules are the model's **self-reported** `haikuResult.cited_rules` (`agent-evaluate.js:2472, 2492`, VERIFIED), and the Gemma chat narration is an **LLM reinterpretation** layered on top — an explanation *generated about* the trade, not a projection of a recorded control-layer decision. So the user-facing "why" and the durable receipt are two different objects that never cross-check each other.

### The gap table — can today's records show each control layer was CONSIDERED / APPLIED / BLOCKED?

Records in scope: **R** = `learningReceipts` (live Haiku-path only, live_agent only); **S** = battle-doc `statusFeed` (all paths, display); **G** = fire-and-forget GCS shadow streams (non-durable).

| Control layer | CONSIDERED | APPLIED | BLOCKED |
|---|---|---|---|
| **Physics** (D1/D2/D3 inputs, ATR, VWAP) | **yes** — R `predicateInputs` captures raw market state at decision instant (`captureReceipt.js:107-121`) *(Haiku-path only)* | **yes** — R `entryATR`+`entryAtrSource` prove which physics value guardrails ran on (`learningSchemas.js:143-148`) | **partial** — a physics block that *caused* a swap is an `exitReason` enum (`vwap_failure`,`bust_avoidance` `learningEnums.js:30`) or S `citedRules` (`:1465`); a physics check that *rejected a candidate entry* is not receipted |
| **Constraints** (archetype-integrity, sector cap, directive gate) | **no** — R stamps only `archetypeIntegrityMode` *mode* (`captureReceipt.js:337`), not which constraint was evaluated; vision-constraint changes only in fire-and-forget G (`shadowLogger.js:122`) | **partial** — R records the *mode* was `enforce`, not the specific constraint decision; sector-cap has no receipt field | **no** durable — a sector-cap/constraint block is not in R; at best a fire-and-forget `signal_drops` G entry |
| **Rules** (Forge rules) | **no** — R has **no rules field at all**; `ruleLibraryVersion` is null (`captureReceipt.js:342`) | **partial** — S `citedRules` = rule IDs that "influenced this trade" (`agentEvalToolSchema.js:87`), but Haiku's are LLM **self-report** (`agent-evaluate.js:2472`), not deterministic proof; not in R | **no** — no record of a rule blocking a candidate |
| **Traits** | **no** | **no** — no R field, no S field; `TRAIT_SLOT_ENABLED=false` (`featureFlags.js:116`) | **no** |
| **Leans** (standing leans, tempo dial) | **no** — no R/S field per decision; `leanRenderConfigVersion` null (`captureReceipt.js:341`) | **no** — lean state at swap time is unrecorded (equip/unequip logs to fire-and-forget `signal_drops` only, `equip-lean.js:38`) | **no** |
| **Guardrails** (stop-loss, trailing stop, risk manager) | **partial** — R `guardrailReplay` captures outgoing entry price/baseATR/thresholdHistory (`captureReceipt.js:308-318`) but highWaterMark/trailActivation/trailStepLevel are **NOT stored** (`learningSchemas.js:157-160`) → replay is incomplete | **yes (Haiku-path R + all-path S)** — `exitReason` enum `guardrail_stopLoss`/`guardrail_trailingStop`/`stepped_trail` + `source='guardrail'/'risk_manager'` (`learningEnums.js:18-39`); S `citedRules=[riskResult.reason]` on every path (`:1430,1587`). **But R fires only on Haiku swaps — a risk/guardrail exit produces no receipt** | **partial** — a guardrail that *blocked* a swap (`swap_window_cap` `:1347`, `vwap_cascade_guard` `:1465`) is in S display only; never receipted, because R is execution-triggered and a block means no execution |

**The structural gap in one line:** the receipt is *execution-triggered and predicate-focused* — it can never record a NON-action (a considered-but-blocked swap), and it carries zero fields for rules/traits/leans/constraints. The only per-decision surface spanning all paths and all control layers is `statusFeed` — a **display projection** carrying self-reported `citedRules`, not a deterministic control-layer proof ledger.


---

# Part 3 — Runtime touchpoint inventory

## Part 3 — Runtime touchpoint inventory

*Read-only census at HEAD a26cc192 (origin/main, clean; fetched this session). Every claim carries file:line + VERIFIED (read this run) / UNVERIFIED. Fence contacts flagged inline and collected at the end.*

### 3.0 Executive verdict

- **Cron budget is real and tight.** `vercel.json` declares exactly **37 cron entries** (VERIFIED by count, `vercel.json:20-168`), matching BUILD_RULES §6's "37/40". A Phase-2 compile step and a shadow-eval pass **must ride existing handlers**, not claim new slots (at most 2 new entries exist and they are contested).
- **Two cadences can carry the new work with zero new slots:** `agent-evaluate` (`*/15 13-21 M-F`, `maxDuration: 300`) is the only handler that already runs a live LLM prompt per battle and already owns a per-tick time budget — the natural host for a **shadow-eval** pass. `equip-bundle` / `equip-lean` (synchronous POST endpoints, not crons) are the natural host for an **equip/save-time compile**, and `firestore.rules` already whitelists the compiled-artifact bundle fields.
- **Both attach points touch the fence.** Compile-at-battle-lock touches the fenced `createAgentBattle` doc shape and `decide.js`; a shadow prompt on the eval tick rides the fenced *agentBattles CPU-evaluation budget architecture* and re-invokes the fenced `agentEvalPromptAssembly`. These are §7-gated (see Fence contacts).

---

### 3.1 Cron endpoints touching agent evaluation / battle lifecycle / voice cache

All six relevant handlers share the house auth pattern: `x-vercel-cron === '1'` OR `Bearer ${CRON_SECRET}` (VERIFIED e.g. `agent-evaluate.js:149-152`, `voice-layer-cache.js:568-571`, `tournament-orchestrator.js:38-41`). All discover work through `findActiveAgentBattles(db)` (VERIFIED imports at `agent-evaluate.js`, `voice-layer-cache.js:11`, `agent-batch-review.js:14`, `agent-daily-scores.js:23`).

| Cron (path) | Schedule (vercel.json, UTC) | maxDuration | What it does | Consolidation today |
|---|---|---|---|---|
| `agent-evaluate` | `*/15 13,14,…,21 * * 1-5` (`:135`) | **300s** (`agent-evaluate.js:109`) | Expiry completion (all battles) → mastery sweep → GC repair → market gate → per-battle **Haiku eval tick** (`processAgentBattle`) with trigger gate, risk swaps, 5× `executeSwapServer` sites, score/VWAP writes | Already the mega-handler: settlement + eval + mastery + tournament ledger folded into one 300s budget |
| `voice-layer-cache` | `*/15 13,14,…,20 * * 1-5` (`:143`) | 60s (`voice-layer-cache.js:18`) | Bulk EODHD price fetch + Firestore reads → builds `portfolioBriefs`/`benchBriefs`/`scoutAlerts`/`marketContext` → one `writeBatch` to `voiceLayerCache/{battleId}` (`:681-701`) | Single batched write; pure builder fns exported (testable) |
| `tournament-orchestrator` | `*/10 11,12,13,14,21,22,23 * * 1-5` (`:163`) | **300s** (`tournament-orchestrator.js:26`) | Transport shell only: cron auth + Anthropic singleton + one `runOrchestratorTick(db,{now,anthropic})`; all routing/budget in `tournamentOrchestrator.js` (`:44-50`) | Inert at zero groups; duty budget defers remainder ~270s |
| `process-pending-reflections` | `*/15 13,…,0 * * *` (`:139`) | 60s (`process-pending-reflections.js:24`) | Drains `status='completed' AND pendingReflection=true` (`:44-50`), `BATCH_LIMIT=5`, `TIME_BUDGET_MS=50_000`, awaits `generateReflection`, clears flag (`:27-95`) | Dedicated queue-drain cron born from a fire-and-forget race fix (`:1-19`) |
| `agent-batch-review` | `25 20,21 * * 1-5` (`:147`) | 60s (`agent-batch-review.js:21`) | Per battle: Haiku EOD review (15s timeout, `:189-193`) → writes `dailyReviews`/`statusFeed`; then **fire-and-forget Gemma auto-debrief** (`:229-355`) | Sequential per-battle loop; second daily firing is a per-battle no-op via `todayStr` dedupe |
| `agent-daily-scores` | `45 1 * * 2-6` (`:43`) | default (no `config` export) | Per battle: banks daily badge points, resets `thresholdHistory`, clears `swapPrice`/`swappedInDay`, bumps `timing.currentTradingDay`; idempotent on `scoreState.dailyScores.{dayKey}.recorded` (`agent-daily-scores.js:45-203`) | Overnight settlement; sequential loop |

**Budget reality (VERIFIED, `vercel.json:20-168`):** 37 entries present. BUILD_RULES §6 caps additions at 2. New evaluation work should branch inside these handlers rather than add entries.

**Where a COMPILE step could attach (ride existing cadence):**
- **Not on a cron at all for the primary path** — the compile inputs (equipped bundles/leans/traits) are only mutated by the synchronous equip endpoints (§3.2). A cron compile would only be needed for a *backfill/repair* sweep, which could ride `agent-evaluate`'s existing isolated-subtask pattern (`agent-evaluate.js:238-264`, the mastery/GC sweeps: try/catch-isolated, `limit`-paged, "no new schedule entry, BUILD_RULES §6" is the stated design at `:231-232`). Attach point: a new isolated block alongside `runRepairSweep` / `repairBareGcCompletions` inside the handler `try`, after the market gate.

**Where a SHADOW-EVAL pass could attach:**
- **Inside `processAgentBattle`, immediately after the live Haiku call block** (`agent-evaluate.js:1895-1963`). The live call is a single `anthropic.messages.create` at `:1913-1931`; a shadow prompt would be a second `messages.create` guarded by the same `shouldStartHaikuCall` budget helper. **Function:** `processAgentBattle` (`:527`); **line:** attach after `:1963` (post-`finally` of the live call) and before decision processing at `:1965`, or gate it into the `finalUpdate` write at `:2671`. **Fence:** this re-invokes fenced `agentEvalPromptAssembly` (`buildEvalSystemPrompt`/`buildLiveContextBlock`, called `:1917-1927`) and rides the fenced CPU-eval budget architecture — §7 contact.
- The `finalUpdate` object at `agent-evaluate.js:2646-2670` is the single awaited per-tick write (`await battleRef.update(finalUpdate)` `:2671`) — a shadow result would ride this existing write op (the `cronErrors` capture at `:2648-2660` is the precedent for "rides this finalUpdate — no new write op").

---

### 3.2 Candidate compile points — data available + writes permitted under firestore.rules

**Cross-reference:** `firestore.rules` bundles subcollection already whitelists compiled-artifact fields on **both create and update**: `compileConfidence`, `compileTransparency`, `dimensionHash`, `dimensionValues`, `dimensionSchemaVersion` (VERIFIED `firestore.rules:276` create allowlist, `:280` update `hasOnly`). Critically, the **equipped-bundle content freeze** freezes only `ruleIds`/`ruleSnapshots`/`ruleHardness`/`name` (`firestore.rules:320-321`) — the comment at `:316-319` states "Dimension/telemetry fields on equipped docs stay writable (the persist-on-launch case)." So a compiled artifact can be written onto a bundle **even while equipped**, from the client, today. (An existing precedent compiler, `api/forge/compile-dimensions.js` `maxDuration:30` `:29`, writes `dimensionValues`/`compileConfidence` to `workshopTheses`/`workshopSessions` via Admin SDK, `:651-697` — not onto the bundle, and not at equip time.)

| Compile point | Data available there today | Writes PERMITTED (firestore.rules) | Fence |
|---|---|---|---|
| **Agent equip/save time** — `equip-bundle.js` tx (`:101-201`), `equip-lean.js` tx (`:120-219`) | Full agent doc; bundle doc incl. `ruleSnapshots`/`ruleHardness`/`name`; all currently-equipped bundles via `gatherBundleSnapshots` (`equip-bundle.js:155`); projected `activeRules` (`:158`); reconciler `conflictCheckResult` (`:163-174`); mastery limits. Lean: `standingLeans` pins, archetype menu, conflict groups (`equip-lean.js:141-186`) | **Server (Admin SDK) bypasses rules entirely** — both endpoints write via Admin SDK so any field is writable. **Client-side** these same endpoints already write `bundle.status/equippedAt/conflictCheckResult/updatedAt` (`equip-bundle.js:176-184`) and `agent.equippedBundleIds/activeRules/settingsRev` via `txUpdateAgentSettings` (`:187`). If a compiler wrote compiled fields onto the **bundle** doc, the client rules permit it (`firestore.rules:276/280`). Agent-doc client **update** allowlist is narrow (`firestore.rules:221-222`: only `directives`,`lastViewedEvolutionCycle`,`starterKitCompleted`,`updatedAt`) — a compiled artifact on the agent doc is **server-only** in practice | None (non-fenced endpoints + non-fenced `bundleRuleProjection.js`, `projectActiveRules.js`) |
| **Battle creation / lock (post-#640 shape)** — `decide.js` deploy path → `createAgentBattle` (`decide.js:688`, `:1146`); trait projection at `decide.js:167-217` (`projectActiveRules(agent.equippedTraits, ruleDocs, bundleDocs)` `:182`) | At deploy: live equipped state, re-projected `activeRules` (`decide.js:182`, frozen into `agentContext.activeRules` — `createAgentBattle` "freezes agentContext.activeRules from agentData.activeRules", per `agent-evaluate.js:187-188`); conflict report (`decide.js:192-201`); full portfolio/mode/tournament context | `agentBattles` client **create is DENIED** (`firestore.rules:345` `allow create, delete: if false`); client **update** limited to execution-control keys only (`:340-343`). All battle writes are **Admin SDK** (rules bypassed). So a compiled snapshot frozen into the battle doc is server-writable but is **fence contact** on the doc shape | **FENCED** — `createAgentBattle` doc shape (`agentBattleService.js`, cronState init `:250-259`) + `decide.js` |
| **Tick time** — `processAgentBattle` (`agent-evaluate.js:527`) | Per tick: live prices, triggers, `assetScores`, momentum, `battle.evaluations`, full portfolio+bench+hotBench, tournament held-set; the live eval prompt (`:1917-1927`); Haiku decision; 5× `executeSwapServer` sites | `agentBattles` writes are Admin SDK (rules bypassed). Per-tick write is the single `finalUpdate` (`:2646-2671`) | **FENCED** — tick prompt uses `agentEvalPromptAssembly`; swaps use `agentSwapExecution` (`executeSwapServer`, `validateTradeDecision` imported `:30`); rides the fenced CPU-eval budget architecture |

**`firestore.rules` deployment caveat (UNVERIFIED at runtime):** many blocks (bundles dimension fields region, tournament, learning, mastery) carry "manual deploy via Firebase Console required — rules don't auto-deploy from code" (e.g. `firestore.rules:435-436`, `:801-805`, `:840-842`). Whether the in-repo `firestore.rules` matches what is *deployed* cannot be verified from the repo — treat the rules substrate as the *intended* contract, not proof of the live gate.

---

### 3.3 Serverless constraints in the eval path (for a SECOND, shadow prompt path)

**Timeouts / maxDuration (VERIFIED):**
- `agent-evaluate` runs at **`maxDuration: 300`** (`agent-evaluate.js:109`), raised 60→300 as the "budget-starvation fix" so "more than one battle clears that guard per tick" — comment explicitly calls it "Mitigation, not architecture" (`:104-108`).
- Handler soft budget **`TIME_BUDGET_MS = 290_000`** (`:113`); the per-battle loop bails when `elapsed > TIME_BUDGET_MS`, deferring the remainder to the next tick (`:311-318`).
- Per-Haiku hard ceiling **`HAIKU_CALL_CEILING_MS = 22_000`** (`agentEvalTransport.js:14`); the live call passes `{ timeout: 20_000, signal: abortCtrl.signal }` with a 22s AbortController backstop (`agent-evaluate.js:1911`, `:1931`).
- **Pre-call budget guard** `shouldStartHaikuCall({ elapsedMs: Date.now()-cronStartTime, timeBudgetMs: TIME_BUDGET_MS })` (`agent-evaluate.js:1895`); it requires `callCeilingMs + postCallAllowanceMs` (22s + 12s = 34s) of remaining budget before starting a call (`agentEvalTransport.js:61-69`). A `budget_skipped` tick still runs the normal write path (`agent-evaluate.js:1896-1902`, comment `:1887-1894`).

**Batch shape / sequential structure (VERIFIED):**
- Battles are processed **strictly sequentially** in a `for` loop (`agent-evaluate.js:311`), ordered by **fair-rotation**: ascending `cronState.lastEvalStartedAt` so the longest-starved battle leads (`:296-308`); `lastEvalStartedAt` is written **only on a real Haiku attempt** (`:2633`, `haikuAttempted` gate).
- The Anthropic client is a singleton with **`maxRetries: 0`** — a deliberate deviation because "2 retries × 20s ≈ 60s per battle" would blow a battle's budget slice (`:118-131`).
- `summary.evaluated` is incremented at 8 sites across the flush paths (`:866, :1746, :1758, :1787, :1866, :2672, :3902`) — the "evaluated 8" live datapoint reflects battles that reached any flush, not necessarily Haiku calls. The counter code is here; the **Jul-22 live run value (~19.9s, evaluated 8) is UNVERIFIED** from code alone.

**Implications for a shadow prompt riding this tick:**
1. A second `messages.create` **doubles per-battle wall time** against a shared 290s budget that already can't fund all battles (the fair-rotation comment at `:296-308` states the budget "only funds a bounded number of Haiku calls"). A shadow call MUST be behind its own `shouldStartHaikuCall`-style guard, or it starves the live path.
2. With `maxRetries:0` and a 20s/22s ceiling, a shadow call should reuse the same singleton + ceiling and **run after** the live call resolves (sequential), never `Promise.all` racing the live one, so a shadow timeout can never abort the live decision.
3. The tick already runs risk swaps and score writes **before** the Haiku gate (`:1892-1894` note), so a shadow pass added post-decision inherits a fully-settled in-memory battle and can ride the existing `finalUpdate` write (`:2671`) with no new write op.
4. `agent-batch-review` (60s) and `voice-layer-cache` (60s) have **no headroom** for a second LLM path against their existing per-battle Haiku/Gemma calls; the 300s `agent-evaluate` is the only viable eval-time host.

---

### 3.4 Fence contacts (this section)

- **Compile at battle-lock → fenced `createAgentBattle` doc shape** (`agentBattleService.js`, doc build ~`:180-260`) and **`api/agent/decide.js`** (`createAgentBattle` calls `:688`/`:1146`; trait projection `:167-217`). §7-gated. (BUILD_RULES §1.)
- **Shadow-eval at tick → fenced `agentEvalPromptAssembly.js`** (`buildEvalSystemPrompt`/`buildLiveContextBlock`, `agent-evaluate.js:1917-1927`) and **`agentSwapExecution.js`** (`executeSwapServer`/`validateTradeDecision`, imported `:30`), and the **fenced agentBattles CPU-evaluation budget architecture** as a *concept* (the `TIME_BUDGET_MS`/`shouldStartHaikuCall` structure). §7-gated.
- **`tournamentUserScoring.js` discrepancy:** the census prompt flags this file as fenced, but it is **NOT in BUILD_RULES §1's list** (`docs/BUILD_RULES.md:12-21`, VERIFIED — the eight listed files do not include it). Flagging the discrepancy per instructions; my Part-3 attach points do not touch it.
- **Non-fenced (safe) attach surfaces:** `equip-bundle.js`, `equip-lean.js`, `bundleRuleProjection.js`, `projectActiveRules.js`, and the `agent-evaluate` handler's isolated-sweep slots (`:238-264`) are outside §1 and are the low-friction homes for a compiler/backfill.


---

# Part 4 — Gap table


_94 behavior-findings across the maps merge (token-similarity) to **91 distinct behaviors**, 30 of them **bold** (declared owner ≠ actual enforcement). The row-set is seeded from Map 2's enforcement census and extended with behaviors discovered in Maps 1/3/4/5/6 and Parts 1/3. Line-level citations live in the referenced map (Part-4 convention); the Map(s) column points there, and lists every map that surfaced the behavior._


| Behavior | Declared owner | Storage | Runtime consumer(s) | Enforcement | User-edit? | Arch-bnd? | Receipt | Test | Fence | Migration risk | Map(s) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **agent.personality.traits (free-text names in prompt) coexists unreconciled with equippedTraits→projectActiveRules→activeRules (mechanical rule projection)** | **split personality.traits vs equippedTraits** | **agent.personality.traits vs agent.equippedTraits + rules** | **agentPromptAssembly:63-64 (fenced) + tournamentAgentBoards:152; projectActiveRules** | **soft** | **personality via creation flow; equippedTraits via equip UI (slot off)** | **—** | **none** | **projectActiveRules.test.js for projection only** | **agentPromptAssembly fenced** | **medium — two trait channels can name/enforce different things** | **Map 4** |
| **Archetype convictionMods** | **archetype config** | **agentArchetypeConfig.js:61,92,148,179,211** | **NONE (no runtime reader)** | **unenforced** | **no** | **yes** | **—** | **—** | **FENCED (agentArchetypeConfig.js)** | **—** | **Map 2** |
| **Archetype knob values (hftConfig: forcedRotation/hurdleFloor/swapWindow) resolve live at tick from the deployed module, keyed by frozen archetype identity (agent-evaluate.js:1213 VERIFIED)** | **agentArchetypeConfig.js (FENCED)** | **deployed module ARCHETYPE_CONFIGS; NOT snapshotted into battle doc** | **agent-evaluate.js:1213,1226,1287,1335 (evaluateRisk, forced-rotation, circuit-breaker)** | **deterministic** | **no (archetype identity chosen at deploy; values are code)** | **yes** | **knobConfigVersion stamped per-swap (swapProvenance.js:39)** | **agentArchetypeConfig.test.js present** | **FENCED (BUILD_RULES §1)** | **HIGH — redeploy re-tunes in-flight battles; primary ResolvedAgentManifest freeze target** | **Map 5** |
| **Archetype regimePreferences / canEnterDistressed** | **archetype config** | **agentArchetypeConfig.js:40-44 etc** | **NONE (no runtime reader)** | **unenforced** | **no** | **yes** | **—** | **—** | **FENCED (agentArchetypeConfig.js)** | **—** | **Map 2** |
| **Archetype rule compatibility (native/neutral/core_conflict)** | **archetypeRuleCompatibility.js** | **src/data/archetypeRuleCompatibility.js (curated map, 98/143 ids)** | **equip-path warnings/blocks + render badges ONLY (INVARIANT R); never prompt/projection** | **deterministic** | **no** | **yes (6 archetypes)** | **none** | **archetypeRuleCompatibility.test.js (ship-gate + invariant)** | **must never be imported by fenced files (self-asserted)** | **medium — orthogonal to hard/soft, a third axis** | **Map 3** |
| **Archetype sectorConcentrationCap** | **archetype config** | **agentArchetypeConfig.js:66 etc** | **behaviorFingerprint.js:152 (display axis only)** | **unenforced** | **no** | **yes** | **—** | **—** | **FENCED (agentArchetypeConfig.js)** | **—** | **Map 2** |
| **ARCHETYPE_CONSTRAINTS — sector/quality MUST-strings injected into Sonnet strategy prompt** | **archetypeScoring.js** | **DATA: archetypeScoring.js:80-93; consumed agentPromptAssembly.js:22 (buildStrategySystemPrompt), decide.js:294** | **Sonnet portfolio-build prompt (decide.js)** | **prompt-constrained** | **no** | **yes — distinct per archetype** | **none deterministic (LLM instruction only)** | **—** | **DATA unfenced-file but concept 'scoring engine' fenced; consumer agentPromptAssembly.js FENCED; decide.js FENCED** | **soft enforcement: no deterministic rejection of violating shortlist at this site** | **Map 1** |
| **bundle capacity check at equip time** | **rules comment (L308-319) states rationale only** | **NOT in firestore.rules; equip-bundle endpoint (Admin SDK, not read this run)** | **equip-bundle transaction** | **unenforced (in rules) — server-side only** | **n/a** | **—** | **n/a** | **none in emulator test** | **UNVERIFIED — endpoint not read** | **compile step cannot rely on firestore.rules to bound bundle size** | **Part 1.2** |
| **bundle status closed transition vocabulary (draft->forged, draft->archived, forged->archived; never into/out of equipped)** | **firestore.rules bundles update clause** | **firestore.rules:281-321** | **forgeService.createBundle (draft), dimension materializer (forged), equip/unequip/reforge endpoints (server, equipped transitions)** | **deterministic** | **partial — only the closed vocabulary transitions** | **—** | **n/a** | **emulator bundles suite is STALE at HEAD — landed-detection string does not match; would throw at beforeAll** | **not fenced** | **test drift: proposed clause in test allows forged->draft/archived->forged that live rules deny** | **Part 1.2** |
| **convictionMods — declared per-archetype conviction levers** | **agentArchetypeConfig.js (header claims 'real mechanical effects on conviction scoring')** | **DATA: agentArchetypeConfig.js:61,92,121,148,179,211** | **NONE (repo-wide grep: definition file only)** | **unenforced** | **no** | **yes (defined per archetype)** | **none** | **—** | **FENCED file** | **dead config; header comment contradicted by zero consumers** | **Map 1** |
| **deployedStrategy.directives (dimensionsToDirectives) generated and stored but never snapshotted into the battle or read by the decision prompt; consumed only by SeasonReview UI** | **dimensionMapper.dimensionsToDirectives** | **agent.deployedStrategy.directives** | **SeasonReview.jsx only (not agentContext, not eval prompt)** | **unenforced** | **yes (dimensions)** | **—** | **none** | **dimensionFieldAccess.test.js tests generation only** | **none** | **low behaviorally, high doc-truth — comment claims Haiku reasons over them** | **Map 4** |
| **Deterministic guardrail enforcement (stopLoss/trailingStop/maxSectorWeight) operates on deployedStrategy.guardrails — a structure disjoint from equipped Forge rules** | **Phase 4B Hybrid Execution Guardrails** | **agent.deployedStrategy.guardrails → battle.agentContext.deployedGuardrails (agentBattleService.js:165)** | **applyGuardrails (agentGuardrails.js:168) at agent-evaluate.js:2019** | **deterministic** | **UNVERIFIED (deployedStrategy writer not traced this section)** | **no** | **guardrailOverrides written to eval record (agent-evaluate.js:2558); guardrailReplay in L1 receipt (captureReceipt.js:308-318)** | **UNVERIFIED** | **agentGuardrails.js NOT in §1 list; imports fenced agentRiskManager.js/agentScoring.js** | **high — users may believe an equipped Forge 'risk' rule is mechanically enforced; it is not (only deployedStrategy.guardrails is)** | **Map 3** |
| **Distressed swap-in exclusion** | **regime rule (universal) + prompt STRICT EXCLUSION** | **stockRegimes (computed)** | **agent-evaluate.js:2074 (deterministic, all agents)** | **deterministic** | **no** | **no (overrides contrarian canEnterDistressed)** | **—** | **—** | **non-fenced cron site** | **—** | **Map 2** |
| **Diversifier core sector-slot cap (35% ~ max 2/6)** | **archetype-integrity (core), gated by SECTOR_CAP_MODE** | **agentGuardrails.js:60 DIVERSIFIER_SECTOR_CAP_PCT; flag featureFlags.js:555** | **injectDiversifierSectorCap agentGuardrails.js:95 / agent-evaluate.js:2004 — INERT: flag='true' matches neither enforce nor observe** | **unenforced** | **no (user can only tighten when active; but inactive)** | **yes (Diversifier, tournament only)** | **—** | **—** | **FENCED (agentGuardrails.js §1)** | **—** | **Map 2** |
| **Diversifier core sector-slot cap min(user,35%) is coded with explicit precedence but gated off by SECTOR_CAP_MODE='true' (an out-of-vocabulary value that reads as OFF)** | **agentGuardrails.injectDiversifierSectorCap** | **featureFlags.SECTOR_CAP_MODE** | **injectDiversifierSectorCap / resolveSectorSlotObserveCap** | **deterministic** | **no (flag)** | **—** | **would_block_swap telemetry (observe) — inert today** | **agentGuardrails.test.js flips flag** | **non-fenced** | **medium — flag value looks enabled but is dark** | **Map 4** |
| **Diversifier sector-slot cap (min(userCap,35%) hard block at swap)** | **agentGuardrails.js (fires on SECTOR_CAP_MODE=enforce)** | **api/_utils/agentGuardrails.js:60,95-109; flag featureFlags.js:555** | **applyGuardrails swap-time check; cron call site injection** | **deterministic** | **user can only TIGHTEN via maxSectorWeight guardrail** | **diversifier only** | **GuardrailOverride (blocked_swap / would_block_swap)** | **agentGuardrails.test.js, agentGuardrails.bypassContract.test.js** | **not fenced (agentGuardrails.js absent from §1 list)** | **high — currently INERT: SECTOR_CAP_MODE='true' matches neither 'enforce' nor 'observe'** | **Map 1** |
| **Diversifier sector-slot cap (only identity-driven deterministic hook) is INERT at HEAD** | **Release 2 PR-e sector-SLOT rule** | **synthetic guardrail injected at agent-evaluate.js:2004 via injectDiversifierSectorCap** | **injectDiversifierSectorCap/resolveSectorSlotObserveCap (agentGuardrails.js:95-126)** | **unenforced** | **no — archetype/flag driven** | **yes — Diversifier, TOURNAMENT (flat6) only** | **would_block_swap override in eval record when observe active (currently never)** | **UNVERIFIED** | **agentGuardrails.js not §1-fenced** | **medium — SECTOR_CAP_MODE='true' matches neither 'enforce' nor 'observe', so cap never fires** | **Map 3** |
| **Diversifier tournament sector-position cap** | **agentGuardrails checkSectorCap under SECTOR_CAP_MODE** | **src/config/featureFlags.js:555 (SECTOR_CAP_MODE)** | **agentGuardrails.js:97,124; agent-evaluate.js:2001** | **unenforced** | **no (founder flag)** | **Diversifier flat6 tournament battles only** | **guardrailOverrides telemetry (only when observe/enforce active)** | **agentGuardrails.test.js (flips flag via live getter)** | **unfenced (agentGuardrails.js, featureFlags.js)** | **comment declares enforce blocks 3rd-in-sector swap, but value 'true' matches neither 'enforce' nor 'observe' so both guards early-return -- cap is inert** | **Part 1.3–1.5** |
| **Equipped Forge rule reaches the LLM as prompt text only (CONSTRAINTS/STRATEGY PREFERENCES block); no deterministic enforcement of the rule exists** | **Forge rule system** | **agent.activeRules (deploy-reprojected) → battle.agentContext.activeRules (frozen at createAgentBattle, agentBattleService.js:161)** | **agentPromptAssembly.js:89-111 (Sonnet), agentEvalPromptAssembly.js:531-567 (Haiku)** | **prompt-constrained** | **yes — via equip-bundle / Forge authoring; re-projected from live rule docs at deploy (decide.js:182)** | **no** | **NOT in L1 receipt (captureReceipt.js has no rule field); eval record stores only Haiku-self-reported citedForgeRules/overriddenForgeRules (agent-evaluate.js:2546-2547)** | **UNVERIFIED (tests not read this run)** | **FENCED hops: decide.js, agentPromptAssembly.js, agentEvalPromptAssembly.js, agentBattleService.js** | **high — rule 'obeyed' only if the model complies; no mechanical backstop** | **Map 3** |
| **Evidence hierarchy (institutional data lag override)** | **prompt C_INST + institutional block** | **prompt text; institutionalHoldings collection** | **agentEvalPromptAssembly.js:551-558,678-682 (text only)** | **prompt-constrained** | **no (triggered by institutional rules)** | **no** | **—** | **—** | **FENCED file** | **—** | **Map 2** |
| **Forge hard/soft rule injection (CONSTRAINT vs STRATEGY split)** | **ruleHardness.js + projectActiveRules; agentPromptAssembly/agentEvalPromptAssembly** | **bundle doc ruleHardness map -> projected item.hardness** | **projectActiveRules.js:56,78-86; agentPromptAssembly.js:89-90; agentEvalPromptAssembly.js:531-532** | **prompt-constrained** | **yes (authored per-rule override, gated by FORGE_HARDSOFT_AUTHORING_ENABLED=true)** | **per equipped rule set** | **none observed** | **not inspected this run** | **fenced (agentPromptAssembly.js, agentEvalPromptAssembly.js)** | **flag value=true (live/wired) contradicts doc-comment 'GATED OFF'; enforcement path verified landed** | **Part 1.3–1.5** |
| **Forge rule CONSTRAINTS (must-obey)** | **user forge rules (category risk/allocation)** | **agent rules docs -> activeRules; hardness projectActiveRules.js:56** | **injected agentEvalPromptAssembly.js:539 / agentPromptAssembly.js:93; NO deterministic obedience gate** | **prompt-constrained** | **yes** | **no** | **—** | **—** | **FENCED injection files** | **—** | **Map 2** |
| **maxPosition cap shown to user and injected into prompt as a hard rule/directive, but applyGuardrails treats it as architecturally n/a (no-op)** | **dimensionsToGuardrails (enforcement:'hard')** | **deployedStrategy.guardrails[type=maxPosition]** | **agentGuardrails.applyGuardrails → action 'skipped_incompatible'** | **unenforced** | **yes** | **—** | **skipped_incompatible override recorded** | **unknown** | **prompt consumer fenced** | **high — display/enforcement disagreement (BUILD_RULES §9)** | **Map 4** |
| **Only the Haiku-autopilot capture site is live in production; risk/guardrail/gameplan/expiry sites are behind LEARNING_L1_CAPTURE_EXPANSION_ENABLED=false and dark** | **—** | **agent-evaluate.js:2249 (live) vs 1615/2911/3110 (dark)** | **—** | **prompt-constrained** | **—** | **—** | **Guardrail/risk-manager exits produce NO receipt at HEAD; only discretionary Haiku swaps of live_agent are receipted** | **partial** | **capture sites live in agent-evaluate.js (settlement cron); receipt seq robustness requires editing fenced agentSwapExecution.js** | **—** | **Map 6** |
| **Preset risk levers (bustBuffer/vwapFailureTicks/trailStopATR/vwapDeadBandPct) resolve live at tick from preset table, keyed by frozen strategyPreset (agent-evaluate.js:649 VERIFIED)** | **agentPresetConfig.js** | **deployed module PRESET_CONFIGS; only strategyPreset KEY frozen (=balanced)** | **agent-evaluate.js:649,1277,1312 (evaluateRisk)** | **deterministic** | **launch: autopilot/balanced only** | **no** | **entryPreset stamped on swaps** | **unknown** | **non-fenced** | **HIGH — value table live, key frozen; same gap as archetype knobs** | **Map 5** |
| **Prompt templates and Haiku model id resolve live from code each tick; never snapshotted (agent-evaluate.js:1914 VERIFIED)** | **agentEvalPromptAssembly.js (FENCED) + hardcoded model constant** | **deployed module + literal string** | **agent-evaluate.js:1914 (model), agentEvalPromptAssembly.js:43,269 (templates)** | **unenforced** | **no** | **no** | **evaluationSpecVersion null (unimplemented)** | **unknown** | **prompt assembly FENCED** | **MEDIUM — no promptVersion/model pin in manifest** | **Map 5** |
| **Rule enforcement (all 143 corpus rules) — injected as prompt text, LLM is the detector** | **forgeKnowledgeBase.js templates + agentPromptAssembly** | **src/data/forgeKnowledgeBase.js:30 (static), projected to agent.activeRules** | **agentPromptAssembly.js:93-96 (CONSTRAINTS/STRATEGY PREFERENCES prompt sections)** | **prompt-constrained** | **params only (bounded)** | **decoupled (archetypeRuleCompatibility runtime-neutral)** | **none — captureReceipt version slots all null (captureReceipt.js:338-344)** | **structural only; no behavioral test** | **agentPromptAssembly.js is fenced** | **high — every rule relies on LLM adherence, no deterministic detector** | **Map 3** |
| **sectorConcentrationCap — declared per-archetype sector cap** | **agentArchetypeConfig.js** | **DATA: agentArchetypeConfig.js:66,95,122,151,182,214; consumed only behaviorFingerprint.js:152** | **behaviorFingerprint.js (display) only; NOT agentGuardrails.js** | **unenforced** | **no** | **yes** | **none** | **—** | **FENCED file** | **real sector cap is hardcoded DIVERSIFIER_SECTOR_CAP_PCT=35 (agentGuardrails.js:60), flag-gated OFF; archetype cap is fingerprint-only** | **Map 1** |
| **Tempo dial (hftConfig cadence, snapshot-frozen) and strategyPreset (risk levers + conviction + prompt tone, live-mutable) both modulate trade aggressiveness with no reconciliation and opposite mutability contracts** | **none single — tempoDialClamp vs agentPresetConfig** | **battle.agentContext.dials.tempo (frozen) vs battle.strategyPreset (live)** | **clampHftConfig; getPresetConfig→evaluateRisk/regime/prompt** | **deterministic** | **yes both (tempo pre-battle, preset mid-battle)** | **—** | **tempo provenance stamped; preset not** | **invariant1Matrix.test.js Gate-6 preset isolation** | **non-fenced levers; hftConfig base is fenced** | **high — two 'aggressiveness' controls stack, different epochs** | **Map 4** |
| **Training-pod EXPIRED terminal disposition (rolling automatic sweep)** | **tournamentOrchestrator per-tick backstop** | **tournamentGroups doc: status + {expiredAt,expiredReason,expiredBy}** | **expireStaleTrainingPods -> expireGroup; active-pod selectors exclude EXPIRED** | **deterministic** | **no** | **training pods only (isTraining && !isLiveDraft)** | **none** | **tournamentGroupService.test.js, trainingLifecycle.test.js (R3 suite)** | **unfenced** | **declared owner is the orchestrator sweep but it is dark (POD_EXPIRY_SWEEP_ENABLED=false); only the manual admin endpoint can write EXPIRED at HEAD** | **Part 1.3–1.5** |
| activeBattleId pointer lifecycle: 4 setters (fenced decide.js), 2 pointer-guarded clearers (completeBattle) | decide.js (setters, FENCED) + completeBattle (clearers, non-fenced) | agents/{id}.activeBattleId | equip-bundle/equip-lean/change-archetype/set-tempo-dial battle-lock guards; UI benchLocked/hasActiveBattle flags | deterministic | no | — | — | equip-*.test.js, change-archetype.test.js seed activeBattleId:'battle-9' lock cases | setters FENCED (decide.js), clearers non-fenced | medium — pointerCurrent guard is load-bearing against fenced GC re-point race | Part 1.1 |
| agentBattles create/delete denied; update limited to 10 execution-control fields | firestore.rules + cron settlement (Admin SDK) | firestore.rules:335-346 | agent-evaluate cron settlement, client execution-control UI | deterministic | partial (executionMode, pendingProposal, battleLedger, updatedAt, strategyPreset, gameplanMeeting, gameplanMeetingHistory, dailyGrades, feedBookmarks, reviewDecisions) | — | n/a | none in emulator test | agentBattles createAgentBattle doc shape is a FENCED concept (BUILD_RULES §1) — reading only | low | Part 1.2 |
| agents/{id} delete denied | firestore.rules | firestore.rules:234 | zero delete paths found (per rule comment writer census) | deterministic | no | — | n/a | not covered by emulator test | not fenced | real deletion feature must be a server endpoint that settles subcollections | Part 1.2 |
| agents/{id} doc CREATE field allowlist (sensitive/progression/cognition fields born at server defaults or absent) | firestore.rules create clause + createAgent seed (src/services/agentService.js:120-128) | firestore.rules:169-218 | createAgent (agentService.js) live client path | deterministic | partial — ownerId + non-sensitive fields only; stats/activeRules/equippedBundleIds/memory/consolidatedInsight/evolutionCycle pinned to defaults | — | n/a | NOT covered by emulator test (only UPDATE allowlist is test-locked) | not fenced (firestore.rules editable, but agentBattles/scoring concepts it references are fenced) | lockstep with createAgent stats seed — change either without the other breaks prod agent creation | Part 1.2 |
| agents/{id} UPDATE limited to 4 cosmetic keys; stats/leans/dials/config/archetype/activeRules server-only going forward | firestore.rules update clause | firestore.rules:219-222 | updateAgent client writer (agentService.js) blocks guarded fields with its own SETTINGS_GUARDED_FIELDS list too | deterministic | only directives, lastViewedEvolutionCycle, starterKitCompleted, updatedAt | — | n/a | emulator test agents suite (firestore.rules.emulator.test.js:158-247) — verifies live clause | not fenced | low | Part 1.2 |
| ARCHETYPE_CONSTRAINTS sector shortlist rules (top-3 / bottom-3 / span-7 etc.) | archetypeScoring.js | api/_utils/archetypeScoring.js:80-93 | agentPromptAssembly.js:22-23 (Sonnet system prompt injection) | prompt-constrained | no | yes, 6 keys | none (soft prompt guidance) | indirect via agentPromptAssembly tests | concept-fence: scoring engine — flag | medium — a 7th archetype needs a constraint string here (concept-fenced file) | Map 1 |
| ARCHETYPE_WEIGHTS — per-archetype ranking dimension weights (sum 1.0) | archetypeScoring.js | DATA: archetypeScoring.js:14-63; CODE: computeArchetypeRankings archetypeScoring.js:107-141; consumed decide.js:243 | decide.js computeArchetypeRankings -> ARCH column sort signal for Sonnet | deterministic | no | yes | archetypeScore field on ranked stock | — | file NOT in §1 list; 'scoring engine' is fenced CONCEPT; decide.js consumer FENCED | census anchor wrongly cites leagueTournament.js as home; only comment there | Map 1 |
| Battle settlement: status flip + agent W/L stats + activeBattleId clear folded into one guarded Firestore transaction (PR #640 / ruling B3) | completeBattle (agent-evaluate.js cron body, non-fenced) | agentBattles/{id} status/pendingReflection/cronState.evaluatingAt + agents/{id} stats/activeBattleId | expiry loop @agent-evaluate.js:204; repairBareGcCompletions @3927; GC-repair sweep §2c | deterministic | no | — | none at settlement (per-swap captureSwapReceipt only, during ticks) | agent-evaluate.masteryCompletion.test.js; p4Flips.test.js:220 asserts literal activeBattleId:null write | non-fenced (agent-evaluate.js not in BUILD_RULES §1) | low — repair branch + isBareGcCompletion discriminator handle legacy bare GC docs | Part 1.1 |
| Born-with traits + strength→paramValues profiles (16 traits, 3 default per archetype) | traitLibrary.js | src/data/traitLibrary.js:494-527 (library + ARCHETYPE_DEFAULT_TRAITS); strength profiles per trait :27-43 etc. | archetypeSeeding.js, change-archetype.js, projectActiveRules.js/bundleRuleProjection.js (rule param injection), forgeKnowledgeBase.js validation | deterministic | yes — traits equip/unequip; strength selectable subtle/moderate/dominant | yes, 6 keys | via projected rules in decision path (indirect) | traitLibrary.bornWith.test.js, seedDefaultTraits.test.js, traitEquip.test.js | not fenced | low-medium — #7 needs a 3-trait default set; may require minting new archetype-native traits (WS1 core_conflict precedent) | Map 1 |
| Circuit breaker (Knob C) — rolling-window swap cap | agentArchetypeConfig.js hftConfig | DATA: agentArchetypeConfig.js hftConfig.swapWindow (capPerWindow/windowMinutes); CODE: agentRiskManager.js:475-499 getRecentSwapCount | agent-evaluate.js:1337-1342 (forced) and :2128-2141 (haiku) | deterministic | no | yes — cap 2/120min (guardian) to 12/60min (degen) | log 'Knob C cap hit'; validationErrors 'Swap cap reached' | — | FENCED | Trap 1: reads top-level t.exitReason; emergencies excluded unless countEmergencies | Map 1, Map 2 |
| Coach directive content gate (Zone-1 refusal, chat) | archetype allowlist (archetypeAdjustments.js) | battle.directive | directiveGate.js:70-95; render controlPromptRenderer.js:213 | deterministic | yes via chat, but constrained to allowlist | yes | — | — | non-fenced (directiveGate, controlPromptRenderer) | — | Map 2 |
| Coach directive obedience (does model follow it) | prompt + Survival Mode | battle.directive text | agentEvalPromptAssembly.js:952-966 (injection); no obedience gate | prompt-constrained | yes | yes | — | — | FENCED file | — | Map 2 |
| Compiled-artifact bundle fields (dimensionValues/compileConfidence/compileTransparency/dimensionHash/dimensionSchemaVersion) writable by client, incl. on equipped bundles | firestore.rules bundles block | agents/{id}/bundles/{id} | firestore.rules:276,280,320-321 | deterministic | yes (client create+update; frozen fields exclude these) | — | none | rules test (referenced in-file) | non-fenced | low — a Phase-2 compiler can persist here without a rules change | Part 3 |
| CONFLICT_RECONCILER_INJECT replaces projected activeRules with resolvedRules (drops losers) before battle freeze | Rule Conflict Reconciler (Phase 2) | decide.js:201 (in-memory) → frozen at agentBattleService.js:161; report → agent.lastConflictReport (decide.js:209-211,529) | resolveForDeploy (ruleConflictReconciler.js:482-502) at decide.js:192 | deterministic | no — automatic; gated by CONFLICT_RECONCILER_INJECT_ENABLED=true (featureFlags.js:427) | no | lastConflictReport persisted on agent doc; not in L1 receipt | UNVERIFIED (ruleConflictReconciler.test.js referenced, not read) | call-site FENCED (decide.js); logic non-fenced (ruleConflictReconciler.js) | medium — fail-open falls back to raw projected on reconciler error (decide.js:196-200) | Map 3 |
| Conviction floor (SWAP conviction>=70) | validation + prompt Framework #8 | code constant | agentSwapExecution.js:77; agent-evaluate.js:2084 | deterministic | no | no | — | — | FENCED (agentSwapExecution.js §1) | — | Map 2 |
| Cooldown / self-swap / duplicate-slot anti-thrash | swap validation + revolving-door bench | bench asset cooldownUntil | agentSwapExecution.js:59-64,172-178 | deterministic | no | no | — | — | FENCED (agentSwapExecution.js) | — | Map 2 |
| Draft archetype sector/fundamental constraints | ARCHETYPE_CONSTRAINTS (archetypeScoring.js) | archetypeScoring.js:80 | Sonnet strategy prompt agentPromptAssembly.js:22; tournamentAgentBoards.js:121 (draft only) | prompt-constrained | no | yes | — | — | non-fenced data + FENCED assembly | — | Map 2 |
| Equip-time battle-lock: cannot equip bundle/lean while agent has activeBattleId | equip endpoints | agents/{id}.activeBattleId | equip-bundle.js:115, equip-lean.js:125 | deterministic | no (server tx checks it) | — | none | endpoint test files (dependency-surface guard) | non-fenced | low | Part 3 |
| Equipped rules (activeRules) double-frozen: equip-time ruleSnapshots -> deploy-time projection -> lock-time agentContext.activeRules (agentBattleService.js:162 VERIFIED) | createAgentBattle (FENCED) + bundleRuleProjection.js | battle.agentContext.activeRules (frozen) | agentEvalPromptAssembly.js:526,969 (identity + live-context blocks) | prompt-constrained | yes at equip/deploy; immutable once locked | no | n/a | equip-bundle tests present | doc shape FENCED | LOW — already manifest-like | Map 5 |
| equipped-bundle rule CONTENT (ruleIds, ruleSnapshots, ruleHardness, name) immutable to clients | firestore.rules | firestore.rules:320-321 | gatherBundleSnapshots reprojection reads these into activeRules (per rule comment; UNVERIFIED not read this run) | deterministic | no (when status==equipped) | — | n/a | emulator bundles suite (stale) | not fenced | low | Part 1.2 |
| Final-receipt-write hook attach point (future) | completeBattle post-commit block @agent-evaluate.js:3871-3899, or in-tx after :3794 | proposed learningReceipts/{battleId}/receipts/{receiptId} (create-only) or agentBattles/{id} | none yet; would mirror captureSwapReceipt create-only pattern | deterministic | no | — | existing captureSwapReceipt is per-swap during ticks, NOT at settlement | unverified (does not yet exist) | non-fenced attach in completeBattle; but scoring-engine/doc-shape source concepts are fenced | low if separate subcollection; medium if folded into fenced doc | Part 1.1 |
| Forced rotation (Knob A) — archetype stagnation-driven SWAP_OUT | agentArchetypeConfig.js hftConfig (archetype-locked) | DATA: agentArchetypeConfig.js:45-218 hftConfig.forcedRotation; CODE: agentRiskManager.js:154-166 + updateStagnationCounter:205-231; consumed agent-evaluate.js:1287,1335 | agentRiskManager.evaluateRiskAction; cron agent-evaluate.js:1287-1342 (detection-only; cron selects/vetoes replacement) | deterministic | no (archetype-locked knob) | yes — all six differ; guardian disabled | reason:'stagnation', source:'archetype' on trade | agentArchetypeConfig.test.js present (not read this run) | FENCED (config + risk manager both in §1 list) | values are DATA but §7-gated; guardian enabled:false with inert kept fields | Map 1, Map 2 |
| Forge rule STRATEGY PREFERENCES (soft) | user forge rules (other categories) | activeRules | injected agentEvalPromptAssembly.js:545 / agentPromptAssembly.js:96 | soft | yes | no | — | — | FENCED injection files | — | Map 2 |
| Forge rules observability: statusFeed.citedRules is LLM self-report for Haiku path, not deterministic proof of rule consideration/application | — | battle-doc statusFeed.citedRules; agentEvalToolSchema.js:87 | — | soft | no | — | Rules CONSIDERED no (no receipt field); APPLIED partial (citedRules self-reported, agent-evaluate.js:2472); BLOCKED no | — | — | — | Map 6 |
| Freeze-manifest-at-battle-lock hook attach point (future) | createAgentBattle @agentBattleService.js:156-184, doc write @262 | agentBattles/{id}.agentContext (frozen config snapshot block) | battle eval reads frozen deployedGuardrails/equippedWatchlist/customization snapshot | deterministic | no | — | n/a | unverified for a manifest (does not yet exist) | FENCED — createAgentBattle + createAgentBattle doc shape (§7-gated, founder sign-off) | high — adds field to fenced doc shape | Part 1.1 |
| Guardrail application is provable (exitReason enum + source), but guardrail BLOCK and incomplete guardrailReplay (no highWaterMark/trailActivation) limit proof | — | learningEnums.js:18-39; captureReceipt.js:308-318; statusFeed agent-evaluate.js:1347/1430/1465/1587 | — | deterministic | — | — | APPLIED yes (exitReason guardrail_* + statusFeed citedRules all-path); CONSIDERED partial (guardrailReplay missing trail state); BLOCKED partial (statusFeed display only, never receipted) | — | — | — | Map 6 |
| Hard vs soft rule classification (category-derived + bundle override) | ruleHardness.js | category-derived (HARD_CATEGORIES={risk,allocation}) + optional bundle.ruleHardness override | projectActiveRules.js:56, agentPromptAssembly.js:89, agentEvalPromptAssembly, agentNewsContext | deterministic | yes via bundle.ruleHardness when FORGE_HARDSOFT_AUTHORING_ENABLED | no | hardness carried on item, not in receipt provenance | hardSoftOverride.parity.test.js, ruleCompatInvariantR.test.js | consumers include fenced agentPromptAssembly/agentEvalPromptAssembly | medium — two-value enum, category-coupled; determines prompt section but effect is soft (LLM obeys) | Map 3 |
| Hurdle floor (Knob B) — deterministic ATR-margin quality gate on non-emergency swaps | agentArchetypeConfig.js hftConfig | DATA: agentArchetypeConfig.js hftConfig.hurdleFloor (byReason/default atrMultiplier); CODE: agentRiskManager.js:308-344 clearsHurdleFloor | agent-evaluate.js:2112 (haiku) and via replacement selector :1384 | deterministic | no | yes — floors 0.2 (degen) to 0.5 (guardian) | blockReason ('below_floor','bench_not_positive','margin_invalid') | — | FENCED | LANDMINE-1 unit conversion userATR/100 at :331; Shape-B per-reason lookup | Map 1 |
| L1 learningReceipts is the only durable decision record; captures physics/predicate inputs but no rules/traits/leans/constraints fields | — | learningReceipts/{battleId}/receipts/{receiptId} (Admin-SDK only, firestore.rules:825 read:false) | none at runtime; offline scripts only (measure-l1-corpus.js, preflight-capture-check.js) | deterministic | no (server-authoritative) | — | Physics CONSIDERED+APPLIED proven (predicateInputs, entryAtrSource); rules/traits/leans/constraints have no receipt field | captureReceipt.test.js, preflightReceiptCheck via validateCaptureSample | — | schemaVersion=3; 7 of 8 version stamps null (concepts do not exist yet) | Map 6 |
| Leans and Traits have zero per-decision observability in any durable record | — | none per-decision; lean equip/unequip only to fire-and-forget signal_drops shadow stream | — | unenforced | — | — | CONSIDERED/APPLIED/BLOCKED all no; leanRenderConfigVersion null (captureReceipt.js:341); TRAIT_SLOT_ENABLED=false | — | — | — | Map 6 |
| learning collections (dossiers read-only-owner; evidence/receipts/calibration no-read-no-write) server-write-only | firestore.rules learning block | firestore.rules:810-834 | L1 capture (behind LEARNING_L1_CAPTURE_ENABLED); inert until manual deploy | deterministic | no (dossier readable by owner only) | — | receipts collection is server-authoritative, never client-readable | none | not fenced | manual Console deploy required; whether live is a founder-verification fact | Part 1.2 |
| Learning receipt versions{} block: 7 of 8 stamps hardcoded null (versioned reads claimed, not implemented) (learningSchemas.js:202-214 VERIFIED) | learningSchemas.js makeReceiptSkeleton | learningReceipts/{battleId}/receipts/{receiptId} | captureReceipt.js:334-337 | unenforced | no | no | self | learningSchemas.test.js asserts schemaVersion=3 | non-fenced | LOW (dark) but blocks future version-aware corpus reads | Map 5 |
| Legacy agent.directives[]/agentContext.directives write-dead but still read into debate.js and agent-batch-review.js cognition prompts | legacyDirectiveSanitize (neutralize-in-place) | agent.directives / battle.agentContext.directives | debate.js:120; agent-batch-review.js:151 | soft | no (write side-doors neutralized) | — | none | unknown | none | low — sanitized on read but not removed | Map 4 |
| LOCK (threshold-proximity no-swap) | risk manager | computed per tick (lockedPositions set) | agentRiskManager.js:122; agent-evaluate.js:2066; agentGuardrails.js:369 | deterministic | no | no | — | — | FENCED (agentRiskManager.js) | — | Map 2 |
| mastery collections (profiles owner-read; config/quarantine/audits no-read) server-write-only | firestore.rules mastery block | firestore.rules:848-877 | award transaction (Admin SDK); inert until manual deploy | deterministic | no | — | n/a | none | not fenced | manual deploy; masteryCorrections not yet shipped (caught by default-deny) | Part 1.2 |
| maxPosition guardrail | deployedStrategy.guardrails.maxPosition | deployedGuardrails | agentGuardrails.js:328 -> skipped_incompatible (n/a for fixed slots) | unenforced | yes (but inert) | no | — | — | FENCED (agentGuardrails.js) | — | Map 2 |
| No round-trip (A->B then B->A) | prompt ANTI-THRASH | prompt text | agentEvalPromptAssembly.js:202-204 (text only); cooldown is the code backstop | prompt-constrained | no | no | — | — | FENCED file (prompt assembly) | — | Map 2 |
| One Strategy-Dimension knob fans out to a soft bundle rule, a soft natural-language directive, and a hard deterministic guardrail; the guardrail wins post-Haiku | Strategy Dimensions / dimensionMapper | agents/{id}/bundles rules + agent.deployedStrategy.{directives,guardrails} → battle.agentContext.deployedGuardrails | agentGuardrails.applyGuardrails (hard); agentEvalPromptAssembly activeRules (soft) | deterministic | yes (dimension sliders / collection presets) | — | guardrail overrides logged in eval record | agentGuardrails.test.js present | consumers agentEvalPromptAssembly/agentPromptAssembly are fenced | medium — three artifacts from one source can diverge on edit | Map 4 |
| Per-archetype sector prefer/lean_away typed emphasis matrix | archetypeAdjustments.js PASS_THROUGH_SECTORS (deferred seam) | src/data/archetypeAdjustments.js:202 (frozen empty array) | none — gate never consults a sector enum (archetypeAdjustments.js:196-197) | unenforced | no | would be per-archetype | none | n/a (unbuilt) | not fenced | low — designed-not-built; adding it is a pure data path when authored | Map 1 |
| Per-tick Haiku call gated by remaining cron budget (34s required) | agentEvalTransport.shouldStartHaikuCall | in-memory (elapsedMs vs TIME_BUDGET_MS) | agent-evaluate.js:1895 | deterministic | no | — | cronState.consecutiveEvalFailures / budget_skipped failureClass | agentEvalTransport tests | concept-fenced (CPU-eval budget architecture) | high (a shadow prompt doubles cost against this budget) | Part 3 |
| profitTarget guardrail | deployedStrategy.guardrails.profitTarget | deployedGuardrails | agentGuardrails.js:342 (note only) | soft | yes | no | — | — | FENCED (agentGuardrails.js) | — | Map 2 |
| Rule hardness (hard→CONSTRAINT / soft→STRATEGY PREFERENCE) resolved once at deploy and carried on the item | ruleHardness.js (single server source) | item.hardness baked by projectActiveRules.js:56 (override bundle.ruleHardness else classifyByCategory) | ruleHardness.isHardRule → both prompt builders | prompt-constrained | yes — per-rule override in bundle.ruleHardness (projectActiveRules.js:85-88) | no | none | UNVERIFIED | resolution in non-fenced projectActiveRules.js/ruleHardness.js; consumed in fenced assemblies | low | Map 3 |
| Rule library / detector provenance in decision receipts | captureReceipt.js | captureReceipt.js:338-344 provenance block | none — all version slots hardcoded null | unenforced | no | no | placeholder only (ruleLibraryVersion:null, detectorVersion:null) | none for provenance stamping | not fenced | high — receipts cannot attribute a decision to a corpus version | Map 3 |
| Rule-compat hard block (Zone-1 refusal, equip) | RULE_COMPAT_MODE + archetypeRuleCompatibility | featureFlags.js:582='enforce'; classification src/data/archetypeRuleCompatibility.js | src/services/ruleCompatGuard.js:60; forgeService.js; server endpoints observe-log | deterministic | n/a (blocks user edits) | yes | — | — | non-fenced | — | Map 2 |
| ruleHardness never client-writable on bundles (server-mintable only) | firestore.rules bundles allowlist | firestore.rules:276,280 (excluded from 20-key hasOnly) | set-rule-hardness / reforge-bundle endpoints (server) | deterministic | no | — | n/a | emulator bundles suite asserts ruleHardness deny (but suite is stale/throws) | not fenced | low | Part 1.2 |
| Season param-edit bounds validation (deterministic use of param schema) | seasonValidation.js | forgeTemplates[].params (min/max/step) in forgeKnowledgeBase | seasonValidation.js:145-152, season/create-entry.js:124 | deterministic | yes (param values, bounded) | no | n/a | present (season validation tests) | not fenced | low | Map 3 |
| sectorDiversity ranking weight (portfolio differentiation) | archetypeScoring.js | api/_utils/archetypeScoring.js:12,110-127; weights :14-63 | computeArchetypeRankings → arch_scores (compute-index-intelligence.js:1058-1066), scouting-board.js:113 | deterministic | no | yes, 6 keys | none (ranking only, not a decision receipt) | compute-index-intelligence.test.js (arch_scores byte-identical) | concept-fence: scoring engine — flag | medium — 7th weight profile must sum to 1.0 | Map 1 |
| Shadow-logger decision streams are fire-and-forget GCS appends, non-durable (BUILD_RULES §5 cautionary tale); logDecision in decide.js uses .catch(()=>{}) | — | shadow/{stream}/{date}/{eventId}.jsonl in GCS bucket fantasytrades | — | soft | — | — | decisions/evaluations/signal_drops/vision_* streams cannot be relied on as decision proof; only rule_compat catalog stream checks the persistence boolean | n/a | — | — | Map 6 |
| Standing leans (execution tuning) | user leans; STANDING_LEANS_ENABLED | battle.agentContext.standingLeans; agent.standingLeans | render controlPromptRenderer.js:231; gate leanRevalidation.js; inject agentEvalPromptAssembly.js:965 / agentPromptAssembly.js:161 | prompt-constrained | yes (equip/unequip-lean) | yes (menu membership per archetype) | — | — | non-fenced renderer; FENCED injection files | — | Map 2 |
| Standing leans allowlist + conflict groups (46 leans across 6 archetypes) | archetypeAdjustments.js (single source of truth for gate + voice) | src/data/archetypeAdjustments.js:48-190 (allowlist), :283-351 (conflict groups) | directiveGate, controlPromptRenderer, leanOverrides.js, voiceLayerPrompt.js:2520-2526 | deterministic | yes — user equips leans via equip-lean; gate validates against allowlist | yes, 6 keys / prefix per archetype | leanOverrides[] records (leanOverrides.js:56-68) | archetypeAdjustments.test.js, leanOverrides.test.js, directiveGate.test.js, release2ControlsMatrix.test.js | not fenced | low — pure data add per archetype; accessors auto-derive (ARCHETYPE_KEYS) | Map 1 |
| Standing leans frozen at lock with revalidated resolved-current text + invalidation record (agentBattleService.js:183; leanRevalidation.js:266-318 VERIFIED) | leanRevalidation.js (kernel) via FENCED createAgentBattle | battle.agentContext.standingLeans (frozen) | agentEvalPromptAssembly.js:959 | prompt-constrained | yes via equip-lean; immutable once locked | yes (revalidated against archetype menu) | leanRenderConfigVersion is null (unimplemented) | leanRevalidation / equip-lean behavior tests | builder non-fenced; snapshot site FENCED | LOW — already frozen | Map 5 |
| Standing leans injected as prompt text under STANDING_LEANS_ENABLED; ids-at-rest, text resolved at render from pinned version | Fenced Customization Bundle V1.1 | agent.standingLeans=[{adjustmentId,version,equippedAt}] (equip-lean.js:208); frozen snapshot in agentContext.standingLeans | controlPromptRenderer.renderLeansBlock via both assemblies (agentPromptAssembly.js:152-163, agentEvalPromptAssembly.js:953-965) | prompt-constrained | yes — equip-lean.js (flag=true, featureFlags.js:449) | no | none | UNVERIFIED | renderer non-fenced; consumed in fenced assemblies | low-medium — suppression/no-resurrection logic in resolveControls | Map 3 |
| standingLeans / dials / tempoDial / equippedTraits mutation is Admin-SDK-only (no rules write site; excluded from agent update allowlist) | firestore.rules + transactional server endpoints | firestore.rules:171-173 (create absent-list) + 221-222 (update omission) | equip-lean, set-tempo-dial, equip-bundle (settingsRev-bumping endpoints) | deterministic | no | — | n/a | emulator agents suite denies standingLeans/dials on update | not fenced (rules); referenced endpoints equip-lean/set-tempo-dial not fenced | low | Part 1.2 |
| Swap hurdle floor (Knob B) | archetype hftConfig.hurdleFloor | agentArchetypeConfig.js | agentRiskManager.js:308 clearsHurdleFloor; agent-evaluate.js:1384,2112 | deterministic | no (tempo scales) | yes | — | — | FENCED (agentRiskManager.js) | — | Map 2 |
| Tempo dial → hftConfig knob clamp | tempo dial (user control, agentContext.dials.tempo) | battle.agentContext.dials.tempo; bands tempoDialBands.js | agent-evaluate.js:1225 clampHftConfig → tempoDialClamp.js:140 | deterministic | yes (set-tempo-dial.js) | no (applies to any archetype's knobs) | — | — | non-fenced clamp; mutates fenced knob shape (agentArchetypeConfig) | — | Map 2 |
| Tier multipliers / position weight | scoring engine | CONVICTION_MULTIPLIERS (baggerBombScoring.js); per-asset tierMultiplier flat6 | agentScoring.js:267-270 | deterministic | no | no | — | — | FENCED concept (scoring engine) | — | Map 2 |
| tradeFrequency label | archetype config | agentArchetypeConfig.js:67 etc | NONE; actual cadence via Knob A/C + prompt DEFAULT-HOLD | unenforced | no | yes | — | — | FENCED (agentArchetypeConfig.js) | — | Map 2 |
| User maxSectorWeight cap (hard guardrail) | deployedStrategy.guardrails.maxSectorWeight | battle.agentContext.deployedGuardrails | agentGuardrails.js:273 checkSectorCap:592; agent-evaluate.js:2019 | deterministic | yes | no | — | — | FENCED (agentGuardrails.js) | — | Map 2 |
| User stop-loss floor (hard guardrail) | deployedStrategy.guardrails.stopLoss (user) | battle.agentContext.deployedGuardrails | agentGuardrails.js:209 applyGuardrails; agent-evaluate.js:2019 | deterministic | yes (deploy/update-agent-settings) | no | — | — | FENCED (agentGuardrails.js is §1) | — | Map 2 |
| Voice Layer / Film Room explain decisions from a parallel source (closedTrade/battle doc), never reading the L1 receipt | — | voiceLayerTradeNarration.js reads closedTrade+battle; FilmRoom reads statusFeed/chatExchanges/trades | chatExchanges/statusFeed on battle doc | soft | — | — | Display-agreement partial: statusFeed.citedRules is engine-written for guardrail paths (good), but Gemma narration is an LLM reinterpretation not a receipt projection | — | — | — | Map 6 |
| Watchlist hotBench/monitoring universe rebuilt live from stockRankings each refresh; only equipped tickers frozen (agent-evaluate.js:940-976 VERIFIED) | agent-evaluate.js daily refresh | battle.watchlist (mutable) vs agentContext.equippedWatchlist (frozen) | agent-evaluate.js:940-976 | soft | watchlist edits ignored mid-battle for equipped tickers only | no | n/a | unknown | non-fenced | MEDIUM — universe is live input | Map 5 |


---

## Contradictions register

_Every plan-said-vs-code-did finding, with both citations. Duplicate cross-map findings are collapsed and corroboration noted._


1. **SECTOR_CAP_MODE value 'true' (string) does NOT engage enforce and disables BOTH branches: agentGuardrails reads it tri-state as 'enforce'/'observe'; 'true' matches neither, so injectDiversifierSectorCap returns base unchanged (L97) and the observe path returns null (L124). The doc-comment describes 'off'|'observe'|'enforce' with default 'off'. The live diversifier sector-slot cap is therefore INERT at HEAD despite the census-noted assumption that 'true' engages enforce.**  
   · _Plan / comment / expected:_ featureFlags.js:548-554 doc-comment (tri-state 'off'->'observe'->'enforce', default 'off')  
   · _Code at HEAD:_ src/config/featureFlags.js:555 (SECTOR_CAP_MODE='true') + api/_utils/agentGuardrails.js:97,124 VERIFIED  _(corroborated independently by 8 agents: B3-expired-budget-deploy, M1a-ownership-physics, M1b-ownership-leans-traits-voice, M2-enforcement, M3b-rule-runtime-trace, M4-collision, M5-freeze-version)_
2. **FORGE_HARDSOFT_AUTHORING_ENABLED value is `true` (flag ON), but its own doc-comment says the flag is 'GATED OFF until the FENCED prompt-assembly half lands AND a founder sign-off'. The fenced prompt-assembly half HAS landed (hardness is projected and honored in both prompt builders), so the comment is stale; the CODE (value=true + wired enforcement) supersedes it.**  
   · _Plan / comment / expected:_ src/config/featureFlags.js:43-49 (doc-comment: 'GATED OFF until the FENCED prompt-assembly half lands ... AND a founder sign-off')  
   · _Code at HEAD:_ src/config/featureFlags.js:51 (=true); enforcement wired at projectActiveRules.js:56,78-86 + agentPromptAssembly.js:89-90 + agentEvalPromptAssembly.js:531-532 + ruleHardness.js:32-41  _(corroborated independently by 3 agents: B3-expired-budget-deploy, M2-enforcement, M3a-rule-corpus)_
3. **agentArchetypeConfig.js header claims each archetype has 'real mechanical effects on ... conviction scoring', but convictionMods has ZERO runtime consumers repo-wide (git grep finds only its own definitions).**  
   · _Plan / comment / expected:_ api/_utils/agentArchetypeConfig.js:2-4 (header: 'real mechanical effects on the regime router, risk manager, conviction scoring, and trade frequency')  
   · _Code at HEAD:_ api/_utils/agentArchetypeConfig.js:61,92,121,148,179,211 (convictionMods defined, never read elsewhere)  _(corroborated independently by 2 agents: M1a-ownership-physics, M2-enforcement)_
4. **'capacity at equip time' is described by the PR rewrite items but is NOT enforced in firestore.rules — the rules only freeze equipped-bundle content; the capacity check lives in the (unread) equip-bundle server endpoint.**  
   · _Plan / comment / expected:_ PR rewrite item 'capacity at equip time' as listed in the census assignment  
   · _Code at HEAD:_ firestore.rules:308-319 comment states the rationale (freeze exists so a bundle can't be inflated after passing the equip-time capacity check) but no capacity predicate appears in the rule body
5. **Census assignment anchor states ARCHETYPE_WEIGHTS lives in src/constants/leagueTournament.js. At HEAD it does NOT: leagueTournament.js:365 only has a comment referencing it; CPU_ARCHETYPE_ORDER is defined at :367. The sole live ARCHETYPE_WEIGHTS definition is archetypeScoring.js:14.**  
   · _Plan / comment / expected:_ src/constants/leagueTournament.js:365 (comment 'Values mirror api/_utils/archetypeScoring.js ARCHETYPE_WEIGHTS keys')  
   · _Code at HEAD:_ api/_utils/archetypeScoring.js:14 (export const ARCHETYPE_WEIGHTS)
6. **Census prompt and design docs name 'swapDecisionReceipt (BEM)' as the decision receipt, but no such symbol exists in code and no BEM computation exists; the built artifact is the outcome-blind learningReceipts predicate receipt with a different shape and purpose.**  
   · _Plan / comment / expected:_ ENFORCEMENT_WIRING_FINDINGS.md:195 ('BEM Phase 6 appears nowhere in .js'); FORGE_ENFORCEMENT_KEYSTONE_SPEC_V1_4.md:84 (BEM scope)  
   · _Code at HEAD:_ git grep swapDecisionReceipt / BEM = ZERO code hits; captureReceipt.js:5-12 (outcome-blind, no estimator); learningSchemas.js:97
7. **Census prompt states 'tick-time touches fenced decide.js'. Code: the per-tick eval (processAgentBattle) lives in the NON-fenced cron file agent-evaluate.js and invokes fenced agentEvalPromptAssembly (buildEvalSystemPrompt/buildLiveContextBlock) + fenced agentSwapExecution (executeSwapServer); decide.js is the battle-CREATION/deploy path (createAgentBattle) and the expiry-GC path, NOT invoked per tick. The tick-time fence contact is via agentEvalPromptAssembly.js + agentSwapExecution.js, not decide.js.**  
   · _Plan / comment / expected:_ Phase-0 census prompt, Part-3 'tick-time touches fenced decide.js'  
   · _Code at HEAD:_ api/cron/agent-evaluate.js:1913-1931 (tick messages.create), :30 (executeSwapServer import); api/agent/decide.js:688,1146 (createAgentBattle at deploy)
8. **Census/BUILD_RULES §6 cites '37/40' cron slots as an assumption; the live vercel.json count confirms exactly 37 entries (not an estimate).**  
   · _Plan / comment / expected:_ docs/BUILD_RULES.md:56  
   · _Code at HEAD:_ vercel.json:20-168 (37 cron objects, VERIFIED by count)
9. **Contrarian may enter distressed stocks (canEnterDistressed:true)**  
   · _Plan / comment / expected:_ api/_utils/agentArchetypeConfig.js:133 canEnterDistressed:true (contrarian)  
   · _Code at HEAD:_ api/cron/agent-evaluate.js:2074 blocks SWAP-in of any distressed symbol for ALL agents; canEnterDistressed has zero runtime readers (git grep clean outside agentArchetypeConfig.js)
10. **Forge rule CONSTRAINTS are HARD rules the agent MUST obey**  
   · _Plan / comment / expected:_ agentEvalPromptAssembly.js:195 'CONSTRAINTS (C1..) are HARD rules — you must obey them'  
   · _Code at HEAD:_ agentEvalPromptAssembly.js:531-567 injects them as prompt text; no deterministic gate consults activeRules to block a trade — only the separate deployedGuardrails object is code-enforced (agentGuardrails.js)
11. **Receipt versions block documents 8 version stamps as if they will be read, but 7 are hardcoded null with an in-code admission they 'do not exist in the codebase yet' — a versioned-read surface claimed by the schema but not implemented.**  
   · _Plan / comment / expected:_ learningSchemas.js:202-204 comment  
   · _Code at HEAD:_ api/_utils/learning/learningSchemas.js:202-214 VERIFIED
12. **The bundles emulator suite's landed-detection string does not exist in firestore.rules at HEAD, so buildProposedBundlesRules() would throw (found 0 bundles blocks to patch) and the suite errors when actually run against an emulator.**  
   · _Plan / comment / expected:_ firestore.rules.emulator.test.js:269-320 CURRENT_BUNDLES_BLOCK_RE expects a bare shared 'allow create, update' bundles clause that HEAD replaced with split create (L274-277) + update (L278-321) closed vocabulary  
   · _Code at HEAD:_ firestore.rules.emulator.test.js:299 checks includes("request.resource.data.status != 'equipped'"); firestore.rules:320 has only resource.data.status != 'equipped' (no request. prefix); grep confirms zero hits for the request. form
13. **The bundles emulator suite's proposed clause (test) would ALLOW transitions that the live HEAD rule DENIES — e.g. forged->draft or archived->forged pass the test's simple status!='equipped' gate but are denied by the live closed vocabulary.**  
   · _Plan / comment / expected:_ firestore.rules.emulator.test.js:283-284 PROPOSED_BUNDLES_CLAUSE gate is only !affectedKeys.hasAny(['status']) || status != 'equipped'  
   · _Code at HEAD:_ firestore.rules:297-307 closed vocabulary permits only draft->{forged,archived}, forged->archived, statusless/null backfill
14. **The census brief locates the sector prefer/lean_away data and a ±15% clamp in archetypeScoring.js and others, but neither exists at HEAD: no prefer/lean_away sector keys anywhere, and no ±15% sector clamp — the typed per-archetype sector-emphasis path is an explicitly-deferred empty seam.**  
   · _Plan / comment / expected:_ census brief item (1): 'sector preference (prefer/lean_away) data and the ±15% clamp site'  
   · _Code at HEAD:_ src/data/archetypeAdjustments.js:195-202 (PASS_THROUGH_SECTORS frozen empty, DEFERRED); archetypeScoring.js:135 (only clamp is score 0-100)
15. **agentUseDescription copy promises deterministic filtering ('automatically exclude', 'filter out', 'skip stocks with RSI above 70'), but runtime injects the rule as prompt text only; technical rules are 'soft' STRATEGY PREFERENCES the LLM merely 'should follow', with no exclusion code path.**  
   · _Plan / comment / expected:_ (no plan citation)  
   · _Code at HEAD:_ src/data/forgeKnowledgeBase.js:70,78,124 (agentUseDescription/strictMode copy, VERIFIED) vs api/_utils/agentPromptAssembly.js:96 (soft rules → STRATEGY PREFERENCES, VERIFIED)
16. **dimensionMapper.js comments that dimensionsToDirectives produces 'natural-language directives the Haiku prompt can reason about during intraday battles', but the battle snapshot copies only deployedGuardrails (not directives) into agentContext, and no eval/decide prompt reads deployedStrategy.directives — they surface only in SeasonReview.jsx UI.**  
   · _Plan / comment / expected:_ dimensionMapper.js:1310-1313 'Phase 4B will read these in agentEvalPromptAssembly.js' — not implemented for directives at HEAD  
   · _Code at HEAD:_ src/utils/dimensionMapper.js:1184-1192 (comment) vs api/_utils/agentBattleService.js:163-167 (only deployedGuardrails snapshotted) and src/screens/SeasonReview.jsx:258 (sole consumer)
17. **dimensionsToGuardrails emits maxPosition with enforcement:'hard' and dimensionsToDirectives tells Haiku 'no single holding above X%', but applyGuardrails records maxPosition as skipped_incompatible with note 'position-% cap is architecturally n/a' — the hard cap is never enforced.**  
   · _Plan / comment / expected:_ agentGuardrails.js:13 header lists maxPosition as '(hard) → logged as incompatible'  
   · _Code at HEAD:_ src/utils/dimensionMapper.js:1336-1339 & 1294-1298 vs api/_utils/agentGuardrails.js:327-339
18. **injectionClass is referenced as a hardness/enforcement concept but has no live values — 'The live agent has no injectionClass'.**  
   · _Plan / comment / expected:_ (no plan citation)  
   · _Code at HEAD:_ src/utils/traitEnforcement.js:5 (VERIFIED)
19. **logDecision is documented as decision provenance capture, but both call sites in decide.js are fire-and-forget (.catch(()=>{})) writing to a non-durable GCS shadow stream — the same fire-and-forget pattern BUILD_RULES §5 forbids for catalog writes, which shadowLogger.js itself flags as its cautionary tale.**  
   · _Plan / comment / expected:_ BUILD_RULES §5 (fire-and-forget catalog writes forbidden)  
   · _Code at HEAD:_ decide.js:572, 731 (.catch(()=>{})); shadowLogger.js:13-14
20. **projectActiveRules.js header (and equipBundle) claim the emitted activeRules item shape 'matches equipBundle's output field-for-field' so readers stay unchanged — but the deploy-path projector adds a `hardness` field (projectActiveRules.js:56) that the equip-path projection (bundleRuleProjection.snapshotsToActiveRules) does NOT emit. Readers that depend on carried hardness get the category fallback for equip-time activeRules, which is fine only because deploy re-projects and overwrites it.**  
   · _Plan / comment / expected:_ api/_utils/projectActiveRules.js:8-14 (claims field-for-field match with equipBundle output)  
   · _Code at HEAD:_ api/_utils/projectActiveRules.js:41-58 (hardness present); api/_utils/bundleRuleProjection.js:14-27 (hardness absent)
21. **scoring.tierMultipliers is snapshotted at lock but is a WRITTEN-NEVER-READ field per its own in-code note — a frozen value with no tick-time or settlement reader, so it contributes nothing to behavior despite occupying the freeze inventory.**  
   · _Plan / comment / expected:_ agentBattleService.js:146 comment ('Written-never-read snapshot; the dead doc config STAYS dead')  
   · _Code at HEAD:_ api/_utils/agentBattleService.js:146-149 VERIFIED
22. **tournamentUserScoring.js is fence-flagged by the census prompt but is NOT in the BUILD_RULES §1 fence list AND contains zero archetype references, so it is neither a genuine §1 fence file nor archetype-relevant to Map 1.**  
   · _Plan / comment / expected:_ census FENCE AWARENESS note flagging tournamentUserScoring.js  
   · _Code at HEAD:_ api/_utils/tournamentUserScoring.js (grep for momentum_chaser|archetype|arch_scores → no matches)


---

## Founder-verification items

_Requires live-console, deploy-state, or founder-sign-off confirmation — not determinable from the repo tree._


1. Is SECTOR_CAP_MODE='true' intentional? As written it disables the Diversifier sector cap entirely (matches neither 'enforce' nor 'observe'). If enforce was intended, the value must be 'enforce'; if a deliberate kill-switch, the string 'true' is a footgun that reads as ON but behaves as OFF.  _(raised by 6 maps)_
2. Is the HEAD firestore.rules ruleset actually deployed to the production Firebase project? Rules do not auto-deploy from code; the file itself flags manual Console/`npm run deploy:rules` deploy for the tournament, watchlist, learning (L802-805), and mastery (L841) blocks. The agents CREATE allowlist, bundle closed vocabulary, and all learning/mastery denials are inert on prod until manually deployed. Cannot be determined from the tree.  _(raised by 4 maps)_
3. Confirm regimePreferences.canEnterDistressed / convictionMods / sectorConcentrationCap / tradeFrequency are intentionally dead (display/illustrative only) vs. planned-but-unwired.  _(raised by 3 maps)_
4. FORGE_HARDSOFT_AUTHORING_ENABLED=true: the doc-comment's flip condition includes 'a founder sign-off on that fenced commit'. That the enforcement code landed is code-verified; that founder sign-off preceded the flip is not code-observable -- founder must confirm.  _(raised by 3 maps)_
5. A shadow-eval prompt on the agent-evaluate tick adds a SECOND fenced prompt path (agentEvalPromptAssembly) inside the fenced CPU-evaluation budget architecture — concept-fence contact; needs founder sign-off.
6. Any new cron entry is budget-constrained: 37/40 slots used (VERIFIED vercel.json:20-168), tournament build may add at most 2 (BUILD_RULES §6) — the shadow-eval and compile plans should ride existing handlers, and a decision to spend a slot is founder-level.
7. Archetype knob values (hftConfig) and preset risk levers resolve LIVE at tick keyed by a frozen scalar — confirm that mid-battle knob re-tuning of in-flight battles is the intended behavior until the ResolvedAgentManifest freeze lands (agent-evaluate.js:1213,649).
8. Compile-at-battle-lock requires editing the fenced createAgentBattle doc shape (agentBattleService.js) and/or decide.js — §7-gated; needs founder sign-off before any write (BUILD_RULES §1, docs/BUILD_RULES.md:12-23).
9. Confirm a future settlement 'final receipt' is NOT yet built: captureSwapReceipt writes are per-swap during ticks (agent-evaluate.js:1655/2290/2930/3125/3332), none at completion; no swapDecisionReceipt/BEM code exists (zero grep hits).
10. Confirm intended production coverage of L1 capture: at HEAD only the Haiku-autopilot site is live (EXPANSION=false), so risk-manager/guardrail/gameplan/expiry swaps produce NO receipt. Is single-site (E1) the intended state, or is EXPANSION expected on?
11. Confirm intent: forge rule 'CONSTRAINTS (must obey)' have no deterministic enforcement — is prompt-only obedience acceptable for the launch archetype-integrity claim, or should hard forge rules bind to a code gate the way deployedGuardrails do?
12. Confirm the bundles emulator suite is knowingly stale / not part of CI gating (it would throw at beforeAll when run against a live emulator at HEAD), or schedule a fix — but note firestore.rules is calibration-fenced-adjacent and the test asserts a superseded bundles shape.
13. Confirm the intended relationship between the durable receipt and the user-facing explanation: Voice/Film narration is an LLM reinterpretation off the battle doc, not a projection of the receipt — is display-agreement (§9) expected to hold here, or is the narration acknowledged as a separate surface?
14. Confirm the intended single enforcement-mode enum must reconcile THREE orthogonal axes (hard/soft prompt split; native/neutral/core_conflict equip gate; both/clash/season mode gate) — they are independent today, not one scale.
15. Confirm the pointer-clear guard is intentional: activeBattleId is nulled ONLY when agentSnap.activeBattleId===battle.id (pointerCurrent, :3809), because fenced decide.js GC writers (:588,:1115) re-point the agent at a fresh deploy at GC time; unconditional nulling would drop a LIVE battle lock. This couples non-fenced completeBattle behavior to fenced decide.js GC timing.
16. Confirm the receipt is deliberately scoped to predicate-only (no rules/leans/traits/constraints observability). The census's control-layer gap table shows 0 durable proof for rules/traits/leans and only mode-level proof for constraints.
17. For archetype #7: must it be reachable from the onboarding quiz (deriveArchetypeFromAnswers, archetypeDerivation.js:33-49)? If yes, a hardcoded routing branch (C5) is required beyond the data adds; if it is admin/board-assign only, the derivation router can stay 6-way.
18. Haiku model id is a hardcoded constant, not snapshotted or version-pinned — confirm whether the manifest should freeze model choice per battle (agent-evaluate.js:1914).
19. Is archetypeScoring.js inside the 'scoring engine' concept fence? It is NOT in the BUILD_RULES §1 file list, but the concept fence names 'the scoring engine'. archetypeScoring.js (archetype portfolio-ranking) is distinct from the fenced agentScoring.js (ATR-lock/badge scoring). Adding archetype #7 requires editing ARCHETYPE_WEIGHTS/CONSTRAINTS here — founder must rule whether that is a §7-gated fence edit.
20. Is it intended that an equipped Forge 'risk'/'allocation' rule is enforced ONLY as prompt text (hard CONSTRAINT) and never populates the deterministic guardrail engine (deployedStrategy.guardrails)? Users authoring a stop-loss-like Forge rule may expect mechanical enforcement it does not receive (agentGuardrails.js reads only deployedStrategy.guardrails; projectActiveRules output has no type/value/enforcement fields).
21. Jul-22 live-ops datapoint (one agent-evaluate run ~19.9s, evaluated 8) is consistent with the code (~2.5s/healthy battle in the sequential loop) but the specific run is not verifiable against logs from this session.
22. PR #640 claim CONFIRMED at HEAD: completeBattle (agent-evaluate.js:3646) opens one db.runTransaction (:3653) that folds the battle status flip (:3794), agent-stats mutation (:3832-3844) and activeBattleId clear (:3812/:3843) atomically; the B3 comment (:3665-3669) states this replaced a non-atomic legacy sequential agentRef.get/update. Confirm this is the intended settlement contract.
23. Should the L1 receipt or eval record capture a DETERMINISTIC record of which equipped rule influenced a decision? Today only Haiku-self-reported cited_forge_rules/overridden_forge_rules exist (agent-evaluate.js:2546-2547); there is no verified rule-application trace, and versions.ruleLibraryVersion is hard-null (captureReceipt.js:342).
24. The 143 agentUseDescription strings promise deterministic behavior ('automatically exclude', 'filter out') that the prompt-injection substrate does not deliver — confirm whether this copy should be reworded to 'prefer/deprioritize' for the soft (non-risk/allocation) majority, or whether a deterministic detector layer was intended.
25. The archetype battle index orders createdAt ASCENDING (indexes.json:265) while sibling agentBattles indexes use DESCENDING createdAt — confirm this matches the intended query direction (newest-first archetype queries would need a different index or in-memory sort).
26. Trade-aggressiveness axis has no declared owner: tempo dial (frozen) and strategyPreset (live-mutable mid-battle) both modulate it through orthogonal levers with no reconciliation. Confirm which control is authoritative, and whether mid-battle preset flips are intended to compose with a frozen tempo.
27. Two 'Trading Style Collection' catalogs share one id namespace (swing-trader/day-trader/...): forgeCollections.js (BaggerBomb rule ids) and dimensionMapper COLLECTION_DELTAS (season dimension ids). Confirm this dual catalog is intended and how a deployed agent's collection identity should be interpreted.
28. What does '±15% clamp' in the census brief refer to? No literal ±15% sector clamp exists at HEAD. Candidates: (a) the 35% Diversifier cap (agentGuardrails.js:60) misremembered; (b) a never-built typed-emphasis clamp (PASS_THROUGH_SECTORS is empty/deferred); (c) a design-doc-only concept. Needs disambiguation.
29. agent.personality.traits is still rendered into the (fenced) strategy prompt and tournament boards in parallel with the equippedTraits→activeRules projection. Confirm whether personality.traits should remain a live prompt input or be retired in favor of the projection.
30. deployedStrategy.directives are generated, stored, and shown in SeasonReview but never reach the battle prompt (only guardrails are snapshotted). Confirm whether these directives were meant to drive Haiku (comment says so) or are display-only by design.
31. hftConfig values were founder-signed as a calibration table (June 12, 2026: ZERO deltas at launch per resolveHftConfig comment agentArchetypeConfig.js:225-232) — any change to the knob table needs founder sign-off, not just a build PR.
32. maxPosition dimension cap is surfaced to users and injected into the prompt as a hard rule/directive but is a guaranteed no-op in applyGuardrails (BaggerBomb fixed slots). Confirm the intended UX: hide the control, downgrade to soft, or enforce a slot-based analogue.
33. tournamentUserScoring.js is fence-flagged by the census prompt but is NOT in BUILD_RULES §1's enumerated fence list — founder to reconcile whether it is fenced (BUILD_RULES.md:14-21).


---


## Observations

Ambiguities that will force Phase-1 decisions. No fixes, no sequencing, no build plan — findings only.

1. **`SECTOR_CAP_MODE = 'true'` is the single most-corroborated divergence** (7 of 12 agents flagged it independently): a value that reads ON but engages neither branch. Sections disagree on whether its fix-site `agentGuardrails.js` is §1-fenced (Maps 2/3b/5 call it FENCED; Maps 1/1.5 note it is absent from the §1 list) — that fence-status question must itself be resolved before the value can be corrected.
2. **Physics-that-isn't:** three archetype config fields (`convictionMods`, `sectorConcentrationCap`, `regimePreferences`/`canEnterDistressed`) plus `tradeFrequency` are declared physics with zero (or display-only) runtime consumers, while the *real* sector cap is a hardcoded constant behind an inert flag — a faithful config migration would carry dead config.
3. **Two owners, no ruling, on two axes:** aggressiveness (frozen tempo dial vs live-mutable `strategyPreset`) and trait channel (`personality.traits` prompt-names vs the `equippedTraits` projection) each have two live inputs with no declared authority — an owner ruling is a prerequisite to any collision cleanup.
4. **Hard-in-name-only:** equipped Forge "risk"/"allocation" rules are prompt-only (hard CONSTRAINT *text*) and never populate the deterministic guardrail engine; only `deployedStrategy.guardrails` is code-enforced. The display/copy layer implies mechanical enforcement the substrate does not provide (the `maxPosition` cap is literally logged `skipped_incompatible`).
5. **The durable record can't see the controls:** the L1 receipt is predicate-only and execution-triggered — it cannot record a blocked-but-considered action and has no field for rules/traits/leans/constraints. Any control-layer observability requirement forces a receipt-schema decision.
6. **The freeze boundary is half-drawn:** rules and leans are frozen; knobs, preset, tempo bands, prompt templates, and model id resolve live at tick. `swapDecisionReceipt (BEM)` and 7 of 8 version stamps are named-but-unbuilt. A `ResolvedAgentManifest` decision touches the fenced `createAgentBattle` doc shape.
7. **Deploy-state is unknowable from the tree:** whether the committed `firestore.rules` / `firestore.indexes.json` are actually live gates the validity of the entire write-permission substrate a compile step would rely on.
8. **Documentation drift vs behavior gap:** `FORGE_HARDSOFT_AUTHORING_ENABLED`'s stale comment (value ON, comment "gated off") is drift only — the enforcement path is verified landed; just the sign-off provenance is unconfirmed. Contrast with `SECTOR_CAP_MODE`, where the divergence is behavioral.
9. **The fence list itself carries discrepancies:** `tournamentUserScoring.js` is census-fence-flagged but absent from BUILD_RULES §1; `archetypeScoring.js` (where archetype #7's weights live) is not in the §1 file list though the "scoring engine" concept is fenced. Both need reconciliation before the compiler can respect a stable write-permission substrate.

**HARD STOP — read-only discovery complete. No follow-on work, no branch, no build plan. Report goes to founder review and triage.**
