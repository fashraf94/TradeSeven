// api/_utils/casualClone.perGame.test.js
//
// Build A2 — the casual clone wears the BaggerBomb loadout (rulings D1, FD-1, FD-11), with PER_GAME_LOADOUT_ENABLED
// mocked ON (casualClone.test.js runs the same module flag off, unchanged):
//   - the resync and the creation apply the slot's archetype and book, or the default (the ranked fields) while the
//     slot is absent;
//   - a slot archetype unlike the ranked record's seeds THAT archetype's born-with traits on the clone (the training
//     override's rule), and every resync soft-deletes the trait docs outside the final set;
//   - GUARD 1 is unchanged: a clone mid-battle is never resynced, so a BaggerBomb change during a running game reaches
//     the next deploy only;
//   - the battle snapshot's Character-settings validation (leanRevalidation.js buildCustomizationSnapshot, the kernel
//     the fenced createAgentBattle delegates to) judges the clone's leans against the clone's own archetype.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCasualCloneDoc, buildCasualCloneResync, ensureCasualClone } from './casualClone.js';
import { buildCustomizationSnapshot, revalidateStandingLeans } from './leanRevalidation.js';
import { ARCHETYPE_DEFAULT_TRAITS } from '../../src/data/traitLibrary.js';

vi.mock('../../src/config/perGameLoadoutFlags.js', () => ({ PER_GAME_LOADOUT_ENABLED: true }));

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

/** A path-keyed store (casualClone.test.js's idiom), with `.firestore` on refs (the soft-delete's epoch check) and no cloning of sentinels. */
function makeDb(initial = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]));
  let db;
  const childrenOf = (prefix) => {
    const docs = [];
    for (const [path, data] of store.entries()) {
      if (!path.startsWith(`${prefix}/`)) continue;
      const rel = path.slice(prefix.length + 1);
      if (rel.includes('/')) continue;
      docs.push({ id: rel, data: () => ({ ...data }) });
    }
    return docs;
  };
  const snapshotOf = (docs) => ({ docs, empty: docs.length === 0, size: docs.length, forEach: (cb) => docs.forEach(cb) });
  const docRef = (path) => ({
    path,
    id: path.split('/').pop(),
    get firestore() { return db; },
    get: async () => { const d = store.get(path); return { exists: d !== undefined, id: path.split('/').pop(), data: () => (d === undefined ? undefined : { ...d }) }; },
    set: async (d) => { store.set(path, { ...d }); },
    create: async (d) => {
      if (store.has(path)) { const e = new Error('ALREADY_EXISTS'); e.code = 6; throw e; }
      store.set(path, { ...d });
    },
    update: async (u) => { store.set(path, { ...(store.get(path) || {}), ...u }); },
    collection: (sub) => collectionRef(`${path}/${sub}`),
  });
  const collectionRef = (prefix) => ({
    doc: (id) => docRef(`${prefix}/${id}`),
    where: (field, _op, value) => ({ get: async () => snapshotOf(childrenOf(prefix).filter((d) => d.data()[field] === value)) }),
    get: async () => snapshotOf(childrenOf(prefix)),
  });
  const runTransaction = async (fn) => fn({
    get: async (ref) => ref.get(),
    getAll: async (...refs) => Promise.all(refs.map((r) => r.get())),
    set: async (ref, d) => ref.set(d),
    create: async (ref, d) => ref.create(d),
    update: async (ref, u) => ref.update(u),
  });
  db = { collection: (name) => collectionRef(name), runTransaction };
  return { db, store };
}

const OWNER = 'user-42';
const CLONE = 'agents/casual-agent-user-42';
const RANKED = Object.freeze({
  id: 'ranked-1',
  ownerId: OWNER,
  archetype: 'contrarian',
  equippedTraits: [{ traitId: 'ranked-trait' }],
  equippedWatchlistId: 'wl-ind',
  equippedWatchlistName: 'Industrials',
  config: { risk: 60 },
  memory: [],
});
const SLOT_DEGEN = Object.freeze({ archetype: 'degen', book: { ref: { watchlistId: 'wl-energy' }, name: 'Energy Movers', pin: null } });
const withSlot = (slot) => ({ ...RANKED, loadouts: { baggerbomb: slot } });
const existingClone = (extra = {}) => ({
  ...buildCasualCloneDoc(RANKED, { odUserId: OWNER, nowIso: '2026-11-01T00:00:00.000Z' }),
  ...extra,
});

