// Review K2-1b (takeover, 2026-10-14): an expired pinned stock battle without
// committed qualified evidence is not settled, and the REAL handler says so
// loudly rather than counting it as completed by another writer. Real handler
// and completion writer; provider, model, schedule, sweeps and firebase init
// are doubled (the agent-evaluate.evalRun.test.js precedent).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeTickBattle, makeRankingsDoc, makeTickDb, deepClone } from '../_utils/__fixtures__/tickStampsHarness.js';

const world = vi.hoisted(() => ({ db: null, battles: () => [] }));
vi.mock('@anthropic-ai/sdk', () => ({ default: class { constructor() { this.messages = { create: vi.fn() }; } } }));
vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: vi.fn(async () => ({ price: null, daily: [] })), fetchIntradayBatch: vi.fn(async () => ({})),
  fetchIntradayCandles: vi.fn(async () => []), filterToLatestSession: vi.fn(c => ({ candles: c || [], sessionDate: '2026-10-14' })),
}));
vi.mock('../_utils/marketSchedule.js', async o => ({ ...(await o()), isMarketOpen: () => true }));
vi.mock('../_utils/agentBattleService.js', async o => ({ ...(await o()), findActiveAgentBattles: vi.fn(async () => world.battles()) }));
vi.mock('../_utils/canonicalOpenSweep.js', () => ({ runCanonicalOpenSweep: vi.fn(async () => ({ skipped: true })) }));
vi.mock('../_utils/masterySettlement.js', async o => ({ ...(await o()), runRepairSweep: vi.fn(async () => ({ scanned: 0 })) }));
vi.mock('../_utils/tournamentAgentLedger.js', () => ({ resolveTournamentContext: vi.fn(async () => null), excludeHeldByOthers: vi.fn(), excludeHeldSymbols: vi.fn(), reserveSymbol: vi.fn(), confirmSwap: vi.fn(), releaseReservation: vi.fn() }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => world.db }));
vi.mock('../_utils/battlePatternLogger.js', () => ({ logBattlePattern: vi.fn(async () => {}) }));
vi.mock('../_utils/shadowLogger.js', async o => ({ ...(await o()), logEvaluation: vi.fn(async () => false), logVisionTransition: vi.fn(async () => false), logAnticipation: vi.fn(async () => false) }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({ ...(await importOriginal()), TICK_STAMPS_ENABLED: false, TICK_CAPTURE_ENABLED: false, CALL_RECORDS_MODE: 'off', SWAP_IDENTITY_MODE: 'off' }));

const cron = await import('./agent-evaluate.js');
const { correctedStockBattle, STOCK_TEST_NOW } = await import('../_utils/__fixtures__/stockThresholdHarness.js');

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(STOCK_TEST_NOW)); process.env.EODHD_API_KEY = 'isolated-key'; process.env.CRON_SECRET = 'expiry-secret'; });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); delete process.env.EODHD_API_KEY; });

describe('K2-1b: an expired pinned stock battle without committed evidence is reported, not hidden', () => {
  // With no other active battle the handler answers 'No active agent battles'
  // (no `errors` key), so the loud log line is the observable signal here.
  it('the real handler logs it as an error, never as completed, and leaves the battle active', async () => {
    const { battle: corrected, inputs } = await correctedStockBattle();
    const original = makeTickBattle();
    const battle = { ...original, ...corrected, expiresAt: '2026-10-14T20:00:00.000Z', scoreState: { ...original.scoreState, ...corrected.scoreState }, scoring: { ...original.scoring, ...corrected.scoring } };
    const db = makeTickDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: {} });
    db.doc = path => ({ path, id: path.split('/').at(-1), get: async () => ({ exists: !!inputs[path], data: () => structuredClone(inputs[path]) }) });
    const collection = db.collection.bind(db);
    db.collection = name => name === 'agentEvalRuns' ? { doc: () => ({ set: async () => {} }) } : collection(name);
    world.db = db; world.battles = () => [{ id: battle.id, ...deepClone(db.__store.battle) }];
    vi.setSystemTime(new Date('2026-10-14T20:05:00.000Z'));
    const errors = []; vi.spyOn(console, 'error').mockImplementation((...args) => { errors.push(args.map(String).join(' ')); });
    const before = deepClone(db.__store.battle);
    const r = { statusCode: null, body: null, status(c) { r.statusCode = c; return r; }, json(b) { r.body = b; return r; } };
    await cron.default({ headers: { authorization: 'Bearer expiry-secret' } }, r);
    expect(r.statusCode).toBe(200);
    expect(r.body).toMatchObject({ expired: 0, message: 'No active agent battles' });
    expect(errors.filter(e => e.includes('lacks committed corrected stock evidence'))).toHaveLength(1);
    expect(db.__store.battle).toEqual(before);
  });
});
