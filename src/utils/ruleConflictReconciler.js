// src/utils/ruleConflictReconciler.js
//
// THE canonical, deterministic declarative-constraint reconciler for the agent
// (BaggerBomb) rule system. ONE pure module, shared by BOTH paths:
//   * equip time  — src/services/forgeService.equipBundle calls reconcile() for
//                   DETECTION/shadow only (writes bundle.conflictCheckResult,
//                   powers the equip-time warning). Gated by
//                   CONFLICT_RECONCILER_DETECT_ENABLED.
//   * deploy time — api/agent/decide.js will call reconcile() to RESOLVE before
//                   the rules reach the cognition prompt (Phase 2, fence-gated,
//                   CONFLICT_RECONCILER_INJECT_ENABLED). NOT wired here.
//
// WHY one module: parallel detection/resolution paths that drift are the
// VWAP/baseline bug class. The frontend imports this natively; api/ imports it
// cross-boundary (BUILD_RULES §4) — which is why this file MUST stay Node-clean
// (NO react, NO firebase, NO browser globals). The test file's import of this
// module IS the runtime dependency-surface guard (it explodes in the Node test
// env if a browser dep enters the graph) and must NEVER be mocked.
//
// The module is PURE: no I/O, no throws to the caller (fail-open but loud — see
// reconcile()). Inputs are plain rule objects; outputs are plain data.

// ─── Versioning & traceability ────────────────────────────────────────────
// Bump on any change to detection/resolution LOGIC (not on cosmetic edits).
// Stamped into conflictCheckResult / the battle context for staleness detection.
export const RECONCILER_VERSION = 1;

// ─── Hardness source-of-truth (test-pinned; see breadcrumb) ─────────────────
// A rule is "hard" (must-obey) iff its category is in this set; everything else
// is a soft preference. The same {risk, allocation} set is independently
// maintained by the codebase's two PRE-EXISTING hardness sources (a documented,
// lockstep-noted duplication — NEITHER is fenced):
//   • api/_utils/ruleHardness.js:23  (server: the strategy/eval/projection path)
//   • src/components/Forge/workshop/hardSoftHelper.js:28  (client: Forge display)
// A divergence would let the reconciler tiebreak hard-over-soft on a hardness
// the prompt does not actually apply — a SILENT wrong resolution (no error).
// This reconciler copy is value-pinned by ruleConflictReconciler.test.js.
// Collapsing all three into one dependency-free constant that each imports is a
// NON-fence cleanup (the fenced assembly files already delegate to
// ruleHardness.js's isHardRule, so they need no edit) — see
// RULE_CONFLICT_RECONCILER_POST_LAUNCH_BACKLOG.md.
export const HARD_CATEGORIES = new Set(['risk', 'allocation']);

// Provenance values we recognize. Anything else (or missing) → legacy default
// tier, flagged tierAssumed so an untagged rule never loses silently.
const PROVENANCE_TIER = {
  user_equipped: 1, // user-deliberate
  archetype_default: 2, // built-in identity (archetype/seeded defaults, StarterKit)
};

