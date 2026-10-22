// src/services/carryingBattleRead.js
//
// Pilot P1c — founder ruling E2: the review card's carrying battles are links
// to each battle's review (the Film Room), which App opens from the battle
// document. The card reads that document once, on the tap, through the
// client SDK — the owner's own battle, owner-readable under the agentBattles
// rule (the Forge reads battles this way already: ForgeLanding.jsx).

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

/** The battle document with its id, or null when it does not exist. Throws what the read throws. */
export async function readCarryingBattle(battleId) {
  if (typeof battleId !== 'string' || battleId.length === 0) return null;
  const snap = await getDoc(doc(db, 'agentBattles', battleId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
