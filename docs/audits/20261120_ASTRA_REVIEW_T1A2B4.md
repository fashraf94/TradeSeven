# Astra review · Practice Field T1a-2b-4

20 November 2026 · Draft PR #1098 · Review round 1

**Dark merge — DO NOT MERGE. Founder allowlist switch — NOT READY.** Three reachable histories move cash under ambiguous dividend IDs without a ruling. A fourth pays a different cent solely because two splits were delivered out of date order. Four additional histories defeat a quality or coverage condition on the founder’s money path. All eight have replay instructions below. The quarterly comparisons passed. (Run:94, Run:96, Run:98, Run:100, Run:102, Run:104, Run:106, Run:108, Run:118.)

The four original examples improved. Against the pinned base, the head recovered the $99.97 sold-line dividend, recomputed the late-split dividend to $124.96, allowed a recorded $2 correction, and held cash on a rejected parse. The clean, on-time control paid $124.96 on both revisions. The wider switch verdict turns on the cases below. (Run:92, `__testsupport__/caSequences.js:1082`, `corporateActionCorrections.test.js:389`.)

### How to read and replay the findings

Bare product filenames resolve under `api/_utils/practiceField/` at `df9b7278`. `Engine` means `api/_utils/mandateCorporateActions.js`, `Snapshot` means `api/_utils/mandateUniverseSnapshot.js`, and `Cron` means `api/cron/mandate-evaluate.js`. `F1` is `docs/design/20261118_PRACTICE_FIELD_AMENDMENT_F_REV1_STICKY_AMBIGUITY.md`. `Build` and `Prior` are respectively `docs/audits/20261120_BUILD_T1A2B4_CORRECTIONS_AND_PARSE_COVERAGE.md` and `docs/audits/20261117_BUILD_T1A2B3_CORPORATE_ACTION_FINISH.md`. `Run` references lines of this report’s execution record. Each named seed describes a deterministic input sequence and can be added to the generator. (`__testsupport__/caSequences.js:334`, `__testsupport__/caSequences.js:1082`, Run:90.)

Unless specified, open a $20,000 AAPL/MSFT idea on November 16. Entry prices are $100 and $200, SPY is $500, and the idea receives 99.970008 AAPL shares. “Sector” uses XLK at $200. S0–S5 are November 16, 17, 18, 19, 20 and 23. The replay harness created a book, admitted the idea, built the daily and tick snapshots from stubbed vendor responses, and called the real entry, close, sale and founder functions. It never rewound a cursor or edited a stored document to produce a finding. The stock harness’s forced replays and the expressly requested planted-backfill control were separate checks. (`__testsupport__/fixtures.js:193`, `__testsupport__/fixtures.js:463`, `__testsupport__/fixtures.js:474`, `__testsupport__/fixtures.js:579`, `__testsupport__/caSequences.js:446`, `Snapshot:477`, Run:90.)

## Findings that meet the dark-merge stop rule

### T2E-01 · Two first-seen dividend dates pay the first one on a sold holding

**Stop (d), also I-2.** Close S1 at $94, sell AAPL at the S2 open, then deliver two $1 dividend rows together at S3, dated S1 and S2. Both dates qualify for entitlement. The sold ledger paid $99.97 on the earlier ID and marked only the later one as a possible re-date. Reversing the array gave the same result. A still-held same-stock comparison held both IDs and paid $0. With a single-name idea already resulted, the same sequence credited $99.97 to treasury and wrote adjustment evidence. No founder had chosen either date. (Run:94, `F1:24`, `F1:33`, `Prior:915`, `ledger.js:1448`, `adjustments.js:301`, `adjustments.js:390`, `adjustments.js:438`.)

**Fix and confirmation.** Before posting a closed holding’s first new action, pair all candidate IDs in that close using the held path’s re-date rule. Persist both sides and require an explicit ruling. Replay seeds `2011202700`, `2011202701` and `2011202706`. The initial close must produce two records and zero adjustment dollars, including in treasury. (`adjustments.js:279`, `adjustments.js:452`, `ledger.js:1448`, Run:94.)

### T2E-02 · Moving a dividend back across the sale date pays it at full quality

