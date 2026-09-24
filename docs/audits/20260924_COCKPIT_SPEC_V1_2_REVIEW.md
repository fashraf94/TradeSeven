# Cockpit Spec V1.2 — round 3, Build 0 delta review

**Date: 2026-09-24. Build 0 verdict: REVISE.** Section 3 closes the publication/completion race and resolves the time-format finding against the final V1.3 contract. It does not yet give a builder an executable, internally consistent encounter pipeline. Following its literal quote adapter rejects usable prices; following its non-model timestamp can backdate later evidence. The flip query also contradicts the instruction to ship no composite index.

| Opening record | Verified value / disposition |
|---|---|
| Scope | **§3 / Build 0 only.** R2-1 through R2-9 and R2-11: **2 closed, 8 partially closed**. No Build 1 or Build 2 verdict. |
| Repository | `https://github.com/fashraf94/TradeSeven.git` |
| Fetch and source baseline | Ran `git fetch origin` successfully before comparing with the remote baseline. The first attempt hit shared Git metadata permissions; the authorized retry succeeded. Fetched `origin/main` and source HEAD: `fc3a072efa544baa0f533751e138f872e44c507e`. |
| Worktree / branch | New worktree from fetched `origin/main`: `C:/Users/fashr/.codex/worktrees/cockpit-spec-v1-2-review/portfolio-duel`; branch `docs/review-cockpit-spec-v1-2`; clean at creation. |
| Spec | `docs/design/COCKPIT_SPEC_V1_2.md`; committed-blob SHA-256 `28e09540710c337c7888b216bf2bd754a3920535855258df980d4a000565e830`. |
| **Final contract — unchanged** | **Actual HEAD path: `docs/CALL_RECORD_FIELD_CONTRACT_V1_3.md`. Committed-blob SHA-256: `7161e113efbac2e3fd05e4c45da3080d7d62ad0dcfc3ea1d9e30d38642c4fc25`.** The advertised `docs/design/` path is absent. |
| Hash method | SHA-256 of raw bytes returned by `git show HEAD:<path>`, without text decoding or newline conversion. Windows has `core.autocrlf=true`: the contract checkout hash is `d65d9ae4e7292be18f8a05fcf41ee9be8d6634c6dff4f40a662c4d0467e5a721`; that is **not** the committed-byte pin requested by the contract. |
| Round-2 comparison input | `docs/audits/20260923_COCKPIT_SPEC_V1_1_REVIEW.md` is absent from HEAD. Read its committed blob at `282fe1090dd4cc6bc2146546fef660b2557e1ac1`, the fetched tip of `origin/docs/review-cockpit-spec-v1-1`. It is historical comparison evidence, not a file on main. The text supplied during this review is round 1; it does not replace this recovered round-2 report. |
| Other inputs | `docs/audits/20260923_PHASE0_COCKPIT.md`, `docs/BUILD_RULES.md`, and the repository bootstrap. Discovery claims and inherited source anchors were checked against current source where relevant. |
| PR #896 | **Present at HEAD:** merge `1ee84a07`; `agentEvalRuns` is implemented. The run record includes `deferredBattleIds` at `api/cron/agent-evaluate.js:527-543`, is written at `:551-561`, and denies client access at `firestore.rules:881-889`. Its former absence is not a remaining blocker. |

## Evidence and scope

**S** = `docs/design/COCKPIT_SPEC_V1_2.md`; **C** = `docs/CALL_RECORD_FIELD_CONTRACT_V1_3.md`, both at the source HEAD above. **R2** = the historical report blob identified in the table. All other source citations are at source HEAD and were read this session. The report-only commit does not change their contents.

**VERIFIED** means inspected source/document text or Git metadata. Consequences and timing examples below are **static inferences**, not executed reproductions or production observations. No application tests, mutation probes, build, rules emulator, model/provider calls, database access, deployment or flag flips ran. One public Firebase documentation page was consulted to verify the index requirement; it is linked with that finding. Report checks cover hashes, citation bounds and delivery scope, not application correctness.

The six round-1 items already closed in round 2 remain closed; this review does not reopen their mapping, validator-boundary, schedule-source, chat-anchor, Guarding or mobile-design decisions. R2-10 and R2-12 are outside this request. The only use of later-build context is to check Build 0's promised contract and handoff.

## Closure of the requested round-2 findings

