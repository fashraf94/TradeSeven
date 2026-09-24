# Cockpit Build 0 call records — PR #903 branch review

**Date: 2026-09-24. Verdict: MERGE WITH CHANGES.** No implementation defect found here blocks merging the branch with `CALL_RECORDS_MODE = 'off'`. **Do not enable shadow yet.** Fix the per-call E-3 judgment rule, the gameplan observation membership, and the model-visible descriptions before the flip. Reconcile the governing documents with the accepted rulings. The current code can lose an unexamined call's judgment or record a hit attributed to a deterministic pass that never examined its price; both paths are dormant at off.

| Decision | Disposition |
|---|---|
| Merge at **off** | **Allowed on this review's evidence.** The default remains off; the focused off proof and pre-build replay pass. This is not a merge, deployment, or CI approval action. |
| E-3 design question | **Choose Fable's per-call rule, with “judges” meaning a successfully committed judgment.** The battle-level scan timestamp is the wrong authority. This clarifies/supersedes the literal battle-first wording in the founder ruling; it is not already the behavior at HEAD. |
| A-1 ruling commit | **Implementation accepted.** A config hash alone does not prove an equipped watchlist. The unresolved issue is the contradictory pinned contract text, BR-4. |
| Model-visible tool text | **Sign-off withheld**, narrowly for player-response language in an invisible recording phase, BR-3. Intent-only wording, existing decision/anticipation authority, and the forbidden-signal pin otherwise pass. |
| Build report's off-proof claim | **Qualified pass.** The exercised payloads match pre-build behavior; ledger and anticipation writer-argument coverage is empty, BR-6. |
| Shadow | **Blocked by BR-1–BR-4.** Existing index/rules deployment and token-measurement prerequisites also remain; no deployment was inspected. |
| Review delivery | One documentation file on `docs/review-build0-call-records`; commit, push, stop. No implementation, spec, contract, flag, or rule changes. |

## 1. Baseline, authority and evidence

| Pin | Verified value |
|---|---|
| Repository / PR | `https://github.com/fashraf94/TradeSeven.git`, PR #903 |
| Initial workspace | `C:/Users/fashr/.codex/worktrees/0527/portfolio-duel`; detached `40acd19961cdc557e03efe86a88b6e9de2600d59`, clean |
| Fetch | `git fetch origin` succeeded before remote comparisons, after an authorized retry for shared Git metadata permissions. |
| Reviewed branch / HEAD | `origin/claude/cockpit-build0-call-records` = **`43b61987b0ca993348a0755f081a57883a17eecc`** |
| Review branch | Created `docs/review-build0-call-records` at that exact HEAD, as requested; clean before the report. |
| Fetched main / merge base | `origin/main` = `40acd19961cdc557e03efe86a88b6e9de2600d59`; merge base = `987a9a68cf8c25c4df79b6db10827cede528a06a` |
| **Contract committed-blob SHA-256** | `docs/CALL_RECORD_FIELD_CONTRACT_V1_3.md`: **`7161e113efbac2e3fd05e4c45da3080d7d62ad0dcfc3ea1d9e30d38642c4fc25`** |
| Spec committed-blob SHA-256 | `docs/design/COCKPIT_SPEC_V1_3.md`: `5a6a9a4eee1c2337bba0f7b1348798d72cb639ee0c6b10dd785a621e71ea9939` |
| Off fixture committed-blob SHA-256 | `api/_utils/__fixtures__/callRecordsOffGolden.json`: `15a442dd066ba17104621083dc13deba3bd671167da538b4f232815fb6381091` |
| Hash method | SHA-256 over raw `git show 43b61987:<path>` bytes through Node `execFileSync`, without decoding or newline conversion. Checkout hashes are not these pins. |
| Prior review | Read the round-3 report on fetched main, `docs/audits/20260924_COCKPIT_SPEC_V1_2_REVIEW.md`; its source baseline is historical, not this branch's line map. |

All source citations below refer to **43b61987**, before the report-only commit. **VERIFIED** means source/Git inspection; **REPRODUCED** identifies local synthetic execution. Neither means observed in production. Severity P2 identifies a correctness or handoff fix required before shadow; P3 identifies a test portability fix. Confidence is high for the findings below.

The build report is an input to challenge, not independent proof. Its §12 explicitly supersedes its old pending-ruling statements and the affected spec/contract clauses (`docs/audits/20260924_BUILD0_CALL_RECORDS.md:500-507`, `docs/audits/20260924_BUILD0_CALL_RECORDS.md:526`, `docs/audits/20260924_BUILD0_CALL_RECORDS.md:561`). The review therefore does not mislabel the two authorized changes as unauthorized deviations. Their results and remaining documentary conflicts are assessed separately.

