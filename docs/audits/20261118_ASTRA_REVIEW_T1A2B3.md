# Astra review of the idea book’s corporate-action path

18 November 2026 · Draft PR #1088 · `claude/practice-field-t1a2b3-corporate-action-finish` against `origin/main` · Final T1a-1 through T1a-2b-3 review

**Dark merge — DO NOT MERGE.**  
**Founder allowlist — NOT READY.**

The reported 3:2 re-date adds **$4,998.50** to an idea that bought at the already-adjusted price. Both main and the proposed build report full quality. The new backfill path can also fetch the right split and dividend, finish a 20-session catch-up, and value the book as if neither row existed. The quarterly comparisons and the complete-data lifecycle fixture passed. The merge verdict follows criteria 3–6 in the brief. (`ledger.js:825`, `ledger.js:840`, `close.js:672`, `dailyCoverage.js:205`, `independent-evidence.json:313`, `independent-evidence.json:600`.)

**Before the switch**, close T2D-01 through T2D-12 below and deliver the already-agreed Q10 dividend change in the same fix round. T2D-13 and T2D-14 can wait for T5. The register table below assigns every carried item, including the founder’s T1b, T5 and separate quarterly assignments. Confirm the fixes on the resulting head with the money cases, positive controls and differentials below. (Founder brief, `Pasted text.txt:103` and `Pasted text.txt:105`, `20261117_BUILD_T1A2B3_CORPORATE_ACTION_FINISH.md:165`, `20261117_BUILD_T1A2B3_CORPORATE_ACTION_FINISH.md:474`, `20261117_BUILD_T1A2B3_CORPORATE_ACTION_FINISH.md:532`.)

### Reading the evidence

Product references are at detached head **H** unless marked **B**. Bare Practice Field filenames resolve under `head/api/_utils/practiceField/`. The two shared mandate modules resolve under `head/api/_utils/`, and audit and design documents under `head/docs/audits/` and `head/docs/design/`. **B** means the detached main worktree. The independent observations are line-addressable JSON in the adjacent `run/` directory. Bare JSON and scratch script names in citations resolve there, and `probe/` refers to its harnesses. The attached `Pasted text.txt` supplies the founder’s final rulings. Their values come from fresh fake-database runs, parser outputs and the actual close and ruling functions. The tests used an empty environment vendor key and a fetch stub. The parser-adapter and quarterly positive controls used synthetic credentials with injected local answers. (`probe/independent.test.js:23`, `probe/more.test.js:20`, `probe/astra-cron-trace.test.js:36`, `api/_utils/mandateUniverseSnapshot.js:430`.)

Evidence files for the observed values and ruling outcomes are [corporate-action scenarios](<C:/Users/fashr/.codex/visualizations/2026/11/18/01a1ef91-f8dd-7ce0-8092-f3c83bd137e1/run/independent-evidence.json>), [corrections and release controls](<C:/Users/fashr/.codex/visualizations/2026/11/18/01a1ef91-f8dd-7ce0-8092-f3c83bd137e1/run/more-evidence.json>), and [three-ledger conservation](<C:/Users/fashr/.codex/visualizations/2026/11/18/01a1ef91-f8dd-7ce0-8092-f3c83bd137e1/run/conservation-evidence.json>).

## Merge and activation findings

### T2D-01 · A re-dated split credits an ex-date buyer

**P1 · Criterion 3**

On both B and H, the close declined a parsed 3:2 split on the purchase date. At the next flat $100 close, the same ratio with the next date took 99.970008 shares to 149.955012 on the idea, comparison and book. The phantom was $4,998.50 at full quality. The decline omits the ratio, and the matcher searches applied receipts and held rows. No hand-written action is needed. (B `ledger.js:552`, H `mandateCorporateActions.js:67`, `mandateCorporateActions.js:165`, `ledger.js:829`, `ledger.js:842`, `independent-evidence.json:249`, `independent-evidence.json:313`.)

**Fix.** Persist the declined ratio and match a re-listed share-basis row against the ex-date decline. Hold an ambiguous second split for the founder. Pin both 3:2 and reverse-split cases with unchanged money until resolved. The agreed Q10 matcher change can close this item too if it preserves split ratios and this share-basis case passes.

### T2D-02 · Catch-up discards actions it successfully fetched

