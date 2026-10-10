// src/config/pilotJourneyModeFlags.test.js
//
// The pilot's journey flag — THE DEDICATED PIN and the allowed-values suite
// (BUILD_RULES §2; pilot spec V1.4 §10.1: "a dedicated tri-state pin, an
// allowed-values suite … the generic boolean `_ENABLED` guard does not cover
// it and is not claimed to").
//
// PILOT_JOURNEY_MODE is a STRING TRI-STATE ('off' | 'advisory' | 'live'), so
// the flag-pin guard — which scans `*_ENABLED = true|false` and
// `expect(FLAG).toBe(true|false)` only — cannot see it, and DARK_BY_DESIGN
// cannot hold it. It is pinned HERE, directly: the CALL_RECORDS_MODE
// (callRecordsFlags.test.js) precedent.
//
// RUNWAY: 'off' ships with P1a and NOTHING reads it yet; P1b (deploy carriage,
// founder decision D3) is the first reader. 'off' → 'advisory' → 'live' are
// founder PRs, never build PRs, and EACH moves the first row below in the same
// commit. Nothing else in this file pins a value — the rest are contracts that
// hold in every state.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { PILOT_JOURNEY_MODE, PILOT_JOURNEY_MODES } from './featureFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8');

/** Every non-test .js/.jsx source file under a directory (node_modules and dot-dirs skipped). */
function sourceFiles(dirRel) {
  const out = [];
  const walk = (abs) => {
    for (const ent of readdirSync(abs, { withFileTypes: true })) {
      if (ent.name === 'node_modules' || ent.name.startsWith('.') || ent.name === '__fixtures__') continue;
      const child = path.join(abs, ent.name);
      if (ent.isDirectory()) walk(child);
      else if (/\.(js|jsx|mjs)$/.test(ent.name) && !/\.test\.(js|jsx|mjs)$/.test(ent.name)) out.push(child);
    }
  };
  walk(path.join(REPO, dirRel));
  return out;
}

describe('PILOT_JOURNEY_MODE — the dedicated pin (BUILD_RULES §2; spec §10.1)', () => {
  it("ships 'off' — P1a reads nothing from it", () => {
    // THE ROW THAT MOVES WITH THE WALK. 'off' → 'advisory' → 'live', each in
    // its own founder PR, each updating this literal in the same commit.
    expect(PILOT_JOURNEY_MODE).toBe('off');
  });

  it('the allowed values are exactly the three spec states, in walk order, frozen — and hold the live value', () => {
    expect(PILOT_JOURNEY_MODES).toEqual(['off', 'advisory', 'live']);
    expect(Object.isFrozen(PILOT_JOURNEY_MODES)).toBe(true);
    expect(PILOT_JOURNEY_MODES).toContain(PILOT_JOURNEY_MODE);
    expect(typeof PILOT_JOURNEY_MODE).toBe('string');
  });

  it('is a plain string literal export with the direct-pin pointer and the runway in its docstring', () => {
    expect(SRC).toMatch(/^export const PILOT_JOURNEY_MODE = '(off|advisory|live)';$/m);
    const idx = SRC.indexOf('export const PILOT_JOURNEY_MODE = ');
    const window = SRC.slice(Math.max(0, idx - 2500), idx);
    expect(window).toContain('Pinned by: pilotJourneyModeFlags.test.js');
    expect(window).toContain('RUNWAY:');
    expect(window).toContain('never a build PR');
  });

  it('is NEVER a DARK_BY_DESIGN key (a string flag fails that boolean registry)', () => {
    expect(GUARD).not.toMatch(/PILOT_JOURNEY_MODE\s*:/);
  });

  it('nothing under api/ or src/ reads it yet — P1b runs on the record slice\'s gate instead (founder ruling B1); P4 and P7 are its first readers (the pin moves only by a founder PR)', () => {
    const readers = [...sourceFiles('api'), ...sourceFiles('src')]
      .filter((f) => path.basename(f) !== 'featureFlags.js')
      .filter((f) => /\bPILOT_JOURNEY_MODES?\b/.test(readFileSync(f, 'utf8')))
      .map((f) => path.relative(REPO, f).split(path.sep).join('/'));
    expect(readers).toEqual([]);
  });
});
