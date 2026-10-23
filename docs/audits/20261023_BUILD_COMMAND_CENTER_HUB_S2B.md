# Build report — Command Center hub, slice S2b

Claude Code (Opus 5.5, no advisor; review lenses and the mutating lens on Sonnet 5.5, refuters on Opus 5.5), October 23, 2026, for Flash. The build prompt was the founder's "Command Center — slice S2b: the attempt provider, the hold, and the real deploy" of October 23, with rulings R-S2b-1 … R-S2b-10. This report covers S2b only. It makes a hub deploy real, behind `COMMAND_CENTER_HUB_ENABLED = false`, which stays false:
- a root deploy-attempt provider at App's root;
- the hub's three hold controls through an opt-in seam on the shipped hold hook;
- the due-idea screen, the root ceremony and the real deploy service;
- existing, refused and uncertain handling, with the owned targeted read;
- a committed beat that survives navigation and a width change.

With the flag off, today's shells, their ceremony and every deploy a player makes today behave as before, except the two deliberate live changes of R-S2b-9 (§6).

## Verdict

| Item | Result |
|---|---|
| **Status** | **Draft PR, STOP.** Nothing merged; nothing activated |
| Branch and head | `claude/command-center-hub-s2b`, cut from `main` `82ea84bb` (fetched; clean tree). Code head `e906d07a` (the last source change; the fix round). Test-only commits `43808d37` and `bc3fc32e` follow; the commit after them adds only this report and its README row. Commits: `cb170e96` build, `8b2eb835` rows, `e906d07a` fix round, `43808d37` and `bc3fc32e` W5 rows |
| Stop rule | No STOP. Today's shells changed only by R-S2b-9 (a) and (b). No pre-existing behaviour test was edited (only guard manifests and theme registrations, §5). The recovery admission is byte-identical. No fenced file and nothing under `api/` was touched |
| R-S2b-1 · the provider | `src/contexts/DeployAttemptContext.jsx`, wrapping the screen router in App's unified return; App's callbacks are its bridge. Flag off it is a pass-through, read once at mount (§3). This deviates from spec §2's `main.jsx` placement, as the ruling directs |
| R-S2b-2 · one record | S2a's reducer, with the identity source's auth epoch and three new hold actions. Every `begin` is asked of the hub's own §3.1 table: `canStart` for a tap, `canCommit` at the hold's threshold, the selector's `retry` for a Retry. The live list is read only through `ownedLiveList` |
| R-S2b-3 · the hold | `claimHold(controlId, inputId, holdEpoch)`. An opt-in `holdSeam` on `useHoldToDeploy` (claim, commit, release, progress); the provider is the hub controls' `beatOwner`; there is a synchronous cancel entry. A denied second finger no longer cancels the first (R2 Q5). Progress goes to an owner-tagged store. Today's shells are unchanged |
| R-S2b-4 … R-S2b-6 | The shells' steps, owned by the provider: the due-idea screen before any call; the root ceremony; `deployAgent(…, { isCurrent })`. Every outcome is mapped by §5.2. The existing answer gets one owned targeted read with an 8 s deadline and a 30 s Retry wait. Uncertain attempts reopen only by reconciliation; nothing replays itself; the review-due refusal's action opens the Forge |
| R-S2b-7 · the Scouting Board | "See what it's eyeing" opens the shipped sheet, registered `within` the stack. Its deploy is a tap through the provider's guard |
| R-S2b-8 · lifetime | One attempt and one ceremony across navigation and a site flip during submitting or the beat. A charge cancels on area change, overlay, hidden, blur and identity change. The root's unmount revokes everything. The runtime disable is injected |
| R-S2b-9 · the two live changes | (a) FR-1: an existing answer behind the watchdog now ends on the existing terminal. (b) The 429 "Deploy already in progress" reads "A deploy is already in progress." Each has failing-first rows; the admission and reveal branches have unchanged control rows (§6) |
| R-S2b-10 | No `hubProps` key was needed: the hub reads the provider through its context. Additions only in the shared hub files (§3) |
| Flag-off build | 43 chunks in both; 41 identical. The entry chunk is +38,452 B raw (+12,432 B gzip): the provider and the hub selectors it runs. The hub chunk is −3,506 B. No hub preload in `index.html` (§9; Q-S2b-1) |
| Tests | Full suite on Linux, CI-shaped at `bc3fc32e`: `Test Files  1153 passed \| 8 skipped (1161)`, `Tests  24958 passed \| 89 skipped (25047)`, exit 0. S2b adds 164 rows in nine new files (§4); no pre-existing behaviour test was edited |
| Mutation | W5 planted **318** mutants on the guards behind the acceptance rows (claim, commit, begin, every identity check, the uncertainty guard, the due-idea gate, the beat, the pass-through, the live changes). Final: **224 killed**, 94 equivalent survivors (each with its reason), 0 open gaps. All 70 gap survivors were closed by rows, and their kills were re-run and confirmed (§8) |
| `vite build`, `lint:gate` | Both exit 0 on Linux at `bc3fc32e`; both re-run at the pushed head (§7; PR description) |
| §2 review | Five lenses (W1 parity, W2 ownership, W3 hold and beat, W4 outcomes, W5 test integrity and mutation), with Opus refuters on every MAJOR/BLOCKER claim. 30 findings. The refuters ruled on five claims: 2 CONFIRMED (W2-1 MAJOR, W4-2 BLOCKER for the flip), 3 PARTLY (W3-1, W4-1, W4-3), 0 REFUTED. Every finding is fixed except W2-5 (outside scope) and W4-3 (Q-S2b-5) (§8) |
| Fenced files, `api/` | No fenced file edited. Fenced functions called: none directly. The service the provider calls (`deployAgent`) POSTs to `api/agent/decide.js`, as today's shells do. Nothing under `api/` changed |
| Founder questions | Q-S2b-1 … Q-S2b-7 (§10); none blocks the draft |

