// src/config/eodhdQuickWinsFlags.test.js
//
// EODHD Quick Wins — THE FLAG PIN (BUILD_RULES §2), build report
// docs/audits/20261007_BUILD_EODHD_QUICK_WINS.md. The evalDeferredBeatFlags.test.js
// precedent: one pin, a Pinned-by pointer the flag-pin guard keeps honest, and a
// DARK_BY_DESIGN registration that a deliberate flip drops in the same commit.
//
// EODHD_QUICK_WINS_ENABLED is FLIPPED true (flip/eodhd-quick-wins). The flip
// moved the first row below to `true` and turned the registration row around
// to assert the DARK_BY_DESIGN entry is gone — in the same commit as the value
// (BUILD_RULES §2). A rollback moves both rows back together.
//
// This file is the pin, not a behaviour test: each change's flag-off and flag-on
// rows live beside its own code (marketDataCache.qw1, agent-evaluate.qw1,
// api/market/popular, popularMarketLoader, compute-index-intelligence.qw6,
// mandate-evaluate.qw7), each mocking the flag explicitly both ways.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { EODHD_QUICK_WINS_ENABLED } from './featureFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8');

describe('EODHD_QUICK_WINS_ENABLED — the pin (BUILD_RULES §2)', () => {
  it('is LIVE: EODHD_QUICK_WINS_ENABLED is true after the flip', () => {
    // THE ROW THAT MOVED WITH THE FLIP, in the flip's own commit.
    expect(EODHD_QUICK_WINS_ENABLED).toBe(true);
  });

  it('is a plain boolean export the flag-pin guard can scan, with a Pinned-by pointer naming this file', () => {
    expect(SRC).toMatch(/^export const EODHD_QUICK_WINS_ENABLED = (true|false);\r?$/m);
    const idx = SRC.indexOf('export const EODHD_QUICK_WINS_ENABLED = ');
    expect(idx).toBeGreaterThan(0);
    const preceding = SRC.slice(0, idx).split(/\r?\n/).slice(-2).join('\n');
    expect(preceding).toContain('Pinned by: eodhdQuickWinsFlags.test.js');
  });

  it('is NO LONGER registered DARK_BY_DESIGN in the guard — the flip dropped the entry in the same commit', () => {
    // Keyed on the entry form (`FLAG:` at the start of a line), so the guard's
    // "intentionally ABSENT" comment naming the flag does not count as an entry.
    expect(GUARD).not.toMatch(/^\s*EODHD_QUICK_WINS_ENABLED:/m);
  });

  const block = () => SRC.slice(SRC.indexOf('EODHD QUICK WINS (census'), SRC.indexOf('export const EODHD_QUICK_WINS_ENABLED'));

  it('its docstring names the flip map, what sits behind it, and what does NOT', () => {
    expect(block()).toContain('FLIP MAP');
    expect(block()).toContain('DARK_BY_DESIGN');
    for (const qw of ['QW-1', 'QW-4', 'QW-6', 'QW-7']) expect(block()).toContain(qw);
    // QW-3 ships live; the flag must never read as gating it.
    expect(block()).toContain('NOT behind this flag: QW-3');
  });

  it('the flip map turns the REGISTRATION row around too — a flip that only moves the pin leaves this file red', () => {
    expect(block()).toContain('registration row turns around to assert the DARK_BY_DESIGN entry is GONE');
  });
});
