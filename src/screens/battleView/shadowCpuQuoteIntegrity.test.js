// src/screens/battleView/shadowCpuQuoteIntegrity.test.js
//
// The pure gate (contract SHADOW_CPU_PLACEHOLDER_PRICE_SPEC_V1_6.md §3–§7;
// build record docs/audits/20261002_SHADOW_CPU_QUOTE_INTEGRITY_BUILD_REVIEW.md):
// policy boundaries, strict number and time validation, lineage, and the
// selected comparison's precision matrix. The REAL presence binding and the
// REAL tug-of-war helper are used — never copies.

import { describe, it, expect } from 'vitest';
import {
  QUOTE_INTEGRITY_COPY as COPY,
  readQuoteOrigins,
  readMarketTime,
  interpretQuote,
  adoptQuote,
  EMPTY_POSITION_QUOTE,
  lastQuoteLabel,
  sessionExtremes,
  sessionDateOf,
  classifyAdmission,
  gatedRequestedId,
  resolveGate,
  positionLineageKey,
  buildBattleContext,
  reconcileLineage,
  parseStoredInstant,
  qualifyStoredPair,
  selectComparison,
  gatedBarWidth,
  comparisonProse,
  leadOf,
  duelFor,
  resolveResearchTarget,
} from './shadowCpuQuoteIntegrity.js';
import { computeTugOfWarWidth } from './computeTugOfWarWidth';
import { standingFromDuel } from '../../components/AgentPresence/presenceBinding';
import { formatScoreDisplay } from '../../components/shared/AnimatedScore';

const NOW = Date.parse('2026-10-01T17:00:00.000Z');
const TS = Math.floor(Date.parse('2026-10-01T16:50:00.000Z') / 1000);
const GENUINE = { version: 1, price: 'provider-close', previousClose: 'provider-previous-close' };
const rec = (over = {}) => ({ price: 103, previousClose: 100, open: 101, high: 104, low: 99, timestamp: TS, quoteOrigin: GENUINE, ...over });

describe('§4.1 — value-specific provenance', () => {
  it('reads version-1 origins and rejects anything else as unknown, per value', () => {
    expect(readQuoteOrigins(rec())).toEqual({ price: 'provider-close', previousClose: 'provider-previous-close' });
    for (const qo of [undefined, null, 'provider-close', [], {}, { version: 2, price: 'provider-close' }, { version: '1', price: 'provider-close' }]) {
      expect(readQuoteOrigins(rec({ quoteOrigin: qo }))).toEqual({ price: 'unproven', previousClose: 'unproven' });
    }
    expect(readQuoteOrigins(rec({ quoteOrigin: { version: 1, price: 'provider-close', previousClose: 'whatever' } })))
      .toEqual({ price: 'provider-close', previousClose: 'unproven' });
    expect(readQuoteOrigins(rec({ quoteOrigin: { version: 1, price: 'close', previousClose: 'missing' } })))
      .toEqual({ price: 'unproven', previousClose: 'missing' });
  });

  it('absence of isFallback is never positive provenance, and a fallback claiming genuine origins is contradictory', () => {
    const noMeta = { price: 103, previousClose: 100 };
    expect(readQuoteOrigins(noMeta)).toEqual({ price: 'unproven', previousClose: 'unproven' });
    expect(readQuoteOrigins(rec({ isFallback: true }))).toEqual({ price: 'unproven', previousClose: 'unproven' });
    expect(readQuoteOrigins({ price: 240, isFallback: true, quoteOrigin: { version: 1, price: 'configured-fallback', previousClose: 'configured-fallback' } }))
      .toEqual({ price: 'configured-fallback', previousClose: 'configured-fallback' });
  });

  it('R-3: a WebSocket-written record makes the current unknown; a genuine previousClose keeps its own metadata', () => {
    const ws = { ...rec(), price: 107, source: 'websocket' };
    expect(readQuoteOrigins(ws)).toEqual({ price: 'unproven', previousClose: 'provider-previous-close' });
    const q = interpretQuote(ws, { nowMs: NOW });
    expect(q.current).toMatchObject({ qualified: false, reason: 'unproven-origin', marketTimeMs: null });
    expect(q.previousClose).toMatchObject({ genuine: true, value: 100 });
    expect(q.extremes).toBeNull(); // no inherited REST time or extremes attach to the overwritten value
  });
});

