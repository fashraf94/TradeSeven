// src/screens/filmRoomV2/filmRoomModel.test.js
//
// Film Room v2 — the screen's reading of a tape, pure. Driven by the
// Sep-23-shaped fixture the A1 passes wrote (screenFixtures.test.js) and by
// small variants of it.

import { describe, it, expect } from 'vitest';
import sep23Tape from './__fixtures__/sep23.tape.json';
import emptyTape from './__fixtures__/empty.tape.json';
import {
  valueAt, classAt, numberAt, checkStateOf, checkRuns, riskLines, riskSummary, exitMakerOf, swapAnchor, swapOrdinals, deriveHoldings,
  directiveCardOf, rationaleTimeline, planGroups, evidenceMarkers, roleOf, deepSymbols, extremeBars, lastPointPath,
  fmtPoints, fmtPrice, fmtPriceDelta, etClock, etDateLabel, isRecordedScore, SCREEN_AGGREGATE_CLASSES, checkCounts,
  fmtPercent, seriesFacts, pctTicks,
} from './filmRoomModel';
import sep23Series from './__fixtures__/sep23.series.json';
import { SPEC_AGGREGATE_CLASSES } from './__fixtures__/filmRoomHarness';

const clone = (v) => JSON.parse(JSON.stringify(v));

describe('a number and its class come from the document, by path (BA-42, F2)', () => {
  it('reads the value at the path and the class the document declares for it', () => {
    expect(numberAt(sep23Tape, ['score', 'lastCheck', 'total'])).toEqual({ value: -47, cls: 'recorded', path: ['score', 'lastCheck', 'total'] });
    expect(classAt(sep23Tape, ['score', 'dayChange', 'value'])).toBe('derived');
    expect(classAt(sep23Tape, ['actions', 0, 'replay', 'gapPoints'])).toBe('rebuilt');
    expect(classAt(sep23Tape, ['plans', 0, 'price', 'atPlan', 'value'])).toBe('market');
    expect(classAt(sep23Tape, ['actions', 0, 'replay', 'reconciliation', 'soldAtSale', 'inputsDelta'])).toBe('derived');
  });

  it('the TAPE\'s declaration governs — a tape stored before BA-48 labels the inputs part rebuilt', () => {
    const older = clone(sep23Tape);
    older.numberClasses['actions[].replay.reconciliation.soldAtSale.inputsDelta'] = 'rebuilt';
    expect(classAt(older, ['actions', 0, 'replay', 'reconciliation', 'soldAtSale', 'inputsDelta'])).toBe('rebuilt');
  });

  it('an undeclared path has no class (never a substitute); a missing value is no number', () => {
    const t = clone(sep23Tape);
    delete t.numberClasses['score.lastCheck.total'];
    expect(classAt(t, ['score', 'lastCheck', 'total'])).toBeNull();
    expect(numberAt(sep23Tape, ['score', 'nope'])).toBeNull();
    expect(valueAt(sep23Tape, ['actions', 9, 'x'])).toBeUndefined();
  });

  it('the screen\'s own numbers have ONE declaration, equal to the addendum\'s (R4(a)), pinned by the harness oracle', () => {
    expect(SCREEN_AGGREGATE_CLASSES).toEqual(SPEC_AGGREGATE_CLASSES);
    expect(SPEC_AGGREGATE_CLASSES['count(checks[] in a run)']).toBe('derived');
  });

  it('sign colours: recorded scores only', () => {
    expect(isRecordedScore(sep23Tape, ['score', 'lastCheck', 'total'])).toBe(true);
    expect(isRecordedScore(sep23Tape, ['checks', 4, 'scores', 'total'])).toBe(true);
    expect(isRecordedScore(sep23Tape, ['actions', 1, 'lockedPoints'])).toBe(true);
    expect(isRecordedScore(sep23Tape, ['score', 'dayChange', 'value'])).toBe(false);          // derived
    expect(isRecordedScore(sep23Tape, ['actions', 1, 'replay', 'gapPoints'])).toBe(false);     // rebuilt
    expect(isRecordedScore(sep23Tape, ['plans', 0, 'price', 'atPlan', 'value'])).toBe(false);  // market
    expect(isRecordedScore(sep23Tape, ['actions', 0, 'exitPrice'])).toBe(false);               // recorded, not a score
  });
});

