# EODHD Quick Wins — build review record (BUILD_RULES §2)

**Branch:** `perf/eodhd-quick-wins`, cut from `origin/main` `6cef568677c3145b5b68394e4795fb5dbf3502b1`.
**Reviewed commits:**
- the lenses read `8c5f56b8`, the build as first committed;
- the verifiers read `8c5f56b8` or `cfe281cc`, the latter being the build plus the guard reconciliation;
- the mutation lens read `8aa973ff`, the head after the review fixes.

**Build report:** `docs/audits/20261007_BUILD_EODHD_QUICK_WINS.md`.
**Date:** 2026-10-07. **Coordinator:** Claude Code (Opus 5.5).

The rule required this review: the branch changes 29 files (3,983 insertions, 158 deletions, the two audit records included), past the threshold of 10 files or 1,500 lines.

---

## Verdict

| | |
|---|---|
| Lenses run | 5. Four were read-only: QW-1 correctness, QW-4 route and client, QW-6/QW-7 crons, and flag-off/hygiene/flip readiness. The fifth was the mutation lens (21 named mutants, all killed; 8 extra probes). |
| Independent verifiers | 4, one per read-only lens. Each was told to **refute** every finding with a concrete repro. |
| Findings raised | 26: E1-1 … E4-7 (24) from the read-only lenses, plus E5-1 and E5-2 from the mutation lens. |
| **CONFIRMED** | 25. Two severities were raised (E2-1 MEDIUM → HIGH, E2-5 LOW → MEDIUM) and one was lowered (E3-3 MEDIUM → LOW). E5-1 and E5-2 were confirmed by coordinator mutation re-runs. |
| **REFUTED** | 1 finding, E4-6, and one premise, the "baseline unchanged" claim inside E2-5 (that finding itself is CONFIRMED). |
| Duplicates | 3 (E4-1 = E3-2 is the same failure as E4-2's scan, E4-3 = E2-2, E4-5 = E3-4). Each is counted once under its first id in the tables below. |
| Fixed in code | Every CONFIRMED finding that a code change can close, including E5-1 and E5-2. See the tables. |
| Left to the founder | E2-5, E3-3, the QW-1 residual (EV1) and the QW-6 residual (E3-5 / EV3). **Ruled 2026-10-07: all four accepted as-is.** E2-5's option (c) is carried forward as Price Authority PA-8 and was not built. See §5. |
| Isolation | Each reviewer worked in its own LF `git archive` tree under the session scratchpad, with `node_modules` linked as a junction. Every tree was read-only on git and on the shared checkout. The mutation lens ran last, on its own tree. |

The two HIGH findings that reached CI (E3-2 / E4-1 / E4-2) were the two repo guards. The first Linux suite run had already caught them, and `cfe281cc` fixed them before any verifier ran.

---

## 1. Lens E1 — QW-1 (the evaluator's daily-series cache). Verifier EV1.

| id | sev (final) | finding | verdict | disposition |
|---|---|---|---|---|
| E1-1 | MEDIUM | The currency rule checked only the date of `daily[0]`, never its values. A vendor correction, or a glitched `/eod/` read stored by any `_daily` writer, stayed for up to 4 h. Guard 2 then substituted a different, scored badge baseline than the forced path. Repros R1 (corrected close) and R2 (glitched close) were executed. EV1 added a spinoff-shaped probe: EODHD back-adjusts raw closes for spinoffs (`docs/discovery/SESSION5_6_PHASE_B_REPORT.md:209`). | CONFIRMED | **Fixed.** A cache-served series is kept only if its newest raw close **exactly** equals the live quote's `previousClose` (`marketDataCache.js` `priorCloseAgrees`, `PRIOR_CLOSE_AGREEMENT_TOLERANCE = 0`). Otherwise it is re-fetched. Exact agreement makes Guard 2's error zero, so a served series can never make Guard 2 fire, whatever the `baseATR`. EV1 noted that `agent-evaluate` derives some `baseATR` values from `atrPercentile × 8`, which can fall well below 1%, so a non-zero tolerance would not carry the guarantee. Rows R1, R2, null raw close, missing `previousClose`, failed re-fetch, exact-vs-rounding. **Residual → §5.** |
| E1-2 | LOW | "Never serve a refused series stale" was tested for one refusal reason only. A mutant restoring the stale fallback survived. | CONFIRMED | **Fixed.** Rows for TTL-stale + 503, today-dated + 503, and closed session + 503. The wiring-only row in `agent-evaluate.qw1.test.js` was renamed to say what it proves. |
| E1-3 | NIT | Promotion into the in-memory (L1) cache restarts its 5-minute clock, so a doc can be served about 4 h 05 min after it was written. `isMarketOpen` is read twice (the race is unreachable). | CONFIRMED | **Documented** in the policy doc block (`marketDataCache.js`, "Stated bounds"). |
| E1-4 | NIT | The build report cited in the code did not exist yet at the reviewed commit. | CONFIRMED | **Fixed:** the report is committed on the branch. |

EV1 also checked and found sound:
- flag-off identity, through `sessionPolicy`, which is false under `forceRefresh`;
- the end state of the quote-failure re-fetch;
- Guard 2's bar selection under the policy;
- the 4 h TTL;
- every other `_daily` writer, none of which changed.

## 2. Lens E2 — QW-4 (the shared popular-list route and its client). Verifier EV2.

| id | sev (final) | finding | verdict | disposition |
|---|---|---|---|---|
| E2-1 | **HIGH** (raised) | Off hours, the last in-session snapshot (written at most 60 s before the close, carrying prices about 15–20 minutes stale) was frozen for every tab, new tabs included, until about midnight. On weekends it stayed frozen until Sunday. An empty or partial list froze too. EV2 raised the severity: the popular-list price **is** a scored entry price in the classic battle flow (`App.jsx` builder → `handleCreateBattle` → `BattleViewScreen.jsx:156/163`). | CONFIRMED | **Fixed.** Off hours, a stock list freezes only if it is **complete** and was written at least `POPULAR_CLOSE_SETTLE_MS` (30 min) after the most recent session close. Anything else keeps the plain 60 s. `cachedAt` is stamped at the **start** of the fetch. Rows cover a write in session read after the close, the settle window, partial, empty and early-close cases. |
| E2-2 | MEDIUM | A flag rollback or a deploy skew sends a flag-on bundle a 404, and it shows configured fallback prices until reload. | CONFIRMED | **Fixed.** `getPopularMarketData` returns `null` on a 404, and the loader runs the per-symbol path for that poll. Row added. |
| E2-3 | MEDIUM | Firestore became a new hard dependency that did not fail open. A write error discarded paid data. | CONFIRMED | **Fixed.** No handle, a read or transaction error, or a lease still busy after the wait → a direct, uncached fetch. A write error still serves the fetched data. Rows added. |
| E2-4 | LOW | There was no vendor timeout and the write was unfenced. A fetch slower than the lease led to a second paid fetch, and the older data then overwrote the newer. | CONFIRMED | **Fixed.** The vendor fetch is aborted at 10 s, below the 15 s lease. The write lands only inside a transaction that still sees this request as the lease owner. Rows for the timeout and the takeover. |
| E2-5 | MEDIUM (raised) | With the flag on, the battle screens, the classic join (`getStockPrice`) and `capturePreviousClosePrices` lose the per-tab entries the App poll used to seed, so part of the saving comes back. EV2 **refuted** the claim that the baseline is unchanged. Repro: a healthy vendor stores a starting price of 101 against 100 today. A vendor down at join time stores AAPL's configured fallback (240) as both the starting price **and** the previous-close baseline. | CONFIRMED (premise refuted) | **Founder decision → §5: accepted as-is (2026-10-07); option (c) carried forward as PA-8.** This follows directly from the ruling "the new path must NOT write the per-tab price cache". |
| E2-6 | LOW | Test gaps: the fake accepted `undefined` (EV2 mutated out the JSON round trip and the QW-4 suites stayed green). There were no settle, empty, 404, fail-open or timeout rows. | CONFIRMED | **Fixed.** A strict-fake row (the Admin SDK rejects `undefined`) plus every row listed above. |

## 3. Lens E3 — QW-6 and QW-7 (the crons). Verifier EV3.

| id | sev (final) | finding | verdict | disposition |
|---|---|---|---|---|
| E3-1 | HIGH | The history store served the pre-market series for the whole ET date, including after the close. On early-close days, and at the 20:00Z wake in EDT, a fresh fetch can already carry the day's bar, so flag-on output differed from flag-off. A repro produced 18 of 19 docs different. EV3's matrix of publish time × wake time confirmed it. | CONFIRMED | **Fixed.** The store is skipped once `Date.now() ≥ getSessionForDate(etToday).closeMs`. The harness's early-close row now gives flag-on = flag-off. EV3's hardening is also applied: `.INDX` symbols (TNX, on bond-market hours) are never stored, and a date with no session record fails closed. All rows are mutation-checked. |
| E3-2 | HIGH | The protected-store scan reddened CI at `8c5f56b8`. | CONFIRMED | **Fixed** in `cfe281cc`: literal collection names. Later, EV4 had the lease helpers' parameter renamed so the scan registers them honestly. Three transaction writes are allowlisted with a reviewed note. |
| E3-3 | LOW (lowered) | With the flag on and zero books, a slot's first fire skips the snapshot. A first book created between two fires of that slot then evaluates against a later snapshot. | CONFIRMED | **Founder decision → §5: accepted as-is (2026-10-07).** EV3: the base itself produces this outcome whenever a slot's first build fails. |
| E3-4 | LOW | The gate's open-batch probe had no try/catch: a Firestore error meant a 500, and the close sweep then skipped retention. | CONFIRMED | **Fixed.** The probe fails safe (it builds as before). Rows for both sweeps. |
| E3-5 | LOW (hunch) | A stored history had no age cap within the date, so a vendor restatement was not seen that session. | CONFIRMED (hunch) | **Mitigated.** A 4 h cap, the QW-1 rule's TTL, which the ruling attaches to QW-6. Intraday stored bars must also match the live `previousClose`. **Residual → §5.** |
| E3-6 | LOW | Test gaps: a time-invariant vendor stub, no operation counter in the QW-7 tests, `direct` transport only, no probe-failure row. | CONFIRMED | **Fixed.** A time-aware vendor (the E3-1 row), operation-order parity for one book on both sweeps, a batch-transport row, probe-failure rows. EV3 also proved flag-off against the **base** file out of tree, for both crons (URLs, logs, writes identical). |
| E3-7 | NIT | `.doc()` sat outside the try. | CONFIRMED | **Fixed:** the ref is built inside the try. A throw skips both the read and the write. |

E3 and EV3 also confirmed that the coordinator was right **not** to build QW-6 bullet 3, the holiday gate. Holiday `stockRankings`, `marketContext` and `stockTechnicalScores` are read on holidays by `live-draft-fire`, the tournament draft and board paths, and `decide.js`.

## 4. Lens E4 — flag-off guarantee, hygiene, flip readiness. Verifier EV4.

| id | sev (final) | finding | verdict | disposition |
|---|---|---|---|---|
| E4-1 | HIGH | The `indexIntelligenceHygiene` A-0 pin (`const ohlcv = rows.reverse();`) reddened CI at `8c5f56b8`. | CONFIRMED | **Fixed** in `cfe281cc`. |
| E4-2 | HIGH | The scan reddened CI (the same failure as E3-2). | CONFIRMED | **Fixed** (as E3-2). EV4 also found that the allowlist note described the wrong mechanism. The note is rewritten, and two constants that had become dead are removed. |
| E4-3 | MEDIUM | Rollback → 404 → fallbacks (the same as E2-2). | CONFIRMED | **Fixed** (as E2-2). |
| E4-4 | LOW | `App.xpModal.jsdom.test.jsx`'s `stockAPI` stub lacks `getPopularMarketData`, so after the flip that test silently runs App's error path. A test header was also false. | CONFIRMED | **Fixed:** stub method added and header corrected. |
| E4-5 | LOW | The QW-7 probe is not fail-safe (the same as E3-4). | CONFIRMED | **Fixed** (as E3-4). |
| E4-6 | NIT | The dark route runs the middleware and the method check before the flag check. | **REFUTED** | EV4: this is the repo's dark-route pattern (`api/mandate/escape.js`, `api/research/correlation.js`, `api/backing/results.js`). Nothing reads before the flag check. A reorder made during the fixes was **reverted**. |
| E4-7 | NIT | The report did not exist yet; the docstring named an unused function; one test comment contradicted itself. | CONFIRMED | **Fixed:** report committed, docstring names `dailySeriesCurrency` + `priorCloseAgrees` (the unused export is deleted), comment corrected. |

E4 also verified:
- flag-off byte-identity across every changed file;
- the CI lint gate;
- `vite build`;
- native ESM loading of all changed `api/` modules;
- that the flip is a clean one-commit change: with the flag on, the full suite fails only the three flip-map rows, and a coordinator run in WSL confirmed it.

## 5. Decisions left to the founder

**Ruled (Fable and Flash, 2026-10-07): all four accepted as-is; nothing below was built.** E2-5's option (c), baseline captures rejecting `isFallback` records, is recorded as the Price Authority carry-forward **PA-8** in the build report §8.

1. **E2-5: the per-tab-cache ruling moves classic-battle baselines.**
   - With the flag on, a classic join, or a previous-close capture taken after the App poll, fetches its own quote.
   - Normally that quote is fresher, so the stored starting price differs from today's.
   - In a vendor outage at join time, it is the configured fallback constant. Today that hazard exists only for symbols that are not cached.
   - Options:
     - (a) accept it;
     - (b) let the flag-on path seed the per-tab cache with a TTL shortened by the shared copy's age, which keeps today's envelope;
     - (c) a separate fix: make baseline captures reject `isFallback` records. That also changes flag-off behaviour.
2. **E3-3: QW-7 and a mid-slot first book.**
   - It happens only on a zero → one transition, through founder-gated creation.
   - Remedy: create the first book outside a slot or close window, or accept it.
3. **QW-1 residual (EV1).**
   - Suppose the vendor rewrites an already-published prior-session raw close after the cache write, so that it no longer matches its own live `previousClose`, as a spinoff back-adjustment could.
   - Then a forced refresh would act on the rewrite while the served copy does not, until the 4 h TTL expires.
   - It cannot be closed without fetching `/eod/`. Option: a shorter maximum served age.
   - The QW1 `prev_close_mismatch` log line makes the overall mismatch rate observable after the flip.
4. **QW-6 residual (E3-5 / EV3).**
   - A split or dividend re-adjustment of `adjusted_close` applied mid-session is seen within 4 h, not within the hour.
   - The vendor assumption "no today-dated bar before the NYSE close" is stated in the report. TNX is excluded from the store for exactly that reason.

## 6. Mutation checks (lens E5, on `8aa973ff`, plus coordinator runs on later commits)

_E5's table is below. The coordinator separately mutation-checked the later commits:_
- `c6e09574`, the `.INDX` bypass and fail-closed rows: each fails with its hardening removed. The fail-closed row first **survived**: its date (2028-01-03) never reached the case, because `getPreviousSessionDate` already returns null there. It was re-pointed to 2028-01-01, the one date where a session is missing but a prior session exists, and now fails as intended.
- `a53c0cdf`, the literal-dot regex row: fails with the escape removed.

**Lens E5 on `8aa973ff`.** Each mutant was applied in E5's own LF tree, then the 9 QW test files plus `flagPinGuard.test.js` were run. Each file was restored and checked byte-identical by sha256 before the next mutant. Baseline and the final re-run were both 123/123 green.

| # | target | mutation | result: test(s) that failed |
|---|---|---|---|
| M1 | `marketDataCache.js` `dailySeriesCurrency` | always `current: true` (date rule removed) | **KILLED** (7), including **P2**: see below |
| M2 | `marketDataCache.js` post-quote check | `priorCloseAgrees` refetch removed | **KILLED** (6): R1, R2, null raw close, missing `previousClose`, mismatch + failed refetch, exact vs rounding |
| M3 | `marketDataCache.js` policy branch | a TTL-stale copy goes into `staleBackup` | **KILLED**: E1-2 "TTL-stale CURRENT doc + 503" |
| M4 | `marketDataCache.js` `currencyCtx` | `isMarketOpen()` dropped | **KILLED** (2): the 18:00 ET row; E1-2 "closed session + 503" |
| M5 | `marketDataCache.js` post-quote check | no refetch after a failed quote | **KILLED** (2): both quote-failure rows |
| M6 | `agent-evaluate.js` `evaluatorQuoteOptions` | flag-off branch returns the policy | **KILLED** (3): helper row, REAL tick row, source scan |
| M7 | `health.js` | probe runs without `?deep=1` | **KILLED** (3) |
| M8 | `popularMarketCache.js` `tryAcquireLease` | never refuses | **KILLED** (4): **N tabs = 5 and 40**, live-lease waiter, fail-open waiter |
| M9 | `popularMarketCache.js` `fetchOnce` | no JSON round trip | **KILLED**: E2-6a strict-fake row |
| M10 | `popularMarketCache.js` TTL | closed market → always freeze | **KILLED** (4): written in session, settle window, partial, empty |
| M11 | `popularMarketCache.js` fenced write | owner check removed | **KILLED**: "lease taken over mid-fetch does NOT overwrite" |
| M12 | `popularMarketCache.js` `readThrough` | a Firestore error rethrows | **KILLED** (2): E2-3 read-error row, fail-open waiter |
| M13 | `eodhdAPI.js` `getPopularMarketData` | writes each record into `cacheService` | **KILLED** (2): "per-tab price cache is never written" rows |
| M14 | `popularMarketLoader.js` | a null (404) result returns without falling through | **KILLED**: the 404 row |
| M15 | `indexHistoryCache.js` | a served history replays `dropped: 0` | **KILLED** (3): QW-6 pre-market and intraday identity rows (`droppedRows`), unit row |
| M16 | `indexHistoryCache.js` | after-close skip removed | KILLED only by the unit row; **the integration row survived → E5-1** |
| M17 | `indexHistoryCache.js` | 4 h age cap removed | **KILLED** (2): E3-5 row, unit row |
| M18 | `mandate-evaluate.js` `nothingToMark` | open-batch probe removed | **KILLED** (3): open-batch row, both probe rows |
| M19 | `mandate-evaluate.js` close sweep | returns early on zero books | **KILLED**: the retention row |
| M20 | `mandate-evaluate.js` `nothingToMark` | try/catch removed | **KILLED** (2): both probe-failure rows |
| M21 | `featureFlags.js` | flag `true` | **KILLED** (3): the three flip-map rows |

E5 also ran 8 extra probes. Three of them, M3b, X4 and X5, show that every remaining E1-2 and E2-3 row kills a mutant at its own site. X6 surfaced E5-2.

**M1 — the prompt's required red-then-green evidence.** Red, with the date rule removed:
```
FAIL api/_utils/marketDataCache.qw1.test.js > QW-1 P2 — a cached series one session stale must re-fetch (red-then-green) > TTL-fresh but newest bar = 2026-10-05 (one session stale) → one /eod/ re-fetch, the FRESH series is served and written through
AssertionError: expected [] to have a length of 1 but got +0
 ❯ api/_utils/marketDataCache.qw1.test.js:167:24
    167|     expect(eodCalls()).toHaveLength(1);
```
Green: the same row passes on the restored file (26/26). E5 noted the row really tests the date rule. Its stale bar's raw close equals the quote's `previousClose`, so the prior-close check cannot hide a missing date rule.

**E5's two findings, both CONFIRMED by coordinator re-runs and fixed:**

| id | sev | finding | disposition |
|---|---|---|---|
| E5-1 | LOW | The QW-6 early-close row did not isolate the after-close rule. The store was filled at 10:30Z and read at 19:00Z, so the 4 h cap refused it anyway. Fixing that alone still left M16 surviving. The cause was the harness's vendor stub: it derived bar values from a bar's position in the answer, not its date, and it emitted a bar on the NYSE Thanksgiving holiday. The quote's `previousClose` therefore disagreed with the stored bar, and the prior-close check masked the after-close rule. | **Fixed.** The store is now filled at 16:00Z, inside the session and inside the TTL. The stub's bars are a function of the date only, with no bar on NYSE holidays. Coordinator re-run: **M16 now KILLED by the integration row**. M15 and M17 are re-checked and still killed. |
| E5-2 | LOW | The close sweep's page guard (`noBooksToClose ? { docs: [] }`) was untested. Removing it (X6) survived: a book activated between the probe and the page read would be closed against the unbuilt snapshot. | **Fixed.** E5's probe row was adopted: the probe seeds a book, and `closeBook` must not be called. Coordinator re-run: **X6 KILLED**. |

## 7. Process notes

- A scripted edit in `c6e09574` dropped a regex escape (`/.INDX$/i`). The coordinator caught it while collecting citations, fixed it in `a53c0cdf`, pinned it with a row, and swept every regex the branch adds for the same slip. No other was affected.
- Two harness fixtures were made realistic during the fixes:
  - The QW-1 vendor stub's live `previousClose` now equals its own prior-session raw close.
  - The QW-6 harness quotes do the same.
  - The earlier values disagreed with their own bars, which the new agreement check rightly refuses.
- Scratch artifacts from the reviewers live under the session scratchpad: `e1-repro`, `e2-repro`, `e3-repro`, `e4-notes`, `ev1-repro` … `ev4-repro`. None are committed.