Repository `BUILD_RULES` §2 requires independent adversarial review at this diff size (`docs/BUILD_RULES.md:40-52`). Review lanes covered off/schema/rules, seams/publication, and an independent attempt to refute the ruling and observation findings. Each reviewer used a distinct `git archive` snapshot under the system temp directory, with existing dependencies linked in. No product source was changed in those snapshots; a disposable test file was added only to the seam-review snapshot. No new tests were added to the repository.

## 2. Findings and fixes

### BR-1 — E-3 uses a battle scan as evidence that an individual call had its judgment

**P2 · CONFIRMED / REPRODUCED · before shadow · commit `a78bbfb3`.** A call that the first scan never examined can lose its only opportunity to be judged. Infrastructure failures can have the same effect even when the scan reads zero calls.

**Evidence.** `decideFlip` expires a `next_check` call solely because `priorScanAtMs >= expiresAt`, before testing its current condition (`api/_utils/callRecords/flip.js:113-121`). `runCallFlips` takes that prior instant from the battle, not the call (`api/_utils/callRecords/flip.js:255-258`). Every `finish` returns the current observation instant, including deadline, cached missing-index, and query-failure exits (`api/_utils/callRecords/flip.js:263-306`). Both phase types persist that status (`api/_utils/callRecords/flip.js:377-390`, `api/_utils/callRecords/publish.js:349-361`).

The builder's own test locks the lost opportunity: an older call consumes the first scan's deadline; the next-check call remains open and unvisited; a later observation with price 170 meets the condition but becomes `expired_unresolved` (`api/_utils/callRecords/flip.test.js:248-269`). This row passed in the review. An independent network-free store probe also reproduced: first query throws `UNAVAILABLE`, status records `scanned: 0` and the post-slot instant; after persisting that status, a successful scan observes AMD 110 above level 100 and writes an expiry receipt with px 110, not a hit.

**Adjudication.** The builder's implementation approximates the literal §12 phrase “first check,” but cannot make it a reliable battle-wide event: a budget-skipped hook or failed status write leaves the clock unchanged, while a failed query that returns status advances it. The two disclosed edges are real, and the zero-read failure is an additional case. The result depends on status-write success and unrelated calls ahead in the cursor, rather than an observation of this call. Calling that evidence “judged once” is incorrect.

**Fix: adopt Fable's per-call rule.** For an eligible, still-open `next_check` call at or after its slot, test the current observation once: met → `hit`; otherwise → `expired_unresolved`. Commit the state and receipt together. Remove `priorScanAtMs` from `decideFlip`, `planFlip`, `flipOne`, both call sites, and the battle-status read. Remove the new status `observedAtMs` field, or retain it solely as explicitly non-authoritative telemetry if there is a separate reason to do so. Keep the cursor, deadline, parent, minting-evaluation, and post-mint observation checks.

No new per-call “already judged” marker is needed at HEAD: `planFlip` rejects non-open calls, and the transaction re-reads the call and active parent before creating the receipt and terminal transition (`api/_utils/callRecords/flip.js:158-167`, `api/_utils/callRecords/flip.js:202-225`). A later check skips that terminal call. A read, query, or transaction that fails before committing has not durably judged it; a later attempt may use its own fresh observation. An unconfirmed transaction can still commit late, so preserve the transactional state check, not an in-memory assumption about success.

**Required test changes.** Reverse the expected result of the never-reached/later-hot row to `hit`; replace prior-scan unit pins with tests showing the battle clock cannot affect judgment. Cover a failed first query, missing-index recovery, budget skip, status-write failure, transaction abort, unconfirmed-then-committed transaction, and two competing judgments yielding only one terminal state/receipt. Keep no-price/pick misses, exact-slot `>=`, minting-check exclusion, other horizon bases, and fresh observations. Existing pre-slot hits remain governed by the ordinary inside-horizon rule; removing them would be a separate design change, not part of this fix.

**Contract consequence.** This is a clarified ruling: “first check that reaches and successfully judges this still-open call,” not the first scan of the battle. `expiresAt` for `next_check` becomes the scheduled judgment eligibility boundary. A delayed first reach can consequently judge later than the slot while the parent remains active; do not describe the receipt as a quote from the missed slot. Build 1's sweep must explicitly honor this opportunity or record a separate agreed unobserved-expiry policy; mechanically expiring every `next_check` at its slot would recreate E-3. No worker exists at HEAD, so this future coordination does not block an off merge.

