# Review — evaluator capacity, Build 1 (BUILD_RULES §2)

**Date:** 2026-11-15 · **Reviewed:** `c9fe26b2` (lenses PL, DK, GC, OB and their refuters); `29e42a78` (the fix round; lens TI and the battery) · **Build report:** `docs/audits/20261115_BUILD_EVAL_CAPACITY_1.md`

The build's own diff (`187ef495..HEAD`) is over the §2 threshold (21 code and test files, 3,973 lines added and 78 removed — `git diff --stat 187ef495 HEAD`, docs excluded), so the review is multi-lens, adversarial, independently verified, mutation-checked, accompanied by an explicit `vite build`, and written down here.

## 1. Verdict

| | |
|---|---|
| Lenses | 5: PL (pool lifecycle), DK (the dark guarantee), GC (EODHD guard and cuts), OB (observability) — in parallel, read-only — then TI (test integrity, mutating), last, on its own tree |
| Findings | **42**: 27 from PL, DK, GC and OB, every one handed to a refuter — **16 CONFIRMED**, **11 NARROWED**, 0 REFUTED whole, five sub-claims inside narrowed findings refuted with a repro; and 15 from TI, each reproduced by its own surviving mutant (§5) |
| Severity | **1 high** (TI-1, a test gap — no code defect) and **11 medium** (PL-1, GC-1, OB-1; TI-2 to TI-9) — all fixed with a row that fails without the fix |
| Dark guarantee | **No behaviour change found at the shipped values** (DK lens + its refuter; the DK lens re-ran the dark proof independently). Re-run after every fix round, comparing reads too: at `97dff8d8` and again at the final code `adb26651` (after PP-1), 16 cases, 128 comparisons, 0 differences (391 reads) |
| Fence | no contact (GC lens; all four lenses checked their area) |
| Fixed | 37 (code, test or wording: 22 of the first 27 and all 15 TI), plus PP-1 after the review (§3a); 1 disclosed (GC-8); 1 found-not-fixed for the flip PR (GC-9, measured, §6); 3 documented (GC-4, GC-6, PL-5) |
| Mutation | at the final code `adb26651`: **126 / 126 killed** — the builder's 91 (88 + LC1–LC3 for PP-1) and the TI lens's own 35 (§4, §5); at `97dff8d8`, 123 / 123 |

## 2. Method

- **Reviewer isolation (founder ruling Sep 2, 2026).** One `git -c core.autocrlf=false archive` extraction per reviewer and per refuter under the session scratchpad (`review/tree-<name>`, 9 trees), `node_modules` as a junction to the main checkout's. Reviewers and refuters were read-only on git and on the shared working tree; refuters applied their mutants at transform time or in scratch copies; the mutating lens (TI) ran last, on its own tree.
- **Refutation.** Each lens's findings went to a separate refuter told to refute every one with a concrete repro. CONFIRMED = reproduced as stated; NARROWED = true but smaller or different (the refuted part named); REFUTED = not reproduced.
- **Fixes** carry a row that fails without them; each such row has a mutant in the builder's battery (`R1`–`R19`).

## 3. Findings and dispositions

