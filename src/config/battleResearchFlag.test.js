// src/config/battleResearchFlag.test.js
//
// Battle Research Slice 1 — THE FLAG PIN (BUILD_RULES §2; spec
// docs/specs/BATTLE_RESEARCH_SLICE1_SPEC_V1.md BRS-3). BATTLE_RESEARCH_MODE is
// a STRING TRI-STATE beside the shell's RESEARCH_MODAL_SHEET_MODE
// (researchModalSheetFlag.test.js): pinned directly here (the pin, the allowed
// values, the literal and its Pinned-by pointer), never a DARK_BY_DESIGN key —
// the guard scans `*_ENABLED` booleans only — and noted by name in that block
// instead. A flip moves the first row below in its own PR (C: 'allowlist').
//
// This file is the pin, not a behaviour test: the mode-off goldens and the gate
// rows mock the flag explicitly, so none of them moves with a flip.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { BATTLE_RESEARCH_MODE, BATTLE_RESEARCH_MODES } from './researchModalFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'researchModalFlags.js'), 'utf8').replace(/\r\n/g, '\n');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8').replace(/\r\n/g, '\n');
const FEATURE_FLAGS = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');
const SELF = readFileSync(fileURLToPath(import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const docstringOf = (name) => {
  const idx = SRC.indexOf(`export const ${name} = `);
  const prev = SRC.lastIndexOf('/**', idx);
  return SRC.slice(prev, idx);
};
const ROLLBACK = "a kill switch: roll back one step at a time ('on' → 'allowlist' → 'off') by moving the literal and its pin together; every mode-off arm stays in the code until the cleanup PR, after 'on' has run in production";

describe('BATTLE_RESEARCH_MODE — the pin (BUILD_RULES §2; spec BRS-3)', () => {
  it("is 'allowlist' — a kill switch: roll back one step at a time ('on' → 'allowlist' → 'off') by moving the literal and its pin together; every mode-off arm stays in the code until the cleanup PR, after 'on' has run in production", () => {
    // THE ROW THAT MOVES WITH A FLIP ('off' → 'allowlist' → 'on'), in the flip PR's own commit; a rollback moves it back.
    expect(BATTLE_RESEARCH_MODE).toBe('allowlist');
  });

  it('the allowed values: exactly off · allowlist · on, frozen, in walk order, and the shipped value is one of them', () => {
    expect(BATTLE_RESEARCH_MODES).toEqual(['off', 'allowlist', 'on']);
    expect(Object.isFrozen(BATTLE_RESEARCH_MODES)).toBe(true);
    expect(BATTLE_RESEARCH_MODES).toContain(BATTLE_RESEARCH_MODE);
    expect(typeof BATTLE_RESEARCH_MODE).toBe('string');
  });

  it('is a plain string literal with a Pinned-by pointer naming this file, and its runway, rollback and per-battle allowlist are written beside it', () => {
    expect(SRC).toMatch(/^export const BATTLE_RESEARCH_MODE = '(off|allowlist|on)';$/m);
    const idx = SRC.indexOf('export const BATTLE_RESEARCH_MODE = ');
    const preceding = SRC.slice(0, idx).split('\n').slice(-2).join('\n');
    expect(preceding).toContain('Pinned by: battleResearchFlag.test.js');
    const doc = docstringOf('BATTLE_RESEARCH_MODE');
    expect(doc).toContain('RUNWAY:');
    expect(doc).toContain('Never a build');
    expect(doc).toContain('PER AGENT BATTLE');
    expect(doc).toContain('cockpit-status');
    expect(doc).toContain('isCockpitOwnerAllowlisted');
    expect(doc).toContain('ROLLBACK');
    expect(doc).toContain('byte for byte');
    expect(doc.replace(/\n \* ?/g, ' ')).toContain(ROLLBACK);
    // The docstring names the live value (a flip or a rollback moves this line with the literal).
    expect(doc.replace(/\n \* ?/g, ' ')).toContain(`CURRENT: '${BATTLE_RESEARCH_MODE}'`);
    expect(SELF).toContain(`"is '${BATTLE_RESEARCH_MODE}' — ${ROLLBACK}"`);
  });

  it('never a DARK_BY_DESIGN key (the guard scans *_ENABLED booleans only), but noted by name in that block', () => {
    expect(GUARD).not.toMatch(/^\s*BATTLE_RESEARCH_MODE\s*:/m);
    expect(GUARD).toContain('BATTLE_RESEARCH_MODE intentionally ABSENT');
    expect(GUARD).toContain('battleResearchFlag.test.js asserts both halves');
  });

  it('no boolean twin exists, and the flag is not a line in featureFlags.js (the entry-chunk reason in the module header)', () => {
    expect(SRC).not.toMatch(/^export const BATTLE_RESEARCH_ENABLED\b/m);
    expect(FEATURE_FLAGS).not.toMatch(/BATTLE_RESEARCH/);
  });
});
