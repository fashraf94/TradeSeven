# Astra — Closure verification: Film Room Build A1

**Verdict: MERGE**

The blocking defects exercised by the original delta probes are closed at the reviewed tip. The Windows full suite is not green; failure attribution and unchanged-source Film Room reruns are recorded in §5. All nine original mutation faults are detected. No new finding in the reviewed delta meets the governing blocking classes. D05 remains reproducible and is the explicitly accepted backlog residual; the default backfill's D09 behavior remains intentional, and the new refresh repair works. This is a dark-branch source and local-execution verdict, not authorization to flip a flag or a claim of production qualification.

| Review boundary | Verified record |
|---|---|
| Branch | `claude/elegant-sagan-oncgqm` |
| Reviewed tip | `14e49f46f399bf1d6c15c6bd7e46e29ef4b0adf9`, resolved by `git ls-remote`, then fetched |
| Code tip | `b52b842e`; `14e49f46` only updates the build report. L3-1 is in `4668f5bd`, L4-1 in `b52b842e`, both after `0b113a69` |
| Adversarial delta base | `8e754eb8692abc5e0e2540170d23f7ea20aa2118`; 27 changed files |
| Governing text | `docs/specs/FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_20260927.md`, Amendments A and B, and Amendment C including its September 28 addendum; later rulings govern |
| Supporting record | `docs/audits/20260927_BUILD_FILM_TAPE_A1.md` §9–§10; both named prior Astra reviews |
| Execution | September 29, 2026; Windows x64, Node 22.20.0, PowerShell, test timezone UTC. Linux CI is the suite of record |
| Isolation | `git -c core.autocrlf=false archive` extracted separately into `snapshot` and `mutant`; all 3,501 tracked files in each match the tip's Git blob hashes after execution |
| Checkout | `C:/Users/fashr/.codex/worktrees/c44a/portfolio-duel`, detached and clean at `ef80da13bd0ca7ccfa6ef975808a139412129fa2` before and after. No checkout, source edit, stage, commit, push, deployment, production read, or production write |

The exit criterion is applied literally: a new finding blocks only for a false `complete`, loss of a saved fact, a write outside `agentBattles/*/tape/**`, or broken flag-off. The addendum's L2-1 ruling applies regardless of a false-complete defect's historical root. Non-blocking findings do not qualify or weaken the verdict.

**Evidence provenance.** I used my existing `film-a1-delta` set at `C:/Users/fashr/.codex/visualizations/2026/09/28/01a0e599-27f1-7471-ac8b-0c7c00116917/film-a1-delta`. Nothing requested was missing; no original scenario was reconstructed from the executor's tests or the review prose. `repros/delta.test.js`, its config, the original R probes, and `mutations.mjs` were copied byte-for-byte; hashes are in `verification.json`. The original D/C file ran unchanged before the companion. It gave 15 passes and 14 failures, as expected when old defect assertions and superseded status/shape assertions meet the fixes. A red defect assertion is not itself counted as closure.

`prepare-closure.mjs` produces a companion retaining the original scenarios while asserting the corrected results. Explicit adaptations: terminal fixture values become `expired`/`exhausted`; C06 expects the removed lookback; C09 uses the current `m` bucket field and compares facts rather than the old return-object shape; C13 expects no malformed-date write; D09 additionally invokes refresh and repeats it for idempotence. M02's exact arithmetic expression moved from `bought.out.atClose`/`ghost.out.atClose` into `composeLegs`; the same omission of banked points was applied there. M11 uses the expanded guard selection already recorded in the original evidence's `followup-runs.mjs`. These are disclosed adaptations, not missing evidence rebuilt from text.

Current evidence root: `C:/Users/fashr/.codex/visualizations/2026/09/29/01a0ee0f-b61b-7b11-886d-e3ce9d9c76a2/film-a1-closure`. Product citations below are repository-relative at the reviewed SHA. **VERIFIED** means source inspected in this review, plus the named local execution where applicable. Proposed backlog fixes were not made. One reviewer performed the adversarial and refutation passes; this report does not claim a separate independent subagent review.

