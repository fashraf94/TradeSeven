# Independent review — Command Center slice S2b (the attempt provider, the hold, the real deploy)

Reviewer: Claude Fable 5.1, independent of the build. Date: 2026-10-23.
Brief: "Independent review brief — slice S2b", prepared 2026-10-23. Exit criteria 1–9 as fixed there.

## 1. Verdict

| | |
|---|---|
| **Verdict** | **DO NOT MERGE** under the brief's criteria as written. Two findings meet a blocking criterion by its letter; both rest on a decision only the founder can make (below). If the founder waives both, the verdict is **MERGE WITH CHANGES**: FRB-3's fix (provider-only, verified here) before the flip, and a ruling on FRB-4. |
| **Blocking findings** | **FRB-1** (criterion 4): a third flag-off change in today's shells' ceremony — "Deployment failed" → "Deployment refused" in `CeremonyError.jsx` (eyebrow, two headlines) and the live region of `DeployCeremony.jsx`. The code attributes it to founder rulings Q-S2b-2 and RL-1, which post-date the kickoff; the brief admits only R-S2b-9's two changes. Waivable by the founder confirming those rulings. **FRB-2** (criterion 5): with the ceremony on (its flag is `true` in production), a 409 review-due refusal's Forge action is never reachable and "Back to hub" acknowledges the refusal away. `decide.js` no longer sends that 409 (P1c ruling E1), so the path is live only for a server that does; the founder may rule it backlog. |
| **Reviewed head** | `origin/claude/command-center-hub-s2b` at `5e192c9bc57de49a93121ad6d5bf829f849bfe29` ("Command Center S2b: the report's RL-1 line (§15)", 2026-10-23 16:19 -0500). The brief's sha was blank, so the branch head was reviewed. Merge base with `main`: `82ea84bb` (= `origin/main` after `git fetch origin`). 54 files, +5,980 / −143. |
| **Contract available** | Spec V1.2 §5, §6 (line 217), §11.3 rows Ownership C2, Vocabulary C3, Existing battle R1, P1b refusal, Hold C4, Lifetime/intent — read. `CommandCenter_S2b_Kickoff_20261023.md` was **not attached** and is not in the repository, `Documents\FantasyTrades`, or Downloads; rulings R-S2b-1 … R-S2b-10 were taken from the brief's own statements (R-S2b-1 placement, R-S2b-9a/9b the two live changes) and from the code's citations of them. |
| **Setup** | `git fetch origin` first. Three `git archive` snapshots under the session scratchpad (`s2b-head` for reading and reproductions, `main-base` for the flag-off comparison, `s2b-mut` for the mutating lens), `node_modules` junction-linked. Read-only on git and on the working tree throughout. No browser. |

### Exit criteria, one line each

