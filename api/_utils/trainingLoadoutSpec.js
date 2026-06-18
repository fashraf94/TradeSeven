// api/_utils/trainingLoadoutSpec.js
//
// League Training Slice 5b-ii — the loadout-chooser spec WHITELIST (the security
// boundary). A training pod is built on a clone of the player's ranked agent
// (pure inherit by default, Slice 3); 5b-ii lets the player override a SUBSET of
// the loadout for the no-stakes practice agent. This module is the server-side
// gate on what a client may override.
//
// SCOPE = Tier 1 (founder ruling): ONLY `archetype` + `equippedWatchlistId`.
// Everything else is rejected — including identity/cosmetic fields, the inert
// `config`, and (deliberately) `equippedTraits`/`equippedBundleIds`. The traits/
// bundles deferral is not cosmetic: the clone copies the RANKED agent's rules/
// bundles SUBCOLLECTIONS (trainingClone.js:118-126,167-168), so overriding those
// pointers without redirecting the copy would yield an inconsistent clone. This
// whitelist is what enforces that deferral.
//
// `equippedWatchlistName` is NOT a client-supplied key — the endpoint re-derives
// it from the validated watchlist doc (never trust a client name). The watchlist
// OWNERSHIP check (does this id belong to the caller, is it committed) is async
// and lives in the endpoint (it needs db + user); THIS module is the pure,
// synchronous shape gate, unit-tested in isolation.
//
// VALID_ARCHETYPES is imported from agentArchetypeConfig.js — a §1 fenced module.
// Reading/calling a fenced export is PERMITTED (only editing is forbidden), and
// importing the canonical set avoids a divergent local copy (BUILD_RULES §4).

import { VALID_ARCHETYPES } from './agentArchetypeConfig.js';

// The only keys a client may send in a loadout spec (Tier 1).
export const LOADOUT_SPEC_ALLOWED_KEYS = Object.freeze(['archetype', 'equippedWatchlistId']);

/**
 * Validate the SHAPE of a client loadout spec (pure, synchronous).
 *
 * Contract:
 *   - undefined / null            → { valid: true, value: null }  (no override → pure inherit; the fast-start path)
 *   - non-object / array          → { valid: false, reason }
 *   - any key outside the Tier-1 whitelist → { valid: false, reason }
 *   - `archetype` is REQUIRED and must be ∈ VALID_ARCHETYPES
 *   - `equippedWatchlistId` is OPTIONAL: null/absent = "no watchlist" (valid);
 *     a present value must be a non-empty string (ownership is checked async in
 *     the endpoint, not here)
 *
 * On success returns the normalized value `{ archetype, equippedWatchlistId: <id|null> }`
 * (the watchlist NAME is added by the endpoint after the ownership read).
 */
export function validateLoadoutSpecShape(raw) {
  if (raw === undefined || raw === null) return { valid: true, value: null };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, reason: 'not_an_object' };
  }

  for (const key of Object.keys(raw)) {
    if (!LOADOUT_SPEC_ALLOWED_KEYS.includes(key)) {
      return { valid: false, reason: `unknown_field:${key}` };
    }
  }

  if (!VALID_ARCHETYPES.includes(raw.archetype)) {
    return { valid: false, reason: 'bad_archetype' };
  }

  const wlId = raw.equippedWatchlistId;
  if (wlId !== undefined && wlId !== null && (typeof wlId !== 'string' || wlId.trim() === '')) {
    return { valid: false, reason: 'bad_watchlist_id' };
  }

  return {
    valid: true,
    value: {
      archetype: raw.archetype,
      equippedWatchlistId: (typeof wlId === 'string' && wlId.trim()) ? wlId.trim() : null,
    },
  };
}
