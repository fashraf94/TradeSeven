// api/_utils/trainingClone.test.js
//
// League Training Slice 3 battery: the training-agent CLONE identity. Covers the
// deterministic id codec, the pure clone-doc builder (inherit-forward + the
// Slice-5 loadoutSpec override + fresh history/markers), the ranked-agent
// resolver (EXCLUDE clones), and ensureTrainingClones (human-only, subcollection
// copy, idempotent get-or-create, no-ranked-agent skip).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's real import of
// trainingClone.js IS the runtime guard that its api/ -> src/ import surface
// stays Node-clean. Never mock that import.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  resolveRankedAgent,
  buildTrainingCloneDoc,
  ensureTrainingClones,
} from './trainingClone.js';
import { trainingCloneDocId, TRAINING_CLONE_ID_PREFIX } from '../../src/constants/leagueTournament.js';

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
  return { db: { collection: (name) => makeCollection(name) }, store };
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
});
