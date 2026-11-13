# Astra review — Practice Field T0 set

**Review date:** 12 Nov 2026, America/Chicago. **Disposition:** T0a MERGE; T0b MERGE; T0c DO NOT MERGE at the submitted heads. The only new blocker is the sibling-branch README conflict, under the brief's explicit criterion 6. After retaining both report rows in a local scratch resolution, the combined code passes the Linux Mandate tests and the additional probes below.

| PR / build | Verdict | Basis |
|---|---|---|
| T0a — #1046, sector-cap translation | **MERGE** | Translation and exit-only wiring verified; no criterion 1–5 defect found. Gate exits precede the new refusal: A:api/_utils/mandateGate.js:69–112. |
| T0b — draft, decision rationale, base T0a | **MERGE** | Bounded, attributed storage; existing claims preserved; no stored-reason reader found; both planted readers detected. B:api/_utils/mandateSchema.js:284–332; B:api/_utils/mandateExecution.js:370–405,502–505; tripwire evidence below. |
| T0c — draft, idle acquisition skip, base T0a | **DO NOT MERGE** | **T0-01**, blocks merge: its README report row conflicts with T0b's row in the required order. C:docs/README.md:122; B:docs/README.md:122; merge-conflict.diff:9–13. Its runtime changes passed the checks below. |

## Scope, source keys and method

VERIFIED means inspected source or a locally reproduced result at the specified head. All code conclusions below are VERIFIED within this review's scope; reported historical production facts are not treated as current evidence. The supplied brief's six blocking criteria govern severity. Exit-only and the transport-independent open-batch condition are accepted decisions.

The source keys used in every code citation resolve to these immutable heads:

| Key | Branch / tree | Full HEAD |
|---|---|---|
| O | Original local checkout; also T0a's original main base | c37baa0d1cad220d37a41dae312e3d212ff27d4c |
| M | origin/main, after the requested fetch | 92a80c89a5caa722f28b201c71a62d01a9f5add7 |
| A | origin/claude/practice-field-t0a-sector-cap | eb4d9b560ca3c93b233cd07f6249f79a7039613e |
| B | origin/claude/practice-field-t0b-decision-rationale | bc4d797e689b9fbdb71fd4f8a0bd41e011fab2d4 |
| C | origin/claude/practice-field-t0c-idle-skip | fd92739a5c083f87a413c60a56d459d622415253 |
| AB | Local scratch: fetched main + T0a + T0b | 801abd29183f83a7a6876b17a8c5973381d90150 |
| S | Local scratch: AB + T0c, README conflict resolved by retaining both rows | f14c7eb61e08d2678c4fe1f0f1a10be97502122c |

The requested fetch succeeded before substantive comparisons. A/B/C were inspected in separate detached worktrees and remain clean. Their later report heads, rather than only the brief's code-head abbreviations, are the review targets. The scratch merge started at fetched main, merged A, then B, then C. The working checkout's pre-existing edits were left alone. No push, PR mutation, deployment, Firestore service call, model call, or EODHD call was made. Tests used in-memory stores and mocked service seams. Evidence: review-evidence.json:2–33; the supplemental mocks at astraT0Differential.test.js:4–40,70–80.

The review read the three build reports and the relevant V6.1 contract, then checked production diffs, all decision writers, entry/exit paths, source-reader boundaries, idle acquisition and merge interactions. Relevant contract anchors: A:docs/design/20261112_PRACTICE_FIELD_CONCEPT_V6_1.md:235–237,270–279. The reviewed build reports are A:docs/audits/20261112_BUILD_T0A_SECTOR_CAP_TRANSLATION.md:45–78; B:docs/audits/20261112_BUILD_T0B_DECISION_RATIONALE.md:44–70; C:docs/audits/20261112_BUILD_T0C_IDLE_DATA_SKIP.md:66–103.

## T0-01 — Resolve the sibling README conflict before merging T0c

**PR:** T0c draft, claude/practice-field-t0c-idle-skip. **Severity:** **blocks merge**. **Criterion:** 6, the three branches must combine cleanly in the stated order.

