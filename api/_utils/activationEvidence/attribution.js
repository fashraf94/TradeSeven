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
// THE PREPARATION BUDGET (review V4 on nit-2): the resolver makes two sequential
// reads (the clone, then the parent), so each is admitted on its own: the
// handle given to the resolver refuses a read once `mayRead()` says the budget is
// spent. A refused read is the observer's own deferral, never the resolver's
// verdict, so the result is `deferred` and nothing is written for the battle in
// this run; it is never recorded as `unresolved`.
//
// THE OWNERSHIP-CHECK EXCEPTION (contract §2, V1.7): for an allowlisted owner's
// casual clone, the resolver reads the parent agent the clone names, which may
// belong to another owner. Nothing from that read is recorded or returned beyond
// the resolved id: this module returns the two fields (and the deferral flag),
// and the tenant keeps them in run memory only.

import { resolveAttributionAgentId } from '../casualClone.js';
import { isCasualCloneId } from '../../../src/constants/leagueTournament.js';

class PreparationBudgetSpent extends Error {}

/** A read-only handle for the resolver: `collection(name).doc(id).get()`, each read admitted by `mayRead`. */
function budgetedHandle(db, { mayRead, beforeRead, onRefused }) {
  return {
    collection: (name) => ({
      doc: (id) => ({
        get: async () => {
          if (!mayRead()) { onRefused(); throw new PreparationBudgetSpent('preparation budget spent'); }
          await beforeRead();
          return db.collection(name).doc(id).get();
        },
      }),
    }),
  };
}

/**
 * @param {object|null} db Admin Firestore (null degrades to unresolved for a clone)
 * @param {object} battle the battle document's data (`agentId` read)
 * @param {{ mayRead?: () => boolean, beforeRead?: () => any }} [budget] the tenant's preparation budget and its test seam
 * @returns {Promise<{ attributionAgentId: string|null, attributionStatus: 'resolved'|'unresolved', deferred: boolean }>}
 */
export async function attributionOf(db, battle, { mayRead = () => true, beforeRead = async () => {} } = {}) {
  const own = battle?.agentId ?? null;
  let refused = false;
  const handle = db ? budgetedHandle(db, { mayRead, beforeRead, onRefused: () => { refused = true; } }) : null;
  const resolved = await resolveAttributionAgentId(handle, { agentId: own });
  if (refused) return { attributionAgentId: null, attributionStatus: null, deferred: true };
  const attributionAgentId = typeof resolved === 'string' ? resolved : own;
  return {
    attributionAgentId,
    attributionStatus: isCasualCloneId(own) && attributionAgentId === own ? 'unresolved' : 'resolved',
    deferred: false,
  };
}
