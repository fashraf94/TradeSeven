// src/components/Research/ChartRead/chartRead.test.js
//
// The Chart view's read — THE WORDING, THE SHEET AND WHAT CHANGED (build prompt §5, §6, §8; spec
// docs/specs/CHART_READ_SPEC_V1.md). Every state from a record made by the store's own evaluator (the
// fixtures go through the route's record fixture and its projection), the not-in-an-uptrend lead for each
// combination of failed checks and for a downtrend, every printed number equal to the record's to the cent,
// the change table row by row with every unlisted pair showing nothing, and the honesty sweep over every output.

import { describe, it, expect, beforeAll } from 'vitest';
import { STATE_ROWS, bodyFor, previousFor } from './__fixtures__/chartReadRecords.js';
import { readLineOf, readStateOf, sheetOf, changeOf, uptrendRows, CHANGE_TABLE, READ_STATES, SHEET_STATES } from './chartRead.js';
import { CHART_READ_COPY as C, RULE_SET_COPY, REFUSAL_WORDS, REFUSAL_FALLBACK } from './chartReadCopy.js';
import { ADAPTER_REFUSALS } from '../../../../api/_utils/setupEvaluator/dailyBarsAdapter.js';

const SESSION = '2026-11-17'; // a Tuesday
const PREV_SESSION = '2026-11-16'; // the Monday before
const W = RULE_SET_COPY['tf-setup-v1'];
const B = {};
beforeAll(async () => {
  for (const s of Object.keys(STATE_ROWS)) B[s] = await bodyFor(s, { session: SESSION });
});
const clone = (x) => structuredClone(x);
// An INDEPENDENT cent rounding (half up on the decimal string, through an exponent shift — never toFixed on the double).
const cents = (v) => `$${(Math.round(Number(`${String(v)}e2`)) / 100).toFixed(2)}`;
const text = (l) => `${l.lead ?? ''}${l.rest}`;

