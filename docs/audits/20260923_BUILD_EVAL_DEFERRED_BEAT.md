# Build — Eval-cron instrumentation and the deferred beat

> **DRAFT — the BUILD_RULES §2 review is in progress. Sections marked ⟪…⟫ are completed in the branch's final commit; do not read this version as the report of record.**

**Date:** 2026-09-23
**Branch:** `claude/eval-deferred-beat`, cut from `origin/main` at `591b714d90a72ed6e8e5604f19a2c0fff3388fc4` after `git fetch origin` — the first step of the session (BUILD_RULES §3; the remote-tracking ref was current). Clean tree at open. The clone is shallow; no history was needed beyond it and `--unshallow` was not run. Build commit `c7e3c1df`; ⟪REVIEW-FIX COMMITS⟫; this report rides the branch's final commit, whose SHA the PR states.
**Prompt:** *Build — Eval cron instrumentation and the deferred beat* — three items (D1 `tickMs`, D2 the run document, D3 the deferred beat), nothing else.
**Basis:** `docs/audits/20260918_PHASE0_EVAL_CRON_SCALING.md` — `:271` (no per-battle wall time anywhere), `:293` (R2: `summary.skipped` conflates lock-skips with deferrals and is never persisted), `:298` (R7: `tickMs` on the entry); `docs/audits/20260923_PHASE0_COCKPIT.md` §6.4 (`:159`, "a deferred battle still gets no tick, no lock, no record"). All four re-read this session, VERIFIED.
**Fence:** `git diff origin/main --name-only` ∩ BUILD_RULES §1 = **∅** (§3). No fenced function is newly called and none is edited.
**Crons do not run on Vercel preview** (BUILD_RULES §6). Verification is the unit and behaviour suites below plus observation of the first production run. The beat is dark; the run document and `tickMs` are live at merge.
**Marker convention:** every claim about the code carries `file:line` and is VERIFIED (read at that line this session) unless marked ASSUMED. Line numbers are the branch tree's unless marked `@591b714d`.

---

## Executive verdict table

| # | Item | Verdict | Status |
|---|---|---|---|
| D1 | `tickMs` on every evaluation entry | **Built.** Admission (the lock) → the authoritative final update: stamped at admission, composed right after `callMs`, restamped immediately before `battleRef.update(finalUpdate)`. Enters through the sanctioned `TIMING_ENTRY_KEYS` list; the frozen golden and the exact-key test pass **unmodified**. | VERIFIED |
| D2 | `agentEvalRuns/{runId}` — always on | **Built.** One 13-field document per evaluation run, written in the handler's `finally`, bounded to 2 s, never throwing — and sent **before** the response. `summary` gains `lockSkipped` and `deferred`; `skipped` is their sum. Rules: deny-all. | VERIFIED |
| D3 | The deferred beat — dark | **Built, dark.** `EVAL_DEFERRED_BEAT_ENABLED = false` (DARK_BY_DESIGN + pin). On: one `check_deferred` beat per unreached battle via `arrayUnion`, first 25 in loop order, only with ≥ 5 s of the function's hard ceiling left, bounded to 2 s. Tape: a `Check deferred` record line; an unknown tape kind now renders nothing rather than an empty bubble. | VERIFIED |
| R | Ratchets | Flag guard ✓ (DARK_BY_DESIGN + pin + `Pinned by:`). Rules test ✓ (emulator, 11 rows). Flag-on shape test: **no edit needed** — it enumerates through `BASE_ENTRY_KEYS`. Protected-stores allowlist: **no row needed** — both new write sites resolve to non-protected literal collections, and a row would fail the stale check (§7). | VERIFIED |
| T | Tests | The six required tests plus 20 more rows; **34 mutations, every one RED** at a named row; the unmutated control green (§8). | VERIFIED |
| F | §1 fence | `git diff origin/main --name-only` ∩ §1 = ∅. | VERIFIED |
| RV | §2 review | Threshold met (15 files). ⟪REVIEW SUMMARY⟫ Explicit `vite build`: exit 0. | ⟪ ⟫ |
| ⚠ | Prompt discrepancies | Four, each decided and stated rather than improvised past (§12): test 3's `deferredTruncated: 5`; the allowlist rows; "≥ 5 s of budget" vs a break that fires only past the budget; the tape line needs two wiring files beyond the two named. Plus one copy note ("first"). | — |
| ⚠ | Flip prerequisites | Four other status-feed readers behave differently once beats exist; none throws (§13). The flag must not flip before they are addressed. | VERIFIED |