## 1. Closure table

The companion passes **29/29**. All 16 controls hold under the current rulings; D01–D04 and D06–D13 are closed, with D09 closed through the expressly designated refresh path. D05 is **not closed**, accepted as backlog. There is no new blocking gap in this table.

| ID | Disposition | Observed result at the tip; source anchor |
|---|---|---|
| D01 | **Closed** | Changing outgoing entry and banked points changes the `actions` fingerprint. The old −387.5 gap remains labeled partial, awaiting rebuild to the changed-input result 235.5; status is pending. `api/_utils/filmTape/candleInputs.js:98`, `api/_utils/filmTape/tapeMerge.js:499` |
| D02 | **Closed** | Recorded evidence price 103 → 140 changes the evidence fingerprint and requeues; the earlier reconciliation is retained as stale, not presented as current complete. `api/_utils/filmTape/candleInputs.js:114`, `api/_utils/filmTape/candlePass.js:541` |
| D03 | **Closed** | A recovered evaluation plus unreadable calls/declarations produces partial coverage with `unresolved_dependency`; old complete coverage cannot certify it. `api/_utils/filmTape/tapeMerge.js:301` |
| D04 | **Closed** | With 1,000 terminal rows using the current status vocabulary, consecutive sweeps read 1 / 0 eligible rows and expire the retryable target; terminals consume no result or transaction. `api/_utils/filmTape/candlePass.js:627` |
| D05 | **Not closed — accepted backlog** | Each morning still rejects the same 1,000 foreign rows; the valid old target remains pending. Foreign rows receive zero writes. Amendment B explicitly accepts this residual. `api/_utils/filmTape/candlePass.js:640` |
| D06 | **Closed** | Four seconds per close-out stops at 15 marks / 60,000 ms, `stoppedBy: share`, sweep incomplete; the current tape is still selected. `api/_utils/filmTape/candlePass.js:623`, `api/_utils/filmTape/candlePass.js:642` |
| D07 | **Closed** | Equal-size responses with complementary checks retain both saved price 100 and new price 101. `api/_utils/filmTape/candlePass.js:305` |
| D08 | **Closed** | Stale 15:55 / 9–50 / loss assembly cannot replace canonical 16:05 / 46–36 / win; the entire completion block stays canonical. `api/_utils/filmTape/writeTapeDay.js:135`, `api/_utils/filmTape/tapeMerge.js:337` |
| D09 | **Closed via refresh** | Default mode still returns `alreadyDone`. `refresh: true` recovers tick 10 and reports `refreshed`; repeating unchanged reports `unchanged` and adds zero writes. `api/_utils/filmTape/closePass.js:222` |
| D10 | **Closed** | After tick 10 is recovered and all refetches fail, the retained replay keeps its original `builtFrom`, missing check, and stale label; replay coverage remains partial. `api/_utils/filmTape/candlePass.js:430`, `api/_utils/filmTape/candlePass.js:541` |
| D11 | **Closed** | Two responses covering 384 minutes with different holes merge into 390 retained minutes and more priced checks; zero previously priced checks are lost; preservation is named. `api/_utils/filmTape/candlePass.js:298` |
| D12 | **Closed** | Retryable failure behind 1,000 terminals on the same date is expired immediately; no removed 60-session lower bound can strand it. Sweep reads 1 / 0. `api/_utils/filmTape/candlePass.js:632` |
| D13 | **Closed** | The real close writer copies corrected outgoing entry 150 → 300, preserves the old replay, and changes written/complete to pending/partial. `api/_utils/filmTape/writeTapeDay.js:135`, `api/_utils/filmTape/tapeMerge.js:508` |
| C01 | **Closed / control holds** | Add/remove before publication and provenance-only changes do not alter input identity; preserved evidence stays in the identity. `api/_utils/filmTape/candleInputs.js:89` |
| C02 | **Closed / control holds** | An expired pass with changed checks remains expired on repeated merges, retaining one changed-input label. `api/_utils/filmTape/tapeMerge.js:508`, `api/_utils/filmTape/tapeMerge.js:516` |
| C03 | **Closed / control holds** | Unchanged dependencies retain saved complete coverage through a limited read; known caveats remain partial on subsequent reads. `api/_utils/filmTape/tapeMerge.js:283` |
| C04 | **Closed / control holds** | Ordinary 205-row backlog closes 100 / 100 / 5, with current enrichment on the first morning. `api/_utils/filmTape/candlePass.js:624` |
| C05 | **Closed / control holds** | One mid-page close-out exception is isolated; first morning still closes 100 and the next closes the remaining 10. `api/_utils/filmTape/candlePass.js:645` |
| C06 | **Closed / amended control holds** | Ancient retryable failure now expires; terminal rows cost no transaction; foreign rows are counted and never written. The old lookback assertion is intentionally obsolete. `api/_utils/filmTape/candlePass.js:632` |
| C07 | **Closed / control holds** | Six-minute hole leaves a null with stale bar age and partial status; whole refetch completes and clears preservation. `api/_utils/filmTape/bars.js:97`, `api/_utils/filmTape/candlePass.js:316` |
| C08 | **Closed / control holds** | Early close retains 21 buckets; exactly five minutes old is valid, one second older is not. `api/_utils/filmTape/bars.js:99`, `api/_utils/filmTape/bars.js:112` |
| C09 | **Closed / current-shape control holds** | Fewer priced checks cannot erase a saved price; a true superset replaces cleanly. Current buckets carry `m`, and a kept merge also returns `why`. `api/_utils/filmTape/candlePass.js:312`, `api/_utils/filmTape/candlePass.js:316` |
| C10 | **Closed / control holds** | Kept series missing the recovered check still names “built before 1 check(s)” after a failed refetch. `api/_utils/filmTape/candlePass.js:257`, `api/_utils/filmTape/candlePass.js:578` |
| C11 | **Closed / control holds** | Two backfills interleaved with completion retry the transaction and retain completed / score 42. `api/_utils/filmTape/writeTapeDay.js:116`, `api/_utils/filmTape/tapeMerge.js:341` |
| C12 | **Closed / control holds** | Tuesday follow-up, delayed completion and skipped-session timelines all pair helper pending with the expected real close-pass write. `api/_utils/filmTape/closePass.js:130` |
| C13 | **Closed / inverted by BA-35** | Impossible final date is listed invalid, with no tape or failure marker and zero writes; helper remains unavailable, no candle fetch occurs. `api/_utils/filmTape/closePass.js:134` |
| C14 | **Closed / control holds** | Source removal cannot erase the already-saved new check or its pending rebuild request. `api/_utils/filmTape/tapeMerge.js:171`, `api/_utils/filmTape/tapeMerge.js:499` |
| C15 | **Closed / control holds** | Seven physical write sites equal seven executed sites, scanner keys and allowlist keys, each count 1. Exact census in §5 and `census.json` |
| C16 | **Closed / control holds** | Shared calendar/schedule/constants have only the enumerated pure local dependency graph; server exports are identical function objects. Original AST and identity assertions pass |

