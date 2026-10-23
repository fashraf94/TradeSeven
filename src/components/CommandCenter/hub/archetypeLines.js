// src/components/CommandCenter/hub/archetypeLines.js
//
// Command Center hub, slice S5 — the hub's ONE reader of the archetype
// identity tables (ruling R-S5-1: "the name and approach, through the existing
// archetype identity helpers").
//
// archetypeDisplay and archetypeIdentity are legacy archetype tables, so the
// Spec §2.3 import-boundary ratchet (BUILD_RULES §1) records every direct
// importer in api/_utils/archetypeImportBoundaryBaseline.json. Keeping both
// imports in this single file makes the hub ONE baseline line, and the rest of
// the hub takes its archetype words from here as plain data.
//
// The words are the shells' own (EquipStation.jsx, desktop/EquipBench.jsx): the
// display name for the heading and the one-line disposition for the approach.
// One difference, on purpose: getArchetypeIdentity falls back to the analyst's
// profile for an unknown code-id, so the shells would print the analyst's
// disposition under the name "Unknown". The hub prints an approach only for a
// code-id the identity table holds.

import { getArchetypeDisplayName } from '../../../data/archetypeDisplay';
import ARCHETYPE_IDENTITY, { getArchetypeIdentity } from '../../../data/archetypeIdentity';

/**
 * @param {string|null|undefined} archetype the agent doc's stable archetype code-id
 * @returns {{ name: string, approach: string|null }}
 */
export function archetypeLines(archetype) {
  const known = typeof archetype === 'string' && Object.hasOwn(ARCHETYPE_IDENTITY, archetype);
  return {
    name: getArchetypeDisplayName(archetype),
    approach: known ? getArchetypeIdentity(archetype).disposition : null,
  };
}