**P1 · Criterion 3**

I stored 22 missed session closes, then fetched an AAPL 5:4 split and a $1 dividend. Catch-up processed 20 sessions and then two. With failed historical AAPL entries, the idea and comparison reached 124.962510 shares and $124.96 dividends. With successful historical entries that predated the vendor correction, they ended at 99.970008 and $0, at full quality. The book mirrored each result. The backfill was present in both runs. Each historical daily window advanced the cursor and prevented the close from reading the fetched rows. (`close.js:247`, `close.js:672`, `close.js:1034`, `close.js:1052`, `dailyCoverage.js:205`, `independent-evidence.json:600`, `independent-evidence.json:689`.)

**Fix.** Use the successful overlapping backfill throughout the catch-up it serves, including sessions with valid archived entries. Union the rows inside the close transaction, apply only through the session being valued, and preserve this behavior across the 20-session boundary and replay.

### T2D-03 · A line sale erases earned dividend eligibility

**P1 · Criterion 3**

AAPL was held on November 17, sold on November 18, and still held by the comparison. A parsed $1 dividend first appeared November 19 with a November 17 ex-date. On B and H the comparison got $99.97. The idea got $0, book cash stayed $89,394.36, and the row was full quality. Candidate selection iterates present positions. (B `ledger.js:506`, H `mandateCorporateActions.js:145`, `ledger.js:777`, `close.js:482`, `independent-evidence.json:379`, `independent-evidence.json:403`.)

**Fix.** Track historical holding intervals and ex-date shares from fills, actions and sales. Settle the entitlement once to the idea and book after sale, including when the comparison does not hold that symbol. Keep the sold position closed.

### T2D-04 · A late split never corrects a dividend already paid

**P1 · Criterion 3**

A 5:4 split lowered a $100 quote to $80 without triggering a hold. A $1 dividend paid $99.97. When the earlier-dated split appeared, shares rose to 124.962510 but the payment stayed $99.97 instead of $124.96. Both the same-stock comparison and the book retained the $24.99 shortfall at full quality. C-16 handles the opposite arrival order. (`ledger.js:1004`, `ledger.js:1098`, `mandateCorporateActions.js:150`, `corporateActionFinish.test.js:656`, `independent-evidence.json:497`.)

**Fix.** When newly accepted basis evidence predates a settled payment, recompute that payment’s dated entitlement and post a linked, idempotent cent adjustment on each affected ledger and the book. Exercise both arrival orders and a second identical close.

### T2D-05 · Later corrections to a settled ID are ignored

**P1 · Criterion 3**

On both heads the vendor first reported a 5:4 split and $1 dividend for November 17, then 3:2 and $2 for the same date. At $66.67 the final full-quality row still had 124.962510 shares and $124.96 dividends. The corrected entitlement was 149.955012 shares and $299.91. Both payloads use normal parser formats. A settled ID is discarded before its payload is compared with the receipt. (B `ledger.js:505`, H `mandateCorporateActions.js:53`, `mandateCorporateActions.js:149`, `ledger.js:775`, `more-evidence.json:92`, `more-evidence.json:125`.)

**Fix.** Compare incoming payloads with the stored settlement. Keep byte-equivalent economic terms idempotent. Record changed terms as a correction, hold disputed money or quality, and permit one auditable adjustment after resolution.

### T2D-06 · A conflict’s old ID is declined and paid in the same close

**P1 · Criterion 3**

A $1/$2 conflict on November 17 was followed by the $1 row on the old date and the matching $2 row on November 18. H recorded the old ID as settled by the new one, then applied both. The idea, comparison and book received $299.91 at full quality. The system’s own resolution chose the $199.94 replacement. Candidates were collected before that resolution and the retired ID remained eligible. (`ledger.js:777`, `ledger.js:817`, `ledger.js:854`, `ledger.js:860`, `ledger.js:956`, `independent-evidence.json:1027`.)

**Fix.** Make conflict retirement and candidate selection share the live settled-ID set. If two economic interpretations remain possible, leave the conflict open. Assert that one ID can never be both declined and paid, including when both dates remain in the daily window.

### T2D-07 · Coverage has two exceptions that allow fresh marks or cash

**P1 · Criterion 6**

