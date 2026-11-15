// Battle Research Slice 1 — §4, the reading states: every row of the table and every stale cause at
// its boundary, the median (valid regular-session stock quotes only, three at least), and the
// move availability the calendar decides (BRS-5, BRS-12). Pure; every instant an argument.

import { describe, it, expect } from 'vitest';
import { classifyMove, preClassify, medianAsOfOf, sessionAt, moveAvailability, allStaleOf, inRegularTrading, READING_LIMITS, earlierDayLabel } from './readings.js';

const MIN = 60_000;
// Thu Nov 12, 2026 (EST, UTC−5): open 9:30 ET = 14:30Z, close 4:00 PM ET = 21:00Z.
const OPEN = Date.parse('2026-11-12T14:30:00.000Z');
const CLOSE = Date.parse('2026-11-12T21:00:00.000Z');
const T = Date.parse('2026-11-12T18:45:00.000Z'); // 1:45 PM ET
const S = sessionAt(T);
const SNAP = { sweepId: 'sw', sweepAt: T - 30_000, lastSuccessfulSweepAt: T - 30_000 };
const q = (over = {}) => ({ price: 110, previousClose: 100, changePercent: 1.24, priceAsOf: T - 2 * MIN, sessionEtDate: '2026-11-12', collectionStalled: false, ...over });
const cls = (over = {}, ctx = {}) => classifyMove({ quote: q(over), isCrypto: false, session: S, medianAsOf: null, snapshot: SNAP, takenAt: T, ...ctx });

