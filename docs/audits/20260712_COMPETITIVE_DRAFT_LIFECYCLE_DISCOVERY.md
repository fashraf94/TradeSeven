# Discovery — Competitive Draft Lobby & Lifecycle Impact (READ-ONLY)

**Task date:** July 5, 2026 · **Run date:** July 12, 2026 · **Repo:** `fashraf94/TradeSeven`
**Author:** Claude Code discovery session · **Status:** READ-ONLY — no changes, no writes to project state.

---

## 0. Preamble — guards, provenance, method

- **`git fetch origin` ran first** (BUILD_RULES §3, mandatory). It mattered: **pre-fetch `origin/main` was the stale ref `4a0f43e`; post-fetch it advanced to `8aeb377f`** — the exact stale-remote-tracking-ref hazard §3 was codified to prevent (July 12 L1-foundation incident). Fetch is recorded here as required.
- **HEAD = origin/main = `8aeb377f924ad9f2cb3ed10b6c9fc9f8645d31c0`.** Clean working tree (`git status --porcelain` empty). Local branch checked out: `claude/competitive-draft-lifecycle-rcnsux`, whose HEAD is byte-identical to `origin/main` (zero commits ahead/behind). Guard satisfied.
- **Citations** carry `path:line` and a **VERIFIED** (read this session) / **ASSUMED** marker. Every load-bearing claim below is VERIFIED against HEAD `8aeb377f`.
- **Method:** the primary anchors were read directly this session; a 5-finder + 2-adversarial-verify + completeness-critic workflow corroborated the reads. **Both headline Track-C claims returned CONFIRMED under independent adversarial re-derivation.** Inherited anchors from the task prompt were re-verified and **three had drifted** — see §4.
- **Fence note:** the canonical-open sweep, banking, and agent-ledger are score-of-record / fence-adjacent (BUILD_RULES §1, §7). None were edited; several were *read* and their exported behavior cited. Fence-adjacent contact points are flagged **⚑ FENCE** below.
- **No out-of-task bugs found** that warrant separate tasking; two design-integrity observations are noted in §5.

---

## 1. Executive verdict (founder summary)

| Question | Verdict |
|---|---|
| **Does the interactive live draft already exist and work?** | **Yes.** It is real, interactive, server-authoritative, and shipping today — but wired **training-only**. Snake order, a 20-second per-pick clock, autopick, CPU opponents, live reveal, completion handoff — all present. |
| **Can we reuse the draft room for the competitive game, or must we build one?** | **Lift-and-adapt — one draft experience for both modes.** The room (UI + live-pick mechanics) is essentially mode-agnostic; the training entanglement lives almost entirely in the **lifecycle / writer / sweep** layer, not the room. |
| **Does inserting a live DRAFTING phase break the canonical-open baseline (the crown jewel)?** | **No — it is a lifecycle _insert_ that respects canonical-open, not a change that reopens the invariant.** The entire score-of-record surface (baseline sweep, banking, claims, ledger, flips) is gated on `status === 'battle'`. A DRAFTING/AWAITING_OPEN pod is structurally invisible to all of it. Picks are always final **before** baseline capture, **by construction**. |
| **Does the live draft have to "beat the 9:30 open"?** | **No — and this is the key relief.** Draft _completion_ is decoupled from market open by the existing **`AWAITING_OPEN`** holding state. A draft can finish at any hour, park in `AWAITING_OPEN`, and the baseline is captured at the next open once it flips to `BATTLE`. Timing is a **product/UX** question (same-day vs next-day battle start), **not** a baseline-integrity risk. |
| **What actually has to change?** | Not the crown jewel. The work is a **competitive writer** (form real-humans + CPU-pad → DRAFTING), **extending the training-only assumptions** on DRAFTING/AWAITING_OPEN (client subscription, idle-abandonment sweep, claims-open gate, ranked host render route), and renegotiating a handful of **tests that lock the current single-shot atomicity**. |

**One-line headline:** *The competitive-default live draft is a bounded insert in front of an existing `status==='battle'` firewall; the crown-jewel baseline system does not have to be reopened, and the interactive room + the `AWAITING_OPEN` decoupling are already built — the work is a competitive writer plus lifting a set of `isTraining`-only gates.*

---

## 2. PART 1 — Training-lobby map (components, flow, state machine, writer, data model)

