// research/level-study/lib/level-sources.js
//
// Per-day level-source computation + confluence snapshot assembly (parent §5.1, §5.3).
//
// buildDaySnapshots(series, N, D, opts) computes the registry content for session D from
// the first N bars ONLY (bars 0..N−1 = data through D−1 close). It never reads an index
// ≥ N — that discipline, plus lib/level-series.js's prefix property, is what the
// equivalence harness (incremental ≡ truncated rebuild) verifies end-to-end.
//
// Every method level carries the parent §5.3 availability triple:
//   formationDate     — the bar that formed the structure
//   firstKnownDate    — first session on which the structure was detectable
//   firstTradableDate — first session an event may reference it
// Composite objects (clusters, confluence snapshots) take the MAX over members (S3-C6,
// conservative — a composite is never available earlier than its newest constituent).
//
// Zero product imports.

import CONFIG from '../config.js';
import { firstCrossingIndex } from './level-series.js';

const L = CONFIG.levels;
const K = L.sourceFamilies.structural.fractalK;                     // 3
const TRAIL = L.sourceFamilies.structural.trailingSessions;         // 120
const CLUSTER_PCT = L.sourceFamilies.structural.clusterPct;         // 0.5
const ALIGN_PCT = L.confluence.alignPct;                            // 0.5
const SIG_PCT = L.significantSwingMovePct;                          // 5
const ZONE_ATR_MULT = CONFIG.episode.zoneAtrMult;                   // 0.25
const DEFAULT_FAMILIES = ['structural', 'participation', 'calendar']; // psychological OFF, moving reserved (parent §5.1)

/**
 * @param {object} series from buildSeries()
 * @param {number} N bars available (registry for D uses bars 0..N−1); 1 ≤ N ≤ series.n
 * @param {string} D the registry session date (strictly after dates[N−1])
 * @param {object} opts { symbol, enabledFamilies? } — enabledFamilies is a TEST hook to
 *   isolate one source family in synthetic scenarios; the production runner never passes it.
 * @returns {{date, atr, refClose, levels, snapshots}}
 */
export function buildDaySnapshots(series, N, D, opts = {}) {
  const symbol = opts.symbol || 'SYM';
  const enabled = new Set(opts.enabledFamilies || DEFAULT_FAMILIES);
  const atr = series.atr[N - 1];                                    // ATR(14, daily, D−1)
  const refClose = series.aClose[N - 1];                            // D−1 adjusted close

  const levels = [];
  if (enabled.has('structural')) levels.push(...structuralLevels(series, N, D));
  if (enabled.has('participation')) levels.push(...participationLevels(series, N, D));
  if (enabled.has('calendar')) levels.push(...calendarLevels(series, N, D));

  const snapshots = confluence(levels, { symbol, date: D, atr, refClose });
  return { date: D, atr, refClose, levels, snapshots };
}

// ── availability helper ───────────────────────────────────────────────────────
// firstTradableDate = firstKnownDate + 1 session, "known at prior close" (parent §5.3).
// When firstKnown is the last available bar (D−1), the next session IS D.
function tradableAfter(series, N, D, firstKnownIdx) {
  return firstKnownIdx + 1 <= N - 1 ? series.dates[firstKnownIdx + 1] : D;
}

