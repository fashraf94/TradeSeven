// src/services/forgeStatsService.js
// Citation aggregation — reads battle evaluation data and computes
// per-bundle and per-rule performance stats for the Forge Stats tab.

import {
  collection, query, where, getDocs, orderBy, limit,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { resolveRuleHardness } from '../components/Forge/workshop/hardSoftHelper';
import { UNAMBIGUOUS_RULE_TO_TRAIT, TRAIT_BY_ID } from '../data/traitLibrary';

/**
 * Reconstruct the C1/S1 positional mapping from a battle's frozen activeRules.
 * MUST mirror the eval prompt's split (agentEvalPromptAssembly.js), because the
 * model cites rules by these positional labels and this map resolves a cited
 * label back to a ruleId. Phase 3: read the RESOLVED hard/soft carried on each
 * snapshot item (override ?? category) — the same single source the eval prompt
 * reads — so labels stay in lockstep. With no override this is the category
 * split; for legacy snapshots lacking the field it falls back to category.
 * (Also corrects a prior drift where mid_battle/game_state were labeled C here
 * but S in the prompt.)
 */
export function buildPositionalMap(activeRules) {
  if (!activeRules || activeRules.length === 0) return {};

  const constraints = activeRules.filter(r => resolveRuleHardness(r, r.hardness) === 'hard');
  const strategies = activeRules.filter(r => resolveRuleHardness(r, r.hardness) !== 'hard');

  const map = {};
  constraints.forEach((r, i) => {
    map[`C${i + 1}`] = {
      ruleId: r.ruleId || r.id,
      text: r.text,
      category: r.category,
      bundleName: r.bundleName,
    };
  });
  strategies.forEach((r, i) => {
    map[`S${i + 1}`] = {
      ruleId: r.ruleId || r.id,
      text: r.text,
      category: r.category || 'general',
      bundleName: r.bundleName,
    };
  });
  return map;
}

/**
 * Fetch battles for the given agent owned by the current user.
 * Limited to 50 most recent battles.
 */
async function fetchBattlesForAgent(agentId) {
  const uid = auth?.currentUser?.uid;
  if (!uid) return [];

  const battlesQ = query(
    collection(db, 'agentBattles'),
    where('ownerId', '==', uid),
    where('agentId', '==', agentId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  const snap = await getDocs(battlesQ);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Scan all evaluations in a battle and tally citations + overrides per rule.
 */
function aggregateBattleCitations(battle, positionalMap) {
  const evals = battle.evaluations || [];
  const tallies = {}; // ruleId -> { followed, blocked, overridden, overrideReasons }

  const ensureTally = (ruleId) => {
    if (!tallies[ruleId]) {
      tallies[ruleId] = {
        followed: 0,
        blocked: 0,
        overridden: 0,
        overrideReasons: {},
      };
    }
  };

  for (const ev of evals) {
    // Cited forge rules
    if (Array.isArray(ev.citedForgeRules)) {
      for (const cite of ev.citedForgeRules) {
        const mapped = positionalMap[cite.ruleId];
        if (!mapped) {
          console.warn(`[forgeStats] Unresolvable ruleId "${cite.ruleId}" in battle ${battle.id}`);
          continue;
        }
        const rId = mapped.ruleId;
        ensureTally(rId);
        if (cite.influence === 'followed') tallies[rId].followed++;
        else if (cite.influence === 'blocked_trade') tallies[rId].blocked++;
      }
    }

    // Overridden forge rules
    if (Array.isArray(ev.overriddenForgeRules)) {
      for (const ovr of ev.overriddenForgeRules) {
        const mapped = positionalMap[ovr.ruleId];
        if (!mapped) continue;
        const rId = mapped.ruleId;
        ensureTally(rId);
        tallies[rId].overridden++;
        if (ovr.reason) {
          tallies[rId].overrideReasons[ovr.reason] =
            (tallies[rId].overrideReasons[ovr.reason] || 0) + 1;
        }
      }
    }
  }

  return { tallies, evalCount: evals.length };
}

/**
 * Main entry point: compute full stats for all bundles across all battles.
 *
 * @param {string} agentId
 * @param {Array} allBundles - all bundles including archived
 * @returns {Object} { global, bundles }
 */
export async function computeForgeStats(agentId, allBundles) {
  const empty = {
    global: { totalBattles: 0, battlesWithRules: 0, totalEvaluations: 0, totalCitations: 0, totalOverrides: 0 },
    bundles: {},
  };

  const battles = await fetchBattlesForAgent(agentId);
  if (battles.length === 0) return empty;

  // Build a ruleId -> bundleId lookup from all bundles' ruleSnapshots
  const ruleToBundleMap = {};
  for (const bundle of allBundles) {
    for (const snap of (bundle.ruleSnapshots || [])) {
      ruleToBundleMap[snap.id] = bundle.id;
    }
  }

  // Initialize per-bundle stats
  const bundleStats = {};
  for (const bundle of allBundles) {
    bundleStats[bundle.id] = {
      bundleId: bundle.id,
      bundleName: bundle.name,
      status: bundle.status,
      battlesEquipped: 0,
      totalEvaluations: 0,
      totalCitations: 0,
      totalOverrides: 0,
      rules: {},
    };
    // Initialize per-rule entries from ruleSnapshots
    for (const snap of (bundle.ruleSnapshots || [])) {
      bundleStats[bundle.id].rules[snap.id] = {
        ruleId: snap.id,
        text: snap.text,
        category: snap.category,
        label: '',  // will be set per-battle
        timesFollowed: 0,
        timesBlocked: 0,
        timesOverridden: 0,
        overrideReasons: {},
      };
    }
  }

  let globalEvals = 0;
  let globalCitations = 0;
  let globalOverrides = 0;
  let battlesWithRules = 0;

  for (const battle of battles) {
    const activeRules = battle.agentContext?.activeRules;
    const equippedIds = battle.agentContext?.equippedBundleIds || [];

    // Skip battles with no forge rules
    if (!activeRules || activeRules.length === 0) continue;
    battlesWithRules++;

    // Mark bundles as equipped for this battle
    for (const bId of equippedIds) {
      if (bundleStats[bId]) {
        bundleStats[bId].battlesEquipped++;
      }
    }

    // Reconstruct positional map and aggregate
    const posMap = buildPositionalMap(activeRules);
    const { tallies, evalCount } = aggregateBattleCitations(battle, posMap);

    // Distribute eval count to equipped bundles
    for (const bId of equippedIds) {
      if (bundleStats[bId]) {
        bundleStats[bId].totalEvaluations += evalCount;
      }
    }
    globalEvals += evalCount;

    // Assign labels from positional map and accumulate tallies
    for (const [label, mapped] of Object.entries(posMap)) {
      const rId = mapped.ruleId;
      const bId = ruleToBundleMap[rId];
      if (bId && bundleStats[bId]?.rules[rId]) {
        // Store the most recent label (labels are stable per battle, last battle wins)
        bundleStats[bId].rules[rId].label = label;
      }
    }

    for (const [ruleId, tally] of Object.entries(tallies)) {
      const bId = ruleToBundleMap[ruleId];
      if (!bId || !bundleStats[bId]?.rules[ruleId]) continue;

      const rStat = bundleStats[bId].rules[ruleId];
      rStat.timesFollowed += tally.followed;
      rStat.timesBlocked += tally.blocked;
      rStat.timesOverridden += tally.overridden;

      for (const [reason, count] of Object.entries(tally.overrideReasons)) {
        rStat.overrideReasons[reason] = (rStat.overrideReasons[reason] || 0) + count;
      }

      const cited = tally.followed + tally.blocked;
      bundleStats[bId].totalCitations += cited;
      bundleStats[bId].totalOverrides += tally.overridden;
      globalCitations += cited;
      globalOverrides += tally.overridden;
    }
  }

  return {
    global: {
      totalBattles: battles.length,
      battlesWithRules,
      totalEvaluations: globalEvals,
      totalCitations: globalCitations,
      totalOverrides: globalOverrides,
    },
    bundles: bundleStats,
  };
}

/**
 * Phase 1B — read-side attribution. Roll up a SINGLE battle's cited forge rules
 * to the trait CARD that owns them, for a post-battle tag like
 * "Your Iron Discipline shaped 4 decisions this battle."
 *
 * Honest + partial by design — a card is credited only when attribution is
 * CERTAIN:
 *   - the cited rule maps to exactly one library trait (UNAMBIGUOUS_RULE_TO_TRAIT);
 *     shared rules (th-01, mb-08) are never attributed.
 *   - the cited rule was injected as a TRAIT/identity rule (no bundleName in the
 *     frozen snapshot), so a same-id rule that came from a manual bundle is not
 *     credited to a card.
 * Does NOT carry traitId on the snapshot (that would touch the fenced
 * projectActiveRules — the MEDIUM version we declined).
 *
 * @param {Object} battle - an agentBattles doc (reads agentContext.activeRules + evaluations)
 * @returns {Array<{ traitId:string, traitName:string, decisions:number }>} sorted desc by decisions
 */
export function computeBattleTraitAttribution(battle) {
  const activeRules = battle?.agentContext?.activeRules;
  const posMap = buildPositionalMap(activeRules);
  if (Object.keys(posMap).length === 0) return [];

  const { tallies } = aggregateBattleCitations(battle, posMap);

  // ruleId → bundleName from the frozen snapshot. Trait/identity rules carry no
  // bundleName; a manual-bundle rule does — we only attribute the former.
  const ruleIdToBundleName = {};
  for (const mapped of Object.values(posMap)) ruleIdToBundleName[mapped.ruleId] = mapped.bundleName;

  const byTrait = {};
  for (const [ruleId, tally] of Object.entries(tallies)) {
    const traitId = UNAMBIGUOUS_RULE_TO_TRAIT[ruleId];
    if (!traitId) continue;                     // shared / non-trait ruleId → omit
    if (ruleIdToBundleName[ruleId]) continue;   // originated from a manual bundle → omit
    const decisions = (tally.followed || 0) + (tally.blocked || 0);
    if (decisions <= 0) continue;
    if (!byTrait[traitId]) {
      byTrait[traitId] = { traitId, traitName: TRAIT_BY_ID[traitId]?.name || traitId, decisions: 0 };
    }
    byTrait[traitId].decisions += decisions;
  }
  return Object.values(byTrait).sort((a, b) => b.decisions - a.decisions);
}
