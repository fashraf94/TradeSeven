// api/_utils/filmTape/tapePure.test.js
//
// The tape's pure pieces, row by row: ET day bounds across DST, the two
// schedules, the candle window, gap attribution (BA-8 / BA-20), the
// number-class resolver (BA-21) and the merge's row rules (BA-19).

import { describe, it, expect } from 'vitest';
import {
  etDateOf, etDayBounds, closePassWindowFor, nextCandleRunEtDate, candleWindowStart, withinCandleWindow, sessionDatesBetween,
} from './tapeTime.js';
import { gapAnalysis, orderChecks, ghostBaseline, tickState } from './tapeAssemble.js';
import { mergeRows, sanitizeForFirestore, sameContent } from './tapeMerge.js';
import { classOfNumber, numbersWithClasses, TAPE_NUMBER_CLASSES, SERIES_NUMBER_CLASSES, PROVENANCE_CLASSES } from '../../../src/constants/filmTape.js';

describe('tapeTime — ET by Intl, never a hand-rolled offset', () => {
  it('ET day bounds are midnight to midnight in both DST states', () => {
    expect(etDayBounds('2026-09-24')).toMatchObject({ startIso: '2026-09-24T04:00:00.000Z', endIso: '2026-09-25T04:00:00.000Z' });
    expect(etDayBounds('2026-12-01')).toMatchObject({ startIso: '2026-12-01T05:00:00.000Z', endIso: '2026-12-02T05:00:00.000Z' });
    // the fall-back day is 25 hours long
    const fall = etDayBounds('2026-11-01');
    expect(fall.endMs - fall.startMs).toBe(25 * 3_600_000);
    expect(etDayBounds('nope')).toBeNull();
  });

  it('etDateOf resolves the ET calendar date of an instant', () => {
    expect(etDateOf('2026-09-25T02:15:00Z')).toBe('2026-09-24');
    expect(etDateOf('2026-09-25T04:00:00Z')).toBe('2026-09-25');
    expect(etDateOf('garbage')).toBeNull();
  });

  it('the close pass for session D fires 02:15 UTC the next UTC day — the same ET date in EDT and EST', () => {
    expect(closePassWindowFor('2026-09-24')).toEqual({ startMs: Date.parse('2026-09-25T02:15:00Z'), endMs: Date.parse('2026-09-25T02:20:00Z') });
    expect(etDateOf(closePassWindowFor('2026-12-01').startMs)).toBe('2026-12-01'); // 21:15 EST
    expect(etDateOf(closePassWindowFor('2026-09-24').startMs)).toBe('2026-09-24'); // 22:15 EDT
    expect(closePassWindowFor('2026-09-26')).toBeNull(); // Saturday
  });

  it('the next candle run (0 11 * * 2-6 UTC) and its 10-session window', () => {
    expect(nextCandleRunEtDate(Date.parse('2026-09-25T02:20:00Z'))).toBe('2026-09-25'); // Fri 11:00 UTC
    expect(nextCandleRunEtDate(Date.parse('2026-09-26T12:00:00Z'))).toBe('2026-09-29'); // Sat past 11:00 → Tue
    expect(candleWindowStart('2026-10-06')).toBe('2026-09-22');
    expect(withinCandleWindow('2026-09-24', Date.parse('2026-09-25T02:20:00Z'))).toBe(true);
    expect(withinCandleWindow('2026-09-01', Date.parse('2026-09-25T02:20:00Z'))).toBe(false);
  });

  it('sessionDatesBetween skips weekends and holidays', () => {
    expect(sessionDatesBetween('2026-11-25', '2026-11-30')).toEqual(['2026-11-25', '2026-11-27', '2026-11-30']);
  });
});

