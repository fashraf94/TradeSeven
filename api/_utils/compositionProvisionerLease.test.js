// api/_utils/compositionProvisionerLease.test.js
//
// Composition PR 4 — ledger item B2 acceptance: the provisioner lease.
//   (1) a provisioner holding a lease acquired pre-close BLOCKS the drain
//       until it exits (the close cannot reach its watermark);
//   (2) acquisition against a closing/closed epoch REJECTS with zero writes
//       (a provisioner that hasn't acquired cannot start);
//   (3) a provisioner stalled past its TTL cannot land another write phase
//       (assertLeaseCurrent) — and the TTL bounds the drain wait for a
//       crashed holder;
//   (4) interrupted provisioning stays RE-ENTRANT with the subcollections-
//       first order preserved (the trainingClone provisioning order, driven
//       lit through the real provisioner).
//
// Dark posture (A23) is proven with the REAL config module (flag false in
// production): zero reads, zero writes, no-op lease.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const flagState = { fence: true };
vi.mock('./compositionConfig.js', () => ({
  get COMPOSITION_ENFORCEMENT_MODE() { return 'off'; },
  get COMPOSITION_EPOCH_FENCE_ENABLED() { return flagState.fence; },
  get COMPOSITION_MIGRATION_FEED_ENABLED() { return false; },
  get COMPOSITION_COMPILED_IDENTITY_ENABLED() { return false; },
}));

const {
  acquireProvisionerLease, assertLeaseCurrent, releaseProvisionerLease,
  listActiveProvisionerLeases, drainProvisionerLeases,
  PROVISIONER_LEASE_COLLECTION, PROVISIONER_LEASE_TTL_MS, ProvisionerLeaseExpiredError,
} = await import('./compositionProvisionerLease.js');
const { ensureTrainingClones } = await import('./trainingClone.js');
const { makeInMemoryDb } = await import('./__fixtures__/inMemoryFirestore.js');

const T0 = new Date('2026-08-07T15:00:00Z');
const at = (ms) => new Date(T0.getTime() + ms);

const openEpoch = { 'composition/writeEpoch': { state: 'open', epochId: 'e-1' } };

beforeEach(() => { flagState.fence = true; });

describe('B2 — acquisition validates the epoch transactionally', () => {
  it('open epoch → lease registered with holder/epoch/expiry; closing and closed → EpochClosedError, ZERO writes', async () => {
    const { db } = makeInMemoryDb({ ...openEpoch });
    const lease = await acquireProvisionerLease(db, { holder: 'test:open', now: T0 });
    expect(lease.dark).toBe(false);
    expect(lease.epochId).toBe('e-1');
    expect(lease.expiresAtMs).toBe(T0.getTime() + PROVISIONER_LEASE_TTL_MS);
    const active = await listActiveProvisionerLeases(db, { now: T0 });
    expect(active.map((l) => l.holder)).toEqual(['test:open']);

    for (const state of ['closing', 'closed']) {
      const { db: db2, writeLog } = makeInMemoryDb({ 'composition/writeEpoch': { state, epochId: 'e-1' } });
      await expect(acquireProvisionerLease(db2, { holder: 'test:x', now: T0 }))
        .rejects.toMatchObject({ code: 'epoch_closed' });
      expect(writeLog.length).toBe(0);
    }
  });

  it('ABSENT epoch doc → open (the pre-activation posture — dark-compat, same as validateWriteEpochInTx)', async () => {
    const { db } = makeInMemoryDb({});
    const lease = await acquireProvisionerLease(db, { holder: 'test:absent', now: T0 });
    expect(lease.dark).toBe(false);
    expect(lease.epochId).toBe(null);
  });

  it('DARK (flag off): no-op lease, zero reads, zero writes; assertLeaseCurrent and release are no-ops', async () => {
    flagState.fence = false;
    const { db, writeLog } = makeInMemoryDb({ ...openEpoch });
    const lease = await acquireProvisionerLease(db, { holder: 'test:dark', now: T0 });
    expect(lease.dark).toBe(true);
    expect(writeLog.length).toBe(0);
    expect(assertLeaseCurrent(lease, { now: at(10 * PROVISIONER_LEASE_TTL_MS) })).toBe(null);
    await releaseProvisionerLease(db, lease);
    expect(writeLog.length).toBe(0);
  });
});