describe('the eight states of §5, each from an evaluator-made record', () => {
  it('valid · Pullback and Resume: the lead, its 20-day to the cent, the second line, the date', () => {
    const l = readLineOf(B.VALID_PULLBACK);
    expect(l.state).toBe('valid_pullback');
    expect(l.eyebrow).toBe('Setup check · daily');
    expect(l.asOf).toBe('as of Tue Nov 17 close');
    expect(text(l)).toBe(`Pullback and Resume · present — touched its 20-day (${cents(B.VALID_PULLBACK.read.facts.SMA_fast)}) and closed back above it.`);
    expect(l.second).toBe('Volume isn’t part of this pattern; participation is unconfirmed.');
    expect([l.glyph, l.opensSheet]).toEqual(['present', true]);
  });
  it('valid · Trend Breakout: the 20-session high to the cent and the volume over its average to one decimal; no second line', () => {
    const { read } = B.VALID_BREAKOUT;
    const l = readLineOf(B.VALID_BREAKOUT);
    expect(l.state).toBe('valid_breakout');
    const x = (Math.round(Number(`${String(read.facts.V / read.facts.V_avg)}e1`)) / 10).toFixed(1);
    expect(text(l)).toBe(`Trend Breakout · present — closed at or above the 20-session high (${cents(read.facts.swingHigh)}) on ${x}× average volume.`);
    expect(x).toBe('2.1');
    expect(l.second).toBeNull();
  });
  it('not in an uptrend: the failed checks only, and the second line that says it is not a downtrend call', () => {
    const l = readLineOf(B.REGIME_A);
    expect(l.state).toBe('regime');
    expect(text(l)).toBe(`Not in an uptrend — closed below its 20-day (${cents(B.REGIME_A.read.facts.SMA_fast)}).`);
    expect(l.second).toBe('It changes with closes back above the 20-day and the 50-day turning up. This is not a downtrend call.');
    expect(l.glyph).toBe('absent');
  });
  it('in an uptrend, no pattern: the two gaps, each number the record\'s', () => {
    const { read } = B.NO_SETUP;
    const l = readLineOf(B.NO_SETUP);
    expect(l.state).toBe('no_setup');
    expect(text(l)).toBe('In an uptrend; no entry pattern today.');
    expect(l.second).toBe(`A pullback needs a low at or below the 20-day (${cents(read.facts.SMA_fast)}). A breakout needs a close at or above ${cents(read.facts.swingHigh)} on 1.5× average volume.`);
  });
  it('stretched: the satisfied pattern named, the wait line', () => {
    const l = readLineOf(B.EXTENDED);
    expect(l.state).toBe('extended');
    expect(text(l)).toBe('Pullback and Resume pattern present, but stretched — the close is more than 2 ATR above the 20-day.');
    expect(l.second).toBe('The check says wait.');
    expect(l.glyph).toBe('wait');
    const both = clone(B.EXTENDED);
    both.read.patternsSatisfied = ['breakout', 'pullback_resume'];
    expect(readLineOf(both).lead).toBe('Trend Breakout and Pullback and Resume patterns present, but stretched');
  });
  it('unknown: the missing facts in words; no sheet, no marks', () => {
    const l = readLineOf(B.UNKNOWN_V);
    expect(l.state).toBe('unknown');
    expect(text(l)).toBe('Not enough to read — the session’s volume is missing.');
    expect([l.opensSheet, l.marks, l.second]).toEqual([false, [], null]);
    const two = clone(B.UNKNOWN_V);
    two.read.missing = ['SMA_slow', 'SMA_slow_5ago'];
    expect(text(readLineOf(two))).toBe('Not enough to read — the 50-day and the 50-day five sessions ago are missing.');
    const hist = clone(B.UNKNOWN_V);
    hist.read.reason = 'insufficient_history';
    expect(text(readLineOf(hist))).toBe('Not enough to read — fewer than 55 completed sessions of history.');
    const low = clone(B.UNKNOWN_V);
    low.read.missing = [];
    low.read.pullbackLows[1].low = null;
    expect(text(readLineOf(low))).toBe('Not enough to read — a low of the last three sessions is missing.');
    expect(sheetOf(B.UNKNOWN_V)).toBeNull();
  });
  it('refused: the reason in words; no sheet, no marks, no change chip', () => {
    const l = readLineOf({ ...B.SPLIT, previous: { session: PREV_SESSION, verdict: 'valid', reason: null, pattern: 'pullback_resume', regime: 'uptrend', patternsSatisfied: ['pullback_resume'], checks: [] } });
    expect(l.state).toBe('refused');
    expect(text(l)).toBe('No read for this stock today — a split or dividend inside the window.');
    expect([l.opensSheet, l.marks, l.change, l.glyph]).toEqual([false, [], null, 'none']);
    const odd = clone(B.SPLIT);
    odd.read.reason = 'a_reason_from_tomorrow';
    expect(text(readLineOf(odd))).toBe(`No read for this stock today — ${REFUSAL_FALLBACK}.`);
    expect(sheetOf(B.SPLIT)).toBeNull();
  });
  it('no record: one line, no date, no sheet', () => {
    const body = { answer: 'absent', symbol: 'ABC', servedAt: 1, sessionsTried: [SESSION, PREV_SESSION], read: null, previous: null };
    const l = readLineOf(body);
    expect(l).toMatchObject({ state: 'absent', asOf: null, lead: null, rest: 'Measured after each close; no read yet for this stock.', opensSheet: false, marks: [] });
    expect(sheetOf(body)).toBeNull();
  });
  it('the refusal words cover the adapter\'s closed list exactly, so a reason never renders raw', () => {
    expect(Object.keys(REFUSAL_WORDS).sort()).toEqual([...ADAPTER_REFUSALS].sort());
  });
  it('READ_STATES and SHEET_STATES are closed lists; every fixture lands in one, none merges two', () => {
    const seen = Object.fromEntries(Object.entries(B).map(([k, b]) => [k, readStateOf(b)]));
    expect(seen).toEqual({
      VALID_PULLBACK: 'valid_pullback', VALID_BREAKOUT: 'valid_breakout', NO_SETUP: 'no_setup', EXTENDED: 'extended', UNKNOWN_V: 'unknown',
      NO_ADJUSTMENT: 'valid_pullback', SPLIT: 'refused', REGIME_A: 'regime', REGIME_B: 'regime', REGIME_C: 'regime', REGIME_AB: 'regime',
      REGIME_AC: 'regime', REGIME_BC: 'regime', REGIME_ABC_FLAT: 'regime', DOWNTREND: 'regime',
    });
    for (const s of Object.values(seen)) expect(READ_STATES).toContain(s);
    expect(SHEET_STATES).toEqual(['valid_pullback', 'valid_breakout', 'regime', 'no_setup', 'extended']);
  });
});

