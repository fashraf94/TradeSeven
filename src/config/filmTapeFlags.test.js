// src/config/filmTapeFlags.test.js
//
// Film Room Build A1 — THE FLAG PINS (BUILD_RULES §2), spec
// docs/specs/FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_20260927.md §5 and §7. The
// evalDeferredBeatFlags.test.js precedent: one pin per flag, a Pinned-by
// pointer the flag-pin guard keeps honest, and a DARK_BY_DESIGN registration a
// deliberate flip drops in the same commit.
//
// FILM_TAPE_WRITE_ENABLED is the writer (close pass, candle pass, backfill),
// built false and flipped true 2026-10-01 (founder-cited, Flash). An accidental
// flip fails the guard loudly with its runway note; a DELIBERATE flip moves the
// flag's first row below and turns its registration row around, in the same
// commit. FILM_ROOM_V2_MODE is the screen gate (Amendment E BA-40), a STRING
// TRI-STATE that replaced the boolean FILM_ROOM_V2_ENABLED: it ships 'off' and
// is pinned directly here (pin, allowed values, literal + pointer), never a
// DARK_BY_DESIGN key — the guard notes it by name in that block instead.
//
// This file is the pin, not a behaviour test: the flag-off zero-write rows
// live in api/cron/film-tape-close.test.js and film-tape-candles.test.js, and
// the helper's two stages in src/utils/reviewAvailability.test.js — each mocks
// the flag explicitly, so none of them moves with a flip.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import * as flagModule from './featureFlags.js';
import { FILM_TAPE_WRITE_ENABLED, FILM_ROOM_V2_MODE, FILM_ROOM_V2_MODES } from './featureFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8');

const docstringOf = (name) => {
  const idx = SRC.indexOf(`export const ${name} = `);
  const prev = SRC.lastIndexOf('/**', idx);
  return SRC.slice(prev, idx);
};

describe('FILM_TAPE_WRITE_ENABLED — the pin (BUILD_RULES §2)', () => {
  it('is LIT: FILM_TAPE_WRITE_ENABLED is true — flipped 2026-10-01 in the founder\'s own flip PR', () => {
    // THE ROW THAT MOVED WITH THE FLIP, in the flip commit itself; a rollback
    // moves it back, together with the DARK_BY_DESIGN entry.
    expect(FILM_TAPE_WRITE_ENABLED).toBe(true);
  });

  it('is a plain boolean export the flag-pin guard can scan, with a Pinned-by pointer naming this file', () => {
    expect(SRC).toMatch(/^export const FILM_TAPE_WRITE_ENABLED = (true|false);$/m);
    const idx = SRC.indexOf('export const FILM_TAPE_WRITE_ENABLED = ');
    const preceding = SRC.slice(0, idx).split('\n').slice(-2).join('\n');
    expect(preceding).toContain('Pinned by: filmTapeFlags.test.js');
  });

  it('is NO LONGER registered DARK_BY_DESIGN — the deliberate flip dropped the entry in the same commit, and a rollback re-adds it', () => {
    // Turned around at the flip. Keyed on the entry form (`FLAG:` at the start
    // of a line), so the explanatory ABSENT comment left in its place does not
    // satisfy it.
    expect(GUARD).not.toMatch(/^\s*FILM_TAPE_WRITE_ENABLED:/m);
    // …and the drop is explained where the entry used to be, not silent.
    expect(GUARD).toContain('FILM_TAPE_WRITE_ENABLED intentionally ABSENT');
  });

  it('its docstring names the flip map, the prerequisites, and what a lit writer never touches', () => {
    const doc = docstringOf('FILM_TAPE_WRITE_ENABLED');
    expect(doc).toContain('FLIP');
    expect(doc).toContain('registration row around');
    expect(doc).toContain('DARK_BY_DESIGN');
    expect(doc).toContain('ZERO');
    expect(doc).toContain('BA-1');
    expect(doc).toContain('index');
    expect(doc).toContain('FLIPPED true 2026-10-01');
    expect(doc).toContain('ROLLBACK');
  });
});

describe('FILM_ROOM_V2_MODE — the pin (BUILD_RULES §2; Amendment E BA-40)', () => {
  it("ships the dark state: FILM_ROOM_V2_MODE is 'off' — each step is its own founder PR", () => {
    // THE ROW THAT MOVES WITH A FLIP ('off' → 'allowlist' → 'on'), in the flip PR's own commit.
    expect(FILM_ROOM_V2_MODE).toBe('off');
  });

  it('the allowed values: exactly off · allowlist · on, frozen, in walk order, and the shipped value is one of them', () => {
    expect(FILM_ROOM_V2_MODES).toEqual(['off', 'allowlist', 'on']);
    expect(Object.isFrozen(FILM_ROOM_V2_MODES)).toBe(true);
    expect(FILM_ROOM_V2_MODES).toContain(FILM_ROOM_V2_MODE);
    expect(typeof FILM_ROOM_V2_MODE).toBe('string');
  });

  it('is a plain string literal with a Pinned-by pointer naming this file, and its runway is written beside it', () => {
    expect(SRC).toMatch(/^export const FILM_ROOM_V2_MODE = '(off|allowlist|on)';$/m);
    const idx = SRC.indexOf('export const FILM_ROOM_V2_MODE = ');
    const preceding = SRC.slice(0, idx).split('\n').slice(-2).join('\n');
    expect(preceding).toContain('Pinned by: filmTapeFlags.test.js');
    const doc = docstringOf('FILM_ROOM_V2_MODE');
    expect(doc).toContain('RUNWAY:');
    expect(doc).toContain('never a build PR');
    expect(doc).toContain('PER BATTLE OWNER');
    expect(doc).toContain('cockpit-status');
    expect(doc).toContain('Stage 3');
  });

  it('the boolean it replaced is gone — no FILM_ROOM_V2_ENABLED export, no pin, no DARK_BY_DESIGN key', () => {
    expect('FILM_ROOM_V2_ENABLED' in flagModule).toBe(false);
    expect(SRC).not.toMatch(/^export const FILM_ROOM_V2_ENABLED\b/m);
    expect(GUARD).not.toMatch(/^\s*FILM_ROOM_V2_ENABLED:/m);
  });

  it('never a DARK_BY_DESIGN key (the guard scans *_ENABLED booleans only), but noted by name in that block', () => {
    expect(GUARD).not.toMatch(/^\s*FILM_ROOM_V2_MODE\s*:/m);
    expect(GUARD).toContain('FILM_ROOM_V2_MODE intentionally ABSENT');
  });
});
