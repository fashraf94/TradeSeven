# Measured Trend Evidence, Slice 2 — build specification, draft V2 (consolidated)

**DRAFT FOR FOUNDER REVIEW.** Not a build card. Not authorization. Nothing in this document starts implementation.

Prepared 7 November 2026 by Claude Code (Claude Fable 5.1) for Flash, revising `20261107_P3_SLICE2_BUILD_SPEC_DRAFT_V1.md` under the founder's "Slice 2 focused specification revision" of 7 November. V1 and the discovery report `20261107_P3_SLICE2_INTEGRATION_DISCOVERY.md` stay beside this file as evidence; the resolution note `20261107_P3_SLICE2_V2_RESOLUTION_NOTE.md` maps each review issue to the sections and acceptance rows below. **Inspected commit:** `origin/main` `d503dd07` after a fresh `git fetch origin`; identical to the review's revision — **no drift**. Every line reference is at that commit and drifts; the build re-verifies each anchor at its own HEAD (BUILD_RULES §3).

---

## 0. Status and the three milestones

| Milestone | What it needs | What it yields |
|---|---|---|
| **1. Specification acceptance** | The founder reviews §14 (remaining decisions) and accepts or amends this draft. | A spec the build is held to. |
| **2. Disabled implementation** | The founder's start instruction naming the accepted spec (§15). **D-6 (the budget authority) is not required for this milestone.** | A draft PR, pushed, flag `false`, no production acquisition, no production read. Delivery ends at pushed (BUILD_RULES §2). |
| **3. Production activation** | Separately: (a) ID-1's first census week recorded complete by the founder, (b) D-6 resolved, (c) the founder's own flip PR. Calendar time alone opens nothing. | Labels on the allowlisted owners' Trend Follower battles' tick records; the tenant acquiring. |

**Architecture (supported by the review, preserved here):** the shared `setupEvidence` store; a server-only observation on the existing permanent tick record; a separately gated acquisition tenant after the ID-1 observer; agent decisions unchanged.

---

## 1. Behaviour, in plain terms

On every evaluation tick of an in-scope Trend Follower battle, the moment the tick has settled which names it offers the agent, Slice 2 **freezes** that list and the tick's clock reading — no reads, no waiting. The tick then makes its decision exactly as today. Afterwards, while the tick is doing its own remaining writes, Slice 2 **looks up** each frozen name in the shared setup-evidence store for the last completed session before the freeze instant, and, just before the tick's permanent record is written, attaches what it found as **labels**: `valid`, `invalid(reason)`, `unknown(reason)`, a refused snapshot, or an honest **absent**. A label that did not arrive in time is recorded as unsettled, never waited for and never patched in later. The agent is shown none of it; nothing about which names are offered, in what order, or what the agent does with them changes.

Separately, a bounded tenant of the reflections cron keeps the store supplied for the names on each in-scope battle's hot bench: at most twelve store requests a run, three at a time, each awaited to its end; a name is retried only when a retry can succeed under the store's own confirmation rule, and at most three times in a session, enforced by a reservation written before each request.

Shipped with the flag off, neither part reads or writes anything, the tick's permanent record and the cron's response are byte-identical to today's, and the capture context's new method is an inert no-op.

---

## 2. Scope

**Eligible population.** Tiered BaggerBomb battles (`gameMode` absent, `null` or `baggerbomb_agent`), the owner's agent side, `agentContext.archetype === 'momentum_chaser'`, not CPU, not a training clone, not a tournament battle — `activationEvidence/scope.js` `scopeOf`, reused (D-4) — **and** an owner on the cockpit allowlist (`COCKPIT_ALLOWLIST_UIDS`, read at call time). Everything else: no read, no block, counted.

**Preserved unchanged.** Other archetypes, CPU sides, training clones, tournament and other modes · the deploy menu (fenced `decide.js:657-690` → `createAgentBattle`) · `archetypeCandidateMenu.js` · the legacy fallback · `hotBenchAssetMap` · the bench merge · scoring, validation, execution · every prompt · the battle document's `watchlist` · the client · the model-admission decision and every budget test the tick already makes.

**Not built.** Monitoring labels (D-3) · acquisition for catalyst additions · a holding reader · activation repair · cross-battle inheritance · any script, endpoint or manual path that reaches `getOrAcquireSnapshot` (A1) · any change to the store's runtime modules, the evaluator, the golden, the observer or any fenced file · a global daily request budget system · Practice Field, ID-4, ID-6, P4, filtering, new archetype rules.

---

## 3. Files

### 3.1 New (each file that names the store is registered in the import guard by exact path; §3.2)

| File | Purpose |
|---|---|
| `src/config/setupMenuLabelsFlags.js` | `export const SETUP_MENU_LABELS_ENABLED = false;` with a `// Pinned by:` pointer; its own module for the entry-chunk reason `activationEvidenceFlags.js:6-9` gives; no imports. |
| `src/config/setupMenuLabelsFlags.test.js` | The pin row and the registration row. |
| `api/_utils/setupMenuLabels/constants.js` | Numbers and closed lists (§4, §6, §7). Restates the store's `ACQUIRE_TIMEOUT_MS` (5 s), `LEASE_MS` (120 s) and `CONFIRM_AFTER_MS` (30 min); `constants.test.js` pins them equal to `acquire.js:42`, `store.js:35`, `store.js:37`. |
| `api/_utils/setupMenuLabels/gate.js` | Flag AND allowlist, read at call time, never throwing (the shape of `activationEvidence/gate.js`). |
| `api/_utils/setupMenuLabels/pool.js` | **Pure.** `freezeSetupMenuPool(...)` (§4.2): dedup, order, source tags, dispatched flags, session from the freeze instant. No I/O. |
| `api/_utils/setupMenuLabels/reads.js` | `startSetupMenuReads(...)` and `settleSetupMenuReads(...)` (§4.3–§4.4). Imports `readSnapshot`, `snapshotIdOf` from the store, `isCryptoSymbol`, the state reader. Never imports `getOrAcquireSnapshot`. |
| `api/_utils/setupMenuLabels/compose.js` | **Pure.** `composeSetupMenuBlock(pool, results, limits)` (§5): validates every value against the closed lists, caps count and bytes, never throws past its own boundary. |
| `api/_utils/setupMenuLabels/state.js` | `setupMenuLabelState/main`: read, normalise, the reservation and outcome transactions, the end-of-run cursor write (§6.5). |
| `api/_utils/setupMenuLabels/tenant.js` | `runSetupMenuAcquisition({ db, handlerStartMs, now, fetchPayload, instrument })` (§6). **The only production caller of `getOrAcquireSnapshot` in Slice 2.** |
| `api/_utils/setupMenuLabels/__fixtures__/menuSnapshots.js` | Real snapshot documents built through `acquire.js` on synthetic bars (the `activationSnapshots.js` precedent): `valid`, `invalid(no_setup)`, `invalid(regime)`, `unknown(missing_fact)`, a refused `insufficient_history`, one under another triple, one malformed. |
| `api/_utils/setupMenuLabels/*.test.js` | Unit rows (§10). |
| `api/cron/agent-evaluate.setupMenuLabels.test.js` | Through `processAgentBattle` with the tick harness (`tickStampsHarness.js`; its `marketDataCache.js` mock must spread `importOriginal`, since the store's key module needs `isCryptoSymbol` and `toEtParts`). |
| `api/cron/process-pending-reflections.setupMenuLabels.test.js` | The seventh seat (§8). |
| `test/rules/setupMenuLabelsDenials.rules.mjs` | Client denials: `setupMenuLabelState`, and a tick record carrying the block. |
| `test/rules/setupMenuLabelsTenant.rules.mjs` | The tenant against the emulator with the real store underneath (the `activationObserver.rules.mjs` precedent): the reservation protocol, lease reuse, the confirmation interval, the attempt cap under overlap. |
| `scripts/census-setup-menu-labels.mjs` + `.test.js` | **Read-only** census over the cohort's tick records (through the export's read path) and the state document: aggregates only; imports pure modules only; its test pins that `getOrAcquireSnapshot`, the tenant and the state writer are never imported. |
| `docs/audits/<date>_BUILD_SETUP_MENU_LABELS.md` | The build report (§12). |

### 3.2 Edited (each change named)

