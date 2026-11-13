// The Battle chart's pure parts (build prompt of Nov 13, 2026, BC2-1 – BC2-5; spec §12).

import { describe, it, expect, beforeAll } from 'vitest';
import { battleSpecOf, battleCandlesOf, barTimeOf, dayMarkersOf, rungLinesOf, BATTLE_BARS } from './battleChart.js';
import { measuredSheetBattle, SHEET_NOW } from './__fixtures__/sheetBattles.js';
import { selectBombRecord } from '../BombMode/selectBombRecord.js';
import { measuredLadder, previewLadder } from '../BombMode/ladder.js';
import { rungFacts } from '../BombMode/bombView.js';

const Z = (iso) => Date.parse(iso);
const NOW = Z('2026-10-14T17:07:00.000Z'); // Wed 1:07 PM ET

describe('battleSpecOf — the sessions up to today and the bar size', () => {
  it('one trading day → 5-minute bars; two or more → 30-minute bars (💣\'s request, 20 days)', () => {
    expect(battleSpecOf({ timing: { tradingDays: ['2026-10-14'] } }, NOW)).toEqual({ days: ['2026-10-14'], barSize: '5m', bars: BATTLE_BARS['5m'] });
    expect(battleSpecOf({ timing: { tradingDays: ['2026-10-14', '2026-10-15'] } }, NOW).barSize).toBe('30m');
    expect(BATTLE_BARS['30m']).toMatchObject({ timeframe: '30m', days: 20 });
    expect(BATTLE_BARS['5m']).toMatchObject({ timeframe: '5m', days: 5 });
  });
  it('a three-day battle on its second day draws the sessions so far, still in 30-minute bars', () => {
    expect(battleSpecOf({ timing: { tradingDays: ['2026-10-13', '2026-10-14', '2026-10-15'] } }, NOW)).toMatchObject({ days: ['2026-10-13', '2026-10-14'], barSize: '30m' });
  });
  it('no sessions named, or none started yet: no Battle pill', () => {
    expect(battleSpecOf({}, NOW)).toBeNull();
    expect(battleSpecOf({ timing: { tradingDays: [] } }, NOW)).toBeNull();
    expect(battleSpecOf({ timing: { tradingDays: ['2026-10-15'] } }, NOW)).toBeNull();
    expect(battleSpecOf({ timing: { tradingDays: ['not-a-day'] } }, NOW)).toBeNull();
  });
});

describe('battleCandlesOf — the regular session of the battle\'s days, up to now', () => {
  const bar = (iso, p = 100) => ({ date: iso, timestamp: Z(iso) / 1000, open: p, high: p + 1, low: p - 1, close: p, volume: 1 });
  it('drops pre-market, after-hours, other days, bars not yet started, and a daily (no time) bar; oldest-first', () => {
    const raw = [
      bar('2026-10-14T17:10:00.000Z'), // starts after now
      bar('2026-10-14T17:05:00.000Z'),
      bar('2026-10-14T13:30:00.000Z'), // 9:30 ET — the first regular bar
      bar('2026-10-14T13:25:00.000Z'), // pre-market
      bar('2026-10-13T20:00:00.000Z'), // 4:00 PM ET — after the close
      bar('2026-10-13T19:55:00.000Z'), // another day, not the battle's
      { date: '2026-10-14', open: 1, high: 2, low: 1, close: 2 },
    ];
    expect(battleCandlesOf(raw, { days: ['2026-10-14'], nowMs: NOW }).map((c) => c.date)).toEqual(['2026-10-14T13:30:00.000Z', '2026-10-14T17:05:00.000Z']);
  });
});

describe('barTimeOf — the bar that holds an instant', () => {
  const times = ['2026-10-13T19:30:00.000Z', '2026-10-14T13:30:00.000Z', '2026-10-14T14:00:00.000Z'].map((s) => Z(s) / 1000);
  it('inside a bar → that bar; on a bar\'s start → that bar', () => {
    expect(barTimeOf(Z('2026-10-14T13:59:59.000Z'), times)).toBe(times[1]);
    expect(barTimeOf(Z('2026-10-14T14:00:00.000Z'), times)).toBe(times[2]);
  });
  it('before the first session (an overnight entry, its fill quote\'s time) → the first bar', () => {
    expect(barTimeOf(Z('2026-10-13T12:00:00.000Z'), times)).toBe(times[0]);
  });
  it('after a close, or between sessions → the last bar before it', () => {
    expect(barTimeOf(Z('2026-10-13T23:00:00.000Z'), times)).toBe(times[0]);
    expect(barTimeOf(Z('2026-10-14T21:00:00.000Z'), times)).toBe(times[2]);
  });
  it('no bars: nowhere', () => { expect(barTimeOf(NOW, [])).toBeNull(); });
});

describe('dayMarkersOf — one marker per day, with its count', () => {
  it('six on Wed, one on Tue', () => {
    const m = (id, iso) => ({ id, atMs: Z(iso), day: iso.slice(0, 10) });
    const out = dayMarkersOf([m('a', '2026-10-14T13:47:00Z'), m('b', '2026-10-14T14:20:00Z'), m('c', '2026-10-14T14:31:00Z'), m('d', '2026-10-14T15:10:00Z'), m('e', '2026-10-14T15:22:00Z'), m('f', '2026-10-14T16:45:00Z'), m('t', '2026-10-13T15:00:00Z')]);
    expect(out).toEqual([{ day: '2026-10-13', count: 1, ids: ['t'], latestId: 't' }, { day: '2026-10-14', count: 6, ids: ['a', 'b', 'c', 'd', 'e', 'f'], latestId: 'f' }]);
  });
});

describe('rungLinesOf — the next rung each way at 💣\'s displayed prices (BUILD_RULES §9)', () => {
  let ladder;
  beforeAll(async () => {
    const battle = await measuredSheetBattle();
    ladder = measuredLadder({ measured: selectBombRecord(battle, 'AAPL', SHEET_NOW).measured });
  });
  it('the prices are rungFacts\' shown prices and the labels carry their strings', () => {
    const lines = rungLinesOf(ladder, 103.2);
    const up = rungFacts(ladder, ladder.next, 2);
    const down = rungFacts(ladder, ladder.nextDown, 2);
    expect(lines.map((l) => [l.id, l.price, l.label])).toEqual([
      ['rung_up', up.shown, `next rung +30 · ${up.priceText}`],
      ['rung_down', down.shown, `Bust −10 · ${down.priceText}`],
    ]);
    // The exact targets are not the shown prices (BP-1 rounds toward the award).
    expect(ladder.next.price).not.toBe(up.shown);
  });
  it('no rung lines for a preview, or without a price', () => {
    expect(rungLinesOf(previewLadder({ previousClose: 100, threshold: 2 }), 100)).toEqual([]);
    expect(rungLinesOf(ladder, null)).toEqual([]);
  });
});