describe('checks (BA-8, BA-44; F3, F5)', () => {
  it('a completed check whose HOLD was not the model\'s reads as the platform\'s default hold — never "model call failed"', () => {
    const failed = sep23Tape.checks.filter((c) => c.decision?.holdKind === 'default_failure');
    expect(failed).toHaveLength(2);
    for (const c of failed) expect(checkStateOf(c)).toMatchObject({ key: 'default_hold', label: 'no usable model result · the system held by default' });
  });

  it('every state has words; the swap and the hold are completed checks', () => {
    expect(checkStateOf({ state: 'completed', decision: { final: 'SWAP' } }).label).toBe('completed · SWAP');
    expect(checkStateOf({ state: 'completed', decision: { final: 'HOLD' } }).label).toBe('completed · HOLD');
    expect(checkStateOf({ state: 'no_trigger' }).label).toBe('no trigger · no check woke');
    expect(checkStateOf({ state: 'budget_skipped' }).label).toBe('check skipped · budget');
    expect(checkStateOf({ state: 'deferred' }).label).toBe('check deferred · budget');
    expect(checkStateOf({ state: 'no_record' }).label).toBe('no record for this check');
    expect(checkStateOf({ state: 'gameplan_pending' }).label).toBe('plan pending · awaiting approval');   // the design of record's words
    expect(checkStateOf({ state: 'gameplan_created' }).label).toBe('plan created');
    expect(checkStateOf({ state: 'bogus' }).label).toBe('state not recorded');
  });

  it('F5 runs: state, span, count — the Sep-23 day is four runs', () => {
    const runs = checkRuns(sep23Tape);
    expect(runs.map((r) => [r.group, r.count])).toEqual([['gameplan_created', 1], ['gameplan_pending', 6], ['completed', 12], ['no_trigger', 4]]);
    expect(runs[2].kinds).toEqual({ hold: 9, default_hold: 2, swap: 1 });
    expect(runs[2].from).toBe(sep23Tape.checks[7].at);
    expect(runs[2].to).toBe(sep23Tape.checks[18].at);
    expect(checkRuns(emptyTape)).toEqual([]);
  });

  it('addendum R4(a) — "n of m": n is the rows with a record, m the minted range passes.close records (its range and the gaps it attributes)', () => {
    expect(checkCounts(sep23Tape)).toEqual({ n: 23, m: 23 });
    expect(checkCounts(emptyTape)).toEqual({ n: 0, m: null });   // no range recorded → "0 recorded"
    const t = clone(sep23Tape);
    t.checks[20].state = 'no_record';
    t.checks[21].state = 'deferred';
    expect(checkCounts(t)).toEqual({ n: 21, m: 23 });             // a deferral and a missing record are not checks with a record
    const r = clone(sep23Tape);
    r.checks[0].state = 'no_record'; r.checks[1].state = 'no_record';
    r.passes.close.tickSeqRange = [3, 23];
    expect(checkCounts(r)).toEqual({ n: 21, m: 21 });             // the range's size, not its last number
    r.passes.close.gaps = [1, 2];
    expect(checkCounts(r)).toEqual({ n: 21, m: 23 });             // the gaps the close pass attributes to the day are minted too
    const over = clone(sep23Tape);
    over.passes.close.tickSeqRange = [1, 20];
    expect(checkCounts(over)).toEqual({ n: 23, m: null });        // never a fraction the record does not support
  });

  it('BA-7 risk rows: "Risk decision recorded: HOLD", the action with its reason, or none recorded', () => {
    const swapCheck = sep23Tape.checks.find((c) => c.risk?.MSFT?.action === 'SWAP_OUT');
    expect(riskLines(swapCheck).find((l) => l.symbol === 'MSFT').text).toBe('Risk decision recorded: SWAP_OUT · stagnation');
    expect(riskLines(swapCheck).find((l) => l.symbol === 'AMD').text).toBe('Risk decision recorded: HOLD');
    expect(riskSummary(swapCheck)).toBe('Risk decision recorded: MSFT SWAP_OUT · stagnation');
    expect(riskSummary(sep23Tape.checks[0])).toBe('Risk decision recorded: HOLD');
    expect(riskLines({ risk: null })).toBeNull();
    expect(riskSummary({ risk: null })).toBe('No risk decision recorded');
  });
});

