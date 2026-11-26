// api/_utils/practiceField/bookView.test.js
//
// Practice Field build B3 — THE VIEW, on the scenes (__testsupport__/bookViewScenes.js: stored records in the shapes the
// close, the entry and the agent write, one scene per state of the design of record). Each row names the state it pins.
// The figures against a real run of the engine are bookView.e2e.test.js's; the endpoint's gates are
// api/practice-field/book.test.js's.

import { describe, it, expect } from 'vitest';
import {
  buildBookView, allotCents, moneyText, signedAmount, pctText, sessionsLeftOf, deriveToday, deriveSinceOpen, refusalReasonOf,
  packetCheck, dayLabel, weekdayLabel, NO_CENTS_FROM_CENTS,
} from './bookView.js';
import {
  FAILED_CHECK, BUYS_NEXT_WINDOW, SELLS_NEXT_WINDOW, PAUSED_LINE, WINDING_DOWN_LINE, REFUSAL_REASONS, REFUSAL_UNMAPPED,
  EVIDENCE_UNCHECKED, NO_FINISHED_IDEAS, MARKS_AS_OF, RESULT_COLUMNS,
} from './bookViewCopy.js';
import { toCents } from './money.js';
import { SCENE_NAMES, SCENE_BOOK_ID, SCENE_UID, SCENE_AGENT_ID } from './__testsupport__/bookViewScenes.js';
// B5: the scenes as the B5 reader gives them — the epoch, the archetype and the caller's agent, Atlas (B5-3's names).
import { hubSceneInput as sceneInput } from './__testsupport__/bookViewScenesHub.js';
import { BANNED_RESULT_WORDS } from './__testsupport__/fixtures.js';
import { sealAdjustment } from './evidence.js';

const view = (name) => buildBookView(sceneInput(name));
const group = (v, slot) => v.groups.find((g) => g.slot === slot);
const name = (g, sym) => g.names.find((n) => n.symbol === sym);
/** A displayed amount back to whole cents ('+$1,234.56' → 123456; '−$9.10' → −910). */
const cents = (text) => {
  const neg = text.startsWith('−');
  const n = Math.round(Number(text.replace(/[^0-9.]/g, '')) * 100);
  return neg ? -n : n;
};
/** Every string anywhere in a value. */
const strings = (v, out = []) => {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
};

describe('formatting: display strings only, whole cents in, the house signs out', () => {
  it('money: unsigned for values, signed with U+2212 for changes, an unsigned $0.00', () => {
    expect(moneyText(10041218)).toBe('$100,412.18');
    expect(moneyText(2255, { signed: true })).toBe('+$22.55');
    expect(moneyText(-38170, { signed: true })).toBe('−$381.70');
    expect(moneyText(0, { signed: true })).toBe('$0.00');
  });
  it('the 320 fit rule: $10,000 or more also comes without cents, smaller amounts keep them', () => {
    expect(signedAmount(NO_CENTS_FROM_CENTS)).toEqual({ text: '+$10,000.00', short: '+$10,000', dir: 1 });
    expect(signedAmount(-1248055)).toEqual({ text: '−$12,480.55', short: '−$12,481', dir: -1 });
    expect(signedAmount(NO_CENTS_FROM_CENTS - 1)).toEqual({ text: '+$9,999.99', short: '+$9,999.99', dir: 1 });
  });
  it('percent: two places, signed, and a zero that rounds to zero carries no sign', () => {
    expect(pctText(0.3412)).toBe('+0.34%');
    expect(pctText(-0.11)).toBe('−0.11%');
    expect(pctText(-0.004)).toBe('0.00%');
    expect(pctText(0.7, 1)).toBe('+0.7%');
  });
  it('dates: the calendar date itself, no clock', () => {
    expect(dayLabel('2026-11-27')).toBe('27 Nov');
    expect(weekdayLabel('2026-11-27')).toBe('Fri 27 Nov');
    expect(dayLabel(null)).toBeNull();
  });
});

describe('day n of N: the agent\'s own count of sessions left (agentRun.js sessionsLeft)', () => {
  it('the sessions after a close up to and including the due one; 0 at the due close', () => {
    expect(sessionsLeftOf('2026-11-30', '2026-11-30')).toBe(0);
    expect(sessionsLeftOf('2026-11-27', '2026-11-30')).toBe(1);
    // Thanksgiving (26 Nov) is not a session, and 27 Nov (an early close) is one.
    expect(sessionsLeftOf('2026-11-25', '2026-11-30')).toBe(2);
    // 25, 27, 30 Nov, 1, 2, 3, 4, 7, 8, 9 Dec: a short idea started on 24 Nov is due ten sessions later, on 9 Dec.
    expect(sessionsLeftOf('2026-11-24', '2026-12-09')).toBe(10);
  });
  it('a group says Day N − left of N, from the slot and the due session: the entry close is day 0, the due close day N', () => {
    expect(group(view('sample'), 'medium')).toMatchObject({ line: 'Day 4 of 30', day: 4, of: 30, sessionsLeft: 26, sessionsLeftText: '26 sessions left' });
    // Q-3 as agreed (B3-A08): the entry close reads "Entered today · N sessions"; its numeric day and N are unchanged.
    expect(group(view('newToday'), 'short')).toMatchObject({ line: 'Entered today · 10 sessions', day: 0, of: 10, sessionsLeft: 10 });
    expect(group(view('reviewDate'), 'short')).toMatchObject({ line: 'Day 10 of 10', sessionsLeft: 0 });
  });
});