**Original mutation faults.** Each result below is an assertion failure caused by the single intended mutation in `mutant`, not a load failure or timeout. Each source file was restored; the final 3,501-file blob comparison has zero mismatches.

| Mutant | Fault reintroduced | Result |
|---|---|---|
| M01 | Sample the minute containing the instant | **RED**, 3 / 13 assertions fail |
| M02 | Omit banked points from the replay gap | **RED**, 4 / 16 fail; relocated expression in `composeLegs` |
| M03 | Prefer the bought fill as the outgoing entry | **RED**, 6 / 40 fail |
| M04 | Let a close merge replace stored candle columns | **RED**, 1 / 40 fail |
| M05 | Add `score` as a fourth hub-helper key | **RED**, 17 / 24 fail |
| M06 | Remove the close handler's dark flag guard | **RED**, 1 / 18 fail |
| M08 | Ignore heard suppression | **RED**, 1 / 50 fail |
| M10 | Disable evaluation eviction detection | **RED**, 2 / 90 fail |
| M11 | Collapse a nonempty session shorter than 390 minutes to one minute | **RED**, 9 / 120 fail with `tapeAstraReview.test.js` included; its real early-close integration assertion fails |

M11's original two-file, 70-test selection still does not kill it; all nine failures are in the already-established expanded guard file. The mutant is killed by the current committed suite, and that test-selection distinction is preserved rather than calling the original narrow selection protective. Evidence: `mutation-results.json` and each `mutation-evidence/M*.json`.