### 2.1 State machine (already multi-phase — see §4 drift note)

`GROUP_STATUS` (`src/constants/leagueTournament.js:84-95`, VERIFIED):
`FORMING:'forming'` · `DRAFTING:'drafting'` · `AWAITING_OPEN:'awaiting_open'` · `BATTLE:'battle'` · `COMPLETE:'complete'`.

`LEGAL_TRANSITIONS` (`api/_utils/tournamentGroupService.js:41-47`, VERIFIED) — **already permits the draft edges**:
```
FORMING       → DRAFTING | BATTLE | AWAITING_OPEN
DRAFTING      → BATTLE | AWAITING_OPEN
AWAITING_OPEN → BATTLE
BATTLE        → COMPLETE
COMPLETE      → (terminal)
```
Enforced transactionally by `transitionStatus` / `assertTransition` (`tournamentGroupService.js:49-115`, VERIFIED). The invariant is **not** in the table — it is the comment-documented, consumer-enforced rule *"DRAFTING is reached ONLY by the training path"* (`tournamentGroupService.js:34-40`; `trainingLifecycle.js:38-44`, VERIFIED).

**Training lifecycle path:** `FORMING → DRAFTING → (complete) → AWAITING_OPEN → (morning flip) → BATTLE → (rolling) → COMPLETE`.
**Competitive lifecycle path today:** `FORMING → BATTLE` single-shot (`resolve-user-draft.js`, VERIFIED).

### 2.2 Client flow — how a user drafts live

| Step | Mechanism | Citation (VERIFIED) |
|---|---|---|
| **Entry #1 (in-app)** | `onOpenTrainingPod(pod)` — `pod.status===DRAFTING → screen 'trainingDraftRoom'`; else → `trainingBattle` host. Live League-surface nav (Slice 5b-i). | `src/App.jsx:2262-2271` |
| **Entry #2 (dev gate)** | `?trainingDraft=<groupId>` query param, mount-only dev/preview gate. | `src/App.jsx:2256-2261, 9032-9033` |
| **Route render** | `screen==='trainingDraftRoom' → <TrainingDraftRoomScreen user groupId onExit>`; onExit routes to the training battle host. | `src/App.jsx:9034-9044` |
| **Screen → room** | Thin flag switch renders `DraftBoardRoom` (redesigned; flag ON) vs a legacy board. Room props: `{user, groupId, onComplete=null, onExit=null}`. | `src/screens/TrainingDraftRoomScreen.jsx` (workflow-VERIFIED); `DraftBoardRoom.jsx:72` |
| **Live state hook** | `useTrainingDraft({user, groupId, active, clockPaused})` subscribes to the group doc **and** the live-draft sibling doc; reads the universe once. | `src/hooks/useTrainingDraft.js:36-70` |
| **Snake order** | **Server-computed** (`generateSnakeOrder(members.length, PICKS_PER_PLAYER)`) and only *read* on the client (`draft.snakeOrder[currentPickIndex]`). | `trainingLifecycle.js:66,373`; `useTrainingDraft.js:76-77,245` |
| **Turn logic** | `isMyTurn = isDrafting && members[snakeOrder[currentPickIndex]] === currentUserId` — pure seat math, mode-agnostic. | `useTrainingDraft.js:76-79` |
| **Picks (live)** | Click-to-select → `doConfirm` → `submitPick(symbol,false)` → `makeTrainingPick` server endpoint. Client never writes state. | `DraftBoardRoom.jsx:169-177,287-290`; `useTrainingDraft.js:166-192` |
| **Per-pick timer** | 20 s client countdown (`TRAINING_TUNING.PICK_CLOCK_MS = 20000`), 250 ms tick, armed only on your turn. | `useTrainingDraft.js:199-215`; `leagueTournament.js:747-748` |
| **Autopick** | On expiry fires `submitPick(null, true)` → server picks archetype-fit best-available. Client timer dies on tab-close; **server idle-sweep is the backstop**. | `useTrainingDraft.js:208-213` |
| **Opponent reveal** | CPU picks advanced server-side, animated via `useDraftReveal`; snipe callouts. | `DraftBoardRoom.jsx:151-155` |
| **Completion (client)** | `isComplete = group.status !== DRAFTING`; renders "Lineup locked" — copy branches on `finalStatus===BATTLE` ("live") vs else ("waiting for the next market open"). | `useTrainingDraft.js:80-81`; `DraftBoardRoom.jsx:96,198-222` |

