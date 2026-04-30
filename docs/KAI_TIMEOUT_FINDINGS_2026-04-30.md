# Kai Pulse + ScanMovers Timeout Investigation — Findings

**Date:** 2026-04-30
**Branch:** `claude/investigate-timeout-issues-9TXt2`
**Scope:** Phase 1 read-only discovery. No code changed. Awaiting Flash approval before any fix.

---

## Bottom line

It is **one bug, copy-pasted into two files**, and confidence is very high (~95%).

Both `generate-pulse.js` and `scan-movers.js` make a long sequence of HTTP calls to EODHD's real-time price endpoint, one symbol at a time, waiting for each call to finish before starting the next, with **no timeout on any individual call**. None of the calls run in parallel. There are 54 tracked stock tickers plus 4 indexes, so the worst-case path can require nearly 60 sequential network round-trips before the function does anything else.

That alone is enough to consistently brush against the 60-second Vercel timeout even on a healthy day. If a single EODHD request stalls (slow response, transient packet loss, EODHD rate-limiting, anything), the whole function hangs on that one call until Vercel kills it at 60 seconds — which is exactly the symptom Flash sees in production.

This is **not** a regression from the recent Consensus Layer V2 audit. The audit's writes complete in milliseconds and are visible as the last successful step in Kai's log before the hang. The bug has been present since these two files were first checked in (`a95ebeb`, 2026-04-11). What has changed is how often it fires — likely a combination of EODHD response variability and the universe sitting close enough to the timeout edge that any slow day pushes it over.

---

## Kai pulse — what's slow

The line `"Fetching index prices..."` is logged at line 177 of `api/fantasytimes/generate-pulse.js`. After that line, the function does the following before it ever reaches the Anthropic SDK call:

1. **Sequential index price fetch** — `fetchBatchPrices(INDEX_SYMBOLS)` at line 178. This loops over 4 symbols (SPY, QQQ, DIA, IWM) and `await`s a separate EODHD HTTPS request for each one, one at a time. No timeout, no retry, no parallelization. The helper is defined at lines 81–90.
2. **Sequential stock price fetch** — `fetchBatchPrices(FANTASYTIMES_TICKERS)` at line 183. Same helper, same pattern, but this time over **54 tickers**. So 54 more sequential EODHD round-trips, again with no timeout and no parallelization.
3. **One news fetch** — `fetch(newsUrl)` at line 195, also no timeout.
4. **One Firestore read** for ingested claims at line 256.
5. **The Anthropic SDK call** at line 272 — this is what writes the actual story.

Total external calls before the AI ever runs: **roughly 60** (4 indexes + 54 tickers + 1 news + 1 Firestore). About 59 of those are sequential HTTPS calls to EODHD. At even one second per call (which is realistic for a wide-area API on a slow day), this consumes the entire 60-second window. The Anthropic call never fires because the function is killed first.

That is a clean match for the production timeline:

- t=0.63s: `"Fetching index prices..."` — about to enter the sequential loops
- t=60.0s: TIMEOUT — still in the sequential loops, never reached the Anthropic call

**The single biggest contributor is the 54-ticker stock-price fetch.** Even if every call were a fast 700ms, that loop alone is 38 seconds of pure wall time, with zero room for variability.

There's also a non-obvious redundancy: `getMarketContextBlock()` (called at line 163, completes in ~150ms) already returns SPY/QQQ/DIA/IWM `changePercent` values from a Firestore-cached `indexIntelligence/marketContext` doc. The pulse function then immediately re-fetches those same four indexes live from EODHD. The cached values are even used as a fallback at lines 348–352 (`buildIndexSnap`) when the live fetch misses — so the cache exists and is trusted, it's just not being used as the primary source.

**There is no smoking gun beyond the sequential loops.** No WebSocket subscription, no unbounded Firestore query, no retry-with-backoff masking an underlying failure. The slowness is entirely the naive sequential I/O.

---

## ScanMovers — what's slow

`api/fantasytimes/scan-movers.js` line 76: `for (const symbol of FANTASYTIMES_TICKERS) { ... await fetch(url) ... }`. **The "sequential 54-symbol iteration" hypothesis is confirmed.**

Per symbol the function does:

1. One EODHD real-time fetch — line 79. No timeout.
2. If the move is below the 3% threshold (the common case), continue.
3. If it's above threshold:
   - One Firestore write (`appendCatalyst`) at line 100.
   - One Firestore dedup query at line 114–120.
   - If no existing story, one full `generateAlexMoverStory()` call at line 134 — which itself runs an Anthropic SDK call plus multiple Firestore writes.

Worst case: 54 sequential EODHD fetches + N×(consensus write + dedup query + story generation) where N is the number of detected movers. Even on the all-skip path the user described, the EODHD fetches alone are enough — 54 sequential at ~1s each is the entire timeout window.