describe('the builders apply the BaggerBomb loadout', () => {
  it('a slot: its archetype and book over the inherited fields, everything else inherited', () => {
    const resync = buildCasualCloneResync(withSlot(SLOT_DEGEN));
    expect(resync).toMatchObject({ archetype: 'degen', equippedWatchlistId: 'wl-energy', equippedWatchlistName: 'Energy Movers', config: { risk: 60 } });
    expect(buildCasualCloneDoc(withSlot(SLOT_DEGEN), { odUserId: OWNER, nowIso: 'n' })).toMatchObject({ archetype: 'degen', equippedWatchlistId: 'wl-energy' });
  });

  it('the default (no slot): the ranked fields, exactly what the clone took before A2', () => {
    expect(buildCasualCloneResync(RANKED)).toMatchObject({ archetype: 'contrarian', equippedWatchlistId: 'wl-ind', equippedWatchlistName: 'Industrials' });
  });

  it('a slot with no book: the clone deploys with no list (the open market)', () => {
    const resync = buildCasualCloneResync(withSlot({ archetype: 'degen', book: { ref: null, name: null, pin: null } }));
    expect(resync).toMatchObject({ archetype: 'degen', equippedWatchlistId: null, equippedWatchlistName: null });
  });
});

describe('the resync at deploy', () => {
  it('applies the slot and seeds its archetype\'s born-with traits; the parent\'s trait docs go inert on the clone', async () => {
    const { db, store } = makeDb({
      'agents/ranked-1': withSlot(SLOT_DEGEN),
      'agents/ranked-1/rules/r-trait': { traitId: 'ranked-trait', isDeleted: false },
      'agents/ranked-1/rules/r-plain': { status: 'active' },
      [CLONE]: existingClone(),
    });
    await ensureCasualClone(db, { odUserId: OWNER });
    const clone = store.get(CLONE);
    expect(clone.archetype).toBe('degen');
    expect(clone.equippedWatchlistId).toBe('wl-energy');
    expect(clone.equippedTraits.map((t) => t.traitId)).toEqual(ARCHETYPE_DEFAULT_TRAITS.degen);
    // the seeded docs, deterministic ids, live; the parent's copied trait doc soft-deleted on the clone; a plain rule kept
    const seeded = [...store.keys()].filter((k) => k.startsWith(`${CLONE}/rules/bornwith__`));
    expect(seeded.length).toBeGreaterThan(0);
    expect(store.get(`${CLONE}/rules/r-trait`).isDeleted).toBe(true);
    expect(store.get(`${CLONE}/rules/r-plain`).isDeleted).toBeUndefined();
    // the parent is untouched
    expect(store.get('agents/ranked-1/rules/r-trait').isDeleted).toBe(false);
    expect(store.get('agents/ranked-1').archetype).toBe('contrarian');
  });

  it('the default: the ranked archetype and traits, no seed', async () => {
    const { db, store } = makeDb({ 'agents/ranked-1': RANKED, [CLONE]: existingClone({ archetype: 'analyst' }) });
    await ensureCasualClone(db, { odUserId: OWNER });
    const clone = store.get(CLONE);
    expect(clone.archetype).toBe('contrarian');
    expect(clone.equippedTraits).toEqual([{ traitId: 'ranked-trait' }]);
    expect([...store.keys()].some((k) => k.includes('/rules/bornwith__'))).toBe(false);
  });

  it('BaggerBomb returning to the parent\'s archetype takes the parent\'s traits back and retires the last set\'s seeded docs', async () => {
    const { db, store } = makeDb({
      'agents/ranked-1': withSlot(SLOT_DEGEN),
      'agents/ranked-1/rules/r-trait': { traitId: 'ranked-trait', isDeleted: false },
      [CLONE]: existingClone(),
    });
    await ensureCasualClone(db, { odUserId: OWNER });
    store.set('agents/ranked-1', withSlot({ ...SLOT_DEGEN, archetype: 'contrarian' }));
    await ensureCasualClone(db, { odUserId: OWNER });
    const clone = store.get(CLONE);
    expect(clone.archetype).toBe('contrarian');
    expect(clone.equippedTraits).toEqual([{ traitId: 'ranked-trait' }]);
    const seeded = [...store.entries()].filter(([k]) => k.startsWith(`${CLONE}/rules/bornwith__`));
    expect(seeded.length).toBeGreaterThan(0);
    for (const [, doc] of seeded) expect(doc.isDeleted).toBe(true);
    expect(store.get(`${CLONE}/rules/r-trait`).isDeleted).toBe(false); // re-copied from the parent, back in the set
  });

  it('GUARD 1, unchanged: a BaggerBomb change during a running game reaches the next deploy only', async () => {
    const { db, store } = makeDb({ 'agents/ranked-1': RANKED, [CLONE]: existingClone({ activeBattleId: 'bb-live' }) });
    // the running game deployed in the default (contrarian); the player sets BaggerBomb to degen mid-game
    store.set('agents/ranked-1', withSlot(SLOT_DEGEN));
    await ensureCasualClone(db, { odUserId: OWNER });
    expect(store.get(CLONE).archetype).toBe('contrarian'); // the running game's clone is never re-pointed
    // the game ends; the next deploy's resync carries the change
    store.set(CLONE, { ...store.get(CLONE), activeBattleId: null });
    await ensureCasualClone(db, { odUserId: OWNER });
    expect(store.get(CLONE).archetype).toBe('degen');
    expect(store.get(CLONE).equippedWatchlistId).toBe('wl-energy');
  });
});

