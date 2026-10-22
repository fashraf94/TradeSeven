// src/services/agentDeploy.refusal.test.js
//
// Pilot P1b (build prompt item 5; founder ruling B2) made the deploy station
// show the due-idea refusal's table C line verbatim: the endpoint answered a
// due idea with `409 { error: 'hypothesis_review_due', message: <line> }` and
// this service forwarded that one refusal's `message` as `details`.
//
// Pilot P1c (founder ruling E1, 16 Oct 2026) retires it: a due idea never
// blocks a deploy. The endpoint creates the battle carrying nothing and says
// so on its success response (`hypothesisNotice: 'review_due'`), which this
// service carries on the `created` outcome to the ceremony's success screen.
// No endpoint sends the 409 any more and the service no longer reads it — a
// review-due 409 that arrived anyway (an older server) is an ordinary refusal:
// its `message` is not promoted and no code rides. Every other failure
// forwards exactly what it did before.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// R1 (R-R1-4): the deploy is owned by the signed-in uid; one stays signed in throughout.
vi.mock('../firebase/authService', () => ({ getIdToken: async () => 'id-token', getCurrentUser: () => ({ uid: 'uid-1' }) }));
vi.mock('../config/featureFlags', async (importOriginal) => ({ ...(await importOriginal()), CASUAL_CLONE_CONCURRENCY_ENABLED: false }));

const { deployAgent } = await import('./agentDeploy');
const { DUE_DEPLOY_LINE, DEPLOY_REFUSAL_CODE, CARRIAGE_RACE_MESSAGE, HYPOTHESIS_NOTICES } = await import('../constants/hypothesisRecords');

const respond = (status, body) => ({
  ok: status >= 200 && status < 300, status, statusText: 'x', text: async () => JSON.stringify(body),
});
const CREATED_200 = {
  success: true, portfolioUpdated: true, battleCreated: true, agentBattleId: 'battle-new', expiresAt: '2026-10-16T20:00:00.000Z',
  portfolio: { star: [] }, bench: { stocks: [] }, opponent: {}, opponentBench: {}, innerMonologue: 'm', strategyBrief: 'b',
};

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); delete globalThis.fetch; });

describe('Pilot P1c (E1) — the created deploy carries the due-idea notice to the ceremony', () => {
  it('a 200 with hypothesisNotice review_due → created, the notice beside the real id; the handoff runs as for any creation', async () => {
    globalThis.fetch = vi.fn(async () => respond(200, { ...CREATED_200, hypothesisNotice: 'review_due' }));
    const handoff = vi.fn();
    const out = await deployAgent('agent-1', handoff);
    expect(out).toEqual({ outcome: 'created', success: true, agentBattleId: 'battle-new', hypothesisNotice: HYPOTHESIS_NOTICES.reviewDue });
    expect(handoff).toHaveBeenCalledTimes(1);
  });
  it('no notice, or any other value, → exactly R1\'s created result (nothing invented, nothing forwarded)', async () => {
    for (const extra of [{}, { hypothesisNotice: 'something_else' }, { hypothesisNotice: true }, { hypothesisNotice: null }]) {
      globalThis.fetch = vi.fn(async () => respond(200, { ...CREATED_200, ...extra }));
      expect(await deployAgent('agent-1', vi.fn()), JSON.stringify(extra)).toEqual({ outcome: 'created', success: true, agentBattleId: 'battle-new' });
    }
  });
  it('the existing-battle 200 never carries it (no battle was created, so nothing was carried)', async () => {
    globalThis.fetch = vi.fn(async () => respond(200, { success: true, battleCreated: false, existingBattleId: 'battle-live', hypothesisNotice: 'review_due' }));
    const out = await deployAgent('agent-1', vi.fn());
    expect(out.outcome).toBe('existing_battle');
    expect('hypothesisNotice' in out).toBe(false);
  });
});

describe('the retired P1b refusal is an ordinary refusal now', () => {
  it('409 hypothesis_review_due (no endpoint sends it) → refused with the server\'s own fields only: its message is NOT promoted, no code rides', async () => {
    globalThis.fetch = vi.fn(async () => respond(409, { error: DEPLOY_REFUSAL_CODE, message: DUE_DEPLOY_LINE }));
    const out = await deployAgent('agent-1', vi.fn());
    expect(out).toEqual({
      outcome: 'refused',
      success: false, status: 409, postIssued: true, httpStatus: 409,
      error: 'hypothesis_review_due', details: undefined, errorPhase: undefined,
    });
  });
  it('every other failure forwards exactly what it did before: a message on another error is not promoted', async () => {
    globalThis.fetch = vi.fn(async () => respond(409, { error: 'compiled_build_unverifiable', message: 'internal reason' }));
    expect((await deployAgent('agent-1', vi.fn())).details).toBeUndefined();
    globalThis.fetch = vi.fn(async () => respond(500, { error: 'Failed to generate portfolio', details: CARRIAGE_RACE_MESSAGE }));
    const race = await deployAgent('agent-1', vi.fn());
    expect(race).toMatchObject({ error: 'Failed to generate portfolio', details: CARRIAGE_RACE_MESSAGE, httpStatus: 500 });
    globalThis.fetch = vi.fn(async () => respond(503, { error: 'pricing_unavailable', details: undefined }));
    expect((await deployAgent('agent-1', vi.fn())).details).toBeUndefined();
  });
  it('a review-due 409 with server details keeps those words, as any refusal does (the hub translator\'s own R-S2A-2 exception reads them)', async () => {
    globalThis.fetch = vi.fn(async () => respond(409, { error: DEPLOY_REFUSAL_CODE, details: 'Server words.' }));
    const out = await deployAgent('agent-1', vi.fn());
    expect(out).toMatchObject({ outcome: 'refused', details: 'Server words.' });
    expect('code' in out).toBe(false);
  });
});
