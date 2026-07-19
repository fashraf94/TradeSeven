// src/data/ruleDocFields.js
//
// The ONE canonical field shape for a Forge rule document — everything EXCEPT the
// SDK-specific createdAt/updatedAt timestamps. Shared by BOTH rule-doc writers so
// their shapes cannot drift:
//   * src/services/forgeService.createRule          (client SDK — serverTimestamp())
//   * api/_utils/archetypeSeeding.buildSeedRuleDoc  (admin  SDK — FieldValue.serverTimestamp())
//
// A local copy of a write-shape / scoring definition is the documented V4-scorer
// bug class (BUILD_RULES §4: "Never create a local copy"). Never re-inline this —
// import it. Pure + dependency-free (no firebase, no React), so it loads cleanly
// into both the client bundle and the Node/api graph.
//
// @param {Object} ruleData - text, source, sourceRef, visibility, category, params,
//   paramValues, textTemplate, status, priority, traitId, provenance
// @returns {Object} the rule-doc fields WITHOUT createdAt/updatedAt — the caller
//   stamps those with its own SDK's server timestamp.
export function buildRuleDocFields(ruleData) {
  return {
    text: ruleData.text,
    source: ruleData.source,
    sourceRef: ruleData.sourceRef || null,
    visibility: ruleData.visibility || 'private',
    category: ruleData.category || null,
    params: ruleData.params || null,
    paramValues: ruleData.paramValues || null,
    textTemplate: ruleData.textTemplate || null,
    status: ruleData.status || 'active',
    priority: ruleData.priority || 0,
    traitId: ruleData.traitId || null,
    provenance: ruleData.provenance || null,
    isRefined: false,
    isDeleted: false,
    bundleIds: [],
  };
}
