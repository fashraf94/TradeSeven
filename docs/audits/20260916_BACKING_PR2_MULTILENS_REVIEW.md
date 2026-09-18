# Backing Beta PR 2 — cumulative multi-lens adversarial review

**Date:** September 16, 2026
**Branch:** `backing/pr2-pools-stake-endpoint`
**Reviewed at:** `a8e8fbf4` (the build commit, cut from `main` @ `b7913c91`). The fixes below landed after it.
**Scope:** spec V1.3 §12 PR 2 — pools, the stake endpoint, the pod list — plus carry-ins E1 (the sealed stake meta), E2 (the net-BP month attribution) and E3 (the scanner allowlist).
**Why a review at all:** BUILD_RULES §2 — the cumulative branch diff is 19 files / ~4,700 lines, past both thresholds.

---

## How the review was run

Five independent lenses, each on its **own isolated snapshot tree** (BUILD_RULES §2 reviewer isolation, the Sept 2 founder ruling): one `git archive a8e8fbf4` extraction per lens, path-distinct, under the session scratchpad, with `node_modules` symlinked. Every lens was **read-only on git and on the shared working tree** — no writes to the repo, no `git checkout --`, no stash, no commit, no push. Mutation checks ran inside each lens's own tree and were reverted there.

| Lens | Brief |
|---|---|
| **A** | Double-spend, replay and cap evasion against the stake transaction — two racing requests with the same and with different `requestId`s, and a close racing a stake. *(the explicitly briefed lens)* |
| **B** | Domain correctness against spec V1.3 §1–§8 and Amendment A §A2/§A3 — the close order, the window, the economy, the §6 shapes, the "not in this PR" list. |
| **C** | The dark-merge guarantee, wiring and blast radius — flag reads, reachability while dark, the shared in-memory-Firestore fixture's other consumers, the rules block, the moved PR 0/PR 1 pins, and five prescribed mutation checks. |
| **D** | Test integrity and prose honesty — vacuous rows, the hand-written concurrency simulator, the E2 block's arithmetic, the ledger fold's independence, and every docstring claim. |
| **E** | Security, authorization and data exposure — the seal, authorization on the stake body, the rules, the fingerprint salt, path safety, log leakage, cost. |

Every finding was handed back to its lens with an instruction to **refute** it with a concrete repro. Findings that survived are **CONFIRMED**; the rest are recorded **REFUTED**, with the reasoning.

---

## Coordinator's own checks (run on the working tree, not by a lens)

| Check | Result |
|---|---|
| `npm run test:run` | `Test Files  676 passed \| 3 skipped (679)` / `Tests  12916 passed \| 64 skipped (12980)`, exit 0 |
| `npm run test:rules` (emulator available) | 8 files / 201 tests, exit 0 |
| `npx vite build` | clean, exit 0 (BUILD_RULES §2 — the only check that catches a syntax error in `App.jsx`) |
| `npm run lint:gate` | clean, exit 0 |
| Fenced files touched (BUILD_RULES §1, all eleven) | **zero** |
| `vercel.json` / cron budget (§6) | untouched; 39 of 40 |
| Writes to `tournamentGroups` / `agents` / `agentBattles` | **none** (§12 "not in this PR") |

### Rules-block mutation check, measured

BUILD_RULES §2: *"a row that cannot fail under the defect it names is not a guard."* The new
`match /backingStakes/{stakeId}/private/{doc}` block and its five rows in
`test/rules/backingDenials.rules.mjs` were mutation-checked against the real emulator, three ways:

| Mutation to `firestore.rules` | Result | Reading |
|---|---|---|
| The whole new block **deleted** | suite stays **GREEN** (39/39) | Firestore denies by default, so the block is an explicit *statement on the page* — the `backingPools/{id}/private` sibling's own stated convention — not the mechanism that denies. The rows are **not** a guard against the block's own removal. |
| `match /backingStakes/{stakeId}/{document=**}` carrying the **parent's owner condition** | suite stays **GREEN** | Correctly so: the meta doc has no `userId`, so `resource.data.userId == request.auth.uid` is false for it and the read stays denied. The wildcard is not the defect it looks like. |
| The block's read **relaxed** to `if request.auth != null` | **RED — 3 of the 5 rows fail** | This is the defect class that matters, and the shape a future "let the backer see their own meta" convenience would take. The rows are a genuine guard against it. |

All three results are now written into the test file itself, beside the row they describe, so the
limit is executable documentation rather than a reviewer's memory.

---

## Executive verdict

**12 findings CONFIRMED and fixed on the branch; 1 CONFIRMED and deliberately NOT fixed (a spec question for the founder, below); ~40 candidates REFUTED.** Every lens completed; none was blocked. The single most serious finding was reached independently by three of the five lenses.