Concurrency guarantees **one committed judgment**, not that the earliest observation necessarily wins a race. Keep that distinction in the amended contract and align the tool's `next_check` horizon wording with the chosen judgment boundary.

### BR-2 — A non-price gameplan pass can manufacture a price encounter

**P2 · CONFIRMED / REPRODUCED · before shadow.** The gameplan exits can record a call as hit with source `gameplan_pass`, although that pass never examined a price.

**Evidence.** The suppression pass treats any nonempty injected guardrail array as sufficient to freeze all held names after `applyGuardrails` (`api/cron/agent-evaluate.js:5230-5258`). Suppression passes `haikuResult: null`. A pass containing only `maxSectorWeight` has no stop, trailing stop, or profit-target scan; its sector check requires `originalDecision === 'SWAP'`, which is false here (`api/_utils/agentGuardrails.js:219`, `api/_utils/agentGuardrails.js:250-265`, `api/_utils/agentGuardrails.js:288-305`, `api/_utils/agentGuardrails.js:317-327`, `api/_utils/agentGuardrails.js:355-365`). Non-price `maxPosition` likewise does not inspect symbol prices (`api/_utils/agentGuardrails.js:410-421`).

**Reproduction.** Two snapshot-only real-cron cases used pending/created gameplans, a sector-only 40% guardrail, and an older open KO-below-62.50 call. Both wrote `hit` receipts with px 62 and source `gameplan_pass`. A third assertion, independently repeated with the real `applyGuardrails` and a Proxy around prices, observed **zero symbol-price reads**, `HOLD`, and no overrides. All three defect assertions passed. This is synthetic branch behavior, not production incidence.

The earlier scoring pass can read held prices, but the specification assigns these two rows specifically to the set examined by the deterministic pass (`docs/design/COCKPIT_SPEC_V1_3.md:74-75`). Earlier scoring does not justify a later receipt naming a different examination source. The build's empty-guardrail fix addresses only the zero-length case; the report's broader statement remains incomplete (`docs/audits/20260924_BUILD0_CALL_RECORDS.md:486`).

**Fix.** Derive the observation membership from actual deterministic price examination. A sector-only, max-position-only, or otherwise non-price pass must freeze an empty set and still permit expiry. If a narrow non-fenced adapter is used, establish that the applicable price-scanning guardrail actually ran; mere nonempty configuration is insufficient. Preserve the one-instant observation rule and add both pending/created counterexamples. Instrumenting the fenced helper itself would require its normal separate authorization; this review implements neither option.

### BR-3 — The declarations descriptions still solicit an invisible player's response

**P2 · CONFIRMED · before shadow · model-visible text sign-off withheld.** The recording disclaimer removes a promise to execute, but does not tell the model that nobody receives or answers these fields in Build 0.

**Evidence.** `defaultAction` still speaks about “the player says nothing” and not trading “without the player”; `playerAsk` asks for a question for the player; `fork` asks for a choice the player should make (`api/_utils/agentEvalToolSchema.js:288`, `api/_utils/agentEvalToolSchema.js:302-314`). The block is already model-visible at shadow while the contract says nothing is rendered and chat is unchanged (`docs/CALL_RECORD_FIELD_CONTRACT_V1_3.md:105`). Its current prose test asserts intent/no execution/non-replacement but never checks invisible-recipient language (`api/_utils/agentEvalToolSchema.declarations.test.js:114-120`). Thus §8 C-4 is only partially fixed, despite its “Fixed” label (`docs/audits/20260924_BUILD0_CALL_RECORDS.md:392`).

**Fix, limited to descriptions.** Retain the typed fields and explicitly frame these as unserved records of existing intent. Suggested wording:

- Block: “Optional record of conditional intent from this check. These fields are stored only; they are not shown to the player, do not request a response, do not execute or schedule a trade, and are not supplied to a later check. They do not change this check's decision or anticipationCandidates.” Retain the existing omission/cap/quote-source guidance.
- `defaultAction`: “Intent recorded at declaration time if the condition is met: act = would favor a trade; hold = would favor holding. This records an intention, not an instruction or promise of execution.”
- `playerAsk`: “Optional record of an unresolved research question and 2 to 4 possible answers. Stored only; no question is delivered and no answer is expected.”
- `fork`: “Optional record of an unresolved choice for one slot: 2 to 4 names from this battle that could replace swapOut. Stored only; no selection is requested or acted on.”