describe('allotCents: each name\'s value at a row\'s marks sums EXACTLY to the row\'s stored holdings value (BUILD_RULES §9)', () => {
  it('on every scene row: the parts sum to markedHoldingsValue to the cent', () => {
    for (const n of SCENE_NAMES) {
      for (const [, rows] of sceneInput(n).rows) {
        for (const row of [rows.last, rows.prev].filter(Boolean)) {
          const parts = [...allotCents(row).values()].reduce((a, b) => a + b, 0);
          expect(parts, `${n} ${row.date}`).toBe(toCents(row.markedHoldingsValue));
        }
      }
    }
  });
  it('the leftover cents go to the largest remainders, ties by symbol', () => {
    // Three names of $1.005 each: raw $3.015, stored $3.02 (rounded once) — floors 100 each, two cents left.
    const row = { markedHoldingsValue: 3.02, quantities: { A: 1, B: 1, C: 1 }, marks: { A: { mark: 1.005 }, B: { mark: 1.005 }, C: { mark: 1.005 } } };
    expect(Object.fromEntries(allotCents(row))).toEqual({ A: 101, B: 101, C: 100 });
    // Unequal remainders (A .9, B .2, C .6 of a cent): one cent left goes to A, the largest, never to the smallest.
    const unequal = { markedHoldingsValue: 3.02, quantities: { A: 1, B: 1, C: 1 }, marks: { A: { mark: 1.009 }, B: { mark: 1.002 }, C: { mark: 1.006 } } };
    expect(Object.fromEntries(allotCents(unequal))).toEqual({ A: 101, B: 100, C: 101 });
    // Floors, never rounds (the refuter's case): two names of 100.6¢ against a 201¢ total give A 101, B 100.
    const tie = { markedHoldingsValue: 2.01, quantities: { A: 1, B: 1 }, marks: { A: { mark: 1.006 }, B: { mark: 1.006 } } };
    expect(Object.fromEntries(allotCents(tie))).toEqual({ A: 101, B: 100 });
  });
});

describe('the book line (B3 §1): stored figures, and the two derived ones against the rows', () => {
  it('value and cash are the last close\'s row; today\'s change is that equity less the close before, in cents', () => {
    const input = sceneInput('sample');
    const v = buildBookView(input);
    const { last, prev } = input.dailyRows;
    expect(cents(v.line.value)).toBe(toCents(last.markedEquity));
    expect(cents(v.line.cash)).toBe(toCents(last.treasuryCash) + toCents(last.reservedCash));
    expect(v.cash).toBe(v.line.cash);
    expect(cents(v.line.today.text)).toBe(toCents(last.markedEquity) - toCents(prev.markedEquity));
    expect(v.line.today.pct).toBe(pctText(((toCents(last.markedEquity) - toCents(prev.markedEquity)) * 100) / toCents(prev.markedEquity)));
  });
  it('since open is the equity against the book\'s opening value, labelled with its first entry session', () => {
    const input = sceneInput('sample');
    const v = buildBookView(input);
    expect(v.line.first).toEqual({ kind: 'since', label: 'Since 20 Nov', ...(() => { const s = deriveSinceOpen(input.dailyRows.last, 100_000); return { value: s.pct, dir: s.dir }; })() });
  });
  it('B3-6: SPY since open is SPY\'s quote at the book\'s first fill (its inception row) to its vendor-timed close at the last close', () => {
    const input = sceneInput('sample');
    const start = input.firstEntry.inception.legs.spy[0].mark;
    const now = input.rows.get('i_energy').last.spyMarks.SPY.mark;
    expect(view('sample').line.spy).toEqual({ label: 'SPY', value: pctText(((now - start) * 100) / start), since: '20 Nov' });
    // no first entry: a dash, never a guess
    expect(buildBookView({ ...input, firstEntry: null }).line.spy).toEqual({ label: 'SPY', value: '—' });
  });
  it('B3-6: SPY takes the first CLEAN close mark there is, and none that is carried; a start quote with no vendor time is no start', () => {
    const one = sceneInput('sample');
    one.rows.get('i_energy').last.spyMarks.SPY = { mark: 1, quality: 'carried_forward' };
    const now = one.rows.get('i_banks').last.spyMarks.SPY.mark;
    expect(buildBookView(one).line.spy.value).toBe(pctText(((now - 590) * 100) / 590));
    for (const id of ['i_energy', 'i_banks']) one.rows.get(id).last.spyMarks.SPY = { mark: 1, quality: 'carried_forward' };
    expect(buildBookView(one).line.spy).toEqual({ label: 'SPY', value: '—' });
    const two = sceneInput('sample');
    two.firstEntry.inception.legs.spy[0].markVendorTimeIso = null;
    expect(buildBookView(two).line.spy).toEqual({ label: 'SPY', value: '—' });
  });
  it('a percent that rounds to zero has no sign and no colour (review B note)', () => {
    const input = sceneInput('sample');
    input.dailyRows.last.markedEquity = 99_999.99; // −$0.01 against $100,000
    expect(buildBookView(input).line.first).toMatchObject({ value: '0.00%', dir: 0 });
  });
  it('since open waits too when the last close is below full quality (review B4)', () => {
    expect(view('waiting').line.first).toMatchObject({ kind: 'since', value: '—', dir: 0 });
  });
  it('a row below full quality on either side shows no change: Waiting on data', () => {
    expect(deriveToday({ markedEquity: 1, fullQuality: false }, { markedEquity: 1, fullQuality: true })).toEqual({ waiting: 'Waiting on data' });
    // The close BEFORE below full quality, the last one clean: today's change waits; the headline shows (B3-11 is the last's).
    const prevHeld = sceneInput('sample');
    prevHeld.dailyRows.prev.fullQuality = false;
    expect(buildBookView(prevHeld).line).toMatchObject({ today: { waiting: 'Waiting on data' }, waiting: null, value: moneyText(toCents(prevHeld.dailyRows.last.markedEquity)) });
    // The LAST below full quality: the whole line waits instead (B3-11; its own rows below).
    expect(view('waiting').line.today).toBeNull();
  });
});

