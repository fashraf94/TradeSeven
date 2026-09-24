# Call Record — Field Contract V1.3

**Date:** 2026-09-23 · **Author:** Fable (Command Center arc) · **Supersedes:** V1.2 · **Status:** **FINAL — blessed with changes (Astra round 4 via the framework chat, Sep 23).** The pilot's blessed header pins this file's SHA-256 as computed from the committed bytes at the docs commit; no hand-copied hash. **Consumers:** cockpit spec V1.1 (to be written against this cut) and the pilot spec.

**Changelog from V1.2 (round-4 folds).** G1 the complete origin rule (§4). G2 `priceAsOf: string | null`, ISO-8601 source format (§4). G3 contribution-relative capture clause with the four-row composition table (§9). G4 the §2.1 non-null rule and phase stamp, reconciled with the after-commit writer (§2.1).

**Changelog from V1.1.** F1 `hypothesisRef` literals (§4). F2 tick identity split from availability, literal wire shape (§4 `evidence`). F3 mint only from a durably committed evaluation identity: the writer runs after the evaluation commit, create-once (§3). F4 contribution-relative dark-merge with composition rows (§9). From Astra's spec review: `hit` requires an encounter observation (§6); the `until_ms` slot shape, the `refused` receipt, `heardEvalId` (§7); the chat line derived from the record and a bounded calls block (§8). **Blessed additions:** the per-check declarations record (§2.1, with the write-only-when-non-null rule and the `none | expected` stamp + `cronState.declarationsPhase`); `origin: 'provenance_unresolved'` (§4).

---

## 1. Home, rules, writers, retention

- `agentBattles/{battleId}/calls/{callId}` — one family, `kind ∈ {called_shot, confirmation, pick}`. No other kind is ever written here.
- `firestore.rules`: `match /calls/{callId}` mirrors `intradayViews` — owner read via inline parent `get()`, `allow write: if false`. Every player action is an API route.
- Writers (server only): the evaluation cron (mint, after the evaluation commit; state flips on encounter), completion's transaction (`ended_with_battle`), the sweep worker (expiry backstop), the answer endpoint (§7). The capture writer never writes here; the tick's permanent record carries `calls[]` references.
- Retention: the battle-record lifecycle. Independent of `TICK_CAPTURE_ENABLED` by construction.

## 2. Source — born structured or not at all

The model's evaluation output gains one typed `declarations` property beside `anticipationCandidates`, typed `['object','null']`, never in top-level `required`, **present in the tool schema only when `CALL_RECORDS_MODE !== 'off'`**.

```
declarations: {
  calledShots: [{ symbol, direction: 'entry'|'exit', slot, counterpart, condition: { side: 'above'|'below', level }, horizonPhrase, expiresAtMs?, defaultAction: 'act'|'hold', said }],
  watching:    [symbol],
  playerAsk:   { question, options: [string], symbol? } | null,
  fork:        { slot, swapOut, options: [{ symbol, why }], said } | null
}
```

**Authority:** typed fields govern; `said` is presentation; a `said` claiming beyond its typed fields is a loggable divergence, never a second source of truth. **Validation is the call writer's** (the trade-result validator sees only the declarations-off schema and is unchanged): absent or wrong-typed fields → **malformed, not born** (the row, not its siblings; never the accepted trade); a present non-finite `condition.level`, a symbol absent from the check's encounter observation (§6), or a level implausible against the checked quote (|level − px| / px > 0.25) → **minted `invalidated`**, typed and recorded. An `explicit` horizon failing §5 → malformed.

**Review dispositions (two):** the record side is fence-free by path; extending the model's output schema (and any prompt section teaching it) is fenced-class review regardless of path — coordinated review plus the `PROMPT_CONTRIBUTING_MODULES` entry for any prompt-contributing module.

### 2.1 The per-check declarations record (blessed)

