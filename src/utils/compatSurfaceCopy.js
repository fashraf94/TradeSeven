// src/utils/compatSurfaceCopy.js
//
// WS1 Phase 2 — PURE copy builders for the rule-vs-archetype compatibility
// surfaces (the conflictSurfaceCopy.js pattern: no React, no I/O, unit-tested,
// shared by every surface so the copy rules live in ONE place).
//
// Three distinct cases (adjudication close-out rider §4.1):
//   1. SOFT WARN (equip/create of a soft core_conflict rule, enforce mode):
//      non-blocking — the rule runs as a soft preference.
//   2. PROMOTE BLOCK, override kind (setRuleHardness / reforge carry): the
//      rule CAN run soft; it cannot be made must-obey. (Spec §5.2 copy.)
//   3. PROMOTE BLOCK, category kind (create-as-hard / category flip): the rule
//      is must-obey BY CATEGORY, so it cannot run soft at all — say it is
//      off-style at must-obey strength and point to on-style alternatives
//      (never claim "available soft-only", which would be false).
// Param-swing rules (PARAM_SWING_NOTES) additionally acknowledge that a
// non-default setting fits the archetype (rider §4.2).

import {
  ZONE1_REFS,
  PARAM_SWING_NOTES,
  getRuleCompatInfo,
} from '../data/archetypeRuleCompatibility';
import { getArchetypeDisplayName } from '../data/archetypeDisplay';
import { FORGE_RULE_TEMPLATES } from '../data/forgeKnowledgeBase';

// Paths where must-obey strength comes from the rule's CATEGORY (case 3)
// rather than an authored override (case 2).
const CATEGORY_HARD_PATHS = new Set(['create_rule', 'update_rule_category']);

function zone1Statement(zone1Ref) {
  return ZONE1_REFS[zone1Ref]?.statement || 'it contradicts a core statement of this archetype';
}

function templateHeadline(templateId) {
  const t = FORGE_RULE_TEMPLATES.find((x) => x.id === templateId);
  return t?.headline || templateId;
}

// The param-swing acknowledgment sentence, or '' when the rule has none for
// this archetype.
function paramSwingSuffix(templateId, archetype) {
  const note = PARAM_SWING_NOTES[templateId];
  if (!note || note.archetype !== archetype) return '';
  return ` ${note.copyHint}`;
}

// Up to two on-style (native) same-category alternatives for the archetype —
// the "point to native alternatives" leg of the category-kind block copy.
export function nativeAlternatives(templateId, archetype, limit = 2) {
  const blockedTemplate = FORGE_RULE_TEMPLATES.find((t) => t.id === templateId);
  if (!blockedTemplate) return [];
  return FORGE_RULE_TEMPLATES
    .filter(
      (t) =>
        t.id !== templateId &&
        t.category === blockedTemplate.category &&
        getRuleCompatInfo(t.id, archetype).state === 'native'
    )
    .slice(0, limit)
    .map((t) => ({ templateId: t.id, headline: t.headline }));
}

/**
 * Case 1 — the non-blocking soft warning (spec §5.3 copy pattern).
 * "Off-style for your [Archetype]: [zone1 statement] It will run as a soft
 * preference your agent may weigh against its instincts."
 */
export function buildConflictEquipWarning({ archetype, templateId, zone1Ref }) {
  const name = getArchetypeDisplayName(archetype);
  return (
    `Off-style for your ${name}: ${zone1Statement(zone1Ref)} ` +
    `"${templateHeadline(templateId)}" will run as a soft preference your agent may weigh against its instincts.` +
    paramSwingSuffix(templateId, archetype)
  );
}

/**
 * Cases 2 + 3 — the enforce-mode block message (thrown to the user via
 * RuleCompatBlockError → toast). Kind is derived from the write path.
 */
export function buildPromoteBlockedMessage({ archetype, templateId, path, zone1Ref }) {
  const name = getArchetypeDisplayName(archetype);
  const statement = zone1Statement(zone1Ref);
  const headline = templateHeadline(templateId);

  if (CATEGORY_HARD_PATHS.has(path)) {
    // Case 3 — category-derived must-obey: it cannot run soft at all.
    const alts = nativeAlternatives(templateId, archetype);
    const altText = alts.length
      ? ` Try an on-style alternative instead: ${alts.map((a) => `"${a.headline}"`).join(' or ')}.`
      : ' Browse the same category for one of your archetype\'s on-style rules instead.';
    return (
      `"${headline}" contradicts your ${name}'s core — ${statement} ` +
      `It is a must-obey rule by category, so it can't be equipped on this archetype.` +
      altText +
      paramSwingSuffix(templateId, archetype)
    );
  }

  // Case 2 — authored-override promote: soft is fine, must-obey is not.
  return (
    `"${headline}" contradicts your ${name}'s core — ${statement} ` +
    `It can run as a soft preference, but it can't be made must-obey.` +
    paramSwingSuffix(templateId, archetype)
  );
}

/**
 * Render-time badge copy for an already-equipped core_conflict rule
 * (derivation only — no data writes). Short: it sits inside rule rows.
 */
export function buildConflictBadge({ archetype }) {
  return `Off-style for ${getArchetypeDisplayName(archetype)}`;
}

/**
 * B6 bundle-equip toast: summarize the conflicts in the just-equipped bundle
 * (count-honest, bundle-scoped — the conflictSurfaceCopy Rule 7 discipline).
 * Returns null when there is nothing to say.
 */
export function buildBundleEquipCompatWarning({ archetype, conflicts }) {
  const n = (conflicts || []).length;
  if (n === 0) return null;
  const name = getArchetypeDisplayName(archetype);
  const first = templateHeadline(conflicts[0].templateId);
  const subject = n === 1 ? `"${first}" is` : `${n} rules in this bundle are`;
  return (
    `Heads up — ${subject} off-style for your ${name}. ` +
    `Off-style rules run as soft preferences your agent may weigh against its instincts. (Checked this bundle only.)`
  );
}
