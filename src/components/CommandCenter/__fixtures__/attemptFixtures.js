// src/components/CommandCenter/__fixtures__/attemptFixtures.js
//
// Command Center hub, slice S2a — the attempt fixtures, for TESTS ONLY
// (hub/selectors/attemptVocabulary.test.js, attemptReducer.test.js,
// ownership.test.js).
//
//   LEGACY_RESULTS   every result shape src/services/agentDeploy.js returns
//                    today, by line, with the translation ruling R-S2A-2 gives
//                    it: untyped → uncertain, but for the 409 review-due refusal
//   TYPED_RESULTS    every §5.2 service outcome (R1's vocabulary), the valid
//                    forms and the ones that must fall back to uncertain
//   C2_BOUNDARIES    the async boundaries of spec §5.3 / §11.3 "Ownership C2"
//                    at which S2b asks isCurrent
//   C3_CASES         the spec §11.3 "Vocabulary C3" cases, by name (the reducer
//                    sequences in attemptReducer.test.js run each one)

import { DUE_DEPLOY_LINE, DEPLOY_REFUSAL_CODE } from '../../../constants/hypothesisRecords';

export const A = 'owner-a';
export const B = 'owner-b';
export const T0 = Date.UTC(2026, 9, 14, 14, 0);
export const TARGET = `casual-agent-${A}`;
export const REAL_ID = 'bt_7Qx2';

/** agentDeploy.js today. `kind` is the detail kind the translation must give. */
export const LEGACY_RESULTS = Object.freeze({
  'no-agent, no POST (agentDeploy.js:35)': {
    result: { success: false, postIssued: false, error: 'no-agent' },
    phase: 'uncertain', displayState: 'uncertain', kind: 'untyped', postIssued: false,
  },
  'auth-required, no POST (agentDeploy.js:71)': {
    result: { success: false, postIssued: false, error: 'auth-required' },
    phase: 'uncertain', displayState: 'uncertain', kind: 'untyped', postIssued: false,
  },
  'network failure after the POST left (agentDeploy.js:133)': {
    result: { success: false, postIssued: true, httpStatus: null, error: 'deploy_network', details: 'Network request failed' },
    phase: 'uncertain', displayState: 'uncertain', kind: 'untyped', postIssued: true,
  },
  'non-JSON 500 (agentDeploy.js:156)': {
    result: { success: false, status: 500, postIssued: true, httpStatus: 500, error: 'deploy_http_500', details: '<html>Internal error</html>' },
    phase: 'uncertain', displayState: 'uncertain', kind: 'untyped', postIssued: true,
  },
  'JSON 429 cooldown (agentDeploy.js:175; decide.js:193)': {
    result: { success: false, status: 429, postIssued: true, httpStatus: 429, error: 'Please wait 2 minutes between deploys', details: undefined, errorPhase: undefined },
    phase: 'uncertain', displayState: 'uncertain', kind: 'untyped', postIssued: true,
  },
  'JSON 409 hypothesis_review_due (agentDeploy.js:172-177) — the one typed refusal today': {
    result: { success: false, status: 409, postIssued: true, httpStatus: 409, error: DEPLOY_REFUSAL_CODE, details: DUE_DEPLOY_LINE, errorPhase: undefined },
    phase: 'refused', displayState: 'failed', kind: 'review_due', postIssued: true, line: DUE_DEPLOY_LINE,
  },
  'JSON 409 hypothesis_review_due whose words were lost: the shared line, never a generic one': {
    result: { success: false, status: 409, postIssued: true, httpStatus: 409, error: DEPLOY_REFUSAL_CODE, details: undefined },
    phase: 'refused', displayState: 'failed', kind: 'review_due', postIssued: true, line: DUE_DEPLOY_LINE,
  },
  'JSON 409 with another code (compiled_build_unverifiable, decide.js:960)': {
    result: { success: false, status: 409, postIssued: true, httpStatus: 409, error: 'compiled_build_unverifiable', details: undefined },
    phase: 'uncertain', displayState: 'uncertain', kind: 'untyped', postIssued: true,
  },
  'the review-due code on a status other than 409 is not the typed refusal': {
    result: { success: false, status: 500, postIssued: true, httpStatus: 500, error: DEPLOY_REFUSAL_CODE, details: DUE_DEPLOY_LINE },
    phase: 'uncertain', displayState: 'uncertain', kind: 'untyped', postIssued: true,
  },
  'a 200 that is not success (malformed; agentDeploy.js:151)': {
    result: { success: false, status: 200, postIssued: true, httpStatus: 200, error: undefined, details: undefined },
    phase: 'uncertain', displayState: 'uncertain', kind: 'untyped', postIssued: true,
  },
  'handoff threw after a real creation (agentDeploy.js:215) — untyped until R1': {
    result: { success: false, status: 200, postIssued: true, httpStatus: 200, battleId: REAL_ID, error: 'deploy_handoff', details: 'boom' },
    phase: 'uncertain', displayState: 'uncertain', kind: 'untyped', postIssued: true,
  },
  'handoff threw with no id (the existing-battle 200)': {
    result: { success: false, status: 200, postIssued: true, httpStatus: 200, battleId: null, error: 'deploy_handoff', details: 'boom' },
    phase: 'uncertain', displayState: 'uncertain', kind: 'untyped', postIssued: true,
  },
  'success with a real id (agentDeploy.js:227) — never a creation without its type': {
    result: { success: true, agentBattleId: REAL_ID },
    phase: 'uncertain', displayState: 'uncertain', kind: 'untyped', postIssued: true,
  },
  'success with a null id (the existing-battle 200 today; spec IR-01)': {
    result: { success: true, agentBattleId: null },
    phase: 'uncertain', displayState: 'uncertain', kind: 'untyped', postIssued: true,
  },
});