On entry day the AAPL daily entry was explicitly failed. With a matching daily reference, a $100 entry was marked **$104, vendor time, full quality**. The fallback to opening date passes the continuity check before the daily entry is examined. Separately, on a later uncovered close, a newly reported dividend dated on the last covered day paid **$99.97** on each stock ledger and into book cash while AAPL itself was marked `ca_coverage_missing`. The hold tests the action’s ex-date against the previous cursor. F-1 and exit criterion 6 apply to the session doing the work. (`dailyCoverage.js:166`, `dailyCoverage.js:195`, `close.js:298`, `ledger.js:902`, `20261117_PRACTICE_FIELD_AMENDMENT_F_CORPORATE_ACTION_FINISH.md:21`, `independent-evidence.json:429`.)

**Fix.** Separate the entitlement start date from evidence of session coverage. Require a valid current entry, covering backfill or applicable ruling before a fresh mark. Defer every count-dependent candidate for that symbol on an uncovered close, including backdated rows. Replay once after coverage returns.

### T2D-08 · A ruling covers a later halving hidden by a recovery

**P1 · Criterion 5**

With closes of $100, $50, $25 and $50, the founder ruled only on the first halving. The $1 dividend dated at $25 was released for $99.97 at full quality. The intervening halving had no open record. Only the first and last observations survived. If the intermediate halving and recovery represent a split and reverse split, the intermediate entitlement is $199.94. The scope violation can be established from the observed moves alone. (`ledger.js:432`, `ledger.js:441`, `ledger.js:463`, `holdRulings.js:188`, `independent-evidence.json:2`.)

**Fix.** Preserve unresolved split-shaped transitions with their dates while a record stands. Retiring the named transition must leave later transitions and cash dependent on them held until independently explained. Include a round trip and a partial recovery.

### T2D-09 · A chosen conflict payload pays a ledger without the record

**P1 · Criterion 5**

In a deliberately asymmetric stored state, the idea carried an open $1/$2 conflict and the comparison held AAPL with no such receipt. The founder request succeeded and the real close credited $99.97 to the comparison with a founder receipt. The conflict planner collects ledger names but omits them from the ruling. The close sends one action map to all three ledgers. I established the persisted-state defect. The asymmetric receipt history was supplied by the probe. (`holdRulings.js:116`, `holdRulings.js:129`, `holdRulings.js:226`, `close.js:304`, `more-evidence.json:199`.)

**Fix.** Record the eligible ledger and receipt identities when planning the ruling. At application, revalidate the open record on each named ledger. Limit replacement, application and completion to those records. Test all three ledger roles and preserve independent genuine feed rows on other ledgers.

### T2D-10 · A permanently refused founder payload locks its own correction

**P1 · Criteria 4 and 5**

From ordinary entry and parsed actions, two 1-for-100,000 rows generated a possible re-date. The founder selected the second row. Applying it would round the holding to zero. The ruling stayed pending, the sale remained held, and a fresh `none` request returned `record_already_resolved`. Re-listing the feed row did not release it. A second control with a true conflict also masked a subsequent valid 4:5 correction. These are extreme ratios accepted by the parser. Neither control required a planted ledger. (`holdRulings.js:83`, `holdRulings.js:226`, `holdRulings.js:275`, `ledger.js:1059`, `ledger.js:1365`, `more-evidence.json:2`, `more-evidence.json:277`.)

**Fix.** Distinguish a permanent application refusal from a wait for evidence. Refuse an unrepresentable choice up front or mark it terminal with its reason. Release its request lock so a founder can select an alternative or `none`, preserving both requests and their replay receipts.

### T2D-11 · A legacy split receipt can strand a dividend and sale

**P1 · Criterion 4**

The supported old receipt shape lacks `sharesBefore`. A late dividend became `count_on_ex_date_unknown`. Re-listing the dividend and split kept cash at $0, dropping them retained the held action, the sale returned `corporate_action_unsettled`, and each of the three ruling kinds returned 404 for the held ID. A backfill provides action terms but cannot supply the missing historical holding count. This is a compatibility case. I used the old receipt shape explicitly and made no assumption about existing founder books. (`corporateActionFinish.test.js:697`, `ledger.js:952`, `ledger.js:1015`, `ledger.js:1365`, `holdRulings.js:58`, `independent-evidence.json:1116`.)

