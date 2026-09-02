// src/services/agentBattleVerify.js
//
// Deploy Ceremony · PR 2 — the existence check behind terminal-state honesty.
//
// THE PRINCIPLE: the client may not make a claim about server state it has not
// verified. Before this module the ceremony asserted "no battle was created"
// from the shape of a failure alone, and in the founding incident it was wrong:
// `decide.js:929` (`await agentRef.update({ activeBattleId })`) is the only
// statement that can throw between the battle commit at `:910` and the 200 at
// `:963`, so a rejection there leaves a DURABLE battle behind a 500.
//
// Neither cheap signal is evidence:
//   - `errorPhase: 'post_decision'` only means the decision persisted at
//     `decide.js:704`, which PRECEDES battle creation at `:910`.
//   - `deployProgress.stage: 'complete'` is written at `decide.js:690`, also
//     before `:910`, and the 503/409 gates at `:841-853` / `:905-908` return
//     without throwing after it.
// A direct re-read of `agentBattles` is the only sound signal.
//
// The query mirrors the server's own write at `agentBattleService.js:130-132`
// (`agentId` / `ownerId` / `status`) and the `agentBattles` read rule
// (`firestore.rules`: `resource.data.ownerId == request.auth.uid`), which is why
// `ownerId` is a query key and not a post-filter.
//
// Keyed on the DEPLOY TARGET's id, never the ranked `agent.id`: the battle's
// `agentId` is `agentData.id` — the document decide.js was POSTed — which is the
// CLONE on the casual-clone path. Keyed on the ranked id this returns empty every
// time and would report "no battle" with total confidence, in exactly the case
// this check exists to prevent.
//
// Deliberately NOT `useAgentBattleId`: that hook reads `auth.currentUser` inside
// an effect keyed only on `agentId`, so it never re-runs when auth resolves late.
// Fixing it belongs to the codebase-wide audit, not here.

import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase/config';

const BATTLES_COLLECTION = 'agentBattles';

/**
 * One direct read for an active battle owned by the caller on `targetAgentId`.
 *
 * Resolves `{ found, battle }` — `battle` is the full doc plus its id, so the
 * caller can route straight into the Battle View without a second read (and
 * WITHOUT `agent.activeBattleId`, which in the `:929` scenario is guaranteed
 * absent: that write is the statement that threw).
 *
 * THROWS on anything that prevents the check from completing — no target, no
 * resolved auth, a permission error, a transport failure. A caller must treat a
 * throw as "we do not know", never as "nothing happened": returning a falsy
 * `found` for an unreadable query would let a failed check author a stronger
 * claim than the one it replaced.
 */
export async function findActiveBattleForAgent(targetAgentId) {
  if (!targetAgentId) throw new Error('agentBattleVerify: no deploy target id');
  const uid = auth?.currentUser?.uid;
  // Not a "no battle" answer: without a uid the query is not even expressible
  // under the read rule, so nothing was learned.
  if (!uid) throw new Error('agentBattleVerify: no authenticated user');

  const q = query(
    collection(db, BATTLES_COLLECTION),
    where('agentId', '==', targetAgentId),
    where('ownerId', '==', uid),
    where('status', '==', 'active'),
    limit(1),
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return { found: false, battle: null };
  const docSnap = snapshot.docs[0];
  return { found: true, battle: { id: docSnap.id, ...docSnap.data() } };
}

export default findActiveBattleForAgent;
