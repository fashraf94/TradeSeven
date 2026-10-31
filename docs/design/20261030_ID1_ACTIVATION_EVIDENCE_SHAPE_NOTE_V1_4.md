# ID-1 Activation Evidence — Shape Note V1.4

**Date:** 30 October 2026 · **Author:** Fable (framework chat) · **Status:** the contract for Build 1 (the shared snapshot store) and Build 2 (the ID-1 observer). V1.3 folded in the read-only Phase 0 of 30 Oct (`docs/audits/20261030_PHASE0_ID1_SHARED_EVIDENCE.md`, at `main` `0de404e1`) and the founder's rulings on its eight questions. **V1.4 folds in the independent review of 30 Oct (ChatGPT, checked at `0de404e1`): bar order, lease ownership and the confirmation record, the shared fetch's compatibility, response-time stamps, lossless keys, attempt counting, and the `eval_NNN` fallback (§3, §4).** Supersedes V1–V1.3. · **Destination:** `docs/design/20261030_ID1_ACTIVATION_EVIDENCE_SHAPE_NOTE_V1_4.md`, committed by Build 1's docs commit; project copy `claude/ID1_ACTIVATION_EVIDENCE_SHAPE_NOTE_V1_4_OCT30_2026.md`.

---

## 1. In plain terms

Two records. A shared **snapshot** keeps, once per completed session, per stock, per rule set, what the Trend Follower's setup rule said about that stock and the price evidence it said it from. An **activation pointer** is written each time a stock enters a Trend Follower's portfolio, freezing the snapshot it entered under and the swing low its thesis breaks below. Nothing about trading changes. Build 1 makes the snapshot store; Build 2 makes the observer that writes pointers.

## 2. Scope (ruling Q-ID1-1)

- **Recorded:** tiered BaggerBomb battles (`gameMode` absent or `baggerbomb_agent`), the owner's agent side, whose battle carries `agentContext.archetype = 'momentum_chaser'` (the Trend Follower). Casual clones are included.
- **Excluded and counted:** tournament (flat6) battles, CPU sides (`isCpu`), training clones (`training-agent-`), and crypto positions (the evaluator refuses them by class).
- **Battle length:** any (FD-1).
- **Gate (Build 2):** `ACTIVATION_EVIDENCE_ENABLED` (dark) plus the cockpit allowlist. A week of census is a review point for widening, not automatic approval.

## 3. The snapshot store (Build 1)

**Collection** `setupEvidence`, server-only. **Document id** `${session}__${symbol}__${ruleKey}`, where `ruleKey` encodes the **whole** rule-set triple losslessly: `${setupVersion}.${thresholdsHash}.${semanticsId with "/" replaced by "~"}` (today `tf-setup-v1.26f3f411b566.tf-setup-v1~sem-1`). Key generation validates the triple (each member present and of its known shape, no reserved characters) and rejects a malformed one; parsing an id returns the exact triple; two different triples can never share an id. The full triple is also stored verbatim in the document.

**Session.** Every request names a completed session from the **activation-to-session wrapper** `lastCompletedSessionAt(instantMs)`: a weekend or holiday, or an instant before the close, maps to the previous session; at or after the close, to that day; early closes and DST come from the calendar's own tables; outside the maintained years (2026–2027) it returns `calendar_missing`. It uses the calendar's session lookup (`getSessionForDate(...).previousEtDate`), never `getPreviousTradingDay`. Under this wrapper the adapter's `asOf` always equals the requested session on an ok result, and the store asserts it.

**Content.** `key { session, symbol, ruleSet }`; `status: ok | refused`; the adapter's **evidence** exactly as returned (bars included, about 9 KB); the **entry record** `evaluateTfEntry(evidence)`; `asOf`, `requestedAsOf`, `refusal` exactly as the evaluator emits them; `source: 'eodhd_eod'`; `sourceMeta` built from the scalar allowlist `{ fetchedAt, from, to }` only; `evidenceClass.bars`; `capturedAt`; `writer { host, commit }`. About 12 KB.

