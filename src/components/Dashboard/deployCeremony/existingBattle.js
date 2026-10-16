// src/components/Dashboard/deployCeremony/existingBattle.js
//
// Command Center repair R1 (ruling R-R1-2; spec V1.2 §5.2, the row
// "battleCreated:false with valid existingBattleId") — the owned server document
// behind an `existing_battle` result. The server answered that the agent already
// has a running battle and named it; this deploy created nothing. Its one action
// opens THAT battle: the document the server named, owned by the signed-in
// account, read from the server — never an optimistic entry, never a creation,
// never another battle that happens to be live.
//
// Two sources, in order:
//   1. the shell's own live list (the owner-scoped active poll), skipping the
//      local-origin optimistic entry, which is not a server document;
//   2. the target-scoped verifier, findActiveBattleForAgent(targetAgentId), which
//      reads the owner's active battles on the deploy target from the server.
// Either source must produce a document whose id is the server's
// existingBattleId and whose ownerId is the signed-in uid. Anything else — a
// miss, a throw, another id, another owner, no uid — is "unavailable": the
// terminal offers Retry, which reads again and never POSTs.

import { findActiveBattleForAgent } from '../../../services/agentBattleVerify';
import { signedInUid } from '../../../services/deployIdentity';

const realId = (id) => (typeof id === 'string' && id.length > 0 && id.trim() === id ? id : null);

const UNAVAILABLE = Object.freeze({ status: 'unavailable', battle: null });

/** The document is the server's existing battle and belongs to `uid`. */
export function ownsExistingBattle(battle, existingBattleId, uid) {
  const id = realId(existingBattleId);
  return Boolean(
    id && typeof uid === 'string' && uid.length > 0
      && battle && battle.id === id && battle.ownerId === uid,
  );
}

/**
 * Resolves the owned existing battle.
 * @returns {Promise<{ status: 'found', battle: object } | { status: 'unavailable', battle: null }>}
 */
export async function resolveExistingBattle({ existingBattleId, uid, liveBattles, verify }) {
  if (!realId(existingBattleId) || typeof uid !== 'string' || uid.length === 0) return UNAVAILABLE;
  const listed = (Array.isArray(liveBattles) ? liveBattles : []).find((b) => (
    b?.localOrigin !== true && b?.status === 'active' && ownsExistingBattle(b, existingBattleId, uid)
  ));
  if (listed) return { status: 'found', battle: listed };
  if (typeof verify !== 'function') return UNAVAILABLE;
  try {
    const r = await verify();
    if (r?.found === true && ownsExistingBattle(r.battle, existingBattleId, uid)) {
      return { status: 'found', battle: r.battle };
    }
  } catch (err) {
    console.warn('[Deploy] could not read the running battle:', err?.message || err);
  }
  return UNAVAILABLE;
}

/**
 * Ceremony off (R-R1-2): open the running game directly — no terminal, and no
 * "deployed" toast, because nothing was deployed. The owner is read again
 * immediately before the open. Resolves to whether it opened; never throws.
 */
export async function openExistingBattleDirectly({
  existingBattleId, targetAgentId, liveBattles, onOpen,
  verify = findActiveBattleForAgent, currentUid = signedInUid,
}) {
  const found = await resolveExistingBattle({
    existingBattleId, uid: currentUid(), liveBattles, verify: () => verify(targetAgentId),
  });
  if (found.status !== 'found' || !ownsExistingBattle(found.battle, existingBattleId, currentUid())) {
    console.warn('[Deploy] the agent already has a running battle, but it could not be opened:', existingBattleId);
    return false;
  }
  try {
    onOpen?.(found.battle);
  } catch (err) {
    console.warn('[Deploy] opening the running battle threw:', err?.message || err);
    return false;
  }
  return true;
}
