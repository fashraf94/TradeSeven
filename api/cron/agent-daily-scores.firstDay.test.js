// api/cron/agent-daily-scores.firstDay.test.js
//
// BaggerBomb cleanup C1 + C2 (Flash, Oct 27, 2026): the nightly scoring job on
// a battle that plays the NEXT session (BR-2: created in the 45 minutes before
// a close, or overnight).
//
//   C1  a tiered battle whose ET date is before `timing.tradingDays[0]` gets
//       nothing that night — nothing banked, recorded or reset — so its REAL
//       first night records as day 1. Measured and legacy alike; tournaments
//       are unchanged.
//   C2  that first night banks against the baseline the day's evaluations
//       scored from (the creation price, `portfolio.startingPrices`), the same
//       activation day agent-evaluate now uses; every other mode keeps
//       `activatedAt`.
//
// The REAL handler, the REAL scorer and the REAL getCurrentTradingDayServer
// run; only the battle list, the quotes, the battle write and the Firestore
// edges are doubles. Crons do not run on Vercel preview (BUILD_RULES §6): these
// rows are the proof until the first production night.

process.env.TZ = 'UTC';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { etWallClockToMs } from '../../src/utils/marketCalendar.js';

const state = vi.hoisted(() => ({ battles: [], updates: [], checkpoints: [], measured: new Set() }));

vi.mock('firebase-admin/app', () => ({ getApps: () => [{}], initializeApp: () => ({}), cert: () => ({}) }));
vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => ({}), FieldValue: { increment: (n) => ({ __increment: n }) } }));
vi.mock('../_utils/firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => ({
    collection: () => ({ doc: (id) => ({ update: async (u) => { state.updates.push({ id, u }); } }) }),
  }),
}));
vi.mock('../_utils/agentBattleService.js', () => ({ findActiveAgentBattles: async () => state.battles }));
vi.mock('../_utils/marketSchedule.js', async (importOriginal) => ({ ...(await importOriginal()), isTradingDay: () => true }));
vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: async (symbol) => ({ price: { current: 105, previousClose: 110 }, daily: [], symbol }),
}));
vi.mock('../_utils/stockThresholdAdmission.js', () => ({
  checkpointCorrectedDaily: async (...args) => { state.checkpoints.push(args[3]); return { status: 'recorded' }; },
}));
vi.mock('../../src/utils/stockThresholdModel.js', async (importOriginal) => ({
  ...(await importOriginal()),
  stockModelRoute: (battle) => (state.measured.has(battle?.id) ? { status: 'corrected' } : { status: 'legacy' }),
}));

const { default: handler } = await import('./agent-daily-scores.js');

const ET = (date, h, m = 0) => etWallClockToMs(date, h, m);
// The cron fires at 01:45 UTC: 9:45 PM EDT before Nov 1, 8:45 PM EST from Nov 1.
const NIGHT = { monEDT: '2026-10-27T01:45:00.000Z', tueEDT: '2026-10-28T01:45:00.000Z', friEDT: '2026-10-31T01:45:00.000Z', monEST: '2026-11-03T01:45:00.000Z' };

/**
 * One AAA position bought at 100 that is now 105 against a previous close of
 * 110: from the creation price it is up 5% (two ATR, badge points); from the
 * previous close it is down 4.5% (none).
 */
function battle(id, createdMs, tradingDays, over = {}) {
  const at = new Date(createdMs).toISOString();
  return {
    id, status: 'active', gameMode: 'baggerbomb_agent', duration: 'fullday',
    createdAt: at, activatedAt: at,
    timing: { tradingDays, currentTradingDay: 1, timezone: 'America/New_York' },
    portfolio: { star: [{ symbol: 'AAA', baseATR: 2.5, isCrypto: false }], core: [], support: [], startingPrices: { AAA: 100 } },
    scoreState: {}, thresholdHistory: {},
    ...over,
  };
}

