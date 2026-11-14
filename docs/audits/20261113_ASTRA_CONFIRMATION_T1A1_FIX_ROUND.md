# Astra confirmation — PR #1058, T1A-01 to T1A-04

13 November 2026. Narrow confirmation of the fix round; the recommendation is for the dark build, with `PRACTICE_FIELD_MODE = 'off'`.

| Decision | Confirmed result |
|---|---|
| **Verdict** | **MERGE** |
| Four original blockers | **T1A-01, T1A-02, T1A-03 and T1A-04 CLOSED** by the independent reproductions below |
| New blocking regression | **Not found in this confirmation scope**, including the added valid-book reconciliation criterion |
| Quarterly differential | **17/17 fires byte-identical** against `c3ed2cfd`; **4,000** build-set cases equal; **four** prompt cases byte-identical, with detecting controls |
| Normal transitions | All six independently exercised money paths accepted valid state and rejected a one-cent corrupted equity without writes; **21 closes** across the three comparison types had no reconciliation failure |
| Checks | Windows focused: **10 files / 236 passed**. Independent probes: **35 + 21 passed**. Linux: **18 files / 339 passed**, lint and production build passed |
| Mutations | Final valid executions: **7/7**, **6 killed**, **M06 survived as expected**; no new scanner degradation found |
| Remaining finding | **T1A-C01: backlog, T1a-2** — its pending-exit status needs reconciliation integration in addition to lifting the two stated bounds; this restriction predates the fix round |

Evidence and source citations for these results follow. No project-source edits, commits, pushes, PR activity, deployment, real Firestore, model or EODHD calls were made. Synthetic writes and mutations ran only in the in-memory harness and the disposable archive outside the repository. The mode remains off at H:src/config/practiceFieldFlags.js:33.

**Scope, heads and citation convention.** `git fetch origin` succeeded before comparisons. `H:path:line` denotes VERIFIED source at updated head `f8f6312b7a92ade541a3f1394c99558baacdfb5c`; `O:path:line` denotes the previous reviewed head `2fe788d8fbbd6333f2b7aa6ddb15d449700ef929`. Both have clean detached review worktrees. The differential's detached base is `c3ed2cfd177a2ac50250bb7a9fc7617d2c2edd9e`. `P:path:line` denotes this session's probe under `confirmation/probe/`, beside this report. `E:path:line` denotes evidence under `confirmation/`. These are local, synthetic observations, not production observations.

The code-head-to-H diff changes only the build report. The shared worktree and fetched `origin/main` resolve to `979b030c3ccac5bd832aaf1502ae71747bf2811c`; those were metadata checks, not a review of a merged result. Existing shared-worktree edits were left alone. Head records: E:heads.txt:1. The fix-only file inventory, excluding the incoming main merge, is E:fix-diff-name-status.txt:1. Archive source restoration is checked in E:verify-results.mjs:14 and recorded in E:verification.json:1.

**The four original reproductions.**

| Original finding | Independent result at H | Source and reproduction |
|---|---|---|
| **T1A-01 — CLOSED** | The real parser → daily document → close-snapshot builder → close path keeps two identical vendor dividend rows but pays **$199.94 once**, on 199.940017 AAPL shares. Book cash is **$80,199.94**, and there is one applied ID. The repeated 2:1 split produces **399.880034 shares**, not 799.760068; another day's replay applies nothing. | H:api/_utils/practiceField/ledger.js:137, :150, :167, :176, :186; H:api/_utils/practiceField/close.js:265. P:astra-accounting.test.js:22; P:astra-followup.test.js:69; P:astra-dividend-regression.test.js:4. |
| **T1A-02 — CLOSED** | Fault A, the book's $200 AAPL mark and $120,000 equity beside its unchanged idea, now refuses the real $30,000 LLY admission with `recon_failed`. Fault B, **+$123.45 comparison cash**, now refuses the close. The stored document dump is unchanged in both cases; no false gap row is written. | H:api/_utils/practiceField/reconcile.js:72, :127, :179, :194, :213, :223; H:api/_utils/practiceField/admission.js:337; H:api/_utils/practiceField/close.js:226. P:astra-followup.test.js:17; P:astra-accounting.test.js:42. |
| **T1A-03 — CLOSED** | Two books given rival $100/$110 caller objects both record **$100 from the stored canonical document**. A separately supplied $110 object cannot override stored $100. A missing canonical document returns `valuation_missed` with no writes. An injected change between read and commit forces a second transaction attempt and uses the then-stored document. | H:api/_utils/practiceField/close.js:186, :192, :209, :212; H:api/cron/mandate-evaluate.js:935. P:astra-accounting.test.js:99; P:astra-followup.test.js:61; P:astra-confirmation.test.js:52, :58. |
| **T1A-04 — CLOSED** | Quarterly, foreign-owner, missing and closed targets all answer **null**. Wrong-agent and kind-less legacy targets also answer null. An active/draining book answers its own status even if the claim says closed. Off still performs zero reads. | H:api/_utils/practiceField/bookStore.js:35, :44, :47, :48, :49, :50, :51. P:astra-accounting.test.js:113; P:astra-confirmation.test.js:43. |

