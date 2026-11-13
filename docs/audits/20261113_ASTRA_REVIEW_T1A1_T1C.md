# Astra review — T1a-1 + T1c idea-book accounting, PR #1058

13 November 2026. Independent, read-only review against the supplied dark-merge brief.

| Decision | Result |
|---|---|
| **Verdict** | **DO NOT MERGE** |
| Ordinary input defect | Duplicate dividend rows create cash; duplicate split rows multiply shares twice. T1A-01, brief criteria 2 and 5. |
| Additional invariant/boundary defects | Reconciliation accepts a broken marked book; the close accepts a noncanonical payload under the canonical key; the seam can return a quarterly book from an inconsistent claim. T1A-02–04. These reproducers deliberately inject inconsistent state or arguments; they are not claims of an existing production incident. |
| Quarterly differential | 17 independently authored base/head fire scenarios matched, including responses, stored documents, model inputs, logs and mocked network calls. 4,000 default build-set cases matched. Four quarterly-prompt cases matched byte for byte with and without a real idea book; removing coverage isolation changed the prompts, so the check can detect a leak. |
| Requested tests | Nine files / **200 tests passed** on Windows and Linux. |
| Additional checks | Linux: **17 files / 303 tests passed**, lint gate passed, production build passed. Independent diagnostic probes: 34 tests passed across three files. The new dividend correctness regression fails on the reviewed code. |
| Mutations | Six defined, six executed, none broken: **five killed, one survived**. The survivor is an unlisted literal money write that the protected-store scan excludes. |
| Project/remote effects | No project-source edits, commits, pushes, PR actions, deployment, real Firestore access, model calls or EODHD calls. Review mutations were confined to an archive copy outside the repository. |

The executive results are supported below by source citations and the local executable evidence. The verdict follows the brief's eight criteria; it does not reopen the agreed entry schedule, five-window work, exits, settlement, reports, or Q-1–Q-9.

**Evidence convention and reviewed state.** `H:path:line` means VERIFIED at `2fe788d8fbbd6333f2b7aa6ddb15d449700ef929`; `B:path:line` means VERIFIED at base `d9b4e3c1c8183cf1917ef8d0bd5ad6f4110e7ab6`. All paths following those prefixes are repository-relative. `P:path:line` means an independently authored probe in the `probe` directory beside this report, running against an archive of H. Source assertions below are VERIFIED; numeric implications labelled CALCULATED are derived from those functions. Probe outcomes are local synthetic observations, not production observations.

`git fetch origin` succeeded before creating the review worktrees. The requested branch still resolved to H. The detached `head` and `base` worktrees were clean; the existing shared `main` worktree had local edits when the review began and was left alone. The diff is 55 files, +8,023 / −52. `ab57faf41df0367aef0d6cbc44720ab4e99d4cbc` and H differ only in the build report and `docs/README.md`, so the code findings also apply to that code head. Records: `heads.txt`, `diff-name-status.txt`, `probe-source-integrity.txt`, `probe-src-integrity.txt` beside this report.

The governing basis is concept V6.1 §3/§8, shared contract V2 §4.2/§14, Amendments A/B, and Amendment C §6/§7 cases 19–23. The direction note's ruling 2 explicitly transfers the three accounting requirements into this build. References: H:docs/design/20261112_PRACTICE_FIELD_CONCEPT_V6_1.md:48; H:docs/design/20261112_PRACTICE_FIELD_SHARED_CONTRACT_V2.md:85; H:docs/design/20261113_PRACTICE_FIELD_AMENDMENT_C_GAME_AND_ACCOUNT.md:112; H:docs/design/20261113_DIRECTION_NOTE_GAME_AND_ACCOUNT.md:15.

**T1A-01 — blocks merge — Deduplicate corporate actions within the current close.**