| # | Finding | Sev | Lenses | Disposition |
|---|---|---|---|---|
| **1** | **`opensAt` was computed, stored, and enforced nowhere.** A Wed/Sat/Sun slot pod is created at its *first claim*, up to a week before its fire, and its battle Monday is stamped from the **fire** — so a pod claimed in week W carries backing week **W+1** and an `opensAt` up to ~100 h in the future, while `poolEligible` still returns `eligible: true`. A stake in that gap carried next week's `weekKey`, so `ensureAllowance` **expired the whole of the live week's unspent allowance**, re-keyed the wallet to W+1, and every still-open pool of week W answered `week_mismatch` for the rest of the week. Irreversible for that backer. | P1 | **A, B, E** | **FIXED.** `materializePool` refuses to open a pool before its `opensAt` (`not_open_yet`); the stake transaction carries the same clause as a belt (`pool_not_open`). Verified independently by the coordinator against the production helpers before fixing. |
| **2** | **The close's refund was not score-neutral in the season bucket.** §2: *"voided stakes are score-neutral."* `debitStake` moves only `careerNet`; `creditRefund` moves `careerNet` **and** `seasons.{m}.net`. So every voided stake left `+amount` in that month for ever — a backer whose pool went `insufficient` read a positive month for a week in which nothing happened. | P1 | B | **FIXED** — see *The one deliberate deviation* below. |
| **3** | **Amendment A §A2 shipped its refusal without its remedy.** `requireEligibility` treats a superseded `termsVersion` as absent, but `attest.js` returned any existing doc unchanged — so the counsel-copy PR's `TERMS_VERSION` bump would have locked **every already-attested account** out of backing permanently (`eligibility/{uid}` is `write: if false`, so nothing else can move it). PR 2 created the dead end that PR 0 had explicitly deferred to it. | P1 | B | **FIXED.** `applyReattestation` keeps `adultAttestedAt`, updates `termsVersion`/`acceptedAt`, appends the prior pair to `history[]`. An identical version is still a no-op. |
| **4** | **The "no client importer" ratchet was blind to `.jsx`** — 710 of 1,242 files under `src/`, and exactly what PR 4's surfaces will be. A `.jsx` file importing `src/constants/backing.js` left the suite 9/9 green. | P1 | **C, D** | **FIXED.** Walker widened to `/\.(js\|jsx\|mjs)$/` — the spelling the sibling walker this file cites as its precedent already used. Mutation-verified: a `.jsx` importer now reds the row. |
| **5** | **A refused stake committed a partial transaction.** The Admin SDK commits a transaction body that *returns* and rolls back only one that *throws*. The `per_team_cap` refusal returned **after** `ensureAllowance` had buffered the week's grant and the prior week's expiry. | P2 | A | **FIXED.** The cap refusal now throws a typed `StakeRefusal`, so the transaction rolls back. The §12 check order is untouched — the fix is *how* the refusal leaves, not *where* the check sits. |
| **6** | **The replay probe returned whatever sat at the derived stake id, with no owner check**, and a reused `requestId` silently returned a stake for a different pod/team/amount under HTTP 200. | P2 | E | **FIXED.** A replay must match the caller's uid **and** the request's pod, team and amount; otherwise `409 request_id_conflict`. The id's `(uid, requestId)` encoding was also made injective (length-prefixed). |
| **7** | **A replay after an admin deleted the stake doc re-created it for free**, re-inflated `potTotal`, and reset the admin's `excluded` flag to `false` (Firestore does not cascade-delete, so `private/meta` survives). | P2 | E | **FIXED.** A `debitStake` replay with no stake document is refused (`stake_already_spent`), and the meta write preserves any `excluded` already set. |
| **8** | **The two endpoints disagreed on which pods are stakeable.** A pod that went `voided`/`expired` mid-week dropped off the list while its open pool kept taking allowance. | P2 | E | **FIXED**, and the fix corrected a mistake in the *first* attempt at it: gating the stake path on `listablePod` would have refused **dev** pods too, making §11 gate 4's founder smoke impossible. Split into `stakeablePod` (terminal + excluded slot) and `listablePod` (that, plus the list's own dev/training exclusions, D-DEVFIELD). |
| **9** | **The dev namespace was unreachable** — `poolEligible` refuses every dev pod and `materializePool` had no opt-in, so no dev pool could ever exist and `poolIdFor`'s `dev-` branch was dead code. §11 gate 4's smoke could not run. | P2 | B | **FIXED.** `materializePool(…, { allowDev: true })`, off by default and passed by no production caller. |
| **10** | **An `insufficient` close erased the pool's own record** — zeroing `potTotal`, `uniqueBackers`, `teamsBacked` and `private/totals`, so the list rendered *"backers 0 of 3 · teams 0 of 2"* to a backer whose stake had just been voided for thin participation. | P2 | B | **FIXED.** The reveal folds the stakes **step 3 judged** (the survivors of step 2), not what is still `live` after it. Identical for a `closed` pool; honest for an `insufficient` one. |
| **11** | **`materializePool` opened a transaction per listed pod on every GET, for ever** — ~40 transactions per request in the steady state, where a plain read would do. | P2 | E | **FIXED.** Plain `.get()` first; the transaction only when the pool is absent, so the create-race is unchanged. |
| **12** | **A `dev-`-prefixed `groupId` answered 500** (`BackingPoolError` was not typed-handled), and `BackingLedgerError.message` — which names internal wallet state — was returned to the client. | P3 | A, E | **FIXED.** Both typed errors are mapped; messages are logged, never returned. |
| **13** | **The joint transition of `potTotal` + `teamsBacked` partially de-seals per-team positions while a pool is open.** When `teamsBacked` increments to a value leaving one unbacked team — always the case in a 2-human-team pod — an observer learns *which* team took the stake and *exactly how much*. Amplified by `backingPools/{groupId}` being authed-read, so it is an `onSnapshot` stream, not a poll. | P2 | E | **NOT FIXED — founder decision.** Every input is spec-sanctioned: §3 makes pot total, unique backers and validity progress public while open. The leak is the *combination*, so closing it means changing what §3 publishes (e.g. `meetsTeamFloor` as a boolean instead of a count, and/or banding `potTotal`). That is a spec amendment, not a build fix, and PR 2 will not make it unilaterally. |

