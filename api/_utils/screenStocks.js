// api/_utils/screenStocks.js
//
// Research Engine — Phase 1: deterministic filter core.
//
// Pure, dependency-free screening over the daily `indexIntelligence/stockRankings`
// universe. The caller reads the `stocks[]` array from Firestore and passes it in; this
// module never touches the network, a model, or Firestore, so it is fully deterministic
// and unit-testable.
//
// `screenStocks(stocks, screenSpec)` validates the spec against an inline allowlist
// (api/ cannot import from src/, and the calibration-fence scoring modules are off
// limits — so the allowlist, archetype keys and momentum-factor keys are defined here),
// applies AND-combined filters, sorts by one rank key, slices to a limit, and projects
// each survivor into a value-carrying result that mirrors the source stock shape. The
// result set is therefore a self-contained, serializable artifact — the seam that makes
// the later "save" (Phase 4) and "analyze" (Phase 5) rungs cheap to add.
//
// Honesty discipline: any predicate naming an absent field, an unsupported op, or a
// malformed value is DROPPED and reported in `rejectedFilters[]` — never silently
// applied, never silently ignored.

// ── Allowlist (inline; mirrors the persisted stock shape) ────────────────────────────

// Top-level scalar / categorical / boolean fields written per stock in
// api/cron/compute-index-intelligence.js:930-965 (+ baggerBombRank mutated on at :971).
export const SCALAR_FIELDS = Object.freeze(new Set([
  'symbol', 'sectorId', 'sectorName',
  'fundamentalScore', 'fundamentalRank',
  'technicalScore', 'technicalRank', 'sectorTechnicalRank', 'sectorTechnicalTotal',
  'compositeScore', 'baggerBombFit', 'baggerBombRank',
  'atrPercentile', 'dailyRange', 'nr7Flag', 'bBandwidthPercentile',
  'momentumScore', 'momentumRank', 'sma200_position', 'trend', 'recentAction',
]));

// The 6 archetype keys under `arch_scores` (compute-index-intelligence.js:47).
export const ARCH_KEYS = Object.freeze([
  'momentum_chaser', 'contrarian', 'diversifier', 'degen', 'analyst', 'guardian',
]);

// The 12 keys under `momentumFactors` (momentumScoring.js:553-566).
export const MOMENTUM_KEYS = Object.freeze([
  'residualMomentum', 'intermediateRS', 'acceleration', 'turnoverMom', 'fip', 'ker',
  'stability', 'heat', 'quality', 'overextensionPenalty', 'momentumBreakPenalty',
  'peadAdjustment',
]);

// Namespaces addressable via dot-path (`arch_scores.degen`, `momentumFactors.heat`).
export const NESTED_NAMESPACES = Object.freeze({
  arch_scores: Object.freeze(new Set(ARCH_KEYS)),
  momentumFactors: Object.freeze(new Set(MOMENTUM_KEYS)),
});

export const SUPPORTED_OPS = Object.freeze(new Set([
  'gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'in', 'between', 'isTrue', 'isFalse',
]));

// Always carried on every result so the artifact is self-describing even when a query
// references none of them (spec §5 baseline). All flat scalars.
export const BASELINE_FIELDS = Object.freeze([
  'symbol', 'sectorName', 'compositeScore', 'baggerBombFit', 'momentumScore',
]);

export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 25;

// ── Pure helpers (exported for direct unit testing) ──────────────────────────────────

/**
 * True only for an allowlisted field. Scalars match directly; a single-dot path matches
 * only when the namespace is known AND the sub-key is in that namespace's set.
 *   compositeScore ✓ · arch_scores.degen ✓ · momentumFactors.heat ✓
 *   arch_scores ✗ (bare) · arch_scores.bogus ✗ · pe_ratio ✗ · a.b.c ✗
 */
