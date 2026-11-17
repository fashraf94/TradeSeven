# Astra review — T1a-2b-2 admission and records

17 November 2026. **Verdict: DO NOT MERGE. One blocker: T2C-01.**

| Question | Review result |
|---|---|
| Admission at current marks | The requested decline/rise cases pass, but a known failed corporate-action fetch can leave admission pricing the old share count at a reverse-split-adjusted price. A $21,000 admission succeeds against a correct short cap of $19,998.20. **Blocker, exit criterion 3.** |
| Quarterly isolation | 34/34 scenario comparisons and 40/40 traced comparisons identical to the fetched base. First-build/adopt/force controls also match. |
| Accounting outside admission | No changed money leaf in the reproduced end-to-end comparison. No edits to `ledger.js` or `corporateActions.js`. |
| Top-up | Ordinary concurrent top-ups preserve entries/actions; three writers pass all six commit orders. Conflicting rows of one action id do not pay an idea book twice. Explicit `force` remains destructive; see T2C-03. |
| Records | Founder replay and catch-up closure checks pass. Parts are created atomically, checked by hash and split by size. Two conditional window-count weaknesses remain T1b backlog, T2C-02. |
| Access | Existing owner-only rules cover both new surfaces. Full rules run: **838/839**; the same CRLF-sensitive source assertion fails on base. New-surface emulator checks: **2/2**. |
| Other verification | Focused suite **625/625**, independent probes **28/28**, lint gate passed, head/base production builds passed. Full application suite and builder's mutation battery were not rerun. |

Evidence for this table is detailed below and recorded in [verification-summary.json](<C:/Users/fashr/.codex/visualizations/2026/11/17/01a1eaad-a9b1-7e00-ae60-846c0972b499/verification-summary.json:1>). A passing independent probe can assert reproduction of a defect; 28/28 does not mean 28 defects were absent.

**Scope, references and repository state**

`git fetch origin` completed before comparison. The fetched refs match the brief. Read-only detached worktrees were created at the following commits; both remained clean at completion. Tests ran in separate archive-derived trees under `run/`, with injected upstream responses and in-memory Firestore, or the local emulator. No push, PR action, deployment, real-project Firestore, model or EODHD call occurred. The original checkout's existing changes were left intact.

Throughout this report, **H** means `7687cfa5a77dc6981bf661ecf028ce5cdd280b66`, at [head](<C:/Users/fashr/.codex/visualizations/2026/11/17/01a1eaad-a9b1-7e00-ae60-846c0972b499/head>); **B** means `a6b7baa0a20e28c412afbae5fd88819c12e94fd6`, at [base](<C:/Users/fashr/.codex/visualizations/2026/11/17/01a1eaad-a9b1-7e00-ae60-846c0972b499/base>). Bare repository `file:line` citations mean **H**, unless explicitly marked B. **P** means the independent probe [run/probe/astra-admission-records.test.js](<C:/Users/fashr/.codex/visualizations/2026/11/17/01a1eaad-a9b1-7e00-ae60-846c0972b499/run/probe/astra-admission-records.test.js:1>), which imports archive copies of H/B. Code and test observations below are **VERIFIED**; reachability limits and future conditions are explicitly identified.

The final branch includes the report and README row: 30 files, +2,405/−147. Excluding those two documentation files reproduces the brief's 28 files, +1,980/−147. The changed-file inspection found no flag/config pin, calibration-fence file, rule, index or `vercel.json` change. The live default remains `'off'` (`src/config/practiceFieldFlags.js:33`); the changed money-path call sites add window receipts, and close adds result parts (`entry.js:220`, `entry.js:373`, `exits.js:402`, `close.js:698`, `close.js:751`, all under `api/_utils/practiceField/`).

**T2C-01 — P1, blocker: admission ignores known missing corporate-action coverage**