“Closed” means the specification closes the cited finding; no implementation is certified.

| Finding | Does §3 close it? | Current evidence and remaining delta |
|---|---|---|
| **R2-1 — publication/completion interlock** (`R2:71-79`) | **Yes** | `S:67,75-80,108-109` freezes the candidate, uses one create transaction with the parent in its read set, compares immutable payloads and names the between-read-and-commit race. Current durability seam: `api/cron/agent-evaluate.js:4127-4129,4162-4166,4244`; completion reads and updates the same parent transactionally at `:5885-5894,6081`. The zero-open-call queue case is a separate remaining R2-7 detail below. |
| **R2-2 — aggregate budget / protected tail** (`R2:81-91`) | **Partially** | `S:73,110` fixes the model-path threshold, 12-second tail and aggregate deadline. The existing admission helper supports the allowance at `api/_utils/agentEvalTransport.js:167-176`. But `S:86` gives non-model exits a separate two-second deadline without the remaining-budget/tail guard. **R3-3.** |
| **R2-3 — frozen encounter evidence** (`R2:93-101`) | **Partially** | `S:53-61,111` preserves original quotes, uses actual prompt membership, rejects fallback and records replacements. The literal saved shape is incompatible with `api/_utils/agentQuoteHealth.js:20-28`; the non-model clock precedes later quote fetches at `api/cron/agent-evaluate.js:1403-1411,2404-2411`. **R3-1.** |
| **R2-4 — non-model exits and independent context** (`R2:103-111`) | **Partially** | `S:53,60-61,86` supplies the independent context and three early-exit hooks. HEAD also has gameplan exits at `api/cron/agent-evaluate.js:2295-2314,2334-2361` and a budget-skipped final-update path at `:2555-2569`. Their dispositions and the complete phase-stamp predicates remain unspecified. **R3-2**, with clock/budget corrections in **R3-1/R3-3**. |
| **R2-5 — minting observation / matching effect** (`R2:113-121`) | **Partially** | `S:89-92,114` closes same-evaluation, pre-mint and expiry-equality predicates. `S:93` distinguishes entry/exit legs, but omits declared counterpart checks and exit-slot / pick-swap-out binding. HEAD returns those facts in `api/_utils/agentSwapExecution.js:255-260`. **R3-4.** |
| **R2-6 — evidence type and mint-time horizon** (`R2:123-131`) | **Yes, under final V1.3** | `C:58` now deliberately requires ISO-string `priceAsOf`; do **not** implement round 2's superseded numeric recommendation. `S:64,67,113,116` conforms, supplies `mintedAtMs` and explicit-expiry validation, numeric resolver inputs and basis literals. Current ISO producer: `api/cron/agent-evaluate.js:2630`; calendar bounds: `api/_utils/marketSchedule.js:177-203`; schedule: `vercel.json:157-158`. |
| **R2-7 — arm repair at publication** (`R2:133-141`) | **Partially** | `S:75-80,100,121` puts queue arming and access rules in Build 0 and honestly labels the shadow backlog. This closes the former build-order defect; PR #896 is present. But queue computation remains unconditional when a valid declarations record contains **zero open calls**. **R3-5.** Worker execution remains outside this review. |
| **R2-8 — off keys / rollback / composition** (`R2:143-151`) | **Partially** | `S:71,103,106-107`, read with `S:26-28`, fixes separate `CALLS_ENTRY_KEYS`, mode resolution and rollback exclusions. HEAD's unconditional lists are still `api/_utils/__fixtures__/tickStampsHarness.js:68-79,116-119`. But `S:97,117` prescribes only versions 1/2 while the final contract requires contribution-relative pilot/combined versions. **R3-7**; phase-field contradictions are in **R3-2/R3-8**. |
| **R2-9 — bounds, scan coverage, output margin** (`R2:153-159`) | **Partially** | `S:35,49,73,88,94,110-114,121` adds string/document/publication caps, stable removal order, sequential transactions, partial coverage and honest output/truncation reporting. The 2,048-token ceiling is confirmed at `api/_utils/agentEvalTransport.js:59`. The ordered filtered query conflicts with “no composite index,” and restart/continuation behavior still permits starvation. **R3-6.** |
| **R2-11 — repository input package** (`R2:173-179`) | **Partially** | Spec and final contract are now committed, but `S:3` advertises a nonexistent contract path and a report absent from main; `S:121` postpones hashes until the post-build report. The named publication/finalization lines also refer to old source locations. **R3-9.** |

