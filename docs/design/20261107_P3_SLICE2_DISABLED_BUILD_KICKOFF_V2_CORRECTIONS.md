FantasyTrades: Measured Trend Evidence Slice 2
Disabled-build kickoff with binding V2 corrections
7 November 2026

Send this message to a fresh Claude Code implementation session in its own worktree. Attach the V2 specification and its resolution note.

FOUNDER INSTRUCTION

I authorize the disabled implementation of Measured Trend Evidence Slice 2 using 20261107_P3_SLICE2_BUILD_SPEC_DRAFT_V2.md and the binding corrections below. This message takes precedence wherever it conflicts with V2 or its resolution note.

Accept D-1 through D-5 and D-7 in the direction described in V2, amended below. D-6 remains unresolved and gates production activation only.

Implement, test, review, document, push and open a draft PR. Stop at the pushed draft PR. No merge, deployment, flag flip, production read, provider request, model job, census run or CI watching. Use fixtures and the emulator. The Practice Field is not a dependency.

Read the repository instructions. Fetch origin/main, create a fresh isolated worktree and branch, and record the base SHA. Suggested branch: claude/setup-menu-labels-slice2. Recheck the V2 anchors against the build base. The review inspected d503dd07df76ddfb1931935111d158c944f720ae. Handle compatible drift normally. Report a material contract or fence conflict before editing dependent code.

Before implementation, put these corrections and their acceptance cases into the build report as the controlling amendments to V2. No separate specification-only PR or further general investigation is needed. Preserve the supplied V2 and resolution note as historical inputs.

CORRECTION A: OPTIONAL READS ADD NO DELIBERATE WAIT

Keep the pure pool freeze and the two post-admission read-start sites. At finalization, take only the results already available. Set the optional settlement wait to zero. Unfinished results remain read_unsettled, and no later result patches the record.

Reason: V2 protects the current tick's capture floor, but an extra 500 ms still consumes the shared handler budget and affects a later battle. A nonblocking observation removes this explicit delay. CPU, database and serialization costs remain real and must be reported honestly. Do not claim zero operational overhead or universal timing equality.

All promises need rejection handlers from creation. Seal the observation on capture, error exit or deadline. Stop admitting queued reads after closure. Clear observation timers. Late callbacks must not mutate a recorded object or start further reads for a closed observation. Already-issued read-only RPCs need not be awaited on exit. Do not claim a timer cancels the underlying RPC. Bound memoized work across ticks, including a prior tick's unresolved reads.

Correct acceptance row 1.3. A state read resolving at 2,900 ms is not available on an immediate no-trigger exit. It yields stateRead false and null historical fields. If existing model/write work naturally outlasts the read, it is available without additional waiting.

Tests must cover the existing 64/68-second admission boundaries, multiple battles sharing one handler clock, immediate exits, hung/rejected reads, queue closure, late results, disabled capture and unchanged pre-existing write behavior.

CORRECTION B: RESERVATIONS SURVIVE FAILED OUTCOME WRITES

Keep the transactional reservation-before-request design, but complete its ownership and recovery rules.

Each reservation has a unique operation token. Token generation occurs outside the transaction callback. Retries reuse it. Outcome writes, refunds and releases apply only to the matching active operation, once. A stale or duplicate completion must not decrement the counter twice, erase a successor's reservation, replace its due time or mark it done. Provider/store calls occur outside transaction callbacks.

A reservation whose outcome was not saved must not become immediately retryable when its 120-second in-flight period expires. V2 writes dueAt only after the request, so a lost outcome write otherwise restores premature retries.

Use a durable conservative recovery state for unresolved outcomes. Once the prior reservation is eligible for recovery, transactionally schedule its next attempt no earlier than 31 minutes after the recovery observation. Do not spend a new request allowance during recovery, and do not extend this due time again on each run. Keep the consumed reservation counted. Recovered or superseded tokens cannot later shorten the backoff or refund another operation.

Recheck admission and ownership after queued or retried reservation work, immediately before calling the store. A reservation admitted with seven seconds remaining does not authorize a request after a slow transaction consumes the reserve. If no store call started, any cancellation/refund must be token-checked and idempotent. Uncertain commits remain conservative.

Keep governed-session retention monotonic across overlapping runs. An older run's cursor/pruning transaction must not delete a newer session's counters. No governed exhausted key is evicted to admit another key. State unreadable or reservation failed means no request.

Required cases: transaction callback retry, lost reservation acknowledgement, duplicate outcome, expired/taken-over reservation with late completion, pending refund repeated, crash after reservation, completed fetch with lost outcome write, recovery without an early fetch, admission lost during reservation, and overlapping session rollover. Preserve the three non-refunded-reservation cap and report reservation counts separately from actual provider calls.