---

## 1. Files touched

⟪FILES TABLE⟫

## 2. Always on vs flag-gated

| Ships LIVE at merge (no flag) | Behind `EVAL_DEFERRED_BEAT_ENABLED` (false) |
|---|---|
| `tickMs` on every evaluation entry (D1) | The `check_deferred` status-feed write (D3) |
| `agentEvalRuns/{runId}` on every evaluation run (D2) | — and therefore every tape line: the builder renders only `check_deferred` entries, and only the beat writes them |
| `lockSkipped` / `deferred` in the response; `skipped` = their sum, now EXACT (§5.3) | |
| `modelCalls` / `budgetSkipped` counters (in the response when non-zero, always on the run document) | |
| The response is sent from the handler's `finally`, after the run document (§5.4) | |
| `firestore.rules`: the `agentEvalRuns` deny block | |
| Client (controller-on path): the dispatcher row, and the fallback that renders an unknown tape kind as nothing | |

## 3. The §1 intersection

```
$ git diff origin/main --name-only | sort > changed.txt
$ printf '%s\n' api/agent/decide.js api/_utils/agentSwapExecution.js api/_utils/agentScoring.js \
    api/_utils/agentRiskManager.js api/_utils/agentArchetypeConfig.js api/_utils/agentBattleService.js \
    api/_utils/agentPromptAssembly.js api/_utils/agentEvalPromptAssembly.js api/_utils/agentGuardrails.js \
    api/_utils/archetypeScoring.js api/_utils/tournamentUserScoring.js | sort > fence.txt
$ comm -12 changed.txt fence.txt
(empty)
```

The §1 list was re-read this session (`docs/BUILD_RULES.md:14-24`). `api/cron/agent-evaluate.js` is not on it. Fenced code is only CALLED by the lines this build leaves in place; no new call into a fenced module was added. The tick's decider cannot see `tickMs`: `formatRecentEvals` reads exactly eight whitelisted entry keys by dot access and nothing else, pinned by `api/cron/agent-evaluate.tickStamps.pins.test.js:223-243` (pin 4), which passes unmodified.

## 4. D1 — `tickMs`

- **Start — admission.** `const tickAdmittedAtMs = Date.now()` immediately after the lock transaction commits and the lock-skip early return is past (`api/cron/agent-evaluate.js:850`). Time spent inside the lock transaction is not the tick's; time from here on is.
- **End — the authoritative final update.** The entry composes `tickMs: Date.now() - tickAdmittedAtMs` right after `callMs` (`:3832`), and the value is **restamped** immediately before `await battleRef.update(finalUpdate)` (`:4228`). `evaluations` holds the same `evaluation` object, so the restamp rides the write. It therefore includes everything after composition — the intraday view, the stamps, the shadow capture — and excludes only the update's own round trip, which a number inside the document structurally cannot contain (the capture writer's F7 note makes the same point about `preCommitMs`).
- **Numeric on every written entry; absent on early exits.** The entry literal (`:3779`) is the only composer of an evaluation entry, and `:4104` is the only place the `evaluations` array is rebuilt. Every early exit — lock-skip, degraded quotes, CPU-passive, the risk-only and no-trigger flushes, the gameplan and proposal paths — writes no entry, so none can carry a `tickMs`.
- **The sanctioned list.** `TIMING_ENTRY_KEYS` gains `'tickMs'` after `'callMs'` (`api/_utils/__fixtures__/tickStampsHarness.js:79`), so `BASE_ENTRY_KEYS` (`:117`) and every suite that enumerates entry keys through it agree with the new composition order. The exact-key test (`api/cron/agent-evaluate.tickStamps.flagOff.test.js:196-205`) and the frozen golden (`api/_utils/__fixtures__/tickStampsEntryGolden.flagOff.json`) are **byte-unchanged**; the golden was not regenerated. Under the harness's frozen clock `tickMs` is 0, like `buildMs` and `callMs`.
- **The flag-on shape test** (`api/cron/agent-evaluate.tickStamps.flagOn.test.js:386`) enumerates `[...BASE_ENTRY_KEYS, 'heard', 'evidence', 'vintages', 'candidates']` — it moved with the list and needed no edit.

