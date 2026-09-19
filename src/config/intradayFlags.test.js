// src/config/intradayFlags.test.js
//
// Intraday Data — Build 1: THE FLAG PINS (BUILD_RULES §2) for the four
// boolean flags (contract §3). All ship FALSE. The flag-pin guard
// (flagPinGuard.test.js) tracks each row against the live value; a flip moves
// the row here in the flip commit, and — for the two stage gates — drops the
// DARK_BY_DESIGN entry in the same commit.
//
// Deliberately pins ONLY these four (the characterPaneFlags.test.js
// precedent); the string enum INTRADAY_PRICE_SOURCE is pinned in
// intradayPriceSourceFlags.test.js.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  INTRADAY_COLLECT_ENABLED,
  INTRADAY_DIAGNOSTIC_ENABLED,
  INTRADAY_AGENT_USE_ENABLED,
  INTRADAY_RISK_ACTIVATION_ENABLED,
} from './featureFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');

describe('Intraday Data Build 1 flags — the pins (BUILD_RULES §2)', () => {
  it('INTRADAY_COLLECT_ENABLED ships false (flips after the founder\'s day-1 smoke, one-line PR)', () => {
    expect(INTRADAY_COLLECT_ENABLED).toBe(false);
  });
  it('INTRADAY_DIAGNOSTIC_ENABLED ships false (flips after the founder\'s day-1 smoke, one-line PR)', () => {
    expect(INTRADAY_DIAGNOSTIC_ENABLED).toBe(false);
  });
  it('INTRADAY_AGENT_USE_ENABLED ships false — stage 2, DARK_BY_DESIGN', () => {
    expect(INTRADAY_AGENT_USE_ENABLED).toBe(false);
  });
  it('INTRADAY_RISK_ACTIVATION_ENABLED ships false — stage 4, DARK_BY_DESIGN', () => {
    expect(INTRADAY_RISK_ACTIVATION_ENABLED).toBe(false);
  });
  it('each is a plain boolean export the flag-pin guard can scan, with a Pinned-by pointer naming this file', () => {
    for (const name of ['INTRADAY_COLLECT_ENABLED', 'INTRADAY_DIAGNOSTIC_ENABLED', 'INTRADAY_AGENT_USE_ENABLED', 'INTRADAY_RISK_ACTIVATION_ENABLED']) {
      expect(SRC).toMatch(new RegExp(`^export const ${name} = (true|false);$`, 'm'));
      const idx = SRC.indexOf(`export const ${name} = `);
      expect(SRC.slice(Math.max(0, idx - 200), idx)).toContain('Pinned by: intradayFlags.test.js');
    }
  });
  it('the two stage gates are registered DARK_BY_DESIGN; the two build-1 live flags are not (they flip after smoke)', () => {
    const guard = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8');
    expect(guard).toMatch(/INTRADAY_AGENT_USE_ENABLED\s*:/);
    expect(guard).toMatch(/INTRADAY_RISK_ACTIVATION_ENABLED\s*:/);
    expect(guard).not.toMatch(/INTRADAY_COLLECT_ENABLED\s*:/);
    expect(guard).not.toMatch(/INTRADAY_DIAGNOSTIC_ENABLED\s*:/);
  });
});
