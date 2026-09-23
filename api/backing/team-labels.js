// api/backing/team-labels.js
//
// GET /api/backing/team-labels?groupIds=a,b — Backing pre-flip cleanup, THE
// YOUR BACKING DATA'S NAMES (Amendment C §C1, D-af). Auth → dark 404 → the
// server's label for every team of the pods the viewer has BACKED, from the
// one resolver (api/_utils/backingTeamLabels.js).
//
// WHY THIS DOOR EXISTS. Your Backing (Surface D) and the strip's in-play half
// are assembled on the client from the rules-granted reads — the viewer's own
// stakes, the public pool document, the authed-read group document — and
// until this PR they named every seat from the group's `seatNames` map, which
// a lobby pod does not carry: the fallback was the raw account id (the PR 5
// review record's HON-17). A team's name is its primary agent's (§C1), and the
// agent is resolved SERVER-SIDE (the owner lookup board production uses, or,
// after settlement, the agent settlement recorded) — the client has no
// business reading `agents` (spec §5). So the names come from here, and the
// surfaces render `label` without composing anything from an id.
//
// THE ORDER, the same rungs every backing route climbs:
//   1  security middleware + rate limit
//   2  method — GET only
//   3  auth
//   4  THE FLAG — 404 while BACKING_BETA_ENABLED is dark, AFTER auth
//   5  query — `groupIds`, 1 to MAX_GROUP_IDS valid ids, comma-separated
//   6  the viewer's own stakes (ONE query), the pods they back among those
//      asked for, their group and pool documents, ONE batch of label reads
//
// THE VIEWER'S OWN BACKED PODS, AND NOTHING ELSE. A `groupId` the viewer holds
// no stake on is dropped from the answer: the surfaces this serves show only
// pods the viewer backed, and the route has no reason to name any other.
// Every team a backed pod can name is answered: its live seats, its frozen
// teams (with settlement's recorded agent) and the teams the viewer's own
// stakes name — including a seat that has since left.
//
// READ-ONLY, ALWAYS: this route writes nothing — no lazy job rides here (the
// pod list and the results reader own those).

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { isValidForgeId } from '../_utils/idValidation.js';
import { readGroup } from '../_utils/backingPools.js';
import { readPoolsFor, readStakesWhere } from '../_utils/backingStats.js';
import { labelSeatOf, podLabelSeats, resolveTeamLabels } from '../_utils/backingTeamLabels.js';
import { TEAM_LABELS_MAX_PODS } from '../../src/constants/backing.js';
import { BACKING_BETA_ENABLED } from '../../src/config/featureFlags.js';

export const config = { maxDuration: 10 };

/**
 * The most pods one request may name — the shared ceiling the client chunks
 * to (src/constants/backing.js TEAM_LABELS_MAX_PODS), one number for both ends.
 */
export const MAX_GROUP_IDS = TEAM_LABELS_MAX_PODS;

/** The `groupIds` parameter, parsed: a de-duplicated list, or null when it is malformed. */
export function parseGroupIds(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const ids = [...new Set(raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0))];
  if (ids.length === 0 || ids.length > MAX_GROUP_IDS) return null;
  return ids.every(isValidForgeId) ? ids : null;
}

export default async function handler(req, res) {
  // 1. Security middleware + rate limit.
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 60, windowMs: 60000 } })) return;

  // 2. Method.
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed. Use GET.' });

  // 3. Auth.
  const user = await requireAuth(req, res);
  if (!user) return;

  // 4. THE FLAG, read at call time, after auth.
  if (!BACKING_BETA_ENABLED) return res.status(404).json({ error: 'Not found' });

  // 5. Query.
  const groupIds = parseGroupIds(req.query?.groupIds);
  if (groupIds === null) {
    return res.status(400).json({ error: 'invalid_group_ids', message: `groupIds must be 1 to ${MAX_GROUP_IDS} valid ids, comma-separated.` });
  }

  const db = getFirebaseAdmin();
  try {
    // 6a. The viewer's OWN stakes — one query; the pods they back, and the
    // teams they back on each (a seat that has left is still named).
    const asked = new Set(groupIds);
    const teamsByGroup = new Map();
    for (const stake of await readStakesWhere(db, 'userId', user.uid)) {
      if (!asked.has(stake.groupId) || typeof stake.teamOdUserId !== 'string') continue;
      const list = teamsByGroup.get(stake.groupId) ?? [];
      list.push(stake.teamOdUserId);
      teamsByGroup.set(stake.groupId, list);
    }
    const backed = groupIds.filter((id) => teamsByGroup.has(id));

    // 6b. Their documents, then EVERY name in one batch (no per-row reads).
    const [groups, pools] = await Promise.all([
      Promise.all(backed.map((id) => readGroup(db, id))),
      readPoolsFor(db, backed),
    ]);
    const loaded = backed.map((groupId, i) => ({
      groupId,
      group: groups[i],
      pool: pools.get(groupId)?.pool ?? null,
      extraTeamIds: teamsByGroup.get(groupId),
    }));
    const labels = await resolveTeamLabels(db, loaded.flatMap((pod) => podLabelSeats(pod)));

    const pods = {};
    for (const { groupId, group, pool, extraTeamIds } of loaded) {
      const teams = {};
      for (const seat of podLabelSeats({ group, pool, extraTeamIds })) {
        teams[seat.odUserId] = labels.teamLabelFor(labelSeatOf({ group, pool }, seat.odUserId, seat.isCpu));
      }
      pods[groupId] = teams;
    }
    return res.status(200).json({ pods });
  } catch (err) {
    console.error('[backing-team-labels] failed:', err?.message);
    return res.status(500).json({ error: 'server_error', message: 'Could not load the team names.' });
  }
}
