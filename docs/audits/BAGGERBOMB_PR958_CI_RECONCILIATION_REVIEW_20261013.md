# PR 958 CI reconciliation review

Closeout: October 14, 2026, America/Chicago; owner brief dated October 13. **LOCAL CI RECONCILIATION PASS — DORMANT.** The complete hosted command passes locally on Linux under its exact Node/npm versions. The owner reviews the next hosted run and decides merge separately. Admission remains false; no production activation or data/control change occurred.

## Scope and provenance

Branch: `codex/baggerbomb-stock-thresholds-dormant-v1`. Starting reviewed head: `0254ddcc7c582729bc4a0a774b6fc01c455080f3`. Original base: `abe6870df5c0f7ca5bb1f6936607006e55acbe4a`. Fetch completed before remote comparisons. The existing draft [PR 958](https://github.com/fashraf94/TradeSeven/pull/958) was reused. The final pushed SHA is recorded in the accompanying delivery/report/ZIP manifest, avoiding a self-referential commit hash in this file.

The actual failed [CI run 38507659226](https://github.com/fashraf94/TradeSeven/actions/runs/38507659226), job `115668750536`, was downloaded read-only: four failures, 20,218 passes, 88 skips. All four failed suites reproduced at the starting head; the same 35 tests passed on the untouched original base under Linux Node20.20.2/npm10.8.2, `CI=true TZ=UTC`. These hosted integration failures differ from the four earlier Windows baseline failures preserved in the historical package.

## Repairs and preserved protections

| Failure | Scoped correction | Verification |
| --- | --- | --- |
| Derived-write census expected the original literal db argument | Census now describes `commitDb` selecting the stock adapter or original db, then the SAME original awaited `commitBattleDocWithPin` and activation pin. | Call/order/forbidden legs retained; new AST proof binds the actual adapter, awaited call and same pin; real lit adapter cutover refuses with zero writes. |
| Tournament flow-pin guard expected the earlier argument list | Source guard includes `beforeDeployment`; new AST guard requires both battle pins, pre-build pin ordering, deferred original projection call, awaited callback, 409/false abort and settlement-before-callback-before-create ordering. | Real generation/epoch refusal and generic fail-open/legacy parity tests remain unchanged and pass. |
| Nine unregistered write keys | Add only those exact keys at count1, after reviewing their actual targets, fields and guards. Register two existing source-count increases hidden behind the first scanner assertion. | Unchanged deny-by-default scanner: 581 sites, 330 registered keys; zero unlisted, drifted, stale or parse-error sites. |
| Two new scorer callers absent from stamp coverage | Explicitly retain `out.tierMultiplier` in the non-stock corrected swap rebuild; register total9 discovered callers (whole stock asset plus that rebuild). | Real opposite-stamp scorer/executor controls; original flat6 45/tiered75 control remains green; no multiplier or reward/risk unit changed. |

Source anchors: `api/_utils/compositionDerivedWritesCensus.json:32`, `compositionDerivedWrites.census.test.js:74`, `compositionGenerationFence.test.js:335`, `compositionProtectedStoresAllowlist.json:240`, `:450`, `flat6TierStamp.passthrough.test.js:143`, `stockThresholdAdmission.js:230`, and `stockThresholdAdmission.test.js:44`, `:133`, `:144`.

The only runtime delta in this repair is the explicit existing field on the non-stock scorer argument. `compositionGenerationFence.js`, `compositionProtectedStoresScan.js`, `api/agent/decide.js`, scoring constants, workflow/test configuration, admission default and adopted policy/rule tuple are unchanged from the reviewed head. No test was disabled, skip broadened, module exempted, fake source token added or legacy golden regenerated.

## Exact write registration review

Every following key is pinned at **1**, with substantive per-key notes in the allowlist:

| Key under `api/` | Actual destination and write |
| --- | --- |
| `_utils/agentBattleService.js::createAgentBattle::call:stockCreationDb#0::unresolved` | Decorates the db used by the original composition fence; atomic new battle and immutable inputs; original hypothesis side effects stay in the original callback. |
| `_utils/agentSwapExecution.js::executeSwapServer::call:executeCorrectedStockSwap#0::unresolved` | Stored-model dispatch to the separately registered battle update and optional immutable incoming input create. |
| `_utils/stockThresholdAdmission.js::appendInputs::create::unresolved` | Create-only `stockThresholdInputs/{snapshotId}` raw observation, fill, identity, hashes and attestation in the same battle creation transaction. |
| `_utils/stockThresholdAdmission.js::checkpointCorrectedDaily::update::unresolved` | `agentBattles/{id}`: daily committed score/evidence checkpoint and lastDailyResetAt only; recorded key is idempotent. |
| `_utils/stockThresholdAdmission.js::commitCorrectedScore::update::unresolved` | `agentBattles/{id}`: caller patch containing qualified corrected score/evidence/version/history alongside existing evaluator tick bookkeeping when present. |
| `_utils/stockThresholdAdmission.js::executeCorrectedStockSwap::create::unresolved` | Optional create-only incoming `stockThresholdInputs/{snapshotId}`, bound to a fresh lifetime receipt. |
| `_utils/stockThresholdAdmission.js::executeCorrectedStockSwap::update::unresolved` | `agentBattles/{id}`: tier/bench, roster version, once-only bank component, bounded trades, unavailable totals pending recomputation, and bound histories. |
| `_utils/stockThresholdAdmission.js::stockCreationDb::create::unresolved` | Atomic dark-fence adapter battle create; lit proxy forwards the original create and does not create a second battle. |
| `agent/decide.js::refuseUnsettledStockTournamentBattle::update::agents` | `agents/{id}`: ONLY temporary `deployingAt:null`, before durable tournament deployment writes. |

Creation checks admission selection, shared control epoch/policy, eligibility, effective approval and qualified observation/fill before its original fence writes; admission off makes no stock creation/collection calls. Maintenance of already-admitted games uses the stored model independently of the switch. Score, swap and checkpoint transactions recheck fresh active/model/roster state and immutable input replay; scores/swaps also compare score version. Swap lifetime/bank ownership rejects duplicate banking. No new listed site writes a composition authority store.

Existing tuple count increases: `agent/decide.js::handler::call:commitActiveRulesProjection#1::agents` **1→2** represents mutually exclusive ordinary/deferred tournament source calls to the same fence and same pin. `agent/decide.js::handler::update::agents` **15→17** adds the ordinary refusal's lock release plus prior cooldown restoration and the deferred projection refusal's lock-only release. Neither introduces a new runtime write in this reconciliation. Exact fields and the distinction from the tournament guard are documented in the allowlist.

## Independent review and refutations

Two isolated source trees per lens preserve v1 and final LF v2. All3,820 final hashes match. All3,813 unchanged files additionally match the actual starting Git blobs, with only seven canonical-LF repair files overlaid. Dependencies were linked only into isolated trees. Reviewers made no shared-source or Git changes.

Composition/lifecycle lens independently ran 96 focused tests, verified all nine keys/two counts, traced the unchanged original fence and rejected eight additional in-memory AST negative controls. Scoring/reward/UI/lifecycle lens independently ran 61 tests and exercised 18 canonical reward boundaries, real opposite-stamp banking, invalid models, corrupted committed context and missing-quote completion refusal. Cumulative source coverage includes original admission/receipt/context/writers, evaluator/capture, scorer, screen/research adapters and approved tournament guard; prior implementation and guard review evidence remains in the combined package.

| Finding | Disposition |
| --- | --- |
| New handler-count note inaccurately said both additional sites were lock-only | CONFIRMED, note corrected: ordinary refusal at `decide.js:812` also restores prior lastDeployedAt; separate tournament refusal remains lock-only. Both reviewers independently REFUTED the corrected annotation. |
| Score-write note omitted existing caller tick bookkeeping | CONFIRMED, note corrected to describe the entire caller patch through the evaluator Proxy. Both reviewers independently REFUTED the corrected annotation. |

No surviving blocker in either review lens. Ten separate Vitest source mutations all fail targeted assertions: deleted battle/deferred projection calls, lost dispatch/battle pins, unregistered key, extra write inside a listed key, dropped non-stock stamp, explicitly discarded stamp, dropped whole-stock stamp and ignored callback refusal. All3,820 hashes match after restoration. Reviewers independently inspected the mutation diffs/logs; none was counted as killed by infrastructure failure.

## Executed verification

Runtime: official checksum-verified Node20.20.2, npm10.8.2, Ubuntu24.04.1/WSL2; lockfile `npm ci`, `CI=true TZ=UTC`; Git archive with `core.autocrlf=false`. Local Linux execution reproduces the hosted runtime/command, while the new hosted result remains for the owner.

| Command/check | Result |
| --- | --- |
| Starting-head four failing suites | 31 passed, four failed; all failures match hosted findings. |
| Untouched-base same four suites | 35 passed, zero failed. |
| Six directly affected suites | 96 passed, zero failed. |
| `npm run test:run -- --maxWorkers=2` | **20,230 passed; zero failed; 88 pre-existing skips. 947 files passed, seven skipped. 363.10s.** |
| `npm run lint:gate` | Pass, exit0; zero warnings. |
| `npm run build` → explicit `vite build` | Pass, exit0; 12.71s. Existing chunk-size warnings retained. |
| Additional `npm run lint` diagnostic | Fails: 989 errors/127 warnings, exactly the starting PR head's issue multiset. Original base has976 errors/127 warnings; the earlier implementation accounts for13 additional errors. This repair adds/removes no default-lint issue. Required CI lint gate is separate and passes. |
| Mutations | Ten targeted Vitest mutations killed; eight independently executed AST controls rejected. |

The first complete local run used a Windows-converted CRLF archive and Chicago timezone, causing source/shebang/hash and timezone failures. It is preserved as a setup-invalidated run; source goldens/tests were not changed to accommodate it. Corrected LF/UTC full execution above is the certification evidence. Intermediate candidate and failed WSL temporary-path logs are also retained and explicitly labeled.

## Delivery boundary

The updated external report and one ZIP preserve every member of the earlier combined implementation/guard package byte-for-byte, plus this reconciliation's actual hosted log, command scripts, valid/intermediate test logs, untouched-base comparisons, lint/build, isolated findings/refutations, mutations, source snapshots/diffs and manifests. No dependency directory, credential or measurement ZIP is included. Final committed source is checked against the reviewed seven-file manifest and pushed head recorded after delivery.

No new hosted CI polling after push; no merge or activation. The code selector remains `STOCK_MEASURED_THRESHOLDS_ADMISSION_ENABLED=false` (`src/config/featureFlags.js:3201`) and registry activation authorization remains false. Production provider/publication/cron observations, live numerical certification and D3 remain separate/open.
