// src/screens/battleView/deriveBaggerMoment.test.js
//
// A3.6 (D-97) — the bagger moment's derivation. The seed's rows: fires once per
// crossing, a re-render does not re-fire, and never on mount.
//
// Timing is asserted NOWHERE (hazard 47). This file is about which crossings
// exist; the window they live in is the hook's, and the paint is the row's.

import { describe, it, expect, vi } from 'vitest';
import {
  deriveBaggerCrossings,
  baggerMomentFacts,
  persistedMaxMultiplier,
  BAGGER_LINE,
} from './deriveBaggerMoment';
import { THRESHOLD_MULTIPLIERS, CONVICTION_MULTIPLIERS } from '../../constants/baggerBombScoring';

const doc = (history) => ({ thresholdHistory: history });
const book = (...symbols) => symbols.map((symbol) => ({ symbol }));

describe('the line is the canonical one, never a local copy', () => {
  it('is THRESHOLD_MULTIPLIERS.bagger itself', () => {
    expect(BAGGER_LINE).toBe(THRESHOLD_MULTIPLIERS.bagger);
    expect(BAGGER_LINE).toBe(1.0);
  });

  it('…and TRACKS it — the row above compares values, which a copy would pass', async () => {
    // The review (lens 4) mutated `BAGGER_LINE` to the literal `1.0` and the
    // whole file stayed green: a local copy carrying the same number has the
    // same value, so a value comparison guards drift and not the copying
    // BUILD_RULES §4 forbids. This moves the constant instead and watches the
    // module follow — which only a real import can do.
    vi.resetModules();
    vi.doMock('../../constants/baggerBombScoring', () => ({
      THRESHOLD_MULTIPLIERS: { bagger: 3.3 },
      CONVICTION_MULTIPLIERS: { star: 2, core: 1.5, support: 1 },
    }));
    const m = await import('./deriveBaggerMoment');
    expect(m.BAGGER_LINE).toBe(3.3);
    // …and the derivation uses the moved line, so 1.5 is no longer a crossing.
    expect(m.deriveBaggerCrossings({ NVDA: 0 }, doc({ NVDA: { maxMultiplier: 1.5 } }), book('NVDA')).crossed)
      .toEqual([]);
    expect(m.deriveBaggerCrossings({ NVDA: 0 }, doc({ NVDA: { maxMultiplier: 3.4 } }), book('NVDA')).crossed)
      .toEqual(['NVDA']);
    vi.doUnmock('../../constants/baggerBombScoring');
    vi.resetModules();
  });
});

describe('persistedMaxMultiplier reads the record, and reads nothing as zero', () => {
  it('takes the persisted peak', () => {
    expect(persistedMaxMultiplier(doc({ NVDA: { maxMultiplier: 1.4 } }), 'NVDA')).toBe(1.4);
  });

  it('is 0 — never null — for a symbol with no history, and for no doc at all', () => {
    // A null would make every comparison silently false, INCLUDING the seed,
    // and the first tick that wrote a history would then announce a crossing
    // that had already happened.
    expect(persistedMaxMultiplier(doc({}), 'NVDA')).toBe(0);
    expect(persistedMaxMultiplier(null, 'NVDA')).toBe(0);
    expect(persistedMaxMultiplier(doc({ NVDA: {} }), 'NVDA')).toBe(0);
    expect(persistedMaxMultiplier(doc({ NVDA: { maxMultiplier: null } }), 'NVDA')).toBe(0);
    expect(persistedMaxMultiplier(doc({ NVDA: { maxMultiplier: NaN } }), 'NVDA')).toBe(0);
  });
});

describe('NEVER ON MOUNT — the first pass seeds and says nothing', () => {
  it('a piece already above the line on the first snapshot does not announce', () => {
    // The useLandingKey idiom. This is also why a reload cannot re-announce
    // yesterday's bagger: it re-seeds from a doc that already reads >= 1.0.
    const { crossed, next } = deriveBaggerCrossings(null, doc({ NVDA: { maxMultiplier: 1.6 } }), book('NVDA'));
    expect(crossed).toEqual([]);
    expect(next).toEqual({ NVDA: 1.6 });
  });

  it('…and the seeded map is what stops the SECOND pass announcing it either', () => {
    const first = deriveBaggerCrossings(null, doc({ NVDA: { maxMultiplier: 1.6 } }), book('NVDA'));
    const second = deriveBaggerCrossings(first.next, doc({ NVDA: { maxMultiplier: 1.9 } }), book('NVDA'));
    expect(second.crossed).toEqual([]);
  });
});