## 5. D2 — `agentEvalRuns/{runId}`

### 5.1 The document

`runId` = the run's start instant as an ISO string (`:355`), which is also `startedAt`. Composed by the pure `composeEvalRunRecord` (`:521`), written by `writeEvalRunRecord` (`:545`) with `set`, bounded by the shared `withTimeout` (`api/_utils/intraday/evaluatorHook.js:20` — the intraday hook's 2-s helper, imported rather than copied, `:122`).

| Field | Meaning |
|---|---|
| `startedAt` | the handler's start instant (= `runId`) |
| `endedAt` | the instant the record is composed, in the `finally` |
| `wallMs` | `endedAt − startedAt`: the whole run including the beats; excludes the record's own write |
| `budgetMs` | `TIME_BUDGET_MS` (290 000) |
| `battlesTotal` | the LOOP's population: the active battles left after the expiry loop (`:373`) |
| `evaluated` | battles the LOOP evaluated: `summary.evaluated − evaluatedBefore` (`:551`) — see 5.2 |
| `lockSkipped` | battles the loop found locked by another invocation (`:840`) |
| `deferred` | battles the loop never reached (the tail after the budget break, `:414`) |
| `deferredBattleIds` | the first 200 of them, in loop (rotation) order |
| `deferredTruncated` | how many deferred ids are NOT listed (`deferred − 200`, else 0) |
| `triggered` | ticks that passed the trigger gate (existing `summary.triggered`) |
| `modelCalls` | `messages.create` requests dispatched — counted in the `finally` around the call, so a call that throws still counts (`:2665`) |
| `budgetSkipped` | ticks the per-battle pre-call guard skipped (`:2551`) — distinct from the loop-level deferral |

`battlesTotal − evaluated − lockSkipped − deferred` is the loop's error and degraded-quote exits, which the prompt's field list does not carry; both are logged. ~26 documents per weekday: the schedule is `*/15 13-21 UTC Mon–Fri` (`vercel.json:157-158`) and `isMarketOpen` admits 09:30 ≤ t < 16:00 ET (`api/_utils/marketSchedule.js:253-270`), i.e. the 26 slots 09:30…15:45 ET in both EDT and EST. No TTL in this build, per the prompt.

### 5.2 Three semantics decisions

1. **A "run" is an invocation past the market-hours gate** (`:352-355`). The ten market-closed invocations per weekday do expiry and sweeps only, evaluate nothing, and write no record — which is also what makes the prompt's "~26 per weekday" true. A market-open run with **no** active battles still writes one (`battlesTotal: 0`).
2. **`evaluated` is the loop's.** `completeBattle` increments `summary.evaluated` for every expiry completion (`:6194`), before the loop ever runs, so the response's `evaluated` mixes completions with evaluations. The record fences them off with a snapshot taken at the gate (`evaluatedBefore`, `:355`); otherwise `battlesTotal` and `evaluated` would not reconcile on any day with a completion. The HTTP response's `evaluated` keeps its historic meaning.
3. **The deferral count is now exact** (`:410-419`). The old `activeBattles.length − summary.evaluated − summary.errors` (`@591b714d :392`) counted every lock-skipped battle a second time (it is neither evaluated nor errored) and subtracted expiry completions (which were never in the list). The deferred set is now the literal tail `activeBattles.slice(index)` — so `skipped`'s **value** changes on any run with a lock-skip or a completion. Its keys and meaning ("lock-skips plus deferrals") do not; the value is now what the name says.

### 5.3 The split

`summary` gains `lockSkipped` and `deferred` (`:229`), appended so every existing key keeps its place. The lock-skip site increments both `lockSkipped` and `skipped` (`:840-841`, with the `(x || 0) + 1` idiom because many callers pass partial summaries); the break increments both `deferred` and `skipped`. `skipped === lockSkipped + deferred` holds by construction on every run.

### 5.4 Written before the response

