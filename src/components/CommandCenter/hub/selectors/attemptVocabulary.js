// src/components/CommandCenter/hub/selectors/attemptVocabulary.js
//
// Command Center hub, slice S2a — the one deployment vocabulary (spec V1.2
// §5.2, correction C3): the provider's stored phases, the service outcomes, the
// reconciliation statuses, the hold phases, the translation from a service
// result to a provider phase, and the translation from a provider record to
// the display words the strip and the Deploy card show.
//
// Two vocabularies, never mixed:
//   - STORED phases (ATTEMPT_PHASES) live on the provider record: idle,
//     submitting, created, existing, refused, uncertain, orphaned.
//   - DISPLAY words (ATTEMPT_DISPLAY) are what the hub shows: submitting,
//     verifying, finishing, confirmed, existing, failed, uncertain. `confirmed`,
//     `finishing`, `verifying` and `failed` are display words only; nothing
//     stores them and no selector tests a stored phase by those names (the
//     display guard in selectors.purity.guard.test.js holds that).
//
// Untyped results fail closed (ruling R-S2A-2). Today's service
// (src/services/agentDeploy.js) returns no typed `outcome`; R1 adds it. Until
// then every result without one, today's `{ success: true, agentBattleId }`
// included, translates to provider `uncertain` with its evidence attached,
// never to `created` or `existing`, and a `success: true` with a null id is
// never a creation (spec IR-01). The one exception the spec names is the typed
// refusal reachable today: HTTP 409 with the `hypothesis_review_due` code
// (src/constants/hypothesisRecords.js DEPLOY_REFUSAL_CODE) is `refused`, its
// line kept exactly, so the Pilot P1b refusal survives this adapter as it will
// survive R1's.
//
// Pure: no React, no Firebase, no clock, no globals. Every value arrives as an
// argument.

import { DEPLOY_REFUSAL_CODE, DUE_DEPLOY_LINE } from '../../../../constants/hypothesisRecords';
import { DEPLOY_IN_PROGRESS_LINE, isInProgressRefusal } from '../../../../constants/deployOutcomes';

/** The provider record's stored phases (spec §5.2). */
export const ATTEMPT_PHASES = Object.freeze({
  IDLE: 'idle',
  SUBMITTING: 'submitting',
  CREATED: 'created',
  EXISTING: 'existing',
  REFUSED: 'refused',
  UNCERTAIN: 'uncertain',
  ORPHANED: 'orphaned',
});

/** The service result's typed `outcome` (spec §5.2). R1 supplies it; S2a only reads it. */
export const SERVICE_OUTCOMES = Object.freeze({
  CREATED: 'created',
  EXISTING_BATTLE: 'existing_battle',
  REFUSED: 'refused',
  UNCERTAIN: 'uncertain',
  HANDOFF_FAILED: 'handoff_failed',
  ORPHANED: 'orphaned',
});

/** The owned active-battle reconciliation's status, separate from the provider phase (spec §5.2). */
export const RECONCILIATION = Object.freeze({
  NOT_CHECKED: 'not_checked',
  PENDING: 'pending',
  CLEAR: 'clear',
  FOUND: 'found',
  ERROR: 'error',
});

/**
 * The hold's phases (spec §5.2). S2a reads a hold; it claims, charges and
 * commits none (C4 is R2's and S2b's; ruling R-S2A-5). The words a holding
 * control shows ("Locked in" …) are the shipped HoldToDeployButton's.
 */
export const HOLD_PHASES = Object.freeze({ IDLE: 'idle', CHARGING: 'charging', LOCKED: 'locked' });

/**
 * The ceremony's phases as the provider records them: the shipped stage
 * machine's four (useCeremonyStageMachine.js — theater, verifying, reveal,
 * error), R1's new existing-battle terminal (spec §5.2), and closed.
 */
export const CEREMONY_PHASES = Object.freeze({
  THEATER: 'theater',
  VERIFYING: 'verifying',
  REVEAL: 'reveal',
  EXISTING: 'existing',
  ERROR: 'error',
  CLOSED: 'closed',
});

/** The shipped stage machine's error tones (useCeremonyStageMachine.js; CeremonyError.jsx). */
export const ERROR_TONES = Object.freeze({ CONFIRMED: 'confirmed', LOST_CONTACT: 'lost_contact' });

/** How a provider `created` / `existing` came about when no explicit response said so (spec §5.2). */
export const RESOLUTION_KINDS = Object.freeze({ RECOVERED: 'recovered', FOUND_EXISTING: 'found_existing' });

/**
 * What a translated result carries, beside its phase. `untyped` marks a
 * result S2a cannot type (R-S2A-2); `review_due` the P1b refusal; `handoff`
 * a real creation whose App handoff failed (no second POST).
 */
export const RESULT_KINDS = Object.freeze({
  CREATED: 'created',
  HANDOFF: 'handoff',
  EXISTING: 'existing',
  REFUSED: 'refused',
  REVIEW_DUE: 'review_due',
  UNCERTAIN: 'uncertain',
  UNTYPED: 'untyped',
  ORPHANED: 'orphaned',
});

