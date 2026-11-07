# Huddle S1 — Build Spec V1.1 — Amendment A

**Date:** Oct 30, 2026 · **Status:** adopted with V1.1; the pair is the S1 spec
**Applies to:** `20261030_HUDDLE_S1_BUILD_SPEC_V1_1.md`. Where this amendment and V1.1 differ, this amendment wins.
**Closes:** Astra re-review findings AR-2, AR-4, AR-5, AR-6, AR-9, AR-10, AR-11, AR-12, AR-13, AR-14 (partially resolved) and AR-16–AR-20 (new).
**Destination when committed:** `docs/specs/20261030_HUDDLE_S1_BUILD_SPEC_V1_1_AMENDMENT_A.md`, beside V1.1 in the S1 build PR

Each item below names the V1.1 section it changes and gives the replacement rule in full.

---

## A1. Confirm is two-step when validation changes anything (AR-2) — replaces the confirm row in §6

`POST /api/huddle/confirm` with `{ etDate, baseRevision, replacement }`:
1. In a transaction, require `plan.status == 'proposed'`, `plan.revision == baseRevision` (else **409** with stored `current` and `revision`), `now < session.closeMs` (else **410**, plan marked `expired`).
2. Validate `replacement` (§4.3). If validation **drops or transforms any item**, do not confirm: write the normalized result as the new `current` with a new `revision`, and return **422** with `{ current, revision, drops[] }`. The sheet shows exactly what will be filed and asks the player to confirm again. Only a replacement that validates with **zero changes** proceeds.
3. Render, check ≤ 500 chars (else **422** `rendered_too_long`, nothing written), freeze `plan.confirmed`, set `status='confirmed'`, `measurement.confirmedAt`, then apply (§6.1).
A repeat with the same `baseRevision` after confirm returns the confirmed state (idempotent).

## A2. Generation ownership on every finalizer; attempt cap at admission (AR-4, AR-16) — replaces §3.3 Claim/Publish/Done and adds to §3.5

- **Claim admission:** a row is claimable only if `attempts < 3`. A reclaim of an expired lease with `attempts == 3` marks the row `failed` and the record `failed` instead of claiming.
- **Every write by a worker** — huddle record publish, queue `done`/`failed`, cache `ready`/`failed` — runs in a transaction that re-reads the owning row (queue row for record and queue writes; cache doc for cache writes) and proceeds only if its `claimGeneration` equals the worker's. Otherwise the write is skipped and logged `stale_generation`.
- **Immutability inside the publish transaction:** the publish transaction also re-reads the huddle record and aborts (no write) if `status == 'ready'` or `plan.status in ('confirmed','skipped')`.
- **Cache:** `huddleTickerCache/{etDate}_{SYMBOL}` gains `claimGeneration`; a claimant whose lease expired and whose generation is stale cannot publish; a successor's result stands.

## A3. Enqueue recovery belongs to the worker, not a second cron invocation (AR-5, AR-18) — replaces the "second invocation at 13:30 UTC resumes" sentence in §5.1

The worker, on every invocation inside its window, first reads `huddleRuns/{etDate}`. If the flag is on, the date is a trading session, `briefStage == 'done'` and `enqueueStage != 'done'`, the worker runs the enqueue stage itself (idempotent row keys) before draining. The brief cron's ET window guard admits one scheduled hour and is not relied on for recovery.

## A4. "Replaced" wording is neutral unless evidenced (AR-6) — replaces the `replaced` bullet in §6.4

`replaced` = the slot's `directiveThreadId` is no longer the plan's (including an empty slot after a cockpit command was retired, `directiveWriter.js:53-68`). Copy: **"no longer current."** Append "since {time}" only when the slot holds a directive whose `createdAt` is later than the plan's `written` receipt; never otherwise.

## A5. The sweep's commit outcome can be unknown; recovery is idempotent (AR-9, AR-17) — replaces the deadline sentences in §6.3

