// BaggerBomb measured thresholds broad release (BR-1 to BR-4, Flash, Oct 25,
// 2026; docs/approvals/BAGGERBOMB_STOCK_THRESHOLDS_V2_PILOT_20261015.md).
//
// NO time-zone pin, on purpose. BR-2 derives a tiered battle's full day from
// the calendar of record at the creation instant with no process time zone
// (the BK §5.4 hazard), so this file must pass under TZ=UTC and
// TZ=America/Chicago alike. The tournament path keeps the old rule, which does
// depend on the process zone; its rows compare old against new under the same
// zone, never against literals.
//
// The real imports of src/utils/stockAdmissionWindow.js and
// src/utils/marketCalendar.js below are their Node dependency-surface guards
// (BUILD_RULES §4): never mock them. Only the network, the clock and the
// admission flag are doubles.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const selector = vi.hoisted(() => ({ enabled: true }));
vi.mock('../../src/config/featureFlags.js', async original => ({ ...await original(), get STOCK_MEASURED_THRESHOLDS_ADMISSION_ENABLED() { return selector.enabled; } }));
import { tieredFullDayTarget, stockPublicationOpensAt, etDateOf, LATE_DAY_START_MINUTES, NIGHT_GAME_CLOSE, STOCK_PUBLICATION_DELAY_MINUTES } from '../../src/utils/stockAdmissionWindow.js';
import { getSessionForDate, etWallClockToMs } from '../../src/utils/marketCalendar.js';
import { getNextMarketClose, formatDateString } from './marketSchedule.js';
import { collectStockObservation } from './stockThresholdMeasurementProvider.js';
import { APPROVED_STOCK_POLICY } from './stockThresholdPolicyRegistry.js';
import { STOCK_MODEL } from '../../src/utils/stockThresholdModel.js';
import { stockRows } from './__fixtures__/stockThresholdHarness.js';
import { readFileSync } from 'node:fs';
import { STOCK_UNIVERSE, ALL_TICKERS, TICKER_TO_SECTOR, TICKER_TO_TYPE, TICKER_TO_INDUSTRY, STOCK_INDUSTRIES, RETIRED_STOCKS } from './rankingConfig.js';
import { hashValueExport } from './wireGenerationSurface.js';
import { validateTickers } from './tickerValidation.js';
import { searchUniverse } from '../../src/components/Forge/Watchlist/tickerSearchMatch.js';
import { generateCPUOpponent } from './cpuOpponentGenerator.js';
import { CRYPTO_ASSETS } from './agentCryptoAssets.js';

const oldKey = process.env.EODHD_API_KEY;
beforeEach(() => { process.env.EODHD_API_KEY = 'isolated-key'; selector.enabled = true; });
afterEach(() => { if (oldKey === undefined) delete process.env.EODHD_API_KEY; else process.env.EODHD_API_KEY = oldKey; vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const ET = (date, hh, mm, ss = 0) => etWallClockToMs(date, hh, mm) + ss * 1000;
const iso = ms => new Date(ms).toISOString();
const MIN = 60_000;
const CRYPTO = { symbol: 'BTC-USD.CC', isCrypto: true, baseATR: 5 };
const control = (over = {}) => ({ schemaVersion: 2, enabled: true, epoch: 1, model: { ...STOCK_MODEL }, audience: { mode: 'all' }, ...over });
// The NYSE early closes inside these rows (published calendar), written out so
// the expectations never come from the code under test.
const EARLY_CLOSE = new Set(['2026-11-27', '2026-12-24', '2027-11-26']);
const expected = (date, roster) => {
  const hour = EARLY_CLOSE.has(date) ? 13 : roster === 'crypto' ? 20 : 16;
  return { expiresAt: iso(ET(date, hour, 0)), tradingDays: [date], localClose: `${hour}:00` };
};

// The tournament path's rule, verbatim from agentBattleService.js
// computeFullDayExpiry at 27514b1a (this change's base): the oracle outside the
// late-day window. It reads the faked clock through getNextMarketClose.
function oldFullDayExpiry(hasCrypto) {
  const closeET = getNextMarketClose({ cryptoExtended: hasCrypto });
  const targetDateStr = formatDateString(closeET);
  const effectiveCloseHour = closeET.getHours();
  const refUTC = new Date(`${targetDateStr}T12:00:00Z`);
  const refETStr = refUTC.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const refET = new Date(refETStr);
  const etOffsetMs = refUTC.getTime() - refET.getTime();
  const closeAsUTC = new Date(`${targetDateStr}T${String(effectiveCloseHour).padStart(2, '0')}:00:00Z`);
  const closeUTC = new Date(closeAsUTC.getTime() + etOffsetMs);
  return { expiresAt: closeUTC.toISOString(), targetDateStr, effectiveCloseHour };
}
const oldAt = (ms, hasCrypto) => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(ms)); try { return oldFullDayExpiry(hasCrypto); } finally { vi.useRealTimers(); } };

