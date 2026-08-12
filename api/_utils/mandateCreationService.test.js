// api/_utils/mandateCreationService.test.js
//
// Unit-level coverage of the creation LOGIC (§5.2). The true write-write
// conflict that guarantees one-active-book uniqueness is a Firestore runtime
// property (same-doc claim on userMeta/{uid}, mirroring reserveSymbol); it is
// exercised in the emulator/acceptance harness. Here we verify the branch logic
// the transaction runs: fresh create, existing-book rejection, idempotent replay,
// unknown archetype, and the seeded shape.

import { describe, it, expect } from 'vitest';
import { createMandate } from './mandateCreationService.js';
import { deriveManagerAgentId } from './mandateSchema.js';
import { listArchetypeIds } from './archetypeRegistry.js';
import { MANDATE_STARTING_CAPITAL, MANDATE_ESCAPE_HATCH_WINDOW_DAYS } from './mandateConfig.js';

const CODE = listArchetypeIds()[0];
const NOW = new Date('2026-08-12T12:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function makeFakeDb(seed = {}) {
  const store = new Map(Object.entries(seed));
  let auto = 0;
  const setInto = (path, data, opts) => {
    const prev = store.get(path);
    store.set(path, opts && opts.merge && prev ? { ...prev, ...data } : data);
  };
  const db = {
    collection: (col) => ({
      doc: (id) => {
        const path = `${col}/${id ?? `auto_${++auto}`}`;
        return {
          path,
          id: path.split('/').pop(),
          get: async () => ({ exists: store.has(path), data: () => store.get(path) }),
          set: (data, opts) => setInto(path, data, opts),
        };
      },
    }),
    runTransaction: async (fn) => fn({
      get: async (ref) => ({ exists: store.has(ref.path), data: () => store.get(ref.path) }),
      set: (ref, data, opts) => setInto(ref.path, data, opts),
    }),
  };
  return { db, store };
}

describe('createMandate — fresh create (§5.2)', () => {
  it('mints, pins, seeds and claims in one flow', async () => {
    const { db, store } = makeFakeDb();
    const res = await createMandate(db, { userId: 'u1', archetype: CODE, now: NOW });

    expect(res.ok).toBe(true);
    expect(res.mandateId).toBeTruthy();
    expect(res.managerAgentId).toBe(deriveManagerAgentId('u1', CODE)); // FR-7 stable id
    expect(res.vintageRef).toMatch(new RegExp(`^archetypeVintages/${CODE}_[0-9a-f]{64}$`));
    expect(res.quarterKey).toBe(`${res.mandateId}:1`);

    // escapeHatchEligibleUntil = createdAt + 14d exactly (§5.2)
    expect(res.escapeHatchEligibleUntil.getTime())
      .toBe(NOW.getTime() + MANDATE_ESCAPE_HATCH_WINDOW_DAYS * DAY_MS);
    // nextRolloverAt is a session close after createdAt (I4)
    expect(res.nextRolloverAt.getTime()).toBeGreaterThan(NOW.getTime());

    // the book was written and seeded at $10M with the pinned vintage
    const book = store.get(`mandates/${res.mandateId}`);
    expect(book.userId).toBe('u1');
    expect(book.status).toBe('active');
    expect(book.revision).toBe(0);
    expect(book.portfolio.cash).toBe(MANDATE_STARTING_CAPITAL);
    expect(book.vintageRef).toBe(res.vintageRef);

    // the active-book claim + escape flag were written on userMeta in the SAME flow
    const meta = store.get('userMeta/u1');
    expect(meta.activeMandateId).toBe(res.mandateId);
    expect(meta.mandateEscapeHatchUsed).toBe(false);
  });
});

describe('createMandate — one active book per user (§5.2 same-doc claim)', () => {
  it('rejects when the user already holds an active book (no new book written)', async () => {
    const { db, store } = makeFakeDb({ 'userMeta/u1': { activeMandateId: 'EXISTING' } });
    const res = await createMandate(db, { userId: 'u1', archetype: CODE, now: NOW });
    expect(res.ok).toBe(false);
    expect(res.code).toBe('active_book_exists');
    expect(res.activeMandateId).toBe('EXISTING');
    // the claim was not overwritten
    expect(store.get('userMeta/u1').activeMandateId).toBe('EXISTING');
  });

  it('idempotent replay: a retry with the SAME requestKey returns the book it created (§7)', async () => {
    const { db } = makeFakeDb({
      'userMeta/u1': { activeMandateId: 'MID_PREV', lastCreateRequestKey: 'req-1' },
    });
    const res = await createMandate(db, { userId: 'u1', archetype: CODE, now: NOW, requestKey: 'req-1' });
    expect(res.ok).toBe(true);
    expect(res.idempotentReplay).toBe(true);
    expect(res.mandateId).toBe('MID_PREV');
  });

  it('a DIFFERENT requestKey against an active book still rejects (not a replay)', async () => {
    const { db } = makeFakeDb({
      'userMeta/u1': { activeMandateId: 'MID_PREV', lastCreateRequestKey: 'req-1' },
    });
    const res = await createMandate(db, { userId: 'u1', archetype: CODE, now: NOW, requestKey: 'req-2' });
    expect(res.ok).toBe(false);
    expect(res.code).toBe('active_book_exists');
  });
});

describe('createMandate — validation', () => {
  it('rejects an unknown archetype (fail-closed)', async () => {
    const { db } = makeFakeDb();
    const res = await createMandate(db, { userId: 'u1', archetype: 'not_real', now: NOW });
    expect(res.ok).toBe(false);
    expect(res.code).toBe('unknown_archetype');
  });

  it('requires db and userId', async () => {
    const { db } = makeFakeDb();
    await expect(createMandate(null, { userId: 'u1', archetype: CODE })).rejects.toThrow();
    await expect(createMandate(db, { userId: '', archetype: CODE })).rejects.toThrow();
  });
});