`agentBattles/{battleId}/declarations/{evalId}` — the typed block exactly as declared (after malformed-row removal, with each removed row's reason listed), create-once, server-only writes, owner-readable, retention = battle lifecycle. Calls are minted **from** this record in the same create-once batch. It is the durable, typed source for the Monitoring tile (`watching`) and the Research-objective tile (`playerAsk`) — which are read-only tiles and never file — so all six tile kinds are born structured while `calls/` keeps exactly three kinds. The Film Room replays declared versus minted from it.

**Write only when there is something to write; stamp the check so absence is never ambiguous.** The record is written only when the block is non-null after malformed-row removal; empty checks cost no writes. The evaluation entry carries `declarationsPhase: 'none' | 'expected'` at the evaluation commit (present only when `CALL_RECORDS_MODE !== 'off'`). Because the writer runs after that commit (§3), `written` versus `failed` is proven by the create-once document's existence: `expected` + document → written; `expected` + no document → failed (or unconfirmed, per the phase's per-id result). The phase writer's last step also sets `cronState.declarationsPhase = { evalId, phase: 'written' | 'failed' }` so the latest check reads in one word without a subcollection lookup. **Reconciliation with the round-4 wording (`none | written | failed` on the evaluation):** because the writer runs after the evaluation commit (F3), the entry can only carry `none` or `expected` at commit; the three-word result is what every reader derives — `none` from the stamp, `written` from the create-once document's existence, `failed` from `expected` plus absence (and from `cronState.declarationsPhase` for the latest check). No reader ever treats a missing document as ambiguous.

## 3. Identity, publication, joins

- `callId = ${battleId}:${evalId}:call:${n}`, `n` zero-based in declaration order (malformed rows do not consume an ordinal). Independent of the tick.
- **Mint only from a durably committed evaluation identity (F3).** `evalSeq`/`evalId` commit in the final battle update (`agent-evaluate.js:4058` at the discovery SHA). The writer runs **after that commit and before capture finalization**, create-once: a same-payload retry is legal (idempotent success); a conflicting duplicate is a typed failure `call_conflict`, never an overwrite. A tick that fails before the evaluation commit mints nothing — no orphan state exists. **Build 0 acceptance carries the failed-before-evaluation-commit case.**
- The whole calls phase (declarations record + calls + capture references) runs under one aggregate deadline reserved from the tick budget, fully isolated: its failure never changes the trade, the entry or the completion reserve; per-id results are `confirmed | rejected | unconfirmed`; typed failure counters.
- One anchor for chat and tile: `callId`. At `on`, the chat line for a call is **derived from the record** (`said`, `data-call-id`); the answer receipt exchange carries `callId`. No exchange id exists or is needed.

## 4. Fields

| Field | Type | Authority / note |
|---|---|---|
| `callId`, `kind`, `battleId`, `evalId`, `evalSeq`, `mintedAt` | | §3 |
| `symbol`, `direction`, `slot`, `counterpart` | | for `pick`: `options[]` |
| `condition` | `{ side, level }` | typed; numeric level in the symbol's price |
| `horizon` | `{ phrase, expiresAt, basis }` | market-time instant computed at mint per §5; never a check count |
| `defaultAction` | `act` · `hold` | the divergence baseline for §7 |
| `said` | string | verbatim from the declaration; presentation only |
| `evidence` | **literal wire shape:** `{ tickId: string \| null, availability: 'off' \| 'unresolved' \| 'write_failed' \| 'body_expired' \| 'complete', priceAsOf: string \| null }` | **Identity:** a minted `tickId` is permanent (retention deletes bodies, never the permanent tick); `null` only when no tick was minted (capture off). **Availability is the reader's separate report:** the mint writes `off` (no tick) or `unresolved` (cause unknown until resolved — a timeout is never recorded as proven failure, per capture C-1); a reader with confirming evidence writes `write_failed`; `body_expired` when the permanent tick resolves but its body has aged out; `complete` when both resolve. Cutoff authority is the capture record via `tickId`, referenced never duplicated. `priceAsOf` = the committed evaluation's `promptBuiltAt` **in its source format (ISO-8601 string)**, `null` when missing, **never the current time**; tick-level (no per-symbol cutoff exists); derived display data. A call whose availability is not `complete` is excluded from qualification-grade called-vs-happened evidence; the record says so itself. |
| `hypothesisRef` | versioned \| legacy \| null | **content, not chronology:** versioned `{ watchlistId, hypothesisVersion }` when the frozen battle context carries a validated version; legacy `{ watchlistId, equippedConfigHash }` whenever the frozen context (`agentContext.equippedWatchlist`, `resolvedAgentManifest.equippedConfigHash`) has equipped provenance without a version, regardless of when the battle was created; **The complete origin rule:** `equipped` carries a validated versioned ref or a legacy ref; `agent_initiative` carries `null` because no equipped origin exists; `provenance_unresolved` carries `null` plus `provenanceReason`. **Readers never infer origin from a null ref alone** — `origin` is the authority, the ref is its payload. A missing version still selects legacy whenever valid legacy provenance exists; a missing version never becomes null. **`battleId` is omitted inside this battle-scoped record; any ref exported outside a battle-scoped record carries `battleId` beside it.** A frozen equipped watchlist never becomes initiative because its version is absent; a config hash alone is not watchlist provenance; the writer never fetches the live watchlist to complete a frozen snapshot. |
| `origin` | `equipped` · `agent_initiative` · `provenance_unresolved` | the authority for provenance (see `hypothesisRef`); `provenance_unresolved` carries `provenanceReason` when frozen provenance is present but unusable (corrupt snapshot, hash without watchlist); visible and conservative, never read as initiative |
| `state`, `stateChangedAt`, `stateSource` | §6; `mint` · `check` · `completion` · `sweep` | transitions are transactional with a parent-status recheck; immutable fields and `playerResponse` are never rewritten |
| `playerResponse` | `{ answer, kind: 'directive' \| 'ack', directiveThreadId?, callId, filedAt, heardEvalId? }` \| null | enum plus references, never copied text; written only by the answer endpoint; `heardEvalId` is set from the evaluation's `heard` stamp (there is no tick-keyed heard receipt) |
| `directiveThreadId` | ref | the filing's identity; set for `pick` and every divergent answer |
| `outcome` | `{ actedEvalId?, receiptRef?, heldOff?, reasked? }` \| null | `actedEvalId` only from a committed executor result after execution |
| `refused` | `{ at, reason: 'directive_pending', pendingCallId?, pendingDirectiveThreadId }` \| null | the last refused divergent answer; the only write permitted on a `directive_pending` rejection |