/** The display words for an attempt (spec §5.2's UI column). Never stored. */
export const ATTEMPT_DISPLAY = Object.freeze({
  SUBMITTING: 'submitting',
  VERIFYING: 'verifying',
  FINISHING: 'finishing',
  CONFIRMED: 'confirmed',
  EXISTING: 'existing',
  FAILED: 'failed',
  UNCERTAIN: 'uncertain',
});

/** The one action an attempt display offers, if any (spec §5.2, §5.4). */
export const ATTEMPT_ACTIONS = Object.freeze({
  ENTER_BATTLE: 'enterBattle',
  OPEN_GAME: 'openGame',
  CHECK_DEPLOYMENT: 'checkDeployment',
  RETRY: 'retry',
  OPEN_FORGE_REVIEW: 'openForgeReview',
});

const OUTCOME_SET = new Set(Object.values(SERVICE_OUTCOMES));

/** A real server id: a nonempty string with no surrounding space. Anything else is no id. */
export function realId(id) {
  return typeof id === 'string' && id.length > 0 && id.trim() === id ? id : null;
}

const nonEmptyString = (v) => (typeof v === 'string' && v.trim() ? v : null);

const translation = (phase, ceremonyPhase, errorTone, displayState, result) => Object.freeze({
  phase,
  ceremony: Object.freeze({ phase: ceremonyPhase, errorTone }),
  displayState,
  detail: Object.freeze(result),
});

const uncertain = (kind, evidence) => translation(
  ATTEMPT_PHASES.UNCERTAIN, CEREMONY_PHASES.ERROR, ERROR_TONES.LOST_CONTACT, ATTEMPT_DISPLAY.UNCERTAIN,
  { kind, battleId: null, line: null, postIssued: evidence?.postIssued !== false, evidence: evidence ?? null },
);

const isReviewDue = (result) => result.error === DEPLOY_REFUSAL_CODE;

const refused = (result) => {
  const reviewDue = isReviewDue(result);
  // The server's words, unchanged (spec §5.2). The review-due refusal's words are
  // the one shared line (carriage.js answers it verbatim), so a 409 that lost them
  // in transit still shows the same line, never a generic one. Slice S2b (ruling
  // R-S2b-9b): decide's 429 "Deploy already in progress" carries no `details`, so
  // it shows the one line the ceremony shows (src/constants/deployOutcomes.js).
  const line = nonEmptyString(result.details)
    ?? (reviewDue ? DUE_DEPLOY_LINE : isInProgressRefusal(result) ? DEPLOY_IN_PROGRESS_LINE : null);
  return translation(
    ATTEMPT_PHASES.REFUSED, CEREMONY_PHASES.ERROR, ERROR_TONES.CONFIRMED, ATTEMPT_DISPLAY.FAILED,
    {
      kind: reviewDue ? RESULT_KINDS.REVIEW_DUE : RESULT_KINDS.REFUSED,
      battleId: null,
      line,
      // A refusal with no POST (preflight) imposes no deploy cooldown (spec §5.4).
      postIssued: result.postIssued !== false,
      evidence: result,
    },
  );
};

/**
 * One service result → `{ phase, ceremony: { phase, errorTone }, displayState, detail }`
 * (spec §5.2, row for row). `detail` is `{ kind, battleId, line, postIssued, evidence }`:
 * `battleId` is the real server id when the evidence carries one, `line` the
 * server's refusal words, `evidence` the result itself, unchanged.
 */
export function translateServiceResult(result) {
  if (!result || typeof result !== 'object') return uncertain(RESULT_KINDS.UNTYPED, null);
  const outcome = typeof result.outcome === 'string' && OUTCOME_SET.has(result.outcome) ? result.outcome : null;

  if (outcome === null) {
    // R-S2A-2: the one typed refusal reachable today.
    if (result.httpStatus === 409 && isReviewDue(result)) return refused(result);
    return uncertain(RESULT_KINDS.UNTYPED, result);
  }

  switch (outcome) {
    case SERVICE_OUTCOMES.CREATED: {
      // A created outcome carries a verified new id and legacy success:true (spec §5.2).
      const a = realId(result.agentBattleId);
      const b = realId(result.battleId);
      const id = a ?? b;
      if (!id || (a && b && a !== b) || result.success !== true || result.battleCreated === false) {
        return uncertain(RESULT_KINDS.UNCERTAIN, result);
      }
      return translation(ATTEMPT_PHASES.CREATED, CEREMONY_PHASES.THEATER, null, ATTEMPT_DISPLAY.FINISHING,
        { kind: RESULT_KINDS.CREATED, battleId: id, line: null, postIssued: true, evidence: result });
    }
    case SERVICE_OUTCOMES.HANDOFF_FAILED: {
      // The server created a real battle; App's handoff threw. Provider `created`,
      // verification for the same id, no second POST (spec §5.2).
      const id = realId(result.battleId) ?? realId(result.agentBattleId);
      if (!id || result.battleCreated === false) return uncertain(RESULT_KINDS.UNCERTAIN, result);
      return translation(ATTEMPT_PHASES.CREATED, CEREMONY_PHASES.VERIFYING, null, ATTEMPT_DISPLAY.VERIFYING,
        { kind: RESULT_KINDS.HANDOFF, battleId: id, line: null, postIssued: true, evidence: result });
    }
    case SERVICE_OUTCOMES.EXISTING_BATTLE: {
      // Translates exactly once to `existing`: never a creation, never the create callback.
      const id = realId(result.existingBattleId);
      if (!id || result.battleCreated === true) return uncertain(RESULT_KINDS.UNCERTAIN, result);
      return translation(ATTEMPT_PHASES.EXISTING, CEREMONY_PHASES.EXISTING, null, ATTEMPT_DISPLAY.EXISTING,
        { kind: RESULT_KINDS.EXISTING, battleId: id, line: null, postIssued: true, evidence: result });
    }
    case SERVICE_OUTCOMES.REFUSED:
      return refused(result);
    case SERVICE_OUTCOMES.ORPHANED:
      // A local ownership disposition, not a server failure: nothing shows for the former owner.
      return translation(ATTEMPT_PHASES.ORPHANED, CEREMONY_PHASES.CLOSED, null, null,
        { kind: RESULT_KINDS.ORPHANED, battleId: null, line: null, postIssued: result.postIssued !== false, evidence: result });
    default:
      return uncertain(RESULT_KINDS.UNCERTAIN, result);
  }
}