export function isAllowedField(field) {
  if (typeof field !== 'string' || field.length === 0) return false;
  const dot = field.indexOf('.');
  if (dot === -1) return SCALAR_FIELDS.has(field);
  const ns = field.slice(0, dot);
  const key = field.slice(dot + 1);
  if (!ns || !key || key.includes('.')) return false;
  // hasOwnProperty guard so inherited names (constructor, __proto__, …) never resolve.
  const allowed = Object.prototype.hasOwnProperty.call(NESTED_NAMESPACES, ns)
    ? NESTED_NAMESPACES[ns]
    : null;
  return allowed instanceof Set ? allowed.has(key) : false;
}

/**
 * Dot-path-aware value read. Returns `undefined` on any missing hop (including the empty
 * `arch_scores: {}` and `momentumFactors: null` cases the source doc produces).
 */
export function resolveField(stock, field) {
  if (stock == null || typeof field !== 'string') return undefined;
  const dot = field.indexOf('.');
  if (dot === -1) return stock[field];
  const ns = field.slice(0, dot);
  const key = field.slice(dot + 1);
  const parent = stock[ns];
  if (parent == null || typeof parent !== 'object') return undefined;
  return parent[key];
}

/**
 * Evaluate one predicate. A null/undefined field value fails EVERY op — a stock missing
 * the referenced field cannot satisfy a filter on it (mirrors RankingsView.jsx:93).
 * Numeric ops never throw: a non-numeric operand simply yields no match.
 */
export function evaluateOp(op, fieldValue, specValue) {
  if (fieldValue == null) return false;

  switch (op) {
    case 'isTrue':  return fieldValue === true;
    case 'isFalse': return fieldValue === false;
    case 'eq':      return looseEquals(fieldValue, specValue);
    case 'neq':     return !looseEquals(fieldValue, specValue);
    case 'in':      return Array.isArray(specValue) && specValue.some(v => looseEquals(fieldValue, v));
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const a = Number(fieldValue);
      const b = Number(specValue);
      if (Number.isNaN(a) || Number.isNaN(b)) return false;
      if (op === 'gt') return a > b;
      if (op === 'gte') return a >= b;
      if (op === 'lt') return a < b;
      return a <= b;
    }
    case 'between': {
      if (!Array.isArray(specValue) || specValue.length !== 2) return false;
      const a = Number(fieldValue);
      const lo = Number(specValue[0]);
      const hi = Number(specValue[1]);
      if (Number.isNaN(a) || Number.isNaN(lo) || Number.isNaN(hi)) return false;
      return a >= lo && a <= hi;
    }
    default:
      return false; // unsupported ops are rejected at validation time; this is belt-and-braces
  }
}

// Numeric comparison when BOTH operands are finite-numeric (and non-empty, non-boolean,
// non-null); otherwise strict equality. Lets `fundamentalRank eq 1` match value `'1'` or
// `1` while keeping `sectorName eq 'Technology'` a plain string compare.
function looseEquals(a, b) {
  if (a === b) return true;
  if (typeof a === 'boolean' || typeof b === 'boolean') return false;
  if (a == null || b == null) return false;
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)
      && String(a).trim() !== '' && String(b).trim() !== '') {
    return na === nb;
  }
  return false;
}

// ── Internal validation / sort / projection ──────────────────────────────────────────

// `*Rank` fields are 1 = best, so they sort ascending by default; every other numeric
// field sorts descending (higher score = better).
const RANK_SUFFIX = /Rank$/;
function inferDirection(field) {
  return RANK_SUFFIX.test(field) ? 'asc' : 'desc';
}

function clampLimit(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  const truncated = Math.trunc(n);
  if (truncated < 1) return DEFAULT_LIMIT;
  return Math.min(truncated, MAX_LIMIT);
}

// Returns a machine-readable reason if the predicate is invalid, else null.
function predicateRejectionReason(pred) {
  if (pred == null || typeof pred !== 'object' || Array.isArray(pred)) return 'malformed_predicate';
  if (typeof pred.field !== 'string' || pred.field.length === 0) return 'malformed_predicate';
  if (!isAllowedField(pred.field)) return 'field_not_allowed';
  if (typeof pred.op !== 'string' || !SUPPORTED_OPS.has(pred.op)) return 'unsupported_op';
  if (pred.op === 'in' && !Array.isArray(pred.value)) return 'malformed_value';
  if (pred.op === 'between' && (!Array.isArray(pred.value) || pred.value.length !== 2)) return 'malformed_value';
  return null;
}