// createAgentBattle under the faked clock. ctl null = no control document
// (legacy for everyone); the provider is offline unless `fetchImpl` answers, so
// a selected creation that passes every window reaches its first GET and is
// refused provider_failure, and one the publication wait refuses never fetches.
async function createAt(ms, { roster = 'crypto', ownerId = 'owner-a', ctl = null, tournament = false, fetchImpl } = {}) {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(ms));
  const fetchSpy = vi.fn(fetchImpl ?? (async () => { throw Error('offline'); })); vi.stubGlobal('fetch', fetchSpy);
  const { createAgentBattle } = await import('./agentBattleService.js');
  const { makeCompositionStoreDouble } = await import('./__fixtures__/compositionStoreDouble.js');
  const composition = makeCompositionStoreDouble(); const added = [], reads = [], inputs = [];
  const rankings = { get: async () => { reads.push('indexIntelligence/stockRankings'); return { exists: true, data: () => ({ stocks: [{ symbol: 'AAPL' }, { symbol: 'MSFT' }] }) }; } };
  const db = {
    doc: path => ({ path, id: path.split('/').at(-1), get: async () => { reads.push(path); return ctl === null ? { exists: false, data: () => undefined } : { exists: true, data: () => structuredClone(ctl) }; } }),
    collection: name => composition.collection(name) ?? (name === 'indexIntelligence' ? { doc: () => rankings }
      : { add: async doc => { added.push(doc); return { id: 'battle-1' }; }, doc: id => ({ id: id ?? 'battle-1', path: `${name}/${id ?? 'battle-1'}` }) }),
    runTransaction: async fn => fn({ get: async ref => ref.get(), create: async (r, doc) => { (r.path?.startsWith('stockThresholdInputs/') ? inputs : added).push(doc); }, update: () => {} }),
  };
  const portfolio = { star: [{ symbol: 'AAPL', baseATR: 2.5 }], core: [], support: roster === 'crypto' ? [{ ...CRYPTO }] : [] };
  const agent = { id: 'agent-1', ownerId, name: 'Cipher', archetype: 'diversifier', lastDecision: { portfolio, bench: { stocks: [], crypto: null }, watchlist: { active: [], hotBench: [], monitoring: [] } } };
  const options = tournament
    ? { duration: '1d', opponent: null, gameMode: 'baggerbomb_tournament', groupId: 'group-1', isCpu: true, tournament: { userPicksStance: [], doubleDownSymbols: [], userPicksAtDeploy: [] } }
    : { duration: 'fullday', opponent: { portfolio: { star: [{ symbol: 'MSFT', baseATR: 2.5 }], core: [], support: [] } } };
  const result = await createAgentBattle(db, agent, {}, {}, options).then(r => ({ r }), e => ({ e }));
  vi.useRealTimers();
  return { ...result, added, reads, inputs, fetchSpy, doc: added[0] };
}
const fullDayOf = doc => ({ expiresAt: doc.expiresAt, tradingDays: doc.timing.tradingDays, localClose: doc.timing.localClose });