The earlier diagnostic probes were retained and adapted to expect the corrected outcomes; close fixtures now seed the canonical document. The original 34 probes also ran successfully against the unchanged previous archive, reproducing the old defects and restoring that review's evidence. At H the separate dividend correctness test passes without a patch. Re-removing the within-call action guard makes it fail again, **1/1**, so its success detects this fix. Evidence: E:prior-probe-restoration.log:58; E:independent-tests.log:59; E:mutant-results.json:84; E:run-mutants.mjs:14.

**The five additional rules and readings R-21 to R-24.**

| Rule | Assessment, including valid-state refusal |
|---|---|
| Entitled conflicts remain not full quality until settled — **R-23** | **Sound; accept.** A missed entitled dividend cannot become a clean measured gap merely because the feed stops presenting it. This rule does **not** refuse the close: it writes a row with `fullQuality: false` and an unsettled alert. In the independent lifecycle, the absent conflicting dividend keeps both rows not full quality; a consistent later row pays $199.94 once and clears the condition. No valid close was blocked. H:api/_utils/practiceField/ledger.js:102; H:api/_utils/practiceField/close.js:96, :157, :175. P:astra-confirmation.test.js:64. |
| `postEntryFillCount` must be exactly 0 | **Sound for T1a-1.** The only current entry writer sets 0; later closes preserve it. Missing, negative or raised counts are rejected instead of switching off the same-stock tie. All normal transition cases retained 0. T1a-2 must increment it on actual subsequent fills and lift the bound together, as already stated. H:api/_utils/practiceField/entry.js:280; H:api/_utils/practiceField/reconcile.js:116, :189; H:api/_utils/practiceField/entry.test.js:731. P:astra-confirmation.test.js:79. |
| Realised P&L is zero on every ledger | **Sound for the current no-sale writer set.** The comparison and SPY checks use the same rule as the idea. Splits, dividends, missing marks and the unsupported delisting used here did not create realised P&L or stall reconciliation. Its comparison is in whole cents, consistent with the accounting contract. T1a-2's sale needs receipted realised P&L and the stated rule change. H:api/_utils/practiceField/reconcile.js:63, :67, :90, :177; H:api/_utils/practiceField/ledger.js:91, :187; H:api/_utils/practiceField/entry.test.js:722. P:astra-confirmation.test.js:79. |
| Dividends equal applied-receipt income | **Sound.** Each applied action appends its actual rounded income; the checker sums receipt income in cents, and runs on all three ledgers. Normal duplicate dividends, SPY income and comparison income passed; the coupled cash-plus-dividend corruption tests also passed by rejecting the corruption. A future implementation must retain those receipts, or introduce an equally authoritative cumulative receipt basis; silently pruning them would invalidate a funded ledger. H:api/_utils/practiceField/ledger.js:195, :199, :202; H:api/_utils/practiceField/reconcile.js:65, :66, :90, :177; H:api/_utils/practiceField/entry.test.js:719. P:astra-accounting.test.js:22; P:astra-confirmation.test.js:79. |
| Same-stock tie includes recorded marks | **Sound while there has been no later fill.** These are copies of the same marks from the same snapshot/action path, so exact equality is appropriate. All seven same-stock transition closes tied to zero gap, including a 3:2 split, a 1:7 reverse split, missing data and an unsupported action. No false refusal was observed. H:api/_utils/practiceField/reconcile.js:95, :106, :192; H:api/_utils/practiceField/close.js:75, :76, :92, :93. P:astra-confirmation.test.js:79. |