describe('actions (BA-6, BA-47)', () => {
  it('who made the exit, from the recorded mechanism', () => {
    expect(sep23Tape.actions.map((a) => exitMakerOf(a))).toEqual([
      { by: 'platform', label: 'Exit by platform rule · stagnation' },
      { by: 'agent', label: 'Exit by the agent · its own decision' },
      { by: 'platform', label: 'Exit by platform rule · stagnation' },
    ]);
    expect(exitMakerOf({ mechanism: 'unrecorded', exitReason: null }).by).toBe('unrecorded');
  });
  it('anchors are swap-1 … swap-n in the tape\'s order; a path\'s close is its last point', () => {
    expect(sep23Tape.actions.map((_, i) => swapAnchor(i))).toEqual(['swap-1', 'swap-2', 'swap-3']);
    const p = lastPointPath(sep23Tape, 0, 'swapPath');
    expect(valueAt(sep23Tape, p)).toBe(sep23Tape.actions[0].replay.swapPath.at(-1).points);
    expect(lastPointPath(emptyTape, 0, 'swapPath')).toBeNull();
  });
  it('addendum R4(a): a swap\'s ordinal is its place in TIME order — sequence only; an untimed action goes last, in the tape\'s order', () => {
    expect(swapOrdinals(sep23Tape)).toEqual([1, 2, 3]);
    const t = clone(sep23Tape);
    t.actions.reverse();                      // tape order no longer time order
    expect(swapOrdinals(t)).toEqual([3, 2, 1]);
    t.actions[1].at = null;
    expect(swapOrdinals(t)).toEqual([2, 3, 1]);
    expect(swapOrdinals(emptyTape)).toEqual([]);
  });
});

describe('BA-45 — holdings at the day\'s start and end, derived', () => {
  it('the first risk record\'s keys, moved slot by slot by the day\'s swaps, reconciled with the last risk record', () => {
    const h = deriveHoldings(sep23Tape);
    expect(h.status).toBe('derived');
    expect(h.start.symbols).toEqual(['AMD', 'BTC', 'DE', 'ETN', 'INTC', 'META', 'MSFT']);
    expect(h.end.symbols).toEqual(['AMD', 'BTC', 'PLTR', 'PANW', 'INTC', 'META', 'CRWD']);
    expect(h.changes.map((c) => [c.symbolOut, c.symbolIn, c.by])).toEqual([['MSFT', 'CRWD', 'platform'], ['DE', 'PLTR', 'agent'], ['ETN', 'PANW', 'platform']]);
    expect(h.start.at).toBe(sep23Tape.checks[0].at);
    expect(h.end.at).toBe(sep23Tape.checks[22].at);
  });

  it('no risk record → unavailable, with the reason; a record that does not reconcile → unavailable, never a guess', () => {
    expect(deriveHoldings(emptyTape).status).toBe('unavailable');
    const t = clone(sep23Tape);
    delete t.checks[22].risk.PANW;
    t.checks[22].risk.XOM = { action: 'HOLD', reason: null };
    const h = deriveHoldings(t);
    expect(h.status).toBe('unavailable');
    expect(h.note).toMatch(/do not reconcile/);
  });
});

describe('directives, rationale, plans, the deep dive', () => {
  it('BA-9 card states from the tape rows', () => {
    expect(sep23Tape.directives.map((d) => directiveCardOf(d))).toEqual([
      { filed: true, title: 'Directive filed', text: 'Tighten the downside stop.' },
      { filed: false, title: 'No new directive filed', text: 'Retained: Tighten the downside stop.' },
      { filed: false, title: 'No new directive filed', text: null },
    ]);
  });

  it('BA-46 timeline: recorded rationale and the checks with no agent text, in time order', () => {
    const rows = rationaleTimeline(sep23Tape);
    expect(rows.filter((r) => r.kind === 'rationale')).toHaveLength(sep23Tape.rationale.length);
    const states = rows.filter((r) => r.kind === 'state');
    expect(states.map((r) => r.index)).toEqual([8, 12]);
    expect(states.every((r) => r.label === 'no usable model result · the system held by default')).toBe(true);
    const ms = rows.map((r) => Date.parse(r.at));
    expect([...ms].sort((a, b) => a - b)).toEqual(ms);
  });

  it('plans grouped by their check, filterable by symbol', () => {
    const all = planGroups(sep23Tape);
    expect(all.flatMap((g) => g.items)).toEqual(sep23Tape.plans.map((_, i) => i));
    const pltr = planGroups(sep23Tape, 'PLTR').flatMap((g) => g.items);
    expect(pltr.every((i) => sep23Tape.plans[i].symbol === 'PLTR')).toBe(true);
  });

  it('BA-43: one evidence marker per check that stamped the symbol; the symbols held first; roles from the tape', () => {
    const marks = evidenceMarkers(sep23Tape, 'META');
    expect(marks.length).toBe(sep23Tape.checks.filter((c) => c.evidence?.META).length);
    for (const m of marks) expect(m.at).toBe(sep23Tape.checks[m.index].evidenceAt);
    const h = deriveHoldings(sep23Tape);
    expect(deepSymbols(sep23Tape, [{ symbol: 'SPY', role: 'market' }, { symbol: 'MU', role: 'plan' }], h).slice(0, 7)).toEqual(h.start.symbols);
    expect(deepSymbols(sep23Tape, [{ symbol: 'SPY', role: 'market' }, { symbol: 'MU', role: 'plan' }], h)).toContain('MU');
    expect(deepSymbols(sep23Tape, [{ symbol: 'SPY', role: 'market' }], h)).not.toContain('SPY');
    expect(roleOf(sep23Tape, 'META', h)).toMatchObject({ kind: 'held', text: 'held at the first and the last risk record' });
    expect(roleOf(sep23Tape, 'MSFT', h).text).toBe('exited at 12:45 PM · Exit by platform rule · stagnation');
    expect(roleOf(sep23Tape, 'PLTR', h).text).toBe('entered at 2:00 PM · a swap by the agent');
    expect(roleOf(sep23Tape, 'CRWD', h).text).toBe('entered at 12:45 PM · a swap by a platform rule · stagnation');
    expect(extremeBars([{ h: 2, l: 1 }, { h: 5, l: 0.5 }, { h: 3, l: 2 }])).toEqual({ hi: 1, lo: 1 });
  });
});

