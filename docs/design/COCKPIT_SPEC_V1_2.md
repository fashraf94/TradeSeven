# The Cockpit — Spec V1.2

**Date:** 2026-09-24 · **Author:** Fable · **Supersedes:** Spec V1.1 · **Written against:** Call Record Field Contract **V1.3** (final; committed at `docs/design/CALL_RECORD_FIELD_CONTRACT_V1_3.md`) · **Folds:** Astra round 2 (`docs/audits/20260923_COCKPIT_SPEC_V1_1_REVIEW.md`, R2-1–R2-12) on top of round 1 and the discovery.
**Baseline note:** PR #896 (deferred beat) is merged; `agentEvalRuns/{runId}` with `deferredBattleIds` now exists on `main`, which clears Build 1's first named prerequisite.
**Frame:** chat drives, cockpit acts, board shows. A receipt never claims what the check did not observe, hear, or do.

---

## 1. Builds and gates

| Build | Delivers | Gates |
|---|---|---|
| **0** | flag-conditional `declarations` · frozen observation snapshot · validated declarations record · transactional publication after the evaluation commit (declarations + calls + sweep-queue arm) · per-exit encounter flips · `CALL_RECORDS_MODE` (shadow) · rules · capture v2 at shadow/on | Astra delta review of §3 → BUILD; then build, §2 review, merge, shadow |
| **1** | sweep worker · `POST /api/agent/call-response` · directive family with `until_ms` · shared slot writer · heard writer · re-ask emitter · calls block · record-derived chat lines | Build 0 shadow read; B2 abandoned (CR-11) |
| **2** | pane tab · mobile Board ⇄ Cockpit · pills · tiles/sheets · `useCalls` + `useDeclarations` · research sheet (two outcomes) · tokens | Brief §8 · `CALL_RECORDS_MODE = 'on'` · Build 1 |

**Out of v1:** exit dials and fuse ticks; the Record glance; "flag for next deploy"; multi-directive; a prompt section teaching `declarations`; Guarding data (ships *unavailable*).

## 2. Flags, mode resolution, composition

| Flag | Values | Pin |
|---|---|---|
| `CALL_RECORDS_MODE` | `off` · `shadow` · `on` | `src/config/callRecordsFlags.test.js` — direct string pin, mode list, pointer assertion, runway comment; never a `DARK_BY_DESIGN` key |
| `COCKPIT_UI_ENABLED` | bool | `DARK_BY_DESIGN` + pin (Build 2) |

**Mode is resolved once per handler invocation** (`resolveCallRecordsMode()` at handler start, carried in the request-local context of §3.3) and never re-read mid-check.

**Composition (contract §9).** At `off`: no `declarations` property in the tool schema; no admission reserve; no observation snapshot; no `declarations/`, `calls/` or `callSweepQueue/` reads, writes, flips or references; no `declarationsPhase` key on any entry or on `cronState`; the capture record omits the `calls` container and reports the pre-build version; existing calls, declarations and queue documents from an earlier shadow period are untouched. **Per-mode exact-key expectations:** the flag-off test asserts absence of every calls key on every exit path and every battle write; a new `agent-evaluate.tickStamps.callsOn.test.js` asserts presence at shadow/on. `declarationsPhase` is registered in a separate `CALLS_ENTRY_KEYS` list, **never** in `TIMING_ENTRY_KEYS` or `BASE_ENTRY_KEYS`. The four composition rows (calls × pilot) are tested with the pilot and every unrelated flag held fixed. Build 1's menu family follows the same invariant.

## 3. Build 0

### 3.1 Schema — flag-conditional; trade validator untouched
`api/_utils/agentEvalToolSchema.js` exports `buildTradeDecisionTool({ declarations })`; `TRADE_DECISION_TOOL = buildTradeDecisionTool({ declarations: false })` so every import, pin and `validateTradeToolResult` (which captures that constant once, `agentEvalToolResultValidation.js:49-51`) are unchanged. The cron builds with `declarations: mode !== 'off'`. Property per contract §2, `['object','null']`, not in `required`, descriptions free of `20-day`. **The calls validator is the only validation boundary for the block; a bad block never alters the trade result.**