**Fix.** Derive the exact count from auditable historical fills and actions when possible. Give an unresolved historical-count refusal a bounded founder resolution for that exact entitlement. Verify that a correct re-fetch, a repeated request and a later sale cannot duplicate cash.

### T2D-12 · A parser rejection becomes clean coverage

**P1 · Criteria 3 and 6**

The real adapter, with an injected successful HTTP answer containing a 5:4 split written as `5:4`, logged a rejection and returned zero actions, two calls and `failed:false`. With a $100→$80 split-adjusted quote, the close retained 99.970008 shares and valued them at $80 at full quality. At $80 the missing shares understate the position by $1,999.40. The log identifies the rejected row, but neither daily nor backfill coverage carries the failure to this ledger. The fixture demonstrates the consequence of malformed input. Vendor incidence is unknown. (`mandateCorporateActions.js:72`, `mandateUniverseSnapshot.js:451`, `mandateUniverseSnapshot.js:461`, `mandateUniverseSnapshot.js:586`, `caBackfill.js:123`, `independent-evidence.json:553`.)

**Fix.** Give the idea-book path a trustworthy per-symbol parse-completeness signal, including malformed response envelopes. Retain good rows but hold that symbol’s money and marks until the rejected leg is resolved. Preserve the quarterly response, documents, logs and calls under Amendment E §4.

## Backfill findings that can wait for T5

- **T2D-13 · P2 — The 60-second limit bounds starts.** Four requested symbols each answered in 19.5 seconds. The fourth started at 58.5 seconds and finished at 78.0 seconds. The 20-second timer races the promise, and a timeout records zero calls without cancelling the underlying fetch. The test here used a virtual clock. The original row checks a hung fetch and a budget already spent. No quarterly regression or wrong-money write was established by this timing case. **Fix** by passing the lesser of the remaining pass time and per-fetch limit to the operation, cancelling unfinished HTTP work and counting requests already started. Document the actual deadline until then. (`caBackfill.js:44`, `caBackfill.js:48`, `caBackfill.js:110`, `mandateUniverseSnapshot.js:448`, `corporateActionFinish.test.js:1566`, `independent-evidence.json:212`.)
- **T2D-14 · P2 — A stale failure can overwrite a successful shared backfill.** I paused a partially failing request after its cache read, committed a successful overlapping request, then released the first. The final document contained only the failed answer. The close rejects it and a later fetch can repair coverage. **Fix** by re-reading the cache in a transaction at publication, preserving a committed success over a failure and preserving covered ranges across concurrent successful writers. (`caBackfill.js:103`, `caBackfill.js:132`, `caBackfill.js:135`, `dailyCoverage.js:154`, `more-evidence.json:159`.)

## Register audit and carried-item decisions

**§7 is incomplete as a release register.** It captures the named F-10 families, but it omits explicit closeout entries for T1A-01’s duplicate parser rows, T2A-01’s rename/sale bypass, T2A-C01’s cash delisting and T2A-D02’s same-date share-basis ordering. Link the earlier decisions as closed. D01 and E01 are cross-referenced through Q-P and the two-split case. Add T2D-02, T2D-04 through T2D-11 and T2D-13–14, and link T2D-01, T2D-03 and T2D-12 to their existing carried rows. Qualify the broad C-5/R8, RF-A2, Q-U, C-6 and N2 closure language with the counterexamples above. Give §7 the final Q8/Q9/Q10 dispositions. (`20261113_ASTRA_CONFIRMATION_T1A1_FIX_ROUND.md:26`, `20261115_ASTRA_CONFIRMATION_T1A2A_FIX_ROUND.md:41`, `20261115_ASTRA_CONFIRMATION_T1A2A_ROUND2.md:62`, `20261115_ASTRA_CONFIRMATION_T1A2A_ROUND3.md:3`, `20261117_BUILD_T1A2B3_CORPORATE_ACTION_FINISH.md:503`, `20261117_BUILD_T1A2B3_CORPORATE_ACTION_FINISH.md:565`.)