**Stop (d), also I-2.** Use the same S2 sale. On S3 the vendor lists $1 dated S3, after the sale. On S4 that listing is gone and the vendor lists $1 dated S2. The sector idea pays $99.97 on a full-quality row with no ambiguity record on its ledger. When the comparison holds AAPL, it recognizes the moved date while the sold ledger still pays it. This sequence requires only one row per close. (Run:96, `F1:22`, `adjustments.js:280`, `adjustments.js:388`, `adjustments.js:441`.)

**Fix and confirmation.** Retain the economic identity of observed rows just outside a closed holding’s entitlement interval for the re-date window. Use that history when an eligible row appears at a later close. Seeds `2011202702–2011202703` must pay $0 until ruled. Preserve the single unambiguous late-dividend control. (`adjustments.js:185`, `adjustments.js:382`, `__testsupport__/caSequences.js:1083`, Run:96, Run:92.)

### T2E-03 · A late split changes cash on a dividend still awaiting a ruling

**Stop (d), also I-2.** Keep AAPL at $100 through S3. Pay $1 on S2. On S3 the vendor revises it to $2, leaving an open `revised_after_ruling` record. On S4 the same $2 row arrives with a 5-for-4 split dated S1 and an $80 quote. The close changes the count correctly but also posts **+$24.99** to the disputed dividend and the book. This reproduced with all three ordinary windows serviced, without a sale or founder ruling. A later founder selection of $2 brings the total to $249.93. The earlier unauthorized adjustment is already in the evidence trail. (Run:98, `F1:29`, `F1:43`, `adjustments.js:201`, `adjustments.js:458`, `adjustments.js:465`, `adjustments.js:475`, `close.js:1087`.)

**Fix and confirmation.** Gate each dividend recomputation on its own unresolved ID as well as on the share basis. Once a founder decision settles that ID, recompute the authorized net entitlement using its actual prior payments. Seeds `2011202704–2011202705` and `2011202707` should preserve $99.97 until that decision. (`adjustments.js:201`, `adjustments.js:465`, `holdRulings.js:427`, Run:98.)

### T2E-04 · Late delivery reverses the order of rounding and changes a settled cent

**Stop (a), I-6.** Hold 99.970008 shares. A 4-for-5 reverse split is effective S1 and a 2-for-1 split S2. Use closes of $125, $62.50 and $62.50. On S3 pay $3.23 per share. With both splits on time the dated chain gives 79.976006, then 159.952012 shares and **$516.64**. Withhold only the S1 listing until S3. The same inputs then give 159.952013 shares and **$516.65**, including the extra cent in book cash. Both rows are full quality. The I-6 oracle itself specifies dated order and rounding after each event. (Run:100, `__testsupport__/caOracle.js:418`, `__testsupport__/caOracle.js:443`, `ledger.js:718`, `ledger.js:1582`, `api/_utils/mandateRounding.js:34`.)

**Fix and confirmation.** When inserting a late share-basis event, replay the affected count from its entry basis in effective-date, phase and ID order, with six-place rounding at each step. Use that count for the holding, the book mirror and subsequent ex-date calculations. Preserve the original receipts and record the difference. Replay `precision-4/5-2/1-3.23` with both listing orders and require $516.64 on each affected ledger. (`adjustments.js:105`, `ledger.js:723`, `close.js:1052`, Run:100.)

## Additional findings that stand in the way of the switch

### T2E-05 · Q-5’s sale correction leaves the row and the eventual result measurable at full quality

**The founder’s proposed remedy is appropriate and is missing at this head.** At S1 report 5-for-4 and a $1 dividend at $66.67. Sell 124.962510 AAPL at S2. At S3 revise the split to 3-for-2 and have the founder select that recorded ratio. At S4 the alert fires and the adjustment names 149.955012 corrected shares. The S4 row and all six subsequent rows through the due endpoint are full quality. The December 1 endpoint eventually produces `behind`, gap **−$1,665.75**, with an empty `unmeasurableBecause`. Its one lower-quality historical row pre-dates the correction. (Run:102, `holdRulings.js:445`, `close.js:549`, `close.js:643`, `settlement.js:214`, `settlement.js:427`, `corporateActionCorrections.lensC.test.js:853`.)

