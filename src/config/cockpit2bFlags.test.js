// src/config/cockpit2bFlags.test.js
//
// Cockpit Build 2b — THE FLAG PIN (BUILD_RULES §2; spec
// docs/COCKPIT_BUILD2B_SPEC_V1_0.md S-11, §10).
//
// COCKPIT_2B_ENABLED shipped FALSE (the 2b endpoint behavior and the V5 screen
// were built dark) and is now TRUE: the founder's flip PR (spec §10.2) ran THE
// FLIP MAP in the flag's docstring, in one commit — the first row moved to
// true, the registration row (last) turned around to assert the
// DARK_BY_DESIGN entry is gone, the entry was dropped, and the docstring's
// state lines were reworded. The first row is a tripwire in both directions:
// an accidental rollback darkens the commands, the replace confirmation and
// the new screen for every allowlisted owner; flagPinGuard.test.js turns that
// into a loud failure naming this file. A deliberate rollback (spec §10.3) is
// the one line back to false, with the first row and the registration row
// moved back and the DARK_BY_DESIGN entry restored, in one commit.
//
// Deliberately pins ONLY this flag (the commandCenterHubFlags.test.js
// precedent).

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { COCKPIT_2B_ENABLED, isCockpit2bOn } from './featureFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(HERE, '..');
const REPO_ROOT = path.resolve(SRC_ROOT, '..');
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8').replace(/\r\n/g, '\n');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8').replace(/\r\n/g, '\n');

/** The body of a named export function, from its signature to its closing brace. */
function fnBody(name) {
  const body = SRC.slice(SRC.indexOf(`export function ${name}`));
  return body.slice(0, body.indexOf('\n}') + 2);
}

/** The flag's docstring window: from the previous export to its own. */
function docstring() {
  const idx = SRC.indexOf('export const COCKPIT_2B_ENABLED');
  expect(idx).toBeGreaterThan(-1);
  return SRC.slice(SRC.lastIndexOf('export function ', idx - 1), idx);
}

describe('COCKPIT_2B_ENABLED — the pin (BUILD_RULES §2)', () => {
  it('LIT by the founder\'s flip PR (§10.2): COCKPIT_2B_ENABLED is true — the 2b endpoint behavior and the V5 screen, for the allowlisted owners', () => {
    // THE ROW THAT MOVES WITH THE FLIP, in the flip PR's own commit.
    expect(COCKPIT_2B_ENABLED).toBe(true);
  });

  it('the accessor returns the flag, so it reads the live value', () => {
    expect(isCockpit2bOn()).toBe(COCKPIT_2B_ENABLED);
  });

  it('the accessor is the flag and nothing else — no URL, environment or localStorage override', () => {
    expect(fnBody('isCockpit2bOn')).toMatch(/^export function isCockpit2bOn\(\) \{\n {2}return COCKPIT_2B_ENABLED;\n\}$/);
  });

  it('no module-scope derivation of the accessor exists in the flag module', () => {
    expect(SRC).not.toMatch(/const \w+ = isCockpit2bOn\(\)/);
  });

  it('no consumer in src/ or api/ reads the constant, or derives the accessor at module scope: both read it at call time', () => {
    const readers = [];
    const walk = (dir) => {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, ent.name);
        if (ent.isDirectory()) { if (ent.name !== 'node_modules' && !ent.name.startsWith('__')) walk(abs); continue; }
        if (!/\.(js|jsx|mjs)$/.test(ent.name) || /\.test\.(js|jsx)$/.test(ent.name)) continue;
        if (abs === path.join(HERE, 'featureFlags.js')) continue;
        const code = readFileSync(abs, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        if (/\bCOCKPIT_2B_ENABLED\b/.test(code) || /^(?:export )?const \w+ = isCockpit2bOn\(\)/m.test(code)) readers.push(path.relative(REPO_ROOT, abs));
      }
    };
    walk(SRC_ROOT);
    walk(path.join(REPO_ROOT, 'api'));
    expect(readers).toEqual([]);
  });

  it('is a plain boolean export the flag-pin guard can scan', () => {
    expect(typeof COCKPIT_2B_ENABLED).toBe('boolean');
    expect(SRC).toMatch(/^export const COCKPIT_2B_ENABLED = (true|false);$/m);
  });

  it('its docstring names this pinning suite, the runway and the whole flip map', () => {
    const window = docstring();
    expect(window).toContain('Pinned by: cockpit2bFlags.test.js');
    expect(window).toContain('RUNWAY:');
    expect(window).toContain('Never a build PR');
    expect(window).toContain('THE FLIP MAP');
    expect(window).toContain(' *   1. this constant → true;');
    expect(window).toContain(' *   2. cockpit2bFlags.test.js: the pin row → true and the registration row');
    expect(window).toContain(" *   3. src/config/flagPinGuard.test.js: this flag's DARK_BY_DESIGN entry dropped;");
    expect(window).toContain(' *   4. this docstring: the state lines');
  });

  it('is NO LONGER registered DARK_BY_DESIGN — the deliberate flip dropped its entry in the same commit', () => {
    expect(GUARD).not.toMatch(/^ {2}COCKPIT_2B_ENABLED:\n/m);
  });
});
