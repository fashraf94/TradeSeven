# BaggerBomb dormant stock implementation: adversarial review

| Verdict | Evidence and limit |
| --- | --- |
| LOCAL IN-SCOPE CHECKS PASS | The final focused replay passes 78 tests. Independent lifecycle and reward/UI reviewers refuted the repaired defects in separate snapshot trees. Ten targeted mutants were killed. |
| BROAD REGRESSIONS HAVE BASE FAILURES | 1,405 pass, four fail, two skip across 58 files. The same four failures reproduce at the untouched merged base. This is not an all-green suite. |
| DORMANT DELIVERY | `STOCK_MEASURED_THRESHOLDS_ADMISSION_ENABLED` is false. No production control, game, input, catalog or history was written. |
| ACTIVATION HOLD | The untouched prescribed tournament deploy helper can GC a corrected battle without qualification. Its additional fence contact requires owner approval. Production observation also remains open. |

## Baseline and authorization

VERIFIED baseline: fresh `origin/main`, branch start and HEAD were `abe6870df5c0f7ca5bb1f6936607006e55acbe4a`, the PR 956 merge, including reviewed head `848f0439c1c186ebd2027d2e313cd494fcf970c1`. The task began clean, then created `codex/baggerbomb-stock-thresholds-dormant-v1`. The cumulative diff was reviewed; no previous closeout branch was reused. Commit/remote identifiers are recorded in the external handover after delivery to avoid a self-referential commit hash here.

The direct owner authorization dated `2026-10-13T23:31:49Z` adopts the exact policy and V1 sections 1–7, including section 6 calibration contacts. It supersedes the historical pending-approval STOP for those contacts only. The numerical review attachment is dated evidence, not separate implementation authority. [Adoption record](../approvals/BAGGERBOMB_STOCK_THRESHOLDS_ADOPTION_20261013.md); [governing specification](../specs/BAGGERBOMB_STOCK_THRESHOLDS_DORMANT_BUILD_SPEC_V1_20261012.md).

VERIFIED registry: `api/_utils/stockThresholdPolicyRegistry.js:5` resolves `owner_baggerbomb_stock_thresholds_v1_20261013@v1` for model `stock_measured_atr14_fullday_v1` and publication rule ID `eodhd_us_completed_session_observation_v1`. Policy SHA-256 is `baa2b39688b673c93190540f500307ae7ad4aba7a07228ca23ba1f2afe1bf9f8`; publication rule SHA-256 is `3ad8e14b203acd660faba9b8ec7e78c7dcb9f312741ec04cd062bcf79741a85f`. Runtime import checks the rule ID and both hashes. The approved policy object and historical reports were not edited.

## Actual sanctioned contacts

These are edits, not merely calls to fenced functions:

| Contact | Corrected-only modification |
| --- | --- |
| `api/agent/decide.js:792` and ordinary creation catch | Defer ordinary GC of a corrected game to qualified settlement; restore cooldown on scoped admission refusals; return a retriable reason. Prescribed tournament helper is unchanged. `buildThresholds` stays calibrated. |
| `api/_utils/agentBattleService.js:69` / `createAgentBattle` | Prepare selected observations and atomically append saved model, both-side position receipts/history and input documents through the executed composition fence; normalize selected creation failures. |
| `api/_utils/agentSwapExecution.js:225` / `executeSwapServer` | Dispatch supported saved models into the atomic corrected writer. Keep the original legacy implementation. |
| `api/_utils/agentScoring.js:225` / `calculateAssetScoreServer`; `src/utils/baggerBombUtils.js` / `calculateAssetScoreV3` | Add optional canonical context argument; retain canonical tiers, points, conviction and base-score formula. No copied scorer. |
| `api/_utils/agentRiskManager.js:89`, `:115` / `evaluateRisk`, `evaluateRiskAction` | Supply measured reward LOCK at the existing priority, after emergency/VWAP. Calibrated risk operands/config remain. |
| `api/_utils/agentGuardrails.js:712` / `computeTrailingDrawdownPct` | Select side/lifetime calibrated risk history for corrected positions. Hard percentage stop/trailing directives retain their units. |
| `api/_utils/agentEvalPromptAssembly.js:1425`, `:1475` / `nextBonusCell`, `buildPortfolioCSV` | Render corrected held exact targets, frozen reward percentage and calibrated risk labels. Existing assembler holds the prose; no split renderer or new archetype-table import. |
| `api/_utils/agentTriggerGate.js:72` / `evaluateTriggers` | Use positive and negative shared-context proximity for held wakes. Bench remains on existing units. |
| `api/cron/agent-evaluate.js` / `processAgentBattle` and all six swap routes | Guard every score/history exit by live model, roster and score version; reconcile after swaps; record committed scores and receipts. |
| `api/cron/agent-daily-scores.js:47` / `resetBattleDaily`; evaluator `resolveCompletionDisposition`, `completeBattle`, GC repair callers | Pinned corrected checkpoints preserve fill/lifetime; complete only with supported committed operands and input evidence. Legacy payloads/repair remain. |
| Approved held UI/research and `api/_utils/learning/captureReceipt.js` | Saved side/lifetime context feeds row, Why, research and capture. Legacy capture fields retain calibrated meanings. |

New registry, collector, admission adapter and Node-clean context are direct section 6 contacts. The server-owned shared control implements the required cross-worker before-commit recheck. Its [schema and rollback contract](../specs/BAGGERBOMB_STOCK_THRESHOLDS_ADMISSION_RUNBOOK_V1_20261013.md) is part of this dormant delivery. No shared control was provisioned. `compositionGenerationFence.js`, `marketDataCache.js`, archetype tables, `TacticalRow`, Firestore rules and prescribed tournament deployment were not edited.

## Independent review method and dispositions

Two independent agents reviewed lifecycle/atomicity/authority and arithmetic/reward/risk/UI/test-integrity respectively. Each used a path-distinct `git archive` baseline extraction with the implementation overlaid and hashed. Neither wrote source or Git in the shared checkout. Repairs were overlaid only between completed review turns; each review used its frozen manifest. Both final reviews matched 31/31 source/test/approval file hashes. Final settlement and risk/prompt test-only deltas were separately supplied to the respective reviewers. The lifecycle reviewer identified a weak timestamp test; advancing its clock made a timestamp replacement observable, and the reviewer refuted the weakness. The reward reviewer independently replayed the three paired cases and refuted a wrong-divisor control. Legacy prompt goldens remain the byte-parity guard; the new prompt case checks changed facts. Supporting audit/runbook documentation was added after source review.

Evidence root outside the repository: `C:/Users/fashr/.codex/visualizations/2026/10/12/01a131ef-f52d-7340-b38d-0e11fedd8d19/dormant-implementation`. It preserves distinct `baseline-lifecycle`, `baseline-reward-ui`, three revision trees for each lens and `mutation-v3`, manifests, repro JSON and logs. Earlier failing probes remain dated evidence; they are not overwritten to look like final success. The final follow-up refutations are recorded in the external handover.

The exposed `mcp__code_review` capability reads CI diagnostics; it provides no code review function. It was not used to poll CI. The operational multi-lens independent refutation requirement was completed with isolated reviewers rather than claiming that a CI diagnostic call reviewed code.