### 2.3 Server writer + lifecycle (`api/_utils/trainingLifecycle.js`, VERIFIED, all non-fenced)

Live draft state lives **off the group doc** at `tournamentGroups/{id}/draft/state` (`DRAFT_SUBCOLLECTION`/`DRAFT_STATE_DOC_ID`) so 12 rapid pick-writes never touch the group doc's transition-only contract (`:165-176`).

| Fn | Role | Citation |
|---|---|---|
| **(a) `formTrainingDraft`** | Sole DRAFTING writer for training. Reuses `quickPlay({isTraining:true})` (1 human + 3 CPU), initializes live state, `assertTransition(FORMING→DRAFTING)`, advances leading CPU seats to the human's first turn — one transaction. | `:340-411` (writes DRAFTING `:403`; asserts `:397`) |
| **(b) `applyTrainingPick`** | One human pick (explicit or autopick) under snake turn guard (`not_your_turn` `:447`), then CPU run-up. 12th pick triggers **inline completion handoff** (atomic with final pick). | `:423-488` |
| **(c) `completeTrainingDraft`** | Transition-only handoff (resume/crash-recovery). Does **not** re-run resolveSnakeDraft — materializes `players[].picks` via the **same `createPickState`** the resolver uses, stamps `startAnchor`, lands `AWAITING_OPEN` or `BATTLE` (R1 inline flip if anchor date is today). | `:501-530`; handoff builder `:299-327` |
| **(d) `flipAwaitingOpenPods`** | Orchestrator morning tick flips `AWAITING_OPEN→BATTLE` once anchor **DATE** arrives (date-based, DST-immune). **Does NOT filter `isTraining`** — flips any AWAITING_OPEN pod. | `:541-562` |
| **(e) `sweepIdleDraftingPods`** | Same morning tick: a DRAFTING pod idle past `DRAFT_IDLE_STALE_MS` is autopicked to completion. **Filters `isTraining===true`** (`:578`). | `:575-624` |
| **(f) `completeBankedTrainingPods`** | Nightly rolling completion once the week banks. **Filters `isTraining===true`** (`:639`). | `:636-658` |

**Pick finality:** the handoff materializes picks with `baselineSource: DRAFT_RESOLUTION`, `baselinePrice: null` (`:308-313`) — **byte-identical downstream to a single-shot resolved pod** (`resolve-user-draft.js:160-168`). Both paths converge on the same artifact; baselines settle later at open.

### 2.4 Data model — streams, subscriptions, selectors

- **Draft-state stream:** `subscribeDraftState(groupId)` → `tournamentGroups/{id}/draft/state` (live pick-by-pick). Playback stream written to `tournamentGroups/{id}/streams/userDraft` at completion (`trainingLifecycle.js:479, 526`; `resolve-user-draft.js:184-188`, VERIFIED). Signal-Capture Rider #3: awaited, in-transaction, no fire-and-forget.
- **Group status query:** `fetchEligibleGroupsByStatus(db, status, {includeDev, excludeTraining})` — exact-equality `.where('status','==',status)` + seat-count guard (`tournamentGroupService.js:150-163`, VERIFIED). The one shared status query all duty surfaces use.
- **Competitive client selector — `selectMyGroup`** (`leagueTournament.js:528-532`, VERIFIED): `filter(status===FORMING || status===BATTLE) && isTraining!==true`. **Never observes DRAFTING/AWAITING_OPEN.** Basis of the client `subscribeMyGroup`.
- **Training client selector — `selectMyTrainingPod`** (`leagueTournament.js:547-555`, VERIFIED): `isTraining===true && (DRAFTING || AWAITING_OPEN || BATTLE)`. Powers `subscribeMyTrainingPod` **and** the server one-active-pod guard `findActiveTrainingPodForUser` (`tournamentGroupService.js:87-93`, used by `lobby-quickplay-training.js`).

---

## 3. PART 2 — Reuse verdict (lift-and-adapt vs build)

**Verdict: LIFT-AND-ADAPT one draft experience for both modes.** The interactive room (UI + live-pick mechanics) is cleanly liftable; the entanglement is concentrated in the lifecycle/writer/sweep layer, exactly as the task hypothesized.