describe('RD-7: the not-in-an-uptrend lead names only the checks that failed', () => {
  const sma = (k) => cents(B[k].read.facts.SMA_fast);
  it.each([
    ['REGIME_A', () => `closed below its 20-day (${sma('REGIME_A')})`],
    ['REGIME_B', () => 'the 20-day is below the 50-day'],
    ['REGIME_C', () => 'the 50-day is falling'],
    ['REGIME_AB', () => `closed below its 20-day (${sma('REGIME_AB')}), and the 20-day is below the 50-day`],
    ['REGIME_AC', () => `closed below its 20-day (${sma('REGIME_AC')}), and the 50-day is falling`],
    ['REGIME_BC', () => 'the 20-day is below the 50-day, and the 50-day is falling'],
    ['REGIME_ABC_FLAT', () => `closed at its 20-day (${sma('REGIME_ABC_FLAT')}), the 20-day is level with the 50-day, and the 50-day is flat over five sessions`],
    ['DOWNTREND', () => `closed below its 20-day (${sma('DOWNTREND')}), the 20-day is below the 50-day, and the 50-day is falling`],
  ])('%s', (k, parts) => {
    const l = readLineOf(B[k]);
    expect(text(l)).toBe(`Not in an uptrend — ${parts()}.`);
    // "downtrend" only when the record's regime says so (RD-7); then the second line drops its last sentence.
    const down = B[k].read.regime === 'downtrend';
    expect(down).toBe(k === 'DOWNTREND');
    expect(l.second).toBe(down ? 'It changes with closes back above the 20-day and the 50-day turning up.' : 'It changes with closes back above the 20-day and the 50-day turning up. This is not a downtrend call.');
  });
  it('never says "downtrend" when the record is no_trend, in the line or the sheet', () => {
    for (const k of ['REGIME_A', 'REGIME_B', 'REGIME_C', 'REGIME_AB', 'REGIME_AC', 'REGIME_BC', 'REGIME_ABC_FLAT']) {
      expect(B[k].read.regime).toBe('no_trend');
      const l = readLineOf(B[k]);
      const all = [text(l), l.second, ...l.notes, JSON.stringify(sheetOf(B[k], { expanded: true }))].join(' ');
      expect(all.replace('This is not a downtrend call.', '')).not.toMatch(/downtrend/i);
    }
  });
  it('the uptrend rows: row 1 is the recorded pullback_close; the pairs AND to the recorded chain — or nothing is shown', () => {
    const rows = uptrendRows(B.REGIME_B.read);
    expect(rows.map((r) => r.result)).toEqual([true, false, true]);
    const tampered = clone(B.REGIME_B);
    tampered.read.checks.find((c) => c.id === 'regime_stack').result = true; // disagrees with its own pairs
    expect(uptrendRows(tampered.read)).toBeNull();
    expect(readLineOf(tampered).state).toBe('unshown');
    expect(sheetOf(tampered)).toBeNull();
    const swapped = clone(B.REGIME_B);
    swapped.read.checks.find((c) => c.id === 'pullback_close').rhs = 1; // row 1's sides are not the chain's first pair
    expect(uptrendRows(swapped.read)).toBeNull();
  });
});

