// src/config/evalCapacityFlags.test.js
//
// Capacity Build 1 — THE PINS (BUILD_RULES §2), build report
// docs/audits/20261115_BUILD_EVAL_CAPACITY_1.md. The evalDeferredBeatFlags
// precedent: one pin per setting, a Pinned-by pointer the flag-pin guard keeps
// honest, and DARK_BY_DESIGN registrations for the two booleans that a
// deliberate flip drops in the same commit. EVAL_POOL_K and
// EVAL_POOL_START_CUTOFF_MS are numeric; flagPinGuard.test.js checks them
// through its named numeric-settings list.
//
// Everything ships with today's behaviour: K = 1 (the sequential loop), the
// EODHD guard off (bare fetch, counted), the market-data cuts off. A flip PR
// moves the matching row below in its own commit.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { EVAL_POOL_K, EVAL_POOL_START_CUTOFF_MS, EODHD_FETCH_GUARD_ENABLED, EVAL_MARKET_DATA_CUTS_ENABLED } from './featureFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8');

describe('capacity Build 1 settings — the pins', () => {
  it('EVAL_POOL_K ships 1: one battle at a time, the loop it replaced (ruling R4: not above 2 before the 25-player market-data plan)', () => {
    expect(EVAL_POOL_K).toBe(1);
  });

  it('EVAL_POOL_START_CUTOFF_MS ships 200 s (read only at K > 1)', () => {
    expect(EVAL_POOL_START_CUTOFF_MS).toBe(200_000);
  });

  it('EODHD_FETCH_GUARD_ENABLED ships DARK', () => {
    expect(EODHD_FETCH_GUARD_ENABLED).toBe(false);
  });

  it('EVAL_MARKET_DATA_CUTS_ENABLED ships DARK', () => {
    expect(EVAL_MARKET_DATA_CUTS_ENABLED).toBe(false);
  });

  it('each is a plain literal export with a Pinned-by pointer naming this file', () => {
    for (const [name, literal] of [
      ['EVAL_POOL_K', '1'], ['EVAL_POOL_START_CUTOFF_MS', '200_000'],
      ['EODHD_FETCH_GUARD_ENABLED', 'false'], ['EVAL_MARKET_DATA_CUTS_ENABLED', 'false'],
    ]) {
      expect(SRC).toContain(`\nexport const ${name} = ${literal};`);
      const idx = SRC.indexOf(`export const ${name} = `);
      const preceding = SRC.slice(0, idx).split('\n').slice(-2).join('\n');
      expect(preceding, name).toContain('Pinned by: evalCapacityFlags.test.js');
    }
  });

  it('the two booleans are registered DARK_BY_DESIGN — the entries a deliberate flip drops in the same commit', () => {
    expect(GUARD).toMatch(/^\s*EODHD_FETCH_GUARD_ENABLED:/m);
    expect(GUARD).toMatch(/^\s*EVAL_MARKET_DATA_CUTS_ENABLED:/m);
  });

  it('the numeric two are on the guard\'s named numeric-settings list', () => {
    expect(GUARD).toContain("const NUMERIC_SETTINGS = ['EVAL_POOL_K', 'EVAL_POOL_START_CUTOFF_MS'];");
  });
});
