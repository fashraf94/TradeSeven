# ID-1 Activation Evidence — Shape Note V1.7

**Date:** 4 November 2026 · **Author:** Fable (framework chat) · **Status:** the contract for Build 2 (the ID-1 observer); §3 and §8 describe Build 1's store as merged (PR #1018). V1.3–V1.5 folded in Phase 0, the 30 Oct review and Build 1's rulings. V1.6 folded in Astra's spec review of Build 2 (4 Nov, `main` `9d97b396`; nine findings) and the founder's ruling of 4 Nov to extend the host cron by one hour (01:00–01:45 UTC). **V1.7 folds in Astra's recheck (4 Nov, `main` `f3da14a3`; six findings, all accepted): no pointer is written when the calendar cannot name a session; bounded, fair traversal; a run that always keeps time to acquire; the census's cohort; the resolver's ownership read; the module boundary.** What changed is listed in §10 (V1.6) and §11 (V1.7). V1.6 was never committed. Supersedes V1–V1.6. · **Destination:** `docs/design/20261104_ID1_ACTIVATION_EVIDENCE_SHAPE_NOTE_V1_7.md`, committed byte-identical by Build 2's docs commit; project copy `claude/ID1_ACTIVATION_EVIDENCE_SHAPE_NOTE_V1_7_NOV04_2026.md`.

---

## 1. In plain terms

Two records. A shared **snapshot** keeps, once per completed session, per stock, per rule set, what the Trend Follower's setup rule said about that stock and the price evidence it said it from. An **activation pointer** is written each time a stock enters a Trend Follower's portfolio, freezing the snapshot it entered under and the swing low its thesis breaks below. Nothing about trading changes. Build 1 made the snapshot store; Build 2 makes the observer that writes pointers.