describe('the date and the footnotes (RD-8 – RD-10, round 6 F)', () => {
  it('RD-9: yesterday\'s record says so in the date', () => {
    const b = clone(B.NO_SETUP);
    b.read.behind = true;
    expect(readLineOf(b).asOf).toBe('As of Tue Nov 17 close (today’s isn’t in yet)');
  });
  it('RD-8: on a trading day whose own record is not in yet; never on a weekend, never once today\'s is in', () => {
    expect(readLineOf(B.VALID_PULLBACK, { todayEt: '2026-11-18', todayIsSession: true }).notes).toEqual(['Tuesday’s close. Today’s session is read after it ends.']);
    expect(readLineOf(B.VALID_PULLBACK, { todayEt: '2026-11-21', todayIsSession: false }).notes).toEqual([]);
    expect(readLineOf(B.VALID_PULLBACK, { todayEt: SESSION, todayIsSession: true }).notes).toEqual([]);
    expect(readLineOf(B.VALID_PULLBACK).notes).toEqual([]);
  });
  it('RD-10: adjustment data missing → the one footnote', () => {
    expect(readLineOf(B.NO_ADJUSTMENT).notes).toEqual(['The split check couldn’t run on this record.']);
    expect(readLineOf(B.VALID_PULLBACK).notes).toEqual([]);
  });
  it('the Battle chart: the read stays as text, says where its marks are, and drops its second line', () => {
    const l = readLineOf(B.VALID_PULLBACK, { todayEt: '2026-11-18', todayIsSession: true, battle: true });
    expect(l.notes).toEqual(['Daily marks are on 1D and 1W, not on these 30-minute bars.']);
    expect(l.second).toBeNull();
    expect(text(l)).toBe(text(readLineOf(B.VALID_PULLBACK)));
  });
});

describe('MK-2: an unknown rule set draws no marks and opens no sheet; a record that cannot be worded is never shown in part', () => {
  it('another setupVersion', () => {
    const b = clone(B.VALID_PULLBACK);
    b.read.ruleSet.setupVersion = 'tf-setup-v2';
    const l = readLineOf(b);
    expect(l).toMatchObject({ state: 'unknown_rule_set', marks: [], opensSheet: false, rest: 'Measured by rule set tf-setup-v2; this app can’t show that rule’s marks yet.' });
    expect(sheetOf(b)).toBeNull();
  });
  it('a valid record whose 20-day is null', () => {
    const b = clone(B.VALID_PULLBACK);
    b.read.facts.SMA_fast = null;
    expect(readLineOf(b)).toMatchObject({ state: 'unshown', rest: 'This record can’t be shown.', marks: [], opensSheet: false });
  });
  it('an invalid record with a reason off the list', () => {
    const b = clone(B.NO_SETUP);
    b.read.reason = 'something_else';
    expect(readLineOf(b).state).toBe('unshown');
  });
});

