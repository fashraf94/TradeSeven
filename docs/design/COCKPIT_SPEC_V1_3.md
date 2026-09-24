# The Cockpit — Spec V1.3

**Date:** 2026-09-24 · **Author:** Fable · **Supersedes:** Spec V1.2 · **Folds:** Astra round 3 (`docs/audits/20260924_COCKPIT_SPEC_V1_2_REVIEW.md`, R3-1–R3-9) on top of rounds 1–2 and the discovery.
**Contract of record:** `docs/CALL_RECORD_FIELD_CONTRACT_V1_3.md` — committed-blob SHA-256 `7161e113efbac2e3fd05e4c45da3080d7d62ad0dcfc3ea1d9e30d38642c4fc25` (raw bytes via `git show`; a CRLF checkout hashes differently and is not the pin).
**Source baseline for §3's seam map:** `main` @ `fc3a072e` (post PR #896). Discovery anchors at `2a1a16b1` are historical; the builder re-verifies every seam at its own HEAD before writing code (§3.13).
**Frame:** chat drives, cockpit acts, board shows. A receipt never claims what the check did not observe, hear, or do — and the instant on a receipt is the instant the observation existed.

---

## 1. Builds and gates

| Build | Delivers | Gates |
|---|---|---|
| **0** | flag-conditional `declarations` · frozen per-exit observation snapshots · validated declarations record · transactional publication after the evaluation commit (declarations + calls + sweep-queue arm) · per-exit encounter flips with a rotation cursor · `callObservations` receipts · `CALL_RECORDS_MODE` (shadow) · rules + index · capture composition | build from this spec with the reconciliation gate (§3.13); §2 multi-lens review; Astra branch review; merge; shadow |
| **1** | sweep worker · `POST /api/agent/call-response` · directive family with `until_ms` · shared slot writer · heard writer · re-ask emitter · calls block · record-derived chat lines | Build 0 shadow read; B2 abandoned (CR-11) |
| **2** | pane tab · mobile Board ⇄ Cockpit · pills · tiles/sheets · `useCalls` + `useDeclarations` · research sheet (two outcomes) · tokens | Brief §8 · `CALL_RECORDS_MODE = 'on'` · Build 1 |

**Out of v1:** exit dials and fuse ticks; the Record glance; "flag for next deploy"; multi-directive; a prompt section teaching `declarations`; Guarding data (ships *unavailable*).

## 2. Flags, mode resolution, composition

| Flag | Values | Pin |
|---|---|---|
| `CALL_RECORDS_MODE` | `off` · `shadow` · `on` | `src/config/callRecordsFlags.test.js` — direct string pin, mode list, pointer assertion, runway comment; never a `DARK_BY_DESIGN` key |
| `COCKPIT_UI_ENABLED` | bool | `DARK_BY_DESIGN` + pin (Build 2) |

**Mode is resolved once per handler invocation** (`resolveCallRecordsMode()` at handler start, carried in `callsCtx`) and never re-read mid-check.

**Composition (contract §9), four rows, tested with every unrelated flag fixed:**

| calls | pilot | tool schema | capture record (registered version) | calls data |
|---|---|---|---|---|
| off | off | HEAD baseline | pre-build shape, version 1 | untouched, unread |
| shadow/on | off | + `declarations` | + `calls[]`, version 2 (calls) | active |
| off | on | + pilot fields | + pilot fields, the pilot's registered version | untouched, unread |
| shadow/on | on | + both | + both, the registered combined version | active |

At calls-off: no `declarations` property; no admission reserve; no observation snapshot; no reads or writes to `declarations/`, `calls/`, `callObservations/` or `callSweepQueue/`; no `declarationsPhase`/`callFlips`/`callsDiag` on any entry or on `cronState`; only the **calls** capture paths removed — the emitted capture schema and version continue to describe any enabled pilot fields. **The emitted capture schema is resolved once from the enabled contribution set and passed to both the permanent and body composers** (`captureWriter.js` uses one version constant in both). If pilot/combined registration does not exist at the build baseline, those two rows are gated **unavailable** and reported as such — never claimed tested, never emitted with a misleading version. `declarationsPhase` lives in a separate `CALLS_ENTRY_KEYS` list, never in `TIMING_ENTRY_KEYS` or `BASE_ENTRY_KEYS`; the flag-off test asserts absence on every path that writes an entry; `agent-evaluate.tickStamps.callsOn.test.js` asserts presence on those same paths at shadow/on.

