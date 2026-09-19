// api/cron/intraday-validate.handler.test.js — auth, the flag gate, the wiring, the view lister.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeInMemoryDb } from '../_utils/__fixtures__/inMemoryFirestore.js';

const mocks = vi.hoisted(() => ({ runValidation: vi.fn(async () => ({ status: 'done' })), getFirebaseAdmin: vi.fn(() => ({ fake: true })), flag: { value: false }, battles: [] }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: mocks.getFirebaseAdmin }));
vi.mock('../_utils/intraday/validationRunner.js', () => ({ runValidation: mocks.runValidation }));
vi.mock('../_utils/agentBattleService.js', () => ({ findActiveAgentBattles: vi.fn(async () => mocks.battles) }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({ ...(await importOriginal()), get INTRADAY_COLLECT_ENABLED() { return mocks.flag.value; } }));

const { default: handler, fireTicksOf, listViewsForSession } = await import('./intraday-validate.js');
const res = () => { const r = { code: null, body: null }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };

beforeEach(() => { mocks.runValidation.mockClear(); mocks.getFirebaseAdmin.mockClear(); process.env.CRON_SECRET = 's3cret'; vi.spyOn(console, 'log').mockImplementation(() => {}); });

describe('/api/cron/intraday-validate', () => {
  it('401 without auth; flag off → 200 skipped with no Firebase init', async () => {
    const r1 = res(); await handler({ headers: {} }, r1); expect(r1.code).toBe(401);
    mocks.flag.value = false;
    const r2 = res(); await handler({ headers: { 'x-vercel-cron': '1' } }, r2);
    expect(r2.body).toEqual({ skipped: true, reason: 'flag_off' });
    expect(mocks.getFirebaseAdmin).not.toHaveBeenCalled();
  });
  it('flag on → runs the validator with the calendar, the view lister and the preset fire ticks', async () => {
    mocks.flag.value = true;
    const r = res(); await handler({ headers: { authorization: 'Bearer s3cret' } }, r);
    expect(r.code).toBe(200);
    const args = mocks.runValidation.mock.calls[0][0];
    expect(args.collectEnabled).toBe(true);
    expect(args.listViewsForSession).toBe(listViewsForSession);
    expect(args.fireTicksOf).toBe(fireTicksOf);
  });
  it('fireTicksOf reads the preset dead-band fire thresholds (aggressive 3 / balanced 2 / defensive 1)', () => {
    expect(fireTicksOf('aggressive')).toBe(3);
    expect(fireTicksOf('balanced')).toBe(2);
    expect(fireTicksOf('defensive')).toBe(1);
    expect(fireTicksOf(undefined)).toBe(2);
  });
  it('listViewsForSession reads the intradayViews of active battles within the session (evaluatedAt range) and tags the battleId', async () => {
    const { db } = makeInMemoryDb();
    mocks.battles = [{ id: 'b1', status: 'active', evaluations: [{ evalId: 'eval_1', intradayViewRef: 'eval_1' }, { evalId: 'eval_0', intradayViewRef: 'eval_0' }] }];
    const session = { openMs: 1000, closeMs: 5000 };
    await db.collection('agentBattles').doc('b1').collection('intradayViews').doc('eval_1').set({ evalId: 'eval_1', evaluatedAt: 2000, symbols: { AAPL: {} } });
    await db.collection('agentBattles').doc('b1').collection('intradayViews').doc('eval_0').set({ evalId: 'eval_0', evaluatedAt: 10, symbols: {} });
    const views = await listViewsForSession(db, session);
    expect(views.map((v) => v.evalId)).toEqual(['eval_1']);
    expect(views[0].battleId).toBe('b1');
  });

  // -------------------------------------------------------------------------
  // Addendum A8(c) — the evidence set is what the battle POINTS AT.
  // Review finding R-2 (docs/audits/20260919_BUILD1_INTRADAY_REVIEW.md).
  // -------------------------------------------------------------------------
  it('A8(c) — a view no evaluation points at is NOT graded, even inside the session window', async () => {
    const { db } = makeInMemoryDb();
    const session = { openMs: 1000, closeMs: 5000 };
    // eval_1 was kept; eval_2's write lost its 2 s race, so the entry records
    // intradayViewRef: null — and then the abandoned write landed anyway,
    // because withTimeout has no AbortController. §10.4 must not grade it.
    mocks.battles = [{
      id: 'b1',
      status: 'active',
      evaluations: [
        { evalId: 'eval_1', intradayViewRef: 'eval_1', intradayViewStatus: null },
        { evalId: 'eval_2', intradayViewRef: null, intradayViewStatus: 'write_failed' },
      ],
    }];
    await db.collection('agentBattles').doc('b1').collection('intradayViews').doc('eval_1').set({ evalId: 'eval_1', evaluatedAt: 2000, symbols: { AAPL: {} } });
    await db.collection('agentBattles').doc('b1').collection('intradayViews').doc('eval_2').set({ evalId: 'eval_2', evaluatedAt: 3000, symbols: { AAPL: {} } });

    const views = await listViewsForSession(db, session);
    expect(views.map((v) => v.evalId)).toEqual(['eval_1']);
  });

  it('A8(c) — a battle whose evaluations point at nothing costs no subcollection read', async () => {
    const { db, readLog } = makeInMemoryDb();
    const session = { openMs: 1000, closeMs: 5000 };
    mocks.battles = [{ id: 'b1', status: 'active', evaluations: [{ evalId: 'eval_1', intradayViewRef: null }] }];
    await db.collection('agentBattles').doc('b1').collection('intradayViews').doc('eval_1').set({ evalId: 'eval_1', evaluatedAt: 2000, symbols: {} });
    const before = readLog.length;
    expect(await listViewsForSession(db, session)).toEqual([]);
    // Only the completedAt scan; no per-battle subcollection query.
    expect(readLog.slice(before).filter(([, path]) => String(path).includes('intradayViews'))).toEqual([]);
  });

  it('A8(c) — a document whose evalId disagrees with its own id is refused', async () => {
    const { db } = makeInMemoryDb();
    const session = { openMs: 1000, closeMs: 5000 };
    mocks.battles = [{ id: 'b1', status: 'active', evaluations: [{ evalId: 'eval_1', intradayViewRef: 'eval_1' }] }];
    await db.collection('agentBattles').doc('b1').collection('intradayViews').doc('eval_1').set({ evalId: 'eval_9', evaluatedAt: 2000, symbols: {} });
    expect(await listViewsForSession(db, session)).toEqual([]);
  });
});