describe('the states (the design of record\'s ten, and the ones it does not draw)', () => {
  it('the sample day: two ideas, the long slot open — the desk looks tonight — and the timestamp', () => {
    const v = view('sample');
    expect(v.day).toBe('Fri 27 Nov');
    expect(v.groups.map((g) => [g.slot, g.state])).toEqual([['short', 'holding'], ['medium', 'holding'], ['long', 'open']]);
    expect(group(v, 'long').text).toBe('Long · open · Atlas’s desk looks tonight.');
    expect(v.asOf).toEqual({ session: '27 Nov', text: MARKS_AS_OF('27 Nov') });
    expect(group(v, 'medium')).toMatchObject({ desk: 'shadow', deskName: 'Atlas’s desk', source: 'Entered by the founder', gap: { vs: 'XLF', text: '+$84.20', pct: '+0.34%', spy: { text: '+$31.05' } } });
    expect(group(v, 'short').gap).toMatchObject({ vs: 'XLE', text: '−$22.40', dir: -1 });
  });

  it('1 · a full book: three ideas, eight names, each with its desk', () => {
    const v = view('full');
    expect(v.groups.map((g) => [g.slot, g.state, g.desk, g.names.length])).toEqual([['short', 'holding', 'archetype', 2], ['medium', 'holding', 'shadow', 3], ['long', 'holding', 'shadow', 3]]);
    expect(v.strip.map((s) => [s.deskName, s.text])).toEqual([['Trend Follower’s desk', 'held 2'], ['Atlas’s desk', 'held 6']]);
  });

  it('2 · a new book: the entering idea\'s names carry the buy sentence; the line opens on its start session', () => {
    const v = view('newBook');
    const g = group(v, 'medium');
    expect(g).toMatchObject({ state: 'entering', line: 'Entering', gap: null, call: null, namesText: 'JPM · BAC · GS' });
    expect(g.names.every((n) => n.state === 'entering' && n.text === BUYS_NEXT_WINDOW && n.plOpen === undefined)).toBe(true);
    expect(v.line).toMatchObject({ value: '$100,000.00', today: null, first: { kind: 'opens', label: 'Opens', value: '23 Nov' }, spy: { value: '—' }, cash: '$100,000.00' });
    expect(v.asOf).toBeNull();
    expect(v.strip).toEqual([{ desk: 'shadow', deskName: 'Atlas’s desk', failed: false, text: 'admitted JPM, BAC, GS' }]);
    expect([group(v, 'short').state, group(v, 'long').state]).toEqual(['open', 'open']);
  });

  it('3 · new today: the NEW tag on the names bought at this session\'s window, and the strip names them', () => {
    const v = view('newToday');
    expect(group(v, 'short').names.map((n) => [n.symbol, n.isNew])).toEqual([['XOM', true], ['CVX', true]]);
    expect(group(v, 'medium').names.every((n) => n.isNew === false)).toBe(true);
    expect(v.strip.map((s) => s.text)).toEqual(['opened XOM, CVX', 'held 3']);
    // a name bought today: its day P/L is against what it cost, so it equals its open P/L
    const xom = name(group(v, 'short'), 'XOM');
    expect(xom.plDay).toEqual(xom.plOpen);
  });

  it('4 · near a line: the distance, and `near` (under 1%) — weight, never a colour of its own', () => {
    const xom = name(group(view('nearLine'), 'short'), 'XOM');
    expect(xom.distance).toMatchObject({ text: '0.7% away', near: true });
    expect(name(group(view('nearLine'), 'short'), 'CVX').distance.near).toBe(false);
  });

  it('5 · a line hit: the name stays in its group, dated, with no figure; the strip says code sold it', () => {
    const v = view('lineHit');
    const xom = name(group(v, 'short'), 'XOM');
    expect(xom).toMatchObject({ state: 'sold_line', text: 'Sold at its line by code · 27 Nov', mark: null });
    expect(xom.plOpen).toBeUndefined();
    expect(v.strip[0].text).toBe('held 1 · XOM sold at its line by code');
  });

  it('5b · a line recognised at the close: figures kept, and the queued sale said (not drawn by the mock-up)', () => {
    const xom = name(group(view('lineRecognised'), 'short'), 'XOM');
    expect(xom).toMatchObject({ state: 'line_hit', text: 'Below its line · code sells at the next session’s first window' });
    expect(xom.plOpen).toBeDefined();
  });

  it('6 · an exit called: the header reads Exit · sells at the next session\'s first window; the call is the desk\'s', () => {
    const v = view('exitCalled');
    const g = group(v, 'short');
    expect(g).toMatchObject({ state: 'selling', selling: { word: 'Exit', rest: SELLS_NEXT_WINDOW }, call: { kind: 'Exit', deskName: 'Trend Follower’s desk', date: '27 Nov' } });
    expect(v.strip[0].text).toBe('called Exit on XOM, CVX');
    // …and an idea settled at its review date reads Review date (not drawn by the mock-up)
    expect(group(view('reviewDate'), 'short').selling).toEqual({ word: 'Review date', rest: SELLS_NEXT_WINDOW });
  });

  it('7 · waiting on data: the name shows no P/L and one plain reason; its idea shows no gap', () => {
    const v = view('waiting');
    const bac = name(group(v, 'medium'), 'BAC');
    expect(bac).toMatchObject({ state: 'waiting', text: 'Waiting on data', waitingReason: 'BAC has no closing price for 27 Nov yet.', mark: null });
    expect(bac.plOpen).toBeUndefined();
    expect(bac.plDay).toBeUndefined();
    expect(group(v, 'medium').gap).toEqual({ waiting: 'BAC has no closing price for 27 Nov yet.' });
    expect(name(group(v, 'medium'), 'JPM').state).toBe('held');
  });

  it('8 · a failed check: the strip and the call carry the failed-check sentence; the positions are unchanged', () => {
    const v = view('failed');
    // (B5-3, review B1: the failed-check line by its desk's name — in the strip, after the name, its verb alone.)
    expect(v.strip[0]).toEqual({ desk: 'archetype', deskName: 'Trend Follower’s desk', failed: true, text: FAILED_CHECK.strip });
    expect(v.strip[0].text).toBe("could not complete today's check; nothing changed.");
    expect(group(v, 'short').call).toEqual({ failed: true, text: "Trend Follower’s desk could not complete today's check; nothing changed.", deskName: 'Trend Follower’s desk' });
    expect(group(v, 'short').names.map((n) => n.state)).toEqual(['held', 'held']);
    expect(v.desks.find((d) => d.desk === 'archetype').note).toEqual({ failed: true, text: FAILED_CHECK.sentence('Trend Follower’s desk'), date: '27 Nov' });
  });

  it('9 · paused: the line says so, the strip is empty, no call, and an open slot does not say a desk looks', () => {
    const v = view('paused');
    expect(v.line).toMatchObject({ paused: true, statusLine: PAUSED_LINE });
    expect(v.strip).toEqual([]);
    expect(v.groups.filter((g) => g.state === 'holding').every((g) => g.call === null)).toBe(true);
    expect(group(v, 'long').text).toBe('Long · open');
  });

  it('winding down: its own line, and no desk looks (not drawn by the mock-up)', () => {
    const v = view('windingDown');
    expect(v.line).toMatchObject({ windingDown: true, statusLine: WINDING_DOWN_LINE });
    expect(group(v, 'long').text).toBe('Long · open');
  });

  it('the agent switch off (production today): no strip, no notes, no calls, and nobody looks tonight', () => {
    const v = view('agentOff');
    expect(v.strip).toEqual([]);
    expect(group(v, 'long').text).toBe('Long · open');
    expect(v.desks.map((d) => d.note)).toEqual([null, null]);
    expect(v.desks.flatMap((d) => d.calls).filter((c) => c.state === 'open').map((c) => c.text)).toEqual(['Open.']);
  });

  it('bought at a window after the last close: held, no figure until tonight\'s close (not drawn by the mock-up)', () => {
    const g = group(view('boughtToday'), 'short');
    expect(g).toMatchObject({ state: 'holding', line: 'Bought today', gap: null });
    expect(g.names.map((n) => n.state)).toEqual(['bought_today', 'bought_today']);
  });

  it('B3-10 (review B3-A07): with the agent off, a close row that holds desk records still shows them — what the last close recorded; only "looks tonight" follows the switch', () => {
    // The agent switch off NOW, the last close's row holding both desks' records (switched off after a recorded check).
    const input = { ...sceneInput('sample'), agentOn: false };
    expect(input.closeRow.agent.desks.shadow.source).toBe('model');
    const v = buildBookView(input);
    expect(v.strip.map((s) => s.desk)).toEqual(['archetype', 'shadow']);
    expect(v.strip.find((s) => s.desk === 'shadow').text).toBe('held 3 · passed on 3 drafts');
    expect(group(v, 'medium').call).toMatchObject({ kind: 'Hold', deskName: 'Atlas’s desk' });
    expect(v.desks.find((d) => d.desk === 'shadow').note).toMatchObject({ failed: false, text: expect.any(String) });
    // The forward-looking line follows the switch: no desk looks tonight.
    expect(group(v, 'long').text).toBe('Long · open');
    expect(v.desks.flatMap((d) => d.calls).filter((c) => c.state === 'open').map((c) => c.text)).toEqual(['Open.']);
    // With the agent off, a later close records no desk work: its row has none, and the page is empty of it.
    const later = { ...sceneInput('sample'), agentOn: false };
    const idle = { status: 'done', source: 'no_work', note: null, stoppedBy: 'agent_off', actions: [], considered: [] };
    later.closeRow = { ...later.closeRow, agent: { version: 1, desks: { archetype: idle, shadow: idle } } };
    const w = buildBookView(later);
    expect(w.strip).toEqual([]);
    expect(group(w, 'medium').call).toBeNull();
    expect(w.desks.map((d) => d.note)).toEqual([null, null]);
  });

  it('a session nobody observed: every name waits on data, and the timestamp says the marks are carried', () => {
    const v = view('unobserved');
    expect(v.asOf.text).toBe('No close was recorded for 27 Nov; marks are carried from the last one.');
    expect(v.groups.flatMap((g) => g.names).filter((n) => n.state !== undefined && n.state !== 'waiting')).toEqual([]);
  });

  it('10 · an expanded name carries its line track, shares and position value (B3-4); an expanded idea its gaps, days and call', () => {
    const g = group(view('sample'), 'medium');
    const jpm = name(g, 'JPM');
    expect(jpm).toMatchObject({ mark: '304.85', entry: '301.20', line: '271.08', shares: '27', distance: { text: '11.1% away', near: false } });
    expect(jpm.positionValue).toBe(moneyText(toCents(27 * 304.85)));
    // (B3-12: the banks thesis is the founder's — signed so — while the Shadow desk manages the idea and makes its call.)
    expect(g).toMatchObject({ desk: 'shadow', deskName: 'Atlas’s desk', thesis: { byline: 'The founder' }, call: { kind: 'Hold', deskName: 'Atlas’s desk', date: '27 Nov' }, sessionsLeftText: '26 sessions left' });
  });

  it('the fit test: four names, NEW on a five-letter symbol, five-figure amounts with a no-cents form, the long reason whole', () => {
    const g = group(view('fit'), 'long');
    expect(g.names.map((n) => n.symbol)).toEqual(['GOOGL', 'UNH', 'ELV', 'HUM']);
    expect(name(g, 'GOOGL').isNew).toBe(true);
    const big = g.names.flatMap((n) => [n.plOpen, n.plDay]).filter((a) => a && Math.abs(cents(a.text)) >= NO_CENTS_FROM_CENTS);
    expect(big.length).toBeGreaterThan(0);
    for (const a of big) expect(a.short).toMatch(/^[+−]\$[\d,]+$/);
    expect(g.gap.vs).toBe('holding the same stocks');
    expect(g.call.text).toHaveLength(278);
  });

  it('settled today: the finished idea holds its slot until the next close, its names sold, its stored gap shown', () => {
    const g = group(view('settledToday'), 'long');
    expect(g).toMatchObject({ state: 'settled_today', line: 'Settled today', gap: { text: '−$41.30', vs: 'XLV' } });
    expect(g.names.map((n) => n.text)).toEqual(['Sold at the settlement · 27 Nov', 'Sold at the settlement · 27 Nov', 'Sold at the settlement · 27 Nov']);
  });
});