## 2. Rulings in code

Each line is **VERIFIED** at the reviewed SHA and exercised by the closure companion or the committed ruling tests, including the completed timeout-adjusted rerun in §5. The declared backlog exceptions in §4 remain backlog.

| Ruling | Does the code do what the text says? |
|---|---|
| BA-31 | **Yes:** value-sensitive input identities and per-unit `builtFrom`; a retained unit is tested against its current identity before complete coverage. `api/_utils/filmTape/candleInputs.js:109`, `api/_utils/filmTape/candleInputs.js:155`, `api/_utils/filmTape/candlePass.js:541`, `api/_utils/filmTape/candlePass.js:581` |
| BA-32 | **Yes:** expired/exhausted are distinct terminal states; both query paths select only pending/partial/failed, with no failed-history lower bound. `src/constants/filmTape.js:91`, `api/_utils/filmTape/candlePass.js:361`, `api/_utils/filmTape/candlePass.js:478`, `api/_utils/filmTape/candlePass.js:632`, `api/_utils/filmTape/candlePass.js:697` |
| BA-33 | **Yes:** clock checked before each close-out; sweep and selection close-outs share the 60-second/100-mark allowance and run floor. One in-flight I/O can overrun its start-time check. `api/_utils/filmTape/candlePass.js:112`, `api/_utils/filmTape/candlePass.js:642`, `api/_utils/filmTape/candlePass.js:726` |
| BA-34 | **Yes:** buckets choose higher `m`, ties stored; check samples keep prices over null and take a later fresh bar; merged coverage and preservation are computed afterward. `api/_utils/filmTape/bars.js:134`, `api/_utils/filmTape/candlePass.js:293`, `api/_utils/filmTape/candlePass.js:578` |
| BA-35 | **Yes:** target date must be a calendar session before either close write or failure marker. `api/_utils/filmTape/closePass.js:134` |
| BA-26 amended | **Yes within the recorded dependency model:** `dependsOn` uses check/eval/action/directive identities; a changed or unobserved dependency plus a limit holds coverage partial, and only a limit-free read observing all merged dependencies clears unresolved. `api/_utils/filmTape/tapeMerge.js:241`, `api/_utils/filmTape/tapeMerge.js:283`, `api/_utils/filmTape/tapeMerge.js:301` |
| BA-27 amended | **Yes:** canonical transaction re-read wins a contradictory equal-rank completion; the whole block moves together, retaining a richer stored basis only when its completion agrees. `api/_utils/filmTape/writeTapeDay.js:135`, `api/_utils/filmTape/tapeMerge.js:337`, `api/_utils/filmTape/tapeMerge.js:418` |
| BA-29 amended | **Yes:** admin-guarded `refresh=1` re-merges written days and separates refreshed/unchanged; unchanged normal reads write nothing; default mode still skips written days. `api/cron/film-tape-close.js:81`, `api/_utils/filmTape/closePass.js:222` |
| BA-36 | **Yes:** shared-identity plan/replay units merge per point, preserve non-null and aged-null facts, and retain missing path dependencies; a current unit wins whole across changed identities when it holds a fact. `api/_utils/filmTape/candlePass.js:395`, `api/_utils/filmTape/candlePass.js:430`, `api/_utils/filmTape/tapeReplay.js:291`, `api/_utils/filmTape/tapeReplay.js:320`, `api/_utils/filmTape/tapeReplay.js:361` |
| BA-37 | **Yes on the tiered path:** each transaction attempt re-assembles from its own battle re-read over the same earlier subcollection reads; unlooked-up declarations remain unknown. `api/_utils/filmTape/writeTapeDay.js:97`, `api/_utils/filmTape/writeTapeDay.js:126`, `api/_utils/filmTape/tapeSources.js:97`, `api/_utils/filmTape/tapeAssemble.js:1015` |
| BA-25 amended | **Yes:** changed inputs outside the window turn written into expired / `inputs_changed_outside_window`, retaining stale output; already-terminal statuses stay terminal. `api/_utils/filmTape/tapeMerge.js:508`, `api/_utils/filmTape/tapeMerge.js:515` |
| BA-24 confirmed | **Yes:** completeness uses calendar bucket count and fresh check prices, not traded-minute count; the read-out prints Σ `m` against calendar minutes with market labels. `api/_utils/filmTape/candlePass.js:246`, `api/_utils/filmTape/tapeExport.js:271`, `src/constants/filmTape.js:256` |
| Addendum L4-1 | **Yes:** between two unpriced samples the later bar age wins; a saved age beats a bare null, while a new price can fill the null. `api/_utils/filmTape/candlePass.js:307`; both committed integration rows at `api/_utils/filmTape/tapeAmendmentC.test.js:911` and `api/_utils/filmTape/tapeAmendmentC.test.js:924` |

