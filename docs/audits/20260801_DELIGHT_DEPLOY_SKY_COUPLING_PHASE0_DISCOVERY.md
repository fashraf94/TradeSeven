# Delight Layer · Task 4 — Signature Deploy (Hold-to-Deploy Sky Coupling)
## Phase 0 — Read-only discovery report

**Spec:** DELIGHT LAYER ARC — Task 4, V1 (July 31, 2026). **Report date:** 2026-08-01.
**Protocol:** BUILD_RULES.md §3 (read-only discovery; `git fetch` first; `file:line` + VERIFIED/ASSUMED markers; defects reported, not fixed; report is a file). Spec §4 = HARD STOP; no code written.

---

## 0. Session preamble (BUILD_RULES §2 / §3)

- **`git fetch origin` — run first this session** (BUILD_RULES §3). Fetch succeeded (many remote branches enumerated).
- **Branch:** `claude/delight-deploy-sky-coupling-0q1kc6` (the designated branch). VERIFIED `git branch --show-current`.
- **HEAD SHA:** `66a4b099d7c0a2284674fea8d061fba753ed6950` — *"Merge pull request #700 … claude/delight-motion-tokens"* (Task 3 merged). VERIFIED.
- **HEAD vs `origin/main`:** identical — `git rev-list --left-right --count origin/main...HEAD` → `0 0`. Branch is freshly aligned with current `main`; the remote branch does not yet exist. VERIFIED.
- **Working tree:** clean (`git status --short` empty). VERIFIED.
- **Read-only:** no project state altered. Only this report is written (to the session scratchpad, then to `docs/audits/` in its own commit per spec §4).
- **Method:** lead analyst read the core files directly; a background verification workflow (5 crux lanes each adversarially re-checked by an independent skeptic + 3 independent defect-hunters) hardened the load-bearing claims. Every citation below was read this session (VERIFIED) unless marked ASSUMED.

---

## 1. Executive verdict table (for the founder)

| # | Phase-0 item | Verdict | One-line |
|---|---|---|---|
| 1 | Hold implementation anatomy | **CLEAR** | Shipped hold = `useHoldToDeploy.js` (1300 ms, `progress` 0..1, phases idle/charging/locked). NON-FENCED. The single dispatch home. |
| 2 | Deploy-CTA census | **CLEAR** | Exactly **6** hold sites, ALL via `useHoldToDeploy`→`HoldToDeployButton`, ALL gated by `isDeployCeremonyOn()`. Dispatch in the hook covers all 6 and nothing else. |
| 3 | Deploy-success signal (§2) | **CLEAR w/ decision** | Deploy metadata carries `{agentBattleId, expiresAt}` at `handleCreateAgentTrainingBattle` — enough for §2(a) optimistic inject. The poll is an **inline closure** (§2(b) needs a nonce/extraction). Founder picks the mechanism. |
| 4 | Accessibility posture | **CLEAR** | Keyboard **Enter/Space bypasses the sustained hold** already (`useHoldToDeploy.js:109`). Coupling deepens no exclusion. |
| 5 | Reduced-motion posture | **CLEAR** | Button accent-fill communicates progress independent of RM; under RM the sky renders one static frame and schedules **no loop**, so intent must (and can) no-op cleanly. |
| 6 | Event feasibility | **CLEAR w/ note** | `window` CustomEvent reaches whichever sky is mounted (mobile `App.jsx:8601` / desktop `App.jsx:8648`). Listener precedent is real; **there is no production dispatch precedent** — `ft-deploy-intent` is the first. |
| — | Fence status | **NON-FENCED (confirmed)** | Every touched file is `src/*`; the §1 fence is entirely `api/*`. Deploy backend / `createAgentBattle` doc shape only CALLED, never edited. |
| — | Flag (D1) | **READY** | `DEPLOY_SKY_COUPLING_ENABLED=false` + SSR-safe `isDeploySkyCouplingOn()` clones the exact `isStarfieldOn()` pattern (`featureFlags.js:1240`). |
| — | Pre-existing defects | **8 filed** | 2 medium (`useHoldToDeploy` lock-timer leak; poll `limit(5)` can hide a live battle → sky reads calm) + 6 low. Reported for separate tasking (§11), not fixed. |
| — | Architecture note | **1 key correction** | The intent `max()` must decorate the sky's **output** at the consumption read, NOT be written into the pure core's `state.speed` (would corrupt the tier-ease anchor). See §8. |