describe('the figures of every scene agree with its stored rows to the cent', () => {
  it('each held name: value = its allotment, open P/L = value − cost basis, day P/L = value − the close before', () => {
    for (const n of SCENE_NAMES) {
      const input = sceneInput(n);
      const v = buildBookView(input);
      for (const idea of input.ideas) {
        const rows = input.rows.get(idea.ideaId);
        const g = v.groups.find((x) => x.slot === idea.contract.slot);
        if (!rows?.last || !g) continue;
        const now = allotCents(rows.last);
        const before = allotCents(rows.prev);
        for (const nm of g.names.filter((x) => x.state === 'held' || x.state === 'line_hit')) {
          const h = idea.ledger.holdings[nm.symbol];
          expect(cents(nm.positionValue), `${n} ${nm.symbol}`).toBe(now.get(nm.symbol));
          expect(cents(nm.plOpen.text), `${n} ${nm.symbol} open`).toBe(now.get(nm.symbol) - toCents(h.costBasisTotal));
          const base = idea.entry.sessionDate === rows.last.date ? toCents(h.costBasisTotal) : before.get(nm.symbol);
          expect(cents(nm.plDay.text), `${n} ${nm.symbol} day`).toBe(now.get(nm.symbol) - base);
        }
        if (g.gap && !g.gap.waiting) expect(cents(g.gap.text), `${n} gap`).toBe(toCents(rows.last.markedGapUsd));
      }
    }
  });
});

