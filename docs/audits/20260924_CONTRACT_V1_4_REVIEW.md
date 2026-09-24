# Contract V1.4, Cockpit Amendment A, and Build 0 model-visible text review

**Date: 2026-09-24. Verdict: AMEND the handoff; BLESS the exact merged text against BR-3.** H1 correctly records the founder's origin ruling. H2 preserves the per-call judgment, sweep obligation, and concurrency distinction, but incorrectly treats an unconfirmed transaction as proof that nothing committed. The model's stored-only descriptions now satisfy BR-3; the separate BR-1 horizon wording remains unfinished. This review does not authorize a shadow flip.

| Requested item | Verdict | One-line fix / disposition |
|---|---|---|
| 1. Contract V1.4 versus V1.3: H1, H2, BR-4 | **AMEND** — H1 and wire shape **BLESS** | Distinguish unconfirmed from uncommitted in H2, explicitly scope the generic expiry prose to the H2 exception, finish the model's horizon wording, and carry the new committed-byte pin in the consumer handoff. |
| 2. Cockpit Spec V1.3 Amendment A versus build report §13 | **AMEND** — seven substantive rows **BLESS**, measurement row **AMEND** | Describe +4,154 chars as additional input schema and 10,132 tokens as a fixture estimate; correct the review's location and supply the V1.4 contract hash. |
| 3. Exact merged `declarations` block and all field descriptions against BR-3 | **BLESS** | No BR-3 wording fix: this confirms the exact stored-only, non-soliciting text identified below; BR-1's horizon correction remains a separate before-shadow requirement. |

## Baseline and evidence boundary

| Pin | VERIFIED value |
|---|---|
| Workspace | `C:/Users/fashr/.codex/worktrees/e0ad/portfolio-duel` |
| Starting state | Detached HEAD `b3278358339bffb2b1bed02a95fe8679508d1f01`; clean |
| Fetch | `git fetch origin` succeeded before remote comparisons; the first attempt needed an authorized retry to write shared Git metadata outside the sandbox. |
| Review base | Fetched `origin/main` = **`b3278358339bffb2b1bed02a95fe8679508d1f01`**, merge of docs PR #905; includes Build 0 PR #903. |
| Review branch | `docs/review-contract-v1-4`, created here from fetched `origin/main`; clean before this report |
| Contract amendment commit | `22442af1cd75a3961f462260cdc770c946e95824`; adds V1.4 and Amendment A, retaining the V1.3 files |
| Prior adjudication | `docs/audits/20260924_BUILD0_CALL_RECORDS_REVIEW.md` at **`3f6001611163f8487f65bdd8ec6b355b6f519d1c`**, on `docs/review-build0-call-records`; read with `git show` |
| Prior adjudication fingerprint | 214 lines; committed-blob SHA-256 `944c70d99a28c16e5c9d37d68e9cc6c431ad29f4f648ec743d175b3164a960aa`, matching the build report's pin |

All ordinary `path:line` citations refer to the review base. References prefixed **prior review @3f600161** refer to that historical report's lines, not a file present on current main. **VERIFIED** here means current source/Git inspection or the specifically described local serialization measurement. No test-suite, mutation, provider/model, tokenizer endpoint, emulator, database, deployment, or live shadow execution was performed. Historical §13 test results are not re-awarded as current execution evidence.

Read the governing `CLAUDE.md`, `docs/README.md` routing, and `docs/BUILD_RULES.md`. The authorized mutations are branch setup and this report's commit/push only; all reviewed code, contracts, specifications, flags, and tests remain unchanged.

## Committed-byte fingerprints

Computed with Node `createHash('sha256')` directly over the Buffer returned by `execFileSync('git', ['show', 'HEAD:<path>'])`, without text decoding, PowerShell redirection, or newline conversion.

| File | SHA-256 of committed blob |
|---|---|
| **`docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md`** | **`21489201d99fba99580bbc468a5274fd0f1d90f9484a0659bc16485fffa08823`** |
| `docs/CALL_RECORD_FIELD_CONTRACT_V1_3.md` | `7161e113efbac2e3fd05e4c45da3080d7d62ad0dcfc3ea1d9e30d38642c4fc25` |
| `docs/design/COCKPIT_SPEC_V1_3.md` | `5a6a9a4eee1c2337bba0f7b1348798d72cb639ee0c6b10dd785a621e71ea9939` |
| `docs/design/COCKPIT_SPEC_V1_3_AMENDMENT_A.md` | `10e3217303de0af340712d8de3d1b741b6b75e61a6c182612b29580e4d180124` |
| `api/_utils/agentEvalToolSchema.js` | `9dc54b3560c27914acbc5697fd358472f2a820503851a70410ddec93d06d9e22` |