Admission reuses `saleHeldBackBy`, but omits the separate daily-feed coverage check that makes the sales path fail closed. `readAdmissionMarkSet` reads only the slot/close snapshot; `admissionMarksOf` then checks listed actions, quote quality and age. The snapshot builder copies corporate-action rows but does **not** copy `caFetchFailed`. Thus a failed split fetch looks like “no action” to admission. Evidence: [admissionMarks.js:141](<C:/Users/fashr/.codex/visualizations/2026/11/17/01a1eaad-a9b1-7e00-ae60-846c0972b499/head/api/_utils/practiceField/admissionMarks.js:141>), [admissionMarks.js:192](<C:/Users/fashr/.codex/visualizations/2026/11/17/01a1eaad-a9b1-7e00-ae60-846c0972b499/head/api/_utils/practiceField/admissionMarks.js:192>), [mandateUniverseSnapshot.js:175](<C:/Users/fashr/.codex/visualizations/2026/11/17/01a1eaad-a9b1-7e00-ae60-846c0972b499/head/api/_utils/mandateUniverseSnapshot.js:175>), [mandateUniverseSnapshot.js:586](<C:/Users/fashr/.codex/visualizations/2026/11/17/01a1eaad-a9b1-7e00-ae60-846c0972b499/head/api/_utils/mandateUniverseSnapshot.js:586>). Compare the explicit refusal in [exits.js:168](<C:/Users/fashr/.codex/visualizations/2026/11/17/01a1eaad-a9b1-7e00-ae60-846c0972b499/head/api/_utils/practiceField/exits.js:168>) and its transactional daily read at `exits.js:347` and `exits.js:379`.

The independent reproduction uses the actual daily and fast snapshot builders with injected responses, then `admitIdea` and the actual close. It does not plant an inconsistent book or invent a new action type. The feed parser supports the 4-for-5 reverse split used here (`api/_utils/mandateCorporateActions.js:66`). Reproduction: **P:66**; output: [independent-evidence.json:156](<C:/Users/fashr/.codex/visualizations/2026/11/17/01a1eaad-a9b1-7e00-ae60-846c0972b499/independent-evidence.json:156>).

1. Enter $30,000 AAPL at $231.47 and close the previous session normally. Recorded equity is $99,991; the holding is 129.567558 shares.
2. On the next session, the daily builder records AAPL's corporate-action fetch as failed. The quote is a fresh, vendor-timed $289.3375 after a 0.8 reverse split. Its 25% price rise does not trip the 40% gap threshold (`api/_utils/mandateConfig.js:258`). The snapshot is correctly keyed and built before the admission.
3. Admission accepts a $21,000 short-slot JPM idea. Its packet states equity **$107,488.75** and short cap **$21,497.75**, using the unadjusted AAPL count.
4. Present the omitted split to the close at the same price. Equity is **$99,991**, making the short cap **$19,998.20**. The accepted reservation exceeds that by **$1,001.80**. The close is a diagnostic control, not a proposed change to accounting.

Refutation controls pass: a successful feed with no action permits the same genuine price appreciation; a listed reverse split refuses admission as `corporate_action_pending` (**P:82**). The quote's numerical freshness is therefore not the issue. Admission has discarded an explicit stored indication that its share basis cannot be trusted. The existing sales code already documents this exact small-split failure mode (`exits.js:168`). This is within admission's requested fail-closed work and is not Q1, Q2, Q-M, Q-O, the gap-screen `lastMarkAsOf` work, or a request to alter corporate-action settlement.

**Concrete fix, one change:** read the chosen mark session's daily corporate-action coverage in the admission transaction. Before valuing a held name, refuse a missing daily entry or `caFetchFailed: true`, with a typed symbol-specific `admission_marks_unavailable` reason. Handle an unavailable daily document conservatively for a held book; an empty book still needs no holding mark. Preserve the one selected price snapshot, and record the coverage refusal/provenance. Add the failed-fetch reverse-split regression, the missing-entry case, and the two successful-feed controls. Keep `ledger.js`, corporate-action application, fill/sale amounts and quarterly snapshot publication unchanged. The missing check belongs alongside `admissionMarks.js:192`; the existing check's semantics are at `exits.js:168`.

**Review of the final fixes and moved tests**

