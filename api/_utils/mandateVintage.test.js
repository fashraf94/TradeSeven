// api/_utils/mandateVintage.test.js
import { describe, it, expect } from 'vitest';
import {
  buildVintagePayload,
  computeVintageHash,
  vintageDocId,
  vintageRefPath,
  resolveVintage,
  publishVintage,
  VINTAGE_COLLECTION,
  VINTAGE_SCHEMA_VERSION,
} from './mandateVintage.js';
import { listArchetypeIds, ARCHETYPE_IDENTITY_VERSION, computeIdentityHash } from './archetypeRegistry.js';
import {
  MANDATE_CASH_FLOOR_PCT,
  MANDATE_MIN_POSITIONS,
  MANDATE_MAX_POSITIONS,
} from './mandateConfig.js';

const CODE = listArchetypeIds()[0];

// Minimal in-memory Firestore fake (runTransaction + collection().doc()).
function makeFakeDb(seed = {}) {
  const store = new Map(Object.entries(seed));
  let auto = 0;
  const setInto = (path, data, opts) => {
    const prev = store.get(path);
    store.set(path, opts && opts.merge && prev ? { ...prev, ...data } : data);
  };
  const db = {
    collection: (col) => ({
      doc: (id) => {
        const path = `${col}/${id ?? `auto_${++auto}`}`;
        return {
          path,
          id: path.split('/').pop(),
          get: async () => ({ exists: store.has(path), data: () => store.get(path) }),
          set: (data, opts) => setInto(path, data, opts),
        };
      },
    }),
    runTransaction: async (fn) => fn({
      get: async (ref) => ({ exists: store.has(ref.path), data: () => store.get(ref.path) }),
      set: (ref, data, opts) => setInto(ref.path, data, opts),
    }),
  };
  return { db, store };
}

describe('mandateVintage — payload completeness (§5.1 / FR-6 / rider 2)', () => {
  const payload = buildVintagePayload(CODE);

  it('records the current ARCHETYPE_IDENTITY_VERSION (rider 2 — the audit join key)', () => {
    expect(payload.versionConstants.archetypeIdentityVersion).toBe(ARCHETYPE_IDENTITY_VERSION);
  });

  it('carries calibrationBundleVersion — the constant computeIdentityHash asymmetrically DROPS (§13/Q2)', () => {
    expect(payload.versionConstants.calibrationBundleVersion).toBeTypeOf('number');
    // present twice by construction: version block AND the embedded physics
    expect(payload.archetypeContent.physics.calibrationBundleVersion)
      .toBe(payload.versionConstants.calibrationBundleVersion);
  });

  it('freezes the model seat (FR-6 / D-44)', () => {
    expect(payload.modelSeat.provider).toBeTruthy();
    expect(payload.modelSeat.model).toBeTruthy();
    expect(payload.modelSeat.params).toBeTruthy();
  });

  it('freezes the gate config incl. the per-archetype sector cap from the registry (O-5)', () => {
    expect(payload.gateConfig.cashFloorPct).toBe(MANDATE_CASH_FLOOR_PCT);
    expect(payload.gateConfig.minPositions).toBe(MANDATE_MIN_POSITIONS);
    expect(payload.gateConfig.maxPositions).toBe(MANDATE_MAX_POSITIONS);
    expect(payload.gateConfig.decisionVerbs).toEqual(['BUY', 'SELL', 'TRIM', 'ADD', 'HOLD']);
    // sector cap is the per-archetype registry value (physics.sectorConcentrationCap)
    expect(payload.gateConfig.sectorConcentrationCap)
      .toBe(payload.archetypeContent.physics.sectorConcentrationCap);
  });

  it('carries cadenceTier and a displayVintage that names the identity version', () => {
    expect(['slow', 'standard', 'fast']).toContain(payload.cadenceTier);
    expect(payload.displayVintage).toContain(`v${ARCHETYPE_IDENTITY_VERSION}`);
  });

  it('fails closed on an unknown archetype', () => {
    expect(() => buildVintagePayload('not_an_archetype')).toThrow();
  });
});

describe('mandateVintage — content-addressed hash (§5.1 / Option A)', () => {
  it('is a deterministic sha256 hex of the complete payload', () => {
    const p = buildVintagePayload(CODE);
    const h1 = computeVintageHash(p);
    const h2 = computeVintageHash(buildVintagePayload(CODE));
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(h1).toBe(h2); // same content → same address
  });

  it('CHANGES when calibrationBundleVersion changes — the exact gap computeIdentityHash leaves', () => {
    const base = buildVintagePayload(CODE);
    const bumped = JSON.parse(JSON.stringify(base));
    bumped.versionConstants.calibrationBundleVersion += 1;
    bumped.archetypeContent.physics.calibrationBundleVersion += 1;
    expect(computeVintageHash(bumped)).not.toBe(computeVintageHash(base));
  });

  it('CHANGES when the model seat changes (a swap must mint a new vintage — FR-6)', () => {
    const base = buildVintagePayload(CODE);
    const swapped = JSON.parse(JSON.stringify(base));
    swapped.modelSeat.model = `${swapped.modelSeat.model}-DIFFERENT`;
    expect(computeVintageHash(swapped)).not.toBe(computeVintageHash(base));
  });

  it('is a DIFFERENT hash from the registry identityHash (separate contracts, rider 1)', () => {
    expect(computeVintageHash(buildVintagePayload(CODE))).not.toBe(computeIdentityHash());
  });

  it('distinct archetypes get distinct content addresses', () => {
    const ids = listArchetypeIds();
    const hashes = ids.map((id) => computeVintageHash(buildVintagePayload(id)));
    expect(new Set(hashes).size).toBe(ids.length);
  });

  it('docId and vintageRef are content-addressed paths', () => {
    const { hash, docId, vintageRef } = resolveVintage(CODE);
    expect(docId).toBe(vintageDocId(CODE, hash));
    expect(docId).toBe(`${CODE}_${hash}`);
    expect(vintageRef).toBe(vintageRefPath(CODE, hash));
    expect(vintageRef).toBe(`${VINTAGE_COLLECTION}/${CODE}_${hash}`);
  });
});

describe('mandateVintage — publish (§5.1: release action, publish-if-absent, immutable)', () => {
  it('creates the doc on first publish and no-ops on republish (idempotent dedup)', async () => {
    const { db, store } = makeFakeDb();
    const first = await publishVintage(db, CODE);
    expect(first.created).toBe(true);
    expect(store.has(first.vintageRef)).toBe(true);

    const stored = store.get(first.vintageRef);
    expect(stored.schemaVersion).toBe(VINTAGE_SCHEMA_VERSION);
    expect(stored.vintageHash).toBe(first.hash);
    expect(stored.codeId).toBe(CODE);
    expect(stored.publishedAt).toBeInstanceOf(Date);

    const second = await publishVintage(db, CODE);
    expect(second.created).toBe(false); // content-addressed → already present
    expect(second.vintageRef).toBe(first.vintageRef);
  });

  it('does not overwrite an existing (immutable) vintage doc', async () => {
    const { db, store } = makeFakeDb();
    const { vintageRef } = await publishVintage(db, CODE);
    const sentinel = { ...store.get(vintageRef), _sentinel: 'do-not-clobber' };
    store.set(vintageRef, sentinel);
    await publishVintage(db, CODE); // second publish must not overwrite
    expect(store.get(vintageRef)._sentinel).toBe('do-not-clobber');
  });
});