describe('§4 — each state, first match wins', () => {
  it('ok: the move and its OWN time, never called live', () => {
    expect(cls()).toEqual({ state: 'ok', cause: null, words: '+1.2% · 1:43 PM' });
    expect(cls({ changePercent: -0.81 }).words).toBe('−0.8% · 1:43 PM');
    expect(cls({ changePercent: 0 }).words).toBe('0.0% · 1:43 PM');
  });
  it('unsupported: a crypto — before anything else, even a perfect quote', () => {
    expect(cls({}, { isCrypto: true })).toEqual({ state: 'unsupported', cause: null, words: 'crypto · not compared here' });
  });
  it('fallback: a quote marked isFallback (the client placeholder) — rejected even when complete', () => {
    expect(cls({ isFallback: true })).toEqual({ state: 'fallback', cause: null, words: 'No real quote yet' });
  });
  it('missing: no snapshot doc; no entry; a price or previousClose null or ≤ 0; a null changePercent (never derived)', () => {
    expect(classifyMove({ quote: q(), session: S, snapshot: null, takenAt: T }).state).toBe('missing');
    expect(classifyMove({ quote: null, session: S, snapshot: SNAP, takenAt: T })).toEqual({ state: 'missing', cause: null, words: 'No price yet' });
    for (const over of [{ price: null }, { price: 0 }, { price: -1 }, { previousClose: null }, { previousClose: 0 }, { changePercent: null }, { changePercent: Number.NaN }]) {
      expect(cls(over).state).toBe('missing');
      expect(cls(over).cause).toBeNull();
    }
  });
  it('missing · no_time: priceAsOf missing, unparseable, or in the future of takenAt', () => {
    for (const priceAsOf of [null, undefined, 'soon', Number.NaN, T + 1]) {
      expect(cls({ priceAsOf })).toEqual({ state: 'missing', cause: 'no_time', words: 'No quote time' });
    }
    expect(cls({ priceAsOf: T }).state).toBe('ok'); // AT takenAt is not the future
  });
  it("earlier_session: another session's date — shown for reference with its day", () => {
    const c = cls({ sessionEtDate: '2026-11-11' });
    expect(c.state).toBe('earlier_session');
    expect(c.words).toBe("+1.2% · Wed's move · close");
    // A name the collector carried forward for weeks is named by its date, never as last Wednesday's.
    expect(cls({ sessionEtDate: '2026-10-23' }).words).toBe("+1.2% · Oct 23's move · close");
  });
  it('earlier_session: on a weekend and a holiday NO session is current — every quote is earlier', () => {
    const sat = Date.parse('2026-11-14T16:00:00.000Z');
    const c = classifyMove({ quote: q({ sessionEtDate: '2026-11-13', priceAsOf: Date.parse('2026-11-13T20:59:00.000Z') }), session: sessionAt(sat), snapshot: SNAP, takenAt: sat });
    expect(c).toEqual({ state: 'earlier_session', cause: null, words: "+1.2% · Fri's move · close" });
    const thanksgiving = Date.parse('2026-11-26T16:00:00.000Z');
    expect(classifyMove({ quote: q({ sessionEtDate: '2026-11-25', priceAsOf: Date.parse('2026-11-25T20:59:00.000Z') }), session: sessionAt(thanksgiving), snapshot: SNAP, takenAt: thanksgiving }).words).toBe("+1.2% · Wed's move · close");
  });
  it('pre_market: today\'s date before the open — 9:29 is pre-market, 9:30 and 9:31 are the session', () => {
    const t = OPEN + 10 * MIN;
    const at = (asOf) => classifyMove({ quote: q({ priceAsOf: asOf }), session: sessionAt(t), snapshot: { sweepAt: t }, takenAt: t });
    expect(at(OPEN - MIN)).toEqual({ state: 'pre_market', cause: null, words: 'Pre-market · 9:29 AM' });
    expect(at(OPEN).state).toBe('ok');
    expect(at(OPEN + MIN).state).toBe('ok');
  });
  it('after_hours: after the calendar close — 4:00 PM is in, 4:01 PM is after', () => {
    const t = CLOSE + 30 * MIN;
    const at = (asOf) => classifyMove({ quote: q({ priceAsOf: asOf }), session: sessionAt(t), snapshot: { sweepAt: t }, takenAt: t });
    expect(at(CLOSE).state).toBe('ok');
    expect(at(CLOSE + MIN)).toEqual({ state: 'after_hours', cause: null, words: 'After hours · 4:01 PM' });
  });
  it('after_hours on an EARLY close (the calendar\'s 1:00 PM, Nov 27 2026)', () => {
    const early = Date.parse('2026-11-27T18:00:00.000Z'); // 1:00 PM ET
    const t = early + 60 * MIN;
    const s = sessionAt(t);
    expect(s.closeMs).toBe(early);
    expect(classifyMove({ quote: q({ sessionEtDate: '2026-11-27', priceAsOf: early + MIN }), session: s, snapshot: { sweepAt: t }, takenAt: t }).state).toBe('after_hours');
    expect(classifyMove({ quote: q({ sessionEtDate: '2026-11-27', priceAsOf: early - MIN }), session: s, snapshot: { sweepAt: t }, takenAt: t }).state).toBe('ok');
  });
  it('stale · collector_stalled: the symbol\'s own flag', () => {
    expect(cls({ collectionStalled: true })).toEqual({ state: 'stale', cause: 'collector_stalled', words: 'Price collection stalled for this name' });
  });
  it('stale · old_sweep: during regular trading, a sweep 10:01 old is stale, 9:59 is not', () => {
    const at = (age) => classifyMove({ quote: q({ priceAsOf: T - age - MIN }), session: S, snapshot: { sweepAt: T - age }, takenAt: T });
    expect(at(9 * MIN + 59_000).state).toBe('ok');
    expect(at(10 * MIN + 1000)).toEqual({ state: 'stale', cause: 'old_sweep', words: 'Last price sweep at 1:34 PM' });
  });
  it('stale · old_quote: during regular trading, 44:59 old is fine, 45:01 is stale — and the same quote is NOT stale after the close', () => {
    expect(cls({ priceAsOf: T - (44 * MIN + 59_000) }).state).toBe('ok');
    expect(cls({ priceAsOf: T - (45 * MIN + 1000) })).toEqual({ state: 'stale', cause: 'old_quote', words: 'Quote from 12:59 PM · over 45 minutes old' });
    const after = CLOSE + 20 * MIN;
    const sameQuote = q({ priceAsOf: CLOSE - 50 * MIN });
    expect(classifyMove({ quote: sameQuote, session: sessionAt(after), snapshot: { sweepAt: after - 30 * MIN }, takenAt: after }).state).toBe('ok');
    expect(inRegularTrading(sessionAt(after), after)).toBe(false);
  });
  it('stale · behind_rest: 14:59 behind the median is fine, 15:01 is stale', () => {
    const median = T - MIN;
    expect(cls({ priceAsOf: median - (14 * MIN + 59_000) }, { medianAsOf: median }).state).toBe('ok');
    expect(cls({ priceAsOf: median - (15 * MIN + 1000) }, { medianAsOf: median })).toEqual({ state: 'stale', cause: 'behind_rest', words: 'Quote from 1:28 PM · older than the rest' });
  });
  it('the order of the stale causes: stalled before old sweep before old quote before behind the rest', () => {
    const old = { priceAsOf: T - 50 * MIN };
    expect(classifyMove({ quote: q({ ...old, collectionStalled: true }), session: S, medianAsOf: T, snapshot: { sweepAt: T - 20 * MIN }, takenAt: T }).cause).toBe('collector_stalled');
    expect(classifyMove({ quote: q(old), session: S, medianAsOf: T, snapshot: { sweepAt: T - 20 * MIN }, takenAt: T }).cause).toBe('old_sweep');
    expect(classifyMove({ quote: q(old), session: S, medianAsOf: T, snapshot: SNAP, takenAt: T }).cause).toBe('old_quote');
  });
  it('none of the thresholds assumes the vendor delay: they are 10, 45 and 15 minutes, three quotes for a median', () => {
    expect(READING_LIMITS).toEqual({ oldSweepMs: 10 * MIN, oldQuoteMs: 45 * MIN, behindRestMs: 15 * MIN, medianMinQuotes: 3 });
  });
});