| Item | Result and current-head evidence |
|---|---|
| F1 / N4: invalid close cursors | Real-date round-trip validation covers both cursors before the calendar walk; impossible dates and nonstrings return an unknown owed session. Valid-date control remains. `admissionMarks.js:96`; `admissionMarks.test.js:284` and `:292`. No blocker found. |
| N2: closed book | Closed books owe no further close; admission still rejects inactive books. `admissionMarks.js:93`; `admission.js:156`; `admissionMarks.test.js:300`. |
| F2 / F3: malformed draft and epoch numbers | Shared helper validates the epoch's independent numbers on both paths; only the unknown slot's cap is omitted on malformed shape. `admission.js:107`, `:201`, `:405`; `admissionMarks.test.js:199` and `:217`. |
| `49f0b609` slot-share row | Adds 1.5 and −0.1 cases to the existing invalid-epoch battery, so integer-valued derived limits cannot conceal an invalid share. `admission.test.js:447`. Included in the passing focused run. |
| “Several failures at once” | Original refusals remain and `close_owed` is added with an exact session assertion. `admission.test.js:532`. |
| Null treasury / recorded equity | Malformed stored-book reconciliation remains tested. The pure evaluator now checks null treasury as invalid measured equity and separately proves that stale `totalValue` does not set the limit. `admission.test.js:466` and `:477`. This is the intended change of basis, not removal of the guard. |
| B12 / broken characters | Admission now refuses the broken thesis; the packet serializer is still directly exercised with the broken string and verifies after conversion. `evidence.test.js:183`; `contract.js:45`, `:101`, `:111`; `admission.test.js:53`. |
| Admission-before-fill moves | The fixture admits all ideas before entry and runs catch-up before fills, matching the actual window order. `__testsupport__/fixtures.js:275`, `:281`, `:296`; `sweep.js:217`. The changed accounting assertions were retained; the focused suite includes entry, exits, corporate actions, catch-up, reconciliation and founder controls. |

All files in this table are under `api/_utils/practiceField/`. N3's corrected “about 2,900” wording is consistent with the executable size calculation (`evidence.js:300`, `evidence.test.js:660`).

**Admission marks and time boundaries**

The original T1A-05 probes pass: after a 20% decline the short cap is **$18,798.56**; after a 20% rise the cash-floor headroom is **$59,401.08** and Technology headroom **$17,005.40**. The cap itself admits and one cent above it refuses. Equity rounds holdings once per idea and computes limits in cents (`admissionMarks.test.js:47`, `:74`, `:328`; `admissionMarks.js:201`, `:218`; `ledger.js:812`; `admission.js:198`).

Selection checks session and key, finite build time and build-at-or-before-decision, and searches opened slots newest first. A newest valid snapshot missing a holding refuses instead of falling back to an older priced snapshot. Untimed, incomplete, pre-open, prior-session and over-30-minute-at-build quotes are refused; exactly 30 minutes passes. Listed pending splits and recorded share-basis holds refuse. This passes the stated selection and quality checks, subject to **T2C-01's omitted daily-coverage check** (`admissionMarks.js:112`, `:141`, `:192`, `:206`; `admissionMarks.test.js:102`, `:149`, `:169`, `:177`, `:349`).

Independent boundary probes cover 6/9 March and 30 October/2 November around DST, and the 27 November early close. At 09:30 through 09:59 the in-session key list is empty; 10:00 opens the first candidate; exactly 16:00, or 13:00 on the early close, owes the close and selects the completed-session basis. Weekend/pre-open behavior is also covered by the branch tests (**P:154**; `admissionMarks.test.js:237`, `:271`, `:306`). The accepted absence of an additional admission-time age cap is unchanged; T1b must use its own window snapshot and server time.

**Top-up, records and receipt parts**

The new top-up publication rereads the daily document inside its transaction, preserves stored symbols, unions distinct action payloads, and recomputes counts. Both read/write interleavings in the branch tests pass. Independent probes passed all six commit orders of three top-ups, plus a failed commit followed by retry; failed publication left the original document unchanged (`api/_utils/mandateUniverseSnapshot.js:307`, `:344`, `:370`, `:611`; `api/_utils/mandateUniverseSnapshot.topUp.test.js:162`; **P:119**, **P:128**).

Two rows of one action id are intentionally preserved. In both row orders, the idea and same-stock comparison ledgers record a conflict and pay neither. The probe then checks that a single corrected payload applies once to the idea ledger and that replaying it on another close adds no second payment. The mechanism is the conflict grouping, first-id filter and durable applied ids (`ledger.js:354`, `:523`, `:545`, `:163`, `:702`; **P:94**). The separate quarterly duplicate-id defect remains outside this arc as directed.

Window action receipts share their action transaction (`entry.js:220`, `:373`; `exits.js:402`; `close.js:763`). The normal failed-row-write/retry tests pass for entry, sale, timeout and catch-up (`windowLedger.test.js:455`). Conditional served-row and delayed-attempt weaknesses are qualified in T2C-02 below; they are not reported as current production regressions.