**Output headroom (R2-9):** the tool's `max_tokens` ceiling is 2,048 (`agentEvalTransport.js:59`). The build measures the serialized `declarations` output of the shadow fixtures and states the margin; the schema descriptions ask the model for at most 6 shots. Shadow reports `stop_reason === 'max_tokens'` counts as truncation events; the input-budget test proves nothing about output and the report says so.

### 3.2 Validated declarations block — per-kind mapping and caps

`api/_utils/callRecords/validate.js` → `{ validated, removed: [{ index, reason }] }`.

| Source | Kind | Required | Optional / inapplicable | Malformed if |
|---|---|---|---|---|
| `calledShots[]`, `direction: 'entry'` | `called_shot` | `symbol, slot, condition{side,level}, horizonPhrase, defaultAction, said` | `counterpart`; `expiresAtMs` only with `explicit` | required field absent or wrong-typed; `explicit` without valid `expiresAtMs` |
| `calledShots[]`, `direction: 'exit'`, `defaultAction: 'act'` | `confirmation` | same | `counterpart` = the incoming name if declared | same |
| `calledShots[]`, `direction: 'exit'`, `defaultAction: 'hold'` | `called_shot` | same | | same |
| `fork` | `pick` | `slot, swapOut, options[2..4]{symbol, why}, said` | no condition/defaultAction; horizon = `next_check` | < 2 options; option symbol outside the battle universe |
| `watching[]`, `playerAsk` | declarations record only (never calls) | | | `playerAsk` with < 2 options |

**Caps and typed removals (R2-9):** `said` ≤ 280 chars, `why` ≤ 140, `question` ≤ 200, each option string ≤ 60, ≤ 6 shots, ≤ 6 watching, ≤ 4 fork options, ≤ 4 ask options; declarations document ≤ 16 KB serialized; total publication ≤ 64 KB. An oversize row is **removed with `oversize`** — never rewritten; `said` is verbatim on a born row. Removal order is stable (source order); ordinals are assigned after removal: **validated `calledShots` in order, then the valid `fork`**. A top-level block that is not an object → `malformed_block` (nothing born; no declarations record). Present non-finite `condition.level` is not malformed — it mints `invalidated` (§3.5). Reason precedence for `invalidated`: `no_observation` → `level_non_finite` → `level_implausible`.

### 3.3 Request-local calls context and the observation snapshot (R2-3, R2-4)

`callsCtx` is declared **outside the handler's `try`** (the tick-capture precedent, `agent-evaluate.js:697-718`), independent of tick capture: `{ mode, handlerStartMs, fetchedQuotes: {}, observation: null, evalIdentity: null, exit: null, phase: null }`.

**Original quotes are preserved as fetched.** Immediately after the quote fetch (`:815-840`) and after each later augmentation fetch (`:1235-1240`, `:2235-2241`), the cron copies `{ sym: { px, fallback, fetchedAtMs } }` into `callsCtx.fetchedQuotes` **before** any execution-price overwrite (`:2063-2082`). Overwrites never touch this copy.

**The observation snapshot is taken at the seam where the check examines symbols, and frozen:**

- **Model checks:** right after the successful prompt build (`promptBuiltAt`, `:2458`), from **the rows actually supplied to the prompt** — the held rows and the flattened augmented bench passed to assembly (`agentEvalPromptAssembly.js:1168,1489-1516`). For each such symbol, the value is `callsCtx.fetchedQuotes[sym]`, admitted only if `isSettlementQuoteUsable` (rejects fallback, non-finite, non-positive — `agentQuoteHealth.js:23-28`) passes it, applied observationally. `observedAtMs = Date.parse(promptBuiltAt)` (finite-checked). `source: 'prompt_rows'`. A symbol whose prompt row carried an execution-price replacement is admitted with its **fetched** quote and `replacedInPrompt: true`. Symbols in the global map but not in the prompt rows (opponent, macro, unexamined) are excluded; a symbol that is both a held/bench name and a macro/opponent name qualifies by its held/bench role.
- **Non-model checks** (no-trigger `:2295-2314`, proposal-pending `:2104-2116`, passive `:1086-1093`): at that path's own exit, from the held names plus the bench names present in `callsCtx.fetchedQuotes` with usable quotes; `observedAtMs` = the instant taken right after quote health (`:860`); `source: 'no_model'`. Pre-admission exits, refresh failures and error exits produce **no observation** and no phase.
- The snapshot is `Object.freeze`d and carried; it is **never reconstructed at publication or flip time**. It is recorded on the declarations record (`observation`) and, for each flip, on the call (§3.7).

