// api/_utils/tickCapture/captureConfig.js
//
// Tick capture — the constants and the closed vocabularies (spec
// docs/specs/CAPTURE_BUILD_SPEC_V1_3.md §3, rulings C-6/C-8/C-9).
//
// ZERO product imports, by the tickStampsHarness precedent: nothing here can
// drag a browser dependency into the cron's Node graph, and nothing here can
// read a flag, a battle or a clock. Pure data.
//
// THE TWO TIMING CONSTANTS (C-9) are founder-adjustable and are the flip
// gate's measured quantities:
//
//   TICK_CAPTURE_DEADLINE_MS — the bounded wall time the capture write itself
//     may take. Chosen at 3,000 ms because the existing bounded Firestore
//     side-write in this handler (the intraday diagnostic view,
//     INTRADAY_HOOK_TIMEOUT_MS = 2,000 ms) is a ONE-document set and this is a
//     TWO-document atomic batch: one commit, roughly twice the payload, on the
//     same connection. 3,000 ms keeps the same order of magnitude while
//     leaving the batch a full second of headroom over the single-doc bound
//     that is already known to be generous in production.
//
//   TICK_CAPTURE_MIN_REMAINING_BUDGET_MS — the handler budget below which
//     capture skips itself entirely (a COUNTED gap, never a silent one).
//     Chosen at 10,000 ms = the 3,000 ms capture deadline + a 7,000 ms margin
//     that keeps capture strictly behind the two commitments the tick has
//     already made in the same `finally`: the anticipation batch's own 12,000
//     ms gate (agent-evaluate.js, the `remainingBudget > 12_000` check) and
//     the awaited final battle update before it. Capture is the LAST thing a
//     tick does and therefore the FIRST thing to yield: a tick that can still
//     afford narration and anticipation can afford capture, and one that
//     cannot afford capture has already skipped anticipation.
//
// Neither number changes a trading calculation. Raising the deadline costs
// wall time on a slow write; lowering the budget floor trades coverage for
// scheduling headroom (C-9's permitted effect). Both are read at call time.

/** Schema version of the two documents. Bump on any shape change. */
export const TICK_CAPTURE_SCHEMA_VERSION = 1;

/** Bounded wall time for the capture batch commit and the body reads (C-9). */
export const TICK_CAPTURE_DEADLINE_MS = 3_000;

/** Below this much remaining handler budget, capture skips itself (C-9). */
export const TICK_CAPTURE_MIN_REMAINING_BUDGET_MS = 10_000;

/**
 * Per-text-field cap in the BODY document (spec §3: "A per-document size cap
 * applies; oversize bodies are truncated with an explicit `bodyIncomplete`
 * reason"). 128 KiB per field against Firestore's 1 MiB document limit: the
 * Phase 0 planning model (Q2) puts a whole request at ~40 KiB and a response
 * at ~8 KiB, so this admits a body three times the planned maximum intact and
 * still leaves room for the four text fields plus the rendered controls.
 */
export const TICK_CAPTURE_TEXT_FIELD_MAX_BYTES = 128 * 1024;

/**
 * Whole-body-document budget. Truncation walks the text fields largest-first
 * until the estimate fits, so one huge field cannot evict every other.
 */
export const TICK_CAPTURE_BODY_DOC_MAX_BYTES = 700 * 1024;

/** Retention window for the body document (C-4, founder-approved Sep 21 2026). */
export const TICK_CAPTURE_BODY_RETENTION_DAYS = 120;

/** Subcollection names under `agentBattles/{battleId}`. */
export const TICKS_SUBCOLLECTION = 'ticks';
export const TICK_BODIES_SUBCOLLECTION = 'tickBodies';

/**
 * C-8 — every exit in the Phase 0 exit map. The six post-admission early
 * returns, normal completion, and the thrown-error escape. Lease refusal and
 * the scheduler's budget deferral are PRE-admission: they have no tickSeq and
 * are deliberately absent (C-8, Phase 0 Q4 "Not admitted").
 */