describe('the strip (B3 §1): the close row\'s agent block, and code\'s own facts of that session', () => {
  it('both desks; one desk with no work has no line', () => {
    expect(view('sample').strip.map((s) => s.deskName)).toEqual(['Trend Follower’s desk', 'Atlas’s desk']);
    const input = sceneInput('sample');
    input.closeRow.agent.desks.archetype = { status: 'done', source: 'no_work', note: null, actions: [], considered: [] };
    expect(buildBookView(input).strip.map((s) => s.deskName)).toEqual(['Atlas’s desk']);
  });
});

describe('the Desks tab: each desk\'s note, its calls, and the drafts it passed on with a plain reason (B3-5)', () => {
  it('the day an idea was admitted: note, the entering call, three drafts with all three outcomes', () => {
    const arch = view('desksAdmit').desks.find((d) => d.desk === 'archetype');
    expect(arch).toMatchObject({ deskName: 'Trend Follower’s desk', lane: 'Trend Follower · Short', note: { failed: false, date: '24 Nov' } });
    expect(arch.calls).toEqual([{ slot: 'short', slotName: 'Short', namesText: 'XOM · CVX', state: 'entering', text: BUYS_NEXT_WINDOW }]);
    expect(arch.passed.tally).toBe('3 drafts · 1 admitted · 1 not chosen · 1 refused');
    expect(arch.passed.drafts.map((d) => [d.names, d.outcome, d.why])).toEqual([
      ['XOM · CVX', 'Admitted', null], ['NVDA · AMD', 'Not chosen', null], ['ZIM', 'Refused', 'the name is not on the price list'],
    ]);
  });
  it('the Shadow desk\'s refusals in plain words; an open slot names who looks', () => {
    const sh = view('sample').desks.find((d) => d.desk === 'shadow');
    expect(sh.passed.drafts.map((d) => d.why)).toEqual(['it overlaps a stock the book already holds', 'its line was outside the allowed range', 'its line was outside the allowed range']);
    expect(sh.calls.find((c) => c.slot === 'long')).toMatchObject({ state: 'open', text: 'Open. Atlas’s desk looks for an idea at tonight’s close.' });
  });
});

