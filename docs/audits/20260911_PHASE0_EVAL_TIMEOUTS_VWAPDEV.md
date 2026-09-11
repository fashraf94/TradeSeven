# Phase 0 — Eval-path timeouts and the `vwapDev` stamp (read-only discovery)

**Date:** 2026-09-11 (Friday) · **Needed by:** Monday Sep 14's battle
**Branch:** `claude/phase0-eval-timeouts-vwapdev`, cut from `origin/main` at HEAD
**HEAD:** `fcace00d4d572b8778ca218f51c96fa913c72045` — the PR #836 merge (`Light TICK_STAMPS_ENABLED: the three tick stamps ship`)
**Tree at open:** clean · **Mode:** read-only — no production code edited, no fenced file edited, no Firestore or GCS write of any kind, no PR
**Files this session created:** this report; `scripts/phase0-eval-timeouts-readonly.js` (§2.4)
**Markers:** every codebase claim carries `file:line` and VERIFIED (read at that line at HEAD in this session) or ASSUMED (not verifiable from this environment; the basis is named).

---

## 0. Preamble — what was done before the questions

1. `git fetch origin main` at open (BUILD_RULES §3). Local `main` was stale at `0e04833`; `origin/main` is `fcace00`. The branch was cut from `origin/main`.
2. **`git fetch --unshallow origin` was run** (permitted by BUILD_RULES §3, recorded here). The container was a shallow clone and `c4ca421` was unreachable until then.
3. BUILD_RULES §1 (the fence) and §3 (discovery protocol) read. Fenced files were read and called nowhere; nothing edited.
4. **Three inputs the brief names do not exist in the tree:**
   - `docs/design/ARC_CONTINUATION_PACKET_SEP9_2026.md` (V1.2) — not at HEAD, and no continuation/packet document was ever added on any ref (`git log --all --diff-filter=A` over the whole history). Its §2 and §4 item 7 could not be read. The four questions are taken from the brief, which restates the two observations.
   - `api/_utils/gcsCredentials.js` / `GCS_CREDENTIALS_FILE` — no such loader at HEAD. GCS credentials are the JSON-stringified service account in the env var `GCS_CREDENTIALS` (`api/_utils/shadowLogger.js:25` VERIFIED; the one exported reader is `getBucket()` in `api/scripts/gemma-latency-report.js:342-353` VERIFIED).
   - The "June 11 H2 diagnostic" — no document in the tree names it. The nearest artifacts are commit `adaa151b` (2026-06-12, "VWAP floor Phase 1: freshness gate…", whose body describes the June 11 stale-session shape) and the May 12 read-only investigation `discovery/vwap-semantics-investigation.md`, which lives only on the never-merged branch `claude/vwap-semantics-investigation` (`5414d7c5`).
5. **Credentials: none in this environment.** No `FIREBASE_*`, no `GCS_CREDENTIALS`, no EODHD key, no `.env` / `.env.local`. Per the session's rule (§6 of the brief) the two data pulls — the Q1 baseline table and the Q3 Thursday read — **STOP here**. The exact document paths and field names for a console count are in §2.4 and §4.4, and a read-only census script is committed for a local run (§2.4). The script was syntax-checked and its pure tallies self-tested on fixture entries; **it has not touched live data.**
6. `node_modules` is not installed in the container, so the Anthropic SDK's error strings are cited from `api/_utils/agentEvalTransport.js:4-7`'s own header (which records verification against SDK 0.71.2) and marked ASSUMED at the SDK level. `package.json:18` pins `@anthropic-ai/sdk ^0.71.2` (VERIFIED); no dependency or `vercel.json` change has merged since Sep 1 (VERIFIED, `git log --since=2026-09-01 -- package.json package-lock.json vercel.json` is empty).
7. `c4ca421` (June 11, the Haiku eval reliability fix) was read as background. Every claim below is against the tree at HEAD.

---

## 1. Executive verdict