describe('§4.2 — current qualification reasons, and the independent previousClose', () => {
  it.each([
    ['qualified', rec(), true],
    ['previous-close-substitution', rec({ quoteOrigin: { version: 1, price: 'provider-previous-close', previousClose: 'provider-previous-close' } }), false],
    ['missing', rec({ price: 0, quoteOrigin: { version: 1, price: 'missing', previousClose: 'missing' } }), false],
    ['configured-fallback', { price: 430, previousClose: 430, isFallback: true, quoteOrigin: { version: 1, price: 'configured-fallback', previousClose: 'configured-fallback' } }, false],
    ['unproven-origin', rec({ quoteOrigin: undefined }), false],
    ['invalid-number', rec({ price: 0 }), false],
    ['invalid-number', rec({ price: Number.NaN }), false],
    ['invalid-number', rec({ price: Infinity }), false],
    ['invalid-number', rec({ price: -5 }), false],
    ['invalid-number', rec({ price: '103' }), false],
  ])('%s', (reason, record, qualified) => {
    const q = interpretQuote(record, { nowMs: NOW });
    expect(q.current.reason).toBe(reason);
    expect(q.current.qualified).toBe(qualified);
    if (!qualified) expect(q.current.price).toBeNull();
  });

  it('no record at all is missing on both values', () => {
    expect(interpretQuote(undefined, { nowMs: NOW }).current.reason).toBe('missing');
    expect(interpretQuote(null, { nowMs: NOW }).previousClose.reason).toBe('missing');
  });

  it('a genuine previousClose stays eligible even when the current was substituted from it', () => {
    const q = interpretQuote(rec({ price: 100, quoteOrigin: { version: 1, price: 'provider-previous-close', previousClose: 'provider-previous-close' } }), { nowMs: NOW });
    expect(q.current.qualified).toBe(false);
    expect(q.previousClose).toEqual({ genuine: true, reason: 'genuine', value: 100 });
  });

  it('a genuine value equal to a configured default stays usable (origin, not plausibility)', () => {
    expect(interpretQuote(rec({ price: 430, previousClose: 430 }), { nowMs: NOW }).current.qualified).toBe(true);
  });

  it('previousClose reasons: zero/NA normalized to 0 is invalid; missing and fallback are not genuine', () => {
    expect(interpretQuote(rec({ previousClose: 0 }), { nowMs: NOW }).previousClose.reason).toBe('invalid-number');
    expect(interpretQuote(rec({ quoteOrigin: { ...GENUINE, previousClose: 'missing' } }), { nowMs: NOW }).previousClose.reason).toBe('missing');
    expect(interpretQuote(rec({ quoteOrigin: { ...GENUINE, previousClose: 'configured-fallback' } }), { nowMs: NOW }).previousClose.reason).toBe('configured-fallback');
  });

  it('extremes come only from a qualified record, finite positive fields only', () => {
    expect(interpretQuote(rec({ high: 0, low: 'NA', open: 101 }), { nowMs: NOW }).extremes).toEqual({ open: 101 });
    expect(interpretQuote(rec({ quoteOrigin: undefined }), { nowMs: NOW }).extremes).toBeNull();
  });
});

describe('A-7 / V-9 — the market time attached to that very value', () => {
  it('Unix seconds → milliseconds, explicitly', () => {
    expect(readMarketTime({ timestamp: TS }, NOW)).toEqual({ ms: TS * 1000, reason: null });
  });
  it.each([
    [undefined, 'absent'], [null, 'absent'], ['NA', 'invalid'], ['1790000000', 'invalid'], [0, 'invalid'],
    [-5, 'invalid'], [Number.NaN, 'invalid'], [Infinity, 'invalid'], [1e300, 'invalid'],
  ])('timestamp %p → %s', (timestamp, reason) => {
    expect(readMarketTime({ timestamp }, NOW)).toEqual({ ms: null, reason });
  });
  it('a time later than the browser clock fails AS A TIME only — the price stays usable, untimed', () => {
    const q = interpretQuote(rec({ timestamp: TS + 3600 }), { nowMs: NOW });
    expect(q.current).toMatchObject({ qualified: true, price: 103, marketTimeMs: null, timeReason: 'future' });
  });
  it('a timestamp beside a substituted current never qualifies it', () => {
    const q = interpretQuote(rec({ quoteOrigin: { version: 1, price: 'provider-previous-close', previousClose: 'provider-previous-close' } }), { nowMs: NOW });
    expect(q.current.marketTimeMs).toBeNull();
  });
  it('a genuine current without a timestamp remains usable', () => {
    const state = adoptQuote(null, interpretQuote(rec({ timestamp: null }), { nowMs: NOW }));
    expect(state).toMatchObject({ status: 'usable', accepted: { price: 103, marketTimeMs: null } });
  });
});