Use similarly conditional/presentation-only wording for `said`; do not direct the model to wait, suppress a trade, duplicate narration, or obtain permission. This review signs off the **direction of those edits**, not an unreviewed future text diff or future model behavior.

### BR-4 — A-1 is correctly implemented, but the pinned handoff still teaches its opposite

**P2 documentation alignment · CONFIRMED · before shadow/another consumer · commit `b0105b0f`.** The attack on the A-1 code does **not** survive. The remaining fix is to the authoritative handoff, not to restore `hash_without_watchlist` behavior.

**Evidence for accepting the code.** `resolveProvenance` handles absent/null snapshots before inspecting the hash; present malformed snapshots and invalid versions remain unresolved; valid versioned/legacy provenance stays equipped (`api/_utils/callRecords/candidate.js:107-125`). The real battle producer writes null for no equipped watchlist (`api/_utils/agentBattleService.js:193-200`). The config hash covers rules, bundles, leans, dials, guardrails and even `equippedWatchlist: null`; it exists independently of a watchlist (`api/_utils/resolvedAgentManifest.js:124-165`). No live watchlist fetch was added.

Absent/null with and without a hash, malformed present values, valid legacy and synthetic versioned shapes were tested. A missing entire context follows the explicit absent-snapshot ruling too; recovering historical intent from other records would contradict the chosen rule. Versioned provenance remains a synthetic path at this build, not a claim that the current watchlist producer emits versions (`api/_utils/callRecords/candidate.js:102-105`).

**Remaining contradiction.** Contract §4 still lists “hash without watchlist” as unresolved, while spec §3.6 repeats that rule (`docs/CALL_RECORD_FIELD_CONTRACT_V1_3.md:60`, `docs/design/COCKPIT_SPEC_V1_3.md:85`). §12 acknowledges this deliberately (`docs/audits/20260924_BUILD0_CALL_RECORDS.md:526`). Its explicit supersession is enough to interpret this branch, but a consumer given only the pinned contract can implement the opposite origin rule. E-3 also changes the meaning of the slot and the old expiry/state language, as BR-1 explains.

**Fix.** Publish a versioned contract/spec amendment incorporating A-1 and the clarified E-3 rule, update consumer references and committed-byte hash pins together, and retire the contrary clauses explicitly. Do not silently change the blessed V1.3 bytes while continuing to advertise the old SHA. Until then, handoffs must carry the actual §12 rulings and this E-3 adjudication. The SHA reported above is the existing V1.3 hash, not a claim that its literal prose matches all HEAD behavior.

### BR-5 — The off proof is reproducible, but its new tests depend on checkout and timezone

**P3 · CONFIRMED / REPRODUCED · test portability follow-up; no product blocker at off.** A normal CRLF/Chicago snapshot reports failures even though the same scenarios pass on both pre-build and current product code.

The golden check hashes raw checkout bytes against a committed-LF hash (`api/cron/agent-evaluate.callRecords.offGolden.test.js:406-407`). This repository has `core.autocrlf=true` and no `text`/`eol` attribute for the fixture. The new rules-source parser splits on LF then strips comments before trimming; the terminal CR defeats the anchored regex for the inline queue comment (`api/_utils/callRecords/callRecordsRulesIndex.test.js:40`, `firestore.rules:923`). Two new gameplan golden comparisons also inherit the pre-existing local-time construction at `api/cron/agent-evaluate.js:5947-5951`: Chicago yields 21:00Z where the fixture captured 16:00Z.

**Observed results:** initial five-file native run: 57 passed / 4 failed (golden hash, two gameplan rows, queue comment parser). UTC resolves the gameplan differences. A fresh `git -c core.autocrlf=false archive` preserves committed bytes without rewriting source; under UTC all seven focused proof suites pass, **87/87**. The same off fixture then passes **23/23** against pre-build product source. A separate pre-existing CRLF-sensitive source regex in `intradayPromptExclusions.test.js` also failed when that suite was added to the CRLF run; it is not attributed to this change.

**Fix.** Pin the byte-identity fixture to LF using an explicit attribute or verify its committed bytes deliberately; make the new rules comment parser CRLF-safe, including its shared rules-suite copy (`test/rules/callRecordsRulesSuite.mjs:62`); set a deterministic timezone for the golden test process. Preserve the raw-byte provenance check rather than weakening it to an arbitrary JSON comparison. Any correction to the old gameplan runtime's timezone handling is a separate task.

