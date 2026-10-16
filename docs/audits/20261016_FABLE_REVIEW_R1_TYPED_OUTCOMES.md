# Independent review — repair R1 (typed deploy outcomes, hand-off ownership, the existing-battle terminal)

Reviewer: Claude Fable 5.1, fresh session, 2026-10-16. Brief: `CommandCenter_R1_Kickoff_20261016.md` (independent-review brief) against the R1 build prompt of the same name. The build's own report (`docs/audits/20261016_BUILD_DEPLOY_R1_TYPED_OUTCOMES.md`) and the PR description's review section were **not read** until section 7 below.

## 1. Verdict

| Item | Result |
|---|---|
| **Verdict** | **MERGE** (no blocking finding; the MINORs below are backlog for S2b / R2, none needs a change before merge; FR-3 is a one-line test change the fix round that commits this review can take) |
| Blocking findings | none |
| Exit criterion 1 — one intent, one POST | **holds.** R1 adds no POST path; the service issues exactly one `fetch('/api/agent/decide')` per call (`src/services/agentDeploy.js:229`) and every identity-guard return ends the call. The two pre-existing user-retry vectors are out of R1 scope and the fenced server converts a retry while the first battle lives into the existing-battle 200, which R1 now shows as `existing` (FR-4). |
| Exit criterion 2 — owner attribution | **holds.** Captured uid at entry, checked after the token, the clone ensure, the POST, the body read and immediately before the callback; `orphaned` carries the right `postIssued` at each; App re-checks before the append, the battle object, the stash, the navigation and again before the price write; Enter and Open re-check the owner. No write path deletes or restamps a server battle. |
| Exit criterion 3 — existing is never created | **holds.** `battleCreated:false` + real `existingBattleId` → `existing_battle` before the hand-off (`agentDeploy.js:311-318`); no callback, no stash, no navigation, no `agent_` id anywhere in `src/` outside a comment; the machine commits to `existing`, not reveal; Open hydrates only a document whose id is the server's and whose `ownerId` is the signed-in uid. |
| Exit criterion 4 — created-path parity | **holds.** `deployResultFor` reproduces the shells' pre-R1 inline mapping field for field (verbatim parity reference in `deployResult.test.js:15-22`); the created result adds `outcome`, the callback meta adds `ownerUid`, both additive; the ceremony's new code is a no-op without a listener and the `existing` branch is reached only with status `existing`. Six pre-existing tests were edited; every edit is classified in §5.4 and none reflects a shell-visible change. |
| Exit criterion 5 — recovery gates and the 409 line | **holds.** The `runVerification` block (101 lines, `useCeremonyStageMachine.js:295-395`) is byte-identical to the merge base; `ceremonyData.js`, `agentBattleVerify.js`, `CeremonyError.jsx`, `CeremonyReveal.jsx` are blob-identical. The 409 review-due reaches the error terminal with the exact server line in `details` and `code: DEPLOY_REFUSAL_CODE`; no auto-POST. |
| Exit criterion 6 — fence and `api/` | **holds.** `git diff --name-only 078fe895..95a04980` touches nothing under `api/`; all eleven BUILD_RULES §1 fenced blobs are identical at both commits. |
| Reviewed head | `95a04980b5186c05c52ecda1163662d84af2f09d` = `origin/claude/deploy-r1-typed-outcomes` (the founder's `HEAD = <sha>` was left blank; this is the branch head, code head `1d5dd538`, report commits above it). Merge base with `origin/main`: `078fe895` (= `origin/main` at review time). Worked on `git archive` snapshots (read tree + separate mutation tree), read-only on git. |
| Files read | `src/services/agentDeploy.js`, `deployIdentity.js`, `agentBattleVerify.js`; `src/constants/deployOutcomes.js`; `src/components/Dashboard/{deployHandoff,deployResult}.js`, `CommandDashboard.jsx`, `CommandDashboardDesktop.jsx`, `ScoutingBoardSheet.jsx`; `deployCeremony/{DeployCeremony.jsx,useCeremonyStageMachine.js,CeremonyExisting.jsx,existingBattle.js,CeremonyError.jsx,ceremonyData.js,HoldToDeployButton.jsx}`; `src/hooks/useHoldToDeploy.js` (completion path); `src/App.jsx` (`handleEnterCeremonyBattle`, `handleCreateAgentTrainingBattle`, `handleOpenAgentBattle`, the active poll); `src/components/CommandCenter/hub/selectors/attemptVocabulary.js`; the mount guard's permitted terminals; every R1 test file and the six edited ones at both commits; fenced, read-only: `api/agent/decide.js` (every `res.status`), `api/_utils/rateLimit.js`, `authMiddleware.js`, `hypothesisRecords/carriage.js:298`, `agentBattleService.js:333-341`, `stockThresholdAdmission.js:60-95`; spec V1.2 §5.1–§5.4 and §11.3. |
| Tests run | Baseline on the pristine snapshot: 23 files / **487 passed, 0 failed** (the R1 files, the pre-existing ceremony/shell/service tests, the hub mount guard, the vocabulary test). `ceremonyRecoveredReveal` + `ceremonyTerminalState` rerun: see §6. Pre-R1 copies of the six edited tests against the R1 head: 6 files fail, 28 rows, classified in §5.4. Sixteen mutants (§5.7): **16/16 killed**. One reviewer-authored reproduction (FR-1): 2 rows, both pass as written. `vite build` on the snapshot: see §6. |

## 2. Findings (most severe first)

No BLOCKER. No MAJOR.

### FR-1 · MINOR · the existing-battle answer is lost behind the watchdog latch
- **Where:** `src/components/Dashboard/deployCeremony/useCeremonyStageMachine.js:401` (the latch), `:417-421` (the `existing` branch, inside `evaluate`), `:355-361` (the attribution gate, unchanged).
- **What:** the `existing` branch runs only from `evaluate`, which the latch skips while a check is in flight. If the 90 s watchdog (`:509-525`) fires before the server answers, the machine is `verifying`; when the client's own result then arrives as `status:'existing'` (`postIssued:true, httpStatus:200, battleId:null`) the resolution reads it through the gate as a failure that could not have committed → `error` with tone `lost_contact` ("Couldn't confirm the deploy"), and stays there. The player's agent has a running game, the server said so, and the ceremony says it cannot tell.
- **Reproduction (reviewer test, real machine, fake clock; file `reviewWatchdogExisting.review.test.jsx` in the review snapshot):** CONTROL — baseline, `strategy_running`, then `complete` + the existing result → `phase === 'existing'`, verifier never called (passes). RACE — baseline, `strategy_running`, advance 87 s + 700 ms with no progress → `verifying`, `errorKind 'timeout'`; render the existing result while the verifier is pending (1 s); flush → `phase 'error'`, `errorTone 'lost_contact'`, `recoveredBattle null`; a later `complete` + existing render leaves it `error` (passes as written, i.e. the defect is real).
- **Severity:** MINOR, not blocking: no false creation and no false refusal is shown; pre-R1 the same race ended on the same error terminal (and additionally let App stash a fabricated battle, which R1 removes). Reachable only when no progress checkpoint lands for 90 s during an existing-battle deploy, which decide.js writes checkpoints through (`:731`).
- **Smallest fix:** at resolution time, beside the existing "re-read the server signal" step (`:383-386`), re-read `inRef.current.deployStatus` and commit `existing` (set `phaseRef`, `setPhase('existing')`, return) when it reads `'existing'`, before the tone is computed. Note this edits lines inside the recovery block the exit criterion protects (it would not change the admission or the reveal branch); so it belongs to a follow-up the founder sanctions (S2b, which owns the provider's reconciliation), not to this merge.

### FR-2 · MINOR · ceremony off: an existing battle whose document cannot be read does nothing visible
- **Where:** `CommandDashboard.jsx:268-277`, `CommandDashboardDesktop.jsx:178-187`; `existingBattle.js:73-91` (`openExistingBattleDirectly` resolves `false`; the shells ignore the boolean).
- **What:** with `isDeployCeremonyOn()` false, an `existing_battle` result whose owned document is missing, foreign, league-only-in-the-verifier, or unreadable logs a warning and shows nothing — no navigation, no toast, no error. The button simply re-enables. Spec §5.2 ("existing opens only the fetched server battle") is met literally; the player gets no word.
- **Reproduction:** `existingBattle.test.js` "an unavailable document opens nothing" (resolves `false`, `onOpen` not called); the shells' off-path discards the value (`deployShells.r1.guard.test.js` pins the call, not a use of its result).
- **Severity:** MINOR, dark in production — `DEPLOY_CEREMONY_ENABLED = true` (`src/config/featureFlags.js:1503`), so the off path runs nowhere today.
- **Smallest fix:** on `false`, `showToast('Your agent already has a game running — open it from Manage.')` (or the shells' existing error affordance) in both shells; the guard test gains a row for it.

### FR-3 · MINOR (test integrity) · the "after the POST" rows cannot fail under removal of the after-POST guard
- **Where:** `src/services/agentDeploy.outcomes.test.js:345-351` and `agentDeploy.outcomes.flagOff.test.js:55-60`, guarding `agentDeploy.js:251`.
- **What:** mutant M14 deleted the after-POST guard (`:250-251`). Both rows titled "after the POST: orphaned…" stayed green, because the after-body guard (`:258`) returns the identical `{ outcome:'orphaned', success:false, postIssued:true }` for the same uid change and the body read has no observable side effect. The mutant was killed only by the two `isCurrent` call-count rows (`:370-388`, "fifth check" / "control", which count 5 checks). Behaviourally the after-POST guard is redundant with the after-body guard, so this is not a product defect; it is a row whose title claims a boundary its assertion does not distinguish.
- **Reproduction:** mutation table §5.7, row M14 (`1 failed | 1 passed (2)` files; the named row passes).
- **Smallest fix:** either make the after-POST row distinguish the boundary (assert `response.text` was never called, via a `text: vi.fn()` on the stubbed response) or retitle it to say the body read is covered by the same disposition. This is the one item worth taking in the fix round that commits this review into `docs/audits/`; it is a test-only change.

### FR-4 · MINOR (inherited, out of R1 scope) · two user-retry vectors exist upstream of R1; the server, not the client, serializes them
- **Where:** `CommandDashboard.jsx:187,237-238` (`deployDisabled` is React state read by the `handleDeploy` closure), `:290-294` (`handleCeremonyRetry`), `CeremonyError.jsx:70,96-110` (Try again gated only by `cooldownUntil`); same lines mirrored in the desktop shell.
- **What:** (a) two completion events in one render — a hold completing and the Scouting Board footer (`ScoutingBoardSheet.jsx:132`) in the same tick — both pass `if (deployDisabled)` before React re-renders. (b) After an `uncertain` (network / 500) or a `handoff_failed` whose check could not find the document, the error terminal offers Try again as soon as the target's `lastDeployedAt + 120 s` passes. Both are new user intents, not a replay of one; both are pre-R1 and named for R2 (hold admission, spec §5.5) and S2b (the provider's "uncertain blocks Retry until reconciliation", §5.4).
- **What R1 changes here:** a retry while the first battle lives now returns decide.js's existing-battle 200 (`api/agent/decide.js:752-805`) and lands on the `existing` terminal instead of being shown and stashed as a second new game. A duplicate *battle* was never possible (lock `:184`, cooldown `:193`, existing check `:752`).
- **Smallest fix:** none in R1. Recorded so the R2/S2b briefs can cite the lines.

### FR-5 · MINOR (inherited) · an account change after the service returns does not close the ceremony
- **Where:** `agentDeploy.js:340` (the last identity check), `CommandDashboard.jsx:266` (closes only on an `orphaned` *result*), `DeployCeremony.jsx:85-88` (the verifier reads `auth.currentUser` at call time, `agentBattleVerify.js:99`).
- **What:** if the signed-in uid changes while the ceremony is in theater or verifying, the overlay stays up for the new account and a verification runs under the new uid. Nothing navigates wrongly — Enter (`App.jsx:6652`), the existing terminal's Open (`CeremonyExisting.jsx:54`) and the recovered path (`deployHandoff.js:83`) all re-check the owner — but spec §5.3/§5.4's "on account change … close ceremony, revoke its callback context" is the provider's (S2b) and is not in R1.
- **Smallest fix:** none in R1; S2b's provider closes the overlay on `authEpoch` change.

### FR-6 · MINOR (inherited, documented) · the verifier returns the first live BaggerBomb document on the target, not the document the server named
- **Where:** `agentBattleVerify.js:104-131` (no id filter; expired and league documents skipped), `existingBattle.js:56-61` (requires `battle.id === existingBattleId`).
- **What:** with two active documents on the target, or when the server named a league battle on the clone-fallback path, the verifier's answer is "another battle" → unavailable → Retry loops to unavailable. The file header (`existingBattle.js:21-28`) already records this and defers the targeted read to S2b (spec §11.3 "Existing battle R1 … dedicated deduplicated targeted reconciliation").
- **Smallest fix:** none in R1 (changing the verifier's filter would touch the recovery gate's attribution guard, exit criterion 5).

### FR-7 · NIT · "no Retry-After header" is true of decide.js's own 429s only
- **Where:** `api/_utils/rateLimit.js:77` sets `Retry-After`; `api/agent/decide.js:184,193` set none (confirmed).
- **What:** the kickoff's starting check ("Confirm no Retry-After header exists") holds for the two handler 429s. The shared limiter in front of the handler (`decide.js:108-110`) sends a 429 with the header *and* body `retryAfter`; the service reads the body (`agentDeploy.js:301`, founder ruling Q3) and never the header. Same number, so nothing is lost; recorded so the result table does not say "no header" unqualified.

### FR-8 · NIT · `isDefinitiveRefusal(503)` assumes every JSON 503 came from decide.js
- **Where:** `agentDeploy.js:83`.
- **What:** a JSON 503 from a layer in front of the function would be typed `refused`. Vercel's platform 5xx pages are non-JSON (→ `uncertain`, correct), and no JSON 503 of foreign origin is known; a retry after a wrongly "definitive" 503 is still caught by the server's existing-battle check. Record only.

### FR-9 · NIT · the carriage race is a definitive non-creation typed `uncertain`
- **Where:** `api/agent/decide.js:980-986` (rethrows `battleErr.hypothesisCarriage` → the catch's 500 `:1074-1077`); `agentDeploy.js:264-303` (500 → `uncertain`).
- **What:** the one 500 the server sends for a known non-creation is indistinguishable by status; the service is conservative. The ceremony resolves it honestly anyway: the catch writes `deployProgress.stage:'error'` (`:1059-1069`, gated on `progressInitialized`, set at `:235`), the check finds nothing, and the tone is `confirmed`. No change proposed; the fenced body is the only thing that could type it.

### FR-10 · NIT · ceremony off: the tap button is live during the existing-battle read
- **Where:** `CommandDashboard.jsx:259` (`setDeploying(false)`) precedes `:272` (`await openExistingBattleDirectly`); desktop `:169/:182`.
- **What:** a second tap during the read is a new POST (a new intent); the server answers existing again or 429. Dark path (FR-2). Record only.

### FR-11 · NIT · StrictMode double-reports the mount phase
- **Where:** `useCeremonyStageMachine.js:564` (`reportPhase(phaseRef.current)` inside the mount-once effect).
- **What:** React dev StrictMode runs the effect twice, so `onPhaseChange` sees `theater` twice before anything happens. Production is unaffected; the consumer (S2b) ignores stale notes by contract (R-R1-6).

### FR-12 · NIT · the result table omits one server response, which the client cannot reach
- **Where:** `api/agent/decide.js:1372-1377` (503 `existing_battle_requires_settlement`, carrying `existingBattleId`) is on the tournament path (`runPrescribedTournamentDeploy`), entered only with `gameMode` in the body; `gameMode` is in `TOURNAMENT_ONLY_FIELDS` (`:71-74`) and a client body carrying it is refused 403 at `:146`. The service's body is `{ agentId }` (`agentDeploy.js:232`). Unreachable; the table in §5.6 lists it as such.

## 3. What the review did not check

- The full suite, `lint:gate`, and the Vercel preview smoke (one real deploy must reveal and enter as today). The build's own report claims these; see §7.
- A real Firebase account switch (the identity reader was exercised through the mocked `getCurrentUser`, exactly as the build's tests do); A→B→A with real auth epochs (R1 provides the `isCurrent` hook, the epoch is S2b's).
- Rendering either shell's `handleDeploy`: no test renders the shells (both R1 and pre-R1 pin them by source), so the shells' wiring is verified by reading and by the source guard, not by execution.
- `handleOpenAgentBattle`'s navigation of a league-mode existing battle into the League Arena (the clone-fallback case the `existingBattle.js` header describes).
- The hub (S2b) consumers of `onPhaseChange` / `attemptId` — none exist yet; only the echo contract was checked.
- Real Firestore reads: `findActiveBattleForAgent` ran against a mocked `getDocsFromServer`.

## 4. How the review was done

`git fetch origin` first. `origin/claude/deploy-r1-typed-outcomes` = `95a04980`; merge base `078fe895` = `origin/main`. Two `git -c core.autocrlf=false archive` extractions under the session scratchpad (`r1snap` for reading and running, `r1mut` for mutations), `node_modules` junctioned from the main checkout. No write to any repo tree, no git write. Reproductions and mutations ran in the snapshots; edits were literal single-occurrence replacements applied by a small Node script from a JSON spec and reverted from the pristine tree after each run.

BUILD_RULES §3 markers: every `file:line` in this report was read at `95a04980` (or, where stated, at the merge base `078fe895`) in this session — **VERIFIED**. The only **ASSUMED** items are the build's Linux full-suite and `lint:gate` results, which §6 and §7 record as not rerun here.

## 5. The questions, in order

### 5.1 Double POST (exit criterion 1)

Every path to the POST, both shells (lines are the mobile shell's; the desktop shell's `handleDeploy` is the same code, pinned by `deployShells.r1.guard.test.js:91-95`):

| Entry | Path | Guard | R1 change |
|---|---|---|---|
| Hold completes | `HoldToDeployButton onComplete` (`CommandDashboard.jsx:467-474`, `:514-518`; `useHoldToDeploy.js:170-184`, one `lockTimerRef`, `clearTimeout` before re-arm) → `handleDeploy` | `if (deployDisabled) return` (`:238`; `deploying ‖ deployBlockedByLive ‖ !agent`, `:187`) | none |
| Tap (flag off) | `onClick={handleDeploy}` (`:481`, `:524`), `DeployStation onDeploy` (`:577`) | same | none |
| Scouting Board footer | `ScoutingBoardSheet.jsx:132` → `onDeploy` → `handleDeploy` | same | closes also on `existing_battle` (ruling Q4); no new POST |
| Try again (error terminal) | `CeremonyError.jsx:99` → `onRetry` → `handleCeremonyRetry` (`:290-294`) → bump key → `handleDeploy` | `deployDisabled` + `cooldownUntil` (`DeployCeremony.jsx:159-162`) | none |
| Existing terminal | Open → `onOpenBattle` (`:658`) → `handleOpenAgentBattle`; Retry → `setRun` (`CeremonyExisting.jsx:70`) → re-read only | — | **new; reads, never POSTs** (row: `ceremonyExisting.test.jsx:223-237` pins `fetch` count unchanged) |
| Ceremony-off existing | `openExistingBattleDirectly` (`:272-277`) | — | **new; reads, never POSTs** |

Inside the service one `fetch('/api/agent/decide')` (`agentDeploy.js:229`), no loop, no replay; every `orphaned` return (`:165,:172,:213,:240,:251,:258,:340`) ends the call; the shells close the ceremony on `orphaned` and offer nothing (`:266`). A `handoff_failed` pins `battleId` → the machine verifies the same id and reveals it (gate `useCeremonyStageMachine.js:355-363`), no POST; if the check cannot find it the error terminal's Try again is a user intent after the cooldown, and the server answers existing-battle 200 → `existing` (FR-4). Re-renders never call `handleDeploy`. The same-render double call is FR-4(a), pre-existing, R2's.

### 5.2 Owner stamping (exit criterion 2)

Boundaries in `deployAgent`, with the `postIssued` each `orphaned` carries:

| After | Line | `orphaned(postIssued)` | Row |
|---|---|---|---|
| entry | `:111` captured; `:157` reports the ranked target before any check (harmless: a report, not an effect) | — | — |
| token (lost to a switch) | `:165` | `false` | `outcomes:416-419`, `:421-424` |
| token | `:172` | `false` | `:305-320`, flagOff `:48-53` |
| clone ensure (before the clone is reported or POSTed) | `:213-214` | `false` (the deploy POST has not gone out; the clone ensure used the *old* account's token, so no clone was minted for the new account) | `:336-343` |
| network failure | `:240` | `true` | `:353-356` |
| POST | `:251` | `true` | `:345-351` (see FR-3) |
| body read | `:258` | `true` | `:358-368` |
| immediately before the callback | `:340` | `true` | `:370-379` |

`stillOwned` (`:113-119`) fails closed on a null captured uid, on any uid change, and on an `isCurrent` that is absent-but-passed, non-function, throwing or not literally `true` (`:390-414`). The callback receives `ownerUid: capturedUid` (`:354`). `getIdToken` and `signedInUid` both read `auth.currentUser` (`authService.js:345-346`, `:356-357`), so a token and a uid from the same tick agree.

App (`handleCreateAgentTrainingBattle`, `App.jsx:6663-6843`): the guard `if (agentBattleId === null || !ownerIsCurrent()) return null;` (`:6680`) is the first statement after the readers and there is **no `await`** between it and the optimistic append (`:6746-6759`, entry carries `ownerId: ownerUid, localOrigin: true`, `deployHandoff.js:54-55`), the battle object (`:6761`), the stash + its owner (`:6834-6836`) and the navigation/toast (`:6838-6839`). The price overwrite runs in a `.then` several awaits later and re-checks at `:6817` with nothing awaited between the check and `updateDoc` (`:6818`) (row `App.deployHandoff.test.js:89-100`). Enter: `handleEnterCeremonyBattle` (`:6645-6661`) consumes both refs together and filters the stash by its recorded owner and the recovered document by its `ownerId` before `pickCeremonyEntry` (`deployHandoff.js:82-90`; precedence untouched). The existing terminal re-reads the owner immediately before `onOpenBattle` (`CeremonyExisting.jsx:54`); the off path re-reads before `onOpen` (`existingBattle.js:80`).

The server battle created for the former owner: R1 adds no Firestore write path in the service or the shells (grep: `agentDeploy.js` has no Firestore import; App's only write is the owner-gated price overwrite); nothing deletes or restamps it. The poll's owner filter is a server-side query (`App.jsx:3930`), so the optimistic entry's `ownerId` matters to readers of `activeAgentBattles` (the hub's Activity exclusion by `localOrigin`), not to the poll, which replaces the array wholesale.

A→B→A inside one await is invisible to the uid comparison (row `:446-452` shows the `isCurrent` hook catching it); spec §5.3's auth epoch is S2b's, and R-R1-4 names the uid as the default. FR-5 records the post-return account change.

### 5.3 Existing is never created (exit criterion 3)

Service: `data.battleCreated === false ? realId(data.existingBattleId) : null` (`:311`) → `{ outcome:'existing_battle', success:false, existingBattleId, postIssued:true, httpStatus:200 }` (`:314-317`), before `onCreateAgentBattle` is even considered (`:337`); `battleCreated:false` with no valid id → `uncertain` `deploy_no_battle_id` with `battleId:null` (`:323-333`); the 200 matrix (`outcomes:250-296`) covers both ids × flag. Shells: `deployResultFor` → `{ status:'existing', existingBattleId, httpStatus, postIssued }` (`deployResult.js:34-41`), never `success`, never `error`. Machine: `ds === 'existing'` → `existing` before the baseline bookkeeping (`:417-421`), latched (`:401`), no verification, no reveal signal (`:544` needs `success`). Ceremony: `CeremonyExisting` (`DeployCeremony.jsx:218-231`), `liveText` "already has a game running" (`:171-172`), Back to hub shown (`:180`). Open: `resolveExistingBattle` (`existingBattle.js:50-66`) — live list first, skipping `localOrigin` entries and requiring `status:'active'`, `id === existingBattleId`, `ownerId === uid` (`:38-44`); else the target-scoped verifier with the same ownership test; a miss, throw, other id, other owner or no uid → `unavailable` → "Couldn't open the running game" + Retry (`CeremonyExisting.jsx:84-86`, `:105-107`), which re-reads the *current* list and never POSTs. `onOpenBattle` → `handleOpenAgentBattle(battle)` (`App.jsx:6851`) hydrates from the document handed over. Flag off: the same resolution, direct open, no toast (`existingBattle.js:73-91`); unavailable → silence (FR-2). Synthetic ids: `grep -rn 'agent_\$\{' src` finds only the comment in `deployHandoff.js:9`; App's `currentBattleObj.id` is `agentBattleId` (`:6762`), real by construction.

Executed end to end with the real service, the real mapping, the real ceremony and the real stage machine over a mocked Firestore: `ceremonyExisting.test.jsx:174-294` (20 rows green at baseline; 15 of them turn red under mutants M06 and M08).

### 5.4 Created-path parity (exit criterion 4)

**Diff of the created path, before → after.** Service: `{ success:true, agentBattleId: data.agentBattleId || null }` → `{ outcome:'created', success:true, agentBattleId }` where `agentBattleId = realId(data.agentBattleId)` (`:323`, `:390`). Callback meta gains `ownerUid` (`:354`); every other key is unchanged. A 200 whose `agentBattleId` is null, empty, padded or non-string used to reach the callback (and App minted `agent_…`) and is now `uncertain` — that is IR-01, the one intended change, and it is not a created battle. Shells: the inline ternary became `deployResultFor` (`deployResult.test.js:44-47` runs every result shape through the verbatim pre-R1 mapping and `toEqual`s); `reportDeployTarget` wraps `setDeployTargetId` with a ref write (`:208-209`); the only new branches are `isOrphanedResult` (closes) and `isExistingBattleResult` (off path). App: for a real id and a current owner the effects run in the same order with the same inputs (`App.deployHandoff.test.js:52-71`, `:73-81`); the entry gains `ownerId` and `localOrigin` (`App.deploySettle.test.js` asserts the builder). Ceremony: `setPhase`/`setErrorTone` are wrappers that report only when a listener is passed (`:131-143`); the latch gains `'existing'`; the `existing` branch needs status `existing`; `reportPhase` at mount is a no-op without a listener. Flag on and off: the created result is `status:'success'` either way; off, App navigates and toasts as before (`:6838-6839`).

**Pre-existing tests.** Unmodified and green at the head: `ceremonyTerminalState.test.jsx` (54), `ceremonyRecoveredReveal.test.jsx`, `DeployCeremonyHold.smoke.test.jsx`, `holdDuringLiveBattle.test.js`, `commandCenterMultiBattle.wiring.test.js`, `warpBattleAdapter.test.js` (not rerun), the hub mount guard. Edited (6 files). I ran the **merge-base versions** of all six against the R1 head: 6 files fail, 28 rows. Classification by the recorded assertion:

| File | Rows failing | Why | Parity break? |
|---|---|---|---|
| `ceremonyDeployTarget.test.jsx` | 14 | the pre-R1 `authService` mock has no `getCurrentUser` → `signedInUid()` null → every `deployAgent` call returns `orphaned` | no — the test harness lacked the identity reader R1 introduced; the edit adds `getCurrentUser: () => ({ uid })` and extends one `toEqual` with `outcome:'created'` |
| `ceremonyTiming.test.jsx` | 3 | same (mock only) | no |
| `agentDeploy.refusal.test.js` | 2 | same, plus `toEqual` extended by `outcome`, `code` | no |
| `agentDeploy.stockAdmission.test.js` | 6 | same, plus `toEqual` extended by `outcome` | no |
| `App.deploySettle.test.js` | 2 | source pins on literals that moved into `deployHandoff.js` (`status: 'active'`, `id: agentBattleId`, `some(`) | no — the rows now assert the builder's output and that App routes through it |
| `attemptVocabulary.test.js` | 1 | the row pinned "no `outcome:` in the service yet; R1 adds it" and the pre-R1 return fragments | no — the pin was written to flip |

The honest reading of the first four: R1 adds one precondition to the created path — `getCurrentUser()` must be callable and return the uid the token was minted for — otherwise the created 200 is withheld as `orphaned` and the callback never runs. In production both read the same `auth.currentUser`, so they agree; in a harness that mocks one without the other they do not. No shell-visible behaviour changed.

### 5.5 Recovery gates and the review-due refusal (exit criterion 5)

Byte-identity, proven rather than inferred: the `runVerification` block extracted at both commits (`awk` from `const runVerification` to its closing `};`) is 101 lines at each and `diff` is empty; `ceremonyData.js` (`pickCeremonyEntry`), `agentBattleVerify.js`, `CeremonyError.jsx`, `CeremonyReveal.jsx`, `useHoldToDeploy.js`, `HoldToDeployButton.jsx` have the same blob id at `078fe895` and `95a04980`. Within the machine the only changes are the two setter wrappers (`:124-143`), `'existing'` in the latch (`:401`), the `existing` branch (`:417-421`) and the mount report (`:564`).

The 409: `carriage.js:298` sends `{ status: 409, body: { error: DEPLOY_REFUSAL_CODE, message: DUE_DEPLOY_LINE } }` via `decide.js:419`; the service forwards `details = message` verbatim (`agentDeploy.js:286-287`, `:294`) and adds `code` (`:296`), outcome `refused` (`:289`, 409 is 4xx); `deployResultFor` → the error shape with `details`, `httpStatus 409`, `postIssued true`, `battleId null`; the machine → `verifying` → not admitted (`:355-356`: 409 is neither null nor 500 and there is no id) → `error`; tone `confirmed` when the server wrote `deployProgress.stage:'error'` for this deploy (`decide.js:409-418`, after `progressInitialized` at `:235`) and the check completed empty, else `lost_contact`; `CeremonyError` shows `details` (`DeployCeremony.jsx:200`; `CeremonyError.jsx:85-93`). Forge action: the shipped `CeremonyError` offers none and R1 adds none (the hub's `displayForAttempt` offers `OPEN_FORGE_REVIEW`, S2b's); Try again is cooldown-gated and user-initiated. Executed: `ceremonyExisting.test.jsx:371-392` (shared line in text, only "Back to hub" and "Try again/Retry available in Ns", `fetch` count unchanged, callback never called).

### 5.6 The result table against the real server (`api/agent/decide.js`, read-only)

Client callers send `{ agentId }` (`agentDeploy.js:232`) with a Firebase token; `TOURNAMENT_ONLY_FIELDS` (`:71-74`) makes the tournament path unreachable for them.

| Server site | Status / body | Service `outcome` | Right? |
|---|---|---|---|
| `rateLimit.js:76-83` (middleware, 3/min/IP) | 429 `{success:false, error:'Rate limit exceeded', message, retryAfter}` **+ `Retry-After` header** | `refused`, `retryAfter` from the body, no `reason` | yes (FR-7) |
| `:112` | 405 | `refused` | unreachable (client POSTs) |
| `:117` | 400 `agentId required` | `refused` | yes |
| `:146` | 403 `internal_only_fields` | `refused` | unreachable for `{agentId}` |
| `authMiddleware.js:52-60` | 401 `{error:'Authentication required', message}` | `refused` | yes |
| `:159` | 404 `Agent not found` | `refused` | yes |
| `:171`, `:174` | 400 / 403 (internal callers) | `refused` | unreachable |
| `:177` | 403 `ownership_mismatch` | `refused` | yes |
| `:184` | 429 `Deploy already in progress` | `refused`, `reason:'in_progress'` | yes (no header, confirmed) |
| `:193` | 429 `Please wait 2 minutes between deploys` | `refused`, `reason:'cooldown'` | yes (no header, confirmed) |
| `:311`, `:331` | 409 `projection_stale_generation` / `epoch_closed` | `refused` | yes, before any battle write |
| `:364` | 503 `Stock rankings not available…` | `refused` | yes, before any battle write |
| `:419` ← `carriage.js:298` | 409 `{error: hypothesis_review_due, message: DUE_DEPLOY_LINE}` | `refused`, `code`, `details` = the line | yes |
| `:795-805` | 200 `success:true, battleCreated:false, existingBattleId, …` | `existing_battle` | yes (note: `lastDeployedAt` was stamped at `:722` *before* this check, so the 120 s cooldown applies after an existing answer) |
| `:812-813` → `:1073` | 503 `Stock admission unavailable`, `reason:'prior_corrected_battle_requires_settlement'` | `refused` | yes, thrown before `createAgentBattle` |
| `:896-906` | 503 `pricing_unavailable` | `refused` | yes, before the commit |
| `:958-961` | 409 `compiled_build_unverifiable` | `refused` | yes, before the commit |
| `:963` throws `StockThresholdRefusal` with a pre-commit reason (`stockThresholdAdmission.js:73-80`: `late_start_cutoff`, `evening_window`, `calibrated_unit_missing`, `unsupported_stock_direction`; `creation_selection_changed` in the fence's `confirm`, before the write) → `:1073` | 503 with that `reason` | `refused`, player line in `details` | yes |
| `:963` wraps any other error inside a stock creation (`agentBattleService.js:339`, `stockThresholdAdmission.js:86`) → `:1073` | 503 `reason:'corrected_creation_failed'` | `uncertain` (founder ruling Q1) | yes — can follow a commit whose acknowledgement was lost |
| `:963` carriage race (`battleErr.hypothesisCarriage`, rethrown `:980-986`) → `:1074-1077` | 500 `Failed to generate portfolio`, `details` = carriage race message | `uncertain` | conservative (FR-9) |
| any pre-commit throw (both model calls) → `:1074-1077` | 500 | `uncertain` | yes — indistinguishable from the next row |
| `:991` `activeBattleId` update throws after the commit → `:1074-1077` | 500 | `uncertain` | yes — the post-commit window |
| `:1024-1036` | 200 `success:true, battleCreated:true, agentBattleId, …` | `created` | yes |
| platform | non-JSON body, any status (500/502/504 pages, HTML 404, text 200) | `uncertain` | yes |
| — | JSON 200 `success:true` naming neither id, or a `battleCreated:false` with no valid id | `uncertain` `deploy_no_battle_id`, `battleId:null` | yes (malformed) |
| — | JSON 200 `success:false` | `uncertain` | never sent; fail-closed |
| `:1372-1377` (tournament) | 503 `existing_battle_requires_settlement` with `existingBattleId` | would be `refused` | unreachable (FR-12) |
| `:1399-:1585` (tournament) | 400/503/409/200 | — | unreachable |

Forgotten by the table: nothing reachable. `isDefinitiveRefusal` (`:83`) and `mayFollowCommit` (`:85`) encode the above; the 429 reasons are keyed on decide.js's exact strings (`:64-67`), so a reworded fenced message would still be `refused`, with no `reason`.

### 5.7 Test integrity — mutations (exit criteria 1–5; criterion 6 has no row and is proven by git)

Run in the mutation tree, one literal edit each, the guarding file(s) run, the file restored and `cmp`-checked after every mutant.

| # | Mutant (file, defect) | Criterion | Rows that went red | Result |
|---|---|---|---|---|
| M01 | `agentDeploy.js:340` guard before the callback removed | 2 | "fifth check" + control (call counts 4) | killed |
| M02 | existing branch calls the create callback | 3 | 2 service rows + 3 ceremony rows | killed |
| M03 | existing id taken without `battleCreated === false` | 3 | matrix "existing id with no flag", "created flag with only an existing id" | killed |
| M04 | App guard `if (agentBattleId === null ‖ !ownerIsCurrent()) return null;` removed | 2, 3 | 2 App.deployHandoff rows | killed |
| M05 | App price-write re-check removed | 2 | "re-checks the owner immediately before its write" | killed |
| M06 | `deployResultFor` maps existing → `success` | 3, 4 | 2 deployResult rows + 16 ceremony rows (the terminal never appears) | killed |
| M07 | machine latch without `'existing'` | 3, 5 | "the terminal latches" | killed |
| M08 | machine `existing` branch removed | 3 | 15 ceremony rows | killed |
| M09 | `ownsExistingBattle` without `ownerId === uid` | 2, 3 | 6 helper rows + 2 ceremony rows | killed |
| M10 | off-path open without the second owner read | 2 | "the owner is read again immediately before the open" | killed |
| M11 | terminal Open without the owner re-check | 2 | "the owner is read again at Open" | killed |
| M12 | App Enter calls `pickCeremonyEntry(b, recoveredBattle)` unfiltered | 2 | "Enter filters pickCeremonyEntry's inputs" | killed |
| M13 | `ownedCeremonyEntryInputs` skips the recovered-owner check | 2 | 2 helper rows | killed |
| M14 | `agentDeploy.js:251` after-POST guard removed | 2 | **only** the call-count rows ("fifth check", control); the two rows *titled* "after the POST" stayed green | killed, see FR-3 |
| M15 | `isDefinitiveRefusal` admits 500 | 1, 5 | "a JSON 500 is uncertain", translator row | killed |
| M16 | mobile shell no longer closes the ceremony on `orphaned` | 2, 4 | shell guard row + "the two shells deploy identically" | killed |

Reviewer repro FR-1 (`reviewWatchdogExisting.review.test.jsx`, 2 rows) is not a build row; it demonstrates the defect and passes as written.

## 6. Late results

- `ceremonyRecoveredReveal.test.jsx` + `ceremonyTerminalState.test.jsx` (both unmodified by R1, run at the head after the mutation runs finished): **2 files, 58 passed, 0 failed.**
- `vite build` on the pristine snapshot (Windows): **exit 0, built in 50.83 s.** Only the pre-existing chunk-size warning. (The build's own Linux build reports 17.4 s; the difference is the machine.)
- Not run by this review: the full suite and `lint:gate` (bounded by the brief; the build reports both green at `1d5dd538`, §7 below records that as unverified here).

## 7. Reconciliation (written after the verdict, after reading `docs/audits/20261016_BUILD_DEPLOY_R1_TYPED_OUTCOMES.md` at the head and the PR #979 description)

The verdict above was written before either was read and is not revised. PR #979 (`fashraf94/TradeSeven`, draft, head `95a04980`) is the reviewed head.

**Build claims cross-checked here**

| Build claim | This review |
|---|---|
| Created-path parity held; two differential base-vs-head runs | Agree, by a different route: `deployResultFor` against the verbatim pre-R1 mapping, the pre-R1 test files run against the head, and the service/App/ceremony diffs read line by line (§5.4). |
| Six existing tests edited, none a shell test; the four service-driving files needed `getCurrentUser` because "without one every deploy orphans" | Agree, and proven: the merge-base copies of those four files fail 25 rows at the head, every one a `deployAgent` call the pre-R1 mock orphans (the mock lacks `getCurrentUser`, so the captured uid is null and the token boundary returns `orphaned(false)`; the sampled assertion diffs show `{ outcome: 'orphaned', … }` where a result was pinned, and a downstream assertion where only a side effect was) (§5.4). The two shell source-pin tests the build's §6 does not name (`holdDuringLiveBattle.test.js`, `commandCenterMultiBattle.wiring.test.js`) are also unmodified and green; a reporting omission, not a finding. |
| Recovery admission, `pickCeremonyEntry`, `CeremonyReveal`, `CeremonyError` byte-identical | Agree, proven by block extraction and blob ids (§5.5). |
| Nothing under `api/`; no fenced function edited | Agree (§1, criterion 6). |
| Report copy sha256 `c669…3d70f` | Verified: the blob at `95a04980`, the snapshot file and the Documents copy all hash to it. |
| Linux full suite 1029 files / 22,318 passed; `lint:gate` exit 0 | Not rerun here. |
| `vite build` exit 0 at the PR head | Reproduced on the snapshot (§6). |
| Every added or changed row was the failing row of a non-equivalent mutant | Consistent with my 16 mutants (16/16 killed), with one attribution caveat: see FR-3 below. |

**Finding by finding**

| Mine | In the build's record | Build's disposition | Does it hold? | New? |
|---|---|---|---|---|
| FR-1 existing answer lost behind the watchdog latch | **L3-6** (NIT): "An existing 200 that lands after a watchdog verification is lost — CONFIRMED, not a regression — Recorded" | recorded, no change | The disposition holds (non-blocking, not a regression). **Severity disagreement:** the build graded NIT; I grade MINOR, because the server gave a definitive answer and the player is told the deploy could not be confirmed. This review adds the first executable reproduction (two rows, real machine). The smallest fix touches the protected block, so it stays a follow-up either way. | recorded |
| FR-2 ceremony off: unavailable document → nothing shown | **§9 interpretation 10** (corrected after L3-11): "opens the owned document, or shows nothing if it cannot (as ceremony-off refusals always have)" | accepted as consistent with the off path | Holds as a description; I record it as a MINOR backlog item rather than an interpretation, because after a definitive server answer silence is a dead end. Dark in production. | recorded as an interpretation, not as a finding |
| FR-3 "after the POST" rows do not distinguish the after-POST guard | not recorded. §8.3 states every row was the failing row of some non-equivalent mutant — true of these rows too (other mutants red them); but the mutant that deletes the after-POST guard alone leaves the rows *titled* for that boundary green and is killed only by the `isCurrent` call-count rows | — | — | **new** (test integrity; no product defect) |
| FR-4 two user-retry vectors upstream of R1 | **L3-3** (Retry not deduplicated — S2b's), **L3-4** (sheet, Q4 applied), **§10 "R2 inherits"**; the same-render double call through the stale `deployDisabled` closure is not named | recorded for S2b / R2 | Holds. | partly new (the same-tick double call) |
| FR-5 account change after the result returns does not close the ceremony | **L2-2 / L4-6** (Q2 applied: closes on an `orphaned` result), **L2-6**, **§14 residual** ("closes when the result arrives, not at the switch; S2b's epoch") | recorded | Holds. | recorded |
| FR-6 verifier returns the first live document, not the one named | **L3-1** (documented and pinned; S2b's targeted read) | recorded | Holds. | recorded |
| FR-7 `Retry-After` exists on the limiter's 429 | **§2 starting-check row** ("a third 429"), **L4-2**, **Q3** applied | forwarded from the body | Holds. | recorded |
| FR-8 `isDefinitiveRefusal(503)` assumes decide.js origin | **§9 interpretation 1** states the assumption without naming the foreign-origin case | — | — | **new** (NIT, record only) |
| FR-9 carriage race 500 is a definitive non-creation typed `uncertain` | not named; the §4 "JSON 500" row covers it implicitly; §12 names the fenced root cause family | — | — | **new** (NIT, no change proposed) |
| FR-10 off path: CTA live during the read | **L3-11** | recorded | Holds. | recorded |
| FR-11 StrictMode double mount report | **L3-8** | recorded for S2b | Holds. | recorded |
| FR-12 tournament-only 503 omitted from the table | not named | — | — | **new** (NIT; unreachable for clients) |

**Build findings this review did not independently reach, and does not dispute:** L3-2 (the one primary button, fixed; verified by the build's refuter in Edge, not re-measured here), L3-5 (the theater shows a discarded portfolio for an already-running agent — server-side, fenced), L3-9, L3-10, L4-3, L5-14 (`realId` in four places), and the §12 fenced items. The build's Q1 ruling (`corrected_creation_failed` → `uncertain`) is consistent with my reading of `agentBattleService.js:339` and `stockThresholdAdmission.js:86`; its B2 residual (`creation_selection_changed` during a retry backoff) I did not try to reproduce.

**Net:** no finding here changes the verdict. The build's record already holds FR-1, FR-2, FR-4 (in part), FR-5, FR-6, FR-7, FR-10 and FR-11 under its own ids with dispositions that hold; FR-3, FR-8, FR-9, FR-12 and the same-tick half of FR-4 are new, none above MINOR. The one disagreement is the severity of FR-1 / L3-6, and it does not bear on the merge.