async function runNight(battles, at, measured = []) {
  state.battles = battles.map((b) => structuredClone(b));
  state.updates = [];
  state.checkpoints = [];
  state.measured = new Set(measured);
  vi.setSystemTime(new Date(at));
  const res = { statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await handler({ headers: { 'x-vercel-cron': '1' } }, res);
  expect(res.statusCode).toBe(200);
  return res.body;
}
const recorded = (id) => state.updates.filter((u) => u.id === id);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('C1 — a battle before its first trading day gets nothing from the nightly job', () => {
  it('created Mon 15:20 ET: Monday night banks, records and resets nothing; Tuesday night records day 1', async () => {
    const mon = battle('mon-legacy', ET('2026-10-26', 15, 20), ['2026-10-27']);
    const monNight = await runNight([mon], NIGHT.monEDT);
    expect(monNight).toMatchObject({ success: true, processed: 0, skipped: 1, errors: 0 });
    expect(state.updates).toEqual([]);

    const tueNight = await runNight([mon], NIGHT.tueEDT);
    expect(tueNight).toMatchObject({ processed: 1, skipped: 0, errors: 0 });
    const [{ u }] = recorded('mon-legacy');
    expect(u['scoreState.dailyScores.day1']).toMatchObject({ recorded: true, recordedBy: 'cron' });
    expect(u['timing.currentTradingDay']).toBe(2);
    expect(u['scoreState.bankedBadgePoints.breakdown.day1'].points).toBeGreaterThan(0);
  });

  it('created Fri 15:20 ET: Friday night is skipped, Monday night is its day 1 (across the Nov 1 fall-back)', async () => {
    const fri = battle('fri-legacy', ET('2026-10-30', 15, 20), ['2026-11-02']);
    expect(await runNight([fri], NIGHT.friEDT)).toMatchObject({ processed: 0, skipped: 1 });
    expect(state.updates).toEqual([]);
    expect(await runNight([fri], NIGHT.monEST)).toMatchObject({ processed: 1, skipped: 0 });
    expect(recorded('fri-legacy')[0].u['scoreState.dailyScores.day1'].recorded).toBe(true);
  });

  it('a same-day battle is unchanged: created Tue 10:00 ET, Tuesday night records day 1 as before', async () => {
    const tue = battle('tue-legacy', ET('2026-10-27', 10, 0), ['2026-10-27']);
    expect(await runNight([tue], NIGHT.tueEDT)).toMatchObject({ processed: 1, skipped: 0 });
    expect(recorded('tue-legacy')[0].u['scoreState.dailyScores.day1'].recorded).toBe(true);
  });

  it('a measured battle is held back the same way: no checkpoint, no write — and its real first night checkpoints day 1', async () => {
    const measured = battle('mon-measured', ET('2026-10-26', 15, 20), ['2026-10-27']);
    const monNight = await runNight([measured], NIGHT.monEDT, ['mon-measured']);
    expect(monNight).toMatchObject({ processed: 0, skipped: 1, errors: 0 });
    expect(state.checkpoints).toEqual([]);
    expect(state.updates).toEqual([]);

    const tueNight = await runNight([measured], NIGHT.tueEDT, ['mon-measured']);
    expect(tueNight).toMatchObject({ processed: 1, skipped: 0 });
    expect(state.checkpoints).toEqual(['day1']);
  });

  it('a battle with no usable trading-day list is never held back', async () => {
    for (const tradingDays of [undefined, [], ['Oct 27']]) {
      const b = battle('no-list', ET('2026-10-26', 15, 20), tradingDays, tradingDays === undefined ? { timing: undefined } : {});
      expect(await runNight([b], NIGHT.monEDT), JSON.stringify(tradingDays)).toMatchObject({ processed: 1, skipped: 0 });
    }
  });

  it('a tournament battle is byte-identical: a list that starts tomorrow does not hold it back', async () => {
    const tournament = battle('tournament', ET('2026-10-26', 15, 20), ['2026-10-27'], { gameMode: 'baggerbomb_tournament' });
    const control = battle('control', ET('2026-10-26', 15, 20), undefined, { gameMode: 'baggerbomb_tournament', timing: undefined });
    expect(await runNight([tournament, control], NIGHT.monEDT)).toMatchObject({ processed: 2, skipped: 0 });
    const strip = (u) => ({ ...u, 'scoreState.dailyScores.day1': { ...u['scoreState.dailyScores.day1'], recordedAt: '' }, 'scoreState.bankedBadgePoints.breakdown.day1': { ...u['scoreState.bankedBadgePoints.breakdown.day1'], recordedAt: '' }, 'timing.lastDailyResetAt': '', updatedAt: '' });
    expect(strip(recorded('tournament')[0].u)).toEqual(strip(recorded('control')[0].u));
  });
});

describe('C2 — the first night banks against the creation price, the baseline the day was scored from', () => {
  it('a next-session battle banks the same points as a same-day battle on the same quotes', async () => {
    const nextSession = battle('next', ET('2026-10-26', 15, 20), ['2026-10-27']);
    const sameDay = battle('same', ET('2026-10-27', 10, 0), ['2026-10-27']);
    await runNight([nextSession, sameDay], NIGHT.tueEDT);
    const next = recorded('next')[0].u['scoreState.bankedBadgePoints.breakdown.day1'].points;
    const same = recorded('same')[0].u['scoreState.bankedBadgePoints.breakdown.day1'].points;
    expect(same).toBeGreaterThan(0); // from the creation price, +5% is two ATR
    expect(next).toBe(same); // not the previous-close baseline, which would bank a bust penalty
  });

  it('every other mode keeps activatedAt: a tournament created the day before banks from the previous close', async () => {
    const tournament = battle('tournament-next', ET('2026-10-26', 15, 20), ['2026-10-27'], { gameMode: 'baggerbomb_tournament' });
    const noList = battle('no-list', ET('2026-10-26', 15, 20), undefined, { gameMode: 'baggerbomb_tournament', timing: undefined });
    await runNight([tournament, noList], NIGHT.tueEDT);
    const points = (id) => recorded(id)[0].u['scoreState.bankedBadgePoints.breakdown.day1'].points;
    expect(points('tournament-next')).toBeLessThan(0); // down 4.5% from the previous close: a bust penalty, not the creation-price points
    expect(points('tournament-next')).toBe(points('no-list'));
  });
});
