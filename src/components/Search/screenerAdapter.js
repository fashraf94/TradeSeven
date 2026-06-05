// src/components/Search/screenerAdapter.js
//
// Research Engine — Phase 3: thin presentation adapter between the screener
// endpoint (POST /api/screener/chat) and the EXISTING RankRow row component.
//
// RankRow renders a fixed 5-metric enum: its `type` prop drives the score key it
// reads off the stock, the bar gradient and the score color. The screener's
// appliedSpec.rankBy.field is open-ended — any allowlisted field, including
// dot-paths like `arch_scores.degen` ("screen like a Speculator") or
// `momentumFactors.heat`. These pure helpers bridge the two WITHOUT touching
// RankRow: they resolve the ranked value per result, pick a RankRow `type` for
// color, and project a display-only stock whose RankRow score key carries the
// headline value (so RankRow shows the metric the list was actually ranked by).
//
// They also turn the machine-readable appliedSpec / rejectedFilters into the
// plain-language transparency strings the view renders. Pure and dependency-light
// (only getArchetypeDisplayName) so they unit-test without a DOM.

import { getArchetypeDisplayName } from '../../data/archetypeDisplay';

// Mirror of RankRow's SCORE_KEY_MAP (src/components/Search/RankRow.jsx) — the
// score key each `type` reads. Kept in lockstep with RankRow; if RankRow's map
// changes, change this too.
export const TYPE_TO_SCORE_KEY = Object.freeze({
  composite: 'compositeScore',
  fundamental: 'fundamentalScore',
  technical: 'technicalScore',
  baggerBomb: 'baggerBombFit',
  momentum: 'momentumScore',
});

// Reverse: a known score field → the RankRow `type` that colors it.
const SCORE_KEY_TO_TYPE = Object.freeze({
  compositeScore: 'composite',
  fundamentalScore: 'fundamental',
  technicalScore: 'technical',
  baggerBombFit: 'baggerBomb',
  momentumScore: 'momentum',
});

// The only fields the engine documents as 0–1 (voiceLayerPrompt.js field ref).
// Every other numeric field (scores 0–100, arch_scores 0–100, ranks, ranges) is
// already human-scaled — these two get ×100 for a readable headline.
const UNIT_INTERVAL_FIELDS = new Set(['atrPercentile', 'bBandwidthPercentile']);

const DEFAULT_RANK_FIELD = 'compositeScore';

// Friendly labels for the plain-language spec line. Flat fields only; dot-path
// fields are humanized in friendlyField below.
const FIELD_LABELS = Object.freeze({
  compositeScore: 'composite score',
  fundamentalScore: 'fundamental score',
  fundamentalRank: 'fundamental rank',
  technicalScore: 'technical score',
  technicalRank: 'technical rank',
  sectorTechnicalRank: 'sector technical rank',
  momentumScore: 'momentum',
  momentumRank: 'momentum rank',
  baggerBombFit: 'BaggerBomb fit',
  baggerBombRank: 'BaggerBomb rank',
  atrPercentile: 'volatility (ATR %ile)',
  bBandwidthPercentile: 'Bollinger bandwidth %ile',
  dailyRange: 'daily range',
  sma200_position: 'distance from 200-day SMA',
  nr7Flag: 'NR7 (tight) setup',
  trend: 'trend',
  recentAction: 'recent action',
  sectorName: 'sector',
  sectorId: 'sector',
  symbol: 'ticker',
});

/**
 * Dot-path-aware value read (mirrors screenStocks.resolveField). One hop only —
 * `arch_scores.degen`, `momentumFactors.heat` — otherwise a flat key. Returns
 * null on any missing hop.
 */
export function resolveRankValue(result, field) {
  if (result == null || typeof field !== 'string' || !field) return null;
  const dot = field.indexOf('.');
  if (dot === -1) {
    const v = result[field];
    return v == null ? null : v;
  }
  const ns = field.slice(0, dot);
  const key = field.slice(dot + 1);
  const parent = result[ns];
  if (parent == null || typeof parent !== 'object') return null;
  const v = parent[key];
  return v == null ? null : v;
}

/**
 * rankBy.field → a RankRow `type` (bar color / gradient only). Non-mapped fields
 * (arch_scores.*, momentumFactors.*, ranks, percentiles) fall back to the
 * neutral teal 'composite' — never invents the red BaggerBomb gradient.
 */
export function rankFieldToType(field) {
  return SCORE_KEY_TO_TYPE[field] || 'composite';
}