describe('§4.3 — Option 1 adoption', () => {
  const at = (s, over = {}) => interpretQuote(rec({ timestamp: s, ...over }), { nowMs: NOW });
  const failed = interpretQuote({ price: 240, isFallback: true, quoteOrigin: { version: 1, price: 'configured-fallback', previousClose: 'configured-fallback' } }, { nowMs: NOW });

  it('starts empty and unavailable', () => {
    expect(adoptQuote(null, failed)).toMatchObject({ accepted: null, status: 'unavailable', reason: 'configured-fallback' });
    expect(EMPTY_POSITION_QUOTE.status).toBe('unavailable');
  });
  it('rejects a strictly older qualified arrival whole — tuple and previousClose kept', () => {
    const a = adoptQuote(null, at(TS, { price: 110, previousClose: 100 }));
    const b = adoptQuote(a, at(TS - 60, { price: 103, previousClose: 99 }));
    expect(b).toBe(a);
  });
  it('adopts newer, equal and incomparable arrivals with their OWN time', () => {
    const a = adoptQuote(null, at(TS - 60, { price: 110 }));
    expect(adoptQuote(a, at(TS, { price: 111 })).accepted).toEqual({ price: 111, marketTimeMs: TS * 1000, extremes: { high: 104, low: 99, open: 101 } });
    expect(adoptQuote(a, at(TS - 60, { price: 112 })).accepted.price).toBe(112);
    expect(adoptQuote(a, at(null, { price: 113 })).accepted).toMatchObject({ price: 113, marketTimeMs: null });
    const untimed = adoptQuote(null, at(null, { price: 120 }));
    expect(adoptQuote(untimed, at(TS - 600, { price: 99 })).accepted).toMatchObject({ price: 99, marketTimeMs: (TS - 600) * 1000 });
  });
  it('an unqualified arrival leaves a usable position stale (genuine tuple retained), never usable', () => {
    const a = adoptQuote(null, at(TS, { price: 110 }));
    const s = adoptQuote(a, failed);
    expect(s).toMatchObject({ status: 'stale', accepted: { price: 110 } });
  });
  it('rejecting an older record does not promote a stale observation back', () => {
    const s = adoptQuote(adoptQuote(null, at(TS, { price: 110 })), failed);
    expect(adoptQuote(s, at(TS - 60, { price: 104 }))).toBe(s);
  });
  it('previousClose: genuine replaces, non-genuine keeps the earlier GENUINE close, fabricated never retained', () => {
    let s = adoptQuote(null, at(TS, { previousClose: 100 }));
    s = adoptQuote(s, at(TS, { previousClose: 0 }));
    expect(s.genuineClose).toBe(100);
    s = adoptQuote(s, failed);
    expect(s.genuineClose).toBe(100);
    s = adoptQuote(s, at(TS, { previousClose: 101 }));
    expect(s.genuineClose).toBe(101);
  });
  it('[A-8] an unqualified current is not subject to the older-time rule; its genuine close imports', () => {
    const a = adoptQuote(null, at(TS, { price: 110, previousClose: 100 }));
    const olderSubstituted = at(TS - 3600, { price: 97, previousClose: 97, quoteOrigin: { version: 1, price: 'provider-previous-close', previousClose: 'provider-previous-close' } });
    expect(adoptQuote(a, olderSubstituted).genuineClose).toBe(97);
  });
});

