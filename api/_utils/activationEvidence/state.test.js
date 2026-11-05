// api/_utils/activationEvidence/state.test.js
//
// ID-1 Build 2 — the observer state document's normalisation (contract §4.4).
// The read and write themselves run against the emulator (test/rules/activationObserver.rules.mjs).

import { describe, it, expect } from 'vitest';
import { normalizeState, emptyState, readObserverState } from './state.js';

describe('the state, normalised', () => {
  it('empty when absent, of another version, or not an object', () => {
    for (const raw of [undefined, null, 'x', [], {}, { schemaVersion: 2 }]) expect(normalizeState(raw)).toEqual(emptyState());
  });
  it('keeps well-formed entries and drops anything malformed, never trusting it', () => {
    const s = normalizeState({
      schemaVersion: 1,
      cursors: { dueBattles: 'b-1', ordinaryBattles: 7, dueKeys: '', ordinaryKeys: 'k-1' },
      battles: { 'b-1': { cutoffAt: 1, expiresAt: 'x', finished: 'yes', excludedBy: 'archetype' }, 'b-2': null },
      outstandingKeys: [{ snapshotId: 'k-1', session: '2026-11-04', symbol: 'NVDA', dueAt: 5 }, { snapshotId: 'k-1', session: '2026-11-04', symbol: 'NVDA' }, { snapshotId: 'k-2' }],
      updatedAt: '2026-11-05T01:30:00.000Z',
    });
    expect(s).toEqual({
      schemaVersion: 1,
      cursors: { dueBattles: 'b-1', ordinaryBattles: null, dueKeys: null, ordinaryKeys: 'k-1' },
      battles: { 'b-1': { cutoffAt: 1, expiresAt: null, finished: false, excludedBy: 'archetype' } },
      outstandingKeys: [{ snapshotId: 'k-1', session: '2026-11-04', symbol: 'NVDA', dueAt: 5 }],
      updatedAt: '2026-11-05T01:30:00.000Z',
    });
  });
  it('the carried keys are bounded at 50', () => {
    const keys = Array.from({ length: 80 }, (_, i) => ({ snapshotId: `k-${i}`, session: '2026-11-04', symbol: 'NVDA', dueAt: null }));
    expect(normalizeState({ schemaVersion: 1, outstandingKeys: keys }).outstandingKeys).toHaveLength(50);
  });
  it('an unreadable state reads as empty, counted', async () => {
    const db = { collection: () => ({ doc: () => ({ get: async () => { throw new Error('unavailable'); } }) }) };
    expect(await readObserverState(db)).toEqual({ state: emptyState(), status: 'unreadable' });
  });
});