| File | Change |
|---|---|
| `api/cron/agent-evaluate.js` | (1) A `let setupMenuReads = null;` beside `pendingNarrations` (`:1060`). (2) In the existing universe-capture `captureStep` at `:2898-2906`: the **freeze** call (pure; §4.2). (3) Two **read-start** calls (§4.3): the first statement of the `!shouldEvaluate` branch (`:2908`) and the statement after `const budget = shouldStartHaikuCall(...)` (`:3013`). (4) In the `finally`, immediately before `finalizeTickCapture` (`:5037`): the **settle** call (§4.4). Each inside `captureStep` / its async twin, isolated. **Must not name the store's path, even in a comment** (the guard scans comments, `setupEvidenceImportGuard.test.js:8-14`). |
| `api/cron/process-pending-reflections.js` | One import; step 9 after the observer in an isolating try/catch; the response spreads `setupMenuLabels` only when not skipped (`:312-339` pattern). `TIME_BUDGET_MS` and every earlier tenant untouched. |
| `api/_utils/tickCapture/captureContext.js` | `'setupMenu'` added to `NOOP_METHODS` (`:102-109`) so the inert context has the method; a guarded `setupMenu(block)` fact setter on the live context (last call wins; §4.5). |
| `api/_utils/tickCapture/captureConfig.js` | The closed lists of §5.2, registered in `ENUM_LISTS` (`captureSerializer.js:50-54` imports them); the RD-1 citation naming this build's ruling (D-2) beside `risk.stagnation`'s (`:37-45`). No version bump. |
| `api/_utils/tickCapture/captureSerializer.js` | The declared paths of §5.2 (leaves, containers; **no new `PERMANENT_KEY_KINDS` entry** — the block is an array). No change to `ID_RE`, `SYMBOL_RE` or the admission policy. |
| `api/_utils/tickCapture/captureWriter.js` | Composition: `...(state.setupMenu ? { setupMenu: state.setupMenu } : {})` (the conditional-spread pattern at `:283`), so the key is absent when no fact was set. |
| `api/_utils/tickCapture/*.test.js` | Rows for the new paths, admission, absence when unset, the dotted-symbol round trip (§10). |
| **`api/_utils/setupEvidence/setupEvidenceImportGuard.test.js`** | **The one permitted edit under `api/_utils/setupEvidence/`:** entries added to `ALLOWED_OUTSIDE` (`:33-48`), by exact filename, one reason line each, for every new file that names the store (`reads.js`, `tenant.js`, the fixtures, their tests, the two emulator suites, the census and its test). Nothing else in that file changes; **no runtime module under `api/_utils/setupEvidence/` changes**, and the guard's own six-module pin (`:99-101`) proves it. |
| `src/config/flagPinGuard.test.js` | `FLAG_SOURCE_MODULES` (`:45-53`) gains the flag module; `DARK_BY_DESIGN` gains `SETUP_MENU_LABELS_ENABLED` with its runway text. |
| `firestore.rules` | `match /setupMenuLabelState/{name} { allow read, write: if false; }`. |
| `firestore.indexes.json` | Single-field exemption for `setupMenuLabelState.attempts` (a map; the observer-state precedent). No composite index: the tenant's query is equality-only (`ownerId ==`, `status ==`); ASSUMED sufficient, confirmed on the first production run. |
| `docs/README.md` | One row for the build report. |

### 3.3 Never edited
The BUILD_RULES §1 fence list · the six runtime modules under `api/_utils/setupEvidence/` (`acquire.js`, `classify.js`, `index.js`, `key.js`, `sessionAt.js`, `store.js`) · `api/_utils/setupEvaluator/*` · `api/_utils/activationEvidence/*` · `api/_utils/archetypeCandidateMenu.js` · `src/config/featureFlags.js` · `vercel.json` · the V1.9 contract · the setup definition · `TIME_BUDGET_MS`, `shouldStartHaikuCall` and its constants, `TICK_CAPTURE_*` constants.

The diff exceeds ten files: the BUILD_RULES §2 review is **mandatory** (§11).

---

## 4. The observation lifecycle inside a tick (issue 1)

### 4.1 Three sets and four tick classes (D-1)

The tick's own code establishes three different symbol sets (all VERIFIED at `d503dd07`):

| Set | Definition | Where |
|---|---|---|
| **P — the candidate pool** | `[...hotBenchSymbols, ...Object.keys(hotBenchAssetMap)]`, the list the universe capture records. `hotBenchAssetMap`'s keys are the hot-bench names not already benched and not held (`agent-evaluate.js:1694-1707`) plus up to five catalyst additions (`:2831-2846`), so the list **overlaps itself**: every asset-map hot-bench key is already in `hotBenchSymbols`. | `:2898-2906` |
| **M — the model's bench input** | The symbols of `battle.portfolio.bench` at prompt build: the original bench stocks, the merged hot-bench assets (`:1710-1716`), the catalyst additions, and the bench crypto. The fenced assembler renders exactly this object (`buildBenchCSV(battle.portfolio?.bench, …)`, `buildBenchTechnicalBlock(battle.portfolio?.bench, …)`, `agentEvalPromptAssembly.js:1167-1172`, read only). Between the freeze and the prompt build only the pure crypto-slot verdict runs (`:2943-2956`), so **M at the freeze equals M at the prompt**. | `:3095-3125` |
| **X — the pick** | `decision.originalSymbolIn` / `decision.finalSymbolIn` and `actions[].symbolIn` with `actions[].source` (`haiku`, `risk_manager`, `archetype`, `guardrail`, …; `captureConfig.js:219-228`) and `actions[].committed`. | the tick record |

Relations: **P ∩ M** = the asset-map keys (hot-bench names not held or benched, plus catalysts). **P \ M** = hot-bench names that are held (excluded from the merge at `:1697`) or already in the original bench. **M \ P** = the original bench and the bench crypto. Slice 2 labels **P** (the candidate menu) and records, per name, whether it was in **M** (`inDispatchedBench`), so the measurement can restrict to names the model actually saw.

Tick classes (all recorded by existing fields): **model-dispatched** (`model.dispatched = true`); **model attempted, not dispatched** (build timeout, transport failure); **not attempted** — `exitReason` `no_trigger` (`:2908-2941`), `budget_skipped` / `refresh_failed` (`:3014-3060`); **exited before the pool existed** — `degraded_quotes`, `cpu_passive`, `proposal_pending`, `gameplan_*` (`:1216`, `:1485`, `:2609`, `:2655-2797`): no pool, no universe, **no block**. A block therefore exists exactly when the universe capture ran.

### 4.2 Step 1 — FREEZE, no I/O (`:2898-2906`, inside the existing `captureStep`)

```
tickCapture.setupMenu(freezeSetupMenuPool({
  hotBenchSymbols, assetMapKeys: Object.keys(hotBenchAssetMap),
  dispatchedBenchSymbols: flattenBenchServer(battle.portfolio?.bench).map(a => a.symbol),
  rebuilt, selector, frozenAtMs: Date.now(), battle,
  isTournament: Boolean(tournamentCtx),   // the same test the menu helper makes (archetypeCandidateMenu.js:18)
}))
```