V1.6 and V1.7 tighten three things before any pointer exists: **when** a pointer may be written without evidence (only after the battle has really ended, only after this run asked the store and was told the evidence is not ready, and only if no finished snapshot exists at the instant the pointer is written); **which** holding a pointer belongs to (each slot's history is rebuilt in order, so a stock that leaves and comes back is never mistaken for the original); and **how much** the host cron changes for its other jobs (their time budget does not change).

## 2. Scope (ruling Q-ID1-1)

- **Recorded:** tiered BaggerBomb battles (`gameMode` absent or `baggerbomb_agent`), the owner's agent side, whose battle carries `agentContext.archetype = 'momentum_chaser'` (the Trend Follower). Casual clones are included.
- **Positions:** the owner's tiered slots only (star, core, support). The opponent's holdings and the bench are never activations.
- **Excluded and counted:** tournament (flat6) battles, CPU sides (`isCpu`), training clones (`training-agent-`), and crypto lifetimes (the evaluator refuses them by class). When a battle meets several exclusions, it is counted once, under the first in this order: game mode, CPU, training clone, archetype.
- **Battle length:** any (FD-1).
- **Gate (Build 2):** `ACTIVATION_EVIDENCE_ENABLED` (dark) plus the cockpit allowlist. Flag off or an empty allowlist: the observer returns before any read. With a non-empty allowlist, candidate battles are selected by owner-scoped queries, so no battle, pointer, tick or store read touches an owner outside the allowlist. **One exception (V1.7):** for an allowlisted owner's casual clone, the attribution resolver reads the parent agent the clone names, to verify that the same owner holds it (`casualClone.js`). Nothing from that read is recorded or used beyond the check; a mismatch makes the attribution unresolved, and the record never moves to another user. A week of census is a review point for widening, not automatic approval.

## 3. The snapshot store (Build 1, unchanged since V1.5)

**Collection** `setupEvidence`, server-only. **Document id** `${session}__${symbol}__${ruleKey}`, where `ruleKey` encodes the **whole** rule-set triple losslessly: `${setupVersion}.${thresholdsHash}.${semanticsId with "/" replaced by "~"}` (today `tf-setup-v1.26f3f411b566.tf-setup-v1~sem-1`). Key generation validates the triple and rejects a malformed one; parsing an id returns the exact triple; two different triples never share an id. The full triple is also stored verbatim in the document.

**Session.** Every request names a completed session from the wrapper `lastCompletedSessionAt(instantMs)`: a weekend or holiday, or an instant before the close, maps to the previous session; at or after the close, to that day; early closes and DST come from the calendar's own tables; outside the maintained years (2026–2027) it returns `calendar_missing`. It takes **epoch milliseconds**; anything else returns `calendar_missing` with `why: 'malformed_instant'`.

**Content.** `schemaVersion: 1`; `key { session, symbol, ruleSet }`; `status: ok | refused`; the adapter's evidence exactly as returned; the entry record `evaluateTfEntry(evidence)`; `asOf`, `requestedAsOf`, `refusal` as the evaluator emits them; `source: 'eodhd_eod'`; `sourceMeta { fetchedAt, from, to }`; `evidenceClass.bars`; `capturedAt`; `writer { host, commit }`.

**Acquisition.** Its own EODHD `/eod/` date-range read, 130 calendar days back, newest first (`order=d`), through the shared `fetchDailyPayload` with a 5-second timeout. Nothing re-sorts a payload. Crypto is refused before any call and writes nothing. `fetchedAt` and `capturedAt` are the instant the response was received. The bars class is `contemporaneous` when the response arrived while `session` was still the latest completed session, otherwise `later_reconstruction`.

**Final or retryable.**

| Outcome | Class |
|---|---|
| ok evidence with adjustment metadata present | final |
| `basis_discontinuity`; a `missing_fact` on any row older than the newest session | final |
| an interior `missing_bar`; `unordered_bars` with `why: 'non_session_date'`; ok evidence whose adjustment metadata is absent; `insufficient_history`; a `missing_fact` on the newest session's row | **confirm:** final only when a separate fetch at least 30 minutes later reproduces the same reason and detail; the first occurrence is retryable |
| a newest-session `missing_bar` | retryable, never finalised by the store; the observer's finalisation (§4.3) records `missing` on the pointer instead |
| `calendar_missing` (unmaintained year); `asOf_in_future`; a malformed or out-of-order payload; fetch timeout, non-200 | retryable |
| `calendar_missing` with `why: 'malformed_date'`; `asOf_not_a_session`; an ok result whose `asOf` differs from the request | programming error: throw, write nothing |

**Create-once, the lease and the confirmation record.** The final document is written by `create` inside a transaction and never updated; a lost race reads the winner. The mutable state lives in `setupEvidenceClaims/{id}`: the lease (120 s, an ownership token checked by every claim mutation), the observation `{ reason, detailHash, observedAt }` (kept across lease releases; a matching result before 30 minutes keeps `observedAt`; a different confirm-class result replaces it; a retryable result leaves it), and `attempts`, `lastAttemptAt`. A caller that finds a live lease gets `pending` and does not fetch. The 30 minutes run from the first response to the confirming request's start, so two runs nominally 15 minutes apart may be a few seconds short; confirmation can take three runs.

## 4. The activation pointer (Build 2)

`agentBattles/{battleId}/activations/{activationId}`, server-only in V1 (ruling Q-ID1-7), created once, never updated, never repaired by replacement.

| Field | Meaning |
|---|---|
| `schemaVersion` | `1` (V1.6, ratified). Every pointer carries it from the first write. |
| `activationId` | The lifetime's position id on the corrected stock route (§4.1); otherwise `${tier}:${slot}:${entryInstantIso}`, the instant normalised to `new Date(ms).toISOString()` |
| `kind`, `battleId`, `symbol`, `tier`, `slot` | `creation` or `swap_in`; `tier` is `star`, `core` or `support`; `slot` is the slot index (a number) |
| `battleAgentId`, `attributionAgentId`, `attributionStatus`, `archetype` | `attributionStatus` is `unresolved` exactly when `isCasualCloneId(battle.agentId)` and the resolver returned the clone's own id; otherwise `resolved`. Unresolved records stay out of growth joins |
| `stream` | `{ attributionAgentId, clone: 'casual' \| 'ranked', gameMode }`; `gameMode` is the battle's field, or `null` when the battle document has none (never normalised) |
| `activatedAt`, `activatedAtSource` | ISO string; source is one of `trade_row` (every swap-in: the row's `swappedOutAt`), `position_swappedInAt` (a corrected starting position still held), `outgoing_receipt` (a corrected starting position already sold: the closing row's `outgoingReceipt.enteredAt`), `battle_activatedAt` (a legacy starting position) |
| `asOf` | `lastCompletedSessionAt(activatedAtMs).session` (ruling Q-ID1-3); always a session, because an activation whose session the calendar cannot name gets no pointer (§4.2) |
| `firstTradingDay` | `timing.tradingDays[0]`, or `null` when absent |
| `ruleSet` | the triple from `describeRuleSet()` as deployed when the pointer is written; when `entry` is non-null it equals the snapshot's `key.ruleSet` |
| `snapshotRef` | the snapshot's document id (a string) when `entry` is non-null; otherwise `null` |
| `entry`, `missing` | `entry` is a deep, frozen copy of the snapshot's entry record (a refused snapshot's refusal record included) and `missing` is `null`; or `entry` is `null` and `missing` is `{ reason: 'snapshot_unavailable', detail }`, where `detail` is the store's retryable reason in the writing run (a string) |
| `evidenceTiming` | `{ snapshotCapturedAt, predatesActivation }`; `predatesActivation` is `capturedAt < activatedAt`, strictly (equal instants are `false`); both `null` when `entry` is `null`. Even `true` does not show the brain consulted it |
| `anchorSwingLow` | `{ value, provenance: 'own_entry' \| 'absent' }`: the entry record's own swing low when it is a price, frozen; otherwise `{ value: null, provenance: 'absent' }` |
| `activatingTick` (ruling Q-ID1-8) | swap-ins: `{ tickSeq, evalId, evaluationId, source: 'tick_action' \| 'unavailable' }`. `tick_action` only when exactly one committed swap action in the battle's permanent tick records matches the row on (`swappedOutAt`, `symbolOut`, `symbolIn`), the tape's own swap key; this holds for model executions and proposal executions alike. No match after the tick grace (§4.2), or more than one match: `unavailable`, with the other three fields `null`. **The row's `eval_NNN` is never used** (V1.6: no committed field distinguishes the model path; the review verified this). Starting positions: `null` |
| `tradeRef` | swap-ins: `{ evaluationId, verificationId, incomingPositionId }`, each `null` when the row lacks it (verification exists on the legacy route only). Starting positions: `null` |
| `hypothesisRef`, `inIdeaUniverse` | `hypothesisRef` is `{ watchlistId, hypothesisVersion, contentHash }` from `agentContext.equippedHypothesis`; `inIdeaUniverse` is whether the symbol is in the frozen `agentContext.equippedWatchlist.tickers` (P1c's `frozenNamesOf`). **Both `null` when the battle carries no `equippedHypothesis`, even if a watchlist exists** |
| `observedAt` | ISO string, the write; information only |

### 4.1 Discovery: each slot's lifetimes, in order

The frozen creation roster (`agentContext.initialPortfolio`) is copied **before** the corrected route stamps `positionId` and `swappedInAt` on live positions, so it carries no position ids, and a join on tier, slot and symbol cannot tell a starting stock from the same stock returning later (A → B → A). Discovery therefore rebuilds each owner slot's ordered lifetimes before naming any activation:

1. **Lifetime 0** is the roster's symbol at (tier, slot).
2. Each `trades[]` row in that slot, in `swappedOutAt` order, closes the current lifetime (its `symbolOut` must be the current symbol) and opens the next (`symbolIn`).
3. The last lifetime must be the live position (same symbol; on the corrected route the same position id).

| Lifetime | Identity | Instant (`activatedAtSource`) |
|---|---|---|
| Legacy starting position | fallback id | `battle.activatedAt` (`battle_activatedAt`) |
| Corrected starting position, still held, no row in its slot | the live `positionId` | the live `swappedInAt` (`position_swappedInAt`) |
| Corrected starting position, already sold | the closing row's `outgoingPositionId` | the closing row's `outgoingReceipt.enteredAt` (`outgoing_receipt`) |
| Legacy swap-in | fallback id | the row's `swappedOutAt` (`trade_row`) |
| Corrected swap-in | the row's `incomingPositionId` | the row's `swappedOutAt`, corroborated by `incomingReceipt` (`trade_row`) |

**Consistency.** Where two sources name the same thing, they must agree: without a gap, lifetime 0's symbol and the slot's first row's `symbolOut`; a row's `symbolIn` and the next row's `symbolOut`; a row's `incomingPositionId`, the next row's `outgoingPositionId` and, for the last lifetime, the live `positionId`; for the last lifetime, the row's `swappedOutAt` and the live `swappedInAt` (both routes stamp them from one value). Any disagreement makes that slot **unresolved** (`inconsistent`): counted, and no pointer for its unwritten lifetimes.

**Class.** A row's `isCrypto` describes its **outgoing** asset. A lifetime's class comes from its own evidence: the live position when it is the current lifetime, else the row that closed it. A lifetime whose class cannot be established is unresolved (`class_unknown`). Crypto lifetimes are skipped and counted.

**The gap.** Both routes keep the newest 50 rows and count every trade, so `scoreState.tradeCount > trades.length` means older rows were evicted, from any slot. Swap-ins on retained rows remain identifiable (each row names its own incoming lifetime). Starting-position lifetimes do not: any not yet written are unresolved (`gap`), counted, and never given a guessed id. **With a gap, each slot's checks start at its earliest retained row:** no root check against the roster is made, and a retained swap-in is never rejected because the evicted prefix cannot be connected to the creation roster. (The observer runs every 15 minutes, so a starting position is normally written long before 50 trades exist.)

**Stability.** A lifetime's id never changes between runs: a corrected starting position's live `positionId` while held and its closing row's `outgoingPositionId` after the sale are the same value, and a fallback id's instant is the same stamp either way.

**Other unresolved reasons**, each counted and never written: an activation instant that is not a valid date (`instant_malformed`); a symbol the store's key validation rejects, such as a dotted or suffixed form (`symbol_form`; never repaired); a battle whose last trading day cannot be read (`finalization_undetermined`: snapshots are still acquired and pointers with evidence written, but no null pointer is ever written for it).

### 4.2 Writing a pointer

- **Create-once.** Every pointer is created by `tx.create` inside a transaction that first reads the pointer's document; an existing pointer is never updated, and the loser of a race moves on.
- **With evidence.** When the store returns, or a read finds, a final snapshot for the activation's key, the pointer is written from it. Activations that share a key (the same session and symbol, across battles) are served by one store call per run.
- **The tick grace.** A swap-in with no matching tick action is deferred, not written, until 30 minutes after its `swappedOutAt` (trades and ticks are committed separately). After that, `activatingTick.source` is `unavailable`. At finalisation the grace no longer applies.
- **Without evidence (`entry: null`).** Written only when all three hold:
  1. the battle is **finalisation-due** in this run (§4.3);
  2. this run's own store call for the key returned `retryable`. A `pending` result, a thrown error of any kind (Firestore `ABORTED` included), a deferral, or a key this run did not reach is **never** evidence of absence;
  3. inside the pointer's creation transaction, a read of the key's final snapshot document (`setupEvidence/{snapshotIdOf(...)}`, the current rule set) finds none. If it finds one, that snapshot supplies the entry instead.
- **Calendar missing (V1.7).** An activation whose session the calendar cannot name (an unmaintained year) gets **no pointer**: it stays outstanding like any deferred work (the calendar may be extended), and past the horizon it is abandoned and counted, with that reason. So a null pointer always means one thing.
- **One cap.** Pointer transactions with and without evidence count against the same per-run cap.
- **What a null pointer promises:** no final snapshot existed at that transaction's serialisation point. It does not promise none will ever exist; a snapshot finalised later (for example by an overlapping duplicate run) leaves the null pointer as it is.
- **Starvation is deferral.** Work the observer did not reach in a run stays outstanding; it never becomes a null pointer.

### 4.3 Timing: the host, the schedule and finalisation

- **Host (ruling Q-ID1-2):** the sixth tenant of `process-pending-reflections`. The five existing tenants keep their **50-second** budget (`TIME_BUDGET_MS` is unchanged). The observer has its own slice, `min(tenantStart + 20 s, handlerStart + 80 s)` (V1.7; was 8 s and 58 s, too short to leave time for any acquisition after preparation). It is an **admission deadline**: no store call or pointer transaction starts unless its reserve fits before it, and every started call is awaited, so a run can end a few seconds after it. The platform's 120-second `maxDuration` is the hard stop; if it ends an invocation, no partial pointer can exist (each is one transaction) and a store lease left behind expires on its own. A run that starts with too little time left defers entirely.
- **Progress in every run (V1.7).** Preparation (state, candidates, battles, pointers, ticks, final reads) has its own bounded share of the slice, so time always remains to start acquisitions. Keys a run leaves outstanding are carried in the observer state, and the next run offers them for acquisition even if its own preparation is cut short.
- **Schedule (founder ruling, 4 Nov):** the host's cron gains the 01:00 UTC hour: `*/15 13,14,15,16,17,18,19,20,21,22,23,0,1 * * *`, adding runs at 01:00, 01:15, 01:30 and 01:45 UTC. Ordinary battles expire at 20:00 ET (00:00 UTC in summer, 01:00 UTC in winter); settlement runs at 02:00 UTC and the tape's close pass at 02:15 UTC. Without the extra hour, the last run (00:45 UTC) fell before winter expiry.
- **Fair order (V1.7).** Due work, never-seen battles and ordinary work are taken in turn, due and ordinary each from its own cursor, and every cursor advances past each item it takes, whatever the outcome (the hypothesis review pass's precedent), so neither a persistently failing due item nor a busy ordinary queue starves the other.
- **Finalisation-due** is a property checked on every run, never an exact minute: a battle is due when (a) it is terminal or its `expiresAt` has passed, and (b) the run is at or after its **finalisation cutoff**: 01:30 UTC on the UTC calendar day after its **last trading day** (`timing.tradingDays` at its end; never `firstTradingDay`, never a snapshot's `asOf`). That is 21:30 ET in summer and 20:30 ET in winter, after ordinary expiry and before the tape. Both instants are fixed once a battle exists, so a battle read once can be scheduled from its stored `cutoffAt` and `expiresAt` without being read again. The 01:00 and 01:15 runs keep acquiring for ended battles; the 01:30 and 01:45 runs may also write null pointers, and finalisation-due work goes first in them.
- **A late, failed or duplicated run.** Vercel does not retry a failed cron and can deliver one twice. If both the 01:30 and the 01:45 runs fail, finalisation happens in the next run (13:00 UTC), after the tape has read the day; nothing repairs a tape already written. Two overlapping runs still create one pointer per activation (§4.2).
- **Catch-up horizon.** A battle stays a candidate until **3 calendar days** after its cutoff (a weekend included; the cron runs every day). After that its outstanding activations are abandoned: counted by the census, never written.
- **Acquisition never stops early.** Ended battles keep acquiring until their cutoff and through catch-up; only the null rule waits for the cutoff.

### 4.4 Observer state (V1.6, authorised)

`activationObserverState/{name}`, server-only (`allow read, write: if false`), one document `main` in V1, mutable, and never read by any reader of evidence: `{ schemaVersion: 1, cursors: { dueBattles, ordinaryBattles, dueKeys, ordinaryKeys }, battles: { [battleId]: { cutoffAt, expiresAt, finished, excludedBy } }, outstandingKeys: [ { snapshotId, session, symbol, dueAt } ], updatedAt }`, with `outstandingKeys` bounded. It exists for fair progress across runs (the reason the hypothesis review pass persists its cursors), so finished or excluded battles are not re-read, and so acquisition can continue when a run's preparation is cut short. Entries older than the candidate window are pruned. **A lost, stale or repeatedly unwritable state document never changes what a pointer says** (pointers depend only on §4.2); it costs fairness and reads, and can delay coverage, so that work near the horizon may be abandoned.

### 4.5 A canonical pointer

A corrected-route swap-in with evidence, an idea carried, and a matching tick:

```json
{
  "schemaVersion": 1,
  "activationId": "pos_7Hq2LmN4",
  "kind": "swap_in",
  "battleId": "<battleId>",
  "symbol": "BRK-B",
  "tier": "core",
  "slot": 1,
  "battleAgentId": "<agentId>",
  "attributionAgentId": "<agentId>",
  "attributionStatus": "resolved",
  "archetype": "momentum_chaser",
  "stream": { "attributionAgentId": "<agentId>", "clone": "ranked", "gameMode": "baggerbomb_agent" },
  "activatedAt": "2026-11-05T15:02:11.412Z",
  "activatedAtSource": "trade_row",
  "asOf": "2026-11-04",
  "firstTradingDay": "2026-11-05",
  "ruleSet": { "setupVersion": "tf-setup-v1", "thresholdsHash": "26f3f411b566", "semanticsId": "tf-setup-v1/sem-1" },
  "snapshotRef": "2026-11-04__BRK-B__tf-setup-v1.26f3f411b566.tf-setup-v1~sem-1",
  "entry": { "...": "a deep copy of the snapshot's entry record" },
  "missing": null,
  "evidenceTiming": { "snapshotCapturedAt": "2026-11-05T15:17:03.221Z", "predatesActivation": false },
  "anchorSwingLow": { "value": 478.12, "provenance": "own_entry" },
  "activatingTick": { "tickSeq": 12, "evalId": "eval_012", "evaluationId": "<evaluationId>", "source": "tick_action" },
  "tradeRef": { "evaluationId": "<evaluationId>", "verificationId": null, "incomingPositionId": "pos_7Hq2LmN4" },
  "hypothesisRef": { "watchlistId": "<watchlistId>", "hypothesisVersion": 3, "contentHash": "<hash>" },
  "inIdeaUniverse": true,
  "observedAt": "2026-11-05T15:17:04.010Z"
}
```

The same fields in the other cases:
- **A legacy starting position:** `"activationId": "star:0:2026-11-05T14:30:02.118Z"`, `"kind": "creation"`, `"activatedAtSource": "battle_activatedAt"`, `"activatingTick": null`, `"tradeRef": null`.
- **No final snapshot at finalisation:** `"snapshotRef": null`, `"entry": null`, `"missing": { "reason": "snapshot_unavailable", "detail": "missing_bar" }`, `"evidenceTiming": { "snapshotCapturedAt": null, "predatesActivation": null }`, `"anchorSwingLow": { "value": null, "provenance": "absent" }`. `asOf` keeps its session.
- **No carried idea:** `"hypothesisRef": null`, `"inIdeaUniverse": null`, even when `equippedWatchlist` exists.
- **A casual clone whose parent could not be resolved:** `"attributionStatus": "unresolved"`, `attributionAgentId` and `stream.attributionAgentId` the clone's own id, `"clone": "casual"`.
- **A legacy battle with no `gameMode` field:** `"gameMode": null`.
- **A tick that could not be joined:** `"activatingTick": { "tickSeq": null, "evalId": null, "evaluationId": null, "source": "unavailable" }`.

`entry` is shown as a placeholder; it is the snapshot's entry record verbatim. The `pos_` id shape is illustrative; the id is whatever the route stamped.

## 5. Continuation (founder ruling 28 Oct)

V1 records carry no cross-battle inheritance; each activation keeps its own anchor. A reader policy, decided before the "Chase or hold" build, may chain a starting position to the same `stream`'s previous battle (previous trading session, same rule-set triple, unique predecessor that held the symbol at its end, no intervening exit, attribution resolved); anything ambiguous means no chain.

## 6. Readers

Holding checks evaluate `evaluateTfHolding(snapshot(the check's completed session).evidence, { anchorSwingLow })`, never the activation day's entry verdict. Practice Field drills and slice 2 acquire through the same store; slice 2 is label-only. No client reads in V1.

**The Film Room (a future reader contract, REPORTED):** the tape does not read pointers today. When it does, it joins battle + symbol ordered by tick, and a pointer missing at its 02:15 UTC pass reads `unknown`. A pointer written later by catch-up does not repair a tape already written.

## 7. Clarification C4 (committed by Build 1)

"For holding checks, the anchor swing low is frozen per actual holding activation (ID-1), independently of any hypothesis or idea version, and is never re-derived or replaced during that activation."

## 8. The store as built (PR #1018), and how Build 2 calls it

- **The call.** Normalise the activation instant to epoch milliseconds and validate it; call `lastCompletedSessionAt(activatedAtMs)`; branch on `ok` before reading `session`; then `getOrAcquireSnapshot({ db, session, symbol, now: () => new Date(), host })`. `fetchPayload` is omitted in production (the store defaults to the shared `fetchDailyPayload`) and injected in tests. The store uses the deployed `describeRuleSet()` itself.
- **Results.** `final` (with the snapshot), `pending` (a live lease; no fetch), `retryable` (with a reason), `excluded` (`unsupported_symbol_class`; crypto by symbol). It throws on a programming error and on a Firestore failure; the caller isolates each key.
- **Clock.** `now` is a function returning a `Date`, never a `Date` value.
- **Symbols.** The hyphen form positions hold (`BRK-B`), at most 12 characters; a dotted or suffixed symbol is refused with a `TypeError`, never repaired. Filter crypto on the lifetime's own class before calling.
- **No caller deadline.** The store takes no deadline. Its provider request alone can take 5 seconds (`ACQUIRE_TIMEOUT_MS`), plus Firestore claim and finalisation work. A caller bounds it by not **starting** a call without enough time left (an admission reserve), never by racing a timeout that would leave writes running unawaited.
- **The claim document stays** after a snapshot is final, with `lease: null`, so its attempt count survives. A first-touch burst of 75 or more callers on one key can surface `ABORTED`; the observer never bursts (one call per key per run), and treats any throw as deferral.
- **`writer.commit`** is `VERCEL_GIT_COMMIT_SHA`, null where Vercel does not expose system variables; Build 2's census reports one written snapshot's value.
- **The newest-session cutoff** is read from claim attempts (`attempts`, `lastAttemptAt`), final snapshots' `fetchedAt`, and the store's fetch-failure log lines over the first week (Build 2's census and report define how).

## 9. Map items carried to the next map version

Plays and drills keyed to the attribution agent; Character-area control plays not reaching casual battles (Command Center decision, before the install build); ID-4's per-agent rule version reaching casual battles; the Film Room's tape fixes, including reading activation pointers (§6); tournament battles sitting outside every growth reader, a product question for after beta. **New:** the host cron's extra hour also gives its five existing tenants runs after winter expiry, which closes the hypothesis review pass's winter gap noted in P1c; Build 2 reports what each tenant does in those runs.

## 10. What changed from V1.5

| Review finding (4 Nov) | Where |
|---|---|
| P1-1: the 00:45 UTC sweep ran before winter expiry; status checks miss battles awaiting settlement | §4.3 eligibility predicate, last trading day, the extra cron hour |
| P1-2: a null pointer could be written while a usable snapshot existed or was arriving | §4.2 null conditions, the in-transaction snapshot read, the serialisation-point promise; §4.3 acquisition continues for ended battles |
| P1-3: the roster join confuses A → B → A; gaps cannot be reconstructed | §4.1 lifetimes, identity table, consistency, class, gap, stability |
| P1-4: raising the shared budget changed existing tenants | §4.3 the 50-second budget unchanged; the observer's own 58-second ceiling |
| P2-5: scheduling, catch-up and fair progress | §4.3 every-run eligibility, failed and duplicate runs, horizon; §4.4 state collection |
| P2-6: the exact store call and its deadline | §3 milliseconds; §8 the call, results, admission reserve |
| P2-7: pointer version and representations | §4 table (`schemaVersion`, `missing`, nulls, enums, `gameMode`, strict comparison, rule set); §4.5 canonical example; idea fields from `equippedHypothesis` |
| P2-8: census definitions and privacy | §8 cutoff sources; Build 2's prompt defines the census |
| P2-9: the emulator suite in CI | a separate prerequisite PR (not part of this contract) |
| Sound with notes: `eval_NNN`, tick join, owner portfolio, gate, reader boundary | §4 `activatingTick`; §4.2 tick grace; §2 positions and gate; §6 Film Room as a future contract |

## 11. What changed from V1.6

| Recheck finding (4 Nov, `main` `f3da14a3`) | Where |
|---|---|
| New P2: a `calendar_missing` activation cannot form the snapshot key the finalisation read needs | §4.2: no pointer when the calendar cannot name a session (deferred, then abandoned and counted); `missing.reason` has one value; `asOf` always a session |
| P2-5: candidate discovery and fairness not bounded; unseen battles unschedulable; due-first ordering can starve | §4.3 fair order and stored `cutoffAt`/`expiresAt`; §4.4 state with four cursors; Build 2 V3 bounds candidate pages and tick reads |
| P2-6: the 8 s slice and 7 s reserve could prevent every acquisition; 58 s was not a completion bound | §4.3: a 20 s slice, an 80 s admission deadline (named as such), bounded preparation, carried keys; §4.2 one cap for both kinds of write |
| P2-8: census cohort and retention boundary | Build 2 V3 §6 (cohort by last trading day, per-measure inclusion and denominators, reconstructable versus unreconstructable history, category precedence) |
| New P2: owner-scoped candidates do not cover the resolver's parent read | §2: the ownership-check exception, stated |
| New P3: module purity contradicted the file table | Build 2 V3 §2 lists the I/O modules; the census imports pure modules only |
| Notes: §1's wording; the gap rule overriding the root check | §1 aligned with §4.2's promise; §4.1 checks start at the earliest retained row under a gap |
