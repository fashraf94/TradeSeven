# Cockpit Spec V1 — adversarial review

**Date:** 2026-09-23. **Disposition:** revise Build 0 before deriving its build prompt; stop Build 1 at its prerequisite and lifecycle gaps; revise Build 2's integration plan.

| Build | Verdict | Reason |
|---|---|---|
| 0 | **REVISE** | Section 3 contradicts the dark-merge guarantee and the ruled record-kind set, and leaves check identity, I/O bounds, encounter safety and schedule resolution insufficiently specified to build safely. |
| 1 | **STOP** | The deferred-beat prerequisite is absent at this baseline, and the proposed sweep, single-slot protection, expiry and hold-and-re-ask mechanisms do not yet establish their promised behavior. |
| 2 | **REVISE** | The layout is achievable behind the flag, but the spec does not fully gate the shipped scroll/state paths or supply the records, readable risk data and reliable chat anchors its tiles require. |

## Baseline, inputs and evidence limits

- **VERIFIED:** worktree `C:/Users/fashr/.codex/worktrees/4ddd/portfolio-duel`; initially clean, detached at `591b714d90a72ed6e8e5604f19a2c0fff3388fc4`. Ran `git fetch origin` before comparing remote refs; its first attempt was denied access to shared Git metadata, and the authorized retry succeeded. Created `docs/review-cockpit-spec-v1` here from fetched `origin/main`, also `591b714d90a72ed6e8e5604f19a2c0fff3388fc4`.
- **VERIFIED:** since discovery baseline `2a1a16b1ccb56baa63fb4fa8e8d92f79b3a6199d`, HEAD adds only the discovery and five design documents in PR #895. There is **no source, rules, index or schedule delta**. Discovery source anchors therefore have not drifted. The discovery and CR sheet are now on main; the fallback branch was unnecessary.
- **Input-location discrepancy:** `docs/inputs/cockpit/` is absent in this worktree and in HEAD. Read the two supplied files from `C:/Users/fashr/Downloads/`; did not copy or commit them. Below, **Spec** means `COCKPIT_SPEC_V1.md`, SHA-256 `8e72e11a55681ae7f2657124da3db07b159fac591abe7e40d4251152a2e6ba8b`; **Contract** means `CALL_RECORD_FIELD_CONTRACT_V1_1.md`, SHA-256 `5a2d14b48e8cda05e887478d79af7d879337762aae843513768fc3cd78312652`. Their line numbers refer to those exact files. **D** means `docs/audits/20260923_PHASE0_COCKPIT.md` at review HEAD.
- Read D first, then the spec, ruled V1.1 contract, CR-1–CR-14, V3/V4 and BUILD_RULES. The user's confirmation that all CR rulings are approved governs despite the sheet's recommendation wording. Contract V1.1's later amendments govern the older CR-4 identity and proposed horizon table. Embedded build/merge/flip instructions are review material, not authorization to execute them.
- **VERIFIED** below means document or source text inspected in this review. Failure sequences and proposed fixes are **static inferences**, not executed reproductions. No tests, mutation probes, build, model/provider requests, production queries, deployment, flag changes or source changes were performed. Builds 1 and 2 were reviewed for compatibility and lifecycle completeness, not line by line. This report is the sole repository artifact.

### Corrections to the discovery itself

1. **D:145 says `evalId` is minted before the model call. It is minted after it.** The request is `api/cron/agent-evaluate.js:2489-2501`, validation/acceptance is `:2540-2550`, and `evalSeq`/`evalId` are computed at `:2740-2741`. They become durable only with `:3986` and `:4058`. The admission transaction at `:638-689` reserves the capture `tickSeq`, not `evalSeq`. This matters to R-4, not merely to wording.
2. **D:40 and its repeated `DARK_BY_DESIGN` advice do not apply literally to a string mode.** `src/config/flagPinGuard.test.js:178-183` explicitly excludes string modes, and `:355-357` rejects unknown registry keys. The direct string-pin precedent is `src/config/anticipationThresholdLintFlags.test.js:35-63`. R-8 supplies the executable route.
3. **D:85 describes the anticipation prose as a Gemma call too generally.** At grounding `on`, `api/_utils/voiceLayerAnticipation.js:200-201` selects the code-composed path; `:114-119` and `api/_utils/voiceLayerGrounding.js:950-985` build the note without Gemma. D:85 does name this branch, but its unqualified narrator summary is unsafe to carry into a build whose UI requires grounding `on`. See R-13.