**Evidence.** T0b inserts its build-report row at B:docs/README.md:122. T0c independently inserts its different row at C:docs/README.md:122, both immediately after T0a's report row. The actual scratch merge auto-merged both shared JavaScript files but stopped with a content conflict in docs/README.md. The preserved conflict is merge-conflict.diff:9–13. A separate, read-only three-way merge using A as the common base reproduces the same sibling conflict, independent of main's intervening change: sibling-merge-tree.txt:587–598.

**Impact.** These submitted branch heads do not combine cleanly. This is a mechanical integration blocker, not evidence of a runtime defect.

**Concrete fix.** After T0a and T0b land, update T0c onto that base and resolve docs/README.md by retaining **both** the T0b and T0c report rows, in that order, immediately after T0a. Keep the auto-merged JavaScript changes from both builds. Run the Linux command below on that resulting head. The local demonstration resolution is S:docs/README.md:121–123.

**Refutation attempted.** The production files merge without conflict, and the only conflicting content is documentation. That narrows the fix but does not remove the blocker: criterion 6 explicitly requires a clean combination. The sibling-only merge reproduced it, so the newly fetched main head is not the cause.

## T0a verification

| Check | Result and evidence |
|---|---|
| Translate at the frozen-config boundary | **VERIFIED.** The builder calls translateSectorCapSlots once and stores source slots, denominator, translated fraction and version. Integers 1–6 map to n/6; null remains null; malformed counts throw. A:api/_utils/mandateVintage.js:86–107; A:api/_utils/mandateSectorCap.js:38–75. The all-six-archetype and boundary tests passed: A:api/_utils/mandateSectorCapUnits.test.js:47–120,147–179. |
| Cap actually binds | **VERIFIED.** Missing or non-fraction caps fail closed; the check uses current marked sector exposure plus executable spend over total book value, with the existing floating-point tolerance. A:api/_utils/mandateGate.js:129–146; A:api/_utils/mandateSectorCap.js:129–155. The tests include exact-limit, one-cent-over and unequal-holding cases: A:api/_utils/mandateSectorCapUnits.test.js:147–252. |
| Frozen vintages remain immutable | **VERIFIED.** Publication reads the content-addressed document and leaves an existing document alone. A:api/_utils/mandateVintage.js:167–185. Corrected payloads obtain new hashes, exercised at A:api/_utils/mandateSectorCapUnits.test.js:82–90. |
| Admission rejects unstamped vintages | **VERIFIED.** Creation reads the published vintage back before the book/claim transaction; escape checks the replacement vintage; rollover throws the typed failure before its transaction. A:api/_utils/mandateCreationService.js:58–67; A:api/_utils/mandateEscape.js:81–86; A:api/_utils/mandateRollover.js:126–140. |
| SELL/TRIM remain available | **VERIFIED.** HOLD returns first; held-name SELL/TRIM return through the exit lane before quarantine, vintage refusal, CA entry freeze and sector checks. Stale marks do not make the gate refuse a held exit. A:api/_utils/mandateGate.js:69–119. Existing executor validation still applies; the conclusion is that T0a adds no exit barrier. |
| Direct evaluation and failure counts | **VERIFIED.** The sweep logs an unstamped vintage and continues; runBookEval passes the new flag to the gate. A gated entry follows the terminal-success bookkeeping rather than the infrastructure-failure branch. A:api/cron/mandate-evaluate.js:204–213,421–429; S:api/cron/mandate-evaluate.js:483–492,584–615. The real sweep test asserts an unstamped SELL executes without a failure: A:api/cron/mandateIntegrationHarness.test.js:247–281. |
| Quarantined unstamped book | **VERIFIED.** The tool uses effectiveVerbs with quarantined=true, restricting it to SELL/TRIM/HOLD; exits still execute. A:api/cron/mandate-evaluate.js:149–162; A:api/cron/mandate-evaluate.test.js:316–328. The additional direct TRIM scenario and both quarantined batch exits also passed: astraT0Differential.test.js:86–134,137–157. |
| Batch entry/exit path | **VERIFIED.** Harvest derives vintageUncorrected from the pinned vintage, gates the normalized answer, then uses the existing executor and billing sequence. A:api/_utils/mandateBatchTransport.js:348–393; S:api/_utils/mandateBatchTransport.js:403–445. Additional unstamped BUY/ADD were gated; SELL/TRIM executed, with and without quarantine; replay preserved the entire store. astraT0Differential.test.js:137–157; combined-differential.log:7–10. |
| Prompt and fence | **VERIFIED.** Fractions print as percentages; malformed caps print unavailable, with entries refused. A:api/_utils/mandatePromptAssembly.js:58–66,94. The fenced archetype table's six counts remain 3,3,2,3,4,2. A:api/_utils/agentArchetypeConfig.js:66,95,122,151,182,214. All fenced blobs are unchanged, as detailed below. |