describe('B2 — the close-side drain', () => {
  it('a HELD lease blocks the drain until released; release lets it complete (the close waits for the provisioner to exit)', async () => {
    const { db } = makeInMemoryDb({ ...openEpoch });
    const lease = await acquireProvisionerLease(db, { holder: 'test:held', now: T0 });
    let clockMs = 0;
    const polls = [];
    const drain = drainProvisionerLeases(db, {
      nowFn: () => at(clockMs),
      pollMs: 1,
      timeoutMs: 60_000,
      sleep: async () => {
        polls.push(clockMs);
        clockMs += 1_000;
        // Release the lease on the third poll — until then the drain MUST wait.
        if (polls.length === 3) await releaseProvisionerLease(db, lease, { now: at(clockMs) });
      },
    });
    const out = await drain;
    expect(polls.length).toBe(3); // it genuinely waited across three polls
    expect(out.drained).toBe(true);
  });

  it('a CRASHED holder (never releases) bounds the wait by TTL — the drain proceeds once the lease expires', async () => {
    const { db } = makeInMemoryDb({ ...openEpoch });
    await acquireProvisionerLease(db, { holder: 'test:crashed', now: T0 });
    let clockMs = 0;
    const out = await drainProvisionerLeases(db, {
      nowFn: () => at(clockMs),
      pollMs: 1,
      timeoutMs: PROVISIONER_LEASE_TTL_MS + 30_000,
      sleep: async () => { clockMs += PROVISIONER_LEASE_TTL_MS / 2; },
    });
    expect(out.drained).toBe(true);
    expect(clockMs).toBeGreaterThanOrEqual(PROVISIONER_LEASE_TTL_MS);
  });

  it('a lease that never clears times the drain OUT with the holder named (the runbook sees who is stuck)', async () => {
    const { db } = makeInMemoryDb({
      ...openEpoch,
      [`${PROVISIONER_LEASE_COLLECTION}/stuck-1`]: {
        holder: 'test:stuck', epochId: 'e-1', acquiredAt: T0.toISOString(),
        expiresAtMs: Number.MAX_SAFE_INTEGER, releasedAt: null,
      },
    });
    let clockMs = 0;
    await expect(drainProvisionerLeases(db, {
      nowFn: () => at(clockMs), pollMs: 1, timeoutMs: 5_000,
      sleep: async () => { clockMs += 2_000; },
    })).rejects.toThrow(/test:stuck/);
  });
});

describe('B2 — TTL currency at the write phases', () => {
  it('assertLeaseCurrent throws past expiry — a stalled provisioner cannot land another write phase', () => {
    const lease = { dark: false, leaseId: 'l1', expiresAtMs: T0.getTime() + 1_000 };
    expect(assertLeaseCurrent(lease, { now: T0 })).toBe(null);
    expect(() => assertLeaseCurrent(lease, { now: at(1_000) })).toThrow(ProvisionerLeaseExpiredError);
  });
});

describe('B2 — the real provisioner, lit: order preserved, lease released, re-entrant', () => {
  const RANKED = {
    ownerId: 'user-1', archetype: 'guardian', config: { style: 'safe' },
    memory: ['m1'], stats: { wins: 1 },
  };
  const group = { id: 'g-1', players: [{ odUserId: 'user-1', isCpu: false }] };

  it('ensureTrainingClones under an OPEN epoch: subcollections FIRST then the sentinel doc; the lease is acquired and released', async () => {
    const { db, writeLog, store } = makeInMemoryDb({
      ...openEpoch,
      'agents/ranked-1': { ...RANKED },
      'agents/ranked-1/rules/r1': { text: 'rule', sourceRef: 'tv-01' },
      'agents/ranked-1/bundles/b1': { ruleIds: ['r1'] },
    });
    // LIVE clock on purpose: the per-phase currency check (assertLeaseCurrent
    // inside the provisioner) reads the wall clock by design, so the lease
    // must be acquired at wall-clock time for the phases to be current.
    const tLive = new Date();
    const out = await ensureTrainingClones(db, group, { now: tLive });
    expect(out.created).toEqual(['user-1']);
    const paths = writeLog.map(([, p]) => p);
    // The lease is the FIRST write; the clone sentinel doc is written AFTER
    // its subcollections (the re-entrancy order of record); release is last.
    expect(paths[0]).toContain(`${PROVISIONER_LEASE_COLLECTION}/trainingClone:g-1-`);
    const cloneDocIdx = paths.findIndex((p) => /^agents\/training-.*$/.test(p) && !p.includes('/rules/') && !p.includes('/bundles/'));
    const subIdx = paths.findIndex((p) => p.includes('/rules/') || p.includes('/bundles/'));
    expect(subIdx).toBeGreaterThan(-1);
    expect(cloneDocIdx).toBeGreaterThan(subIdx);
    expect(paths[paths.length - 1]).toContain(PROVISIONER_LEASE_COLLECTION); // the release update
    const active = await listActiveProvisionerLeases(db, { now: new Date(tLive.getTime() + 1) });
    expect(active).toEqual([]); // released, not just expired
    // Re-entrancy: a second run finds the clone and provisions nothing new.
    const again = await ensureTrainingClones(db, group, { now: new Date(tLive.getTime() + 5) });
    expect(again.existing).toEqual(['user-1']);
    expect(store.size).toBeGreaterThan(0);
  });

  it('CLOSED epoch: the provisioner rejects at acquisition with zero agent writes (the fence row, lease edition)', async () => {
    const { db, writeLog } = makeInMemoryDb({
      'composition/writeEpoch': { state: 'closed', epochId: 'e-1' },
      'agents/ranked-1': { ...RANKED },
    });
    await expect(ensureTrainingClones(db, group, { now: T0 })).rejects.toMatchObject({ code: 'epoch_closed' });
    expect(writeLog.filter(([, p]) => p.startsWith('agents/')).length).toBe(0);
  });
});