### BR-6 — The fixture does not exercise the ledger and anticipation arguments the report says it proves

**P3 evidence scope · CONFIRMED by independent fixture counts · correct the assurance or extend coverage.** The executive claim includes every argument sent to ledgers and narrators (`docs/audits/20260924_BUILD0_CALL_RECORDS.md:12`), but the off harness forces tournament context to null (`api/cron/agent-evaluate.callRecords.offGolden.test.js:73-76`). Across all 19 golden scenarios, `reserveSymbol`, `confirmSwap`, `releaseReservation`, `generateAnticipation`, `logVisionTransition` and `logAnticipation` each have **zero calls**. Equality of these empty lists proves their absence in these scenarios, not their argument compatibility when invoked.

Executor, learning-receipt and trade-narration coverage is real: each has four invocations; evaluation logging has eleven. The harness also intentionally replaces database/battle arguments with placeholders and captures mocked arguments after the scenario (`api/cron/agent-evaluate.callRecords.offGolden.test.js:295-313`). Transient argument changes and omitted/non-JSON values are outside the serialized comparison.

**Fix.** Narrow the build report to the exercised serialized payloads, or add at least one actual tournament reserve/confirm/release path and one dispatched anticipation path with positive call-count assertions and payload snapshots at invocation. Preserve the independently verified pre-build baseline. This is a gap in the stated proof, not an observed change to ledger or narration behavior, and it does not independently block off merge.

## 3. Central claims checked against HEAD

### Flag-off byte identity and fixture provenance

**VERIFIED and locally replayed, within its mocked boundary.** The flag is off (`src/config/featureFlags.js:2806`). The off tool returns the original base object; the on tool has its own deep clone and adds only declarations (`api/_utils/agentEvalToolSchema.js:344-368`). The calls mode is resolved once at the per-battle check's context creation, not repeatedly during that check (`api/cron/agent-evaluate.js:907`); the outer cron can process multiple battles, so “once per handler invocation” in spec §2 should not be read as a separately latched whole-run value. The shipped flag is a static module constant, and no current runtime change follows from that distinction.

The golden compares battle updates, prompt/request payloads, both capture outputs, summaries, writer-argument projections, and thrown results in 19 scenarios. It checks all four seeded stores remain unread and unchanged, and no calls keys ride battle writes (`api/cron/agent-evaluate.callRecords.offGolden.test.js:136-153`, `api/cron/agent-evaluate.callRecords.offGolden.test.js:358-432`). These are substantive assertions, including actual pass-ran and execution rows, not empty snapshots.

**Independent provenance check:** Git history places the original fixture at `20d207d7`, before product implementation; the later fixture/harness strengthening is `ec19cd58`. A separate committed-LF archive of `20d207d7`, with **unchanged pre-build product code** and only the exact current test/fixture support files overlaid, passes the current off suite: **23 tests, all 19 scenario comparisons**. No golden regeneration or product adapter was needed. The current HEAD passes the same suite. This checks the fixture's content against pre-build behavior; a SHA label alone would not.

**Limits:** the harness mocks providers and writers and uses controlled clocks/IDs. Writer serialization deliberately substitutes `<db>` and `<battle>` identities (`api/cron/agent-evaluate.callRecords.offGolden.test.js:395-401`); “every argument” therefore means the serialized projection the harness records, not every byte inside arbitrary objects or a live executor's side effects. Ledger and anticipation invocation coverage is absent (BR-6). This is strong regression evidence for the covered scenarios, not a proof of universal timing, every input, hosted writes, or trading equivalence after shadow adds model-visible tokens.

### The eight exit seams and their instants

All eight hooks exist and run after their authoritative battle write. **Gameplan membership has the BR-2 exception.** Quotes are detached at all three fetch sites (`api/cron/agent-evaluate.js:1037`, `api/cron/agent-evaluate.js:1446`, `api/cron/agent-evaluate.js:2480`), before forced entry-price replacement (`api/cron/agent-evaluate.js:2279-2280`). The adapter uses `current`, excludes unusable/fallback/future-fetched quotes, and freezes only the first observation (`api/_utils/callRecords/observe.js:43-92`).