// ─── Contradiction-descriptor table ────────────────────────────────────────
// Keyed by sourceRef (the forge template id). Built from the param-bearing
// risk/allocation templates in src/data/forgeKnowledgeBase.js. Defaults are
// duplicated here (not imported) to keep this module self-contained & Node-clean.
//
//   dimension     — rules only conflict within the same dimension.
//   operator      — 'cap'/'max' (upper bound), 'floor'/'min' (lower bound),
//                   'stop' (ATR multiplier, negative; tighter = closer to 0),
//                   'eq' (exact target).
//   safetyRole    — 'limiting' (reduces risk: caps, position maxes, stops, a
//                   liquidity floor) vs 'forcing' (forces allocation: a sector
//                   floor). Used by the safer-direction tiebreaker across
//                   operators: a limiting rule is safer than a forcing one.
//   saferDirection— within the SAME operator, which value is safer/binds.
//   valueParam/valueDefault — where the comparable number lives in paramValues.
//   scopeParam/scopeDefault — what the rule applies to (the sector, etc.);
//                   'any single' normalizes to the wildcard '*' (all sectors).
//
// Templates with no opposing operator today (single-stock max, ATR stop) can
// only ever CONSOLIDATE (duplicate-binds) — contradiction is vacuous-until-added.
const DESCRIPTOR_TABLE = {
  'alloc-sector-cap': {
    dimension: 'sector_exposure',
    operator: 'cap',
    safetyRole: 'limiting',
    saferDirection: 'lower',
    valueParam: 'pct',
    valueDefault: 40,
    scopeParam: 'sector',
    scopeDefault: 'any single',
  },
  'alloc-sector-minimum': {
    dimension: 'sector_exposure',
    operator: 'floor',
    safetyRole: 'forcing', // a forced minimum is the riskier side of a contradiction
    saferDirection: 'lower', // less forced concentration is safer (the counterintuitive one)
    valueParam: 'pct',
    valueDefault: 20,
    scopeParam: 'sector',
    scopeDefault: 'Technology',
  },
  'risk-single-stock-limit': {
    dimension: 'single_position',
    operator: 'max',
    safetyRole: 'limiting',
    saferDirection: 'lower',
    valueParam: 'pct',
    valueDefault: 40,
    scopeParam: null,
    scopeDefault: 'single_stock',
  },
  'risk-exit-atr-stop': {
    dimension: 'stop_loss',
    operator: 'stop',
    safetyRole: 'limiting',
    saferDirection: 'tighter',
    valueParam: 'multiplier',
    valueDefault: -2,
    scopeParam: null,
    scopeDefault: 'portfolio',
  },
};

const UPPER_OPS = new Set(['cap', 'max']);
const LOWER_OPS = new Set(['floor', 'min']);

// ─── Small pure helpers ─────────────────────────────────────────────────────

function provenanceToTier(provenance, legacyDefaultTier) {
  const t = PROVENANCE_TIER[provenance];
  return t == null ? legacyDefaultTier : t;
}

// A stable, dependency-free 32-bit FNV-1a hash of a string. Used for
// activeRuleSetHash (traceability/staleness) — NOT security-sensitive, so a
// tiny pure hash is preferable to pulling in node:crypto (which is not
// browser-clean and would break the dual-path import).
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function normalizeScope(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s.toLowerCase() === 'any single' || s === '*') return '*';
  return s;
}

// Resolve the static descriptor for a rule from its sourceRef, filling in the
// live value/scope from paramValues (falling back to the template default).
function resolveDescriptor(sourceRef, paramValues) {
  const base = DESCRIPTOR_TABLE[sourceRef];
  if (!base) return null;
  const pv = paramValues || {};
  const rawValue = base.valueParam != null && pv[base.valueParam] != null
    ? pv[base.valueParam]
    : base.valueDefault;
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return null; // unparseable param → treat as unchecked
  const rawScope = base.scopeParam != null && pv[base.scopeParam] != null
    ? pv[base.scopeParam]
    : base.scopeDefault;
  return {
    dimension: base.dimension,
    operator: base.operator,
    safetyRole: base.safetyRole,
    saferDirection: base.saferDirection,
    value,
    scope: normalizeScope(rawScope),
  };
}

