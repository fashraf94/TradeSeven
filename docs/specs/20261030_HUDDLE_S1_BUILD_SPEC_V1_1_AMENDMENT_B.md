# Huddle S1 — Build Spec V1.1 — Amendment B

**Date:** Oct 30, 2026 · **Status:** adopted with V1.1 and Amendment A; the three documents are the S1 spec
**Applies to:** `20261030_HUDDLE_S1_BUILD_SPEC_V1_1.md` and `…_AMENDMENT_A.md`. Where they differ, B wins over A, and A wins over V1.1.
**Closes:** Astra final-pass items AR-9/AR-17 (P1), AR-4, AR-14, AR-16, and the A5(b) correction.
**Destination when committed:** `docs/specs/20261030_HUDDLE_S1_BUILD_SPEC_V1_1_AMENDMENT_B.md`

---

## B1. Filing and receipt are one transaction (AR-9, AR-17 — the P1) — replaces A5's first three bullets and §6.1 step 4

Every application of a plan to a battle — from confirm, from the apply route, and from the sweep — is **one Firestore transaction spanning two documents**: the battle document (the slot filing through `fileDirectiveTransactional` with the transaction handle, `directiveWriter.js:81-82`) and the huddle record (the `applications[]` receipt). Inside the transaction:
1. read the huddle record; if a `written` receipt for `(battleId, revision)` exists → **abort, no writes** (at-most-once);
2. read the battle; run the eligibility checks of §6.1 steps 1–3;
3. write the slot and append the receipt `{ disposition: 'written', revision, directiveThreadId, at, writtenBy }`.

The receipt is therefore durable exactly when the filing is, and recovery after an unknown outcome reads the **receipt**, never the slot. Receipt-from-slot recovery (A5) is withdrawn. A slot that no longer holds the plan's thread proves nothing about history; the receipt does.

Sweep outcomes become: **committed** (transaction returned → mirror committed state onto memory) · **unknown** (deadline or error after dispatch → no further dispatches, no memory mutation, log `sweep_unknown_outcome`; the receipt, if the commit landed, is found by the next reconcile or the next sweep's step 1). The deadline governs only new dispatches: the spec promises *no additional dispatches and no late memory mutation*, not that an in-flight commit is retracted.

## B2. Snapshot cutoff, corrected (A5(b)) — replaces A5's snapshot bullet

The evaluator refreshes the in-memory battle from the document before prompt construction (`refreshBattleFromDoc`, `agent-evaluate.js:2449`, merging the whole document at `:803`). So the check's controls come from **that refresh**, not from the sweep's mirror: a confirm that commits after the sweep returns but before `:2449` is rendered in this check; one that commits after the refresh waits for the next check. The sweep's mirror exists only to keep the pre-refresh reads (e.g. the epoch telemetry at `:1927`) consistent with what the sweep committed. The heard-stamp invariant (pinned at `agent-evaluate.tickStamps.pins.test.js:200`) is untouched; the huddle module never touches the in-memory battle after the sweep returns.

## B3. Plan retired at the session close, not in the evening (AR-14) — replaces A9's timing

The worker cron window becomes `*/2 12-21 * * 1-5` (through 21:58 UTC, covering 4:00 PM ET in both EDT and EST). On every invocation, the reconcile pass retires, for each `written` receipt whose battle slot still holds the plan's thread id and whose `session.closeMs` has passed (early closes included, `getSessionForDate(etDate).closeMs`), by the compare-and-clear of A9, and stamps `retiredAt`. Retirement therefore lands within two minutes of the stock close, before the chat voice's active-directive block (`voiceLayerPrompt.js:3731`) can present the plan as current. The evening settle tenant keeps its reconcile pass only as a backstop. Invocations with nothing to do exit in under a second.

## B4. Queue repair and finalizer ownership (AR-4, AR-16) — replaces A2's first two bullets

- **Reclaim order:** before claiming an expired row, the worker reads the huddle record. If `status == 'ready'`, the row is marked `done` (repair), never `failed`, regardless of attempts. Only a record that is not `ready` and has `attempts == 3` is marked `failed`.
- **Finalizer ownership:** every finalizer (record publish, queue `done`/`failed`, cache `ready`/`failed`) requires, inside its transaction, **all three**: generation equality, row `status == 'claimed'`, and `leaseUntil > now`. Marking a row `done` or `failed` also **bumps `claimGeneration`**, so a worker whose claim was terminalized by another can never pass the equality check afterwards.

## B5. Tests added to §9 / A11
- Two concurrent appliers on one `(battle, revision)`: exactly one `written` receipt, exactly one filing (emulator transaction contention).
- Apply commits, then the slot is replaced by a cockpit command and later cleared: a subsequent sweep does **not** re-file (the receipt blocks it).
- Early-close session (1:00 PM ET): the plan is retired by the first worker invocation after 1:00 PM; a newer chat directive in the slot is left untouched.
- Crash after publish, before queue `done`: the reclaim marks `done`, not `failed`.
- A worker holding a stale generation attempts each finalizer: all refused.
