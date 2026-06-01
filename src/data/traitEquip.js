// src/data/traitEquip.js
//
// Pure, framework-free helpers that reproduce the EXACT Forge-rule construction
// of the hand-equip path so the archetype default-trait seeder
// (src/services/seedDefaultTraits.js) builds a loadout byte-identical to one a
// user equips by hand.
//
// Reference implementation (DO NOT let these drift):
//   - rule spec      → useForge.js  addRuleToBundle (text interpolation + createRule payload)
//   - equip entry    → useTraits.js equipTrait      ({ traitId, strength, isCustom, equippedAt })
//   - set/conflicts  → useTraits.js equipTrait      ("Last Equipped Wins" → earlier trait isCustom)
//
// No hooks, no Firestore — so these are unit-tested directly by traitEquip.test.js,
// which is the anti-drift guard. If the hand-equip construction ever changes,
// update these AND that test in lockstep.

import { FORGE_RULE_TEMPLATES } from './forgeKnowledgeBase';
import { TRAIT_BY_ID } from './traitLibrary';

// id → KB template, mirroring the TEMPLATE_MAP built in useTraits.js
const TEMPLATE_MAP = new Map(FORGE_RULE_TEMPLATES.map((t) => [t.id, t]));

// Interpolate a forge template's text with strength param overrides, exactly as
// useForge.addRuleToBundle does (override wins; otherwise the param's default).
function interpolateText(firstTemplate, paramOverrides) {
  let ruleText = firstTemplate.text;
  if (firstTemplate.params) {
    for (const [key, config] of Object.entries(firstTemplate.params)) {
      const val =
        paramOverrides?.[key] !== undefined ? paramOverrides[key] : config.default;
      ruleText = ruleText.replace(`{${key}}`, val);
    }
  }
  return ruleText;
}

/**
 * Expand one trait at a given strength into an ordered array of createRule
 * payloads — one per ruleId that resolves to a KB template. Unknown templates
 * are skipped (mirrors useTraits.equipTrait's warn+continue). The payload shape
 * matches the createRule call inside useForge.addRuleToBundle field-for-field.
 *
 * @param {Object} traitDef - trait definition (has id, ruleIds, strengthProfiles)
 * @param {string} strength - 'subtle' | 'moderate' | 'dominant'
 * @returns {Array<Object>} createRule payloads
 */
export function expandTraitToRuleSpecs(traitDef, strength) {
  if (!traitDef) return [];
  const profile = traitDef.strengthProfiles?.[strength];
  if (!profile) return [];

  const specs = [];
  for (const ruleId of traitDef.ruleIds) {
    const template = TEMPLATE_MAP.get(ruleId);
    if (!template) continue; // unknown template — skip, like equipTrait
    const firstTemplate = template.forgeTemplates[0];
    const paramOverrides = profile[ruleId] || {};
    specs.push({
      text: interpolateText(firstTemplate, paramOverrides),
      textTemplate: firstTemplate.text,
      source: 'forge_discover',
      sourceRef: template.id, // === ruleId
      category: firstTemplate.category || template.category,
      params: firstTemplate.params || null,
      paramValues: paramOverrides,
      status: 'active',
      priority: 1,
      traitId: traitDef.id,
    });
  }
  return specs;
}

/**
 * Build the equippedTraits[] entry written to the agent doc, matching the shape
 * in useTraits.equipTrait. `equippedAt` is Date.now() (ms epoch), as hand-equip.
 */
export function buildEquippedTraitEntry(traitId, strength, isCustom = false) {
  return {
    traitId,
    strength,
    isCustom,
    equippedAt: Date.now(),
  };
}

/**
 * Plan a full multi-trait equip exactly as equipping each trait in order via
 * useTraits.equipTrait would: returns the ordered rule specs to create (one per
 * resolvable ruleId, duplicates across traits included) and the equippedTraits
 * entries with "Last Equipped Wins" isCustom marking applied.
 *
 * The seeder executes this plan against Firestore; keeping the logic pure here
 * lets the parity test verify it (including the cross-trait conflict case).
 *
 * @param {string[]} traitIds - ordered trait ids (archetype default set)
 * @param {string} strength
 * @returns {{ ruleSpecs: Array<Object>, equippedTraits: Array<Object> }}
 */
export function buildSeedPlan(traitIds, strength) {
  const existingRuleIds = new Set();
  const equippedTraits = [];
  const ruleSpecs = [];

  for (const traitId of traitIds || []) {
    const def = TRAIT_BY_ID[traitId];
    if (!def) continue; // unknown trait — skip
    if (!def.strengthProfiles?.[strength]) continue; // invalid strength — skip (like equipTrait)

    // Conflicts: ruleIds this trait shares with already-staged traits.
    const conflicts = def.ruleIds.filter((rid) => existingRuleIds.has(rid));

    // Stage this trait's rules (per-trait, template-skip handled by expand).
    ruleSpecs.push(...expandTraitToRuleSpecs(def, strength));

    // Register all of this trait's ruleIds (even template-less ones, as equipTrait does).
    for (const rid of def.ruleIds) existingRuleIds.add(rid);

    // "Last Equipped Wins": mark earlier traits sharing a conflicting ruleId as custom.
    if (conflicts.length > 0) {
      for (const entry of equippedTraits) {
        const eDef = TRAIT_BY_ID[entry.traitId];
        if (eDef && eDef.ruleIds.some((rid) => conflicts.includes(rid))) {
          entry.isCustom = true;
        }
      }
    }

    equippedTraits.push(buildEquippedTraitEntry(traitId, strength, false));
  }

  return { ruleSpecs, equippedTraits };
}
