# The Cockpit — Build 1a Spec V1.2: the answer loop (coaching model, narrowed)

**Date:** 2026-10-02 · **Author:** Fable · **Supersedes:** V1.1 (SHA `de2b994c…`). **Folds:** Astra round 2 (`docs/review-cockpit-build1-spec-v1-1`, B1R2-1–B1R2-14) and the founder's cuts of Oct 2: **no "held" receipt in 1a; no causal "in response to" until round 3; completion writes nothing to calls; a 1a tool text = D minus the deferred promises.** No third spec round (founder); the builder's gate (§14), the build's §2 review and Astra's branch review are the remaining nets.
**Contract of record:** `docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md` **plus Amendment B** (`CALL_RECORD_FIELD_CONTRACT_V1_4_AMENDMENT_B.md`, sent to the framework chat with this build; the build cannot merge until it is blessed).
**Frame:** chat drives, cockpit acts, board shows. A receipt never claims the agent observed, heard, or did something it didn't.

---

## 1. Scope

**Build 1a delivers (server-only, dark at `off`):** per-battle activation (§3) · the 1a tool text (§3) · copy and lint (§4) · `POST /api/agent/call-response` with `go`, `hold`, `go_now`, `pick`, `agree`, `disagree` (§5) · the call directive family and lifecycle (§6) · the shared slot writer (§6) · the heard writer and acted receipts (§7) · the sweep (§8) · the chat calls block (§9) · call events (§10) · the dormant response-fork hook (§11) · the rollback recipe (§12).
**Build 1b:** `ask`, `keep`, the re-ask, second answers, post-resolution action reconciliation, the "awaiting answer" chat class, the causal fork attribution.
**Out:** any screen; enforcement; the evaluation-prompt history block; the fork-nudge wording (round-3 replay).
**Fence:** no fenced-file edit is planned (gate confirms ∅ intersection); the tool text is model-visible and gets fenced-class coordinated review on the branch regardless of file path.

## 2. The receipt vocabulary (B1R2-1, B1R2-11)

Three facts, each from its own evidence; none inferred from another:

| Fact | Evidence | Line | Time shown |
|---|---|---|---|
| **heard** | committed entry `heard.directiveThreadId` (unsuppressed, `deriveHeardStamp`) equals the answer's thread | "Heard at the 10:15 check" | that check's `promptBuiltAt` |
| **acted** | the committed executor result of a check that heard the thread matches the call's whole trade (Build 0 §3.8 matcher, extended with the selected pick) | "The agent exited MU for NVDA at the 10:30 check" | "at the HH:MM check" (no executor timestamp exists) |
| **no matching trade at this check** | the check heard the thread **and** `callsCtx.executorResult` is a present, parsed result that does not match the call's affected leg (model path only) | "No matching trade recorded at the 10:30 check" | the check |
| **not confirmed** | none of the above (null/missing result, no-model exit, outside the window) | "Not confirmed heard" / nothing | — |

**There is no "held" fact in 1a.** A risk swap can remove the position before the prompt (`agent-evaluate.js:2012-2029`), and a null model-path result is unknown, not restraint. "Heard" means *in that check's prompt* (stamped even when transport fails, `agent-evaluate.js:2688-2693`), never comprehension or agreement. Late answers (`filedAt > promptBuiltAt`) are not heard by that check. A trade that predates the answer is a coincident action, never compliance or defiance. **Receipts in 1a cover a call through its resolution;** actions after a call is terminal are not reconciled to it (1b). Historical lines keep their own check times; no line is rewritten by a later one.

## 3. Flags, activation, off, the 1a text (B1R2-2, B1R2-5, B1R2-10)

| Flag | Ships | Pin |
|---|---|---|
| `CALL_RECORDS_MODE` | `off` | existing |
| `COCKPIT_ALLOWLIST_UIDS` (string[]) | `[]` | new pin (empty, pointer, runway) |
| `RESPONSE_FORK_ATTRIBUTION_ENABLED` | `false` | `DARK_BY_DESIGN` + pin (§11) |