describe('every number printed equals the record\'s, to the cent (RD-6, BUILD_RULES §9)', () => {
  it('the line and the sheet print only the record\'s own prices, each from its field', () => {
    for (const k of Object.keys(STATE_ROWS)) {
      const b = B[k];
      const l = readLineOf(b, { todayEt: '2026-11-18', todayIsSession: true });
      const sh = sheetOf(b, { expanded: true });
      const r = b.read;
      const allowed = new Set();
      const add = (v) => { if (typeof v === 'number' && Number.isFinite(v)) allowed.add(cents(v)); };
      for (const v of Object.values(r.facts || {})) add(v);
      for (const c of r.checks || []) { for (const s of [c.lhs, c.rhs]) (Array.isArray(s) ? s : [s]).forEach(add); }
      const printed = [text(l), l.second ?? '', ...(sh ? sh.groups.flatMap((g) => (g.rows || []).flatMap((x) => x.sides.map((s) => s[0]))) : []), sh?.lead ?? ''].join(' ').match(/\$\d[\d,]*\.\d{2}/g) || [];
      for (const p of printed) expect(allowed.has(p), `${k}: ${p}`).toBe(true);
    }
  });
  it('the 20-day prints the same string in the lead, the sheet\'s rows and mark 1', () => {
    const b = B.VALID_PULLBACK;
    const sma = cents(b.read.facts.SMA_fast);
    const l = readLineOf(b);
    const sh = sheetOf(b);
    expect(text(l)).toContain(sma);
    const rows = sh.groups.flatMap((g) => g.rows || []);
    for (const key of ['closeAboveFast', 'touch', 'pullbackClose']) expect(rows.find((x) => x.key === key).sides[1][0]).toBe(sma);
    expect(rows.find((x) => x.key === 'fastAboveSlow').sides[0][0]).toBe(sma);
    expect(cents(l.marks.find((m) => m.n === 1).value)).toBe(sma);
  });
  it('a half-cent value rounds half up from its decimal, never by the double\'s binary (141.105 → $141.11)', () => {
    const b = clone(B.VALID_PULLBACK);
    b.read.facts.SMA_fast = 141.105;
    expect(text(readLineOf(b))).toContain('($141.11)');
    expect((141.105).toFixed(2)).toBe('141.10'); // the trap avoided
  });
});