describe('dated last quote and session-qualified extremes', () => {
  const stale = adoptQuote(adoptQuote(null, interpretQuote(rec({ price: 153.5 }), { nowMs: NOW })), interpretQuote(null, { nowMs: NOW }));
  it('a stale position with an attached time shows "Last quote $X · as of [date, time, zone]"', () => {
    expect(lastQuoteLabel(stale)).toBe('Last quote $153.50 · as of Oct 1, 12:50 PM EDT');
  });
  it('no label without a time, for usable positions, or for never-accepted ones', () => {
    const untimed = adoptQuote(adoptQuote(null, interpretQuote(rec({ timestamp: null }), { nowMs: NOW })), interpretQuote(null, { nowMs: NOW }));
    expect(lastQuoteLabel(untimed)).toBeNull();
    expect(lastQuoteLabel(adoptQuote(null, interpretQuote(rec(), { nowMs: NOW })))).toBeNull();
    expect(lastQuoteLabel(adoptQuote(null, interpretQuote(null, { nowMs: NOW })))).toBeNull();
  });
  it('extremes count as TODAY only when the attached market time is in today\'s session', () => {
    const usable = adoptQuote(null, interpretQuote(rec(), { nowMs: NOW }));
    expect(sessionExtremes(usable, { nowMs: NOW })).toEqual({ sessionDate: '2026-10-01', high: 104, low: 99, open: 101 });
    const yesterday = adoptQuote(null, interpretQuote(rec({ timestamp: TS - 86400 }), { nowMs: NOW }));
    expect(sessionExtremes(yesterday, { nowMs: NOW })).toBeNull();
    const untimed = adoptQuote(null, interpretQuote(rec({ timestamp: null }), { nowMs: NOW }));
    expect(sessionExtremes(untimed, { nowMs: NOW })).toBeNull();
  });
  it('crypto uses the UTC date and never carries an open', () => {
    const evening = Date.parse('2026-10-02T01:30:00.000Z'); // 9:30 PM ET Oct 1, UTC Oct 2
    expect(sessionDateOf(evening, { crypto: true })).toBe('2026-10-02');
    expect(sessionDateOf(evening, { crypto: false })).toBe('2026-10-01');
    const s = adoptQuote(null, interpretQuote(rec({ timestamp: Math.floor(evening / 1000) - 60 }), { nowMs: evening }));
    expect(sessionExtremes(s, { nowMs: evening, crypto: true })).toEqual({ sessionDate: '2026-10-02', high: 104, low: 99 });
    const lateUtcYesterday = adoptQuote(null, interpretQuote(rec({ timestamp: Math.floor(Date.parse('2026-10-01T23:30:00Z') / 1000) }), { nowMs: evening }));
    expect(sessionExtremes(lateUtcYesterday, { nowMs: evening, crypto: true })).toBeNull();
  });
});

describe('§3.1 — gate resolution (R-5, C-2, B-4, B-5, C-4, A-4)', () => {
  const READY = { requestedId: 'ab-1', status: 'ready', snapshotId: 'ab-1', data: { gameMode: 'baggerbomb_agent', opponent: { odUserId: 'cpu' } } };
  const q = (lookup, extra = {}) => resolveGate({ integrityOn: true, directId: null, lookup, envelope: READY, requestedId: gatedRequestedId({ directId: null, lookup }), ...extra });

  it('query path: pending / missing lookup fail closed; idle and confirmed empty are "No active battle"', () => {
    expect(q(undefined).mode).toBe('pending');
    expect(q({ status: 'pending' }).mode).toBe('pending');
    expect(q({ status: 'idle' }).mode).toBe('no-battle');
    expect(q({ status: 'empty', battleId: null, fromCache: false }).mode).toBe('no-battle');
  });
  it('errors — including no-auth and unconfirmed-empty — are "Battle unavailable" carrying their identity', () => {
    for (const error of [{ code: 'no-auth' }, { code: 'unconfirmed-empty' }, { code: 'permission-denied', message: 'x' }]) {
      const r = q({ status: 'error', error });
      expect(r.mode).toBe('unavailable');
      expect(r.error).toBe(error);
    }
  });
  it('success subscribes to the lookup\'s OWN battleId, then waits for its matching snapshot', () => {
    expect(gatedRequestedId({ directId: null, lookup: { status: 'success', battleId: 'ab-1' } })).toBe('ab-1');
    expect(gatedRequestedId({ directId: null, lookup: { status: 'pending', battleId: 'ab-1' } })).toBeNull();
    expect(q({ status: 'success', battleId: 'ab-1' }).mode).toBe('admitted');
    expect(resolveGate({ integrityOn: true, directId: null, lookup: { status: 'success', battleId: 'ab-2' }, envelope: READY, requestedId: 'ab-2' }).mode).toBe('pending');
  });
  it('the direct-ID route ignores lookup entirely', () => {
    for (const lookup of [undefined, { status: 'error', error: { code: 'x' } }, { status: 'pending' }]) {
      expect(resolveGate({ integrityOn: true, directId: 'ab-1', lookup, envelope: READY, requestedId: 'ab-1' }).mode).toBe('admitted');
    }
    expect(gatedRequestedId({ directId: 'ab-1', lookup: { status: 'error' } })).toBe('ab-1');
  });
  it('subscription: missing envelope, other requested id or pending → pending; missing doc and errors → unavailable', () => {
    const d = (envelope, extra) => resolveGate({ integrityOn: true, directId: 'ab-1', envelope, requestedId: 'ab-1', ...extra });
    expect(d(undefined).mode).toBe('pending');
    expect(d({ ...READY, requestedId: 'ab-0' }).mode).toBe('pending');
    expect(d({ requestedId: 'ab-1', status: 'pending' }).mode).toBe('pending');
    expect(d({ requestedId: 'ab-1', status: 'missing' }).mode).toBe('unavailable');
    expect(d({ requestedId: 'ab-1', status: 'error', error: { code: 'x' } })).toMatchObject({ mode: 'unavailable', error: { code: 'x' } });
  });
  it('[A-4] once excluded, that requested id\'s later errors stay legacy (excluded) until the id changes', () => {
    const d = (envelope, excludedFor) => resolveGate({ integrityOn: true, directId: 'ab-1', envelope, requestedId: 'ab-1', excludedFor });
    expect(d({ ...READY, data: { ...READY.data, gameMode: 'other' } }).mode).toBe('excluded');
    expect(d({ requestedId: 'ab-1', status: 'error' }, 'ab-1').mode).toBe('excluded');
    expect(d({ requestedId: 'ab-1', status: 'error' }, 'ab-0').mode).toBe('unavailable');
  });
});

