// src/config/commandCenterSyncFlags.test.js
//
// Command Center Sync Pass 1 — DARK pin (BUILD_RULES §2). The flag ships FALSE
// on purpose: Pass 1 is built dark and flipped in its own deliberate PR after a
// founder preview smoke.
//
// This row is a tripwire in BOTH directions. An accidental flip to true would
// promote an unsmoked surface to the front door; the flag-pin guard turns that
// into a loud failure naming this file. When the flip IS deliberate, this
// assertion moves to true AND the flag's DARK_BY_DESIGN entry is dropped from
// flagPinGuard.test.js — in the same commit, which is the coupling the guard
// enforces. Referenced by the flag's "Pinned by:" docstring in featureFlags.js.
//
// Deliberately pins ONLY this flag. Pinning a flag obliges its docstring to
// name this file, so adding an unrelated flag here as "context" would couple
// that flag's future flip to this arc's test — the mistake
// leagueBattleviewFlags.test.js:13-17 records.

import { describe, it, expect } from 'vitest';
import { COMMAND_CENTER_SYNC_ENABLED } from './featureFlags.js';

describe('Command Center Sync flags — Pass 1 dark pin (BUILD_RULES §2)', () => {
  it('ships DARK — the Dashboard is byte-identical until a deliberate flip', () => {
    expect(COMMAND_CENTER_SYNC_ENABLED).toBe(false);
  });
});
