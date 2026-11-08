// src/config/researchModalSheetFlag.test.js
//
// Research Modal Build C — THE FLAG PIN (BUILD_RULES §2; spec
// docs/specs/RESEARCH_MODAL_BUILD_C_SHEET_SPEC_V1.md §4.1).
// RESEARCH_MODAL_SHEET_MODE is a STRING TRI-STATE beside Build A's
// RESEARCH_MODAL_BOMB_MODE (researchModalFlags.test.js): pinned directly here
// (the pin, the allowed values, the literal and its Pinned-by pointer), never a
// DARK_BY_DESIGN key — the guard scans `*_ENABLED` booleans only — and noted by
// name in that block instead. A flip moves the first row below in its own
// founder PR.
//
// This file is the pin, not a behaviour test: the mode-off goldens and the gate
// rows mock the flag explicitly, so none of them moves with a flip.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { RESEARCH_MODAL_SHEET_MODE, RESEARCH_MODAL_SHEET_MODES } from './researchModalFlags.js';

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

describe('RESEARCH_MODAL_SHEET_MODE — the pin (BUILD_RULES §2; Build C spec §4.1)', () => {
  it("is 'off' — a kill switch: roll back one step at a time ('on' → 'allowlist' → 'off') by moving the literal and its pin together; every mode-off arm stays in the code until the cleanup PR, after 'on' has run in production", () => {
    // THE ROW THAT MOVES WITH A FLIP ('off' → 'allowlist' → 'on'), in the flip PR's own commit; a rollback moves it back.
    expect(RESEARCH_MODAL_SHEET_MODE).toBe('off');
  });

  it('the allowed values: exactly off · allowlist · on, frozen, in walk order, and the shipped value is one of them', () => {
    expect(RESEARCH_MODAL_SHEET_MODES).toEqual(['off', 'allowlist', 'on']);
    expect(Object.isFrozen(RESEARCH_MODAL_SHEET_MODES)).toBe(true);
    expect(RESEARCH_MODAL_SHEET_MODES).toContain(RESEARCH_MODAL_SHEET_MODE);
    expect(typeof RESEARCH_MODAL_SHEET_MODE).toBe('string');
  });

  it('is a plain string literal with a Pinned-by pointer naming this file, and its runway, rollback and per-battle allowlist are written beside it', () => {
    expect(SRC).toMatch(/^export const RESEARCH_MODAL_SHEET_MODE = '(off|allowlist|on)';$/m);
    const idx = SRC.indexOf('export const RESEARCH_MODAL_SHEET_MODE = ');
    const preceding = SRC.slice(0, idx).split('\n').slice(-2).join('\n');
    expect(preceding).toContain('Pinned by: researchModalSheetFlag.test.js');
    const doc = docstringOf('RESEARCH_MODAL_SHEET_MODE');
    expect(doc).toContain('RUNWAY:');
    expect(doc).toContain('Never a build PR');
    expect(doc).toContain('PER AGENT BATTLE');
    expect(doc).toContain('cockpit-status');
    expect(doc).toContain('ROLLBACK');
    expect(doc).toContain('byte for byte');
    expect(doc.replace(/\n \* ?/g, ' ')).toContain(ROLLBACK);
    expect(SELF).toContain(`"is '${RESEARCH_MODAL_SHEET_MODE}' — ${ROLLBACK}"`);
  });

  it('never a DARK_BY_DESIGN key (the guard scans *_ENABLED booleans only), but noted by name in that block', () => {
    expect(GUARD).not.toMatch(/^\s*RESEARCH_MODAL_SHEET_MODE\s*:/m);
    expect(GUARD).toContain('RESEARCH_MODAL_SHEET_MODE intentionally ABSENT');
    expect(GUARD).toContain('researchModalSheetFlag.test.js asserts both halves');
  });

  it('no boolean twin exists, and the flag is not a line in featureFlags.js (the entry-chunk reason in the module header)', () => {
    expect(SRC).not.toMatch(/^export const RESEARCH_MODAL_SHEET_ENABLED\b/m);
    expect(FEATURE_FLAGS).not.toMatch(/RESEARCH_MODAL_SHEET/);
  });
});