No new T0a blocker was found. The translated policy is a share of book value, as agreed, rather than a claim of equivalence for unequal position sizes. A:api/_utils/mandateSectorCap.js:19–29.

## T0b verification

**Record provenance and bounds — VERIFIED.** The direct path keeps the normalized tool input's reason and diagnostic conviction; it stamps the injected clock after the model response and passes attribution into execution. Batch extraction reads the decision tool input once, before the lease, and retains it for book_missing, no_vintage and bad_decision as well as execution outcomes. Free prose outside the decision tool is not substituted as a reason. Evidence: B:api/cron/mandate-evaluate.js:198–228; B:api/_utils/mandateDecisionTool.js:114–117; B:api/_utils/mandateModelCall.js:127–138; B:api/_utils/mandateBatchTransport.js:315–415.

The early extraction and attribution steps perform no database or provider I/O. Lease acquisition, fresh book read, terminal selection, billing under the lease, health bookkeeping and release retain their order. The vintage is still selected using the submission envelope's pinned reference. Evidence: B:api/_utils/mandateBatchTransport.js:315–423,669–681; B:api/_utils/mandateRationale.js:158–175.

The builder itself caps reason at **1,200 UTF-16 units**, ticker at **32**, and failure condition at **200**. Non-string/blank reasons become absent; long reasons become truncated. Outer whitespace is trimmed and malformed UTF-16 is repaired on the tested Node 20 runtime. Conviction is a finite, rounded/clamped 0–100 diagnostic or null. Evidence: B:api/_utils/mandateConfig.js:68–75; B:api/_utils/mandateSchema.js:284–332; B:api/_utils/mandateRationale.js:88–148. The pathological first-grapheme fallback is explicitly a code-point cut, so “never splits any grapheme” would overstate the implementation; it preserves the bound and surrogate pairs. B:api/_utils/mandateRationale.js:77–103.

**Exactly-once behavior — VERIFIED as unchanged, not universally repaired.**

- executeDecision still reads the decision claim inside its transaction and returns the existing record without overwriting/backfilling it. disposeSubmission does the same, retaining its existing stale-gate healing behavior. B:api/_utils/mandateExecution.js:370–405,502–505.
- Close-pass expiry still checks the existing decision; corporate forced exits still use the corporate-action claim. That file is byte-identical to fetched main. S:api/_utils/mandateClosePass.js:195–203,249–252,275–290; review-evidence.json:126–129.
- Rollover and escape cancellation writers retain their pre-existing lack of a decision-document existence read; these were expressly routed to backlog by the brief. T0b does not alter those writers or their claim protocol. B:api/_utils/mandateRollover.js:211–230; B:api/_utils/mandateEscape.js:163–176.
- Replay, crash-window and lifecycle interleaving tests passed, including no backfill onto an already-claimed record. B:api/_utils/mandateRationale.test.js:313–324; B:api/cron/mandateBatchInterleavings.test.js:197–230,315–350; combined-vitest.log:259–262. The six additional batch replay probes compare full stores including versions. astraT0Differential.test.js:137–157.