**Fix and confirmation.** Keep the executed sale. Derive a standing quality reason from the durable sale correction, propagate it to subsequent rows and the endpoint, and expose the reason beside the result. A one-fire alert cannot do this. Replay `q5-correct-sold-5/4-to-3/2` through liquidation. Also cover a split first reported after the sale that establishes the same discrepancy between shares sold and shares owed. (Run:102, `adjustments.js:419`, `holdRulings.js:447`, `settlement.js:421`, `settlement.js:498`.)

### T2E-06 · Q-9’s gap screen permits a wrong dividend and sale with 2% price drift

At an exact $100 → $10 move, co-listing 10-for-1 and 1-for-10 on S1 held the dividend and lowered quality. At **$10.20**, both IDs still applied, the gap screen raised no suspicion, and the $1 dividend paid **$99.97** at full quality. A genuine 10-for-1 alone entitles the ledger to $999.70. In the two-ID case the next ordinary window sold **99.970010 shares for $1,019.39**. Base and head both accepted the $10.20 case. The dry run excludes both settled IDs and the residual price ratio 0.102 lies outside the 1.5% tolerance for 1/10. (Run:104, `ledger.js:443`, `Engine:281`, `Engine:351`, `Engine:384`, `api/_utils/mandateConfig.js:263`.)

**Fix and confirmation.** Hold the share count when opposite-direction vendor IDs for the same symbol and effective date could be a direction correction. Require the founder to settle the ambiguity before a dividend or sale uses the count. Increasing a finite price tolerance would still leave reachable gaps. Replay `2011202612–2011202619`, with the exit enabled at the next window. The current backstop is insufficient to send this case to T5. (`adjustments.js:268`, `ledger.js:445`, `exits.js:180`, Run:104.)

### T2E-07 · A losing daily build can certify a rejected winning fetch as clean

Two ordinary calls begin the same day’s build before either creates the daily document. Delay one at the mocked vendor. The other observes a malformed 5-for-4 split (`5:4`) and a valid $1 dividend, records the rejection and wins the daily create. Release the first call with the same dividend and an empty split list. It loses the daily create but overwrites the symbol’s report with zero rejections. Both accepted-action hashes match. The close pays **$99.97 at full quality**. With just the winning fetch, it holds the dividend at $0 and the row is below full quality. The only synchronization was at the HTTP response boundary. (Run:106, `caParseReport.js:108`, `caParseReport.js:163`, `caParseReport.js:208`, `Snapshot:507`, `Snapshot:613`, `dailyCoverage.js:149`, `Cron:412`, `Cron:576`.)

**Fix and confirmation.** Make conflicting observations for the same symbol/session fail closed even when their accepted rows hash identically. A transactionally merged sticky rejection for competing observations is one bounded option. A later clean backfill can establish coverage through the existing path. Replay `dirty-winner-clean-loser`; releasing the losing response after the winning create must preserve the hold. (`dailyCoverage.js:149`, `dailyCoverage.js:236`, `caParseReport.js:163`, Run:106.)

### T2E-08 · An in-holding rejected split is forgotten once the final AAPL holding is sold

Sell AAPL on S2 and keep MSFT open with a sector comparison. On S4 the vendor rejects a split dated S1 (`5:4`). On Monday S5 it still returns that malformed row whenever the queried window includes S1, and first lists a $1 dividend dated S2. Monday’s daily window starts **November 18**, one day after the rejected split. The sold ledger does no historical backfill and pays **$99.97 at full quality**. Change only the comparison to same-stock. The backfill then reaches the rejected row, the dividend stays at $0, and the row is below full quality. The clean Monday report establishes nothing about November 17. (Run:108, `close.js:236`, `close.js:257`, `close.js:410`, `caBackfill.js:65`, `dailyCoverage.js:274`, `adjustments.js:441`.)

**Fix and confirmation.** Carry the rejection floor for an in-holding date through the closed holding’s late-entitlement window. Require the dividend’s historical basis to be covered before posting, including a clean backfill or applicable founder ruling when needed. Replay `sold-sector-rejected-Tue-dividend-Wed` and the same-stock control, with the rejected Tuesday row present in every HTTP response whose window includes it. (`close.js:253`, `close.js:417`, `caBackfill.js:70`, Run:108.)

## Oracle, regressions and isolation