The production log Flash captured (MSFT detected at t=32s, NVDA at t=51s) is consistent with this: ~19 seconds between the two detections is roughly the time spent looping through the symbols that sit between them in the universe array, doing one slow fetch each.

There is **no concurrency limit, no `p-limit`, no batched chunks, no `Promise.all`**. There already exists a perfectly good template for the correct pattern in this codebase: `api/_utils/marketDataCache.js` lines 713–748 (`prefetchBatch`) uses `Promise.allSettled` with `CONCURRENCY = 5` and a 200ms inter-batch delay. Neither of the timeout-affected endpoints uses it.

---

## Recent changes that may correlate

`git log` of the suspect files since the project's earliest visible commit shows **none of the price-fetch code has been touched since `a95ebeb` (2026-04-11)**, the commit that introduced these files. The bug has been there since day one of this code path's existence.

Specifically:

- **`api/fantasytimes/generate-pulse.js`** — last modified 2026-04-11 (initial import). No changes since.
- **`api/fantasytimes/scan-movers.js`** — last modified 2026-04-11 (initial import). No changes since.
- **`api/_utils/fantasyTimesTickers.js`** — last modified 2026-04-11. The 54-ticker list has not changed.
- **`api/_utils/indexRegistry.js`** — last modified 2026-04-11. Still 4 indexes.
- **`api/_utils/fantasyTimesConsensus.js`** — touched in PR #349 (the audit), but only added attribution checks; the audit's writes are visible as the LAST successful step in Kai's log, not the cause.

Other recent FantasyTimes-adjacent commits worth noting:

- `e32786a` (2026-04-29) — Flash added 7 tickers (CRWD, PANW, ZS, NVO, HUM, DG, DLTR), but to `rankingConfig.js`, **not** to `fantasyTimesTickers.js`. Doesn't explain the timeouts.
- `e1d93b1`, `7668867`, `f87fd4b`, `541a9e5`, `ad71abd` (2026-04-29, Consensus V2 audit work) — all on consensus paths the timeouts are upstream of.
- `98cd2a3` (2026-04-16) — fixed an unrelated `await` bug in `poll-batch.js` (earnings batches). Different file, different problem.

So the answer to "did anything land in the last ~30 days that introduced the slow call" is **no**. The code path has always been this slow; the symptoms have likely become more frequent because EODHD response times vary, and the function has been operating right at the edge of the 60-second budget the whole time.

This also matches Flash's recollection that Kai "used to ship but was sometimes late." On a fast EODHD day the loop finishes in 40–50 seconds and the story ships late. On a slow day the loop blows past 60 seconds and the function dies with no story written. Same root cause, two visible failure modes.

---

## Vercel config check

- `vercel.json` does **not** override `maxDuration` or `runtime` for either endpoint.
- Both endpoints set `export const config = { maxDuration: 60 }` in code (`generate-pulse.js` line 22, `scan-movers.js` line 14). That is the timeout we see in production.
- Neither uses the Edge runtime, so they run on the standard Node.js serverless runtime — appropriate for the Anthropic SDK and the rest of the workload.
- Vercel Pro allows up to 300 seconds. Raising the limit is **possible but not the right fix on its own**. A correctly written version of these endpoints should finish well under 30 seconds. The right move is to fix the code; raising `maxDuration` could be a stopgap if Flash wants belt-and-suspenders, but should not be the only change.

The cron schedules themselves are reasonable and not part of the problem.

---

## Recommended fixes (prioritized)

### 1. Parallelize the price fetches in `generate-pulse.js` (highest impact, smallest change)

Replace the sequential `fetchBatchPrices` loop with a `Promise.allSettled` over the symbol list, plus a per-call timeout via `AbortController`. Same input, same output shape, dramatically faster. Concretely:

- Wrap each `fetchRealTimePrice` call with a 5-second `AbortController` so a single hung connection cannot poison the batch.
- Run all 4 index calls in parallel — finishes in roughly the slowest single call instead of the sum of four.
- Run the 54 ticker calls with a small concurrency cap (5 or 10) using the same chunked-`Promise.all` pattern that `marketDataCache.prefetchBatch` already uses. EODHD's All-In-One plan handles this comfortably and there's existing precedent in the codebase for this exact concurrency.

Expected wall time after fix: index fetch under 2 seconds, ticker fetch under 10 seconds, total function under 20 seconds even on a slow day.

### 2. Same fix for `scan-movers.js`

Convert the `for (const symbol of FANTASYTIMES_TICKERS)` loop into a chunked-`Promise.allSettled` with concurrency 5 or 10, and add an `AbortController` 5-second timeout on the EODHD fetch. The mover-detection branch (consensus write + dedup + Alex story) can stay sequential per detected mover — those are rare enough that they don't blow the budget, and serializing the Alex story generation avoids hammering Anthropic with parallel calls.

### 3. Use the cached index prices in Kai pulse — **NOT APPLIED THIS SESSION**

