# FantasyTrades — Backing Beta Spec V1.3: Amendment D

**Date:** October 18, 2026
**Status:** Amends `FANTASYTRADES_BACKING_BETA_SPEC_V1_3.md` (build-governing) after Amendments A, B and C. Six founder rulings.
**Source:** the founder's rulings of October 18, 2026, on Astra's whole-feature pre-flip review of October 7, 2026 (reviewed at `3f784e8`, verdict NOT READY). Fable re-checked the cited code on October 18 at `39053ae`; no Backing file had changed since Astra's review. Built in safety fix 1 (`docs/audits/20261018_BACKING_SAFETY_FIX1_BUILD_REPORT.md`).

**Note on Amendment B.** R2 adds one field to the public pool document's open-state fields defined in Amendment B §B2/§B5: `full` (`true` once a pool admits its 20th distinct backer). It is the only field this amendment adds to the public document. It carries no count, no amount and no team, and it comes off the document at close with `backerProgress` and `teamSpread`.

**Consequence for Amendment B §B3, stated so the record is exact.** §B3 lists the residual public signals exhaustively (the team spread flipping to met; the backer counter ticking below the floor). R2 adds a third, by the founder's ruling: because a pool admits no 21st backer, `full: true` tells a spectator that the pool holds **exactly 20** distinct backers, and the moment it appears dates the 20th backer's stake. It says nothing about amounts, teams or the pot. Reaching the 80-document limit adds no signal (R2); it is refused only to a request that would otherwise have been admitted, so the document count cannot be probed by a request the allowance would refuse.

---

## The rulings, verbatim

**R1 — Pool size.**
- A pool admits at most 20 distinct backers and at most 80 stake documents. The second limit is the belt for slot seat churn, where a backer can hold stakes on a departed seat and its replacement.
- A stake that would add the 21st backer, or create the 81st stake document, is refused with `pool_full`: "This pool is full."
- A top-up of an existing stake document is never refused by R1. The per-team cap and the allowance still apply.
- The 120/480 limits are unchanged.

**R2 — "Full" is public, and nothing else is.**
- Admitting the 20th distinct backer writes `full: true` on the public pool document in that same transaction. This is the only new public field: no count, no amounts, no team information.
- The pod list shows "Full" to a viewer with no stake in that pool, and offers no way to start a new stake there.
- A viewer with a stake sees their stake as today and can top it up, or back another team while under 80 documents.
- Reaching the 80-document limit sets no public flag; it is a refusal only.

**R3 — Back-then-join is refused.** A slot claim by an account that holds a live stake in that pod's pool is refused with `backed_this_pod`: "You've backed a team in this draft, so you can't take a seat in it. Pick a different slot."

**R4 — The close belt.**
- At close, any live stake whose backer holds a seat in the pod, per the close transaction's own read, is voided with the new reason `backer_seated`.
- It is refunded to the record like every other void. The weekly allowance is not restored (`creditRefund`, unchanged).

**R5 — Deadlines are checked when the write executes.**
- Every transaction attempt that admits a stake, claims a slot seat or releases a slot seat takes a fresh clock reading. It refuses at or after the pool's close, or at or after the slot's fire instant.
- A replay of an already-committed stake request still returns its original success after close. The replay probe stays first.

**R6 — One Confirm is one request until it resolves.**
- An ambiguous outcome keeps the same request id and amount:
  - `network`;
  - `server_error`, including a timeout, a 5xx or a non-JSON body;
  - a reply without a stake.
- The only way forward is "Check again", which resends the identical request.
- Only a definitive outcome ends the attempt: a success, or a typed refusal.
- A different amount or team is possible only after it resolves.

---

## What Astra found, and which ruling answers it

| Astra's finding | Severity | Ruling | Built in |
|---|---|---|---|
| BKG-001 — a popular pool can be impossible to pay or refund (no limit on the book; 24 backers × 4 stakes is held for ever) | Blocker | R1, R2 | safety fix 1, item A |
| BKG-002 — close decides membership from a stale group | Blocker | R4 (and the close's own read) | safety fix 1, item B |
| BKG-004 — a lost reply plus "Try again" stakes twice | High | R6 | safety fix 1, item E |
| BKG-005 — back-then-join | High | R3, R4 | safety fix 1, item C |
| BKG-006 — deadlines use request-entry time | Medium | R5 | safety fix 1, item D |

Recovery (an automatic sweep of pending pools, a separate admission pause, an admin refund of open pools, monitoring) is safety fix 2; the remaining Medium items and copy are safety fix 3. The 120 / 480 settlement limits are this code's own margins (Google removed Firestore's 500-write transaction limit on March 29, 2023) and are unchanged.

## Rulings ledger — additions

| # | Question | Ruling |
|---|---|---|
| R1 | Pool size | At most 20 distinct backers and 80 stake documents per pool; past either, `pool_full`; a top-up is never refused by it; 120 / 480 unchanged |
| R2 | What "full" publishes | `full: true` at the 20th backer, written once; "Full" on the pod list to a non-backer, with no way to start a stake; the 80-document limit publishes nothing |
| R3 | Back-then-join | A slot claim by a holder of a live stake in that pod's pool is refused `backed_this_pod` |
| R4 | The close belt | A live stake whose backer is seated at close, per the close's own read, is voided `backer_seated` and refunded to the record; the allowance is not restored |
| R5 | Deadlines | Read on a fresh clock on every attempt of a stake, a slot claim and a slot release; a committed request's replay still succeeds after close |
| R6 | One Confirm, one request | An ambiguous outcome keeps the request id and amount; "Check again" resends it; only a success or a typed refusal ends the attempt |