BA-26's eval-id proxy assumes a recorded evaluation's declaration expectation is stable, as stated in build report §9.9. The current evaluator sets the phase before appending that evaluation (`api/cron/agent-evaluate.js:4145`, `api/cron/agent-evaluate.js:4257`). This review does not generalize that proxy to hypothetical in-place historical expectation edits. BA-37's immutable-mode assumption and unchanged skipped-mode path remain the expressly carried R3-5 backlog, not a newly claimed repair.

L3-1 is also landed: the pinned-date row clears `subscribeMyStakes` before mounting (`src/components/League/backing/backingDark.test.jsx:465`, `src/components/League/backing/backingDark.test.jsx:469`). The addendum's L1-2 is an A2 display constraint: series and replay facts remain separate. No A2 screen behavior is claimed here.

## 3. Blocking findings, reproductions and proposed fixes

**None confirmed at this tip. No product fix was made.** The adversarial review covered the changed merge, assembly, lifecycle and refresh paths since `8e754eb8`, together with their necessary callers. The following attempted counterexamples were refuted by executed controls; they are not additional findings.

| Attack | Executed evidence and result |
|---|---|
| Repeated replay merging hides missing scorer history or drops a saved point | A01 runs the real imported scorer over **1,200 deterministic three-attempt chains / 3,600 merges**. It checks 87,489 previously non-null path points and 1,294 saved stale-age cases. All 17 intermediate/final results claiming no missing inputs match the whole-input oracle's path points and gap. Zero counterexamples. Separately, the committed L1-1/L4-3 regressions exercise the named third-attempt failures. `api/_utils/filmTape/tapeReplay.js:320` |
| Plan-price merge loses a point or a saved null's age | A02 exhausts 256 pairs of two-point units; every saved priced point remains priced and every surviving null with a saved age retains an age. `api/_utils/filmTape/candlePass.js:403` |
| Series merge repeats L4-1 or picks the older age | A03 checks five directional cases, including two ages in both orders, bare null, and price versus age; D07/D11 exercise the real complementary-response merge. `api/_utils/filmTape/candlePass.js:307` |
| A retried BA-37 transaction publishes the earlier battle | A04 forces a concurrent entry correction and completion after the first transactional battle read. The transaction retries once, rebuilds from entry 300 and publishes completed / 46–36 / win. C11 and D08 cover the other lifecycle seams. `api/_utils/filmTape/writeTapeDay.js:126` |
| Refresh outside the window reopens work or erases candle output | A05 uses the real refresh: changed inputs expire the written pass, preserve its replay, label coverage partial and produce no tape/series writes on the next candle run. `api/_utils/filmTape/tapeMerge.js:515` |
| A stale dependency set clears the unresolved caveat | A06 runs limited → obsolete-but-readable → fully observed merges. Status stays partial / partial, then complete only after the required declarations are observed; D03 and C03 cover changed and unchanged dependencies. `api/_utils/filmTape/tapeMerge.js:301` |
| Refresh or failure handling bypasses flag-off | A07 calls the writer, failure writer, close pass, refresh backfill and candle pass with the writer off: all five refuse, **zero reads and zero writes**. Handler guards are additionally covered by M06 and the committed refresh-shaped dark tests. `api/cron/film-tape-close.js:73`, `api/_utils/filmTape/writeTapeDay.js:63` |
| Collection-group results escape the authorized write root | D05/C06 retain the foreign-path rejection; C15 executes every physical write site. References are built from the validated ids, with no new write site in the delta. `api/_utils/filmTape/candlePass.js:130`, `api/_utils/filmTape/candlePass.js:706`, `api/_utils/filmTape/tapeSources.js:18` |