| ID | Sev | Finding (short) | Refuter | Disposition |
|---|---|---|---|---|
| PL-1 | **med** | No row pinned a battle's OWN receipt and OWN capture scope under concurrency: the K=2 "throws" row used a missing document, so its receipt never landed; mutants hoisting `captureScope` or misdirecting the receipt survived all 61 evaluator files | CONFIRMED (four mutants, 1309/1309 green under each) | **Fixed** — row "review PL-1": e1's final write throws while ok1 is in flight (capture on); asserts e1's own `cronErrors` receipt and its own `tick_error` capture record, ok1's `cpu_passive` record. Mutants R1 (finalize the last-started scope), R2 (receipt removed), P18 |
| PL-2 | low | The pure helper: a falsy rejection was swallowed; a throwing start rule could hang the pool if its catch regressed; K 0 / NaN ran nothing | CONFIRMED, latent (unreachable from the handler) | **Fixed** — a `failed` flag; the helper clamps K itself; three rows; mutants R3–R5 |
| PL-3 | low | `idlePoolBlock` unpinned | CONFIRMED | **Fixed** — row (K 1 and K 3, no active battle); mutant R7 |
| PL-4 | low | "Keeps the 300 s kill out of reach" applies K = 1 measurements to K > 1 | NARROWED — 22.1 s still bounds lock→admission at K = 1 (admission precedes the build); unmeasured at K > 1 | **Fixed** — marked ASSUMED at K > 1 in the report and the flag's doc, tied to the guard flip |
| PL-5 | info | K = 1 equals the loop await for await, not microtask for microtask | CONFIRMED (informational; reproduced with a detached chain) | **Wording fixed** (`evalPool.js` header, report §3); the dark proof compares every effect |
| PL-6 | low | A third stale "processed serially" comment, `captureContext.js:24-26` | CONFIRMED | **Fixed** |
| PL-7 | q | `deferredAt` at K > 1 is the first refusal, not the cutoff; the cutoff is unvalidated | NARROWED — (a) REFUTED as a change: `main` stamped at the same decision point; (b) holds only by a source edit | **Fixed** — a malformed cutoff reads as `TIME_BUDGET_MS`; row; mutant R6 |
| DK-1 | low | No committed row ran the REAL SDK through the observer on a failed call | CONFIRMED (coverage and wording; the refuter's real-SDK run found no behaviour defect) | **Fixed** — four real-SDK 0.71.2 rows (200, 429, 500, network error): one request, identical bytes and errors, headers read, 429 counted once, no unhandled rejection; mutant R19; wording fixed |
| DK-2 | low | A tautological flag-off assertion | NARROWED — the options row guarded it indirectly | **Fixed** — a collection recorder; the flag-off row asserts the session store is never opened; mutant R18 |
| DK-3 | low | §8 wording: the K = 2 control differs in 8 of 9 multi-battle cases (`lock_skip` does not discriminate); `empty_run` has no requests | NARROWED (placeholders were expected in the draft) | **Fixed** in the report |
| DK-4 | low | The dark-proof harness recorded writes only | NARROWED — no read was added at the shipped values (the only new read is flag-gated) | **Fixed** — the harness records every read (op, path); re-run 16 / 128 / 0 (391 reads compared) |
| GC-1 | **med** | A check waiting on another check's first `/eod/` had no bound | NARROWED — "the rest of the ET date" REFUTED (Node's fetch gives up after ~300 s; the memo entry is then dropped); what holds: with cuts on and the guard off, one hung `/eod/` stalls that symbol's checks to the 300 s kill | **Fixed** — a 15 s bound; on it the stuck entry is dropped and the check fetches daily+price itself; row; mutants R8, R9 |
| GC-2 | low | A `fallback: true` quote could be shared | NARROWED — the defect is correlation: one failed quote reaches every non-owning battle | **Fixed** — only a usable quote (`isSettlementQuoteUsable`) is shared; row; mutant R10 |
| GC-3 | low | Ownership compared strings: a held `'BTC'` did not own `'BTC-USD.CC'` | CONFIRMED — blast radius `macroPrices.BTC` in the prompt only | **Fixed** — compared by instrument (`eodSymbolOf`); rows; mutant R11 |
| GC-4 | low | The report's reason ("both require the name in `stockRankings`") is wrong: the equipped-ticker union can add a macro to the hot bench mid-check | CONFIRMED | **Report corrected**: the copy can appear in the prompt's hot-bench list on a rebuild tick only (the union persists into `watchlist.hotBench`, so later checks own it); it cannot become a bench asset (`findBenchAsset`, `agent-evaluate.js:5395`, reads the bench built from rankings), so it never reaches the executor or scoring. Founder question 1. **Superseded — the bench-asset part was wrong: §3a, PP-1** |
| GC-5 | low | The crypto UTC-day rows could not fail (every instant 15:00Z) | CONFIRMED (mutant `isCrypto ? etDate : etDate` passed) | **Fixed** — row at 02:00Z (ET 11-16, UTC 11-17); mutant R12 |
| GC-6 | low | With the guard on, queue wait counts against callers' own races; "6 s" should be 5 s | NARROWED — needs K ≥ 2, the guard on and slow EODHD; the outcome is the designed fail-closed skip | **Documented** (report §4); "5 s" corrected |
| GC-7 | low | Past the calendar horizon (2028) the cut stops saving, silently | CONFIRMED | **Fixed** — said once per process; row; mutant R13; report caveat |
| GC-8 | low | The `eodhd` block counts `marketDataCache.js` traffic only | CONFIRMED | **Disclosed** — census, the record's comment, the script's label |
| GC-9 | low | With the guard on, plain-object `fetch` doubles go red (22+ rows in 4 sampled files) | CONFIRMED (production returns real Responses) | **Found, not fixed** — for the flip PR; measured below (§6) |
| OB-1 | **med** | `eodhd.timeouts` could only be 0 with the guard off, read as a measured zero | NARROWED — "the cascade race is never counted" overstated (with the guard on, an orphan still hung at 10 s is counted) | **Fixed** — `timeouts: null` while the guard is off; the script prints "—"; rows; mutants R14, R15 |
| OB-2 | low | A late status lands in the next run's record | NARROWED — under the 15-minute cadence it usually lands in NO record | **Comment and report corrected** |
| OB-3 | low | No real-SDK row at the seam (= DK-1) | CONFIRMED | **Fixed** (DK-1's rows) |
| OB-4 | low | The `finally` close of the window untested | CONFIRMED | **Fixed** — `openRateLimitWindowCount`; handler row after a run and after a market-closed return; mutant R16 |
| OB-5 | low | Overlapping invocations invisible | CONFIRMED | **Fixed** — logged when a window opens beside another; row; mutant R17 |
| OB-6 | low | Report claims: "§6.4"; "20 rows end to end"; "per check" vs 117 units | 2 CONFIRMED, 1 NARROWED (the numerator is requests, not units: a flag-off agent-mode check is ≈ 89 requests) | **Fixed** in the report and the script's label |
| OB-7 | low | 429 counting is complete only because `maxRetries: 0`; unstated | CONFIRMED (with `maxRetries: 2`, a 429 then 200 counts 0) | **Fixed** — stated in the module |

### 3a. After the review — the pre-push trace

Before pushing, an independent consult asked for the trace behind GC-4's "it cannot become a bench asset" (the GC refuter had stopped at `findBenchAsset`). The trace found a flag-on gap. New id prefix `PP` (none of this review's ids reused).

