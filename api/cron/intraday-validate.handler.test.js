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
    mocks.battles = [{ id: 'b1', status: 'active' }];
    const session = { openMs: 1000, closeMs: 5000 };
    await db.collection('agentBattles').doc('b1').collection('intradayViews').doc('eval_1').set({ evalId: 'eval_1', evaluatedAt: 2000, symbols: { AAPL: {} } });
    await db.collection('agentBattles').doc('b1').collection('intradayViews').doc('eval_0').set({ evalId: 'eval_0', evaluatedAt: 10, symbols: {} });
    const views = await listViewsForSession(db, session);
    expect(views.map((v) => v.evalId)).toEqual(['eval_1']);
    expect(views[0].battleId).toBe('b1');
  });
});
