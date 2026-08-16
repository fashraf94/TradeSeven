// api/_utils/casualClone.test.js
//
// Per-Battle Loadout + Per-Type Concurrency Phase 1 — the CASUAL clone identity.
// Covers the id codec + prefix predicates, the pure clone-doc builder (pure
// inherit + casual markers + fresh history, NO groupId), the idempotent
// NEVER-OVERWRITE get-or-create (create when absent, return existing untouched,
// race → ALREADY_EXISTS, no-ranked-agent throw), and resolveAttributionAgentId
// (casual → parent, non-casual → self, preresolved, degrade-to-clone).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's real import of
// casualClone.js (whose graph pulls trainingClone.js → src constants) IS the
// runtime guard that the api/ → src/ import surface stays Node-clean. Never mock it.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildCasualCloneDoc,
  ensureCasualClone,
  resolveAttributionAgentId,
} from './casualClone.js';
import {
  casualCloneDocId,
  isCasualCloneId,
  isCloneAgentId,
  CASUAL_CLONE_ID_PREFIX,
  TRAINING_CLONE_ID_PREFIX,
  trainingCloneDocId,
} from '../../src/constants/leagueTournament.js';

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// ==================== IN-MEMORY FIRESTORE (makeDb idiom + create()) ====================

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
      create: async (data) => {
        if (store.has(path)) {
          const err = new Error(`ALREADY_EXISTS: document already exists: ${path}`);
          err.code = 6;
          throw err;
        }
        store.set(path, structuredClone(data));
      },
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
  // The store is path-keyed, so composition/writeEpoch and
  // composition/activation already resolve ABSENT — the pre-genesis posture
  // the live fence fails open on. The missing piece was the transaction:
  // acquireProvisionerLease (lit at ACTIVATION_RUNBOOK step 1.1) registers the
  // B2 lease inside db.runTransaction, which the dark helper never reached.
  const runTransaction = async (fn) => fn({
    get: async (ref) => ref.get(),
    getAll: async (...refs) => Promise.all(refs.map((r) => r.get())),
    set: async (ref, d) => ref.set(d),
    create: async (ref, d) => ref.create(d),
    update: async (ref, u) => ref.update(u),
  });
  return { db: { collection: (name) => makeCollection(name), runTransaction }, store };
}

const RANKED = Object.freeze({
  id: 'ranked-1',
  ownerId: 'user-42',
  archetype: 'contrarian',
  name: 'Viper',
  config: { risk: 60 },
  equippedTraits: ['t1', 't2'],
  activeRules: [{ id: 'r1' }],
  equippedBundleIds: ['b1'],
  equippedWatchlistId: 'wl-1',
  consolidatedInsight: 'buy the dip',
  disciplines: ['patience'],
  evolutionCycle: 3,
  // history/pointer fields that MUST NOT carry onto the clone:
  memory: [{ gameId: 'old' }],
  stats: { wins: 9, losses: 1, gamesPlayed: 10, totalScore: 100, avgScore: 10, currentStreak: 3, bestStreak: 5 },
  activeBattleId: 'ranked-battle-live',
  lastDeployedAt: '2026-08-01T00:00:00.000Z',
});

// ==================== id codec + predicates ====================

describe('casual clone id codec + predicates', () => {
  it('casualCloneDocId is deterministic per user and prefixed', () => {
    expect(casualCloneDocId('user-42')).toBe('casual-agent-user-42');
    expect(casualCloneDocId('user-42')).toBe(casualCloneDocId('user-42')); // deterministic
    expect(casualCloneDocId('user-42').startsWith(CASUAL_CLONE_ID_PREFIX)).toBe(true);
  });

  it('casualCloneDocId throws on a missing/empty odUserId', () => {
    expect(() => casualCloneDocId('')).toThrow();
    expect(() => casualCloneDocId(null)).toThrow();
  });

  it('isCasualCloneId matches ONLY the casual prefix (not training/cpu/real)', () => {
    expect(isCasualCloneId('casual-agent-user-42')).toBe(true);
    expect(isCasualCloneId(trainingCloneDocId('grp', 'user-42'))).toBe(false);
    expect(isCasualCloneId('cpu-agent-1')).toBe(false);
    expect(isCasualCloneId('ranked-1')).toBe(false);
    expect(isCasualCloneId(null)).toBe(false);
  });

  it('isCloneAgentId matches BOTH clone families but never a real ranked id', () => {
    expect(isCloneAgentId('casual-agent-user-42')).toBe(true);
    expect(isCloneAgentId(`${TRAINING_CLONE_ID_PREFIX}grp-user-42`)).toBe(true);
    expect(isCloneAgentId('ranked-1')).toBe(false);
    expect(isCloneAgentId('cpu-agent-1')).toBe(false); // CPU is not a ranked-owner-lookup collision
  });
});

