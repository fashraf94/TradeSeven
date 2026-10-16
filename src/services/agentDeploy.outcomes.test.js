// src/services/agentDeploy.outcomes.test.js
//
// Command Center repair R1 — the deploy service's full result table (rulings
// R-R1-2, R-R1-3) and its identity guard (R-R1-4). One row per return path,
// every legacy field pinned beside the typed `outcome`; then the ownership
// boundary at each await.
//
// The responses are decide.js's own shapes (api/agent/decide.js, read-only):
// the created 200 (battleCreated:true + agentBattleId), the existing-battle 200
// (battleCreated:false + existingBattleId), the two 429s from the lock and the
// cooldown, the 409 review-due refusal, the 503s, the single catch's 500; and
// the shared rate limiter's 429 (api/_utils/rateLimit.js), which sits in front
// of the handler.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { getIdTokenMock, auth } = vi.hoisted(() => ({ getIdTokenMock: vi.fn(), auth: { uid: 'uid-A' } }));
// The casual-clone ensure runs in every row here (its production value, stated
// so the file does not silently depend on it; review L5-9). The flag-off
// boundaries are in agentDeploy.outcomes.flagOff.test.js.
vi.mock('../config/featureFlags', async (importOriginal) => ({ ...(await importOriginal()), CASUAL_CLONE_CONCURRENCY_ENABLED: true }));
vi.mock('../firebase/authService', () => ({
  getIdToken: getIdTokenMock,
  getCurrentUser: () => (auth.uid ? { uid: auth.uid } : null),
}));

const { deployAgent } = await import('./agentDeploy');
const { DEPLOY_OUTCOMES } = await import('../constants/deployOutcomes');
const { DEPLOY_REFUSAL_CODE, DUE_DEPLOY_LINE } = await import('../constants/hypothesisRecords');
// The hub's translator (S2a). A test file may import it; the main graph may not.
const { translateServiceResult } = await import('../components/CommandCenter/hub/selectors/attemptVocabulary');

const RANKED = 'agent-ranked-1';
const CLONE = 'casual-agent-uid-A';
const CREATED_200 = {
  success: true, portfolioUpdated: true, battleCreated: true, agentBattleId: 'battle-new',
  expiresAt: '2026-10-16T20:00:00.000Z', portfolio: { star: [] }, bench: { stocks: [] },
  opponent: { star: [] }, opponentBench: null, innerMonologue: 'm', strategyBrief: 'b',
};
const EXISTING_200 = {
  success: true, portfolioUpdated: true, battleCreated: false, reason: 'Agent already has an active battle',
  existingBattleId: 'battle-running', portfolio: { star: [] }, bench: { stocks: [] }, innerMonologue: 'm', strategyBrief: 'b',
};

const json = (status, body) => ({ ok: status >= 200 && status < 300, status, statusText: 'x', text: async () => JSON.stringify(body) });
const page = (status, body, statusText = 'Bad Gateway') => ({ ok: status >= 200 && status < 300, status, statusText, text: async () => body });

let reported;
/** Routes the clone ensure and the decide POST; `decide` is a response, an Error to throw, or a function. */
function stubFetch(decide, { onClone } = {}) {
  globalThis.fetch = vi.fn(async (url) => {
    if (url === '/api/agent/ensure-casual-clone') { onClone?.(); return json(200, { cloneId: CLONE }); }
    if (typeof decide === 'function') return decide();
    if (decide instanceof Error) throw decide;
    return decide;
  });
}
const decideCalls = () => globalThis.fetch.mock.calls.filter(([url]) => url === '/api/agent/decide').length;
const run = (cb = null, options) => deployAgent(RANKED, cb, (id) => reported.push(id), options);

beforeEach(() => {
  auth.uid = 'uid-A';
  reported = [];
  getIdTokenMock.mockReset();
  getIdTokenMock.mockResolvedValue('tok');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); delete globalThis.fetch; });