`applyLedgerActions` constructs a settled-ID set once and asks `pendingActionsFor` for the complete pending list. It then applies every element of that list, appending each ID without checking whether an earlier element in this same invocation already applied it. The engine selector checks only the incoming settled set, and the feed parser preserves duplicate rows. The book mirrors every element of `ownApplied`, so reconciliation agrees with the duplicated income rather than rejecting it. Evidence: H:api/_utils/practiceField/ledger.js:93, :111, :120; H:api/_utils/mandateCorporateActions.js:96, :147, :149, :172; H:api/_utils/mandateUniverseSnapshot.js:342; H:api/_utils/practiceField/close.js:237; H:api/_utils/practiceField/reconcile.js:85.

Reproducer: enter a $20,000 AAPL idea at a $100 mark with the normal cost policy, giving 199.940017 shares. Supply two identical vendor dividend rows, each $1/share, effective the next session. The real parser, daily builder, slot builder and idea close commit **$399.88** income instead of **$199.94**. Book cash becomes $80,399.88; the idea and its same-stock comparison each record the same duplicate ID twice. Reconciliation passes. An analogous repeated 2:1 split turns 199.940017 shares into 799.760068 instead of 399.880034. Evidence: P:astra-accounting.test.js:22; P:astra-followup.test.js:72; `accounting-evidence.json`, `followup-evidence.json`.

Refutation/control: repetition on a later close is correctly skipped; the defect is duplication *within one feed window*. The new correctness regression fails on H. A scratch-only guard that skips IDs already appended during this application makes that regression and all 21 existing close tests pass: **22/22**. The scratch guard was then removed. Evidence: P:astra-dividend-regression.test.js:4; `dividend-refutation.json`; `refute-dividend.mjs:10`.

The underlying engine selector is unchanged from the base; this is not a newly demonstrated quarterly regression. It is a defect in the new caller's promised once-per-ledger application, and independently meets criteria 2/5. **Fix:** deduplicate by `deriveActionId` before application, maintain the set as each action is applied or declined, and reject conflicting payloads sharing an ID rather than applying both. Cover duplicate dividend and split rows, repeated dates, all three ledgers and the book mirror. This can be fixed in the new ledger layer without changing quarterly behavior. Source ownership: H:api/_utils/practiceField/ledger.js:91; H:api/_utils/mandateCorporateActions.js:51.

**T1A-02 — blocks merge — Reconciliation does not cover the marked book or the comparison ledgers.**

The checker compares cash, quantities and cost basis. It never compares the book's recorded marks with the owning idea's marks, never validates `portfolio.totalValue`, and never reconciles `comparisonLedger` or `spyLedger`. Thus the stronger claim that a broken book cannot be written is unsupported even though each normal money path calls the checker. Evidence: H:api/_utils/practiceField/reconcile.js:39, :62, :85, :98, :109; the deliberate cost-basis-only interpretation is stated at :8–17. The governing sub-ledger/portfolio identity is H:docs/design/20261112_PRACTICE_FIELD_SHARED_CONTRACT_V2.md:87, :226.

Reproducer A deliberately changes the book's AAPL mark from $100 to $200 and its stored equity to $120,000, leaving its idea ledger unchanged. `assertReconciled` accepts it; a subsequent real $30,000 LLY admission commits and preserves the inconsistent marked book. Reproducer B adds $123.45 to only the same-stock comparison's cash. The checker accepts it, and the real close writes **−$123.45** as the idea's gap with `fullQuality: true`, although the idea never trades after entry. Evidence: P:astra-followup.test.js:17; P:astra-accounting.test.js:42; H:api/_utils/practiceField/admission.js:140, :359; H:api/_utils/practiceField/close.js:104, :136, :149, :292.

Scope: these are deliberate corruption/fault-injection cases, not evidence that the normal entry writer spontaneously creates either state. They nevertheless meet the brief's explicit criterion 2, “reconciliation that passes on a broken book”; the comparison consequence also crosses criterion 4. The test that removes the final entry reconciliation is killed, so merely checking that the function is called does not address this coverage gap. Evidence: `M01-reconciliation.json`; H:api/_utils/practiceField/entry.js:281.