describe('the creation: a slot set before the first-ever deploy reaches the clone\'s birth', () => {
  it('creates the clone in the slot, its traits seeded before the sentinel doc', async () => {
    const { db, store } = makeDb({ 'agents/ranked-1': withSlot(SLOT_DEGEN) });
    const r = await ensureCasualClone(db, { odUserId: OWNER });
    expect(r.created).toBe(true);
    const clone = store.get(CLONE);
    expect(clone.archetype).toBe('degen');
    expect(clone.equippedTraits.map((t) => t.traitId)).toEqual(ARCHETYPE_DEFAULT_TRAITS.degen);
    expect(clone.isCasualClone).toBe(true);
  });
});

describe('the battle snapshot\'s Character-settings validation covers a clone whose archetype differs from the parent\'s (Phase 0 §3.2)', () => {
  // TF-01 is on the Trend Follower's menu, CP-04 is not (cloneManifestParity.guard.test.js's fixture).
  const leans = [
    { adjustmentId: 'TF-01', version: 1, equippedAt: '2026-11-01T00:00:00.000Z' },
    { adjustmentId: 'CP-04', version: 1, equippedAt: '2026-11-01T00:00:00.000Z' },
  ];
  const parent = { ...RANKED, archetype: 'momentum_chaser', standingLeans: leans, dials: { tempo: 'measured' }, settingsRev: 9 };

  it('the snapshot judges the clone\'s leans against the clone\'s archetype (the slot\'s), not the parent\'s', () => {
    const clone = { id: 'casual-agent-user-42', ...buildCasualCloneResync({ ...parent, loadouts: { baggerbomb: { archetype: 'contrarian', book: { ref: null, name: null, pin: null } } } }) };
    expect(clone.archetype).toBe('contrarian');
    const frozen = buildCustomizationSnapshot(clone, '2026-11-06T15:00:00.000Z');
    const underContrarian = revalidateStandingLeans({ standingLeans: leans, archetypeCodeId: 'contrarian' });
    const underParent = revalidateStandingLeans({ standingLeans: leans, archetypeCodeId: 'momentum_chaser' });
    expect(frozen.standingLeans).toEqual(underContrarian.valid);
    expect(frozen.standingLeansInvalidated).toEqual(underContrarian.invalidated);
    // and that is a different judgment from the parent's, so the row can tell them apart
    expect(underContrarian.valid.map((l) => l.adjustmentId)).not.toEqual(underParent.valid.map((l) => l.adjustmentId));
    expect(frozen).toEqual(buildCustomizationSnapshot({ ...parent, id: 'casual-agent-user-42', archetype: 'contrarian' }, '2026-11-06T15:00:00.000Z'));
  });
});
