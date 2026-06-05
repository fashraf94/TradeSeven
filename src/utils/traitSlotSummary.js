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
