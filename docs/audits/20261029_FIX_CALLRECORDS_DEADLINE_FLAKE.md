# Fix — callRecords deadline rows flake under load

**Date:** Oct 29, 2026 · **Branch:** `claude/fix-callrecords-deadline-flake` · **Base:** `main` @ `fc0cb6f0` · **Fix commit:** `b3835f33`

**In plain terms:** on this machine's Linux setup (WSL) the computer's wall clock gets nudged forward by about a second every half minute, while timers keep their own steady clock. A few cockpit tests compared the two with less than a second of slack, so a nudge at the wrong moment turned them red. The tests now run on a simulated clock they control, so they give the same answer every time, and no product code changed.

| Question | Answer |
|---|---|
| Reproduced? | **Yes.** 1 red run in 41 under natural load (a retire and a publish deadline row, red together, on a clock step). With the measured clock step injected at a faster rate: **20 of 20 runs red**. With 400 ms event-loop stalls injected: **11 of 20 red**. |
| What races | The code sets its deadlines from the **wall clock** (`Date.now()`) and enforces its ceilings with **timers** (`setTimeout`), which run on the **monotonic** clock. WSL steps the wall clock **+0.8 to +1.7 s every ~33.5 s** (measured, idle or loaded). Every exposed row had less than 1.3 s of wall-clock slack. |
| Test or code? | **Test.** The code does what its spec says; the rows assumed the wall clock and the timers agree. One design note for a ruling (FQ-1), no change made. |
| Fix | **Test side only.** Every real-time row in `api/_utils/callRecords/` runs on one fake clock (`setTimeout`, `clearTimeout` and `Date` together), through a new fixture. 0 production lines changed. |
| After | **0 red in 64 runs**: natural load 0 / 24, injected steps 0 / 20, injected stalls 0 / 20. |
| Mutation | **15 of 15 mutants killed** by the rows that name them; 5 controls green. Two of them (R2: no reserve; R3: a 300 ms ceiling overrun) were replayed against `main`'s rows and survive there: the old rows did not guard them. |
| Full suite (Linux, `TZ=UTC`, 8 workers, lock) | **27,140 rows, 27,051 pass, 0 fail, 89 skipped** (1,237 files), run alone. |
| `lint:gate` | **exit 0.** |
| Census | **Ten candidates elsewhere** (§5). The biggest finding: vitest's own 5 s row timeout is checked on the wall clock, so on WSL any row longer than ~3.3 s can be failed by a clock step. Nothing fixed here. |

---

## Preamble

