# Astra confirmation · Practice Field T1a-2b-4

**Dark merge: DO NOT MERGE. Founder-only allowlist switch: NOT READY.** At `5fa63271`, a held idea paid **$199.94** on a dividend the vendor had revised before its ex-date. Three further histories posted an approved adjustment while an L-2 refusal still stood. All four produced full-quality rows. A fifth history stranded a pending AAPL sale and affects the switch only. The five acceptance tests in the appendix fail at the stated money or founder-response assertions. (Run:72, Run:80, Run:82, `ledger.js:1103`, `adjustments.js:829`, `close.js:199`.)

The eight original histories passed on the candidate, as did the clean-money, quarterly, planted-backfill and end-to-end controls. The generated histories omit the order that exposed the first three blockers. The fourth requires a competing observation after the close has fetched its clean backfill. (Run:84, Run:86, Run:100, Run:102, Run:94, `Build:1106`, `caParseReport.js:197`.)

**Reading the evidence.** Bare product filenames are under `api/_utils/practiceField/`. `Seq` and `Oracle` are `__testsupport__/caSequences.js` and `__testsupport__/caOracle.js` there. `Asks`, `Refuter` and `Plans` are `corporateActionLateAsks.test.js`, `corporateActionLateAsks.refuter.test.js` and `corporateActionLateAsks.astraPlans.test.js`. `Snapshot` is `api/_utils/mandateUniverseSnapshot.js`. `Build` and `Original` are `docs/audits/20261120_BUILD_T1A2B4_CORRECTIONS_AND_PARSE_COVERAGE.md` and `docs/audits/20261120_ASTRA_REVIEW_T1A2B4.md`. `F` is `docs/design/20261118_PRACTICE_FIELD_AMENDMENT_F_REV1_STICKY_AMBIGUITY.md`. `Run` refers to a line in this report. The executable appendix uses S0–S6 for November 16, 17, 18, 19, 20, 23 and 24, 2026. It uses the allowlist test mode, an ordinary $20,000 two-name entry, raw vendor-shaped rows clipped to the requested date window, the daily and tick builders, and the real book functions. Its only scheduling hook releases a competing builder. (`Seq:24`, `mode.js:45`, `coverage.js:58`, `Snapshot:520`, `__testsupport__/fixtures.js:193`, `__testsupport__/fixtures.js:474`, `__testsupport__/fixtures.js:579`, Run:108.)

## Findings

### T2E-C01 · The held ledger forgets a dividend or split announced before its effective date

**Dark stop (a), I-2.** On Tuesday the parsed feed listed a $1 dividend for Thursday. On Wednesday it revised the same ID to $2. On Thursday the $2 listing paid **$199.94** on 99.970008 shares, raising book cash from $80,000 to $80,199.94 at full quality, with zero founder rulings. An even shorter ambiguity history announced both $1 and $2 together, then withdrew $2. The remaining $1 paid $99.97. A founder attempting to resolve that announced conflict received 404. The dated inputs also make the shipped I-2 oracle fail. (Run:74, Run:92, `F:24`, `F:33`, `ledger.js:1103`, `ledger.js:1138`.)

The same loss of history moved shares. A Thursday 2-for-1 announced on Tuesday became 3-for-2 on Wednesday. Thursday’s close changed 99.970008 AAPL shares to **149.955012** and paid a $149.96 dividend at full quality. Moving a $1 dividend forward from Thursday to Wednesday paid $99.97 on Wednesday. An unchanged advance declaration paid once when due. Withdrawing the only declaration paid $0. The real daily query includes a two-calendar-day lookahead, and the ledger drops future-dated rows before comparing their payloads. (Run:74, `Snapshot:520`, `ledger.js:978`, `ledger.js:1103`, `ledger.js:1303`.)

**Fix and flip condition.** Observe pending vendor IDs and payloads on the holding from their first listing. On a revision, conflict or possible re-date, make the record founder-addressable and keep it through the effective date. Only a due, eligible and undisputed row can apply automatically. Replay `H-revise`, `H-conflict`, `H-move` and `H-split`, with the unchanged and withdrawn controls. A merged fix and these passing rows clear this item for the flip. (`F:22`, `F:43`, `ledger.js:1103`, Run:74.)

### T2E-C02 · A held dividend’s approval posts beside an already listed re-date candidate

**Dark stop (d), L-2(2), also I-7.** Pay $99.97 on Tuesday’s $1 dividend. On Wednesday a 5-for-4 effective Tuesday establishes 124.962510 entitled shares and a +$24.99 proposal. The founder approves. Thursday’s close sees the same $1 under Friday’s date and nevertheless posts **+$24.99**, for $124.96 total and $80,124.96 book cash at full quality. Friday recognizes the re-date after the adjustment has posted. Change only the candidate’s effective date to Thursday and the approval waits at $99.97. A companion run already had the matching future row in Wednesday’s daily document when the request returned 200. (Run:76, Run:92, `Build:663`, `ledger.js:1103`, `holdRulings.js:188`, `adjustments.js:795`, `adjustments.js:829`.)