**I-6 computes entitlement independently when it runs. Its decision to skip a payment depends on product state.** The expected side uses listed rows, accepted founder choices, entry shares, the observed sale, dated splits and per-event rounding. Received cash comes from receipts and posted adjustments. Before comparing, `doubtOn` scans all three product ledgers for that symbol. A cash ambiguity on a different dividend can excuse the current one. I-2 independently checks applied receipts, but a late dividend posted entirely as an adjustment has no applied cash receipt for that check. (`__testsupport__/caOracle.js:278`, `__testsupport__/caOracle.js:370`, `__testsupport__/caOracle.js:382`, `__testsupport__/caOracle.js:430`, `__testsupport__/caOracle.js:442`, `__testsupport__/caSequences.js:355`.)

**The excuse hid a real wrong payment.** On T2E-04 the stock oracle rejected $516.65 against $516.64. Adding a different $0.10/$0.20 conflicting dividend left that $516.65 payment unchanged and turned the entire stock run green. T2E-01, T2E-02 and T2E-03 also passed the unmodified sequence assertions. For confirmation, check every new monetary adjustment against the ambiguity and ruling history of its ID, and scope entitlement exceptions to facts that can change the specific ledger’s ex-date count or amount. A temporary hold can excuse a payment waiting to post. It cannot justify a new payment that the inputs forbid. (Run:110, `F1:43`, `__testsupport__/caOracle.js:278`, `__testsupport__/caOracle.js:435`, `__testsupport__/caOracle.js:442`.)

| Review item | Independent result |
|---|---|
| `fbf83457` and FA4 | Confirmed the equivalence in this planner. Line 386 removes each ruled ID using the same all-ledger predicate as line 416. The only later additions are coverage-gap IDs. The FA4-only change passed 80/80 targeted tests. Removing the upstream filter killed four retained seeds. Removing both filters killed three of the 80 targeted rows. The builder used a larger battery. (`close.js:361`, `close.js:386`, `close.js:390`, `close.js:416`, `holdRulings.js:474`, Run:114.) |
| `747a92e4` | Rejected rows dated before entry or on entry day released after clean coverage. Both same-date split IDs on a sold holding applied in deterministic order once the doubt cleared, including both listing orders. The canonical comparison of `lateDataUnsettled` passed the reordered-map controls. A correction waiting at the endpoint was named and left the historical result unmeasurable after later posting. The sold-line floor and Q-9 counterexamples concern different inputs. (`close.js:257`, `adjustments.js:268`, `close.js:821`, `settlement.js:216`, `settlement.js:375`, `corporateActionCorrections.fixRound.test.js:330`, `corporateActionCorrections.lensC.test.js:837`, Run:112, Run:124.) |
| D01 and D02 | Reviewed revision-before-re-date ordering and how a disputed pending suspicion split preserves disagreeing vendor rows. Their committed fixed and ordered cases passed, including the previously retained seed family. (`ledger.js:1299`, `close.js:328`, `close.js:348`, `__testsupport__/caSequences.js:618`, `corporateActionSequences.ordered.test.js:34`, Run:124.) |
| SOAK-R3-1, SOAK-R3-2, AR3-RF-2 and AR3-RF-5 | The fixed cases passed for the founder split that meets a possible re-date, the moot split that previously held up a later split, the pending split that conflicted with a previously held vendor row, and the gap ruling that can repeat a vendor dividend. R-1 refuses the disputed founder split. R-2 preserves the in-gap and already-settled exceptions. R-3 holds both orderings of a competing coverage-gap row. These stricter holds agree with the founder’s rulings. (`Prior:1163`, `Prior:1171`, `ledger.js:1083`, `ledger.js:1396`, `__testsupport__/caSequences.js:652`, `__testsupport__/caSequences.js:676`, `__testsupport__/caSequences.js:691`, `corporateActionStickyAmbiguity.test.js:637`, `corporateActionStickyAmbiguity.test.js:658`, Run:124.) |
| Founder and adjustment evidence | On the head, a $3 choice outside the recorded $1/$2 payloads returned 422. The recorded $2 choice returned 200 and paid $199.94 total. The pending-correction regression left a later unseen $3 open. The founder authorization, owner, request-key replay, covered-suspicion and gap-ruling cases passed. Posting and the sealed evidence create are staged inside the same close transaction. The three ambiguous-ID findings produced actual adjustment entries. The confirmed reason for invoking (d) is the missing authority to post those entries. (`api/practice-field/founder.test.js:57`, `founderControls.js:36`, `holdRulings.js:200`, `holdRulings.js:270`, `holdRulings.js:427`, `corporateActionFinish.test.js:1010`, `corporateActionCorrections.lensC.test.js:792`, `evidence.js:74`, `close.js:1286`, `close.js:1296`, Run:92, Run:94, Run:98.) |
| All arrival orders | Ran all six permutations of late split, dividend and correction of an earlier split, with same-stock and sector comparisons. Every own ledger ended at $199.94. Ran all six permutations with a correction of an earlier dividend and a second dividend. Every own ledger ended at $312.41. The retained AR4-C-1 test also passed. T2E-03 covers the intermediate interval when the correction is still unruled. (`__testsupport__/caSequences.js:1126`, `adjustments.js:455`, `adjustments.js:486`, Run:112, Run:98.) |
| Parse wrapper and quarterly isolation | The untracked-symbol branch returns the base call directly. A tracked symbol passes a response observer to one base call and returns its result. The observer reads each response body once. The clean, rejected, missing and mismatched-report controls passed. In the two-quarterly-mode comparisons the wrapper added no vendor call or report. With an idea book present the losing-publication case T2E-07 defeated the clean-report inference. (`caParseReport.js:133`, `caParseReport.js:198`, `caParseReport.js:214`, `sweep.js:164`, `dailyCoverage.js:149`, `corporateActionCorrections.test.js:494`, `corporateActionCorrections.test.js:500`, Run:106, Run:118.) |
| End-to-end dump and fence | The comparison first checks report count and each report’s complete contents against its daily-layer symbols. It then excludes paths beginning with the report collection prefix and serializes the entire remaining map. The observed 28 reports were the only excluded entries. All 191 remaining documents matched base byte for byte. The unchanged flag, rules, indexes, calibrated files and two common engine modules were verified against the pinned base. (`endToEnd.test.js:337`, `endToEnd.test.js:345`, `src/config/practiceFieldFlags.js:33`, `docs/BUILD_RULES.md:10`, `docs/design/20261113_PRACTICE_FIELD_AMENDMENT_E_EXITS_SETTLEMENT_RESULTS.md:53`, Run:120, Run:122.) |

