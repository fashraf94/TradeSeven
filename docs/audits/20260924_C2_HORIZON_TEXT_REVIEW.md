# C2 horizon text confirmation — PR #908 as merged

**Date: 2026-09-24 (America/Chicago). Verdict: BLESS all three requested items.** The contract now distinguishes an unknown transaction outcome from a transaction that did not commit. Amendment A carries the correct committed-byte hash and final C2 input-size figures. The exact model-visible horizon descriptions satisfy C2 while preserving BR-3's stored-only limits. This is a docs/text sign-off, not authorization to enable shadow.

| Requested item | Verdict | Result |
|---|---|---|
| 1. V1.4 C1 and §6 edits; committed-blob SHA-256 | **BLESS** | Both edits match the prior fixes; the commit/concurrency distinction and pre-slot hits remain explicit. Hash: `0b7d1d2a00a087902bc5fb3f73c5fad5ee8af3e275ab2abbebed77fff80b2667`. |
| 2. Amendment A hash, measurement and source rows | **BLESS** | Exact V1.4 hash; additional input schema **+4,627 chars**; **10,250** identified as a chars/4 fixture estimate; historical branch review located by commit and branch. |
| 3. Exact `calledShots` / `horizonPhrase` descriptions against C2 and BR-3 | **BLESS** | Judgment boundary, later first reach, own observation and pre-slot hits are stated. No execution promise, waiting instruction or player-response request is introduced; stored-only clauses are intact. |

**Required amendments within this scope: none.**

## Baseline and scope

- **VERIFIED:** repository `C:\Users\fashr\.codex\worktrees\eaca\portfolio-duel`; initial detached HEAD and fetched `origin/main` both **`5b09de57343f7a8bc10d079466e597ea996ca33c`**, the merge of PR #908. The initial working tree was clean.
- `git fetch origin` completed before remote comparisons. The first sandbox attempt could not write the linked worktree's external `FETCH_HEAD`; the authorized retry succeeded.
- Created **`docs/review-c2-horizon-text`** here from fetched `origin/main`, as requested. All source citations below refer to that merge baseline, not this report's eventual commit.
- Compared PR #908 against its first parent, **`9b3d05ead02465af66d935afa60060f97288fda6`**. Re-read the prior C1/C2/C3 fixes in `docs/audits/20260924_CONTRACT_V1_4_REVIEW.md:57-100`; its committed bytes match review commit `c8fa1b0bd393e3c16dac7ead291a036f94213980`.
- Recovered the original BR-3 criteria from **historical commit `3f6001611163f8487f65bdd8ec6b355b6f519d1c`**, `docs/audits/20260924_BUILD0_CALL_RECORDS_REVIEW.md:77-84`. Its SHA-256 reproduces `944c70d99a28c16e5c9d37d68e9cc6c431ad29f4f648ec743d175b3164a960aa`.
- **VERIFIED** means inspected committed source or the explicitly described local byte/serialization calculation. No test suite, mutation battery, build, model/provider call, database operation, deployment or shadow execution was run. Historical test results in the build report are not certified as current runs.
- Only this report is authorized to change in the repository. The contract, amendment, schema, tests and flags remain untouched.

## 1. Contract C1 and §6 — BLESS

**C1 matches the requested correction in meaning, with explanatory examples added.** The prior fix says an unconfirmed attempt has an unknown outcome and may commit late; a later transaction may judge from its own observation only if its fresh read still finds the call open (`docs/audits/20260924_CONTRACT_V1_4_REVIEW.md:63`). The merged §5 states exactly those conditions and restricts the failed/skipped/deadline-cut examples to an attempt that does not commit (`docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md:75`). An apparent timeout therefore is not documentary permission to judge a terminal call again.

**§6 matches the requested precedence clarification.** The prior instruction was to qualify the retained horizon/expiry wording by §5 and explicitly preserve eligible pre-slot hits (`docs/audits/20260924_CONTRACT_V1_4_REVIEW.md:65`). The merged paragraph says expiry is “subject to the `next_check` judgment rule in §5 (H2)” and “Eligible pre-slot hits are unchanged for every basis, `next_check` included” (`docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md:86`). The preceding opening rule independently gives `next_check` precedence (`docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md:84`).

**Retained boundaries — VERIFIED:** §5 still requires the judgment transaction to commit, uses the reaching check's own observation, and explicitly guarantees one committed judgment rather than the earliest observation winning (`docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md:75`). The future sweep obligation remains: no mechanical expiry of a `next_check` call at its slot without a separately agreed unobserved-expiry policy (`docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md:118`). The PR's contract diff changes only the header, §5 paragraph and §6 paragraph; no field shape changes.

### Committed-byte fingerprint

