// api/_utils/mandateVintage.js
//
// Spec 1 — Mandate Substrate — the VINTAGE STORE + publish step (§5.1, F8/F22/F36).
// A vintage is a content-addressed, immutable behavioral contract: it binds an
// archetype's behavior to a book for a full quarter so a mid-quarter registry,
// model, or gate change CANNOT reach an active book (D-44 / FR-6). Books pin a
// `vintageRef`; §3.2 (P2) assembles prompts FROM the pinned doc, never from a
// live registry read.
//
// READ SURFACE (O-12): archetype content is read through archetypeRegistry.js —
// the sanctioned class-definition surface — never by a direct import of a legacy
// archetype table, so this module adds NO entry to
// archetypeImportBoundaryBaseline.json (the §2.3 ratchet's scanDirectImporters
// would flag a registry-only consumer as a *removal*; see the Phase 1 PR).
//
// HASH (§13/Q2, founder-ruled Option A): computed with canonicalContentHash over
// the COMPLETE payload — NOT computeIdentityHash, which asymmetrically strips
// calibrationBundleVersion (archetypeRegistry.js:198) and never covered the model
// seat or gate config. calibrationBundleVersion is present here twice by
// construction: inside archetypeContent.physics AND in versionConstants.
//
// RELATION TO THE REGISTRY SNAPSHOT CATALOG (docs/registry-snapshots/, founder
// rider 1): deliberately SEPARATE mechanisms with distinct jobs. Registry
// snapshots are registry-side release/audit artifacts keyed by the *incomplete*
// identityHash. The vintage is the mandate-side *complete* behavioral contract
// keyed by canonicalContentHash over the full payload (archetype content + model
// seat + gate config + all version constants). Not duplication — different
// contracts. archetypeIdentityVersion is recorded in the payload (rider 2) so the
// two can always be joined in audit.

import {
  getArchetypeDefinition,
  getRegistryCorpus,
  listArchetypeIds,
  ARCHETYPE_IDENTITY_VERSION,
} from './archetypeRegistry.js';
import { canonicalContentHash } from './canonicalHash.js';
import { getModelSeat, getCadenceTier } from './mandateGenerationConfig.js';
import {
  MANDATE_CASH_FLOOR_PCT,
  MANDATE_MIN_POSITIONS,
  MANDATE_MAX_POSITIONS,
  MANDATE_MAX_SINGLE_POSITION_WEIGHT_PCT,
  MANDATE_DECISION_VERBS,
} from './mandateConfig.js';

export const VINTAGE_SCHEMA_VERSION = 1;
export const VINTAGE_COLLECTION = 'archetypeVintages';

/**
 * The complete, hashable vintage payload for one archetype at the current
 * release. Pure (no Firestore). Throws (fail-closed) on an unknown archetype or
 * a composition that does not resolve against the current
 * ARCHETYPE_IDENTITY_VERSION.
 *
 * RIDER 2 (founder ruling): assert the frozen composition resolves against the
 * current ARCHETYPE_IDENTITY_VERSION and record that version in the payload.
 */