### 3.4 Schedule and horizon resolver (R2-6)
`api/_utils/callRecords/horizon.js`, pure, epoch-ms throughout. `EVALUATOR_SLOTS` is a constant pinned by a test against `vercel.json`'s entry for `/api/cron/agent-evaluate` (`*/15 13,14,15,16,17,18,19,20,21 * * 1-5`, `:157-158`); `nextEligibleSlot(afterMs)` enumerates UTC slot candidates and keeps those with `openMs <= slot < closeMs` from `getSessionForDate` (`marketSchedule.js:177-203`) and `slot > afterMs`; the close-equality slot is never scheduled. `resolveHorizon(phrase, { promptBuiltAtMs, mintedAtMs, battleExpiresAtMs, expiresAtMs? })` → `{ expiresAtMs, basis }` with `basis ∈ { 'next_check', 'this_session', 'this_battle', 'explicit' }`, or a malformed reason `no_slot_before_battle_end` · `calendar_unavailable` · `explicit_invalid`. `explicit` is validated against **`mintedAtMs`** (contract §5), so an expiry crossed between prompt build and mint is malformed. Also required: `slot < battleExpiresAtMs`. Fixtures: normal RTH (26 slots), early close at 13:00 (14 slots), DST, holidays, close equality, final slot, unmaintained year, weekend mint → next session's close (a horizon fixture, not an evaluator path).

### 3.5 Mint candidate — built once, frozen (R2-1, R2-6)
After the evaluation commit succeeds (§3.6 says where), build the candidate once: `mintedAtMs` fixed; `evalId`/`evalSeq` from the committed identity; ids `${battleId}:${evalId}:call:${n}`; validity per §3.2 and §3.3 (`open` or `invalidated`); horizon per §3.4; `evidence = { tickId | null, availability: 'off' | 'unresolved', priceAsOf: promptBuiltAt (ISO string) | null }`; `hypothesisRef`/`origin` per contract §4 from the frozen `agentContext.equippedWatchlist` (`{ watchlistId, name, tickers }`, `watchlistEquip.js:170-175`) and `resolvedAgentManifest.equippedConfigHash` (`:152-165`, version-free) — legacy when both present, `provenance_unresolved` with `provenanceReason` when a hash exists without a watchlist or the snapshot is corrupt, null only when nothing was ever frozen; the versioned branch is a synthetic fixture until a validated version field exists. The candidate's **canonical form** = stable-key JSON of the immutable fields (everything except `state`, `stateChangedAt`, `stateSource`, `playerResponse`, `outcome`, `refused`, `evidence.availability`).

### 3.6 Publication — one transaction, serialized with completion, budgeted (R2-1, R2-2, R2-7)

**Where.** Model path only, after `battleRef.update(finalUpdate)` at `:4058` resolves (the evaluation identity is durable) and before narration dispatch (`:4090`). The entry written in that update carries `declarationsPhase: 'none' | 'expected'` (mode ≠ off only; via `CALLS_ENTRY_KEYS`).

**Budget (R2-2).** Admission: `callsReserveMs = mode === 'off' ? 0 : 4_000`, added to the existing post-call allowance in the admission helper (`agentEvalTransport.js:167-176`; nominal threshold 48,000 ms at shadow/on, 44,000 ms at off — reported as an intentional scheduling effect). Phase entry: `remaining = TIME_BUDGET_MS − (now − handlerStartMs)`; `TAIL_RESERVE_MS = 12_000` (narration, anticipation, capture, response); run only if `remaining − TAIL_RESERVE_MS ≥ 4_000`, else `phase: 'skipped_budget'`. One absolute deadline `phaseDeadline = min(now + 4_000, handlerStartMs + TIME_BUDGET_MS − TAIL_RESERVE_MS)` covers the read, canonicalization, transaction (including retries), flips (§3.7), capture references and the status write. No new work starts after the deadline; a timeout is `unconfirmed`. The platform kill buffer (300 s − 290 s) is never treated as available.