// Normalize one input rule (from either path) into the reconciler's internal
// shape. Provenance/category/sourceRef are read from the projected item first,
// then from the joined rule doc — so the equip path (provenance carried on the
// snapshot) and the deploy path (provenance recovered from raw ruleDocs) share
// one normalizer.
function toInternalRule(item, ruleDocsById, legacyDefaultTier, index) {
  const id = item.ruleId ?? item.id;
  const docMatch = ruleDocsById.get(id) || {};
  const provenance = item.provenance ?? docMatch.provenance ?? null;
  const category = item.category ?? docMatch.category ?? null;
  const sourceRef = item.sourceRef ?? docMatch.sourceRef ?? docMatch.source ?? null;
  const paramValues = item.paramValues ?? docMatch.paramValues ?? null;
  const tier = provenanceToTier(provenance, legacyDefaultTier);
  const tierAssumed = PROVENANCE_TIER[provenance] == null; // missing/unknown → defaulted

  // Recency signal for the total tiebreaker's final fallback. equippedAt may be
  // a ms-epoch (trait entries) or absent; when absent we fall back to input
  // order via `index` (later = more recent), keeping the reconciler total.
  let equippedAt = item.equippedAt ?? docMatch.equippedAt ?? null;
  if (typeof equippedAt !== 'number') equippedAt = null;

  return {
    ruleId: id,
    sourceRef,
    text: item.text ?? docMatch.text ?? '',
    category,
    hardness: HARD_CATEGORIES.has(category) ? 'hard' : 'soft',
    tier,
    tierAssumed,
    equippedAt,
    index,
    descriptor: resolveDescriptor(sourceRef, paramValues),
  };
}

// Do two same-dimension rules apply to overlapping scope?
function scopesInteract(a, b) {
  const sa = a.descriptor.scope;
  const sb = b.descriptor.scope;
  if (sa === sb) return true;
  // A wildcard sector cap ('any single') applies to every sector, so it
  // interacts with any specific-sector rule of the same dimension.
  return sa === '*' || sb === '*';
}

// Which rule is the MORE-CONSTRAINING one (the binding rule a consolidation
// keeps) for two same-operator rules. Lower cap / higher floor / tighter stop.
function moreConstraining(a, b) {
  const op = a.descriptor.operator;
  const va = a.descriptor.value;
  const vb = b.descriptor.value;
  if (UPPER_OPS.has(op)) return va <= vb ? a : b; // lower upper-bound binds
  if (LOWER_OPS.has(op)) return va >= vb ? a : b; // higher lower-bound binds
  if (op === 'stop') return Math.abs(va) <= Math.abs(vb) ? a : b; // tighter (closer to 0)
  return a; // eq or unknown — no meaningful "more constraining"
}

// Classify a same-dimension, scope-interacting pair.
//   'satisfiable'   — both can hold; not a conflict (do not flag).
//   'consolidation' — same operator, one stricter binds, the other is redundant.
//   'contradiction' — no valid intersection; must drop a side.
function classifyPair(a, b) {
  const da = a.descriptor;
  const db = b.descriptor;
  const sameOp = da.operator === db.operator;

  if (sameOp) {
    if (da.operator === 'eq') {
      return da.value === db.value ? 'satisfiable' : 'contradiction';
    }
    return da.value === db.value ? 'satisfiable' : 'consolidation';
  }

  // Opposing bounded operators on the same dimension: intersection exists iff
  // the upper bound is >= the lower bound.
  const aUpper = UPPER_OPS.has(da.operator);
  const bUpper = UPPER_OPS.has(db.operator);
  const aLower = LOWER_OPS.has(da.operator);
  const bLower = LOWER_OPS.has(db.operator);
  if ((aUpper && bLower) || (aLower && bUpper)) {
    const upper = aUpper ? a : b;
    const lower = aLower ? a : b;
    return upper.descriptor.value < lower.descriptor.value ? 'contradiction' : 'satisfiable';
  }

  // Any other cross-operator mix (e.g. stop vs cap) has no defined contradiction
  // in V1 — treat as satisfiable (vacuous-until-added).
  return 'satisfiable';
}

