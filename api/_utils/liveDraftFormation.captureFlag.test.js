// api/_utils/liveDraftFormation.captureFlag.test.js
//
// Finding #5 (P5 reconciliation) — the flag-ON stamp-parity proof. With
// LEAGUE_CANONICAL_OPEN_CAPTURE ON, claimSlotSeat must stamp
// baselinePolicy: CANONICAL_OPEN — IDENTICAL to formGroupFromLobby
// (liveDraftFormation.js:255 mirrors the lobby formation stamp) — so a slot pod
// is byte-identical downstream to a single-shot pod formed under the same flag.
// The flag-OFF omission ('baselinePolicy' in g === false) is covered by
// liveDraftFormation.test.js; this file exercises the ON branch, which the
// capstone e2e models by hand rather than driving.
//
// A separate file because the flag is a module-load-time import: vi.mock is
// hoisted, so the whole file runs with the capture flag ON (the flag-OFF battery
// would break under it). importOriginal preserves every OTHER export.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  LEAGUE_CANONICAL_OPEN_CAPTURE: true,
}));

import { claimSlotSeat, slotGroupId } from './liveDraftFormation.js';
import { BASELINE_POLICY, TOURNAMENT_GROUPS_COLLECTION } from '../../src/constants/leagueTournament.js';

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// minimal in-memory Firestore: doc + array-contains/equality where + single-pass tx.
function makeDb(initial = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]));
  const snap = (p) => ({ exists: store.has(p), id: p.split('/').pop(), data: () => structuredClone(store.get(p)) });
  const db = {
    collection: (name) => ({
      doc: (id) => ({ path: `${name}/${id}`, get: async () => snap(`${name}/${id}`) }),
      where: (field, op, value) => ({
        get: async () => {
          const docs = [];
          for (const [path, data] of store.entries()) {
            if (!path.startsWith(`${name}/`) || path.slice(name.length + 1).includes('/')) continue;
            const fv = data[field];
            const match = op === 'array-contains' ? (Array.isArray(fv) && fv.includes(value)) : fv === value;
            if (match) docs.push({ id: path.split('/').pop(), data: () => structuredClone(data) });
          }
          return { docs, empty: docs.length === 0, size: docs.length, forEach: (cb) => docs.forEach(cb) };
        },
      }),
    }),
    runTransaction: async (fn) => fn({
      get: async (ref) => snap(ref.path),
      set: (ref, data) => store.set(ref.path, structuredClone(data)),
      update: (ref, patch) => { const d = store.get(ref.path); Object.assign(d, patch); },
      delete: (ref) => store.delete(ref.path),
    }),
  };
  return { db, store };
}

describe('claimSlotSeat under LEAGUE_CANONICAL_OPEN_CAPTURE (finding #5)', () => {
  it('stamps baselinePolicy: CANONICAL_OPEN — parity with formGroupFromLobby', async () => {
    const { db, store } = makeDb();
    await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'userA', now: new Date('2026-07-06T12:00:00.000Z') });
    const g = store.get(`${TOURNAMENT_GROUPS_COLLECTION}/${slotGroupId('wed-1900', '2026-07-08')}`);
    expect(g.baselinePolicy).toBe(BASELINE_POLICY.CANONICAL_OPEN);
  });
});