## 3. Build 0

### 3.1 Schema — flag-conditional; trade validator untouched
`api/_utils/agentEvalToolSchema.js` exports `buildTradeDecisionTool({ declarations })`; `TRADE_DECISION_TOOL = buildTradeDecisionTool({ declarations: false })` so every import, pin and `validateTradeToolResult` (captures that constant once) are unchanged. The cron builds with `declarations: mode !== 'off'`. Property per contract §2, `['object','null']`, not in `required`, descriptions free of `20-day`; the descriptions ask for at most 6 shots. **The calls validator is the only validation boundary for the block; a bad block never alters the trade result.** Output headroom: the tool ceiling is 2,048 tokens; the build measures serialized declarations output on the shadow fixtures and states the margin; shadow reports `stop_reason === 'max_tokens'` as truncation events; the input-budget test proves nothing about output.

### 3.2 Validated declarations block — mapping, caps, ordinals
`api/_utils/callRecords/validate.js` → `{ validated, removed: [{ index, reason }] }`.

| Source | Kind | Required | Optional / inapplicable | Malformed if |
|---|---|---|---|---|
| `calledShots[]`, `direction: 'entry'` | `called_shot` | `symbol, slot, condition{side,level}, horizonPhrase, defaultAction, said` | `counterpart`; `expiresAtMs` only with `explicit` | required field absent/wrong-typed; `explicit` without valid `expiresAtMs` |
| `calledShots[]`, `direction: 'exit'`, `defaultAction: 'act'` | `confirmation` | same | `counterpart` = incoming name if declared | same |
| `calledShots[]`, `direction: 'exit'`, `defaultAction: 'hold'` | `called_shot` | same | | same |
| `fork` | `pick` | `slot, swapOut, options[2..4]{symbol, why}, said` | no condition/defaultAction; horizon `next_check` | < 2 options; option symbol outside the battle universe |
| `watching[]`, `playerAsk` | declarations record only | | | `playerAsk` with < 2 options |

Caps: `said` ≤ 280, `why` ≤ 140, `question` ≤ 200, option strings ≤ 60; ≤ 6 shots, ≤ 6 watching, ≤ 4 fork options, ≤ 4 ask options; declarations document ≤ 16 KB; total publication ≤ 64 KB. Oversize rows are removed with `oversize`, never rewritten. Removal order is source order; ordinals assigned after removal: validated `calledShots` in order, then the valid `fork`. A non-object block → `malformed_block` (nothing born, no record). A present non-finite level is not malformed — it mints `invalidated`. Reason precedence: `no_observation` → `level_non_finite` → `level_implausible` (|level − px|/px > 0.25).

### 3.3 Request-local calls context; quotes preserved as fetched (R3-1)
`callsCtx` is declared **outside the handler's `try`** (the tick-capture precedent, now `agent-evaluate.js:866-908`), independent of tick capture:
`{ mode, handlerStartMs, fetchedQuotes: {}, observation: null, evalIdentity: null, executorResult: null, exit: null, diag: {} }`.

