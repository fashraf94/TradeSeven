# Prescribed tournament stock settlement guard: approved follow-up review

| Verdict | Evidence and limit |
| --- | --- |
| VERIFIED LOCAL | 21 new behavioral cases pass; 142 focused tests across eight files pass. |
| REGRESSIONS | 1,523 pass, four fail, two skip across 64 files. The four failures are the same untouched-base failures recorded in the original implementation audit. |
| INDEPENDENT REVIEW | Both confirmed repair findings were independently refuted in frozen v3 trees. Both reviewers match 9/9 source/test/supporting-record hashes. No surviving in-scope blocker. |
| DORMANT | Actual admission selector remains false. Merge, production activation and hosted runtime qualification remain separate owner decisions. |

## Authority and baseline

The owner's direct follow-up reply explicitly approves the additional corrected-only refusal in `runPrescribedTournamentDeploy`, plus directly related tests/docs. It requires preserving all durable deployment metadata on refusal, releasing the temporary lock and leaving settlement to the qualified writer. This supplements the original prescribed-deploy exclusion; the [adoption record](../approvals/BAGGERBOMB_STOCK_THRESHOLDS_ADOPTION_20261013.md) records the exact authorization. It does not change gameplay policy, registry version, catalog/D3 or activation authority.

Started on `codex/baggerbomb-stock-thresholds-dormant-v1`, clean, at PR 958 head `48d38d16323121bcb4dd67e06eaedff403c2d954`. Fetched origin before remote comparisons: the PR branch matched; main had advanced to `d5d8fa9b26613b6ea711c4c6520715d29cb8bacd` through two unrelated audit/experiment files. No touched runtime source changed upstream. This is a follow-up on the approved PR branch, not a new branch or rebase. The original PR base remains `abe6870df5c0f7ca5bb1f6936607006e55acbe4a`. Final delivered head/remote equality is recorded in the external handover.

## Actual fenced edits and refusal

VERIFIED: `api/agent/decide.js:251`, `:297`, `:325` defer only prescribed tournament **projection persistence**, keeping original rule derivation, composition flow pin, `commitActiveRulesProjection` writer and generation/epoch rejection versus generic fail-open handling. Ordinary deployment remains on its existing projection path. No composition implementation or calibration table is edited.

VERIFIED: `runPrescribedTournamentDeploy` at `:1380` moves its existing bounded active-battle query to helper entry. At `:1393`, the stored dispatcher identifies an expired active corrected model or present invalid/unsupported stamp; refusal runs before the projection callback at `:1394`, original validation exits and durable decision/cooldown writes. It returns HTTP 503 with `reason: prior_corrected_battle_requires_settlement`, `retriable: true`, existing battle ID and `modelStatus`. It updates only `deployingAt: null` (`:1362` guard). No stale-field restoration, battle completion, scoring, reward-history or statistics write occurs.

The owner scopes this guard to **expired active** games for both supported and invalid stamps. Absent stamps use legacy. Supported or invalid snapshots that were unexpired at the check retain that checked expiry decision across the metadata await, so crossing expiry during that await cannot send them into legacy GC. Legacy retains its original cleanup clock. Qualified completion can settle the protected game; an organic retry then uses current prescribed deployment behavior. No settlement shortcut is introduced.

Read timing deliberately changes: successful valid requests still perform the same single bounded active-battle query (`agentId`, active status, `limit(1)`), now before durable persistence. Some early validation failures now perform this lookup where the old helper returned before reaching it. Legacy responses, durable writes, final metadata, prescription/selection, scoring and cleanup are preserved in the tested cases. This is not a claim of identical read ordering or a general repair of deployment concurrency/one-active-battle enforcement.

## Behavioral and regression evidence

Real handler, prescribed helper, stored dispatcher, composition writer, battle writer and qualified completion writer run with isolated optimistic Firestore doubles. Provider/model/auth/infrastructure are doubles. No production environment is loaded, game created or document mutated.

| Owner acceptance | Executed evidence |
| --- | --- |
| Corrected game protection / admission independent | Supported expired stamp refuses with simulated admission false and true. Actual code default is false. No provider/model calls or battle creation. |
| Invalid stamp refusal | Present null, empty, bad hash and unknown model refuse with `modelStatus: unavailable`; no legacy fallback. |
| Durable metadata and lock | Entire agent document equals its prior state except cleared `deployingAt`; full handler writes only lock acquisition/release. Battle, scores/history/completion and statistics remain exact. Concurrent agent edits are not restored from the stale input snapshot. |
| Missing/stale pointer / late appearance | Both prior and null `activeBattleId` cases; a corrected game appearing during rule reads refuses before projection persistence. |
| Expiry seam | Advancing clock past expiry during decision persistence cannot GC the supported checked snapshot. |
| Retry after qualification | Real canonical score/input qualification and `completeBattle` settle the prior game; subsequent prescribed deployment succeeds without touching its settled fields. |
| Legacy tournament behavior | Expired unstamped cleanup and calibrated prescribed creation; unexpired existing-battle response; group/ranking/prescription errors preserve original projection/write state. |
| Projection failure contracts | Generation/epoch rejection remains 409 before deployment writes; ordinary projection error retains legacy fail-open prescribed deployment. |