Computed SHA-256 with Node `createHash('sha256')` over the raw `Buffer` returned by `execFileSync('git', ['show', '<baseline>:docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md'])`. No checkout newline conversion, PowerShell text pipeline or Git object header participates.

| Quantity | Verified value |
|---|---|
| Committed content length | **22,020 bytes** |
| Git blob object ID | `7815a1eda1cffe5c125e50284d0507a7a66ccb41` |
| Content SHA-256 | **`0b7d1d2a00a087902bc5fb3f73c5fad5ee8af3e275ab2abbebed77fff80b2667`** |

## 2. Amendment A — BLESS

| Check | Verified result |
|---|---|
| Contract reference and hash | The full path and all 64 hash characters match the committed content above; the earlier V1.3 pins remain labeled historical inputs (`docs/design/COCKPIT_SPEC_V1_3_AMENDMENT_A.md:3`). This closes the Amendment A portion of C3. |
| Source header | The “on main after PR #903” claim is limited to the rulings/build report and fixes. The separate branch review is correctly cited at `3f6001611163f8487f65bdd8ec6b355b6f519d1c` on `docs/review-build0-call-records`, with its matching abbreviated hash; the docs review is located on `docs/review-contract-v1-4` (`docs/design/COCKPIT_SPEC_V1_3_AMENDMENT_A.md:4`). The source-header fix requested at `docs/audits/20260924_CONTRACT_V1_4_REVIEW.md:100` is satisfied. |
| Measurement row | Describes **additional input schema**, not the schema's total size or output truncation. Uses final C2 **+4,627 serialized chars**, about **1,157 tokens at chars/4**, and **10,250** against 12,000 explicitly as a **fixture estimate**. Real token counts and shadow truncation observations remain pending; input size does not establish output headroom (`docs/design/COCKPIT_SPEC_V1_3_AMENDMENT_A.md:15`). |
| C2 source/status | Names the separate implementation commit `d188a2d9` and correctly leaves exact-text confirmation pending (`docs/design/COCKPIT_SPEC_V1_3_AMENDMENT_A.md:13`). Section 3 of this report supplies that confirmation. |

**Measured locally, from committed schema bytes:** serializing the dependency-free schema exports gives an off tool of **8,537 chars**, an on tool of **13,164 chars**, and a contribution of **4,627 chars**. `ceil(4627 / 4) = 1,157`; `ceil(4627 / 3) = 1,543`. These reproduce the updated input-size pins (`api/_utils/agentEvalToolSchema.declarations.test.js:246-253`); the tests themselves were inspected, not run.

**Historical fixture estimate, source-confirmed rather than remeasured:** Amendment A's 10,250 matches build report §14.4 (`docs/audits/20260924_BUILD0_CALL_RECORDS.md:924-937`). The fixture uses `Math.ceil(String(s).length / 4)` and sums the request components; it asserts a 12,000 input budget (`api/_utils/composition.m7e2eBudget.test.js:49`, `api/_utils/composition.m7e2eBudget.test.js:62`, `api/_utils/composition.m7e2eBudget.test.js:200-205`). No tokenizer or full fixture execution occurred in this review.

The older **+4,154 / 10,132** figures describe BR-3 before C2 (`docs/audits/20260924_BUILD0_CALL_RECORDS.md:698-701`). Amendment A's final update in commit `856fd8ae106ef8c2c30e308aa8232fdfe5533160` carries the later C2 figures. Thus the earlier build-report statement that Amendment A still needs those figures (`docs/audits/20260924_BUILD0_CALL_RECORDS.md:976`) is historical and is closed by the actual merged amendment.

Final Amendment A content pin: **5,223 bytes**, SHA-256 **`01a697e5e8cb925a7d07fbb6d848267e81cfb5feb0b6e5372b4d35f82b9da3f5`**. This differs from the explicitly earlier commit-2 pin in the build report (`docs/audits/20260924_BUILD0_CALL_RECORDS.md:849`) because the final amendment was updated after C2.

## 3. Exact model-visible descriptions — BLESS against C2 and BR-3

The following are the actual concatenated description values read from the committed module, not its explanatory comments or proposed future text.

**`calledShots` — BLESS** (`api/_utils/agentEvalToolSchema.js:249-251`):

> At most 6. Each records one conditional trade you are calling: SYMBOL trading above or below LEVEL before the horizon ends (for next_check, as horizonPhrase describes). Declare only calls you actually hold.

**`horizonPhrase` — BLESS** (`api/_utils/agentEvalToolSchema.js:285-290`):

> How long the call stands: until its next_check judgment, the end of this session, the end of this battle, or an explicit expiry. next_check uses the next eligible evaluator slot as a judgment boundary: the call records a condition and does not schedule a trade at that slot. Before the slot it can be hit as under any horizon. At or after the slot, the first check to reach the stored call judges it once, from that check's own observation: hit if the condition is met, otherwise expired. That first reach may be a later check than the slot's own.

