// api/_utils/callRecords/swappable.test.js
//
// Cockpit Build 2b — D-7's one "can this name come in?" test (spec S-2):
// every reason, the order of the checks, the lists, the class reading, and
// PARITY with the fenced executor's own exported validator
// (agentSwapExecution.js validateTradeDecision — called, never edited;
// BUILD_RULES §1 permits it).
//
// BUILD_RULES §4: this file's unmocked import of swappable.js is its
// dependency-surface guard (the module has no import; the guard keeps it so).

import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));

import { canComeIn, swappableNames, swapListNames, freezeSwapBook, benchRowLockedAt, SWAPPABLE_REASONS } from './swappable.js';
import { validateTradeDecision } from '../agentSwapExecution.js';

const AT = Date.parse('2026-10-15T17:00:00.000Z');
const LATER = '2026-10-15T19:00:00.000Z';
const EARLIER = '2026-10-15T15:00:00.000Z';

const battle = (over = {}) => ({
  portfolio: {
    star: [{ symbol: 'NVDA', isCrypto: false }],
    core: [{ symbol: 'AMD', isCrypto: false }, { symbol: 'MSFT', isCrypto: false }],
    support: [{ symbol: 'KO', isCrypto: false }, { symbol: 'BTC-USD.CC', isCrypto: true }],
    bench: {
      stocks: [
        { symbol: 'DHR', isCrypto: false },
        { symbol: 'CEG', isCrypto: false, cooldownUntil: LATER },
        { symbol: 'PM', isCrypto: false, cooldownUntil: EARLIER },
      ],
      crypto: { symbol: 'ETH-USD.CC', isCrypto: true },
    },
    ...(over.portfolio || {}),
  },
  watchlist: { hotBench: ['PLTR', 'DHR'], ...(over.watchlist || {}) },
  agentContext: { equippedWatchlist: { watchlistId: 'w', tickers: ['SHOP'] } },
});

afterEach(() => { vi.useRealTimers(); });

describe('canComeIn — each reason (D-7)', () => {
  const ask = (inSymbol, out = 'AMD', slot = 'core', b = battle()) => canComeIn({ battle: b, out, slot, inSymbol, atMs: AT });

  it('a bench stock with no lock comes in for a held stock', () => {
    expect(ask('DHR')).toEqual({ ok: true });
  });
  it('pick_is_symbol: IN is OUT', () => {
    expect(ask('AMD')).toEqual({ ok: false, reason: 'pick_is_symbol' });
  });
  it('pick_already_held: IN sits in any tier of the book', () => {
    expect(ask('NVDA')).toEqual({ ok: false, reason: 'pick_already_held' });
    expect(ask('KO')).toEqual({ ok: false, reason: 'pick_already_held' });
  });
  it('pick_not_on_bench: the equipped watchlist alone does not count; an unknown name does not either', () => {
    expect(ask('SHOP')).toEqual({ ok: false, reason: 'pick_not_on_bench' });
    expect(ask('ZZZZ')).toEqual({ ok: false, reason: 'pick_not_on_bench' });
    expect(ask('')).toEqual({ ok: false, reason: 'pick_not_on_bench' });
    expect(ask(null)).toEqual({ ok: false, reason: 'pick_not_on_bench' });
  });
  it('the hot bench counts, and carries no cooldown', () => {
    expect(ask('PLTR')).toEqual({ ok: true });
  });
  it('pick_locked: a bench row whose cooldownUntil is after the instant; one before it is free', () => {
    expect(ask('CEG')).toEqual({ ok: false, reason: 'pick_locked' });
    expect(ask('PM')).toEqual({ ok: true });
    // The instant is the caller's: the same row is free once the instant passes its lock.
    expect(canComeIn({ battle: battle(), out: 'AMD', slot: 'core', inSymbol: 'CEG', atMs: Date.parse(LATER) + 1 })).toEqual({ ok: true });
    // Exactly at the lock end: not after → free (the executor's strict `>`).
    expect(canComeIn({ battle: battle(), out: 'AMD', slot: 'core', inSymbol: 'CEG', atMs: Date.parse(LATER) })).toEqual({ ok: true });
  });
  it('pick_wrong_class: crypto for a stock, a stock (or a hot-bench name) for crypto', () => {
    expect(ask('ETH-USD.CC')).toEqual({ ok: false, reason: 'pick_wrong_class' });
    expect(ask('DHR', 'BTC-USD.CC', 'support')).toEqual({ ok: false, reason: 'pick_wrong_class' });
    expect(ask('PLTR', 'BTC-USD.CC', 'support')).toEqual({ ok: false, reason: 'pick_wrong_class' });
    expect(ask('ETH-USD.CC', 'BTC-USD.CC', 'support')).toEqual({ ok: true });
  });
  it('the outgoing row reads crypto by a .CC suffix when it carries no isCrypto (agentSwapExecution.js:362)', () => {
    const b = battle({ portfolio: { support: [{ symbol: 'SOL-USD.CC' }] } });
    expect(ask('ETH-USD.CC', 'SOL-USD.CC', 'support', b)).toEqual({ ok: true });
    expect(ask('DHR', 'SOL-USD.CC', 'support', b)).toEqual({ ok: false, reason: 'pick_wrong_class' });
  });
  it('with no outgoing row in the book the class is not judged (the validator skips it, :73)', () => {
    expect(ask('ETH-USD.CC', 'GONE', 'core')).toEqual({ ok: true });
  });
  it('the order: a name that came into the book is pick_already_held, not pick_not_on_bench', () => {
    const b = battle({ portfolio: { core: [{ symbol: 'AMD', isCrypto: false }, { symbol: 'XYZ', isCrypto: false }] } });
    expect(ask('XYZ', 'AMD', 'core', b)).toEqual({ ok: false, reason: 'pick_already_held' });
  });
  it('the reason set is exactly the five D-7 names', () => {
    expect([...SWAPPABLE_REASONS].sort()).toEqual(['pick_already_held', 'pick_is_symbol', 'pick_locked', 'pick_not_on_bench', 'pick_wrong_class']);
  });
});

