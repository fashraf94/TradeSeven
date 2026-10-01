// src/config/filmTapeFlags.test.js
//
// Film Room Build A1 — THE FLAG PINS (BUILD_RULES §2), spec
// docs/specs/FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_20260927.md §5 and §7. The
// evalDeferredBeatFlags.test.js precedent: one pin per flag, a Pinned-by
// pointer the flag-pin guard keeps honest, and a DARK_BY_DESIGN registration a
// deliberate flip drops in the same commit.
//
// Both flags ship FALSE by design. FILM_TAPE_WRITE_ENABLED is the writer
// (close pass, candle pass, backfill); FILM_ROOM_V2_ENABLED is the screen flag,
// which in A1 gates only the hub helper's Stage 3 branch. An accidental flip
// fails the guard loudly with its runway note; a DELIBERATE flip moves the
// flag's first row below to `true` and turns its registration row around, in
// the same commit.
//
// This file is the pin, not a behaviour test: the flag-off zero-write rows
// live in api/cron/film-tape-close.test.js and film-tape-candles.test.js, and
// the helper's two stages in src/utils/reviewAvailability.test.js — each mocks
// the flag explicitly, so none of them moves with a flip.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { FILM_TAPE_WRITE_ENABLED, FILM_ROOM_V2_ENABLED } from './featureFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8');

const docstringOf = (name) => {
  const idx = SRC.indexOf(`export const ${name} = `);
  const prev = SRC.lastIndexOf('/**', idx);
  return SRC.slice(prev, idx);
};

describe('FILM_TAPE_WRITE_ENABLED — the pin (BUILD_RULES §2)', () => {
  it('ships DARK: FILM_TAPE_WRITE_ENABLED is false at merge — the founder flips it in its own PR', () => {
    // THE ROW THAT MOVES WITH THE FLIP, in the flip PR's own commit.
    expect(FILM_TAPE_WRITE_ENABLED).toBe(false);
  });

  it('is a plain boolean export the flag-pin guard can scan, with a Pinned-by pointer naming this file', () => {
    expect(SRC).toMatch(/^export const FILM_TAPE_WRITE_ENABLED = (true|false);$/m);
    const idx = SRC.indexOf('export const FILM_TAPE_WRITE_ENABLED = ');
    const preceding = SRC.slice(0, idx).split('\n').slice(-2).join('\n');
    expect(preceding).toContain('Pinned by: filmTapeFlags.test.js');
  });

  it('is registered DARK_BY_DESIGN in the guard — the entry a deliberate flip drops in the same commit', () => {
    // Keyed on the entry form (`FLAG:` at the start of a line), so a comment
    // that merely names the flag cannot satisfy it.
    expect(GUARD).toMatch(/^\s*FILM_TAPE_WRITE_ENABLED:/m);
  });

  it('its docstring names the flip map, the prerequisites, and what a lit writer never touches', () => {
    const doc = docstringOf('FILM_TAPE_WRITE_ENABLED');
    expect(doc).toContain('FLIP');
    expect(doc).toContain('registration row around');
    expect(doc).toContain('DARK_BY_DESIGN');
    expect(doc).toContain('ZERO');
    expect(doc).toContain('BA-1');
    expect(doc).toContain('index');
  });
});

describe('FILM_ROOM_V2_ENABLED — the pin (BUILD_RULES §2)', () => {
  it('ships DARK: FILM_ROOM_V2_ENABLED is false — flips only after A2, in its own PR', () => {
    // THE ROW THAT MOVES WITH THE FLIP, in the flip PR's own commit.
    expect(FILM_ROOM_V2_ENABLED).toBe(false);
  });

  it('is a plain boolean export the flag-pin guard can scan, with a Pinned-by pointer naming this file', () => {
    expect(SRC).toMatch(/^export const FILM_ROOM_V2_ENABLED = (true|false);$/m);
    const idx = SRC.indexOf('export const FILM_ROOM_V2_ENABLED = ');
    const preceding = SRC.slice(0, idx).split('\n').slice(-2).join('\n');
    expect(preceding).toContain('Pinned by: filmTapeFlags.test.js');
  });

  it('is registered DARK_BY_DESIGN in the guard', () => {
    expect(GUARD).toMatch(/^\s*FILM_ROOM_V2_ENABLED:/m);
  });

  it('its docstring says what it gates in A1 (the helper Stage 3 branch only) and names the flip map', () => {
    const doc = docstringOf('FILM_ROOM_V2_ENABLED');
    expect(doc).toContain('Stage 3');
    expect(doc).toContain('reviewAvailability');
    expect(doc).toContain('registration row around');
  });
});