// ── structural: fractal swing S/R clusters (parent §5.1) ─────────────────────
function structuralLevels(series, N, D) {
  const pivots = [];
  const from = Math.max(K, N - TRAIL);                              // formed within trailing 120 sessions
  const to = N - 1 - K;                                             // confirmed: all K right-side bars closed by D−1
  for (let i = from; i <= to; i++) {
    if (series.isSwingHigh[i]) pivots.push({ idx: i, price: series.aHigh[i], w: series.w[i] });
    if (series.isSwingLow[i]) pivots.push({ idx: i, price: series.aLow[i], w: series.w[i] });
  }
  if (!pivots.length) return [];
  pivots.sort((a, b) => a.price - b.price || a.idx - b.idx);

  // S3-C4: ascending-price greedy clustering against the running volume-weighted centroid.
  const clusters = [];
  let cur = null;
  for (const p of pivots) {
    if (cur && Math.abs(p.price - cur.centroid) <= cur.centroid * (CLUSTER_PCT / 100)) {
      cur.members.push(p);
      cur.pwSum += p.price * p.w; cur.wSum += p.w; cur.pSum += p.price;
      cur.centroid = cur.wSum > 0 ? cur.pwSum / cur.wSum : cur.pSum / cur.members.length;
    } else {
      cur = { members: [p], pwSum: p.price * p.w, wSum: p.w, pSum: p.price };
      cur.centroid = cur.wSum > 0 ? cur.pwSum / cur.wSum : p.price;
      clusters.push(cur);
    }
  }

  return clusters.map((c) => {
    const newestIdx = Math.max(...c.members.map((m) => m.idx));
    const firstKnownIdx = newestIdx + K;                            // §5.3: formation + k sessions
    return {
      family: 'structural',
      method: 'swing_sr_clusters',
      kind: null,
      price: c.centroid,
      touchCount: c.members.length,                                 // parent §5.1: touch_count per cluster
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
export function mostRecentSignificantSwing(series, N, kind) {
  for (let i = N - 1 - K; i >= K; i--) {                            // i+K ≤ N−1: confirmed within prefix
    if (kind === 'high' ? !series.isSwingHigh[i] : !series.isSwingLow[i]) continue;
    if (i + 1 > N - 1) continue;
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
export function weekMonday(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function calendarLevels(series, N, D) {
  const out = [];

  // Daily pivots from D−1 OHLC — apply to session D (parent §5.3: firstKnown = the
  // session they apply to; S3-C7: tradable that same session, derived wholly from prior
  // completed bars so already known at prior close).
  const dv = classicalPivots(series.aHigh[N - 1], series.aLow[N - 1], series.aClose[N - 1]);
  for (const kind of PIVOT_KINDS) {
    out.push({
      family: 'calendar', method: 'daily_pivots', kind,
      price: dv[kind], touchCount: null,
      formationDate: series.dates[N - 1],
      firstKnownDate: D,
      firstTradableDate: D, // ⚠ S3-C7
    });
  }

  // Weekly pivots from the prior completed week (Monday-keyed; S3-C16) — apply to every
  // session of D's week, so firstKnown = the week's first session (≤ D).
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
    // First session of D's week: the first hist bar after lastPrior in D's week, else D itself.
    const firstOfCurWeek = lastPrior + 1 <= N - 1 ? series.dates[lastPrior + 1] : D;
    for (const kind of PIVOT_KINDS) {
      out.push({
        family: 'calendar', method: 'weekly_pivots', kind,
        price: wv[kind], touchCount: null,
        formationDate: series.dates[lastPrior],
        firstKnownDate: firstOfCurWeek,
        firstTradableDate: firstOfCurWeek, // ⚠ S3-C7
      });
    }
  }

  return out;
}

// ── confluence: family-counted snapshot assembly (parent §5.1; config levels.confluence) ──
function confluence(levels, ctx) {
  if (!levels.length) return [];
  // Deterministic total order: price, then family/method/kind/formationDate tie-breaks.
  const sorted = [...levels].sort((a, b) =>
    a.price - b.price ||
    cmp(a.family, b.family) || cmp(a.method, b.method) || cmp(a.kind || '', b.kind || '') ||
    cmp(a.formationDate, b.formationDate));

  // S3-C5: ascending-price greedy chaining against the running unweighted mean centroid.
  const groups = [];
  let cur = null;
  for (const lv of sorted) {
    if (cur && Math.abs(lv.price - cur.centroid) <= cur.centroid * (ALIGN_PCT / 100)) {
      cur.members.push(lv);
      cur.centroid = cur.members.reduce((s, m) => s + m.price, 0) / cur.members.length;
    } else {
      cur = { members: [lv], centroid: lv.price };
      groups.push(cur);
    }
  }

  const usedIds = new Set();
  return groups.map((g) => {
    const families = [...new Set(g.members.map((m) => m.family))].sort();
    const methods = [...new Set(g.members.map((m) => m.method))].sort();
    const tierCount = families.length;                              // count FAMILIES, not methods (§5.1)
    const zoneHalfWidth = ctx.atr != null ? ZONE_ATR_MULT * ctx.atr : null;
    let snapshotId = `${ctx.symbol}_${ctx.date}_snap_${g.centroid.toFixed(2)}`;
    for (let s = 2; usedIds.has(snapshotId); s++) snapshotId = `${ctx.symbol}_${ctx.date}_snap_${g.centroid.toFixed(2)}_${s}`;
    usedIds.add(snapshotId);
    return {
      snapshotId,
      date: ctx.date,
      centroid: g.centroid,
      zoneHalfWidth,
      zoneLow: zoneHalfWidth != null ? g.centroid - zoneHalfWidth : null,
      zoneHigh: zoneHalfWidth != null ? g.centroid + zoneHalfWidth : null,
      side: g.centroid <= ctx.refClose ? 'support' : 'resistance',  // S3-C8 (tie → support)
      families,
      tier: tierCount === 1 ? 'F1' : tierCount === 2 ? 'F2' : 'F3', // F3 = 3+ (§5.1)
      methods,                                                      // exact combination stored (§5.1)
      // S3-C6: composite availability = max over members (conservative).
      formationDate: maxIso(g.members.map((m) => m.formationDate)),
      firstKnownDate: maxIso(g.members.map((m) => m.firstKnownDate)),
      firstTradableDate: maxIso(g.members.map((m) => m.firstTradableDate)),
      members: g.members,
      familyId: null,                                               // assigned by the lineage step
    };
  });
}

function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function maxIso(arr) { return arr.reduce((m, d) => (d > m ? d : m)); }