**Bottom line:** the spec's locked design is feasible as written, single-review, client-only, non-fenced. Five founder decisions (below) unblock Phase 1. No hard STOP condition found.

---

## 2. The STOP — decisions requested before Phase 1

**S1 — §2 post-deploy-settle mechanism.** Pick (a) **optimistic append** to `activeAgentBattles` (cleanest; the deploy metadata carries `agentBattleId`+`expiresAt`; site is `App.jsx` `handleCreateAgentTrainingBattle:6546`, where `setActiveAgentBattles` is in scope) or (b) **re-run the existing poll** (the poll is an inline closure in a `useEffect` — needs a nonce dependency or an extraction to re-invoke). Recommendation: **(a)** — no round-trip, self-heals on the next 120 s poll, no new read path. See §5.3.

**S2 — Where is the settle actually *visible*?** During commit the DeployCeremony overlay (opaque `rgba(8,9,12,0.94)` scrim) covers the sky. The starfield stays mounted (screen is still `dashboard`) but is hidden behind the ceremony; the settle is visible on the **"Back to hub"** dismiss path (returns to the dashboard sky) — the "Enter the battle" path navigates away and unmounts the sky. Confirm the intent is "the sky is BATTLE LIVE *whenever the dashboard is next visible*," which (a) satisfies directly. See §5.3.

**S3 — Commit surge vs. deploy outcome, and *is the surge even seen?*** The commit surge fires at **hold completion** (`fireComplete`), *before* the deploy call resolves. On deploy **success** the sky settles to BATTLE LIVE (A5). On deploy **failure** there is no battle, so the sky must fall back like an abort (exhale to current state = RESTING). Confirm: the surge is optimistic; the settle is gated on confirmed success; the failure path routes to the abort-style decay. **Design question the founder should weigh (adversary):** ~450 ms after lock the opaque ceremony overlay (`z:1010`, `rgba(8,9,12,0.94)` + blur) mounts and **occludes the sky**, so the commit surge is largely *unseen*. That makes the **felt signature primarily the hold-charge ramp + the abort exhale** — the two things that happen *before* the overlay. Options: (i) keep the surge as an honest state-machine beat even if brief/occluded; (ii) time the surge into the ~450 ms lock-beat window before the overlay; (iii) accept the ramp+exhale as the signature and treat commit as a quiet handoff. Not a blocker — a feel decision for the SOFT STOP.

**S3b — Hold during a real ENDGAME is invisible (by design — confirm).** `intentCurve` peaks ~1.4 < `SPEED_ENDGAME_PEAK` 2.2, and intent is upward-only `max()`, so if the user is already in an ENDGAME sky (speed up to 2.2) a hold adds *nothing* visible. That is exactly D2's intent ("a hold never outranks a real endgame"), but it means the coupling silently does nothing during a live endgame. Confirm acceptable.

**S4 — Keyboard commit.** `fireComplete` is shared by the pointer hold *and* the keyboard deploy path (`Enter`/`Space`, which has no `charging` phase). Decide whether a keyboard commit also emits the terminal surge (harmless) or the intent channel is pointer-only. Recommendation: emit the terminal event from `fireComplete` regardless (a surge with no preceding lean is a no-op-ish flourish), keep the *progress* stream pointer-only (`start`/`tick`). See §6 and §4.

**S5 — Accessibility scope.** The hold's only *pointer* alternative when the ceremony is on is the keyboard immediate-deploy; there is **no pointer tap-to-deploy** while flag-on (the hold replaces the tap). This is the *shipped* ceremony's posture, not something this task introduces — the coupling neither adds nor removes it. Confirm this is acceptable, or file a separate a11y task; per spec §4(4) the STOP decides task-vs-file. (This is a pre-existing posture, in-scope only to *not worsen* — and it does not.)

