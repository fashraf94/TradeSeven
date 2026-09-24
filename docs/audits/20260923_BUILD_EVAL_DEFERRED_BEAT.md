# Build — Eval-cron instrumentation and the deferred beat

**Date:** 2026-09-23
**Branch:** `claude/eval-deferred-beat`, cut from `origin/main` at `591b714d90a72ed6e8e5604f19a2c0fff3388fc4` after `git fetch origin`, the session's first step (BUILD_RULES §3). The remote-tracking ref was current and the tree was clean at open. The clone is shallow; no history beyond it was needed and `--unshallow` was not run.
**Commits:** `c7e3c1df` (the build) → `8e3d5337` (the draft report) → `f32995e9` (the §2 review fixes: code and tests) → `4c75ba15` (this report, pending the last refuter) → `039df27d` (the colour row in the form that refuter preferred). **Code HEAD: `039df27d`.** This report's final text rides one more commit, docs only, on top; that commit is the branch head the PR shows.
**Prompt:** *Build — Eval cron instrumentation and the deferred beat*: three items (D1 `tickMs`, D2 the run document, D3 the deferred beat) and nothing else.
**Basis:** `docs/audits/20260918_PHASE0_EVAL_CRON_SCALING.md`: `:271` (no per-battle wall time anywhere), `:293` (R2: `summary.skipped` conflates lock-skips with deferrals and is never persisted), `:298` (R7: `tickMs` on the entry). Also `docs/audits/20260923_PHASE0_COCKPIT.md` §6.4 (`:159`: "a deferred battle still gets no tick, no lock, no record"). All four were re-read this session. VERIFIED.
**Fence:** `git diff origin/main --name-only` ∩ BUILD_RULES §1 = **∅** (§3). No fenced function is edited, and none is newly called.
**Crons do not run on Vercel preview** (BUILD_RULES §6). Nothing here can be seen on a preview deploy. Verification is the suites below, then the first production runs after the founder's merge. The run document and `tickMs` go live at merge; the beat stays dark.
**For Astra's review** (per the prompt, relayed by the founder; this PR requests no reviewers, per BUILD_RULES §2): the prompt expected ≤ 8 files, and the branch has 21 (11 source, 9 test, 1 report; §12.4 explains why). The source to read first is `api/cron/agent-evaluate.js` (§4–§6), then the tape's `buildTape.js`, `TapeCards.jsx` and `AgentChat.jsx` (§6.2), and the two mirrors, `derivePeekLine.js` and `deriveBubble.js`.
**Markers:** every claim about the code carries `file:line`. It is VERIFIED (read at that line this session) unless marked ASSUMED. Line numbers refer to the branch tree unless marked `@591b714d`.

---

## Executive verdict table

| # | Item | Verdict | Status |
|---|---|---|---|
| D1 | `tickMs` on every evaluation entry | **Built.** Measured from admission (the lock) to the authoritative final update: stamped at admission, composed right after `callMs`, restamped just before the write. It enters through the sanctioned `TIMING_ENTRY_KEYS` list. The frozen golden and the exact-key test pass **unmodified**. | VERIFIED |
| D2 | `agentEvalRuns/{runId}`, always on | **Built.** One 13-field document per evaluation run, written in the handler's `finally`, bounded to 2 s and never throwing. It is sent **before** the response. `summary` gains `lockSkipped` and `deferred`, and `skipped` is their sum. Rules deny every client. | VERIFIED |
| D3 | The deferred beat, dark | **Built, dark.** `EVAL_DEFERRED_BEAT_ENABLED = false` (DARK_BY_DESIGN plus a pin). When on, each unreached battle gets one `check_deferred` beat via `arrayUnion`: the first 25 in loop order, only with ≥ 5 s of the hard ceiling left, and each write bounded to 2 s. The tape renders a `Check deferred` record line, and the peek strip and the character bubble mirror it. A tape kind the stream does not know now renders nothing instead of an empty bubble. | VERIFIED |
| R | Ratchets | Flag guard ✓ (DARK_BY_DESIGN, pin, `Pinned by:`). Rules ✓ (emulator suite, 12 rows, plus a default-run source tripwire). Flag-on shape test: **no edit needed**, because it enumerates through `BASE_ENTRY_KEYS`. Protected-stores allowlist: **no row needed**. Both new write sites resolve to non-protected literal collections, and a row would fail the stale check (§7). | VERIFIED |
| T | Tests | The six required tests plus the rows around them: 53 new rows across six suites, plus 12 emulator rows. **52 source mutations, every one RED** at a named row. The unmutated control is green (0 of 168). One ruleset mutation was also run against the emulator: RED (§8). | VERIFIED |
| F | §1 fence | `git diff origin/main --name-only` ∩ §1 = ∅. | VERIFIED |
| RV | §2 review | Required (21 files, about 1,980 changed lines). Four adversarial lenses and four independent refuters, each on its own snapshot tree. 35 findings: **no merge blocker**; 26 confirmed, 8 partly confirmed, 1 refuted. Every confirmed finding is fixed or recorded (§11). Explicit `vite build`: exit 0. | VERIFIED |
| ⚠ | **Flip-blocking: two founder rulings** | (1) **The copy.** "next run picks it up first" is usually false: battles reached without a model call sort ahead of the deferred set, a 15:45 ET deferral is followed by the battle's completion, and at scale the next run may not reach it at all (§9). (2) **Repeats.** A battle deferred run after run collects identical, untimed lines (§6.1). Neither matters while the flag is off. | VERIFIED |
| ⚠ | Other flip prerequisites | Other status-feed readers treat a beat differently: a "—" row in the tournament feed, `{}` for spectators, `[undefined] undefined: null` in the reflection prompt, the voice lane's window, the Desk's latest line. None throws (§13). | VERIFIED |
| ⚠ | Prompt discrepancies | Five, each decided and stated rather than improvised past (§12). The founder should look at test 3's `deferredTruncated: 5` and the copy. | — |

---

## 1. Files touched

21 files: 11 source (one of them a comment-only edit, one a test fixture), 9 test, 1 report. §12.4 explains why this is more than the prompt's "≤ 8".

| File | Change | Anchors (branch tree) |
|---|---|---|
| `api/cron/agent-evaluate.js` | D1, D2 and D3 server | flag import `:83`; `withTimeout` import `:120-122`; `summary` split `:227-229`; run-record and reply plumbing `:230-242`; the gate and `evalRun` `:351-359`; `battlesTotal` `:377`; the break and the deferred set `:411-425`; the beats `:468-471`; replies `:354`, `:375`, `:480`, `:485`; the `finally` `:486-491`; constants `:503-516`; `composeEvalRunRecord` `:527`; `writeEvalRunRecord` `:551`; `writeOutcome` `:570`; `writeDeferredBeats` `:584`; `lockSkipped` `:854`; `tickAdmittedAtMs` `:864`; `budgetSkipped` `:2565`; `modelCalls` `:2679`; the entry's `tickMs` `:3846`; the restamp `:4243` |
| `api/_utils/__fixtures__/tickStampsHarness.js` | `TIMING_ENTRY_KEYS` gains `'tickMs'` | `:74-79` |
| `firestore.rules` | `agentEvalRuns/{runId}`: deny all | `:880-890` |
| `src/config/featureFlags.js` | `EVAL_DEFERRED_BEAT_ENABLED = false`, docstring (always-on list, flip prerequisites, FLIP MAP) | `:2697-2756` |
| `src/config/flagPinGuard.test.js` | DARK_BY_DESIGN entry and runway note | `:178-179` |
| `src/config/evalDeferredBeatFlags.test.js` | **new**: the pin (6 rows) | `:30-68` |
| `src/screens/battleView/battleViewCopy.js` | the two founder strings | `:536-542` |
| `src/screens/battleView/buildTape.js` | `TAPE_KIND.CHECK_DEFERRED`, `FEED_KIND_CHECK_DEFERRED`, `buildDeferredEntries`, wired into `buildTape` | `:18-21`, `:62`, `:71`, `:343-362`, `:372` |
| `src/screens/battleView/TapeCards.jsx` | `DEFERRED_EYEBROW_COLOR`, `DeferredCheckLine` | `:100-105`, `:363-378` |
| `src/components/Agent/AgentChat.jsx` | the dispatcher row; the fallback now renders a bubble only for messages | `:23`, `:1505-1508`, `:1543` |
| `src/screens/battleView/derivePeekLine.js` | the strip mirrors the line (review fix) | `:19-20`, `:83-88` |
| `src/screens/battleView/deriveBubble.js` | the bubble mirrors the line (review fix) | `:20-21`, `:52`, `:142-152` |
| `src/screens/AgentBattleScreen.jsx` | comment only: the unread mark now also counts the beat, because the tape renders it (review fix) | `:1650-1663` |
| `api/cron/agent-evaluate.evalRun.test.js` | **new**: 32 rows on the real handler and the real `processAgentBattle` | §8 |
| `api/cron/agent-evaluate.tickStamps.pins.test.js` | pin 4's timing-key list gains `tickMs` (review fix) | `:228-229` |
| `src/components/Agent/AgentChat.tapeKinds.render.test.jsx` | +5 rows | `:345-416` |
| `src/screens/battleView/buildTape.test.js` | +6 rows | `:741-798` |
| `src/screens/battleView/derivePeekLine.test.js` | +2 rows | `:196-214` |
| `src/screens/battleView/deriveBubble.test.js` | +2 rows | `:302-331` |
| `test/rules/agentEvalRunsDenials.rules.mjs` | **new**: emulator suite, 12 rows | `:95-144` |
| `docs/audits/20260923_BUILD_EVAL_DEFERRED_BEAT.md` | this report | — |