**Activation.** `resolveCallRecordsMode(battle)` once per battle check after the authoritative load, on `battle.ownerId` (`agentBattleService.js:129-132`): global `off` → `off`; `shadow` → `shadow`; `on` → `on` iff `ownerId ∈ COCKPIT_ALLOWLIST_UIDS`, else `off`; malformed → `off`. Propagated to context/admission/tool/capture/hooks; two battles in one run never share a resolution. **Immediately after resolution and before `recordControlEpochIfNeeded` (`agent-evaluate.js:1691-1702`)** the cron attaches in memory `battle.__callsMode` and `battle.__checkInstantMs = Date.now()` (finite, frozen once, never persisted); the battle refresh at `:707-718` must preserve both (gate verifies), and hearing uses the exact prompt resolution.

**Off.** *Global `off`:* every calls code path returns before any calls I/O — cron hooks, endpoint (404 after the parent read), sweep (no queue/cursor/reconciliation reads). *Per-owner `off` (global `on`, owner not allowlisted):* the cron performs no calls I/O for that battle and the endpoint returns 404; **the sweep may read `callSweepQueue`/`callSweepState` rows (scheduling metadata) to discover and skip that battle, and reads/writes nothing else for it** — the one explicit exception, recorded in Amendment B §10. Records, receipts, events and queue work for that battle freeze until the owner is re-added. **Call-family directives are inactive at every reader:** `isDirectiveActive` (§6) requires both in-memory fields; voice (`voiceLayerPrompt.js:3199-3209, 3695-3711`) and any reader without them fail closed. **History windows:** `chat.js:664-675` and `voiceLayerGrounding.js:464-498` filter exchanges with `source === 'cockpit'` **before** slicing when resolved mode ≠ `on`; at `on` they are treated exactly as chip filings are today (null user text, excluded after the slice). The client projection (`deriveChatMessages.js`, `deriveReceipts.js`) is untouched in 1a: a player's own cockpit filing remains visible as history, which is honest; Build 2 adds the mode gate to the UI. **Rollback fixture (§15.1):** persisted call directive in the slot, its thread exchange, an answered open call, a hit, pending sweep work, an ordinary directive → prompt bytes equal the off golden, the ordinary directive rendered, the call directive absent, history windows identical to the pre-build window, zero call-store reads.

**Tool text.** `buildTradeDecisionTool({ declarations: 'off' | 'shadow' | 'on' })`; boolean callers migrated (`agentEvalToolSchema.js:368-379`, `agent-evaluate.js:2780`). Tests: `off` byte-identical to the base; `shadow`/`on` identical non-description structure, stripped declarations = base; `shadow` = BR-3/C2 text. **`on` = the 1a text:** D (`ARM_D_*`, moved into the schema module) with exactly two edits — block: "The player may answer Go or Hold off; an answer reaches you as a directive at a later check." (drops "Ask me first"); `playerAsk`: "Optional. A research question you want the player's view on, with 2 to 4 possible answers. Stored and shown to the player; no answer is expected in this version." Pin the 1a serialization's SHA-256 and length in the build report (D's experimental bytes remain the replay comparator, `2a90e67b…`, 13,565 chars); round 3 re-qualifies the 1a text against D's bars. The experiment script imports both from the schema module.

## 4. Copy and lint (`api/_utils/callRecords/copy.js`) (B1R2-11, B1R2-13)

