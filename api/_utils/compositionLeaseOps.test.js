// api/_utils/compositionLeaseOps.test.js
//
// The §8 runbook's lease operations (step 1.9 drain, step 8B purge) — the
// logic behind scripts/composition/lease-ops.js.
//
// THE HEADLINE ROW IS THE CLOSED-EPOCH BLOCK. Step 1.9 runs with the write
// epoch CLOSED, so "these operations still work when closed" is the claim the
// whole tool rests on. It is PROVEN here against a seeded {state:'closed'}
// epoch doc rather than assumed from reading the helpers.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real import of
// compositionLeaseOps.js (→ compositionProvisionerLease.js → compositionConfig)
// is the runtime guard that this graph stays Node-clean. Never mock it.

import { describe, it, expect } from 'vitest';
import {
  listLeases, previewDrain, runDrain, runPurge, runResolve, resolveCommandFor,
  PROVISIONER_LEASE_COLLECTION,
} from './compositionLeaseOps.js';
import { PROVISIONER_LEASE_TTL_MS } from './compositionProvisionerLease.js';
import { WRITE_EPOCH_COLLECTION, WRITE_EPOCH_DOC_ID } from './compositionWriteEpoch.js';

const NOW = new Date('2026-08-20T12:00:00.000Z');
const ms = (d) => d.getTime();

// ── path-keyed in-memory Firestore (the repo's makeDb idiom, trimmed) ────────
function makeDb(initial = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]));
  const docsUnder = (prefix) => {
    const out = [];
    for (const [p, data] of store.entries()) {
      if (!p.startsWith(`${prefix}/`)) continue;
      if (p.slice(prefix.length + 1).includes('/')) continue;
      out.push({ id: p.slice(prefix.length + 1), data: () => structuredClone(data) });
    }
    return out;
  };
  const docRef = (p) => ({
    get: async () => ({ exists: store.has(p), id: p.split('/').pop(), data: () => structuredClone(store.get(p)) }),
    set: async (d) => { store.set(p, structuredClone(d)); },
    update: async (u) => { store.set(p, { ...(store.get(p) || {}), ...structuredClone(u) }); },
    delete: async () => { store.delete(p); },
  });
  const db = {
    collection: (name) => ({
      doc: (id) => docRef(`${name}/${id}`),
      get: async () => ({ docs: docsUnder(name), empty: docsUnder(name).length === 0 }),
    }),
  };
  return { db, store };
}

const lease = (id, { holder = 'casualClone:u1', ageMs = 0, released = false } = {}) => ({
  [`${PROVISIONER_LEASE_COLLECTION}/${id}`]: {
    holder,
    epochId: 'E0',
    acquiredAt: new Date(ms(NOW) - ageMs).toISOString(),
    expiresAt: new Date(ms(NOW) - ageMs + PROVISIONER_LEASE_TTL_MS).toISOString(),
    expiresAtMs: ms(NOW) - ageMs + PROVISIONER_LEASE_TTL_MS,
    releasedAt: released ? new Date(ms(NOW) - ageMs + 10).toISOString() : null,
  },
});

const ACTIVE = { ...lease('live-1', { ageMs: 5_000 }) };                       // held, unexpired
const STUCK = { ...lease('dead-1', { holder: 'trainingClone:pod1', ageMs: PROVISIONER_LEASE_TTL_MS + 60_000 }) };
const RELEASED = { ...lease('done-1', { ageMs: 600_000, released: true }) };

// ============================================================================
describe('lease-ops — LIST', () => {
  it('reports holder, leaseId, acquiredAt, expiresAt and stuck-ness; released leases are excluded', async () => {
    const { db } = makeDb({ ...ACTIVE, ...STUCK, ...RELEASED });
    const r = await listLeases(db, { now: NOW });

    expect(r.activeCount).toBe(1);
    expect(r.stuckCount).toBe(1);
    expect(r.rows.map((x) => x.leaseId).sort()).toEqual(['dead-1', 'live-1']); // done-1 excluded

    const stuck = r.rows.find((x) => x.leaseId === 'dead-1');
    expect(stuck.stuck).toBe(true);
    expect(stuck.holder).toBe('trainingClone:pod1');
    expect(stuck.acquiredAt).toBeTruthy();
    expect(stuck.expiresAt).toBeTruthy();
    expect(r.rows.find((x) => x.leaseId === 'live-1').stuck).toBe(false);
  });

  it("stuck-ness is the DRAIN's definition, not a re-derived one — the two agree at the boundary", async () => {
    // A lease expiring exactly at `now` is stuck (the helper's predicate is
    // `now >= expiresAtMs`). If this report re-derived the rule with `>` the
    // two would disagree here — the display-disagreement class, §9.
    const { db } = makeDb(lease('edge-1', { ageMs: PROVISIONER_LEASE_TTL_MS }));
    const listed = await listLeases(db, { now: NOW });
    expect(listed.rows[0].stuck).toBe(true);

    const preview = await previewDrain(db, { now: NOW });
    expect(preview.verdict).toBe('WOULD_REFUSE'); // the drain agrees
  });
});

