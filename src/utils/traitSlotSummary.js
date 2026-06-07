// src/utils/traitSlotSummary.js
//
// Pure, framework-free derivation of the Equip station's Traits-slot display from
// the agent doc — shared by the mobile (EquipStation) and desktop (EquipBench)
// benches so the "N traits" + first-two-names summary (and the slot's empty-state
// copy) can't drift between the two surfaces.
//
// Reads agent.equippedTraits (the realtime agent-doc field) and resolves names via
// TRAIT_BY_ID. No React, no Firestore — unit-tested in traitSlotSummary.test.js.

import { TRAIT_BY_ID } from '../data/traitLibrary';
import { DNA_GROUPS } from '../data/dnaGroups';

/**
 * @param {Object|null} agent - the agent doc (reads agent.equippedTraits)
 * @returns {{ equipped: boolean, count: number, names: string[], summary: string, name: string, sub: string }}
 *   `name`/`sub` are ready-to-render slot strings; `summary` is the first two trait
 *   names joined by " · " with a " +N" overflow tail. `count` is the raw equipped
 *   count; `names` drops any ids missing from the trait library.
 */
export function getTraitSlotSummary(agent) {
  const equippedTraits = agent?.equippedTraits || [];
  const count = equippedTraits.length;
  const equipped = count > 0;
  const names = equippedTraits.map((t) => TRAIT_BY_ID[t?.traitId]?.name).filter(Boolean);
  const summary =
    names.slice(0, 2).join(' · ') + (names.length > 2 ? ` +${names.length - 2}` : '');
  return {
    equipped,
    count,
    names,
    summary,
    name: equipped ? `${count} trait${count === 1 ? '' : 's'}` : 'Add traits',
    sub: equipped ? summary : 'Optional · shapes your agent',
  };
}

/**
 * Build a SPECIFIC "this DNA group is full" message for a card that's blocked by
 * its group cap — names the full group and the equipped cards holding its slots.
 *
 * DISPLAY ONLY. This does NOT decide whether a card is blocked (useTraits.canEquip
 * owns that, by dnaGroup). It only makes an already-blocked state legible —
 * especially for a card whose public FAMILY differs from its slot GROUP (e.g.
 * Sector Rotator shows under "Play" but fills a Strategy slot, so it's blocked by
 * the user's Strategy-group cards). Generalizes over all groups, not a special case.
 *
 * Returns null when the group isn't actually full, so callers fall back to the
 * generic copy.
 *
 * @param {{ id?:string, name?:string, dnaGroup?:string }} trait - the blocked trait def
 * @param {Array<{traitId:string}>} equippedTraits - currently equipped entries
 * @returns {string|null}
 */
export function buildSlotFullMessage(trait, equippedTraits) {
  const groupId = trait?.dnaGroup;
  const group = groupId ? DNA_GROUPS[groupId] : null;
  if (!group) return null;
  const holders = (equippedTraits || [])
    .map((e) => TRAIT_BY_ID[e?.traitId])
    .filter((d) => d && d.dnaGroup === groupId && d.id !== trait.id)
    .map((d) => d.name);
  if (holders.length < group.maxTraits) return null; // not actually full → generic fallback
  return `${trait.name} uses a ${group.name} slot, and your ${group.name} slots are full (${holders.join(', ')}). Unequip one to make room.`;
}
