// src/services/compositionIdentityClient.js
//
// Composition PR 4 — the CLIENT half of the A24 authority switch. The client
// birth path (AgentCreationFlow → seedDefaultTraits) seeds default traits via
// the client SDK, so it must learn which identity version the ACTIVATION
// RECORD selects the same way every server boundary does: by reading the one
// record (A48 — the record is the only selector; no flag, no config value).
//
// FAIL-SAFE BY CONSTRUCTION (A24): every failure path — record absent (the
// pre-activation world), rules denying the read (the clause ships inert until
// the B9-gated rules deploy), network error, malformed doc — resolves to the
// LIVE identity, i.e. exactly today's births. The candidate is reachable ONLY
// through a well-formed record naming it.
//
// Version resolution on the client is deliberately narrow: the deployed
// bundle can seed exactly two identities — the LIVE one and the CANDIDATE it
// ships (live+1). A record naming anything else (a rollback names the prior
// LIVE version, which resolves live here) falls back to live; the server
// boundaries carry the full catalog + fail-closed semantics.
//
// COST DISCLOSURE (§2 pass-2 L1-1): unlike the server seams (whose dark
// posture is zero I/O behind the fence flag), this seam reads the record on
// EVERY birth by design — the record is the only selector (A48) and the
// client has no flag to consult. Between merge and the B9-gated rules deploy
// the read is rejected by rules (resolving LIVE, so WRITES stay
// byte-identical), i.e. one denied round trip per agent creation for that
// window. The read is TIME-BOXED below so a degraded connection can never
// block the birth flow — timeout = failure = LIVE, the same A24 fail-safe.

import { ARCHETYPE_DEFAULT_TRAITS, TRAIT_BY_ID } from '../data/traitLibrary';
import {
  CANDIDATE_ARCHETYPE_DEFAULT_TRAITS, getCandidateTraitById,
} from '../data/traitLibraryCandidate';
import { ARCHETYPE_IDENTITY_VERSION } from '../../api/_utils/archetypeVersionConstants.js';

export const CANDIDATE_IDENTITY_VERSION = ARCHETYPE_IDENTITY_VERSION + 1;

// The record read is time-boxed: past this, the birth proceeds LIVE. Bounds
// the seam's latency contribution — the pre-PR birth path did zero network
// I/O before buildSeedPlan, so the added read must never block unboundedly.
export const RECORD_READ_TIMEOUT_MS = 1_500;

/**
 * Read the activation record's selected identity version. Null on ANY
 * failure, absence, or timeout — the live-identity path.
 */
export async function fetchActiveIdentityVersion() {
  let timer;
  try {
    // Lazy imports: the firebase client init only loads on the LIVE read
    // path — the pure resolver below stays importable in any environment
    // (and a failed init resolves LIVE like every other failure).
    const [{ doc, getDoc }, { db }] = await Promise.all([
      import('firebase/firestore'),
      import('../firebase/config'),
    ]);
    const snap = await Promise.race([
      getDoc(doc(db, 'composition', 'activation')),
      new Promise((res) => { timer = setTimeout(() => res(null), RECORD_READ_TIMEOUT_MS); }),
    ]);
    if (!snap || !snap.exists()) return null; // timeout races count as failures → LIVE
    const v = snap.data()?.activeIdentityVersion;
    return Number.isInteger(v) && v >= 1 ? v : null;
  } catch {
    return null; // denied/offline/malformed → the live identity (fail-safe)
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * The seed source for a birth at `identityVersion` (null = live). Returns
 * { traitIds, traitOf } for buildSeedPlan.
 */
export function resolveClientSeedSource(archetype, identityVersion) {
  if (identityVersion === CANDIDATE_IDENTITY_VERSION) {
    return {
      traitIds: CANDIDATE_ARCHETYPE_DEFAULT_TRAITS[archetype],
      traitOf: getCandidateTraitById,
    };
  }
  return { traitIds: ARCHETYPE_DEFAULT_TRAITS[archetype], traitOf: (id) => TRAIT_BY_ID[id] };
}
