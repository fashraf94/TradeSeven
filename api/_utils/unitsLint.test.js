// api/_utils/unitsLint.test.js
// Alex Catalyst Confirmation mini-arc (spec V1.1) — F3 acceptance (R5).
// POSITIVE rows hold; NEGATIVE (boundary-defense) rows pass. The negatives
// earn the narrowness claim; the mutation guards prove the ADJACENCY boundary
// is load-bearing (a wider pattern would hold legit financial prose).

import { describe, it, expect } from 'vitest';
import { lintUnits, lintStoryUnits } from './unitsLint.js';

describe('R5 positive — the belt HOLDS the defect', () => {
  it('the actual Jul 31 headline holds (units_collision)', () => {
    const r = lintUnits('Alphabet Crashes on Unidentified Catalyst, Wiping $20 BaggerBomb Points');
    expect(r.held).toBe(true);
    expect(r.code).toBe('units_collision');
  });

  it('the no-dollar-sign half holds by pattern 2, case-insensitively', () => {
    expect(lintUnits('Wiping 20 BaggerBomb Points').held).toBe(true);
    expect(lintUnits('Wiping 20 BAGGERBOMB POINTS').held).toBe(true);   // casing cannot slip
    expect(lintUnits('wiping 20 baggerbomb points').held).toBe(true);
  });

  it('a bare currency-attached points phrase holds ("$30 points")', () => {
    expect(lintUnits('The crash cost holders $30 points on the board.').held).toBe(true);
  });
});

describe('R5 negative — boundary defense, these PASS (no false-positive holds)', () => {
  const passes = [
    'Shares fell $4 after gross margin dropped 2 percentage points',
    'GOOGL shed $18 while the Dow lost 300 points',
    'The Fed held; $2B in flows chased the 25 basis points cut',
    'The Fed held; $2B chased the 25 basis-points move',           // hyphen — no whitespace lookbehind to defeat
    'Alphabet Slides $17.98 as Traders Reprice the Tape',
    'This one stings BaggerBomb players holding GOOGL into the close.',
    'Shares were up $12 at one point during the session.',          // "$X ... point" idiom
    'GOOGL defended its $2,910 price point before fading.',         // "price point"
    'The stock made a $5 move, and that was the whole point.',
  ];
  for (const s of passes) {
    it(`passes: ${s.slice(0, 48)}…`, () => expect(lintUnits(s).held).toBe(false));
  }
});

describe('R5 mutation guards — the adjacency boundary is load-bearing', () => {
  it('a non-adjacent "$…point" is NOT held (a wider window would false-positive here)', () => {
    // If pattern 1 allowed a gap, all of these would hold. They must not.
    expect(lintUnits('$50 price point').held).toBe(false);
    expect(lintUnits('$12 at one point').held).toBe(false);
    expect(lintUnits('$4 after margin dropped 2 percentage points').held).toBe(false);
  });
  it('adjacency IS what fires the positive ("$20 points")', () => {
    expect(lintUnits('$20 points').held).toBe(true);
    expect(lintUnits('$20 the points').held).toBe(false); // a word between → not a collision
  });
});

describe('lintStoryUnits over ALL prose fields incl. pullquote', () => {
  it('flags a collision in the pullquote (a model-authored field the belt must cover)', () => {
    const r = lintStoryUnits({
      headline: 'Alphabet Crashes',
      subheadline: 'Unidentified catalyst',
      body: 'Sellers pressed the tape into the close.',
      pullquote: 'Wiping $20 BaggerBomb Points.',
    });
    expect(r.held).toBe(true);
  });

  it('passes a clean story across all fields', () => {
    const r = lintStoryUnits({
      headline: 'Alphabet Slides $17.98',
      subheadline: 'Sellers press the tape',
      body: 'This hits BaggerBomb players holding GOOGL. The Dow lost 300 points in sympathy.',
      pullquote: 'The bid just evaporated.',
    });
    expect(r.held).toBe(false);
  });
});