The handler used to `return res.status(…).json(…)` inside its `try`. It now records the reply (`respond`, `:238`) and sends it from the `finally` (`:484`) **after** the record (`:483`). A write issued after `res.json()` is not guaranteed to land: once the response ends the function may be frozen, which is why the repo's own post-response work goes through `waitUntil` (`api/agent/equip-bundle.js:55`, `:333`; ASSUMED as platform behaviour, VERIFIED as repo practice). Every path — market closed, no battles, the main return, the fatal catch — sets the reply, and the 401 path is before the `try` and unchanged. The record's composition sits inside the writer's `try`, so nothing in the `finally` can throw before the response goes out.

### 5.5 What the record cannot capture

A run the platform kills — the tail battle admitted just under 290 s and overrunning the 10-s buffer; the pre-call phase is unbounded (scaling audit R3/R4) — never reaches its `finally` and leaves no document. The gap in the ~26-per-day series is itself the signal.

## 6. D3 — the deferred beat

### 6.1 Server

`writeDeferredBeats` (`:572`), called after the loop (`:465-467`) when the break deferred anything:

- **Flag** read inside the writer's `try`, the tick-stamps shape: a stale hermetic mock that omits the name cannot cost the run.
- **The 5-s rule is measured against the function's hard ceiling** (`HARD_CEILING_MS = config.maxDuration * 1000`, `:510`), not `TIME_BUDGET_MS`. The break fires only once elapsed **exceeds** `TIME_BUDGET_MS` (`:409`), so the budget itself has always run out by then; what remains is the 10-s buffer `TIME_BUDGET_MS` leaves "for cleanup/response" (its own comment, `:172`). 5 s = the beats' 2-s bound + the record's 2-s bound + 1 s for the response. Measured against `TIME_BUDGET_MS` the rule could never pass (mutation M18). §12 records this reading of the prompt.
- **Cap** `DEFERRED_BEAT_CAP = 25`, the first 25 **in loop order** — the order the next run will reach them in.
- **The write**: `update({ statusFeed: FieldValue.arrayUnion(beat) })` per battle — no read, no lock (a deferred battle was never admitted) — in `Promise.allSettled`, so one missing battle costs only its own beat, all bounded to 2 s. The beat is `{ kind: 'check_deferred', at, reason: 'budget', runId }` exactly; `at` is the break instant.
- **Known limits.** (a) The beat is not re-capped: the feed's cap (100 agent / 50 PvP) is enforced by the whole-array rewrites at every tick's flush, which re-cap on the battle's next tick. (b) An overlapping invocation already mid-tick on a deferred battle (the lock is stealable at 120 s while a run can last 290 s) rewrites the whole `statusFeed` from its own earlier read, which can drop the beat. The run document still lists the battle. Both are acceptable for an advisory line and are stated so the flip PR knows.

### 6.2 Client — the tape line

- **Copy** (`src/screens/battleView/battleViewCopy.js:541-542`): `checkDeferredEyebrow: 'Check deferred'`, `checkDeferredLine: 'The loop ran out of time before reaching this battle · next run picks it up first'` — verbatim.
- **Builder** (`src/screens/battleView/buildTape.js:343`): `buildDeferredEntries(statusFeed)` makes one `{ _type: 'checkDeferred', id, timestamp, at }` per feed entry with `kind === 'check_deferred'` **and** `reason === 'budget'` (the only reason the line describes); an unreadable instant is skipped, never sorted to the epoch. Wired into `buildTape` (`:372`). Every other feed entry stays join-only.
- **Card** (`src/screens/battleView/TapeCards.jsx:370`): `DeferredCheckLine` — the record family's flat shell (no fill, no radius, 2-px token edge), a mono eyebrow, one line, no `Read more`. Its colour is `LABEL_COLOR[WHY_KIND.ABSENT]` (`:105`): nothing was decided at a deferred check, exactly as at an absent one. No hex; `GUARDED_FILES` unchanged; no new non-test file in `src/screens/battleView/`.
- **Dispatcher — "verify the tape's kind fallback and add the row"** (`src/components/Agent/AgentChat.jsx:1505-1508`, `:1543`). The fallback, VERIFIED at HEAD, was `else → <MessageBubble>`: a tape entry of a kind the dispatcher did not know rendered as an **empty speech bubble** (`@591b714d AgentChat.jsx:1539-1560`). The row is added, and the fallback now renders a bubble only for `_type === 'message'` — an unknown kind renders nothing. The flag-off path (`tapeEntries` null) only ever carries messages and `'trade'` items, so it is unchanged.
- **Other tape consumers**, VERIFIED to fall back safely: the peek line (`derivePeekLine.js:62-90`) and the character bubble (`deriveBubble.js:94` onward) return null for a kind they do not know and step past it; the scope filter answers false (`scopeTape.js:103-112`) — a deferral names no piece; a deferred line between two quiet checks breaks their `{n} checks · no change` run (a run stands for checks that ran back to back). The peek strip therefore never shows "Check deferred" — a UX choice left to the founder (§14).

