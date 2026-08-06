// api/_utils/compositionProductionLoader.contract.test.js
//
// Composition PR 3 — the B5 CONTRACT tests (ledger acceptance): a generation
// bump interleaved mid-read never yields a torn view; a derived write missing
// its generation stamp fails; the pre-activation world loads as generation 0
// with pass-through resolution.

import { describe, it, expect } from 'vitest';
import {
  loadActivatedComposition, stampDerivedWrite, assertGenerationStamped, TornCompositionReadError,
} from './compositionProductionLoader.js';

// A fake whose activation descriptor can be bumped between the loader's reads
// — the interleaving hook the contract test drives.
//
// REVIEW F1 (test-integrity lens, this PR): the first harness had two
// defects that made the flagship row pass with the seqlock DELETED —
// (a) snapshots were LAZY (`data: () => state.descriptor`), so the loader's
// first read already observed the post-bump generation and nothing ever
// interleaved; (b) fetchLayers keyed entries off the descriptor the loader
// PASSED, making a torn combination structurally unrepresentable. This
// harness snapshots EAGERLY at read time and serves entries from LIVE state
// — a loader without the seqlock now genuinely returns a torn view (old
// descriptor + new entries) and fails the consistency assertion.
function makeActivationFake({ descriptor = null, entriesByGeneration = {} } = {}) {
  const state = { descriptor, reads: 0, txAttempts: 0, hooks: { afterDescriptorRead: null } };
  const db = {
    collection: (name) => ({
      doc: (id) => ({
        get: async () => {
          if (name !== 'composition' || id !== 'activation') throw new Error(`unexpected read ${name}/${id}`);
          state.reads += 1;
          // EAGER snapshot: what the store held AT the read, immune to later bumps.
          const frozen = state.descriptor ? { ...state.descriptor } : null;
          const snap = { exists: !!frozen, data: () => frozen };
          const hook = state.hooks.afterDescriptorRead;
          if (hook) { state.hooks.afterDescriptorRead = null; await hook(); }
          return snap;
        },
      }),
    }),
    runTransaction: async (fn) => { state.txAttempts += 1; return fn({ get: async (ref) => ref.get() }); },
  };
  // LIVE layer reads: whatever generation the store is at NOW — the loader's
  // seqlock is the only thing standing between this and a torn view.
  const fetchLayers = async () => ({
    overlayEntries: entriesByGeneration[state.descriptor?.activationGeneration] ?? [],
    epochOverrideEntries: [],
  });
  return { db, state, fetchLayers };
}

const GEN1_ENTRIES = [{ entryKey: 'ruleDoc|agents/a/rules/r1|paramValues.pct', host: 'ruleDoc', docPath: 'agents/a/rules/r1', field: 'paramValues.pct', action: 'clamp', afterValue: 80 }];
const GEN2_ENTRIES = [{ entryKey: 'ruleDoc|agents/a/rules/r1|paramValues.pct', host: 'ruleDoc', docPath: 'agents/a/rules/r1', field: 'paramValues.pct', action: 'clamp', afterValue: 60 }];