describe('BR-2: a late-day start plays the next trading session (createAgentBattle, approved fence contact)', () => {
  const TIMES = [[15, 14], [15, 15], [15, 59], [16, 0], [16, 5], [16, 14], [16, 15], [19, 59], [20, 0]];
  // [label, creation date, the session a creation before the late-day start plays, the next session]
  const DAYS = [
    ['regular weekday (Wed Oct 21, 2026)', '2026-10-21', '2026-10-21', '2026-10-22'],
    ['early-close day (Fri Nov 27, 2026; late-day start 12:15 ET)', '2026-11-27', '2026-11-27', '2026-11-30'],
    ['Friday (Oct 23, 2026): the next session is Monday', '2026-10-23', '2026-10-23', '2026-10-26'],
    ['day before a holiday (Wed Nov 25, 2026): the next session is the early close after Thanksgiving', '2026-11-25', '2026-11-25', '2026-11-27'],
    ['day before a holiday (Thu Dec 31, 2026): the next session is Mon Jan 4, 2027', '2026-12-31', '2026-12-31', '2027-01-04'],
    ['spring DST weekend (Fri Mar 6, 2026, EST → Mon Mar 9, EDT)', '2026-03-06', '2026-03-06', '2026-03-09'],
    ['fall DST weekend (Fri Oct 30, 2026, EDT → Mon Nov 2, EST)', '2026-10-30', '2026-10-30', '2026-11-02'],
    ['spring DST weekend 2027 (Fri Mar 12 → Mon Mar 15)', '2027-03-12', '2027-03-12', '2027-03-15'],
    ['fall DST weekend 2027 (Fri Nov 5 → Mon Nov 8)', '2027-11-05', '2027-11-05', '2027-11-08'],
  ];
  it.each(DAYS)('%s: expiresAt, tradingDays and localClose for crypto and stock-only rosters', async (_, date, today, next) => {
    const cutoff = getSessionForDate(date).closeMs - LATE_DAY_START_MINUTES * MIN;
    for (const [hh, mm] of TIMES) {
      const ms = ET(date, hh, mm);
      for (const roster of ['crypto', 'stocks']) {
        const c = await createAt(ms, { roster });
        expect(c.e, `${date} ${hh}:${mm} ${roster}`).toBeUndefined();
        expect(fullDayOf(c.doc), `${date} ${hh}:${mm} ${roster}`).toEqual(expected(ms < cutoff ? today : next, roster));
        expect(c.doc.createdAt).toBe(iso(ms)); expect(c.r.expiresAt).toBe(c.doc.expiresAt);
      }
    }
  }, 120_000);
  it('the late-day start is 45 minutes before the calendar close: 15:15 ET, 12:15 ET on an early close; one millisecond earlier plays today', async () => {
    expect(LATE_DAY_START_MINUTES).toBe(45);
    for (const [date, hh, mm] of [['2026-10-21', 15, 15], ['2026-11-27', 12, 15], ['2026-12-24', 12, 15]]) {
      const at = ET(date, hh, mm);
      expect(at).toBe(getSessionForDate(date).closeMs - 45 * MIN);
      for (const roster of ['crypto', 'stocks']) {
        expect(fullDayOf((await createAt(at - 1, { roster })).doc).tradingDays, `${date} −1 ms ${roster}`).toEqual([date]);
        expect(fullDayOf((await createAt(at, { roster })).doc).tradingDays, `${date} ${roster}`).not.toEqual([date]);
      }
    }
    // Before the late-day start on an early close there is no Night Game: 13:00 for both rosters.
    expect(fullDayOf((await createAt(ET('2026-11-27', 12, 14), { roster: 'crypto' })).doc)).toEqual(expected('2026-11-27', 'crypto'));
  }, 60_000);
  it('the DST Sundays themselves (03:30 ET after spring forward; 01:30 ET, the repeated hour) play Monday', async () => {
    for (const [date, monday] of [['2026-03-08', '2026-03-09'], ['2026-11-01', '2026-11-02']]) {
      const ms = date === '2026-03-08' ? ET(date, 3, 30) : Date.parse('2026-11-01T05:30:00.000Z'); // 01:30 EDT, the first pass
      for (const roster of ['crypto', 'stocks']) expect(fullDayOf((await createAt(ms, { roster })).doc), `${date} ${roster}`).toEqual(expected(monday, roster));
      if (date === '2026-11-01') expect(fullDayOf((await createAt(Date.parse('2026-11-01T06:30:00.000Z'))).doc)).toEqual(expected(monday, 'crypto')); // 01:30 EST, the second pass
    }
  }, 30_000);
  it('expiresAt, tradingDays and localClose agree by construction: one instant names all three', () => {
    for (const [date, hh, mm] of [['2026-10-21', 15, 30], ['2026-11-25', 18, 0], ['2026-11-27', 12, 30], ['2027-03-12', 19, 59]]) {
      for (const hasCrypto of [true, false]) {
        const t = tieredFullDayTarget(ET(date, hh, mm), hasCrypto);
        expect(t.status).toBe('ok');
        expect(etDateOf(Date.parse(t.expiresAt))).toBe(t.targetDateStr);
        expect(t.expiresAt).toBe(iso(etWallClockToMs(t.targetDateStr, t.effectiveCloseHour, 0)));
      }
    }
    expect(tieredFullDayTarget(NaN, true)).toEqual({ status: 'invalid_creation_instant' });
  });
  it('past the maintained calendar the creation is refused calendar_missing, retriably, before anything is written', async () => {
    // Fri Dec 31, 2027 from the late-day start: the next session is in 2028, outside the tables.
    expect(fullDayOf((await createAt(ET('2027-12-31', 15, 14))).doc)).toEqual(expected('2027-12-31', 'crypto'));
    for (const ms of [ET('2027-12-31', 15, 15), ET('2027-12-31', 20, 0), ET('2028-01-03', 10, 0)]) {
      const c = await createAt(ms);
      expect(c.e, iso(ms)).toMatchObject({ name: 'StockThresholdRefusal', reason: 'calendar_missing', retriable: true });
      expect(c.added).toEqual([]); expect(c.reads.filter(p => p.startsWith('stockThresholdControl'))).toEqual([]);
    }
  });
  it('tournament creation is unchanged: the old rule at every instant, in this process zone, and never a control read', async () => {
    for (const [date, hh, mm] of [['2026-10-21', 10, 0], ['2026-10-21', 15, 15], ['2026-10-21', 15, 59], ['2026-10-21', 16, 30], ['2026-10-21', 19, 59], ['2026-10-21', 20, 0], ['2026-11-27', 12, 30], ['2026-10-23', 18, 0], ['2026-10-24', 12, 0]]) {
      const ms = ET(date, hh, mm);
      for (const roster of ['crypto', 'stocks']) {
        const old = oldAt(ms, roster === 'crypto');
        const off = await createAt(ms, { roster, tournament: true });
        const on = await createAt(ms, { roster, tournament: true, ctl: control() });
        expect(fullDayOf(on.doc), `${date} ${hh}:${mm} ${roster}`).toEqual({ expiresAt: old.expiresAt, tradingDays: [old.targetDateStr], localClose: `${String(old.effectiveCloseHour).padStart(2, '0')}:00` });
        expect(on.doc).toEqual(off.doc); expect(on.reads).toEqual([]); expect(on.fetchSpy).not.toHaveBeenCalled();
      }
    }
  }, 60_000);
});