**No stored-reason reader — VERIFIED within the inspected source graph.** No current prompt, memory, consolidation or display reader was found. The production store mentions remain the four decision-writing modules plus the unrelated shadow-log stream; the direct wrapper drops the executor's record, and the batch loop consumes status/billing rather than forwarding the reason. The prompt registry, T0b's prompt/tool inputs and existing canary checks support the same conclusion. Evidence: B:api/_utils/mandateRationale.imports.test.js:82–118,143–212,230–265; S:api/cron/mandate-evaluate.js:264–272; S:api/_utils/mandateBatchTransport.js:699–741; B:api/cron/mandate-evaluate.test.js:443–470; B:api/_utils/mandateBatchTransport.test.js:793–805; review-evidence.json:116–124,139.

I planted two new readers in a separate scratch tree:

| Plant | Result |
|---|---|
| New api/_utils/astraStoredReasonPrompt.js, reading the literal decisions collection and joining stored rationale into prompt text | **Caught:** prompt-graph store check and repo-wide store-count check both failed. tripwire-new-prompt.log:19–41,66–67. |
| New reader appended inside the already-sanctioned mandateExecution.js writer | **Caught:** its decisions-store count moved from 2 to 3. tripwire-existing-writer.log:19–29,45–46. |

The baseline and restored tripwire both passed **10/10**. tripwire-baseline.log:7–10; tripwire-restored.log:7–10. This is a useful regression guard, not a general information-flow proof: runtime-built store names, dynamic imports, scripts and ordinary rationale accesses have documented limits. B:api/_utils/mandateRationale.imports.test.js:29–49. No actual reader exploiting those limits was found.

## T0c and combined behavior

| Check | Result and evidence |
|---|---|
| Both conditions govern each idle fire | **VERIFIED.** Before new acquisition, the existing active-book query runs; any active book immediately disqualifies the skip. Only an empty result triggers the bounded status=open batch query. Since idle skips create no snapshot latch, subsequent idle fires repeat the decision. A pre-existing snapshot continues through the old reuse path. C:api/cron/mandate-evaluate.js:89–100,326–342,728–760; C:api/_utils/mandateBatchTransport.js:114–128. |
| Failed duty read | **VERIFIED.** Exceptions return skip:false, so acquisition proceeds. C:api/cron/mandate-evaluate.js:93–98. The injected-read-failure test passed and checks the successful whole fire, actual acquisition and stored snapshot: C:api/cron/mandateIntegrationHarness.test.js:553–566. |
| Open batch / pending finalization | **VERIFIED.** Any open document blocks the skip regardless of transport or aged-out status. Harvest and drain use the same selector. C:api/_utils/mandateBatchTransport.js:114–128,519–522,783–786. Finalization requires disposition and billing coverage, subject to the existing give-up horizon: S:api/_utils/mandateBatchTransport.js:744–756. |
| No placeholder or acquisition write | **VERIFIED.** Eval returns before either builder. Close bypasses both builders and proceeds with null closeSnapshot. The skip itself writes no document; retained cleanup may still delete old eligible documents, as required. C:api/cron/mandate-evaluate.js:330–342,732–760; S:api/_utils/mandateClosePass.js:599–645. Whole-store equality and zero-client-call rows passed: C:api/cron/mandateIntegrationHarness.test.js:458–476,569–585. |
| Close race | **VERIFIED.** A book appearing after the empty active query encounters the null-snapshot guard before lease acquisition. deferred prevents completion/retention on that fire. C:api/cron/mandate-evaluate.js:787–798,848–852. The test checks identical book data, version 1, no close or retention, then a normal next fire: C:api/cron/mandateIntegrationHarness.test.js:602–632. |
| First subsequent book/batch | **VERIFIED.** Recheck tests prove a new book starts on the next fire and a new open batch causes acquisition followed by polling. C:api/cron/mandateIntegrationHarness.test.js:529–550,635–656. |
| Shared-file integration | **VERIFIED.** The combined evaluator retains both T0b's response clock/attribution and T0c's idle check. The combined harvest retains reason attribution, vintage gating and the open-batch selector. S:api/cron/mandate-evaluate.js:90–100,130–132,239–266,333–348; S:api/_utils/mandateBatchTransport.js:115–129,337–347,403–437,548–551,699–701. |

