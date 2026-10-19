# Backing — safety fix 1 (the money paths): build report

**Date:** 2026-10-18. **Branch:** `backing/safety-fix-1`, cut from `main` at `39053aed`. **Inputs:** Astra's whole-feature pre-flip review (Oct 7, 2026, at `3f784e8`, verdict NOT READY) and the founder's rulings R1–R6 of Oct 18, 2026, recorded verbatim in `docs/FANTASYTRADES_BACKING_BETA_SPEC_V1_3_AMENDMENT_D.md`. **The review record:** `docs/audits/20261018_BACKING_SAFETY_FIX1_MULTILENS_REVIEW.md` (§7 below). **Both backing flags stay `false`** (`src/config/featureFlags.js:2488` `ELIGIBILITY_ATTESTATION_ENABLED`, `:2551` `BACKING_BETA_ENABLED`). **Zero fenced files** (BUILD_RULES §1). **No new Firestore index.** **The 120 / 480 settlement limits are unchanged.**

Lines in §2 are at the base `39053aed` (every one VERIFIED — read in this session). Lines from §3 on are at this PR's head.

## 0. Executive verdict

| Item | Astra's finding | What this PR does | Rows | Mutation |
|---|---|---|---|---|
| **A** pool cap (R1, R2) | BKG-001 (Blocker): nothing bounds a pool's book, so 24 backers × 4 stakes (96 stakes, a 481-write refund) is held for ever and can be neither paid nor refunded | A pool admits at most **20 distinct backers** and **80 stake documents**; past either, `pool_full` ("This pool is full."), with nothing written; top-ups never refused. The 20th backer writes `full: true` once; the pod list shows "Full" to a viewer with no stake and offers no way in | 20 | M-A1, M-A2, M-A3 killed |
| **B** close re-read (R4) | BKG-002 (Blocker): close froze the seats from the caller's stale group — a departed seat's stake was counted as a loss and paid out | `closePool` reads the group (and the sealed totals) **inside its own transaction** and decides everything from that read; new void reason `backer_seated` | 11 + 8 | M-B1 killed |
| **C** back-then-join (R3) | BKG-005 (High): a spectator could back seat A, then claim an empty seat in the same pod | `claimSlotSeat` reads the claimant's live stakes for the pod inside its transaction (both branches) and refuses `backed_this_pod`; flag-gated; R4's close belt catches the race | 14 | M-C1 killed |
| **D** fresh clock (R5) | BKG-006 (Medium): deadlines used the request's entry time | `placeStake` reads `clock()` on every attempt for the window; `claimSlotSeat` / `releaseSlotSeat` read the clock inside the transaction; the replay probe stays first | 10 | M-D1, M-D2, M-D3 killed |
| **E** one request per Confirm (R6) | BKG-004 (High): a lost reply plus "Try again" staked twice | The attempt `{ requestId, amount }` lives outside the control (memory + this tab's `sessionStorage`); an ambiguous outcome shows "We couldn't confirm your {amount} BP on {team}." and only "Check again", which resends the identical request | 14 (+ 1 deliberately moved) | M-E1 killed |
| **F** Amendment D | — | R1–R6 verbatim, the source, the `full` note on Amendment B's public fields (and its §B3 consequence) | — | — |
| **Review** (§7) | Five lenses, three refuters over the first snapshot: 35 distinct findings — 27 CONFIRMED, 8 PARTLY, none refuted outright (four refuted in part) | 24 fixed here (the ones that mattered: a door refusal on "Check again", or a pod re-claimed mid-request, could still lead to a second debit; a stake committing mid-close could be left out of the closed book), 11 reported or left as is | 23 new rows | 12 more mutants, all killed |

**The worst-case numbers (§4, measured off the real writers' commits):** the worst admissible book is 20 backers × 4 seats = **80 stake documents**. Settled with every stake a winner: **80 live stakes, 401 writes**. Refunded in full: **80, 401**. A deleted-pod close that refunds everything: **80 voided, 402 writes**. Each inside `SETTLEMENT_MAX_STAKES` (120) and `SETTLEMENT_MAX_WRITES` (480).

**Verification (§8):** the suite of record, on Linux (WSL, a private clone at `39053aed` with this PR's tree applied — tree `725951d6`, `TZ=UTC`, `npm run test:run -- --maxWorkers=2`, the CI shape): `Test Files  1042 passed | 7 skipped (1049)` / `Tests  22551 passed | 88 skipped (22639)`, exit 0. `npm run lint:gate` exit 0. `vite build` exit 0. The Firestore rules emulator suite (Windows, LF snapshot, Java 21): `Test Files  25 passed (25)` / `Tests  424 passed (424)`. Zero fenced files. Both flags `false`.

## 1. Session preamble (BUILD_RULES §2/§3)

- `git fetch origin` ran first. Branch, HEAD and porcelain at the start: `claude/backing-safety-fix-1-7e49bc`, `39053aeda6d54084c73d3d7d06f470ad0e6aec6b`, empty. `origin/main` = `39053aed`, the prompt's floor.
- **One deviation from the prompt's §0, stated:** `git checkout main && git pull` cannot run in this worktree — `main` is checked out in the main checkout (`C:/Users/fashr/portfolio-duel`), and git refuses a second checkout of one branch. The worktree's HEAD already was `origin/main` after the fetch, so `git checkout -b backing/safety-fix-1` ran from it. `origin/main` was re-checked before the push.
- `npm ci` ran in the worktree (exit 0). No `.env`, Vercel or Firestore change.
- Astra's reproductions (`…/backing-review/snapshot/review/`, outside the repo) were readable. `wholeFeature.test.js` (P1–P11), `uiSeams.test.jsx` (U1, U2) and `desiredRecovery.test.js` were read and used as SHAPES only; nothing was copied into the repo.
- **Line endings:** the worktree is CRLF (`core.autocrlf=true`); every blob in the commit is LF. The suite of record ran on Linux (WSL, a private clone, `TZ=UTC`, `--maxWorkers=2`, the CI shape); mutations, reviewers and the rules suite ran on LF `git -c core.autocrlf=false archive` snapshots.

## 2. The findings — causes verified at the base `39053aed`

**BKG-001 (A).** `placeStake` (`api/_utils/backingStake.js:267`) caps per backer and per team only; nothing counts the book. The writers hold any book past their own limits: `SETTLEMENT_MAX_STAKES = 120` (`api/_utils/backingSettlement.js:165`), `SETTLEMENT_MAX_WRITES = 480` (`:176`). The refund projects `1 + 5 × live + 4 × priors` (`:1123`, `REFUND_WRITES_PER_STAKE = 5` at `:282`); the settlement `1 + (won ? 5 : 3)` per stake (`:427`, `:444`) plus priors (`:762`). 24 backers × 4 seats = 96 stakes, so a refund projects 481 > 480 and holds `stake_ceiling` for ever. `overrideHold` re-asserts the ceiling (`:752`), yet the hold log told the operator to send it (`:786`). The comments at `:155–156` and `:169` cited a Firestore 500-write transaction limit that Google removed on Mar 29, 2023, so 120 / 480 are this code's own margins (unchanged here, per the prompt).

**BKG-002 (B).** `closePool` (`api/_utils/backingPools.js:592`) read the pool and the stakes in its transaction but froze the seats from the caller's `group` (`:613`; `missing` from the caller at `:595`). `ensureClosed` read that group earlier, outside any transaction (`:859`). A release committing in between was invisible to the close. (Astra's P10/P11 reproduce it at the base.)

**BKG-004 (E).** `StakeControl` minted a fresh id on every Confirm (`src/components/League/backing/StakeControl.jsx:201`); a lost reply read "No connection. Try again." (`backingCopy.js:434`), so the next press was a new request and a second debit. `backingService.call` maps a thrown fetch to `network` (`src/services/backingService.js:62`), and any non-OK reply without a JSON `error` (a Vercel timeout's non-JSON 504) to `server_error` (`:66`). The stake route has `maxDuration: 10` (`api/tournament/backing-stake.js:158`), so a timeout can land after the commit. The server's replay probe was always sound (`backingStake.js:321`).

**BKG-005 (C).** Own-pod is checked at stake time only (backingEligibility.js via `placeStake`'s CHECK 3). `claimSlotSeat` (`api/_utils/liveDraftFormation.js:343`, join write `:400`) never looked at Backing exposure, and the close checked only that the backed TEAM stayed seated. (Astra's P9 reproduces it at the base.)

**BKG-006 (D).** `placeStake` fixed `at` on entry (`backingStake.js:273`) and judged the window with it inside the transaction (`:384`, `:388`). `releaseSlotSeat` compared `scheduledDraftAt` to its supplied `nowIso` (`liveDraftFormation.js:440`). The join branch of `claimSlotSeat` checked no instant in its transaction at all; it relied on `nextSlotFireInstant(slot, now)` resolved at entry (`:353`).

## 3. What each item changed

### A — the pool cap (R1, R2)

- **The limits:** `POOL_MAX_BACKERS = 20` (`src/constants/backing.js:89`), `POOL_MAX_STAKES = 80` (`:101`). The module's export pin moved deliberately (`src/constants/backing.test.js`).
- **The checks** read `poolSizeOf(backers)` (`api/_utils/backingStake.js:127`), the distinct backers and stake documents in the sealed totals the transaction already holds. They apply to a NEW stake document only; a top-up is never refused by either.
  - **The backer limit** (`:570`) sits before `ensureAllowance` (`:577`, the first buffered write), so it refuses by returning and nothing is written. "Full" is already public at 20, so answering it early tells nobody anything.
  - **The document limit** (`:633`) sits after the debit (`:613`) and refuses by a throw, which rolls the attempt back, so nothing is written either. It is there rather than early so that a requester whose allowance would refuse the stake cannot probe the sealed document count for free (the review's SEAL-4).
  - Both answer `409 pool_full` with "This pool is full." (`POOL_FULL_MESSAGE`, `:107`), word for word the same.
- **Why the key count is the document count before close.** Every stake document is (backer, pool, team) at a deterministic id. The only writer of `private/totals` while a pool is open is this transaction, which adds a `byTeam` key in the same commit that creates the document, and only adds to an existing key on a top-up. Nothing voids, settles or deletes a stake while the pool is open: the close, settlement and refund all run on a closed pool, and the smoke cleanup deletes dev documents only. So before close the keys and the live documents are one set. A document removed out of band leaves its key behind, so the count errs toward refusing. A totals document that is MISSING on a pool that has already taken stakes now fails closed (`:513`, the review's MON-3). Verified by reading every writer of `backingStakes` and `private/totals`: `backingStake.js`, `backingPools.js` `closePool`, `backingSettlement.js`, and `scripts/backing-smoke.js:607` (the dev cleanup).
- **`full`:** `publicProgressFrom` adds `full: true` at 20 or more distinct backers and omits the key below that (`api/_utils/backingPools.js:506`). `publicProgressChanged` compares `=== true` on both sides (`:539`), so a pool opened before this PR (no key) costs no write. `closePool` deletes `full` with the capped pair at the reveal (`:874`). Distinct backers only grow while a pool is open, so the key is written once, by the 20th backer's stake, and never again. The open pool's document is otherwise byte-identical to today.
- **The pod list:**
  - The projection carries `full: pool.full === true` (`api/tournament/backing-pools.js:167`) and makes no seat backable for a viewer with no stake in a full pool (`:213`, `:227`).
  - The client reads one predicate, `poolFullForViewer` (`src/components/League/backing/backingStakes.js:24`): a "Full" tag in `PodList.jsx:131`, and a sentence instead of a button as the CTA in `TeamCard.jsx:273` (both layouts share the card).
  - `REFUSALS.pool_full` is at `backingCopy.js:448`.
- **Comments and the hold log:**
  - The 500-write claims are corrected at `backingSettlement.js:155–185`, `:264–283`, `:768` and `:1028`, and at `api/tournament/backing-settle.js:30–41`.
  - The hold log now names the release that works for the hold it records (`backingSettlement.js:808`): `overrideHold` for `agent_layer_absent`, and for `stake_ceiling` the Console procedure, never `overrideHold`.
- **Pins moved deliberately:**
  - `api/tournament/backing-pools.test.js`: the open pod's projection, twice; `full: false` joins the five keys.
  - `api/_utils/backingPools.test.js`: the §B2 freeze loop now runs to 19 backers, two new rows pin the one `full` move and the pre-amendment document, and two titles were corrected.
  - **The rules suite pins no field set.** `test/rules/backingDenials.rules.mjs` gained a denial row (a client cannot write `full: true` or `false`) beside the `backerProgress` / `teamSpread` rows.
  - The stake route's reply deliberately carries no `full`, so its key pin (`api/tournament/backing-stake.test.js:531`) did not move.

### B — the close reads membership in its own transaction (R4)

- `closePool` (`api/_utils/backingPools.js:646`) `tx.get`s the group first (`:658`) and decides from that read alone (`:660` missing, `:698` frozen seats). The caller's object supplies only the id and the pool namespace.
  - A tombstone that finds a live pod is decided on the live pod, using `ensureClosed`'s clock rule (`:677`, `still_open`, nothing written).
  - A pointer whose live group routes to another pool is refused (`:671`, `namespace_mismatch`).
- **It also reads the sealed totals** (`:691`), the one document every stake writes. Above the §B2 floors a stake writes no pool document. Before this, a stake that committed between the close's stakes query and the close's commit shared no document with the close, which then committed a book without it. The stake was left `live` in a closed pool: its points burned if its team lost, and the settlement threw `payout_invariant` and wedged if its team won (the review's MON-1 = CON-2). Now the two serialize on the totals document.
- **`backer_seated`** (`VOID_REASONS.BACKER_SEATED`, `:156`): after the seat-left partition, any live stake whose BACKER is seated per this read is voided (`:711`, `:751`). It is refunded through the same `creditRefund` + `recordStakeLoss` pair (score-neutral; the allowance is not restored). A stake that is both reads `seat_left`. Validity, the sealed totals and the reveal are computed on what survives both.
- **Recreated pods** (a deterministic slot id) are decided as the LIVE pod: the pool belongs to the slot occurrence, as its teams are derived live while open (§1 of the spec). If the same seats are re-claimed, their stakes survive and the rest are `seat_left`. If different seats are taken, every old stake is `seat_left` and refunded. The settlement's deleted-pod branch now answers `refunded` only for a refunded close (`backingSettlement.js:642`, the review's MON-5).
- **Copy:** `RESULTS.stakeVoid.backer_seated` = "Refunded — you took a seat in this pod." (`backingCopy.js:571`).
  - It is read by the results card's stake rows (`BackingResultsCard.jsx:59`, both layouts) and by Your Backing's week card.
  - Both now also say where a voided stake's points went: "Refunded BP go back to your record, not to this week's allowance." (`BackingResultsCard.jsx:117`, `YourBacking.jsx:188`; the review's HON-3).
  - The lexicon guard stays green.
- **The release side** (the review's CON-3): when Backing applies to the pod, `releaseSlotSeat` reads the pool (`liveDraftFormation.js:585`). A release that read its clock just before the fire therefore cannot commit after a close froze its seat: the close writes the pool, the release re-runs, and its fresh clock refuses. With the flag off there is no read and no change.

### C — back-then-join is refused (R3)

- `claimSlotSeat` (`api/_utils/liveDraftFormation.js:436`) reads the claimant's stakes inside its transaction, on BOTH branches.
  - The read uses the committed `backingStakes (userId ASC, weekKey ASC)` composite (`firestore.indexes.json:538`), filtered in memory to this `groupId` and `live`.
  - The create branch is `:476–480`: a deleted-and-recreated pod keeps its id and its open pool. The join branch is `:512–517`.
  - The refusal is `backed_this_pod` (409): `api/_utils/liveDraftEndpoint.js:46`, with the client copy at `src/services/liveDraftActions.js:53`.
  - No new index.
- The collection names, the live status and the pool-id rule are named in the module (`:327–334`), not imported: `backingPools.js` → `backingWeek.js` → this module would be a cycle. A test pins them to `backingPools.js`'s own constants and `poolIdFor`.
- **Flag discipline — the choice:** the read runs when `BACKING_BETA_ENABLED === true` at call time, or on a dev pod (`backedThisPodCheckApplies`, `:336`).
  - Why: while the flag is false no stake can exist on a production pod. Every stake path is behind the flag, and a smoke session stakes on dev pods only. So the read could only ever find nothing, and running it would add a read to a live production path for no effect.
  - With the flag off, a production claim makes exactly today's reads and writes. Two rows prove no `backingStakes` read and the same write, on the join branch and on the create branch.
  - **The dev clause does not give R3 a preview smoke**, and the review corrected the comment that said it did. No writer creates a dev slot pod: `buildInitialSlotGroupDoc` sets no `isDev`, the smoke seeds lobby pods (which `claimSlotSeat` refuses), and the create branch has no group to read. So R3's evidence before the flip is its suite, and its first real run is after the flip.
  - Not `backingLitFor`: `backingSmoke.js` is deleted in the flip commit, and a smoke user's stakes are dev-only anyway.
  - The flag-importer pin (`src/config/backingBetaFlags.test.js`) moved deliberately to name this third reader. The `api/tournament/slot-endpoints.test.js` flag mock gained `BACKING_BETA_ENABLED: false`.

### D — a fresh clock on every attempt (R5)

- `placeStake` takes `clock` (default `() => new Date()`, `backingStake.js:317`), read once per transaction attempt right after the replay probe (`:381`) and the pool read (`:437`).
  - The window's two ends use it (`:453`, `:461`). An unreadable `closesAt` is now closed rather than open (the review's CON-6).
  - The lazy jobs before the transaction, and the stake's timestamps, keep the entry `at`.
  - The battle belt takes no time input: it is a read of the attempt, so it is fresh on every retry by construction.
- `claimSlotSeat` and `releaseSlotSeat` read `slotClockFor(now, clock)` (`liveDraftFormation.js:282`) inside the transaction. Each refuses `draft_already_started` when the instant has passed:
  - the create branch when the resolved fire instant is ≤ the reading (`:475`);
  - the join branch when `scheduledDraftAt` is (`:508`), after the idempotent member check, so a member's re-claim writes nothing and answers as before;
  - the release likewise (`:566`).
- **The clock rule:** an explicit `clock` wins; a caller that pins `now` pins the clock (the suites drive these writers at fixed July 2026 instants); otherwise the real clock is used. The routes pass neither (`api/tournament/slot-claim.js:25`, `slot-release.js:23`), so production reads `new Date()` inside the transaction. A static row now asserts that both routes keep it that way (the review's DARK-4).
- **Not flag-gated, by the ruling's own scope:** R5 covers every slot claim and release. With the flag off, the slot paths differ from today only when the fire instant passes between a request's entry and its transaction (or a retry), which is the window R5 closes. One visible case: a full pod claimed after the fire now answers `draft_already_started` rather than `slot_full`. Both are 409.

### E — one request per Confirm (R6)

- **The attempt store**, `src/components/League/backing/stakeAttempts.js` (new):
  - It holds `{ requestId, amount }`, keyed by uid + `groupId` + `teamOdUserId` (JSON-encoded).
  - It lives in a module-level Map mirrored to `sessionStorage`. Every storage access is wrapped, and the Map alone carries it when storage is absent or throws.
  - It also keeps an in-flight mark and a per-key subscription. A control that unmounts mid-flight keeps running its request, and the control mounted in its place shows "Your {amount} BP on {team} is still being confirmed.", holds its button, and changes to the right state when the first request lands (the review's HON-4).
- **The control's send path:**
  - A Confirm with no attempt mints an id and records the attempt BEFORE the request leaves (`StakeControl.jsx:265`).
  - Only one request per attempt is in flight at a time (`:252`).
  - The reply decides. A success or a typed refusal clears the attempt. An ambiguous outcome keeps it, re-saved (`:284–288`).
- **While an attempt is unresolved**, both layouts render the unresolved form (`:376`): the notice "We couldn't confirm your {amount} BP on {team}.", the three disclosure lines, and one button, "Check again" (`:312`), which resends the identical request.
  - There is no preset, no custom amount and no Confirm, so the amount is locked.
  - Re-entering the team's form reads the same attempt. The hosts pass `uid` (`BackingDesk.jsx:322`, `BackingScreen.jsx:322`), and a change of `uid` re-keys the control.
- **Ambiguous** (`stakeOutcomeAmbiguous`, `stakeAttempts.js:171`):
  - `network`;
  - `server_error` (a timeout, a 5xx, a non-JSON body);
  - an error with no code;
  - a reply without its stake;
  - **any status the stake endpoint never refuses with**: 401 sign-in, 429 rate limit, 404 dark route, 405, 5xx. None of these reached the replay probe, and the first request may have committed (the review's HON-1 = MON-2 = CON-1).
- **Typed** (ends the attempt): the stake endpoint's own refusal statuses, 400 / 403 / 409 (`:154`).
- A replay answered after the pool closed (R5 keeps it a success) no longer reads "Sealed until the pool closes" for a stake that is no longer live (`StakeControl.jsx:366`).
- **Pin moved deliberately:** in `StakeControl.jsdom.test.jsx`, FAB-11 ("a success reply that carries no stake") used to show the plain failure sentence and a fresh Confirm. Under R6 it is ambiguous, so it shows the unresolved state and "Check again". That suite now resets the attempt store between rows.

## 4. The worst-case proof (item A's key row)

`api/_utils/backingPoolCap.test.js`, "THE WORST-CASE PROOF". The book is built through the REAL `placeStake`: 20 backers × 4 seats, 50 BP each, 80 documents. Each money path then runs through its REAL planner and writer, and the writes are counted off the harness's commit: one entry per buffered operation, which is the SDK's own count, with no same-document coalescing.

| Path | Live stakes it carries | Writes measured | Formula (shown, not used) | Inside 120 / 480 |
|---|---|---|---|---|
| Settlement, every stake a winner (an all-way tie) | 80 | **401** | 1 + 80 × 5 | yes |
| Full refund (admin) | 80 | **401** | 1 + 80 × 5 | yes |
| Deleted-pod close that refunds everything | 80 voided `group_deleted` | **402** | 2 + 80 × 5 | yes (`closePool` asserts no ceiling of its own; the cap is what bounds it) |
| Priors from seat-left voids: the close voids the departed seat's 20 | 20 voided | 102 | 2 + 20 × 5 | yes |
| …then the settlement of the same book | 60 (the 20 voids are neither live nor priors) | 301 | 1 + 60 × 5 | yes |
| …or its refund | 60, priors 0 (a `seat_left` void is never a refund prior) | 301 | 1 + 60 × 5 | yes |

**The pin row** ties the limits to the ceilings. It asserts `POOL_MAX_STAKES ≤ SETTLEMENT_MAX_STAKES` and `2 + POOL_MAX_STAKES × 5 ≤ SETTLEMENT_MAX_WRITES`, with 20 / 80 / 120 / 480 pinned by value, so raising a limit without the ceilings fails it. The close's extra reads (the group, the totals) cost no writes.

## 5. The join paths (item C's gate — read-only, done first)

Every writer of `tournamentGroups.groupMembers` / `players` is server-side; `firestore.rules:619–622` denies every client write to `tournamentGroups`.

| Writer | `file:line` | Adds a human to an EXISTING pod? |
|---|---|---|
| `claimSlotSeat` — create | `api/_utils/liveDraftFormation.js:405` (the doc builder), written at `:484` | Creates the pod. But a slot id is deterministic, so a recreated pod can inherit an open pool: **guarded** |
| `claimSlotSeat` — join | `api/_utils/liveDraftFormation.js:519` (the `tx.update`) | **Yes. The one human-join path: guarded** |
| `releaseSlotSeat` | `api/_utils/liveDraftFormation.js:598` (update) / `:592` (delete) | Removes only |
| `padAndStampPool` (fire) | `api/_utils/liveDraftLifecycle.js:190` | Adds CPUs only, at fire (after the pool's close) |
| Lobby formation | `api/_utils/tournamentLobbyService.js:361` | Seats fixed at creation (get-or-create; an existing doc is reused unchanged) |
| Advancement | `api/_utils/tournamentAdvancement.js:857` | Seats fixed at creation (bracket pods) |
| `createGroup` | `api/_utils/tournamentGroupService.js:83` (auto id) | Seats fixed at creation (admin seeder, `api/admin/seed-tournament-group.js:72`) |
| Seed bracket | `api/admin/seed-tournament-bracket.js:81` | Seats fixed at creation (admin) |
| Smoke seed | `scripts/backingSmokeLib.js:121` | Seats fixed at creation (dev pods) |
| `canonicalOpenSweep` | `api/_utils/canonicalOpenSweep.js:123` | Rewrites `players` legs only; membership unchanged |
| `bankGroup` | `api/_utils/tournamentBanking.js:440` | Rewrites `players` legs only |
| (not `tournamentGroups`) | `api/cron/process-draft-claims.js:509`, `src/services/draftService.js`, `src/firebase/firebaseService.js:2530` | The `drafts` collection |

Fable's read holds: `claimSlotSeat` is the only path that adds a human to a pod that can carry stakes. No second guard was needed, so there was no STOP.

## 6. What a second tab sees (report only)

`sessionStorage` is per tab. A second tab or window opened on the same team's form does NOT see the first tab's unresolved attempt: it shows a fresh form, and a Confirm there is its own request with its own id.

If the first tab's request committed and its reply was lost, a Confirm in the second tab is a second, deliberate stake: a top-up of the same document, debited separately, bounded by the per-team cap and the allowance. If the second tab's pod list was read after the first commit, its form says "Adds to your {n} BP on {team}", so the viewer is told. The first tab still shows "Check again", and pressing it replays its own request without debiting again.

Closing this would need the attempt in `localStorage` (shared across tabs, but persisting past the session) or on the server. R6 and item E scope it to the tab, so this PR reports it rather than widening the store. The review recorded it (HON-2 = MON-4).

## 7. The review (BUILD_RULES §2)

The cumulative diff crossed both thresholds, so the multi-lens adversarial review ran. The full record is `docs/audits/20261018_BACKING_SAFETY_FIX1_MULTILENS_REVIEW.md`.

- **Setup:** five lens agents (money conservation, the seal, concurrency and retries, flag-off and dark, client honesty), each on its own LF snapshot, read-only. Three refuters followed, each told to refute every finding with a repro.
- **Findings:** 35 distinct — 27 CONFIRMED, 8 PARTLY, none refuted outright. Four claims were refuted IN PART: SEAL-4's "anyone can probe" (only a requester whose allowance is short can), CON-1's pre-probe half, CON-6's asymmetry and CON-8's "captured at mount". One finding, CON-1b, was found by a refuter.
- **Fixed in this PR (24),** each with a row and, where it adds one, a killed mutant. The most consequential:
  - **A door refusal on "Check again"** (429 rate limit, 401 sign-in, 404 dark route) was being treated as a definitive answer. It cleared the attempt, so the next Confirm minted a new id: a second debit by another route. Fixed by ending an attempt only on the stake endpoint's own refusal statuses.
  - **A stake that committed between the close's reads and its commit** was left out of the closed book. On the harness it was burned, or it wedged the settlement. This predates this diff but sits in the transaction it rewrites. Fixed by the close reading the sealed totals.
  - **A pod deleted and re-claimed mid-request** (CON-1b, found by the concurrency refuter) made a resend of a committed request answer `no_pod`, so the client ended the attempt and the next Confirm debited again. Fixed by re-reading the pod after the lazy close (`backingStake.js:331–354`), so the replay probe answers.
  - **The flag-importer pin** and the slot-endpoint flag mock, which would have failed CI on every platform (also caught by the Linux suite).
  - **A re-entered form during a request in flight** showed "We couldn't confirm" before any answer existed.
  - **The per-stake refund note** ("where the points went") for `backer_seated`.
  - **The document-limit probe** (SEAL-4) and the missing-totals fail-open (MON-3).
  - **A release racing the close** at the fire instant (CON-3).
  - **The settlement's mislabelled deleted-pod branch** (MON-5).
  - **Amendment D's note on §B3**, plus stale prose and test titles.
- **Reported or left as is (11):**
  - the second tab (§6);
  - `stake_already_spent` copy (out of band only; safety fix 3);
  - plainer sign-in / rate-limit copy (safety fix 3);
  - **MON-6** — close, settlement and refund select stakes by `groupId` only, while the cap counts per pool namespace. That only matters if a group's `isDev` flips after it holds stakes. It predates this diff and is **for separate tasking** (BUILD_RULES §3);
  - SEAL-5 (below);
  - the two copies of the "full for this viewer" rule (identical inputs);
  - CON-5 (a replay to a since-deleted pod answers `no_pod`; no money moves);
  - four NITs (N1, N3, N4, N6).

## 8. Verification

| Check | Where | Result |
|---|---|---|
| `npm run test:run -- --maxWorkers=2` (the CI shape) | Linux (WSL), a private clone at `39053aed` with this PR's tree applied — tree `725951d6` (`git write-tree` in the clone matched the commit's tree; the final commit differs from it only in this report's own numbers), `TZ=UTC`, Node 20.20.2 | `Test Files  1042 passed \| 7 skipped (1049)` / `Tests  22551 passed \| 88 skipped (22639)`, exit 0 |
| `npm run lint:gate` | same clone, on the FINAL commit's tree | exit 0 |
| `vite build` | same clone, on the FINAL commit's tree | exit 0 (the usual chunk-size advisory) |
| `npm run test:rules` (the rules emulator; a rules test changed) | Windows, LF `git archive` snapshot, Java 21 | `Test Files  25 passed (25)` / `Tests  424 passed (424)` |
| Fenced files (BUILD_RULES §1) | the cumulative diff | none |
| Flags | `src/config/featureFlags.js:2488`, `:2551` | both `false`; `featureFlags.js` untouched |
| `firestore.rules`, `firestore.indexes.json`, `vercel.json` | the cumulative diff | untouched |

**An earlier Linux run, on the first snapshot, was red, and it is recorded here.** It failed four rows in two files: `src/config/backingBetaFlags.test.js`, the flag-reader pin the review also caught as DARK-1, and `api/tournament/slot-endpoints.test.js`, whose closed flag mock lacked `BACKING_BETA_ENABLED`. Both are fixed in this PR, and the run above is the re-run on the final tree.

**Windows-only noise, stated so it is not mistaken for this PR:**
- On this machine's CRLF worktree, `backingDark.test.jsx` "returns null while dark" fails on a `\n`-anchored source regex. It is one of the documented platform-only rows, and it passes on Linux.
- Under parallel load, `backingBetaFlags.test.js` "EVERY importer…" and two jsdom guards time out at 5 s. Each passes alone, and on Linux.

**Not run:** a Vercel preview smoke. Item C's check has no preview path (§3 C), and the flags stay dark.

## 8a. Rollback and pre-existing pools

- **No production pool is affected while the flag is false.** Every stake path is behind it.
- **A dev or smoke pool** that reached 20 or more backers under the old code carries no `full` key. New backers are still refused (`pool_full` is counted from the totals), but the list shows the pool as backable until an existing backer's next stake writes `full` (the review's SEAL-5).
- **Rolling this PR back** leaves any `full: true` in place on open pools. The old code neither writes it nor deletes it at close. That is harmless: both readers gate on an open pool.

## 9. Mutation results

Each mutant ran in its own LF snapshot. The runner (`mutate.mjs`) checks the anchor appears exactly once, runs the target file, then restores the file and re-hashes it. The unmutated control passed every target file first, in both rounds.

**Round 1 (the build, snapshot `d0ca6d64`) and round 2 (after the review's fixes, snapshot `68100937`). Every prescribed mutant was killed in both rounds:**

| Mutant | Kills (rows that failed, round 2) |
|---|---|
| M-A1 — drop the backer limit | "the 21st distinct backer is REFUSED `pool_full` with nothing written", the 20/21 race row |
| M-A2 — drop the stake-document limit | "the 81st stake DOCUMENT is refused `pool_full`", the SEAL-4 row |
| M-A3 — write `full` on every stake once full | "the 20th distinct backer … writes `full: true` ONCE" |
| M-B1 — decide from the caller's object again | ROW 1 (Astra P11), rows 2, 3 and 4 (×3), the namespace row: 7 rows |
| M-C1 — drop the claim's stake read (join branch) | "BACK, THEN CLAIM → refused", the dev-pod row, ORDER 1, ORDER 2: 4 rows |
| M-D1 — the stake window on the entry time again | P6, and the per-attempt clock row |
| M-D2 — the slot claim on the entry time again | the join-crossing, create-crossing and per-attempt rows |
| M-D3 — the slot release on the entry time again | the release-crossing row and the routes' default-clock row |
| M-E1 — a fresh request id on "Check again" | ROW 1 (mobile and desktop), rows 2–5, the rate-limited row, the HON-4 ambiguous row: 8 rows (the wallet reads 800) |

**The review's fixes (round 2, plus M-R12 on snapshot 3), all killed:**

| Mutant | Kills |
|---|---|
| M-R1 — the close no longer reads the sealed totals (MON-1) | the MON-1 / CON-2 interleave row |
| M-R2 — the document limit back before the allowance (SEAL-4) | the SEAL-4 row, the 81st-document row |
| M-R3 — the release no longer reads the pool (CON-3) | the CON-3 release row |
| M-R4 — door refusals definitive again (HON-1) | the door-refusal row, the rate-limited "Check again" row |
| M-R5 — ignore a request still in flight (HON-4) | the HON-4 re-entry row |
| M-R6 — the deleted-pod branch mislabels again (MON-5) | the MON-5 row |
| M-R7 — missing totals admit again (MON-3) | the MON-3 row |
| M-R8 — the close keeps `full` (SEAL-2) | the worst-case settle row |
| M-R9 — no refund line for a per-stake void (HON-3) | the two results-card rows (mobile, desktop) |
| M-R10 — the create branch reads stakes with the flag off (DARK-2) | the flag-off create-branch row |
| M-R11 — a non-live replay reads "sealed until the pool closes" (HON-6) | the HON-6 row |
| M-R12 — no re-read of a pod that came back mid-request (CON-1b) | the CON-1b replay row (run on snapshot 3, after the refuter's report) |

## 10. For the founder, in plain words

- **A pod can no longer outgrow its own payout.** At most 20 people can back one pod, and the pod can hold at most 80 stakes. The biggest pod that rule allows pays out in 401 writes and refunds in 401; the code's own limit is 480. The 21st backer is told "This pool is full." Once a pod has 20 backers, everyone without a stake there sees "Full" and no button. The people already in can still add to their stakes.
- **"Full" is the one new thing the public can see**, and it is more telling than "no count" makes it sound. Because there is no 21st backer, it means *exactly 20*, and when it appeared dates the 20th stake. Amendment D now says so in writing. It reveals nothing about amounts or teams.
- **The close now looks at the pod as it really is when it closes.** It no longer uses a copy read a moment earlier. A seat that left in that moment is refunded, not counted as a loss and paid to others.
  - The review found a second, older race in the same spot: a stake placed in the final instant could be left out of the closed book entirely, and then either lost or jam the payout. That is fixed too.
- **You can't back a pod and then sit down in it.** The claim is refused with "You've backed a team in this draft, so you can't take a seat in it. Pick a different slot." If a claim and a stake ever cross in the same instant, the close refunds that stake ("Refunded — you took a seat in this pod.") and says the points go back to your record, not to this week's allowance.
  - This check only switches on with the Backing flag (or on a test pod). Today nothing creates such a test pod, so its first real run will be after the flip; until then, the tests are the evidence.
- **Deadlines are checked when the stake actually lands,** not when the request arrived. A request that arrives at 23:59:58 on Sunday but lands after midnight is refused. Seat claims and releases at the draft's start instant work the same way.
- **One Confirm can no longer charge twice.** If the reply is lost (a dropped connection, a timeout), the form says "We couldn't confirm your 100 BP on Kestrel." and offers only "Check again". That button resends the very same request, which the server recognises and answers without charging again.
  - The review caught two holes in the first version of this, and both are closed. Being rate-limited, or briefly signed out, while pressing "Check again" used to unlock a fresh Confirm. So did a pod that was emptied and re-filled in the same instant.
  - **One limit remains, and it needs your call if you want it closed:** the protection lives in one browser tab. A second tab doesn't know about the first, and a Confirm there is a separate, deliberate stake. Closing it would mean keeping the attempt in shared browser storage or on the server.
- **Found, not fixed (needs its own task):** the close, the payout and the refund collect a pod's stakes by pod id only, while the new cap counts per pool. That only matters if a pod were switched between test and real after people had backed it. Nothing does that today. It predates this work.
- **The settlement limits (120 / 480) are this code's own safety margins, not a Firestore rule.** Firestore dropped its 500-write limit in March 2023. The comments that said otherwise are fixed, and the numbers are unchanged, as you asked.