**Fix and flip condition.** Include announced unresolved candidates in the held proposal’s pairing check, recompute its blockers at every posting close, and expose the matching ID to the founder. `held-request-forward-pair` must refuse approval with 409 while the partner stands. In `held-post-forward-pair` an already accepted approval must wait. Rule the partner `none` and verify one net posting followed by an inert replay. A merged fix and both sides of this regression clear this item. (`holdRulings.js:180`, `holdRulings.js:344`, `adjustments.js:812`, `Refuter:412`, Run:76.)

### T2E-C03 · A sale discards the earlier side of a dividend revision or re-date

**Dark stop (d), L-2(1)/(2).** With AAPL still held, Tuesday’s feed announces $1 for Thursday. Tuesday closes at $94, Wednesday’s normal window sells all 99.970008 shares, and on Thursday the vendor lists the same $1 for Wednesday, inside the entitlement interval. The approval returns 200 and Friday posts **$99.97** at full quality, lifting book cash from $89,394.36 to $89,494.33. The input-based I-7 detects the unanswered re-date. In another run, Tuesday announced $1 for Wednesday and the post-sale feed revised that same ID to $2. Approval paid **$199.94** at full quality. When the first observation occurs after the sale, the closed path does retain it, records the re-date and pays $0. (Run:78, Run:92, `ledger.js:1103`, `adjustments.js:381`, `adjustments.js:405`, `adjustments.js:432`, `Asks:81`.)

**Fix and flip condition.** Carry the holding’s observed IDs, dates and payloads across sale into the closed ledger’s revision and re-date comparisons, including the observations just outside the interval. Replay `sold-moved-past-sale` and `sold-changed-past-sale`. A conflict must stand before an approval can pay. Keep `sold-pair-only-after-sale` and the simple withdrawn case as controls. The merged handoff and passing rows clear this item. (`Build:610`, `adjustments.js:412`, `adjustments.js:438`, `adjustments.js:791`, Run:78.)

### T2E-C04 · A newer rejection is cleared by an older clean backfill

**Dark stop (d), L-2(4).** Wednesday’s sale closed the AAPL holding. Thursday’s late $1 dividend for Wednesday received one approval. Friday’s malformed split for Wednesday held the cash. On Monday three competing daily builds saw a malformed `5:4`, a clean response and then a newly malformed `3:2` for the same effective date. The real close wrote its clean backfill at **21:25 UTC**. Only then did the last builder fetch the response recorded at **21:26 UTC**. The merged report preserved both rejected rows and read uncovered. The close nonetheless erased the standing doubt about Wednesday. Monday stayed below full quality. On Tuesday the daily window no longer reached Wednesday, and the waiting approval posted **$99.97 at full quality**. The vendor double continued to return the bad row for requests covering its date. (Run:80, `Build:625`, `caParseReport.js:137`, `dailyCoverage.js:68`, `close.js:194`, `close.js:199`, `caBackfill.js:82`.)

The close stores a date’s first `seenOn`, leaves that value in place when the same effective date is rejected again, and compares the backfill’s range end with that old session. The following pass requests closed-holding backfill from the remaining doubt dates. In the control where every subsequent backfill still rejected the row, the standing date survived and cash stayed $89,394.36. A genuinely later clean backfill allowed one $99.97 payment. (Run:80, `close.js:193`, `close.js:199`, `caBackfill.js:82`, `caBackfill.js:146`, `adjustments.js:829`.)

**Fix and flip condition.** Retain the latest rejection evidence for each effective date and clear it only with a clean covering observation that demonstrably follows it. Use an ordering that survives a late transaction commit and retry. If the observations cannot be ordered, retain the doubt for a subsequent clean refetch. Replay `natural-dirty-after` with both order controls. **Targeted recheck before the flip** on the merged fix, including the next session after the bad date leaves the daily window. This item spans the report transaction, the backfill write and the next close. (`caParseReport.js:143`, `caParseReport.js:197`, `close.js:1081`, `close.js:1538`, Run:80.)

### T2E-C05 · A refused reverse split leaves a breached line without a founder exit

**Switch only.** This reproduces the builder’s Q14-5 concern on an actual pending sale. Tuesday’s $94 close breaches AAPL’s $95.0285 line. Wednesday lists a parseable `1/1000000000` reverse split. Applying it to 99.970008 shares rounds the holding to zero. The close retains `rounds_to_nothing`, and the valid `conflict / none` request returns 404. With the refused row removed from later vendor responses, ordinary sale windows still leave AAPL in the book. Even a later ruled split of the same date waits behind it. On December 3 AAPL still had 99.970008 shares after MSFT’s December 2 liquidation. The input magnitude is explicit in the seed. (Run:82, `Build:1193`, `ledger.js:1496`, `ledger.js:1687`, `holdRulings.js:308`, `exits.js:192`.)

**Fix and flip condition.** Let the founder rule `none` on this durable, own-ledger, refused share-basis record, with an ordinary receipt and replay protection. Keep the sale held until that decision applies. Replay `C05 refused reverse split has a founder exit` and the Q-14 companion in the execution record. The merged fix and a row that actually completes the previously queued sale clear this switch item. (`holdRulings.js:258`, `holdRulings.js:308`, `ledger.js:836`, `exits.js:229`, Run:82.)

## Checks against the earlier review