## Could a builder execute §3 with no other context?

**No. Even with the final contract and this repository supplied, the builder must resolve conflicting instructions or choose correctness-critical behavior.** This is more than looking up a helper or updating a line number. The choices concern which price qualifies, when it was observed, which exits count, what execution proves, and which wire shapes may be written. Resolve R3-1 through R3-9 before deriving the Build 0 prompt.

Severity: **P1** blocks the Build 0 prompt because literal implementation can produce false/missing evidence or spend protected time. **P2** is a required contract or handoff correction. All fixes below are proposed specification text; none was implemented.

### R3-1 — The observation recipe rejects its own quote shape and can backdate later quotes

**Severity: P1. Carries R2-3 and the clock portion of R2-4.**

**Evidence — VERIFIED:** `S:55` stores `{ px, fallback, fetchedAtMs }`; `S:59` applies `isSettlementQuoteUsable` to that value. The helper requires numeric `quote.current`, not `quote.px` (`api/_utils/agentQuoteHealth.js:20-28`). The initial fetched object comes from `data.price` (`api/cron/agent-evaluate.js:1004-1018`). Separately, `S:60` takes non-model `observedAtMs` immediately after the initial quote-health check, but constructs the examined set at the later exit. HEAD fetches additional prices later (`:1403-1411,2404-2411`), changes held/bench membership after forced swaps (`:2241-2251`), and only then reaches no-trigger (`:2464-2483`).

**Consequence — inferred:** literal helper reuse excludes every saved `px` quote. Repairing that field alone still allows a quote fetched after a call's expiry to be stamped with an earlier, inside-horizon instant. Neither the frozen-object requirement nor `replacedInPrompt` repairs that clock mismatch.

**Fix as written:** “Preserve each fetched quote as a detached `{ current, fallback, fetchedAtMs }` value. Apply `isSettlementQuoteUsable` to that shape, then project `current` into observation `px`. For each non-model path, freeze the examined set and its quote values at the named examination seam and take `observedAtMs` at that same seam, after every admitted quote has arrived. Require `fetchedAtMs <= observedAtMs`. Do not apply the initial quote-health time to later membership or fetches. The model seam remains successful prompt completion; fetched-price replacements remain explicitly marked. Add a direct saved-shape/helper fixture and a later-augmentation fixture straddling expiry.”

### R3-2 — The exit and phase-stamp matrix is still incomplete

**Severity: P1. Carries R2-4.**

**Evidence — VERIFIED:** `S:60,86,103,111` names passive, proposal-pending and no-trigger checks. HEAD also writes and returns on pending gameplans (`api/cron/agent-evaluate.js:2295-2314`) and newly created gameplans (`:2334-2361`). A budget-skipped model attempt has valid earlier deterministic processing but no prompt (`:2555-2569`) and still reaches the final update (`:4244`). These were explicitly requested in `R2:111`. The proposed identity starts as null (`S:53`), but the flip predicate dereferences `callsCtx.evalIdentity.evalId` (`S:89`). `S:71` names `none | expected` without their full input predicates; `S:107` requires phase-key presence “on every exit,” despite `S:60` excluding error/pre-admission paths and HEAD's early exits writing no evaluation entry (`api/cron/agent-evaluate.js:859-863`).

**Consequence — inferred:** an implementation can silently omit gameplan/budget-skipped encounters, throw on a null identity, or fabricate an evaluation stamp on a path that never created an evaluation.

**Fix as written:** “Add an exit matrix for model-result, transport-failed-after-prompt, budget-skipped, no-trigger, proposal-pending, gameplan-pending, gameplan-created and passive paths. Bind each observation to that path's actual examined inputs; hook flips only after its authoritative write. Gameplan paths must use the set examined by their deterministic pass, not infer it from a subsequently changed portfolio. Pre-admission, degraded quotes, failed refresh, failed prompt build and error exits have no qualifying observation. Publication requires a committed evaluation and a non-null validated declarations block; flips do not require publication. Null/absent or fully removed blocks stamp `none`; surviving typed content stamps `expected`; rejected-block reasons remain diagnostics. No-entry paths create neither an evalId nor an evaluation phase key; use `evalIdentity?.evalId ?? null`. Restrict presence tests to the paths that actually write the relevant record, and test each matrix row with capture on and off.”

