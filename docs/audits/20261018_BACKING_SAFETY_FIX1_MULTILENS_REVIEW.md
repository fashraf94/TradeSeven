# Backing — safety fix 1: the multi-lens adversarial review

**Date:** 2026-10-18. **Reviewed state:** snapshot `d0ca6d64` (a dangling commit of the working tree over base `39053aed`, 34 files, +2,263 / −100), extracted per reviewer as an LF `git -c core.autocrlf=false archive` tree under the session scratchpad, `node_modules` junctioned. **Why a review:** the diff crossed BUILD_RULES §2's threshold (≥ 10 files, ≥ 1,500 lines). **The fixes:** applied in the working tree after the review and re-checked on a second snapshot (`68100937`) and, after the concurrency refuter's CON-1b, a third (the committed tree); they are in this PR's single commit. The build report is `docs/audits/20261018_BACKING_SAFETY_FIX1_BUILD_REPORT.md`.

## 0. Verdict

| | Count |
|---|---|
| Lenses | 5 (money conservation, the seal, concurrency and retries, flag-off and dark, client honesty), each its own agent on its own snapshot, read-only |
| Refuters | 3 (money + seal; honesty + dark; concurrency), each instructed to REFUTE every finding with a repro or a citation |
| Distinct findings | 35 (after merging duplicates found by more than one lens; one, CON-1b, found by a refuter) |
| CONFIRMED | 27 |
| PARTLY | 8 |
| REFUTED outright | 0 — four claims were refuted IN PART: SEAL-4's "anyone can probe" (only a requester whose allowance is short can), CON-1's pre-probe half (only `no_pod` can follow a commit), CON-6's asymmetry (the near end also admits on NaN, by design), CON-8's "captured at mount" |
| Fixed in this PR | 24 |
| Reported or left as is (pre-existing, out of scope, a ruling, or a NIT) | 11 |

The two findings that mattered most were found independently by more than one lens:

- **The second debit is not fully closed by the first cut of R6** — HON-1 = MON-2 = CON-1. A "Check again" answered by the door in front of the stake (429 rate limit, 401 sign-in, 404 dark route, 405) was treated as a typed refusal: the attempt was cleared, and the next Confirm minted a fresh id. Fixed: only the stake endpoint's own refusal statuses (400 / 403 / 409) end an attempt.
- **A stake committing between the close's reads and its commit was missing from the closed book** — MON-1 = CON-2. `closePool` never read `private/totals`, and above the §B2 floors a stake writes no pool document, so the two transactions shared nothing. Left live in a closed pool, the stake either burned (its team lost) or wedged the settlement on `payout_invariant` (its team won). It predates this diff, but sits in the transaction this diff rewrites. Fixed: the close reads the sealed totals, which every stake writes, so the two serialize on a document.

## 1. Lenses and what each covered

| Lens | Reviewer's scope | Ran |
|---|---|---|
| Money conservation | Void pairing, totals after `backer_seated`, the worst book under every money path, the cap's refusal point, the close re-read, R6 double-debit paths | 4 new suites (41/41) + 4 harness scripts |
| The seal | `full` as the only new field on every response; one write at 20; the 80-document limit; projection vs document; seal tests | 3 suites (132) + a 20/21 race simulation |
| Concurrency and retries | Stale reads, the cap under contention, R5 per attempt, R3's read set, the interleave rows, the harness extension, client races | 4 new suites (41/41) |
| Flag-off and dark | The flag-off claim path vs base, call-time flag reads, callers that pass `now`, the dark League, the fence, the smoke script | 103 dark / guard rows |
| Client honesty | R6's classification of every failure shape, the locked amount in both layouts, copy, "Full", `backer_seated` reach, lexicon | 5 suites (414) + node probes |

## 2. Findings and dispositions

Severity is the reviewer's; the verdict is the refuter's. "Fixed" means the fix is in this PR, with the row that pins it.