| Q | One-sentence answer | Confidence |
|---|---|---|
| **Q1 — is 3/13 new?** | **Not answerable from the tree** — it is a data count that needs credentials this session did not have; what the tree does settle is that **both merges (technicals hygiene 05:12 UTC, the flip 05:48 UTC, Sep 10) precede every one of Thursday's checks (13:30 UTC onward)**, so Thursday is post-flip and post-hygiene from its first check, and neither PR can explain a change *within* the day. | High on the timing; the rate itself is the console's to answer (§2.4) |
| **Q2 — where does the time go?** | The 22 s abort backstop is armed **before** prompt assembly, so assembly time (including up to ⌈N/10⌉+1 Firestore round-trips for an agent with institutional rules) is charged against the Haiku call — **but this has been so since June 11, not since the flip**; the tick stamps are composed **after** the call, do no I/O, and cannot move the timeout rate; `failureClass: 'timeout'` merges the SDK timeout and the abort, and only `haikuError.message` tells them apart. | High (code); which of the two fired on Thursday is a one-field console read (§3.6) |
| **Q3 — what does `vwapDev: null` mean?** | All three sites read the same key (`momentumData.vwap[sym].vwapDeviation`), so `null` on every position means **`momentumData.vwap` had no entry for any held symbol on any of the 13 checks — the prompt showed no VWAP either, and `saw: null` is TRUE**; the classification is **1 (freshness gate) or 2 (builder failed)**, which the record cannot distinguish, with **1 the leading hypothesis** (EODHD's intraday endpoint lags ≥ 1 trading day under this project's plan per the May 6 fix, and the June 12 gate requires today's session). If 1 holds, it has held **every day since June 12**, and the VWAP floor has been disarmed all along. | High that 3 and 4 are ruled out by code; Medium on 1 vs 2 (data) |
| **Q4 — Monday's smoke** | At `'shadow'` the chip route 404s; the one action that files a directive is **a typed Battle View chat message the deterministic gate resolves to a canonical adjustment** (`POST /api/agent/chat` → `agentBattles/{id}.directive`); the Heard line renders only from `evaluations[].heard` with `suppressed === null`, keyed by a thread id minted at filing, so no earlier check can carry it; Why? and Bench are presence-gated with no placeholder state. | High |

---

## 2. Q1 — Is 3/13 new? (the baseline)

### 2.1 Where the battle doc keeps the checks

- A "check" is one entry in the **`evaluations` array on the battle doc** `agentBattles/{id}` — appended and capped at 150 in `api/cron/agent-evaluate.js:2801` (VERIFIED). The entry is composed at `:2654-2694` (VERIFIED): `evalId`, `timestamp`, `day`, `battlePhase`, `decision`, …, and `haikuError` at `:2693` — `null` on success, else `{ failureClass, message, timestamp, evalId }`.
- An entry exists only for ticks where the trigger gate fired: with no triggers the tick writes scores and returns without an entry (`:1926-1947` VERIFIED). So 13 checks on Thursday is 13 triggered ticks, not 13 cron firings.
- `haikuError.failureClass` values: `'timeout' | 'truncated_response' | 'budget_skipped' | String(status|name)` (`:1962-1963` VERIFIED; the classifier is `api/_utils/agentEvalTransport.js:48-65` VERIFIED).
- **Secondary records of the same failures** (all ride the same write): `cronState.cronErrors[]` (`{timestamp, error, failureClass, evalId}`, cap 20, `:2845-2854` VERIFIED); `statusFeed[]` beats with `action: 'eval_degraded'` (`:2764-2774` VERIFIED; cap 100 for agent battles, `:681` VERIFIED); `cronState.consecutiveEvalFailures` (`:2836-2839`), `cronState.totalHaikuCalls` (attempts only, `:2822`), `cronState.totalTokens.{input,output}` (`:2828-2829`) (VERIFIED).
- **The GCS shadow stream:** `logEvaluation(...)` at `:2777-2798` (VERIFIED) → bucket `fantasytrades`, path `shadow/evaluations/{YYYY-MM-DD}/{eventId}.jsonl`, one record per file (`api/_utils/shadowLogger.js:18, :50-52` VERIFIED). The record carries `battleId`, `failureClass` (`:2797`), `tokenUsage: { input, output }` (`:2793`), `_loggedAt`; **it carries neither `evalId` nor the entry's `timestamp`**, so it joins to the doc only by `battleId` and order.
- **The pre/post-flip marker** is the presence of `evidence` (and `vintages`) on the entry: written only under `TICK_STAMPS_ENABLED && promptBuilt` at `:2712` (VERIFIED; the flag is `src/config/featureFlags.js:2238`, `= true` since `69d18ec8`), i.e. only by code deployed from the flip merge onward. An entry with `haikuError` set and no `evidence` after the flip is a `budget_skipped` tick or a builder throw (`api/_utils/tickStamps.js:76-83` VERIFIED).
- **No battle-doc expiry exists in the tree:** no cron deletes `agentBattles` docs (grep over `api/cron` for `.delete(`/`expiresAt` finds only the completion path); a completed battle keeps its `evaluations[]`. The only "expiry" is the 150-entry cap, which a one-day battle never reaches (≤ 26 triggered ticks per day).

### 2.2 The two merge times against Thursday's checks (from `git log` on `main`)

Merge time is a **proxy for deploy time** (the founder can confirm the Vercel deploy timestamps if the answer ever turns on the gap). Author dates on the merge commits are US Central (`-05:00`); converted to UTC below.

| Change | Commits (UTC) | Merge commit | Merge time (UTC) | Relative to Thursday's first possible check (13:30 UTC) |
|---|---|---|---|---|
| Technicals data-hygiene PR #833 (finite-row daily mapper `1455e468` 03:07:22; raw-vs-raw SMA flags `26e88aad` 03:27:59; `debate.js` POSITION DATA line `533848b7` 03:27:59 — all Sep 10) | see left | `2d256896` | **2026-09-10 05:12:55** | 8 h 17 m **before** |
| `TICK_STAMPS_ENABLED` flip PR #836 (`69d18ec8` 05:37:16 Sep 10) | see left | `fcace00d` (HEAD) | **2026-09-10 05:48:37** | 7 h 41 m **before** |
| For context: the server-half stamps PR #827 (dark) | `0bc604f1`, `b952f783`, `e1d19a42` (Sep 9) | `c8bd17dd` | 2026-09-09 03:14:40 | a full trading day earlier, inert until the flip |

Thursday's ticks run at `*/15` over 13:00–21:59 UTC (`vercel.json:157-159` VERIFIED) and evaluate only while `isMarketOpen()` (`:293` VERIFIED; 09:30 ≤ t < 16:00 ET, `api/_utils/marketSchedule.js:158-176` VERIFIED), i.e. 13:30–19:45 UTC: **26 firings, of which 13 produced an entry.** Both merges were live (deploy permitting) before the first one.

### 2.3 The baseline table — NOT PRODUCED

The Sep 1–10 table (battle id, date, checks, count by class, wall time, stamp presence, source) requires reading `agentBattles` and, for any doc that lost its entries, the GCS stream. **No credentials were available; per the session rule this stops here rather than improvising access.** Nothing in the tree stores those counts.

### 2.4 How to get the table — the exact paths, and the committed script

**Console recipe (Firestore):** collection `agentBattles`, filter `activatedAt >= "2026-09-01"` and `activatedAt <= "2026-09-10T23:59:59.999Z"` — `activatedAt` is an ISO string (`api/_utils/agentBattleService.js:69, :140` VERIFIED). Per doc, read:

| Field | What it answers |
|---|---|
| `evaluations[]` length | checks |
| `evaluations[i].haikuError.failureClass` (null → success) | count by class |
| `evaluations[i].haikuError.message` | which timeout fired — see §3.3 |
| `evaluations[i].evidence` present? | pre/post-flip marker; `evidence[sym].vwapDev` for Q3 |
| `evaluations[i].timestamp` minus its :00/:15/:30/:45 slot | the only per-check wall-time proxy (§2.5) |
| `cronState.cronErrors[]`, `statusFeed[].action == 'eval_degraded'` | cross-checks (capped 20 / 100) |
| `cronState.totalHaikuCalls`, `cronState.totalTokens.input` | attempts; input tokens per responded call = `totalTokens.input / (totalHaikuCalls − timeouts − other transport failures)` |
| `cronState.intradayMomentum`, `cronState.vwapTicks` | Q3 (§4.4) |

**GCS recipe:** for each day, list `gs://fantasytrades/shadow/evaluations/{YYYY-MM-DD}/` and read each `.jsonl` line's `battleId`, `failureClass`, `tokenUsage.input`, `_loggedAt`.

**Script:** `scripts/phase0-eval-timeouts-readonly.js` (committed with this report) prints all of the above as three Markdown tables plus an optional GCS table. It reads with `doc().get()` / one range `.where().get()` / `bucket.getFiles()` + `file.download()` only — no write call exists in the file — and loads credentials through the existing loaders only: `scripts/loadLocalEnv.js` + `api/_utils/firebaseAdmin.js` for Firestore, and `getBucket()` from `api/scripts/gemma-latency-report.js` (the `GCS_CREDENTIALS` JSON, the same variable `shadowLogger.js` writes with) for GCS. Run from the repo root after `npm install`, with `.env.local` carrying `FIREBASE_*` (and `GCS_CREDENTIALS` for `--gcs`):

```
node scripts/phase0-eval-timeouts-readonly.js --from 2026-09-01 --to 2026-09-10 --gcs
node scripts/phase0-eval-timeouts-readonly.js --battle <thursdayBattleId> --gcs
```

It is untested against live data (no credentials here); `node --check` passes and the pure tallies were exercised on fixtures.

### 2.5 Per-check wall time — not carried by the record or the shadow log

- The entry's `timestamp` is `now`, captured at `:2085` (VERIFIED) — **after** the Haiku call returned or failed (the call block ends at `:2066`). `haikuError.timestamp` (`:2058`) is a few milliseconds earlier. Neither the entry nor the shadow record (`_loggedAt` only) carries a duration, a call-start instant or a prompt-built instant.
- The only per-check timing anywhere is the handler's console line `Complete in ${duration}ms` for the whole invocation (`:374-375` VERIFIED) — Vercel function logs, not the doc.
- **Usable proxy from the record alone:** `timestamp − floor(timestamp to the 15-minute slot)`. For the first battle processed in a tick it bounds cron-start jitter + pre-call fetches + prompt build + the call. A timeout entry should show ≥ 20–22 s of offset; a much larger offset says the pre-call work, not the call, ate the time. The script prints it per timeout.

### 2.6 The one sentence

**Whether Thursday's 3/13 (23 %) is inside the pre-flip range cannot be said from the tree; what the tree says is that nothing merged between Sep 4 and Sep 10 touches the code between the abort timer and the Haiku call (§3), so if the console shows a step change on Sep 10 its cause is not in that code.**

---

## 3. Q2 — Where does the time go?

### 3.1 The order of operations from cron entry to written record (all VERIFIED at `api/cron/agent-evaluate.js`)

| # | Step | Where | Under the 22 s abort timer? |
|---|---|---|---|
| 0 | Vercel invokes at `*/15 13-21 * * 1-5`; `maxDuration: 300` (`:135`); `TIME_BUDGET_MS = 290_000` (`:139`); `startTime` (`:182`) | handler | — |
| 1 | `findActiveAgentBattles` — **every** `status == 'active'` doc (`:220`; `api/_utils/agentBattleService.js:43-50`) | handler | — |
| 2 | Market-hours guard (`:293`), canonical-open sweep with its own 15 s cap (`:305`) | handler | — |
| 3 | Fair-rotation sort by `cronState.lastEvalStartedAt` (`:332-334`); **loop budget**: `if (elapsed > TIME_BUDGET_MS) break` — the remaining battles are **deferred with no entry at all** (`:338-344`) | handler | — |
| 4 | Per battle: lock transaction (`:557-591`); tournament/attribution reads (`:665`, `:678`); **prices + daily OHLCV for every held/bench/hotBench/CPU/macro symbol, `forceRefresh: true`** (`:707-720`; the daily leg is the `/eod/` fetch whose window D-120 widened to 90 days on Sep 9, `api/_utils/marketDataCache.js:215-257`) | pre-call | no |
| 5 | Parallel: **intraday 5 m candles for held symbols (EODHD, 5-wide batches, 200 ms between)**, `stockRankings`, `stockTechnicalScores` for held+bench, `marketContext`+`SPY` (`:946-955`; `marketDataCache.js:883-913`) | pre-call | no |
| 6 | VWAP builder (`:966-985`), rankings/regimes/risk pass (`:1095-1099`, `:1186-1203`, `:1337-1391`), risk swaps if any (`:1596-1800`), proposal/gameplan/suppression passes (`:1805-1868`), news query (`:1876`), trigger gate (`:1926`) | pre-call | no |
| 7 | **Pre-call budget guard** `shouldStartHaikuCall({ elapsedMs, timeBudgetMs })` → `budget_skipped` when remaining < 34 s (`:1983-1989`; `agentEvalTransport.js:80-89`) | call block | — |
| 8 | **`new AbortController()` (`:1998`) and `hardAbort = setTimeout(abort, HAIKU_CALL_CEILING_MS)` (`:1999`)** — 22 000 ms (`agentEvalTransport.js:14`) | call block | **timer starts here** |
| 9 | **Prompt assembly:** `buildEvalSystemPrompt` (`:2015`), `buildAgentIdentityBlock` (`:2016`), **`await buildLiveContextBlock(...)` (`:2017-2020`)** — async; it awaits `fetchInstitutionalContext` (`api/_utils/agentEvalPromptAssembly.js:1250`), which, when the agent has any `category === 'institutional'` rule, does **⌈N/10⌉ sequential batches of parallel `institutionalHoldings/{sym}` gets over held + bench symbols, then one `institutionalAggregates/latest` get** (`:891-921`); otherwise returns `null` with no read (`:892-893`). Errors there are caught and swallowed (`:930-933`, `:1253-1255`) | call block | **yes** |
| 10 | `promptBuilt = true` (`:2021`) | call block | yes |
| 11 | `anthropic.messages.create({ model: EVAL_MODEL_ID, max_tokens: 2048, … }, { timeout: 20_000, signal: abortCtrl.signal })` (`:2022-2033`; `maxRetries: 0` on the client, `:141-155`) | call block | yes — SDK timeout 20 s from **here**, abort 22 s from step 8 |
| 12 | `catch` → `haikuFailure = { failureClass: classifyHaikuFailure(err), message: err.message.slice(0,200), timestamp }` (`:2054-2062`); `finally clearTimeout(hardAbort)` (`:2063-2065`) | call block | timer cleared |
| 13 | `evalId` (`:2068`), decision processing, swaps, `now` (`:2085`), the entry (`:2654-2694`) | post-call | no |
| 14 | **The tick stamps** — `resolveControls` on the in-memory battle, `rankingsComputedAtMs` off the already-fetched snapshot, `composeTickStamps(...)` (`:2711-2759`) | post-call | **no** |
| 15 | `eval_degraded` beat (`:2764-2774`), shadow log fire-and-forget (`:2777-2798`), `finalUpdate` (`:2810-2858`), narrations/anticipations in `finally` with a 12 s remaining-budget gate (`:2947-2980`) | post-call | no |

**Q2.1 answer.** The SDK `timeout` (20 s) is set at `:2033`; the AbortController is constructed at `:1998` and its 22 s timer armed at `:1999` — **before** the three prompt builders at `:2015-2020` and before `promptBuilt` at `:2021`. So prompt-assembly time is charged against the backstop: the call's effective ceiling is `22 s − T_build`, and **whenever `T_build > 2 s` the backstop fires before the SDK's own 20 s timeout can.** The stamps are not in that window at all (step 14).

**This is not new.** The June 11 transport fix placed the timer exactly there: in `c4ca421` the `hardAbort` line was immediately followed by `messages.create({ … content: await buildLiveContextBlock(...) … })`, i.e. the build already ran after the timer was armed (VERIFIED from `git show c4ca421 -- api/cron/agent-evaluate.js`). The Sep 9 hoist in PR #827 moved the three builder calls out of the request literal into named constants **at the same point in the sequence** (VERIFIED from `git diff c8bd17d^1 c8bd17d`, the only pre-call lines it touched); the order and the timer position are unchanged.

### 3.2 The tick stamps — what they read, when they run, what they cost

- Computed at `:2712-2751` (VERIFIED), **after** the Haiku call and after `clearTimeout(hardAbort)` (`:2063`), inside a fail-safe `try` (`:2711`, `:2753-2759`) so a composer fault can never cost the write.
- Inputs are objects the tick already holds: `resolveControls` on the **in-memory** `battle` (`:2722-2731`, pure), `rankingsResult.value.data()` — the snapshot fetched in step 5 (`:2734-2736`, no new read), `assetScores`, `prices`, `momentumData`, `stockRegimes`, `riskStatus`, `flattenBenchServer(battle.portfolio?.bench)` (`:2737-2750`). The composer is "PURE, ZERO IMPORTS, Node-clean" (`api/_utils/tickStamps.js:5` VERIFIED): **no Firestore, no GCS, no network.**
- **No timing instrumentation** exists around the block (no `Date.now()`/`performance.now()` between `:2706` and `:2760`; VERIFIED by grep).
- Post-flip cost that does exist: each stamped entry adds roughly 1 KB, and the `finalUpdate` rewrites the whole `evaluations` array every tick (`:2801`, `:2812`) — post-call, within the 12 s post-call allowance, not on the call.
- **Conclusion:** stamp time is not charged against the Haiku call; the flip cannot have moved the timeout rate. **A flip-back would remove the evidence and change nothing about the timeouts.**

### 3.3 What `failureClass: 'timeout'` is keyed on — and whether the two timeouts are distinguishable

`api/_utils/agentEvalTransport.js:48-65` (VERIFIED) returns `'timeout'` for **any** of: constructor `APIConnectionTimeoutError` (the SDK's 20 s), constructor `APIUserAbortError` (the 22 s backstop), `err.name === 'AbortError'`, a message matching `/timed? ?out/i`, or a message matching `/request was aborted/i`. **By `failureClass` the SDK timeout and the abort are indistinguishable — that is a finding.** They *are* distinguishable in the record by `haikuError.message` (`:2057` stores the first 200 characters of the error message): per the module header (`:4-7`, which records verification against SDK 0.71.2 — ASSUMED here, SDK not installed), the SDK timeout says **`Request timed out.`** and the abort says **`Request was aborted.`**

Two further edges of the same key (VERIFIED at the cited lines):
- A builder that takes longer than 22 s leaves the signal already aborted when `messages.create` is reached; the SDK then throws the abort error immediately and the entry is `'timeout'` with `promptBuilt === true`, i.e. **stamped** — indistinguishable from a transport timeout except by the slot offset.
- The SDK's `timeout` option covers the request until the response arrives; the outer signal also covers the body read. Which phase the 20 s covers in 0.71.2 could not be verified here (ASSUMED unknown). Either way the abort at 22 s bounds the whole call.

### 3.4 Prompt size and tool-use output shape since Sep 4

- **`debate.js` is not on the decider's path.** `api/agent/debate.js:1-8` imports `@anthropic-ai/sdk`, `firebaseAdmin`, `security`, `authMiddleware`, `agentScoring`, `legacyDirectiveSanitize`, `marketDataCache`, `technicalCalculations` (VERIFIED); nothing under `api/` imports `debate.js` (VERIFIED by grep); its only caller is `src/components/Agent/DebateModal.jsx:38` (VERIFIED). The `'under_debate'` string at `agentEvalPromptAssembly.js:1078` is a vision-state label, not an import. PR #833's third commit changed only `debate.js` and its test (VERIFIED, `git show --stat 533848b7`).
- **None of the decider's prompt modules or its tool schema changed after Sep 2** (VERIFIED, `git log -1` per file on `origin/main`): `agentEvalPromptAssembly.js` and `evalIdentityBlocks.js` — `152217ea` 2026-09-02; `agentEvalToolSchema.js` — `50a4ca49` 2026-08-14; `agentEvalTransport.js` (`EVAL_MAX_OUTPUT_TOKENS = 2048`) — `9bd74493` 2026-07-31; `fundamentalsRender.js` Jul 25; `controlPromptRenderer.js` Jul 10; `compositionAdvisoryRender.js` Aug 7; `agentPromptAssembly.js` Aug 6; `agentRegimeClassifier.js` May 6. The registry of prompt-contributing modules is `api/_utils/__fixtures__/promptHonestyRegistry.js:47-79` (VERIFIED).
- **The stamps do not reach the prompt.** `formatRecentEvals` reads exactly `decision, evalId, hypothesis, rationale, symbolIn, symbolOut, tier, timestamp` (`agentEvalPromptAssembly.js:1389-1402` VERIFIED), pinned by `api/cron/agent-evaluate.tickStamps.pins.test.js:206-212` (VERIFIED).
- **What did change since Sep 4 is data-side, pre-call or content-only:** D-120 widened the daily `/eod/` window 30 → 90 calendar days (`365e35a3` Sep 9; `marketDataCache.js:215-257`) — a bigger response on the step-4 fetch, not under the timer; PR #833's SMA-flag and daily-mapper changes alter the *values* in `stockRankings` / `stockTechnicalScores` that the bench block and regimes render — same fields, same shape.
- **Bytes-in per check:** the entry carries no token counts (`:2654-2694` VERIFIED — none). The shadow record carries `tokenUsage.input` per check (`:2793`); the doc carries only the cumulative `cronState.totalTokens.input` (`:2828`). To compare one pre-flip check to one Thursday check: read `shadow/evaluations/{day}/*.jsonl` for both battles (the script's `--gcs` table prints p50/p90/max per battle-day), or divide `totalTokens.input` by the responded-call count per battle.

### 3.5 `maxDuration`, battles per tick, and the serial-loop cost

- `maxDuration: 300` (`:135`), no `vercel.json` override (`vercel.json:3-7` sets only `includeFiles`; VERIFIED). Soft budget 290 s (`:139`).
- **Battles per tick = every `status == 'active'` agent battle** (`:220`; `agentBattleService.js:43-50`), processed **serially** (`:338-350`). The count on Thursday is data (the script's table lists every battle active that day).
- Two different starvation mechanisms, both VERIFIED: (a) the handler-level deferral at `:338-344` (elapsed > 290 s → later battles get **no entry**, `summary.skipped`); (b) the per-battle guard at `:1983-1989` (remaining < 34 s, i.e. elapsed > 256 s → an entry with `failureClass: 'budget_skipped'`, no stamps, no attempt counted).
- Per-battle cost bound: pre-call fetches (steps 4–6) + ≤ 22 s call + ≤ 10 s narrations + ≤ 10 s anticipations + the write. A 22 s timeout on one battle therefore costs the next battles 22 s of the shared 290 s. **Whether Thursday's other battles show `budget_skipped` is a data question; with one to three battles per tick the 256 s threshold is far away and the answer is expected to be no.**

### 3.6 Reading

The read points to **two candidate causes, neither of them the two merges**:

- **(A) The call itself takes ≥ 20 s some of the time** — Haiku 4.5 generating a forced tool-use JSON of up to 2 048 output tokens (the July baseline in `agentEvalTransport.js:25-33`: mean ~907, p99 ~1 240, max ~1 421 output tokens). If (A), `haikuError.message` reads `Request timed out.`, and 3/13 is the norm, not a regression. **Confidence that this is at least part of it: medium** — the ceiling is tight for that output size, but the throughput is not measurable from the repo.
- **(B) Prompt assembly eats the 2 s of headroom** — a `hasInstitutionalRules` agent with a wide bench does sequential Firestore batches inside the timer window. If (B), the message reads `Request was aborted.` and the slot offset is ≈ 22 s plus pre-call time. **Confidence: low-to-medium** — it is real by construction (§3.1 step 9) but it has been true since June 11.

**Cheapest test, in order:** (1) read `haikuError.message` on Thursday's three timeout entries — one console field, no deploy; (2) read the slot offsets on the same three (the script prints both). **The flag flip-back is a one-line PR but is not a test of this**: the stamps run after the call (§3.2), so flipping `TICK_STAMPS_ENABLED` back would change nothing about the timeouts while costing Monday's smoke its evidence. **No fix is proposed here.** If a later task wants one, the two obvious candidates are arming the abort timer after `promptBuilt` and stamping a `callMs`/`promptBuiltAt` on the entry — both fence-free (the cron and `tickStamps.js` are not fenced) but out of this session's scope.

---

## 4. Q3 — What does `vwapDev: null` mean?

### 4.1 (a) Written — the intraday VWAP builder

- `momentumData` is created as `{ vwap: {}, rankings: {} }` at `:938` (VERIFIED).
- Candles: `fetchIntradayBatch(portfolioSymbols, { interval: '5m' })` at `:946-947` — **held symbols only**, no `hoursBack`, so the request is `…/intraday/{SYM}.US?…&interval=5m` with **no `from`/`to`** and EODHD's natural window (`api/_utils/marketDataCache.js:792-806` VERIFIED; per-symbol failure → `[]`, never a rejection, `:883-913` VERIFIED). Empty or non-array responses return `[]` with a console warning only (`:814-821`).
- Per held symbol (`:966-985` VERIFIED): `filterToLatestSession(candles)` anchors on **the latest ET date present in the data**, not today (`marketDataCache.js:1040-1079` VERIFIED, `:1060-1063`), and returns `{ candles, sessionDate }`; `calculateVWAP(sessionCandles)` returns `{ vwap, currentPrice, vwapDeviation }` at 4 dp or `null` (`api/_utils/technicalCalculations.js:378-410` VERIFIED).
- **The freshness gate** (`:978`): `isVwapSessionUsable({ sessionDate, todayET, sessionCandleCount })` ⇔ `sessionDate === todayET && sessionCandleCount >= 3` (`api/_utils/agentVwapFloor.js:36-38`, `MIN_SESSION_CANDLES = 3` at `:13`; VERIFIED). `todayET` is `formatDateString(getETDate())` at `:755`. A stale or thin session publishes **nothing** — the key is simply absent.
- **Published shape** (`:980`): `momentumData.vwap[symbol] = { vwap, currentPrice, vwapDeviation, sma20_5m, sessionDate }`. **The field name is `vwapDeviation`.**
- Persisted every tick as `cronState.intradayMomentum = momentumData.vwap` (`api/_utils/agentCronState.js:39`, called at `:2858` and the four other flush sites; VERIFIED). The risk manager reads the same map for the floor (`:1337-1345`, `:1366-1370`; `api/_utils/agentRiskManager.js:141`).
- **The intraday fetch has not changed since May 13** (`git log -L` over `fetchIntradayCandles`: `050c395d` 2026-05-13, `e9a44d8c` 05-07, `330b5fa8` 05-06 — VERIFIED). The three `marketDataCache.js` commits since Sep 4 touch only `fetchDailyOHLCV`/`mapDailyRows` (`1455e468`, hunks at `:256` and `:277→363`) and `getStockAnalysisData` (`b9cb95dc` at `:226`/`:500→515`; `365e35a3` at `:215`/`:460→491`) — **none in the intraday path** (VERIFIED by hunk headers).

### 4.2 (b) Rendered — what the decider's prompt shows

- `buildLiveContextBlock` calls `buildMomentumSnapshot(assetScores, momentumData)` at `agentEvalPromptAssembly.js:1196-1202` (VERIFIED) and pushes the block only when it is non-null.
- `buildMomentumSnapshot` reads **`momentumData.vwap[sym]`** and renders `VWAP: $x (+d.dd%)` only when `vwapInfo && vwapInfo.vwapDeviation != null` (`:1834`, `:1838-1840` VERIFIED). A missing entry contributes no VWAP part; a symbol with no parts contributes no line; with no lines the function returns `null` (`:1859-1861`) and **the whole `INTRADAY MOMENTUM SNAPSHOT` block is omitted — there is no stale marker and no placeholder.** BB-width / NR7 / range parts come from `momentumData.rankings` and can keep the block alive without any VWAP line.
- No other site in the eval assembler renders VWAP (VERIFIED by grep: `:1116` doc comment, `:1826-1840` only).

### 4.3 (c) Stamped — what `TICK_STAMPS_ENABLED` writes

- `composeEvidenceStamp` iterates `assetScores` (the rows the ACTIVE POSITIONS CSV rendered, `api/_utils/tickStamps.js:182-184` VERIFIED) and for each held symbol reads **`momentumData?.vwap?.[sym]`** (`:188`) and writes **`vwapDev: round2(vwapInfo?.vwapDeviation)`** (`:194`) — `null` when the entry or the field is absent (`:102`).
- **The field is written for every held position regardless of whether (b) rendered a VWAP line** (`:190-199`): the stamp's `null` is the honest value for "not rendered".
- Both the prompt (`:2018`) and the stamp (`:2743`) are handed the **same in-memory `momentumData` object** in the same tick, and `momentumData.vwap[...]` is assigned nowhere but the builder at `:980` (VERIFIED by grep for `momentumData.vwap =`/`delete momentumData`). So (b) and (c) cannot disagree on this field.

### 4.4 Thursday's data — NOT READ (no credentials); what to read

| Read | Path / field | What each outcome means |
|---|---|---|
| Was the map present at the last tick? | `agentBattles/{thursdayId}.cronState.intradayMomentum` | `{}` → no held symbol was published at the last tick (consistent with all-null stamps); non-empty → look at each entry's `sessionDate` and `vwapDeviation` |
| Was any strike ever counted? | `agentBattles/{thursdayId}.cronState.vwapTicks` | all `0` is consistent with an absent map (`:1343-1345` resets to 0 when `vwapInfo` is null) |
| The narrator's copy of the same map | `voiceLayerCache/{thursdayId}.briefs[].intraday` | `null` → absent at the cache cron's run; an object carries `sessionDate` (`api/cron/voice-layer-cache.js:921`, `:403`; `api/_utils/buildTechnicalSnapshot.js:99-105` — sourced from `cronState.intradayMomentum`, never an independent fetch; VERIFIED) |
| **The norm** | the same two fields on **any** battle doc since 2026-06-12 | if `{}` everywhere, the freshness gate has failed closed every day since it shipped, not only Thursday |
| The session dates and candle counts themselves | **not persisted anywhere when the gate rejects** (`:978` skips silently; the rejected `sessionDate` is discarded). Only the Vercel function logs carry `[MarketDataCache] Fetching intraday 5m for …`, `Intraday response was empty for …`, `Intraday fetch failed for …`, `Dropped N synthetic close-print bar(s)` (`marketDataCache.js:806-863`, `:899-902`, `:985`). |
| The H2 re-run, live | during Monday's RTH: `GET https://eodhd.com/api/intraday/{SYM}.US?api_token=…&fmt=json&interval=5m` for one held symbol; take the max `datetime`, convert to ET; if its date is not Monday's, the gate can never open intraday under this plan |

### 4.5 Classification

Ruled out **by code**: **3** (a key mismatch — all three sites read `vwapDeviation`, §4.1–4.3) and **4** (a stamped field the prompt never renders — the prompt renders it whenever present, `:1838-1840`, and the client renders nothing for a `null` `vwapDev`: `src/data/decisionRecord.js:1015-1016` VERIFIED).

What remains is **1 or 2**, and the record cannot tell them apart: both leave `momentumData.vwap` empty, no entry, no log on the doc. **The honest reading of every Thursday check is therefore: the decider was shown no VWAP for any held name, and `saw: null` is true.** The stamp is not lying; the VWAP floor was disarmed for the day (no `intradaySnapshot`, `:1366`; no strike, `:1342`).

**Leading hypothesis: 1, and not only for Thursday.** The May 6 fix `330b5fa8` records that under this project's EODHD configuration "intraday data lags by at least one trading day" (its commit message, quoted in `discovery/vwap-semantics-investigation.md` §1.2 on the unmerged branch — ASSUMED still true today); the June 12 gate (`adaa151b`) requires `sessionDate === todayET`; nothing in the intraday path has changed since May 13. If the lag holds, today's session is never in the response during RTH and the gate has failed closed on every tick since June 12 — the VWAP floor (`vwap_failure` strikes, `TRAIL_STOP` arming) has been inert all summer and `vwapDev` will be `null` on Monday too. **This is a data-sourcing finding, not a stamps finding, and the console read of any post-June-12 battle's `cronState.intradayMomentum` decides it in one field.** Confidence: medium (the lag is documented, not re-measured).

---

## 5. Q4 — Monday's smoke, one confirmation

### 5.1 What files a directive at `VOICE_GROUNDING_MODE = 'shadow'`

- The mode is `'shadow'` (`src/config/featureFlags.js:2137` VERIFIED); `getVoiceGroundingMode(uid)` resolves it per caller at call time (`:2188-2193`).
- **The chip route is dark:** `POST /api/agent/file-directive` returns 404 before any read unless the caller resolves to `'on'` (`api/agent/file-directive.js:172-174` VERIFIED), and chips are minted only on a grounded turn, `grounded = groundingMode === 'on' && mode === 'battle'` (`api/agent/chat.js:476`, consumed at `:897`; VERIFIED). At `'shadow'` nothing mints a chip and nothing can file one.
- **The typed path is the only path.** The Battle View's chat is `AgentChat` (`src/screens/AgentBattleScreen.jsx:68`, rendered at `:1906` / `:2598` and inside `ChatSheet` at `:2712`; `src/screens/battleView/ChatSheet.jsx:3-4` VERIFIED). Sending a message POSTs `/api/agent/chat` with `{ agentId, battleId, message }` (`src/components/Agent/AgentChat.jsx:999-1005` VERIFIED).
- In `api/agent/chat.js` (VERIFIED): mode is `'battle'` unless a review exists for today (`:361`); with `ARCHETYPE_INTEGRITY_MODE = 'enforce'` (`featureFlags.js:770`) the deterministic gate runs (`:839-848`) and only in enforce does its result persist (`:852-854`); the gate persists **only a verbatim canonical allowlist text for the agent's archetype, never the typed words** (`api/_utils/directiveGate.js:3-12`); the research lint can still null it (`:933-934`). When `hasDirective` survives, a `directiveThreadId` is minted with `randomUUID()` (`:1005`) and **one `battleRef.update` writes `chatExchanges` (arrayUnion), `chatBudgetUsed` (+1) and `directive: buildDirectiveSlot(...)`** (`:1067-1079`).
- **The document and field:** `agentBattles/{battleId}.directive = { text, expiry, directiveThreadId, createdAt, adjustmentId, canonicalTextVersion }` (`api/_utils/directiveFiling.js:50-61` VERIFIED), latest-wins by whole-object set.
- **So on Monday:** the user action is *typing a message in the Battle View chat that the agent's reply classifies as an in-archetype / flex adjustment* — the founder cannot choose the text that gets filed, only whether the model resolves one. The receipt (`Filed {time}`) renders from the exchange the same route wrote.

### 5.2 The directive card's Heard line

- Rendered by `ExecutionCard` in `src/components/Agent/AgentChat.jsx:129-142` (VERIFIED) via `BATTLE_VIEW_COPY.heardLine(receipt)` (`src/screens/battleView/battleViewCopy.js:629-635` VERIFIED): `receipt.heard.heard === true` → `Heard at the {slot} check`; `=== false` → `Not heard at the {slot} check`; otherwise **null, no line**. The *This turn* strip applies the same line only to a `filed` receipt (`:656-658`).
- `receipt.heard` is attached in `AgentBattleScreen.jsx:1493-1500` (VERIFIED) from `deriveHeard(agentBattle.evaluations)` (`src/screens/battleView/deriveHeard.js:68-70`) → `heardStamps` in `src/data/decisionRecord.js:644-657` (VERIFIED): it walks `evaluations[].heard`, keys on `stamp.directiveThreadId` (`:650`), sets **`heard = suppressed === null`** (`:653`), admits only `null` or a non-empty string (`:654`), **last entry per thread wins** (`:655`), and carries the entry's own `timestamp` as `at`.
- **It cannot render on a check that precedes the filing** — structurally, not by a date compare: the thread id is minted at filing time (`chat.js:1005`; `file-directive.js:266`), and the cron stamps `heard.directiveThreadId` from the `battle.directive` it holds in memory at the tick (`agent-evaluate.js:2722-2727`; the lock transaction refreshes only `controlEpochLog` and `regimeAtStart`, `:575-584`; the stamp composer is `tickStamps.js:128-142`). An entry written before the filing carries no such id, so `heardStamps` has no key for the thread and `heardLine` returns null. A filing that lands **during** a tick is stamped on the **next** decided entry (`deriveHeard.js:37-41`), so the honest screen right after filing is **no line at all** until the next check that builds a prompt (a `budget_skipped` tick or a builder throw also carries no stamp).

### 5.3 Where Why? and the Bench read `evidence` and `candidates`

- **Why?** — `AgentBattleScreen.jsx:1841` calls `selectEvidence(latestDecision, leftAsset.symbol, lastScoredAt)` (VERIFIED); `src/screens/battleView/selectEvidence.js:39-58` returns **null** unless the entry is the latest decided one (`:43`) and carries `evidence[symbol]` (`:45-46`). `WhyPanel.jsx` turns that into facts (`:219`), sets the heading only when there is at least one fact (`:227`), and renders the "What the check saw" section only under `!isBook && evidenceHeading` (`:483-485`) (VERIFIED). `evidenceFacts` (`decisionRecord.js:1003-1038`) emits one fact per **non-null** field — `vwapDev` at `:1015-1016` — so an all-null row produces no section. **No placeholder, no "unavailable" row, no skeleton** (`selectEvidence.js:15-19`).
- **Bench chips** — `selectBench` reads `decided.entry.candidates` (`src/screens/battleView/selectBench.js:203-204`) through `selectFlagged`, which returns `[]` when the stamp is absent (`:157-169`); `PaneBench.jsx` renders the `Flagged` group only when `flagged.length > 0` (`:259-261`) (VERIFIED). **No absent state is rendered.**
- What "honest" looks like on Monday if the flip works and Q3's hypothesis holds: a held piece's Why? shows Price / Gain since entry / ATR multiple / Regime (and BB width, NR7 when the rankings row has them) **with no VWAP line**; the provenance line names `Latest held technical stamp` / `Fundamentals block as of` from `vintages`; Bench shows `Flagged` only when the decider's own anticipation output named a bench symbol as `potential_entry`.

---

## 6. For the design chat

**Q1.** Not answerable from the tree; both merges (05:12 and 05:48 UTC Sep 10) predate every Thursday check, so Thursday is post-flip from its first entry, and the console count in §2.4 (or the committed script) decides whether 3/13 is inside the pre-flip range.

**Q2.** The 22 s abort backstop is armed before prompt assembly, so assembly time — including Firestore reads for agents with institutional rules — is charged against the Haiku call, a fact that dates from June 11, not the flip; the stamps run after the call with no I/O and cannot move the rate; `'timeout'` merges the SDK timeout and the abort, and `haikuError.message` on Thursday's three entries is the one-field discriminator.

**Q3.** The written, rendered and stamped keys all agree (`vwapDeviation`), so `vwapDev: null` everywhere means no held symbol had a fresh session VWAP on any check — the prompt showed none either, `saw: null` is true, and the finding is classification 1 or 2 (data sourcing / builder), most likely the freshness gate failing closed on EODHD's day-lagged intraday feed, which would mean the VWAP floor has been disarmed every day since June 12.

**Q4.** At `'shadow'` only a typed Battle View chat message that the deterministic gate resolves to a canonical adjustment files a directive (`POST /api/agent/chat` → `agentBattles/{id}.directive`); the Heard line renders from `evaluations[].heard` with `suppressed === null`, keyed by a thread id minted at filing so no earlier check can carry it, and Why? / Bench are presence-gated with no fabricated absent state.

**Found outside the four questions (reported, not fixed — BUILD_RULES §3):**

1. **The flip-back is not a test.** A one-line revert of `TICK_STAMPS_ENABLED` would remove Monday's evidence and cannot change the timeout rate, because the stamps are composed after the call (`agent-evaluate.js:2712`, after `clearTimeout` at `:2063`).
2. **`failureClass` cannot separate the SDK timeout from the backstop; nothing on the record measures the call.** The entry carries no `callMs`, no `promptBuiltAt`, no call-start instant; `timestamp` is captured after the call (`:2085`). Additive fields at the stamp site would be fence-free (the cron and `tickStamps.js` are not fenced) — a separate task if wanted.
3. **The abort timer wraps prompt assembly** (`:1999` before `:2015-2020`): for an agent with any `category === 'institutional'` rule the window contains ⌈(held+bench)/10⌉ sequential Firestore batches plus one aggregate read (`agentEvalPromptAssembly.js:891-921`). Arming the timer after `promptBuilt` would give the call its full 22 s — also fence-free, also not this session's.
4. **The VWAP floor is very likely inert platform-wide, not just Thursday**, if the EODHD intraday lag documented on May 6 still holds against the June 12 `sessionDate === todayET` gate. One console read of `cronState.intradayMomentum` on any post-June-12 battle settles it (§4.4).
5. **The shadow `evaluations` record carries neither `evalId` nor the entry's `timestamp`** (`:2777-2798`), so it joins to the doc only by `battleId` and order — a forensics gap if a doc is ever lost.
6. **The brief's inputs have drifted from the tree:** the continuation packet is not in the repo (never committed), `api/_utils/gcsCredentials.js` does not exist (GCS reads use the `GCS_CREDENTIALS` JSON env), and the comment at `file-directive.js:157` cites `chat.js:409` for the chip gate, which now sits at `chat.js:476` / `:897`.
7. **Two `battleViewCopy` render paths for Heard** (`heardLine` on cards, `thisTurnHeardLine` on the strip) are both presence-gated — nothing to fix; noted so Monday's reader knows the strip goes quiet on a non-`filed` receipt by design (`battleViewCopy.js:656-658`).

**STOP.** Nothing further is built from this branch; a discovery branch is never merged on its own.