**Accept all four readings; none was found unsafe within this scope.** R-21 leaves a conflicting ID unsettled so a correction can apply once. R-22 holds back a not-entitled conflict only while presented: the independent test then returns to full quality, owes no dividend, and can decline a later consistent row. R-23 is addressed above. R-24's `draining` response carries the authoritative status and still fails Film Room's active-only nomination check. Evidence: H:api/_utils/practiceField/ledger.js:150, :159, :167, :176; H:api/_utils/practiceField/bookStore.js:32, :50; H:api/_utils/filmRoom/cardStore.js:136, :163; P:astra-confirmation.test.js:43, :64. Vendor re-dating remains the already accepted FR-A5/RF-A2 backlog, not a newly reopened blocker.

**Reject, never repair: ordering and normal paths.**

| Money path | Check of state as read | Check before money write |
|---|---|---|
| Creation | Newly constructed state checked; an existing-book replay does not write | H:api/_utils/practiceField/ideaBook.js:209, :225, :241 |
| Admission | H:api/_utils/practiceField/admission.js:337 | :362, before :364 |
| Release | H:api/_utils/practiceField/admission.js:440 | :444, before :446 |
| Entry, including timeout | H:api/_utils/practiceField/entry.js:185 | :189 for cancellation; :288 for entry, after the declared equity calculation at :287 |
| Close, including timeout | H:api/_utils/practiceField/close.js:226 | :322, after action/mark/valuation planning |

No current money-writing path that recomputes marks or equity before checking the stored state was found. Cheap guards and idempotent returns can precede reconciliation because they write nothing: admission replay at H:api/_utils/practiceField/admission.js:315, release replay at :429, and close guards at H:api/_utils/practiceField/close.js:199. The outer entry sweep can still write an error note after a rejected entry; that is metadata, not a repair or a money mutation (H:api/_utils/practiceField/entry.js:347–355). Thus “nothing written” above describes the reproduced transaction calls, not a claim that every enclosing cron suppresses diagnostic metadata.

The independent 12-case matrix covers valid and corrupted admission, entry, entry timeout, release, close and close timeout. All six valid cases committed and reconciled; all six one-cent corrupted cases refused with an unchanged store dump. A further seven-close sequence for each of `same_stock_held`, `sector_fund` and `frozen_basket` exercised cash dividends, fractional splits, a reverse split, missing prices and an unsupported delisting: **21 closes, zero reconciliation failures**. This is finite transition coverage, not a proof over every possible feed. Evidence: P:astra-confirmation.test.js:18, :79; E:confirmation-tests.log:8.

The earlier M01 mutation initially survived the old `entry.test.js` selection alone: the new as-read guard now catches the old planted-state faults before the removed post-state guard matters. Including the new transition-fault suite kills M01 with its intended entry test. This is a test-location change, not a missing guard: H:api/_utils/practiceField/reconcile.transitions.test.js:125. Evidence: E:M01-entry-only.json:1; E:mutant-results.json:50.

**T1A-C01 — backlog, T1a-2 — Include pending-exit lifecycle states in the reconciliation transition design.**

The two bounds stated in the fix-round report are not the only integration work for T1a-2. `OPEN_STATUSES` still accepts only `accepted`, `entering` and `holding`; a real line-recognition transition to the contract's `line_hit_exit_pending`, with its cash and positions still reserved, fails `open_idea_not_live`. This occurs at **both** the old and updated heads. It is pre-existing, explicitly outside the present writer set, and not a merge blocker. Evidence: H:api/_utils/practiceField/reconcile.js:119, :154; O:api/_utils/practiceField/reconcile.js:31, :66; H:docs/design/20261112_PRACTICE_FIELD_SHARED_CONTRACT_V2.md:91, :95; P:astra-confirmation.test.js:94.

**Concrete instruction:** in T1a-2, implement the pending-exit state, settlement/open-set changes and their reconciliation rules as one tested transition sequence. Extend the status rule for states that still own cash/shares, and retain paper-ledger completeness and fill-count validation for those states rather than merely widening `OPEN_STATUSES`: those validations currently sit under `status === 'holding'`. Keep book ownership, treasury, slots and open idea IDs consistent through settlement. Also retain the receipt history required by the dividend rule. This is additional integration guidance, not a request to build exits in this PR. Evidence: H:api/_utils/practiceField/reconcile.js:178–195, :199–223; H:api/_utils/practiceField/admission.js:394–399; H:docs/design/20261112_PRACTICE_FIELD_SHARED_CONTRACT_V2.md:87, :96.

**Quarterly regression and M06.**