## 2. Always on vs flag-gated

| Ships LIVE at merge (no flag) | Behind `EVAL_DEFERRED_BEAT_ENABLED` (false) |
|---|---|
| `tickMs` on every evaluation entry (D1) | The `check_deferred` status-feed write (D3) |
| `agentEvalRuns/{runId}` on every evaluation run (D2) | Every tape line, strip line and bubble for it: the builder renders only `check_deferred` entries, and only the beat writes them |
| `lockSkipped` / `deferred` in the response; `skipped` = their sum, now EXACT (§5.2) | |
| `modelCalls` / `budgetSkipped` counters: always on the run document, and in the response when non-zero | |
| The response is sent from the handler's `finally`, after the run document (§5.4) | |
| The handler's fatal catch survives a thrown non-Error (review fix) | |
| `firestore.rules`: the `agentEvalRuns` deny block | |
| Client (the controller path, which is live): the dispatcher row, and the fallback that renders an unknown tape kind as nothing | |

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

The §1 list was re-read this session (`docs/BUILD_RULES.md:14-24`). `api/cron/agent-evaluate.js` is not on it. The build adds no new call into a fenced module; fenced code is only called by lines the build leaves in place. The test suite doubles `agentEvalPromptAssembly.js`'s `buildLiveContextBlock` to make a prompt build throw, and never edits it. The decider cannot see `tickMs`: `formatRecentEvals` reads exactly eight whitelisted entry keys by dot access and nothing else. Pin 4 enforces this (`api/cron/agent-evaluate.tickStamps.pins.test.js:222-245`), and its excluded-key list now names `tickMs` too.

## 4. D1: `tickMs`

- **Start: admission.** `const tickAdmittedAtMs = Date.now()` runs immediately after the lock transaction commits and the lock-skip return is behind it (`api/cron/agent-evaluate.js:864`). Time inside the lock transaction is not the tick's.
- **End: the authoritative final update.** The entry composes `tickMs: Date.now() - tickAdmittedAtMs` right after `callMs` (`:3846`). The value is **restamped** just before `await battleRef.update(finalUpdate)` (`:4243-4244`). `evaluations` holds the same `evaluation` object (`:4118`), so the restamp rides the write. `tickMs` therefore covers everything from admission to that write, and excludes only the write's own round trip.
- **Where it lands, and where it does not** (review L4-F4). `:3793` is the only composer of an evaluation entry, and `:4118` the only place the array is rebuilt. Between the trigger count (`:2487`) and the write there is no early return, so every *triggered* tick that completes carries `tickMs`: model failures, budget skips, and refresh or build failures included. A tick that never triggers (CPU-passive, no-trigger or risk-only flushes, degraded quotes, lock-skips) writes no entry, so it has no `tickMs`. A tick that throws writes no entry either. The prompt scoped D1 to "each evaluation entry", and it was built to that. Per-tick wall time for non-triggered ticks remains unmeasured.
- **What it leaves out** (review L1-F3). Work after the write still costs the loop time but falls outside `tickMs` by definition: narration and anticipation dispatch, and tick-capture finalization. **Summed `tickMs` understates the loop's wall time.** A sharding spec should size runs from the run document's `wallMs`. One gap is known and unpinned: the D1 row charges post-composition time through the shadow log (`:4076`). The only other awaited work before the restamp is the dark shadow capture (`:4215-4216`, `SHADOW_ASSEMBLY_ENABLED = false`, `src/config/featureFlags.js:1482`). That capture is inside `tickMs` by construction, but no row pins it while it is dark: a restamp moved above it survives (review L3-F9, partly confirmed). Pin it when the flag is re-enabled.
- **The sanctioned list.** `TIMING_ENTRY_KEYS` gains `'tickMs'` after `'callMs'` (`api/_utils/__fixtures__/tickStampsHarness.js:79`). `BASE_ENTRY_KEYS` (`:117`) and every suite that enumerates entry keys through it therefore agree with the new order. The exact-key test (`api/cron/agent-evaluate.tickStamps.flagOff.test.js:196-205`) and the frozen golden (`api/_utils/__fixtures__/tickStampsEntryGolden.flagOff.json`) are **byte-unchanged** against `origin/main`, and the golden was not regenerated. Mutation M3 shows `tickMs` reaches those comparisons only through that list. Under the harness's frozen clock `tickMs` is 0, as `buildMs` and `callMs` are.
- **The flag-on shape test** (`api/cron/agent-evaluate.tickStamps.flagOn.test.js:386`) enumerates `[...BASE_ENTRY_KEYS, 'heard', 'evidence', 'vintages', 'candidates']`. It moved with the list and needed no edit.

## 5. D2: `agentEvalRuns/{runId}`

### 5.1 The document

`runId` is the handler's start instant as an ISO string (`:359`), and it is also `startedAt`. The pure `composeEvalRunRecord` (`:527`) composes the document, and `writeEvalRunRecord` (`:551`) writes it with `set`. The write is bounded by the shared `withTimeout` (`api/_utils/intraday/evaluatorHook.js:20`), the intraday hook's 2-s helper, imported rather than copied (`:120-122`).

| Field | Meaning |
|---|---|
| `startedAt` | the handler's start instant (= `runId`): before the expiry loop and the sweeps, not at the market gate |
| `endedAt` | the instant the record is composed, in the `finally`, after the beats |
| `wallMs` | `endedAt − startedAt`: the whole run, beats included; excludes the record's own write |
| `budgetMs` | `TIME_BUDGET_MS` (290 000) |
| `battlesTotal` | the LOOP's population: the active battles left after the expiry loop (`:377`) |
| `evaluated` | battles the LOOP evaluated: `summary.evaluated − evaluatedBefore` (`:557`); see 5.2 |
| `lockSkipped` | battles the loop found locked by another invocation (`:854`) |
| `deferred` | battles the loop never reached: the tail after the budget break (`:418`) |
| `deferredBattleIds` | the first 200 of them, in loop (rotation) order |
| `deferredTruncated` | how many deferred ids are NOT listed (`deferred − 200`, else 0) |
| `triggered` | ticks that passed the trigger gate (the existing `summary.triggered`, `:2487`) |
| `modelCalls` | `messages.create` requests dispatched, counted in the `finally` around the call, so a call that throws still counts (`:2679`) |
| `budgetSkipped` | ticks the per-battle pre-call guard skipped (`:2565`), distinct from the loop-level deferral |

**Two identities, and what they leave out** (review L1-F2, L1-F5, L4-F5):