## 7. Ratchets

| Ratchet | Result |
|---|---|
| `src/config/flagPinGuard.test.js` `DARK_BY_DESIGN` | Entry added (`:178`) with its runway note. |
| Pin test | `src/config/evalDeferredBeatFlags.test.js` (new): the value pin, the scannable export + `Pinned by:` pointer, the DARK_BY_DESIGN registration, and the docstring's flip map. `src/config/featureFlags.js:2738` carries the pointer. |
| `api/_utils/compositionProtectedStoresAllowlist.json` | **No row — deliberately.** The scan lists a site only when its collection is protected or unresolvable (`api/_utils/compositionProtectedStoresScan.js:355-360`). Both new sites resolve to non-protected literals: `api/cron/agent-evaluate.js::writeEvalRunRecord::set::agentEvalRuns` and `…::writeDeferredBeats::update::agentBattles` are in the scan's `all` and absent from `needsListing`, which is unchanged (`processAgentBattle::update::unresolved` only, the lock transaction's pre-existing site). A row for either would fail the stale row (`api/_utils/compositionProtectedStores.scan.test.js:64-67`). Scanner output reproduced in §15. |
| Flag-on shape test | Unchanged: enumerates via `BASE_ENTRY_KEYS` (§4). |
| `test/rules/` | `agentEvalRunsDenials.rules.mjs` (new, 11 rows): read (get **and** collection query) and create/update/merge/delete denied to the owner of a battle the run lists, another user, privileged claims and an unauthenticated client; positive controls (the owner reads and updates their battle); the explicit block present. Plus a default-suite source tripwire in `api/cron/agent-evaluate.evalRun.test.js`, because CI does not run the emulator suite (`.github/workflows/tests.yml:10-11`). |

## 8. Tests and the mutation table

### 8.1 The six required tests

| # | Required | Rows (`api/cron/agent-evaluate.evalRun.test.js` unless named) |
|---|---|---|
| 1 | Fake clock: a run breaking after N battles writes deferred = total − N, ids listed, `wallMs` within tolerance | `TEST 1` — six CPU battles at 97 s each: three evaluated, the fourth check at 291 s breaks; the whole record asserted (`wallMs` exactly 291 000 — tolerance 0 under the fake clock); the three unreached battles received **no write at all** |
| 2 | Lock-skips and deferrals separate; `skipped` their sum | `TEST 2` — one lock-held battle among six: `lockSkipped 1`, `deferred 2`, `skipped 3`, on the response and the record |
| 3 | Beat cap: 30 deferred → 25 beats (+ `deferredTruncated`); < 5 s → 0 beats, record complete | `TEST 3` ×3 — 30 deferred: 25 beats to the first 25 in loop order, each payload `isEqual` to `arrayUnion({ kind, at, reason, runId })`, the other 5 untouched, all 30 listed; **205** deferred: 25 beats, 200 ids, `deferredTruncated: 5` (see §12.1); 4.999 s left: no beats, record complete. Plus the 5.000-s boundary, a missing battle, and a hung beat write |
| 4 | Flag off → zero status-feed writes, record still written, entry `tickMs` present | `TEST 4` — a full-Haiku tick then deferrals: no `arrayUnion` anywhere and no write to any deferred battle; record lists them; the entry's `tickMs` is numeric and sits right after `callMs`. Anti-vacuous twin: the same fixture with the flag on beats all three |
| 5 | Record write failure → logged, run completes, response unchanged | `TEST 5` — the write refused: the response and every battle write are **byte-identical** to a recorded run; the error names the run. Plus a write that never answers: the response waits exactly the 2-s bound, then goes out |
| 6 | Tape renders `check_deferred`; frozen golden and exact-key test unmodified | `src/components/Agent/AgentChat.tapeKinds.render.test.jsx` (3 rows, real builder + dispatcher + card) and `src/screens/battleView/buildTape.test.js` (5 rows); the flag-off golden suite green and byte-unchanged |