describe('§3.2 — context, lineage and conservative invalidation', () => {
  const portfolio = {
    star: [{ symbol: 'AAPL', price: 150 }, { symbol: 'NVDA', price: 900 }],
    core: [{ symbol: 'TSLA', swapPrice: 248, swappedInAt: '2026-10-01T15:00:00.000Z', swappedInDay: 1 }, { isCash: true }],
    support: [null],
    startingPrices: { AAPL: 150, NVDA: 900 },
  };
  const data = (over = {}) => ({ portfolio, opponent: { odUserId: 'cpu', portfolio: { star: [{ symbol: 'AAPL', price: 151 }] } }, scoreState: { tradeCount: 1 }, trades: [{}], ...over });

  it('builds positions, required (non-cash) symbols and structural validity from the snapshot alone', () => {
    const ctx = buildBattleContext(data(), { battleId: 'ab-1' });
    expect(ctx.positions.map((p) => p.posKey)).toEqual(['player:star:0', 'player:star:1', 'player:core:0', 'player:core:1', 'cpu:star:0']);
    expect(ctx.requiredSymbols).toEqual(['AAPL', 'NVDA', 'TSLA']);
    expect(ctx.portfoliosValid).toBe(true);
    expect(ctx.startingPrices).toEqual({ AAPL: 150, NVDA: 900 });
  });
  it('empty or malformed portfolios are invalid — never an all-cash success via every([])', () => {
    for (const bad of [null, {}, { star: [], core: [], support: [] }, { star: 'AAPL' }, { star: [{ price: 5 }] }, []]) {
      expect(buildBattleContext(data({ portfolio: bad }), { battleId: 'ab-1' }).portfoliosValid, JSON.stringify(bad)).toBe(false);
    }
    expect(buildBattleContext(data({ opponent: { odUserId: 'cpu' } }), { battleId: 'ab-1' }).portfoliosValid).toBe(false);
  });
  it('a same-symbol re-entry at an identical price is a new lineage; the nightly rewrite is too (A-5/V-8)', () => {
    const base = { symbol: 'TSLA', swapPrice: 248, swappedInAt: '2026-10-01T15:00:00.000Z', swappedInDay: 1 };
    const k = (a) => positionLineageKey(a, { side: 'player', tier: 'core', slot: 0, startingPrices: {} });
    expect(k({ ...base, swappedInAt: '2026-10-01T16:00:00.000Z' })).not.toBe(k(base));
    // Exactly the writer: delete swapPrice and swappedInDay, add both previous*, keep swappedInAt.
    const rewritten = { symbol: 'TSLA', swappedInAt: base.swappedInAt, previousSwapPrice: 248, previousSwapDay: 1 };
    expect(k(rewritten)).not.toBe(k(base));
    expect(k({ ...base })).toBe(k(base));
  });
  it('reconcile: same content → same object; a changed slot advances only that slot', () => {
    const c1 = buildBattleContext(data(), { battleId: 'ab-1' });
    const t1 = reconcileLineage(null, { battleKey: 'ab-1#1', context: c1 });
    expect(reconcileLineage(t1, { battleKey: 'ab-1#1', context: buildBattleContext(data(), { battleId: 'ab-1' }) })).toBe(t1);
    const swapped = { ...portfolio, star: [{ symbol: 'AAPL', price: 150 }, { symbol: 'AMD', swapPrice: 140, swappedInAt: 'x', swappedInDay: 1 }] };
    const t2 = reconcileLineage(t1, { battleKey: 'ab-1#1', context: buildBattleContext(data({ portfolio: swapped, scoreState: { tradeCount: 2 }, trades: [{}, {}] }), { battleId: 'ab-1' }) });
    expect(t2.battleGeneration).toBe(t1.battleGeneration);
    expect(t2.positions['player:star:1'].gen).toBe(2);
    expect(t2.positions['player:star:0']).toBe(t1.positions['player:star:0']);
  });
  it('reconcile: a trade-count change no slot explains, a truncated history, or a new subscription invalidates everything', () => {
    const t1 = reconcileLineage(null, { battleKey: 'ab-1#1', context: buildBattleContext(data(), { battleId: 'ab-1' }) });
    const unexplained = reconcileLineage(t1, { battleKey: 'ab-1#1', context: buildBattleContext(data({ scoreState: { tradeCount: 2 } }), { battleId: 'ab-1' }) });
    expect(unexplained.battleGeneration).toBe(t1.battleGeneration + 1);
    expect(Object.values(unexplained.positions).every((p) => p.gen === 2)).toBe(true);
    const truncated = reconcileLineage(t1, { battleKey: 'ab-1#1', context: buildBattleContext(data({ trades: [] }), { battleId: 'ab-1' }) });
    expect(truncated.battleGeneration).toBe(t1.battleGeneration + 1);
    const resubscribed = reconcileLineage(t1, { battleKey: 'ab-1#2', context: buildBattleContext(data(), { battleId: 'ab-1' }) });
    expect(resubscribed.battleGeneration).toBe(t1.battleGeneration + 1);
  });
});