| Original finding | Candidate replay and independent variant |
|---|---|
| T2E-01 | Both sold IDs held, $0. Reversed the array and used $1.13 on both dates. Both IDs still held and book cash stayed $89,394.36. (`Seq:1344`, Run:86.) |
| T2E-02 | The original post-sale move held. Listing $1.13 for Friday on Thursday, after the Wednesday sale, then moving it to Wednesday also held at $0. C03 changes which side of the sale first saw the row. (`Seq:1365`, `adjustments.js:412`, Run:78, Run:86.) |
| T2E-03 | The original $1 → $2 revision and a $1 → $3 variant both kept the $99.97 already paid when the late 5-for-4 arrived. The ruled original finished at $249.93. (`Seq:1383`, `Seq:1390`, Run:86.) |
| T2E-04 | Both original arrival orders gave 159.952012 shares and $516.64. Reversing the late rows with a $3.24 dividend gave $518.24 and book cash $80,518.24. (`Seq:1427`, `Plans:32`, Run:86.) |
| T2E-05 | The original after-sale correction carried its quality reason to the result. Changing the chosen ratio from 3/2 to 8/5 also kept every subsequent row below full through the December 1 endpoint and yielded an unmeasurable result. (`Asks:299`, `holdRulings.js:495`, Run:86.) |
| T2E-06 | The eight retained price/order cases held the count. At $10.30, reverse ID first with a $1.13 dividend between the two input rows, income stayed $0, shares stayed 99.970008 and the next window left AAPL unsold. (`Seq:1405`, Run:86.) |
| T2E-07 | The dirty-winner/clean-loser replay held. Three real competing builders retained both rejected bodies in the report. C04 shows the separate failure when that report meets a backfill. (`Asks:132`, `caParseReport.js:197`, Run:80.) |
| T2E-08 | The retained sector and same-stock arms held. Repeating the Tuesday reject Thursday and Friday with a $1.13 late dividend also left income at $0. The Monday proposal was open and its row below full. (`Seq:1440`, `Asks:258`, Run:86.) |

**Approval, decline and release.** The committed endpoint checks exercised each of the four 409 reasons, an approval that posts the close-time net once, a duplicate while pending, decline, request replay, and a second proposal after a new fact. A clean backfill or an applicable ruling released the covered cases. The re-date partner can be ruled `none`, and the two Q-14 IDs have a joint founder exit in both ID orders. A purported approval cannot cure an ambiguous action on its own. C01–C04 show where those protections fail. (`Asks:198`, `Asks:216`, `Asks:231`, `Asks:237`, `Asks:249`, `Asks:258`, `Asks:375`, `Refuter:316`, `Refuter:412`, Run:90, Run:88.)

**Oracle independence.** The input oracle caught C01 as I-2 and C02/C03 as I-7 when I supplied the early rows. The $0.10/$0.20 control exposed the former $516.65 versus $516.64 error on the old product and checked $516.64 on the candidate. I-6 still consults product receipts, held rows, suspicions and coverage gaps when it excuses an equality. I-7 independently records which founder request succeeded, but its late-posting authority count groups approvals by ledger and action ID. It also consults product receipts for a pairing exception, and the sold-coverage oracle uses a later catch-up as a proxy for clean data. (`Oracle:84`, `Oracle:456`, `Oracle:499`, `Oracle:521`, `Oracle:562`, `Oracle:578`, `Oracle:684`, `Asks:46`, Run:92.)

**A test-only gap.** In a synthetic oracle input, approval of proposal 1 authorized a fabricated posting bearing proposal 2 and a different request key. I-6 caught the $1 overpayment in the clean case. Adding a product-only comparison-ledger split conflict before the ex-date made I-6 excuse it, and I-7 still accepted it. This belongs in the oracle suite. Match the posting to one exact, unconsumed request/proposal and check the movement’s net before applying a waiting-state excuse. The normal two-idea and replay controls passed. (`Oracle:458`, `Oracle:489`, `Oracle:499`, `Oracle:580`, `Oracle:684`, Run:92, Run:88.)

**The remaining code called out by the brief.** The final soak’s product predicate checks that an inside share action was founder-ruled after the outside candidate first appeared. The I-7 exception allows a ruling-authorized late entitlement; approval-only postings and late-basis postings otherwise undergo refusal checks. Both retained seeds passed. The Q-14 checks covered the earlier EQ-1 ordering, the opposite ordering, and a new same-date ID listed two ways. F-1’s stale-backfill fix reproduced its retained successes, but C04 breaks it on a later observation for the *same* rejected effective date. (`adjustments.js:776`, `Oracle:496`, `corporateActionSequences.late.test.js:130`, `Refuter:735`, `Refuter:827`, `Refuter:938`, Run:90, Run:96, Run:80.)

**NL2c.** I confirm equivalence on the reachable monetary paths examined. A posted late entitlement adds the dividend to `paidDividends`. A late-basis posting or a dividend correction requires a previously paid ID. Cashless split-correction records cannot add anything to the unpaid dividend’s sum. Thus when the unpaid branch at line 739 is reached, its previous monetary postings sum to $0. I independently reran the full corpus, including the one-cent positive control. (`adjustments.js:152`, `adjustments.js:158`, `adjustments.js:681`, `adjustments.js:691`, `adjustments.js:739`, `corporateActionLateAsks.equivalence.test.js:64`, Run:98.)