### 3.1 What lifts cleanly (mode-agnostic today)

| Asset | Why it lifts | Citation (VERIFIED) |
|---|---|---|
| **`DraftBoardRoom` room shell** | Clean prop surface `{user, groupId, onComplete, onExit}`; no `isTraining` literal inside. | `DraftBoardRoom.jsx:72` |
| **Live-pick mechanics** | Turn/snake/timer/autopick/confirm all derive from server state; seat logic keys on `isCpu`, not training. | `useTrainingDraft.js:76-215` |
| **Draft atom library** | `boardModel`, `StockCard`, `SnakeStrip`, `SeatCard`, `PickPanel`, `RevealRow`, `useDraftReveal`, `DraftForming`, `draftTokens`. | `DraftBoardRoom.jsx:17-28` |
| **Completion handoff** | Produces a pod byte-identical to the resolver's; already lands BATTLE **or** AWAITING_OPEN via `targetStatus`. | `trainingLifecycle.js:299-327`; `resolve-user-draft.js:140,160-183` |
| **Participant model (human + CPU padding)** | **Already shared:** both modes form via `quickPlay` (1 human + 3 CPU). Competitive omits `isTraining`; training sets it. | `lobby-quickplay.js:16-19` vs `trainingLifecycle.js:342` |
| **Battle View V2 mapper** | `deriveArenaState` already maps DRAFTING/AWAITING_OPEN→'awaiting'; mode is host-supplied, default ranked — explicitly mode-agnostic. | `arenaStateMap.js:14-42` |

### 3.2 What is training-coupled (and how deep)

| Coupling | Depth | Citation (VERIFIED) |
|---|---|---|
| Room copy: "Training Draft", "PRACTICE · NO STAKES", "practice — no stakes … against three CPU agents" | **Cosmetic** — labels/copy only | `DraftBoardRoom.jsx:308,319,399`; `DraftForming.jsx:35,67` |
| Seat labels hardcode "CPU {n}" regardless of `players[].isCpu` | **Shallow** — would derive from player identity for real humans | `DraftBoardRoom.jsx:143-144` |
| Hook hardwired to the `draft/state` doc + `makeTrainingPick` endpoint + `TRAINING_TUNING` clock | **Shallow/parameterizable** — a mode param or a sibling hook | `useTrainingDraft.js:28-31,173,201` |
| **`formTrainingDraft` writer** — hardcodes `quickPlay({isTraining:true})` + CPU padding; sole DRAFTING writer | **Deep (lifecycle)** — needs a competitive writer variant | `trainingLifecycle.js:340-411` |
| **Idle-abandonment sweep** filters `isTraining` | **Deep (lifecycle)** — competitive needs its own abandonment path or filter extension | `trainingLifecycle.js:578` |
| **Client subscription** `selectMyGroup` never observes DRAFTING/AWAITING_OPEN | **Deep (data model)** — must extend for competitive re-entry | `leagueTournament.js:530` |
| **Ranked host render** uses binary `isForming` split; V2 arena gated on a *deployed* battle → **no DRAFTING→room route today** | **Deep (client routing)** — ranked host must route DRAFTING to the room | `LeagueParticipantView.jsx:177,188` |

### 3.3 The seam, in one sentence

Making the live draft the competitive default = **point the competitive formation entry (`lobby-quickplay.js` / the multi-human lobby-form path) at the interactive-draft initialization (the `formTrainingDraft` body, minus the `isTraining` stamp) instead of stopping at FORMING** — the room, the CPU-pad participant model, and the `AWAITING_OPEN` decoupling are already built; the live-pick CPU logic (`advanceCpuSeats`/`chooseCpuPick`) is seat-driven and already mode-agnostic.

---

## 4. PART 3 — Canonical-open blast radius (THE HEADLINE)

### 4.1 The timing verdict — CONFIRMED (adversarially verified)

**A live competitive draft is a lifecycle _insert_ that respects canonical-open, NOT a change that reopens the invariant.**

The reasoning, all VERIFIED:

1. **Resolution is already decoupled from baseline capture — today.** The single-shot resolver creates picks with `baselinePrice: null`, `baselineSource: 'draft_resolution'`; *"baselines settle at the next open"* (`resolve-user-draft.js:18-20,160-168`). Draft resolution and baseline capture are **two separate clock events** already.