// ==================== buildCasualCloneDoc (pure) ====================

describe('buildCasualCloneDoc', () => {
  const doc = buildCasualCloneDoc(RANKED, { odUserId: 'user-42', nowIso: '2026-08-05T12:00:00.000Z' });

  it('inherits the ranked loadout (Trading Brain) by value', () => {
    expect(doc.archetype).toBe('contrarian');
    expect(doc.name).toBe('Viper');
    expect(doc.equippedTraits).toEqual(['t1', 't2']);
    expect(doc.activeRules).toEqual([{ id: 'r1' }]);
    expect(doc.equippedBundleIds).toEqual(['b1']);
    expect(doc.equippedWatchlistId).toBe('wl-1');
    expect(doc.consolidatedInsight).toBe('buy the dip');
  });

  it('carries the casual markers + parent pointer, NOT the training/pod markers', () => {
    expect(doc.isCasualClone).toBe(true);
    expect(doc.rankedAgentId).toBe('ranked-1');
    expect(doc.ownerId).toBe('user-42');           // the PLAYER
    expect('isTrainingClone' in doc).toBe(false);  // not a training clone
    expect('groupId' in doc).toBe(false);          // persistent, not pod-scoped
  });

  it('resets history + pointers fresh (never inherits ranked battle state)', () => {
    expect(doc.memory).toEqual([]);
    expect(doc.stats).toEqual({ wins: 0, losses: 0, gamesPlayed: 0, totalScore: 0, avgScore: 0, currentStreak: 0, bestStreak: 0 });
    expect(doc.activeBattleId).toBeNull();
    expect(doc.pendingConsolidation).toBe(false);
    expect(doc.lastDeployedAt).toBeNull();
    expect(doc.deployingAt).toBeNull();
  });

  it('is pure — does not mutate the ranked agent', () => {
    const before = structuredClone(RANKED);
    buildCasualCloneDoc(RANKED, { odUserId: 'user-42', nowIso: '2026-08-05T12:00:00.000Z' });
    expect(RANKED).toEqual(before);
  });
});

// ==================== ensureCasualClone (idempotent, never-overwrite) ====================