| Id | Sev. | Finding | Verdict | Disposition |
|---|---|---|---|---|
| HON-1 = MON-2 = CON-1 | HIGH | 401 / 429 / 404 / 405 on "Check again" cleared the attempt → a later Confirm double-debits | CONFIRMED (node probe: all four `ambiguous=false`) | **Fixed** — `stakeAttempts.js` `DECIDED_REFUSAL_STATUSES` (400/403/409 end an attempt; anything else keeps it). Rows: the door-refusal row and "a rate-limited Check again keeps the attempt … one debit" (`stakeOneRequest.jsdom.test.jsx`). Mutant M-R4 |
| MON-1 = CON-2 | HIGH / MED | A stake committing between the close's stakes query and its commit is missing from the closed book (burned, or the settlement throws `payout_invariant`) | CONFIRMED on the harness (0 conflicts, the stake `live` in a `closed` pool); Firestore exposure ASSUMED to depend on range locks; pre-existing | **Fixed** — `closePool` `tx.get`s `private/totals` before the stakes query. Row: "MON-1 / CON-2 … the close reads the sealed totals" (`backingCloseReread.test.js`). Mutant M-R1 |
| DARK-1 | BLOCKER | `backingBetaFlags.test.js` pins the `api/_utils` readers of `BACKING_BETA_ENABLED`; `liveDraftFormation.js` was a third → red on every platform | CONFIRMED (also caught by the Linux suite) | **Fixed** — the list moved deliberately, and the row now asserts the new reader's dark suite exists |
| DARK-1 addendum | — | `api/tournament/slot-endpoints.test.js` mocks `featureFlags.js` with a closed factory; the claim now reads `BACKING_BETA_ENABLED` → 500 | CONFIRMED (refuter; also the Linux suite) | **Fixed** — the mock carries `BACKING_BETA_ENABLED: false` |
| HON-3 | MED | A per-stake `backer_seated` void in a settled pool did not say the refund goes to the record, not the allowance | CONFIRMED | **Fixed** — the refund-to-record line beside any voided stake (results card both layouts; Your Backing). Rows in `backerSeatedCopy.test.jsx`. Mutant M-R9 |
| HON-4 | MED | Re-entering the form while the first request was in flight showed "We couldn't confirm" and never learned the answer | CONFIRMED (first half); PARTLY (no double debit — misleading copy only); also desktop's screen-level back link | **Fixed** — an in-flight mark and a per-key subscription in `stakeAttempts.js`; the re-entered form says "still being confirmed", holds its button, and turns to the right state when the first request lands. Two rows. Mutant M-R5 |
| HON-5 | LOW | The ambiguous branch did not re-save the attempt | PARTLY (harmless alone; matters only with HON-4) | **Fixed** — re-saved |
| HON-6 | LOW | A replay answered after close read "Sealed until the pool closes" for a stake no longer live | CONFIRMED | **Fixed** — `STAKE.backedSubClosed` for a non-live stake. Row. Mutant M-R11 |
| HON-8 / CON-8 | LOW / NIT | The attempt was read once at mount (no re-key on a uid change); `confirm` decided from mount-time state; no in-flight guard | PARTLY (no host path keeps the control mounted across an account change) | **Fixed** — re-read on a key change, read from the store at send, one request in flight per attempt. Row (HON-8) |
| SEAL-1 | MED | Amendment B §B3 lists the residual signals exhaustively; `full` is a third (it means exactly 20 backers, and dates the 20th stake) | CONFIRMED | **Fixed** — Amendment D now states the §B3 consequence beside its note on §B2/§B5 |
| SEAL-2 | LOW | No row failed if the close stopped deleting `full` | CONFIRMED (mutant survived 1,644 rows) | **Fixed** — the worst-case settle row asserts `full` before close and its absence after. Mutant M-R8 |
| SEAL-3 | LOW | Stale prose: "constant", "always false", "the two it accepts"; the stake reply's "same capped fields"; two test titles; the route header | CONFIRMED | **Fixed** — all corrected; the reply's omission of `full` stated as deliberate |
| SEAL-4 | LOW | The 81st-document check sat before the allowance, so a requester with too little allowance could probe the sealed document count for free | PARTLY (only a requester the allowance would refuse; refuted for "anyone") | **Fixed** — the document limit moved after the debit as a rolled-back throw (the backer limit stays early: "Full" is public anyway). Row. Mutant M-R2 |
| SEAL-7 / CON-4 | NIT / LOW | No row raced the 20th and 21st backers | CONFIRMED as a test gap (the refuter's race: correct) | **Fixed** — the race row (`Promise.all`) |
| MON-3 | LOW | A missing `private/totals` on a pool that has taken stakes failed the cap open | CONFIRMED (out of band only) | **Fixed** — refused (`no_pool`, `totals_missing`) when the public counter shows stakes but the totals are gone. Row. Mutant M-R7 |
| MON-5 = CON-7 | NIT | The settlement's deleted-pod branch labelled any close `refunded`; since the close decides on its own read, a recreated pod can close `closed` | CONFIRMED (introduced by this diff) | **Fixed** — `refunded` only for a refunded close. Row. Mutant M-R6 |
| CON-3 | LOW | A release that read its clock at fire − 1 ms could commit after a lazy close froze its seat | CONFIRMED (harness: the release and the close both committed, 0 conflicts; the pool's `teams` kept the departed seat, its backer's stake later settled `lost`) | **Fixed** — the release reads the pool (when Backing applies), so a close that commits first sends it round again and the fresh clock refuses. Two rows (and a flag-off control). Mutant M-R3 |
| CON-6 | NIT | The far-end window check failed open on an unreadable `closesAt` | PARTLY (pre-existing; the route's lazy close already closes such a pool; the near-end "asymmetry" claim refuted — it admits on NaN by design) | **Fixed** — closed when unreadable |
| CON-9 | NIT | `runTransaction` wrappers in the new rows were restored without `try/finally` | PARTLY (true, harmless: a fresh db per row) | **Fixed** |
| DARK-2 | LOW | The flag-off row measured only the join branch | PARTLY (the call-site mutant survives the new file; other suites' fixtures catch it by accident) | **Fixed** — a flag-off create-branch row (no stake read) with its flag-on control. Mutant M-R10 |
| DARK-3 | LOW | "A preview smoke on a dev pod can exercise it" overstated: no writer creates a dev slot pod | CONFIRMED | **Fixed** — the comment says so; the build report states R3 has no preview smoke |
| DARK-4 | LOW | `slotClockFor` pins the clock to a passed `now`; production callers pass none, protected only by a docstring | CONFIRMED (latent) | **Fixed** — a static row asserts both slot routes call the writers without `now` / `clock` |
| DARK-5 = N5 | NIT | `bad_user` alignment lost a space | CONFIRMED | **Fixed** |
| HON-2 = MON-4 | MED / LOW | A second tab (per-tab `sessionStorage`) can stake again with a new id | CONFIRMED (disclosed limit) | **Reported** — item E scoped the store to the tab; build report §6. A `localStorage` + `storage`-event store would close it — a ruling |
| HON-7 | LOW | `stake_already_spent` on a resend clears the attempt and its copy invites a new stake | CONFIRMED (out-of-band only) | **Reported** — copy belongs to safety fix 3 |
| HON-9 | LOW | 401 / 429 copy | CONFIRMED (carried in) | **Changed by HON-1's fix**: those now show the unresolved state ("We couldn't confirm …", Check again). Plainer copy for sign-in / rate limit is safety fix 3's |
| MON-6 | LOW | Close / settlement / refund select stakes by `groupId` only, while the cap is per namespace | CONFIRMED by construction; reachable only if `isDev` flips after stakes exist; pre-existing | **Reported** for separate tasking (BUILD_RULES §3) |
| SEAL-5 | LOW | A pool at ≥ 20 backers from before this deploy carries no `full` until its next stake | CONFIRMED (dev / smoke pools only while the flag is off) | **Reported** — build report rollback note |
| SEAL-6 = N2 | NIT | Server `fullForViewer` and client `poolFullForViewer` are one rule written twice; no client reads `backable` | CONFIRMED / PARTLY (`backable` alone cannot drive the tag) | **Not changed** — they read identical inputs; noted |
| CON-5 | NIT | A replay of a committed request to a since-deleted pod answers `no_pod`, not its success | PARTLY (the deleted pod's close has normally refunded the stake already, so "success" would misreport; the exception is CON-1b) | **Not changed** beyond CON-1b |
| CON-1b | MED | Found by the concurrency refuter: a pod deleted and re-claimed between `placeStake`'s first group read and its lazy close answered a resend of a COMMITTED request `no_pod`, leaving the pool open and the stake live; the client then ended the attempt on that typed answer, and the next Confirm debited again (reproduced: a top-up, two debits) | CONFIRMED (refuter's repro) | **Fixed** — `placeStake` re-reads the pod after the lazy close; a pod that is back goes on to the transaction, whose replay probe answers. Row: "CON-1b … answered as its replay" (`backingCloseReread.test.js`). Mutant M-R12 |
| N1, N3, N4, N6 | NIT | No feedback on a repeated ambiguous answer; storage entries survive sign-out; curly vs straight apostrophes vs the verbatim rulings; "Full" beside "Yours" | CONFIRMED | **Not changed** — recorded; N4: house typography is curly, every test compares the exported constant, Amendment D carries the rulings verbatim |

## 3. The concurrency refuter

The third refuter re-ran the concurrency findings on the reviewed snapshot with stdin scripts against the real writers (no file written):

- **CON-1 PARTLY** — the middleware half CONFIRMED (429 / 401 / 404 answered before `placeStake` all read `ambiguous=false`); the pre-probe half mostly REFUTED (`no_pool` cannot follow a commit, `smoke_requires_dev` cannot change between sends, `no_pod` normally refunds first) — except **CON-1b**, which it reproduced as a real second debit and which is fixed here.
- **CON-2 PARTLY** — CONFIRMED on the harness (the stake left `live`, the settlement threw `payout_invariant`); Firestore exposure rests on its documented serializability, not on anything testable in-tree; the second clause (the route row forces only close-first) CONFIRMED — the new MON-1 row is the stake-first order, made honest by the totals read.
- **CON-3 CONFIRMED**, **CON-4 CONFIRMED** (coverage), **CON-5 PARTLY**, **CON-6 PARTLY**, **CON-7 CONFIRMED** (R5 narrows it to the claim gap but does not make it unreachable; only the return value and an admin log line were wrong), **CON-8 PARTLY**, **CON-9 PARTLY**.

## 4. Mutation results for the review's fixes

The second round ran on snapshot `68100937` (the tree after these fixes), with the same runner. For each mutant the runner checks the anchor appears exactly once, runs the target file, then restores the file and re-hashes it. The unmutated control passed every target file first.

**All 21 mutants were killed:** the nine prescribed ones (M-A1…M-E1, re-run on the fixed tree), eleven for this review (M-R1…M-R11), and M-R12 for CON-1b on snapshot 3 (the tree after the refuter's finding). The table, with the rows each one failed, is the build report's §9. The ones that pin a CONFIRMED finding:

| Finding | Mutant | Killed by |
|---|---|---|
| MON-1 / CON-2 | M-R1 — the close stops reading `private/totals` | the stake-first interleave row |
| SEAL-4 | M-R2 — the document limit back before the allowance | the probe row, the 81st-document row |
| CON-3 | M-R3 — the release stops reading the pool | the release-vs-close row |
| HON-1 / MON-2 / CON-1 | M-R4 — door refusals definitive again | the door-refusal row, the rate-limited "Check again" row |
| HON-4 | M-R5 — ignore a request still in flight | the re-entry row |
| MON-5 / CON-7 | M-R6 — the deleted-pod label | the MON-5 row |
| MON-3 | M-R7 — missing totals admit | the MON-3 row |
| SEAL-2 | M-R8 — the close keeps `full` | the worst-case settle row |
| HON-3 | M-R9 — no refund line for a per-stake void | the two results-card rows |
| DARK-2 | M-R10 — the create branch reads stakes with the flag off | the flag-off create row |
| HON-6 | M-R11 — the non-live replay sub-line | the HON-6 row |
| CON-1b | M-R12 — no re-read of a pod that came back mid-request | the CON-1b replay row (snapshot 3) |

**After the fixes:** the Linux full suite (CI shape) on the committed tree was green: `Test Files  1042 passed | 7 skipped (1049)` / `Tests  22551 passed | 88 skipped (22639)`. `lint:gate` and `vite build` exited 0, and the rules emulator suite passed 424 of 424. See the build report's §8.
