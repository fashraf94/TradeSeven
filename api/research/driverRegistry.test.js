/**
 * driverRegistry sanity unit test (V2 Build 1). A tripwire against future
 * symbol-format drift and missing metadata: every entry carries the five
 * required fields + category, keys/symbols are unique, the category counts
 * match the pinned taxonomy, and EXACTLY ONE symbol escapes the .US/.INDX
 * equity/index convention — BTC-USD.CC. If a future edit fat-fingers a crypto
 * suffix (BTC.US) or forgets a category, this fails loudly and cheaply.
 */
import { describe, it, expect } from 'vitest';
import { CORRELATION_DRIVERS } from './driverRegistry.js';

const KNOWN_CATEGORIES = new Set(['macro', 'sector', 'factor', 'risk', 'digital']);
// V3 Sub-build 3 — extended tier: SMH (sector), CPER/FXY/EMLC (macro), TIP (risk)
// bump the per-category counts from the core 25 to 30.
const EXPECTED_PER_CATEGORY = { macro: 10, sector: 10, factor: 4, risk: 5, digital: 1 };
const TOTAL_EXPECTED = Object.values(EXPECTED_PER_CATEGORY).reduce((a, b) => a + b, 0); // 30
const EXPECTED_TIER_COUNTS = { core: 25, extended: 5 };
const EXPECTED_EXTENDED_KEYS = ['CPER', 'EMLC', 'FXY', 'SMH', 'TIP']; // sorted
// The pinned key set (spec-locked). Object-literal keys are inherently unique
// at runtime — a duplicate source key silently collapses to one property — so
// asserting Set(keys).size === keys.length is a tautology. Locking the EXACT
// key set instead makes "keys unique" real: a duplicate collapses to 29 keys
// and this set comparison fails loudly.
const EXPECTED_KEYS = [
  'BRENT', 'WTI', 'GOLD', 'VIX', 'TNX', 'DXY', 'SPX',
  'XLE', 'XLF', 'XLK', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLB',
  'MTUM', 'VLUE', 'QUAL', 'USMV',
  'HYG', 'TLT', 'IWM', 'RSP',
  'BTC',
  // Extended tier (opt-in):
  'SMH', 'CPER', 'FXY', 'TIP', 'EMLC',
];

describe('driverRegistry — shape + symbol-format sanity', () => {
  const entries = Object.entries(CORRELATION_DRIVERS);

  it(`has the expected number of entries (${TOTAL_EXPECTED})`, () => {
    expect(entries).toHaveLength(TOTAL_EXPECTED);
  });

  it('every entry carries the five required fields + a known category + a tier', () => {
    for (const [key, d] of entries) {
      expect(typeof d.symbol, key).toBe('string');
      expect(typeof d.label, key).toBe('string');
      expect(d.returnMode, key).toMatch(/^(pct|diff)$/);
      expect(typeof d.unit, key).toBe('string');
      expect(typeof d.betaInterpretation, key).toBe('string');
      expect(KNOWN_CATEGORIES.has(d.category), `${key} category=${d.category}`).toBe(true);
      expect(d.tier, `${key} tier=${d.tier}`).toMatch(/^(core|extended)$/);
    }
  });

  it('tier counts match the pinned split (25 core + 5 extended)', () => {
    const counts = {};
    for (const [, d] of entries) counts[d.tier] = (counts[d.tier] ?? 0) + 1;
    expect(counts).toEqual(EXPECTED_TIER_COUNTS);
  });

  it('exactly the five spec-locked extended-tier keys (drift tripwire)', () => {
    const extended = entries.filter(([, d]) => d.tier === 'extended').map(([k]) => k).sort();
    expect(extended).toEqual([...EXPECTED_EXTENDED_KEYS].sort());
  });

  it('every extended driver is a .US ETF on the standard pct path (the two-gate admission shape)', () => {
    for (const [key, d] of entries) {
      if (d.tier !== 'extended') continue;
      expect(d.symbol, key).toMatch(/\.US$/);
      expect(d.returnMode, key).toBe('pct');
      expect(d.unit, key).toBe('% change');
      expect(d.betaInterpretation, key).toBe(`group % move per 1% move in ${d.label}`);
      expect(d.scale, key).toBeUndefined();
    }
  });

  it('has exactly the pinned key set (a real duplicate/rename tripwire, not a tautology)', () => {
    expect([...Object.keys(CORRELATION_DRIVERS)].sort()).toEqual([...EXPECTED_KEYS].sort());
  });

  it('symbols are unique (no two drivers point at the same EODHD series)', () => {
    const symbols = entries.map(([, d]) => d.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
  });

  it('category counts match the pinned taxonomy', () => {
    const counts = {};
    for (const [, d] of entries) counts[d.category] = (counts[d.category] ?? 0) + 1;
    expect(counts).toEqual(EXPECTED_PER_CATEGORY);
  });

  it('exactly one symbol escapes the .US/.INDX convention — BTC-USD.CC (drift tripwire)', () => {
    const offbeat = entries.filter(([, d]) => !/\.(US|INDX)$/.test(d.symbol));
    expect(offbeat.map(([, d]) => d.symbol)).toEqual(['BTC-USD.CC']);
    expect(CORRELATION_DRIVERS.BTC.symbol).toBe('BTC-USD.CC');
  });

  it('the new (non-macro) drivers are pct / "% change" with a {label}-templated interpretation and no scale', () => {
    for (const [key, d] of entries) {
      if (d.category === 'macro') continue;
      expect(d.returnMode, key).toBe('pct');
      expect(d.unit, key).toBe('% change');
      expect(d.betaInterpretation, key).toBe(`group % move per 1% move in ${d.label}`);
      expect(d.scale, key).toBeUndefined();
    }
  });

  it('macro entries are unchanged in value (only category added)', () => {
    // Spot-check the anchors the boundary test also locks — the V1.1 macro
    // values must survive the category addition byte-for-byte.
    expect(CORRELATION_DRIVERS.BRENT).toMatchObject({
      symbol: 'BNO.US',
      label: 'Brent Crude (BNO proxy)',
      returnMode: 'pct',
      unit: '% change of BNO ETF',
      betaInterpretation: 'group % move per 1% move in BNO (Brent oil ETF proxy)',
      category: 'macro',
    });
    expect(CORRELATION_DRIVERS.TNX).toMatchObject({
      symbol: 'TNX.INDX',
      returnMode: 'diff',
      scale: 0.1,
      unit: 'yield points (pp)',
      category: 'macro',
    });
  });
});
