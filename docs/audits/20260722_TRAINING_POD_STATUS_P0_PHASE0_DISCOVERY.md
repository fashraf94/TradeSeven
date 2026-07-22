# Training-Pod Status-Transition P0 — Phase 0 Read-Only Discovery

> **Disposition note (added at commit, July 22, 2026):** the founder ACCEPTED this report's premise reversal and RULED all four open decisions in `TRAINING_POD_STATUS_P0_PHASE0_RULINGS_JUL22_2026.md` (same-day relay). That memo SUPERSEDES `TRAINING_POD_STATUS_P0_FIX_SPEC_V1` and defines the re-scoped build (R1 verification → R2 unified `EXPIRED` terminal-disposition mechanism → R3 two callers → R4 regression lock). This report is the immutable discovery record; the rulings memo is the governing contract. Body below is byte-exact as delivered.

**Task date:** July 22, 2026 · **Repo:** `fashraf94/TradeSeven` · **Spec:** `TRAINING_POD_STATUS_P0_FIX_SPEC_V1` (pasted; no file in repo)
**Status:** READ-ONLY — no project state changed. **This is a HARD STOP for founder greenlight before any build.**

---

## 0. Preamble — guards, provenance, method (BUILD_RULES §3)

- **`git fetch origin` ran FIRST** (mandatory §3). Post-fetch `origin/main` = **`3f8ee0fb6db8ca6182b4b543ebc44b07862e7993`**. No stale-ref drift this run (local branch already at that SHA).
- **Branch:** `claude/training-pod-status-transition-p0-oz1bp1`, cut fresh from `origin/main`, **0 ahead / 0 behind**, clean working tree (`git status --porcelain` empty). Guard satisfied. **Fresh branch, one task = one branch.**
- **HEAD = origin/main = 3f8ee0fb** (Jul 22 2026). All citations are at this HEAD. Inherited anchors from the spec + the July-12/17 discovery docs were **re-verified** and several had drifted (line numbers, and one **premise** — see §2).
- **Every claim carries `path/file.js:line` + VERIFIED (read this session) / ASSUMED.**
- **Method.** Primary anchors read directly this session, then a 12-agent workflow (4 parallel status/gate/settlement/fence readers + 2 crux finders + **5 diverse-lens adversarial verifiers** + 1 census) re-derived every load-bearing claim independently. **All 5 adversarial verdicts returned CONFIRMED**, including the deliberately hostile "try to REFUTE that the machinery works" lens and the "tests-as-ground-truth" lens. 12/12 agents, 0 errors.
- **Fence note (§1):** the score-of-record surfaces (banking, canonical-open sweep, `createAgentBattle`/`decide.js`) were **read and their behavior mapped; none edited or proposed for edit.** Contact points flagged **⚑** below.

---

## 1. Executive verdict (founder summary)

