// api/_utils/tickerValidation.test.js
//
// Sprint 6 Phase 4.5a — downstream-effect coverage. validateTickers itself is
// unchanged in this phase, but the universe it consults now includes Tier 1
// sector ETFs and Tier 2 industry ETFs. These tests assert that ETFs are now
// validated (previously they would have been classified unsupported).

import { describe, it, expect } from 'vitest';
import { validateTickers, normalizeTicker } from './tickerValidation.js';

describe('validateTickers — Phase 4.5a ETF universe', () => {
  it('V-10 (industry ETF): SMH validates and maps to XLK', () => {
    const result = validateTickers(['SMH']);
    expect(result.validated).toEqual([{ symbol: 'SMH', sectorId: 'XLK' }]);
    expect(result.unsupported).toEqual([]);
  });

  it('V-10 (sector ETF): XLK validates and maps to XLK', () => {
    const result = validateTickers(['XLK']);
    expect(result.validated).toEqual([{ symbol: 'XLK', sectorId: 'XLK' }]);
    expect(result.unsupported).toEqual([]);
  });

  it('V-10 (stock regression): AAPL still validates and maps to XLK', () => {
    const result = validateTickers(['AAPL']);
    expect(result.validated).toEqual([{ symbol: 'AAPL', sectorId: 'XLK' }]);
    expect(result.unsupported).toEqual([]);
  });

  it('V-11: previously-rejected ETFs (ARKK, GK) still unsupported', () => {
    const result = validateTickers(['ARKK', 'GK']);
    expect(result.validated).toEqual([]);
    expect(result.unsupported).toEqual(['ARKK', 'GK']);
  });

  it('V-11 (dropped audit candidates): HACK, IAI, PEJ unsupported', () => {
    const result = validateTickers(['HACK', 'IAI', 'PEJ']);
    expect(result.validated).toEqual([]);
    expect(result.unsupported).toEqual(['HACK', 'IAI', 'PEJ']);
  });

  it('V-12: mixed input (stock + sector ETF + industry ETF + unsupported)', () => {
    const result = validateTickers(['AAPL', 'XLK', 'SMH', 'GK']);
    expect(result.validated).toHaveLength(3);
    expect(result.validated.map((v) => v.symbol).sort()).toEqual(['AAPL', 'SMH', 'XLK']);
    expect(result.unsupported).toEqual(['GK']);
  });

  it('normalization (BRK.B → BRK-B) still applies', () => {
    const result = validateTickers(['BRK.B']);
    expect(result.validated).toEqual([{ symbol: 'BRK-B', sectorId: 'XLF' }]);
    expect(result.unsupported).toEqual([]);
  });

  it('normalizeTicker exported helper preserves Phase 1 contract', () => {
    expect(normalizeTicker('brk.b')).toBe('BRK-B');
    expect(normalizeTicker('  smh  ')).toBe('SMH');
    expect(normalizeTicker('')).toBeNull();
    expect(normalizeTicker(null)).toBeNull();
  });
});