**Fix:** reconcile the recorded mark/valuation representation as well as cash and basis, using one declared rounding basis shared by entry and close. Validate finite values and conservation for all three ledgers. For `same_stock_held`, enforce the expected tie while no subsequent idea trade has occurred. Reject inconsistent state before admitting, releasing, entering or closing; do not repair it silently by overwriting a close. Add the two fault-injection cases above as rejecting tests. Relevant writers: H:api/_utils/practiceField/entry.js:278; H:api/_utils/practiceField/close.js:275; H:api/_utils/practiceField/admission.js:351.

**T1A-03 — blocks merge — Bind the close to the stored snapshot, not only its name.**

`closeIdeaBook` checks the caller's `tickKey` and `sessionDate`, then values and writes directly from that object. It never reads or checks the canonical snapshot document. Two different payloads with the same key/date therefore satisfy its guard. Evidence: H:api/_utils/practiceField/close.js:167, :174, :180, :229, :255, :301.

Reproducer: two otherwise identical idea books close the same date from objects both named `2026-11-16_close`, one containing AAPL $100 and the other $110; both commit. A second probe stores the canonical $100 document first, supplies the $110 object to the close, and confirms that the row cites the stored document's key while recording $110. Evidence: P:astra-accounting.test.js:97; P:astra-followup.test.js:64; `followup-evidence.json` entry `canonical-close-bypass`.

Refutation/scope: **the current cron path passed** the independent first-fire race: the builder uses create-or-adopt and both racers receive the same winning snapshot. I found no shipping cron call site that intentionally supplies the rival object. This finding is specifically the exported writing boundary accepting noncanonical arguments, not a claim that the ordinary cron already writes two snapshot documents. The brief's criterion 3 and B-STAMP require one snapshot for a date, including late/replayed closes. Evidence: H:api/_utils/mandateUniverseSnapshot.js:260; H:api/cron/mandate-evaluate.js:837, :859, :933; P:astra-followup.test.js:57; H:docs/design/20261113_PRACTICE_FIELD_AMENDMENT_C_GAME_AND_ACCOUNT.md:132.

**Fix:** read `mandateUniverseSnapshots/{date}_close` at the close boundary and value from that canonical document, preferably as a transaction read; return `valuation_missed` if it is absent. Keep create-or-adopt for the builder. Update fixtures to seed the stored snapshot and assert that same-key/different-content arguments cannot produce divergent rows across books. Do not treat a matching caller-supplied key or build timestamp as content identity. Location: H:api/_utils/practiceField/close.js:172–183.

**T1A-04 — blocks merge — The Film Room lookup can return a quarterly book.**

`bookForOwner` checks the mode, agent string and claim fields, then returns the claim's book ID and status. It does not inspect the target book's existence, owner, kind or status. `bookIsForAgent` checks attribution only. An inconsistent `practiceFieldBooks/{uid}` claim pointing to an actual quarterly book is returned as active. Evidence: H:api/_utils/practiceField/bookStore.js:28–46; P:astra-accounting.test.js:110.

Scope/control: the shipped off mode still returns null without a read. Normal creation writes a claim for an idea book atomically, and I found no current normal writer that creates the inconsistent pointer. Also, Film Room's nomination transaction independently checks `kind`, owner and active status, so this probe does **not** demonstrate a nomination write into a quarterly book. It does demonstrate exactly the seam-return condition named in criterion 7; the advisory counter uses that returned status. Evidence: H:api/_utils/practiceField/mode.js:42; H:api/_utils/practiceField/ideaBook.js:250–256; H:api/_utils/filmRoom/cardStore.js:163; H:api/_utils/filmRoom/cardCounter.js:204–210.

**Fix:** after the mode gate, resolve the claim to the actual book and return it only if `kind === 'idea_book'`, the owner and attribution agent match, and its authoritative status is open as required by the seam. Preserve the existing transaction recheck and the zero-read off behavior. Add poisoned/stale claim fixtures for a quarterly target, another owner, a missing book and a closed book. Location: H:api/_utils/practiceField/bookStore.js:31–36.