describe('B5 contract — generation consistency (seqlock)', () => {
  it('pre-activation: activated=false, generation 0, resolveWith passes base through byte-identically', async () => {
    const { db, fetchLayers } = makeActivationFake({ descriptor: null });
    const loaded = await loadActivatedComposition(db, fetchLayers);
    expect(loaded).toMatchObject({ activated: false, generation: 0, overlayEntries: [] });
    const base = { 'agents/a/rules/r1': { paramValues: { pct: 90 } } };
    const { effectiveDocs } = loaded.resolveWith(base);
    expect(effectiveDocs['agents/a/rules/r1']).toEqual({ paramValues: { pct: 90 } });
  });

  it('steady state: returns the pinned generation and ITS entries', async () => {
    const { db, fetchLayers } = makeActivationFake({
      descriptor: { activationGeneration: 1, activeEpochId: 'e-1', candidateStateId: 'run-1' },
      entriesByGeneration: { 1: GEN1_ENTRIES },
    });
    const loaded = await loadActivatedComposition(db, fetchLayers);
    expect(loaded.generation).toBe(1);
    const { effectiveDocs } = loaded.resolveWith({ 'agents/a/rules/r1': { paramValues: { pct: 90 } } });
    expect(effectiveDocs['agents/a/rules/r1'].paramValues.pct).toBe(80);
  });

  it('a generation bump interleaved MID-READ never yields a torn view — the load RETRIES and returns a CONSISTENT descriptor+entries pair', async () => {
    const { db, state, fetchLayers } = makeActivationFake({
      descriptor: { activationGeneration: 1, activeEpochId: 'e-1', candidateStateId: 'run-1' },
      entriesByGeneration: { 1: GEN1_ENTRIES, 2: GEN2_ENTRIES },
    });
    // The bump lands AFTER the loader's first (eagerly-snapshotted) descriptor
    // read: the loader holds gen 1, the store moves to gen 2, and the LIVE
    // layer read serves gen-2 entries — the torn combination a seqlock-less
    // loader would return.
    state.hooks.afterDescriptorRead = async () => {
      state.descriptor = { activationGeneration: 2, activeEpochId: 'e-2', candidateStateId: 'run-2' };
    };
    const loaded = await loadActivatedComposition(db, fetchLayers);
    // The seqlock genuinely fired: more than one transaction attempt ran.
    expect(state.txAttempts).toBeGreaterThan(1);
    // CONSISTENCY is the contract: the entries are the returned generation's
    // entries. (Here the retry lands at gen 2; a stale-but-consistent view
    // would also satisfy the contract — a TORN one, gen 1 + gen-2 entries,
    // must be impossible.)
    expect(loaded.generation).toBe(2);
    expect(loaded.overlayEntries).toEqual(GEN2_ENTRIES);
    const { effectiveDocs } = loaded.resolveWith({ 'agents/a/rules/r1': { paramValues: { pct: 90 } } });
    expect(effectiveDocs['agents/a/rules/r1'].paramValues.pct).toBe(60); // gen-2 value, never the torn 80
  });

  it('a bump on EVERY read exhausts the seqlock into TornCompositionReadError (never a silent torn view)', async () => {
    const { db, state, fetchLayers } = makeActivationFake({
      descriptor: { activationGeneration: 1 },
      entriesByGeneration: { },
    });
    let g = 1;
    const bumpForever = async () => { g += 1; state.descriptor = { activationGeneration: g }; state.hooks.afterDescriptorRead = bumpForever; };
    state.hooks.afterDescriptorRead = bumpForever;
    await expect(loadActivatedComposition(db, fetchLayers)).rejects.toBeInstanceOf(TornCompositionReadError);
  });
});

describe('B5 contract — every derived write carries its generation', () => {
  it('stampDerivedWrite stamps the LOAD generation; assertGenerationStamped admits it', () => {
    const stamped = stampDerivedWrite({ activeRules: [] }, { generation: 3 });
    expect(stamped.compositionGeneration).toBe(3);
    expect(assertGenerationStamped(stamped)).toBe(stamped);
  });

  it('a derived write MISSING its stamp fails the contract tripwire', () => {
    expect(() => assertGenerationStamped({ activeRules: [] })).toThrow(/compositionGeneration/);
    expect(() => assertGenerationStamped({ activeRules: [], compositionGeneration: -1 })).toThrow(/compositionGeneration/);
    expect(() => stampDerivedWrite({ x: 1 }, {})).toThrow(/numeric generation/);
  });
});

describe('B5 contract — review hardenings (design lens F3/F4)', () => {
  it('F3 (ABA): a rollback+re-activation landing on the SAME generation with a DIFFERENT candidate tuple still retries — generation-only compare would admit the mixed view', async () => {
    const { db, state, fetchLayers } = makeActivationFake({
      descriptor: { activationGeneration: 2, activeEpochId: 'e-2', candidateStateId: 'run-X', semanticHash: 'h-X' },
      entriesByGeneration: { 2: GEN2_ENTRIES },
    });
    // Between the loader's two descriptor reads: rollback to gen 1, then a
    // re-activation minting gen 2 AGAIN with a different candidate (run-Y).
    state.hooks.afterDescriptorRead = async () => {
      state.descriptor = { activationGeneration: 2, activeEpochId: 'e-3', candidateStateId: 'run-Y', semanticHash: 'h-Y' };
    };
    const loaded = await loadActivatedComposition(db, fetchLayers);
    expect(state.txAttempts).toBeGreaterThan(1); // the tuple compare fired
    expect(loaded.descriptor.candidateStateId).toBe('run-Y'); // the settled world, never the mix
  });

  it('F4: a PRESENT descriptor without a well-formed generation fails CLOSED (never the generation-0 dark sentinel)', async () => {
    for (const bad of [{ activeEpochId: 'e-1' }, { activationGeneration: 'two' }, { activationGeneration: NaN }, { activationGeneration: 0 }]) {
      const { db, fetchLayers } = makeActivationFake({ descriptor: bad });
      await expect(loadActivatedComposition(db, fetchLayers)).rejects.toMatchObject({ code: 'activation_descriptor_malformed' });
    }
  });
});