V1.4 is 21,577 committed bytes, Git blob `958dbb3127fcd286346e43f87732eb467ef651ef`. Its hash above identifies the reviewed text, **not a corrected or unconditionally blessed revision**. Any amendment changes that pin.

## 1. Contract delta: H1 BLESS; H2 AMEND

**VERIFIED comparison:** ran `git diff --no-index -- docs/CALL_RECORD_FIELD_CONTRACT_V1_3.md docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md` (exit 1 means differences), then compared the committed blobs directly. The changes are the header/changelog, §4 provenance notes, §5 `next_check`, §6's opening rule, and §9's sweep dependency. The declarations wire block and every §4 field-name/type column are identical. Sections 1, 2 (including 2.1), 3, 7, 8, 10, and 11 are identical. No field, nesting, nullability, identity, phase stamp, receipt, answer vocabulary, or capture-composition shape changed. Retiring `hash_without_watchlist` changes the allowed provenance semantics as ruled; it is not a new record shape.

| Check | Verdict and evidence |
|---|---|
| H1 absent/undefined/null watchlist | **BLESS.** Initiative with a null ref regardless of config hash; unresolved only for a present unusable snapshot. V1.4 §4 says this explicitly (`docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md:61-62`), matching A-1 (`docs/audits/20260924_BUILD0_CALL_RECORDS.md:509-518`) and `resolveProvenance` (`api/_utils/callRecords/candidate.js:107-124`). |
| H1 valid equipped provenance | **BLESS.** Valid versioned/legacy refs remain equipped; no live watchlist recovery; `snapshot_corrupt` and `config_hash_missing` remain the reason vocabulary (`api/_utils/callRecords/candidate.js:39`, `api/_utils/callRecords/candidate.js:113-124`). |
| H2 per-call rule and current observation | **BLESS.** At/after the slot, an eligible still-open call is hit if this observation meets its condition, otherwise expired; parent status and terminal-call rereads govern. Late observation is not represented as a missed-slot quote (`docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md:75`, `api/_utils/callRecords/flip.js:114-121`, `api/_utils/callRecords/flip.js:202-225`). |
| One committed judgment, not earliest observation | **BLESS.** The exact distinction and no-battle-clock rule are present at V1.4 line 75 and match §13.1 (`docs/audits/20260924_BUILD0_CALL_RECORDS.md:630-633`). |
| Unconfirmed attempts | **AMEND.** V1.4 line 75 groups an unconfirmed attempt with attempts that have judged nothing; an unconfirmed transaction can commit late and be the judgment. See finding C1. |
| Sweep obligation | **BLESS.** §9 expressly forbids mechanically expiring `next_check` at its slot; unobserved expiry requires a separately agreed policy (`docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md:118`). This is a Build 1 obligation, not evidence of a built sweep (`docs/audits/20260924_BUILD0_CALL_RECORDS.md:633`). |
| Other bases and pre-slot hits | **BLESS, with a prose clarification in C1.** §6 explicitly defers `next_check` to H2 and leaves other bases unchanged (`docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md:84`). The implementation still permits eligible pre-slot hits (`api/_utils/callRecords/flip.js:117-121`); BR-1 explicitly preserved them (prior review @3f600161, `docs/audits/20260924_BUILD0_CALL_RECORDS_REVIEW.md:53`). |
| Full BR-4 handoff closure | **AMEND.** Versioned documents exist and V1.3 bytes are preserved, but the consumer amendment names V1.4 without its SHA, and the requested model-horizon alignment is absent. See C2 and C3. |

### C1 — An unconfirmed attempt is not evidence of no committed judgment

**P2 · VERIFIED · high confidence.** V1.4 says “a failed, skipped, deadline-cut or unconfirmed attempt has judged nothing” (`docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md:75`). That is stronger than BR-1 and contrary to §13.1's explicit late-commit case (`docs/audits/20260924_BUILD0_CALL_RECORDS.md:647-650`). A consumer following the sentence could authorize a second judgment from a local timeout outcome even though the first transaction committed.