**The transaction (R2-1, R2-7).** Only if `expected`: one `db.runTransaction`:
1. `tx.get(battleRef)` → require `status === 'active'` and `cronState.evalSeq >= evalSeq` (identity committed); otherwise abort with `parent_terminal` (nothing written).
2. `tx.get(declarationsRef)` → if it exists, compare canonical forms of the declarations record and every call: identical → idempotent success (nothing written, `phase: 'written'`); any difference → abort with `call_conflict`, originals preserved, both ids logged.
3. `tx.get(callSweepQueueRef)` → compute `nextExpiresAt = min(existing, min(open calls' expiresAtMs))`.
4. `tx.create(declarationsRef, record)`; `tx.create(callRef_n, call_n)` for each; `tx.set(callSweepQueueRef, { battleId, nextExpiresAt, updatedAt }, { merge: true })`.
The parent read participates in the conflict check, so a completion committing between the read and the commit aborts the transaction (retry re-reads `completed` → `parent_terminal`). The candidate is built outside retries; never `merge` on a call; never rewrite state/response/outcome.

**Results and status.** Per-id `confirmed | rejected | unconfirmed`. `cronState.declarationsPhase = { evalId, phase: 'written' | 'failed' | 'unconfirmed' | 'skipped_budget' | 'parent_terminal' | 'conflict', at }` written **only after** the transaction's outcome is known; a failed status write leaves the previous value (a missing document with `expected` reads as failed/unconfirmed, never as written). Capture references (`tickCapture.call({ callId, n, kind })`) only from **confirmed** results, before capture finalize (`:4180`).

### 3.7 Encounter flips — per exit, transactional, excluding the minting check (R2-4, R2-5, R2-9)

`runCallFlips(callsCtx)` runs at each supported exit **after that exit's authoritative write**: the model path (after §3.6, inside the same deadline), the no-trigger exit, the proposal-pending exit and the passive exit (each with its own bounded deadline of 2,000 ms). Requires `mode !== 'off'` and a usable observation; otherwise no-op.

Query `calls` where `state == 'open'`, ordered by `mintedAt` asc, page 50, sequential pages until the deadline; if the deadline hits mid-scan, `cronState.callFlips = { evalId | null, scanned, total, complete: false }` is written so partial coverage is never mistaken for "nothing expired." Per call, **one transaction** that re-reads the call and the parent:
- skip if the call is not `open`, the parent is terminal, **or `call.evalId === callsCtx.evalIdentity.evalId`** (a call never hits on the observation that declared it);
- skip if `observedAtMs <= call.mintedAtMs` (the observation must be strictly after mint and inside the horizon);
- `observedAtMs > expiresAtMs` → `expired_unresolved`;
- else if the symbol has an observation and `side === 'above' ? px > level : px < level` → `hit`, writing `outcome.observation = { px, observedAtMs, source, replacedInPrompt? }`;
- `outcome.actedEvalId = evalId` only on the model path and only when the **committed executor receipt** (`:3271-3288`) matches the call's leg: entry call ↔ incoming symbol and slot; exit call ↔ outgoing symbol; `pick` ↔ incoming symbol ∈ options and slot. Same-symbol activity on the other leg never counts. Non-model exits never set `actedEvalId`.
Immutable fields and `playerResponse` are never rewritten. Sequential transactions, ≤ 800 ms each.