/** R1's typed outcomes (spec §5.2). */
export const TYPED_RESULTS = Object.freeze({
  'created with a real id': {
    result: { outcome: 'created', success: true, agentBattleId: REAL_ID },
    phase: 'created', displayState: 'finishing', ceremony: 'theater', kind: 'created', battleId: REAL_ID,
  },
  'created with a real id under battleId': {
    result: { outcome: 'created', success: true, battleId: REAL_ID },
    phase: 'created', displayState: 'finishing', ceremony: 'theater', kind: 'created', battleId: REAL_ID,
  },
  'created with a null id is never a creation (IR-01)': {
    result: { outcome: 'created', success: true, agentBattleId: null },
    phase: 'uncertain', displayState: 'uncertain', ceremony: 'error', kind: 'uncertain', battleId: null,
  },
  'created with an empty or padded id': {
    result: { outcome: 'created', success: true, agentBattleId: ' bt_1 ' },
    phase: 'uncertain', displayState: 'uncertain', ceremony: 'error', kind: 'uncertain', battleId: null,
  },
  'created without legacy success:true': {
    result: { outcome: 'created', success: false, agentBattleId: REAL_ID },
    phase: 'uncertain', displayState: 'uncertain', ceremony: 'error', kind: 'uncertain', battleId: null,
  },
  'created with two different ids': {
    result: { outcome: 'created', success: true, agentBattleId: REAL_ID, battleId: 'bt_other' },
    phase: 'uncertain', displayState: 'uncertain', ceremony: 'error', kind: 'uncertain', battleId: null,
  },
  'created that also says battleCreated:false': {
    result: { outcome: 'created', success: true, agentBattleId: REAL_ID, battleCreated: false },
    phase: 'uncertain', displayState: 'uncertain', ceremony: 'error', kind: 'uncertain', battleId: null,
  },
  'handoff_failed after a real created id: provider created, real id kept, legacy failure kept': {
    result: { outcome: 'handoff_failed', success: false, error: 'deploy_handoff', postIssued: true, httpStatus: 200, battleId: REAL_ID },
    phase: 'created', displayState: 'verifying', ceremony: 'verifying', kind: 'handoff', battleId: REAL_ID,
  },
  'handoff_failed with no id': {
    result: { outcome: 'handoff_failed', success: false, error: 'deploy_handoff', postIssued: true, httpStatus: 200, battleId: null },
    phase: 'uncertain', displayState: 'uncertain', ceremony: 'error', kind: 'uncertain', battleId: null,
  },
  'existing_battle with a valid existingBattleId': {
    result: { outcome: 'existing_battle', success: false, battleCreated: false, existingBattleId: 'bt_live' },
    phase: 'existing', displayState: 'existing', ceremony: 'existing', kind: 'existing', battleId: 'bt_live',
  },
  'existing_battle with no existingBattleId': {
    result: { outcome: 'existing_battle', success: false, battleCreated: false, existingBattleId: null },
    phase: 'uncertain', displayState: 'uncertain', ceremony: 'error', kind: 'uncertain', battleId: null,
  },
  'existing_battle that says battleCreated:true': {
    result: { outcome: 'existing_battle', success: false, battleCreated: true, existingBattleId: 'bt_live' },
    phase: 'uncertain', displayState: 'uncertain', ceremony: 'error', kind: 'uncertain', battleId: null,
  },
  'refused after a POST (a typed 429)': {
    result: { outcome: 'refused', success: false, postIssued: true, httpStatus: 429, error: 'cooldown', details: 'Please wait 2 minutes between deploys' },
    phase: 'refused', displayState: 'failed', ceremony: 'error', tone: 'confirmed', kind: 'refused', line: 'Please wait 2 minutes between deploys', postIssued: true,
  },
  'refused, review due (typed)': {
    result: { outcome: 'refused', success: false, postIssued: true, httpStatus: 409, error: DEPLOY_REFUSAL_CODE, details: DUE_DEPLOY_LINE },
    phase: 'refused', displayState: 'failed', ceremony: 'error', tone: 'confirmed', kind: 'review_due', line: DUE_DEPLOY_LINE, postIssued: true,
  },
  'refused before any POST (a typed preflight refusal)': {
    result: { outcome: 'refused', success: false, postIssued: false, error: 'no-agent' },
    phase: 'refused', displayState: 'failed', ceremony: 'error', tone: 'confirmed', kind: 'refused', line: null, postIssued: false,
  },
  'uncertain': {
    result: { outcome: 'uncertain', success: false, postIssued: true, httpStatus: null, error: 'deploy_network' },
    phase: 'uncertain', displayState: 'uncertain', ceremony: 'error', tone: 'lost_contact', kind: 'uncertain', battleId: null,
  },
  'orphaned: a local ownership disposition': {
    result: { outcome: 'orphaned', success: false, postIssued: true },
    phase: 'orphaned', displayState: null, ceremony: 'closed', kind: 'orphaned', battleId: null,
  },
  'an outcome string outside the vocabulary is untyped': {
    result: { outcome: 'success', success: true, agentBattleId: REAL_ID },
    phase: 'uncertain', displayState: 'uncertain', ceremony: 'error', kind: 'untyped', battleId: null,
  },
});

