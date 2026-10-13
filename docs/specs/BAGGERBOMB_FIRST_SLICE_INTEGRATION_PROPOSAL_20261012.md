# BaggerBomb first-slice integration proposal

October 12, 2026. **PROPOSED; implementation and activation are not authorized by this closeout.** Source baseline: `433a19a4ef2fdc804c002f755ca2ef3686e18a18`. This supplements V1.1; D1, D2 and D4-D8 remain accepted directions. D3 and publication-policy approval remain open.

| Review conclusion | State |
| --- | --- |
| First slice | New fullday tiered agent-versus-embedded-CPU stock positions and held displays |
| Existing games, League, prescribed tournament agents, player V4, crypto | Preserve their existing contracts |
| Measured reward percentages and position freezes | Proposed adapters below; no runtime import exists |
| Emergency/trail/hurdle preservation | Pure unchanged-function controls pass; integrated preservation is unverified |
| Locks, wake frequency, model facts, banked points and results | Expected to change; require explicit acceptance and replays |

## Admission and authority

**PROPOSED:** Gate on an explicit new stock-scoring model stamp, battle duration `fullday`, tiered game mode, embedded CPU opponent, and stock asset type. Both the feature switch and persisted model stamp are required. An absent stamp preserves legacy behavior. A disabled switch stops new admissions; already admitted receipts remain readable and frozen. Review the exact rollback behavior before activation; rollback cannot silently reinterpret an admitted game as legacy.

Add a server-only admission adapter, provisionally `stockThresholdAdmission.js`, and a Node-clean reward/read adapter, provisionally `agentMeasuredRewardAdapter.js`. These names designate future files, not current implementations. The admission adapter validates the owner-approved publication rule and complete measurement receipt at the independently expected session. Until the documented publication acceptance window has opened, a new admission waits; it does not silently use an older session or a numerical fallback. Later integration must specify a bounded operational retry/availability path.

Admit a stock only with finite positive measured and effective percentages, a qualified current security, a complete current window, a valid entry/fill quote and its observation time. D3's proposed zero and positive-rounded-to-zero exclusions require owner adoption. Missing evidence makes the admission unavailable under D5. Catalogue corrections are a separate task: this proposal does not authorize any alias mapping.

Persist an immutable measurement input receipt and a position receipt keyed by `(battleId, side, positionId)`. Required fields: model/policy ID and hash; publication rule ID/hash and approval reference; canonical security ID/provider symbol; source session; whole snapshot ID and capture time; ordered input hash; raw rows/adjustment factors or an immutable replay reference; ATR14 dollars; unbounded measured percentage; separately quantized effective scoring percentage; fill price, quote time and committed entry time; side, tier/slot and slot version. The measurement receipt's audited `valuePct` remains the **unbounded measured percentage**; future gameplay `scoringPct` is a distinct field. The current auditor does not certify a quantized gameplay projection as a raw measurement receipt.

Re-entry creates a new position ID, freeze and reward history. A later complete provider revision creates a new input receipt; it never rewrites an admitted position. Agent and CPU may hold the same symbol with different fills/freezes. No scalar symbol map can choose authority between those receipts. Omit an ambiguous projection; a valid position receipt always wins. Missing/ambiguous new-model receipt means unavailable, never map/default fallback.

## Proposed writer and reader contacts

Every source anchor below was **VERIFIED** at the baseline. Every change and replay expectation is **PROPOSED**. Fenced functions are named to delimit future approval, not to request blanket replacement of `baseATR`.

