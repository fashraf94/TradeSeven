# Three unit bugs (D-120 + screener unit) — cumulative build review (BUILD_RULES §2)

**Date:** September 9, 2026
**Branch:** `claude/exciting-maxwell-040mvv` · **Base:** `origin/main` @ `73a785b8` · **Reviewed at:** `250bdeed`
**Diff at review:** 10 files, +604 / −74 — **over the file threshold** (≥10 files); under the line threshold.
**Diff after fixes:** 15 files, ~+950 / −105.
**Build:** Opus. **Review:** three subagent lenses, one `git archive` snapshot each, coordinator-adjudicated and coordinator-refuted.
**Full suite after fixes:** 651 files / 12,266 tests green (3 files, 64 tests skipped). **`vite build`:** clean.

---

## 0. Executive verdict

| | |
|---|---|
| Findings raised | **28** across three lenses |
| **CONFIRMED and fixed** | **14** |
| **CONFIRMED, recorded, not fixed** | **7** (§4 — each with its reason) |
| **REFUTED / downgraded** | **2** |
| Clean categories reported | 20+, listed by each lens |
| Mutation checks | 4 before review, **7 after** — 2 of which exposed unguarded fixes |
| Verdict | **The review's central result is that the first commit's headline guard did not work.** It suppressed nothing on any document the cron actually writes. Two independent lenses reproduced the bearish sentence still reaching the prompt. It is fixed, and the fixture that would have caught it is now in the battery. |

**The one thing to read if you read nothing else.** Commit 1 guarded the trend sentence with `typeof factors.aboveSMA50 === 'boolean'`. But `computeTechnicalScore` writes `technicals.sma50 !== null && price > sma50` — so a **missing** 50-day average is persisted as the boolean `false`, indistinguishable by type from a measured "below". The guard passed for every real document. A thin-history symbol still published **"Downtrend. Below major SMAs."** — a bearish claim about two averages that do not exist. The commit message said the defect was closed. It was not. The claim now binds to the *readings* (`factors.sma20/50/200`, which **are** stored null-honestly), and the same correction was applied to the bench writer, which turned out to carry the identical defect rather than being the honest template commit 1 assumed.

---

## 1. Method

Per BUILD_RULES §2 and the Sep 2 2026 reviewer-isolation ruling — applying the correction the Sep 9 Phase C review recorded as its own methodology failure: **one `git archive` extraction per lens, into path-distinct directories**, `node_modules` symlinked, every lens read-only on git and on the shared working tree.

| Lens | Dimension | Snapshot |
|---|---|---|
| A | Domain correctness and arithmetic — the minimums, the window, the units | `revA` |
| B | Wiring, lifecycle, blast radius — Firestore, callers, cache, import guards | `revB` |
| C | Prompt/render parity, §9 display-agreement, fence contact, citation honesty | `revC` |

**Refutation was done by the coordinator, not by a fourth lens.** Every load-bearing finding was re-derived from scratch by running the *real* `computeTechnicalScore` → `buildPortfolioBriefs` → `buildPortfolioBriefsBlock` chain and printing the rendered prompt. Two findings did not survive that pass (§5). This is a deviation from the precedent's separate-refuter pattern and is recorded as such: the refutations here are the coordinator's, executed rather than reasoned.

**Mutation checks were run twice** — before the review (4, all caught) and again after the fixes (7). The second round is why this section matters: **two of the review fixes were themselves unguarded**, and one turned out not to be a fix at all (§3, F-11).

---

## 2. CONFIRMED and fixed

