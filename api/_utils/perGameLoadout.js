// api/_utils/perGameLoadout.js
//
// Build A2 — the server's half of the per-game loadout (rulings D1, FD-1, FD-2, FD-3, FD-11; build report
// docs/audits/20261107_BUILD_ARMORY_A2.md §2–§3). The model itself is src/constants/perGameLoadout.js, which the client
// reads too; this module adds what only the server does: the League lock read inside a writer's transaction, the
// typed refusal, the slot writes, and the BaggerBomb loadout applied over a casual clone's inherited fields. Nothing
// here reads PER_GAME_LOADOUT_ENABLED: every caller does, so flag-off no caller reaches it.
//
// THE LOCK QUERY (FD-3): `tournamentGroups where groupMembers array-contains <uid>`, the member-scoped query
// subscribeMyGroup and findActiveTrainingPodForUser already run (an automatic single-field index; no composite index),
// read inside the writer's transaction and judged by leagueLockOf — selectMyGroup's allowlist, so training pods never
// lock it.
//
// Imports the Node-clean model from src/ under the June 2026 import rule (BUILD_RULES §4); perGameLoadout.test.js's
// real import of THIS module is the dependency-surface guard — never mock it.

import { TOURNAMENT_GROUPS_COLLECTION } from '../../src/constants/leagueTournament.js';
import {
  baggerbombLoadoutOf,
  baggerbombSlotOf,
  bookIdOf,
  formatLockDay,
  leagueLockOf,
  materializeBaggerbombSlot,
} from '../../src/constants/perGameLoadout.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** The refusal's code, shared by the three writers' sentinel maps. */
export const LEAGUE_LOCKED = 'league_locked';

/** The lock, read inside the caller's transaction (a read: it precedes every write). */
export async function readLeagueLockInTx(tx, db, uid) {
  const query = db.collection(TOURNAMENT_GROUPS_COLLECTION).where('groupMembers', 'array-contains', uid);
  const snap = await tx.get(query);
  const docs = (snap?.docs || []).map((d) => ({ id: d.id, ...(typeof d.data === 'function' ? d.data() : d.data) }));
  return leagueLockOf(docs);
}

/** The typed error a writer throws inside its transaction; it carries the lock to the response. */
export function leagueLockedError(sentinelPrefix, lock) {
  const err = new Error(sentinelPrefix + LEAGUE_LOCKED);
  err.lock = lock;
  return err;
}

/**
 * The 409 body: the lock named, with its end (`endsAt`, ISO, or null when the calendar cannot say) and the group that
 * holds it. The client composes its own words from these fields.
 */
export function leagueLockedBody(lock) {
  const endsAt = typeof lock?.endsAtMs === 'number' && Number.isFinite(lock.endsAtMs) ? new Date(lock.endsAtMs).toISOString() : null;
  // Founder ruling Q3 (Nov 7 2026): the words every lock line says, the day only (formatLockDay, the client's formatter)
  const day = endsAt ? formatLockDay(lock.endsAtMs) : null;
  return {
    error: LEAGUE_LOCKED,
    message: day
      ? `The League loadout is locked until the week is scored, after the close on ${day}. It changes between weeks.`
      : 'The League loadout is locked until the week is scored. It changes between weeks.',
    lock: { kind: 'league_week', groupId: lock?.groupId ?? null, status: lock?.status ?? null, endsAt },
  };
}

/** Only the player's ranked record holds the slot; a clone document never does. */
export function isRankedAgentDoc(agent) {
  return isObj(agent) && agent.isCasualClone !== true && agent.isTrainingClone !== true;
}

/** The update that stores `slot` as the BaggerBomb slot, keeping any other loadout the map holds. */
export function slotUpdate(agent, slot) {
  return { loadouts: { ...(isObj(agent?.loadouts) ? agent.loadouts : {}), baggerbomb: slot } };
}

/**
 * A League write's rider: while the slot is absent, snapshot it from the ranked fields BEFORE the change, in the same
 * update, so the change never reaches BaggerBomb (materialize on first write). An empty object once the slot exists.
 */
export function materializeOnLeagueWrite(agent) {
  return baggerbombSlotOf(agent) ? {} : slotUpdate(agent, materializeBaggerbombSlot(agent));
}

/** The BaggerBomb slot after a BaggerBomb write: the stored slot (or its snapshot), with the archetype or the book replaced. */
export function baggerbombSlotWith(agent, { archetype, book } = {}) {
  const base = baggerbombSlotOf(agent) ?? materializeBaggerbombSlot(agent);
  return { archetype: archetype ?? base.archetype, book: book ?? base.book };
}

/**
 * The casual clone's inherited fields with the BaggerBomb loadout applied (the resync and the creation): the slot's
 * archetype and book. While the slot is absent BaggerBomb wears the default, which IS the inherited fields, so they
 * pass unchanged.
 */
export function applyBaggerbombLoadout(fields, rankedAgent) {
  const bb = baggerbombLoadoutOf(rankedAgent);
  if (bb.isDefault) return fields;
  const id = bookIdOf(bb.book);
  return { ...fields, archetype: bb.archetype, equippedWatchlistId: id, equippedWatchlistName: id ? bb.book.name : null };
}