| Exit | Examined set and observation instant | Authoritative write / hook, in `api/cron/agent-evaluate.js` |
|---|---|---|
| Model result | Held prompt rows plus augmented flattened bench, detached fetched quotes; finite `Date.parse(promptBuiltAt)` after successful prompt build; replacement marker preserved (`api/cron/agent-evaluate.js:2724-2740`). | Final update `api/cron/agent-evaluate.js:4383`; identity then model phase `api/cron/agent-evaluate.js:4386-4408`. Only this row publishes. |
| Transport failure after prompt | The same already-frozen prompt observation; failure classification changes the exit, not its instant (`api/_utils/callRecords/observe.js:130-135`). | Same final update; non-model hook `api/cron/agent-evaluate.js:4399-4408`; no publication. |
| Budget skipped | Held plus current bench; this exit's clock, without a fabricated prompt timestamp (`api/cron/agent-evaluate.js:2654-2660`). | Same final update and non-model hook. |
| No trigger | Held plus current bench; exit clock (`api/cron/agent-evaluate.js:2550-2557`). | Score write and hook `api/cron/agent-evaluate.js:2558-2565`. |
| Proposal pending | Held plus current bench; exit clock (`api/cron/agent-evaluate.js:2317-2324`). | Score write and hook `api/cron/agent-evaluate.js:2325-2333`. |
| Gameplan pending | Pass instant and purported examined held set (`api/cron/agent-evaluate.js:5255-5258`); empty set at exit when the pass made no observation (`api/cron/agent-evaluate.js:2360-2363`). **BR-2 limits the first case.** | Score write and hook `api/cron/agent-evaluate.js:2364-2372`. |
| Gameplan created | Same pass rule; empty-set fallback at exit (`api/cron/agent-evaluate.js:2417-2420`). **BR-2 applies.** | Score write and hook `api/cron/agent-evaluate.js:2421-2428`. |
| Passive / CPU | Held only, exit clock (`api/cron/agent-evaluate.js:1284-1287`). | Score write and hook `api/cron/agent-evaluate.js:1288-1296`. |

The no-entry rows do not invent evaluation identity. Failed refresh, failed prompt build, degraded quotes, pre-admission and error exits do not acquire a qualifying flip; the entry classification and allowlist enforce that separation (`api/_utils/callRecords/observe.js:130-141`). A finite empty observation can expire calls but cannot satisfy a price condition. Capture is not required for these observations or their receipts.

### Publication ordering, identity and deadline re-checks

**VERIFIED; no new publication defect found.** The cron awaits the authoritative evaluation update before assigning `callsCtx.evalIdentity` and invoking publication, and records confirmed capture references before finalization (`api/cron/agent-evaluate.js:4383-4413`). The candidate is built once outside retry callbacks (`api/_utils/callRecords/publish.js:319-340`).

The transaction reads parent, declaration and call documents together. It checks active parent and the committed sequence floor **before** canonical idempotence/conflict handling. A queue read occurs only with new open calls; all reads precede the first create/set. Queue updates use finite minima and only the queue is merged (`api/_utils/callRecords/publish.js:147-187`). Thus declarations-only/all-invalidated publication does not invent a queue sentinel. The parent read participates in transaction conflict detection; it is not a separate preflight read followed by an unrelated batch. The sequence check is the spec's `>=` rule, not an extra claim that the transaction searches the full evaluation history for `evalId`.

The deadline is checked at attempt entry, before the additional queue read, and immediately before writes (`api/_utils/callRecords/publish.js:148`, `api/_utils/callRecords/publish.js:167`, `api/_utils/callRecords/publish.js:177`). Flips check before their read and before their write (`api/_utils/callRecords/flip.js:202-225`). Shared-budget admission protects 12 seconds and requires 4 seconds for the model phase or 2 seconds for the other hooks (`api/_utils/callRecords/publish.js:89-97`, `api/_utils/callRecords/flip.js:369-377`).

Timeouts permit only a bounded identical-publication re-read; no available re-read leaves the wire unchanged/unconfirmed, and confirmed IDs alone become capture references (`api/_utils/callRecords/publish.js:202-213`, `api/_utils/callRecords/publish.js:267-271`). **Do not strengthen this to a cancellation guarantee.** A commit already submitted before the deadline can finish afterward. A parent-terminal response can also precede an idempotence recognition because parent checking deliberately comes first. The build discloses both; document existence remains the reader's authority. No live Admin SDK contention or cancellation behavior was measured here.

### Cursor scan, index, rules and capture