// ═══════════════════════════════════════════════════════════════════════════
// The result table (R-R1-3): status → outcome → legacy fields.
// ═══════════════════════════════════════════════════════════════════════════
describe('the result table: every path, every legacy field, its outcome', () => {
  it('no agent: refused before anything, no POST', async () => {
    globalThis.fetch = vi.fn();
    expect(await deployAgent(null, vi.fn(), vi.fn())).toEqual({ outcome: 'refused', success: false, postIssued: false, error: 'no-agent' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('no token: refused, postIssued false, no POST — exactly the legacy auth-required preflight', async () => {
    getIdTokenMock.mockResolvedValue(null);
    stubFetch(json(200, CREATED_200));
    expect(await run(vi.fn())).toEqual({ outcome: 'refused', success: false, postIssued: false, error: 'auth-required' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('a network failure after the POST left: uncertain, httpStatus null', async () => {
    stubFetch(new TypeError('Failed to fetch'));
    expect(await run(vi.fn())).toEqual({
      outcome: 'uncertain', success: false, postIssued: true, httpStatus: null,
      error: 'deploy_network', details: 'Failed to fetch',
    });
  });

  it.each([
    [502, '<html>gateway</html>', '<html>gateway</html>'],
    [504, 'An error occurred with your deployment\n\nFUNCTION_INVOCATION_TIMEOUT', 'An error occurred with your deployment\n\nFUNCTION_INVOCATION_TIMEOUT'],
    [500, '', 'Bad Gateway'],
    [404, '<!doctype html>Not Found', '<!doctype html>Not Found'],
    [200, 'OK', 'OK'],
  ])('a non-JSON %s body is uncertain whatever the status', async (status, body, details) => {
    stubFetch(page(status, body));
    const cb = vi.fn();
    expect(await run(cb)).toEqual({
      outcome: 'uncertain', success: false, status, postIssued: true, httpStatus: status,
      error: `deploy_http_${status}`, details,
    });
    expect(cb).not.toHaveBeenCalled();
  });

  it.each([500, 502, 504])('a JSON %s is uncertain: it may follow the commit', async (status) => {
    stubFetch(json(status, { error: 'Failed to generate portfolio', details: 'model overloaded', errorPhase: 'post_decision' }));
    expect(await run(vi.fn())).toEqual({
      outcome: 'uncertain', success: false, status, postIssued: true, httpStatus: status,
      error: 'Failed to generate portfolio', details: 'model overloaded', errorPhase: 'post_decision',
    });
  });

  it('409 review due: refused, the shared line verbatim in details, the typed code beside it', async () => {
    stubFetch(json(409, { error: DEPLOY_REFUSAL_CODE, message: DUE_DEPLOY_LINE }));
    const out = await run(vi.fn());
    expect(out).toEqual({
      outcome: 'refused', code: DEPLOY_REFUSAL_CODE, success: false, status: 409, postIssued: true, httpStatus: 409,
      error: DEPLOY_REFUSAL_CODE, details: DUE_DEPLOY_LINE, errorPhase: undefined,
    });
    expect(out.details).toBe('This idea is due for review — reaffirm it first (one tap, same content if you want), and the fresh version deploys.');
  });

  it.each([
    ['Deploy already in progress', 'in_progress'],
    ['Please wait 2 minutes between deploys', 'cooldown'],
  ])('429 "%s": refused, reason %s', async (error, reason) => {
    stubFetch(json(429, { error }));
    expect(await run(vi.fn())).toEqual({
      outcome: 'refused', reason, success: false, status: 429, postIssued: true, httpStatus: 429,
      error, details: undefined, errorPhase: undefined,
    });
  });

  it('the rate limiter\'s 429 (rateLimit.js) is refused with no reason; its wait in seconds rides along as retryAfter (founder ruling Q3)', async () => {
    stubFetch(json(429, { success: false, error: 'Rate limit exceeded', message: 'Too many requests. Please try again in 41 seconds.', retryAfter: 41 }));
    const out = await run(vi.fn());
    expect(out).toEqual({
      outcome: 'refused', success: false, status: 429, postIssued: true, httpStatus: 429,
      error: 'Rate limit exceeded', details: undefined, errorPhase: undefined, retryAfter: 41,
    });
    expect(out).not.toHaveProperty('reason');
  });

  it.each([['a string', '41'], ['null', null], ['NaN (sent as null)', NaN], ['absent', undefined]])(
    'a limiter body whose retryAfter is %s forwards none (founder ruling Q3)', async (_label, retryAfter) => {
      stubFetch(json(429, { success: false, error: 'Rate limit exceeded', retryAfter }));
      expect(await run(vi.fn())).not.toHaveProperty('retryAfter');
    },
  );

  it('503 stock admission with reason corrected_creation_failed is uncertain — it can follow a commit (founder ruling Q1); its player line is kept', async () => {
    stubFetch(json(503, { error: 'Stock admission unavailable', reason: 'corrected_creation_failed', retriable: true }));
    expect(await run(vi.fn())).toEqual({
      outcome: 'uncertain', success: false, status: 503, postIssued: true, httpStatus: 503,
      error: 'Stock admission unavailable', details: 'Measured scoring could not start this battle just now. Try again in a minute.', errorPhase: undefined,
    });
  });

  it.each(['prior_corrected_battle_requires_settlement', 'provider_failure', 'creation_selection_changed', 'publication_window_not_open'])(
    'every other stock-admission reason (%s) stays refused (founder ruling Q1 names one reason)', async (reason) => {
      stubFetch(json(503, { error: 'Stock admission unavailable', reason, retriable: true }));
      expect((await run(vi.fn())).outcome).toBe('refused');
    },
  );

  it('503 stock admission: refused, with its player line', async () => {
    stubFetch(json(503, { error: 'Stock admission unavailable', reason: 'publication_window_not_open', retriable: true }));
    expect(await run(vi.fn())).toEqual({
      outcome: 'refused', success: false, status: 503, postIssued: true, httpStatus: 503,
      error: 'Stock admission unavailable', details: 'Measured battles reopen 15 minutes after the market close. Try again shortly.', errorPhase: undefined,
    });
  });

  it.each([
    [503, { error: 'pricing_unavailable', reason: 'pricing_unavailable', retriable: true }],
    [503, { error: 'Stock rankings not available. Cron may not have run yet.' }],
    [400, { error: 'agentId required' }],
    // api/_utils/authMiddleware.js requireAuth's own body (review L4-4).
    [401, { error: 'Authentication required', message: 'Invalid or expired token' }],
    [403, { error: 'ownership_mismatch', message: 'You can only deploy your own agent' }],
    [404, { error: 'Agent not found' }],
    [409, { error: 'compiled_build_unverifiable', message: 'internal reason' }],
    [409, { error: 'projection_stale_generation' }],
    [418, { error: 'any other 4xx' }],
  ])('a JSON %s (%j) is refused, legacy fields unchanged, no code', async (status, body) => {
    stubFetch(json(status, body));
    const out = await run(vi.fn());
    expect(out).toEqual({
      outcome: 'refused', success: false, status, postIssued: true, httpStatus: status,
      error: body.error, details: undefined, errorPhase: undefined,
    });
    expect(out).not.toHaveProperty('code');
  });

  it('a JSON 200 that is not success:true is uncertain', async () => {
    stubFetch(json(200, { success: false, error: 'odd' }));
    expect(await run(vi.fn())).toEqual({
      outcome: 'uncertain', success: false, status: 200, postIssued: true, httpStatus: 200,
      error: 'odd', details: undefined, errorPhase: undefined,
    });
  });

  it('the created 200: created, success:true, the real id; the handoff gets that id and the captured owner', async () => {
    stubFetch(json(200, CREATED_200));
    const cb = vi.fn();
    expect(await run(cb)).toEqual({ outcome: 'created', success: true, agentBattleId: 'battle-new' });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(CREATED_200.portfolio, CREATED_200.bench, {
      agentId: CLONE, agentBattleId: 'battle-new', ownerUid: 'uid-A',
      innerMonologue: 'm', strategyBrief: 'b', expiresAt: '2026-10-16T20:00:00.000Z',
      opponent: { star: [] }, opponentBench: null,
    });
    expect(reported).toEqual([RANKED, CLONE]);
  });

  it('the created 200 with no callback is still created', async () => {
    stubFetch(json(200, CREATED_200));
    expect(await run(null)).toEqual({ outcome: 'created', success: true, agentBattleId: 'battle-new' });
  });

  it('the existing-battle 200: existing_battle, no callback, no battle id, nothing created (IR-01)', async () => {
    stubFetch(json(200, EXISTING_200));
    const cb = vi.fn();
    expect(await run(cb)).toEqual({
      outcome: 'existing_battle', success: false, existingBattleId: 'battle-running', postIssued: true, httpStatus: 200,
    });
    expect(cb).not.toHaveBeenCalled();
  });

  it('a handoff that throws after a real creation: handoff_failed with that real battleId', async () => {
    stubFetch(json(200, CREATED_200));
    expect(await run(() => { throw new Error('boom'); })).toEqual({
      outcome: 'handoff_failed', success: false, status: 200, postIssued: true, httpStatus: 200,
      battleId: 'battle-new', error: 'deploy_handoff', details: 'boom',
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The 200 matrix: (agentBattleId, existingBattleId, battleCreated).
// ═══════════════════════════════════════════════════════════════════════════
describe('the 200 matrix: a creation needs its id, an existing battle needs its id and the flag', () => {
  const MALFORMED = {
    outcome: 'uncertain', success: false, status: 200, postIssued: true, httpStatus: 200,
    battleId: null, error: 'deploy_no_battle_id', details: 'The deploy finished without naming a battle.',
  };
  it.each([
    ['neither id', { success: true }],
    ['the created flag with no id', { success: true, battleCreated: true }],
    ['the existing flag with no id', { success: true, battleCreated: false }],
    ['the existing flag with only a new-battle id', { success: true, battleCreated: false, agentBattleId: 'battle-x' }],
    ['the created flag with only an existing id', { success: true, battleCreated: true, existingBattleId: 'battle-y' }],
    ['an existing id with no flag', { success: true, existingBattleId: 'battle-y' }],
    ['an empty new id', { success: true, battleCreated: true, agentBattleId: '' }],
    ['a padded new id', { success: true, battleCreated: true, agentBattleId: ' battle-x ' }],
    ['a non-string new id', { success: true, battleCreated: true, agentBattleId: 42 }],
    ['an empty existing id', { success: true, battleCreated: false, existingBattleId: '' }],
    ['a non-string existing id', { success: true, battleCreated: false, existingBattleId: { id: 'x' } }],
  ])('%s → uncertain, no handoff, no id', async (_label, body) => {
    stubFetch(json(200, body));
    const cb = vi.fn();
    expect(await run(cb)).toEqual(MALFORMED);
    expect(cb).not.toHaveBeenCalled();
  });

  it('a real new id with no flag stays a creation, as before R1', async () => {
    stubFetch(json(200, { success: true, agentBattleId: 'battle-x' }));
    const cb = vi.fn();
    expect(await run(cb)).toEqual({ outcome: 'created', success: true, agentBattleId: 'battle-x' });
    expect(cb.mock.calls[0][2].agentBattleId).toBe('battle-x');
  });

  it('the existing flag with both ids is the existing battle: the existing branch is checked first', async () => {
    stubFetch(json(200, { success: true, battleCreated: false, existingBattleId: 'battle-y', agentBattleId: 'battle-x' }));
    const cb = vi.fn();
    expect((await run(cb)).outcome).toBe('existing_battle');
    expect(cb).not.toHaveBeenCalled();
  });

  it('the handoff never receives a null or fabricated id', async () => {
    stubFetch(json(200, CREATED_200));
    const cb = vi.fn();
    await run(cb);
    const id = cb.mock.calls[0][2].agentBattleId;
    expect(id).toBe('battle-new');
    expect(id).not.toMatch(/^agent_/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The identity guard (R-R1-4): the uid captured at entry, after every await.
// ═══════════════════════════════════════════════════════════════════════════
describe('the identity guard: a changed or absent uid orphans the deploy at each boundary', () => {
  const ORPHANED_BEFORE_POST = { outcome: 'orphaned', success: false, postIssued: false };
  const ORPHANED_AFTER_POST = { outcome: 'orphaned', success: false, postIssued: true };

  it('after the token: another account → orphaned, no clone ensure, no POST, no clone report', async () => {
    getIdTokenMock.mockImplementation(async () => { auth.uid = 'uid-B'; return 'tok'; });
    stubFetch(json(200, CREATED_200));
    const cb = vi.fn();
    expect(await run(cb)).toEqual(ORPHANED_BEFORE_POST);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(reported).toEqual([RANKED]);
    expect(cb).not.toHaveBeenCalled();
  });

  it('after the token: signed out → orphaned the same way (absent is a change)', async () => {
    getIdTokenMock.mockImplementation(async () => { auth.uid = null; return 'tok'; });
    stubFetch(json(200, CREATED_200));
    expect(await run(vi.fn())).toEqual(ORPHANED_BEFORE_POST);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('nobody signed in at entry: the token preflight answers first (auth-required) …', async () => {
    auth.uid = null;
    getIdTokenMock.mockResolvedValue(null);
    stubFetch(json(200, CREATED_200));
    expect((await run(vi.fn())).error).toBe('auth-required');
  });

  it('… and a token without a signed-in uid is never used: the guard is not open by default', async () => {
    auth.uid = null;
    stubFetch(json(200, CREATED_200));
    expect(await run(vi.fn())).toEqual(ORPHANED_BEFORE_POST);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('after the clone ensure: orphaned, no POST, the clone never reported', async () => {
    stubFetch(json(200, CREATED_200), { onClone: () => { auth.uid = 'uid-B'; } });
    const cb = vi.fn();
    expect(await run(cb)).toEqual(ORPHANED_BEFORE_POST);
    expect(decideCalls()).toBe(0);
    expect(reported).toEqual([RANKED]);
    expect(cb).not.toHaveBeenCalled();
  });

  it('after the POST: orphaned with postIssued true, no handoff; the server battle is left alone (no further request)', async () => {
    stubFetch(() => { auth.uid = 'uid-B'; return json(200, CREATED_200); });
    const cb = vi.fn();
    expect(await run(cb)).toEqual(ORPHANED_AFTER_POST);
    expect(cb).not.toHaveBeenCalled();
    expect(globalThis.fetch.mock.calls.map(([url]) => url)).toEqual(['/api/agent/ensure-casual-clone', '/api/agent/decide']);
  });

  it('after a POST that failed in transit: orphaned, not the old owner\'s network failure', async () => {
    stubFetch(() => { auth.uid = 'uid-B'; throw new TypeError('Failed to fetch'); });
    expect(await run(vi.fn())).toEqual(ORPHANED_AFTER_POST);
  });

  it('after the body read: orphaned, no handoff', async () => {
    stubFetch(() => ({ ok: true, status: 200, statusText: 'OK', text: async () => { auth.uid = 'uid-B'; return JSON.stringify(CREATED_200); } }));
    const cb = vi.fn();
    expect(await run(cb)).toEqual(ORPHANED_AFTER_POST);
    expect(cb).not.toHaveBeenCalled();
  });

  it('after the body read, an existing-battle answer for a former owner is not shown either', async () => {
    stubFetch(() => ({ ok: true, status: 200, statusText: 'OK', text: async () => { auth.uid = 'uid-B'; return JSON.stringify(EXISTING_200); } }));
    expect(await run(vi.fn())).toEqual(ORPHANED_AFTER_POST);
  });

  it('immediately before the handoff (isCurrent turns false at the fifth check): orphaned, no handoff', async () => {
    // Checks run after the token (1), the clone ensure (2), the POST (3), the
    // body read (4) and before the handoff (5). Only the fifth sees a change.
    stubFetch(json(200, CREATED_200));
    let checks = 0;
    const cb = vi.fn();
    expect(await run(cb, { isCurrent: () => { checks += 1; return checks < 5; } })).toEqual(ORPHANED_AFTER_POST);
    expect(checks).toBe(5);
    expect(cb).not.toHaveBeenCalled();
  });

  it('control: the same count with no change completes the creation', async () => {
    stubFetch(json(200, CREATED_200));
    let checks = 0;
    const cb = vi.fn();
    expect((await run(cb, { isCurrent: () => { checks += 1; return true; } })).outcome).toBe('created');
    expect(checks).toBe(5);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('isCurrent is checked BESIDE the uid, never instead of it', async () => {
    getIdTokenMock.mockImplementation(async () => { auth.uid = 'uid-B'; return 'tok'; });
    stubFetch(json(200, CREATED_200));
    expect(await run(vi.fn(), { isCurrent: () => true })).toEqual(ORPHANED_BEFORE_POST);
  });

  it.each([
    ['false', () => false],
    ['a truthy non-true value', () => 1],
    ['a throw', () => { throw new Error('epoch read failed'); }],
  ])('isCurrent returning %s orphans at the first boundary (only a literal true keeps it current)', async (_label, isCurrent) => {
    stubFetch(json(200, CREATED_200));
    expect(await run(vi.fn(), { isCurrent })).toEqual(ORPHANED_BEFORE_POST);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['false', false],
    ['a precomputed true', true],
    ['an object', { epoch: 2 }],
  ])('isCurrent passed as %s, not a function, keeps nothing current (review L2-3)', async (_label, isCurrent) => {
    stubFetch(json(200, CREATED_200));
    expect(await run(vi.fn(), { isCurrent })).toEqual(ORPHANED_BEFORE_POST);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('a token lost to an account change is the change, not a missing sign-in (review L2-4)', async () => {
    getIdTokenMock.mockImplementation(async () => { auth.uid = 'uid-B'; return null; });
    expect(await run(vi.fn())).toEqual(ORPHANED_BEFORE_POST);
  });

  it('a null token with a stale isCurrent is orphaned, not auth-required (review L5-10)', async () => {
    getIdTokenMock.mockResolvedValue(null);
    expect(await run(vi.fn(), { isCurrent: () => false })).toEqual(ORPHANED_BEFORE_POST);
  });

  it('a token refresh that fails with the same account signed in stays auth-required', async () => {
    getIdTokenMock.mockResolvedValue(null);
    expect((await run(vi.fn())).error).toBe('auth-required');
  });

  it('an orphaned deploy leaves one warning, never an error (review L1-1)', async () => {
    getIdTokenMock.mockImplementation(async () => { auth.uid = 'uid-B'; return 'tok'; });
    stubFetch(json(200, CREATED_200));
    await run(vi.fn());
    expect(console.warn).toHaveBeenCalledWith('[Deploy] The signed-in account changed during the deploy; nothing further was done.', { postIssued: false });
    expect(console.error).not.toHaveBeenCalled();
  });

  it('a deploy with nobody signed in at entry names that case in its warning', async () => {
    auth.uid = null;
    stubFetch(json(200, CREATED_200));
    await run(vi.fn());
    expect(console.warn).toHaveBeenCalledWith('[Deploy] No signed-in account when the deploy started; nothing further was done.', { postIssued: false });
  });

  it('A→B→A inside one await is invisible to the uid alone; an epoch passed as isCurrent catches it', async () => {
    let epoch = 1;
    getIdTokenMock.mockImplementation(async () => { auth.uid = 'uid-B'; epoch += 1; auth.uid = 'uid-A'; epoch += 1; return 'tok'; });
    stubFetch(json(200, CREATED_200));
    const captured = epoch;
    expect(await run(vi.fn(), { isCurrent: () => epoch === captured })).toEqual(ORPHANED_BEFORE_POST);
  });

  it('the unchanged owner with every check passing is the ordinary creation (control)', async () => {
    stubFetch(json(200, CREATED_200));
    const cb = vi.fn();
    expect((await run(cb)).outcome).toBe(DEPLOY_OUTCOMES.CREATED);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The hub reads what the service writes: every R1 result through S2a's own
// translateServiceResult lands on spec V1.2 §5.2's provider phase.
// ═══════════════════════════════════════════════════════════════════════════
describe('the hub\'s translator reads every R1 result as spec §5.2 says', () => {
  const translated = async (decide, cb = vi.fn()) => { stubFetch(decide); return translateServiceResult(await run(cb)); };

  it('created → provider created, ceremony theater, the real id', async () => {
    const t = await translated(json(200, CREATED_200));
    expect([t.phase, t.ceremony.phase, t.detail.kind, t.detail.battleId]).toEqual(['created', 'theater', 'created', 'battle-new']);
  });

  it('existing_battle → provider existing, the existing terminal, the server\'s id — never created', async () => {
    const t = await translated(json(200, EXISTING_200));
    expect([t.phase, t.ceremony.phase, t.detail.kind, t.detail.battleId]).toEqual(['existing', 'existing', 'existing', 'battle-running']);
  });

  it('handoff_failed → provider created with the handoff detail and the real id, verifying', async () => {
    const t = await translated(json(200, CREATED_200), () => { throw new Error('boom'); });
    expect([t.phase, t.ceremony.phase, t.detail.kind, t.detail.battleId]).toEqual(['created', 'verifying', 'handoff', 'battle-new']);
  });

  it('the 409 review-due refusal → refused, its line kept, the confirmed-refusal tone', async () => {
    const t = await translated(json(409, { error: DEPLOY_REFUSAL_CODE, message: DUE_DEPLOY_LINE }));
    expect([t.phase, t.ceremony.errorTone, t.detail.kind, t.detail.line, t.displayState]).toEqual(['refused', 'confirmed', 'review_due', DUE_DEPLOY_LINE, 'failed']);
  });

  it.each([
    ['the cooldown 429', json(429, { error: 'Please wait 2 minutes between deploys' })],
    ['the stock-admission 503', json(503, { error: 'Stock admission unavailable', reason: 'publication_window_not_open' })],
    ['a 403', json(403, { error: 'ownership_mismatch' })],
  ])('%s → refused, a failure the hub shows as definitive', async (_label, response) => {
    const t = await translated(response);
    expect([t.phase, t.detail.kind, t.detail.postIssued]).toEqual(['refused', 'refused', true]);
  });

  it.each([
    ['a network failure', new TypeError('Failed to fetch')],
    ['a JSON 500', json(500, { error: 'Failed to generate portfolio' })],
    ['a non-JSON 502', page(502, '<html>')],
    ['a 200 naming no battle', json(200, { success: true })],
    ['the stock 503 that can follow a commit (founder ruling Q1)', json(503, { error: 'Stock admission unavailable', reason: 'corrected_creation_failed' })],
  ])('%s → uncertain, lost contact, never typed-away as untyped', async (_label, response) => {
    const t = await translated(response);
    expect([t.phase, t.ceremony.errorTone, t.detail.kind]).toEqual(['uncertain', 'lost_contact', 'uncertain']);
  });

  it('a preflight refusal → refused with postIssued false (no deploy cooldown follows)', async () => {
    const t = translateServiceResult(await deployAgent(null, vi.fn(), vi.fn()));
    expect([t.phase, t.detail.postIssued]).toEqual(['refused', false]);
  });

  it('orphaned → the local disposition: nothing shown', async () => {
    getIdTokenMock.mockImplementation(async () => { auth.uid = 'uid-B'; return 'tok'; });
    const t = await translated(json(200, CREATED_200));
    expect([t.phase, t.displayState, t.detail.postIssued]).toEqual(['orphaned', null, false]);
  });
});