describe('the crossing itself', () => {
  it('fires when the persisted peak goes from below the line to on it', () => {
    const seen = { NVDA: 0.8 };
    expect(deriveBaggerCrossings(seen, doc({ NVDA: { maxMultiplier: 1.0 } }), book('NVDA')).crossed)
      .toEqual(['NVDA']);
  });

  it('does not fire while the peak is still below the line', () => {
    expect(deriveBaggerCrossings({ NVDA: 0.2 }, doc({ NVDA: { maxMultiplier: 0.99 } }), book('NVDA')).crossed)
      .toEqual([]);
  });

  it('FIRES ONCE — the next pass over the same crossing is silent', () => {
    const one = deriveBaggerCrossings({ NVDA: 0.8 }, doc({ NVDA: { maxMultiplier: 1.2 } }), book('NVDA'));
    expect(one.crossed).toEqual(['NVDA']);
    const two = deriveBaggerCrossings(one.next, doc({ NVDA: { maxMultiplier: 1.2 } }), book('NVDA'));
    expect(two.crossed).toEqual([]);
    // …and it stays silent as the peak keeps rising, because it is monotonic
    // and the line is behind it now.
    const three = deriveBaggerCrossings(two.next, doc({ NVDA: { maxMultiplier: 2.4 } }), book('NVDA'));
    expect(three.crossed).toEqual([]);
  });

  it('A RE-RENDER DOES NOT RE-FIRE — the same doc compared again is silent', () => {
    const battle = doc({ NVDA: { maxMultiplier: 1.2 } });
    const one = deriveBaggerCrossings({ NVDA: 0 }, battle, book('NVDA'));
    expect(one.crossed).toEqual(['NVDA']);
    expect(deriveBaggerCrossings(one.next, battle, book('NVDA')).crossed).toEqual([]);
  });

  it('announces two pieces crossing on one tick, in BOOK order', () => {
    const { crossed } = deriveBaggerCrossings(
      { AAPL: 0.4, NVDA: 0.9 },
      doc({ AAPL: { maxMultiplier: 1.1 }, NVDA: { maxMultiplier: 1.3 } }),
      book('NVDA', 'AAPL'),
    );
    expect(crossed).toEqual(['NVDA', 'AAPL']);
  });
});

describe('the BOOK is the iteration, not the history map', () => {
  it('a piece the player no longer holds never announces', () => {
    // The cron never deletes a history entry (agent-daily-scores.js calls them
    // "stale"), so walking the map would announce a bagger for a piece that has
    // been swapped out — with a row nowhere on the board to burst.
    const { crossed, next } = deriveBaggerCrossings(
      { GILD: 0.5 },
      doc({ GILD: { maxMultiplier: 1.8 }, NVDA: { maxMultiplier: 0.2 } }),
      book('NVDA'),
    );
    expect(crossed).toEqual([]);
    expect(next).toEqual({ NVDA: 0.2 });
    expect(next.GILD).toBeUndefined();
  });

  it('a piece swapped IN above the line announces — it crossed on our watch', () => {
    // It arrives with a zero-reset entry (agent-evaluate.js:895-899) and seeds
    // at 0 for this reader; the tick that brought it in is the tick it crossed.
    const { crossed } = deriveBaggerCrossings({ NVDA: 0.3 }, doc({ MU: { maxMultiplier: 1.4 } }), book('NVDA', 'MU'));
    expect(crossed).toEqual(['MU']);
  });

  it('skips cash and blank slots, and never announces one symbol twice', () => {
    const { crossed, next } = deriveBaggerCrossings(
      { NVDA: 0 },
      doc({ NVDA: { maxMultiplier: 1.5 } }),
      [null, { isCash: true, symbol: 'CASH' }, { symbol: 'NVDA' }, { symbol: 'NVDA' }, {}],
    );
    expect(crossed).toEqual(['NVDA']);
    expect(next).toEqual({ NVDA: 1.5 });
  });

  it('an empty book is an empty answer, not a throw', () => {
    expect(deriveBaggerCrossings({}, doc({ NVDA: { maxMultiplier: 2 } }), [])).toEqual({ crossed: [], next: {} });
    expect(deriveBaggerCrossings({}, null, null)).toEqual({ crossed: [], next: {} });
  });
});