// ============================================================================
describe('lease-ops — DRAIN', () => {
  it('dry run on an empty registry: WOULD_DRAIN_IMMEDIATELY, nothing written', async () => {
    const { db, store } = makeDb({});
    const before = store.size;
    const r = await previewDrain(db, { now: NOW });
    expect(r.verdict).toBe('WOULD_DRAIN_IMMEDIATELY');
    expect(store.size).toBe(before);
  });

  it('dry run with an active lease: WOULD_WAIT and names it — without polling', async () => {
    const { db } = makeDb(ACTIVE);
    const r = await previewDrain(db, { now: NOW });
    expect(r.verdict).toBe('WOULD_WAIT');
    expect(r.active.map((x) => x.leaseId)).toEqual(['live-1']);
    expect(r.resolveCommands).toEqual([]); // an active lease is NOT resolvable
  });

  it('dry run with a stuck lease: WOULD_REFUSE, names the holder, pre-fills a runnable resolve command', async () => {
    const { db } = makeDb(STUCK);
    const r = await previewDrain(db, { now: NOW });
    expect(r.verdict).toBe('WOULD_REFUSE');
    expect(r.stuck[0].holder).toBe('trainingClone:pod1');
    expect(r.resolveCommands).toHaveLength(1);
    expect(r.resolveCommands[0]).toContain('lease-ops.js resolve --lease-id dead-1');
    expect(r.resolveCommands[0]).toContain('--apply');
    // Operator + reason stay PLACEHOLDERS — the tool must never look like it
    // made the "holder is dead" call itself (#3).
    expect(r.resolveCommands[0]).toContain('<your name>');
  });

  it('LIVE drain on an empty registry returns {drained:true} and writes nothing', async () => {
    const { db, store } = makeDb(RELEASED); // released docs do not block a drain
    const before = new Map(store);
    const r = await runDrain(db, { nowFn: () => NOW, pollMs: 1, timeoutMs: 50 });
    expect(r.verdict).toBe('DRAINED');
    expect(r.drained).toBe(true);
    expect([...store.entries()]).toEqual([...before.entries()]); // byte-identical
  });

  it('LIVE drain REFUSES on a stuck lease as STRUCTURE, not an opaque throw', async () => {
    const { db } = makeDb({ ...STUCK, ...ACTIVE });
    const r = await runDrain(db, { nowFn: () => NOW, pollMs: 1, timeoutMs: 50 });
    expect(r.verdict).toBe('REFUSED');
    expect(r.code).toBe('provisioner_lease_stuck');
    expect(r.stuck.map((x) => x.leaseId)).toEqual(['dead-1']);
    expect(r.resolveCommands[0]).toContain('dead-1');
    // The holder is NAMED — the runbook STOP needs to know who to verify dead.
    expect(r.message).toContain('trainingClone:pod1');
  });
});

// ============================================================================
describe('lease-ops — RESOLVE (attributed; #3)', () => {
  it('refuses without operator or reason', async () => {
    const { db } = makeDb(STUCK);
    await expect(runResolve(db, 'dead-1', { reason: 'x' })).rejects.toThrow(/--operator required/);
    await expect(runResolve(db, 'dead-1', { operator: 'Flash' })).rejects.toThrow(/--reason required/);
  });

  it('marks the lease released WITH attribution, and the drain then clears', async () => {
    const { db, store } = makeDb(STUCK);
    const r = await runResolve(db, 'dead-1', { operator: 'Flash', reason: 'lambda confirmed dead', now: NOW });
    expect(r.verdict).toBe('RESOLVED');
    expect(r.holder).toBe('trainingClone:pod1');

    const doc = store.get(`${PROVISIONER_LEASE_COLLECTION}/dead-1`);
    expect(doc.releasedAt).toBeTruthy();
    expect(doc.resolvedBy).toBe('Flash');
    expect(doc.resolvedReason).toBe('lambda confirmed dead');

    const after = await runDrain(db, { nowFn: () => NOW, pollMs: 1, timeoutMs: 50 });
    expect(after.verdict).toBe('DRAINED');
  });

  it('REFUSES a lease that has not expired — a live holder may still be writing', async () => {
    const { db } = makeDb(ACTIVE);
    await expect(runResolve(db, 'live-1', { operator: 'Flash', reason: 'guessing', now: NOW }))
      .rejects.toThrow(/has not expired/);
  });
});

