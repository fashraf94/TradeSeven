# Build T0c — stop buying market data for books that do not exist

**Build report, Practice Field T0c** · Claude Code (Opus 5.5) · 12 Nov 2026
**Branch:** `claude/practice-field-t0c-idle-skip`, stacked on T0a (draft PR #1046)
**Base:** `origin/claude/practice-field-t0a-sector-cap` @ `eb4d9b56` · `origin/main` @ `c37baa0d` (both read after `git fetch origin` at session start and again before push; unchanged)
**Rules:**
- concept V6.1 ruling 3 (`docs/design/20261112_PRACTICE_FIELD_CONCEPT_V6_1.md:237`, `:257`);
- Astra's V6 review C6-12 (`docs/audits/20261112_ASTRA_REVIEW_PRACTICE_FIELD_CONCEPT_V6.md:249–256`);
- her V5 review's B6 reader census and C5-09 (`docs/audits/20261112_ASTRA_REVIEW_PRACTICE_FIELD_CONCEPT_V5.md:268–279`, `:112–120`).

---

## Plain terms

**What was wrong.** The Mandate is the engine the Practice Field will run its paper books on. It has been switched on since 14 August with no book to serve, and every trading day it still bought market data for its 136 stocks: prices four times a day, plus company data, splits and dividends. The Phase 0 audit estimates this at **about 1,700 EODHD units a weekday** (`docs/audits/20261112_PHASE0_TEST_PORTFOLIO_AUDIT.md:82`).

**What changes.** Before buying, the engine now asks two questions:
1. Is there any active book?
2. Is any model request still waiting to be collected or settled?

If both answers are no, it buys nothing and writes one log line saying so. If either answer is yes, it does exactly what it did before.

**What it saves.** These are estimates from the audit's billing assumptions, not measurements: quotes billed per stock, company data at 10 units a request, splits and dividends at 1 unit each.

| Day | Estimated units saved |
|---|---|
| Company data already cached | about 816 units a weekday |
| Company data refetched | about 2,176 units a weekday |
| Typical, per the audit | about 1,700 units a weekday |
| A 21-weekday month | roughly 36,000 units |

Astra's C5-09 caveat stands: this removes the idle buying, but it does not promise an exact daily figure. The plan ceiling is 100,000 units a day (`api/_utils/mandateConfig.js:104`), so the money was small. The point is that the engine stops buying data nobody uses.

**What stays the same.**
- No flag changed, and the engine stays on.
- The first book starts normally. Creating a book writes nothing that skips data, so the next scheduled check finds the book and builds the snapshot exactly as before. A test proves this.
- The daily close still runs its clean-up of old snapshots.
- Any model request still in flight is still collected and settled, because an open request blocks the skip.

**What you will see.** On an idle day the engine leaves no snapshot documents behind. Its only trace is a `mandate_idle_skip` line in the Vercel logs: up to 13 a weekday, one per scheduled fire inside a check or close window.

**Also fixed.** The comments above four Mandate flags still called them off by default. They now say the flags have been on since PR #759 (14 Aug 2026). The review also caught that the master flag's comment claimed it shuts the founder's create endpoint; it does not, and the comment now says so. Comments only; no value changed.

**One question for you** (§6, A3). An open model request blocks the skip even though, under today's direct mode, nothing uses that day's snapshot for it. That is what the brief asked for, and production has none today. Say if you want the condition narrowed to batch mode.

---

## Verdict

| Item | Result |
|---|---|
| Part 1: the qualified skip, check window and close window | Built (`api/cron/mandate-evaluate.js:76–112`, `:325–342`, `:723–760`, `:787–795`) |
| Part 1: the outstanding-duty check uses the batch module's own selector | Built: `openBatchQuery` / `hasOpenBatch` (`api/_utils/mandateBatchTransport.js:108–128`); the harvest (`:519`) and the drain (`:783`) query through it too |
| Part 1: behaviour when not skipping | Unchanged. A base-vs-head differential over nine non-skip scenarios is byte-identical (§5.3), and a test pins that a fire with books opens no extra query |
| Part 1: the tests the brief names | Eleven rows in `api/cron/mandateIntegrationHarness.test.js` block (f); every skip row is paired with a non-skip control |
| Part 2: four flag docstrings | Corrected (`src/config/featureFlags.js:1923–1932`, `:1936–1943`, `:1947–1953`, `:1973–1982`); values and `// Pinned by:` lines untouched |
| Mutation battery | 19 of 19 mutants killed (§5.2) |
| Full suite on Linux | Exit 0 at `c199a336`: `Test Files 1404 passed | 9 skipped (1413)`, `Tests 31028 passed | 107 skipped (31135)` (§5.1) |
| `lint:gate`, `vite build` | Both exit 0 (§5.1) |
| §2 self-review with refuters | Two lenses, one refuter, 18 items: 10 CONFIRMED, 2 CONFIRMED in part, 3 CONFIRMED-AS-SPECIFIED, 3 REFUTED. All CONFIRMED test and docstring findings fixed; one founder question (§6) |
| Fenced files | None edited; no fenced function newly called |
| Firestore writes, model calls, EODHD calls | None made by this session |

---

## 1. The rule as built

| The brief | The build |
|---|---|
| Skip the daily layer and the tick snapshot only when no active book exists… | `idleAcquisitionCheck` (`mandate-evaluate.js:89–100`) counts the docs of the active-book query the handler already runs (`:329`, `:731`). One or more books: no skip, and no extra read. |
| …and no outstanding execution or settlement duty requires a snapshot (no open batch submission awaiting harvest or disposition, no pending finalisation) | Only when there is no book does it call `hasOpenBatch(db)` (`mandateBatchTransport.js:125–128`): `mandateBatches` where `status == 'open'`, limit 1. A batch doc leaves `open` only after every entry is disposed AND billed, or at the billing give-up horizon (`mandateBatchTransport.js:37–41`, `:719–727`). So this one selector covers three cases: a submission awaiting harvest, one awaiting disposition, and an aged-out doc waiting for the provider to end so its usage is billed. That last case is this build's reading of "pending finalisation" (§4.1). |
| Use the active-book query's result; add the duty check beside it, with the batch module's own selectors, not a copy of their query | `openBatchQuery(db)` is the one open-doc query. The harvest and the drain now query through it as well (`mandateBatchTransport.js:519`, `:783`). |
| Continue everything else that fire would do: batch cancellation and expiry, billing and receipts, retention cleanup | **Close window:** the fire continues with no close snapshot. The sweep finds no book, so completion, retention cleanup (`:851`) and the calendar-horizon probe (`:860`) run as today. **Check window:** everything after the snapshot step is keyed to an active book or an open batch doc, and the check just found neither, so the fire ends after the log line (§4.2 lists each step). |
| Recheck the condition on every fire | The skip writes nothing, so the next fire finds no snapshot doc and asks both questions again. |
| Never write an empty or placeholder snapshot | The skip path writes no document of any kind. The tests compare the whole store before and after. |
| One structured log line (`mandate_idle_skip`, window, date, the two conditions' values) and nothing else | `logIdleSkip` (`:103–112`) prints one JSON line, for example `{"event":"mandate_idle_skip","window":"open30","tickKey":"2026-08-12_open30","date":"2026-08-12","activeBooks":0,"outstandingDuty":false}`. The window is the slot name, or `close`. |
| `mandateUpstreamCalls` not incremented | The builders, which alone bump the counter (`mandateUniverseSnapshot.js:448`, `:558`), are not called. |
| When not skipping, behaviour is byte-for-byte what it is today | The non-skip path is the old code, unchanged. With books present the check adds no I/O (pinned by a test). With no books but an open batch it adds one bounded read. §5.3 has the base-vs-head differential. |
| A book created mid-session triggers the normal build on the next fire | Tested both ways: an idle fire, then a book; an idle fire, then an open batch under batch transport, which the next fire's harvest polls (§5). |
| A failure of the duty read | Falls back to acquisition (today's behaviour), never to a skip, with a `console.error` line (`:94–98`). |

**A book that appears during a fire.** A book created between the active-book query and the sweep's page query cannot be served this fire, because no snapshot was built.
- **Check window:** the fire has already returned.
- **Close window:** a new guard (`:787–795`) stops the loop before the lease. The book is left untouched (no close, no failure counter), and the fire does not claim completion, so retention waits too. The next fire in the window rechecks, sees the book and builds.

Both paths are tested. On a window's last fire this moves the cutoff for a same-day first mark by one or two reads (§6, A4).

## 2. Changes by file

| File | Lines (head) | Change |
|---|---|---|
| `api/_utils/mandateBatchTransport.js` | `:108–128` | New `openBatchQuery(db)` (the open-doc query) and `hasOpenBatch(db)` (limit 1). |
| | `:519`, `:783` | `harvestOpenBatches` and `drainOpenBatches` query through `openBatchQuery`. Same query, same limit. |
| `api/cron/mandate-evaluate.js` | `:49` | Imports `hasOpenBatch`. |
| | `:76–112` | `idleAcquisitionCheck` (the duty read runs only with no book; a read failure acquires) and `logIdleSkip`. |
| | `:325–342` | Check window: the check beside the active-book query. On skip, the log line and a `200 { noop:true, reason:'mandate_idle_skip', complete:false }` response. The rest of the block is unchanged. |
| | `:723–760` | Close window: the same check. On skip, the log line and `summary.reason`; the build block moves under `else`, otherwise unchanged (`git diff -w` shows only the new lines). |
| | `:787–795` | Close loop guard: no close snapshot means this book waits for the next fire. The guard sits before any lease or write. |
| `src/config/featureFlags.js` | `:1923–1932`, `:1936–1943`, `:1947–1953`, `:1973–1982` | The four JSDoc blocks describe the lit state and name PR #759 (merged 14 Aug 2026, commit `d7d708c1`). The master's block now says what it gates: `mandate-evaluate`, `mandate-rollover`, `escape`. The founder endpoints read `MANDATE_FOUNDER_CREATE_ENABLED` and the allowlist only. The eval block says the close duty is gated separately. Values, `// Pinned by:` lines and the rest of the file are unchanged. |
| `api/cron/mandateIntegrationHarness.test.js` | `:42–49`, `:54–71`, `:77–79`, `:369–658` | Module mocks: the provider batch poll, for one batch-transport row; the quote client `fetchBatchQuotes` and the cache client `getStockAnalysisData`, which are the build path's network seams. All are inert for the existing rows. Plus block (f), eleven rows. |
| `docs/audits/20261112_BUILD_T0C_IDLE_DATA_SKIP.md`, `docs/README.md` | — | This report and its index row. |

No fenced file (BUILD_RULES §1) was edited and no fenced function is newly called. The snapshot builders' signatures and the universe list are untouched.

## 3. Reader census, re-verified at this HEAD

I grepped `api/`, `src/` and `scripts/` (non-test) for `mandateUniverseSnapshots`, `mandateUniverseDaily`, `SNAPSHOT_COLLECTION`, `DAILY_COLLECTION`, `ensureUniverseSnapshot` and `ensureDailySnapshot`. Every hit is the Mandate's own:
- the eval and close build blocks (`mandate-evaluate.js:326`, `:728`);
- the builders themselves (`mandateUniverseSnapshot.js:367`, `:487`);
- the batch harvest's submit-tick read (`mandateBatchTransport.js:644`);
- retention (`mandateClosePass.js:603`).

`firestore.rules` grants no client access to either store, and `api/mandate/create.js` reads neither, so creating a book does not depend on a snapshot existing. Astra's B6 census holds.

## 4. Readings stated

### 4.1 "Pending finalisation"

Read as a batch doc still `open` after its entries are disposed. Two cases:
- an aged-out doc waiting for the provider to end, so pre-cancel usage is billed (`mandateBatchTransport.js:589–629`);
- an ended doc whose usage is not yet fully billed (`:719–727`).

Both keep `status: 'open'`, so `hasOpenBatch` sees them. A test row seeds an aged-out doc and shows it blocks the skip.

Other "pending" records were checked; none needs a snapshot:
- `pendingScoringAppends` is consumed only by an active book's own close (`mandateClosePass.js:513–534`).
- A book-level `execState.openBatchId` gate always has its batch doc behind it, and that doc stays open. Escape clears the gate in the same transaction that closes the book (`mandateEscape.js:164–176`).

Mandate statuses are only `active` and `closed` (`api/_utils/mandateSchema.js:41`).

### 4.2 Why the check window returns instead of continuing

After the snapshot step a check-window fire does five things, each keyed to an active book or an open batch doc:
- the harvest polls open batch docs (none);
- the last-tick rule ends a batch-mode final slot (nothing to submit);
- the regime read feeds only book prompts;
- the sweep page and its per-book work, book-level gate expiry included (`:150–176`), serve active books (none);
- batch submission needs an enqueued book.

With both conditions false, the fire has nothing left to do, so it returns after the log line. That also means no code path runs with a null snapshot. The response says `complete: false`, because the sweep did not run. A no-book fire used to say `true`; nothing in the repo reads the field.

The close window is different. Retention cleanup and the calendar-horizon probe sit behind its completion gate and do not depend on a book, so it continues with no snapshot, guarded as in §1.

### 4.3 Liveness evidence

Idle days now leave no `mandateUniverseSnapshots`, `mandateUniverseDaily` or `mandateUpstreamCalls` documents. Retention (120 days, `mandateConfig.js:300`) will age out the idle-era ones written since 14 August. On an idle day, the evidence that the cron ran is now the `mandate_idle_skip` log line. It is lowercase, so the runbook's case-sensitive `MANDATE_` alert grep does not match it.

### 4.4 Reads added per idle fire

Each in-window fire on an idle day costs three Firestore reads: the snapshot doc, an empty active-book query, and the limit-1 open-batch query. Today, a fire after the first in its window reads only the snapshot doc.

That is at most about 26 extra reads a weekday. There are 13 in-window fires: 2 each for open30, midday and preClose, and 7 for close, counted by walking `activeTick`/`activeCloseTick` over the `*/15 14-22 * * 1-5` schedule. In exchange, the day's four snapshot writes, the daily doc and the counter go away.

## 5. Tests

### 5.1 Commands and results

**Targeted, Windows worktree (CRLF)**
- Command: `TZ=UTC node C:/Users/fashr/portfolio-duel/node_modules/vitest/vitest.mjs run api/cron/mandateIntegrationHarness.test.js`
- Result: exit 0, `Test Files 1 passed (1)`, `Tests 19 passed (19)`. Also 19/19 under `--sequence.shuffle` with seeds 3, 42 and 777. Review lens B ran seeds 1, 7, 42, 1234 and 99999 on the first cut.
- A wider Windows run covered `api/cron/mandate*`, `api/_utils/mandate*`, `api/mandate`, `flagPinGuard` and `mandateFlags`. 35 of 39 files passed. The only failures were 10 rows in four files on this machine's known Windows-only list: the path-separator scans `mandateUniverseSnapshot.imports`, `mandateModelCall.imports` and `mandateMoneyRounding.scan`, and the ESM loader `mandateNativeEsm.smoke`. Linux decides those four.

**Full suite, Linux (WSL)**
- Run in a private worktree of `~/pd-ci` detached at `c199a336db4a941e8303af83998f5ef41edee25f`, the code head; the report commit after it is docs-only. Node 20.20.2; `node_modules` came from an install whose lockfile hash, `40382e64edb6`, matches the head's. Started 2026-11-13T01:47:38Z, ended 01:53:39Z.
- Command: `TZ=UTC flock /tmp/pd-suite.lock npx vitest run --maxWorkers=8 --reporter=default --reporter=json --outputFile.json=…`
- Exit code **0**. Read directly from the log: `Test Files  1404 passed | 9 skipped (1413)`, `Tests  31028 passed | 107 skipped (31135)`, `Duration  323.32s`.
- The nine skipped files are the environment-gated emulator, golden-capture and browser files.
- On Linux the harness passes 19/19, and the four Windows-only files pass: `mandateUniverseSnapshot.imports` 3/3, `mandateModelCall.imports` 3/3, `mandateMoneyRounding.scan` 3/3, `mandateNativeEsm.smoke` 6/6. Also `mandateBatchTransport` 26/26, `mandateBatchInterleavings` 11/11, `flagPinGuard` 6/6 and `mandateFlags` 6/6.
- No `firestore.rules` change, so the rules suite was not run.

**`lint:gate` and `vite build`** (WSL, same worktree, `npm run -s lint:gate`, `npm run -s build`): both exit 0 at `22b4e52d` and again at `c199a336` (`✓ built in 56.70s`). `vite build` ran once more at the pushed head (this report's commit) before push.

### 5.2 The rows and their mutants

Block (f) is `api/cron/mandateIntegrationHarness.test.js:369–658`. Three design choices make its assertions able to fail:
- **The no-fetch check sees every network edge.** It stubs global `fetch` and `EODHD_API_KEY` (without the key the corporate-actions fetcher throws before reaching `fetch`, so the check would pass vacuously). It also mocks the two client modules, so every build request is counted. The stub throws on any URL other than EODHD splits or dividends.
- **"Nothing written" is whole-store equality**: every path, its data and its version.
- **One query hook covers every `mandateBatches` query,** whatever its chain. It records each read's shape and can inject a failure, or a book landing mid-fire.

| Row | Proves |
|---|---|
| eval, no books and no open batch | Exactly one duty read, `where(status=='open').limit(1)`. One idle line and nothing else logged. Zero quote, fundamentals and `fetch` calls. The store byte-identical. `complete: false` |
| eval, no books but an open submission (it.each 1/2) | Not skipped, and the whole fire succeeded (200, `ok`, `complete`). A full build: `N` fundamentals, `2N` CA fetches and the quote chunks. Snapshot, daily doc and counter written |
| eval, no books but an aged-out doc awaiting finalisation (it.each 2/2) | The same |
| CONTROL: a terminal batch doc | Does not block the skip (the selector reads `status`) |
| eval, a book present | The unchanged path: full build, the book evaluated, its tick stamped. **No `mandateBatches` query at all** |
| recheck | An idle fire writes nothing. A book is created. The next fire in the same window builds and evaluates, with no duty read |
| a failed open-batch read | The injected failure hits the duty read. The result is acquisition and a successful fire, never a skip. An error line |
| close, no books | No close snapshot, no fetch, the store unchanged. One duty read. `complete: true`, retention called once, the idle line with `window: 'close'` |
| close, no books but an open batch | Not skipped. The close snapshot built, the fire complete, retention still runs |
| close race | A book landed during the first duty read is deferred untouched (version 1, no failure stamp). No completion, no retention. The next fire builds and closes it, with no second duty read |
| batch transport, recheck | An idle fire under batch transport, nothing to harvest. An open batch appears. The next fire builds, and its harvest polls the batch against the real snapshot |

**Mutation battery.** 19 single-site mutants on LF snapshot trees: M1–M12 on `22b4e52d`, then all on `17bfd824`, and M18–M19 (the refuter's two closest variants) on the same tree. Each was judged by exit code and a freshly written JSON report, and the exact bytes were restored afterwards (sha256 checked).

| Mutant | Rows red (at `17bfd824`) |
|---|---|
| M1 eval skip disabled | idle eval, terminal CONTROL, recheck, batch recheck |
| M2 open batch ignored | both open-batch eval rows, close open-batch, batch recheck |
| M3 selector drops `status` | terminal CONTROL; idle eval, close no-books and close race (the pinned read shape) |
| M4 failed read skips | failed-read row |
| M5 close skip returns early | close no-books (retention) |
| M6 close loop guard removed | close race |
| M7 eval skip writes a placeholder | idle eval, terminal CONTROL, recheck, batch recheck |
| M8 close skip writes a placeholder | close no-books, close race |
| M9 log drops a condition | idle eval, close no-books |
| M10 race guard claims completion | close race |
| M11 a book does not block the skip | book present, recheck, close race |
| M12 close skip disabled | close no-books, close race |
| M13 duty read made non-lazy | book present, recheck, close race, idle eval, failed read, close no-books |
| M14 a 500 after the build with no book | both open-batch eval rows, failed read, batch recheck |
| M15 duty read unbounded | idle eval, close no-books, close race |
| M16 duty read `limit(500)` | idle eval, close no-books, close race |
| M17 eval skip claims completion | idle eval, batch recheck |
| M18 a swallowed extra duty read on book fires | book present, recheck, close race |
| M19 the duty read moved before the books>0 return | book present, recheck, close race |

**19 of 19 killed**; no anchor BROKEN; baseline 19 of 19 green. At `22b4e52d`, M1–M12 were also 12 of 12, with baseline 18 of 18.

### 5.3 Differential: non-skip behaviour is unchanged

One scratch test file, not committed, was copied byte-identically into LF snapshot trees of the base `eb4d9b56` and of `22b4e52d`. It runs nine non-skip scenarios through the real `runEvalSweep` and `runCloseSweep`, the real builders and the real `closeBook`, with time, lease tokens and the network clients fixed. For each scenario it dumps the final store (paths, data, versions), the response, every log line and every client call.

The nine scenarios:
- eval direct: a BUY executed;
- eval direct: a SELL and a HOLD across two books;
- eval direct: no books with an open batch;
- eval batch: an enqueue and submit;
- eval batch: an in-flight open batch polled;
- close: a real close of a holding book;
- close: no books with an aged-out batch;
- eval: snapshot already present;
- eval batch: a quote outage giving a harvest-only `snapshot_failed`.

**Result.** The two outputs are byte-identical: 769,127 bytes, SHA-256 `16781fa43e41fe50899551a4438c7b4f3bdecf94352bb011348754d20162cea3`. Each scenario was checked to have done what its label says.

**Control.** Adding one idle scenario (no books, no batch) to both copies makes exactly that scenario differ, while the nine stay identical. The review-fix commit `17bfd824` changed no source line in `mandate-evaluate.js`; in `mandateBatchTransport.js` it changed only a comment.

## 6. §2 self-review with refuters

The diff is below the BUILD_RULES §2 threshold: 6 files, about 800 lines, of which 514 are code and tests. The brief asked for the self-review anyway, and it ran as §2 describes:
- **Two independent reviewers**, each on its own LF `git archive` tree of `22b4e52d`, read-only on git and the worktree. Lens A: ruling fidelity and safety. Lens B: test integrity; it ran 21 mutants and 5 shuffled orders.
- **One refuter** on a third tree, told to refute every finding with code or a mutant.
- The differential (§5.3) and the mutation battery (§5.2) ran on further trees.
- `vite build` and `lint:gate` ran at the head.

| ID | Finding | Refuter | Disposition |
|---|---|---|---|
| A1 | The master flag's docstring said it closes the founder create endpoint. `create.js:63`, `accelerate.js:32` and `drain.js:44` read only `MANDATE_FOUNDER_CREATE_ENABLED` and the allowlist. | CONFIRMED (should-fix) | Fixed: the docstring names what the master gates and what it does not |
| A2 | The eval docstring said false stops "the handler", but the close branch runs before the eval check. "snapshot, harvest, submit" also contradicts the idle skip. | CONFIRMED, partly ("harvest" under direct follows the file's own wording) | Fixed |
| A3 | An open batch doc blocks the skip even under direct transport and on the close path, where that snapshot serves no one. A stuck doc would keep forcing builds. | CONFIRMED-AS-SPECIFIED. The brief names "open batch → not skipped" with no transport condition, and this is not a regression. "Invisibly" is overstated: `MANDATE_BATCH_STUCK_OPEN` fires at 30 days (`mandateClosePass.js:635–636`) | Kept as the brief specifies. **Founder question:** narrow the duty to `transport === 'batch'` on the eval path, and drop it on the close path? Production holds no batch docs today (audit `:77`) |
| A4 | On a window's last fire, a book created between the active-book query and the page query waits for the next window. | CONFIRMED-AS-SPECIFIED, narrower than stated. The cutoff moves by one or two reads, not a build's length. The lost creation-day close row would be partial, and is not a missed mark (`mandateClosePass.js:121`, `:353–356`) | Kept; stated in §1 |
| A5 / B3 | Nothing pinned "a fire with books does today's I/O". | CONFIRMED. Two close variants survived on the first cut | Fixed: the book-present, recheck and close-race rows assert no extra `mandateBatches` query. M13, M18 and M19 now killed |
| A6a | The harness header cites this report, which was absent at `22b4e52d`. | CONFIRMED (nit) | This commit adds it |
| A6b | `MANDATE_RUNBOOK.md:54` does not know `mandate_idle_skip`. | REFUTED. That check covers run days with books, and its `MANDATE_` grep is case-sensitive | No change |
| A6c | The idle eval response says `complete:false` where a no-book fire said `true`. | CONFIRMED (nit; no consumer) | Kept deliberately (§4.2) and pinned (M17 killed) |
| A6d | The banner at `featureFlags.js:1913` still says "MERGE DARK". | CONFIRMED-AS-SPECIFIED: the brief forbids other changes in that file | §7 |
| A6e | `openBatchQuery`'s comment overclaimed "the ONE definition … cannot drift". | CONFIRMED (nit) | Fixed (wording) |
| B1 | The test injections were tied to one query chain, and `limit(1)` was unpinned. | CONFIRMED, overstated (dropping the limit is not behaviour-neutral) | Fixed: one chain-agnostic hook; the read shape is pinned (M15, M16 killed) |
| B2 | The not-skipped rows never asserted that the fire succeeded. | CONFIRMED (should-fix) | Fixed: 200, `ok`, `complete` (M14 killed) |
| B4 | The exact counter arithmetic pinned something outside T0c. | REFUTED: it is the control for "no counter written" | Relaxed to "counter written" anyway, since the exact counts stay pinned by the fetch tally |
| B5 | `logs.toHaveLength(1)` is brittle. | REFUTED: it is the "nothing else" contract | Kept |
| B6 | The throwing model and `closeBook` guards on no-book rows were vacuous. | CONFIRMED (nit) | Removed; an unexpected `closeBook` call still fails the row through its null implementation |
| B7 | The eval skip's `complete` value was unpinned. | CONFIRMED (nit) | Pinned |
| B8 | No row ran batch transport. | CONFIRMED for the transport gap. REFUTED for the batch-appears recheck, which follows from two pinned rows | A batch-transport recheck row added anyway: it is the only row that exercises the harvest |
| B9 | A harness comment said every row in (a)–(e) seeds its snapshot; (e) calls `closeBook` directly. | CONFIRMED (nit) | Fixed |

**Totals.** Of 18 adjudicated items (A5 and B3 counted once):
- **CONFIRMED: 10** (A1, A5/B3, A6a, A6c, A6e, B1, B2, B6, B7, B9).
- **CONFIRMED in part: 2.** A2 had one refuted sub-point; B8 is confirmed for the transport gap and refuted for the recheck.
- **CONFIRMED-AS-SPECIFIED: 3** (A3, A4, A6d).
- **REFUTED: 3** (A6b, B4, B5).

All CONFIRMED test and docstring findings are fixed in `17bfd824`. No finding touched the skip logic itself. The refuter's summary: "the skip logic itself holds up".

## 7. Found outside the task (not fixed here)

1. **BUILD_RULES §6 cron census** (`docs/BUILD_RULES.md:82`) still reads "19 of 21 are registered". At this HEAD `api/cron/` holds **28 handlers, 26 registered** in `vercel.json`: 45 entries over 38 distinct paths. The two unregistered handlers are still `season-daily-evaluate` and `season-pit-stop-manage`. The Phase 0 audit reported the same count. This is for the founder's own BUILD_RULES PR.
2. **Two more stale "dark" texts sit beside the four docstrings.** The brief limited Part 2 to those four comments, so these stay as they are:
   - the section banner above the Mandate flags (`src/config/featureFlags.js:1913`, "All default false / safest, MERGE DARK");
   - the header of `api/cron/mandate-evaluate.js:3–8` ("DARK by construction … the standing default").
3. **The shared fundamentals cache has one possible requester beyond "dead code".**
   - `api/season/generate-debrief.js:24` imports `fetchSharedMarketData` from `seasonEvalContext.js`, which requests the `fundamentals` field (`seasonEvalContext.js:41`).
   - `src/screens/PitStopScreen.jsx:614` calls that endpoint, and `src/App.jsx:9954` routes to PitStop when a Season entry is active.
   - This build did not check whether any Season is active (a Firestore fact). If one is, that debrief now finds the cache less often warmed by the Mandate, and it fetches on a miss. Latency and cost move there; its data source is unchanged. This is Astra's B6 consequence, not a correctness issue.
4. **No cron can clear an open batch doc under direct transport.** The harvest is batch-only and the close path never harvests, so only the founder drain endpoint does. Combined with A3, a stuck doc would force daily builds until someone drains it. `MANDATE_BATCH_STUCK_OPEN` alerts at 30 days.
