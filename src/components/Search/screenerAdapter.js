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

// The five realized period-return fields (Conversational Performance). Stored as a
// signed percent and already human-scaled, so they pass through the value resolver
// RAW (no ×100). When a screen ranks by one of these, ScreenerView routes it to the
// directional/diverging ReturnRow instead of RankRow's 0–100 score bar.
export const RETURN_FIELDS = Object.freeze(new Set([
  'return1W', 'return1M', 'return3M', 'returnYTD', 'return12M',
]));

export function isReturnField(field) {
  return RETURN_FIELDS.has(field);
}

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
  return1W: '1-week return',
  return1M: '1-month return',
  return3M: '3-month return',
  returnYTD: 'year-to-date return',
  return12M: '12-month return',
  sectorName: 'sector',
  sectorId: 'sector',
  industryName: 'industry',
  symbol: 'ticker',
});

// Short display names for the clunkier GICS industry labels (Phase 2). Used for the
// industry rollup rows AND the transparency strip; unmapped industries render their GICS
// string as-is. Display polish only — the canonical GICS string stays the data/value.
const INDUSTRY_DISPLAY_NAMES = Object.freeze({
  'Semiconductors & Semiconductor Equipment': 'Semiconductors',
  'Oil, Gas & Consumable Fuels': 'Oil & Gas',
  'Technology Hardware, Storage & Peripherals': 'Tech Hardware',
  'Consumer Staples Distribution & Retail': 'Staples Retail',
  'Health Care Equipment & Supplies': 'Medical Devices',
  'Health Care Providers & Services': 'Healthcare Providers',
  'Hotels, Restaurants & Leisure': 'Hotels & Leisure',
  'Interactive Media & Services': 'Interactive Media',
  'Independent Power and Renewable Electricity Producers': 'Power Producers',
  'Diversified Telecommunication Services': 'Diversified Telecom',
  'Wireless Telecommunication Services': 'Wireless Telecom',
  'Textiles, Apparel & Luxury Goods': 'Apparel & Luxury',
  'Commercial Services & Supplies': 'Commercial Services',
  'Air Freight & Logistics': 'Air Freight',
  'Containers & Packaging': 'Packaging',
  'Energy Equipment & Services': 'Energy Equipment',
  'Life Sciences Tools & Services': 'Life Sciences Tools',
});

// GICS industry string → short display name (unmapped passes through unchanged).
export function industryDisplayName(name) {
  if (typeof name !== 'string') return name;
  return INDUSTRY_DISPLAY_NAMES[name] || name;
}

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

// Coerce to a finite number, or null. Guards the Number(null) === 0 trap (null/undefined
// must stay null, not become a finite 0) and rejects NaN/Infinity. The shared "is this a
// real, renderable number?" rule behind the return formatter, color, and row builder.
function toFiniteOrNull(value) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Signed-percent label for a realized return: "+12.4%" / "-3.1%". One decimal (the
 * stored value is already a 2-dp percent, so this just trims for the dense list).
 * null / non-finite → an em dash. These are REALIZED, PAST results — never framed
 * as a forecast.
 */
export function formatSignedPercent(value) {
  const n = toFiniteOrNull(value);
  if (n == null) return '—';
  // Round to the display precision FIRST, then derive the sign — so a tiny loss that
  // rounds to zero (e.g. -0.04 → "-0.0") never renders the contradictory "-0.0%".
  const rounded = Number(n.toFixed(1));
  const shown = rounded === 0 ? 0 : rounded; // normalizes -0 → 0
  return `${shown >= 0 ? '+' : ''}${shown.toFixed(1)}%`;
}

/**
 * Directional color for a return: emerald when up (>= 0), red when down — distinct
 * from the teal accent — and a muted token when null/non-finite. Theme-aware via the
 * passed tokens; falls back to the dark-theme hexes if tokens is absent.
 */
