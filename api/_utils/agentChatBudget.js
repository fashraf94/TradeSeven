// api/_utils/agentChatBudget.js
//
// The League arena "Ask your agent" per-day question budget — server-authoritative
// (client displays only). A counter per (groupId, uid, game-day) in its OWN
// top-level collection `agentChatBudget/{groupId}_{uid}_{dayN}` -> { count }.
//
// WHY ITS OWN COLLECTION (BUILD_RULES §1 fence-as-concept): the per-day counter is
// NEVER a field on the agentBattle doc. A new battle-doc key would touch the fenced
// createAgentBattle shape (in-code founder ruling P8, api/agent/chat.js). Keeping the
// counter here means the read-check-increment can never contend with — nor mutate —
// the battle doc. The existing per-battle chatBudgetUsed budget is a separate,
// unrelated mechanism; the League arena ask BYPASSES it and uses this instead.
//
// THE DAILY RESET IS IMPLICIT IN THE KEY — no cron, no reset job. `dayN` is the
// game's trading day from deriveCurrentTradingDay(group, etDate) (the SAME index the
// daily close writes and the claim system uses; ET-date-based under the hood). A new
// game-day => a new dayN => a new key => count 0 => a fresh 10. resolveBudgetDay is
// the ONE place that reads the group doc + derives dayN (shared by the POST charge and
// the GET counter so they never drift on the key); the read/charge primitives take dayN
// in and do no group read (the tournamentBanking compute/IO split precedent).
//
// TWO ENTRY POINTS, deliberately separate (the spec's control flow):
//   - readAgentChatBudget:   a plain read for the EARLY exhausted gate (before the
//                            agent call) and the on-open counter fetch. No charge.
//   - chargeAgentChatBudget: a transactional read-check-increment run ONLY AFTER a
//                            successfully parsed answer. The transaction's fresh
//                            in-tx read is the double-spend guard (two concurrent
//                            successful asks can never push the count past the cap).

import { toIso, formatEtDate } from './tournamentTime.js';
import { TOURNAMENT_GAME_MODE, TOURNAMENT_GROUPS_COLLECTION, deriveCurrentTradingDay } from '../../src/constants/leagueTournament.js';

export const AGENT_CHAT_BUDGET_COLLECTION = 'agentChatBudget';

// 10 questions per game-day, hard reset each day, no rollover (founder decision).
export const AGENT_CHAT_DAILY_LIMIT = 10;

/** The counter doc id: a flat composite key so it never contends with the group/
 * battle transactional writers. `${groupId}_${uid}_${dayN}`. */
export function agentChatBudgetDocId(groupId, uid, dayN) {
  return `${groupId}_${uid}_${dayN}`;
}

function budgetRef(db, groupId, uid, dayN) {
  return db.collection(AGENT_CHAT_BUDGET_COLLECTION).doc(agentChatBudgetDocId(groupId, uid, dayN));
}

/**
 * Resolve the budget key coordinates for a battle: read the group doc and derive the
 * game-day dayN (deriveCurrentTradingDay — the SAME index the daily close writes;
 * ET-date-based). Returns { groupId, dayN } for a keyable League tournament battle, or
 * null when the battle is not keyable (non-tournament / no groupId) OR the group/day is
 * unavailable (missing group, read failure). A null is the caller's FAIL-OPEN signal
 * (answer for free, no charge; never a placeholder dayN that would cross-day-collide).
 *
 * ONE home for "what game-day is this battle on" so the POST charge and the GET counter
 * can never drift on the key. This is the module's only group-doc read.
 */
export async function resolveBudgetDay(db, battle) {
  if (!battle || battle.gameMode !== TOURNAMENT_GAME_MODE || !battle.groupId) return null;
  try {
    const snap = await db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(battle.groupId).get();
    const group = snap.exists ? snap.data() : null;
    const dayN = group ? deriveCurrentTradingDay(group, formatEtDate(new Date())) : null;
    if (!group || !Number.isFinite(dayN)) return null;
    return { groupId: battle.groupId, dayN };
  } catch (err) {
    // Never block the turn on a group read — fail open (the caller answers free).
    console.warn('[agentChatBudget] group read failed — budget unkeyable (fail-open):', err?.message);
    return null;
  }
}

/** clamp a stored count to a sane non-negative integer (a poisoned value degrades
 * to 0 spent rather than locking the user out or over-serving). */
function normalizeCount(raw) {
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}

/**
 * Plain read of the day's count → { count, remaining }. A missing doc (the common
 * first-ask-of-the-day case) reads as 0 spent / full remaining. Used by the early
 * exhausted gate and the on-open GET; never charges.
 */
export async function readAgentChatBudget(db, { groupId, uid, dayN, limit = AGENT_CHAT_DAILY_LIMIT }) {
  const snap = await budgetRef(db, groupId, uid, dayN).get();
  const count = snap.exists ? normalizeCount(snap.data()?.count) : 0;
  return { count, remaining: Math.max(0, limit - count) };
}

/**
 * Transactional read-check-increment — the CHARGE, run only after a successful
 * answer. Re-reads the count inside the transaction (the double-spend guard) and
 * writes an explicit count+1 (NOT FieldValue.increment, so the in-tx cap check is
 * authoritative and the count can never blow past the limit under a race). Returns
 * the authoritative remaining.
 *
 * At/over the cap it does NOT increment (soft-cap: a rare concurrent over-serve
 * still never over-charges) and reports remaining 0.
 *
 * @returns {{ charged: boolean, remaining: number, count: number }}
 */
export async function chargeAgentChatBudget(db, { groupId, uid, dayN, now = new Date(), limit = AGENT_CHAT_DAILY_LIMIT }) {
  const ref = budgetRef(db, groupId, uid, dayN);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? normalizeCount(snap.data()?.count) : 0;
    if (count >= limit) {
      return { charged: false, remaining: 0, count };
    }
    const next = count + 1;
    tx.set(ref, {
      groupId,
      uid,
      dayN,
      count: next,
      updatedAt: toIso(now),
    }, { merge: true });
    return { charged: true, remaining: Math.max(0, limit - next), count: next };
  });
}