describe('the sheet (§6, CR-3, SH-1 – SH-5)', () => {
  it('valid · Pullback and Resume: the groups by purpose, their counts, the other pattern not present in quiet ink', () => {
    const sh = sheetOf(B.VALID_PULLBACK, { sector: { percentile: 73, updatedAtMs: Date.parse('2026-11-18T18:44:00Z') } });
    expect(sh.groups.map((g) => [g.key, g.title, g.count, g.sub ?? null])).toEqual([
      ['uptrend', 'The uptrend', '3 of 3', null],
      ['pullback_resume', 'Pullback and Resume', '2 of 2', null],
      ['stretch', 'The stretch guard', null, null],
      ['breakout', 'Trend Breakout', 'not present', 'the other pattern'],
    ]);
    const breakout = sh.groups.find((g) => g.key === 'breakout');
    expect(breakout.rows.map((x) => x.result)).toEqual(['quiet', 'quiet']); // never a failure
    expect(sh.context).toEqual({ title: 'Context, not part of the check', name: 'Sector rank', value: '73 of 100 within its sector · 20 sessions · 0 is weakest · read Wed 1:44 PM ET; may include today’s unfinished session', def: 'A 20-session rank within the sector. Optional context, not part of the rule.' });
    expect(sh.other).toEqual([
      { title: 'The other reading', text: 'A failed bounce in a weakening trend.' },
      { title: 'What separates them', text: 'The next close against that session’s own 20-day. That number doesn’t exist yet; mark 1 is Tue’s.' },
    ]);
    expect(sh.foot).toEqual(['Rule set tf-setup-v1 · built as Trend Follower’s setup check', 'daily · completed sessions · prices unadjusted · as of Tue Nov 17 close', 'Read from the stored record. Nothing is computed here; no message cost.']);
    expect(sh.hint).toBe('as of Tue Nov 17 close · tap a check to light its mark');
  });
  it('SH-1: each row — its name, both sides with their numbers, its definition, its marks (only those that exist)', () => {
    const sh = sheetOf(B.VALID_PULLBACK);
    const rows = Object.fromEntries(sh.groups.flatMap((g) => g.rows || []).map((x) => [x.key, x]));
    const r = B.VALID_PULLBACK.read;
    expect(rows.touch).toEqual({ key: 'touch', name: 'The touch', def: W.rows.touch.def, sides: [[cents(r.checks.find((c) => c.id === 'pullback_touch').lhs), 'lowest of three lows'], [cents(r.facts.SMA_fast), '20-day']], marks: [4, 1], result: 'pass' });
    expect(rows.slowRising.marks).toEqual([2, 3]);
    expect(rows.extension.marks).toEqual([7]);
    expect(rows.volumeFloor.marks).toEqual([]);
    expect(rows.breakoutClose.sides[1][1]).toBe('high · Nov 16');
    const noSlow = clone(B.VALID_PULLBACK);
    noSlow.read.facts.SMA_slow_5ago = null; // mark 3 then does not exist, so no row names it
    expect(sheetOf(noSlow).groups[0].rows.find((x) => x.key === 'slowRising').marks).toEqual([2]);
  });
  it('SH-3: when the uptrend fails the pattern groups collapse to one line; expanded, the record\'s checks are all there', () => {
    const sh = sheetOf(B.REGIME_A);
    expect(sh.groups.map((g) => g.key)).toEqual(['uptrend', 'patterns']);
    expect(sh.groups[1]).toEqual({ key: 'patterns', collapsed: true, line: 'Entry patterns are read only in an uptrend.', expand: 'Show the pattern checks' });
    expect(sh.groups[0].count).toBe('2 of 3');
    expect(sheetOf(B.REGIME_A, { expanded: true }).groups.map((g) => g.key)).toEqual(['uptrend', 'pullback_resume', 'stretch', 'breakout']);
  });
  it('valid · Trend Breakout: the pullback group is the other pattern, quiet when not satisfied', () => {
    const sh = sheetOf(B.VALID_BREAKOUT);
    expect(sh.groups.map((g) => [g.key, g.count, g.sub ?? null])).toEqual([['uptrend', '3 of 3', null], ['pullback_resume', 'not present', 'the other pattern'], ['stretch', null, null], ['breakout', '2 of 2', null]]);
  });
  it('the sector rank absent, or without its time → "no reading" (never a guess)', () => {
    expect(sheetOf(B.NO_SETUP).context.value).toBe('no reading');
    expect(sheetOf(B.NO_SETUP, { sector: { percentile: 40, updatedAtMs: null } }).context.value).toBe('no reading');
    expect(sheetOf(B.NO_SETUP, { sector: { percentile: null, updatedAtMs: 1 } }).context.value).toBe('no reading');
  });
  it('SH-5: every state the sheet opens in has its other reading and what separates them', () => {
    for (const k of ['VALID_PULLBACK', 'VALID_BREAKOUT', 'REGIME_A', 'NO_SETUP', 'EXTENDED']) {
      const sh = sheetOf(B[k]);
      expect(sh.other).toHaveLength(2);
      for (const o of sh.other) expect(o.text.length).toBeGreaterThan(10);
    }
    expect(Object.keys(W.other).sort()).toEqual([...SHEET_STATES].map((s) => (s === 'regime' ? 'regime' : s)).sort());
  });
});