| # | Finding | Raised by | Fix |
|---|---|---|---|
| F-1 | **The SMA guard was inert.** `typeof === 'boolean'` passes for every persisted document, because a missing average is stored as `false` (`indexIntelligence.js:288-290`). Thin-history symbols still published "Downtrend. Below major SMAs." | A, B (independently) | `smaRead(flag, value)` — one shared helper, gates on the flag **and** the average. All three readings required, since all four sentences make claims about the whole 20/50/200 stack. |
| F-2 | **The bench writer had the same defect.** Commit 1 called it the honest template and claimed parity with it. It only ever guarded the missing-*document* case. | Coordinator (during F-1 refutation) | Same `smaRead` gate, same helper. The two writers now genuinely agree — asserted at three history lengths. |
| F-3 | **`rsPercentile: 50` fabricated.** `factors.rsPercentile ?? 50` published "RS 50th %ile" into the prompt for symbols with no technical-score document. Bench wrote `null`. | A, C | Null-honest, matching bench. The `?? 50` default is deleted — both its readers now ride the raw value. |
| F-4 | **"Volume subdued." off a defaulted score.** `volumeConfirmation` seeds at 6 and is only replaced when ≥20 rows exist; `6 < 8` took the else-branch. | B | Volume speaks only at the two ends the scorer reaches from real data (12/9, 3). The ambiguous middle says nothing — as the RSI phrase already did. |
| F-5 | **`debate.js` omitted the block but not the instruction to cite indicators.** The schema requires `citedIndicators`; the route returns it unfiltered; `DebateModal` renders each string as a chip. A prompt with no readings and no explanation invites fabrication. | A (note), B | `composeTechnicalsBlock` states the absence out loud — a statement about *availability*, never a value. |
| F-6 | **Scout alerts printed the literal `'ATR percentile N/A.'`** and `Composite score N/A` — the exact placeholder this arc removes everywhere else, in the file the branch edited. | C | Absent reading ⇒ absent clause. The test that pinned `'ATR percentile N/A.'` pinned the defect and is rewritten. |
| F-7 | **Scout alerts called unmeasured symbols "RS neutral or weak."** off the same `?? 50`. | C | Gated on the raw reading, as the MACD clause beside it already was. |
| F-8 | **The widening moves RSI and EMA, not just the nulls.** Both seed on the oldest bars and smooth forward, so output depends on series length. Measured: up to ~10 RSI points on identical recent prices, crossing the 30/70 zone boundary in both directions. This falsified the cache-key comment's "computed off them are simply null". | A, B | Comment corrected at the code; **disclosed in the handover** as a pre-deploy note, including that it lands in persisted research cards that are re-read days later. |
| F-9 | **"One TTL cycle" was wrong.** `SYMBOL_technicals` is a second unversioned document, refreshed independently — a `fields:['daily']` request refreshes one and not the other. | A, B | Both limits written at the cache-key comment and in the handover. |
| F-10 | **The parity test could not fail under the defect it named.** It fed `buildPortfolioBriefs` output into *both renderers*; `buildBenchBriefs` was never called. | C | Rewritten to call both **writers** at three history lengths, then both renderers. |
| F-11 | **A review fix that was not a fix.** The added `factors.macdAboveSignal != null` condition on the MACD phrase cannot change behaviour: `macdScore` leaves its default of 6 only inside `if (macd && …)`, so a banded 8+/4− already implies MACD was computed. | Coordinator (mutation round 2) | **Kept, relabelled honestly** as belt-and-braces against a future change to that default, with the comment stating plainly that nothing pins it because no input can tell the two versions apart. |
| F-12 | **Fixtures modelled a document the cron never writes.** `fullTechScore` and the new battery's `FULL_TECH` carried the SMA flags without the averages, and without `macdAboveSignal`. That is why F-1 passed CI. | Coordinator | Fixtures now carry what `indexIntelligence.js:392-394, :400` writes; the battery builds its thin-history case from the **real scorer**, not by hand. |
| F-13 | **Midnight-boundary flake** in the new URL row — `expected` was a second `new Date()` taken after the awaited call. | B | Clock frozen with `vi.setSystemTime`; the expected date is now literal. |
| F-14 | **Stale docs and figures.** The 20260908 discovery still said "30 calendar days" with two drifted anchors; the 20260909 verdict table still listed the fetch widening as undone; the cost figures were internally inconsistent (21 × 110 B ≠ 2.6 KB); `researchCard.js:115` had drifted to `:119`; the new SCREENABLE FIELDS wording introduced "squeeze" while the UNAVAILABLE list 24 lines later still calls squeeze flags unavailable; `screenStocks.test.js` still modelled `bBandwidthPercentile` as 0–1. | B, C, A | All corrected. Figures restated at ~110 B/row (2.3 KB → 6.8 KB) and the 239-document batch read added. |

---

## 3. Fence statement

**No §1-fenced file was edited.** No fenced function was newly called.

**One disclosure, per the §1 EXA precedent.** `decide.js` (fenced) reads the whole `voiceLayerCache` document and passes it as `marketSnapshot` into `buildFirstMessagePrompt` → `buildPortfolioBriefsBlock`. The brief-shape change therefore alters prompt text assembled *inside* a fenced file, without editing it. Lens C traced the path and found no behaviour break; `agentPromptAssembly.js` and `agentEvalPromptAssembly.js` never reach `voiceLayerPrompt`. Recorded here because the EXA ruling treats "changes what reaches the fenced assemblers" as fence contact regardless of which surface motivates it.

