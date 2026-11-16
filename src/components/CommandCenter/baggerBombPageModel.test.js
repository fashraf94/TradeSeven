// src/components/CommandCenter/baggerBombPageModel.test.js
//
// League hide — the BaggerBomb page's pure derivations (baggerBombPageModel.js). Every row names a bug it would let through:
// a league row shown as a BaggerBomb game, a record invented from half a record, a live game chosen by fallback.

import { describe, expect, it } from 'vitest';
import {
  PAGE_COMPLETED_LIMIT,
  RECORD_STATUS,
  baggerBombGames,
  baggerBombRecord,
  careerOf,
  finishedBaggerBombRows,
  isBaggerBombRow,
  liveBaggerBombRows,
  pageFinished,
} from './baggerBombPageModel';

const row = (id, kind, live = false) => ({ id, kind, live });
const section = (over = {}) => ({
  status: 'ready',
  live: [row('l-bb', 'baggerbomb', true), row('l-rk', 'ranked', true)],
  rows: [row('l-bb', 'baggerbomb', true), row('l-rk', 'ranked', true), row('d1', 'ranked'), row('d2', 'baggerbomb'), row('d3', 'baggerbomb'), row('d4', 'ranked'), row('d5', 'baggerbomb'), row('d6', 'baggerbomb')],
  liveResolved: true,
  stale: false,
  carried: false,
  asOf: 1,
  nextAttemptAt: null,
  ...over,
});

describe('isBaggerBombRow', () => {
  it('is the hub\'s own classification: only a row of kind baggerbomb, never a ranked one, never a missing one', () => {
    expect(isBaggerBombRow(row('a', 'baggerbomb'))).toBe(true);
    expect(isBaggerBombRow(row('a', 'ranked'))).toBe(false);
    expect(isBaggerBombRow({ id: 'a' })).toBe(false);
    expect(isBaggerBombRow(null)).toBe(false);
    expect(isBaggerBombRow(undefined)).toBe(false);
  });
});

describe('baggerBombGames', () => {
  it('takes every league row out of both lists and keeps everything else of the section as it was', () => {
    const s = section({ stale: true, carried: true, asOf: 99, nextAttemptAt: 123, liveStale: true, liveAsOf: 7 });
    const out = baggerBombGames(s);
    expect(out.live.map((r) => r.id)).toEqual(['l-bb']);
    expect(out.rows.map((r) => r.id)).toEqual(['l-bb', 'd2', 'd3', 'd5', 'd6']);
    expect({ ...out, live: null, rows: null }).toEqual({ ...s, live: null, rows: null });
  });

  it('leaves the input untouched (the hub\'s own section is shared) and returns a frozen copy', () => {
    const s = section();
    const before = JSON.stringify(s);
    const out = baggerBombGames(s);
    expect(JSON.stringify(s)).toBe(before);
    expect(out).not.toBe(s);
    expect(Object.isFrozen(out)).toBe(true);
  });

  it('passes a non-section through (the loading shapes carry no lists): lists absent stay absent', () => {
    expect(baggerBombGames(null)).toBeNull();
    expect(baggerBombGames(undefined)).toBeUndefined();
    const loading = { status: 'loading' };
    const out = baggerBombGames(loading);
    expect(out.status).toBe('loading');
    expect(out.live).toBeUndefined();
    expect(out.rows).toBeUndefined();
  });
});

describe('the live and finished rows', () => {
  it('live: only BaggerBomb rows, and with none there is NO fallback to the first live game (the hub strip\'s live[0] rule)', () => {
    expect(liveBaggerBombRows(baggerBombGames(section())).map((r) => r.id)).toEqual(['l-bb']);
    const onlyLeague = section({ live: [row('l-rk', 'ranked', true)], rows: [row('l-rk', 'ranked', true)] });
    expect(liveBaggerBombRows(baggerBombGames(onlyLeague))).toEqual([]);
    expect(liveBaggerBombRows(onlyLeague)).toEqual([]);
  });

  it('finished: only BaggerBomb completed rows, in the window\'s own order, with no live row among them', () => {
    expect(finishedBaggerBombRows(baggerBombGames(section())).map((r) => r.id)).toEqual(['d2', 'd3', 'd5', 'd6']);
  });

  it('pageFinished: the first PAGE_COMPLETED_LIMIT BaggerBomb rows AFTER the league ones are out, and whether more wait behind History', () => {
    const out = pageFinished(baggerBombGames(section()));
    expect(PAGE_COMPLETED_LIMIT).toBe(3);
    expect(out.shown.map((r) => r.id)).toEqual(['d2', 'd3', 'd5']);
    expect(out.total).toBe(4);
    expect(out.more).toBe(true);
    const few = pageFinished(baggerBombGames(section({ rows: [row('d1', 'ranked'), row('d2', 'baggerbomb')] })), section({ rows: [row('d1', 'ranked'), row('d2', 'baggerbomb')] }));
    expect(few).toEqual({ shown: [row('d2', 'baggerbomb')], total: 1, more: false, otherKind: 1 });
    const exactly = pageFinished(baggerBombGames(section({ rows: ['a', 'b', 'c'].map((id) => row(id, 'baggerbomb')) })));
    expect(exactly.more).toBe(false);
  });
});

