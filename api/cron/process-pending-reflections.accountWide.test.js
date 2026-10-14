// api/cron/process-pending-reflections.accountWide.test.js
//
// Reflection outage fix, part 2 (P-OUT-2, founder rulings O7 and O9) — END TO
// END: the real cron handler and the REAL generateReflection (api/agent/reflect.js)
// against the Anthropic SDK mocked with its REAL error classes, on the
// in-memory Firestore. Nothing between the API's refusal and the battle record
// is mocked:
//   • 401 / 403 / 404 and the account's usage limit leave the attempt count
//     unchanged and the game pending — even at attempt 3 — and write no marker;
//   • a plain 400 counts; past the 7-day backstop a refusal counts;
//   • the third counted failure writes exactly one no-lesson marker; the
//     recovery pass writes one when no lesson landed and none when one did;
//   • the readout's "waiting on the account" sub-count adds up over the
//     records this produced.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFirestoreFake } from '../_utils/__fixtures__/wireFirestoreFake.js';

vi.mock('../_utils/wireFlags.js', () => ({ getWireFlags: () => ({ metricsEnabled: false, writesEnabled: false, continuityEnabled: false, editorialEnabled: false }) }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({ ...(await importOriginal()), CALL_RECORDS_MODE: 'off' }));
let fakeDb;
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => fakeDb }));
vi.mock('../_utils/callRecords/sweep.js', async (importOriginal) => ({ ...(await importOriginal()), runCallSweep: async () => ({ skipped: 'off' }) }));
vi.mock('../_utils/hypothesisRecords/reviewPass.js', async (importOriginal) => ({ ...(await importOriginal()), runHypothesisReviewPass: async () => ({ skipped: 'disabled' }) }));

const sdk = vi.hoisted(() => ({ create: null, calls: 0 }));
vi.mock('@anthropic-ai/sdk', async (importOriginal) => {
  const real = await importOriginal();
  class FakeAnthropic {
    constructor() { this.messages = { create: (body, opts) => { sdk.calls += 1; return sdk.create(body, opts); } }; }
  }
  return { ...real, default: FakeAnthropic };
});
vi.mock('../_utils/shadowLogger.js', () => ({ logReflection: async () => true, logConsolidation: async () => true }));
vi.mock('../_utils/agentConsolidationApply.js', () => ({ consolidateAgentEvolution: async () => ({ success: true }) }));

const { default: handler } = await import('./process-pending-reflections.js');
const { APIError, InternalServerError } = await import('@anthropic-ai/sdk');
const { computeReflectionOutcomeReadout } = await import('../../scripts/reflection-outcome-readout.mjs');

const HOUR = 60 * 60 * 1000;
const cronReq = () => ({ headers: { 'x-vercel-cron': '1' }, method: 'GET' });
const makeRes = () => { const out = {}; out.status = (code) => ({ json: (body) => { out.statusCode = code; out.body = body; return out; } }); return out; };
const doc = async (path) => (await fakeDb.collection(path.split('/')[0]).doc(path.split('/')[1]).get()).data();
const apiErr = (status, type, message, extra = {}) =>
  APIError.generate(status, { type: 'error', error: { type, message, ...extra }, request_id: 'req_test' }, undefined, new Headers());

const PRIOR = Array.from({ length: 3 }, (_, i) => ({ gameId: `old-${i}`, gameMode: 'baggerbomb', result: 'win', score: i, opponentScore: 0, lesson: `old lesson ${i}`, adjustment: 'a', hypothesisGrades: [], confidenceCalibration: 'c', date: '2026-09-01T00:00:00.000Z' }));
async function seed({ attempts = 2, completedMsAgo = HOUR, memory = PRIOR } = {}) {
  await fakeDb.collection('agentBattles').doc('b1').set({
    status: 'completed', pendingReflection: true, completedAt: new Date(Date.now() - completedMsAgo).toISOString(),
    agentId: 'a1', ownerId: 'o1', gameMode: 'baggerbomb_tournament', scoreState: { currentScore: 7, opponentScore: 0 },
    evaluations: [], trades: [], statusFeed: [], chatExchanges: [], ...(attempts ? { reflectionAttempts: attempts } : {}),
  });
  await fakeDb.collection('agents').doc('a1').set({ name: 'Nova', archetype: 'analyst', ownerId: 'o1', stats: { gamesPlayed: 2 }, memory });
}
const markersFor = async (gameId) => ((await doc('agents/a1')).memory || []).filter((m) => m.gameId === gameId && m.noLesson === true);

beforeEach(() => {
  fakeDb = createFirestoreFake();
  sdk.calls = 0;
  sdk.create = null;
});

