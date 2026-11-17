# Astra confirmation — T1a-2b-1 fix round

**16 November 2026 · Verdict: DO NOT MERGE.** T2B-01, T2B-02 and T2B-03 are closed. T2B-04 remains open in a fractional-charge variant: earlier settlements round charges down, allowing a later declared maximum past the true remaining room. The demonstrated overrun is **$0.0000001**. This is numerically tiny, but meets the brief's literal stop rule (a), continuing original criterion 6. No other qualifying blocker was found in this round. Sources: H:api/_utils/practiceField/spend.js:90, :209, :240, :259; P:astra-fractional-spend.test.js:9.

## Exact revisions and scope

The requested fetch completed. Detached worktrees at H, B and O were inspected without editing tracked source. C's product tree equals H's; the changes above C are documentation. No push, PR action, deployment, real-project Firestore action, or live model/EODHD call was performed. Financial reproductions used synthetic in-memory fixtures; rules used localhost demo emulators.

| Alias | Full HEAD read | Use |
|---|---|---|
| H | 5dbde8a43ffcbb11d02962e98f36d2fd1e80769f | Fetched branch HEAD; source, report and tests |
| C | 29bf46a5647b0c5e2e96c1bd0dd6cd290fadf3bb | Code-head metadata and comparison to H |
| B | 71bc6bde7c0553cdb16e5c5f3752d248968967c3 | Fetched main; differential/build baseline |
| O | 421a445d553b6648f976abb31e558d8ee4236f75 | Old head; round diff, original reproductions and old end-to-end pin |

H/B/O files are under C:/Users/fashr/.codex/visualizations/2026/11/16/01a1e626-b444-72d3-94dd-5bf25f90a4ce/{head,base,previous}/. **P** identifies this session's private harness in the same directory's probe/ folder, importing the stated head. This Markdown file is the deliverable; other files are scratch verification evidence. Original review: H:docs/audits/20261116_ASTRA_REVIEW_T1A2B1.md:1. Fix report: H:docs/audits/20261115_BUILD_T1A2B1_ACCESS_RECORDS_FOUNDER_CONTROLS.md:505.

## T2B-C01 — Settlement releases fractional charges, permitting spend past $3

**Blocker: T2B-04 not fully closed.** Every call uses the priced claude-haiku-4-5 model, cacheTtl '5m', no server tools, and usage within its declared input/output ceilings. Each individual maximum covers its charge. The defect is cumulative accounting: micros() rounds to nearest; settlement commits less than an incurred fractional-microdollar charge and releases too much reservation. The next reservation checks that understated total. The exact actualUsd remains on the operation, but reservedUsd and settledUsd lose the fraction. Sources: H:api/_utils/practiceField/spend.js:90, :131, :209, :240, :247, :253, :259; H:api/_utils/modelPriceTable.js:26, :34, :77.

**Independent transaction reproduction:**

| Calls | Declared ceilings and actual usage | Reserved maximum per call | Actual charge per call |
|---|---|---:|---:|
| 1 | 1,001 input, all cache reads; 1,000 output | $0.006252 | $0.0051001 |
| 11 | 199,000 input, all 5-minute cache writes; 100 output | $0.249250 | $0.249250 |
| 1 | 199,000 input, all 5-minute cache writes; 880 output | $0.253150 | $0.253150 |

The first settlement records **$0.005100**, dropping **$0.0000001** from budget consumption. Before the final call, the book records **$2.746850**, while charges total **$2.7468501**. It authorizes **$0.253150** although true room is **$0.2531499**. All 13 reservations and settlements return ok; no above-reservation flag is raised. The final book records **$3.00**, but charges total **$3.0000001**. Sources: P:astra-fractional-spend.test.js:12, :19, :26, :32; H:api/_utils/practiceField/spend.js:206, :209, :246.

This is **not binary floating-point noise**. The independent check uses exact integer nanodollar rates: ordinary input 1,000, cache write 1,250, cache read 100, output 5,000 per token. It obtains exactly **3,000,000,100 nanodollars**, cross-checks priceUsage, and verifies every charge is within its maximum. No provider invoice or production overspend is asserted. The brief supplies no monetary tolerance. Sources: P:astra-fractional-spend.test.js:25; H:api/_utils/modelPriceTable.js:26, :34, :77.

**Concrete one-change fix:** make spend.js settlement and remaining-room arithmetic retain a unit fine enough for this tariff, such as integer nanodollars. Convert reservation ceilings into that same unit before release/comparison, preserve public USD values and truthful raw actualUsd, and never round incurred cost downward when freeing budget. Add this regression: after the first 12 settlements the final reservation must return spend_would_exceed. This is a bounded spend-arithmetic change plus its test; truthful T1b declarations alone cannot fix it. Sources: H:api/_utils/practiceField/spend.js:89, :117, :209, :238, :257; P:astra-fractional-spend.test.js:9.