// The TOTAL tiebreaker chain for a contradiction. Returns the winner, the
// loser, and which rule fired. Always terminates (recency/index is total).
function tiebreak(a, b) {
  // 1. higher tier wins (tier 1 = user-deliberate beats tier 2 = default)
  if (a.tier !== b.tier) {
    return { winner: a.tier < b.tier ? a : b, loser: a.tier < b.tier ? b : a, ruleApplied: 'tier' };
  }
  // 2. hard beats soft (ahead of direction — a soft lean never displaces a
  //    same-tier hard rule)
  const aHard = a.hardness === 'hard';
  const bHard = b.hardness === 'hard';
  if (aHard !== bHard) {
    return { winner: aHard ? a : b, loser: aHard ? b : a, ruleApplied: 'hard_over_soft' };
  }
  // 3. safer-direction. Across operators: a limiting rule is safer than a
  //    forcing one. Within the same operator: the safer value (per descriptor).
  const saferByRole = safetyRoleWinner(a, b);
  if (saferByRole) return { ...saferByRole, ruleApplied: 'safer_direction' };
  const saferByValue = saferValueWinner(a, b);
  if (saferByValue) return { ...saferByValue, ruleApplied: 'safer_direction' };
  // 4. most-recently-equipped wins (final fallback → reconciler is total).
  const aMoreRecent = isMoreRecent(a, b);
  return {
    winner: aMoreRecent ? a : b,
    loser: aMoreRecent ? b : a,
    ruleApplied: 'tie_fallback',
  };
}

function safetyRoleWinner(a, b) {
  const ra = a.descriptor.safetyRole;
  const rb = b.descriptor.safetyRole;
  if (ra === rb) return null;
  if (ra === 'limiting' && rb === 'forcing') return { winner: a, loser: b };
  if (rb === 'limiting' && ra === 'forcing') return { winner: b, loser: a };
  return null;
}

function saferValueWinner(a, b) {
  // Only meaningful for same-operator pairs.
  if (a.descriptor.operator !== b.descriptor.operator) return null;
  const dir = a.descriptor.saferDirection;
  const va = a.descriptor.value;
  const vb = b.descriptor.value;
  if (va === vb) return null;
  if (dir === 'lower') return { winner: va < vb ? a : b, loser: va < vb ? b : a };
  if (dir === 'higher') return { winner: va > vb ? a : b, loser: va > vb ? b : a };
  if (dir === 'tighter') {
    return { winner: Math.abs(va) < Math.abs(vb) ? a : b, loser: Math.abs(va) < Math.abs(vb) ? b : a };
  }
  return null;
}

function isMoreRecent(a, b) {
  if (a.equippedAt != null && b.equippedAt != null && a.equippedAt !== b.equippedAt) {
    return a.equippedAt > b.equippedAt;
  }
  // Fall back to input order: later in the array = more recently equipped.
  return a.index > b.index;
}

// ─── Plain-English reasons (Phase-3 surfacing copy lives downstream, but the
//     report carries a ready sentence). "ignored," never "dropped." ──────────
function consolidationReason(winner, loser) {
  return `The tighter limit applies — kept "${winner.text}" and folded in "${loser.text}".`;
}

function contradictionReason(winner, loser, ruleApplied) {
  const why = {
    tier: winner.tier < loser.tier
      ? 'it is your deliberate rule and the other is a built-in default'
      : 'of source priority',
    hard_over_soft: 'it is a must-obey rule and the other is a soft preference',
    safer_direction: 'it is the safer constraint',
    tie_fallback: 'it was equipped more recently',
  }[ruleApplied] || 'of precedence';
  return `Kept "${winner.text}"; ignored "${loser.text}" for this battle because both can't hold at once — ${why}.`;
}

// ─── Main entry point ───────────────────────────────────────────────────────