**Cursor mechanics VERIFIED.** Query: state=open, mintedAt ascending, document name ascending, page size 50; start after the stored pair, tail then head bounded at the original cursor, then clear cursor on completion (`api/_utils/callRecords/flip.js:280-350`). Transactions are sequential and capped at 800 ms (`api/_utils/callRecords/flip.js:194-227`). Partial scans keep a continuation position and null total; completed scans report the scan's count, not a separately measured final population. Tests exercise more than 50 records, equal timestamps, retained-open prefixes and rotation. This prevents repeatedly favoring the same oldest prefix; it does not guarantee every call is visited in one budget. **BR-1 concerns judgment authority, not a missing cursor.**

**Index definition VERIFIED.** `firestore.indexes.json:580-595` contains the collection-scope `calls` composite for state/mintedAt/name ascending, matching the actual query. The static index test invokes the scan and checks the issued query (`api/_utils/callRecords/callRecordsRulesIndex.test.js:107-137`). First actual use validates availability operationally; a missing index is memoized for ten minutes (`api/_utils/callRecords/flip.js:275-306`). This is not proof that a hosted index is enabled. Follow the build's manual Console/index-drift checklist before shadow; no deployment was performed.

**Rules source VERIFIED.** Declaration/call/observation reads require authenticated parent ownership and all client writes are denied (`firestore.rules:463-476`). The top-level queue denies all clients (`firestore.rules:922-924`); the recursive default remains deny (`firestore.rules:1306-1308`). The new rules suites include owner read/list positive controls, non-owner/privileged/anonymous/missing-parent denials and all client write operations (`test/rules/callRecordsRulesSuite.mjs:113-145`). Admin SDK writers bypass client rules, so publication/flip transaction checks were independently inspected. This review ran the rules/index **source** suite, not the rules emulator; the builder's 298-test emulator result remains reported historical evidence, not a fresh validation claim.

**Composition VERIFIED within available rows.** Calls-off/pilot-off returns version 1 without calls; calls-on/pilot-off emits version 2 on both capture documents. Pilot and combined registration are unavailable and rejected explicitly, not relabeled version 1 or 2 (`api/_utils/tickCapture/captureConfig.js:54-75`). Current composition tests pass. No pilot implementation or live capture read is inferred.

## 4. Model-visible text checklist

| Requested criterion | Ruling at HEAD |
|---|---|
| Intent only | **Pass in principle.** Top-level recording disclaimer and “stated intent” semantics; amend recipient framing under BR-3 (`api/_utils/agentEvalToolSchema.js:235-245`, `api/_utils/agentEvalToolSchema.js:288`). |
| No promised follow-through | **Pass for execution promises.** No promise that a future evaluator receives/enforces the declaration. Add explicit no scheduling/no future-check input wording for clarity. |
| No address to a player who sees nothing | **Fail.** Silence, questions and choices assume a recipient/response surface absent in shadow; BR-3. |
| No overlap with anticipationCandidates | **Pass for responsibility/authority.** Existing anticipation is explicitly the spoken narration channel (`api/_utils/agentEvalToolSchema.js:157-180`); declarations say to fill it exactly as before, and watching does not replace it (`api/_utils/agentEvalToolSchema.js:236-239`, `api/_utils/agentEvalToolSchema.js:297-300`). Shared tickers are legitimate; imposing disjoint symbol sets would itself alter narration. No new duplication or diversion instruction is needed. |
| No forbidden signal name | **Pass.** The schema contains none of the forbidden `20-day` text; the source pin and threshold-copy suite pass (`api/_utils/agentEvalToolSchema.declarations.test.js:94`). |
| Nothing instructing the trade decision | **Pass for an explicit new decision rule.** It says the block never replaces the current decision; the existing trade validator captures the off schema. This is a source-text/validation conclusion, not proof that adding input/output tokens cannot influence model behavior (`api/_utils/agentEvalToolSchema.declarations.test.js:130-151`). |

The build honestly discloses output truncation headroom and estimates token costs (`docs/audits/20260924_BUILD0_CALL_RECORDS.md:229-239`). Character ratios and tests do not substitute for the pending real token measurement or shadow behavior observations. This review made no paid model/countTokens call and does not certify unchanged SWAP/HOLD rates at shadow.

## 5. Relationship to round 3 and the build's own review