| # | Criterion | Result |
|---|---|---|
| 1 | More than one POST per intent | **Holds.** Every path to `deployAgent` goes through `startAttempt`, admitted by the §3.1 table and the reducer's `begin`/`retry` guards (`attemptReducer.js:175-188, 287-303`); the slot, the record's hold and the attempt's guard deny a second control, a tap, a key, a Retry, a remount, a width change and a late beat. Same-tick and same-frame orderings are covered by the build's rows and by M1, M3, M19, M36 below (killed); M14 and M37 survive as duplicates of the hook's own checks (section 4). |
| 2 | Wrong owner | **Holds.** `currentFor` (uid + auth epoch + attempt epoch + attempt id, `DeployAttemptContext.jsx:191-196`) gates every continuation; the service's own `stillOwned` gates token, clone, POST, body and handoff; Enter/Open re-check identity and the document's `ownerId` (`:681-706, :709-719`); an identity change cancels, revokes, orphans and cleans in its own task (`:321-337`). A→B→A moves the epoch twice; the stale-report guard holds (`attemptReducer.js:332-333`). |
| 3 | Existing shown as created | **Holds.** `existing_battle` translates once to `existing` (`attemptVocabulary.js:209-215`); the ceremony's `existing` terminal, the owned read and Open never call the create callback; no synthetic id anywhere in the diff. |
| 4 | Flag-off change | **FAILS by the letter — FRB-1.** Beyond R-S2b-9a (`useCeremonyStageMachine.js:380-393`) and R-S2b-9b (the 429 copy), the confirmed-refusal words of today's ceremony changed (`CeremonyError.jsx:39-40, :55, :100`; `DeployCeremony.jsx:182`). The provider itself is a true pass-through with the flag off (verified: no subscription, timer, listener, ceremony or bridge call). |
| 5 | Recovery or refusal meaning | **FAILS by the letter — FRB-2** (the 409's Forge action unreachable, ceremony on). The recovery admission and reveal are byte-identical (the diff is a pure insertion after them); the 429 review-due's line and no-auto-POST rule hold. |
| 6 | Due-idea check skipped | **Holds.** Hold, tap and the Scouting Board run `checkDueIdea` before the ceremony and the POST; only a Retry skips it (`DeployAttemptContext.jsx:424-439`); M8 killed. |
| 7 | Hold or beat broken | **Holds.** Denied claims return before any effect; cancellation-first deploys nothing; commitment-first deploys exactly once after 450 ms; the provider owns the beat across unmount and width change; no cancellation is shown while a completion is authorized. M2, M5, M11, M23, M24, M29, M30 killed; M14 survives as a duplicate of the hook's own check (section 4). |
| 8 | Uncertain retried too early | **Holds.** Dismissal keeps the guard; only an owned clear reconciliation (the target-scoped verifier, or the ceremony's confirmed "no battle") admits Retry, and Retry waits for the owner+target cooldown, which survives dismissal. M6, M7, M35 killed. |
| 9 | Fenced or `api/` edits | **Holds.** `git diff --name-only 82ea84bb 5e192c9b` touches nothing under `api/` and no fenced file. |

### Files read (at the reviewed head)

`src/contexts/DeployAttemptContext.jsx`; `src/hooks/holdClaim.js`, `src/hooks/useHoldToDeploy.js`, `src/components/Dashboard/deployCeremony/HoldToDeployButton.jsx`; `src/components/CommandCenter/CommandCenterHub.jsx`, `hub/useHubDeploy.js`, `hub/useHubReaders.js`, `hub/useHubSheets.js`, `hub/HubOverlays.jsx`, `hub/overlayStack.js`, `hub/hubFlags.js`, `hub/hubModel.js`, `hub/hubCopy.js`, `hub/deployDisplay.js`, `hub/selectors/attemptReducer.js`, `attemptVocabulary.js`, `deployState.js`, `readerInputs.js`, `ownership.js`, `sections/HubHold.jsx`, `sections/DeploySection.jsx`, `sections/NextActionCard.jsx`, `DeployStrip.jsx`, `PhoneTabs.jsx`, `ShadowStage.jsx`, `CommandCenterHubGate.jsx`, `__fixtures__/deployAttemptKit.jsx`; `src/App.jsx` (the diff, `hubProps`, `clearCeremonyStash`, `handleEnterCeremonyBattle`, `handleCreateAgentTrainingBattle`, `handleOpenAgentBattle`); `src/components/Dashboard/deployCeremony/useCeremonyStageMachine.js`, `DeployCeremony.jsx`, `CeremonyError.jsx`, `CeremonyExisting.jsx`, `DueIdeaInterstitial.jsx` (portal), `src/components/Dashboard/deployResult.js`, `ScoutingBoardSheet.jsx` (footer), `CommandDashboard.jsx` (`handleDeploy`); `src/constants/deployOutcomes.js`; `src/services/ownedBattleRead.js`, `authIdentity.js`, `agentBattleVerify.js` (`findActiveBattleForAgent`); read only: `src/services/agentDeploy.js`, `src/services/dueIdeaCheck.js`, `api/agent/decide.js` (the 429/409/existing branches); the diffs of every test the branch adds or amends (titles and harnesses).

### Tests run

- Bounded set at the head snapshot (`vitest run --maxWorkers=6`): the provider's three suites, the hold's six (`holdClaim*`, `useHoldToDeploy.*`), every `deployCeremony/*.test.*`, the shells' deploy tests (`deployShells.p1c/r1.guard`, `deployHandoff`, `deployResult`, `holdDuringLiveBattle`, `App.deployHandoff`, `App.deploySettle`), the sky tests (`starfield.intent/inert/tint/depstability/importguard`, `warpStateMachine`), and the hub's S2b rows (`CommandCenterHub.s2b`, `commandCenterHub.mount.guard`, `deployDisplay(.rulings)`, `attemptReducer.s2b`, `readerInputs.s2b`, `hubCopy.guard`, `selectors.purity.guard`, the two theme guards): **47 files, 1,430 rows, all green, 25 s.**
- Reviewer rows (appendix A), at the head: `DeployAttemptContext.fableReview.jsdom.test.jsx` — **6 rows, 6 red** (each on its finding's assertion). `fableReview.flagOff.jsdom.test.jsx` — **2 red at the head, 2 green at the merge base.**
- The two provider fixes proposed below (FRB-2, FRB-3/FRB-5), applied to a copy of the provider: the three reviewer rows they address turn green, the provider's three suites and the hub's S2b suite stay green (148 rows); the provider file was then restored byte-identical to the head object.
- Mutating lens: 38 mutants over the guards behind criteria 1–8 (section 4).
- Not run: the full suite, `vite build`, any browser.

## 2. Findings, most severe first

### FRB-1 — BLOCKER (criterion 4). A third flag-off change: the confirmed refusal's words in today's shells' ceremony

- `src/components/Dashboard/deployCeremony/CeremonyError.jsx:39-40` (the generic `deploy` and `server` headlines), `:55` + `:100` (the eyebrow `REFUSED_EYEBROW`), `src/components/Dashboard/deployCeremony/DeployCeremony.jsx:182` (the live region's `'Deployment refused.'`). Merge base: `'Deployment failed — no battle was created.'`, eyebrow `'Deployment failed'`, live region `'Deployment failed.'`.
- `DEPLOY_CEREMONY_ENABLED` is `true` (`featureFlags.js:1503`), so with the hub flag false every player who reaches a confirmed refusal in CommandDashboard / CommandDashboardDesktop reads the new words. This is not one of R-S2b-9's two changes (9a: the existing terminal after the watchdog; 9b: the 429 in-progress copy). The code cites founder rulings Q-S2b-2 and RL-1 (the build's §15); those rulings are not in the brief's criterion.
- Reproduction: appendix B row "eyebrow and generic headline: the merge base's words" renders `<CeremonyError errorTone="confirmed" errorKind="deploy" />` and expects the merge base's text. Green on `main-base`, red on `s2b-head` (`Received: … Deployment refused — no battle was created.`).
- Smallest fix: none if the founder confirms Q-S2b-2 and RL-1 as rulings that extend R-S2b-9; the finding then records a sanctioned third change. Otherwise revert the four strings (the hub keeps its own "Deployment refused" word; `hubCopy.guard.test.js:356-380` and `ceremonyTerminalState.test.jsx:663, :730, :879, :899-909` pin the new words and would move back with it).

### FRB-2 — BLOCKER (criterion 5). Ceremony on, a 409 review-due refusal's Forge action is unreachable, and "Back to hub" drops it

- `src/contexts/DeployAttemptContext.jsx:654-665` (`dismiss` acknowledges every refused terminal), `:744-747` (`retryActionNow` is true only for `RETRY`, so the ceremony gets no action for `OPEN_FORGE_REVIEW`), `:861-865` (the app root is inert while the ceremony is open); `CeremonyError.jsx:114` (its only actions are Retry and Back to hub); `hub/useHubDeploy.js:99-108` (the Forge action lives on the hub's card and strip only).
- Sequence: hold → ceremony opens → 409 `hypothesis_review_due` → the record is `refused` / `review_due` with the shared line; the ceremony shows the line under its error surface with "Back to hub" only; the hub beneath carries "Open in the Forge" but is inert; "Back to hub" → `dismiss()` → the refusal is acknowledged (`idle`) and the hub shows ready. The player never had the §5.4 primary action ("For review-due refusal, primary action opens the equipped idea's Forge list editor"); §11.3 "P1b refusal: working Forge review action".
- Reproduction: appendix A rows "a 409 review-due (P1b): the Forge action must be reachable…" (red: no Forge control in the overlay; `#root` is `inert`) and "…Back to hub must not drop the Forge action the hub carries" (red: `state().action` is `null` after Back to hub; `onOpenForge` never called). The build's own row (`DeployAttemptContext.ceremony.jsdom.test.jsx:174-193`) presses the hub's action through the probe while the ceremony is open, which a player cannot do.
- Reachability: `agentDeploy.js:283` records that the 409 review-due is gone since P1c ruling E1; `api/agent/decide.js` sends no `hypothesis_review_due` today. The path is live only for a server that does. The founder may rule it backlog; by the brief's letter it blocks.
- Smallest fix (provider only, verified): in `dismiss()`, when the attempt is `refused` with `result.kind === 'review_due'` and its ceremony is not yet `closed`, close the ceremony and record `ceremonyPhase: closed` instead of acknowledging — the hub then shows the line with "Open in the Forge" and Q-S2b-4's "Dismiss":
  ```js
  if (ceremony?.attemptId === a.attemptId) ceremony = { ...ceremony, visible: false };
  if (a.phase === ATTEMPT_PHASES.REFUSED && a.result?.kind === RESULT_KINDS.REVIEW_DUE && a.ceremonyPhase !== CEREMONY_PHASES.CLOSED) {
    apply({ type: T.CEREMONY_PHASE, attemptId: a.attemptId, attemptEpoch: a.attemptEpoch, phase: CEREMONY_PHASES.CLOSED, errorTone: null });
    changed();
    return;
  }
  ```
  With it the row turns green; `dismissRefusal` (the hub's Dismiss) and the Forge action's own `api.dismiss()` still acknowledge, since both run with `ceremonyPhase` already `closed`.

### FRB-3 — MAJOR. An existing answer whose hand-off waits for the owned read: the watchdog can latch "Couldn't confirm" inside that wait, and the remount decision has already been taken

- `src/contexts/DeployAttemptContext.jsx:473` (`ceremonyBefore` read at result time), `:486-487` (`remount` decided then, `ERROR` only), `:488-492` (`handTheCeremony` reuses that decision), `:511-513` (for `existing` the hand-off is deferred until `hydrate` settles — up to `EXISTING_READ_DEADLINE_MS` 8 s). Machine: `useCeremonyStageMachine.js:526-538` (the 90 s watchdog), `:355-356` (a `pending` result has `postIssued` false, so nothing is admitted), `:389-393` (R-S2b-9a reads `existing` only while the check is still running), `:404-409` (otherwise `lost_contact`, latched).
- Window: the server's `battleCreated:false` lands within ~8 s before the watchdog fires (or while `deployProgress` was never pinned as ours, when the watchdog counts from mount). The record becomes `existing` at once; the ceremony still holds `{ status: 'pending' }`; the watchdog's check ends `lost_contact`; the owned read settles; the hand-off finds a latched machine and, with `remount` false, changes nothing. The hub says "Already running · Open game", the ceremony says "Deployment unconfirmed — Couldn't confirm the deploy." (§5.2 one vocabulary; the same disagreement R-S2b-9a was ruled in to remove, through the window S2b's deferral opened). No second POST, no false creation, so not a blocking criterion.
- Reproduction: appendix A row "existing: the owned read is still out when the watchdog latches the error…" (red at head: `Received: …Couldn’t confirm the deploy. Back to hub…`, `attempt().phase === 'existing'`).
- Smallest fix (provider only, verified — the row turns green, 148 existing rows stay green): decide the fresh ceremony **at hand-off time as well**, from the record's ceremony phase the machine has since reported:
  ```js
  const handTheCeremony = () => {
    if (!isCurrent() || ceremony?.attemptId !== attemptId) return;
    const latchedSince = state.attempt?.ceremonyPhase === CEREMONY_PHASES.ERROR;
    const fresh = remount || (latchedSince && (phase === ATTEMPT_PHASES.CREATED || phase === ATTEMPT_PHASES.EXISTING));
    ceremony = { ...ceremony, deployResult: deployResultFor(result), ...(fresh ? { key: `${attemptId}:answer` } : {}) };
    changed();
  };
  ```

### FRB-4 — MAJOR. In the ceremony, every definitive refusal but the 429 in-progress reads as lost contact while the hub (and the record) say "Deployment refused"

- `useCeremonyStageMachine.js:516-519` (a client `error` result starts a verification), `:355-356` (a 4xx is never admitted), `:399-404` (the `confirmed` tone needs the server's own error checkpoint, which a pre-decision refusal never writes), so the terminal is `error` / `lost_contact`; `CeremonyError.jsx:71` (only `errorTone === 'confirmed'` or `inProgress` select the refused words); `DeployCeremony.jsx:180-182` (the live region likewise). The record's translation (`attemptVocabulary.js:160-161`) stores the refusal with the `confirmed` tone and the hub shows "Deployment refused" (`hubCopy.js:341`).
- So a 429 cooldown ("Please wait 2 minutes between deploys"), a 503 pricing gate, a 400/403/404 — and the 409 review-due of FRB-2 — show on the hub as "Deployment refused · <server line> · Retry" and in the ceremony above it as "Deployment unconfirmed / Couldn't confirm the deploy. <server line> / Try again". Spec §5.2's refused row is "error with confirmed-refusal tone … unchanged server detail"; §5.2 also says a definitive refusal "cannot … be hidden behind generic lost-contact copy". R-S2b-9b repaired exactly one refusal this way (`inProgress`); the others are unchanged from the shells, which the build's own control rows pin ("the 429 cooldown … is unchanged: lost contact, as before").
- Reproduction: appendix A row "a 429 cooldown refusal: the hub says 'Deployment refused'; the ceremony must not hide it behind lost-contact copy" (red at head: `Received: …Deployment unconfirmedCouldn’t confirm the deploy.Try again…`).
- Smallest fix needs a founder ruling, because either shape changes today's shells or the hub's ceremony: (a) extend R-S2b-9b's pattern to every typed `refused` result — `deployResultFor` forwards `refused: true` for `outcome === 'refused'`; `DeployCeremony` passes it as `CeremonyError`'s existing `inProgress`-style override (eyebrow "Deployment refused", the generic headline, `CONFIRMED_SUBTEXT`); a live change in the shells as 9b was; or (b) provider-only: for a refused answer, do not hand the ceremony the result; close it (`visible: false`, `ceremonyPhase: closed`) so the hub's own refused line with Retry and Dismiss (Q-S2b-4) is what the player reads. Until one is ruled, FRB-4 is a recorded one-vocabulary gap of the ceremony-on path.

### FRB-5 — MINOR. A created answer that lands while the watchdog's check is in flight ends "Couldn't confirm", and Back to hub then acknowledges the creation and clears its stash

- `DeployAttemptContext.jsx:486-487` (`remount` only for `ceremonyBefore === ERROR`; a `VERIFYING` machine is left to finish its check), `useCeremonyStageMachine.js:355-356` (the `success` shape carries no `postIssued`, so the found battle is not admitted), `:404-409`; `DeployAttemptContext.jsx:658-663` (`dismiss` of a `created` terminal clears its stash).
- Window: `VERIFY_BUDGET_MS` 2 s after the 90 s watchdog. The same race exists in today's shells; S2b's remount is the mechanism that could close it for the hub.
- Reproduction: appendix A row "created: the answer lands while the watchdog's check is in flight…" (red at head).
- Smallest fix (verified together with FRB-3's): also remount when the machine was `verifying` at result time and the answer is a creation —
  ```js
  const latchedBefore = ceremonyBefore === CEREMONY_PHASES.ERROR
    || (ceremonyBefore === CEREMONY_PHASES.VERIFYING && phase === ATTEMPT_PHASES.CREATED);
  const remount = latchedBefore && (phase === ATTEMPT_PHASES.CREATED || phase === ATTEMPT_PHASES.EXISTING);
  ```
  (The fresh machine then runs its theater again before the reveal; the H1 success grace reveals it.)

### FRB-6 — MINOR. A refusal under a provider-known cooldown: the hub's ceremony offers no Retry and no countdown until the bound passes

- `DeployAttemptContext.jsx:944` (`onRetry` only when `retryAdmitted`), `:955-959` (which asks the table now; a cooldown or any other block withholds it), `CeremonyError.jsx:114-127` (the countdown "Retry available in Ns" renders only when `onRetry` is given). The shells always hand `onRetry` and show the countdown from the target document's `lastDeployedAt`.
- The clock effect (`:852-857`) re-renders when the bound passes and the button then appears, so the player sees "Back to hub" alone for the whole cooldown, with no time named.
- Reproduction: appendix A row "a refusal under a known cooldown (the limiter's Retry-After)…" (red at head: no Retry control in the overlay; `retryBlock.displayState === 'cooldown'`).
- Smallest fix: hand `onRetry` whenever the record's phase admits a Retry in principle (`refused` of kind `refused`, or `uncertain` with a `clear` reconciliation) and leave the press-time refusal to `retry()` (which already re-asks the table and starts nothing when blocked). The ceremony's own countdown then shows from the target's stamp; a Retry-After bound the target document does not know still has no countdown — passing the record's `cooldownUntil` as a further optional ceremony prop would close that, at the cost of a shells'-component edit.

### FRB-7 — NIT. The cooldown-evidence listener can outlive its usefulness

- `DeployAttemptContext.jsx:881-891`: after acknowledgment, `TargetEvidence` keeps the target's document listener until a bound for owner+target is known. A refusal that reached the server before the decision write (a 503 pricing gate, a 403) never stamps `lastDeployedAt`; for an agent with no earlier stamp the listener lives until the next attempt replaces the record. One listener on the owner's own agent (or clone) document; flag-on only. Fix: unmount it when `result.kind` is `refused` with a status that precedes the decision write, or after one snapshot with `targetKnown`.

### FRB-8 — NIT. The active poll is refreshed after every outcome, refusals included

- `DeployAttemptContext.jsx:509`: `refreshActiveBattles()` runs after a refused or uncertain answer too. Spec §6 names existing/recovered reconciliation as the refresh trigger. One extra owned poll per refused attempt. Fix: refresh for `created` and `existing` only (uncertain is resolved by the verifier, not the poll).

### FRB-9 — NIT. The ceremony offers no Retry while the hub is not mounted

- `DeployAttemptContext.jsx:744-747`: `retryActionNow` needs the hub's registered inputs; with the hub unmounted (`inputsGetter` null) a refusal's ceremony shows only "Back to hub". Reachable only through a programmatic navigation while the ceremony is open, since the root is inert. Fix: none needed; recorded.

## 3. What I did not check

- The kickoff's exact wording of R-S2b-1 … R-S2b-10 (not attached). Where this review names a ruling it is as the code cites it.
- A real browser: no pointer capture, touch, or framer-motion timing was exercised; every reproduction runs the real components under jsdom with fake timers and a controllable `requestAnimationFrame`.
- `vite build`; the full suite; the Linux suite; the rules suite. The 32 Windows-only rows were not in the bounded set.
- The Scouting Board's footer against the real `ScoutingBoardSheet` network (the hub's S2b suite stubs the sheet; I read the real footer, `ScoutingBoardSheet.jsx:126-143`, and the provider's admission for its tap).
- App's root at runtime (the flag-off test pins App's wiring from source; I read `App.jsx:10348-10360` and the handlers; I did not render App).
- The server: `decide.js` was read, not run; the 120 s lock, the per-agent cooldown and the existing branch (`:180-195`, `:750-790`) are as the code states.
- Firestore rules for `agentBattles` reads by id (the owned read assumes the owner-only read rule the service header cites).
- The build report, the PR description's review section and the build's smoke branch — not read before this section was written (section 5 below is the reconciliation).

## 4. Test integrity (question 9) — the mutating lens

Each mutant is one edit to a guard behind criteria 1–8, applied on its own snapshot tree and run against the provider's three suites, the hub's S2b suite, the hold's seam/R2/R2-review suites, both `holdClaim` suites, every `hub/selectors/` test, the ceremony's watchdog/in-progress/founder-rulings/terminal-state/existing suites, `hubCopy.guard` and `deployDisplay.rulings` (17 files). KILLED = at least one row red.

**Tally:** 38 mutants — **31 killed**, **7 survived** (7 judged equivalent or covered upstream, two of them with a MINOR test gap noted), 0 not applied. No survivor lets a defect behind criteria 1–8 through.

| Mutant | Guard behind | File | Outcome | Rows | First red row, or the survivor's reason |
|---|---|---|---|---|---|
| M1 | criterion 1/7 — claim admitted only when the table says canStart | `src/contexts/DeployAttemptContext.jsx` | **KILLED** | 1 red | "G1 claim admission is the provider own, same task: an overlay opened and a press before any render" |
| M2 | criterion 7 — the threshold re-asks the table (canCommit) | `src/contexts/DeployAttemptContext.jsx` | **KILLED** | 1 red | "G2 the threshold re-asks the table: a cooldown that appears mid-charge commits nothing" |
| M3 | criterion 1 — begin refuses while an attempt stands | `src/components/CommandCenter/hub/selectors/attemptReducer.js` | **KILLED** | 13 red | "a same-tick repeat is refused by the reducer too: the same state comes back" |
| M4 | criterion 2 — a capture is current only at its attempt epoch | `src/contexts/DeployAttemptContext.jsx` | **SURVIVED** | 0 red | EQUIVALENT: `currentFor` also requires `state.attempt?.attemptId === r.attemptId`, and attempt ids are unique per attempt (`attempt_<seq>_<now>`); every path that moves the attempt epoch also changes the id or the identity. Defense in depth. |
| M5 | criterion 7 — a denied second finger's lift does not cancel (R2 Q5) | `src/hooks/useHoldToDeploy.js` | **KILLED** | 3 red | "R2 Q5 (fails on the legacy hook): a denied second finger lifting does not cancel the first finger's hold" |
| M6 | criterion 8 — dismissing an uncertain attempt keeps its guard | `src/components/CommandCenter/hub/selectors/attemptReducer.js` | **KILLED** | 8 red | "uncertain → dismissed → no fresh POST: no hold, tap or Retry until an owned clear result" |
| M7 | criterion 8 — Retry waits for the owner+target cooldown | `src/components/CommandCenter/hub/selectors/attemptReducer.js` | **KILLED** | 1 red | "waits for the owner + target cooldown; without a clock it cannot see the bound pass" |
| M8 | criterion 6 — the due-idea check runs before a hold's or tap's POST | `src/contexts/DeployAttemptContext.jsx` | **KILLED** | 44 red | "an identity change while the due-idea screen waits: the screen closes, and no deploy call is ever made" |
| M9 | R-S2b-9a — an existing answer after the watchdog ends existing | `src/components/Dashboard/deployCeremony/useCeremonyStageMachine.js` | **KILLED** | 3 red | "RACE: the answer lands while the watchdog's check runs, the check finds the running battle → the existing term" |
| M10 | R-S2b-9b — the 429 in-progress headline | `src/components/Dashboard/deployCeremony/CeremonyError.jsx` | **KILLED** | 2 red | "the ceremony: "A deploy is already in progress." — not "Couldn't confirm the deploy" — and the live region say" |
| M11 | criterion 2/7 — an identity change revokes the committed beat | `src/contexts/DeployAttemptContext.jsx` | **KILLED** | 1 red | "G8 an identity change in the beat returns the control to idle: a fresh hold can start at once" |
| M12 | criterion 2 — the owned read checks the owner | `src/contexts/DeployAttemptContext.jsx` | **KILLED** | 2 red | "a foreign document from the read is no answer: nothing opens" |
| M13 | criterion 2 — Enter checks the document's owner | `src/contexts/DeployAttemptContext.jsx` | **SURVIVED** | 0 red | EQUIVALENT: a carried-in document is owner-checked at `:683`; a recovered or hydrated one was owner-checked when stored (`:619-622`, `:557`). The second check at `:705` repeats them. |
| M14 | criterion 7 — a committed beat whose slot was revoked deploys nothing | `src/contexts/DeployAttemptContext.jsx` | **SURVIVED** | 0 red | EQUIVALENT: the hook's `run` (`useHoldToDeploy.js:377`) returns before `onComplete` when the slot no longer holds the token, and `revokeBeat` nulls `committed` first. The provider's check repeats it. |
| M15 | R-S2b-3 — a claim with a malformed input or epoch fails closed | `src/hooks/holdClaim.js` | **KILLED** | 1 red | "a malformed input or epoch grants nothing and leaves the slot empty (fails closed)" |
| M16 | criterion 2 — a stale ceremony report cannot change a later attempt | `src/contexts/DeployAttemptContext.jsx` | **KILLED** | 1 red | "G24 a stale ceremony report on an uncertain attempt reads nothing" |
| M17 | criterion 2 — App releases only that battle's stash | `src/App.jsx` | **KILLED** | 1 red | "the stash release App adds takes only that battle's stash" |
| M18 | criterion 7 — a late release cannot drop the hold an attempt owns | `src/components/CommandCenter/hub/selectors/attemptReducer.js` | **KILLED** | 1 red | "a hold that admitted a request belongs to it: a late release cannot drop it; the attempt's end does" |
| M19 | criterion 1 — a tap is admitted by the table | `src/contexts/DeployAttemptContext.jsx` | **KILLED** | 66 red | "G3 a tap is admitted by the table, not only the reducer: a known cooldown refuses it" |
| M20 | R-S2b-9b — the 429 in-progress live region | `src/components/Dashboard/deployCeremony/DeployCeremony.jsx` | **KILLED** | 1 red | "the ceremony: "A deploy is already in progress." — not "Couldn't confirm the deploy" — and the live region say" |
| M21 | FR-1 post-check half — a late created/existing answer gets a fresh ceremony | `src/contexts/DeployAttemptContext.jsx` | **KILLED** | 2 red | "the post-check half of FR-1: a creation that answers after the ceremony's check already settled on its error g" |
| M22 | W3 — the control leaves Locked in once the request is out | `src/hooks/useHoldToDeploy.js` | **KILLED** | 1 red | "G10 once the request is out the control no longer says Locked in" |
| M23 | criterion 7 — a tab change cancels a charge | `src/components/CommandCenter/CommandCenterHub.jsx` | **KILLED** | 1 red | "mobile: a tab change while the strip charges cancels it (spec §5.5) — no deploy" |
| M24 | criterion 7 — an overlay opening cancels a charge in its task | `src/components/CommandCenter/hub/HubOverlays.jsx` | **KILLED** | 2 red | "the board's deploy cannot bypass a charging hold: opening the board cancels the charge first" |
| M25 | criterion 2 — an identity change frees the in-flight hold's slot (W2-1) | `src/contexts/DeployAttemptContext.jsx` | **KILLED** | 1 red | "W2-1: an identity change frees the slot of a hold whose request is still out — the new account's hold claims a" |
| M26 | R-S2b-2 — a stale identity report (epoch at or below) changes nothing | `src/components/CommandCenter/hub/selectors/attemptReducer.js` | **KILLED** | 2 red | "authChanged takes the source's epoch; one at or below the current is a stale report and changes nothing" |
| M27 | criterion 2 — a late answer for a former owner shows nothing | `src/contexts/DeployAttemptContext.jsx` | **SURVIVED** | 0 red | NEAR-EQUIVALENT, one effect escapes: the reducer refuses the late result (`current` fails), the ceremony and run are already null, `hydrate` finds no attempt — but `refreshActiveBattles()` (`:509`) still runs once for the new account, a read of its own battles. No row pins "no refresh after an orphaned answer". Test gap, MINOR. |
| M28 | criterion 2 — App's handoff only through the provider's check | `src/contexts/DeployAttemptContext.jsx` | **KILLED** | 1 red | "an identity change while the request is out: the late answer shows the new account nothing, hands App nothing," |
| M29 | criterion 7 — a denied claim returns before any effect (seam path) | `src/hooks/useHoldToDeploy.js` | **KILLED** | 14 red | "a runtime disable: a charging hold cancels and no new attempt starts; a committed one completes once" |
| M30 | criterion 7 — canCommit re-asks the whole table | `src/components/CommandCenter/hub/selectors/deployState.js` | **KILLED** | 12 red | "G2 the threshold re-asks the table: a cooldown that appears mid-charge commits nothing" |
| M32 | criterion 2 — the ceremony's owned Retry checks the owner | `src/components/Dashboard/deployCeremony/CeremonyExisting.jsx` | **KILLED** | 1 red | "with `ownedRead`: a battle that is not the server's, or not the signed-in owner's, stays unavailable — and a r" |
| M33 | criterion 2 — the owned read service checks the owner | `src/services/ownedBattleRead.js` | **SURVIVED** | 0 red | COVERED UPSTREAM: the provider re-checks `battle.ownerId === r.capturedUid` at `:557`, so a foreign document never opens; the service's own contract ("owner checked") has no unit row of its own. Test gap, MINOR. |
| M34 | criterion 2/3 — Open game opens only the named owned battle | `src/contexts/DeployAttemptContext.jsx` | **KILLED** | 1 red | "G20 Open game opens only the battle the record names, for its owner" |
| M35 | criterion 8 — the hub's Dismiss never acknowledges an uncertain attempt | `src/contexts/DeployAttemptContext.jsx` | **KILLED** | 2 red | "a refusal the open ceremony shows: no Dismiss on the hub, and the entry does nothing (the ceremony's Back to h" |
| M36 | criterion 1 — a Retry cannot bypass another control's charging hold | `src/components/CommandCenter/hub/selectors/attemptReducer.js` | **KILLED** | 2 red | "refused with a stale prior tag, another identity, a disabled flag, a reused id or another control's hold" |
| M37 | criterion 7 — the owner takes only the beat of the hold it committed | `src/contexts/DeployAttemptContext.jsx` | **SURVIVED** | 0 red | EQUIVALENT: the hook calls `beatOwner.commit(token, run)` inside the same synchronous `fireComplete` in which `seam.commit(token)` has just set `committed = { token }` (`useHoldToDeploy.js:343-431`); no other caller exists, so the token test cannot fail from the hook. |
| M38 | criterion 2 — the root's unmount releases a beat it will never run | `src/contexts/DeployAttemptContext.jsx` | **SURVIVED** | 0 red | EQUIVALENT: when the root unmounts, the beat timer is in `timers` and the sweep clears it (`:354`), `releaseInFlightHold()` frees the committed hold (`:350`; its record is `locked`), and `revoked = true` stops any run. `revokeBeat` there repeats all three. |
| M40 | X8 — the Scouting Board's tap is exempt only from the board itself | `src/contexts/DeployAttemptContext.jsx` | **KILLED** | 24 red | "X8: the Scouting Board's tap is exempt only from the board itself — a second overlay above it refuses it" |

## Appendix A — the reviewer's provider rows (as run; red at the head)

Path in the snapshot: `src/contexts/DeployAttemptContext.fableReview.jsdom.test.jsx`.

```jsx
// @vitest-environment jsdom
//
// Independent review of slice S2b (Fable, 2026-10-23) — reproductions. The hub's
// attempt through the REAL deploy ceremony and its REAL stage machine, under a
// fake clock (setInterval, setTimeout, Date and performance.now all fake; rAF
// controllable and never run), with the deploy service, the verifier and the
// owned read as stand-ins a row answers. Each row below asserts what spec V1.2
// §5.2 / §5.4 says the player should see; a row that FAILS at the reviewed head
// is the finding's proof.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const h = vi.hoisted(() => ({
  authListeners: [],
  deploy: null,
  verify: null,
  owned: null,
  targetProgress: { deployProgress: null, lastDeployedAt: null, lastDecision: null, targetKnown: false },
}));

vi.mock('firebase/auth', () => ({ onAuthStateChanged: (_auth, cb) => { h.authListeners.push(cb); return () => {}; } }));
vi.mock('../firebase/config', () => ({ db: {}, auth: { currentUser: { uid: 'uid-A' } } }));
vi.mock('../services/agentDeploy', () => ({ deployAgent: (...args) => h.deploy(...args) }));
vi.mock('../services/dueIdeaCheck', () => ({ checkDueIdea: async () => null }));
vi.mock('../services/agentBattleVerify', () => ({ findActiveBattleForAgent: (...args) => h.verify(...args) }));
vi.mock('../services/ownedBattleRead', () => ({ readOwnedBattle: (...args) => h.owned(...args) }));
vi.mock('../hooks/useDeployTargetProgress', () => ({ default: () => h.targetProgress }));
vi.mock('../hooks/useModalFocus', () => ({ default: () => {} }));
vi.mock('../components/Research/useMarketContext', () => ({ default: () => ({ marketContext: null }) }));
vi.mock('../components/Dashboard/deployCeremony/ceremonyData', async (importOriginal) => ({
  ...(await importOriginal()),
  useEquippedWatchlistSymbols: () => ({ symbols: [] }),
}));
vi.mock('../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  isDeploySkyCouplingOn: () => false,
  isDeployCeremonyOn: () => true,
}));

import { resetAuthIdentityForTests } from '../services/authIdentity';
import { __resetHoldClaim } from '../hooks/holdClaim';
import { DeployAttemptProvider } from './DeployAttemptContext';
import { deployDisplay, DISPLAY_ACTIONS } from '../components/CommandCenter/hub/deployDisplay';
import { DEPLOY_REFUSAL_CODE, DUE_DEPLOY_LINE } from '../constants/hypothesisRecords';
import { FakeHub, HubRoot, createFrames } from '../components/CommandCenter/__fixtures__/deployAttemptKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
vi.setConfig({ testTimeout: 60000 });

const T0 = 1_800_000_000_000;
const CARD = 'hub-deploy-card';
const RUNNING = { id: 'battle-running', ownerId: 'uid-A', agentId: 'agent-uid-A', status: 'active' };
let nowMs;
let frames;
let container;
let root;
let probe;
let bridge;
let posts;
let pendingVerify;

const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

const EXISTING = () => ({ outcome: 'existing_battle', success: false, existingBattleId: RUNNING.id, postIssued: true, httpStatus: 200 });
const CREATED = () => ({ outcome: 'created', success: true, agentBattleId: 'battle-new' });
const REVIEW_DUE = () => ({ outcome: 'refused', success: false, postIssued: true, httpStatus: 409, status: 409, error: DEPLOY_REFUSAL_CODE, details: DUE_DEPLOY_LINE });
const COOLDOWN_429 = () => ({ outcome: 'refused', success: false, postIssued: true, httpStatus: 429, status: 429, error: 'Please wait 2 minutes between deploys', reason: 'cooldown' });
const LIMITER_429 = () => ({ outcome: 'refused', success: false, postIssued: true, httpStatus: 429, status: 429, error: 'Too many requests', retryAfter: 90 });

const text = () => document.body.textContent || '';
const overlay = () => document.querySelector('.deploy-ceremony-overlay');
const buttons = () => [...document.body.querySelectorAll('button')];
const button = (label) => buttons().find((b) => (b.textContent || '').includes(label) || b.getAttribute('aria-label') === label);
const attempt = () => probe.current.snapshot?.state?.attempt ?? null;
const state = () => probe.current.state;

const signIn = (uid) => act(() => { for (const cb of [...h.authListeners]) cb(uid ? { uid } : null); });
const jump = async (ms) => { await act(async () => { nowMs += ms; vi.setSystemTime(nowMs); vi.advanceTimersByTime(100); }); };
const advance = async (ms) => { await act(async () => { nowMs += ms; vi.advanceTimersByTime(ms); }); };
const flush = async () => { await act(async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); }); };
const tap = async () => { act(() => { probe.current.deploy.tap(CARD); }); await flush(); };

/** The watchdog's check: the verifier answers "no battle" twice (its 400 ms second look included), the machine ends on its tone. */
const checkRunsEmpty = async () => {
  await advance(100);
  await flush();
  await advance(400);
  await flush();
  await flush();
};

beforeEach(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  }
  resetAuthIdentityForTests();
  __resetHoldClaim();
  h.authListeners = [];
  h.targetProgress = { deployProgress: null, lastDeployedAt: null, lastDecision: null, targetKnown: false };
  h.verify = vi.fn(async () => ({ found: false, battle: null }));
  h.owned = vi.fn(async () => null);
  posts = [];
  pendingVerify = null;
  h.deploy = vi.fn((agentId, onCreate, onTarget) => {
    const d = deferred();
    posts.push({ agentId, onCreate, onTarget, answer: d.resolve });
    onTarget?.(agentId);
    return d.promise;
  });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  nowMs = T0;
  vi.setSystemTime(T0);
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
  frames = createFrames();
  vi.stubGlobal('requestAnimationFrame', frames.request);
  vi.stubGlobal('cancelAnimationFrame', frames.cancel);
  bridge = {
    onCreateAgentBattle: vi.fn(() => 'battle-new'),
    onEnterBattle: vi.fn(),
    onOpenBattle: vi.fn(),
    refreshActiveBattles: vi.fn(),
    clearCeremonyStash: vi.fn(),
    onOpenForge: vi.fn(),
    userName: 'flash',
  };
  probe = { current: null };
  container = document.createElement('div');
  container.id = 'root'; // App's root: the provider marks it inert while its overlay is open
  document.body.appendChild(container);
  root = createRoot(container);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  act(() => {
    root.render(
      <DeployAttemptProvider hubEnabled {...bridge}>
        <HubRoot><FakeHub controls={[CARD]} probe={probe} hub={{ onOpenForge: bridge.onOpenForge }} /></HubRoot>
      </DeployAttemptProvider>,
    );
  });
  signIn('uid-A');
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('FRB — the hand-off to the ceremony after the watchdog (R-S2b-9a, the half the provider owns)', () => {
  it('existing: the owned read is still out when the watchdog latches the error — the record says existing, the ceremony must too (§5.2 one vocabulary)', async () => {
    const read = deferred();
    h.owned = vi.fn(() => read.promise);
    await tap();
    expect(overlay()).not.toBeNull();
    expect(posts).toHaveLength(1);

    // 89 s of theater, then the server's "already running" answer. Its hand-off to the ceremony waits for the owned read.
    await jump(89000);
    posts[0].answer(EXISTING());
    await flush();
    expect(attempt()).toMatchObject({ phase: 'existing', result: { battleId: RUNNING.id } });
    expect(h.owned).toHaveBeenCalledTimes(1);
    expect(text()).not.toContain('already has a game running');

    // The 90 s watchdog fires inside that window; its check finds nothing; the machine latches "Couldn't confirm".
    await jump(1000);
    expect(h.verify).toHaveBeenCalled();
    await checkRunsEmpty();
    expect(text()).toMatch(/Couldn.t confirm the deploy/);

    // Now the owned read answers and the provider hands the existing result to the ceremony.
    read.resolve(RUNNING);
    await flush();
    await flush();
    expect(probe.current.deploy.existingRead).toMatchObject({ status: 'found', battleId: RUNNING.id });
    expect(attempt().phase).toBe('existing');

    // What the player must see (spec §5.2, existing row; R-S2b-9a's intent): the existing terminal, never "Couldn't confirm".
    expect(text()).toContain('already has a game running');
    expect(text()).not.toMatch(/Couldn.t confirm the deploy/);
  });

  it('created: the answer lands while the watchdog\'s check is in flight — the record says created, the ceremony must not say "Couldn\'t confirm"', async () => {
    h.verify = vi.fn(() => { pendingVerify = deferred(); return pendingVerify.promise; });
    await tap();
    await jump(90000); // the watchdog: verifying, the check held open by the row
    expect(h.verify).toHaveBeenCalledTimes(1);
    expect(attempt().ceremonyPhase).toBe('verifying');

    posts[0].answer(CREATED());
    await flush();
    expect(attempt()).toMatchObject({ phase: 'created', result: { kind: 'created', battleId: 'battle-new' } });

    pendingVerify.resolve({ found: false, battle: null });
    await flush();
    await advance(400);
    await flush();
    pendingVerify.resolve({ found: false, battle: null });
    await flush();
    await flush();

    // The record says created, so the ceremony may not say the opposite (§5.2 created row: theater/finishing until the reveal gates).
    expect(attempt().phase).toBe('created');
    expect(text()).not.toMatch(/Couldn.t confirm the deploy/);
  });
});

describe('FRB — definitive refusals through the real ceremony (§5.2 refused row: "error with confirmed-refusal tone")', () => {
  it('a 429 cooldown refusal: the hub says "Deployment refused"; the ceremony must not hide it behind lost-contact copy', async () => {
    await tap();
    posts[0].answer(COOLDOWN_429());
    await flush();
    expect(attempt()).toMatchObject({ phase: 'refused', result: { kind: 'refused' } });
    await checkRunsEmpty();
    expect(deployDisplay(state()).status).toBe('Deployment refused');
    // The ceremony's own words for the same answer:
    expect(text()).not.toContain('Deployment unconfirmed');
    expect(text()).not.toMatch(/Couldn.t confirm the deploy/);
    expect(text()).toContain('Deployment refused');
  });

  it('a 409 review-due (P1b): the Forge action must be reachable — the ceremony is modal over an inert hub, and Back to hub must not drop it', async () => {
    await tap();
    posts[0].answer(REVIEW_DUE());
    await flush();
    expect(attempt()).toMatchObject({ phase: 'refused', result: { kind: 'review_due', line: DUE_DEPLOY_LINE } });
    await checkRunsEmpty();
    expect(text()).toContain(DUE_DEPLOY_LINE);

    // The hub carries the action, under the ceremony: the app root is inert, so the player cannot press it there.
    expect(deployDisplay(state()).cardLine).toMatchObject({ action: { kind: DISPLAY_ACTIONS.OPEN_FORGE_REVIEW } });
    expect(container.hasAttribute('inert')).toBe(true);
    // The ceremony offers no Forge action of its own (and no Retry: the action is the Forge, not a Retry).
    const inOverlay = [...overlay().querySelectorAll('button')].map((b) => `${b.textContent}|${b.getAttribute('aria-label') ?? ''}`);
    expect(inOverlay.some((l) => /forge/i.test(l))).toBe(true);
  });

  it('a 409 review-due (P1b): Back to hub must not drop the Forge action the hub carries', async () => {
    await tap();
    posts[0].answer(REVIEW_DUE());
    await flush();
    await checkRunsEmpty();
    expect(deployDisplay(state()).cardLine).toMatchObject({ action: { kind: DISPLAY_ACTIONS.OPEN_FORGE_REVIEW } });
    // Back to hub: per §5.4 the refusal's primary action is the Forge; acknowledging it away leaves the player none.
    act(() => { button('Back to hub').click(); });
    expect(bridge.onOpenForge).not.toHaveBeenCalled();
    expect(state().action).toBe(DISPLAY_ACTIONS.OPEN_FORGE_REVIEW);
  });

  it('a refusal under a known cooldown (the limiter\'s Retry-After): the ceremony must say when Retry opens, as the shells\' error surface does', async () => {
    await tap();
    posts[0].answer(LIMITER_429());
    await flush();
    expect(attempt()).toMatchObject({ phase: 'refused' });
    expect(attempt().cooldownUntil).toBe(Date.now() + 90000);
    await checkRunsEmpty();
    expect(state().retryBlock).toMatchObject({ displayState: 'cooldown' });
    // CeremonyError renders its countdown only when it is handed onRetry; the hub's root ceremony withholds it while the table blocks.
    expect(button('Retry available in') ?? button('Try again')).toBeDefined();
  });
});
```

## Appendix B — the flag-off probe (green at the merge base, red at the head)

Path in both snapshots: `src/components/Dashboard/deployCeremony/fableReview.flagOff.jsdom.test.jsx`.

```jsx
// @vitest-environment jsdom
//
// Independent review of slice S2b (Fable, 2026-10-23) — the flag-off probe. Today's
// shells render this surface with the hub flag false. The brief's exit criterion 4
// admits exactly two flag-off changes (R-S2b-9a, R-S2b-9b); this row pins the
// confirmed-refusal words of the merge base and is run on BOTH trees.

import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import CeremonyError from './CeremonyError';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });

function render(props) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<CeremonyError accent="#4ea8de" agentName="Nova" onDismiss={() => {}} {...props} />); });
  return container.textContent;
}

describe('flag off — the confirmed refusal surface, as the merge base renders it', () => {
  it('eyebrow and generic headline: the merge base\'s words', () => {
    const t = render({ errorTone: 'confirmed', errorKind: 'deploy' });
    expect(t).toContain('Deployment failed — no battle was created.');
    expect(t).toContain('Deployment failed');
    expect(t).not.toContain('Deployment refused');
  });
  it('the server kind too', () => {
    const t = render({ errorTone: 'confirmed', errorKind: 'server' });
    expect(t).toContain('Deployment failed — no battle was created.');
  });
});
```

## 5. Reconciliation (written after reading the build report `20261023_BUILD_COMMAND_CENTER_HUB_S2B.md` §1–§15 and the PR #993 description)

The build's record: 30 findings over five lenses with Opus refuters (2 CONFIRMED, 3 PARTLY, 0 REFUTED), 318 + 71 mutants with 0 open gaps, the full Linux suite green at `b047d163`, `vite build` and `lint:gate` green at every head, and the founder's rulings Q-S2b-1 … Q-S2b-7 and RL-1 applied on October 23 (§15).

| Finding | Already recorded by the build? | Its disposition, and whether it holds |
|---|---|---|
| **FRB-1** flag-off copy change | **Yes.** Q-S2b-2 ("Reword, as part of R-S2b-9b") and RL-1 ("ruled October 23 — changed"), report §15; the PR description's "What changes, in total" lists the words under (b) "as the founder reworded (b)". | The disposition is the founder's own ruling, so the waiver this review names for FRB-1 has, on the build's record, already been given. The brief's criterion 4 was fixed without it, so the verdict table keeps FRB-1 as the criterion reads; **if the founder confirms that Q-S2b-2 and RL-1 extend R-S2b-9(b), FRB-1 ceases to block.** No disagreement on the facts: the build names every changed line this review found (`CeremonyError.jsx:39-40, :55, :100`; `DeployCeremony.jsx:182`). |
| **FRB-2** the 409 review-due's Forge action, ceremony on | **No.** The report's R-S2b-6 ("the refusal's action opens the equipped list's Forge … and acknowledges") and Q-S2b-4's note ("the review-due refusal's Forge action does acknowledge") describe the hub's card with no ceremony in the way. The ceremony-on path, where the card is inert under the overlay and "Back to hub" acknowledges, is not considered; the build's real-ceremony row presses the card's action through the test probe. | New. The reachability caveat (P1c E1 removed the server's 409) is the build's own note at `agentDeploy.js:283`. |
| **FRB-3** existing answer, the owned-read window, the watchdog | **Partly.** §3 interpretation (iv) and §6(a) "Residual, recorded" cover an answer that lands *after* the check has settled (the remount, rows G9/G9b, "the post-check half of FR-1"). The deferral of an existing answer's hand-off until the owned read settles is §3 R-S2b-5 ("The existing answer reaches the ceremony once the read has settled, bounded by the deadline"). | The disposition does not reach this window: the remount is decided at result time, before the deferred hand-off, so a check that latches *inside* the read's wait is missed. New as a defect; the fix is one hand-off-time check (section 2). |
| **FRB-4** refusals read lost-contact in the ceremony | **Partly, as a kept parity.** The build's control rows pin it: §6(b) "CONTROL: the 429 cooldown keeps 'Couldn't confirm the deploy.'" and `ceremonyWatchdogExisting` "a 429 refusal during the check is not admitted: the error terminal, lost contact, as before". | Holds as flag-off parity (R-S2b-9 allowed two live changes). It does not address the hub path, where the record says `refused` / "Deployment refused" while the ceremony above says "Deployment unconfirmed": the founder's Q-S2b-2 table (line 1, "every definitive refusal (the confirmed tone)") presumes the confirmed tone, which the machine gives only to the in-progress 429 and to server-signalled errors. New as a one-vocabulary finding; needs the founder's ruling (section 2, options a/b). |
| **FRB-5** created answer mid-check | **No.** §6(a) records the after-the-check residual only. | New (MINOR). Covered by the same remount extension as FRB-3. |
| **FRB-6** no Retry or countdown under a provider-known cooldown | **Partly, as design.** §3 R-S2b-6 "the ceremony offers it only when the hub's table does"; W5-1 rows G15c pin "not for a refusal under a sheet or a cooldown". | Holds as the build's intent; the consequence (the shells show a countdown, the hub's ceremony shows nothing until the bound passes) is not recorded. New (MINOR). |
| **FRB-7** the evidence listener's lifetime | **Partly.** W4-7 added the post-acknowledgment listener on purpose ("Cooldown evidence stopped at acknowledgment — fixed"). | Holds; its unbounded lifetime when no stamp ever lands is not recorded. New (NIT). |
| **FRB-8** refresh after every outcome | **Yes.** §3 R-S2b-2 "After every settled deploy the provider calls `refreshActiveBattles()`". | Holds as a choice; this review's NIT is that spec §6 names existing/recovered reconciliation as the trigger. |
| **FRB-9** no ceremony Retry while the hub is unmounted | **No.** | New (NIT); unreachable in ordinary use. |

Disagreements, noted and not revised: the build's verdict table reads "Today's shells changed only by R-S2b-9 (a) and (b), whose (b) the founder's Q-S2b-2 rewords"; this review counts the Q-S2b-2/RL-1 words as a third flag-off change under the brief's criterion 4 and leaves the ruling to the founder. The build's record carries no equivalent of FRB-2, FRB-3 or FRB-4; this review's rows for them fail at the reviewed head (appendix A) and the provider-side fixes for FRB-2 and FRB-3/FRB-5 were verified against the build's own suites (section 1, "Tests run").

Mutation, side by side: the build planted 318 + 71 mutants and reports 0 open gaps; this review's 38 mutants over the guards behind criteria 1–8 found 0 open gaps as well (section 4). The seven survivors here are duplicates of guards upstream (five) or are covered by the provider's own checks while the service's and the refresh's contracts stay unpinned (two, MINOR test gaps); the build's 94 + 10 equivalent survivors are of the same kind by its descriptions.