**T1A-05 — backlog, T1a-2 — Admission uses stale equity and stale sector exposure.**

R-19 is a substantive “last recorded value” policy, not a fresh admission mark. `portfolio.totalValue` and each position's `lastMark` are used without a current snapshot; all four dollar-based limits can consequently be too permissive in some price paths. The ledger still conserves cash, so this finding is backlog under the supplied narrow exit list. Evidence: H:api/_utils/practiceField/admission.js:137–176; H:docs/design/20261112_PRACTICE_FIELD_CONCEPT_V6_1.md:57.

Observed example: a $30,000 AAPL holding leaves recorded equity **$99,991.00**. A 20% decline gives current equity **$93,992.80**. A new short MSFT idea for **$19,000** is accepted under recorded values; its fresh short cap would be **$18,798.56**. The stale permitted maximum is **$19,998.20**, **$1,199.64** above the current cap. The same decline overstates the standalone 35% position limit by **$2,099.37**; another constraint can of course bind first. Evidence: P:astra-accounting.test.js:72; `accounting-evidence.json` entry `stale-equity`.

CALCULATED from that same position: a 20% increase, instead, understates the required 10% cash floor by **$599.82**. Its technology exposure grows by $5,998.20 while the 50% sector allowance grows by only $2,999.10, so stale sector headroom is **$2,999.10 too large**. A decline in holdings outside the proposed sector can also make that sector's stale allowance too large. Generally the slot/position error is cap-share × stale-equity error; cash-floor error is 10% × equity increase; sector-headroom error also includes the change in existing sector exposure. Evidence for the arithmetic: H:api/_utils/practiceField/admission.js:159–176, :193; H:api/_utils/practiceField/money.js:42, :48, :82.

**Fix:** in T1a-2, define a bounded current admission snapshot and derive equity, sector exposure and displayed headroom from the same marks. Preserve integer-cent arithmetic, and fail closed or defer if required marks are unavailable. Publishing a stale number and using it consistently does not satisfy “marked equity at admission.” Keep source-at-time provenance for the admission decision. Locations: H:api/_utils/practiceField/admission.js:140, :176.

**T1A-06 — backlog, T1a-2 — The daily top-up race preserves old entries but can lose newly fetched action data.**

The post-refuter fix correctly reuses entries already present in the omitted-universe document. However, both rebuilders read that old document, set `overwrite = true`, independently fetch new symbols and ultimately call unconditional `set`. A slower rebuild can overwrite new action data written by the faster one. Evidence: H:api/_utils/mandateUniverseSnapshot.js:392–406, :425, :500; the force branch is at :261.

Independent race: initial AAPL entry contains a dividend. Two top-ups add MSFT; one receives an MSFT dividend, the other receives none. Order the successful-with-action write first. Final AAPL is byte-identical to the initial entry, but the newly fetched MSFT action is gone. Thus the report's “same kept entries” defense is valid for *kept entries*, not every entry in the rebuilt document. This probe does not show the top-up applying a corporate action twice or applying it to only one ledger, and does not establish a wrong-money commit for an already-covered idea; it is therefore backlog, separate from T1A-01. Evidence: P:astra-accounting.test.js:56; `accounting-evidence.json` entry `topup-race`.

**Fix:** publish the top-up with a transaction/version precondition. If another rebuild already removed `candidateUniverseOmitted`, adopt its result rather than blindly replacing it. Preserve the prior entries and reconcile any newly requested coverage explicitly. Test divergent, empty and failed new-symbol responses with both commit orders. Location: H:api/_utils/mandateUniverseSnapshot.js:500.

**T1A-07 — backlog, T5 — The protected-store scan protects these money writes partly by accident.**