## Execution record

**Inputs and isolation.** The three existing worktrees resolved to the full heads below. `git fetch origin` used an isolated Git directory with its origin set to the on-disk repository and its transports restricted to files. The fetched review branch matched both the local branch and the checkout’s cached remote-tracking ref. Upstream freshness beyond that cache was unverified under the offline instruction. Tests ran on disposable exports from those Git objects. Accounting and differential processes had TCP disabled and used a fresh synthetic environment. The separately authorized rules tests used a demo emulator on loopback. (`mode.js:21`, `__testsupport__/fixtures.js:193`, `vitest.rules.config.mjs:5`, Run:284.)

**Acceptance replay.** I executed the five tests printed below against the candidate. Expected → observed: C01 $0 → $199.94, C02 $99.97 → $124.96 total income, C03 $0 → $99.97, C04 $0 → $99.97, C05 HTTP 200 → 404. Each reached the named assertion. The C04 test first verified a real clean backfill, completed close, three parse observations and two retained rejects. The C05 test first verified the own-ledger refusal. All entries, sales, approvals and ledger mutations in these five histories came from the product. (Run:108, `Snapshot:477`, `Snapshot:641`, `close.js:1538`, `api/_utils/__testsupport__/mandateFakeFirestore.js:307`.)

**Advance listings on a held idea.** Replay S0 entry at $100, then S1 and S2 quotes of $100. All observations use a Thursday S3 ex-date unless specified. `H-revise` lists [$1], [$2], [$2] at S1–S3 and pays $199.94. `H-conflict` lists [$1,$2], [$1], [$1] and pays $99.97. `held-early-ruling` returns 404 when the founder chooses the seen $1 before maturity. `H-move` lists Thursday $1 on Tuesday, Wednesday $1 on Wednesday, pays $99.97. `H-split` lists Thursday 2/1, then 3/2, then 3/2 and $1 with a $66.67 close. The full-quality row has 149.955012 shares and $149.96 income. `H-baseline` keeps $1 through Thursday, pays once. `H-withdraw` drops it and pays $0. (`Snapshot:521`, `ledger.js:1103`, `ledger.js:1138`, Run:108.)

**Request-time and posting-time L-2(2).** In `held-post-forward-pair` the S3 close contains the Friday $1 and posts $24.99 with `fullQuality=true`. When it is due on Friday it becomes `possible_redate` and quality falls. In `held-request-forward-pair` S2 already lists the matching $1 for Thursday, along with the 5/4 and the paid $1. Approval returns 200 after S2 and posts $24.99 on S3 even when that partner is withdrawn. In `held-post-due-pair-control` the partner is due at the posting close, and the accepted decision remains pending with income $99.97, book cash $80,099.97 and quality below full. (`holdRulings.js:180`, `adjustments.js:795`, `adjustments.js:829`, `Refuter:152`.)

**Sale-boundary controls.** `sold-moved-past-sale` and `sold-changed-past-sale` each sell on Wednesday at the normal open window. On Thursday the moved or revised eligible row creates a proposal, approval returns 200, and Friday posts $99.97 or $199.94. Both rows read full quality. `sold-pair-only-after-sale` first shows the Thursday $1 on the Wednesday sale session, then the Wednesday $1 on Thursday. The founder gets 404 for the absent proposal, the ledger records `possible_redate` and cash stays $89,394.36. `sold-withdrawn` pays zero. (`adjustments.js:381`, `adjustments.js:412`, `adjustments.js:598`, Run:108.)

**Three observations and a backfill.** In `natural-dirty-after`, S5’s winning daily and its clean competitor finish before the final competitor requests AAPL’s splits. The ordinary close obtains a clean backfill through November 23, fetched at 21:25 UTC. The one-shot transaction barrier releases the remaining builder, which observes a second malformed spelling of the November 18 split at 21:26. S5 records both reject bodies, one accepted-row hash, `observations=3`, `parse_observations_disagree`, an empty historical doubt set and a below-full row. S6’s window starts November 19. It posts the previously approved $99.97 and reads full. In `fresh-backfill` the latest rejection was at 21:24 and clean backfill at 21:25, so S6’s payment was authorized. In `no-clean` both S5 and S6 backfills fail, the November 18 doubt survives and S6 pays zero below full quality. The timing barrier uses the fake database’s normal commit and retry logic. (`caParseReport.js:128`, `caParseReport.js:197`, `caBackfill.js:98`, `close.js:195`, `close.js:1538`, `api/_utils/__testsupport__/mandateFakeFirestore.js:243`, Run:108.)

