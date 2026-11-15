# Phase 0 — running battles in parallel in the agent evaluator (read-only discovery)

**Date:** 2026-11-15 (Sunday; production read 12:36–12:58 ET) · **Mode:** read-only. No source, test, flag, `vercel.json`, environment or project-setting change; no deploy; no external API call (no Anthropic, no EODHD). · **Refreshes:** `docs/audits/20260918_PHASE0_EVAL_CRON_SCALING.md` (18 Sep), against today's `main`, with production measurements it could not take, and prices a fourth shape: a bounded pool inside one invocation.

**Markers (BUILD_RULES §3).** **VERIFIED** = read at that `file:line` in this session at `0b720acc`. **MEASURED** = taken from production with this session's read-only script; the window is 2026-10-16 → 2026-11-13 (21 sessions) unless a line says otherwise. **ASSUMED** = not checked, with the reason. Line numbers drift; re-verify before relying on them.

---

## 0. Preamble (BUILD_RULES §2, §3)

| | |
|---|---|
| Fetch | `git fetch origin` was the first step. `origin/main` = `0b720accd53e016c87976c3c2a43f89a2f1cb892` (merge of #1062). The prompt's line numbers are from `0670fcd7`; every anchor below was re-read at `0b720acc`. |
| Branch | `claude/phase0-eval-fanout`, cut from `origin/main` at `0b720acc`; clean tree at the start. |
| Files changed | 3: this report; `scripts/eval-capacity-read.mjs` (new, read-only); the appended §11 of `docs/audits/20261110_COCKPIT_RELEASE_READINESS.md` (Part F, verbatim). Under the BUILD_RULES §2 review threshold (10 files / 1,500 lines). |
| Production reads | Firestore Admin SDK, `.get()` and `getAll()` only: `agentEvalRuns` (546 docs), `agentBattles` (60 docs, field-masked to `evaluations`, `gameMode`, `isCpu`), `agentBattles/*/ticks` (field-masked; 1,353 in window), `intradayBudget/{etDate}` (21 docs). No write call: the script was grepped for `.set(`, `.update(`, `.delete(`, `.create(`, `.add(`, `runTransaction`, `batch(`, `bulkWriter`, `fetch(`; the only hits are in-memory `Map.set` calls. |
| Ids | No account, owner, agent or battle id was printed or written. The script never selects `ownerId`, `agentId` or `battleId`; a battle document id is used only to address its own `ticks` subcollection; the join key `evalId` (a per-battle sequence like `eval_012`) is dropped before any output. The two pilot accounts are not separable in the output and are not named in it. |
| Credentials | The Firebase Admin variables came from the main checkout's `.env.local` through `node --env-file=…` for the run only. No value was printed. |
| Logs | Vercel function logs were **not readable** in this session. Nothing below is taken from logs. |
| Report copy | A byte copy of this report is kept outside the repo tree in the session scratchpad (BUILD_RULES §3). |

The exact command is in §9.

---

## 1. Verdict table

| Part | Question | Answer |
|---|---|---|
| **A** | What changed since the September facts? | Five of twelve changed. Per-battle wall time is now recorded and measurable. The cron count is 45 of 100, not 39 of 40. The model ceiling is 42 s, not 22 s, so a call must start by 222 s. EODHD per check is higher (about 117 units in agent mode, not 74). The 800 s ceiling would not overlap the next run after all. Seven are unchanged: the loop is still sequential, deferred battles still get nothing, there is still no fetch timeout, and `maxRetries` is still 0. |
| **B** | What is the measured pace? | **An agent-mode model check holds the loop about 39–42 s; a League check about 25 s** (two independent methods agree). About **half of that time (47–51 %) is waiting on the model**. Most of the rest is also network waiting (EODHD fan-out before the call, Gemma and Firestore after it). **Measured agent-mode capacity is 5–6 model-calling battles per run**, not the 6–7 the readiness report extrapolated from a League-heavy mix. No run has ever deferred or budget-skipped a battle (0 of 546). |
| **C** | Is a bounded pool inside one invocation safe? | **Mostly yes.** No module-level state breaks: 255 modules were scanned, and the tick-capture scope is per check and already tested for overlap. Four things need a change first: the dispatcher must stop *starting* battles early enough; "deferred" moves to the dispatcher; EODHD needs a per-request timeout and a process-wide concurrency cap; League group-mates should not run at once. Everything else is safe or cosmetic. |
| **D** | What does each shape buy? | At K or N = 1 / 3 / 5 / 8: **(a) N cron entries, (b) HTTPS fan-out and (d) the pool all reach about 5–6 / 15–18 / 25–30 / 40–48 model-calling battles per run** if one check does not slow the others (ASSUMED). (c), an 800 s ceiling, reaches 17–19, but only if Fluid Compute is on, and its checks run up to 12 minutes late. (b)+(d) multiplies the two. None touches a fenced file. (d) is the only one with one invocation, one pre-loop pass, global fairness and no new cron entry. |
| **E** | What walls come after the evaluator? | **EODHD binds before the evaluator for any K ≥ 2.** Against a 100,000-a-day cap (ASSUMED), today's code runs out at about **7–12 full-day agent-mode battles** (about 150–250 model checks a day), counting the poller's measured growth per battle. At 25 players the server alone needs about 1.7–2.0× the cap; at 100 players about 4.5×. Anthropic's limits are not recorded anywhere (founder question). At K = 8 the evaluator alone makes about **12 model requests and 209k input tokens a minute** while a run is active. **Under BB-7 a deferred battle gets no price, no score and no stop check**, so capacity becomes correctness. |

**The numbers in one place (MEASURED unless marked):**

| | Agent mode | League | All model checks |
|---|---|---|---|
| Loop time per model check (run-level fit, four regressors) | **38.8 s** (41.8 s in runs with no League check) | **25.2 s** | 30.3 s (one-regressor fit, mixed) |
| In-loop time per model check (per-tick join, HOLD ticks), median / p90 / max | 39.0 / 47.1 / 64.9 s | 25.1 / 33.9 / 41.7 s | 32.4 / 43.5 / 64.9 s |
| Model call (`callMs`), median / p90 / max | 18.8 / 22.5 / 26.4 s | 13.6 / 19.4 / 25.3 s | 16.1 / 21.4 / 26.4 s |
| Share of in-loop time waiting on the model (median) | **46.8 %** | 56.5 % | **51.1 %** |
| Pre-call phase (lock → prompt build), median / p90 / max | 13.5 / 17.5 / 22.1 s | 7.0 / 9.1 / 16.9 s | 9.9 / 15.4 / 22.1 s |
| Input / output tokens per check, mean | 16,869 / 1,592 | 14,230 / 1,204 | 15,464 / 1,385 |
| Model-calling battles one run can hold (on, cutoff 222 s) | **5–6** | 9 | — |

---

## 2. Part A — the September facts, re-verified

The September report's "Facts that constrain the spec", items 1–12, against `0b720acc`:

| # | Then (18 Sep) | Today | Evidence | Changed? |
|---|---|---|---|---|
| 1 | No per-battle wall time exists in any record. | Every model-path entry carries `tickMs` (lock → just before the final write), `buildMs`, `callMs`. Every run writes `agentEvalRuns/{runId}` with `wallMs`, `battlesTotal`, `modelCalls`, `budgetSkipped`, `deferred`, `lockSkipped`. Every admitted tick writes a permanent tick record whose `capturedAt` is stamped at the tick's last act. | `agent-evaluate.js:1018-1023` (admission instant), `:4495-4504`, `:4932-4933`; `:641-661` (run record), `:668-684`; `tickCapture/captureWriter.js:185`, `:202` — VERIFIED. 546 runs and 539 entries read — MEASURED | **Yes** |
| 2 | Everything expensive is per battle; the per-invocation state is three read memos. | Still per battle: the price fan-out, the parallel batch, the hot-bench rebuild and the news query all sit inside `processAgentBattle`. New per-run state: the release view (one forced read per run), the setup-menu read memo keyed on `summary`, and the dark intraday snapshot. The price store has not landed. | `:1191-1227`, `:1532-1540`, `:1595-1705`, `:2851`; `:488`; `setupMenuLabels/reads.js:63`, `:68`; `:496-500`; `featureFlags.js:2691` (`INTRADAY_PRICE_SOURCE = 'legacy'`) — VERIFIED | Partly (new per-run reads; none expensive) |
| 3 | The pre-loop work is per invocation, not per battle. | Same work: enumeration, expiry/completion, mastery sweep, GC repair, canonical-open sweep. Plus the release read (1.5 s, retried once). Plus the dark snapshot read. The settle run is now a separate entry that runs only the expiry sweep. | `:358`, `:364-402`, `:426-436`, `:447-452`, `:470-475`, `:488`, `:496-500`; `:301`, `:408-417` — VERIFIED | Partly |
| 4 | One cron slot is free (39 of an assumed 40); shape (a) is bounded at N = 2. | **45 entries, limit 100** ("100 on all plans … verified by the founder's reviewer 2026-09-18"). The evaluator is `*/15 13-21 * * 1-5` plus the settle run `0 2 * * 2-6`. | `vercel.json` (counted programmatically: 45); `docs/BUILD_RULES.md:78` — VERIFIED | **Yes** — (a) is no longer slot-bound |
| 5 | The handler accepts `Bearer CRON_SECRET`. The one fan-out precedent hit the apex 307 that strips `Authorization` and has no fetch timeout. | Unchanged. The precedent still POSTs with no signal. Two bounded-fetch precedents now exist: the intraday poller's fetch (10 s timeout, concurrency 4) and `eodhdDailyWindow.js` (`AbortSignal.timeout`). | `:290-294`; `tournamentOrchestrator.js:251-297`, `:312-318`, `:406`, `:478-482`; `intraday/intradayFetch.js:5-6`; `eodhdDailyWindow.js:42` — VERIFIED | No (new precedents) |
| 6 | The lock is per battle and stealable after 120 s; an invocation may live 290 s. | Unchanged. | `:241-242`, `:948-1005` (lock transaction, steal test `:960-963`) — VERIFIED | No |
| 7 | Four tournament battles share one whole-document ledger. | Unchanged. The ledger is read fresh per battle. The group document is memoized per run. | `tournamentAgentLedger.js:305-347` (`:314-318` memo, `:333` ledger read), `tx.set` at `:399`, `:407`, `:473`, `:497` — VERIFIED | No |
| 8 | EODHD ≈ 74 GETs per battle per tick, 68 in one unbounded `Promise.all`, none with a timeout. | **Higher.** In agent mode the price fan-out is about 41 symbols, so about 82 GETs in one unbounded `Promise.all`, plus 7 intraday requests: about **89 requests, about 117 billed units** per check. Still no timeout on any of them. See B4. | `:1191-1227`, `:1533`; `marketDataCache.js:357`, `:795`, `:871`, `:947-973` — VERIFIED; universe size MEASURED | **Yes** (count) |
| 9 | Anthropic: `maxRetries: 0`, a 429 becomes a HOLD tick, no recorded tier. | Unchanged; still one `messages.create` site. One limit event is on record: the Oct 8 "API usage limits reached" 400s. | `:265-269`, `:3215` (the only site — grep count 1); readiness report `20261110_COCKPIT_RELEASE_READINESS.md:89` — VERIFIED | No |
| 10 | `maxDuration` is already 300, the ceiling the repo records; more needs a platform setting the repo never mentions. | Unchanged: `maxDuration: 300`, budget 290 s. `vercel.json` sets no duration, memory or Fluid key. The only mention of Fluid lists it as unknown. **Correction to September §4(c):** an 800 s run does *not* overlap the next run (cadence 900 s) unless it starts more than 100 s late. | `:238`, `:242`; `vercel.json` (keys `framework`, `functions.includeFiles`, `headers`, `crons`); `docs/audits/2026-09-20_FANTASYTRADES_PERFORMANCE_LATENCY_COST_AUDIT.md:53` — VERIFIED | No (one correction) |
| 11 | The loop-level budget check reserves nothing for a battle's pre-call phase. | Unchanged: `elapsed > TIME_BUDGET_MS` at the top of each iteration. The agent-mode pre-call phase measures 13.5 s median, 22.1 s max. | `:522-536` — VERIFIED; pre-call MEASURED (B2) | No |
| 12 | The fair-rotation key advances only on model attempts, so never-triggering battles lead every tick. | Unchanged. | `:517-519` (sort), `:4829` (the only writer, gated on `haikuAttempted`) — VERIFIED | No |

**The model ceiling moved, as the prompt said.** `HAIKU_SDK_TIMEOUT_MS = 40_000` (`agentEvalTransport.js:21`). The call ceiling is +2 s (`:29-30`); the post-call allowance is 12 s (`:31`); the build ceiling is 10 s (`:52`). The admission test is `shouldStartHaikuCall` (`:196-207`), called once per check at `agent-evaluate.js:3067`. The calls reserve is 4 s at `on` (`callRecords/publish.js:60`, `:87-88`). So a call needs 10 + 42 + 12 + 4 = **68 s** left at `on` (64 s at `off`): it can start at elapsed ≤ **222 s** (226 s). All VERIFIED.

**The anchors the prompt listed, at `0b720acc`:** `findActiveAgentBattles(db)` `:358`; `ensureReleaseView(db, { force: true })` `:488`; sort `:517`; loop `:522`; budget break `:524`; deferred beat `:579-582` (`EVAL_DEFERRED_BEAT_ENABLED = false`, `featureFlags.js:2816`); `getStockAnalysisData(…, { forceRefresh: true, … })` `:1214`; `messages.create` `:3215`; `lastEvalStartedAt` writer `:4829`; `processAgentBattle` `:926`; `anthropicClient` `:245`; `EVALUATING_LOCK_TIMEOUT_MS` `:241`; `TICK_CAPTURE_ENABLED = true` `featureFlags.js:2755`; `AsyncLocalStorage` import `tickCapture/captureContext.js:29`, store `:46`, `scopeSeq` `:47`. All VERIFIED; all still within a few lines of the prompt's numbers.

---

## 3. Part B — measured (production, read-only)

### B1. Per run (`agentEvalRuns`, 546 runs, 21 sessions)

Every session has exactly 26 run records, so **no run was killed by the platform** (a killed run writes none — `:309-318`, VERIFIED).

| Field | median | p90 | max | mean |
|---|---|---|---|---|
| `battlesTotal` | 1 | 5 | 6 | 2.5 |
| `modelCalls` | 1 | 3 | 4 | 1.0 |
| `wallMs` | 37.5 s | 86.6 s | 163.9 s | 38.6 s |
| `budgetSkipped` | 0 | 0 | 0 | 0 |
| `deferred` | 0 | 0 | 0 | 0 |
| `lockSkipped` | 0 | 0 | 0 | 0 |

Runs with any deferred, budget-skipped or lock-skipped battle: **0, 0, 0**.

**The five largest runs** were all on 2026-10-23, 16:00–17:00 UTC, a League day: each had 6 battles and 6 evaluated, 3–4 triggered, 3–4 model calls, 0 budget-skipped, 0 deferred, 0 lock-skipped, and wall times of 163.9, 159.3, 145.8, 140.7 and 136.4 s.

**Wall time by model calls:** 0 calls: 210 runs, median 0.7 s. 1: 206 runs, 40.6 s. 2: 70 runs, 69.2 s. 3: 47 runs, 94.1 s. 4: 13 runs, 126.9 s (max 163.9 s).

**Seconds per model call: the readiness figure is confirmed on its own window, but it is a mix.**
- On the readiness window (Oct 27–Nov 9, 260 runs) the one-regressor fit reproduces exactly: **4.8 s + 34.6 s × calls, r = 0.941**. Confirmed.
- On the whole window: 8.7 s + 30.3 s × calls (r = 0.940). With the other evaluated battles as a second regressor: 6.2 s + 29.2 s × calls + 2.4 s × other battles.
- Those per-call slopes average two very different checks (B1b). For the game going forward (agent mode), use **about 39–42 s**.

### B1b. What each run held (MEASURED; tick records assigned to their run by time)

Every one of the 1,353 tick records falls inside a run. In all 546 runs the assigned model checks equal the run's own `modelCalls`, which validates the assignment.

- **Four-regressor fit (all runs, R² = 0.942):** wall = 2.7 s + **38.8 s × agent-mode model checks** + **25.2 s × League model checks** + 1.3 s × CPU-seat ticks + 10.5 s × human ticks without a model call.
- **Runs with no League check (335 runs, R² = 0.952):** wall = 1.4 s + **41.8 s × agent-mode model checks** − 0.3 s × CPU ticks + 12.2 s × human ticks without a model call.
- **Runs holding exactly one agent-mode model check and nothing else:** n = 124, median **42.5 s**, p90 50.6 s, max 60.6 s.
- **Human-only runs with no model call:** 18.5 s per human tick (n = 24, max 23.4 s). A no-trigger human tick still runs the whole pre-call phase.
- **No run in the window ever held two agent-mode model checks** (all 125 agent-mode runs held one). The agent-mode pace for more than one check per run is therefore an extrapolation from one-check runs. It is backed by the per-tick join in B2, which agrees (39.0 s median).

### B2. Per tick

**The evaluation entries.** An entry is written only on the triggered path, so a no-trigger or CPU tick has none (`:2960-3001`, `:1493-1515` — VERIFIED). The window has 539 entries, all model-calling. Entries without a model call (budget skip, refresh failure, build failure) would carry `tickMs` with null `callMs`; there are **none in the window**. Non-model ticks are therefore timed only at run level (B1b).

| Model-calling ticks | n | `tickMs` med / p90 / max | `buildMs` med / max | `callMs` med / p90 / max | `tickMs − buildMs − callMs` med / p90 / max | `callMs ÷ tickMs` (median) |
|---|---|---|---|---|---|---|
| all | 539 | 26.8 / 35.9 / 46.1 s | 0.0 / 1.7 s | 16.1 / 21.4 / 26.4 s | 9.8 / 15.7 / 22.1 s | 60.7 % |
| agent mode | 252 | 32.5 / 38.7 / 46.1 s | 0.0 / 1.7 s | 18.8 / 22.5 / 26.4 s | 13.6 / 17.5 / 22.1 s | 56.0 % |
| League | 287 | 21.5 / 27.6 / 34.1 s | 0.0 / 0.8 s | 13.6 / 19.4 / 25.3 s | 7.1 / 9.2 / 16.9 s | 64.9 % |

**What the remainder `tickMs − buildMs − callMs` contains, from the code.** `tickMs` starts at admission, right after the lock transaction (`:1018-1023`). It is restamped immediately before `battleRef.update(finalUpdate)` (`:4932-4933`). So the remainder is two parts. VERIFIED:
- **Pre-call (lock → prompt-build start):** migration and Huddle check-start (`:1125`), tournament context (`:1155`), the price fan-out (`:1211-1227`), the quote guard (`:1238-1251`), the parallel batch (intraday candles, rankings, technical scores, market context — `:1532-1540`), the hot-bench rebuild and its price fetches (`:1595-1705`), regime and the risk manager with its swaps, proposals and gameplan, the news query (`:2851`), catalysts (`:2860-2890`), the trigger gate, and the admission test (`:3067`).
- **Post-call, before the final write (`:3250` → `:4932`):** parsing and validation, guardrails, and on a model swap the reserve → `executeSwapServer` → confirm → receipt chain (`:4009-4272`). Then the record build, and two awaits that are dark today: the intraday view (`:4534`, `INTRADAY_DIAGNOSTIC_ENABLED = false`, `featureFlags.js:2668`) and the shadow capture (`:4895`, `SHADOW_ASSEMBLY_ENABLED = false`, `:1498`).
- There is **no await between the call's return and the entry's `timestamp`** (`:3250-3614`; grep of awaits in `:3250-4935` finds only the swap chain, the two dark awaits, the corrected-stock refresh `:4931` and the final write). So on a HOLD tick (512 of 539) the post-call part is synchronous CPU only, and **the remainder is the pre-call phase**.

**Where a model-calling tick's time goes (MEASURED).** Each entry was joined in memory to its tick record (same battle, same `evalId`); 539 of 539 joined.

| | pre-call (HOLD), med / p90 / max | call end → tick's last act ("tail"), med / p90 / max | after the final write (HOLD), med / p90 / max | **in-loop = `tickMs` + after-write (HOLD)**, med / p90 / max (mean) | `callMs ÷ in-loop` (median) |
|---|---|---|---|---|---|
| all | 9.9 / 15.4 / 22.1 s | 5.2 / 11.0 / 23.2 s | 5.0 / 10.6 / 22.3 s | 32.4 / 43.5 / 64.9 s (32.0) | **51.1 %** |
| agent mode | 13.5 / 17.5 / 22.1 s | 6.2 / 12.1 / 23.2 s | 6.1 / 11.9 / 22.3 s | **39.0 / 47.1 / 64.9 s (39.4)** | **46.8 %** |
| League | 7.0 / 9.1 / 16.9 s | 3.7 / 10.3 / 14.7 s | 3.6 / 10.2 / 14.2 s | 25.1 / 33.9 / 41.7 s (25.5) | 56.5 % |

- *Pre-call (HOLD)* is the build start (`promptBuiltAt − buildMs`) minus the admission instant (`timestamp − tickMs`). It is an estimate valid on HOLD ticks only, for the reason above.
- *After the write* runs from `timestamp` to the tick record's `capturedAt`. That is stamped when the capture is finalized, the last statement of the tick's `finally` (`captureWriter.js:185`, `:202`; `agent-evaluate.js:5076-5110`).
- It covers the final write's round trip, the calls phase (`:4940-4972`), narrations (`:4999-5020`) and anticipations (`:5038-5075`; Gemma, each ≤ 10 s). It is all outside `tickMs`.
- *In-loop* leaves out two small pieces: the lock transaction before admission, and the capture commit after `capturedAt` (`capture.preCommitMs` median 3 ms, max 15 ms).
- **The in-loop median (39.0 s agent, 25.1 s League) matches the run-level slopes (38.8 s, 25.2 s).** Two independent methods agree.

**What share of a model-calling tick is waiting on the model:** **about half** — 51 % of in-loop time overall (47 % agent mode, 57 % League), or 61 % of `tickMs`. **The other half is mostly not CPU either.** The pre-call phase is dominated by about 89 network requests to EODHD plus Firestore reads. The after-write phase is dominated by Gemma calls and Firestore writes. CPU time per tick is **not recorded** anywhere. ASSUMED: a small share. This is why the pool's gain is stated as ASSUMED close to K× below, not derived as a 2× bound.

**The tick records (1,353 in window):**
- Exit reasons: `cpu_passive` 650, `completed` 539, `gameplan_pending` 108, `no_trigger` 31, `gameplan_created` 25.
- 539 dispatched model calls: 531 ok, 8 `invalid_tool_result`, **0 timeouts** at the 40 s ceiling.
- Input tokens per call: median 15,227, p90 17,664, max 19,231. Agent mode: mean **16,869**, p90 17,996.
- Output tokens per call: median 1,341, p90 1,898, max 2,506. Agent mode: mean **1,592**, p90 2,019.
- Per non-CPU battle-day (30 battle-days): ticks median 26; model checks median 19.5, p90 22, max 26.
- **Universe per tick** (held ∪ bench ∪ hot-bench names, `universeSize`; `captureWriter.js:204`, `:262`; `agent-evaluate.js:1466`, `:2936-2940`): agent mode median **31**, p90 34, max 44; League median 22, p90 26, max 30; CPU seats median 6.

### B3. Work outside the loop

| Work | Bound in the code | Evidence |
|---|---|---|
| Enumeration (`status == 'active'`, no limit) | none — one query | `:358`; `agentBattleService.js:49-56` (fenced; read only) — VERIFIED |
| Expiry and completion loop | none; one `completeBattle` transaction per expired battle, sequential | `:364-402`, `:7055` — VERIFIED |
| Mastery repair sweep | one page of 25, no timeout; cursor read then `set` | `:426-436`; `masterySettlement.js:673-714` — VERIFIED |
| GC repair | `limit 25`, 96 h window, no timeout | `:447-452`, `:7439-7455` — VERIFIED |
| Canonical-open sweep | **15 s** timeout | `:470-475`; `canonicalOpenSweep.js:212`, `:238-241` — VERIFIED |
| Release read | **1.5 s** per attempt, one retry on a forced read → **≤ 3.0 s** | `:488`; `callRecords/release.js:77`, `:238`, `:252-255` — VERIFIED |
| Intraday snapshot read | **2 s**, dark (`INTRADAY_DIAGNOSTIC_ENABLED = false`) | `:496-500`; `intraday/evaluatorHook.js:16`, `:29` — VERIFIED |
| Deferred beats | 2 s each, in parallel, need 5 s of the hard ceiling left; dark | `:618`, `:626`, `:701-726` — VERIFIED |
| Run-record write | **2 s**; issued after `wallMs` is taken, so outside it | `:618`, `:668-684` — VERIFIED |

**Measured:** the 138 runs with zero active battles do everything above up to the canonical-open sweep, then return before the release read (`:477-479`). Their wall time is median **0.6 s**, p90 0.8 s, max 1.7 s. The fit intercepts (1.4–2.7 s) add the release read and loop entry. With today's volume the pre-loop costs about **1–3 s a run**. The worst case allowed by the code's own bounds is 15 s (canonical-open) + 3 s (release) + the unbounded queries and completions. Logs were not readable, so no larger estimate is made.

### B4. EODHD per tick today

Re-derived from the code (VERIFIED), with the symbol count MEASURED:

| Call | Where | Requests | Billed units |
|---|---|---|---|
| Price fan-out: one `getStockAnalysisData(sym, { forceRefresh: true, fields: ['daily','price'] })` per symbol, all in **one unbounded `Promise.all`** | `:1211-1227`; symbols `:1191-1203` | 2 per symbol: one `/eod/` (`marketDataCache.js:622-640` → `:357`; `forceRefresh` skips the cache) + one `/real-time/` (`:684-686` → `:795`) | 2 per symbol |
| Intraday 5m candles for held symbols | `:1533` → `fetchIntradayBatch` (`marketDataCache.js:947-973`, 5 concurrent, 200 ms gaps) | 1 per held symbol | 5 per request (census G1) |
| Conditional: hot-bench rebuild prices (`:1695-1705`, `Promise.allSettled`, new names only), catalysts (≤ 5, sequential, `:2865-2890`), proposal prices (2, `:5288-5296`), cascade qualification (`:857-890`), Guard 3 per swap | — | occasional | occasional |

**Symbols per agent-mode check:** the measured universe (median 31) + the CPU opponent's book (7) + SPY, QQQ, BTC-USD.CC (3) ≤ **41**. So:
- **≤ 82 concurrent GETs in one `Promise.all`;**
- **+ 7 intraday requests (35 units);**
- **≈ 89 requests and ≈ 117 units per agent-mode check.** It is an upper bound: overlap of the CPU book and macros with the universe is ASSUMED zero.
- League: 22 + 3 = 25 symbols → 50 GETs + 6 intraday → 56 requests, 80 units.
- CPU seat: 6 + 3 → 18 (it exits before the intraday batch, `:1493` < `:1533`).

**No timeout on any of them:** `marketDataCache.js:357`, `:384`, `:454`, `:477`, `:505`, `:795`, `:871` are all bare `fetch(url)`. VERIFIED.

**Which number is current.** September's "≈ 74 GETs, 68 in one `Promise.all`" counted requests for an assumed 34 symbols. The census (`docs/audits/20261007_EODHD_CALL_CENSUS.md:337-350`) counts units: 2 × 36 + 5 × 7 = **107** for a BaggerBomb battle, with hot-bench = 15 and bench = 4 (7 + 4 + 15 = 26 universe). Its formula is right and is the current method. **Its universe is low:** production measures 31 (p90 34, max 44), because equipped names are unioned into the hot-bench (`:1637-1650`). This report's **117 units / 89 requests** is current. Use units against the daily cap and requests for burst.

---

## 4. Part C — the fourth shape: a bounded pool inside one invocation

**The shape.** Keep one invocation and its pre-loop work. After the sort (`:517`), run `processAgentBattle` for up to K battles at once, each in its own capture scope, and start the next as one finishes, until the dispatcher says stop.

**Method.**
- A delegated census followed every static and literal dynamic import from `agent-evaluate.js` transitively (255 modules) and listed every module-level mutable item.
- I re-read every item that bears on the verdicts at its line, plus the two tick-capture modules and the isolation test, myself.
- The census's claim that "no test covers overlapping scopes" is **refuted**: `agent-evaluate.tickCapture.isolation.test.js:300-358` runs tick B to completion *inside* tick A's open window and asserts each keeps its own context and body.

| # | Item | Verdict | Evidence | Smallest change to make it safe |
|---|---|---|---|---|
| 1 | **Module-level mutable state**, the evaluator and every reachable module | **Safe** (one condition) | `anthropicClient` `:245-272`: the check-and-set is synchronous, so one client is built, and it holds only a stateless observing fetch. The release cache `callRecords/release.js:160-166`, `:231-275`: one process-wide document, single-flight for non-forced callers, a sequence guard against stale overwrites. `serverCache.js:15` `memoryCache`: key-addressed; the tick's paths only write it (`forceRefresh`). `callRecords/flip.js:199`: a deployment-fact memo; the only effect is cosmetic. Lazy singletons in `firebaseAdmin.js:9-10` and `shadowLogger.js:20`. No rate limiter or token bucket exists anywhere in the closure. **No item is UNSAFE.** VERIFIED (the census scanned all 255; the rows here re-read) | Keep **one capture scope per battle**: `runInTickCaptureScope(newTickCaptureScope(), …)` as at `:547-548`, with the per-battle catch at `:549-576`. One scope around the whole batch would make the checks share `scope.ctx` and `scope.holder` (UNSAFE). |
| 2 | **`summary`** | **Safe** | Every in-tick mutation is one synchronous statement taken after its await has resolved: `:931-932`, `:1012-1013`, `:1242`, `:3010`, `:3097`, `:3238` (in a `finally`, after the call), `:4934`, `:5112-5115`, `:5249-5251`. No read-modify-write spans an await (grep of every `summary.` write). One shared effect: `summary` is the key of the setup-menu run memo (`setupMenuLabels/reads.js:63`, `:68`). K checks share one run budget of 5 concurrent and 240 label reads (`setupMenuLabels/constants.js:39`, `:44`), so more `read_unsettled` capture rows. Capture-only, never a decision. VERIFIED | None needed. Optionally, a per-check share of the label-read budget. |
| 3 | **Per-invocation memos** | **Safe** | `tournamentGroupCache`: check → await `getGroup` → set (`tournamentAgentLedger.js:314-318`). A concurrent miss costs one duplicate group read and stores the same value; there is no write. The mastery group and sibling memos are used only before the loop (`:352-353`, `:371`, `:427-432`, `:448`) and are not passed into `processAgentBattle` (signature `:926`). VERIFIED | Optional: memoize the promise, not the value, to drop the duplicate read. |
| 4 | **Tick capture** | **Safe** | The scope is an `AsyncLocalStorage` (`captureContext.js:29`, `:46`). A scope object holds both the capture context and the body holder (`:49`). `beginBodyCapture` writes the holder onto the calling chain's scope (`captureBodyObserver.js:42-52`). `endBodyCapture` closes only its own and refuses another's (`:59-66`). The observing fetch reads `currentCaptureScope()?.holder` once at call time (`:82-84`). The comment at `:31-37` records the replaced single global. `scopeSeq` (`:47`) is a synchronous counter whose value nothing reads. Tested for overlap: `isolation.test.js:300-358`. **Two scopes in flight cannot swap bodies.** VERIFIED | None. Two comments still say "battles are processed serially": `captureBodyObserver.js:25-29` and `agent-evaluate.js:521`. Stale under a pool; fix them in the build. |
| 5 | **The model call under K** | **Safe per check; the dispatcher needs a stop rule (item 6)** | `maxRetries: 0` (`:267`) and one `messages.create` (`:3215`). Admission is per check, on the shared handler clock (`:3067`): a call starts only if ≥ 68 s remain, so **latest start 222 s** at `on`. Worst case: build 10 s + call 42 s puts the final write at **≤ 274 s** on a HOLD (no await between the call's return and the write). The measured tail after the call is p90 11.0 s, max 23.2 s, so a worst-case HOLD finishes its narrations, anticipations and capture by about **297 s**, under the 300 s kill. Anticipations are skipped below 12 s remaining (`:5038-5040`). The calls phase protects a 12 s tail (`publish.js:62`; `:5896`). The 12 s post-call allowance assumes one check in flight (`agentEvalTransport.js:24-28`). **How the tail stretches with K checks finishing at once is not measured.** VERIFIED (code) / MEASURED (tail) | Keep the per-check admission as is. Measure the tail under K in the build's first runs (the script's tail column). |
| 6 | **The deferred set and the budget break** | **Needs a change** | Today "deferred" is the tail of the list once `elapsed > 290 s` at the top of an iteration (`:522-536`), and nothing is reserved for a battle's own pre-call phase (Part A, fact 11). Under a pool, up to K battles can be started at 289 s. Each would run its pre-call (agent mode up to 22.1 s measured), take a fallback HOLD and issue its write after 300 s, so it is killed with its lock held. VERIFIED | (i) **"Deferred" = never dispatched.** The dispatcher, not the loop, sets `evalRun.deferredBattleIds` and `deferredAt`; in-flight battles are not deferred. (ii) **A start cutoff for new dispatches** well before 290 s: a model-calling battle cannot be admitted after 222 s anyway, and its pre-call takes up to about 22 s, so stop starting new battles at about 200 s (to be tuned from data). (iii) Add `poolK`, `maxInFlight` and `startCutoffMs` to the run record (`composeEvalRunRecord`, `:641-661`). The deferred beat (`:701-726`) needs nothing new. |
| 7 | **The fair-rotation key and the sort** | **Safe** | Sorted once per run (`:517-519`); the pool dispatches in sort order, so the first K start together. The key is written in each battle's own final update (`:4829`), read only at the next run's sort. September R1 persists: never-triggering battles still lead. VERIFIED | None (R1 stays a separate item). |
| 8 | **The `finally` block** (narrations, anticipations, the budget gate) | **Safe** | Narrations always fire (`:4999-5020`). The anticipation gate reads the shared handler clock (`TIME_BUDGET_MS − (now − cronStartTime) > 12 s`, `:5038-5040`), which protects the invocation's end whatever K is. The capture finalizes on its own scope with the shared remaining budget (`:5104-5106`). Concurrent `finally` blocks touch only their own battle. VERIFIED | None. |
| 9 | **The per-battle lock** | **Safe** | Inside one invocation each battle is dispatched once from one list, so two workers never hold the same battle. Across invocations nothing changes: the lock is stolen only after 120 s (`:241`, `:960-963`), measured in-loop time is ≤ 64.9 s, and the next run starts 900 s later. The lock transaction re-reads the document (`:948-1005`). VERIFIED | None. |
| 10 | **EODHD burst** | **Needs a change** | K × ≤ 82 concurrent GETs at the start of a run (K = 8: about 656 at once), plus 5K intraday requests, with **no timeout** (`marketDataCache.js:357`, `:795`, `:871`) and no process-wide limiter (item 1). A stalled GET holds its battle's `Promise.all` (`:1211`): that one worker's battle never reaches its write until the platform kill, and its lock sits until stolen. The pool is *more* robust than today's loop, where one stall holds every later battle, but it now loses K − 1 battles' worth of nothing and one battle's whole check. VERIFIED | A per-request timeout in `marketDataCache.js`'s EODHD fetches (precedent: `intraday/intradayFetch.js:5-6`, 10 s; `eodhdDailyWindow.js:42`). A process-wide concurrency cap on EODHD requests shared by all workers. Both are outside the fence. |
| 11 | **Firestore contention** | **Safe, except League (needs a change)** | **Ledger:** today a group-mate's swap is confirmed before the next battle reads the ledger. The code states that assumption (`tournamentAgentLedger.js:300-303`). Under a pool, group-mates in flight filter on a stale `heldByOthers` (read once, `:333`, `:345`); only the reserve transaction (`:364-407`) protects exclusivity, so expect more lost reservations (correct, but more HOLD downgrades). League is hidden for the beta under BB-1 (ASSUMED from the prompt). **Mastery cursor:** before the loop, one owner, unchanged. **Release view:** read once per run, cached per process, read-only. **New since September:** fire-and-forget rewrites of `marketDataCache/{SYM}_daily` (`marketDataCache.js:657-660`), now K-way concurrent on SPY/QQQ/BTC. Identical payloads, last write wins; Firestore's per-document burst tolerance is ASSUMED adequate. Call records, ticks and tick bodies are per-battle subcollections. VERIFIED | **Group affinity:** never two battles of one League group in flight (deal by `groupId ?? battle.id`). Nothing else. |
| 12 | **Memory** | **Safe** (ASSUMED) | No memory setting exists: `vercel.json`'s `functions` block holds only `includeFiles`, so the function runs at the platform default (ASSUMED; the default depends on plan and project settings the repo does not record). Per check in memory: the battle document (`evaluations` ≤ 150, `:4798`; `statusFeed` ≤ 100, `:1171`), daily bars for ≤ 41 symbols, a prompt of about 17k tokens (about 70 KB), a response, and a capture body document ≤ 700 KB (`tickCapture/captureConfig.js:112`). All active battles' full documents are already held at once today (`:358`). Estimate: a few MB per check, tens of MB at K = 8 (ASSUMED; not measured). | None expected; confirm the memory setting (founder question 3). |
| 13 | **Log readers** | **Safe** | No script or reader parses `[AgentEval]` lines. The only other hits are log prefixes in `agentEvalPromptAssembly.js` and `evalIdentityBlocks.js`, and a printed hint in `scripts/measure-eval-request-tokens.mjs:363` (grep over `scripts/`, `api/`, `src/`). Under a pool, one battle's lines interleave with others'; most lines carry the battle id. VERIFIED | None; humans reading logs should filter by battle id. |
| 14 | **Tests that assume sequential order** (listed, not changed) | — | 51 files `api/cron/agent-evaluate.*.test.js`. These pin loop order or one-at-a-time processing: `agent-evaluate.evalRun.test.js` (`:307` deferred = total − N in loop order; `:339` deferred list in rotation order; `:526`, `:541` beats to the first 25 in loop order; `:624`); `agent-evaluate.tickCapture.handler.test.js` (`:201` two battles in one invocation, each with its own record); `agent-evaluate.timing.test.js` (`:389` "the loop proceeds: the next battle takes its own tick"). These already exercise overlap: `agent-evaluate.tickCapture.isolation.test.js:300-358` and `agent-evaluate.handler.test.js:192` ("degraded battle does not block a concurrent valid battle"). VERIFIED | A pool build adds rows for K > 1 and keeps the K = 1 rows as the byte-for-byte proof of today's behaviour. |

**In sum:** nothing in the process prevents K checks in flight. The changes are all at the edges: the dispatcher (6), EODHD (10) and League scheduling (11). None is in a fenced file.

---

## 5. Part D — four shapes, priced with today's numbers

**The pace used (MEASURED, agent mode, the game going forward):**
- T = **38.8 s** per model-calling battle (41.8 s in League-free runs);
- pre-call p = **13.5 s** before the admission test;
- pre-loop a = **2.7 s**;
- cutoff C = **222 s** at `on` (226 s at `off`).

A lane is one sequential stream of battles. It admits 1 + ⌊(C − a − p) / T⌋ model-calling battles:
- 1 + ⌊205.8 / 38.8⌋ = **6**;
- 1 + ⌊205.8 / 41.8⌋ = **5**;
- at the slow end (T = 47.1 s, p = 17.5 s): 1 + ⌊201.8 / 47.1⌋ = **5**.

**So one lane holds 5–6 agent-mode model-calling battles** (League: 1 + ⌊212.3 / 25.2⌋ = 9). With a realistic mix (about 21 of 26 ticks call the model; a non-model human tick costs about 11 s, B1b), a lane reaches about 7 battles.

**Does a check slow down when K run at once?** Not measured: the window never had two agent-mode checks in one run. The table assumes no slowdown (s = 1, ASSUMED). If every check ran 1.5× slower under contention (an illustration, ASSUMED), a lane would hold 1 + ⌊(222 − 2.7 − 20.3) / 58.2⌋ = **4**.

| | K or N = 1 (today) | 3 | 5 | 8 | Arithmetic |
|---|---|---|---|---|---|
| **(a) N cron entries** (shard by `hash(groupId ?? battle.id) mod N`) | 5–6 | 15–18 | 25–30 | 40–48 | N lanes, each its own invocation, budget and pre-loop |
| **(b) HTTPS fan-out** (outer deals battles round-robin after the sort to N slice invocations) | 5–6 | 15–18 | 25–30 | 40–48 | N lanes; each slice budgets from its own start (`cronStartTime`, `:926`); one extra HTTPS hop per slice (ASSUMED ≤ 1 s) |
| **(c) higher ceiling only** | 5–6 at 300 s | — | — | — | At 800 s (Fluid Compute, ASSUMED available on the plan): budget 790 s, cutoff 722 s → 1 + ⌊(722 − 16.2) / 38.8⌋ = **19** (17 at 41.8 s). One lane, later checks. |
| **(d) bounded pool, K in one invocation** | 5–6 | 15–18 (12 at 1.5×) | 25–30 (20) | 40–48 (32) | K lanes in one process |
| **(b)+(d)** N slices × K = 3 each | 15–18 | 45–54 | 75–90 | 120–144 | N × K lanes |

### The price list, per shape

| | (a) N cron entries | (b) HTTPS fan-out | (c) higher ceiling | (d) pool | (b)+(d) |
|---|---|---|---|---|---|
| **Cron slots** (45 of 100 today; limit 100, `BUILD_RULES.md:78`) | 44 + N: 47 / 49 / 52 at N = 3 / 5 / 8 | 45 (unchanged) | 45 | 45 | 45 |
| **Files touched** | `vercel.json`; `agent-evaluate.js` handler (`:288-603`: shard parse and filter, pre-loop gating); a pure shard helper and its test; handler tests | `agent-evaluate.js` handler (outer/inner branch; the inner skips pre-loop, takes ids); base-URL resolution reused from `tournamentOrchestrator.js:251-297` (import, no edit); a timed fetch; tests | `agent-evaluate.js:238`, `:242`; the pin `agent-evaluate.tickStamps.flagOn.test.js:123` mirrors `290_000` (VERIFIED); the Vercel project setting | `agent-evaluate.js:505-582` (the loop becomes a dispatcher); `composeEvalRunRecord` `:641-661`; `marketDataCache.js` (timeout, shared limiter); a pure pool helper and its tests; two stale comments | (b) + (d) |
| **Fence contact** (§1 list `BUILD_RULES.md:14-24`) | None, if the key is computed in the handler. Storing a shard field touches the fenced `createAgentBattle` shape; changing the query touches the fenced `agentBattleService.js:49-56`. | None | None in the repo. `agentEvalTransport.js` is **still not on the §1 list**, while the handler comment at `:235` still calls it "the fenced pre-call guard" (September R6, unresolved). Treat a ceiling edit there as founder-gated (ASSUMED). | None. `processAgentBattle` and every fenced callee (`agentSwapExecution.js`, `agentRiskManager.js`, `agentScoring.js` …) are called unchanged; the census found no module state in them. | None |
| **Pre-loop work: owner, runs per tick** | Each invocation, N× per tick, unless gated to shard 0. Completions are transactional (the loser counts `completionSkipped`, `:393`). The mastery cursor has N racers (`masterySettlement.js:674-714`). The release read and canonical-open sweep run N× each. | The outer, once. Inner slices skip it, but each inner needs its own release view (per process; forced once per run, `:488`). | Once | **Once** (unchanged) | The outer, once |
| **Failure shape: one slow or killed battle** | A slow battle delays only its shard's tail. A killed shard loses its in-flight battle's write and defers its tail with no entry. Hash assignment fixes a battle's shard for life, so the same battles sit in a slow shard every tick. | A killed slice behaves like a killed shard, but round-robin after the sort keeps fairness global. The outer sees a 504 or timeout and cannot tell which battles were reached. If the outer keeps 300 s it may die first and lose its own record (ASSUMED: Vercel does not cancel the callee). | As today, in one lane: one stalled EODHD GET holds every later battle. At 800 s the tail is evaluated up to about 12 minutes after its slot. | A stalled battle occupies one of K lanes. The others go on. That battle loses its write at the kill (until EODHD fetches get a timeout, Part C item 10). | As (b), per slice; as (d), inside a slice |
| **What the board shows** | Late (`lastScoredAt` not advanced) for deferred battles in an overfull shard; degraded checks (`eval_degraded` beat) for budget-skipped ones | Same, spread evenly | Late posture for tail battles while the Desk's "next check" reads as due (September §4c) | Same states as today, rarer | Same |
| **Fluid Compute** | Not required | Not required; with Fluid, slices may share a process. That is safe by Part C item 1. | **Required** (300 s is the classic ceiling; 800 s with Fluid — ASSUMED platform limits) | Not required; the pool is concurrency inside one invocation either way | Not required |

**Pre-loop under (a), in numbers:** 2.7 s × N of duplicated reads per tick, plus N transactions per expired battle. Cheap at today's volume. The cursor race wastes mastery-sweep pages but corrupts nothing (stamps-only, idempotent).

---

## 6. Part E — the walls after the evaluator

### E1. Anthropic

**Other model callers on the evaluator's minutes** (`*/15 13-21` UTC weekdays). Schedules are from `vercel.json`; the call paths and models were VERIFIED at the lines shown.

| Caller | Schedule | Model | Path |
|---|---|---|---|
| FantasyTimes `generate-econ?mode=recap` | `:00`, `:30` of 13–21 | via `wireModelCall` | `fantasyTimesPrompts.js:17`, `:26`, `:35`, `:44` Haiku 4.5; `:53`, `:62` Sonnet 4.6 (which prompt kind uses which is ASSUMED) |
| `generate-pulse` | `:30` of 13–14; `:00` of 16–17; `:15` of 20–21 | same | same |
| `generate-recap` | `:00` of 13, 20–23 | same | same |
| `scan-movers` → `generate-mover` | `*/15` 13–20 | same, per detected mover | `generate-mover.js` → `wireModelCall` |
| `mandate-evaluate` | `*/15` 14–22 | Haiku 4.5, per book | `mandateGenerationConfig.js:27`; `MANDATE_EVAL_ENABLED = true` (`featureFlags.js:1945`) |
| `process-pending-reflections` | `*/15` 13–01 | Sonnet 4.6 (ASSUMED: `reflectionOutcome.js:20` is the reflection model), per pending reflection | `reflect.js`, `reflectionOutcome.js` |
| `tournament-orchestrator` → `decide.js` deploys | `*/10` of 11–14, 21–23 | Sonnet 4.6 (`decide.js:443`), Haiku 4.5 (`:568`, `:605`) | League; hidden for the beta (BB-1) |
| **`huddle-worker`** (new since September) | `*/2` 12–21 | Sonnet 5.5 | `huddle/scriptPrompt.js:42`; `DRB_HUDDLE_ENABLED = true` (`huddleFlags.js:47`), cohort-gated (`huddle/gate.js:28`) |
| `poll-batch` | `*/15` | batch retrieve only, no generation | September §6 |
| *Not Anthropic:* voice-layer narrations and anticipations, chat | — | Gemma | `chat.js` (14 Gemma references); voice-layer modules hold only Gemma timers (census) |

**The evaluator's own rates while a run is active** (MEASURED tokens, agent mode: mean 16,869 in, 1,592 out; one lane makes 60 / 38.8 = 1.55 calls a minute):

| K (lanes) | requests / min | input tokens / min | output tokens / min |
|---|---|---|---|
| 1 | 1.5 | 26,086 | 2,462 |
| 3 | 4.6 | 78,258 | 7,386 |
| 5 | 7.7 | 130,430 | 12,309 |
| 8 | 12.4 | 208,689 | 19,695 |

These are rates during the run's active minutes (model calls start from about 16 s to 222 s into each 15-minute slot), not 15-minute averages. No `cache_control` is used, so every input token counts (readiness report §A1; VERIFIED there).

**The organisation's rate limits are not recorded anywhere.**
- No `anthropic-ratelimit` string exists in `api/`, `src/`, `scripts/` or `docs/`.
- The capture keeps entity bodies and the status code but never reads headers (`captureBodyObserver.js:13`, `:89`; status at `:109`).
- The one recorded limit event is the Oct 8 "API usage limits reached" 400s, both arms (readiness `:89`).
- → Founder question 2.

### E2. EODHD

**Inputs.**
- Evaluator: **117 units** per agent-mode check (B4). Every admitted tick pays it, model or not: the fan-out precedes the trigger gate. So **3,042 units per battle-day** (26 ticks).
- **Poller (MEASURED, `intradayBudget/{etDate}`):** 20,496–20,556 units on days with no battle (Nov 3–6, Nov 11). 25,133 on Nov 12, a one-battle day: about **+4,600 for one agent-mode battle** (its held and bench symbols, polled every minute). 32,414 on Oct 23 with 6 battles. Median 25,133; max 32,414 over the window. The poller's per-battle cost falls with symbol overlap and is capped near the census's modelled 105,600 at the full 239-name universe (`20261007_EODHD_CALL_CENSUS.md:532-538`; ASSUMED).
- **Other fixed consumers** (census model, not measured): about **10,240** a day. That is index intelligence 4,089, rankings 2,502, scan-movers 1,728, mandate 816, keep-warm 648 and FantasyTimes about 457 (`:271`, `:443-449`).
- Per battle: voice-layer about 290 and deploy 44 (`:459`, `:461`).
- Browser polling (about 1,464 per screen-hour, `:468`) is excluded below: it depends on viewing.
- **Daily cap: 100,000 (ASSUMED in the census; the performance audit cites a public plan of 100,000 a day and 1,000 a minute, "not applied to this commercial game"** — `2026-09-20_FANTASYTRADES_PERFORMANCE_LATENCY_COST_AUDIT.md:338`).

**Headroom after the fixed side:** 100,000 − 20,496 (poller base) − 10,240 = **69,264 units** a day.

**Evaluator units a day at full capacity** (every lane full of agent-mode battles, 26 ticks each): K = 1: 15,210–18,252 · K = 3: 45,630–54,756 · K = 5: 76,050–91,260 · K = 8: 121,680–146,016.

**Where EODHD becomes the wall.** One agent-mode battle-day costs:
- evaluator 3,042;
- poller +2,300 (with overlap) to +4,637 (measured, no overlap);
- voice-layer and deploy 334.

That is about **5,700–8,000 units**. 69,264 ÷ that = **8.6–12.2 concurrent full-day battles** (7.3–9.7 if each battle is also watched for one hour). At about 21 model checks a battle-day, that is **about 150–250 model checks a day**.

**Today's evaluator at K = 1 holds about 5–7 battles a run**, so the two walls sit at about the same place today. **For any K or N ≥ 2, EODHD binds first, in every shape.** The pool does not change EODHD per check; it changes how many battles are reached.

**Per minute.**
- One lane makes 89 requests per 38.8 s: about **138 requests a minute**. K = 3: 413 · K = 5: 688 · K = 8: 1,101.
- On top: the poller (about 60 a minute, plus the 255-name universe every 5th minute), `compute-index-intelligence` at `:00` of 14–20 (about 511 in that minute), scan-movers (54) and voice-layer.
- Against the public plan's 1,000 a minute (ASSUMED, not this game's contract), **K = 8 crosses it alone, and K = 5 crosses it on `:00` minutes.**
- At the start of a run the first K fan-outs are simultaneous: up to K × 82 concurrent GETs.
- Whether the per-minute limit counts requests or units is unknown → founder question 4.

### E3. The BaggerBomb revamp (BB-3, BB-7, BB-15 — proposed; quoted in the prompt)

**(i) What a battle the loop never reaches gets.**
- **A deferred battle gets nothing**: no lock, no price, no score write, no risk manager, no stop, no tick record (`:522-536`, the break precedes `processAgentBattle`). It gets one dark feed beat if `EVAL_DEFERRED_BEAT_ENABLED` is ever lit (`:701-726`). VERIFIED.
- **A budget-skipped battle gets everything except the model call.** The admission test (`:3067`) comes after the price fan-out (`:1211`), the score write path, the risk manager and its forced exits, proposals, gameplan and the trigger gate. VERIFIED.
- **A dormant battle** (before its first trading day) gets nothing by design (`:926-934`).
- **Under BB-7, "deferred" = a stop or target not executed that slot**, and the first observed price after the cross is not observed by the evaluator at all.

**(ii) Where a code-only pass would sit, and what it costs.** It must not depend on the loop reaching the battle. So it sits **between the sort (`:517`) and the model loop (`:522`)**, as a pass over *every* active battle: prices → scoring → stop and target checks, no model. Or it runs as each pool worker's first, unconditional phase. Two variants:

| | Variant A — today's fetch path | Variant B — read the poller's snapshot |
|---|---|---|
| Prices from | a per-battle `getStockAnalysisData` fan-out | `intradaySnapshots/latest`: `{ sweepAt, symbols: { [sym]: facts } }`, refreshed every minute for held ∪ bench across active battles, every 5th minute for the 255-name universe (`intraday/intradayStore.js:7-8`; census Q-05) |
| Time per battle per tick | MEASURED proxy: the CPU-seat tick (price fan-out for its book + score write, no model) costs **1.3 s** (B1b fit). A human battle's book plus the CPU opponent and macros is about 17 symbols, so ASSUMED about 1–2 s, parallelizable | one shared Firestore read per run (≤ 2 s bound, `evaluatorHook.js:16`), then a per-battle score and stop write (ASSUMED about 0.1–0.3 s) |
| EODHD per battle per tick | about 34 GETs (17 symbols × 2) if it fetches only the book, CPU opponent and macros; +35 units if VWAP needs intraday candles | **0 extra**: the poller already pays (MEASURED 20.5k–32.4k a day) |
| What "first observed price" means | the `/real-time/` quote at the check | a **delayed** quote: the poller reads `/us-quote-delayed` (`intraday/intradayFetch.js:49`); the delay is not recorded in the repo (ASSUMED vendor-delayed). This changes BB-7's fill price → founder question 5. |
| Readiness | live code paths | the reader exists but is dark (`INTRADAY_DIAGNOSTIC_ENABLED = false`, `featureFlags.js:2668`; `INTRADAY_PRICE_SOURCE = 'legacy'`, `:2691`) |

**(iii) Capacity with every player in a battle every session** (one agent per player, ASSUMED. Under BB-15 an Agent-vs-Agent pair is still two agents, each with its own check. Agent-mode pace. 21 model checks per battle-day, as the prompt sets.)

| Players | Model checks per session | Model calls per run | Lanes needed (K or N) | Evaluator EODHD units / day | **All-server EODHD units / day** (cap 100k, ASSUMED) | Anthropic while a run is active (req/min · input tok/min) | First wall, by shape |
|---|---|---|---|---|---|---|---|
| 10 | 210 | ≈ 8 | 2 | 30,420 | **87,700–110,900** | 3.1 · 52k | **EODHD (at or over the cap) ≈ evaluator at K = 1.** (d) K = 2, (a) N = 2 (46 slots), (b) N = 2, (c) one 800 s lane holds it with up to ~6-minute-late checks |
| 25 | 525 | ≈ 20 | 5 | 76,050 | **173,100–200,200** (1.7–2.0×) | 7.7 · 130k | **EODHD** for every shape. Then the evaluator: (d) K = 5, (a) N = 5 (49 slots), (b) N = 5; (c) cannot (17–19 per run) |
| 50 | 1,050 | ≈ 40 | 9–10 | 152,100 | **≈ 284,600** (2.8×) | 13.9–15.5 · 235k–261k | **EODHD.** Then the evaluator: (d) K = 9–10 in one process (CPU and memory unmeasured), or (b)+(d) 3 × 3–4; Anthropic unknown |
| 100 | 2,100 | ≈ 81 | 17–20 | 304,200 | **≈ 453,400** (4.5×) | 26.3–30.9 · 443k–522k | **EODHD.** Then Anthropic (unknown limits) and the evaluator: (b)+(d) e.g. 4 × 5, or (a) N = 17–20 (61–64 slots) |

The all-server column is the evaluator (26 × players × 117), the poller (measured base + 2,319–4,637 per battle, capped at 105,600 — ASSUMED), plus 10,240 fixed and 334 per battle. Browser viewing is excluded. Lanes are ⌈players ÷ 6⌉ to ⌈players ÷ 5⌉.

---

## 7. Facts that constrain the build

1. **Agent-mode pace is 38.8–41.8 s per model-calling battle**, measured two ways: the run-level four-regressor fit, and the per-tick join (median 39.0 s). League is 25 s. The 30–35 s figures in the readiness report and the full-window fit are a League-heavy mix. Evidence: B1, B1b, B2.
2. **One lane holds 5–6 agent-mode model-calling battles** at `on` (cutoff 222 s = 290 − 68), not 6–7. Evidence: Part D arithmetic, `agentEvalTransport.js:21-52`, `:196-207`.
3. **About half a model-calling check is waiting on the model (47 % agent mode).** The rest is mostly other network waiting: EODHD and Firestore before the call (13.5 s), Gemma and Firestore after the write (6.1 s). CPU per tick is not recorded. Evidence: B2.
4. **No run has ever held two agent-mode checks**, deferred a battle or budget-skipped one (546 runs, 21 sessions, none killed). The K > 1 slowdown is unmeasured. Evidence: B1, B1b.
5. **`tickMs` excludes the after-write work** (about 6 s in agent mode: the calls phase, narrations, anticipations). Wall-time budgeting must use the run-level numbers or `tickMs` + after-write, not `tickMs` alone. Evidence: `:4932-4933`, `:4940-5110`; B2.
6. **The pool needs no change inside `processAgentBattle` or any fenced file.** Module state is safe as long as each check keeps its own capture scope, and overlap is already tested. Evidence: Part C items 1–4; `isolation.test.js:300-358`.
7. **The pool needs a dispatcher**: a start cutoff for new battles (pre-call up to 22 s measured, admission closes at 222 s), deferral defined as never-dispatched, and `poolK` and `maxInFlight` on the run record. Evidence: Part C items 5–6; `:522-536`, `:641-661`.
8. **EODHD fetches have no timeout and no shared limiter**, and a check fans out ≤ 82 GETs in one `Promise.all`. K workers multiply the burst. Evidence: B4; `marketDataCache.js:357`, `:795`, `:871`.
9. **EODHD is the first wall for any K or N ≥ 2**: about 117 units per agent-mode check, every tick, about 7–12 concurrent battles against an assumed 100,000 a day. Per minute, K = 5–8 meets the public plan's 1,000 a minute (ASSUMED limits). Evidence: B4, E2; the poller ledger (MEASURED).
10. **Under BB-7 a battle the evaluator does not reach gets no price, score or stop.** A code-only pass must run for every battle every tick, outside the model's budget. Evidence: E3 (i); `:522-536`, `:3067`.
11. **League group-mates must not run concurrently**, or exclusivity rests on the reserve transaction alone and lost reservations rise. Evidence: `tournamentAgentLedger.js:300-303`, `:333`, `:364-407`.
12. **(a) is no longer slot-bound** (45 of 100). (c) needs a platform setting the repo does not record, and an 800 s run does not overlap the next. Evidence: Part A, facts 4 and 10.
13. **The September stale-comment and fence findings still stand**: R5 (the canonical-open comment at `:464-469` says "inert in prod" while `LEAGUE_CANONICAL_OPEN_CAPTURE = true`, `featureFlags.js:384`) and R6 (`agentEvalTransport.js` called fenced at `:235`, not on §1). New: two "processed serially" comments (`captureBodyObserver.js:25-29`, `agent-evaluate.js:521`). Report only.

---

## 8. Founder questions

1. **The beta's target: how many players in a battle at once?**
   - **10:** one more lane (K = 2) is enough for the evaluator. EODHD sits right at its cap, so the EODHD reduction must come first or with it.
   - **25:** K = 5, or N = 5. EODHD needs about 2× its cap unless the evaluator stops refetching (the daily bars are about 35 % of its units) or reads the poller's snapshot.
   - **50 or more:** (b)+(d), or a large K in one process. EODHD must be redesigned (a shared price store) and the Anthropic limits known.
2. **Anthropic rate limits (not recorded anywhere): the Haiku 4.5 requests, input tokens and output tokens per minute on the Console's limits page.**
   - **Above about 15 requests and 260k input tokens a minute:** K up to 8–10 is safe against Anthropic.
   - **Below that:** the build needs a shared token bucket, and a 429 costs a battle its decision (`maxRetries: 0`).
   - Note that Huddle (Sonnet 5.5), FantasyTimes, mandate and reflections share the organisation.
3. **Is Fluid Compute on, and what memory and CPU does the evaluator function get? (Vercel project settings; not in the repo.)**
   - **Fluid off:** (c) buys nothing. (d) is unaffected. (b)'s slices are separate instances.
   - **Fluid on:** (c) can reach 800 s (17–19 per run, late checks). Several invocations may share a process, which is safe by Part C.
   - The memory size bounds K for (d) (ASSUMED ample at K ≤ 8).
4. **The EODHD plan's limits: the daily cap and the per-minute cap, and whether either counts requests or units.**
   - **100,000 a day and 1,000 requests a minute:** EODHD binds first at about 7–12 battles, and K = 5–8 meets the minute cap at the start of every run.
   - **A higher contract:** the evaluator wall comes first and the K above apply directly.
5. **May the code-only pass (BB-7) price stops from the poller's delayed quotes (`/us-quote-delayed`), or must it be the evaluator's own `/real-time/` quote?**
   - **Delayed snapshot:** zero extra EODHD per battle, one read per run, but the "first observed price" is a delayed print.
   - **Own quote:** about 34 GETs per battle per tick on top of today's 117.

---

## 9. Builder's read

*Input to the founder, not a decision.*

I would build **(d), the bounded pool, first**, dark behind a K setting that ships at K = 1 (byte-for-byte today's behaviour) and is raised to **K = 3** after a week of measured runs. It is the only shape that:
- keeps one invocation and one pre-loop pass;
- keeps global fair rotation;
- adds no cron entry;
- needs no platform setting;
- touches no fenced file.

Part C found nothing in the process that it breaks. It ships with its three edge changes:
- the dispatcher (a start cutoff, "deferred = never dispatched", `poolK` and `maxInFlight` on the run record);
- an EODHD per-request timeout and a process-wide limiter;
- group affinity for League.

**But I would not raise K past 2 until the EODHD side is cut**, because at K ≥ 2 EODHD, not the evaluator, is the wall. The cheapest cuts are all outside the fence: stop `forceRefresh` on the daily bars (they do not change during the day), fetch the three macro symbols once per run, and for the BB-7 code-only pass read the poller's snapshot. I would add (b) on top only if the founder's beta target is above about 25 players. I would not build (a) (it fixes each battle's shard for life and runs pre-loop N times) or (c) (it needs Fluid, and an 800 s lane makes the stop checks of tail battles up to 12 minutes late).

---

## 10. Method and limits

**What was read (VERIFIED):**
- `api/cron/agent-evaluate.js`: the handler `:225-726` and `processAgentBattle` at every line cited.
- `agentEvalTransport.js`, `marketDataCache.js` (`:560-810`, fetch sites), `tickCapture/captureContext.js`, `captureBodyObserver.js`, `captureWriter.js` (`:180-262`), `captureSerializer.js` (`:68-215`), `callRecords/release.js` (`:225-275`), `callRecords/publish.js` (`:60-88`), `tournamentAgentLedger.js` (`:295-347`, transaction sites), `masterySettlement.js` (`:673-714`), `setupMenuLabels/reads.js` (`:1-70`, `:208-245`), `intraday/intradayStore.js` (`:1-30`), `intraday/intradayFetch.js` (`:1-20`, `:49`), `tournamentOrchestrator.js` (`:251-318`, `:406-486`), `vercel.json`, `featureFlags.js` (flag lines cited), `docs/BUILD_RULES.md`.
- The September scaling report, the readiness report (§A1–A2), the EODHD census (Q-06, Q-08, Q-09) and the test files cited in Part C item 14.
- A delegated census of module-level state over the 255-module import closure; every row this report relies on was re-read here. Its claim that no test covers overlapping scopes was refuted (Part C).

**What was measured (MEASURED):**
- Window: ET sessions 2026-10-16 → 2026-11-13 (21 weekdays; 2026-10-16 is the first full session at the 40 s ceiling, after `e5ce2970` on 2026-10-15).
- 546 run records, 60 battle documents (field-masked), 1,353 tick records, 539 evaluation entries and 21 poller ledger documents.
- The readiness report's fit was reproduced exactly on its own window, as a check on the method.

**What was assumed (ASSUMED), and why:**
- That checks do not slow each other at K > 1: never observed; agent-mode runs held one check each.
- CPU time per check: not recorded.
- The pre-call split is exact only on HOLD ticks (95 %).
- The CPU book and macros are disjoint from the universe (upper bound).
- The EODHD daily and per-minute limits; the census's modelled fixed consumers; the poller cap at the full universe.
- Anthropic limits; the Vercel plan, Fluid Compute and memory.
- That League stays hidden for the beta (BB-1, from the prompt).
- One agent per player.

**Not readable here:** Vercel function logs; the Anthropic Console; the EODHD dashboard.

**The script's exact command** (repo root; read-only; the Firebase Admin variables from `.env.local`):

```bash
node --env-file=C:/Users/fashr/portfolio-duel/.env.local scripts/eval-capacity-read.mjs --from 2026-10-16 --to 2026-11-13 --json <scratchpad>/eval-capacity-read.json
```

Without `--env-file`, the script loads `.env.local` / `.env` from the repo root itself (`scripts/loadLocalEnv.js`). `--from` defaults to 2026-10-16 and `--to` to the last weekday before today (ET). The script ran four times this session, each extending what it printed; the numbers above are the final run's. Its output is deterministic for a closed window, except that it reads live documents.

**Checks run on the script:** `eslint scripts/eval-capacity-read.mjs` (exit 0). The eight tests that scan `scripts/` (`compositionProtectedStores.scan`, `compositionRunbookGates`, `compositionWriterCensus`, `equippedHypothesisRefs.census`, `kb/boundary`, `kb/packages`, `setupEvidenceImportGuard`, `setupMenuLabels/tenant`): 8 files, 248 passed, 1 skipped. No other test was run; no source changed.
