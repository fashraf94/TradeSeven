// src/config/practiceFieldFlags.test.js
//
// Practice Field T1a-1 — THE FLAG PIN (BUILD_RULES §2). PRACTICE_FIELD_MODE is a STRING TRI-STATE after
// FILM_ROOM_CARDS_MODE and RESEARCH_MODAL_BOMB_MODE: pinned directly here (the value, the allowed values, the
// literal and its Pinned-by pointer), never a DARK_BY_DESIGN key — the guard scans `*_ENABLED` booleans only —
// and noted by name in that block instead. A flip moves the first row below in its own founder PR.
//
// This file is the pin, not a behaviour test: every accounting test sets the mode through
// api/_utils/practiceField/mode.js's tests-only setter, so none of them moves with a flip. The behaviour AT the
// shipped value is api/_utils/practiceField/mode.test.js and the "mode off" rows of the isolation suite.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { PRACTICE_FIELD_MODE, PRACTICE_FIELD_MODES } from './practiceFieldFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(HERE, '..');
const lf = (s) => s.replace(/\r\n/g, '\n');
const SRC = lf(readFileSync(path.join(HERE, 'practiceFieldFlags.js'), 'utf8'));
const GUARD = lf(readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8'));

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(js|jsx|mjs|ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe('PRACTICE_FIELD_MODE — the pin (BUILD_RULES §2)', () => {
  it("is 'off': the idea book is dark — nobody is admitted and no Practice Field code path runs in any cron", () => {
    // THE ROW THAT MOVES WITH A FLIP ('off' → 'allowlist' → 'on'), in the flip PR's own commit; a rollback moves it back.
    expect(PRACTICE_FIELD_MODE).toBe('off');
  });

  it('the allowed values: exactly off · allowlist · on, frozen, in walk order, and the shipped value is one of them', () => {
    expect(PRACTICE_FIELD_MODES).toEqual(['off', 'allowlist', 'on']);
    expect(Object.isFrozen(PRACTICE_FIELD_MODES)).toBe(true);
    expect(PRACTICE_FIELD_MODES).toContain(PRACTICE_FIELD_MODE);
  });

  it('is a plain string-literal export with a Pinned-by pointer naming this file', () => {
    expect(SRC).toMatch(/^export const PRACTICE_FIELD_MODE = '(off|allowlist|on)';$/m);
    const idx = SRC.indexOf('export const PRACTICE_FIELD_MODE = ');
    expect(SRC.slice(0, idx).split('\n').slice(-2).join('\n')).toMatch(/Pinned by: practiceFieldFlags\.test\.js/);
  });

  it('is NOT a DARK_BY_DESIGN key (the guard scans booleans only) and IS noted by name in that block', () => {
    expect(GUARD).not.toMatch(/^ {2}PRACTICE_FIELD_MODE:/m);
    expect(GUARD).toMatch(/^ {2}\/\/ PRACTICE_FIELD_MODE intentionally ABSENT, and it must stay absent:/m);
    expect(GUARD).toMatch(/practiceFieldFlags\.test\.js asserts both halves/);
  });

  it('the module has no imports', () => {
    expect(SRC).not.toMatch(/^import /m);
    expect(SRC).not.toMatch(/\bimport\s*\(/);
  });

  it('no module under src/ imports the flag (the client bundle never carries it; the server reads it through one gate)', () => {
    const importers = walk(SRC_ROOT)
      .filter((f) => !/\.test\.(js|jsx)$/.test(f))
      .filter((f) => /practiceFieldFlags/.test(readFileSync(f, 'utf8')))
      .map((f) => path.relative(SRC_ROOT, f).replace(/\\/g, '/'))
      .filter((f) => f !== 'config/practiceFieldFlags.js');
    expect(importers).toEqual([]);
  }, 60_000);

  it('the server reads it through exactly one module', () => {
    const apiRoot = path.resolve(SRC_ROOT, '..', 'api');
    const readers = walk(apiRoot)
      .filter((f) => !/\.test\.js$/.test(f))
      .filter((f) => /from '[^']*practiceFieldFlags\.js'/.test(readFileSync(f, 'utf8')))
      .map((f) => path.relative(apiRoot, f).replace(/\\/g, '/'));
    expect(readers).toEqual(['_utils/practiceField/mode.js']);
  }, 60_000);
});