The discovery's missing R6 table is resolved on paper by Contract §5. It is not evidence that a schedule resolver has since shipped; no source changed.

## Findings

### R-1 — The prescribed capture changes break the `off` guarantee

**Spec:** §3.1(4), §3.4(1,8), `Spec:34,45,52`. **Severity: blocks Build 0.**

**Evidence — VERIFIED:** Contract:95 requires the battle document, tool schema, prompts and tick record to match HEAD at `off`; CR-3 requires the new shape's version bump (`docs/design/COCKPIT_RULING_SHEET_POST_PHASE0.md:13`). D:137-141 identifies the capture extension. At HEAD, `captureConfig.js:38` exports version 1, and `api/_utils/tickCapture/captureWriter.js:175,208` writes that constant into both bodies and permanent records. The spec instructs version 2 and an unconditional permanent `calls` property. Capture is already enabled (`src/config/featureFlags.js:2695`).

**Consequence:** even an empty declaration result at `CALL_RECORDS_MODE='off'` produces a different record if §3.1(4) is followed. A conditional tool builder fixes the schema side only. Skipping the calls writer also does not prevent an encounter `update` against calls left from an earlier shadow period. The test in §3.4(1) omits the battle-document equality named in the contract. Build 1 repeats the risk: Spec:62 deliberately adds menu entries/moves goldens, but `api/_utils/voiceLayerPrompt.js:2793-2799` renders the whole allowlist independently of a calls flag; gating only the new calls block at Spec:63 will not preserve the old prompt.

**Fix as written:** “Ship `CALL_RECORDS_MODE='off'`. Resolve it once per check. At `off`, perform no calls reads, mints, flips, joins, counters or extra battle writes; omit the `calls` key entirely and emit the legacy capture shape/version. At `shadow`/`on`, emit the v2 shape, including an empty `calls` array when appropriate. Register both serialization versions explicitly. Compare the complete tool request, every battle write and both capture outputs with a frozen pre-change fixture under identical injected clocks/IDs. Include a rollback fixture containing existing calls. Do not regenerate the legacy goldens. Apply the same invariant in Build 1 to new menu-family availability and rendering, not merely the calls block.”

### R-2 — Build 0 invents two durable kinds and leaves the allowed kinds incompletely mapped

**Spec:** §3.1(2), §3.4(2-3), §5(4), `Spec:32,46-47,72`. **Severity: blocks Build 0.**

**Evidence — VERIFIED:** Contract:10 defines one family with exactly `called_shot`, `confirmation`, `pick`; it does not qualify these as merely “directive-bearing.” Spec:32 adds `watching` and `ask` records under that family and calls them read-only. Contract:22-25 gives `calledShots` the condition/horizon/default fields but gives `fork` only `slot`, `swapOut`, `options`, `said`; `playerAsk` has no horizon or lifecycle discriminator. V3:29,32 expects offered answers on research objectives, which “never file” in Spec:32 does not implement. D:81,285 distinguishes nested writer validation from the model schema.

**Consequence:** following the spec changes the ruled joint contract and the pilot's enum. Even after removing those additions, a builder must invent when a shot becomes a confirmation and how a fork obtains the shared fields or their inapplicability. “Strict nested shape” does not specify that discriminated union.

**Fix as written:** “Persist only the three Contract §1 kinds. Remove the claim that `watching` and `ask` are approved durable kinds; keep their model output out of this collection and defer their durable UI source until separately specified. Include a per-kind source-to-record table: direction/default-to-kind mapping; required, optional and inapplicable fields; fork option/swap-out/slot binding; horizon/default derivation; malformed-row isolation; and the stable ordering used for `n`. Missing fields may not be fabricated from `said`. A malformed row must not discard a valid sibling or alter the accepted trade decision.”

### R-3 — Two seconds per call does not bound the new work on the trading path

**Spec:** §3.1(2-3), §3.3-3.4, `Spec:32-33,42-53`. **Severity: blocks Build 0.**