export function returnColor(value, tokens) {
  const n = toFiniteOrNull(value);
  if (n == null) return (tokens && tokens.textFaint) || '#6b7280';
  return n >= 0
    ? ((tokens && tokens.emerald) || '#34d399')
    : ((tokens && tokens.red) || '#ef4444');
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

/**
 * ReturnRow counterpart to buildRankRows for a return-ranked screen. Resolves each
 * result's signed return RAW — already a percent, so no ×100 and no rounding; null
 * stays null so it renders as a dash, not a 0% bar — and computes the shared bar
 * normalizer as the MAX ABSOLUTE return across the set. Max-abs (not the
 * `Math.max(...values, 1)` buildRankRows uses) is what lets -3% and -30% render at
 * different lengths AND keeps an all-negative set diverging correctly — plain max
 * would collapse to the 1 floor and mis-scale every bar.
 *
 * @returns {{ rows: Array<{stock: object, value: number|null}>, maxAbs: number, field: string }}
 */
export function buildReturnRows(results, appliedSpec) {
  const field =
    (appliedSpec && appliedSpec.rankBy && appliedSpec.rankBy.field) || DEFAULT_RANK_FIELD;
  const list = Array.isArray(results) ? results : [];

  // toFiniteOrNull keeps a thin-history null as null (it must render as a dash, not a
  // 0% bar) — Number(null) === 0 would otherwise smuggle a fake zero through.
  const rows = list.map((result) => ({
    stock: result,
    value: toFiniteOrNull(resolveRankValue(result, field)),
  }));

  const maxAbs = rows.reduce(
    (m, r) => (r.value == null ? m : Math.max(m, Math.abs(r.value))),
    0,
  );

  return { rows, maxAbs, field };
}

/**
 * Build rows for an INDUSTRY-ROLLUP result. The rollup rows already carry the ranked `value`
 * (screenStocks.screenIndustries), so this normalizes it, attaches the short display name +
 * member count, and — like the stock path — computes a return-style max-abs OR a score-style
 * max for bar normalization, branching on isReturnField.
 *
 * @returns {{ rows: Array<{industry, displayName, totalStocks, value: number|null}>,
 *            isReturn: boolean, maxAbs: number, maxScore: number, field: string }}
 */
export function buildIndustryRows(results, appliedSpec) {
  const field =
    (appliedSpec && appliedSpec.rankBy && appliedSpec.rankBy.field) || DEFAULT_RANK_FIELD;
  const list = Array.isArray(results) ? results : [];
  const isReturn = isReturnField(field);

  const rows = list.map((industry) => ({
    industry,
    displayName: industryDisplayName(industry?.name),
    totalStocks: industry?.totalStocks ?? null,
    value: toFiniteOrNull(industry?.value != null ? industry.value : resolveRankValue(industry, field)),
  }));

  // Returns diverge from a center zero (max-abs); momentumScore is a one-directional 0–100 bar.
  const maxAbs = rows.reduce((m, r) => (r.value == null ? m : Math.max(m, Math.abs(r.value))), 0);
  const maxScore = Math.max(...rows.map((r) => (r.value == null ? 0 : r.value)), 1);

  return { rows, isReturn, maxAbs, maxScore, field };
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

  // Sector and industry read most naturally as the bare value ("Technology", "excluding
  // Energy"). Industry uses its short display name (INDUSTRY_DISPLAY_NAMES) so the strip reads
  // "Semiconductors", not "Semiconductors & Semiconductor Equipment".
  if (field === 'industryName') {
    if (op === 'eq') return industryDisplayName(String(value));
    if (op === 'neq') return `excluding ${industryDisplayName(String(value))}`;
    if (op === 'in' && Array.isArray(value)) return value.map((v) => industryDisplayName(String(v))).join(', ');
  }
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
  const emptyLead = appliedSpec.screenType === 'industries' ? 'All industries' : 'All stocks';
  parts.push(filterText.length ? filterText.join(' · ') : emptyLead);

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
