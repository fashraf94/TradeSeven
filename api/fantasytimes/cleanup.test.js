// api/fantasytimes/cleanup.test.js
// Retention-ride acceptance (V1.5 §4.3/§4.8 D1; V1.6 A5 / r2 m5): the Wire
// 30-day retention rides the existing cleanup cron — old day docs, metrics
// docs, and leaked envelopes drain; a PENDING envelope is never deleted (it
// is the only replayable copy of its story's Wire state — deleting it would
// manufacture an envelope_missing alarm); and a Wire retention failure can
// never discard the Steps 1-2 result (isolated rider).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFirestoreFake } from '../_utils/__fixtures__/wireFirestoreFake.js';

vi.mock('../_utils/security.js', () => ({
  applySecurityMiddleware: () => false,
}));

let fakeDb;
vi.mock('../_utils/firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => fakeDb,
}));

const { default: handler } = await import('./cleanup.js');

const cronReq = () => ({ headers: { 'x-vercel-cron': '1' }, method: 'GET' });

function makeRes() {
  const out = { statusCode: null, body: null };
  out.status = (code) => ({ json: (payload) => { out.statusCode = code; out.body = payload; return out; } });
  return out;
}

// The handler computes cutoffs from the REAL clock; build fixtures relative
// to it so the test is date-stable.
const now = () => new Date();
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const dayStr = (d) => d.toISOString().slice(0, 10);

beforeEach(() => {
  fakeDb = createFirestoreFake();
});

describe('story expiry (Steps 1-2, pre-Wire behavior intact)', () => {
  it('expires past-due published stories and deletes >30d expired ones', async () => {
    await fakeDb.collection('fantasyTimesStories').doc('past-due').set({
      status: 'published', expiresAt: daysAgo(1),
    });
    await fakeDb.collection('fantasyTimesStories').doc('ancient').set({
      status: 'expired', expiresAt: daysAgo(40),
    });
    await fakeDb.collection('fantasyTimesStories').doc('live').set({
      status: 'published', expiresAt: daysAgo(-5),
    });

    const res = makeRes();
    await handler(cronReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.expiredCount).toBe(1);
    expect(res.body.deletedCount).toBe(1);
    expect((await fakeDb.collection('fantasyTimesStories').doc('past-due').get()).data().status).toBe('expired');
    expect((await fakeDb.collection('fantasyTimesStories').doc('ancient').get()).exists).toBe(false);
    expect((await fakeDb.collection('fantasyTimesStories').doc('live').get()).data().status).toBe('published');
  });
});

describe('Wire 30-day retention ride (Step 3)', () => {
  it('drains old day/metrics/envelope docs; keeps fresh ones; NEVER deletes a pending envelope', async () => {
    const oldDay = dayStr(daysAgo(45));
    const freshDay = dayStr(daysAgo(2));

    // Day + metrics docs, one old one fresh each.
    await fakeDb.collection('fantasyTimesWire').doc(oldDay).set({ date: oldDay, entries: [] });
    await fakeDb.collection('fantasyTimesWire').doc(freshDay).set({ date: freshDay, entries: [] });
    await fakeDb.collection('wireMetrics').doc(oldDay).set({ date: oldDay, seams: {} });
    await fakeDb.collection('wireMetrics').doc(freshDay).set({ date: freshDay, seams: {} });

    // Envelopes: leaked residue (no story), done story, PENDING story, fresh.
    await fakeDb.collection('fantasyTimesWireEnvelopes').doc('env-leaked').set({
      storyId: 'env-leaked', createdAt: daysAgo(40),
    });
    await fakeDb.collection('fantasyTimesWireEnvelopes').doc('env-done').set({
      storyId: 'env-done', createdAt: daysAgo(40),
    });
    await fakeDb.collection('fantasyTimesStories').doc('env-done').set({
      status: 'published', expiresAt: daysAgo(-5), wirePending: false,
    });
    await fakeDb.collection('fantasyTimesWireEnvelopes').doc('env-pending').set({
      storyId: 'env-pending', createdAt: daysAgo(40),
    });
    await fakeDb.collection('fantasyTimesStories').doc('env-pending').set({
      status: 'published', expiresAt: daysAgo(-5), wirePending: true,
    });
    await fakeDb.collection('fantasyTimesWireEnvelopes').doc('env-fresh').set({
      storyId: 'env-fresh', createdAt: now(),
    });

    const res = makeRes();
    await handler(cronReq(), res);

    expect(res.statusCode).toBe(200);
    // old day + old metrics + env-leaked + env-done = 4; env-pending EXCLUDED
    expect(res.body.wireDeleted).toBe(4);
    expect(res.body.wireCleanupError).toBeUndefined();

    expect((await fakeDb.collection('fantasyTimesWire').doc(oldDay).get()).exists).toBe(false);
    expect((await fakeDb.collection('fantasyTimesWire').doc(freshDay).get()).exists).toBe(true);
    expect((await fakeDb.collection('wireMetrics').doc(oldDay).get()).exists).toBe(false);
    expect((await fakeDb.collection('wireMetrics').doc(freshDay).get()).exists).toBe(true);
    expect((await fakeDb.collection('fantasyTimesWireEnvelopes').doc('env-leaked').get()).exists).toBe(false);
    expect((await fakeDb.collection('fantasyTimesWireEnvelopes').doc('env-done').get()).exists).toBe(false);
    // The load-bearing keep: the pending story's only replayable copy survives.
    expect((await fakeDb.collection('fantasyTimesWireEnvelopes').doc('env-pending').get()).exists).toBe(true);
    expect((await fakeDb.collection('fantasyTimesWireEnvelopes').doc('env-fresh').get()).exists).toBe(true);
  });

  it('a Wire retention failure is ISOLATED: Steps 1-2 results still return, error surfaced', async () => {
    await fakeDb.collection('fantasyTimesStories').doc('past-due').set({
      status: 'published', expiresAt: daysAgo(1),
    });
    // Make the Wire step's first collection access throw (e.g. missing index).
    const realCollection = fakeDb.collection.bind(fakeDb);
    fakeDb.collection = (name) => {
      if (name === 'fantasyTimesWire') throw new Error('missing index');
      return realCollection(name);
    };

    const res = makeRes();
    await handler(cronReq(), res);

    expect(res.statusCode).toBe(200); // NOT the catch-all 500
    expect(res.body.success).toBe(true);
    expect(res.body.expiredCount).toBe(1); // primary result preserved
    expect(res.body.wireDeleted).toBe(0);
    expect(res.body.wireCleanupError).toContain('missing index');
  });
});