### R3-3 — Early-exit flips can spend the tail reserve that the model path now protects

**Severity: P1. Carries R2-2.**

**Evidence — VERIFIED:** `S:73` correctly protects 12,000 ms for the model-path tail and requires 4,000 additional ms. `S:86` instead assigns early exits their “own bounded deadline of 2,000 ms,” without clipping it to the shared handler budget or preserving that tail. Those exits still enter `finally`; pending narrations are always awaited at `api/cron/agent-evaluate.js:4261-4290`, and capture uses remaining handler budget at `:4366-4372`. Risk/gameplan paths can have queued committed-trade narration; this is not exclusive to model checks.

**Consequence — inferred:** an early exit reached with 12.1 seconds remaining can spend two seconds on calls and leave 10.1 seconds for work the model-path rule protects with twelve. The two-second local bound alone does not prove reserve preservation.

**Fix as written:** “Apply the same shared-handler clock and protected tail to every calls hook. For a non-model hook, `available = handlerStartMs + TIME_BUDGET_MS - now - TAIL_RESERVE_MS`; skip when `available < 2_000`, otherwise set `deadline = min(now + 2_000, handlerStartMs + TIME_BUDGET_MS - TAIL_RESERVE_MS)`. Queries, transactions, retry attempts and coverage-status attempts share it. Exceptions are isolated, timeout remains unconfirmed, and no status attempt starts after expiry. Test a late proposal/gameplan exit with narration already queued. Report forfeited encounter/capture coverage honestly.”

### R3-4 — The matching-effect predicate still permits the wrong counterpart or slot

**Severity: P1. Carries R2-5; the same-check-hit subfinding is closed.**

**Evidence — VERIFIED:** `S:93` checks incoming symbol/slot for entries, only outgoing symbol for exits, and option membership/slot for picks. It does not require an entry/exit's declared counterpart, an exit's slot, or a pick's `swapOut`; yet `S:114` demands a wrong-counterpart fixture. HEAD's committed executor return includes `symbolOut`, `symbolIn`, `tier` and `slotIndex` (`api/_utils/agentSwapExecution.js:255-260,367-369`). The model-path consumer is at `api/cron/agent-evaluate.js:3446-3463`; those facts are presently local, and the capture-only action projection omits tier/slot.

**Consequence — inferred:** “exit X for Y” can acquire an acted ID when X was sold for Z. Correct-leg membership is necessary but is not the complete declared trade.

**Fix as written:** “Carry the awaited executor's returned `closedTrade` identity and resolved slot in the calls context independently of capture; do not reconstruct it from the proposal or capture projection. Match entries on incoming symbol and resolved slot, and on outgoing counterpart when declared. Match exits on outgoing symbol and resolved slot, and on incoming counterpart when declared. Match picks on incoming option, declared `swapOut` and resolved slot, with selected-option binding when present. Only a matching successful executor result plus the committed evaluation identity may supply `actedEvalId`. Same-evaluation mint exclusion remains in force. Make wrong-counterpart, wrong-slot, wrong-swap-out and capture-off fixtures fail independently.”

### R3-5 — Queue arming has no zero-open-call branch

**Severity: P2. Carries the remaining R2-7 publication detail.**

**Evidence — VERIFIED:** The final contract deliberately permits declarations containing only `watching`/`playerAsk` (`C:23-27,35-39`), and `S:47` preserves that decision. All minted calls can also be `invalidated` (`S:49,67`). Nevertheless, the `expected` transaction unconditionally computes `min(open calls' expiresAtMs)` and sets the queue (`S:75-79`). With no existing queue and no open calls, that minimum has no finite value.

**Consequence — inferred:** the builder must invent an empty-minimum sentinel or can fail an otherwise valid atomic declarations publication. Monitoring-only checks should not need imaginary expiry work.

**Fix as written:** “Let `newOpen` be the candidate calls whose initial state is `open`. If it is empty, create the valid declarations record and any invalidated calls atomically without reading or writing the sweep queue; leave any existing queue unchanged. Otherwise read the queue in the transaction and set the minimum of its valid finite expiry and the finite expiries in `newOpen`. Never persist Infinity, null or an undefined expiry as a queue sentinel. Add declarations-only, all-invalidated, mixed-state and pre-existing-earlier-queue fixtures.”

