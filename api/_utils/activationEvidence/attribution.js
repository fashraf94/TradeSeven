// api/_utils/activationEvidence/attribution.js
//
// ID-1 Build 2 — WHOSE RECORD A POINTER IS (contract §4 attribution fields,
// §2 the ownership-check exception).
//
// The one resolver every redirect site calls, casualClone.js
// resolveAttributionAgentId: a casual-clone battle resolves to the parent the
// clone agent names, only after checking that the clone's owner also owns that
// parent; anything else is the battle's own agentId. It never guesses a parent:
// a null database, a missing clone, a missing or empty parent id, a missing
// parent, an owner mismatch, a read error or a self-reference all leave the
// clone's own id, which this module reports as `unresolved` exactly when
// isCasualCloneId(battle.agentId) and the resolver returned the clone's own id.
// Unresolved records stay out of growth joins.
//
// THE OWNERSHIP-CHECK EXCEPTION (contract §2, V1.7): for an allowlisted owner's
// casual clone, the resolver reads the parent agent the clone names, which may
// belong to another owner. Nothing from that read is recorded or returned beyond
// the resolved id: this module returns two fields, and the tenant keeps them in
// run memory only.

import { resolveAttributionAgentId } from '../casualClone.js';
import { isCasualCloneId } from '../../../src/constants/leagueTournament.js';

/**
 * @param {object|null} db Admin Firestore (null degrades to unresolved for a clone)
 * @param {object} battle the battle document's data (`agentId` read)
 * @returns {Promise<{ attributionAgentId: string|null, attributionStatus: 'resolved'|'unresolved' }>}
 */
export async function attributionOf(db, battle) {
  const own = battle?.agentId ?? null;
  const resolved = await resolveAttributionAgentId(db, { agentId: own });
  const attributionAgentId = typeof resolved === 'string' ? resolved : own;
  return {
    attributionAgentId,
    attributionStatus: isCasualCloneId(own) && attributionAgentId === own ? 'unresolved' : 'resolved',
  };
}