2. **The baseline is captured only from BATTLE groups, at open.** `runCanonicalOpenSweep` gates on `isMarketOpenAt(now)` (`canonicalOpenSweep.js:213`) and selects **only** `GROUP_STATUS.BATTLE` via the sole exact-equality query `.where('status','==','battle')` (`canonicalOpenSweep.js:221` → `tournamentGroupService.js:152`). **Adversarial verify CONFIRMED:** one selection site, no OR/`in`/fallback; `'drafting' !== 'battle'` so DRAFTING is excluded by construction.

3. **A group reaches BATTLE only with final picks.** BATTLE is written only by (i) the single-shot resolver from committed boards, or (ii) the completion handoff after all 12 picks are materialized (`trainingLifecycle.js:474-482`, `501-528`). A mid-draft DRAFTING pod is never BATTLE. **⇒ Picks are always final before the sweep captures — by construction.**

4. **`AWAITING_OPEN` absorbs any draft timing.** A draft completing at any hour computes `nextMarketOpenAnchor(now)` and parks in `AWAITING_OPEN`; the orchestrator morning tick flips it to BATTLE once the anchor date arrives; the sweep captures at that open (`trainingLifecycle.js:146-152,317-324,541-562`). The draft does **not** race the 9:30 bell.

5. **The cron window has NO 9:30 self-guard — and it doesn't need one.** The orchestrator cron `*/10 11,12,13,14,21,22,23 * * 1-5` (`vercel.json:163`) morning arm is UTC 11:00–14:50. **Adversarial verify CONFIRMED both DST arms straddle 9:30** (EDT 07:00–10:50 ET, open=13:30 UTC; EST 06:00–09:50 ET, open=14:30 UTC). The router `getDutyForInstant` splits only at ET-noon (`MORNING_END_MIN=12*60`, `tournamentOrchestrator.js:111,119-127`), so every Monday morning tick — pre- **and** post-open — routes to `MONDAY_PIPELINE`. The resolve path has no `America/New_York`/9:30 guard (whole file read). This does **not** threaten the baseline, precisely because capture is decoupled to the BATTLE-only sweep (steps 1–4).

**The residual timing question is product, not integrity:** if a competitive live draft must start the **same day's** battle, it must complete before 9:30 ET so its anchor is today; a draft completing after 9:30 anchors to the **next** trading day (battle starts a day later). Either way the baseline is captured cleanly at the open the pod actually enters BATTLE for. **No baseline invariant is reopened in either case.**

### 4.2 The `status==='battle'` firewall — the structural protection

Every score-of-record / gameplay consumer gates on `status === GROUP_STATUS.BATTLE`. A DRAFTING/AWAITING_OPEN pod is invisible to all of them. Enumerated, VERIFIED:

| Consumer | Gate | ⚑ FENCE? | Citation |
|---|---|---|---|
| Canonical-open sweep (baseline capture) | `fetchEligibleGroupsByStatus(BATTLE)` | **⚑ FENCE** | `canonicalOpenSweep.js:221` |
| Banking (score of record) | `status!==BATTLE → skip`; `.where('status','==','battle')` | **⚑ FENCE** | `tournamentBanking.js:361,390`; `bank-daily-scores.js:71` |
| Agent ledger / exclusivity | `status!==BATTLE → sentinel`; `.where('status','==','battle')` | **⚑ FENCE-adjacent** | `tournamentAgentLedger.js:324,735` |
| Agent boards / draft | `status!==BATTLE → not_battle` | ⚑-adjacent | `tournamentAgentBoards.js:405`; `tournamentAgentDraft.js:85,196` |
| User claims (overnight) | `.where('status','==','battle')`; recheck | — | `tournamentClaims.js:83,121` |
| CPU claims | `status!==BATTLE → skip` | — | `tournamentCpuClaims.js:109,123,179` |
| In-battle flips | `status!==BATTLE → not_battle` | — | `flip.js:139` |
| Claim placement | `BATTLE || (isTraining && AWAITING_OPEN)` | — (see §4.3) | `place-claim.js:90-91` |
| Process/reconcile/place-cpu | `status!==BATTLE → skip` | — | `process-claims.js:38`; `reconcile-ledger.js:45`; `place-cpu-claims.js:50` |
| Leaderboard | `fetchEligibleGroupsByStatus(BATTLE,{excludeTraining})` | — | `tournamentLeaderboard.js:290,321` |
| Advancement | `fetchEligibleGroupsByStatus(BATTLE)` | — | `tournamentAdvancement.js:241` |
| Agent capabilities / activation | `status===BATTLE` | — | `agentCapabilitiesManifest.js:101`; `activate-training-pod.js:68` |