// ============================================================================
describe('lease-ops — PURGE (step 8B)', () => {
  it('refuses without an operator (a delete leaves no stamp; attribution rides the report)', async () => {
    const { db } = makeDb(RELEASED);
    await expect(runPurge(db, {})).rejects.toThrow(/operator required/);
  });

  it('deletes ONLY released leases; active and stuck survive untouched', async () => {
    const { db, store } = makeDb({ ...ACTIVE, ...STUCK, ...RELEASED });
    const r = await runPurge(db, { operator: 'Flash' });

    expect(r.purged).toBe(1);
    expect(store.has(`${PROVISIONER_LEASE_COLLECTION}/done-1`)).toBe(false); // released → gone
    expect(store.has(`${PROVISIONER_LEASE_COLLECTION}/live-1`)).toBe(true);  // active → kept
    expect(store.has(`${PROVISIONER_LEASE_COLLECTION}/dead-1`)).toBe(true);  // STUCK → kept
    // Purging a stuck lease would destroy the very signal the drain refuses on
    // (Sol review #3) — the unreleased population must be identical either side.
    expect(r.unreleasedBefore).toBe(2);
    expect(r.unreleasedAfter).toBe(2);
  });
});

// ============================================================================
// THE CLAIM THE TOOL RESTS ON. Step 1.9 runs with the epoch CLOSED — writes and
// lease ACQUISITION reject from that moment. These operations must still work,
// because draining is precisely what the closed window requires. Proven, not
// assumed: every subcommand runs against a seeded {state:'closed'} epoch doc.
describe('EPOCH CLOSED — every lease operation still works (the step-1.9 condition)', () => {
  const CLOSED = {
    [`${WRITE_EPOCH_COLLECTION}/${WRITE_EPOCH_DOC_ID}`]: { state: 'closed', epochId: 'E0', fenceGeneration: 1 },
  };

  it('the fixture really is closed — the guard the rest of the system honours', async () => {
    // Anti-vacuous: if this seed were wrong (or the doc address drifted) every
    // row below would prove nothing. Assert the doc is where the fence looks.
    const { db } = makeDb(CLOSED);
    const snap = await db.collection(WRITE_EPOCH_COLLECTION).doc(WRITE_EPOCH_DOC_ID).get();
    expect(snap.exists).toBe(true);
    expect(snap.data().state).toBe('closed');
  });

  it('LIST works closed', async () => {
    const { db } = makeDb({ ...CLOSED, ...ACTIVE, ...STUCK });
    const r = await listLeases(db, { now: NOW });
    expect(r.activeCount).toBe(1);
    expect(r.stuckCount).toBe(1);
  });

  it('DRAIN dry-run works closed', async () => {
    const { db } = makeDb({ ...CLOSED, ...STUCK });
    expect((await previewDrain(db, { now: NOW })).verdict).toBe('WOULD_REFUSE');
  });

  it('DRAIN (live) works closed — this is the step-1.9 call itself', async () => {
    const { db } = makeDb({ ...CLOSED, ...RELEASED });
    const r = await runDrain(db, { nowFn: () => NOW, pollMs: 1, timeoutMs: 50 });
    expect(r.verdict).toBe('DRAINED');
    expect(r.drained).toBe(true);
  });

  it('RESOLVE works closed — a stuck lease must be resolvable INSIDE the window', async () => {
    const { db, store } = makeDb({ ...CLOSED, ...STUCK });
    const r = await runResolve(db, 'dead-1', { operator: 'Flash', reason: 'holder verified dead', now: NOW });
    expect(r.verdict).toBe('RESOLVED');
    expect(store.get(`${PROVISIONER_LEASE_COLLECTION}/dead-1`).resolvedBy).toBe('Flash');
    // …and the drain it was blocking now clears, still closed.
    expect((await runDrain(db, { nowFn: () => NOW, pollMs: 1, timeoutMs: 50 })).verdict).toBe('DRAINED');
  });

  it('PURGE works closed too (8B runs it after the reopen, but nothing here depends on epoch state)', async () => {
    const { db } = makeDb({ ...CLOSED, ...RELEASED });
    expect((await runPurge(db, { operator: 'Flash' })).purged).toBe(1);
  });
});

// ============================================================================
describe('lease-ops — the pre-filled resolve command is runnable, not decorative', () => {
  it('names the real script path, the lease id, --apply, and leaves operator/reason to the human', () => {
    const cmd = resolveCommandFor('abc-123');
    expect(cmd).toContain('node scripts/composition/lease-ops.js resolve');
    expect(cmd).toContain('--lease-id abc-123');
    expect(cmd).toContain('--operator');
    expect(cmd).toContain('--reason');
    expect(cmd).toContain('--apply');
  });
});