**Fire time budget.** The ten-second wait applies independently to a symbol fetch. The daily builder waits for each group of eight before starting the next group. With a never-settling report writer, 240 required symbols and instantaneous upstream responses, the real daily builder consumed **300 seconds of simulated time**. Only one report write started. A single affected group costs about ten seconds beyond its upstream time in this test. Thirty such groups consume the handler’s entire 300 seconds before ordinary work, beyond its 290-second work budget. This is a T5 capacity observation with an idea book present. The test establishes the scaling behavior and does not estimate a founder account’s symbol count. (`caParseReport.js:46`, `caParseReport.js:179`, `caParseReport.js:208`, `Snapshot:485`, `Snapshot:531`, `Cron:73`, `Cron:412`, `Cron:538`, `api/_utils/mandateConfig.js:94`, Run:116.)

## Execution record

The following are observed values from this review. Monetary values are USD. The named seeds in the findings specify the dates, row bodies, order, prices, compare arm and founder decisions needed for replay. (`Engine:66`, `Engine:96`, `__testsupport__/fixtures.js:579`, Run:90.)

**Run setup.** Fetched origin before the offline investigations. Detached base and head matched the supplied revisions. The review used local test doubles, a deny-by-default fetch stub installed before imports, and a demo-only loopback rules emulator. Vendor HTTP fixtures used a literal dummy argument at the parser seam. The vendor environment key was kept empty. The quarterly probe adaptation substituted that dummy default in its test loader. No product edits, PR actions or real service calls. (`Snapshot:430`, `__testsupport__/fixtures.js:193`, `__testsupport__/fixtures.js:603`, `test/rules/practiceFieldIdeaBookOwnerRead.rules.mjs:82`.)

**Base → head positive controls.** T2D-03, $0 → $99.97. T2D-04, $99.97 → $124.96. On-time 5-for-4, both $124.96 with 124.962510 shares. T2D-05, base returned 404 for either proposed correction. Head returned 422 for unseen $3, then 200 for recorded $2. T2D-12, base paid $99.97 at full quality on the rejected split session, head paid $0 below full quality. (`__testsupport__/caSequences.js:1083`, `__testsupport__/caSequences.js:1093`, `holdRulings.js:270`, `close.js:261`.)

