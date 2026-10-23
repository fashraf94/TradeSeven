// src/services/ownedBattleRead.js
//
// Command Center slice S2b (ruling R-S2b-5; spec V1.2 §6, "Existing-battle
// hydration") — the ONE owned, targeted read of the battle the server named in
// an `existing_battle` answer. The deploy provider
// (src/contexts/DeployAttemptContext.jsx) makes it once per attempt, deduplicated
// by uid + auth epoch + attempt id + battle id, inside its own deadline; a
// failure stays on the existing terminal with an explicit Retry.
//
// It reads the document BY ID, so it resolves what the target-scoped verifier
// cannot (R1 review L3-1, L3-3, L3-10): a league battle the clone-fallback path
// named, and a battle in a voided group. Read from the server, as the verifier
// reads (services/agentBattleVerify.js says why a cache-served answer proves
// nothing). The agentBattles read rule admits only the owner, and the owner is
// checked here again: a document that is not `uid`'s is no answer.

import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from '../firebase/config';

const realId = (id) => (typeof id === 'string' && id.length > 0 && id.trim() === id ? id : null);

/**
 * The owned battle document with its id, or null when it does not exist or is not `uid`'s. Throws what the read
 * throws (a refused or failed read is not an absence).
 */
export async function readOwnedBattle(battleId, uid) {
  const id = realId(battleId);
  if (!id || typeof uid !== 'string' || uid.length === 0) return null;
  const snap = await getDocFromServer(doc(db, 'agentBattles', id));
  if (!snap.exists()) return null;
  const battle = { id: snap.id, ...snap.data() };
  return battle.ownerId === uid ? battle : null;
}