**Evidence — VERIFIED:** D:147-149 already flags C-9 wall time. The copied helper, `api/_utils/intraday/evaluatorHook.js:20-23,45-53`, races a single write against a timer; it does not cancel that write. The spec supplies no record count/size cap, no collection-read deadline, no flip deadline and no aggregate budget. The existing admission calculation reserves transport and completion time (`api/cron/agent-evaluate.js:2358-2371`); the final update is `:4058`, followed by narration and the budget-gated anticipation/capture tail (`:4114-4124`, D:147). The 120-second eval lease is shorter than the 290-second request budget (`:169-170`).

**Consequence — inferred:** a sequential implementation can add approximately `2 seconds × call count`, plus the unbounded read and updates. A parallel implementation still needs an explicit concurrency/volume bound. The 12,000-token input budget test does not measure these costs or the model's larger output. Catching only `writeCalls` leaves query, validation and flip exceptions able to fail the tick. A timed-out write can still land later.

**Fix as written:** “Give the entire calls phase one aggregate deadline, including the query and every mutation, and reserve it before starting the model call. Define numeric caps for declarations, serialized record bytes, outstanding calls read and write concurrency in §3. Bound and isolate the entire phase; a calls failure never changes the trade, skips its final update or steals its completion reserve. Return a per-ID result distinguishing confirmed commit, rejection and unconfirmed timeout; log bounded typed failure counts. Add delayed-query, many-record, partial-failure, thrown-validation and late-write fixtures. State the measured request/output and wall-time margins separately.”

### R-4 — Deterministic IDs are not an idempotent publication protocol

**Spec:** §3.1(2,4), §3.4(2), `Spec:32,34,46`. **Severity: blocks Build 0.**

**Evidence — VERIFIED:** D:105,145,147 supplies the intended identity/placement, subject to the correction above. The admission transaction returns at `api/cron/agent-evaluate.js:689`; the model and proposed mint run later, outside that callback. `evalSeq` is read at `:2740`, persisted at `:3986`, and committed at `:4058`. On an error, the lock is cleared at `:4072-4074`. The suggested precedent uses `set(..., {merge:true})` (`api/_utils/intraday/evaluatorHook.js:50`).

**Failure sequence — inferred:** attempt A writes `battle:eval_007:call:0`, then its final update fails. The next attempt can reuse `eval_007` with a different model result because no entry/sequence committed. A merge can overwrite the original utterance or reset a call already hit/answered by another writer. Conversely, create-only writes alone preserve the first payload but can leave a later, different `eval_007` entry joined to it. A delayed mint can also land after completion scanned the calls. Retrying the admission callback does not itself rerun the later mint; testing that scenario alone misses the real boundary.

**Fix as written:** “Before publishing a call, durably reserve its check identity independently of capture, and define how the reservation survives a failed final update without being reused for another utterance. Mint immutable fields create-only; an existing ID is success only when its immutable payload matches, otherwise emit a conflict and preserve it. Never reapply initial state/response fields through merge. Check the parent's active status transactionally at publication so completion cannot be followed by a new open call. If this needs a different placement or a durable pending-record mechanism, specify that mechanism and its authorized storage before building. Record capture references from confirmed publication results, with a named reconciliation policy for unconfirmed writes. Test callback retry, final-update failure, different-result retry, partial batch, late completion and late timeout separately.”

### R-5 — An encounter can record a hit without valid check evidence, or reverse another writer's result

**Spec:** §3.1(3), §3.4(7), `Spec:33,51`. **Severity: blocks Build 0.**

**Evidence — VERIFIED:** D:87 describes the present-signals helper. `api/_utils/anticipationThresholdLint.js:270-334` returns symbol-to-signal-name sets; it is not a price-validity oracle. The cron's price map also includes opponent and macro symbols (`api/cron/agent-evaluate.js:815-840`), while required quote health covers held/opponent quotes, not every candidate (`:860-862`). No-trigger checks return at `:2295-2314`, before `promptBuiltAt` exists (`:2355,2458`) or the proposed mint seam. Spec:33 orders “condition met” before expiry and prescribes plain updates after a collection read. Contract:72 requires honest terminal outcomes.

