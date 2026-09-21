// src/config/tickCaptureFlags.test.js
//
// Tick capture — THE FLAG PIN (BUILD_RULES §2), spec
// docs/specs/CAPTURE_BUILD_SPEC_V1_3.md §6. The intradayFlags.test.js
// precedent: one live-state pin, a Pinned-by pointer the flag-pin guard keeps
// honest, and a DARK_BY_DESIGN registration that a deliberate flip drops in
// the same commit.
//
// TICK_CAPTURE_ENABLED is LIT. It shipped FALSE by design; the flip moved the
// three coupled lines in one commit — the flag itself, the first row below to
// `true`, and the DARK_BY_DESIGN entry, dropped. The tickStampsFlags.test.js
// precedent: the tripwire did not retire, it turned around. Pinned TRUE, the
// rows below are now what make an accidental ROLLBACK loud, and a deliberate
// one moves the same three lines back.
//
// This file is the pin, not a behavior test: the flag-off byte-identity rows
// live in api/cron/agent-evaluate.tickCapture.flagOff.test.js, which mocks the
// flag to an explicit false and did not move with the flip.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { TICK_CAPTURE_ENABLED } from './featureFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8');

describe('TICK_CAPTURE_ENABLED — the pin (BUILD_RULES §2)', () => {
  it('is LIT: TICK_CAPTURE_ENABLED is true — the record was built dark and flipped on its own prerequisites', () => {
    // THE ROW THAT MOVED WITH THE FLIP, in the flip commit itself; a rollback
    // moves it back, together with the DARK_BY_DESIGN entry.
    expect(TICK_CAPTURE_ENABLED).toBe(true);
  });

  it('is a plain boolean export the flag-pin guard can scan, with a Pinned-by pointer naming this file', () => {
    expect(SRC).toMatch(/^export const TICK_CAPTURE_ENABLED = (true|false);$/m);
    const idx = SRC.indexOf('export const TICK_CAPTURE_ENABLED = ');
    expect(idx).toBeGreaterThan(0);
    const preceding = SRC.slice(0, idx).split('\n').slice(-2).join('\n');
    expect(preceding).toContain('Pinned by: tickCaptureFlags.test.js');
  });

  it('is NO LONGER registered DARK_BY_DESIGN — the deliberate flip dropped the entry in the same commit, and a rollback re-adds it', () => {
    // The other half of the coupling, turned around: the guard's own integrity
    // row reds if a lit flag is left listed, and this row reds if the entry is
    // re-added while the flag ships true. Keyed on the entry form (`FLAG:` at
    // the start of a line), so the explanatory ABSENT comment left in its place
    // does not satisfy it.
    expect(GUARD).not.toMatch(/TICK_CAPTURE_ENABLED:\s*\n\s*'Tick capture/);
    expect(GUARD).not.toMatch(/^\s*TICK_CAPTURE_ENABLED:/m);
    // …and the drop is explained where the entry used to be, not silent.
    expect(GUARD).toContain('TICK_CAPTURE_ENABLED intentionally ABSENT');
  });

  it('the docstring names the four flip prerequisites (spec §6) — a flip PR has something to check itself against', () => {
    const block = SRC.slice(SRC.indexOf('TICK CAPTURE — the per-check observation record'), SRC.indexOf('export const TICK_CAPTURE_ENABLED'));
    for (const prerequisite of ['TTL policy', 'index exemptions', 'overhead', 'coverage reporting']) {
      expect(block, `the docstring must name "${prerequisite}"`).toContain(prerequisite);
    }
  });
});