The implementation starts the transaction inside `withTimeout`, writes the state and receipt together, and returns `unconfirmed` on timeout (`api/_utils/callRecords/flip.js:202-229`). `withTimeout` races promises; it does not cancel the transaction (`api/_utils/intraday/evaluatorHook.js:20-23`). The existing test specifically models an unconfirmed miss that commits late, followed by a hot observation that must not change it (`api/_utils/callRecords/flip.test.js:402-418`; source inspected, not executed here). BR-1 already states the same rule (prior review @3f600161, `docs/audits/20260924_BUILD0_CALL_RECORDS_REVIEW.md:51`).

**One-line fix:** “An attempt that does not commit has judged nothing; an unconfirmed attempt has an unknown outcome and may commit late, so a later transaction judges from its own observation only if its fresh read still finds the call open.”

While editing H2, qualify §6's retained “inside the horizon” / “Expiry wins” wording with “subject to the `next_check` judgment rule in §5,” and state that eligible pre-slot hits remain unchanged (`docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md:84-86`). The preceding explicit exception already supplies the intended precedence; this is a clarity fix, not evidence of an additional runtime defect.

### C2 — The model's horizon wording still omits the H2 exception

**P2 · VERIFIED · high confidence; separate from BR-3.** The merged schema still says “LEVEL before the horizon ends” and describes `next_check` as “until the next check” (`api/_utils/agentEvalToolSchema.js:247-248`, `api/_utils/agentEvalToolSchema.js:279-282`). Neither describes a later first reach or an at/after-slot judgment. BR-1 expressly requested alignment of this text (prior review @3f600161, `docs/audits/20260924_BUILD0_CALL_RECORDS_REVIEW.md:57`); the build report explicitly left it undone (`docs/audits/20260924_BUILD0_CALL_RECORDS.md:793-796`). The V1.4 docs commit changed only two documentation files; the schema remains identical to the BR-3 commit.

**One-line fix:** Explain in `calledShots`/`horizonPhrase` that `next_check` uses the next eligible slot as a judgment boundary, may be judged on a later first reach from that check's observation, and records a condition rather than scheduling a trade; retain the pre-slot hit rule.

The new wording must preserve BR-3's stored-only and non-execution guarantees and update its input-size pins. This report proposes that correction; it does not edit or pre-approve a future model-visible diff.

### C3 — The consumer contract reference moved without its hash

**P2 handoff alignment · VERIFIED · high confidence.** Amendment A makes V1.4 the contract of record but supplies no V1.4 SHA (`docs/design/COCKPIT_SPEC_V1_3_AMENDMENT_A.md:3`). Its only hash is the abbreviated old spec hash. The retained spec still pins V1.3 (`docs/design/COCKPIT_SPEC_V1_3.md:4`), appropriately as a historical Build 0 input. BR-4 required moving current consumer references and committed-byte pins together (prior review @3f600161, `docs/audits/20260924_BUILD0_CALL_RECORDS_REVIEW.md:96`; repeated at `docs/audits/20260924_BUILD0_CALL_RECORDS.md:795`). Naming the new contract alone does not complete that requirement.

**One-line fix:** Add the full committed-blob SHA-256 of the corrected V1.4 to Amendment A's contract-of-record line and the current pilot handoff, preserving the historical V1.3 pins as historical inputs.

The current V1.4 pin is reported above for reproducibility; recompute after C1. No current external pilot handoff was supplied or verified in this task, so its pin is not certified.

## 2. Amendment A: every row checked

The table below distinguishes matches to §13 from clarifications supported elsewhere. “BLESS” approves the row's substantive meaning; it does not turn a future sweep obligation into built functionality or a historical test report into a current run.

