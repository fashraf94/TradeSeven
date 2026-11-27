// src/config/exploreFlags.test.js
//
// Explore Build 1 — THE SWITCH'S PIN (BUILD_RULES §2; spec
// docs/specs/20261121_EXPLORE_BUILD_1_SPEC_V1_1.md §6; build prompt K-2).
// EXPLORE_MODE is a STRING TRI-STATE in its own module: pinned directly here (the
// pin, the allowed values, the literal and its Pinned-by pointer, the call-time
// reader), never a DARK_BY_DESIGN key — the guard scans `*_ENABLED` booleans only —
// and noted by name in that block instead. A flip moves the first row below in its
// own founder PR.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { EXPLORE_MODE, EXPLORE_MODES, exploreMode } from './exploreFlags.js';
import { EXPLORE_COMPARE_ROUTE } from './exploreFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'exploreFlags.js'), 'utf8').replace(/\r\n/g, '\n');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8').replace(/\r\n/g, '\n');
const FEATURE_FLAGS = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');
const SELF = readFileSync(fileURLToPath(import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const ROLLBACK = "one step back at a time ('on' → 'allowlist' → 'off') by moving the literal and its pin together; at 'off' the page is today's and nothing of Explore loads";

describe('EXPLORE_MODE — the pin (BUILD_RULES §2; spec §6, K-2)', () => {
  it("is 'off' — one step back at a time ('on' → 'allowlist' → 'off') by moving the literal and its pin together; at 'off' the page is today's and nothing of Explore loads", () => {
    // THE ROW THAT MOVES WITH A FLIP ('off' → 'allowlist' → 'on'), in the flip PR's own commit; a rollback moves it back.
    expect(EXPLORE_MODE).toBe('off');
    expect(exploreMode()).toBe('off');
  });

  it('the allowed values: exactly off · allowlist · on, frozen, in walk order, and the shipped value is one of them', () => {
    expect(EXPLORE_MODES).toEqual(['off', 'allowlist', 'on']);
    expect(Object.isFrozen(EXPLORE_MODES)).toBe(true);
    expect(EXPLORE_MODES).toContain(EXPLORE_MODE);
  });

  it('is a plain string literal with a Pinned-by pointer naming this file, and its runway and rollback are written beside it', () => {
    expect(SRC).toMatch(/^export const EXPLORE_MODE = '(off|allowlist|on)';$/m);
    const idx = SRC.indexOf('export const EXPLORE_MODE = ');
    const preceding = SRC.slice(0, idx).split('\n').slice(-2).join('\n');
    expect(preceding).toContain('Pinned by: exploreFlags.test.js');
    const doc = SRC.slice(SRC.lastIndexOf('/**', idx), idx);
    expect(doc).toContain('RUNWAY:');
    expect(doc).toContain('Never a build PR');
    expect(doc).toContain(ROLLBACK);
    expect(SELF).toContain(`"is '${EXPLORE_MODE}' — ${ROLLBACK}"`);
  });

  it('the reader resolves at call time and maps any value outside the three to off', () => {
    const body = /export function exploreMode\(\) \{\s*([^}]*)\}/.exec(SRC)[1];
    expect(body.trim()).toBe("return EXPLORE_MODE === 'allowlist' || EXPLORE_MODE === 'on' ? EXPLORE_MODE : 'off';");
    // the reader's rule, run over every value it could meet
    const ruleOf = (v) => (v === 'allowlist' || v === 'on' ? v : 'off');
    for (const v of ['off', 'allowlist', 'on', 'ON', 'true', '', null, undefined, true, 1]) expect(ruleOf(v)).toBe(EXPLORE_MODES.includes(v) ? v : 'off');
  });

  it('imports nothing and is never read at module scope by itself (a call-time reader only)', () => {
    expect(SRC).not.toMatch(/^\s*import\b/m);
    expect(SRC).not.toMatch(/\brequire\(/);
    const reads = SRC.split('\n').filter((l) => /\bEXPLORE_MODE\b/.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l));
    expect(reads).toEqual([
      `export const EXPLORE_MODE = '${EXPLORE_MODE}';`, // value-neutral: a flip moves only the first row (review D-2)
      "  return EXPLORE_MODE === 'allowlist' || EXPLORE_MODE === 'on' ? EXPLORE_MODE : 'off';",
    ]);
  });

  it('never a DARK_BY_DESIGN key (the guard scans *_ENABLED booleans only), but noted by name in that block', () => {
    expect(GUARD).not.toMatch(/^\s*EXPLORE_MODE\s*:/m);
    expect(GUARD).toContain('EXPLORE_MODE intentionally ABSENT');
    expect(GUARD).toContain('exploreFlags.test.js asserts both halves');
  });

  it('no boolean twin exists, and the switch is not a line in featureFlags.js (the entry-chunk reason in the module header)', () => {
    expect(SRC).not.toMatch(/^export const EXPLORE_ENABLED\b/m);
    expect(FEATURE_FLAGS).not.toMatch(/EXPLORE_MODE/);
  });
});

// Explore Build 2 — THE COMPARE SWITCH'S PIN (spec docs/specs/20261125_EXPLORE_BUILD_2_SPEC_AMENDMENT_B.md §6, B-9;
// build prompt K-2). A plain boolean, false until the compare build sets it.
describe('EXPLORE_COMPARE_ROUTE — the pin (BUILD_RULES §2; Amendment B §6, K-2)', () => {
  it('is false — the compare build sets it, moving this row and the literal together', () => {
    // THE ROW THAT MOVES WITH A FLIP, in the compare build's own commit.
    expect(EXPLORE_COMPARE_ROUTE).toBe(false);
  });

  it('is a plain boolean literal with a Pinned-by pointer naming this file, and its docstring says the compare build sets it', () => {
    expect(SRC).toMatch(/^export const EXPLORE_COMPARE_ROUTE = (true|false);$/m);
    const idx = SRC.indexOf('export const EXPLORE_COMPARE_ROUTE = ');
    expect(SRC.slice(0, idx).split('\n').slice(-2).join('\n')).toContain('Pinned by: exploreFlags.test.js');
    const doc = SRC.slice(SRC.lastIndexOf('/**', idx), idx);
    expect(doc).toContain('THE COMPARE BUILD SETS IT');
    expect(doc).toContain('IT CHANGES WORDS ONLY');
    expect(doc).toContain('ROLLBACK:');
  });

  it('the file declares it once and reads it nowhere else; it has no reader function (a new entry export: the bundle reason in its docstring)', () => {
    const reads = SRC.split('\n').filter((l) => /\bEXPLORE_COMPARE_ROUTE\b/.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l));
    expect(reads).toEqual([`export const EXPLORE_COMPARE_ROUTE = ${EXPLORE_COMPARE_ROUTE};`]);
    expect(SRC).not.toMatch(/export function \w*[Cc]ompare/);
  });

  it('never a DARK_BY_DESIGN key (not an *_ENABLED name, not a flag-source module), but noted by name in that block', () => {
    expect(GUARD).not.toMatch(/^\s*EXPLORE_COMPARE_ROUTE\s*:/m);
    expect(GUARD).toContain('EXPLORE_COMPARE_ROUTE intentionally ABSENT');
    expect(GUARD).toMatch(/EXPLORE_COMPARE_ROUTE intentionally ABSENT[\s\S]{0,700}exploreFlags\.test\.js\s+\/\/\s+asserts both halves/);
    expect(FEATURE_FLAGS).not.toMatch(/EXPLORE_COMPARE_ROUTE/);
  });

  it('every reader outside this file reads the literal at call time — `EXPLORE_COMPARE_ROUTE === true` inside a function, never at module scope — and the readers are exactly the panel and the hero', () => {
    const SRC_ROOT = path.join(HERE, '..');
    const files = [];
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); } else if (/\.(js|jsx|mjs)$/.test(e.name) && !/\.test\./.test(e.name)) files.push(p);
      }
    };
    walk(SRC_ROOT);
    const readers = [];
    const wrong = [];
    for (const p of files) {
      if (p === path.join(HERE, 'exploreFlags.js')) continue;
      const code = readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/\/\/.*$/, ''));
      code.forEach((line) => {
        if (!/\bEXPLORE_COMPARE_ROUTE\b/.test(line) || /^import\b/.test(line)) return;
        readers.push(path.relative(SRC_ROOT, p).split(path.sep).join('/'));
        if (!/^\s+const compare = EXPLORE_COMPARE_ROUTE === true;\s*$/.test(line)) wrong.push(`${path.relative(SRC_ROOT, p)}: ${line.trim()}`);
      });
    }
    expect(wrong).toEqual([]);
    expect(readers.sort()).toEqual(['components/Explore/ExploreHome.jsx', 'components/Explore/ExplorePanel.jsx']);
  });
});