The 31-minute due rule describes Slice 2's scheduling. It does not guarantee confirmation if ID-1 changes the shared refusal observation in the meantime. An additional retryable outcome remains legitimate.

CORRECTION C: PROTECT THE WHOLE EXISTING RECORD

Keep the candidate array, 48-candidate cap and 24 KiB block cap. Apply the candidate cap before snapshot reads. Count omitted names without fetching their evidence.

The block's size cap alone does not protect the existing record. The current writer measures the larger of permanent/body sizes and sheds body fields above its document budget. A base permanent record near the budget plus a valid 24 KiB block risks shedding the old body or failing the batch.

Add a narrow optional-block admission check in captureWriter.js, before optional bytes trigger existing shedding. Assess the full permanent record, including relevant metadata, against the existing budget. Drop the optional setupMenu block if it does not fit. Preserve the base record's existing shedding and write behavior. Do not change capture budget constants, general serializer admission, or non-Slice-2 fields.

Contain malformed/error-form blocks locally. Do not route optional composition errors through the shared capture fault text if doing so changes the body, contradicting rows 1.7 and 5.5. A valid bounded error block or omission is sufficient.

Test an otherwise valid permanent record close to its document budget, oversized and malformed optional data, the error fallback itself, and a normal body which must not be shed solely to retain setupMenu. Preserve existing ordinary timing observations. Never regenerate parity fixtures to conceal a changed record.

CORRECTION D: FIX THE MEASUREMENT MEANINGS

1. Evidence time is not commit time.
At the inspected revision, snapshotDocOf in setupEvidence/acquire.js sets capturedAt to fetchedAt. V2 §4.5 incorrectly infers a snapshot finalized after the freeze must have predatesFreeze false.

Keep the provider capture timestamp, but name the comparison capturedBeforeFreeze or explicitly define it as capture-time comparison only. It does not establish database availability at the decision. Availability-before-decision remains unknown unless independently established. No new commit timestamp or store mutation belongs in this build. Test: provider response before freeze, snapshot commit after freeze, read afterwards. Never count this as proven decision-time availability.

2. Pool membership is literal set membership.
Correct §4.1's set equations. A hot-bench symbol already in the original bench belongs to both P and M despite being absent from hotBenchAssetMap. Compute membership directly from the frozen sets.

inDispatchedBench describes frozen bench membership, not actual dispatch. Rename it to inBenchAtFreeze for clarity, or retain the name with explicit semantics everywhere. A model-visible denominator requires model.dispatched true AND bench membership. Separate attempted-but-undispatched from dispatched transport failures using the actual record fields. Test overlapping original-bench/hot-bench names, held names, no-trigger ticks and transport failures.

3. Acquisition and attribution stay separate.
A hot-bench name outside the model bench is not automatically intentionally unacquired. The acquisition tenant requests persisted hot-bench names. Track acquisition eligibility separately from model exposure. Catalyst names outside that acquisition population remain a distinct cohort.

A reservation is not proof a provider request occurred or failed. Historical s2 fields describe reservations and recorded outcomes only. Keep zero, missing and unreadable state distinct. Remove provider-failure claims inferred solely from n > 0. If reason-level census output is retained, explicitly store the typed reason. Otherwise remove the promise to report an unstored reason.

Keep proposal_tick_unevaluated, battle-scoped joins, truncation coverage and the current M1/M2 limits. No filtering or trading-performance claim follows from this build.

PRESERVED BOUNDARIES AND DELIVERY

Keep V2's file scope, except the narrow writer admission logic explicitly authorized above. Runtime setupEvidence modules, evaluator, thresholds, golden, baseline, activation observer, fenced files, prompts and candidate selection stay unchanged. The import-guard test exception remains exact.

Ship SETUP_MENU_LABELS_ENABLED false, registered and pinned. Preserve flag-off parity and server-only access. Place acquisition after the observer, with independent caps/state and no activationObserverState access. Do not alter earlier tenants, observer constants or TIME_BUDGET_MS.

Retain the revised budget terminology: 24 per admitted handler invocation, 1,248/day only under the stated 52-invocation assumption. No approved provider allocation exists in this instruction.

Run V2's required review and checks, amended for the cases above: focused suites, emulator/rules, full Linux suite, lint gate, build/entry-chunk parity and golden guard against the appropriate base. Use the workflow's current Node version for the CI-shaped checks, or explicitly report the remaining runtime verification gap. Follow the repository's isolated review and mutation process.

The build report must map each amendment to code and tests, distinguish executed results from unrun checks, record the final base/head and list merge/activation prerequisites. Include the exact controlling amendments with the report. No additional product decision is delegated to the builder.

Before merge, return the pushed head for Astra's independent implementation review and GitHub CI verification. Production activation remains separate: recorded ID-1 census completion, approved D-6 allocation and an explicit founder activation instruction. Rules/index publication is also a separate post-merge step. No calendar date authorizes activation.
