// api/_utils/ruleCompatCleanup.js
//
// WS1 Phase 4 — the PURE core of the one-time pre-launch compat cleanup
// (Flash decision: demote to soft with a reversible record, never delete).
// The runner (scripts/rule-compat-cleanup.js) owns all I/O; this module owns
// every decision, so the entire cleanup logic is fixture-tested without
// Firestore. Node-clean; composes the SAME projection the deploy path uses
// (projectActiveRules — called, never modified) so "equipped" here means
// exactly what reaches a battle.
//
// DUAL ENUMERATION (close-out rider 4.3): hard conflicts are classed by WHY
// they resolve hard, because the demote mechanics differ —
//   override_hard        — an authored bundle override says 'hard'.
//                          Demote: delete the entry (soft-category rules —
//                          reverts to the soft category default) or set 'soft'
//                          (hard-category rules — the only demote that works).
//   category_hard_bundled — hard category (risk/allocation), no override,
//                          reached via bundle membership. Demote: set a
//                          'soft' override in EVERY containing non-archived
//                          bundle (first-explicit-wins projection + bundle
//                          shuffles can never resurrect 'hard').
//   category_hard_trait  — hard category reached via the TRAIT layer, which
//                          bundle overrides cannot touch (projectActiveRules
//                          honors overrides only for ruleIds listed in the
//                          bundle). Two sub-cases:
//                            · guardian × trait-diversifier — the adjudicated
//                              seed bug: auto-fix = swap the trait for
//                              trait-steady-anchor (the §3 close-out fix),
//                              soft-deleting the old docs.
//                            · anything else — REPORT-ONLY (no sanctioned
//                              generic auto-fix; founder decides per agent).
//
// SAFETY: agents with an active battle are skipped-and-reported; training
// clones (isTrainingClone) are IN SCOPE (Phase-0 A3 question, closed by the
// Phase 4 GO) but skip-and-report when their own battle OR their group's
// battle is active. Nothing here ever touches battle.* docs. Idempotent: an
// already-demoted state analyzes to zero conflicts and an empty plan.
//
// No Date/randomness in this module — the runner stamps runId/timestamps.

import { projectActiveRules } from './projectActiveRules.js';
import { classifyByCategory } from './ruleHardness.js'; // the server hard/soft source — never a fourth {'risk','allocation'} copy
import { getRuleCompatInfo } from '../../src/data/archetypeRuleCompatibility.js';
import { GROUP_STATUS } from '../../src/constants/leagueTournament.js';

// The one sanctioned trait auto-fix (adjudication close-out §3).
export const SEEDED_TRAIT_FIX = Object.freeze({
  archetype: 'guardian',
  removeTraitId: 'trait-diversifier',
  addTraitId: 'trait-steady-anchor',
});

// ── origin derivation (Phase 0 §2.2 "path-of-origin if derivable") ──────────
export function deriveOrigin(ruleDoc) {
  if (ruleDoc.traitId) {
    return ruleDoc.provenance === 'archetype_default' ? 'seeded_trait' : 'hand_equipped_trait';
  }
  if (typeof ruleDoc.id === 'string' && ruleDoc.id.startsWith('dim-')) return 'dimension_deploy';
  if (ruleDoc.provenance === 'archetype_default') return 'starter_kit';
  if (ruleDoc.provenance === 'user_equipped') return 'user_bundle';
  return 'unknown_legacy';
}

// Non-archived bundles whose ruleIds contain the doc (the projection's reach).
function containingBundles(bundleDocs, ruleDocId) {
  return (bundleDocs || []).filter(
    (b) => b && b.status !== 'archived' && (b.ruleIds || []).includes(ruleDocId)
  );
}

/**
 * The shared classification kernel: project the agent's equipped surface
 * exactly as deploy does, join docs for sourceRef, classify under the given
 * archetype, and return the core_conflict items. Used by analyzeAgentCompat
 * below AND by the change-archetype rescan (api/agent/change-archetype.js) so
 * the two never drift. Pure.
 *
 * @returns {{ projected: Array, docs: Array, docById: Map,
 *             conflicts: Array<{item, doc, templateId, zone1Ref}> }}
 */