describe('B3-5: every refusal code in the map reads its sentence; an unmapped one reads "not admitted"', () => {
  it('each mapped code', () => {
    for (const [code, sentence] of Object.entries(REFUSAL_REASONS)) expect(refusalReasonOf([{ code }]), code).toBe(sentence);
  });
  it('an unmapped code, and none at all', () => {
    expect(refusalReasonOf([{ code: 'a_code_nobody_wrote' }])).toBe(REFUSAL_UNMAPPED);
    expect(REFUSAL_UNMAPPED).toBe('not admitted');
    expect(refusalReasonOf([])).toBe(REFUSAL_UNMAPPED);
  });
  it('several codes: each distinct sentence once, in order', () => {
    expect(refusalReasonOf([{ code: 'name_not_a_candidate' }, { code: 'name_not_in_universe' }, { code: 'line_distance_out_of_band' }]))
      .toBe('the name is not on the price list; its line was outside the allowed range');
  });
});

describe('History: finished ideas, newest first, their endings, their gaps and the five columns as stored (B3-3)', () => {
  const items = () => view('history').history.items;
  it('all four endings, newest first', () => {
    expect(items().map((i) => [i.namesText, i.ended, i.endedOn])).toEqual([
      ['NVDA · AVGO', 'Ran its 10 sessions', '16 Dec'],
      ['KO · PEP · PG', 'Settled early by the manager', '8 Dec'],
      ['XOM · CVX', 'Ran its 10 sessions', '1 Dec'],
      ['SLB', 'Ended early: nothing was left to hold', '19 Nov'],
      ['OXY', 'Ended after its review date', '13 Nov'],
      ['DVN', 'Finished', '6 Nov'],
    ]);
  });
  it('a not-measurable result reads so, with its reasons, and no gap — not in the list, not under its Result column (review B1)', () => {
    expect(items()[0]).toMatchObject({ gap: null, notMeasurable: { reasons: ['One of its names had no usable closing price on its last day.'] } });
    expect(items()[4].notMeasurable.reasons).toEqual(['It was valued after its review date.']);
    for (const i of [0, 4]) expect(items()[i].columns[1]).toEqual({ key: 'economicResult', label: 'Result', value: 'Not measurable', sub: null, dir: 0 });
  });
  it('a validly sealed packet that is another idea\'s is refused (review A2)', () => {
    const input = sceneInput('history');
    const other = input.finished.find((f) => f.idea.ideaId === 'f_kopep');
    input.finished = input.finished.map((f) => (f.idea.ideaId === 'f_energy' ? { ...f, packet: other.packet } : f));
    const v = buildBookView(input).history.items.find((i) => i.namesText === 'XOM · CVX');
    expect(v).toMatchObject({ gap: null, columns: null, notMeasurable: { reasons: [EVIDENCE_UNCHECKED] } });
  });
  it('the five columns: the stored values in plain words, the gap beside the result', () => {
    const sh = items()[1];
    expect(sh.columns.map((c) => [c.label, c.value])).toEqual([['Lines', 'Held'], ['Result', 'Ahead'], ['Process', 'Followed the plan'], ['Evidence', 'One run'], ['Adoption', 'No offer']]);
    expect(sh.columns[1]).toMatchObject({ sub: '+$12.40 · +0.05%', dir: 1 });
    expect(items()[3].columns[0]).toEqual({ key: 'contractCondition', label: 'Lines', value: 'Line hit', sub: 'SLB', dir: 0 });
    expect(Object.keys(RESULT_COLUMNS)).toEqual(['contractCondition', 'economicResult', 'processQuality', 'evidenceScope', 'adoption']);
  });
  it('a result whose packet does not check (B2 §8: hash and parts) shows none of it', () => {
    expect(items()[5]).toMatchObject({ gap: null, columns: null, notMeasurable: { reasons: [EVIDENCE_UNCHECKED] } });
    expect(packetCheck(null, {})).toEqual({ ok: false, problems: ['packet:missing'] });
  });
  it('no finished ideas: the empty sentence', () => {
    expect(view('sample').history).toEqual({ empty: NO_FINISHED_IDEAS, items: [] });
  });
  it('the manager\'s exit reason is the last call', () => {
    expect(items()[1].lastCall).toMatchObject({ kind: 'Exit', deskName: 'Atlas’s desk', date: '7 Dec' });
  });
});