describe('gapAnalysis — a gap is placed only where the surviving records place it', () => {
  it('interior gaps are this day\'s', () => {
    expect(gapAnalysis({ seqs: [1, 2, 4, 7], prevSeq: null, nextSeq: 8, mintedMax: 20, earlierSessionExists: false, laterSessionStarted: true }))
      .toEqual({ attributed: [3, 5, 6], unattributed: [] });
  });
  it('a leading edge is this day\'s only on the battle\'s first session with nothing before it', () => {
    expect(gapAnalysis({ seqs: [3, 4], prevSeq: null, nextSeq: null, mintedMax: 4, earlierSessionExists: false, laterSessionStarted: false }).attributed).toEqual([1, 2]);
    expect(gapAnalysis({ seqs: [13, 14], prevSeq: 10, nextSeq: null, mintedMax: 14, earlierSessionExists: true, laterSessionStarted: false }))
      .toEqual({ attributed: [], unattributed: [11, 12] });
  });
  it('a trailing edge up to the counter is this day\'s only while no later session has started', () => {
    expect(gapAnalysis({ seqs: [1, 2], prevSeq: null, nextSeq: null, mintedMax: 5, earlierSessionExists: false, laterSessionStarted: false }).attributed).toEqual([3, 4, 5]);
    expect(gapAnalysis({ seqs: [1, 2], prevSeq: null, nextSeq: null, mintedMax: 5, earlierSessionExists: false, laterSessionStarted: true }))
      .toEqual({ attributed: [], unattributed: [3, 4, 5] });
    expect(gapAnalysis({ seqs: [1, 2], prevSeq: null, nextSeq: 6, mintedMax: 9, earlierSessionExists: false, laterSessionStarted: true }))
      .toEqual({ attributed: [], unattributed: [3, 4, 5] });
  });
  it('a day with no record at all: the stretch between its neighbours, placed only when nothing else could own it', () => {
    expect(gapAnalysis({ seqs: [], prevSeq: 10, nextSeq: 14, mintedMax: 20, earlierSessionExists: true, laterSessionStarted: true }))
      .toEqual({ attributed: [], unattributed: [11, 12, 13] });
    expect(gapAnalysis({ seqs: [], prevSeq: null, nextSeq: null, mintedMax: 3, earlierSessionExists: false, laterSessionStarted: false }))
      .toEqual({ attributed: [1, 2, 3], unattributed: [] });
  });
  it('a corrupt counter cannot run the walk away', () => {
    expect(gapAnalysis({ seqs: [1], prevSeq: null, nextSeq: null, mintedMax: 1e9, earlierSessionExists: false, laterSessionStarted: false }).attributed).toEqual([]);
  });
});

describe('checks — order and state', () => {
  it('a gap sits right after the record before it; entry and run rows by time', () => {
    const rows = [
      { key: 'seq:2', tickSeq: 2, at: '2026-09-24T14:00:00Z' },
      { key: 'seq:3', tickSeq: 3, at: null },
      { key: 'run:x', tickSeq: null, at: '2026-09-24T14:10:00Z' },
      { key: 'seq:1', tickSeq: 1, at: '2026-09-24T13:45:00Z' },
      { key: 'seq:4', tickSeq: 4, at: '2026-09-24T14:30:00Z' },
    ];
    expect(orderChecks(rows).map((r) => r.key)).toEqual(['seq:1', 'seq:2', 'seq:3', 'run:x', 'seq:4']);
  });
  it('a budget-skipped call reads budget_skipped although its tick exits completed; an unknown exit is unknown', () => {
    expect(tickState({ exitReason: 'completed', model: { failureClass: 'budget_skipped' } }, null)).toBe('budget_skipped');
    expect(tickState({ exitReason: 'completed' }, { haikuError: { failureClass: 'budget_skipped' } })).toBe('budget_skipped');
    expect(tickState({ exitReason: 'no_trigger' }, null)).toBe('no_trigger');
    expect(tickState({ exitReason: 'weird' }, null)).toBe('unknown');
  });
});

describe('ghostBaseline — the evaluator\'s precedence, from recorded facts only', () => {
  const at = '2026-09-24T15:00:00Z';
  it('swapped in the same day → swapPrice = the entry', () => {
    expect(ghostBaseline({ receipt: { guardrailReplay: { outgoingSwappedInDay: 2 } }, entryPrice: 50, swappedOutAt: at, activatedAt: '2026-09-20T13:00:00Z' }))
      .toMatchObject({ value: 50, basis: 'swap_price' });
  });
  it('the activation day → the starting price = the entry', () => {
    expect(ghostBaseline({ receipt: { guardrailReplay: {} }, entryPrice: 50, swappedOutAt: at, activatedAt: '2026-09-24T12:00:00Z' }))
      .toMatchObject({ value: 50, basis: 'starting_price' });
  });
  it('otherwise the unrecorded previousClose → no value, never a guess', () => {
    expect(ghostBaseline({ receipt: { guardrailReplay: {} }, entryPrice: 50, swappedOutAt: at, activatedAt: '2026-09-23T23:00:00Z' }))
      .toEqual({ value: null, basis: 'previous_close', source: null });
    expect(ghostBaseline({ receipt: null, entryPrice: 50, swappedOutAt: at, activatedAt: '2026-09-24T12:00:00Z' }).value).toBeNull();
  });
});