/**
 * Resolve + scale the ranked metric into the number RankRow should display.
 * 0–1 fields are scaled ×100; null / non-numeric → 0. NOT rounded here — RankRow
 * rounds for the label, and the unrounded value keeps the progress bar smooth.
 */
export function headlineValue(result, field) {
  const raw = resolveRankValue(result, field);
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return UNIT_INTERVAL_FIELDS.has(field) ? n * 100 : n;
}

/**
 * Build everything RankRow needs for a result set in one pass: per-row
 * { stock, type } props (display-only stock with the headline injected into the
 * type's score key) plus the shared maxScore for bar normalization.
 *
 * @returns {{ rows: Array<{stock: object, type: string}>, maxScore: number, type: string, field: string }}
 */
export function buildRankRows(results, appliedSpec) {
  const field =
    (appliedSpec && appliedSpec.rankBy && appliedSpec.rankBy.field) || DEFAULT_RANK_FIELD;
  const list = Array.isArray(results) ? results : [];
  const type = rankFieldToType(field);
  const scoreKey = TYPE_TO_SCORE_KEY[type] || 'compositeScore';

  const values = list.map((r) => headlineValue(r, field));
  const maxScore = Math.max(...values, 1);

  const rows = list.map((result, i) => ({
    type,
    // Display-only clone: inject the headline under the score key RankRow reads,
    // so the untouched RankRow shows the actual ranked metric in `type`'s color.
    stock: { ...result, [scoreKey]: values[i] },
  }));

  return { rows, maxScore, type, field };
}

// Humanize one filter/rank field for display, including dot-path namespaces.
function friendlyField(field) {
  if (typeof field !== 'string' || !field) return 'score';
  if (field.startsWith('arch_scores.')) {
    return `${getArchetypeDisplayName(field.slice('arch_scores.'.length))} fit`;
  }
  if (field.startsWith('momentumFactors.')) {
    return `${field.slice('momentumFactors.'.length)} (momentum factor)`;
  }
  return FIELD_LABELS[field] || field;
}

// One filter predicate → a natural phrase. Sector reads most naturally with its
// own special-casing ("Technology", "excluding Energy").
function describeFilter(f) {
  if (!f || typeof f !== 'object') return null;
  const { field, op, value } = f;
  const label = friendlyField(field);

  if (field === 'sectorName' || field === 'sectorId') {
    if (op === 'eq') return String(value);
    if (op === 'neq') return `excluding ${value}`;
    if (op === 'in' && Array.isArray(value)) return value.join(', ');
  }

  switch (op) {
    case 'isTrue': return label;
    case 'isFalse': return `not ${label}`;
    case 'gt': return `${label} > ${value}`;
    case 'gte': return `${label} ≥ ${value}`;
    case 'lt': return `${label} < ${value}`;
    case 'lte': return `${label} ≤ ${value}`;
    case 'eq': return `${label} = ${value}`;
    case 'neq': return `${label} ≠ ${value}`;
    case 'in': return Array.isArray(value) ? `${label} in ${value.join(', ')}` : label;
    case 'between': return Array.isArray(value) ? `${label} ${value[0]}–${value[1]}` : label;
    default: return label;
  }
}

/**
 * appliedSpec → a single plain-language line, e.g.
 *   "Financials · ranked by composite score · top 10"
 *   "NR7 (tight) setup · ranked by Speculator fit · top 10"
 *   "All stocks · ranked by momentum · top 10"
 */
export function specToPlainLanguage(appliedSpec) {
  if (!appliedSpec || typeof appliedSpec !== 'object') return '';
  const parts = [];

  const filters = Array.isArray(appliedSpec.filters) ? appliedSpec.filters : [];
  const filterText = filters.map(describeFilter).filter(Boolean);
  parts.push(filterText.length ? filterText.join(' · ') : 'All stocks');

  const rankBy = appliedSpec.rankBy;
  if (rankBy && rankBy.field) parts.push(`ranked by ${friendlyField(rankBy.field)}`);

  if (Number.isFinite(appliedSpec.limit)) parts.push(`top ${appliedSpec.limit}`);

  return parts.join(' · ');
}

/**
 * rejectedFilters[] → human caveat lines. Reuses each entry's server-provided
 * `detail` (already human-readable, e.g. "Field 'price' is not in the screening
 * allowlist"); drops malformed entries.
 */
export function rejectedFiltersToLines(rejectedFilters) {
  if (!Array.isArray(rejectedFilters)) return [];
  return rejectedFilters
    .map((r) => (r && typeof r.detail === 'string' && r.detail.trim() ? r.detail.trim() : null))
    .filter(Boolean);
}