export function collectProjectedConflicts({ archetype, equippedTraits, ruleDocs, bundleDocs }) {
  const docs = (ruleDocs || []).filter((r) => r && !r.isDeleted);
  const docById = new Map(docs.map((r) => [r.id, r]));
  const projected = projectActiveRules(equippedTraits || [], docs, bundleDocs || []);
  const conflicts = [];
  for (const item of projected) {
    const doc = docById.get(item.ruleId);
    const templateId = doc?.sourceRef || null;
    if (!templateId) continue; // manual rules are outside the map (V1 boundary)
    const info = getRuleCompatInfo(templateId, archetype);
    if (info.state !== 'core_conflict') continue;
    conflicts.push({ item, doc, templateId, zone1Ref: info.zone1Ref });
  }
  return { projected, docs, docById, conflicts };
}

// Demote a single carrier bundle's entry for a rule: soft-category rules
// DELETE the entry (reverts to the soft category default); hard-category rules
// SET 'soft' (deletion would resurrect must-obey via the category fallback).
function demoteOp(bundle, ruleDocId, categoryDefaultHard) {
  const previousValue = (bundle.ruleHardness || {})[ruleDocId] ?? null;
  return {
    op: 'demote_bundle_override',
    bundleId: bundle.id,
    ruleDocId,
    action: categoryDefaultHard ? 'set_soft' : 'delete',
    previousValue,
  };
}

/**
 * Analyze one agent. Pure.
 *
 * @param {Object} p
 * @param {Object} p.agent       - agent doc (with id, archetype, activeBattleId,
 *                                 equippedTraits, isTrainingClone, groupId)
 * @param {Array}  p.ruleDocs    - agents/{id}/rules docs (each with id)
 * @param {Array}  p.bundleDocs  - agents/{id}/bundles docs (each with id)
 * @param {Object} [p.groupStatusById] - tournamentGroups id → status (clone skip check)
 * @returns analysis record (see report shape)
 */