describe('ensureCasualClone', () => {
  it('creates the clone from the ranked agent when absent', async () => {
    const { db, store } = makeDb({ 'agents/ranked-1': RANKED });
    // LIVE clock, matching this suite's other ensureCasualClone calls. The B2
    // provisioner lease is minted from the INJECTED clock but its currency is
    // re-checked against the REAL one (casualClone.js:183 calls
    // assertLeaseCurrent with no `now`), so a frozen historical date now reads
    // as an expired lease the moment the fence is lit. Nothing here asserts on
    // a timestamp, so the live clock costs the test nothing.
    const r = await ensureCasualClone(db, { odUserId: 'user-42', now: new Date() });
    expect(r).toEqual({ cloneId: 'casual-agent-user-42', rankedAgentId: 'ranked-1', created: true });
    const clone = store.get('agents/casual-agent-user-42');
    expect(clone.isCasualClone).toBe(true);
    expect(clone.rankedAgentId).toBe('ranked-1');
    expect(clone.archetype).toBe('contrarian');
    expect(clone.stats.gamesPlayed).toBe(0);
  });

  it('copies the ranked agent rules + bundles subcollections onto the clone', async () => {
    const { db, store } = makeDb({
      'agents/ranked-1': RANKED,
      'agents/ranked-1/rules/rule-a': { id: 'rule-a', status: 'active' },
      'agents/ranked-1/bundles/bun-a': { id: 'bun-a', status: 'equipped' },
    });
    await ensureCasualClone(db, { odUserId: 'user-42' });
    expect(store.get('agents/casual-agent-user-42/rules/rule-a')).toEqual({ id: 'rule-a', status: 'active' });
    expect(store.get('agents/casual-agent-user-42/bundles/bun-a')).toEqual({ id: 'bun-a', status: 'equipped' });
  });

  it('RE-SYNCS an existing clone to the CURRENT parent brain at deploy (ruling 3); preserves identity/markers/stats', async () => {
    const existingClone = {
      ...buildCasualCloneDoc(RANKED, { odUserId: 'user-42', nowIso: '2026-08-01T00:00:00.000Z' }),
      // stale day-zero brain + artificial stats + NOT mid-battle:
      memory: [{ gameId: 'stale' }],
      consolidatedInsight: 'stale insight',
      archetype: 'analyst',
      stats: { wins: 2, losses: 1, gamesPlayed: 3, totalScore: 30, avgScore: 10, currentStreak: 1, bestStreak: 2 },
      activeBattleId: null,
    };
    // The parent has since EVOLVED (new memory/insight/archetype):
    const parent = { ...RANKED, memory: [{ gameId: 'p1' }, { gameId: 'p2' }], consolidatedInsight: 'current insight', archetype: 'contrarian' };
    const { db, store } = makeDb({ 'agents/ranked-1': parent, 'agents/casual-agent-user-42': existingClone });
    const r = await ensureCasualClone(db, { odUserId: 'user-42' });
    expect(r.created).toBe(false); // still an existing clone, not a fresh create
    const clone = store.get('agents/casual-agent-user-42');
    // BRAIN re-synced from the current parent:
    expect(clone.memory).toEqual([{ gameId: 'p1' }, { gameId: 'p2' }]);
    expect(clone.consolidatedInsight).toBe('current insight');
    expect(clone.archetype).toBe('contrarian');
    // IDENTITY / markers / pointers / stats preserved (never-overwrite for identity):
    expect(clone.isCasualClone).toBe(true);
    expect(clone.rankedAgentId).toBe('ranked-1');
    expect(clone.ownerId).toBe('user-42');
    expect(clone.activeBattleId).toBeNull();
    expect(clone.stats).toEqual({ wins: 2, losses: 1, gamesPlayed: 3, totalScore: 30, avgScore: 10, currentStreak: 1, bestStreak: 2 });
  });

  it('SKIPS re-sync while the clone is MID-BATTLE (guard 1 — brain never re-pointed under a live battle)', async () => {
    const existingClone = {
      ...buildCasualCloneDoc(RANKED, { odUserId: 'user-42', nowIso: '2026-08-01T00:00:00.000Z' }),
      memory: [{ gameId: 'live-battle-memory' }],
      activeBattleId: 'b-live', // mid-battle → re-sync SKIPPED
    };
    const parent = { ...RANKED, memory: [{ gameId: 'p-new' }] };
    const { db, store } = makeDb({ 'agents/ranked-1': parent, 'agents/casual-agent-user-42': existingClone });
    const r = await ensureCasualClone(db, { odUserId: 'user-42' });
    expect(r.created).toBe(false);
    // brain untouched — the live clone is not re-pointed under it:
    expect(store.get('agents/casual-agent-user-42').memory).toEqual([{ gameId: 'live-battle-memory' }]);
    expect(store.get('agents/casual-agent-user-42').activeBattleId).toBe('b-live');
  });

  it('re-sync REFUSES a cross-user parent (poisoned rankedAgentId on an otherwise-authentic clone)', async () => {
    // authentic-looking (own owner + isCasualClone) but rankedAgentId points at a victim
    const existingClone = { ownerId: 'user-42', isCasualClone: true, rankedAgentId: 'victim-agent', memory: [{ gameId: 'keep' }], activeBattleId: null };
    const { db, store } = makeDb({ 'agents/victim-agent': { ownerId: 'victim', memory: [{ gameId: 'secret' }] }, 'agents/casual-agent-user-42': existingClone });
    await ensureCasualClone(db, { odUserId: 'user-42' });
    // NOT mirrored from the victim — same-owner guard refused:
    expect(store.get('agents/casual-agent-user-42').memory).toEqual([{ gameId: 'keep' }]);
  });

  it('throws no_ranked_agent when the caller has no ranked agent', async () => {
    const { db } = makeDb({}); // no agents at all
    await expect(ensureCasualClone(db, { odUserId: 'user-42' })).rejects.toThrow('no_ranked_agent');
  });

  it('HEALS an inauthentic SQUAT (wrong owner) — overwrites with a fresh legit clone (security CONFIRMED-2)', async () => {
    // Attacker pre-planted casual-agent-user-42 owned by themselves w/ a poisoned parent.
    const squat = { ownerId: 'attacker', isCasualClone: true, rankedAgentId: 'someone-elses-agent', memory: [{ gameId: 'evil' }] };
    const { db, store } = makeDb({ 'agents/ranked-1': RANKED, 'agents/casual-agent-user-42': squat });
    const r = await ensureCasualClone(db, { odUserId: 'user-42' });
    expect(r.created).toBe(true); // healed = re-provisioned, deploy proceeds (no DoS)
    const healed = store.get('agents/casual-agent-user-42');
    expect(healed.ownerId).toBe('user-42');        // now owned by the victim
    expect(healed.rankedAgentId).toBe('ranked-1');  // correct parent, not the poisoned one
    expect(healed.isCasualClone).toBe(true);
    expect(healed.memory).toEqual([]);              // attacker's payload gone
  });

  it('HEALS a bare doc missing isCasualClone (even if same owner) rather than adopting it', async () => {
    const { db, store } = makeDb({ 'agents/ranked-1': RANKED, 'agents/casual-agent-user-42': { ownerId: 'user-42', archetype: 'junk' } });
    const r = await ensureCasualClone(db, { odUserId: 'user-42' });
    expect(r.created).toBe(true);
    expect(store.get('agents/casual-agent-user-42').isCasualClone).toBe(true);
    expect(store.get('agents/casual-agent-user-42').rankedAgentId).toBe('ranked-1');
  });

  it('resolves the ranked agent EXCLUDING clones (a stale clone never becomes the parent)', async () => {
    const { db, store } = makeDb({
      'agents/casual-agent-user-42': { ownerId: 'user-42', isCasualClone: true, rankedAgentId: 'ranked-1' },
    });
    // The existing clone short-circuits (never-overwrite), so add a real ranked agent
    // and a training clone, then delete the casual clone to force the resolve path.
    store.delete('agents/casual-agent-user-42');
    store.set('agents/training-agent-g-user-42', { ownerId: 'user-42', isTrainingClone: true });
    store.set('agents/ranked-1', RANKED);
    const r = await ensureCasualClone(db, { odUserId: 'user-42' });
    expect(r.rankedAgentId).toBe('ranked-1'); // the non-clone doc, never the training clone
  });

  it('is race-safe: a create() that hits ALREADY_EXISTS returns the winner untouched, no throw', async () => {
    // A db where the pre-check get() sees the clone ABSENT (racer has not committed
    // yet), but create() throws ALREADY_EXISTS (racer committed in between) — then
    // the follow-up get() returns the winner's doc.
    const winner = {
      ...buildCasualCloneDoc(RANKED, { odUserId: 'user-42', nowIso: '2026-08-05T00:00:00.000Z' }),
      memory: [{ gameId: 'winner', lesson: 'racer got here first' }],
    };
    let getCalls = 0;
    const cloneRef = {
      get: async () => {
        getCalls += 1;
        // 1st get (pre-check): absent. Later get (after ALREADY_EXISTS): the winner.
        return getCalls === 1
          ? { exists: false, data: () => undefined }
          : { exists: true, data: () => structuredClone(winner) };
      },
      create: async () => { const e = new Error('ALREADY_EXISTS: document already exists'); e.code = 6; throw e; },
    };
    const db = {
      collection: (name) => ({
        doc: (id) => (name === 'agents' && id === 'casual-agent-user-42'
          ? cloneRef
          // The catch-all now also serves composition/writeEpoch and
          // composition/activation as ABSENT (pre-genesis ⇒ the live fence
          // fails open) and absorbs the B2 lease write.
          : { get: async () => ({ exists: false }), set: async () => {}, collection: () => ({ get: async () => ({ docs: [], forEach() {} }) }) }),
        where: () => ({ get: async () => ({ docs: [{ id: 'ranked-1', data: () => structuredClone(RANKED) }], empty: false, forEach(cb) { this.docs.forEach(cb); } }) }),
      }),
      // acquireProvisionerLease takes the B2 lease inside a transaction now
      // that ACTIVATION_RUNBOOK step 1.1 has lit the fence.
      runTransaction: async (fn) => fn({
        get: async (ref) => ref.get(),
        set: async (ref, d) => ref.set(d),
      }),
    };
    const r = await ensureCasualClone(db, { odUserId: 'user-42' });
    expect(r).toEqual({ cloneId: 'casual-agent-user-42', rankedAgentId: 'ranked-1', created: false });
    expect(getCalls).toBeGreaterThanOrEqual(2); // pre-check absent, then re-read the winner
  });
});