- `git fetch origin` run first (and again before the final checks): `origin/main` = `fc0cb6f0`, the session's starting HEAD; it did not move. Tree clean at start. **VERIFIED.**
- The desktop app cut the local branch as `claude/callrecords-deadline-flake-aaac5d`; it is pushed by refspec to the prompt's name, `claude/fix-callrecords-deadline-flake`.
- Linux runs: WSL Ubuntu, a private git worktree `/home/flashash/pd-ci-flake` of `~/pd-ci` (the shared clone's HEAD untouched), with its own `npm ci`: `main`'s lockfile (`40382e64…`, `three` added by PR #1007) differs from the shared clone's (`22fa2b71…`). Node 20.20.2 / npm 10.8.2 (CI's), 20 vCPUs, 12 GB. Every loaded run and the full suite ran under `flock /tmp/pd-suite.lock`, so no other session's suite ran beside the CPU burners and none ran beside this suite.
- No production file, no fenced file, no flag. Fenced functions called: none.

## 1. Reproduction and failure rates

### 1.1 The runs

All on Linux, `TZ=UTC`, `vitest run api/_utils/callRecords --maxWorkers=8` (568 rows), JSON reporter.

| Load | Tree | Runs | Red runs | Red rows |
|---|---|---:|---:|---|
| none (calibration) | `main` | 1 | 0 | — |
| 40 CPU burners, 1 run at a time | `main` | 5 | 0 | — |
| 40 CPU burners, 4 runs at once (32 workers on 20 cores) | `main` | 12 | **1** | publish "a timeout whose commit LANDED"; retire "a timeout leaves the slot … never runs past its ceiling" (both in the same run) |
| **before, natural:** 40 burners, 4 at once, 6 rounds, clock monitor on | `main` | 24 | 0 | — (three clock steps of +1,269 / +1,320 / +1,315 ms during it) |
| **before, steps:** +1,300 ms wall-clock step every 1 s, random phase | `main` | 20 | **20** | 49 red rows: retire CB1-2 ×16, retire ceiling ×5, and all seven publish re-read rows (×28) |
| **before, stalls:** 400 ms busy-wait every 1 s, random phase | `main` | 20 | **11** | retire CB1-2 ×10 (the batch ran 206 s, so a few of these may be real steps); publish "cannot be re-read" ×1 (a real clock step, §1.3) |
| **after, natural:** same as before | `b3835f33` | 24 | **0** | — (two clock steps of +1,462 / +1,747 ms during it) |
| **after, steps:** same as before | `b3835f33` | 20 | **0** | — |
| **after, stalls:** same as before | `b3835f33` | 20 | **0** | — |

Every "after" run reported 568 rows, 568 passing. The step-injected batch took 43 s after against 150 s before: the converted rows no longer sleep.

The two provocations are scratch modules loaded into every vitest process with `NODE_OPTIONS=--import` (outside the repo, nothing committed). The step module replaces `Date.now` with `realNow() + floor((performance.now() − t0) / 1000) × 1300`. The code under test reads the wall clock only through `Date.now()` (no argument-less `new Date()`: `grep` of `api/_utils/callRecords/*.js`, the two store fixtures and `evaluatorHook.js`). The stall module runs a 400 ms busy loop on a 1 s interval. **VERIFIED.**

### 1.2 The mechanism, measured

A monitor sampled `Date.now() − performance.now()` every 20 ms inside WSL and logged every jump over 50 ms, plus every sampling gap (an event-loop stall) over 100 ms:

| Window (UTC) | Load | Wall-clock steps | Stalls > 100 ms |
|---|---|---|---|
| 17:19:52–17:21:45 | before, natural (24 runs) | +1,269 ms at 17:20:24.9 · +1,320 ms at 17:20:58.5 · +1,315 ms at 17:21:32.1 | 4, max 138 ms (right after the first step) |
| 17:25:42–17:27:25 | **idle**, nothing running | +1,108 ms at 17:26:14.8 · +1,290 ms at 17:26:48.4 · +843 ms at 17:27:21.5 | 0 (max 30 ms) |
| 17:37:44–17:39:13 | after, natural (24 runs) | +1,462 ms at 17:38:17.8 · +1,747 ms at 17:38:51.8 | — |

Each step in the first two windows matches a `systemd-resolved: Clock change detected` line in the WSL journal (the third window was not checked against it). The journal shows the same ~33 s cadence across the day, e.g. Oct 28 23:46–23:59 UTC (every ~32.7 s), Oct 29 16:39:47–16:43:43 and 17:04:36–17:09:55 UTC. Each WSL distro start also adds a `systemd-timesyncd: Initial clock synchronization` step. The guest clock runs about 3–5 % slow and is stepped back into line; every step measured was forward. Kernel command line: `hv_utils.timesync_implicit=1`; clocksource `tsc`; `systemd-timesyncd` active. **VERIFIED** (journal, `dmesg`, `timedatectl`). Which of the two time-sync agents makes the 33 s steps is **ASSUMED** (Hyper-V TimeSync); either way it is the host, not the tests, and it was not changed.

**Load is not the trigger.** The steps come idle too, and CPU contention alone made no stall over 138 ms. The rows passed alone because one directory run exposes about 1.9 s of vulnerable windows (§2), against one step per ~33.5 s.

### 1.3 The first natural failure, traced

Run `probe-b40-p4/run-1-2` (17:16 UTC): two rows red in two files, on two workers, at once.

- retire "never runs past its ceiling": vitest timed the row at **224 ms** (vitest's durations use `performance.now()`, `node_modules/@vitest/runner/dist/index.js:1440`), while the row's own `Date.now() − started` read **1,528 ms** (`expected 1528 to be less than 1300`).
- publish "a timeout whose commit LANDED": 176 ms by vitest, yet its re-read slice (ending 1,000 ms after the start by `Date.now()`) was already spent: `phaseResult: 'unconfirmed'`.
- The files ran 17:16:06.6–17:16:14.7 (publish) and 17:16:09.7–17:16:13.4 (retire). The journal: `Initial clock synchronization` and `Clock change detected` at **17:16:11 UTC**.

The one publish row red in the "before, stalls" batch ("cannot be re-read", its file ran 17:31:51.9–17:32:01.5) also falls on a real step: `Clock change detected` at **17:31:59.66 UTC**. A 400 ms stall cannot cross that row's 850 ms slack. **VERIFIED.**

The Oct 29 failures in the S0 sessions (retire CB1-2 and publish "the queue read returns after the deadline", each on the first of two full runs) were not re-run here. That they were clock steps is **ASSUMED**: both are exposed rows (§2), and the journal shows steps every ~33 s through 16:39–16:44 UTC.

## 2. Diagnosis — what races, row by row

The shared pattern, in the code (all **VERIFIED** at `fc0cb6f0`):

- `withTimeout` (`api/_utils/intraday/evaluatorHook.js:20-24`) races the work against `setTimeout(ms)`: the **monotonic** clock.
- Every deadline is **wall-clock** arithmetic on `Date.now()`:
  - retire: `stepMs`/`budgetMs`/`stepDeadlineMs` at `retire.js:161-165`; the reserve's `leftMs` at `retire.js:123` (`settleLate`) and `:135` (`retiredEventLanded`); the race at `:195`, the settle at `:203`, the event read at `:210`.
  - publish: `txBudget` at `publish.js:141`; the in-transaction checks at `:154`, `:173`, `:183`; the re-read slice `rereadBudget` at `:238-239`.
  - heard `heard.js:115-117`, sweep `sweep.js:217-219`, flip `flip.js:221-223` (each `min(ceiling, deadline − Date.now())`).

So a forward wall-clock step makes a deadline "pass" that no timer has reached, and a stalled event loop runs a timer callback late, after the deadline it was meant to beat. Two timers alone keep their order after a stall (Node fires expired timers in expiry order), so a row that only races two timers is not exposed.

| Row at `main` | What races | Wall-clock slack | Exposed? | Red before (steps / stalls) |
|---|---|---|---|---|
| `retire.test.js:196` CB1-2 "lands after the budget but inside the reserve" | the 600 ms budget timer fires, then `settleLate` reads `leftMs = stepDeadline − Date.now()` (`retire.js:123`) against the commit's 700 ms timer | **200 ms** (the reserve) | **yes**: any step over 200 ms (every one measured) or any stall ≥ 200 ms in its first 600 ms | 16 / 10 |
| `retire.test.js:174` "never runs past its ceiling" | the elapsed assertion `Date.now() − started < RETIRE_TX_MS + 500` (`:181`) over a 400 ms step | **900 ms** | **yes**: a step > 900 ms | 5 / 0 |
| `retire.test.js:205` "past the WHOLE ceiling" | the 1,200 ms commit against the 800 ms ceiling | — | no: unconfirmed either way | 0 / 0 |
| `publish.test.js:148, 318, 332, 356, 368, 401` (the re-read rows) and `:380` second half | the 150 ms timeout fires, then `rereadBudget = rereadDeadline − Date.now()` (`publish.js:238`) against a deadline 1,000 ms after the start | **850 ms** | **yes**: a step > 850 ms in the first 150 ms; `:380` through its `reason: 'reread_failed'` check | 28 rows / 1 (a real step) |
| `publish.test.js:286`, `:380` first half | the re-read deadline is the start itself | — | no: always `unconfirmed` | 0 / 0 |
| `publish.test.js:585` `writeCallsStatus` | deadline and budget read in the same tick | — | no | 0 / 0 |
| `heard.test.js:256` "outlasts its ceiling is UNCONFIRMED" | a step before `heard.js:115` turns `unconfirmed` into `not_started`, `stopped: 'deadline'` | — | **hidden**: the assertion accepted either path (`unconfirmed + (stopped === 'deadline' ? 1 : 0) > 0`), so it never went red but did not prove its own claim | 0 / 0 |
| `sweep.test.js:325` "a LATE COMMIT" | the 1.5 s ceiling against the 1.8 s commit, a 20 s deadline | — | no: two timers, in order | 0 / 0 |
| `flip.test.js:404` "UNCONFIRMED … commits late" | `Date` frozen by the file's fake clock; 60 ms ceiling against a 150 ms commit | — | no: two timers, in order | 0 / 0 |

Every other row in the directory either fakes `Date` (frozen) or races only microtask-resolved work against a 5 s deadline. **VERIFIED** by reading each `setTimeout`/`Date.now()` site the directory's tests use (`grep`), and by the after-steps batch: 0 red rows of 11,360 under a +1.3 s step every second.

**Where the defect is: the tests.** Each exposed row assumed the machine's wall clock and its timers agree to within its slack. Review D-2 had already widened these budgets from 20–40 ms to the current ones (the old `publish.test.js:29-32` comment); a 1.3 s step still crosses them, and widening again would only move the line. The code behaves as specified on a stepping clock: a forward step makes a step give up early, as `unconfirmed`, with the slot left as it was, which is the documented safe outcome.

**FQ-1 — a design note for a ruling, not a defect at this placement.** Deadlines on the wall clock with ceilings on the monotonic clock behave asymmetrically on a host that steps its clock:

- A **forward** step ends a step early. That is safe: unconfirmed, nothing lost, the heard pass's precedent.
- A **backward** step of S lengthens the remaining slack by S. `settleLate` and `retiredEventLanded` (`retire.js:123`, `:135`) and publish's re-read (`publish.js:238`) could run up to S past their ceilings. The per-transaction caps (`min(800, …)`, `min(1500, …)`) bound each attempt, not the loops' deadline checks.

Production runs on Vercel, where the clock is assumed to be slewed rather than stepped (**ASSUMED**; not measured here). The smallest change, if a ruling wants it: measure the step-internal deadlines with `performance.now()`, keeping the caller's `Date.now()`-based `deadlineMs` only for the opening `min()`. In `retire.js` that is `stepDeadlineMs`/`attemptDeadlineMs` (`:164-165`) and the two `leftMs` reads (`:123`, `:135`), about six lines; the same pattern sits in `heard.js:115-117`, `sweep.js:217-219`, `flip.js:221-223`, `publish.js:141` and `:238`. This code belongs to the cockpit answer-loop arc; not proposed for this PR, no production change made.

## 3. What changed

Seven files: six test-side, plus this report. Line numbers at `b3835f33`.

- **New fixture `api/_utils/__fixtures__/deadlineClock.js`** (42 lines). `deadlineClock(vi)` returns:
  - `use(atMs)`: fakes `setTimeout`, `clearTimeout` and `Date` as one clock (`vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })`).
  - `settle(ms, promise)`: lets `ms` virtual milliseconds pass (`vi.advanceTimersByTimeAsync`) and returns `{ value, atMs }`, what the step settled to and when. It throws if the step is still pending.

  It takes the test file's own `vi`, so the fixture keeps the house rule of no vitest import and zero product imports.
- **`retire.test.js`** (`afterEach` restores real timers, `:60`):
  - `:179` the ceiling row: the elapsed `< 1,300` wall-clock check became a virtual-time bound, settled within the 800 ms window and **at or before its 400 ms deadline**.
  - `:202` CB1-2: on the fake clock, plus two new assertions that prove its title's claim:
    - it settled **at 700 ms**, when the commit landed;
    - it settled **on the late path**, by the log line `retire landed late … (settled by the transaction)`, which shows the budget was exceeded.
  - `:216` the whole-ceiling row: gives up **at exactly 800 ms**, logs `retire unconfirmed`, and the late commit is then shown to **land** (late, not absent) while the in-memory slot stays.
- **`publish.test.js`**:
  - The `RT` family (`:30-40`) is now virtual milliseconds, with the header rewritten and a `publishOnClock` helper.
  - The nine real-time rows (`:155, 294, 327, 342, 367, 380, 395, 417, 602`) call `clock.use()` and advance virtual time instead of sleeping.
  - `:380` "commit has NOT landed" also asserts the record is absent at the timeout, before the late commit lands.
  - Every assertion of `main` is kept.
- **`heard.test.js:258`**: on the fake clock; the either-path assertion became the one outcome, `{ scanned: 1, unconfirmed: 1, failed: 0, heard: 0 }`. Then the late commit lands **once**: one attempt, one `heard` event.
- **`sweep.test.js:327`**: on the fake clock (settles at the 1.5 s ceiling; the commit lands at 1.8 s). The 10 s row timeout is gone, since the row no longer waits 3.8 s of real time.
- **`flip.test.js:406`**: `setTimeout` faked with `Date`, the 60 ms window and 150 ms commit in virtual time.

## 4. Mutation results

22 runs: 5 controls, 15 mutants, and 2 replays of mutants R2 and R3 against `main`'s `retire.test.js`. Each mutant breaks **production** behaviour a row names; it ran in the WSL tree at `b3835f33`, one at a time, against the row's whole test file. The file was restored byte-exact from what was read, and `git status` was required clean after each one (clean at the end). Row totals never moved (19 / 37 / 26 / 33 / 58), so no file dropped out.

| Id | Mutant (production) | Killed by | Result |
|---|---|---|---|
| C × 5 | none (controls: retire, publish, heard, sweep, flip) | — | all green |
| R1 | `settleLate` never settles by the transaction (`retire.js:124` → `if (true) return null;`) | CB1-2 (`unconfirmed`), whole-ceiling (gave up at 600, not 800) | **killed** |
| R2 | no reserve (`RETIRE_REREAD_RESERVE_MS = 0`, `retire.js:62`) | CB1-2 (the late-path log line is missing) | **killed** |
| R2 on `main`'s rows | the same, against `retire.test.js` at `fc0cb6f0` | — | **survives**: the old row never proved "after the budget" |
| R3 | the step overruns its ceiling by 300 ms (`retire.js:164`) | ceiling row (`700 ≤ 400` false), whole-ceiling (still pending at 800) | **killed** |
| R3 on `main`'s rows | the same, against `fc0cb6f0` | — | **survives**: the old `< 1,300` bound let 700 through |
| R4 | the settle waits 1 s past the whole ceiling (`retire.js:203`) | whole-ceiling, ceiling row (both still pending at 800) | **killed** |
| P1 | no existence re-read after a timeout (`publish.js:239`) | all seven re-read rows | **killed** |
| P2 | an attempt may start after the deadline (`publish.js:154` removed) | "no attempt starts after the deadline", late-timeout (`battleDocGets` 2) | **killed** |
| P3 | a commit may be issued after the deadline (`publish.js:183` removed) | "the queue read returns after the deadline" (a write lands) | **killed** |
| P4 | the queue read may start after the deadline (`publish.js:173` removed) | "the first reads return after the deadline" (queue read 1) | **killed** |
| P5 | a status-write timeout reads as failed (`publish.js:298`) | `writeCallsStatus` row | **killed** |
| H1 | a heard timeout reads as failed (`heard.js:153`) | heard ceiling row | **killed** |
| H2 | the heard transaction ignores the pass's deadline (`heard.js:115` → always 800 ms) | heard ceiling row (still pending at 150) | **killed** |
| S1 | a sweep timeout reads as failed (`sweep.js:226`) | "a LATE COMMIT" | **killed** |
| S2 | no 1.5 s ceiling in the sweep (`sweep.js:217`) | "a LATE COMMIT" (still pending at 1,500) | **killed** |
| F1 | a flip timeout reads as failed (`flip.js:270`) | "UNCONFIRMED … commits late" (and the 800 ms reads row) | **killed** |
| F2 | the flip transaction ignores the deadline (`flip.js:221` → always 800 ms) | "UNCONFIRMED … commits late" (still pending at 60) | **killed** |

## 5. Census — the same pattern elsewhere (report only, nothing fixed)

A read-only sweep of every test file outside `api/_utils/callRecords/`, by a search subagent. I re-read, at `fc0cb6f0`, the vitest runner lines, `chat.test.js:1833-1838` with `chat.js:175`, `store.test.js:43-46`, and the first line of rows 1, 2 (`:162`), 3, 4 (`:96`), 5 (`controller:137`), 6 (`:253`) and 7 (`leagueRawIds:435`): **VERIFIED**. The other line numbers are the subagent's citations, **ASSUMED**. Durations come from the subagent's read of a vitest results cache that mixes runs: **ASSUMED**.

**The finding behind most of the list: vitest's row timeout is checked on the wall clock.**

- `node_modules/@vitest/runner/dist/index.js:1183` captures `const now$2 = Date.now` at load; `:1205` starts a row with `startTime = now$2()`.
- When the row resolves, `:1229` fails it if `now$2() − startTime >= timeout`. That check exists for rows that block the event loop, so their monotonic timer never fires.
- On WSL, a clock step inside a row adds its size (up to 1.75 s measured) to the row's measured time. With the 5 s default, a row taking about 3.3 s or more is exposed, with odds of roughly its duration ÷ 33.5 s per run.
- A fully synchronous row can fail only through this check.

Neither `vitest.config.js` nor the `vite.config.js` it merges sets a `testTimeout` or `hookTimeout`, so the 5 s / 10 s defaults apply unless a file raises them. **VERIFIED.**

| # | Row | Mechanism | Slack | Why |
|---|---|---|---|---|
| 1 | `api/cron/film-tape-backfill.e2e.test.js:155` "the next candle morning enriches every backfilled day…" | row timeout (wall clock) + CPU | ~0.6 s at 4.4 s | CPU-bound candle pass, Date frozen. Seen at 6 s against 5 s under default parallelism and 4.4 s at base (Oct 7; my notes, **ASSUMED** current) |
| 2 | `api/_utils/filmTape/candlePass.test.js:162` (also `:291`, `:326`) | row timeout + CPU | ~2.9 s at ~2.1 s (cache) | one write and four passes per row, clock injected, no timers |
| 3 | `api/cron/film-tape-candles.test.js:75` "flag on: the morning run…" | row timeout + CPU | ~3.5 s at ~1.5 s (cache) | Date frozen, CPU only |
| 4 | `src/screens/agentBattleScreenHuddle.test.js:103`, `:108`, `:117` | row timeout only (synchronous) | file 12.7 s / 11 rows (cache) | each row runs a synchronous `execSync` grep of `src/` and `api/` (`:96`): no timer can fire, only the wall-clock check |
| 5 | heavy jsdom screens: `AgentBattleScreen.cockpit2b`, `filmRoomV2/FilmRoomScreenV2.focus` (`:28-68`), `AgentBattleScreen.controller` (`:530`, `:593`, `:665`, `:693`, `:729`, `:754`), `AgentBattleScreen.quoteAvailability` | row timeout + CPU; the controller rows also sleep twice at 800 ms each (`settle`, `:137`) | ~1.5–2.1 s per row (cache) | Date frozen only |
| 6 | `src/components/League/backing/backingLanding.test.jsx:253`, `:280` | row timeout + CPU | ~0.8 s per row (cache) | four full mounts per row; seen red under parallel load (my notes) |
| 7 | `src/components/League/leagueRawIds.guard.test.jsx:435`, `:459`; `src/components/League/backing/backingRawIds.guard.test.jsx:328` | row timeout + CPU (synchronous SSR) | not measured | the "raw ids" rows seen red under load; which one was red is **ASSUMED** |
| 8 | `api/agent/chat.test.js:1833-1838` "with the runtime hook installed … no wait at all" | wall-clock elapsed assertion | **< 1,000 ms** (`SHADOW_LOG_CAP_MS / 2`, `chat.js:175`) | real Date and timers. A step longer than the turn's remaining slack inside the handler turn fails it |
| 9 | `api/_utils/researchRecords/store.test.js:43-46` "a transaction that never settles → 'unconfirmed'" | wall-clock elapsed assertion | ~975 ms around a 25 ms deadline | a step inside the ~25 ms window always fails it; low odds |
| 10 | `src/hooks/useCockpitRecords.jsdom.test.jsx:77` | stall only | a 5,000 ms `vi.waitFor` inside a 5,000 ms row | `vi.waitFor` runs on `setTimeout`, so no wall-clock exposure; anchor from the subagent, **ASSUMED** |

Rows 2 to 6 have more slack than one step at their cached durations. They go red when CPU load stretches them, as my notes record for Oct 7 and Oct 22. A step then takes the last of the slack. Row 1 is the only one exposed to a step on its own; row 7 was not measured.

**Judged safe** (the subagent's reading, not re-read by me, **ASSUMED**):
- **Timer order, not wall clock:** `ceremonyDeployTarget.test.jsx:454`, a 600 ms sleep against a 400 ms gap timer that is due first.
- **Ample headroom:** the ceremony wait caps, ≥ 2.4 s of headroom, ≥ 1.1 s after a step; `tournamentOrchestrator.test.js:525`, ~5 s.
- **A forward step only shrinks a budget the row expects to exceed:** `wireEditorialRun.test.js:161`, `:193`; `wireEditorialJudge.test.js:193`.
- **Date frozen or both clocks faked:** the agent-evaluate tickStamps / reviewPass / tickCapture / offGolden suites, and `agent-evaluate.timing.test.js:200`.
- **Order kept by a forward step:** the before ≤ stamp ≤ after brackets.

Two ways to retire the whole class, both outside this task and for a ruling:
- **Machine:** stop WSL stepping the clock. That is a host time-sync setting, the founder's to change; not touched.
- **Repo:** per-file fake clocks like this one, or raised per-row timeouts for the heavy rows.

## 6. Checks

- **Full suite**, Linux (WSL, Node 20.20.2), `TZ=UTC npm run test:run -- --maxWorkers=8`, under `flock /tmp/pd-suite.lock`, nothing beside it, on `b3835f33` (`main` + the fix; `main` had not moved): **27,140 rows, 27,051 pass, 0 fail, 89 skipped**, 1,237 files, 320 s. `api/_utils/callRecords/`: 24 files, 568 rows, 0 fail.
- **`lint:gate`** on `b3835f33`: exit 0.
- The pushed head adds only this report. The only test that reads `docs/audits/` reads one fixed fixture JSON (`api/_utils/intraday/seed.test.js:14`). `lint:gate` and `vite build` on the pushed head are in the PR description.
- CI's `vitest (unit)` check was not watched (BUILD_RULES §2).

## 7. For the founder

- **FQ-1** (§2): keep the wall-clock deadlines as they are, or rule a follow-up that moves the step-internal deadlines to the monotonic clock. I recommend keeping them: the forward-step outcome is the safe one, and production is not known to step.
- **The census** (§5): the same WSL clock steps can redden any other real-time row with under ~1.75 s of wall-clock slack. That includes every test row longer than ~3.3 s, through vitest's own timeout check. Candidates 1–9 are for separate tasking.