| Amendment row | Verdict | Comparison and one-line fix where needed |
|---|---|---|
| §3.6 provenance, line 8 | **BLESS** | Matches A-1 in §12.1, accepted again by §13's BR-4 discussion (`docs/audits/20260924_BUILD0_CALL_RECORDS.md:511-518`, `docs/audits/20260924_BUILD0_CALL_RECORDS.md:614`). Absent/null versus present unusable, null ref, ignored hash, and retired reason all match code. |
| §3.8 `next_check`, line 9 | **BLESS** | Matches §13.1's at/after-slot, per-call, committed-transaction rule, no battle clock, other bases unchanged (`docs/audits/20260924_BUILD0_CALL_RECORDS.md:619-633`). Unlike V1.4 line 75, this row does not claim that an unconfirmed attempt cannot have committed. Read “first” with the contract's explicit concurrency distinction. |
| §3.8 `cronState.callFlips`, line 10 | **BLESS** | Exactly `{ evalId, cursor, scanned, total, complete }`; removal of interim `observedAtMs` is documented in §13.1 and implemented (`docs/audits/20260924_BUILD0_CALL_RECORDS.md:626-628`, `api/_utils/callRecords/flip.js:260-265`). |
| §3.4 gameplan rows, line 11 | **BLESS** | Matches §13.2: held names only for a numeric price-scanning guardrail, otherwise an empty set; expiry remains possible (`docs/audits/20260924_BUILD0_CALL_RECORDS.md:654-661`). The adapter is last-wins by type and the cron uses it (`api/_utils/callRecords/observe.js:146-166`, `api/cron/agent-evaluate.js:5252-5262`). |
| §3.1 descriptions, line 12 | **BLESS** | Matches §13.3 and the merged block/fields (`docs/audits/20260924_BUILD0_CALL_RECORDS.md:684-695`, `api/_utils/agentEvalToolSchema.js:236-338`). The blanket block applies to all fields; simple leaf descriptions need not repeat every disclaimer. The exact BR-3 confirmation previously pending at §13.3 line 703 is supplied by this report. |
| §2 mode resolution, line 13 | **BLESS** | Accurate implementation clarification, **not a separately reported §13 fix**. Context is created per battle check (`api/cron/agent-evaluate.js:903-907`), resolver reads the static module constant (`api/_utils/callRecords/mode.js:28-32`, `src/config/featureFlags.js:2806`). This changes no current flag behavior. |
| §3.13 shadow read, line 14 | **AMEND** | §13.3 reports **growth of** 4,154 chars, not a schema of that total size (`docs/audits/20260924_BUILD0_CALL_RECORDS.md:698-701`). **Fix:** “Additional input schema: +4,154 serialized chars, about 1,039–1,385 tokens; maximal fixture input: 10,132 tokens at chars/4 against 12,000; real token counts and shadow truncation observations remain pending.” |
| §4 Build 1 sweep, line 15 | **BLESS** | Matches §13.1's future obligation and explicit statement that no sweep exists in this build (`docs/audits/20260924_BUILD0_CALL_RECORDS.md:633`); matches V1.4 §9 (`docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md:118`). |

**Measurement correction — VERIFIED.** Local serialization of the dependency-free schema module from committed bytes gives 8,537 chars for the off tool, 12,691 for the on tool, and **+4,154** for the contribution. The declarations object alone is 4,138 chars; the difference includes its property name/separator. The 1,039 and 1,385 numbers are rounded chars/4 and chars/3 estimates (`api/_utils/agentEvalToolSchema.declarations.test.js:213-219`). The 10,132 fixture figure is reported in §13, not remeasured here; its harness explicitly uses a chars/4 estimate (`api/_utils/composition.m7e2eBudget.test.js:21-23`, `api/_utils/composition.m7e2eBudget.test.js:200-205`). Input-schema size does not establish output truncation headroom; the spec already separates them (`docs/design/COCKPIT_SPEC_V1_3.md:43`).

**Source header — AMEND, P3, VERIFIED.** “All are on main after PR #903” is false for the original branch review (`docs/design/COCKPIT_SPEC_V1_3_AMENDMENT_A.md:4`). That path is absent from the reviewed HEAD's tree. The build report correctly points to the review branch and exact commit (`docs/audits/20260924_BUILD0_CALL_RECORDS.md:597`); the recovered blob matches its hash. **One-line fix:** cite the review at commit `3f6001611163f8487f65bdd8ec6b355b6f519d1c` on `docs/review-build0-call-records`, and limit the main claim to the merged build report/fixes.

The follow-up paragraph matches §13.8's separate gameplan-timezone and old CRLF-test issues (`docs/design/COCKPIT_SPEC_V1_3_AMENDMENT_A.md:19`, `docs/audits/20260924_BUILD0_CALL_RECORDS.md:801-807`). The additional “queued with G-2 ... after the shadow flip” scheduling statement is not established by §13; treat it as the amendment author's sequencing note, not a newly verified build result. No follow-up implementation was assessed.