## 1. Branch, HEAD and preamble

- Started with `git fetch origin`. The worktree was created by the app on `claude/loving-driscoll-04713e` at `82ea84bb` (= `origin/main`, the S3 merge #992). The new branch `claude/command-center-hub-s2b` was cut there; the tree was clean.
- `main` was fetched again before the final checks and had not moved (`82ea84bb`), so the final checks ran on the branch head itself (§7).
- Model setup as the prompt set it:
  - the build on Opus with no advisor;
  - lenses W1–W5 as Sonnet subagents, each on its own LF `git archive` snapshot;
  - Opus refuters on their own snapshots for every MAJOR or BLOCKER claim.
- Linux checks ran in `~/pd-ci`, the one reusable WSL clone. The branch was fetched in from the Windows repo. The lockfile was unchanged, so there was no `npm ci`. Node 20.20.2, `TZ=UTC`, CI-shaped `--maxWorkers=2`.

## 2. Starting check (BUILD_RULES §3)

Every anchor the prompt names was re-read at `82ea84bb` (VERIFIED, lines at that commit):

- **The legacy deploy path.** `CommandDashboard.jsx` `handleDeploy` is at :255–323:
  - the due-idea gate (`checkDueIdea` :268, `DueIdeaInterstitial` :690);
  - the ceremony opened before the call (:287), then `deployAgent(agent.id, onCreateAgentBattle, reportDeployTarget)` (:291);
  - `isOrphanedResult` / `deployResultFor` (:309–310), the ceremony-off existing open (:311–321), the Retry remount (:333–338);
  - the `<DeployCeremony>` mount at :692–708.

  The desktop twin is `CommandDashboardDesktop.jsx`, with `handleDeploy` at :168 and the ceremony at :426. Neither shell passes `attemptId` or `onPhaseChange`.
- **The service.** `deployAgent(agentId, onCreate, onTarget, { isCurrent })` (`agentDeploy.js:100`; `isCurrent` must be a function, fail-closed :112–119); `deployIdentity.js signedInUid`; `deployOutcomes.js`; `deployResult.js`; `deployHandoff.js`.
- **Identity.** `authIdentity.js`: `useAuthIdentity`, `readAuthIdentity`, `subscribeAuthIdentity`, `isCurrentIdentity`. Reused; no second source.
- **The ceremony:**
  - `DeployCeremony.jsx` props at :49–53 (`attemptId`, `onPhaseChange`, `deployResult`, `targetAgentId`, `onEnterBattle`, `onDismiss`, `onRetry`, `liveBattles`, `onOpenBattle`).
  - `useCeremonyStageMachine.js`: the recovery admission is :352–378 (its comment block from :314); the latch is :401; the `existing` branch :417–421; the watchdog :509–525.
  - `CeremonyError.jsx` lost-contact copy at :45–48; `existingBattle.js`; `agentBattleVerify.js findActiveBattleForAgent` (target-scoped, :97).
- **The hold:**
  - `holdClaim.js claimHold(controlId)` (:42; no input or epoch);
  - `useHoldToDeploy.js`: the `onCommit` / `beatOwner` seams, `HOLD_CLAIM_SAFETY_RELEASE_MS` (:197);
  - `HoldToDeployButton.jsx`, which forwarded neither;
  - `HubHold.jsx`, live only with `canStart && onDeploy`;
  - the row pinning it inert: `CommandCenterHub.s3.jsdom.test.jsx:378`, which renders without a provider and stays true and green, unmodified.
- **The hub:**
  - `hubProps` at `App.jsx:8792`, gates at :8991 and :9064;
  - `useHubRuntime.js`; `HubOverlays.jsx`; `overlayStack.js` (its header contract); `useHubReaders.js`;
  - `hubDate.js lastDeployedAtMs` (:79); `ScoutingBoardSheet.jsx` (the `EquipSheet` wrapper);
  - the three hub guards.
- **App's root.** The unified return is at :10298, inside `App()` after the onboarding returns; `handleCreateAgentTrainingBattle` :6775, `handleEnterCeremonyBattle` :6757, `handleOpenAgentBattle` :6963.

Two facts shaped the build:
- (1) The S2a reducer has no action that sets its `hold` record, so S2b adds three.
- (2) The reducer's `authEpoch` was its own counter, while reader results carry the identity source's epoch. S2b makes the reducer take the source's epoch, so the two always agree.

Stop rule: recorded and continued; nothing in it applied.

## 3. The rulings as applied, and the builder's interpretations

**R-S2b-1 · the provider at App's root** (`src/contexts/DeployAttemptContext.jsx`; App `:10352`):
- `DeployAttemptProvider` reads the hub flag once, at mount, through `isCommandCenterHubOn()` (:780). Rows inject `hubEnabled`.
- Off, it returns its children: no reducer, subscription, timer, listener or ceremony (`DeployAttemptContext.flagOff.jsdom.test.jsx`).
- App passes its callbacks as the bridge: `onCreateAgentBattle`, `onEnterBattle`, `onOpenBattle`, `refreshActiveBattles`, a new id-scoped `clearCeremonyStash` (`App.jsx:6746`) and `userName`.
- App's `isCommandCenterHubOn()` count stays one, so S0's guard row holds.
- **Deviation recorded:** spec §2 places the provider in `main.jsx`; the ruling places it in App's root.
- **Interpretation:** the provider is inside App's unified return, so App's onboarding gate (agent loading or absent) unmounts it. That happens only at sign-in or when the agent first resolves, never during navigation or a width change, and an unmount revokes everything (§5.4).
- **StrictMode:** the development re-mount revokes the first runtime before any attempt can exist; the provider then starts a fresh one (:801).

**R-S2b-2 · one record:**
- **Authority.** The reducer is S2a's `attemptReducer`, in a ref, so a second press in the same tick sees the guard. Before every `begin` the provider asks `deriveHubDeployState` of the hub's own inputs: they are registered by `hub/useHubDeploy.js`, with the identity read now and the provider's attempt, hold, cooldown, clock and overlays added.
- **Dispatches:**
  - `authChanged` on every identity change, synchronously, from `subscribeAuthIdentity`;
  - `orphanCleaned` with the orphan's epoch;
  - `cooldownEvidence`, from the service body's `retryAfter` (seconds; `cooldownFromResult` :364) and from recorded `lastDeployedAt` values: the deploy target's document (`TargetEvidence` :877) and the ranked agent's own read (`useHubDeploy.js:60–74`, owner-gated).
- **The hub's selector inputs.** `useHubReaders(hub, deployAttempt, hubModalOpen)` adds the provider's half through `attemptInputsOf` (`readerInputs.js:97`), still with one identity read.
- **The live list** reaches the provider only as `ownedLiveList`. After every settled deploy the provider calls `refreshActiveBattles()`.
- **Reducer additions** (hub-owned):
  - `initialAttemptState({ uid, authEpoch })`;
  - `authChanged` with the source's epoch (a stale report changes nothing);
  - `holdClaimed`, `holdCommitted`, `holdReleased`;
  - `begin` stamps the hold it admits with the attempt id, so a late release cannot drop it.

**R-S2b-3 · the hold:**
- **The claim.** `claimHold(controlId, inputId, holdEpoch)`; a malformed input or epoch grants nothing. The copy carries both fields; the one-argument form is byte-identical.
- **The seam.** `useHoldToDeploy`'s opt-in `holdSeam` is `{ claim(controlId, inputId, cancel), commit(token), release(token), progress(token, p) }`:
  - the seam's bind ignores a pointer that does not own the charge (R2 Q5);
  - a key claims with input `key` and snaps the rail (`lockedByKey`);
  - after the run, the control's display follows the provider's record.
- **Without a seam,** every line of the legacy path behaves as before, and the four sky tests and R2's 116 rows pass unmodified.
- **`HoldToDeployButton`** forwards `controlId`, `onCommit`, `beatOwner`, `holdSeam`.
- **The provider's side:**
  - claim: `canStart`, then the slot, then the record;
  - commit: `canCommit`, then `commitHold`, then the record;
  - `beatOwner.commit` keeps the 450 ms beat (`LOCK_BEAT_MS`, now exported) and runs or releases it on every exit (R2 FR2-5);
  - `cancelCharging` is the synchronous cancel entry (R2 FR2-4). It is called by an overlay opening (`HubOverlayProvider onOpen`), a tab or area change, an identity change and a runtime disable.
- **Progress** goes to an owner-tagged store read by the status line's aria-hidden percentage (`ShadowStage.jsx HoldPercent`). The live region announces phases only: "Holding to deploy", "Locked in", "Submitting your deployment".
- **The controls.** The three hub controls (card, strip, the first-deployment next action) pass the provider as `beatOwner`. A control stays live while its own hold charges (the selector denies every start while a hold stands, its own included).

**R-S2b-4 · the deploy** (`startAttempt` :379):
- **The sequence:**
  1. the due-idea check (:426), and its one screen at the root; a Retry skips it;
  2. the ceremony opened before the call, seeded pending (:443);
  3. `deployAgent(agent.id, onCreate, onTarget, { isCurrent })` (:462);
  4. `serviceResult`;
  5. the ceremony's phases through `onPhaseChange` with the attempt id; stale and repeated reports change nothing.
- **Mounting.** The root ceremony is the provider's sibling, never inside the hub. An identity change closes it at the change itself.
- **With the ceremony off:**
  - a created battle navigates at once (App's handoff, as today), and that acknowledges the terminal;
  - an existing one opens only its fetched owned document;
  - a document that cannot be read is a visible note with its Retry time (R1 FR-2, hub path only).
- **Interpretations:**
  - **(i)** A throw from `deployAgent` (its only throw is before the POST) becomes an untyped result, which fails closed as `uncertain`.
  - **(ii)** App's handoff checks the uid only (R1's design). The attempt and auth epochs are the provider's check, made immediately before calling App. App's remaining async write (the fresh-price update) is uid-checked and touches only the captured owner's own battle.
  - **(iii)** A creation with no ceremony on screen (flag off, or the ceremony closed while the request was out) closes its own ceremony phase, so the hub shows "Deployed · Enter battle" (fix round W4-1, W4-2).
  - **(iv)** A created or existing answer that lands after the ceremony's own watchdog check already settled on its error gets a fresh ceremony instance for the hub attempt. That is the post-check half of FR-1, at the provider (§6).

**R-S2b-5 · existing-battle hydration** (`hydrate` :528):
- **The read.** One owned targeted read by id (`src/services/ownedBattleRead.js`, `getDocFromServer`, owner checked), deduplicated by uid + auth epoch + attempt id + battle id, with an 8 s deadline. A failure stays on existing with a note and a Retry that waits 30 s. It sits outside the review budget.
- **League and voided ids.** It resolves both because it reads by id.
- **The ceremony.** The existing answer reaches the ceremony once the read has settled, bounded by the deadline, so the existing terminal opens the read document.
- **Cooldown.** An existing answer's 120 s cooldown comes from the target's recorded `lastDeployedAt`; nothing is fabricated from the client clock.
- **The failed handoff.** The same read serves a creation whose handoff threw: its Enter reads the real battle (fix round W4-5).

**R-S2b-6 · dismiss, retry, cooldown, uncertainty:**
- **Terminals.** Created, existing and definitive refused terminals acknowledge to idle, keeping the owner + target cooldown. Enter and Open re-check identity, epoch, the document's owner and, for Enter, the record's battle id.
- **Uncertain.** Dismissing keeps the guard. Check deployment runs the target-scoped verifier: found → existing (the provider's read is not the ceremony's gates); clear → a Retry once the cooldown has passed; error → still uncertain.
- **The ceremony's own conclusions.** A ceremony reveal (its preserved gates admitted a battle) reads the battle once → created, recovered. An empty re-read there stays unresolved. A confirmed "no battle" error is clear.
- **Retry.** It starts at most one new request with a new epoch, and the ceremony offers it only when the hub's table does. Nothing replays itself.
- **Review-due.** The refusal's action opens the equipped list's Forge (`onOpenForge({ area: 'watchlists', watchlistId, returnTo: 'dashboard' })`) and acknowledges.

**R-S2b-7:**
- "See what it's eyeing" is a link on the Deploy card and on the phone's Loadout deploy card.
- `HUB_SHEETS.SCOUTING` registers `within`.
- The board's deploy is `tap('hub-scouting-board', { exemptOverlay: true })`: the board is the one overlay it may sit under.

**R-S2b-8:**
- **One attempt and one ceremony** across unmount, remount and a site flip during submitting or the beat (rows in §7).
- **A control mounted inside its own committed beat** says "Locked in" (W3-3).
- **The root's unmount** revokes every callback and releases a beat it will never run.
- **`flagDisabled`** is injected: a charge cancels, new attempts are refused, and a committed one completes.

**R-S2b-9:** §6.

**R-S2b-10:**
- The deploy action and its wiring are S2b's: `NextActionCard` takes `holdWiring` / `holding`. Which candidate shows is S4's.
- Every shared-file change is an addition: `CommandCenterHub.jsx`, `hubCopy.js`, `hubModel.js`, `PhoneTabs.jsx` (two props), and the guard manifests.
- `hubProps` gained no key.

## 4. What S2b built, by `file:line` (at the code head)

**New**
- `src/contexts/DeployAttemptContext.jsx`. Exports:
  - the context hooks `useDeployAttempt` (:105) and `useHoldProgress` (:113);
  - the owner-tagged progress store (:121);
  - `createDeployRuntime` (:144);
  - `DeployAttemptProvider` (:780), with the live provider at :787.

  Inside the runtime:
  - admission (:198) and the hold seam's claim, commit, release and progress (:223–263);
  - `beatOwner` (:266), `cancelCharging` (:277), `revokeBeat` (:286), `cleanupOrphan` (:298);
  - `releaseInFlightHold` and `identityChanged` (:315–336), `setHubEnabled` (:338), `unmount` (:344);
  - `startAttempt` (:379): the due-idea gate :426, the ceremony opened :443, App's handoff :454, the POST :462, the after-result check :469, the remount rule :485, the hidden-ceremony settle :492–505;
  - `hydrate` (:528), `reconcile` (:571), `phaseChanged` (:618), `dismiss` (:631), `enterBattle` (:644), `openGame` (:675), `retry` (:687), `deployCommitted` (:694), `retryActionNow` (:710).

  In the provider's effects: the identity and the unmount (:801), the runtime disable (:813), the cooldown clock (:816), the inert root (:825). Then `TargetEvidence` (:877), `RootCeremony` (:888), `retryAdmitted` (:914).
- `src/services/ownedBattleRead.js:26`: `readOwnedBattle`, by id, from the server, owner-checked.
- `src/components/CommandCenter/hub/useHubDeploy.js`: `HUB_DEPLOY_CONTROLS` (:30); `useHubDeploy` (:41), which handles the registration (:48), the owner-gated evidence (:60–74), each control's wiring and `attemptAction` (:91), and the speaking hold (:126).

**Changed, outside the hub**
- `src/hooks/holdClaim.js`: the three-argument claim (:57–70) and the copy's fields (:86).
- `src/hooks/useHoldToDeploy.js`:
  - the seam header;
  - `holdSeam` and its ref (:264, :271);
  - release through the seam (:306), commit through it (:343), progress (:353, :465);
  - the run's display hand-over (:407), the claim (:494, :515);
  - the owner filter and the seam bind (:587–604), `lockedByKey` (:615);
  - `LOCK_BEAT_MS` exported (:210).
- `src/components/Dashboard/deployCeremony/HoldToDeployButton.jsx`: forwards the seam props (:45–52) and the key snap (:68).
- The two live changes (§6): `useCeremonyStageMachine.js:380–393`; `CeremonyError.jsx`; `DeployCeremony.jsx`; `deployResult.js:64`; `src/constants/deployOutcomes.js:24–46`.
- `src/App.jsx`: the import (:129), `clearCeremonyStash` (:6746), the provider around `{screenContent}` (:10352–10361).

**Changed, in the hub**
- `hub/selectors/attemptReducer.js`: the header; `initialAttemptState` with an epoch (:83); `begin`'s stamp (:186); `authChanged` with the source's epoch (:329); `holdClaimed` / `holdCommitted` / `holdReleased` (:371–397).
- `hub/selectors/attemptVocabulary.js:159`: the in-progress line.
- `hub/selectors/readerInputs.js:97`: `attemptInputsOf`.
- `hub/useHubReaders.js`: the provider's half of the inputs (:106) and the result's `liveBattles` / `ceremonyAgent` (:165–166).
- `hub/HubOverlays.jsx`: `onOpen` (:24–41).
- `hub/useHubSheets.js:41`: `SCOUTING`.
- `hub/hubFlags.js:38`: `scoutingBoardOn`.
- `hub/deployDisplay.js`: the owned read's note (:185, :230–237).
- `hub/hubCopy.js`: `statusHolding` and its siblings (:87), `holdLocked` (:286), `scoutingBoard` and the read's words (:302–310).
- `hub/hubModel.js`: the action list's S2b additions.
- `CommandCenterHub.jsx`: the header; `deployActionsOf` (:225); `ScoutingBoard` (:238); the tab and area cancels (:272, :369); `ConnectedHub` (:508); the overlay provider's `onOpen` (:547).
- `sections/HubHold.jsx`: live while its own hold charges or is locked, and "Locked in" on a remount (:47–52).
- `DeployStrip.jsx`, `sections/DeploySection.jsx` (the board link :87, :121), `sections/NextActionCard.jsx`, `PhoneTabs.jsx`: the wiring props.
- `ShadowStage.jsx`: `statusWords` (:33), `HoldPercent` (:41), `StatusLine` (:51).

**New tests**
- The provider:
  - `src/contexts/DeployAttemptContext.jsdom.test.jsx`: 111 rows, the real controls with a stubbed service and ceremony (the build's 42, the fix round's 14, W5's 37, and 18 more for the survivors);
  - `DeployAttemptContext.ceremony.jsdom.test.jsx`: 4 rows, the real ceremony, service, verifier and owned read;
  - `DeployAttemptContext.flagOff.jsdom.test.jsx`: 7 rows.
- The hub: `src/components/CommandCenter/CommandCenterHub.s2b.jsdom.test.jsx`, 8 rows.
- The kit: `__fixtures__/deployAttemptKit.jsx`.
- Units:
  - `src/hooks/holdClaim.s2b.test.js`: 5 rows;
  - `hub/selectors/attemptReducer.s2b.test.js`: 11 rows;
  - `hub/selectors/readerInputs.s2b.test.js`: 6 rows.
- The live changes:
  - `src/components/Dashboard/deployCeremony/ceremonyWatchdogExisting.test.jsx`: 7 rows;
  - `ceremonyInProgress.test.jsx`: 5 rows.

## 5. Existing tests S2b edited, and why

Only guard manifests and registration lists the rulings move; no behaviour test:
- **`commandCenterHub.mount.guard.test.js`:**
  - three permitted terminals: the provider, `ScoutingBoardSheet.jsx`, `deployOutcomes.js`;
  - the `useHubDeploy.js` effect allowance;
  - the S2a selectors row now expects the hub graph to reach `attemptReducer.js` (S2b's `attemptInputsOf` takes `cooldownFor`);
  - the main-graph edge and literal lists, which gain the provider's six imports of the hub's pure modules;
  - the NAMED exports (`SCOUTING_BOARD_ENABLED`, the provider's two hooks, the board, the in-progress line);
  - the service list gains the test kit's identity import.
- **`hub/selectors/selectors.purity.guard.test.js`:** the import lists of `attemptVocabulary.js` (+ `deployOutcomes`) and `readerInputs.js` (+ `attemptReducer`).
- **`src/theme/tokens.guard.test.js`, `motion.guard.test.js` and both baselines:** register `hub/useHubDeploy.js` and the test kit.

## 6. The two live changes, before and after

**(a) R1 Fable FR-1, `useCeremonyStageMachine.js:380–393`.**
- **The change.** At the verification's resolution, after the recovery admission and its reveal (both byte-identical), the machine re-reads the client's own result. If it reads `existing`, it commits the `existing` terminal before any tone is computed.
- **Rows:** `ceremonyWatchdogExisting.test.jsx`, the real machine on a fake clock.

| Row | On `main` `82ea84bb` | At S2b |
|---|---|---|
| RACE: existing answer during the watchdog's check, battle found | **fails**: `error` | `existing` |
| RACE: same, check empty (both looks) | **fails**: `error` | `existing` |
| RACE: the existing terminal holds through a later checkpoint | **fails** | holds |
| CONTROL: a 500 during the same check, battle found → recovered reveal | passes | passes |
| CONTROL: a 429 during the check → error, lost contact | passes | passes |
| CONTROL: existing before any watchdog → existing, no check | passes | passes |
| CONTROL: success with checkpoints → reveal, no check | passes | passes |

**Residual, recorded:** an answer that arrives after the check has settled still meets the latched error in today's shells. For hub attempts the provider gives that answer a fresh ceremony (§3, interpretation iv; row "the post-check half of FR-1").

**(b) The 429 "Deploy already in progress"** (`reason: 'in_progress'`).
- **Where it changed:**
  - `deployOutcomes.js:31–46`: the one line, "A deploy is already in progress", and `isInProgressRefusal`;
  - `deployResult.js:64`: forwards `reason` for that refusal only;
  - `DeployCeremony.jsx:174–176`, `:227`: the live region and the prop;
  - `CeremonyError.jsx:56–58`, `:64–68`, `:95`, `:139`: the headline "A deploy is already in progress.", the eyebrow "Deployment refused" (W1-1) and the subtext;
  - `attemptVocabulary.js:159`: the hub's line.
- **Rows:** `ceremonyInProgress.test.jsx`, through the real service, mapping and ceremony.

| Row | On `main` | At S2b |
|---|---|---|
| the service types it, the mapping forwards `reason` | **fails** | passes |
| the ceremony and live region say "A deploy is already in progress." | **fails** (lost contact) | passes |
| CONTROL: the 429 cooldown keeps "Couldn't confirm the deploy." | passes | passes |
| CONTROL: a 500 keeps lost contact | passes | passes |
| CONTROL: every other mapping shape carries no `reason` | passes | passes |

The failing-first logs are `failing-first-live-changes.txt` and `failing-first-fixround.txt` in the session scratchpad (§12).

## 7. Checks

| Check | Head | Result |
|---|---|---|
| Full suite, Linux (`~/pd-ci`, Node 20.20.2, `TZ=UTC`, `--maxWorkers=2`) | `bc3fc32e` (the code head plus the test commits) | **`Test Files  1153 passed \| 8 skipped (1161)`; `Tests  24958 passed \| 89 skipped (25047)`; exit 0**; 814 s |
| Early full suite, Linux | `8b2eb835` | 1 failed: the flag-pin guard's docstring rule, which reads S2b's own pin of `COMMAND_CENTER_HUB_ENABLED` in the flag-off suite. Fixed by removing the redundant pin (§12) |
| `lint:gate`, Linux | `bc3fc32e` | exit 0 (`--max-warnings 0`). Re-run at the pushed head: PR description |
| `vite build`, Linux | `bc3fc32e` | exit 0; 43 JS chunks; built in 24 s. Re-run at the pushed head: PR description |
| The touched suites, Windows | `bc3fc32e` | Green but for the platform-only rows already failing on `main` (CRLF and path separators: eligibility, agentReadCensus, flagPinGuard, shadowCpuQuote). One load-only timeout at 10 workers (the S1 SVG-paint row) passes alone |
| Failing-first | `main` / `8b2eb835` | The live-change rows fail on `main` (§6); the fix-round rows fail on `8b2eb835` (§8) |
| Headless browser | — | **Not run.** The provider needs a signed-in Firebase session, and the hold, beat and site flip are on the founder's smoke list. They are covered in jsdom with a controllable rAF (§4) |

## 8. The BUILD_RULES §2 review record

**Setup:**
- Lenses W1–W4 ran in parallel on Sonnet, each on its own LF `git archive` snapshot of the build head `8b2eb835`, read-only.
- Every MAJOR or BLOCKER claim went to an Opus refuter (RA, RB, RC), each on a fresh snapshot of the same head, with leave to write repro tests there only.
- The fix round is `e906d07a`.
- W5, the test-integrity and mutating lens, ran last on a snapshot of `e906d07a`. Its rows are adopted in `43808d37`.

**Tally:**
- 30 findings: W1 1, W2 5, W3 4, W4 8, W5 12 (test integrity; one is information only), plus the mutation.
- Refuted: none.
- Refuters ruled on five claims: 2 CONFIRMED (W2-1, W4-2) and 3 PARTLY (W3-1, W4-1, W4-3).
- Every finding below is CONFIRMED by its lens's evidence unless marked.

| Id | Sev. (final) | Finding | Verdict | Disposition |
|---|---|---|---|---|
| W1-1 | NIT | The in-progress ceremony's eyebrow said "Deployment failed" | CONFIRMED | Fixed: "Deployment refused" (`CeremonyError.jsx:58`) |
| W2-1 | MAJOR | An identity change left the in-flight hold's slot held: the new account's hold looked ready and did nothing until the old request settled (≤ 180 s) | **CONFIRMED** (RB: 5 rows) | Fixed: `releaseInFlightHold` (:315, :327, :349); row W2-1 |
| W2-2 | MINOR | The former owner's agent `lastDeployedAt` could be stamped under the new uid | CONFIRMED | Fixed: owner- and epoch-gated (`useHubDeploy.js:60–66`); rows W2-2, X9, X10 |
| W2-3 | NIT | An acknowledged record's leftovers survived an identity change | CONFIRMED | Fixed (:331–335); row X1 |
| W2-4 | NIT | The comment claimed App used the handed `isCurrent` | CONFIRMED | Fixed: `isCurrent` no longer handed; comment says what is checked (:452–457) |
| W2-5 | NIT | `dueIdeaCheck` may cache a closed gate for the wrong owner | CONFIRMED | Recorded (§12): shipped service, out of scope |
| W3-1 | MINOR (lens: MAJOR) | The status line said "Locked in" through a hold-started attempt's terminal | **PARTLY** (RB: real with the ceremony off; under the shipped ceremony it sits behind an inert root) | Fixed: the hold stops speaking once begun (`useHubDeploy.js:126`); row W3-1 |
| W3-2 | MINOR | The hold control stayed enabled-looking after the attempt began | CONFIRMED | Fixed with W3-1 |
| W3-3 | MINOR | A control mounted inside its own committed beat showed the idle label | CONFIRMED | Fixed: "Locked in" from the provider's record (`HubHold.jsx:47–52`); row W3-3 |
| W3-4 | MINOR | A committed hold whose request could not start stranded the reducer hold | CONFIRMED (reachable only with a malformed agent read) | Fixed (`deployCommitted` :705); row W3-4 |
| W4-1 | MAJOR (latent; lens: BLOCKER) | Ceremony off plus a failed handoff: "verifying" forever, no Enter, every deploy blocked | **PARTLY** (RA: mechanism confirmed; unreachable while the ceremony flag is on) | Fixed: a creation with no ceremony on screen closes its own phase (:492–505); rows W4-1, X6 |
| W4-2 | BLOCKER (for the flip) | Ceremony closed while the request was out, then created: "Finishing" forever, every deploy blocked | **CONFIRMED** (RA: real ceremony and real service) | Fixed by the same settle; row W4-2 |
| W4-3 | MINOR (lens: MAJOR) | The ceremony's existing-terminal Retry never re-runs the owned read | **PARTLY** (RC: real, narrower, no worse than R1) | Recorded: Q-S2b-5 (needs a ceremony prop) |
| W4-4 | MINOR | Open game's retry read did not open on success | CONFIRMED | Fixed (`openGame` :675); row W4-4 |
| W4-5 | MINOR | A failed handoff's Enter read failed silently, with no wait | CONFIRMED | Fixed: through the one owned read (`hydrate`, `enterBattle`); row W4-5 |
| W4-6 | MINOR | A reveal followed by an empty re-read became clear, so a Close acknowledged | CONFIRMED | Fixed: empty after admission is an error (:590); row W4-6 |
| W4-7 | MINOR | Cooldown evidence stopped at acknowledgment | CONFIRMED | Fixed (`evidenceTarget` :846–848); row W4-7 |
| W4-8 | NIT | Enter did not check the document's id against the record | CONFIRMED | Fixed (`enterBattle`); row W4-8 |
| W5-1 | MAJOR (test) | The ceremony's Retry offer was unpinned | CONFIRMED (mutant CX186 survived) | Rows G15, G15b, G15c, G15d |
| W5-2 | MAJOR (test) | The hook's seam branches had no direct rows (pointercancel, leave, owner input, snap) | CONFIRMED (11 survivors) | Rows G7, G7b, G11, G29, G31a/b, X11 |
| W5-3 | MAJOR (test) | Row W3-1 could not fail under its own defect (never read the label) | CONFIRMED (HK17) | Row G10 |
| W5-4 | MAJOR (test) | `canCommit`, the 8 s deadlines, the malformed verifier answer and the lost-contact tone were unpinned | CONFIRMED | Rows G2, G13a, G13b, G6, G5 |
| W5-5 | MAJOR (test) | An identity change during the due check, the tap's own admission, and the same-task overlay race were unpinned | CONFIRMED | Rows G4, G3, G18, G1, X14 |
| W5-6 | MAJOR (test) | The remount rule (existing, others), the stash on identity change and the revoked beat's control were half-pinned | CONFIRMED | Rows G9, G9b, G12, G12b, G8 |
| W5-7 | MINOR (test) | Three titles overstated | CONFIRMED | Covered by the new rows: G28/G30 for the due screen, G15d and the committed-disable row, X6 for the closed phase |
| W5-8 | MINOR (test) | The flag-off "flag itself" row is vacuous after a flip | CONFIRMED | Accepted: by design (the injected row stays); noted in the row |
| W5-9 | MINOR (test) | The ceremony suite proves "no automatic POST" with a 300 ms wait | CONFIRMED | Accepted: real timers; the orchestration suite proves it with fake time (120 s) |
| W5-10 | MINOR (test) | Two reducer rows could not fail under their clause | CONFIRMED | Rows RD2, RD14 (RD8 equivalent) |
| W5-11 | MINOR (test) | Stand-ins: a synchronous ranked target; a fixed poll time; desktop area change and read Retry unasserted | CONFIRMED | Rows CC2, CC7; the clone target stays in the ceremony suite |
| W5-12 | NIT | The guard tests were not loosened beyond S2b's registrations | — | Information |

**Mutation (W5):**
- **The run.** Baseline 420 rows across 18 files. 318 mutants: 160 killed, 157 survived, 1 broken. The broken one (CX94) was repaired and survives as equivalent.
- **The survivors:**
  - 87 are equivalent: redundant clauses that another guard covers, listed with W5's reason in its results.
  - 70 were test gaps.
- **Closing the gaps.** W5's own rows killed 44 of the 70, each shown failing under its mutant. The builder wrote 16 more rows for the rest. The 70 gap mutants were then re-run against the new rows on a snapshot of `43808d37` (baseline 341 rows green): 60 killed and 10 survived. Of those 10, six are equivalent: CX23 (a defensive fallback release); CX36 (a cleared runtime nothing reads afterwards); CX77 (a record-only timing call); CX78 (a first-render target no render ever shows, because the target is reported in the same task); CX121 (the reducer rejects the late result anyway); CX187 (a render with no change, efficiency only). The other four (CX39, CX58, CX61, DD2) got rows in `bc3fc32e` and were killed on its snapshot (4 of 4). Specs and results are in the session scratchpad: `review/W5/_mutation/`, `review/M2/_m/`, `review/M3/_m/`.

**Fix-round evidence:**
- The 13 fix-round rows all fail on `8b2eb835` and pass at `e906d07a`; the control row passes on both (`failing-first-fixround.txt`).
- No lens re-ran over the fix round's code. W5's lens is the delta check: it ran on `e906d07a` and found no code defect, only test gaps.

## 9. The flag-off build

Measured on Windows (LF snapshots, `vite build`, both exit 0), `main` `82ea84bb` against the build head `8b2eb835`:
- 43 chunks in each; 41 have identical bytes.
- **The entry chunk:** 4,859,718 → 4,898,170 B (+38,452 B); gzip 1,307,092 → 1,319,524 B (+12,432 B). That is the provider plus the hub's pure modules it runs: the reducer, the selector, the vocabulary, the input shapes, `overlayStack.js`, `hubDate.js`.
- **The hub chunk:** 112,401 → 108,895 B (−3,506 B), since those modules are now shared.
- `index.html` gains no `modulepreload` and does not name the hub.
- Flag off, none of the new code runs (§3).

At the final code head `bc3fc32e`, the Linux `vite build` (exit 0) prints 43 JS chunks: the entry 4,898.83 kB (gzip 1,319.78 kB), the hub chunk 109.19 kB. That is about 0.7 kB above the build head's Windows measure, from the fix round's source (the two later commits are test-only).

## 10. Founder questions

None blocks the draft.

- **Q-S2b-1 — the entry chunk grows +12.4 KB gzip.** It carries the provider and the selectors it runs, with the flag off. The alternative is a lazily loaded provider: the hub screen would then wait on a second chunk, or the provider would not exist while a beat runs on another screen. **Asked:** accept the size, or ask for the provider to be split so the reducer and ceremony glue load only with the hub?
- **Q-S2b-2 — the in-progress words.**
  - eyebrow "Deployment refused";
  - headline "A deploy is already in progress.";
  - subtext "Your agent is safe. If the deploy already running creates a battle, it will appear on your hub."

  The hub shows "Deployment failed" (the S2a state word) with the line "A deploy is already in progress". **Asked:** accept, or reword?
- **Q-S2b-3 — the status line's hold words.** "Holding to deploy", then "Locked in", with the charge's percentage beside the line (aria-hidden) while it charges. **Asked:** accept the words and the visible percentage?
- **Q-S2b-4 — a refusal with the ceremony closed** (closed while the request was out). The strip and card show "Deployment failed" with Retry when one is admitted. There is no plain "OK" to acknowledge without retrying; the review-due refusal's Forge action does acknowledge. **Asked:** add an acknowledge control, or keep it?
- **Q-S2b-5 — the ceremony's own existing-terminal Retry** (W4-3, PARTLY / MINOR).
  - When the owned read fails or times out, the terminal falls back to R1's path (live list, then the target-scoped verifier), as today's shells do. Its Retry repeats that path; it is not the owned read and has no 30 s wait.
  - A league battle not yet polled, or a voided group's battle, then stays "Couldn't open the running game" until Back to hub, and the existing terminal is then acknowledged.
  - Routing the ceremony's Retry through the provider needs one new optional ceremony prop: a ceremony change beyond R-S2b-9's two. **Asked:** allow that prop in a follow-up?
- **Q-S2b-6 — Check deployment from the strip or card says "Already running · Open game" for a found battle,** never "Battle confirmed". The preserved recovery gates run only inside the ceremony. **Asked:** accept the conservative words outside the ceremony?
- **Q-S2b-7 — a cold-mounted hub on the casual-clone path has no cooldown evidence for the clone** until an attempt names it. The server's 429 answers a too-early deploy as a refusal with Retry. **Asked:** read the clone's `lastDeployedAt` at mount? That is one more listener per hub mount.

## 11. What S4, S7 and S8 inherit

- **S4 (Activity, next action, Later, the brief).** The first-deployment next action's hold is wired:
  - `NextActionCard` takes `holdWiring` (from `deployActionsOf` in `CommandCenterHub.jsx`, `actions.nextActionHold` on the phone) and `holding` (the control's hold phase, or null);
  - S4 decides when the deploy candidate shows and leaves those two props in place;
  - the `hubProps` object gained no S2b key, so S4's additions merge without conflict;
  - Activity must keep leaving out the optimistic entry (`localOrigin: true`) and the provider's record: the record is not an event.
- **S7 (the Shadow canvas).** "Processing animation only while an actual hub-started deployment is submitting": `deployDisplay(...).processing` is that signal. The status line's words now include the hold's phases. It still has no words for a terminal attempt (RB's aside), which is a Shadow-vocabulary question for S7/S8.
- **S8 (cumulative review, accessibility):**
  - the root ceremony and the due-idea screen make `#root` inert while open (`inertSiblings`, the stack's own refcount);
  - the four shipped sheets' dialog shells (Q-S5-7) still apply, the Scouting Board included;
  - the gate's render-error boundary (Q-S5-6) is unchanged;
  - S8 should re-run the headless real-input checks on the smoke preview: hold, quick release, Enter, a site flip mid-beat.

## 12. Found outside S2b (for separate tasking; not fixed)

- `dueIdeaCheck.js:56–72` caches a closed gate for the agent's `ownerId` from whichever token answered (W2-5). An identity change during that read could mark the former owner gate-closed for the page session. This is the shipped service of both shells.
- The status line reads "Idle · nothing running" while an uncertain attempt's guard stands after dismissal, and while a live game runs. This is S1's status vocabulary (RB's aside).
- The early Linux run met a flag-pin guard rule: any test that pins `COMMAND_CENTER_HUB_ENABLED` must be named in the flag's docstring. S2b removed its redundant pin rather than widen the flip map.

## 13. The smoke branch — NEVER MERGE

- **The branch.** `claude/command-center-hub-s2b-smoke` is this branch's head plus one commit: `src/config/featureFlags.js:3442` sets `COMMAND_CENTER_HUB_ENABLED = true`. Never merge it, and no PR is opened for it. Its commit and its Vercel preview are named in the PR description.
- **Not tested as a branch.** The suite is not run on it; it exists only for the preview.
- **The founder's checklist on the preview.** Sign in with an agent that can deploy. Check at desktop width and at phone width.
  1. A real hold on the hub's deploy (1.3 s) deploys once, and the ceremony runs to its end.
  2. A quick release, before the rail fills, cancels: no request and no ceremony.
  3. Focus the hold and press Enter: it shows "Locked in", then deploys once.
  4. Navigate to another screen mid-ceremony, then come back: the same ceremony, and still one request.
  5. While that battle runs, a second deploy shows "Already running"; no second request is made.
  6. "See what it’s eyeing" opens the Scouting Board, and its deploy goes through the same ceremony.
  7. With an idea review due, a deploy shows the due-idea screen first.
  8. During the 450 ms "Locked in" beat, cross 768 px: the beat finishes and deploys once.

## 14. Files outside the repository, and next

- The report's copy, byte-identical: `C:\Users\fashr\Documents\FantasyTrades\CommandCenter\20261023_BUILD_COMMAND_CENTER_HUB_S2B.md` (sha256 in the PR description).
- In the session scratchpad:
  - the review snapshots and diffs (`review/`);
  - the failing-first logs;
  - the mutation harness (`scripts/mutate.mjs`) and W5's spec and results;
  - the Linux run outputs (`linux-early/`, `linux-final/`);
  - the build logs.

**Next:** the founder's review of the draft and the smoke preview; then the independent Fable review of S2b. S4's additions to the shared hub files go on top of S2b's (R-S2b-10).