**Sale and settlement.** `C05 refused reverse split has a founder exit` reproduces the missed founder action with one parsed row. In the longer `refused share basis and a queued line` seed the founder’s `conflict/none` for the reverse ID, `price_move` for a nonexistent suspicion and `no_action` for a nonexistent coverage gap all returned 404. On S5 the two forward ratios 2/1 and 3/2 for S2 created a conflict. Selecting 2/1 returned 200. The ruled forward ID waited on the unaddressable reverse ID. A second `none` for the latter still returned 404. Ordinary windows through December 3 retained AAPL. In a second magnitude control, 1/1000 then 1/500 reduced the position to 0.000200 shares, $46 million breached the adjusted line, and a later 1/800 hit the same refusal and 404. These are synthetic magnitude tests of six-place rounding. (`ledger.js:836`, `ledger.js:1350`, `ledger.js:1687`, `exits.js:192`, `holdRulings.js:258`, `Build:1193`.)

**Historical red/green.** The four-plan source block in `Original` appears verbatim in `Plans` after normalizing checkout line endings. All four failed on the old product with the new test oracle. The named 01–03 histories failed I-7, the late precision arms failed I-6 and the 06 cases failed the ambiguity checks. The sold-sector 08 arm failed I-7. Both on-time precision arms and the same-stock 08 control passed. The 05 after-sale quality and 07 raced-report assertions failed on the old product. The broader old selection had 32 failures, four passes and ten skipped rows, including one failure that just called a newly introduced helper missing on the old head. I excluded that helper failure from the behavioral evidence. On the candidate, `Plans`, `Asks` and `Refuter` passed **94/94**. (`Original:128`, `Plans:29`, `Asks:46`, `Asks:81`, `Asks:132`, `Asks:299`, `Refuter:809`.)

**Variants V1–V8.** V1 changes both paired amounts to $1.13 and reverses them, V2 moves a $1.13 from the near-future side of the sale, V3 changes the disputed amount to $3, V4 changes $3.23 to $3.24 and reverses the recovered rows, V5 chooses 8/5 and runs through liquidation, V6 changes the quote to $10.30 and interleaves the dividend, V7 is the three-observation schedule above, and V8 repeats a Tuesday `5:4` rejection on Thursday and Friday and lists a Wednesday $1.13 dividend on Friday. V8 had no approval target before Monday, then an open proposal and zero income. The individual outcomes are in the original-finding table. (`Seq:1342`, `Seq:1405`, `Seq:1427`, `Seq:1440`, `Asks:299`, Run:80.)

**Approval identity, net and replay.** In `settled correction, approval and late split` the first $0.50 dividend paid $49.99, the next day AAPL sold, then a correction to $0.80 and a separate $1 entitlement arrived. The founder ruled the correction and approved the second ID. Friday’s posting close also saw a 5/4 dated before both payments. It posted $49.98 correction and $124.96 entitlement, for **$224.93** lifetime income. Replaying the request returned the stored success. The next close left both totals unchanged. In a second test, one book carried two ideas with the identical SPY proposal ID. Approving one posted **$10** exclusively to that idea’s SPY ledger. The other SPY proposal stayed open, both ideas’ own/comparison adjustment lists were empty, and book cash stayed $60,000. (`holdRulings.js:341`, `holdRulings.js:507`, `adjustments.js:686`, `adjustments.js:835`, `Asks:198`.)

**Q-14.** Four independent histories carried an already approved dividend proposal into both alphabetical orders of a same-date pair. Held AAPL stayed at 124.962510 shares and $99.97 income while the two IDs stood. Both still-held cases retained the pending ruling, and the committed line-exit cases verified the blocked sale. The sold idea posted zero under both orders, marked its premature ruling moot, and accepted both rulings together. Resolving the pair released $124.96 for 5/4 or $79.98 for 4/5. The waiting held proposal also posted once the pair was settled. I verified that the new row was within the actual HTTP date range on the close that applied the ruling. (`ledger.js:247`, `ledger.js:1459`, `adjustments.js:615`, `Refuter:827`, `Refuter:855`, `Refuter:882`, `Build:1173`.)

**Oracle controls.** Stock S-6 reported I-2 on the $2 held revision at S3, I-7 on the $24.99 late-basis posting at S3, and I-7 on the $99.97 sold entitlement at S4. Each directly reproduced in the ordinary product-entry-point histories above. In the separate oracle-only counterexample the inputs were a $1 AAPL dividend, 99.970008 entry shares, S2 sale and a successful approval of the original proposal. A fabricated $100.97 posting named generation 2. I-7 accepted it, I-6 rejected it at $99.97 owed, and both passed once a fabricated comparison receipt reported an earlier split conflict. The latter uses constructed oracle objects solely to characterize test coverage. (`Oracle:458`, `Oracle:489`, `Oracle:499`, `Oracle:583`, `Oracle:684`, `Asks:46`.)

**Independent generated histories.** 358/358 passed, with 6,902 close and replay checks. Inclusive ranges were plain late `2161121000–2161121119` (120 histories, 2,278 checks), shape `2161122000–2161122071` (72, 1,374), refuter shapes `2161123000–2161123053` (54, 1,034), ordered `2161124000–2161124063` (64, 1,258) and wide `2161125000–2161125047` (48, 958). These runs used the shipped generator and its forced I-5 replays. The named acceptance tests use normal forward-only closes. (`Seq:334`, `Seq:357`, `Seq:805`, `Seq:1025`, `Build:1106`, Run:108.)

