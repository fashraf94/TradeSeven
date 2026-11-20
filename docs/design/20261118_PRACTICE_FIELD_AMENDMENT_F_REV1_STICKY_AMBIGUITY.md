# Practice Field — Amendment F, revision 1: sticky ambiguity

**Date:** 18 Nov 2026 · **Author:** the Practice Field chat · **Status:** the founder's ruling for T1a-2b-3 fix round 2.
**Amends:** Amendment F (F-5, F-7). It also replaces T1a-1's R-21 rule that a conflict settles when the feed corrects itself. Where this revision and an earlier rule disagree, this revision wins.
**Destination:** `docs/design/20261118_PRACTICE_FIELD_AMENDMENT_F_REV1_STICKY_AMBIGUITY.md`, committed in fix round 2 (no docs-only PR).

## Why

Each review round has found new orders of vendor events in which the code settles an ambiguous action on its own and gets the money wrong at full quality. Each fix closed one order, and the next round found another.

The cause is structural. Several automatic paths can each settle an action that was once ambiguous:
- a re-listing;
- a moved date;
- a replay after an outage;
- a backfill row;
- a split simulated during screening.

Their combinations cannot all be enumerated. **This revision removes the automatic settling of ambiguity, instead of patching each order.**

## S-1 · What counts as ambiguous

An action id on a ledger becomes **ambiguous** the first time any of these is seen for it:

1. **A conflict:** two or more economic payloads under one id. This holds whether the payloads arrive in one call, across days, or across the daily layer and a backfill.
2. **A revision:** a payload under an unsettled id that differs from one already seen for it.
3. **A possible re-date** (F-7). The new row and the row it may repeat both become ambiguous.
4. **A disagreement between an archived daily row and a backfill row** for the same id.

For a share-basis action, the **symbol's** share basis is in doubt on every ledger that carries the ambiguous id, under the existing class rule. For a cash action, only that payment waits.

## S-2 · Ambiguity is sticky

**Once an id is ambiguous, only a founder ruling settles it.** No automatic path may settle, decline, apply or retire it. That covers:
- re-listing, under the same id or a moved date;
- the feed later listing a single payload;
- a replay after coverage returns;
- a backfill row;
- RF-A2's settling under a moved date (withdrawn);
- a screening simulation.

The ruling names the outcome explicitly, through `resolve_hold`'s `conflict` kind: one payload seen, or `none`.

Until it is ruled, the ambiguous id:
- moves no cash and no shares on any ledger;
- leaves its symbol's rows below full quality when it is share-basis;
- is named on the result if the idea reaches its endpoint.

A ruling settles exactly the id it names. If the same id later shows a payload different from the ruled one, that is a new ambiguity: alert, and wait for a new ruling.

## S-3 · What still settles automatically

An action that has **never** been ambiguous is applied by the feed exactly as today: one payload, covered, not a re-date candidate. **When the data is complete and unambiguous, money moves exactly as today.**

## S-4 · Screening uses the holding's real state

The gap screen's decisions use the state the ledger actually holds. A split that coverage or ambiguity prevents from applying cannot explain or retire a suspicion, nor suppress a transition. That includes its effect in a simulation.

## S-5 · Rulings and feed rows are per ledger

Disputed rows are filtered against **each** recipient ledger's own open records. A genuine feed row is applied on a ledger that carries no open record for its id, even when another ledger of the idea is disputing the same id.

## S-6 · Invariants, tested over generated sequences

The build carries a randomized sequence test. It covers purchases on ex-dates, conflicts, revisions, re-dates, coverage failures, backfills that agree and disagree, split-shaped price paths, founder rulings and replays. After every close it checks:

| | Invariant |
|---|---|
| **I-1** | No id is both applied and declined on a ledger |
| **I-2** | An ambiguous, unruled id has moved no cash and no shares since it became ambiguous. Its symbol's rows are below full quality when it is share-basis |
| **I-3** | Conservation across the idea's three ledgers and the book's mirror |
| **I-4** | A sequence with complete coverage and no ambiguity ends with the money the engine's own applier gives over the same rows, in date order, with entitlement |
| **I-5** | Re-running any close adds nothing |

**Every reproduction from Astra's reviews runs as a fixed case,** with its seed.

## What this costs

There will be more holds waiting for the founder, whenever the vendor's data is inconsistent. How often that happens is unknown; the founder-only test will measure it. In exchange, **an inconsistent feed can no longer produce a wrong number at full quality, by construction.**