### Test-integrity findings (Lens D), all fixed

| Finding | Fix |
|---|---|
| `'a close racing a stake … the pool document serializes them'` contained **no race** — it ran past `closesAt`, so the handler's pre-flight `ensureClosed` produced the 409 and nothing contended. | Rewritten to run **inside** the clock window against `closePool` (which gates on status, not the clock), and now asserts `conflicts > 0`. |
| The **in-transaction clock check had zero coverage** — deleting the whole branch left all 74 rows green. | New row re-opens the pool between the pre-flight close and the transaction body, isolating the branch. |
| `'hasCompletedBattle is bounded to one document'` never measured the bound; removing `.orderBy().limit(1)` left it green. | A chain probe now asserts `limit === 1`, the sort, and both filters. |
| `resolveHashAtStake`'s **"LATEST completed battle"** was unasserted — flipping `desc` → `asc` left everything green. | Two battles with different `completedAt`; the later hash must win. |
| `'a CPU seat … costs no lookup'` and `'never fail a stake over telemetry'` both passed vacuously (no fixture reached the branch). | A completed battle is now seeded under the CPU id; a separate row makes the resolver's query **throw**. |
| `recordStakeLoss`'s docstring cited the wrong test and claimed the caller rule "cannot be half-applied silently". | Corrected: PR 2 ships no caller, so nothing can detect one; the row is a **characterization test** documenting what a half-application produces, and is now labelled as such. |
| `backingPools.js` cited `closePool.test.js`, which does not exist. | Corrected to `backingPools.test.js`. |
| *"a reader of the committed transaction sees the steps in the spec's sequence"* — not a property Firestore has; the close commits atomically. | Reworded to what the row actually pins: the **structural** order of the code. |
| The concurrency harness called its query read set *"coarser"* than Firestore's; it is **narrower**. | One word, plus the consequence spelled out (it misses conflicts, never invents them, so every "safe" conclusion holds *a fortiori*). |
| `backingWallet.js`'s header still said *"NOTHING IN PR 1 CALLS ANY OF THIS"*; `flagPinGuard.test.js`'s `DARK_BY_DESIGN` runway note still said *"nothing reads the flag yet; the routes … arrive in PR 2–5"*. | Both updated to the PR 2 state. The runway note is the one that prints on the day an accidental flip happens, so it is the one most worth being true (BUILD_RULES §6's stale-header class). |

### The one deliberate deviation from the build brief

The brief says *"PR 2 adds the primitive and its tests only — PR 3 calls it"*, and separately that the close voids stakes *"score-neutral via PR 1's `creditRefund` threading"*. **Those two requirements are in conflict**: `creditRefund` alone is not score-neutral, because `debitStake` never writes a month bucket for the stake it debits. Finding 2 is that conflict.

PR 2 resolves it in favour of §2's locked invariant: `closePool` now pairs each `creditRefund` with one `recordStakeLoss`, so a voided stake nets to **zero in both `careerNet` and `seasons.{m}.net`**. This is the only call to the E2 primitive in the PR; PR 3 remains its settlement caller. **Reversing the decision is deleting one call.**

Two further divergences from the *letter* of the E2 ruling were already built in and are pinned by tests rather than argued in prose:
- `recordStakeLoss` does **not** touch `careerNet`. `debitStake` already debited it, and `careerNet` is §2's Net BP exactly; a second debit turns the ruling's own worked example (−350) into −1,350.
- PR 3 must call it for the stake side of **every settled stake**, not only losing ones. Losers-only yields +150 in that same example, not −350.

### REFUTED — the candidates that did not survive

Recorded because a review that never refutes itself has not been run adversarially. The strongest, in brief:

- **Cap evasion through the empty `(userId, weekKey)` query's read set.** The premise about the read set is right and irrelevant: two racing stakes that could breach the cap are necessarily same user, same pod, same team, so they share the **pool**, **`private/totals`** and **wallet** documents. Neutralising conflict detection on exactly those three (leaving the query read set real) reproduces 600 BP on a 500 cap; restoring any one of them prevents it.
- **`backingStakes` list-denial as an existence oracle.** Tested against the real emulator: Firestore denies *every* list not carrying `where('userId','==',uid)`, **including the empty-result case** — 7/7 unscoped probes denied, the sanctioned query allowed. Success-vs-denial carries zero information.
- **Any client route to `backingStakes/{id}/private/meta`.** Refuted empirically for direct get, list, unfiltered and filtered `collectionGroup('private')`, `orderBy`, and `documentId()` queries, for owner / other user / privileged-claims / anonymous.
- **The shared in-memory-Firestore fixture drifting for its other 10 consumers.** All 10 suites (241 tests) were re-run against a byte-restored *old* `where()` and passed identically; a repo-wide grep of non-`==` operators found three candidates, each driven by a different mock.
- **"The moved PR 0 / PR 1 pins were weakened rather than moved."** The hardest one to refute, and it failed: every moved row keeps an exact-list `toEqual`, and the route row gained three per-route source assertions. Mutations prove both still red — except where one rested on the blind `.jsx` walker, which is finding 4.
- **`TX_WALLET_STATE` leaking across transaction retries.** A real hazard in principle (the SDK reuses one `Transaction` object across attempts); it cannot bite because every attempt calls `readWallet` first, which clears the entry.
- **A `BackingLedgerError` being swallowed as a retryable transaction error.** The SDK's retry predicate switches on numeric gRPC codes; a string `.code` falls through to `false`.
- Also refuted: allowance re-minting by alternating weeks (the `week_out_of_order` guard); `monthKeyForPool` misattributing a real pool (no NYSE holiday Monday falls on a month boundary in the calendar); the §3 close order being incidental; `teams[]` being written at open; own-pod comparing mismatched key spaces; dev/production namespace collision; §12's "not in this PR" list being violated; the rules block being shadowed by a wildcard; a module-scope flag derivation; reachability while dark; cron-budget or fence contact.

### Mutation checks

Twelve mutations across the two mutating lenses, plus three of the coordinator's own against the emulator (the rules table above). **Every prescribed mutation reddened precisely its named row** — close-order swap, reveal-before-void, seal broken while open, fingerprint on the parent doc, replay probe removed, flag read before auth, flag flipped true, an unreviewed cron importer — with one exception, the `.jsx` importer, which reddened nothing and became finding 4.

### Disclosure

- **No lens failed to complete**, and none was blocked. All five ran on isolated `git archive` snapshot trees; the mutating lenses worked only in their own trees and left the shared working tree untouched (verified `diff -rq` clean against a fresh extraction).
- **The new rules block is not executed by CI.** `test/rules/backingDenials.rules.mjs` runs only under `npm run test:rules` (Firestore emulator), and `.github/workflows/tests.yml` runs only `npm run test:run`. The emulator **was** available in this session and the suite passes (8 files / 201 tests, exit 0), but on a PR the block's guard is unexecuted. Pre-existing scoping, stated because the block is new.
- **`hashAtStake` hands the backer a hash they cannot otherwise read** (`agentBattles` is owner-read). §6 puts the field on the owner-read stake doc and §4 names the loadout marker as sanctioned disclosure, so this is by design — but the raw hash also permits testing hash **equality across seats and pods**, which is slightly more than the "loadout changed" marker §4 describes. Founder note, not a defect.
- **§6's table should be amended for carry-in E1**: it puts `fingerprint {ipHash, uaHash}` and `excluded` on the owner-read `backingStakes/{stakeId}`; this PR moves them to `backingStakes/{stakeId}/private/meta`, because rules cannot hide a field. PR 5's Sybil watch will need a subcollection or collection-group read.
- **§10's `stake_confirmed`** is written server-side by the stake endpoint per the spec; PR 2 writes no `backingEvents` doc, correctly deferred to PR 5 (§12), so PR 5 must re-enter `backing-stake.js`.