Founder replay reads the deterministic operation's own book before deciding from the current claim, preserving A after A closes and B opens, including the pending founder-response recovery. Both relevant suites pass (`ideaBook.js:222`; `ideaBook.test.js:235`; `founderControls.test.js:546`). Q7 counts `bookClosed` from catch-up as closed (`sweep.js:362`; `catchUp.test.js:410`).

Receipt parts are sealed over their complete bodies; the root packet hashes their ids, counts and hashes. The close uses `tx.create` for root and every part in the same transaction. A pre-existing part aborts the entire endpoint close without changing the part or writing the endpoint/root. Missing and altered parts are rejected by the part checker. A 20-receipt stress case with large receipt bodies split into multiple parts, demonstrating size-based splitting independently of the 3,549 count (`evidence.js:335`, `:362`, `:558`, `:586`; `close.js:751`; **P:110**, **P:167**).

`verifyPacket` is only a document's own hash check. Complete result validation must combine it with `resultPacketPartProblems(packet, partDocs)`; the former alone cannot establish that referenced parts exist. The current end-to-end reader does both, and the missing-parts probe fails the latter. T1b's reader must preserve this composition (`evidence.js:74`, `:362`; `endToEnd.test.js:267`, `:279`). No production result-reader call site was found that accepts a root alone.

The 3,549 bound is specifically **applied receipts at the endpoint** under today's feed and maintained calendar: four idea holdings + eight basket holdings + SPY; three emitted action kinds with one id per kind/ticker/date; at most 91 calendar dates in the 60-session long slot. Sales only reduce holdings. The executable bound test derives all factors, constructs the bound and checks the split documents and root. The reproduced part sizes were 523,520, 523,578 and 283,035 bytes, with a 239,077-byte root packet ([receipt-size.log:7](<C:/Users/fashr/.codex/visualizations/2026/11/17/01a1eaad-a9b1-7e00-ae60-846c0972b499/receipt-size.log:7>)). It is not a bound on all conflict/decline receipts retained on the idea document (`evidence.js:277`; `evidence.test.js:556`, `:585`, `:596`; `api/_utils/mandateCorporateActions.js:53`, `:66`, `:96`). See T2C-04 for the separate idea-document size issue.

**Backlog findings — not additional merge blockers**

| Finding | Severity, evidence and concrete follow-up | Home / why nonblocking here |
|---|---|---|
| **T2C-02: window count normalization is conditional** | **P2, conditional.** A served row returns before reconciling newly merged receipts (`windowLedger.js:128`, `:189`). A sweep probe first records a waiting sale, loses the stamp, then repairs daily coverage through a delayed top-up; the retry sells once, but the row still says zero fills and `no_model_action` (**P:28**). Separately, folding B then delayed A with two receipts produces count 3 because B already incorporated A's receipt (**P:57**; `windowLedger.js:138`). Fix by keeping receipt-derived totals separate from attempt-derived totals and reconciling new receipt keys even on a served row, without adding a delayed attempt to a total that already includes it. | **T1b**, before adding mutable within-window duties. The first probe seeds an omitted daily document missing an already-held name; reachability of that starting state through today's normal producer was **not established**. The overlap probe is a pure-fold control, not proof of overlapping production passes: the current lease TTL equals the 300-second handler duration (`api/_utils/mandateConfig.js:141`; `api/cron/mandate-evaluate.js:73`). Do not present either as a proven current cron blocker. |
| **T2C-03: explicit force can erase carried actions** | **P2, operational.** Both top-up/force orders can lose a carried dividend. `force` still blindly replaces the daily document; a top-up committing afterward adopts the replacement of a carried symbol (`api/_utils/mandateUniverseSnapshot.js:262`, `:351`; **P:137**). Before exposing an operational rebuild, isolate it from top-ups and define preservation/reconciliation of held-symbol actions. | **T5**. This is the unchanged forced-replacement path, and no production caller passing `force` to this daily builder was found. Five first-build/adopt/force base/head controls matched (**P:147**). Changing quarterly force semantics in this PR would violate the brief's isolation condition. |
| **T2C-04: the idea document remains the size bottleneck** | **P2, capacity.** The bound fixture reaches 1,288,985 bytes on the idea itself; the sizing estimate fits 2,879 such receipts. A close rewrites the changed idea (`evidence.js:300`; `evidence.test.js:660`; `close.js:737`; [receipt-size.log:8](<C:/Users/fashr/.codex/visualizations/2026/11/17/01a1eaad-a9b1-7e00-ae60-846c0972b499/receipt-size.log:8>)). Add the agreed size alert and review whether receipts must move during the corporate-action finish. | **T1a-2b-3**, as Q6 already directs. No ordinary currently emitted feed scenario approaching thousands of applied receipts was established. The 52-receipt monthly stress shape remains below 64 KiB in the test (`evidence.test.js:672`). This is a synthetic sizing envelope, not verified provider-frequency data or a proof against arbitrary vendor corruption. |