- The sweep performs **one transaction on the battle document** (filing the slot) and then **one write to the huddle record** (the receipt). The 3 s deadline governs *starting* work, not retracting it: a transaction dispatched before the deadline may still commit after it.
- Outcomes: **committed** (both writes done → mirror onto memory) · **found** (slot already holds the plan's thread → mirror, write receipt if missing) · **unknown** (deadline or error after dispatch → mirror nothing, write nothing further, log `sweep_unknown_outcome`).
- **Receipt-from-slot recovery:** the reconcile pass (§6.5) treats a slot holding a plan thread id with no matching `written` receipt as proof of filing and writes the receipt. An unknown outcome is therefore repaired by the next reconcile; nothing is double-filed because the transaction's own compare makes a second filing a no-op.
- **Snapshot cutoff:** the in-memory `battle` as it stands when the sweep returns is the check's controls snapshot for both prompt construction and the heard stamp (consistent with `agent-evaluate.js:4545-4547`). A confirm that lands after the sweep returns is not reflected in that check; it is picked up by the next check's sweep. The spec states this; the status copy says "waiting for the agent's next read," which remains true.
- **No late memory mutation:** after the sweep returns, nothing in the huddle module touches the in-memory battle for that check.

## A6. Replenishment and budget reservation (AR-10, AR-20) — replaces the concurrency sentences in §5.3

- The worker keeps **4 jobs in flight**, starting a new job whenever one finishes, until fewer than **130 s** of the 300 s `maxDuration` remain (reserve for the longest job plus writes). It then drains in-flight jobs and exits.
- Cron `*/2 12-17 * * 1-5` runs through 17:58 UTC. First tick is up to 2 minutes after enqueue.
- Expected worker-only completion, 120 s jobs, no retries: ~4 / ~14 / ~52 minutes for 10 / 50 / 200 players, plus reconcile and overhead. S1's stated target is ≤ 50 players; above that is a separate scaling slice. Reconcile (§6.5) runs before draining and is budgeted at ≤ 10 s per invocation.

## A7. Evidence references for spoken claims (AR-12) — adds to §5.3 Script

The gather step assigns ids to evidence items (opener text paragraphs, holdings, news items, calendar events). The tool schema requires every names-beat sentence that explains an exit, a pick reason, or a headline to carry an `evidenceIds[]` array; code checks each id exists in the gathered evidence. A sentence with a missing or empty reference fails validation → one regeneration, then the beat is dropped and the drop recorded. The transcript marks each such sentence with its sources.

## A8. Query and index manifest (AR-13) — replaces the index sentence in §3

The builder writes `docs/specs/huddle-s1-queries.md`: every Firestore query the slice makes, its fields and operators, and whether it needs a composite index under Firestore's rules (equality on one field plus a range or order on another needs one). Every required index is added to `firestore.indexes.json`. The emulator does not enforce composites, so the founder's flag-on smoke on the preview (which uses the live database) is the validation step: any query that fails for a missing index is a smoke blocker, and the report records the console link the error provides.

## A9. Plan thread retired at the close (AR-14) — adds to §6.5

At the evening settle reconcile pass, for every battle with a `written` receipt whose slot **still holds the plan's thread id**, the module performs a compare-and-clear of the slot (the same existing-key pattern the call-family retire uses, `directiveWriter.js:53-68`): set `directive` to null only if its `directiveThreadId` equals the plan's. A newer directive is never touched. The receipt gains `retiredAt`. This stops the chat voice's "active right now" block (`voiceLayerPrompt.js:3731`) from carrying the plan past the session. No new battle key is written; the battle schema is untouched.

## A10. Darkness, server-side, corrected (AR-19) — replaces §13 and the cron sentences in §5.1

While `DRB_HUDDLE_ENABLED` is off, **the brief behaves exactly as HEAD**: its cron entry stays `30 12 * * 1-5` (`vercel.json:182`), with no DST pin and no trading-day skip, and its handler's only new behaviour is writing the `huddleRuns` marker around the brief stage. The enqueue and drain stages, the worker cron (new entry; exits at once when off), every `/api/huddle/*` route (404), the sweep helper (returns at once), the settle reconcile tenant (returns at once) and the hub chip/sheet/panel are all gated. The DST pin and the trading-day skip for the brief move to the **flip PR** with the brief-card removal, where they belong with the behaviour change. Cron count in S1: 44 → 45 (the worker only).

## A11. Housekeeping
- §3.3 selection query (`status`, `leaseUntil`, `createdAt`) and the reclaim query are listed in the A8 manifest.
- §9 offline concurrency tests gain: a stale cache claimant publishing after its successor (nothing written); confirm returning 422 on a transformed replacement; the worker recovering an unfinished enqueue stage; the sweep's unknown outcome repaired by reconcile (one receipt, one filing); the evening retire leaving a newer chat directive in place.
- §14 gains rows AR-16–AR-20 → A2, A5, A3, A10, A6.
