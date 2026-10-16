// src/components/CommandCenter/__fixtures__/deployStateFixtures.js
//
// Command Center hub, slice S2a — the deploy selector's fixtures, for TESTS
// ONLY (hub/selectors/deployState.test.js). Inputs follow the contract in
// hub/hubModel.js: a signed-in owner, reader results tagged with their owner
// and auth epoch, the active poll's retained battle documents.
//
//   TABLE_ROWS       one case per spec §3.1 row, in the table's order
//   PRECEDENCE_ROWS  inputs that satisfy several rows at once: the first wins
//   C1_CASES         every spec §11.3 "Eligibility C1" case, by name
//   GATE_LISTS       the gate-parity matrix's live lists
//
// Times are ms since the epoch; NOW is fixed. No clock is read.

import { DEPLOY_BLOCK_REASON } from '../../../utils/commandCenterLiveBattles';

export const UID = 'owner-a';
export const OTHER_UID = 'owner-b';
export const EPOCH = 3;
export const NOW = Date.UTC(2026, 9, 14, 14, 40);
export const MINUTE = 60000;
export const AS_OF = NOW - 2 * MINUTE;

export const AUTH = Object.freeze({ signedIn: true, uid: UID, authEpoch: EPOCH });

const owned = (uid = UID, epoch = EPOCH) => ({ ownerUid: uid, ownerEpoch: epoch });

/** Battle documents as the active poll holds them (App.jsx: ownerId, agentId, groupId, status). */
export const BATTLES = Object.freeze({
  baggerbomb: Object.freeze({ id: 'bb_1', ownerId: UID, agentId: `casual-agent-${UID}`, status: 'active', activatedAt: '2026-10-14T13:30:00Z' }),
  ranked: Object.freeze({ id: 'rk_1', ownerId: UID, agentId: 'agent-a', groupId: 'group_1', status: 'active', activatedAt: '2026-10-14T13:31:00Z' }),
  training: Object.freeze({ id: 'tr_1', ownerId: UID, agentId: 'training-agent-group_2-owner-a', groupId: 'group_2', status: 'active', activatedAt: '2026-10-14T13:32:00Z' }),
  foreign: Object.freeze({ id: 'fx_1', ownerId: OTHER_UID, agentId: `casual-agent-${OTHER_UID}`, status: 'active', activatedAt: '2026-10-14T13:33:00Z' }),
  /** A real-agent BaggerBomb (a deploy that fell back from the clone): no groupId, still BaggerBomb. */
  realAgentBaggerBomb: Object.freeze({ id: 'bb_2', ownerId: UID, agentId: 'agent-a', status: 'active', activatedAt: '2026-10-14T13:34:00Z' }),
});

export const agentReady = (over = {}) => ({ status: 'ready', agent: { id: 'agent-a', stats: { gamesPlayed: 7 } }, error: null, ...owned(), ...over });
export const pollReady = (liveBattles = [], over = {}) => ({
  status: 'ready', liveBattles, lastSuccessfulAt: AS_OF, error: null, refreshing: false, ...owned(), ...over,
});
export const pollInitial = (over = {}) => ({
  status: 'loading', liveBattles: null, lastSuccessfulAt: null, error: null, refreshing: false, ownerUid: null, ownerEpoch: null, ...over,
});
export const completedReady = (rows = [], over = {}) => ({ status: 'ready', rows, error: null, ...owned(), ...over });

/** A ready, eligible owner: every reader resolved for (UID, EPOCH), nothing live, concurrency on. */
export const base = (over = {}) => ({
  auth: AUTH,
  agent: agentReady(),
  poll: pollReady([]),
  completed: completedReady([{ id: 'done_1' }]),
  attempt: null,
  hold: null,
  cooldown: null,
  now: NOW,
  concurrencyEnabled: true,
  modalOpen: false,
  ...over,
});

/** A provider record for this owner (selectors/attemptVocabulary.js), in `phase`. */
export const attemptFor = (phase, over = {}) => ({
  attemptId: 'att_1', capturedUid: UID, authEpoch: EPOCH, attemptEpoch: 1, targetAgentId: `casual-agent-${UID}`,
  startedAt: NOW - 5000, phase, result: null, ceremonyPhase: null, errorTone: null, acknowledgedAt: null,
  cooldownUntil: null, reconciliationStatus: 'not_checked', resolution: null, ...over,
});

export const HOLD = Object.freeze({ controlId: 'deploy-card', holdToken: 'tok_1', holdEpoch: 2, phase: 'charging' });
export const COOLDOWN = Object.freeze({ ownerUid: UID, targetAgentId: `casual-agent-${UID}`, cooldownUntil: NOW + 90000 });