describe('§4 — the median', () => {
  const e = (over, isCrypto = false) => ({ quote: q(over), isCrypto });
  it('comes ONLY from valid regular-session stock quotes: crypto, fallback, missing, earlier-session, pre-market and after-hours are out', () => {
    const entries = [
      e({ priceAsOf: T - 10 * MIN }), e({ priceAsOf: T - 6 * MIN }), e({ priceAsOf: T - 2 * MIN }),
      e({ priceAsOf: T - 200 * MIN }, true), e({ priceAsOf: T - 200 * MIN, isFallback: true }), e({ priceAsOf: T - 200 * MIN, changePercent: null }),
      e({ priceAsOf: T - 200 * MIN, sessionEtDate: '2026-11-11' }), e({ priceAsOf: OPEN - 60 * MIN }),
    ];
    expect(medianAsOfOf(entries, { session: S, snapshot: SNAP, takenAt: T })).toBe(T - 6 * MIN);
  });
  it('a stale quote still counts toward the median (it is a valid regular-session quote)', () => {
    expect(medianAsOfOf([e({ priceAsOf: T - 90 * MIN }), e({ priceAsOf: T - 80 * MIN }), e({ priceAsOf: T - 70 * MIN })], { session: S, snapshot: SNAP, takenAt: T })).toBe(T - 80 * MIN);
  });
  it('fewer than three such quotes: no median, the relative rule is skipped (the absolute rules still apply)', () => {
    expect(medianAsOfOf([e({}), e({})], { session: S, snapshot: SNAP, takenAt: T })).toBeNull();
    const far = q({ priceAsOf: T - 40 * MIN });
    expect(classifyMove({ quote: far, session: S, medianAsOf: null, snapshot: SNAP, takenAt: T }).state).toBe('ok');
    expect(classifyMove({ quote: q({ priceAsOf: T - 46 * MIN }), session: S, medianAsOf: null, snapshot: SNAP, takenAt: T }).cause).toBe('old_quote');
  });
  it('an even count takes the midpoint of the middle two', () => {
    expect(medianAsOfOf([e({ priceAsOf: T - 4 * MIN }), e({ priceAsOf: T - 2 * MIN }), e({ priceAsOf: T - 8 * MIN }), e({ priceAsOf: T - 6 * MIN })], { session: S, snapshot: SNAP, takenAt: T })).toBe(T - 5 * MIN);
  });
});