*(No spec disagreement to flag; the locked design holds against the code.)*

---

## 3. Item 1 — Hold implementation anatomy

- **Component/handler.** The gesture is the shared hook `src/hooks/useHoldToDeploy.js` (VERIFIED, 153 lines), consumed only by `src/components/Dashboard/deployCeremony/HoldToDeployButton.jsx:23,38` (VERIFIED). One hook, all sites (hook header, `:4-6`).
- **Duration constant.** `HOLD_MS = 1300` (`useHoldToDeploy.js:26`); lock beat `LOCK_BEAT_MS = 450` (`:27`). VERIFIED. (D5: out of scope.)
- **Progress representation.** `progress` state, `0..1`, updated per rAF frame in `tick()` from `(performance.now() - startRef)/holdMs` (`:74-76`). Phases `idle | charging | locked` (`:46`). VERIFIED. **This `progress` is exactly the `{progress:0..1}` the intent event needs — no new derivation.**
- **Dispatch seams (all in this one non-fenced file):** `start()` (begin charge, `:89`), `tick()` (per-frame progress, `:74`), `cancel()` (early release = **abort**, `:99`), `fireComplete()` (**commit**, `:64`). A terminal `{progress:null}` fits `cancel` (abort exhale) and `fireComplete` (commit surge). VERIFIED.
- **Agent-thinking animation trigger.** Hold completion → `onComplete` (= each shell's `handleDeploy`) after the 450 ms lock beat (`:71`). `handleDeploy` sets `ceremonyOpen=true` and mounts `DeployCeremony` **before** the deploy call (`CommandDashboard.jsx:193-195`, `CommandDashboardDesktop.jsx:109`). The "agent-thinking animation" is that ceremony: `DeployCeremony.jsx` → `CeremonyTheater` driven by `useCeremonyStageMachine.js` (5 stages loadout/scanning/brief/portfolio → reveal, `:50,:30-40`). VERIFIED. It is **untouched** by this task (spec §8).
- **Fence.** `src/hooks/useHoldToDeploy.js` is not in the BUILD_RULES §1 fence (all `api/*`). **NON-FENCED.** VERIFIED.

## 4. Item 2 — Deploy-CTA census

Every deploy hold in the app (VERIFIED via exhaustive grep of `HoldToDeployButton`/`useHoldToDeploy`):

| # | File:line | Variant | Platform | Handler |
|---|---|---|---|---|
| 1 | `CommandDashboard.jsx:381` | filled | mobile | `handleDeploy` |
| 2 | `CommandDashboard.jsx:428` | muted ("without previewing") | mobile | `handleDeploy` |
| 3 | `DeployStation.jsx:27` (mounted `CommandDashboard.jsx:482`) | filled | mobile | `onDeploy`→`handleDeploy` |
| 4 | `desktop/DeployCard.jsx:38` | filled | desktop | `onDeploy`→`handleDeploy` |
| 5 | `desktop/ReadColumn.jsx:136` | filled | desktop | `onDeploy`→`handleDeploy` |
| 6 | `desktop/ReadColumn.jsx:183` | muted ("without previewing") | desktop | `onDeploy`→`handleDeploy` |

- **All 6 render only when `isDeployCeremonyOn()`** and route through `HoldToDeployButton`→`useHoldToDeploy`. Flag/ceremony-OFF each renders its byte-identical tap `<motion.button onClick=…>` (e.g. `DeployStation.jsx:39-53`). VERIFIED.
- **Coupling coverage is automatic and exactly-scoped** — *contingent on where dispatch is placed.* Because `useHoldToDeploy` has exactly one consumer (`HoldToDeployButton`), placing the dispatch **in the hook** makes the intent event emitted by these 6 and **nothing else** — the coupling "applies wherever the hold exists" for free (spec §1/§4(2)). This is a design constraint to honor, not yet a fact (`ft-deploy-intent` has zero repo matches today).
- **The listener only ever sees one hold at a time.** filled vs muted at a given surface are mutually exclusive (`SCOUTING_BOARD_ENABLED`/`boardEnabled` gate), and only one dashboard (mobile *or* desktop) mounts — so `StarfieldBackground` need only tolerate a terminal `{progress:null}` from whichever single hold is active. The **keyboard** path (no `charging` phase) must also emit terminal-or-nothing on its `fireComplete` (S4).
- **No new holds (D5).** Every CTA that lacks a hold today keeps none.
- **Non-deploy holds are safe.** The house gesture `src/components/draft/HoldToLaunchButton.jsx` (draft launch) is a **separate** implementation and does **not** import `useHoldToDeploy`, so it will never emit `ft-deploy-intent`. VERIFIED (grep: `useHoldToDeploy` has one consumer, `HoldToDeployButton.jsx`).

## 5. Item 3 — Deploy-success signal & the §2 post-deploy settle

### 5.1 What the deploy returns (`src/services/agentDeploy.js`, VERIFIED)
`deployAgent(agentId, onCreateAgentBattle)` → `POST /api/agent/decide`. Precise shape (adversary-corrected):
- The **HTTP response** `data` carries `agentBattleId`, `expiresAt`, `portfolio`, `bench`, `innerMonologue`, `strategyBrief`, `opponent`, `opponentBench` (`:60-73`).
- `deployAgent`'s **return value** is only `{ success: true, agentBattleId }` (`:77`) — `expiresAt` is **not** in the return; it is forwarded into the `onCreateAgentBattle(portfolio, bench, {agentBattleId, expiresAt, …})` callback (`:61-73`).
- So the **injection site must be the handler**, `handleCreateAgentTrainingBattle` (`App.jsx:6546`), where `agentMeta.agentBattleId` + `agentMeta.expiresAt` + the local `now` (`:6568`, → `activatedAt`) are all in scope — not the shell's `handleDeploy` (which only sees `{success, agentBattleId}`).
- **This does not modify `decide.js` or `createAgentBattle` — it only calls them (`:9`).**

### 5.2 How completion is detected (VERIFIED)
Dual-signal: server stage `complete` in `deployProgress` AND the client's own `deployAgent` success (`useCeremonyStageMachine.js:18-22, :124-129, :154-159`). The shell records the client outcome as `deployResult={status:'success', agentBattleId}` (`CommandDashboard.jsx:206-208`).

### 5.3 The problem & the two mechanisms
The sky's live input is the `activeAgentBattles` poll — an inline closure inside a `useEffect` (`App.jsx:3894-3932`), fired on mount and every `120_000` ms (`:3931`), deps `[screen, isPageVisible]`, query filtered `status=='active'` with `limit(5)`. So a freshly-deployed battle may not surface for up to 120 s → the feared surge→RESTING→(later)BATTLE-LIVE sequence.

- **§2(a) optimistic append (recommended).** `activeAgentBattles` lives in `App.jsx:2348`; `starfieldLiveGames = toLiveGames(activeAgentBattles)` (`:2358`) feeds both skies (`App.jsx:8601/8648`). The deploy metadata (`agentBattleId`, `expiresAt`) is already in scope in `handleCreateAgentTrainingBattle` (`App.jsx:6546-6647`). An injected doc needs shape `{ id: agentBattleId, status:'active', expiresAt, activatedAt:<deploy instant> }` to satisfy `isLiveBattle` (`warpBattleAdapter.js:66-68`, needs `status==='active'`) and `toLiveGame` (`:77-94`, needs `expiresAt` + `activatedAt||createdAt`). Because the poll calls `setActiveAgentBattles(battles)` **wholesale** (`:3917`), a **successful** poll **self-heals** — the real Firestore doc replaces the optimistic entry with no dedup work. **No new read path (D6/A6).** Two caveats: (i) self-heal is only on a *successful* poll — the catch path retains last-known-good and does **not** `setState` (`:3918-3927`), so a transient Firestore error leaves the optimistic entry until the next good poll (harmless — it's a real live battle); (ii) that the doc exists server-side by the time `decide.js` returns `agentBattleId` is **ASSUMED** (`App.jsx:6530-6531` comment asserts it; `api/agent/decide.js`/`agentBattleService.js` are fenced and were not read). If there were write-lag, §2(a) optimistic-append is *more* robust than §2(b) re-poll (which would race the lag).
- **§2(b) re-run the poll.** The poll is not an extracted function, so re-invoking it needs either a `pollNonce` state added to the effect deps or an extraction. Heavier, and it still round-trips. It IS "one extra invocation of the existing read" (spec §6/D6), so it satisfies A6 — but (a) is cleaner and instantaneous.
- **Gate §2 behind the flag (A1).** `handleCreateAgentTrainingBattle` runs on *every* deploy (ceremony-on and -off). The §2 mutation must itself sit behind `DEPLOY_SKY_COUPLING_ENABLED` so a flag-off deploy is byte-identical — note that `activeAgentBattles` also feeds the "No battle live" card (`CommandDashboard`), so an unconditional inject would flip that card early too. Behind the flag, no leak (A1).

### 5.4 Visibility & the failure path (see S2/S3)
During commit the ceremony scrim covers the sky; the settle is felt on **"Back to hub"** (`DeployCeremony.jsx:191` `onDismiss`) which returns to the dashboard sky, and any subsequent dashboard visit. On deploy **failure** the ceremony shows the error surface and **no battle exists**, so §2 must not inject and the sky must decay like an abort — mirroring the abort exhale (D3), not settling to BATTLE LIVE. So **A5's "lands on BATTLE LIVE" is specifically the success path.**

## 6. Item 4 — Accessibility posture (VERIFIED)
- **Alternative to sustained press EXISTS today:** `onKeyDown` on `Enter`/`Space` **bypasses the 1300 ms hold** and calls `fireComplete()` directly (`useHoldToDeploy.js:109-116`) — "holding is a pointer affordance, not a security gate" (`:16`). Precision (adversary): this is not *synchronous* — `fireComplete` still runs the 450 ms lock beat before `onComplete` (`:64-72`). Net: a keyboard user deploys without the sustained press. So the coupling **deepens no existing exclusion** (spec §4(4)).
- **Flag-off is byte-identical:** primarily because the **consumer ternary renders a different element** — the tap `<motion.button onClick=…>` when `!ceremonyOn` (e.g. `DeployStation.jsx:26-54`); the hook's `bind === {}` when inactive (`:140-150`) is a secondary safety net. Guarded by the existing `DeployCeremonyHold.smoke.test.jsx` (flag-off renders the tap CTA, no hold marker).
- **Note (S5):** when the ceremony is ON, the only *pointer* path is the hold (the tap button is replaced); the keyboard path remains. This is the *shipped* ceremony's posture; the coupling neither worsens nor fixes it.

## 7. Item 5 — Reduced-motion posture (VERIFIED)
- **Progress is communicated by the button, independent of the sky.** `HoldToDeployButton` grows an accent fill `width: ${progress*100}%` (`:76, :106`); while charging `fillTransition='none'` so it **snaps per-frame** regardless of `prefers-reduced-motion` (`:45`). So a reduced-motion user is never progress-blind (A4).
- **The sky no-ops cleanly under RM.** `resolveLoopPlan({reducedMotion:true})` → `{shouldSchedule:false, shouldDrawOnce:true}` (`warpStateMachine.js:487-491`); the component paints **one static frame and starts no loop** (`StarfieldBackground.jsx:422-428`). With no rAF loop there is nothing for intent to modulate, so `ft-deploy-intent` must no-op. **Design constraint (adversary):** the no-op is only half-guaranteed by the missing loop — accidental *loop scheduling* is architecturally prevented, but an accidental *repaint* is a real hazard if the intent listener does `setState`/`paint`. **So the intent listener must be a pure `intentRef` write (never `setState`, never a `paint()` call)** — then under RM (no loop reading it) it is genuinely inert. The RM source follows the house injected-boolean pattern (`resolveLoopPlan`/`motionToken({reducedMotion})`).
- **The ceremony has its own RM variant.** `CeremonyChecklist.jsx` is the "Deploy Ceremony · Act 2, reduced-motion variant (spec §9)" (`:3`; selected at `DeployCeremony.jsx:111-130` via `useReducedMotion`), so the *commit handoff* already degrades under RM independently of the sky.

## 8. Item 6 — Event feasibility (VERIFIED)
- **Channel:** a `window` CustomEvent reaches whichever sky is mounted regardless of DOM ancestry — no prop drilling through `App`. Both mounts add their own `window` listener; exactly one sky is mounted at a time (mobile branch `App.jsx:8589→8601`, desktop branch `App.jsx:8640→8648`). The deploy button and the sky are co-mounted under a shared dashboard container, both present on the `dashboard` screen (exact ancestry in the third bullet).
- **Listener precedent is real:** `StarfieldBackground.jsx:204-210` already `window.addEventListener('ft-accent-changed', …)`. The `animate` loop reads mutable refs each frame without resubscribing (`tintRef` pattern, `:212-213, :288`), so an `intentRef` set by the listener would be consumed by `advanceWarp` with no loop restart — and would not trip `starfield.depstability.test.jsx` if kept in a mount-once effect like the tint one.
- **Not "siblings" — co-mounted under a shared ancestor.** Precise correction (adversary): the starfield is a **direct child** of the dashboard `containerStyle` div (`App.jsx:8595→8601` mobile, `8642→8648` desktop) while `HoldToDeployButton` is a **deep descendant of the sibling `DashboardComponent`** (`:8603`). They are co-mounted under a shared ancestor on the `dashboard` screen, **not** DOM siblings — which is precisely why the **window-scoped** event is the right channel: DOM ancestry is made moot.
- **⚠ No dispatch precedent.** Repo-wide there are **zero** production `dispatchEvent`/`new CustomEvent` calls (grep: only tests dispatch — `starfield.tint.test.jsx:176` fires `new Event('ft-accent-changed')`, and `ft-accent-changed` has **no** dispatcher at all — the starfield listens speculatively for a *future* accent-picker). So `ft-deploy-intent` would be the **first production CustomEvent dispatch** in the app. Not a blocker (standard web API; SSR-safe with a `typeof window` guard) — but the "precedent" cited in the spec is **listener-only**, there is no house dispatch wrapper, and the payload needs `new CustomEvent('ft-deploy-intent', { detail:{ progress } })` (the test precedent uses payload-less `new Event`). This raises the value of the A3 event-contract rows and the Phase-3 header documentation.
- **⚠ INTENT seam — apply `max()` at the OUTPUT/consumption, NOT inside the core state (adversary correction, load-bearing).** The tempting placement — write `max(stateSpeed, intentCurve(progress))` into `advanceWarp`'s returned `state.speed` (`:460-473`) or into `targetSpeed` (`:352-361`) — is **wrong**: `advanceWarp` re-anchors easing on `anchorSpeed = prev.speed` (`:448`) and picks `resolveEaseMs` off `prev.speed`/`prev.tier` (`:395-399`), so an intent-inflated `state.speed` would corrupt the 15 s tier-ease / 30 s decay anchor and the target-moved detection (`:440`). The correct realization of Amendment C's "**intent decorates the machine's output, never changes tier**" is an **output overlay at the consumption read** — `StarfieldBackground.step` computes `const speed = warpRef.current.speed` (`:357`); the coupling makes that `const speed = max(coreSpeed, intentDisplaySpeed)`, leaving the pure core's internal `speed`/`anchorSpeed` untouched. The intent overlay carries its **own** transient easing state (a ref: current intent speed, for the abort exhale D3 + commit surge D4). For A2 pure-row testability, put the overlay math in a **new pure function** in `warpStateMachine` (e.g. `applyIntent(coreSpeed, intentState, now) → displaySpeed`) called at the consumption seam — pure and unit-rowed, but never fed back into the tier machine. `intentCurve` peak must stay below `SPEED_ENDGAME_PEAK=2.2` (`WARP_TUNING:68`); LIVE=0.5, RESTING=0.12 (`:65-66`).
- **These are canvas easings, not Framer.** The intent curve / exhale / surge are tuning-exempt numeric easings in the rAF core — they do **not** consume the Task-3 `motion.js` tokens and do **not** trip `motion.guard.test.js`. (Note: `motion.js:38,112` labels the `gesture` token "Task 4's foundation"; that label predates the drag→hold pivot — the coupling does not actually use `gesture`. A one-line doc note, not a fix.)
- **Intent wiring must not restart the field.** The mount effect's dep array (`StarfieldBackground.jsx:468`) includes `animate`; the intent listener + `intentRef` must be a stable `useRef` written in a **mount-once** effect (like the tint one), never a new `useCallback` dependency — else the field regenerates (guarded by `starfield.depstability.test.jsx`).

## 9. Design-decision feasibility (D1–D6)
- **D1 flag:** clone `isStarfieldOn()` exactly — `export const DEPLOY_SKY_COUPLING_ENABLED = false;` + `isDeploySkyCouplingOn()` guarding `window` with a `?deploySkyCoupling=1` URL override and try/catch (`featureFlags.js:1240-1248` is the template; the Phase-1 SOFT-STOP preview uses that URL param, per house pattern). Flag-off ⇒ hook dispatches nothing ⇒ byte-identical (A1). The eventual flip PR reconciles its own pins in-commit (BUILD_RULES §2/§11).
- **D2 curve / D3 abort exhale / D4 commit surge:** all realizable as tuning-exempt constants in `warpStateMachine`; peak < 2.2 confirmed available.
- **D5 hold duration:** untouched (`HOLD_MS`).
- **D6 no new read paths:** §2(a) is state mutation, §2(b) is one extra invocation of the existing poll — both satisfy A6.

## 10. Acceptance-matrix readiness (A1–A7)
- **A1** flag-off inert — surface exists (`DeployCeremonyHold.smoke.test.jsx` + a dispatcher guard mirroring `starfield.inert.test.jsx`). READY.
- **A2** pure intent rows (monotone, `max()`, abort-exhale bound, terminal clears, peak<endgame) — belong in `warpStateMachine.test.js` (the pure-core test home). READY.
- **A3** event contract (shape `{progress}`, terminal `null`, malformed ignored) — dispatch+listen; the test-dispatch pattern already exists (`starfield.tint.test.jsx:176`). READY.
- **A4** reduced-motion no-op + button still shows progress — pure rows + manual gate. READY (see §7).
- **A5** post-deploy settle lands on BATTLE LIVE without a RESTING dip — unit row on the §2 mechanism (success path) + feel-pass observation. READY once S1 picked.
- **A6** no new Firestore read paths — the existing import/callgraph guard continues. READY.
- **A7** founder feel gate — manual, recorded in the flip PR.

## 11. Pre-existing defects (BUILD_RULES §3 — reported, NOT fixed; filed for separate tasking)

None are introduced by this task; all pre-date it. Listed most-actionable first. #1–5 sit on files the coupling extends (relevant context for the implementer); #6–8 are on the deploy/poll data path the §2 settle hooks into.

| # | Sev | File:line | Defect |
|---|---|---|---|
| D-1 | **med** | `useHoldToDeploy.js:99-107` | **Same-frame release during auto-completion leaks the lock timer.** `phaseRef` is render-assigned (`:55`); when `tick()` hits `p≥1` it calls `fireComplete()` (schedules `lockTimerRef→onComplete`, `:71`) but React hasn't committed `phase='locked'` yet, so a `pointerup` in that ~1-frame window runs `cancel()`, which passes the stale `phaseRef==='charging'` guard, resets to `idle`/`progress:0`, but **never clears `lockTimerRef`** — so `onComplete` (the real deploy) still fires ~450 ms later while the button reads un-pressed, and can fire into the middle of a *new* hold started in the gap. |
| D-2 | low | `useHoldToDeploy.js:119-121` | **Off-switch asymmetry.** The abort effect reacts only to `disabled`; flipping `enabled`→false mid-charge neither stops the rAF (`tick` never re-reads `enabled`) nor lets the user cancel (`bind` becomes `{}`, stripping `onPointerUp`), so the hold runs to completion and fires a spurious `onComplete`. Latent (all 6 sites toggle `disabled`, not `enabled`) but real for a future caller of this reusable hook. |
| D-3 | low | `HoldToDeployButton.jsx:40,45` | **Early-release label flash.** On release from >45%, `flipped` recomputes off the snapped-to-0 `progress` (label/icon color → `accent`), while the fill span drains over `width 250ms ease` — so for ~250 ms accent-colored text sits over the still-covering accent fill and is unreadable. |
| D-4 | low | `StarfieldBackground.jsx:413-414` | **RM toggle mid-session resets the warp state.** `reduce` is the only runtime-variable dep of the mount effect (`:468`); a live `prefers-reduced-motion` flip re-runs it, calling `createWarpState()`/`createStars()` — a live ENDGAME sky snaps to RESTING then re-ramps (calm-then-resurge discontinuity unrelated to game state). |
| D-5 | low | `StarfieldBackground.jsx:403` | **Dev-override clock re-anchored on every effect re-run**, contradicting the "anchored ONCE" invariant (`:216-223`): an RM flip during `?warpState=endgame` restarts the countdown. Dev-instrument only. |
| D-6 | **med** | `App.jsx:3901-3917` | **Poll `limit(5)` (no `orderBy`) applied BEFORE the client-side training-clone filter can drop a live ranked battle.** A user with ≥5 active training-clone battles can have `limit(5)` return only clone docs; the client filter (`:3914-3916`) drops all 5 → `activeAgentBattles=[]` while a genuine ranked battle is live → dashboards read `isLive=false` (re-enabling deploy) **and the battle-weather starfield reads calm during a live battle.** Directly undermines the coupling's data source and the §2 settle. |
| D-7 | low | `App.jsx:3933` | **Poll effect deps `[screen,isPageVisible]` omit user/auth** (the sibling training poll at `:3888` includes `user`). Cold-load auth-not-ready → initial fetch bails and isn't retried until the 120 s tick; an account switch on the dashboard retains the prior user's battles. |
| D-8 | low | `App.jsx:6567,6575` | **A successful server-side deploy can surface as a client error.** `handleCreateAgentTrainingBattle` guards `agentMeta?.` (`:6552`) but then dereferences `agentMeta.agentId` (`:6575`) and `user.odUserId` (`:6567`) unguarded; a nullish `user` (momentary during re-auth) throws a `TypeError` *after* the battle exists server-side — both shells then render the error surface for a live battle that now holds the one-active-battle lock (the G2 lock-out hazard, `CommandDashboard.jsx:165-171`). |

## 12. Doc-hygiene notes (report-only, not this task's to fix)
- `StarfieldBackground.jsx:16-17` header cites mount sites `App.jsx:8631`/`8584`; actual current mounts are `8648`/`8601`. `featureFlags.js:1225` docstring likewise cites `8631`. Line drift — re-verify before relying (BUILD_RULES §3).
- The deploy path the coupling *calls* is not entirely write-free: `handleCreateAgentTrainingBattle` fires a **fire-and-forget** `updateDoc` on `agentBattles/…/portfolio.startingPrices` (`App.jsx:6621-6631`, `.catch(()=>…)`). Pre-existing; **not** the fenced `createAgentBattle` *creation* shape; the coupling adds no such write. Whether `startingPrices` counts as a §5 Signal-Capture-Rider "catalog event" (which forbids fire-and-forget) is out of scope here but may warrant separate triage.

## 13. Method note
Lead analyst read every core file directly (VERIFIED). Background verification workflow `wf_7a2d2d08-51f` (13 agents, 0 errors): 5 crux lanes (fence, census, settle, a11y/RM, event) each adversarially re-verified by an independent skeptic — **all five upheld** (fence/census/settle CONFIRMED; a11y-rm PARTIAL with the keyboard-lock-beat + RM-repaint refinements folded; event's corrections independently CONFIRMED) — plus 3 independent defect-hunters (8 defects, §11). No lane was refuted; every correction is incorporated above.