`freezeSetupMenuPool` is pure: gate and scope first (flag off, owner not allowlisted, `scopeOf` false, tournament → returns `null`, and `setupMenu(null)` sets nothing, so the record is byte-identical); otherwise it returns a **pool block** (§5.1) with `blockStatus: 'reads_unsettled'`, every candidate `status: 'read_unsettled'`, `session = lastCompletedSessionAt(frozenAtMs)` (the calendar's tables; no I/O — not ok → `blockStatus: 'calendar_missing'` and no reads will start), the deployed triple from `describeRuleSet()`, `selector`, `rebuilt`, `frozenAt`. `rebuilt` and `selector` are the tick's own facts: `rebuilt` is whether the refresh at `:1577` ran this tick; `selector` is `'archetype'` when `archetypeMenu` was non-null (`:1585`), `'legacy'` when the fallback ran, `'carried'` on a non-rebuild tick. The pool fact alone already yields a complete, honest record if nothing else happens.

### 4.3 Step 2 — START READS, after the decision, overlapping existing awaited work

`setupMenuReads = startSetupMenuReads({ db, tickCapture, runMemo, nowMs })` at **two** sites, each strictly after the point it could have influenced:

- the first statement of the `!shouldEvaluate` branch (`:2908`): the trigger gate has decided there is no model call; the reads overlap the branch's own `await battleRef.update(scoreUpdate)` (`:2931`) and the exit calls hook;
- the statement after `const budget = shouldStartHaikuCall({ elapsedMs, timeBudgetMs, callsReserveMs })` (`:3013`): the admission decision is computed from `Date.now()` **before** any Slice 2 read exists; the reads then overlap the model call (`refresh_failed` and `budget_skipped` branches included).

The function returns `null` and starts nothing when the capture context is inert (`tickCapture.enabled !== true`), when no pool fact was set, or when the pool's `blockStatus` is `calendar_missing`. Otherwise it starts, **un-awaited**:

- `deadlineAt = startMs + LABEL_READ_DEADLINE_MS (3_000)` — **one absolute deadline for every optional read, the state read included**;
- one read of `setupMenuLabelState/main` (memoized per handler run in `runMemo`, so one read per run, not per tick);
- for each candidate, in order: `isCryptoSymbol` → `excluded` (no read); `snapshotIdOf` throws → `symbol_form` (no read); otherwise `readSnapshot({ db, session, symbol, ruleSet })`, memoized per run by snapshot id, at most `LABEL_READ_CONCURRENCY (5)` in flight;
- each read settles into a results map; a read that rejects settles as `read_failed`; the map is **sealed** at `deadlineAt` by a timer, and any result arriving after the seal is dropped.

No budget floor gates the start: the reads are concurrent and side-effect-free, and nothing waits on them here. The pool fact's `readsStartedAt` is stamped.

### 4.4 Step 3 — SETTLE, at the capture stage, bounded and budget-aware

In the `finally`, immediately before `finalizeTickCapture` (`:5037`), inside the async twin of `captureStep`:

```
await settleSetupMenuReads(setupMenuReads, tickCapture, {
  remainingBudgetMs: TIME_BUDGET_MS - (Date.now() - cronStartTime),
})
```

1. **Wait policy.** Wait for the results map only while **all three** hold: the absolute deadline has not passed; the wait so far is under `LABEL_SETTLE_WAIT_MS (500)`; and `remainingBudgetMs − waitedSoFar > TICK_CAPTURE_MIN_REMAINING_BUDGET_MS (10_000) + TICK_CAPTURE_DEADLINE_MS (3_000)`. On a model tick the reads settled tens of seconds earlier and the wait is zero; on a no-trigger tick they normally settled during the exit's own awaited write. **The capture's own floor and commit deadline can never be consumed by this wait** (the third condition), and the wait is at most 500 ms, recorded as `settleWaitMs`.
2. **Compose once.** `composeSetupMenuBlock(pool, resultsSnapshot, limits)` (§5) runs on a **copy** of the results map taken at that instant; unsettled candidates are `read_unsettled`, and the block's `observedAt` is that instant. The block is passed to `tickCapture.setupMenu(block)`, replacing the pool fact.
3. **Late results are discarded.** The read promises keep settling into their own map, which nothing reads again; the block handed to the context is a frozen object; the writer serialises it once. No late result alters the recorded block, and no read ever holds up `finalizeTickCapture`.
4. **Error exits.** A `tick_error` exit skips this step (the handler finalises such ticks itself, `:5172`); the record then carries the pool fact as set in step 1 — honest `reads_unsettled`.

The whole step is inside the capture guard: a thrown error here is recorded as the context's `faulted` text (`captureContext.js:176-180`) and the tick is unchanged.

### 4.5 Honest timing on the record

`frozenAt` is the decision-time reference (the session is derived from it); `readsStartedAt` and `observedAt` say when the evidence was looked up; each label carries the snapshot's own `capturedAt` and `predatesFreeze = capturedAt < frozenAt`. A snapshot the tenant finalised between the freeze and the read reads `predatesFreeze: false`. **None of these fields means the agent saw the label**: the prompt is built from `battle.portfolio.bench` and the labels never enter it (§4.1).

---

## 5. The record block (issues 5 and 6)

### 5.1 Shape — an **array** of candidates, not a symbol-keyed map

The serializer resolves declared paths by splitting on `.` and substituting `*` for whole segments (`pathProbes`, `captureSerializer.js:308-323`), so a symbol **key** `BRK.B` under a wildcard container becomes two segments and the whole label is rejected as `undeclared_path` (this is a property of the existing design; `risk.verdicts` shares it). The block therefore carries each symbol as a **value** (`symbol` kind, `SYMBOL_RE` admits `BRK.B`, `:58`) in an ordered array, and needs **no** `PERMANENT_KEY_KINDS` entry.

```
setupMenu: {
  blockStatus,                      // enum: ok | truncated | reads_unsettled | calendar_missing | error
  errorCode,                        // id | null (blockStatus error only)
  session, setupVersion, thresholdsHash, semanticsId,   // id ×4 (the triple as three fields: the combined
                                    //   rule key and the snapshot id contain '~', which ID_RE refuses, :56)
  selector,                         // enum: archetype | legacy | carried
  rebuilt,                          // bool
  frozenAt, readsStartedAt, observedAt,                 // timestamp (readsStartedAt/observedAt null until set)
  settleWaitMs, readMs,             // number
  stateRead,                        // bool — Slice 2's state document settled in time
  presentedCount, uniqueCount, omittedCount, truncatedCount,   // number
  counts: { labelled, refused, absent, excluded, symbolForm, stale, failed, unsettled },  // number
  candidates: [ Candidate, … ]      // ≤ SETUP_MENU_MAX_CANDIDATES, in presentation order
}

Candidate: {
  symbol,                           // symbol
  source,                           // enum: hotbench | catalyst
  inDispatchedBench,                // bool — symbol ∈ M at the freeze (§4.1)
  status,                           // enum: labelled | refused | absent | excluded | symbol_form | stale_snapshot | read_failed | read_unsettled
  verdict, reason, pattern, regime, // enum | id | enum | enum (null unless labelled/refused)
  asOf, barsClass, capturedAt, predatesFreeze, snapshotStatus,   // id | enum | timestamp | bool | enum (null unless labelled/refused)
  s2Attempts, s2LastOutcome, s2LastAt, s2Exhausted            // number | enum | timestamp | bool — Slice 2's OWN history only (§7.3); null when the state read did not settle
}
```

**`blockStatus` precedence.** Several conditions can hold at once; the field reports the highest in this order: `error` > `calendar_missing` > `truncated` > `reads_unsettled` > `ok`. The lower-priority facts stay visible through their own counters (`truncatedCount`, `omittedCount`, `counts.unsettled`), so a `truncated` block with unsettled reads still shows how many were unsettled.

**Deterministic deduplication.** `uniqueCount` candidates = the first occurrence of each symbol in P's order (`hotBenchSymbols` first, then the asset-map keys, so a hot-bench name tagged `hotbench` is never re-tagged `catalyst`); `presentedCount` is P's raw length. **The real candidate list and its order are not changed anywhere**: the dedup exists only inside the block.

**Bounds.** `SETUP_MENU_MAX_CANDIDATES = 48` (the hot bench is at most `max(20, E)`, `archetypeCandidateMenu.js:30-46`, plus five catalysts; 48 leaves headroom for `E` up to 43 — `E`, the equipped-in-universe count, has **no code cap** (searched: `watchlistEquip.js`, `api/forge/watchlists.js`, `src/constants/`), so the cap is Slice 2's own). Candidates beyond the cap, in presentation order, are **omitted** and counted in `omittedCount`. `SETUP_MENU_MAX_BYTES = 24 × 1024`, measured on the composed block with the writer's `approxBytes` (`captureWriter.js:76-78`); over it, candidates are dropped from the tail until under, counted in `truncatedCount`, `blockStatus: 'truncated'`. Worst case per candidate ≈ 420 bytes → 48 candidates ≈ 20 KiB; the block stays far from the 1 MiB document limit and from the writer's 700 KiB shed threshold (`TICK_CAPTURE_BODY_DOC_MAX_BYTES`, which sheds **body** fields only — a permanent record that outgrew it would fail the batch, which is exactly why the block bounds itself).

**Cost, stated accurately.** No additional document writes (the block rides the existing batch at `captureWriter.js:581-584`). Additional bytes on the permanent record (≤ 24 KiB). Additional Firestore **reads** per tick: ≤ `uniqueCount` snapshot reads (memoized per run) plus one state read per run. Additional wall time: the settle wait, ≤ 500 ms, budget-gated (§4.4).

### 5.2 Declared paths and lists

Leaves (`PERMANENT_FIELD_KINDS`): `setupMenu.blockStatus: enum:SETUP_MENU_BLOCK_STATUSES` · `setupMenu.errorCode: id` · `setupMenu.session|setupVersion|thresholdsHash|semanticsId: id` · `setupMenu.selector: enum:SETUP_MENU_SELECTORS` · `setupMenu.rebuilt: bool` · `setupMenu.frozenAt|readsStartedAt|observedAt: timestamp` · `setupMenu.settleWaitMs|readMs|presentedCount|uniqueCount|omittedCount|truncatedCount: number` · `setupMenu.counts.{labelled,refused,absent,excluded,symbolForm,stale,failed,unsettled}: number` · `setupMenu.candidates.*.symbol: symbol` · `.source: enum:SETUP_MENU_SOURCES` · `.inDispatchedBench: bool` · `.status: enum:SETUP_LABEL_STATUSES` · `.verdict: enum:SETUP_VERDICTS` · `.reason: id` · `.pattern: enum:SETUP_PATTERNS` · `.regime: enum:SETUP_REGIMES` · `.asOf: id` · `.barsClass: enum:SETUP_BARS_CLASSES` · `.capturedAt: timestamp` · `.predatesFreeze: bool` · `.snapshotStatus: enum:SETUP_SNAPSHOT_STATUSES` · `.s2Attempts: number` · `.s2LastOutcome: enum:SETUP_S2_OUTCOMES` · `.s2LastAt: timestamp` · `.s2Exhausted: bool`.

Containers (`PERMANENT_CONTAINER_KINDS`): `setupMenu: object` · `setupMenu.counts: object` · `setupMenu.candidates: array` · `setupMenu.candidates.*: object`. **No key kind.**

Lists (`captureConfig.js`, zero product imports; registered in `ENUM_LISTS`; pinned equal to Slice 2's `constants.js`): `SETUP_MENU_BLOCK_STATUSES` · `SETUP_MENU_SELECTORS` · `SETUP_MENU_SOURCES` · `SETUP_LABEL_STATUSES` · `SETUP_VERDICTS = [valid, invalid, unknown]` · `SETUP_PATTERNS = [breakout, pullback_resume]` · `SETUP_REGIMES = [uptrend, downtrend, no_trend, unknown]` · `SETUP_BARS_CLASSES = [contemporaneous, later_reconstruction]` · `SETUP_SNAPSHOT_STATUSES = [ok, refused]` · `SETUP_S2_OUTCOMES = [retryable, pending, threw, none]`.

**Nothing the serializer cannot classify reaches the record.** The composer validates every value against the same lists and regexes before the fact is set (a `reason` that fails `ID_RE` becomes `'other'`; a non-finite number becomes null), so `sanitizePermanentDocument` rejects nothing from the block — a rejected value would otherwise travel as **text** into the body document's `rejectedFields` (`captureWriter.js:438-446`), which the composer's pre-validation prevents. Acceptance row 5.6 proves `rejected = []` on every fixture block, including dotted symbols.

### 5.3 Isolation

The composer never throws past its boundary: any internal error yields `{ blockStatus: 'error', errorCode, session, …identity fields }` and nothing else. Both the freeze and the settle run inside the capture guard. **An oversized, malformed or failed block can therefore never fail the permanent or body write**: the block is bounded before composition ends, pre-validated, and either present-and-valid or reduced to the error form. The pre-existing record fields are composed from other state and are unaffected (row 5.5).

### 5.4 Access, retention, idempotency

Server-only by default deny (`firestore.rules:1468-1470`; `tickCaptureDenials.rules.mjs:110-113`; a new denials row reads a record carrying the block). Retention: the permanent record's — none in V1 (bodies expire at 120 days; the permanent record does not) — **inherited, not new**. The document id `${battleId}:${tickSeq}` (`captureContext.js:133`) means a re-finalisation of the same committed tick **overwrites the same document**: one document per tick, **not** a guarantee of identical bytes across repeated finalisations (a later finalisation composes from its own state). A `timed_out` commit is **unknown**, not absent: the commit may land after the race (`captureWriter.js:612-617`); persisted records are counted through the export's read path (`export-tick-capture.js`, `captureCoverage.js` `reportedUnknown`), never by assuming a timeout wrote nothing.

### 5.5 The measurement contract

**Denominators, kept apart** (the census computes each from the records it can read):

| Denominator | Source |
|---|---|
| Ticks with a block (the pool existed) | records with `setupMenu` |
| Model-dispatched ticks | `model.dispatched = true` |
| Candidates the model saw | `inDispatchedBench = true` |
| Labelled / refused / absent / excluded / symbol_form / stale / failed / unsettled | `candidates[].status` |
| Intentionally unacquired population | `source = catalyst` — **reported separately and never counted as provider or acquisition failure**; the same for `inDispatchedBench = false` hot-bench names |
| Absent, by Slice 2's own history | `s2Attempts = 0` vs `> 0`, `s2LastOutcome` — Slice 2's attempts only (§7.3) |
| Omitted and truncated candidates | `omittedCount`, `truncatedCount` (coverage denominators stay interpretable) |
| Ticks whose capture skipped, timed out or failed | the export's coverage (`attempt unknown`, gaps) |

**Join semantics.** Every join is scoped by **`battleId`** (the record's parent; `evalId` such as `eval_012` is per battle, not global) and, for the cohort, by `ownerId`/`agentId` on the record.

| Case | Join | Class |
|---|---|---|
| The model's pick on this tick | `decision.originalSymbolIn` / `finalSymbolIn` vs `candidates[].symbol`, same document | `same_tick` |
| A committed swap on this tick | `actions[]` with `committed = true`, by `source` (`haiku` = a model pick; `risk_manager`/`archetype`/`guardrail` = deterministic), `symbolIn` vs `candidates[]`, same document | `same_tick` (per source) |
| A proposal executed on a later tick | **Chronology, verified:** `handlePendingProposal` runs at `:2577`, before the freeze at `:2898`, so an executed proposal's swap on tick T precedes T's menu observation and its `symbolIn` is now held (not in T's pool). The only join is to the **proposing** tick, through the trade row's `evaluationId` (the proposing check's) = that tick's `evalId` within the same `battleId` — and that row lives in the battle document's `trades[]`, which the V1 census does not read (it reads tick records and the state document only). Since the launch guard clears every proposal unexecuted today (`:5249-5262`), the class is **declared, not evaluated, in V1**: an executed-proposal action on a tick is reported as its own class, never as `same_tick` and never as `ambiguous`. Evaluating it would need a field-masked read of `trades`, `agentId` and `ownerId` (the observer's `BATTLE_FIELDS` precedent) — a later census change, not this build's | `proposal_tick_unevaluated` |
| No match under the rules above | — | `ambiguous` |
| No record for the tick (skipped, failed, or timed out and not found by the export) | — | `missing` |

A join is observational: it reports the label a picked name carried on the record of the tick that picked it. It does not show the agent saw the label and is not a trading benefit. **M1 and M2 limits hold:** the recorded replay stands at 17 joined moments, below the 20-moment floor; this slice runs neither measurement and justifies no filtering or behavioral claim.

---

## 6. Acquisition: the tenant (issues 2 and 4)

### 6.1 Population and bounds

Per allowlisted owner, in rotating order from the state's owner cursor: active battles (`where('ownerId','==',uid).where('status','==','active')`, field mask `ownerId, status, gameMode, isCpu, agentId, agentContext.archetype, watchlist.hotBench`), at most `MAX_BATTLES_PER_OWNER_PER_RUN (10)` per owner and `MAX_BATTLES_PER_RUN (25)` in all; `scopeOf` in memory; exclusions counted. Population: the symbols of each battle's persisted `watchlist.hotBench` (the menu as last presented; equipped names in the universe are inside it). **Keys are taken in turn across battles** (round-robin, each battle's hot-bench order), so one battle with a large equipped set cannot take the whole run. No rankings read, no menu recomputation, no monitoring (D-3), no catalyst names. Preparation (state read, battle queries) starts no read after `tenantStart + PREP_BUDGET_MS (6_000)`; a cut preparation proceeds with the battles already read, counted `prep_cut`; a failed battle read is counted and skipped.

Bound per run: `min(12, B × max(20, E))` store calls, `B ≤ 25` battles.

### 6.2 Slice and deadlines — admission, not completion

| | |
|---|---|
| Host, seat | `process-pending-reflections.js`, step 9 after the activation observer (step 8, `:303-320`), isolating try/catch; the response spreads `setupMenuLabels` only when not skipped. 52 scheduled runs a day (`*/15 13…23,0,1 * * *`, `vercel.json:205-206`). |
| Admission deadline | `min(tenantStart + TENANT_SLICE_MS (20_000), handlerStart + TENANT_ADMISSION_CEILING_MS (100_000))`. Below `MIN_RUN_MS (15_000)` → `{ deferred: 'no_budget' }`, no read. |
| Admission reserve | A reservation transaction and its store call start only with ≥ `ADMISSION_RESERVE_MS (7_000)` left before the deadline; ≤ `MAX_ACQUISITIONS_PER_RUN (12)` per run; ≤ `ACQUISITION_CONCURRENCY (3)` in flight. |
| Completion | **Not bounded by Slice 2, by design.** A started unit of work — reservation transaction → `getOrAcquireSnapshot` → outcome transaction — is **awaited to its end**; no timeout races a write. The provider request is bounded at 5 s (`acquire.js:42`), but the store's claim transaction, its create/settle transaction, a lease release on error, Firestore SDK transaction retries (the Admin SDK retries contended transactions; default attempt count ASSUMED, not pinned in the repo) and Slice 2's two transactions are not. Typical completion is a second or two; under Firestore contention it can be tens of seconds. |
| What bounds it | The platform's `maxDuration` 120 s (`:77`). If it ends the invocation: the store's lease expires on its own (120 s, `store.js:35`); a Slice 2 reservation stands with its `inFlightUntil` expiring at 120 s and no outcome recorded (the next run may retry it; the attempt cap holds because the reservation was written first); no partial write exists anywhere (every write is one transaction); the run's counts are lost. This is the observer's own exposure (V1.9 §4.3), neither widened nor hidden. |
| Realistic margin | Latest admission at deadline − 7 s = 93 s after the handler start; a typical unit ends by ≈ 96–101 s; **≈ 19 s to the hard stop is the ordinary case, not a guarantee.** When the observer itself ran long (worst case ≈ 82–88 s after the handler start), under 15 s remain and Slice 2 defers without a read; on the reflection-consolidation path (≈ 110 s, `:70-76`) both tenants defer. |
| Unchanged | `TIME_BUDGET_MS` (50 s), the observer's slice, ceiling, caps, reserves, ordering and finalisation policy, every earlier tenant. **No earlier tenant is changed to manufacture capacity** (D-7). |

### 6.3 The request protocol, per key (hard cap by reservation)

For each queued key, in turn, while admission holds:

1. **Reserve** — one transaction on `setupMenuLabelState/main`: read; refuse (no call, counted) when `attempts[id].n ≥ MAX_ATTEMPTS_PER_KEY_PER_SESSION (3)` (`exhausted`), `attempts[id].dueAt > now` (`not_due`), `attempts[id].inFlightUntil > now` (`in_flight`), `attempts[id].done` (`done`), or the key is new and the map holds ≥ `STATE_MAX_KEYS (400)` entries (`state_full`); otherwise write `n + 1`, `reservedAt = now`, `inFlightUntil = now + 120_000`, `session`. The reservation is the unit the cap counts; it is written **before** the request.
2. **Request** — `getOrAcquireSnapshot({ db, session, symbol, now, fetchPayload, host: 'setup-menu-labels' })`, awaited.
3. **Record** — one transaction: `lastOutcome`, `lastAt = clock()` after the call resolved, `inFlightUntil = null`, and `dueAt` per §6.4; `final` or `excluded` → `done: true` (the record stays; no further calls); `pending` → `n − 1` (the request made no fetch; the refund is best-effort — if this transaction fails, the reservation stands and the cap is conservative).

**Contention.** The reservation and record transactions are **serialised in-process** — one transaction at a time on the state document — while the store calls themselves remain three-concurrent. Three concurrent transactions on one document would abort and retry under Firestore's contention rules (the SDK-retry exposure §6.2 names); serialising them bounds that without changing any cap. Each transaction is small (one document read, one write) and is awaited like every other unit of work.

Hard, by construction: the per-key per-session cap (serialised by the reservation transaction, duplicates and overlapping invocations included); the in-flight guard; the per-run cap, concurrency and admission reserve (in-process); **no eviction within the governed sessions**. Best-effort: due-time precision (clock skew between invocations); the pending refund; cursors. **If the state cannot be read or the reservation transaction fails, the key is not requested** (`deferred: state_unreadable` / `reserve_failed`): a hard allowance that cannot be enforced is not spent.

### 6.4 Due times compatible with the store's confirmation rule

The store finalises a confirm-class outcome only when a later request **starts** at least 30 minutes after the first observation's **response** time (`store.js:146-148`: `requestStartedAtMs − observedAtMs ≥ CONFIRM_AFTER_MS`, `observedAt` = the first fetch's `fetchedAt`). Slice 2 never reads that observation (no store internals); it schedules from its **own** safe reading: `lastAt`, the clock after its call resolved, which is ≥ any `fetchedAt` that call produced.

| Outcome | `dueAt` | Attempt counted? |
|---|---|---|
| `retryable` with reason in `TRANSIENT_REASONS = { fetch_failed, non_array_payload, malformed_payload, calendar_missing, asOf_in_future }` | `lastAt + NEXT_RUN_MS (14 min)` — the next scheduled run | yes |
| `retryable` with any other reason (the adapter's: `missing_bar`, `unordered_bars`, `insufficient_history`, `missing_fact`, `adjustment_metadata_absent`, `adjusted_close_missing`, `adjusted_close_nonpositive`, and anything unlisted) | `lastAt + CONFIRM_AFTER_MS (30 min) + CONFIRM_MARGIN_MS (60 s)` | yes |
| `pending` (a live lease elsewhere; no fetch) | `lastAt + NEXT_RUN_MS` | **no** (refunded) |
| a throw | `lastAt + NEXT_RUN_MS` | yes |
| `final`, `excluded` | — (`done`) | yes |

**Why this is safe and sufficient.** A changed refusal detail makes the store replace its observation and restart its 30 minutes from the **new** `fetchedAt`; Slice 2's `dueAt` is computed from its own latest `lastAt`, which is at or after that instant, so the next Slice 2 request is always eligible when it runs. A first observation made by the **observer** (unknown to Slice 2) only makes Slice 2's first request confirm early or be told `retryable`; either way Slice 2's next due time follows. **The review's counterexample resolved:** first request 09:00:00 → resolves 09:00:05 → `dueAt = 09:31:05`; the 09:15 and 09:30 runs refuse the key as `not_due` **without a reservation** (no attempt spent); the 09:45 run reserves and requests at ≥ 09:45:00, 30 minutes past 09:00:05 — eligible. A premature run never consumes the allowance.

### 6.5 The state document

`setupMenuLabelState/main`, server-only, mutable, read by the tenant (transactions) and once per run by the reader (plain get, memoized). Shape: `{ schemaVersion: 1, cursors: { owners, keys }, governedSessions: [previous, current], attempts: { [snapshotId]: { session, n, reservedAt, inFlightUntil, lastOutcome, lastAt, dueAt, done } }, updatedAt }`. The snapshot id carries the session, so `attempts` is naturally per `(session, symbol, triple)`. **Governed sessions** are the current and the previous completed session: their entries are **never evicted**; entries of older sessions are pruned in the end-of-run cursor write (a transaction, so it cannot clobber a concurrent reservation). At `STATE_MAX_KEYS (400)` new keys are **refused**, never admitted by eviction; 400 entries ≈ 50 KB, far under the document limit; the `attempts` map is index-exempt. Never `activationObserverState` (A4).

### 6.6 Accounting (A3) — the quantities kept apart

| Quantity | Definition | Per admitted invocation | Per day |
|---|---|---|---|
| Unique keys | distinct `(session, symbol, triple)` wanted by ID-1 and Slice 2, shared keys once | — | ≈ 30–80 (ASSUMED; §6.7) |
| Store invocations | calls to `getOrAcquireSnapshot` | observer ≤ 12; Slice 2 ≤ 12 | ≤ 24 × invocations |
| **Provider requests** | invocations that reached the fetch: claimed, no final, no live lease, calendar ok | **≤ 24** | **≤ 24 × invocations** |
| Final cache hits | invocations answered from an existing final snapshot — **no request** | ≤ 24 | — |
| Pending | invocations refused by a live lease — **no request** | ≤ 24 | — |
| Retries | re-requests of a key already requested this session | Slice 2 ≤ 2 further per key (the cap); the observer per its own rules | — |
| Shared-key double fetch | a key the observer requested in this invocation whose result was `retryable` (lease released) and that Slice 2 then requests in the **same** invocation: a second request. The live-lease test does not cover it; Slice 2 cannot see the observer's per-key results (counts only, no ids). **Bounded only by the two caps** | ≤ 12 such pairs | — |
| Excluded / symbol_form | refused before any call | — | — |

**The 24 figure** is a bound **per admitted handler invocation** under the two caps. **1,248 per day** is a **conditional schedule estimate**: exactly 52 scheduled invocations, each admitted, each at cap, no duplicate or extra invocation (Vercel can deliver a cron twice and the founder can trigger a run); it is not enforced by anything, and **this task introduces no daily budget system**.

### 6.7 The expectation, with its inputs (ASSUMED throughout)

≈ 50–130 provider requests a day, combined. Inputs: `B ≤ 4` in-scope battles (two allowlisted owners, Phase 0 §E3, REPORTED); hot bench ≤ `max(20, E)` with `E` small; 30–60 unique Slice 2 keys a session (one shared menu across battles, plus a few new names per rebuild over ≤ 9 rebuilds a day); ≈ 20 % confirm-class outcomes (one further request each), ≈ 10 % transient failures (≤ 2 further requests each); ID-1's 10–40 keys a session (Phase 0 §E3); overlap on swap-ins only. Exclusions: monitoring, catalyst additions, non-allowlisted battles, duplicate invocations. **Historical yardstick only:** the 7 Oct census (`docs/audits/20261007_EODHD_CALL_CENSUS.md`, at `8c9ea5ef`) modelled ≈ 86,000 requests a trading day against a 100,000 account allowance; it is a month old, an account allowance, and **not an approved allocation**. **D-6 remains the production gate**, and needs: the allocation's **unit** (requests or weighted credits), **window** (day; calendar or trading), **included consumers** (whether the two tenants share the allocation with `agent-evaluate` and the pollers), and the **treatment of retries and confirm fetches**.

---

## 7. Gate, disabled behaviour, A1, and honest absence (issue 3)

### 7.1 The gate
`SETUP_MENU_LABELS_ENABLED` (own module, default `false`, registered in the pin guard, `DARK_BY_DESIGN`) **and** the cockpit allowlist, read at call time by the freeze and by the tenant (D-4). Independent of `ARCHETYPE_REFRESH_MENU_ENABLED`: that flag selects **which menu** is built and flips on M1's reading; Slice 2's decides **whether store I/O happens**. Coupling them would let the menu flip open production acquisition (A1).

### 7.2 Disabled behaviour (shipped state)
Flag off: the freeze sets no fact (the record has no `setupMenu` key), no read starts, the tenant returns `{ skipped: true }` before any read, the cron response has no `setupMenuLabels` key, no log line. Capture disabled (`TICK_CAPTURE_ENABLED` false): the context is the inert `NOOP_TICK_CAPTURE` with `setupMenu` a no-op and `enabled: false`, so no read starts either. **Proof** (§10): a db double that throws on any `setupEvidence`, `setupEvidenceClaims` or `setupMenuLabelState` access, driven through `processAgentBattle` and the reflections handler with the flag off; byte-identical permanent record and response against the base tree.

### 7.3 Honest absence (D-5, revised)
A missing snapshot is a **fact** about the store; Slice 2's state is a record of **Slice 2's own** requests. The label therefore says `absent` and, when Slice 2's state settled in time, adds **explicitly historical** fields: `s2Attempts` (Slice 2's reservations for this key in the governed session), `s2LastOutcome` (`retryable` | `pending` | `threw` | `none`), `s2LastAt`, `s2Exhausted` (`s2Attempts ≥ 3` in the readable state). What these fields **do not** claim: `s2Attempts = 0` is not "nobody attempted it" (the observer may have); a last outcome of `pending` is not "a lease is live now" (the lease term is 120 s; the reading is historical); missing, pruned or unreadable state yields **nulls**, never a claim; `s2Exhausted` is asserted only from the reservation count under §6.3's protocol. The three stored facts stay distinct on the record: **missing snapshot** (`absent`), **refused final snapshot** (`refused`, verdict `unknown` with the refusal reason), **evaluator `unknown` verdict** (`labelled`, verdict `unknown` with the typed reason). No per-symbol claims read is added. The value of the historical fields is one thing: letting the census separate "Slice 2 never asked" from "Slice 2 asked and the provider could not answer" when it reads coverage; they cost one state read per run and a few bytes.

### 7.4 A1 — census-week isolation, an activation prerequisite
No Slice 2 production `getOrAcquireSnapshot` call during ID-1's first census week — manual warm-ups, experiments and smoke runs included. Mechanically: the build ships with the flag `false`; tests run on fixtures and the emulator only; exactly **two** production entry points exist (the tenant acquires; the reader only reads), both behind the flag; **no script, endpoint or alternate path** that reaches `getOrAcquireSnapshot` is built, and a static row (§10, A1.1) asserts the set of callers of that function is exactly the observer's tenant and Slice 2's; the import guard lists every file that names the store (§3.2). Production acquisition opens only under milestone 3 (§0). **Neither this specification nor the disabled build authorizes a flip, and calendar time never does.**

### 7.5 Caller-level scope; server-side only
`scopeOf(battle)` (the explicit-`null` reading of V1.9 §2 is the module's own, `scope.js:20`), `isTournament === false`, the allowlist — in the freeze before any fact, in the tenant before any battle is kept. All store access is in `api/`; the client never reads the store, the state document or the tick record. `api`→`src` imports carry an unmocked dependency-surface test import (BUILD_RULES §4), as `scope.js:11-13` does.

---

## 8. A4 — the shared host

Seat, slice, caps, reserve, awaited completion, state and deferral are §6.2–§6.5. Ordering: strictly after the observer's `await`; the observer's result is not inspected (counts only; Slice 2 reads nothing of it). `TIME_BUDGET_MS`, the observer's constants and every earlier tenant are untouched; `activationObserverState` is never read or written. If the census shows chronic `no_budget` deferral, the fallback host is the settle run (`agent-evaluate?mode=settle`, `0 2 * * 2-6`) with the same tenant contract — a later decision (D-7), not this build.

---

## 9. Failure and unknown policy (consolidated)

| Situation | Reader (the record) | Tenant |
|---|---|---|
| Final `ok` snapshot | `labelled`: `valid` / `invalid(reason)` / `unknown(reason)` | `done` |
| Final refused snapshot | `refused`, verdict `unknown`, the refusal reason | `done` |
| No final snapshot | `absent` + historical `s2*` fields when the state settled; nulls otherwise | reserve and request when due and under the cap |
| Live lease elsewhere | (invisible to the reader; `absent`) | `pending`: no fetch, refunded, due next run |
| Transient failure | `absent` (`s2LastOutcome: retryable`, the reason via the census's own read of the state) | due next run; ≤ 3 reservations per session |
| Confirm-class outcome | `absent` until the store finalises it | due at `lastAt + 31 min` |
| Crypto | `excluded`, no read | skipped, counted |
| Symbol the key refuses (dotted/suffixed) | `symbol_form`, no read; the symbol itself is on the record (`SYMBOL_RE` admits it) | counted, never repaired |
| Calendar cannot name the session | `blockStatus: calendar_missing`, no reads | `deferred: calendar_missing`, no request |
| Document that does not serve the key | `stale_snapshot` | the observer's `snapshotInvalid` analogue |
| Read rejected / past the absolute deadline / unsettled at capture | `read_failed` / `read_unsettled`; `blockStatus: reads_unsettled` when any is unsettled | a throw: counted, `dueAt` next run |
| State read failed or unsettled | `stateRead: false`, `s2*` null | no reservations this run (`state_unreadable`) |
| Composer error | `blockStatus: error`, `errorCode`; the rest of the record untouched | — |
| Block over the caps | `omittedCount` / `truncatedCount`; `blockStatus: truncated` | — |
| Platform kill | the tick's record is finalised by the handler's error path or not at all; counted by coverage | lease expires; reservation stands; cap holds; counts lost |

Nothing above removes, adds or reorders a candidate; nothing fires, suppresses or replaces a protective action; nothing reaches a prompt; nothing changes a model-admission or capture-admission decision.

---

## 10. Acceptance matrix

Each row names its suite; rows that can fail under a named defect are mutation-checked (BUILD_RULES §2). The store's own concurrency, lease and confirmation rows are reused, never duplicated. The tick harness drives `processAgentBattle(db, battle, summary, cronStartTime, …)` (its fourth argument is the handler start, so `remaining = TIME_BUDGET_MS − elapsed` is set exactly), and `makeTickDb`'s `collection()` is wrapped to count or throw per collection name.

**Issue 1 — decision and capture budgets**

| # | Row | Suite |
|---|---|---|
| 1.1 | **64 s branch:** calls off, remaining 65,000 ms at the admission test, a state read and 20 snapshot reads each delayed 2,900 ms — the model call is admitted (`mocks.create` called) exactly as with the flag off; remaining 63,999 ms — skipped both ways (`budget_skipped`). | `agent-evaluate.setupMenuLabels.test.js` |
| 1.2 | **68 s branch:** calls shadow (`callsReserveMsFor` = 4,000), remaining 69,000 ms — admitted both ways; 67,999 ms — skipped both ways. The `budget.remainingMs` recorded in the skip message is identical with and without Slice 2. | same |
| 1.3 | **Delayed state read** (resolves at 2,900 ms) on a model tick: labels present; `settleWaitMs = 0`. On a no-trigger tick whose exit write resolves at once: `settleWaitMs ≤ 500`, `stateRead` true. | same |
| 1.4 | **Hung reads** (never resolve): the tick completes; the block is `reads_unsettled` with every candidate `read_unsettled`; `finalizeTickCapture` starts no later than it does with the flag off plus 500 ms; `remainingBudgetMs` passed to it is above the capture floor whenever it would have been without Slice 2. | same |
| 1.5 | **Late resolution:** a read resolves after the settle; the frozen block deep-equals the written one; the results map changed, the record did not. | `reads.test.js` |
| 1.6 | **Capture disabled** (`TICK_CAPTURE_ENABLED` false): zero reads of `setupEvidence*` and `setupMenuLabelState`; `NOOP_TICK_CAPTURE.setupMenu` exists and is a no-op; no throw. | `captureContext.test.js`, cron suite |
| 1.7 | **Enrichment failure** (the composer throws): the record minus `setupMenu` deep-equals the flag-off record; `setupMenu` is the error form; the body document is identical. | `captureWriter.test.js`, cron suite |
| 1.8 | **Budget-aware settle:** with `remainingBudgetMs = 12,999` at the capture stage the wait is 0 (the floor condition `remaining − waited > 13,000` fails at once) and capture proceeds exactly as without Slice 2; with 13,400 the wait is ≤ 400 ms and `finalizeTickCapture` receives ≥ 13,000. | `reads.test.js` |
| 1.9 | **No block before the pool:** `degraded_quotes`, `cpu_passive`, `proposal_pending`, `gameplan_*` exits produce no `setupMenu` key and no reads. | cron suite |
| 1.10 | **Freeze is pure:** `freezeSetupMenuPool` makes no call on a db double that throws on any method; `session` comes from `frozenAtMs`, not from the read instant. | `pool.test.js` |

**Issue 2 — retries and confirmation**

| # | Row | Suite |
|---|---|---|
| 2.1 | First request resolves at 09:00:05 with a confirm-class reason; runs at 09:15:00 and 09:30:00 refuse the key `not_due` with **no reservation written**; the 09:45:00 run reserves and requests; a real store on the emulator finalises it (the confirming request started ≥ 30 min after `observedAt`). | `setupMenuLabelsTenant.rules.mjs` |
| 2.2 | **Immediately before eligibility** (run at 09:31:04 with `dueAt` 09:31:05): refused `not_due`; **at eligibility** (09:31:05): requested. | `tenant.test.js` |
| 2.3 | **Changed refusal detail:** the second request returns a different confirm-class detail; the store replaces its observation; Slice 2's `dueAt` moves to that call's `lastAt + 31 min`; the third request, at its due time, finalises. | emulator suite |
| 2.4 | **Delayed first response** (5 s): `lastAt` is the resolve instant, not the start; `dueAt` follows `lastAt`. | `tenant.test.js` |
| 2.5 | **Transient reasons** retry at the next run; **adapter reasons** wait 31 minutes; an **unlisted reason** is treated as adapter-class. | `tenant.test.js` |
| 2.6 | **Hard cap under overlap:** two concurrent invocations against one state document reserve for the same key; the second sees `inFlightUntil` and refuses; across any interleaving of three runs no key gets a fourth reservation. | emulator suite |
| 2.7 | **Pending refund:** a `pending` result decrements `n`; a failed refund leaves `n` as reserved (conservative). | `state.test.js` |
| 2.8 | **Unreadable state / failed reservation:** no request is made (`state_unreadable` / `reserve_failed`), zero fetch-double calls. | `tenant.test.js` |
| 2.9 | **No eviction in the governed sessions:** with 400 entries all in the current and previous sessions, a new key is refused `state_full`, no entry is removed, an exhausted key stays exhausted; entries of an older session are pruned by the cursor write. | `state.test.js` |
| 2.10 | **Lost outcome write** (kill after the request): the reservation stands, the next run may request once more, and the cap still holds at 3. | `tenant.test.js` (instrument seam) |

**Issue 3 — honest absence**

| # | Row | Suite |
|---|---|---|
| 3.1 | Missing snapshot → `absent`; refused final snapshot → `refused` with verdict `unknown` and the refusal reason; an `ok` snapshot whose entry verdict is `unknown(missing_fact)` → `labelled` with verdict `unknown`. The three are distinct on the record. | `compose.test.js` |
| 3.2 | State unreadable or unsettled → `stateRead: false` and every `s2*` field null; no `absent` candidate claims exhaustion or a live lease. | `compose.test.js` |
| 3.3 | A state entry with `lastOutcome: pending` from an hour ago → `s2LastOutcome: pending`, `s2LastAt` an hour old; no field says "live". | `compose.test.js` |
| 3.4 | `s2Exhausted` true only when the readable state shows `n ≥ 3` for the key in the governed session. | `compose.test.js` |

**Issue 4 — accounting and runtime**

| # | Row | Suite |
|---|---|---|
| 4.1 | **Sequential shared-key retryable:** the observer's call for key K returns `retryable` (lease released) in a run; Slice 2's call for K in the same run reaches the fetch double — two requests, both counted; the per-tenant caps hold. | emulator suite |
| 4.2 | **Duplicate invocation:** two handler invocations in one slot; each Slice 2 run is bounded at 12; the reservation protocol makes at most one request per key per lease window. | emulator suite |
| 4.3 | **Delayed preparation reads** (battle query resolves at 7 s): preparation is cut at 6 s, counted `prep_cut`, acquisition proceeds with the battles read. | `tenant.test.js` |
| 4.4 | **Delayed store operation** (a call admitted at 93 s runs 20 s): awaited to its end, no race, the run ends after it, counts record it. | `tenant.test.js` |
| 4.5 | **Deferral:** 14,999 ms to the deadline → `no_budget`, zero reads; 15,000 → runs. | `tenant.test.js` |
| 4.6 | **Fairness:** owners rotate from the cursor; ≤ 10 battles per owner; keys taken in turn across battles so a battle with 40 equipped names gets at most its share of the 12. | `tenant.test.js` |
| 4.7 | The run's counts separate `invocations`, `requests`, `finalHits`, `pending`, `retries`, `excluded`, `symbolForm`, `notDue`, `exhausted`, `inFlight`, `stateFull`, `reserveFailed`. | `tenant.test.js` |
| 4.8 | Health line carries literal keys only (sentinel owner, battle, symbol and snapshot ids never appear). | `tenant.test.js`, `reads.test.js` |

**Issue 5 — the record block**

| # | Row | Suite |
|---|---|---|
| 5.1 | **Large equipped set:** 60 hot-bench names + 5 catalysts → 48 candidates in presentation order, `omittedCount = 17`, `presentedCount = 65 + duplicates`, block ≤ 24 KiB. | `compose.test.js` |
| 5.2 | **Duplicates:** `hotBenchSymbols` and the asset-map keys overlap; `uniqueCount` is the dedup count; a hot-bench name keeps `source: hotbench`; the real `hotBenchSymbols`, `hotBenchAssetMap` and bench are unchanged (deep-equal before and after). | `compose.test.js`, cron suite |
| 5.3 | **Dotted and suffixed symbols** (`BRK.B`, `RDS-A`, `BRK-B`): through the **real** `sanitizePermanentDocument` with the tick's universe, the array form round-trips with `rejected = []`; `BRK.B` is `symbol_form`, `BRK-B` reads normally. | `captureSerializer.test.js` |
| 5.4 | **Malformed snapshot** (wrong schema version, missing entry, wrong key): `stale_snapshot`; a snapshot whose `reason` fails `ID_RE` → `reason: other`. | `compose.test.js` |
| 5.5 | **Optional-block failure preserves the record:** with the composer forced to throw, every pre-existing field of the permanent record and the whole body document equal the flag-off run's. | `captureWriter.test.js` |
| 5.6 | **Nothing rejected:** every fixture block passes the real sanitizer with `rejected = []` and `findFreeText = []`. | `captureSerializer.test.js` |
| 5.7 | **Size cap:** a block that would exceed 24 KiB is truncated from the tail, `truncatedCount` set, `blockStatus: truncated`, and the measured size is under the cap. | `compose.test.js` |
| 5.8 | **Flag off:** no `setupMenu` key; the record's bytes equal the base tree's. | cron suite |

**Issue 6 — measurement**

| # | Row | Suite |
|---|---|---|
| 6.1 | `inDispatchedBench` is true exactly for pool names in `flattenBenchServer(battle.portfolio.bench)` at the freeze; held hot-bench names are false; original bench names outside the pool are not candidates. | cron suite |
| 6.2 | Joins are scoped by `battleId`: two battles with the same `evalId` do not join. | `census-setup-menu-labels.test.js` |
| 6.3 | Join classes on fixture records: `same_tick` by `actions[].source`; an executed-proposal action reported `proposal_tick_unevaluated` (never `same_tick`, never `ambiguous`); `ambiguous`; `missing`. | census test |
| 6.4 | A `timed_out` capture is counted through the export's resolution (present → counted; absent → `attempt unknown`), never as "no record" by assumption. | census test (fixture export) |
| 6.5 | Denominators: model-dispatched vs. not; catalyst-sourced absence reported apart from hot-bench absence; `omittedCount`/`truncatedCount` carried into coverage. | census test |

**Cross-cutting (A1–A4, guards, parity)**

| # | Row | Suite |
|---|---|---|
| A1.1 | Callers of the **function** `getOrAcquireSnapshot` (tests aside) are exactly `activationEvidence/tenant.js` and `setupMenuLabels/tenant.js`; no file under `scripts/` names it. (Distinct from the import guard, which lists every file naming the library or its collections.) | `tenant.test.js` (static) |
| A2.1 | Server-only: client read of a record carrying the block denied; `setupMenuLabelState` read and write denied. | `setupMenuLabelsDenials.rules.mjs` |
| A3.1 | The run's accounting rows (4.7) and the shared-key double fetch (4.1). | — |
| A4.1 | The tenant runs after the observer (call order photographed); constants are its own module's; it never touches `activationObserverState` (throwing double); `TIME_BUDGET_MS` pin unchanged. | `process-pending-reflections.setupMenuLabels.test.js` |
| G.1 | Import guard: every new file listed by exact path; the planted-caller rows bite; the six-module pin holds; `agent-evaluate.js` and the handler do not name the library. | existing guard suite |
| G.2 | Flag pin: the module registered; the `DARK_BY_DESIGN` entry present; the pin row `false`. | `flagPinGuard.test.js` |
| G.3 | Disabled parity through `processAgentBattle` and the handler with a throwing db double on `setupEvidence*` and `setupMenuLabelState`; byte-identical record and response. | both cron suites |
| G.4 | Scope: other archetype, CPU, training clone, tournament, non-tiered, non-allowlisted → no fact, no read, counted. | `pool.test.js`, `tenant.test.js` |
| G.5 | Golden guard passes with the evaluator, golden and baseline unchanged. | CI step |

---

## 11. Review and required checks

- **BUILD_RULES §2 review, mandatory:** multi-lens and adversarial (domain correctness against this contract; the tick lifecycle — freeze, start, settle — and the two admission tests; the flag-off and A1 guarantees; test integrity with mutation checks; cross-document consistency with V1.9, the capture spec and this document), each finding refuted on a `git archive` snapshot tree, the CONFIRMED/REFUTED split recorded in `docs/audits/`, with an explicit `vite build`.
- **Required checks before push:** the **full** unit suite (the census guards fail only there); `npm run test:rules` on the emulator (the new denials and tenant suites; `passWithNoTests` unset); `npm run lint:gate`; `vite build` with the entry chunk asserted byte-identical to the base; the golden guard against the merge-base; the Linux run in WSL (`TZ=UTC`, 8 workers, `flock`) per CLAUDE.md; final checks on the branch merged with current `origin/main`.
- The PR description cites changes by `file:line`, states "fenced functions called: `computeArchetypeRankings` and `flattenBenchServer` (read-only, existing calls); fenced files edited: none", names every import-guard entry and the one guard-test edit (§3.2), and links the report and the review record.

---

## 12. Documentation scope (the build's docs commit)

`docs/audits/<date>_BUILD_SETUP_MENU_LABELS.md`: verdict table; preamble; what was built; the lifecycle (§4) as implemented with its three anchors re-verified; the flag-off proof; the acceptance matrix with results; the A1–A4 dispositions; the accounting as measured on fixtures; the review record; the flip checklist naming milestone 3's three conditions; the morning-gap and deploy-menu limits. · `captureConfig.js`: the RD-1 citation. · The import guard's reason lines. · `docs/README.md` row. · **Not changed:** the V1.9 contract; the setup definition; the growth map (its `setupVerdicts` lines are superseded by the shared store — recorded in the report; the map's revision belongs to the framework chat).

---

## 13. Delivery

A branch cut fresh from current `main` → build dark → §11's checks and review → the report → push by refspec → **draft PR → STOP.** No merge, no flip, no production run, no census, no watching of CI, no auto-fix. After the founder merges (their steps): publish the rules block; deploy the index exemption. The flag stays `false` until milestone 3.

---

## 14. Decisions

**Remaining founder decisions** (each with the recommended answer and the consequence of the alternative; routine engineering choices are §14.2 and need no ruling):

| # | Decision | Recommended | If the alternative is chosen |
|---|---|---|---|
| **D-1** | Observe the menu **as presented** with the `selector` stamp; label P and mark `inDispatchedBench` | **Yes** (per the review's direction) | Archetype-only labelling: no production label until the menu flag flips |
| **D-2** | The additive permanent tick block under RD-1, as bounded and isolated in §5 | **Yes** | Memory-only: no pick join, no coverage, no historical comparison |
| **D-3** | Monitoring outside V1 | **Yes** | More acquisition for a surface the agent cannot pick from |
| **D-4** | One default-false flag, the cockpit allowlist, `scopeOf` reused; independent of the menu flag | **Yes** | Weaker isolation proofs; a copied predicate can drift |
| **D-5** | Revised: `absent` with explicitly historical Slice 2 fields; no per-symbol claims read | **Yes** | Richer "pending/unattempted" claims the data cannot support |
| **D-6** | **Unresolved; a production-activation gate, not a build gate.** Needs the allocation's unit, window, included consumers and retry treatment | **Founder to name it before milestone 3** | — |
| **D-7** | The reflections tenant, with §6.2's admission-and-completion statement; no earlier tenant changed | **Yes** | The settle run: one nightly shot, no retries, no morning catch-up |

**14.2 Engineering choices made here** (the build may adjust within this document's limits and records each adjustment): the two read-start sites and the settle point (§4.3–§4.4); the 3 s absolute read deadline, the 500 ms settle wait and the capture-floor condition; the array form of the block; 48 candidates / 24 KiB; the closed lists' spellings; the reservation-before-request protocol and its two transactions; `NEXT_RUN_MS = 14 min`, `CONFIRM_MARGIN_MS = 60 s`, `TRANSIENT_REASONS`; `STATE_MAX_KEYS = 400` and the governed-session rule; owner rotation and the 10-per-owner limit; the health-line keys; file and module names.

---

## 15. Authorization

**Milestone 2 (the disabled build)** starts only on the founder's explicit instruction naming the accepted spec (for example: *"I approve implementation of Measured Trend Evidence Slice 2 using 20261107_P3_SLICE2_BUILD_SPEC_DRAFT_V2.md"*), with D-1 to D-5 and D-7 answered or the recommended answers accepted. **D-6 is not a condition of milestone 2.** The build ends at a pushed draft PR and stops.

**Milestone 3 (production activation)** is a further, separate instruction, given only after (a) ID-1's first census week is recorded complete, (b) D-6 is resolved, and (c) the founder's own flip PR is prepared per BUILD_RULES §2. Nothing before it — not the merge, not the census week's end, not the passage of time — opens production acquisition.