export function analyzeAgentCompat({ agent, ruleDocs, bundleDocs, groupStatusById = {} }) {
  const base = {
    agentId: agent.id,
    archetype: agent.archetype || null,
    isTrainingClone: agent.isTrainingClone === true,
    groupId: agent.groupId || null,
    skipped: null,
    hardConflicts: [],
    softConflicts: [],
    // Soft-PROJECTING conflicts whose carrier bundles still hold demotable
    // 'hard' state a shuffle could resurrect (their demotes are planned too).
    lurkingHardCarriers: [],
    dormantHardConflicts: [],
    plan: [],
  };

  // ── skip gates (skip-and-report; no plan is built for skipped agents) ──
  if (!base.archetype) {
    return { ...base, skipped: { reason: 'no_archetype' } };
  }
  if (agent.activeBattleId) {
    return { ...base, skipped: { reason: 'battle_active', battleId: agent.activeBattleId } };
  }
  if (base.isTrainingClone && base.groupId && groupStatusById[base.groupId] === GROUP_STATUS.BATTLE) {
    return { ...base, skipped: { reason: 'group_battle_active', groupId: base.groupId } };
  }

  // "Equipped" = what the deploy projection emits — the source of truth
  // (shared kernel, also used by the change-archetype rescan).
  const { projected, docs, conflicts } = collectProjectedConflicts({
    archetype: base.archetype,
    equippedTraits: agent.equippedTraits || [],
    ruleDocs,
    bundleDocs,
  });
  const projectedIds = new Set(projected.map((i) => i.ruleId));

  // Ensure every carrier of this rule ends demoted so no bundle shuffle can
  // resurrect 'hard' (first-explicit-wins projection): 'hard' entries demote
  // per category; for hard-CATEGORY rules, carriers without an entry also
  // gain an explicit 'soft'.
  const planCarrierDemotes = (ruleDocId, categoryDefaultHard) => {
    for (const b of containingBundles(bundleDocs, ruleDocId)) {
      const entry = (b.ruleHardness || {})[ruleDocId];
      if (entry === 'hard') base.plan.push(demoteOp(b, ruleDocId, categoryDefaultHard));
      else if (categoryDefaultHard && entry !== 'soft') base.plan.push(demoteOp(b, ruleDocId, true));
    }
  };

  for (const { item, doc, templateId, zone1Ref } of conflicts) {
    const record = {
      ruleDocId: item.ruleId,
      templateId,
      category: item.category || null,
      hardness: item.hardness,
      zone1Ref,
      origin: deriveOrigin(doc),
      traitId: doc.traitId || null,
    };
    const carriers = containingBundles(bundleDocs, item.ruleId);
    const categoryDefaultHard = classifyByCategory(item.category) === 'hard';
    const overrideCarriers = carriers.filter((b) => (b.ruleHardness || {})[item.ruleId] === 'hard');

    if (item.hardness !== 'hard') {
      // Census only — soft conflicts stay equipped (badge-only). BUT a 'hard'
      // entry lurking in a non-winning carrier (or a bare hard-category
      // carrier) could resurrect must-obey after a bundle shuffle — demote
      // those now so the cleanup's shuffle-proof claim holds for EVERY
      // projected conflict, not just the currently-hard ones.
      base.softConflicts.push(record);
      if (overrideCarriers.length > 0 || (categoryDefaultHard && carriers.length > 0)) {
        base.lurkingHardCarriers.push({ ...record, bundleIds: overrideCarriers.map((b) => b.id) });
        planCarrierDemotes(item.ruleId, categoryDefaultHard);
      }
      continue;
    }

    // ── hard conflict: classify by WHY it is hard (rider 4.3) ──
    // Bundle-carried hardness is demotable through the carriers even for
    // TRAIT rules — projectActiveRules applies a carrier's ruleHardness entry
    // to trait items too, so the override/category-bundled paths take
    // precedence over the trait-layer treatment.
    if (overrideCarriers.length > 0) {
      base.hardConflicts.push({
        ...record,
        class: 'override_hard',
        bundleIds: overrideCarriers.map((b) => b.id),
      });
      planCarrierDemotes(item.ruleId, categoryDefaultHard);
      continue;
    }
    if (carriers.length > 0 && categoryDefaultHard) {
      base.hardConflicts.push({
        ...record,
        class: 'category_hard_bundled',
        bundleIds: carriers.map((b) => b.id),
      });
      planCarrierDemotes(item.ruleId, true);
      continue;
    }

    // Trait layer proper: hard by category with NO carrier bundle to demote
    // through (the normal seeded/hand-equipped trait shape).
    const isSeededFixCase =
      base.archetype === SEEDED_TRAIT_FIX.archetype && doc.traitId === SEEDED_TRAIT_FIX.removeTraitId;
    base.hardConflicts.push({
      ...record,
      class: 'category_hard_trait',
      seededFixCase: isSeededFixCase,
      bundleIds: [],
    });
    if (isSeededFixCase) {
      if (!base.plan.some((op) => op.op === 'swap_seeded_trait')) {
        const traitDocIds = docs.filter((r) => r.traitId === SEEDED_TRAIT_FIX.removeTraitId).map((r) => r.id);
        const prevEntry = (agent.equippedTraits || []).find((t) => t && t.traitId === SEEDED_TRAIT_FIX.removeTraitId) || null;
        base.plan.push({
          op: 'swap_seeded_trait',
          removeTraitId: SEEDED_TRAIT_FIX.removeTraitId,
          addTraitId: SEEDED_TRAIT_FIX.addTraitId,
          softDeleteRuleDocIds: traitDocIds,
          previousEquippedTraitsEntry: prevEntry,
          // Preserve the agent's chosen strength — the replacement trait
          // seeds at the SAME strength, never a silent moderate reset.
          strength: ['subtle', 'moderate', 'dominant'].includes(prevEntry?.strength) ? prevEntry.strength : 'moderate',
        });
      }
    } else {
      base.plan.push({
        op: 'report_only_trait_conflict',
        ruleDocId: item.ruleId,
        templateId,
        traitId: doc.traitId,
        // Policy (Phase 5 GO): report-only trait-layer HARD conflicts must be
        // resolved by UNEQUIPPING the trait before the enforce flip —
        // accept-and-badge is not a sanctioned end-state for hard conflicts
        // (they would project must-obey indefinitely).
        note: 'Trait-layer hard conflict outside the sanctioned seed fix — resolve by unequipping the trait before the enforce flip (accept-and-badge is not a sanctioned end-state for hard conflicts; no generic auto-fix).',
      });
    }
  }

  // ── dormant hard conflicts (informational): conflict docs that resolve hard
  // by category but do NOT project (archived-bundle-only or unequipped trait).
  for (const doc of docs) {
    if (projectedIds.has(doc.id)) continue;
    const templateId = doc.sourceRef || null;
    if (!templateId) continue;
    if (classifyByCategory(doc.category) !== 'hard') continue;
    const info = getRuleCompatInfo(templateId, base.archetype);
    if (info.state !== 'core_conflict') continue;
    base.dormantHardConflicts.push({
      ruleDocId: doc.id,
      templateId,
      category: doc.category,
      origin: deriveOrigin(doc),
      traitId: doc.traitId || null,
    });
  }

  // Any demote/swap requires the agent's activeRules re-derived through the
  // EXISTING projection (never hand-edited) as the terminal op.
  if (base.plan.some((op) => op.op !== 'report_only_trait_conflict')) {
    base.plan.push({ op: 'reproject_active_rules' });
  }

  return base;
}