**Builder’s soak and refuters.** The candidate’s retained late suite passed **122/122**, including `2120005408` and `2120005580`. I also summed the builder’s local `soak-e8d51fd6-summary.json` by group: 1,000 late, 2,400 ordered, 2,000 refuter-shape, 6,000 shape, 160 wide. The recorded totals are 11,560 histories, 222,954 closes, zero failures, at `e8d51fd6`. That is an audit of the saved counts. Independent runs are the fresh and retained groups here. The four refuter passes and the historical 13-product/5-oracle tally are attributed to the build report. (`corporateActionSequences.late.test.js:22`, `corporateActionSequences.late.test.js:130`, `Build:815`, `Build:816`, `Build:856`, `Build:1003`, `Build:1039`.)

**Mutation evidence.** Full NL2c corpus passed independently on the candidate: 90 histories, fallback reached 231 times, zero nonzero sums, byte-identical document maps under the mutant, and the one-cent control caught. I also replaced `sameDateUnruled` with an empty result in a disposable mutant export. Four of six selected Q-14 tests failed, including sold EQ-1. The historical 118/119 aggregate spans prior runs, with the 45 affected mutants rerun by the builder after Q-14. My rerun covers NL2c and the Q-14 mutant. (`corporateActionLateAsks.equivalence.test.js:34`, `corporateActionLateAsks.equivalence.test.js:96`, `ledger.js:247`, `Refuter:827`, `Build:870`, `Build:1200`.)

**Quarterly and clean-data differentials against `cf35151b`.** 36/36 quarterly tests matched, including 17 scenarios × two modes, 4,000 build-set comparisons and the prompt-byte controls. All 40/40 instrumented cron traces matched. All four planted-vendor contrasts passed in two mode tests: planted input left 100 shares, the vendor control produced 200, and cash stayed $90,000. Separately, real parsed on-time 4/5 and 2/1 splits, $3.23 dividend, then 5/4 and $0.31 gave matching own-ledger cash, shares, income and quality after each of six closes in both sector and same-stock arms. Final values were 199.940015 shares, $578.62 income and $80,578.62 cash. The quarterly harness files are in the prior review’s local `run/probe` directory documented at `docs/audits/20261119_ASTRA_CONFIRMATION_T1A2B3_ROUND2.md:8`. (`astra-differential.test.js:47`, `astra-cron-trace.test.js:49`, `plant.test.js:49`, `Original:118`, `ledger.js:1629`.)

**End-to-end and fence.** All four end-to-end tests passed on each snapshot. Head validated all 28 parse reports before stripping that collection. The 191 remaining documents on each side serialized to 443,533 bytes. Direct byte comparison returned true, SHA-256 `abcf842026a3d5c4ce4f2c3a858dbd5fcabad2a3388df6c73b3f944ce7c24ed9`. The changed-path list against pinned main contains no flag, calibrated/pinned file, Firestore rule, index, shared corporate-action parser or shared snapshot builder. The feature flag reads `off`. The rules Git blob is `34beb0ccf73f047191b63d3996024ee4a6d4b7d7`, the indexes blob `6dc9318fb7fa110b6f82ec49025583696de80bb4` on both sides. (`endToEnd.test.js:337`, `endToEnd.test.js:345`, `docs/BUILD_RULES.md:10`, `src/config/practiceFieldFlags.js:33`, `Build:1112`.)

**Firestore rules.** **841/841 across 46 distinct files**, on the authorized loopback demo emulator. The initial run passed 750 tests across 44 files. Two additional files failed collection because my disposable export omitted the census script and the stock-threshold policy fixture. I restored the matching committed inputs and verified the LF rule blob. Both files passed on rerun, 70 activation-observer tests and 21 film-room attribution tests. This is an aggregate across two invocations. The builder’s complete application suite, lint and build are recorded in §11.15 and were outside this independent rerun. (`vitest.rules.config.mjs:14`, `test/rules/activationObserver.rules.mjs:35`, `api/_utils/stockThresholdPolicyRegistry.js:1`, `test/rules/practiceFieldIdeaBookOwnerRead.rules.mjs:82`, `Build:1206`.)

## Executable acceptance rows

**Replay instructions.** In an isolated checkout at the candidate, place this block in `api/_utils/practiceField/astraConfirmation.test.js` and run the installed Vitest runner on that file. These are fixed-behavior assertions. All five failed for the reasons recorded above. The code uses the actual feed parser, in-memory Firestore and transaction barrier, normal sale windows, close and founder dispatcher. (`Snapshot:430`, `Snapshot:477`, `__testsupport__/fixtures.js:474`, `__testsupport__/fixtures.js:579`, `api/_utils/__testsupport__/mandateFakeFirestore.js:307`.)