The original independent differential was rerun using actual source from **H versus `c3ed2cfd`**. The 17 fires cover idle eval/close, HOLD/BUY/SELL, held/stale books, quarantine, cadence, already-served ticks, missing vintage, quote/fundamentals failure, cash/held/stale closes and the final batch slot. Each compares response, full fake-store contents, logs and mocked calls, including model arguments. All are byte-identical. All 4,000 default build-set cases match on the original outputs. The four prompt cases vary holdings and overlap between candidate and idea coverage; prompts match byte for byte with and without an actual idea book. Removing coverage isolation changes the prompt in every case. Evidence: P:astra-differential.test.js:33, :45, :48, :54, :68; E:independent-tests.log:59.

The independently computed hash of the 17 head-side scenario records is identical at the previous reviewed head, H, and the new base: **`8e316de61319f63bd2e92929dcb03b0c7ead68c4eacaff48f24aac80723436f1`**. This is this review's serialization/hash, not an assertion that its bytes equal a differently serialized builder artifact. Recipe: E:verify-results.mjs:9–11; results: E:verification.json:2–4.

**M06 remains the same known survivor.** The scanner, its test and its allowlist have no old-to-H diff. A literal unlisted `mandates` cash write still passes the nine scan tests; it was removed afterwards. `mandates` and `ideas` are still absent from the protected collection set, while transaction-shaped writes still enter the unresolved list. The new fixture's literal snapshot write does not move book money. No new unlisted money writer was found in the fix-only diff. Keep **T1A-07 in T1a-2**, as directed. Evidence: H:api/_utils/compositionProtectedStoresScan.js:72, :302, :362; H:api/_utils/compositionProtectedStoresAllowlist.json:449; H:api/_utils/practiceField/__testsupport__/fixtures.js:166; P:astra-accounting.test.js:121; E:run-mutants.mjs:13; E:mutant-results.json:76.

The fenced files, existing feature flags and Firestore rules have no `c3ed2cfd`-to-H diff. Film Room's fix-round seam edit is a comment describing the two-read lookup; its transaction checks remain active-only. The selected isolation, flag and Film Room suites passed with the accounting tests. Evidence: H:docs/BUILD_RULES.md:14; H:src/config/practiceFieldFlags.js:33; H:api/_utils/filmRoom/practiceFieldSeam.js:9; H:api/_utils/filmRoom/cardStore.js:163; E:linux-tests.log:64–65. T1A-05 to T1A-08, FR-A5/RF-A2, FR-A7 and Amendment D's accepted conditions remain in their assigned scope.

**Executed checks and limits.**

| Check | Result | Evidence |
|---|---|---|
| Nine original files plus new transition suite, Windows | **10 files / 236 passed** | E:focused-tests.log:36–37 |
| Adapted original probes and dividend regression | **4 files / 35 passed** | E:independent-tests.log:58–59 |
| Additional confirmation matrix, seam, conflict and lifecycle probes | **21 passed** | E:confirmation-tests.log:7–8 |
| Original probes at previous source, rerun | **34 passed**, including the old diagnostic defect observations | E:prior-probe-restoration.log:57–58 |
| Linux accounting, isolation, Film Room and guards | **18 files / 339 passed** | E:linux-tests.log:64–65 |
| Linux lint gate | **exit 0**, no output | E:linux-lint.log; command below |
| Linux production build | **exit 0**, 15.55 s; chunk-size warning | E:linux-build.log:143 |

| Mutation | Tests / failures | Result |
|---|---:|---|
| M01 remove final entry reconciliation, with transition suite | 47 / 1 | KILLED |
| M02 allow exit fallback through the idea wrapper | 62 / 10 | KILLED |
| M03 add one cent to same-stock comparison | 75 / 45 | KILLED |
| M04 omit SPY actions | 34 / 3 | KILLED |
| M05 accept wrong stored close key/date | 34 / 1 | KILLED |
| M06 unlisted literal money write | 9 / 0 | SURVIVED, unchanged backlog |
| M07 remove within-call duplicate action guard | 1 / 1 | KILLED by the original dividend regression |

Mutation definitions and JSON results: E:run-mutants.mjs:7–15; E:mutant-results.json:1. Each ran in the archive and restored its source in `finally`; H and O remained clean. The final source comparison found no differences under `api/` or `src/` after normalizing line endings (E:verification.json:44).

Harness limitations: the first probe invocation used a parent working directory, causing the scanner to miss `api/` and evidence output to overlap the earlier review's files. It was corrected; the unchanged original 34 probes regenerated their evidence, and the updated 35 probes then passed from the intended directory. The old M05 anchor and the new M07 multiline anchor required syntax/line-ending adjustments; incomplete attempts were excluded, and both final mutants executed and were killed. The first Linux dependency link pointed to a temporary installation that had since disappeared; it was replaced with the existing `/home/flashash/pd-ci-t1a1fix/node_modules`. No packages or external data were fetched. These were harness/setup corrections, not product failures. Evidence: E:initial-cwd-error.log:65; E:adapt-probes.mjs:1; E:prior-probe-restoration.log:58; E:run-mutants.mjs:12, :14.

