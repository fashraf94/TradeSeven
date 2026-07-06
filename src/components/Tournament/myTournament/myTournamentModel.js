// src/components/Tournament/myTournament/myTournamentModel.js
//
// "My Tournament" — pure view-model selectors (no Firestore, no React), kept
// out of the screen so the state machine + derivations are unit-tested directly.

import {
  GROUP_STATUS,
  GROUP_SIZE,
  getWeeklyComposite,
  rankByScores,
} from '../../../constants/leagueTournament';

/**
 * The three sequential page states, derived from the RANKED group lifecycle.
 * subscribeMyGroup only ever yields FORMING or BATTLE (training excluded), and
 * the ranked draft flips FORMING→BATTLE in ONE shot (it never writes a
 * persisted `drafting` status — that beat is only the brief window before the
 * battle doc materializes). So:
 *   awaiting  — no group yet (pre-formation lobby) OR the group is FORMING
 *   drafting  — the group is BATTLE but the battle isn't live yet (the
 *               single-shot resolution beat: "drafting your lineup…")
 *   bracket   — the group is BATTLE and the battle exists (the launchpad)
 *
 * @param {{ group?: Object|null, battle?: Object|null }} input
 * @returns {'awaiting'|'drafting'|'bracket'}
 */
export function deriveMyTournamentState({ group, battle } = {}) {
  if (!group || group.status === GROUP_STATUS.FORMING) return 'awaiting';
  if (group.status === GROUP_STATUS.BATTLE) return battle ? 'bracket' : 'drafting';
  // COMPLETE / anything else (selectMyGroup shouldn't surface these) → nothing
  // live to launch → awaiting.
  return 'awaiting';
}

/**
 * The viewer's 1-based rank within their pod, by weekly composite (desc).
 * Reuses rankByScores — the one ranking rule — over the group's members.
 *
 * @returns {number|null} 1-based rank, or null if the group/uid can't rank yet.
 */
export function rankInPod(group, uid) {
  const members = group?.groupMembers || [];
  if (!uid || !members.includes(uid)) return null;
  const scores = {};
  for (const id of members) scores[id] = getWeeklyComposite(group, id);
  const idx = rankByScores(scores, members).indexOf(uid);
  return idx < 0 ? null : idx + 1;
}

/**
 * Seat fill for the awaiting state's pip grid, at the REAL pod scale
 * (GROUP_SIZE = 4). Pre-formation the source is the lobby (real open seats);
 * once a group forms, the 4 seats are the players split by isCpu (open = 0 —
 * empty seats are CPU-padded at the Monday lock). `human` includes the viewer.
 *
 * @returns {{ human: number, cpu: number, open: number, total: number }}
 */
export function seatPips({ group, lobby } = {}) {
  const total = GROUP_SIZE;
  if (group && Array.isArray(group.players) && group.players.length) {
    const seated = group.players.slice(0, total);
    const cpu = seated.filter((p) => p && p.isCpu === true).length;
    return { human: seated.length - cpu, cpu, open: Math.max(0, total - seated.length), total };
  }
  const members = (lobby && Array.isArray(lobby.members)) ? lobby.members.length : 0;
  const human = Math.min(total, members);
  return { human, cpu: 0, open: Math.max(0, total - human), total };
}