`getMarketContextBlock()` returns cached SPY/QQQ/DIA/IWM data from Firestore. On paper this could replace the live index fetch in Kai. **In practice the cache is too stale to use as the primary index price source.**

The only writer to `indexIntelligence/marketContext` that populates SPY/QQQ/DIA/IWM is the `compute-index-intelligence` cron, scheduled in `vercel.json` as `30 10,11 * * 1-5` (UTC). That's 6:30 AM and 7:30 AM ET during EDT. The cron runs twice in pre-market and never refreshes during market hours.

Effective staleness when Kai reads the cache:

- **Pre-market pulse** (cron path `?period=pre_market`, ~9:30/10:30 AM ET): cache is 2–3 hours old. Borderline acceptable for a pre-market summary.
- **Midday pulse** (~12:00/1:00 PM ET): cache is 4–6 hours old. The cached `changePercent` values reflect pre-market state, not current intraday action. Using these would silently feed Kai wrong numbers.
- **Post-close pulse** (~4:15/5:15 PM ET): cache is 8–10 hours old. Useless for an end-of-day pulse.

Cache staleness is therefore **unbounded for the use case** — well beyond the 60-second freshness window we'd want before reading it as primary source. Flash's instruction was to skip Fix 3 in this scenario and flag it separately.

**Flagged for a separate session:** decide between (a) tightening the `compute-index-intelligence` cron to refresh `marketContext` every 5–15 minutes during market hours, or (b) leaving the cache as-is and accepting that Kai's index prices must come from a live fetch. After Fix 1 lands, the live-fetch path takes under 2 seconds in parallel — small enough that the cache may not be worth the trouble.

### 4. Add timing log lines

After fixes 1 and 2, instrument the pulse and scan paths with `console.log` timing markers (e.g., `[KAI:TIMING] Index fetch took 1340ms`) so the next production run lets us confirm in Vercel logs that the fix actually reduced wall time, and so that any future regression is immediately visible.

### 5. Stop-gap only if Flash wants extra safety: raise `maxDuration` to 120s

Only as a belt-and-suspenders measure, never as a substitute for fixes 1 and 2. If raised, it should be paired with the parallelization work, not used alone — a correct implementation should never need it.

**No other fixes recommended.** The Anthropic call, the consensus writes, the Firestore queries, and the news fetch are all individually fine.

---

## Confidence and caveats

**High confidence (~95%):**

- The sequential price-fetch loops are the primary cause of the timeouts in both endpoints. The math (54+ sequential network calls in a 60-second budget with no per-call timeout) is sufficient on its own, and the production timeline matches it exactly.
- The Consensus V2 audit work is not the cause. The audit's writes are visible as the last successful log line before the hang.
- No recent code changes introduced this — the bug has been present since file creation.

**Lower confidence (would need runtime profiling to nail down):**

- I cannot tell from static analysis what the *current* average EODHD response time is for these endpoints. It could be 400ms (in which case the function usually finishes in 30s and just occasionally times out) or 900ms (in which case it's regularly at the edge). Either way the fix is the same.
- I cannot rule out a contributing minor factor — e.g., a slow Firestore region, an EODHD rate-limit-induced backoff inside their gateway. But none of those would be the *primary* cause; they would just amplify the existing fragility.

**What I am not claiming:**

- I am not saying the fix is complicated. It's a small, well-bounded refactor in two files using a pattern (`Promise.allSettled` + chunked concurrency) that already exists in this codebase.
- I am not saying the timeouts are intermittent because of network luck alone. The code path is structurally fragile; intermittent EODHD slowness is just the trigger.

---

## Out-of-scope findings

These are real but unrelated to the timeout investigation. Flagging them so they don't get lost; do **not** fix them in this branch.

1. **`scan-movers.js` line 40, `getStartOfTodayET`** — the timezone-offset arithmetic looks suspect. It computes a string twice and subtracts to get an offset, which can drift around DST transitions. Not a timeout cause, but worth a separate look. Today (2026-04-30) is not a DST boundary, so this isn't currently affecting Kai.
2. **`generate-pulse.js` line 195, news fetch** — also has no timeout. Smaller blast radius (only one call), but consistent with the same pattern.
3. **EODHD news endpoint URL on line 194** — uses the global news feed, not symbol-filtered. Functionally fine, just noting.
4. **`fantasyTimesTickers.js` ticker count is hardcoded at 54** — there's no guard against this list growing past a sensible parallel-fetch budget. After the parallelization fix, even doubling this would be safe; before it, every ticker added makes the timeout more likely.

None of the above should block the timeout fix.

---

## What happens next

Awaiting Flash review of this report. Phase 2 will apply only the fixes Flash approves, on this same branch, one commit per logical fix. Phase 3 verifies in production that timing logs show reasonable wall time and that no `FUNCTION_INVOCATION_TIMEOUT` 504s recur on these endpoints.
