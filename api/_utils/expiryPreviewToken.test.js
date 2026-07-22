// api/_utils/expiryPreviewToken.test.js
// Training-Pod P0 R3 (B1) — the dry-run→apply preview token: round-trip, expiry,
// tamper/signature, param binding, and malformed inputs.

import { describe, it, expect } from 'vitest';
import { signPreviewToken, verifyPreviewToken, PREVIEW_TOKEN_TTL_MS } from './expiryPreviewToken.js';

const SECRET = 'unit-secret';
const NOW = 1_700_000_000_000;
const base = {
  cutoffIso: '2026-07-22T00:00:00.000Z',
  thresholdMs: 48 * 60 * 60 * 1000,
  includeDev: false,
  ids: ['g2', 'g1', 'g2'], // unsorted + a dup on purpose
  expMs: NOW + PREVIEW_TOKEN_TTL_MS,
};
const match = { cutoffIso: base.cutoffIso, thresholdMs: base.thresholdMs, includeDev: false, nowMs: NOW };

describe('expiryPreviewToken', () => {
  it('sign → verify round-trips and dedupes + sorts the ids', () => {
    const v = verifyPreviewToken(signPreviewToken(base, SECRET), match, SECRET);
    expect(v.valid).toBe(true);
    expect(v.ids).toEqual(['g1', 'g2']);
  });

  it('rejects an expired token', () => {
    const t = signPreviewToken({ ...base, expMs: NOW - 1 }, SECRET);
    expect(verifyPreviewToken(t, match, SECRET)).toMatchObject({ valid: false, reason: 'expired' });
  });

  it('rejects a bad signature (wrong secret) and a tampered body', () => {
    const t = signPreviewToken(base, SECRET);
    expect(verifyPreviewToken(t, match, 'other-secret')).toMatchObject({ valid: false, reason: 'bad_signature' });
    const [body, sig] = t.split('.');
    expect(verifyPreviewToken(`${body}x.${sig}`, match, SECRET).valid).toBe(false);
  });

  it('rejects a param mismatch on cutoff, threshold, OR includeDev', () => {
    const t = signPreviewToken(base, SECRET);
    expect(verifyPreviewToken(t, { ...match, cutoffIso: '2026-07-23T00:00:00.000Z' }, SECRET)).toMatchObject({ valid: false, reason: 'param_mismatch' });
    expect(verifyPreviewToken(t, { ...match, thresholdMs: 24 * 60 * 60 * 1000 }, SECRET)).toMatchObject({ valid: false, reason: 'param_mismatch' });
    expect(verifyPreviewToken(t, { ...match, includeDev: true }, SECRET)).toMatchObject({ valid: false, reason: 'param_mismatch' });
  });

  it('rejects malformed tokens', () => {
    expect(verifyPreviewToken('garbage', match, SECRET)).toMatchObject({ valid: false, reason: 'malformed' });
    expect(verifyPreviewToken('', match, SECRET).valid).toBe(false);
    expect(verifyPreviewToken(null, match, SECRET).valid).toBe(false);
  });

  it('a null cutoff signs and verifies (rolling-style params), but differs from a dated cutoff', () => {
    const nullCut = { ...base, cutoffIso: null };
    const t = signPreviewToken(nullCut, SECRET);
    expect(verifyPreviewToken(t, { ...match, cutoffIso: null }, SECRET).valid).toBe(true);
    expect(verifyPreviewToken(t, match, SECRET)).toMatchObject({ valid: false, reason: 'param_mismatch' });
  });
});