### R3-6 — The ordered flip scan needs an index and a continuation policy across checks

**Severity: P1 for the query contradiction; P2 for the remaining coverage handoff. Carries R2-9.**

**Evidence — VERIFIED:** `S:88` specifies `state == 'open'` ordered by `mintedAt`, page 50. `S:100` says “No composite index” because the *client* orders only by time, overlooking Build 0's server query; `S:103` omits `firestore.indexes.json`. Parsed HEAD index configuration contains no `calls` index. The existing reflection analogue has its filtered/ordered composite at `firestore.indexes.json:219-236` (also explained in discovery `docs/audits/20260923_PHASE0_COCKPIT.md:161`). Firestore requires a manual/composite index for an equality filter plus sorting on a different field. [Firebase index documentation](https://firebase.google.com/docs/firestore/query-data/index-overview#queries_supported_by_manual_indexes).

The new wording pages only “until the deadline” and records partial coverage; it never says where the *next check* resumes. With sequential transactions allowed up to 800 ms (`S:94`), a two-second phase need not finish even the first page. Reporting `complete: false` is honest but does not prevent re-reading the same oldest unresolved prefix indefinitely. An exact `total` is also prescribed without a bounded way to obtain it.

**Fix as written:** “Add the Build 0 collection-scope `calls` composite `state ASC, mintedAt ASC` to the index file and the deployment/readiness checklist; validate the exact server query. Page with a stable document-ID tie-break and a snapshot/value cursor. Define a persisted rotation cursor in `cronState.callFlips`, continued on the next qualifying check and wrapped after the end, so old unresolved calls cannot monopolize each deadline. Each new check uses its own fresh observation, never the previous check's timestamp. Report per-check partial coverage; set `total: null` unless a bounded count was actually obtained. Test more than 50 calls, identical mint times, an unresolved prefix, deadline interruption across successive checks and cursor wraparound.”

This does not claim any deployed index is missing: no console or live query was inspected. It identifies the missing reproducible Build 0 dependency.

### R3-7 — The capture instructions still collapse the contract's four composition rows into two

**Severity: P2, final-contract alignment. Carries R2-8.**

**Evidence — VERIFIED:** `C:107-114` expressly preserves enabled pilot fields/version at calls-off and requires a registered combined version when both contributions are enabled. `S:97` says the writer emits version 2 whenever calls are enabled; `S:117` requires version 1 at off. The broader promise at `S:28` to test all four rows does not reconcile those literal instructions. HEAD uses the same version constant in both output documents (`api/_utils/tickCapture/captureWriter.js:175,208`), so both need the same resolved composition rule.

**Fix as written:** “The v1/v2 instructions apply only with the pilot contribution disabled. Resolve the emitted schema from the enabled contribution set once and pass the result to both permanent and body composers. Calls-off removes only calls paths and preserves the independently enabled pilot's registered shape/version. Calls-on plus pilot-on uses the registered combined shape/version. Pin the four-row contract table in §3 and the build prompt. If pilot/combined registration is not yet available at the build baseline, explicitly gate those combinations unavailable; do not claim them tested or emit a misleading version.”

No new pilot implementation is authorized by this review, and an absent pilot at current HEAD is not itself a runtime defect. The issue is the conflicting contract the next builder is told to implement.

### R3-8 — Proposed durable phase and observation fields depart from the final wire contract

**Severity: P2, final-contract alignment. Related to R2-4/R2-8.**

**Evidence — VERIFIED:** `C:39` defines the latest phase wire as `{ evalId, phase: 'written' | 'failed' }`. `S:82` adds four phase literals and `at`. Detailed per-ID `unconfirmed` results are already permitted by `C:45`; that does not amend the separate persisted summary enum. `S:92` also adds `outcome.observation`, whereas the final outcome shape lists `actedEvalId`, `receiptRef`, `heldOff` and `reasked` (`C:64`). Durable observation evidence is needed for the capture-off/no-declarations case; silently widening the final call wire is not a settled storage decision.