/**
 * Aggregate analyses into the run report (the dry-run deliverable + the live
 * run's audit artifact). Pure — runner supplies runId/generatedAt.
 */
export function buildCleanupReport({ analyses, runId, mode, generatedAt }) {
  const agents = [];
  const skipped = [];
  const census = {
    softConflictsByArchetype: {},
    hardConflictsByArchetype: {},
    hardByClass: { override_hard: 0, category_hard_bundled: 0, category_hard_trait: 0 },
    lurkingHardCarriers: 0,
    dormantHardConflicts: 0,
    reportOnlyTraitConflicts: 0,
  };

  for (const a of analyses) {
    if (a.skipped) {
      skipped.push({
        agentId: a.agentId,
        archetype: a.archetype,
        isTrainingClone: a.isTrainingClone,
        ...a.skipped,
      });
      continue;
    }
    for (const s of a.softConflicts) {
      void s;
      census.softConflictsByArchetype[a.archetype] = (census.softConflictsByArchetype[a.archetype] || 0) + 1;
    }
    for (const h of a.hardConflicts) {
      census.hardConflictsByArchetype[a.archetype] = (census.hardConflictsByArchetype[a.archetype] || 0) + 1;
      census.hardByClass[h.class] += 1;
    }
    census.lurkingHardCarriers += a.lurkingHardCarriers.length;
    census.dormantHardConflicts += a.dormantHardConflicts.length;
    census.reportOnlyTraitConflicts += a.plan.filter((op) => op.op === 'report_only_trait_conflict').length;

    if (a.hardConflicts.length || a.softConflicts.length || a.dormantHardConflicts.length || a.plan.length) {
      agents.push(a);
    }
  }

  return {
    runId,
    mode, // 'dry-run' | 'live'
    generatedAt,
    totals: {
      agentsAnalyzed: analyses.length - skipped.length,
      agentsSkipped: skipped.length,
      agentsWithFindings: agents.length,
      hardConflicts: Object.values(census.hardConflictsByArchetype).reduce((s, n) => s + n, 0),
      softConflicts: Object.values(census.softConflictsByArchetype).reduce((s, n) => s + n, 0),
      plannedWriteOps: agents.reduce(
        (s, a) => s + a.plan.filter((op) => op.op !== 'report_only_trait_conflict').length, 0
      ),
    },
    census,
    agents,
    skipped,
  };
}
