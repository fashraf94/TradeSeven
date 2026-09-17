// src/config/anticipationThresholdLintFlags.test.js
//
// The threshold lint — THE FLAG PIN (BUILD_RULES §2), row F-1.
//
// ANTICIPATION_THRESHOLD_LINT_MODE is a STRING TRI-STATE ('off' | 'shadow' |
// 'on'), so the flag-pin guard — which scans `*_ENABLED = true|false` and
// `expect(FLAG).toBe(true|false)` only — cannot see it, and DARK_BY_DESIGN
// cannot HOLD it (its integrity test rejects any key outside the boolean map).
// It is pinned HERE, directly: the VOICE_GROUNDING_MODE (voiceGroundingFlags
// .test.js:54) / MANDATE_TRANSPORT_MODE (mandateFlags.test.js:44) precedent.
//
// The walk is the founder's: 'off' → 'shadow' → 'on', one one-line PR per
// step, and EACH step moves the first row below with it (a flip that leaves a
// pin behind reddens every other open PR into main). A rollback moves it back.
// Nothing else in this file pins a value; the rest are contracts that hold in
// every state so they survive the walk intact.
//
// Deliberately pins ONLY this flag (the characterPaneFlags.test.js precedent):
// pinning a flag obliges its docstring to name this file, so an unrelated flag
// added here "as context" would couple its future flip to this arc.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  ANTICIPATION_THRESHOLD_LINT_MODE,
  ANTICIPATION_THRESHOLD_LINT_MODES,
} from './featureFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');
const CRON = readFileSync(path.join(HERE, '..', '..', 'api', 'cron', 'agent-evaluate.js'), 'utf8');

describe('Threshold lint flag — the pin (BUILD_RULES §2)', () => {
  it("walk step 0: 'off' — the lint is not called and today's path is byte-identical", () => {
    // THE ROW THAT MOVES WITH THE WALK. 'off' → 'shadow' → 'on', each in its
    // own founder PR, each updating this literal in the same commit.
    expect(ANTICIPATION_THRESHOLD_LINT_MODE).toBe('off');
  });

  it('the live value is one of the three walked states', () => {
    expect(ANTICIPATION_THRESHOLD_LINT_MODES).toEqual(['off', 'shadow', 'on']);
    expect(ANTICIPATION_THRESHOLD_LINT_MODES).toContain(ANTICIPATION_THRESHOLD_LINT_MODE);
    expect(Object.isFrozen(ANTICIPATION_THRESHOLD_LINT_MODES)).toBe(true);
  });

  it('the docstring carries the direct-pin pointer (flagPinGuard cannot keep it honest for a string enum)', () => {
    // flagPinGuard's "Pinned by:" integrity row is built from `*_ENABLED` pins,
    // so for this flag the pointer is kept honest HERE instead.
    const idx = SRC.indexOf('export const ANTICIPATION_THRESHOLD_LINT_MODE = ');
    expect(idx).toBeGreaterThan(0);
    const window = SRC.slice(Math.max(0, idx - 400), idx);
    expect(window).toContain('Pinned by: anticipationThresholdLintFlags.test.js');
  });

  it('is NOT registered as a DARK_BY_DESIGN key (a string flag fails that registry) — but IS noted there', () => {
    const guard = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8');
    // not a key…
    expect(guard).not.toMatch(/ANTICIPATION_THRESHOLD_LINT_MODE\s*:/);
    // …but the runway note is present, so a flip is loud where a reader looks.
    expect(guard).toContain('ANTICIPATION_THRESHOLD_LINT_MODE');
    expect(guard).toContain('anticipationThresholdLintFlags.test.js');
  });

  it("the cron reads the flag, and 'on' is the ONLY state that drops a candidate", () => {
    // A contract that holds in every state: the enforcement branch is gated on
    // the 'on' literal, never on "not off" — 'shadow' must never drop.
    expect(CRON).toContain('ANTICIPATION_THRESHOLD_LINT_MODE');
    expect(CRON).toMatch(/ANTICIPATION_THRESHOLD_LINT_MODE === 'on'/);
    expect(CRON).not.toMatch(/ANTICIPATION_THRESHOLD_LINT_MODE !== 'off'/);
  });
});
