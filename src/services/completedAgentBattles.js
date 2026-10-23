// src/services/completedAgentBattles.js
//
// Command Center slice S3 (ruling R-S3-5) — the owner's most recent COMPLETED
// agent battles, ONE implementation for both readers of it:
//   - the legacy dashboards' useRecentCompletedAgentBattles(max), which keeps
//     its array return and swallows a failure exactly as before;
//   - the hub's ten-game window (useHubCompletedBattles), which surfaces a
//     failure and never turns it into an empty history.
//
// The query is the legacy hook's, unchanged: ownerId + status 'completed',
// newest completion first, `limit(max)` BEFORE the client filter, then the
// training-clone filter by agentId prefix (R5, design lock: `training-agent-`
// only — a BaggerBomb game on the casual clone is the player's real game and
// stays). The limit applies before the filter, so a window can hold fewer than
// `max` rows; spec V1.2 §6 counts "at most ten completed battle documents
// before client filtering". It throws on failure; each caller decides.

import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { TRAINING_CLONE_ID_PREFIX } from '../constants/leagueTournament';

const isTrainingClone = (battle) => typeof battle.agentId === 'string' && battle.agentId.startsWith(TRAINING_CLONE_ID_PREFIX);

/** The owner's newest `max` completed battle documents (`{ id, ...data }`), training clones dropped. Throws on a failed read. */
export async function fetchRecentCompletedAgentBattles(uid, max) {
  const q = query(
    collection(db, 'agentBattles'),
    where('ownerId', '==', uid),
    where('status', '==', 'completed'),
    orderBy('completedAt', 'desc'),
    limit(max),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((b) => !isTrainingClone(b));
}
