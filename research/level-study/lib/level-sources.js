// research/level-study/lib/level-sources.js
//
// Per-day level-source computation + confluence snapshot assembly (parent §5.1, §5.3;
// geometry unified per S3.5 §3).
//
// buildDaySnapshots(series, N, D, opts) computes the registry content for session D from
// the first N bars ONLY (bars 0..N−1 = data through D−1 close). It never reads an index
// ≥ N — that discipline, plus lib/level-series.js's prefix property, is what the
// equivalence harness (incremental ≡ truncated rebuild) verifies end-to-end.
//
// THE DISTANCE UNIT (S3.5 §3, LS3-01): every geometric threshold in the study is an
// ordered multiple of one bounded per-symbol-per-day unit,
//   u(D) = clamp(atrMultiple·ATR(14,D−1), floorPct%·price(D−1), capPct%·price(D−1)).
// Grouping here is BOUNDED-DIAMETER (a group's total span never exceeds its k·u bound),
// which makes the LS3-08 theorem hold by construction: a single snapshot can never span
// the split threshold, because kConfluence < kSplit is asserted at config load.
//
// Every method level carries the parent §5.3 availability triple; composites take the
// MAX over members (S3-C6, conservative). Tradability follows the S3.5 amendment: the
// first registry session whose prior-close information set contains every input.
//
// Zero product imports.

import CONFIG from '../config.js';
import { firstCrossingIndex } from './level-series.js';

const L = CONFIG.levels;
const GEO = L.geometry;
const K = L.sourceFamilies.structural.fractalK;                     // 3
const TRAIL = L.sourceFamilies.structural.trailingSessions;         // 120
const SIG_PCT = L.significantSwingMovePct;                          // 5
const ZONE_UNITS = L.lineage.roleMachine.zoneHalfWidthUnits;        // 0.25 (zone = anchor/centroid ± 0.25·u)
const DEFAULT_FAMILIES = ['structural', 'participation', 'calendar']; // psychological OFF, moving reserved (parent §5.1)

/**
 * The unified distance unit for a session whose prior bar has the given ATR and close.
 * ATR null (thin early history) degrades to the floor — but production lineage never
 * starts before ATR is defined (warmupReplay.startRule).
 */
export function distanceUnit(atr, price) {
  const floor = (GEO.distanceUnit.floorPct / 100) * price;
  const cap = (GEO.distanceUnit.capPct / 100) * price;
  const base = atr != null ? GEO.distanceUnit.atrMultiple * atr : floor;
  return Math.min(Math.max(base, floor), cap);
}

/**
 * @param {object} series from buildSeries()
 * @param {number} N bars available (registry for D uses bars 0..N−1); 1 ≤ N ≤ series.n
 * @param {string} D the registry session date (strictly after dates[N−1])
 * @param {object} opts { symbol, enabledFamilies? } — enabledFamilies is a TEST hook to
 *   isolate one source family in synthetic scenarios; the production runner never passes it.
 * @returns {{date, atr, refClose, unit, snapshots}} — every raw method level is embedded
 *   as a snapshot member; there is deliberately no separate flat level list (one shape only).
 */
export function buildDaySnapshots(series, N, D, opts = {}) {
  const symbol = opts.symbol || 'SYM';
  const enabled = new Set(opts.enabledFamilies || DEFAULT_FAMILIES);
  const atr = series.atr[N - 1];                                    // ATR(14, daily, D−1)
  const refClose = series.aClose[N - 1];                            // D−1 adjusted close
  const unit = distanceUnit(atr, refClose);                         // S3.5 §3

  const levels = [];
  if (enabled.has('structural')) levels.push(...structuralLevels(series, N, D, unit));
  if (enabled.has('participation')) levels.push(...participationLevels(series, N, D));
  if (enabled.has('calendar')) levels.push(...calendarLevels(series, N, D));

  const snapshots = confluence(levels, { symbol, date: D, atr, refClose, unit });
  return { date: D, atr, refClose, unit, snapshots };
}

// ── bounded-diameter grouping (S35-C7/C8; replaces S3 greedy centroid-chaining) ──
// Deterministic left-greedy rule over price-ascending items: a group opens at the first
// ungrouped item and absorbs subsequent items while (price − firstMemberPrice) ≤ maxSpan.
// The group's total span is therefore ≤ maxSpan BY CONSTRUCTION (chaining, which could
// drift a group arbitrarily wide, is gone).
function boundedGroups(sortedItems, maxSpan) {
  const groups = [];
  let cur = null;
  for (const it of sortedItems) {
    if (cur && it.price - cur.members[0].price <= maxSpan) cur.members.push(it);
    else { cur = { members: [it] }; groups.push(cur); }
  }
  return groups;
}

// ── availability helper ───────────────────────────────────────────────────────
// Close-discovered sources (fractal, AVWAP): tradable the session after the discovery
// close (S3.5 tradability amendment — the prior-close information set first contains
// the level's inputs on the next session). When the discovery close is D−1, that IS D.
function tradableAfter(series, N, D, firstKnownIdx) {
  return firstKnownIdx + 1 <= N - 1 ? series.dates[firstKnownIdx + 1] : D;
}