**Quote preservation.** At each fetch site — the initial fetch (`:1004-1018`) and the augmentation fetches (`:1403-1411`, `:2404-2411`) — the cron copies, per symbol, a **detached** `{ current, fallback, fetchedAtMs }` (the `data.price` object's `current` and `fallback` as fetched, plus the fetch instant) into `callsCtx.fetchedQuotes` **before** any execution-price replacement (`:2232-2251`). Replacements never touch this copy. Admission of a quote to an observation applies **`isSettlementQuoteUsable` to that detached shape** (it reads `quote.current`; `agentQuoteHealth.js:20-28`) and then projects `current` into observation `px`.

### 3.4 Observation snapshots per exit — the exit matrix (R3-1, R3-2)
An observation is `{ observedAtMs, source, symbols: { [sym]: { px, fetchedAtMs, replacedInPrompt? } } }`, frozen once at its seam, never reconstructed. **Invariant on every admitted symbol: `fetchedAtMs ≤ observedAtMs`.** The examined set, the quote values and the instant are all taken **at the same seam, after every admitted quote has arrived**; the initial quote-health instant is never reused for later membership or later fetches.

| Exit path (HEAD anchor) | Examined set | `observedAtMs` | Publication? | Flips? | Entry phase key |
|---|---|---|---|---|---|
| **model-result** (final update `:4244`) | held rows + flattened augmented bench supplied to the prompt (`agentEvalPromptAssembly.js:1168,1489-1516`), quotes from `fetchedQuotes`, `replacedInPrompt` when the prompt row carried a replacement | `Date.parse(promptBuiltAt)` (`:2628-2634`), finite-checked | yes, if the validated block is non-null | yes | `none` / `expected` |
| **transport-failed-after-prompt** (model call failed; entry written) | same as model-result | same | no (no model output) | yes | `none` |
| **budget-skipped** (`:2555-2569`, reaches `:4244` with no prompt) | held names + bench names with usable quotes in `fetchedQuotes` **at this exit** | this exit's instant | no | yes | `none` |
| **no-trigger** (`:2464-2483`) | same rule, at this exit | this exit's instant | no | yes | none written (no entry) |
| **proposal-pending** (`:2104-2116`) | same rule, at this exit | this exit's instant | no | yes | none written |
| **gameplan-pending** (`:2295-2314`) | the set the deterministic pass examined | that pass's instant | no | yes | none written |
| **gameplan-created** (`:2334-2361`) | the set the deterministic pass examined | that pass's instant | no | yes | none written |
| **passive / CPU** (`:1086-1093`) | held names with usable quotes | this exit's instant | no | yes | none written |
| pre-admission, degraded quotes (required-quote gate failed), failed refresh, failed prompt build, error exits | — | — | no | **no** | none written |

Publication requires a **committed evaluation identity** and a non-null validated block; flips never require publication. `declarationsPhase = 'none'` when the block is null, absent, `malformed_block`, or fully removed; `'expected'` when typed content survives; removal reasons stay in diagnostics. No-entry paths create neither an `evalId` nor a phase key; all identity dereferences use `callsCtx.evalIdentity?.evalId ?? null`. The **executor result** on the model path (the awaited `executeSwapServer` return — `symbolOut`, `symbolIn`, `tier`, `slotIndex`, `agentSwapExecution.js:255-260,367-369`; consumed at `:3446-3463`) is carried in `callsCtx.executorResult` independently of capture.

### 3.5 Schedule and horizon resolver
`api/_utils/callRecords/horizon.js`, pure, epoch-ms. `EVALUATOR_SLOTS` pinned by a test against `vercel.json:157-158` (`*/15 13,14,15,16,17,18,19,20,21 * * 1-5` for `/api/cron/agent-evaluate`); `nextEligibleSlot(afterMs)` keeps UTC candidates with `openMs <= slot < closeMs` (`getSessionForDate`, `marketSchedule.js:177-203`) and `slot > afterMs`; never the close-equality slot; also `slot < battleExpiresAtMs`. `resolveHorizon(phrase, { promptBuiltAtMs, mintedAtMs, battleExpiresAtMs, expiresAtMs? })` → `{ expiresAtMs, basis ∈ { next_check, this_session, this_battle, explicit } }` or `no_slot_before_battle_end` · `calendar_unavailable` · `explicit_invalid`; `explicit` validated against **`mintedAtMs`**. Fixtures: 26-slot RTH, 14-slot early close, DST, holidays, close equality, final slot, unmaintained year, weekend mint → next session close (horizon fixture only), explicit expiry crossed between prompt build and mint.

### 3.6 Mint candidate — built once, frozen
After the evaluation commit succeeds: `mintedAtMs` fixed; ids `${battleId}:${evalId}:call:${n}`; validity per §3.2 against the **model-result observation**; horizon per §3.5; `evidence = { tickId | null, availability: 'off' | 'unresolved', priceAsOf: promptBuiltAt (ISO string) | null }`; `hypothesisRef`/`origin` per contract §4 from the frozen `agentContext.equippedWatchlist` (`{ watchlistId, name, tickers }`) and `resolvedAgentManifest.equippedConfigHash` — legacy when both present; `provenance_unresolved` + `provenanceReason` when a hash exists without a watchlist or the snapshot is corrupt; null only when nothing was ever frozen; versioned is a synthetic fixture. Canonical form = stable-key JSON of the immutable fields (excluding `state`, `stateChangedAt`, `stateSource`, `playerResponse`, `outcome`, `refused`, `evidence.availability`).

### 3.7 Publication — one transaction, serialized with completion, budgeted (R3-3, R3-5)
**Where:** model-result path only, after `battleRef.update(finalUpdate)` (`:4244`) resolves and before narration dispatch (`:4276`).

**Budget — one clock for every hook.** `remaining = handlerStartMs + TIME_BUDGET_MS − now`; `TAIL_RESERVE_MS = 12_000`; `available = remaining − TAIL_RESERVE_MS`. Admission (model path): `callsReserveMs = mode === 'off' ? 0 : 4_000` added to the post-call allowance in `agentEvalTransport.js:167-176` (48,000 ms nominal at shadow/on; 44,000 at off; reported as an intentional scheduling effect). Model-path phase: run only if `available ≥ 4_000`, `deadline = min(now + 4_000, handlerStartMs + TIME_BUDGET_MS − TAIL_RESERVE_MS)`. **Non-model hooks (§3.8): run only if `available ≥ 2_000`, `deadline = min(now + 2_000, handlerStartMs + TIME_BUDGET_MS − TAIL_RESERVE_MS)`** — the same protected tail, because early exits still enter `finally` where narrations are awaited (`:4261-4290`) and capture uses the remaining budget (`:4366-4372`). Every read, canonicalization, transaction attempt, flip, receipt, reference and status attempt shares the deadline; nothing starts after it; a timeout is unconfirmed; the platform kill buffer is never available.

**The transaction** (only if `expected` and inside the deadline): let `newOpen` = candidate calls whose initial state is `open`.
1. `tx.get(battleRef)` → require `status === 'active'` and `cronState.evalSeq >= evalSeq`; else abort `parent_terminal`.
2. `tx.get(declarationsRef)` → exists with identical canonical forms for the record and every call → idempotent success (nothing written); any difference → abort `call_conflict`, originals preserved, both ids logged.
3. **If `newOpen` is non-empty:** `tx.get(callSweepQueueRef)`; `nextExpiresAt = min(existing finite value, finite expiries of newOpen)`; **if `newOpen` is empty (declarations-only, or all invalidated): no queue read and no queue write; an existing queue document is left unchanged.** Never persist `Infinity`, `null` or `undefined` as a queue value.
4. `tx.create` the declarations record and every call; `tx.set(callSweepQueueRef, { battleId, nextExpiresAt, updatedAt }, { merge: true })` only in the non-empty branch.
The parent read is in the conflict set, so a completion committing between read and commit aborts the attempt; the retry re-reads `completed` → `parent_terminal`. The candidate is built outside retries; never `merge` on a call; never rewrite state/response/outcome.

**Phase wire and diagnostics (R3-8).** `cronState.declarationsPhase = { evalId, phase: 'written' | 'failed' }` — **the contract's two values only** — written after the outcome is known: `written` only after the transaction commit returned; on `parent_terminal`, `call_conflict`, `skipped_budget` or a thrown transaction → `failed`; on a **timeout**, a bounded existence re-read runs inside the deadline — absent → `failed`; present with identical canonical form → `written`; re-read impossible → the wire is **left unchanged** and the diagnostic records `unconfirmed`. Per-id results (`confirmed | rejected | unconfirmed`), reasons and timings go to bounded `cronState.callsDiag = { evalId, phaseResult, perId: [...≤ 8], removed: [...≤ 8], flips: {...} }` (diagnostics, not a reader wire) and to structured logs. Readers verify the wire's `evalId` matches the check they display. Capture references (`tickCapture.call({ callId, n, kind })`) from **confirmed** results only, before capture finalize (`:4366-4372`).

### 3.8 Encounter flips — per exit, transactional, cursor-rotated (R3-2–R3-6)
`runCallFlips(callsCtx)` runs at each `Flips? = yes` row of §3.4, after that exit's authoritative write, under §3.7's budget rule for its class. Requires `mode !== 'off'` and a usable observation for this exit.

**Query:** `calls` where `state == 'open'`, `orderBy('mintedAt','asc'), orderBy('__name__','asc')`, page 50, starting at the persisted cursor `cronState.callFlips.cursor` (a `{ mintedAt, callId }` pair; absent → collection start); pages continue until the deadline; on reaching the end, the cursor wraps to the start. **This query needs the composite index `calls: state ASC, mintedAt ASC, __name__ ASC` in `firestore.indexes.json`** (collection-scope; the reflection analogue is at `:219-236`); the deployment checklist deploys it before the shadow flip, and a startup validation runs the exact query once. After the scan: `cronState.callFlips = { evalId: evalIdentity?.evalId ?? null, cursor, scanned, total: null | n, complete }` — `total` only when a bounded count was obtained, else `null`; `complete: false` when the deadline interrupted. The next qualifying check resumes from `cursor` with **its own fresh observation** — never a previous check's instant.

**Per call, one transaction** re-reading the call and the parent:
- skip if not `open`, parent terminal, or `call.evalId === callsCtx.evalIdentity?.evalId` (never a hit on the minting check);
- skip if `observation.observedAtMs <= call.mintedAtMs`;
- `observedAtMs > expiresAtMs` → `expired_unresolved`;
- else if the symbol is in the observation and `side === 'above' ? px > level : px < level` → `hit`;
- on the **first observed transition** (`hit` or `expired_unresolved`), the same transaction `tx.create`s the companion receipt `agentBattles/{battleId}/callObservations/{callId}` = `{ callId, evalId: evalIdentity?.evalId ?? null, observedAtMs, px: number | null, source, replacedInPrompt: boolean }` and sets `outcome.receiptRef` to its path — the call wire is not widened (contract §4 `outcome` shape unchanged);
- `outcome.actedEvalId = evalId` **only on the model-result path with a committed executor result** (`callsCtx.executorResult`) that matches the call's whole declared trade: entry ↔ `symbolIn === call.symbol` and resolved `slotIndex`/`tier` match `call.slot`, and `symbolOut === call.counterpart` when a counterpart was declared; exit ↔ `symbolOut === call.symbol` and resolved slot match, and `symbolIn === call.counterpart` when declared; `pick` ↔ `symbolIn ∈ options`, `symbolOut === call.swapOut`, resolved slot match (selected-option binding when present). Same-symbol activity on another leg, another slot or another counterpart never counts; non-model exits never set it.
Immutable fields and `playerResponse` are never rewritten. Sequential transactions, ≤ 800 ms each.

### 3.9 Capture composition (R3-7)
`captureConfig.js`: keep `TICK_CAPTURE_SCHEMA_VERSION = 1`; add `TICK_CAPTURE_SCHEMA_VERSION_CALLS = 2`; `resolveCaptureSchema({ callsEnabled, pilotEnabled })` returns `{ version, includeCalls, includePilot }` per §2's table, computed **once** per tick and passed to both composers (`captureWriter.js:175,208` today read one constant). Pilot/combined rows: gated unavailable if no registration exists at the baseline. `captureSerializer.js`: `CALL_KINDS` exported and registered in `ENUM_LISTS`; container allowlist `'calls': 'array'`, `'calls.*': 'object'`; leaf allowlist `'calls.*.callId': 'id'`, `'calls.*.n': 'number'`, `'calls.*.kind': 'enum:CALL_KINDS'`. `captureContext.js`: `calls: []` + `call()` on live and NOOP interfaces; zero-based ordinals independent of action ordinals.

### 3.10 Rules and index
`firestore.rules`: `match /declarations/{evalId}`, `match /calls/{callId}`, `match /callObservations/{callId}` mirroring `intradayViews` (owner read via parent `get()`, `write: if false`); `callSweepQueue` top-level, deny all clients (the `agentEvalRuns` precedent, `:881-889`). Tests: `test/rules/{callsDenials,declarationsDenials,callObservationsDenials,callSweepQueueDenials}.rules.mjs`. `firestore.indexes.json`: the `calls` composite from §3.8; the `calls`/`declarations` client reads (Build 2) order by a single field and need none.

### 3.11 Files
`agentEvalToolSchema.js` · `api/_utils/callRecords/{mode,validate,observe,horizon,candidate,publish,flip,receipt}.js` · `api/cron/agent-evaluate.js` (context outside `try`; detached quote copies at the three fetch sites; observation at the model seam and at each §3.4 exit; executor result carried; admission reserve; the phase after `:4244`; flips at each `yes` exit; `tickCapture.call`) · `api/_utils/agentEvalTransport.js` (reserve parameter) · `api/_utils/tickCapture/{captureConfig,captureSerializer,captureContext,captureWriter}.js` · `firestore.rules` + four rules tests · `firestore.indexes.json` · `src/config/featureFlags.js` + `callRecordsFlags.test.js` · `api/_utils/__fixtures__/tickStampsHarness.js` (`CALLS_ENTRY_KEYS`, `makeDeclarations`, `makeObservation`, `makeExecutorResult`) · `agent-evaluate.tickStamps.callsOn.test.js` (new) · `intradayPromptExclusions.test.js` (+ row) · `vercel.json` schedule pin test · `compositionProtectedStoresAllowlist.json` rows only if the scanner cannot resolve a write site.

### 3.12 Tests — falsification, each mutation-checked
1. **Composition:** the four rows with every unrelated flag fixed; at off, byte-identical schema, every battle write on every exit, prompt bytes, both capture outputs; rollback fixture (existing calls/declarations/receipts/queue, mode off) → zero reads, zero writes; unavailable rows reported, not claimed.
2. **Per-mode keys:** absence at off on every entry-writing path; presence at shadow/on; `declarationsPhase` in `BASE_ENTRY_KEYS` → red.
3. **Quote shape:** the detached `{ current, fallback, fetchedAtMs }` passes/fails `isSettlementQuoteUsable` correctly; `px` projected from `current`; a fallback quote excluded; a forced-entry-price symbol observes its fetched quote with `replacedInPrompt: true`.
4. **Clock:** a later augmentation fetch straddling a call's expiry is observed at the exit's instant with `fetchedAtMs ≤ observedAtMs`, never with the initial health instant; each of the eight exits produces its own observation and instant; excluded paths produce none.
5. **Exit matrix:** budget-skipped, gameplan-pending, gameplan-created, proposal-pending, no-trigger, passive and transport-failed rows each flip without publishing; no-entry paths create no `evalId` and no phase key; `evalIdentity?.evalId ?? null` on every dereference.
6. **Budget:** model path skipped at `available < 4_000` with narration queued; a late gameplan exit with narration queued skipped at `available < 2_000`; deadlines clipped to the shared clock; late writes unconfirmed and unreferenced; admission 48,000 vs 44,000.
7. **Publication:** completion between parent read and commit → `parent_terminal`; late-timeout variant; identical retry idempotent; different payload → `call_conflict`; any `merge` on a call → red; declarations-only and all-invalidated → no queue read/write, existing queue untouched; mixed → correct minimum; pre-existing earlier queue value preserved.
8. **Phase wire:** only `written`/`failed` on the wire; `written` never before the commit returned; timeout → existence re-read decides, else the wire unchanged and `unconfirmed` in diagnostics.
9. **Flips:** never on the minting check; observation ≤ mint skipped; exact expiry; a stale `open` read cannot overwrite a completed/answered call; the receipt created atomically on the first transition and referenced by `outcome.receiptRef`; `actedEvalId` only on a whole-trade match (wrong-counterpart, wrong-slot, wrong-swapOut, opposite-leg, blocked-SWAP, proposal-only, capture-off each fail independently); cursor continuation across checks, wraparound, identical mint times, > 50 open calls, deadline interruption with `complete: false`, fresh observation per check.
10. **Index:** the exact server query validates against the committed index definition; removing the index entry → red.
11. **Horizon:** §3.5 fixtures; the `vercel.json` pin.
12. **Provenance/evidence:** legacy, `provenance_unresolved`, null, synthetic versioned; capture on/off evidence shapes; missing `promptBuiltAt` → `priceAsOf: null`.
13. **Rules:** owner reads `declarations`, `calls`, `callObservations`; everyone denied `callSweepQueue`; every write denied.

### 3.13 The reconciliation gate, review, report, shadow
**Before writing any code**, the builder re-verifies at its own HEAD and writes into the report: the seam map below; the helper shape (`isSettlementQuoteUsable`); the executor return fields; the eight exit paths; the index requirement; the presence or absence of a pilot capture registration. **Any conflict between this spec and HEAD is a STOP with the conflict stated — never an improvisation.**

| Operation | HEAD @ `fc3a072e` |
|---|---|
| calls/capture context outside `try` | `agent-evaluate.js:866-908` |
| initial fetch / required-quote gate | `:1004-1018` / `:1029-1042` |
| augmentation fetches | `:1403-1411`, `:2404-2411` |
| forced execution-price replacement | `:2232-2251` |
| prompt completion (`promptBuiltAt`) | `:2628-2634` |
| committed executor return consumed | `:3446-3463` (`agentSwapExecution.js:255-260,367-369`) |
| final evaluation update | `:4244` |
| narration dispatch / capture finalize | `:4276-4290` / `:4366-4372` |
| early exits | passive `:1086-1093` · proposal `:2104-2116` · gameplan-pending `:2295-2314` · gameplan-created `:2334-2361` · no-trigger `:2464-2483` · budget-skipped `:2555-2569` |

≥ 10 files → BUILD_RULES §2 multi-lens review with `vite build`; the schema extension reviewed as fenced-class. Report `docs/audits/<date>_BUILD0_CALL_RECORDS.md` repeats the pins (spec path + committed SHA, contract path + `7161e113…`, source baseline), the reconciliation table, the §1 intersection (∅), the composition proof, output-size and wall-time margins separately, the mutation table, and the deployment checklist (index before flip). Merge after 6 PM ET; deploy the index; flip to `shadow` next morning. **Shadow read (five sessions), labeled honestly:** records by kind/state per day; malformed and `invalidated` reasons; phase results; truncation events; `call_conflict` (expect 0); flip coverage and cursor progress; receipts per transition; and the known unresolved backlog — calls whose battles get no later check have no expiry repair until Build 1's worker.

## 4. Build 1 — mechanisms named
As V1.2 §4 (sweep worker in `process-pending-reflections.js` with its own query, index, paging and deadline; heard writer joining unsuppressed `heard.directiveThreadId` → `heardEvalId`; the in-memory `battle.__checkInstantMs` check instant read by `directiveUtils`; the idempotent re-ask emitter and second-answer legality; endpoint, directive family, shared slot writer, calls block, record-derived chat lines with the full answer/default → adjustment matrix and the contract §7 fixture failed layer by layer). The worker also drains the Build 0 shadow backlog and enrolls any open call lacking queue coverage before live enablement.

## 5. Build 2
As V1.2 §5, including `useDeclarations` (latest check by `evalSeq` desc, gated on records ∧ UI flags, torn down when disabled, `none | stale | malformed | unavailable`).

## 6. Sequence
Build 0 from this spec (§3.13 gate first) → §2 review → Astra branch review → merge → index → shadow → Build 1 → Build 2.
