// src/config/directiveFitCheckFlags.test.js
//
// F-1 — the flag pin for DIRECTIVE_FIT_CHECK_ENABLED.
//
// The value and this pin move together (BUILD_RULES §2), and flagPinGuard.js
// enforces exactly that: it walks the flag-source modules and every test file
// and reds with an actionable file:line the moment a live value contradicts a
// hardcoded pin. The flag is also listed in that guard's DARK_BY_DESIGN set, so
// the guard prints this flag's runway — and its integrity row reds if the flag
// is ever flipped true and left listed.
//
// Read the REAL module: no mock, no spread. A mocked flag cannot pin anything.

import { describe, it, expect } from 'vitest';
import { DIRECTIVE_FIT_CHECK_ENABLED } from './featureFlags.js';

describe('DIRECTIVE_FIT_CHECK_ENABLED — the dark pin', () => {
  it('ships FALSE (dark by design; the flip is its own one-line PR)', () => {
    expect(DIRECTIVE_FIT_CHECK_ENABLED).toBe(false);
  });

  it('is a boolean, not a string enum or a truthy stand-in', () => {
    // A `'false'` string would read truthy at every call site and light the
    // whole mechanism silently.
    expect(typeof DIRECTIVE_FIT_CHECK_ENABLED).toBe('boolean');
  });
});
