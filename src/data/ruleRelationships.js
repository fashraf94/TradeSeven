/**
 * Rule Relationships — Maps rules to containing traits and collections.
 * Used by the Intel Codex to show "Found In" chips.
 *
 * Computed once on import (static data, no reactivity needed).
 */

import { TRAIT_LIBRARY } from './traitLibrary';
import { OFFERED_COLLECTIONS } from './forgeCollections';

const relationshipMap = {};

// Build trait relationships
TRAIT_LIBRARY.forEach(trait => {
  trait.ruleIds.forEach(ruleId => {
    if (!relationshipMap[ruleId]) {
      relationshipMap[ruleId] = { traits: [], collections: [] };
    }
    relationshipMap[ruleId].traits.push({
      id: trait.id,
      name: trait.name,
      dnaGroup: trait.dnaGroup,
    });
  });
});

// Build collection relationships
// OFFERED_COLLECTIONS includes both style collections (with .rules array)
// and thematic collections (with .ruleIds array). Retired collections are
// excluded (C-20): a "Found In" chip must never point at a collection the
// user cannot reach.
OFFERED_COLLECTIONS.forEach(col => {
  const ruleIds = col.isStyleCollection
    ? (col.rules || []).map(r => r.ruleId)
    : (col.ruleIds || []);

  ruleIds.forEach(ruleId => {
    if (!relationshipMap[ruleId]) {
      relationshipMap[ruleId] = { traits: [], collections: [] };
    }
    relationshipMap[ruleId].collections.push({
      id: col.id,
      title: col.title,
      accentColor: col.accentColor,
    });
  });
});

/**
 * Get relationships for a specific rule.
 * @param {string} ruleId
 * @returns {{ traits: Array<{id, name, dnaGroup}>, collections: Array<{id, title, accentColor}> }}
 */
export function getRuleRelationships(ruleId) {
  return relationshipMap[ruleId] || { traits: [], collections: [] };
}

/**
 * Get all relationships (for batch lookups).
 */
export function getAllRuleRelationships() {
  return relationshipMap;
}