describe('pageFinished — how many finished games the filter took out of the window (the page says so instead of "none")', () => {
  it('otherKind counts the window\'s finished games of the other kind: 0 with no section to compare against, and when nothing was taken out', () => {
    const s = section();
    expect(pageFinished(baggerBombGames(s), s).otherKind).toBe(2);
    expect(pageFinished(baggerBombGames(s)).otherKind).toBe(0);
    const onlyBb = section({ rows: [row('d2', 'baggerbomb'), row('d3', 'baggerbomb')] });
    expect(pageFinished(baggerBombGames(onlyBb), onlyBb).otherKind).toBe(0);
  });

  it('a window of the other kind alone: nothing shown, otherKind says why; an empty window: nothing shown and nothing taken out', () => {
    const allLeague = section({ live: [], rows: [row('d1', 'ranked'), row('d4', 'ranked')] });
    expect(pageFinished(baggerBombGames(allLeague), allLeague)).toEqual({ shown: [], total: 0, more: false, otherKind: 2 });
    const empty = section({ live: [], rows: [] });
    expect(pageFinished(baggerBombGames(empty), empty)).toEqual({ shown: [], total: 0, more: false, otherKind: 0 });
  });

  it('live rows of either kind are never counted (they are not finished games)', () => {
    const s = section();
    const liveOnly = section({ rows: [row('l-bb', 'baggerbomb', true), row('l-rk', 'ranked', true)] });
    expect(pageFinished(baggerBombGames(liveOnly), liveOnly).otherKind).toBe(0);
    expect(pageFinished(baggerBombGames(s), s).total).toBe(4);
  });
});

describe('baggerBombRecord', () => {
  const ready = (stats) => ({ status: 'ready', agent: { id: 'a', ...(stats === undefined ? {} : { stats }) } });

  it('ready with wins, losses and games played as stored', () => {
    expect(baggerBombRecord(ready({ wins: 4, losses: 6, gamesPlayed: 11 }))).toEqual({ status: RECORD_STATUS.READY, wins: 4, losses: 6, draws: null, gamesPlayed: 11 });
    expect(baggerBombRecord(ready({ wins: 0, losses: 0, gamesPlayed: 0 }))).toEqual({ status: RECORD_STATUS.READY, wins: 0, losses: 0, draws: null, gamesPlayed: 0 });
  });

  it('games played is shown only when it is stored as a count — never derived from wins and losses', () => {
    expect(baggerBombRecord(ready({ wins: 4, losses: 6 }))).toEqual({ status: RECORD_STATUS.READY, wins: 4, losses: 6, draws: null, gamesPlayed: null });
    expect(baggerBombRecord(ready({ wins: 4, losses: 6, gamesPlayed: '10' })).gamesPlayed).toBeNull();
    expect(baggerBombRecord(ready({ wins: 4, losses: 6, gamesPlayed: -1 })).gamesPlayed).toBeNull();
  });

  it('draws are shown only when stored as a count ABOVE zero (Q-C) — never derived from games played, never "0 draws", never a bad value', () => {
    expect(baggerBombRecord(ready({ wins: 4, losses: 5, draws: 2, gamesPlayed: 11 })).draws).toBe(2);
    expect(baggerBombRecord(ready({ wins: 4, losses: 5, draws: 0, gamesPlayed: 9 })).draws).toBeNull();
    expect(baggerBombRecord(ready({ wins: 4, losses: 5, gamesPlayed: 11 })).draws).toBeNull();
    for (const draws of ['2', -1, 1.5, NaN, null, {}]) expect(baggerBombRecord(ready({ wins: 4, losses: 5, draws, gamesPlayed: 11 })).draws, String(draws)).toBeNull();
  });

  it('is unavailable unless BOTH wins and losses are counts: no half record, no fractions, no negatives, no strings', () => {
    for (const stats of [undefined, null, {}, { wins: 3 }, { losses: 3 }, { wins: '3', losses: 1 }, { wins: 3, losses: -1 }, { wins: 2.5, losses: 1 }, { wins: NaN, losses: 1 }]) {
      expect(baggerBombRecord(ready(stats)), JSON.stringify(stats)).toEqual({ status: RECORD_STATUS.UNAVAILABLE });
    }
  });

  it('is loading while the agent reads and unavailable when it read nothing or failed', () => {
    expect(baggerBombRecord({ status: 'loading', agent: null })).toEqual({ status: RECORD_STATUS.LOADING });
    expect(baggerBombRecord(null)).toEqual({ status: RECORD_STATUS.LOADING });
    expect(baggerBombRecord({ status: 'ready', agent: null })).toEqual({ status: RECORD_STATUS.UNAVAILABLE });
    expect(baggerBombRecord({ status: 'error', agent: null })).toEqual({ status: RECORD_STATUS.UNAVAILABLE });
  });
});

describe('careerOf — the History sheet\'s figure, from the same stored stats the record part shows', () => {
  it('"5W-3L" for a ready record, and the sheet\'s own loading / unavailable otherwise', () => {
    expect(careerOf(baggerBombRecord({ status: 'ready', agent: { stats: { wins: 5, losses: 3 } } }))).toEqual({ status: 'ready', record: '5W-3L' });
    // The sheet's figure agrees with the record part beside it: draws are in it exactly when the record shows them.
    expect(careerOf(baggerBombRecord({ status: 'ready', agent: { stats: { wins: 5, losses: 3, draws: 1 } } }))).toEqual({ status: 'ready', record: '5W-3L-1D' });
    expect(careerOf(baggerBombRecord({ status: 'ready', agent: { stats: { wins: 5, losses: 3, draws: 0 } } }))).toEqual({ status: 'ready', record: '5W-3L' });
    expect(careerOf({ status: RECORD_STATUS.LOADING })).toEqual({ status: 'loading' });
    expect(careerOf({ status: RECORD_STATUS.UNAVAILABLE })).toEqual({ status: 'unavailable' });
  });
});