## Requested confirmations

### T2B-01 — Closed; the gap-screen read remains T1a-2b-2

The Nov 27 timed → Nov 30 untimed → Dec 1 carried sequence now names **Nov 30's snapshot/session and null vendor time on all three ledgers**, both for observed Dec 1 without quotes and caught-up unobserved Dec 1. Fresh-untimed and genuinely-timed controls pass; borrowed-time variants fail the validators. Fills/fresh closes write lastMarkProvenance and carries preserve it. Sources: H:api/_utils/practiceField/fills.js:142; H:api/_utils/practiceField/ledger.js:882, :901; H:api/_utils/practiceField/evidence.js:241, :484, :510; H:api/_utils/practiceField/evidence.test.js:347; P:astra-confirmation.test.js:35.

Admission's entry-fill, fresh-close, timed/untimed carried sources also pass. No packet uses lastMarkAsOf as the price's vendor time. There are still reads: admission keeps an explicitly labelled recordedMarkAsOf diagnostic, and the old gap screen reads it. Sources: H:api/_utils/practiceField/evidence.js:108, :130; H:api/_utils/practiceField/evidence.test.js:103; P:astra-confirmation.test.js:49.

**Yes, that gap-screen read can give a wrong gap-start date today.** After Nov 30's untimed 101.234 price, a later half-price observation records since = Nov 27 and Nov 27's frozenMarkAsOf, although the frozen price came from Nov 30. That over-wide interval feeds the explanation/cash-hold predicates. The reads and lastMarkAsOf write rule are unchanged from O. This is the already-assigned **T1a-2b-2** issue, not a blocker here. Sources: H:api/_utils/practiceField/ledger.js:247, :299, :334, :584, :910; O:api/_utils/practiceField/ledger.js:299, :334, :878; P:astra-confirmation.test.js:49.

### T2B-02 — Closed

The empty book created Nov 16 at 09:00 receives a Nov 16 window-only close row and three missed-intraday alerts when Nov 17 runs. Direct-close and catch-up-first orders, accepted-but-unfilled timeout, replay, more than 20 window-only sessions, and the bounded 20-valuation-session continuation all pass. The independent window cursor does not invent a historical valuation. Sources: H:api/_utils/practiceField/windowLedger.js:169, :185, :251; H:api/_utils/practiceField/close.js:464, :817; H:api/_utils/practiceField/windowLedger.test.js:271, :308, :357, :375; P:astra-confirmation.test.js:85.

Creation at 13:00 owes only preClose among that day's intraday windows; closed books add no later windows. A valued:false row creates no valuation row and feeds neither result nor result packet. Independently poisoning a window-only row with an unmistakable mark/value leaves the packet unaffected. Sources: H:api/_utils/practiceField/windows.js:99; H:api/_utils/practiceField/close.js:454, :478, :660; H:api/_utils/practiceField/windowLedger.js:199, :223; P:astra-confirmation.test.js:85, :96.

### T2B-03 — Closed; the largest exercised packet is bigger than 233 KiB

Nov 19's peak prices are present. Independent arithmetic recovers **$4,689.93 idea decline**, **$3,455.74 comparison decline**, and this case's **1.0 mean exposure across 11 observed closes**. The module agrees after shared snapshots/rows and packet.track are removed. Copied quantities, marks, values, cash and vendor times match the source rows. A changed peak mark fails hash and numerical checks. Sources: H:api/_utils/practiceField/close.js:660; H:api/_utils/practiceField/evidence.js:277, :356, :465; H:api/_utils/practiceField/settlement.js:269, :296; P:astra-confirmation.test.js:68.

The added checks detect missing endpoints/intermediate observations, ordering, missing ledgers, inconsistent values and inconsistent statistics, even after resealing. Missing source rows abort endpoint construction. The hash detects alteration; it does not authenticate a replacement made by someone able to rewrite and reseal the server record. Sources: H:api/_utils/practiceField/evidence.js:350, :362, :374, :392, :413; H:api/_utils/practiceField/evidence.test.js:432, :445, :490.

The supplied long-slot shape reproduces **238,673 storage-estimated bytes**: 61 closes, four idea names, eight basket names and SPY. My larger synthetic case adds 767 dividend receipts and reaches **440,984 bytes (430.65 KiB)**, or 519,438 JSON bytes. It still fits one document. The 238,673-byte figure is not a universal maximum with action receipts included; extending size coverage/documentation belongs to **T1a-2b-2**, not another blocker. These figures use the repository test's estimator, not an exhaustive proof over every possible receipt history. Sources: H:api/_utils/practiceField/evidence.js:427, :454, :465; H:api/_utils/practiceField/evidence.test.js:41, :525; P:astra-confirmation.test.js:18.