**Paired dates.** Independent allowlist seeds 2011202700 and 2011202701, own cash and book cash +99.97, one evidence document, one held second ID, zero rulings. A same-stock comparison paid zero. Seed 2011202706, single-name idea already resulted, treasury +99.97, one evidence document. (`adjustments.js:390`, `adjustments.js:444`, `close.js:1127`.)

**Moved across sale.** Seeds 2011202702 and 2011202703, sold 99.970008 at S2. S3 lists $1 ex S3, S4 lists $1 ex S2 alone. Sector book cash 89394.36 → 89494.33, own ledger ambiguity count zero, S4 full quality. Same-stock comparison held the moved ID. (`adjustments.js:280`, `adjustments.js:388`, `adjustments.js:450`.)

**Unruled dividend.** Seeds 2011202704, 2011202705 and 2011202707, +24.99 before the founder’s choice. In the all-windows variant S1–S3 closed at 100 and S4 at 80, own shares 124.962510, own received 124.96, book cash 80124.96, row below full quality. Later selecting $2 yielded 249.93 total in the ruled control. (`adjustments.js:458`, `adjustments.js:475`, `close.js:1087`.)

**Dated rounding.** `precision-4/5-2/1-3.23`. On-time and late arms respectively produced 159.952012 and 159.952013 shares, 516.64 and 516.65 income, book cash 80516.64 and 80516.65, both rows full quality. (`ledger.js:723`, `ledger.js:1582`, `__testsupport__/caOracle.js:443`.)

**After-sale quality.** `q5-correct-sold-5/4-to-3/2`. November 18 sale receipt retained 124.962510 shares, corrected equivalent 149.955012. November 20 alert count one, subsequent counts zero. S4–S10 row quality true each time. December 1 endpoint values 18472.71 and 20138.46. Result gap −1665.75, label behind, reasons empty, 1/11 historical rows below full quality. A separate first-listing control sold 99.970008 before the five-for-four arrived and the retrospective split row also read full quality. (`holdRulings.js:447`, `corporateActionCorrections.lensC.test.js:853`, `close.js:643`, `settlement.js:427`.)

**Opposite ratios.** Same-date 10/1 and 1/10 from a $100 close. Prices $10 and $10.10 produced a hold and zero dividend. Prices $10.20 and $10.40 produced 99.97 and full quality in four of eight generated cases. At $10.20 the next-window sale paid 1019.39 for 99.970010 shares. Clean 10/1 alone at $10 paid 999.70 on 999.700080 shares. (`Engine:281`, `ledger.js:445`, `exits.js:275`.)

**Competing daily builds.** `dirty-winner-clean-loser`. Winning report before release, one reject. After the losing fetch completed, zero rejects, identical accepted-action hashes. Raced and serial values respectively were 99.97/0 and full/below-full quality. The daily build API reported the dirty caller won and the clean caller adopted its document. (`Snapshot:613`, `caParseReport.js:163`, `dailyCoverage.js:152`.)

**Rejected historical basis.** `sold-sector-rejected-Tue-dividend-Wed`. S4 rejected Tuesday’s split, S5 window started Wednesday. The sector arm had no AAPL backfill and paid 99.97, book cash 89494.33, full quality. Same-stock arm had a failed backfill, a coverage floor of November 16, $0 and below-full quality. (`caBackfill.js:65`, `close.js:257`, `close.js:410`.)

**Oracle replay.** Stock assertions accepted three histories with adjustment amounts +99.97, +99.97 and +24.99. Their I-6 equality/excused counts were 0/4, 0/2 and 2/4. The precision seed without a second disputed dividend raised an equality failure showing $516.65 received and $516.64 owed. Adding the unrelated $0.10/$0.20 pair produced 0 equality checks, 4 excuses, and the same payment. (`__testsupport__/caOracle.js:382`, `__testsupport__/caOracle.js:430`, `__testsupport__/caOracle.js:448`.)