| Question (Phase 0 asks) | Verdict at HEAD `3f8ee0f` |
|---|---|
| **Do training pods advance to BATTLE today?** | **YES — the transition machinery is fully built, wired into the orchestrator tick, flag-on, and test-locked.** A fresh training pod goes `FORMING→DRAFTING→(AWAITING_OPEN→)BATTLE→COMPLETE` with no status stall. **This REFUTES the spec's core premise** ("never advance … sit at Day 0 forever"). |
| **Is there a status-transition to *build*?** | **Largely NO.** The `§4.1` "transition fix" the spec envisions is **already present** (landed pre-HEAD, PRs ~#580 / Live-Draft phases). There is **no `TRAINING_POD_ADVANCE_ENABLED` flag** and nothing gating the transition off. |
| **Then why are pods stuck / why only 22 battles?** | **Best code-level reconciliation:** the stuck pods are **pre-existing residue** — formed before the machinery/flag went live, plus a real **FORMING-orphan** edge (below) and any sweep-failure residue. Confirming the population **requires production data I cannot query.** |
| **Addition 1 — do training pods get baselinePolicy STAMP *and* baseline VALUE capture?** | **BOTH. No gap.** Stamp at formation (`tournamentLobbyService.js:354`, flag-gated, *not* isTraining-gated); value capture in BATTLE via the shared canonical-open sweep (`canonicalOpenSweep.js:221/224`, no training exclusion). Minor **wording drift**: spec says "claim time"; code stamps at group **creation** (earlier + immutable). |
| **Item 4 — is `status===BATTLE && players.length===4` the complete gate?** | **YES, exactly that** and nothing else. No `isTraining`/`isDev`/mode/baseline/claim gate anywhere. CPU seats are inside `players[]` (counted). No gate structurally excludes training. |
| **Item 5 — same `completeBattle` settlement + mode?** | **YES.** Training battles flow through the identical post-#640 `completeBattle` transaction, get the same eligibility stamp, and resolve `MODE_MULT = 0.6` via `classifyModeKind(group.isTraining)`. Not one of the fence-path (STOP-A.2) completions. |
| **Item 7 — fence contact?** | **NONE required.** Every natural fix point (transition, sweeps, formation stamp, the new flag) is **non-fence**. Fenced surfaces are touched only by **call / auto-selection downstream** of BATTLE, never by edit. **No STOP condition on fence grounds.** |

**One-line headline:** *The training-pod status machine already fires all the canonical transitions at HEAD — the spec's "never advances" diagnosis is stale for fresh pods. The genuine remaining work is (a) the D1 stuck-pod cleanup — which has a real design gap (no terminal edge exists from pre-BATTLE states) — and (b) an end-to-end integration test; a default-false advance flag would DISABLE a working path, so it needs founder reconciliation before build.*

---

## 2. The central finding — the premise does not hold at HEAD (the STOP)

The spec (grounding on mastery-report **E2**, HEAD `f9a84e50`/Jul 17) states the status machine "never fires the transition for training pods." **At my HEAD (`3f8ee0f`, Jul 22) that is false for freshly-formed pods.** The reconciliation:

- **E2 itself already contained the tension.** Its sub-claim 4 (`docs/ARCHETYPE_MASTERY_DISCOVERY_REPORT_V1.md:1113`, VERIFIED) says the handoff "lands the pod directly in BATTLE (or AWAITING_OPEN)." That sub-claim is **CORRECT at HEAD** (`computeHandoffWrites` target = BATTLE|AWAITING_OPEN, `trainingLifecycle.js:339`). E2's *headline* framing ("the only blocker is the status half") is the part that is **stale**.
- **The transition wiring is live and ungated.** The training sweeps run inside `runOrchestratorTick` **before** the SKIP short-circuit, on every weekday-morning duty, behind only flags that are **ON** (`tournamentOrchestrator.js:922-960`, SKIP at `:962`; `LEAGUE_NEXT_ARC_ENABLED=true` `featureFlags.js:189`, `LEAGUE_TRAINING_POD_ENABLED=true` `:591`). **No `TRAINING_POD_ADVANCE_ENABLED` exists** (grep empty).

**Why this is a STOP, not a "proceed to §4.1":** the spec's build plan assumes it must *create* the transition and gate it behind a **default-false** flag ("flags-off byte-identical"). But the transition already fires. Adding a default-false flag around the existing, working transition would **turn OFF a live path** — a behavior *change* when off, the opposite of "byte-identical," and a regression against the ~22-battle data supply this P0 exists to grow. **The founder must reconcile the build's shape against this HEAD reality before any code is written.**

**The one genuinely strandable state — FORMING (real, narrow):** `formTrainingDraft` creates the pod (`quickPlay`→`formGroupFromLobby` set, `tournamentLobbyService.js:357`) and *then* runs the `FORMING→DRAFTING` transaction in the same request (`trainingLifecycle.js:416-424`). **No sweep advances a FORMING training pod** (the orchestrator sweeps only DRAFTING and AWAITING_OPEN). So if the request dies between the two steps, or the user abandons at the lobby, the pod strands permanently at Day-0 FORMING. This is an **error-path orphan**, not the systematic blocker the spec describes — but it is the one place a fresh pod can genuinely stick, and it has **no backstop** today.

---

## 3. Phase 0 items — file:line answers

### Item 1 — The status-machine map (VERIFIED)

**The primitive.** `transitionStatus` = transactional read-check-write, `tx.update({status:to})` `tournamentGroupService.js:112`, guarded by `assertTransition` `:111` against `LEGAL_TRANSITIONS` `:41-47`:
`FORMING→{DRAFTING,BATTLE,AWAITING_OPEN}` · `DRAFTING→{BATTLE,AWAITING_OPEN}` · `AWAITING_OPEN→{BATTLE}` · `BATTLE→{COMPLETE}` · `COMPLETE→{}`.

**Ranked chain (the "works today" reference):** group is *born* at FORMING (`createTournamentGroupDoc` default, `leagueTournament.js:1248/1291`; set in `formGroupFromLobby:351/357`); lobby doc flips OPEN→FORMING (`tournamentLobbyService.js:250`, LOBBY_STATUS not GROUP_STATUS); then **single-shot FORMING→BATTLE** via `resolveUserDraftForGroup` (`resolve-user-draft.js:183`, target default BATTLE `:140`, assert `:170`), fired by (1) the admin/cron endpoint `resolve-user-draft.js:208` or (2) the Monday orchestrator pipeline `tournamentOrchestrator.js:438/505-509`. **Ranked never enters DRAFTING/AWAITING_OPEN**; baselines settle at open via the canonical sweep (value only, not a status writer).

**Every status writer, enumerated:**

| # | Edge | Writer (file:line) | Fired by |
|---|---|---|---|
| — | create @FORMING | `leagueTournament.js:1248/1291`; `tournamentLobbyService.js:351/357`; `tournamentAdvancement.js:812`; `seed-tournament-bracket.js:81-86`; `liveDraftFormation.js:299` | Quick Play / lobby form / next-round / dev seeder / slot claim |
| — | ranked FORMING→BATTLE | `resolve-user-draft.js:183` | admin endpoint `:208` / Monday pipeline `orchestrator.js:438` |
| a | training FORMING→DRAFTING | `trainingLifecycle.js:416/422` | `lobby-quickplay-training.js` → `formTrainingDraft` |
| b | training DRAFTING→BATTLE\|AWAITING_OPEN (12th pick, inline) | `trainingLifecycle.js:495-501` (target `:339`) | `training-pick.js` → `applyTrainingPick` |
| c | training DRAFTING→… (resume/idle terminal) | `trainingLifecycle.js:535-544` | `completeTrainingDraft` (resume + idle sweep) |
| d | training/slot **AWAITING_OPEN→BATTLE** | `trainingLifecycle.js:572` (`transitionStatus`) | orchestrator morning tick `orchestrator.js:938` — **not isTraining-filtered** |
| e | idle DRAFTING auto-complete | `trainingLifecycle.js:635` (drives (b)) | orchestrator morning tick `:930` (isTraining-scoped `:607`) |
| f | training BATTLE→COMPLETE | `trainingLifecycle.js:674` | nightly `snake-draft-daily-scores.js:511` |
| — | slot FORMING→DRAFTING / DRAFTING→… | `liveDraftLifecycle.js:249/332/425` | `live-draft-fire.js:60/73` |
| — | BATTLE→COMPLETE advancement | `tournamentAdvancement.js:325/351/677` | Friday advancement (`TOURNAMENT_ADVANCEMENT_FROZEN=true` → withheld; **does not affect training reaching/holding BATTLE**, and training completes via (f)) |

### Item 2 — The divergence point (VERIFIED; 3-lens adversarially CONFIRMED)

**Verdict: a fresh training pod formed today reaches BATTLE and activates its agent layer.** Traced end-to-end, each hop re-read this session and by 3 independent verifiers:

- **HOP 1 FORM** `FORMING→DRAFTING` atomic in one tx (`trainingLifecycle.js:416-424`). **H1 (stall in FORMING) ruled out for the completed-formation case** — but see the **FORMING-orphan** edge (§2): an *interrupted* two-step formation has no sweep backstop.
- **HOP 2 DRAFT** 12th pick → inline handoff (`:495-501`); abandonment caught by the **3h idle sweep** (`sweepIdleDraftingPods:597-653`, `DRAFT_IDLE_STALE_MS=3h` `leagueTournament.js:796`) on the next weekday-morning tick. **H2 ruled out** (worst case: Friday-afternoon abandon completes Monday).
- **HOP 3 HANDOFF** today-anchor → **BATTLE inline**; future-anchor → AWAITING_OPEN (`computeHandoffWrites:339`; `nextMarketOpenAnchor:152-158`). Test-locked `trainingLifecycle.test.js:366-378` (today→BATTLE), `:400-407` (after-open→AWAITING_OPEN).
- **HOP 4 FLIP** AWAITING_OPEN→BATTLE on every weekday morning, **deliberately not isTraining-filtered**, date-based/DST-safe (`flipAwaitingOpenPods:570-572`). **H3 ruled out** — training pods carry no `isDev`, so `includeDev=false` never excludes them.
- **HOP 5 ACTIVATION** `sweepTrainingActivation` (`orchestrator.js:953`→`activateTrainingPod:725-810`, guard `isTraining&&BATTLE:737`) provisions the clone, drafts the agent layer once, deploys the battle. **H4 ruled out as a machinery break.** Residual **data** condition (not a status blocker): a human seat with **no ranked agent** yields a synthetic board and creates no battle for that seat (`:767-772`) — but the formation endpoint already 409s `no_agent`, so a normally-formed pod has a real clone.
- **H5 (the reconciliation):** the flip/activation wiring landed pre-HEAD; the stuck pods are **pre-existing**. *Asserted from wiring dates + code, not from a production query — see the census caveat (Item 6).*

**No flag gates advancement off** (`orchestrator.js:922-960`, block runs before SKIP `:962`).

### Item 3 — AWAITING_OPEN semantics + Addition 1 (STAMP vs VALUE) (VERIFIED; 2-lens CONFIRMED)

**AWAITING_OPEN guarantees:** picks are **final and materialized** (`createPickState`, `computeHandoffWrites:321-329`), `startAnchor` stamped (`:343`), and the pod is **invisible to every score-of-record consumer** because `status!=BATTLE`: canonical-open sweep selects only BATTLE (`canonicalOpenSweep.js:221`), banking early-returns `not_battle` (`tournamentBanking.js:361/388-391`). Training reaches AWAITING_OPEN via the ordinary handoff and exits via the **shared** `flipAwaitingOpenPods` — the *same* machinery ranked/slot use. It does **not** need a new claim-time stamping mechanism.

**Addition 1 — the two "baselines" are distinct, and training gets BOTH:**

1. **baselinePolicy STAMP** (the `'canonical_open'` marker on the group doc): written in `createTournamentGroupDoc` inside `formGroupFromLobby`, gated **only** on `LEAGUE_CANONICAL_OPEN_CAPTURE` (=true) — **not `isTraining`-gated** (`tournamentLobbyService.js:354`; `isTraining` is a sibling key `:351`). Training forms through this exact path (`formTrainingDraft:361`→`quickPlay`→`formGroupFromLobby`). Persisted/validated `leagueTournament.js:1281/1295`. **PRESENT for training.** *Wording drift (VERIFIED/PARTIAL):* spec §2.3 says "at claim time"; code stamps at **group creation** in FORMING (functionally earlier, written once, immutable) — a documentation nuance, not a gap.
2. **baseline VALUE capture** (the actual open price into `players[].picks[].legs[].baselinePrice`): `runCanonicalOpenSweep` selects `fetchEligibleGroupsByStatus(db, BATTLE)` with **no options** → `excludeTraining` defaults false → training BATTLE pods **are** returned (`canonicalOpenSweep.js:221`; `tournamentGroupService.js:150/159`), then filters to `baselinePolicy===CANONICAL_OPEN` (`:224`) — which training satisfies **because of the stamp**. The capture loop iterates **every** player/pick/leg with **no `isCpu`/`isTraining` skip** (`:71-119`). **PRESENT for training; CPU seats settled identically.**

**Conclusion:** the STAMP is exactly what admits training pods to the VALUE capture. Both halves apply; the three readers (`buildArenaModel.js:110`, `leagueStarMeter.js:176`, `tournamentBanking.js:137/196-199`) then treat a stamped training pod as canonical, not legacy. **No gap.**

### Item 4 — Gate completeness beyond status (VERIFIED)

The **complete** precondition set for a training pod to bank/settle: `{doc exists}` (`tournamentBanking.js:359`) ∧ `{status===BATTLE}` (`:361`) ∧ `{players.length===GROUP_SIZE(4)}` (`:397`; `GROUP_SIZE=4` `leagueTournament.js:71`) ∧ `{no day already recordedDate===today}` (`:120`). **That is the entire set** — "status===BATTLE && players.length===4" plus first-of-day idempotency. **No** `isTraining`/`isDev`/mode/baselinePolicy/claimSystem pod-eligibility gate exists (`grep isCpu` = 0 in banking/scoring/groupService). CPU seats are `{odUserId,picks,isCpu:true}` inside `players[]` (`tournamentLobbyService.js:346`), counted with no skip (`computeBankingUpdate:166-173`). **No "user-baseline settlement" pod-eligibility gate exists** — user-baseline settlement is done *inline* in `computeBankingUpdate` (`:201-263`); `tournamentUserScoring.js` is pure scoring (no gate); `baselineValidation.js` validates a *price value*, not a pod. A run-level abort if the quote feed returns zero (`:414-426`) gates the whole nightly run identically for all modes. **⚑ No gate weakened or proposed for weakening — mapping only.**

### Item 5 — Settlement-path continuity (VERIFIED)

`completeBattle` (`agent-evaluate.js:3646`) is the single terminal writer; post-#640 it is a **guarded `runTransaction`**: re-reads in-tx, no-ops on already-terminal (`:3653/3661-3663`), and assembles `status:'completed'` + `completedAt` + the mastery eligibility stamp into **one** `updatePayload` committed by a single `t.update` (`:3737-3754/3784-3794`). Training agentBattles are created by the **same** deploy plumbing as ranked (`activateTrainingPod`→`fanOutDeploys`→`buildDeployRequest` POST `/api/agent/decide` with `gameMode:TOURNAMENT_GAME_MODE`, `orchestrator.js:222-242/799`) and consumed by the **same** expiry sweep (`findActiveAgentBattles`, `status=='active'`, mode-agnostic, `:194-204`). The eligibility-stamp gate (`maybeBuildEligibilityStampFields`, `masterySettlement.js:114-119`) references only `everEnabled`, `isMasterySubject` (`isCpu!==true`), and stamp-absence — **never `gameMode`/`isTraining`** → training's human-clone battle is stamped identically. Mode classifier: `classifyModeKind(group.isTraining)`→`'training'`→`MODE_MULTS.training = 0.6` (`masteryFormula.js:41-45/117`; `masterySettlement.js:130-135`). Training's normal `active→completed` completion **does stamp** — it is **not** one of the fence-path (`decide.js` bare-GC, STOP-A.2) completions. **⚑ `decide.js`/`agentBattleService.js` reached only by call (deploy POST), not opened.**

### Item 6 — Stuck-pod census (predicate + operator query; live counts require prod access)

**No production Firestore access — I cannot measure the live count/ages.** Delivered instead:

- **Classification predicate (D1-safe, training-only):** `pod.isTraining===true && pod.isLiveDraft!==true && status ∈ {forming,drafting,awaiting_open} && <state-specific staleness>`. **`isTraining===true` is necessary AND sufficient** to exclude ranked/competitive pods (training sets `isTraining` and never `isLiveDraft`; slot sets `isLiveDraft` and never `isTraining` — mutually exclusive by construction, `leagueTournament.js:1294` vs `liveDraftFormation.js:302`), but D1 should keep the explicit `isLiveDraft!==true` conjunct as defense-in-depth.
- **Per-state meaning + age signal:** FORMING → orphan (abandoned-at-lobby or interrupted formation); **no draftState**; only signal is `createdAt/updatedAt`. DRAFTING → age = `draftState.lastActivityAt` (fallback `startedAt`); stuck only if the 3h sweep isn't running or the draft "wedged" past the 16-round ceiling (`trainingLifecycle.js:638-643`). AWAITING_OPEN → **only stuck if `todayEtDate > startAnchor.anchorEtDate`** (a future anchor is legitimately pending, not stuck); signal = `startAnchor.anchorEtDate`.
- **Safe read-only operator query:** `tournamentGroups where isTraining==true, status in ['forming','drafting','awaiting_open']`, then in-memory bucket by status/age (FORMING: `now-createdAt`; DRAFTING: second read of the `draft/state` sibling for `lastActivityAt`; AWAITING_OPEN: `todayEtDate > anchorEtDate`). Pure `.get()` — writes nothing.
- **Expected real yield:** FORMING orphans + wedged DRAFTING + flip-errored AWAITING_OPEN — **not** the whole training population (the sweeps drain DRAFTING/AWAITING_OPEN if the cron is firing).

### Item 7 — Fence check (VERIFIED; **no STOP**)

Fence = the 8 `api/agent/*` + `api/_utils/agent*.js` files + `createAgentBattle`/scoring as-concept (`BUILD_RULES.md:10-23`). Every natural fix point is **non-fence**: the transition primitive (`tournamentGroupService.js:101-115`), `flipAwaitingOpenPods`/handoff/idle-sweep (`trainingLifecycle.js`, imports non-fenced `:62-85`), the orchestrator sweep wiring (`orchestrator.js:922-960` — note it *already* imports fenced `flattenPortfolioServer`/trainingLifecycle by permitted call `:85`), the formation stamp (`tournamentLobbyService.js:354`), the formation endpoint (`api/tournament/…`), and the proposed flag's home (`src/config/featureFlags.js`). The fenced-as-concept surfaces — `createAgentBattle` (`agentBattleService.js`), `canonicalOpenSweep`, banking — are engaged only by **call / auto-selection downstream** of the BATTLE transition (deploy POST; BATTLE-status auto-selection), **never by edit**. **The natural transition point is NOT inside a fence file → no redesign-around-fence STOP.**

---

## 4. Build-phase constraints RECORDED (not executed — for after founder greenlight)

### D1 cleanup-script requirements (spec Addition 2) — recorded, with a real design gap

When/if built, the D1 cleanup must carry all five: (1) **transactional state+version precondition** (re-read pod in-tx, act only if still in the stuck status — mirror `transitionStatus:106-113`); (2) **training-only classification predicate** (Item 6: `isTraining===true && isLiveDraft!==true && status∈{forming,drafting,awaiting_open}`); (3) **cutoff timestamp** (per-state staleness: FORMING `now-createdAt`, DRAFTING `DRAFT_IDLE_STALE_MS`/longer, AWAITING_OPEN `todayEtDate>anchorEtDate`); (4) **mandatory dry-run count** (the Item-6 read-only query first, report count/ages, no writes); (5) **retry-safe terminal disposition** (idempotent — a second run is a no-op).

**⚠ DESIGN GAP the founder must resolve for D1:** `LEGAL_TRANSITIONS` has **no terminal edge from FORMING/DRAFTING/AWAITING_OPEN** — only `BATTLE→COMPLETE` (`tournamentGroupService.js:44-45`). So `transitionStatus(...→COMPLETE)` on a stuck pre-BATTLE pod **throws `illegal transition`**. "Expire via the existing GC disposition" therefore has **no existing tournamentGroups path for pre-BATTLE pods**. The only adjacent precedents: `completeBankedTrainingPods`→COMPLETE (from BATTLE only) and `releaseSlotSeat` **hard-deletes** the doc for abandoned *competitive* pods (`liveDraftFormation.js:435`). The D1 "terminal disposition" must pick one: **(a)** add a new terminal edge / an `expired` marker to the state machine (state-machine change), or **(b)** hard-delete the doc (the `releaseSlotSeat` precedent). This is a founder/design decision, not a mechanical port.

### HOLD adversarial-diff bundle (spec Addition 3) — checklist recorded for the build's HOLD

To assemble at HOLD: **`-U25` diff**; all status writers (Item 1 table) + canonical-open capture (`canonicalOpenSweep.js`) + banking gate (`tournamentBanking.js:361/390`) + user-baseline settlement (`computeBankingUpdate:201-263`) at HEAD; evaluation scheduler (`agent-evaluate.js` expiry sweep `:194-204`), daily-bank writer (`snake-draft-daily-scores.js:482/511`), `completeBattle` transaction (`agent-evaluate.js:3646`), eligibility stamping (`masterySettlement.js:114-119`), mode classifier (`masteryFormula.js` + `classifyModeKind`); the full cleanup script + the existing expiry writer (`releaseSlotSeat:435` / `completeBankedTrainingPods:665`); `git diff --name-only` + flag definitions (`featureFlags.js`) + disabled-path (flags-off) evidence.

---

## 5. Founder decisions required at this STOP

1. **Reconcile the build's shape.** The §4.1 transition is already live and ungated. Do you want to: **(A)** re-scope this P0 to *only* D1 cleanup + the §4.3 integration test (recommended — matches HEAD reality), **(B)** still add a `TRAINING_POD_ADVANCE_ENABLED` flag *around the existing transition* (note: default-false would **disable** a working, data-producing path — a behavior change when off, contradicting "byte-identical"), or **(C)** something else?
2. **FORMING-orphan backstop.** Do you want a sweep/backstop for pods stranded at FORMING (the one real strand point with no driver today), or is that folded into D1 cleanup?
3. **D1 terminal disposition** (the state-machine gap above): new terminal edge/marker vs. hard-delete (the slot precedent)?
4. **Census.** Authorize an operator to run the read-only Item-6 query (I have no prod access) so the actual stuck population — and whether the orchestrator cron is even firing in prod — is known before D1 is scoped.

## 6. STOP

Read-only discovery complete; **no project state changed, no code written, no push.** Awaiting founder greenlight and the decisions in §5 before any build. This report is delivered as a downloadable file (BUILD_RULES §3); it can be committed to `docs/audits/` on founder approval, per the mastery-Phase-0 precedent.