**Non-skip differential — VERIFIED for the exercised scenarios.** I ran the same new 24-test probe on AB and S, with clocks and lease tokens fixed and external clients mocked. Seventeen non-skip scenarios produced byte-identical serialized stores (including versions), responses, logs and client-call traces. They cover direct BUY/SELL/TRIM/HOLD, unstamped BUY/ADD/SELL/TRIM, quarantined unstamped TRIM, open-batch/no-book eval and close, batch submit/poll/harvest, a real holding-book close, an existing snapshot and a quote-outage harvest-only fire. The idle control differed as expected. The other six tests exercise batch exit/refusal/replay combinations.

Evidence: astraT0Differential.test.js:4–40,86–157; pre-t0c-differential.log:7–10; combined-differential.log:7–10; differential-summary.json:2–113. The 17 serialized non-skip observations total **1,553,503 bytes**, SHA-256 **305c0bf75e37e1e66fa43bb840518656636bfa10ccceeeba8d4a81dbb42d1aef**. This corroborates parity for those scenarios; it is not an exhaustive proof over arbitrary schedules or corrupt stores.

**Flags and fence — VERIFIED.** The 11 BUILD_RULES §1 fenced files have identical Git blob IDs on M, A, B, C and S. Flag source after removal of comments, every “Pinned by” line, both flag-test files, the import-boundary baseline, rules and indexes are unchanged. The four T0c docstrings agree with the inspected handler/endpoint guards. Evidence: M:docs/BUILD_RULES.md:9–24; review-evidence.json:35–138; C:src/config/featureFlags.js:1923–1984; S:api/cron/mandate-evaluate.js:284–309; S:api/mandate/create.js:63; S:api/mandate/accelerate.js:32; S:api/mandate/drain.js:44; S:api/mandate/escape.js:41.

## Carry-forward backlog — already routed, not new merge findings

These do not change the verdicts and are not requests to reopen the decisions in the brief.

| Existing item | Suggested / already assigned home and concrete instruction | Evidence at reviewed head |
|---|---|---|
| Missing/malformed direct answers have no decision record | **T1a check ledger:** record attempted checks separately without inventing a model reason. | B:api/cron/mandate-evaluate.js:206–209. |
| Token-limit answers and empty prompt-template version | **T1b:** define the cutoff refusal and stamp the actual prompt version; keep the seat fingerprint as agreed. | B:api/_utils/mandateModelCall.js:127–138; B:api/cron/mandate-evaluate.js:178; B:api/_utils/mandateRationale.js:158–161. |
| Reason-field index exemption | **T1a index deploy:** add the planned exemption with deployment verification. No index change is part of this set. | B:docs/audits/20261112_BUILD_T0B_DECISION_RATIONALE.md:143; review-evidence.json:111–114. |
| Rules/vintage read error treated as missing | **Batch transport reliability:** distinguish transient read failure from genuine absence and retry without terminalizing paid answers. | S:api/_utils/mandateBatchTransport.js:691–697,373–380. |
| Rollover/escape can overwrite a pre-existing decision in a restored stale-gate state | **Mandate lifecycle recovery / T1a:** read the decision in the same transaction and preserve an existing terminal. | B:api/_utils/mandateRollover.js:220–230; B:api/_utils/mandateEscape.js:163–176. |
| Windows import-walker / native import failures | **Test infrastructure:** normalize closure paths and convert filesystem paths to file URLs for native import. Linux is the validation environment here. | B:api/_utils/__fixtures__/mandateEvalPathClosure.js:28–34,47–54; B:api/_utils/mandateNativeEsm.smoke.test.js:42–51. |
| Thinking-block compatibility and permissive batch time parser | **T1b model-seat/response contract:** validate supported response blocks and timestamps before a seat/provider change. | B:api/_utils/mandateModelCall.js:127–138; S:api/_utils/mandateBatchTransport.js:517–522. |
| Tripwire's documented blind spots | **Future reader build / honesty guard:** add graph/reader coverage when introducing any reader or a dynamic access path; do not merely re-pin counts. | B:api/_utils/mandateRationale.imports.test.js:29–49,248–265. |
| Remaining stale dark-state prose | **Mandate documentation upkeep:** reconcile the section banner and evaluator header with actual flag state. | C:src/config/featureFlags.js:1913–1916; C:api/cron/mandate-evaluate.js:3–8. |