// ── structural: fractal swing S/R clusters (parent §5.1) ─────────────────────
function structuralLevels(series, N, D, unit) {
  const pivots = [];
  const from = Math.max(K, N - TRAIL);                              // formed within trailing 120 sessions
  const to = N - 1 - K;                                             // confirmed: all K right-side bars closed by D−1
  for (let i = from; i <= to; i++) {
    if (series.isSwingHigh[i]) pivots.push({ idx: i, price: series.aHigh[i], w: series.w[i] });
    if (series.isSwingLow[i]) pivots.push({ idx: i, price: series.aLow[i], w: series.w[i] });
  }
  if (!pivots.length) return [];
  pivots.sort((a, b) => a.price - b.price || a.idx - b.idx);

  // S35-C7: bounded-diameter grouping (span ≤ kCluster·u); volume-weighted centroid.
  return boundedGroups(pivots, GEO.multiples.kCluster * unit).map((g) => {
    const wSum = g.members.reduce((s, m) => s + m.w, 0);
    const centroid = wSum > 0
      ? g.members.reduce((s, m) => s + m.price * m.w, 0) / wSum
      : g.members.reduce((s, m) => s + m.price, 0) / g.members.length;
    const newestIdx = Math.max(...g.members.map((m) => m.idx));
    const firstKnownIdx = newestIdx + K;                            // §5.3: formation + k sessions
    return {
      family: 'structural',
      method: 'swing_sr_clusters',
      kind: null,
      price: centroid,
      touchCount: g.members.length,                                 // parent §5.1: touch_count per cluster
      formationDate: series.dates[newestIdx],                       // S3-C6: latest structure-forming bar
      firstKnownDate: series.dates[firstKnownIdx],
      firstTradableDate: tradableAfter(series, N, D, firstKnownIdx),
    };
  });
}

// ── participation: AVWAP from most recent significant swing high/low (parent §5.1, §5.3) ──
function participationLevels(series, N, D) {
  const out = [];
  for (const kind of ['high', 'low']) {
    const anchor = mostRecentSignificantSwing(series, N, kind);
    if (!anchor) continue;
    const { idx, crossIdx } = anchor;
    const sumTpw = series.cumTpw[N - 1] - (idx > 0 ? series.cumTpw[idx - 1] : 0);
    const sumW = series.cumW[N - 1] - (idx > 0 ? series.cumW[idx - 1] : 0);
    if (!(sumW > 0)) continue;                                      // null-never-zero: no weight → no level
    const firstKnownIdx = Math.max(idx + K, crossIdx);              // §5.3: confirmed AND ≥5% observable
    out.push({
      family: 'participation',
      method: kind === 'high' ? 'avwap_high' : 'avwap_low',
      kind,
      price: sumTpw / sumW,
      touchCount: null,
      anchorDate: series.dates[idx],
      formationDate: series.dates[idx],
      firstKnownDate: series.dates[firstKnownIdx],
      firstTradableDate: tradableAfter(series, N, D, firstKnownIdx),
    });
  }
  return out;
}

/**
 * Most recent fractal-confirmed swing (of `kind`) whose ≥5% move is observable from bars
 * 0..N−1 alone — significance is NEVER evaluated on the move's eventual extent (§5.3).
 * Returns { idx, crossIdx } where crossIdx is the first bar index at which the running
 * post-swing extreme crossed the 5% threshold (→ firstKnownDate component).
 */
function mostRecentSignificantSwing(series, N, kind) {
  for (let i = N - 1 - K; i >= K; i--) {                            // i+K ≤ N−1: confirmed within prefix (so i+1 ≤ N−1 too)
    if (kind === 'high' ? !series.isSwingHigh[i] : !series.isSwingLow[i]) continue;
    if (kind === 'high') {
      const threshold = series.aHigh[i] * (1 - SIG_PCT / 100);
      const crossIdx = firstCrossingIndex(series.minLowTable, i + 1, N - 1, threshold, 'min');
      if (crossIdx != null) return { idx: i, crossIdx };
    } else {
      const threshold = series.aLow[i] * (1 + SIG_PCT / 100);
      const crossIdx = firstCrossingIndex(series.maxHighTable, i + 1, N - 1, threshold, 'max');
      if (crossIdx != null) return { idx: i, crossIdx };
    }
  }
  return null;
}

// ── calendar: classical daily + weekly pivots (parent §5.1) ──────────────────
const PIVOT_KINDS = L.sourceFamilies.calendar.dailyPivots;          // ['PP','S1','S2','R1','R2']

function classicalPivots(h, l, c) {
  const pp = (h + l + c) / 3;
  return { PP: pp, R1: 2 * pp - l, S1: 2 * pp - h, R2: pp + (h - l), S2: pp - (h - l) };
}