The randomized probe is bounded evidence, not an exhaustive proof over all provider responses. The suite of seven independent A probes passes **7/7**; sources and raw observations are in `repros/adversarial.test.js`, `adversarial-tests.json`, and `adversarial-evidence.jsonl`. The report's verdict does not rely on the build report's historical randomized counts.

## 4. Backlog — does not affect the verdict

No new blocking gap was promoted from these items. D05 is independently reproduced here. The other rows carry forward the governing Amendment C/backlog record; source inspection agrees with the stated limits, but this closure pass does not claim a fresh exhaustive reproduction of every historical backlog item.

| Item | Remaining behavior; proposed follow-up, not made |
|---|---|
| D05 | Foreign tape-shaped rows can consume every sweep read without a persistent cursor. Preserve rejection and zero foreign writes; wire the accepted `summary.invalid` operational alert at the writer flip. `api/_utils/filmTape/candlePass.js:640`, `api/_utils/filmTape/candlePass.js:710` |
| R2-4 / L3-7 | Terminal status can sit beside “awaiting the candle pass” or pending plan-price wording. Update the outlook consistently at terminal transitions and in the read-out. This is wording, not a complete-coverage claim. `api/_utils/filmTape/candlePass.js:478`, `api/_utils/filmTape/candlePass.js:768`; build report §10.12 |
| R2-5 | An identical limited re-read can write once to add preservation metadata. Consider separating content idempotence from that provenance transition. `api/_utils/filmTape/tapeMerge.js:297`; build report §10.12 |
| R3-2 | Refresh resumes by date; a date with more written battles than one request can process can repeatedly stop at the same battle. Add an explicit battle cursor if needed. `api/_utils/filmTape/closePass.js:210` |
| R3-5 | A hypothetical post-creation mode change can replace a written tape with skipped-mode. The governing backlog treats mode as immutable; guard a written close against skipped-mode if that assumption changes. `api/_utils/filmTape/tapeMerge.js:373`; build report §10.3 and §10.12 |
| R1-7 / R1-8 | Series roles remain descriptive rather than part of their unit hash; an exact max-marks sweep can conservatively report incomplete. No false complete or saved-fact-loss result established. `api/_utils/filmTape/candleInputs.js:167`, `api/_utils/filmTape/candlePass.js:624` |
| Replay-input zero-leg tie / L2-2 | Incomplete replay-input groups and entry-price source precedence can be less precise under the historical latent cases. Any follow-up should retain the documented source/immutability assumptions. `api/_utils/filmTape/tapeMerge.js:90`, `api/_utils/filmTape/tapeMerge.js:172`; build report §10.12 |
| L1-1 precision / L4-8 | The safe dependency-name rule can retain partial coverage even when the numbers are correct. Per-point missing-path provenance could improve precision without weakening honesty. `api/_utils/filmTape/tapeReplay.js:326` |
| L1-3 | After a thrown attempt, `preservedFrom` may use the failed attempt's timestamp. Consider a per-unit write timestamp or separate failure timestamp. `api/_utils/filmTape/candlePass.js:531`, `api/_utils/filmTape/candlePass.js:772` |
| L2-3 class / L4-6 | A tick in flight at the source read can create conservative sticky gap caveats. Treat only attributable gaps as day-specific in a later refinement. `api/_utils/filmTape/writeTapeDay.js:108`, `api/_utils/filmTape/tapeAssemble.js:914`; build report §10.12 |
| L2-4 / L2-5 | Non-written work outside the window still waits for expiry sweep; an already-started candle transaction does not recheck terminal status. The former follows the amended ruling's written-only scope; add a transactional selectable-status guard for the latter if pursued. `api/_utils/filmTape/tapeMerge.js:515`, `api/_utils/filmTape/candlePass.js:504` |
| L1-2 / L4-9(a) | A2 must not present a series sample as the input behind a separately merged replay point; distinguish a missing sample from a later point scored without it. This is the addendum's display rule, not an A1 merge change. `api/_utils/filmTape/tapeReplay.js:320`; Amendment C addendum |
| Windows suite / timeout budget | The full local suite remains red: 28 exact failures also occur at the delta base; 11 Film Room rows exceeded the default timeout under the full run. The two unchanged Film Room files pass 102/102 with a 30-second per-test timeout. Keep Linux CI as the suite of record; improve portable test paths and timeout budgeting separately. Raw results and attribution are in §5 |
| Existing non-gated lint / routed scoring defect | Full lint and the already-routed live-scoring R21 remain separate work. Only the requested `lint:gate` is certified here. No fenced scorer change was made. Build report §10.12 and §6.9 |

