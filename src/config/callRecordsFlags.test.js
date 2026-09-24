// src/config/callRecordsFlags.test.js
//
// The cockpit's call records — THE FLAG PIN (BUILD_RULES §2; spec
// docs/design/COCKPIT_SPEC_V1_3.md §2).
//
// CALL_RECORDS_MODE is a STRING TRI-STATE ('off' | 'shadow' | 'on'), so the
// flag-pin guard — which scans `*_ENABLED = true|false` and
// `expect(FLAG).toBe(true|false)` only — cannot see it, and DARK_BY_DESIGN
// cannot hold it (its integrity test rejects any key outside the boolean map).
// It is pinned HERE, directly: the ANTICIPATION_THRESHOLD_LINT_MODE
// (anticipationThresholdLintFlags.test.js) / VOICE_GROUNDING_MODE precedent.
//
// RUNWAY (the walk, stated where the pin lives): 'off' ships with Build 0.
// 'off' → 'shadow' is the founder's own one-line PR after Build 0 merges and
// the `calls` composite index is deployed — never a build PR. 'shadow' →
// 'on' waits on Build 1 (sweep worker, answer endpoint, directive family,
// calls block) and Build 2 (the UI). EACH step moves the first row below in
// the same commit (a flip that leaves a pin behind reddens every other open PR
// into main); a rollback moves it back. Nothing else in this file pins a
// value — the rest are contracts that hold in every state.
//
// Dependency-surface guard (BUILD_RULES §4): the import of
// api/_utils/callRecords/mode.js below is the runtime guard that the resolver
// the cron uses stays Node-clean; it is never mocked.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { CALL_RECORDS_MODE, CALL_RECORDS_MODES } from './featureFlags.js';
import { resolveCallRecordsMode } from '../../api/_utils/callRecords/mode.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8');

describe('CALL_RECORDS_MODE — the pin (BUILD_RULES §2)', () => {
  it("walk step 0: 'off' — no schema property, no reserve, no record read or written", () => {
    // THE ROW THAT MOVES WITH THE WALK. 'off' → 'shadow' → 'on', each in its
    // own founder PR, each updating this literal in the same commit.
    expect(CALL_RECORDS_MODE).toBe('off');
  });

  it('the mode list is the three walked states, in walk order, frozen — and holds the live value', () => {
    expect(CALL_RECORDS_MODES).toEqual(['off', 'shadow', 'on']);
    expect(Object.isFrozen(CALL_RECORDS_MODES)).toBe(true);
    expect(CALL_RECORDS_MODES).toContain(CALL_RECORDS_MODE);
  });

  it('the docstring carries the direct-pin pointer and the runway (flagPinGuard cannot keep either honest for a string enum)', () => {
    const idx = SRC.indexOf('export const CALL_RECORDS_MODE = ');
    expect(idx).toBeGreaterThan(0);
    const window = SRC.slice(Math.max(0, idx - 3000), idx);
    expect(window).toContain('Pinned by: callRecordsFlags.test.js');
    expect(window).toContain('RUNWAY:');
    expect(window).toContain("'off' → 'shadow'");
    expect(window).toContain('never a build PR');
  });

  it('is NEVER a DARK_BY_DESIGN key (a string flag fails that registry)', () => {
    expect(GUARD).not.toMatch(/CALL_RECORDS_MODE\s*:/);
  });

  it('the resolver returns the live value (one of the walked states)', () => {
    expect(resolveCallRecordsMode()).toBe(CALL_RECORDS_MODE);
  });
});
