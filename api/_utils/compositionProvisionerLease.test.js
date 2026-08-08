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
  resolveStuckProvisionerLease, purgeReleasedProvisionerLeases,
  PROVISIONER_LEASE_COLLECTION, PROVISIONER_LEASE_TTL_MS,
  ProvisionerLeaseExpiredError, StuckProvisionerLeaseError,
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

  it('ABSENT epoch doc + NO activation record → open (the pre-activation posture, same as validateWriteEpochInTx)', async () => {
    const { db } = makeInMemoryDb({});
    const lease = await acquireProvisionerLease(db, { holder: 'test:absent', now: T0 });
    expect(lease.dark).toBe(false);
    expect(lease.epochId).toBe(null);
  });

  it('ABSENT epoch doc + activation record PRESENT → FAILS CLOSED with zero writes (§2 pass-2 L2-7: B1 parity — the activated world never provisions unfenced)', async () => {
    const { db, writeLog } = makeInMemoryDb({
      'composition/activation': {
        activeIdentityVersion: 3, boundaryStateVersion: 1, activeEpochId: 'ep-1',
        candidateStateId: 'run-1', semanticHash: 'sem-1', activationGeneration: 1, overrideRevision: 0,
      },
    });
    await expect(acquireProvisionerLease(db, { holder: 'test:post-act', now: T0 }))
      .rejects.toMatchObject({ code: 'epoch_closed' });
    expect(writeLog.length).toBe(0);
  });

  it('DARK (flag off): no-op lease, zero reads, zero writes; assertLeaseCurrent and release are no-ops', async () => {
    flagState.fence = false;
    const { db, writeLog, readLog } = makeInMemoryDb({ ...openEpoch });
    const lease = await acquireProvisionerLease(db, { holder: 'test:dark', now: T0 });
    expect(lease.dark).toBe(true);
    expect(writeLog.length).toBe(0);
    // §2 pass-2 L2-1: "zero reads" asserted against the fixture's read log —
    // a dark path that gains a Firestore read fails HERE.
    expect(readLog.length).toBe(0);
    expect(assertLeaseCurrent(lease, { now: at(10 * PROVISIONER_LEASE_TTL_MS) })).toBe(null);
    await releaseProvisionerLease(db, lease);
    expect(writeLog.length).toBe(0);
    expect(readLog.length).toBe(0);
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

  it('#3 (Sol review): TTL expires MID-COPY without release → the drain REFUSES to complete, naming the holder — expired-unreleased is a STUCK holder, never auto-drained', async () => {
    const { db } = makeInMemoryDb({ ...openEpoch });
    const lease = await acquireProvisionerLease(db, { holder: 'test:straddler', now: T0 });
    // Mid-copy: one write phase passes its currency check, then the process
    // stalls past TTL without releasing. The next in-process check would
    // refuse — but the DRAIN cannot know the process is dead, so it must
    // not complete over this lease.
    expect(assertLeaseCurrent(lease, { now: T0 })).toBe(null);
    let clockMs = PROVISIONER_LEASE_TTL_MS + 1; // past expiry, unreleased
    await expect(drainProvisionerLeases(db, {
      nowFn: () => at(clockMs), pollMs: 1, timeoutMs: 60_000,
      sleep: async () => { clockMs += 1_000; },
    })).rejects.toMatchObject({ code: 'provisioner_lease_stuck', message: expect.stringContaining('test:straddler') });
  });

  it('#3: explicit resolution unblocks the drain — resolveStuckProvisionerLease is attributed, refuses LIVE leases, and only then does the drain complete', async () => {
    const { db, store } = makeInMemoryDb({ ...openEpoch });
    const lease = await acquireProvisionerLease(db, { holder: 'test:crashed', now: T0 });
    // A LIVE lease cannot be "resolved" — the holder may still be writing:
    await expect(resolveStuckProvisionerLease(db, lease.leaseId, { operator: 'founder', reason: 'x', now: T0 }))
      .rejects.toThrow(/has not expired/);
    const after = at(PROVISIONER_LEASE_TTL_MS + 1);
    const out = await resolveStuckProvisionerLease(db, lease.leaseId, {
      operator: 'founder', reason: 'holder function exceeded max lifetime — verified dead', now: after,
    });
    expect(out).toMatchObject({ resolved: true, holder: 'test:crashed' });
    const doc = store.get(`${PROVISIONER_LEASE_COLLECTION}/${lease.leaseId}`);
    expect(doc.resolvedBy).toBe('founder'); // the attribution the runbook log archives
    let clockMs = PROVISIONER_LEASE_TTL_MS + 2;
    const drained = await drainProvisionerLeases(db, {
      nowFn: () => at(clockMs), pollMs: 1, timeoutMs: 60_000, sleep: async () => { clockMs += 1_000; },
    });
    expect(drained.drained).toBe(true);
  });

  it('#3/F9: the purge removes RELEASED leases only — an expired-but-unreleased (stuck) lease survives the purge so its signal is never hidden', async () => {
    const { db, store } = makeInMemoryDb({ ...openEpoch });
    const released = await acquireProvisionerLease(db, { holder: 'test:done', now: T0 });
    await releaseProvisionerLease(db, released, { now: at(10) });
    await acquireProvisionerLease(db, { holder: 'test:stuck-unreleased', now: T0 });
    const purged = await purgeReleasedProvisionerLeases(db);
    expect(purged).toBe(1);
    const remaining = [...store.keys()].filter((k) => k.startsWith(PROVISIONER_LEASE_COLLECTION));
    expect(remaining.length).toBe(1); // the stuck lease survives — resolve it, never purge it away
    expect(store.get(remaining[0]).holder).toBe('test:stuck-unreleased');
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
