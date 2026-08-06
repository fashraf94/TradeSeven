// api/_utils/unitsLint.test.js
// Alex Catalyst Confirmation mini-arc (spec V1.1) — F3 acceptance (R5).
// POSITIVE rows hold; NEGATIVE (boundary-defense) rows pass. The negatives are
// what earn the narrowness claim — mutation checks below prove each exclusion
// is load-bearing.

import { describe, it, expect } from 'vitest';
import { lintUnits, lintStoryUnits } from './unitsLint.js';

describe('R5 positive — the belt HOLDS the defect', () => {
  it('the actual Jul 31 headline holds (units_collision)', () => {
    const r = lintUnits('Alphabet Crashes on Unidentified Catalyst, Wiping $20 BaggerBomb Points');
    expect(r.held).toBe(true);
    expect(r.code).toBe('units_collision');
    expect(r.violations.some((v) => v.pattern === 'currency_attached_points')).toBe(true);
  });

  it('the no-dollar-sign half holds by pattern 2 ("Wiping 20 BaggerBomb Points")', () => {
    const r = lintUnits('Wiping 20 BaggerBomb Points');
    expect(r.held).toBe(true);
    expect(r.violations.some((v) => v.pattern === 'numeral_baggerbomb_points')).toBe(true);
  });

  it('a bare currency-attached points phrase holds ("$30 points")', () => {
    expect(lintUnits('The crash cost holders $30 points on the board.').held).toBe(true);
  });
});

describe('R5 negative — boundary defense, these PASS', () => {
  it('"Shares fell $4 after gross margin dropped 2 percentage points" passes', () => {
    expect(lintUnits('Shares fell $4 after gross margin dropped 2 percentage points').held).toBe(false);
  });

  it('"GOOGL shed $18 while the Dow lost 300 points" passes', () => {
    expect(lintUnits('GOOGL shed $18 while the Dow lost 300 points').held).toBe(false);
  });

  it('basis points near a dollar figure passes', () => {
    expect(lintUnits('The Fed held; $2B in flows chased the 25 basis points cut').held).toBe(false);
  });

  it('a clean $17.98 price headline passes', () => {
    expect(lintUnits('Alphabet Slides $17.98 as Traders Reprice the Tape').held).toBe(false);
  });

  it('a qualitative game-relevance line passes', () => {
    expect(lintUnits('This one stings BaggerBomb players holding GOOGL into the close.').held).toBe(false);
  });
});

describe('R5 mutation guards — each exclusion is load-bearing', () => {
  it('the "percentage points" negative WOULD hold without the lookbehind (the exclusion matters)', () => {
    // Same sentence, minus the word "percentage" → now a real currency+points fusion.
    expect(lintUnits('Shares fell $4 after margin dropped 2 points').held).toBe(true);
  });

  it('the Dow negative WOULD hold without the index-family guard', () => {
    // Same shape, index word removed → no legitimizing context left.
    expect(lintUnits('GOOGL shed $18 while the desk lost 300 points').held).toBe(true);
  });
});

describe('lintStoryUnits over prose fields', () => {
  it('flags a collision anywhere in headline/subheadline/body', () => {
    const r = lintStoryUnits({
      headline: 'Alphabet Crashes',
      subheadline: 'Unidentified catalyst',
      body: 'The move wiped $20 BaggerBomb Points from holders.',
    });
    expect(r.held).toBe(true);
  });

  it('passes a clean story', () => {
    const r = lintStoryUnits({
      headline: 'Alphabet Slides $17.98',
      subheadline: 'Sellers press the tape',
      body: 'This hits BaggerBomb players holding GOOGL. The Dow lost 300 points in sympathy.',
    });
    expect(r.held).toBe(false);
  });
});