describe('§5.1 — stored evidence', () => {
  it.each([
    ['2026-10-01T16:47:00.000Z', true], ['2026-10-01T16:47:00Z', true], ['2026-10-01T12:47:00-04:00', true],
    ['2026-10-01', false], ['', false], ['   ', false], ['2026-02-30T10:00:00Z', false], ['2026-13-01T10:00:00Z', false],
    ['2026-10-01T24:00:00Z', false], ['2026-10-01T16:47:00', false], ['2026-10-01T16:47Z', false], ['2026-10-01T18:00:00Z', false],
    ['not a date', false], [1790874000000, false], [null, false], [undefined, false], [{ seconds: 1 }, false],
  ])('lastScoredAt %p → %s', (value, ok) => {
    expect(parseStoredInstant(value, NOW) !== null).toBe(ok);
  });
  it('finite zero and negative scores qualify; strings, null, NaN and infinities never do', () => {
    const at = '2026-10-01T16:47:00.000Z';
    expect(qualifyStoredPair({ currentScore: 0, opponentScore: 0, lastScoredAt: at }, NOW)).toEqual({ pair: [0, 0], timeMs: Date.parse(at) });
    expect(qualifyStoredPair({ currentScore: -0.01, opponentScore: -21, lastScoredAt: at }, NOW).pair).toEqual([-0.01, -21]);
    for (const bad of ['12', null, undefined, Number.NaN, Infinity, -Infinity]) {
      expect(qualifyStoredPair({ currentScore: bad, opponentScore: 3, lastScoredAt: at }, NOW)).toBeNull();
      expect(qualifyStoredPair({ currentScore: 3, opponentScore: bad, lastScoredAt: at }, NOW)).toBeNull();
    }
    expect(qualifyStoredPair({ currentScore: 1, opponentScore: 2, lastScoredAt: null }, NOW)).toBeNull();
  });
});