Exact explanation for `entry.js:348`: the scanner **does see** the write in `all`, resolving its collection to `ideas`; `needsListingFilter` then excludes it because `ideas` is not in `PROTECTED_COLLECTIONS`. `mandates` itself is also absent from that set. The money transactions happen to be listed as `unresolved`: a transaction handle is already Firestore-shaped, so the direct pass does not follow its first ref argument. Evidence: H:api/_utils/compositionProtectedStoresScan.js:72–85, :128, :302–306, :362–366; H:api/_utils/practiceField/entry.js:347; H:api/_utils/compositionProtectedStoresAllowlist.json:449–462.

The wider class is demonstrated by M06: add an otherwise unlisted function containing `db.collection('mandates').doc('synthetic').update({ 'portfolio.cash': 123456 })`. The full nine-test protected-store suite still passes. Also, the `bookRef.set` stamp in `sweep.js` is not in the scan's direct list; its query-derived reference is unresolved without Firestore-shaped evidence. Both original omitted writes are metadata-only. I found **no existing money-moving write in this PR outside the allowlist**, so the survivor is not itself a criterion-8 blocker in the unmutated PR. Evidence: `run-mutants.mjs:14`; `M06-literal-money-write-scan.json`; P:astra-accounting.test.js:118; H:api/_utils/practiceField/sweep.js:68, :86.

**Fix:** extend the money-store inventory to recognize protected paths/ancestors and transaction ref arguments, including query-derived and destructured references. Register the metadata exception deliberately. Add positive scan tests for direct, chained, transaction and helper forms of book/idea/row writes; require M06 to fail. Do not claim that adding only `practiceFieldBooks` and `practiceFieldCoverage` protects all accounting stores. Location: H:api/_utils/compositionProtectedStoresScan.js:72, :302, :362.

**T1A-08 — backlog, T1a-2 — Off-mode recovery must preserve the original clock and recover dates separately.**

At off, an existing idea book contributes no symbols to snapshot acquisition and is skipped by its close; the cron can still advance its attempt marker. Cash and positions remain, but valuation rows stop. The frozen start/due schedule is not extended. Once a later date closes after re-enabling, the ordinary close refuses any earlier missing date as `out_of_order`. Evidence: H:api/_utils/mandateBookKind.js:42; H:api/cron/mandate-evaluate.js:842, :907–915; H:api/_utils/practiceField/close.js:171, :191; H:api/_utils/practiceField/windows.js:100.

Probe: close November 16, turn off for November 17, return on and close November 18, then request November 17. The request is refused and the historical row remains absent; the due session is unchanged. This is the expected recovery backlog, not a dark-merge blocker. Evidence: P:astra-followup.test.js:30; `followup-evidence.json` entry `off-recovery`.

**Fix:** T1a-2 needs a historical-row recovery path using the original stored close snapshot, without rewinding current holdings, action receipts, treasury or last-close state. If the canonical snapshot never existed or has expired, record the date/result as unobserved or inconclusive rather than inventing a price. Account for pending-entry timeout, overdue lines/settlement, action lookback gaps, retained evidence and draining books. Draining is allowed by the close core but excluded by the active-only sweep. Locations: H:api/_utils/practiceField/close.js:192, :200; H:api/cron/mandate-evaluate.js:885; H:docs/design/20261112_PRACTICE_FIELD_CONCEPT_V6_1.md:154.

**Checks that held, and limits of those checks.**

