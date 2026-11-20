# Cockpit staged switch-on: the pre-flight, the daily readout, the market-data cuts flip, and the founder's runbook

**Date:** 2026-11-20 (Friday) · **Session:** local Claude Code, Opus · **Build prompt:** `BUILD_PROMPT_COCKPIT_STAGED_SWITCH_ON_NOV20_2026` (Fable, the cockpit / capacity chat)
**PR 1:** [#1100](https://github.com/fashraf94/TradeSeven/pull/1100), branch `claude/beta-daily-readout` (this report lives here) · **PR 2:** [#1099](https://github.com/fashraf94/TradeSeven/pull/1099), branch `claude/eval-cuts-flip`

**Markers (BUILD_RULES §3).** **VERIFIED** means read at that `file:line` in this session, at `main` = `41c04cd2`. **MEASURED** means produced by a run in this session: a production read, a suite or the mutation battery. **ASSUMED** means not checked, with the reason given.

---

## Verdict

| Part | Result |
|---|---|
| **A. Pre-flight** (read-only) | The cockpit path on `main` is as the prompt describes (all four flags on; the resolver composes the allowlist with the cohort; the cohort test admits only real agent-mode battles). **The control document is absent** in production. Nov 17, 19 and 20 each have one agent-mode battle and Nov 18 has none, all from one allowlisted pilot account: K = 1, no deferral, no 429. **Anthropic reports 10,000 requests, 10,000,000 input and 2,000,000 output tokens a minute; at 70 % that allows K = 269 (input tokens bind).** The code caps K at 8 and ruling R4 holds it at 2, so EODHD binds first, not Anthropic. **Stage 1 would admit 0 owners outside the allowlist today.** `LEAGUE_HIDE_ENABLED` is still `false` (`featureFlags.js:152`). |
| **B. The daily readout** (PR 1) | `scripts/beta-daily-readout.mjs`: one session in plain words, ending in nine lines that read ok, PAUSE, STOP or CHECK. Its cockpit lines follow the founder's Q-1 / Q-2 rulings (§7). `--switch` is Part E's verification read. 57 rows; **71 / 71 mutants killed**. Read-only, no uid, no id printed. Its production run for Thu Nov 19 reads **CHECK**: one `invalid_tool_result` in 16 `on` checks, which is a CHECK line and never a STOP. Every other line is `ok`. |
| **C. The cuts flip** (PR 2) | `EVAL_MARKET_DATA_CUTS_ENABLED` → `true`, with the pin, its literal row, its registration row and the `DARK_BY_DESIGN` entry in the same commit. The full Linux suite reddened **28 rows in five golden suites**, whose `marketDataCache` doubles lacked the symbol helpers the cut path calls. The flip commit completes those doubles (§5.1), and every golden holds byte-identical with the cuts on and off. After that: the full suite exits 0, the rules suite is green in both states, `lint:gate` and `vite build` exit 0, and a flag-only rollback reddens only pin and guard rows. Expected effect, from the code: **about 119 → about 78 EODHD units per agent-mode check, and about 3,000 → about 2,000 per battle-day.** The measured "before" is the pilot's Nov 17 and Nov 19 traffic (§5.3). |
| **D. Runbook** | §6, in plain steps. Monday's steps 1–2 need only this session (Part E). Step 3 (the readout after each close) needs PR 1 on `main`, or a session on its branch. |
| **Blocks stage 1** | **Nothing.** Both founder questions were answered on 20 Nov (§7) and are now built. The cockpit's one STOP is `on` timeouts above 2 % over three sessions, with at least 60 checks. `invalid_tool_result`, 400s and a sweep lag past 30 minutes are CHECK lines. |

---

## 1. Preamble (BUILD_RULES §2, §3)

- `git fetch origin` was run first: `origin/main` = `41c04cd2` (Merge pull request #1097). The session's worktree was clean at that commit.
- **PR 1:** branch `claude/beta-daily-readout`, cut from `origin/main` @ `41c04cd2`, clean tree. Code commits `dbbd2e5e` (the readout) and `27cec4d6` (the cockpit lines per the Q-1 / Q-2 rulings); the report first landed in `d31dadd3`; the head is the commit that last updated this report.
- **PR 2:** branch `claude/eval-cuts-flip`, cut from `origin/main` @ `41c04cd2`, clean tree. Flip commit `5b43230d` (flag, pins and the five doubles), note commit `523e5216`; head `523e5216`. The first flip commit, `ddf9ebcb`, was amended before any push (§5.1).
- **Production was read only**: Admin SDK `.get()` / `getAll()`, project `tradeseven`. There was no write, no deploy, no environment variable and no Vercel, Firebase or EODHD setting. `cockpitConfig/release` was neither created nor edited. Credentials came from the main checkout's `.env.local` through `node --env-file` (worktrees have none). Only variable names were checked.
- **No account id** appears in code, output, this report or a commit message. Owners are counted, and only as ordinals.
- No fenced file was edited (BUILD_RULES §1). The model request is untouched.

## 2. Founder rulings (20 Nov 2026), verbatim

| # | Ruling (20 Nov 2026) |
|---|---|
| S-1 | The beta launches **Fri Dec 4**. Today's cockpit opens to every player by launch. This lifts the Nov 15 hold (BB-20) for the cockpit as it stands. The trade-desk rework still arrives with trader v1, after launch. |
| S-2 | **Stages are counted in players, not in percent.** The release switch (PR #1039) goes to `shareBp: 10000` at stage 1. It cannot target named testers (it holds no ids, by design), and with a handful of players a percentage would leave testers out at random. What controls the stage is how many players the founder invites. The control that stops it is `disabled: true`. |
| S-3 | Gates before the doors open on Dec 4: (a) Amendment H (the `on` tool text's one false sentence, plus the release itself) blessed by the framework chat and merged; (b) the first-time cockpit intro, shipped with F-3 (the status hook's re-ask). Neither gates stage 1. Stage 1 players are invited testers, in the same position as the two pilot accounts. |
| S-4 | Capacity: at 100,000 EODHD calls a day, and after these cuts, the app holds about **8–10 players in battles at once** (the full range is 7–11, depending on how long players watch). Going past that needs a higher EODHD allowance or the market-data plan, plus `EVAL_POOL_K` above 2. The planning target of 25 waits on that. |
| S-5 | The founder's answers to Capacity Build 1's five questions (PR #1071):<br>Q1 the shared macro quote goes only to battles that don't own the instrument, as built.<br>Q2 the three occasional fetches are not cut now.<br>Q3 yes to a TTL policy on `evalSessionDaily` (`expiresAt`); the founder creates it in the console.<br>Q4 rewriting `marketDataCache/{SYM}_daily` once a session is accepted.<br>Q5 flip order: cuts, then the guard, then `EVAL_POOL_K = 2`. |

**The founder's answers to this report's Q-1 and Q-2 (20 Nov 2026), verbatim:**

> Q-1: use absolute limits, and only for what the cockpit can cause. invalid_tool_result stays a CHECK line, never STOP (the readiness check found it is not caused by the cockpit: 1.9% on vs 2.5% off). STOP only when on-check timeouts exceed 2% over the last three sessions with at least 60 on checks; below 60 checks, print CHECK with the counts. A 400 is CHECK (often account-level, like the Oct 8 usage-limit 400s).
> Q-2: keep 30 minutes, as a CHECK line, not STOP.

---

## 3. Part A: pre-flight (read-only)

### A1. The cockpit path on `main` (VERIFIED at `41c04cd2`)

| What | Where | Value |
|---|---|---|
| `CALL_RECORDS_MODE` | `src/config/featureFlags.js:2965` | `'on'` |
| `COCKPIT_UI_ENABLED` | `src/config/featureFlags.js:3036` | `true` |
| `COCKPIT_2B_ENABLED` | `src/config/featureFlags.js:3084` | `true` |
| `LEAGUE_BATTLEVIEW_ROUTING_ENABLED` | `src/config/featureFlags.js:288` | `true` |

- **The resolver composes the allowlist with the cohort.** `resolveCallRecordsMode` (`api/_utils/callRecords/mode.js:89-100`): when the global mode is `'on'`, the result is `'on'` if the owner is allowlisted (`:94`), otherwise `'on'` if `isReleaseCohortBattle(battle)` (`:95`), otherwise `'off'`. `isReleaseCohortBattle` (`:107-113`) applies `isInReleaseCohort` to the cached view (`getReleaseView`). Every malformed input resolves to `'off'` (`:96-99`).
- **The cohort test.** `isInReleaseCohort` (`api/_utils/callRecords/release.js:140-156`) needs all of these:
  - an active view (`:142`), whose own fields it checks again (`:144`);
  - `gameMode === RELEASE_COHORT_GAME_MODE` (`:146`), which is `TIERED_GAME_MODE` (`:79`) = `'baggerbomb_agent'` (`src/constants/agentGameModes.js:36`);
  - `isCpu !== true` (`:147`);
  - an owner id that is not a CPU seat's (`isCpuUserId`, `:148`; the `cpu-` prefix, `src/constants/leagueTournament.js:358-360`);
  - a non-empty string owner (`:149-150`);
  - `bucketOf(owner, salt) < shareBp` (`:151-152`).
- **The control document's parse rules.** `parseReleaseDocument` (`release.js:103-119`):
  - An absent document is `absent` (`:105`).
  - These are `malformed`: data that is not a plain object (`:106`); any of the three fields missing as an own field (`:108`); `shareBp` not an integer 0–10000 (`:110`); `disabled` not a boolean (`:111`); `salt` not a string (`:112`).
  - `disabled: true` is `disabled`, with `active: false` (`:113`). Anything else is `ok`, with `active: true` (`:114`).
  - Other fields are ignored. Every non-`ok` status is an empty cohort: the allowlist alone decides.

### A2. The control document is absent (MEASURED)

There was one `.get()` of `cockpitConfig/release` at 2026-11-20T16:55:42Z (11:55 AM ET). `exists: false`, and `parseReleaseDocument` gives `{ status: 'absent', active: false, shareBp: 0 }`. A listing of `cockpitConfig` (at most 10 documents) found **no document at all**, so the runbook's console step is **Start collection**, not Add document.

### A3. The baseline since Capacity Build 1 merged (MEASURED)

`scripts/eval-capacity-read.mjs --from 2026-11-17 --to 2026-11-20` and `scripts/cockpit-release-read.mjs` over the same days, read at 16:55 UTC (11:55 AM ET). **Nov 20 is a partial session** (10 of 26 runs). The window holds **one agent-mode battle on each of Nov 17, 19 and 20, and none on Nov 18**. All of them belong to one allowlisted pilot account; there is no League battle and no CPU seat.

| ET session | Runs | `pool` K / max in flight / dispatched | Anthropic limits (req · input · output per min) | Lowest left (req · input · output) | 429s | EODHD requests (eod · real-time · intraday) | Units | Per check evaluated | Poller units |
|---|---|---|---|---|---|---|---|---|---|
| Nov 17 | 26 | 1 / 1 / 24 | 10,000 · 10,000,000 · 2,000,000 | 9,999 · 9,991,000 · 1,999,000 | 0 | 1,008 · 1,008 · 168 | **2,856** | 91 req, **119 units** | 24,482 |
| Nov 18 | 26 | 1 / 0 / 0 | — (no model call) | — | 0 | 0 | 0 | — | 20,541 |
| Nov 19 | 26 | 1 / 1 / 26 | 10,000 · 10,000,000 · 2,000,000 | 9,999 · 9,991,000 · 1,999,000 | 0 | 1,098 · 1,098 · 182 | **3,106** | 91.5 req, **119.5 units** | 24,847 |
| Nov 20 (partial) | 10 | 1 / 1 / 2 | 10,000 · 10,000,000 · 2,000,000 | 9,999 · 9,991,000 · 1,999,000 | 0 | 93 · 93 · 14 | 256 | 100 req | 7,504 |

- **Units** are end-of-day + real-time + 5 × intraday. "Per check evaluated" divides by the battles the runs evaluated, which is the discovery's per-check basis (B4: 117 units, about 89 requests).
- **`on` checks and failure classes:** 16 on Nov 17 (no failure), 0 on Nov 18, 16 on Nov 19 (**one `invalid_tool_result`**), and 2 on Nov 20. There were **no `off` checks**, so the stage read flags Nov 19 as "`on` invalid with no `off` baseline that session — read it". Across the 34 dispatched calls the tick-record outcomes are 33 `ok` and 1 `failed:invalid_tool_result`.
- **Cost line** (Haiku 4.5 list price on measured tokens):
  - Nov 17: $0.3994 (271,426 input, 25,587 output tokens).
  - Nov 19: $0.4143 (281,441 input, 26,570 output).
  - Nov 20 (partial): $0.0489.
  - That is **≈ $0.025–0.026 per model check** and **≈ $0.40–0.41 per battle-day**. The declarations tool's estimated extra is $0.0438 a day.
- **Evaluator:** no deferred, budget-skipped or lock-skipped run. Runs with one model check have a median wall time of 38.6 s (max 54.2 s); the largest run took 54.2 s. Per dispatched call: 17,197 input and 1,674 output tokens (medians).
- **Sweep lag:** 0.7 min (6 calls swept on Nov 17, 18 on Nov 19).

There is therefore **a measured "before" for Part C**: the pilot's own traffic, at 119–119.5 units per agent-mode check and 2,856 / 3,106 units per battle-day. The discovery's figures (117 and 3,042) are the code's model of the same thing.

### A4. What K the Anthropic limits allow (arithmetic on A3)

One lane takes about 1.55 requests, 26,000 input tokens and 2,500 output tokens a minute (discovery E1). Against 70 % of each recorded limit:

| Limit (per minute) | 70 % | Per lane | K that fits |
|---|---|---|---|
| Requests 10,000 | 7,000 | 1.55 | 4,516 |
| **Input tokens 10,000,000** | **7,000,000** | **26,000** | **269** |
| Output tokens 2,000,000 | 1,400,000 | 2,500 | 560 |

**The largest K under 70 % of every limit is 269. Input tokens bind.** Three caveats:
- **The limits are account-wide.** Huddle, reflections and chat draw on the same minute. The lowest remaining seen (9,991,000 input tokens) shows how little the rest used in that minute.
- **The code caps K at 8.** `clampPoolK` reads any value above `EVAL_POOL_K_MAX = 8` as 1 (`api/_utils/evalPool.js:24`, `:31-33`).
- **Ruling R4** holds K at 2 until the market-data plan for 25 players.

**Anthropic is not the binding limit. EODHD is** (S-4).

### A5. Who stage 1 would admit today (MEASURED)

This was one masked read of `agentBattles` (`ownerId`, `gameMode`, `isCpu`, `status`, `expiresAt`) over the last 10 completed sessions, **Nov 6 → Nov 19**, with today counted apart. Owners were compared in memory with the allowlist from the shell, which holds 2 entries.
- **Distinct owners outside the allowlist with an agent-mode battle: 0.** That is also 0 for today, as expected.
- The window holds 7 agent-mode battles, plus 1 today. They all belong to **one** allowlisted owner (ordinal: owner1). There is no League battle, no CPU seat and no other mode.
- Under `{ shareBp: 10000, salt: 'beta-1' }`, release.js's own test admits that one owner too. At 10000 the pilot is in the cohort as well as on the allowlist; it resolves `on` either way.

### A6. `LEAGUE_HIDE_ENABLED`

**Still `false`** on `main` (`src/config/featureFlags.js:152`, VERIFIED). This is reported only: the beta launch chat owns that flip. While it is `false`, a League battle stays `off` at every share (the cohort admits agent mode only). Such a battle would be the only `off` traffic left once `shareBp` is 10000; see §7 Q-1.

---

## 4. Part B: the daily readout (PR 1)

`scripts/beta-daily-readout.mjs`. Read-only, with no uid. By default it reads the **latest NYSE session whose close was at least an hour ago**, using the repo's own calendar (`src/utils/marketCalendar.js`). It skips weekends and holidays and counts an early close from 1 PM. So Thanksgiving evening reads Wednesday, the day after reads itself from 2 PM ET, and Monday at 5 PM reads Monday. Flags: `--session YYYY-MM-DD` (it must be a trading session), `--detail` (adds the two reads' own tables), `--json <file>` and `--switch` (Part E). It loads Admin credentials the way the other two scripts do (`./loadLocalEnv.js`, then `firebaseAdmin.js`, both inside `main()`).

**What it is built on (no copying).** `gather` and `renderLimits` (`scripts/eval-capacity-read.mjs:601`, `:581`), and `gatherStage` and `renderStage` (`scripts/cockpit-release-read.mjs:339`, `:294`), are each called over the one session. Neither file was changed. The readout adds only:
- one `.get()` of the control document, parsed by release.js;
- one battle read masked to `ownerId`, `gameMode`, `isCpu`, `status` and `expiresAt`, used for the distinct-owner count;
- the summary, the rules and the block.

**The PAUSE lines.** The thresholds are named constants at the top of the file. Every rule has a `no data` state: a null or a NaN is never compared with a threshold and never read as `ok`.

| Rule | Constant | Reads |
|---|---|---|
| Cost per battle-day (session mean: the evaluator's total ÷ non-CPU battles with a tick that session) | `PAUSE_COST_PER_BATTLE_DAY_USD = 0.65` | PAUSE if above |
| Cost per model check | `PAUSE_COST_PER_CHECK_USD = 0.032` | PAUSE if above |
| Evaluator capacity | — | PAUSE on any run with `deferred > 0` or `budgetSkipped > 0` |
| Anthropic | `PAUSE_ANTHROPIC_INPUT_LEFT_SHARE = 0.2` | PAUSE on any 429, or the lowest input tokens left < 20 % of the limit |
| EODHD (records) | `PAUSE_EODHD_UNITS = 60_000`, `EODHD_INTRADAY_UNITS = 5` | PAUSE if the evaluator's eod + realTime + 5 × intraday plus the poller's units are above. A missing part is `no data`, never a zero; a known part already above the line pauses. `other` requests are printed but not counted (the letter of the rule). |
| Cockpit timeouts (ruling Q-1) | `STOP_TIMEOUT_RATE = 0.02`, `STOP_TIMEOUT_MIN_CHECKS = 60`, `TIMEOUT_WINDOW_SESSIONS = 3` | **STOP: set `disabled: true`** when `on` timeouts are above 2 % of the `on` checks over the session and the two trading sessions before it (`windowSessions`, from the market calendar), with at least 60 `on` checks. The same rate over fewer than 60 checks is **CHECK** with the counts. At or under 2 % it is `ok` with the counts. |
| `invalid_tool_result` (ruling Q-1) | — | **CHECK, never STOP**, when the session has any. The readiness check found the cockpit does not cause it (1.9 % `on`, 2.5 % `off`). |
| Model 400s (ruling Q-1) | — | **CHECK** when the session has any; they are often account-level (the Oct 8 usage-limit 400s). |
| Sweep lag (ruling Q-2) | `CHECK_SWEEP_LAG_MS = 30 min` | **CHECK, not STOP**, when a call the sweep settled was stamped more than 30 minutes after its deadline. |

The `off`-baseline comparison of the first build no longer drives any line; the stage read's own tables (`--detail`) still show it. The verdict ranks STOP over PAUSE, PAUSE over CHECK, and CHECK over ok. It is `no data` only when no line could judge anything.

**One reading of Q-1 to confirm.** "Below 60 checks, print CHECK with the counts" is built as: the same above-2 % rate, over fewer than 60 checks, prints CHECK instead of STOP. Under 60 checks with no timeouts, or at most 2 %, the line is `ok` and still shows the counts (Nov 19: 0 timeouts in 32 checks). The other reading would print CHECK on every day with fewer than 60 checks in the window. That changes one line (`beta-daily-readout.mjs`, the `cockpitTimeouts` CHECK branch) if the founder wants it.

**Tests** (`scripts/beta-daily-readout.test.js`, 57 rows; the neighbours `cockpit-release-read.test.js` and `eval-capacity-read.limits.test.js` are unchanged and green):
- **Thresholds.** Every rule on both sides of its line and at the line itself, including the timeout STOP's 2 % and 60-check edges, its window, and that `invalid_tool_result`, 400s and the sweep lag never STOP; each constant against a value between it and a nearby wrong value; every `no data` path, including NaN and null.
- **Calendar.** The default session after the close, before it, on Thanksgiving, on the early close and at a weekend.
- **Fake Admin handle.** Four sessions driven end to end, as the other two scripts' tests do: a normal one, one that trips every rule, one with no battles, and an empty one.
- **No id in the output.** Six owner, battle, agent, CPU, call and eval ids, plus a deferred battle id, are absent from the block, the detail and the `--json` object.
- **Read-only.** A source grep for any Firestore write.
- **Part E.** The switch read at absent, 0, 10000, disabled and a partial share; NOT AS EXPECTED; and "nothing to test yet".

**Mutation check** (snapshot tree of `27cec4d6`, judged by exit code with at least one failed row, every anchor unique): **71 defined, 71 ran, 71 killed.** 0 survived, 0 broken, 0 error, and the file was restored. The 71 are the first battery's 48 that still apply, plus 23 for the cockpit lines. The new ones cover the timeout STOP's comparison, its 2 % and its 60 checks (each in both directions), STOP read as CHECK, the under-60 CHECK read as ok, the window cut to the session or to two sessions, and the stage read cut to the session. They also cover `invalid_tool_result` and 400s read as STOP or thresholded at 2, the sweep lag's comparison, its 15 / 45-minute constants and a STOP status, and every `no data` guard. The first battery (56 / 56 at `dbbd2e5e`) covered the rest: every flipped comparison and wrong constant of the cost and capacity lines, the verdict's order, the calendar, the summary's arithmetic, the switch read, the read masks and an id leak. Every constant mutant is killed by a behaviour row as well as by the constants pin.

**PR 1's checks.**
- Full Linux suite at the first code commit `dbbd2e5e` (`--maxWorkers=8`, `TZ=UTC`, under `flock`): **exit 0: 1,597 files, 36,552 rows; 36,373 passed, 0 failed, 179 skipped** (324 s). At the rulings commit `27cec4d6`: **exit 0: 1,597 files, 36,558 rows; 36,379 passed, 0 failed, 179 skipped** (357 s).
- `lint:gate` and `vite build` were run at the pushed head; the results are in PR #1100.
- The cumulative diff is 1,449 lines (at the rulings update), under BUILD_RULES §2's 1,500-line review threshold, with about 50 lines of room. A Part E run adds about 10 lines, so it is re-counted before each push. The append that would cross 1,500 is flagged to the founder first, because at the threshold BUILD_RULES requires the multi-lens review.

### The readout for Thu Nov 19 (production, read-only), under the cockpit rulings

#### Beta daily readout — Thu 2026-11-19 (ET)

Read Nov 20, 2026, 12:57 PM ET · read-only · no id is printed.

**CHECK — nothing is paused, but a line needs a read before you invite more players.**

**Players and battles**
- Players with an agent-mode battle: 1
- Agent-mode battles: 1
- Peak battles in one evaluator run: 1

**Model cost** (Haiku 4.5 list price, $1 / $5 per million tokens, on measured tokens)
- Model checks: 16
- Cost per model check: $0.0259
- Cost per battle-day: $0.41 (1 battle-day)
- The evaluator's total for the session: $0.41 (281,441 input, 26,570 output tokens)
- Cockpit split: `on` 16 checks, $0.41 · `off` 0 checks, $0.00
- This is the evaluator only. The Anthropic Console's usage page holds the account-wide total (Huddle, reflections and chat included).

**Evaluator**
- Runs: 26 · with a deferred battle: 0 · with a budget-skipped battle: 0
- Longest run: 53.3 s
- Pool: K = 1, at most 1 battle(s) in flight

**Anthropic limits** (per minute, as the API reported them on the evaluator's calls)
- Limits: 10,000 requests · 10,000,000 input tokens · 2,000,000 output tokens
- Lowest left: 9,999 requests · 9,991,000 input tokens (99.9 %) · 1,999,000 output tokens
- 429s: 0

**EODHD** (units: an intraday request bills 5, the others 1)
- Evaluator: 3,106 units (1,098 end-of-day, 1,098 real-time, 182 intraday requests)
- Intraday poller: 24,847 units
- Together: 27,953 units. The app-wide total is on the EODHD dashboard: browser polling and the fixed jobs (about 10,000 a day) are not in these records.

**Cockpit**
- Switch (cockpitConfig/release, as read now): absent — the two pilot accounts only
- Cohort battles: 0 (outside the allowlist)
- Answers: 0 commands · 0 acknowledgments · 0 heard · 0 acted
- `on` checks: 16 (0 timeouts · 0 400s · 1 invalid_tool_result · 0 other) · `off` checks: 0
- `on` timeouts over the last 3 sessions (2026-11-17 → 2026-11-19): 0 in 32 checks
- Sweep: 18 calls settled, lag max 0.7 min · queue rows overdue now: 1

**Rules**
- Cost per battle-day: ok ($0.41; pauses above $0.65)
- Cost per model check: ok ($0.0259; pauses above $0.0320)
- Evaluator capacity: ok (no run deferred or budget-skipped a battle, over 26 runs)
- Anthropic: ok (no 429; the lowest input tokens left was 99.9 % of the limit)
- EODHD (records): ok (27,953 units; pauses above 60,000 — the fixed jobs and browser polling come on top)
- Cockpit timeouts: ok (0 timeout(s) in 32 `on` checks over the last 3 sessions = 0.0 %; stops above 2.0 % over at least 60 checks)
- invalid_tool_result: CHECK: 1 in 16 `on` checks this session (6.3 %); not caused by the cockpit (readiness: 1.9 % `on`, 2.5 % `off`) — read them
- Model 400s: ok (none in 16 `on` checks this session)
- Sweep lag: ok (max 0.7 min; a read above 30.0 min)

The first run, before the rulings, read the same CHECK for the same failure, then as "no `off` check this session to compare with". The whole output also carries the two reads' own tables (`--detail`); their figures for Nov 19 are the ones in Part A3. The output and its `--json` were scanned for both allowlisted uids: neither appears.

---

## 5. Part C: the market-data cuts flip (PR 2)

### 5.1 The change

Commit `5b43230d` changes the flag and its pins together (BUILD_RULES §2 flip rule):
- `src/config/featureFlags.js`: `EVAL_MARKET_DATA_CUTS_ENABLED = true`, with its docstring and the section header updated.
- `src/config/evalCapacityFlags.test.js`: the pin moves to `true`. The literal row moves to `'true'`. The registration row turns around: the guard's entry stays, and the cuts' entry is asserted gone.
- `src/config/flagPinGuard.test.js`: the `DARK_BY_DESIGN` entry is dropped and replaced by an "intentionally ABSENT" note (the `FILM_TAPE_WRITE_ENABLED` precedent).

- **Also in the flip commit:** five golden suites' `marketDataCache` doubles take the four real symbol helpers. Their files are `api/cron/agent-evaluate.callRecords.offGolden.test.js`, `.callRecords.rollback.test.js`, `.meetingCopy.baseline.test.js`, `.stagnationLive.golden.test.js` and `.tickCoherence.test.js`.

**This is more than the FLIP MAP named.** Capacity Build 1's FLIP MAP, and the prompt's "nothing else changes", listed the pin and the `DARK_BY_DESIGN` entry only. The full-suite sweep with the flag on found 28 more red rows, in goldens whose doubles were incomplete for the cut path (§5.2). Build 1's flag-on dark proof held for its own harness; these suites' doubles simply never had the helpers. BUILD_RULES §2 requires a flip to reconcile what it reddens in the same commit (precedent: the Build 2b flip, PR #989). The choice was between pinning the flag `false` in each suite and completing the doubles; completing them keeps the goldens on the configuration production runs. No golden fixture or recorded hash changed.

The second commit (`523e5216`, the dated note first written as `325055e5` and re-applied after the flip commit was amended before any push) records S-5 in `docs/audits/20261115_BUILD_EVAL_CAPACITY_1.md` §14.

**Found, not fixed (separate tasking; it does not block):** the share lookup `sharedMacroQuote` runs inside the fan-out's per-symbol `try` (`agent-evaluate.js:1333`). If it ever threw, the symbol would get no quote at all instead of falling back to the battle's own fetch, and on a held symbol the quote guard would then skip the tick. With the real helpers it does not throw; the five doubles above were the only way it did.

**PP-1 is closed on `main`.** That was Capacity Build 1's after-review finding: with the cuts on, a macro becoming a candidate mid-check kept the run's quote. VERIFIED: the fan-out marks the shared names (`api/cron/agent-evaluate.js:1329`, `:1337`), and both late sites fetch a marked name (`:1815`, `:3004`). The last change to `agent-evaluate.js` is that fix (`adb26651`). No new mid-check price site has appeared since.

### 5.2 Checks

| Check | Result |
|---|---|
| Full Linux suite at the first flip commit `ddf9ebcb` (flag and pins only), `--maxWorkers=8`, `TZ=UTC`, under `flock` | **exit 1: 28 rows red in 5 files** (36,501 rows). `agent-evaluate.meetingCopy.baseline` 14, `.callRecords.offGolden` 9, `.callRecords.rollback` 3, `.stagnationLive.golden` 1, `.tickCoherence` 1. All are byte-identity goldens. The first bytes to move were the prompt's macro line: `SPY +0.76% · QQQ +0.59% · BTC +0.97%` became `+0.00%` for all three. |
| Cause (MEASURED) | The five suites' `marketDataCache.js` doubles define `getStockAnalysisData`, `fetchIntradayBatch` and a few others, but not the symbol helpers. With the cuts on, `sharedMacroQuote` calls `eodSymbolOf` (`api/_utils/evalMarketData.js:85-87`, `:301-305`), which needs `formatEODHDSymbol`, `getCleanSymbol` and `isCryptoSymbol`. The doubles' access throws inside the fan-out's per-symbol `try` (`api/cron/agent-evaluate.js:1330-1345`), so SPY, QQQ and BTC-USD.CC got no quote. The real module has all three helpers. |
| Proof | In a scratch tree, the five files were run with each double given the four real helpers (`getCleanSymbol`, `isCryptoSymbol`, `formatEODHDSymbol`, `DAILY_WINDOW_CALENDAR_DAYS`). **67 / 67 rows were green with the cuts on, and 67 / 67 at `main` with the cuts off.** No golden fixture or recorded hash was touched. |
| Fix (in the flip commit, BUILD_RULES §2) | Exactly that. Each double takes the four helpers from the real module (`importOriginal`), with a two-line comment. The goldens now guard the live configuration in both states. |
| Full Linux suite at the final head `523e5216` | **exit 0: 1,596 files, 36,501 rows; 36,322 passed, 0 failed, 179 skipped** (365 s). |
| Control: the flag alone, pins as on `main` | The exported value is `true`, and exactly **4 rows go red**, all pin or guard rows: the pin, the literal row, and two `flagPinGuard` rows ("every pinned flag matches its live value" and "DARK_BY_DESIGN lists only real, currently-dark flags"). |
| Rollback: the flag alone back to `false`, full suite | exit 1, and exactly **3 rows red**, all pin or guard rows: the pin, the literal row, and `flagPinGuard` "every pinned flag matches its live value". A rollback is therefore the flag, its pins and the `DARK_BY_DESIGN` entry (whose registration row then turns back), and nothing else (1,596 files, 36,501 rows). |
| `npm run test:rules` (Linux, JDK 21, emulator) | **46 files, 839 rows green**, with the cuts on (`523e5216`) and off (`main`). |
| `npm run lint:gate` | exit 0 at `523e5216`. |
| `vite build` | exit 0 at `523e5216` (only the usual chunk-size warning). |
| Merged with current `main` | `origin/main` = `41c04cd2`, fetched again before the final checks. That is the branch's own base, so there was nothing to merge. |

### 5.3 The expected effect, from the code

These figures use Capacity Build 1 §5.5's unit model (41 symbols per agent-mode check; the cuts serve the daily bars once per symbol per session and the three macros once per run):

| | Per agent-mode check | Per battle-day (26 checks) |
|---|---|---|
| Measured before (Part A3, the pilot's traffic, flag off) | **119 (Nov 17) · 119.5 (Nov 19)** | **2,856 (Nov 17) · 3,106 (Nov 19)** |
| The code's model, flag off | 117 | 3,042 |
| The code's model, flag on, 1 battle per run | **≈ 78** (74.6 + 3 ÷ B, B = 1) | **≈ 2,000** (≈ 1,940 + 78 ÷ B) |

The readout's EODHD line and `eval-capacity-read.mjs` measure the "after" from the first session after the merge. With one battle a session, expect the evaluator's units to fall from about 3,000 to about 2,000 a battle-day.

### 5.4 The TTL policy (S-5 Q3): steps for the founder

Optional hygiene. Each `evalSessionDaily` document carries a three-day `expiresAt`, and nothing breaks without the policy.
1. In the Firebase console, open **Firestore Database → TTL policies → Create policy**.
2. Set the **collection group** to `evalSessionDaily`, and the **timestamp field** to `expiresAt`.
3. Save. The policy takes a while to become active, and Firestore deletes an expired document some time after its expiry, not at once (ASSUMED from the console's general behaviour, not checked in this session).

---

## 6. Part D: the founder's runbook

**Stage 1: Monday Nov 23, before the open.**

1. In the Firebase console, open **Firestore Database → Start collection**. Use collection ID `cockpitConfig` and document ID `release`, and add three fields:
   - `shareBp`, type **number**, value `0`;
   - `disabled`, type **boolean**, value `false`;
   - `salt`, type **string**, value `beta-1`.

   Save, then tell this Claude Code session **"release document created"**. It runs Part E: the status should read `ok` and the cohort should be empty.
2. Edit `shareBp` to `10000` and save. Tell the session **"shareBp 10000"**. It runs Part E: every active agent-mode, non-CPU battle should now be in the cohort. Before the open there may be no battle yet. The read then says "nothing to test yet", and the known-owner line (every agent-mode owner of the last 10 sessions, put through the same test) carries the check.
3. From now on, **the stage is the number of players you invite.** After each close, run `node scripts/beta-daily-readout.mjs`, or ask a Claude Code session to run it. **Don't invite more players while any line reads PAUSE.** A CHECK line is a read, not a pause: ask a session to look. The command needs PR 1 merged into `main` (or a session on its branch). Steps 1–2 need only this session.

**The off switch.**
- **Edit `disabled` to `true`.** Screens lose the cockpit within about 60 seconds, and the evaluator stops at its next run (≤ 15 minutes). No redeploy.
- **Deleting the document** returns the cockpit to the two pilot accounts.
- **Never change `salt` during a session.**
- **Before switching off for a health trip, save the readout's output.**

**Stage 2: the doors open, Fri Dec 4.** No switch change. Before then, Amendment H must be merged and blessed, and the intro with F-3 merged.

**Stage 3: growth toward 25.** Add players only while the readout reads `ok`, and only after the capacity steps: the guard flip, then `EVAL_POOL_K = 2`, then an EODHD allowance or the market-data plan before going past about 8–10 players at once. Until K = 2, one evaluator run makes about 5–6 agent-mode model checks (discovery). A run that cannot reach every battle shows as the readout's evaluator PAUSE line.

---

## 7. Founder questions, answered 20 Nov 2026 and built

- **Q-1. The cockpit STOP rule had no `off` baseline once `shareBp` is 10000.** Ruled: absolute limits, only for what the cockpit can cause (verbatim in §2). Built (§4): one STOP, for `on` timeouts above 2 % over three sessions with at least 60 checks. `invalid_tool_result` and 400s are CHECK lines. One reading is noted in §4 for confirmation.
- **Q-2. The sweep-lag bound.** Ruled: 30 minutes, as a CHECK line, not STOP. Built as `CHECK_SWEEP_LAG_MS`.

## 8. Part E: verification reads (appended each time the control document changes)

_No run yet._ A run is appended here each time the founder says the control document changed: the time, the document's values, and the counts.