/**
 * Reconcile contradictory declarative constraints.
 *
 * FAIL-OPEN BUT LOUD: never throws to the caller. On any internal error it
 * returns the inputs untouched as `resolvedRules` plus a `reconcilerError`
 * string — so a deploy is NEVER blocked. The caller is responsible for being
 * loud about a non-null reconcilerError (telemetry + degraded indicator, and a
 * hard test failure in CI).
 *
 * @param {Array<Object>} projectedRules - the active rule items (equip path:
 *   bundle snapshots carrying provenance+sourceRef; deploy path: projected
 *   activeRules). Each: { ruleId|id, text, category, sourceRef?, provenance?,
 *   paramValues?, equippedAt? }.
 * @param {Array<Object>} [ruleDocs] - raw rule docs (deploy path) joined by id
 *   to recover provenance/sourceRef WITHOUT touching the fenced projection.
 *   Pass [] when the projected items already carry provenance (equip path).
 * @param {Array<Object>} [equippedTraits] - the equipped trait loadout. In V1
 *   tier comes from provenance, so traits feed only the activeRuleSetHash
 *   (staleness/traceability); reserved for richer trait-tier logic in Phase 2+.
 * @param {Object} [opts]
 * @param {number} [opts.legacyDefaultTier=2] - tier for missing/unknown provenance.
 * @returns {{ resolvedRules, conflictReport, coverage, reconcilerError?,
 *   reconcilerVersion, activeRuleSetHash }}
 */
export function reconcile(projectedRules, ruleDocs = [], equippedTraits = [], opts = {}) {
  const legacyDefaultTier = opts.legacyDefaultTier ?? 2;
  const input = Array.isArray(projectedRules) ? projectedRules : [];

  // Hash the input up front so traceability survives even an error pass-through.
  const activeRuleSetHash = hashRuleSet(input, legacyDefaultTier, equippedTraits);
  const base = {
    resolvedRules: input,
    conflictReport: [],
    coverage: emptyCoverage(),
    reconcilerVersion: RECONCILER_VERSION,
    activeRuleSetHash,
  };

  try {
    const ruleDocsById = new Map((ruleDocs || []).map((d) => [d.id ?? d.ruleId, d]));
    const internal = input.map((item, i) => toInternalRule(item, ruleDocsById, legacyDefaultTier, i));

    // Coverage: descriptor-covered rules are CHECKED; the rest (custom/free-text)
    // are UNCHECKED — the structured detector cannot see them. Drives the
    // coverage-honest "no conflicts among checked rules" language.
    const checked = internal.filter((r) => r.descriptor != null);
    const coverage = {
      checkedRuleIds: checked.map((r) => r.ruleId),
      uncheckedRuleIds: internal.filter((r) => r.descriptor == null).map((r) => r.ruleId),
      checkedCount: checked.length,
      uncheckedCount: internal.length - checked.length,
    };

    const conflictReport = detectAndResolve(checked);

    // resolvedRules = input minus every loser (by ruleId), order preserved.
    const loserIds = new Set();
    for (const entry of conflictReport) {
      for (const l of entry.losers) loserIds.add(l.ruleId);
    }
    const resolvedRules = loserIds.size === 0
      ? input
      : input.filter((item) => !loserIds.has(item.ruleId ?? item.id));

    return {
      resolvedRules,
      conflictReport,
      coverage,
      reconcilerVersion: RECONCILER_VERSION,
      activeRuleSetHash,
    };
  } catch (err) {
    // Fail-open: hand back the untouched input, but surface the error loudly.
    return { ...base, reconcilerError: err && err.message ? err.message : String(err) };
  }
}

/**
 * Deploy-time seam helper (Phase 2). Wraps reconcile() with the INJECT gate and
 * the fail-open fallback so the fenced caller (api/agent/decide.js) stays a
 * single call. PURE & deterministic (no I/O, no timestamps) — fully unit-tested
 * in the Node env, which keeps the actual fence edit to a thin call-site.
 *
 * - INJECT OFF → returns the raw projected rules untouched and report:null, so
 *   the deploy path is byte-identical to pre-reconciler behavior (no reconcile
 *   call at all).
 * - INJECT ON  → returns resolvedRules, or — on a reconciler error — the raw
 *   projected rules (fail-open, deploy never blocked), plus a `report` object
 *   for server-side capture/surfacing (the caller stamps any timestamp).
 *
 * @param {Array<Object>} projected - the projected activeRules.
 * @param {Array<Object>} [ruleDocs] - raw rule docs to recover provenance.
 * @param {Array<Object>} [equippedTraits] - equipped trait loadout.
 * @param {Object} [opts]
 * @param {boolean} [opts.inject=false] - the CONFLICT_RECONCILER_INJECT_ENABLED gate.
 * @param {number} [opts.legacyDefaultTier=2]
 * @returns {{ activeRules: Array<Object>, report: Object|null, reconcilerError: string|null }}
 */