**Consequence — inferred:** a price-map membership test can credit an unexamined symbol; a missing or unusable bench quote is not repaired by a valid held-quote set. A condition that first appears true after the horizon can be marked hit. A stale `open` read can overwrite completion/sweep/answer state. Checking only at the mint seam misses non-model checks; placing it earlier and reading `promptBuiltAt` invents a timestamp that does not exist there. At this seam the final action has not occurred: proposal/LOCK/distressed/hurdle/reservation/execution decisions still follow (`:3010-3275`).

**Fix as written:** “Define one encounter observation per check: eligible symbols actually examined, finite positive checked quotes, observation time and evidence source. Never use the global quote map or old stored prices as proof of examination. No usable observation means no hit. Specify above/below equality and whether ‘crosses’ means a level predicate or requires a prior observation. Expiry wins when the observation is outside the declared horizon; completion wins for a terminal parent. Apply transitions with transactional current-state/parent rechecks, preserving immutable fields and `playerResponse`. Observe non-model paths only where their data is actually valid, using their own check timestamp rather than a fabricated `promptBuiltAt`. Attach `actedEvalId` only from a matching committed executor result after execution. Add adversarial races and absent-symbol, stale-price, exact-expiry, no-trigger, blocked-SWAP and proposal-only fixtures.”

### R-6 — The horizon table exists; the schedule source it assumes does not

**Spec:** §3.1(2), §3.4(4), `Spec:32,48`. **Severity: blocks Build 0.**

**Evidence — VERIFIED:** Contract:65 requires the next scheduled check after `promptBuiltAt`. D:163 established that the translation was unbuilt; its document gap is now filled by Contract §5. HEAD schedules the evaluator at UTC quarter-hours (`vercel.json:157-158`) and gates evaluations through `isMarketOpen()` (`api/cron/agent-evaluate.js:334-337`). The frozen context has only `evaluationInterval:15` (`api/_utils/agentBattleService.js:210`); it is not a schedule. The existing UI estimate uses `lastCheckedAt + 15 minutes` (`src/adapters/baggerbombAdapter.js:308-337`). The usable calendar primitive is `api/_utils/marketSchedule.js:177-203`; it returns null outside maintained years. Battle end is top-level `expiresAt` (`agentBattleService.js:142`), not an unnamed timing field. A focused production-source search found no per-battle check-schedule resolver.

**Consequence:** `13:30:10 + 15 minutes` is not the scheduled `13:45:00` tick. Neither cadence prose nor the UI estimate handles the last slot, overnight gaps, DST or holidays as Contract §5 requires. “Weekend crypto check” is a horizon-function fixture, not a reachable scheduled evaluator path at this HEAD.

**Fix as written:** “Add a named pure horizon/schedule module to §3.2. Define ‘scheduled check’ as an eligible evaluator slot, whether or not the trigger gate subsequently calls the model. Resolve the first slot strictly after the supplied `promptBuiltAt` using the registered cron schedule and `getSessionForDate`'s RTH bounds; pin it against `vercel.json` to detect cadence drift. Use the battle's actual `expiresAt` and state explicit behavior when no eligible slot exists before battle end or the calendar is unavailable. Do not use `deriveDueAt` or add 15 minutes to a completion timestamp. Test seconds-offset prompts, DST, early closes, close equality, holidays, final battle slot and unsupported years. Store the resolved instant once.”

### R-7 — The new schema builder leaves the existing validator on the old schema

**Spec:** §3.1(1-2), §3.2, §3.4(3), `Spec:31-32,39,47`. **Severity: blocks Build 0.**

**Evidence — VERIFIED:** D:56's automatic top-level validation assumed extending the imported constant. The spec instead preserves `TRADE_DECISION_TOOL` as the declarations-off object. `api/_utils/agentEvalToolResultValidation.js:49-51` captures that constant's schema once, and `:103-127` iterates only its properties. The handler calls it with one argument (`api/cron/agent-evaluate.js:2541`). Thus declarations-on requests will not gain the top-level check by inheritance. The new writer is the only actual validation boundary. `presentSignals` at `:2773` is scoped inside the old lint branch, which is off; no reusable `priceBySymbol` scalar map is supplied there.

**Consequence:** merely citing the discovery gives the builder a false validation assumption. Alternatively, making the trading validator reject the whole result on a bad declarations block turns droppable metadata into a fallback HOLD. “Strict shape” can also accidentally reject a non-finite numeric level as not-born, contrary to the contract's `invalidated` disposition.