```js
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ensureDailySnapshot, ensureUniverseSnapshot, fetchCorporateActionsEODHD } from '../mandateUniverseSnapshot.js';
import { admitIdea } from './admission.js';
import { closeIdeaBook } from './close.js';
import { makeParseReportingFetcher } from './caParseReport.js';
import { setPracticeFieldModeForTests } from './mode.js';
import { S } from './__testsupport__/caSequences.js';
import { ADMIT_ISO, closeNowOf, contractOf, founderRules, getIdea, seedBook, slotNowOf, slotOpenIso, windowAt } from './__testsupport__/fixtures.js';

const symbols = ['AAPL', 'MSFT', 'SPY', 'XLK'];
const dividend = (i, amount) => ({ date: S[i], unadjustedValue: amount });
const split = (i, ratio) => ({ date: S[i], split: ratio });
const parse = (symbol, opts) => fetchCorporateActionsEODHD(symbol, { ...opts, apiKey: 'fixture' });
let restoreMode;
beforeEach(() => {
  vi.stubEnv('COCKPIT_ALLOWLIST_UIDS', 'owner-1');
  restoreMode = setPracticeFieldModeForTests('allowlist');
});
afterEach(() => { restoreMode(); vi.unstubAllEnvs(); });

async function openIdea() {
  const ctx = await seedBook();
  const contract = contractOf({ names: ['AAPL', 'MSFT'], capitalUsd: 20000, comparison: { type: 'sector_fund', symbols: ['XLK'] } });
  const result = await admitIdea(ctx.db, { bookId: ctx.bookId, contract, opId: 'review', nowIso: ADMIT_ISO });
  expect(result.ok).toBe(true);
  return { ...ctx, ideaId: result.ideaId };
}
const idea = (ctx) => getIdea(ctx.db, ctx.bookId, ctx.ideaId);
const ask = (ctx, body, key) => founderRules(ctx.db, ctx.bookId, ctx.ideaId, body, { requestKey: key, expectOk: false });
const approve = (ctx, i) => ask(ctx, {
  kind: 'late_adjustment', recordId: 'late_idea_cash_dividend_AAPL_' + S[i], decision: 'approve',
}, 'approval');

function vendor(rows) {
  return async (url) => {
    const { pathname, searchParams } = new URL(url);
    const matching = rows.filter(row => pathname.includes('/AAPL.US')
      && pathname.includes('/splits/') === ('split' in row)
      && row.date >= searchParams.get('from') && row.date <= searchParams.get('to'));
    return { ok: true, status: 200, json: async () => matching };
  };
}

async function daily(ctx, i, rows, time = '13:30', gate = null) {
  const now = new Date(S[i] + 'T' + time + ':00Z');
  const built = await ensureDailySnapshot(ctx.db, {
    date: S[i], now, coverageTickers: symbols, candidateUniverse: [],
    getFundamentals: async symbol => {
      if (symbol === 'AAPL' && gate) { gate.signal(); await gate.wait; }
      return { fundamentals: { sector: 'Technology', industry: 'Synthetic', marketCap: 3e12 } };
    },
    fetchCorporateActions: makeParseReportingFetcher(ctx.db, { symbols, base: parse, fetchImpl: vendor(rows), now: () => now }),
  });
  return (await built.ref.get()).data();
}
async function snapshot(ctx, i, slot, price, dailyDoc) {
  const date = S[i], isClose = slot === 'close';
  const now = isClose ? closeNowOf(date) : slotNowOf(date, slot);
  const quoteTime = isClose ? +now - 25 * 60000 : Date.parse(slotOpenIso(date, slot)) - 15 * 60000;
  const prices = { AAPL: price, MSFT: 200, XLK: 200, SPY: 500 };
  await ensureUniverseSnapshot(ctx.db, {
    tickKey: date + '_' + slot, sessionDate: date, dailyDoc, now,
    coverageTickers: symbols, candidateUniverse: [], minCandidateCapacity: 0,
    fetchQuotes: async requested => Object.fromEntries(requested.map(s => [s, { close: prices[s], timestamp: quoteTime / 1000 }])),
  });
}
async function session(ctx, i, rows = [], price = 100) {
  const date = S[i], doc = await daily(ctx, i, rows);
  for (const slot of ['open30', 'midday', 'preClose']) {
    await snapshot(ctx, i, slot, price, doc);
    await windowAt(ctx.db, ctx.bookId, { date, slot, now: slotNowOf(date, slot) });
  }
  await snapshot(ctx, i, 'close', price, doc);
  const result = await closeIdeaBook(ctx.db, ctx.bookRef, {
    date, now: closeNowOf(date), fetchCorporateActions: parse, caFetchImpl: vendor(rows),
  });
  expect(result.closed).toBe(true);
  return idea(ctx).ledger;
}

it('C01 H-revise', async () => {
  const ctx = await openIdea();
  await session(ctx, 0);
  await session(ctx, 1, [dividend(3, 1)]);
  await session(ctx, 2, [dividend(3, 2)]);
  expect((await session(ctx, 3, [dividend(3, 2)])).dividendsUsd).toBe(0);
});

it('C02 held-post-forward-pair', async () => {
  const ctx = await openIdea();
  await session(ctx, 0);
  await session(ctx, 1, [dividend(1, 1)]);
  await session(ctx, 2, [split(1, '5/4'), dividend(1, 1)], 80);
  expect((await approve(ctx, 1)).status).toBe(200);
  expect((await session(ctx, 3, [dividend(4, 1)], 80)).dividendsUsd).toBe(99.97);
});

it('C03 sold-moved-past-sale', async () => {
  const ctx = await openIdea();
  await session(ctx, 0);
  await session(ctx, 1, [dividend(3, 1)], 94);
  const sold = await session(ctx, 2, [], 94);
  expect(sold.saleReceipts[0]).toMatchObject({ sessionDate: S[2], shares: 99.970008 });
  await session(ctx, 3, [dividend(2, 1)], 94);
  const answer = await approve(ctx, 2);
  expect((await session(ctx, 4, [dividend(2, 1)], 94)).dividendsUsd).toBe(0);
  expect([404, 409]).toContain(answer.status);
});

function gate() {
  let release, signal;
  const wait = new Promise(resolve => { release = resolve; });
  const ready = new Promise(resolve => { signal = resolve; });
  return { ready, wait, release, signal };
}
it('C04 natural-dirty-after', async () => {
  const ctx = await openIdea();
  await session(ctx, 0);
  await session(ctx, 1, [], 94);
  await session(ctx, 2, [], 94);
  await session(ctx, 3, [dividend(2, 1)], 94);
  expect((await approve(ctx, 2)).status).toBe(200);
  expect((await session(ctx, 4, [split(2, '5:4')], 94)).dividendsUsd).toBe(0);

  const first = gate(), last = gate();
  const badRows = [dividend(2, 1), split(2, '3:2')];
  const cleanLoser = daily(ctx, 5, [dividend(2, 1)], '21:24', first);
  const dirtyLoser = daily(ctx, 5, badRows, '21:26', last);
  await Promise.all([first.ready, last.ready]);
  const doc = await daily(ctx, 5, [dividend(2, 1), split(2, '5:4')], '21:23');
  first.release();
  await cleanLoser;
  await snapshot(ctx, 5, 'close', 94, doc);

  let staged = false, merged = false;
  const date = S[5];
  const result = await closeIdeaBook(ctx.db, ctx.bookRef, {
    date, now: closeNowOf(date), fetchCorporateActions: parse,
    caFetchImpl: async url => {
      if (!staged) {
        staged = true;
        ctx.db.setBarrier(async () => {
          expect(ctx.db._get('practiceFieldCaBackfill/AAPL')).toMatchObject({ to: date, failed: false });
          last.release();
          await dirtyLoser;
          merged = true;
        });
      }
      return vendor([dividend(2, 1)])(url);
    },
  });
  expect(result.closed && merged).toBe(true);
  expect(ctx.db._get('practiceFieldCaParseReports/' + date).symbols.AAPL).toMatchObject({
    observations: 3, observationsDisagree: true, rowsRejected: 2,
  });
  expect((await session(ctx, 6, badRows, 94)).dividendsUsd).toBe(0);
});

it('C05 refused reverse split has a founder exit', async () => {
  const ctx = await openIdea();
  await session(ctx, 0);
  await session(ctx, 1, [], 94);
  const held = await session(ctx, 2, [split(2, '1/1000000000')], 94);
  expect(held.holdings.AAPL.heldActions[0].refused).toBe('rounds_to_nothing');
  const answer = await ask(ctx, { kind: 'conflict', recordId: 'reverse_split_AAPL_' + S[2], decision: 'none' }, 'exit');
  expect(answer.status).toBe(200);
  await session(ctx, 3, [], 94);
  expect((await session(ctx, 4, [], 94)).saleReceipts.some(r => r.symbol === 'AAPL')).toBe(true);
});
```