/** One case per spec §3.1 row, in the table's order. */
export const TABLE_ROWS = Object.freeze([
  { row: 1, name: 'signed out', inputs: base({ auth: { signedIn: false } }), displayState: 'signed_out', canStart: false },
  { row: 2, name: 'an actual auth change not yet reset: the attempt was captured at an older auth epoch', inputs: base({ attempt: attemptFor('submitting', { authEpoch: EPOCH - 1 }) }), displayState: 'account_transition', canStart: false },
  { row: 2, name: 'positively foreign resolved metadata: the poll result belongs to another owner', inputs: base({ poll: pollReady([], owned(OTHER_UID, EPOCH)) }), displayState: 'account_transition', canStart: false },
  { row: 3, name: "this owner's unacknowledged attempt (submitting)", inputs: base({ attempt: attemptFor('submitting') }), displayState: 'submitting', canStart: false },
  { row: 3, name: "this owner's hold", inputs: base({ hold: HOLD }), displayState: 'ready', canStart: false },
  { row: 3, name: 'an unresolved uncertain attempt whose overlay was dismissed', inputs: base({ attempt: attemptFor('uncertain', { ceremonyPhase: 'closed', result: { kind: 'untyped' } }) }), displayState: 'uncertain', canStart: false },
  { row: 4, name: 'an applicable owner + target cooldown', inputs: base({ cooldown: COOLDOWN }), displayState: 'cooldown', canStart: false },
  { row: 5, name: 'agent loading', inputs: base({ agent: { status: 'loading', agent: null, ownerUid: null, ownerEpoch: null, error: null } }), displayState: 'loading_agent', canStart: false },
  { row: 5, name: 'agent error', inputs: base({ agent: agentReady({ status: 'error', agent: null, error: 'unavailable' }) }), displayState: 'agent_error', canStart: false },
  { row: 5, name: 'agent resolved absent', inputs: base({ agent: agentReady({ agent: null }) }), displayState: 'no_agent', canStart: false },
  { row: 6, name: 'the retained owned list blocks', inputs: base({ poll: pollReady([BATTLES.baggerbomb]) }), displayState: 'blocked', canStart: false },
  { row: 7, name: 'no successful owned poll, current status error', inputs: base({ poll: pollInitial({ status: 'error', error: 'unavailable' }) }), displayState: 'eligibility_error', canStart: false },
  { row: 8, name: 'no successful owned poll, current status loading', inputs: base({ poll: pollInitial() }), displayState: 'checking', canStart: false },
  { row: 9, name: 'retained list clear, latest poll failed', inputs: base({ poll: pollReady([], { status: 'error', error: 'unavailable' }) }), displayState: 'ready_stale', canStart: true },
  { row: 10, name: 'retained list clear, a refresh pending', inputs: base({ poll: pollReady([], { status: 'loading' }) }), displayState: 'ready', canStart: true },
  { row: 11, name: 'latest poll ready, list clear', inputs: base(), displayState: 'ready', canStart: true },
]);

/** Inputs that satisfy several rows at once: the first matching row wins (§3.1). */
export const PRECEDENCE_ROWS = Object.freeze([
  {
    name: 'signed-out beats everything',
    inputs: base({ auth: { signedIn: false }, attempt: attemptFor('uncertain'), hold: HOLD, cooldown: COOLDOWN, agent: agentReady({ status: 'error', agent: null }), poll: pollReady([BATTLES.baggerbomb], { status: 'error' }), modalOpen: true }),
    displayState: 'signed_out',
  },
  {
    name: 'an account transition beats an attempt, a cooldown and a block',
    inputs: base({ agent: agentReady(owned(OTHER_UID, EPOCH)), attempt: attemptFor('refused'), cooldown: COOLDOWN, poll: pollReady([BATTLES.baggerbomb]) }),
    displayState: 'account_transition',
  },
  {
    name: 'an unresolved uncertain beats cooldown',
    inputs: base({ attempt: attemptFor('uncertain', { ceremonyPhase: 'closed' }), cooldown: COOLDOWN }),
    displayState: 'uncertain',
  },
  {
    name: 'a submitting attempt keeps its words when a newly seen live game would block',
    inputs: base({ attempt: attemptFor('submitting'), poll: pollReady([BATTLES.baggerbomb]) }),
    displayState: 'submitting',
  },
  {
    name: 'cooldown beats agent loading',
    inputs: base({ cooldown: COOLDOWN, agent: { status: 'loading', agent: null, ownerUid: null, ownerEpoch: null } }),
    displayState: 'cooldown',
  },
  {
    name: 'agent loading beats a block and a first-poll failure',
    inputs: base({ agent: { status: 'loading', agent: null, ownerUid: null, ownerEpoch: null }, poll: pollInitial({ status: 'error' }) }),
    displayState: 'loading_agent',
  },
  {
    name: 'a stale active BaggerBomb blocks even while the poll errors',
    inputs: base({ poll: pollReady([BATTLES.baggerbomb], { status: 'error', error: 'unavailable' }) }),
    displayState: 'blocked',
  },
  {
    name: 'a first-poll failure reaches eligibility_error, not checking',
    inputs: base({ poll: pollInitial({ status: 'error', error: 'unavailable' }) }),
    displayState: 'eligibility_error',
  },
  {
    name: 'initial null owner metadata is checking, not account_transition',
    inputs: base({ agent: agentReady(), poll: pollInitial(), completed: { status: 'loading', rows: [], ownerUid: null, ownerEpoch: null } }),
    displayState: 'checking',
  },
  {
    name: 'a latest failure beats a pending refresh: ready_stale',
    inputs: base({ poll: pollReady([], { status: 'error', refreshing: true }) }),
    displayState: 'ready_stale',
  },
]);