export const EXIT_REASONS = Object.freeze([
  'degraded_quotes',     // required held/opponent quotes unusable
  'cpu_passive',         // passive CPU battle — scores marked, no check
  'proposal_pending',    // a pending proposal suppresses the check
  'gameplan_pending',    // an existing pending gameplan meeting
  'gameplan_created',    // a new gameplan meeting created this tick
  'no_trigger',          // the trigger gate did not fire
  'completed',           // the full path reached the final battle update
  'tick_error',          // a throw escaped the admitted body
]);

/** The stage the tick reached, in the order the handler passes through them. */
export const STAGES = Object.freeze([
  'admitted',
  'quotes_checked',
  'scores_marked',
  'risk_evaluated',
  'proposal_handled',
  'gameplan_handled',
  'trigger_evaluated',
  'prompt_built',
  'model_returned',
  'decision_resolved',
  'finalized',
]);

/**
 * C-8 — the MODEL-CALL outcome, and nothing else. `failureClass` carries the
 * shipped classes unchanged (agent-evaluate.js / agentEvalTransport.js):
 * 'timeout', 'build_timeout', 'truncated_response', 'budget_skipped',
 * 'invalid_tool_result', 'refresh_failed', an HTTP status string, an error
 * constructor name, or 'unknown'. This build adds no class and renames none.
 */
export const MODEL_OUTCOMES = Object.freeze(['ok', 'failed', 'not_attempted']);

/** Timeout kinds the transport already distinguishes. */
export const TIMEOUT_KINDS = Object.freeze(['sdk', 'backstop']);

/**
 * C-8 — the DETERMINISTIC guardrail layer's own fault, separate from the model
 * outcome by construction. A tick can carry both. The layer records one class;
 * the message is free text and lives in the body.
 */
export const GUARDRAIL_FAULT_CLASSES = Object.freeze(['guardrail_error']);

/**
 * C-6 — the status of every check the tick could have run. `evaluated` means
 * the handler actually ran it this tick; `bypassed` means a shipped rule
 * deliberately skipped it; `not_evaluated` means control never reached it;
 * `unknown` means the outcome was discarded inside a fenced module and this
 * build does not recompute it. Nothing untouched is ever labelled "passed".
 */
export const CHECK_STATUSES = Object.freeze(['evaluated', 'bypassed', 'not_evaluated', 'unknown']);

/** The checks C-6 names, plus the execution legality Phase 0 Q3 adds. */
export const CHECK_NAMES = Object.freeze([
  'proposedPairValidation',
  'lock',
  'distressedVeto',
  'hurdle',
  'swapCap',
  'conviction',
  'reservation',
  'execution',
]);

/** The outcome of an `evaluated` check. */
export const CHECK_RESULTS = Object.freeze(['passed', 'blocked', 'faulted']);

/** Decisions the record stores as enums (the shipped decision vocabulary). */
export const DECISIONS = Object.freeze(['SWAP', 'HOLD', 'PROPOSAL']);

/** `holdKind` (shipped, fail-closed hygiene Sep 19 2026). */
export const HOLD_KINDS = Object.freeze(['default_failure']);

/** Body-copy disposition on the permanent document (C-1 / spec §3). */
export const BODY_STATUSES = Object.freeze(['written', 'truncated', 'copy_failed', 'skipped']);

/**
 * C-1 — why a tick has no record, recorded on the CONTEXT rather than in a
 * document (there is no extra write to report a failure). The export resolves
 * `unknown` by checking whether the batch actually landed.
 */
export const CAPTURE_DISPOSITIONS = Object.freeze([
  'written',
  'skipped_budget',
  'timed_out',      // resolves to `unknown` for the export until it checks
  'write_failed',
  'serialize_failed',
]);

/** The executor call classes a recorded action can come from (existing sites). */
export const ACTION_SOURCES = Object.freeze([
  'risk_manager',
  'archetype',
  'haiku',
  'guardrail',
  'gameplan_meeting',
]);

/** Action kinds the record distinguishes. */
export const ACTION_KINDS = Object.freeze(['swap']);
