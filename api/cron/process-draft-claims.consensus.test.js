// api/cron/process-draft-claims.consensus.test.js
//
// Locks the 2026-07-04 cron merge: the retired pre-market-warmup cron's
// load-bearing half (FantasyTimes consensus seeding + validated-catalyst flush)
// now rides this handler. Companion to process-draft-claims{,.tournament}.test.js
// — those DST/idempotency/branch batteries stay untouched. What this locks:
//
//   1. On the pre-market firing, seedConsensus(today) + flushExpiredCatalysts()
//      run (self-gated on isPreMarketWindow()).
//   2. On the off-DST firing (outside the pre-market window), neither runs.
//   3. A consensus-seed failure is non-blocking — it never breaks the legacy
//      claim-processing path, and the flush still runs.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ db: null }));
vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  getApps: () => [{}],
  cert: vi.fn(),
}));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => h.db,
  FieldValue: { arrayUnion: vi.fn(), serverTimestamp: vi.fn() },
}));
vi.mock('../_utils/fantasyTimesConsensus.js', () => ({ seedConsensus: vi.fn(async () => {}) }));
vi.mock('../_utils/validatedCatalystCache.js', () => ({ flushExpiredCatalysts: vi.fn(async () => {}) }));

import handler from './process-draft-claims.js';
import { seedConsensus } from '../_utils/fantasyTimesConsensus.js';
import { flushExpiredCatalysts } from '../_utils/validatedCatalystCache.js';

const IN_WINDOW = new Date('2026-06-10T13:25:00Z');  // Wed 9:25 AM ET (EDT) — pre-market
const OFF_WINDOW = new Date('2026-06-10T14:25:00Z'); // Wed 10:25 AM ET — not pre-market

// Minimal db: no drafts, no tournament groups — the handler seeds consensus
// (top of handler), then falls through to the legacy "no drafts" success path.
function emptyDb() {
  return {
    collection: () => ({
      where: () => ({ get: async () => ({ forEach: () => {} }) }),
      doc: () => ({ get: async () => ({ exists: false, data: () => null }) }),
    }),
  };
}

function makeReqRes() {
  const req = { headers: { 'x-vercel-cron': '1' } };
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return { req, res };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('merged FantasyTimes consensus seeding (ex pre-market-warmup)', () => {
  it('seeds consensus for today + flushes catalysts on the pre-market firing', async () => {
    vi.setSystemTime(IN_WINDOW);
    h.db = emptyDb();
    const { req, res } = makeReqRes();
    await handler(req, res);

    expect(seedConsensus).toHaveBeenCalledTimes(1);
    expect(seedConsensus).toHaveBeenCalledWith('2026-06-10');
    expect(flushExpiredCatalysts).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200); // claims path still completes
  });

  it('does NOT seed on the off-DST firing (outside the pre-market window)', async () => {
    vi.setSystemTime(OFF_WINDOW);
    h.db = emptyDb();
    const { req, res } = makeReqRes();
    await handler(req, res);

    expect(seedConsensus).not.toHaveBeenCalled();
    expect(flushExpiredCatalysts).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({ skipped: true, reason: 'not_claim_window' });
  });

  it('a consensus-seed failure is non-blocking — legacy claims path still succeeds', async () => {
    vi.setSystemTime(IN_WINDOW);
    seedConsensus.mockRejectedValueOnce(new Error('sonar down'));
    h.db = emptyDb();
    const { req, res } = makeReqRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(flushExpiredCatalysts).toHaveBeenCalledTimes(1); // seed failure doesn't skip the flush
  });
});
