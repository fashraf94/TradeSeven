// src/config/intradayPriceSourceFlags.test.js
//
// Intraday Data — Build 1: THE PIN for the string enum INTRADAY_PRICE_SOURCE
// (contract §3). 'legacy' at merge; 'snapshot' is stage 3. A STRING enum, so
// the flag-pin guard cannot see it — pinned here directly, the
// ANTICIPATION_THRESHOLD_LINT_MODE precedent. The flip moves the first row
// in the same commit (BUILD_RULES §2).

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { INTRADAY_PRICE_SOURCE, INTRADAY_PRICE_SOURCES } from './featureFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');

describe('INTRADAY_PRICE_SOURCE — the pin (BUILD_RULES §2)', () => {
  it("ships 'legacy' — the §8.5 adapter has no consumer in build 1", () => {
    expect(INTRADAY_PRICE_SOURCE).toBe('legacy');
  });
  it('the live value is one of the two sources, frozen', () => {
    expect(INTRADAY_PRICE_SOURCES).toEqual(['legacy', 'snapshot']);
    expect(INTRADAY_PRICE_SOURCES).toContain(INTRADAY_PRICE_SOURCE);
    expect(Object.isFrozen(INTRADAY_PRICE_SOURCES)).toBe(true);
  });
  it('the docstring carries the direct-pin pointer', () => {
    const idx = SRC.indexOf('export const INTRADAY_PRICE_SOURCE = ');
    expect(idx).toBeGreaterThan(0);
    expect(SRC.slice(Math.max(0, idx - 300), idx)).toContain('Pinned by: intradayPriceSourceFlags.test.js');
  });
  it('no module IMPORTS the enum in build 1 (present, no consumer)', () => {
    const REPO = path.resolve(HERE, '..', '..');
    const consumers = [];
    const walk = (dir) => {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
        const abs = path.join(dir, ent.name);
        if (ent.isDirectory()) { walk(abs); continue; }
        if (!/\.(js|jsx)$/.test(ent.name) || /\.test\.(js|jsx)$/.test(ent.name) || abs.endsWith('featureFlags.js')) continue;
        const src = readFileSync(abs, 'utf8');
        if (/import\s*\{[^}]*\bINTRADAY_PRICE_SOURCE\b[^}]*\}/.test(src)) consumers.push(path.relative(REPO, abs));
      }
    };
    walk(path.join(REPO, 'api'));
    walk(path.join(REPO, 'src'));
    expect(consumers).toEqual([]);
  });
});