**Consequence:** the DRAFTING phase sits entirely *in front of* this firewall. The score-of-record correctness blast radius of inserting DRAFTING is **structurally near-zero** — no BATTLE-gated consumer acts on a non-BATTLE group. The protection is *indirect* (BATTLE-status is the proxy for pick-finality; the sweep has no independent draft-complete assertion — `canonicalOpenSweep.js:77`), so the eventual build's fence obligation is to **preserve the "BATTLE ⇒ picks final" invariant**, i.e. never write BATTLE with an incomplete draft. Both existing writers already honor this.

### 4.3 The training-only assumptions a competitive DRAFTING phase must renegotiate

These are the real edits — none touch the crown jewel's math; they lift `isTraining`/status assumptions:

| Contact point | Today | Competitive requirement | ⚑ FENCE? | Citation |
|---|---|---|---|---|
| `LEGAL_TRANSITIONS` | Already permits DRAFTING/AWAITING_OPEN edges | **No table change**; the comment invariant "DRAFTING only via training" stops holding | No | `tournamentGroupService.js:41-47` |
| **DRAFTING writer** | `formTrainingDraft` hardcodes `isTraining:true` + CPU pad; sole writer | New competitive writer (real humans + CPU pad, no `isTraining` stamp) | No | `trainingLifecycle.js:340-411` |
| **Idle-abandonment sweep** | Filters `isTraining` → non-training DRAFTING never swept (test-locked) | Competitive abandonment path, or extend the filter with competitive rules | No | `trainingLifecycle.js:578`; test `trainingLifecycle.test.js:461-468` |
| **Client subscription** | `selectMyGroup` = FORMING\|BATTLE only | Add DRAFTING (and likely AWAITING_OPEN) so the competitive client renders the live room / re-entry | No | `leagueTournament.js:530` |
| **One-active-pod guard** | `findActiveTrainingPodForUser` is `isTraining`-scoped | Competitive analog to block a duplicate in-flight pod & surface re-entry | No | `tournamentGroupService.js:87-93`; `leagueTournament.js:547-555` |
| **Ranked host render** | Binary `isForming` split; V2 arena gated on deployed battle → no DRAFTING route | Route DRAFTING→`DraftBoardRoom` in the ranked host (as App does for training) | No | `LeagueParticipantView.jsx:177,188` |
| **Claims-open gate** | `BATTLE || (isTraining && AWAITING_OPEN)` | If competitive parks in AWAITING_OPEN and should accept overnight claims pre-open, widen this (else reach BATTLE first) | **⚑ FENCE-adjacent** (claims = scoring input) | `place-claim.js:90-91` |
| **`AWAITING_OPEN` flip** | `flipAwaitingOpenPods` does **not** filter `isTraining` | **Already reusable** — would flip a competitive AWAITING_OPEN pod for free (favorable) | No | `trainingLifecycle.js:541-562` |
| **Orchestrator Monday pipeline** | Resolves FORMING competitive groups single-shot via `resolveUserDraftForGroup` (default `targetStatus=BATTLE`); `excludeTraining:true` | Decide whether competitive drafts are live-formed pre-Monday or the pipeline drives them; the fallback-board single-shot stays for missed drafts | ⚑-adjacent (deploy timing) | `tournamentOrchestrator.js:411-448,417` |
| **Client status framing** | DRAFTING/AWAITING_OPEN badges/copy are training-surfaced | Competitive desk needs equivalent labels (V2 `arenaStateMap` already maps them) | No | `LeagueDeskParts.jsx:536-540`; `LeagueLobbyRedesign.jsx:336,396`; `arenaStateMap.js:29-42` |

### 4.4 Fence flag for the eventual build