- `battlesTotal = evaluated + lockSkipped + deferred + (loop errors + degraded-quote exits)`. After a crash mid-loop, add the battles the loop never reached. The prompt's field list carries neither of the last two terms, so a record does not reconcile on its own when either occurs. Both are logged. If the founder wants an `errors` field, it must count **loop** errors only, because the expiry loop also adds to `summary.errors`. **Founder ruling.**
- `triggered − modelCalls − budgetSkipped = refresh failures + prompt-build failures`, plus any triggered tick that threw before dispatching (which is also a loop error). All of these are triggered ticks that sent no request.

About 26 documents per weekday: the schedule is `*/15 13-21 UTC Mon–Fri` (`vercel.json:157-158`), and `isMarketOpen` admits 09:30 ≤ t < 16:00 ET (`api/_utils/marketSchedule.js:253-270`). That leaves the 26 slots 09:30…15:45 ET, in both EDT and EST. No TTL, per the prompt.

### 5.2 Three semantics decisions

1. **A "run" is an invocation past the market-hours gate** (`:351-359`). The ten market-closed invocations per weekday only do expiry and sweeps. They evaluate nothing and write no record, which is also what makes the prompt's "~26 per weekday" true. A market-open run with **no** active battles still writes one (`battlesTotal: 0`).
2. **`evaluated` is the loop's.** `completeBattle` increments `summary.evaluated` for every expiry completion (`:6209`), before the loop runs, so the response's `evaluated` mixes completions with evaluations. The record fences them off with a snapshot taken at the gate (`evaluatedBefore`, `:359`); otherwise `battlesTotal` and `evaluated` would not reconcile on any day with a completion. The HTTP response's `evaluated` keeps its old meaning.
3. **The deferral count is now exact** (`:413-424`). The old `activeBattles.length − summary.evaluated − summary.errors` (`@591b714d :392-394`) counted every lock-skipped battle twice (it is neither evaluated nor errored) and subtracted expiry completions, which were never in the list. The deferred set is now the literal tail, `activeBattles.slice(index)`. So `skipped`'s **value** changes on any run with a lock-skip or a completion. Its keys and its meaning ("lock-skips plus deferrals") do not; the value now matches the name.

### 5.3 The split

`summary` gains `lockSkipped` and `deferred` (`:229`), appended so every existing key keeps its place. The lock-skip site increments `lockSkipped` and `skipped` together (`:854-855`), using the `(x || 0) + 1` idiom because many callers pass partial summaries. The break increments `deferred` and `skipped` together (`:421-422`). So `skipped === lockSkipped + deferred` holds on every run by construction.

### 5.4 Written before the response

The handler used to `return res.status(…).json(…)` inside its `try`. It now records the reply (`respond`, `:242`) and sends it from the `finally` (`:490`), **after** the record (`:489`). A write issued after `res.json()` is not guaranteed to land: once the response ends, the function may be frozen. That is why the repo's own post-response work goes through `waitUntil` (`api/agent/equip-bundle.js:55`, `:333`; ASSUMED as platform behaviour, VERIFIED as repo practice). Every path sets the reply: market closed, no battles, the main return and the fatal catch. The 401 path sits before the `try` and is unchanged. Composition runs inside the writer's `try`, so nothing in the `finally` can throw before the response goes out. The catch now survives a thrown non-Error (`err?.message ?? String(err)`, `:485`).

**The cost, accepted** (review L1-F1, partly confirmed by R1). If the loop ends within the write's 2-s bound of the 300-s ceiling, the response can go out after the ceiling. R1 reproduced this: a loop ending at 299.5 s with a hung write sent the response at 301.5 s, and a healthy 600-ms write sent it at 300.1 s. Against `origin/main`, the only loss is that invocation's HTTP status (a platform 504 instead of 200). The summary is already logged (`:478`), and nothing in the repo reads the response. Clamping the write to the time left would give up the record to save a status nobody reads, so it was not clamped. The comment at `:230-239` says so.

### 5.5 What the record cannot capture

