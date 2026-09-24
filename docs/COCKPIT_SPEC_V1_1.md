# The Cockpit — Spec V1.1

**Date:** 2026-09-23 · **Author:** Fable · **Supersedes:** Spec V1 · **Written against:** Call Record Field Contract **V1.2** (blessed; SHA-256 in the docs PR) · **Folds:** Astra's Spec V1 review R-1–R-15 and its three discovery corrections; founder rulings CR-1–CR-16 (CR-3′, CR-13′ amended).
**Frame:** chat drives, cockpit acts, board shows. Every tile is born from a typed declaration; every action files honestly; the game never waits for the player; a receipt never claims what the check did not evaluate, hear, or do.

---

## 1. Builds and gates

| Build | Delivers | Size | Gates |
|---|---|---|---|
| **0** | flag-conditional `declarations` in the model output · validated declarations record · call writer after the evaluation commit · encounter observation · schedule resolver · `CALL_RECORDS_MODE` (shadow) · rules · capture v2 at shadow/on | M–L | none of Brief §8; starts after Astra round 2 |
| **1** | sweep worker · `POST /api/agent/call-response` · directive family with `until_ms` · shared slot writer · calls block · record-derived chat lines | L | **STOP until:** the deferred-beat PR is merged (its `agentEvalRuns` contract is the sweep's data); one shadow week of Build 0; B2 abandoned (CR-11) |
| **2** | pane tab · mobile Board ⇄ Cockpit · pills · tiles/sheets · research sheet (two outcomes) · tokens | L | Brief §8 (grounding `'on'`, the fit-check decision, held-position parity) · `CALL_RECORDS_MODE = 'on'` · Build 1 |

**Out of v1:** exit dials and fuse ticks (exit-dials arc); the Record glance (R-3); "flag for next deploy"; multi-directive (STOP-class); a prompt section teaching `declarations` (DR-13 follow-up if shadow quality is poor); Guarding tile data (R-14 — ships *unavailable*).

## 2. Flags and composition

| Flag | Values | Notes |
|---|---|---|
| `CALL_RECORDS_MODE` | `off` · `shadow` · `on` | string pin `src/config/callRecordsFlags.test.js` (direct value, mode list, pointer, runway comment); **never** a `DARK_BY_DESIGN` key (string modes are excluded there) |
| `COCKPIT_UI_ENABLED` | bool | Build 2; `DARK_BY_DESIGN` + pin |
| `SHOW_IT_ENABLED` | existing | gates Show It in the research sheet via `isShowItOn()`, not grounding |

**Composition (contract §9).** `CALL_RECORDS_MODE = 'off'` removes exactly the `declarations` contribution with every other flag fixed: no schema property, no `declarations/` or `calls/` reads/mints/flips/references, legacy capture shape and `TICK_CAPTURE_SCHEMA_VERSION = 1`, no phase stamp, no chip, no calls block. Both arcs' contributions off = HEAD baseline byte-identical (tool request, every battle write, prompt bytes, both capture outputs) against a frozen pre-change fixture with injected clocks/ids, plus a rollback fixture with existing `calls/` present (they freeze; nothing touches them at `off`).

## 3. Build 0

### 3.1 Schema — flag-conditional; the trade validator untouched (R-1, R-7)
`api/_utils/agentEvalToolSchema.js` exports `buildTradeDecisionTool({ declarations })`; `TRADE_DECISION_TOOL` = `buildTradeDecisionTool({ declarations: false })` so every import, pin and `validateTradeToolResult` (which captures that constant's schema once and iterates only its properties) are unchanged. The cron builds the tool with `declarations: CALL_RECORDS_MODE !== 'off'`. The property (contract §2) is typed `['object','null']`, never in `required`, descriptions free of `20-day`. **The calls validator is the only validation boundary for the block**; a bad block never fails the trade result into a fallback HOLD. Measure `m7e2eBudget` with `declarations: true` and state the margin.

### 3.2 Validated declarations block — per-kind mapping (R-2, R-7)
`api/_utils/callRecords/validate.js` → `{ validated, removed[] }`. Row rules:

| Source | Kind | Required | Optional / inapplicable | Malformed if |
|---|---|---|---|---|
| `calledShots[]`, `direction: 'entry'` | `called_shot` | `symbol, slot, condition{side,level}, horizonPhrase, defaultAction, said` | `counterpart` (the bench name it displaces); `expiresAtMs` only with `explicit` | any required field absent/wrong-typed; `explicit` without a valid `expiresAtMs` |
| `calledShots[]`, `direction: 'exit'`, `defaultAction: 'act'` | `confirmation` | as above | `counterpart` = the incoming name if declared | same |
| `calledShots[]`, `direction: 'exit'`, `defaultAction: 'hold'` | `called_shot` | as above | | same |
| `fork` | `pick` | `slot, swapOut, options[≥2]{symbol, why}, said` | no condition, no defaultAction (the agent's default is "picks at the next check"), horizon = `next_check` | fewer than two options; an option symbol not in the battle universe |
| `watching[]`, `playerAsk` | **not calls** — live on the declarations record only | | | `playerAsk` without ≥ 2 options |

Malformed rows are removed with a reason and never consume an ordinal; siblings survive; the accepted trade is untouched. A well-formed row whose symbol has no encounter observation (§3.3), whose `level` is non-finite, or whose level is implausible (|level − px| / px > 0.25) mints `invalidated` with the reason. Reason precedence: no-observation → non-finite → implausible. Caps: ≤ 6 shots, ≤ 6 watching, ≤ 4 fork options; excess rows removed with `cap_exceeded`.

### 3.3 Encounter observation (R-5)
`api/_utils/callRecords/observe.js` builds, once per check, `{ observedAt, source, symbols: { [sym]: { px } } }` from **the symbols the check actually examined with finite positive quotes** — the held names and the bench candidates whose quotes passed the check's own quote-health gate — never the global quote map (it holds opponent and macro symbols) and never stored prices. `observedAt` = `promptBuiltAt` for model checks; for non-model checks the check's own instant. This object is the sole input to §3.2's validity check and §3.6's flips, and it is recorded on the declarations record (`observation`) so a later reader can see what was examined.

### 3.4 Schedule and horizon resolver (R-6)
`api/_utils/callRecords/horizon.js` — pure. `nextEligibleSlot(afterMs)` = the first cron slot strictly after `afterMs` from a **schedule constant pinned against `vercel.json`'s evaluator entry** (a test fails if the cron expression changes), intersected with `getSessionForDate` regular-session bounds (nulls outside maintained years → `calendar_unavailable`). `resolveHorizon(phrase, { promptBuiltAt, battleExpiresAt, expiresAtMs? })` per contract §5; returns `{ expiresAt, basis }` or a malformed reason (`no_slot_before_battle_end`, `calendar_unavailable`, `explicit_invalid`). Never `lastCheckedAt + 15 min`; never `deriveDueAt`. Tests: seconds-offset prompts, DST, early close, close equality, holidays, final battle slot, unmaintained year, weekend mint → next session close.

### 3.5 Publication — after the evaluation commit, create-once, one deadline (F3, R-3, R-4)
Placement: **after the authoritative final update (`:4058`) commits and before capture finalization (`:4180`)**. The evaluation entry, written in that final update, carries `declarationsPhase: 'none' | 'expected'` (present only when `CALL_RECORDS_MODE !== 'off'`; `TIMING_ENTRY_KEYS`-style registration so the frozen golden and exact-key tests stay untouched at `off`).

Then, only if `expected`:
1. **Budget.** One aggregate deadline for the whole phase — `CALLS_PHASE_MS = 4_000`, reserved in the admission budget calculation before the model call; if less than that remains at `:4058`, the phase is skipped with `phase: 'skipped_budget'` (recorded in `cronState.declarationsPhase`) and the record is not written.
2. **Batch.** One `WriteBatch`: `tx.create(declarations/{evalId})` + `tx.create(calls/{callId})` × n. Create-once: on `ALREADY_EXISTS`, re-read; identical immutable payload → success (idempotent retry); different payload → typed `call_conflict`, the existing documents preserved, the conflict logged with both ids.
3. **Parent status.** The batch is preceded by a fresh read of the battle's `status`; if not `active` (completed between commit and phase), nothing is written and the phase records `parent_terminal`.
4. **Results.** Per-id `confirmed | rejected | unconfirmed` (a timeout is `unconfirmed`, never `failed`); typed counters; the phase never throws into the tick. `cronState.declarationsPhase = { evalId, phase: 'written' | 'failed' | 'unconfirmed' | 'skipped_budget' | 'parent_terminal' }` in a final bounded update.
5. **Capture references** recorded from **confirmed** results only: `tickCapture.call({ callId, n, kind })` before finalize; `unconfirmed` ids are not referenced (reconciliation: the Film Room's tape builder resolves them).

Fields at mint per contract §4: `evidence = { tickId: capture's tickId | null, availability: 'off' | 'unresolved', priceAsOf: promptBuiltAt }`; `hypothesisRef`/`origin` from the frozen `agentContext.equippedWatchlist` and `resolvedAgentManifest.equippedConfigHash` (versioned when a validated version field is present — none exists at HEAD; legacy when provenance without version; `provenance_unresolved` when provenance is present but unusable; null only when no equipped watchlist was ever frozen).

### 3.6 Encounter flips (R-5)
At each check with `CALL_RECORDS_MODE !== 'off'`, after §3.5, read the battle's `open` calls (one query, `limit 50`, inside the phase deadline) and, **per call, one transaction** that re-reads the call and the parent: if the call is no longer `open` or the parent is terminal → no-op; else if `observedAt > expiresAt` → `expired_unresolved`; else if the symbol has an observation and `side/level` is met (`>`/`<` against `px`) → `hit`, with `outcome.actedEvalId = evalId` only if this check's **committed** executor result acted on that symbol; else no-op. Immutable fields and `playerResponse` are never rewritten. No observation for the symbol → nothing (never a hit on an unexamined symbol). Non-model checks run flips with their own observation and instant.

### 3.7 Capture v2 — only at shadow/on (R-1, R-8)
`captureConfig.js`: `TICK_CAPTURE_SCHEMA_VERSION` stays `1`; add `TICK_CAPTURE_SCHEMA_VERSION_CALLS = 2`; the writer emits version 2 and the `calls` container **only when `CALL_RECORDS_MODE !== 'off'`**; both versions registered and both readable. `captureSerializer.js`: `CALL_KINDS` exported from the contract's kind set and registered in `ENUM_LISTS`; container allowlist `'calls': 'array'`, `'calls.*': 'object'`; leaf allowlist `'calls.*.callId': 'id'`, `'calls.*.n': 'number'`, `'calls.*.kind': 'enum:CALL_KINDS'`. `captureContext.js`: `calls: []` and a `call()` mutator on both the live and NOOP interfaces; call ordinals zero-based and independent of action ordinals.

### 3.8 Rules and tests to copy
`firestore.rules`: `match /declarations/{evalId}` and `match /calls/{callId}` mirroring the `intradayViews` block. `test/rules/callsDenials.rules.mjs` and `declarationsDenials.rules.mjs` copied from `intradayViewsDenials.rules.mjs`. No composite index (client orders by `mintedAt` only).

### 3.9 Files
`agentEvalToolSchema.js` · `api/_utils/callRecords/{validate,observe,horizon,mint,publish,flip}.js` · `api/cron/agent-evaluate.js` (budget reservation, `declarationsPhase` on the entry, the phase after `:4058`, flips, `tickCapture.call`) · `api/_utils/tickCapture/{captureConfig,captureSerializer,captureContext,captureWriter}.js` · `firestore.rules` + two rules tests · `src/config/featureFlags.js` + `callRecordsFlags.test.js` · `api/_utils/compositionProtectedStoresAllowlist.json` (rows for every new `create`/`update` site) · fixtures: `tickStampsHarness.js` (`makeDeclarations`), `intradayPromptExclusions.test.js` (+ row: the four prompt allowlists never admit `declarations`), `vercel.json` schedule pin test.

### 3.10 Tests — falsification, each mutation-checked
1. **Composition:** `off` → schema, every battle write, prompt bytes, both capture outputs byte-identical to the frozen fixture; rollback fixture with existing calls untouched. Removing the flag check in the schema builder / the capture writer / the phase gate each turns a row red.
2. **Create-once:** same-payload retry → success, one document set; different-payload retry → `call_conflict`, originals preserved; a `merge` write anywhere in the phase turns a row red.
3. **Failed before commit:** final update throws → no declarations record, no calls, entry absent; nothing to orphan.
4. **Parent terminal:** completion between commit and phase → nothing written, `parent_terminal` recorded.
5. **Budget:** phase skipped when < 4 s remain; a slow query + n writes stays under the deadline; a late write after timeout is `unconfirmed` and unreferenced.
6. **Validation:** the mapping table's malformed cases; a malformed row leaves siblings and the accepted SWAP unchanged; non-finite level → `invalidated`; symbol without observation → `invalidated`; caps.
7. **Observation:** an opponent/macro symbol in the global map is never observed; a failed bench quote yields no observation; non-model check → own instant.
8. **Horizon:** §3.4's cases; the `vercel.json` pin fails on a changed cron expression.
9. **Flips:** hit requires observation inside the horizon; expiry wins outside; a stale `open` read cannot overwrite a completed/answered call (transaction re-read); `actedEvalId` only with a committed executor result; blocked-SWAP and proposal-only checks never set it.
10. **`hypothesisRef`:** versioned / legacy / `provenance_unresolved` / null across four frozen contexts; a hash without a watchlist → unresolved, never initiative.
11. **Evidence:** capture on → `{ tickId, availability: 'unresolved' }`; capture off → `{ null, 'off' }`.
12. **Capture v2:** emitted only at shadow/on; `rejectedFields` empty for the new paths; version 1 byte-identical at `off`.
13. **Rules:** owner reads both subcollections; other user / privileged / anon denied; every write denied.

### 3.11 Review, report, shadow week
≥ 10 files → BUILD_RULES §2 multi-lens review with `vite build`; the schema extension reviewed as fenced-class. Report `docs/audits/<date>_BUILD0_CALL_RECORDS.md`: files with `file:line`, §1 intersection (∅), composition proof, budget margins (request tokens and wall time separately), mutation table. Merge after 6 PM ET; flip to `shadow` next morning. Shadow read after five sessions: records by kind and state per day, `invalidated` and malformed reasons, phase results, `hit` vs `expired_unresolved`, `call_conflict` count (expect 0), phase wall time P95.

## 4. Build 1 — STOP prerequisites, then scope

**Prerequisites (named):** (a) the deferred-beat PR merged — `agentEvalRuns/{runId}` with `deferredBattleIds` is the sweep's data; (b) Build 0 shadow read; (c) B2 abandoned.

1. **Sweep (R-9).** `callSweepQueue/{battleId}` (server-only collection; no battle-doc key) written **in the publication batch** with `nextExpiresAt = min(open expiresAt)`; a worker branch in an existing cron host (`process-pending-reflections` is the shape, but with its own query: `where nextExpiresAt <= now`, paged, deadline-bounded, running regardless of market state and reflection backlog) flips `expired_unresolved` transactionally and recomputes or deletes the queue document; `ended_with_battle` inside `completeBattle`'s transaction; hit outcomes preserved.
2. **Endpoint** per contract §7, mirroring `file-directive.js`'s transaction; per-`kind` answer legality; the `directive_pending` refusal writes only `refused`.
3. **Shared slot writer (R-10).** `api/_utils/writeDirectiveSlot.js` used by `chat.js`'s final commit, `file-directive.js` and the endpoint; transactional recheck of the pending call; "pending" from the thread's heard evidence (`heard.directiveThreadId` on evaluation stamps, `heardEvalId` on the call); expired/killed/suppressed/no-model distinguished; a documented response for an ordinary directive blocked by a pending call.
4. **Directive family and expiry (R-11, R-12).** `XX-hold-off`, `XX-ask-first`, `XX-pick` with `canonicalTemplate` + `getCanonicalTextFor(codeId, id, ctx)` where `ctx` binds symbol, slot, swap-out and the chosen option; parameterized ids excluded from the plain-menu renderer (`voiceLayerPrompt.js:2793-2799`) so nothing renders `undefined`; slot `{ expiry: 'until_ms', expiresAtMs, symbol, kind, callId }`; `until_ms` registered; activeness and heard resolved against the same check instant; `next_check` hold/ask active through the first check at or after `expiresAt`; the unknown-expiry fallback closed only after a census shows no production value changes. The four-layer fixture per contract §7 with each layer disagreeing independently.
5. **Chat (R-13).** At `on`, call-backed chat lines derived from records (one origin anchor per call, receipt anchors per answer, `said` as text; record-backed fallback when narration skipped); legacy anticipation path byte-identical at `off`/`shadow`; the calls block: open · hit-awaiting · last 5 resolved, 1,200-char cap, ordered by `mintedAt` desc, degrade to null; `chat.js` reads `calls` in the parallel prologue.

## 5. Build 2

1. **Geometry gated whole (R-15).** Behind `COCKPIT_UI_ENABLED`: root viewport height, min-height chain, overflow, the lifted turn strip, the horizontal track (native scroll-snap), vertical scrollers, safe-area/mark clearance, scroll-lock effects. At `false` the shipped geometry and state defaults execute exactly; desktop board pinned separately.
2. **Sections** computed from shell × flag (desktop pane: Cockpit first and default; mobile mark: Chat · Bench · Tape); selection repaired on resize/rollback; `useCalls` unsubscribes when disabled; `paneUnread` clears only when Chat is viewed; calls badge separate.
3. **Motion (CR-13′):** the slide on `motionToken('smooth')`, thumb via `layoutId`; reduced motion → `instant`; never a CSS transition.
4. **Tiles/sheets** per V3 §3–§5 and contract §6 mapping (add *Waiting · one call at a time* for `refused`); Monitoring ← `declarations.watching`; Research-objective ← `declarations.playerAsk`; **Guarding ← unavailable** ("arrives with the exit-dials release"); Earlier fold.
5. **Research sheet:** re-mounted `AssetResearchModal` with two outcomes (answer · ask in chat); Show It via `isShowItOn()`.
6. **Tokens:** seven `--ft-call-*` aliases (teal for filed/held, emerald acted, gold asking, muted expired, warning dropped) + `--ft-call-dot`; every new file in `GUARDED_FILES`; no hex.
7. **Tests:** mapping table; ordering; flag off → shipped screens byte-identical **and** scroll ownership/height unchanged (browser-level); reduced motion; rules read; chip/anchor round trip.

## 6. Review sequence
Astra round 2 on this spec (new session; the contract V1.2 SHA reported in its opening table) → fold → Build 0 prompt from §3 → build → §2 review → merge → shadow → Build 1 when its prerequisites are named as met → Build 2 when Brief §8 clears.