export function resolveForDeploy(projected, ruleDocs = [], equippedTraits = [], opts = {}) {
  if (!opts.inject) {
    return { activeRules: projected, report: null, reconcilerError: null };
  }
  const result = reconcile(projected, ruleDocs, equippedTraits, {
    legacyDefaultTier: opts.legacyDefaultTier ?? 2,
  });
  const reconcilerError = result.reconcilerError || null;
  return {
    activeRules: reconcilerError ? projected : result.resolvedRules,
    reconcilerError,
    report: {
      conflicts: result.conflictReport,
      coverage: result.coverage,
      reconcilerVersion: result.reconcilerVersion,
      activeRuleSetHash: result.activeRuleSetHash,
      reconcilerError,
      injected: !reconcilerError,
    },
  };
}

function emptyCoverage() {
  return { checkedRuleIds: [], uncheckedRuleIds: [], checkedCount: 0, uncheckedCount: 0 };
}

function hashRuleSet(input, legacyDefaultTier, equippedTraits) {
  try {
    const canon = input.map((r) => ({
      id: r.ruleId ?? r.id ?? null,
      src: r.sourceRef ?? null,
      prov: r.provenance ?? null,
      cat: r.category ?? null,
      pv: r.paramValues ?? null,
    }));
    const traits = (equippedTraits || [])
      .map((t) => `${t && t.traitId}:${t && t.strength}`)
      .sort();
    return fnv1a(`${legacyDefaultTier}|${JSON.stringify(canon)}|${traits.join(',')}`);
  } catch {
    return '00000000';
  }
}

// Detect conflicts pairwise within each dimension, classify, and resolve.
// Pairwise keeps the logic simple and total; a duplicate group of N yields
// N-choose-2 entries but the loser set (hence resolvedRules) is still correct.
function detectAndResolve(checked) {
  const report = [];
  for (let i = 0; i < checked.length; i += 1) {
    for (let j = i + 1; j < checked.length; j += 1) {
      const a = checked[i];
      const b = checked[j];
      if (a.descriptor.dimension !== b.descriptor.dimension) continue;
      if (!scopesInteract(a, b)) continue;

      const rel = classifyPair(a, b);
      if (rel === 'satisfiable') continue;

      if (rel === 'consolidation') {
        const winner = moreConstraining(a, b);
        const loser = winner === a ? b : a;
        report.push(buildEntry('consolidation', 'consolidation', winner, [loser], [a, b],
          consolidationReason(winner, loser)));
      } else {
        // contradiction
        const { winner, loser, ruleApplied } = tiebreak(a, b);
        report.push(buildEntry('contradiction', ruleApplied, winner, [loser], [a, b],
          contradictionReason(winner, loser, ruleApplied)));
      }
    }
  }
  return report;
}

function buildEntry(outcomeClass, ruleApplied, winner, losers, items, reason) {
  return {
    dimension: winner.descriptor.dimension,
    outcomeClass, // 'consolidation' | 'contradiction' | 'tie_fallback'-bearing
    ruleApplied, // 'tier' | 'hard_over_soft' | 'safer_direction' | 'tie_fallback' | 'consolidation'
    winner: publicRule(winner),
    losers: losers.map(publicRule),
    items: items.map(publicRule),
    reason,
  };
}

function publicRule(r) {
  return {
    ruleId: r.ruleId,
    sourceRef: r.sourceRef,
    text: r.text,
    tier: r.tier,
    tierAssumed: r.tierAssumed,
    hardness: r.hardness,
    value: r.descriptor ? r.descriptor.value : null,
  };
}
