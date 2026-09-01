// src/config/commandCenterSyncFlags.test.js
//
// Command Center Sync Pass 1 — LIVE pin (BUILD_RULES §2). The flag was built
// dark and flipped in its own one-commit PR after the pre-flip list landed;
// this assertion moved to true in that same commit, together with dropping the
// flag's DARK_BY_DESIGN entry from flagPinGuard.test.js — the coupling the
// guard enforces.
//
// It stays a loud tripwire, now in the other direction: an accidental revert to
// false is a silent rollback of the whole Pass 1 surface — the Desk, the phase
// slots and the Huddle tab label all disappear at once, and every render test
// still passes, because flag-off byte-identity is exactly what they assert. This
// row is what says so. A DELIBERATE rollback moves it back to false and restores
// the DARK_BY_DESIGN entry, in one commit.
//
// Referenced by the flag's "Pinned by:" docstring in featureFlags.js.
//
// Deliberately pins ONLY this flag. Pinning a flag obliges its docstring to
// name this file, so adding an unrelated flag here as "context" would couple
// that flag's future flip to this arc's test — the mistake
// leagueBattleviewFlags.test.js:13-17 records.

import { describe, it, expect } from 'vitest';
import { COMMAND_CENTER_SYNC_ENABLED } from './featureFlags.js';

describe('Command Center Sync flags — Pass 1 live pin (BUILD_RULES §2)', () => {
  it('is LIVE — the Desk, the phase slots and the Huddle tab label all ship', () => {
    expect(COMMAND_CENTER_SYNC_ENABLED).toBe(true);
  });
});