| Finding or negative control | Disposition and concrete evidence |
| --- | --- |
| Historical real-time quote could bind a new fill | CONFIRMED, repaired. Old 2025 quote was initially admitted; final collector refuses `quote_precedes_completed_source_session` against independently resolved completed close. No invented extra age literal. |
| Delisted identity could qualify | CONFIRMED, repaired. `IsDelisted:true` initially passed; final collector requires exact false plus symbol/market/common-stock identity. |
| Whole immutable observation identity/fill mutation could escape replay | CONFIRMED, repaired. Full observation hash and receipt identity/fill bindings now refuse before score writes. Raw volume is preserved even when ATR price hash matches. |
| Stock-to-crypto bench entry retained / short crypto misclassified as stock | CONFIRMED, repaired. Incoming crypto is removed from its bench and retains the typed legacy direction; short incoming stock refuses. |
| Historical evaluation score row was overwritten by a later corrected tick | CONFIRMED, repaired. Trigger-skipped replay retains the prior `{active:3,banked:4,total:7}` entry. New tick captures its own committed totals. |
| Agent swap replaced same-symbol CPU market quote with agent fill | CONFIRMED, repaired. Independent final probe keeps CPU points 68 before/after at quote 106 while the fresh agent lifetime scores zero at its validated fill 103.27. Marker is position-specific. |
| Dark creation could miss a selector flip after ranking read | CONFIRMED, repaired. Final independent interleaving returns `creation_selection_changed` with zero game/input writes. Both executed dark and lit composition paths are guarded. |
| Code-only rollback cannot stop a warm true worker | CONFIRMED, repaired with shared control. Disable or epoch change during transaction retries gives zero writes. False selector still performs zero control reads and zero collector calls. Operational rollback must disable/advance shared control first. |
| Ordinary DB/control error consumed cooldown | CONFIRMED, repaired. Selected control/commit errors normalize to scoped retriable refusals. Exact-source review verifies previous `lastDeployedAt` restoration; legacy/tournament/hypothesis error behavior stays separate. |
| Inverse-multiplier arithmetic missed exact signed equality | CONFIRMED, repaired. Direct signed price comparisons award all six equality targets; immediately adjacent binary64 values bracket them. Server/client canonical scores match. |
| Invalid ISO dates/times admitted dispatch/context | CONFIRMED, repaired. Feb 30, 24:00 and invalid minute values remain unavailable instead of normalizing through Date.parse. |
| Negative held proximity did not wake | CONFIRMED, repaired. Negative near-tier fixtures wake under retained direct tiers; calibrated emergency retains priority. |
| Corrected row could use legacy fuse authority | CONFIRMED, repaired. Approved screen now uses corrected `StockDispatchRow` and six exact targets; unlisted `TacticalRow` stays unchanged. Real SSR row/Why/tab exercise this route. |
| CPU held research might resolve through agent lifetime | REFUTED. `quotePosKey` survives held enrichment and takes precedence in research resolution. Side/position context travels with the selected held asset; distinct fills retain independent contexts. |
| Altered stored receipt/context remained displayable | CONFIRMED, repaired. Receipt content, context content, history and version bind committed details. In-range quote mutation 107→105 returns `committed_context_content_mismatch`; aggregate qualification also fails. |
| Missing current quote kept stale valid detail | CONFIRMED, repaired. Commit replaces it with explicit unavailable context and total null. |
| Context binding repair might recurse | REFUTED. Reviewer executed 100 repeated valid detail/aggregate calls. The content helper serializes contexts without calling the predicate again. |
| Analyst `final=true`, serialized authority or mutable collector objects could admit | REFUTED controls. Private in-process collector brand/digest rejects clone or postcollection mutation; Stage 1 measurement remains `finalization_unproven`, with runtime publication separately qualified. |
| Metadata could overwrite banked score/new identity; identity flag off could accept stale outgoing lifetime | REFUTED controls. Authoritative corrected fields follow metadata; model/roster/version/outgoing lifetime checks are unconditional. Duplicate swap/stale tick writes nothing. |
| Measured reward replaced calibrated baseATR/risk history/hurdle | REFUTED within paired calls and source inspection. Paired emergency/VWAP/stepped-trail/stagnation and hard stop/trailing tests use equal calibrated operands. Deliberately different reward/risk peaks select calibrated history; fresh/frozen hurdle helper retains its units. Existing regressions pass. Reward LOCK intentionally changes trading choices. |
| New split prompt renderer lacked honesty registry entry | REFUTED. No split renderer was introduced; prose stays in the existing assembler. Node-clean context imports are unmocked in dependency-surface tests. |
| Saved tuple pinned rule hash without explicit rule ID | TIGHTENED during final registry verification. Stored models/receipts/attestations now require the adopted ID. Both reviewers independently reject missing/null/unknown IDs, including control and swap with zero writes/collection; 31/31 final hashes match. |
| Prescribed tournament GC can terminate a corrected battle without qualified operands | CONDITIONAL OPEN CONTACT. The untouched internal helper queries agent active battles and can reach a corrected game. Browser reachability was not established. Narrow corrected-only refusal was prepared outside the repo and submitted for owner approval; it was not applied. |