describe('the review\'s fixes, each pinned', () => {
  it('B2: a close before that carried its mark (or was not observed) gives no day P/L — it would span two sessions', () => {
    const carried = sceneInput('sample');
    carried.rows.get('i_banks').prev.marks.BAC.quality = 'carried_forward';
    const bac = name(group(buildBookView(carried), 'medium'), 'BAC');
    expect(bac.plDay).toBeNull();
    expect(bac.plOpen).toBeDefined();
    expect(name(group(buildBookView(carried), 'medium'), 'JPM').plDay).not.toBeNull();
    const unobserved = sceneInput('sample');
    unobserved.rows.get('i_banks').prev.observed = false;
    expect(group(buildBookView(unobserved), 'medium').names.map((n) => n.plDay)).toEqual([null, null, null]);
  });
  it('B3: nothing is credited to a desk that did not check the book — agent off, no close row, or no work', () => {
    const off = sceneInput('newToday');
    off.closeRow = null;
    off.agentOn = false;
    expect(buildBookView(off).strip).toEqual([]);
    const sold = sceneInput('lineHit');
    sold.closeRow = null;
    expect(buildBookView(sold).strip).toEqual([]);
    const paused = sceneInput('paused');
    paused.ideas.find((i) => i.ideaId === 'i_energy').entry.sessionDate = '2026-11-27';
    expect(buildBookView(paused).strip).toEqual([]);
  });
  it('B3: a founder\'s idea bought today is never "opened" by a desk; a desk\'s own draft is', () => {
    const founder = sceneInput('sample');
    founder.ideas.find((i) => i.ideaId === 'i_banks').entry.sessionDate = '2026-11-27';
    const v = buildBookView(founder);
    expect(v.strip.find((s) => s.desk === 'shadow').text).not.toMatch(/opened/);
    expect(view('newToday').strip[0].text).toBe('opened XOM, CVX');
  });
  it('B5: an Exit code did not carry out is said so; B3-A11: in the strip it is an Exit not carried out, never "held"', () => {
    for (const outcome of ['refused:close_row_unusable', 'ignored_already_selling', 'ignored_not_entered']) {
      const input = sceneInput('sample');
      input.closeRow.agent.desks.archetype.actions = [{ ideaId: 'i_energy', action: 'exit', reason: 'Energy stopped leading.', outcome }];
      const v = buildBookView(input);
      const g = group(v, 'short');
      expect(g.state, outcome).toBe('holding');
      expect(g.call, outcome).toMatchObject({ kind: 'Exit', notCarriedOut: expect.any(String) });
      // The names are said once, as not carried out, and are not counted as held.
      expect(v.strip[0].text, outcome).toBe('called Exit on XOM, CVX (not carried out)');
    }
    // Beside a hold of another idea: each counted once, in its own part.
    const both = sceneInput('sample');
    both.closeRow.agent.desks.shadow.actions = [{ ideaId: 'i_banks', action: 'exit', reason: 'Banks stopped leading.', outcome: 'refused:close_row_unusable' }];
    expect(buildBookView(both).strip.find((s) => s.desk === 'shadow').text).toBe('called Exit on JPM, BAC, GS (not carried out) · passed on 3 drafts');
    // An Exit on an idea with no name held at the close (not bought yet) names nothing: no part, and no "held".
    const entering = sceneInput('newBook');
    entering.closeRow.agent.desks.shadow.actions = [{ ideaId: 'i_banks', action: 'exit', reason: 'Not yet.', outcome: 'ignored_not_entered' }];
    expect(buildBookView(entering).strip.map((s) => s.text).join(' | ')).not.toMatch(/held|not carried out/);
    expect(group(view('exitCalled'), 'short').call.notCarriedOut).toBeUndefined();
  });
  it('B6: a holding a delisting left waiting says so, not "no closing price"', () => {
    const input = sceneInput('sample');
    const energy = input.ideas.find((i) => i.ideaId === 'i_energy');
    energy.ledger.holdings.XOM.exitPending = { reason: 'delisting', session: '2026-11-27' };
    input.rows.get('i_energy').last.marks.XOM.quality = 'carried_forward';
    expect(name(group(buildBookView(input), 'short'), 'XOM')).toMatchObject({ state: 'delisted', text: 'Delisted · code sells it when a price comes', mark: null });
  });
  it('B8: names bought at a window after the last close carry the NEW tag', () => {
    expect(group(view('boughtToday'), 'short').names.map((n) => [n.symbol, n.isNew])).toEqual([['XOM', true], ['CVX', true]]);
  });
  it('B9: on the session a ticker change renamed a name, its day P/L is against the close before under its old symbol', () => {
    const input = sceneInput('sample');
    const banks = input.ideas.find((i) => i.ideaId === 'i_banks');
    const rows = input.rows.get('i_banks');
    banks.ledger.holdings.GSX = banks.ledger.holdings.GS;
    delete banks.ledger.holdings.GS;
    banks.lines = banks.lines.map((l) => (l.symbol === 'GS' ? { ...l, symbol: 'GSX', renamedFrom: [{ symbol: 'GS', actionId: 'tc', appliedOn: '2026-11-27' }] } : l));
    for (const f of ['quantities', 'marks']) { rows.last[f].GSX = rows.last[f].GS; delete rows.last[f].GS; }
    const gsx = name(group(buildBookView(input), 'medium'), 'GSX');
    expect(gsx.plDay).toEqual(name(group(view('sample'), 'medium'), 'GS').plDay);
  });
  it('C5: a sold name keeps its entry; C6: a name below its line says how far below', () => {
    expect(name(group(view('lineHit'), 'short'), 'XOM')).toMatchObject({ entry: '118.30', line: '112.39' });
    expect(name(group(view('lineRecognised'), 'short'), 'XOM').distance.text).toBe('0.3% below its line');
  });
  it('C4: a settled-today group carries the manager\'s exit as a past call, never today\'s', () => {
    const g = group(view('settledToday'), 'long');
    expect(g.call).toBeNull();
    expect(g.lastCall).toMatchObject({ kind: 'Exit', date: '25 Nov' });
    expect(g.names[0]).toMatchObject({ entry: expect.any(String), line: expect.any(String) });
  });
});