## 3. Exact model-visible BR-3 confirmation

**BLESS against BR-3. This is the previously withheld confirmation of the actual merged text, not merely its direction.** Reviewed all **24 descriptions** in `DECLARATIONS_PROPERTY`, including the block and every nested field, at `api/_utils/agentEvalToolSchema.js:236-338`. The property is actually attached to the declarations-on tool at `api/_utils/agentEvalToolSchema.js:347-367`; the comment above it was not treated as the model-visible wording.

The source is unchanged since BR-3 commit `4507ef8235aafc59c89eb692e5cd7511f24488db` (`git diff 4507ef8 HEAD -- api/_utils/agentEvalToolSchema.js` is empty). The whole source-file hash is above. For an additional content pin, SHA-256 of UTF-8 `JSON.stringify(DECLARATIONS_PROPERTY)` is **`7ebcea6d599aa4572bd4c3d20d8b6f910dfa93ccb6ed849c5dab7ba7da507f64`**; this serialization hash is distinct from the committed-file hash.

| Model-visible surface | BR-3 verdict and exact-text assessment |
|---|---|
| Block, lines 239–242 | **BLESS.** Explicitly stored only, not shown to the player, no requested response, no executed/scheduled trade, not supplied to a later check, and no change to the current decision or `anticipationCandidates`. Retains omit/null, at-most-six, and this-check quote-source guidance. |
| `calledShots`, `symbol`, `direction`, `slot`, `counterpart`, `condition.side`, `condition.level`, `horizonPhrase`, `expiresAtMs`, lines 244–287 | **BLESS against BR-3.** Typed conditional records with no player-response, permission, wait, trade-suppression, or narration instruction. **C2 separately flags the temporal descriptions against BR-1/H2.** |
| `defaultAction`, line 291 | **BLESS.** “Intent recorded at declaration time if the condition is met: act = would favor a trade; hold = would favor holding. This records an intention, not an instruction or promise of execution.” Matches BR-3 verbatim. |
| Called-shot `said`, line 295 | **BLESS.** One conditional sentence, stored only, not shown; explicitly says typed fields are the call and the sentence only presents it. |
| `watching`, line 303 | **BLESS.** At most six tickers, without calling a trade; explicitly separate from and never replacing `anticipationCandidates`. |
| `playerAsk`, `question`, `options`, `symbol`, lines 305–313 | **BLESS.** Records an unresolved research question; “no question is delivered and no answer is expected.” Leaves supply bounds and optional ticker, without addressing a player as an answerer. |
| `fork`, `slot`, `swapOut`, `options`, option `symbol`/`why`, lines 315–332 | **BLESS.** Records an unresolved choice; “no selection is requested or acted on.” Slot and replacement wording is conditional; remaining fields supply options and bounds. |
| Fork `said`, line 334 | **BLESS.** One conditional sentence, stored only and not shown, under the block's non-execution disclaimer. |

The criteria are the original BR-3 text (prior review @3f600161, `docs/audits/20260924_BUILD0_CALL_RECORDS_REVIEW.md:77-84`), not just tests echoing the new strings. Source inspection confirms the retained BR-3 assertions check the block, sensitive fields, both `said` descriptions, and prohibited player/permission/narration language (`api/_utils/agentEvalToolSchema.declarations.test.js:124-145`). Those assertions were not rerun.

Local comparison of the schema exports before BR-3 and at HEAD, stripping only `description` keys, found identical declarations structure; serialized off tools were also identical. Thus this wording confirmation does not conceal a field, required-list, enum, or type change. It approves the Build 0 recipient/authority language at this fingerprint; it does not certify future model behavior or make the independent horizon defect disappear.

## Delivery and remaining gates

Only `docs/audits/20260924_CONTRACT_V1_4_REVIEW.md` is the authorized repository change. A byte-identical copy is retained outside the repository for download. Delivery is this report's commit and push on `docs/review-contract-v1-4`, then stop; no PR, merge, CI monitoring, deployment, or flag change is part of this task.

This review closes **the exact-text BR-3 confirmation**. The handoff amendments C1–C3 and Amendment A corrections remain; real `countTokens`, index/rules deployment, and the existing shadow prerequisites remain unverified (`docs/audits/20260924_BUILD0_CALL_RECORDS.md:792-799`). The source flag remains `'off'` (`src/config/featureFlags.js:2806`).