/** ISO Monday of the calendar week containing `iso` (S3-C16). */
function weekMonday(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function calendarLevels(series, N, D) {
  const out = [];

  // Daily pivots from D−1 OHLC — apply to session D. Tradable the session they apply to
  // (S3.5 tradability amendment: derived wholly from prior completed bars, so D's
  // prior-close information set contains every input).
  const dv = classicalPivots(series.aHigh[N - 1], series.aLow[N - 1], series.aClose[N - 1]);
  for (const kind of PIVOT_KINDS) {
    out.push({
      family: 'calendar', method: 'daily_pivots', kind,
      price: dv[kind], touchCount: null,
      formationDate: series.dates[N - 1],
      firstKnownDate: D,
      firstTradableDate: D,
    });
  }

  // Weekly pivots from the prior completed week (Monday-keyed; S3-C16) — apply to every
  // session of D's week; tradable from the week's FIRST trading session (S3.5 amendment;
  // Monday-holiday weeks simply start on their first actual trading day).
  const curWeek = weekMonday(D);
  let lastPrior = -1;
  for (let i = N - 1; i >= 0; i--) {
    if (weekMonday(series.dates[i]) < curWeek) { lastPrior = i; break; }
  }
  if (lastPrior >= 0) {
    const priorWeek = weekMonday(series.dates[lastPrior]);
    let firstPrior = lastPrior;
    while (firstPrior > 0 && weekMonday(series.dates[firstPrior - 1]) === priorWeek) firstPrior--;
    let h = -Infinity, l = Infinity;
    for (let i = firstPrior; i <= lastPrior; i++) {
      if (series.aHigh[i] > h) h = series.aHigh[i];
      if (series.aLow[i] < l) l = series.aLow[i];
    }
    const wv = classicalPivots(h, l, series.aClose[lastPrior]);
    // First trading session of D's week: the first hist bar after lastPrior in D's week,
    // else D itself (D is opening its week).
    const firstOfCurWeek = lastPrior + 1 <= N - 1 ? series.dates[lastPrior + 1] : D;
    for (const kind of PIVOT_KINDS) {
      out.push({
        family: 'calendar', method: 'weekly_pivots', kind,
        price: wv[kind], touchCount: null,
        formationDate: series.dates[lastPrior],
        firstKnownDate: firstOfCurWeek,
        firstTradableDate: firstOfCurWeek,
      });
    }
  }

  return out;
}

// ── confluence: family-counted snapshot assembly (parent §5.1; S35-C8 grouping) ──
function confluence(levels, ctx) {
  if (!levels.length) return [];
  // Deterministic total order: price, then family/method/kind/formationDate tie-breaks.
  const sorted = [...levels].sort((a, b) =>
    a.price - b.price ||
    cmp(a.family, b.family) || cmp(a.method, b.method) || cmp(a.kind || '', b.kind || '') ||
    cmp(a.formationDate, b.formationDate));

  const maxSpan = GEO.multiples.kConfluence * ctx.unit;
  const groups = boundedGroups(sorted, maxSpan);

  const usedIds = new Set();
  return groups.map((g) => {
    const members = g.members;
    const span = members[members.length - 1].price - members[0].price;
    // Bounded-diameter theorem guard (LS3-08): by construction span ≤ kConfluence·u,
    // and validateGeometry guarantees kConfluence < kSplit — assert, never assume.
    if (span > maxSpan + 1e-9) {
      throw new Error(`bounded-diameter violated on ${ctx.date}: snapshot span ${span} > ${maxSpan}`);
    }
    const centroid = members.reduce((s, m) => s + m.price, 0) / members.length;
    const families = [...new Set(members.map((m) => m.family))].sort();
    const methods = [...new Set(members.map((m) => m.method))].sort();
    const tierCount = families.length;                              // count FAMILIES, not methods (§5.1)
    const zoneHalfWidth = ZONE_UNITS * ctx.unit;                    // 0.25·u (S3.5 §6 frame)
    let snapshotId = `${ctx.symbol}_${ctx.date}_snap_${centroid.toFixed(2)}`;
    for (let s = 2; usedIds.has(snapshotId); s++) snapshotId = `${ctx.symbol}_${ctx.date}_snap_${centroid.toFixed(2)}_${s}`;
    usedIds.add(snapshotId);
    return {
      snapshotId,
      date: ctx.date,
      centroid,
      zoneHalfWidth,
      zoneLow: centroid - zoneHalfWidth,
      zoneHigh: centroid + zoneHalfWidth,
      side: centroid <= ctx.refClose ? 'support' : 'resistance',    // S3-C8 (tie → support)
      families,
      tier: tierCount === 1 ? 'F1' : tierCount === 2 ? 'F2' : 'F3', // F3 = 3+ (§5.1)
      methods,                                                      // exact combination stored (§5.1)
      // S3-C6: composite availability = max over members (conservative). Age features
      // must use MEMBER triples or family bornDate — never this composite triple.
      formationDate: maxIso(members.map((m) => m.formationDate)),
      firstKnownDate: maxIso(members.map((m) => m.firstKnownDate)),
      firstTradableDate: maxIso(members.map((m) => m.firstTradableDate)),
      members,
      familyId: null,                                               // assigned by the lineage step
    };
  });
}

function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function maxIso(arr) { return arr.reduce((m, d) => (d > m ? d : m)); }