describe('number classes (BA-21) — exactly one class per number', () => {
  it('resolves wildcards for symbol keys and [] for array elements, never across the two', () => {
    expect(classOfNumber(TAPE_NUMBER_CLASSES, ['checks', 3, 'evidence', 'AAPL', 'px'])).toBe('recorded');
    expect(classOfNumber(TAPE_NUMBER_CLASSES, ['actions', 0, 'replay', 'gapPoints'])).toBe('rebuilt');
    expect(classOfNumber(TAPE_NUMBER_CLASSES, ['actions', 0, 'replay', 'marketChangeAfter', 'SPY'])).toBe('market');
    expect(classOfNumber(TAPE_NUMBER_CLASSES, ['score', 'dayChange', 'value'])).toBe('derived');
    expect(classOfNumber(TAPE_NUMBER_CLASSES, ['checks', 'AAPL', 'evidence', 'AAPL', 'px'])).toBeNull();
    expect(classOfNumber(TAPE_NUMBER_CLASSES, ['score', 'unknownNumber'])).toBeNull();
    expect(classOfNumber(SERIES_NUMBER_CLASSES, ['bars', 12, 'c'])).toBe('market');
  });
  it('an ambiguous declaration is a bug, not a label', () => {
    expect(classOfNumber({ 'a.*': 'market', 'a.b': 'recorded' }, ['a', 'b'])).toBeNull();
  });
  it('every declared class is one of the four; there is no fifth', () => {
    for (const cls of [...Object.values(TAPE_NUMBER_CLASSES), ...Object.values(SERIES_NUMBER_CLASSES)]) expect(PROVENANCE_CLASSES).toContain(cls);
  });
  it('the walker finds every finite number and skips the declaration itself', () => {
    const doc = { tapeVersion: 2, numberClasses: { x: 'recorded' }, score: { dayChange: { value: 1.5 } }, nope: Number.NaN };
    expect(numbersWithClasses(doc, TAPE_NUMBER_CLASSES).map((n) => [n.path.join('.'), n.cls])).toEqual([['tapeVersion', 'recorded'], ['score.dayChange.value', 'derived']]);
  });
});

describe('merge rows (BA-19)', () => {
  it('a stored row the new read lacks is kept; a lost column group is carried whole', () => {
    const stored = [
      { key: 'seq:1', rowSource: 'tick', tickSeq: 1, at: 'a1', evidence: { X: { px: 1 } }, evidenceAt: 'p1', tickMs: 5 },
      { key: 'seq:2', rowSource: 'tick', tickSeq: 2, at: 'a2', evidence: null, evidenceAt: null, tickMs: 6 },
    ];
    const fresh = [{ key: 'seq:1', rowSource: 'tick', tickSeq: 1, at: 'a1', evidence: null, evidenceAt: null, tickMs: null }];
    const { rows, carried } = mergeRows('checks', stored, fresh);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ evidence: { X: { px: 1 } }, evidenceAt: 'p1', tickMs: 5 });
    expect(carried.rows).toBe(1);
    expect(carried.groups).toEqual({ evidence: 1, tickMs: 1 });
  });
  it('nothing weaker replaces a tick row: a later "no record" for the same sequence is ignored', () => {
    const { rows } = mergeRows('checks', [{ key: 'seq:3', rowSource: 'tick', tickSeq: 3, at: 'a', state: 'completed' }], [{ key: 'seq:3', rowSource: 'gap', tickSeq: 3, at: null, state: 'no_record' }]);
    expect(rows).toEqual([{ key: 'seq:3', rowSource: 'tick', tickSeq: 3, at: 'a', state: 'completed' }]);
  });
  it('a check known by its entry is superseded once its tick record appears', () => {
    const { rows } = mergeRows('checks', [{ key: 'eval:e1', rowSource: 'entry', tickSeq: null, evalId: 'e1', at: 'a' }], [{ key: 'seq:4', rowSource: 'tick', tickSeq: 4, evalId: 'e1', at: 'a' }]);
    expect(rows.map((r) => r.key)).toEqual(['seq:4']);
  });
  it('candle columns always come from the stored row; a new row starts them null', () => {
    const { rows } = mergeRows('actions', [{ key: 'k1', at: 'a', replay: { gapPoints: 1 }, tradeMatched: true }], [{ key: 'k1', at: 'a', replay: 'NEW', tradeMatched: true }, { key: 'k2', at: 'b', replay: 'NEW' }]);
    expect(rows.find((r) => r.key === 'k1').replay).toEqual({ gapPoints: 1 });
    expect(rows.find((r) => r.key === 'k2').replay).toBeNull();
  });
  it('a call whose observed fields are unchanged keeps its copiedAt', () => {
    const s = { key: 'c', callId: 'c', state: 'open', mintedAt: 1, copiedAt: 'first', tapeWriteMode: 'shadow' };
    const { rows } = mergeRows('calls', [s], [{ ...s, copiedAt: 'second', tapeWriteMode: 'on' }]);
    expect(rows[0].copiedAt).toBe('first');
    const moved = mergeRows('calls', [s], [{ ...s, state: 'hit', copiedAt: 'second' }]);
    expect(moved.rows[0]).toMatchObject({ state: 'hit', copiedAt: 'second' });
  });
  it('sanitizeForFirestore drops undefined and non-finite numbers; sameContent ignores bookkeeping', () => {
    expect(sanitizeForFirestore({ a: undefined, b: Number.POSITIVE_INFINITY, c: [undefined, 1], d: { e: undefined } })).toEqual({ b: null, c: [null, 1], d: {} });
    expect(sameContent({ writtenAt: 'x', runCount: 1, passes: { close: { writtenAt: 'x', status: 'written' } }, a: 1 },
      { writtenAt: 'y', runCount: 9, passes: { close: { writtenAt: 'y', status: 'written' } }, a: 1 })).toBe(true);
  });
});
