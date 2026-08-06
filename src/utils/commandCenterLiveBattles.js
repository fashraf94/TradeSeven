// src/utils/commandCenterLiveBattles.js
//
// L-A follow-up (B) — the Command Center live-battle eligibility filter. The
// active-battle poll (App.jsx) reads agentBattles by owner+status only, so a
// battle whose GROUP was VOIDED still reads as live on the "04 · Manage" card —
// the same propagation gap the L-A void exists to close (the arena already treats
// a voided group as terminal via deriveArenaState → 'complete'). This is the
// READ-TIME group-status exclusion: the void lives ONLY on the group doc
// (voidGroup never writes the battle doc — the createAgentBattle shape is fenced),
// so the poll looks the group up and drops the battle here.
//
// Pure + node-clean (deriveArenaTerminalKind imports only GROUP_STATUS). The
// voided decision reuses that ONE tested predicate — no component/util hand-rolls
// `group.status === VOIDED` — so the card and the arena can never disagree on what
// "voided" means.

import { deriveArenaTerminalKind } from '../components/League/battleArena/arenaStateMap';

/**
 * Drop the owner's active agentBattles whose GROUP is VOIDED. EXPIRY-INDEPENDENT:
 * a voided group's battle is excluded even mid-day with a future `expiresAt` (the
 * operator scenario — void a group mid-session and its card must not keep counting
 * down as live). A battle with no `groupId` (a casual vs-CPU deploy — it can never
 * be voided) is kept, and a battle whose group could not be resolved is kept
 * (fail-open: a transient group-read miss must not blank a genuinely live battle,
 * matching the poll's retain-last-known-good posture). Pure.
 *
 * @param {Array<{groupId?: string}>} battles - already owner+status('active') scoped,
 *   training clones already dropped by the caller.
 * @param {Record<string, {status?: string}>} groupsById - resolved group docs keyed by id.
 * @returns {Array} the battles eligible for the live card.
 */
export function excludeVoidedGroupBattles(battles, groupsById = {}) {
  return (battles || []).filter((b) => {
    if (!b?.groupId) return true; // casual vs-CPU: no group, cannot be voided
    const group = groupsById[b.groupId];
    if (!group) return true;      // unresolved group → fail-open (never blank a live battle)
    return deriveArenaTerminalKind(group) !== 'voided';
  });
}