function rejectionDetail(reason, field, op) {
  switch (reason) {
    case 'field_not_allowed': return `Field '${field}' is not in the screening allowlist`;
    case 'unsupported_op': return `Op '${op}' is not supported`;
    case 'malformed_value': return `Value for op '${op}' is malformed`;
    case 'malformed_predicate': return 'Predicate must be an object with a non-empty string field';
    case 'invalid_rank_field': return `rankBy.field '${field}' is not in the screening allowlist`;
    case 'unsupported_rank_direction': return "rankBy.direction must be 'asc' or 'desc'";
    default: return 'Rejected';
  }
}

// Compare two resolved values for sorting. Missing values always sort LAST, in either
// direction. Numeric when both are finite-numeric; otherwise a deterministic, locale-
// independent string compare.
function compareValues(va, vb, asc) {
  const aMissing = va == null;
  const bMissing = vb == null;
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;

  const na = Number(va);
  const nb = Number(vb);
  const bothNumeric = typeof va !== 'boolean' && typeof vb !== 'boolean'
    && Number.isFinite(na) && Number.isFinite(nb)
    && String(va).trim() !== '' && String(vb).trim() !== '';

  if (bothNumeric) {
    return asc ? na - nb : nb - na;
  }
  const sa = String(va);
  const sb = String(vb);
  if (sa === sb) return 0;
  const lt = sa < sb;
  return asc ? (lt ? -1 : 1) : (lt ? 1 : -1);
}

// Code-unit symbol compare — fully deterministic regardless of host locale.
function tieBreakSymbol(a, b) {
  const sa = a && a.symbol != null ? String(a.symbol) : '';
  const sb = b && b.symbol != null ? String(b.symbol) : '';
  if (sa < sb) return -1;
  if (sa > sb) return 1;
  return 0;
}

function sortStocks(stocks, rankBy) {
  const asc = rankBy.direction === 'asc';
  const copy = [...stocks];
  copy.sort((a, b) => {
    const primary = compareValues(resolveField(a, rankBy.field), resolveField(b, rankBy.field), asc);
    if (primary !== 0) return primary;
    return tieBreakSymbol(a, b);
  });
  return copy;
}

function collectReferencedFields(validFilters, rankBy) {
  const fields = new Set();
  for (const f of validFilters) fields.add(f.field);
  if (rankBy && rankBy.field) fields.add(rankBy.field);
  return fields;
}

// Project a stock into a value-carrying result that mirrors the source shape: scalars
// flat, nested namespaces (arch_scores / momentumFactors) keep their parent object and
// MERGE when multiple sub-keys are referenced. Resolved-but-absent values become `null`
// (never `undefined`) so the object is cleanly serializable.
function projectResult(stock, referencedFields) {
  const result = {};

  for (const f of BASELINE_FIELDS) {
    const v = stock ? stock[f] : undefined;
    result[f] = v === undefined ? null : v;
  }

  for (const field of referencedFields) {
    const dot = field.indexOf('.');
    if (dot === -1) {
      if (BASELINE_FIELDS.includes(field)) continue; // already carried — no duplicate key
      const v = resolveField(stock, field);
      result[field] = v === undefined ? null : v;
    } else {
      const ns = field.slice(0, dot);
      const key = field.slice(dot + 1);
      const v = resolveField(stock, field);
      if (result[ns] == null || typeof result[ns] !== 'object') {
        result[ns] = {};
      }
      result[ns][key] = v === undefined ? null : v;
    }
  }

  return result;
}

// ── Public API ───────────────────────────────────────────────────────────────────────