// ==================== resolveAttributionAgentId ====================

describe('resolveAttributionAgentId', () => {
  it('a CASUAL clone battle attributes to the PARENT ranked agent (same-owner)', async () => {
    const { db } = makeDb({
      'agents/casual-agent-user-42': { ownerId: 'user-42', isCasualClone: true, rankedAgentId: 'ranked-1' },
      'agents/ranked-1': { ownerId: 'user-42' }, // same owner → guard passes
    });
    const target = await resolveAttributionAgentId(db, { agentId: 'casual-agent-user-42' });
    expect(target).toBe('ranked-1');
  });

  it('a NON-casual battle attributes to its own agentId, unchanged (byte-identical, no read)', async () => {
    const throwingDb = { collection: () => ({ doc: () => ({ get: async () => { throw new Error('must not read'); } }) }) };
    expect(await resolveAttributionAgentId(throwingDb, { agentId: 'ranked-1' })).toBe('ranked-1');
    expect(await resolveAttributionAgentId(throwingDb, { agentId: 'training-agent-g-user-42' })).toBe('training-agent-g-user-42');
    expect(await resolveAttributionAgentId(throwingDb, { agentId: 'cpu-agent-1' })).toBe('cpu-agent-1');
  });

  it('REFUSES a cross-user target (squat w/ poisoned rankedAgentId) — attributes to the clone, never the victim', async () => {
    const { db } = makeDb({
      'agents/casual-agent-attacker': { ownerId: 'attacker', isCasualClone: true, rankedAgentId: 'victim-agent' },
      'agents/victim-agent': { ownerId: 'victim' }, // DIFFERENT owner
    });
    const target = await resolveAttributionAgentId(db, { agentId: 'casual-agent-attacker' });
    expect(target).toBe('casual-agent-attacker'); // guard refuses cross-user → stays on the clone
  });

  it('degrades SAFELY to the clone id when the clone doc/rankedAgentId/parent is missing (no throw)', async () => {
    const { db } = makeDb({}); // no clone doc
    expect(await resolveAttributionAgentId(db, { agentId: 'casual-agent-ghost' })).toBe('casual-agent-ghost');
    // clone present but parent doc missing → also degrades to the clone
    const { db: db2 } = makeDb({ 'agents/casual-agent-x': { ownerId: 'u', isCasualClone: true, rankedAgentId: 'gone' } });
    expect(await resolveAttributionAgentId(db2, { agentId: 'casual-agent-x' })).toBe('casual-agent-x');
  });
});