The 30→90 widening does **not** reach the scoring engine or the `createAgentBattle` shape: every fenced or cron consumer of `daily` reads the newest end only (`decide.js:1053`, `agentSwapExecution.js:144`, `compute-institutional-intelligence.js:218`), so appending older rows is inert for all of them, and `compute-index-intelligence.js` does not call `getStockAnalysisData` at all.

---

## 4. CONFIRMED, recorded, NOT fixed — filed for separate tasking (BUILD_RULES §3)

1. **Null closes coerce to `0`, producing finite wrong indicators.** `marketDataCache.js` maps `close: d.adjusted_close || d.close` with no numeric validation; `null` then coerces to `0` in the arithmetic, so a suspended session yields a plausible but wrong SMA and MACD that every `num()` guard accepts. Pre-existing; the widening triples the rows that must be clean. (`undefined` correctly yields NaN and is rejected.)
2. **`Above SMA20/50` compares an unadjusted live quote to a dividend-adjusted average.** Pre-existing for SMA20; SMA50 is new output from this branch. A 90-day window almost always contains a quarterly ex-date where a 30-day one did not, so the average lands ~0.3–1% low. The repo documents this hazard and added `rawClose` for exactly it. Changing the indicator basis is out of scope.
3. **§9 "RSI-rounds-before-zoning" in the calculator.** `calculateRSI` returns `value: Number(rsi.toFixed(2))` but bands `zone` off the unrounded value, so `{ value: 70, zone: 'neutral' }` is reachable. Same shape in `calculateATR`. Named in §9's own family list. The `composeTechnicalSnapshot` docstring's §9 claim has been narrowed to what that function composes.
4. **The widening wakes dormant code.** `seasonEvalContext.js` now carries real `macdLine`/`sma50` into season rules that could never fire; SX-05 additionally has a `null >= null === true` bug that emits SELL labelled "MACD bearish crossover" with no crossover. **Not live** — `season-daily-evaluate.js` is retained un-scheduled (BUILD_RULES §6). `intelligencePrompt.js`'s `histogram > 0 ? 'bullish' : 'bearish'` has the zero-is-bearish defect this branch fixed in `debate.js`, but `buildIntelligencePrompt` has no importers.
5. **L1 cache TTLs are not what they say.** `getFromCache` ignores the written `expiresAt` and uses `getEffectiveTTL`, so a warm container's `daily` entry survives a weekend; `MEMORY_TTL` is dead wherever it disagrees with `SERVER_TTL`; and `setCachedData` writes L1 without `{isCrypto}`, so a crypto entry can receive the closed-market extension it must never get.
6. **`debate.js`'s POSITION DATA line still renders `Entry: $N/A` / `Current: $N/A`.** Same value-shaped-placeholder family, but position identity rather than an indicator, so outside D-120.
7. **`technicalRank ?? 0` vs bench's `?? null`.** A real divergence, currently masked by `buildHeaderLine`'s `!== 0` gate. Left alone rather than changed for no rendering benefit.

---

## 5. REFUTED / downgraded

- **"90 calendar days is only ~64 weekdays."** The comment was *conservative*, not wrong: the inclusive span is 91 days = exactly 13 weeks = **exactly 65 weekdays from every start date in every season**. Downgraded to a wording nit; left as "~64" is now corrected to the stronger fact in the test's own assertion margin.
- **"Exporting `fetchDailyOHLCV` may trip an import-boundary guard."** Refuted by execution: all 216 guard/tripwire tests pass, and none of the registries covers this module. `research.dark.test.js`'s "debate.js is UNTOUCHED" pin also survives — it asserts on the 404 string and three absent symbols, none of which the diff touches.

---

## 6. Verification after fixes

| Check | Result |
|---|---|
| Full suite | **651 files / 12,266 tests green**, 3 files + 64 tests skipped (baseline `origin/main`: 12,238) |
| `vite build` | **Clean** (BUILD_RULES §2 — no test imports `App.jsx`) |
| Mutation checks | **7/7 caught.** SMA `smaRead` gate; volume `<= 3`; `rsPercentile` null; window back to 30; renderer conditionals; `debate.js` MACD default; the no-readings notice. The MACD `macdAboveSignal` condition is deliberately *not* pinned (F-11) and says so in the code. |
| `eslint` on changed files | Back to the repo's pre-existing baseline — only `'process' is not defined`, which every test file in this repo produces |
| Fenced files edited | **None** |