Beyond the six: the response only gains keys; loop-scoped `evaluated` against an expiry completion; the run's model activity (one triggered tick, one dispatched call); a budget-skipped late tick; the 200-id boundary on the composer; the no-battles run; the market-closed invocation; record-before-response order; a fatal error after the gate (recorded before its 500); `tickMs` exact arithmetic (1 s before admission excluded, 2 s + 3 s after included = 5 000, and the persisted document carries the same number); `tickMs` absent on a CPU-passive tick and a lock-skip; `modelCalls` counting a call that throws; the rules source tripwire.

### 8.2 The mutation table

Each mutation was applied in a **snapshot tree** (a copy of the working tree under the session scratchpad, `node_modules` symlinked — never the working tree), the named suites run, the file restored byte-for-byte. The unmutated control over all 113 rows the mutations touch: **0 failed**. The rules mutations ran against the emulator through the suite's own `COMPOSITION_RULES_TEXT_PATH` knob.

⟪MUTATION TABLE⟫

## 9. The rotation statement

The fair-rotation sort orders active battles ascending by `cronState.lastEvalStartedAt` (`api/cron/agent-evaluate.js:402-404`; `@591b714d :384-386`). Its only writer is the full-tick final update, **gated on `haikuAttempted`** (`:4135`; `@591b714d :3969`). A deferred battle gets no write of any kind, so its key does not move, while every battle that attempted a model call this run is stamped with the current instant. So **next run, every deferred battle sorts ahead of every battle that made a model attempt this run**, and the deferred battles keep their relative order (stable sort, unchanged keys). That is the sense in which the existing order "already puts deferred battles first" — VERIFIED, with one qualification the prompt's statement leaves out: a battle reached this run **without** a model attempt (CPU-passive, a risk-only or no-trigger flush, a budget-skipped tick) also keeps its old key. Because the loop runs in ascending order, that key is ≤ the deferred battles', so such battles, and brand-new ones (key `''`), sort ahead of the deferred set (R1, `docs/audits/20260918_PHASE0_EVAL_CRON_SCALING.md:292`). Those are the cheap ticks, so the deferred set comes early but is not strictly first. No rotation change was made (out of scope).

## 10. The read path a sharding spec will use

```js
db.collection('agentEvalRuns').where('startedAt', '>=', fromIso).orderBy('startedAt').get()
```

One field, one range, ordered on the same field: served by Firestore's automatic single-field index, so no composite index and no `firestore.indexes.json` entry (ASSUMED platform behaviour; VERIFIED that the repo declares none for this collection). `startedAt` is a fixed-width UTC ISO string, so string order is time order. Server-side only (the collection is client-denied). Per row it yields `wallMs`, `battlesTotal`, `evaluated`, `deferred`, `modelCalls` and `budgetSkipped` — the per-run inputs the scaling audit could not find anywhere (`:271`).

## 11. The §2 review

⟪REVIEW RECORD⟫

## 12. Where the prompt and the tree disagreed — decided, stated, not improvised past