### T2B-04 and Q2 — Original case fixed; cumulative cap incomplete

The $3.10-capable request is refused against $2.90 room. Exactly $3 succeeds. Unknown models, one-hour caching and any server tool are refused. Refusals write nothing and do not exhaust an otherwise open month. Settlement releases unused room and can reopen the month; replay and Eastern-month rollover pass. Exhaustion refuses every **new** reservation, even a tiny one. An old-operation replay returns its receipt, not permission for another upstream call. Sources: H:api/_utils/practiceField/spend.js:173, :184, :195, :206, :227; H:api/_utils/practiceField/spend.test.js:85, :100, :120, :165, :208, :221, :278, :323; P:astra-confirmation.test.js:104.

Within the table, the per-call maximum covers ordinary input, cache writes/reads and output: highest supported input rate, no batch discount, upward rounding. The 20,000 independent usage mixes pass. **That property does not cure T2B-C01's downward settlement rounding.** Sources: H:api/_utils/practiceField/spend.js:117; H:api/_utils/modelPriceTable.js:26, :77; P:astra-confirmation.test.js:104; P:astra-fractional-spend.test.js:26.

**T1b condition:** ceilings are caller declarations. Bind the reservation to the actual model/request; bound *all* billed input, including cached input and provider-added tool/system input; set the actual output cap no higher than declared; enforce no one-hour caching, server tools or other unpriced billable options; reserve every real retry separately; never send a second call on idempotent replay. T1b still owns tariff verification, its model and the $0.05 placeholder. These conditions are not blockers here; the new reproduction honors them. Sources: H:api/_utils/practiceField/spend.js:6, :15, :41, :52, :68, :184; H:api/_utils/practiceField/constants.js:139.

## Other changes and comparison

The fill guard changes no money outcome under today's fire ordering: catch-up accounts strictly before the current tick, then that tick runs sales/entries; a valued session was already refused by the old guard. The new branch catches a backdated fill into a window-only session, covered by its artificial-state test. This conclusion is for current callers, not arbitrary direct calls with invented dates. Sources: H:api/_utils/practiceField/windowLedger.js:185; H:api/_utils/practiceField/sweep.js:208, :217, :232; H:api/_utils/practiceField/sessions.js:44; H:api/_utils/practiceField/windowLedger.test.js:346.

Admission untimed pricing, exhaustion and recomputation additions are checked above. Extracting trackStatistics preserves the formulas. The added protected-store sites write the window cursor/window-only rows. Access rules, client source and cron entrypoints did not change in this round. Sources: H:api/_utils/practiceField/evidence.js:130; H:api/_utils/practiceField/spend.js:206; H:api/_utils/practiceField/settlement.js:296; H:api/_utils/practiceField/close.js:480; H:api/_utils/practiceField/windowLedger.js:266; H:api/_utils/compositionProtectedStoresAllowlist.json:470, :528.

Both end-to-end pins reproduced:

| Head | Documents | Bytes | SHA-256 |
|---|---:|---:|---|
| O | 154 | 328,611 | bb742bb9181c76d5f81317d59702307e37e6155c6fd9c19a61f523647ea65a0f |
| H | 155 | 384,605 | f9c91e33f6bafa05b46ec4d7ce5d67d8ad1a8a80a4b92d42b4412fcbf76ad6ed |

The one added document is **mandates/pf_0361cd058cc2b6af41bd8a21/windows/2026-11-13_close**. There are **1,332 added leaves** in existing documents (empty containers count as leaves), no removals, and exactly three changed existing leaves: the result-packet contentHash values. **No existing money leaf changed in this execution.** The end-to-end run does not exercise fractional model charges. Sources: O:api/_utils/practiceField/endToEnd.test.js:1; H:api/_utils/practiceField/endToEnd.test.js:41, :62, :261; session script compare-confirmation.mjs:1.

## Reruns and limits