| ID | Sev | Finding | Check | Disposition |
|---|---|---|---|---|
| PP-1 | **med** (flag on only; dark at the shipped values) | With the cuts on, a macro the battle did not own at the fan-out holds the run's copy in `prices`. Two sites add names later in the check and put them on the in-memory bench — the hot-bench rebuild (merged into the bench at `agent-evaluate.js:1866-1872`) and a news catalyst (`:3002`) — and both fetched only a name with no price. A swap into SPY or QQQ listed there would be priced from the run-start quote when the beacon is not fresh (`agentSwapExecution.js:323-331`); the prompt's candidate list would show it too | VERIFIED by reading both sites, the bench merge and the executor's `getPrice`; every other bench change (`:901` removes names; `:2716-2721` re-reads after the executor) adds no unowned name | **Fixed (`adb26651`)** — the fan-out marks the names it gave the run's copy (`sharedQuoteSymbols`), and both sites also fetch a marked name; flag off the set is `null` and both read `!prices[t]` as before. Two rows in `agent-evaluate.marketDataCuts.test.js` (catalyst; rebuild): each fetches SPY in the check once, writes and request identical to flag off. Mutants LC1–LC3 (§4). Report §5.4 corrected |

## 4. The builder's mutation battery

Run on Linux (WSL `~/pd-ci-cap1dp`, `TZ=UTC`) by `scratchpad/mutants/mutate.mjs` from `spec.json`: each mutant's anchors must match **exactly once** (else BROKEN, never a silent skip); applied to a clean tree; its suites run with a JSON report (deleted first); every touched file restored from `git show HEAD:<file>` and the tree checked clean after each. **KILLED** needs a non-zero exit AND at least one failed row.

