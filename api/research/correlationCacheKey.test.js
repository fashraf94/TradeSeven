/**
 * The deep-dive cache-key rule — ONE canonicalization + defaulting + hash, so the
 * key a deep dive writes under and the key the narrate fallback re-derives can
 * never drift (the bug: analysis omitted lookbackDays, narrate sent it explicitly).
 */
import { describe, it, expect } from 'vitest';
import { deriveDeepDiveKey, deepDiveDocId, isValidDocId, LOOKBACK } from './correlationCacheKey.js';

describe('deriveDeepDiveKey — no defaulting drift', () => {
  it('omitting lookbackDays and sending the default produce the SAME docId (the exact drift)', () => {
    const omitted = deriveDeepDiveKey({ group: ['XOM', 'CVX'], driver: 'BRENT' });
    const explicit = deriveDeepDiveKey({ group: ['XOM', 'CVX'], driver: 'BRENT', lookbackDays: LOOKBACK.DEFAULT });
    expect(omitted.lookbackDays).toBe(LOOKBACK.DEFAULT);
    expect(omitted.docId).toBe(explicit.docId);
  });

  it('canonicalizes group (case / .US / dedupe / order) before hashing', () => {
    const a = deriveDeepDiveKey({ group: ['xom', 'CVX.US', 'XOM'], driver: 'BRENT' });
    const b = deriveDeepDiveKey({ group: ['CVX', 'XOM'], driver: 'BRENT' });
    expect(a.docId).toBe(b.docId);
  });

  it('docId equals the raw deepDiveDocId over the canonical params', () => {
    const k = deriveDeepDiveKey({ group: ['CVX', 'XOM'], driver: 'BRENT', lookbackDays: 504 });
    expect(k.docId).toBe(deepDiveDocId({ group: ['XOM', 'CVX'], driverKey: 'BRENT', customSymbol: '', lookbackDays: 504 }));
  });

  it('CUSTOM folds the canonical custom symbol into the key', () => {
    const k = deriveDeepDiveKey({ group: ['CVX'], driver: 'CUSTOM', customSymbol: 'aapl.us' });
    expect(k.customSymbol).toBe('AAPL');
    expect(k.docId).toBe(deepDiveDocId({ group: ['CVX'], driverKey: 'CUSTOM', customSymbol: 'AAPL', lookbackDays: 504 }));
  });

  it('clamps lookback and rejects structurally-invalid requests (never throws)', () => {
    expect(deriveDeepDiveKey({ group: ['CVX'], driver: 'BRENT', lookbackDays: 5 }).lookbackDays).toBe(LOOKBACK.MIN);
    expect(deriveDeepDiveKey({ group: ['CVX'], driver: 'BRENT', lookbackDays: 99999 }).lookbackDays).toBe(LOOKBACK.MAX);
    expect(deriveDeepDiveKey({ group: [], driver: 'BRENT' }).error).toBe('invalid_group');
    expect(deriveDeepDiveKey({ group: ['CVX'], driver: 123 }).error).toBe('invalid_driver');
    expect(deriveDeepDiveKey({ group: ['bad ticker!'], driver: 'BRENT' }).error).toBe('invalid_symbol');
    expect(deriveDeepDiveKey({ group: ['CVX'], driver: 'BRENT', lookbackDays: 'x' }).error).toBe('invalid_lookback');
  });
});

describe('isValidDocId — never trust raw input as a path segment', () => {
  it('accepts a 40-char lowercase sha1 hex; rejects everything else', () => {
    expect(isValidDocId('a'.repeat(40))).toBe(true);
    expect(isValidDocId('A'.repeat(40))).toBe(false); // uppercase is not our hex form
    expect(isValidDocId('abc')).toBe(false);
    expect(isValidDocId('g'.repeat(40))).toBe(false); // non-hex char
    expect(isValidDocId('../../etc/passwd')).toBe(false);
    expect(isValidDocId(null)).toBe(false);
    expect(isValidDocId(undefined)).toBe(false);
  });
});