- **A run the platform kills** never reaches its `finally` and leaves no document. Examples: the tail battle admitted just under 290 s overruns the 10-s buffer (the pre-call phase is unbounded; scaling audit R3/R4), or the process runs out of memory. A missing market-hours slot in the ~26-per-day series is the signal. The handler comment and the test title say "throws", not "however the run ends" (review L4-F3).
- **A run that throws before the gate** (in the expiry loop or a sweep) is not yet a run and leaves no document. That is by design.
- **A run whose loop aborts part-way** (R1's non-Error case, §14 F-1) is recorded, but the battles it never reached are not "deferred", because no budget break happened. They fall into the unreconciled remainder in 5.1.

## 6. D3: the deferred beat

### 6.1 Server

`writeDeferredBeats` (`:584`) is called after the loop (`:468-471`) when the break deferred anything.

- **The flag** is read inside the writer's `try`, the tick-stamps shape. A stale hermetic mock that omits the name cannot cost the run.
- **The 5-s rule is measured against the function's hard ceiling** (`HARD_CEILING_MS = config.maxDuration * 1000`, `:516`), not against `TIME_BUDGET_MS`. The break fires only once elapsed **exceeds** `TIME_BUDGET_MS` (`:413`), so the budget has always run out by then. What remains is the 10-s buffer `TIME_BUDGET_MS` leaves "for cleanup/response" (its own comment, `:172`). 5 s = the beats' 2-s bound + the record's 2-s bound + 1 s for the response. Measured against `TIME_BUDGET_MS`, the rule could never pass (M18). §12.3 records this reading of the prompt.
- **Cap:** `DEFERRED_BEAT_CAP = 25`, the first 25 **in loop order**.
- **The write:** `update({ statusFeed: FieldValue.arrayUnion(beat) })` per battle, with no read and no lock (a deferred battle was never admitted). The writes run in parallel under `Promise.allSettled`, **each bounded to 2 s on its own** (review L2-F6). One missing or hung battle costs only its own beat and its own log line. A write that timed out is logged as "unconfirmed (it may still land)", not "not written" (`writeOutcome`, `:570`; review L1-F8). The beat is exactly `{ kind: 'check_deferred', at, reason: 'budget', runId }`, where `at` is the break instant.
- **Known limits, all flip-time:**
  - (a) The beat is not re-capped. The feed's cap (100 agent / 50 PvP) is enforced by each tick's whole-array rewrite, which re-caps on the battle's next tick.
  - (b) **Best effort** (review L2-F5). An overlapping invocation already mid-tick on a deferred battle rewrites the whole `statusFeed` from its own earlier read, and can drop the beat. The lock is stealable at 120 s while a run can last 290 s. Other status-feed writers already carry the same risk. The run document still lists the battle.
  - (c) **Repeats — founder ruling, flip-blocking** (review L2-F3). The spec says one beat per run per unreached battle, and there is no per-battle limit. A battle deferred run after run collects identical, untimed lines, up to ~26 a day. They crowd the short windows other readers keep: 10, 8 and 6 entries (§13).
  - (d) With the flag on, the beats run before the always-on record and use up to 2 s of its margin (review L2-F8). R2 confirmed this but found it theoretical: the record's write is still issued with ≥ 3 s left.

### 6.2 Client: the tape line

- **Copy** (`src/screens/battleView/battleViewCopy.js:541-542`): `checkDeferredEyebrow: 'Check deferred'` and `checkDeferredLine: 'The loop ran out of time before reaching this battle · next run picks it up first'`, verbatim. The second clause needs a ruling before the flip (§9, §12.5).
- **Builder** (`src/screens/battleView/buildTape.js:343`): `buildDeferredEntries(statusFeed)` makes one `{ _type: 'checkDeferred', id, timestamp, at }` for each feed entry with `kind === 'check_deferred'` **and** `reason === 'budget'`, the only reason the line describes. An unreadable instant is skipped rather than sorted to the epoch. A beat with no `runId` is keyed by its instant. It is wired into `buildTape` at `:372`, and every other feed entry stays join-only.
- **Card** (`src/screens/battleView/TapeCards.jsx:370`): `DeferredCheckLine` uses the record family's flat shell (no fill, no radius, a 2-px token edge), a mono eyebrow and one line, with no `Read more`. Its colour is `LABEL_COLOR[WHY_KIND.ABSENT]` (`:105`), which renders as `var(--ft-text-muted)`: nothing was decided at a deferred check, just as at an absent one. It uses no hex. `GUARDED_FILES` is unchanged, and no new non-test file was added to `src/screens/battleView/`.
- **Dispatcher: "verify the tape's kind fallback and add the row"** (`src/components/Agent/AgentChat.jsx:1505-1508`, `:1543`). The fallback was verified at HEAD: it was `else → <MessageBubble>`, so a tape entry of a kind the dispatcher did not know rendered as an **empty speech bubble** (`@591b714d AgentChat.jsx:1541`). The row is added, and the fallback now renders a bubble only for `_type === 'message'`, so an unknown kind renders nothing. "Must not render blank" is read as "never an empty bubble". A generic placeholder line would be copy nobody has ruled, so the founder can ask for one if wanted. The legacy path (`tapeEntries` null; dead in production because `BATTLE_VIEW_CONTROLLER_ENABLED = true`, `src/config/featureFlags.js:2142`) filters the feed on `action`, which a beat does not have. A row pins that the legacy path is unchanged by a beat.
- **The mirrors — §9 display agreement** (review L2-F2 and L4-F1, both confirmed). As first built, the peek strip and the character bubble stepped past the line while the unread badge (which counts every rendered tape entry) counted it. R4 mounted the real screen with the live flags and one beat: the badge showed `1` and the bubble re-showed an already-seen check, while the pane's chat said "Check deferred". The strip now returns the line's own eyebrow (`derivePeekLine.js:83-88`; no time, like a folded run). The bubble mirrors the line's two strings in its own colour (`deriveBubble.js:142-152`). The badge, bubble, strip and stream now name the same entry. The scope filter still answers false for the line (`scopeTape.js:103-112`), because a deferral names no piece. A deferred line between two quiet checks breaks their `{n} checks · no change` run, since a run stands for checks that ran back to back.

## 7. Ratchets

| Ratchet | Result |
|---|---|
| `src/config/flagPinGuard.test.js` `DARK_BY_DESIGN` | Entry added (`:178`). Its runway note names the flip prerequisites and the registration-row turnaround. |
| Pin test | `src/config/evalDeferredBeatFlags.test.js` (new, 6 rows): the value pin; the scannable export and its `Pinned by:` pointer; the DARK_BY_DESIGN registration; and the docstring's FLIP MAP, including the registration-row turnaround (review L3-F7: a flip that followed the old map went red) and both flip-blocking rulings. `src/config/featureFlags.js:2755` carries the pointer. |
| `api/_utils/compositionProtectedStoresAllowlist.json` | **No row, deliberately.** The scan lists a site only when its collection is protected or unresolvable (`api/_utils/compositionProtectedStoresScan.js:355-360`). Both new sites resolve to non-protected literals: `api/cron/agent-evaluate.js::writeEvalRunRecord::set::agentEvalRuns` and `…::writeDeferredBeats::update::agentBattles` appear in the scan's `all` and are absent from `needsListing`. That set is unchanged: it holds only `processAgentBattle::update::unresolved`, the lock transaction's existing site. A row for either would fail the stale check (`api/_utils/compositionProtectedStores.scan.test.js:64-67`). The scan suite passes in the full run (§15). |
| Flag-on shape test | Unchanged: it enumerates via `BASE_ENTRY_KEYS` (§4). |
| `test/rules/` | `agentEvalRunsDenials.rules.mjs` (new, 12 rows). Read (a get **and** a collection query) and create/update/merge/delete are denied to the owner of a battle the run lists, another user, privileged claims and an unauthenticated client. Positive controls: the owner reads and updates their own battle. Two posture rows: **exactly one** block for the collection, whose only statement is `allow read, write: if false;`, and the root default-deny is the only wildcard-first path (review L3-F5: the first version checked only the first statement). |
| Default-run tripwire | CI does not run the emulator suite (`.github/workflows/tests.yml:10-12`), so `api/cron/agent-evaluate.evalRun.test.js:704-718` checks the same posture from the source in the ordinary run. An OR'd grant inside the block (M51) and a wildcard-first grant (M52) both go red. |

## 8. Tests and the mutation table

### 8.1 The six required tests

Rows are in `api/cron/agent-evaluate.evalRun.test.js` unless named. The seam is the **real** exported handler, plus the real `processAgentBattle` for D1. It never re-implements the loop. Time is a **fake clock**, advanced only where a row says so, so every elapsed figure is exact arithmetic.

| # | Required | Rows |
|---|---|---|
| 1 | Fake clock: a run breaking after N battles writes deferred = total − N, ids listed, `wallMs` within tolerance | `:301` TEST 1 — six CPU battles at 97 s each, plus 1 s charged **before the market gate**. Three are evaluated, and the fourth check at 292 s breaks. The whole record is asserted: `wallMs` exactly 292 000 (tolerance 0 under the fake clock), `runId` = `startedAt` = the handler's start, not the gate's. The three unreached battles receive **no write at all**. `:332`: the list is in rotation order, not query order. |
| 2 | Lock-skips and deferrals separate; `skipped` their sum | `:347` TEST 2 — one lock-held battle among six: `lockSkipped 1`, `deferred 2`, `skipped 3`, on both the response and the record |
| 3 | Beat cap: 30 deferred → 25 beats (+ `deferredTruncated`); < 5 s → 0 beats, record complete | `:500` 30 deferred: 25 beats to the first 25 in loop order, each payload `isEqual` to `arrayUnion({ kind, at, reason, runId })`, the other five untouched, all 30 listed. `:515` **205** deferred: 25 beats, 200 ids, `deferredTruncated: 5` (§12.1). `:523` 4.999 s left: no beats, record complete. Also `:532` the 5.000-s boundary; `:538` a missing battle; `:560` hung beats awaited for exactly 2 s; `:576` one hung beat among three; `:586` `wallMs` includes the beats. |
| 4 | Flag off → zero status-feed writes, record still written, entry `tickMs` present | `:598` TEST 4 — a full model tick, then deferrals: no `arrayUnion` anywhere and no write to any deferred battle. The record lists them. The entry's `tickMs` is a finite number ≥ 0 sitting right after `callMs`. `:611` anti-vacuous twin: the same fixture with the flag on beats all three. |
| 5 | Record write failure → logged, run completes, response unchanged | `:458` TEST 5 — the write is refused. The response and every battle write are **byte-identical** to a recorded run, and the error names the run. `:477` a write that never answers: the response waits exactly the 2-s bound, then goes out. |
| 6 | Tape renders `check_deferred`; frozen golden and exact-key test unmodified | `src/components/Agent/AgentChat.tapeKinds.render.test.jsx:353-407` (5 rows: real builder, dispatcher and card; the colour; the order; the legacy path; the unknown kind). `src/screens/battleView/buildTape.test.js:747-784` (6 rows). `derivePeekLine.test.js:200-207` and `deriveBubble.test.js:312-323` (2 each: the mirrors). The flag-off golden suite is green and byte-unchanged. |

Beyond the six:

- the response only gains keys (`:358`)
- loop-scoped `evaluated` against an expiry completion (`:367`)
- the run's model activity (`:374`)
- a budget-skipped late tick (`:379`)
- a prompt build that throws: triggered, **no** model call (`:386`)
- the 200-id boundary on the composer (`:395`)
- the no-battles run (`:406`)
- the market-closed invocation (`:412`)
- record-before-response order (`:419`)
- a throw after the gate: recorded before its 500 (`:440`)
- a thrown **non-Error**: still a record and a 500 (`:448`)
- `tickMs` exact arithmetic (`:628`): 1 s before admission is excluded, and 2 s + 3 s after it are included, for 5 000; the persisted document carries the same number
- `tickMs` absent on a CPU-passive tick and a lock-skip (`:657`)
- `modelCalls` counts a call that throws (`:671`)
- the rules tripwire (`:707`, `:714`)

### 8.2 The mutation table

Each mutation was applied in a **snapshot tree**: a copy of the working tree under the session scratchpad with `node_modules` symlinked, never the working tree. The named suites were run and the file restored byte-for-byte. Each find string had to occur exactly once. **First pass**, on the build commit: M1–M33 (M30a/b against the emulator), 34 mutations, all RED, control 0 of 113. **Second pass**, below, on the review-fix tree: the first pass's 32 source mutations re-run with their find strings updated to the fixed code, plus M34–M53 for the rows the review added. **52 of 52 RED; control 0 of 168.**

| # | Mutation | Red / run | A row that goes red |
|---|---|---|---|
| M1 | tickMs restamp before the final update removed (`agent-evaluate.js`) | **1** / 32 | evalRun: “counts from the lock to the final update: time before admission is ou…” |
| M2 | admission stamped BEFORE the lock transaction (`agent-evaluate.js`) | **1** / 32 | evalRun: “counts from the lock to the final update: time before admission is ou…” |
| M3 | tickMs dropped from the sanctioned TIMING_ENTRY_KEYS list (`tickStampsHarness.js`) | **2** / 4 | flagOff: “the entry AND the whole finalUpdate are byte-identical to the golden…” (+1) |
| M4 | deferral counted by the old `length - evaluated - errors` formula (`agent-evaluate.js`) | **1** / 32 | evalRun: “TEST 2 — lock-skips and deferrals are counted apart, and `skipped` is…” |
| M5 | lock-skip not counted into lockSkipped (`agent-evaluate.js`) | **2** / 32 | evalRun: “TEST 2 — lock-skips and deferrals are counted apart, and `skipped` is…” (+1) |
| M6 | deferral not added to skipped (`agent-evaluate.js`) | **2** / 32 | evalRun: “TEST 1 — a run that breaks after N battles records deferred = total −…” (+1) |
| M7 | run document `evaluated` not loop-scoped (`agent-evaluate.js`) | **1** / 32 | evalRun: “`evaluated` is the LOOP's: an expiry completion counts in the respons…” |
| M8 | response sent BEFORE the run document (`agent-evaluate.js`) | **5** / 32 | evalRun: “the record goes out BEFORE the response — a function may be frozen on…” (+4) |
| M9 | run document write failure rethrown (`agent-evaluate.js`) | **2** / 32 | evalRun: “TEST 5 — a refused write is logged; the run completes and the respons…” (+1) |
| M10 | run document write unbounded (`agent-evaluate.js`) | **1** / 32 | evalRun: “a write that never answers is abandoned at 2 s and the response still…” |
| M11 | market-closed invocation recorded as a run (`agent-evaluate.js`) | **1** / 32 | evalRun: “a market-CLOSED invocation is not an evaluation run: no record, respo…” |
| M12 | deferred id list uncapped (`agent-evaluate.js`) | **2** / 32 | evalRun: “the list holds 200 ids and COUNTS the rest (composer, at the boundary)” (+1) |
| M13 | modelCalls not counted (`agent-evaluate.js`) | **3** / 32 | evalRun: “the run's model activity: one triggered tick, one dispatched call, no…” (+2) |
| M14 | budgetSkipped not counted (`agent-evaluate.js`) | **1** / 32 | evalRun: “a late full tick that the per-battle guard budget-skips counts as tri…” |
| M15 | beat flag ignored (beats always on) (`agent-evaluate.js`) | **2** / 32 | evalRun: “TEST 1 — a run that breaks after N battles records deferred = total −…” (+1) |
| M16 | beat cap removed (`agent-evaluate.js`) | **2** / 32 | evalRun: “TEST 3 — 30 deferred: 25 beats, to the first 25 in loop order; the ru…” (+1) |
| M17 | 5 s rule off by one (<=) (`agent-evaluate.js`) | **1** / 32 | evalRun: “the boundary: exactly 5 s left still beats” |
| M18 | 5 s rule measured against TIME_BUDGET_MS, not the hard ceiling (`agent-evaluate.js`) | **9** / 32 | evalRun: “TEST 3 — 30 deferred: 25 beats, to the first 25 in loop order; the ru…” (+8) |
| M19 | Promise.all instead of allSettled for the beats (`agent-evaluate.js`) | **3** / 32 | evalRun: “one battle's failed beat costs only that battle its beat” (+2) |
| M20 | beat shape wrong (`at` carries the run id) (`agent-evaluate.js`) | **1** / 32 | evalRun: “TEST 3 — 30 deferred: 25 beats, to the first 25 in loop order; the ru…” |
| M21 | beats go to the TAIL of the deferred set (`agent-evaluate.js`) | **1** / 32 | evalRun: “TEST 3 — 30 deferred: 25 beats, to the first 25 in loop order; the ru…” |
| M22 | beat writes unbounded (`agent-evaluate.js`) | **2** / 32 | evalRun: “beats that never answer are WAITED for, up to 2 s, then abandoned; th…” (+1) |
| M23 | builder not wired into buildTape (`buildTape.js`) | **8** / 119 | AgentChat: “renders as an engine RECORD — the flat shell, a token edge, a mono ey…” (+7) |
| M24 | dispatcher row for checkDeferred removed (`AgentChat.jsx`) | **3** / 119 | AgentChat: “renders as an engine RECORD — the flat shell, a token edge, a mono ey…” (+2) |
| M25 | dispatcher fallback reverted to MessageBubble for any kind (`AgentChat.jsx`) | **1** / 119 | AgentChat: “MUTATION ROW — a tape kind the stream has no row for renders NOTHING,…” |
| M26 | builder renders any reason (`buildTape.js`) | **1** / 119 | buildTape: “MUTATION ROW — a beat for any reason but the budget is not rendered w…” |
| M27 | builder keyed on `action` instead of `kind` (`buildTape.js`) | **11** / 119 | AgentChat: “renders as an engine RECORD — the flat shell, a token edge, a mono ey…” (+10) |
| M28 | the line's copy changed (`battleViewCopy.js`) | **1** / 119 | AgentChat: “renders as an engine RECORD — the flat shell, a token edge, a mono ey…” |
| M29 | agentEvalRuns deny block removed from firestore.rules (`firestore.rules`) | **1** / 32 | evalRun: “exactly ONE block for the collection, and it says exactly allow read…” |
| M31 | flag flipped true (`featureFlags.js`) | **3** / 12 | pin: “ships DARK: EVAL_DEFERRED_BEAT_ENABLED is false at merge — the founde…” (+2) |
| M32 | DARK_BY_DESIGN entry dropped (`flagPinGuard.test.js`) | **1** / 6 | pin: “is registered DARK_BY_DESIGN in the guard — the entry a deliberate fl…” |
| M33 | Pinned-by pointer dropped (`featureFlags.js`) | **2** / 12 | pin: “is a plain boolean export the flag-pin guard can scan, with a Pinned-…” (+1) |
| M34 | the beats' `await` removed (fire-and-forget) (`agent-evaluate.js`) | **1** / 32 | evalRun: “beats that never answer are WAITED for, up to 2 s, then abandoned; th…” |
| M35 | runId minted at the market gate, not the handler start (`agent-evaluate.js`) | **1** / 32 | evalRun: “TEST 1 — a run that breaks after N battles records deferred = total −…” |
| M36 | the whole record measured from the gate (runId and startedAt) (`agent-evaluate.js`) | **1** / 32 | evalRun: “TEST 1 — a run that breaks after N battles records deferred = total −…” |
| M37 | the record closed BEFORE the beats (end time taken at the loop's end) (`agent-evaluate.js`) | **1** / 32 | evalRun: “the run's wall time INCLUDES the beats: the record is closed after them” |
| M38 | rotation sort removed (deferred list in query order) (`agent-evaluate.js`) | **3** / 32 | evalRun: “the deferred list is in ROTATION order — oldest `lastEvalStartedAt` f…” (+2) |
| M39 | rotation sort reversed (newest first) (`agent-evaluate.js`) | **1** / 32 | evalRun: “the deferred list is in ROTATION order — oldest `lastEvalStartedAt` f…” |
| M40 | `modelCalls` counted at the ATTEMPT, before the build (`agent-evaluate.js`) | **1** / 32 | evalRun: “a prompt build that throws counts as triggered with NO model call — …” |
| M41 | beat timeout reverted to ONE outer bound over all writes (`agent-evaluate.js`) | **2** / 32 | evalRun: “beats that never answer are WAITED for, up to 2 s, then abandoned; th…” (+1) |
| M42 | a timed-out write reported as "not written" (writeOutcome flattened) (`agent-evaluate.js`) | **2** / 32 | evalRun: “beats that never answer are WAITED for, up to 2 s, then abandoned; th…” (+1) |
| M43 | the handler catch reverted to `err.message` (a non-Error throw crashes the finally) (`agent-evaluate.js`) | **1** / 32 | evalRun: “a thrown NON-Error still leaves a reply: the record, then a 500 — nev…” |
| M44 | deferred colour is the trade teal, not the ABSENT check's (`TapeCards.jsx`) | **1** / 120 | AgentChat: “wears the ABSENT check's colour, read off the one map — edge and eyeb…” |
| M45 | the deferred line's EYEBROW painted another colour (`TapeCards.jsx`) | **1** / 120 | AgentChat: “wears the ABSENT check's colour, read off the one map — edge and eyeb…” |
| M46 | the deferred line's EDGE painted another colour (`TapeCards.jsx`) | **1** / 120 | AgentChat: “wears the ABSENT check's colour, read off the one map — edge and eyeb…” |
| M47 | the id's instant fallback dropped (`\|\| ms`) (`buildTape.js`) | **1** / 119 | buildTape: “a beat with no run id is still keyed, by its own instant — never tap…” |
| M48 | the peek strip's deferred branch removed (`derivePeekLine.js`) | **2** / 119 | peek: “reads `Check deferred` — the line's own eyebrow, and no time, as a fo…” (+1) |
| M49 | the bubble's deferred branch removed (`deriveBubble.js`) | **2** / 119 | bubble: “the deferred LINE's own two strings and its own token colour — nothin…” (+1) |
| M50 | the flip map no longer turns the registration row around (`featureFlags.js`) | **1** / 12 | pin: “the flip map turns the REGISTRATION row around too — a flip that only…” |
| M51 | rules: a grant OR'd into the agentEvalRuns block (`firestore.rules`) | **1** / 32 | evalRun: “exactly ONE block for the collection, and it says exactly allow read…” |
| M52 | rules: a wildcard-first path granting reads (`firestore.rules`) | **1** / 32 | evalRun: “no wildcard-first path can grant it either: the only one is the root…” |
| M53 | the LEGACY chat path admits a beat as a trade line (dead in production — controller flag on) (`AgentChat.jsx`) | **1** / 120 | AgentChat: “the LEGACY path (no tape entries — the controller flag off) renders n…” |
| — | CONTROL: the unmutated snapshot, every file above | **0** / 168 | — |

**Against the emulator** (the suite's own `COMPOSITION_RULES_TEXT_PATH` knob):

- First pass: M30a (the block grants `read` to any signed-in user) turns 4 rows red: the three signed-in identities' READ rows and the posture row. M30b (the block removed) turns only the posture row red, because the root default-deny still denies everything, which is exactly why the posture row exists.
- Second pass: **M51** (an admin read grant OR'd into the block) turns 2 of 254 red. They are "a privileged-claims context cannot READ a run document" and the posture row; the other 11 suites stay green.

## 9. The rotation statement

The fair-rotation sort orders active battles ascending by `cronState.lastEvalStartedAt` (`api/cron/agent-evaluate.js:406-408`; `@591b714d :384-386`). Its only writer is the full tick's final update, **gated on `haikuAttempted`** (`:4149`; `@591b714d :3969`). `haikuAttempted` is set before the prompt build, so a build failure advances the key; a budget skip and a refresh failure do not (`:2540-2571`).

**What holds** (VERIFIED, and pinned by `evalRun.test.js:332`): a deferred battle gets no write of any kind, so its key does not move. Every battle that attempted a model call this run is stamped with this run's instant. **So next run, every deferred battle sorts ahead of every battle that made a model attempt this run**, and the deferred battles keep their relative order: the sort is stable and their keys are unchanged.

**What does not hold, and why the line's copy needs a ruling** (review L2-F1 and L4-F2; R2 and R4 confirmed both, with stronger evidence than filed):

- **Not first.** Every battle reached this run *without* a model attempt keeps its old key. That covers tournament CPU seats (which never attempt one), lock-skips, budget-skips, no-trigger ticks and refresh failures. Because the loop runs in ascending order, those keys are ≤ the deferred set's, so those battles sort **at or ahead of** it, as do brand-new battles (key `''`). R4 ran the real handler twice with state carried over. Each time, a CPU seat, a lock-skipped battle or a budget-skipped battle went first, and the last two made model calls before the deferred battle did. They are not "cheap ticks", as the draft of this report said.
- **Not guaranteed to be picked up.** R2 simulated six runs on the real loop at the scaling audit's assumed scale (60 battles at 20–30 s; an assumption, not a measurement). The next run reached only 10 of the 25 battles that got a beat, and none of the 10 got a model call.
- **Never, for the day's last run.** The last market-open run is 15:45 ET, and a stock-only full-day battle expires at 16:00 ET (`api/_utils/agentBattleService.js:370-391`). A battle deferred at 15:45 is completed by the next invocation, never checked again, and the line stays on its finished record.

No rotation change was made; that is out of scope. **Founder ruling before the flip:** either keep the line and accept it, or drop or reword its second clause. L2 suggested dropping "· next run picks it up first".

## 10. The read path a sharding spec will use

```js
db.collection('agentEvalRuns').where('startedAt', '>=', fromIso).orderBy('startedAt').get()
```

One field, one range, ordered on the same field. Firestore's automatic single-field index serves it, so it needs no composite index and no `firestore.indexes.json` entry (ASSUMED as platform behaviour; VERIFIED that the repo declares none for this collection). It runs server-side only, because the collection is client-denied. Each row yields `wallMs`, `battlesTotal`, `evaluated`, `lockSkipped`, `deferred`, `modelCalls` and `budgetSkipped`: the per-run inputs the scaling audit could not find anywhere (`:271`).

**`fromIso` must be produced by `toISOString()`** (review L4, confirmed by R4). `startedAt` is millisecond-precision UTC with a `Z`, so string order is time order only between strings of that exact shape. A seconds-only bound such as `'…T15:00:00Z'` sorts *after* `'…T15:00:00.123Z'` and silently drops the run that started in that second.

## 11. The §2 review

**Required:** 21 files and about 1,980 changed lines on the cumulative branch diff (1,952 insertions, 25 deletions, this report included); the thresholds are 10 files or 1,500 lines. §12.4 explains the count.

**Method:**

- **Lenses.** Four lenses reviewed `c7e3c1df`: L1 server correctness, L2 the beat and the client tape, L3 test integrity and ratchets (the mutating lens), L4 cross-cutting consistency and regressions.
- **Refuters.** Each lens's findings went to an independent refuter (R1–R4) told to **refute** each one with a concrete repro. R3 checked L3's "survives every test" claims against the **whole** default suite (`vitest run`: 14 984 passed, 0 failed on the pristine build), and validated each proposed fix row against its mutation. The coordinator time-boxed R3 after two whole-suite runs: it finished F1–F6 on the whole suite, and gave F7–F10 on its broad set (3 011 rows) plus targeted runs. R3 says so itself.
- **Isolation.** Every reviewer and refuter worked on its own snapshot tree under the session scratchpad, with `node_modules` symlinked. All were read-only on git and on the shared working tree. The mutating lens and refuter ran their mutations in their own trees. Each reported its tree restored and the shared tree untouched, and the shared tree's diff holds only the coordinator's edits (§15).
- **Build.** An explicit `vite build` ran in the review (L4, exit 0) and again on the final tree (§15).
- **Fixes.** They are in `f32995e9`, plus `039df27d` (R3's by-construction colour row). Each fix row is mutation-checked (§8.2, M34–M53).

**Verdict:** no finding blocks the merge. The two flip-blocking items (the copy and repeats) are founder rulings, recorded in the flag's docstring and pinned by the flag test.

| Finding | Filed | Refuter verdict | Disposition |
|---|---|---|---|
| L1-F1 response can pass the ceiling behind the record's write; a killed run leaves no record | minor | **PARTLY CONFIRMED**: the delay reproduces; its only cost is that invocation's HTTP status; "no record" holds only for a kill | Documented (§5.4, §5.5); comment reworded; not clamped |
| L1-F2 the record does not reconcile (errors, degraded quotes) | minor | **CONFIRMED** (wording corrected: a crashed run is not indistinguishable from a clean one) | Identity documented (§5.1); `errors` field → **founder ruling** |
| L1-F3 `tickMs` excludes post-write dispatch and capture | minor | **CONFIRMED** (a nit: it follows D1's wording) | Documented (§4); code comment corrected |
| L1-F4 `modelCalls` moved before the build: suite green | nit | **CONFIRMED** (test gap) | **Fixed:** build-throws row (M40) |
| L1-F5 `triggered` counts refresh-failure ticks | nit | **CONFIRMED** (not a regression) | Identity documented (§5.1) |
| L1-F6 a thrown non-Error sends no response | nit | **PARTLY CONFIRMED**: not a regression, and the original error is logged, not hidden | **Hardened anyway**, because the build's `finally` now depends on the catch leaving a reply (row + M43) |
| L1-F7 `modelCalls`/`budgetSkipped` in the response only when non-zero | nit | **CONFIRMED**, not a defect | No action (§2 states it) |
| L1-F8 a timed-out write logged as "not written" | nit | **CONFIRMED** (nit) | **Fixed:** "unconfirmed (it may still land)" (M42) |
| L2-F1 "next run picks it up first" is false | major (flip) | **CONFIRMED, stronger** (60-battle simulation; 15:45 ET) | **Founder copy ruling, flip-blocking** (§9); docstring + pin |
| L2-F2 strip and bubble skip the line while the badge counts it | minor (flip) | **PARTLY CONFIRMED** (strip confirmed; the bubble's walk-past mirrors outage checks by design) | **Fixed:** both mirror the line (M48, M49); see L4-F1 |
| L2-F3 beats pile up; no per-battle limit | minor (flip) | **CONFIRMED** | **Founder ruling on repeats, flip-blocking** (§6.1c) |
| L2-F4 the flip list is incomplete | minor (flip) | **PARTLY CONFIRMED**: spectator `{}` and reflection collapse confirmed; activity-log scroll **REFUTED**; "report missing" **REFUTED** (it is in `8e3d5337`) | **Fixed:** flag docstring and §13 |
| L2-F5 an overlapping rewrite can erase a beat | minor (flip) | **CONFIRMED**, already disclosed, shared by other writers | No action; stated as best effort |
| L2-F6 one hung write → log says no beats were written | minor (flip) | **CONFIRMED** | **Fixed:** per-write bounds (M41) |
| L2-F7 a comment the diff made stale (`AgentBattleScreen.jsx`) | nit | **PARTLY CONFIRMED**, plus a second stale clause nearby | **Fixed:** both clauses |
| L2-F8 the beats use the record's margin | nit (flip) | **CONFIRMED**, theoretical (≥ 3 s left) | No action (§6.1d) |
| L3-F1 removing the beats' `await` passes every test | major | **CONFIRMED** (survives the whole suite: 14 984 passed, 0 failed) | **Fixed:** the 1,999-ms row (M34) |
| L3-F2 no time before the gate: `runId`/`wallMs` from the gate would pass | major | **CONFIRMED**, all three variants (whole suite) | **Fixed:** TEST 1 charges 1 s pre-gate (M35, M36) |
| L3-F3 nothing checks `wallMs` includes the beats | minor | **CONFIRMED** (whole suite, combined run) | **Fixed:** row (M37) |
| L3-F4 no fixture sets the rotation key | minor | **CONFIRMED** (whole suite, combined run) | **Fixed:** rotation row (M38, M39) |
| L3-F5 the CI tripwire reads only the first statement | minor | **CONFIRMED** (whole suite, combined run); the emulator catches both variants, but CI does not run it | **Fixed:** exact-block and wildcard rows, default run and emulator (M51, M52) |
| L3-F6 the line's colour is unpinned | minor | **CONFIRMED** (whole suite). R3 preferred a pin by construction, so that a retune of the ABSENT colour stays green | **Fixed**, R3's way: the row compares against `LABEL_COLOR[WHY_KIND.ABSENT]`. Red under M44–M46; green under a retune |
| L3-F7 a flip that follows the FLIP MAP goes red | minor | **CONFIRMED** (broad and targeted runs) | **Fixed:** FLIP MAP names the registration turnaround; pinned (M50) |
| L3-F8 a position check passes when its label is missing | nit | **PARTLY CONFIRMED**: vacuous on its own, but `buildTape.test.js` catches the production mutation | **Fixed** (optional per R3): found-first guards |
| L3-F9 `typeof` accepts `NaN`; a comment over-claims | nit | **PARTLY CONFIRMED**: moving the restamp above the dark shadow capture survives. The NaN half is **REFUTED**: the exact 5 000 row kills NaN | `Number.isFinite` kept; comment corrected; the dark-capture gap **documented** (§4), not pinned while the flag is off |
| L3-F10 no-`runId` id fallback; the dead legacy path admits a beat | nit | **CONFIRMED** for the fallback (targeted runs; unreachable today, since the only writer always sets `runId`). R3 did not re-run the legacy-path half | **Fixed:** two rows, M47 for the fallback and M53 for the legacy path |
| L4-F1 §9 display agreement (strip, bubble, badge) | flip | **CONFIRMED**, with a correction: with the pane on, the visible defect is the badge plus a stale bubble | **Fixed** (see L2-F2) |
| L4-F2 the copy's claim is usually false | flip | **CONFIRMED, worse**: "cheap ticks" was wrong; lock- and budget-skipped battles go first *with* model calls | §9 and §12.5 rewritten; **founder ruling** |
| L4-F3 "however the run ends" overstates; the wait is not clamped | minor | **CONFIRMED** | Comment and test title reworded; §5.5; clamp declined (§5.4) |
| L4-F4 `tickMs` lands only on triggered ticks | minor | **CONFIRMED** (scope note) | Coverage stated (§4) |
| L4-F5 no `errors` field | minor | **CONFIRMED** (documentation) | §5.1; **founder ruling** |
| L4-F6 "lists every deferred battle" (it lists 200) | nit | **CONFIRMED** | **Fixed:** three strings |
| L4-F7 stale comments (screen, harness) | nit | **PARTLY CONFIRMED**: the screen comment is stale; the harness claim is **REFUTED**. R4 also found a stale key list in the pins test | **Fixed:** the screen comment; the pins list gains `tickMs` |
| L4-F8 the report did not exist at `c7e3c1df` | nit | Fact true, **not a defect** (it is in `8e3d5337`) | None |
| L4 read-path caveat: `fromIso` shape | — | **CONFIRMED** | §10 |

**Counts:** 35 findings: L1 8, L2 8, L3 10, L4 8, and the read-path caveat. **26 CONFIRMED, 8 PARTLY CONFIRMED, 1 REFUTED** (L4-F8, not a defect). Four sub-claims inside the partly confirmed ones were also refuted: L2-F4's activity-log scroll and "report missing", L4-F7's harness comment, and L3-F9's NaN half. R4's extra find (the pins test's stale key list) is folded into L4-F7.

**R1's aside, outside this build:** the loop's catch reads `err.message` (`:439`; `@591b714d :410`). A battle that rejects with `null` or `undefined` aborts the whole loop with a 500, and the battles it never reached are absent from the record's counts. This is pre-existing and reported for separate tasking (§14).

## 12. Where the prompt and the tree disagreed: decided, stated, not improvised past

1. **Test 3's `deferredTruncated: 5`.** D2 defines `deferredTruncated` as the count beyond the **200-id** list cap. Test 3 asks for "30 deferred → 25 beats + `deferredTruncated: 5`". Under D2's definition that is 0 (30 ≤ 200); the 5 there is the **beat** overflow (30 − 25). One field cannot mean both, so it was **built to D2's contract**, the data contract the cockpit's sweep and the Film Room will read ("is the list complete?"). Test 3 is met under both readings. The 30-deferred row asserts 25 beats, no beat for the other five, and all 30 listed (`deferredTruncated: 0`). A 205-deferred row binds both caps at once: 25 beats, 200 ids, `deferredTruncated: 5`. Recording the beat overflow as its own field would be a one-line addition. **Ruling requested.**
2. **"Allowlist rows for the two write sites."** Neither site is protected or unresolvable, so the deny-by-default scan does not list it, and a row would fail the stale check (§7). No row was added. A row would be needed only if a site wrote through a handle the scanner cannot resolve (a `batch` or a transaction), which this build deliberately avoids.
3. **"Only if ≥ 5 s of budget remain."** The break fires only once elapsed **exceeds** `TIME_BUDGET_MS` (`:413`, unchanged and out of scope), so the budget has always run out by the time the beat could run. Read against `TIME_BUDGET_MS`, the rule could never pass (M18). It was built against the **hard ceiling** (`maxDuration`, 300 s), the 10-s cleanup buffer the budget exists to leave: beats 2 s + record 2 s + 1 s for the response.
4. **"A tape line … in `battleViewCopy.js` and `TapeCards.jsx`"; "≤ 8 files".** At HEAD the tape was built from `trades[]` and `evaluations[]` alone, and read the feed only for the directive echo (`@591b714d src/screens/battleView/buildTape.js:18`). The dispatcher's fallback for an unknown kind was an empty speech bubble. A line in those two files alone would never render. So the build also touches `buildTape.js` (the builder) and `AgentChat.jsx` (the dispatcher row, and the fallback the prompt names). The §2 review then required the strip and the bubble to mirror the line (BUILD_RULES §9: `derivePeekLine.js`, `deriveBubble.js` and their tests), plus a comment in `AgentBattleScreen.jsx` and a key list in the pins test. Everything else the prompt required itself: the tests, the report, the fixture list, the pin file and the rules test. Without the review, the count was 15 files.
5. **The copy: "next run picks it up first"** is usually false (§9). The founder's string is used verbatim, and the flag is dark. **Founder ruling before the flip** (flip-blocking).

## 13. Flip prerequisites: not built, and the flag must not flip before them

All of these are written into the flag's own docstring (`src/config/featureFlags.js:2721-2746`), and the flag test pins the two rulings. The flip PR cannot miss them.

1. **A copy ruling** (§9).
2. **A ruling on repeats** (§6.1c).
3. **The other status-feed readers.** The beat's shape is `kind`/`at`, as the prompt specifies, while every other reader keys on `action` / `message` / `timestamp`. A survey of every non-test reader found that **none throws**, and most ignore the beat (for example, the activity log filters on `message || action || type`, `src/components/Agent/AgentActivityFeed.jsx:660-664`). These behave differently once beats exist:

| Reader | What a beat does there | file:line |
|---|---|---|
| Tournament "Live feed" (Flat6) | renders a **"—" row**, newest first, and takes one of 8 slots | `src/components/Tournament/Flat6BattleView.jsx:193`, `:335` |
| Spectators of that feed | the public projection allowlists `timestamp / message / action / …`, so a beat arrives as **`{}`**. A fix keyed on `kind` must allowlist it there or drop beats at the projection | `api/_utils/tournamentBattleView.js:58`, `:96` |
| Post-battle reflection prompt (Sonnet → agent memory) | prints **`[undefined] undefined: null`** in `STATUS FEED HIGHLIGHTS`. Every beat shares one dedupe key (`timestamp + action`), so they collapse to one line while each still takes a last-10 slot | `api/_utils/agentReflectionUtils.js:220-229`, `:339` |
| League voice lane | slices the last 6 **before** dropping text-less lines, so each beat costs one real line | `src/components/League/battleArena/statusFeedToVoice.js:55-63` |
| Desk latest line (dark: `COMMAND_CENTER_SYNC_ENABLED = false`) | takes the last array element as latest, so the line is blank until a real entry lands | `src/adapters/baggerbombAdapter.js:267-277` |

With the flag off, no beat exists, and every reader above is untouched.

## 14. Findings outside this task, for separate tasking (BUILD_RULES §3)

- **F-1 (pre-existing, found by R1):** the loop's per-battle catch reads `err.message` (`api/cron/agent-evaluate.js:439`; `@591b714d :410`). A battle that rejects with a non-Error aborts the whole loop. Suggested fix: the `err?.message ?? String(err)` hardening this build applied to the handler's own catch (`:485`). Not applied there, because it is outside this build's lines.
- **F-2 (pre-existing, confirmed while building):** the rotation key advances only on model attempts (`:4149`), so battles that never trigger lead every sort. This is R1 of the scaling audit, unchanged and out of scope; it is also the root of §9.
- **F-3 (pre-existing):** a run the platform kills mid-battle leaves no record (§5.5). The loop-level check reserves nothing for the admitted battle's pre-call phase (scaling audit R3/R4).
- **F-4 (flip prerequisite, §13):** the status-feed readers. Each fix is a one-line filter or fallback, or the founder may prefer beats to carry a `message`. It is a design choice, not a defect today.

## 15. Verification

All checks ran on the final code tree (`039df27d`) unless stated otherwise. `039df27d` changes one test row from `f32995e9`.

| Check | Command | Result |
|---|---|---|
| Fetch | `git fetch origin` at session start; re-fetched before the final commit | `origin/main` = `591b714d`, unchanged throughout |
| §1 fence | `comm -12 changed.txt fence.txt` (§3) | **∅** across the 21 changed files |
| Golden and exact-key test | `git diff --quiet origin/main -- api/cron/agent-evaluate.tickStamps.flagOff.test.js api/_utils/__fixtures__/tickStampsEntryGolden.flagOff.json` | byte-unchanged |
| Targeted suites | `npx vitest run` on the 8 touched vitest suites plus the flag-off, flag-on and scan suites | **11 files, 205 passed** |
| Full suite | `npx vitest run` | **770 files; 14 999 passed, 64 skipped, 0 failed** (178.5 s) |
| Lint gate | `npm run lint:gate` (`--max-warnings 0`) | exit 0 |
| `vite build` | `npm run build` | exit 0 (26.0 s). Four CSS-syntax warnings, identical to the branch's first build; this build adds no CSS |
| Rules (emulator) | `npm run test:rules` | **12 files, 254 passed**, `agentEvalRunsDenials` 12 of 12; rules text sha256 `1a39f511…e460180` |
| Rules mutation M51 | the same, with `COMPOSITION_RULES_TEXT_PATH` → a ruleset with an admin read OR'd into the block | **2 of 254 red**: the privileged-claims read row and the posture row |
| Mutations | `mutate2.py`, snapshot tree (§8.2) | **52 of 52 RED**; control 0 of 168 |
| Protected-stores scan | `scanProtectedStoreWrites(repoRoot)` | output below |

```
new sites in `all`:  api/cron/agent-evaluate.js::writeEvalRunRecord::set::agentEvalRuns
                     api/cron/agent-evaluate.js::writeDeferredBeats::update::agentBattles
the cron's `needsListing`: api/cron/agent-evaluate.js::processAgentBattle::update::unresolved   (the existing lock-transaction site; unchanged)
```

**Not verifiable before merge.** Crons do not run on Vercel preview (BUILD_RULES §6), so the first run document and the first `tickMs` appear only in production after the founder merges. What to look for first:

- `agentEvalRuns` gains one document per market-hours quarter-hour (about 26 a weekday).
- `wallMs` stays at or under about 300 000.
- On runs with no loop errors or degraded quotes, `battlesTotal = evaluated + lockSkipped + deferred`.

A missing quarter-hour means a killed run (§5.5).

**Artifacts** (BUILD_RULES §3) are kept in the session scratchpad, outside the repo tree:

- a byte-exact copy of this report
- both mutation harnesses (`mutate.py`, `mutate2.py`) and their JSON results
- the emulator, build, lint and suite logs