**Fix as written:** “Keep trade validation behavior unchanged. The calls validator explicitly validates the top-level declarations value and every discriminated row independently; do not rely on `validateTradeToolResult` to see the extended schema. Build its own present-signals snapshot from the named prompt inputs even when threshold lint is off, and explicitly extract checked scalar prices. Distinguish absent/wrong-typed fields from present non-finite numeric levels: the former are malformed, the latter invalidate per CR-5. Define missing/non-positive quote behavior and deterministic reason precedence. Test a valid SWAP with malformed declarations remains that same accepted trade, and a valid sibling still mints.”

### R-8 — The ratchet and fixture list is not executable as stated

**Spec:** §2, §3.1(4), §3.2-3.4, `Spec:23,34,39,42,46,49,52`. **Severity: blocks Build 0.**

**Evidence — VERIFIED:** D:40's string-flag registry advice is incorrect as noted above. The existing direct pin includes enum, default, pointer and registry-absence assertions (`src/config/anticipationThresholdLintFlags.test.js:35-63`). The capture serializer requires enum registration in both its import and `ENUM_LISTS` (`api/_utils/tickCapture/captureSerializer.js:40-51`); naming `enum:CALL_KINDS` alone is insufficient. Its container and leaf allowlists are separate (`:63,214`). The inert context has a named method list (`captureContext.js:102-111`). Its action example numbers from 1 (`:247`), while Spec:46 numbers calls from 0.

**Fix as written:** “Name `src/config/callRecordsFlags.test.js`, with a direct string pin, mode validation, pointer assertion and a runway comment in `flagPinGuard`; never insert this mode as a `DARK_BY_DESIGN` key. Define/export `CALL_KINDS` from the ruled kind set, import and register it in `ENUM_LISTS`, put container paths in the container allowlist and leaves in the field allowlist, and update both live and NOOP context interfaces. Define zero-based call ordinals separately from action ordinals, including malformed siblings and multiple declaration blocks. List the writer/state/schedule integration suites and the existing capture context/writer suites that must change; ‘captureSerializer enum check’ is not their substitute. Include capture on/off × calls off/shadow/on, partial persistence and real handler fixtures.”

### R-9 — The sweep flag can never be set in the exact absence it must cover

**Spec:** §4(1), `Spec:60`. **Severity: blocks a later build.**

**Evidence — VERIFIED:** D:159-165 identifies the skipped-check gap and queue precedent. A deferred battle never enters `processAgentBattle` (`api/cron/agent-evaluate.js:389-408`). The spec sets `pendingCallSweep` only when a check sees an already-expired call it could not flip. The existing reflection queue is for completed battles only (`api/cron/process-pending-reflections.js:47-53`), and completion rejects already-terminal parents unless repairing a specific GC shape (`agent-evaluate.js:5699-5708`). D:34 and `docs/BUILD_RULES.md:24` flag battle-shape additions as conceptual fence contact.

**Consequence:** a successfully minted call followed by no further check gets no pending flag. Deferred-beat telemetry alone cannot enqueue a call it never reads. Copying the reflection query misses active battles. The approved queue intent in CR-10 should also be carried into an explicit storage and fence-contact description for the new top-level field; “assembler untouched” does not classify battle-shape contact.

**Fix as written:** “Arm expiry repair when the open call is durably created, before relying on another check. Name the existing cron host, an independent active/completed queue query, its index, paging and deadline, and ensure the worker runs even with an empty reflection queue or closed market. Keep pending work retryable until a fresh transaction proves it drained; preserve hit outcomes at completion. Specify the queue's storage and classify any battle-shape contact under the approved CR-10 route. The deferred-beat prerequisite must name the landed contract that supplies its data; its flag name alone is insufficient.”

### R-10 — `directive_pending` on one endpoint does not protect the single slot

**Spec:** §4(2-3,6), §6, `Spec:61-62,65,82-86`. **Severity: blocks a later build.**