| Area requested in the brief | Independent result and evidence |
|---|---|
| Shared engine edits / no idea book | The 17-scenario differential passed at shipped off mode. Scenarios: idle eval/close; HOLD/BUY/SELL; held HOLD; stale holding; quarantine; slow tier; already-served tick; missing vintage; quote/fundamentals outages; cash/held/stale closes; final batch slot. This is finite behavioral evidence, not a proof of every engine state. P:astra-differential.test.js:40; `differential-evidence.json`. |
| Prompt and buyable-set isolation | Four cases vary quarterly holdings and overlap between idea coverage and candidate symbols. Base and head prompt objects, including text/tools, serialize identically; head remains identical with an idea book present. Every coverage-only symbol is nonactionable. Removing coverage metadata changes the prompt. H:api/_utils/mandatePromptAssembly.js:108; H:api/_utils/mandateUniverseSnapshot.js:659; P:astra-differential.test.js:51. |
| R-13 empty quarterly-book skip | The guard precedes lease/model work and applies only when the stored snapshot explicitly omitted candidates and the quarterly book holds nothing. Its existing isolation rows passed. It does not add such a marker to normal default-universe builds. H:api/cron/mandate-evaluate.js:545–555; H:api/_utils/mandateUniverseSnapshot.js:618. |
| Late numeric-gate fix | All 48 independent malformed-value cases were refused across slot share, cash floor, position share, position count and the two sector ratio fields. These included null, false, empty string, undefined, NaN, Infinity, numeric string and object. H:api/_utils/practiceField/admission.js:149–157; P:astra-followup.test.js:41. |
| Fill eligibility / fallback | Twenty independent invalid-mark cases across BUY, ADD, SELL and TRIM all refused. The engine's carried-mark/average-cost exit branches remain at H:api/_utils/mandateExecution.js:236–237, but the idea wrapper's precheck and receipt/price checks prevent reaching a successful fallback. H:api/_utils/practiceField/fills.js:54, :73, :79; P:astra-accounting.test.js:87. |
| Close is a valuation | No sale/decision write was found in the idea close. It mirrors supported corporate actions and writes mark rows; an unfilled reservation may return to treasury as already blessed. The persistent dividend duplication is T1A-01, not a sale-disguised-as-mark finding. H:api/_utils/practiceField/close.js:200, :237, :294, :315; H:api/_utils/practiceField/ledger.js:80, :112. |
| Matching at normal entry | Same-stock comparison is an exact copy; other comparisons and SPY use the same snapshot/capital and the shared wrapper, with declared fund friction. Normal same-stock ties and all-ledger actions passed existing tests. The runtime corrupted-ledger hole is T1A-02. H:api/_utils/practiceField/entry.js:114–124; H:api/_utils/practiceField/symbols.js:69. |
| Integer cents | Eleven sites remain registered. An independent BigInt oracle agreed with 80,000 floor/ceiling/weighted/rational-limit checks over whole-cent bases up to $100,000 and millionth weights. This does not prove arbitrary unbounded floating-point products safe. H:api/_utils/practiceField/money.js:23–85; H:api/_utils/mandateMoneyRounding.scan.test.js:100; P:astra-followup.test.js:49. |
| Reconciliation call sites | Creation checks its newly built document before its transaction; admission, release, entry cancellation, successful entry and close check their proposed state before money writes. The attempt-note and sweep/lease bookkeeping writes do not reconcile. No missing current money-path call was found; checker coverage remains T1A-02. H:api/_utils/practiceField/ideaBook.js:219; H:api/_utils/practiceField/admission.js:359, :439; H:api/_utils/practiceField/entry.js:186, :281; H:api/_utils/practiceField/close.js:292. |
| Kind isolation | Quarterly evaluation, execution/disposition, close, rollover, escape and batch boundaries have explicit kind guards; the existing 44-case isolation suite passed. The remaining seam-return defect is T1A-04, not a demonstrated quarterly trade on an idea book. H:api/cron/mandate-evaluate.js:175; H:api/_utils/mandateExecution.js:384, :396, :517; H:api/_utils/mandateClosePass.js:182; H:api/_utils/mandateRollover.js:118, :159; H:api/_utils/mandateEscape.js:117; H:api/_utils/mandateBatchTransport.js:226, :369, :788. |
| Flag, fence, Film Room at off | Flag remains `'off'`; existing flag values/pins and fenced files have no behavioral diff. The flag guard change is explanatory prose. Film Room off lookup makes no read, and the four selected Film Room suites pass. H:src/config/practiceFieldFlags.js:33; H:src/config/flagPinGuard.test.js:324; H:docs/BUILD_RULES.md:13; H:api/_utils/practiceField/bookStore.js:29. Diff inventory: `diff-name-status.txt`. |
| New-store access | Rules are unchanged. Book/dailyRows/decisions/corporateActions are owner-readable under existing explicit matches; ideas/epochs/nested rows and the two new top-level stores fall through to deny. Thus the build report's broad “all server-only” wording needs that owner-read qualification, but no unauthorized client reader was found. This was source inspection, not emulator verification. H:firestore.rules:1465, :1471, :1477, :1489, :1516. |
| Coverage read failure / O-9 | **Acceptable for this dark merge on its own.** At off/no visible idea book, `snapshotBuildInputs` returns before the coverage read. With ideas active, a coverage failure occurs before building the shared snapshot and fails the fire, protecting the missing-symbol invariant at the expense of quarterly availability. Retain it for activation testing and size the retry/failure budget in T5. H:api/cron/mandate-evaluate.js:124–140, :793, :848; H:api/_utils/practiceField/sweep.js:39. |