**Fresh generated histories.** Late 2026112000–2026112999, 1000/1000 passed, 10,074 sessions, 19,148 closes and replays, 37,441 I-6 equalities, 21,337 excuses and 2,942 zero-entitlement checks. Ordered 2076112000–2076112399, 400/400 passed, 8,010 closes, 121 clean histories. Wide 2086112000–2086112159, 160/160 passed, 3,300 closes, 43 clean. Extended 2011202600–2011202611, six arrival permutations × two comparisons, $199.94 in all 12. Seeds 2011202612–2011202619 split evenly between held and unsafe Q-9 outcomes. Seeds 2011202620–2011202627 covered malformed splits or dividends dated before/on entry, all cleared. Seeds 2011202628–2011202635 exercised both orderings of two share-basis IDs after sale, with and without a dirty first report, all finished at $99.97. Dividend-correction permutations 2011202800–2011202805 all finished at $312.41. (`corporateActionSequences.late.test.js:19`, `corporateActionSequences.late.test.js:48`, `corporateActionSequences.soak.test.js:23`, `__testsupport__/caOracle.js:435`, `__testsupport__/caOracle.js:446`.)

**Mutation check.** FA4 alone 80/80 pass. FS1 alone 4/80 fail, seeds 1795727403, 1795729529, 1795731153 and 1795731607. Both together 3/80 fail in the targeted files. The builder reports four failures for the combined mutation over its larger selection. (`close.js:386`, `close.js:416`, `Build:303`, `Build:309`.)

**Write timeout.** With 240 symbols, eight per group, one unresolved report write and no upstream delay, the wrapper returned 240 base results to the daily build after 300,000 simulated milliseconds. No simulated time was charged for fundamentals or HTTP. (`caParseReport.js:179`, `caParseReport.js:207`, `Snapshot:531`, `Cron:74`.)

**Quarterly differential.** 36/36 tests comprise 34 scenario/mode comparisons, a 4,000-build-set check, and a prompt test with four byte comparisons and four positive controls. Separately 40/40 traced fires matched base including database operations, responses, logs, and fake upstream/model calls. Planted backfill 4/4 across off/on produced 100 shares for the plant or 200 from the stub vendor, with $90,000 cash throughout. (Prior harness `astra-differential.test.js:47`, `astra-cron-trace.test.js:49`, `plant.test.js:49`, as located in `docs/audits/20261119_ASTRA_CONFIRMATION_T1A2B3_ROUND2.md:8`.)

**Dump.** Base and head, 443,533 UTF-8 bytes, bytewise equality true, SHA-256 `abcf842026a3d5c4ce4f2c3a858dbd5fcabad2a3388df6c73b3f944ce7c24ed9`. Head validated 28 report documents and compared the remaining 191 with base. (`endToEnd.test.js:337`, `endToEnd.test.js:345`, `endToEnd.test.js:348`.)

**Fence and heads.** Production flag remains `off`. Base/head rules Git blob `34beb0ccf73f047191b63d3996024ee4a6d4b7d7`, indexes blob `6dc9318fb7fa110b6f82ec49025583696de80bb4`. No diff in the flag, pins, calibrated fence, common engine or snapshot builder. The cron passes idea book IDs to build inputs. After the product head, the only changes were tests and documentation. (`src/config/practiceFieldFlags.js:33`, `docs/BUILD_RULES.md:10`, `Cron:141`, `Build:53`.)

**Suite results and limits.** Focused accounting, API, cron and protected-store tests 1,246/1,246 across 35 files. The final rules run on the committed LF bytes passed 841/841 across 46 files. Windows CRLF first gave 840/841. The identical text assertion also failed on base CRLF because its line-comment pattern retained an inline comment. No rule was edited. The builder’s full 36,501-test run, original 12,400-history ranges and full 61-mutant aggregate are builder-reported, not independently rerun in full. (`test/rules/agentEvalRunsDenials.rules.mjs:133`, `test/rules/agentEvalRunsDenials.rules.mjs:140`, `test/rules/practiceFieldIdeaBookOwnerRead.rules.mjs:82`, `api/_utils/compositionProtectedStores.scan.test.js:51`, `Build:155`, `Build:301`, `Build:423`.)

### Copyable generator inputs for the dark-merge blockers