**Evidence — VERIFIED:** D:113-125,131 inventories both writers. `api/agent/file-directive.js:208-213` checks the client's current belief but permits replacement once it matches; `:282-286` replaces the slot. `api/agent/chat.js:1071-1082` replaces it with a plain update. Neither checks pending calls. Heard is currently an evaluation stamp with `directiveThreadId` and suppression (`api/_utils/tickStamps.js:138-151`), not `heardTickId`. The cron's stamp describes the prompt's snapshot, explicitly excluding a filing that arrived mid-tick (`agent-evaluate.js:3762-3777`). No production `heardTickId` writer exists at HEAD.

**Failure sequence — inferred:** call A files and is unheard; an ordinary chip, after subscription catches up, or an in-flight chat turn overwrites A. No second call-response request is needed. Conversely, treating `heardTickId == null` as “unheard” can block forever when capture is off, a stamp is suppressed, or no writer fills that field. Ordinary directives also have no `pendingCallId` to put in the refusal response.

**Fix as written:** “Enforce the pending-slot policy at every slot writer, including chat's final commit, with a fresh transactional recheck. CR-11's abandonment of B2 does not remove this requirement. Define pending from the current thread's effective rendered/heard evidence, distinguish expired/killed/suppressed/no-model cases and specify how the slot becomes available. Add an explicit durable heard-receipt writer/join and capture-off behavior; do not infer hearing from time elapsed or the model's echo. Define the response for an ordinary pending directive with no call ID. Test call↔call, call↔chip and call↔in-flight-chat races.”

### R-11 — Registering `until_ms` is insufficient without its stored instant and a shared clock

**Spec:** §4(3,6), `Spec:62,65`. **Severity: blocks a later build.**

**Evidence — VERIFIED:** D:125 identifies the day-granular helper. `api/_utils/directiveUtils.js:38,75-78` accepts a trading-day index, with no supplied instant. Both filing helpers copy an enum `expiry` but no expiration timestamp (`api/_utils/directiveFiling.js:29-41,50-60`). Spec:62 adds symbol/kind/callId, omitting the timestamp. The fenced prompt resolves activeness at `agentEvalPromptAssembly.js:1234`, and the cron resolves it again much later at `agent-evaluate.js:3777`.

**Consequence — inferred:** registering an enum does not preserve the horizon on the slot. Using `Date.now()` separately makes a directive present in the prompt disappear from Heard when it expires during the call. A `next_check` horizon expires at the next slot itself, so a strict expiry gate can remove the hold/ask instruction before the very check expected to consume it. Closing the unknown-expiry fallback also changes legacy rendering at calls `off` unless staged or scoped deliberately.

**Fix as written:** “Specify the exact slot representation, for example `expiry:'until_ms', expiresAtMs:<finite epoch ms>`, and carry it through both slot and exchange helpers. Resolve directive activeness and heard evidence against the same check instant; name its propagation through every reader and any required review of fenced behavior. Define exact equality, delayed-check and no-check-before-expiry behavior, including `next_check` hold/ask. Never make an expired instruction active merely to obtain a receipt. Keep existing valid expiry semantics, and reconcile the ruled unknown-value change with the off invariant explicitly. Add a clock-crossing integration fixture, not just direct helper boundary tests.”

### R-12 — The four-layer fixture lacks the inputs and receipts needed to disprove false compliance

**Spec:** §3.1(3), §4(2-3,6), §6, `Spec:33,61-65,81-90`. **Severity: blocks a later build.**

**Evidence — VERIFIED:** D:46,301 cites the required fixture; its rationale is `docs/audits/FantasyTrades_Expanded_Capability_Reuse_Audit_2026-09-23.md:571-575,597`. Current membership only proves an ID belongs to an archetype (`src/data/archetypeAdjustments.js:278-285`). The proposed renderer takes only `{symbol}`, though a pick is a choice among stored options for a particular slot/swap-out. `renderDirectiveBlock` instructs the model and requests a thread echo (`api/_utils/controlPromptRenderer.js:213-218`); that is not deterministic hold enforcement. The actual committed swap receipt appears after `executeSwapServer` returns (`agent-evaluate.js:3271-3286`). Spec:33 queries only `open` calls but promises a later re-answer on a `hit` call. Spec:65 says nothing is written on rejection, while Contract:82 requires persisting the typed pending refusal.

