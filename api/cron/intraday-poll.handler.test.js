// api/cron/intraday-poll.handler.test.js — auth, the flag gate, the wiring.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ runPoll: vi.fn(async () => ({ published: true })), getFirebaseAdmin: vi.fn(() => ({ fake: true })), flag: { value: false } }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: mocks.getFirebaseAdmin }));
vi.mock('../_utils/intraday/pollRunner.js', () => ({ runPoll: mocks.runPoll }));
vi.mock('../_utils/agentBattleService.js', () => ({ findActiveAgentBattles: vi.fn(async () => []) }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({ ...(await importOriginal()), get INTRADAY_COLLECT_ENABLED() { return mocks.flag.value; } }));

const { default: handler, config } = await import('./intraday-poll.js');
const res = () => { const r = { code: null, body: null }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };

beforeEach(() => { mocks.runPoll.mockClear(); mocks.getFirebaseAdmin.mockClear(); process.env.CRON_SECRET = 's3cret'; process.env.EODHD_API_KEY = 'key'; vi.spyOn(console, 'log').mockImplementation(() => {}); });

describe('/api/cron/intraday-poll', () => {
  it('401 without the cron header or the bearer secret', async () => {
    const r = res();
    await handler({ headers: {} }, r);
    expect(r.code).toBe(401);
    expect(mocks.runPoll).not.toHaveBeenCalled();
  });
  it('flag off → 200 skipped before any Firebase init or vendor call', async () => {
    mocks.flag.value = false;
    const r = res();
    await handler({ headers: { 'x-vercel-cron': '1' } }, r);
    expect(r.code).toBe(200);
    expect(r.body).toEqual({ skipped: true, reason: 'flag_off' });
    expect(mocks.getFirebaseAdmin).not.toHaveBeenCalled();
    expect(mocks.runPoll).not.toHaveBeenCalled();
  });
  it('flag on → runs the poller with the calendar of record, the active-battle lister and a fresh owner', async () => {
    mocks.flag.value = true;
    const r = res();
    await handler({ headers: { authorization: 'Bearer s3cret' } }, r);
    expect(r.code).toBe(200);
    expect(mocks.runPoll).toHaveBeenCalledTimes(1);
    const args = mocks.runPoll.mock.calls[0][0];
    expect(args.collectEnabled).toBe(true);
    expect(args.apiKey).toBe('key');
    expect(typeof args.now).toBe('function');
    expect(typeof args.calendar.getSessionForDate).toBe('function');
    expect(typeof args.calendar.getPreviousSessionDate).toBe('function');
    expect(typeof args.listActiveBattles).toBe('function');
    expect(args.owner).toMatch(/^[0-9a-f-]{36}$/);
    expect(config.maxDuration).toBe(60);
  });
});
