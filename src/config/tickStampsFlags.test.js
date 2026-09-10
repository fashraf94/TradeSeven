// src/config/tickStampsFlags.test.js
//
// Phase B — the tick stamps: THE FLAG PIN (BUILD_RULES §2).
//
// TICK_STAMPS_ENABLED is LIT. It shipped FALSE by design (spec §1.1 / §4,
// D-113): B1 merged dark, and the founder flipped it in its own one-line PR
// after B1 merged, so the first stamped production check is the smoke. The
// flag-pin guard (flagPinGuard.test.js) tracks this row against the live value
// and couples the three lines the flip moves, all in that one commit: the flag
// itself, the first row below to `true`, and the DARK_BY_DESIGN entry, dropped.
//
// The tripwire did not retire, it turned around. Pinned TRUE, the row below is
// now what turns an accidental ROLLBACK into a loud failure naming this file —
// and a deliberate one moves the same three lines back.
//
// Deliberately pins ONLY this flag (the characterPaneFlags.test.js precedent):
// pinning a flag obliges its docstring to name this file, so an unrelated flag
// added here "as context" would couple its future flip to this arc.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { TICK_STAMPS_ENABLED } from './featureFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');

describe('Phase B tick stamps flag — the pin (BUILD_RULES §2)', () => {
  it('is LIT: TICK_STAMPS_ENABLED is true (D-113 — the founder flipped it in its own PR after B1 merged)', () => {
    // THE ROW THAT MOVED WITH THE FLIP, in the flip PR's own commit; a rollback
    // moves it back, together with the DARK_BY_DESIGN entry.
    expect(TICK_STAMPS_ENABLED).toBe(true);
  });

  it('is a plain boolean export the flag-pin guard can scan', () => {
    expect(typeof TICK_STAMPS_ENABLED).toBe('boolean');
    expect(SRC).toMatch(/^export const TICK_STAMPS_ENABLED = (true|false);$/m);
  });

  it('every cron suite that imports agent-evaluate.js AND mocks featureFlags.js spreads importOriginal — a bare factory omitting this name would THROW at the gate under vitest (review C-1 / B-2), so no such suite may exist', () => {
    const cronDir = path.join(REPO, 'api', 'cron');
    const offenders = [];
    let checked = 0;
    for (const name of readdirSync(cronDir)) {
      if (!/\.test\.js$/.test(name)) continue;
      const text = readFileSync(path.join(cronDir, name), 'utf8');
      if (!/agent-evaluate\.js['"]/.test(text)) continue;            // only suites that reach the cron's flag read
      if (!/vi\.mock\(\s*['"][^'"]*featureFlags\.js['"]/.test(text)) continue; // …and double the flags module at all
      checked++;
      if (!/vi\.mock\(\s*['"][^'"]*featureFlags\.js['"]\s*,\s*async\s*\(\s*importOriginal\s*\)/.test(text)) offenders.push(name);
    }
    expect(checked, "the scan must see the tickStamps cron suites' flag mocks").toBeGreaterThanOrEqual(3);
    expect(offenders, `bare-factory featureFlags mocks in cron suites that drive agent-evaluate.js: ${offenders.join(', ')}`).toEqual([]);
  });

  it('its docstring names this pinning suite, the flip map, and the true bare-factory rule', () => {
    const idx = SRC.indexOf('export const TICK_STAMPS_ENABLED');
    const window = SRC.slice(Math.max(0, idx - 4000), idx);
    expect(window).toContain('Pinned by: tickStampsFlags.test.js');
    expect(window).toContain('FLIP MAP');
    expect(window).toContain('DARK_BY_DESIGN');
    expect(window).toContain('THROWS on access');
    expect(window).not.toMatch(/never throw/);
  });
});