describe('§5.2 — the selection table', () => {
  const STORED = { currentScore: 10.4, opponentScore: 10.2, lastScoredAt: '2026-10-01T16:47:00.000Z' };
  const sel = (over) => selectComparison({ status: 'active', complete: false, browserPair: null, scoreState: STORED, contextKey: 'ctx', nowMs: NOW, ...over });

  it('active + complete + finite → browser immediately, even with lastScoredAt null', () => {
    const c = sel({ complete: true, browserPair: [12, 3], scoreState: { currentScore: 0, lastScoredAt: null } });
    expect(c).toMatchObject({ kind: 'browser', pair: [12, 3], label: 'Live browser estimate', digits: ['+12', '+3'] });
  });
  it('a genuine browser 0–0 is a browser comparison, not unavailable', () => {
    expect(sel({ complete: true, browserPair: [0, 0], scoreState: null })).toMatchObject({ kind: 'browser', digits: ['+0', '+0'], prose: 'Tied' });
  });
  it('active + incomplete + qualified stored → last-scored with the actual time', () => {
    expect(sel({})).toMatchObject({ kind: 'last-scored', label: 'Last scored Oct 1, 12:47 PM EDT · browser quotes incomplete', digits: ['+10.40', '+10.20'] });
  });
  it('active + incomplete + no stored pair → "Comparison unavailable" — never 0–0', () => {
    const c = sel({ scoreState: { currentScore: 0, lastScoredAt: null } });
    expect(c).toMatchObject({ kind: 'unavailable', pair: null, digits: null, barWidth: null, lead: null, label: COPY.comparisonUnavailable });
  });
  it('active + complete + non-finite browser total → stored with "browser estimate unavailable", else unavailable', () => {
    expect(sel({ complete: true, browserPair: [Number.NaN, 3] }).label).toContain(COPY.browserEstimateUnavailable);
    expect(sel({ complete: true, browserPair: [Infinity, 3], scoreState: null }).kind).toBe('unavailable');
  });
  it('completed → only a qualified stored final; live quotes never select it', () => {
    expect(sel({ status: 'completed', complete: true, browserPair: [99, 1] })).toMatchObject({ kind: 'final', pair: [10.4, 10.2] });
    expect(sel({ status: 'completed', complete: true, browserPair: [99, 1], scoreState: { currentScore: 1, opponentScore: 2 } }))
      .toMatchObject({ kind: 'unavailable', label: COPY.finalComparisonUnavailable });
  });
  it('the switch key changes with kind and with context identity (V-3)', () => {
    expect(sel({}).switchKey).toBe('last-scored|ctx');
    expect(sel({ contextKey: 'ctx2' }).switchKey).not.toBe(sel({}).switchKey);
  });
});

describe('C-1 / B-1 / B-2 / B-3+ / P8 / P9 — the precision matrix from ONE selected pair', () => {
  const stored = (my, opp) => selectComparison({
    status: 'active', complete: false, browserPair: null, contextKey: 'c', nowMs: NOW,
    scoreState: { currentScore: my, opponentScore: opp, lastScoredAt: '2026-10-01T16:47:00.000Z' },
  });
  it.each([
    [10.4, 10.2, ['+10.40', '+10.20'], 'player', 'You lead by 0.20'],
    [10.2, 10.4, ['+10.20', '+10.40'], 'cpu', 'CPU leads by 0.20'],
    [10.4, 10.4, ['+10.40', '+10.40'], 'tie', 'Tied'],
    [0, 0, ['+0.00', '+0.00'], 'tie', 'Tied'],
    [-0.01, 0, ['-0.01', '+0.00'], 'cpu', 'CPU leads by 0.01'],
    [-0.01, -0.02, ['-0.01', '-0.02'], 'player', 'You lead by 0.01'],
    [-2, -21, ['-2.00', '-21.00'], 'player', 'You lead by 19.00'],
    [-0, 0, ['+0.00', '+0.00'], 'tie', 'Tied'],
    [10.204, 10.2, ['+10.20', '+10.20'], 'player', 'You lead by less than 0.01'],
    [10.206, 10.194, ['+10.21', '+10.19'], 'player', 'You lead by 0.02'],
  ])('%p vs %p', (my, opp, digits, lead, prose) => {
    const c = stored(my, opp);
    expect(c.digits).toEqual(digits);
    expect(c.lead).toBe(lead);
    expect(c.prose).toBe(prose);
    expect(c.standing).toBe(standingFromDuel(my, opp));
    expect(c.barWidth).toBe(gatedBarWidth(my, opp));
    expect(c.accessibleText).toContain(digits[0]);
    expect(c.accessibleText).toContain(prose);
  });
  it('bar: −0.01 vs 0 → 10 (today\'s helper says 90); −2 vs −21 → 90 (helper says 10); a tie → 50', () => {
    expect(gatedBarWidth(-0.01, 0)).toBe(10);
    expect(computeTugOfWarWidth(-0.01, 0)).toBe(90);
    expect(gatedBarWidth(-2, -21)).toBe(90);
    expect(computeTugOfWarWidth(-2, -21)).toBe(10);
    expect(gatedBarWidth(10.4, 10.4)).toBe(50);
    expect(gatedBarWidth(0, 0)).toBe(50);
  });
  it('[B-2] opposite signs pin at 90/10 however small the gap', () => {
    expect(gatedBarWidth(0.01, -0.01)).toBe(90);
    expect(gatedBarWidth(-0.01, 0.01)).toBe(10);
    expect(gatedBarWidth(1, -1)).toBe(90);
    expect(gatedBarWidth(3, -2)).toBe(90);
    expect(gatedBarWidth(0.01, 0)).toBe(90); // non-negative: today's helper value
  });
  it('[B-1] non-negative pairs: the width equals today\'s helper EXACTLY (strict ===, every pair on a grid)', () => {
    for (let my = 0; my <= 3; my += 0.01) {
      for (let opp = 0; opp <= 3; opp += 0.37) {
        expect(Object.is(gatedBarWidth(my, opp), computeTugOfWarWidth(my, opp))).toBe(true);
      }
    }
  });
  it('the 0.03 → 0.02 → 0.03 one-hundredth steps each reach the digits', () => {
    expect(stored(0.03, 0).digits[0]).toBe('+0.03');
    expect(stored(0.02, 0).digits[0]).toBe('+0.02');
  });
  it('browser pairs keep integer digits and today\'s arithmetic', () => {
    const c = selectComparison({ status: 'active', complete: true, browserPair: [12, 3], scoreState: null, contextKey: 'c', nowMs: NOW });
    expect(c.fractionDigits).toBeUndefined();
    expect(c.digits).toEqual([formatScoreDisplay(12), formatScoreDisplay(3)]);
    expect(c.prose).toBe('You lead by 9');
    expect(Object.is(c.barWidth, computeTugOfWarWidth(12, 3))).toBe(true);
  });
  it('lead is three-way on the values; prose margins come from the displayed digits', () => {
    expect(leadOf(1, 1)).toBe('tie');
    expect(comparisonProse([10.204, 10.2], ['+10.20', '+10.20'], 2)).toBe('You lead by less than 0.01');
    expect(comparisonProse([10.2, 10.204], ['+10.20', '+10.20'], 2)).toBe('CPU leads by less than 0.01');
  });
});