/**
 * Deterministically screen a stock universe against a screen spec.
 *
 * @param {Array<object>} stocks - the `.stocks` array from indexIntelligence/stockRankings
 * @param {{filters?: Array, rankBy?: object, limit?: number}} screenSpec
 * @returns {{
 *   results: Array<object>,        // projected, sorted, limited, value-carrying
 *   appliedSpec: object,           // the effective (cleaned) spec actually run
 *   rejectedFilters: Array<object>,// honest report of dropped predicates / rankBy issues
 *   matchCount: number,            // count after filtering, BEFORE the limit slice
 *   universeSize: number,          // input length
 *   computedAt: string,            // ISO timestamp — when THIS screen ran
 * }}
 */
export function screenStocks(stocks, screenSpec) {
  const universe = Array.isArray(stocks) ? stocks : [];
  const universeSize = universe.length;
  const spec = (screenSpec && typeof screenSpec === 'object') ? screenSpec : {};
  const computedAt = new Date().toISOString();

  const rejectedFilters = [];

  // 1. Validate filters (in order; first failing check rejects the predicate).
  const rawFilters = Array.isArray(spec.filters) ? spec.filters : [];
  const validFilters = [];
  for (const pred of rawFilters) {
    const reason = predicateRejectionReason(pred);
    if (reason) {
      const isObj = pred != null && typeof pred === 'object';
      rejectedFilters.push({
        scope: 'filter',
        field: isObj ? (pred.field ?? null) : null,
        op: isObj ? (pred.op ?? null) : null,
        value: isObj ? (pred.value ?? null) : null,
        reason,
        detail: rejectionDetail(reason, isObj ? pred.field : undefined, isObj ? pred.op : undefined),
      });
    } else {
      validFilters.push({ field: pred.field, op: pred.op, value: pred.value });
    }
  }

  // 2. Validate rankBy — field and direction independently.
  const rawRank = (spec.rankBy && typeof spec.rankBy === 'object') ? spec.rankBy : null;
  let rankByFallback = false;
  let rankField;
  let rankDirection;

  if (!rawRank || typeof rawRank.field !== 'string' || !isAllowedField(rawRank.field)) {
    // Bad or absent field → fall back to the doc's native composite-desc sort.
    if (rawRank && rawRank.field !== undefined) {
      rejectedFilters.push({
        scope: 'rankBy',
        field: rawRank.field ?? null,
        op: null,
        value: null,
        reason: 'invalid_rank_field',
        detail: rejectionDetail('invalid_rank_field', rawRank.field),
      });
      rankByFallback = true;
    }
    rankField = 'compositeScore';
    rankDirection = 'desc';
  } else {
    // Valid field. Explicit asc/desc wins; an invalid (but present) direction is reported
    // and the direction inferred — the requested FIELD still stands (no composite fallback).
    rankField = rawRank.field;
    if (rawRank.direction === 'asc' || rawRank.direction === 'desc') {
      rankDirection = rawRank.direction;
    } else {
      rankDirection = inferDirection(rankField);
      if (rawRank.direction !== undefined && rawRank.direction !== null) {
        rejectedFilters.push({
          scope: 'rankBy',
          field: rankField,
          op: null,
          value: rawRank.direction,
          reason: 'unsupported_rank_direction',
          detail: rejectionDetail('unsupported_rank_direction'),
        });
      }
    }
  }
  const rankBy = { field: rankField, direction: rankDirection };

  // 3. Filter (AND). Zero valid filters ⇒ every stock passes (rank-only).
  const matched = universe.filter(stock =>
    validFilters.every(f => evaluateOp(f.op, resolveField(stock, f.field), f.value)),
  );
  const matchCount = matched.length;

  // 4. Sort, then 5. limit.
  const sorted = sortStocks(matched, rankBy);
  const limit = clampLimit(spec.limit);
  const limited = sorted.slice(0, limit);

  // 6. Project to value-carrying, source-shaped results.
  const referencedFields = collectReferencedFields(validFilters, rankBy);
  const results = limited.map(stock => projectResult(stock, referencedFields));

  // 7. appliedSpec echoes the effective spec actually run.
  const appliedSpec = { filters: validFilters, rankBy, limit, rankByFallback };

  return { results, appliedSpec, rejectedFilters, matchCount, universeSize, computedAt };
}

export default screenStocks;