| Check | Independent result | Evidence |
|---|---|---|
| Security rules, exact LF source, local demo emulator | **813/813, 43 files, exit 0** | H:vitest.rules.config.mjs:15; H:test/rules/practiceFieldIdeaBookOwnerRead.rules.mjs:1; rules-linux.log:1 |
| Seventeen scenarios at both modes vs B | **34/34 identical** (17 off, 17 on); 4,000 default build sets and prompt equality also pass | P:astra-differential.test.js:46, :49, :55 |
| Traced differential vs B | **40/40 raw-identical** (20 off, 20 on); combined differential harness 76/76 assertions | P:astra-cron-trace.test.js:48; differentials.json:1 |
| Focused Practice Field, endpoint, isolation, scans and price-table tests in the Linux full run | **671/671, 26 files** | H:api/_utils/practiceField/evidence.test.js:316; H:api/_utils/practiceField/windowLedger.test.js:263; H:api/_utils/practiceField/spend.test.js:84; full-linux.json:1 |
| Full Linux suite, exact LF archive, Node 22.22.2, TZ=UTC | **33,942 passed, 3 failed, 135 skipped**; 1,504 files passed, 3 failed, 12 skipped; exit 1 | H:vitest.config.js:34; full-linux.log:1 |
| The three failed CLI files, rerun with local Git metadata at H | **31/31, 3 files, exit 0**, including all three previously failed cases | H:scripts/experiments/agent-workspace/run.mjs:45; H:scripts/experiments/agent-workspace/prepare-pilot.test.js:85; H:scripts/experiments/agent-workspace/workspace.test.js:166; H:scripts/experiments/archetype-menu-dry-run/capture.test.js:128; cli-rechecks.log:1 |
| Production build, H vs B | Both succeed; **113/113 generated files byte-identical** | H:package.json:8; B:package.json:8; verify-build.sh:24; build-compare.json:1 |
| End-to-end pins, O and H | **3/3 tests at each head**; leaf comparison described above | O:api/_utils/practiceField/endToEnd.test.js:1; H:api/_utils/practiceField/endToEnd.test.js:261; compare-confirmation.mjs:1 |

The full run's three failures were all “fatal: not a git repository” from offline CLI provenance calls, not product assertions. Their complete files passed after adding metadata at the exact H commit. **The full suite was not rerun after that correction, so this report does not claim a single full-suite exit 0.** The runtime's dependency records were compared with the pinned lock; the missing three.js 0.184.0 package was supplied from the local npm cache, offline. The lock SHA-256 is 40382e64edb6196ff26fdb8af8aa873303076fc1f1d0905402e9810f66d36e3f. Sources: H:scripts/experiments/agent-workspace/run.mjs:45; H:scripts/experiments/archetype-menu-dry-run/capture.mjs:44; verify-linux.sh:13; verify-cli-rechecks.sh:1; linux-runtime.txt:1.

Windows diagnostics are not silently reported green: the initial rules run was 812/813 because the unchanged source-text assertion saw CRLF; the final native Linux LF run above is the complete 813/813 rerun. Four Windows path-closure scanner failures also reproduce on B and pass in the Linux full run. A preliminary Linux run on a CRLF-converted archive was stopped and superseded by the exact-LF full run above. No tracked product files were altered to obtain these results. Sources: H:test/rules/agentEvalRunsDenials.rules.mjs:133; H:api/_utils/__fixtures__/mandateEvalPathClosure.js:34, :50; B:api/_utils/__fixtures__/mandateEvalPathClosure.js:34, :50; rules.json:1; rules-linux.json:1; base-scans.json:1; full-linux.json:1.

The builder's **34/34 mutation battery was not independently rerun** and is not substituted for current evidence. The old-head original harness reproduced its failures (9/9 assertions expecting old behavior). The new confirmation has 12/12 passing tests, plus one separately passing **defect-demonstration** test: that pass confirms T2B-C01's overrun, not the invariant. Sources: H:docs/audits/20261115_BUILD_T1A2B1_ACCESS_RECORDS_FOUNDER_CONTROLS.md:708; P:astra-original.test.js:14; P:astra-confirmation.test.js:18; P:astra-fractional-spend.test.js:9.

T2B-05, T2B-06, Q7 and the gap-screen read retain their **T1a-2b-2** homes. Caller enforcement, tariff/model work and minimum-call configuration retain **T1b**. No extra T5 work is imposed. The mode remains off. Sources: H:docs/audits/20261115_BUILD_T1A2B1_ACCESS_RECORDS_FOUNDER_CONTROLS.md:797; H:src/config/practiceFieldFlags.js:33.

**Final record:** H 5dbde8a43ffcbb11d02962e98f36d2fd1e80769f; C 29bf46a5647b0c5e2e96c1bd0dd6cd290fadf3bb; B 71bc6bde7c0553cdb16e5c5f3752d248968967c3; O 421a445d553b6648f976abb31e558d8ee4236f75. Rules **813/813**. Differentials **34/34 (17 per mode)** and **40/40 (20 per mode)**, identical to B. **DO NOT MERGE — T2B-C01 only.** Report: C:/Users/fashr/.codex/visualizations/2026/11/16/01a1e626-b444-72d3-94dd-5bf25f90a4ce/20261116_ASTRA_CONFIRMATION_T1A2B1_FIX_ROUND.md.

