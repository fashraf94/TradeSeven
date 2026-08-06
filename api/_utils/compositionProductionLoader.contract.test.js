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
function makeActivationFake({ descriptor = null, entriesByGeneration = {} } = {}) {
  const state = { descriptor, reads: 0, hooks: { afterDescriptorRead: null } };
  const db = {
    collection: (name) => ({
      doc: (id) => ({
        get: async () => {
          if (name !== 'composition' || id !== 'activation') throw new Error(`unexpected read ${name}/${id}`);
          state.reads += 1;
          const snap = { exists: !!state.descriptor, data: () => state.descriptor };
          const hook = state.hooks.afterDescriptorRead;
          if (hook) { state.hooks.afterDescriptorRead = null; await hook(); }
          return snap;
        },
      }),
    }),
    runTransaction: async (fn) => fn({ get: async (ref) => ref.get() }),
  };
  const fetchLayers = async ({ descriptor: d }) => ({
    overlayEntries: entriesByGeneration[d.activationGeneration] ?? [],
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

  it('a generation bump interleaved MID-READ never yields a torn view — the load retries and returns the NEW generation with the NEW entries', async () => {
    const { db, state, fetchLayers } = makeActivationFake({
      descriptor: { activationGeneration: 1, activeEpochId: 'e-1', candidateStateId: 'run-1' },
      entriesByGeneration: { 1: GEN1_ENTRIES, 2: GEN2_ENTRIES },
    });
    // After the loader's FIRST descriptor read, an activation lands: gen 1→2.
    state.hooks.afterDescriptorRead = async () => {
      state.descriptor = { activationGeneration: 2, activeEpochId: 'e-2', candidateStateId: 'run-2' };
    };
    const loaded = await loadActivatedComposition(db, fetchLayers);
    // TORN would be: generation 2 with gen-1 entries (or vice versa). The
    // contract: whatever generation is returned, the entries are ITS entries.
    expect(loaded.generation).toBe(2);
    expect(loaded.overlayEntries).toEqual(GEN2_ENTRIES);
    const { effectiveDocs } = loaded.resolveWith({ 'agents/a/rules/r1': { paramValues: { pct: 90 } } });
    expect(effectiveDocs['agents/a/rules/r1'].paramValues.pct).toBe(60); // gen-2 value, never 80
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