## Acceptance evidence

All implementation replays use isolated data. Market HTTP, model decisions, infrastructure and dormant manual/copilot modes are simulated where necessary; actual corrected transaction/scoring/capture/completion writers run. No fixture claim is a production cron/runtime claim.

| V1 matrix row | Executed evidence and limit |
| --- | --- |
| Selection / rollback | False selector zero measurement/control calls; both-side receipts/input atomicity through dark/lit executed composition fence; selector/shared-control/epoch/eligibility changes refuse zero writes; cooldown exact-source probe. |
| Existing corrected switch-off lifecycle | Selector remains false for both-side score, held wakes/LOCK, real rendered Why/research, qualified and missing-data swaps, daily checkpoint, zero/win/loss completion and capture. Saved tuple dispatch remains independent. |
| Corrupt dispatch/evidence | Null, malformed, unknown tuples, receipt/content/hash mutation, missing input/quote and stale versions stay unavailable; no legacy/current-policy/zero fallback. |
| Publication | Normal/early/DST close+15 equality and preceding millisecond, independent calendar/holiday/weekend reference tests, missing/incoherent/forming/revised/provider/identity/attestation cases. Full observation revisions remain distinct. Calendar source hash is pinned. |
| Arithmetic / D3 | 27 reference/auditor tests include archived real AAPL split/dividend arithmetic. Six-place half-even, true/rounded zero refusal, unbounded examples and all 11 configured unavailable/excluded symbols. D3 catalog decisions remain open. |
| Six boundaries | All signed targets at equality and binary64 neighbors; sub-cent and same-cent summaries; canonical server/client badges/score, next-target/progress context. Real row/Why/tab share stored exact context. |
| Lifetime / writers | Separate agent/CPU fills/freezes, retained tiers on retracement, pre-entry extrema excluded, fresh swap/re-entry identity, duplicate and stale rejection, transaction retries/roster/version conflict, daily idempotency. Six evaluator swap routes and six score exits run actual corrected writers. |
| Risk / hurdles | Paired corrected/legacy emergency, VWAP, stepped trail, stagnation, hard stop and trailing calls pass with matching calibrated history; fresh/frozen hurdles retain 4/2.5 percent operands. Existing regressions and static wiring reviewed. Corrected reward LOCK and wakes intentionally differ. No stochastic trading parity claim. |
| Totals / completion | Actual committed zero, negative and missing score propagation; committed capture equality; real draw/win/loss career updates and reflection queues, duplicate completion; qualified bare GC repair with a distinct later clock; concurrent roster change blocks terminal/career writes. Reflection generation is not executed. Mastery/legacy repair regressions remain unchanged; these corrected cases use the dark mastery flag view and do not execute awards. Pending prescribed GC contact prevents whole-system activation certification. |
| UI / modes | Real SSR corrected row, WhyPanel and research tab; absent-model legacy and corrupt evidence unavailable; existing tournament/player/crypto/off-mode regressions. SSR/infrastructure mocks do not establish a live browser or production observation. |