/**
 * Where S2b asks isCurrent (spec §5.3, §11.3 "Ownership C2": token, clone,
 * POST, body, handoff, verification, Enter). An identity change at any of them
 * makes every later one stale.
 */
export const C2_BOUNDARIES = Object.freeze([
  'token acquisition', 'clone ensure', 'deploy POST', 'response body', 'target-resolved callback',
  'App handoff', 'optimistic append', 'stash', 'navigation', 'verification', 'Enter battle',
  'ceremony notification', 'result display',
]);

/**
 * The spec §11.3 "Ownership C2" cases, by name (S2a review A1-6, A2-7): where
 * S2a exercises each — `file` and the exact row titles — or `deferredTo` the
 * slice that owns it, because it needs the provider, the root bridge or the
 * service, which S2a does not build. ownership.test.js checks every cited
 * title exists.
 */
export const C2_CASES = Object.freeze({
  'change uid during token / clone / POST / body / handoff / verification / Enter': {
    file: 'hub/selectors/ownership.test.js',
    rows: ['a change at one boundary leaves every later boundary stale: the epochs never move back'],
  },
  'A → B → A': {
    file: 'hub/selectors/attemptReducer.test.js',
    rows: ['A → B → A: nothing of the first A request survives, and the second A starts fresh'],
  },
  'late target callback': {
    file: 'hub/selectors/attemptReducer.test.js',
    rows: ['a late target callback (stale tag, account change, after the result) changes nothing'],
  },
  'preserve owner and real id': {
    file: 'hub/selectors/attemptReducer.test.js',
    rows: ['translates by §5.2 and stores the real server id, never stamping the current uid'],
  },
  'no old append / stash / navigation / result': {
    file: 'hub/selectors/attemptReducer.test.js',
    rows: ['is ignored unless current: another attempt id, another epoch, or after an account change'],
    deferredTo: 'S2b — the append, stash and navigation are the provider\'s and App\'s effects; S2a holds only the result half',
  },
  'server battle remains': {
    deferredTo: 'S2b and R1 — S2a deletes nothing and holds no writer',
  },
  'new account readiness independent': {
    file: 'hub/selectors/attemptReducer.test.js',
    rows: ['orphan cleanup: the old owner\'s result never displays, and the new account does not wait for the old promise'],
  },
});

/** The spec §11.3 "Vocabulary C3" cases, by name; attemptReducer.test.js runs one sequence per name. */
export const C3_CASES = Object.freeze([
  'every service outcome and ceremony phase maps by §5.2',
  'handoff_failed retains the real id and the legacy failure',
  'dismissing a known terminal is immediate, with the owner + target cooldown kept apart',
  'dismissed uncertainty still blocks a fresh hold, tap or POST Retry until explicit reconciliation',
  'a failed check stays uncertain',
  'an admitted recovered resolution confirms while the original service evidence remains',
  'an owned battle outside the recovery gates is existing',
  'another account or target inherits neither countdown nor guard',
  'a fast refusal and a late losing completion',
  'orphan cleanup',
  'no selector uses a stored confirmed or failed phase',
]);