The §7-gated / adversarial treatment applies to: the **canonical-open sweep** (`canonicalOpenSweep.js`, ⚑), **banking** (`tournamentBanking.js`, ⚑), **agent ledger/exclusivity** (`tournamentAgentLedger.js`, ⚑-adjacent), **baseline provenance** (the `baselineSource`/`captureState` shape in `resolve-user-draft.js` + `canonicalOpenSweep.js`, ⚑), and the **claims-open gate** (`place-claim.js:90-91`, ⚑-adjacent — a scoring input). The build must preserve "BATTLE ⇒ picks final" and must not let a competitive DRAFTING/AWAITING_OPEN pod become visible to any BATTLE-gated score-of-record consumer before its draft completes.

---

## 5. Corrections to inherited anchors (BUILD_RULES §3 — anchors drift; re-verified this run)

1. **`LEGAL_TRANSITIONS` is NOT "competitive FORMING→BATTLE-only."** At HEAD it already contains `FORMING→DRAFTING`, `DRAFTING→BATTLE`, and the `AWAITING_OPEN` edges (`tournamentGroupService.js:41-47`). The table needs no change; the assumption to break is the *comment invariant* "DRAFTING reached only by training." (Task prompt described it as FORMING→BATTLE-only.)
2. **An `AWAITING_OPEN` holding state exists** (`leagueTournament.js:92`) — the task's three-phase framing (FORMING→DRAFTING→BATTLE) omits it. It is the load-bearing decoupling mechanism for the timing verdict and is **the single most important asset for a pre-open-safe competitive draft.**
3. **Baseline capture is at NEXT OPEN, not at resolution** — the "single-shot flips FORMING→BATTLE atomically" is true, but the baseline is *not* captured at that flip; it is null-initialized and settled later by the BATTLE-gated sweep (`resolve-user-draft.js:18-20,160-168`). This is why draft timing does not threaten the baseline.

The other cited anchors held: `formTrainingDraft` writes DRAFTING (`:403`, asserts `:397`) and is the sole DRAFTING writer per its header (`:40`); the sweep-protection test is at `trainingLifecycle.test.js:461-468`; `subscribeMyGroup`'s predicate is `selectMyGroup` at `leagueTournament.js:530`.

**Two design-integrity observations (not task bugs, noted for triage per §3):** (a) the canonical-open sweep relies on BATTLE-status as an *indirect* proxy for pick-finality with no independent completeness assertion (`canonicalOpenSweep.js:77`); (b) the ranked host still carries a legacy binary `isForming` split (`LeagueParticipantView.jsx:177`) alongside the newer mode-agnostic `arenaStateMap`, an unreconciled two-path render surface. Neither is in scope to fix here.

---

## 6. Open items for the design phase (not blockers; recommended next reads)

These were surfaced by the completeness critic and are enumeration/verification items the *design* phase should confirm (bodies not fully read this session):

- **Multi-human competitive formation** — the lobby-create/join/matchmake/form path (`api/tournament/lobby-*.js`, `tournamentLobbyService.js`) vs the solo `quickPlay` cold-start, to pin how a short competitive lobby fills CPU-pad seats and where the live-draft init would hook.
- **Tests that lock the current single-shot atomicity** — `resolve-user-draft.test.js` (atomic FORMING→BATTLE), `lobby-endpoints.test.js:218-244` (DRAFTING-with-padding formation), `tournamentLobbyFormation.seam.test.js` (lift-vs-build seam), `tournamentLobbyService.test.js` (quickPlay/CPU pad), `leagueTournament.test.js:1118-1138` (in-flight selection), `tournamentOrchestrator.test.js:797` (AWAITING_OPEN handling). These are the invariants a competitive-default change renegotiates.
- **Client status-label sweep** — `LeagueDeskParts.jsx`, `LeagueLobbyRedesign.jsx`, `leagueTrainingBattleFraming.js`, `TournamentDevScreen.jsx` for every DRAFTING/AWAITING_OPEN framing surfaced as training-only.

---

## 7. STOP

This is a read-only discovery. **No project state was changed.** The three-part map is delivered above; the headline is that the crown-jewel canonical-open baseline system does **not** have to be reopened — the competitive live draft is a bounded insert in front of the `status==='battle'` firewall, the interactive room and the `AWAITING_OPEN` decoupling are already built, and the work is a competitive writer plus lifting a defined set of `isTraining`-only gates. This feeds the competitive-draft design: skeleton-first, with the §7-gated / adversarial treatment on the fence-flagged contact points in §4.4.
