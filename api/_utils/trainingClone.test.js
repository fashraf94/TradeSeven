// api/_utils/trainingClone.test.js
//
// League Training Slice 3 battery: the training-agent CLONE identity. Covers the
// deterministic id codec, the pure clone-doc builder (inherit-forward + the
// Slice-5 loadoutSpec override + fresh history/markers), the ranked-agent
// resolver (EXCLUDE clones), and ensureTrainingClones (human-only, subcollection
// copy, idempotent get-or-create, no-ranked-agent skip).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's real import of
// trainingClone.js — whose graph now also pulls api/_utils/archetypeSeeding
// (→ src/data/traitLibrary + src/data/traitEquip, the born-with seed planner) —
// IS the runtime guard that its api/ -> src/ import surface stays Node-clean.
// Never mock that import.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  resolveRankedAgent,
  buildTrainingCloneDoc,
  ensureTrainingClones,
} from './trainingClone.js';
import { trainingCloneDocId, TRAINING_CLONE_ID_PREFIX } from '../../src/constants/leagueTournament.js';
import { ARCHETYPE_DEFAULT_TRAITS } from '../../src/data/traitLibrary.js';

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// ==================== IN-MEMORY FIRESTORE (the shared makeDb idiom, trimmed) ====================

function makeDb(initial = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]));

  function topLevelDocs(prefix) {
    const docs = [];
    for (const [path, data] of store.entries()) {
      if (!path.startsWith(`${prefix}/`)) continue;
      const rel = path.slice(prefix.length + 1);
      if (rel.includes('/')) continue;
      docs.push({ id: rel, data: () => structuredClone(data) });
    }
    return docs;
  }
  function snapshotOf(docs) {
    return { docs, empty: docs.length === 0, size: docs.length, forEach: (cb) => docs.forEach(cb) };
  }
  function makeDocRef(path) {
    return {
      path,
      // Real DocumentReferences carry `.firestore`;
      // softDeleteReplacedTraitRuleDocs reads it for the now-live
      // assertWriteEpochOpen check (archetypeSeeding.js:142).
      get firestore() { return db; },
      get: async () => {
        const data = store.get(path);
        return { exists: data !== undefined, id: path.split('/').pop(), data: () => structuredClone(data) };
      },
      set: async (data) => { store.set(path, structuredClone(data)); },
      update: async (updates) => {
        const data = store.get(path) || {};
        store.set(path, { ...data, ...structuredClone(updates) });
      },
      collection: (sub) => makeCollection(`${path}/${sub}`),
    };
  }
  function makeCollection(prefix) {
    return {
      doc: (id) => makeDocRef(`${prefix}/${id}`),
      where: (field, _op, value) => ({
        get: async () => snapshotOf(topLevelDocs(prefix).filter(d => d.data()[field] === value)),
      }),
      get: async () => snapshotOf(topLevelDocs(prefix)),
    };
  }
  // Path-keyed store: composition/writeEpoch and composition/activation
  // already resolve ABSENT (pre-genesis ⇒ the live fence fails open). The
  // missing piece was the transaction — the B2 provisioner lease that
  // acquireProvisionerLease takes inside db.runTransaction now that
  // ACTIVATION_RUNBOOK step 1.1 has lit the fence.
  const runTransaction = async (fn) => fn({
    get: async (ref) => ref.get(),
    getAll: async (...refs) => Promise.all(refs.map((r) => r.get())),
    set: async (ref, d) => ref.set(d),
    create: async (ref, d) => ref.create(d),
    update: async (ref, u) => ref.update(u),
  });
  const db = { collection: (name) => makeCollection(name), runTransaction };
  return { db, store };
}

// ==================== FIXTURES ====================

const RANKED = {
  ownerId: 'u1',
  name: 'Vega',
  archetype: 'degen',
  config: { risk: 80, concentration: 40, momentum: 70 },
  personality: { traits: ['bold'] },
  equippedTraits: ['t1'],
  equippedBundleIds: ['b1'],
  equippedWatchlistId: 'wl1',
  equippedWatchlistName: 'Movers',
  consolidatedInsight: 'cut losers fast',
  disciplines: { d1: true },
  evolutionCycle: 3,
  // history that must NOT carry into a fresh clone:
  memory: [{ game: 1 }, { game: 2 }],
  stats: { wins: 9, losses: 1, gamesPlayed: 10, totalScore: 500, avgScore: 50, currentStreak: 4, bestStreak: 6 },
  activeBattleId: 'ranked-battle-xyz',
  lastDeployedAt: '2026-06-10T00:00:00.000Z',
};