This pass did not rerun the full suite or the builder's 212-mutant battery, review live CI, test a new merge with current main, or validate production. It was one reviewer using independent probes and mutations, not a second multi-agent review team. No activation recommendation is implied.

**Reproduction commands.** Windows commands use the existing linked dependencies and run from `confirmation/head` or `confirmation/probe` as indicated.

```powershell
# confirmation/head
.\node_modules\.bin\vitest.cmd run api/_utils/practiceField/marks.test.js api/_utils/practiceField/ideaBook.test.js api/_utils/practiceField/admission.test.js api/_utils/practiceField/entry.test.js api/_utils/practiceField/close.test.js api/_utils/practiceField/reconcile.transitions.test.js api/_utils/practiceField/endToEnd.test.js api/cron/practiceFieldIsolation.test.js src/config/practiceFieldFlags.test.js src/data/practiceFieldSlots.test.js --maxWorkers=2

# confirmation/probe
.\node_modules\.bin\vitest.cmd run astra-accounting.test.js astra-followup.test.js astra-differential.test.js astra-dividend-regression.test.js --maxWorkers=1 --testTimeout=30000
.\node_modules\.bin\vitest.cmd run astra-confirmation.test.js --maxWorkers=1 --testTimeout=30000

# confirmation; final runner contains the adjusted selectors/anchors
node .\run-mutants.mjs
node .\verify-results.mjs
```

Linux commands ran against the archive of H at `/tmp/astra1058-confirm-01a1d6cf/head`, Node v22.22.2, using the existing dependency installation named above:

```bash
./node_modules/.bin/vitest run api/_utils/practiceField/marks.test.js api/_utils/practiceField/ideaBook.test.js api/_utils/practiceField/admission.test.js api/_utils/practiceField/entry.test.js api/_utils/practiceField/close.test.js api/_utils/practiceField/reconcile.transitions.test.js api/_utils/practiceField/endToEnd.test.js api/cron/practiceFieldIsolation.test.js src/config/practiceFieldFlags.test.js src/data/practiceFieldSlots.test.js api/_utils/compositionProtectedStores.scan.test.js api/_utils/mandateMoneyRounding.scan.test.js api/_utils/mandateRationale.imports.test.js api/_utils/filmRoom/practiceFieldSeam.test.js api/_utils/filmRoom/cardCounter.test.js api/_utils/filmRoom/cardStore.test.js api/_utils/filmRoom/oneDoor.acceptanceC.test.js src/config/flagPinGuard.test.js --maxWorkers=2
./node_modules/.bin/eslint . --config eslint.gate.config.js --max-warnings 0
./node_modules/.bin/vite build --outDir ../build-output
```

**Final record.**

| Head | Full commit | Extent |
|---|---|---|
| Updated review head | `f8f6312b7a92ade541a3f1394c99558baacdfb5c` | Source confirmation, tests, mutations on archive, lint/build |
| Previous reviewed head | `2fe788d8fbbd6333f2b7aa6ddb15d449700ef929` | Read-only worktree; original probes and status-rule control |
| Updated quarterly differential base | `c3ed2cfd177a2ac50250bb7a9fc7617d2c2edd9e` | Independent differential |
| Fix-round code head | `b13fa2da27f2ca028362434fdb88696ea50aa010` | Resolved; documentation-only difference to updated head verified |
| Shared head / fetched main | `979b030c3ccac5bd832aaf1502ae71747bf2811c` | Metadata only |
| Original differential base, through retained old probes | `d9b4e3c1c8183cf1917ef8d0bd5ad6f4110e7ab6` | Original differential rerun only |

**Four reproductions: CLOSED.** Dividend **$199.94 once**; repeated split **399.880034 shares**; both accounting fault injections **refused without writes**; rival caller close prices **ignored in favor of stored $100**; poisoned Film Room targets **null**. **Differential: 17/17 fires, 4,000 build sets and four prompt cases equal. Verdict: MERGE** under the stated dark-build criteria.

Report: `C:\Users\fashr\.codex\visualizations\2026\11\13\01a1d6cf-8390-7023-9587-03ccafd0dabc\20261113_ASTRA_CONFIRMATION_T1A1_FIX_ROUND.md`.