L4-1 is **removed from the open backlog** by this tip's fix. L3-1 is closed by the authorized mock-clear change. Neither remains a merge condition.

## 5. Checks

| Check | Executed result / scope |
|---|---|
| Full suite — Windows x64, Node 22.20.0, TZ=UTC | **Executed; not green:** 822 files, 16,424 tests: **16,298 passed / 39 failed / 87 skipped**. Two workers, default per-test timeout. Raw: `full-suite.json` and log |
| Delta-base attribution | The 28 non-tape failures reproduce by exact file and test name on `8e754eb8`: 14 files, 168 tests, 140 passed / 28 failed. Existing Windows scan/import/shell cases; not new Film Room assertions. `baseline-failures.json`, `checks-summary.json` |
| Film Room timeout investigation | The 11 other full-run failures are in `tapeAmendmentC.test.js` and `tapeAstraDelta.test.js` (5.55–8.38 seconds per failed row). Serial default rerun: **101/102 pass**, remaining failure explicitly “Test timed out in 5000ms.” Same two files, unchanged assertions, serial `--testTimeout=30000`: **102/102 pass**. Original full-run failures remain recorded; this is a targeted timeout-adjusted rerun, not a green full-suite claim |
| Other tape checks / L3-1 | Every other tape helper, writer, handler, export and flag file in the full run passes; backingDark passes **64/64**, including the authorized pinned-date/mock-clear row |
| Linux CI | **Suite of record; not executed or live-verified in this closure.** Historical Linux results in the branch's build report are not substituted for this run |
| Reviewer closure / adversarial probes | **29/29** D/C companion; **7/7** additional adversarial probes |
| Original mutants | **Nine of nine RED**, intended assertion failures; M02 moved anchor and M11 expanded selection disclosed in §1 |
| Rules suite | **332/332 pass, 18 files**, local Firestore emulator v1.20.2 / demo project; normal shutdown, no production rules claim |
| `lint:gate` | **Pass**, exit 0, `--max-warnings 0` |
| Vite build | **Pass**, exit 0, 54.72 seconds, build output outside the snapshot. Existing CSS/chunk warnings remain in `build.log` |
| Write census | **Seven physical = seven executed = seven scanner = seven allowlisted**, each count 1; table below |
| Crons | **43**, parsed directly from `vercel.json` |
| Both tape flags | **False:** `FILM_TAPE_WRITE_ENABLED` at `src/config/featureFlags.js:2868`; `FILM_ROOM_V2_ENABLED` at `src/config/featureFlags.js:2886`. Flag tests pass **8/8**; A07 confirms zero dark reads/writes |
| BUILD_RULES §1 fence | **Pass:** none of its 11 named files appears in the 27-file delta from `8e754eb8` to the reviewed tip. `verification.json` retains both lists |
| Source / checkout integrity | **Pass:** both 3,501-file tip snapshots match all Git blobs after mutation restoration; supplied checkout remains detached at `ef80da13`, clean |