## 5. Horizon — the call-record table (R6 method)

The call-record table is short-lived and per-declaration; the hypothesis horizon is a different table on a different record kind (the pilot's R5 companion). Both cite R6; they never merge.

| `horizonPhrase` | `expiresAt` (market time, computed at mint) |
|---|---|
| `next_check` | the first **eligible evaluator slot** strictly after `promptBuiltAt` — from the registered cron schedule intersected with the calendar's regular-session bounds, pinned against `vercel.json` for cadence drift; never `lastCheckedAt + interval`; a skipped slot is caught by the sweep |
| `this_session` (default) | the session's actual close per the trading calendar (early closes honored); a call minted outside regular equity hours — including a weekend crypto check — resolves to the **next** regular session's close; one clock for every symbol in v1 |
| `this_battle` | the battle's `expiresAt` |
| `explicit` | the declaration's `expiresAtMs`; must satisfy `mintedAt < expiresAtMs ≤ battle expiresAt`, else malformed; clamping only for instants beyond battle end, never forward from the past |

No eligible slot before battle end, or an unmaintained calendar year → malformed, reason logged.

## 6. State machine

`open` → `hit` · `invalidated` · `expired_unresolved` · `ended_with_battle`. Terminal states are honest outcomes.

**`hit` requires an encounter observation:** the check actually examined the symbol with a finite positive quote at an instant inside the horizon, from a named evidence source — never the global quote map or a stored price. No usable observation → no `hit`. Above/below is `>` / `<` against the checked quote at the observation instant. Expiry wins when the observation is outside the horizon; completion wins for a terminal parent. Non-model checks observe with their own instant, never a fabricated `promptBuiltAt`.

`playerResponse.answer ∈ { go, hold, ask, go_now, keep, pick, agree, disagree }`.

## 7. The answer endpoint and the directive rule

`POST /api/agent/call-response`, gated by `CALL_RECORDS_MODE === 'on'` after auth, one `runTransaction` (owner · active · binding · belief · archetype · membership · budget · call state · answer legality), mirroring the shipped chip route's transaction.

- **Divergent answers file a directive** — `hold`/`ask` against `act`, `go_now` against `hold`, `disagree`, `pick` — through the deterministic gate as the chip route practises it (`isValidAdjustmentId` + rendered canonical): a per-archetype family `XX-hold-off`, `XX-ask-first`, `XX-pick` with a templated canonical, the symbol proved against the battle universe, a `pick` bound to the stored `options[]`, slot and swap-out. **Slot shape:** `{ expiry: 'until_ms', expiresAtMs, symbol, kind, callId }` carried through both filing helpers; `until_ms` registered in `directiveUtils`; a `next_check` hold/ask stays active **through the first check at or after `expiresAt`**; activeness and heard are resolved against the same check instant. `playerResponse.kind = 'directive'`; charges one message.
- **Endorsing answers are acknowledgments** — `go` against `act`, `keep`, `agree`: `kind = 'ack'`, no directive, no charge, an agent-initiated receipt exchange carrying `callId`.
- **One divergent answer per interval.** `battle.directive` is a single latest-wins slot. The pending-slot policy is enforced at **every** slot writer (chat's final commit, the chip route, this endpoint) through one shared `writeDirectiveSlot(tx, …)` helper with a transactional recheck: a divergent answer while the slot's directive is unheard is refused with a typed 409 `directive_pending`; only the `refused` receipt is written. "Pending" is defined from the thread's heard evidence (expired/killed/suppressed/no-model cases distinguished).
- "Ask me first" is honored as hold-and-re-ask (`outcome.reasked`; a named re-ask emitter), never as a wait.
- The `pick` kind ships with the four-layer mismatch fixture: four independent observations joined by `callId` and thread — the authenticated selected option bound to options/slot/swap-out/default/horizon; the exact canonical text, committed slot, response, budget and receipt; the visible receipt and the model-visible directive; the committed executor result or explicit non-execution reason.

## 8. The chat reads the record; the join runs both ways

- **Calls block:** `chat.js` reads `calls` inside its existing parallel prologue (degrade to null) and passes them to `buildCallsBlock` — open · `hit` awaiting an answer · the last **5** resolved, each with `playerResponse` and heard status, total-size capped, grounded-only and flag-gated, byte-identical prompt at flag-off.
- **Render anchor:** at `on`, call-backed chat lines are derived from the records (one origin anchor per call, distinct receipt anchors per answer, `said` as text); the legacy anticipation path is byte-identical at `off`/`shadow`; a record-backed fallback when narration was skipped; never another call's anchor.

## 9. Flags and the contribution-relative dark-merge (F4)

`CALL_RECORDS_MODE ∈ { off, shadow, on }` (string pin). **shadow:** declarations records and calls minted, states flipped, capture references written, nothing rendered, chat unchanged. **on:** chat lines from the record, tiles, the calls block, the endpoint.

**Composition rows — governing both the tool schema and the capture record.** With every other flag held fixed, `CALL_RECORDS_MODE = 'off'` removes exactly the `declarations` contribution: no `declarations` property in the tool schema, no `declarations/` or `calls/` reads, mints, flips or references, no calls block, no chip, and **only the call/declaration capture paths removed** — the emitted capture schema and version continue to describe any enabled pilot fields. The pilot's output extension is its own contribution under its own flag (named by the pilot spec). **Only both contributions off returns the pre-build capture shape and the HEAD baseline byte-identically** — tool request, every battle write, prompt bytes, both capture outputs — against a frozen pre-change fixture under injected clocks and ids; a rollback fixture with existing calls present. Each emitted shape names its registered schema version. The same invariant governs Build 1's menu family, since the chat prompt renders the whole allowlist.

| calls | pilot | tool schema | capture record (registered version) |
|---|---|---|---|
| off | off | HEAD baseline | pre-build shape, `TICK_CAPTURE_SCHEMA_VERSION = 1` |
| shadow/on | off | + `declarations` only | + `calls[]` container, version 2 (calls) |
| off | on | + pilot fields only | + pilot fields, the pilot's registered version |
| shadow/on | on | + both | + both containers, the registered combined version |

Dependencies: the deferred-beat PR's run-document contract (`agentEvalRuns`) for the sweep; the sweep queue in its own server-only collection (`callSweepQueue/{battleId}`, armed when a call is created — no new top-level battle key); the tick-side `calls[]` reference (C-3 allowlist by path, §2-reviewed); `firestore.rules` for `declarations` and `calls`. Retired by contract: the threshold-lint flip; the drop receipt.

## 10. Skin ruling
Tokens `--ft-*` by name, never hex; `--ft-call-*` state aliases derived from the existing palette; the player's colour is teal; reduced motion yields `instant`.

## 11. Ownership and sequence
Cockpit arc builds Build 0 (schema · declarations record · call writer after the evaluation commit · shadow · rules · tick reference) → Build 1 (sweep worker, endpoint, directive family, shared slot writer, calls block, record-derived chat lines) → Build 2 (UI; Guarding unavailable until the exit-dials release). The pilot spec consumes this shape unchanged.