export function buildVintagePayload(codeId) {
  if (!listArchetypeIds().includes(codeId)) {
    throw new Error(`buildVintagePayload: unknown archetype '${codeId}'`);
  }
  // Live composition (no identityVersion arg → current live version; the
  // version-parameterized resolver's default path, byte-identical to pre-PR-4).
  const def = getArchetypeDefinition(codeId);
  if (!def) {
    throw new Error(`buildVintagePayload: registry returned null for '${codeId}'`);
  }
  // RIDER 2 assertion — the composition being frozen MUST be the current live
  // version, else the vintage would silently pin a stale/candidate composition.
  if (def.identityVersion !== ARCHETYPE_IDENTITY_VERSION) {
    throw new Error(
      `buildVintagePayload: composition for '${codeId}' resolved to identityVersion `
      + `${def.identityVersion}, expected current ARCHETYPE_IDENTITY_VERSION ${ARCHETYPE_IDENTITY_VERSION}`,
    );
  }

  const corpus = getRegistryCorpus();
  const modelSeat = getModelSeat(codeId);
  const cadenceTier = getCadenceTier(codeId);
  if (!modelSeat || !cadenceTier) {
    throw new Error(`buildVintagePayload: missing model seat / cadence tier for '${codeId}'`);
  }

  // Gate configuration (D-44 / FR-6 + O-5 / §3.4). Universal spec constants +
  // the per-archetype sector cap read from the registry (physics), frozen so the
  // P2 mandateSectorCap reads cap VALUES from the pin.
  const sectorConcentrationCap = def.physics?.sectorConcentrationCap ?? null;
  const gateConfig = {
    cashFloorPct: MANDATE_CASH_FLOOR_PCT,
    minPositions: MANDATE_MIN_POSITIONS,
    maxPositions: MANDATE_MAX_POSITIONS,
    maxSinglePositionWeightPct: MANDATE_MAX_SINGLE_POSITION_WEIGHT_PCT,
    decisionVerbs: [...MANDATE_DECISION_VERBS],
    sectorConcentrationCap,
  };

  // All contributing archetype-behavior version constants (§5.1 / Q2). Platform
  // machinery (prompt-template, friction model, snapshot/calendar) is stamped on
  // receipts per §5.1, NOT pinned here.
  const versionConstants = {
    archetypeIdentityVersion: ARCHETYPE_IDENTITY_VERSION, // rider 2 — the audit join key
    calibrationBundleVersion: def.physics?.calibrationBundleVersion ?? null, // the one computeIdentityHash drops
    knobConfigVersion: def.physics?.knobConfigVersion ?? null,
    ruleLibraryVersion: corpus?.ruleLibraryVersion ?? null,
  };

  return {
    payloadSchemaVersion: VINTAGE_SCHEMA_VERSION,
    codeId,
    displayVintage: `${def.displayName ?? codeId} v${ARCHETYPE_IDENTITY_VERSION}`,
    archetypeContent: def, // full per-archetype behavior content (identity/physics/zones/scoring/compat/display)
    versionConstants,
    modelSeat, // FR-6 / D-44
    gateConfig, // FR-6 / D-44 + O-5
    cadenceTier, // D-19
  };
}

/** The content address: sha256 of the canonical form of the complete payload. */
export function computeVintageHash(payload) {
  return canonicalContentHash(payload);
}

/** The content-addressed doc id: `${codeId}_${hash}`. */
export function vintageDocId(codeId, hash) {
  return `${codeId}_${hash}`;
}

/** The stored `vintageRef` string a book pins: `archetypeVintages/{codeId}_{hash}`. */
export function vintageRefPath(codeId, hash) {
  return `${VINTAGE_COLLECTION}/${vintageDocId(codeId, hash)}`;
}

/**
 * Resolve (compute, do not write) the current vintage identity for an archetype.
 * Returns { payload, hash, docId, vintageRef }. Pure except for the registry
 * reads it performs.
 */
export function resolveVintage(codeId) {
  const payload = buildVintagePayload(codeId);
  const hash = computeVintageHash(payload);
  const docId = vintageDocId(codeId, hash);
  return { payload, hash, docId, vintageRef: vintageRefPath(codeId, hash) };
}

/**
 * Publish the current vintage for an archetype IF ABSENT (§5.1 — creation is a
 * release action; rollover consumes a PUBLISHED vintage, never a live mixed
 * read). Content-addressed, so republishing identical content is a no-op. The
 * write is immutable (create-if-absent inside a transaction — an existing doc is
 * never overwritten).
 *
 * @returns {Promise<{ vintageRef, docId, hash, created: boolean }>}
 */
export async function publishVintage(db, codeId) {
  const { payload, hash, docId, vintageRef } = resolveVintage(codeId);
  const ref = db.collection(VINTAGE_COLLECTION).doc(docId);

  const created = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) return false;
    tx.set(ref, {
      schemaVersion: VINTAGE_SCHEMA_VERSION,
      vintageHash: hash,
      vintageDocId: docId,
      codeId,
      ...payload,
      publishedAt: new Date(),
    });
    return true;
  });

  return { vintageRef, docId, hash, created };
}

/**
 * Publish every archetype's current vintage (the build-step release action;
 * DEF-3's storage primitive). Returns one result per archetype.
 */
export async function publishAllVintages(db) {
  const out = [];
  for (const codeId of listArchetypeIds()) {
    out.push({ codeId, ...(await publishVintage(db, codeId)) });
  }
  return out;
}