**Consequence:** a test can pass while the wrong option is selected, a template omits its slot, the narrator overclaims, a proposed trade never executes, or “held off” is inferred from an unrelated HOLD. Setting `outcome.reasked=true` does not itself ask the player anything or ensure a hold. There is no named re-ask event writer, second-answer lifecycle or held-off outcome writer. New template-only menu rows can also render `undefined` through the existing `${a.canonical}` menu (`api/_utils/voiceLayerPrompt.js:2793-2799`) or have no text at the old writer.

**Fix as written:** “The fixture supplies four independent observations joined by call ID and directive thread: (1) authenticated selected option bound to the stored options, slot, swap-out, default and horizon; (2) exact canonical text/parameters and committed slot, call response, budget and receipt; (3) the actual visible receipt/chat output and model-visible directive, including suppression/expiry; (4) the matching committed executor result or explicit non-execution reason. Cover each layer disagreeing independently, including forged-but-in-universe options, omitted slot, stale replacement, truthful filing with no hearing, model echo with failed execution, and unrelated HOLD. Define an answer/default-to-adjustment matrix covering `go_now` and `disagree`, and keep parameterized call choices out of ordinary menu writers unless those writers validate the same context. Define the re-ask emitter, retry identity and hit-awaiting-answer transitions; do not promise enforced hold from prose alone. On `directive_pending`, permit only the required `refused` receipt; preserve response/directive/budget and all other rejection no-write rules.”

### R-13 — Adding `callId` to an anticipation exchange does not ensure that exchange exists

**Spec:** §4(4-5), §5(4), `Spec:63-64,72`. **Severity: blocks a later build.**

**Evidence — VERIFIED:** D:85-93 describes the separate pipeline. Queue entries come only from `anticipationCandidates` (`api/cron/agent-evaluate.js:2847-2851`), while calls come from `declarations`. At `:4122-4139`, dispatch can be skipped for budget and passes only candidate/evalId. Grounded anticipation deduplicates by symbol/direction/day (`api/_utils/voiceLayerAnticipation.js:83-101`); it code-composes from `signalSummary`, not call `said` (`:114-119`). Multiple calls can share a symbol/direction, and a valid declaration need not carry any legacy candidate. Contract:38,89-90 requires both the bounded calls block and the per-call reverse anchor.

**Consequence:** a tile can point to no chat line, or to another call's line; stamping both composers does not repair the missing producer or dedupe identity. The new `callId` fields also need on-only gating to preserve shadow chat and rollback bytes. “Bounded calls block” has no numeric window, total size or overflow policy in the spec.

**Fix as written:** “At calls `on`, drive call-backed transcript entries from persisted call records with call-ID identity, not an optional parallel candidates array. Define one stable origin anchor per call and distinct receipt anchors for subsequent answers. Preserve the existing anticipation path byte-for-byte at calls `off`/`shadow`. Specify dedupe/retry and an honest record-backed fallback when narration was skipped or failed; never attach a different call's anchor. The call-backed line uses the contract's `said` source explicitly, including the grounding-on code path. Name the calls query, resolved-window N, total record/text cap, ordering and degraded-to-null behavior; test no-candidate, same-symbol multiple calls, suppressed narration, partial read and deep-link round trips.”

### R-14 — The Guarding tile has no authorized readable capture source

**Spec:** §5(4), `Spec:72`. **Severity: blocks a later build.**

**Evidence — VERIFIED:** D:99,137-143 describes capture storage and denial. Risk facts are on permanent ticks (`api/_utils/tickCapture/captureWriter.js:240-248`). Owner read applies to the battle and the explicitly allowed `intradayViews` child (`firestore.rules:429-452`), not arbitrary children. `test/rules/tickCaptureDenials.rules.mjs:136-142` pins no client-readable ticks/bodies match. The new `useCalls` listener reads a different collection. Neither spec build names a safe capture-reading endpoint or projection. Contract:50 also assigns unresolved evidence-state handling to a reader that the spec does not identify.

**Fix as written:** “Name a server-authorized, minimal per-check risk/evidence projection and its consumer, ownership checks, absence states and budget, or keep Guarding explicitly unavailable until that reader ships. Do not expose capture bodies or reinterpret a permission failure as `write_failed`/`expired`. Use only recorded typed risk outcomes; no reconstruction from current prices/dials and no implication that the check evaluated a missing record.”

### R-15 — Byte-identical mobile `off` is achievable, but a tile flag and snapshot are insufficient