Measured decision change: fixed 101-quote grid, fill 103.27, calibrated `baseATR=2.5`, frozen reward percentage `2.000000`, moves −4.0% through +6.0% in 0.1% increments. There are **23 differing risk actions**, each involving reward LOCK, and zero non-LOCK differences on that grid (null intraday input, empty memory). A separate paired real assembler/risk check at fill 100/quote 101.8 exposes exact next target, measured LOCK and the unchanged 2.5% risk label, versus legacy HOLD. Negative wake tests show changed near-tier facts. Six integrated model routes use controlled fixture responses. These synthetic values do not certify live provider tick precision, live call frequency or stochastic model decisions, and do not claim identical trading outcomes.

## Verification commands and results

Commands use the bundled Node 24 runtime and the existing dependency cache. Vite/Vitest dependency-cache writes were permitted explicitly. No installed package or production credential changed.

| Check | Result | External evidence |
| --- | --- | --- |
| Final focused Vitest: context, admission, evaluator, rendered UI and battle service | 78 passed / five files | `final-acceptance-tests.log` |
| Affected broad Vitest regression selection, repeated after final tuple change | 1,405 passed, four failed, two skipped / 58 files | `regressions-delivery.log`, `regression-selection.json` |
| Untouched base reproductions | Same four failures | `baseline-coherence.log`, `baseline-regression-gaps.log` |
| `node --test scripts/threshold-audit.verify.mjs scripts/threshold-closeout.verify.mjs` | 27 passed | `arithmetic-tests.log` |
| Explicit `node node_modules/vite/bin/vite.js build` | Passed, final 45.57s | `vite-build-delivery.log` |
| ESLint gate on changed runtime files | Passed, zero warnings | `lint-gate.log` |
| Whitespace / exact tuple / flag / source manifests | Checked before commit; final identifiers in external handover | final verification manifest |

The four base failures are two tests in `agent-evaluate.tickCoherence.test.js` (golden hash and anti-vacuous names), one in `agent-evaluate.evalRunFirestore.test.js` (source block extraction), and one in `agent-evaluate.tickStamps.pins.test.js` (existing control-resolution golden line endings). They were not silently fixed or reclassified as passing. Narrow source guards updated by this implementation preserve legacy swap argument/pin checks and explicitly classify the added helper consumers.

## Mutation checks

Mutations ran last in `mutation-v3`, never the shared checkout. Each mutant was restored before the next. All ten produced nonzero tests as intended (`mutation-results.json`):

| Mutant | Guard killed it |
| --- | --- |
| Positive direct equality `>=` changed to `>` | Signed equality canonical context test |
| Full committed context-content check disabled | Altered stored quote/detail test |
| Score-version checks removed | Retried concurrent score writer test |
| Completion predicate forced true | Missing committed evidence completion tests |
| Shared control comparison removed | Warm-worker disable/epoch test |
| Agent fill overwrote shared current quote | Same-symbol CPU lifetime/quote test |
| Trailing guard read reward history instead of calibrated risk history | Paired hard-stop/trailing-history test |
| Prompt labeled measured percentage as calibrated risk ATR | Paired real assembler facts test |
| Bare GC repair replaced original completion timestamp with now | Distinct-clock qualified repair test |
| Rule ID removed from saved-model tuple guard | Null/unregistered rule-ID tests |

## Remaining limit and stop

The direct brief says prescribed tournament deployment remains unchanged. Its GC helper (`api/agent/decide.js:1341`, active-battle GC near `:1427`) is therefore an additional fence contact. A concrete corrected-only refusal patch was submitted for owner decision in `additional-tournament-gc-contact.txt`. Pending approval, this draft is reviewable dormant implementation with an explicit activation blocker. No unstamped tournament behavior was altered.

Production activation needs separate authorization, actual provider/publication and cron observation, and the shared rollback contract. This task creates no live game, flips no flag, writes no production document, migrates no history, changes no catalog, merges no PR and polls no CI.