describe('BR-2 sweep: every 15 minutes from Oct 25, 2026 through Dec 31, 2027, no battle is allowed but unscorable', () => {
  const FROM = ET('2026-10-25', 0, 0), TO = ET('2028-01-01', 0, 0);
  const HORIZON = ET('2027-12-31', 15, 15);
  const sessionCache = new Map();
  const session = date => { if (!sessionCache.has(date)) sessionCache.set(date, getSessionForDate(date)); return sessionCache.get(date); };
  const nextDate = date => new Date(Date.parse(`${date}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  // Scorable = some evaluating tick (every quarter hour, inside a session's
  // regular hours: agent-evaluate's isMarketOpen) falls strictly after the
  // creation and strictly before the expiry.
  function scorable(ms, expiryMs) {
    for (let date = etDateOf(ms), i = 0; i < 15; date = nextDate(date), i++) {
      const s = session(date);
      if (!s) return false;
      if (!s.isTradingDay) continue;
      if (s.openMs >= expiryMs) return false;
      const tick = Math.max(s.openMs, Math.floor(ms / (15 * MIN)) * 15 * MIN + 15 * MIN);
      if (tick < s.closeMs && tick < expiryMs) return true;
    }
    return false;
  }
  it('outside the late-day window the tiered target is the old rule (date and close hour, any zone); inside it, the next session; every target is scorable', () => {
    const counts = { late: 0, lateExpected: 0, horizon: 0 };
    for (let ms = FROM; ms < TO; ms += 15 * MIN) {
      const today = session(etDateOf(ms));
      const late = today.isTradingDay && ms >= today.closeMs - 45 * MIN;
      if (late) counts.late++;
      if (today.isTradingDay && etWallClockToMs(today.etDate, 0, 0) === ms) counts.lateExpected += today.isEarlyClose ? 47 : 35;
      for (const hasCrypto of [true, false]) {
        const t = tieredFullDayTarget(ms, hasCrypto);
        if (ms >= HORIZON) { expect(t, iso(ms)).toEqual({ status: 'calendar_missing' }); if (hasCrypto) counts.horizon++; continue; }
        expect(t.status, iso(ms)).toBe('ok');
        const expiry = Date.parse(t.expiresAt);
        expect(t.expiresAt, iso(ms)).toBe(iso(etWallClockToMs(t.targetDateStr, t.effectiveCloseHour, 0)));
        if (!late) {
          const old = oldAt(ms, hasCrypto);
          expect({ d: t.targetDateStr, h: t.effectiveCloseHour }, `${iso(ms)} crypto=${hasCrypto}`).toEqual({ d: old.targetDateStr, h: old.effectiveCloseHour });
        } else {
          let next = nextDate(today.etDate);
          while (!session(next).isTradingDay) next = nextDate(next);
          const s = session(next);
          expect(t.targetDateStr, iso(ms)).toBe(next);
          expect(expiry, iso(ms)).toBe(hasCrypto && !s.isEarlyClose ? etWallClockToMs(next, NIGHT_GAME_CLOSE.hour, NIGHT_GAME_CLOSE.minute) : s.closeMs);
        }
        expect(scorable(ms, expiry), `${iso(ms)} → ${t.expiresAt} crypto=${hasCrypto}`).toBe(true);
      }
    }
    expect(counts.horizon).toBe(35); // Dec 31, 2027 from 15:15 to 23:45 ET
    // 35 quarter hours from the late-day start to midnight on a regular trading day (15:15–23:45), 47 on an early close (12:15–23:45).
    expect(counts.late).toBe(counts.lateExpected);
  }, 600_000);
  it('in the production zone (UTC) the old conversion gives the same instant outside the late-day window', () => {
    const prev = process.env.TZ;
    process.env.TZ = 'UTC';
    try {
      expect(new Date(Date.UTC(2026, 9, 21)).getTimezoneOffset()).toBe(0);
      for (let ms = FROM; ms < HORIZON; ms += 60 * MIN) {
        const today = session(etDateOf(ms));
        if (today.isTradingDay && ms >= today.closeMs - 45 * MIN) continue;
        for (const hasCrypto of [true, false]) expect(tieredFullDayTarget(ms, hasCrypto).expiresAt, `${iso(ms)} crypto=${hasCrypto}`).toBe(oldAt(ms, hasCrypto).expiresAt);
      }
    } finally { if (prev === undefined) delete process.env.TZ; else process.env.TZ = prev; }
  }, 600_000);
  it('a measured creation is refused only during the publication wait (and past the calendar), and the player line names the first instant it opens', async () => {
    // The server's own rule: the fence's calendar refusal, then the collector's
    // publication window (real code, offline GET).
    const collectorWindow = async ms => collectStockObservation('AAPL', 2.5, { now: () => new Date(ms), fetcher: async () => { throw Error('offline'); } }).then(() => null, e => (e.reason === 'provider_failure' ? null : e.reason));
    const refusal = async ms => (tieredFullDayTarget(ms, true).status === 'ok' ? collectorWindow(ms) : tieredFullDayTarget(ms, true).status);
    const seen = { publication_window_not_open: 0, calendar_missing: 0 }; let sessions = 0;
    for (let ms = FROM; ms < TO; ms += 15 * MIN) {
      const today = session(etDateOf(ms));
      if (today.isTradingDay && ms === today.closeMs) sessions++;
      const reason = await refusal(ms);
      if (!reason) continue;
      expect(Object.keys(seen), `${iso(ms)} ${reason}`).toContain(reason);
      seen[reason]++;
      if (reason !== 'publication_window_not_open') continue;
      expect(ms, iso(ms)).toBe(today.closeMs);
      const opens = stockPublicationOpensAt(iso(ms));
      expect(opens).toBe(today.closeMs + STOCK_PUBLICATION_DELAY_MINUTES * MIN);
      expect(await refusal(opens), `${iso(ms)} → ${iso(opens)}`).toBe(null);
      expect(await refusal(opens - 1000), `${iso(ms)} → ${iso(opens)} − 1 s`).toBe('publication_window_not_open');
    }
    // One quarter hour per trading session (the close itself) through Dec 31, 2027, whose
    // 16:00 falls inside the horizon refusal; and the 35 horizon instants.
    expect(seen).toEqual({ publication_window_not_open: sessions - 1, calendar_missing: 35 });
    expect(STOCK_PUBLICATION_DELAY_MINUTES).toBe(APPROVED_STOCK_POLICY.publicationRule.minimumMinutesAfterScheduledClose);
  }, 600_000);
});

describe('BR-2 and BR-4 through createAgentBattle: an "all" control measures every tiered creation, at any start time', () => {
  // The provider double answers the collector's three GETs for a creation at
  // `ms`: the session before it, a fill stamped 15 minutes behind the clock.
  const provider = ms => async url => {
    const symbol = url.pathname.split('/').at(-1).replace('.US', '');
    const today = getSessionForDate(etDateOf(ms));
    const source = today.isTradingDay && ms >= today.closeMs ? today.etDate : today.previousEtDate;
    const value = url.pathname.includes('/eod/') ? stockRows(source) : url.pathname.includes('/fundamentals/')
      ? { Code: symbol, CountryISO: 'US', Type: 'Common Stock', Exchange: 'NASDAQ', IsDelisted: false, ISIN: `US-${symbol}` }
      : { code: `${symbol}.US`, close: 103.27, high: 200, low: 1, previousClose: 100, timestamp: Math.floor(ms / 1000) - 900 };
    return { ok: true, json: async () => structuredClone(value) };
  };
  it.each([
    ['Wed Oct 21 in session before the late-day start (10:02 ET) plays that day', '2026-10-21', 10, 2, '2026-10-21'],
    ['Wed Oct 21 in the late-day window (15:30 ET) plays Thu Oct 22', '2026-10-21', 15, 30, '2026-10-22'],
    ['Wed Oct 21 after the publication wait (16:30 ET) plays Thu Oct 22', '2026-10-21', 16, 30, '2026-10-22'],
    ['Wed Oct 21 in the old evening window (19:59 ET) plays Thu Oct 22', '2026-10-21', 19, 59, '2026-10-22'],
    ['Fri Oct 23 evening (18:00 ET) plays Mon Oct 26', '2026-10-23', 18, 0, '2026-10-26'],
  ])('%s: a corrected battle', async (_, date, hh, mm, plays) => {
    const ms = ET(date, hh, mm);
    const c = await createAt(ms, { ctl: control(), fetchImpl: provider(ms) });
    expect(c.e).toBeUndefined(); expect(c.added).toHaveLength(1);
    expect(c.doc.scoring.stockThresholdModel).toMatchObject({ modelId: 'stock_measured_atr14_fullday_v2', admittedAt: iso(ms) });
    expect(fullDayOf(c.doc)).toEqual(expected(plays, 'crypto'));
    expect(c.inputs).toHaveLength(2); expect(c.fetchSpy).toHaveBeenCalledTimes(6);
  }, 30_000);
  it('the publication wait refuses before any GET; at close + 15 minutes the collector reads again', async () => {
    for (const [date, hh, mm] of [['2026-10-21', 16, 0], ['2026-10-21', 16, 14], ['2026-11-27', 13, 0], ['2026-11-27', 13, 14]]) {
      const c = await createAt(ET(date, hh, mm, 59), { ctl: control() });
      expect(c.e, `${date} ${hh}:${mm}`).toMatchObject({ name: 'StockThresholdRefusal', reason: 'publication_window_not_open', retriable: true });
      expect(c.fetchSpy).not.toHaveBeenCalled(); expect(c.added).toEqual([]);
    }
    for (const [date, hh, mm] of [['2026-10-21', 16, 15], ['2026-11-27', 13, 15]]) {
      const c = await createAt(ET(date, hh, mm), { ctl: control() });
      expect(c.e?.reason).toBe('provider_failure'); expect(c.fetchSpy).toHaveBeenCalled();
    }
  }, 30_000);
  it('the retired late-start and evening-window refusals no longer exist: every instant outside the wait reaches the collector', async () => {
    for (const [hh, mm, ss] of [[15, 15, 0], [15, 59, 59], [16, 15, 0], [18, 0, 0], [19, 59, 59], [20, 0, 0]]) {
      const c = await createAt(ET('2026-10-21', hh, mm, ss), { ctl: control() });
      expect(c.e?.reason, `${hh}:${mm}:${ss}`).toBe('provider_failure'); expect(c.fetchSpy).toHaveBeenCalled();
    }
  }, 30_000);
  it('a legacy creation in the old evening window now plays the next session too (no more unplayed 0–0 evenings)', async () => {
    for (const [hh, mm] of [[16, 30], [18, 0], [19, 59]]) {
      const c = await createAt(ET('2026-10-21', hh, mm));
      expect(Object.hasOwn(c.doc.scoring, 'stockThresholdModel')).toBe(false);
      expect(fullDayOf(c.doc), `${hh}:${mm}`).toEqual(expected('2026-10-22', 'crypto'));
    }
  }, 30_000);
  it('"all" selects every tiered owner and never a tournament; a missing or closed control is legacy with zero collector calls', async () => {
    const ms = ET('2026-10-21', 10, 2);
    for (const ownerId of ['owner-a', 'owner-b']) {
      const c = await createAt(ms, { ctl: control(), ownerId, fetchImpl: provider(ms) });
      expect(Object.hasOwn(c.doc.scoring, 'stockThresholdModel'), ownerId).toBe(true);
    }
    const t = await createAt(ms, { ctl: control(), tournament: true });
    expect(t.reads).toEqual([]); expect(t.fetchSpy).not.toHaveBeenCalled(); expect(Object.hasOwn(t.doc.scoring || {}, 'stockThresholdModel')).toBe(false);
    for (const ctl of [null, control({ enabled: false }), control({ audience: { mode: 'all', ownerIds: ['owner-a'] } }), control({ schemaVersion: 1 }), { schemaVersion: 1, enabled: true, epoch: 1, model: { ...STOCK_MODEL } }]) {
      const c = await createAt(ms, { ctl });
      expect(c.e, JSON.stringify(ctl)).toBeUndefined();
      expect(Object.hasOwn(c.doc.scoring, 'stockThresholdModel')).toBe(false); expect(c.fetchSpy).not.toHaveBeenCalled();
    }
  }, 30_000);
});

describe('BR-3: the 11 dead tickers leave the pickable universe and keep their labels', () => {
  const RETIRED = ['AVB', 'CTRA', 'EA', 'EQR', 'HES', 'IPG', 'K', 'MMC', 'PARA', 'WBA', 'WBD'];
  it('the universe and ALL_TICKERS no longer hold them, and no successor was added (239 − 11 = 228)', () => {
    expect(Object.keys(RETIRED_STOCKS).sort()).toEqual(RETIRED);
    expect(ALL_TICKERS).toHaveLength(228); expect(new Set(ALL_TICKERS).size).toBe(228);
    for (const t of RETIRED) {
      expect(ALL_TICKERS, t).not.toContain(t);
      for (const s of Object.values(STOCK_UNIVERSE)) expect(s.stocks, `${t} in ${s.etf}`).not.toContain(t);
    }
    // Per-sector counts after the removal (the four sectors that lost names, the rest unchanged).
    expect(Object.fromEntries(Object.entries(STOCK_UNIVERSE).map(([k, s]) => [k, s.stocks.length]))).toEqual({ XLK: 28, XLV: 22, XLF: 22, XLE: 17, XLY: 22, XLP: 20, XLI: 23, XLB: 20, XLU: 20, XLRE: 18, XLC: 16 });
  });
  it('existing data still reads: each keeps its last sector, type and industry (the Wire universe value lock does not move)', () => {
    expect(RETIRED_STOCKS).toEqual({ AVB: 'XLRE', CTRA: 'XLE', EA: 'XLC', EQR: 'XLRE', HES: 'XLE', IPG: 'XLC', K: 'XLP', MMC: 'XLF', PARA: 'XLC', WBA: 'XLP', WBD: 'XLC' });
    for (const t of RETIRED) {
      expect(TICKER_TO_SECTOR[t], t).toBe(RETIRED_STOCKS[t]); expect(TICKER_TO_TYPE[t], t).toBe('stock');
      expect(TICKER_TO_INDUSTRY[t], t).toBe(STOCK_INDUSTRIES[t]); expect(typeof STOCK_INDUSTRIES[t]).toBe('string');
    }
    expect(hashValueExport('value:api/_utils/rankingConfig.js#TICKER_TO_SECTOR', TICKER_TO_SECTOR)).toBe('1875fff2473ae3c8c33c8c67696b3715cb2c1d0236d6a6e02977e2b8f8f8b625');
  });
  it('new picks are refused: the ticker validator calls them unsupported and the Forge add search never offers them', () => {
    const v = validateTickers(['AAPL', ...RETIRED, 'SMH']);
    expect(v.validated.map(x => x.symbol)).toEqual(['AAPL', 'SMH']); expect(v.unsupported).toEqual(RETIRED);
    for (const t of RETIRED) expect(searchUniverse(t).map(m => m.symbol), t).not.toContain(t);
    expect(searchUniverse('AAPL')[0].symbol).toBe('AAPL');
  });
  it('the rankings cron fetches and ranks ALL_TICKERS only, so its rebuilt stockRankings (the CPU and agent pool) cannot list them', () => {
    const src = readFileSync(new URL('../cron/compute-index-intelligence.js', import.meta.url), 'utf8');
    expect(src).toContain('fetchBatch(ALL_TICKERS, 10, 500)'); expect(src).toContain('for (const sym of ALL_TICKERS)');
    // A pool rebuilt from ALL_TICKERS: the CPU never draws a retired name, in 300 random draws.
    const sectorName = Object.fromEntries(Object.entries(STOCK_UNIVERSE).flatMap(([, s]) => s.stocks.map(t => [t, s.name])));
    const rebuilt = ALL_TICKERS.map(symbol => ({ symbol, sectorName: sectorName[symbol], price: 100, baseATR: 2.5 }));
    for (let i = 0; i < 300; i++) {
      const cpu = generateCPUOpponent(rebuilt, CRYPTO_ASSETS, new Set());
      const drawn = [...cpu.portfolio.star, ...cpu.portfolio.core, ...cpu.portfolio.support, ...cpu.bench.stocks].filter(Boolean).map(a => a.symbol);
      for (const t of drawn) expect(RETIRED, t).not.toContain(t);
    }
  });
  it('a measured creation never admits one: the collector refuses all 11 before any GET (the safety net while a pre-BR-3 rankings document is still live)', async () => {
    for (const t of RETIRED) {
      const fetcher = vi.fn();
      await expect(collectStockObservation(t, 2.5, { fetcher, now: () => new Date(ET('2026-10-21', 10, 0)) }), t).rejects.toMatchObject({ reason: 'catalog_unavailable', retriable: true });
      expect(fetcher).not.toHaveBeenCalled();
    }
  });
});