**Acquisition (ruling Q-ID1-6).** Its own EODHD `/eod/` date-range read, reaching 130 calendar days back so a short history is a property of the symbol, not of the request. On the ordinary successful path that is one call per (session, symbol); retries, confirmation reads and lease takeovers add attempts, and attempts are counted separately from completed snapshots.
- **Order.** The store requests **newest first** (`order=d`, as slice 1's replay did): `mapDailyRows` preserves the payload's order and the adapter expects the newest session first. Nothing re-sorts a payload; malformed or duplicate dates stay visible to the adapter's own checks.
- Raw rows through `mapDailyRows`; adjusted close attached from the raw payload (`attachAdjustedClose`), so the split check runs.
- **One shared raw request.** The idea review card's existing `/eod/` request moves into one shared helper with an explicit `order` option and an optional timeout. It returns the parsed payload and classifies nothing. The review card keeps `order=a`, no timeout, and its own handling (a non-array payload is `no_data`); the store requests `order=d` with a bounded timeout and treats a non-array payload as a retryable acquisition failure. Network errors keep today's messages, and the API key never appears in one.
- Crypto is refused before any call and writes nothing.

**Stamps.** `fetchedAt` and `capturedAt` are the instant the provider's response was received, never a time taken before the request.

**Bars class.** `contemporaneous` when the response was received while `session` was still the latest completed session (before the close of the next session); otherwise `later_reconstruction`. A request started before that close and answered after it is `later_reconstruction`. (This corrects Phase 0's "before the next session's open", which would have labelled an intraday swap's same-day fetch as a later reconstruction.)

**Final or retryable (rulings Q-ID1-4, Q-ID1-5).**

| Outcome | Class |
|---|---|
| ok evidence | final |
| `basis_discontinuity`; `missing_fact`; `insufficient_history` (the 130-day request always reaches 55 sessions) | final |
| an interior `missing_bar` (a gap inside the window); `unordered_bars` with `why: 'non_session_date'` | **final only when a second fetch at least 30 minutes later reproduces the same reason and detail**; the first occurrence is retryable |
| a newest-session `missing_bar` (the bar is not yet published) | retryable, never finalised by the store; Build 2's battle-end sweep records `missing` on the pointer instead, and the first week's logs (fetch time minus the close) set a cutoff |
| `calendar_missing` (unmaintained year); `asOf_in_future`; a malformed or out-of-order payload; fetch timeout, non-200, budget | retryable: nothing final is written |
| `calendar_missing` with `why: 'malformed_date'`; `asOf_not_a_session`; an ok result whose `asOf` differs from the request | programming error: throw, write nothing |

**Create-once, the lease and the confirmation record.** The final document is written by `create` inside a transaction, never updated; losing a race reads the winner's document. Correctness of the final document never depends on the lease. The mutable state lives in a sibling collection, `setupEvidenceClaims/{id}`, and has its own rules:
- **The lease** ("I am fetching this", 120 seconds) carries a unique **ownership token**. Every claim mutation is a transaction that checks the token; a worker whose lease expired and was taken over can neither release nor overwrite its successor's lease or observation. (It may still create the final document if no one has; the `create` decides.)
- **The observation** for the confirmation rule is `{ reason, detailHash, observedAt }`. Releasing a lease preserves it. A matching result before 30 minutes keeps the original `observedAt`; a different reason or detail replaces it; a matching result from a separate fetch at least 30 minutes after `observedAt` makes the outcome final. No request ever waits 30 minutes: a later caller performs the confirming fetch.
- **Attempts** are counted on the claim (`attempts`, `lastAttemptAt`).
- A caller that finds a live lease gets `pending` and does not fetch.

## 4. The activation pointer (Build 2)

`agentBattles/{battleId}/activations/{activationId}`, server-only in V1 (ruling Q-ID1-7), written once, never repaired by replacement.

| Field | Meaning |
|---|---|
| `activationId` | The position's `positionId` on the corrected stock route; otherwise `${tier}:${slot}:${entryInstant}` (legacy starting positions and legacy swap-ins carry no `positionId`) |
| `kind`, `battleId`, `symbol`, `tier`, `slot` | `creation` or `swap_in`; where and what |
| `battleAgentId`, `attributionAgentId`, `attributionStatus`, `archetype` | `attributionStatus` is `unresolved` when the battle's agent is a casual clone and the resolver returned the clone's own id; unresolved records stay out of growth joins |
| `stream` | `{ attributionAgentId, clone: 'casual' \| 'ranked', gameMode }` — the agent-id prefix is the only ranked/casual marker |
| `activatedAt`, `activatedAtSource` | `position.swappedInAt` where the route stamps it (corrected stock positions, every swap-in); else `battle.activatedAt` (legacy starting positions, corrected crypto) |
| `asOf` | `lastCompletedSessionAt(activatedAt)` (ruling Q-ID1-3: the evidence available when the stock was chosen) |
| `firstTradingDay` | `timing.tradingDays[0]`, so a late-day or after-close creation's one-session gap is visible |
| `ruleSet`, `snapshotRef`, `entry` | the full triple; the snapshot read; a frozen copy of its entry record, or null with `missing` naming why |
| `evidenceTiming` | `{ snapshotCapturedAt, predatesActivation }`; even `true` does not show the brain consulted it |
| `anchorSwingLow` | `{ value, provenance: 'own_entry' \| 'absent' }`, this activation's own `swingLow`, frozen |
| `activatingTick` (ruling Q-ID1-8) | swap-ins: `{ tickSeq, evalId, evaluationId, source: 'tick_action' \| 'row_eval_id' \| 'unavailable' }` — the permanent tick record's `actions[]` joined on (`swappedOutAt`, `symbolOut`, `symbolIn`) first. The row's `eval_NNN` is a fallback **only when the row's committed metadata identifies the model path**, the one route whose id names the executing check; approved and expired proposals carry the proposing check's id, so for them, and whenever the route is not proven, the source is `unavailable`. Matching the `eval_NNN` format alone is never enough. Starting positions: null |
| `tradeRef` | swap-ins: `{ evaluationId, verificationId \| null, incomingPositionId \| null }` (verification exists on the legacy route only) |
| `hypothesisRef`, `inIdeaUniverse` | the carried idea and whether the symbol is in its frozen list; null without an idea |
| `observedAt` | information only |

**Discovery** reads the frozen creation roster (`agentContext.initialPortfolio`, joined to the live slot by tier, slot and symbol), the slot chain in `trades[]` (a starting position swapped out early is recovered there), and the live portfolio. **Gap test:** `scoreState.tradeCount > trades.length` means rows were evicted; the census reports it. **Host (ruling Q-ID1-2):** the sixth tenant of `process-pending-reflections`, its pinned budget raised from 50 s to 58 s, with a battle-end sweep; its last tick (00:45 UTC) is 90 minutes before the tape's close pass at **02:15 UTC** (22:15 ET in summer, 21:15 ET in winter).

## 5. Continuation (founder ruling 28 Oct)

V1 records carry no cross-battle inheritance; each activation keeps its own anchor. A reader policy, decided before the "Chase or hold" build, may chain a starting position to the same `stream`'s previous battle (previous trading session, same rule-set triple, unique predecessor that held the symbol at its end, no intervening exit, attribution resolved); anything ambiguous means no chain.

## 6. Readers

Holding checks evaluate `evaluateTfHolding(snapshot(the check's completed session).evidence, { anchorSwingLow })`, never the activation day's entry verdict. The Film Room joins battle + symbol ordered by tick; a pointer missing at the 02:15 UTC pass reads `unknown`. Practice Field drills and slice 2 acquire through the same store; slice 2 is label-only. No client reads in V1.

## 7. Clarification C4 (rides Build 1's docs commit)

"For holding checks, the anchor swing low is frozen per actual holding activation (ID-1), independently of any hypothesis or idea version, and is never re-derived or replaced during that activation."

## 8. Map items carried to V1.3

Plays and drills keyed to the attribution agent; Character-area control plays not reaching casual battles (Command Center decision, before the install build); ID-4's per-agent rule version reaching casual battles; the Film Room's tape fixes; tournament battles (176 of 218 battle documents since 1 Sep, many CPU sides) sit outside every growth reader today, a product question for after beta.