describe('the battery\'s survivors, pinned', () => {
  it('allotCents takes a cent back when a stored total is below the floors (the defensive branch)', () => {
    const row = { markedHoldingsValue: 1.99, quantities: { A: 1, B: 1 }, marks: { A: { mark: 1.009 }, B: { mark: 1.009 } } };
    const parts = allotCents(row);
    expect([...parts.values()].reduce((a, b) => a + b, 0)).toBe(199);
  });
  it('near a line is under 1% exactly: 1.5% away is not near', () => {
    const input = sceneInput('sample');
    input.rows.get('i_energy').last.marks.XOM.mark = 114.10; // line 112.39: (114.10 − 112.39) / 114.10 = 1.5%
    const xom = name(group(buildBookView(input), 'short'), 'XOM');
    expect(xom.distance).toMatchObject({ text: '1.5% away', near: false });
  });
  it('a draft that waits is not "passed on"', () => {
    const input = sceneInput('sample');
    input.closeRow.agent.desks.shadow.considered = [{ index: 0, slot: 'long', names: ['MSFT'], thesis: 't', outcome: 'waiting', refusals: [{ code: 'close_owed' }] }];
    expect(buildBookView(input).strip.find((s) => s.desk === 'shadow').text).toBe('held 3');
  });
  it('a packet\'s receipt parts are checked: a recorded part missing or altered fails the packet; a whole set passes', () => {
    const part = sealAdjustment({ packetVersion: 1, packetId: 'result_actions_001', bookId: 'b1', ideaId: 'i1', part: 1, of: 1, receipts: [{ ledger: 'idea', actionId: 'a1' }] });
    const packet = sealAdjustment({ packetVersion: 1, packetId: 'result', bookId: 'b1', ideaId: 'i1', result: { endpointKind: 'due_session' }, corporateActions: { receipts: 1, byLedger: {}, parts: [{ id: 'result_actions_001', receipts: 1, contentHash: part.contentHash }] } });
    const ids = { bookId: 'b1', ideaId: 'i1' };
    expect(packetCheck(packet, { result_actions_001: part }, ids)).toEqual({ ok: true, problems: [] });
    expect(packetCheck(packet, {}, ids).problems).toContain('part:result_actions_001:missing');
    expect(packetCheck(packet, { result_actions_001: { ...part, receipts: [] } }, ids).ok).toBe(false);
    expect(packetCheck(packet, { result_actions_001: { ...part, ideaId: 'other' } }, ids).ok).toBe(false);
  });
});

describe('what the view never carries', () => {
  it('no id of the owner, the book, the agent or an idea, in any string of any scene', () => {
    for (const n of SCENE_NAMES) {
      const input = sceneInput(n);
      const ids = [SCENE_UID, SCENE_BOOK_ID, SCENE_AGENT_ID, ...input.ideas.map((i) => i.ideaId), ...input.finished.map((f) => f.idea.ideaId)];
      for (const s of strings(buildBookView(input))) for (const id of ids) expect(s.includes(id), `${n}: ${s}`).toBe(false);
    }
  });
  it('none of the words validated, proven or supported (contract §4.4)', () => {
    for (const n of SCENE_NAMES) expect(JSON.stringify(buildBookView(sceneInput(n))), n).not.toMatch(BANNED_RESULT_WORDS);
  });
  it('agent and player text passes through as the plain string it was stored as', () => {
    const input = sceneInput('sample');
    input.closeRow.agent.desks.shadow.note = '<img src=x onerror=alert(1)> & "quoted"';
    expect(buildBookView(input).desks.find((d) => d.desk === 'shadow').note.text).toBe('<img src=x onerror=alert(1)> & "quoted"');
  });
});
