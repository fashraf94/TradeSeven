// src/config/sharedResearchFlags.test.js
//
// Shared Research B1 — THE FLAG PIN (BUILD_RULES §2; spec
// docs/specs/20261109_SHARED_RESEARCH_B1_B2_BUILD_SPEC_V1_2.md §6.1, §6.2, K-2).
// SHARED_RESEARCH_MODE is a STRING TRI-STATE in its own module: pinned directly
// here (the pin, the allowed values, the literal and its Pinned-by pointer),
// never a DARK_BY_DESIGN key — the guard scans `*_ENABLED` booleans only — and
// noted by name in that block instead. A flip moves the first row below in its
// own founder PR.
//
// This file is the pin, not a behaviour test: the gate rows
// (api/_utils/sharedResearch/gate.test.js) mock the mode explicitly, so none of
// them moves with a flip.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { SHARED_RESEARCH_MODE, SHARED_RESEARCH_MODES } from './sharedResearchFlags.js';
import { SHARED_RESEARCH_BUILDER_MODE, SHARED_RESEARCH_BUILDER_MODES } from './sharedResearchFlags.js';
import { SHARED_RESEARCH_UNIVERSE_MODE, SHARED_RESEARCH_UNIVERSE_MODES } from './sharedResearchFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'sharedResearchFlags.js'), 'utf8').replace(/\r\n/g, '\n');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8').replace(/\r\n/g, '\n');
const FEATURE_FLAGS = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');
const SELF = readFileSync(fileURLToPath(import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const ROLLBACK = "a kill switch: roll back one step at a time ('on' → 'allowlist' → 'off') by moving the literal and its pin together; every mode-off arm stays in the code until the cleanup PR, after 'on' has run in production";

describe('SHARED_RESEARCH_MODE — the pin (BUILD_RULES §2; spec §6.2, K-2)', () => {
  it("is 'allowlist' — a kill switch: roll back one step at a time ('on' → 'allowlist' → 'off') by moving the literal and its pin together; every mode-off arm stays in the code until the cleanup PR, after 'on' has run in production", () => {
    // THE ROW THAT MOVES WITH A FLIP ('off' → 'allowlist' → 'on'), in the flip PR's own commit; a rollback moves it back.
    expect(SHARED_RESEARCH_MODE).toBe('allowlist');
  });

  it('the allowed values: exactly off · allowlist · on, frozen, in walk order, and the shipped value is one of them', () => {
    expect(SHARED_RESEARCH_MODES).toEqual(['off', 'allowlist', 'on']);
    expect(Object.isFrozen(SHARED_RESEARCH_MODES)).toBe(true);
    expect(SHARED_RESEARCH_MODES).toContain(SHARED_RESEARCH_MODE);
    expect(typeof SHARED_RESEARCH_MODE).toBe('string');
  });

  it('is a plain string literal with a Pinned-by pointer naming this file, and its runway and rollback are written beside it', () => {
    expect(SRC).toMatch(/^export const SHARED_RESEARCH_MODE = '(off|allowlist|on)';$/m);
    const idx = SRC.indexOf('export const SHARED_RESEARCH_MODE = ');
    const preceding = SRC.slice(0, idx).split('\n').slice(-2).join('\n');
    expect(preceding).toContain('Pinned by: sharedResearchFlags.test.js');
    const doc = SRC.slice(SRC.lastIndexOf('/**', idx), idx);
    expect(doc).toContain('RUNWAY:');
    expect(doc).toContain('Never a build PR');
    expect(doc).toContain('isCockpitOwnerAllowlisted');
    expect(doc).toContain('hypothesisRecordsOnFor');
    expect(doc).toContain(ROLLBACK);
    expect(SELF).toContain(`"is '${SHARED_RESEARCH_MODE}' — ${ROLLBACK}"`);
  });

  it('imports nothing (the server imports it under the BUILD_RULES §4 rule) and is never read at module scope by itself', () => {
    expect(SRC).not.toMatch(/^\s*import\b/m);
    expect(SRC).not.toMatch(/\brequire\(/);
  });

  it('never a DARK_BY_DESIGN key (the guard scans *_ENABLED booleans only), but noted by name in that block', () => {
    expect(GUARD).not.toMatch(/^\s*SHARED_RESEARCH_MODE\s*:/m);
    expect(GUARD).toContain('SHARED_RESEARCH_MODE intentionally ABSENT');
    expect(GUARD).toContain('sharedResearchFlags.test.js asserts both halves');
  });

  it('no boolean twin exists, and the flag is not a line in featureFlags.js (the entry-chunk reason in the module header)', () => {
    expect(SRC).not.toMatch(/^export const SHARED_RESEARCH_ENABLED\b/m);
    expect(FEATURE_FLAGS).not.toMatch(/SHARED_RESEARCH/);
  });
});

// Amendment B §B2 (B3, K-2): the thesis builder's switch, in the same module, pinned the same way.
const BUILDER_ROLLBACK = 'move the literal back to \'off\' with its pin: new investigations open as ledgers; open builder sessions keep working';

describe('SHARED_RESEARCH_BUILDER_MODE — the pin (BUILD_RULES §2; Amendment B §B2, K-2)', () => {
  it("is 'on' — move the literal back to 'off' with its pin: new investigations open as ledgers; open builder sessions keep working", () => {
    // THE ROW THAT MOVES WITH THE FLIP ('off' → 'on'), in the founder's flip PR (§B9 step 3); a rollback moves it back.
    expect(SHARED_RESEARCH_BUILDER_MODE).toBe('on');
  });

  it('the allowed values: exactly off · on, frozen, and the shipped value is one of them', () => {
    expect(SHARED_RESEARCH_BUILDER_MODES).toEqual(['off', 'on']);
    expect(Object.isFrozen(SHARED_RESEARCH_BUILDER_MODES)).toBe(true);
    expect(SHARED_RESEARCH_BUILDER_MODES).toContain(SHARED_RESEARCH_BUILDER_MODE);
  });

  it('is a plain string literal with a Pinned-by pointer naming this file, and its runway and rollback are written beside it', () => {
    expect(SRC).toMatch(/^export const SHARED_RESEARCH_BUILDER_MODE = '(off|on)';$/m);
    const idx = SRC.indexOf('export const SHARED_RESEARCH_BUILDER_MODE = ');
    expect(SRC.slice(0, idx).split('\n').slice(-2).join('\n')).toContain('Pinned by: sharedResearchFlags.test.js');
    const doc = SRC.slice(SRC.lastIndexOf('/**', idx), idx);
    expect(doc).toContain('RUNWAY:');
    expect(doc).toContain('Never a build PR');
    expect(doc).toContain('sharedResearchBuilderMode()');
    expect(doc).toContain(BUILDER_ROLLBACK);
    expect(SELF).toContain(`"is '${SHARED_RESEARCH_BUILDER_MODE}' — ${BUILDER_ROLLBACK}"`);
  });

  it('never a DARK_BY_DESIGN key, but noted by name in that block', () => {
    expect(GUARD).not.toMatch(/^\s*SHARED_RESEARCH_BUILDER_MODE\s*:/m);
    expect(GUARD).toContain('SHARED_RESEARCH_BUILDER_MODE intentionally ABSENT');
  });
});

// Build 3b (research universe; RU-22): the research universe's switch, in the same module, pinned the same way.

const UNIVERSE_ROLLBACK = 'move the literal back one step with its pin: new investigations open on the game list; open research investigations keep their stamp';

describe('SHARED_RESEARCH_UNIVERSE_MODE — the pin (BUILD_RULES §2; Build 3b, RU-22)', () => {
  it("is 'founder' — move the literal back one step with its pin: new investigations open on the game list; open research investigations keep their stamp", () => {
    // THE ROW THAT MOVES WITH A FLIP ('off' → 'founder' → 'on'), in the founder's flip PR; a rollback moves it back.
    expect(SHARED_RESEARCH_UNIVERSE_MODE).toBe('founder');
  });

  it('the allowed values: exactly off · founder · on, frozen, in walk order, and the shipped value is one of them', () => {
    expect(SHARED_RESEARCH_UNIVERSE_MODES).toEqual(['off', 'founder', 'on']);
    expect(Object.isFrozen(SHARED_RESEARCH_UNIVERSE_MODES)).toBe(true);
    expect(SHARED_RESEARCH_UNIVERSE_MODES).toContain(SHARED_RESEARCH_UNIVERSE_MODE);
  });

  it('is a plain string literal with a Pinned-by pointer naming this file, and its runway and rollback are written beside it', () => {
    expect(SRC).toMatch(/^export const SHARED_RESEARCH_UNIVERSE_MODE = '(off|founder|on)';$/m);
    const idx = SRC.indexOf('export const SHARED_RESEARCH_UNIVERSE_MODE = ');
    expect(SRC.slice(0, idx).split('\n').slice(-2).join('\n')).toContain('Pinned by: sharedResearchFlags.test.js');
    const doc = SRC.slice(SRC.lastIndexOf('/**', idx), idx);
    expect(doc).toContain('RUNWAY:');
    expect(doc).toContain('Never a build PR');
    expect(doc).toContain('universeModeNow()');
    expect(doc).toContain('readPracticeFieldFounderList');
    expect(doc.replace(/\s*\n\s*\*\s*/g, ' ')).toContain(UNIVERSE_ROLLBACK);
    expect(SELF).toContain(`"is '${SHARED_RESEARCH_UNIVERSE_MODE}' — ${UNIVERSE_ROLLBACK}"`);
  });

  it('never a DARK_BY_DESIGN key, but noted by name in that block', () => {
    expect(GUARD).not.toMatch(/^\s*SHARED_RESEARCH_UNIVERSE_MODE\s*:/m);
    expect(GUARD).toContain('SHARED_RESEARCH_UNIVERSE_MODE intentionally ABSENT');
  });
});