## Validation and limits

The combined suite ran on **WSL Ubuntu, Linux, Node v20.20.2, TZ=UTC**, using the existing dependency installation whose LF-normalized lockfile SHA-256 matches **40382e64edb6196ff26fdb8af8aa873303076fc1f1d0905402e9810f66d36e3f**. No package downloads were needed. The tested production tree is S; supplemental tests and planted readers lived in Linux scratch copies.

| Run | Result | Evidence |
|---|---|---|
| Combined Mandate files, fake-store support, Mandate flag pins and general flag guard | **42 files, 692 tests passed; 0 failed/skipped; exit 0** | combined-vitest.log:259–262; review-evidence.json:140–146 |
| Additional differential/exit/replay probe, AB and S separately | **24/24 on each; exit 0** | pre-t0c-differential.log:7–10; combined-differential.log:7–10 |
| Tripwire baseline, two planted readers, restoration | Baseline/restored **10/10**; both plants rejected for the intended source checks | tripwire-baseline.log:7–10; tripwire-new-prompt.log:19–67; tripwire-existing-writer.log:19–46; tripwire-restored.log:7–10 |
| Production build, S | **exit 0**, 15.48 s; existing size/dynamic-import warnings | combined-build.log:127–139 |

This review did not rerun the full repository suite or an emulator/rules suite. It does not establish deployed flags, production inventory, provider entitlement, live Firestore behavior or actual data savings. Historical production counts and full-suite results in the build reports remain those reports' evidence, not fresh observations here.

## Final head ledger, combination, command and report path

All branch/tree heads read or constructed for this review:

| Branch / tree | HEAD |
|---|---|
| Original local branch: codex/pullback-shallow-retrace-saved-replay-002-20261112-181640 | c37baa0d1cad220d37a41dae312e3d212ff27d4c |
| origin/main, fetched | 92a80c89a5caa722f28b201c71a62d01a9f5add7 |
| origin/claude/practice-field-t0a-sector-cap | eb4d9b560ca3c93b233cd07f6249f79a7039613e |
| origin/claude/practice-field-t0b-decision-rationale | bc4d797e689b9fbdb71fd4f8a0bd41e011fab2d4 |
| origin/claude/practice-field-t0c-idle-skip | fd92739a5c083f87a413c60a56d459d622415253 |
| Detached local scratch: main + T0a | 88f0fb1d4ad4bb62c31fc6745a0204f2a5ee558b |
| Detached local scratch: main + T0a + T0b | 801abd29183f83a7a6876b17a8c5973381d90150 |
| Detached local scratch: all three, README-only resolution | f14c7eb61e08d2678c4fe1f0f1a10be97502122c |

The brief's code heads 9506e3c4, c76acd5d and c199a336 were reference points in the brief/reports, not additional checked-out review targets. Full inspected-head records and clean detached-worktree status: review-evidence.json:2–33. Final scratch tree: **83267291c7fba0162f47d9bdc41a58eede52b36b** (review-evidence.json:12).

**Did the scratch merge combine cleanly? No.** T0a and T0b merged cleanly; T0c required the single README resolution described in T0-01. After that local-only resolution, the combined production code passed the following Linux command:

~~~bash
TZ=UTC node node_modules/vitest/vitest.mjs run \
  api/_utils/mandate api/_utils/__testsupport__/mandate \
  api/cron/mandate api/mandate \
  src/config/mandateFlags.test.js src/config/flagPinGuard.test.js \
  --maxWorkers=4 --reporter=default --reporter=json \
  --outputFile.json=/mnt/c/Users/fashr/.codex/visualizations/2026/11/13/01a1d326-648e-7e10-b06f-49f68109e261/combined-vitest.json
~~~

**Result:** exit 0; **42 files / 692 tests passed**. Build command: **node node_modules/vite/bin/vite.js build**, exit 0. No branch was pushed or merged remotely.

**Report:** C:/Users/fashr/.codex/visualizations/2026/11/13/01a1d326-648e-7e10-b06f-49f68109e261/20261112_ASTRA_REVIEW_T0_SET.md