**Spec:** §2, §5(1-2,7), `Spec:25,69-70,75`. **Severity: blocks a later build.**

**Evidence — VERIFIED:** D:185-201 is the correct layout baseline. Mobile uses `minHeight:'100vh'` (`src/screens/AgentBattleScreen.jsx:2095`), a relative top section (`:2120-2125`), an unbounded board column (`:2397-2413`) and no inner scroller styles (`:2415-2428`). ThisTurnStrip sits inside that column. `useCharacterPane.js:45-49,77,130,148` hardcodes the common tab list and Chat defaults; shell-awareness alone does not gate Cockpit on desktop or on rollback. The motion accessor changes every named token to instant under reduced motion (`src/theme/motion.js:143-162`).

**Consequence:** simply hiding the track/tab can still change page height, scroll ownership, hook defaults, unread clearing or subscriptions at `off`. Copying the desktop inner `overflowY` without bounding the entire mobile ancestor chain does not pin the header. A static render snapshot cannot establish scrolling, viewport resize, listener teardown or touch behavior.

**Fix as written:** “Gate the whole mobile geometry branch: root viewport height, shrinking/min-height chain, overflow, lifted turn strip, horizontal track, vertical page scrollers, safe-area/mark clearance and scroll-lock effects. At `off`, execute the existing geometry and state defaults exactly. Compute allowed sections and initial/reset/fallback section from both shell and UI flag; repair selection on resize/rollback and unsubscribe calls when disabled. Pin desktop board behavior separately. Add browser-level checks for vertical scrolling from tile content, horizontal swipes, keyboard/viewport changes, open overlays, and rollback after visiting Cockpit. State the reduced-motion branch explicitly: the standard accessor yields instant, so it cannot silently provide the CR-13 0.2-second fade.”

## `hypothesisRef`: what is and is not derivable today

**VERIFIED:** legacy equipped provenance is derivable without a live Forge read. `api/_utils/watchlistEquip.js:170-175` freezes `watchlistId`, name and ticker strings; `api/_utils/agentBattleService.js:193-200` stores that snapshot under `agentContext.equippedWatchlist`. With the manifest present, `api/_utils/resolvedAgentManifest.js:129-165` supplies the battle's equipped-config hash. That hash excludes version stamps and exists even when the watchlist is null. Current snapshot production supplies no hypothesis ID/version. Thus the spec's legacy fallback is appropriate; the “versioned” fixture is a synthetic future-shape fixture, not proof that HEAD produces versioned calls.

For §3's builder handoff, spell out the predicate and partial-context behavior: a valid frozen equipped watchlist must never become initiative/null merely because its version is absent; a config hash alone is not evidence of watchlist provenance; never invent a hash/version or fetch the current watchlist to complete the frozen snapshot. Name the future validated-version field path before claiming that branch is implemented. Resolve missing/corrupt provenance conservatively and visibly rather than treating failed provenance validation as proof of agent initiative. D:215 and Contract:51 are the governing references; this review does not recommend changing the ruled legacy shape.

## Build 0 acceptance gaps to carry into the revised prompt

The existing §3.4 happy-path list should remain, augmented by the concrete falsification cases in R-1–R-8. In particular, preserve two independent checks: immutable identity/payload under retry, and terminal-state monotonicity under concurrency. A test that only remints the same IDs proves neither. Test horizon and effect separately: a condition can be observed without an executed trade, and execution can be blocked after a proposal. No test outcomes are claimed by this review.

The current three-build split remains reasonable. CR-1's schema-description route avoids a fenced file edit, while Contract:31 still requires fenced-class review of the model-visible extension. CR-7's no-charge ack, CR-8's call ID anchor, CR-12's teal palette, CR-14's deferred watchlist mutation and the default-deny calls rules are compatible with HEAD. None removes the publication, expiry or evidence obligations above.

**Delivery boundary:** one report file; no implementation, tests or build; commit and push only this report on `docs/review-cockpit-spec-v1`, then stop. No PR, merge or CI monitoring is part of this review.

## The one thing most likely to be wrong in this spec

That a typed declaration plus a later matching price is already a trustworthy called-versus-happened record: without a durably unique check, an evidence-qualified encounter and a separately proven committed effect, it can give the player a convincing receipt for something the agent never evaluated, never heard or never did.