| Current contact | Exact future slice and replay expectation |
| --- | --- |
| `api/agent/decide.js:824`, `:896`, `:934` | The ordinary tiered deploy builds both rosters and thresholds before `createAgentBattle`. Qualify each required held **stock** on both sides; leave bench and crypto trading units intact. Test a missing stock receipt on either side, quote loss, session transition during preparation, and no battle/cooldown consumption on refusal. `:1488` is prescribed tournament deploy and remains outside this slice. |
| `api/_utils/agentBattleService.js:117`, `:129`, `:154`, `:167`, `:169`, `:309`, `:323` | `createAgentBattle` owns fullday timing, agent and CPU portfolios, threshold projection and initial histories before `commitBattleDocWithPin`. Commit the model stamp, position IDs, validated fills and receipts together. Preserve existing activation-pin checks. Test races between qualification and commit, both sides sharing a symbol, unsupported mode, idempotent retry and absence of partial admission. Do not assume a later provider capture proves the original entry quote. |
| `api/_utils/agentSwapExecution.js:337`, `:380`, `:416`, `:441`, `:492` | `executeSwapServer` banks the outgoing score, creates the incoming asset and resets history in its update. Join the outgoing receipt/history by lifetime; qualify the incoming stock before mutation and persist its new ID/fill/receipt/history atomically with banking. Test same-symbol re-entry, swap failure, concurrent replacement, stale slot version, and outgoing banked points matching the last committed corrected score. Every route must use this common seam. |
| `api/cron/agent-evaluate.js:2071`, `:3713`, `:5063`, `:5337`, `:5796`, `:6155` | These six routes call `executeSwapServer`: risk, model, approved proposal, expired proposal, deterministic pass and gameplan. Each must carry current position identity and capture the committed receipt returned by the writer. Replay each route with unavailable incoming data and a competing writer. A prepared receipt is not committed-action evidence. |
| `api/cron/agent-evaluate.js:1191`, `:1240`, `:1304` | Replace the **new stock model's** scorer operands with its fill anchor, effective percentage and matching post-entry history on both sides. Keep the canonical scorer and reward constants. Persist separate side/lifetime reward histories with transactional identity rechecks; do not write a stale symbol peak into a replacement. CPU currently passes empty history at `:1250`; retaining CPU earned tiers is an explicit proposed change needing retracement replay. |
| `api/cron/agent-daily-scores.js:45`, `:136`, `:174`, `:230`, `:279`; `api/_utils/agentBattleService.js:43` | Daily banking currently queries all active battles and resets history. Add an explicit corrected-fullday branch that cannot daily-rebase the entry anchor or erase lifetime rewards. Reconcile final/current/banked components exactly once with completion. Test daily-job/evaluator/completion order permutations and retries. Multi-day/legacy reset behavior stays on its original branch. |
| `src/screens/AgentBattleScreen.jsx:195`, `:256`, `:262`, `:284`; `src/screens/battleView/selectWhyState.js:419`; `src/utils/researchAssetBuilder.js:70` | Held enrichment, six targets, Why panel and held research modal consume the same side/lifetime receipt and validated fill. New-model readers cannot use mutable symbol thresholds or the modal's default chain. Test identical ticker on both sides, different freezes, missing receipt, retained tier after retracement and a pre-entry session high that must not grant a reward. Bench research remains outside measured held-position authority. |

## Preserve calibrated units explicitly

**VERIFIED:** `evaluateRisk` currently derives one multiplier from one divisor (`api/_utils/agentRiskManager.js:124`) and uses it for emergency exits (`:127`), LOCK (`:149`) and stepped trail (`:164`). Passing a corrected scorer's returned `baseATR` through the existing evaluator call (`api/cron/agent-evaluate.js:1797`) moves all three. One replacement cannot satisfy D6.

**PROPOSED:** Keep persisted stock `baseATR` as its calibrated legacy trading unit and keep a matching calibrated peak/trough history. Compute that history from the existing risk observation/reference, independently of measured reward history. Add a narrow optional reward context to `evaluateRisk`; only its LOCK branch reads corrected reward distance/earned tiers. Preserve priority: emergency, VWAP, corrected LOCK, stepped trail, then remaining existing clauses. The measured adapter's scorer-shaped `baseATR` must never escape into a risk/hurdle call. Use explicit names `calibratedRiskPct`, `calibratedRiskHistory` and `scoringPct` at adapters.