function seededDb() {
  return makeDb({
    'agents/ranked1': RANKED,
    'agents/ranked1/rules/r1': { textTemplate: 'rule one', strength: 5 },
    'agents/ranked1/bundles/bundleA': { ruleIds: ['r1'], status: 'active' },
    // A stray pre-existing clone for the SAME owner — ranked resolution must skip it.
    'agents/training-agent-oldpod-u1': { ownerId: 'u1', isTrainingClone: true, archetype: 'analyst' },
  });
}

const trainingGroup = {
  id: 'pod1',
  players: [
    { odUserId: 'u1', isCpu: false },
    { odUserId: 'cpu-1', isCpu: true },
    { odUserId: 'cpu-2', isCpu: true },
    { odUserId: 'cpu-3', isCpu: true },
  ],
};

// ==================== id codec ====================

describe('trainingCloneDocId', () => {
  it('is deterministic and prefixed', () => {
    expect(trainingCloneDocId('pod1', 'u1')).toBe(`${TRAINING_CLONE_ID_PREFIX}pod1-u1`);
    expect(trainingCloneDocId('pod1', 'u1')).toBe(trainingCloneDocId('pod1', 'u1'));
  });
  it('rejects empty parts', () => {
    expect(() => trainingCloneDocId('', 'u1')).toThrow();
    expect(() => trainingCloneDocId('pod1', '')).toThrow();
  });
});

// ==================== resolveRankedAgent (exclude clones) ====================

describe('resolveRankedAgent', () => {
  it('returns the ranked agent, never a clone with the same ownerId', async () => {
    const { db } = seededDb();
    const agent = await resolveRankedAgent(db, 'u1');
    expect(agent.id).toBe('ranked1');
    expect(agent.isTrainingClone).toBeUndefined();
    expect(agent.archetype).toBe('degen');
  });
  it('returns null when the user has only clones', async () => {
    const { db } = makeDb({ 'agents/training-agent-x-u9': { ownerId: 'u9', isTrainingClone: true } });
    expect(await resolveRankedAgent(db, 'u9')).toBeNull();
  });
});

// ==================== buildTrainingCloneDoc (pure) ====================

describe('buildTrainingCloneDoc', () => {
  const nowIso = '2026-06-17T12:00:00.000Z';

  it('inherits the loadout/Trading Brain', () => {
    const doc = buildTrainingCloneDoc({ id: 'ranked1', ...RANKED }, { groupId: 'pod1', odUserId: 'u1', nowIso });
    expect(doc.archetype).toBe('degen');
    expect(doc.config).toEqual({ risk: 80, concentration: 40, momentum: 70 });
    expect(doc.equippedTraits).toEqual(['t1']);
    expect(doc.equippedWatchlistId).toBe('wl1');
    expect(doc.consolidatedInsight).toBe('cut losers fast');
    expect(doc.disciplines).toEqual({ d1: true });
    expect(doc.evolutionCycle).toBe(3);
  });

  it('stamps the markers (ownerId = player, isTrainingClone, rankedAgentId, groupId)', () => {
    const doc = buildTrainingCloneDoc({ id: 'ranked1', ...RANKED }, { groupId: 'pod1', odUserId: 'u1', nowIso });
    expect(doc.ownerId).toBe('u1');          // banking keys on this
    expect(doc.isTrainingClone).toBe(true);
    expect(doc.rankedAgentId).toBe('ranked1');
    expect(doc.groupId).toBe('pod1');
  });

  it('resets history + battle pointers (no ranked carry-over)', () => {
    const doc = buildTrainingCloneDoc({ id: 'ranked1', ...RANKED }, { groupId: 'pod1', odUserId: 'u1', nowIso });
    expect(doc.memory).toEqual([]);
    expect(doc.stats.gamesPlayed).toBe(0);
    expect(doc.stats.wins).toBe(0);
    expect(doc.activeBattleId).toBeNull();
    expect(doc.deployingAt).toBeNull();
    expect(doc.lastDeployedAt).toBeNull();
  });

  it('applies a Slice-5 loadoutSpec override over the inherited loadout', () => {
    const doc = buildTrainingCloneDoc({ id: 'ranked1', ...RANKED }, {
      groupId: 'pod1', odUserId: 'u1', nowIso,
      loadoutSpec: { archetype: 'guardian', equippedWatchlistId: 'wl2' },
    });
    expect(doc.archetype).toBe('guardian');         // overridden
    expect(doc.equippedWatchlistId).toBe('wl2');    // overridden
    expect(doc.config).toEqual({ risk: 80, concentration: 40, momentum: 70 }); // untouched inherit
    expect(doc.ownerId).toBe('u1');                 // markers still stamped
    expect(doc.isTrainingClone).toBe(true);
  });
});