| Prior concern / central claim | Current disposition |
|---|---|
| R3-1 quote shape and backdating | Detached `current` shape, per-seam times and fetch-time admission are implemented. BR-2 finds a narrower remaining examined-set error. |
| R3-2 exit/phase completeness | Eight hooks and entry/no-entry distinction implemented; gameplan wiring is present, with BR-2 membership defect. |
| R3-3 protected non-model tail | Shared clock, 2-second admission and protected tail implemented. |
| R3-4 whole-trade effect matching | Counterpart, direction, tier and concrete executor slot checks implemented (`api/_utils/callRecords/flip.js:134-149`); no effect is inferred from declaration text. |
| R3-5 zero-open queue | Empty branch implemented; only new open calls arm the queue. |
| R3-6 index/continuation | Committed index and cursor rotation implemented. E-3 later introduced the separate battle-clock problem in BR-1. |
| R3-7 capture composition | Available rows tested; unavailable pilot/combined rows explicitly gated. |
| R3-8 wire/receipt shapes | Two-value phase wire and companion receipt implemented; §12's added scan clock should be removed from judgment authority. |
| R3-9 inputs/pins/seams | Build inputs and raw-byte hashes verified; current seam map above replaces historical anchors. §12 creates the specific contract reconciliation task in BR-4. |

The build's §8 five-lens review and verifier record was read, including its test repairs and disclosed limits. Its claimed full-suite, mutation and emulator passes were not reclassified as newly executed results. The §12 commits had no fresh multi-lens review of their own; this review directly attacks them: **A-1 code objection refuted; A-1 document drift confirmed; E-3 battle-clock authority rejected.** Independent refutation also confirmed BR-2 and BR-3. Objections alleging a publication read-after-write, absent cursor/index, restored A-1 hash-only provenance, prohibited signal text, or an explicit new trade-decision instruction did not survive source/test inspection.

## 6. Validation, limits and delivery

| Review execution | Result |
|---|---|
| Candidate, flip, horizon, validator, mode suites | **5 files / 148 tests passed** in an isolated HEAD snapshot. Includes the current E-3 test that intentionally locks the disputed expiry. |
| Publication, observation and calls-on cron suites | **3 files / 138 tests passed** in a second isolated HEAD snapshot. |
| Off golden, declarations schema, threshold copy, rules/index source, flag, capture composition and intraday exclusions | **7 files / 87 tests passed** from a fresh committed-LF HEAD archive with UTC. Native portability failures are preserved in BR-5. |
| Aggregate existing focused HEAD tests | **15 files / 373 tests passed** under the stated environments. A passing existing test does not refute BR-1 or BR-2. |
| Independent pre-build fixture replay | **23/23 passed** at product baseline `20d207d7`, using the exact current off-test support and fixture, under UTC. |
| Additional gameplan defect probes | **3/3 assertions reproduced the defect** in a disposable snapshot test. Actual guardrail zero-price-read result independently repeated. |
| E-3 failure probe | Independent network-free store probe reproduced zero-read query failure → persisted clock → later hot expiry. |
| `vite build` | **Exit 0**, 3,922 modules, approximately 43.5 seconds in the isolated snapshot. Existing dependency-age, CSS parsing, import/chunk-size warnings were emitted; no UI source changed on this branch. |
| Not run / not assessed | Full suite, new mutation battery, lint gate, rules emulator, hosted index/query, production data, provider/model calls, deployment, flag flip, CI monitoring, merge. Builder historical results remain attributed to its report. |

Tests used the already installed local dependency runtime (Node 22.20.0; Vitest 4.0.17), not a fresh dependency installation. Sandbox ancestry restrictions required approved retries for the isolated test/build commands. The store double models optimistic conflicts and immediate retries; it does not establish production lock/backoff timing (`api/_utils/__fixtures__/callRecordsStore.js:15-23`). No test probes mutated the shared repository.

**Artifact checks:** 97 explicit citation occurrences checked for existing paths, valid ranges and nonblank endpoints; six consecutive BR findings and both committed input hashes checked; no failures. The branch's cumulative diff against its merge base touches none of the eleven files named in the calibration fence. Immediately before delivery, source HEAD remains `43b61987`, the requested review branch is selected, and the only working-tree addition is this report.

**Off merge disposition:** BR-1 and BR-2 cannot run with calls off; BR-3 descriptions are absent from the emitted off tool; BR-4 is an explicit, documented authority mismatch; BR-5 is a reproducibility issue with a verified committed-byte/UTC path; BR-6 limits the proof's breadth without demonstrating a regression. No additional off-merge blocker was found. An off merge does not clear any shadow gate, make a hosted index exist, or ratify a token/model-behavior claim.

The only repository artifact authorized and produced by this review is this report. A byte-identical external copy is retained under the review's temp artifact directory. Delivery is a one-file documentation commit and push on the requested review branch, followed by a stop; the final commit and remote-tip verification are reported with delivery.