const shown = (displayState, action = null, extra = {}) => Object.freeze({ displayState, action, ...extra });

/**
 * A provider record → `{ displayState, action, recovered, battleId, line }`, or
 * null when the record shows nothing (no record, idle, orphaned). The display
 * words come from the stored phase, the ceremony's phase and the resolution;
 * nothing here reads a display word back as a phase.
 */
export function displayForAttempt(attempt) {
  if (!attempt || typeof attempt !== 'object') return null;
  const ceremony = attempt.ceremonyPhase;
  const result = attempt.result && typeof attempt.result === 'object' ? attempt.result : {};
  const resolution = attempt.resolution && typeof attempt.resolution === 'object' ? attempt.resolution : null;
  const battleId = realId(resolution?.battleId) ?? realId(result.battleId);
  switch (attempt.phase) {
    case ATTEMPT_PHASES.SUBMITTING:
      // An accepted request not yet resolved: no retry, no new hold.
      return shown(ceremony === CEREMONY_PHASES.VERIFYING ? ATTEMPT_DISPLAY.VERIFYING : ATTEMPT_DISPLAY.SUBMITTING);
    case ATTEMPT_PHASES.CREATED: {
      const recovered = resolution?.kind === RESOLUTION_KINDS.RECOVERED;
      // Recovered: the owned battle the recovery gates admitted, "Battle confirmed" (spec §5.2).
      if (recovered) return shown(ATTEMPT_DISPLAY.CONFIRMED, ATTEMPT_ACTIONS.ENTER_BATTLE, { recovered: true, battleId });
      // An actual check (a handoff failure's verification, or the ceremony's own).
      if (ceremony === CEREMONY_PHASES.VERIFYING) return shown(ATTEMPT_DISPLAY.VERIFYING, null, { battleId });
      // A created response still in theater: finishing, never "submitting".
      if (ceremony === CEREMONY_PHASES.THEATER) return shown(ATTEMPT_DISPLAY.FINISHING, null, { battleId });
      // Otherwise the creation stands, a handoff failure's included once its check
      // settles, whatever the check said: a server creation is never relabelled as a
      // failure, and Enter opens the real battle by its id (spec §5.2).
      return shown(ATTEMPT_DISPLAY.CONFIRMED, ATTEMPT_ACTIONS.ENTER_BATTLE, { recovered: false, battleId });
    }
    case ATTEMPT_PHASES.EXISTING:
      return shown(ATTEMPT_DISPLAY.EXISTING, ATTEMPT_ACTIONS.OPEN_GAME, { battleId });
    case ATTEMPT_PHASES.REFUSED:
      // A refusal no ceremony shows (closed while the request was out, or the ceremony off) can also be
      // dismissed from the hub: acknowledged, its cooldown kept (spec §5.4; founder ruling Q-S2b-4). An open
      // ceremony has its own Back to hub, and an uncertain attempt never has one: its guard stands.
      return shown(
        ATTEMPT_DISPLAY.FAILED,
        result.kind === RESULT_KINDS.REVIEW_DUE ? ATTEMPT_ACTIONS.OPEN_FORGE_REVIEW : ATTEMPT_ACTIONS.RETRY,
        { line: nonEmptyString(result.line), dismiss: ceremony === CEREMONY_PHASES.CLOSED },
      );
    case ATTEMPT_PHASES.UNCERTAIN: {
      const status = attempt.reconciliationStatus;
      // Check deployment first; only an owned clear result permits Retry (spec §5.4).
      const action = status === RECONCILIATION.PENDING ? null
        : status === RECONCILIATION.CLEAR ? ATTEMPT_ACTIONS.RETRY : ATTEMPT_ACTIONS.CHECK_DEPLOYMENT;
      return shown(ATTEMPT_DISPLAY.UNCERTAIN, action);
    }
    default:
      return null;
  }
}
