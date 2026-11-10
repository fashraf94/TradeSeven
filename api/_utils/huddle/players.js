// api/_utils/huddle/players.js
//
// Huddle S1 — WHO GETS A HUDDLE (spec V1.1 §5.4): owners with an active battle now, or a
// battle completed in the last 5 sessions, or an agent deployed within 5 sessions; CPU
// owners excluded. Three single-field queries (Q-P1–Q-P3 in huddle-s1-queries.md; no
// composite): `agentBattles.status == 'active'`, `agentBattles.completedAt >= from`
// (the closePass completedBetween shape, closePass.js:95-100), `agents.lastDeployedAt >=
// from` (an ISO string, decide.js:723). The count is recorded on the run marker.
//
// THE COHORT (Amendment E §E7): only players in `HUDDLE_PLAYER_UIDS` are enqueued — the active players INTERSECTED with
// the cohort. Unset or blank is no one (gate.js huddleCohortOf), replacing S1's optional scope where unset meant everyone.

import { getPreviousSessionDate, getSessionForDate } from '../marketSchedule.js';
import { isCpuUserId } from '../../../src/constants/leagueTournament.js';
import { huddleCohortOf } from './gate.js';

export const RECENT_SESSIONS = 5;

/** The ISO instant of the open of the session `n` sessions before `etDate` (or null). */
export function recentWindowStartIso(etDate, n = RECENT_SESSIONS) {
  let d = etDate;
  for (let i = 0; i < n; i += 1) {
    const prev = getPreviousSessionDate(d);
    if (!prev) return null;
    d = prev;
  }
  const s = getSessionForDate(d);
  return s?.openMs ? new Date(s.openMs).toISOString() : null;
}

const isHumanOwner = (ownerId) => typeof ownerId === 'string' && ownerId.length > 0 && !isCpuUserId(ownerId);

/**
 * The active players inside the cohort (E7). An empty cohort reads nothing and enqueues no one.
 * @returns {Promise<{ uids: string[], counts: { active: number, recent: number, deployed: number }, skippedCpu: number, outsideCohort: number }>}
 */
export async function enumerateActivePlayers(db, { etDate, env = process.env, cohort = huddleCohortOf(env) }) {
  if (!(cohort instanceof Set) || cohort.size === 0) return { uids: [], counts: { active: 0, recent: 0, deployed: 0 }, skippedCpu: 0, outsideCohort: 0 };
  const from = recentWindowStartIso(etDate);
  const owners = new Set();
  let skippedCpu = 0;
  const take = (ownerId, isCpu) => {
    if (isCpu === true || !isHumanOwner(ownerId)) { skippedCpu += 1; return; }
    owners.add(ownerId);
  };
  const active = await db.collection('agentBattles').where('status', '==', 'active').get();
  active.docs.forEach((d) => take(d.data()?.ownerId, d.data()?.isCpu));
  let recentCount = 0;
  let deployedCount = 0;
  if (from) {
    const recent = await db.collection('agentBattles').where('completedAt', '>=', from).get();
    recent.docs.forEach((d) => { recentCount += 1; take(d.data()?.ownerId, d.data()?.isCpu); });
    const deployed = await db.collection('agents').where('lastDeployedAt', '>=', from).get();
    deployed.docs.forEach((d) => { deployedCount += 1; take(d.data()?.ownerId, d.data()?.isCpu); });
  }
  const uids = [...owners].filter((uid) => cohort.has(uid)).sort();
  return { uids, counts: { active: active.size, recent: recentCount, deployed: deployedCount }, skippedCpu, outsideCohort: owners.size - uids.length };
}
