/**
 * correlationGroup — pure group-primitive suite (V2 Build 6). Zero mocks: every
 * export is pure. Covers the moved validators (parseGroup/SYMBOL_RE parity), the
 * source normalizer + shaper (truncation order, crypto exclusion, null-on-empty),
 * the untrusted URL parser (valid → prefill; every invalid class → fully ignored),
 * the §9 provenance guard, and the provenance-line copy (variants + honesty adds).
 */
import { describe, it, expect } from 'vitest';
import {
  SYMBOL_RE,
  parseGroup,
  normalizeGroupSymbols,
  buildSourceGroup,
  tsToMs,
  parseLabPrefill,
  shouldShowProvenance,
  fmtAsOf,
  provenanceLineText,
} from './correlationGroup.js';

// Stub registry mirroring DRIVER_LABELS: real keys + CUSTOM (which must be
// hard-excluded from URL prefill even though it's a registry key).
const DRIVERS = { BRENT: 'Brent Crude', WTI: 'WTI', XLE: 'Energy', CUSTOM: 'Custom ticker…' };

describe('parseGroup — the RUN-path validator (moved verbatim)', () => {
  it('accepts a valid trio and a single ETF proxy', () => {
    expect(parseGroup('XOM, CVX, COP')).toEqual({ group: ['XOM', 'CVX', 'COP'] });
    expect(parseGroup('KBE')).toEqual({ group: ['KBE'] });
  });
  it('uppercases and dedupes, preserving insertion order', () => {
    expect(parseGroup('xom, XOM, cvx')).toEqual({ group: ['XOM', 'CVX'] });
  });
  it('rejects empty, > 10, and bad symbols', () => {
    expect(parseGroup('').error).toMatch(/1–10/);
    expect(parseGroup('A B C D E F G H I J K').error).toMatch(/1–10/);
    expect(parseGroup('XOM, 1BAD').error).toMatch(/Not a valid ticker: 1BAD/);
  });
  it('SYMBOL_RE matches the endpoint shape (letter-led, dotted allowed)', () => {
    expect(SYMBOL_RE.test('BRK.B')).toBe(true);
    expect(SYMBOL_RE.test('1AAA')).toBe(false);
    expect(SYMBOL_RE.test('AA$A')).toBe(false);
  });
});

describe('normalizeGroupSymbols — the SOURCE normalizer', () => {
  it('trims/uppercases/dedupes and partitions by validity', () => {
    expect(normalizeGroupSymbols(['xom', ' CVX ', 'xom', '1BAD'])).toEqual({
      valid: ['XOM', 'CVX'],
      invalid: ['1BAD'],
    });
  });
  it('does NOT reject a > 10 list (sources truncate, never reject)', () => {
    const many = Array.from({ length: 15 }, (_, i) => `SYM${i}`);
    expect(normalizeGroupSymbols(many).valid).toHaveLength(15);
  });
  it('tolerates empty / non-array input', () => {
    expect(normalizeGroupSymbols([])).toEqual({ valid: [], invalid: [] });
    expect(normalizeGroupSymbols(null)).toEqual({ valid: [], invalid: [] });
  });
});

describe('buildSourceGroup — the shared source shaper', () => {
  it('truncates to the first 10 equities and reports truncatedFrom', () => {
    const twelve = Array.from({ length: 12 }, (_, i) => `EQ${i}`);
    const g = buildSourceGroup(twelve, { label: 'My watchlist', asOf: 123 });
    expect(g.symbols).toHaveLength(10);
    expect(g.symbols[0]).toBe('EQ0'); // order preserved
    expect(g.truncatedFrom).toBe(12);
    expect(g.excludedCrypto).toEqual([]);
    expect(g).toMatchObject({ label: 'My watchlist', asOf: 123 });
  });
  it('excludes crypto (surfaced) and keeps equities only', () => {
    const g = buildSourceGroup(['XOM', 'BTC', 'CVX', 'ETH'], { label: 'x' });
    expect(g.symbols).toEqual(['XOM', 'CVX']);
    expect(g.excludedCrypto).toEqual(['BTC', 'ETH']);
    expect(g.truncatedFrom).toBe(2);
  });
  it('excludes BNB — in the agent crypto pool but NOT stockHelpers.isCrypto (leak guard)', () => {
    const g = buildSourceGroup(['NVDA', 'BNB', 'MSFT'], { label: 'x' });
    expect(g.symbols).toEqual(['NVDA', 'MSFT']);
    expect(g.excludedCrypto).toEqual(['BNB']);
  });
  it('counts truncatedFrom on EQUITIES only (crypto never inflates it)', () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `EQ${i}`);
    const g = buildSourceGroup(['BTC', ...eleven], { label: 'x' });
    expect(g.symbols).toHaveLength(10);
    expect(g.truncatedFrom).toBe(11);
    expect(g.excludedCrypto).toEqual(['BTC']);
  });
  it('returns null when nothing valid survives (no chip)', () => {
    expect(buildSourceGroup([], { label: 'x' })).toBeNull();
    expect(buildSourceGroup(['BTC', 'ETH'], { label: 'x' })).toBeNull();
    expect(buildSourceGroup(['1BAD'], { label: 'x' })).toBeNull();
  });
  it('passes agentName through when provided (book) and omits it otherwise', () => {
    expect(buildSourceGroup(['XOM'], { label: 'x', agentName: 'Viper' }).agentName).toBe('Viper');
    expect('agentName' in buildSourceGroup(['XOM'], { label: 'x' })).toBe(false);
  });
});

