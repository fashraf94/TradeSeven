// api/_utils/sharedResearch/everydayNames.test.js
//
// Research universe Build 3b, build prompt section 5.5 (RU-20): the everyday names list's own rules. A short,
// hand-typed, frozen list: at most 40; each name maps to exactly one symbol on the research list; whole companies only;
// no name is another listed company's own name or symbol; each has a one-line reason.

import { describe, it, expect } from 'vitest';
import { EVERYDAY_NAMES } from './everydayNames.js';
import { lookupKeyOf, lookupName, isEverydayNameOf } from './sessionUniverse.js';
import { researchUniverse, researchNameOf } from '../researchUniverse.js';
import { RESEARCH_DIRECTORY } from '../researchDirectory.js';
import { ALL_TICKERS } from '../rankingConfig.js';
import { COMPANY_NAMES } from '../../../src/config/stockData.js';

const ALL_SYMBOLS = [...ALL_TICKERS, ...Object.keys(RESEARCH_DIRECTORY)];

describe('the list (RU-20)', () => {
  it('is frozen, at most 40 entries, each [name, symbol, reason] with a one-line reason', () => {
    expect(Object.isFrozen(EVERYDAY_NAMES)).toBe(true);
    expect(EVERYDAY_NAMES.length).toBeGreaterThan(0);
    expect(EVERYDAY_NAMES.length).toBeLessThanOrEqual(40);
    for (const row of EVERYDAY_NAMES) {
      expect(Object.isFrozen(row)).toBe(true);
      expect(row).toHaveLength(3);
      const [name, symbol, why] = row;
      expect(typeof name === 'string' && name.trim() === name && name.length > 1, name).toBe(true);
      expect(typeof symbol).toBe('string');
      expect(typeof why === 'string' && why.length > 10 && !why.includes('\n'), name).toBe(true);
    }
  });
  it('each name maps to one symbol on the research list (the 228 or the directory), not retired', () => {
    for (const [name, symbol] of EVERYDAY_NAMES) {
      expect(researchUniverse.has(symbol), `${name} → ${symbol}`).toBe(true);
      expect(researchUniverse.retired(symbol), `${name} → ${symbol}`).toBe(false);
    }
  });
  it('no name appears twice (as the lookup compares names)', () => {
    const keys = EVERYDAY_NAMES.map(([name]) => lookupKeyOf(name));
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("no everyday name is another listed company's own name: no directory company other than its own has that core name", () => {
    for (const [name, symbol] of EVERYDAY_NAMES) {
      const key = lookupKeyOf(name);
      const others = Object.entries(RESEARCH_DIRECTORY).filter(([s, [n]]) => s !== symbol && lookupKeyOf(n) === key).map(([s]) => s);
      expect(others, name).toEqual([]);
    }
  });
  it('…nor, as far as the code holds the 228\'s names (src/config/stockData.js COMPANY_NAMES), a game company\'s other than its own', () => {
    expect(Object.keys(COMPANY_NAMES).length).toBeGreaterThan(100);
    for (const [name, symbol] of EVERYDAY_NAMES) {
      const key = lookupKeyOf(name);
      const others = Object.entries(COMPANY_NAMES).filter(([s, n]) => s !== symbol && lookupKeyOf(n) === key).map(([s]) => s);
      expect(others, name).toEqual([]);
    }
  });
  it("no everyday name is another company's symbol (in any case)", () => {
    for (const [name, symbol] of EVERYDAY_NAMES) {
      const spelled = name.trim().toUpperCase().replace(/\./g, '-');
      const clash = ALL_SYMBOLS.filter((s) => s === spelled && s !== symbol);
      expect(clash, name).toEqual([]);
    }
  });
  it('whole companies only: no product, brand or division words among the names', () => {
    const NOT_COMPANIES = /\b(?:iphone|instagram|whatsapp|youtube|aws|azure|chase|square|cash\s*app|temu|coke|pepsi|xbox|android|gmail)\b/i;
    for (const [name] of EVERYDAY_NAMES) expect(NOT_COMPANIES.test(name), name).toBe(false);
  });
});

describe('the lookup reads it', () => {
  it('"Google" resolves to GOOGL, "TSMC" to TSM, "Facebook" to META, written any case', () => {
    expect(lookupName('Google')).toBe('GOOGL');
    expect(lookupName('google')).toBe('GOOGL');
    expect(lookupName('TSMC')).toBe('TSM');
    expect(lookupName('Facebook')).toBe('META');
    expect(isEverydayNameOf('Google', 'GOOGL')).toBe(true);
    expect(isEverydayNameOf('Google', 'GOOG')).toBe(false);
    expect(isEverydayNameOf('Alphabet', 'GOOGL')).toBe(false);
  });
  it('every entry resolves through the lookup to its own symbol (no collision hides one)', () => {
    for (const [name, symbol] of EVERYDAY_NAMES) expect(lookupName(name), name).toBe(symbol);
  });
  it('a directory company named exactly resolves too ("Corning", "Corning Incorporated" → GLW)', () => {
    expect(researchNameOf('GLW')).toBe('Corning Incorporated');
    expect(lookupName('Corning')).toBe('GLW');
    expect(lookupName('Corning Incorporated')).toBe('GLW');
    expect(lookupName('Corning Inc.')).toBe('GLW');
  });
});