Commands/results:

- New `decide.stockSettlementGuard.test.js`: 21 cases; included in 142 passing focused tests across eight files. `tournament-guard-tests.log`.
- Original affected regression selection plus direct guard regressions: 64 files; 1,523 pass, four base failures, two skip. `regressions.log`, exact `regression-selection.json`.
- Explicit Vite production build passes in 11.40s. `vite-build-final.log`.
- Changed runtime/test-fixture ESLint gate passes with zero warnings. `lint-gate.log`.
- Exact policy/registry and false selector unchanged; staged whitespace/path checks before delivery.

The four unchanged failures are two tick-coherence golden cases, one eval-run source extraction case and one control-resolution line-ending golden. The original baseline logs remain linked from the main audit. A separately exercised static baseline-gate pin expected three cooldown restorations although prior `48d38d16` already contained four; it now pins four and explicitly documents that this new guard adds **none**. That is a test correction, not a new cooldown behavior.

## Immutable legacy goldens and test integrity

The legacy capture fixture was not regenerated or edited. Its file hash matches the pre-build snapshot; its pinned canonical-LF hash check also passes. `tournamentSettlementGolden.js` asserts exactly one correctly bounded active query and one rankings read/sequence event on each successful golden capture. It removes only the active-query ordering events before comparison. **Every document read, every write, every model request, response, transaction count, final document and all other access ordering remain compared.** Independent mutation probes demonstrate wrong query limits/counts, added writes/reads, response drift and moved rankings reads remain visible.

The two legacy golden suites classify this intentional guard-query timing difference; self-select goldens retain their original exact serialized comparison. Nothing in the helper or fixture can suppress a metadata-write difference.

## Independent review and refutation

Reviewers used separate path-distinct `git archive 48d38d16` trees under the external `tournament-guard-followup` evidence directory, with frozen delta manifests and dependency junctions. Shared source/Git remained read-only to both agents. v1/v2 failures remain evidence; v3 is the final repaired source. Supporting documentation wording was finalized after source review.

| Finding/control | Disposition |
| --- | --- |
| Late corrected appearance with null pointer allowed `activeRules` write before later 503 | CONFIRMED in v1, REPAIRED by deferring tournament persistence. Both v3 reviewers reproduce only lock/unlock and exact durable metadata on refusal. |
| Deferral after helper validation changed legacy invalid-group/missing-ranking/invalid-prescription projection writes | CONFIRMED in v2, REPAIRED by invoking guard then callback before original validation exits. Both v3 reviewers compare response, complete write arrays and final agent state against exact `48d38d16`; equal. |
| Callback could run before stock refusal | REFUTED: expired corrected/invalid requests invoke it zero times; mutation check below catches ordering reversal. |
| Generation/epoch or generic projection failure handling drifted | REFUTED by independent baseline comparisons and real-handler injected failure cases: original 409/409/fail-open 200 behavior remains. |
| Guard should reject unexpired invalid models | REFUTED as a scope interpretation: direct owner instruction says “For an expired active battle”; unexpired behavior is preserved, with no later legacy-GC fall-through. |
| Golden normalization could hide durable behavior drift | REFUTED by exact immutable fixture/hash, strict retained fields and independent added-write/read/response/query-order probes. |

Both v3 reviewers matched all nine reviewed file hashes and report no surviving in-scope blocker. The cumulative implementation had already passed the two required independent lenses; this follow-up refutes the newly approved contact and its integration seams. The available code-review tool provides CI diagnostics only, so no CI poll is presented as code review.

## Mutation lens and limits

The final mutating lens ran on its own `mutation-v3` snapshot after both reviewers finished; shared source is verified unchanged. All six mutants were killed: guard removal, invalid-stamp bypass, metadata clobber, omitted lock release, projection-before-refusal ordering and removed expiry pin. Each was restored before the next. Exact outcomes are in the external `mutation-results.json` and final handover.

The original ten mutants and numerical/arithmetic evidence remain dated verification; no broad production recollection is repeated. Hosted provider/publication/cron behavior, stochastic trades and reflection generation remain unexecuted. Admission stays false. Production activation, merge, catalog reconciliation and historical rescoring remain outside this guard task.
