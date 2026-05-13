// api/_utils/idValidation.test.js
//
// Sprint 6 Phase 4A — pure-function tests for the shared id-shape validator.
// Extracted from inline duplications in watchlist-dialogue.js and
// watchlist-dialogue-abandon.js (Phase 4A audit D-A-4).

import { describe, it, expect } from 'vitest';
import { isValidForgeId, FORGE_ID_REGEX, FORGE_ID_MAX_LEN } from './idValidation.js';

describe('isValidForgeId', () => {
  it('accepts valid id shapes', () => {
    expect(isValidForgeId('abc123')).toBe(true);
    expect(isValidForgeId('drop-abc-123')).toBe(true);
    expect(isValidForgeId('Session_42')).toBe(true);
    expect(isValidForgeId('a')).toBe(true);
    expect(isValidForgeId('x'.repeat(FORGE_ID_MAX_LEN))).toBe(true);
  });

  it('rejects path-injection shapes (slashes, dots)', () => {
    expect(isValidForgeId('evil/../other')).toBe(false);
    expect(isValidForgeId('../../../etc/passwd')).toBe(false);
    expect(isValidForgeId('a/b')).toBe(false);
    expect(isValidForgeId('a.b')).toBe(false);
    expect(isValidForgeId('has spaces')).toBe(false);
    expect(isValidForgeId('a$b')).toBe(false);
  });

  it('rejects empty / overlong / non-string inputs', () => {
    expect(isValidForgeId('')).toBe(false);
    expect(isValidForgeId('x'.repeat(FORGE_ID_MAX_LEN + 1))).toBe(false);
    expect(isValidForgeId(null)).toBe(false);
    expect(isValidForgeId(undefined)).toBe(false);
    expect(isValidForgeId(42)).toBe(false);
    expect(isValidForgeId({})).toBe(false);
    expect(isValidForgeId([])).toBe(false);
  });

  it('exports a regex matching the documented character class', () => {
    expect(FORGE_ID_REGEX.test('safe_id-123')).toBe(true);
    expect(FORGE_ID_REGEX.test('unsafe id')).toBe(false);
    expect(FORGE_ID_MAX_LEN).toBe(200);
  });
});