Q1–Q6 and the enumerated T1a-2b-3 corporate-action items retain their stated homes. In particular, T1b must not consume a refill attempt for ex-dividend refusal or `close_owed`; the present age policy, creation cutoff and server-time caller condition are not reopened.

**Access and rules**

`mandates/{bookId}/ideas/{ideaId}/evidence/result_actions_NNN` matches the existing `/ideas/{ideaId}/evidence/{packetId}` rule. The parent book must have `kind == 'idea_book'` and its `userId` must equal the authenticated uid; every client write is false. `windows/{rowId}.actions` is covered by the existing whole-document `/windows/{rowId}` rule with the same owner-read / no-client-write policy. There is no new field-level grant (`firestore.rules:1538`, `:1555`, `:1566`).

The full local rules suite ran against `127.0.0.1:8087`, project `demo-tradeseven-rules`: **838 passed, 1 failed, 46 files**. The only failure is `test/rules/agentEvalRunsDenials.rules.mjs:140`. Its comment-stripping regex at `:132` leaves `// Admin SDK only` when a line ends in CRLF. The same file on B produced **11/12** with the same failure; both rule text and test source are identical. An LF-normalized lexer control yields the expected statement ([rules-text-control.json](<C:/Users/fashr/.codex/visualizations/2026/11/17/01a1eaad-a9b1-7e00-ae60-846c0972b499/rules-text-control.json:1>)). This is not an access denial failure and not a branch-introduced change.

Two additional local emulator tests explicitly target `result_actions_001` and a populated `actions` map. Owner reads succeed; other-user, privileged-claim and anonymous reads fail; create/update/merge/delete fail for every client context, including the owner ([run/probe/astra-new-records.rules.mjs:19](<C:/Users/fashr/.codex/visualizations/2026/11/17/01a1eaad-a9b1-7e00-ae60-846c0972b499/run/probe/astra-new-records.rules.mjs:19>); [new-record-rules.json](<C:/Users/fashr/.codex/visualizations/2026/11/17/01a1eaad-a9b1-7e00-ae60-846c0972b499/new-record-rules.json>)).

**Differentials and end-to-end evidence**

The original harnesses were copied unchanged. Their SHA-256 values are `17e724ad1f566c3999df642b4d1be3d8628a4d949cda2692f2259c35aec8995c` and `9297cead5bca68c4b024230f818223784d2197b991acb7feaf8e75694f8bc5c3` ([verification-summary.json:121](<C:/Users/fashr/.codex/visualizations/2026/11/17/01a1eaad-a9b1-7e00-ae60-846c0972b499/verification-summary.json:121>)). Against fetched B and reviewed H:

- **17 scenarios × off/on: 34/34 identical**, plus the 4,000 build-set comparisons and prompt row: **36/36 tests**. Responses, stored state, logs and injected upstream/model calls are compared (`run/probe/astra-differential.test.js:34`).
- **40/40 traced comparisons identical**. Trace evidence SHA-256: `6c169f2692b09e835ba16c107883657cd10bf53ea9a4caf68bd906fed49ce760`, matching the reported prefix (`run/probe/astra-cron-trace.test.js:49`; [verification-summary.json:117](<C:/Users/fashr/.codex/visualizations/2026/11/17/01a1eaad-a9b1-7e00-ae60-846c0972b499/verification-summary.json:117>)).
- First build, adoption, force over empty/full/omitted documents: five explicit additional base/head controls passed (**P:147**). Ordinary top-up interleavings are checked separately, because that path intentionally changes.

The end-to-end dumps reproduce the pins in `api/_utils/practiceField/endToEnd.test.js:64` and `:293`:

| Tree | Documents | Bytes | SHA-256 |
|---|---:|---:|---|
| B | 155 | 384,605 | `f9c91e33f6bafa05b46ec4d7ce5d67d8ad1a8a80a4b92d42b4412fcbf76ad6ed` |
| H | 163 | 389,807 | `288b0c895bd86a06181d501fb862962d86e445b1c632c1921a7baab413d0069c` |

**No existing money leaf changed.** The only existing scalar changes are the six packet hashes; seven close rows gain the `open30` element in `session.notServedButAttempted`. Added fields record admission measurement and the part manifest; inline receipt arrays are replaced by the part. No document is removed. The comparison treats an array as one value, so its structural counts differ from the build report's flattened-leaf counts; the actual dumped bytes match ([e2e-diff.json](<C:/Users/fashr/.codex/visualizations/2026/11/17/01a1eaad-a9b1-7e00-ae60-846c0972b499/e2e-diff.json:1>)).

The eight added documents, all beneath `mandates/pf_0361cd058cc2b6af41bd8a21/`, are:

1. `ideas/idea_500fd1bfeebdbb9330b4037c/evidence/result_actions_001`
2. `windows/2026-11-16_open30`
3. `windows/2026-11-19_open30`
4. `windows/2026-11-20_open30`
5. `windows/2026-11-25_open30`
6. `windows/2026-12-08_open30`
7. `windows/2026-12-09_open30`
8. `windows/2026-12-24_open30`

These correspond to the new part and transactional window receipts (`close.js:751`; `entry.js:373`; `exits.js:402`), not additional money transactions. The independent cap defect was exercised separately because the pinned lifecycle's successful admissions hold no position (`endToEnd.test.js:64`, `:192`).

**Verification limits and single confirmation round**

Focused tests, independent probes, differentials and the rules results are recorded in [verification-summary.json](<C:/Users/fashr/.codex/visualizations/2026/11/17/01a1eaad-a9b1-7e00-ae60-846c0972b499/verification-summary.json:9>). Lint gate exited 0. Both Vite builds exited 0 and produced the same 113 filenames and all executable/static bytes. Fifty-two source maps differ only in their `sources` checkout paths; normalizing only `run/base` versus `run/head` makes the entire output equal ([build-comparison.json](<C:/Users/fashr/.codex/visualizations/2026/11/17/01a1eaad-a9b1-7e00-ae60-846c0972b499/build-comparison.json:1>); `vite.config.js:13`). The initial build lacked the pinned `three` package in the shared installed dependencies; supplying `three@0.184.0` in isolated scratch space allowed both builds to complete. No lockfile or checkout dependency change was made.

The full application suite, Linux run and 51-mutant battery in the build report were not independently rerun. No live CI claim is made. The confirmation round can stay narrow: implement T2C-01, show the failed/missing-coverage cases refuse without writes, retain successful-feed/empty-book controls, rerun admission and the existing differentials, and confirm the fenced files, flag and money paths remain unchanged. No additional review round is requested for the explicitly qualified backlog findings.

**Every HEAD/ref read**

| Commit | What was read |
|---|---|
| `7687cfa5a77dc6981bf661ecf028ce5cdd280b66` | Review branch HEAD; detached H worktree, source, tests and report. |
| `a6b7baa0a20e28c412afbae5fd88819c12e94fd6` | Fetched `origin/main`; detached B worktree and comparison/test baseline. |
| `cfa6ed491da25f627cce8e13ce56f4bb4c7a69c9` | Final product-change diff, including F1/F2/N2/N4. |
| `49f0b609269ced3343fc3a116c4d66a489f559ae` | Final code-head test-row diff. |
| `d547e313a6c7d01ca259d0793217757d885c1092` | Merge-parent log metadata only; no separate source worktree read. |
| `4feb6b8efff739afd5dbc63403323c9023a98156` | Initial shared-checkout HEAD/status and tooling package manifest; not used as the review baseline. |

**Final results:** rules **838/839**, with the same CRLF source assertion failing on base; new-access checks **2/2**; scenario differential **34/34** and traced differential **40/40** identical. **Verdict: DO NOT MERGE — T2C-01 only.** Report: `C:\Users\fashr\.codex\visualizations\2026\11\17\01a1eaad-a9b1-7e00-ae60-846c0972b499\20261117_ASTRA_REVIEW_T1A2B2.md`.