## Closing record

**Revisions read.** Candidate `5fa632719a1598cdf1d21fa72d1cee2b1e6db75f`, prior review `df9b7278a9267815d35442e9b7183a18a519a6f7`, pinned main `cf35151b9528cbdf32a6452b7ffec29c7b058f2f`. Additional history inspected or resolved: final soak fixes `e8d51fd6c9ec75189c562474f6e9f1c16e19d861`, pre-Q-14 tip `70281b20fc7a1fde432535b56720de15e7101808`, merged tree `f1d396c5438cebf64db14b48eae4ec3b080847d5`, final product code `9301f87f46c098686018846ea5a02ef67e429231`. From the final product revision to the candidate, only the build report and docs index changed. (Run:70, `Build:1197`, `Build:1200`.)

**Rules and differentials.** Rules 841/841 in 46 files across two invocations. Quarterly 36/36, cron traces 40/40, planted-backfill cases 4/4, clean on-time arms 2/2, and end-to-end dumps byte-identical. (Run:104, Run:100, Run:102.)

**Independent seeds.** `2161121000–1119`, `2161122000–2071`, `2161123000–3053`, `2161124000–4063` and `2161125000–5047` (suffixes abbreviated): 358 histories passed, 6,902 closes/replays. Replays `H-revise`, `held-post-forward-pair`, `sold-moved-past-sale` and `natural-dirty-after` each met a dark-merge stop. The refused-split seed met the switch-only stop. (Run:94, Run:72.)

**Dark merge: DO NOT MERGE. Founder-only switch: NOT READY.** C01–C03 and C05 can close with their stated merged fixes and passing rows. C04 needs the focused ordering recheck before the founder-only flip. (Run:74, Run:76, Run:78, Run:80, Run:82.)

**Report path** · `C:\Users\fashr\OneDrive\Documents\CodexLocalTest\20261121_ASTRA_CONFIRMATION_T1A2B4.md`
