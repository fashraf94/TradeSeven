// src/utils/conflictSurfaceCopy.js
//
// PURE copy / view-model builders for the Rule Conflict Reconciler surfacing
// (Phase 3). No React, no I/O — unit-tested directly and shared by the runtime
// panel (ConflictResolutionPanel) and the equip-time toast (useForge), so the
// copy rules live in ONE place.
//
// Phase-3 copy rules enforced here:
//  - Never "dropped"/"deleted"/"removed" — a losing rule still exists; it lost
//    THIS resolution. Contradictions say kept / "set aside for this battle".
//  - A consolidation is a MERGE ("the tighter limit applies"), not a loss.
//  - Coverage-honest: never an unqualified "no conflicts found".
//  - Assumed-tier disclosure with the re-equip self-heal hint.
//  - Degraded state is never a false all-clear.
//
// The per-conflict cause-and-effect sentence is the reconciler's `reason` (also
// rule-compliant); this module composes prominence, the assumed-tier /
// coverage / degraded disclosures, and the bundle-scoped equip warning.

// Exported for the banned-verb guard test.
export const BANNED_VERBS = ['dropped', 'deleted', 'removed'];

function pluralRules(n) {
  return `${n} custom rule${n === 1 ? '' : 's'}`;
}

// Rule 5 — assumed-tier disclosure. Returns the self-heal note naming EVERY
// participant (winner or any loser) that had no source tag, else null. An
// untagged rule must never lose silently — so if both sides are untagged, both
// are named (not just the first).
export function assumedTierNote(entry) {
  const participants = [entry && entry.winner, ...((entry && entry.losers) || [])].filter(Boolean);
  const assumed = participants.filter((r) => r && r.tierAssumed);
  if (assumed.length === 0) return null;
  const names = assumed.map((r) => `"${r.text}"`);
  const list = names.length === 1
    ? names[0]
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const multi = names.length > 1;
  return `Note: ${list} had no source tag, so ${multi ? 'they were' : 'it was'} treated as `
    + `${multi ? 'built-in defaults' : 'a built-in default'}. If you set ${multi ? 'them' : 'it'} `
    + `deliberately, re-equip ${multi ? 'them' : 'it'} to give ${multi ? 'them' : 'it'} priority.`;
}

// Rule 4 — coverage-honest line. Never an unqualified "no conflicts found".
function coverageLine(hasContradictions, uncheckedCount) {
  if (hasContradictions) {
    // Conflicts are shown above; only add the unchecked caveat when relevant.
    return uncheckedCount > 0 ? `${pluralRules(uncheckedCount)} couldn't be auto-checked.` : null;
  }
  if (uncheckedCount > 0) {
    return `No conflicts among your checked rules. ${pluralRules(uncheckedCount)} couldn't be auto-checked.`;
  }
  return 'No conflicts found among your rules.';
}

/**
 * Runtime panel view-model (Surface 2). Returns null when there is NO report at
 * all (INJECT off / pre-deploy) so the surface renders nothing (invisibility).
 *
 * @param {Object|null|undefined} report - agent.lastConflictReport:
 *   { conflicts:[entry], coverage, reconcilerError?, reconcilerVersion, checkedAt }
 * @returns {null | {
 *   degraded:boolean, degradedText:string|null,
 *   prominent:[{text, recency, note}], quiet:[{text}],
 *   coverageText:string|null, unchecked:string[]
 * }}
 */
export function buildConflictSurface(report) {
  if (!report) return null; // invisibility — nothing to show

  // Rule 6 — degraded, never a false all-clear.
  if (report.reconcilerError) {
    return {
      degraded: true,
      degradedText: "Conflict check couldn't complete for this deploy — your agent is "
        + "running on its raw rules. We've logged it.",
      prominent: [],
      quiet: [],
      coverageText: null,
      unchecked: [],
    };
  }

  const conflicts = Array.isArray(report.conflicts) ? report.conflicts : [];
  const coverage = report.coverage || {};
  const uncheckedCount = coverage.uncheckedCount || 0;

  // A recency tie-break is encoded as outcomeClass 'contradiction' +
  // ruleApplied 'tie_fallback'; both render prominently (Rule 3).
  const contradictions = conflicts.filter((e) => e && e.outcomeClass === 'contradiction');
  const consolidations = conflicts.filter((e) => e && e.outcomeClass === 'consolidation');

  return {
    degraded: false,
    degradedText: null,
    prominent: contradictions.map((e) => ({
      text: e.reason,
      recency: e.ruleApplied === 'tie_fallback',
      note: assumedTierNote(e),
    })),
    quiet: consolidations.map((e) => ({ text: e.reason })),
    coverageText: coverageLine(contradictions.length > 0, uncheckedCount),
    unchecked: Array.isArray(coverage.uncheckedRuleIds) ? coverage.uncheckedRuleIds : [],
  };
}

/**
 * Equip-time toast (Surface 1). Bundle-scoped — must NOT claim agent-wide or
 * exhaustive coverage (Rule 7). Returns a single warning string when this
 * bundle has a contradiction, else null (no toast; consolidations are quiet at
 * equip, and a detection error stays silent rather than showing a false
 * warning or a false all-clear — the normal "equipped" toast still fires).
 *
 * @param {Object|null|undefined} conflictCheckResult - bundle.conflictCheckResult
 *   { conflicts:[entry], coverage, reconcilerError?, ... } (null when DETECT off)
 * @returns {string|null}
 */
export function buildEquipWarning(conflictCheckResult) {
  if (!conflictCheckResult || conflictCheckResult.reconcilerError) return null;
  const conflicts = Array.isArray(conflictCheckResult.conflicts) ? conflictCheckResult.conflicts : [];
  const n = conflicts.filter((e) => e && e.outcomeClass === 'contradiction').length;
  if (n === 0) return null;
  // Count-honest (one contradiction = two rules; more than one = "several"),
  // and intentionally CONCISE — the full kept/set-aside reason lives in the
  // runtime "Rule check" panel (Surface 2). A single short caution avoids
  // overflowing the toast and does not claim agent-wide coverage (Rule 7).
  const subject = n === 1 ? 'two rules' : 'several rules';
  return `⚠️ Heads up — ${subject} in this bundle conflict. Your agent keeps the stricter `
    + 'rule in battle and sets the other aside. (Checked this bundle only.)';
}
