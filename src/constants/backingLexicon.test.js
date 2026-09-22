// src/constants/backingLexicon.test.js — the one matcher, both ways.
import { describe, it, expect } from 'vitest';
import { FORBIDDEN_TERMS } from './backing';
import { findForbiddenTerm, forbiddenTermRegExp } from './backingLexicon';

describe('the backing lexicon matcher', () => {
  it('matches every forbidden term as a whole word, in any case, with multi-word spacing', () => {
    for (const term of FORBIDDEN_TERMS) expect(findForbiddenTerm(`Never ${term.toUpperCase()} here.`)).toBe(term);
    expect(findForbiddenTerm('Time to cash   out now')).toBe('cash out');
  });

  it('matches the plain inflections — the diversifier’s "bets", "betting", "bettor", "wagered", "gambling"', () => {
    expect(findForbiddenTerm('Spreads the bets so no single one can sink you.')).toBe('bet');
    expect(findForbiddenTerm('No betting.')).toBe('bet');
    expect(findForbiddenTerm('A bettor’s market.')).toBe('bet');
    expect(findForbiddenTerm('They wagered it all.')).toBe('wager');
    expect(findForbiddenTerm('Gambling on breadth.')).toBe('gamble');
    expect(findForbiddenTerm('Plays the odds.')).toBe('odds');
  });

  it('never matches inside another word — "better", "between", "beta", "alphabet" are clean', () => {
    for (const clean of ['A better week.', 'Reads between the lines.', 'The beta terms.', 'An alphabet of names.', 'Winning money is not the point.']) {
      expect(findForbiddenTerm(clean), clean).toBeNull();
    }
    expect(findForbiddenTerm('')).toBeNull();
    expect(findForbiddenTerm(null)).toBeNull();
  });

  it('forbiddenTermRegExp is the regexp findForbiddenTerm uses', () => {
    expect(forbiddenTermRegExp('bet').test('bets')).toBe(true);
    expect(forbiddenTermRegExp('bet').test('better')).toBe(false);
  });
});