describe('addendum R4(a)/(b) — the Deep dive\'s computed facts and its percent gridlines', () => {
  const msft = sep23Series.find((s) => s.symbol === 'MSFT');

  it('open-to-close change and session volume come from the ONE document\'s own bars', () => {
    const f = seriesFacts(msft, sep23Tape);
    expect(f.change).toBe(msft.bars[msft.bars.length - 1].c / msft.sessionOpen.value - 1);
    expect(f.volume).toBe(msft.bars.reduce((sum, b) => sum + b.v, 0));
    const spy = seriesFacts(sep23Series.find((s) => s.symbol === 'SPY'), sep23Tape);
    expect(spy.change).not.toBe(f.change);
    expect(spy.volume).not.toBe(f.volume);
  });

  it('a document that cannot carry a fact whole carries none of it: a bar with no volume; a symbol the candle pass lists incomplete; no bars', () => {
    const gap = clone(msft);
    gap.bars[5].v = null;
    expect(seriesFacts(gap, sep23Tape)).toEqual({ change: seriesFacts(msft, sep23Tape).change, volume: null });
    const t = clone(sep23Tape);
    t.passes.candles.symbolsIncomplete = ['MSFT'];
    expect(seriesFacts(msft, t)).toEqual({ change: null, volume: null });
    expect(seriesFacts({ ...msft, bars: [] }, sep23Tape)).toEqual({ change: null, volume: null });
    expect(seriesFacts({ ...msft, sessionOpen: { value: null } }, sep23Tape).change).toBeNull();
  });

  it('percent formats with its shown sign; gridline steps are round and at most five across the span', () => {
    expect([fmtPercent(0.0053), fmtPercent(-0.0125), fmtPercent(0), fmtPercent(0.00004), fmtPercent(null)]).toEqual(['+0.53%', '−1.25%', '0.00%', '0.00%', '—']);
    expect(pctTicks(-0.004, 0.006)).toEqual([-0.0025, 0, 0.0025, 0.005]);
    expect(pctTicks(-0.03, 0.05)).toEqual([-0.02, 0, 0.02, 0.04]);
    expect(pctTicks(0.01, 0.01)).toEqual([]);
    for (const [lo, hi] of [[-0.004, 0.006], [-0.03, 0.05], [-0.0011, 0.0009]]) expect(pctTicks(lo, hi).length).toBeLessThanOrEqual(6);
  });
});

describe('formats (display only; the value is the tape\'s)', () => {
  it('points, prices, deltas, ET clock and dates', () => {
    expect([fmtPoints(9), fmtPoints(-13), fmtPoints(0), fmtPoints(1.5), fmtPoints(null)]).toEqual(['+9', '−13', '0', '+1.5', '—']);
    expect([fmtPrice(498.79), fmtPrice(71240), fmtPriceDelta(-0.17), fmtPriceDelta(0.07)]).toEqual(['498.79', '71,240.00', '−0.17', '+0.07']);
    expect(etClock('2026-09-23T19:45:20.000Z')).toBe('3:45 PM');
    expect(etClock(null)).toBeNull();
    expect(etDateLabel('2026-09-23')).toBe('Wed, Sep 23, 2026');
    expect(etDateLabel('2026-09-23', { short: true })).toBe('Sep 23');
  });
});