// ==================== ensureTrainingClones ====================

describe('ensureTrainingClones', () => {
  // ── R1 REGRESSION (founder ruling 2026-08-16, ACTIVATION_RUNBOOK step 1.1) ──
  // The B2 provisioner lease is a WALL-CLOCK resource; `now` is a SCHEDULING
  // clock. The orchestrator captures `now` ONCE per tick
  // (api/cron/tournament-orchestrator.js:47) and keeps working for up to
  // DUTY_DEADLINE_MS = 270s, pacing deploys 20s apart, while
  // PROVISIONER_LEASE_TTL_MS is 120s of REAL time. Minting the lease from `now`
  // meant every pod reached >120s into a tick got a lease already expired on
  // arrival and threw `provisioner_lease_expired` before even the clone-exists
  // check — every tick, from roughly the third pod on. Inert while the fence
  // was dark; live from the moment step 1.1 lit it.
  //
  // This row observes REAL elapsed time on purpose. It must never be "fixed"
  // with fake timers: freezing Date makes the injected and real clocks agree,
  // which is precisely the condition under which the bug cannot bite — a test
  // that cannot observe elapsed time cannot guard a TTL.
  it('R1: a tick whose scheduling clock is older than the lease TTL still provisions (lease stamped in WALL-CLOCK time)', async () => {
    const { db, store } = seededDb();
    // A tick that began 5 minutes ago — well past the 120s lease TTL, and
    // inside the orchestrator's real 270s budget.
    const staleTickClock = new Date(Date.now() - 5 * 60_000);
    const res = await ensureTrainingClones(db, trainingGroup, { now: staleTickClock });
    expect(res.created).toEqual(['u1']);
    expect(res.skipped).toEqual([]);
    expect(store.get(`agents/${trainingCloneDocId('pod1', 'u1')}`)).toBeTruthy();
  });

  // ── S1 REGRESSION: no lease on the idempotent all-existing tick ─────────
  // sweepTrainingActivation calls this for every training BATTLE pod on every
  // orchestrator tick (vercel.json: */10 across 7 hours, weekdays = 42/day).
  // After the pod's first day every seat exists, so the common outcome is
  // all-`existing` with ZERO writes — and it used to mint and release a lease
  // anyway, per pod per tick. That was the dominant feeder of the unbounded
  // compositionProvisionerLeases growth the step-1.9 drain has to scan.
  it('S1: an all-existing tick provisions nothing and takes NO lease', async () => {
    const { db, store } = seededDb();
    // First pass provisions and (correctly) uses a lease.
    const first = await ensureTrainingClones(db, trainingGroup, { now: new Date() });
    expect(first.created).toEqual(['u1']);
    const leasesAfterFirst = [...store.keys()].filter((k) => k.startsWith('compositionProvisionerLeases/')).length;
    // MUTATION ANCHOR: a provisioning pass DOES mint a lease, so the assertion
    // below cannot pass merely because this double never records leases.
    expect(leasesAfterFirst, 'the provisioning pass minted no lease — the anchor is broken').toBe(1);

    // Second pass: every seat already exists ⇒ nothing written, no lease.
    const second = await ensureTrainingClones(db, trainingGroup, { now: new Date() });
    expect(second.created).toEqual([]);
    expect(second.existing).toEqual(['u1']);
    const leasesAfterSecond = [...store.keys()].filter((k) => k.startsWith('compositionProvisionerLeases/')).length;
    expect(leasesAfterSecond, 'the idempotent tick minted a lease for zero writes').toBe(leasesAfterFirst);
  });

  // ── S2 REGRESSION: the lease must never be orphaned by a throw ──────────
  // pinActivationDescriptor reads composition/activation once the fence is lit,
  // and readActivationDescriptor throws MalformedActivationDescriptorError on a
  // PARTIAL descriptor — precisely the mid-flight state during runbook step 7.
  // With the acquire outside the try, that throw left the lease unreleased; it
  // became `stuck` after the TTL and made drainProvisionerLeases refuse
  // ENTIRELY until an operator hand-resolved it. i.e. the activation could
  // orphan its own lease and then refuse its own drain — a circular failure.
  it('S2: a malformed activation descriptor RELEASES the lease before propagating (never orphans it)', async () => {
    const { db, store } = seededDb();
    // The epoch doc must be PRESENT and open, or B1's absent-doc fail-closed
    // rejects at lease acquisition and the pin is never reached — the lease
    // would never be minted and this row would prove nothing.
    store.set('composition/writeEpoch', { state: 'open', epochId: 'E0', fenceGeneration: 1 });
    // A PARTIAL descriptor: activationGeneration written, the rest not yet.
    store.set('composition/activation', { activationGeneration: 2 });

    await expect(ensureTrainingClones(db, trainingGroup, { now: new Date() }))
      .rejects.toThrow(/activeIdentityVersion|malformed/i);

    // The lease was taken (a seat needed provisioning) and MUST be released.
    const leases = [...store.entries()].filter(([k]) => k.startsWith('compositionProvisionerLeases/'));
    expect(leases.length, 'the lease was never minted — this row would be vacuous').toBe(1);
    expect(leases[0][1].releasedAt, 'lease orphaned by the throw — it would go stuck and block the 1.9 drain').toBeTruthy();
  });

  it('provisions the human clone, copies subcollections, skips CPU seats', async () => {
    const { db, store } = seededDb();
    const res = await ensureTrainingClones(db, trainingGroup, { now: new Date('2026-06-17T12:00:00.000Z') });
    expect(res.created).toEqual(['u1']);
    expect(res.existing).toEqual([]);
    expect(res.skipped).toEqual([]);

    const cloneId = trainingCloneDocId('pod1', 'u1');
    const clone = store.get(`agents/${cloneId}`);
    expect(clone.isTrainingClone).toBe(true);
    expect(clone.rankedAgentId).toBe('ranked1');
    expect(clone.archetype).toBe('degen');
    // subcollections copied (the Trading Brain decide.js re-projects from)
    expect(store.get(`agents/${cloneId}/rules/r1`)).toEqual({ textTemplate: 'rule one', strength: 5 });
    expect(store.get(`agents/${cloneId}/bundles/bundleA`)).toEqual({ ruleIds: ['r1'], status: 'active' });
    // CPU seats are not cloned (their system agents already exist)
    expect(store.get(`agents/${trainingCloneDocId('pod1', 'cpu-1')}`)).toBeUndefined();
  });

  it('is idempotent — an existing clone is left alone (existing, not created)', async () => {
    const { db } = seededDb();
    await ensureTrainingClones(db, trainingGroup, { now: new Date() });
    const res2 = await ensureTrainingClones(db, trainingGroup, { now: new Date() });
    expect(res2.created).toEqual([]);
    expect(res2.existing).toEqual(['u1']);
  });

  it('skips (loudly) a human seat with no ranked agent', async () => {
    const { db, store } = makeDb({}); // no agents at all
    const res = await ensureTrainingClones(db, trainingGroup, { now: new Date() });
    expect(res.created).toEqual([]);
    expect(res.skipped).toEqual(['u1']);
    expect(store.get(`agents/${trainingCloneDocId('pod1', 'u1')}`)).toBeUndefined();
  });

  it('applies a per-user loadoutSpec override', async () => {
    const { db, store } = seededDb();
    await ensureTrainingClones(db, trainingGroup, {
      now: new Date(),
      loadoutSpecByUser: { u1: { archetype: 'guardian' } },
    });
    expect(store.get(`agents/${trainingCloneDocId('pod1', 'u1')}`).archetype).toBe('guardian');
  });

  it('override to a DIFFERENT archetype seeds THAT archetype\'s born-with traits (invariant), not the inherited ones', async () => {
    const { db, store } = seededDb(); // ranked archetype = degen, inherited equippedTraits = ['t1']
    await ensureTrainingClones(db, trainingGroup, {
      now: new Date(),
      loadoutSpecByUser: { u1: { archetype: 'guardian' } }, // diverges from degen
    });
    const cloneId = trainingCloneDocId('pod1', 'u1');
    const clone = store.get(`agents/${cloneId}`);
    expect(clone.archetype).toBe('guardian');
    // equippedTraits are guardian's born-with set — NOT the inherited ['t1'].
    expect(clone.equippedTraits.map((t) => t.traitId)).toEqual(ARCHETYPE_DEFAULT_TRAITS.guardian);
    // born-with rule docs created under the clone with deterministic ids.
    const bornWithRuleKeys = [...store.keys()].filter((k) => k.startsWith(`agents/${cloneId}/rules/bornwith__`));
    expect(bornWithRuleKeys.length).toBeGreaterThan(0);
  });

  it('override to a different archetype SOFT-DELETES the copied ranked trait docs (closes the resurrection path)', async () => {
    const { db, store } = makeDb({
      'agents/ranked1': { ownerId: 'u1', archetype: 'degen', equippedTraits: [{ traitId: 'trait-squeeze-whisperer' }] },
      // a ranked TRAIT rule doc (degen's) + a manual rule that has no traitId:
      'agents/ranked1/rules/degen-trait': { traitId: 'trait-squeeze-whisperer', sourceRef: 't-12', isDeleted: false },
      'agents/ranked1/rules/manual': { traitId: null, sourceRef: 'x-1', isDeleted: false },
    });
    const group = { id: 'pod1', players: [{ odUserId: 'u1', isCpu: false }] };
    await ensureTrainingClones(db, group, {
      now: new Date(),
      loadoutSpecByUser: { u1: { archetype: 'guardian' } }, // diverges from degen
    });
    const cloneId = trainingCloneDocId('pod1', 'u1');
    // The copied ranked trait doc (traitId ∉ guardian) is soft-deleted — even if
    // its traitId ever re-enters equippedTraits, projectActiveRules filters isDeleted.
    expect(store.get(`agents/${cloneId}/rules/degen-trait`).isDeleted).toBe(true);
    // The manual rule (no traitId) is untouched.
    expect(store.get(`agents/${cloneId}/rules/manual`).isDeleted).toBe(false);
    // guardian born-with docs are present and active.
    const bornWith = [...store.keys()].filter((k) => k.startsWith(`agents/${cloneId}/rules/bornwith__`));
    expect(bornWith.length).toBeGreaterThan(0);
  });

  it('override to the SAME archetype does not reseed — pure inherit-forward', async () => {
    const { db, store } = seededDb(); // ranked archetype = degen
    await ensureTrainingClones(db, trainingGroup, {
      now: new Date(),
      loadoutSpecByUser: { u1: { archetype: 'degen' } }, // matches ranked
    });
    const cloneId = trainingCloneDocId('pod1', 'u1');
    const clone = store.get(`agents/${cloneId}`);
    // Inherited equippedTraits kept (the fixture's ['t1']); no born-with reseed.
    expect(clone.equippedTraits).toEqual(['t1']);
    const bornWithRuleKeys = [...store.keys()].filter((k) => k.startsWith(`agents/${cloneId}/rules/bornwith__`));
    expect(bornWithRuleKeys.length).toBe(0);
  });

  it('re-provision after an interrupted seed is idempotent (deterministic ids overwrite, no duplicates)', async () => {
    const { db, store } = seededDb();
    const opts = { now: new Date(), loadoutSpecByUser: { u1: { archetype: 'guardian' } } };
    await ensureTrainingClones(db, trainingGroup, opts);
    const cloneId = trainingCloneDocId('pod1', 'u1');
    const afterFirst = [...store.keys()].filter((k) => k.startsWith(`agents/${cloneId}/rules/bornwith__`)).length;
    expect(afterFirst).toBeGreaterThan(0);
    // Simulate an interruption: the completion-sentinel clone doc never landed,
    // but its seeded subcollection docs did. The next run re-provisions.
    store.delete(`agents/${cloneId}`);
    await ensureTrainingClones(db, trainingGroup, opts);
    const afterSecond = [...store.keys()].filter((k) => k.startsWith(`agents/${cloneId}/rules/bornwith__`)).length;
    // Deterministic ids overwrote in place — no duplicate born-with docs.
    expect(afterSecond).toBe(afterFirst);
  });
});