| C2 / BR-3 criterion | Verdict and evidence |
|---|---|
| `next_check` exception to “before the horizon ends” | **BLESS.** `calledShots` now explicitly defers to `horizonPhrase`; that description says the call stands until its judgment (`api/_utils/agentEvalToolSchema.js:250-251`, `api/_utils/agentEvalToolSchema.js:286`). |
| Eligible slot is the judgment boundary | **BLESS.** Stated directly, with an explicit denial that the condition schedules a trade at that slot (`api/_utils/agentEvalToolSchema.js:287-288`). |
| Pre-slot hits remain valid | **BLESS.** “Before the slot it can be hit as under any horizon” (`api/_utils/agentEvalToolSchema.js:288`). |
| Later first reach uses that check's observation | **BLESS.** At/after-slot hit-or-expired judgment uses the reaching check's own observation and may occur on a later check (`api/_utils/agentEvalToolSchema.js:289-290`). |
| Stored-only recipient and authority limits | **BLESS.** The block remains stored only, not shown to the player, requests no response, executes/schedules no trade, is not supplied to a later check, and changes neither this check's decision nor `anticipationCandidates` (`api/_utils/agentEvalToolSchema.js:242-245`). |
| No execution, waiting or player-response instruction | **BLESS.** The new descriptions only explain a stored condition's judgment. `defaultAction` remains intention without execution authority; both `said` fields remain conditional and stored only; `playerAsk` expects no answer and `fork` requests no selection (`api/_utils/agentEvalToolSchema.js:299-303`, `api/_utils/agentEvalToolSchema.js:315`, `api/_utils/agentEvalToolSchema.js:325`, `api/_utils/agentEvalToolSchema.js:342`). No instruction to wait, withhold/suppress a trade, repeat narration or seek permission is introduced. |

The later check reaches **the stored call**; this does not say its model is supplied the declaration. The retained block explicitly denies that supply. “Expired” is explanatory prose, not a new state enum. The detailed transaction/concurrency rule remains the contract's §5: one committed judgment, no guarantee that the earliest observation wins (`docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md:75`). The model-facing description need not restate the transaction protocol to satisfy the bounded C2 correction (`docs/audits/20260924_CONTRACT_V1_4_REVIEW.md:71-73`).

**Structural comparison — VERIFIED:** recursively compared serialized on-tool exports before PR #908 and at the merge. Exactly two leaves differ: `input_schema.properties.declarations.properties.calledShots.description` and `input_schema.properties.declarations.properties.calledShots.items.properties.horizonPhrase.description`. All other 22 description values, including every stored-only clause, are identical. Removing only `description` keys yields identical structures: no field, type, enum or required list changed. Serialized off-tool exports are identical. The declarations property remains attached to the on-tool and selected by the existing builder (`api/_utils/agentEvalToolSchema.js:355-375`).

| Exact-text pin | Verified value |
|---|---|
| Committed `api/_utils/agentEvalToolSchema.js` SHA-256 | `4941a78531489388a423ac6cbaeadad5e1823ff8b6a2dfc59fb722c34e053438` |
| UTF-8 `JSON.stringify(DECLARATIONS_PROPERTY)` | **4,611 chars**, SHA-256 **`44b70a2c568d2b608218ab56082c797ba1af6301cf4fa374b1ea8674ec3758c0`** |

This supplies the exact C2 text confirmation pending in the build report (`docs/audits/20260924_BUILD0_CALL_RECORDS.md:970-973`) and preserves the prior BR-3 sign-off. It approves the text at these fingerprints, not future model behavior.

## Delivery and remaining scope

**Report validation — VERIFIED:** all 41 cited path/line occurrences resolve at their stated current or historical commit; both quoted descriptions match the module's concatenated values exactly. Before staging, the only working-tree addition is this report, the tracked source diff is empty, and `git diff --check` passes. Final commit/remote-tip/clean-tree confirmation accompanies delivery.

Only `docs/audits/20260924_C2_HORIZON_TEXT_REVIEW.md` is included in this delivery. A byte-identical external copy is provided under the session's visualization directory to satisfy BUILD_RULES §3's report-artifact convention (`docs/BUILD_RULES.md:62`). Delivery is one report commit and push on the requested branch, then stop; no PR creation, merge, CI monitoring or flag change is part of this task.

The existing real `countTokens`, deployment prerequisites and external pilot-handoff pin remain outside this confirmation (`docs/audits/20260924_BUILD0_CALL_RECORDS.md:974-977`). The source flag remains **`CALL_RECORDS_MODE = 'off'`** (`src/config/featureFlags.js:2806`). These three BLESS verdicts close the requested docs/text checks only.
