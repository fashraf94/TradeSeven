// src/utils/equipSlots.js
//
// The Equip bench's canonical slot array — which loadout slots render, in
// order, and whether each is filled — derived from the agent doc and the
// TRAIT_SLOT_ENABLED flag. Shared by the mobile bench (EquipStation), the
// desktop bench (EquipBench), and the shells' "n/m slots" labels so the
// rendered slots and the slot-count copy can't disagree (no literal
// denominators). No React, no Firestore — unit-tested in equipSlots.test.js.

import { TRAIT_SLOT_ENABLED } from '../config/featureFlags';
import { getTraitSlotSummary } from './traitSlotSummary';

/**
 * @param {Object|null} agent - the agent doc (reads equippedWatchlistId,
 *   equippedTraits)
 * @returns {Array<{id: 'archetype'|'watchlist'|'traits', filled: boolean}>}
 *   the slots the bench renders, in bench order. Archetype is always present
 *   and filled; the traits slot exists only with TRAIT_SLOT_ENABLED on.
 */
export function getEquipSlots(agent) {
  return [
    { id: 'archetype', filled: true },
    { id: 'watchlist', filled: Boolean(agent?.equippedWatchlistId) },
    ...(TRAIT_SLOT_ENABLED
      ? [{ id: 'traits', filled: getTraitSlotSummary(agent).equipped }]
      : []),
  ];
}

/** "n/m slots" inputs for the section labels, derived from getEquipSlots. */
export function getEquipSlotCounts(agent) {
  const slots = getEquipSlots(agent);
  return { filled: slots.filter((s) => s.filled).length, total: slots.length };
}