describe('the lists and the roster order', () => {
  it('swapListNames: bench stocks, then the crypto slot, then the hot bench, deduped — never the equipped watchlist', () => {
    expect(swapListNames(battle())).toEqual(['DHR', 'CEG', 'PM', 'ETH-USD.CC', 'PLTR']);
  });
  it('swappableNames keeps the passing names in roster order', () => {
    expect(swappableNames({ battle: battle(), out: 'AMD', slot: 'core', atMs: AT })).toEqual(['DHR', 'PM', 'PLTR']);
    expect(swappableNames({ battle: battle(), out: 'BTC-USD.CC', slot: 'support', atMs: AT })).toEqual(['ETH-USD.CC']);
  });
  it('an unreadable instant or cooldown locks nothing', () => {
    expect(benchRowLockedAt({ cooldownUntil: 'not a date' }, AT)).toBe(false);
    expect(benchRowLockedAt({ cooldownUntil: LATER }, Number.NaN)).toBe(false);
    expect(benchRowLockedAt({}, AT)).toBe(false);
  });
  it('freezeSwapBook keeps exactly what the test reads, frozen, and answers as the live battle does', () => {
    const live = battle();
    const book = freezeSwapBook(live);
    expect(Object.isFrozen(book)).toBe(true);
    expect(Object.isFrozen(book.portfolio.bench.stocks)).toBe(true);
    for (const inSymbol of [...swapListNames(live), 'NVDA', 'SHOP', 'AMD']) {
      for (const [out, slot] of [['AMD', 'core'], ['BTC-USD.CC', 'support'], ['KO', 'support']]) {
        expect(canComeIn({ battle: book, out, slot, inSymbol, atMs: AT })).toEqual(canComeIn({ battle: live, out, slot, inSymbol, atMs: AT }));
      }
    }
    // A later change to the live battle never reaches the frozen book.
    live.portfolio.bench.stocks.push({ symbol: 'NEW', isCrypto: false });
    expect(canComeIn({ battle: book, out: 'AMD', slot: 'core', inSymbol: 'NEW', atMs: AT }).reason).toBe('pick_not_on_bench');
  });
});

describe('PARITY with the executor\'s own validator (agentSwapExecution.js validateTradeDecision)', () => {
  // The validator's message for each reason (agentSwapExecution.js:52-80).
  const MESSAGE = {
    pick_not_on_bench: /not found in bench or watchlist/,
    pick_is_symbol: /cannot replace itself/,
    pick_already_held: /already occupies an active portfolio slot/,
    pick_locked: /is on 24h cooldown/,
    pick_wrong_class: /Cannot swap stock for crypto or vice versa/,
  };
  const OUTS = [['AMD', 'core'], ['KO', 'support'], ['BTC-USD.CC', 'support'], ['NVDA', 'star']];
  const INS = ['DHR', 'CEG', 'PM', 'ETH-USD.CC', 'PLTR', 'SHOP', 'ZZZZ', 'NVDA', 'AMD', 'KO', 'BTC-USD.CC', 'MSFT'];

  it('on every (OUT, IN) pair of the table, the two agree on "can it come in", and the reason is one the validator names', () => {
    vi.useFakeTimers();
    vi.setSystemTime(AT);
    const b = battle();
    let rows = 0;
    for (const [out, slot] of OUTS) {
      for (const inSymbol of INS) {
        const mine = canComeIn({ battle: b, out, slot, inSymbol, atMs: AT });
        const theirs = validateTradeDecision({ decision: 'SWAP', symbolOut: out, symbolIn: inSymbol, conviction: 90, hypothesis: 'a hypothesis long enough to pass' }, b);
        expect(mine.ok, `${out} → ${inSymbol}: ${JSON.stringify(theirs.errors)}`).toBe(theirs.valid);
        if (!mine.ok) expect(theirs.errors.some((e) => MESSAGE[mine.reason].test(e)), `${out} → ${inSymbol} ${mine.reason}: ${JSON.stringify(theirs.errors)}`).toBe(true);
        rows += 1;
      }
    }
    expect(rows).toBe(OUTS.length * INS.length);
  });

  it('the instant: the validator reads its wall clock; at the same instant the two agree on a lock either side of it', () => {
    vi.useFakeTimers();
    for (const t of [Date.parse(LATER) - 1, Date.parse(LATER) + 1]) {
      vi.setSystemTime(t);
      const mine = canComeIn({ battle: battle(), out: 'AMD', slot: 'core', inSymbol: 'CEG', atMs: t });
      const theirs = validateTradeDecision({ decision: 'SWAP', symbolOut: 'AMD', symbolIn: 'CEG', conviction: 90, hypothesis: 'a hypothesis long enough to pass' }, battle());
      expect(mine.ok).toBe(theirs.valid);
    }
  });
});
