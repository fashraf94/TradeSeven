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
// clone's own id. This module reports `unresolved` exactly when
// isCasualCloneId(battle.agentId) and the resolver returned the clone's own id
// AS A VERDICT; unresolved records stay out of growth joins.
//
// THE PREPARATION BUDGET (review V4 on nit-2): the resolver makes two sequential
// reads (the clone, then the parent), so each is admitted on its own: the
// handle given to the resolver refuses a read once `mayRead()` says the budget is
// spent. A refused read is the observer's own deferral, never the resolver's
// verdict, so the result is `deferred` (reason `prep_cut`) and nothing is written
// for the battle in this run; it is never recorded as `unresolved`.
//
// A READ THAT FAILS IS NOT A VERDICT (contract V1.8 §4, §4.2; ruling Q3): the
// resolver swallows a read error and returns the clone's own id, exactly as it
// does for a real verdict, so the handle records any throw from a read it
// admitted. Such a run is `deferred` (reason `attribution_read_error`), exactly
// as a budget refusal is: no pointer of the battle is written in this run, and
// a later run retries. casualClone.js is unchanged.
//
// THE OWNERSHIP-CHECK EXCEPTION (contract §2, V1.7): for an allowlisted owner's
// casual clone, the resolver reads the parent agent the clone names, which may
// belong to another owner. Nothing from that read is recorded or returned beyond
// the resolved id: this module returns the two fields (and the deferral flag),
// and the tenant keeps them in run memory only.

import { resolveAttributionAgentId } from '../casualClone.js';
import { isCasualCloneId } from '../../../src/constants/leagueTournament.js';

class PreparationBudgetSpent extends Error {}

/**
 * A read-only handle for the resolver: `collection(name).doc(id).get()`, each read admitted by `mayRead`.
 * A refusal is reported by `onRefused`; any throw from an admitted read (an error, not a verdict) by `onThrew`.
 */
function budgetedHandle(db, { mayRead, beforeRead, onRefused, onThrew }) {
  return {
    collection: (name) => ({
      doc: (id) => ({
        get: async () => {
          if (!mayRead()) { onRefused(); throw new PreparationBudgetSpent('preparation budget spent'); }
          try {
            await beforeRead();
            return await db.collection(name).doc(id).get();
          } catch (err) {
            onThrew();
            throw err;
          }
        },
      }),
    }),
  };
}

/**
 * @param {object|null} db Admin Firestore (null degrades to unresolved for a clone)
 * @param {object} battle the battle document's data (`agentId` read)
 * @param {{ mayRead?: () => boolean, beforeRead?: () => any }} [budget] the tenant's preparation budget and its test seam
 * @returns {Promise<{ attributionAgentId: string, attributionStatus: 'resolved'|'unresolved', deferred: false }
 *   | { attributionAgentId: null, attributionStatus: null, deferred: true, reason: 'prep_cut'|'attribution_read_error' }>}
 */
export async function attributionOf(db, battle, { mayRead = () => true, beforeRead = async () => {} } = {}) {
  const own = battle?.agentId ?? null;
  let refused = false;
  let threw = false;
  const handle = db ? budgetedHandle(db, { mayRead, beforeRead, onRefused: () => { refused = true; }, onThrew: () => { threw = true; } }) : null;
  const resolved = await resolveAttributionAgentId(handle, { agentId: own });
  if (refused) return { attributionAgentId: null, attributionStatus: null, deferred: true, reason: 'prep_cut' };
  if (threw) return { attributionAgentId: null, attributionStatus: null, deferred: true, reason: 'attribution_read_error' };
  const attributionAgentId = typeof resolved === 'string' ? resolved : own;
  return {
    attributionAgentId,
    attributionStatus: isCasualCloneId(own) && attributionAgentId === own ? 'unresolved' : 'resolved',
    deferred: false,
  };
}