| Retained consumer | Required operands and replay |
| --- | --- |
| Emergency and stepped trail: `api/_utils/agentRiskManager.js:115`, `:164` | Same entry return, calibrated divisor, SMA, preset and memory inputs. At -2%/7.52 the unchanged function returns HOLD; substituting 2 returns EMERGENCY_SWAP. At +7.9%/7.52 it returns HOLD; substituting 2 triggers trail. Replay the integrated adapter with the retained operands and matching action/reason. |
| Trailing guardrail: `api/_utils/agentGuardrails.js:712` | `computeTrailingDrawdownPct` multiplies the legacy peak by legacy `position.baseATR`. Its battle view must join **calibrated** history, never corrected history. Test split units, re-entry, peak retention and unchanged implied peak/forced threshold. |
| Hurdle: `api/_utils/hurdleAtr.js:26`, `:50`; evaluator `:1896`, `:3535` | Retain fresh percentile-derived hurdle unit and the frozen calibrated fallback. Never pass the measured scorer output as that fallback. Test fresh available, missing, malformed and valid zero legacy operands without changing existing hurdle semantics. |
| Baseline validation: `api/_utils/baselineValidation.js:40` | Keep calibrated quote-error tolerance. Measurement eligibility is an additional admission test, not a recalibration of quote validity. |
| Bench wake and prompt: `api/_utils/agentTriggerGate.js:109`; `api/_utils/agentEvalPromptAssembly.js:1502` | Keep bench daily return/legacy unit and existing weak-active condition. Label the unit honestly; no assertion that the percentile proxy is measured ATR. |
| Existing capture: `api/_utils/learning/captureReceipt.js:166`; evaluator `:2190`, `:2230`, `:3801`, `:3851` | Retain `entryATR`, `outgoingBaseATR` and legacy history meanings. Add scoring receipt/hash, effective percentage, fill quote time and lifetime-specific reward history. Capture the committed writer result. Test that old consumers still receive calibrated units, while corrected score captures match the written score exactly. |

## Explicitly changed decisions and downstream inputs

| Changed consumer | Replay expectations requiring acceptance |
| --- | --- |
| Reward LOCK and guardrail deferral: risk `:149`; evaluator `:1812`; `api/_utils/agentGuardrails.js:451` | HOLD can become LOCK when percentage moves from 4 to 2 at +1.8%. Review priority with simultaneous emergency/VWAP/trail/forced-guardrail conditions; confirm exactly which action defers and why. No promise of unchanged trading decisions. |
| Held wakes: `api/_utils/agentTriggerGate.js:61`, `:72` | Corrected negative multiples and bonus/penalty proximity change firing and cadence. Replay -0.5x and every +/-1, 1.5, 2 boundary, earned-tier suppression and price retracement. Record wake counts and resulting model-call schedule differences. |
| Prompt facts: `api/_utils/agentEvalPromptAssembly.js:1135`, `:1424`, `:1470` | Totals, multipliers, bonuses and next unearned reward change. Verify the same receipt/target as the row and LOCK. Review paired prompt/model decisions as changed inputs, not a preserved-model outcome claim. Any future split prompt renderer must meet the prompt-contributing registry rule. |
| Banking/aggregates/results: swap `:381`; evaluator `:1264`, `:1294`, `:6591` | Reconcile active + banked components, peaks, opponent score, win/loss/draw, downstream awards/stats/reflection/capture. Preserve legitimate zero and negative scores. Test evaluator/swap/completion races, idempotency and no double-credit. A larger reward can legitimately change the winner. |
| Display rounding (D3 proposal) | If cent-rounded targets become award authority, replay one tick below/at/above all six targets and every cent half case. Canonical badge/constants remain shared; any required scorer contact needs separately named approval. Do not implement a second reward schedule inside the adapter. |

## Later review gates

The next build request should name the limited admission, battle-shape, swap, risk LOCK, history, daily banking, evaluator/prompt and display contacts above. It must include the adopted D3 values, approved publication rule, alias/catalog dispositions and frozen model hash. This closeout supplies a concrete proposal and replay matrix; it grants no fenced implementation permission.

Before dormant merge, compare corrected receipts/projections using newly created games and exercise every writer race and legacy/off-mode path. Before activation, verify actual runtime scoring/display/capture and the explicitly changed trade decisions. Pure local controls do not substitute for integrated replays, decision-time fills or production observation. Keep existing games and historical results unchanged.