The 28 reproduced baseline failures are distributed as follows: `agentSafeWireEntry.boundary` (2), `archetypeRegistry` (1), `fantasyTimesConsensus.n4` (1), `mandateModelCall.imports` (1), `mandateMoneyRounding.scan` (2), `mandateNativeEsm.smoke` (6), `mandateUniverseSnapshot.imports` (1), `wireModelCall.imports` (3), `decisionRecord` (2), `ruleSupportStatus` (1), `traitLibraryCandidate.composition` (1), `agentBattleScreenHuddle` (3), `agentReadCensus.guard` (3), and `LeagueSpectate.honesty` (1). Full paths, names and error messages are preserved in `checks-summary.json`. These checks establish no new member of the four blocking classes; they do not certify green Linux CI.

**Write census — seven, not an allowlist-only count.** Original C15 parsed physical transaction calls, executed all seven call sites with stack capture, ran the protected-store scanner, and compared its keys with the allowlist at count 1 each:

| Writer | Physical site |
|---|---|
| Close tape set | `api/_utils/filmTape/writeTapeDay.js:139` |
| Existing tape failure update | `api/_utils/filmTape/writeTapeDay.js:164` |
| First failure marker set | `api/_utils/filmTape/writeTapeDay.js:170` |
| Expiry close-out update | `api/_utils/filmTape/candlePass.js:478` |
| Series set | `api/_utils/filmTape/candlePass.js:588` |
| Candle result update | `api/_utils/filmTape/candlePass.js:589` |
| Thrown candle-attempt update | `api/_utils/filmTape/candlePass.js:768` |

**Execution limits.** The first sandboxed Vitest/Vite launches failed before execution because esbuild could not read an ancestor directory. The authorized isolated runs were repeated with the required host filesystem access; startup failures were not counted as test results. Dependencies were reused from the prior local evidence; `package-lock.json` is byte-identical to that pin. The local rules run used the already cached Firestore emulator **v1.20.2** with demo project `demo-tradeseven-rules`; it is not a run of the CLI's default v1.21.0 emulator. No production credentials, market-data request, live cron, or deployed index/rule verification was used to establish this verdict.

**Delivery and reproducibility.** The requested file is delivered outside the checkout, under this evidence root's `docs/audits/20260929_ASTRA_CLOSURE_REVIEW_FILM_TAPE_A1.md`. `EVIDENCE_README.md` records commands, adaptations and result files; the companion archive excludes application snapshots and dependencies. `verification.json` records the reviewed SHA, original-harness hashes, 3,501-file source integrity, the complete 27-file delta, the §1 fence comparison and the unchanged checkout. All test/mutation changes are external evidence only.