| Register item | Home and evidence |
|---|---|
| **2b3-C7 share basis · late dividend after a line sale · 2b3-A3** | **Before allowlist.** All three can produce a full-quality money error from split/dividend feed handling. The first two also reproduced on B. The third uses a rejected upstream row and a real parse-failure log. See T2D-01, T2D-03 and T2D-12. (`20261117_BUILD_T1A2B3_CORPORATE_ACTION_FINISH.md:559`, `independent-evidence.json:313`, `independent-evidence.json:403`, `independent-evidence.json:553`.) |
| **2b3-B6** | **Before allowlist for the permanent-refusal path in T2D-10.** Correct the register’s planted-state restriction. The existing moot-split closeout passes for its own input. Remaining artificial pending states can wait for T5 after the normal request lock can be released. (`20261117_BUILD_T1A2B3_CORPORATE_ACTION_FINISH.md:567`, `corporateActionFinish.test.js:1342`, `more-evidence.json:2`.) |
| **C-7 · C-8** | **T5 capacity and records.** C-7 includes the time-budget qualification in T2D-13. C-8 concerns an accepted idea whose start window passes without an attempt. The 20-session limit and return of reserved cash remain. The new missed-action case on an already filled idea is a separate pre-switch fix, T2D-02. (`close.js:690`, `close.js:1052`, `constants.js:172`, `20261113_BUILD_T1A2A_EXITS_SETTLEMENT_RESULTS.md:481`.) |
| **C-17** | **T5.** I ran the exact missing-quote variant. The special dividend paid once, the stale $100 mark carried at reduced quality, and a founder `price_move` restored the $50 mark without another payment. (`20261113_BUILD_T1A2A_EXITS_SETTLEMENT_RESULTS.md:1146`, `ledger.js:457`, `independent-evidence.json:84`.) |
| **FR-A3 residue · RF-A3 residue** | **T5 integrity checks.** One requires a wrong finite stored sector-fund/SPY mark, the other a changed stored comparison type. The checker validates a finite paper mark and gates the same-stock tie on that type. The historical reproductions alter stored ledger or contract data directly. (`reconcile.js:117`, `reconcile.js:253`, `20261113_BUILD_T1A1_T1C_IDEA_BOOK_ACCOUNTING.md:761`.) |
| **2b3-B4** | **T5.** A paper-only refusal can become a broader hold on a later close. This is a held-quality case. Same-stock and sector-fund sale controls passed, as did the frozen-basket own-count refusal and its unmeasurable endpoint. T2D-10 covers a separate inability to change a permanently refused ruling. (`ledger.js:584`, `ledger.js:606`, `corporateActionFinish.test.js:1143`, `corporateActions.test.js:1155`, `20261117_BUILD_T1A2B3_CORPORATE_ACTION_FINISH.md:566`.) |
| **C-9 record, C-10, C-11, C-12, C-14, C-15, 2a-D4, 2b3-C4, 2b3-C5, 2b3-N2 [B] conflict payload, unrecognized type** | **T5 founder tools**, per Q8. The parsers produce splits, reverse splits and cash dividends. The manual rename/delisting pathways and unknown types retain their assigned home. C-9 fallback and C-13 are the separately closed items. (`mandateCorporateActions.js:10`, `mandateCorporateActions.js:81`, `mandateCorporateActions.js:106`, `20261117_BUILD_T1A2B3_CORPORATE_ACTION_FINISH.md:482`, `20261117_BUILD_T1A2B3_CORPORATE_ACTION_FINISH.md:516`, `20261117_BUILD_T1A2B3_CORPORATE_ACTION_FINISH.md:557`, `20261117_BUILD_T1A2B3_CORPORATE_ACTION_FINISH.md:568`.) |
| **2b2-B2 · 2b2-Pointer** | **Separate quarterly task**, per Q8. The idea-book overlap in T2D-06 involves two dates and an explicit retirement. Quarterly duplicate-ID handling has its own owner. (`20261117_BUILD_T1A2B3_CORPORATE_ACTION_FINISH.md:529`, `ledger.js:860`.) |
| **T2C-03 · 2b2-Q1 · 2b2-Q3** | **T5 force rebuild**, **T1b refill rule**, and **T5 stuck-sale tool**, respectively. Keep the separately decided T2C-02 and T1b conditions in place. (`20261117_BUILD_T1A2B3_CORPORATE_ACTION_FINISH.md:526`, `20261117_ASTRA_REVIEW_T1A2B2.md:83`.) |
| **2b3-D4 · weekly payer · two genuine identical splits · C7 dividend** | **Q9** names a possible dividend re-date at the endpoint. **Q4** accepts the weekly-payer limitation. **Q1** sends an ambiguous second split to the founder. **Q10** is an already-promised fix-round change. Preserve these rulings. (`settlement.js:208`, `settlement.js:279`, `20261117_BUILD_T1A2B3_CORPORATE_ACTION_FINISH.md:562`.) |