1. **Test 3's `deferredTruncated: 5`.** D2 defines `deferredTruncated` as the count beyond the **200-id** list cap. Test 3 asks for "30 deferred → 25 beats + `deferredTruncated: 5`", which under D2's definition is 0 (30 ≤ 200); the 5 there is the **beat** overflow (30 − 25). One field cannot mean both. **Built to D2's contract** (the data contract the cockpit's sweep and the Film Room will read: "is the list complete?"). Test 3 is met in both readings: the 30-deferred row asserts 25 beats, no beat for the other five, and all 30 listed (`deferredTruncated: 0`); a 205-deferred row binds both caps at once — 25 beats, 200 ids, `deferredTruncated: 5`. If the founder wants the beat overflow recorded as a field, that is a one-line addition — **ruling requested**.
2. **"Allowlist rows for the two new write sites."** Neither site is protected or unresolvable, so the deny-by-default scan does not list it, and a row would fail the stale check (§7). No row added; scanner output in §15. A row would only be needed if a site were written through a handle the scanner cannot resolve (a `batch` or a transaction), which this build deliberately does not do.
3. **"Only if ≥ 5 s of budget remain."** The break fires only once elapsed **exceeds** `TIME_BUDGET_MS` (`:409`, unchanged — out of scope), so the budget has always run out by the time the beat could run. Read against `TIME_BUDGET_MS`, the rule could never pass (M18). Built against the **hard ceiling** (`maxDuration`, 300 s): the 10-s cleanup buffer the budget exists to leave. 5 s = beats 2 s + record 2 s + 1 s response.
4. **"A tape line … in `battleViewCopy.js` and `TapeCards.jsx`."** At HEAD the tape is built from `trades[]` and `evaluations[]` only, and it reads the feed for the directive echo alone (`@591b714d src/screens/battleView/buildTape.js:18`). The dispatcher's fallback for a kind it does not know was an empty speech bubble. A line in those two files alone would never render, so the build also touches `buildTape.js` (the builder — token-guarded, no new file) and `AgentChat.jsx` (the dispatcher row, and the fallback that "verify the tape's kind fallback and add the row" names). This is why the diff is 15 files rather than the prompt's "≤ 8": the other additions are tests, the report, the fixture's key list, the pin file and the rules test, each of which the prompt requires.
5. **Copy note — "next run picks it up first."** True relative to every battle that made a model attempt this run; not strictly true relative to battles reached without one, or brand-new ones (§9, R1). The founder's string is used verbatim; whether to soften "first" is the founder's call.

## 13. Flip prerequisites — not built, and the flag must not flip before them

The beat's shape is `kind`/`at`, as the prompt specifies. Every other status-feed reader keys on `action` / `message` / `timestamp`. A delegated read-only survey of every non-test reader (server and client), then verified by me at the lines below: **none throws**, most ignore the beat (e.g. the activity log filters on `message || action || type`, `src/components/Agent/AgentActivityFeed.jsx:660-665`), and **four behave differently once beats exist**:

| Reader | What happens when a beat is in the feed | file:line |
|---|---|---|
| Tournament "Live feed" (Flat6; spectators too) | renders a **"—" row**, newest first, and takes one of 8 slots | `src/components/Tournament/Flat6BattleView.jsx:193`, `:335` |
| Post-battle reflection prompt (Sonnet → agent memory) | prints **`[undefined] undefined: …`** inside `STATUS FEED HIGHLIGHTS`, and pushes a real entry out of the last 10 | `api/_utils/agentReflectionUtils.js:220`, `:225`, `:339` |
| League voice lane | slices the last 6 **before** dropping text-less lines, so each beat costs one real line | `src/components/League/battleArena/statusFeedToVoice.js:55-63` |
| Desk latest line (dark: `COMMAND_CENTER_SYNC_ENABLED = false`) | takes the last array element as latest → the line is hidden until a real entry lands | `src/adapters/baggerbombAdapter.js:267-277` |

All four are recorded in the flag's own docstring (`src/config/featureFlags.js:2718-2729`), so the flip PR cannot miss them. With the flag off, no beat exists and every one of them is untouched.

## 14. Findings outside this task, for separate tasking (BUILD_RULES §3)

- **F-1 (flip prerequisite, §13):** the four status-feed readers. Each fix is a one-line filter or fallback on `kind === 'check_deferred'`, or the founder may prefer beats to carry a `message`. A design choice, not a defect today.
- **F-2 (UX):** the peek strip and the character bubble step past a deferred line (§6.2). The bubble is right to (it is not speech); whether the strip should say "Check deferred" is the founder's call.
- **F-3 (pre-existing, confirmed while building):** the fair-rotation key advances only on model attempts (`:4135`), so never-triggering battles lead every sort — R1 of the scaling audit, unchanged and out of scope here.
- **F-4 (pre-existing):** a run killed mid-battle by the platform leaves no record (§5.5); the loop-level check reserves nothing for the admitted battle's pre-call phase (scaling audit R3/R4).

## 15. Verification

⟪VERIFICATION⟫