describe('the moment\'s two numbers come off the ROW, never re-derived', () => {
  it('takes the CONVICTION tier multiplier and the row\'s own baseATR', () => {
    // Ruling 8: `{mult}` is the tier multiplier the player is playing for
    // (2× / 1.5× / 1×), not the threshold multiplier that shares the word.
    // Ruling 9: `{pct}` is the bagger LINE, the persisted `baseATR`.
    expect(baggerMomentFacts({ baseATR: 7.4 }, 'star')).toEqual({ mult: CONVICTION_MULTIPLIERS.star, pct: 7.4 });
    expect(baggerMomentFacts({ baseATR: 2.5 }, 'core')).toEqual({ mult: 1.5, pct: 2.5 });
    expect(baggerMomentFacts({ baseATR: 5 }, 'support')).toEqual({ mult: 1, pct: 5 });
  });

  it('prefers the tier the BOARD passed over one the persisted entry carried', () => {
    // enrichAsset takes the tier as an argument and does not return it, so
    // `asset.tier` is whatever the doc happened to hold. The board cannot be
    // wrong about which row it is rendering.
    expect(baggerMomentFacts({ baseATR: 3, tier: 'support' }, 'star').mult).toBe(2);
  });

  it('falls back to the asset\'s own tier when the board passes none', () => {
    expect(baggerMomentFacts({ baseATR: 3, tier: 'core' }).mult).toBe(1.5);
  });

  it('is NULL — never a guess — when either number is unusable', () => {
    expect(baggerMomentFacts(null, 'star')).toBeNull();
    expect(baggerMomentFacts({ baseATR: 7.4 }, 'nonsense')).toBeNull();
    expect(baggerMomentFacts({ baseATR: 7.4 })).toBeNull();
    expect(baggerMomentFacts({ baseATR: 0 }, 'star')).toBeNull();
    expect(baggerMomentFacts({ baseATR: -2 }, 'star')).toBeNull();
    expect(baggerMomentFacts({}, 'star')).toBeNull();
    expect(baggerMomentFacts({ baseATR: NaN }, 'star')).toBeNull();
  });
});

describe('the two numbers, after the review', () => {
  it('takes the per-asset tierMultiplier the SCORER honours, not the tier key alone', () => {
    // P4 flat6 stamps `tierMultiplier` per asset on League Tournament docs, and
    // agentScoring.js:267 resolves `asset.tierMultiplier ?? CONVICTION[tier]`.
    // Reading the key alone banked a tournament star piece at 1× and told the
    // player 2× — the §9 bug family, from the row's own two sources.
    expect(baggerMomentFacts({ baseATR: 2.5, tierMultiplier: 1 }, 'star').mult).toBe(1);
    expect(baggerMomentFacts({ baseATR: 2.5, tierMultiplier: 1.5 }, 'support').mult).toBe(1.5);
    // …and a tiered doc carries no stamp, so nothing changes for it.
    expect(baggerMomentFacts({ baseATR: 2.5 }, 'star').mult).toBe(2);
  });

  it('refuses a SHORT, exactly as deriveTierPrices does', () => {
    // A short's bagger is a price decrease, so `+{baseATR}%` is the wrong sign.
    expect(baggerMomentFacts({ baseATR: 2.5, direction: 'short' }, 'star')).toBeNull();
    expect(baggerMomentFacts({ baseATR: 2.5, direction: 'long' }, 'star')).not.toBeNull();
  });
});