## Controls and comparisons

- **Founder authority, replay and concurrency.** The endpoint uses the token UID, mode and founder allowlist. The transaction reads the owner’s claim, book, idea and request receipt before writing the ruling and request together. Using the fake store’s commit barrier in both directions, a ruling committed first was applied by the retried close on November 18. With the close committed first, the ruling applied November 19. In both runs the final position was 199.940016 shares, one split receipt, and replay returned the stored answer. (`api/practice-field/founder.js:28`, `founderControls.js:70`, `founderControls.js:136`, `founderControls.js:167`, `close.js:584`, `close.js:930`, `independent-evidence.json:806`, `independent-evidence.json:917`.)
- **Ruling and action controls.** The committed Z1, Y4, N3, same-close feed split, `founder_<id>` collision, NF-1 moot-split and NF-2 never-closed rows passed. The dated receipt links survived a founder explanation. A first dividend, an intervening 5:4 split and a matching re-dated dividend produced just one cash payment plus a `possible_redate` receipt. A conventional RF-A2 correction and a late pre-split dividend also passed. T2D-06 and T2D-08 distinguish the uncovered variants. (`corporateActionFinish.test.js:636`, `corporateActionFinish.test.js:656`, `corporateActionFinish.test.js:789`, `corporateActionFinish.test.js:869`, `corporateActionFinish.test.js:885`, `corporateActionFinish.test.js:1321`, `corporateActionFinish.test.js:1342`, `corporateActionFinish.test.js:1423`, `corporateActionFinish.test.js:1477`, `corporateActionFinish.test.js:1550`, `independent-evidence.json:173`.)
- **Three-ledger conservation after founder rulings.** One normal book held AAPL, used XLK as its comparison and carried SPY as context. All three received a 5:4 split and then a $1 dividend dated before it. Re-dated dividends went to the founder, who declined AAPL’s and approved the two paper payments. After a repeat close and replay, total dividends were $199.94 on AAPL, $224.93 on XLK and $89.98 on SPY. Book cash rose exactly $199.94, and its AAPL share count matched the idea at 249.925021. The entire 20-case private accounting set also ran in founder `allowlist` mode with the owner explicitly listed. Its recorded observations matched the `on` run byte for byte. (`mode.js:37`, `mode.js:46`, `close.js:305`, `ledger.js:1013`, `conservation-evidence.json:2`, `allow-conservation-evidence.json:2`, `allow.json:1`.)
- **Coverage, valuation and evidence.** The six-session failure/recovery, off-time gap, daily-row union, invalid reference, timed/untimed quote provenance and admission retry cases passed. The comparison-only frozen basket carried its own mark and made the endpoint unmeasurable. A doubtful SPY stayed visible on a measurable result with its unpaid dividend identified. The document-size alert fired at 786,432 bytes and stayed quiet one byte below. Keep the existing receipt placement for this round. (`corporateActionFinish.test.js:215`, `corporateActionFinish.test.js:253`, `corporateActionFinish.test.js:293`, `corporateActionFinish.test.js:323`, `corporateActionFinish.test.js:400`, `corporateActionFinish.test.js:459`, `corporateActionFinish.test.js:564`, `corporateActionFinish.test.js:1071`, `corporateActions.test.js:1155`, `close.js:919`.)
- **Quarterly isolation.** All 17 scenarios at both modes were identical (**34/34**). The 40 traced fires were identical (**40/40**), including database activity, responses, logs and mocked upstream and model calls. All 4,000 default build sets and four prompt comparisons matched, including the positive control. I separately planted a backfill beside a quarterly AAPL holding in both modes. Base and head stayed at 100 shares and $90,000 cash. Moving the same split into the stubbed vendor path took both to 200 shares. The production entry points guard off-mode before any backfill read. The diff leaves the flag at `off` and the quarterly source, production pins, Firestore rules and indexes unchanged. (`probe/astra-differential.test.js:47`, `probe/astra-cron-trace.test.js:49`, `plant-evidence.json:3`, `plant-evidence.json:15`, `sweep.js:217`, `api/cron/mandate-evaluate.js:960`, `close.js:1026`, `close.js:1068`, `src/config/practiceFieldFlags.js:33`, `20261113_PRACTICE_FIELD_AMENDMENT_E_EXITS_SETTLEMENT_RESULTS.md:57`, `20261117_BUILD_T1A2B3_CORPORATE_ACTION_FINISH.md:10`.)
- **End-to-end comparison and conservation.** B produced 163 documents, 390,122 bytes, SHA-256 `f061fb0ebd9d57e49b6196b6f87e7503cb872bf67fd133952e0c23612fdc3cc7`. H produced 191 documents, 443,533 bytes, SHA-256 `abcf842026a3d5c4ce4f2c3a858dbd5fcabad2a3388df6c73b3f944ce7c24ed9`. I compared both dumps leaf by leaf. There were 28 daily documents added, none removed. In shared documents 59 leaves were added, none removed, and nine changed. Seven changes were evidence hashes and two were daily-presence booleans. **Zero existing money leaves changed.** The independent full-quality failures also reconciled where exercised through the normal close. The book can agree with an economically wrong idea balance. (`endToEnd.test.js:156`, `endToEnd.test.js:332`, `endToEnd.test.js:493`, `summarize.py:14`, `probe/independent.test.js:31`, `20261117_BUILD_T1A2B3_CORPORATE_ACTION_FINISH.md:418`.)

