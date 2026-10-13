# BaggerBomb stock thresholds: bounded dormant build specification V1

October 12, 2026, America/Chicago. **Final specification candidate for owner policy/contact adoption. No runtime build or activation is authorized by this document revision.** Reviewed closeout head: `4691ddb5dbadcf734a712c8480ca9e472a4ca201`; application source baseline: `433a19a4ef2fdc804c002f755ca2ef3686e18a18`. PR 956 remains open/draft. This document supersedes the earlier cent-authority proposal and ambiguous feature-switch wording.

| Review question | Contract |
| --- | --- |
| Award boundary | Theoretical unrounded target from the frozen effective percentage; cents are presentation only |
| Switch | Selects the model of a new supported battle only |
| Existing corrected games with switch off | Continue pinned scoring, swaps, history, banking, completion, prompts, displays, research and capture |
| Scope | New `baggerbomb_agent`, `fullday`, embedded CPU; stock positions, long only |
| Existing unstamped games / crypto / other modes | Their existing contracts; no migration or rescoring |
| D3 proposal | No bounds; once-only six-decimal percentage-point half-even; zero and positive-quantized-to-zero ineligible |
| Publication proposal | Approved server collector, complete current session window, documented publication observation, immutable receipts |
| Implementation gate | Owner adopts policy and exact contact list below, then explicitly authorizes dormant implementation |
| Activation gate | Separate owner decision after receipt, fill, lifecycle, parity and runtime verification |

## 1. Exact policy candidate and approval state

The normative machine-readable proposal is `docs/specs/BAGGERBOMB_STOCK_THRESHOLDS_POLICY_CANDIDATE_V1_20261012.json`. Its `approvalState` is `owner_adoption_pending_not_implementation_authorization` and `approvedPolicyRef` is null. These are not runtime admission credentials.

Reserved model ID: `stock_measured_atr14_fullday_v1`. Candidate policy content hash: `baa2b39688b673c93190540f500307ae7ad4aba7a07228ca23ba1f2afe1bf9f8`. Publication rule ID: `eodhd_us_completed_session_observation_v1`; candidate rule content hash: `3ad8e14b203acd660faba9b8ec7e78c7dcb9f312741ec04cd062bcf79741a85f`.

Hash the `policy` object and its `publicationRule` separately using SHA-256 of UTF-8 `stableStringify`: recursively sorted object keys, preserved array order, no whitespace. **VERIFIED helper:** `api/_utils/canonicalHash.js:20`, `:42`. Reject undefined, null required operands and non-finite numbers in a runtime policy/receipt schema before hashing. Metadata, approval receipt and the hash fields themselves are outside the hashed policy. Any semantic change requires new content hash and registry approval; no model can silently use the latest hash under an old stamp.

The Stage 1 method and offline proposed-rule hashes use their existing insertion-order `JSON.stringify` algorithm. They remain evidence references; they are not this runtime policy hash. Stage 1 has unresolved bounds/finality in its candidate policy (`api/_utils/measuredStockThreshold.js:5`) and must not be relabeled as approved production authority. Owner adoption must identify the exact JSON policy hash and publication-rule hash, not merely the prose title or a caller-supplied `final=true`.

D1/D2/D4-D8 are previously accepted directions. D3, the publication/attestation rule, rollback semantics and named fenced contacts below are proposed for adoption. No new reviewer recommendation is treated as a founder ruling.

## 2. Measurement, publication and revision contract

Use the isolated fourteen-TR simple average and fifteen consecutive exchange bars. For each row, apply positive finite `adjusted_close / raw_close` to all raw OHLC fields. Retain raw operands and factors. No percentile, blend, Wilder smoothing, extra multiplier, synthetic default, dropped gap or spliced adjusted fragment. OHLC tolerance remains exactly zero. Preserve full binary64 measurement precision; the independent decimal-rational reference remains verification-only.

Resolve the latest completed session independently at each **new position commit** using the pinned 2026/2027 exchange calendar and its canonical-LF hash `f03b061c7241fdc8b004c7fd616811457b488f29feb8bf618fa476c7b3ff14de`. The period contains fifteen consecutive sessions ending there; forming rows are excluded. Unsupported calendar horizon is unavailable pending a separately versioned calendar, not a weekend guess. Existing admitted positions retain their original freeze across later session completions.

The exact proposed publication rule requires all of the following:

1. Provider EODHD, `eod` endpoint, NYSE/NASDAQ US common stock with current provider identity and no unresolved catalog/security conflict.
2. One complete provider response covering all required dates, with validated OHLC/basis, provider symbol, request range/through-session, capture time and whole-snapshot/ordered-input hashes.
3. Capture at or after the scheduled close plus **15 minutes**, as documented for NYSE/NASDAQ. The expected source session must match the independently resolved closed session. Timing alone, a last-row date or free-text final attestation cannot qualify the inputs. [EODHD historical API](https://eodhd.com/financial-apis/api-for-historical-data-and-volumes).
4. Attestation by the owner-approved server collector running the exact registered policy/rule, with an immutable receipt and observation time. The runtime consumes this server-owned record; it never trusts an offline analyst sidecar, client-provided boolean or arbitrary authority string. The approval reference must resolve to the server's approved registry entry for the exact hashes.

At a just-completed session before the observation window opens, a new corrected stock admission is unavailable. Do not silently select yesterday instead. Return a retriable unavailable reason and permit a fresh request when evidence qualifies; do not queue a future-priced position or spin in an unbounded polling loop. Existing validated pricing and trading-session gates remain; this task does not adopt a new clock/freshness tolerance. Capture the actual accepted quote timestamp, observation source and committed fill rather than reconstructing them later.

Create a separate immutable input receipt for each later full snapshot, including refetches with unchanged values. Ordered-input changes produce a new measurement revision. Re-fetch the complete window after adjustment changes; EODHD documents historical recomputation. An admitted position never rewrites its receipt because a provider revises history. Later entries/re-entries must qualify their current complete snapshot under the pinned game policy. This is completed-session observation acceptance, not immutable-provider-history certification.

AVB, CTRA, EA, EQR, K, MMC, PARA and WBD remain unavailable for corrected admissions in the current catalog. No invented bars, silent aliases or default thresholds. The original full universe remains reconciled in audits; a narrower qualified admission set never replaces its denominator. Retirements, successor additions/deduplication and the same-security MMC/MRSH alias belong to a separate catalog task. Qualified stocks do not wait for missing discontinued-symbol windows.

## 3. D3 percentage and boundary contract

**Proposed for owner adoption:** no floor/cap. Store unrounded `atr14Dollars` and `measuredPct`; quantize `scoringPct` once to six decimal percentage points with decimal half-even over the shortest round-trippable decimal representation of the measured binary64 Number. Persist both the fixed six-decimal string and its finite numeric value; they must agree on replay. Examples: 1.2345665 -> 1.234566; 1.2345675 -> 1.234568. No intermediate rounding. A real zero is a valid measurement but ineligible as a divisor. Positive measured values quantized to zero are also ineligible; no epsilon, 1% substitution or inherited player bounds.

For validated fill `A > 0`, frozen effective percentage `p > 0` and canonical signed tier `k`, the theoretical target is `T(k) = A * (1 + k*p/100)`. Preserve the validated quote's numeric precision. Positive tiers cross at `Q >= T(k)`; negative tiers cross at `Q <= T(k)`. Equality counts. No currency quantization or new tolerance enters this comparison. The canonical signed tiers, reward points, conviction and base-point rules remain from `src/constants/baggerBombScoring.js:14`, `:25`, `:43`, `:58`.

One shared canonical reward context must own the unrounded numeric targets, current multiplier, crossed-tier evidence, retained lifetime extrema and next unearned target. Scorer, progress, proximity, reward LOCK, held row, research, banking and capture must consume this context. Do not independently regenerate a target from a rounded percentage or currency summary. For the pinned policy, unrounded target calculations use the same binary64 expression everywhere; exact detail uses its shortest round-trip representation. Serialized target numbers must reproduce the same boundary.

**Implementation constraint:** inverse price-to-return arithmetic can differ at equality through floating-point round trips. The canonical implementation must honor the direct theoretical boundary and keep its badge/extrema interpretation consistent; no added epsilon or cent snapping is permitted. The named canonical scoring contact in §6 covers only opt-in shared reward context for the corrected stock model. It cannot change default legacy behavior, reward points or tier constants. Demonstrating server/client equality and immediately adjacent quote behavior is a build acceptance requirement, not a claim that the current unadapted scorer already satisfies this contract. Do not copy the scorer into a new adapter.

Display percentage summaries at two decimals, with the six-decimal effective percentage and receipt in detail. Currency summaries use two decimals, decimal half-even, **presentation only**. Expose the exact boundary and quote precision in detail; identify rounded summaries as such. A displayed badge/LOCK/progress verdict derives from the same context that supplies those displayed values, rather than a second threshold lookup. A quote and a target can share the same cent summary while differing in the exact detail; the cent summary cannot grant or postpone a reward.

Boundary replays include all six signed targets, exact equality, the closest valid quote observations on either side at the actual feed precision, sub-cent targets/quotes, and binary64-adjacent helper inputs. If a theoretical target is not on the feed's decimal grid, test the bracketing quote values and separately test equality in the pure canonical helper. Include cent half cases proving presentation has no effect. No live quote precision is invented by this spec; replay fixtures must record the provider field precision actually consumed.

## 4. Creation selector, persisted dispatch and rollback

Proposed admission switch: `STOCK_MEASURED_THRESHOLDS_ADMISSION_ENABLED`, default **false** in the dormant build. Its sole model-selection role is creation of a new supported battle. The immutable `scoring.stockThresholdModel` selects behavior after creation. The runtime registry must retain each supported pinned model until all admitted games complete.

| Situation | Required route |
| --- | --- |
| New supported battle, switch false | Existing legacy creation; no new measurement collection/read/write side effects |
| New supported battle, switch true, adopted registered policy and all required stock fills/receipts valid | Commit corrected model and both-side position receipts atomically |
| Corrected creation selected but required evidence unavailable | Refuse creation; no battle, partial stamp, cooldown consumption or silent legacy fallback |
| Admission switch/policy changes before creation commit | Refuse that attempt; retry selects the then-current route. No mixed policy/game |
| Existing battle, model stamp absent | Legacy route, regardless of switch |
| Existing battle, supported exact corrected ID/hash | Pinned corrected-stock route, regardless of switch |
| Existing corrected game, switch off, incoming swap stock qualified under pinned model | Swap remains eligible; bank outgoing corrected score and admit fresh corrected lifetime atomically |
| Existing corrected game, switch off, incoming evidence stale/missing/conflicting | Refuse the swap; retain outgoing position, frozen receipt, bank and history unchanged |
| Present stamp null/malformed, unknown ID, unsupported version, mismatched hash, unsupported corrected scope, or bound receipt missing | Visible unavailable with concrete reason; no legacy/latest-model/default fallback and no model-dependent mutation |
| Crypto position inside a supported corrected game | Original crypto contract, explicitly typed; no measured-stock substitution |
| League, tournament agents, player V4, legacy multi-day, short position | Outside this corrected stock model; existing unstamped routes unchanged |

Turning off the admission switch is a rollback of **new corrected game creation**, not a kill switch for existing corrected scoring or swaps. No existing-game reader/writer consults it to choose reward units. Scoring, swaps, history, daily banking, completion, prompts, displays, research and capture all resolve the same stored model tuple. No position switches to the current registry default. A separate emergency trading suspension would need a distinct owner decision and behavior specification.

Recognized corrected games keep operating under their exact policy after switch-off; incoming positions still require current measurement/security/fill qualification under that pinned policy. A later approved policy applies to newly selected games only. Registry removal or data corruption must be unavailable rather than reinterpretation. No destructive migration, historical rescoring, automatic repair of a malformed model or downgrade to legacy is part of rollback.

## 5. Receipt shape and transactional lifecycle

Proposed server-owned fields:

| Field | Required identity/meaning |
| --- | --- |
| `scoring.stockThresholdModel` | Immutable `{ modelId, policyHash, publicationRuleHash, approvedPolicyRef, admittedAt }`; exact supported tuple and scope required |
| `stockThresholdInputs/{snapshotId}` | Create-only raw complete response, request/source/capture identity, ordered raw/factor hash, measurement and approved policy/rule attestation; replay reference must resolve to immutable bytes |
| Held stock `positionId`, `slotVersion`, `stockThresholdReceipt` | Bound to battle, side (`agent`/`cpu`), slot, symbol/canonical security ID and lifetime; receipt includes model/policy/rule hashes, input reference/hash, source session, ATR dollars, unrounded measured percentage, effective percentage string/number, validated fill and quote provenance, entry time |
| `scoring.stockRewardHistory[side][positionId]` | Post-entry corrected extrema, crossed tiers and observation identity; no pre-entry whole-session high/low credit |
| Calibrated risk history keyed to side/lifetime | Matching original risk unit and observation/reference; exposed through a calibrated compatibility view to existing guardrails |
| Symbol compatibility projections | Derived only; never authoritative for corrected readers. Ambiguous agent/CPU values are omitted rather than choosing a side |

Required numbers are finite; timestamps are explicit instants with timezone and a bound source/observation. Missing required evidence is not zero. Stock fill must be positive and validated by existing pricing policy. The measurement source session/capture time and the fill quote/entry times remain separate. A later quote/refetch does not attest an earlier committed fill.

Creation commits the immutable model, agent and CPU stock receipts, position IDs, fills and initial histories together after rechecking scope/policy/eligibility. Side-specific receipts may differ for the same ticker. Refusal performs no partial admission and releases existing deploy locks/cooldown effects as appropriate.

Each swap transaction rereads active status, stored model tuple, side/slot/version and outgoing position ID. It qualifies the incoming stock with a fresh fill before mutating, banks the outgoing score under its own receipt/lifetime, then creates a new position ID/receipt/history atomically. Re-entry cannot inherit former rewards. All six evaluator swap routes use this common writer; prepared inputs are not committed capture evidence. Duplicate/retried requests cannot double-bank or create extra lifetimes.

Every score/history commit path must compare the live model/position versions; a tick calculated before a swap cannot write its peaks, active score or prompt/capture facts onto the replacement. Use the transaction's current roster/model in aggregation. Missing corrected evidence makes the relevant score and dependent total/result unavailable, not an incomplete official total with zeros. Preserve legitimate zero and negative scores. Completion requires both committed operands and their supported model/evidence; no default draw or stats/awards/reflection from incomplete corrected operands. Historical legacy completion repairs remain outside this branch.

The corrected fullday daily-banking branch cannot rebase the fill or reset lifetime rewards. Daily banking and completion share idempotent component receipts/version checks so the same reward is credited once. Resolve actual committed session/quote opportunities via the existing calendar/scheduler evidence, not an invented final clock literal. Changes are constrained to fresh corrected games; no general lifecycle repair is authorized.

## 6. Exact proposed implementation contacts

**Not yet authorized:** this is the complete proposed contact list for the owner to adopt with a later dormant build request. Fenced contact includes scoring behavior and battle shape even outside fenced files. Source facts below are **VERIFIED** at the pinned application baseline; proposed modifications are narrowly described. Outside this list, report the need for further authorization rather than expanding the build.

| Contact | Allowed proposed slice |
| --- | --- |
| `src/config/featureFlags.js`; proposed `api/_utils/stockThresholdPolicyRegistry.js` and Node-clean `src/utils/stockThresholdModel.js` | Default-false creation selector, exact approved policy registry and persisted dispatch helper. Retain supported versions; no global latest-model fallback. Do not change any existing flag default or archetype table. |
| Proposed `api/_utils/stockThresholdMeasurementProvider.js`, `stockThresholdAdmission.js`; call isolated `measureStock`/normalization | Server GET/immutable input receipt collection and qualification only for selected corrected creation or supported corrected swap. No shared indicator mapper edits or offline auditor/reference runtime imports. Caller combines valid arithmetic with real registered publication authority; Stage 1's arbitrary export attestation cannot approve production admission. |
| `api/agent/decide.js:824`, `:896`, `:934`; `api/_utils/agentBattleService.js:67`, `:117`, `:154`, `:167`, `:169`, `:309`, `:323` | Ordinary tiered deployment and `createAgentBattle` model/receipt commit. Keep `buildThresholds`/legacy `baseATR` calibrated; corrected receipts are additive. Preserve activation-pin gates. Prescribed tournament deploy at decide `:1488` remains unchanged. |
| `api/_utils/agentSwapExecution.js:222`, `:337`, `:380`, `:416`, `:441`, `:492` | `executeSwapServer` pinned dispatch, outgoing corrected banking, incoming eligibility/fill/receipt and transactional position identity/history. Retain calibrated `baseATR` stamp and legacy branch. |
| `api/cron/agent-evaluate.js:826`, `:1197`, `:1247`, `:1269`, `:1308`, `:1335`, `:2417`, `:2456` and remaining `scoreUpdate` commits within `processAgentBattle` | Resolve stored model once per live snapshot; both-side scoring and separate histories; recheck every commit exit against model/roster version, including suppressed/model-skipped exits. No change to model/provider selection, signal/candidate ranking, tournament reservation or trading calibration. |
| Evaluator swap calls `:2071`, `:3713`, `:5063`, `:5337`, `:5796`, `:6155` | Thread bound position/model/evidence to the common swap writer and capture the committed result. All risk/model/proposal/deterministic/gameplan routes covered; no route-specific substitute scoring writer. |
| Canonical `src/utils/baggerBombUtils.js:535`; façade `api/_utils/agentScoring.js:224`; proposed shared canonical reward context | Opt-in unrounded fill/percentage/boundary context, matching lifetime history and equality semantics for corrected stock calls. Canonical points/tiers/conviction stay unchanged. Default signatures/legacy behavior remain supported. No independent scorer copy. Server and client must agree at exact/adjacent boundaries. |
| `api/_utils/agentRiskManager.js:89`, `:115`, `:149`; evaluator `:1797`, `:1812` | Add narrow corrected reward LOCK context at the existing priority. Emergency/VWAP/stepped trail/stagnation inputs retain calibrated units/reference/config. Do not feed scorer-shaped `baseATR` to risk. |
| `api/_utils/agentGuardrails.js:451`, `:712`; evaluator hurdle uses `:1896`, `:3535` | Supply measured locks and a matching calibrated risk-history view; retain hard percentage directives, implied peak calculation and fresh/frozen hurdle contract. No stop/hurdle recalibration. |
| `api/_utils/agentTriggerGate.js:61`, `:72`, `:109` | Corrected held reward multipliers/crossed-tier proximity change held wakes; retain bench daily-return/legacy-unit behavior and schedule rules. |
| `api/cron/agent-daily-scores.js:45`, `:136`, `:174`, `:230`, `:279`; evaluator `resolveCompletionDisposition` at `:6577`, `completeBattle` at `:6646`, existing completion callers/repair entry `:7002` | Corrected-only model dispatch, lifetime banking/idempotency and complete supported score operands at every completion entry. Preserve legacy/dark payloads and existing unrelated repair behavior. No historical data repair. |
| `api/_utils/agentEvalPromptAssembly.js:1135`, `:1424`, `:1470`, `:1502` | Corrected held facts/next unearned target/totals/LOCK use shared context. Bench units stay calibrated and accurately labeled. Any split renderer must enter the prompt-contributing registry in the same fenced splice; no unrelated prompt rewrite. |
| `src/hooks/useAgentBattle.js:72`; `src/screens/AgentBattleScreen.jsx:195`, `:262`, `:284`; `src/screens/battleView/selectWhyState.js:419`; `src/utils/researchAssetBuilder.js:70`; `src/components/draft/ResearchTabs/BaggerBombTab.jsx:31` | Transport immutable stamp/receipts and render by pinned model/side/lifetime, including switch-off. Held row, six targets, Why and held research share exact boundary context; no held default/fetch override. Legacy, draft/bench, tournament and crypto routes keep their existing contract. |
| `api/_utils/learning/captureReceipt.js:166`; evaluator committed swap captures `:2190`, `:2230`, `:3801`, `:3851`, `:5141`, `:5184`, `:5403`, `:5438`, `:5884`, `:5912`, `:6245`, `:6278`; existing tick-score capture `:1283` | Preserve legacy `entryATR`/`outgoingBaseATR`/calibrated history meanings; add exact model/position/input/fill/reward-context references and unavailable reasons. Changed aggregate scores must equal the actual committed writer result. No broad learning/tape redesign. |

Risk/hurdle/quote-calibration exceptions are not optional. `baseATR` remains the calibrated trading unit in held assets and existing captures; a scorer-shaped ephemeral operand may carry effective `scoringPct` only inside the reward adapter. Matching legacy peaks remain in calibrated units. The current trailing guardrail multiplies peak by `position.baseATR` (`api/_utils/agentGuardrails.js:717`) and cannot consume corrected peaks. The fresh hurdle continues `resolveHurdleAtr` (`api/_utils/hurdleAtr.js:50`), using the frozen calibrated fallback when unavailable. No broad replacement of `baseATR` is authorized.

## 7. Mandatory integrated replay and acceptance matrix

These are **required later tests**, not executed runtime claims. Use fresh corrected games and controlled decision-time quotes. Run Node-clean shared-context guards without mocks; canonical scorer ownership and constants remain shared. Preserve absent-model and off-mode output parity. The future build exceeds the small-diff threshold and must undergo the repository's multi-lens adversarial review, independently refuted findings, mutation checks and explicit Vite build before owner merge.

| Replay | Required evidence |
| --- | --- |
| New-game selection | Switch false produces legacy with zero new measurement side effects; switch true admits both sides only with approved exact policy/receipts. Flip before commit refuses cleanly. Missing either-side evidence never creates partial/legacy-fallback game. |
| Switch-off after corrected creation | Score both sides, trigger held wakes/LOCK, open Why/research, attempt an eligible swap, bank, run daily job and complete while switch is false. Every consumer stays on pinned model/hash. The eligible swap creates another corrected lifetime. A missing-data swap refuses without banking. |
| Dispatch corruption | Absent stamp uses legacy; present null/malformed/unknown/hash-mismatched/unsupported scope is unavailable at every reader/writer, including swap/research/completion. No zero/default/current-registry fallback. |
| Publication | Normal/early close, holiday/weekend/DST, exactly close+15 min, immediately before, forming/late/missing bars, provider failure, full revision and hash mismatch. Arbitrary analyst `final=true` cannot admit. Existing freezes survive later session/revision. |
| Numeric and D3 | Archived real split/dividend fixtures, independent arithmetic, malformed/zero inputs, six-decimal half cases, positive-to-zero, no bounds and no defaults. Current exceptions never qualify by alias substitution. |
| Six targets | Equality and immediate bracketing at actual feed precision, sub-cent targets/quotes, binary64-adjacent inputs, cent half cases and rounded summaries sharing a value. Crossed tier/progress/LOCK/next reward/scorer/row/research agree on the unrounded context. |
| Lifetime | Agent/CPU same ticker with different fills/freezes; re-entry; duplicate swap; pre-entry high/low excluded; reward retained on retracement; stale evaluator after swap cannot resurrect prior extrema or totals. |
| Risk and hurdle | Same calibrated operands/config/memory/peak reproduce emergency, VWAP, stepped trail, stagnation, hard-stop and trailing outcomes. Fresh/frozen hurdle parity. Prove measured reward output never replaces those operands. |
| Changed trading decisions | Quantify held wake/call cadence, corrected LOCK priority, guardrail deferral and paired changed prompt facts/model decisions. Accept changed outcomes explicitly; do not claim unchanged integrated trading. |
| Writers and totals | All six swap routes and every evaluator commit exit, concurrent/retried swap/evaluator/daily/completion, idempotent bank components, current roster/version recheck, both-side total reconciliation and capture equality. Preserve zero/negative official scores; incomplete totals/results stay unavailable. |
| Completion and legacy repair | Corrected active and repair entries use pinned model/complete operands; valid corrected winner/draw/awards/reflection reflect changed scores. Legacy payload/goldens and unrelated repair behavior remain unchanged. No missing-score default draw. |
| UI/runtime/off modes | Real held row and research quote precision, separate sides, supported-stamp behavior with switch off, unavailable rendering and canonical comparison results. Legacy/tournament/player/crypto fixtures and build pass. Runtime observation before activation remains separate from unit/browser fixture qualification. |

## 8. Evidence handover and stop

The original `baggerbomb-measurement-closeout-evidence.zip` is unchanged: SHA-256 `6a995dfa1bbb65ed9cda60a1dfa52518c89dcdd813e18279beaff872cd673c01`, 2,332,077 bytes. It contains the complete original raw export, original and schema-V2 JSON/CSV/Markdown audits, immutable comparison-read provenance and per-file hash manifest. Local verification reproduces 229 arithmetic windows, 228 proposed-rule qualifications, eight exceptions and three configured exclusions; the independent numerical-package review remains outstanding.

The separate spec-revision supplement contains this spec, corrected closeout/proposal, exact policy JSON, revised D3 JSON, citation/hash checks and a manifest linking the original ZIP. No original capture is reserialized. Catalog dispositions remain proposals for a separate task; live scoring and historical results remain unchanged.

Owner review must adopt the exact policy hashes, theoretical/display boundary contract, switch-off swap rule, server attestation authority and the §6 contacts before dormant implementation. Activation remains a later request after §7 evidence. This delivery stops at documentation/evidence handover and the pushed draft PR update.