describe('R-7 / V-4 — the face input', () => {
  it('available: exactly the selected pair; unavailable: both score keys OMITTED (never null)', () => {
    const c = selectComparison({ status: 'active', complete: true, browserPair: [4, 9], scoreState: null, contextKey: 'c', nowMs: NOW });
    expect(duelFor(c)).toEqual({ playerScore: 4, opponentScore: 9, statusFeed: null });
    const u = selectComparison({ status: 'active', complete: false, browserPair: null, scoreState: null, contextKey: 'c', nowMs: NOW });
    const duel = duelFor(u);
    expect(duel).toEqual({ statusFeed: null });
    expect('playerScore' in duel).toBe(false);
    expect(standingFromDuel(duel.playerScore, duel.opponentScore)).toBe(0);
  });
});

describe('§7.2 item 1 — research resolution', () => {
  const held = [
    { posKey: 'player:star:0', side: 'player', symbol: 'AAPL' },
    { posKey: 'cpu:star:0', side: 'cpu', symbol: 'AAPL' },
    { posKey: 'cpu:core:0', side: 'cpu', symbol: 'AMD' },
    { posKey: 'player:core:0', side: 'player', symbol: 'TSLA' },
    { posKey: 'player:core:1', side: 'player', symbol: 'TSLA' },
  ];
  it('a row supplies its exact position', () => {
    expect(resolveResearchTarget('AAPL', held, { posKey: 'cpu:star:0' })).toMatchObject({ kind: 'held', position: { side: 'cpu' } });
  });
  it('held on both sides: player row/untagged → player; CPU-tagged → CPU', () => {
    expect(resolveResearchTarget('AAPL', held).position.side).toBe('player');
    expect(resolveResearchTarget('AAPL', held, { side: 'cpu' }).position.side).toBe('cpu');
  });
  it('a CPU-only symbol resolves to the CPU', () => {
    expect(resolveResearchTarget('AMD', held).position.posKey).toBe('cpu:core:0');
  });
  it('several indistinguishable same-side positions withhold the held view', () => {
    expect(resolveResearchTarget('TSLA', held)).toEqual({ kind: 'withheld' });
  });
  it('held by neither side → non-held (legacy research)', () => {
    expect(resolveResearchTarget('CRWD', held)).toEqual({ kind: 'non-held' });
  });
});