**Mutations and refutation record.**

| Mutant | Rule deliberately broken | Tests executed | Outcome |
|---|---|---:|---|
| M01 | Skip successful entry reconciliation | 31 | KILLED, 2 failures |
| M02 | Allow the carried/basis fallback through the idea wrapper | 52 | KILLED, 10 failures |
| M03 | Add one cent to the same-stock comparison | 52 | KILLED, 3 failures |
| M04 | Omit corporate actions from SPY's ledger | 21 | KILLED, 2 failures |
| M05 | Accept a close with the wrong key/date | 21 | KILLED, 1 failure |
| M06 | Add an unlisted direct write to book cash | 9 | SURVIVED; T1A-07 |

Each mutation required a unique source anchor, ran in the archive copy, and restored the original file in `finally`. JSON test results distinguish test failures from broken runners. Definition and result evidence: `run-mutants.mjs:7`, `mutant-results.json`, individual `M01`–`M06` JSON/logs. The duplicate-action correctness test is an additional expected baseline failure; its scratch-only deduplication control passed 22 tests and was restored. Evidence: `refute-dividend.mjs:9`; `dividend-refutation.json`.

This was one independent reviewer using separate review dimensions, adverse fixtures, negative controls and mutations. It was **not** a new independent multi-agent refuter team and does not claim to reproduce the builder's 159-mutant battery or full 32,067-test run. The only authored Markdown deliverable is this report. Review source and logs remain alongside it for reproducibility.

**Commands, results and environment.**

PowerShell at the detached H worktree (installed dependencies linked; no install scripts run):

```powershell
.\node_modules\.bin\vitest.cmd run api/_utils/practiceField/marks.test.js api/_utils/practiceField/ideaBook.test.js api/_utils/practiceField/admission.test.js api/_utils/practiceField/entry.test.js api/_utils/practiceField/close.test.js api/_utils/practiceField/endToEnd.test.js api/cron/practiceFieldIsolation.test.js src/config/practiceFieldFlags.test.js src/data/practiceFieldSlots.test.js --maxWorkers=2
```

Result: **9 files, 200 passed** (`nine-tests.log`). Windows Node v22.20.0 / Vitest 4.0.17. Eight additional guard/Film Room files initially produced 99 passes and four failures in the two path-closure scans; the scans document the pre-existing Windows separator limitation at H:api/_utils/mandateRationale.imports.test.js:45. Native Windows build could not resolve the absent installed `three` package. A scratch-only attempt to obtain pinned `three@0.184.0` failed DNS/certificate validation; TLS validation was not disabled. The Linux installation already contained the pinned dependency.

Linux archive of H, `/tmp/astra1058-01a1d6cf/head`, Node v22.22.2, installed dependencies from `/home/flashash/pd-ci-srb2m/node_modules`:

```bash
./node_modules/.bin/vitest run api/_utils/practiceField/marks.test.js api/_utils/practiceField/ideaBook.test.js api/_utils/practiceField/admission.test.js api/_utils/practiceField/entry.test.js api/_utils/practiceField/close.test.js api/_utils/practiceField/endToEnd.test.js api/cron/practiceFieldIsolation.test.js src/config/practiceFieldFlags.test.js src/data/practiceFieldSlots.test.js api/_utils/compositionProtectedStores.scan.test.js api/_utils/mandateMoneyRounding.scan.test.js api/_utils/mandateRationale.imports.test.js api/_utils/filmRoom/practiceFieldSeam.test.js api/_utils/filmRoom/cardCounter.test.js api/_utils/filmRoom/cardStore.test.js api/_utils/filmRoom/oneDoor.acceptanceC.test.js src/config/flagPinGuard.test.js --maxWorkers=2
./node_modules/.bin/eslint . --config eslint.gate.config.js --max-warnings 0
./node_modules/.bin/vite build --outDir ../build-output
```

Results: **17 files / 303 passed**, lint exit **0**, build exit **0** (14.27 s; existing large-chunk warning). Evidence: `linux-tests.log`, `linux-lint.log`, `linux-build.log`. No full-suite or production/deployment claim is made.

Independent probes in the Windows `probe` archive:

```powershell
.\node_modules\.bin\vitest.cmd run astra-accounting.test.js --maxWorkers=1 --testTimeout=30000
.\node_modules\.bin\vitest.cmd run astra-differential.test.js --maxWorkers=1 --testTimeout=20000
.\node_modules\.bin\vitest.cmd run astra-followup.test.js --maxWorkers=1 --testTimeout=30000
node ..\run-mutants.mjs
node ..\refute-dividend.mjs
```

Results: **8 diagnostic probes passed**, **19 differential tests passed**, **7 follow-up tests passed**. Diagnostic tests assert the observed defect where named; “passed” does not mean the accounting contract passed. The separate dividend correctness regression failed **1/1** on H and passed with the scratch guard (**22/22** including existing close tests). The two initial diagnostic failures were probe setup errors (`db._set` is not a fake API); replacing them with the fake's document `set` resolved the harness errors before the reported final run. Evidence: `accounting-tests.log`, `differential-tests.log`, `followup-tests.log`, `dividend-unmodified.json`, `dividend-negative-control.json`.

**Final HEAD record, differential result and verdict.**

| Read or resolved state | Full commit | Extent |
|---|---|---|
| PR branch / detached review HEAD | `2fe788d8fbbd6333f2b7aa6ddb15d449700ef929` | Source review, requested tests, probes, Linux lint/build |
| Recorded PR base / detached base HEAD | `d9b4e3c1c8183cf1917ef8d0bd5ad6f4110e7ab6` | Base source and independent differential |
| Code head | `ab57faf41df0367aef0d6cbc44720ab4e99d4cbc` | Resolved; code equality to H verified by documentation-only diff |
| Existing shared worktree HEAD and fetched `origin/main` | `050123cf9db99f91ab7e23419426c4261bf143c4` | Metadata only; not substituted for the specified base and not reviewed as a merged result |

The history names `7cde2305` and `825ca16e` were read from the log; they were not separate checked-out review HEADs. Their final gate and top-up implementations were tested at H. The final independent differential is **17/17 fire scenarios equal, 4,000 build-set cases equal, four prompt cases byte-equal with detecting controls**. The requested nine files and the 17-file Linux check passed; the commands and limitations are recorded immediately above.

**Verdict: DO NOT MERGE.** T1A-01 alone crosses the stated dark-merge exit criterion. T1A-02–04 are additional literal invariant/boundary failures with their adversarial-input conditions disclosed. T1A-05–08 are backlog in their named homes.

Report path: `C:\Users\fashr\.codex\visualizations\2026\11\13\01a1d6cf-8390-7023-9587-03ccafd0dabc\20261113_ASTRA_REVIEW_T1A1_T1C.md`.