### 3.8 Capture v2 — only at shadow/on
`captureConfig.js`: keep `TICK_CAPTURE_SCHEMA_VERSION = 1`; add `TICK_CAPTURE_SCHEMA_VERSION_CALLS = 2`; the writer emits version 2 and the `calls` container only when `mode !== 'off'`; both versions registered and readable. `captureSerializer.js`: `CALL_KINDS` exported from the contract's kind set, registered in `ENUM_LISTS`; container allowlist `'calls': 'array'`, `'calls.*': 'object'`; leaf allowlist `'calls.*.callId': 'id'`, `'calls.*.n': 'number'`, `'calls.*.kind': 'enum:CALL_KINDS'`. `captureContext.js`: `calls: []` + `call()` on the live and NOOP interfaces; call ordinals zero-based, independent of action ordinals.

### 3.9 Rules
`firestore.rules`: `match /declarations/{evalId}` and `match /calls/{callId}` mirroring `intradayViews` (`:441-452`); `callSweepQueue` is a top-level server-only collection (deny all clients). Tests: `test/rules/{callsDenials,declarationsDenials,callSweepQueueDenials}.rules.mjs` copied from the intraday and `agentEvalRuns` precedents. No composite index (client orders by `mintedAt` only; the worker's query is Build 1's).

### 3.10 Files
`agentEvalToolSchema.js` · `api/_utils/callRecords/{mode,validate,observe,horizon,candidate,publish,flip}.js` · `api/cron/agent-evaluate.js` (context outside `try`; quote copies at the three fetch sites; observation at the prompt seam and at the three non-model exits; admission reserve; the phase after `:4058`; flips at four exits; `tickCapture.call`) · `api/_utils/agentEvalTransport.js` (reserve parameter) · `api/_utils/tickCapture/{captureConfig,captureSerializer,captureContext,captureWriter}.js` · `firestore.rules` + three rules tests · `src/config/featureFlags.js` + `callRecordsFlags.test.js` · `api/_utils/__fixtures__/tickStampsHarness.js` (`CALLS_ENTRY_KEYS`, `makeDeclarations`, `makeObservation`) · `agent-evaluate.tickStamps.callsOn.test.js` (new) · `intradayPromptExclusions.test.js` (+ row: the prompt allowlists never admit `declarations`) · `vercel.json` schedule pin test · `api/_utils/compositionProtectedStoresAllowlist.json` rows for the transaction's write sites if the scanner cannot resolve them (per the deferred-beat report §7, resolvable literal collections need no row).

### 3.11 Tests — falsification, each mutation-checked
1. **Composition:** `off` → schema, every battle write on every exit, prompt bytes, both capture outputs byte-identical to the frozen fixture; the rollback fixture (existing calls, declarations, queue, mode `off`) shows zero reads and zero writes to those collections; UI-on/records-off holds nothing subscribed.
2. **Per-mode keys:** flag-off asserts absence of `declarationsPhase` and `cronState.declarationsPhase` on every exit; calls-on asserts presence; adding the key to `BASE_ENTRY_KEYS` turns a row red.
3. **Publication atomicity:** completion committing between the parent read and the commit → `parent_terminal`, nothing written; late-timeout variant; identical retry → success with one document set; different payload → `call_conflict` with originals intact; any `merge` on a call → red.
4. **Failed before commit:** final update throws → no records, no phase key on any surviving write.
5. **Budget:** 4.1 s left with a narration queued → `skipped_budget`; a slow query + n creates stays inside the deadline; a late write is `unconfirmed` and unreferenced; the admission threshold is 48,000 at shadow/on and 44,000 at off.
6. **Observation:** a forced-entry-price symbol observes with its fetched quote and `replacedInPrompt: true`; a fallback quote is excluded; an augmented bench candidate is included; an opponent/macro-only symbol is excluded; a held symbol that is also a macro symbol is included; no-trigger, proposal and passive exits produce `no_model` observations with their own instants; failed refresh produces none.
7. **Validation:** the mapping table; oversize row removed, siblings survive, the accepted SWAP untouched; cross-kind ordinal order; `malformed_block`.
8. **Horizon:** §3.4 fixtures; the `vercel.json` pin; explicit expiry crossed between prompt build and mint → malformed.
9. **Flips:** a call never hits on its minting check; an observation ≤ mint is skipped; exact expiry; a stale `open` read cannot overwrite a completed/answered call; `actedEvalId` only on a matching leg (opposite-leg, wrong-counterpart, blocked-SWAP and proposal-only fixtures); partial scan writes `complete: false`; 51+ open calls scanned across pages.
10. **`hypothesisRef`/`origin`:** legacy, `provenance_unresolved` (hash without watchlist; corrupt snapshot), null, synthetic versioned.
11. **Evidence:** capture on → `{ tickId, 'unresolved', ISO string }`; capture off → `{ null, 'off', ISO string }`; a missing `promptBuiltAt` → `priceAsOf: null`.
12. **Capture v2:** emitted only at shadow/on; `rejectedFields` empty; version 1 byte-identical at off.
13. **Rules:** owner reads `declarations` and `calls`; everyone denied `callSweepQueue`; every write denied.