/** Every spec §11.3 "Eligibility C1" case, by name. */
export const C1_CASES = Object.freeze({
  'Initial absent metadata → checking': {
    inputs: base({ poll: pollInitial(), completed: { status: 'loading', rows: [], ownerUid: null, ownerEpoch: null } }),
    expect: { displayState: 'checking', canStart: false, gateBlocked: null },
  },
  'first failure → eligibility_error + Retry': {
    inputs: base({ poll: pollInitial({ status: 'error', error: 'unavailable' }) }),
    expect: { displayState: 'eligibility_error', canStart: false, retryAction: 'poll', gateBlocked: null },
  },
  'stale active BaggerBomb → blocked': {
    inputs: base({ poll: pollReady([BATTLES.baggerbomb], { status: 'error', error: 'unavailable' }) }),
    expect: { displayState: 'blocked', canStart: false, gateBlocked: true, reason: DEPLOY_BLOCK_REASON, retryAction: 'poll', freshness: { asOf: AS_OF, stale: true, refreshing: false } },
  },
  'stale clear → ready_stale': {
    inputs: base({ poll: pollReady([], { status: 'error', error: 'unavailable' }) }),
    expect: { displayState: 'ready_stale', canStart: true, gateBlocked: false, retryAction: 'poll', freshness: { asOf: AS_OF, stale: true, refreshing: false } },
  },
  'retained clear + refresh pending → ready with refreshing / as-of annotation': {
    inputs: base({ poll: pollReady([], { status: 'loading' }) }),
    expect: { displayState: 'ready', canStart: true, gateBlocked: false, freshness: { asOf: AS_OF, stale: false, refreshing: true } },
  },
  'retained active + refresh pending → blocked': {
    inputs: base({ poll: pollReady([BATTLES.baggerbomb], { status: 'loading' }) }),
    expect: { displayState: 'blocked', canStart: false, gateBlocked: true, reason: DEPLOY_BLOCK_REASON, freshness: { asOf: AS_OF, stale: false, refreshing: true } },
  },
  'stale ranked-only, concurrency on → ready_stale (a ranked game runs beside a BaggerBomb)': {
    inputs: base({ poll: pollReady([BATTLES.ranked], { status: 'error' }), concurrencyEnabled: true }),
    expect: { displayState: 'ready_stale', canStart: true, gateBlocked: false },
  },
  'stale ranked-only, concurrency off → blocked by the legacy any-live gate, with its null reason': {
    inputs: base({ poll: pollReady([BATTLES.ranked], { status: 'error' }), concurrencyEnabled: false }),
    expect: { displayState: 'blocked', canStart: false, gateBlocked: true, reason: null },
  },
  'actual account change clears old data: the old owner\'s retained list is not used, and nothing can start': {
    inputs: base({ auth: { signedIn: true, uid: OTHER_UID, authEpoch: EPOCH + 1 }, poll: pollReady([]), agent: agentReady() }),
    expect: { displayState: 'account_transition', canStart: false, gateBlocked: null },
  },
  'completed failure never yields the first-deploy suggestion': {
    inputs: base({ agent: agentReady({ agent: { id: 'agent-a', stats: { gamesPlayed: 0 } } }), completed: completedReady([], { status: 'error', error: 'unavailable' }) }),
    expect: { displayState: 'ready', canStart: true },
    firstDeployment: false,
  },
});

/** The gate-parity matrix's live lists (prompt §5): the selector must agree with deriveDeployGate on each, both flag values. */
export const GATE_LISTS = Object.freeze({
  none: [],
  'ranked only': [BATTLES.ranked],
  'BaggerBomb only': [BATTLES.baggerbomb],
  both: [BATTLES.ranked, BATTLES.baggerbomb],
  'training clone only': [BATTLES.training],
  'foreign owner only': [BATTLES.foreign],
  'real-agent BaggerBomb': [BATTLES.realAgentBaggerBomb],
  'training + foreign + ranked': [BATTLES.training, BATTLES.foreign, BATTLES.ranked],
});
