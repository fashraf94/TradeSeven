// src/config/practiceFieldScreenFlags.test.js
//
// Practice Field build B3 — THE SCREEN SWITCH'S PIN (ruling B3-8; BUILD_RULES §2). PRACTICE_FIELD_SCREEN_ENABLED ships
// false; a flip moves the first row below, the literal and its DARK_BY_DESIGN entry in flagPinGuard.test.js in one
// founder commit. The behaviour with it off is the endpoint's and the screen's own suites
// (api/practice-field/book.test.js, src/components/PracticeField/*.jsdom.test.jsx).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { PRACTICE_FIELD_SCREEN_ENABLED } from './practiceFieldScreenFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const lf = (s) => s.replace(/\r\n/g, '\n');
const SRC = lf(readFileSync(path.join(HERE, 'practiceFieldScreenFlags.js'), 'utf8'));
const GUARD = lf(readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8'));

describe('PRACTICE_FIELD_SCREEN_ENABLED — the pin (ruling B3-8, BUILD_RULES §2)', () => {
  it('is false: the screen ships dark (no request, no card, the endpoint answers 404)', () => {
    // THE ROW THAT MOVES WITH A FLIP, in the flip PR's own commit; a rollback moves it back.
    expect(PRACTICE_FIELD_SCREEN_ENABLED).toBe(false);
  });

  it('is a plain boolean-literal export with a Pinned-by pointer naming this file', () => {
    expect(SRC).toMatch(/^export const PRACTICE_FIELD_SCREEN_ENABLED = (true|false);$/m);
    const idx = SRC.indexOf('export const PRACTICE_FIELD_SCREEN_ENABLED = ');
    expect(SRC.slice(0, idx).split('\n').slice(-2).join('\n')).toMatch(/Pinned by: practiceFieldScreenFlags\.test\.js/);
  });

  it('the module has no imports, and the guard both scans it and holds it dark by design', () => {
    expect(SRC).not.toMatch(/^import /m);
    expect(GUARD).toMatch(/^ {2}'src\/config\/practiceFieldScreenFlags\.js',$/m);
    expect(GUARD).toMatch(/^ {2}PRACTICE_FIELD_SCREEN_ENABLED:$/m);
  });
});