### 3.12 Review, report, shadow week
≥ 10 files → BUILD_RULES §2 multi-lens review with `vite build`; the schema extension reviewed as fenced-class. Report `docs/audits/<date>_BUILD0_CALL_RECORDS.md` names the spec and contract paths and SHA-256s, the §1 intersection (∅), the composition proof, the output-size margin and wall-time margins separately, and the mutation table. Merge after 6 PM ET; flip to `shadow` next morning. **Shadow read (five sessions), labeled honestly:** records by kind/state per day; malformed and `invalidated` reasons; phase results; truncation events; `call_conflict` (expect 0); flip coverage (`complete` ratio); and the **known unresolved backlog** — calls whose battles received no later check have no expiry repair until Build 1's worker; the shadow week does not claim lifecycle coverage.

## 4. Build 1 — mechanisms named (R2-7, R2-10)
1. **Sweep worker:** a branch in `api/cron/process-pending-reflections.js`'s handler, own query on `callSweepQueue` (`where nextExpiresAt <= now`, ordered, paged, deadline-bounded), running regardless of market state and reflection backlog; flips `expired_unresolved` transactionally, recomputes or deletes the queue document; `ended_with_battle` inside `completeBattle`'s transaction, hit outcomes preserved; a reconciliation pass enrolls any open call without queue coverage; the flip-worker drains the shadow backlog before live enablement.
2. **Heard writer:** in the calls phase after the evaluation commit, join the just-committed entry's unsuppressed `heard.directiveThreadId` (`tickStamps.js:130-151`) to the open or hit call carrying that `playerResponse.directiveThreadId` → set `heardEvalId`; retried within the phase; repaired by the worker; independent of capture and of the 150-entry window.
3. **Check instant:** the cron attaches an in-memory `battle.__checkInstantMs` before prompt assembly; `directiveUtils.isDirectiveActive` reads it when present (else `Date.now()`), so the fenced assembler's call site is untouched and both readers resolve against the same instant. `until_ms` next-check hold/ask is consumed exactly once: active through the first applicable check at or after `expiresAtMs`, released by the heard writer.
4. **Re-ask emitter:** on `hit` with answer `ask`, the flip transaction sets `outcome.reasked = true` and the phase writes one agent-initiated receipt exchange keyed by `callId` (idempotent); second answers (`go_now` · `keep`) are legal only while `reasked` and unresolved; the endpoint updates `outcome` on `hit` calls.
5. **Endpoint, directive family, shared slot writer, calls block, record-derived chat lines:** as V1.1 §4 with the answer/default → adjustment matrix written out and each layer of the contract §7 fixture failed independently; parameterized ids excluded from ordinary menu writers.

## 5. Build 2 — (R2-12 added)
As V1.1 §5, plus `useDeclarations`: a bounded owner-readable query for the latest check's declarations record (`orderBy('evalSeq','desc').limit(1)`), gated on records + UI flags, torn down when disabled, with `none | stale | malformed | unavailable` states; Monitoring and Research-objective consume only that record. Reader enablement = records mode ∧ UI flag (∧ grounding for Show It via `isShowItOn()`).

## 6. Review sequence
Astra delta review of §3 (Build 0 only; BUILD or REVISE) → Build 0 prompt derived from §3 → build → §2 review → merge → shadow → Build 1 → Build 2.