## Closeout

| Item | Result |
|---|---|
| Fetched and read in detached worktrees | H `c79367b57724f865cb470ac10cbd56933416bb0e` · B `2e069d4285f68138eae4676de1fd63c05e12e453`. Executions used scratch archives of those commits. Both detached worktrees finished clean. (`review-verification.json:2`, `review-verification.json:45`.) |
| Additional Git comparisons | Product code `047c77b0a89e19e188da91384f9884517ff1510d` → test-only `62d4976513bd9bc7122cba230c09b525d5a2ffca` → documentation-only H. The B→H diff is 29 files, +4,208/−315. (`review-verification.json:6`, `20261117_BUILD_T1A2B3_CORPORATE_ACTION_FINISH.md:8`, `20261117_BUILD_T1A2B3_CORPORATE_ACTION_FINISH.md:169`.) |
| Local checks | HEAD Practice Field, founder API, cron isolation and protected-store scan **723/723**, 23 files. Base end-to-end **3/3**. Independent controls and reproductions **22/22**, including both quarterly plant modes. The 20 accounting cases also ran at `allowlist` and passed **20/20**. A passing reproduction here means the harness observed the behavior described above. Full application suite, lint and build were outside this rerun. (`review-verification.json:49`, `head-suite.json:1`, `isolation-scan.json:1`, `base-e2e.json:1`, `all-private.json:1`, `allow.json:1`.) |
| Firestore rules | **839/839 passed across 46 files** on the loopback emulator with the exact Git rules bytes. The first run against Windows checkout text passed **838/839**. Its single failure was the inline-comment assertion in `test/rules/agentEvalRunsDenials.rules.mjs:133` and `:140`. The same assertion failed on B with Windows line endings. The rule and test are identical between B and H. The Git blob has LF line endings and SHA-256 `aa31f076f032cbf5b1e79309bc201e5d70e05e9a8010bd14b61d181c6e334c1a`. (`firestore.rules:1012`, `rules-byte-control.json:2`, `rules.json:1`, `rules-base-raw.json:1`, `rules-canonical.json:1`.) |
| Differentials | **34/34** two-mode scenarios · **40/40** traced · **zero existing money leaves changed** in the end-to-end run. (`differentials.json:1`, `summarize.py:14`.) |
| Dark merge | **DO NOT MERGE** |
| Founder allowlist | **NOT READY** · T2D-01–12 and agreed Q10 in the fix round. |
| Report | `C:\Users\fashr\.codex\visualizations\2026\11\18\01a1ef91-f8dd-7ce0-8092-f3c83bd137e1\20261118_ASTRA_REVIEW_T1A2B3.md` |