**Fix as written:** “Keep the final contract's `cronState.declarationsPhase` wire and its two phase values; retain richer result/reason detail in bounded phase diagnostics and the per-ID result, with timeout explicitly unconfirmed. Readers verify that the summary's evalId matches the check they are displaying. Do not add `outcome.observation` to the final call wire. Specify an immutable companion observation receipt under `agentBattles/{battleId}/callObservations/{callId}` and reference it through the existing `outcome.receiptRef`; create it atomically with the first observed transition, with owner-read/server-write rules, battle-lifecycle retention and the same calls-mode/deadline gates. Its explicit schema contains callId, nullable evalId, observedAtMs, nullable px, source and the replacement marker. Add its files, rules and capture-off fixtures to Build 0 before kickoff.”

That companion is a **proposed specification repair**, not an existing or already approved HEAD collection. If the author instead wants inline observation or expanded phase fields, the final-contract amendment must be explicit and separately blessed; this review does not amend C.

### R3-9 — The handoff still points to missing inputs and pre-#896 source lines

**Severity: P2. Carries R2-11.**

**Evidence — VERIFIED:** `S:3` names the absent `docs/design/CALL_RECORD_FIELD_CONTRACT_V1_3.md` and absent-on-main round-2 report. The actual final contract is `docs/CALL_RECORD_FIELD_CONTRACT_V1_3.md:1-3`. `S:121` asks the builder to report hashes after the build, rather than supplying the initial pinned package. The discovery expressly belongs to an older baseline (`docs/audits/20260923_PHASE0_COCKPIT.md:4`). Main's later instrumentation moved §3's central seams:

| Named operation | Old location carried in S | Verified current HEAD location |
|---|---|---|
| Per-battle capture/context outside try | `S:53`, 697–718 | `api/cron/agent-evaluate.js:866-908` |
| Initial fetch / required quote gate | `S:55,60`, 815–840 / 860 | `api/cron/agent-evaluate.js:1004-1018,1029-1042` |
| Augmentation fetches | `S:55`, 1235–1240 / 2235–2241 | `api/cron/agent-evaluate.js:1403-1411,2404-2411` |
| Forced execution-price replacement | `S:55`, 2063–2082 | `api/cron/agent-evaluate.js:2232-2251` |
| Prompt completion | `S:59`, 2458 | `api/cron/agent-evaluate.js:2628-2634` |
| Committed model executor return | `S:93`, 3271–3288 | `api/cron/agent-evaluate.js:3446-3463` |
| Final evaluation update | `S:71`, 4058 | `api/cron/agent-evaluate.js:4244` |
| Narration / capture finalization | `S:71,82`, 4090 / 4180 | `api/cron/agent-evaluate.js:4276-4290,4366-4372` |

**Fix as written:** “Before issuing the Build 0 prompt, commit or immutably link the exact round-1/round-2 review artifacts, correct the final-contract path, and pin source baseline plus spec/contract SHA-256 from committed bytes. Include the actual gate/default/mode-resolution requirements from §2 in the §3 handoff. Update the seam map against that baseline and cite both the operation and line. Declare older discovery anchors historical. The post-build report repeats these pins; it does not establish them for the first time.”

Neither missing report was copied into this branch: the authorized repository output is this one report.

## Verification and delivery boundary

- **VERIFIED:** source baseline, branch, clean starting worktree, committed-byte input hashes, recovered round-2 provenance, the requested ten-item closure matrix, and the cited current source seams.
- **Static only:** false/missing-hit examples, budget counterexamples, queue empty-set behavior and scan starvation. Future fixtures above are requirements, not claimed passes.
- **Report validation — VERIFIED:** a local artifact checker checked 139 explicit citation ranges for existing files, valid bounds and nonblank endpoints, both committed-byte hashes, all ten requested dispositions and the nine consecutively numbered findings; no failures. This is not a semantic proof or application test. Delivery stages only `docs/audits/20260924_COCKPIT_SPEC_V1_2_REVIEW.md`, then verifies the one-file commit, remote branch tip and clean tree after push.
- **Authorized delivery:** this report plus a byte-identical external copy under the session artifact directory, per `docs/BUILD_RULES.md:62`. No source/spec/contract edits, PR creation, merge, CI monitoring or follow-on build. Stop after the requested commit and push.

## The one thing most likely to be wrong

**That the timestamp attached to a frozen quote proves when that quote was examined.** The spec now preserves prices, but its non-model recipe can still combine a later fetched quote and later symbol membership with the initial quote-health instant. That would make a precise-looking “hit before expiry” receipt describe an observation that did not exist at that time.
