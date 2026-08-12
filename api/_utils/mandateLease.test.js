// api/_utils/mandateLease.test.js
// Spec 1 §3.1 (Q3) — owner-token lease: release/renew preconditioned on token
// match; a stale token can never steal, renew, or release a live lease.

import { describe, it, expect } from 'vitest';
import { mintOwnerToken, acquireLease, renewLease, releaseLease } from './mandateLease.js';

function makeFakeDb(seed = {}) {
  const store = new Map(Object.entries(seed));
  const ref = (path) => ({
    path,
    async get() { const d = store.get(path); return { exists: d !== undefined, data: () => d }; },
    async set(data, opts) {
      if (opts?.merge && store.has(path)) store.set(path, { ...store.get(path), ...data });
      else store.set(path, data);
    },
  });
  return {
    _store: store,
    doc: (path) => ref(path),
    async runTransaction(fn) {
      return fn({
        get: (r) => r.get(),
        set: (r, d, o) => r.set(d, o),
      });
    },
  };
}

const NOW = new Date('2026-08-12T14:00:00Z');

describe('acquireLease', () => {
  it('claims a free book', async () => {
    const db = makeFakeDb({ 'mandates/m1': { revision: 3 } });
    const r = await acquireLease(db, db.doc('mandates/m1'), 'tokA', { now: NOW });
    expect(r.acquired).toBe(true);
    expect(db._store.get('mandates/m1').lease.ownerToken).toBe('tokA');
    // lease write does not touch revision (§3.1 — not a book mutation)
    expect(db._store.get('mandates/m1').revision).toBe(3);
  });

  it('refuses a book held by another unexpired owner', async () => {
    const db = makeFakeDb({ 'mandates/m1': {} });
    await acquireLease(db, db.doc('mandates/m1'), 'tokA', { now: NOW, ttlMs: 300000 });
    const r = await acquireLease(db, db.doc('mandates/m1'), 'tokB', { now: new Date(NOW.getTime() + 1000) });
    expect(r.acquired).toBe(false);
    expect(r.reason).toBe('held');
    expect(r.heldBy).toBe('tokA');
  });

  it('same owner re-acquires (idempotent re-entry)', async () => {
    const db = makeFakeDb({ 'mandates/m1': {} });
    await acquireLease(db, db.doc('mandates/m1'), 'tokA', { now: NOW });
    const r = await acquireLease(db, db.doc('mandates/m1'), 'tokA', { now: new Date(NOW.getTime() + 1000) });
    expect(r.acquired).toBe(true);
  });

  it('an expired lease can be claimed by a new owner', async () => {
    const db = makeFakeDb({ 'mandates/m1': {} });
    await acquireLease(db, db.doc('mandates/m1'), 'tokA', { now: NOW, ttlMs: 1000 });
    const later = new Date(NOW.getTime() + 5000); // past the 1s TTL
    const r = await acquireLease(db, db.doc('mandates/m1'), 'tokB', { now: later });
    expect(r.acquired).toBe(true);
    expect(db._store.get('mandates/m1').lease.ownerToken).toBe('tokB');
  });

  it('fails closed on a missing book', async () => {
    const db = makeFakeDb({});
    const r = await acquireLease(db, db.doc('mandates/gone'), 'tokA', { now: NOW });
    expect(r).toEqual({ acquired: false, reason: 'no_such_book' });
  });
});

describe('renewLease / releaseLease — token-match precondition', () => {
  it('only the owner renews', async () => {
    const db = makeFakeDb({ 'mandates/m1': {} });
    await acquireLease(db, db.doc('mandates/m1'), 'tokA', { now: NOW, ttlMs: 1000 });
    const notOwner = await renewLease(db, db.doc('mandates/m1'), 'tokB', { now: NOW });
    expect(notOwner).toEqual({ renewed: false, reason: 'not_owner' });
    const owner = await renewLease(db, db.doc('mandates/m1'), 'tokA', { now: new Date(NOW.getTime() + 500), ttlMs: 1000 });
    expect(owner.renewed).toBe(true);
    // renewal pushed expiry out
    expect(db._store.get('mandates/m1').lease.expiresAt.getTime()).toBe(NOW.getTime() + 500 + 1000);
  });

  it('only the owner releases; a stale token cannot stomp the live lease', async () => {
    const db = makeFakeDb({ 'mandates/m1': {} });
    await acquireLease(db, db.doc('mandates/m1'), 'tokA', { now: NOW });
    const stale = await releaseLease(db, db.doc('mandates/m1'), 'tokStale');
    expect(stale).toEqual({ released: false, reason: 'not_owner' });
    expect(db._store.get('mandates/m1').lease.ownerToken).toBe('tokA'); // untouched
    const owner = await releaseLease(db, db.doc('mandates/m1'), 'tokA');
    expect(owner.released).toBe(true);
    expect(db._store.get('mandates/m1').lease).toBe(null);
  });
});

describe('mintOwnerToken', () => {
  it('mints distinct nonces', () => {
    expect(mintOwnerToken()).not.toBe(mintOwnerToken());
  });
});