These four plans use the shipped sequence step format. In an S-6 Vitest file, import `S` and `run` from `./__testsupport__/caSequences.js`, use its normal `installSequenceHooks()`, and run each plan. `expectIdea` adds the assertion the existing stock tests missed. The new assertions require the fixed outcomes for the first three. The fourth is already rejected by stock I-6. The ordinary entry-point replays above establish reachability independently of the generator’s I-5 forced replay. (`__testsupport__/caSequences.js:334`, `__testsupport__/caSequences.js:368`, `__testsupport__/caSequences.js:374`, Run:94, Run:96, Run:98, Run:100, Run:110.)

```js
import { expect, it } from 'vitest';
import { S, run, installSequenceHooks } from './__testsupport__/caSequences.js';
import { parseDividendsPayload, parseSplitsPayload } from '../mandateCorporateActions.js';

installSequenceHooks();
const dividend = (day, amount) =>
  parseDividendsPayload('AAPL', [{ date: S[day], unadjustedValue: amount }]).actions[0];
const split = (day, ratio) =>
  parseSplitsPayload('AAPL', [{ date: S[day], split: ratio }]).actions[0];
const close = (i, price, rows = [], extra = {}) => ({ kind: 'close', i, price, rows, ...extra });
const income = (usd) => ({
  kind: 'expectIdea',
  fn: (idea) => expect(idea.ledger.dividendsUsd).toBe(usd),
});
const sold = [
  close(0, 100), close(1, 94, [], { belowLine: true }),
  { kind: 'window', i: 2, price: 94 }, close(2, 94),
];
const plans = [
  ['T2E-01', [...sold, close(3, 94, [dividend(1, 1), dividend(2, 1)]), income(0)]],
  ['T2E-02', [...sold, close(3, 94, [dividend(3, 1)]), close(4, 94, [dividend(2, 1)]), income(0)]],
  ['T2E-03', [close(0, 100), close(1, 100), close(2, 100, [dividend(2, 1)]),
    close(3, 100, [dividend(2, 2)]), close(4, 80, [split(1, '5/4'), dividend(2, 2)]), income(99.97)]],
  ['T2E-04', [close(0, 100), close(1, 125), close(2, 62.5, [split(2, '2/1')]),
    close(3, 62.5, [split(1, '4/5'), split(2, '2/1'), dividend(3, 3.23)]), income(516.64)]],
];
for (const [seed, steps] of plans) {
  it(seed, async () => {
    await run({ seed, steps, comparison: { type: 'sector_fund', symbols: ['XLK'] } });
  });
}
```

## Closeout

| Revision | Full commit |
|---|---|
| Base, tested | `41c04cd21fd38d467b8c8cbc354486aa8dd7a2aa` |
| Builder review boundary, inspected | `994ccc2eb5e5ad337f7511da5c105178bbf13a13` |
| Fix-round refuter boundary, inspected | `de858e2661b8c90ef06bfaf53b427afe17ea8267` |
| Ruled-ID fix, inspected | `fbf83457c66cbd4a8116ff33b0985f4ab87f6499` |
| Product head, inspected | `747a92e4ab3a116916e52ac5782c58d7eb82bd90` |
| Draft PR head, tested in Windows and LF checkouts | `df9b7278a9267815d35442e9b7183a18a519a6f7` |

**Rules 841/841. Differentials 36/36 and 40/40. Planted control 4/4.** All 1,560 fresh stock-generator histories passed. The independent extensions and ordinary entry-point replays exposed the eight findings above. Seed ranges and outcomes are in the execution record. (Run:112, Run:124, Run:118, Run:110.)

**Dark merge — DO NOT MERGE.** T2E-01 through T2E-03 meet (a) and (d). T2E-04 independently meets (a). **Founder switch — NOT READY.** In addition to those four money defects, the switch requires durable post-sale quality (T2E-05), protection against opposite same-date split IDs (T2E-06), retention of a winning fetch’s rejection under concurrent publication (T2E-07), and historical parse coverage on a sold line (T2E-08). These are the eight confirmation targets. The fire-budget observation belongs to T5. (Run:94, Run:96, Run:98, Run:100, Run:102, Run:104, Run:106, Run:108, Run:116.)

Report file · `C:\Users\fashr\.codex\visualizations\2026\11\20\01a1f9bc-a556-7061-aa30-d7a10622a735\20261120_ASTRA_REVIEW_T1A2B4.md`
