// src/data/battleUniverse.test.js
//
// Phase C §1 — the battle's universe (D-116). The set the research route
// validates a requested symbol against, and the set the Bench pane renders.

import { describe, it, expect } from 'vitest';
import {
  selectBookSymbols,
  selectBenchRoster,
  selectBattleUniverse,
  isInBattleUniverse,
  canonicalUniverseSymbol,
  universePlace,
  UNIVERSE_PLACE,
} from './battleUniverse';
// THE SAME two selectors, through the module the Bench pane imports. One
// derivation, two readers (BUILD_RULES §9) — if `selectBench.js` ever grew its
// own copy of the union these rows would still pass while the two surfaces
// silently disagreed, so they are compared by IDENTITY below, not by result.
import { selectBookSymbols as benchBook, selectBenchRoster as benchRoster } from '../screens/battleView/selectBench';

const BATTLE = {
  portfolio: {
    star: [{ symbol: 'NVDA' }, { symbol: 'AVGO' }],
    core: [{ symbol: 'MSFT' }],
    support: ['KO'],
    bench: { stocks: [{ symbol: 'MPC' }, 'SOFI'], crypto: { symbol: 'BTC' } },
  },
  watchlist: { hotBench: ['RKLB', 'MPC'] },
  agentContext: { equippedWatchlist: { tickers: ['LLY', 'NVDA'] } },
};

describe('the book', () => {
  it('is every piece with a row, across the three tiers, in both persisted shapes', () => {
    expect([...selectBookSymbols(BATTLE)]).toEqual(['NVDA', 'AVGO', 'MSFT', 'KO']);
  });

  it('is empty for a battle with no portfolio, and never throws on rubbish', () => {
    expect([...selectBookSymbols(null)]).toEqual([]);
    expect([...selectBookSymbols({})]).toEqual([]);
    expect([...selectBookSymbols({ portfolio: { star: 'NVDA' } })]).toEqual([]);
  });
});

describe('the bench roster', () => {
  it('is the three lists in LIST ORDER, minus the book, deduped', () => {
    expect(selectBenchRoster(BATTLE)).toEqual(['MPC', 'SOFI', 'BTC', 'RKLB', 'LLY']);
  });

  it('drops a name the book already holds (NVDA is equipped AND on the board)', () => {
    expect(selectBenchRoster(BATTLE)).not.toContain('NVDA');
  });
});

describe('the universe', () => {
  it('is the book first, then the bench roster', () => {
    expect(selectBattleUniverse(BATTLE)).toEqual(['NVDA', 'AVGO', 'MSFT', 'KO', 'MPC', 'SOFI', 'BTC', 'RKLB', 'LLY']);
  });

  it('admits a name in any case or with whitespace, and gives back the DOC’s spelling', () => {
    expect(isInBattleUniverse(BATTLE, 'mpc')).toBe(true);
    expect(isInBattleUniverse(BATTLE, '  MPC ')).toBe(true);
    expect(canonicalUniverseSymbol(BATTLE, 'mpc')).toBe('MPC');
  });

  it('refuses a name the battle does not hold, and every non-string (hazard 6)', () => {
    expect(isInBattleUniverse(BATTLE, 'TSLA')).toBe(false);
    expect(canonicalUniverseSymbol(BATTLE, 'TSLA')).toBeNull();
    for (const junk of [null, undefined, '', '   ', 42, {}, ['MPC']]) {
      expect(isInBattleUniverse(BATTLE, junk)).toBe(false);
    }
    expect(isInBattleUniverse(null, 'MPC')).toBe(false);
  });
});

describe('where a name sits — the card’s standing section (§3)', () => {
  it('names the book, the persisted bench (crypto included) and the watchlist half apart', () => {
    expect(universePlace(BATTLE, 'NVDA')).toBe(UNIVERSE_PLACE.BOOK);
    expect(universePlace(BATTLE, 'MPC')).toBe(UNIVERSE_PLACE.BENCH);
    expect(universePlace(BATTLE, 'BTC')).toBe(UNIVERSE_PLACE.BENCH);
    expect(universePlace(BATTLE, 'RKLB')).toBe(UNIVERSE_PLACE.WATCHLIST);
    expect(universePlace(BATTLE, 'LLY')).toBe(UNIVERSE_PLACE.WATCHLIST);
    expect(universePlace(BATTLE, 'TSLA')).toBeNull();
  });
});

describe('ONE derivation (BUILD_RULES §9)', () => {
  it('the Bench pane’s selectors ARE these functions, not a second copy', () => {
    expect(benchBook).toBe(selectBookSymbols);
    expect(benchRoster).toBe(selectBenchRoster);
  });
});