| Run | Commit | Baselines | Mutants | Verdict |
|---|---|---|---|---|
| 1 (the build) | `2e125db8` | 8 suite groups green | 69 | **69 KILLED** |
| 2 (after the fix round; the record) | `29e42a78` | 8 suite groups green | 88 — the 69 (three re-anchored where the fixes moved their lines: P4, C10, L10) + 19 for the review's rows (R1–R19) | **88 KILLED**, 0 SURVIVED, 0 BROKEN, 0 ERROR |
| 3 (with the TI lens's 35, §5) | `97dff8d8` | 10 suite groups green | 123 | **123 KILLED** |
| 4 (after PP-1; the final code) | `adb26651` | 10 suite groups green (cuts group 45 rows) | 126 — the 123 + LC1 (the rebuild site's condition), LC2 (the catalyst site's), LC3 (the fan-out's mark) | **126 KILLED**, 0 SURVIVED, 0 BROKEN, 0 ERROR — LC1 and LC2 each killed by their own site's row, LC3 by both |

By group (run 2): clamp 4 · cutoff 3 · in-flight cap 1 · deferral 2 · await-all 1 · failure 1 · affinity 4 · stats 1 · capture scope 1 · per-battle catch 1 · timeout 4 · limiter cap 3 · flag-off identity 5 · counters 3 · timeout path 1 · session key 2 · narrow guard 2 · prior bar 1 · fresh fallback 2 · read fail-open 2 · single flight 1 · macro sharing 5 · header parsing 6 · no throw 2 · window 1 · capture on/off 1 · EODHD delta 1 · run record 1 · script 3 · flag pins 4 · review rows 19. Each mutant's id, edit, suites and the first failing rows are in `scratchpad/mutants/run2/results.json` (out of tree).

## 5. Lens TI — test integrity (mutating, last)

The last lens ran on its own tree at `29e42a78` (after the fix round), mutating source files one at a time and restoring each byte for byte (`cmp`-checked). Baseline: the 11 new and edited files, **174 / 174** rows green. It designed **35 mutants not in the builder's spec**: **6 KILLED**, 1 more killed by a pre-existing suite (H2, `stockThresholds.expiry`), 1 ERROR (G6 — an unhandled rejection with no failed row), **27 SURVIVED**. It judged none strictly equivalent (P1, P5 and L3 unreachable or implausible). Its findings — every one a test gap, none a code defect; each is reproduced by its own surviving mutant, so its mutant run doubles as the repro:

| ID | Sev | Gap (surviving mutants) | Disposition — a row, then the lens's mutant re-run |
|---|---|---|---|
| TI-1 | **high** | A cold instance served by the STORE never asserted its bars (C1: the store-served return deleted → the first check per symbol on a cold process loses its bars) | **Fixed** — the cold check's bars and quote asserted |
| TI-2 | med | "Never the stored series" was tested on the memo path only (C2) | **Fixed** — the same row on a cold instance |
| TI-3 | med | The flag-ON block read no counter (G1, G2) — flip 1's own measurement | **Fixed** — guarded requests and non-2xx counted |
| TI-4 | med | The lowest/minimum rule: every fixture value only went down (L1) | **Fixed** — values recover after the low point |
| TI-5 | med | The script: 429 sum vs max, `other`, the denominator, the input limit, and `gather()` never run (S1–S5) | **Fixed** — distinguishing fixtures; `gather()` + `render()` over a read-only fake handle |
| TI-6 | med | Ownership through the CPU book and the hot bench (H3, H4) | **Fixed** — a battle whose opponent holds SPY and whose hot bench lists QQQ fetches both itself; writes identical |
| TI-7 | med | No handler row with the cuts on (H5) | **Fixed** — the handler prices the macros once, all before the first lock |
| TI-8 | med | A hung macro fetch and a hung store write (C7, C8) | **Fixed** — both bounded, under fake timers |
| TI-9 | med | Crypto across the UTC rollover in one process (C4) | **Fixed** — two checks, one ET date, two UTC days → two series |
| TI-10 | low | The 1.5 s row advanced 3 s; the bounds unpinned (C5, C6) | **Fixed** — bound + 2 ms; the four constants pinned |
| TI-11 | low | K = 9 row used `toMatchObject` (H1) | **Fixed** — the whole block |
| TI-12 | low | A failed first fetch remembered (C3) | **Fixed** — 503 then 200 → one write |
| TI-13 | low | FIFO (G3), a 204 (G4), 500 as 5xx (G5), the flag-off rejection arm (G6) | **Fixed** — four rows (G6 now with an `unhandledRejection` listener) |
| TI-14 | low | First error wins (P1), onStop at the refusal (P2), an undefined reason (P5), oversized header (L3) | **Fixed** — rows |
| TI-15 | info | A flip turns rows red that the FLIP MAP did not name (K = 2: 11 evalRun rows; the guard: 2 `timeouts` rows) | **Fixed** — the FLIP MAPs name them (the guard's also names the 38 plain-double rows, §6) |

**The re-run.** The lens's 35 mutants were merged into the builder's spec unchanged (TI-H2 with the `stockThresholds.expiry` suite that killed it) and the whole spec run at `97dff8d8`, after the rows above: **123 mutants, 123 KILLED** — all 35 of the lens's, the 27 that had survived and the one that had errored among them; 10 suite baselines green (the lens's set of 11 files at 189 rows). Results: `scratchpad/mutants/run3/results.json`.

## 6. Found, not fixed

- **GC-9 (flip readiness).** With `EODHD_FETCH_GUARD_ENABLED` on, suites whose `fetch` double returns a plain `{ ok, json }` object take the network-error path (no `arrayBuffer`). The flip PR must move those doubles to real `Response` objects. **Measured** — the full Linux suite at `29e42a78` with only that flag flipped to `true` (WSL, `TZ=UTC`, 8 workers; the file restored from `HEAD` after): **44 rows red in 13 files of 8,213**. Six are the flip's own pins, which the flip PR moves in its commit: `src/config/evalCapacityFlags.test.js` (2), `src/config/flagPinGuard.test.js` (2 — the `DARK_BY_DESIGN` entry and the contradiction), and the `timeouts: null` expectations in `agent-evaluate.evalRun.test.js` (1) and `agent-evaluate.limitsOnRecord.test.js` (1), which become 0. The other **38 rows in 9 files** are plain-object `fetch` doubles: `marketDataCache.test.js` (14), `marketDataCache.realTimePrice.test.js` (9), `decide.invalidQuote.test.js` (4), `dailyRowHygiene.test.js` (4), `shortWindowNullHonesty.test.js` (2), `filmTape/tapeVolume.test.js` (2), `agent-daily-scores.invalidQuote.test.js` (1), `agentEvalPromptAssembly.invalidQuoteBench.test.js` (1), `agentSwapExecution.invalidQuote.test.js` (1). Production `fetch` returns a real `Response`, so none of these is a production defect.
- **Outside this build (reported, not fixed — BUILD_RULES §3):** `captureContext.js:20-27` still describes a registry keyed by battle id that the scope replaced; `agentEvalTransport.js:36` says "serial battle loop" (a file this build may not edit).

## 7. Checks

On Linux (WSL worktree of `~/pd-ci` with its own `npm ci`, lockfile `40382e64edb6` = `main`'s; Node 20.20.2; `TZ=UTC`), at `cf19a89c` — the build with `origin/main` (`ea5e0c5b`, unchanged since the start, re-fetched before the checks) already merged in:

| Check | Result |
|---|---|
| Full suite, `--maxWorkers=8`, under `flock /tmp/pd-suite.lock` | **exit 0 — 1,515 files, 33,791 rows: 33,656 passed, 0 failed, 135 skipped** (328 s). A first run the same hour had one row red: `src/components/League/leagueRawIds.guard.test.jsx` ("every League seat surface…"), timed out at 5.18 s against its 5 s limit under load — a file this build does not touch; alone it passed 3 of 3 (≈ 1.9 s of tests each), and the quiet rerun above is the record. |
| `npm run lint:gate` | **exit 0** |
| `npm run build` (`vite build`) | **exit 0** (the usual chunk-size warning) |
| `lint:gate` and `vite build` again on the pushed head (this report's check lines only) | **exit 0, exit 0** |

The Windows checkout (CRLF, `core.autocrlf=true`) has three known platform-only reds in the evaluator suites (`tickCoherence`, `tickStamps.pins` resolveControls, the `firestore.rules` tripwire), green on Linux. The emulator rules suite was not run: this build touches no rules file and no rules-read flag.