describe('BRS-5 / BRS-12 — move availability: one usable regular-session quote, never the clock alone', () => {
  it('a trading day before the open: "Today\'s session opens at 9:30 AM ET", Wed\'s moves for reference', () => {
    const t = OPEN - 30 * MIN;
    expect(moveAvailability({ states: ['earlier_session', 'earlier_session'], session: sessionAt(t), takenAt: t })).toEqual({ on: false, reason: 'before_open', openText: '9:30 AM', refDay: 'Wed' });
  });
  it('the session open with no ok quote yet: waiting — 9:31 is not enough', () => {
    const t = OPEN + MIN;
    expect(moveAvailability({ states: ['earlier_session', 'pre_market', 'stale'], session: sessionAt(t), takenAt: t })).toMatchObject({ on: false, reason: 'waiting' });
  });
  it('the first ok quote turns it on', () => {
    const t = OPEN + MIN;
    expect(moveAvailability({ states: ['earlier_session', 'ok'], session: sessionAt(t), takenAt: t }).on).toBe(true);
  });
  it("a weekend: closed, the calendar's next session (Mon, Nov 16 · 9:30 AM), Fri's moves for reference", () => {
    const sat = Date.parse('2026-11-14T16:00:00.000Z');
    expect(moveAvailability({ states: ['earlier_session'], session: sessionAt(sat), takenAt: sat })).toEqual({ on: false, reason: 'closed', refDay: 'Fri', next: { etDate: '2026-11-16', dayText: 'Mon, Nov 16', openText: '9:30 AM' } });
  });
  it('a holiday (Thanksgiving): closed, the next session is the Friday', () => {
    const t = Date.parse('2026-11-26T16:00:00.000Z');
    expect(moveAvailability({ states: [], session: sessionAt(t), takenAt: t })).toMatchObject({ reason: 'closed', refDay: 'Wed', next: { dayText: 'Fri, Nov 27' } });
  });
  it('after the close with no ok quote: closed, and the reference day is today', () => {
    const t = CLOSE + 60 * MIN;
    expect(moveAvailability({ states: ['after_hours'], session: sessionAt(t), takenAt: t })).toMatchObject({ reason: 'closed', refDay: 'Thu', next: { dayText: 'Fri, Nov 13' } });
  });
});

describe('§4 — all stale, said once with its cause', () => {
  it('every one of today\'s quotes stale on an old sweep names the sweep; otherwise the newest quote', () => {
    expect(allStaleOf([{ state: 'stale', cause: 'old_sweep', priceAsOf: T - 30 * MIN }, { state: 'earlier_session' }], { sweepAt: T - 20 * MIN })).toEqual({ cause: 'old_sweep', atText: '1:25 PM' });
    expect(allStaleOf([{ state: 'stale', cause: 'old_quote', priceAsOf: T - 75 * MIN }, { state: 'stale', cause: 'old_quote', priceAsOf: T - 60 * MIN }], SNAP)).toEqual({ cause: 'no_movement', atText: '12:45 PM' });
  });
  it('one ok quote, or nothing of today\'s to judge: no line', () => {
    expect(allStaleOf([{ state: 'stale', cause: 'old_quote', priceAsOf: T }, { state: 'ok', priceAsOf: T }], SNAP)).toBeNull();
    expect(allStaleOf([{ state: 'earlier_session' }], SNAP)).toBeNull();
  });
});

describe('the session itself', () => {
  it('outside the maintained calendar no session is current (it never guesses)', () => {
    const t = Date.parse('2028-03-01T16:00:00.000Z');
    expect(sessionAt(t)).toMatchObject({ known: false, trading: false });
    expect(preClassify({ quote: q({ sessionEtDate: '2028-03-01', priceAsOf: t - MIN }), session: sessionAt(t), snapshot: SNAP, takenAt: t }).state).toBe('earlier_session');
  });
  it('the earlier day is the weekday only for the calendar\'s previous session', () => {
    expect(earlierDayLabel('2026-11-11', S)).toBe('Wed');
    expect(earlierDayLabel('2026-11-10', S)).toBe('Nov 10');
  });
});