describe('what changed (CR-6): the fixed table, row by row; every unlisted pair shows nothing', () => {
  const PREV = {};
  beforeAll(async () => {
    for (const [code, state] of Object.entries({ VP: 'VALID_PULLBACK', VB: 'VALID_BREAKOUT', RN: 'REGIME_A', RD: 'DOWNTREND', NS: 'NO_SETUP', EX: 'EXTENDED', UN: 'UNKNOWN_V', RF: 'SPLIT' })) {
      PREV[code] = await previousFor(state, { session: PREV_SESSION });
    }
  });
  const CUR = { VP: 'VALID_PULLBACK', VB: 'VALID_BREAKOUT', RN: 'REGIME_A', RD: 'DOWNTREND', NS: 'NO_SETUP', EX: 'EXTENDED', UN: 'UNKNOWN_V', RF: 'SPLIT' };
  // prev → cur: P newPullback · B newBreakout · S stretched · G patternGone · L leftUptrend · U backInUptrend · - none
  const MATRIX = {
    //     VP   VB   RN   RD   NS   EX   UN   RF
    VP: ['-', '-', 'L', 'L', 'G', 'S', '-', '-'],
    VB: ['-', '-', 'L', 'L', 'G', 'S', '-', '-'],
    RN: ['P', 'B', '-', '-', 'U', 'U', '-', '-'],
    RD: ['P', 'B', '-', '-', 'U', 'U', '-', '-'],
    NS: ['P', 'B', 'L', 'L', '-', '-', '-', '-'],
    EX: ['P', 'B', 'L', 'L', '-', '-', '-', '-'],
    UN: ['-', '-', '-', '-', '-', '-', '-', '-'],
    RF: ['-', '-', '-', '-', '-', '-', '-', '-'],
  };
  const LINES = { P: 'New since Mon: touched the 20-day and closed back above it.', B: 'New since Mon: closed at or above the 20-session high.', S: 'Since Mon: stretched past the limit.', G: 'Since Mon: the entry pattern is gone; still in an uptrend.', L: 'Since Mon: left the uptrend.', U: 'Since Mon: back in an uptrend.', '-': null };
  it('the 64 pairs', () => {
    const cols = Object.keys(CUR);
    for (const [p, row] of Object.entries(MATRIX)) {
      row.forEach((want, j) => {
        const cur = B[CUR[cols[j]]];
        expect(changeOf(cur.read, PREV[p]), `${p} → ${cols[j]}`).toBe(LINES[want]);
      });
    }
  });
  it('the order decides an overlap: not valid → valid · pullback beats not an uptrend → uptrend', () => {
    expect(CHANGE_TABLE[0].when(PREV.RN, B.VALID_PULLBACK.read)).toBe(true);
    expect(CHANGE_TABLE[5].when(PREV.RN, B.VALID_PULLBACK.read)).toBe(true);
    expect(changeOf(B.VALID_PULLBACK.read, PREV.RN)).toBe(LINES.P);
    expect(CHANGE_TABLE.map((r) => r.key)).toEqual(['newPullback', 'newBreakout', 'stretched', 'patternGone', 'leftUptrend', 'backInUptrend']);
  });
  it('no previous record → no chip; the read line carries the chip above the lead', () => {
    expect(changeOf(B.VALID_PULLBACK.read, null)).toBeNull();
    expect(readLineOf(B.VALID_PULLBACK).change).toBeNull();
    expect(readLineOf({ ...B.VALID_PULLBACK, previous: PREV.RN }).change).toBe(LINES.P);
  });
});

describe('honesty (RD-13): every output, every state', () => {
  const FORBIDDEN = [/\bwill\b/i, /\blikely\b/i, /\bshould\s+buy\b/i, /\blive\b/i];
  const STOP_PRICE = /\b(stop|target|stop-loss|stoploss)\b[^.]{0,20}\$\s?\d/i;
  it('the line, the change chip, the notes and the sheet', async () => {
    const prevs = await Promise.all(['VALID_PULLBACK', 'REGIME_A', 'NO_SETUP'].map((s) => previousFor(s, { session: PREV_SESSION })));
    const outs = [];
    for (const k of Object.keys(STATE_ROWS)) {
      for (const previous of [null, ...prevs]) {
        for (const battle of [false, true]) {
          const b = { ...B[k], previous };
          const l = readLineOf(b, { todayEt: '2026-11-18', todayIsSession: true, battle });
          outs.push(text(l), l.second ?? '', l.change ?? '', ...l.notes, l.asOf ?? '');
          for (const expanded of [false, true]) {
            const sh = sheetOf(b, { expanded, sector: { percentile: 12, updatedAtMs: Date.parse('2026-11-18T18:44:00Z') } });
            if (sh) outs.push(JSON.stringify(sh));
          }
        }
      }
    }
    expect(outs.length).toBeGreaterThan(200);
    for (const s of outs) {
      for (const re of FORBIDDEN) expect(re.test(s), s).toBe(false);
      expect(STOP_PRICE.test(s), s).toBe(false);
    }
  });
});