describe('account-wide refusals do not use up a try (O7) — the real cron, the real reflect.js', () => {
  it.each([
    ['401', () => apiErr(401, 'authentication_error', 'invalid x-api-key'), 'http_401'],
    ['403', () => apiErr(403, 'permission_error', 'not permitted'), 'http_403'],
    ['404 (a retired model)', () => apiErr(404, 'not_found_error', 'model: claude-retired'), 'http_404'],
    ['the usage limit', () => apiErr(400, 'invalid_request_error', 'You have reached your specified API usage limits. You will regain access on 2026-11-01 at 00:00 UTC.'), 'http_400'],
    ['the tier spend cap', () => apiErr(429, 'rate_limit_error', 'You have reached your API usage limits.', { details: { error_code: 'enforced_spend_limit_reached' } }), 'http_429'],
    ['the credit balance', () => apiErr(400, 'invalid_request_error', 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.'), 'http_400'],
  ])('%s at attempt 3: the count is unchanged, the game stays pending, no marker — and the next tick tries again', async (_label, makeErr, failureClass) => {
    await seed({ attempts: 2 });
    sdk.create = async () => { throw makeErr(); };
    for (let tick = 1; tick <= 2; tick++) {
      await handler(cronReq(), makeRes());
      const b = await doc('agentBattles/b1');
      expect(b).toMatchObject({ pendingReflection: true, reflectionAttempts: 2, reflectionLeaseUntil: null });
      expect(b.reflectionOutcome).toMatchObject({ outcome: 'failed', failureClass, accountWide: true, attempt: 3 });
      expect(b).not.toHaveProperty('reflectionNoLesson');
      expect(await markersFor('b1')).toEqual([]);
    }
    expect(sdk.calls).toBeGreaterThanOrEqual(2); // a model call each tick (the SDK's own retries may add more)
  });

  it('a plain 400 counts: the third attempt finishes the game with exactly one marker', async () => {
    await seed({ attempts: 2 });
    sdk.create = async () => { throw apiErr(400, 'invalid_request_error', 'max_tokens: 99999 > 64000'); };
    await handler(cronReq(), makeRes());
    const b = await doc('agentBattles/b1');
    expect(b).toMatchObject({ pendingReflection: false, reflectionNoLesson: true, reflectionAttempts: 3 });
    expect(b.reflectionOutcome).toMatchObject({ failureClass: 'http_400', accountWide: false });
    expect(await markersFor('b1')).toHaveLength(1);
  });

  it('past the 7-day backstop a refusal counts like any other failure', async () => {
    await seed({ attempts: 2, completedMsAgo: 8 * 24 * HOUR });
    sdk.create = async () => { throw apiErr(401, 'authentication_error', 'invalid x-api-key'); };
    await handler(cronReq(), makeRes());
    const b = await doc('agentBattles/b1');
    expect(b).toMatchObject({ pendingReflection: false, reflectionNoLesson: true, reflectionAttempts: 3 });
    expect(b.reflectionOutcome).toMatchObject({ failureClass: 'http_401', accountWide: true });
    expect(await markersFor('b1')).toHaveLength(1);
  });

  it('the readout\'s "waiting on the account" is a sub-count of "still retrying", and the failed total still reconciles', async () => {
    await seed({ attempts: 1 });
    sdk.create = async () => { throw apiErr(401, 'authentication_error', 'x'); };
    await handler(cronReq(), makeRes());
    // A second battle that failed in the ordinary way and is still retrying.
    await fakeDb.collection('agentBattles').doc('b2').set({ status: 'completed', pendingReflection: true, completedAt: new Date().toISOString(), agentId: 'a1', ownerId: 'o1', gameMode: 'baggerbomb', scoreState: {}, evaluations: [], trades: [] });
    sdk.create = async () => { throw new InternalServerError(529, {}, 'x', new Headers()); };
    await handler(cronReq(), makeRes()); // b1 and b2 both fail with an ordinary, counted 529
    const rows = [await doc('agentBattles/b1'), await doc('agentBattles/b2')];
    const day = new Date().toISOString().slice(0, 10);
    const r = computeReflectionOutcomeReadout(rows, { fromDay: day, toDay: day });
    expect(r.failed).toBe(2);
    expect(r.noLesson + r.retrying + r.endedOtherwise).toBe(r.failed);
    expect(r.waitingOnAccount).toBeLessThanOrEqual(r.retrying);

    // Now the account refuses both: both are still retrying, both are waiting on the account.
    sdk.create = async () => { throw apiErr(400, 'invalid_request_error', 'You have reached your specified API usage limits.'); };
    await handler(cronReq(), makeRes());
    const rows2 = [await doc('agentBattles/b1'), await doc('agentBattles/b2')];
    const r2 = computeReflectionOutcomeReadout(rows2, { fromDay: day, toDay: day });
    expect(r2).toMatchObject({ failed: 2, retrying: 2, waitingOnAccount: 2, noLesson: 0, endedOtherwise: 0 });
  });
});

describe('the no-lesson marker (O9) — the real cron, the real reflect.js', () => {
  it('the third counted failure writes exactly one marker; a fourth tick never calls and writes nothing more', async () => {
    await seed({ attempts: 2 });
    sdk.create = async () => { throw new InternalServerError(529, {}, 'x', new Headers()); };
    await handler(cronReq(), makeRes());
    expect(await markersFor('b1')).toHaveLength(1);
    expect((await doc('agents/a1')).memory).toHaveLength(4); // 3 prior + the marker
    const calls = sdk.calls;
    await handler(cronReq(), makeRes());
    expect(sdk.calls).toBe(calls);
    expect(await markersFor('b1')).toHaveLength(1);
  });

  it('the recovery pass (a run that died in its third attempt) writes one marker when no lesson landed', async () => {
    await seed({ attempts: 3 });
    sdk.create = async () => { throw new Error('the recovery pass must never call'); };
    await handler(cronReq(), makeRes());
    expect(sdk.calls).toBe(0);
    expect(await doc('agentBattles/b1')).toMatchObject({ pendingReflection: false, reflectionNoLesson: true });
    expect(await markersFor('b1')).toHaveLength(1);
  });

  it('the recovery pass writes NO marker when the lesson did land — the battle clears as a success', async () => {
    const landed = { ...PRIOR[0], gameId: 'b1', lesson: 'Trim winners into strength.' };
    await seed({ attempts: 3, memory: [...PRIOR, landed] });
    await handler(cronReq(), makeRes());
    expect(sdk.calls).toBe(0);
    const b = await doc('agentBattles/b1');
    expect(b).toMatchObject({ pendingReflection: false, reflectionOutcome: { outcome: 'ok' } });
    expect(b).not.toHaveProperty('reflectionNoLesson');
    expect(await markersFor('b1')).toEqual([]);
  });
});