**Renderers, by call kind and event, typed evidence only:**
- `renderCallLine(call)`: shot/confirmation → `${symbol} ${condition.side} ${fmtPrice(condition.level)} ${deadlineText}` with `deadlineText` from `horizon.basis`/`horizon.expiresAt` (`by the next check`; `by today's close` only when `expiresAt` is on today's ET session, else `by ${weekday}'s close`; `before the battle ends`; `by ${fmtTimeEt}`); pick → `${slot}: ${options.map(o => o.symbol).join(' or ')} for ${swapOut}` (a request line; **no intent line for picks**, whose `defaultAction` is null).
- `renderIntentLine(call)` (shots/confirmations only): `Intent: ${act ? (exit ? `exit${counterpart ? ` for ${counterpart}` : ''}` : `bring in${counterpart ? ` for ${counterpart}` : ''}`) : 'hold'}`; readers label it intent, never a promise.
- Event renderers: `declared` (≤ 3 call lines), `answered` (the answer and its canonical text), `heard` (§2), `acted` (from `symbolOut`/`symbolIn`, never from intent; "at the HH:MM check"), `no_matching_trade`, `expired` (`reason`), `ended_with_battle`, `superseded` (replacing thread and time).
- Formatter pinned: `src/utils/formatters.js:47-50`.

**Lint.** `saidPassesLint(said, basis)` = the round-2 regexes verbatim (`scripts/declarations-wording-experiment.mjs:376-397`; identity test). **Corpus built in the build session from the local raw records** `experiments/declarations-wording/raw/round2/` → `api/_utils/callRecords/__fixtures__/saidLintCorpus.json` = `{ said, basis, flagged, terms }` per minted called shot of arms D and D2 (agent text only; no player text; provenance: run id, counts 23 + 60 flagged, SHA-256 in the report). If the raw folder is absent, STOP. A lexical filter only; stated in the module. **Readers show a passing `said` only under the label "agent's own wording (unverified)"**, never as a tile or receipt assertion; a failing `said` is not shown.

## 5. The answer endpoint `POST /api/agent/call-response` (B1R2-2, B1R2-3, B1R2-14)

**Wire.** Body `{ battleId, callId, answer, pickSymbol?, expectedDirectiveThreadId }` (`answer ∈ { go, hold, go_now, pick, agree, disagree }`; `ask`/`keep` → `400 deferred`). `expectedDirectiveThreadId` = the client's view of `battle.directive?.directiveThreadId ?? null` (the chip's belief, `file-directive.js:181-188`). Responses: `200 { callId, playerResponse, directiveThreadId, event }`; `409 refused { reason, pendingDirectiveThreadId?, pendingCallId? }` with `reason ∈ { directive_pending, already_answered, expired, belief_mismatch, budget, parent_not_active }`; `404 cockpit_unavailable`; `403`; `400`; `429` (20/min/battle).

**Record.** `playerResponse = { answer, kind: 'directive' | 'ack', directiveThreadId?, callId, filedAt, heardEvalId? }`, create-once; the call's top-level `directiveThreadId` set to the same at acceptance; `refused = { at, reason, pendingDirectiveThreadId, pendingCallId? }` written only for `directive_pending`. **The selected pick lives in the directive's own record** (`action.pickSymbol`, §6), looked up by `playerResponse.directiveThreadId` — the thread exchange is durable even after the slot is replaced.

**Ordered decision table (one transaction, all reads first):**

| # | Step | Outcome if it fails |
|---|---|---|
| 1 | authenticate; read parent; `ownerId === uid` | 403 |
| 2 | `resolveCallRecordsMode(parent) === 'on'` | 404 (no call read) |
| 3 | read call; compute `answerId = ${callId}:answer:${answer}:${pickSymbol ?? ''}` | 400 if unknown call |
| 4 | **identical repeat** (`playerResponse` exists with the same normalized answer) → return the stored response and event; **no** lifecycle, belief, budget or pending checks | — |
| 5 | different existing answer | 409 `already_answered` |
| 6 | **ack rows** (`go` on act-default, `hold` on hold-default; `agree`/`disagree` on a pick whose terminal outcome shows the agent's own choice): state gate per row (open for the first two; terminal pick for the last two; allowed whether the parent is active or completed); write `playerResponse{kind:'ack'}` + `answered` event; no directive, no budget, no pending check | 409 `expired` if the deadline passed |
| 7 | **directive rows** (`hold` on act-default, `go_now` on hold-default, `pick` with `pickSymbol`): require call `open`, `horizon.expiresAt > now`, parent `status === 'active'`, `expectedDirectiveThreadId === parent.directive?.directiveThreadId ?? null`, registry validation (§6: stored action eligible now — symbol still held for an exit / slot still exists; pick option still in the universe and not held), agent/archetype binding as the chip (`file-directive.js:216-228`), `isCallDirectivePendingAt` (§6) false, budget (`file-directive.js:230-262`) | 409 `expired` / `parent_not_active` / `belief_mismatch` / `directive_pending` (+ `refused` written) / `budget`; 400 for an ineligible action |
| 8 | writes: `playerResponse{kind:'directive'}`, top-level `directiveThreadId`, the directive via the shared writer (§6), the `answered` event (§10), queue enrollment `pendingHeard += callId` (§8); **one message charged** | — |

## 6. The call directive family, lifecycle, shared writer (B1R2-2, B1R2-5, B1R2-6)

**Registry** `api/_utils/callRecords/callActions.js` (server-only): kinds `call_hold`, `call_go`, `call_pick`; canonical templates versioned `callActions.v1`, rendered from the stored call — literal text in Amendment B §12; never in `getAllowlist` (`archetypeAdjustments.js:265-305`) or any menu projection (byte-identity test).

**Slot and record.** `buildDirectiveSlot`/`buildDirectiveRecord` (`directiveFiling.js:29-60`) gain optional fields and keep every existing one; **the only thread key is `directiveThreadId`** (no alias): `{ ...existing, family: 'call', expiry: 'until_ms', expiresAtMs, basis, callId, kind, action: { direction, symbol, slot, counterpart?, pickSymbol?, swapOut? }, answerId, filedAt, textVersion: 'callActions.v1' }`.

**Lifetime (B1-7 amended).** `expiresAtMs = horizon.expiresAt`, and for `next_check` `horizon.expiresAt + 900_000`. **This is a bounded advisory lifetime, not an H2 guarantee:** the call stays H2-eligible regardless; a judgment after the lifetime may say "answer expired before this check" and never implies it was heard.

**Activeness.** `isDirectiveActive(directive, battle)` (`directiveUtils.js:38-79`): `family === 'call'` → active iff `Number.isFinite(battle.__checkInstantMs) && battle.__callsMode === 'on' && battle.__checkInstantMs <= expiresAtMs`; else inactive. Ordinary directives unchanged, including the unknown-expiry branch. **Endpoint pending predicate**, separate: `isCallDirectivePendingAt({ directive, mode, nowMs, killedIds })` → true iff `directive.family === 'call'`, `mode === 'on'`, `nowMs <= expiresAtMs`, thread not killed/suppressed, and `directive.callId !== thisCallId`.

**Consumption and retirement.** Hearing consumes nothing. A `call_go`/`call_pick` is retired by matched executor evidence (§7) or lifetime; a `call_hold` by lifetime. Retirement = compare-and-clear in a transaction on a fresh parent: clear only if `family === 'call' && directiveThreadId === thread && answerId === id`; never touch a newer slot. **Chat replacement keeps HEAD's latest-wins without client belief (behavior-preserving); chip keeps its belief check;** the shared writer stamps the replacing exchange with `supersedes: { directiveThreadId, at }` (additive, ordinary state) and, at `on`, writes a `superseded` event (§10); at off/shadow nothing else is touched. Killed/suppressed threads follow existing rules; no-model/failed checks consume nothing.

**Shared writer** `fileDirectiveTransactional(tx, battleRef, plan)`: the three chip writes (`file-directive.js:265-287`) from a pre-validated plan; chat and chip migrate behavior-preservingly (their own frozen fixtures incl. pending/belief; off golden not regenerated). The thread exchange carries `source: 'cockpit'` for call filings.

## 7. The heard writer and acted receipts (B1R2-4)

In the Build 0 model-path phase after the commit (resolved `on`), per affected call in one transaction: `playerResponse.heardEvalId = evalId` only if null (first-confirmed); the `heard` event; **acted:** Build 0's matcher with the selected pick passed (`flip.js:134-148`) → `outcome.actedEvalId` + `acted` event + retirement of a go/pick directive; **no matching trade:** only when the result is present and parsed (§2) → `no_matching_trade` event; null result → nothing. Scope: calls that are `open` or whose transition commits in this same phase; **post-terminal reconciliation is 1b**. Heard repair (sweep): scan the retained `evaluations[]` for the exact thread; stamp if null; not found → null ("not confirmed heard"); `TICK_STAMPS_ENABLED` false → never heard.

## 8. The sweep (B1R2-7, B1R2-8)

**Queue** `callSweepQueue/{battleId}` = `{ battleId, nextExpiresAt: number | null, pendingHeard: callId[], updatedAt }`; legacy Build 0 rows (`{battleId,nextExpiresAt,updatedAt}`) normalized on read. Enrolled atomically by publication (open calls) and the endpoint (`pendingHeard`); deleted only when `nextExpiresAt === null && pendingHeard.length === 0`, inside a transaction that re-reads the row (a stale pass cannot delete new work). **Completion writes nothing to calls** (B1R2-8): `completeBattle` is untouched; terminal parents are closed by the sweep's terminal rule, discovered via the queue and the reconciliation route.

**Traversal.** Order `nextExpiresAt ASC NULLS LAST, __name__ ASC` (index: single-field on `nextExpiresAt`; nulls handled by a second query on `nextExpiresAt == null` ordered by name); cursor `callSweepState/singleton = { lastNextExpiresAt, lastDocId, phase: 'due' | 'nullOnly' | 'reconcile' }`; deterministic wrap; frozen/off rows advance the cursor. **Reconciliation** (phase `reconcile`, paged): page `agentBattles` by `status ∈ {active, completed}` and `expiresAt >= now − 7d` (existing index or a named new single-field index), then per parent the existing `calls` composite (`state ASC, mintedAt ASC`) for open calls lacking a queue row → enroll. **Budget:** the branch runs last in `process-pending-reflections.js` with `deadline = min(now + 20_000, handlerStartMs + 45_000)`; every query/transaction bounded; deadline rechecked before each write; timed-out attempts unconfirmed (may commit late); best-effort progress, with the observable starvation condition logged (`[calls] sweep starved`) when the branch gets < 2 s.

**Transitions (per battle, resolved mode `on`; fresh transaction reads of parent, call, receipt, queue):** terminal parent → open calls → `ended_with_battle` (hit outcomes preserved); `this_session`/`this_battle`/`explicit` past deadline → `expired_unresolved`; **`next_check` → `expired_unresolved` with `reason: 'unobserved'` only when `maintenanceNowMs >= session(slot).closeMs`** (the regular ET session containing the slot; early closes; the next session when the slot falls there; calendar unresolvable → leave and log) and the call is still open under a fresh active parent; sweep receipts = the full receipt shape (`receipt.js:19-45`) with `source: 'sweep'`, `px: null`, `evalId: null`, `observedAtMs` = maintenance instant, `reason`; each transition creates its event in the same transaction; heard repair; retirement past lifetime (compare-and-clear).

## 9. The chat calls block (B1R2-12)

At resolved `on` only, chat's prologue `buildCallsBlock(battle)` from three bounded queries merged by call id: open calls (`state == 'open'`, `orderBy('mintedAt','desc')`, limit 6 — **new index** `calls: state ASC, mintedAt DESC`), resolved history (`state in ['hit','expired_unresolved','ended_with_battle']` via three queries on the same index, limit 5 each, merged and cut to the five newest), and the awaiting-answer class (**empty in 1a**, reserved). Each row: call id, `renderCallLine`, state, answer, and the §2 fact with its check time. ≤ 1,200 chars, whole-row truncation with "… n more"; priority: open, then history. Chat prompt bytes unchanged at off/shadow (frozen fixture).

## 10. Call events `agentBattles/{battleId}/callEvents/{eventId}` (B1R2-4, B1R2-11)

Deterministic ids: `${evalId}:declared`, `${callId}:answered:${answerId}`, `${callId}:heard:${evalId}`, `${callId}:acted:${evalId}`, `${callId}:no_match:${evalId}`, `${callId}:expired`, `${callId}:ended`, `${directiveThreadId}:superseded`. **Every event is created inside the transaction that commits its transition** (publication, endpoint, flip, heard writer, sweep) — no outbox, no repair needed. Shape `{ kind, at, callIds, text, saidOk, evidence: { evalId?, promptBuiltAt?, checkLabel? }, promptDirectiveThreadId? }`. Owner-read rules mirroring `calls`; server writes only. Build 2 merges them into chat; no event ever enters `chatExchanges[]`.

## 11. The response-fork hook, dormant (B1R2-9)

The `declared` event records `promptDirectiveThreadId = T` when the check's committed `heard` is an unsuppressed thread T, with text "Directive in this check's prompt: ${canonical(T)}" — **prompt inclusion, not causation**. The causal label ("In response to…") requires an explicit per-fork field in the declarations block (a round-3 schema+nudge change) and ships behind `RESPONSE_FORK_ATTRIBUTION_ENABLED` (false, pinned); 1a writes no causal field or text.

## 12. The rollback recipe (B1R2-§4)

Window: the last five regular ET sessions with calls-enabled model calls. Membership: entries with `declarationsPhase` present **and** finite `callMs` (dispatched call); numerator `haikuError.failureClass === 'invalid_tool_result'`; trip at > 3 %; zero-data → no trip; report the retained-window coverage. Script flag `--calls-enabled-window`.

## 13. Amendment B

`CALL_RECORD_FIELD_CONTRACT_V1_4_AMENDMENT_B.md` — the clauses this build changes or adds, for framework-chat blessing. The build may start before blessing and may not merge without it.

## 14. The reconciliation gate (builder, before any code; STOP on conflict)

Verify at HEAD with `file:line`: `ownerId` sites; resolver signature; the control-epoch call (`:1691-1702`) and battle refresh (`:707-718`); chat's plain update and chip's transaction, their exchange shapes and `directiveThreadId` usage; `directiveFiling` builders; `directiveUtils` activeness branches; voice's two directive reads; the two history windows; `deriveHeardStamp`/`composeTickStamps`; the Build 0 phase hooks and `executorResult` shape; `flip.js` matcher signature; `receipt.js` shape; `candidate.js` stored paths (`defaultAction: null` on picks); reflections handler budget and branch order; `completeBattle` (to be untouched); `firestore.indexes.json` existing `calls` composite; `ARM_D_*`; lint regexes; the raw round-2 folder exists locally; the fence list (∅).

## 15. Tests (falsification, mutation-checked)

1. Composition (four rows + allowlist row + neighbor isolation); off golden byte-identical; the §3 rollback fixture incl. history windows; endpoint 404 before any call read; global-off sweep performs zero reads.
2. Tool text: three-mode structure; `off` base-identical; 1a text pinned by hash; D bytes still reproducible for the replay.
3. Copy: stored paths; pick request line, no intent; next-session weekday; early close; every event renderer; acted never from intent. Lint: regex identity; the corpus, every label, counts 23/60.
4. Endpoint: every decision-table row in order, incl. identical repeat after hit without belief/budget, different answer 409, acks on completed parents, directive rows' guards, pick with ineligible option 400, `refused` written only for `directive_pending`, budget charged once, 429.
5. Family: menus byte-identical; templates; slot fields preserved; activeness requires finite instant + mode; inactive for voice; endpoint pending predicate; lifetime incl. `next_check` +15 min and the "expired before this check" wording; compare-and-clear on `directiveThreadId` + `answerId`; chat replacement without belief, chip with; `supersedes` stamped.
6. Heard/acted: first-confirmed; suppressed never; late answer not heard; acted with selected pick; `no_matching_trade` only with a present parsed result; null result → nothing; repair within the window; `TICK_STAMPS_ENABLED` false → never.
7. Sweep: traversal order and cursor phases; legacy row normalization; starvation log; terminal rule closes calls (completion untouched); the H2 cutoff with the real calendar (missed slot, late check, failed transaction, late commit, early close, DST, next-session slot, terminal race, check-vs-sweep race, calendar unresolvable); full-shape null receipts; deletion only when empty and re-read; reconciliation enrolls.
8. Chat block: three queries, merge, cap, priority; bytes unchanged at off/shadow; the new index declared.
9. Events: deterministic ids; created atomically with each transition (a failed transaction leaves no event); none in `chatExchanges[]`; `promptDirectiveThreadId` only from an unsuppressed heard; no causal text; attribution flag pinned false.
10. Rules/indexes: `callEvents` owner-read; queue/state server-only; both new indexes in `firestore.indexes.json` and the deployment checklist.
11. Rollback recipe on a seeded corpus.

## 16. Review, report, sequence

≥ 10 files → BUILD_RULES §2 multi-lens review with `vite build`; the 1a text is model-visible → coordinated fenced-class review on the branch (the branch review confirms the pinned hash and the exact two-sentence delta from D). Astra's branch review also runs the four-layer selected-pick proof (authenticated selection → committed response/slot/budget/event → model-visible canonical text in the next prompt → committed executor result or a present non-matching result). Report `docs/audits/<date>_BUILD1A_ANSWER_LOOP.md` with the pins (spec SHA, contract + Amendment B SHAs, 1a text hash, corpus hash), the gate table, files with `file:line`, composition proof, mutation table, review dispositions, deployment checklist (two indexes). Merge after 6 PM ET, after Amendment B is blessed; mode stays `off`.

**Rulings (approve-by-default):** B1-1 (activation; per-owner off scheduling exception) · B1-2 (decision table) · B1-3 (templates, Amendment B §12) · B1-4 (sweep; completion untouched) · B1-5 (events atomic in transitions) · B1-6 (rollback recipe) · B1-7 (bounded lifetime) · B1-8 (chat latest-wins preserved; chip belief preserved) · **B1-9 no "held" in 1a** · **B1-10 no causal attribution in 1a**.