describe('tsToMs — timestamp normalizer', () => {
  it('handles number, ISO string, Date, Firestore Timestamp shapes, and null', () => {
    expect(tsToMs(123)).toBe(123);
    expect(tsToMs('2026-07-05T18:30:00Z')).toBe(Date.UTC(2026, 6, 5, 18, 30));
    expect(tsToMs(new Date(456))).toBe(456);
    expect(tsToMs({ toMillis: () => 789 })).toBe(789);
    expect(tsToMs({ seconds: 2 })).toBe(2000);
    expect(tsToMs({ _seconds: 3 })).toBe(3000); // serialized Admin-SDK Timestamp
    expect(tsToMs(null)).toBeNull();
    expect(tsToMs('not-a-date')).toBeNull();
  });
});

describe('parseLabPrefill — untrusted URL guard (valid → prefill; invalid → null)', () => {
  it('valid labGroup + registry labDriver → prefill', () => {
    expect(parseLabPrefill('?labGroup=XOM,CVX,COP&labDriver=BRENT', DRIVERS)).toEqual({
      groupInput: 'XOM, CVX, COP',
      driverKey: 'BRENT',
    });
  });
  it('(1) missing / empty labGroup → null', () => {
    expect(parseLabPrefill('?labDriver=BRENT', DRIVERS)).toBeNull();
    expect(parseLabPrefill('?labGroup=&labDriver=BRENT', DRIVERS)).toBeNull();
  });
  it('(2) any bad ticker → the whole set ignored', () => {
    expect(parseLabPrefill('?labGroup=XOM,1BAD&labDriver=BRENT', DRIVERS)).toBeNull();
  });
  it('(3) > 10 symbols → null', () => {
    expect(parseLabPrefill('?labGroup=A,B,C,D,E,F,G,H,I,J,K&labDriver=BRENT', DRIVERS)).toBeNull();
  });
  it('(4) unknown / missing driver → null (incl. prototype keys)', () => {
    expect(parseLabPrefill('?labGroup=XOM&labDriver=FAKE', DRIVERS)).toBeNull();
    expect(parseLabPrefill('?labGroup=XOM', DRIVERS)).toBeNull();
    expect(parseLabPrefill('?labGroup=XOM&labDriver=toString', DRIVERS)).toBeNull();
  });
  it('(5) CUSTOM is hard-excluded even when it is a registry key', () => {
    expect(parseLabPrefill('?labGroup=XOM&labDriver=CUSTOM', DRIVERS)).toBeNull();
  });
  it('garbage encoding never crashes — it just fails validation → null', () => {
    expect(parseLabPrefill('?labGroup=%&labDriver=BRENT', DRIVERS)).toBeNull();
    expect(parseLabPrefill('', DRIVERS)).toBeNull();
  });
});

describe('shouldShowProvenance — the §9 display-agreement guard', () => {
  it('true only while the line still describes the exact group in the box', () => {
    expect(shouldShowProvenance({ groupString: 'XOM, CVX' }, 'XOM, CVX')).toBe(true);
    expect(shouldShowProvenance({ groupString: 'XOM, CVX' }, 'XOM')).toBe(false); // edited
    expect(shouldShowProvenance(null, 'XOM')).toBe(false);
  });
});

describe('fmtAsOf — deterministic market-time stamp', () => {
  it('formats a ms epoch in America/New_York and empties on null', () => {
    const s = fmtAsOf(Date.UTC(2026, 6, 5, 18, 30)); // 14:30 EDT
    expect(s).toContain('Jul 5');
    expect(s).toContain('2:30');
    expect(fmtAsOf(null)).toBe('');
  });
});

describe('provenanceLineText — copy variants + honesty additions', () => {
  it('watchlist plain (singular/plural tickers)', () => {
    const t = provenanceLineText({ source: 'watchlist', label: 'your equipped watchlist', count: 3, asOf: Date.UTC(2026, 6, 5, 18, 30) });
    expect(t).toContain('Group: your equipped watchlist');
    expect(t).toContain('3 tickers');
    expect(t).toContain('as of Jul 5');
    expect(provenanceLineText({ source: 'watchlist', label: 'your equipped watchlist', count: 1 })).toContain('1 ticker');
  });
  it('omits the freshness clause entirely when asOf is absent (no dangling "as of")', () => {
    const t = provenanceLineText({ source: 'watchlist', label: 'your equipped watchlist', count: 3 });
    expect(t).not.toContain('as of');
    expect(t).toBe('Group: your equipped watchlist · 3 tickers');
  });
  it('book truncated → "10 largest of N"', () => {
    const t = provenanceLineText({ source: 'book', label: "Viper's current book", count: 10, truncatedFrom: 14 });
    expect(t).toContain('showing the 10 largest of 14');
  });
  it('watchlist truncated → "first 10 of N"', () => {
    const t = provenanceLineText({ source: 'watchlist', label: 'your equipped watchlist', count: 10, truncatedFrom: 13 });
    expect(t).toContain('showing the first 10 of 13');
  });
  it('crypto exclusion surfaced (singular/plural)', () => {
    expect(provenanceLineText({ source: 'watchlist', label: 'x', count: 2, excludedCrypto: ['BTC'] }))
      .toContain('1 non-equity position excluded — equities only for now');
    expect(provenanceLineText({ source: 'book', label: 'x', count: 2, excludedCrypto: ['BTC', 'ETH'] }))
      .toContain('2 non-equity positions excluded — equities only for now');
  });
  it('url → linked from elsewhere (no count/asOf)', () => {
    expect(provenanceLineText({ source: 'url' })).toBe('Group: linked from elsewhere');
  });
  it('never uses forecast vocabulary (honesty parity with the verdict suite)', () => {
    const t = provenanceLineText({ source: 'book', label: "Viper's current book", count: 10, truncatedFrom: 14, excludedCrypto: ['BTC'] });
    expect(t.toLowerCase()).not.toMatch(/predict|will likely|expect/);
  });
});
